import { useEffect, useState } from 'react';
import type { AnnotationLine, FocusCircle, SlotData, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';
import { AnnotatedImage, type AnnotationTool } from './AnnotatedImage';
import { useHistory } from '../lib/history';
import { nudge } from '../lib/geometry';

const COLORS = ['cyan', 'yellow', 'red', 'lime', 'magenta', 'orange', 'white', '#7dd3fc'];
export function AnnotationEditor({ src, slot, onChange, onCopyTo, copyTargets = SLOT_ORDER, activeSlot }: { src: string; slot: SlotData; onChange(s: SlotData): void; onCopyTo?(slot: SlotId, circles: FocusCircle[], lines: AnnotationLine[]): void; copyTargets?: SlotId[]; activeSlot?: SlotId }) {
  const h = useHistory<SlotData>(slot);
  const [tool, setTool] = useState<AnnotationTool>('select');
  const [color, setColor] = useState('cyan'); const [hex, setHex] = useState('#22d3ee');
  const [snapping, setSnapping] = useState(false); const [selected, setSelected] = useState<string | null>(null);
  const [copyTo, setCopyTo] = useState<SlotId>(copyTargets[0] ?? 'aim1');
  useEffect(() => { h.reset(slot); /* external slot switch */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, activeSlot]);
  const commit = (next: SlotData) => { h.set(next); onChange(next); };
  const circle = h.state.circles.find(c => c.id === selected); const line = h.state.lines.find(l => l.id === selected);
  const patchCircle = (patch: Partial<FocusCircle>) => { if (!circle) return; commit({ ...h.state, circles: h.state.circles.map(c => c.id === circle.id ? { ...c, ...patch } : c) }); };
  const patchLine = (patch: Partial<AnnotationLine>) => { if (!line) return; commit({ ...h.state, lines: h.state.lines.map(l => l.id === line.id ? { ...l, ...patch } : l) }); };
  const remove = () => { commit({ ...h.state, circles: h.state.circles.filter(c => c.id !== selected), lines: h.state.lines.filter(l => l.id !== selected) }); setSelected(null); };
  const duplicate = () => { if (circle) { const c = { ...circle, id: crypto.randomUUID(), x: Math.min(1, circle.x + 0.03), y: Math.min(1, circle.y + 0.03) }; commit({ ...h.state, circles: [...h.state.circles, c] }); setSelected(c.id); } else if (line) { const l = { ...line, id: crypto.randomUUID(), points: line.points.map(p => nudge(p, 0.03, 0.03)) }; commit({ ...h.state, lines: [...h.state.lines, l] }); setSelected(l.id); } };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) h.redo(); else h.undo(); return; }
      if (!selected) return;
      const step = e.shiftKey ? 0.01 : 0.002;
      const move = (dx: number, dy: number) => { if (circle) patchCircle({ x: circle.x + dx, y: circle.y + dy }); else if (line) patchLine({ points: line.points.map(p => nudge(p, dx, dy)) }); };
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-step, 0); } else if (e.key === 'ArrowRight') { e.preventDefault(); move(step, 0); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -step); } else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, step); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); }
      else if (/^[1-8]$/.test(e.key)) { const c = COLORS[Number(e.key) - 1]; setColor(c); if (circle) patchCircle({ color: c }); else if (line) patchLine({ color: c }); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  const onChangeRef = useRefStable(onChange); const hRef = useRefStable(h);
  // Keep undo/redo propagated to the parent after state settles.
  useEffect(() => { onChangeRef.current(hRef.current.state); }, [h.state]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="grid gap-3 lg:grid-cols-[1fr_260px]" data-testid="annotation-editor">
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
        {(['select', 'circle', 'lens', 'line'] as AnnotationTool[]).map(t => <button key={t} onClick={() => setTool(t)} className={`rounded px-2 py-1 capitalize ${tool === t ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700'}`}>{t}</button>)}
        <button onClick={() => { h.undo(); }} disabled={!h.canUndo} className="rounded bg-slate-800 px-2 py-1 disabled:opacity-40" aria-label="Undo annotation">Undo</button>
        <button onClick={() => { h.redo(); }} disabled={!h.canRedo} className="rounded bg-slate-800 px-2 py-1 disabled:opacity-40" aria-label="Redo annotation">Redo</button>
        <label className="ml-2 flex items-center gap-1"><input type="checkbox" checked={snapping} onChange={e => setSnapping(e.target.checked)} /> Snap</label>
        <span className="ml-auto text-slate-500">{tool === 'line' ? 'Click points, double-click or Finish to end' : 'Click image to annotate · drag to move'}</span>
      </div>
      <AnnotatedImage src={src} slot={h.state} editable tool={tool} color={color} snapping={snapping} selectedId={selected} onSelect={setSelected} onChange={commit} />
    </div>
    <aside className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
      <div><div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Color (keys 1–8)</div><div className="flex flex-wrap gap-1">{COLORS.map((c, i) => <button key={c} title={`${c} (${i + 1})`} onClick={() => { setColor(c); if (circle) patchCircle({ color: c }); else if (line) patchLine({ color: c }); }} className={`h-6 w-6 rounded border ${color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />)}<input aria-label="Hex color" type="color" value={hex} onChange={e => { setHex(e.target.value); setColor(e.target.value); if (circle) patchCircle({ color: e.target.value }); else if (line) patchLine({ color: e.target.value }); }} className="h-6 w-8 cursor-pointer bg-transparent" /></div></div>
      {circle && <div className="space-y-2 border-t border-slate-800 pt-2">
        <div className="font-semibold">Circle</div>
        <label className="block text-xs">Radius <input type="range" min={0.005} max={0.2} step={0.001} value={circle.radius} onChange={e => patchCircle({ radius: Number(e.target.value) })} className="w-full" /></label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={circle.showZoom} onChange={e => patchCircle({ showZoom: e.target.checked })} /> Magnifier lens</label>
        {circle.showZoom && <>
          <label className="block text-xs">Zoom ×{circle.zoomScale.toFixed(1)}<input type="range" min={1} max={12} step={0.1} value={circle.zoomScale} onChange={e => patchCircle({ zoomScale: Number(e.target.value) })} className="w-full" /></label>
          <label className="block text-xs">Lens size<input type="range" min={0.05} max={0.8} step={0.01} value={circle.zoomSize} onChange={e => patchCircle({ zoomSize: Number(e.target.value) })} className="w-full" /></label>
          <div className="grid grid-cols-2 gap-2 text-xs"><label>X<input type="number" step={0.01} min={0} max={1} value={circle.zoomX} onChange={e => patchCircle({ zoomX: Number(e.target.value) })} className="w-full rounded bg-slate-800 px-1" /></label><label>Y<input type="number" step={0.01} min={0} max={1} value={circle.zoomY} onChange={e => patchCircle({ zoomY: Number(e.target.value) })} className="w-full rounded bg-slate-800 px-1" /></label></div>
        </>}
      </div>}
      {line && <div className="space-y-2 border-t border-slate-800 pt-2">
        <div className="font-semibold">Line</div>
        <label className="block text-xs">Width<input type="range" min={0.001} max={0.02} step={0.0005} value={line.width} onChange={e => patchLine({ width: Number(e.target.value) })} className="w-full" /></label>
        <label className="block text-xs">Style<select value={line.style} onChange={e => patchLine({ style: e.target.value as AnnotationLine['style'] })} className="w-full rounded bg-slate-800 px-1"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>
        <label className="block text-xs">Arrows<select value={line.arrow} onChange={e => patchLine({ arrow: e.target.value as AnnotationLine['arrow'] })} className="w-full rounded bg-slate-800 px-1"><option value="none">None</option><option value="end">End</option><option value="start">Start</option><option value="both">Both</option></select></label>
        <label className="block text-xs">Label<input value={line.label ?? ''} onChange={e => patchLine({ label: e.target.value || null })} className="w-full rounded bg-slate-800 px-1" /></label>
      </div>}
      {(circle || line) && <div className="flex flex-wrap gap-1 border-t border-slate-800 pt-2 text-xs"><button onClick={duplicate} className="rounded bg-slate-800 px-2 py-1">Duplicate</button><button onClick={remove} className="rounded bg-red-900/60 px-2 py-1">Delete</button><span className="w-full text-slate-500">Arrows nudge · Shift = larger · Ctrl+D duplicate</span></div>}
      <div className="border-t border-slate-800 pt-2 text-xs"><label className="block text-slate-400">Copy annotations to slot</label><div className="mt-1 flex gap-1"><select value={copyTo} onChange={e => setCopyTo(e.target.value as SlotId)} className="flex-1 rounded bg-slate-800 px-1">{copyTargets.filter(s => s !== activeSlot).map(s => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}</select><button className="rounded bg-cyan-600 px-2 py-1 text-white" onClick={() => { onCopyTo?.(copyTo, h.state.circles, h.state.lines); }}>Copy</button></div></div>
      <div className="text-xs text-slate-500">{h.state.circles.length} circles · {h.state.lines.length} lines · originals never modified</div>
    </aside>
  </div>;
}
import { useRef } from 'react';
function useRefStable<T>(value: T) { const ref = useRef(value); ref.current = value; return ref; }
