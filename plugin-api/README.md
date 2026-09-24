# Writing Flint plugins

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
  "license": "AGPL-3.0-or-later"
}
```

The `license` is an [SPDX expression](https://spdx.org/licenses/). Flint is AGPL-3.0-or-later, so plugins must use a compatible free license; Flint warns before enabling a plugin that doesn't.

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

For type hints, copy [`index.d.ts`](index.d.ts) next to your plugin and annotate `activate` with `/** @type {import('./index').ActivatePlugin} */`. See it for the full API and [`examples/word-count`](../examples/word-count) for a working plugin. To try it, copy the folder into your vault's `.flint/plugins/` and turn it on in Settings.

Plugins run inside Flint with the same access as the app itself. Only turn on plugins you trust.
