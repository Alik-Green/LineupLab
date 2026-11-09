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
    // Exclude The Range and non-competitive if possible
    data = data.filter((m: any) => {
      if (EXCLUDED_MAPS.has(m.displayName)) return false;
      // filter out duplicates or broken minimaps? Keep if displayIcon exists
      // Some maps like "District" arcade etc - still keep unless no minimap
      return true;
    });
    // Prefer maps with displayIcon (minimap) but keep all for picker
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
