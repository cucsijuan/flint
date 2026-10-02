//! The web viewer: web pages in a window of Flint's own, with a small toolbar over the page.
//! A second webview for the toolbar can't be placed reliably on Linux, so it lives in the page.

use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

use crate::error::{Error, Result};

/// Pages ask for the system browser by navigating here; the navigation never happens.
const OPEN_IN_BROWSER: &str = "flint-open-in-browser";

const TOOLBAR: &str = include_str!("web_viewer_toolbar.js");

/// Opens `url` in a new web viewer window.
#[tauri::command]
pub fn open_web_viewer(app: AppHandle, url: String) -> Result<()> {
    let url = Url::parse(&url).map_err(|error| Error::Plugin(error.to_string()))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(Error::Plugin(format!("unsupported URL: {url}")));
    }
    let label = format!(
        "web-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |time| time.as_millis())
    );
    let opener = app.clone();
    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url.clone()))
        .title(url.as_str())
        .inner_size(1100.0, 800.0)
        .initialization_script(TOOLBAR)
        .on_navigation(move |target| {
            if target.scheme() != OPEN_IN_BROWSER {
                return true;
            }
            let page = target.query_pairs().find(|(key, _)| key == "url");
            if let Some((_, page)) = page {
                let _ = opener.opener().open_url(page.into_owned(), None::<&str>);
            }
            false
        })
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Finished {
                let _ = webview.set_title(payload.url().as_str());
            }
        })
        .build()?;
    Ok(())
}
