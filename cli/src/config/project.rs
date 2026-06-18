use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub api_host: Option<String>,
    pub workspace_type: Option<String>,
    pub workspace_id: Option<String>,
    pub workspace_name: Option<String>,
    pub default_app: Option<String>,
    pub default_app_id: Option<String>,
    pub default_environment: Option<String>,
}

/// Walk up from cwd looking for .void.json
pub fn find() -> Option<PathBuf> {
    let mut dir = std::env::current_dir().ok()?;
    loop {
        let candidate = dir.join(".void.json");
        if candidate.exists() {
            return Some(candidate);
        }
        if !dir.pop() {
            return None;
        }
    }
}

pub fn load() -> Result<ProjectConfig> {
    match find() {
        None => Ok(ProjectConfig::default()),
        Some(path) => {
            let contents = fs::read_to_string(&path)
                .with_context(|| format!("read .void.json at {}", path.display()))?;
            serde_json::from_str(&contents).context("parse .void.json")
        }
    }
}

pub fn save(path: &Path, config: &ProjectConfig) -> Result<()> {
    let contents =
        serde_json::to_string_pretty(config).context("serialize .void.json")?;
    fs::write(path, contents)
        .with_context(|| format!("write {}", path.display()))
}
