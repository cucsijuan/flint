# Roadmap

Flint aims for feature parity with Obsidian's core, built on a plain folder of Markdown files that stays compatible with Obsidian vaults.

## Milestones

### M0: Foundation ✅

Tauri 2 + Svelte 5 app, linting, tests, and CI builds for Linux and Windows.

### M1: Vault and editor ✅

- Open a folder as a vault; hidden folders such as `.obsidian` are skipped.
- File tree: create, rename, and move notes and folders to the trash.
- CodeMirror 6 editor with live preview and a source mode (Ctrl+E).
- Autosave with atomic writes; notes changed outside Flint reload automatically.

### M2: Wikilinks ✅

- Vault index of links and headings, kept up to date as files change.
- `[[note]]`, `[[note#heading]]`, `[[note|alias]]` and `![[note]]`, resolved like Obsidian does.
- Autocomplete for notes and headings; click to open, creating missing notes.
- Backlinks panel.
- Renaming or moving updates incoming links (ask, always, or never).

### M3: Search and navigation ✅

- Full-text search with Obsidian's syntax: terms, `"phrases"`, `-exclusions`, `OR`, `path:`, `file:`, `tag:` and `/regex/`.
- Tags from the text (including nested `#tags/like/this`) and from frontmatter; tags pane, clickable tags and tag autocomplete.
- Frontmatter `aliases`: links, autocomplete and the quick switcher understand them.
- Quick switcher (Ctrl+O) and command palette (Ctrl+P) with fuzzy matching.

### M4: Graph view ✅

- Global graph (Ctrl+G) with live force layout, hover highlighting, zoom and drag; clicking a node opens the note, searches the tag, or creates the missing note.
- Local graph in the right sidebar with a configurable depth.
- Filters for tags, missing notes, orphans and paths.

### M5: Plugins ✅

- Plugins live in each vault's `.flint/plugins/` folder and are turned on per vault in Settings, after a trust warning.
- API v0 ([`plugin-api`](plugin-api)): commands, CodeMirror extensions, vault access and change events, active note events, notices, sidebar tabs and plugin storage.
- Warning for plugins whose license isn't compatible with the AGPL.
- Sample plugin: [`examples/word-count`](examples/word-count).

With M5, the MVP is complete. [v0.1.0](https://github.com/cucsijuan/flint/releases/tag/v0.1.0) is the first preview release.

### M6: UI tests and updates

End-to-end tests of the real app with `tauri-driver` on Linux and Windows in CI, and automatic updates.

### M7: Tabs and panes

Several notes open at once in tabs (Ctrl+click opens a link in a new tab), split panes, and the graph in its own tab.

### M8: Rich content

Images and attachments (paste or drop to save), embedded notes (`![[note]]`), tables, reading view, and an editor context menu.

### M9: Core workflows

Daily notes, templates, outline, bookmarks, a properties editor for frontmatter, and standard Markdown links to notes.

### M10: Customization

Appearance (theme, fonts), customizable hotkeys, per-vault settings, and graph color groups.

### M11: Plugin ecosystem

Browsing and installing community plugins, hot reload, a settings-page API, tab icons, and published API types.

## Backlog

Features that are not scheduled in a milestone yet.

- **File tree:** drag-and-drop moves, keeping folders expanded after a rename.
- **Links:** block references (`[[note#^id]]`).
- **Search:** parentheses for grouping terms, more operators (`line:`, `section:`, `content:`), sort options.
- **Graph:** force settings.
- **Distribution:** macOS builds, Windows code signing.
- **Testing:** run the end-to-end tests on Windows too (`msedgedriver` can't attach to WebView2 in CI yet).
- **Later:** sync, canvas, mobile.
- **Testing:** verify light/dark theme switching (graph colors in particular).
