import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { constrainMapPan, zoomMapAt } from './geometry';
import { normalizeServerUrl } from './download';
import { standardMaps, sitesForMap, enabledAbilities } from './game';
import { NumberInput } from '../components/ui';
import { DartControls, chargeLevel } from '../components/DartControls';
import type { Agent } from '../types';

describe('minimap transform geometry', () => {
  it('zooms around the pointer and keeps art/markers in bounds', () => {
    const v = zoomMapAt({ scale: 1, tx: 0, ty: 0 }, 2, 100, 100, 400);
    expect(v).toEqual({ scale: 2, tx: -100, ty: -100 });
    expect(constrainMapPan({ scale: 2, tx: 50, ty: -900 }, 400)).toEqual({ scale: 2, tx: 0, ty: -400 });
    expect(zoomMapAt(v, 100, 200, 200, 400).scale).toBe(6);
  });
});
describe('download address normalization', () => {
  it('accepts private LAN addresses and warns on the reported public-looking typo', () => {
    expect(normalizeServerUrl('192.168.1.20:8765')).toEqual({ url: 'http://192.168.1.20:8765', warning: null });
    expect(normalizeServerUrl('http://10.0.0.2:8765').warning).toBeNull();
    expect(normalizeServerUrl('192.181.1.12:8765').warning).toMatch(/private LAN/);
  });
});
describe('map/site/ability choices', () => {
  it('filters TDM but keeps standard maps and legacy data untouched', () => {
    const maps = [{ displayName: 'Ascent' }, { displayName: 'Team Deathmatch' }, { displayName: 'The Range' }, { displayName: 'Haven' }];
    expect(standardMaps(maps).map(m => m.displayName)).toEqual(['Ascent', 'Haven']);
    expect(maps).toHaveLength(4);
    expect(sitesForMap('Haven')).toEqual(['A', 'B', 'C', 'Mid']);
    expect(sitesForMap('Ascent')).toEqual(['A', 'B', 'Mid']);
  });
  it('exposes all Sova abilities including Recon Bolt', () => {
    const sova = { uuid: 'a', displayName: 'Sova', displayIcon: '', abilities: [{ slot: 'Ability1', displayName: 'Owl Drone' }, { slot: 'Ability2', displayName: 'Shock Bolt' }, { slot: 'Grenade', displayName: 'Recon Bolt' }, { slot: 'Ultimate', displayName: "Hunter's Fury" }] } as Agent;
    expect(enabledAbilities(sova).map(a => a.displayName)).toContain('Recon Bolt');
    expect(enabledAbilities(sova)).toHaveLength(4);
  });
});
describe('NumberInput', () => {
  it('allows empty text while focused and clamps only on blur', () => {
    const commit = vi.fn();
    render(<NumberInput label="Width" value={420} min={200} max={1600} onCommit={commit} />);
    const input = screen.getByLabelText('Width') as HTMLInputElement;
    fireEvent.focus(input); fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe(''); expect(commit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '1' } }); expect(input.value).toBe('1');
    fireEvent.blur(input); expect(commit).toHaveBeenCalledWith(200); expect(input.value).toBe('200');
  });
});
describe('DartControls', () => {
  it('maps legacy charge stages and writes charge/bounce selections', () => {
    expect(chargeLevel({ chargeStage: 0 })).toBe(1); expect(chargeLevel({ chargeStage: 1 })).toBe(2); expect(chargeLevel({ chargeStage: 2 })).toBe(4);
    const onChange = vi.fn();
    render(<DartControls attributes={{ chargeStage: 0, bounces: 0 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Full' }));
    expect(onChange).toHaveBeenLastCalledWith({ chargeStage: 2, bounces: 0, chargeLevel: 4, chargeBars: 4 });
    fireEvent.click(screen.getByRole('radio', { name: '2' }));
    expect(onChange).toHaveBeenLastCalledWith({ chargeStage: 0, bounces: 2 });
  });
});
