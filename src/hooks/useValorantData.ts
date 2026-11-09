import { useEffect, useState } from "react";
import { fetchAgents, fetchMaps } from "../lib/valorantApi";
import type { ValorantAgent, ValorantMap } from "../types/lineup";

// Fallback static snapshots for offline / when API blocked
import fallbackAgents from "../data/fallbackAgents.json";
import fallbackMaps from "../data/fallbackMaps.json";

export function useValorantData() {
  const [agents, setAgents] = useState<ValorantAgent[] | null>(null);
  const [maps, setMaps] = useState<ValorantMap[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, m] = await Promise.all([fetchAgents(), fetchMaps()]);
      setAgents(a);
      setMaps(m);
    } catch (e: any) {
      console.warn("Valorant API fetch failed, using fallback", e);
      // fallback
      try {
        // try fallback files if they exist
        setAgents(fallbackAgents as any);
        setMaps(fallbackMaps as any);
      } catch {
        setError(e?.message ?? "Failed to load game data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { agents, maps, loading, error, retry: load };
}
