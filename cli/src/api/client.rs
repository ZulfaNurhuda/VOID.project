use anyhow::{anyhow, Context, Result};
use reqwest::{Client, Response};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;

pub struct ApiClient {
    client: Client,
    base_url: String,
    token: Option<String>,
}

impl ApiClient {
    pub fn new(base_url: &str, token: Option<&str>) -> Self {
        ApiClient {
            client: Client::builder()
                .cookie_store(true)
                .build()
                .expect("build reqwest client"),
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.map(|t| t.to_string()),
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    async fn check(resp: Response) -> Result<Response> {
        let status = resp.status();
        if status.is_success() {
            return Ok(resp);
        }
        let body: Value = resp.json().await.unwrap_or_default();
        let msg = body["error"].as_str().unwrap_or("unknown error");
        Err(anyhow!(
            "API {} {}: {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or(""),
            msg
        ))
    }

    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let mut req = self.client.get(self.url(path));
        if let Some(t) = &self.token {
            req = req.bearer_auth(t);
        }
        let resp = req.send().await.context("HTTP GET")?;
        Self::check(resp).await?.json().await.context("parse response")
    }

    pub async fn post<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T> {
        let mut req = self.client.post(self.url(path)).json(body);
        if let Some(t) = &self.token {
            req = req.bearer_auth(t);
        }
        let resp = req.send().await.context("HTTP POST")?;
        Self::check(resp).await?.json().await.context("parse response")
    }

    pub async fn put<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T> {
        let mut req = self.client.put(self.url(path)).json(body);
        if let Some(t) = &self.token {
            req = req.bearer_auth(t);
        }
        let resp = req.send().await.context("HTTP PUT")?;
        Self::check(resp).await?.json().await.context("parse response")
    }

    pub async fn delete(&self, path: &str) -> Result<()> {
        let mut req = self.client.delete(self.url(path));
        if let Some(t) = &self.token {
            req = req.bearer_auth(t);
        }
        let resp = req.send().await.context("HTTP DELETE")?;
        Self::check(resp).await?;
        Ok(())
    }

    /// POST and return full text (for non-JSON responses)
    pub async fn post_text<B: Serialize>(&self, path: &str, body: &B) -> Result<String> {
        let mut req = self.client.post(self.url(path)).json(body);
        if let Some(t) = &self.token {
            req = req.bearer_auth(t);
        }
        let resp = req.send().await.context("HTTP POST")?;
        Self::check(resp)
            .await?
            .text()
            .await
            .context("read response text")
    }
}
