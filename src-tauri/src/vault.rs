use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};

use ignore::WalkBuilder;
use serde::Serialize;
use tempfile::NamedTempFile;

use crate::error::{Error, Result};

const NOTE_EXTENSION: &str = "md";
const ATTACHMENT_EXTENSIONS: [&str; 16] = [
    "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "pdf", "mp3", "wav", "ogg", "m4a",
    "mp4", "webm", "mov",
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Folder,
    Attachment,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Entry {
    pub path: String,
    pub kind: EntryKind,
}

#[derive(Debug, Clone)]
pub struct Vault {
    root: PathBuf,
}

impl Vault {
    pub fn open(root: impl AsRef<Path>) -> Result<Self> {
        let root = fs::canonicalize(root)?;
        if !root.is_dir() {
            return Err(std::io::Error::from(std::io::ErrorKind::NotADirectory).into());
        }
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn entries(&self) -> Result<Vec<Entry>> {
        self.entries_under("")
    }

    pub fn entries_under(&self, path: &str) -> Result<Vec<Entry>> {
        let start = if path.is_empty() {
            self.root.clone()
        } else {
            self.resolve(path)?
        };
        if !start.exists() {
            return Ok(Vec::new());
        }
        let mut entries = Vec::new();
        for item in WalkBuilder::new(start)
            .standard_filters(false)
            .hidden(true)
            .build()
        {
            let item = item?;
            if item.depth() == 0 && item.path() == self.root {
                continue;
            }
            let kind = if item.file_type().is_some_and(|t| t.is_dir()) {
                EntryKind::Folder
            } else if is_note(item.path()) {
                EntryKind::File
            } else if is_attachment(item.path()) {
                EntryKind::Attachment
            } else {
                continue;
            };
            if let Some(path) = self.relative(item.path()) {
                entries.push(Entry { path, kind });
            }
        }
        Ok(entries)
    }

    pub fn read(&self, path: &str) -> Result<String> {
        Ok(fs::read_to_string(self.resolve(path)?)?)
    }

    pub fn write(&self, path: &str, contents: &str) -> Result<()> {
        let target = self.resolve(path)?;
        let parent = target.parent().unwrap_or(&self.root);
        let mut file = NamedTempFile::new_in(parent)?;
        file.write_all(contents.as_bytes())?;
        file.persist(&target).map_err(|e| e.error)?;
        Ok(())
    }

    pub fn create_file(&self, path: &str, contents: &[u8]) -> Result<()> {
        self.new_file(path)?.write_all(contents)?;
        Ok(())
    }

    pub fn import_file(&self, source: &Path, path: &str) -> Result<()> {
        let mut input = File::open(source)?;
        io::copy(&mut input, &mut self.new_file(path)?)?;
        Ok(())
    }

    fn new_file(&self, path: &str) -> Result<File> {
        let target = self.resolve(path)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .map_err(|e| already_exists_or(e, path))
    }

    pub fn create_note(&self, path: &str) -> Result<()> {
        self.new_file(path)?;
        Ok(())
    }

    pub fn create_folder(&self, path: &str) -> Result<()> {
        fs::create_dir(self.resolve(path)?).map_err(|e| already_exists_or(e, path))
    }

    pub fn rename(&self, from: &str, to: &str) -> Result<()> {
        let source = self.resolve(from)?;
        let target = self.resolve(to)?;
        if target.exists() {
            return Err(Error::AlreadyExists(to.to_owned()));
        }
        Ok(fs::rename(source, target)?)
    }

    pub fn ensure_folder(&self, path: &str) -> Result<()> {
        Ok(fs::create_dir_all(self.resolve(path)?)?)
    }

    pub fn subfolders(&self, path: &str) -> Result<Vec<String>> {
        let folder = self.resolve(path)?;
        if !folder.is_dir() {
            return Ok(Vec::new());
        }
        let mut names = Vec::new();
        for entry in fs::read_dir(folder)? {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                names.extend(entry.file_name().to_str().map(str::to_owned));
            }
        }
        names.sort();
        Ok(names)
    }

    pub fn trash(&self, path: &str) -> Result<()> {
        Ok(trash::delete(self.resolve(path)?)?)
    }

    pub fn absolute(&self, path: &str) -> Result<PathBuf> {
        self.resolve(path)
    }

    pub fn relative(&self, absolute: &Path) -> Option<String> {
        let relative = absolute.strip_prefix(&self.root).ok()?;
        let parts: Option<Vec<&str>> = relative.iter().map(|part| part.to_str()).collect();
        Some(parts?.join("/"))
    }

    fn resolve(&self, path: &str) -> Result<PathBuf> {
        let relative = Path::new(path);
        let is_inside = !path.is_empty()
            && relative
                .components()
                .all(|component| matches!(component, Component::Normal(_)));
        if !is_inside {
            return Err(Error::OutsideVault(path.to_owned()));
        }
        Ok(self.root.join(relative))
    }
}

pub fn is_within(path: &str, folder: &str) -> bool {
    folder.is_empty()
        || path == folder
        || path
            .strip_prefix(folder)
            .is_some_and(|rest| rest.starts_with('/'))
}

pub fn parent_of(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(parent, _)| parent)
}

