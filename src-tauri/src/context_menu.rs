use tauri::{Emitter, Manager, WebviewWindow};

pub const CONTEXT_MENU_ACTION: &str = "context-menu-action";
#[cfg(target_os = "macos")]
const CONTEXT_MENU_SPELLING: &str = "context-menu-spelling";
#[cfg(target_os = "macos")]
const MAX_SUGGESTIONS: usize = 6;
const SPELLING_PREFIX: &str = "spelling:";

const LINK_ACTIONS: [(&str, &str); 1] = [("open-link-in-new-tab", "Open link in new tab")];
const EDIT_ACTIONS: [(&str, &str); 6] = [
    ("toggle-bold", "Bold"),
    ("toggle-italic", "Italic"),
    ("toggle-strikethrough", "Strikethrough"),
    ("toggle-inline-code", "Code"),
    ("insert-link", "Insert link"),
    ("insert-template", "Insert template"),
];

fn actions(is_link: bool, is_editable: bool) -> Vec<(&'static str, &'static str)> {
    let links = LINK_ACTIONS.iter().filter(|_| is_link);
    let edits = EDIT_ACTIONS.iter().filter(|_| is_editable);
    links.chain(edits).copied().collect()
}

#[cfg(target_os = "linux")]
pub fn install(window: &WebviewWindow) -> tauri::Result<()> {
    use webkit2gtk::gio::SimpleAction;
    use webkit2gtk::{
        ContextMenuAction, ContextMenuExt, ContextMenuItem, ContextMenuItemExt, HitTestResultExt,
        WebContextExt, WebViewExt,
    };

    const HIDDEN: [ContextMenuAction; 16] = [
        ContextMenuAction::OpenLink,
        ContextMenuAction::OpenLinkInNewWindow,
        ContextMenuAction::DownloadLinkToDisk,
        ContextMenuAction::CopyLinkToClipboard,
        ContextMenuAction::OpenImageInNewWindow,
        ContextMenuAction::DownloadImageToDisk,
        ContextMenuAction::CopyImageUrlToClipboard,
        ContextMenuAction::OpenFrameInNewWindow,
        ContextMenuAction::OpenVideoInNewWindow,
        ContextMenuAction::OpenAudioInNewWindow,
        ContextMenuAction::GoBack,
        ContextMenuAction::GoForward,
        ContextMenuAction::Stop,
        ContextMenuAction::Reload,
        ContextMenuAction::InspectElement,
        ContextMenuAction::InputMethods,
    ];

    let emitter = window.clone();
    window.with_webview(move |webview| {
        let webview = webview.inner();
        if let Some(context) = webview.context() {
            let languages = crate::spelling::system_languages();
            context.set_spell_checking_languages(
                &languages.iter().map(String::as_str).collect::<Vec<_>>(),
            );
            context.set_spell_checking_enabled(true);
        }
        webview.connect_context_menu(move |_, menu, _, hit| {
            for item in menu.items() {
                let action = item.stock_action();
                if HIDDEN.contains(&action) || action == ContextMenuAction::Unicode {
                    menu.remove(&item);
                }
            }
            let actions = actions(hit.context_is_link(), hit.context_is_editable());
            if !actions.is_empty() && !menu.items().is_empty() {
                menu.append(&ContextMenuItem::new_separator());
            }
            for (id, label) in actions {
                let action = SimpleAction::new(id, None);
                let emitter = emitter.clone();
                action.connect_activate(move |_, _| {
                    let _ = emitter.emit(CONTEXT_MENU_ACTION, id);
                });
                menu.append(&ContextMenuItem::from_gaction(&action, label, None));
            }
            false
        });
    })
}

