# Windows manual test plan

Automated CI compiles the Windows installer and runs the portable core/UI suites. The following **must be exercised on a real Windows 10 2004+ / Windows 11 machine** because capture, global hotkeys, overlay affinity and WebView2 cannot be verified on Linux.

## Install & launch
1. Install the NSIS artifact from CI (`windows-installer`). Confirm WebView2 bootstrapper completes.
2. Launch LineupLab; main window opens; overlay window is hidden initially.
3. Settings → Catalog refresh while online; disconnect network and confirm cached art + “offline cache” warning and last-updated time.

## Safety boundary
4. Confirm Valorant is **Borderless/Windowed**. Fullscreen exclusive is unsupported.
5. Process inspection: LineupLab opens no Valorant process handles, reads no game memory, injects nothing, hooks nothing, and never touches Vanguard. Only window titles are enumerated to choose the capture monitor.

## Overlay & capture exclusion
6. Enable overlay; verify transparent/frameless/always-on-top/non-focusable, click-through by default (game receives clicks).
7. Alt+O toggles controls; drag/configure corner/monitor/margins/size/opacity; click-through restores.
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

## Known untested paths
- Actual WDA_EXCLUDEFROMCAPTURE behavior, global shortcut registration under Valorant focus, multi-monitor DPI scaling, WebView2 runtime variations, NSIS upgrade/uninstall. CI compile is not a substitute for this plan.
EOF