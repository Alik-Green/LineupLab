# LineupLab — user feedback implementation checklist

Created 2026-11-07 from the latest Windows/Android feedback. This is the working acceptance checklist, not a claim that every item is finished. Check items only after implementation and the relevant automated check; native Windows/phone checks remain explicitly marked.

## A. Get content onto the phone / unblock testing

- [x] **A1. Fix the reported `404 /images/` download failure.** Reproduce empty/invalid media references, skip missing/blank hashes safely, report partial failures rather than aborting the entire download, and add a real HTTP server/client regression test. Validate the server address and explain that `192.181.x.x` is not a private LAN range (typical home addresses are `192.168.x.x`, `10.x.x.x`, or `172.16–31.x.x`).
- [x] **A2. Make downloading clearly one-way and persistent on Android.** Rename Sync/Pair to Connect / Download library / Update downloads. Download all available lineups and referenced media, skip duplicate content, keep an offline local copy, show counts/progress/errors and last successful download. Do not push phone edits or silently erase previously downloaded phone content.
- [x] **A3. Remove the required pairing-code step.** Support one-tap connect on the explicitly started trusted-LAN sharing server, while retaining compatibility with code-protected older servers. LAN is not risk-free: show that anyone who can reach the active sharing server can read the library; never enable sharing or port-forward automatically. Keep stop sharing obvious.
- [x] **A4. Add download progress and useful diagnostics.** Expose manifest/image/saving progress, retry failed items, distinguish connection/HTTP/missing-media errors, and test a complete download followed by an incremental no-duplicate update.
- [x] **A5. Fix Android empty-minimap grey-screen navigation.** Empty-state actions must not open an invalid detail/blank page; Back must recover. Add a phone-viewport regression test for no-match map → filters/reset → browse.
- [x] **A6. Respect phone notches/cutouts.** Safe-area padding at the top and bottom, including dialogs/drawers; verify mocked narrow Android viewports and document the remaining physical-device check.

## B. Import and Browse

- [x] **B1. Show real ZIP reading/decompression progress.** Stream/read the selected file and decompress entries with byte/entry progress (not an indeterminate bar for the entire operation). Keep the UI responsive, report the current entry and bytes, handle errors/cancellation, and preserve ZIP safety/legacy compatibility.
- [x] **B2. Exclude team-deathmatch/non-standard maps from map choices.** Filter the catalog shown in Browse/Create while retaining archived lineup references and old-pack data. Add a fixture/test so standard maps remain available.
- [x] **B3. Make the three selectors compact icon squares.** Map / Agent / Ability sit next to one another at the top in three equal icon-led squares showing the current choice; clicking opens the complete picker. Apply to desktop Browse and Create, with a touch-friendly Android equivalent.
- [x] **B4. Fix short-window Browse layout.** No clipping of the map side; allow vertical scrolling and give the minimap a sensible minimum size. Test short desktop heights and narrow Android widths without horizontal overflow.

## C. Minimap and map locations

- [x] **C1. Fix minimap zoom/pan art alignment.** Transform the map image and SVG markers together around the pointer/viewport center; constrain pan, support reset, and test toolbar/wheel zoom and coordinate alignment.
- [x] **C2. Show stand and landing positions.** Add distinct start/end markers and optional independent Show stand / Show landing toggles (plus existing throw-line toggle), in Browse, detail/learn and Create as appropriate.
- [x] **C3. Fix Create pin placement under the cursor.** Account for image letterboxing, zoom, pan and container aspect ratio in both directions. Add coordinate round-trip tests at non-square sizes and zoom levels.
- [x] **C4. Simplify map pins.** Required Stand and Land; optional Second stand only for a two-throw lineup; bounce diamonds when relevant. Remove aim-position pins from the map UI without destroying legacy stored aim pins.
- [x] **C5. Improve location-based auto-name (callout fallback; no walkable-path data yet).** Use map callout/location data for start/end, not just agent/map/site. Prefer a plausible connected walkable route over Euclidean nearest-label when supported; fall back honestly when no callout/path data exists. Preserve a user-edited title and test suggestions/fallbacks.

## D. Create flow and ability semantics

- [x] **D1. Show every catalog ability in Create.** Do not hide Sova Recon Bolt (or other abilities) through an incomplete allowlist; keep game slots Q/E/C/X consistent with the catalog and test all Sova abilities.
- [x] **D2. Replace generic mode/attribute controls for recon darts.** Use a Valorant-style charge selector labelled 1st / 2nd / 3rd / Full and diamond bounce selectors (0–2), with accessible keyboard/touch controls and correct saved values.
- [x] **D3. Move throw type onto each aim capture.** Stand/aim 1 and optional second throw can have different throw types; migrate/display legacy lineup-level values without losing them. Double-shock controls must stay scoped to the selected throw.
- [x] **D4. Simplify sites.** A, B, Mid; C only on maps with three sites. Keep unknown/legacy site values readable and avoid rewriting old packs merely because the choices changed.
- [x] **D5. Add Save & create another.** Save the current lineup, then start a fresh draft retaining map, agent, ability and relevant mode settings but clearing captures, pins, title, steps and annotations. Keep existing Save / Save & Next hotkey semantics intact.
- [x] **D6. Show the current creation image large in the overlay.** Most of the overlay is the live captured/annotated image, with a small slot/progress indicator; retain capture/save hotkeys and update immediately as slots change.

