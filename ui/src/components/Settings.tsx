import { useState } from 'react';
import { Activity, Camera, Cloud, Database, Info, Keyboard, MonitorPlay, Settings2, ShieldCheck } from 'lucide-react';
import type { Catalog, LibraryAdapter } from '../types';
import { usePersistentState } from '../lib/hooks';
import { APP_RELEASE_VERSION } from '../lib/version';
import { Button, Card, PageHeader, Segmented, Tabs, Toggle, useToast } from './ui';
import { HotkeysPanel, OverlayPanel, CapturePanel } from './DesktopSettings';
import { DataPanel, DiagnosticsPanel } from './DataSettings';
import { SyncSettings } from './SyncSettings';

export type SettingsTab = 'general' | 'hotkeys' | 'overlay' | 'capture' | 'sync' | 'data' | 'diagnostics' | 'about';
export interface UiPrefs { reduceMotion: boolean }
export function applyMotionPref(p: UiPrefs) { document.documentElement.dataset.motion = p.reduceMotion ? 'reduce' : 'auto'; }
export function Settings({ adapter, catalog, onRefresh, browseOnly = false }: { adapter: LibraryAdapter; catalog: Catalog | null; onRefresh(): void; browseOnly?: boolean }) {
  const [tab, setTab] = useState<SettingsTab>('general');
  const tabs: { value: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { value: 'general', label: 'General', icon: <Settings2 size={15} /> },
    ...(!browseOnly ? [{ value: 'hotkeys' as const, label: 'Hotkeys', icon: <Keyboard size={15} /> }, { value: 'overlay' as const, label: 'Overlay', icon: <MonitorPlay size={15} /> }, { value: 'capture' as const, label: 'Capture', icon: <Camera size={15} /> }] : []),
    { value: 'sync', label: 'Sharing', icon: <Cloud size={15} /> }, { value: 'data', label: 'Data', icon: <Database size={15} /> }, { value: 'diagnostics', label: 'Diagnostics', icon: <Activity size={15} /> }, { value: 'about', label: 'About', icon: <Info size={15} /> },
  ];
  return <div data-testid="settings"><PageHeader title="Settings" subtitle={browseOnly ? 'Companion preferences, downloads and cached game data.' : 'Preferences, hotkeys, overlay, capture, sharing and game data.'} /><Tabs<SettingsTab> ariaLabel="Settings sections" tabs={tabs} value={tab} onChange={setTab} /><div className="ll-settings-body">
    {tab === 'general' && <General catalog={catalog} onRefresh={onRefresh} browseOnly={browseOnly} />}
    {tab === 'hotkeys' && !browseOnly && <HotkeysPanel adapter={adapter} />}
    {tab === 'overlay' && !browseOnly && <OverlayPanel adapter={adapter} />}
    {tab === 'capture' && !browseOnly && <CapturePanel adapter={adapter} />}
    {tab === 'sync' && <SyncSettings adapter={adapter} host={!browseOnly} onDownloaded={onRefresh} />}
    {tab === 'data' && <DataPanel adapter={adapter} onRefresh={onRefresh} />}
    {tab === 'diagnostics' && <DiagnosticsPanel adapter={adapter} />}
    {tab === 'about' && <About adapter={adapter} browseOnly={browseOnly} />}
  </div></div>;
}
function General({ catalog, onRefresh, browseOnly }: { catalog: Catalog | null; onRefresh(): void; browseOnly: boolean }) {
  const toast = useToast(); const [prefs, setPrefs] = usePersistentState<UiPrefs>('lineuplab.prefs', { reduceMotion: false });
  const [view, setView] = usePersistentState<{ value: string }>('lineuplab.cardView', { value: 'comfortable' });
  const [sort, setSort] = usePersistentState<{ value: string }>('lineuplab.sort', { value: 'newest' });
  const reset = () => { for (const k of ['lineuplab.filters', 'lineuplab.browseSplit', 'lineuplab.favoriteAgents', 'lineuplab.prefs', 'lineuplab.overlayView']) localStorage.removeItem(k); setPrefs({ reduceMotion: false }); applyMotionPref({ reduceMotion: false }); setView({ value: 'comfortable' }); setSort({ value: 'newest' }); toast.push('UI preferences reset. Drafts and download connections were kept.', 'success'); };
  return <div className="ll-settings-grid">
    <Card><h2 className="ll-h2 mb-2">Appearance & motion</h2><Toggle label="Reduce motion" checked={prefs.reduceMotion} onChange={v => { setPrefs({ reduceMotion: v }); applyMotionPref({ reduceMotion: v }); }} description="Disable transitions and shimmer effects. System reduced-motion is always respected." /><div className="ll-form-grid mt-3"><div className="ll-field"><span className="ll-label">Default card density</span><Segmented ariaLabel="Default card density" value={view.value} onChange={v => setView({ value: v })} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} /></div><div className="ll-field"><span className="ll-label">Default sort</span><Segmented ariaLabel="Default sort" value={sort.value} onChange={v => setSort({ value: v })} options={[{ value: 'newest', label: 'Newest' }, { value: 'favorites', label: 'Favorites' }, { value: 'title', label: 'Title' }]} /></div></div><div className="mt-4"><Button onClick={reset}>Reset UI preferences</Button></div></Card>
    <Card><h2 className="ll-h2 mb-2">Catalog</h2><dl className="ll-meta-grid"><dt>Version</dt><dd>{catalog?.version ?? '—'}</dd><dt>Last updated</dt><dd>{catalog ? new Date(catalog.updatedAt).toLocaleString() : '—'}</dd><dt>Status</dt><dd>{catalog?.stale ? 'Offline cache' : 'Up to date'}</dd></dl>{catalog?.warning && <p className="ll-feedback ll-feedback--conflict">{catalog.warning}</p>}<Button className="mt-3" onClick={onRefresh}>Refresh catalog</Button><p className="ll-muted mt-3" style={{ fontSize: 12 }}>Agent/map art is fetched at runtime and cached; no Riot assets are bundled. Archived references are kept so lineups never disappear.</p>{browseOnly && <p className="ll-muted mt-2" style={{ fontSize: 12 }}>Browse-only companion: creation, overlay and hotkeys are desktop-only.</p>}</Card>
  </div>;
}
function About({ adapter, browseOnly }: { adapter: LibraryAdapter; browseOnly: boolean }) {
  return <div className="ll-settings-grid"><Card><h2 className="ll-h2 mb-2 flex items-center gap-2"><Info size={18} /> LineupLab</h2><dl className="ll-meta-grid"><dt>Version</dt><dd>{APP_RELEASE_VERSION}</dd><dt>Runtime</dt><dd>{adapter.kind === 'tauri' ? (browseOnly ? 'Tauri Android companion' : 'Tauri desktop core') : 'Browser demo'}</dd><dt>License</dt><dd>MIT (application code)</dd><dt>Game art</dt><dd>Fetched at runtime from valorant-api.com; not bundled. Riot Games does not endorse LineupLab.</dd></dl><div className="ll-btn-row mt-3"><Button onClick={() => window.open('https://github.com/Alik-Green/LineupLab', '_blank', 'noopener')}>GitHub repository</Button><Button onClick={() => window.open('https://github.com/Alik-Green/LineupLab/releases', '_blank', 'noopener')}>Releases</Button></div></Card>
    <Card><h2 className="ll-h2 mb-2 flex items-center gap-2"><ShieldCheck size={18} /> Safety model</h2><ul className="ll-about-list"><li>Never reads, hooks or attaches to Valorant or Vanguard memory.</li><li>Separate transparent overlay window, global Alt hotkeys and normal screen capture only.</li><li>Overlay works with Borderless/Windowed Valorant; exclusive fullscreen is not supported.</li><li>Original screenshots are never modified; annotations are stored alongside.</li><li>Legacy ZIP remains the sole import/export format; unknown fields are preserved.</li></ul></Card></div>;
}
