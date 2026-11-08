import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Copy, Filter, LayoutGrid, MapPin, Pencil, Plus, Rows3, Search, Star, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import type { Catalog, LibraryAdapter, Lineup, SlotId } from '../types';
import { SLOT_ORDER } from '../types';
import { AnnotatedImage } from './AnnotatedImage';
import { Minimap } from './Minimap';
import { LineupDetail } from './LineupDetail';
import { usePersistentState } from '../lib/hooks';
import { ValImage } from '../lib/images';
import { Button, Chip, Drawer, EmptyState, IconButton, Input, Segmented, Select, Toggle, Tooltip, useToast } from './ui';
import { BrowsePicker } from './BrowsePicker';
import { calloutsForMap } from '../lib/modes';
import { abilityIcon, abilityKey, abilityName, difficultyDots, enabledAbilities, standardMaps, sitesForMap, ROLES, SITES, DIFFICULTIES } from '../lib/game';

export interface Filters { map: string; agent: string; ability: string; side: string; site: string; q: string; tag: string; favorites: boolean; difficulty?: string }
const DEFAULT_FILTERS: Filters = { map: '', agent: '', ability: '', side: '', site: '', q: '', tag: '', favorites: false, difficulty: '' };
export function previewHash(l: Lineup): string | null { return l.slots.landing.image ?? l.slots.aim2.image ?? l.slots.aim1.image ?? l.slots.stand1.image ?? l.slots.stand2.image ?? l.throws.find(t => t.aimImage)?.aimImage ?? l.steps.find(s => s.imageRef)?.imageRef ?? null; }
export function previewSlot(l: Lineup): SlotId { return (SLOT_ORDER.find(s => l.slots[s].image && (s === 'landing' || s === 'aim2' || s === 'aim1' || s === 'stand1' || s === 'stand2')) ?? 'landing'); }
export function filterLineups(all: Lineup[], f: Filters): Lineup[] {
  const q = f.q.trim().toLowerCase();
  return all.filter(l => !l.deleted && (!f.map || l.mapUuid === f.map) && (!f.agent || l.agentUuid === f.agent) && (!f.ability || l.abilitySlot === f.ability) && (!f.side || l.side === f.side || l.side === 'both') && (!f.site || l.site.toLowerCase() === f.site.toLowerCase()) && (!f.tag || l.tags.includes(f.tag)) && (!f.difficulty || l.difficulty === f.difficulty) && (!f.favorites || l.isFavorite) && (!q || [l.title, l.notes, l.author, l.site, ...l.tags].join(' ').toLowerCase().includes(q)));
}
function sortLineups(ls: Lineup[], sort: string) { const arr = [...ls]; if (sort === 'title') arr.sort((a, b) => a.title.localeCompare(b.title)); else if (sort === 'favorites') arr.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.updatedAt.localeCompare(a.updatedAt)); else if (sort === 'difficulty') arr.sort((a, b) => difficultyDots(a.difficulty) - difficultyDots(b.difficulty)); else if (sort === 'site') arr.sort((a, b) => a.site.localeCompare(b.site)); else arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); return arr; }

