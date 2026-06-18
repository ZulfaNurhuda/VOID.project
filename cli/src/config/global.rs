use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct GlobalConfig {
    #[serde(default)]
    pub auth: AuthConfig,
    #[serde(default)]
    pub keys: KeysConfig,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct AuthConfig {
    pub email: Option<String>,
    pub user_id: Option<String>,
    pub token: Option<String>,
    pub api_host: Option<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct KeysConfig {
    pub public_key_path: Option<String>,
    pub private_key_path: Option<String>,
}

pub fn config_dir() -> PathBuf {
    dirs::home_dir()
        .expect("cannot find home directory")
        .join(".void")
}

pub fn load() -> Result<GlobalConfig> {
    let path = config_dir().join("config.toml");
    if !path.exists() {
        return Ok(GlobalConfig::default());
    }
    let contents = fs::read_to_string(&path)
        .with_context(|| format!("read config: {}", path.display()))?;
    toml::from_str(&contents).context("parse config.toml")
}

pub fn save(config: &GlobalConfig) -> Result<()> {
    let dir = config_dir();
    fs::create_dir_all(&dir).context("create ~/.void")?;
    let path = dir.join("config.toml");
    let contents = toml::to_string_pretty(config).context("serialize config")?;
    fs::write(&path, contents).with_context(|| format!("write config: {}", path.display()))
}

pub fn api_host(config: &GlobalConfig) -> String {
    config
        .auth
        .api_host
        .clone()
        .unwrap_or_else(|| "http://localhost".to_string())
}
