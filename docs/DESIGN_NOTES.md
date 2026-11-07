# LineupLab UI design notes

## References and access

The sandbox only allows GitHub/npm/package hosts, so I could not open lineupsvalorant.com, Blitz, Mobalytics, Overwolf, Linear or Discord directly for screenshot review. The direction below is based on established patterns from those products and the Valorant client, not copied assets or branding:

- **Valorant client:** dark neutral surfaces, condensed uppercase labels, sharp/chamfered primary actions, red used for selection/primary intent rather than tinting every surface.
- **Linear:** calm hierarchy, generous spacing, keyboard-first controls, restrained color, clear active states and fast 120–180 ms transitions.
- **Discord:** durable dark shell, readable muted text, compact status chips, consistent iconography and predictable navigation.
- **Blitz / Mobalytics / lineup sites:** entity-first browsing (map → agent → ability), large annotated landing images, side/site metadata chips, minimap context beside cards.
- **Overwolf in-game apps:** high-contrast translucent overlay panels, minimum readable text, hotkey hints, click-through-safe controls.

No Riot artwork, logos or fonts are bundled. Game art is fetched/cached at runtime; UI fonts are self-hosted Inter + Barlow Condensed from npm.

## Tokens

Defined once in `ui/src/styles/app.css` (`:root` CSS variables + Tailwind v4 `@theme`):

- Background `#0E1015`, surface `#151821`, raised `#1D212C`, border `#2A2F3D`.
- Text `#ECE8E1`, muted `#8B91A3`.
- Accent red `#FF4655` / hover `#FF6573` / pressed `#D93A48`; success `#3DDC97`, warning `#F5A524`.
- Side semantics: attack `#FF8A4C`, defense `#4CC9F0`, always paired with labels/icons (never color alone).
- Type scale 12/14/16/20/28; body minimum 14 px; display face Barlow Condensed uppercase with letter-spacing; body Inter.
- Geometry: 2–4 px radius generally; ~8 px chamfer on primary buttons and selected picker tiles; 1 px borders; shadows only on overlays/popovers.
- Control height: 40 px desktop, 48 px Android (`data-platform` on `.ll-app`). Visible focus rings, hover/pressed/disabled states, reduced-motion support.

## Component library

`ui/src/components/ui.tsx`: Button, IconButton, Chip, Segmented, IconPicker, Card, PageHeader, Modal, Drawer, ToastProvider/useToast, Tooltip, Tabs, Stepper, Kbd, Skeleton, EmptyState, ProgressBar, Slider, Toggle, Input/TextArea/Select, StatusDot. Game entities use `IconPicker`/`ValImage`, never raw native selects.

## Shell

Slim sticky top bar: logo, large uppercase nav with red active underline, game-version/data-status chip, library/sync indicator, native window controls on Windows (custom title bar, drag region). Android uses bottom navigation and safe-area padding. Global toasts and first-run download modal share the same tokens.

## Create wizard

The editor is a five-step wizard (Setup, Capture, Pins, Details, Review) with a persistent stepper, autosave indicator and draft-recovery banner. Setup uses the same icon pickers as Browse so entity selection is visual everywhere. Capture keeps a left slot rail with hotkey hints and required/optional/done states next to a large stage; annotation tools live in a right inspector only when requested, keeping the capture view uncluttered. Pins gives the minimap most of the width with a compact tool palette and coordinate readout. Details groups metadata into a two-column form with a step editor beside it. Review shows the card preview, minimap and a validation checklist whose items jump back to the offending step. Validation mirrors the Rust core (`validate_save`) so the UI never promises a save the backend would reject.

## Import/Export and Settings

Import/Export uses two asymmetric cards: the import side owns the dropzone and a dense preview table (status pills, per-row warnings, checkbox selection that excludes broken entries), while the export side summarises the library and exposes the legacy-compatibility toggles. Settings is a horizontal tab bar over two-column card grids; tables are used only where rows are genuinely tabular (hotkeys, cache report, import preview). The overlay tab pairs the form with a live 16:9 monitor preview so placement changes are visible immediately, and the sync tab renders the pairing code at display size for reading across a desk.

## Overlay

The overlay is a compact, translucent instrument panel rather than a second app window: a single header row (title, mode, controls, hide), a dense checklist with 72px capture thumbnails and required-progress bar in Create, and a fitted 16:9 annotated image with a one-line step caption in View. Flipping View swaps the image for a small minimap plus scrollable steps/notes. All text is at least 13px and every control is 40px; content scale enlarges text/thumbnails without shrinking below the readability floor. Settings pairs the monitor placement preview with a full-size content preview so opacity, corner, scale and annotation visibility can be judged without launching the native window.

## Android companion

The companion is browse-only and thumb-first: a sticky bottom tab bar (Browse/Sync/Settings), a single-column card feed with always-visible actions, and a Filters drawer instead of the desktop sidebar. A list/map segmented toggle swaps the feed for a square minimap with enlarged markers and no legend overlay. Lineup detail and filters are full-width drawers with 48px controls and a sticky footer action. Sync reduces to the pairing card (discover → address/code → pair → sync), and Settings keeps only companion-relevant tabs.
