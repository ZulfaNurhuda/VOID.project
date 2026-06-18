use anyhow::{anyhow, Context, Result};
use colored::Colorize;
use dialoguer::{Confirm, Password};
use serde::Deserialize;
use serde_json::json;
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
    id: String,
    key: String,
    encrypted_value: String,
    created_by_name: Option<String>,
    updated_at: String,
}

#[derive(Deserialize)]
struct EnvItem {
    id: String,
    name: String,
}

async fn make_client() -> Result<ApiClient> {
    let config = global::load()?;
    let token = config
        .auth
        .token
        .as_deref()
        .ok_or_else(|| anyhow!("not authenticated. Run: void auth"))?
        .to_string();
    let host = global::api_host(&config);
    Ok(ApiClient::new(&host, Some(&token)))
}

async fn resolve_env_id(client: &ApiClient, app_id: &str, env_name: &str) -> Result<String> {
    let envs: Vec<EnvItem> = client
        .get(&format!("/api/apps/{}/envs", app_id))
        .await
        .context("list environments")?;
    envs.iter()
        .find(|e| e.name == env_name)
        .ok_or_else(|| anyhow!("environment '{}' not found", env_name))
        .map(|e| e.id.clone())
}

async fn resolve_ids(
    app_override: Option<String>,
    env_override: Option<String>,
) -> Result<(String, String, ApiClient)> {
    let proj = project::load()?;
    let app_id = app_override
        .or(proj.default_app_id)
        .ok_or_else(|| anyhow!("no app specified. Use --app or run: void init"))?;
    let env_name = env_override
        .or(proj.default_environment)
        .ok_or_else(|| anyhow!("no environment specified. Use --env or run: void init"))?;
    let client = make_client().await?;
    let env_id = resolve_env_id(&client, &app_id, &env_name).await?;
    Ok((app_id, env_id, client))
}

pub async fn list(app: Option<String>, env: Option<String>, keys_only: bool) -> Result<()> {
    let (app_id, env_id, client) = resolve_ids(app, env).await?;
    let resp: SecretsResponse = client
        .get(&format!("/api/apps/{}/envs/{}/secrets", app_id, env_id))
        .await?;

    if resp.secrets.is_empty() {
        println!("{}", "No secrets.".dimmed());
        return Ok(());
    }

    if keys_only {
        for s in &resp.secrets {
            println!("{}", s.key);
        }
        return Ok(());
    }

    println!(
        "{:<40} {:<20} {}",
        "KEY".dimmed(),
        "UPDATED".dimmed(),
        "CREATED BY".dimmed()
    );
    println!("{}", "─".repeat(70).dimmed());
    for s in &resp.secrets {
        let updated = s.updated_at.split('T').next().unwrap_or(&s.updated_at);
        println!(
            "{:<40} {:<20} {}",
            s.key.cyan(),
            updated,
            s.created_by_name.as_deref().unwrap_or("?").dimmed()
        );
    }
    println!(
        "\n{} {} secrets (values hidden — unlock with `void secrets get KEY`)",
        resp.secrets.len().to_string().bold(),
        "total.".dimmed()
    );
    Ok(())
}

pub async fn get(app: Option<String>, env: Option<String>, key: String) -> Result<()> {
    let (app_id, env_id, client) = resolve_ids(app, env).await?;
    let resp: SecretsResponse = client
        .get(&format!("/api/apps/{}/envs/{}/secrets", app_id, env_id))
        .await?;

    let secret = resp
        .secrets
        .iter()
        .find(|s| s.key == key)
        .ok_or_else(|| anyhow!("secret '{}' not found", key))?;

    let password = Password::new()
        .with_prompt("Password (to decrypt)")
        .interact()?;

    let priv_key = keys::load_private_key(&password)?;
    let sym_key_vec =
        x25519::decrypt_sym_key(&priv_key, &resp.encrypted_team_symmetric_key)?;
    let sym_key: [u8; 32] = sym_key_vec
        .as_slice()
        .try_into()
        .map_err(|_| anyhow!("sym key wrong length"))?;
    let sym_key = Zeroizing::new(sym_key);

    let plaintext = chacha::decrypt(&sym_key, &secret.encrypted_value)?;
    let value = String::from_utf8_lossy(&plaintext);
    println!("{}", value);
    Ok(())
}

pub async fn create(
    app: Option<String>,
    env: Option<String>,
    key: String,
    value: String,
) -> Result<()> {
    let (app_id, env_id, client) = resolve_ids(app, env).await?;
    let resp: SecretsResponse = client
        .get(&format!("/api/apps/{}/envs/{}/secrets", app_id, env_id))
        .await?;

    let password = Password::new()
        .with_prompt("Password (to encrypt the new secret)")
        .interact()?;

    let priv_key = keys::load_private_key(&password)?;
    let sym_key_vec =
        x25519::decrypt_sym_key(&priv_key, &resp.encrypted_team_symmetric_key)?;
    let sym_key: [u8; 32] = sym_key_vec
        .as_slice()
        .try_into()
        .map_err(|_| anyhow!("sym key wrong length"))?;
    let sym_key = Zeroizing::new(sym_key);

    let encrypted = chacha::encrypt(&sym_key, value.as_bytes())?;
    let _: serde_json::Value = client
        .post(
            &format!("/api/apps/{}/envs/{}/secrets", app_id, env_id),
            &json!({ "key": key, "encrypted_value": encrypted }),
        )
        .await
        .context("create secret")?;

    println!("{} created '{}'", "✓".green(), key.bold());
    Ok(())
}

pub async fn delete(
    app: Option<String>,
    env: Option<String>,
    key: String,
    force: bool,
) -> Result<()> {
    let (app_id, env_id, client) = resolve_ids(app, env).await?;
    let resp: SecretsResponse = client
        .get(&format!("/api/apps/{}/envs/{}/secrets", app_id, env_id))
        .await?;

    let secret = resp
        .secrets
        .iter()
        .find(|s| s.key == key)
        .ok_or_else(|| anyhow!("secret '{}' not found", key))?;

    if !force
        && !Confirm::new()
            .with_prompt(format!("Delete '{}'?", key))
            .interact()?
    {
        println!("Aborted.");
        return Ok(());
    }

    client
        .delete(&format!(
            "/api/apps/{}/envs/{}/secrets/{}",
            app_id, env_id, secret.id
        ))
        .await?;
    println!("{} deleted '{}'", "✓".green(), key.bold());
    Ok(())
}
