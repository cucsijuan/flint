const COMMANDS: &[&str] = &["has_all_files_access", "request_all_files_access", "pick_folder", "set_system_bars"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