#[cfg(windows)]
pub fn install(window: &WebviewWindow) -> tauri::Result<()> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_COMMAND, COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR,
        ICoreWebView2_11, ICoreWebView2ContextMenuItemCollection, ICoreWebView2Environment9,
    };
    use webview2_com::{
        ContextMenuRequestedEventHandler, CustomItemSelectedEventHandler, take_pwstr,
    };
    use windows::Win32::System::Com::IStream;
    use windows_core::{BOOL, HSTRING, Interface, PWSTR};

    const HIDDEN: [&str; 14] = [
        "back",
        "forward",
        "reload",
        "saveAs",
        "print",
        "createQrCode",
        "inspectElement",
        "share",
        "webCapture",
        "openLinkInNewWindow",
        "saveLinkAs",
        "copyLinkLocation",
        "saveImageAs",
        "copyImageLocation",
    ];

    unsafe fn append(
        items: &ICoreWebView2ContextMenuItemCollection,
        item: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2ContextMenuItem,
    ) -> windows_core::Result<()> {
        let mut count = 0;
        unsafe {
            items.Count(&mut count)?;
            items.InsertValueAtIndex(count, item)
        }
    }

    let emitter = window.clone();
    window.with_webview(move |webview| unsafe {
        let Ok(core) = webview
            .controller()
            .CoreWebView2()
            .and_then(|core| core.cast::<ICoreWebView2_11>())
        else {
            return;
        };
        let Ok(environment) = webview.environment().cast::<ICoreWebView2Environment9>() else {
            return;
        };
        let handler = ContextMenuRequestedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else { return Ok(()) };
            let target = args.ContextMenuTarget()?;
            let items = args.MenuItems()?;
            let mut count = 0;
            items.Count(&mut count)?;
            for index in (0..count).rev() {
                let mut name = PWSTR::null();
                items.GetValueAtIndex(index)?.Name(&mut name)?;
                if HIDDEN.contains(&take_pwstr(name).as_str()) {
                    items.RemoveValueAtIndex(index)?;
                }
            }
            let (mut is_link, mut is_editable) = (BOOL::default(), BOOL::default());
            target.HasLinkUri(&mut is_link)?;
            target.IsEditable(&mut is_editable)?;
            let actions = actions(is_link.as_bool(), is_editable.as_bool());
            if actions.is_empty() {
                return Ok(());
            }
            let separator = environment.CreateContextMenuItem(
                &HSTRING::new(),
                None::<&IStream>,
                COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR,
            )?;
            append(&items, &separator)?;
            for (id, label) in actions {
                let item = environment.CreateContextMenuItem(
                    &HSTRING::from(label),
                    None::<&IStream>,
                    COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_COMMAND,
                )?;
                let emitter = emitter.clone();
                let selected = CustomItemSelectedEventHandler::create(Box::new(move |_, _| {
                    let _ = emitter.emit(CONTEXT_MENU_ACTION, id);
                    Ok(())
                }));
                let mut token = 0;
                item.add_CustomItemSelected(&selected, &mut token)?;
                append(&items, &item)?;
            }
            Ok(())
        }));
        let mut token = 0;
        let _ = core.add_ContextMenuRequested(&handler, &mut token);
    })
}

/// WKWebView's menu can't be extended, so on macOS the page asks for a native menu instead.
#[cfg(target_os = "macos")]
pub fn install(window: &WebviewWindow) -> tauri::Result<()> {
    let emitter = window.clone();
    window.on_menu_event(move |_, event| {
        let id = event.id().as_ref();
        if let Some(suggestion) = id.strip_prefix(SPELLING_PREFIX) {
            let _ = emitter.emit(CONTEXT_MENU_SPELLING, suggestion);
            return;
        }
        let known = LINK_ACTIONS.iter().chain(&EDIT_ACTIONS);
        if let Some((id, _)) = known.into_iter().find(|(known, _)| id == *known) {
            let _ = emitter.emit(CONTEXT_MENU_ACTION, *id);
        }
    });
    Ok(())
}

#[cfg(not(any(target_os = "linux", windows, target_os = "macos")))]
pub fn install(_window: &WebviewWindow) -> tauri::Result<()> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn spelling_suggestions(word: &str) -> Vec<String> {
    use objc2_app_kit::NSSpellChecker;
    use objc2_foundation::NSString;

    let checker = NSSpellChecker::sharedSpellChecker();
    let text = NSString::from_str(word);
    let misspelled = checker.checkSpellingOfString_startingAt(&text, 0);
    if misspelled.length == 0 {
        return Vec::new();
    }
    checker
        .guessesForWordRange_inString_language_inSpellDocumentWithTag(misspelled, &text, None, 0)
        .map(|guesses| {
            guesses
                .iter()
                .take(MAX_SUGGESTIONS)
                .map(|guess| guess.to_string())
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(not(target_os = "macos"))]
fn spelling_suggestions(_word: &str) -> Vec<String> {
    Vec::new()
}

/// Shows the context menu as a native menu, for webviews whose own menu can't be extended.
#[tauri::command]
pub fn show_context_menu(
    window: WebviewWindow,
    is_link: bool,
    is_editable: bool,
    word: Option<String>,
) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

    let app = window.app_handle();
    let menu = Menu::new(app)?;
    let suggestions = word
        .as_deref()
        .map(spelling_suggestions)
        .unwrap_or_default();
    for suggestion in &suggestions {
        let id = format!("{SPELLING_PREFIX}{suggestion}");
        menu.append(&MenuItem::with_id(app, id, suggestion, true, None::<&str>)?)?;
    }
    if !suggestions.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
    if is_editable {
        menu.append(&PredefinedMenuItem::cut(app, None)?)?;
    }
    menu.append(&PredefinedMenuItem::copy(app, None)?)?;
    if is_editable {
        menu.append(&PredefinedMenuItem::paste(app, None)?)?;
    }
    menu.append(&PredefinedMenuItem::select_all(app, None)?)?;
    let actions = actions(is_link, is_editable);
    if !actions.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
    for (id, label) in actions {
        menu.append(&MenuItem::with_id(app, id, label, true, None::<&str>)?)?;
    }
    window.popup_menu(&menu)
}

/// The macOS menu bar, without "Close Window" so ⌘W is free to close tabs.
#[cfg(target_os = "macos")]
pub fn app_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{Menu, PredefinedMenuItem, Submenu};

    let separator = || PredefinedMenuItem::separator(app);
    Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                "Flint",
                true,
                &[
                    &PredefinedMenuItem::about(app, None, None)?,
                    &separator()?,
                    &PredefinedMenuItem::services(app, None)?,
                    &separator()?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                    &separator()?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &separator()?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::fullscreen(app, None)?,
                ],
            )?,
        ],
    )
}
