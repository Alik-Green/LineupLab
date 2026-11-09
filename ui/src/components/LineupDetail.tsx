import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, GraduationCap, Maximize, Pencil, Star, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import type { Catalog, LibraryAdapter, Lineup, SlotId } from '../types';
import { SLOT_LABELS } from '../types';
import { learnSlots } from '../lib/overlay';
import { AnnotatedImage } from './AnnotatedImage';
import { Minimap } from './Minimap';
import { Button, Chip, IconButton, Popup, Tooltip, useToast } from './ui';
import { ValImage } from '../lib/images';
import { useMediaUrl } from '../lib/hooks';
import { abilityIcon, abilityKey, abilityName } from '../lib/game';
import { clampImagePan, zoomImageAt, type MapView } from '../lib/geometry';

/** Full-screen, image-first viewer. Zoom/pan transforms the annotated image as
 * one layer so circles/lenses/lines never drift away from the capture. */
export function LineupDetail({ adapter, lineup, catalog, onClose, onEdit, onRefresh, readOnly = false }: { adapter: LibraryAdapter; lineup: Lineup; catalog: Catalog | null; onClose(): void; onEdit(id: string): void; onRefresh(): void; readOnly?: boolean }) {
  const toast = useToast();
  const slots = useMemo(() => learnSlots(lineup), [lineup]);
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<MapView>({ scale: 1, tx: 0, ty: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; cx: number; cy: number } | null>(null);
  const slot: SlotId = slots[Math.min(index, Math.max(0, slots.length - 1))] ?? 'aim1';
  const map = catalog?.maps.find(m => m.uuid === lineup.mapUuid);
  const agent = catalog?.agents.find(a => a.uuid === lineup.agentUuid);
  const video = useMediaUrl(adapter, lineup.videoClip);
  const resetView = useCallback(() => setView({ scale: 1, tx: 0, ty: 0 }), []);
  useEffect(() => { resetView(); }, [slot, resetView]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') setIndex(i => Math.min(slots.length - 1, i + 1)); if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1)); if (e.key === '0') resetView(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [slots.length, resetView]);
  const stageSize = () => { const r = stageRef.current?.getBoundingClientRect(); return { w: r?.width ?? 1, h: r?.height ?? 1, left: r?.left ?? 0, top: r?.top ?? 0 }; };
  const zoomBy = useCallback((factor: number, px?: number, py?: number) => { const { w, h } = stageSize(); setView(v => zoomImageAt(v, factor, px ?? w / 2, py ?? h / 2, w, h)); }, []);
  useEffect(() => { const el = stageRef.current; if (!el) return; const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }; el.addEventListener('wheel', onWheel, { passive: false }); return () => el.removeEventListener('wheel', onWheel); }, [zoomBy]);
  const onPointerDown = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; const { left, top } = stageSize(); gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale, cx: (a.x + b.x) / 2 - left, cy: (a.y + b.y) / 2 - top }; } };
  const onPointerMove = (e: React.PointerEvent) => { const prev = pointers.current.get(e.pointerId); if (!prev) return; const next = { x: e.clientX, y: e.clientY }; pointers.current.set(e.pointerId, next); const { w, h } = stageSize(); if (pointers.current.size === 2 && gesture.current) { const [a, b] = [...pointers.current.values()]; const dist = Math.hypot(a.x - b.x, a.y - b.y); const g = gesture.current; setView(v => zoomImageAt({ ...v, scale: g.scale }, dist / Math.max(1, g.dist), g.cx, g.cy, w, h)); } else if (pointers.current.size === 1) { const dx = next.x - prev.x, dy = next.y - prev.y; setView(v => clampImagePan({ ...v, tx: v.tx + dx, ty: v.ty + dy }, w, h)); } };
  const onPointerUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) gesture.current = null; };
  const share = async () => { const url = await adapter.mediaUrl(lineup.slots[slot]?.image ?? ''); const a = document.createElement('a'); a.href = url; a.download = `${lineup.title || 'lineup'}-${slot}.png`; a.click(); toast.push('Image download started.', 'success'); };
  const favorite = async () => { await adapter.setFavorite(lineup.id, !lineup.isFavorite); onRefresh(); toast.push(lineup.isFavorite ? 'Removed from favorites.' : 'Added to favorites.', 'success'); };
  const duplicate = async () => { await adapter.duplicateLineup(lineup.id); onRefresh(); toast.push('Lineup duplicated.', 'success'); };
  const remove = async () => { await adapter.deleteLineup(lineup.id); onRefresh(); onClose(); toast.push('Lineup deleted.', 'warning'); };
  const steps = Array.isArray(lineup.steps) ? lineup.steps : [];
  const tags = Array.isArray(lineup.tags) ? lineup.tags : [];
  return <Popup open onClose={onClose} title={lineup.title || 'Untitled lineup'} footer={<>
    <Button onClick={favorite} icon={<Star size={16} fill={lineup.isFavorite ? 'currentColor' : 'none'} />}>{lineup.isFavorite ? 'Favorited' : 'Favorite'}</Button>
    {!readOnly && <Button onClick={duplicate} icon={<Copy size={16} />}>Duplicate</Button>}
    {!readOnly && <Button variant="danger" onClick={remove} icon={<Trash2 size={16} />}>Delete</Button>}
    {!readOnly && <Button variant="primary" onClick={() => onEdit(lineup.id)} icon={<Pencil size={16} />}>Edit</Button>}
    {adapter.kind === 'tauri' && document.documentElement.dataset.platform !== 'mobile' && <Button icon={<GraduationCap size={16} />} onClick={async () => { try { await adapter.learnLineup(lineup.id); toast.push('Sent to overlay in Learn mode.', 'success'); } catch (e) { toast.push(String(e), 'error'); } }}>Learn in overlay</Button>}
  </>}>
    <div className="ll-detail ll-detail--popup" data-testid="lineup-detail">
      <div className="ll-detail__viewer">
        <div ref={stageRef} className="ll-detail__stage" data-testid="lineup-stage" style={{ touchAction: 'none', cursor: view.scale > 1 ? 'grab' : 'zoom-in' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={e => { const r = stageSize(); zoomBy(view.scale > 1 ? 1 / view.scale : 2, e.clientX - r.left, e.clientY - r.top); }}>
          {lineup.slots?.[slot]?.image ? <div className="ll-detail__transform" data-testid="lineup-transform" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}><AnnotatedImage src={lineup.slots[slot].image!} slot={lineup.slots[slot]} alt={SLOT_LABELS[slot]} /></div> : <div className="ll-empty">No image</div>}
          <div className="ll-detail__zoom" onPointerDown={e => e.stopPropagation()}>
            <IconButton label="Zoom out" onClick={() => zoomBy(1 / 1.25)}><ZoomOut size={16} /></IconButton><span data-testid="zoom-level">{Math.round(view.scale * 100)}%</span><IconButton label="Zoom in" onClick={() => zoomBy(1.25)}><ZoomIn size={16} /></IconButton>
            <IconButton label="Reset image view" onClick={resetView}><Maximize size={16} /></IconButton>
            <Tooltip label="Download current image"><IconButton label="Share image" onClick={share}><Download size={16} /></IconButton></Tooltip>
          </div>
        </div>
        {slots.length > 0 && <div className="ll-detail__rail" role="tablist" aria-label="Image slots">{slots.map((s, i) => <button key={s} role="tab" aria-selected={i === index} className={i === index ? 'is-active' : ''} onClick={() => setIndex(i)}><ValImage src={lineup.slots[s].image} alt={SLOT_LABELS[s]} kind="media" className="ll-detail__thumb" imgClassName="ll-detail__thumb" /><span>{SLOT_LABELS[s]}</span></button>)}</div>}
      </div>
      <aside className="ll-detail__meta">
        <div className="ll-detail__badges">
          <ValImage src={agent?.displayIcon} alt={agent?.displayName ?? 'Agent'} kind="agent" className="ll-badge-img" imgClassName="ll-badge-img" />
          <ValImage src={abilityIcon(catalog, lineup.agentUuid, lineup.abilitySlot)} alt={abilityName(catalog, lineup.agentUuid, lineup.abilitySlot)} kind="ability" className="ll-badge-img" imgClassName="ll-badge-img" />
          <Chip tone={lineup.side === 'attack' ? 'attack' : lineup.side === 'defense' ? 'defense' : 'neutral'} selected>{lineup.side}</Chip>
          <Chip selected>{lineup.site || '—'}</Chip>
          <Button size="md" variant="ghost" onClick={() => setShowInfo(v => !v)} aria-expanded={showInfo}>{showInfo ? 'Hide details' : 'Details'}</Button>
        </div>
        <Minimap src={map?.displayIcon} lineups={[lineup]} selectedId={lineup.id} abilityIcons={{ [`${lineup.agentUuid}:${lineup.abilitySlot}`]: abilityIcon(catalog, lineup.agentUuid, lineup.abilitySlot) ?? '' }} showToolbar={false} className="ll-detail__map" />
        {showInfo && <div className="ll-detail__info">
          {steps.length > 0 && <><h3 className="ll-h3">Steps</h3><ol className="ll-steps">{steps.map(s => <li key={s.order}><span className="ll-steps__num">{s.order}</span><div><p>{s.text}</p>{s.imageRef && <ValImage src={s.imageRef} alt={`Step ${s.order}`} kind="media" className="ll-steps__img" imgClassName="ll-steps__img" />}</div></li>)}</ol></>}
          {lineup.notes && <><h3 className="ll-h3">Notes</h3><p className="ll-notes">{lineup.notes}</p></>}
          {tags.length > 0 && <div className="ll-detail__tags">{tags.map(t => <Chip key={t}>{t}</Chip>)}</div>}
          <dl className="ll-meta-grid"><dt>Ability</dt><dd>{abilityKey(lineup.abilitySlot)} · {abilityName(catalog, lineup.agentUuid, lineup.abilitySlot)}</dd><dt>Author</dt><dd>{lineup.author || '—'}</dd><dt>Updated</dt><dd>{new Date(lineup.updatedAt).toLocaleDateString()}</dd></dl>
          {video && <video controls src={video} className="ll-detail__video" />}
        </div>}
      </aside>
    </div>
  </Popup>;
}
