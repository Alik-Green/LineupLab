import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Crosshair, Footprints, Maximize, Minus, Plus, Route, Target } from 'lucide-react';
import type { Lineup, Point } from '../types';
import { clampPoint, constrainMapPan, snapPoint, zoomMapAt } from '../lib/geometry';
import { useCachedImage, ValImage } from '../lib/images';
import { IconButton, Tooltip } from './ui';

export type PinKey = 'stand1Pos' | 'aim1Pos' | 'stand2Pos' | 'aim2Pos' | 'landPos';
export interface MinimapProps {
  src?: string; lineups: Lineup[]; selectedId?: string | null; onSelect?(id: string): void; onHover?(id: string | null): void;
  editablePins?: Partial<Record<PinKey, Point | null>>; editableBounces?: Point[]; onPinChange?(key: string, p: Point): void; className?: string;
  abilityIcons?: Record<string, string>; markerScale?: number; showToolbar?: boolean; emptyMessage?: ReactNode; contextLineups?: Lineup[]; activePinTool?: PinKey | 'bounces' | null; onMapClick?(p: Point): void;
}
const SIDE_COLOR: Record<string, string> = { attack: 'var(--ll-attack)', defense: 'var(--ll-defense)', both: 'var(--ll-muted)' };
/** Map art and markers share one square canvas, so object-fit letterboxing cannot offset pins. */
export function Minimap({ src, lineups, selectedId, onSelect, onHover, editablePins, editableBounces = [], onPinChange, className = '', abilityIcons = {}, markerScale = 1, showToolbar = true, emptyMessage, contextLineups = [], activePinTool, onMapClick }: MinimapProps) {
  const stageRef = useRef<HTMLDivElement>(null); const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null); const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [side, setSide] = useState(0); const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [hover, setHover] = useState<string | null>(null); const [markerSize, setMarkerSize] = useState(1);
  const [lines, setLines] = useState(true); const [showStand, setShowStand] = useState(true); const [showLand, setShowLand] = useState(true);
  useEffect(() => { const el = stageRef.current; if (!el) return; const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setSide(Math.max(0, Math.min(r.width, r.height))); }); ro.observe(el); const r = el.getBoundingClientRect(); setSide(Math.min(r.width, r.height)); return () => ro.disconnect(); }, []);
  const toMap = useCallback((clientX: number, clientY: number): Point => {
    const r = canvasRef.current?.getBoundingClientRect(); if (!r || !r.width || !r.height) return { x: 0, y: 0 };
    return clampPoint({ x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height });
  }, []);
  const zoom = useCallback((factor: number, px?: number, py?: number) => { setView(v => zoomMapAt(v, factor, px ?? side / 2, py ?? side / 2, side)); }, [side]);
  useEffect(() => { const el = stageRef.current; if (!el) return; const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); const s = Math.min(r.width, r.height); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left - (r.width - s) / 2, e.clientY - r.top - (r.height - s) / 2); }; el.addEventListener('wheel', onWheel, { passive: false }); return () => el.removeEventListener('wheel', onWheel); }, [zoom]);
  const siteLabels = useMemo(() => { const groups = new Map<string, { x: number; y: number; n: number }>(); for (const l of lineups) { const p = l.landPos ?? l.stand1Pos; if (!p || !l.site) continue; const g = groups.get(l.site) ?? { x: 0, y: 0, n: 0 }; g.x += p.x; g.y += p.y; g.n++; groups.set(l.site, g); } return [...groups.entries()].map(([site, g]) => ({ site, x: g.x / g.n * 1000, y: g.y / g.n * 1000 })); }, [lineups]);
  const reset = () => setView({ scale: 1, tx: 0, ty: 0 });
  const pins = editablePins ? Object.entries(editablePins).filter(([k]) => !k.startsWith('aim')) : [];
  return <div className={`ll-minimap ${className}`} data-testid="minimap" data-scale={view.scale.toFixed(3)}>
    <div ref={stageRef} className="ll-minimap__stage" style={{ touchAction: 'none', cursor: activePinTool ? 'crosshair' : 'grab' }}
      onPointerDown={e => { if ((e.target as Element).closest('[data-marker]')) return; if (activePinTool && onMapClick) { onMapClick(snapPoint(toMap(e.clientX, e.clientY), false)); return; } pan.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }; e.currentTarget.setPointerCapture?.(e.pointerId); }}
      onPointerMove={e => { if (drag.current && onPinChange) { onPinChange(drag.current, snapPoint(toMap(e.clientX, e.clientY), false)); return; } if (pan.current) setView(v => ({ ...v, ...constrainMapPan({ ...v, tx: pan.current!.tx + e.clientX - pan.current!.x, ty: pan.current!.ty + e.clientY - pan.current!.y }, side) })); }}
      onPointerUp={() => { drag.current = null; pan.current = null; }} onPointerCancel={() => { drag.current = null; pan.current = null; }}>
      <div ref={canvasRef} className="ll-minimap__canvas" data-testid="minimap-canvas" style={{ width: side, height: side, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}>
        {src ? <ValImage src={src} alt="Minimap" kind="minimap" className="ll-minimap__img" imgClassName="ll-minimap__img" loading="eager" /> : <div className="ll-minimap__placeholder" />}
        <svg className="ll-minimap__svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" role={onSelect ? 'group' : undefined} aria-label={onSelect ? 'Lineup markers' : undefined} aria-hidden={onSelect ? undefined : true}>
          <defs><marker id="ll-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke" /></marker></defs>
          {contextLineups.map(l => { const p = l.landPos ?? l.stand1Pos; return p ? <circle key={`ctx-${l.id}`} cx={p.x * 1000} cy={p.y * 1000} r={7} fill="none" stroke="var(--ll-muted)" strokeOpacity={0.35} strokeWidth={2} /> : null; })}
          {siteLabels.map(s => <text key={s.site} x={s.x} y={s.y - 28} textAnchor="middle" className="ll-minimap__site">{s.site}</text>)}
          {lineups.map(l => <MapMarker key={l.id} lineup={l} icon={abilityIcons[`${l.agentUuid}:${l.abilitySlot}`]} selected={l.id === selectedId} hovered={l.id === hover} size={markerSize * markerScale} showLine={lines && (l.id === selectedId || l.id === hover)} showStand={showStand} showLand={showLand} onSelect={onSelect} onHover={id => { setHover(id); onHover?.(id); }} />)}
          {editableBounces.map((b, i) => <rect key={`eb-${i}`} x={b.x * 1000 - 8} y={b.y * 1000 - 8} width={16} height={16} transform={`rotate(45 ${b.x * 1000} ${b.y * 1000})`} fill="var(--ll-warning)" stroke="#0E1015" strokeWidth={2} />)}
          {pins.map(([key, p]) => p ? <g key={key} data-marker>
            <circle cx={p.x * 1000} cy={p.y * 1000} r={14} fill={key === 'landPos' ? 'var(--ll-accent)' : 'var(--ll-defense)'} stroke="#fff" strokeWidth={3} style={{ cursor: 'move' }} onPointerDown={e => { e.stopPropagation(); drag.current = key; (e.target as Element).setPointerCapture?.(e.pointerId); }} />
            <text x={p.x * 1000 + 18} y={p.y * 1000 - 12} fill="#fff" fontSize={20} fontFamily="var(--ll-font-display)">{key === 'stand1Pos' ? 'stand' : key === 'stand2Pos' ? 'stand 2' : 'land'}</text>
          </g> : null)}
        </svg>
      </div>
      {lineups.length === 0 && emptyMessage && <div className="ll-minimap__empty" onPointerDown={e => e.stopPropagation()}>{emptyMessage}</div>}
    </div>
    {showToolbar && <div className="ll-minimap__toolbar">
      <Tooltip label="Zoom in"><IconButton label="Zoom in" onClick={() => zoom(1.2)}><Plus size={16} /></IconButton></Tooltip>
      <Tooltip label="Zoom out"><IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}><Minus size={16} /></IconButton></Tooltip>
      <Tooltip label="Reset view"><IconButton label="Reset map view" onClick={reset}><Maximize size={16} /></IconButton></Tooltip>
      <Tooltip label={lines ? 'Hide throw lines' : 'Show throw lines'}><IconButton label="Toggle throw lines" className={lines ? 'is-active' : ''} onClick={() => setLines(x => !x)}><Route size={16} /></IconButton></Tooltip>
      <Tooltip label={showStand ? 'Hide stand positions' : 'Show stand positions'}><IconButton label="Toggle stand positions" className={showStand ? 'is-active' : ''} onClick={() => setShowStand(x => !x)}><Footprints size={16} /></IconButton></Tooltip>
      <Tooltip label={showLand ? 'Hide landing positions' : 'Show landing positions'}><IconButton label="Toggle landing positions" className={showLand ? 'is-active' : ''} onClick={() => setShowLand(x => !x)}><Target size={16} /></IconButton></Tooltip>
      <Tooltip label="Marker size"><label className="ll-minimap__size"><Crosshair size={14} /><input aria-label="Marker size" type="range" min={0.7} max={1.6} step={0.1} value={markerSize} onChange={e => setMarkerSize(Number(e.target.value))} /></label></Tooltip>
    </div>}
    <div className="ll-minimap__legend"><span><i style={{ background: 'var(--ll-attack)' }} /> Attack</span><span><i style={{ background: 'var(--ll-defense)' }} /> Defense</span><span><i style={{ background: 'var(--ll-muted)' }} /> Both</span></div>
  </div>;
}
const MapMarker = memo(function MapMarker({ lineup: l, icon, selected, hovered, size, showLine, showStand, showLand, onSelect, onHover }: { lineup: Lineup; icon?: string; selected: boolean; hovered: boolean; size: number; showLine: boolean; showStand: boolean; showLand: boolean; onSelect?(id: string): void; onHover(id: string | null): void }) {
  const cached = useCachedImage(icon, 'ability');
  const land = l.landPos; const stand = l.stand1Pos; const p = land ?? stand; if (!p) return null;
  const color = SIDE_COLOR[l.side] ?? SIDE_COLOR.both; const r = (selected ? 30 : hovered ? 26 : 22) * size; const x = p.x * 1000, y = p.y * 1000;
  return <g data-marker className="ll-minimap__marker" style={{ cursor: onSelect ? 'pointer' : 'default' }} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? `Open ${l.title || 'lineup'}` : undefined} onKeyDown={onSelect ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(l.id); } } : undefined} onClick={e => { e.stopPropagation(); onSelect?.(l.id); }} onMouseEnter={() => onHover(l.id)} onMouseLeave={() => onHover(null)}>
    {showLine && stand && land && <line x1={stand.x * 1000} y1={stand.y * 1000} x2={land.x * 1000} y2={land.y * 1000} stroke={selected ? '#ECE8E1' : color} strokeWidth={selected ? 3 : 2} strokeDasharray="7 5" markerEnd="url(#ll-arrow)" opacity={0.9} />}
    {l.bounces.map((b, i) => <rect key={i} x={b.x * 1000 - 7} y={b.y * 1000 - 7} width={14} height={14} transform={`rotate(45 ${b.x * 1000} ${b.y * 1000})`} fill={color} stroke="#0E1015" strokeWidth={2} />)}
    {showStand && stand && <g data-testid="stand-marker"><circle cx={stand.x * 1000} cy={stand.y * 1000} r={10 * size} fill="var(--ll-defense)" stroke="#fff" strokeWidth={2} /><text x={stand.x * 1000 + 13 * size} y={stand.y * 1000 - 10 * size} fill="#fff" fontSize={16 * size} fontFamily="var(--ll-font-display)">S</text></g>}
    {showLand && land && <g data-testid="land-marker"><circle cx={x} cy={y} r={r + 5} fill="#0E1015" opacity={0.85} /><circle cx={x} cy={y} r={r} fill="var(--ll-raised)" stroke={color} strokeWidth={selected ? 4 : 3} />
      {cached.src && <image href={cached.src} x={x - r * 0.7} y={y - r * 0.7} width={r * 1.4} height={r * 1.4} preserveAspectRatio="xMidYMid meet" />}
      {l.isFavorite && <circle cx={x + r * 0.8} cy={y - r * 0.8} r={4} fill="var(--ll-warning)" stroke="#0E1015" strokeWidth={1.5} />}</g>}
    {onSelect && <circle cx={x} cy={y} r={Math.max(r + 5, 70 * size)} fill="transparent" style={{ pointerEvents: 'all' }} />}
  </g>;
});
