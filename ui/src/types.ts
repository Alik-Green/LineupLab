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
  videoClip?: string | null; videoThumbnail?: string | null; legacy: Record<string, unknown>; draft?: boolean;
}
export interface AbilityMode { id: string; label: string; requiredSlots: SlotId[]; optionalSlots?: SlotId[]; attributes: Record<string, { type: string; default?: unknown; min?: number; max?: number; options?: unknown[] }>; }
export interface Agent { uuid: string; displayName: string; displayIcon: string; role?: string; isArchived?: boolean }
export interface GameMap { uuid: string; displayName: string; displayIcon: string; isArchived?: boolean }
export interface Catalog { agents: Agent[]; maps: GameMap[]; version: string; updatedAt: string; stale?: boolean }
export interface CaptureResult { hash: string; width: number; height: number; elapsedMs: number }
export interface ImportPreviewEntry { id: string; title: string; status: string; selected: boolean; warnings: string[] }
export interface ImportPreview { entries: ImportPreviewEntry[]; warnings: string[]; seed: boolean }
export interface ImportReport { batchId: string; imported: number; skipped: number; copied: number; errors: string[] }
export interface LibraryAdapter {
  kind: 'tauri' | 'browser';
  listLineups(): Promise<Lineup[]>;
  getLineup(id: string): Promise<Lineup | null>;
  saveLineup(lineup: Lineup): Promise<Lineup>;
  deleteLineup(id: string): Promise<void>;
  duplicateLineup(id: string): Promise<Lineup>;
  setFavorite(id: string, value: boolean): Promise<void>;
  catalog(): Promise<Catalog>;
  modes(): Promise<AbilityMode[]>;
  mediaUrl(hash: string): Promise<string>;
  putImage(bytes: Uint8Array, mime: string): Promise<string>;
  captureMonitor(monitor?: number): Promise<CaptureResult>;
  importPreview(bytes: Uint8Array): Promise<ImportPreview>;
  importCommit(bytes: Uint8Array, selected: string[], policy: string): Promise<ImportReport>;
  exportPack(ids: string[] | null, legacyImages: boolean, bake: boolean): Promise<Uint8Array>;
  undoImport(batchId: string): Promise<void>;
}
