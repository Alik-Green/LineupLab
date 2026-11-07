import type { HotkeyBinding, HotkeyFeedback } from '../types';
export const DEFAULT_HOTKEYS: HotkeyBinding[] = [
  ['capture', 'Capture current slot', 'Alt+C'], ['crosshair_circle', 'Crosshair circle', 'Alt+X'], ['retake', 'Retake last capture', 'Alt+R'],
  ['next_slot', 'Next slot', 'Alt+N'], ['prev_slot', 'Previous slot', 'Alt+P'], ['slot_stand1', 'Select stand', 'Alt+1'], ['slot_aim1', 'Select aim', 'Alt+2'], ['slot_stand2', 'Select second stand', 'Alt+3'], ['slot_aim2', 'Select second aim', 'Alt+4'], ['slot_landing', 'Select landing', 'Alt+5'],
  ['save', 'Save lineup', 'Alt+S'], ['save_next', 'Save & next', 'Alt+Shift+S'], ['discard', 'Discard draft', 'Alt+D'], ['undo', 'Undo', 'Alt+Z'], ['redo', 'Redo', 'Alt+Y'],
  ['overlay_toggle', 'Show/hide overlay', 'Alt+V'], ['overlay_controls', 'Overlay controls', 'Alt+O'], ['overlay_mode', 'Toggle Create/Learn', 'Alt+M'], ['overlay_minimal', 'Toggle minimal overlay', 'Alt+I'], ['view_next', 'Learn: next image', 'Alt+Right'], ['view_prev', 'Learn: previous image', 'Alt+Left'], ['view_flip', 'Learn: flip steps/map', 'Alt+F'], ['checklist_toggle', 'Create: toggle checklist', 'Alt+H'],
].map(([action, label, keys]) => ({ action, label, keys }));
const NAMED: Record<string, string> = { left: 'Left', arrowleft: 'Left', right: 'Right', arrowright: 'Right', up: 'Up', arrowup: 'Up', down: 'Down', arrowdown: 'Down', space: 'Space', enter: 'Enter', return: 'Enter', tab: 'Tab', esc: 'Escape', escape: 'Escape', backspace: 'Backspace', delete: 'Delete', del: 'Delete', insert: 'Insert', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown', plus: 'Plus', minus: 'Minus', comma: 'Comma', period: 'Period', slash: 'Slash', backslash: 'Backslash', semicolon: 'Semicolon', quote: 'Quote', bracketleft: 'BracketLeft', bracketright: 'BracketRight' };
export function normalizeHotkey(keys: string): string | null {
  const mods = new Set<string>(); let key: string | null = null;
  for (const part of keys.split('+').map(p => p.trim()).filter(Boolean)) {
    const l = part.toLowerCase();
    if (l === 'alt') mods.add('Alt'); else if (l === 'ctrl' || l === 'control') mods.add('Ctrl'); else if (l === 'shift') mods.add('Shift'); else if (['meta', 'cmd', 'super', 'win'].includes(l)) mods.add('Meta');
    else { if (key) return null; if (NAMED[l]) key = NAMED[l]; else if (/^f([1-9]|1\d|2[0-4])$/.test(l)) key = l.toUpperCase(); else if (/^[a-z0-9]$/.test(l)) key = l.toUpperCase(); else return null; }
  }
  if (!mods.has('Alt') || !key) return null;
  return [...['Ctrl', 'Alt', 'Shift', 'Meta'].filter(m => mods.has(m)), key].join('+');
}
export function hotkeyConflict(bindings: HotkeyBinding[], keys: string, except: string): HotkeyBinding | null { const k = normalizeHotkey(keys); if (!k) return null; return bindings.find(b => b.action !== except && normalizeHotkey(b.keys) === k) ?? null; }
export function rebindLocal(bindings: HotkeyBinding[], action: string, keys: string): { bindings: HotkeyBinding[]; feedback: HotkeyFeedback } {
  const k = normalizeHotkey(keys); if (!k) return { bindings, feedback: { kind: 'invalid', message: 'Hotkeys must include Alt and a supported key.' } };
  const c = hotkeyConflict(bindings, k, action); if (c) return { bindings, feedback: { kind: 'conflict', message: `${c.label} already uses ${c.keys}`, action: c.action } };
  const next = bindings.map(b => b.action === action ? { ...b, keys: k } : b); const b = next.find(x => x.action === action); if (!b) return { bindings, feedback: { kind: 'invalid', message: `Unknown action ${action}` } };
  return { bindings: next, feedback: { kind: 'ok', message: `${b.label} bound to ${k}` } };
}
export function eventToHotkey(e: KeyboardEvent): string | null { const mods: string[] = []; if (e.ctrlKey) mods.push('Ctrl'); if (e.altKey) mods.push('Alt'); if (e.shiftKey) mods.push('Shift'); if (e.metaKey) mods.push('Meta'); const key = e.key.length === 1 ? e.key.toUpperCase() : e.key; return normalizeHotkey([...mods, key].join('+')); }
