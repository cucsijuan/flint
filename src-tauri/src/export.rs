//! Writing exported notes outside the vault: a single HTML file or a whole static site.

use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Deserialize;
use tauri::State;

use crate::commands::AppState;
use crate::error::{Error, Result};

#[derive(Debug, Deserialize)]
pub struct ExportFile {
    /// Where it goes, relative to the export folder.
    path: String,
    contents: String,
}

#[derive(Debug, Deserialize)]
pub struct ExportAttachment {
    /// The attachment in the vault.
    source: String,
    /// Where it goes, relative to the export folder.
    path: String,
}

/// `relative` inside `folder`, refusing anything that would escape it.
fn inside(folder: &Path, relative: &str) -> Result<PathBuf> {
    let path = Path::new(relative);
    let is_safe = !relative.is_empty()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)));
    if !is_safe {
        return Err(Error::Export(format!("invalid export path: {relative}")));
    }
    Ok(folder.join(path))
}

fn write(path: &Path, contents: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, contents)?;
    Ok(())
}

/// Writes exported pages into `folder` (chosen by the user) and copies the attachments they use.
#[tauri::command(async)]
pub fn export_files(
    state: State<AppState>,
    folder: String,
    files: Vec<ExportFile>,
    attachments: Vec<ExportAttachment>,
) -> Result<()> {
    let folder = PathBuf::from(folder);
    for file in &files {
        write(&inside(&folder, &file.path)?, file.contents.as_bytes())?;
    }
    let vault = state.vault()?;
    for attachment in &attachments {
        let source = vault.absolute(&attachment.source)?;
        write(&inside(&folder, &attachment.path)?, &fs::read(source)?)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_exports_inside_their_folder() {
        let folder = Path::new("/out");
        assert_eq!(
            inside(folder, "a/b.html").unwrap(),
            Path::new("/out/a/b.html")
        );
        assert!(inside(folder, "../escape.html").is_err());
        assert!(inside(folder, "/etc/passwd").is_err());
        assert!(inside(folder, "").is_err());
    }
}