export function Browse({ adapter, lineups, catalog, onEdit, onRefresh, readOnly = false, mobile = false }: { adapter: LibraryAdapter; lineups: Lineup[]; catalog: Catalog | null; onEdit(id: string): void; onRefresh(): void; readOnly?: boolean; mobile?: boolean }) {
  const toast = useToast();
  const [filters, setFilters] = usePersistentState<Filters>('lineuplab.filters', DEFAULT_FILTERS);
  const [leftPct, setLeftPct] = usePersistentState<{ value: number }>('lineuplab.browseSplit', { value: 46 });
  const [sort, setSort] = usePersistentState<{ value: string }>('lineuplab.sort', { value: 'newest' });
  const [view, setView] = usePersistentState<{ value: string }>('lineuplab.cardView', { value: 'comfortable' });
  const [favAgents, setFavAgents] = usePersistentState<{ ids: string[] }>('lineuplab.favoriteAgents', { ids: [] });
  const [mobileView, setMobileView] = usePersistentState<{ value: 'list' | 'map' }>('lineuplab.mobileView', { value: 'list' });
  const [role, setRole] = useState('');
  const [selected, setSelected] = useState<string | null>(null); const [hover, setHover] = useState<string | null>(null); const [detail, setDetail] = useState<Lineup | null>(null); const [showFilters, setShowFilters] = useState(false);
  const container = useRef<HTMLDivElement>(null); const parent = useRef<HTMLDivElement>(null); const [width, setWidth] = useState(900);
  const maps = useMemo(() => standardMaps(catalog?.maps ?? []), [catalog]);
  useEffect(() => { if (maps.length && !filters.map) setFilters(f => ({ ...f, map: maps[0].uuid })); }, [maps, filters.map, setFilters]);
  useEffect(() => { const el = parent.current; if (!el) return; const ro = new ResizeObserver(() => setWidth(el.clientWidth)); ro.observe(el); setWidth(el.clientWidth); return () => ro.disconnect(); }, []);
  const set = (patch: Partial<Filters>) => setFilters(f => ({ ...f, ...patch }));
  const agent = catalog?.agents.find(a => a.uuid === filters.agent);
  const abilities = enabledAbilities(agent);
  useEffect(() => { if (filters.ability && agent && !abilities.some(a => a.slot === filters.ability)) set({ ability: '' }); }, [filters.agent]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => sortLineups(filterLineups(lineups, filters), sort.value), [lineups, filters, sort.value]);
  const tags = useMemo(() => [...new Set(lineups.flatMap(l => l.tags))].sort(), [lineups]);
  const map = catalog?.maps.find(m => m.uuid === filters.map);
  const abilityIcons = useMemo(() => { const out: Record<string, string> = {}; for (const l of filtered) { const icon = abilityIcon(catalog, l.agentUuid, l.abilitySlot); if (icon) out[`${l.agentUuid}:${l.abilitySlot}`] = icon; } return out; }, [filtered, catalog]);
  const cols = Math.max(1, Math.min(view.value === 'compact' ? 4 : 3, Math.floor(width / (view.value === 'compact' ? 240 : 300))));
  const rowHeight = view.value === 'compact' ? 230 : 300;
  const rows = Math.ceil(filtered.length / cols);
  const virtualizer = useVirtualizer({ count: rows, getScrollElement: () => parent.current, estimateSize: () => rowHeight, overscan: 3 });
  useEffect(() => { if (!selected) return; const i = filtered.findIndex(l => l.id === selected); if (i >= 0) virtualizer.scrollToIndex(Math.floor(i / cols), { align: 'auto' }); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeFilters = [filters.agent, filters.ability, filters.side, filters.site, filters.difficulty, filters.tag, filters.q, filters.favorites ? 'fav' : ''].filter(Boolean).length;
  const hoverLineup = filtered.find(l => l.id === hover);
  const agentOptions = useMemo(() => (catalog?.agents ?? []).filter(a => (!role || a.role === role) && true).sort((a, b) => Number(favAgents.ids.includes(b.uuid)) - Number(favAgents.ids.includes(a.uuid)) || a.displayName.localeCompare(b.displayName)), [catalog, role, favAgents.ids]);
  const startDrag = useCallback((e: React.PointerEvent) => { e.preventDefault(); const move = (ev: PointerEvent) => { const r = container.current?.getBoundingClientRect(); if (!r) return; setLeftPct({ value: Math.min(62, Math.max(34, (ev.clientX - r.left) / r.width * 100)) }); }; const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); }, [setLeftPct]);
  const mapEmpty = <EmptyState title="No lineups match" description={`No lineups for ${filters.ability ? abilityName(catalog, filters.agent, filters.ability) : 'this ability'} on ${map?.displayName ?? 'this map'} yet.`} action={readOnly ? <Button variant="primary" onClick={() => { setMobileView({ value: 'list' }); setFilters(DEFAULT_FILTERS); }}>Reset filters</Button> : <Button variant="primary" icon={<Plus size={16} />} onClick={() => onEdit('')}>Create one</Button>} />;
  const renderCard = (l: Lineup) => <LineupCard key={l.id} adapter={adapter} lineup={l} catalog={catalog} compact={view.value === 'compact'} selected={selected === l.id} onOpen={() => { setSelected(l.id); setDetail(l); }} onHover={setHover} readOnly={readOnly} onFavorite={async () => { await adapter.setFavorite(l.id, !l.isFavorite); onRefresh(); }} onEdit={() => onEdit(l.id)} onDuplicate={async () => { await adapter.duplicateLineup(l.id); onRefresh(); toast.push('Lineup duplicated.', 'success'); }} onDelete={async () => { await adapter.deleteLineup(l.id); onRefresh(); toast.push('Lineup deleted.', 'warning'); }} onShowMap={() => setSelected(l.id)} />;
  if (mobile) return <div className="ll-mbrowse" data-testid="browse">
    <div className="ll-mbrowse__head">
      <div className="ll-mbrowse__title"><h1 className="ll-h1">{map?.displayName ?? 'All maps'} <span className="ll-count">{filtered.length}</span></h1><p className="ll-muted">{agent ? agent.displayName : 'All agents'} · {filters.ability ? abilityName(catalog, filters.agent, filters.ability) : 'All abilities'}</p></div>
      <div className="ll-search ll-search--mobile"><Search size={16} /><input aria-label="Search lineups" placeholder="Search title, notes, tags…" value={filters.q} onChange={e => set({ q: e.target.value })} /></div>
      <div className="ll-mbrowse__pickers">
        <BrowsePicker square label="Map" kind="map" allLabel="All maps" value={filters.map} onChange={v => set({ map: v })} options={maps.map(m => ({ id: m.uuid, name: m.displayName, icon: m.splash || m.listViewIcon || m.displayIcon }))} />
        <BrowsePicker square label="Agent" kind="agent" allLabel="All agents" value={filters.agent} onChange={v => set({ agent: v, ability: '' })} options={(catalog?.agents ?? []).map(a => ({ id: a.uuid, name: a.displayName, icon: a.displayIcon }))} searchable />
        <BrowsePicker square label="Ability" kind="ability" allLabel="All abilities" value={filters.ability} onChange={v => set({ ability: v })} disabled={!agent} options={abilities.map(a => ({ id: a.slot, name: a.displayName, icon: a.displayIcon, sublabel: abilityKey(a.slot) }))} />
      </div>
      <div className="ll-mbrowse__controls">
        <Button icon={<Filter size={16} />} onClick={() => setShowFilters(true)}>Filters{activeFilters ? ` (${activeFilters})` : ''}</Button>
        <Segmented ariaLabel="Browse view" value={mobileView.value} onChange={v => setMobileView({ value: v })} options={[{ value: 'list', label: '', ariaLabel: 'List view', icon: <LayoutGrid size={18} /> }, { value: 'map', label: '', ariaLabel: 'Map view', icon: <MapPin size={18} /> }]} />
      </div>
    </div>
    {mobileView.value === 'map' ? <div className="ll-mbrowse__mapwrap"><Minimap src={map?.displayIcon} callouts={calloutsForMap(map)} lineups={filtered} selectedId={selected} onSelect={id => { setSelected(id); const l = filtered.find(x => x.id === id); if (l) setDetail(l); }} abilityIcons={abilityIcons} markerScale={2.4} emptyMessage={mapEmpty} className="ll-mbrowse__map" /><p className="ll-muted ll-mbrowse__hint">Tap a marker to open the lineup. Use the zoom buttons; drag to pan.</p></div>
      : <div className="ll-mbrowse__list" data-testid="lineup-grid">{filtered.length ? filtered.map(renderCard) : <EmptyState icon={<MapPin size={28} />} title="No lineups found" description="Adjust the map or filters to see more lineups." />}</div>}
    <Drawer open={showFilters} onClose={() => setShowFilters(false)} title="Filters" footer={<><Button variant="ghost" icon={<X size={16} />} onClick={() => setFilters(DEFAULT_FILTERS)}>Reset</Button><Button variant="primary" onClick={() => setShowFilters(false)}>Show {filtered.length} lineups</Button></>}>
      <div className="ll-form-grid ll-mfilters">
        <div className="ll-field"><span className="ll-label">Side</span><Segmented ariaLabel="Side" value={filters.side || 'both'} onChange={v => set({ side: v === 'both' ? '' : v })} options={[{ value: 'both', label: 'Both' }, { value: 'attack', label: 'Attack' }, { value: 'defense', label: 'Defense' }]} /></div>
        <div className="ll-field"><span className="ll-label">Site</span><div className="ll-site-chips">{sitesForMap(map?.displayName).map(site => <Chip key={site} selected={filters.site === site} onClick={() => set({ site: filters.site === site ? '' : site })}>{site}</Chip>)}</div></div>
        <Select label="Difficulty" value={filters.difficulty ?? ''} onChange={e => set({ difficulty: e.target.value })}><option value="">Any difficulty</option>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</Select>
        <Select label="Tag" value={filters.tag} onChange={e => set({ tag: e.target.value })}><option value="">Any tag</option>{tags.map(t => <option key={t} value={t}>{t}</option>)}</Select>
        <Toggle label="Favorites only" checked={filters.favorites} onChange={v => set({ favorites: v })} />
      </div>
    </Drawer>
    {detail && <LineupDetail adapter={adapter} lineup={lineups.find(l => l.id === detail.id) ?? detail} catalog={catalog} readOnly onClose={() => setDetail(null)} onEdit={() => {}} onRefresh={onRefresh} />}
  </div>;
  return <div ref={container} className="ll-browse" data-testid="browse" style={{ gridTemplateColumns: `${leftPct.value}% 40px minmax(0,1fr)` }}>
    <section className="ll-browse__left" aria-label="Map and lineup filters">
      <div className="ll-browse__pickers">
        <BrowsePicker square label="Map" kind="map" size="lg" allLabel="All maps" value={filters.map} onChange={v => set({ map: v })} options={maps.map(m => ({ id: m.uuid, name: m.displayName, icon: m.splash || m.listViewIcon || m.displayIcon }))} searchable />
        <BrowsePicker square label="Agent" kind="agent" allLabel="All agents" value={filters.agent} onChange={v => set({ agent: v, ability: '' })} options={agentOptions.map(a => ({ id: a.uuid, name: a.displayName, icon: a.displayIcon }))} searchable favoriteIds={favAgents.ids} onToggleFavorite={id => setFavAgents(s => ({ ids: s.ids.includes(id) ? s.ids.filter(x => x !== id) : [...s.ids, id] }))} header={<div className="ll-role-chips">{['', ...ROLES].map(r => <Chip key={r} selected={role === r} onClick={() => setRole(r)}>{r || 'All roles'}</Chip>)}</div>} />
        <BrowsePicker square label="Ability" kind="ability" allLabel="All abilities" value={filters.ability} onChange={v => set({ ability: v })} disabled={!agent} options={abilities.map(a => ({ id: a.slot, name: a.displayName, icon: a.displayIcon, sublabel: abilityKey(a.slot) }))} />
      </div>
      <div className="ll-browse__map-wrap"><Minimap src={map?.displayIcon} callouts={calloutsForMap(map)} lineups={filtered} selectedId={selected} onSelect={id => { setSelected(id); const l = filtered.find(x => x.id === id); if (l) setDetail(l); }} onHover={setHover} abilityIcons={abilityIcons} emptyMessage={mapEmpty} className="ll-browse__map" />{hoverLineup && <div className="ll-map-hover"><ValImage src={previewHash(hoverLineup)} alt="" kind="media" className="ll-map-hover__img" imgClassName="ll-map-hover__img" /><div><strong>{hoverLineup.title}</strong><span>{hoverLineup.site} · {hoverLineup.side}</span></div></div>}</div>
      <div className="ll-filterbar"><Button size="md" icon={<Filter size={16} />} onClick={() => setShowFilters(x => !x)}>Filters{activeFilters ? ` (${activeFilters})` : ''}</Button>{showFilters && <div className="ll-filterbar__controls"><Segmented ariaLabel="Side" value={filters.side || 'both'} onChange={v => set({ side: v === 'both' ? '' : v })} options={[{ value: 'both', label: 'Both' }, { value: 'attack', label: 'Attack' }, { value: 'defense', label: 'Defense' }]} /><div className="ll-site-chips">{sitesForMap(map?.displayName).map(s => <Chip key={s} selected={filters.site === s} onClick={() => set({ site: filters.site === s ? '' : s })}>{s}</Chip>)}</div><Select aria-label="Difficulty" value={filters.difficulty ?? ''} onChange={e => set({ difficulty: e.target.value })}><option value="">Any difficulty</option>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</Select><Select aria-label="Tag" value={filters.tag} onChange={e => set({ tag: e.target.value })}><option value="">Any tag</option>{tags.map(t => <option key={t} value={t}>{t}</option>)}</Select><Chip selected={filters.favorites} onClick={() => set({ favorites: !filters.favorites })}><Star size={14} /> Favorites</Chip><Button variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)} icon={<X size={14} />}>Reset</Button></div>}</div>
    </section>
    <div className="ll-divider" role="separator" aria-orientation="vertical" aria-label="Resize map panel" tabIndex={0} onPointerDown={startDrag} onKeyDown={e => { if (e.key === 'ArrowLeft') setLeftPct({ value: Math.max(34, leftPct.value - 2) }); if (e.key === 'ArrowRight') setLeftPct({ value: Math.min(62, leftPct.value + 2) }); }} />
    <section className="ll-browse__right" aria-label="Lineups">
      <div className="ll-browse__header"><div><h1 className="ll-h1">{map?.displayName ?? 'All maps'} <span className="ll-count">{filtered.length}</span></h1><p className="ll-muted">{agent ? agent.displayName : 'All agents'} · {filters.ability ? abilityName(catalog, filters.agent, filters.ability) : 'All abilities'}</p></div><div className="ll-browse__actions"><div className="ll-search"><Search size={16} /><input aria-label="Search lineups" placeholder="Search title, notes, tags…" value={filters.q} onChange={e => set({ q: e.target.value })} /></div><Select aria-label="Sort" value={sort.value} onChange={e => setSort({ value: e.target.value })}><option value="newest">Newest</option><option value="favorites">Favorites</option><option value="title">Title</option><option value="difficulty">Difficulty</option><option value="site">Site</option></Select><Segmented ariaLabel="Card density" value={view.value} onChange={v => setView({ value: v })} options={[{ value: 'comfortable', label: '', ariaLabel: 'Comfortable cards', icon: <LayoutGrid size={16} /> }, { value: 'compact', label: '', ariaLabel: 'Compact cards', icon: <Rows3 size={16} /> }]} />{!readOnly && <Button variant="primary" icon={<Plus size={16} />} onClick={() => onEdit('')}>New lineup</Button>}</div></div>
      <div ref={parent} className="ll-card-scroll" data-testid="lineup-grid">
        {filtered.length === 0 ? <EmptyState icon={<MapPin size={28} />} title="No lineups found" description="Adjust filters, import a legacy pack, or create your first lineup." action={!readOnly && <Button variant="primary" icon={<Plus size={16} />} onClick={() => onEdit('')}>New lineup</Button>} /> : <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(vr => <div key={vr.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: vr.size, transform: `translateY(${vr.start}px)`, display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 12, padding: '0 2px 12px 0' }}>
            {filtered.slice(vr.index * cols, vr.index * cols + cols).map(l => renderCard(l))}
          </div>)}
        </div>}
      </div>
    </section>
    {detail && <LineupDetail adapter={adapter} lineup={lineups.find(l => l.id === detail.id) ?? detail} catalog={catalog} readOnly={readOnly} onClose={() => setDetail(null)} onEdit={id => { onEdit(id); setDetail(null); }} onRefresh={onRefresh} />}
  </div>;
}
function LineupCard({ adapter, lineup: l, catalog, compact, selected, onOpen, onHover, onFavorite, onEdit, onDuplicate, onDelete, onShowMap, readOnly }: { adapter: LibraryAdapter; lineup: Lineup; catalog: Catalog | null; compact?: boolean; selected: boolean; onOpen(): void; onHover(id: string | null): void; onFavorite(): void; onEdit(): void; onDuplicate(): void; onDelete(): void; onShowMap(): void; readOnly?: boolean }) {
  const slot = previewSlot(l); const hash = previewHash(l); const agent = catalog?.agents.find(a => a.uuid === l.agentUuid);
  return <article className={clsx('ll-lineup-card', selected && 'is-selected', compact && 'is-compact', `ll-side--${l.side}`)} onMouseEnter={() => onHover(l.id)} onMouseLeave={() => onHover(null)} data-testid="lineup-card">
    <button className="ll-lineup-card__img" onClick={onOpen} aria-label={`Open ${l.title}`}>
      {hash ? <AnnotatedImage src={hash} slot={l.slots[slot]} alt="" hideLens className="ll-lineup-card__annot" /> : <div className="ll-lineup-card__noimg">No image</div>}
      <span className="ll-lineup-card__badges"><ValImage src={abilityIcon(catalog, l.agentUuid, l.abilitySlot)} alt="" kind="ability" className="ll-card-badge" imgClassName="ll-card-badge" /><ValImage src={agent?.displayIcon} alt="" kind="agent" className="ll-card-badge" imgClassName="ll-card-badge" /></span>
      <span className="ll-mode-badge">{l.mode.replace(/-/g, ' ')}</span>
    </button>
    <div className="ll-lineup-card__body"><div className="ll-lineup-card__title-row"><button className="ll-lineup-card__title" onClick={onOpen}>{l.title || 'Untitled'}</button><IconButton label={l.isFavorite ? 'Unfavorite' : 'Favorite'} className={l.isFavorite ? 'is-active' : ''} onClick={onFavorite}><Star size={16} fill={l.isFavorite ? 'currentColor' : 'none'} /></IconButton></div><div className="ll-lineup-card__meta"><Chip selected tone={l.side === 'attack' ? 'attack' : l.side === 'defense' ? 'defense' : 'neutral'}>{l.site || '—'} · {l.side}</Chip><span className="ll-dots" aria-label={`Difficulty ${l.difficulty}`}>{[1, 2, 3].map(i => <i key={i} className={i <= difficultyDots(l.difficulty) ? `on ll-dot--${i}` : ''} />)}</span></div></div>
    <div className="ll-lineup-card__actions"><Tooltip label="Show on map"><IconButton label="Show on map" onClick={onShowMap}><MapPin size={16} /></IconButton></Tooltip>{!readOnly && <><Tooltip label="Edit"><IconButton label="Edit lineup" onClick={onEdit}><Pencil size={16} /></IconButton></Tooltip><Tooltip label="Duplicate"><IconButton label="Duplicate lineup" onClick={onDuplicate}><Copy size={16} /></IconButton></Tooltip><Tooltip label="Delete"><IconButton label="Delete lineup" onClick={onDelete}><Trash2 size={16} /></IconButton></Tooltip></>}</div>
  </article>;
}
