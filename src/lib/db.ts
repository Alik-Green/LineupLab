import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Lineup } from "../types/lineup";

export interface MediaRecord {
  id: string; // sha256 or asset filename keyed
  lineupId: string;
  assetName: string; // e.g. asset_001.jpg
  blob: Blob;
  sha256: string;
  mimeType: string;
  createdAt: string;
  thumbnail?: Blob; // small jpeg thumbnail (never re-encode original)
}

export interface ImportHistoryEntry {
  batchId: string;
  packName: string;
  importedAt: string;
  counts: { total: number; imported: number; skipped: number; overwritten: number };
  undoAvailable: boolean;
}

interface LineupDB extends DBSchema {
  lineups: {
    key: string;
    value: Lineup;
    indexes: { "by-map": string; "by-agent": string; "by-batch": string };
  };
  media: {
    key: string;
    value: MediaRecord;
    indexes: { "by-lineup": string; "by-sha": string };
  };
  importHistory: {
    key: string;
    value: ImportHistoryEntry;
  };
  meta: {
    key: string;
    value: any;
  };
}

const DB_NAME = "lineuplab";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<LineupDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<LineupDB>> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<LineupDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const lineupStore = db.createObjectStore("lineups", { keyPath: "id" });
        lineupStore.createIndex("by-map", "mapUuid");
        lineupStore.createIndex("by-agent", "agentUuid");
        lineupStore.createIndex("by-batch", "importBatchId");
        const mediaStore = db.createObjectStore("media", { keyPath: "id" });
        mediaStore.createIndex("by-lineup", "lineupId");
        mediaStore.createIndex("by-sha", "sha256");
        db.createObjectStore("importHistory", { keyPath: "batchId" });
        db.createObjectStore("meta", { keyPath: "id" });
      }
      if (oldVersion < 2) {
        // ensure indexes exist (idb upgrade path already handled v1, but add batch index if missing)
        // For simplicity recreate if needed - idb v2 path will just ensure stores exist
        try {
          const tx = db.transaction("lineups", "versionchange");
          // not needed, indexes already
        } catch {}
      }
    },
  });
  return dbPromise;
}

// Helpers for SHA-256
export async function sha256Blob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes as any);
  const arr = new Uint8Array(hash);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}
