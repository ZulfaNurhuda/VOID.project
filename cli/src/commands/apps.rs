use anyhow::{anyhow, Result};
use colored::Colorize;
use serde::Deserialize;

use crate::api::client::ApiClient;
use crate::config::global;

#[derive(Deserialize)]
struct App {
    id: String,
    name: String,
    workspace_type: String,
}

pub async fn list() -> Result<()> {
    let config = global::load()?;
    let token = config
        .auth
        .token
        .as_deref()
        .ok_or_else(|| anyhow!("not authenticated"))?;
    let client = ApiClient::new(&global::api_host(&config), Some(token));
    let apps: Vec<App> = client.get("/api/apps").await?;
    if apps.is_empty() {
        println!("{}", "No apps.".dimmed());
        return Ok(());
    }
    println!(
        "{:<40} {:<12} {}",
        "NAME".dimmed(),
        "TYPE".dimmed(),
        "ID".dimmed()
    );
    println!("{}", "─".repeat(70).dimmed());
    for a in &apps {
        println!(
            "{:<40} {:<12} {}",
            a.name.cyan(),
            a.workspace_type.dimmed(),
            a.id.dimmed()
        );
    }
    Ok(())
}
