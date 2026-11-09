export type AbilitySlot = "Ability1" | "Ability2" | "Grenade" | "Ultimate";
export type Side = "attack" | "defense" | "both";
export type Difficulty = "easy" | "normal" | "hard";
export type Importance = "essential" | "useful" | "optional";

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
