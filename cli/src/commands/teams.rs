use anyhow::{anyhow, Result};
use colored::Colorize;
use serde::Deserialize;

use crate::api::client::ApiClient;
use crate::config::global;

#[derive(Deserialize)]
struct Team {
    id: String,
    name: String,
    owner_id: String,
}

pub async fn list() -> Result<()> {
    let config = global::load()?;
    let token = config
        .auth
        .token
        .as_deref()
        .ok_or_else(|| anyhow!("not authenticated"))?;
    let client = ApiClient::new(&global::api_host(&config), Some(token));
    let teams: Vec<Team> = client.get("/api/teams").await?;
    if teams.is_empty() {
        println!("{}", "No teams.".dimmed());
        return Ok(());
    }
    println!("{:<40} {}", "NAME".dimmed(), "ID".dimmed());
    println!("{}", "─".repeat(60).dimmed());
    let my_id = config.auth.user_id.as_deref().unwrap_or("");
    for t in &teams {
        let suffix = if t.owner_id == my_id {
            " (owner)".dimmed().to_string()
        } else {
            String::new()
        };
        println!("{:<40} {}{}", t.name.cyan(), t.id.dimmed(), suffix);
    }
    Ok(())
}
