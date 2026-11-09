# Pack Format (v2)

LineupLab packs are `.zip` files that bundle many lineups + media for offline import.

## Zip layout

```
my-pack.zip
├── manifest.json
├── lineups/
│   ├── lineup-001.json
│   ├── lineup-002.json
│   └── ...
└── media/
    ├── asset_001.jpg
    ├── asset_002.jpg
    ├── asset_003.mp4
    └── ...
```

- **manifest.json** (required): pack metadata

```json
{
  "formatVersion": 1,
  "name": "Haven Sova Defaults",
  "author": "Ali",
  "description": "Curated Sova lineups for Haven",
  "createdAt": "2025-11-09T12:00:00Z",
  "gameVersion": "10.00.00",
  "count": 24
}
```

Tolerant parser accepts aliases: `title`/`packName` for `name`, `desc` for `description`, `version` for `formatVersion`, extra unknown keys are ignored (passthrough). Missing `manifest.json` → error.

- **lineups/*.json** (0..2000 files, each <2MB): each file may be a single lineup object or an array of objects. Allowed fields are tolerant via `zod` passthrough:

```ts
{
  id: string, // required, stable across re-imports
  title?: string, name?: string,
  mapUuid?: string, map?: string, mapName?: string, mapId?: string,
  agentUuid?: string, agent?: string, agentName?: string,
  abilitySlot?: "Ability1"|"Ability2"|"Grenade"|"Ultimate", slot?: string, ability?: string,
  side?: "attack"|"defense"|"both" // aliases: attacking/defending, defender/attacker
  site?: string,
  start?: {x:number,y:number}|[number,number], end?: same, bounces?: same[]
  projectiles?: [{start,end,bounces}] // legacy: first projectile drives path
  difficulty?: string, importance?: string // normalized: medium→normal, must→essential etc
  tags?: string[], notes?: string, description?: string
  media?: { standImage?, aimImage?, landingImage?, stand1?, aim1?, stand2?, aim2?, landing? }
  slots?: { stand1?, aim1?, stand2?, aim2?, landing? }
  throws?: [{type?, tick?, note?}], throwType?: string
  steps?: [{id?, title?, description?, image?, media?, asset?, circles?: Circle[] }], circles?: Circle[]
  attributes?: { side?, site?, difficulty?, importance?, tags?, ...any }
  projectiles?: any
  status?: "ok"|"incomplete"|"archived", isSeedPlaceholder?: boolean
}
```

Unknown keys preserved in `legacy.raw` for debugging.

- **media/asset_*.jpg|.mp4** : images (`image/jpeg`, `image/png`) and video (`video/mp4`, `video/webm`). Filename must start with `asset_` and be under `media/`. Stored in IndexedDB as Blob with SHA-256 dedup (original never re-encoded). Thumbnails are generated separately as 240px JPEG via canvas `createImageBitmap` + `toBlob` (never touches original).

## Safety / limits

- No path traversal: any entry containing `..` or starting with `/`/`\` is rejected.
- Max 100 MB uncompressed, 2000 files, each JSON <2 MB.
- Zip is parsed via `fflate` `unzipSync` in main thread (Web Worker possible later).
- All JSON parsed with try/catch → per-file warning, not fatal.
- Circles deduped by `id` (B4): both top-level `circles` and step-level circles are merged into `lineup.circles` map by id, first wins.

## Mapping to internal Lineup

```
attributes/projectiles/steps/media → Lineup {
  slots: { stand1, aim1, stand2, aim2, landing },
  throws: [{type, tick, note}],
  steps: [{id,title,description,image,circles}],
  attributes: { side,site,difficulty,importance,tags,... },
  circles: Circle[] (deduped),
  source: "import",
  importBatchId: string,
  legacy: { raw, warnings },
  status: "ok"|"incomplete"|"archived",
  isSeedPlaceholder: boolean
}
```

- `slots` come from `media` legacy keys `stand1/aim1/stand2/aim2/landing` or `slots`.
- `throws` defaults to `[{type: throwType}]` if only `throwType` present.
- `circles` at `steps[].circles` are promoted to top-level `circles`.
- Coordinates clamped to 0..1.
- Empty `lineups/*.json` → warning "No lineups found".
- `isSeedPlaceholder` lineups are unchecked by default in preview dialog.

## Conflict handling

On import, existing lineup `id` is looked up in IndexedDB:
- **Identical** (JSON equal ignoring timestamps): chip gray.
- **Pack newer** (`updatedAt` > local): red chip.
- **Local newer**: amber chip.
- **New**: green chip.
- User picks resolution: Skip / Overwrite / Copy (copy generates `${id}-copy-${timestamp}`).

Duplicate pack detection: if `manifest.name` matches prior `importHistory` entry, banner shows "Pack was already imported on …".

## Storage

- Lineups stored in `idb` DB `lineuplab` store `lineups` (keyPath `id`), indexes `by-map`, `by-agent`, `by-batch`.
- Media in `media` store (keyPath `sha-assetName`), indexes `by-lineup`, `by-sha`. SHA-256 via `crypto.subtle.digest`.
- History in `importHistory` store.

## Example

See `scripts/create-sample-pack.mjs` for generator (creates a minimal 2-lineup pack for tests).
