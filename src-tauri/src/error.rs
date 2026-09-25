use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("no vault is open")]
    NoVault,
    #[error("path is outside the vault: {0}")]
    OutsideVault(String),
    #[error("already exists: {0}")]
    AlreadyExists(String),
    #[error("invalid search: {0}")]
    InvalidQuery(String),
    #[error("invalid attachment data")]
    InvalidAttachment,
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error(transparent)]
    Opener(#[from] tauri_plugin_opener::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Walk(#[from] ignore::Error),
    #[error(transparent)]
    Trash(#[from] trash::Error),
    #[error(transparent)]
    Watch(#[from] notify::Error),
}

impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;
