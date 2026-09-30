//! Community plugins: the list in the flint-plugins repository and installing from GitHub releases.

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::net;
use crate::plugins::{self, PluginManifest};
use crate::vault::Vault;

const REGISTRY_URL: &str =
    "https://raw.githubusercontent.com/cucsijuan/flint-plugins/main/plugins.json";
const REQUIRED_FILES: [&str; 2] = ["manifest.json", "main.js"];
const OPTIONAL_FILES: [&str; 1] = ["styles.css"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommunityPlugin {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub description: String,
    /// `owner/name` on GitHub.
    pub repo: String,
}

#[derive(Debug, Deserialize)]
struct Release {
    tag_name: String,
    assets: Vec<Asset>,
}

#[derive(Debug, Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

impl Release {
    fn asset_url(&self, name: &str) -> Option<&str> {
        self.assets
            .iter()
            .find(|asset| asset.name == name)
            .map(|asset| asset.browser_download_url.as_str())
    }

    fn version(&self) -> &str {
        self.tag_name.trim_start_matches('v')
    }
}

fn is_valid_repo(repo: &str) -> bool {
    let mut parts = repo.split('/');
    let is_part = |part: Option<&str>| {
        part.is_some_and(|part| {
            !part.is_empty()
                && !part.starts_with('.')
                && part
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
        })
    };
    is_part(parts.next()) && is_part(parts.next()) && parts.next().is_none()
}

async fn latest_release(client: &reqwest::Client, repo: &str) -> Result<Release> {
    if !is_valid_repo(repo) {
        return Err(Error::Plugin(format!("invalid repository: {repo}")));
    }
    let url = format!("https://api.github.com/repos/{repo}/releases/latest");
    Ok(client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?)
}

pub async fn list() -> Result<Vec<CommunityPlugin>> {
    let response = net::client()?.get(REGISTRY_URL).send().await?;
    Ok(response.error_for_status()?.json().await?)
}

/// The version of each repository's latest release, `None` where it couldn't be read.
pub async fn latest_versions(repos: Vec<String>) -> Result<Vec<Option<String>>> {
    let client = net::client()?;
    let mut versions = Vec::with_capacity(repos.len());
    for repo in repos {
        let release = latest_release(&client, &repo).await.ok();
        versions.push(release.map(|release| release.version().to_owned()));
    }
    Ok(versions)
}

/// Downloads the plugin's latest release into `.flint/plugins/<id>`, replacing any older version.
pub async fn install(vault: &Vault, plugin: &CommunityPlugin) -> Result<PluginManifest> {
    let client = net::client()?;
    let release = latest_release(&client, &plugin.repo).await?;
    let mut files = Vec::new();
    for name in REQUIRED_FILES.iter().chain(&OPTIONAL_FILES) {
        let Some(url) = release.asset_url(name) else {
            if REQUIRED_FILES.contains(name) {
                return Err(Error::Plugin(format!("the latest release has no {name}")));
            }
            continue;
        };
        let text = client
            .get(url)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;
        files.push((*name, text));
    }
    let manifest: PluginManifest = serde_json::from_str(&files[0].1)
        .map_err(|error| Error::Plugin(format!("invalid manifest.json: {error}")))?;
    if manifest.id != plugin.id {
        return Err(Error::Plugin(format!(
            "manifest.json says {}, expected {}",
            manifest.id, plugin.id
        )));
    }
    plugins::write_files(vault, &manifest.id, &files)?;
    Ok(manifest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_release_assets_and_versions() {
        let release: Release = serde_json::from_str(
            r#"{"tag_name": "v1.2.0", "assets": [{"name": "main.js", "browser_download_url": "https://x/main.js"}]}"#,
        )
        .unwrap();
        assert_eq!(release.version(), "1.2.0");
        assert_eq!(release.asset_url("main.js"), Some("https://x/main.js"));
        assert_eq!(release.asset_url("styles.css"), None);
    }

    #[test]
    fn accepts_only_plain_github_repositories() {
        assert!(is_valid_repo("cucsijuan/flint-counter"));
        for repo in [
            "",
            "owner",
            "owner/",
            "../x",
            "owner/name/extra",
            "owner/na me",
        ] {
            assert!(!is_valid_repo(repo), "{repo}");
        }
    }
}
