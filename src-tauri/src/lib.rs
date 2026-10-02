#[cfg(target_os = "macos")]
mod app_menu;
mod canvas;
mod commands;
mod community;
mod config;
mod error;
mod export;
mod history;
mod index;
mod markdown;
mod media;
mod mentions;
mod net;
mod pdf;
mod plugins;
mod search;
mod secrets;
mod spelling;
mod vault;
mod watcher;
mod web_viewer;

use commands::AppState;
use std::{thread, time::Duration};

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        - tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build());
    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_storage::init());
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .manage(AppState::default())
        .manage(spelling::Spelling::default())
        .invoke_handler(tauri::generate_handler![
            commands::launch_vault,
            commands::current_vault,
            commands::app_folder_vaults,
            commands::create_app_folder_vault,
            web_viewer::open_web_viewer,
            commands::open_vault,
            commands::list_entries,
            commands::read_note,
            commands::write_note,
            commands::create_note,
            commands::create_folder,
            commands::rename_entry,
            commands::copy_entry,
            commands::redirect_links,
            commands::trash_entry,
            commands::note_history,
            commands::history_snapshot,
            commands::deleted_notes,
            commands::set_history_settings,
            commands::link_targets,
            commands::resolve_links,
            commands::note_headings,
            commands::backlinks,
            commands::incoming_link_count,
            commands::base_files,
            commands::unlinked_mentions,
            commands::outgoing_links,
            commands::outgoing_mentions,
            commands::search,
            commands::replace_text,
            commands::matching_notes,
            commands::tags,
            commands::graph,
            commands::save_attachment,
            commands::import_attachment,
            commands::save_clipboard_image,
            commands::clipboard_files,
            commands::open_externally,
            commands::show_in_file_manager,
            commands::clipboard_text,
            commands::set_clipboard_text,
            commands::system_fonts,
            spelling::spelling_languages,
            spelling::set_spelling_languages,
            spelling::check_spelling,
            spelling::spelling_suggestions,
            spelling::add_to_dictionary,
            commands::snippets,
            commands::read_snippet,
            commands::read_config,
            commands::write_config,
            commands::list_plugins,
            commands::community_plugins,
            commands::latest_plugin_versions,
            commands::install_plugin,
            net::plugin_http_request,
            pdf::export_pdf,
            export::export_files,
            secrets::plugin_secret_get,
            secrets::plugin_secret_set,
            secrets::plugin_secret_delete,
            commands::read_plugin_file,
            commands::read_plugin_data,
            commands::write_plugin_data,
            commands::enabled_plugins,
            commands::set_enabled_plugins,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                media::allow_microphone(&window)?;
                // The frontend shows the window once it has rendered; this covers a frontend that fails to start.
                let window = window.clone();
                thread::spawn(move || {
                    thread::sleep(Duration::from_secs(5));
                    let _ = window.show();
                });
            }
            #[cfg(target_os = "macos")]
            app.set_menu(app_menu::app_menu(app.handle())?)?;
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
