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

## 2026-11-07 · UI redesign M2 complete (tokens, components, shell)
- Added design tokens, self-hosted fonts, component library (Button/IconButton/Chip/Segmented/IconPicker/Card/Modal/Drawer/Toast/Tooltip/Tabs/Stepper/Kbd/Skeleton/EmptyState/Slider/Toggle/fields), global shell with data/sync status and native window controls, Android bottom nav scaffold.
- Verified: typecheck, 15 UI tests, desktop/mobile builds. Screen-by-screen visual review continues in M3–M8.

## 2026-11-07 · UI redesign M3 complete (Browse)
- Rewrote Browse: resizable map/agent/ability selectors (role chips, search, pinned agents), lineup-able ability filtering, large pan/zoom minimap with ability-icon markers/bounce pins/site labels/hover preview/legend/toolbar/empty state, filter popover with active count + reset, virtualized card grid with sort/density/+New, quick actions, and detail drawer (slot rail, arrow-key nav, zoom, download, mini minimap, steps/notes/tags, edit/duplicate/delete/favorite, video).
- Verified: typecheck, 15 UI tests, desktop/mobile builds, Playwright browse populated/filtered/drawer/empty + 1100/1920 overflow checks + image self-test (5 e2e passed). Screenshots `docs/screenshots/10–13`.

## 2026-11-07 · UI redesign M4 complete (Create wizard)
- Rewrote Editor as a 5-step wizard: icon-picker Setup with per-agent/ability modes; Capture slot rail (Alt+1..5, required/optional/done states, progress) with capture/choose/paste/retake/clear/annotate and drag-drop; Pins with tool palette, draggable markers, bounce tool, context ghosts and coordinate list; Details with suggested title, side/site/difficulty/throw/tags/notes/author/favorite and reorderable steps with image refs; Review with preview, minimap, validation checklist and Save / Save & Next.
- Restyled AnnotationEditor (segmented tools, swatches, sliders, lens controls, copy-to-slot) and AnnotatedImage with the token system; kept all annotation/undo/redo/hotkey behaviour.
- Added `lib/modes.ts` (core-mirroring mode resolution, visible slots, validation, auto-title) with 7 unit tests. Fixed minimap pin coordinate normalization and map URL double-resolution.
- Verified: typecheck, 22 UI tests, desktop/mobile builds, 8 desktop Playwright tests incl. full wizard flow via hotkeys, validation, draft recovery. Screenshots `docs/screenshots/20–30`.

## 2026-11-07 · UI redesign M5 complete (Import/Export + Settings)
- New ImportExport screen: dropzone, preview table with status pills/warnings, select-all (errors excluded), policy segmented, import progress/report, undo batch, export summary + toggles.
- Settings rewritten as tabs: General (motion/density/sort/reset + catalog), Hotkeys (grouped table, capture chips, conflicts), Overlay (corner picker, sliders, live preview, reading-comfort prefs), Capture, Sync (big pairing code, discover/pair/sync), Data (cache report/re-download), Diagnostics (self-test + errors), About (safety model).
- Verified: typecheck, 22 UI tests, desktop/mobile builds, 10 desktop Playwright tests (settings tabs + hotkey conflict/rebind, import/export flow, diagnostics). Screenshots `docs/screenshots/40–52`.

## 2026-11-07 · UI redesign M6 complete (Overlay)
- Rewrote OverlayView: create checklist with thumbnails/required progress/current slot, view image + annotations + step caption, flip to minimap/steps/notes, prev/next, capture fade, local reading-comfort prefs, live Settings preview.
- Editor publishes live draft snapshots to the overlay (UI-only event); overlay handles existing overlay hotkeys; fixed annotation SVG stacking above images app-wide.
- Verified: typecheck, 24 UI tests, desktop/mobile builds, 13 desktop Playwright tests (overlay create/view/fade/prefs sync/live draft + settings). Screenshots `docs/screenshots/60–65`, refreshed 42.

## 2026-11-07 · UI redesign M7 complete (Android companion)
- Mobile Browse: single-column cards, map dropdown, search, filter drawer (agent/ability/side/site/difficulty/tag/favorites), list/map toggle with enlarged touch markers, full-screen detail drawer. Sync pairing-only; Settings tabs General/Sync/Data/Diagnostics/About.
- Verified: typecheck, 24 UI tests, desktop/mobile builds, 2 Android Playwright tests (full companion flow + no horizontal overflow at 390/360). Screenshots `docs/screenshots/70–78`.

## 2026-11-07 · UI redesign M8 complete (polish & accessibility) — redesign finished
- 40px/48px target floor across all screens; static badges non-focusable; keyboard-operable map markers; larger annotation hit areas; compact checkboxes in full-size labels; platform set before paint; focus/reduced-motion verified.
- Added `docs/UI_CHANGELOG.md`; updated `docs/WINDOWS_TEST_PLAN.md` with redesign + a11y checks; refreshed all screenshots (desktop + Android 390×844).
- Final verification: typecheck; 24 unit tests; desktop + mobile builds; 17 Playwright e2e (14 desktop + 3 Android, incl. target audits); 28 Rust tests. M1–M8 committed & pushed.