pub fn is_hidden(relative: &str) -> bool {
    relative.split('/').any(|part| part.starts_with('.'))
}

fn is_attachment(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(is_attachment_extension)
}

pub fn is_attachment_name(name: &str) -> bool {
    name.rsplit_once('.')
        .is_some_and(|(_, extension)| is_attachment_extension(extension))
}

fn is_attachment_extension(extension: &str) -> bool {
    ATTACHMENT_EXTENSIONS
        .iter()
        .any(|known| extension.eq_ignore_ascii_case(known))
}

fn is_note(path: &Path) -> bool {
    path.extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case(NOTE_EXTENSION))
}

fn already_exists_or(error: std::io::Error, path: &str) -> Error {
    if error.kind() == std::io::ErrorKind::AlreadyExists {
        Error::AlreadyExists(path.to_owned())
    } else {
        error.into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn vault() -> (TempDir, Vault) {
        let dir = TempDir::new().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        (dir, vault)
    }

    #[test]
    fn imports_files_into_new_folders_without_overwriting() {
        let (dir, vault) = vault();
        let source = dir.path().join("outside.png");
        fs::write(&source, "pixels").unwrap();

        vault.import_file(&source, "attachments/pic.png").unwrap();

        let imported = dir.path().join("attachments/pic.png");
        assert_eq!(fs::read_to_string(imported).unwrap(), "pixels");
        assert!(matches!(
            vault.import_file(&source, "attachments/pic.png"),
            Err(Error::AlreadyExists(_))
        ));
    }

    #[test]
    fn rejects_paths_outside_the_vault() {
        let (_dir, vault) = vault();
        for path in [
            "",
            "../escape.md",
            "a/../../escape.md",
            "/etc/passwd",
            "./a.md",
        ] {
            assert!(
                matches!(vault.read(path), Err(Error::OutsideVault(_))),
                "{path} should be rejected"
            );
        }
    }

    #[test]
    fn writes_and_reads_notes() {
        let (_dir, vault) = vault();
        vault.write("note.md", "# Hello").unwrap();
        vault.write("note.md", "# Replaced").unwrap();
        assert_eq!(vault.read("note.md").unwrap(), "# Replaced");
    }

    #[test]
    fn lists_folders_notes_and_attachments_but_skips_hidden_and_other_files() {
        let (dir, vault) = vault();
        fs::create_dir_all(dir.path().join("folder")).unwrap();
        fs::create_dir_all(dir.path().join(".obsidian")).unwrap();
        for file in [
            "folder/nested.md",
            "root.MD",
            "image.PNG",
            "archive.zip",
            ".obsidian/app.md",
        ] {
            fs::write(dir.path().join(file), "").unwrap();
        }

        let mut entries = vault.entries().unwrap();
        entries.sort_by(|a, b| a.path.cmp(&b.path));

        let expected = [
            ("folder", EntryKind::Folder),
            ("folder/nested.md", EntryKind::File),
            ("image.PNG", EntryKind::Attachment),
            ("root.MD", EntryKind::File),
        ]
        .map(|(path, kind)| Entry {
            path: path.to_owned(),
            kind,
        });
        assert_eq!(entries, expected);
    }

    #[test]
    fn creating_never_overwrites() {
        let (_dir, vault) = vault();
        vault.write("note.md", "content").unwrap();
        vault.create_folder("folder").unwrap();

        assert!(matches!(
            vault.create_note("note.md"),
            Err(Error::AlreadyExists(_))
        ));
        assert!(matches!(
            vault.create_folder("folder"),
            Err(Error::AlreadyExists(_))
        ));
        assert_eq!(vault.read("note.md").unwrap(), "content");
    }

    #[test]
    fn renaming_never_overwrites() {
        let (_dir, vault) = vault();
        vault.write("a.md", "a").unwrap();
        vault.write("b.md", "b").unwrap();

        assert!(matches!(
            vault.rename("a.md", "b.md"),
            Err(Error::AlreadyExists(_))
        ));
        vault.rename("a.md", "c.md").unwrap();
        assert_eq!(vault.read("c.md").unwrap(), "a");
    }

    #[test]
    fn detects_hidden_paths() {
        assert!(is_hidden(".obsidian/app.json"));
        assert!(is_hidden("folder/.tmpXYZ"));
        assert!(!is_hidden("folder/note.md"));
    }
}
