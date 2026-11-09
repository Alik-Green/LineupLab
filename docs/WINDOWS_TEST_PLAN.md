# Windows manual test plan

Automated CI compiles the Windows installer and runs the portable core/UI suites. The following **must be exercised on a real Windows 10 2004+ / Windows 11 machine** because capture, global hotkeys, overlay affinity and WebView2 cannot be verified on Linux.

## Install & launch
1. Install the NSIS artifact from CI (`windows-installer`). Confirm WebView2 bootstrapper completes.
2. Launch LineupLab; main window opens; overlay window is hidden initially.
3. Settings → Data: refresh/re-download catalog while online; Settings → Diagnostics: run the image self-test. Disconnect network and confirm cached art + “offline cache” warning and last-updated time.

## Safety boundary
4. Confirm Valorant is **Borderless/Windowed**. Fullscreen exclusive is unsupported.
5. Process inspection: LineupLab opens no Valorant process handles, reads no game memory, injects nothing, hooks nothing, and never touches Vanguard. Only window titles are enumerated to choose the capture monitor.

## Overlay & capture exclusion
6. Enable overlay; verify transparent/frameless/always-on-top/non-focusable, click-through by default (game receives clicks).
7. Alt+O toggles controls; Settings → Overlay configures corner/monitor/margins/size/opacity plus reading-comfort scale/hide-annotations/fade; the live preview matches the real window; click-through restores.
8. Capture a screenshot: overlay must **not** appear in the captured image (WDA_EXCLUDEFROMCAPTURE). On pre-2004 Windows, capture is blocked with a clear error.
9. Move Valorant between monitors; title-based monitor selection follows; manual monitor override works.

## Hotkeys
10. Press every default Alt hotkey (docs/HOTKEYS.md) while Valorant is focused; each fires exactly once with feedback.
11. Rebind a key to an existing combo → conflict rejected; rebind to a free Alt combo → works after restart (persisted). Non-Alt combos rejected.

## Create flow
12. Alt+C captures stand → aim → landing in order; Alt+X adds a crosshair circle on the aim image; Alt+R retakes; Alt+1…5 select slots; Save/Save & Next/Discard/Undo/Redo behave.
13. Drop/paste images; required-slot validation blocks save until complete; draft survives a forced crash and offers recovery.
14. Annotation editor: drag circles/lens/line points, lens stays square/clamped and crops the original; colors/hex/1–8, snapping, duplicate/nudge/delete/copy-to-slot; undo/redo; originals unchanged on disk.

## Packs
15. Import a real legacy ZIP: preview statuses/conflicts, select entries, commit; verify counts and images against the source pack. Undo batch restores prior state.
16. Export → re-import into the old ValLineups app: JPEG views open; LineupLab re-import recovers original WebP bytes via `x_lineuplab.originalMedia`.
17. Abyss “Mid Bend -> B Site” pins render at `(0.6919,0.7016)` / `(0.3441,0.8831)` on the displayIcon minimap (docs/COORDINATE_CHECK.md).

## Sync
18. Start LAN server (opt-in); pair Android companion with six-digit code; wrong code/rate-limit rejected; sync transfers lineups + images + tombstones; offline browsing works after airplane mode.

## Redesign UI checks (M1–M8)
19. Browse: map/agent/ability current-value picker buttons and dialogs, filters popover, minimap markers (keyboard Enter opens), card grid density, detail drawer with annotated images and slot rail; no horizontal overflow at 1100/1920.
20. Create wizard: five steps, mode-driven required slots, capture auto-advance, annotation tools, pins, validation, autosave/recovery; overlay Create checklist mirrors the live draft and active slot.
21. Import/Export: dropzone preview table, error rows unselectable, conflict policy, progress/report, undo batch; export legacy JPEG/bake toggles.
22. Settings tabs: General/Hotkeys/Overlay/Capture/Sync/Data/Diagnostics/About; hotkey rebind conflicts; image self-test under Diagnostics.
23. Overlay: ≥13px text, 40px controls, capture fade, view image/flip to minimap+steps, prev/next; reading-comfort prefs sync live with Settings.
24. Android companion (390×844): bottom nav Browse/Sync/Settings, single-column cards, filter drawer, list/map toggle, full-screen detail, pairing-only sync; no create/edit/import; no horizontal overflow at 360/390.
25. Accessibility: every desktop control ≥40px and Android control ≥48px (automated Playwright audit), visible focus rings, icon-only controls labelled, static badges are not focusable, reduced-motion preference respected.

## Preview 3 regression checks
26. Import a real old pack: staged progress remains visible (reading/validating/media/lineups), the UI stays responsive, failures show a persistent error panel, report counts match the pack, and undo restores the prior library.
27. Browse pickers: Map/Agent/Ability buttons show the current value; dialogs list all choices with search/role filters and favorite-agent pinning; Esc/focus return work; Android targets remain ≥48px.
28. Overlay on 2560×1440 and mixed-DPI monitors: Settings → Overlay detects the selected monitor, shows physical/logical size and scaling, corners match the native window, “Reapply placement” works, and placement persists after restart.

## Preview 8 regression checks
29. Overlay Learn on a single-throw lineup shows only Stand/Aim/Landing even if the stored pack contains a leftover or copied second stand; a real double shock keeps its distinct second aim (and a genuinely different second stand).
30. Alt+Down / Alt+Up in the overlay step through whole lineups in Browse order and wrap; Alt+Left/Right still step images; header stepper buttons and the n/total position agree; rebinding both keys in Settings works and conflicts are rejected.
31. With the overlay enabled and visible, opening a lineup in Browse shows it in the overlay without clicking Learn; hiding the overlay (Alt+V) keeps it hidden while browsing/stepping; opening Create brings back the capture checklist.

## Known untested paths
- Actual WDA_EXCLUDEFROMCAPTURE behavior, global shortcut registration under Valorant focus, physical multi-monitor DPI placement, WebView2 runtime variations, NSIS upgrade/uninstall, real Android device touch/sync. CI compile and Linux Playwright are not a substitute for this plan.
