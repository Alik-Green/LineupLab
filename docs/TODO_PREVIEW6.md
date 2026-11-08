# Preview 6 — latest feedback checklist

Recorded before implementing the latest request. This supersedes the accepted Preview 5 top-bar Create layout. Automated checks and screenshots are not physical-device or gameplay validation. Preserve stored library/pack compatibility even where obsolete connection UI is removed.

## P0 — minimap crash and interaction

- [ ] **1. Fully fix `TypeError: Cannot read properties of null (reading 'tx')`.** Reproduce panning, clicking, resizing, pointer cancellation and component unmount/remount. Eliminate the unsafe nullable-pointer access rather than only catching the resulting error. Keep the error boundary as a last-resort safeguard, not the fix. Add regressions that assert no runtime errors or error boundary during the triggering gestures.
- [ ] **2. Make the minimap non-selectable.** Disable text selection, browser focus/selection styling, image dragging, touch callouts and red/highlight selection on the map itself. Individual marker actions may retain appropriate accessible focus, but dragging the map must never select it or trigger the crash.
- [ ] **3. Fix low-resolution zoom.** Audit map-art source selection, image caching, CSS transforms, SVG markers and ability icons. Use the best available map source and native-size/sharper rendering rather than scaling a small cached raster where possible. Verify markers remain vector-sharp and document any unavoidable source-image resolution limit honestly.
- [ ] **4. Fix size-dependent minimap layout.** At half-width/height as well as fullscreen 1440p, remove excessive vertical margins and oversized containing boxes. Keep the map square, reachable and correctly aligned with pointer coordinates at desktop, laptop, tablet and phone sizes.

## Create — cleaner, fewer steps and controls

- [ ] **5. Remove the entire top creation progress/Back/Next bar.** Replace it with a cleaner navigation layout, such as a compact right sidebar on wide windows and an equivalent uncluttered small-screen layout. Do not simply move the same bar elsewhere. Keep all stages, validation, draft recovery and save actions reachable.
- [ ] **6. Simplify Pins to Start and End buttons only.** Remove pin-coordinate text, Clear all pins, the surrounding explanatory copy and other unnecessary pin chrome. Arrange the two controls cleanly. Preserve dragging/repositioning and legacy pin data; retain an optional second stand only where the selected mode actually needs it.
- [ ] **7. Add a callout-text toggle to the minimap.** Show usable callout labels when enabled without interfering with panning, pins or markers. Keep the control compact and readable at zoom; provide a sensible no-data state.
- [ ] **8. Remove Preset from Setup mode.** Use the actual mode toggles directly, with correctly spaced human-readable names rather than camel case or raw identifiers. Preserve single/double/follow-up slot behaviour and saved mode compatibility.
- [ ] **9. Make annotation editing a simple Photoshop-style workspace.** Compact tool palette, large image canvas and contextual tool properties; keep circles, lines, crosshair/lens, colours, undo/redo and original-image safety. Remove repetitive instructions and counters such as `Circles: 0 · Lines: 0`.
- [ ] **10. Simplify site selection.** Only A, B and Mid by default; show C only on maps with three sites. Remove Custom site input. Safely handle legacy values without offering custom entry.
- [ ] **11. Merge Details and Review into one final stage.** Remove Notes, Author and Tags from Create editing (preserve existing stored values for compatibility). Reorganize title, side, site, difficulty, favourite and useful steps cleanly; remove most of the old Review page while retaining a preview, actionable validation and Save / Save & create another.

## Overlay and Browse

- [ ] **12. Make the normal overlay image large and correctly proportioned.** Derive the window/content aspect ratio from the lineup image rather than leaving a tiny centred image. Keep only size and margin controls, with one combined horizontal/vertical margin value. Migrate existing overlay settings safely.
- [ ] **13. Make Minimal overlay match the image's exact aspect ratio.** Remove unnecessary letterboxing while retaining the optional outline and image-only appearance.
- [ ] **14. Show discreet normal-mode hotkey hints.** Include next/previous image and other useful navigation/action shortcuts without obscuring the image or reintroducing clutter.
- [ ] **15. Add adjustable minimal-outline thickness.** Make the default noticeably thicker and expose a compact thickness slider with safe limits.
- [ ] **16. Colour difficulty dots by position.** First dot green, second orange, third red; inactive dots remain subdued. Apply consistently wherever difficulty is rendered.
- [ ] **17. Use real map loading-screen artwork for the Map selector icon.** Do not substitute the tactical minimap for the map selector. Keep the minimap itself as the correct navigable tactical map. Handle unavailable artwork without layout shifts.

## Android Download / connection lifecycle

- [ ] **18. Remove the obsolete access-code desktop connection UI.** The current trusted-LAN Download flow is the supported UI; do not retain an older-desktop compatibility panel. Preserve data and document the removal.
- [ ] **19. Make Connect & download actually populate the visible library.** Audit the complete fetch/import/persist/refresh path. If connection alone intentionally only checks a server, make the supported flow automatically download and show lineups, with clear progress and failures. Add an end-to-end regression proving downloaded records appear in Browse after completion/relaunch.
- [ ] **20. Stop stale desktop discovery after sharing stops/app closes.** Audit discovery/cache/TTL and connection state. A remembered address may remain editable, but it must not be shown as an available/live desktop after shutdown; reconnect/download attempts must fail cleanly and refresh status. Test stop-sharing and stale-cache behaviour.

## Whole-app review and delivery

- [ ] **21. Review every page at multiple window sizes.** Capture Browse (list/map/detail/pickers/empty), every Create stage and annotation tool, Import/Export, Settings tabs, overlay normal/minimal, and Android Browse/Download/Settings. Include 2560×1440, 1440×900, roughly half-width/height, narrow desktop and phone sizes. Remove unnecessary text/chrome and fix spacing/overflow based on the screenshots, not just tests.
- [ ] **22. Add regressions and run checks.** Cover the exact pan/cancel/resize crash, selection suppression, callouts, new Create navigation/final stage, simplified pins/sites/modes, annotations, image-proportioned overlays, outline thickness, difficulty colours, real map artwork and Android download/discovery lifecycle. Run typecheck, unit/Rust tests, production builds, full desktop/Android Playwright and formatting checks.
- [ ] **23. Verify and publish the next prerelease.** Inspect native CI and Android packaging checks; update release/install notes and this checklist with actual evidence. Publish only after checks pass. Do not claim physical Pixel/Windows/gameplay validation. Retain unsigned Windows and ephemeral Android signing disclosures.

## Findings / verification log

-To be populated during reproduction and implementation.
