PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS lineups (
 id TEXT PRIMARY KEY, map_id TEXT NOT NULL, agent_id TEXT NOT NULL, ability_slot TEXT NOT NULL,
 mode TEXT NOT NULL, side TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL,
 deleted INTEGER NOT NULL DEFAULT 0, favorite INTEGER NOT NULL DEFAULT 0, draft INTEGER NOT NULL DEFAULT 0,
 import_batch_id TEXT, document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE INDEX IF NOT EXISTS lineups_browse ON lineups(map_id,agent_id,ability_slot,deleted);
CREATE INDEX IF NOT EXISTS lineups_sync ON lineups(updated_at,revision,id);
CREATE TABLE IF NOT EXISTS media(hash TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes INTEGER NOT NULL, width INTEGER, height INTEGER);
CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value)));
CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY, document TEXT NOT NULL CHECK(json_valid(document)), updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS import_backups(batch_id TEXT NOT NULL, lineup_id TEXT NOT NULL, previous_document TEXT, PRIMARY KEY(batch_id,lineup_id));
CREATE TABLE IF NOT EXISTS import_batches(id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, report TEXT NOT NULL, undone INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sync_peers(id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, last_synced TEXT, cursor TEXT);
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,datetime('now'));
