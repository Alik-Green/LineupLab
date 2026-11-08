import { describe, expect, it } from 'vitest';
import { clampLens, clampPoint, constrainMapPan, containFrame, lensSource, nudge, snapPoint, zoomMapAt } from './geometry';
import type { FocusCircle } from '../types';
const circle = (patch: Partial<FocusCircle> = {}): FocusCircle => ({ id: 'c', color: 'cyan', x: 0.5, y: 0.5, radius: 0.02, showZoom: true, zoomScale: 3.5, zoomSize: 0.24, zoomX: 0.9, zoomY: 0.95, legacyNote: 'keep', ...patch });
describe('annotation geometry', () => {
  it('clamps points and snaps', () => { expect(clampPoint({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 }); expect(snapPoint({ x: 0.507, y: 0.493 }, true)).toEqual({ x: 0.51, y: 0.49 }); });
  it('clamps square lens inside non-square images and preserves unknown keys', () => { const c = clampLens(circle(), 1600, 900); expect(c.zoomX).toBeCloseTo(0.76); expect(c.zoomY).toBeCloseTo(1 - 0.24 * 1600 / 900); expect(c.legacyNote).toBe('keep'); expect(c.zoomSize * 1600).toBeLessThanOrEqual(900 + 1e-9); });
  it('lens source crops original around circle and stays in bounds', () => { const c = clampLens(circle({ x: 0.01, y: 0.99 }), 1600, 900); const s = lensSource(c, 1600, 900); expect(s.x).toBe(0); expect(s.y + s.h).toBeCloseTo(1); expect(s.w).toBeCloseTo(c.zoomSize / c.zoomScale); });
  it('nudges without leaving image', () => { expect(nudge({ x: 0.99, y: 0.01 }, 0.05, -0.05)).toEqual({ x: 1, y: 0 }); });
});

describe('minimap viewport geometry', () => {
  it('lets a zoomed map reach every edge of a rectangular stage', () => {
    const v = { scale: 2, tx: 9999, ty: -9999 };
    const c = constrainMapPan(v, 300, 500, 300);
    expect(c.tx).toBe(-100); // scaled canvas flush right
    expect(c.ty).toBe(-300); // scaled canvas flush bottom
    expect(constrainMapPan({ scale: 2, tx: -9999, ty: 9999 }, 300, 500, 300)).toEqual({ scale: 2, tx: -200, ty: 0 });
  });
  it('anchors cursor zoom on the same map point while inside pan bounds', () => {
    const before = { scale: 1, tx: 0, ty: 0 };
    const after = zoomMapAt(before, 2, 150, 150, 300, 500, 300);
    expect((150 - before.tx) / (300 * before.scale)).toBeCloseTo((150 - after.tx) / (300 * after.scale));
    expect((150 - before.ty) / (300 * before.scale)).toBeCloseTo((150 - after.ty) / (300 * after.scale));
  });
  it('letterboxes annotations to the decoded image, not the outer card', () => {
    expect(containFrame(400, 300, 1600, 900)).toEqual({ left: 0, top: 37.5, width: 400, height: 225 });
    expect(containFrame(300, 400, 1600, 900)).toEqual({ left: 0, top: 115.625, width: 300, height: 168.75 });
  });
});
