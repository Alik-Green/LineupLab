# LineupLab

**Your next round, rehearsed.** A lineup library for Valorant: capture, annotate, organize, share and sync — without touching the game process.

- **Windows desktop** (Tauri 2 + Rust + React/TypeScript/Vite/Tailwind): create/edit, fast screen capture, rebindable Alt hotkeys, transparent click-through overlay, legacy ZIP import/export, opt-in LAN sync host.
- **Android companion** (Tauri 2, min SDK 26): **browse-only**, mDNS discovery, six-digit pairing, pull sync, offline browsing. No creation, overlay, hotkeys or capture.
- **Portable core** (`core/` Rust crate): SQLite metadata + SHA-256 content-addressed immutable images, typed/cached/retrying valorant-api client, legacy pack codec, deterministic sync, geometry/annotation rendering. Shared `ui/` components power both shells and a browser demo.

## Safety first

LineupLab **never** injects, hooks, attaches to, or reads Valorant/Vanguard memory. It uses only a separate overlay window, global hotkeys and normal screen capture. The only game-specific logic is window-**title** inspection to choose the capture monitor. The overlay is excluded from capture with `WDA_EXCLUDEFROMCAPTURE` (Windows 10 2004+). **Valorant must be Borderless/Windowed**; exclusive fullscreen is unsupported. No Riot assets are bundled — agent/map art is fetched and cached at runtime.

## Quick start

```bash
npm install
npm run dev                 # browser demo (synthetic placeholders) on :5173
cargo test --workspace      # portable core suite
npm run typecheck && npm test
```

Desktop / Android builds: see [`docs/BUILD.md`](docs/BUILD.md). CI artifacts: `windows-installer` (NSIS) and `android-apk`.

```bash
npm run tauri --workspace desktop -- build
npm run tauri --workspace mobile -- android init
npm run tauri --workspace mobile -- android build --apk
cargo run -p lineuplab-core --bin lineuplab-server -- --data-dir ~/.lineuplab
cargo run -p lineuplab-core --bin lineuplab-pack -- inspect fixtures/generated/legacy-sample.zip
```

## Features

- **Browse:** icon selectors, persistent filters/search/tags/favorites, interactive minimap plotting all matches, hover previews, virtualized landing-preview grid, annotated detail carousel, video, edit/duplicate/delete/favorite/share.
- **Create/edit:** five capture/drop/paste slots (`stand1 → aim1 → [stand2 → aim2] → landing`), mode-aware requirements, draggable minimap pins, metadata/attributes/steps, drafts + crash recovery, Save / Save & Next / Discard, undo/redo.
- **Annotations:** shared `AnnotatedImage` keeps exact legacy circle fields (`id,color,x,y,radius,showZoom,zoomScale,zoomSize,zoomX,zoomY`) and unknown keys; draggable clamped square lens crops the original full-resolution image; lines with normalized width, styles, arrows, labels; snapping, color keys, duplicate/nudge/copy-to-slot. Originals are never modified.
- **Packs:** the legacy ZIP is the **only** format for import and export. Safe bounded unzip, tolerant validation, preview/conflicts, transactional import + undo, canonical circle merging, dual export, numeric-string restoration, unknown data under `x_lineuplab`, optional non-destructive baked copies. See [`docs/PACK_FORMAT.md`](docs/PACK_FORMAT.md).
- **Sync:** opt-in LAN server, mDNS + manual address, six-digit pairing + bearer tokens, incremental manifest/lineups/images/push, tombstones, deterministic timestamp→revision→deviceId conflicts. Security model: [`docs/SYNC.md`](docs/SYNC.md).

## Documentation

- [`docs/BUILD.md`](docs/BUILD.md) — prerequisites, desktop/Android builds, sandbox limitations
- [`docs/PACK_FORMAT.md`](docs/PACK_FORMAT.md) — legacy ZIP mapping, round-trip semantics, open questions
- [`docs/HOTKEYS.md`](docs/HOTKEYS.md) — defaults, rebinding, capture/overlay behavior
- [`docs/SYNC.md`](docs/SYNC.md) — protocol + LAN threat model
- [`docs/COORDINATE_CHECK.md`](docs/COORDINATE_CHECK.md) — Abyss pin verification
- [`docs/WINDOWS_TEST_PLAN.md`](docs/WINDOWS_TEST_PLAN.md) — required real-Windows manual checks
- [`PROGRESS.md`](PROGRESS.md) / [`DECISIONS.md`](DECISIONS.md) — milestone log and ambiguity decisions

## Status & honesty

The portable core, shared UI, pack codec, sync server/client and Tauri shells are implemented and covered by Linux tests. **GitHub Actions is green**: the Windows NSIS installer (`windows-installer`) and Android APK (`android-apk`) are built as CI artifacts — see the latest runs on [CI](https://github.com/Alik-Green/LineupLab/actions/workflows/ci.yml) and [Android APK](https://github.com/Alik-Green/LineupLab/actions/workflows/android.yml). This sandbox itself cannot cross-compile Windows/Android (blocked egress, no SDKs), so CI is the authoritative build path. Real user packs were not supplied; pack tests use synthetic fixtures and the Abyss coordinate convention was verified against the public minimap orientation. Full verification matrix and limitations: [`docs/COMPLETION.md`](docs/COMPLETION.md).

## License

MIT. Not affiliated with or endorsed by Riot Games. VALORANT is a trademark of Riot Games, Inc.