## 2026-11-07 · Preview 2 release published (Windows + Android)
- Fixed native catalog role-icon conversion (`8c855b3`) and labelled the redesigned UI `0.1.0-preview.2` (`18bceb1`).
- Green same-revision builds: CI/Windows [42406781090](https://github.com/Alik-Green/LineupLab/actions/runs/42406781090), Android [42406781048](https://github.com/Alik-Green/LineupLab/actions/runs/42406781048), source `18bceb1c5727ed264b8fc0cb70296644e6f4ea9e`.
- Published [v0.1.0-preview.2](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.2) via packaging run [42407951313](https://github.com/Alik-Green/LineupLab/actions/runs/42407951313): x64 NSIS installer, signed universal companion APK, SHA256SUMS; source equality, artifact digests, package structure, checksums and APK signature verified.
- Final local checks: typecheck, 24 unit tests, 28 Rust tests, desktop/mobile builds, 17 Playwright tests. Unsigned Windows / ephemeral Android signing and pending real-device/gameplay checks are disclosed in `docs/releases/v0.1.0-preview.2.md`.

## 2026-11-07 · Preview 3 release published (reported fixes)
- Fixed pack import visibility: off-thread staged progress, persistent error panel, busy guards, preview status summary and core-shaped report (`0fce632`, rustfmt `17851fd`).
- Browse Map/Agent/Ability are current-value buttons opening full picker dialogs; desktop minimap/cards have more room; Android uses touch-sized pickers.
- Overlay placement uses real monitor origin/physical size/scale factor instead of hardcoded 1920×1080; Settings shows monitor/DPI/position and can reapply; startup applies saved placement. Native Tauri monitor API fixes: `e8a5655`, `abe9564`, `3dae13c`.
- Green same-revision builds: CI/Windows [42413896601](https://github.com/Alik-Green/LineupLab/actions/runs/42413896601), Android [42413896621](https://github.com/Alik-Green/LineupLab/actions/runs/42413896621), source `3dae13c6f39ff78b89a331a2c91ec6065132bc0e`.
- Published [v0.1.0-preview.3](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.3) via packaging run [42415179026](https://github.com/Alik-Green/LineupLab/actions/runs/42415179026): x64 NSIS installer, signed universal companion APK, SHA256SUMS; source equality, artifact digests, package structure, checksums and APK signature verified.
- Final local checks: typecheck, 25 unit tests, 30 Rust tests, desktop/mobile builds, 20 Playwright tests. Unsigned Windows / ephemeral Android signing and pending real-device/gameplay checks are disclosed in `docs/releases/v0.1.0-preview.3.md`.

## 2026-11-07 · Preview 4 feedback batch implemented
- Wrote `docs/TODO_CHECKLIST.md` before implementation; all feature groups addressed, with callout/path naming honestly limited to optional callouts + site fallback.
- Mobile Download: no-code `/connect` on opt-in LAN sharing, additive `download_library`, blank/invalid media hash fix (no `/images/` collection request), progress/warnings/retry, safe areas, empty-map recovery. Security trade-off documented in `docs/SYNC.md`.
- ZIP decompression progress; square Browse/Create pickers; TDM filter; minimap art+marker transform and pin accuracy; stand/land toggles; Sova Recon Dart charge/bounce UI; per-aim throw type; simplified sites/pins; Save & create another; overlay blur-clamped numbers, Learn/Minimal modes, large Create capture.
- Verified locally: typecheck; 32 UI unit tests; 32 Rust integration tests; desktop/mobile production builds; 25 Playwright tests (21 desktop + 4 Android). Native Windows/Android CI and physical-device checks remain pending.

## 2026-11-07 · Preview 4 release published (desktop/mobile feedback)
- Source `99fc9664aefece0f6dc1745c4d019d43475e1ba4`; green CI/Windows [42421768575](https://github.com/Alik-Green/LineupLab/actions/runs/42421768575) and Android [42421768651](https://github.com/Alik-Green/LineupLab/actions/runs/42421768651).
- Published [v0.1.0-preview.4](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.4) via packaging run [42423140977](https://github.com/Alik-Green/LineupLab/actions/runs/42423140977): x64 NSIS installer (8,430,520 B), signed companion APK (83,794,198 B), SHA256SUMS; source equality, digests, package structure, signing and publish verified.
- Final local checks: typecheck, 32 UI unit tests, 32 Rust integration tests, desktop/mobile builds, 25 Playwright tests. Unsigned Windows / ephemeral Android signing and pending physical-device/gameplay checks disclosed in `docs/releases/v0.1.0-preview.4.md`.
