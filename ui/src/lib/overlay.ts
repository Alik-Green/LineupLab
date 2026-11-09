import type { OverlayCorner, OverlaySettings } from '../types';
export const DEFAULT_OVERLAY: OverlaySettings = { enabled: true, clickThrough: true, corner: 'top-right', monitor: 0, marginX: 24, marginY: 24, width: 420, height: 320, opacity: 0.9 };
export function clampOverlay(s: OverlaySettings): OverlaySettings { return { ...s, opacity: Math.min(1, Math.max(0.2, s.opacity)), width: Math.min(1600, Math.max(200, s.width)), height: Math.min(2400, Math.max(64, s.height)), marginX: Math.max(0, s.marginX), marginY: Math.max(0, s.marginY) }; }
export function overlayPosition(s: OverlaySettings, screenW: number, screenH: number): { x: number; y: number } { const c: OverlayCorner = s.corner; return { x: c.endsWith('left') ? s.marginX : Math.max(0, screenW - s.width - s.marginX), y: c.startsWith('top') ? s.marginY : Math.max(0, screenH - s.height - s.marginY) }; }
import { useEffect, useState } from 'react';
import type { Lineup, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';

/** Local reading-comfort prefs for the overlay window (not part of the core settings schema). */
export interface OverlayViewPrefs { scale: number; hideAnnotations: boolean; fade: boolean; minimal: boolean; outline: boolean; outlineThickness: number }
/** Normal mode reserves compact chrome; minimal mode is exactly image-width / image-height. */
export function overlayHeight(width: number, imageAspect: number, minimal: boolean, mode: 'create' | 'view' = 'view'): number {
  const ratio = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : 16 / 9;
  return Math.round(Math.min(2400, Math.max(64, width / ratio + (minimal ? 0 : mode === 'create' ? 172 : 88))));
}
export const DEFAULT_VIEW_PREFS: OverlayViewPrefs = { scale: 1, hideAnnotations: false, fade: true, minimal: false, outline: false, outlineThickness: 3 };
export const VIEW_PREFS_KEY = 'lineuplab.overlayView';
const VIEW_PREFS_EVENT = 'lineuplab:overlay-view-prefs';
export function clampViewPrefs(p: Partial<OverlayViewPrefs>): OverlayViewPrefs {
  const scale = typeof p.scale === 'number' && Number.isFinite(p.scale) ? Math.min(1.75, Math.max(0.75, p.scale)) : DEFAULT_VIEW_PREFS.scale;
  return { scale, hideAnnotations: p.hideAnnotations === true, fade: p.fade !== false, minimal: p.minimal === true, outline: p.outline === true, outlineThickness: typeof p.outlineThickness === 'number' && Number.isFinite(p.outlineThickness) ? Math.min(12, Math.max(1, p.outlineThickness)) : 3 };
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
function stepImage(lineup: Lineup, slot: SlotId): string | null { const image = lineup.slots?.[slot]?.image; return typeof image === 'string' && image.trim() ? image.trim() : null; }
/** Mirrors core `overlay::has_second_throw`: the mode's required slots win, and
 * saved throws, double-shock attributes, legacy `double` ids or a distinct second
 * aim image also prove a second throw. Leftover/copied data does not. */
export function hasSecondThrow(lineup: Lineup, required: SlotId[] = []): boolean {
  if (required.includes('aim2') || required.includes('stand2')) return true;
  if ((lineup.throws ?? []).some(t => t.index >= 2)) return true;
  const attrs = lineup.attributes ?? {};
  const flag = (k: string) => attrs[k] === true || (typeof attrs[k] === 'number' && (attrs[k] as number) > 0);
  if (flag('doubleShock') || flag('hasSecondStand') || flag('secondThrow')) return true;
  if ((lineup.mode ?? '').toLowerCase().includes('double')) return true;
  const aim2 = stepImage(lineup, 'aim2');
  return Boolean(aim2) && aim2 !== stepImage(lineup, 'aim1');
}
/** Mirrors core `overlay::learn_slots`: captured, distinct pictures only. A second
 * stand that repeats the first image, or belongs to a single-throw lineup, is not
 * a step. Stored images are never touched. */
export function learnSlots(lineup: Lineup, required: SlotId[] = []): SlotId[] {
  const second = hasSecondThrow(lineup, required);
  const seen = new Set<string>(); const out: SlotId[] = [];
  for (const slot of SLOT_ORDER) {
    const image = stepImage(lineup, slot);
    if (!image) continue;
    if ((slot === 'stand2' || slot === 'aim2') && !second) continue;
    if (seen.has(image)) continue;
    seen.add(image); out.push(slot);
  }
  return out;
}
/** Mirrors core OverlayState::update_checklist for the live editor draft shown in the overlay. */
export function draftChecklist(lineup: Lineup, required: SlotId[], skipped: SlotId[] = []): OverlayChecklistItem[] {
  const second = hasSecondThrow(lineup, required); const steps = learnSlots(lineup, required);
  return SLOT_ORDER.filter(s => required.includes(s) || s === 'stand1' || s === 'aim1' || s === 'landing' || (second && steps.includes(s)))
    .map(slot => ({ slot, label: SLOT_LABELS[slot], required: required.includes(slot), done: Boolean(lineup.slots[slot]?.image), skipped: skipped.includes(slot) }));
}
