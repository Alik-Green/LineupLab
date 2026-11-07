import { useEffect, useState } from 'react';
import { Keyboard, MonitorPlay, Camera } from 'lucide-react';
import type { CaptureSettings, HotkeyBinding, HotkeyFeedback, LibraryAdapter, MonitorInfo, OverlaySettings } from '../types';
import { eventToHotkey, hotkeyConflict } from '../lib/hotkeys';
import { clampOverlay, DEFAULT_OVERLAY, overlayPosition, useOverlayViewPrefs, type OverlayViewPrefs } from '../lib/overlay';
import { OverlaySettingsPreview } from './OverlayView';
export type { OverlayViewPrefs } from '../lib/overlay';
export { DEFAULT_VIEW_PREFS, readViewPrefs } from '../lib/overlay';
import { Button, Card, Input, Kbd, Select, Slider, StatusDot, Toggle, useToast } from './ui';


export function HotkeysPanel({ adapter }: { adapter: LibraryAdapter }) {
  const toast = useToast();
  const [hotkeys, setHotkeys] = useState<HotkeyBinding[]>([]); const [recording, setRecording] = useState<string | null>(null); const [feedback, setFeedback] = useState<HotkeyFeedback | null>(null);
  useEffect(() => { void adapter.getHotkeys().then(setHotkeys); }, [adapter]);
  useEffect(() => { if (!recording) return; const onKey = async (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); if (e.key === 'Escape' && !e.altKey) { setRecording(null); return; } const keys = eventToHotkey(e); if (!keys) { setFeedback({ kind: 'invalid', message: 'Hold Alt plus a supported key.' }); return; } const f = await adapter.rebindHotkey(recording, keys); setFeedback(f); if (f.kind === 'ok') { setHotkeys(await adapter.getHotkeys()); toast.push(f.message, 'success'); } setRecording(null); }; window.addEventListener('keydown', onKey, true); return () => window.removeEventListener('keydown', onKey, true); }, [recording, adapter, toast]);
  const groups: { title: string; actions: string[] }[] = [{ title: 'Capture', actions: ['capture', 'crosshair_circle', 'retake', 'next_slot', 'prev_slot', 'slot_stand1', 'slot_aim1', 'slot_stand2', 'slot_aim2', 'slot_landing'] }, { title: 'Draft', actions: ['save', 'save_next', 'discard', 'undo', 'redo'] }, { title: 'Overlay', actions: ['overlay_toggle', 'overlay_controls', 'overlay_mode', 'view_next', 'view_prev', 'view_flip', 'checklist_toggle'] }];
  return <Card data-testid="hotkey-settings"><div className="ll-selector-head"><h2 className="ll-h2 flex items-center gap-2"><Keyboard size={18} /> Global hotkeys</h2>{recording && <span className="ll-recording" role="status">Press an Alt combination… <Kbd>Esc</Kbd> cancels</span>}</div>
    <p className="ll-muted mb-3">Click a binding, then press the new Alt combination. Conflicts are rejected. {adapter.kind === 'browser' && 'Browser demo stores bindings locally; global registration happens in the Windows shell.'}</p>
    {groups.map(g => <div key={g.title} className="ll-hotkey-group"><h3 className="ll-h3">{g.title}</h3><table className="ll-table ll-hotkey-table"><tbody>{hotkeys.filter(b => g.actions.includes(b.action)).map(b => { const conflict = hotkeyConflict(hotkeys, b.keys, b.action); const rec = recording === b.action; return <tr key={b.action} className={conflict ? 'has-conflict' : ''}><td>{b.label}</td><td className="ll-hotkey-table__key"><button className={`ll-binding ${rec ? 'is-recording' : ''}`} onClick={() => { setRecording(b.action); setFeedback(null); }} aria-label={`Rebind ${b.label}`}>{rec ? <span className="ll-recording__pulse">Alt + …</span> : <Kbd>{b.keys}</Kbd>}</button></td><td className="ll-hotkey-table__status">{conflict ? <span className="ll-conflict"><StatusDot tone="error" /> conflicts with {conflict.label}</span> : <span className="ll-muted">—</span>}</td></tr>; })}</tbody></table></div>)}
    {feedback && <p role="status" className={`ll-feedback ll-feedback--${feedback.kind}`}>{feedback.message}</p>}
  </Card>;
}

