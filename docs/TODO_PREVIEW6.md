# Preview 6 — latest feedback checklist

Recorded before implementing the latest request. This supersedes the accepted Preview 5 top-bar Create layout. Automated checks and screenshots are not physical-device or gameplay validation. Preserve stored library/pack compatibility even where obsolete connection UI is removed.

## P0 — minimap crash and interaction

- [x] **1. Fully fix `TypeError: Cannot read properties of null (reading 'tx')`.** Reproduce panning, clicking, resizing, pointer cancellation and component unmount/remount. Eliminate the unsafe nullable-pointer access rather than only catching the resulting error. Keep the error boundary as a last-resort safeguard, not the fix. Add regressions that assert no runtime errors or error boundary during the triggering gestures.
- [x] **2. Make the minimap non-selectable.** Disable text selection, browser focus/selection styling, image dragging, touch callouts and red/highlight selection on the map itself. Individual marker actions may retain appropriate accessible focus, but dragging the map must never select it or trigger the crash.
- [x] **3. Fix low-resolution zoom.** Audit map-art source selection, image caching, CSS transforms, SVG markers and ability icons. Use the best available map source and native-size/sharper rendering rather than scaling a small cached raster where possible. Verify markers remain vector-sharp and document any unavoidable source-image resolution limit honestly.
- [x] **4. Fix size-dependent minimap layout.** At half-width/height as well as fullscreen 1440p, remove excessive vertical margins and oversized containing boxes. Keep the map square, reachable and correctly aligned with pointer coordinates at desktop, laptop, tablet and phone sizes.

## Create — cleaner, fewer steps and controls

- [x] **5. Remove the entire top creation progress/Back/Next bar.** Replace it with a cleaner navigation layout, such as a compact right sidebar on wide windows and an equivalent uncluttered small-screen layout. Do not simply move the same bar elsewhere. Keep all stages, validation, draft recovery and save actions reachable.
- [x] **6. Simplify Pins to Start and End buttons only.** Remove pin-coordinate text, Clear all pins, the surrounding explanatory copy and other unnecessary pin chrome. Arrange the two controls cleanly. Preserve dragging/repositioning and legacy pin data; retain an optional second stand only where the selected mode actually needs it.
- [x] **7. Add a callout-text toggle to the minimap.** Show usable callout labels when enabled without interfering with panning, pins or markers. Keep the control compact and readable at zoom; provide a sensible no-data state.
- [x] **8. Remove Preset from Setup mode.** Use the actual mode toggles directly, with correctly spaced human-readable names rather than camel case or raw identifiers. Preserve single/double/follow-up slot behaviour and saved mode compatibility.
- [x] **9. Make annotation editing a simple Photoshop-style workspace.** Compact tool palette, large image canvas and contextual tool properties; keep circles, lines, crosshair/lens, colours, undo/redo and original-image safety. Remove repetitive instructions and counters such as `Circles: 0 · Lines: 0`.
- [x] **10. Simplify site selection.** Only A, B and Mid by default; show C only on maps with three sites. Remove Custom site input. Safely handle legacy values without offering custom entry.
- [x] **11. Merge Details and Review into one final stage.** Remove Notes, Author and Tags from Create editing (preserve existing stored values for compatibility). Reorganize title, side, site, difficulty, favourite and useful steps cleanly; remove most of the old Review page while retaining a preview, actionable validation and Save / Save & create another.

## Overlay and Browse

- [x] **12. Make the normal overlay image large and correctly proportioned.** Derive the window/content aspect ratio from the lineup image rather than leaving a tiny centred image. Keep only size and margin controls, with one combined horizontal/vertical margin value. Migrate existing overlay settings safely.
- [x] **13. Make Minimal overlay match the image's exact aspect ratio.** Remove unnecessary letterboxing while retaining the optional outline and image-only appearance.
- [x] **14. Show discreet normal-mode hotkey hints.** Include next/previous image and other useful navigation/action shortcuts without obscuring the image or reintroducing clutter.
- [x] **15. Add adjustable minimal-outline thickness.** Make the default noticeably thicker and expose a compact thickness slider with safe limits.
- [x] **16. Colour difficulty dots by position.** First dot green, second orange, third red; inactive dots remain subdued. Apply consistently wherever difficulty is rendered.
- [x] **17. Use real map loading-screen artwork for the Map selector icon.** Do not substitute the tactical minimap for the map selector. Keep the minimap itself as the correct navigable tactical map. Handle unavailable artwork without layout shifts.

## Android Download / connection lifecycle

