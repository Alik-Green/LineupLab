# LineupLab pack format (legacy-compatible)

LineupLab imports and exports the **same ZIP format** used by “ValLineups Windows Desktop Studio”. There is no separate LineupLab pack format.

> Evidence status: the requested real pack and extracted `custom-abyss-…` / `custom-corrode-…` samples were absent from the repository. This document is based on the supplied schema plus explicitly synthetic fixtures in `fixtures/generated/`. Real-pack counts, visual image differences, and the legacy lens anchor remain open questions.

## Archive layout

```text
manifest.json
lineups/<id>.json
media/asset_<name>.<jpg|jpeg|png|webp|mp4|webm|mov>
```

Import accepts legacy `asset_<7 chars>.jpg` names. Export writes `asset_<8 lowercase hex>.<ext>` and chooses extensions from file content, not the old filename.

### Safe import limits

- Maximum 20,000 entries, 64 MiB per media entry, 512 MiB total uncompressed bytes.
- JSON limits: 1 MiB manifest, 4 MiB per lineup.
- Rejects absolute paths, Windows drive/backslash paths, `.`/`..` components, symlinks, duplicate entry names, encrypted entries, and unsupported paths/extensions.
- Archive contents are read into bounded buffers; paths are never extracted directly to disk.
- Malformed lineup JSON becomes an `Error` row in the preview; a malformed manifest rejects the pack.

## Manifest

```json
{
  "formatVersion": 1,
  "packId": "uuid-or-string",
  "name": "Pack name",
  "author": "Author",
  "createdAt": "RFC3339",
  "description": "…",
  "isSeedPlaceholder": false
}
```

Unknown manifest keys are preserved. Seed placeholder packs show a banner and default to unchecked. Export always creates a new `packId` and `formatVersion: 1`.

## Lineup JSON (schemaVersion 1)

Known root fields: `id,title,mapUuid,agentUuid,abilitySlot,side,site,start,end,bounces,throwType,difficulty,tags,notes,author,source,isFavorite,createdAt,updatedAt,attributes,steps,media`.

- `start` → `stand1Pos`; `end` → `landPos`; coordinates are normalized 0..1, origin top-left.
- `attributes.stand2Point` → `stand2Pos`.
- Numeric strings in `attributes` and projectile charge/bounce fields are coerced for typed access; original string forms are restored on export.
- Unknown root fields go to internal `legacy` and are written back unchanged. Unknown nested fields in media/steps/projectiles/circles are preserved at their nesting level.
- Newer `schemaVersion` values are imported best-effort with a warning and retained under `x_lineuplab.sourceSchemaVersion`.

### Slot mapping

| Internal slot | Primary legacy reference | Fallback |
|---|---|---|
| `stand1` | `media.standImage` | `projectiles[0].standImage`, then an unused step image |
| `aim1` | `media.aimImage` | `projectiles[0].aimImage`, then an unused step image |
| `stand2` | `attributes.stand2Image` | `projectiles[1].standImage` |
| `aim2` | `projectiles[1].aimImage` | — |
| `landing` | `media.landingImage` | unused step image only when the field is absent |

A present-but-missing file reference leaves that slot empty and flags `incomplete`; it is not replaced with an unrelated step image. Every resolved projectile/step/video reference remains attached even when it is not the primary slot image. Browse preview prefers landing, then aim2/aim1/stand1/stand2, then throw/step images.

### Circles

`attributes.slotCircles.<slot>` is canonical. `projectiles[n].focusCircles` is merged by `id` into aim1 (`n=0`) or aim2 (`n>0`). Mismatches warn and canonical data wins; projectile-only circles are added. Export writes the canonical circles to **both** locations.

Circle fields keep legacy names:

```json
{
  "id": "…", "color": "cyan", "x": 0.5, "y": 0.5, "radius": 0.025,
  "showZoom": true, "zoomScale": 3.5, "zoomSize": 0.24,
  "zoomX": 0.72, "zoomY": 0.04
}
```

