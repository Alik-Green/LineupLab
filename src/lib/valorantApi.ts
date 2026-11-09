import type { ValorantAgent, ValorantMap } from "../types/lineup";

const AGENTS_KEY = "lineuplab_agents_cache";
const MAPS_KEY = "lineuplab_maps_cache";
const VERSION_KEY = "lineuplab_version";

export const VALORANT_API = "https://valorant-api.com";

/** Fetches with cache in localStorage keyed by game version. Returns cached immediately if version matches. */
export async function getVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${VALORANT_API}/v1/version`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.riotClientVersion ?? json?.data?.version ?? null;
  } catch {
    return null;
  }
}

function loadCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
function saveCache(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export async function fetchAgents(): Promise<ValorantAgent[]> {
  // Try cache first
  const cached = loadCache<{ version: string; data: ValorantAgent[] }>(AGENTS_KEY);
  const version = await getVersion();
  if (cached && version && cached.version === version) {
    return cached.data;
  }
  if (cached && !version) {
    // offline, use cache
    return cached.data;
  }
  try {
    const res = await fetch(`${VALORANT_API}/v1/agents?isPlayableCharacter=true`);
    if (!res.ok) throw new Error("agents fetch failed");
    const json = await res.json();
    const data: ValorantAgent[] = json.data;
    if (version) saveCache(AGENTS_KEY, { version, data });
    else saveCache(AGENTS_KEY, { version: "unknown", data });
    return data;
  } catch (e) {
    if (cached) return cached.data;
    throw e;
  }
}

const EXCLUDED_MAPS = new Set(["The Range", "The Range ", "Basic Training"]);

// Competitive (comp/unrated) maps allowlist — excludes TDM/DM etc
const COMPETITIVE_MAP_NAMES = new Set([
  "Abyss", "Ascent", "Bind", "Breeze", "Corrode", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset",
]);
function isCompetitiveMap(m: any): boolean {
  if (EXCLUDED_MAPS.has(m.displayName)) return false;
  if (COMPETITIVE_MAP_NAMES.has(m.displayName)) return true;
  const nonCompKeywords = ["District", "Drift", "Kasbah", "Piazza", "Range", "Training", "Deathmatch", "Spike Rush", "Replication", "Escalation", "Snowball"];
  if (nonCompKeywords.some((k) => m.displayName.includes(k))) return false;
  return false;
}

export async function fetchMaps(): Promise<ValorantMap[]> {
  const cached = loadCache<{ version: string; data: ValorantMap[] }>(MAPS_KEY);
  const version = await getVersion();
  if (cached && version && cached.version === version) return cached.data;
  if (cached && !version) return cached.data;

  try {
    const res = await fetch(`${VALORANT_API}/v1/maps`);
    if (!res.ok) throw new Error("maps fetch failed");
    const json = await res.json();
    let data: ValorantMap[] = json.data;
    data = data.filter((m: any) => isCompetitiveMap(m));
    if (version) saveCache(MAPS_KEY, { version, data });
    return data;
  } catch (e) {
    if (cached) return cached.data;
    throw e;
  }
}

export function getVersionCache(): string | null {
  try {
    return localStorage.getItem(VERSION_KEY);
  } catch {
    return null;
  }
}
