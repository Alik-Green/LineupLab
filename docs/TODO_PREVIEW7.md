# Preview 7 — reported Preview 6 failures

Recorded from the latest device/window feedback. Automated browser/core checks are not physical-device or gameplay validation. Stored libraries, legacy packs and saved annotations must remain compatible.

## P0 — Android Download still unusable

- [x] **1. Stop the endless spinner after “150 images / 46 lineups downloaded”.** Split library, catalog and mode refreshes so a slow/offline catalog cannot hold the Download button or Browse hostage. The download completion path reloads the library first; optional catalog refresh is non-blocking and bounded.
- [x] **2. Make downloaded lineups visible in Browse.** Phone Browse now reads all non-deleted downloaded records (including drafts saved by the desktop). A post-download readback fails loudly if the saved library cannot be displayed. Browse no longer hides a fresh library behind an arbitrary first-map filter; stale map/agent filters are cleared.
- [x] **3. Make map/agent/ability options appear on the phone.** Add an authenticated desktop `GET /catalog` route and transfer the desktop cached catalog during Download. Phone `get_catalog` is cache-first and never waits on valorant-api.com. Legacy map/agent IDs are archived into the catalog so old lineups remain filterable.
- [x] **4. Add native-path regressions.** Core test covers authenticated catalog transfer and legacy-map archiving. Android Playwright covers Download completing and Browse remaining usable when the catalog command fails. Mock-only success is not treated as device validation.
- [ ] **5. Physical Pixel 9 confirmation.** Install the Preview 7 APK over the existing companion, connect to the Windows desktop, download the real 46-lineup library, force-stop/reopen, and confirm Browse/pickers offline. Pending user/device verification.

## Minimap

- [x] **6. Cursor-anchored zoom.** Measure the rectangular stage, position the square canvas from a fixed unzoomed base, and use the same base for wheel zoom, pointer mapping and pan clamping.
- [x] **7. Reach the whole map when zoomed.** Clamp the scaled canvas against the actual stage width/height instead of the base square. Unit and Playwright regressions cover cursor anchoring and opposite-edge/corner panning.

## Create / Browse layout

- [x] **8. Picker text and gradient flush to the square.** Final square-trigger overrides remove padding regression; artwork fills the trigger and the label/gradient are absolutely positioned across the full bottom edge.
- [x] **9. Annotate usable small and fullscreen.** The annotation workspace owns the viewport under the top bar, hides the Create rail while annotating, and switches properties to a bounded bottom panel on narrow/short windows. Verified at 720×450 and 2560×1440.
- [x] **10. Other Create pages remain responsive.** Setup/Capture/Pins/Details keep the fluid Preview 6 layout; large-screen page cap removed without changing small-window behavior.
- [x] **11. Fill large screens.** Remove the 1920px centered `.ll-page` cap so Browse/Create use 2560px-wide windows instead of leaving a large left margin.

## Overlay / settings / annotations

- [x] **12. Click-through ON by default.** Core and UI defaults remain `clickThrough: true`; regression asserts the default. Existing saved settings are preserved.
- [x] **13. Settings save reliably.** Capture settings now use the same stale-closure-safe ref pattern as overlay settings; save failures surface a toast. Rapid-edit persistence regression added.
- [x] **14. Annotations align at every size.** Render the image with contain geometry, measure the outer box, and place SVG annotation/hit layers on the exact decoded-aspect frame. Pointer math uses that frame. Unit, click-placement and overlay proportion regressions added.

## Release gate

- [x] Local automated checks: typecheck; Vitest 43/43; Playwright 51/51; core 35/35; `cargo fmt`; desktop/mobile UI builds.
- [x] Native Windows CI and Android CI green on the release source commit: [42499622966](https://github.com/Alik-Green/LineupLab/actions/runs/42499622966) and [42499623009](https://github.com/Alik-Green/LineupLab/actions/runs/42499623009) on `b5f2d54`.
- [x] Release packaging workflow green; exe/APK/SHA256SUMS published: [42500733982](https://github.com/Alik-Green/LineupLab/actions/runs/42500733982), [v0.1.0-preview.7](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.7).
- [x] Release notes/install docs updated with unsigned-Windows and ephemeral-APK-key disclosures.
