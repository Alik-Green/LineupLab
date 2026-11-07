import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import type { Catalog, ImageLoadRecord, ImageSelfTestResult, LibraryAdapter } from '../types';

interface ImageContextValue {
  adapter: LibraryAdapter | null;
  records: ImageLoadRecord[];
  report(record: ImageLoadRecord): void;
  runSelfTest(): Promise<ImageSelfTestResult>;
  testing: boolean;
  lastTest: ImageSelfTestResult | null;
}
const ImageContext = createContext<ImageContextValue>({ adapter: null, records: [], report: () => {}, runSelfTest: async () => ({ total: 0, ok: 0, failed: 0, types: {}, errors: [], finishedAt: Date.now() }), testing: false, lastTest: null });

export function catalogAssets(catalog: Catalog | null): { kind: string; url: string }[] {
  if (!catalog) return [];
  const out: { kind: string; url: string }[] = [];
  for (const a of catalog.agents) {
    if (a.displayIcon) out.push({ kind: 'agent', url: a.displayIcon });
    if (a.roleIcon) out.push({ kind: 'role', url: a.roleIcon });
    for (const b of a.abilities ?? []) if (b.displayIcon) out.push({ kind: 'ability', url: b.displayIcon });
  }
  for (const m of catalog.maps) {
    if (m.displayIcon) out.push({ kind: 'minimap', url: m.displayIcon });
    if (m.listViewIcon) out.push({ kind: 'map', url: m.listViewIcon });
    if (m.splash) out.push({ kind: 'mapSplash', url: m.splash });
  }
  const seen = new Set<string>();
  return out.filter(a => { const key = `${a.kind}:${a.url}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

export function ImageProvider({ adapter, children }: { adapter: LibraryAdapter; children: ReactNode }) {
  const [records, setRecords] = useState<ImageLoadRecord[]>([]);
  const [testing, setTesting] = useState(false);
  const [lastTest, setLastTest] = useState<ImageSelfTestResult | null>(null);
  const report = useCallback((record: ImageLoadRecord) => {
    setRecords(prev => [...prev.slice(-299), record]);
    if (!record.ok) console.warn('[LineupLab image]', record.kind, record.url, record.resolved, record.message);
  }, []);
  const runSelfTest = useCallback(async () => {
    setTesting(true);
    const result: ImageSelfTestResult = { total: 0, ok: 0, failed: 0, types: {}, errors: [], finishedAt: 0 };
    try {
      const catalog = await adapter.catalog();
      const assets = catalogAssets(catalog);
      result.total = assets.length;
      let index = 0;
      const loadOne = async (asset: { kind: string; url: string }) => {
        const type = result.types[asset.kind] ??= { total: 0, ok: 0, failed: 0 };
        type.total++;
        let resolved = asset.url;
        try { resolved = await adapter.resolveImageUrl(asset.url); } catch (e) { report({ url: asset.url, kind: asset.kind, ok: false, message: `resolve: ${String(e)}`, at: Date.now() }); }
        await new Promise<void>(resolve => {
          const img = new Image();
          const timer = window.setTimeout(() => { img.src = ''; fail('timeout'); }, 10000);
          const done = (ok: boolean, message?: string) => { window.clearTimeout(timer); img.onload = null; img.onerror = null; if (ok) { result.ok++; type.ok++; report({ url: asset.url, resolved, kind: asset.kind, ok: true, at: Date.now() }); } else { result.failed++; type.failed++; const rec = { url: asset.url, resolved, kind: asset.kind, ok: false, message: message ?? 'image error (check CSP / asset protocol / cache)', at: Date.now() }; result.errors.push(rec); report(rec); void adapter.reportImageError(asset.url, rec.message ?? 'image error'); } resolve(); };
          const fail = (message: string) => done(false, message);
          img.onload = () => done(true);
          img.onerror = () => fail('image error (check CSP / asset protocol / cache)');
          img.src = resolved;
        });
      };
      const workers = Array.from({ length: Math.min(6, assets.length) }, async () => { while (index < assets.length) { const i = index++; await loadOne(assets[i]); } });
      await Promise.all(workers);
      result.finishedAt = Date.now();
      setLastTest(result);
      return result;
    } finally { setTesting(false); }
  }, [adapter, report]);
  const value = useMemo(() => ({ adapter, records, report, runSelfTest, testing, lastTest }), [adapter, records, report, runSelfTest, testing, lastTest]);
  return <ImageContext.Provider value={value}>{children}</ImageContext.Provider>;
}
export function useImageDiagnostics() { return useContext(ImageContext); }

export interface CachedImageState { src?: string; remote?: string; status: 'empty' | 'loading' | 'ready' | 'error'; error?: string }
/** Single cache-first resolver: Tauri asset URL first, remote fallback, never a raw filesystem path. */
export function useCachedImage(url?: string | null, kind = 'image'): CachedImageState {
  const { adapter, report } = useContext(ImageContext);
  const [state, setState] = useState<CachedImageState>({ status: url ? 'loading' : 'empty' });
  useEffect(() => {
    let live = true;
    if (!url) { setState({ status: 'empty' }); return; }
    setState({ status: 'loading' });
    const direct = /^(data:|blob:|asset:|http:\/\/asset\.localhost)/.test(url);
    const remote = /^https?:/.test(url) ? url : undefined;
    const resolve = async () => {
      try {
        let resolved = url;
        if (!direct && adapter) resolved = remote ? await adapter.resolveImageUrl(url) : await adapter.mediaUrl(url);
        if (/^(https?:|data:|blob:|asset:)/.test(resolved) === false && !direct && adapter) {
          // Native adapters return absolute cache paths; convertFileSrc is applied in the adapter.
          resolved = await adapter.resolveImageUrl(resolved);
        }
        if (live) setState({ src: resolved, remote, status: 'loading' });
      } catch (e) {
        if (live) { setState({ src: remote, remote, status: remote ? 'loading' : 'error', error: String(e) }); report({ url, kind, ok: false, message: String(e), at: Date.now() }); }
      }
    };
    void resolve();
    return () => { live = false; };
  }, [adapter, url, kind, report]);
  return state;
}

export interface ValImageProps {
  src?: string | null; alt?: string; kind?: string; className?: string; imgClassName?: string;
  fallbackLabel?: string; loading?: 'lazy' | 'eager'; draggable?: boolean;
  onLoad?(image: HTMLImageElement): void; onError?(message: string): void;
}
/** Image element used everywhere: skeleton, one retry, remote fallback, explicit error placeholder. */
export function ValImage({ src, alt = '', kind = 'image', className = '', imgClassName = '', fallbackLabel, loading = 'lazy', draggable = false, onLoad, onError }: ValImageProps) {
  const cached = useCachedImage(src, kind);
  const { report } = useContext(ImageContext);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const candidates = useMemo(() => [cached.src, cached.remote && cached.remote !== cached.src ? cached.remote : undefined, cached.src].filter(Boolean) as string[], [cached.src, cached.remote]);
  useEffect(() => { setAttempt(0); setLoaded(false); setFailed(false); }, [src, cached.src]);
  const current = candidates[Math.min(attempt, candidates.length - 1)];
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => { setLoaded(true); setFailed(false); report({ url: src ?? '', resolved: current, kind, ok: true, at: Date.now() }); onLoad?.(e.currentTarget); };
  const handleError = () => {
    const message = `Failed to load ${kind} image${current ? `: ${current}` : ''}`;
    report({ url: src ?? '', resolved: current, kind, ok: false, message, at: Date.now() });
    if (attempt < candidates.length - 1) { setAttempt(a => a + 1); setLoaded(false); }
    else { setFailed(true); onError?.(message); }
  };
  if (!src || cached.status === 'empty' || failed || !current) {
    return <div className={`val-image-fallback ${className}`} role="img" aria-label={alt || fallbackLabel || 'Image unavailable'} data-image-state="error"><ImageOff aria-hidden size={20} /><span>{fallbackLabel ?? initials(alt) ?? 'No image'}</span></div>;
  }
  return <div className={`val-image ${className}`} data-image-state={loaded ? 'ready' : 'loading'}>
    {!loaded && <div className="val-image-skeleton" aria-hidden />}
    <img key={`${current}-${attempt}`} src={current} alt={alt} className={imgClassName} loading={loading} draggable={draggable} onLoad={handleLoad} onError={handleError} />
  </div>;
}
function initials(label: string) { const words = label.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean); return words.length ? words.slice(0, 2).map(w => w[0]!.toUpperCase()).join('') : null; }
