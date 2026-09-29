mod commands;
mod community;
mod config;
mod context_menu;
mod error;
mod index;
mod markdown;
mod mentions;
mod plugins;
mod search;
mod spelling;
mod vault;
mod watcher;

use commands::AppState;
use std::{thread, time::Duration};

use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::launch_vault,
            commands::open_vault,
            commands::list_entries,
            commands::read_note,
            commands::write_note,
            commands::create_note,
            commands::create_folder,
            commands::rename_entry,
            commands::copy_entry,
            commands::trash_entry,
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
            context_menu::show_context_menu,
            commands::system_fonts,
            spelling::spelling_languages,
            spelling::set_spelling_languages,
            commands::snippets,
            commands::read_snippet,
            commands::read_config,
            commands::write_config,
            commands::list_plugins,
            commands::community_plugins,
            commands::latest_plugin_versions,
            commands::install_plugin,
            commands::read_plugin_file,
            commands::read_plugin_data,
            commands::write_plugin_data,
            commands::enabled_plugins,
            commands::set_enabled_plugins,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                context_menu::install(&window)?;
                // The frontend shows the window once it has rendered; this covers a frontend that fails to start.
                let window = window.clone();
                thread::spawn(move || {
                    thread::sleep(Duration::from_secs(5));
                    let _ = window.show();
                });
            }
            #[cfg(target_os = "macos")]
            app.set_menu(context_menu::app_menu(app.handle())?)?;
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
