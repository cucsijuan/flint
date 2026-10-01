# Flint user manual

Flint is a free, open-source note editor for a plain folder of Markdown files. Your notes stay ordinary `.md` files on your disk, readable by any other app, and a vault made with Obsidian opens in Flint as it is.

This manual starts with a quick start that walks through the basics in about fifteen minutes. The chapters after it cover every feature in detail.

## Contents

1. [Quick start](#quick-start)
2. [Vaults and files](vaults-and-files.md): opening vaults, the file tree, attachments, trash
3. [The editor](editor.md): live preview, source mode, reading view, formatting, tables, folding, properties
4. [Markdown reference](markdown.md): all the syntax Flint understands
5. [Links and the graph](links-and-graph.md): wikilinks, embeds, backlinks, renaming, the graph view
6. [Search](search.md): query syntax, search and replace
7. [Workspace](workspace.md): tabs, panes, sidebars, the quick switcher and the command palette, bookmarks
8. [Daily notes and templates](daily-notes-and-templates.md)
9. [Bases](bases.md): database views of your notes
10. [Canvas](canvas.md): boards of cards and arrows
11. [Export and version history](export-and-history.md)
12. [Settings and customization](settings.md): appearance, CSS snippets, hotkeys
13. [Plugins](plugins.md): installing, trusting and writing plugins
14. [Reference](reference.md): hotkeys, files Flint writes, Obsidian compatibility, troubleshooting

In this manual, **Ctrl** means ⌘ (Command) on macOS, and **Alt** means ⌥ (Option).

---

## Quick start

### 1. Install Flint

Download the installer for your system from the [latest release](https://github.com/cucsijuan/flint/releases/latest):

| System  | File                                                                                       |
| ------- | ------------------------------------------------------------------------------------------ |
| Windows | `Flint_x.y.z_x64-setup.exe` (or the `.msi`)                                                |
| Linux   | `.AppImage` (runs anywhere and updates itself), `.deb` (Debian, Ubuntu) or `.rpm` (Fedora) |
| macOS   | `.dmg` (Intel and Apple Silicon)                                                           |

On macOS the app isn't signed yet. The first time, open it, then go to **System Settings → Privacy & Security** and click **Open Anyway**.

Flint checks for updates when it starts and offers to install them (Windows installers and the AppImage). You can also run **Check for updates** from the command palette.

### 2. Open a vault

A **vault** is just a folder. Everything inside it that ends in `.md` is a note.

When Flint starts for the first time, it asks you for a folder:

- To start fresh, create an empty folder (for example `Documents/Notes`) and choose it.
- To use your Obsidian notes, choose your existing Obsidian vault. Flint ignores the `.obsidian` folder and keeps its own settings in a `.flint` folder, so both apps can share the vault.

Flint remembers the last vault and reopens it next time. To switch, use **Open another vault** in the command palette.

### 3. Write your first note

Press **Ctrl+N** to create a note. Its name is selected in the file tree: type a name such as `Welcome` and press Enter. Then click in the editor and type:

```markdown
# Welcome

This is **bold**, this is _italic_ and this is `code`.

- [ ] Learn the basics of Flint
- [x] Install it
```

Flint uses **live preview**: Markdown symbols disappear and text is formatted as you type, but the line under the cursor shows its raw Markdown so you can edit it. Click the checkbox to tick a task.

There's no Save button. Flint saves every note a moment after you stop typing.

Useful shortcuts while writing:

- **Ctrl+B** and **Ctrl+I** for bold and italic.
- **Ctrl+E** switches between editing and the reading view.
- Right-click selected text for formatting actions and spelling suggestions.

### 4. Link your notes

Linking notes is the heart of Flint. Type `[[` and a list of your notes appears. Pick one, or type a name that doesn't exist yet:

```markdown
Tomorrow I'll write about [[Project ideas]].
```

The link shows in color. Click it to open the note. If the note doesn't exist, clicking creates it.

Other link forms:

- `[[Project ideas#Next steps]]` links to a heading.
- `[[Project ideas|my ideas]]` shows different text.
- `![[Project ideas]]` embeds the whole note inside this one.

Open the right sidebar (the icon at the top right, or **Toggle right sidebar**) and choose **Backlinks**. It lists every note that links to the one you're reading. Renaming a note from the file tree updates every link that points to it.

### 5. Organize with folders and tags

- Right-click the file tree for **New note**, **New folder**, **Rename**, **Duplicate** and **Delete**. Drag files and folders to move them.
- Write `#tags` anywhere in a note, for example `#idea` or `#project/flint`. The **Tags** panel in the right sidebar lists them with their counts. Click a tag to find its notes.

### 6. Find anything

- **Ctrl+O** opens the **quick switcher**. Type part of a note's name and press Enter to open it.
- **Ctrl+Shift+F** searches the text of every note. Try `tag:#idea`, `"exact phrase"` or `path:Projects`. See [Search](search.md) for the full syntax.
- **Ctrl+P** opens the **command palette**, which lists every action in Flint with its shortcut. If you forget where something is, look for it here.

### 7. See how notes connect

Press **Ctrl+G** to open the **graph view**. Every note is a dot and every link a line between two dots. Drag to move around, scroll to zoom, and click a dot to open its note. The right sidebar also has a **local graph** that shows only the notes around the current one.

### 8. Work in tabs and panes

- **Ctrl+click** a link, or middle-click it, to open it in a new tab. **Ctrl+T** opens an empty tab and **Ctrl+W** closes one.
- Drag a tab to the edge of the editor to split it into panes, so you can see two notes side by side.
- **Alt+←** and **Alt+→** go back and forward, like in a browser.

### 9. Add pictures and files

Paste a screenshot (**Ctrl+V**) or drag an image or any other file from your file manager into a note. Flint saves it into the vault and inserts `![[image.png]]`, which shows the picture.

### 10. Make it yours

Open **Settings** with **Ctrl+,**:

- **Appearance:** light or dark theme, accent color, fonts and font size.
- **Editor:** editing mode, readable line length, Vim keys, spell checking.
- **Hotkeys:** change any shortcut.
- **Plugins:** install community plugins (for example Jira or Word count).

### Where to go next

- Keep a journal with [daily notes and templates](daily-notes-and-templates.md).
- Turn notes into tables and cards with [Bases](bases.md).
- Lay out ideas visually on a [Canvas](canvas.md).
- Export a note to [PDF or HTML](export-and-history.md), or bring back an older version of it.
