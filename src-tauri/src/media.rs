//! Microphone access for the audio recorder.

use tauri::WebviewWindow;

/// WebKitGTK keeps media streams off and turns down permission requests unless the app allows them.
#[cfg(target_os = "linux")]
pub fn allow_microphone(window: &WebviewWindow) -> tauri::Result<()> {
    window.with_webview(|webview| {
        use webkit2gtk::glib::object::Cast;
        use webkit2gtk::{
            PermissionRequestExt, SettingsExt, UserMediaPermissionRequest, WebViewExt,
        };

        let view = webview.inner();
        if let Some(settings) = WebViewExt::settings(&view) {
            settings.set_enable_media_stream(true);
        }
        view.connect_permission_request(|_, request| {
            if request
                .downcast_ref::<UserMediaPermissionRequest>()
                .is_some()
            {
                request.allow();
                return true;
            }
            false
        });
    })
}

/// WebView2 and WKWebView ask the user themselves.
#[cfg(not(target_os = "linux"))]
pub fn allow_microphone(_window: &WebviewWindow) -> tauri::Result<()> {
    Ok(())
}
