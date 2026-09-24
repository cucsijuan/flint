# Flint

An open-source, local-first Markdown knowledge base. Flint works on a plain folder of Markdown files and stays compatible with Obsidian vaults.

> **Status:** early development. Nothing is usable yet.

## Development

### Requirements

- [Node.js](https://nodejs.org/) 22+ and [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/) stable with `clippy` and `rustfmt`
- The [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for your platform

### Commands

```sh
pnpm install
pnpm tauri dev      # run the app
pnpm tauri build    # build installers
pnpm check          # type-check
pnpm lint
pnpm format
pnpm test
```

On distributions with a recent toolchain (e.g. Fedora), AppImage bundling needs `NO_STRIP=true pnpm tauri build`.

Rust checks run from `src-tauri/`:

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

## License

[AGPL-3.0-or-later](LICENSE). Plugins must be released under a compatible free license.
