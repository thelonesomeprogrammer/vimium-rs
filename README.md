# vimium-rs

A Manifest V3, keyboard-first Chrome extension scaffold powered by a Rust + WebAssembly core and JavaScript runtime integration.

## 1) Project structure overview

```text
vimium-rs/
├── Cargo.toml                  # Rust WASM crate config
├── src/
│   └── lib.rs                  # Hint/state/regex logic in Rust
├── extension/
│   ├── background.js           # MV3 service worker for tabs/tab groups
│   └── content.js              # Key handling + DOM/UI + WASM bridge
├── public/
│   └── manifest.json           # MV3 manifest copied to dist/
├── vite.config.js              # JS bundling (content/background entries)
└── package.json                # npm scripts + vite dependency
```

## 2) `manifest.json`

Located at `/home/runner/work/vimium-rs/vimium-rs/public/manifest.json`.

## 3) Rust (`src/lib.rs`) logic

Located at `/home/runner/work/vimium-rs/vimium-rs/src/lib.rs`.

Includes:
- `VimiumCore` mode/state handling
- Hint generation + prefix filtering
- Safe regex compilation/matching via `regex::RegexBuilder`
- Unit tests for hint and regex behavior

## 4) JavaScript Content Script (`content.js`)

Located at `/home/runner/work/vimium-rs/vimium-rs/extension/content.js`.

Includes:
- Vim-style navigation (`j`, `k`, `h`, `l`, `d`, `u`, `gg`, `G`)
- Hint mode (`f`) with DOM scanning and Rust-driven hint labels/filtering
- Regex command palette (`/` or `?`) with Rust regex matching
- WASM module bootstrap compatible with MV3 extension URLs

## 5) Background Script (`background.js`)

Located at `/home/runner/work/vimium-rs/vimium-rs/extension/background.js`.

Includes:
- Next/previous tab (`Shift+J/K` message targets)
- Group current tab
- Switch to group by title
- Open tab search by title/URL

## 6) Build and installation steps

1. Install prerequisites:
   - Rust toolchain
   - `wasm-pack`
   - Node.js 18+
2. Install JS dependencies:
   - `npm install`
3. Build bundled extension assets:
   - `npm run build`
4. Build output:
   - `/home/runner/work/vimium-rs/vimium-rs/dist`
5. Load in Chrome:
   - `chrome://extensions` → enable Developer mode
   - Click **Load unpacked**
   - Select `/home/runner/work/vimium-rs/vimium-rs/dist`
