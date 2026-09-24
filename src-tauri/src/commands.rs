use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::error::{Error, Result};
use crate::vault::{Entry, Vault};
use crate::watcher::{VaultWatcher, watch};

#[derive(Default)]
pub struct AppState(Mutex<Option<OpenVault>>);

struct OpenVault {
    vault: Vault,
    _watcher: VaultWatcher,
}

impl AppState {
    fn vault(&self) -> Result<Vault> {
        let guard = self.0.lock().unwrap_or_else(|e| e.into_inner());
        guard
            .as_ref()
            .map(|open| open.vault.clone())
            .ok_or(Error::NoVault)
    }
}

#[derive(Serialize)]
pub struct VaultInfo {
    root: String,
    name: String,
}

#[tauri::command(async)]
pub fn open_vault(app: AppHandle, state: State<AppState>, path: String) -> Result<VaultInfo> {
    let vault = Vault::open(path)?;
    let root = vault.root();
    let info = VaultInfo {
        root: root.to_string_lossy().into_owned(),
        name: root
            .file_name()
            .map_or_else(String::new, |name| name.to_string_lossy().into_owned()),
    };
    let watcher = watch(app, vault.clone())?;
    *state.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(OpenVault {
        vault,
        _watcher: watcher,
    });
    Ok(info)
}

#[tauri::command(async)]
pub fn list_entries(state: State<AppState>) -> Result<Vec<Entry>> {
    state.vault()?.entries()
}

#[tauri::command(async)]
pub fn read_note(state: State<AppState>, path: String) -> Result<String> {
    state.vault()?.read(&path)
}

#[tauri::command(async)]
pub fn write_note(state: State<AppState>, path: String, contents: String) -> Result<()> {
    state.vault()?.write(&path, &contents)
}

#[tauri::command(async)]
pub fn create_note(state: State<AppState>, path: String) -> Result<()> {
    state.vault()?.create_note(&path)
}

#[tauri::command(async)]
pub fn create_folder(state: State<AppState>, path: String) -> Result<()> {
    state.vault()?.create_folder(&path)
}

#[tauri::command(async)]
pub fn rename_entry(state: State<AppState>, from: String, to: String) -> Result<()> {
    state.vault()?.rename(&from, &to)
}

#[tauri::command(async)]
pub fn trash_entry(state: State<AppState>, path: String) -> Result<()> {
    state.vault()?.trash(&path)
}