## E. Overlay / Learn

- [x] **E1. Fix numeric size/margin editing.** Allow an empty intermediate value while typing; validate/clamp only on blur or Enter. Add regression tests for delete → type a multi-digit value without snapping to the minimum.
- [x] **E2. Add Browse/Learn overlay mode.** Select a lineup in Browse and send it to Learn; existing image previous/next and flip hotkeys work, with a clear minimap showing stand/land locations and accessible image/slot status.
- [x] **E3. Add Minimal overlay mode.** Image only by default (no title, controls, hotkey hints or checklist), optional outline, persisted preference; global hotkeys still switch/exit modes. Test distraction-free layout and return to normal controls.
- [x] **E4. Keep monitor/DPI placement correct across modes.** Reapply native size/position when switching Learn/Minimal/Create and preserve the Preview 3 real-monitor/DPI fix.

## Verification and delivery

- [x] **V1. Add automated regressions** for each implemented group: ZIP progress, map filtering, layout, minimap transforms/pins, creation semantics, numeric inputs, overlay modes, and real local HTTP download behavior.
- [x] **V2. Run the full checks** (TypeScript, unit tests, Rust tests/formatting, production builds, desktop/Android Playwright), review changed screenshots, and record actual results here and in the changelog.
- [x] **V3. Verify native builds in CI** on one source revision; disclose any physical Windows/Android/gameplay checks that remain untested.
- [x] **V4. Publish the next Windows + Android prerelease** after the implemented batch passes, with checksums, migration/download instructions and signing limitations. Do not label partially completed checklist items as shipped.

## Implementation order

1. A1–A6 (download and phone blockers), with B1 (ZIP progress).
2. B2–B4 and C1–C4 (Browse/Create map usability).
3. D1–D6 and E1–E4 (creation and overlay semantics).
4. C5 (location/path naming, using available catalog data), then full verification/release.

Progress notes and any necessary scope corrections are appended below as work lands.

## Progress notes — implementation batch (2026-11-07)

- Download: added `POST /connect` for explicitly started no-code LAN sharing; code-protected servers still enforce `/pair`. Android now calls additive `download_library` (full manifest, hash/revision dedupe, persistent offline copies, remote tombstones do not erase phone copies). Blank/invalid media hashes no longer request `/images/`; missing media is reported as a warning and can be retried with Update downloads. The reported `192.181.x.x` address is flagged as non-private.
- Security: sharing remains off until started; UI warns that anyone who can reach the active server can read the library and that HTTP is unencrypted. No automatic port-forwarding.
- ZIP: `read_archive_with_progress` reports actual decompressed bytes/entry names while reading; desktop preview/commit emit those events before validation/media stages.
- Minimap: one square canvas transforms art + SVG together; pointer mapping uses the transformed canvas rect (letterbox/zoom/pan safe); stand/land toggles; aim pins removed from Create map UI; empty-state action resets mobile filters/list instead of navigating into a blank view.
- Create/Browse: three square current-value pickers; TDM/range maps filtered from choices; sites A/B/Mid (+C on Haven/Lotus); all Sova abilities exposed; Recon Dart charge bars (1st/2nd/3rd/Full) + bounce diamonds; per-aim throw type; Save & create another retains setup. Location titles use optional normalized callouts when present and fall back to site; no walkable-path graph is bundled, so closest-path routing is not claimed.
- Overlay: numeric fields clamp on blur/Enter; Learn mode (renamed from View) with image hotkeys and stand/land map; Minimal image-only mode with optional outline (Alt+I); Create shows the current/last captured image large with a compact checklist.
- Local verification: TypeScript + desktop/mobile production builds; 32 UI unit tests; 32 Rust integration tests; 25 Playwright tests (21 desktop + 4 Android) including new feedback regressions. Native Windows/Android runtime and gameplay checks remain pending CI/manual validation.

- Released as [v0.1.0-preview.4](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.4). CI [42421768575](https://github.com/Alik-Green/LineupLab/actions/runs/42421768575) and Android [42421768651](https://github.com/Alik-Green/LineupLab/actions/runs/42421768651) succeeded on `99fc9664aefece0f6dc1745c4d019d43475e1ba4`; packaging run [42423140977](https://github.com/Alik-Green/LineupLab/actions/runs/42423140977) published installer/APK/checksums. Notes: `docs/releases/v0.1.0-preview.4.md`.
