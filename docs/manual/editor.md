# The editor

[← Manual](README.md)

Every note opens in the editor. Flint has three ways to show a note:

| Mode             | What you see                                                                             | Switch with                                       |
| ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Live preview** | Formatted text; the line or block under the cursor shows its Markdown so you can edit it | **Toggle live preview and source mode**           |
| **Source mode**  | Plain Markdown with syntax colors, nothing hidden                                        | **Toggle live preview and source mode**           |
| **Reading view** | The finished note, not editable as text (tasks and tables still react to clicks)         | **Ctrl+E**, or the book icon in the note's header |

**Settings → Editor → Editing mode** picks live preview or source mode as the default. The reading view is set for each tab, so you can read a note in one pane while editing it in another.

## Saving

Notes save automatically a moment after you stop typing. Files are written atomically, so a crash or power cut never leaves a note half written. The same note can be open in several tabs or panes: typing in one updates the others at once.

If a note changes on disk while it's open (for example because a sync tool updated it), Flint reloads it, unless you have edits that are still being saved.

## The note header

Above each note:

- **Back** and **forward** arrows for the tab's history.
- The note's title.
- **Previous** and **next daily note** buttons, on daily notes.
- A button that switches between the **reading view** and editing.
- A button that shows or hides the **right sidebar**.

## Writing and formatting

| Action               | Shortcut                                   |
| -------------------- | ------------------------------------------ |
| Bold                 | **Ctrl+B**                                 |
| Italic               | **Ctrl+I**                                 |
| Strikethrough        | command palette                            |
| Inline code          | command palette                            |
| Insert internal link | **Ctrl+K**: wraps the selection in `[[ ]]` |
| Move line up / down  | **Alt+↑** / **Alt+↓**                      |
| Undo / redo          | **Ctrl+Z** / **Ctrl+Shift+Z**              |
| Find in note         | **Ctrl+F**                                 |

Formatting shortcuts wrap the selection, or remove the formatting when the selection already has it.

- **Lists continue** when you press Enter. Press Enter on an empty item to end the list. **Tab** and **Shift+Tab** indent and outdent.
- **Moving lines** with Alt+↑/↓ carries a list item's sub-items, and a folded heading carries everything folded under it.
- **Pasting a URL over selected text** turns the text into a link: `[text](https://…)`.
- **Pasting or dropping images** saves them in the vault and embeds them (see [Attachments](vaults-and-files.md#attachments)).

### The context menu

Right-click in a note for Flint's menu, the same on every system:

- Spelling suggestions and **Add to the dictionary**, when you right-click a misspelled word.
- **Open link in new tab**, when you right-click a link.
- **Cut**, **Copy** and **Paste**. Paste works like Ctrl+V, files and images included.
- **Bold**, **Italic**, **Strikethrough**, **Code**, **Insert link** and **Insert template**. Inside a table cell they format the cell.

Text fields elsewhere in Flint (search, properties, settings) get Cut, Copy and Paste.

### Autocomplete

- `[[` suggests notes, aliases and attachments. It inserts the shortest link that still points to the right note.
- `[[Note#` suggests the note's headings, and `[[Note#^` its blocks.
- `[[^^` searches blocks across the whole vault.
- `#` suggests tags you've already used.

Use the arrow keys and Enter to pick a suggestion, or Escape to close the list.

## Live preview

Live preview renders Markdown in place:

- Headings, emphasis, links, tags, `==highlights==`, inline code and math look as they do in the reading view.
- Images, embedded notes, bases, canvases, tables, callouts, code blocks, math blocks and Mermaid diagrams show as blocks. When the cursor enters one, its Markdown source appears above it.
- Links open with a plain click. In source mode, **Ctrl+click** a link to open it in a new tab.
- Footnote references show as numbers. `%%comments%%` are hidden unless the cursor is on them.

### Tables

Tables are edited as a grid:

- Click a cell to edit it. **Tab** and **Shift+Tab** move to the next and previous cell, and **Enter** to the cell below. **Escape** leaves the table.
- Hover a row or a column to show its **grip**. Drag the grip to move the row or column. Click or right-click it for a menu:
  - **Add row above** and **Add row below**, **Move row up** and **Move row down**, **Delete row**.
  - **Add column before** and **Add column after**, **Move column left** and **Move column right**, **Delete column**.
  - **Align left**, **Align center** and **Align right**.
- Hover the table for **+** buttons on its right and bottom edges, which add a column or a row at the end.
- Formatting hotkeys work inside a cell: **Ctrl+B**, **Ctrl+I**, strikethrough, inline code and **Ctrl+K** for a link.

### Folding

- An arrow appears beside headings and list items that have content under them. Click it to fold or unfold.
- The commands **Toggle fold on the current line**, **Fold all headings and lists** and **Unfold all headings and lists** do the same from the keyboard (give them hotkeys in Settings).
- Folds are remembered for each note.
- In the reading view, headings have their own fold arrows.

### Readable line length

With **Settings → Editor → Readable line length** on, text keeps a comfortable width instead of filling the window. **Readable line width** sets that width in pixels, and tables and bases grow up to it. The command **Toggle readable line length** turns it on and off quickly.

## Properties (frontmatter)

Properties are YAML metadata at the very top of a note, between `---` lines:

```markdown
---
tags: [project, flint]
aliases: [Flint notes]
status: draft
due: 2026-10-15
published: false
---
```

Flint shows them as a form above the note. Each property has a type: **text**, **list**, **number**, **checkbox** or **date**. The type is shared by every note in the vault and stored in `.flint/types.json`.

- **Add properties to current note** creates the frontmatter.
- Click a value to edit it. Dates get a date picker and checkboxes a checkbox.
- **Settings → Editor → Properties in notes** shows them **Visible** (as a form), **Hidden**, or as **Source** (plain YAML).
- The **Properties** panel in the right sidebar (**Show properties**) always edits the active note's properties, whatever that setting says.

Two properties are special:

- **`tags`** adds tags to the note, just like `#tags` in the text.
- **`aliases`** gives the note other names. Links, autocomplete and the quick switcher find the note by them.

## Spell checking

Flint has its own spell checker, which works the same on every system. Misspelled words get a wavy red underline. Right-click one for suggestions, or **Add “word” to the dictionary** so it's accepted everywhere from then on.

Code, links' targets, tags, math, comments and frontmatter are never checked.

**Settings → Editor**:

- **Spell check** turns it on or off.
- **Spell-check languages** picks the languages to check against, as many as you like. With none picked, Flint uses your system's language.
- Each language's dictionary downloads once, the first time it's used, from the [dictionaries project](https://github.com/wooorm/dictionaries) (Hunspell dictionaries, the same family LibreOffice and Firefox use).

Dictionaries and your personal words live in Flint's data folder (see [Files Flint writes](reference.md#files-flint-writes)).

## Vim key bindings

**Settings → Editor → Vim key bindings** turns on Vim's modes and commands: normal, insert and visual modes, motions, operators, `:` commands, search and registers. Flint's own hotkeys keep working.

If you haven't used Vim, a short test:

1. Click in a note. You're in **normal mode**, where keys move instead of typing.
2. Press `i` to enter **insert mode** and type a few words. Press **Escape** to go back to normal mode.
3. Move with `h` `j` `k` `l`, jump by words with `w` and `b`, and to the start or end of the line with `0` and `$`.
4. `dd` deletes a line, `u` undoes it and `p` pastes it back.
5. Press `v` and move to select text, then `y` to copy it.
