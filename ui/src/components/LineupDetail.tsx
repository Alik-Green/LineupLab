import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, GraduationCap, Pencil, Star, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import type { Catalog, LibraryAdapter, Lineup, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';
import { AnnotatedImage } from './AnnotatedImage';
import { Minimap } from './Minimap';
import { Button, Chip, Drawer, IconButton, Kbd, Tooltip, useToast } from './ui';
import { ValImage } from '../lib/images';
import { useMediaUrl } from '../lib/hooks';
import { abilityIcon, abilityKey, abilityName, difficultyDots } from '../lib/game';

export function LineupDetail({ adapter, lineup, catalog, onClose, onEdit, onRefresh, readOnly = false }: { adapter: LibraryAdapter; lineup: Lineup; catalog: Catalog | null; onClose(): void; onEdit(id: string): void; onRefresh(): void; readOnly?: boolean }) {
  const toast = useToast();
  const slots = useMemo(() => SLOT_ORDER.filter(s => lineup.slots[s]?.image), [lineup]);
  const [index, setIndex] = useState(0); const [zoom, setZoom] = useState(1);
  const slot: SlotId = slots[Math.min(index, slots.length - 1)] ?? 'aim1';
  const map = catalog?.maps.find(m => m.uuid === lineup.mapUuid);
  const agent = catalog?.agents.find(a => a.uuid === lineup.agentUuid);
  const video = useMediaUrl(adapter, lineup.videoClip);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') setIndex(i => Math.min(slots.length - 1, i + 1)); if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1)); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [slots.length]);
  const share = async () => { const url = await adapter.mediaUrl(lineup.slots[slot]?.image ?? ''); const a = document.createElement('a'); a.href = url; a.download = `${lineup.title || 'lineup'}-${slot}.png`; a.click(); toast.push('Image download started.', 'success'); };
  const favorite = async () => { await adapter.setFavorite(lineup.id, !lineup.isFavorite); onRefresh(); toast.push(lineup.isFavorite ? 'Removed from favorites.' : 'Added to favorites.', 'success'); };
  const duplicate = async () => { await adapter.duplicateLineup(lineup.id); onRefresh(); toast.push('Lineup duplicated.', 'success'); };
  const remove = async () => { await adapter.deleteLineup(lineup.id); onRefresh(); onClose(); toast.push('Lineup deleted.', 'warning'); };
  return <Drawer open onClose={onClose} title={lineup.title || 'Untitled lineup'} footer={<>
    <Button onClick={favorite} icon={<Star size={16} fill={lineup.isFavorite ? 'currentColor' : 'none'} />}>{lineup.isFavorite ? 'Favorited' : 'Favorite'}</Button>
    {!readOnly && <Button onClick={duplicate} icon={<Copy size={16} />}>Duplicate</Button>}
    {!readOnly && <Button variant="danger" onClick={remove} icon={<Trash2 size={16} />}>Delete</Button>}
    {!readOnly && <Button variant="primary" onClick={() => onEdit(lineup.id)} icon={<Pencil size={16} />}>Edit</Button>}
    {adapter.kind === 'tauri' && document.documentElement.dataset.platform !== 'mobile' && <Button icon={<GraduationCap size={16} />} onClick={async () => { try { await adapter.learnLineup(lineup.id); toast.push('Sent to overlay in Learn mode.', 'success'); } catch (e) { toast.push(String(e), 'error'); } }}>Learn in overlay</Button>}
  </>}>
    <div className="ll-detail" data-testid="lineup-detail">
      <div className="ll-detail__viewer">
        <div className="ll-detail__stage">
          {lineup.slots[slot]?.image ? <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 150ms ease' }}><AnnotatedImage src={lineup.slots[slot].image!} slot={lineup.slots[slot]} alt={SLOT_LABELS[slot]} /></div> : <div className="ll-empty">No image</div>}
          <div className="ll-detail__zoom"><IconButton label="Zoom out" onClick={() => setZoom(z => Math.max(1, z - 0.25))}><ZoomOut size={16} /></IconButton><span>{Math.round(zoom * 100)}%</span><IconButton label="Zoom in" onClick={() => setZoom(z => Math.min(3, z + 0.25))}><ZoomIn size={16} /></IconButton><Tooltip label="Download current image"><IconButton label="Share image" onClick={share}><Download size={16} /></IconButton></Tooltip></div>
        </div>
        <div className="ll-detail__rail" role="tablist" aria-label="Image slots">{slots.map((s, i) => <button key={s} role="tab" aria-selected={i === index} className={i === index ? 'is-active' : ''} onClick={() => { setIndex(i); setZoom(1); }}><ValImage src={lineup.slots[s].image} alt={SLOT_LABELS[s]} kind="media" className="ll-detail__thumb" imgClassName="ll-detail__thumb" /><span>{SLOT_LABELS[s]}</span></button>)}</div>
        <p className="ll-muted" style={{ fontSize: 12 }}><Kbd>Left</Kbd> <Kbd>Right</Kbd> navigate slots</p>
      </div>
      <aside className="ll-detail__meta">
        <div className="ll-detail__badges">
          <ValImage src={agent?.displayIcon} alt={agent?.displayName ?? 'Agent'} kind="agent" className="ll-badge-img" imgClassName="ll-badge-img" />
          <ValImage src={abilityIcon(catalog, lineup.agentUuid, lineup.abilitySlot)} alt={abilityName(catalog, lineup.agentUuid, lineup.abilitySlot)} kind="ability" className="ll-badge-img" imgClassName="ll-badge-img" />
          <Chip tone={lineup.side === 'attack' ? 'attack' : lineup.side === 'defense' ? 'defense' : 'neutral'} selected>{lineup.side}</Chip>
          <Chip selected>{lineup.site || '—'}</Chip><Chip>{lineup.mode}</Chip>
        </div>
        <Minimap src={map?.displayIcon} lineups={[lineup]} selectedId={lineup.id} abilityIcons={{ [`${lineup.agentUuid}:${lineup.abilitySlot}`]: abilityIcon(catalog, lineup.agentUuid, lineup.abilitySlot) ?? '' }} showToolbar={false} className="ll-detail__map" />
        <h3 className="ll-h3">Steps</h3>
        <ol className="ll-steps">{lineup.steps.map(s => <li key={s.order}><span className="ll-steps__num">{s.order}</span><div><p>{s.text}</p>{s.imageRef && <ValImage src={s.imageRef} alt={`Step ${s.order}`} kind="media" className="ll-steps__img" imgClassName="ll-steps__img" />}</div></li>)}</ol>
        {lineup.notes && <><h3 className="ll-h3">Notes</h3><p className="ll-notes">{lineup.notes}</p></>}
        <div className="ll-detail__tags">{lineup.tags.map(t => <Chip key={t}>{t}</Chip>)}</div>
        <dl className="ll-meta-grid"><dt>Throw</dt><dd>{lineup.throwType}</dd><dt>Difficulty</dt><dd>{'●'.repeat(difficultyDots(lineup.difficulty))} {lineup.difficulty}</dd><dt>Ability</dt><dd>{abilityKey(lineup.abilitySlot)} · {abilityName(catalog, lineup.agentUuid, lineup.abilitySlot)}</dd><dt>Author</dt><dd>{lineup.author || '—'}</dd><dt>Updated</dt><dd>{new Date(lineup.updatedAt).toLocaleDateString()}</dd></dl>
        {video && <video controls src={video} className="ll-detail__video" />}
      </aside>
    </div>
  </Drawer>;
}
