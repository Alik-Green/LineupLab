import { useEffect, useState } from 'react';
import { Download, Link2, Radar, RefreshCw, Server, Square, ShieldAlert } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import type { DiscoveredServer, DownloadProgress, DownloadReport, LibraryAdapter, SyncServerStatus } from '../types';
import { normalizeServerUrl } from '../lib/download';
import { Button, Card, Input, ProgressBar, StatusDot, useToast } from './ui';

export function SyncSettings({ adapter, host = false, onDownloaded }: { adapter: LibraryAdapter; host?: boolean; onDownloaded?(): void | Promise<void> }) {
  const toast = useToast();
  const [status, setStatus] = useState<SyncServerStatus>({ running: false }); const [found, setFound] = useState<DiscoveredServer[]>([]);
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('lineuplab.sync.url') ?? '');
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState(''); const [msgKind, setMsgKind] = useState<'ok' | 'warning'>('ok'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [last, setLast] = useState<DownloadReport | null>(() => { try { return JSON.parse(localStorage.getItem('lineuplab.download.last') ?? 'null'); } catch { return null; } });
  useEffect(() => { if (host) void adapter.getSyncServerStatus().then(setStatus).catch(() => {}); }, [adapter, host]);
  useEffect(() => { if (adapter.kind !== 'tauri') return; let live = true; let un: (() => void) | undefined; void listen<DownloadProgress>('lineuplab://download-progress', e => { if (live) setProgress(e.payload); }).then(f => { if (live) un = f; else f(); }); return () => { live = false; un?.(); }; }, [adapter]);
  const address = normalizeServerUrl(baseUrl);
  const discover = async () => { setBusy(true); setError(''); setFound([]); try { const servers = await adapter.discoverSync(); setFound(servers); if (!servers.length) { setMsgKind('warning'); setMsg('No desktop is sharing right now. Start sharing on the desktop and try again.'); } } catch (e) { setError(String(e)); } finally { setBusy(false); } };
  const download = async (existingToken?: string) => {
    setBusy(true); setError(''); setMsg(''); setMsgKind('ok'); setProgress(null);
    try {
      let t = existingToken ?? token;
      if (!t) { const p = await adapter.pairSync(address.url, '', 'LineupLab companion'); t = p.token; setToken(t); localStorage.setItem('lineuplab.sync.token', t); localStorage.setItem('lineuplab.sync.url', address.url); setMsg(`Connected to ${p.serverName}.`); }
      const r = await adapter.downloadLibrary(address.url, t);
      setLast(r); localStorage.setItem('lineuplab.download.last', JSON.stringify(r));
      await onDownloaded?.(); window.dispatchEvent(new Event('lineuplab:library-changed'));
      const visible = await adapter.listLineups();
      if (r.downloaded + r.existing > 0 && visible.length === 0) throw new Error('The download finished, but Browse could not read the saved library. Reopen Download and retry; the saved records were not deleted.');
      setProgress(null);
      setMsgKind(r.failed ? 'warning' : 'ok'); setMsg(`Saved ${r.downloaded} new lineups and ${r.images} new images. ${r.existing} already on this device.${r.failed ? ` ${r.failed} media items need attention.` : ''}`);
      toast.push(r.failed ? 'Download finished with media warnings.' : 'Library downloaded for offline use.', r.failed ? 'warning' : 'success');
    } catch (e) { const text = String(e); if (/Unauthorized|access code|older version/i.test(text)) { setToken(''); localStorage.removeItem('lineuplab.sync.token'); } setFound([]); setError(text); }
    finally { setBusy(false); }
  };
  return <div className="ll-settings-grid" data-testid="sync-settings">
    {host && <Card><h2 className="ll-h2 mb-2 flex items-center gap-2"><Server size={18} /> Share this library</h2>
      {status.running ? <><p className="ll-ok"><StatusDot tone="success" /> Sharing at <code data-testid="server-address">http://{status.address}</code></p>
        <p className="ll-muted mt-3">On the phone, open <strong>Download</strong>, enter this address, then tap <strong>Connect &amp; download</strong>. No pairing code is needed.</p>
        <Button variant="danger" className="mt-3" icon={<Square size={14} />} onClick={async () => { await adapter.stopSyncServer(); setStatus({ running: false }); }}>Stop sharing</Button></>
        : <><p className="ll-muted">Sharing is off. Start it to let phones on this network download your lineups and images for offline use.</p><Button variant="primary" className="mt-3" icon={<Server size={16} />} loading={busy} onClick={async () => { setBusy(true); setError(''); try { setStatus(await adapter.startSyncServer()); } catch (e) { setError(String(e)); } finally { setBusy(false); } }}>Start sharing</Button></>}
      <p className="ll-feedback ll-feedback--warning mt-3"><ShieldAlert size={16} /> While sharing is on, anyone who can reach this address can read the library. Use a trusted LAN only; never port-forward. Plain HTTP is not encrypted.</p></Card>}
    {!host && <Card><h2 className="ll-h2 mb-2 flex items-center gap-2"><Download size={18} /> Download library</h2>
      <p className="ll-muted mb-3">Save your desktop library for offline browsing.</p>
      <Input label="Desktop address" value={baseUrl} onChange={e => { setBaseUrl(e.target.value); localStorage.setItem('lineuplab.sync.url', e.target.value); setToken(''); localStorage.removeItem('lineuplab.sync.token'); }} placeholder="http://192.168.1.20:8765" disabled={busy} />
      {address.warning && baseUrl && <p className="ll-feedback ll-feedback--warning mt-2" role="status">{address.warning}</p>}
      <div className="ll-btn-row mt-3"><Button variant="primary" icon={token ? <RefreshCw size={16} /> : <Link2 size={16} />} onClick={() => void download()} loading={busy} disabled={!baseUrl.trim()}>Connect & download</Button><Button icon={<Radar size={16} />} onClick={discover} disabled={busy}>Find desktop</Button></div>
      {found.length > 0 && <ul className="ll-discovered">{found.map(s => <li key={`${s.address}:${s.port}`}><button onClick={() => { const u = `http://${s.address}:${s.port}`; setBaseUrl(u); localStorage.setItem('lineuplab.sync.url', u); setToken(''); localStorage.removeItem('lineuplab.sync.token'); }}><Server size={14} /> {s.name} — {s.address}:{s.port}</button></li>)}</ul>}
      {busy && progress && <div className="ll-import-progress mt-3" role="status" data-testid="download-progress"><div className="ll-import-progress__head"><strong>{progress.message}</strong>{progress.total > 0 && <span>{Math.min(100, Math.round(progress.current / progress.total * 100))}%</span>}</div><ProgressBar value={progress.current} max={progress.total} label={progress.message} /></div>}
      {msg && <p role="status" className={`ll-feedback ll-feedback--${msgKind} mt-3`}>{msg}</p>}
      {error && <p role="alert" className="ll-feedback ll-feedback--error mt-3">{error}</p>}
      {last && <p className="ll-muted mt-3" data-testid="download-last">Saved {new Date(last.finishedAt).toLocaleString()} · {last.totalLineups} lineups available offline.</p>}
      {last?.warnings.length ? <details className="mt-2"><summary>{last.warnings.length} media warnings — retry after fixing the desktop pack</summary><ul className="ll-issues">{last.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details> : null}
    </Card>}
  </div>;
}
