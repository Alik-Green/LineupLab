import { useCallback, useEffect, useState } from 'react';
import { Database, Download, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { AssetDiagnostics, LibraryAdapter } from '../types';
import { useImageDiagnostics } from '../lib/images';
import { Button, Card, StatusDot, useToast } from './ui';

export function formatBytes(bytes: number) { if (!bytes) return '0 B'; const units = ['B', 'KB', 'MB', 'GB']; const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))); return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`; }
function useDiag(adapter: LibraryAdapter) {
  const [diag, setDiag] = useState<AssetDiagnostics | null>(null);
  const load = useCallback(async () => { try { setDiag(await adapter.assetDiagnostics()); } catch { /* native report unavailable in browser demo */ } }, [adapter]);
  useEffect(() => { void load(); }, [load]);
  return { diag, load };
}
export function DataPanel({ adapter, onRefresh }: { adapter: LibraryAdapter; onRefresh(): void }) {
  const toast = useToast(); const { diag, load } = useDiag(adapter); const [busy, setBusy] = useState(false);
  const redownload = async () => { setBusy(true); try { await adapter.prepareAssets(true); onRefresh(); await load(); toast.push('Game data refreshed. Cached images remain available offline.', 'success'); } catch (e) { toast.push(String(e), 'error'); } finally { setBusy(false); } };
  const total = Object.values(diag?.audit.types ?? {}).reduce((s, t) => s + t.total, 0); const cached = Object.values(diag?.audit.types ?? {}).reduce((s, t) => s + t.cached, 0);
  return <div className="ll-settings-grid" data-testid="data-settings">
    <Card><h2 className="ll-h2 mb-2 flex items-center gap-2"><Database size={18} /> Game data & image cache</h2><p className="ll-muted">Agent, ability, map and minimap art is fetched at runtime and cached for offline use. No Riot assets are bundled.</p>
      <dl className="ll-meta-grid mt-3"><dt>Catalog version</dt><dd>{diag?.audit.version || '—'}</dd><dt>Cache size</dt><dd>{formatBytes(diag?.audit.cacheBytes ?? 0)}</dd><dt>Assets cached</dt><dd>{cached}/{total}</dd><dt>Platform</dt><dd>{diag?.platform ?? adapter.kind}</dd><dt>Cache folder</dt><dd className="ll-break">{diag?.cacheDir ?? '—'}</dd><dt>Data folder</dt><dd className="ll-break">{diag?.dataDir ?? '—'}</dd></dl>
      <div className="ll-btn-row mt-4"><Button variant="primary" icon={<Download size={16} />} loading={busy} onClick={redownload}>Re-download images</Button><Button icon={<RefreshCw size={16} />} onClick={() => { void load(); onRefresh(); }}>Refresh report</Button></div></Card>
    <Card><h2 className="ll-h2 mb-2">Cache by asset type</h2><div className="ll-table-wrap"><table className="ll-table"><thead><tr><th>Asset type</th><th>Cached</th><th>Missing</th><th>Invalid</th><th>Size</th></tr></thead><tbody>
      {Object.entries(diag?.audit.types ?? {}).map(([kind, t]) => <tr key={kind}><td className="capitalize">{kind}</td><td>{t.cached}/{t.total}</td><td>{t.missing ? <span className="ll-warn-text">{t.missing}</span> : '0'}</td><td>{t.invalid ? <span className="ll-warn-text">{t.invalid}</span> : '0'}</td><td>{formatBytes(t.bytes)}</td></tr>)}
      {!Object.keys(diag?.audit.types ?? {}).length && <tr><td colSpan={5} className="ll-muted">No native cache report yet. Re-download images to populate the cache.</td></tr>}
    </tbody></table></div></Card>
  </div>;
}
export function DiagnosticsPanel({ adapter }: { adapter: LibraryAdapter }) {
  const { runSelfTest, testing, lastTest, records } = useImageDiagnostics(); const { diag, load } = useDiag(adapter); const [msg, setMsg] = useState('');
  const test = async () => { setMsg(''); const r = await runSelfTest(); await load(); setMsg(r.failed ? `${r.failed} image(s) failed. See the error list below.` : `All ${r.ok} catalog images rendered successfully.`); };
  const errors = records.filter(r => !r.ok).slice(-12).reverse();
  const hasErrors = (diag?.audit.errors.length ?? 0) > 0 || errors.length > 0;
  return <div className="ll-settings-grid" data-testid="asset-diagnostics">
    <Card><div className="ll-selector-head"><h2 className="ll-h2 flex items-center gap-2"><ShieldCheck size={18} /> Image self-test</h2><Button icon={<RefreshCw size={16} className={testing ? 'll-spin' : ''} />} loading={testing} onClick={test}>Run image self-test</Button></div>
      <p className="ll-muted">Loads every catalog image through the same cache-first layer the UI uses and reports CSP, asset-protocol and decode failures per asset type.</p>
      {msg && <p role="status" className={`ll-feedback ${lastTest?.failed ? 'll-feedback--conflict' : 'll-feedback--ok'}`}>{msg}</p>}
      {lastTest && <p className="ll-muted">{lastTest.ok}/{lastTest.total} images rendered · {lastTest.failed} failed · {new Date(lastTest.finishedAt).toLocaleTimeString()}</p>}
      <div className="ll-table-wrap mt-3"><table className="ll-table"><thead><tr><th>Asset type</th><th>Rendered</th><th>Failed</th><th>Cached</th></tr></thead><tbody>
        {Object.entries(diag?.audit.types ?? {}).map(([kind, t]) => <tr key={kind}><td className="capitalize">{kind}</td><td>{lastTest?.types[kind] ? `${lastTest.types[kind].ok}/${lastTest.types[kind].total}` : '—'}</td><td>{lastTest?.types[kind]?.failed ?? 0}</td><td>{t.cached}/{t.total}</td></tr>)}
        {!Object.keys(diag?.audit.types ?? {}).length && <tr><td colSpan={4} className="ll-muted">Run the self-test to populate results.</td></tr>}
      </tbody></table></div>
      <div className="ll-meta-grid mt-3"><dt>Asset protocol</dt><dd>{diag?.assetProtocol.enabled ? 'enabled' : 'browser mock'} · scope {diag?.assetProtocol.scope.join(', ') || 'n/a'}</dd></div></Card>
    <Card><h2 className="ll-h2 mb-2 flex items-center gap-2"><TriangleAlert size={18} /> Image / CSP errors</h2>
      {hasErrors ? <ul className="ll-error-list">{diag?.audit.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}{errors.map((e, i) => <li key={`r${i}`}><StatusDot tone="error" /> {e.kind}: {e.message} <span className="ll-break">({e.url})</span></li>)}</ul> : <p className="ll-ok"><StatusDot tone="success" /> No image errors recorded.</p>}
      <p className="ll-muted mt-3" style={{ fontSize: 12 }}>If images fail on Windows, check docs/IMAGE_LOADING.md: asset-protocol scope, CSP img-src and the cache folder permissions.</p></Card>
  </div>;
}
