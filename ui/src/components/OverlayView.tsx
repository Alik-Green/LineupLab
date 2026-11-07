import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { LibraryAdapter, Lineup, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';
import { AnnotatedImage } from './AnnotatedImage';
import { useMediaUrl } from '../lib/hooks';
interface OverlayViewData { state: { mode: 'create' | 'view'; showChecklist: boolean; flipped: boolean; checklist: { slot: SlotId; label: string; required: boolean; done: boolean; skipped: boolean }[]; viewSlots: SlotId[]; viewIndex: number; settings: { opacity: number } }; lineup: Lineup | null }
export function OverlayView({ adapter }: { adapter: LibraryAdapter }) {
  const [data, setData] = useState<OverlayViewData | null>(null);
  useEffect(() => { const load = () => invoke<OverlayViewData>('get_overlay_view').then(setData).catch(() => setData(null)); void load(); const un = listen('lineuplab://overlay-changed', load); const t = setInterval(load, 1500); return () => { clearInterval(t); void un.then(f => f()); }; }, []);
  const slot = data?.state.mode === 'view' ? data.state.viewSlots[data.state.viewIndex] : undefined;
  const url = useMediaUrl(adapter, slot ? data?.lineup?.slots[slot]?.image : null);
  const act = (action: string) => invoke('overlay_action', { action }).catch(() => {});
  return <div className="min-h-screen bg-slate-950/85 p-2 text-slate-100" style={{ opacity: data?.state.settings.opacity ?? 0.9 }} data-testid="overlay-view">
    <div className="mb-1 flex items-center gap-1 text-[11px]"><span className="font-bold text-cyan-300">LineupLab</span><button onClick={() => act('overlay_mode')} className="rounded bg-slate-800 px-1.5 py-0.5 capitalize">{data?.state.mode ?? 'create'}</button><button onClick={() => act('overlay_controls')} className="rounded bg-slate-800 px-1.5 py-0.5">controls</button><button onClick={() => act('overlay_toggle')} className="ml-auto rounded bg-slate-800 px-1.5 py-0.5">hide</button></div>
    {!data && <p className="text-xs text-slate-400">Overlay connects to the desktop core…</p>}
    {data?.state.mode === 'create' && data.state.showChecklist && <ul className="space-y-0.5 text-xs">{data.state.checklist.map(c => <li key={c.slot} className={`flex items-center gap-1 rounded px-1 py-0.5 ${c.done ? 'text-emerald-300' : c.required ? 'text-amber-300' : 'text-slate-400'}`}><span>{c.done ? '✓' : c.skipped ? '–' : '○'}</span>{c.label}{c.required && !c.done && <span className="ml-auto">*</span>}</li>)}</ul>}
    {data?.state.mode === 'view' && data.lineup && <div>
      <div className="mb-1 flex items-center gap-1 text-[11px]"><button onClick={() => act('view_prev')} className="rounded bg-slate-800 px-1.5">←</button><span className="flex-1 truncate font-semibold">{data.lineup.title}</span><button onClick={() => act('view_next')} className="rounded bg-slate-800 px-1.5">→</button><button onClick={() => act('view_flip')} className="rounded bg-slate-800 px-1.5">flip</button></div>
      {!data.state.flipped && slot && url && <AnnotatedImage src={url} slot={data.lineup.slots[slot]} alt={SLOT_LABELS[slot]} />}
      {!data.state.flipped && slot && <div className="mt-0.5 text-center text-[10px] text-slate-400">{SLOT_LABELS[slot]}</div>}
      {data.state.flipped && <div className="max-h-56 overflow-auto text-xs"><ol className="mb-1 space-y-0.5">{data.lineup.steps.map(s => <li key={s.order}>{s.order}. {s.text}</li>)}</ol><p className="whitespace-pre-wrap text-slate-300">{data.lineup.notes}</p></div>}
    </div>}
  </div>;
}
