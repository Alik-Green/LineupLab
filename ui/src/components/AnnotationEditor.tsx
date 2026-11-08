import { useEffect, useRef, useState } from 'react';
import { Circle, Copy, Magnet, MousePointer2, Redo2, Spline, Trash2, Undo2, ZoomIn } from 'lucide-react';
import clsx from 'clsx';
import type { AnnotationLine, FocusCircle, SlotData, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';
import { AnnotatedImage, type AnnotationTool } from './AnnotatedImage';
import { useHistory } from '../lib/history';
import { nudge } from '../lib/geometry';
import { Button, IconButton, Input, Select, Slider, Toggle, Tooltip } from './ui';

const COLORS = ['cyan', 'yellow', 'red', 'lime', 'magenta', 'orange', 'white', '#7dd3fc'];
export function AnnotationEditor({ src, slot, onChange, onCopyTo, copyTargets = SLOT_ORDER, activeSlot }: { src: string; slot: SlotData; onChange(s: SlotData): void; onCopyTo?(slot: SlotId, circles: FocusCircle[], lines: AnnotationLine[]): void; copyTargets?: SlotId[]; activeSlot?: SlotId }) {
  const h = useHistory<SlotData>(slot);
  const [tool, setTool] = useState<AnnotationTool>('select');
  const [color, setColor] = useState('cyan'); const [hex, setHex] = useState('#22d3ee');
  const [snapping, setSnapping] = useState(false); const [selected, setSelected] = useState<string | null>(null);
  const [copyTo, setCopyTo] = useState<SlotId>(copyTargets.find(s => s !== activeSlot) ?? 'aim1');
  useEffect(() => { h.reset(slot); /* external slot switch */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, activeSlot]);
  const commit = (next: SlotData) => { h.set(next); onChange(next); };
  const circle = h.state.circles.find(c => c.id === selected); const line = h.state.lines.find(l => l.id === selected);
  const patchCircle = (patch: Partial<FocusCircle>) => { if (!circle) return; commit({ ...h.state, circles: h.state.circles.map(c => c.id === circle.id ? { ...c, ...patch } : c) }); };
  const patchLine = (patch: Partial<AnnotationLine>) => { if (!line) return; commit({ ...h.state, lines: h.state.lines.map(l => l.id === line.id ? { ...l, ...patch } : l) }); };
  const remove = () => { commit({ ...h.state, circles: h.state.circles.filter(c => c.id !== selected), lines: h.state.lines.filter(l => l.id !== selected) }); setSelected(null); };
  const duplicate = () => { if (circle) { const c = { ...circle, id: crypto.randomUUID(), x: Math.min(1, circle.x + 0.03), y: Math.min(1, circle.y + 0.03) }; commit({ ...h.state, circles: [...h.state.circles, c] }); setSelected(c.id); } else if (line) { const l = { ...line, id: crypto.randomUUID(), points: line.points.map(p => nudge(p, 0.03, 0.03)) }; commit({ ...h.state, lines: [...h.state.lines, l] }); setSelected(l.id); } };
  const applyColor = (c: string) => { setColor(c); if (circle) patchCircle({ color: c }); else if (line) patchLine({ color: c }); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) h.redo(); else h.undo(); return; }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && ['v','c','l','p'].includes(e.key.toLowerCase())) { e.preventDefault(); setTool(({v:'select',c:'circle',l:'lens',p:'line'} as Record<string,AnnotationTool>)[e.key.toLowerCase()]); return; }
      if (!selected) return;
      const step = e.shiftKey ? 0.01 : 0.002;
      const move = (dx: number, dy: number) => { if (circle) patchCircle({ x: circle.x + dx, y: circle.y + dy }); else if (line) patchLine({ points: line.points.map(p => nudge(p, dx, dy)) }); };
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-step, 0); } else if (e.key === 'ArrowRight') { e.preventDefault(); move(step, 0); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -step); } else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, step); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); }
      else if (/^[1-8]$/.test(e.key)) applyColor(COLORS[Number(e.key) - 1]);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  const onChangeRef = useRefStable(onChange); const hRef = useRefStable(h);
  useEffect(() => { onChangeRef.current(hRef.current.state); }, [h.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const tools: { id: AnnotationTool; label: string; shortcut: string; icon: React.ReactNode }[] = [{ id: 'select', label: 'Select', shortcut: 'V', icon: <MousePointer2 size={18} /> }, { id: 'circle', label: 'Circle', shortcut: 'C', icon: <Circle size={18} /> }, { id: 'lens', label: 'Lens', shortcut: 'L', icon: <ZoomIn size={18} /> }, { id: 'line', label: 'Line', shortcut: 'P', icon: <Spline size={18} /> }];
  return <div className="ll-annotation" data-testid="annotation-editor">
    <div className="ll-annotation__tools" role="toolbar" aria-label="Annotation tools">
      {tools.map(t => <Tooltip key={t.id} label={`${t.label} (${t.shortcut})`}><IconButton label={t.label} aria-pressed={tool === t.id} className={tool === t.id ? 'is-active' : ''} onClick={() => setTool(t.id)}>{t.icon}</IconButton></Tooltip>)}
      <hr />
      <Tooltip label="Undo (Ctrl+Z)"><IconButton label="Undo annotation" onClick={h.undo} disabled={!h.canUndo}><Undo2 size={17} /></IconButton></Tooltip>
      <Tooltip label="Redo (Ctrl+Shift+Z)"><IconButton label="Redo annotation" onClick={h.redo} disabled={!h.canRedo}><Redo2 size={17} /></IconButton></Tooltip>
      <Tooltip label="Snap to grid"><IconButton label="Snap to grid" aria-pressed={snapping} className={snapping ? 'is-active' : ''} onClick={() => setSnapping(v => !v)}><Magnet size={17} /></IconButton></Tooltip>
    </div>
    <div className="ll-annotation__main"><AnnotatedImage src={src} slot={h.state} editable tool={tool} color={color} snapping={snapping} selectedId={selected} onSelect={setSelected} onChange={commit} className="ll-annotation__canvas" /></div>
    <aside className="ll-annotation__side" aria-label="Tool properties">
      <h3 className="ll-h3">{circle ? 'Circle' : line ? 'Line' : tools.find(t => t.id === tool)?.label}</h3>
      <div className="ll-swatches">{COLORS.map(c => <button key={c} type="button" title={c} aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => applyColor(c)} className={clsx('ll-swatch', color === c && 'is-selected')} style={{ background: c }} />)}<label className="ll-swatch ll-swatch--custom" title="Custom color"><input aria-label="Hex color" type="color" value={hex} onChange={e => { setHex(e.target.value); applyColor(e.target.value); }} /></label></div>
      {circle && <div className="ll-annotation__group"><Slider label="Radius" min={0.005} max={0.2} step={0.001} value={circle.radius} onChange={v => patchCircle({ radius: v })} format={v => `${Math.round(v * 1000)}`} /><Toggle label="Magnifier" checked={circle.showZoom} onChange={v => patchCircle({ showZoom: v })} />
        {circle.showZoom && <><Slider label="Zoom" min={1} max={12} step={0.1} value={circle.zoomScale} onChange={v => patchCircle({ zoomScale: v })} format={v => `×${v.toFixed(1)}`} /><Slider label="Lens size" min={0.05} max={0.8} step={0.01} value={circle.zoomSize} onChange={v => patchCircle({ zoomSize: v })} format={v => `${Math.round(v * 100)}%`} /></>}
      </div>}
      {line && <div className="ll-annotation__group"><Slider label="Width" min={0.001} max={0.02} step={0.0005} value={line.width} onChange={v => patchLine({ width: v })} format={v => `${Math.round(v * 1000)}`} /><Select label="Style" value={line.style} onChange={e => patchLine({ style: e.target.value as AnnotationLine['style'] })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></Select><Select label="Arrows" value={line.arrow} onChange={e => patchLine({ arrow: e.target.value as AnnotationLine['arrow'] })}><option value="none">None</option><option value="end">End</option><option value="start">Start</option><option value="both">Both</option></Select><Input label="Label" value={line.label ?? ''} onChange={e => patchLine({ label: e.target.value || null })} /></div>}
      {(circle || line) && <div className="ll-btn-row"><Tooltip label="Duplicate (Ctrl+D)"><IconButton label="Duplicate" onClick={duplicate}><Copy size={16} /></IconButton></Tooltip><Tooltip label="Delete (Del)"><IconButton label="Delete" onClick={remove}><Trash2 size={16} /></IconButton></Tooltip></div>}
      {copyTargets.some(t => t !== activeSlot) && <details className="ll-annotation__copy"><summary>Copy to another capture</summary><div className="ll-btn-row"><Select aria-label="Copy target slot" value={copyTo} onChange={e => setCopyTo(e.target.value as SlotId)}>{copyTargets.filter(t => t !== activeSlot).map(t => <option key={t} value={t}>{SLOT_LABELS[t]}</option>)}</Select><Button variant="primary" icon={<Copy size={14} />} onClick={() => onCopyTo?.(copyTo, h.state.circles, h.state.lines)}>Copy</Button></div></details>}
    </aside>
  </div>;
}
function useRefStable<T>(value: T) { const ref = useRef(value); ref.current = value; return ref; }
