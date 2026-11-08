# LAN sharing & phone downloads

## Opt-in hosting

Desktop sharing is **off by default**. Start it from Settings → Sharing or run:

```bash
cargo run -p lineuplab-core --bin lineuplab-server -- --data-dir ~/.lineuplab --bind 0.0.0.0:8765
```

By default the server allows **one-tap connect** (`POST /connect`) and advertises `_lineuplab._tcp.local.` via mDNS. Manual `http://<ip>:8765` entry is always available. To require a code, pass `--pairing-code 123456`; the older `/pair` route remains supported.

## Security model (explicit trade-off)

The requested no-code flow is for a **trusted LAN only**. It is not risk-free:

- While sharing is on, anyone who can reach the address can connect and read the library.
- Plain HTTP is unencrypted. Never port-forward or expose the server to the Internet.
- Stop sharing when finished. Tokens are persisted in `tokens.json` and can be revoked by deleting that file and restarting.
- A configured pairing code is still enforced and rate-limited (10/minute, constant-time compare). `/connect` returns 401 when a code is required.
- Every route except `/health`, `/pair` and `/connect` requires `Authorization: Bearer <token>`.
- Image uploads are verified against their SHA-256 path; hash mismatches are rejected.

## Phone Download (one-way, additive)

Android **Download** connects, reads the full manifest, downloads missing lineups/images, skips duplicates by revision and media hash, and keeps a permanent offline copy. It does **not** push phone edits. Remote deletions/tombstones do not erase previously downloaded phone content. Failed/missing media are reported as warnings; repeating **Connect & download** retries them.

Preview 6 lifecycle fixes:

- **Connect & download** is one supported action: connect, fetch, persist, then refresh the visible library. The phone UI reloads Browse through the download callback plus DOM/Tauri `library-changed` events; a regression proves downloaded records survive completion and relaunch.
- Downloaded rows are committed to SQLite and visible to an already-open Browse connection as well as a fresh connection.
- **Find desktop** only lists candidates whose live `/health` probe succeeds. A cached mDNS advertisement alone is not treated as available.
- Stopping sharing unregisters the mDNS service; desktop `RunEvent::Exit` also shuts down the LAN server and mDNS. Remembered manual addresses remain editable, but reconnect/download attempts fail cleanly when the server is gone.
- The obsolete desktop access-code connection panel is removed from the UI. The core still supports a configured `--pairing-code` for protected/legacy use; the default trusted-LAN flow needs no code.

## Protocol (version 1)

| Route | Auth | Purpose |
|---|---|---|
| `POST /connect {deviceName}` | none (only when no code is configured) | → `{token, serverName, deviceId, protocolVersion}` |
| `POST /pair {code, deviceName}` | pairing code when configured | legacy/protected connect |
| `GET /health` | none | liveness + protocol version |
| `GET /manifest?since=<rfc3339>` | token | `{protocolVersion, deviceId, cursor, entries:[{id,updatedAt,revision,deviceId,deleted}]}` |
| `GET /lineups?ids=a,b` | token | complete lineup documents (including tombstones/legacy fields) |
| `GET /images/{sha256}` | token | original bytes; blank/invalid hashes are rejected client-side |
| `PUT /images/{sha256}` | token | upload original bytes; server verifies hash |
| `POST /push {deviceId, lineups[]}` | token | deterministic merge → `{accepted, conflicts, cursor}` |

## Merge semantics

Desktop sync remains last-writer-wins with deterministic tie-breaks: **timestamp → revision → deviceId**. Tombstones propagate in desktop sync. Phone downloads are additive and ignore remote tombstones for already saved copies. Conflicts are reported, not destructively merged.

## Tests

`core/tests/sync_server.rs`: protected pairing/auth/rate-limit, incremental manifest, complete-field round-trip, image transfer + hash verification, tombstone propagation, stale-write conflict, open-LAN additive/resumable download that never requests `/images/` for a blank hash, live discovery probing that rejects a stopped server/stale cache candidate, and download persistence visible to both an already-open and a fresh library connection.

`e2e/android-browse.spec.ts`: empty-phone download persists and refreshes Browse after relaunch; stopped desktop sharing is not shown as live; compact Android settings tables stay inside the viewport.
