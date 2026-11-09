import { describe, expect, it } from 'vitest';
import { clampViewPrefs, clampOverlay, DEFAULT_OVERLAY, DEFAULT_VIEW_PREFS, draftChecklist, hasSecondThrow, learnSlots, overlayHeight, overlayPosition } from './overlay';
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
    const l = newLineup(); l.mode = 'double'; l.slots.aim1.image = 'a'; l.slots.stand2.image = 'b';
    const items = draftChecklist(l, ['stand1', 'aim1', 'landing'], ['landing']);
    expect(items.map(i => i.slot)).toEqual(['stand1', 'aim1', 'stand2', 'landing']);
    expect(items.find(i => i.slot === 'aim1')).toMatchObject({ required: true, done: true });
    expect(items.find(i => i.slot === 'stand2')).toMatchObject({ required: false, done: true });
    expect(items.find(i => i.slot === 'landing')).toMatchObject({ required: true, done: false, skipped: true });
  });
  it('never lists a second stand for a single throw, or one that repeats the first picture', () => {
    const single = newLineup(); single.slots.stand1.image = 'stand'; single.slots.stand2.image = 'other';
    expect(draftChecklist(single, ['stand1', 'aim1', 'landing']).map(i => i.slot)).toEqual(['stand1', 'aim1', 'landing']);
    const double = newLineup(); double.mode = 'double'; double.slots.stand1.image = 'stand'; double.slots.stand2.image = 'stand';
    expect(draftChecklist(double, ['stand1', 'aim1', 'aim2', 'landing']).map(i => i.slot)).toEqual(['stand1', 'aim1', 'aim2', 'landing']);
    // A required second stand still shows while it is missing.
    double.slots.stand2.image = null;
    expect(draftChecklist(double, ['stand1', 'aim1', 'stand2', 'aim2', 'landing']).find(i => i.slot === 'stand2')).toMatchObject({ required: true, done: false });
  });
});

describe('learn steps', () => {
  it('shows only captured, distinct pictures that belong to the lineup', () => {
    const l = newLineup();
    l.slots.stand1.image = 'stand'; l.slots.aim1.image = 'aim'; l.slots.landing.image = 'land';
    expect(learnSlots(l)).toEqual(['stand1', 'aim1', 'landing']);
    l.slots.stand2.image = 'stand';                       // same picture as the first stand
    expect(learnSlots(l, ['stand1', 'aim1', 'aim2', 'landing'])).toEqual(['stand1', 'aim1', 'landing']);
    l.slots.stand2.image = '  ';                          // blank hash is not a capture
    expect(learnSlots(l, ['stand1', 'aim1', 'aim2', 'landing'])).toEqual(['stand1', 'aim1', 'landing']);
    l.slots.stand2.image = 'stand2'; l.slots.aim2.image = 'aim2';
    expect(learnSlots(l, ['stand1', 'aim1', 'aim2', 'landing'])).toEqual(['stand1', 'aim1', 'stand2', 'aim2', 'landing']);
    l.slots.landing.image = 'aim';                        // duplicate landing is not another step
    expect(learnSlots(l, ['stand1', 'aim1', 'aim2', 'landing'])).toEqual(['stand1', 'aim1', 'stand2', 'aim2']);
  });
  it('detects a real second throw from saved data, not from leftover copies', () => {
    const l = newLineup();
    expect(hasSecondThrow(l)).toBe(false);
    l.slots.aim1.image = 'aim'; l.slots.aim2.image = 'aim';
    expect(hasSecondThrow(l)).toBe(false);
    l.slots.aim2.image = 'aim2';
    expect(hasSecondThrow(l)).toBe(true);
    l.slots.aim2.image = null; l.attributes = { doubleShock: true };
    expect(hasSecondThrow(l)).toBe(true);
    l.attributes = {}; l.throws = [{ index: 2, chargeStage: 0, chargeBars: 1, bounces: 0, throwType: 'normal', focusCircles: [] }];
    expect(hasSecondThrow(l)).toBe(true);
    expect(hasSecondThrow(newLineup(), ['stand1', 'aim1', 'stand2', 'aim2', 'landing'])).toBe(true);
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
