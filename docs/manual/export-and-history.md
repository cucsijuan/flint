# Export and version history

[← Manual](README.md)

## Export to PDF

**Export to PDF** (command palette, or right-click a note in the file tree) opens a dialog:

- **Page size:** A3, A4, A5, Letter, Legal or Tabloid.
- **Orientation:** Portrait or Landscape.
- **Margins:** Default, Narrow, Wide or None.
- **Scale:** shrink or enlarge the content.
- **Include the note's name as a title:** print the note's name as a heading at the top. The title is skipped if the note already starts with the same heading.

Click **Export to PDF** and choose where to save the file. The PDF looks like the reading view: rendered Markdown, images, callouts, math, diagrams, embedded notes and syntax-highlighted code. Flint remembers your choices for next time.

On Windows and Linux, the PDF is produced directly. On macOS, the system print dialog opens for now; choose **Save as PDF** there.

## Export to HTML

**Export to HTML** (command palette, or right-click a note) saves the note as a single `.html` file that opens in any browser. Its images and styles are packed inside it, so you can email the file or put it anywhere.

## Export a website

**Export vault as a website** (command palette), or right-click a folder → **Export as a website**, turns every note in the vault or folder into an HTML page. Choose an empty folder for the result. You get:

- One page per note, in the same folder structure.
- Links between pages that work, and the images the notes use.
- An `index.html` page listing every note.

Open `index.html` in a browser, or upload the folder to any static web host.

## Version history

While you edit a note, Flint saves a snapshot of it every few minutes. Snapshots are kept on your computer, outside the vault, so they never clutter it or get synced.

**Open version history** (command palette, or right-click a note → **Version history**) opens the list of snapshots for the note, newest first:

- Click a version to compare it with the note as it is now. The differences are highlighted: **Only in this version** and **Only in the current note**.
- **Restore this version** puts that text back into the note. It's an ordinary edit, so **Ctrl+Z** in the editor undoes it.
- **Copy this version** copies its text, to take just a part of it.

History follows the note when you rename or move it in Flint.

### Recovering deleted notes

When you delete a note, Flint keeps its last version. **Recover deleted notes** (command palette) lists deleted notes that have saved versions. Pick one to see its versions and restore it to its old place.

### Settings

**Settings → Editor**:

- **Version history interval:** minutes between two snapshots of a note you're editing.
- **Version history length:** days snapshots are kept. Older ones are deleted automatically.

Snapshots live in Flint's data folder, separately for each vault:

- Linux: `~/.local/share/io.github.cucsijuan.flint/history`.
- Windows: `%APPDATA%\io.github.cucsijuan.flint\history`.
- macOS: `~/Library/Application Support/io.github.cucsijuan.flint/history`.
