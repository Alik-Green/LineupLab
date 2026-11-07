# LineupLab progress

## 2026-11-06 · Foundation (in progress)
- Inspected repository and GitHub main: only README; the requested real ZIP and extracted samples are absent.
- Establishing portable Rust core, content-addressed storage, SQLite migrations and typed runtime catalog.
- Linux toolchain bootstrapped from the sandbox-compatible PyPI distribution. Normal Cargo registry egress is blocked; local verification uses an external, checksum-checked vendor cache, never committed to the repository.
- Next: pack CLI and lossless legacy round-trip, then shared UI.

## Verification ledger
Entries are updated only after commands actually run. Platform-specific checks are never inferred from Linux tests.

## 2026-11-07 · Milestone 1 complete
- Typed models, five-slot ordering, non-destructive circle/line geometry, data-driven modes and lineup ability defaults.
- SQLite WAL schema, indexed browse/sync queries, tombstones, favorites, crash-safe draft records and import backup tables.
- Content-addressed originals, separate WebP thumbnails, capture resize/encoding, mock capture provider.
- Typed valorant-api client with retry/backoff, atomic versioned cache, runtime art downloads, offline fallback and archived-reference handling.
- React/Vite/Tailwind workspace and separate desktop/mobile entry points typecheck and build.
- Verified: `cargo test --workspace --offline --lib --bins --tests` → 6 tests passed; `npm run typecheck`, `npm run build`, `npm run build:mobile` passed.
- Local bundled toolchain lacks rustdoc, so doctests are deferred to CI (official toolchain). No Windows capture execution claimed.

## 2026-11-07 · Milestone 2 complete
- Legacy ZIP reader/writer, bounded safe extraction, tolerant per-entry validation, canonical circle merge, conflict preview/policies, transactional commit, batch undo, filtered export and CLI.
- 13 deterministic synthetic ZIP fixtures plus extracted synthetic Abyss/Corrode JSON samples. No real user pack was available.
- Verified: `cargo test --workspace --offline --lib --bins --tests` → 17 tests passed (6 foundation + 11 pack). Tests cover slot mapping, round-trip, unknown fields/string forms, conflicts/undo, security rejects, missing media, lines, WebP original recovery and synthetic annotation rendering.
- Generated `docs/annotation_sample.png` from synthetic Corrode aim data; documented format and open questions in `docs/PACK_FORMAT.md`.
- Follow-up: verified Abyss identity calibration against public `displayIcon` orientation; added real Abyss/Corrode UUIDs to synthetic fixtures, calibration entries and a regression test. No Riot art committed (`docs/COORDINATE_CHECK.md`).

## 2026-11-07 · Milestone 3 complete (shared UI + annotation editor)
- Shared React/TypeScript UI: typed legacy-compatible models, Tauri/browser library adapters, persistent browse filters/search/tags/favorites, icon selectors, interactive minimap, virtualized land-preview grid, hover previews, annotated detail carousel/video/actions.
- Non-destructive `AnnotatedImage` (exact legacy circle fields + unknown-key preservation, draggable clamped square lens cropping the original, lines/arrows/labels/styles) and full annotation editor (tools, colors/hex, snapping, undo/redo, duplicate/nudge/delete, color keys, copy-to-slot).
- Create/edit flow: five capture/drop/paste slots, mode-aware required slots, draggable minimap pins, metadata/attributes/steps, draft recovery, Save/Save & Next/Discard, lineup undo/redo. Android shell is browse-only (mutation UI hidden).
- Verified: `npm run typecheck`, `npm test` (9 UI tests), desktop/mobile Vite builds, Rust suite still 18 tests. Live browser demo runs on port 5173 (synthetic placeholders; Tauri commands land with the desktop shell).

## 2026-11-07 · Milestone 4 complete (hotkeys, capture pipeline, overlay state)
- Portable Alt-hotkey registry with normalization, conflict detection, rebind feedback and mock provider; shared UI Settings records new combos and rejects conflicts.
- Fast capture pipeline (1600 px / quality 85 / WebP+thumbnail / <150 ms target reporting) and overlay state machine (click-through default, corners/monitor/margins/size/opacity, Create checklist, View flipping) with Linux tests.
- Verified: Rust suite 24 tests, UI suite 13 tests, typecheck and desktop/mobile builds. Windows global registration/window affinity remain shell adapters (`desktop/src-tauri`), isolated from core and uncompiled on Linux.

