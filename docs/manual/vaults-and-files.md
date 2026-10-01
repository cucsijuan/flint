# Vaults and files

[← Manual](README.md)

## What a vault is

A vault is an ordinary folder on your computer. Flint shows everything inside it in the file tree:

- **Notes:** files ending in `.md`.
- **Attachments:** images (`png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`, `bmp`, `avif`), PDFs, audio (`mp3`, `wav`, `ogg`, `m4a`), video (`mp4`, `webm`, `mov`), bases (`.base`) and canvases (`.canvas`).
- **Folders**, nested as deep as you like.

Other files stay in the folder untouched but don't show in Flint. Hidden files and folders, whose names start with a dot (`.obsidian`, `.git`, `.flint`, `.trash`), are skipped everywhere: the tree, search, links and the graph.

Flint never uses a private format for your notes. You can edit them with any other editor, sync them with any tool (Git, Syncthing, Dropbox, OneDrive…) or open them in Obsidian. When a file changes outside Flint, the tree, the index and any open editor update on their own.

## Opening and switching vaults

- The first time you start Flint, click **Open folder** and choose a folder.
- Flint reopens the last vault on startup.
- **Open another vault** (command palette) switches to a different folder.
- From a terminal, `flint /path/to/folder` opens that folder as the vault.

Each vault keeps its own settings, layout, plugins and bookmarks in a hidden `.flint` folder inside it. See [Files Flint writes](reference.md#files-flint-writes).

## The file tree

The file tree is the **Files** tab of the left sidebar (**Show file explorer**).

- Click a folder to open or close it, and click a note to open it. **Ctrl+click** or middle-click opens it in a new tab.
- Notes show without their `.md` extension; bases and canvases show a table or board icon.
- **Right-click** an empty spot or a folder for **New note**, **New base**, **New canvas** and **New folder**.
- **Right-click** a file for **Duplicate**, **Version history**, **Export to PDF**, **Export to HTML**, **Rename**, **Show in system explorer** and **Delete**. A folder also offers **Export as a website**.
- **Double-click** a name to rename it. Press Enter to confirm or Escape to cancel.
- **Drag** files and folders onto a folder, or onto a note inside it, to move them there.
- **Reveal current file in navigation** (command palette) opens the folders down to the active note and highlights it.

New notes are called `Untitled`, `Untitled 1` and so on, with the name selected so you can type over it. **Ctrl+N** creates a note in the root of the vault.

### Renaming and moving

When you rename or move a note or a folder, Flint can rewrite every link that points to it. **Settings → Editor → Update links on rename** decides what happens:

- **Ask** shows how many links will change and lets you choose.
- **Always** updates them without asking.
- **Never** leaves links as they are.

Relative Markdown links inside a moved note (`[text](../other.md)`) are always fixed, because the move would break them.

### Deleting

**Delete** moves the file or folder to your system's trash after asking you to confirm, so it can be restored from there. Flint also keeps the note's last version, so you can bring it back with **Recover deleted notes** (see [Version history](export-and-history.md#version-history)).

## Attachments

### Adding images

- **Paste** an image (a screenshot or a copied image file) into a note with **Ctrl+V**.
- **Drag** image files from your file manager into a note.

Flint copies the file into the vault and inserts a link such as `![[Pasted image 20261001093000.png]]`. **Settings → Editor → Attachment location** decides where it goes:

- **Vault root**.
- **Same folder as the note**.
- **"attachments" folder**, at the root of the vault.

Copied images keep their file name. Screenshots get a `Pasted image` name with the date and time.

### Opening attachments

- Images open in their own tab.
- `.base` files open as a base and `.canvas` files as a canvas.
- Other files (PDFs, audio, video) open in your system's default app.

To show an attachment inside a note, embed it: `![[photo.jpg]]` shows the image, and `![[song.mp3]]` or `![[talk.mp4]]` show a player in the reading view. Other files, such as `![[paper.pdf]]`, show as a link. See [Embeds](markdown.md#embeds).
