import { describe, expect, it } from 'vitest';
import { DEFAULT_HOTKEYS, eventToHotkey, hotkeyConflict, normalizeHotkey, rebindLocal } from './hotkeys';
import { clampOverlay, DEFAULT_OVERLAY, overlayPosition } from './overlay';
describe('hotkeys', () => {
  it('normalizes modifier order and requires Alt', () => { expect(normalizeHotkey('shift+alt+q')).toBe('Alt+Shift+Q'); expect(normalizeHotkey('Ctrl+C')).toBeNull(); expect(normalizeHotkey('Alt+ArrowLeft')).toBe('Alt+Left'); expect(normalizeHotkey('Alt+F13')).toBe('Alt+F13'); expect(normalizeHotkey('Alt+F25')).toBeNull(); });
  it('defaults are unique and conflicts are reported', () => { const keys = DEFAULT_HOTKEYS.map(b => normalizeHotkey(b.keys)); expect(new Set(keys).size).toBe(keys.length); expect(hotkeyConflict(DEFAULT_HOTKEYS, 'alt+x', 'capture')?.action).toBe('crosshair_circle'); const r = rebindLocal(DEFAULT_HOTKEYS, 'capture', 'Alt+X'); expect(r.feedback.kind).toBe('conflict'); expect(r.bindings).toBe(DEFAULT_HOTKEYS); const ok = rebindLocal(DEFAULT_HOTKEYS, 'capture', 'alt+shift+q'); expect(ok.feedback.kind).toBe('ok'); expect(ok.bindings.find(b => b.action === 'capture')?.keys).toBe('Alt+Shift+Q'); });
  it('converts keyboard events', () => { expect(eventToHotkey({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, key: 's' } as KeyboardEvent)).toBe('Alt+Shift+S'); });
});
describe('overlay settings', () => {
  it('clamps and positions corners', () => { const s = clampOverlay({ ...DEFAULT_OVERLAY, opacity: 2, width: 50 }); expect(s.opacity).toBe(1); expect(s.width).toBe(200); expect(overlayPosition({ ...DEFAULT_OVERLAY, corner: 'bottom-right' }, 1920, 1080)).toEqual({ x: 1476, y: 736 }); expect(overlayPosition({ ...DEFAULT_OVERLAY, corner: 'top-left' }, 1920, 1080)).toEqual({ x: 24, y: 24 }); });
});
