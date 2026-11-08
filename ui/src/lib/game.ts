import type { Agent, CatalogAbility } from '../types';
import lineupAbilities from '@data/lineup_abilities.json';

export const ABILITY_KEYS: Record<string, string> = { Ability1: 'Q', Ability2: 'E', Grenade: 'C', Ultimate: 'X' };
export const ABILITY_ORDER = ['Ability1', 'Ability2', 'Grenade', 'Ultimate'];
export function abilityKey(slot: string) { return ABILITY_KEYS[slot] ?? slot; }
export function isLineupAbility(agentName: string, slot: string, overrides: Record<string, Record<string, boolean>> = {}): boolean {
  const override = overrides[agentName]?.[slot]; if (typeof override === 'boolean') return override;
  const cfg = lineupAbilities as { rules: { agent: string; slots: Record<string, boolean> }[] };
  const rule = cfg.rules.find(r => r.agent === agentName) ?? cfg.rules.find(r => r.agent === '*');
  return rule?.slots[slot] ?? false;
}
export function enabledAbilities(agent: Agent | undefined | null, overrides?: Record<string, Record<string, boolean>>): CatalogAbility[] {
  if (!agent) return [];
  return (agent.abilities ?? []).filter(a => isLineupAbility(agent.displayName, a.slot, overrides)).sort((a, b) => ABILITY_ORDER.indexOf(a.slot) - ABILITY_ORDER.indexOf(b.slot));
}
export function abilityIcon(catalog: { agents: Agent[] } | null, agentUuid: string, slot: string): string | undefined { return catalog?.agents.find(a => a.uuid === agentUuid)?.abilities?.find(a => a.slot === slot)?.displayIcon ?? undefined; }
export function abilityName(catalog: { agents: Agent[] } | null, agentUuid: string, slot: string): string { return catalog?.agents.find(a => a.uuid === agentUuid)?.abilities?.find(a => a.slot === slot)?.displayName ?? slot; }
export const ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel'] as const;
export const SITES = ['A', 'B', 'C', 'Mid', 'Other'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export function difficultyDots(d: string) { return d === 'easy' ? 1 : d === 'hard' ? 3 : 2; }

/** Explicit non-standard identities. Name matching alone missed District. */
export const NON_STANDARD_MAP_IDS = new Set([
  '690b3ed2-4dff-945b-8223-6da834e30d24', // District
  '12452a9d-48c3-0b02-e7eb-0381c3520404', // Kasbah
  'de28aa9b-4cbe-1003-320e-6cb3ec309557', // Piazza
  '2c09d728-42d5-30d8-43dc-96a05cc7ee9d', // Drift
  'd6336a5a-428f-c591-98db-c8a291159134', // Glitch
  'ee613ee9-28b7-4beb-9666-08db13bb2244', // The Range
  '5914d1e0-40c4-cfdd-6b88-eba06347686c', // The Range (alt)
  '1f10dab3-4294-3827-fa35-c2aa00213cf3', // Basic Training
]);
const NON_STANDARD_NAMES = /^(district|kasbah|piazza|drift|glitch|the range|basic training|practice range|.*deathmatch.*|.*\btdm\b.*)$/i;
/** Standard bomb-defusal maps only; archived/TDM/range entries stay in data for old lineups. */
export function standardMaps<T extends { displayName: string; uuid?: string }>(maps: T[]): T[] {
  return maps.filter(m => !(m.uuid && NON_STANDARD_MAP_IDS.has(m.uuid.toLowerCase())) && !NON_STANDARD_NAMES.test(m.displayName.trim()));
}
export function sitesForMap(mapName?: string): string[] { return /haven|lotus/i.test(mapName ?? '') ? ['A', 'B', 'C', 'Mid'] : ['A', 'B', 'Mid']; }
