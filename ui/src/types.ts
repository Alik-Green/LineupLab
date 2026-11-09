export type SlotId = 'stand1' | 'aim1' | 'stand2' | 'aim2' | 'landing';
export const SLOT_ORDER: SlotId[] = ['stand1', 'aim1', 'stand2', 'aim2', 'landing'];
export const SLOT_LABELS: Record<SlotId, string> = { stand1: 'Stand', aim1: 'Aim', stand2: 'Second stand', aim2: 'Second aim', landing: 'Landing' };
export interface Point { x: number; y: number }
/** Exact legacy circle field names. Unknown keys are preserved via index signature. */
export interface FocusCircle {
  id: string; color: string; x: number; y: number; radius: number;
  showZoom: boolean; zoomScale: number; zoomSize: number; zoomX: number; zoomY: number;
  [key: string]: unknown;
}
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type Arrow = 'none' | 'end' | 'start' | 'both';
export interface AnnotationLine {
  id: string; color: string; width: number; points: Point[]; style: LineStyle; arrow: Arrow; label?: string | null;
  [key: string]: unknown;
}
export interface SlotData { image?: string | null; circles: FocusCircle[]; lines: AnnotationLine[]; [key: string]: unknown }
export interface ThrowSpec { index: number; label?: string | null; aimImage?: string | null; standImage?: string | null; chargeStage: number; chargeBars: number; bounces: number; throwType: string; focusCircles: FocusCircle[]; [key: string]: unknown }
export interface Step { order: number; text: string; imageRef?: string | null; [key: string]: unknown }
export interface Lineup {
  id: string; mapUuid: string; agentUuid: string; abilitySlot: string; mode: string;
  side: 'attack' | 'defense' | 'both'; site: string; difficulty: string; throwType: string;
  title: string; notes: string; tags: string[]; author: string; source: string; isFavorite: boolean;
  createdAt: string; updatedAt: string; deleted: boolean; deviceId: string; revision: number; importBatchId?: string | null;
  stand1Pos?: Point | null; aim1Pos?: Point | null; stand2Pos?: Point | null; aim2Pos?: Point | null; landPos?: Point | null;
  bounces: Point[]; slots: Record<SlotId, SlotData>; throws: ThrowSpec[]; attributes: Record<string, unknown>; steps: Step[];
  videoClip?: string | null; videoThumbnail?: string | null; legacy: Record<string, unknown>; extensions?: Record<string, unknown>; draft?: boolean;
}
export interface AbilityMode { id: string; label: string; requiredSlots: SlotId[]; optionalSlots?: SlotId[]; attributes: Record<string, { type: string; default?: unknown; min?: number; max?: number; options?: unknown[] }>; }
export interface CatalogAbility { slot: string; displayName: string; displayIcon?: string | null; description?: string }
export interface Agent { uuid: string; displayName: string; displayIcon: string; role?: string | null; roleIcon?: string | null; abilities?: CatalogAbility[]; isArchived?: boolean }
export interface MapCallout { name: string; x: number; y: number }
export interface GameMap { uuid: string; displayName: string; displayIcon: string; listViewIcon?: string | null; splash?: string | null; isArchived?: boolean; callouts?: MapCallout[] }
export interface Catalog { agents: Agent[]; maps: GameMap[]; version: string; updatedAt: string; stale?: boolean; warning?: string | null; dataDir?: string }
export interface AssetProgress { phase: 'downloading' | 'ready' | 'offline' | string; done: number; total: number; failed: number; current: string; version: string }
export interface AssetTypeReport { total: number; cached: number; missing: number; invalid: number; bytes: number }
export interface AssetAudit { version: string; cacheBytes: number; types: Record<string, AssetTypeReport>; errors: string[] }
export interface AssetDiagnostics { audit: AssetAudit; dataDir: string; cacheDir: string; assetProtocol: { enabled: boolean; scope: string[] }; platform: string }
export interface ImageLoadRecord { url: string; resolved?: string; kind: string; ok: boolean; message?: string; at: number }
export interface ImageSelfTestResult { total: number; ok: number; failed: number; types: Record<string, { total: number; ok: number; failed: number }>; errors: ImageLoadRecord[]; finishedAt: number }
export interface CaptureResult { hash: string; width: number; height: number; elapsedMs: number }
export interface ImportPreviewEntry { id: string; title: string; status: string; selected: boolean; warnings: string[] }
export interface ImportPreview { entries: ImportPreviewEntry[]; warnings: string[]; seed: boolean }
export interface ImportReport { batchId: string; imported: number; skipped: number; copied: number; overwritten: number; errors: number; warnings: string[]; importedIds: string[] }
export interface ImportProgress { phase: 'reading' | 'validating' | 'media' | 'lineups' | 'preview' | 'done' | string; message: string; current: number; total: number }
export interface LibraryAdapter {
  kind: 'tauri' | 'browser';
  listLineups(): Promise<Lineup[]>;
  getLineup(id: string): Promise<Lineup | null>;
  saveLineup(lineup: Lineup): Promise<Lineup>;
  deleteLineup(id: string): Promise<void>;
  duplicateLineup(id: string): Promise<Lineup>;
  setFavorite(id: string, value: boolean): Promise<void>;
  catalog(): Promise<Catalog>;
  prepareAssets(force: boolean): Promise<Catalog>;
  resolveImageUrl(url: string): Promise<string>;
  assetDiagnostics(): Promise<AssetDiagnostics>;
  reportImageError(url: string, message: string): Promise<void>;
  modes(): Promise<AbilityMode[]>;
  mediaUrl(hash: string): Promise<string>;
  putImage(bytes: Uint8Array, mime: string): Promise<string>;
  captureMonitor(monitor?: number): Promise<CaptureResult>;
  importPreview(bytes: Uint8Array): Promise<ImportPreview>;
  importCommit(bytes: Uint8Array, selected: string[], policy: string): Promise<ImportReport>;
  exportPack(ids: string[] | null, legacyImages: boolean, bake: boolean): Promise<Uint8Array>;
  undoImport(batchId: string): Promise<void>;
  listMonitors(): Promise<MonitorInfo[]>;
  getHotkeys(): Promise<HotkeyBinding[]>;
  rebindHotkey(action: string, keys: string): Promise<HotkeyFeedback>;
  getOverlaySettings(): Promise<OverlaySettings>;
  setOverlaySettings(settings: OverlaySettings): Promise<void>;
  learnLineup(id: string): Promise<void>;
  /** Point the overlay at a lineup; `order` drives Alt+Up/Down, `reveal` auto-switches an active overlay to Learn. */
  setOverlayLineup(id: string | null, options?: { order?: string[]; reveal?: boolean }): Promise<void>;
  setOverlayMode(mode: 'create' | 'view'): Promise<void>;
  getCaptureSettings(): Promise<CaptureSettings>;
  setCaptureSettings(settings: CaptureSettings): Promise<void>;
  startSyncServer(name?: string): Promise<SyncServerStatus>;
  stopSyncServer(): Promise<void>;
  getSyncServerStatus(): Promise<SyncServerStatus>;
  pairSync(baseUrl: string, code: string, deviceName: string): Promise<SyncPairResponse>;
  syncNow(baseUrl: string, token: string): Promise<SyncReport>;
  downloadLibrary(baseUrl: string, token: string): Promise<DownloadReport>;
  discoverSync(): Promise<DiscoveredServer[]>;
}
export interface HotkeyBinding { action: string; label: string; keys: string }
export type HotkeyFeedback = { kind: 'ok'; message: string } | { kind: 'conflict'; message: string; action: string } | { kind: 'invalid'; message: string };
export type OverlayCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export interface OverlaySettings { enabled: boolean; clickThrough: boolean; corner: OverlayCorner; monitor: number; marginX: number; marginY: number; width: number; height: number; opacity: number }
export interface MonitorInfo { index: number; name: string; isPrimary: boolean; x: number; y: number; physicalWidth: number; physicalHeight: number; logicalWidth: number; logicalHeight: number; scaleFactor: number }
export interface CaptureSettings { maxWidth: number; quality: number; webp: boolean; thumbnail: boolean; targetMs: number }
export interface SyncServerStatus { running: boolean; address?: string; pairingCode?: string; requiresCode?: boolean }
export interface SyncPairResponse { token: string; serverName: string; deviceId: string; protocolVersion: number }
export interface SyncReport { pulled: number; pushed: number; images: number; conflicts: number }
export interface DownloadReport { downloaded: number; existing: number; images: number; failed: number; totalLineups: number; totalImages: number; warnings: string[]; finishedAt: string }
export interface DownloadProgress { phase: string; message: string; current: number; total: number }
export interface DiscoveredServer { name: string; address: string; port: number }
