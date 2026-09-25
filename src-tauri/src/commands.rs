use std::path::Path;
use std::sync::{Arc, Mutex, RwLock};

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

use crate::config;
use crate::error::{Error, Result};
use crate::index::{Backlink, Graph, Index, LinkTarget, TagCount};
use crate::markdown::Heading;
use crate::plugins::{self, PluginListing};
use crate::search::SearchResult;
use crate::vault::{Entry, Vault, is_attachment_name};
use crate::watcher::{VaultWatcher, watch};

#[derive(Default)]
pub struct AppState(Mutex<Option<OpenVault>>);

#[derive(Clone)]
struct OpenVault {
    vault: Vault,
    index: Arc<RwLock<Index>>,
    _watcher: Arc<VaultWatcher>,
}

impl AppState {
    fn open(&self) -> Result<OpenVault> {
        let guard = self.0.lock().unwrap_or_else(|e| e.into_inner());
        guard.clone().ok_or(Error::NoVault)
    }

    fn vault(&self) -> Result<Vault> {
        Ok(self.open()?.vault)
    }

    fn read_index<T>(&self, read: impl FnOnce(&Index) -> T) -> Result<T> {
        let index = self.open()?.index;
        let index = index.read().unwrap_or_else(|e| e.into_inner());
        Ok(read(&index))
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
    app.asset_protocol_scope().allow_directory(root, true)?;
    let index = Arc::new(RwLock::new(Index::build(&vault)?));
    let watcher = watch(app, vault.clone(), index.clone())?;
    *state.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(OpenVault {
        vault,
        index,
        _watcher: Arc::new(watcher),
    });
    Ok(info)
}

#[tauri::command]
pub fn launch_vault() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|arg| !arg.starts_with('-'))
        .and_then(|arg| std::fs::canonicalize(arg).ok())
        .filter(|path| path.is_dir())
        .map(|path| path.to_string_lossy().into_owned())
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
pub fn rename_entry(
    state: State<AppState>,
    from: String,
    to: String,
    update_links: bool,
) -> Result<usize> {
    let open = state.open()?;
    if !update_links {
        open.vault.rename(&from, &to)?;
        return Ok(0);
    }
    let mut index = open.index.write().unwrap_or_else(|e| e.into_inner());
    index.update_links_for_rename(&open.vault, &from, &to)
}

#[tauri::command(async)]
pub fn trash_entry(state: State<AppState>, path: String) -> Result<()> {
    state.vault()?.trash(&path)
}

#[tauri::command(async)]
pub fn link_targets(state: State<AppState>) -> Result<Vec<LinkTarget>> {
    state.read_index(Index::link_targets)
}

#[tauri::command(async)]
pub fn resolve_links(
    state: State<AppState>,
    source: String,
    targets: Vec<String>,
) -> Result<Vec<Option<String>>> {
    state.read_index(|index| {
        targets
            .iter()
            .map(|target| index.resolve(&source, target))
            .collect()
    })
}

#[tauri::command(async)]
pub fn note_headings(state: State<AppState>, path: String) -> Result<Vec<Heading>> {
    state.read_index(|index| index.headings(&path))
}

#[tauri::command(async)]
pub fn backlinks(state: State<AppState>, path: String) -> Result<Vec<Backlink>> {
    state.read_index(|index| index.backlinks(&path))
}

#[tauri::command(async)]
pub fn incoming_link_count(state: State<AppState>, path: String) -> Result<usize> {
    state.read_index(|index| index.incoming_link_count(&path))
}

#[tauri::command(async)]
pub fn search(state: State<AppState>, query: String) -> Result<Vec<SearchResult>> {
    state.read_index(|index| index.search(&query))?
}

#[tauri::command(async)]
pub fn tags(state: State<AppState>) -> Result<Vec<TagCount>> {
    state.read_index(Index::tags)
}

#[tauri::command(async)]
pub fn graph(state: State<AppState>) -> Result<Graph> {
    state.read_index(Index::graph)
}

#[tauri::command(async)]
pub fn list_plugins(state: State<AppState>) -> Result<Vec<PluginListing>> {
    plugins::list(&state.vault()?)
}

#[tauri::command(async)]
pub fn read_plugin_file(
    state: State<AppState>,
    folder: String,
    file: String,
) -> Result<Option<String>> {
    plugins::read_file(&state.vault()?, &folder, &file)
}

#[tauri::command(async)]
pub fn read_plugin_data(state: State<AppState>, folder: String) -> Result<Option<String>> {
    plugins::read_data(&state.vault()?, &folder)
}

#[tauri::command(async)]
pub fn write_plugin_data(state: State<AppState>, folder: String, data: String) -> Result<()> {
    plugins::write_data(&state.vault()?, &folder, &data)
}

#[tauri::command(async)]
pub fn enabled_plugins(state: State<AppState>) -> Result<Vec<String>> {
    plugins::enabled(&state.vault()?)
}

#[tauri::command(async)]
pub fn set_enabled_plugins(state: State<AppState>, enabled: Vec<String>) -> Result<()> {
    plugins::set_enabled(&state.vault()?, enabled)
}

#[tauri::command(async)]
pub fn read_config(state: State<AppState>, name: String) -> Result<Option<String>> {
    config::read(&state.vault()?, &name)
}

#[tauri::command(async)]
pub fn write_config(state: State<AppState>, name: String, contents: String) -> Result<()> {
    config::write(&state.vault()?, &name, &contents)
}

#[tauri::command(async)]
pub fn save_attachment(state: State<AppState>, path: String, data: String) -> Result<()> {
    let bytes = BASE64.decode(data).map_err(|_| Error::InvalidAttachment)?;
    state.vault()?.create_file(&path, &bytes)
}

#[tauri::command(async)]
pub fn import_attachment(state: State<AppState>, source: String, path: String) -> Result<()> {
    if !is_attachment_name(&source) {
        return Err(Error::InvalidAttachment);
    }
    state.vault()?.import_file(Path::new(&source), &path)
}

#[tauri::command(async)]
pub fn save_clipboard_image(state: State<AppState>, path: String) -> Result<bool> {
    let Ok(image) = arboard::Clipboard::new().and_then(|mut clipboard| clipboard.get_image())
    else {
        return Ok(false);
    };
    let mut bytes = Vec::new();
    let width = u32::try_from(image.width).map_err(|_| Error::InvalidAttachment)?;
    let height = u32::try_from(image.height).map_err(|_| Error::InvalidAttachment)?;
    let mut encoder = png::Encoder::new(&mut bytes, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder
        .write_header()
        .and_then(|mut writer| writer.write_image_data(&image.bytes))
        .map_err(|_| Error::InvalidAttachment)?;
    state.vault()?.create_file(&path, &bytes)?;
    Ok(true)
}

#[tauri::command(async)]
pub fn clipboard_files() -> Vec<String> {
    arboard::Clipboard::new()
        .and_then(|mut clipboard| clipboard.get().file_list())
        .unwrap_or_default()
        .into_iter()
        // arboard keeps the \r of each text/uri-list line
        .filter_map(|path| path.to_str().map(|path| path.trim_end().to_owned()))
        .collect()
}

#[tauri::command(async)]
pub fn open_externally(app: AppHandle, state: State<AppState>, path: String) -> Result<()> {
    let absolute = state.vault()?.absolute(&path)?;
    Ok(app
        .opener()
        .open_path(absolute.to_string_lossy(), None::<&str>)?)
}
