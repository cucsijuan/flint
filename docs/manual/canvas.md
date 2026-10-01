# Canvas

[← Manual](README.md)

A canvas is an endless board where you lay out cards and connect them with arrows: notes, images, web pages and free text, grouped and colored however you like. Use it to plan projects, map ideas or build mood boards.

Canvases are `.canvas` files in the open [JSON Canvas](https://jsoncanvas.org) format, the same one Obsidian uses, so a canvas made in either app opens in the other.

## Creating a canvas

- **Create new canvas** (command palette), or right-click the file tree → **New canvas**, creates `Untitled.canvas` and opens it.
- `.canvas` files appear in the file tree with a board icon and open in a tab.
- Embed a canvas in a note with `![[Board.canvas]]`. The embedded canvas can be edited in place.

## Moving around

| Action        | How                                                                            |
| ------------- | ------------------------------------------------------------------------------ |
| Pan           | scroll, drag with the middle or right mouse button, or hold **Space** and drag |
| Zoom          | **Ctrl+scroll**, pinch on a touchpad, or the zoom buttons                      |
| Zoom to fit   | the **Zoom to fit** button                                                     |
| Jump anywhere | click or drag in the **minimap** (bottom right)                                |

## Cards

There are four kinds of cards:

| Card          | Shows                                            | Add it with                                         |
| ------------- | ------------------------------------------------ | --------------------------------------------------- |
| **Text**      | Markdown you write in the card itself            | double-click empty space, or **Add card**           |
| **Note/file** | a note from the vault, an image, or another file | drag it from the file tree, or **Add note or file** |
| **Web page**  | a page's title, description and preview image    | **Add web page**, or paste a URL                    |
| **Group**     | a labeled area that holds other cards            | **Group**, or **Group selection**                   |

The toolbar at the top left holds **Add card**, **Add note or file**, **Add web page**, **Group**, **Undo**, **Redo**, **Zoom in**, **Zoom out**, **Zoom to fit**, **Search** and **Export as PNG**. Right-click empty space for the same actions plus **Export as SVG**.

### Text cards

- **Double-click** a text card, or select it and press **Enter**, to edit it. You get Flint's full editor: live preview, autocomplete for `[[links]]` and `#tags`, formatting shortcuts.
- Click outside the card or press **Escape** to stop editing.
- Links and embeds in the text work as in a note. Checkboxes can be ticked without editing.
- **Convert to note** (right-click the card) saves the text as a new note in the canvas's folder, named after its first line, and turns the card into a note card.

### Note and file cards

- A note card shows the note, rendered. The note's name sits above the card; click it to open the note (**Ctrl+click** for a new tab).
- **Double-click** the card to edit the note right there. Edits go into the note itself and appear in any tab that has it open.
- A card can show just one section of a note, when its file points to a heading (`subpath` in the file).
- Image cards show the image. Other files show their name; double-click to open them.
- **Add note or file** opens a picker with every note and attachment in the vault.

### Web page cards

- A web page card shows the page's title, description, site and preview image, fetched when the card appears.
- **Double-click** the card to open the page in your browser.
- **Edit** (right-click) changes its address.

### Groups

- A group is a labeled area behind other cards. Moving the group moves every card inside it.
- **Double-click** the label, or right-click → **Edit label**, to rename the group.
- **Group selection** (right-click selected cards, or the **Group** button) draws a group around them.

## Editing the board

| Action                 | How                                                                     |
| ---------------------- | ----------------------------------------------------------------------- |
| Select                 | click a card; **Shift**, **Ctrl** or **Ctrl+A** add more                |
| Select an area         | drag on empty space                                                     |
| Move                   | drag cards; they snap to the grid                                       |
| Resize                 | select a card and drag its edges or corners                             |
| Connect two cards      | hover a card and drag from one of the dots on its sides to another card |
| Delete                 | **Delete** or **Backspace**, or right-click → **Delete**                |
| Undo / redo            | **Ctrl+Z** / **Ctrl+Shift+Z** (or **Ctrl+Y**)                           |
| Copy, cut, paste       | **Ctrl+C**, **Ctrl+X**, **Ctrl+V**                                      |
| Deselect, stop editing | **Escape**                                                              |

Pasting:

- Cards copied from a canvas paste as new cards, with the connections between them, into the same or another canvas.
- Plain text pastes as a new text card.
- A web address pastes as a web page card.

### Colors

Right-click a card or a connection and pick a color from the swatches: red, orange, yellow, green, cyan, purple, or none. With several cards selected, the color applies to all of them.

### Connections

Right-click a connection to:

- **Edit label**: the text shown in the middle. You can also double-click an existing label.
- Choose **One arrow**, **Arrows on both ends** or **No arrows**.
- Pick a color, or **Delete** it.

Connections from other apps that don't say which sides they attach to follow the cards as you move them.

## Searching a canvas

**Ctrl+F**, or the **Search** button, opens a search box at the top right. It searches the text of text cards, the names of files, the addresses of web pages and the labels of groups. **Enter** jumps to the next match and **Shift+Enter** to the previous one. **Escape** closes the box.

## Exporting

**Export as PNG** (toolbar or right-click) and **Export as SVG** (right-click) save an image of the whole canvas into the vault, in the attachment folder (see [Attachments](vaults-and-files.md#attachments)), named after the canvas.

## Canvases and links

Canvases take part in the vault's links:

- A note shown on a canvas lists the canvas in its **Backlinks** panel.
- The graph shows canvases as dots, connected to the notes on them.
- Renaming or moving a note updates the canvases that show it.
- `[[Board.canvas]]` links to a canvas, and clicking the link opens it.
