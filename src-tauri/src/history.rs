//! File recovery: timed snapshots of each note, kept outside the vault like Obsidian's.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::vault::{Vault, is_within};

const MINUTE_MS: u64 = 60_000;
const DAY_MS: u64 = 24 * 60 * MINUTE_MS;

#[derive(Debug, Clone, Copy)]
pub struct HistorySettings {
    /// The shortest time between two snapshots of a note.
    pub interval_ms: u64,
    /// How long snapshots are kept.
    pub retention_ms: u64,
}

impl Default for HistorySettings {
    fn default() -> Self {
        Self {
            interval_ms: 5 * MINUTE_MS,
            retention_ms: 7 * DAY_MS,
        }
    }
}

impl HistorySettings {
    pub fn new(interval_minutes: u64, retention_days: u64) -> Self {
        Self {
            interval_ms: interval_minutes.max(1) * MINUTE_MS,
            retention_ms: retention_days.max(1) * DAY_MS,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Snapshot {
    /// Milliseconds since the epoch.
    time: u64,
    text: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct NoteHistory {
    path: String,
    snapshots: Vec<Snapshot>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SnapshotInfo {
    pub time: u64,
    pub size: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DeletedNote {
    pub path: String,
    /// When its newest snapshot was taken.
    pub time: u64,
}

/// A stable name for a path or vault, so snapshots survive app restarts (FNV-1a).
fn key(text: &str) -> String {
    let hash = text.bytes().fold(0xcbf2_9ce4_8422_2325_u64, |hash, byte| {
        (hash ^ u64::from(byte)).wrapping_mul(0x0100_0000_01b3)
    });
    format!("{hash:016x}")
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as u64)
}

/// The snapshots of one vault's notes, one JSON file per note.
pub struct History {
    folder: PathBuf,
    settings: Mutex<HistorySettings>,
    /// The newest snapshot's time and text key per note, so saves rarely read history files.
    newest: Mutex<HashMap<String, Option<(u64, String)>>>,
}

impl History {
    pub fn new(data_folder: &Path, vault_root: &Path) -> Self {
        Self {
            folder: data_folder
                .join("history")
                .join(key(&vault_root.to_string_lossy())),
            settings: Mutex::new(HistorySettings::default()),
            newest: Mutex::new(HashMap::new()),
        }
    }

    pub fn set_settings(&self, settings: HistorySettings) {
        *self.settings.lock().unwrap_or_else(|e| e.into_inner()) = settings;
    }

    fn settings(&self) -> HistorySettings {
        *self.settings.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn file(&self, path: &str) -> PathBuf {
        self.folder.join(format!("{}.json", key(path)))
    }

    fn load(&self, path: &str) -> NoteHistory {
        fs::read_to_string(self.file(path))
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_else(|| NoteHistory {
                path: path.to_owned(),
                snapshots: Vec::new(),
            })
    }

    fn save(&self, history: &NoteHistory) -> Result<()> {
        let file = self.file(&history.path);
        if history.snapshots.is_empty() {
            let _ = fs::remove_file(file);
            return Ok(());
        }
        fs::create_dir_all(&self.folder)?;
        fs::write(file, serde_json::to_string(history).unwrap_or_default())?;
        Ok(())
    }

    fn newest(&self, path: &str) -> Option<(u64, String)> {
        let mut cache = self.newest.lock().unwrap_or_else(|e| e.into_inner());
        cache
            .entry(path.to_owned())
            .or_insert_with(|| {
                let history = self.load(path);
                history
                    .snapshots
                    .last()
                    .map(|snapshot| (snapshot.time, key(&snapshot.text)))
            })
            .clone()
    }

    fn remember(&self, history: &NoteHistory) {
        let newest = history
            .snapshots
            .last()
            .map(|snapshot| (snapshot.time, key(&snapshot.text)));
        self.newest
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(history.path.clone(), newest);
    }

    fn keep_recent(&self, history: &mut NoteHistory, now: u64) {
        let oldest = now.saturating_sub(self.settings().retention_ms);
        history.snapshots.retain(|snapshot| snapshot.time >= oldest);
    }

    /// Called before a note is saved: takes a snapshot when enough time passed since the last one,
    /// and keeps what the note held before its first edit.
    pub fn record(&self, path: &str, previous: Option<&str>, current: &str) -> Result<()> {
        let now = now();
        let newest = self.newest(path);
        let is_due = newest
            .as_ref()
            .is_none_or(|(time, _)| now.saturating_sub(*time) >= self.settings().interval_ms);
        let has_changed = newest
            .as_ref()
            .is_none_or(|(_, text)| *text != key(current));
        if !is_due || !has_changed {
            return Ok(());
        }
        let mut history = self.load(path);
        if history.snapshots.is_empty()
            && let Some(previous) = previous.filter(|previous| *previous != current)
        {
            history.snapshots.push(Snapshot {
                time: now.saturating_sub(1),
                text: previous.to_owned(),
            });
        }
        history.snapshots.push(Snapshot {
            time: now,
            text: current.to_owned(),
        });
        self.keep_recent(&mut history, now);
        self.save(&history)?;
        self.remember(&history);
        Ok(())
    }

    /// Keeps a note's last text before it's deleted, so it can be recovered.
    pub fn record_last(&self, path: &str, text: &str) -> Result<()> {
        let mut history = self.load(path);
        if history
            .snapshots
            .last()
            .is_some_and(|snapshot| snapshot.text == text)
        {
            return Ok(());
        }
        history.snapshots.push(Snapshot {
            time: now(),
            text: text.to_owned(),
        });
        self.save(&history)?;
        self.remember(&history);
        Ok(())
    }

    pub fn snapshots(&self, path: &str) -> Vec<SnapshotInfo> {
        self.load(path)
            .snapshots
            .iter()
            .rev()
            .map(|snapshot| SnapshotInfo {
                time: snapshot.time,
                size: snapshot.text.len(),
            })
            .collect()
    }

    pub fn text(&self, path: &str, time: u64) -> Option<String> {
        self.load(path)
            .snapshots
            .into_iter()
            .find(|snapshot| snapshot.time == time)
            .map(|snapshot| snapshot.text)
    }

    fn all(&self) -> Vec<NoteHistory> {
        let Ok(entries) = fs::read_dir(&self.folder) else {
            return Vec::new();
        };
        entries
            .filter_map(|entry| fs::read_to_string(entry.ok()?.path()).ok())
            .filter_map(|text| serde_json::from_str(&text).ok())
            .collect()
    }

    /// Moves the history of a renamed note, or of every note in a renamed folder.
    pub fn rename(&self, from: &str, to: &str) -> Result<()> {
        for mut history in self.all() {
            if !is_within(&history.path, from) {
                continue;
            }
            let _ = fs::remove_file(self.file(&history.path));
            self.newest
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .remove(&history.path);
            history.path = format!("{to}{}", &history.path[from.len()..]);
            let mut existing = self.load(&history.path);
            existing.snapshots.append(&mut history.snapshots);
            existing.snapshots.sort_by_key(|snapshot| snapshot.time);
            self.save(&existing)?;
            self.remember(&existing);
        }
        Ok(())
    }

    /// Notes with snapshots that are no longer in the vault, newest first.
    pub fn deleted(&self, vault: &Vault) -> Vec<DeletedNote> {
        let mut deleted: Vec<DeletedNote> = self
            .all()
            .into_iter()
            .filter(|history| vault.read(&history.path).is_err())
            .filter_map(|history| {
                let time = history.snapshots.last()?.time;
                Some(DeletedNote {
                    path: history.path,
                    time,
                })
            })
            .collect();
        deleted.sort_by_key(|note| std::cmp::Reverse(note.time));
        deleted
    }

    /// Drops snapshots older than the retention period.
    pub fn prune(&self) -> Result<()> {
        let now = now();
        for mut history in self.all() {
            let count = history.snapshots.len();
            self.keep_recent(&mut history, now);
            if history.snapshots.len() != count {
                self.save(&history)?;
                self.remember(&history);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn history() -> (tempfile::TempDir, History) {
        let folder = tempfile::tempdir().unwrap();
        let history = History::new(folder.path(), Path::new("/vault"));
        (folder, history)
    }

    #[test]
    fn keeps_the_text_before_the_first_edit_and_spaces_snapshots_out() {
        let (_folder, history) = history();
        history.record("a.md", Some("original"), "edit 1").unwrap();
        history.record("a.md", Some("edit 1"), "edit 2").unwrap();
        let snapshots = history.snapshots("a.md");
        assert_eq!(
            snapshots.len(),
            2,
            "the second save came within the interval"
        );
        assert_eq!(
            history.text("a.md", snapshots[1].time).as_deref(),
            Some("original")
        );
        assert_eq!(
            history.text("a.md", snapshots[0].time).as_deref(),
            Some("edit 1")
        );

        history.set_settings(HistorySettings {
            interval_ms: 0,
            retention_ms: DAY_MS,
        });
        history.record("a.md", Some("edit 1"), "edit 2").unwrap();
        history.record("a.md", Some("edit 2"), "edit 2").unwrap();
        assert_eq!(
            history.snapshots("a.md").len(),
            3,
            "unchanged text adds nothing"
        );
    }

    #[test]
    fn follows_renames_and_finds_deleted_notes() {
        let (_folder, history) = history();
        let vault_folder = tempfile::tempdir().unwrap();
        let vault = Vault::open(vault_folder.path()).unwrap();
        vault.write("Kept.md", "kept").unwrap();
        history.record("Old/Kept.md", None, "kept").unwrap();
        history.record_last("Gone.md", "last words").unwrap();
        history.rename("Old/Kept.md", "Kept.md").unwrap();
        assert_eq!(history.snapshots("Kept.md").len(), 1);
        assert!(history.snapshots("Old/Kept.md").is_empty());
        let deleted = history.deleted(&vault);
        assert_eq!(deleted.len(), 1);
        assert_eq!(deleted[0].path, "Gone.md");
    }
}
