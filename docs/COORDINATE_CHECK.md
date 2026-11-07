# Abyss “Mid Bend -> B Site” coordinate check

Required pins: start `(0.6919, 0.7016)`, end `(0.3441, 0.8831)`, normalized top-left origin.

## Result

**Identity transform is correct for the valorant-api `displayIcon` image orientation.** Plotting the pins on the real Abyss `displayIcon` (UUID `224b0a95-48b9-f703-1bd8-67aca101a61f`) places the start in the Mid Bend / B-link approach area and the end on the B-site edge. The in-game HUD minimap is rotated relative to `displayIcon`; LineupLab renders `displayIcon`, so it must not apply the HUD orientation.

The verification image was generated temporarily from a downloaded minimap and **not committed** (no bundled Riot art). Sources used for orientation cross-check:

- Map metadata / UUID / multipliers: `https://github.com/AGraciaSipan/valostats/blob/01d08412d41e68e0a9ef361ede8c380f8c6edbca/src/data/maps/abyss.json`
- `displayIcon` bytes cross-check: `https://github.com/hahhen/hackathonvalorant/blob/master/public/assets/minimaps/abyss.png`
- Labeled HUD orientation cross-check: Beebom Abyss map guide image search result (`https://beebom.com/valorant-abyss-map-guide/`).

Automated regression: `abyss_mid_bend_to_b_site_uses_verified_identity_calibration` in `core/tests/pack_tests.rs`.

## Limits

The supplied real pack/screenshots were absent, so this verifies the coordinate convention against the public minimap image, not the author’s exact in-game standing position. Corrode remains identity-provisional until real screenshots are supplied. `core/data/map_calibration.json` supports per-map affine corrections if future fixtures prove otherwise.
