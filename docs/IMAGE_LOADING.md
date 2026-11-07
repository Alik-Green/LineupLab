# Image loading diagnosis and fix (UI redesign M1)

## Root causes found in the previous UI

1. **Raw filesystem paths reached `<img src>`.** The native `get_catalog` commands returned absolute cache paths for agent/map icons. The shared UI converted user media hashes through `media_path` + `convertFileSrc`, but catalog icons were often rendered directly (`IconSelect`, agent portraits, map thumbnails). WebView2/Android WebView cannot load a raw `C:\…` or `/data/…` path as an image URL.
2. **Catalog DTO was incomplete.** Abilities, agent roles and map `listViewIcon`/`splash` were not exposed to the UI, so ability icons and large map thumbnails had no URL to resolve. The Rust `Agent`/`GameMap` structs also dropped those API fields during deserialization.
3. **No single fallback/retry path.** Each component handled images differently. A cache miss or CSP/asset-protocol failure produced the browser broken-image icon/checkerboard instead of a skeleton/placeholder and a diagnostic record.
4. **Asset scope was too narrow.** Only `$APPDATA/**`, `$APPCONFIG/**`, `$RESOURCE/**` were listed. The cache lives under the app data dir, but Android/local-data variants were not explicitly allowed. CSP already allowed `media.valorant-api.com`, `asset:` and `http://asset.localhost`; the missing link was converting cache paths and auditing failures.
5. **Downloader was silent and sequential.** `get_catalog` refreshed on every call, downloaded art one-by-one, and only surfaced a generic warning. There was no first-run progress, cache-size report, per-type audit or render self-test.

## Fix

- Catalog DTOs now keep **stable remote URLs** and include abilities, roles, `listViewIcon` and `splash`.
- New native commands: `prepare_assets(force)` (bounded concurrent downloads + `lineuplab://assets` progress events), `catalog_image_url(url)` (cache hit → absolute path, miss → remote URL), `asset_diagnostics()` (per-type cached/missing/invalid counts, cache bytes, scope/data dir), `log_image_error`.
- Shared UI image layer: `ImageProvider`, `useCachedImage(url)`, `<ValImage>`. Cache-first via adapter `resolveImageUrl` (`convertFileSrc` in TauriAdapter), remote fallback, one retry, skeleton, explicit initials/icon fallback, error reporting. Used by Browse pickers, minimap, annotated images, hover previews and diagnostics.
- Asset protocol scope now includes `$APPDATA/**`, `$APPLOCALDATA/**`, `$APPCACHE/**`, `$APPCONFIG/**`, `$RESOURCE/**` on desktop and Android. CSP allows `asset:`, `http://asset.localhost`, `data:`, `blob:`, `https://media.valorant-api.com` and `https://valorant-api.com` for images.
- First-run progress screen shows `Downloading game data done/total`; Settings → Data has cache size, **Re-download images** and **Run image self-test**. The self-test renders every catalog asset URL through the same resolver and reports per-type success/failure plus CSP/asset-protocol errors.
- Downloader validates image magic bytes before caching, keeps old cache files on failure, and works offline from `catalog.json` + URL-addressed art cache.

## Linux verification

`scripts/prepare-ui-fixtures.mjs` downloads dev-only fixture art into ignored `.work/ui-fixtures` (real ability icons and Abyss minimap from public GitHub mirrors; synthetic SVG stand-ins for unavailable media). `?mock` installs a mocked Tauri invoke/asset/event layer so Playwright exercises `TauriAdapter`, `convertFileSrc`, progress events and diagnostics without a native shell.

Playwright `e2e/images.spec.ts` verifies:
- first-run progress screen renders;
- self-test reports all catalog images rendered;
- no `[data-image-state="error"]` elements and no zero-size/unfinished `<img>` elements on Browse;
- no CSP/asset/image console errors.

Screenshots: `docs/screenshots/01-first-run-progress.png`, `02-data-diagnostics.png`, `03-browse-images.png`.

## Still requires real Windows/Android verification

The Linux mock cannot prove WebView2/Android WebView asset-protocol behavior, real Riot CDN reachability, or first-run cache population on device. Run Settings → Data → Run image self-test on the installed Windows build and Android companion, then follow `docs/WINDOWS_TEST_PLAN.md`. No Riot assets are bundled in the app; fixture art is dev-only and ignored.
