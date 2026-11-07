import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { BookOpen, Check, ChevronLeft, ChevronRight, Circle, EyeOff, Image as ImageIcon, ListChecks, Minus, MousePointer2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import type { Catalog, LibraryAdapter, Lineup, OverlaySettings, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';
import { DEFAULT_OVERLAY, draftChecklist, useOverlayViewPrefs, writeViewPrefs, readViewPrefs, type OverlayChecklistItem, type OverlayViewPrefs } from '../lib/overlay';
import { ValImage } from '../lib/images';
import { AnnotatedImage } from './AnnotatedImage';
import { Minimap } from './Minimap';
import { Button, EmptyState, IconButton, Kbd, ProgressBar, Skeleton } from './ui';

export interface OverlayViewData {
  state: { mode: 'create' | 'view'; visible?: boolean; showChecklist: boolean; flipped: boolean; checklist: OverlayChecklistItem[]; viewSlots: SlotId[]; viewIndex: number; settings: OverlaySettings };
  lineup: Lineup | null;
}
export interface OverlayDraft { editing: boolean; lineup?: Lineup; activeSlot?: SlotId; requiredSlots?: SlotId[] }
const OVERLAY_ACTIONS = new Set(['overlay_toggle', 'overlay_controls', 'overlay_mode', 'view_next', 'view_prev', 'view_flip', 'checklist_toggle']);
const DEFAULT_REQUIRED: SlotId[] = ['stand1', 'aim1', 'landing'];

/** Polls the native overlay state (events + 1.5 s fallback). Browser demo builds an equivalent preview from the local library. */
export function useOverlayData(adapter: LibraryAdapter) {
  const [data, setData] = useState<OverlayViewData | null>(null); const [error, setError] = useState(''); const seq = useRef(0);
  const load = useCallback(async () => {
    const id = ++seq.current;
    try {
      let next: OverlayViewData;
      if (adapter.kind === 'tauri') next = await invoke<OverlayViewData>('get_overlay_view');
      else {
        const lineup = (await adapter.listLineups())[0] ?? null;
        const params = new URLSearchParams(location.search);
        next = { state: { mode: params.get('overlayMode') === 'view' ? 'view' : 'create', showChecklist: true, flipped: params.has('flipped'), checklist: lineup ? draftChecklist(lineup, DEFAULT_REQUIRED) : [], viewSlots: lineup ? SLOT_ORDER.filter(s => lineup.slots[s].image) : [], viewIndex: 0, settings: DEFAULT_OVERLAY }, lineup };
      }
      if (id === seq.current) { setData(next); setError(''); }
    } catch (e) { if (id === seq.current) setError(String(e)); }
  }, [adapter]);
  useEffect(() => {
    let live = true; let un: (() => void) | undefined;
    void load();
    if (adapter.kind === 'tauri') { void listen('lineuplab://overlay-changed', () => { if (live) void load(); }).then(f => { if (live) un = f; else f(); }); }
    const t = window.setInterval(() => { if (live) void load(); }, 1500);
    return () => { live = false; seq.current++; window.clearInterval(t); un?.(); };
  }, [load, adapter]);
  return { data, error, reload: load };
}

export function OverlayView({ adapter }: { adapter: LibraryAdapter }) {
  const { data, error, reload } = useOverlayData(adapter);
  const [prefs] = useOverlayViewPrefs();
  const [catalog, setCatalog] = useState<Catalog | null>(null); const [keys, setKeys] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<OverlayDraft | null>(null); const [fading, setFading] = useState(false); const [actionError, setActionError] = useState('');
  const fadeTimer = useRef<number | undefined>(undefined);
  useEffect(() => { document.documentElement.classList.add('ll-overlay-window'); return () => document.documentElement.classList.remove('ll-overlay-window'); }, []);
  useEffect(() => { void adapter.catalog().then(setCatalog).catch(() => {}); void adapter.getHotkeys().then(bs => setKeys(Object.fromEntries(bs.map(b => [b.action, b.keys])))).catch(() => {}); }, [adapter]);
  const act = useCallback((action: string) => { if (adapter.kind !== 'tauri') return; void invoke('overlay_action', { action }).then(() => setActionError('')).catch(e => setActionError(String(e))); }, [adapter]);
  useEffect(() => {
    if (adapter.kind !== 'tauri') return;
    let live = true; const uns: (() => void)[] = [];
    const add = (p: Promise<() => void>) => { void p.then(f => { if (live) uns.push(f); else f(); }); };
    add(listen<OverlayDraft>('lineuplab://overlay-draft', e => { if (live) setDraft(e.payload?.editing && e.payload.lineup ? e.payload : null); }));
    add(listen<string>('lineuplab://hotkey', e => {
      if (!live) return;
      if (e.payload === 'overlay_minimal') { const p = readViewPrefs(); writeViewPrefs({ ...p, minimal: !p.minimal }); }
      else if (OVERLAY_ACTIONS.has(e.payload)) act(e.payload);
      if ((e.payload === 'capture' || e.payload === 'retake') && prefs.fade) { setFading(true); window.clearTimeout(fadeTimer.current); fadeTimer.current = window.setTimeout(() => setFading(false), 450); }
    }));
    void emit('lineuplab://overlay-draft-request').catch(() => {});
    return () => { live = false; uns.forEach(f => f()); window.clearTimeout(fadeTimer.current); };
  }, [adapter, act, prefs.fade]);
  const lineup = data?.state.mode === 'create' && draft?.lineup ? draft.lineup : data?.lineup ?? null;
  const checklist = data?.state.mode === 'create' && draft?.lineup ? draftChecklist(draft.lineup, draft.requiredSlots ?? DEFAULT_REQUIRED) : data?.state.checklist ?? [];
  const opacity = (data?.state.settings.opacity ?? DEFAULT_OVERLAY.opacity) * (fading ? 0.3 : 1);
  return <div className="ll-ov-root" data-testid="overlay-view" data-fading={fading || undefined} style={{ opacity }}>
    {!data && !error && <div className="ll-ov ll-ov--loading"><Skeleton className="ll-ov__skeleton" /><p className="ll-muted">Connecting to the desktop core…</p></div>}
    {error && !data && <div className="ll-ov"><EmptyState title="Overlay unavailable" description={error} action={<Button icon={<RefreshCw size={16} />} onClick={() => void reload()}>Retry</Button>} /></div>}
    {data && <OverlayContent data={data} lineup={lineup} checklist={checklist} activeSlot={draft?.activeSlot} catalog={catalog} prefs={prefs} keys={keys} onAction={act} error={error || actionError} onRetry={() => void reload()} />}
  </div>;
}

interface ContentProps { data: OverlayViewData; lineup: Lineup | null; checklist: OverlayChecklistItem[]; activeSlot?: SlotId; catalog: Catalog | null; prefs: OverlayViewPrefs; keys?: Record<string, string>; onAction?(action: string): void; error?: string; onRetry?(): void; preview?: boolean }
/** Presentational overlay used by the real window and the Settings live preview. All text is ≥13px at 100% scale. */
export function OverlayContent({ data, lineup, checklist, activeSlot, catalog, prefs, keys = {}, onAction, error, onRetry, preview }: ContentProps) {
  const s = data.state; const view = s.mode === 'view';
  const viewSlots = s.viewSlots.length ? s.viewSlots : lineup ? SLOT_ORDER.filter(k => lineup.slots[k].image) : [];
  const index = Math.min(Math.max(0, s.viewIndex), Math.max(0, viewSlots.length - 1)); const slot = viewSlots[index];
  const slotData = slot && lineup ? lineup.slots[slot] : undefined;
  const shownSlot = useMemo(() => slotData ? (prefs.hideAnnotations ? { ...slotData, circles: [], lines: [] } : slotData) : undefined, [slotData, prefs.hideAnnotations]);
  const map = catalog?.maps.find(m => m.uuid === lineup?.mapUuid); const agent = catalog?.agents.find(a => a.uuid === lineup?.agentUuid);
  const ability = agent?.abilities?.find(a => a.slot === lineup?.abilitySlot);
  const required = checklist.filter(c => c.required); const done = required.filter(c => c.done).length;
  const step = slotData?.image ? lineup?.steps.find(x => x.imageRef === slotData.image) : undefined;
  const key = (a: string, fallback: string) => keys[a] ?? fallback;
  const disabled = !onAction;
  const createSlot: SlotId = activeSlot && lineup?.slots[activeSlot]?.image ? activeSlot : [...checklist].reverse().find(c => c.done && lineup?.slots[c.slot]?.image)?.slot ?? activeSlot ?? 'stand1';
  const createImage = !view && lineup?.slots[createSlot]?.image ? lineup.slots[createSlot].image! : null;
  if (prefs.minimal) {
    const src = view ? slotData?.image : createImage;
    const minSlot = view ? slotData : lineup?.slots[createSlot];
    return <div className={clsx('ll-ov ll-ov--minimal', prefs.outline && 'has-outline', preview && 'll-ov--preview')} data-mode={s.mode} data-testid={preview ? 'overlay-content-preview' : 'overlay-content'} style={{ '--ov-scale': prefs.scale } as React.CSSProperties}>
      {src && minSlot ? <AnnotatedImage src={src} slot={prefs.hideAnnotations ? { ...minSlot, circles: [], lines: [] } : minSlot} alt={view && slot ? SLOT_LABELS[slot] : SLOT_LABELS[createSlot]} className="ll-ov__minimal-img" /> : <div className="ll-ov__minimal-empty" aria-label="No image yet" />}
    </div>;
  }
  return <div className={clsx('ll-ov', preview && 'll-ov--preview')} data-mode={s.mode} data-testid={preview ? 'overlay-content-preview' : 'overlay-content'} style={{ '--ov-scale': prefs.scale } as React.CSSProperties}>
    <header className="ll-ov__head"><span className="ll-logo__mark" aria-hidden /><strong className="ll-ov__title" title={view ? lineup?.title : 'Create checklist'}>{view ? lineup?.title || 'No lineup selected' : lineup?.title || 'Create checklist'}</strong>
      <button className="ll-ov__mode" disabled={disabled} onClick={() => onAction?.('overlay_mode')} title={`Switch mode (${key('overlay_mode', 'Alt+M')})`} aria-label={`Switch to ${view ? 'create' : 'learn'} mode`}>{view ? 'Learn' : 'Create'}</button>
      <IconButton label="Toggle overlay controls" tooltip={`Controls (${key('overlay_controls', 'Alt+O')})`} disabled={disabled} onClick={() => onAction?.('overlay_controls')} className={s.settings.clickThrough ? '' : 'is-active'}><MousePointer2 size={16} /></IconButton>
      <IconButton label="Hide overlay" tooltip={`Hide (${key('overlay_toggle', 'Alt+V')})`} disabled={disabled} onClick={() => onAction?.('overlay_toggle')}><EyeOff size={16} /></IconButton>
    </header>
    {error && <div className="ll-ov__error" role="alert"><span>{error}</span>{onRetry && <button onClick={onRetry}>Retry</button>}</div>}
    {!view && <>
      <div className="ll-ov__summary"><span>{done}/{required.length} required captured</span><ProgressBar value={done} max={required.length || 1} label="Required captures" /><span className="ll-ov__current-slot">{SLOT_LABELS[createSlot]}</span></div>
      <div className={clsx('ll-ov__body', createImage && 'll-ov__body--create')}>
        {createImage && <AnnotatedImage src={createImage} slot={prefs.hideAnnotations ? { ...lineup!.slots[createSlot], circles: [], lines: [] } : lineup!.slots[createSlot]} alt={SLOT_LABELS[createSlot]} className="ll-ov__image ll-ov__image--create" />}
        {!s.showChecklist ? (createImage ? null : <EmptyState title="Checklist hidden" description={`Press ${key('checklist_toggle', 'Alt+H')} to show it again.`} />) : checklist.length === 0 && !createImage ? <EmptyState title="No draft yet" description="Open Create in the main window; captures appear here as you take them." /> : <ul className={clsx('ll-ov__checklist', createImage && 'll-ov__checklist--compact')} aria-label="Capture checklist">{checklist.map(c => { const image = lineup?.slots[c.slot]?.image; const active = activeSlot === c.slot; return <li key={c.slot} className={clsx('ll-ov__item', c.done && 'is-done', c.skipped && 'is-skipped', active && 'is-active')} data-testid={`overlay-checklist-${c.slot}`} aria-current={active ? 'step' : undefined}><span className="ll-ov__status" aria-hidden>{c.done ? <Check size={16} /> : c.skipped ? <Minus size={16} /> : <Circle size={16} />}</span><span className="ll-ov__thumb">{image ? <ValImage src={image} alt={`${c.label} capture`} kind="media" loading="eager" /> : <ImageIcon size={16} aria-hidden />}</span><span className="ll-ov__item-text"><span className="ll-ov__item-label">{c.label}{c.required && <span className="ll-ov__req" title="Required">*</span>}</span><small>{c.done ? 'Captured' : c.skipped ? 'Skipped' : active ? 'Current slot' : c.required ? 'Required' : 'Optional'}</small></span>{active && <span className="ll-ov__active-dot" aria-hidden />}</li>; })}</ul>}
      </div>
      <footer className="ll-ov__foot"><span><Kbd>{key('capture', 'Alt+C')}</Kbd> capture</span><span><Kbd>{key('next_slot', 'Alt+N')}</Kbd>/<Kbd>{key('prev_slot', 'Alt+P')}</Kbd> slot</span><span><Kbd>{key('save', 'Alt+S')}</Kbd> save</span><IconButton label={s.showChecklist ? 'Hide checklist' : 'Show checklist'} tooltip={`Checklist (${key('checklist_toggle', 'Alt+H')})`} disabled={disabled} onClick={() => onAction?.('checklist_toggle')} className={s.showChecklist ? 'is-active' : ''}><ListChecks size={16} /></IconButton></footer>
    </>}
    {view && (!lineup || !slot || !slotData?.image ? <div className="ll-ov__body"><EmptyState title="No lineup to show" description="Pick a lineup in Browse and send it to the overlay, or switch to Create." /></div> : <>
      <div className="ll-ov__meta"><span>{map?.displayName ?? 'Unknown map'}</span><span>{agent?.displayName ?? '—'} · {ability?.displayName ?? lineup.abilitySlot}</span><span className={clsx('ll-ov__side', `ll-ov__side--${lineup.side}`)}>{lineup.side}{lineup.site ? ` · ${lineup.site}` : ''}</span></div>
      {!s.flipped ? <div className="ll-ov__body ll-ov__body--image"><AnnotatedImage src={slotData.image} slot={shownSlot} alt={SLOT_LABELS[slot]} className="ll-ov__image" />{step && <p className="ll-ov__step">{step.order}. {step.text}</p>}</div>
        : <div className="ll-ov__body ll-ov__body--notes"><Minimap src={map?.displayIcon} lineups={[lineup]} selectedId={lineup.id} showToolbar={false} className="ll-ov__map" emptyMessage={null} /><div className="ll-ov__notes">{lineup.steps.length > 0 && <ol>{lineup.steps.map(x => <li key={x.order}><span>{x.order}.</span> {x.text}</li>)}</ol>}{lineup.notes && <p>{lineup.notes}</p>}{lineup.steps.length === 0 && !lineup.notes && <p className="ll-muted">No steps or notes for this lineup.</p>}</div></div>}
      <footer className="ll-ov__nav"><IconButton label="Previous image" tooltip={`Previous (${key('view_prev', 'Alt+Left')})`} disabled={disabled || viewSlots.length < 2} onClick={() => onAction?.('view_prev')}><ChevronLeft size={18} /></IconButton><span className="ll-ov__nav-label">{SLOT_LABELS[slot]} · {index + 1}/{viewSlots.length}</span><IconButton label={s.flipped ? 'Show image' : 'Show steps and map'} tooltip={`Flip (${key('view_flip', 'Alt+F')})`} disabled={disabled} onClick={() => onAction?.('view_flip')} className={s.flipped ? 'is-active' : ''}>{s.flipped ? <ImageIcon size={16} /> : <BookOpen size={16} />}</IconButton><IconButton label="Next image" tooltip={`Next (${key('view_next', 'Alt+Right')})`} disabled={disabled || viewSlots.length < 2} onClick={() => onAction?.('view_next')}><ChevronRight size={18} /></IconButton></footer>
    </>)}
  </div>;
}

/** Settings → Overlay: monitor placement preview plus the real overlay content at its configured size. */
export function OverlaySettingsPreview({ adapter, overlay, prefs, pos, screen }: { adapter: LibraryAdapter; overlay: OverlaySettings; prefs: OverlayViewPrefs; pos: { x: number; y: number }; screen: { width: number; height: number } }) {
  const { data, error, reload } = useOverlayData(adapter); const [catalog, setCatalog] = useState<Catalog | null>(null);
  const ref = useRef<HTMLDivElement>(null); const [factor, setFactor] = useState(0.3);
  useEffect(() => { void adapter.catalog().then(setCatalog).catch(() => {}); }, [adapter]);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(entries => { const w = entries[0]?.contentRect.width ?? 0; if (w) setFactor(w / screen.width); }); ro.observe(el); return () => ro.disconnect(); }, [screen.width]);
  const lineup = data?.lineup ?? null; const checklist = data?.state.checklist.length ? data.state.checklist : lineup ? draftChecklist(lineup, DEFAULT_REQUIRED) : [];
  const content = data ? <OverlayContent data={data} lineup={lineup} checklist={checklist} catalog={catalog} prefs={prefs} preview /> : <div className="ll-ov ll-ov--loading"><Skeleton className="ll-ov__skeleton" />{error ? <button className="ll-btn ll-btn--md" onClick={() => void reload()}>Retry preview</button> : <p className="ll-muted">Loading preview…</p>}</div>;
  return <>
    <div ref={ref} className="ll-overlay-preview" data-testid="overlay-preview" style={{ aspectRatio: `${screen.width} / ${screen.height}` }}><div className="ll-overlay-preview__game" /><div className="ll-overlay-preview__win" style={{ left: `${pos.x / screen.width * 100}%`, top: `${pos.y / screen.height * 100}%`, width: `${overlay.width / screen.width * 100}%`, height: `${overlay.height / screen.height * 100}%`, opacity: overlay.opacity }}><div style={{ width: overlay.width, height: overlay.height, transform: `scale(${factor})`, transformOrigin: 'top left' }}>{content}</div></div></div>
    <div className="ll-overlay-actual"><div className="ll-overlay-actual__label">Content preview · {overlay.width}×{overlay.height} · {Math.round(prefs.scale * 100)}%</div><div className="ll-overlay-actual__frame" style={{ width: overlay.width, height: overlay.height, maxWidth: '100%' }}>{content}</div></div>
  </>;
}
