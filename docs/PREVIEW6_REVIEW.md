# Preview 6 whole-app visual and regression review

This review covers the Preview 6 checklist in `docs/TODO_PREVIEW6.md`. It is based on the Linux mock UI, automated regressions and Rust core tests. It is **not** physical Pixel, native Windows, WebView2/Android WebView asset-protocol, or Valorant gameplay validation.

## Capture matrix

Final gallery: [`docs/screenshots/preview6/README.md`](screenshots/preview6/README.md).

| Context | Sizes | Coverage |
|---|---|---|
| Desktop | 2560×1440, 1440×900, 720×450, 900×700 | Browse list/map/detail/pickers/empty; Create Setup/Capture/Pins/Finish; annotation select/circle/lens/line; Import/Export and preview; all Settings tabs |
| Android | 390×844, 360×800 | Browse list/map/detail/pickers/filters/empty; Download empty/found/complete/offline; downloaded library after completion and relaunch; all companion Settings tabs |
| Overlay | 420×408 create, 640×448 and 800×538 learn, 420×236 / 800×450 minimal, 420×560 mismatched minimal window | Normal chrome, discreet hotkeys, image-only minimal mode, outline, proportion preservation |

Final matrix: **156 screenshots, 0 page runtime errors, 0 horizontal-overflow findings**. Long Settings/Import/Finish pages use full-page captures; fixed shell/navigation can appear at the viewport fold in those stitched images.

## Findings fixed during the visual pass

1. **Browse spilled below the window.** The square map wrapper forced the grid taller than the viewport at laptop/compact sizes. Browse now uses a fixed viewport-height grid with an internal scroll region; the map keeps a reachable 280px minimum and pointer coordinates remain aligned.
2. **Create chrome pushed Save out of short windows.** The long validation list consumed the rail. Validation is now a compact expandable “N checks remaining” disclosure, and the rail keeps Save / Save & create another reachable at 720×450.
3. **Android Data tables widened a 360px page.** Settings cards now constrain table overflow internally instead of expanding the layout viewport.
4. **Minimal overlay stretched in mismatched windows.** `object-fit: fill` distorted portrait/clamped windows. Minimal mode now preserves the decoded image aspect, centers it, and keeps the optional outline on the image box.
5. **Normal overlay chrome clipped the image.** Measured chrome was larger than the old 80/164px reserves. Height reserves are now 88px for Learn and 172px for Create, with a regression asserting the image ends before the navigation bar.
6. **Rapid overlay setting changes could overwrite each other.** Settings writes now merge from a synchronous latest-settings ref; a regression toggles Enabled/Click-through and commits Size/Margin before reload.
7. **Empty discovery used a success tone.** “No desktop is sharing right now” is now a warning, while successful downloads remain success/warning based on media failures.
8. **Short-window minimap could shrink below the usable minimum.** A later responsive rule was overriding the minimum; desktop Browse now explicitly preserves it.

## Map-art and zoom honesty

The tactical minimap uses the catalog `displayIcon` source. Fixture art mirrors the available source sizes: some maps are 1024×1024, others 2048×2048. The minimap canvas is laid out at the current native CSS side and zoom level rather than enlarging a small cached raster, and markers/callouts are SVG/vector text. This keeps markers sharp and avoids CSS compositor blur, but it cannot invent detail beyond the upstream tactical-map resolution. The Map selector uses loading-screen/list artwork (`splash`/`listViewIcon`) rather than the tactical minimap.

## Verification evidence

| Check | Result |
|---|---|
| TypeScript (`ui`, `desktop`, `mobile`) | pass |
| Vitest | 39/39 across 8 files |
| Playwright desktop + Android | 44/44 |
| Rust core lib/bin/integration tests | 34/34 |
| Rust doctests | CI pass (`cargo test --workspace --doc`); local sandbox toolchain lacks `rustdoc` |
| Native Windows CI / Android APK CI | pass on release source `85170a7` |
| `cargo fmt --all -- --check` | pass |
| Desktop/mobile production builds | pass |
| Workflow YAML lint | pass |
| Visual matrix | 156 captures inspected; findings above fixed |

Regression coverage includes the exact pan/cancel/resize/unmount crash, selection suppression, callouts and short-window map settings, Create navigation/final stage/pins/sites/modes/annotations, image-proportioned overlays, outline thickness, difficulty colours, real map-selector artwork, Android download persistence/refresh after relaunch, stopped-sharing discovery, and open/fresh SQLite connection visibility after download.

## Release evidence

- Same-SHA native Windows CI [42492405644](https://github.com/Alik-Green/LineupLab/actions/runs/42492405644) and Android APK [42492405608](https://github.com/Alik-Green/LineupLab/actions/runs/42492405608) succeeded on `85170a7b7056b1acd348a175f565f4c02d067547`.
- Packaging/verification run [42493554104](https://github.com/Alik-Green/LineupLab/actions/runs/42493554104) verified source equality, artifact digests, NSIS/APK structure, arm64-only badging, 16 KB alignment, ephemeral APK signing and uploaded-asset checksums, then published [v0.1.0-preview.6](https://github.com/Alik-Green/LineupLab/releases/tag/v0.1.0-preview.6).
- Checklist item 23 is closed in `docs/TODO_PREVIEW6.md`; release/install notes are in `docs/releases/v0.1.0-preview.6.md`, `docs/BUILD.md` and `docs/ANDROID_INSTALL.md`.

Unsigned Windows and ephemeral Android signing disclosures remain in force. Physical installation and gameplay validation remain user-side.