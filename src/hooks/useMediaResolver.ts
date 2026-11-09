import { useEffect, useState } from "react";
import { getMediaUrl, getMediaByLineup } from "../lib/indexedDBRepository";

/**
 * Resolve asset paths like "media/asset_001.jpg" to blob URLs from IndexedDB
 * Returns original string if no DB record found (so http urls still work)
 */
export function useMediaResolver(sources: (string | undefined)[]) {
  const [resolved, setResolved] = useState<(string | undefined)[]>(sources);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const results: (string | undefined)[] = [];
      for (const src of sources) {
        if (!src) {
          results.push(undefined);
          continue;
        }
        if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("blob:")) {
          results.push(src);
          continue;
        }
        try {
          const url = await getMediaUrl(src);
          if (url) {
            urls.push(url);
            results.push(url);
          } else {
            // Try without media/ prefix, or just short name
            const short = src.split("/").pop()!;
            const url2 = await getMediaUrl(short);
            if (url2) {
              urls.push(url2);
              results.push(url2);
            } else {
              results.push(src); // fallback to original (will show placeholder)
            }
          }
        } catch {
          results.push(src);
        }
      }
      if (!cancelled) setResolved(results);
    })();
    return () => {
      cancelled = true;
      // Don't revoke immediately - other components may still use blob URLs
      // Let them persist until next resolve; revoke after delay
      if (urls.length) {
        setTimeout(() => urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch {} }), 30000);
      }
    };
  }, [JSON.stringify(sources)]);

  return resolved;
}

/**
 * Resolve all media for a lineup by looking up media records by lineupId
 * Used as fallback when asset names don't match
 */
export function useLineupMedia(lineupId: string | null) {
  const [mediaMap, setMediaMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!lineupId) return;
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      try {
        const records = await getMediaByLineup(lineupId);
        const map: Record<string, string> = {};
        for (const rec of records) {
          try {
            const url = URL.createObjectURL(rec.blob);
            urls.push(url);
            // map by short name and full name
            const short = rec.assetName.split("/").pop()!.toLowerCase();
            map[rec.assetName.toLowerCase()] = url;
            map[short] = url;
          } catch {}
        }
        if (!cancelled) setMediaMap(map);
      } catch {}
    })();
    return () => {
      cancelled = true;
      setTimeout(() => urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch {} }), 30000);
    };
  }, [lineupId]);

  return mediaMap;
}
