use keyring::{Entry, Error as KeyringError};

use crate::error::Result;

/// Each plugin's secrets live under their own service name in the OS keychain.
fn entry(plugin: &str, key: &str) -> Result<Entry> {
    Ok(Entry::new(&format!("flint-plugin-{plugin}"), key)?)
}

#[tauri::command(async)]
pub fn plugin_secret_get(plugin: String, key: String) -> Result<Option<String>> {
    match entry(&plugin, &key)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(error.into()),
    }
}

#[tauri::command(async)]
pub fn plugin_secret_set(plugin: String, key: String, value: String) -> Result<()> {
    Ok(entry(&plugin, &key)?.set_password(&value)?)
}

#[tauri::command(async)]
pub fn plugin_secret_delete(plugin: String, key: String) -> Result<()> {
    match entry(&plugin, &key)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(error.into()),
    }
}
