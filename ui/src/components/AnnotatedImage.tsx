import { useEffect, useId, useRef, useState } from 'react';
import type { AnnotationLine, FocusCircle, Point, SlotData } from '../types';
import { clampLens, clampPoint, dashArray, lensSource, snapPoint } from '../lib/geometry';
import { useCachedImage, ValImage } from '../lib/images';

export type AnnotationTool = 'select' | 'circle' | 'lens' | 'line';
export interface AnnotatedImageProps {
  src: string; slot?: SlotData; editable?: boolean; tool?: AnnotationTool; color?: string; snapping?: boolean;
  selectedId?: string | null; onSelect?(id: string | null): void;
  onChange?(slot: SlotData): void; className?: string; alt?: string; hideLens?: boolean;
}
interface DragState { kind: 'circle' | 'lens' | 'line-point'; id: string; index?: number; start: Point; origin: Point }

/** Non-destructive annotation renderer shared by browse, editor and overlay. */
export function AnnotatedImage({ src, slot, editable = false, tool = 'select', color = 'cyan', snapping = false, selectedId, onSelect, onChange, className = '', alt = '', hideLens = false }: AnnotatedImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1600, h: 900 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pendingLine, setPendingLine] = useState<Point[]>([]);
  const clipId = useId().replace(/:/g, '');
  const cached = useCachedImage(src, 'media');
  const imageSrc = cached.src ?? src;
  const circles = slot?.circles ?? []; const lines = slot?.lines ?? [];
  useEffect(() => { if (!imageSrc) return; const img = new Image(); img.onload = () => setSize({ w: img.naturalWidth || 1600, h: img.naturalHeight || 900 }); img.src = imageSrc; }, [imageSrc]);
  const pointFromEvent = (e: React.PointerEvent | React.MouseEvent): Point => {
    const r = ref.current!.getBoundingClientRect();
    return snapPoint({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }, snapping);
  };
  const emit = (next: SlotData) => onChange?.({ image: slot?.image ?? null, circles: next.circles, lines: next.lines, ...Object.fromEntries(Object.entries(slot ?? {}).filter(([k]) => !['image', 'circles', 'lines'].includes(k))) });
  const updateCircle = (id: string, patch: Partial<FocusCircle>) => emit({ ...slot!, circles: circles.map(c => c.id === id ? clampLens({ ...c, ...patch }, size.w, size.h) : c), lines });
  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable || !slot) return;
    const p = pointFromEvent(e);
    if (tool === 'circle' || tool === 'lens') {
      const c = { id: crypto.randomUUID(), color, x: p.x, y: p.y, radius: 0.025, showZoom: tool === 'lens', zoomScale: 3.5, zoomSize: 0.24, zoomX: 0.72, zoomY: 0.04 };
      emit({ ...slot, circles: [...circles, c], lines }); onSelect?.(c.id); return;
    }
    if (tool === 'line') { setPendingLine(prev => [...prev, p]); return; }
  };
  const finishLine = () => { if (pendingLine.length >= 2 && slot) { emit({ ...slot, circles, lines: [...lines, { id: crypto.randomUUID(), color, width: 0.003, points: pendingLine, style: 'solid', arrow: 'none', label: null }] }); } setPendingLine([]); };
  const startDrag = (e: React.PointerEvent, kind: DragState['kind'], id: string, origin: Point, index?: number) => {
    if (!editable) return; e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); onSelect?.(id); setDrag({ kind, id, index, start: pointFromEvent(e), origin });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !slot) return; const p = pointFromEvent(e); const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (drag.kind === 'circle') updateCircle(drag.id, { x: clampPoint({ x: drag.origin.x + dx, y: drag.origin.y + dy }).x, y: clampPoint({ x: drag.origin.x + dx, y: drag.origin.y + dy }).y });
    else if (drag.kind === 'lens') { const c = circles.find(c => c.id === drag.id); if (c) updateCircle(drag.id, { zoomX: drag.origin.x + dx, zoomY: drag.origin.y + dy }); }
    else emit({ ...slot, circles, lines: lines.map(l => l.id === drag.id ? { ...l, points: l.points.map((pt, i) => i === drag.index ? clampPoint({ x: drag.origin.x + dx, y: drag.origin.y + dy }) : pt) } : l) });
  };
  const { w, h } = size;
  return (
    <div ref={ref} className={`ll-annotated relative select-none overflow-hidden ${editable ? 'cursor-crosshair' : ''} ${className}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => setDrag(null)} onDoubleClick={finishLine} data-testid="annotated-image">
      <ValImage src={src} alt={alt} kind="media" className="block w-full" imgClassName="block h-auto w-full" onLoad={img => setSize({ w: img.naturalWidth || 1600, h: img.naturalHeight || 900 })} />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          {circles.filter(c => c.showZoom && !hideLens).map(c => { const lc = clampLens(c, w, h); return <clipPath key={c.id} id={`${clipId}-${c.id}`}><rect x={lc.zoomX * w} y={lc.zoomY * h} width={lc.zoomSize * w} height={lc.zoomSize * w} /></clipPath>; })}
        </defs>
        {lines.map(l => <g key={l.id}>
          <polyline points={l.points.map(p => `${p.x * w},${p.y * h}`).join(' ')} fill="none" stroke={l.color} strokeWidth={l.width * w} strokeDasharray={dashArray(l, w)} strokeLinecap="round" strokeLinejoin="round" />
          {(l.arrow === 'end' || l.arrow === 'both') && l.points.length >= 2 && <ArrowHead a={l.points[l.points.length - 2]} b={l.points[l.points.length - 1]} w={w} h={h} color={l.color} width={l.width * w} />}
          {(l.arrow === 'start' || l.arrow === 'both') && l.points.length >= 2 && <ArrowHead a={l.points[1]} b={l.points[0]} w={w} h={h} color={l.color} width={l.width * w} />}
          {l.label && l.points[0] && <text x={l.points[0].x * w} y={l.points[0].y * h - l.width * w * 3} fill={l.color} fontSize={Math.max(12, w * 0.018)}>{l.label}</text>}
        </g>)}
        {pendingLine.length > 0 && <polyline points={pendingLine.map(p => `${p.x * w},${p.y * h}`).join(' ')} fill="none" stroke={color} strokeWidth={0.003 * w} strokeDasharray="8 6" />}
        {circles.map(c => <g key={c.id}>
          <circle cx={c.x * w} cy={c.y * h} r={c.radius * w} fill="none" stroke={c.color} strokeWidth={Math.max(2, w * 0.0025)} />
          {selectedId === c.id && editable && <circle cx={c.x * w} cy={c.y * h} r={c.radius * w + 6} fill="none" stroke="white" strokeDasharray="6 4" strokeWidth={1.5} />}
        </g>)}
        {circles.filter(c => c.showZoom && !hideLens).map(c => { const lc = clampLens(c, w, h); const srcCrop = lensSource(lc, w, h); const lx = lc.zoomX * w, ly = lc.zoomY * h, ls = lc.zoomSize * w; const scale = lc.zoomScale;
          return <g key={`lens-${c.id}`} clipPath={`url(#${clipId}-${c.id})`}>
            <rect x={lx} y={ly} width={ls} height={ls} fill="var(--ll-bg)" />
            <image href={imageSrc} x={lx - srcCrop.x * w * scale} y={ly - srcCrop.y * h * scale} width={w * scale} height={h * scale} preserveAspectRatio="none" />
            <circle cx={lx + (c.x - srcCrop.x) * w * scale} cy={ly + (c.y - srcCrop.y) * h * scale} r={c.radius * w * scale} fill="none" stroke={c.color} strokeWidth={Math.max(2, w * 0.0025 * scale)} />
            <rect x={lx} y={ly} width={ls} height={ls} fill="none" stroke={c.color} strokeWidth={Math.max(2, w * 0.002)} />
          </g>; })}
      </svg>
      {editable && <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" onPointerDown={e => { if (tool === 'select') onSelect?.(null); }} style={{ pointerEvents: 'none' }}>
        {circles.map(c => <circle key={c.id} cx={c.x * w} cy={c.y * h} r={Math.max(c.radius * w, 40)} fill="transparent" style={{ pointerEvents: 'all', cursor: 'move' }} onPointerDown={e => startDrag(e, 'circle', c.id, { x: c.x, y: c.y })} />)}
        {circles.filter(c => c.showZoom && !hideLens).map(c => { const lc = clampLens(c, w, h); return <rect key={`hit-${c.id}`} x={lc.zoomX * w} y={lc.zoomY * h} width={lc.zoomSize * w} height={lc.zoomSize * w} fill="transparent" style={{ pointerEvents: 'all', cursor: 'move' }} onPointerDown={e => startDrag(e, 'lens', c.id, { x: lc.zoomX, y: lc.zoomY })} />; })}
        {lines.flatMap(l => l.points.map((p, i) => <circle key={`${l.id}-${i}`} cx={p.x * w} cy={p.y * h} r={40} fill="transparent" style={{ pointerEvents: 'all', cursor: 'move' }} onPointerDown={e => startDrag(e, 'line-point', l.id, p, i)} />))}
      </svg>}
      {editable && tool === 'line' && pendingLine.length > 0 && <button className="ll-btn ll-btn--primary ll-annotated__finish" onClick={finishLine}>Finish line ({pendingLine.length})</button>}
    </div>
  );
}
function ArrowHead({ a, b, w, h, color, width }: { a: Point; b: Point; w: number; h: number; color: string; width: number }) {
  const ax = a.x * w, ay = a.y * h, bx = b.x * w, by = b.y * h; const ang = Math.atan2(by - ay, bx - ax); const len = Math.max(10, width * 5);
  const p1 = { x: bx - len * Math.cos(ang - 0.5), y: by - len * Math.sin(ang - 0.5) }; const p2 = { x: bx - len * Math.cos(ang + 0.5), y: by - len * Math.sin(ang + 0.5) };
  return <polygon points={`${bx},${by} ${p1.x},${p1.y} ${p2.x},${p2.y}`} fill={color} />;
}
