export type AbilitySlot = "Ability1" | "Ability2" | "Grenade" | "Ultimate";
export type Side = "attack" | "defense" | "both";
export type Difficulty = "easy" | "normal" | "hard";
export type Importance = "essential" | "useful" | "optional";

export type LineupSource = "demo" | "import" | "user";
export type LineupStatus = "ok" | "incomplete" | "archived";

// Extended internal slots for new Create flow + import mapping
export interface LineupSlots {
  stand1?: string; // blob URL or asset id
  aim1?: string;
  stand2?: string;
  aim2?: string;
  landing?: string;
}

export interface LineupThrow {
  type?: string; // Standing, Jump throw etc
  tick?: number;
  note?: string;
}

export interface LineupStep {
  id?: string;
  title?: string;
  description?: string;
  image?: string; // media asset key
  circles?: LineupCircle[]; // annotations per step
}

export interface LineupAttributes {
  side?: Side;
  site?: string;
  difficulty?: Difficulty;
  importance?: Importance;
  tags?: string[];
  requiresLineup?: boolean;
  // any extra legacy attributes kept
  [key: string]: any;
}

export interface LineupCircle {
  id: string;
  x: number; // 0..1 normalized on image
  y: number;
  r?: number; // radius normalized 0..1 (relative to image width)
  color?: string;
  label?: string;
}

export interface LineupLegacy {
  raw?: any; // original json for debugging
  packName?: string;
  warnings?: string[];
}

export interface Lineup {
  id: string;
  title: string;
  mapUuid: string;
  agentUuid: string;
  abilitySlot: AbilitySlot;
  side: Side;
  site?: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  bounces: { x: number; y: number }[];
  throwType?: string;
  difficulty: Difficulty;
  importance: Importance;
  tags: string[];
  notes?: string;
  media: {
    standImage?: string;
    aimImage?: string;
    landingImage?: string;
  };
  isFavorite?: boolean;

  // Extended v0.2.0 fields (optional for backward compat)
  slots?: LineupSlots;
  throws?: LineupThrow[];
  steps?: LineupStep[];
  attributes?: LineupAttributes;
  circles?: LineupCircle[]; // top-level deduped by id (B4)
  source?: LineupSource;
  importBatchId?: string;
  legacy?: LineupLegacy;
  status?: LineupStatus;
  createdAt?: string;
  updatedAt?: string;
  isSeedPlaceholder?: boolean; // true for incomplete seeds that should be unchecked in import

  // media handling: map of assetId -> blob URL or stored reference
  mediaAssets?: Record<string, string>; // asset filename -> object URL (runtime)
}

export interface ValorantAgent {
  uuid: string;
  displayName: string;
  displayIcon: string;
  displayIconSmall: string;
  bustPortrait?: string;
  role?: { displayName: string; displayIcon: string };
  abilities: {
    slot: string;
    displayName: string;
    displayIcon: string | null;
    description: string;
  }[];
  isPlayableCharacter: boolean;
}

export interface ValorantMap {
  uuid: string;
  displayName: string;
  splash: string;
  listViewIcon: string;
  displayIcon: string | null; // minimap
  coordinates?: string;
  xMultiplier?: number;
  yMultiplier?: number;
  xScalarToAdd?: number;
  yScalarToAdd?: number;
}

export interface FilterState {
  importance: Set<Importance>;
  difficulty: Set<Difficulty>;
}

export interface AppState {
  selectedMapUuid: string | null;
  side: Side;
  selectedAgentUuid: string | null;
  selectedAbilities: Set<AbilitySlot>;
  filters: FilterState;
  zoom: number;
  pan: { x: number; y: number };
}

// Pack format types (for docs reference, runtime zod in packImporter)
export interface PackManifest {
  formatVersion?: number;
  name: string;
  author?: string;
  description?: string;
  createdAt?: string;
  gameVersion?: string;
  count?: number;
}

export interface PackLineupRaw {
  id: string;
  title?: string;
  name?: string;
  map?: string;
  mapUuid?: string;
  mapName?: string;
  agent?: string;
  agentUuid?: string;
  agentName?: string;
  ability?: string;
  abilitySlot?: AbilitySlot;
  slot?: string;
  side?: string;
  site?: string;
  start?: any;
  end?: any;
  bounces?: any;
  throwType?: string;
  difficulty?: string;
  importance?: string;
  tags?: string[];
  notes?: string;
  description?: string;
  media?: any;
  slots?: any;
  throws?: any;
  steps?: any;
  attributes?: any;
  circles?: any;
  projectiles?: any;
  [k: string]: any;
}
