import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AbilityMode, AssetProgress, Catalog, ImportPreview, ImportReport, LibraryAdapter, Lineup } from './types';
import { listen } from '@tauri-apps/api/event';
import { createAdapter } from './lib/adapter';
import { ImageProvider } from './lib/images';
import { Browse } from './components/Browse';
import { Editor } from './components/Editor';
import { DesktopSettings } from './components/DesktopSettings';
import { OverlayView } from './components/OverlayView';
import { SyncSettings } from './components/SyncSettings';
import { DataSettings } from './components/DataSettings';
import { AppShell, type Page } from './components/AppShell';
import { Button, Card, ProgressBar, ToastProvider } from './components/ui';

export function App({ platform }: { platform: 'desktop' | 'mobile' }) {
  const adapter = useMemo<LibraryAdapter>(() => createAdapter(), []);
  return <ToastProvider><ImageProvider adapter={adapter}><AppInner adapter={adapter} platform={platform} /></ImageProvider></ToastProvider>;
}
function AppInner({ adapter, platform }: { adapter: LibraryAdapter; platform: 'desktop' | 'mobile' }) {
  const [page, setPage] = useState<Page>('browse'); const [editId, setEditId] = useState<string | null>(null);
  const [lineups, setLineups] = useState<Lineup[]>([]); const [catalog, setCatalog] = useState<Catalog | null>(null); const [modes, setModes] = useState<AbilityMode[]>([]); const [error, setError] = useState('');
  const [assetProgress, setAssetProgress] = useState<AssetProgress | null>(null);
  const native = adapter.kind === 'tauri' && typeof window !== 'undefined' && !('__LL_MOCK_STATE__' in window);
  const refresh = useCallback(async () => { try { const [ls, cat, ms] = await Promise.all([adapter.listLineups(), adapter.catalog(), adapter.modes()]); setLineups(ls); setCatalog(cat); setModes(ms); setError(''); } catch (e) { setError(String(e)); } }, [adapter]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    let live = true; let un: (() => void) | undefined;
    if (adapter.kind === 'tauri') void listen<AssetProgress>('lineuplab://assets', e => { if (live) setAssetProgress(e.payload); }).then(f => { un = f; });
    void adapter.prepareAssets(false).then(cat => { if (live) { setCatalog(cat); setAssetProgress(null); } }).catch(e => { if (live) setError(String(e)); });
    return () => { live = false; un?.(); };
  }, [adapter]);
  const browseOnly = platform === 'mobile';
  if (typeof window !== 'undefined' && (window.location.hash === '#overlay' || new URLSearchParams(window.location.search).has('overlay'))) return <OverlayView adapter={adapter} />;
  const openEditor = (id?: string | null) => { setEditId(id ?? null); setPage('editor'); };
  const navigate = (p: Page) => { if (p === 'editor') openEditor(null); else setPage(p); };
  return <AppShell platform={platform} page={page} onNavigate={navigate} catalog={catalog} assetProgress={assetProgress} native={native}>
    {error && <Card className="mb-4 border-ll-accent" role="alert"><p className="text-ll-accent">{error}</p><Button className="mt-2" onClick={refresh}>Retry</Button></Card>}
    {page === 'browse' && <Browse adapter={adapter} lineups={lineups} catalog={catalog} readOnly={browseOnly} onEdit={id => browseOnly ? undefined : openEditor(id)} onRefresh={refresh} />}
    {page === 'editor' && !browseOnly && <Editor adapter={adapter} lineupId={editId} catalog={catalog} modes={modes} lineups={lineups} onSaved={() => { void refresh(); setPage('browse'); }} onCancel={() => setPage('browse')} />}
    {page === 'import' && !browseOnly && <ImportExport adapter={adapter} lineups={lineups} onRefresh={refresh} />}
    {page === 'sync' && <SyncSettings adapter={adapter} host={false} />}
    {page === 'settings' && <Settings adapter={adapter} catalog={catalog} onRefresh={refresh} browseOnly={browseOnly} />}
    {assetProgress && assetProgress.phase === 'downloading' && assetProgress.done < assetProgress.total && <FirstRunProgress progress={assetProgress} />}
  </AppShell>;
}
function FirstRunProgress({ progress }: { progress: AssetProgress }) {
  return <div className="ll-overlay" role="status" data-testid="first-run-progress"><div className="ll-modal" style={{ width: 460 }}><div className="ll-modal__body" style={{ textAlign: 'center', padding: 32 }}><div className="ll-logo" style={{ justifyContent: 'center', marginBottom: 12 }}><span className="ll-logo__mark" /><span>Lineup<span>Lab</span></span></div><h2 className="ll-h2">Downloading game data {progress.done}/{progress.total}</h2><p className="ll-muted">Agent, ability and map art for offline use. No Riot assets are bundled.</p><div style={{ marginTop: 20 }}><ProgressBar value={progress.done} max={progress.total} label="Downloading game data" /></div><p className="ll-muted" style={{ fontSize: 12, marginTop: 8 }}>{progress.current || 'Preparing catalog…'}</p>{progress.failed > 0 && <p style={{ color: 'var(--ll-warning)', fontSize: 13, marginTop: 8 }}>{progress.failed} downloads failed; cached art remains usable. Retry in Settings → Data.</p>}</div></div></div>;
}
function ImportExport({ adapter, lineups, onRefresh }: { adapter: LibraryAdapter; lineups: Lineup[]; onRefresh(): void }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null); const [bytes, setBytes] = useState<Uint8Array | null>(null); const [selected, setSelected] = useState<Set<string>>(new Set()); const [policy, setPolicy] = useState('overwrite-if-newer'); const [report, setReport] = useState<ImportReport | null>(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const choose = async (file: File) => { setBusy(true); setMsg(''); try { const b = new Uint8Array(await file.arrayBuffer()); const p = await adapter.importPreview(b); setBytes(b); setPreview(p); setSelected(new Set(p.entries.filter(e => e.selected).map(e => e.id))); setReport(null); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };
  const commit = async () => { if (!bytes || !preview) return; setBusy(true); try { const r = await adapter.importCommit(bytes, [...selected], policy); setReport(r); setMsg(`Imported ${r.imported}, skipped ${r.skipped}, copied ${r.copied}.`); onRefresh(); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };
  const exportAll = async (ids: string[] | null) => { setBusy(true); try { const b = await adapter.exportPack(ids, true, false); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([b as BlobPart], { type: 'application/zip' })); a.download = 'lineuplab-pack.zip'; a.click(); setMsg('Exported legacy-compatible ZIP.'); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };
  return <div className="mx-auto max-w-3xl space-y-4" data-testid="import-export">
    <Card><h2 className="ll-h2 mb-2">Import legacy pack</h2><p className="ll-muted mb-3">Same ZIP format as ValLineups Windows Desktop Studio. Originals are never modified; unknown fields are preserved.</p><label className="ll-btn ll-btn--primary cursor-pointer">Choose .zip<input type="file" accept=".zip,application/zip" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void choose(f); }} /></label>
      {preview && <div className="mt-4 space-y-2 text-sm">{preview.seed && <p className="rounded bg-amber-950 p-2 text-amber-200">Seed placeholder pack — entries default to unchecked.</p>}{preview.warnings.map((w, i) => <p key={i} className="text-amber-300">{w}</p>)}<div className="max-h-72 overflow-auto rounded border border-ll-border">{preview.entries.map(e => <label key={e.id} className="flex items-start gap-2 border-b border-ll-border p-2 last:border-0"><input type="checkbox" checked={selected.has(e.id)} onChange={ev => setSelected(s => { const n = new Set(s); if (ev.target.checked) n.add(e.id); else n.delete(e.id); return n; })} className="mt-1" /><span className="flex-1"><span className="font-medium">{e.title || e.id}</span><span className="ml-2 rounded bg-ll-raised px-1 text-xs">{e.status}</span>{e.warnings.map((w, i) => <span key={i} className="block text-xs text-amber-400">{w}</span>)}</span></label>)}</div><div className="flex flex-wrap items-center gap-2"><select value={policy} onChange={e => setPolicy(e.target.value)} className="ll-input ll-select w-auto"><option value="overwrite-if-newer">Overwrite if newer</option><option value="skip">Skip conflicts</option><option value="import-as-copy">Import as copy</option></select><Button variant="primary" onClick={commit} disabled={busy || selected.size === 0}>Import {selected.size}</Button>{report && <Button onClick={async () => { await adapter.undoImport(report.batchId); setMsg('Import undone.'); setReport(null); onRefresh(); }}>Undo batch</Button>}</div></div>}
    </Card>
    <Card><h2 className="ll-h2 mb-2">Export</h2><div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => exportAll(null)} disabled={busy}>Export all ({lineups.length})</Button><Button onClick={() => exportAll(lineups.filter(l => l.isFavorite).map(l => l.id))} disabled={busy}>Export favorites</Button></div><p className="ll-muted mt-2 text-xs">Legacy-compatible images on by default: WebP originals are included alongside JPEG views for the old app.</p></Card>
    {msg && <p role="status" className="text-ll-success">{msg}</p>}
  </div>;
}
function Settings({ adapter, catalog, onRefresh, browseOnly = false }: { adapter: LibraryAdapter; catalog: Catalog | null; onRefresh(): void; browseOnly?: boolean }) {
  return <div className="mx-auto max-w-3xl space-y-4" data-testid="settings">
    <Card><h2 className="ll-h2 mb-2">Catalog</h2><p className="ll-muted">Version {catalog?.version ?? '—'} · last updated {catalog ? new Date(catalog.updatedAt).toLocaleString() : '—'}{catalog?.stale ? ' (offline cache)' : ''}</p><Button className="mt-2" onClick={onRefresh}>Refresh</Button><p className="ll-muted mt-2 text-xs">Agent/map art is fetched at runtime and cached; no Riot assets are bundled. Archived references are kept so lineups never disappear.</p></Card>
    {!browseOnly && <DesktopSettings adapter={adapter} />}
    {browseOnly && <Card><h2 className="ll-h2 mb-2">Browse-only companion</h2><p className="ll-muted">Creation, overlay and hotkeys are desktop-only. Pair with a desktop library to browse offline.</p></Card>}
    {!browseOnly && <SyncSettings adapter={adapter} host />}
    <DataSettings adapter={adapter} onRefresh={onRefresh} />
  </div>;
}
