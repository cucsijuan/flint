use std::collections::BTreeMap;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

const USER_AGENT: &str = concat!("Flint/", env!("CARGO_PKG_VERSION"));
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

/// An HTTP client that trusts the system's certificate store, where companies install their CAs.
pub fn client() -> Result<reqwest::Client> {
    // The updater installs the same provider; whichever runs first wins.
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    Ok(reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(DEFAULT_TIMEOUT)
        .build()?)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    url: String,
    #[serde(default = "get")]
    method: String,
    #[serde(default)]
    headers: BTreeMap<String, String>,
    body: Option<String>,
    timeout_ms: Option<u64>,
}

fn get() -> String {
    "GET".to_owned()
}

#[derive(Debug, Serialize)]
pub struct HttpResponse {
    status: u16,
    headers: BTreeMap<String, String>,
    body: String,
}

/// Makes a plugin's request from Rust, where the page's CORS rules don't apply.
#[tauri::command]
pub async fn plugin_http_request(request: HttpRequest) -> Result<HttpResponse> {
    let url =
        reqwest::Url::parse(&request.url).map_err(|error| Error::Plugin(error.to_string()))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(Error::Plugin(format!("unsupported URL: {url}")));
    }
    let method = reqwest::Method::from_bytes(request.method.to_uppercase().as_bytes())
        .map_err(|error| Error::Plugin(error.to_string()))?;
    let mut builder = client()?.request(method, url);
    for (name, value) in &request.headers {
        builder = builder.header(name, value);
    }
    if let Some(body) = request.body {
        builder = builder.body(body);
    }
    if let Some(timeout) = request.timeout_ms {
        builder = builder.timeout(Duration::from_millis(timeout));
    }
    let response = builder.send().await?;
    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| Some((name.to_string(), value.to_str().ok()?.to_owned())))
        .collect();
    let body = response.text().await?;
    Ok(HttpResponse {
        status,
        headers,
        body,
    })
}
