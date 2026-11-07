import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Crosshair, Maximize, Minus, Plus, Route } from 'lucide-react';
import type { Lineup, Point } from '../types';
import { clampPoint, snapPoint } from '../lib/geometry';
import { useCachedImage, ValImage } from '../lib/images';
import { IconButton, Tooltip } from './ui';

export type PinKey = 'stand1Pos' | 'aim1Pos' | 'stand2Pos' | 'aim2Pos' | 'landPos';
export interface MinimapProps {
  src?: string; lineups: Lineup[]; selectedId?: string | null; onSelect?(id: string): void; onHover?(id: string | null): void;
  editablePins?: Partial<Record<PinKey, Point | null>>; onPinChange?(key: string, p: Point): void; className?: string;
  abilityIcons?: Record<string, string>; showToolbar?: boolean; emptyMessage?: ReactNode; contextLineups?: Lineup[]; activePinTool?: PinKey | 'bounces' | null; onMapClick?(p: Point): void;
}
const SIDE_COLOR: Record<string, string> = { attack: 'var(--ll-attack)', defense: 'var(--ll-defense)', both: 'var(--ll-muted)' };
export function Minimap({ src, lineups, selectedId, onSelect, onHover, editablePins, onPinChange, className = '', abilityIcons = {}, showToolbar = true, emptyMessage, contextLineups = [], activePinTool, onMapClick }: MinimapProps) {
  const ref = useRef<HTMLDivElement>(null); const drag = useRef<string | null>(null); const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 }); const [hover, setHover] = useState<string | null>(null); const [markerSize, setMarkerSize] = useState(1); const [lines, setLines] = useState(true);
  const toMap = useCallback((clientX: number, clientY: number): Point => { const r = ref.current!.getBoundingClientRect(); const x = (clientX - r.left) / r.width * 1000; const y = (clientY - r.top) / r.height * 1000; return clampPoint({ x: (x - view.tx) / view.scale, y: (y - view.ty) / view.scale }); }, [view]);
  useEffect(() => { const el = ref.current; if (!el) return; const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * 1000; const py = (e.clientY - r.top) / r.height * 1000; setView(v => { const scale = Math.min(6, Math.max(1, v.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); return { scale, tx: px - (px - v.tx) * scale / v.scale, ty: py - (py - v.ty) * scale / v.scale }; }); }; el.addEventListener('wheel', onWheel, { passive: false }); return () => el.removeEventListener('wheel', onWheel); }, []);
  const siteLabels = useMemo(() => { const groups = new Map<string, { x: number; y: number; n: number }>(); for (const l of lineups) { const p = l.landPos ?? l.stand1Pos; if (!p || !l.site) continue; const g = groups.get(l.site) ?? { x: 0, y: 0, n: 0 }; g.x += p.x; g.y += p.y; g.n++; groups.set(l.site, g); } return [...groups.entries()].map(([site, g]) => ({ site, x: g.x / g.n * 1000, y: g.y / g.n * 1000 })); }, [lineups]);
  const reset = () => setView({ scale: 1, tx: 0, ty: 0 });
  return <div className={`ll-minimap ${className}`} data-testid="minimap">
    <div ref={ref} className="ll-minimap__stage" style={{ touchAction: 'none', cursor: activePinTool ? 'crosshair' : pan.current ? 'grabbing' : 'grab' }}
      onPointerDown={e => { if ((e.target as Element).closest('[data-marker]')) return; if (activePinTool && onMapClick) { onMapClick(snapPoint(toMap(e.clientX, e.clientY), false)); return; } pan.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); }}
      onPointerMove={e => { if (drag.current && onPinChange) { onPinChange(drag.current, snapPoint(toMap(e.clientX, e.clientY), false)); return; } if (pan.current) { const r = ref.current!.getBoundingClientRect(); setView(v => ({ ...v, tx: pan.current!.tx + (e.clientX - pan.current!.x) / r.width * 1000, ty: pan.current!.ty + (e.clientY - pan.current!.y) / r.height * 1000 })); } }}
      onPointerUp={() => { drag.current = null; pan.current = null; }} onPointerLeave={() => { pan.current = null; }}>
      {src ? <ValImage src={src} alt="Minimap" kind="minimap" className="ll-minimap__img" imgClassName="ll-minimap__img" loading="eager" /> : <div className="ll-minimap__placeholder" />}
      <svg className="ll-minimap__svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <defs><marker id="ll-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke" /></marker></defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          {contextLineups.map(l => { const p = l.landPos ?? l.stand1Pos; return p ? <circle key={`ctx-${l.id}`} cx={p.x * 1000} cy={p.y * 1000} r={7} fill="none" stroke="var(--ll-muted)" strokeOpacity={0.35} strokeWidth={2} /> : null; })}
          {siteLabels.map(s => <text key={s.site} x={s.x} y={s.y - 28} textAnchor="middle" className="ll-minimap__site">{s.site}</text>)}
          {lineups.map(l => <MapMarker key={l.id} lineup={l} icon={abilityIcons[`${l.agentUuid}:${l.abilitySlot}`]} selected={l.id === selectedId} hovered={l.id === hover} size={markerSize} showLine={lines && (l.id === selectedId || l.id === hover)} onSelect={onSelect} onHover={id => { setHover(id); onHover?.(id); }} />)}
          {editablePins && Object.entries(editablePins).map(([key, p]) => p ? <g key={key} data-marker>
            <circle cx={p.x * 1000} cy={p.y * 1000} r={14} fill={key === 'landPos' ? 'var(--ll-accent)' : key.startsWith('aim') ? 'var(--ll-warning)' : 'var(--ll-defense)'} stroke="#fff" strokeWidth={3} style={{ cursor: 'move' }} onPointerDown={e => { e.stopPropagation(); drag.current = key; (e.target as Element).setPointerCapture?.(e.pointerId); }} />
            <text x={p.x * 1000 + 18} y={p.y * 1000 - 12} fill="#fff" fontSize={20} fontFamily="var(--ll-font-display)">{key.replace('Pos', '')}</text>
          </g> : null)}
        </g>
      </svg>
      {lineups.length === 0 && emptyMessage && <div className="ll-minimap__empty">{emptyMessage}</div>}
    </div>
    {showToolbar && <div className="ll-minimap__toolbar">
      <Tooltip label="Zoom in"><IconButton label="Zoom in" onClick={() => setView(v => ({ ...v, scale: Math.min(6, v.scale * 1.2) }))}><Plus size={16} /></IconButton></Tooltip>
      <Tooltip label="Zoom out"><IconButton label="Zoom out" onClick={() => setView(v => ({ ...v, scale: Math.max(1, v.scale / 1.2) }))}><Minus size={16} /></IconButton></Tooltip>
      <Tooltip label="Reset view"><IconButton label="Reset map view" onClick={reset}><Maximize size={16} /></IconButton></Tooltip>
      <Tooltip label={lines ? 'Hide throw lines' : 'Show throw lines'}><IconButton label="Toggle throw lines" className={lines ? 'is-active' : ''} onClick={() => setLines(x => !x)}><Route size={16} /></IconButton></Tooltip>
      <Tooltip label="Marker size"><label className="ll-minimap__size"><Crosshair size={14} /><input aria-label="Marker size" type="range" min={0.7} max={1.6} step={0.1} value={markerSize} onChange={e => setMarkerSize(Number(e.target.value))} /></label></Tooltip>
    </div>}
    <div className="ll-minimap__legend"><span><i style={{ background: 'var(--ll-attack)' }} /> Attack</span><span><i style={{ background: 'var(--ll-defense)' }} /> Defense</span><span><i style={{ background: 'var(--ll-muted)' }} /> Both</span></div>
  </div>;
}
const MapMarker = memo(function MapMarker({ lineup: l, icon, selected, hovered, size, showLine, onSelect, onHover }: { lineup: Lineup; icon?: string; selected: boolean; hovered: boolean; size: number; showLine: boolean; onSelect?(id: string): void; onHover(id: string | null): void }) {
  const cached = useCachedImage(icon, 'ability');
  const p = l.landPos ?? l.stand1Pos; if (!p) return null;
  const color = SIDE_COLOR[l.side] ?? SIDE_COLOR.both; const r = (selected ? 30 : hovered ? 26 : 22) * size; const x = p.x * 1000, y = p.y * 1000;
  return <g data-marker className="ll-minimap__marker" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onSelect?.(l.id); }} onMouseEnter={() => onHover(l.id)} onMouseLeave={() => onHover(null)}>
    {(showLine || selected) && l.stand1Pos && l.landPos && <line x1={l.stand1Pos.x * 1000} y1={l.stand1Pos.y * 1000} x2={l.landPos.x * 1000} y2={l.landPos.y * 1000} stroke={selected ? '#ECE8E1' : color} strokeWidth={selected ? 3 : 2} strokeDasharray="7 5" markerEnd="url(#ll-arrow)" opacity={0.9} />}
    {l.bounces.map((b, i) => <rect key={i} x={b.x * 1000 - 7} y={b.y * 1000 - 7} width={14} height={14} transform={`rotate(45 ${b.x * 1000} ${b.y * 1000})`} fill={color} stroke="#0E1015" strokeWidth={2} />)}
    <circle cx={x} cy={y} r={r + 5} fill="#0E1015" opacity={0.85} />
    <circle cx={x} cy={y} r={r} fill="var(--ll-raised)" stroke={color} strokeWidth={selected ? 4 : 3} />
    {cached.src && <image href={cached.src} x={x - r * 0.7} y={y - r * 0.7} width={r * 1.4} height={r * 1.4} preserveAspectRatio="xMidYMid meet" />}
    {l.isFavorite && <circle cx={x + r * 0.8} cy={y - r * 0.8} r={4} fill="var(--ll-warning)" stroke="#0E1015" strokeWidth={1.5} />}
  </g>;
});
