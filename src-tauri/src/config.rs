use crate::error::{Error, Result};
use crate::vault::Vault;

const CONFIG_FOLDER: &str = ".flint";
const SNIPPETS_FOLDER: &str = ".flint/snippets";
const SNIPPET_EXTENSION: &str = ".css";

pub fn read(vault: &Vault, name: &str) -> Result<Option<String>> {
    match vault.read(&config_path(name)?) {
        Ok(text) => Ok(Some(text)),
        Err(Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

pub fn write(vault: &Vault, name: &str, contents: &str) -> Result<()> {
    vault.ensure_folder(CONFIG_FOLDER)?;
    vault.write(&config_path(name)?, contents)
}

/// Names of the CSS snippets in `.flint/snippets`, without their extension.
pub fn snippets(vault: &Vault) -> Result<Vec<String>> {
    let Ok(entries) = std::fs::read_dir(vault.absolute(SNIPPETS_FOLDER)?) else {
        return Ok(Vec::new());
    };
    let mut names: Vec<String> = entries
        .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
        .filter_map(|file| file.strip_suffix(SNIPPET_EXTENSION).map(str::to_owned))
        .filter(|name| is_valid_name(name))
        .collect();
    names.sort();
    Ok(names)
}

pub fn read_snippet(vault: &Vault, name: &str) -> Result<String> {
    if !is_valid_name(name) {
        return Err(Error::OutsideVault(name.to_owned()));
    }
    vault.read(&format!("{SNIPPETS_FOLDER}/{name}{SNIPPET_EXTENSION}"))
}

fn is_valid_name(name: &str) -> bool {
    !name.is_empty() && !name.starts_with('.') && !name.contains(['/', '\\'])
}

fn config_path(name: &str) -> Result<String> {
    let is_valid = !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    if !is_valid {
        return Err(Error::OutsideVault(name.to_owned()));
    }
    Ok(format!("{CONFIG_FOLDER}/{name}.json"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn stores_named_config_files_in_the_vault_config_folder() {
        let dir = TempDir::new().unwrap();
        let vault = Vault::open(dir.path()).unwrap();

        assert_eq!(read(&vault, "workspace").unwrap(), None);
        write(&vault, "workspace", "{}").unwrap();
        assert_eq!(read(&vault, "workspace").unwrap().as_deref(), Some("{}"));
        assert!(dir.path().join(".flint/workspace.json").exists());

        for name in ["", "../escape", "a/b", "plugins.json"] {
            assert!(
                write(&vault, name, "{}").is_err(),
                "{name} should be rejected"
            );
        }
    }

    #[test]
    fn lists_and_reads_css_snippets() {
        let dir = TempDir::new().unwrap();
        let vault = Vault::open(dir.path()).unwrap();
        assert!(snippets(&vault).unwrap().is_empty());

        std::fs::create_dir_all(dir.path().join(".flint/snippets")).unwrap();
        for file in ["wide.css", "a b.css", "notes.txt", ".hidden.css"] {
            std::fs::write(dir.path().join(".flint/snippets").join(file), "body {}").unwrap();
        }
        assert_eq!(snippets(&vault).unwrap(), ["a b", "wide"]);
        assert_eq!(read_snippet(&vault, "wide").unwrap(), "body {}");
        assert!(read_snippet(&vault, "../../etc/passwd").is_err());
    }
}
