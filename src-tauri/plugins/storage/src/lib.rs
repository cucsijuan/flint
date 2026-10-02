//! Folder access on mobile. Android keeps shared folders behind the all-files permission and
//! hands out picked folders as content URIs, which this plugin turns into plain paths.

use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, Runtime};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "io.github.cucsijuan.flint.storage";

#[derive(Debug, Deserialize, Serialize)]
pub struct Access {
    pub granted: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PickedFolder {
    pub path: Option<String>,
}

/// Native calls, on mobile only; desktop never reaches them.
pub struct Storage<R: Runtime>(
    #[cfg(target_os = "android")] tauri::plugin::PluginHandle<R>,
    #[cfg(not(target_os = "android"))] std::marker::PhantomData<R>,
);

impl<R: Runtime> Storage<R> {
    fn call<T: serde::de::DeserializeOwned>(&self, command: &str) -> Result<T, String> {
        #[cfg(target_os = "android")]
        {
            self.0
                .run_mobile_plugin(command, ())
                .map_err(|error| error.to_string())
        }
        #[cfg(not(target_os = "android"))]
        {
            Err(format!("{command} is only available on Android"))
        }
    }
}

#[tauri::command]
async fn has_all_files_access<R: Runtime>(app: tauri::AppHandle<R>) -> Result<Access, String> {
    app.state::<Storage<R>>().call("hasAllFilesAccess")
}

#[tauri::command]
async fn request_all_files_access<R: Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<Access, String> {
    app.state::<Storage<R>>().call("requestAllFilesAccess")
}

#[tauri::command]
async fn pick_folder<R: Runtime>(app: tauri::AppHandle<R>) -> Result<PickedFolder, String> {
    app.state::<Storage<R>>().call("pickFolder")
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("storage")
        .invoke_handler(tauri::generate_handler![
            has_all_files_access,
            request_all_files_access,
            pick_folder
        ])
        .setup(|app, _api| {
            #[cfg(target_os = "android")]
            let storage = Storage(_api.register_android_plugin(PLUGIN_IDENTIFIER, "StoragePlugin")?);
            #[cfg(not(target_os = "android"))]
            let storage = Storage::<R>(std::marker::PhantomData);
            app.manage(storage);
            Ok(())
        })
        .build()
}
