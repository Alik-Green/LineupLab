import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Catalog, LibraryAdapter, Lineup, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';
import { AnnotatedImage } from './AnnotatedImage';
import { Minimap } from './Minimap';
import { useMediaUrl, usePersistentState } from '../lib/hooks';
import { ValImage } from '../lib/images';

interface Filters { map: string; agent: string; ability: string; side: string; site: string; q: string; tag: string; favorites: boolean }
const DEFAULT_FILTERS: Filters = { map: '', agent: '', ability: '', side: '', site: '', q: '', tag: '', favorites: false };
export function previewHash(l: Lineup): string | null { return l.slots.landing.image ?? l.slots.aim2.image ?? l.slots.aim1.image ?? l.slots.stand1.image ?? l.slots.stand2.image ?? l.throws.find(t => t.aimImage)?.aimImage ?? l.steps.find(s => s.imageRef)?.imageRef ?? null; }
export function filterLineups(all: Lineup[], f: Filters): Lineup[] {
  const q = f.q.trim().toLowerCase();
  return all.filter(l => !l.deleted && (!f.map || l.mapUuid === f.map) && (!f.agent || l.agentUuid === f.agent) && (!f.ability || l.abilitySlot === f.ability) && (!f.side || l.side === f.side || l.side === 'both') && (!f.site || l.site.toLowerCase() === f.site.toLowerCase()) && (!f.tag || l.tags.includes(f.tag)) && (!f.favorites || l.isFavorite) && (!q || [l.title, l.notes, l.author, l.site, ...l.tags].join(' ').toLowerCase().includes(q)));
}
export function Browse({ adapter, lineups, catalog, onEdit, onRefresh, readOnly = false }: { adapter: LibraryAdapter; lineups: Lineup[]; catalog: Catalog | null; onEdit(id: string): void; onRefresh(): void; readOnly?: boolean }) {
  const [filters, setFilters] = usePersistentState<Filters>('lineuplab.filters', DEFAULT_FILTERS);
  const [selected, setSelected] = useState<string | null>(null); const [hover, setHover] = useState<string | null>(null); const [detail, setDetail] = useState<Lineup | null>(null);
  const filtered = useMemo(() => filterLineups(lineups, filters), [lineups, filters]);
  const tags = useMemo(() => [...new Set(lineups.flatMap(l => l.tags))].sort(), [lineups]);
  const map = catalog?.maps.find(m => m.uuid === filters.map); const mapUrl = useMediaUrl(adapter, map?.displayIcon);
  const parent = useRef<HTMLDivElement>(null); const cols = 3; const rows = Math.ceil(filtered.length / cols);
  const virtualizer = useVirtualizer({ count: rows, getScrollElement: () => parent.current, estimateSize: () => 250, overscan: 3 });
  const set = (patch: Partial<Filters>) => setFilters(f => ({ ...f, ...patch }));
  const hoverLineup = filtered.find(l => l.id === hover);
  return <div className="grid gap-4 xl:grid-cols-[300px_1fr]" data-testid="browse">
    <aside className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <input aria-label="Search lineups" placeholder="Search title, notes, tags…" value={filters.q} onChange={e => set({ q: e.target.value })} className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <IconSelect label="Map" value={filters.map} options={catalog?.maps.map(m => ({ id: m.uuid, name: m.displayName, icon: m.displayIcon })) ?? []} onChange={v => set({ map: v })} />
          <IconSelect label="Agent" value={filters.agent} options={catalog?.agents.map(a => ({ id: a.uuid, name: a.displayName, icon: a.displayIcon })) ?? []} onChange={v => set({ agent: v })} />
          <Select label="Ability" value={filters.ability} options={['Grenade', 'Ability1', 'Ability2', 'Ultimate']} onChange={v => set({ ability: v })} />
          <Select label="Side" value={filters.side} options={['attack', 'defense', 'both']} onChange={v => set({ side: v })} />
          <Select label="Site" value={filters.site} options={['A', 'B', 'C', 'Mid']} onChange={v => set({ site: v })} />
          <Select label="Tag" value={filters.tag} options={tags} onChange={v => set({ tag: v })} />
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={filters.favorites} onChange={e => set({ favorites: e.target.checked })} /> Favorites only</label>
        <div className="mt-2 flex justify-between text-xs text-slate-400"><span>{filtered.length} of {lineups.length}</span><button onClick={() => setFilters(DEFAULT_FILTERS)} className="text-cyan-400 hover:underline">Reset</button></div>
      </div>
      <Minimap src={mapUrl ?? map?.displayIcon} lineups={filtered} selectedId={selected} onSelect={id => { setSelected(id); const l = filtered.find(x => x.id === id); if (l) setDetail(l); }} onHover={setHover} />
      {hoverLineup && <HoverCard adapter={adapter} lineup={hoverLineup} />}
      {catalog?.stale && <p className="text-xs text-amber-400">Catalog offline cache · updated {new Date(catalog.updatedAt).toLocaleString()}</p>}
    </aside>
    <section>
      <div ref={parent} className="h-[calc(100vh-170px)] overflow-auto pr-1" data-testid="lineup-grid">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(vr => <div key={vr.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: vr.size, transform: `translateY(${vr.start}px)` }} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.slice(vr.index * cols, vr.index * cols + cols).map(l => <LineupCard key={l.id} adapter={adapter} lineup={l} onOpen={() => { setSelected(l.id); setDetail(l); }} onHover={setHover} readOnly={readOnly} onFavorite={async () => { await adapter.setFavorite(l.id, !l.isFavorite); onRefresh(); }} />)}
          </div>)}
        </div>
        {filtered.length === 0 && <div className="p-10 text-center text-slate-500">No lineups match. Create one or import a legacy pack.</div>}
      </div>
    </section>
    {detail && <DetailModal adapter={adapter} lineup={detail} catalog={catalog} readOnly={readOnly} onClose={() => setDetail(null)} onEdit={() => { onEdit(detail.id); setDetail(null); }} onRefresh={onRefresh} />}
  </div>;
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange(v: string): void }) { return <label className="block"><span className="text-slate-400">{label}</span><select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="mt-0.5 w-full rounded bg-slate-800 px-2 py-1.5"><option value="">All</option>{options.map(o => <option key={o} value={o}>{o}</option>)}</select></label>; }
function IconSelect({ label, value, options, onChange }: { label: string; value: string; options: { id: string; name: string; icon?: string }[]; onChange(v: string): void }) {
  return <div><span className="text-slate-400">{label}</span><div className="mt-0.5 flex max-h-24 flex-wrap gap-1 overflow-auto rounded bg-slate-800 p-1"><button title={`All ${label}`} onClick={() => onChange('')} className={`h-7 w-7 rounded text-[10px] ${!value ? 'bg-cyan-500 text-slate-950' : 'bg-slate-700'}`}>All</button>{options.map(o => <button key={o.id} title={o.name} onClick={() => onChange(o.id)} className={`h-7 w-7 overflow-hidden rounded ${value === o.id ? 'ring-2 ring-cyan-400' : ''}`}><ValImage src={o.icon} alt={o.name} kind="picker" className="h-full w-full" imgClassName="h-full w-full object-cover" fallbackLabel={o.name.slice(0, 2)} /></button>)}</div></div>;
}
function LineupCard({ adapter, lineup, onOpen, onHover, onFavorite, readOnly = false }: { adapter: LibraryAdapter; lineup: Lineup; onOpen(): void; onHover(id: string | null): void; onFavorite(): void; readOnly?: boolean }) {
  const url = useMediaUrl(adapter, previewHash(lineup));
  return <article className="flex h-[238px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 transition hover:border-cyan-700" onMouseEnter={() => onHover(lineup.id)} onMouseLeave={() => onHover(null)} data-testid="lineup-card">
    <button onClick={onOpen} className="relative block h-36 w-full overflow-hidden bg-slate-950 text-left">{url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-600">No image</div>}<span className="absolute left-2 top-2 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px]">{lineup.site || '—'} · {lineup.side}</span></button>
    <div className="flex flex-1 items-start gap-2 p-2"><button onClick={onOpen} className="min-w-0 flex-1 text-left"><div className="truncate text-sm font-semibold">{lineup.title || 'Untitled'}</div><div className="truncate text-xs text-slate-400">{lineup.abilitySlot} · {lineup.mode} · {lineup.difficulty}</div><div className="mt-1 flex flex-wrap gap-1">{lineup.tags.slice(0, 3).map(t => <span key={t} className="rounded bg-slate-800 px-1 text-[10px] text-slate-300">{t}</span>)}</div></button>{!readOnly && <button aria-label={lineup.isFavorite ? 'Unfavorite' : 'Favorite'} onClick={onFavorite} className={`text-lg ${lineup.isFavorite ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-300'}`}>★</button>}</div>
  </article>;
}
function HoverCard({ adapter, lineup }: { adapter: LibraryAdapter; lineup: Lineup }) { const url = useMediaUrl(adapter, previewHash(lineup)); return <div className="rounded-lg border border-cyan-900 bg-slate-900 p-2 text-xs"><div className="mb-1 font-semibold">{lineup.title}</div>{url && <ValImage src={url} alt="" kind="media" className="max-h-32 w-full rounded" imgClassName="max-h-32 w-full rounded object-cover" />}</div>; }
function DetailModal({ adapter, lineup, catalog, onClose, onEdit, onRefresh, readOnly = false }: { adapter: LibraryAdapter; lineup: Lineup; catalog: Catalog | null; onClose(): void; onEdit(): void; onRefresh(): void; readOnly?: boolean }) {
  const slots = SLOT_ORDER.filter(s => lineup.slots[s].image); const [i, setI] = useState(0); const slot: SlotId = slots[i] ?? 'aim1'; const url = useMediaUrl(adapter, lineup.slots[slot]?.image); const video = useMediaUrl(adapter, lineup.videoClip);
  const agent = catalog?.agents.find(a => a.uuid === lineup.agentUuid)?.displayName ?? lineup.agentUuid; const map = catalog?.maps.find(m => m.uuid === lineup.mapUuid)?.displayName ?? lineup.mapUuid;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}><div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl border border-slate-700 bg-slate-950 p-4" onClick={e => e.stopPropagation()} data-testid="lineup-detail">
    <header className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xl font-bold">{lineup.title}</h2><p className="text-sm text-slate-400">{map} · {agent} · {lineup.abilitySlot} · {lineup.site} · {lineup.side} · {lineup.difficulty}</p></div><button onClick={onClose} aria-label="Close" className="rounded bg-slate-800 px-3 py-1">✕</button></header>
    {slots.length > 0 && <div className="mb-2 flex flex-wrap gap-1 text-xs">{slots.map((s, idx) => <button key={s} onClick={() => setI(idx)} className={`rounded px-2 py-1 ${idx === i ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800'}`}>{SLOT_LABELS[s]}</button>)}<button onClick={() => setI((i + 1) % slots.length)} className="ml-auto rounded bg-slate-800 px-2 py-1">Next →</button></div>}
    {url ? <AnnotatedImage src={url} slot={lineup.slots[slot]} alt={SLOT_LABELS[slot]} /> : <p className="py-10 text-center text-slate-500">No images</p>}
    {lineup.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{lineup.notes}</p>}
    {lineup.steps.length > 0 && <ol className="mt-3 space-y-1 text-sm">{lineup.steps.map(s => <li key={s.order} className="flex gap-2"><span className="text-cyan-400">{s.order}.</span>{s.text}</li>)}</ol>}
    {video && <video src={video} controls className="mt-3 max-h-64 w-full rounded" />}
    <footer className="mt-4 flex flex-wrap gap-2 text-sm">{!readOnly && <><button onClick={onEdit} className="rounded bg-cyan-600 px-3 py-1.5 font-semibold text-white">Edit</button><button onClick={async () => { await adapter.duplicateLineup(lineup.id); onRefresh(); onClose(); }} className="rounded bg-slate-800 px-3 py-1.5">Duplicate</button><button onClick={async () => { await adapter.setFavorite(lineup.id, !lineup.isFavorite); onRefresh(); }} className="rounded bg-slate-800 px-3 py-1.5">{lineup.isFavorite ? '★ Unfavorite' : '☆ Favorite'}</button><button onClick={async () => { try { const bytes = await adapter.exportPack([lineup.id], true, false); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' })); a.download = `${lineup.id}.zip`; a.click(); } catch (e) { alert(String(e)); } }} className="rounded bg-slate-800 px-3 py-1.5">Share pack</button><button onClick={async () => { if (confirm('Delete this lineup? It can be restored by sync tombstone history.')) { await adapter.deleteLineup(lineup.id); onRefresh(); onClose(); } }} className="ml-auto rounded bg-red-900/60 px-3 py-1.5">Delete</button></>}{readOnly && <span className="text-xs text-slate-500">Browse-only companion · sync from desktop to update this library.</span>}</footer>
  </div></div>;
}
