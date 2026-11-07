# LineupLab progress

## 2026-11-06 · Foundation (in progress)
- Inspected repository and GitHub main: only README; the requested real ZIP and extracted samples are absent.
- Establishing portable Rust core, content-addressed storage, SQLite migrations and typed runtime catalog.
- Linux toolchain bootstrapped from the sandbox-compatible PyPI distribution. Normal Cargo registry egress is blocked; local verification uses an external, checksum-checked vendor cache, never committed to the repository.
- Next: pack CLI and lossless legacy round-trip, then shared UI.

## Verification ledger
Entries are updated only after commands actually run. Platform-specific checks are never inferred from Linux tests.

## 2026-11-07 · Milestone 1 complete
- Typed models, five-slot ordering, non-destructive circle/line geometry, data-driven modes and lineup ability defaults.
- SQLite WAL schema, indexed browse/sync queries, tombstones, favorites, crash-safe draft records and import backup tables.
- Content-addressed originals, separate WebP thumbnails, capture resize/encoding, mock capture provider.
- Typed valorant-api client with retry/backoff, atomic versioned cache, runtime art downloads, offline fallback and archived-reference handling.
- React/Vite/Tailwind workspace and separate desktop/mobile entry points typecheck and build.
- Verified: `cargo test --workspace --offline --lib --bins --tests` → 6 tests passed; `npm run typecheck`, `npm run build`, `npm run build:mobile` passed.
- Local bundled toolchain lacks rustdoc, so doctests are deferred to CI (official toolchain). No Windows capture execution claimed.

## 2026-11-07 · Milestone 2 complete
- Legacy ZIP reader/writer, bounded safe extraction, tolerant per-entry validation, canonical circle merge, conflict preview/policies, transactional commit, batch undo, filtered export and CLI.
- 13 deterministic synthetic ZIP fixtures plus extracted synthetic Abyss/Corrode JSON samples. No real user pack was available.
- Verified: `cargo test --workspace --offline --lib --bins --tests` → 17 tests passed (6 foundation + 11 pack). Tests cover slot mapping, round-trip, unknown fields/string forms, conflicts/undo, security rejects, missing media, lines, WebP original recovery and synthetic annotation rendering.
- Generated `docs/annotation_sample.png` from synthetic Corrode aim data; documented format and open questions in `docs/PACK_FORMAT.md`.
- Follow-up: verified Abyss identity calibration against public `displayIcon` orientation; added real Abyss/Corrode UUIDs to synthetic fixtures, calibration entries and a regression test. No Riot art committed (`docs/COORDINATE_CHECK.md`).
