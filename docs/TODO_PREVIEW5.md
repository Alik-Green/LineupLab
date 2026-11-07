# Preview 5 — latest usability and Android installation checklist

Added 2026-11-07 before implementing the new feedback. Duplicate comments in the request are consolidated here. This is an acceptance checklist: completed automated work is not a claim of physical-device or gameplay validation.

## P0 — reproduce and fix the blockers

- [ ] **1. Minimap click turns the entire screen into a solid colour (desktop AND phone).** Treat this as the highest-priority bug, not just an empty-map issue. Reproduce clicks on map background, stand marker, landing/ability marker and overlapping markers; inspect navigation, dialogs, focus/scroll locking and rendering. Add desktop/phone regression tests that assert the lineup viewer opens with actual content, the background remains usable, Close/Back returns to Browse, and there are no runtime errors. Test populated and empty libraries and map/list switching. Do not mark complete based only on the previous empty-state reset test.
- [ ] **2. Latest Android APK says “You can't install this app on your device.”** Inspect the actual release manifest, minimum/target SDK, ABIs/native libraries, package ID/version, signing scheme and build logs. Establish whether this is an OS/device/ABI requirement, a conflict with an existing differently signed preview, or a packaging defect. Ask for the phone model/Android version and whether an older LineupLab is installed. Fix any confirmed packaging issue; add CI manifest/ABI/signature compatibility checks and explicit install troubleshooting. Verify on an emulator/physical device if tooling permits; otherwise state exactly what remains unverified.

## P1 — map and selector usability

- [ ] **3. Enlarge Map / Agent / Ability artwork inside the three square selectors.** The image should occupy most of the square, with a compact label rather than a small icon floating in empty space. Apply consistently to Browse and Create on desktop and Android; preserve full chooser dialogs and accessible names.
- [ ] **4. Keep minimap toolbar tooltips fully visible.** Portal/position tooltips outside the clipped map container, flip/clamp them within the viewport, and test the path/throw-line control and other edge controls at narrow widths.
- [ ] **5. Show every throw path while the path toggle is active.** Visibility must not depend on hovering/selecting a start or end marker. Turning the toggle off hides all paths. Include multi-throw/bounce paths where location data exists and test the default/toggled states.
- [ ] **6. Improve minimap and position-marker quality at zoom.** Audit source image resolution and caching (do not substitute a tiny list-view image for the minimap). Keep markers vector-sharp, use adequately sized ability source art, compensate marker/hit-area sizing for zoom, and avoid blurry CSS-raster scaling where a sharper rendering approach is available. Document the unavoidable limit when the supplied map bitmap itself is low resolution. Test zoomed clarity/geometry and desktop/phone rendering.
- [ ] **7. Exclude ALL Team Deathmatch maps, including District.** The current name-only filter is insufficient. Use reliable map identity/mode metadata or an explicit non-standard-map exclusion list covering District and the other TDM maps; retain legacy lineup data. Add catalog fixtures and Browse/Create assertions that none appear in selectors.

## P1 — clean, full-screen lineup viewer

- [ ] **8. Replace the side drawer with a near-full-screen lineup popup.** Small outer margins on desktop and phone, a clear Close button, usable safe areas, focus trapping and Escape/Back support. Keep the UI minimal rather than squeezing a large metadata sidebar beside the image.
- [ ] **9. Add real image zoom + pan to the lineup viewer.** Wheel/buttons and touch pinch/drag where supported; zoom around the pointer, clamp panning to image bounds, reset on changing images, and provide a reset-view control. Annotations must stay aligned. Test mouse and touch-sized viewports.
- [ ] **10. Hide absent second-stand/second-aim captures in the viewer.** Only show slots actually present/used; never manufacture an empty Second stand tab merely because the slot exists in the schema. Preserve legacy captures that really exist. Apply the same optional-slot rule to overlay navigation where relevant.
- [ ] **11. Remove throw type, charge and bounce metadata from lineup cards.** Keep the card focused on image, title and essential browse context. Detailed per-throw information belongs in the viewer/editor, not on every card.

