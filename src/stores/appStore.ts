import { create } from "zustand";
import type { Side, AbilitySlot, Importance, Difficulty } from "../types/lineup";

const STORAGE_KEY = "lineuplab_prefs_v1";

type State = {
  selectedMapUuid: string | null;
  side: Side;
  selectedAgentUuid: string | null;
  selectedAbilities: Set<AbilitySlot>;
  importance: Set<Importance>;
  difficulty: Set<Difficulty>;
  zoom: number;
  pan: { x: number; y: number };
  // actions
  setMap: (uuid: string) => void;
  setSide: (s: Side) => void;
  setAgent: (uuid: string | null) => void;
  toggleAbility: (slot: AbilitySlot) => void;
  setAbilities: (slots: Set<AbilitySlot>) => void;
  toggleImportance: (imp: Importance) => void;
  toggleDifficulty: (d: Difficulty) => void;
  resetFilters: () => void;
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  hydrateFromStorage: () => void;
};

const DEFAULT_IMPORTANCE: Importance[] = ["essential", "useful", "optional"];
const DEFAULT_DIFFICULTY: Difficulty[] = ["easy", "normal", "hard"];
const DEFAULT_ABILITIES: AbilitySlot[] = ["Ability1", "Ability2", "Grenade", "Ultimate"];

function persist(state: Partial<State>) {
  try {
    const toSave = {
      selectedMapUuid: state.selectedMapUuid,
      side: state.side,
      selectedAgentUuid: state.selectedAgentUuid,
      selectedAbilities: state.selectedAbilities ? Array.from(state.selectedAbilities) : undefined,
      importance: state.importance ? Array.from(state.importance) : undefined,
      difficulty: state.difficulty ? Array.from(state.difficulty) : undefined,
      zoom: state.zoom,
      pan: state.pan,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
}

export const useAppStore = create<State>((set, get) => ({
  selectedMapUuid: null,
  side: "attack",
  selectedAgentUuid: null,
  selectedAbilities: new Set(DEFAULT_ABILITIES as AbilitySlot[]),
  importance: new Set(DEFAULT_IMPORTANCE),
  difficulty: new Set(DEFAULT_DIFFICULTY),
  zoom: 1,
  pan: { x: 0, y: 0 },

  setMap: (uuid) => {
    set({ selectedMapUuid: uuid });
    persist(get());
  },
  setSide: (s) => {
    set({ side: s });
    persist(get());
  },
  setAgent: (uuid) => {
    set({ selectedAgentUuid: uuid });
    persist(get());
  },
  toggleAbility: (slot) => {
    const next = new Set(get().selectedAbilities);
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    set({ selectedAbilities: next });
    persist(get());
  },
  setAbilities: (slots) => {
    set({ selectedAbilities: new Set(slots) });
    persist(get());
  },
  toggleImportance: (imp) => {
    const next = new Set(get().importance);
    if (next.has(imp)) next.delete(imp);
    else next.add(imp);
    set({ importance: next });
    persist(get());
  },
  toggleDifficulty: (d) => {
    const next = new Set(get().difficulty);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    set({ difficulty: next });
    persist(get());
  },
  resetFilters: () => {
    set({
      importance: new Set(DEFAULT_IMPORTANCE),
      difficulty: new Set(DEFAULT_DIFFICULTY),
      selectedAbilities: new Set(DEFAULT_ABILITIES as AbilitySlot[]),
    });
    persist(get());
  },
  setZoom: (z) => {
    set({ zoom: z });
    persist(get());
  },
  setPan: (p) => {
    set({ pan: p });
    persist(get());
  },
  hydrateFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      set({
        selectedMapUuid: parsed.selectedMapUuid ?? null,
        side: parsed.side ?? "attack",
        selectedAgentUuid: parsed.selectedAgentUuid ?? null,
        selectedAbilities: parsed.selectedAbilities ? new Set(parsed.selectedAbilities) : new Set(DEFAULT_ABILITIES as AbilitySlot[]),
        importance: parsed.importance ? new Set(parsed.importance) : new Set(DEFAULT_IMPORTANCE),
        difficulty: parsed.difficulty ? new Set(parsed.difficulty) : new Set(DEFAULT_DIFFICULTY),
        zoom: parsed.zoom ?? 1,
        pan: parsed.pan ?? { x: 0, y: 0 },
      });
    } catch {}
  },
}));
