use tauri::WebviewWindow;

/// The system's languages, which the spell checker uses until the user picks some.
#[cfg(target_os = "linux")]
pub fn system_languages() -> Vec<String> {
    webkit2gtk::glib::language_names()
        .into_iter()
        .map(String::from)
        .filter(|name| name != "C" && name != "POSIX" && !name.contains(['.', '@']))
        .collect()
}

/// Installed Hunspell dictionaries, where Enchant (WebKitGTK's spell checker) finds them.
#[cfg(target_os = "linux")]
fn installed_dictionaries() -> Vec<String> {
    let user_folder = webkit2gtk::glib::user_config_dir().join("enchant/hunspell");
    let folders = [
        user_folder,
        "/usr/share/hunspell".into(),
        "/usr/share/myspell".into(),
    ];
    let mut names: Vec<String> = folders
        .iter()
        .filter_map(|folder| std::fs::read_dir(folder).ok())
        .flatten()
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            let is_dictionary = path.extension()? == "dic" && path.with_extension("aff").exists();
            is_dictionary.then(|| path.file_stem()?.to_str().map(String::from))?
        })
        .collect();
    names.sort();
    names.dedup();
    names
}

#[cfg(not(target_os = "linux"))]
fn installed_dictionaries() -> Vec<String> {
    Vec::new()
}

/// The languages the user can choose from; empty where the platform picks them itself.
#[tauri::command]
pub fn spelling_languages() -> Vec<String> {
    installed_dictionaries()
}

/// Checks spelling in `languages`, or in the system's languages when it's empty.
#[tauri::command]
pub fn set_spelling_languages(
    window: WebviewWindow,
    languages: Vec<String>,
) -> crate::error::Result<()> {
    #[cfg(target_os = "linux")]
    window.with_webview(move |webview| {
        use webkit2gtk::{WebContextExt, WebViewExt};
        let languages = if languages.is_empty() {
            system_languages()
        } else {
            languages
        };
        if let Some(context) = webview.inner().context() {
            context.set_spell_checking_languages(
                &languages.iter().map(String::as_str).collect::<Vec<_>>(),
            );
        }
    })?;
    #[cfg(not(target_os = "linux"))]
    let _ = (window, languages);
    Ok(())
}
