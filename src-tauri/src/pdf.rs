//! Printing the page to a PDF file with each platform's own engine.

use std::sync::mpsc::{Sender, channel};

use serde::Deserialize;
use tauri::WebviewWindow;

use crate::error::{Error, Result};

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfOptions {
    /// The page's portrait size, in millimeters.
    pub width_mm: f64,
    pub height_mm: f64,
    pub landscape: bool,
    pub margin_mm: f64,
    /// 1.0 prints at 100%.
    pub scale: f64,
}

type Done = Sender<std::result::Result<(), String>>;

/// Prints the page, which shows only the note being exported, to `path`.
#[tauri::command(async)]
pub fn export_pdf(window: WebviewWindow, path: String, options: PdfOptions) -> Result<()> {
    let (done, finished) = channel();
    print_to_pdf(&window, path, options, done)?;
    finished
        .recv()
        .map_err(|error| Error::Export(error.to_string()))?
        .map_err(Error::Export)
}

#[cfg(target_os = "linux")]
fn print_to_pdf(
    window: &WebviewWindow,
    path: String,
    options: PdfOptions,
    done: Done,
) -> Result<()> {
    window.with_webview(move |webview| {
        use std::cell::RefCell;

        use gtk::{PageOrientation, PageSetup, PaperSize, PrintSettings, Unit};
        use webkit2gtk::{PrintOperation, PrintOperationExt};

        let uri = match gtk::glib::filename_to_uri(&path, None) {
            Ok(uri) => uri,
            Err(error) => {
                let _ = done.send(Err(error.to_string()));
                return;
            }
        };
        let settings = PrintSettings::new();
        settings.set_printer("Print to File");
        settings.set(gtk::PRINT_SETTINGS_OUTPUT_FILE_FORMAT, Some("pdf"));
        settings.set(gtk::PRINT_SETTINGS_OUTPUT_URI, Some(uri.as_str()));
        settings.set_scale(options.scale * 100.0);
        let setup = PageSetup::new();
        let size = PaperSize::new_custom(
            "flint",
            "Flint",
            options.width_mm,
            options.height_mm,
            Unit::Mm,
        );
        setup.set_paper_size(&size);
        setup.set_orientation(if options.landscape {
            PageOrientation::Landscape
        } else {
            PageOrientation::Portrait
        });
        setup.set_top_margin(options.margin_mm, Unit::Mm);
        setup.set_bottom_margin(options.margin_mm, Unit::Mm);
        setup.set_left_margin(options.margin_mm, Unit::Mm);
        setup.set_right_margin(options.margin_mm, Unit::Mm);

        let operation = PrintOperation::new(&webview.inner());
        operation.set_print_settings(&settings);
        operation.set_page_setup(&setup);
        let failed = done.clone();
        operation.connect_failed(move |_, error| {
            let _ = failed.send(Err(error.to_string()));
        });
        // Keeps the operation alive until it finishes, then lets it go.
        let alive = RefCell::new(Some(operation.clone()));
        operation.connect_finished(move |_| {
            alive.borrow_mut().take();
            let _ = done.send(Ok(()));
        });
        operation.print();
    })?;
    Ok(())
}

#[cfg(windows)]
fn print_to_pdf(
    window: &WebviewWindow,
    path: String,
    options: PdfOptions,
    done: Done,
) -> Result<()> {
    window.with_webview(move |webview| unsafe {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE, COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
            ICoreWebView2_7, ICoreWebView2Environment6,
        };
        use webview2_com::PrintToPdfCompletedHandler;
        use windows_core::{HSTRING, Interface};

        const MM_PER_INCH: f64 = 25.4;
        let completed = done.clone();
        let started = (|| -> windows_core::Result<()> {
            let core = webview
                .controller()
                .CoreWebView2()?
                .cast::<ICoreWebView2_7>()?;
            let settings = webview
                .environment()
                .cast::<ICoreWebView2Environment6>()?
                .CreatePrintSettings()?;
            settings.SetOrientation(if options.landscape {
                COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE
            } else {
                COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT
            })?;
            settings.SetPageWidth(options.width_mm / MM_PER_INCH)?;
            settings.SetPageHeight(options.height_mm / MM_PER_INCH)?;
            let margin = options.margin_mm / MM_PER_INCH;
            settings.SetMarginTop(margin)?;
            settings.SetMarginBottom(margin)?;
            settings.SetMarginLeft(margin)?;
            settings.SetMarginRight(margin)?;
            settings.SetScaleFactor(options.scale)?;
            settings.SetShouldPrintBackgrounds(true.into())?;
            settings.SetShouldPrintHeaderAndFooter(false.into())?;
            core.PrintToPdf(
                &HSTRING::from(path.as_str()),
                &settings,
                &PrintToPdfCompletedHandler::create(Box::new(move |result, success| {
                    let _ = completed.send(match result {
                        Err(error) => Err(error.message()),
                        Ok(()) if success => Ok(()),
                        Ok(()) => Err("the PDF couldn't be written".to_owned()),
                    });
                    Ok(())
                })),
            )
        })();
        if let Err(error) = started {
            let _ = done.send(Err(error.message()));
        }
    })?;
    Ok(())
}

#[cfg(not(any(target_os = "linux", windows)))]
fn print_to_pdf(_: &WebviewWindow, _: String, _: PdfOptions, _: Done) -> Result<()> {
    Err(Error::Export("unsupported".to_owned()))
}
