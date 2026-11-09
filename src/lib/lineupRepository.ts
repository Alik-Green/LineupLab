import type { Lineup } from "../types/lineup";

// Embedded fallback for Tauri/production where fetch may be blocked by CSP or asset protocol
import fallbackLineups from "../data/fallbackLineups.json";

export interface LineupRepository {
  getAll(): Promise<Lineup[]>;
  getById(id: string): Promise<Lineup | undefined>;
}

async function tryFetch(url: string): Promise<Response> {
  // Try multiple URL variants for Tauri vs Vite dev
  const variants = [url, `./${url.replace(/^\//, "")}`, `lineups.json`, `./lineups.json`];
  let lastError: any = null;
  for (const v of variants) {
    try {
      const res = await fetch(v);
      if (res.ok) return res;
      lastError = new Error(`Failed to load lineups: ${res.status} for ${v}`);
    } catch (e) {
      lastError = e;
      // try next variant
    }
  }
  throw lastError ?? new Error("Failed to fetch lineups");
}

export class JsonLineupRepository implements LineupRepository {
  private cache: Lineup[] | null = null;
  constructor(private url = "/lineups.json") {}
  async getAll(): Promise<Lineup[]> {
    if (this.cache) return this.cache;
    try {
      const res = await tryFetch(this.url);
      const data = (await res.json()) as Lineup[];
      this.cache = data.map((l) => ({
        ...l,
        difficulty: (l.difficulty === "medium" as any ? "normal" : l.difficulty) as Lineup["difficulty"],
        importance: (l.importance ?? "useful") as Lineup["importance"],
        bounces: l.bounces ?? [],
        tags: l.tags ?? [],
        media: l.media ?? {},
      }));
      return this.cache;
    } catch (e) {
      console.warn("[LineupRepository] fetch failed, using embedded fallback", e);
      // Fallback to embedded data bundled at build time (ensures Tauri never shows full-screen error)
      const data = (fallbackLineups as unknown as Lineup[]).map((l) => ({
        ...l,
        difficulty: (l.difficulty === "medium" as any ? "normal" : l.difficulty) as Lineup["difficulty"],
        importance: (l.importance ?? "useful") as Lineup["importance"],
        bounces: l.bounces ?? [],
        tags: l.tags ?? [],
        media: l.media ?? {},
      }));
      this.cache = data;
      return this.cache;
    }
  }
  async getById(id: string) {
    const all = await this.getAll();
    return all.find((l) => l.id === id);
  }
}

export function loadLineupsFromFile(file: File): Promise<Lineup[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(reader.result as string);
        if (!Array.isArray(arr)) throw new Error("JSON must be array");
        resolve(arr as Lineup[]);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
