import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AbilityMode, Catalog, ImportPreview, ImportReport, LibraryAdapter, Lineup } from './types';
import { createAdapter } from './lib/adapter';
import { Browse } from './components/Browse';
import { Editor } from './components/Editor';
import { DesktopSettings } from './components/DesktopSettings';
import { OverlayView } from './components/OverlayView';
import { SyncSettings } from './components/SyncSettings';

type Page = 'browse' | 'editor' | 'import' | 'settings';
export function App({ platform }: { platform: 'desktop' | 'mobile' }) {
  const adapter = useMemo<LibraryAdapter>(() => createAdapter(), []);
  const [page, setPage] = useState<Page>('browse'); const [editId, setEditId] = useState<string | null>(null);
  const [lineups, setLineups] = useState<Lineup[]>([]); const [catalog, setCatalog] = useState<Catalog | null>(null); const [modes, setModes] = useState<AbilityMode[]>([]); const [error, setError] = useState('');
  const refresh = useCallback(async () => { try { const [ls, cat, ms] = await Promise.all([adapter.listLineups(), adapter.catalog(), adapter.modes()]); setLineups(ls); setCatalog(cat); setModes(ms); setError(''); } catch (e) { setError(String(e)); } }, [adapter]);
  useEffect(() => { void refresh(); }, [refresh]);
  const browseOnly = platform === 'mobile';
  if (typeof window !== 'undefined' && (window.location.hash === '#overlay' || new URLSearchParams(window.location.search).has('overlay'))) return <OverlayView adapter={adapter} />;
  const openEditor = (id?: string | null) => { setEditId(id ?? null); setPage('editor'); };
  return <main className="min-h-screen bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
        <button onClick={() => setPage('browse')} className="text-lg font-black tracking-tight">Lineup<span className="text-cyan-400">Lab</span></button>
        <nav className="flex gap-1 text-sm">
          <NavButton active={page === 'browse'} onClick={() => setPage('browse')}>Browse</NavButton>
          {!browseOnly && <NavButton active={page === 'editor'} onClick={() => openEditor(null)}>Create</NavButton>}
          {!browseOnly && <NavButton active={page === 'import'} onClick={() => setPage('import')}>Import / Export</NavButton>}
          <NavButton active={page === 'settings'} onClick={() => setPage('settings')}>Settings</NavButton>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${adapter.kind === 'tauri' ? 'bg-emerald-400' : 'bg-amber-400'}`} />{adapter.kind === 'tauri' ? 'Desktop core' : 'Browser demo'}{browseOnly && <span className="rounded bg-slate-800 px-1.5 py-0.5">browse-only</span>}{catalog && <span className="hidden sm:inline">catalog {new Date(catalog.updatedAt).toLocaleTimeString()}</span>}</div>
      </div>
    </header>
    <div className="mx-auto max-w-[1600px] p-4">
      {error && <div className="mb-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200" role="alert">{error} <button onClick={refresh} className="ml-2 underline">Retry</button></div>}
      {page === 'browse' && <Browse adapter={adapter} lineups={lineups} catalog={catalog} readOnly={browseOnly} onEdit={id => browseOnly ? undefined : openEditor(id)} onRefresh={refresh} />}
      {page === 'editor' && !browseOnly && <Editor adapter={adapter} lineupId={editId} catalog={catalog} modes={modes} onSaved={() => { void refresh(); }} onCancel={() => setPage('browse')} />}
      {page === 'import' && !browseOnly && <ImportExport adapter={adapter} lineups={lineups} onRefresh={refresh} />}
      {page === 'settings' && <Settings adapter={adapter} catalog={catalog} onRefresh={refresh} browseOnly={browseOnly} />}
    </div>
  </main>;
}
function NavButton({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) { return <button onClick={onClick} className={`rounded-lg px-3 py-1.5 ${active ? 'bg-slate-800 text-cyan-300' : 'text-slate-300 hover:bg-slate-900'}`}>{children}</button>; }
function ImportExport({ adapter, lineups, onRefresh }: { adapter: LibraryAdapter; lineups: Lineup[]; onRefresh(): void }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null); const [bytes, setBytes] = useState<Uint8Array | null>(null); const [selected, setSelected] = useState<Set<string>>(new Set()); const [policy, setPolicy] = useState('overwrite-if-newer'); const [report, setReport] = useState<ImportReport | null>(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const choose = async (file: File) => { setBusy(true); setMsg(''); try { const b = new Uint8Array(await file.arrayBuffer()); const p = await adapter.importPreview(b); setBytes(b); setPreview(p); setSelected(new Set(p.entries.filter(e => e.selected).map(e => e.id))); setReport(null); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };
  const commit = async () => { if (!bytes || !preview) return; setBusy(true); try { const r = await adapter.importCommit(bytes, [...selected], policy); setReport(r); setMsg(`Imported ${r.imported}, skipped ${r.skipped}, copied ${r.copied}.`); onRefresh(); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };
  const exportAll = async (ids: string[] | null) => { setBusy(true); try { const b = await adapter.exportPack(ids, true, false); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([b as BlobPart], { type: 'application/zip' })); a.download = 'lineuplab-pack.zip'; a.click(); setMsg('Exported legacy-compatible ZIP.'); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };
  return <div className="mx-auto max-w-3xl space-y-4" data-testid="import-export">
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><h2 className="mb-2 text-lg font-semibold">Import legacy pack</h2><p className="mb-3 text-sm text-slate-400">Same ZIP format as ValLineups Windows Desktop Studio. Originals are never modified; unknown fields are preserved.</p><label className="inline-block cursor-pointer rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">Choose .zip<input type="file" accept=".zip,application/zip" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void choose(f); }} /></label>
      {preview && <div className="mt-4 space-y-2 text-sm">{preview.seed && <p className="rounded bg-amber-950 p-2 text-amber-200">Seed placeholder pack — entries default to unchecked.</p>}{preview.warnings.map((w, i) => <p key={i} className="text-amber-300">{w}</p>)}<div className="max-h-72 overflow-auto rounded border border-slate-800">{preview.entries.map(e => <label key={e.id} className="flex items-start gap-2 border-b border-slate-800 p-2 last:border-0"><input type="checkbox" checked={selected.has(e.id)} onChange={ev => setSelected(s => { const n = new Set(s); if (ev.target.checked) n.add(e.id); else n.delete(e.id); return n; })} className="mt-1" /><span className="flex-1"><span className="font-medium">{e.title || e.id}</span><span className="ml-2 rounded bg-slate-800 px-1 text-xs">{e.status}</span>{e.warnings.map((w, i) => <span key={i} className="block text-xs text-amber-400">{w}</span>)}</span></label>)}</div><div className="flex flex-wrap items-center gap-2"><select value={policy} onChange={e => setPolicy(e.target.value)} className="rounded bg-slate-800 px-2 py-1.5"><option value="overwrite-if-newer">Overwrite if newer</option><option value="skip">Skip conflicts</option><option value="import-as-copy">Import as copy</option></select><button onClick={commit} disabled={busy || selected.size === 0} className="rounded bg-cyan-600 px-4 py-1.5 font-semibold text-white disabled:opacity-50">Import {selected.size}</button>{report && <button onClick={async () => { await adapter.undoImport(report.batchId); setMsg('Import undone.'); setReport(null); onRefresh(); }} className="rounded bg-slate-800 px-3 py-1.5">Undo batch</button>}</div></div>}
    </section>
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><h2 className="mb-2 text-lg font-semibold">Export</h2><div className="flex flex-wrap gap-2 text-sm"><button onClick={() => exportAll(null)} disabled={busy} className="rounded bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Export all ({lineups.length})</button><button onClick={() => exportAll(lineups.filter(l => l.isFavorite).map(l => l.id))} disabled={busy} className="rounded bg-slate-800 px-4 py-2 disabled:opacity-50">Export favorites</button></div><p className="mt-2 text-xs text-slate-500">Legacy-compatible images on by default: WebP originals are included alongside JPEG views for the old app.</p></section>
    {msg && <p className="text-sm text-cyan-300" role="status">{msg}</p>}
  </div>;
}
function Settings({ adapter, catalog, onRefresh, browseOnly = false }: { adapter: LibraryAdapter; catalog: Catalog | null; onRefresh(): void; browseOnly?: boolean }) {
  return <div className="mx-auto max-w-2xl space-y-4" data-testid="settings">
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><h2 className="mb-2 text-lg font-semibold">Catalog</h2><p className="text-sm text-slate-400">Version {catalog?.version ?? '—'} · last updated {catalog ? new Date(catalog.updatedAt).toLocaleString() : '—'}{catalog?.stale ? ' (offline cache)' : ''}</p><button onClick={onRefresh} className="mt-2 rounded bg-slate-800 px-3 py-1.5 text-sm">Refresh</button><p className="mt-2 text-xs text-slate-500">Agent/map art is fetched at runtime and cached; no Riot assets are bundled. Archived references are kept so lineups never disappear.</p></section>
    {!browseOnly && <DesktopSettings adapter={adapter} />}
    {browseOnly && <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><h2 className="mb-2 text-lg font-semibold">Browse-only companion</h2><p className="text-sm text-slate-400">Creation, overlay and hotkeys are desktop-only. Pair with a desktop library to browse offline.</p></section>}
    <SyncSettings adapter={adapter} host={!browseOnly} />
  </div>;
}
