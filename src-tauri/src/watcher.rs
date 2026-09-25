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
const DEBOUNCE: Duration = Duration::from_millis(200);

pub type VaultWatcher = Debouncer<notify::RecommendedWatcher, RecommendedCache>;

pub fn watch(app: AppHandle, vault: Vault, index: Arc<RwLock<Index>>) -> Result<VaultWatcher> {
    let root = vault.root().to_path_buf();
    let mut debouncer = new_debouncer(DEBOUNCE, None, move |result: DebounceEventResult| {
        let Ok(events) = result else { return };
        let paths: BTreeSet<String> = events
            .iter()
            .filter(|event| !event.kind.is_access())
            .flat_map(|event| &event.paths)
            .filter_map(|path| vault.relative(path))
            .filter(|path| !is_hidden(path))
            .collect();
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
