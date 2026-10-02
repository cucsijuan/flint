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

### M6: UI tests and updates ✅

- End-to-end tests that drive the real app with `tauri-driver` and WebdriverIO, run in CI on Linux.
- Open a vault from the command line: `flint /path/to/vault`.
- Automatic updates: Flint checks for a new version on startup (can be turned off) or with "Check for updates", then installs it and restarts. Supported for the AppImage and the Windows installers.

### M7: Tabs and panes ✅

- Tabs: Ctrl+click or middle-click opens notes and links in a new tab; Ctrl+T, Ctrl+W and Ctrl+Tab.
- Back and forward history per tab (Alt+← / Alt+→).
- Split panes, resizable, with the same note editable in several panes at once.
- Drag tabs to reorder them, move them between panes, or drop them on a pane's edge to split it.
- The graph opens in its own tab; tabs and splits are restored when the vault is reopened.

### M8: Rich content ✅

- Attachments (images, PDFs, audio, video) in the file tree; images open in their own tab, other files in the system app.
- Paste or drop images into a note, from screenshots, the file manager or copied files; the attachment folder is configurable.
- Live preview renders images, tables and embedded notes (`![[note]]`, `![[note#heading]]`); the source shows above them while editing.
- Reading view (Ctrl+E) with syntax-highlighted code blocks.
- Editor context menu with formatting actions (bold, italic, strikethrough, code, link) and spell checking.

### M9: Core workflows ✅

