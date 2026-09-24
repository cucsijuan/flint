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

### M5: Plugins

Plugin API v0 and a sample plugin.

## Backlog

Features deferred from a milestone. They are not scheduled yet.

- **Editor:** tabs and split panes, images, tables, reading view, custom editor context menu.
- **File tree:** drag-and-drop moves, keeping folders expanded after a rename.
- **Links:** rendering embedded notes (`![[note]]`), block references (`[[note#^id]]`), and standard Markdown links to notes (`[text](note.md)`).
- **Search:** parentheses for grouping terms, more operators (`line:`, `section:`, `content:`), sort options.
- **Commands:** customizable hotkeys.
- **Settings:** per-vault settings stored in the vault's `.flint/` folder.
- **Graph:** color groups, force settings, graph in its own tab once tabs exist.
- **Platforms:** macOS and mobile; manual testing on Windows.
- **Testing:** verify light/dark theme switching (graph colors in particular).
