# Daily notes and templates

[← Manual](README.md)

## Daily notes

A daily note is a note named after a date, such as `2026-10-01`, for a journal, a work log or a to-do list.

- **Open today's daily note**, or the calendar button at the top of the left sidebar, opens today's note and creates it if it doesn't exist yet.
- **Open previous daily note** (**Ctrl+Alt+←**) and **Open next daily note** (**Ctrl+Alt+→**) move to the nearest earlier or later daily note that exists, starting from the note you're on (or from today). On a daily note, the arrows in the note's header do the same.

### The calendar

**Show calendar**, or the **Calendar** tab of the right sidebar, shows a month with a dot under every day that has a daily note. Click a day to open its note, or to create it when there's none (**Ctrl+click** opens it in a new tab). The arrows change the month and **Today** comes back to the current one. Weeks start on the day that's usual where you live.

### Settings

**Settings → Daily notes and templates**:

- **Folder:** where new daily notes go, for example `Journal`. Empty means the vault root.
- **Date format:** the note's name, using [Day.js format tokens](https://day.js.org/docs/en/display/format). The default is `YYYY-MM-DD`. The setting shows today's name as you type.
- **Template:** a note whose text starts every new daily note, for example `Templates/Daily`. Template variables are filled in (see below).

These settings live in `.flint/daily-notes.json`, with the same keys as Obsidian's `daily-notes.json`.

## Templates

Templates are ordinary notes kept in one folder. Insert one to paste its text at the cursor with its variables filled in.

1. Create a folder for templates, for example `Templates`, and set it in **Settings → Daily notes and templates → Folder** (under **Templates**).
2. Write notes in it. For example, `Templates/Meeting.md`:

   ```markdown
   # {{title}}

   Date: {{date}} {{time}}

   ## Attendees

   ## Notes

   ## Action items

   - [ ]
   ```

3. In any note, run **Insert template** (**Ctrl+Shift+T**, or right-click → **Insert template**), then pick the template.

### Template variables

| Variable               | Becomes                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `{{title}}`            | the name of the note the template goes into                  |
| `{{date}}`             | today's date, as `YYYY-MM-DD`                                |
| `{{time}}`             | the current time, as `HH:mm`                                 |
| `{{date:dddd D MMMM}}` | today's date in any Day.js format, here `Thursday 1 October` |
| `{{time:HH:mm:ss}}`    | the current time in any format                               |

Template settings live in `.flint/templates.json`, with Obsidian's keys. Its `dateFormat` and `timeFormat` change what plain `{{date}}` and `{{time}}` produce.
