import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { AssetDiagnostics, LibraryAdapter } from '../types';
import { useImageDiagnostics } from '../lib/images';

export function formatBytes(bytes: number) { if (!bytes) return '0 B'; const units = ['B', 'KB', 'MB', 'GB']; const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))); return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`; }
export function DataSettings({ adapter, onRefresh }: { adapter: LibraryAdapter; onRefresh(): void }) {
  const { runSelfTest, testing, lastTest, records } = useImageDiagnostics();
  const [diag, setDiag] = useState<AssetDiagnostics | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const load = useCallback(async () => { try { setDiag(await adapter.assetDiagnostics()); } catch (e) { setMsg(String(e)); } }, [adapter]);
  useEffect(() => { void load(); }, [load]);
  const redownload = async () => { setBusy(true); setMsg(''); try { await adapter.prepareAssets(true); onRefresh(); await load(); setMsg('Game data refreshed. Cached images remain available offline.'); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };
  const test = async () => { setMsg(''); const r = await runSelfTest(); await load(); setMsg(r.failed ? `${r.failed} image(s) failed. See diagnostics below.` : `All ${r.ok} catalog images rendered successfully.`); };
  const errors = records.filter(r => !r.ok).slice(-12).reverse();
  return <div className="space-y-4" data-testid="data-settings">
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Game data & image cache</h2><p className="mt-1 text-sm text-slate-400">Version {diag?.audit.version || '—'} · cache {formatBytes(diag?.audit.cacheBytes ?? 0)} · {diag?.platform ?? adapter.kind}</p></div><div className="flex gap-2"><button onClick={redownload} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded bg-cyan-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><Download size={16} /> Re-download images</button><button onClick={test} disabled={testing} className="inline-flex min-h-10 items-center gap-2 rounded bg-slate-800 px-4 text-sm disabled:opacity-50"><RefreshCw size={16} className={testing ? 'animate-spin' : ''} /> Run image self-test</button></div></div>
      <p className="mt-2 text-xs text-slate-500">Agent, ability, map and minimap art is fetched at runtime and cached for offline use. No Riot assets are bundled. Cache: {diag?.cacheDir ?? '—'}</p>
      {msg && <p role="status" className="mt-2 text-sm text-cyan-300">{msg}</p>}
    </section>
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4" data-testid="asset-diagnostics">
      <h3 className="mb-2 flex items-center gap-2 text-base font-semibold"><ShieldCheck size={18} /> Startup self-test</h3>
      {lastTest && <p className={`mb-2 text-sm ${lastTest.failed ? 'text-amber-300' : 'text-emerald-300'}`}>{lastTest.ok}/{lastTest.total} images rendered · {lastTest.failed} failed · {new Date(lastTest.finishedAt).toLocaleTimeString()}</p>}
      <div className="overflow-auto rounded border border-slate-800"><table className="w-full text-left text-sm"><thead className="bg-slate-950/60 text-xs uppercase text-slate-400"><tr><th className="p-2">Asset type</th><th className="p-2">Cached</th><th className="p-2">Missing</th><th className="p-2">Invalid</th><th className="p-2">Rendered</th><th className="p-2">Size</th></tr></thead><tbody>
        {Object.entries(diag?.audit.types ?? {}).map(([kind, t]) => <tr key={kind} className="border-t border-slate-800"><td className="p-2 capitalize">{kind}</td><td className="p-2">{t.cached}/{t.total}</td><td className="p-2">{t.missing}</td><td className="p-2">{t.invalid}</td><td className="p-2">{lastTest?.types[kind] ? `${lastTest.types[kind].ok}/${lastTest.types[kind].total}` : '—'}</td><td className="p-2">{formatBytes(t.bytes)}</td></tr>)}
        {!Object.keys(diag?.audit.types ?? {}).length && <tr><td colSpan={6} className="p-3 text-slate-500">No native cache report yet. Run the self-test or re-download images.</td></tr>}
      </tbody></table></div>
      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2"><p>Asset protocol: {diag?.assetProtocol.enabled ? 'enabled' : 'browser mock'} · scope {diag?.assetProtocol.scope.join(', ') || 'n/a'}</p><p>Data dir: {diag?.dataDir ?? '—'}</p></div>
      {(diag?.audit.errors.length || errors.length) ? <div className="mt-3 rounded border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200"><p className="mb-1 flex items-center gap-1 font-semibold"><TriangleAlert size={14} /> Image / CSP / asset-protocol errors</p><ul className="max-h-40 space-y-1 overflow-auto">{diag?.audit.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}{errors.map((e, i) => <li key={`r${i}`}>{e.kind}: {e.message} ({e.url})</li>)}</ul></div> : <p className="mt-3 text-xs text-emerald-300">No image errors recorded.</p>}
    </section>
  </div>;
}
