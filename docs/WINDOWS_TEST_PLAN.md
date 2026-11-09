# Windows Test Plan (v0.2.0)

## 1. Console / Launch

- Build `v0.2.0` installer `LineupLab-0.2.0-windows-setup.exe` (NSIS, signed unsigned → SmartScreen warning expected).
- Double-click installer, complete install.
- Launch `LineupLab` from Start menu.
- **Expected**:
  - No terminal / console window appears (regression fixed via `main.rs` `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`).
  - App opens at 1200×800 (min 900×600) without blank screen.
  - No "Failed to load lineups" full-screen block; demo lineups appear (fallback embedded `src/data/fallbackLineups.json` guarantees offline). Footer shows "Demo data • X lineups".
  - DevTools (if enabled) shows no CSP violation for `https://tauri.localhost/lineups.json` (`tauri.conf.json` now allows `https://tauri.localhost` and `http://tauri.localhost` in `connect-src` and `img-src`).

## 2. No-Scroll Layout

- Resize window to 1100×650 (spec) and 1920×1080, also 390×844 (mobile emulation via devtools).
- **Expected**:
  - `document.documentElement.scrollHeight === window.innerHeight` (devtools console: `document.documentElement.scrollHeight <= innerHeight`).
  - No vertical scrollbar on page; no horizontal overflow.
  - Left panel (350px desktop) shows Map card, Agent grid (6 columns at <340px, 7 at ≥340px via ResizeObserver), Ability bar, Filters collapsible — no page scroll, only thin 6px scrollbar inside left panel if overflow (last resort).
  - Filters toggle collapses content; left panel never forces document scroll.
  - Mobile (<768px): map horizontal strip, agent horizontal scroll, minimap on top, bottom sheet for filters (drag handle, max 80vh) — no page scroll.

## 3. Minimap Interactions

- Hover markers: path (start→bounces→end with arrowhead) + tooltip.
- Click marker: detail panel opens (max-height `calc(100dvh-2rem)` internal scroll).
- **Wheel**: scroll wheel over minimap zooms (0.6–3) without scrolling page. Verify `window.scrollY` stays 0 (devtools).
  - Implementation: `addEventListener("wheel", handler, {passive:false})` + `preventDefault`.
- **Pan**: drag background.
- **Touch**: `touch-action:none` on minimap container (checked via `getComputedStyle`).
- **Zoom controls**: +/− buttons, double-click reset.

## 4. Import Pack

- Prepare sample pack `sample-pack.zip` via `npm run create-sample-pack` (2 lineups + 2 media).
- In app: Top bar → **Import** button → dialog opens (`max-height: calc(100dvh-2rem)`).
- Choose `.zip`:
  - Manifest shows name/author/description/count.
  - Table lists lineups with chips: New (green), Identical (gray), Pack newer (red), Local newer (amber), Error (red).
  - `isSeedPlaceholder` rows unchecked with amber "placeholder" badge + banner explanation.
  - Duplicate pack banner if re-importing same name.
- Select subset, pick conflict mode Skip/Overwrite/Copy.
- Click Import → progress bar, then report (imported/skipped/overwritten/copied) + warnings (deduped media).
- **Media SHA dedup**: re-importing same pack should report deduped media, original blob unchanged (never re-encoded).
- **Thumbnails**: verify IndexedDB `media` entries have `thumbnail` blob (240px JPEG) distinct from `blob`.
- **Undo**: after import, "Undo" removes inserted ids (tx delete).
- **History**: Settings → shows import history entries.

## 5. Annotated Detail / Zoom Lens

- Open any imported lineup detail.
- Images carousel shows `AnnotatedImage` with SVG circles (dashed, color, label + connector).
- Hover image: zoom lens (140px circle, 2× magnified) appears, clamped inside image bounds with connector line; lens hidden if image width <200px.

## 6. Create Wizard (UI skeleton only)

- Top bar → **Create** tab.
- Stepper shows 5 numbered steps (Setup, Capture, Pins, Details, Review), clickable.
- Each step content fits viewport without page scroll; controls 40/48px min.
- Buttons trigger "Coming soon" toast; Save shows mock state toast.

## 7. Android

- Build APK `LineupLab-0.2.0-android.apk`, install on emulator/device (minSdk 26).
- No-scroll holds at 390×844 portrait and landscape; bottom sheet works with safe-area insets.
- Import via file picker works (Android storage permission).

## 8. Automation

- `npm run build` / `cargo check` / `actionlint` pass.
- Playwright `tests/no-scroll.spec.ts` passes at 1100×650/390×640 and checks wheel zoom `scrollY=0`.
- Screenshots generated via `npm run screenshots` into `docs/screenshots/` (1440×900 + 390×844 for lineups/hover/detail/import dialogs/create steps/settings).
