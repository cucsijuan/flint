use std::collections::BTreeSet;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_full::{DebounceEventResult, Debouncer, RecommendedCache, new_debouncer};
use tauri::{AppHandle, Emitter};

use crate::error::Result;
use crate::index::Index;
use crate::vault::{Vault, is_hidden};

pub const VAULT_CHANGED: &str = "vault-changed";
pub const PLUGINS_CHANGED: &str = "plugins-changed";
const PLUGINS_FOLDER: &str = ".flint/plugins/";
const PLUGIN_CODE: [&str; 3] = ["main.js", "styles.css", "manifest.json"];
const DEBOUNCE: Duration = Duration::from_millis(200);

pub type VaultWatcher = Debouncer<notify::RecommendedWatcher, RecommendedCache>;

pub fn watch(app: AppHandle, vault: Vault, index: Arc<RwLock<Index>>) -> Result<VaultWatcher> {
    let root = vault.root().to_path_buf();
    let mut debouncer = new_debouncer(DEBOUNCE, None, move |result: DebounceEventResult| {
        let Ok(events) = result else { return };
        let changed: Vec<String> = events
            .iter()
            .filter(|event| !event.kind.is_access())
            .flat_map(|event| &event.paths)
            .filter_map(|path| vault.relative(path))
            .collect();
        let plugins: BTreeSet<&str> = changed.iter().filter_map(|path| plugin_of(path)).collect();
        if !plugins.is_empty() {
            let _ = app.emit(PLUGINS_CHANGED, &plugins);
        }
        let paths: BTreeSet<&String> = changed.iter().filter(|path| !is_hidden(path)).collect();
        if paths.is_empty() {
            return;
        }
        {
            let mut index = index.write().unwrap_or_else(|e| e.into_inner());
            for path in &paths {
                if let Err(error) = index.refresh(&vault, path) {
                    log::warn!("failed to index {path}: {error}");
                }
            }
        }
        let _ = app.emit(VAULT_CHANGED, paths);
    })?;
    debouncer.watch(&root, RecursiveMode::Recursive)?;
    Ok(debouncer)
}

/// The plugin folder whose code `path` is; its own `data.json` doesn't count, or saving would reload it.
fn plugin_of(path: &str) -> Option<&str> {
    let (folder, file) = path.strip_prefix(PLUGINS_FOLDER)?.split_once('/')?;
    PLUGIN_CODE.contains(&file).then_some(folder)
}

#[cfg(test)]
mod tests {
    use super::plugin_of;

    #[test]
    fn finds_plugins_whose_code_changed() {
        assert_eq!(plugin_of(".flint/plugins/counter/main.js"), Some("counter"));
        assert_eq!(
            plugin_of(".flint/plugins/counter/styles.css"),
            Some("counter")
        );
        assert_eq!(plugin_of(".flint/plugins/counter/data.json"), None);
        assert_eq!(plugin_of(".flint/plugins.json"), None);
        assert_eq!(plugin_of("Notes/main.js"), None);
    }
}
