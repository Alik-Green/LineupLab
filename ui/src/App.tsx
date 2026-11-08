import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AbilityMode, AssetProgress, Catalog, ImportPreview, ImportReport, LibraryAdapter, Lineup } from './types';
import { listen } from '@tauri-apps/api/event';
import { createAdapter } from './lib/adapter';
import { ImageProvider } from './lib/images';
import { Browse } from './components/Browse';
import { Editor } from './components/Editor';
import { OverlayView } from './components/OverlayView';
import { SyncSettings } from './components/SyncSettings';
import { Settings } from './components/Settings';
import { ImportExport } from './components/ImportExport';
import { AppShell, type Page } from './components/AppShell';
import { Button, Card, ProgressBar, ToastProvider } from './components/ui';
import { applyMotionPref } from './components/Settings';

class RenderBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { error: String(e) }; }
  componentDidCatch(e: unknown) { console.error('[LineupLab render]', e); }
  render() {
    if (this.state.error) return <div className="ll-render-error" role="alert" data-testid="render-error"><h1 className="ll-h1">Something went wrong</h1><p className="ll-muted">The screen could not be drawn. Your library is still on disk.</p><pre>{this.state.error}</pre><Button variant="primary" onClick={() => this.setState({ error: null })}>Try again</Button><Button onClick={() => location.reload()}>Reload</Button></div>;
    return this.props.children;
  }
}
export function App({ platform }: { platform: 'desktop' | 'mobile' }) {
  const adapter = useMemo<LibraryAdapter>(() => createAdapter(), []);
  return <ToastProvider><ImageProvider adapter={adapter}><RenderBoundary><AppInner adapter={adapter} platform={platform} /></RenderBoundary></ImageProvider></ToastProvider>;
}
function AppInner({ adapter, platform }: { adapter: LibraryAdapter; platform: 'desktop' | 'mobile' }) {
  const [page, setPage] = useState<Page>('browse'); const [editId, setEditId] = useState<string | null>(null);
  const [lineups, setLineups] = useState<Lineup[]>([]); const [catalog, setCatalog] = useState<Catalog | null>(null); const [modes, setModes] = useState<AbilityMode[]>([]); const [error, setError] = useState('');
  const [assetProgress, setAssetProgress] = useState<AssetProgress | null>(null);
  const native = adapter.kind === 'tauri' && typeof window !== 'undefined' && !('__LL_MOCK_STATE__' in window);
  const refresh = useCallback(async () => { try { const [ls, cat, ms] = await Promise.all([adapter.listLineups(), adapter.catalog(), adapter.modes()]); setLineups(ls); setCatalog(cat); setModes(ms); setError(''); } catch (e) { setError(String(e)); } }, [adapter]);
  useEffect(() => { document.documentElement.dataset.platform = platform; return () => { delete document.documentElement.dataset.platform; }; }, [platform]);
  useEffect(() => { void refresh(); try { applyMotionPref({ reduceMotion: false, ...JSON.parse(localStorage.getItem('lineuplab.prefs') ?? '{}') }); } catch { /* defaults */ } }, [refresh]);
  useEffect(() => {
    let live = true; let un: (() => void) | undefined;
    if (adapter.kind === 'tauri') void listen<AssetProgress>('lineuplab://assets', e => { if (live) setAssetProgress(e.payload); }).then(f => { un = f; });
    void adapter.prepareAssets(false).then(cat => { if (live) { setCatalog(cat); setAssetProgress(null); } }).catch(e => { if (live) setError(String(e)); });
    return () => { live = false; un?.(); };
  }, [adapter]);
  useEffect(() => { const changed = () => { void refresh(); }; window.addEventListener('lineuplab:library-changed', changed); let un: (() => void) | undefined; let live = true; if (adapter.kind === 'tauri') void listen('lineuplab://library-changed', changed).then(f => { if (live) un = f; else f(); }); return () => { live = false; un?.(); window.removeEventListener('lineuplab:library-changed', changed); }; }, [adapter, refresh]);
  const browseOnly = platform === 'mobile';
  if (typeof window !== 'undefined' && (window.location.hash === '#overlay' || new URLSearchParams(window.location.search).has('overlay'))) return <OverlayView adapter={adapter} />;
  const openEditor = (id?: string | null) => { setEditId(id ?? null); setPage('editor'); };
  const navigate = (p: Page) => { if (p === 'editor') openEditor(null); else setPage(p); };
  return <AppShell platform={platform} page={page} onNavigate={navigate} catalog={catalog} assetProgress={assetProgress} native={native}>
    {error && <Card className="mb-4 border-ll-accent" role="alert"><p className="text-ll-accent">{error}</p><Button className="mt-2" onClick={refresh}>Retry</Button></Card>}
    {page === 'browse' && <Browse adapter={adapter} lineups={lineups} catalog={catalog} readOnly={browseOnly} onEdit={id => browseOnly ? undefined : openEditor(id)} onRefresh={refresh} mobile={browseOnly} />}
    {page === 'editor' && !browseOnly && <Editor adapter={adapter} lineupId={editId} catalog={catalog} modes={modes} lineups={lineups} onSaved={() => { void refresh(); setPage('browse'); }} onCancel={() => setPage('browse')} />}
    {page === 'import' && !browseOnly && <ImportExport adapter={adapter} lineups={lineups} onRefresh={refresh} />}
    {page === 'sync' && <SyncSettings adapter={adapter} host={false} onDownloaded={refresh} />}
    {page === 'settings' && <Settings adapter={adapter} catalog={catalog} onRefresh={refresh} browseOnly={browseOnly} />}
    {assetProgress && assetProgress.phase === 'downloading' && assetProgress.done < assetProgress.total && <FirstRunProgress progress={assetProgress} />}
  </AppShell>;
}
function FirstRunProgress({ progress }: { progress: AssetProgress }) {
  return <div className="ll-overlay" role="status" data-testid="first-run-progress"><div className="ll-modal" style={{ width: 460 }}><div className="ll-modal__body" style={{ textAlign: 'center', padding: 32 }}><div className="ll-logo" style={{ justifyContent: 'center', marginBottom: 12 }}><span className="ll-logo__mark" /><span>Lineup<span>Lab</span></span></div><h2 className="ll-h2">Downloading game data {progress.done}/{progress.total}</h2><p className="ll-muted">Agent, ability and map art for offline use. No Riot assets are bundled.</p><div style={{ marginTop: 20 }}><ProgressBar value={progress.done} max={progress.total} label="Downloading game data" /></div><p className="ll-muted" style={{ fontSize: 12, marginTop: 8 }}>{progress.current || 'Preparing catalog…'}</p>{progress.failed > 0 && <p style={{ color: 'var(--ll-warning)', fontSize: 13, marginTop: 8 }}>{progress.failed} downloads failed; cached art remains usable. Retry in Settings → Data.</p>}</div></div></div>;
}
