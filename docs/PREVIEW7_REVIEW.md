# Preview 7 regression review

Covers `docs/TODO_PREVIEW7.md`. Linux mock UI + Rust core integration tests + native CI builds. **Not** physical Pixel/Windows or gameplay validation.

## Automated results

| Check | Result |
|---|---|
| TypeScript | pass |
| Vitest | 43/43 |
| Playwright desktop + Android | 51/51 |
| Rust core lib/bin/integration | 35/35 |
| `cargo fmt --check` | pass |
| Desktop/mobile UI production builds | pass |
| Native CI on `b5f2d54` | [42499622966](https://github.com/Alik-Green/LineupLab/actions/runs/42499622966) success |
| Android APK on `b5f2d54` | [42499623009](https://github.com/Alik-Green/LineupLab/actions/runs/42499623009) success |
| Release packaging | [42500733982](https://github.com/Alik-Green/LineupLab/actions/runs/42500733982) success |

## Targeted screenshots

`docs/screenshots/preview7/`:

- `desktop-browse-1440.png`, `desktop-browse-2560.png` — large-screen fill and picker layout.
- `desktop-create-setup-2560.png` — Create no longer capped at 1920px.
- `desktop-annotate-720x450.png`, `desktop-annotate-2560.png` — annotation workspace small/fullscreen.
- `overlay-minimal-420x560.png` — image aspect preserved in a mismatched window.
- `android-download-catalog-offline.png`, `android-browse-after-download.png` — Download completes and Browse shows records while the catalog command fails.

## Key regressions added

- Core: authenticated `GET /catalog`, legacy-map archiving, unauthorized catalog rejection.
- Android: Download finishes with a failing catalog command; Browse remains usable; existing relaunch/persistence tests still pass.
- Minimap: unit cursor-anchor/pan-extreme tests; Playwright wheel anchor and opposite-edge drag.
- Picker: bottom/full-width gradient and artwork coverage assertions.
- Annotation: contain-frame unit test; click lands at image center; overlay proportion tests.
- Layout/settings: 720×450/2560×1440 annotate workspace; large-screen Browse/Create; rapid capture-settings persistence; click-through default.

## Still pending

Physical Pixel 9 install/upgrade, real 46-lineup LAN download, force-stop/reopen offline Browse/pickers, Windows overlay click-through/capture exclusion under Valorant. The release is automated-build verified, not device/gameplay certified.