## P1 — capture-specific settings and simpler Create flow

- [ ] **12. Move charge and bounce controls from Setup to Capture, separately for each throw.** Double shocks must be able to use different charge/bounce values. Persist them in each `ThrowSpec`, migrate legacy lineup-level values safely, show the controls for the active aim capture, and keep them aligned with saved/exported/overlay data. Add a regression that changes throw 1 and throw 2 independently.
- [ ] **13. Single-throw modes must not show Second stand or Second aim.** Show those slots only for an explicitly selected double/follow-up mode. Do not let an old unused image or generic attribute silently expose optional slots in a single-shock draft. Preserve stored data until the user intentionally clears/changes it; test single ↔ double switching and draft restoration.
- [ ] **14. Remove Bounce and Pan / zoom from minimap point-selection tools.** Keep only Stand, Land and (for a two-throw lineup) Second stand. Normal map dragging/zoom remains available through the map/toolbar; bounce count/settings belong to each capture, not a map-pin tool. Preserve legacy bounce location data.
- [ ] **15. Actually generate titles from the nearest stand/land callouts.** Provide usable callout location data for supported standard maps, not merely an optional unused type. Use the nearest callout to Stand and to Land in the visible suggested/auto-filled title, preserve manual titles, and explain/test the fallback when coordinates are unavailable. If route/path data is available, prefer a plausible connected route; do not claim path-aware naming from Euclidean distance alone.
- [ ] **16. Combine Create navigation into one top bar.** Merge the stage navigation (Setup → Capture → Pins → Details → Review) with Back/Next and essential save actions; remove the duplicate bottom Back/Next bar. Keep keyboard/hotkey behavior, validation and small-screen reachability.

## P2 — overall visual cleanup

- [ ] **17. Make the UI noticeably calmer and less cluttered.** Review Browse, Create and the lineup viewer: reduce repeated labels/badges/instructions, group essential actions, use consistent spacing and compact typography, keep large imagery dominant, and retain accessible touch targets. Remove redundant chrome rather than hiding functionality in inaccessible places. Review fresh desktop/phone screenshots after changes.

## Verification / delivery

- [ ] **18. Add regressions and run checks.** Cover the actual minimap-click failure, larger selector artwork, unclipped tooltips, persistent paths, TDM identities, full-screen viewer, zoom/pan, absent optional slots, clean cards, per-throw controls, single-mode slots, reduced pin tools, callout titles and unified Create navigation. Run TypeScript/unit/Rust checks, production builds and desktop/Android Playwright; inspect screenshots and runtime errors.
- [ ] **19. Verify Android packaging/installability and native builds.** Record actual manifest/ABI/signature results and CI runs. Obtain the missing device details if needed; do not describe an APK as fixed on a physical phone without evidence.
- [ ] **20. Publish the next prerelease only after the implemented batch passes.** Include checksums, Android compatibility/install guidance and honest limitations. Update this checklist and release docs; keep Preview 4 binaries clearly superseded once the new release is verified.

## Working order

1. Checklist + diagnose items 1–2 (including asking for device details).
2. Minimap/selectors/TDM and full-screen viewer (3–11).
3. Capture-specific settings and Create simplification (12–16).
4. Visual pass, full regression/native checks and release (17–20).

## Findings and progress

- Starting revision: `f4f4edd` (Preview 4 release documentation); Preview 4 itself was built from `99fc966`.
- The previous “empty map recovery” test did not reproduce the user's populated-marker/background click failure. A new direct interaction regression is required.
- The previous callout-title code only consumed optional `GameMap.callouts`; the bundled catalog did not supply a usable callout dataset. That is not a completed implementation of item 15.
- Android device model/OS version and existing-install status are not yet known. Packaging inspection is underway; no cause is assumed.
