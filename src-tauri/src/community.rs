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
#[serde(rename_all = "camelCase")]
pub struct CommunityPlugin {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub description: String,
    /// `owner/name` on GitHub.
    pub repo: String,
    /// For repositories holding several plugins: this plugin's release tags start with it,
    /// like `jira-` in `jira-1.0.0`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tag_prefix: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Release {
    tag_name: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
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

    fn version(&self, prefix: &str) -> &str {
        let tag = self.tag_name.strip_prefix(prefix).unwrap_or(&self.tag_name);
        tag.trim_start_matches('v')
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

async fn get_json<T: serde::de::DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
) -> Result<T> {
    Ok(client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?)
}

/// The plugin's newest published release: the repository's latest, or, when it holds several
/// plugins, the newest one tagged with the plugin's prefix.
async fn latest_release(client: &reqwest::Client, plugin: &CommunityPlugin) -> Result<Release> {
    let repo = &plugin.repo;
    if !is_valid_repo(repo) {
        return Err(Error::Plugin(format!("invalid repository: {repo}")));
    }
    let Some(prefix) = &plugin.tag_prefix else {
        return get_json(
            client,
            &format!("https://api.github.com/repos/{repo}/releases/latest"),
        )
        .await;
    };
    let releases: Vec<Release> = get_json(
        client,
        &format!("https://api.github.com/repos/{repo}/releases?per_page=100"),
    )
    .await?;
    releases
        .into_iter()
        .find(|release| {
            !release.draft && !release.prerelease && release.tag_name.starts_with(prefix.as_str())
        })
        .ok_or_else(|| Error::Plugin(format!("{repo} has no release tagged {prefix}…")))
}

pub async fn list() -> Result<Vec<CommunityPlugin>> {
    let response = net::client()?.get(REGISTRY_URL).send().await?;
    Ok(response.error_for_status()?.json().await?)
}

/// The version of each plugin's latest release, `None` where it couldn't be read.
pub async fn latest_versions(plugins: Vec<CommunityPlugin>) -> Result<Vec<Option<String>>> {
    let client = net::client()?;
    let mut versions = Vec::with_capacity(plugins.len());
    for plugin in plugins {
        let prefix = plugin.tag_prefix.as_deref().unwrap_or_default();
        let release = latest_release(&client, &plugin).await.ok();
        versions.push(release.map(|release| release.version(prefix).to_owned()));
    }
    Ok(versions)
}

/// Downloads the plugin's latest release into `.flint/plugins/<id>`, replacing any older version.
pub async fn install(vault: &Vault, plugin: &CommunityPlugin) -> Result<PluginManifest> {
    let client = net::client()?;
    let release = latest_release(&client, plugin).await?;
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
        assert_eq!(release.version(""), "1.2.0");
        assert_eq!(release.asset_url("main.js"), Some("https://x/main.js"));
        let tagged: Release = serde_json::from_str(
            r#"{"tag_name": "jira-0.3.1", "prerelease": false, "assets": []}"#,
        )
        .unwrap();
        assert_eq!(tagged.version("jira-"), "0.3.1");
        let entry: CommunityPlugin = serde_json::from_str(
            r#"{"id": "jira", "name": "Jira", "repo": "a/b", "tagPrefix": "jira-"}"#,
        )
        .unwrap();
        assert_eq!(entry.tag_prefix.as_deref(), Some("jira-"));
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
