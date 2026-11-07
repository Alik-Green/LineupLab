# Building LineupLab

## Portable core (Linux/macOS/Windows)

```bash
cargo test --workspace --lib --bins --tests
cargo run -p lineuplab-core --bin lineuplab-pack -- inspect fixtures/generated/legacy-sample.zip
```

The core has no window-system or Valorant dependency. Windows capture/hotkey/overlay adapters live in the Tauri shells behind `#[cfg(windows)]`; Linux tests use mocks.

## Shared UI

```bash
npm install
npm run typecheck
npm test
npm run dev            # browser demo with synthetic placeholders (port 5173)
npm run build          # desktop frontend
npm run build:mobile   # Android companion frontend (browse-only)
```

## Windows desktop (Tauri 2)

Prerequisites: Rust stable, Node 22+, Visual Studio Build Tools (MSVC + Windows SDK), WebView2 runtime.

```bash
npm install
npm run tauri:desktop dev
npm run tauri:desktop build       # NSIS installer under desktop/src-tauri/target/release/bundle
```

Linux → Windows cross-build (less tested; CI is authoritative):

```bash
rustup target add x86_64-pc-windows-msvc
cargo install cargo-xwin --locked
# LLVM/lld/llvm-rc and NSIS must be on PATH
npm run tauri:desktop build -- --runner cargo-xwin --target x86_64-pc-windows-msvc
```

### Sandbox status (2026-11-07)

The desktop shell source/config is complete, but this environment cannot compile it yet:

- `crates.io` / `static.rust-lang.org` egress is blocked; the offline vendor cache used for the core does not contain Tauri/wry/tao. Online `cargo check` fails with TLS EOF while updating the crates.io index.
- The Windows MSVC target stdlib and `cargo-xwin`/Windows SDK are not installed; cross-build is attempted and reported in the final milestone.
- GitHub Actions Windows/Ubuntu workflows are the authoritative compile/test path for the shell.

No Riot art is bundled. Icons are synthetic LineupLab marks. Agent/map art is fetched and cached at runtime.

## Android companion

See the mobile milestone: JDK 17+, Android SDK/NDK, `npm run tauri:mobile android build`. Browse-only, min SDK 26.