Provisional geometry: `x/y/radius` are normalized to image width for circular pixels; `zoomX/zoomY` are the lens inset **top-left**, normalized to image width/height; `zoomSize` is inset width normalized to image width; `zoomScale` is magnification. The lens crops the original full-resolution image. Unknown circle keys survive.

### New data: one extension key

All new-only JSON lives under `x_lineuplab`:

- `slotLines`: non-destructive polyline annotations by slot.
- `attributeForms`, `throwForms`: original legacy string forms.
- `mode`, `meta`: mode id, revision, deviceId, deleted/draft tombstone state.
- `slotExtras`, `invalidFields`, `sourceSchemaVersion`: tolerant-import preservation.
- `originalMedia`: when legacy-compatible WebP→JPEG export is enabled, maps the old-app JPEG path back to the included original WebP path/hash. LineupLab re-imports the original bytes; the old app can ignore this key and use JPEG.
- `bakedImages`: optional flattened annotation copies, never replacing originals.

The old app should ignore `x_lineuplab`. Lines are not inserted into legacy circle arrays.

## Import pipeline

1. Safe bounded read.
2. Tolerant parse and per-entry warnings.
3. Preview statuses: `new`, `identical`, `newer_in_pack`, `newer_locally`, `error`.
4. Conflict policy by id: `skip`, `overwrite-if-newer` (default), `import-as-copy`.
5. Probable duplicate warning: same map+agent+ability+mode and landing distance ≤ 0.025.
6. Transactional metadata commit; originals are stored by SHA-256 before the transaction and never re-encoded. Thumbnails are separate.
7. Report plus `importBatchId`. Undo soft-deletes new imports (tombstones) and restores overwritten records with a newer revision so the undo syncs. Later imports/edits that changed batch ownership are left intact with a warning.

## Export and round-trip semantics

Export supports all/filtered/selected lineups. It preserves author/source/timestamps/favorites and unknown data. `Legacy-compatible images` is on by default: WebP gets a JPEG view for the old app while the original WebP is also included and recoverable through `x_lineuplab.originalMedia`.

Strict JSON deep-equality (ignoring key order and `x_lineuplab`) is tested after normalizing media filenames to content hashes, because export necessarily renames assets to `asset_<8 hex>.<ext>`. Two intentional legacy canonicalizations are excluded from strict byte-for-byte JSON equality and tested separately:

1.Projectile-only circles are copied into canonical `slotCircles` and then written to both places.
2. Conflicting duplicate circle ids keep canonical `slotCircles` data.

Import → export → import is tested for semantic model identity (slots, throws, steps, attributes, legacy fields, forms, mode, pins, favorites).

## CLI

```bash
cargo run -p lineuplab-core --bin lineuplab-pack -- inspect fixtures/generated/legacy-sample.zip
cargo run -p lineuplab-core --bin lineuplab-pack -- import fixtures/generated/legacy-sample.zip           # preview only
cargo run -p lineuplab-core --bin lineuplab-pack -- import fixtures/generated/legacy-sample.zip --commit # apply defaults
cargo run -p lineuplab-core --bin lineuplab-pack -- export out.zip --map <uuid>
cargo run -p lineuplab-core --bin lineuplab-pack -- undo <batchId>
```

Use `--data-dir <path>` to select the SQLite/media library. `--policy skip|overwrite-if-newer|import-as-copy`, `--all`, and `--seed` control commit selection.

## Open questions awaiting the real fixtures

- Exact real-pack lineup/media counts and authoring quirks.
- Whether legacy `zoomX/zoomY` are top-left or center (current choice: top-left, provisional).
- Visual differences among `media.*`, projectile, and step images; all are retained regardless.
- Abyss coordinate orientation on the real minimap. No calibration transform is applied until visually verified; `core/data/map_calibration.json` is ready for per-map affine corrections.
