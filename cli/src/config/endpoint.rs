use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use std::fs;

const DEFAULT_ENDPOINT: &str = "https://void.moonsh.dev";
const CONF_FILENAME: &str = "void.cli-conf.json";

#[derive(Deserialize)]
struct CliConf {
    endpoint: String,
}

#[derive(Deserialize)]
struct CompatResponse {
    #[serde(rename = "void")]
    is_void: bool,
}

/// Probe the endpoint to confirm it's a VOID instance.
async fn probe(endpoint: &str) -> Result<()> {
    let url = format!("{}/api/void/compat", endpoint.trim_end_matches('/'));
    let resp = reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .with_context(|| format!("cannot reach {}", endpoint))?;

    if !resp.status().is_success() {
        return Err(anyhow!("{} returned HTTP {}", endpoint, resp.status()));
    }

    let compat: CompatResponse = resp
        .json()
        .await
        .with_context(|| format!("{} did not return valid VOID compat response", endpoint))?;

    if !compat.is_void {
        return Err(anyhow!("{} is not a VOID instance", endpoint));
    }

    Ok(())
}

fn read_conf_file(path: &str) -> Result<String> {
    let raw = fs::read_to_string(path)
        .with_context(|| format!("cannot read conf file: {}", path))?;
    let conf: CliConf = serde_json::from_str(&raw)
        .with_context(|| format!("invalid JSON in {}", path))?;
    Ok(conf.endpoint)
}

/// Resolve the API endpoint using the priority chain:
/// 1. --endpoint <url>
/// 2. --conf <file>  (reads endpoint from JSON)
/// 3. void.cli-conf.json in current working directory
/// 4. https://void.moonsh.dev (default)
///
/// Steps 1–3 are validated via /api/void/compat.
/// Step 4 (default) is used as-is without probing.
pub async fn resolve(
    endpoint_flag: Option<String>,
    conf_flag: Option<String>,
) -> Result<String> {
    // 1. --endpoint
    if let Some(ep) = endpoint_flag {
        let ep = ep.trim_end_matches('/').to_string();
        probe(&ep).await.with_context(|| {
            format!("--endpoint '{}' is not a compatible VOID instance", ep)
        })?;
        return Ok(ep);
    }

    // 2. --conf
    if let Some(path) = conf_flag {
        let ep = read_conf_file(&path)?.trim_end_matches('/').to_string();
        probe(&ep).await.with_context(|| {
            format!("endpoint '{}' from --conf '{}' is not a compatible VOID instance", ep, path)
        })?;
        return Ok(ep);
    }

    // 3. void.cli-conf.json in cwd
    let cwd = std::env::current_dir().context("cannot determine current directory")?;
    let local_conf = cwd.join(CONF_FILENAME);
    if local_conf.exists() {
        let ep = read_conf_file(local_conf.to_str().unwrap())?
            .trim_end_matches('/')
            .to_string();
        probe(&ep).await.with_context(|| {
            format!(
                "endpoint '{}' from {} is not a compatible VOID instance",
                ep, CONF_FILENAME
            )
        })?;
        return Ok(ep);
    }

    // 4. default
    Ok(DEFAULT_ENDPOINT.to_string())
}
