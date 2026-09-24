use crate::error::{Error, Result};
use crate::vault::Vault;

const CONFIG_FOLDER: &str = ".flint";

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
}
