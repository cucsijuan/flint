mod commands;
mod config;
mod context_menu;
mod error;
mod index;
mod markdown;
mod plugins;
mod search;
mod vault;
mod watcher;

use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
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
            commands::trash_entry,
            commands::link_targets,
            commands::resolve_links,
            commands::note_headings,
            commands::backlinks,
            commands::incoming_link_count,
            commands::search,
            commands::tags,
            commands::graph,
            commands::save_attachment,
            commands::import_attachment,
            commands::save_clipboard_image,
            commands::clipboard_files,
            commands::open_externally,
            context_menu::show_context_menu,
            commands::system_fonts,
            commands::snippets,
            commands::read_snippet,
            commands::read_config,
            commands::write_config,
            commands::list_plugins,
            commands::read_plugin_file,
            commands::read_plugin_data,
            commands::write_plugin_data,
            commands::enabled_plugins,
            commands::set_enabled_plugins,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                context_menu::install(&window)?;
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
