import { describe, expect, it } from 'vitest';
import { clampViewPrefs, DEFAULT_VIEW_PREFS, draftChecklist } from './overlay';
import { newLineup } from './adapter';

describe('overlay view prefs', () => {
  it('clamps scale and coerces booleans', () => {
    expect(clampViewPrefs({ scale: 9, hideAnnotations: true, fade: false })).toEqual({ scale: 1.75, hideAnnotations: true, fade: false });
    expect(clampViewPrefs({ scale: 0.1 })).toEqual({ ...DEFAULT_VIEW_PREFS, scale: 0.75 });
    expect(clampViewPrefs({ scale: Number.NaN, fade: undefined })).toEqual(DEFAULT_VIEW_PREFS);
  });
});
describe('draftChecklist', () => {
  it('mirrors core required/optional/done semantics', () => {
    const l = newLineup(); l.slots.aim1.image = 'a'; l.slots.stand2.image = 'b';
    const items = draftChecklist(l, ['stand1', 'aim1', 'landing'], ['landing']);
    expect(items.map(i => i.slot)).toEqual(['stand1', 'aim1', 'stand2', 'landing']);
    expect(items.find(i => i.slot === 'aim1')).toMatchObject({ required: true, done: true });
    expect(items.find(i => i.slot === 'stand2')).toMatchObject({ required: false, done: true });
    expect(items.find(i => i.slot === 'landing')).toMatchObject({ required: true, done: false, skipped: true });
  });
});
