# LineupLab — final completion & limitations report

Date: 2026-11-07 · Branch: `arena/e082cc85-lineuplab`

## Deliverables

| Area | Status | Evidence |
|---|---|---|
| Portable Rust core (SQLite + SHA-256 media, catalog cache/retry/offline, modes, geometry, state machine) | Implemented | `core/`, 28 Rust tests |
| Legacy ZIP pack import/export (sole format), safe unzip, tolerant validation, conflicts/undo, canonical circles, lossless unknown/string forms, WebP dual export | Implemented | `core/src/pack.rs`, `docs/PACK_FORMAT.md`, 12 pack tests + 13 synthetic fixtures |
| Shared UI browse/create/annotation editor, virtualized grid, minimap, drafts, undo/redo | Implemented | `ui/`, 13 UI tests, typecheck + builds |
| Alt hotkeys, fast capture pipeline, overlay state | Implemented (portable + Windows adapter) | `core/src/hotkeys.rs`, `overlay.rs`, `capture.rs`, `docs/HOTKEYS.md`, 6 desktop-feature tests |
| Tauri 2 Windows desktop shell + overlay window + commands | **Compiles and bundles in CI** | CI `desktop-windows` success; `windows-installer` artifact (NSIS, ~7.7 MB) |
| LAN sync server/client, pairing, mDNS, tombstones, deterministic conflicts | Implemented | `core/src/server.rs`, `sync.rs`, `docs/SYNC.md`, 4 sync tests |
| Tauri 2 Android browse-only companion, discovery/pair/pull sync, min SDK 26 | **APK built in CI** | CI `Android APK` success; `android-apk` artifact (~29.6 MB) |
| CI Windows/Ubuntu + Android, README/BUILD/PACK_FORMAT/WINDOWS_TEST_PLAN/DECISIONS/PROGRESS | Complete | `.github/workflows/`, `docs/` |

### Authoritative CI runs (green)

- CI: https://github.com/Alik-Green/LineupLab/actions/runs/42388911808 — `core-ui-ubuntu`, `desktop-ubuntu`, `desktop-windows` all success. Artifacts: `windows-installer`, `frontend-dist`.
- Android: https://github.com/Alik-Green/LineupLab/actions/runs/42388911819 — `apk` success. Artifact: `android-apk`.

Artifacts are downloadable from those run pages (GitHub login required). They are not committed to Git.

## Local verification (this sandbox)

- `cargo test --workspace --offline --lib --bins --tests`: **28 passed** (6 foundation + 12 pack + 6 desktop features + 4 sync server).
- `npm run typecheck`, `npm test` (**13 passed**), `npm run build`, `npm run build:mobile`: passed.
- Live browser demo: port 5173 (synthetic placeholder art; Tauri commands activate inside the shells).

## Windows cross-build attempt (Linux → Windows)

Attempted locally and **failed for environment reasons**, not source reasons:

1. `cargo xwin --version` → `no such command: xwin` (cargo-xwin not installed; crates.io egress blocked).
2. `rustc --target x86_64-pc-windows-msvc` probe → `can't find crate for std` (target stdlib not installed; static.rust-lang.org blocked).
3. `cargo check --target x86_64-pc-windows-msvc --offline` → offline vendor cache lacks Tauri/wry.

The **native Windows CI job succeeded** and produced the NSIS installer, so the Windows build is verified by CI rather than by a local cross-build.

## Honest limitations / untested paths

- **No real user packs were supplied.** Pack tests use clearly synthetic fixtures; real-pack counts, image differences and authoring quirks remain open (`docs/PACK_FORMAT.md`). The Abyss coordinate convention was verified against the public `displayIcon` orientation (`docs/COORDINATE_CHECK.md`); Corrode calibration is identity-provisional. Lens inset anchor is top-left provisional.
- **Windows runtime behavior is not manually exercised here.** Capture exclusion (`WDA_EXCLUDEFROMCAPTURE`), global hotkeys under Valorant focus, multi-monitor DPI, overlay click-through and WebView2 variations require `docs/WINDOWS_TEST_PLAN.md` on real Windows hardware. CI proves compile/bundle, not gameplay interaction.
- **Android APK is CI-built, not device-tested.** Browse-only pull sync/offline browsing should be smoke-tested on a physical device/emulator.
- **Sync transport** is the documented LAN-only HTTP + pairing/token alternative to pinned HTTPS; do not expose it to the Internet (`docs/SYNC.md`).
- Core CI currently runs without `--locked` because the sandbox-generated offline lockfile lacks crates.io checksums; local offline tests pass with the committed lockfile. Regenerate the lockfile on a networked machine for fully reproducible online builds if desired.
- No Riot assets are bundled. Agent/map art is fetched/cached at runtime. No game memory/hooks/injection/Vanguard interaction; Borderless/Windowed only.
- No PR or GitHub release was opened; deliverables are on the session branch and CI artifacts.

## Milestone commits

1. `5449c56` foundation · 2. `9fe8b7b`/`751826b` packs + Abyss check · 3. `27d45f6` shared UI · 4. `35e82f5` hotkeys/capture/overlay · 5. `2489e58` desktop shell · 6. `6f45708` sync · 7. `aba6ccb` Android shell · 8–9. CI/docs/final (see git log).


## GitHub release

Published prerelease: https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.1 — Windows x64 NSIS installer, signed Android preview APK and `SHA256SUMS.txt`. The CI APK was unsigned; release packaging aligned and signed it with an ephemeral preview certificate (discarded after signing). Windows installer remains unsigned. Release asset checksums and APK signature were verified by CI run 42392314298; real Windows/Android runtime testing remains pending.
