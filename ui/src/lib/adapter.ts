import { invoke } from '@tauri-apps/api/core';
import type { AbilityMode, CaptureResult, CaptureSettings, Catalog, HotkeyBinding, HotkeyFeedback, ImportPreview, ImportReport, LibraryAdapter, Lineup, OverlaySettings, SlotData, SlotId } from '../types';
import { DEFAULT_HOTKEYS, rebindLocal } from './hotkeys';
import { clampOverlay, DEFAULT_OVERLAY } from './overlay';
import { SLOT_ORDER } from '../types';

export const emptySlot = (): SlotData => ({ image: null, circles: [], lines: [] });
export function newLineup(deviceId = 'browser'): Lineup {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), mapUuid: '', agentUuid: '', abilitySlot: 'Grenade', mode: 'standard', side: 'both', site: '', difficulty: 'medium', throwType: 'normal', title: '', notes: '', tags: [], author: '', source: 'local', isFavorite: false, createdAt: now, updatedAt: now, deleted: false, deviceId, revision: 1, importBatchId: null, stand1Pos: null, aim1Pos: null, stand2Pos: null, aim2Pos: null, landPos: null, bounces: [], slots: Object.fromEntries(SLOT_ORDER.map(s => [s, emptySlot()])) as Record<SlotId, SlotData>, throws: [], attributes: {}, steps: [], videoClip: null, videoThumbnail: null, legacy: {}, draft: false };
}
const svg = (label: string, a: string, b: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><path d="M0 650 L400 420 L820 560 L1240 300 L1600 480 V900 H0Z" fill="#0f172a" opacity=".45"/><circle cx="1180" cy="270" r="46" fill="#f8fafc" opacity=".8"/><text x="60" y="110" font-family="sans-serif" font-size="64" fill="#f8fafc">${label}</text><text x="60" y="170" font-family="sans-serif" font-size="28" fill="#cbd5e1">Synthetic placeholder — not Riot art</text></svg>`)}`;
const DEMO_IMAGES: Record<string, string> = { 'demo-stand': svg('Stand position', '#164e63', '#0f172a'), 'demo-aim': svg('Aim reference', '#3b0764', '#0f172a'), 'demo-land': svg('Landing preview', '#14532d', '#0f172a'), 'demo-map': svg('Synthetic minimap', '#1e293b', '#0f172a') };
export const DEMO_MODES: AbilityMode[] = [
  { id: 'standard', label: 'Standard', requiredSlots: ['stand1', 'aim1', 'landing'], attributes: {} },
  { id: 'recon', label: 'Recon bolt', requiredSlots: ['stand1', 'aim1', 'landing'], attributes: { chargeStage: { type: 'number', default: 1, min: 0, max: 2 }, bounces: { type: 'number', default: 0, min: 0, max: 2 } } },
  { id: 'double-shock', label: 'Double shock', requiredSlots: ['stand1', 'aim1', 'stand2', 'aim2', 'landing'], optionalSlots: [], attributes: { chargeStage: { type: 'number', default: 1, min: 0, max: 2 }, chargeBars: { type: 'number', default: 2, min: 0, max: 2 }, doubleShock: { type: 'boolean', default: true } } },
];
function demoLineups(): Lineup[] {
  const base = newLineup('demo'); const now = '2026-01-02T03:04:05Z';
  const l: Lineup = { ...base, id: 'demo-abyss-sova', mapUuid: 'demo-map', agentUuid: 'demo-sova', abilitySlot: 'Grenade', mode: 'recon', side: 'attack', site: 'B', title: 'Mid Bend → B Site (synthetic)', notes: 'Demo lineup using synthetic placeholder images.', tags: ['demo', 'recon'], author: 'LineupLab', isFavorite: true, createdAt: now, updatedAt: now, stand1Pos: { x: 0.6919, y: 0.7016 }, landPos: { x: 0.3441, y: 0.8831 }, attributes: { chargeStage: 1, bounces: 1 }, steps: [{ order: 1, text: 'Stand on the marker', imageRef: 'demo-stand' }, { order: 2, text: 'Align the crosshair', imageRef: 'demo-aim' }] };
  l.slots.stand1 = { image: 'demo-stand', circles: [], lines: [] };
  l.slots.aim1 = { image: 'demo-aim', circles: [{ id: 'demo-circle', color: 'cyan', x: 0.7375, y: 0.3, radius: 0.025, showZoom: true, zoomScale: 3.5, zoomSize: 0.24, zoomX: 0.72, zoomY: 0.04, legacyNote: 'preserved' }], lines: [{ id: 'demo-line', color: 'yellow', width: 0.003, points: [{ x: 0.2, y: 0.8 }, { x: 0.7375, y: 0.3 }], style: 'dashed', arrow: 'end', label: 'align' }] };
  l.slots.landing = { image: 'demo-land', circles: [], lines: [] };
  return [l, { ...l, id: 'demo-split-jett', mapUuid: 'demo-map', agentUuid: 'demo-jett', title: 'Smoke one-way (synthetic)', site: 'A', mode: 'standard', isFavorite: false, tags: ['demo'], attributes: {} }];
}
export class BrowserAdapter implements LibraryAdapter {
  kind = 'browser' as const; private images = new Map<string, string>(Object.entries(DEMO_IMAGES));
  private load(): Lineup[] { try { const raw = localStorage.getItem('lineuplab.lineups'); if (raw) return JSON.parse(raw); } catch { /* ignore */ } const d = demoLineups(); localStorage.setItem('lineuplab.lineups', JSON.stringify(d)); return d; }
  private persist(all: Lineup[]) { localStorage.setItem('lineuplab.lineups', JSON.stringify(all)); }
  async listLineups() { return this.load().filter(l => !l.deleted); }
  async getLineup(id: string) { return this.load().find(l => l.id === id) ?? null; }
  async saveLineup(lineup: Lineup) { const all = this.load(); const next = { ...lineup, updatedAt: new Date().toISOString(), revision: lineup.revision + 1, draft: false }; const i = all.findIndex(l => l.id === lineup.id); if (i >= 0) all[i] = next; else all.push(next); this.persist(all); return next; }
  async deleteLineup(id: string) { const all = this.load().map(l => l.id === id ? { ...l, deleted: true, updatedAt: new Date().toISOString(), revision: l.revision + 1 } : l); this.persist(all); }
  async duplicateLineup(id: string) { const l = await this.getLineup(id); if (!l) throw new Error('Not found'); const copy = { ...structuredClone(l), id: crypto.randomUUID(), title: `${l.title} (copy)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 1, importBatchId: null }; const all = this.load(); all.push(copy); this.persist(all); return copy; }
  async setFavorite(id: string, value: boolean) { const l = await this.getLineup(id); if (l) await this.saveLineup({ ...l, isFavorite: value }); }
  async catalog(): Promise<Catalog> { return { version: 'demo', updatedAt: new Date().toISOString(), agents: [{ uuid: 'demo-sova', displayName: 'Sova (demo)', displayIcon: '' }, { uuid: 'demo-jett', displayName: 'Jett (demo)', displayIcon: '' }], maps: [{ uuid: 'demo-map', displayName: 'Synthetic map', displayIcon: DEMO_IMAGES['demo-map'] }] }; }
  async modes() { return DEMO_MODES; }
  async mediaUrl(hash: string) { return this.images.get(hash) ?? hash; }
  async putImage(bytes: Uint8Array, mime: string) { const hash = `img-${await sha256(bytes)}`; let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b)); this.images.set(hash, `data:${mime};base64,${btoa(bin)}`); return hash; }
  async captureMonitor(): Promise<CaptureResult> { throw new Error('Screen capture requires the Windows desktop app.'); }
  async importPreview(): Promise<ImportPreview> { throw new Error('Pack import requires the desktop core (or CLI).'); }
  async importCommit(): Promise<ImportReport> { throw new Error('Pack import requires the desktop core (or CLI).'); }
  async exportPack(): Promise<Uint8Array> { throw new Error('Pack export requires the desktop core (or CLI).'); }
  async undoImport(): Promise<void> { throw new Error('Undo import requires the desktop core.'); }
  async getHotkeys(): Promise<HotkeyBinding[]> { try { return JSON.parse(localStorage.getItem('lineuplab.hotkeys') ?? 'null') ?? DEFAULT_HOTKEYS; } catch { return DEFAULT_HOTKEYS; } }
  async rebindHotkey(action: string, keys: string): Promise<HotkeyFeedback> { const { bindings, feedback } = rebindLocal(await this.getHotkeys(), action, keys); if (feedback.kind === 'ok') localStorage.setItem('lineuplab.hotkeys', JSON.stringify(bindings)); return feedback; }
  async getOverlaySettings(): Promise<OverlaySettings> { try { return clampOverlay({ ...DEFAULT_OVERLAY, ...JSON.parse(localStorage.getItem('lineuplab.overlay') ?? '{}') }); } catch { return DEFAULT_OVERLAY; } }
  async setOverlaySettings(settings: OverlaySettings) { localStorage.setItem('lineuplab.overlay', JSON.stringify(clampOverlay(settings))); }
  async getCaptureSettings(): Promise<CaptureSettings> { try { return { maxWidth: 1600, quality: 85, webp: true, thumbnail: true, targetMs: 150, ...JSON.parse(localStorage.getItem('lineuplab.capture') ?? '{}') }; } catch { return { maxWidth: 1600, quality: 85, webp: true, thumbnail: true, targetMs: 150 }; } }
  async setCaptureSettings(settings: CaptureSettings) { localStorage.setItem('lineuplab.capture', JSON.stringify(settings)); }
}
export class TauriAdapter implements LibraryAdapter {
  kind = 'tauri' as const;
  listLineups() { return invoke<Lineup[]>('list_lineups'); }
  getLineup(id: string) { return invoke<Lineup | null>('get_lineup', { id }); }
  saveLineup(lineup: Lineup) { return invoke<Lineup>('save_lineup', { lineup }); }
  deleteLineup(id: string) { return invoke<void>('delete_lineup', { id }); }
  duplicateLineup(id: string) { return invoke<Lineup>('duplicate_lineup', { id }); }
  setFavorite(id: string, value: boolean) { return invoke<void>('set_favorite', { id, value }); }
  catalog() { return invoke<Catalog>('get_catalog'); }
  modes() { return invoke<AbilityMode[]>('get_modes'); }
  mediaUrl(hash: string) { return invoke<string>('media_url', { hash }); }
  async putImage(bytes: Uint8Array, mime: string) { return invoke<string>('put_image', { bytes: Array.from(bytes), mime }); }
  captureMonitor(monitor?: number) { return invoke<CaptureResult>('capture_monitor', { monitor }); }
  importPreview(bytes: Uint8Array) { return invoke<ImportPreview>('import_preview', { bytes: Array.from(bytes) }); }
  importCommit(bytes: Uint8Array, selected: string[], policy: string) { return invoke<ImportReport>('import_commit', { bytes: Array.from(bytes), selected, policy }); }
  async exportPack(ids: string[] | null, legacyImages: boolean, bake: boolean) { return new Uint8Array(await invoke<number[]>('export_pack', { ids, legacyImages, bake })); }
  undoImport(batchId: string) { return invoke<void>('undo_import', { batchId }); }
  getHotkeys() { return invoke<HotkeyBinding[]>('get_hotkeys'); }
  rebindHotkey(action: string, keys: string) { return invoke<HotkeyFeedback>('rebind_hotkey', { action, keys }); }
  getOverlaySettings() { return invoke<OverlaySettings>('get_overlay_settings'); }
  setOverlaySettings(settings: OverlaySettings) { return invoke<void>('set_overlay_settings', { settings }); }
  getCaptureSettings() { return invoke<CaptureSettings>('get_capture_settings'); }
  setCaptureSettings(settings: CaptureSettings) { return invoke<void>('set_capture_settings', { settings }); }
}
export function createAdapter(): LibraryAdapter { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window ? new TauriAdapter() : new BrowserAdapter(); }
async function sha256(bytes: Uint8Array) { const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource); return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join(''); }