## 2026-11-07 · Milestone 5 complete (Tauri desktop shell, CI-verified path)
- Tauri 2 desktop shell: config/capabilities/NSIS bundle, synthetic icons, AppState (SQLite/media/device id), commands for library/catalog/modes/media/capture/import/export/hotkeys/overlay, global-shortcut plugin wiring, overlay window (transparent/frameless/non-focusable/always-on-top, click-through, WDA_EXCLUDEFROMCAPTURE gate), shared-UI DTO conversion preserving extensions.
- Shared UI overlay route (`#overlay`) with Create checklist and View image/steps/notes flipping; Editor listens for desktop hotkey events.
- Verified locally: UI typecheck/tests/builds and core suite. Desktop shell compile attempted: offline vendor lacks `tauri`; online check blocked by crates.io TLS egress. Windows/Ubuntu CI is authoritative; no Windows binary claimed yet.

## 2026-11-07 · Milestone 6 complete (LAN sync server + client)
- Opt-in axum server: six-digit pairing, rate limiting, bearer-token auth, mDNS advertise + discovery, incremental manifest, complete lineup documents, SHA-256-verified image transfer, push merge and CLI (`lineuplab-server`).
- Sync client (`SyncClient`, `pull`, `push_local`, `sync_both`) with deterministic LWW/tombstones; desktop commands and shared Settings UI for hosting/pairing/discovery/sync.
- Verified: Rust suite 28 tests (4 new sync server tests), UI typecheck/tests/builds. Security model documented in `docs/SYNC.md` (LAN-only HTTP alternative to pinned HTTPS).

## 2026-11-07 · Milestone 7 complete (Android companion shell, CI build path)
- Tauri 2 mobile shell: browse-only commands (library/catalog/modes/media), mDNS discovery, six-digit pairing and pull-only sync into local SQLite/media for offline browsing; min SDK 26; shared UI hides all mutation/create/overlay/hotkey controls.
- Verified locally: mobile frontend typecheck/build and core/UI suites. APK build attempted: `tauri android init/build --apk` fails on missing Java/JDK + Android SDK/NDK (and offline Tauri vendor gap); CI Android workflow will produce the installable APK. No APK claimed yet.

## 2026-11-07 · Milestone 8 complete (CI + docs)
- GitHub Actions CI green: `core-ui-ubuntu` (Rust tests + doctests + fmt + UI tests/builds), `desktop-ubuntu` (shell check), `desktop-windows` (NSIS installer artifact). Android APK workflow green after SDK/NDK/env/DSL fixes (`android-apk` artifact).
- README, BUILD, PACK_FORMAT, HOTKEYS, SYNC, COORDINATE_CHECK, WINDOWS_TEST_PLAN maintained.

## 2026-11-07 · Milestone 9 complete (final report)
- Windows cross-build attempted locally: cargo-xwin absent, MSVC target std missing, offline vendor lacks Tauri; native Windows CI succeeded instead.
- Final honest completion/limitations report: `docs/COMPLETION.md`. Local: 28 Rust + 13 UI tests, typecheck/builds. CI artifacts: windows-installer (~7.7 MB), android-apk (~29.6 MB). Real-pack/runtime Windows/device testing limitations documented.

## 2026-11-07 · GitHub prerelease published
- Release: https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.1 (`v0.1.0-preview.1`, prerelease, tag target `c6e5984`).
- Assets: `LineupLab-0.1.0-preview.1-x64-setup.exe` (7,692,647 bytes), `LineupLab-Companion-0.1.0-preview.1.apk` (79,427,862 bytes), `SHA256SUMS.txt`.
- Source builds: Windows CI run 42386769967 (`ebb75c7`); Android CI run 42388911819 (`81879e9`). Release packaging/verification run 42392314298 passed, including re-download and checksum/signature verification of the uploaded assets.
- APK: `app.lineuplab.companion` 0.1.0, min API 26, universal ABIs; unsigned CI output aligned and signed with a disclosed ephemeral preview key. Windows installer unsigned. No real-device/runtime validation claimed.

## 2026-11-07 · UI redesign M1 complete (image loading first)
- Diagnosed raw catalog paths, incomplete ability/role/map DTOs, narrow asset scope and silent sequential downloads (`docs/IMAGE_LOADING.md`).
- Added cache-first `ValImage`/`useCachedImage`, bounded concurrent asset downloader with progress events, first-run screen, Settings → Data cache size/re-download/self-test, native asset diagnostics and error logging on desktop + Android.
- Verified: 28 Rust tests, 15 UI tests, typecheck/builds; Playwright mocked-Tauri self-test rendered 87/87 fixture catalog images with no broken images/CSP errors. Screenshots in `docs/screenshots/`. Real Windows/Android device verification still pending.
