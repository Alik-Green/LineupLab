/** Dev-only mocked Tauri invoke/asset/event layer for Linux Playwright verification.
 * It is never imported in production builds (main.tsx guards on import.meta.env.DEV).
 * Game art URLs resolve to the Vite fixture-art middleware: real cached ability/minimap
 * files when scripts/prepare-ui-fixtures.mjs has run, otherwise synthetic SVG stand-ins. */
import fixtureCatalog from '../fixtures/catalog.json';
import type { Catalog, Lineup, SlotId } from '../types';
import { SLOT_ORDER } from '../types';
import { DEFAULT_HOTKEYS, rebindLocal } from './hotkeys';
import { DEFAULT_OVERLAY, clampOverlay, draftChecklist } from './overlay';
import abilityModes from '@data/ability_modes.json';

declare global { interface Window { __TAURI_INTERNALS__: { invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown>; convertFileSrc(path: string): string; transformCallback(cb: (e: unknown) => void, once?: boolean): number }; __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener(event: string, id: number): void }; __LL_MOCK_EMIT__(event: string, payload: unknown): void; __LL_MOCK_STATE__: Record<string, unknown> } }
const catalog = fixtureCatalog as unknown as Catalog;
const params = new URLSearchParams(location.search);
const empty = params.has('empty');
const now = '2026-11-07T12:00:00Z';
function slot(image: string | null) { return { image, circles: [], lines: [] }; }
function fixtureLineups(): Lineup[] {
  if (empty) return [];
  const specs = [
    ['Abyss', 'sova', 'Grenade', 'recon', 'B', 'attack', 'Mid Bend → B Site', true, 0.6919, 0.7016, 0.3441, 0.8831],
    ['Abyss', 'sova', 'Ability1', 'double', 'A', 'attack', 'A Main double shock', true, 0.22, 0.62, 0.28, 0.24],
    ['Abyss', 'jett', 'Grenade', 'standard', 'Mid', 'defense', 'Mid one-way smoke', false, 0.5, 0.55, 0.52, 0.35],
    ['Abyss', 'viper', 'Ability2', 'standard', 'B', 'defense', 'B site poison cloud', false, 0.72, 0.4, 0.35, 0.86],
    ['Ascent', 'sova', 'Grenade', 'recon', 'A', 'attack', 'A main recon dart', true, 0.3, 0.7, 0.25, 0.3],
    ['Ascent', 'killjoy', 'Grenade', 'standard', 'B', 'defense', 'B lockdown setup', false, 0.68, 0.62, 0.7, 0.25],
    ['Ascent', 'omen', 'Ability2', 'standard', 'Mid', 'attack', 'Mid paranoia smoke', false, 0.48, 0.6, 0.5, 0.42],
    ['Bind', 'raze', 'Ability2', 'standard', 'A', 'attack', 'A short blast pack', true, 0.25, 0.5, 0.3, 0.28],
    ['Bind', 'breach', 'Ability1', 'standard', 'B', 'attack', 'B long aftershock', false, 0.6, 0.7, 0.72, 0.3],
    ['Haven', 'cypher', 'Ability1', 'standard', 'C', 'defense', 'C long trapwire', false, 0.8, 0.55, 0.75, 0.8],
    ['Lotus', 'fade', 'Grenade', 'standard', 'A', 'attack', 'A root haunt', true, 0.3, 0.4, 0.25, 0.2],
    ['Split', 'sage', 'Grenade', 'standard', 'Mid', 'defense', 'Mid barrier orb', false, 0.5, 0.5, 0.5, 0.3],
  ] as const;
  return specs.map((s, i) => {
    const [map, agent, ability, mode, site, side, title, fav, sx, sy, lx, ly] = s;
    const id = `fixture-${i}`;
    const l: Lineup = { id, mapUuid: `map-${map.toLowerCase()}`, agentUuid: `agent-${agent}`, abilitySlot: ability, mode, side, site, difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard', throwType: i % 2 ? 'jump-throw' : 'normal', title, notes: 'Fixture lineup for UI verification. Stand on the marked corner, align the crosshair, then throw.', tags: ['fixture', side, site.toLowerCase()], author: 'LineupLab', source: 'fixture', isFavorite: fav, createdAt: now, updatedAt: now, deleted: false, deviceId: 'mock', revision: 1, importBatchId: null, stand1Pos: { x: sx, y: sy }, landPos: { x: lx, y: ly }, bounces: i % 4 === 0 ? [{ x: (sx + lx) / 2, y: (sy + ly) / 2 }] : [], slots: Object.fromEntries(SLOT_ORDER.map(k => [k, slot(k === 'stand2' || k === 'aim2' ? null : `fx-${k}-${i}`)])) as Record<SlotId, ReturnType<typeof slot>>, throws: [], attributes: { bounces: i % 4 === 0 ? 1 : 0, chargeStage: 1 }, steps: [{ order: 1, text: 'Stand on the marked corner', imageRef: `fx-stand1-${i}` }, { order: 2, text: 'Align the crosshair with the marker', imageRef: `fx-aim1-${i}` }, { order: 3, text: 'Throw and confirm landing', imageRef: `fx-landing-${i}` }], videoClip: null, videoThumbnail: null, legacy: {}, extensions: {}, draft: false };
    l.slots.aim1.circles = [{ id: `c-${i}`, color: 'cyan', x: 0.62, y: 0.34, radius: 0.025, showZoom: true, zoomScale: 3.5, zoomSize: 0.22, zoomX: 0.74, zoomY: 0.04 }];
    l.slots.aim1.lines = [{ id: `l-${i}`, color: 'yellow', width: 0.003, points: [{ x: 0.3, y: 0.75 }, { x: 0.62, y: 0.34 }], style: 'dashed', arrow: 'end', label: 'align' }];
    return l;
  });
}
let lineups = fixtureLineups();
const mockDraft = lineups[0] ? structuredClone(lineups[0]) : null; if (mockDraft) { mockDraft.slots.landing.image = null; mockDraft.title = 'Mid Bend → B Site (draft)'; }
let overlayLineup: Lineup | null = lineups[0] ?? null;
const overlayState = { settings: { ...DEFAULT_OVERLAY, opacity: 0.92 }, visible: true, mode: params.get('overlayMode') === 'view' ? 'view' as const : 'create' as const, showChecklist: true, checklist: mockDraft ? draftChecklist(mockDraft, ['stand1', 'aim1', 'landing']) : [], viewSlots: ['stand1', 'aim1', 'landing'] as SlotId[], viewIndex: 1, flipped: params.has('flipped') };
const listeners = new Map<string, Set<number>>();
let callbackId = 1; let eventId = 1;
const callbacks = new Map<number, (e: unknown) => void>();
// Emulate Tauri's cross-window event bus for dev pages (main + overlay) in the same browser context.
const mockBus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lineuplab-mock-events') : null;
function emitLocal(event: string, payload: unknown) { for (const id of listeners.get(event) ?? []) callbacks.get(id)?.({ event, id, payload }); }
function emit(event: string, payload: unknown) { emitLocal(event, payload); try { mockBus?.postMessage({ event, payload }); } catch { /* non-cloneable payload */ } }
if (mockBus) mockBus.onmessage = e => { const { event, payload } = e.data ?? {}; if (typeof event === 'string') emitLocal(event, payload); };
window.__LL_MOCK_EMIT__ = emit;
window.__LL_MOCK_STATE__ = { lineups, catalog };
function artPath(url: string) {
  try { const u = new URL(url); const parts = u.pathname.split('/').filter(Boolean); const kind = parts[0]; const slug = parts[1] ?? 'unknown'; const file = parts[2] ?? '';
    const mapped = kind === 'maps' ? (file.startsWith('displayicon') ? 'minimap' : file.startsWith('listview') ? 'map' : 'mapSplash') : kind === 'agents' ? 'agent' : kind === 'abilities' ? 'ability' : 'role';
    return `/fixture-art/${mapped}/${slug}`;
  } catch { return url; }
}
function allModes() { const cfg = abilityModes as unknown as { defaults: Record<string, unknown>[]; rules: { modes: Record<string, unknown>[] }[] }; const seen = new Set<string>(); const out: unknown[] = []; for (const m of [...cfg.defaults, ...cfg.rules.flatMap(r => r.modes)]) if (!seen.has(m.id as string)) { seen.add(m.id as string); out.push(m); } return out; }
async function invoke(cmd: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const a = args as Record<string, any>;
  switch (cmd) {
    case 'list_lineups': return lineups.filter(l => !l.deleted);
    case 'get_lineup': return lineups.find(l => l.id === a.id) ?? null;
    case 'save_lineup': { const l = args.lineup as Lineup; const next = { ...l, updatedAt: new Date().toISOString(), revision: l.revision + 1, draft: false }; const i = lineups.findIndex(x => x.id === l.id); if (i >= 0) lineups[i] = next; else lineups.push(next); return next; }
    case 'delete_lineup': lineups = lineups.map(l => l.id === a.id ? { ...l, deleted: true } : l); return null;
    case 'duplicate_lineup': { const l = lineups.find(x => x.id === a.id); if (!l) throw new Error('Not found'); const copy = { ...structuredClone(l), id: crypto.randomUUID(), title: `${l.title} (copy)` }; lineups.push(copy); return copy; }
    case 'set_favorite': lineups = lineups.map(l => l.id === a.id ? { ...l, isFavorite: a.value } : l); return null;
    case 'get_catalog': return catalog;
    case 'prepare_assets': if (params.has('slow-assets')) { await new Promise(r => setTimeout(r, 400)); emit('lineuplab://assets', { phase: 'downloading', done: 34, total: 120, failed: 0, current: 'ability: sova-grenade', version: catalog.version }); await new Promise(r => setTimeout(r, 6000)); } emit('lineuplab://assets', { phase: 'ready', done: 120, total: 120, failed: 0, current: '', version: catalog.version }); return catalog;
    case 'catalog_image_url': return artPath(a.url);
    case 'asset_diagnostics': { const types: Record<string, { total: number; cached: number; missing: number; invalid: number; bytes: number }> = {}; const add = (k: string) => { const t = types[k] ??= { total: 0, cached: 0, missing: 0, invalid: 0, bytes: 0 }; t.total++; t.cached++; t.bytes += 4096; }; for (const ag of catalog.agents) { add('agent'); if (ag.roleIcon) add('role'); for (const b of ag.abilities ?? []) if (b.displayIcon) add('ability'); } for (const m of catalog.maps) { add('minimap'); if (m.listViewIcon) add('map'); if (m.splash) add('mapSplash'); } return { audit: { version: catalog.version, cacheBytes: Object.values(types).reduce((s, t) => s + t.bytes, 0), types, errors: [] }, dataDir: '/mock/app-data', cacheDir: '/mock/app-data/art-cache', assetProtocol: { enabled: true, scope: ['$APPDATA/**'] }, platform: 'mock-tauri' }; }
    case 'log_image_error': console.warn('[mock image error]', a.url, a.message); return null;
    case 'get_modes': return allModes();
    case 'media_path': return `/fixture-media/${a.hash}`;
    case 'put_image': return `fx-upload-${Date.now()}`;
    case 'capture_monitor': return { hash: `fx-capture-${Date.now()}`, width: 1600, height: 900, elapsedMs: 42 };
    case 'list_monitors': return [
      { index: 0, name: 'Primary 1440p', isPrimary: true, x: 0, y: 0, physicalWidth: 2560, physicalHeight: 1440, logicalWidth: 2560, logicalHeight: 1440, scaleFactor: 1 },
      { index: 1, name: 'Secondary 1080p', isPrimary: false, x: 2560, y: 0, physicalWidth: 1920, physicalHeight: 1080, logicalWidth: 1920, logicalHeight: 1080, scaleFactor: 1 },
    ];
    case 'import_preview': {
      if (params.has('import-error')) throw new Error('Mock legacy pack failure: manifest.json is missing or unreadable.');
      const entries = [{ id: 'p1', title: 'Abyss Sova recon', status: 'new', selected: true, warnings: [] }, { id: 'p2', title: 'Ascent Jett smoke', status: 'identical', selected: false, warnings: [] }, { id: 'p3', title: 'Bind Raze satchel', status: 'newer', selected: true, warnings: ['Newer revision'] }, { id: 'p4', title: 'Broken entry', status: 'error', selected: false, warnings: ['Missing landing image'] }];
      emit('lineuplab://import-progress', { phase: 'reading', message: 'Reading ZIP pack', current: 0, total: 0 });
      if (params.has('slow-import')) await new Promise(r => setTimeout(r, 450));
      emit('lineuplab://import-progress', { phase: 'validating', message: 'Validating legacy entries and media', current: 0, total: entries.length });
      if (params.has('slow-import')) await new Promise(r => setTimeout(r, 650));
      emit('lineuplab://import-progress', { phase: 'preview', message: 'Preview ready', current: entries.length, total: entries.length });
      return { seed: false, warnings: ['Fixture preview: no real pack was supplied.'], entries };
    }
    case 'import_commit': {
      const selected = Array.isArray(a.selected) ? a.selected as string[] : [];
      const total = Math.max(1, selected.length);
      emit('lineuplab://import-progress', { phase: 'reading', message: 'Reading ZIP pack', current: 0, total: 0 });
      if (params.has('slow-import')) await new Promise(r => setTimeout(r, 350));
      for (let i = 0; i <= 3; i++) { emit('lineuplab://import-progress', { phase: 'media', message: `Copying pack media (${i}/3)`, current: i, total: 3 }); if (params.has('slow-import')) await new Promise(r => setTimeout(r, 300)); }
      for (let i = 0; i <= total; i++) { emit('lineuplab://import-progress', { phase: 'lineups', message: `Writing lineups (${i}/${total})`, current: i, total }); if (params.has('slow-import')) await new Promise(r => setTimeout(r, 300)); }
      emit('lineuplab://import-progress', { phase: 'done', message: 'Import finished', current: total, total });
      return { batchId: 'mock-batch', imported: selected.length, skipped: 0, copied: a.policy === 'import-as-copy' ? selected.length : 0, overwritten: 0, errors: 0, warnings: [], importedIds: selected };
    }
    case 'export_pack': return [80, 75, 3, 4];
    case 'undo_import': return null;
    case 'get_hotkeys': return JSON.parse(localStorage.getItem('mock.hotkeys') ?? 'null') ?? DEFAULT_HOTKEYS;
    case 'rebind_hotkey': { const bindings = JSON.parse(localStorage.getItem('mock.hotkeys') ?? 'null') ?? DEFAULT_HOTKEYS; const r = rebindLocal(bindings, a.action, a.keys); if (r.feedback.kind === 'ok') localStorage.setItem('mock.hotkeys', JSON.stringify(r.bindings)); return r.feedback; }
    case 'get_overlay_settings': return clampOverlay({ ...DEFAULT_OVERLAY, ...JSON.parse(localStorage.getItem('mock.overlay') ?? '{}') });
    case 'set_overlay_settings': localStorage.setItem('mock.overlay', JSON.stringify(args.settings)); return null;
    case 'get_capture_settings': return { maxWidth: 1600, quality: 85, webp: true, thumbnail: true, targetMs: 150, ...JSON.parse(localStorage.getItem('mock.capture') ?? '{}') };
    case 'set_capture_settings': localStorage.setItem('mock.capture', JSON.stringify(args.settings)); return null;
    case 'get_overlay_view': { overlayState.settings = { ...overlayState.settings, ...clampOverlay({ ...DEFAULT_OVERLAY, ...JSON.parse(localStorage.getItem('mock.overlay') ?? '{}') }) }; return { state: overlayState, lineup: overlayState.mode === 'create' ? mockDraft : overlayLineup }; }
    case 'overlay_action': { const s = overlayState; switch (a.action) { case 'overlay_toggle': s.visible = !s.visible; break; case 'overlay_controls': s.settings.clickThrough = !s.settings.clickThrough; s.visible = true; break; case 'overlay_mode': s.mode = s.mode === 'create' ? 'view' : 'create'; s.flipped = false; break; case 'view_next': s.viewIndex = (s.viewIndex + 1) % Math.max(1, s.viewSlots.length); break; case 'view_prev': s.viewIndex = (s.viewIndex + s.viewSlots.length - 1) % Math.max(1, s.viewSlots.length); break; case 'view_flip': s.flipped = !s.flipped; break; case 'checklist_toggle': s.showChecklist = !s.showChecklist; break; } emit('lineuplab://overlay-changed', s); return null; }
    case 'set_overlay_lineup': { overlayLineup = lineups.find(l => l.id === a.id) ?? null; if (overlayLineup) { overlayState.viewSlots = SLOT_ORDER.filter(k => overlayLineup!.slots[k].image); overlayState.viewIndex = 0; overlayState.checklist = draftChecklist(overlayLineup, ['stand1', 'aim1', 'landing']); } emit('lineuplab://overlay-changed', overlayState); return null; }
    case 'start_sync_server': return { running: true, address: '192.168.1.20:8765', pairingCode: '482913' };
    case 'stop_sync_server': return null;
    case 'get_sync_server_status': return { running: false };
    case 'pair_sync': return { token: 'mock-token', serverName: 'Desktop library', deviceId: 'desktop', protocolVersion: 1 };
    case 'sync_now': return { pulled: 12, pushed: 0, images: 34, conflicts: 0 };
    case 'discover_sync': return [{ name: 'Desktop library', address: '192.168.1.20', port: 8765 }];
    case 'get_sync_settings': return JSON.parse(localStorage.getItem('mock.sync') ?? '{}');
    case 'set_sync_settings': localStorage.setItem('mock.sync', JSON.stringify(args.settings)); return null;
    case 'plugin:event|listen': { const id = eventId++; const set = listeners.get(a.event) ?? new Set(); set.add(a.handler); listeners.set(a.event, set); return id; }
    case 'plugin:event|unlisten': { listeners.get(a.event)?.delete(a.eventId); return null; }
    case 'plugin:event|emit': emit(a.event, args.payload); return null;
    default: throw new Error(`Mock Tauri command not implemented: ${cmd}`);
  }
}
export function installMockTauri() {
  window.__TAURI_INTERNALS__ = { invoke, convertFileSrc: p => p, transformCallback(cb) { const id = callbackId++; callbacks.set(id, cb); return id; } };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener(event, id) { listeners.get(event)?.delete(id); } };
}
