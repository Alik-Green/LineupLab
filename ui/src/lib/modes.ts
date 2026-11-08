import type { AbilityMode, Catalog, Lineup, SlotData, SlotId } from '../types';
import { SLOT_LABELS, SLOT_ORDER } from '../types';
import abilityModes from '@data/ability_modes.json';
import { abilityName } from './game';
import bundledCallouts from '@data/map_callouts.json';

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
  let fromAll = ids.map(id => byId.get(id)).filter((m): m is AbilityMode => !!m);
  // Legacy recon-<bounce>-<charge> ids remain valid data, but the editor uses one
  // canonical Recon Dart mode plus explicit charge/bounce controls.
  if (agentName === 'Sova' && abilitySlot === 'Grenade') fromAll = fromAll.filter(m => m.id === 'recon');
  if (fromAll.length) return fromAll;
  const rule = cfg.rules.find(r => (r.agent === agentName || r.agent === '*') && (r.ability === abilitySlot || r.ability === '*'));
  const fallback = rule?.modes ?? cfg.defaults;
  return agentName === 'Sova' && abilitySlot === 'Grenade' ? fallback.filter(m => m.id === 'recon') : fallback;
}
export function modeAttributes(mode: AbilityMode | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(mode?.attributes ?? {})) out[k] = v && typeof v === 'object' && 'default' in (v as object) ? (v as { default?: unknown }).default : v;
  return out;
}
export function isAttributeSpec(v: unknown): v is { type: string; default?: unknown; min?: number; max?: number } { return !!v && typeof v === 'object' && 'type' in (v as object); }
/** Single-throw modes never expose optional second captures, even if a legacy
 * draft still stores an unused image. Data is preserved until intentionally cleared. */
export function visibleSlots(required: SlotId[], _slots: Record<SlotId, SlotData>): SlotId[] {
  const second = required.includes('aim2') || required.includes('stand2');
  return SLOT_ORDER.filter(s => required.includes(s) || s === 'aim1' || (s === 'stand2' && second));
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
export function nearestCallout(callouts: { name: string; x: number; y: number }[] | undefined, p: { x: number; y: number } | null | undefined): string | null {
  if (!callouts?.length || !p) return null;
  let best: { name: string; d: number } | null = null;
  for (const c of callouts) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (!best || d < best.d) best = { name: c.name, d }; }
  return best?.name ?? null;
}
type BundledCallouts = { maps: Record<string, { displayName: string; callouts: { name: string; x: number; y: number }[] }> };
export function calloutsForMap(map: { uuid: string; displayName: string; callouts?: { name: string; x: number; y: number }[] } | undefined): { name: string; x: number; y: number }[] {
  if (map?.callouts?.length) return map.callouts;
  const data = bundledCallouts as unknown as BundledCallouts;
  return data.maps[map?.uuid ?? '']?.callouts ?? Object.values(data.maps).find(m => m.displayName.toLowerCase() === map?.displayName.toLowerCase())?.callouts ?? [];
}
export function autoTitle(l: Lineup, catalog: Catalog | null): string {
  const agent = catalog?.agents.find(a => a.uuid === l.agentUuid)?.displayName ?? '';
  const mapObj = catalog?.maps.find(m => m.uuid === l.mapUuid);
  const map = mapObj?.displayName ?? '';
  const ability = l.agentUuid ? abilityName(catalog, l.agentUuid, l.abilitySlot) : '';
  const callouts = calloutsForMap(mapObj);
  const start = nearestCallout(callouts, l.stand1Pos);
  const end = nearestCallout(callouts, l.landPos);
  const where = [map, start && end ? `${start} → ${end}` : l.site.trim()].filter(Boolean).join(' ');
  const side = l.side === 'both' ? '' : ` (${l.side === 'attack' ? 'Attack' : 'Defense'})`;
  return [`${agent} ${ability}`.trim(), where].filter(Boolean).join(' · ') + side;
}