export function OverlayPanel({ adapter }: { adapter: LibraryAdapter }) {
  const toast = useToast();
  const [overlay, setOverlay] = useState<OverlaySettings>(DEFAULT_OVERLAY); const [prefs, setPrefs] = useOverlayViewPrefs();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]); const [monitorError, setMonitorError] = useState('');
  useEffect(() => { void adapter.getOverlaySettings().then(setOverlay); void adapter.listMonitors().then(ms => { setMonitors(ms); setMonitorError(''); }).catch(e => setMonitorError(String(e))); }, [adapter]);
  const saveOverlay = async (patch: Partial<OverlaySettings>) => { const next = clampOverlay({ ...overlay, ...patch }); setOverlay(next); await adapter.setOverlaySettings(next); };
  const monitor = monitors.find(m => m.index === overlay.monitor) ?? monitors[0];
  const screen = monitor ? { width: monitor.logicalWidth, height: monitor.logicalHeight } : { width: 1920, height: 1080 };
  const pos = overlayPosition(overlay, screen.width, screen.height);
  return <div className="ll-settings-grid">
    <Card data-testid="overlay-settings"><h2 className="ll-h2 mb-3 flex items-center gap-2"><MonitorPlay size={18} /> Overlay window</h2>
      <div className="ll-form-grid"><Toggle label="Enabled" checked={overlay.enabled} onChange={v => saveOverlay({ enabled: v })} /><Toggle label="Click-through" checked={overlay.clickThrough} onChange={v => saveOverlay({ clickThrough: v })} description="Alt+O temporarily enables the controls." />
        <div className="ll-field"><span className="ll-label">Corner</span><div className="ll-corner-grid" role="radiogroup" aria-label="Corner">{(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(c => <button key={c} role="radio" aria-checked={overlay.corner === c} className={overlay.corner === c ? 'is-selected' : ''} onClick={() => saveOverlay({ corner: c })} aria-label={c.replace('-', ' ')}><span /></button>)}</div></div>
        <div className="ll-field"><span className="ll-label">Monitor</span><Select aria-label="Monitor" value={overlay.monitor} onChange={e => saveOverlay({ monitor: Number(e.target.value) })}>{monitors.length === 0 && <option value={overlay.monitor}>Detecting…</option>}{monitors.map(m => <option key={m.index} value={m.index}>{m.name} — {m.physicalWidth}×{m.physicalHeight}{m.isPrimary ? ' (primary)' : ''}</option>)}</Select></div>
        <Input label="Margin X" type="number" min={0} value={overlay.marginX} onChange={e => saveOverlay({ marginX: Number(e.target.value) })} /><Input label="Margin Y" type="number" min={0} value={overlay.marginY} onChange={e => saveOverlay({ marginY: Number(e.target.value) })} />
        <Input label="Width" type="number" min={200} max={1600} value={overlay.width} onChange={e => saveOverlay({ width: Number(e.target.value) })} /><Input label="Height" type="number" min={160} max={1400} value={overlay.height} onChange={e => saveOverlay({ height: Number(e.target.value) })} />
      </div><div className="ll-btn-row mt-3"><Button onClick={async () => { await adapter.setOverlaySettings(overlay); toast.push('Overlay placement reapplied to the selected monitor.', 'success'); }}>Reapply placement</Button></div><Slider label="Window opacity" min={0.2} max={1} step={0.05} value={overlay.opacity} onChange={v => saveOverlay({ opacity: v })} format={v => `${Math.round(v * 100)}%`} />
      <h3 className="ll-h3 mt-4 mb-2">Reading comfort</h3><Slider label="Content scale" min={0.75} max={1.75} step={0.05} value={prefs.scale} onChange={v => setPrefs({ scale: v })} format={v => `${Math.round(v * 100)}%`} /><Toggle label="Hide annotations in overlay" checked={prefs.hideAnnotations} onChange={v => setPrefs({ hideAnnotations: v })} description="Show the raw screenshot without circles, lenses and lines." /><Toggle label="Fade while capturing" checked={prefs.fade} onChange={v => setPrefs({ fade: v })} description="Dim the overlay briefly after each capture hotkey." />
      <p className="ll-muted mt-3" style={{ fontSize: 12 }}>Separate transparent, frameless, non-focusable, always-on-top window. Click-through is on by default. Excluded from capture via WDA_EXCLUDEFROMCAPTURE (Windows 10 2004+). Borderless/Windowed Valorant only.</p>
    </Card>
    <Card className="ll-overlay-preview-card"><h2 className="ll-h2 mb-2">Live preview</h2><p className="ll-muted mb-3" data-testid="overlay-monitor-summary">{monitor ? `${monitor.physicalWidth}×${monitor.physicalHeight} physical · ${monitor.logicalWidth}×${monitor.logicalHeight} logical · ${Math.round(monitor.scaleFactor * 100)}% scaling · position ${pos.x},${pos.y} logical` : 'Detecting monitor…'}</p>{monitorError && <p className="ll-feedback ll-feedback--conflict">{monitorError}</p>}
      <OverlaySettingsPreview adapter={adapter} overlay={overlay} prefs={prefs} pos={pos} screen={screen} />
      <p className="ll-muted mt-2" style={{ fontSize: 12 }}>Margins and window size are logical pixels. The native shell converts them with the selected monitor’s scale factor and origin, so 1440p and mixed-DPI setups place the overlay at the chosen corner. Reading-comfort changes apply immediately.</p>
    </Card>
  </div>;
}

