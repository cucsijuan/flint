# Bases

[← Manual](README.md)

A base shows your notes as a database: a table, cards, a list or a map, built from their properties. Bases read the notes you already have. Nothing is copied: editing a value in a base writes it into the note's frontmatter.

Flint's bases use Obsidian's `.base` format, so bases made in either app work in both.

## Creating a base

- **Create new base** (command palette), or right-click the file tree → **New base**, creates `Untitled.base` with one table view and opens it.
- To put a base inside a note, write a `base` code block with the same YAML a `.base` file holds:

  ````markdown
  ```base
  filters: 'file.hasTag("book")'
  views:
    - type: table
      name: Books
      order: [file.name, author, rating]
  ```
  ````

- To embed an existing base file in a note, write `![[Books.base]]`.

You can edit a base from its toolbar, which writes the YAML for you, or write the YAML by hand. The toolbar only rewrites the keys it changes.

## The toolbar

| Button            | What it does                                                            |
| ----------------- | ----------------------------------------------------------------------- |
| View tabs         | switch between the base's views; **Add view** creates another           |
| **Sort**          | order rows by one or more properties, **Ascending** or **Descending**   |
| **Filter**        | show only the notes that match (see [Filters](#filters))                |
| **Group**         | **Group by** a property; each group gets a header and its own summaries |
| **Properties**    | choose and order the columns, and add **Formulas**                      |
| **View settings** | the view's **Name**, **Layout**, **Limit** and layout options           |
| **New**           | create a note that matches the filters, and open it                     |

## Views

A base can hold several views, each with its own layout, filters, sort, grouping and columns.

### Table

- Drag headers to reorder columns and drag their edges to resize them.
- Right-click a column header for **Sort ascending**, **Sort descending**, **Group by this property**, **Property type** (**Text**, **Number**, **Checkbox**, **Date**, **Date & time**, **List**) and **Hide column**.
- The **Summarize** menu at the bottom of each column picks a summary for it.
- Click a cell to edit the value in the note. **Enter** saves and **Escape** cancels. Checkboxes toggle with a click.
- Summaries:
  - Numbers: **Average**, **Min**, **Max**, **Sum**, **Range**, **Median** and **Stddev**.
  - Dates: **Earliest** and **Latest**.
  - Checkboxes: **Checked** and **Unchecked**.
  - Any column: **Empty**, **Filled** and **Unique**.
  - Custom formulas, defined in the file's `summaries`.

### Cards

A grid of cards, one per note, showing the chosen properties. **View settings → Image** picks a property holding an image (a link to an attachment or a URL) to use as each card's cover, and **Card size** sets the width.

### List

A compact list of notes with their chosen properties.

### Map

Pins on an OpenStreetMap map. **View settings → Coordinates** picks the property that holds each note's location, written as `latitude, longitude` (for example `location: "48.8584, 2.2945"`) or as a list of two numbers. Click a pin to open its note.

## Properties in a base

Columns can show three kinds of properties:

- **Note properties** from the frontmatter: `author`, `rating`, `status`…
- **File properties:**

  | Property                                      | Value                                              |
  | --------------------------------------------- | -------------------------------------------------- |
  | `file.name`                                   | the file name, with its extension                  |
  | `file.basename`                               | the name without the extension                     |
  | `file.path`                                   | the full path in the vault                         |
  | `file.folder`                                 | the folder                                         |
  | `file.ext`                                    | the extension                                      |
  | `file.size`                                   | the size in bytes                                  |
  | `file.ctime`, `file.mtime`                    | created and modified dates                         |
  | `file.tags`                                   | all the note's tags                                |
  | `file.links`, `file.backlinks`, `file.embeds` | its links, the notes linking to it, and its embeds |

- **Formulas**, computed for each row (see below).

Property types are shared by the whole vault (in `.flint/types.json`, like Obsidian's `types.json`), so a date stays a date in every base and in the properties form.

## Filters

The **Filter** button edits filters visually:

- Each filter is a property, an operator and a value, such as `status` **is** `done` or `rating` **≥** `4`.
- Filters live in groups: **All of the following are true**, **Any of the following is true**, or **None of the following are true**. Groups can be nested.
- **Edit as expression** turns a filter into a formula, such as `status == "done" && rating >= 4`.

Filters apply to **This view** or to **All views** of the base.

## Formulas

A formula computes a value for each row from its properties. Add one under **Properties → Formulas**, give it a name, and write an expression such as `price * quantity`. Formulas show as columns named `formula.<name>`.

Formulas use Obsidian's expression language:

- **Values:** numbers, `"text"`, `true`/`false`, lists `[1, 2]`, dates and durations.
- **Operators:** `+ - * / %`, comparisons `== != > < >= <=`, `&&`, `||` and `!`.
- **Properties:** by name (`rating`), as `note.rating` or `note["my property"]`, as `file.name`, and other formulas as `formula.total`.
- **Global functions:** `if(condition, then, else)`, `now()`, `today()`, `date("2026-10-01")`, `duration("3d")`, `link("Note")`, `file("Note.md")`, `list(value)`, `number(value)`, `min(…)`, `max(…)` and `random()`.
- **Methods** on each type:
  - Text: `.lower()`, `.contains("x")`, `.startsWith()`, `.replace()`, `.split()`, `.slice()`, `.trim()`, `.title()`…
  - Lists: `.contains()`, `.containsAny()`, `.containsAll()`, `.join()`, `.length`, `.sort()`, `.unique()`…
  - Dates: `.format("YYYY-MM")`, `.year`, `.month`, and arithmetic with durations such as `due - today()` or `now() + "1w"`.
  - Files: `file.hasTag("book")`, `file.hasLink("Note")`, `file.inFolder("Projects")`, `file.hasProperty("status")`.
  - Any value: `.isEmpty()`, `.isTruthy()`, `.isType("number")`, `.toString()`.

Obsidian's [Bases syntax reference](https://help.obsidian.md/bases/syntax) describes the language in full.

## Bases from plugins

Plugins can show their own data (for example Jira issues) with the same table, cards, list and map views, including sorting, grouping and summaries. See [Plugins](plugins.md).
