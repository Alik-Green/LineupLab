import { describe, expect, it } from 'vitest';
import { autoTitle, modeAttributes, modesFor, nearestCallout, validateLineup, visibleSlots } from './modes';
import { newLineup } from './adapter';
import type { Catalog, SlotData, SlotId } from '../types';
import { SLOT_ORDER } from '../types';

const slots = () => Object.fromEntries(SLOT_ORDER.map(s => [s, { image: null, circles: [], lines: [] }])) as unknown as Record<SlotId, SlotData>;
describe('wizard mode rules (mirror core config)', () => {
  it('selects Sova recon modes for Grenade and generic modes for other agents', () => {
    expect(modesFor('Sova', 'Grenade', []).map(m => m.id)).toEqual(['recon']);
    expect(modesFor('Jett', 'Grenade', []).map(m => m.id)).toEqual(['standard', 'placement', 'double']);
    expect(modesFor(undefined, 'Ability1', []).length).toBeGreaterThan(0);
  });
  it('prefers adapter-provided mode definitions when ids match', () => {
    const custom = { id: 'standard', label: 'Custom standard', requiredSlots: ['stand1', 'landing'] as SlotId[], attributes: {} };
    expect(modesFor('Jett', 'Grenade', [custom])[0].label).toBe('Custom standard');
  });
  it('flattens literal and spec attributes', () => {
    const m = modesFor('Sova', 'Grenade', []).find(x => x.id === 'recon')!;
    expect(modeAttributes(m)).toEqual({ chargeLevel: 1, chargeStage: 0, chargeBars: 1, bounces: 0 });
    expect(modeAttributes({ id: 'x', label: 'x', requiredSlots: [], attributes: { chargeStage: { type: 'number', default: 1 } } })).toEqual({ chargeStage: 1 });
  });
  it('shows stand2 only when a second aim exists (core visible_slots)', () => {
    const s = slots();
    expect(visibleSlots(['stand1', 'aim1', 'landing'], s)).toEqual(['stand1', 'aim1', 'landing']);
    s.aim2.image = 'h';
    expect(visibleSlots(['stand1', 'aim1', 'landing'], s)).toEqual(['stand1', 'aim1', 'stand2', 'landing']);
    expect(visibleSlots(['stand1', 'aim1', 'aim2', 'landing'], s)).toContain('aim2');
  });
});
describe('wizard validation (mirror core validate_save)', () => {
  it('flags setup, captures, pins and title in step order', () => {
    const l = newLineup();
    const issues = validateLineup(l, ['stand1', 'aim1', 'landing']);
    expect(issues.map(i => i.step)).toEqual(['setup', 'setup', 'capture', 'capture', 'capture', 'pins', 'pins', 'details']);
    expect(issues.find(i => i.field === 'landPos')?.message).toMatch(/landing pin/i);
  });
  it('passes a complete lineup and rejects aim2 without aim1', () => {
    const l = { ...newLineup(), mapUuid: 'm', agentUuid: 'a', abilitySlot: 'Grenade', title: 'T', stand1Pos: { x: 0.1, y: 0.2 }, landPos: { x: 0.3, y: 0.4 } };
    for (const s of ['stand1', 'aim1', 'landing'] as SlotId[]) l.slots[s].image = 'h';
    expect(validateLineup(l, ['stand1', 'aim1', 'landing'])).toEqual([]);
    l.slots.aim1.image = null; l.slots.aim2.image = 'h';
    expect(validateLineup(l, ['stand1', 'landing']).map(i => i.field)).toContain('aim1');
  });
  it('builds a suggested title from catalog entities', () => {
    const catalog = { agents: [{ uuid: 'a', displayName: 'Sova', displayIcon: '', abilities: [{ slot: 'Grenade', displayName: 'Recon Bolt' }] }], maps: [{ uuid: 'm', displayName: 'Abyss', displayIcon: '' }], version: 'v', updatedAt: '' } as Catalog;
    const l = { ...newLineup(), mapUuid: 'm', agentUuid: 'a', abilitySlot: 'Grenade', site: 'B', side: 'attack' as const };
    expect(autoTitle(l, catalog)).toBe('Sova Recon Bolt · Abyss B (Attack)');
  });
});

describe('location-aware naming', () => {
  it('uses nearest callouts when available and falls back to site', () => {
    expect(nearestCallout([{ name: 'Mid Bend', x: 0.2, y: 0.2 }, { name: 'B Site', x: 0.8, y: 0.8 }], { x: 0.21, y: 0.22 })).toBe('Mid Bend');
    const catalog = { agents: [{ uuid: 'a', displayName: 'Sova', displayIcon: '', abilities: [{ slot: 'Grenade', displayName: 'Recon Bolt' }] }], maps: [{ uuid: 'm', displayName: 'Abyss', displayIcon: '', callouts: [{ name: 'Mid Bend', x: 0.1, y: 0.1 }, { name: 'B Site', x: 0.9, y: 0.9 }] }], version: 'v', updatedAt: '' } as Catalog;
    const l = { ...newLineup(), mapUuid: 'm', agentUuid: 'a', abilitySlot: 'Grenade', site: 'B', side: 'attack' as const, stand1Pos: { x: 0.1, y: 0.1 }, landPos: { x: 0.9, y: 0.9 } };
    expect(autoTitle(l, catalog)).toBe('Sova Recon Bolt · Abyss Mid Bend → B Site (Attack)');
  });
});
