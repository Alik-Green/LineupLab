import { getDB, sha256Blob, sha256Bytes } from "./db";
import type { Lineup } from "../types/lineup";
import type { MediaRecord } from "./db";
import fallbackLineups from "../data/fallbackLineups.json";

export type { MediaRecord } from "./db";

export async function getAllLineups(): Promise<Lineup[]> {
  const db = await getDB();
  return db.getAll("lineups");
}

export async function getLineupCount(): Promise<number> {
  const db = await getDB();
  return db.count("lineups");
}

export async function getLineupById(id: string): Promise<Lineup | undefined> {
  const db = await getDB();
  return db.get("lineups", id);
}

export async function putLineup(lineup: Lineup): Promise<void> {
  const db = await getDB();
  await db.put("lineups", lineup);
}

export async function putLineups(lineups: Lineup[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("lineups", "readwrite");
  await Promise.all(lineups.map((l) => tx.store.put(l)));
  await tx.done;
}

export async function deleteLineup(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("lineups", id);
}

export async function isDemoData(): Promise<boolean> {
  const all = await getAllLineups();
  return all.some((l) => l.source === "demo" || (l.tags && l.tags.includes("demo")));
}

export async function removeDemoData(): Promise<void> {
  const db = await getDB();
  const all = await db.getAll("lineups");
  const tx = db.transaction("lineups", "readwrite");
  for (const l of all) {
    if (l.source === "demo" || (l.tags && l.tags.includes("demo"))) {
      await tx.store.delete(l.id);
    }
  }
  await tx.done;
}

export async function seedDemoIfEmpty(): Promise<void> {
  const db = await getDB();
  const count = await db.count("lineups");
  if (count > 0) return;
  const now = new Date().toISOString();
  const migrated: Lineup[] = (fallbackLineups as any[]).map((l) => ({
    ...l,
    source: "demo" as const,
    status: "ok" as const,
    createdAt: now,
    updatedAt: now,
  }));
  const tx = db.transaction("lineups", "readwrite");
  for (const l of migrated) await tx.store.put(l);
  await tx.done;
}

// Media handling
export async function putMedia(rec: MediaRecord): Promise<void> {
  const db = await getDB();
  await db.put("media", rec);
}

export async function getMediaByLineup(lineupId: string): Promise<MediaRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("media", "by-lineup", lineupId);
}

export async function getMediaBySha(sha: string): Promise<MediaRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("media", "by-sha", sha);
}

export async function checkDuplicateBySha(sha: string): Promise<boolean> {
  const found = await getMediaBySha(sha);
  return found.length > 0;
}

// Import history
import type { ImportHistoryEntry } from "./db";
export async function addImportHistory(entry: ImportHistoryEntry): Promise<void> {
  const db = await getDB();
  await db.put("importHistory", entry);
}

export async function getImportHistory(): Promise<ImportHistoryEntry[]> {
  const db = await getDB();
  return db.getAll("importHistory");
}

export async function clearImportHistory(): Promise<void> {
  const db = await getDB();
  await db.clear("importHistory");
}

export async function getLineupsByBatch(batchId: string): Promise<Lineup[]> {
  const db = await getDB();
  return db.getAllFromIndex("lineups", "by-batch", batchId);
}

// Conflict helpers
export type ConflictResolution = "skip" | "overwrite" | "copy";

export function makeCopyId(originalId: string): string {
  return `${originalId}-copy-${Date.now().toString(36)}`;
}

// Create thumbnail without re-encoding original: generate small JPEG thumbnail via canvas if possible, otherwise keep original truncated
export async function createThumbnail(blob: Blob, maxSize = 240): Promise<Blob | undefined> {
  // Only for images; video thumbnail not generated here (could be placeholder)
  if (!blob.type.startsWith("image/")) return undefined;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const thumbBlob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7)
    );
    return thumbBlob ?? undefined;
  } catch {
    return undefined;
  }
}
