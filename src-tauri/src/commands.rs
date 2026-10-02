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
use crate::history::{DeletedNote, History, HistorySettings, SnapshotInfo};
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
    info: VaultInfo,
    vault: Vault,
    index: Arc<RwLock<Index>>,
    history: Arc<History>,
    _watcher: Arc<VaultWatcher>,
}

impl AppState {
    fn open(&self) -> Result<OpenVault> {
        let guard = self.0.lock().unwrap_or_else(|e| e.into_inner());
        guard.clone().ok_or(Error::NoVault)
    }

    pub fn vault(&self) -> Result<Vault> {
        Ok(self.open()?.vault)
    }

    fn read_index<T>(&self, read: impl FnOnce(&Index) -> T) -> Result<T> {
        let index = self.open()?.index;
        let index = index.read().unwrap_or_else(|e| e.into_inner());
        Ok(read(&index))
    }
}

#[derive(Clone, Serialize)]
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
    let history = Arc::new(History::new(&app.path().app_data_dir()?, root));
    let _ = history.prune();
    let watcher = watch(app, vault.clone(), index.clone())?;
    *state.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(OpenVault {
        info: info.clone(),
        vault,
        index,
        history,
        _watcher: Arc::new(watcher),
    });
    Ok(info)
}

/// The vault the app has open, for windows that join it rather than open it again.
#[tauri::command]
pub fn current_vault(state: State<AppState>) -> Option<VaultInfo> {
    state.open().ok().map(|open| open.info)
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
    let open = state.open()?;
    let previous = open.vault.read(&path).ok();
    if let Err(error) = open.history.record(&path, previous.as_deref(), &contents) {
        log::warn!("couldn't keep a snapshot of {path}: {error}");
    }
    open.vault.write(&path, &contents)
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
    let updated = index.update_links_for_rename(&open.vault, &from, &to, update_links)?;
    if let Err(error) = open.history.rename(&from, &to) {
        log::warn!("couldn't move the history of {from}: {error}");
    }
    Ok(updated)
}

/// Points every link to `from` at `to`, for merging one note into another.
#[tauri::command(async)]
pub fn redirect_links(state: State<AppState>, from: String, to: String) -> Result<usize> {
    let open = state.open()?;
    let mut index = open.index.write().unwrap_or_else(|e| e.into_inner());
    index.redirect_links(&open.vault, &from, &to)
}

#[tauri::command(async)]
pub fn copy_entry(state: State<AppState>, from: String, to: String) -> Result<()> {
    state.vault()?.copy_file(&from, &to)
}

#[tauri::command(async)]
pub fn trash_entry(state: State<AppState>, path: String) -> Result<()> {
    let open = state.open()?;
    let notes = open
        .index
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .note_paths_within(&path);
    for note in notes {
        if let Ok(text) = open.vault.read(&note) {
            let _ = open.history.record_last(&note, &text);
        }
    }
    open.vault.trash(&path)
}

#[tauri::command(async)]
pub fn note_history(state: State<AppState>, path: String) -> Result<Vec<SnapshotInfo>> {
    Ok(state.open()?.history.snapshots(&path))
}

#[tauri::command(async)]
pub fn history_snapshot(state: State<AppState>, path: String, time: u64) -> Result<Option<String>> {
    Ok(state.open()?.history.text(&path, time))
}

#[tauri::command(async)]
pub fn deleted_notes(state: State<AppState>) -> Result<Vec<DeletedNote>> {
    let open = state.open()?;
    Ok(open.history.deleted(&open.vault))
}

#[tauri::command(async)]
pub fn set_history_settings(
    state: State<AppState>,
    interval_minutes: u64,
    retention_days: u64,
) -> Result<()> {
    let open = state.open()?;
    open.history
        .set_settings(HistorySettings::new(interval_minutes, retention_days));
    open.history.prune()
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

/// `text` with the search's matches replaced: everywhere, on `line`, or its `occurrence`th match.
#[tauri::command(async)]
pub fn replace_text(
    query: String,
    replacement: String,
    text: String,
    line: Option<usize>,
    occurrence: Option<usize>,
) -> Result<Replaced> {
    let (text, count) = Query::parse(&query)?.replace(&text, &replacement, line, occurrence);
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
pub async fn latest_plugin_versions(plugins: Vec<CommunityPlugin>) -> Result<Vec<Option<String>>> {
    community::latest_versions(plugins).await
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

#[cfg(desktop)]
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

#[cfg(desktop)]
#[tauri::command(async)]
pub fn clipboard_text() -> String {
    arboard::Clipboard::new()
        .and_then(|mut clipboard| clipboard.get_text())
        .unwrap_or_default()
}

#[cfg(desktop)]
#[tauri::command(async)]
pub fn set_clipboard_text(text: String) -> Result<()> {
    arboard::Clipboard::new()
        .and_then(|mut clipboard| clipboard.set_text(text))
        .map_err(|error| Error::Plugin(error.to_string()))
}

#[cfg(desktop)]
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

/// Mobile clipboards hold text only, and the page reaches them itself.
#[cfg(mobile)]
mod mobile_clipboard {
    use tauri::State;

    use super::AppState;
    use crate::error::{Error, Result};

    #[tauri::command]
    pub fn save_clipboard_image(_state: State<AppState>, _path: String) -> Result<bool> {
        Ok(false)
    }

    #[tauri::command]
    pub fn clipboard_text() -> String {
        String::new()
    }

    #[tauri::command]
    pub fn set_clipboard_text(_text: String) -> Result<()> {
        Err(Error::Plugin("unsupported".to_owned()))
    }

    #[tauri::command]
    pub fn clipboard_files() -> Vec<String> {
        Vec::new()
    }
}

#[cfg(mobile)]
pub use mobile_clipboard::*;

/// Vault folders inside the app's own folder, which iOS shows in the Files app under Flint.
#[tauri::command]
pub fn app_folder_vaults(app: AppHandle) -> Result<AppFolderVaults> {
    let root = app.path().document_dir()?;
    std::fs::create_dir_all(&root)?;
    let mut vaults: Vec<String> = std::fs::read_dir(&root)?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .filter_map(|entry| entry.file_name().to_str().map(str::to_owned))
        .filter(|name| !name.starts_with('.'))
        .collect();
    vaults.sort();
    Ok(AppFolderVaults {
        root: root.to_string_lossy().into_owned(),
        vaults,
    })
}

#[derive(Serialize)]
pub struct AppFolderVaults {
    root: String,
    vaults: Vec<String>,
}

/// Creates a vault folder named `name` in the app's own folder and returns its path.
#[tauri::command]
pub fn create_app_folder_vault(app: AppHandle, name: String) -> Result<String> {
    let name = name.trim();
    if name.is_empty() || name.starts_with('.') || name.contains(['/', '\\']) {
        return Err(Error::Plugin(format!("invalid vault name: {name}")));
    }
    let path = app.path().document_dir()?.join(name);
    std::fs::create_dir_all(&path)?;
    Ok(path.to_string_lossy().into_owned())
}
