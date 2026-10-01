//! Flint's own spell checker, the same on every platform: Hunspell dictionaries, downloaded once
//! per language, checked with spellbook.

use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

use serde::Serialize;
use spellbook::Dictionary;
use tauri::{AppHandle, Manager, State};

use crate::error::{Error, Result};

const MAX_SUGGESTIONS: usize = 6;
const PERSONAL_FILE: &str = "personal.txt";

/// The dictionaries published as `dictionary-<code>` packages (github.com/wooorm/dictionaries).
pub const LANGUAGES: [&str; 72] = [
    "bg", "ca", "cs", "cy", "da", "de", "de-at", "de-ch", "el", "en", "en-au", "en-ca", "en-gb",
    "en-za", "eo", "es", "es-ar", "es-bo", "es-cl", "es-co", "es-cr", "es-cu", "es-do", "es-ec",
    "es-gt", "es-hn", "es-mx", "es-ni", "es-pa", "es-pe", "es-ph", "es-pr", "es-py", "es-sv",
    "es-us", "es-uy", "es-ve", "et", "eu", "fa", "fo", "fr", "fy", "ga", "gd", "gl", "he", "hr",
    "hu", "hy", "is", "it", "ka", "ko", "la", "lb", "lt", "lv", "mk", "mn", "nb", "nl", "nn", "oc",
    "pl", "pt", "pt-pt", "ro", "ru", "sk", "sl", "sv",
];

#[derive(Default)]
pub struct Spelling {
    dictionaries: RwLock<Vec<Dictionary>>,
    personal: RwLock<HashSet<String>>,
}

#[derive(Debug, Serialize)]
pub struct Language {
    code: &'static str,
    installed: bool,
}

fn folder(app: &AppHandle) -> Result<PathBuf> {
    Ok(app.path().app_data_dir()?.join("dictionaries"))
}

fn is_installed(folder: &Path, code: &str) -> bool {
    ["aff", "dic"]
        .iter()
        .all(|extension| folder.join(format!("{code}.{extension}")).exists())
}

async fn download(folder: &Path, code: &str) -> Result<()> {
    let client = crate::net::client()?;
    fs::create_dir_all(folder)?;
    // The `.dic` file goes last, so a dictionary counts as installed only once it's whole.
    for extension in ["aff", "dic"] {
        let url = format!("https://cdn.jsdelivr.net/npm/dictionary-{code}/index.{extension}");
        let bytes = client
            .get(&url)
            .send()
            .await?
            .error_for_status()?
            .bytes()
            .await?;
        fs::write(folder.join(format!("{code}.{extension}")), bytes)?;
    }
    Ok(())
}

fn load(folder: &Path, code: &str) -> Result<Dictionary> {
    let aff = fs::read_to_string(folder.join(format!("{code}.aff")))?;
    let dic = fs::read_to_string(folder.join(format!("{code}.dic")))?;
    Dictionary::new(&aff, &dic).map_err(|error| Error::Spelling(format!("{code}: {error}")))
}

fn is_correct(dictionaries: &[Dictionary], personal: &HashSet<String>, word: &str) -> bool {
    dictionaries.is_empty()
        || personal.contains(word)
        || personal.contains(&word.to_lowercase())
        || dictionaries.iter().any(|dictionary| dictionary.check(word))
}

#[tauri::command]
pub fn spelling_languages(app: AppHandle) -> Result<Vec<Language>> {
    let folder = folder(&app)?;
    Ok(LANGUAGES
        .iter()
        .map(|&code| Language {
            code,
            installed: is_installed(&folder, code),
        })
        .collect())
}

/// Checks spelling in `languages`, downloading the dictionaries that aren't installed yet.
#[tauri::command]
pub async fn set_spelling_languages(
    app: AppHandle,
    state: State<'_, Spelling>,
    languages: Vec<String>,
) -> Result<()> {
    let folder = folder(&app)?;
    let mut dictionaries = Vec::new();
    for code in languages
        .iter()
        .filter(|code| LANGUAGES.contains(&code.as_str()))
    {
        if !is_installed(&folder, code) {
            download(&folder, code).await?;
        }
        let (folder, code) = (folder.clone(), code.clone());
        let dictionary = tauri::async_runtime::spawn_blocking(move || load(&folder, &code))
            .await
            .map_err(|error| Error::Spelling(error.to_string()))??;
        dictionaries.push(dictionary);
    }
    let personal = fs::read_to_string(folder.join(PERSONAL_FILE)).unwrap_or_default();
    *state.personal.write().unwrap_or_else(|e| e.into_inner()) =
        personal.lines().map(str::to_owned).collect();
    *state
        .dictionaries
        .write()
        .unwrap_or_else(|e| e.into_inner()) = dictionaries;
    Ok(())
}

/// The words of `words` that no chosen dictionary knows.
#[tauri::command(async)]
pub fn check_spelling(state: State<Spelling>, words: Vec<String>) -> Vec<String> {
    let dictionaries = state.dictionaries.read().unwrap_or_else(|e| e.into_inner());
    let personal = state.personal.read().unwrap_or_else(|e| e.into_inner());
    words
        .into_iter()
        .filter(|word| !is_correct(&dictionaries, &personal, word))
        .collect()
}

#[tauri::command(async)]
pub fn spelling_suggestions(state: State<Spelling>, word: String) -> Vec<String> {
    let dictionaries = state.dictionaries.read().unwrap_or_else(|e| e.into_inner());
    let mut found: Vec<String> = Vec::new();
    for dictionary in dictionaries.iter() {
        let mut suggestions = Vec::new();
        dictionary.suggest(&word, &mut suggestions);
        for suggestion in suggestions {
            if !found.contains(&suggestion) {
                found.push(suggestion);
            }
        }
    }
    found.truncate(MAX_SUGGESTIONS);
    found
}

/// Accepts `word` from now on, in every language and vault.
#[tauri::command]
pub fn add_to_dictionary(app: AppHandle, state: State<Spelling>, word: String) -> Result<()> {
    let folder = folder(&app)?;
    fs::create_dir_all(&folder)?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(folder.join(PERSONAL_FILE))?;
    writeln!(file, "{word}")?;
    state
        .personal
        .write()
        .unwrap_or_else(|e| e.into_inner())
        .insert(word);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const AFF: &str = "SET UTF-8\nSFX S Y 1\nSFX S 0 s .\n";
    const DIC: &str = "2\nnote/S\nvault\n";

    #[test]
    fn checks_words_against_dictionaries_and_personal_words() {
        let dictionaries = [Dictionary::new(AFF, DIC).unwrap()];
        let personal = HashSet::from(["Flint".to_owned()]);
        assert!(is_correct(&dictionaries, &personal, "notes"));
        assert!(is_correct(&dictionaries, &personal, "Flint"));
        assert!(!is_correct(&dictionaries, &personal, "vaults"));
        assert!(is_correct(&[], &personal, "anything"));
    }
}
