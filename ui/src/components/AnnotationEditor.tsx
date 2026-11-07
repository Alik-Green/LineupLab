import { useEffect, useRef, useState } from 'react';
import { Circle, Copy, MousePointer2, Redo2, Spline, Trash2, Undo2, ZoomIn } from 'lucide-react';
import clsx from 'clsx';
import type { AnnotationLine, FocusCircle, SlotData, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';
import { AnnotatedImage, type AnnotationTool } from './AnnotatedImage';
import { useHistory } from '../lib/history';
import { nudge } from '../lib/geometry';
import { Button, IconButton, Input, Kbd, Segmented, Select, Slider, Toggle, Tooltip } from './ui';

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
  return <div className="ll-annotation" data-testid="annotation-editor">
    <div className="ll-annotation__main">
      <div className="ll-annotation__toolbar">
        <Segmented<AnnotationTool> ariaLabel="Annotation tool" value={tool} onChange={setTool} options={[{ value: 'select', label: 'Select', icon: <MousePointer2 size={15} /> }, { value: 'circle', label: 'Circle', icon: <Circle size={15} /> }, { value: 'lens', label: 'Lens', icon: <ZoomIn size={15} /> }, { value: 'line', label: 'Line', icon: <Spline size={15} /> }]} />
        <Tooltip label="Undo annotation (Ctrl+Z)"><IconButton label="Undo annotation" onClick={h.undo} disabled={!h.canUndo}><Undo2 size={16} /></IconButton></Tooltip>
        <Tooltip label="Redo annotation (Ctrl+Shift+Z)"><IconButton label="Redo annotation" onClick={h.redo} disabled={!h.canRedo}><Redo2 size={16} /></IconButton></Tooltip>
        <Toggle label="Snap to grid" checked={snapping} onChange={setSnapping} />
        <span className="ll-muted ll-annotation__hint">{tool === 'line' ? 'Click points, double-click or Finish to end' : tool === 'select' ? 'Click a shape to select · drag to move · arrows nudge' : 'Click the image to place'}</span>
      </div>
      <AnnotatedImage src={src} slot={h.state} editable tool={tool} color={color} snapping={snapping} selectedId={selected} onSelect={setSelected} onChange={commit} className="ll-annotation__canvas" />
    </div>
    <aside className="ll-annotation__side">
      <div><div className="ll-label">Color <span className="ll-muted">(keys 1–8)</span></div><div className="ll-swatches">{COLORS.map((c, i) => <button key={c} type="button" title={`${c} (${i + 1})`} aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => applyColor(c)} className={clsx('ll-swatch', color === c && 'is-selected')} style={{ background: c }} />)}<label className="ll-swatch ll-swatch--custom" title="Custom color"><input aria-label="Hex color" type="color" value={hex} onChange={e => { setHex(e.target.value); applyColor(e.target.value); }} /></label></div></div>
      {circle && <div className="ll-annotation__group"><h3 className="ll-h3">Circle</h3><Slider label="Radius" min={0.005} max={0.2} step={0.001} value={circle.radius} onChange={v => patchCircle({ radius: v })} format={v => v.toFixed(3)} /><Toggle label="Magnifier lens" checked={circle.showZoom} onChange={v => patchCircle({ showZoom: v })} />
        {circle.showZoom && <><Slider label="Zoom" min={1} max={12} step={0.1} value={circle.zoomScale} onChange={v => patchCircle({ zoomScale: v })} format={v => `×${v.toFixed(1)}`} /><Slider label="Lens size" min={0.05} max={0.8} step={0.01} value={circle.zoomSize} onChange={v => patchCircle({ zoomSize: v })} format={v => v.toFixed(2)} /><div className="ll-form-grid ll-form-grid--2"><Input label="Lens X" type="number" step={0.01} min={0} max={1} value={circle.zoomX} onChange={e => patchCircle({ zoomX: Number(e.target.value) })} /><Input label="Lens Y" type="number" step={0.01} min={0} max={1} value={circle.zoomY} onChange={e => patchCircle({ zoomY: Number(e.target.value) })} /></div></>}
      </div>}
      {line && <div className="ll-annotation__group"><h3 className="ll-h3">Line</h3><Slider label="Width" min={0.001} max={0.02} step={0.0005} value={line.width} onChange={v => patchLine({ width: v })} format={v => v.toFixed(4)} /><Select label="Style" value={line.style} onChange={e => patchLine({ style: e.target.value as AnnotationLine['style'] })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></Select><Select label="Arrows" value={line.arrow} onChange={e => patchLine({ arrow: e.target.value as AnnotationLine['arrow'] })}><option value="none">None</option><option value="end">End</option><option value="start">Start</option><option value="both">Both</option></Select><Input label="Label" value={line.label ?? ''} onChange={e => patchLine({ label: e.target.value || null })} /></div>}
      {(circle || line) && <div className="ll-annotation__group"><div className="ll-btn-row"><Button icon={<Copy size={14} />} onClick={duplicate}>Duplicate</Button><Button variant="danger" icon={<Trash2 size={14} />} onClick={remove}>Delete</Button></div><p className="ll-muted" style={{ fontSize: 12 }}>Arrows nudge · <Kbd>Shift</Kbd> larger · <Kbd>Ctrl+D</Kbd> duplicate · <Kbd>Del</Kbd> remove</p></div>}
      {!circle && !line && <p className="ll-muted">Select a circle or line to edit its size, color, lens and label.</p>}
      <div className="ll-annotation__group"><div className="ll-label">Copy annotations to slot</div><div className="ll-btn-row"><Select aria-label="Copy target slot" value={copyTo} onChange={e => setCopyTo(e.target.value as SlotId)}>{copyTargets.filter(s => s !== activeSlot).map(s => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}</Select><Button variant="primary" icon={<Copy size={14} />} onClick={() => onCopyTo?.(copyTo, h.state.circles, h.state.lines)}>Copy</Button></div></div>
      <p className="ll-muted" style={{ fontSize: 12 }}>{h.state.circles.length} circles · {h.state.lines.length} lines · originals never modified</p>
    </aside>
  </div>;
}
function useRefStable<T>(value: T) { const ref = useRef(value); ref.current = value; return ref; }
