use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::vault::Vault;

const CONFIG_FOLDER: &str = ".flint";
const PLUGINS_FOLDER: &str = ".flint/plugins";
const ENABLED_FILE: &str = ".flint/plugins.json";
const DATA_FILE: &str = "data.json";
const PLUGIN_FILES: [&str; 2] = ["main.js", "styles.css"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub license: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PluginListing {
    pub folder: String,
    pub manifest: Option<PluginManifest>,
    pub error: Option<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct EnabledPlugins {
    enabled: Vec<String>,
}

pub fn list(vault: &Vault) -> Result<Vec<PluginListing>> {
    Ok(vault
        .subfolders(PLUGINS_FOLDER)?
        .into_iter()
        .map(|folder| {
            let manifest = vault
                .read(&format!("{PLUGINS_FOLDER}/{folder}/manifest.json"))
                .map_err(|error| error.to_string())
                .and_then(|text| {
                    serde_json::from_str::<PluginManifest>(&text).map_err(|error| error.to_string())
                });
            match manifest {
                Ok(manifest) => PluginListing {
                    folder,
                    manifest: Some(manifest),
                    error: None,
                },
                Err(error) => PluginListing {
                    folder,
                    manifest: None,
                    error: Some(format!("invalid manifest.json: {error}")),
                },
            }
        })
        .collect())
}

pub fn read_file(vault: &Vault, folder: &str, file: &str) -> Result<Option<String>> {
    if !PLUGIN_FILES.contains(&file) {
        return Err(Error::OutsideVault(file.to_owned()));
    }
    read_optional(vault, &plugin_path(folder, file)?)
}

pub fn read_data(vault: &Vault, folder: &str) -> Result<Option<String>> {
    read_optional(vault, &plugin_path(folder, DATA_FILE)?)
}

pub fn write_data(vault: &Vault, folder: &str, data: &str) -> Result<()> {
    vault.write(&plugin_path(folder, DATA_FILE)?, data)
}

pub fn enabled(vault: &Vault) -> Result<Vec<String>> {
    let text = read_optional(vault, ENABLED_FILE)?;
    Ok(text
        .and_then(|text| serde_json::from_str::<EnabledPlugins>(&text).ok())
        .unwrap_or_default()
        .enabled)
}

pub fn set_enabled(vault: &Vault, enabled: Vec<String>) -> Result<()> {
    vault.ensure_folder(CONFIG_FOLDER)?;
    let json = serde_json::to_string_pretty(&EnabledPlugins { enabled })
        .expect("a list of strings always serializes");
    vault.write(ENABLED_FILE, &json)
}

fn plugin_path(folder: &str, file: &str) -> Result<String> {
    if folder.is_empty() || folder.contains(['/', '\\']) || folder.starts_with('.') {
        return Err(Error::OutsideVault(folder.to_owned()));
    }
    Ok(format!("{PLUGINS_FOLDER}/{folder}/{file}"))
}

fn read_optional(vault: &Vault, path: &str) -> Result<Option<String>> {
    match vault.read(path) {
        Ok(text) => Ok(Some(text)),
        Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn vault_with_plugins() -> (TempDir, Vault) {
        let dir = TempDir::new().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        vault.ensure_folder(".flint/plugins/good").unwrap();
        vault.ensure_folder(".flint/plugins/broken").unwrap();
        vault
            .write(
                ".flint/plugins/good/manifest.json",
                r#"{"id":"good","name":"Good","version":"1.0.0","license":"MIT"}"#,
            )
            .unwrap();
        vault
            .write(".flint/plugins/good/main.js", "export default () => {}")
            .unwrap();
        vault
            .write(".flint/plugins/broken/manifest.json", "{")
            .unwrap();
        (dir, vault)
    }

    #[test]
    fn lists_plugins_and_reports_broken_manifests() {
        let (_dir, vault) = vault_with_plugins();
        let listings = list(&vault).unwrap();

        assert_eq!(listings[0].folder, "broken");
        assert!(listings[0].manifest.is_none());
        assert!(
            listings[0]
                .error
                .as_deref()
                .unwrap()
                .starts_with("invalid manifest.json")
        );
        assert_eq!(listings[1].manifest.as_ref().unwrap().license, "MIT");
    }

    #[test]
    fn reads_only_plugin_files_inside_the_plugin_folder() {
        let (_dir, vault) = vault_with_plugins();
        assert!(read_file(&vault, "good", "main.js").unwrap().is_some());
        assert_eq!(read_file(&vault, "good", "styles.css").unwrap(), None);
        assert!(read_file(&vault, "good", "manifest.json").is_err());
        assert!(read_file(&vault, "../good", "main.js").is_err());
        assert!(read_file(&vault, "a/b", "main.js").is_err());
    }

    #[test]
    fn stores_enabled_plugins_and_plugin_data() {
        let (_dir, vault) = vault_with_plugins();
        assert!(enabled(&vault).unwrap().is_empty());
        set_enabled(&vault, vec!["good".into()]).unwrap();
        assert_eq!(enabled(&vault).unwrap(), ["good"]);

        assert_eq!(read_data(&vault, "good").unwrap(), None);
        write_data(&vault, "good", r#"{"count":1}"#).unwrap();
        assert_eq!(
            read_data(&vault, "good").unwrap().as_deref(),
            Some(r#"{"count":1}"#)
        );
    }
}
