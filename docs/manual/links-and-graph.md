# Links and the graph

[← Manual](README.md)

## Creating links

- Type `[[` and pick a note from the suggestions. Keep typing to filter them.
- Select some text and press **Ctrl+K** to wrap it in `[[ ]]`.
- Type the name of a note that doesn't exist yet: the link shows as unresolved, and clicking it creates the note.
- Standard Markdown links work too: `[text](Folder/Note.md)`. Spaces in the path are written as `%20`, and relative paths such as `../Note.md` are resolved from the note's folder.

See the [Markdown reference](markdown.md#links) for every link form.

## How links find their note

Flint resolves links exactly like Obsidian, ignoring upper and lower case:

1. **An exact path** from the vault root: `[[Projects/Flint/Roadmap]]`.
2. **A note name**, or the end of a path: `[[Roadmap]]` or `[[Flint/Roadmap]]`. When several notes match, the one in the same folder as the linking note wins, then the one with the shortest path.
3. **An alias** from a note's `aliases` property.

When you pick a note from autocomplete, Flint writes the shortest link that still points to that note: just the name when it's unique, or enough of the path to tell it apart.

## Opening links

| Where                | Open  | Open in a new tab                                                                                  |
| -------------------- | ----- | -------------------------------------------------------------------------------------------------- |
| Live preview         | click | Ctrl+click or middle-click                                                                         |
| Source mode          | —     | Ctrl+click or middle-click                                                                         |
| Reading view, embeds | click | Ctrl+click or middle-click                                                                         |
| Anywhere             | —     | right-click → **Open link in new tab**, or the command **Open link under the cursor in a new tab** |

Links to headings scroll to the heading and links to blocks scroll to the block, highlighting it for a moment. Web links open in your browser.

## Backlinks

**Show backlinks**, or the **Backlinks** tab of the right sidebar, lists every note that links to the active note, with the line each link sits on. Click a note's name to open it. Canvases that include the note are listed too.

Under the links, **Unlinked mentions** lists notes that write this note's name or one of its aliases as plain text. Click **Link** to turn a mention into a real link.

## Outgoing links

**Show outgoing links**, or the **Outgoing links** tab, lists every link in the active note and says which ones point to notes that don't exist. Below them, it lists the other notes whose names appear in this note without a link, each with a **Link** button.

## Renaming and moving updates links

When you rename or move a note, attachment or folder in Flint, the links pointing to it can be rewritten (see [Renaming and moving](vaults-and-files.md#renaming-and-moving)). Only the target part of each link changes: headings, block ids and display text stay as they were, and each link keeps its style (wikilink or Markdown link, name or path). Canvases that show the note are updated too.

Renames made outside Flint (in a file manager, for example) don't update links.

## The graph view

**Ctrl+G** opens the global graph in its own tab.

- **Dots** are notes. Their size grows with the number of links.
- **Lines** are links between notes. A link counts once, whichever direction it goes.
- Optional dots for **tags** (`#tag`) connect to the notes that use them, and dots for **missing notes** stand for unresolved links.

Working with the graph:

- **Scroll** to zoom and **drag the background** to pan.
- **Drag a dot** to pull it around. The layout moves like a physical simulation.
- **Hover a dot** to highlight it and its neighbors.
- **Click a dot:**
  - a note opens it,
  - a tag searches for it,
  - a missing note creates it.

### Graph settings

The gear button opens the graph settings:

- **Filters:**
  - **Filter by path…** shows only notes whose path contains the text.
  - **Tags** shows tag dots.
  - **Missing notes** shows unresolved links.
  - **Orphans** shows notes without any links.
- **Groups:** color the notes that match a search query, such as `tag:#project` or `path:Journal`. Groups are checked in order, and the first match gives the color.
- **Forces:** **Center force**, **Repel force**, **Link force** and **Link distance** change how the layout spreads. The arrow button restores the defaults.

Graph settings are saved per vault in `.flint/graph.json`, in the same format as Obsidian's.

### The local graph

**Show local graph**, or the **Local graph** tab of the right sidebar, shows only the active note and the notes around it. **Depth** (1 to 3) sets how many links away it reaches. It follows you as you move between notes.
