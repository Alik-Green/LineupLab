import { useEffect, useState } from 'react';
import type { CaptureSettings, HotkeyBinding, HotkeyFeedback, LibraryAdapter, OverlaySettings } from '../types';
import { eventToHotkey, hotkeyConflict } from '../lib/hotkeys';
import { clampOverlay, DEFAULT_OVERLAY, overlayPosition } from '../lib/overlay';

export function DesktopSettings({ adapter }: { adapter: LibraryAdapter }) {
  const [hotkeys, setHotkeys] = useState<HotkeyBinding[]>([]); const [recording, setRecording] = useState<string | null>(null); const [feedback, setFeedback] = useState<HotkeyFeedback | null>(null);
  const [overlay, setOverlay] = useState<OverlaySettings>(DEFAULT_OVERLAY); const [capture, setCapture] = useState<CaptureSettings>({ maxWidth: 1600, quality: 85, webp: true, thumbnail: true, targetMs: 150 });
  useEffect(() => { void adapter.getHotkeys().then(setHotkeys); void adapter.getOverlaySettings().then(setOverlay); void adapter.getCaptureSettings().then(setCapture); }, [adapter]);
  useEffect(() => { if (!recording) return; const onKey = async (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); if (e.key === 'Escape' && !e.altKey) { setRecording(null); return; } const keys = eventToHotkey(e); if (!keys) { setFeedback({ kind: 'invalid', message: 'Hold Alt plus a supported key.' }); return; } const f = await adapter.rebindHotkey(recording, keys); setFeedback(f); if (f.kind === 'ok') setHotkeys(await adapter.getHotkeys()); setRecording(null); }; window.addEventListener('keydown', onKey, true); return () => window.removeEventListener('keydown', onKey, true); }, [recording, adapter]);
  const saveOverlay = async (patch: Partial<OverlaySettings>) => { const next = clampOverlay({ ...overlay, ...patch }); setOverlay(next); await adapter.setOverlaySettings(next); };
  const saveCapture = async (patch: Partial<CaptureSettings>) => { const next = { ...capture, ...patch }; setCapture(next); await adapter.setCaptureSettings(next); };
  const pos = overlayPosition(overlay, 1920, 1080);
  return <div className="space-y-4">
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4" data-testid="hotkey-settings"><h2 className="mb-1 text-lg font-semibold">Alt hotkeys</h2><p className="mb-3 text-xs text-slate-500">Click a binding, then press the new Alt combination. Conflicts are rejected. {adapter.kind === 'browser' && 'Browser demo stores bindings locally; global registration happens in the Windows shell.'}</p>
      <div className="grid gap-1 sm:grid-cols-2">{hotkeys.map(b => { const conflict = recording === b.action ? null : hotkeyConflict(hotkeys, b.keys, b.action); return <div key={b.action} className="flex items-center gap-2 rounded bg-slate-950/60 px-2 py-1.5 text-sm"><span className="flex-1 truncate">{b.label}</span><button onClick={() => { setRecording(b.action); setFeedback(null); }} className={`min-w-28 rounded px-2 py-1 font-mono text-xs ${recording === b.action ? 'bg-cyan-500 text-slate-950 animate-pulse' : conflict ? 'bg-red-900 text-red-200' : 'bg-slate-800'}`}>{recording === b.action ? 'Press Alt+…' : b.keys}</button></div>; })}</div>
      {feedback && <p role="status" className={`mt-2 text-sm ${feedback.kind === 'ok' ? 'text-emerald-300' : 'text-amber-300'}`}>{feedback.message}</p>}
    </section>
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4" data-testid="overlay-settings"><h2 className="mb-2 text-lg font-semibold">Overlay window</h2>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <label className="flex items-center gap-2"><input type="checkbox" checked={overlay.enabled} onChange={e => saveOverlay({ enabled: e.target.checked })} /> Enabled</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={overlay.clickThrough} onChange={e => saveOverlay({ clickThrough: e.target.checked })} /> Click-through</label>
        <label>Corner<select value={overlay.corner} onChange={e => saveOverlay({ corner: e.target.value as OverlaySettings['corner'] })} className="mt-0.5 w-full rounded bg-slate-800 px-2 py-1"><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option></select></label>
        <label>Monitor<input type="number" min={0} value={overlay.monitor} onChange={e => saveOverlay({ monitor: Number(e.target.value) })} className="mt-0.5 w-full rounded bg-slate-800 px-2 py-1" /></label>
        <label>Margin X<input type="number" min={0} value={overlay.marginX} onChange={e => saveOverlay({ marginX: Number(e.target.value) })} className="mt-0.5 w-full rounded bg-slate-800 px-2 py-1" /></label>
        <label>Margin Y<input type="number" min={0} value={overlay.marginY} onChange={e => saveOverlay({ marginY: Number(e.target.value) })} className="mt-0.5 w-full rounded bg-slate-800 px-2 py-1" /></label>
        <label>Width<input type="number" min={200} max={1600} value={overlay.width} onChange={e => saveOverlay({ width: Number(e.target.value) })} className="mt-0.5 w-full rounded bg-slate-800 px-2 py-1" /></label>
        <label>Height<input type="number" min={160} max={1400} value={overlay.height} onChange={e => saveOverlay({ height: Number(e.target.value) })} className="mt-0.5 w-full rounded bg-slate-800 px-2 py-1" /></label>
        <label>Opacity {Math.round(overlay.opacity * 100)}%<input type="range" min={0.2} max={1} step={0.05} value={overlay.opacity} onChange={e => saveOverlay({ opacity: Number(e.target.value) })} className="mt-0.5 w-full" /></label>
      </div>
      <div className="relative mt-3 h-36 rounded border border-slate-700 bg-slate-950"><div className="absolute rounded border border-cyan-500 bg-cyan-500/20 text-[10px] text-cyan-200" style={{ left: `${pos.x / 1920 * 100}%`, top: `${pos.y / 1080 * 100}%`, width: `${overlay.width / 1920 * 100}%`, height: `${overlay.height / 1080 * 100}%`, opacity: overlay.opacity }}>overlay</div></div>
      <p className="mt-2 text-xs text-slate-500">Separate transparent, frameless, non-focusable, always-on-top window. Click-through is on by default; Alt+O toggles controls. Excluded from capture via WDA_EXCLUDEFROMCAPTURE (Windows 10 2004+). Borderless/Windowed Valorant only.</p>
    </section>
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4" data-testid="capture-settings"><h2 className="mb-2 text-lg font-semibold">Fast capture</h2><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      <label>Max width<input type="number" min={320} max={7680} value={capture.maxWidth} onChange={e => saveCapture({ maxWidth: Number(e.target.value) })} className="mt-0.5 w-full rounded bg-slate-800 px-2 py-1" /></label>
      <label>Quality<input type="number" min={1} max={100} value={capture.quality} onChange={e => saveCapture({ quality: Number(e.target.value) })} className="mt-0.5 w-full rounded bg-slate-800 px-2 py-1" /></label>
      <label>Target ms<input type="number" min={16} max={5000} value={capture.targetMs} onChange={e => saveCapture({ targetMs: Number(e.target.value) })} className="mt-0.5 w-full rounded bg-slate-800 px-2 py-1" /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={capture.webp} onChange={e => saveCapture({ webp: e.target.checked })} /> WebP (else JPEG)</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={capture.thumbnail} onChange={e => saveCapture({ thumbnail: e.target.checked })} /> Thumbnail</label>
    </div><p className="mt-2 text-xs text-slate-500">Defaults: 1600 px · quality 85 · WebP + thumbnail · target &lt;150 ms. Normal screen capture only; the overlay is excluded before capture.</p></section>
  </div>;
}