- [x] **18. Remove the obsolete access-code desktop connection UI.** The current trusted-LAN Download flow is the supported UI; do not retain an older-desktop compatibility panel. Preserve data and document the removal.
- [x] **19. Make Connect & download actually populate the visible library.** Audit the complete fetch/import/persist/refresh path. If connection alone intentionally only checks a server, make the supported flow automatically download and show lineups, with clear progress and failures. Add an end-to-end regression proving downloaded records appear in Browse after completion/relaunch.
- [x] **20. Stop stale desktop discovery after sharing stops/app closes.** Audit discovery/cache/TTL and connection state. A remembered address may remain editable, but it must not be shown as an available/live desktop after shutdown; reconnect/download attempts must fail cleanly and refresh status. Test stop-sharing and stale-cache behaviour.

## Whole-app review and delivery

- [x] **21. Review every page at multiple window sizes.** Capture Browse (list/map/detail/pickers/empty), every Create stage and annotation tool, Import/Export, Settings tabs, overlay normal/minimal, and Android Browse/Download/Settings. Include 2560×1440, 1440×900, roughly half-width/height, narrow desktop and phone sizes. Remove unnecessary text/chrome and fix spacing/overflow based on the screenshots, not just tests.
- [x] **22. Add regressions and run checks.** Cover the exact pan/cancel/resize crash, selection suppression, callouts, new Create navigation/final stage, simplified pins/sites/modes, annotations, image-proportioned overlays, outline thickness, difficulty colours, real map artwork and Android download/discovery lifecycle. Run typecheck, unit/Rust tests, production builds, full desktop/Android Playwright and formatting checks.
- [x] **23. Verify and publish the next prerelease.** Inspect native CI and Android packaging checks; update release/install notes and this checklist with actual evidence. Publish only after checks pass. Do not claim physical Pixel/Windows/gameplay validation. Retain unsigned Windows and ephemeral Android signing disclosures.

## Findings / verification log

- Reproduced the original minimap crash (`null` gesture snapshot read inside a queued pointermove updater). Fix uses an immutable gesture snapshot plus blur/cancel/unmount cleanup; `.work/p6-crash-before.mjs` reports boundary 0 after the fix. `e2e/minimap.spec.ts` covers pan/cancel/resize/unmount, selection suppression, callouts and short-window settings.
- Visual review: 156 screenshots across 2560×1440, 1440×900, 720×450, 900×700, Android 390×844/360×800 and normal/minimal overlays; final matrix has 0 runtime errors and 0 horizontal overflow. Gallery: `docs/screenshots/preview6/README.md`. Findings/fixes: `docs/PREVIEW6_REVIEW.md`.
- Local checks: TypeScript pass; Vitest 39/39 (8 files); Playwright desktop+Android 44/44; Rust core lib/bin/integration 34/34; `cargo fmt --all -- --check` pass; desktop/mobile production builds pass; workflow YAML lint pass. Rust doctests are CI-only in this sandbox because `rustdoc` is absent from the local toolchain.
- Map-art limit: tactical minimap source is the catalog `displayIcon` (fixture sources include 1024² and 2048²). Canvas is laid out at native CSS size/zoom and markers/callouts are SVG; upstream bitmap detail cannot be increased. Map selector uses splash/list artwork, not the tactical minimap.
- Android Download now connects, downloads, persists and refreshes Browse via callback + DOM/Tauri library-changed events; regression proves records after completion and relaunch. Discovery probes live `/health`, mDNS unregisters on stop and desktop `RunEvent::Exit`; stopped/stale servers are not shown as live. No-code flow is trusted-LAN only; configured codes remain enforced.
- Overlay height reserves measured from rendered chrome: minimal 0, Learn 88px, Create 172px; minimal mode preserves decoded aspect in mismatched windows; outline default 3px, range 1–12px; combined margin writes marginX/marginY. Native physical sizing/gameplay remains CI/user-side.
- Released as [v0.1.0-preview.6](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.6) from `85170a7b7056b1acd348a175f565f4c02d067547`. Same-SHA CI [42492405644](https://github.com/Alik-Green/LineupLab/actions/runs/42492405644) and Android APK [42492405608](https://github.com/Alik-Green/LineupLab/actions/runs/42492405608) succeeded; packaging/verification run [42493554104](https://github.com/Alik-Green/LineupLab/actions/runs/42493554104) published installer/arm64 APK/checksums after source equality, digests, NSIS/APK structure, arm64-only badging, 16 KB alignment, ephemeral signing and uploaded-asset checksum verification. Assets: installer 8,466,502 B, APK 23,992,359 B. Notes: `docs/releases/v0.1.0-preview.6.md`. No physical Pixel/Windows/gameplay validation is claimed.
