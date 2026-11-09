import type { Lineup } from "../types/lineup";

export interface LineupRepository {
  getAll(): Promise<Lineup[]>;
  getById(id: string): Promise<Lineup | undefined>;
}

export class JsonLineupRepository implements LineupRepository {
  private cache: Lineup[] | null = null;
  constructor(private url = "/lineups.json") {}
  async getAll(): Promise<Lineup[]> {
    if (this.cache) return this.cache;
    const res = await fetch(this.url);
    if (!res.ok) throw new Error(`Failed to load lineups: ${res.status}`);
    const data = (await res.json()) as Lineup[];
    // normalize difficulty medium -> normal and importance default
    this.cache = data.map((l) => ({
      ...l,
      difficulty: (l.difficulty === "medium" as any ? "normal" : l.difficulty) as Lineup["difficulty"],
      importance: (l.importance ?? "useful") as Lineup["importance"],
      bounces: l.bounces ?? [],
      tags: l.tags ?? [],
      media: l.media ?? {},
    }));
    return this.cache;
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
