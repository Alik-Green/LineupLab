import { useEffect, useState } from 'react';
import type { LibraryAdapter } from '../types';
export function useMediaUrl(adapter: LibraryAdapter, hash?: string | null) {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => { let live = true; setUrl(undefined); if (!hash) return; if (/^(https?:|data:|asset:|blob:)/.test(hash)) { setUrl(hash); return; } adapter.mediaUrl(hash).then(u => { if (live) setUrl(u); }).catch(() => { if (live) setUrl(undefined); }); return () => { live = false; }; }, [adapter, hash]);
  return url;
}
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => { try { const raw = localStorage.getItem(key); return raw ? { ...initial, ...JSON.parse(raw) } : initial; } catch { return initial; } });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}
