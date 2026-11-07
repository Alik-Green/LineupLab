import type { OverlayCorner, OverlaySettings } from '../types';
export const DEFAULT_OVERLAY: OverlaySettings = { enabled: true, clickThrough: true, corner: 'top-right', monitor: 0, marginX: 24, marginY: 24, width: 420, height: 320, opacity: 0.9 };
export function clampOverlay(s: OverlaySettings): OverlaySettings { return { ...s, opacity: Math.min(1, Math.max(0.2, s.opacity)), width: Math.min(1600, Math.max(200, s.width)), height: Math.min(1400, Math.max(160, s.height)), marginX: Math.max(0, s.marginX), marginY: Math.max(0, s.marginY) }; }
export function overlayPosition(s: OverlaySettings, screenW: number, screenH: number): { x: number; y: number } { const c: OverlayCorner = s.corner; return { x: c.endsWith('left') ? s.marginX : Math.max(0, screenW - s.width - s.marginX), y: c.startsWith('top') ? s.marginY : Math.max(0, screenH - s.height - s.marginY) }; }
import { useEffect, useState } from 'react';
import type { Lineup, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';

/** Local reading-comfort prefs for the overlay window (not part of the core settings schema). */
export interface OverlayViewPrefs { scale: number; hideAnnotations: boolean; fade: boolean; minimal: boolean; outline: boolean }
export const DEFAULT_VIEW_PREFS: OverlayViewPrefs = { scale: 1, hideAnnotations: false, fade: true, minimal: false, outline: false };
export const VIEW_PREFS_KEY = 'lineuplab.overlayView';
const VIEW_PREFS_EVENT = 'lineuplab:overlay-view-prefs';
export function clampViewPrefs(p: Partial<OverlayViewPrefs>): OverlayViewPrefs {
  const scale = typeof p.scale === 'number' && Number.isFinite(p.scale) ? Math.min(1.75, Math.max(0.75, p.scale)) : DEFAULT_VIEW_PREFS.scale;
  return { scale, hideAnnotations: p.hideAnnotations === true, fade: p.fade !== false, minimal: p.minimal === true, outline: p.outline === true };
}
export function readViewPrefs(): OverlayViewPrefs { try { return clampViewPrefs(JSON.parse(localStorage.getItem(VIEW_PREFS_KEY) ?? '{}')); } catch { return DEFAULT_VIEW_PREFS; } }
export function writeViewPrefs(p: OverlayViewPrefs) { const next = clampViewPrefs(p); localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(next)); window.dispatchEvent(new CustomEvent(VIEW_PREFS_EVENT, { detail: next })); return next; }
/** Keeps the settings preview and the overlay window in sync (storage event + same-window event). */
export function useOverlayViewPrefs(): [OverlayViewPrefs, (patch: Partial<OverlayViewPrefs>) => void] {
  const [prefs, setPrefs] = useState(readViewPrefs);
  useEffect(() => { const sync = () => setPrefs(readViewPrefs()); const onCustom = (e: Event) => setPrefs(clampViewPrefs((e as CustomEvent<OverlayViewPrefs>).detail)); window.addEventListener('storage', sync); window.addEventListener(VIEW_PREFS_EVENT, onCustom); return () => { window.removeEventListener('storage', sync); window.removeEventListener(VIEW_PREFS_EVENT, onCustom); }; }, []);
  return [prefs, patch => setPrefs(writeViewPrefs({ ...readViewPrefs(), ...patch }))];
}
export interface OverlayChecklistItem { slot: SlotId; label: string; required: boolean; done: boolean; skipped: boolean }
/** Mirrors core OverlayState::update_checklist for the live editor draft shown in the overlay. */
export function draftChecklist(lineup: Lineup, required: SlotId[], skipped: SlotId[] = []): OverlayChecklistItem[] {
  return SLOT_ORDER.filter(s => required.includes(s) || s === 'stand1' || s === 'aim1' || s === 'landing' || Boolean(lineup.slots[s]?.image))
    .map(slot => ({ slot, label: SLOT_LABELS[slot], required: required.includes(slot), done: Boolean(lineup.slots[slot]?.image), skipped: skipped.includes(slot) }));
}
