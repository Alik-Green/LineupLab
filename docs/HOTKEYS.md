# Hotkeys, capture and overlay

All shortcuts are rebindable and **must include Alt**. Canonical modifier order is `Ctrl+Alt+Shift+Meta+Key`. Conflicts are detected before registration and reported in Settings; the platform provider also rejects duplicate registrations.

## Defaults

| Action | Keys |
|---|---|
| Capture current slot | Alt+C |
| Crosshair circle | Alt+X |
| Retake last capture | Alt+R |
| Next / previous slot | Alt+N / Alt+P |
| Select stand / aim / stand2 / aim2 / landing | Alt+1 … Alt+5 |
| Save / Save & Next | Alt+S / Alt+Shift+S |
| Discard draft | Alt+D |
| Undo / Redo | Alt+Z / Alt+Y |
| Show/hide overlay | Alt+V |
| Overlay controls (toggle click-through) | Alt+O |
| Toggle Create/View overlay mode | Alt+M |
| View next / previous image | Alt+Right / Alt+Left |
| View flip steps/notes | Alt+F |
| Create toggle checklist | Alt+H |

`core::hotkeys` is portable; `HotkeyProvider` is implemented by the Windows shell and by `MockHotkeyProvider` on Linux. The shared UI mirrors normalization/conflict logic for immediate feedback.

## Capture

Defaults: max width **1600 px**, quality **85**, WebP (JPEG fallback), separate thumbnail, target **<150 ms**. `capture_processed` measures elapsed time and reports `exceededTarget` rather than silently dropping frames. Originals are immutable SHA-256 objects. The Windows adapter must call `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` on the overlay before capture; failure blocks capture (Windows 10 2004+).

## Overlay

Separate transparent/frameless/non-focusable/always-on-top window; **click-through by default**. Settings: corner, monitor, margins, size, opacity (0.2–1.0). Create mode shows the required-slot checklist; View mode flips through images/minimap/steps/notes. `core::overlay` holds portable state and positioning math; the Tauri shell owns the actual window.

Safety: no game handles, memory reads, hooks, injection, or Vanguard interaction. Only window **title** inspection is used to choose the capture monitor. Valorant must be Borderless/Windowed.
