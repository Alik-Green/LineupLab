# LAN sync protocol & security model

## Opt-in hosting

Desktop hosting is **off by default**. Start it from Settings → LAN sync or run:

```bash
cargo run -p lineuplab-core --bin lineuplab-server -- --data-dir ~/.lineuplab --bind 0.0.0.0:8765
```

The server prints a random **six-digit pairing code** and advertises `_lineuplab._tcp.local.` via mDNS. Manual `http://<ip>:8765` entry is always available.

## Transport choice (documented alternative to pinned HTTPS)

LineupLab uses **plain HTTP on the LAN + six-digit pairing + bearer tokens**. This is the documented alternative allowed by the spec. Rationale: no certificate distribution/pinning UX on a home LAN, and the Android companion can pair without TLS trust prompts.

**Threat model / rules:**

- Trusted LAN only. **Never** port-forward or expose the server to the Internet.
- Pairing code is shown once on the host; keep it private. Pairing attempts are rate-limited (10/minute) and compared in constant time.
- Successful pairing issues a random bearer token persisted in `tokens.json`; every route except `/health` and `/pair` requires `Authorization: Bearer <token>`.
- Tokens are revocable by deleting `tokens.json` and restarting. There is no encryption on the wire; anyone on the same L2 segment who obtains a token can read/write the library. Use a trusted network.
- Image uploads are verified against their SHA-256 path; hash mismatches are rejected.

If pinned HTTPS is required later, `rcgen`/`tokio-rustls` are already core dependencies; the router can be served behind a TLS acceptor without protocol changes.

## Protocol (version 1)

| Route | Auth | Purpose |
|---|---|---|
| `POST /pair {code, deviceName}` | pairing code | → `{token, serverName, deviceId, protocolVersion}` |
| `GET /health` | none | liveness + protocol version |
| `GET /manifest?since=<rfc3339>` | token | incremental `{protocolVersion, deviceId, cursor, entries:[{id,updatedAt,revision,deviceId,deleted}]}` |
| `GET /lineups?ids=a,b` | token | complete lineup documents (including tombstones and unknown/legacy fields) |
| `GET /images/{sha256}` | token | original bytes |
| `PUT /images/{sha256}` | token | upload original bytes; server verifies hash |
| `POST /push {deviceId, lineups[]}` | token | deterministic merge → `{accepted, conflicts, cursor}` |

## Merge semantics

Last-writer-wins with deterministic tie-breaks: **timestamp → revision → deviceId**. Tombstones (`deleted=true`) propagate and are never silently dropped. Clients push only lineups newer than the server manifest, upload referenced images first, then pull newer remote lineups and missing images. `sync_both` = push then pull. Conflicts are reported, not destructively merged.

## Tests

`core/tests/sync_server.rs`: pairing/auth/rate-limit, incremental manifest, complete-field round-trip, image transfer + hash verification, tombstone propagation, deterministic stale-write conflict.
