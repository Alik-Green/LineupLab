import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Archive, Download, FileArchive, Import, Star, Undo2, Upload, X } from 'lucide-react';
import clsx from 'clsx';
import type { ImportPreview, ImportProgress, ImportReport, LibraryAdapter, Lineup } from '../types';
import { Button, Card, PageHeader, ProgressBar, Segmented, Toggle, useToast } from './ui';

export function ImportExport({ adapter, lineups, onRefresh }: { adapter: LibraryAdapter; lineups: Lineup[]; onRefresh(): void }) {
  const toast = useToast(); const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null); const [bytes, setBytes] = useState<Uint8Array | null>(null); const [fileName, setFileName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [policy, setPolicy] = useState('overwrite-if-newer'); const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false); const [dragOver, setDragOver] = useState(false); const [legacyImages, setLegacyImages] = useState(true); const [bake, setBake] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null); const [importError, setImportError] = useState('');
  useEffect(() => {
    if (adapter.kind !== 'tauri') return;
    let live = true; let un: (() => void) | undefined;
    void listen<ImportProgress>('lineuplab://import-progress', e => { if (live) setProgress(e.payload); }).then(f => { if (live) un = f; else f(); });
    return () => { live = false; un?.(); };
  }, [adapter]);
  const fail = (e: unknown) => { const message = e instanceof Error ? e.message : String(e); setImportError(message); setProgress(null); toast.push(message, 'error'); };
  const choose = async (file: File) => {
    if (busy) return;
    if (!/\.zip$/i.test(file.name) && file.type !== 'application/zip') { toast.push('Only legacy .zip packs can be imported.', 'warning'); return; }
    setBusy(true); setImportError(''); setReport(null); setProgress({ phase: 'reading', message: `Reading ${file.name}`, current: 0, total: 0 });
    try { const b = new Uint8Array(await file.arrayBuffer()); const p = await adapter.importPreview(b); setBytes(b); setFileName(file.name); setPreview(p); setSelected(new Set(p.entries.filter(e => e.selected).map(e => e.id))); setProgress(null); }
    catch (e) { fail(e); } finally { setBusy(false); }
  };
  const commit = async () => {
    if (!bytes || !preview || busy || selected.size === 0) return;
    setBusy(true); setImportError(''); setProgress({ phase: 'reading', message: 'Preparing import', current: 0, total: selected.size });
    try { const r = await adapter.importCommit(bytes, [...selected], policy); setReport(r); setProgress(null); toast.push(`Imported ${r.imported}, skipped ${r.skipped}, copied ${r.copied}.`, r.errors > 0 || r.warnings.length ? 'warning' : 'success'); onRefresh(); }
    catch (e) { fail(e); } finally { setBusy(false); }
  };
  const undo = async () => { if (!report || busy) return; setBusy(true); try { await adapter.undoImport(report.batchId); setReport(null); setPreview(null); setBytes(null); toast.push('Import undone.', 'success'); onRefresh(); } catch (e) { fail(e); } finally { setBusy(false); } };
  const exportAll = async (ids: string[] | null, label: string) => { if (busy) return; setBusy(true); try { const b = await adapter.exportPack(ids, legacyImages, bake); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([b as BlobPart], { type: 'application/zip' })); a.download = `lineuplab-${label}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast.push('Exported legacy-compatible ZIP.', 'success'); } catch (e) { fail(e); } finally { setBusy(false); } };
  const selectable = preview?.entries.filter(e => e.status !== 'error').map(e => e.id) ?? [];
  const allSelected = selectable.length > 0 && selectable.every(id => selected.has(id));
  const statusCount = (status: string) => preview?.entries.filter(e => e.status === status).length ?? 0;
  return <div data-testid="import-export"><PageHeader title="Import / Export" subtitle="Legacy-compatible ZIP packs. Originals are never modified; unknown fields are preserved." />
    <div className="ll-io-grid">
      <Card className="ll-io-card"><h2 className="ll-h2 mb-1 flex items-center gap-2"><Import size={18} /> Import a pack</h2><p className="ll-muted mb-3">Same ZIP format as ValLineups Windows Desktop Studio. Preview every entry before anything is written.</p>
        <div className={clsx('ll-dropzone', dragOver && 'is-over', busy && 'is-busy')} role="button" tabIndex={busy ? -1 : 0} aria-label="Drop a legacy ZIP pack or choose a file" aria-disabled={busy} onClick={() => { if (!busy) fileRef.current?.click(); }} onKeyDown={e => { if (!busy && (e.key === 'Enter' || e.key === ' ')) fileRef.current?.click(); }} onDragOver={e => { e.preventDefault(); if (!busy) setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) void choose(f); }}>
          <FileArchive size={28} /><strong>{fileName || 'Drop a .zip pack here'}</strong><span className="ll-muted">or click to choose · legacy packs only</span><Button variant="primary" icon={<Upload size={16} />} loading={busy && !preview} disabled={busy} onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>Choose .zip</Button>
          <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void choose(f); e.target.value = ''; }} /></div>
        {busy && <ImportProgressPanel progress={progress} />}
        {importError && <div className="ll-feedback ll-feedback--error ll-import-error" role="alert"><strong>Import failed{fileName ? `: ${fileName}` : ''}</strong><span>{importError}</span><span className="ll-muted">If the error happened during commit, the lineup transaction is rolled back. Check that the file is a complete legacy .zip pack, then try again.</span><Button variant="ghost" icon={<X size={14} />} onClick={() => setImportError('')}>Dismiss</Button></div>}
        {preview && <div className="ll-import-preview mt-4">{preview.seed && <p className="ll-feedback ll-feedback--conflict">Seed placeholder pack — entries default to unchecked.</p>}{preview.warnings.map((w, i) => <p key={i} className="ll-feedback ll-feedback--conflict">{w}</p>)}
          <p className="ll-muted ll-import-summary" role="status">{preview.entries.length} entries · {statusCount('new')} new · {statusCount('newer')} newer in pack · {statusCount('identical')} identical · {statusCount('error')} errors</p>
          {selected.size === 0 && selectable.length > 0 && <p className="ll-feedback ll-feedback--conflict">Nothing is selected. Existing/identical entries are unchecked by default; select entries below or choose “Import as copy”. <Button onClick={() => setSelected(new Set(selectable))}>Select all valid</Button></p>}
          <div className="ll-table-wrap"><table className="ll-table ll-import-table"><thead><tr><th><label className="ll-check"><input type="checkbox" aria-label="Select all entries" checked={allSelected} disabled={busy} onChange={e => setSelected(e.target.checked ? new Set(selectable) : new Set())} /></label></th><th>Lineup</th><th>Status</th><th>Warnings</th></tr></thead><tbody>
            {preview.entries.map(e => <tr key={e.id} className={clsx(selected.has(e.id) && 'is-selected', e.status === 'error' && 'has-error')}><td><label className="ll-check"><input type="checkbox" aria-label={`Select ${e.title || e.id}`} checked={selected.has(e.id)} disabled={e.status === 'error' || busy} onChange={ev => setSelected(s => { const n = new Set(s); if (ev.target.checked) n.add(e.id); else n.delete(e.id); return n; })} /></label></td><td><strong>{e.title || e.id}</strong><small className="ll-muted block">{e.id}</small></td><td><span className={clsx('ll-status-pill', `ll-status-pill--${e.status}`)}>{e.status}</span></td><td>{e.warnings.length ? <ul className="ll-warn-list">{e.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : <span className="ll-muted">—</span>}</td></tr>)}
          </tbody></table></div>
          <div className="ll-import-controls"><div className="ll-field"><span className="ll-label">Conflict policy</span><Segmented ariaLabel="Conflict policy" value={policy} onChange={setPolicy} options={[{ value: 'overwrite-if-newer', label: 'Overwrite if newer' }, { value: 'skip', label: 'Skip conflicts' }, { value: 'import-as-copy', label: 'Import as copy' }]} /></div><div className="ll-btn-row"><Button variant="primary" icon={<Import size={16} />} onClick={commit} loading={busy} disabled={selected.size === 0 || busy}>Import {selected.size}</Button>{report && <Button icon={<Undo2 size={16} />} onClick={undo} disabled={busy}>Undo batch</Button>}</div></div>
          {report && <div className="ll-import-report" role="status"><strong>Import finished</strong><span>{report.imported} imported · {report.skipped} skipped · {report.copied} copied · {report.overwritten} overwritten · {report.errors} errors</span>{report.warnings.length > 0 && <ul className="ll-warn-list">{report.warnings.map((e, i) => <li key={i}>{e}</li>)}</ul>}<span className="ll-muted">Batch {report.batchId} can be undone until the app closes.</span></div>}
        </div>}
      </Card>
      <Card className="ll-io-card"><h2 className="ll-h2 mb-1 flex items-center gap-2"><Archive size={18} /> Export a pack</h2><p className="ll-muted mb-3">Writes the same legacy ZIP so older tools can read it. Choose what to include.</p>
        <div className="ll-export-summary"><div><strong>{lineups.filter(l => !l.deleted).length}</strong><span className="ll-muted">lineups</span></div><div><strong>{lineups.filter(l => l.isFavorite && !l.deleted).length}</strong><span className="ll-muted">favorites</span></div><div><strong>{new Set(lineups.map(l => l.mapUuid)).size}</strong><span className="ll-muted">maps</span></div></div>
        <Toggle label="Include legacy JPEG views" checked={legacyImages} onChange={setLegacyImages} description="WebP originals plus JPEG copies so the old app can display every image." /><Toggle label="Bake annotations into exports" checked={bake} onChange={setBake} description="Also include flattened copies with circles/lenses drawn in. Originals stay untouched." />
        <div className="ll-btn-row mt-4"><Button variant="primary" icon={<Download size={16} />} loading={busy} disabled={busy} onClick={() => exportAll(null, 'all')}>Export all</Button><Button icon={<Star size={16} />} disabled={busy || !lineups.some(l => l.isFavorite)} onClick={() => exportAll(lineups.filter(l => l.isFavorite).map(l => l.id), 'favorites')}>Export favorites</Button></div>
        <p className="ll-muted mt-3" style={{ fontSize: 12 }}>Exports include steps, notes, tags, pins, annotations and all legacy/unknown fields.</p></Card>
    </div>
  </div>;
}

function ImportProgressPanel({ progress }: { progress: ImportProgress | null }) {
  const current = progress?.current ?? 0; const total = progress?.total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round(current / total * 100)) : null;
  return <div className="ll-import-progress" role="status" data-testid="import-progress" aria-live="polite">
    <div className="ll-import-progress__head"><strong>{progress?.message ?? 'Working…'}</strong>{pct !== null && <span>{current}/{total} · {pct}%</span>}</div>
    <ProgressBar value={current} max={total} label={progress?.message ?? 'Import progress'} />
    {pct === null && <span className="ll-muted">This step does not report a fixed count yet.</span>}
  </div>;
}
