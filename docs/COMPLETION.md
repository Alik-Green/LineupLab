# LineupLab — final completion & limitations report

Date: 2026-11-07 · Branch: `arena/e082cc85-lineuplab`

## Deliverables

| Area | Status | Evidence |
|---|---|---|
| Portable Rust core (SQLite + SHA-256 media, catalog cache/retry/offline, modes, geometry, state machine) | Implemented | `core/`, 28 Rust tests |
| Legacy ZIP pack import/export (sole format), safe unzip, tolerant validation, conflicts/undo, canonical circles, lossless unknown/string forms, WebP dual export | Implemented | `core/src/pack.rs`, `docs/PACK_FORMAT.md`, 12 pack tests + 13 synthetic fixtures |
| Shared UI browse/create/annotation editor, virtualized grid, minimap, drafts, undo/redo | Implemented | `ui/`, 25 UI tests, 20 Playwright checks, typecheck + builds; redesign M1–M8 |
| Alt hotkeys, fast capture pipeline, overlay state | Implemented (portable + Windows adapter) | `core/src/hotkeys.rs`, `overlay.rs`, `capture.rs`, `docs/HOTKEYS.md`, 6 desktop-feature tests |
| Tauri 2 Windows desktop shell + overlay window + commands | **Compiles and bundles in CI** | CI `desktop-windows` success; `windows-installer` artifact (NSIS; Preview 2 ZIP ~8.3 MB) |
| LAN sync server/client, pairing, mDNS, tombstones, deterministic conflicts | Implemented | `core/src/server.rs`, `sync.rs`, `docs/SYNC.md`, 4 sync tests |
| Tauri 2 Android browse-only companion, discovery/pair/pull sync, min SDK 26 | **APK built in CI** | CI `Android APK` success; `android-apk` artifact (Preview 2 ZIP ~32.3 MB) |
| CI Windows/Ubuntu + Android, README/BUILD/PACK_FORMAT/WINDOWS_TEST_PLAN/DECISIONS/PROGRESS | Complete | `.github/workflows/`, `docs/` |

### Authoritative CI runs (green)

- CI: https://github.com/Alik-Green/LineupLab/actions/runs/42413896601 — `core-ui-ubuntu`, `desktop-ubuntu`, `desktop-windows` all success on `3dae13c`. Artifacts: `windows-installer`, `frontend-dist`.
- Android: https://github.com/Alik-Green/LineupLab/actions/runs/42413896621 — `apk` success on the same `3dae13c` revision. Artifact: `android-apk`.

Artifacts are downloadable from those run pages (GitHub login required). They are not committed to Git.

## Local verification (this sandbox)

- `cargo test -p lineuplab-core --tests --offline`: **32 passed** (6 foundation + 14 pack + 7 desktop features + 5 sync server). CI also runs doctests.
- `npm run typecheck`, `npm test` (**32 passed / 8 files**), `npm run build`, `npm run build:mobile`: passed.
- Playwright: **25 passed** (21 desktop + 4 Android viewport/accessibility), including 40px/48px target audits, import/decompression progress, Browse/Create pickers, minimap transform, numeric blur clamping, minimal overlay, phone download and empty-map recovery.
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
- No PR was opened. Published prereleases and verified assets are listed below; source remains on the session branch.

## Milestone commits

1. `5449c56` foundation · 2. `9fe8b7b`/`751826b` packs + Abyss check · 3. `27d45f6` shared UI · 4. `35e82f5` hotkeys/capture/overlay · 5. `2489e58` desktop shell · 6. `6f45708` sync · 7. `aba6ccb` Android shell · 8–9. CI/docs/final (see git log).


## GitHub releases

**Current: [v0.1.0-preview.5](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.5)** — minimap solid-colour crash guards + nearest-marker hit resolution, arm64-v8a-only Android packaging (target API 36, 16 KB alignment), larger square selector artwork, unclipped tooltips, persistent throw paths, all TDM maps excluded (incl. District), full-screen zoom/pan lineup viewer, clean cards, per-capture charge/bounces, single-mode optional-slot hiding, reduced pin tools, callout-based titles and unified Create top bar. Both apps built from `d02376ca44af7a720a204dd2fc1479c0e9d5baed`. Assets: `LineupLab-0.1.0-preview.5-x64-setup.exe` (8,467,319 B), `LineupLab-Companion-0.1.0-preview.5-arm64-v8a.apk` (23,906,343 B), `SHA256SUMS.txt`. Packaging/verification run [42430205364](https://github.com/Alik-Green/LineupLab/actions/runs/42430205364) passed: source-run equality, artifact digests, NSIS/APK structure, arm64-only badging, 16 KB alignment, ephemeral APK signing, checksums and publish. Full notes: `docs/releases/v0.1.0-preview.5.md`.

The Windows installer is unsigned; the APK uses a discarded ephemeral preview certificate. Android upgrades from Preview 1–4 require uninstall/reinstall and re-connecting because the signing identity differs. Preview 5 APK is arm64-v8a only (Pixel 9 and modern 64-bit phones); see `docs/ANDROID_INSTALL.md`. Back up the Windows library first. Real Windows gameplay and physical Android testing remain pending; after install, choose the correct monitor in Settings → Overlay and use “Reapply placement”.

Historical: [v0.1.0-preview.3](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.3) (packaging run 42415179026), [v0.1.0-preview.2](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.2) (42407951313) and [v0.1.0-preview.1](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.1) (42392314298). Superseded by Preview 5; do not use older binaries for these fixes.
