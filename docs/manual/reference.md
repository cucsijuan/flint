# Reference

[← Manual](README.md)

## Default hotkeys

**Ctrl** is ⌘ on macOS. A few defaults differ on macOS where the usual shortcut belongs to the system. Change any of them in **Settings → Hotkeys**.

### App

| Action              | Windows and Linux | macOS |
| ------------------- | ----------------- | ----- |
| Command palette     | Ctrl+P            | ⌘P    |
| Quick switcher      | Ctrl+O            | ⌘O    |
| Search in all notes | Ctrl+Shift+F      | ⌘⇧F   |
| Graph view          | Ctrl+G            | ⌘G    |
| New note            | Ctrl+N            | ⌘N    |
| Settings            | Ctrl+,            | ⌘,    |

### Tabs and navigation

| Action              | Windows and Linux | macOS |
| ------------------- | ----------------- | ----- |
| New tab             | Ctrl+T            | ⌘T    |
| Close tab           | Ctrl+W            | ⌘W    |
| Next tab            | Ctrl+Tab          | ⌃Tab  |
| Previous tab        | Ctrl+Shift+Tab    | ⌃⇧Tab |
| Back                | Alt+←             | ⌘⌥←   |
| Forward             | Alt+→             | ⌘⌥→   |
| Previous daily note | Ctrl+Alt+←        | ⌃⌥←   |
| Next daily note     | Ctrl+Alt+→        | ⌃⌥→   |

### Editing

| Action               | Windows and Linux     | macOS    |
| -------------------- | --------------------- | -------- |
| Toggle reading view  | Ctrl+E                | ⌘E       |
| Bold                 | Ctrl+B                | ⌘B       |
| Italic               | Ctrl+I                | ⌘I       |
| Insert internal link | Ctrl+K                | ⌘K       |
| Insert template      | Ctrl+Shift+T          | ⌘⇧T      |
| Move line up / down  | Alt+↑ / Alt+↓         | ⌥↑ / ⌥↓  |
| Find in note         | Ctrl+F                | ⌘F       |
| Undo / redo          | Ctrl+Z / Ctrl+Shift+Z | ⌘Z / ⌘⇧Z |

### Canvas

| Action                 | Shortcut                                  |
| ---------------------- | ----------------------------------------- |
| Undo / redo            | Ctrl+Z / Ctrl+Shift+Z or Ctrl+Y           |
| Select all             | Ctrl+A                                    |
| Edit the selected card | Enter                                     |
| Stop editing, deselect | Escape                                    |
| Delete                 | Delete or Backspace                       |
| Search                 | Ctrl+F                                    |
| Zoom                   | Ctrl+scroll                               |
| Pan                    | scroll, Space+drag, middle- or right-drag |

## Commands

Every command is in the command palette (**Ctrl+P**) and can get a hotkey.

| Group           | Commands                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Navigation      | Open command palette · Open quick switcher · Search in all notes · Open graph view · Navigate back · Navigate forward · Reveal current file in navigation                |
| Tabs and panes  | New tab · Close current tab · Close other tabs · Go to next tab · Go to previous tab · Split right · Split down                                                          |
| Files           | Create new note · Create new base · Create new canvas · Create new folder · Rename current note · Delete current note                                                    |
| Daily notes     | Open today's daily note · Open previous daily note · Open next daily note · Insert template                                                                              |
| Editing         | Toggle bold · Toggle italic · Toggle strikethrough · Toggle inline code · Insert internal link · Move line up · Move line down · Open link under the cursor in a new tab |
| Folding         | Toggle fold on the current line · Fold all headings and lists · Unfold all headings and lists                                                                            |
| View            | Toggle reading view · Toggle live preview and source mode · Toggle readable line length · Toggle right sidebar                                                           |
| Panels          | Show file explorer · Show bookmarks · Show backlinks · Show outgoing links · Show outline · Show properties · Show tags · Show local graph · Show calendar               |
| Notes           | Add properties to current note · Bookmark or unbookmark current note                                                                                                     |
| Export, history | Export to PDF · Export to HTML · Export vault as a website · Open version history · Recover deleted notes                                                                |
| App             | Open another vault · Open settings · Check for updates                                                                                                                   |

