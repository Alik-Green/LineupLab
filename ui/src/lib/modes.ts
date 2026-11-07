import type { AbilityMode, Catalog, Lineup, SlotData, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';
import abilityModes from '@data/ability_modes.json';
import { abilityName } from './game';

interface ModeRule { agent: string; ability: string; modes: AbilityMode[] }
const cfg = abilityModes as unknown as { defaults: AbilityMode[]; rules: ModeRule[] };
/** Mirrors core `ModeConfig::modes(agent, slot)`: first matching rule (agent or *, ability or *), else defaults. */
export function modeIdsFor(agentName: string, abilitySlot: string): string[] {
  const rule = cfg.rules.find(r => (r.agent === agentName || r.agent === '*') && (r.ability === abilitySlot || r.ability === '*'));
  return (rule?.modes ?? cfg.defaults).map(m => m.id);
}
export function modesFor(agentName: string | undefined, abilitySlot: string, all: AbilityMode[]): AbilityMode[] {
  const ids = modeIdsFor(agentName ?? '*', abilitySlot);
  const byId = new Map(all.map(m => [m.id, m]));
  const fromAll = ids.map(id => byId.get(id)).filter((m): m is AbilityMode => !!m);
  if (fromAll.length) return fromAll;
  const rule = cfg.rules.find(r => (r.agent === agentName || r.agent === '*') && (r.ability === abilitySlot || r.ability === '*'));
  return rule?.modes ?? cfg.defaults;
}
export function modeAttributes(mode: AbilityMode | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(mode?.attributes ?? {})) out[k] = v && typeof v === 'object' && 'default' in (v as object) ? (v as { default?: unknown }).default : v;
  return out;
}
export function isAttributeSpec(v: unknown): v is { type: string; default?: unknown; min?: number; max?: number } { return !!v && typeof v === 'object' && 'type' in (v as object); }
/** Mirrors core `DraftState::visible_slots`. */
export function visibleSlots(required: SlotId[], slots: Record<SlotId, SlotData>): SlotId[] {
  const hasAim2 = required.includes('aim2') || !!slots.aim2.image;
  return SLOT_ORDER.filter(s => required.includes(s) || s === 'aim1' || (s === 'stand2' && hasAim2));
}
export type WizardStep = 'setup' | 'capture' | 'pins' | 'details' | 'review';
export const WIZARD_STEPS: { id: WizardStep; label: string }[] = [{ id: 'setup', label: 'Setup' }, { id: 'capture', label: 'Capture' }, { id: 'pins', label: 'Pins' }, { id: 'details', label: 'Details' }, { id: 'review', label: 'Review' }];
export interface ValidationIssue { step: WizardStep; field: string; message: string; slot?: SlotId }
/** Mirrors core `DraftState::validate_save(false)` plus the UI's title/map/agent requirements. */
export function validateLineup(l: Lineup, required: SlotId[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!l.mapUuid) issues.push({ step: 'setup', field: 'map', message: 'Choose the map this lineup is on.' });
  if (!l.agentUuid) issues.push({ step: 'setup', field: 'agent', message: 'Choose the agent.' });
  if (!l.abilitySlot) issues.push({ step: 'setup', field: 'ability', message: 'Choose the ability.' });
  for (const s of required) if (!l.slots[s].image) issues.push({ step: 'capture', field: s, slot: s, message: `Capture the ${SLOT_LABELS[s].toLowerCase()} image.` });
  if (l.slots.aim2.image && !l.slots.aim1.image) issues.push({ step: 'capture', field: 'aim1', slot: 'aim1', message: 'A second aim image needs a first aim image.' });
  if (!l.stand1Pos) issues.push({ step: 'pins', field: 'stand1Pos', message: 'Place the stand pin on the minimap.' });
  if (!l.landPos) issues.push({ step: 'pins', field: 'landPos', message: 'Place the landing pin on the minimap.' });
  if (!l.title.trim()) issues.push({ step: 'details', field: 'title', message: 'Give the lineup a title (or use the suggested one).' });
  return issues;
}
export function autoTitle(l: Lineup, catalog: Catalog | null): string {
  const agent = catalog?.agents.find(a => a.uuid === l.agentUuid)?.displayName ?? '';
  const map = catalog?.maps.find(m => m.uuid === l.mapUuid)?.displayName ?? '';
  const ability = l.agentUuid ? abilityName(catalog, l.agentUuid, l.abilitySlot) : '';
  const where = [map, l.site.trim()].filter(Boolean).join(' ');
  const side = l.side === 'both' ? '' : ` (${l.side === 'attack' ? 'Attack' : 'Defense'})`;
  return [`${agent} ${ability}`.trim(), where].filter(Boolean).join(' · ') + side;
}
