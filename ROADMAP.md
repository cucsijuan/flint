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

### M3: Search and navigation

Full-text search, tags, quick switcher, and command palette.

### M4: Graph view

Global and local graph, built on the vault index.

### M5: Plugins

Plugin API v0 and a sample plugin.

## Backlog

Features deferred from a milestone. They are not scheduled yet.

- **Editor:** tabs and split panes, images, tables, reading view, custom editor context menu.
- **File tree:** drag-and-drop moves, keeping folders expanded after a rename.
- **Links:** rendering embedded notes (`![[note]]`), block references (`[[note#^id]]`), frontmatter `aliases`, and standard Markdown links to notes (`[text](note.md)`).
- **Settings:** per-vault settings stored in the vault's `.flint/` folder.
- **Platforms:** macOS and mobile; manual testing on Windows.
