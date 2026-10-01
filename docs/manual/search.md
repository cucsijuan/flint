# Search

[← Manual](README.md)

**Ctrl+Shift+F**, or the **Search** tab of the left sidebar, searches the text of every note in the vault. Results update as you type. Each result shows the note and its matching lines, with the matches highlighted. Click a line to open the note at that line, or **Ctrl+click** it to open it in a new tab.

To search only the note you're editing, use **Ctrl+F** in the editor instead.

## Query syntax

Flint uses Obsidian's search syntax. Searches ignore upper and lower case unless you ask otherwise.

| Query                      | Finds notes that…                            |
| -------------------------- | -------------------------------------------- |
| `meeting notes`            | contain both words, anywhere in the note     |
| `"meeting notes"`          | contain that exact phrase                    |
| `meeting -draft`           | contain `meeting` but not `draft`            |
| `meeting OR call`          | contain either word                          |
| `(meeting OR call) budget` | contain `budget` and either of the other two |
| `/\d{4}-\d{2}-\d{2}/`      | match a regular expression (here, a date)    |

`OR` binds more loosely than the implicit AND, so `a b OR c` means `(a b) OR c`. Use parentheses to group terms differently.

## Operators

An operator narrows where a term, a quoted phrase, a regular expression or a group in parentheses must match.

| Operator           | Matches in…                                     | Example                 |
| ------------------ | ----------------------------------------------- | ----------------------- |
| `file:`            | the file name                                   | `file:2026`             |
| `path:`            | the file's path, folders included               | `path:Projects/Flint`   |
| `tag:`             | a tag, including its nested tags                | `tag:#project`          |
| `content:`         | the note's text only, not its name              | `content:flint`         |
| `line:`            | a single line (all terms on the same line)      | `line:(bug crash)`      |
| `block:`           | a single block (paragraph, list item…)          | `block:(todo urgent)`   |
| `section:`         | a single section (between two headings)         | `section:(budget 2026)` |
| `task:`            | a task, done or not                             | `task:call`             |
| `task-todo:`       | an unchecked task                               | `task-todo:call`        |
| `task-done:`       | a checked task                                  | `task-done:review`      |
| `match-case:`      | the text, with upper and lower case significant | `match-case:API`        |
| `ignore-case:`     | the text, ignoring case (the default)           | `ignore-case:api`       |
| `[property]`       | notes that have the property                    | `[status]`              |
| `[property:value]` | notes whose property contains the value         | `[status:draft]`        |

Operators combine with everything else: `path:Journal task-todo:call -tag:#done` finds open tasks that mention `call` in the Journal folder, in notes not tagged `#done`.

## Sorting results

The sort button offers:

- **File name (A to Z)** and **File name (Z to A)**.
- **Modified time (new to old)** and **Modified time (old to new)**.
- **Created time (new to old)** and **Created time (old to new)**.

The choice is remembered per vault.

## Search and replace

Open the replace field with the **Replace** button beside the search box.

1. Type what to find in the search box. Any query works, including operators and regular expressions.
2. Type the replacement in **Replace with…**.
3. Choose **Where to replace**:
   - **Current note**.
   - **Current note's folder**.
   - **Whole vault**.
4. Click **Replace all**, or use the button on a single result line (**Replace in this line**) to change only that line.

With a regular expression, the replacement can use its groups: `$1`, `$2`, and so on. Replacements go through the same saving as typing, so open editors update, and older text stays in each note's [version history](export-and-history.md#version-history).

## Searching from other places

- Clicking a `#tag` anywhere searches for `tag:#tag`.
- Clicking a tag in the **Tags** panel does the same.
- Searches can be bookmarked (see [Bookmarks](workspace.md#bookmarks)).
- The graph's color groups use search queries too.
