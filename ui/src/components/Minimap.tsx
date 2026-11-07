import { useRef } from 'react';
import type { Lineup, Point } from '../types';
import { clampPoint, snapPoint } from '../lib/geometry';
export function Minimap({ src, lineups, selectedId, onSelect, onHover, editablePins, onPinChange, className = '' }: { src?: string; lineups: Lineup[]; selectedId?: string | null; onSelect?(id: string): void; onHover?(id: string | null): void; editablePins?: Partial<Record<'stand1Pos' | 'aim1Pos' | 'stand2Pos' | 'aim2Pos' | 'landPos', Point | null>>; onPinChange?(key: string, p: Point): void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null); const drag = useRef<string | null>(null);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return snapPoint({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }, false); };
  return <div ref={ref} className={`relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900 ${className}`} data-testid="minimap" onPointerMove={e => { if (drag.current && onPinChange) onPinChange(drag.current, pos(e)); }} onPointerUp={() => drag.current = null}>
    {src ? <img src={src} alt="Minimap" className="block h-auto w-full" draggable={false} /> : <div className="aspect-square w-full bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%),linear-gradient(45deg,#1e293b_25%,#0f172a_25%,#0f172a_75%,#1e293b_75%)] bg-[length:24px_24px] bg-[position:0_0,12px_12px]" />}
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      {lineups.map(l => { const p = l.landPos ?? l.stand1Pos; if (!p) return null; const sel = l.id === selectedId; return <g key={l.id} className="cursor-pointer" onClick={() => onSelect?.(l.id)} onMouseEnter={() => onHover?.(l.id)} onMouseLeave={() => onHover?.(null)}>
        <circle cx={p.x * 1000} cy={p.y * 1000} r={sel ? 16 : 10} fill={l.isFavorite ? '#facc15' : '#22d3ee'} stroke="#0f172a" strokeWidth={3} />
        {l.stand1Pos && l.landPos && <line x1={l.stand1Pos.x * 1000} y1={l.stand1Pos.y * 1000} x2={l.landPos.x * 1000} y2={l.landPos.y * 1000} stroke={sel ? '#f8fafc' : '#22d3ee'} strokeWidth={sel ? 3 : 1.5} strokeDasharray="6 5" opacity={0.7} />}
      </g>; })}
      {editablePins && Object.entries(editablePins).map(([key, p]) => p ? <g key={key}>
        <circle cx={p.x * 1000} cy={p.y * 1000} r={15} fill={key === 'landPos' ? '#f87171' : key.startsWith('aim') ? '#facc15' : '#22d3ee'} stroke="white" strokeWidth={3} style={{ cursor: 'move' }} onPointerDown={e => { e.stopPropagation(); drag.current = key; (e.target as Element).setPointerCapture?.(e.pointerId); }} />
        <text x={p.x * 1000 + 18} y={p.y * 1000 - 12} fill="white" fontSize={22}>{key.replace('Pos', '')}</text>
      </g> : null)}
    </svg>
  </div>;
}
