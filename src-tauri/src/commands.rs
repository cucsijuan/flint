use std::cmp::Reverse;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex, RwLock};
use std::time::SystemTime;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

use crate::community::{self, CommunityPlugin};
use crate::config;
use crate::error::{Error, Result};
use crate::index::{Backlink, BaseFile, Graph, Index, LinkTarget, Mention, OutgoingLink, TagCount};
use crate::markdown::Heading;
use crate::plugins::{self, PluginListing, PluginManifest};
use crate::search::{Query, SearchResult};
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
    let mut index = open.index.write().unwrap_or_else(|e| e.into_inner());
    index.update_links_for_rename(&open.vault, &from, &to, update_links)
}

#[tauri::command(async)]
pub fn copy_entry(state: State<AppState>, from: String, to: String) -> Result<()> {
    state.vault()?.copy_file(&from, &to)
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

/// Every note as Bases sees it, with its size and times from the file system.
#[tauri::command(async)]
pub fn base_files(state: State<AppState>) -> Result<Vec<BaseFile>> {
    let mut files = state.read_index(Index::base_files)?;
    let vault = state.vault()?;
    let millis = |time: std::io::Result<SystemTime>| {
        time.ok()
            .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map_or(0, |elapsed| elapsed.as_millis() as u64)
    };
    for file in &mut files {
        let metadata = vault
            .absolute(&file.path)
            .ok()
            .and_then(|path| fs::metadata(path).ok());
        if let Some(metadata) = metadata {
            file.size = metadata.len();
            file.mtime = millis(metadata.modified());
            file.ctime = millis(metadata.created().or_else(|_| metadata.modified()));
        }
    }
    Ok(files)
}

#[tauri::command(async)]
pub fn unlinked_mentions(state: State<AppState>, path: String) -> Result<Vec<Mention>> {
    state.read_index(|index| index.unlinked_mentions(&path))
}

#[tauri::command(async)]
pub fn outgoing_links(state: State<AppState>, path: String) -> Result<Vec<OutgoingLink>> {
    state.read_index(|index| index.outgoing_links(&path))
}

#[tauri::command(async)]
pub fn outgoing_mentions(state: State<AppState>, path: String) -> Result<Vec<Mention>> {
    state.read_index(|index| index.outgoing_mentions(&path))
}

#[tauri::command(async)]
pub fn incoming_link_count(state: State<AppState>, path: String) -> Result<usize> {
    state.read_index(|index| index.incoming_link_count(&path))
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SearchSort {
    NameAscending,
    NameDescending,
    ModifiedNewest,
    ModifiedOldest,
    CreatedNewest,
    CreatedOldest,
}

#[tauri::command(async)]
pub fn search(
    state: State<AppState>,
    query: String,
    sort: SearchSort,
) -> Result<Vec<SearchResult>> {
    let mut results = state.read_index(|index| index.search(&query))??;
    let vault = state.vault()?;
    let time = |path: &str, created: bool| {
        let metadata = vault
            .absolute(path)
            .ok()
            .and_then(|path| fs::metadata(path).ok());
        metadata
            .and_then(|metadata| {
                if created {
                    metadata.created().or_else(|_| metadata.modified()).ok()
                } else {
                    metadata.modified().ok()
                }
            })
            .unwrap_or(SystemTime::UNIX_EPOCH)
    };
    let name = |path: &str| path.rsplit('/').next().unwrap_or(path).to_lowercase();
    match sort {
        SearchSort::NameAscending => results.sort_by_cached_key(|result| name(&result.path)),
        SearchSort::NameDescending => {
            results.sort_by_cached_key(|result| Reverse(name(&result.path)));
        }
        SearchSort::ModifiedNewest => {
            results.sort_by_cached_key(|result| Reverse(time(&result.path, false)));
        }
        SearchSort::ModifiedOldest => {
            results.sort_by_cached_key(|result| time(&result.path, false))
        }
        SearchSort::CreatedNewest => {
            results.sort_by_cached_key(|result| Reverse(time(&result.path, true)));
        }
        SearchSort::CreatedOldest => results.sort_by_cached_key(|result| time(&result.path, true)),
    }
    Ok(results)
}

#[derive(Serialize)]
pub struct Replaced {
    text: String,
    count: usize,
}

/// `text` with the search's matches replaced, everywhere or only on `line`.
#[tauri::command(async)]
pub fn replace_text(
    query: String,
    replacement: String,
    text: String,
    line: Option<usize>,
) -> Result<Replaced> {
    let (text, count) = Query::parse(&query)?.replace(&text, &replacement, line);
    Ok(Replaced { text, count })
}

#[tauri::command(async)]
pub fn matching_notes(state: State<AppState>, queries: Vec<String>) -> Result<Vec<Vec<String>>> {
    state.read_index(|index| index.matching_notes(&queries))?
}

#[tauri::command(async)]
pub fn tags(state: State<AppState>) -> Result<Vec<TagCount>> {
    state.read_index(Index::tags)
}

#[tauri::command(async)]
pub fn graph(state: State<AppState>) -> Result<Graph> {
    state.read_index(Index::graph)
}

#[tauri::command]
pub async fn community_plugins() -> Result<Vec<CommunityPlugin>> {
    community::list().await
}

#[tauri::command]
pub async fn latest_plugin_versions(repos: Vec<String>) -> Result<Vec<Option<String>>> {
    community::latest_versions(repos).await
}

#[tauri::command]
pub async fn install_plugin(
    state: State<'_, AppState>,
    plugin: CommunityPlugin,
) -> Result<PluginManifest> {
    let vault = state.vault()?;
    community::install(&vault, &plugin).await
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

#[derive(Serialize)]
pub struct FontFamily {
    name: String,
    monospaced: bool,
}

/// The font families installed on this computer, sorted by name.
#[tauri::command(async)]
pub fn system_fonts() -> Vec<FontFamily> {
    let mut database = fontdb::Database::new();
    database.load_system_fonts();
    let mut families: BTreeMap<String, bool> = BTreeMap::new();
    for face in database.faces() {
        if let Some((name, _)) = face.families.first() {
            *families.entry(name.clone()).or_default() |= face.monospaced;
        }
    }
    families
        .into_iter()
        .map(|(name, monospaced)| FontFamily { name, monospaced })
        .collect()
}

#[tauri::command(async)]
pub fn snippets(state: State<AppState>) -> Result<Vec<String>> {
    config::snippets(&state.vault()?)
}

#[tauri::command(async)]
pub fn read_snippet(state: State<AppState>, name: String) -> Result<String> {
    config::read_snippet(&state.vault()?, &name)
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
pub fn show_in_file_manager(app: AppHandle, state: State<AppState>, path: String) -> Result<()> {
    let absolute = state.vault()?.absolute(&path)?;
    Ok(app.opener().reveal_item_in_dir(absolute)?)
}

#[tauri::command(async)]
pub fn open_externally(app: AppHandle, state: State<AppState>, path: String) -> Result<()> {
    let absolute = state.vault()?.absolute(&path)?;
    Ok(app
        .opener()
        .open_path(absolute.to_string_lossy(), None::<&str>)?)
}
