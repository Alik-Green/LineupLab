import { describe, expect, it } from 'vitest';
import { filterLineups, previewHash } from './Browse';
import { newLineup } from '../lib/adapter';
import { artPath } from '../lib/mock-tauri';
import type { GameMap } from '../types';
const l = (patch: Partial<ReturnType<typeof newLineup>> = {}) => ({ ...newLineup(), title: 'B site smoke', tags: ['smoke'], site: 'B', ...patch });
describe('browse filters', () => {
  it('searches title/notes/tags and respects favorites/site/side', () => { const all = [l({ id: 'a', isFavorite: true }), l({ id: 'b', site: 'A', tags: ['flash'] }), l({ id: 'c', deleted: true })]; expect(filterLineups(all, { map: '', agent: '', ability: '', side: '', site: '', q: 'smoke', tag: '', favorites: false }).map(x => x.id)).toEqual(['a', 'b']); expect(filterLineups(all, { map: '', agent: '', ability: '', side: '', site: 'B', q: '', tag: '', favorites: true }).map(x => x.id)).toEqual(['a']); });
  it('preview prefers landing then aim then steps', () => { const x = l(); x.steps = [{ order: 1, text: 's', imageRef: 'step' }]; expect(previewHash(x)).toBe('step'); x.slots.aim1.image = 'aim'; expect(previewHash(x)).toBe('aim'); x.slots.landing.image = 'land'; expect(previewHash(x)).toBe('land'); });
});

describe('map loading art', () => {
  it('uses the loading-screen splash for the map picker, not the tactical minimap', () => {
    const map = { uuid: 'm', displayName: 'Ascent', splash: 'https://media.valorant-api.com/maps/ascent/splash.png', listViewIcon: 'https://media.valorant-api.com/maps/ascent/listviewicon.png', displayIcon: 'https://media.valorant-api.com/maps/ascent/displayicon.png' } as GameMap;
    expect(artPath(map.splash!)).toBe('/fixture-art/mapSplash/splash-ascent');
    expect(artPath(map.displayIcon)).toBe('/fixture-art/minimap/ascent');
  });
});
