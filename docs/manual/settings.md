# Settings and customization

[← Manual](README.md)

Open **Settings** with **Ctrl+,**, the gear button at the top of the left sidebar, or **Open settings** in the command palette. Every section except **General** belongs to the open vault and is saved in its `.flint` folder, so each vault can look and behave differently.

## Editor

| Setting                      | What it does                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Editing mode**             | **Live preview** hides Markdown syntax outside the cursor; **Source mode** shows it all                    |
| **Readable line length**     | keeps lines at a comfortable width instead of filling the window                                           |
| **Readable line width**      | how wide notes, tables and bases get while readable line length is on, in pixels                           |
| **Vim key bindings**         | edit with Vim's modes and commands ([more](editor.md#vim-key-bindings))                                    |
| **Properties in notes**      | frontmatter above a note: **Visible**, **Hidden** or **Source**                                            |
| **Update links on rename**   | **Ask**, **Always** or **Never** ([more](vaults-and-files.md#renaming-and-moving))                         |
| **Version history interval** | minutes between saved versions of a note ([more](export-and-history.md#version-history))                   |
| **Version history length**   | days versions are kept                                                                                     |
| **Attachment location**      | where pasted or dropped images go: **Vault root**, **Same folder as the note** or **"attachments" folder** |
| **Spell-check languages**    | on Linux, the languages to check                                                                           |

## Appearance

| Setting          | What it does                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Theme**        | **System** follows your operating system; **Light** and **Dark** stay fixed                          |
| **Accent color** | the color of links, selections and highlights; the reset button goes back to the theme's accent      |
| **Font size**    | text size in notes, in pixels                                                                        |
| **Text font**    | the font for notes; type to search the fonts installed on your computer. Empty means the system font |
| **Code font**    | the font for code blocks and inline code; monospaced fonts are listed first                          |

### CSS snippets

CSS snippets let you restyle anything in Flint with your own CSS.

1. Click **Open snippets folder** (it's `.flint/snippets` in your vault).
2. Add a `.css` file, for example `headings.css`, which colors headings in the reading view:

   ```css
   .markdown h1 {
     color: var(--accent);
     letter-spacing: 0.02em;
   }
   ```

3. Click **Reload snippets**, then turn the snippet on with its switch.

Snippets reload when you click **Reload snippets**. Useful hooks for them:

- Flint's colors are CSS variables on `:root`: `--background`, `--background-secondary`, `--text`, `--text-muted`, `--text-faint`, `--accent`, `--border`, `--hover`, `--selected`, `--code-background`, and the `--graph-*` colors of the graph. Colors use `light-dark()`, so one value can serve both themes.
- Rendered notes use the `.markdown` class, and the editor uses CodeMirror's `.cm-editor`.
- Editor tabs have the class `workspace-tab`, plus `is-active` on the selected one.

## Hotkeys

Every command can have a keyboard shortcut, including the ones plugins add.

- **Filter commands…** finds a command by name.
- **Set hotkey** (the + button) waits for you to press a shortcut. **Esc** cancels.
- **Remove hotkey** clears it, and **Restore default** brings back Flint's default.
- A warning shows when two commands share a shortcut (**Also used by …**).

Custom hotkeys are saved in `.flint/hotkeys.json`, in Obsidian's format. See the [list of default hotkeys](reference.md#default-hotkeys).

## Daily notes and templates

See [Daily notes and templates](daily-notes-and-templates.md).

## Plugins

Turn installed plugins on and off, and browse and install community plugins. Plugins with settings add their own sections below the built-in ones. See [Plugins](plugins.md).

## General

These settings belong to the app, not to a vault:

- **Check for updates:** look for a new version of Flint when it starts. You can always check by hand with **Check for updates** in the command palette.

## Graph settings

The graph's filters, color groups and forces are set from the graph itself (see [Graph settings](links-and-graph.md#graph-settings)) and saved in `.flint/graph.json`.