- Interactive rendered content: tasks can be checked in the reading view, embedded notes and rendered blocks; callouts (`> [!note]`, foldable); heading folding in the reading view; a copy button on code blocks.
- Plugin API for rendered Markdown: post-processors and code block processors that know their source lines and can edit them.
- Daily notes (today, previous, next) with a folder, date format and template; templates inserted from a picker with `{{title}}`, `{{date}}`, `{{time}}` and custom formats.
- Outline of the active note, bookmarks for notes, headings and searches (drag to reorder, Obsidian's `bookmarks.json` format).
- Standard Markdown links to notes (`[text](path.md)`): indexed, in backlinks and the graph, rewritten on rename, clickable; external links open in the browser.
- Files move by dragging them in the file tree, fixing relative links in moved notes.
- Frontmatter is parsed as YAML and edited as properties (text, list, number, checkbox, date), shown above the note, hidden or as source, and in a Properties panel.

### M10: macOS

Builds, installers and automatic updates for macOS (Intel and Apple Silicon), with everything from M0 to M9 working as it does on Linux and Windows: pasting and dropping images, the editor context menu with formatting actions, spell checking, and hotkeys with ⌘.

### M11: Customization ✅

- Per-vault settings in `.flint/` (`app.json`, `appearance.json`, `hotkeys.json`, `graph.json`) with Obsidian's keys; Settings split into sections.
- Appearance: light, dark or system theme, accent color, text and code fonts picked from the installed fonts, font size, readable line length, and CSS snippets from `.flint/snippets`.
- Customizable hotkeys for every command, plugins included, with conflict warnings.
- Graph: Obsidian-style forces with sliders, and color groups based on search queries.
- Duplicate files from the file tree; folders stay open after a rename.

### M12: Plugin ecosystem ✅

- Community plugins: Settings → Plugins lists the [flint-plugins](https://github.com/cucsijuan/flint-plugins) registry and installs or updates plugins from their GitHub releases.
- Plugin API: settings sections, Lucide icons for sidebar tabs, and types published to npm as [`flint-plugin-api`](https://www.npmjs.com/package/flint-plugin-api).
- Hot reload for plugin development, and a TypeScript plugin template (`examples/plugin-template`).

### M13: Complete Markdown ✅

- Math (`$…$`, `$$…$$`) rendered with MathJax, like Obsidian, in the reading view and live preview; tags and links inside math are ignored.
- Mermaid diagrams that follow the light or dark theme.
- `==highlights==`, footnotes (clickable in the reading view, numbered in live preview) and `%%comments%%`, hidden when rendered.
- Block references: `[[note#^id]]` links jump to the block, `![[note#^id]]` embeds it, and `[[note#^` suggests the note's blocks.

### M14: A stronger editor ✅

- Tables edited as a grid in live preview: click a cell to edit it, Tab/Shift+Tab/Enter move between cells, and row and column grips add, move, delete and align.
- Move line up/down (Alt+↑/↓) carries a list item's sub-items and folded sections.
- Folding headings and lists from an arrow beside them, fold/unfold all commands, and folds remembered per note.
- Pasting a URL over selected text makes a link.
- Optional Vim key bindings, and choosing spell-check languages on Linux.

### M15: Advanced search and links ✅

- Search groups terms with parentheses and adds `line:`, `block:`, `section:`, `task:`, `task-todo:`, `task-done:`, `content:`, `match-case:`, `ignore-case:` and `[property:value]`; results sort by name, modified or created time.
- Search and replace in the current note, its folder or the whole vault, all at once or one result line at a time.
- Unlinked mentions in the backlinks panel with a Link button, and an outgoing links panel with the note's links and unlinked mentions.
- `[[^^` finds blocks across the vault, and linking a block without an id gives it one. Jumping to a heading, block or line highlights it briefly.

### M16: Bases ✅

- Obsidian-compatible `.base` files, and bases embedded in notes with ` ```base ` code blocks.
- Table, cards, list and map views, with sorting, grouping, limits, column summaries, and columns you can reorder, resize and hide.
- Filters for a view or the whole base, with nested groups built visually or written as expressions; formulas with Obsidian's expression language and functions.
- Editing properties right in the table, vault-wide property types (`types.json`), and a New button that creates a note matching the filters.
- Plugins can show their own rows with the same views through `renderDataView`.

### Plugin integrations ✅

- Plugin API: HTTP requests through Flint's backend (no CORS, system certificates trusted), secrets in the OS keychain, opening links, and `minAppVersion` in manifests.
- Community plugins can share one repository, each found by its release tag prefix.
- The [Jira plugin](https://github.com/cucsijuan/flint-official-plugins/tree/main/jira): JQL tables, your issues in the sidebar, edits pushed on demand (the server wins on conflicts), creating issues, comments and worklogs.
- A configurable readable line width and a command to toggle it; base tables fill the available width.

### M17: Export and history ✅

- Export a note to PDF with page size, orientation, margins, scale and title options, printed with each platform's own engine (Windows and Linux; macOS uses its print dialog for now).
- Export a note to one self-contained HTML file, and a folder or the whole vault as a website with linked pages, an index and their images.
- Version history: snapshots every few minutes while a note changes, kept for a set number of days outside the vault; compare any version with the note and restore it, follow renames, and recover deleted notes.

### M18: Canvas ✅

- Obsidian-compatible `.canvas` files (JSON Canvas 1.0): text, note, image, web page and group cards, connected by edges with sides, arrows, colors and labels.
- Pan and zoom with a grid and a minimap; move, resize and snap cards; box selection; undo and redo; copy and paste, including between canvases.
- Text cards and note cards edit in place with the live preview editor; web page cards show the page's title, description and image; groups carry the cards inside them.
- Canvases in the file tree, created from a menu or command, filled by dragging notes and images from the tree, and embedded in notes with `![[name.canvas]]`.
- Canvases count for links: backlinks, the graph, and renaming a note updates the canvases that show it.
- Search inside a canvas (note cards included), export as PNG or SVG, and turning a text card into a note.

### M19: Polish ✅

The backlog that piled up along the way:

- Bookmark groups that look and work like folders, and a calendar of daily notes in the right sidebar.
- Pasting and dropping any file as an attachment (documents, archives and data files are now known attachments), and dropping images on the reading view.
- Replacing a single search match.
- Canvas: reconnecting edges by dragging their ends, alignment guides while moving cards, and a presentation mode with groups as slides.
- Tables: formatting inside cells (hotkeys and the context menu) and “+” buttons on their edges; formatting marks come off in any order.
- Flint's own spell checker on every platform, with downloadable dictionaries in about 70 languages, suggestions and a personal dictionary.
- Flint's own context menu for notes and text fields, the same everywhere, instead of the webviews' native menus.
- An end-to-end test for theme switching.

### M20: Core plugins

Obsidian's everyday core plugins that Flint still lacks:

- Page previews on hover (Ctrl+hover in the editor), slash commands, and the note composer (extract a selection to a new note, merge notes).
- Unique notes named after the date and time, a random note, a status bar with word counts and backlinks, and a vault-wide properties view.
- Workspaces (saved layouts), pinned and stacked tabs, slides from notes split by `---`, and an audio recorder.
- Pop-out windows and a web viewer.

## Backlog

Features that are not scheduled in a milestone yet.

- **Export:** a native PDF engine on macOS (WKWebView printing) instead of the print dialog, with M10.
- **Distribution:** Windows code signing.
- **Testing:** end-to-end tests on Windows: `msedgedriver` still can't attach to the app's WebView2 in CI ("DevToolsActivePort file doesn't exist"), even with a driver matching the WebView2 runtime.
- **Later:** mobile (iOS and Android), sync between devices.
