import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Crosshair, Footprints, Maximize, Minus, Plus, Route, SlidersHorizontal, Target, Type } from 'lucide-react';
import type { Lineup, MapCallout, Point } from '../types';
import { clampPoint, constrainMapPan, snapPoint, zoomMapAt, type MapView } from '../lib/geometry';
import { useCachedImage, ValImage } from '../lib/images';
import { IconButton, Tooltip } from './ui';

export type PinKey = 'stand1Pos' | 'aim1Pos' | 'stand2Pos' | 'aim2Pos' | 'landPos';
export interface MinimapProps {
  src?: string; lineups: Lineup[]; selectedId?: string | null; onSelect?(id: string): void; onHover?(id: string | null): void;
  editablePins?: Partial<Record<PinKey, Point | null>>; editableBounces?: Point[]; onPinChange?(key: string, p: Point): void; className?: string;
  abilityIcons?: Record<string, string>; markerScale?: number; showToolbar?: boolean; emptyMessage?: ReactNode; contextLineups?: Lineup[];
  activePinTool?: PinKey | 'bounces' | null; onMapClick?(p: Point): void; callouts?: MapCallout[];
}
const SIDE_COLOR: Record<string, string> = { attack: 'var(--ll-attack)', defense: 'var(--ll-defense)', both: 'var(--ll-muted)' };
// Never dereference this ref inside a React state updater: pointerup/lostcapture may
// clear it before a queued continuous-priority pointermove updater executes.
type Gesture = { id: number; kind: 'pan' | 'pin'; pin?: string; x: number; y: number; view: MapView; moved: boolean };
const ORIGIN: MapView = { scale: 1, tx: 0, ty: 0 };

/** The bitmap is laid out again at each zoom size; only translation is composited.
 * Scaling a small CSS compositor layer made both the art and SVG icons look rasterized.
 * SVG geometry is resolved at the current canvas size, not enlarged from a screenshot.
 */
