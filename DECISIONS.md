# DECISIONS

## Stack

- **Tauri 2 + React + TypeScript + Vite + Tailwind** as required. Zustand for global state persisted to localStorage `lineuplab_prefs_v1`; data in IndexedDB via `idb` (DB `lineuplab` v2: stores `lineups`, `media`, `importHistory`, `meta`).
- No Rust logic beyond `main.rs` `windows_subsystem="windows"` + default Tauri `shell`.
- `zod` for tolerant pack validation, `fflate` for safe unzip (no `jszip` heavy dep).

## Valorant API / CSP

- Endpoints `v1/agents`, `v1/maps`, `v1/version` cached by version key, fallback `src/data/fallback*.json`.
- CSP in `tauri.conf.json` fixed to allow Tauri fetch: `default-src 'self' ipc: http://ipc.localhost https://tauri.localhost http://tauri.localhost` + `connect-src ... https://tauri.localhost ...` + `img-src asset: ...` — resolves `Failed to fetch /lineups.json` on `https://tauri.localhost`.
- `<ValImage>`: skeleton + retry once with cache-bust.

## Layout / No-Scroll (v0.2.0 Part A)

- Shell: `html,body,#root {height:100%;overflow:hidden;overscroll-behavior:none}` + `#root {height:100dvh;display:flex;flex-direction:column}`.
- `App.tsx`: top `h-[100dvh] h-screen flex flex-col overflow-hidden`, header 56px `shrink-0`, footer 28px, center `flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row`.
- Left panel `w-[350px] shrink-0 flex flex-col gap-2 p-2 overflow-hidden`; inner `flex-1 min-h-0 overflow-hidden flex flex-col gap-2`.
- `AgentGridCompact`: `ResizeObserver` measures container width → 5 cols <300px, 6 cols <340px, 7 cols ≥340px; tiles `min-h-[40px]`, thin-scrollbar `overflow-auto overscroll-contain`.
- `FiltersCardCollapsible`: button collapses inner `overflow-auto`; thin scrollbar last resort.
- `AbilityBar` (kept) + vertical variant for future; all controls 40px desktop / 48px mobile.
- Minimap: `wheel` via `addEventListener("wheel", handler, {passive:false})` + `preventDefault` so document never scrolls; `touch-action:none` via inline style + `touch-none` class; pinch zoom via two-touch distance.
- Overlays (Import, Detail, Settings): `max-height: calc(100dvh-2rem)` `overflow-auto overscroll-contain`.
- Mobile: `md:hidden` bottom sheet `fixed bottom-0 max-h-[80vh] rounded-t-xl` with handle + safe-area insets.
- Verified via Playwright `tests/no-scroll.spec.ts` at 1100×650/390×640/1440×900/1920×1080 + wheel test asserts `scrollY===0` and `scrollHeight<=innerHeight`.

## Pack Import (v0.2.0 Part B)

- **Zip parsing**: `parsePackZip` with limits 100MB/2000 files, reject `..`/`/`, json <2MB, `fflate` `unzipSync` + `strFromU8`.
- **Manifest**: `ManifestSchema` passthrough, aliases `title/packName→name`, `desc→description`, `version→formatVersion`.
- **Lineups**: `PackLineupSchema` passthrough, supports single or array per file, inline `manifest.lineups`; tolerant side/difficulty/importance/abilitySlot normalization (`medium→normal`, `must→essential`, etc.).
- **Mapping** `mapRawToLineup`: fills `Lineup` extended fields `slots{stand1,aim1,stand2,aim2,landing}`, `throws[]`, `steps`, `attributes`, `circles` deduped by `id` (B4); handles `projectiles`, legacy `media` keys, `start/end` as `[x,y]` or `{x,y}`, clamps 0..1; sets `source:"import"`, `importBatchId`, `legacy`, `status`, `isSeedPlaceholder`.
- **Storage**: `db.ts` creates `lineups` (indexes by-map/by-agent/by-batch), `media` (by-lineup/by-sha), `importHistory`; `sha256Bytes` via `crypto.subtle`; `putLineups` transactional.
- **Media deduplication**: `storeMediaBatch` checks `by-sha` index, skips duplicate SHA (never re-encodes original Blob); thumbnail via `createImageBitmap` + canvas 240px JPEG separate.
- **Preview**: `buildPreview` computes per-id status New/Identical/Pack newer/Local newer/Error; duplicate pack warning via `importHistory` lookup; `isSeedPlaceholder` banner and unchecked default.
- **Conflicts**: UI `Skip/Overwrite/Copy` (copy → `${id}-copy-${timestamp}`).
- **Progress/report/Undo/history**: `ImportDialog` progress bar, report grid, warnings, `addImportHistory`, undo deletes `insertedIds`.

## Detail Panel (B4+)

- `DetailPanel` v2 uses `AnnotatedImage`:
  - SVG circles viewBox 0..100 (normalized), dashed, color/label, connector placeholder.
  - Zoom lens 140px circle 2× magnified, clamped via `clamp()` inside image, connector line to cursor, hidden if `size.w <200`.
  - Shows throws/steps/circles counts, batch id.

## Create Wizard (Part C)

- `CreateWizard` skeleton only (no persistence):
  - Tab `lineups|create` in `TopBar`.
  - Stepper 5 numbered pills clickable, `active` vs `done` colors.
  - Steps Setup/Capture/Pins/Details/Review each fit viewport `flex-1 min-h-0 overflow-auto p-4`; controls min 40/48px; "Coming soon" toasts via DOM div 2.5s.
  - Next/Back navigation.

## Build / Release

- `package.json` 0.2.0, `src-tauri/Cargo.toml` 0.2.0, `tauri.conf.json` `build.beforeBuildCommand = "npm run build"`.
- Windows fix: `src-tauri/src/main.rs` `#![cfg_attr(not(debug_assertions), windows_subsystem="windows")]` hides console; release.yml restores real exe detection (no placeholder on success).
- `docs/PACK_FORMAT.md` spec + `docs/WINDOWS_TEST_PLAN.md` manual steps.
- Screenshots via `@sparticuz/chromium` + `al2023.tar.br` libs.

## Verification gaps

- `cargo check` not in sandbox (Rust unavailable) — relied on CI `cargo check` equivalent via `tauri build`.
- Playwright browsers via `@sparticuz/chromium` self-contained (cdn.playwright.dev blocked).
