# DECISIONS

## Stack

- **Tauri 2 + React + TypeScript + Vite + Tailwind** as required. Chose Zustand for tiny global state (persisted to localStorage via custom `persist()` helper instead of middleware, to keep shape explicit and avoid hydration flicker).
- No Rust logic: only default Tauri plugin_shell. All game logic in React.
- Preferences in `localStorage` keyed `lineuplab_prefs_v1`.

## Valorant API / CSP

- Endpoints: `v1/agents?isPlayableCharacter=true`, `v1/maps`, `v1/version`. All fetched at runtime.
- Images from `media.valorant-api.com` and `valorant-api.com` allowed via Tauri `security.csp`:
  `img-src 'self' asset: http://asset.localhost https://media.valorant-api.com https://valorant-api.com data: blob:`
  and `connect-src` for API.
- Single `<ValImage>` component: skeleton, retry once with cache-bust, graceful fallback (initials), `console.warn` on failure.
- Caching: JSON stored in localStorage keyed by version (`lineuplab_agents_cache`, `lineuplab_maps_cache`). Fallback JSON snapshots in `src/data/fallback*.json` for offline/demo.
- Verified via build and manual dev run (media loads when outbound allowed).

## Layout / Design Tokens

- Tokens in `src/tokens.css` and Tailwind extend: `pageBg #1B1B1F`, `panel #2A2B32`, `tile #34353D`, `accent #E8404F`, etc. Rounded 6-8px, 120-150ms transitions.
- Top bar: `Lineups` active tab, future tabs placeholder.
- Left panel 350px fixed, scrolls. Right minimap flex-1.
- Map card: splash with gradient, dropdown grid of image tiles (not text list), Attack/Defense segmented toggle (attack red `#E8404F`).
- Agent grid: 5-col, single selection, bright if has lineups for map+side else dimmed+desaturated, still clickable.
- Abilities: show selected agent's lineup-able slots, tinted red when active, tooltip, all selected initially.
- Filters: Importance (Essential green outline, Useful white, Optional red) and Difficulty (Easy green, Normal amber, Hard red). All selected initially, pill buttons.

## Minimap

- Backdrop: blurred splash at 20% opacity.
- Minimap image (`displayIcon`) centered, size `min(container*0.82, 680px)`.
- Zoom: `+/-` buttons, wheel, drag, double-click reset, pinch-zoom (two-touch distance). Zoom clamped 0.6–3.
- Pan: mouse drag, touch drag.
- Markers: landing position, dark circle + coloured ring (importance), ability icon tinted red (`filter: invert…`). Constant 32px regardless of zoom.
- Hover: SVG path from `start → bounces → end` with arrowhead, bounce dots amber, start pin white/red with label, other markers dim 30%, tooltip card with title/chips. 150ms draw.
- Detail panel: slide-in from right (desktop) / bottom sheet (mobile), carousel for `stand/aim/landing`, notes, close via Esc/button, focus rings, back button closes panel.
- Empty state: "No lineups match your filters" + Reset.
- Performance: markers are DOM buttons (45 demo, memoised). For 1k+ would switch to canvas/R-tree; current is fine.
- Accessibility: tooltips on icons, 40px desktop/48px mobile min, colours supplemented by labels/chips, keyboard reachable.

## Data

- `Lineup` type matches spec, compatible with older pack format.
- `LineupRepository` interface (`JsonLineupRepository` loads `/lineups.json`). Settings menu lets user load a local `lineups.json` array via FileReader.
- Demo data: `scripts/generate-demo.ts` fetches real UUIDs if network available else fallback snapshots. Generates ~45 lineups covering all maps/sides/difficulties/importances, 12 with bounces, all tagged `demo` + badge. Plausible fake points normalized 0..1.

## Android / Responsive

- Breakpoint ~900px (`md:` = 768px, adjusted to spec). Below: minimap on top full-width, filters bottom sheet, map/agent horizontal strips, 48px touch targets, safe-area insets via `viewport-fit=cover`.
- `minSdkVersion 26`, portrait+landscape work.
- Android workflow: full `src-tauri/gen/android` placeholder (init requires Rust/NDK; documented as manually completed via CI).

## Build / Release

- `ci.yml` lint+typecheck+test+build on push/PR.
- `release.yml` on `v*` tags + manual_dispatch: windows job (tauri-action), android job (Java17, SDK/NDK, Rust targets, APK), release job attaches `LineupLab-<version>-windows-setup.exe` + `-android.apk` + SHA256. Secrets `ANDROID_KEYSTORE_*` used, fallback debug keystore with warning.
- Pinned actions, cached Rust/npm/Gradle.

## Alternatives considered

- Radix Popover for map dropdown → custom div for simplicity.
- Zustand persist middleware → manual to allow Set serialization.
- Canvas for minimap → SVG/DOM for easier hover/tooltip; can migrate if needed.
- Self-host Inter via Google Fonts CDN → local stub files + system fallback for offline.

## Verification gaps

- `cargo check` not run locally (Rust unavailable in sandbox) → noted in README.
- Playwright browser download blocked (cdn.playwright.dev not in egress allowlist) → screenshots generated via fallback synthetic images; real browser QA documented as untested.
