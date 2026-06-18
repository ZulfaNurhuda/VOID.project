use anyhow::{Context, Result};
use colored::Colorize;
use dialoguer::{Input, Password};
use serde::Deserialize;
use serde_json::json;

use crate::api::client::ApiClient;
use crate::config::global::{self, GlobalConfig};
use crate::crypto::keys;

#[derive(Deserialize)]
struct LoginResponse {
    token: String,
    user: UserInfo,
}

#[derive(Deserialize)]
struct UserInfo {
    id: String,
    username: String,
    email: String,
    private_key_encrypted: Option<String>,
}

pub async fn run_auth(username_arg: Option<String>, password_arg: Option<String>) -> Result<()> {
    let username: String = match username_arg {
        Some(u) => u,
        None => Input::new().with_prompt("Username").interact_text()?,
    };
    let password: String = match password_arg {
        Some(p) => p,
        None => Password::new().with_prompt("Password").interact()?,
    };

    let mut config = global::load().unwrap_or_default();
    let host = global::api_host(&config);
    let client = ApiClient::new(&host, None);

    let resp: LoginResponse = client
        .post("/api/cli/auth/login", &json!({ "username": username, "password": password }))
        .await
        .context("login failed")?;

    // Save encrypted private key if provided
    if let Some(enc_pk) = &resp.user.private_key_encrypted {
        keys::save_private_key(enc_pk)?;
    }

    config.auth.email = Some(resp.user.email.clone());
    config.auth.user_id = Some(resp.user.id.clone());
    config.auth.token = Some(resp.token.clone());
    global::save(&config)?;

    println!(
        "{} Logged in as {} ({})",
        "✓".green(),
        resp.user.username.bold(),
        resp.user.email.dimmed()
    );
    Ok(())
}

pub async fn run_logout() -> Result<()> {
    let config = global::load()?;
    if let Some(token) = &config.auth.token {
        let host = global::api_host(&config);
        let client = ApiClient::new(&host, Some(token));
        let _ = client
            .post::<serde_json::Value, serde_json::Value>("/api/auth/logout", &json!({}))
            .await;
    }
    global::save(&GlobalConfig::default())?;
    println!("{} Logged out.", "✓".green());
    Ok(())
}

pub async fn run_whoami() -> Result<()> {
    let config = global::load()?;
    match (&config.auth.email, &config.auth.user_id) {
        (Some(email), Some(id)) => {
            println!("{}", email.bold());
            println!("{}", id.dimmed());
        }
        _ => println!("{}", "Not logged in. Run: void auth".yellow()),
    }
    Ok(())
}
