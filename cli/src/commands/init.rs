use anyhow::Result;
use colored::Colorize;
use dialoguer::Select;
use serde::Deserialize;
use std::path::Path;

use crate::api::client::ApiClient;
use crate::config::{global, project::ProjectConfig};

#[derive(Deserialize, Default)]
struct Team {
    id: String,
    name: String,
}

#[derive(Deserialize, Default)]
struct App {
    id: String,
    name: String,
}

#[derive(Deserialize, Default)]
struct Env {
    id: String,
    name: String,
}

pub async fn run_init() -> Result<()> {
    let config = global::load()?;
    let token = config
        .auth
        .token
        .as_deref()
        .ok_or_else(|| anyhow::anyhow!("not authenticated. Run: void auth"))?;
    let client = ApiClient::new(&global::api_host(&config), Some(token));

    // Choose workspace (personal or team)
    let teams: Vec<Team> = client.get("/api/teams").await.unwrap_or_default();
    let workspace_choices: Vec<String> = std::iter::once("Personal workspace".to_string())
        .chain(teams.iter().map(|t| format!("Team: {}", t.name)))
        .collect();

    let ws_idx = Select::new()
        .with_prompt("Select workspace")
        .items(&workspace_choices)
        .default(0)
        .interact()?;

    let (workspace_type, workspace_id, workspace_name) = if ws_idx == 0 {
        (
            "personal".to_string(),
            "personal".to_string(),
            "personal".to_string(),
        )
    } else {
        let t = &teams[ws_idx - 1];
        ("team".to_string(), t.id.clone(), t.name.clone())
    };

    // Choose app
    let apps_url = if workspace_type == "team" {
        format!(
            "/api/apps?workspace_type=team&workspace_id={}",
            workspace_id
        )
    } else {
        "/api/apps?workspace_type=personal".to_string()
    };
    let apps: Vec<App> = client.get(&apps_url).await.unwrap_or_default();

    if apps.is_empty() {
        println!("{}", "No apps found in this workspace.".yellow());
        return Ok(());
    }

    let app_names: Vec<&str> = apps.iter().map(|a| a.name.as_str()).collect();
    let app_idx = Select::new()
        .with_prompt("Select default app")
        .items(&app_names)
        .default(0)
        .interact()?;
    let selected_app = &apps[app_idx];

    // Choose environment
    let envs: Vec<Env> = client
        .get(&format!("/api/apps/{}/envs", selected_app.id))
        .await
        .unwrap_or_default();

    let default_env = if envs.is_empty() {
        "dev".to_string()
    } else {
        let env_names: Vec<&str> = envs.iter().map(|e| e.name.as_str()).collect();
        let env_idx = Select::new()
            .with_prompt("Select default environment")
            .items(&env_names)
            .default(0)
            .interact()?;
        envs[env_idx].name.clone()
    };

    let proj = ProjectConfig {
        api_host: Some(global::api_host(&config)),
        workspace_type: Some(workspace_type),
        workspace_id: Some(workspace_id),
        workspace_name: Some(workspace_name),
        default_app: Some(selected_app.name.clone()),
        default_app_id: Some(selected_app.id.clone()),
        default_environment: Some(default_env.clone()),
    };

    let output_path = Path::new(".void.json");
    crate::config::project::save(output_path, &proj)?;

    println!(
        "{} Created .void.json (app: {}, env: {})",
        "✓".green(),
        selected_app.name.bold(),
        default_env.bold()
    );
    Ok(())
}
