use anyhow::{anyhow, Context, Result};
use colored::Colorize;
use crossterm::terminal;
use dialoguer::Password;
use serde::Deserialize;
use std::collections::HashMap;
use std::process::Command;
use std::sync::atomic::{AtomicU32, AtomicUsize, Ordering};
use zeroize::Zeroizing;

#[cfg(not(windows))]
extern crate libc;

use crate::api::client::ApiClient;
use crate::config::{global, project};
use crate::crypto::{chacha, keys, x25519};

#[derive(Deserialize)]
struct SecretsResponse {
    encrypted_team_symmetric_key: String,
    secrets: Vec<SecretItem>,
}

#[derive(Deserialize)]
struct SecretItem {
    key: String,
    encrypted_value: String,
}

#[derive(Deserialize)]
struct AppItem {
    id: String,
    name: String,
}

#[derive(Deserialize)]
struct EnvItem {
    id: String,
    name: String,
}

// Shared across the process lifetime — safe because run_exec is called once per invocation.
static CHILD_PID: AtomicU32 = AtomicU32::new(0);
static CTRL_C_PRESSES: AtomicUsize = AtomicUsize::new(0);

/// On Windows, restore the console stdin to standard cooked mode.
/// Called after Ctrl+C so that any raw-mode corruption from grandchild processes
/// (e.g. node.js disabling ENABLE_PROCESSED_INPUT) is undone.
#[cfg(windows)]
fn restore_console_input_mode() {
    use std::ffi::c_void;
    extern "system" {
        fn GetStdHandle(nStdHandle: u32) -> *mut c_void;
        fn SetConsoleMode(hConsoleHandle: *mut c_void, dwMode: u32) -> i32;
    }
    const STD_INPUT_HANDLE: u32 = 0xFFFF_FFF6; // (DWORD)(-10)
    const ENABLE_PROCESSED_INPUT: u32 = 0x0001;
    const ENABLE_LINE_INPUT: u32 = 0x0002;
    const ENABLE_ECHO_INPUT: u32 = 0x0004;
    unsafe {
        let h = GetStdHandle(STD_INPUT_HANDLE);
        SetConsoleMode(h, ENABLE_PROCESSED_INPUT | ENABLE_LINE_INPUT | ENABLE_ECHO_INPUT);
    }
}

#[cfg(not(windows))]
fn restore_console_input_mode() {
    let _ = terminal::disable_raw_mode();
}

