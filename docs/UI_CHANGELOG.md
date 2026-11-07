# LineupLab UI redesign changelog

Eight milestones on `arena/e082cc85-lineuplab`, preserving the core data model, legacy ZIP format, sync protocol and hotkey semantics.

## M1 — Image loading fixed (`96d3ff2`)
- Root-cause report in `docs/IMAGE_LOADING.md`; cache-first asset downloader with magic-byte validation, progress events and audit (`core/src/catalog.rs`).
- Shared `useCachedImage`/`ValImage` layer: native asset URL first, remote fallback, explicit error/fallback states; never passes raw filesystem paths to `<img>`.
- First-run progress modal; Settings → Data/Diagnostics cache report and image self-test.
- Deterministic Vite fixture art (117 PNGs) + mock Tauri layer for Linux Playwright.
- Screenshots: `01–03`.

## M2 — Design system & shell (`49562c1`)
- Tokens (dark Valorant-inspired palette, Barlow Condensed + Inter), component library (`ui.tsx`: Button/IconButton/Chip/Segmented/IconPicker/Modal/Drawer/Toast/Tabs/Stepper/fields) with focus trap and Esc handling.
- Custom titlebar shell, top navigation, status chips, first-run wiring; frameless desktop window.
- `docs/DESIGN_NOTES.md` started.

## M3 — Browse (`85192e0`)
- Map/agent/ability selectors, role chips, favorite agents, filters popover, virtualized card grid (comfortable/compact), minimap with throw lines/markers, detail drawer with annotated viewer and slot rail.
- Persistent filters/sort/density/split; empty states; no horizontal overflow at 1100/1920.
- Screenshots: `10–13`.

## M4 — Create wizard (`9b45550`)
- Five steps (Setup → Capture → Pins → Details → Review) mirroring core ability modes (`lib/modes.ts`), required-slot validation, capture auto-advance, hotkeys on every step.
- Restyled annotation editor (circle/lens/line, colors, snap, copy-to-slot), minimap pin editing, undo/redo, 400 ms autosave + draft recovery.
- Fixed double image resolution and minimap coordinate scaling bugs.
- Screenshots: `20–30`.

## M5 — Import/Export + Settings (`0d0ec14`)
- Import/Export: dropzone, preview table with status pills/warnings, error rows unselectable, conflict policy, progress/report, undo batch; export summary + legacy-JPEG/bake toggles.
- Settings tabs: General/Hotkeys/Overlay/Capture/Sync/Data/Diagnostics/About; grouped hotkey table with rebind/conflicts; overlay placement preview; large pairing code; self-test moved to Diagnostics.
- Screenshots: `40–52`.

## M6 — Overlay (`7f27afe`)
- Translucent overlay using shared tokens: Create checklist with thumbnails/required progress/current slot; View annotated image + step caption, prev/next/flip to minimap + steps/notes; capture fade.
- Reading-comfort prefs (scale/hide annotations/fade) sync live between Settings and overlay; Settings shows monitor placement + full-size content preview.
- UI-only live-draft event bridge from Editor; overlay handles existing overlay hotkeys; fixed annotation SVG stacking above images app-wide.
- Screenshots: `60–65`.

## M7 — Android companion (`0a3919e`)
- Browse-only mobile layout: bottom nav, single-column cards with always-visible actions, map dropdown + search + Filters drawer, list/map toggle with enlarged touch markers, full-screen detail drawer.
- Pairing-only Sync; Settings hides desktop-only tabs; `html[data-platform]` sizes portaled drawers/toasts; icon-only segmented controls labelled.
- Screenshots: `70–78` (390×844).

## M8 — Polish & accessibility (this commit)
- Touch targets: every desktop control ≥40px, Android ≥48px (chips, segmented, toolbar/card actions, agent pin, swatches, checkboxes via 40/48px labels, switches, bindings, corner picker, divider, search inputs). Automated Playwright target audit on both platforms.
- Static badges are no longer focusable buttons; minimap markers are keyboard-operable `role=button` with larger transparent hit areas; annotation hit areas enlarged; visible focus rings; reduced-motion respected.
- Platform set before first paint to avoid control-size flash; import checkboxes use compact visuals inside full-size labels.
- Refreshed all screenshots; `docs/WINDOWS_TEST_PLAN.md` updated with redesign checks.

## Verification (final)
- `npm run typecheck` (ui + desktop + mobile) ✅
- `npm test`: 7 files / 24 unit tests ✅
- `npm run build`, `npm run build:mobile` ✅
- Playwright: 17 e2e tests (14 desktop + 3 Android) ✅ including target-size audits and overflow checks
- Rust: `cargo test --workspace --offline --lib --bins --tests` → 28 tests ✅
- Real Windows capture/hotkeys/overlay affinity and real Android device sync remain manual (`docs/WINDOWS_TEST_PLAN.md`).

## Release packaging
- Published as [v0.1.0-preview.2](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.2) from `18bceb1`; Settings → About shows `0.1.0-preview.2` on desktop and Android.
- Windows CI 42406781090 and Android CI 42406781048 succeeded on that exact revision; release verification run 42407951313 published the installer, APK and checksums. See `docs/releases/v0.1.0-preview.2.md` for signing/upgrade caveats.

## Preview 3 — reported runtime fixes (`3dae13c`)
- Import: off-thread preview/commit with staged progress events, persistent failure panel, busy-state guards, preview status summary and core-shaped import report. Legacy ZIP/undo semantics preserved.
- Browse: Map/Agent/Ability current-value buttons open full picker dialogs (search, role filters, favorite-agent pinning); desktop minimap/cards get more room; Android uses the same touch-sized picker pattern.
- Overlay: native monitor enumeration plus physical origin/size/scale conversion replaces hardcoded 1920×1080; logical settings clamp inside the selected monitor; Settings shows monitor/resolution/DPI/position and can reapply placement; startup applies saved placement.
- Verification: typecheck; 25 UI unit tests; 30 Rust tests; desktop/mobile builds; 20 Playwright tests (17 desktop + 3 Android), including import progress/error, picker and 1440p placement regressions. Screenshots `14`, `53–54`, `66` and refreshed Browse/Import/Overlay/Android views.
- Published as [v0.1.0-preview.3](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.3); Windows CI 42413896601 and Android CI 42413896621 succeeded on `3dae13c`, release verification run 42415179026 published installer/APK/checksums. See `docs/releases/v0.1.0-preview.3.md`.

## Preview 4 — reported desktop/mobile feedback (implementation batch)
- Checklist: `docs/TODO_CHECKLIST.md`. Download unblocked: no-code trusted-LAN connect, additive persistent phone downloads, blank-hash `/images/` fix, progress/warnings/retry, safe-area padding, empty-map recovery.
- ZIP import reports real decompression bytes/entries. Browse/Create use three square Map/Agent/Ability pickers; TDM maps filtered; short-window minimap reachable.
- Minimap art + markers zoom/pan together; letterbox-safe pin placement; stand/land toggles; simplified Create pins. Sova Recon Dart charge/bounce controls, all Sova abilities, per-aim throw type, A/B/C/Mid sites, Save & create another, optional callout-based titles.
- Overlay numeric fields clamp on blur; Learn mode + Learn in overlay action; Minimal image-only mode with optional outline; Create shows large current capture.
- Local verification: typecheck, 32 UI unit tests, 32 Rust integration tests, desktop/mobile builds, 25 Playwright tests. Published as [v0.1.0-preview.4](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.4) from `99fc966`; CI 42421768575 + Android 42421768651 green, packaging run 42423140977 published installer/APK/checksums. See `docs/releases/v0.1.0-preview.4.md`.
