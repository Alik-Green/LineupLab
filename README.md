# LineupLab

Valorant lineups browser (UI only) styled like the OP.GG lineups page. Browse curated demo lineups by map, side, agent, ability, importance and difficulty. Built with **Tauri 2 + React + TypeScript + Vite + Tailwind** — one codebase for Windows and Android.

![LineupLab](docs/screenshots/desktop-default.png)

> Demo data only — no capture/overlay/sync yet. See `DECISIONS.md` for roadmap.

## Features

- Map picker (splash banner + dropdown tile grid), Attack/Defense toggle
- Agent grid (5-col, highlights agents with lineups for current map/side)
- Ability toggles (multi-select, filtered per agent)
- Importance (Essential/useful/optional) + Difficulty (easy/normal/hard) pill filters — all selected by default
- Minimap with zoom (+/−, wheel, drag, pinch, double-click reset), lineup markers (ring = importance), hover path + start pin, tooltip, detail panel with carousel
- Responsive: desktop two-column, mobile minimap-on-top + bottom sheet
- Offline: valorant-api data cached by game version, images via HTTP cache; fallback snapshots bundled
- Load custom `lineups.json` via Settings → Load file
- Clean dark OP.GG-like theme, 40/48px targets, keyboard accessible, skeleton loaders

## Tech

- State: Zustand + localStorage persistence
- One `<ValImage>` for all game art: skeleton, retry once, graceful fallback, never broken icon
- CSP allows `https://media.valorant-api.com`, `https://valorant-api.com`, `data:`, `blob:`
- No database / no Rust logic beyond Tauri defaults

## Dev setup

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc + vite build → dist/
npm run test      # vitest
npm run generate-demo  # regenerate public/lineups.json (needs valorant-api outbound)
```

Prerequisites: Node 20, Rust 1.77+ for Tauri native builds (optional for web-only).

## Build (native)

```bash
npm run tauri build        # Windows NSIS .exe
npm run tauri android build -- --apk  # Android debug/apk
```

See `docs/RELEASING.md` for release flow and keystore setup.

## Screenshots

- `docs/screenshots/desktop-default.png` — 1440×900 default
- `docs/screenshots/desktop-agent-selected.png` — agent selected
- `docs/screenshots/desktop-hover.png` — marker hover (path + start)
- `docs/screenshots/desktop-detail.png` — detail panel
- `docs/screenshots/desktop-filters-deselected.png` — partial filters
- `docs/screenshots/desktop-map-dropdown.png` — map picker open
- `docs/screenshots/mobile-390.png` — 390×844 mobile
- `docs/screenshots/loading.png` / `empty.png`

## Project structure

```
src/
  components/  ValImage, TopBar, MapCard, AgentGrid, AbilityBar, FiltersCard, Minimap, DetailPanel
  lib/         valorantApi (cache by version), lineupRepository, filtering (pure helpers)
  stores/      appStore (zustand)
  hooks/       useValorantData
  data/        fallbackAgents/Maps.json
scripts/generate-demo.ts
public/lineups.json  (45 demo lineups)
src-tauri/        Tauri config + icons + android placeholder
.github/workflows/ ci.yml, release.yml
```

## What works / untested / next

- **Works:** browse UI, filters, minimap interactions, responsive, demo data, CI build.
- **Untested on Linux:** Windows/Android native builds (`cargo check` not run;Rust not in sandbox, SmartScreen unsigned warning expected).
- **Playwright screenshots:** synthetic fallbacks — real browser QA blocked by egress allowlist (cdn.playwright.dev).
- **Next:** creation flow, capture hotkeys, overlay, LAN sync, pack import (DB-backed repository).

## License

MIT