pub async fn run_exec(
    app_id_flag: Option<String>,
    env_flag: Option<String>,
    command: Vec<String>,
) -> Result<()> {
    if command.is_empty() {
        return Err(anyhow!(
            "no command specified. Usage: void run -- COMMAND [ARGS...]"
        ));
    }

    let global_cfg = global::load()?;
    let proj_cfg = project::load()?;

    let token = global_cfg
        .auth
        .token
        .as_deref()
        .ok_or_else(|| anyhow!("not authenticated. Run: void auth"))?;

    let host = global::api_host(&global_cfg);
    let client = ApiClient::new(&host, Some(token));

    // Resolve app name → app ID (or use default_app_id from project config)
    let app_id = match app_id_flag {
        Some(name) => {
            let apps: Vec<AppItem> = client
                .get("/api/apps")
                .await
                .context("list apps")?;
            apps.into_iter()
                .find(|a| a.name == name)
                .ok_or_else(|| anyhow!("app '{}' not found", name))?
                .id
        }
        None => proj_cfg
            .default_app_id
            .ok_or_else(|| anyhow!("no app specified. Use --app or run: void init"))?,
    };

    let env_name = env_flag
        .or(proj_cfg.default_environment)
        .ok_or_else(|| anyhow!("no environment specified. Use --env or run: void init"))?;

    // Resolve env name → env_id
    let envs: Vec<EnvItem> = client
        .get(&format!("/api/apps/{}/envs", app_id))
        .await
        .context("list environments")?;

    let env_id = envs
        .iter()
        .find(|e| e.name == env_name)
        .ok_or_else(|| anyhow!("environment '{}' not found", env_name))?
        .id
        .clone();

    // Fetch encrypted secrets
    let secrets_resp: SecretsResponse = client
        .get(&format!("/api/apps/{}/envs/{}/secrets", app_id, env_id))
        .await
        .context("fetch secrets")?;

    // Prompt for password to decrypt private key
    let password = Password::new()
        .with_prompt("Password (to decrypt your private key)")
        .interact()?;

    // Decrypt private key
    let private_key = keys::load_private_key(&password)
        .context("decrypt private key (wrong password?)")?;

    // Decrypt team sym key via X25519 ECDH
    let sym_key_vec = x25519::decrypt_sym_key(
        &private_key,
        &secrets_resp.encrypted_team_symmetric_key,
    )
    .context("decrypt team symmetric key")?;

    let sym_key: [u8; 32] = sym_key_vec
        .as_slice()
        .try_into()
        .map_err(|_| anyhow!("sym key wrong length"))?;
    let sym_key = Zeroizing::new(sym_key);

    // Decrypt all secrets
    let mut env_vars: HashMap<String, String> = HashMap::new();
    let mut decrypt_errors = 0usize;

    for secret in &secrets_resp.secrets {
        match chacha::decrypt(&sym_key, &secret.encrypted_value) {
            Ok(plaintext) => {
                env_vars.insert(
                    secret.key.clone(),
                    String::from_utf8_lossy(&plaintext).into_owned(),
                );
            }
            Err(e) => {
                eprintln!("{} decrypt {}: {}", "warn:".yellow(), secret.key, e);
                decrypt_errors += 1;
            }
        }
    }

    eprintln!(
        "{} {} secrets loaded{}",
        "→".green().bold(),
        env_vars.len(),
        if decrypt_errors > 0 {
            format!(" ({} failed)", decrypt_errors)
        } else {
            String::new()
        }
    );

    // Restore terminal to cooked mode before handing control to the child.
    let _ = terminal::disable_raw_mode();

    let prog = &command[0];
    let args = &command[1..];

    // Register Ctrl+C handler BEFORE spawning so we never miss a signal.
    //
    // Behaviour:
    //   - First Ctrl+C while child is running: restore console mode (fixes ^H
    //     caused by grandchild processes like node.js leaving raw mode behind)
    //     and do NOT exit — the OS already delivered CTRL_C_EVENT to the whole
    //     console process group, so the child/grandchild handles it itself.
    //   - Second Ctrl+C (or first when no child is running): kill child tree
    //     and exit void.
    CTRL_C_PRESSES.store(0, Ordering::SeqCst);
    ctrlc::set_handler(|| {
        let presses = CTRL_C_PRESSES.fetch_add(1, Ordering::SeqCst) + 1;
        let pid = CHILD_PID.load(Ordering::SeqCst);

        if presses == 1 && pid != 0 {
            // First press while child is alive: restore console mode and let
            // the OS-delivered CTRL_C_EVENT propagate to the child naturally.
            restore_console_input_mode();
        } else {
            // Second press, or first press after child already exited: clean up
            // and exit void.
            restore_console_input_mode();
            if pid != 0 {
                #[cfg(windows)]
                let _ = Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .output();
                #[cfg(not(windows))]
                unsafe {
                    libc::kill(pid as i32, libc::SIGTERM);
                }
            }
            std::process::exit(130);
        }
    })
    .expect("failed to register Ctrl-C handler");

    let mut child = Command::new(prog)
        .args(args)
        .envs(&env_vars)
        .spawn()
        .with_context(|| format!("execute '{}'", prog))?;

    // Make PID visible to the Ctrl+C handler.
    CHILD_PID.store(child.id(), Ordering::SeqCst);

    // env_vars contains plaintext secrets — clear them from this process now
    // that the child has its own copy via the OS.
    drop(env_vars);
    drop(sym_key);

    let status = child.wait().with_context(|| format!("wait for '{}'", prog))?;

    CHILD_PID.store(0, Ordering::SeqCst);
    restore_console_input_mode();

    std::process::exit(status.code().unwrap_or(1));
}
