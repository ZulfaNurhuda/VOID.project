use anyhow::{anyhow, Context, Result};
use colored::Colorize;
use dialoguer::Password;
use serde::Deserialize;

#[cfg(not(windows))]
extern crate libc;
use std::collections::HashMap;
use std::io::{self, Write};
use std::process::Command;
use std::sync::atomic::{AtomicU32, Ordering};
use zeroize::Zeroizing;

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

// PID of the currently-running child process (0 = none).
// Written from the main thread, read from the ctrlc handler thread.
static CHILD_PID: AtomicU32 = AtomicU32::new(0);

/// Restore Windows console stdin to standard cooked mode.
/// Fixes ^H / raw-mode corruption left behind by children (e.g. node.js).
#[cfg(windows)]
fn restore_console_input_mode() {
    use std::ffi::c_void;
    extern "system" {
        fn GetStdHandle(nStdHandle: u32) -> *mut c_void;
        fn SetConsoleMode(hConsoleHandle: *mut c_void, dwMode: u32) -> i32;
    }
    const STD_INPUT_HANDLE: u32 = 0xFFFF_FFF6;
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
    let _ = crossterm::terminal::disable_raw_mode();
}

/// Kill the process tree rooted at `pid`.
fn kill_child(pid: u32) {
    #[cfg(windows)]
    let _ = Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .output();
    #[cfg(not(windows))]
    unsafe {
        libc::kill(pid as i32, libc::SIGTERM);
    }
}

/// Tokenise a command line, respecting single and double quotes.
/// "node index.js"  →  ["node", "index.js"]
/// echo "hi there"  →  ["echo", "hi there"]
fn tokenise(line: &str) -> Vec<String> {
    let mut tokens: Vec<String> = Vec::new();
    let mut cur = String::new();
    let mut in_quote: Option<char> = None;

    for ch in line.chars() {
        match in_quote {
            Some(q) if ch == q => in_quote = None,
            Some(_) => cur.push(ch),
            None => {
                if ch == '"' || ch == '\'' {
                    in_quote = Some(ch);
                } else if ch.is_whitespace() {
                    if !cur.is_empty() {
                        tokens.push(std::mem::take(&mut cur));
                    }
                } else {
                    cur.push(ch);
                }
            }
        }
    }
    if !cur.is_empty() {
        tokens.push(cur);
    }
    tokens
}

pub async fn run_shell(
    app_id_flag: Option<String>,
    env_flag: Option<String>,
    _use_bash: bool,
) -> Result<()> {
    // ── 1. Load config & auth ──────────────────────────────────────────────
    let global_cfg = global::load()?;
    let proj_cfg = project::load()?;

    let token = global_cfg
        .auth
        .token
        .as_deref()
        .ok_or_else(|| anyhow!("not authenticated. Run: void auth"))?;

    let host = global::api_host(&global_cfg);
    let client = ApiClient::new(&host, Some(token));

    let app_id = match app_id_flag {
        Some(name) => {
            let apps: Vec<AppItem> = client.get("/api/apps").await.context("list apps")?;
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

    let secrets_resp: SecretsResponse = client
        .get(&format!("/api/apps/{}/envs/{}/secrets", app_id, env_id))
        .await
        .context("fetch secrets")?;

    // ── 2. Decrypt secrets ────────────────────────────────────────────────
    let password = Password::new()
        .with_prompt("Password (to decrypt your private key)")
        .interact()?;

    let private_key = keys::load_private_key(&password)
        .context("decrypt private key (wrong password?)")?;

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
    drop(sym_key);

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

    // ── 3. Register Ctrl+C handler ────────────────────────────────────────
    //
    // Behaviour:
    //   • Child running  → kill child; main thread sees child.wait() return,
    //                      clears CHILD_PID, restores console, prints prompt.
    //   • No child (idle prompt) → exit void shell.
    ctrlc::set_handler(|| {
        let pid = CHILD_PID.load(Ordering::SeqCst);
        if pid != 0 {
            kill_child(pid);
            // CHILD_PID is cleared by the main thread after child.wait() returns.
        } else {
            restore_console_input_mode();
            eprintln!();
            std::process::exit(0);
        }
    })
    .expect("failed to register Ctrl-C handler");

    // ── 4. REPL loop ──────────────────────────────────────────────────────
    eprintln!(
        "{} type {} to exit\n",
        "void shell —".dimmed(),
        "exit".bold()
    );

    loop {
        restore_console_input_mode();

        // Print prompt: "void APP/ENV> "
        print!(
            "{}{}{} ",
            "void".cyan().bold(),
            format!(" {}/{}", app_id.chars().take(8).collect::<String>(), env_name).dimmed(),
            ">".cyan().bold()
        );
        io::stdout().flush().ok();

        let mut line = String::new();
        match io::stdin().read_line(&mut line) {
            Ok(0) => break, // EOF (Ctrl+D)
            Ok(_) => {}
            Err(_) => {
                // stdin interrupted (Ctrl+C handler already fired or will fire)
                continue;
            }
        }

        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if line == "exit" || line == "quit" {
            break;
        }

        // Built-in: cd
        if line == "cd" {
            if let Some(home) = dirs::home_dir() {
                let _ = std::env::set_current_dir(home);
            }
            continue;
        }
        if let Some(path) = line.strip_prefix("cd ") {
            if let Err(e) = std::env::set_current_dir(path.trim()) {
                eprintln!("cd: {}", e);
            }
            continue;
        }

        let parts = tokenise(line);
        if parts.is_empty() {
            continue;
        }

        match Command::new(&parts[0])
            .args(&parts[1..])
            .envs(&env_vars)
            .spawn()
        {
            Ok(mut child) => {
                CHILD_PID.store(child.id(), Ordering::SeqCst);
                let _ = child.wait();
                CHILD_PID.store(0, Ordering::SeqCst);
                restore_console_input_mode();
            }
            Err(e) => {
                eprintln!("{}: {}: {}", "void".cyan().bold(), parts[0], e);
            }
        }
    }

    eprintln!("{}", "void shell exited.".dimmed());
    Ok(())
}
