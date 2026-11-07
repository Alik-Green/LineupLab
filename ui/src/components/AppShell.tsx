import type { ReactNode } from 'react';
import { Cloud, FolderOpen, Import, LibraryBig, Minus, PlusSquare, Settings, Square, X } from 'lucide-react';
import clsx from 'clsx';
import type { AssetProgress, Catalog } from '../types';
import { StatusDot } from './ui';

export type Page = 'browse' | 'editor' | 'import' | 'settings' | 'sync';
export function AppShell({ platform, page, onNavigate, catalog, assetProgress, native, children }: { platform: 'desktop' | 'mobile'; page: Page; onNavigate(p: Page): void; catalog: Catalog | null; assetProgress: AssetProgress | null; native: boolean; children: ReactNode }) {
  const updating = assetProgress?.phase === 'downloading';
  const dataLabel = updating ? `Updating ${assetProgress.done}/${assetProgress.total}` : catalog?.stale ? 'Offline cache' : 'Up to date';
  const desktopNav = [{ id: 'browse', label: 'Browse', icon: <LibraryBig size={16} /> }, { id: 'editor', label: 'Create', icon: <PlusSquare size={16} /> }, { id: 'import', label: 'Import / Export', icon: <Import size={16} /> }, { id: 'settings', label: 'Settings', icon: <Settings size={16} /> }] as const;
  const mobileNav = [{ id: 'browse', label: 'Browse', icon: <LibraryBig size={20} /> }, { id: 'sync', label: 'Sync', icon: <Cloud size={20} /> }, { id: 'settings', label: 'Settings', icon: <Settings size={20} /> }] as const;
  const win = async (action: 'minimize' | 'toggleMaximize' | 'close') => { try { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow()[action](); } catch (e) { console.warn('Window control failed', e); } };
  return <div className="ll-app" data-platform={platform}>
    <header className="ll-topbar" data-tauri-drag-region>
      <button className="ll-logo" onClick={() => onNavigate('browse')} aria-label="LineupLab home"><span className="ll-logo__mark" aria-hidden /><span>Lineup<span>Lab</span></span></button>
      {platform === 'desktop' && <nav className="ll-nav" aria-label="Main">{desktopNav.map(n => <button key={n.id} className={clsx('ll-nav__item', page === n.id && 'is-active')} aria-current={page === n.id ? 'page' : undefined} onClick={() => onNavigate(n.id)}>{n.icon}{n.label}</button>)}</nav>}
      <div className="ll-topbar__right">
        <span className="ll-status-chip" title={catalog?.warning ?? undefined}><StatusDot tone={updating ? 'warning' : catalog?.stale ? 'warning' : 'success'} /><strong>{catalog?.version ?? '—'}</strong><span className="ll-hide-narrow">{dataLabel}</span></span>
        <span className="ll-status-chip"><FolderOpen size={14} /><span className="ll-hide-narrow">{platform === 'mobile' ? 'Companion' : 'Local library'}</span></span>
        {native && platform === 'desktop' && <div className="ll-window-controls"><button aria-label="Minimize" onClick={() => win('minimize')}><Minus size={14} /></button><button aria-label="Maximize" onClick={() => win('toggleMaximize')}><Square size={12} /></button><button aria-label="Close" className="ll-close" onClick={() => win('close')}><X size={14} /></button></div>}
      </div>
    </header>
    <main className="ll-page">{children}</main>
    {platform === 'mobile' && <nav className="ll-bottom-nav" aria-label="Main">{mobileNav.map(n => <button key={n.id} className={clsx(page === n.id && 'is-active')} aria-current={page === n.id ? 'page' : undefined} onClick={() => onNavigate(n.id)}>{n.icon}{n.label}</button>)}</nav>}
  </div>;
}
