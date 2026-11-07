import { describe, expect, it } from 'vitest';
import { clampLens, clampPoint, lensSource, nudge, snapPoint } from './geometry';
import type { FocusCircle } from '../types';
const circle = (patch: Partial<FocusCircle> = {}): FocusCircle => ({ id: 'c', color: 'cyan', x: 0.5, y: 0.5, radius: 0.02, showZoom: true, zoomScale: 3.5, zoomSize: 0.24, zoomX: 0.9, zoomY: 0.95, legacyNote: 'keep', ...patch });
describe('annotation geometry', () => {
  it('clamps points and snaps', () => { expect(clampPoint({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 }); expect(snapPoint({ x: 0.507, y: 0.493 }, true)).toEqual({ x: 0.51, y: 0.49 }); });
  it('clamps square lens inside non-square images and preserves unknown keys', () => { const c = clampLens(circle(), 1600, 900); expect(c.zoomX).toBeCloseTo(0.76); expect(c.zoomY).toBeCloseTo(1 - 0.24 * 1600 / 900); expect(c.legacyNote).toBe('keep'); expect(c.zoomSize * 1600).toBeLessThanOrEqual(900 + 1e-9); });
  it('lens source crops original around circle and stays in bounds', () => { const c = clampLens(circle({ x: 0.01, y: 0.99 }), 1600, 900); const s = lensSource(c, 1600, 900); expect(s.x).toBe(0); expect(s.y + s.h).toBeCloseTo(1); expect(s.w).toBeCloseTo(c.zoomSize / c.zoomScale); });
  it('nudges without leaving image', () => { expect(nudge({ x: 0.99, y: 0.01 }, 0.05, -0.05)).toEqual({ x: 1, y: 0 }); });
});
