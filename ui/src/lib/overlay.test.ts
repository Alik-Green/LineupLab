import { describe, expect, it } from 'vitest';
import { clampViewPrefs, clampOverlay, DEFAULT_OVERLAY, DEFAULT_VIEW_PREFS, draftChecklist, overlayHeight, overlayPosition } from './overlay';
import { newLineup } from './adapter';

describe('overlay defaults', () => {
  it('is click-through by default', () => { expect(DEFAULT_OVERLAY.clickThrough).toBe(true); });
});
describe('overlay view prefs', () => {
  it('clamps scale and coerces booleans', () => {
    expect(clampViewPrefs({ scale: 9, hideAnnotations: true, fade: false })).toEqual({ scale: 1.75, hideAnnotations: true, fade: false, minimal: false, outline: false, outlineThickness: 3 });
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

describe('overlay placement', () => {
  it('uses the detected logical monitor size instead of assuming 1080p', () => {
    expect(overlayPosition({ ...DEFAULT_OVERLAY, corner: 'bottom-right' }, 2560, 1440)).toEqual({ x: 2116, y: 1096 });
    expect(overlayPosition({ ...DEFAULT_OVERLAY, corner: 'bottom-right' }, 1920, 1080)).toEqual({ x: 1476, y: 736 });
    expect(overlayPosition({ ...DEFAULT_OVERLAY, corner: 'top-left' }, 2560, 1440)).toEqual({ x: 24, y: 24 });
  });
});

describe('image-proportioned overlay windows', () => {
  it('minimal height is exactly width divided by the decoded image aspect', () => {
    expect(overlayHeight(800, 16 / 9, true)).toBe(450);
    expect(overlayHeight(800, 4 / 3, true)).toBe(600);
    expect(overlayHeight(800, 16 / 9, false)).toBe(538);
    expect(overlayHeight(420, 16 / 9, false, 'create')).toBe(408);
    expect(overlayHeight(200, 4, true)).toBe(64);
  });
  it('keeps legacy reading prefs but exposes adjustable outline thickness', () => {
    expect(clampViewPrefs({ outlineThickness: 40 }).outlineThickness).toBe(12);
    expect(clampViewPrefs({ outlineThickness: 0 }).outlineThickness).toBe(1);
    expect(clampOverlay({ ...DEFAULT_OVERLAY, height: 10 }).height).toBe(64);
  });
});