Plugins add their own commands, named after the plugin.

## Files Flint writes

Inside each vault, Flint keeps its configuration in a hidden `.flint` folder. It never adds anything to your notes except what you type. Where a file has an Obsidian counterpart in `.obsidian`, it uses the same format and keys.

| File                      | Holds                                            |
| ------------------------- | ------------------------------------------------ |
| `.flint/app.json`         | editor settings                                  |
| `.flint/appearance.json`  | theme, accent color, fonts, enabled CSS snippets |
| `.flint/hotkeys.json`     | custom hotkeys                                   |
| `.flint/graph.json`       | graph filters, color groups and forces           |
| `.flint/daily-notes.json` | daily notes settings                             |
| `.flint/templates.json`   | templates settings                               |
| `.flint/bookmarks.json`   | bookmarks                                        |
| `.flint/types.json`       | property types                                   |
| `.flint/workspace.json`   | open tabs, splits and panel layout               |
| `.flint/folds.json`       | folded headings and lists, per note              |
| `.flint/plugins.json`     | which plugins are turned on                      |
| `.flint/plugins/<id>/`    | installed plugins, with their `data.json`        |
| `.flint/snippets/`        | your CSS snippets                                |

Outside the vault:

- **Version history** lives in Flint's data folder (see [Version history](export-and-history.md#settings)).
- **App settings** (last vault, update checks) live in Flint's config folder.
- **Spell-check dictionaries** and your personal words live in Flint's data folder, under `dictionaries`.
- **Plugin secrets** live in the system keychain.

If you sync your vault, you can sync `.flint` too, to share settings between computers, or exclude `.flint/workspace.json` so each computer keeps its own layout.

## Obsidian compatibility

Flint opens Obsidian vaults as they are and never changes them behind your back. Both apps can use the same vault, even at the same time.

**Works the same:**

- Notes, folders and attachments.
- `[[wikilinks]]`, embeds, headings and block references, and Markdown links, resolved with the same rules.
- Tags, frontmatter properties, `aliases`.
- Callouts, highlights, comments, footnotes, math and Mermaid.
- `.base` files and ` ```base ` blocks.
- `.canvas` files (JSON Canvas).
- The formats of bookmarks, hotkeys, graph, daily notes, templates and property types (in `.flint` instead of `.obsidian`).

**Different:**

- Settings are separate: Flint reads `.flint`, not `.obsidian`, so each app keeps its own configuration.
- Flint doesn't run Obsidian plugins. It has its own [plugin API](plugins.md).
- Obsidian themes don't apply, but [CSS snippets](settings.md#css-snippets) can restyle Flint.

## Troubleshooting

**A note I edited elsewhere doesn't update.**
Flint watches the vault folder for changes. If a network or synced drive doesn't report changes, reopen the vault with **Open another vault**.

**A link shows as unresolved, but the note exists.**
The note may be in a hidden folder (a name starting with `.`), which Flint skips. Or two notes share the name and the link picks the other one; write more of the path, such as `[[Folder/Note]]`.

**My images don't show.**
Check that the file is inside the vault and its extension is one Flint knows (see [What a vault is](vaults-and-files.md#what-a-vault-is)).

**A plugin broke something.**
Turn it off in **Settings → Plugins**. If Flint won't start properly, remove its folder from `.flint/plugins/`.

**The window is blank or crashes on Linux.**
Flint uses the system's WebKitGTK. Make sure it's up to date. Flint already works around a known crash with NVIDIA drivers on Wayland.

**macOS says the app is damaged or can't be opened.**
The macOS build isn't signed yet. Open **System Settings → Privacy & Security** and click **Open Anyway**.

**Something else.**
Open an issue at [github.com/cucsijuan/flint/issues](https://github.com/cucsijuan/flint/issues).
