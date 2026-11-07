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
