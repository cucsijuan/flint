# Workspace

[← Manual](README.md)

Flint's window has three areas:

- The **left sidebar**, with buttons at the top and the **Files**, **Search** and **Bookmarks** tabs.
- The **editor area** in the middle: tabs, split into as many panes as you like.
- The **right sidebar**, with panels about the active note.

Drag the borders between areas to resize them. The layout (tabs, splits, sizes and open notes) is saved per vault and restored the next time you open it.

## The left sidebar

The buttons at the top are:

- **New note**.
- **Open today's daily note**.
- **New folder**.
- **Open another vault**.
- **Settings**.

The vault's name is shown too; hover it to see the folder's full path.

Its tabs are:

- **Files:** the [file tree](vaults-and-files.md#the-file-tree).
- **Search:** [full-text search](search.md).
- **Bookmarks:** your [bookmarks](#bookmarks).

## Tabs

Each pane holds tabs. A tab shows a note, an image, a base, a canvas, the graph, or nothing (a new empty tab).

| Action                  | How                                                       |
| ----------------------- | --------------------------------------------------------- |
| Open in the current tab | click a note or link                                      |
| Open in a new tab       | Ctrl+click or middle-click a note or link                 |
| New empty tab           | **Ctrl+T**, or the **+** button                           |
| Close tab               | **Ctrl+W**, the tab's **×**, or middle-click the tab      |
| Next / previous tab     | **Ctrl+Tab** / **Ctrl+Shift+Tab**                         |
| Back / forward in a tab | **Alt+←** / **Alt+→**, or the arrows in the note's header |
| Reorder tabs            | drag a tab along the tab bar                              |

An empty tab offers shortcuts to create a note, open the quick switcher and more.

Right-click a tab for:

- **Close** and **Close others**.
- **Reveal in navigation** and **Show in system explorer**.
- **Split right** and **Split down**.

Each tab has its own history, so back and forward move through the notes you opened in that tab.

## Panes

Split the editor to see several things at once:

- **Split right** and **Split down**, from the command palette or a tab's context menu, open the current tab again in a new pane.
- **Drag a tab onto the edge** of a pane (left, right, top or bottom) to split it there, or onto another pane's tab bar to move it there.
- Drag the line between two panes to resize them.
- Closing a pane's last tab removes the pane.

The same note can be open in several panes. Edits in one show up in the others instantly, and each pane can have its own mode (for example, reading view on the left and editing on the right).

The pane you last clicked is the **active** one. The right sidebar, the note commands and plugins follow the active tab.

## The right sidebar

Show or hide it with **Toggle right sidebar** or the button at the right of the note's header. Its panels are about the active note:

| Panel              | Command             | Shows                                                                                                  |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------ |
| **Backlinks**      | Show backlinks      | notes linking here, and unlinked mentions ([more](links-and-graph.md#backlinks))                       |
| **Outgoing links** | Show outgoing links | this note's links, and notes it mentions without a link                                                |
| **Outline**        | Show outline        | the note's headings; click one to jump to it                                                           |
| **Properties**     | Show properties     | the note's frontmatter as a form ([more](editor.md#properties-frontmatter))                            |
| **Tags**           | Show tags           | every tag in the vault with its count, nested tags indented under their parent; click one to search it |
| **Local graph**    | Show local graph    | the notes around this one ([more](links-and-graph.md#the-local-graph))                                 |

Plugins can add their own panels here or in the left sidebar.

## The quick switcher

**Ctrl+O** opens the quick switcher, a list of every note, alias and attachment.

- Type a few letters from anywhere in the name. The search is fuzzy, so `prjfl` finds `Projects/Flint`.
- **↑**/**↓** move and **Enter** opens the note. **Ctrl+Enter** opens it in a new tab.
- **Shift+Enter** creates a note with the name you typed.
- **Escape** closes the switcher.

## The command palette

**Ctrl+P** opens the command palette. Every action in Flint, including the ones that plugins add, is a command. The palette lists the commands that make sense right now, each with its hotkey if it has one. Type to filter them, then press Enter to run one.

Any command can get a hotkey in **Settings → Hotkeys**. The [reference](reference.md#commands) lists every command.

## Bookmarks

Bookmarks keep the things you come back to one click away, in the **Bookmarks** tab of the left sidebar.

- **Notes:** **Bookmark or unbookmark current note** (command palette).
- **Headings:** hover a heading in the **Outline** panel and click the bookmark icon (**Bookmark this heading**).
- **Searches:** click the bookmark icon beside the search box (**Bookmark this search**).

In the Bookmarks tab:

- Click a bookmark to open it. A search bookmark runs the search again.
- Drag bookmarks to reorder them.
- **Remove bookmark** deletes one.

Bookmarks are stored in `.flint/bookmarks.json`, in the same format as Obsidian's `bookmarks.json`.
