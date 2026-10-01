# Plugins

[← Manual](README.md)

Plugins add features to Flint: commands, sidebar panels, editor behavior, rendered code blocks, settings. They're installed per vault, in the vault's `.flint/plugins` folder, and each one is turned on separately.

## A word on trust

A plugin runs inside Flint with the same powers as Flint itself: it can read and change every note in the vault and reach the internet. The first time you turn a plugin on, Flint asks you to confirm. Only turn on plugins you trust, ideally ones whose source code is public.

Flint also warns when a plugin's license isn't compatible with Flint's license (AGPL-3.0-or-later). The warning doesn't block the plugin.

## Installing community plugins

1. Open **Settings → Plugins** and click **Browse community plugins**.
2. The list comes from the [flint-plugins registry](https://github.com/cucsijuan/flint-plugins). Each entry shows its description, author and license, plus a link to its repository.
3. Click **Install**. Flint downloads the plugin from its latest GitHub release into `.flint/plugins/<id>`.
4. Back in the installed list, turn the plugin on.

When a newer version is released, the community list shows **Update to x.y.z** for it.

## Managing installed plugins

**Settings → Plugins** lists the plugins in this vault's `.flint/plugins` folder:

- The switch turns a plugin on or off. Turning it off removes everything it added right away: commands, panels, editor extensions.
- Plugins with settings get their own section in the list on the left of the Settings window, named after the plugin.
- **Reload plugins** reads the folder again, after you copy a plugin in by hand.

## Official plugins

These plugins are maintained with Flint, in [flint-official-plugins](https://github.com/cucsijuan/flint-official-plugins):

| Plugin         | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Jira**       | Jira issues in your notes: ` ```jira ` blocks with a JQL query shown as a table (or cards, list, map), a **My issues** sidebar panel, editing fields and status with changes sent only when you click **Push changes** (if the issue changed on the server, the server wins), creating issues, comments and worklogs. Works with Jira Cloud (email + API token) and Server/Data Center (personal access token); tokens are stored in your system's keychain. |
| **Profiler**   | timelines of profiling captures (Perfetto / Chrome Trace Event JSON) in ` ```profiler ` blocks, with threads, nested zones, frames, search and range selection; huge captures can be split so only the visible part is loaded                                                                                                                                                                                                                                |
| **Word count** | word and character counts for the current note, and a command that inserts today's date                                                                                                                                                                                                                                                                                                                                                                      |
| **Counter**    | turns ` ```counter ` code blocks into a button that counts clicks, saved in the note itself                                                                                                                                                                                                                                                                                                                                                                  |

Each plugin's README in that repository explains how to use it.

## Writing a plugin

A plugin is a folder with three files:

- `manifest.json`:

  ```json
  {
    "id": "my-plugin",
    "name": "My plugin",
    "version": "1.0.0",
    "author": "Your name",
    "description": "What your plugin does, in one sentence.",
    "license": "AGPL-3.0-or-later",
    "minAppVersion": "0.12.0"
  }
  ```

- `main.js`: an ES module whose default export receives the plugin API. It can return a function that runs when the plugin is turned off:

  ```js
  export default function activate(flint) {
    flint.commands.register({
      id: 'hello',
      name: 'Say hello',
      run: () => flint.ui.notice(`Hello from ${flint.workspace.activeNote() ?? 'Flint'}!`),
    })
  }
  ```

- `styles.css` (optional): styles loaded while the plugin is on.

Put the folder in `<vault>/.flint/plugins/<id>/`, click **Reload plugins** and turn it on.

### What the API offers

| Area               | Members                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flint.commands`   | `register` a command, with an optional hotkey; it appears in the palette and in Settings → Hotkeys                                                                   |
| `flint.editor`     | `registerExtension` (any CodeMirror 6 extension), `activeView`, `replaceSelection`                                                                                   |
| `flint.vault`      | `list`, `read`, `write`, `create`, and `onChange` for file changes                                                                                                   |
| `flint.workspace`  | `activeNote`, `openNote`, `onNoteOpen`                                                                                                                               |
| `flint.ui`         | `notice`, `openUrl`, `registerSidebarTab` (with a Lucide icon), `registerSettingsTab`, `renderDataView` (Flint's table, cards, list and map views for your own rows) |
| `flint.markdown`   | `registerPostProcessor` and `registerCodeBlockProcessor` for rendered Markdown; processors know their source lines and can edit them                                 |
| `flint.http`       | `request`: HTTP requests made by Flint's backend, without CORS limits and trusting the system's certificates                                                         |
| `flint.secrets`    | `get`, `set`, `delete`: secrets in the system keychain, separate for each plugin                                                                                     |
| `flint.storage`    | `load` and `save` the plugin's data (in its folder's `data.json`)                                                                                                    |
| `flint.codemirror` | Flint's own CodeMirror modules (`state`, `view`, `language`, `autocomplete`), so plugins don't bundle their own copy                                                 |

Every registration is tracked, so turning the plugin off undoes it without extra code.

### TypeScript and the template

- The types are published on npm as [`flint-plugin-api`](https://www.npmjs.com/package/flint-plugin-api). Its README is the full API reference.
- [`examples/plugin-template`](../../examples/plugin-template) is a ready TypeScript project with a build, a release workflow and examples of a command, a sidebar tab and a settings section.
- For development, build straight into a vault's plugin folder and turn on **Settings → Plugins → Reload plugins when their files change**. Flint reloads the plugin every time its files change.

### Publishing

Attach `main.js`, `manifest.json` and `styles.css` to a GitHub release (the template's workflow does this when you push a tag), then open a pull request adding your plugin to [flint-plugins](https://github.com/cucsijuan/flint-plugins). Several plugins can share one repository, each released with its own tag prefix. Plugins must use a license compatible with the AGPL.
