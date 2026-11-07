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

/** Standard bomb-defusal maps only; archived/TDM/range entries stay in data for old lineups. */
export function standardMaps<T extends { displayName: string; uuid?: string }>(maps: T[]): T[] {
  return maps.filter(m => !/deathmatch|team\s*deathmatch|\btdm\b|the range|basic training|practice/i.test(m.displayName));
}
export function sitesForMap(mapName?: string): string[] { return /haven|lotus/i.test(mapName ?? '') ? ['A', 'B', 'C', 'Mid'] : ['A', 'B', 'Mid']; }
