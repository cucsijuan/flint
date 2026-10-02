//! Plugin secrets: the OS keychain on desktop. On mobile they live in a file in the app's
//! private storage, which other apps can't read.

#[cfg(desktop)]
mod store {
    use keyring::{Entry, Error as KeyringError};

    use crate::error::Result;

    /// Each plugin's secrets live under their own service name in the OS keychain.
    fn entry(plugin: &str, key: &str) -> Result<Entry> {
        Ok(Entry::new(&format!("flint-plugin-{plugin}"), key)?)
    }

    pub fn get(_: &tauri::AppHandle, plugin: &str, key: &str) -> Result<Option<String>> {
        match entry(plugin, key)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(KeyringError::NoEntry) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    pub fn set(_: &tauri::AppHandle, plugin: &str, key: &str, value: &str) -> Result<()> {
        Ok(entry(plugin, key)?.set_password(value)?)
    }

    pub fn delete(_: &tauri::AppHandle, plugin: &str, key: &str) -> Result<()> {
        match entry(plugin, key)?.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(error.into()),
        }
    }
}

#[cfg(mobile)]
mod store {
    use std::collections::BTreeMap;
    use std::fs;
    use std::path::PathBuf;

    use tauri::{AppHandle, Manager};

    use crate::error::Result;

    type Secrets = BTreeMap<String, String>;

    fn file(app: &AppHandle) -> Result<PathBuf> {
        Ok(app.path().app_data_dir()?.join("secrets.json"))
    }

    fn read(app: &AppHandle) -> Result<Secrets> {
        let text = fs::read_to_string(file(app)?).unwrap_or_default();
        Ok(serde_json::from_str(&text).unwrap_or_default())
    }

    fn write(app: &AppHandle, secrets: &Secrets) -> Result<()> {
        let path = file(app)?;
        if let Some(folder) = path.parent() {
            fs::create_dir_all(folder)?;
        }
        Ok(fs::write(
            path,
            serde_json::to_string(secrets).unwrap_or_default(),
        )?)
    }

    fn name(plugin: &str, key: &str) -> String {
        format!("{plugin}/{key}")
    }

    pub fn get(app: &AppHandle, plugin: &str, key: &str) -> Result<Option<String>> {
        Ok(read(app)?.remove(&name(plugin, key)))
    }

    pub fn set(app: &AppHandle, plugin: &str, key: &str, value: &str) -> Result<()> {
        let mut secrets = read(app)?;
        secrets.insert(name(plugin, key), value.to_owned());
        write(app, &secrets)
    }

    pub fn delete(app: &AppHandle, plugin: &str, key: &str) -> Result<()> {
        let mut secrets = read(app)?;
        secrets.remove(&name(plugin, key));
        write(app, &secrets)
    }
}

use crate::error::Result;

#[tauri::command(async)]
pub fn plugin_secret_get(
    app: tauri::AppHandle,
    plugin: String,
    key: String,
) -> Result<Option<String>> {
    store::get(&app, &plugin, &key)
}

#[tauri::command(async)]
pub fn plugin_secret_set(
    app: tauri::AppHandle,
    plugin: String,
    key: String,
    value: String,
) -> Result<()> {
    store::set(&app, &plugin, &key, &value)
}

#[tauri::command(async)]
pub fn plugin_secret_delete(app: tauri::AppHandle, plugin: String, key: String) -> Result<()> {
    store::delete(&app, &plugin, &key)
}
