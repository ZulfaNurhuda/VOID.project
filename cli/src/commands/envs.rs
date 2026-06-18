use anyhow::{anyhow, Result};
use colored::Colorize;
use serde::Deserialize;

use crate::api::client::ApiClient;
use crate::config::{global, project};

#[derive(Deserialize)]
struct Env {
    id: String,
    name: String,
}

pub async fn list(app: Option<String>) -> Result<()> {
    let config = global::load()?;
    let proj = project::load()?;
    let app_id = app
        .or(proj.default_app_id)
        .ok_or_else(|| anyhow!("no app specified"))?;
    let token = config
        .auth
        .token
        .as_deref()
        .ok_or_else(|| anyhow!("not authenticated"))?;
    let client = ApiClient::new(&global::api_host(&config), Some(token));
    let envs: Vec<Env> = client
        .get(&format!("/api/apps/{}/envs", app_id))
        .await?;
    if envs.is_empty() {
        println!("{}", "No environments.".dimmed());
        return Ok(());
    }
    for e in &envs {
        println!("{:<20} {}", e.name.cyan(), e.id.dimmed());
    }
    Ok(())
}
