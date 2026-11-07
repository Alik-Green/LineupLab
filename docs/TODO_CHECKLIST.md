# LineupLab — user feedback implementation checklist

Created 2026-11-07 from the latest Windows/Android feedback. This is the working acceptance checklist, not a claim that every item is finished. Check items only after implementation and the relevant automated check; native Windows/phone checks remain explicitly marked.

## A. Get content onto the phone / unblock testing

- [ ] **A1. Fix the reported `404 /images/` download failure.** Reproduce empty/invalid media references, skip missing/blank hashes safely, report partial failures rather than aborting the entire download, and add a real HTTP server/client regression test. Validate the server address and explain that `192.181.x.x` is not a private LAN range (typical home addresses are `192.168.x.x`, `10.x.x.x`, or `172.16–31.x.x`).
- [ ] **A2. Make downloading clearly one-way and persistent on Android.** Rename Sync/Pair to Connect / Download library / Update downloads. Download all available lineups and referenced media, skip duplicate content, keep an offline local copy, show counts/progress/errors and last successful download. Do not push phone edits or silently erase previously downloaded phone content.
- [ ] **A3. Remove the required pairing-code step.** Support one-tap connect on the explicitly started trusted-LAN sharing server, while retaining compatibility with code-protected older servers. LAN is not risk-free: show that anyone who can reach the active sharing server can read the library; never enable sharing or port-forward automatically. Keep stop sharing obvious.
- [ ] **A4. Add download progress and useful diagnostics.** Expose manifest/image/saving progress, retry failed items, distinguish connection/HTTP/missing-media errors, and test a complete download followed by an incremental no-duplicate update.
- [ ] **A5. Fix Android empty-minimap grey-screen navigation.** Empty-state actions must not open an invalid detail/blank page; Back must recover. Add a phone-viewport regression test for no-match map → filters/reset → browse.
- [ ] **A6. Respect phone notches/cutouts.** Safe-area padding at the top and bottom, including dialogs/drawers; verify mocked narrow Android viewports and document the remaining physical-device check.

## B. Import and Browse

- [ ] **B1. Show real ZIP reading/decompression progress.** Stream/read the selected file and decompress entries with byte/entry progress (not an indeterminate bar for the entire operation). Keep the UI responsive, report the current entry and bytes, handle errors/cancellation, and preserve ZIP safety/legacy compatibility.
- [ ] **B2. Exclude team-deathmatch/non-standard maps from map choices.** Filter the catalog shown in Browse/Create while retaining archived lineup references and old-pack data. Add a fixture/test so standard maps remain available.
- [ ] **B3. Make the three selectors compact icon squares.** Map / Agent / Ability sit next to one another at the top in three equal icon-led squares showing the current choice; clicking opens the complete picker. Apply to desktop Browse and Create, with a touch-friendly Android equivalent.
- [ ] **B4. Fix short-window Browse layout.** No clipping of the map side; allow vertical scrolling and give the minimap a sensible minimum size. Test short desktop heights and narrow Android widths without horizontal overflow.

## C. Minimap and map locations

- [ ] **C1. Fix minimap zoom/pan art alignment.** Transform the map image and SVG markers together around the pointer/viewport center; constrain pan, support reset, and test toolbar/wheel zoom and coordinate alignment.
- [ ] **C2. Show stand and landing positions.** Add distinct start/end markers and optional independent Show stand / Show landing toggles (plus existing throw-line toggle), in Browse, detail/learn and Create as appropriate.
- [ ] **C3. Fix Create pin placement under the cursor.** Account for image letterboxing, zoom, pan and container aspect ratio in both directions. Add coordinate round-trip tests at non-square sizes and zoom levels.
- [ ] **C4. Simplify map pins.** Required Stand and Land; optional Second stand only for a two-throw lineup; bounce diamonds when relevant. Remove aim-position pins from the map UI without destroying legacy stored aim pins.
- [ ] **C5. Improve location-based auto-name.** Use map callout/location data for start/end, not just agent/map/site. Prefer a plausible connected walkable route over Euclidean nearest-label when supported; fall back honestly when no callout/path data exists. Preserve a user-edited title and test suggestions/fallbacks.

## D. Create flow and ability semantics

- [ ] **D1. Show every catalog ability in Create.** Do not hide Sova Recon Bolt (or other abilities) through an incomplete allowlist; keep game slots Q/E/C/X consistent with the catalog and test all Sova abilities.
- [ ] **D2. Replace generic mode/attribute controls for recon darts.** Use a Valorant-style charge selector labelled 1st / 2nd / 3rd / Full and diamond bounce selectors (0–2), with accessible keyboard/touch controls and correct saved values.
- [ ] **D3. Move throw type onto each aim capture.** Stand/aim 1 and optional second throw can have different throw types; migrate/display legacy lineup-level values without losing them. Double-shock controls must stay scoped to the selected throw.
- [ ] **D4. Simplify sites.** A, B, Mid; C only on maps with three sites. Keep unknown/legacy site values readable and avoid rewriting old packs merely because the choices changed.
- [ ] **D5. Add Save & create another.** Save the current lineup, then start a fresh draft retaining map, agent, ability and relevant mode settings but clearing captures, pins, title, steps and annotations. Keep existing Save / Save & Next hotkey semantics intact.
- [ ] **D6. Show the current creation image large in the overlay.** Most of the overlay is the live captured/annotated image, with a small slot/progress indicator; retain capture/save hotkeys and update immediately as slots change.

## E. Overlay / Learn

- [ ] **E1. Fix numeric size/margin editing.** Allow an empty intermediate value while typing; validate/clamp only on blur or Enter. Add regression tests for delete → type a multi-digit value without snapping to the minimum.
- [ ] **E2. Add Browse/Learn overlay mode.** Select a lineup in Browse and send it to Learn; existing image previous/next and flip hotkeys work, with a clear minimap showing stand/land locations and accessible image/slot status.
- [ ] **E3. Add Minimal overlay mode.** Image only by default (no title, controls, hotkey hints or checklist), optional outline, persisted preference; global hotkeys still switch/exit modes. Test distraction-free layout and return to normal controls.
- [ ] **E4. Keep monitor/DPI placement correct across modes.** Reapply native size/position when switching Learn/Minimal/Create and preserve the Preview 3 real-monitor/DPI fix.

## Verification and delivery

- [ ] **V1. Add automated regressions** for each implemented group: ZIP progress, map filtering, layout, minimap transforms/pins, creation semantics, numeric inputs, overlay modes, and real local HTTP download behavior.
- [ ] **V2. Run the full checks** (TypeScript, unit tests, Rust tests/formatting, production builds, desktop/Android Playwright), review changed screenshots, and record actual results here and in the changelog.
- [ ] **V3. Verify native builds in CI** on one source revision; disclose any physical Windows/Android/gameplay checks that remain untested.
- [ ] **V4. Publish the next Windows + Android prerelease** after the implemented batch passes, with checksums, migration/download instructions and signing limitations. Do not label partially completed checklist items as shipped.

## Implementation order

1. A1–A6 (download and phone blockers), with B1 (ZIP progress).
2. B2–B4 and C1–C4 (Browse/Create map usability).
3. D1–D6 and E1–E4 (creation and overlay semantics).
4. C5 (location/path naming, using available catalog data), then full verification/release.

Progress notes and any necessary scope corrections are appended below as work lands.
