# Flint plugin template

A starting point for a [Flint](https://github.com/cucsijuan/flint) plugin in TypeScript. Copy this folder into a new repository, then:

```sh
npm install
npm run build   # writes main.js
```

## Trying it in a vault

1. Change `id`, `name`, `author` and `description` in `manifest.json`.
2. Create `<vault>/.flint/plugins/<id>/` and copy `main.js`, `manifest.json` and `styles.css` into it.
3. In Flint, open Settings → Plugins and turn the plugin on.

While developing, build straight into the vault and let Flint reload the plugin on every save:

```sh
FLINT_PLUGIN_DIR=/path/to/vault/.flint/plugins/my-plugin npm run dev
```

Then turn on **Reload plugins when their files change** in Settings → Plugins. `manifest.json` and `styles.css` still need copying once.

## The API

`src/main.ts` shows commands, a sidebar tab with an icon and a settings section. Types come from the [`flint-plugin-api`](https://www.npmjs.com/package/flint-plugin-api) package, and the full reference is in [its README](https://github.com/cucsijuan/flint/tree/main/plugin-api#readme). Use `flint.codemirror` instead of bundling CodeMirror, so your editor extensions share Flint's copy.

## Publishing

Pushing a tag that matches `version` in `manifest.json` (for example `1.0.0`) runs `.github/workflows/release.yml`, which attaches `main.js`, `manifest.json` and `styles.css` to a GitHub release. Then add your plugin to [flint-plugins](https://github.com/cucsijuan/flint-plugins) so others can install it from Flint.

Flint is AGPL-3.0-or-later; keep a compatible free license in `manifest.json`.
