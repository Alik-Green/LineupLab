import { useEffect, useState } from 'react';
import { Cloud, Link2, Radar, RefreshCw, Server, Square } from 'lucide-react';
import type { DiscoveredServer, LibraryAdapter, SyncServerStatus } from '../types';
import { Button, Card, Input, StatusDot, useToast } from './ui';

export function SyncSettings({ adapter, host = false }: { adapter: LibraryAdapter; host?: boolean }) {
  const toast = useToast();
  const [status, setStatus] = useState<SyncServerStatus>({ running: false }); const [found, setFound] = useState<DiscoveredServer[]>([]);
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('lineuplab.sync.url') ?? ''); const [code, setCode] = useState(''); const [token, setToken] = useState(() => localStorage.getItem('lineuplab.sync.token') ?? '');
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (host) void adapter.getSyncServerStatus().then(setStatus).catch(() => {}); }, [adapter, host]);
  const discover = async () => { setBusy(true); try { setFound(await adapter.discoverSync()); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };
  const pair = async () => { setBusy(true); setMsg(''); try { const url = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`; const p = await adapter.pairSync(url, code, 'LineupLab companion'); setToken(p.token); localStorage.setItem('lineuplab.sync.token', p.token); localStorage.setItem('lineuplab.sync.url', url); setMsg(`Paired with ${p.serverName}.`); toast.push(`Paired with ${p.serverName}.`, 'success'); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };
  const sync = async () => { setBusy(true); setMsg(''); try { const r = await adapter.syncNow(baseUrl, token); setMsg(`Synced: ${r.pushed} pushed, ${r.pulled} pulled, ${r.images} images, ${r.conflicts} conflicts.`); toast.push('Sync complete.', 'success'); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };
  return <div className="ll-settings-grid" data-testid="sync-settings">
    {host && <Card><h2 className="ll-h2 mb-2 flex items-center gap-2"><Server size={18} /> Host this library</h2>
      {status.running ? <><p className="ll-ok"><StatusDot tone="success" /> Server running at <code>http://{status.address}</code></p><div className="ll-pairing" aria-label="Pairing code"><span className="ll-label">Pairing code</span><strong data-testid="pairing-code">{status.pairingCode}</strong><small className="ll-muted">Enter this on the companion device within the LAN.</small></div><Button variant="danger" icon={<Square size={14} />} onClick={async () => { await adapter.stopSyncServer(); setStatus({ running: false }); }}>Stop server</Button></>
        : <><p className="ll-muted">Hosting is opt-in and off by default. Start the server to let a companion device pair and pull this library.</p><Button variant="primary" className="mt-3" icon={<Server size={16} />} loading={busy} onClick={async () => { setBusy(true); try { setStatus(await adapter.startSyncServer()); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } }}>Start sync server</Button></>}
      <p className="ll-muted mt-3" style={{ fontSize: 12 }}>Trusted LAN only: plain HTTP + six-digit pairing + bearer token (documented alternative to pinned HTTPS). Never port-forward this server.</p></Card>}
    <Card><h2 className="ll-h2 mb-2 flex items-center gap-2"><Cloud size={18} /> {host ? 'Pair another server' : 'Connect to a desktop library'}</h2>
      <div className="ll-form-grid"><Input label="Server address" value={baseUrl} onChange={e => { setBaseUrl(e.target.value); localStorage.setItem('lineuplab.sync.url', e.target.value); }} placeholder="http://192.168.1.20:8765" /><Input label="Pairing code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" className="ll-mono" /></div>
      <div className="ll-btn-row mt-3"><Button variant="primary" icon={<Link2 size={16} />} onClick={pair} loading={busy} disabled={code.length !== 6 || !baseUrl}>Pair</Button><Button icon={<Radar size={16} />} onClick={discover} disabled={busy}>Discover (mDNS)</Button><Button icon={<RefreshCw size={16} />} onClick={sync} disabled={busy || !token || !baseUrl}>Sync now</Button>{token && <span className="ll-ok"><StatusDot tone="success" /> paired</span>}</div>
      {found.length > 0 && <ul className="ll-discovered">{found.map(s => <li key={`${s.address}:${s.port}`}><button onClick={() => { const u = `http://${s.address}:${s.port}`; setBaseUrl(u); localStorage.setItem('lineuplab.sync.url', u); }}><Server size={14} /> {s.name} — {s.address}:{s.port}</button></li>)}</ul>}
      {msg && <p role="status" className="ll-feedback ll-feedback--ok">{msg}</p>}
      <p className="ll-muted mt-3" style={{ fontSize: 12 }}>Sync copies lineups and images both ways using the same revision/conflict rules as the legacy pack. The companion stays browse-only.</p></Card>
  </div>;
}