export function Minimap({ src, lineups, selectedId, onSelect, onHover, editablePins, editableBounces = [], onPinChange, className = '', abilityIcons = {}, markerScale = 1, showToolbar = true, emptyMessage, contextLineups = [], activePinTool, onMapClick, callouts = [] }: MinimapProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const arrowId = `map-arrow-${useId().replace(/:/g, '')}`;
  const [side, setSide] = useState(0);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<MapView>(ORIGIN);
  const [hover, setHover] = useState<string | null>(null);
  const [markerSize, setMarkerSize] = useState(1);
  const [lines, setLines] = useState(true);
  const [showStand, setShowStand] = useState(true);
  const [showLand, setShowLand] = useState(true);
  const [labels, setLabels] = useState(false);
  const [nativeSize, setNativeSize] = useState('');
  const clearGesture = useCallback(() => { gesture.current = null; }, []);
  useLayoutEffect(() => {
    const el = stageRef.current; if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const width = Math.max(0, r.width), height = Math.max(0, r.height);
      const next = Math.max(0, Math.min(width, height));
      setStageSize({ width, height }); setSide(next); setView(v => constrainMapPan(v, next, width, height));
    };
    const ro = new ResizeObserver(measure); ro.observe(el); measure();
    window.addEventListener('blur', clearGesture);
    return () => { ro.disconnect(); window.removeEventListener('blur', clearGesture); clearGesture(); };
  }, [clearGesture]);
  const baseLeft = (stageSize.width - side) / 2, baseTop = (stageSize.height - side) / 2;
  useEffect(() => { setNativeSize(''); }, [src]);
  const toMap = useCallback((x: number, y: number): Point => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r || !side) return { x: 0, y: 0 };
    const left = r.left + (r.width - side) / 2, top = r.top + (r.height - side) / 2;
    return clampPoint({ x: (x - left - view.tx) / (side * view.scale), y: (y - top - view.ty) / (side * view.scale) });
  }, [side, view]);
  const zoom = useCallback((factor: number, px?: number, py?: number) => {
    setView(v => zoomMapAt(v, factor, px ?? side / 2, py ?? side / 2, side, stageSize.width || side, stageSize.height || side));
  }, [side, stageSize]);
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); clearGesture();
      const r = el.getBoundingClientRect(), s = Math.min(r.width, r.height);
      zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left - (r.width - s) / 2, e.clientY - r.top - (r.height - s) / 2);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [zoom, clearGesture]);
  const capture = (e: ReactPointerEvent<HTMLDivElement>) => {
    try { if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Synthetic/already-cancelled pointers need no capture. */ }
  };
  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    try { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* Capture may already be lost. */ }
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault(); clearGesture();
    if (activePinTool && onMapClick && !(e.target as Element).closest('[data-pin]')) {
      onMapClick(snapPoint(toMap(e.clientX, e.clientY), false)); return;
    }
    const pin = (e.target as Element).closest('[data-pin]')?.getAttribute('data-pin');
    gesture.current = { id: e.pointerId, kind: pin && onPinChange ? 'pin' : 'pan', pin: pin ?? undefined, x: e.clientX, y: e.clientY, view: { ...view }, moved: false };
    capture(e);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current; if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (Math.hypot(dx, dy) > 4) g.moved = true;
    if (!g.moved) return;
    if (g.kind === 'pin' && g.pin && onPinChange) { onPinChange(g.pin, snapPoint(toMap(e.clientX, e.clientY), false)); return; }
    // g is an immutable local snapshot. No nullable ref access survives into the updater.
    setView(v => constrainMapPan({ ...v, tx: g.view.tx + dx, ty: g.view.ty + dy }, side, stageSize.width || side, stageSize.height || side));
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current; if (!g || g.id !== e.pointerId) return;
    clearGesture(); release(e);
    if (g.kind !== 'pan' || g.moved || activePinTool || !onSelect) return;
    const r = stageRef.current?.getBoundingClientRect(); if (!r || !side) return;
    const x = (e.clientX - r.left - (r.width - side) / 2 - g.view.tx) / (side * g.view.scale);
    const y = (e.clientY - r.top - (r.height - side) / 2 - g.view.ty) / (side * g.view.scale);
    let best: { id: string; d: number } | null = null;
    for (const l of safeLineups) for (const q of [showLand ? l.landPos : null, showStand ? l.stand1Pos : null]) {
      if (!q) continue;
      const d = Math.hypot((q.x - x) * side * g.view.scale, (q.y - y) * side * g.view.scale);
      if (d <= Math.max(24, 22 * markerScale) && (!best || d < best.d)) best = { id: l.id, d };
    }
    if (best) onSelect(best.id);
  };
  const safeLineups = useMemo(() => lineups.filter(l => l && (l.landPos ?? l.stand1Pos)), [lineups]);
  const visibleCallouts = useMemo(() => {
    if (!labels || !side) return [];
    const occupied: { x: number; y: number; w: number }[] = [];
    const font = 11 * 1000 / (side * view.scale);
    for (const c of callouts) {
      const x = c.x * side * view.scale, y = c.y * side * view.scale, w = c.name.length * 6.3;
      if (x < 0 || y < 12 || x > side * view.scale || y > side * view.scale) continue;
      if (occupied.some(o => Math.abs(o.y - y) < 14 && Math.abs(o.x - x) < (o.w + w) / 2 + 5)) continue;
      occupied.push({ x, y, w });
    }
    return callouts.filter(c => occupied.some(o => Math.abs(o.x - c.x * side * view.scale) < 0.01 && Math.abs(o.y - c.y * side * view.scale) < 0.01)).map(c => ({ ...c, font }));
  }, [labels, callouts, side, view.scale]);
  const pins = editablePins ? Object.entries(editablePins).filter(([k]) => !k.startsWith('aim')) : [];
  const canvasSide = side * view.scale;
  return <div className={`ll-minimap ${className}`} data-testid="minimap" data-scale={view.scale.toFixed(3)} data-native-size={nativeSize || undefined}>
    <div ref={stageRef} className="ll-minimap__stage" tabIndex={-1} data-testid="minimap-stage" style={{ touchAction: 'none', cursor: activePinTool ? 'crosshair' : 'grab' }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={clearGesture} onLostPointerCapture={clearGesture}
      onSelectCapture={e => e.preventDefault()} onDragStart={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}>
      <div className="ll-minimap__canvas" data-testid="minimap-canvas" style={{ left: baseLeft, top: baseTop, width: canvasSide, height: canvasSide, transform: `translate(${view.tx}px, ${view.ty}px)` }}>
        {src ? <ValImage src={src} alt="Minimap" kind="minimap" className="ll-minimap__img" imgClassName="ll-minimap__img" loading="eager" onLoad={img => setNativeSize(`${img.naturalWidth}x${img.naturalHeight}`)} /> : <div className="ll-minimap__placeholder" />}
        <svg className="ll-minimap__svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" role={onSelect ? 'group' : undefined} aria-label={onSelect ? 'Lineup markers' : undefined} aria-hidden={onSelect ? undefined : true}>
          <defs><marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke" /></marker></defs>
          {contextLineups.map(l => { const p = l.landPos ?? l.stand1Pos; return p ? <circle key={`ctx-${l.id}`} cx={p.x * 1000} cy={p.y * 1000} r={7 / view.scale} fill="none" stroke="var(--ll-muted)" strokeOpacity={0.35} strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> : null; })}
          {labels && <g data-testid="map-callouts" aria-label="Map callouts">{visibleCallouts.map(c => <text key={`${c.name}-${c.x}-${c.y}`} x={c.x * 1000} y={c.y * 1000} textAnchor="middle" fontSize={c.font} className="ll-minimap__callout">{c.name}</text>)}</g>}
          {safeLineups.map(l => <MapMarker key={l.id} lineup={l} icon={abilityIcons[`${l.agentUuid}:${l.abilitySlot}`]} selected={l.id === selectedId} hovered={l.id === hover} size={markerSize * markerScale / Math.sqrt(view.scale)} showLine={lines} showStand={showStand} showLand={showLand} onSelect={onSelect} onHover={id => { setHover(id); onHover?.(id); }} hitSide={side} viewScale={view.scale} arrowId={arrowId} />)}
          {editableBounces.map((b, i) => <rect key={`eb-${i}`} x={b.x * 1000 - 8} y={b.y * 1000 - 8} width={16} height={16} transform={`rotate(45 ${b.x * 1000} ${b.y * 1000})`} fill="var(--ll-warning)" stroke="#0E1015" strokeWidth={2} />)}
          {pins.map(([key, p]) => p ? <g key={key} data-marker data-pin={key} style={{ cursor: 'move' }}>
            <circle cx={p.x * 1000} cy={p.y * 1000} r={12 / view.scale} fill={key === 'landPos' ? 'var(--ll-accent)' : 'var(--ll-defense)'} stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <circle cx={p.x * 1000} cy={p.y * 1000} r={22 / view.scale} fill="transparent" pointerEvents="all" />
          </g> : null)}
        </svg>
      </div>
      {lineups.length === 0 && !activePinTool && emptyMessage && <div className="ll-minimap__empty" onPointerDown={e => e.stopPropagation()}>{emptyMessage}</div>}
    </div>
    {showToolbar && <div className="ll-minimap__toolbar" onPointerDown={e => e.stopPropagation()}>
      <Tooltip label="Zoom in"><IconButton label="Zoom in" onClick={() => zoom(1.2)}><Plus size={16} /></IconButton></Tooltip>
      <Tooltip label="Zoom out"><IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}><Minus size={16} /></IconButton></Tooltip>
      <Tooltip label="Reset view"><IconButton label="Reset map view" onClick={() => { clearGesture(); setView(ORIGIN); }}><Maximize size={16} /></IconButton></Tooltip>
      <Tooltip label={lines ? 'Hide throw paths' : 'Show all throw paths'}><IconButton label="Toggle throw lines" aria-pressed={lines} className={lines ? 'is-active' : ''} onClick={() => setLines(x => !x)}><Route size={16} /></IconButton></Tooltip>
      <Tooltip label={callouts.length ? 'Callout names' : 'No callouts for this map'}><IconButton label="Toggle callout names" aria-pressed={labels} disabled={!callouts.length} className={labels ? 'is-active' : ''} onClick={() => setLabels(x => !x)}><Type size={16} /></IconButton></Tooltip>
      <details className="ll-minimap__settings"><summary aria-label="Map display settings" title="Map display"><SlidersHorizontal size={16} /></summary><div className="ll-minimap__settings-panel">
        <button type="button" aria-label="Toggle stand positions" aria-pressed={showStand} onClick={() => setShowStand(x => !x)}><Footprints size={15} /> Start points</button>
        <button type="button" aria-label="Toggle landing positions" aria-pressed={showLand} onClick={() => setShowLand(x => !x)}><Target size={15} /> Landing points</button>
        <label><Crosshair size={15} /><input aria-label="Marker size" type="range" min={0.7} max={1.6} step={0.1} value={markerSize} onChange={e => setMarkerSize(Number(e.target.value))} /></label>
      </div></details>
    </div>}
  </div>;
}
const MapMarker = memo(function MapMarker({ lineup: l, icon, selected, hovered, size, showLine, showStand, showLand, onSelect, onHover, hitSide, viewScale, arrowId }: { lineup: Lineup; icon?: string; selected: boolean; hovered: boolean; size: number; showLine: boolean; showStand: boolean; showLand: boolean; onSelect?(id: string): void; onHover(id: string | null): void; hitSide: number; viewScale: number; arrowId: string }) {
  const cached = useCachedImage(icon, 'ability');
  const land = l.landPos, stand = l.stand1Pos, p = land ?? stand; if (!p) return null;
  const color = SIDE_COLOR[l.side] ?? SIDE_COLOR.both;
  const r = (selected ? 28 : hovered ? 25 : 22) * size, x = p.x * 1000, y = p.y * 1000;
  const bounces = Array.isArray(l.bounces) ? l.bounces : [];
  const path = [stand, ...bounces, land].filter((q): q is NonNullable<typeof q> => !!q).map(q => `${q.x * 1000},${q.y * 1000}`).join(' ');
  const secondPath = l.stand2Pos && (l.aim2Pos ?? land) ? `${l.stand2Pos.x * 1000},${l.stand2Pos.y * 1000} ${(l.aim2Pos ?? land)!.x * 1000},${(l.aim2Pos ?? land)!.y * 1000}` : '';
  const minHit = hitSide > 0 ? 24 * 1000 / (hitSide * viewScale) : 24;
  return <g data-marker className="ll-minimap__marker" style={{ cursor: onSelect ? 'pointer' : 'default' }} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? `Open ${l.title || 'lineup'}` : undefined}
    onKeyDown={onSelect ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect(l.id); } } : undefined}
    onMouseEnter={() => onHover(l.id)} onMouseLeave={() => onHover(null)}>
    {showLine && path && <polyline data-testid="throw-path" points={path} fill="none" stroke={selected ? '#ECE8E1' : color} strokeWidth={selected ? 2.5 : 1.5} strokeDasharray="7 5" markerEnd={`url(#${arrowId})`} opacity={0.9} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
    {showLine && secondPath && <polyline data-testid="throw-path" points={secondPath} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3 5" opacity={0.8} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
    {bounces.map((b, i) => <rect key={i} x={b.x * 1000 - 4} y={b.y * 1000 - 4} width={8} height={8} transform={`rotate(45 ${b.x * 1000} ${b.y * 1000})`} fill={color} stroke="#0E1015" strokeWidth={1} pointerEvents="none" />)}
    {showStand && stand && <g data-testid="stand-marker"><circle cx={stand.x * 1000} cy={stand.y * 1000} r={8 * size} fill="var(--ll-defense)" stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" /><text x={stand.x * 1000 + 11 * size} y={stand.y * 1000 - 9 * size} fill="#fff" fontSize={13 * size} fontFamily="var(--ll-font-display)">S</text></g>}
    {showLand && land && <g data-testid="land-marker"><circle cx={x} cy={y} r={r + 3} fill="#0E1015" opacity={0.85} /><circle cx={x} cy={y} r={r} fill="var(--ll-raised)" stroke={color} strokeWidth={selected ? 3 : 2} vectorEffect="non-scaling-stroke" />
      {cached.src && <image href={cached.src} x={x - r * 0.7} y={y - r * 0.7} width={r * 1.4} height={r * 1.4} preserveAspectRatio="xMidYMid meet" />}
      {l.isFavorite && <circle cx={x + r * 0.8} cy={y - r * 0.8} r={3} fill="var(--ll-warning)" stroke="#0E1015" strokeWidth={1} />}</g>}
    {onSelect && <circle cx={x} cy={y} r={Math.max(r + 3, minHit)} fill="transparent" pointerEvents="all" />}
  </g>;
});