export function CapturePanel({ adapter }: { adapter: LibraryAdapter }) {
  const [capture, setCapture] = useState<CaptureSettings>({ maxWidth: 1600, quality: 85, webp: true, thumbnail: true, targetMs: 150 });
  useEffect(() => { void adapter.getCaptureSettings().then(setCapture); }, [adapter]);
  const save = async (patch: Partial<CaptureSettings>) => { const next = { ...capture, ...patch }; setCapture(next); await adapter.setCaptureSettings(next); };
  return <Card data-testid="capture-settings"><h2 className="ll-h2 mb-3 flex items-center gap-2"><Camera size={18} /> Fast capture</h2><div className="ll-form-grid">
    <Input label="Max width (px)" type="number" min={320} max={7680} value={capture.maxWidth} onChange={e => save({ maxWidth: Number(e.target.value) })} />
    <Input label="Target time (ms)" type="number" min={16} max={5000} value={capture.targetMs} onChange={e => save({ targetMs: Number(e.target.value) })} />
    <Slider label="Quality" min={1} max={100} value={capture.quality} onChange={v => save({ quality: v })} />
    <div className="ll-field"><Toggle label="WebP (otherwise JPEG)" checked={capture.webp} onChange={v => save({ webp: v })} /><Toggle label="Generate thumbnail" checked={capture.thumbnail} onChange={v => save({ thumbnail: v })} /></div>
  </div><p className="ll-muted mt-3" style={{ fontSize: 12 }}>Defaults: 1600 px · quality 85 · WebP + thumbnail · target &lt;150 ms. Normal screen capture only; the overlay is excluded before capture. Originals are never modified.</p><div className="mt-3"><Button onClick={() => save({ maxWidth: 1600, quality: 85, webp: true, thumbnail: true, targetMs: 150 })}>Restore defaults</Button></div></Card>;
}
