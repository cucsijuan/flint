# Writing Flint plugins

The API's TypeScript types are on npm, versioned with Flint:

```sh
npm install --save-dev flint-plugin-api
```

```ts
import type { ActivatePlugin } from 'flint-plugin-api'
```

A plugin is a folder inside a vault's `.flint/plugins/` directory:

```
.flint/plugins/my-plugin/
├─ manifest.json
├─ main.js
└─ styles.css   (optional)
```

`manifest.json`:

```json
{
  "id": "my-plugin",
  "name": "My plugin",
  "version": "1.0.0",
  "author": "You",
  "description": "What it does.",
  "license": "AGPL-3.0-or-later",
  "minAppVersion": "0.12.0"
}
```

The `license` is an [SPDX expression](https://spdx.org/licenses/). Flint is AGPL-3.0-or-later, so plugins must use a compatible free license; Flint warns before enabling a plugin that doesn't. `minAppVersion` is optional: older versions of Flint refuse to load the plugin and say which version it needs.

`main.js` is an ES module whose default export receives the Flint API:

```js
export default function activate(flint) {
  flint.commands.register({
    id: 'hello',
    name: 'Say hello',
    run: () => flint.ui.notice('Hello from my plugin'),
  })
}
```

Everything registered through the API (commands, editor extensions, sidebar tabs, listeners) is removed automatically when the plugin is turned off. `activate` may also return a cleanup function for anything else.

Use `flint.codemirror` instead of bundling your own copy of CodeMirror; two copies in the same editor break it.

To talk to a web service, use `flint.http.request()`: it runs in Flint's backend, so the server doesn't have to allow the app's origin (CORS), and it trusts certificates from the system's store. Keep tokens and passwords in `flint.secrets`, which stores them in the system's keychain instead of the vault. `flint.ui.renderDataView()` shows your own rows with the views of Bases (table, cards, list and map) along with their filters, sorting and summaries. With `onEdit` its cells become editable, and `choices` turns a cell's text field into a dropdown of the values it accepts.

For type hints, copy [`index.d.ts`](index.d.ts) next to your plugin and annotate `activate` with `/** @type {import('./index').ActivatePlugin} */`. See it for the full API and [`examples/word-count`](../examples/word-count) for a working plugin. To try it, copy the folder into your vault's `.flint/plugins/` and turn it on in Settings.

Plugins run inside Flint with the same access as the app itself. Only turn on plugins you trust.
