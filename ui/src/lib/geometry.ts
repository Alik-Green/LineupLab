import type { AnnotationLine, FocusCircle, Point } from '../types';
export const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
export const clampPoint = (p: Point): Point => ({ x: clamp01(p.x), y: clamp01(p.y) });
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function snapPoint(p: Point, enabled: boolean, step = 0.01): Point { return enabled ? { x: clamp01(Math.round(p.x / step) * step), y: clamp01(Math.round(p.y / step) * step) } : clampPoint(p); }
/** Lens inset is a square whose width is normalized to image width; clamp inside the image. */
export function clampLens(c: FocusCircle, width: number, height: number): FocusCircle {
  const size = Math.min(Math.max(c.zoomSize, 0.05), 1, height / Math.max(width, 1));
  const hFrac = size * width / Math.max(height, 1);
  return { ...c, zoomSize: size, zoomX: Math.min(Math.max(c.zoomX, 0), 1 - size), zoomY: Math.min(Math.max(c.zoomY, 0), 1 - hFrac), zoomScale: Math.min(Math.max(c.zoomScale, 1), 12) };
}
/** Source crop (normalized) centered on the circle, clamped to the original image. */
export function lensSource(c: FocusCircle, width: number, height: number) {
  const sizeW = c.zoomSize / c.zoomScale;
  const sizeH = sizeW * width / Math.max(height, 1);
  const x = Math.min(Math.max(c.x - sizeW / 2, 0), Math.max(0, 1 - sizeW));
  const y = Math.min(Math.max(c.y - sizeH / 2, 0), Math.max(0, 1 - sizeH));
  return { x, y, w: sizeW, h: sizeH };
}
export function linePoints(line: AnnotationLine): string { return line.points.map(p => `${p.x},${p.y}`).join(' '); }
export function dashArray(line: AnnotationLine, width: number): string | undefined {
  const w = line.width * width;
  return line.style === 'dashed' ? `${w * 4} ${w * 3}` : line.style === 'dotted' ? `${w * 0.5} ${w * 2.5}` : undefined;
}
export function nudge<T extends { x: number; y: number }>(p: T, dx: number, dy: number): T { return { ...p, x: clamp01(p.x + dx), y: clamp01(p.y + dy) }; }
export function newCircle(x: number, y: number, color: string, lens = false): FocusCircle {
  return { id: crypto.randomUUID(), color, x: clamp01(x), y: clamp01(y), radius: 0.025, showZoom: lens, zoomScale: 3.5, zoomSize: 0.24, zoomX: 0.72, zoomY: 0.04 };
}
export function newLine(points: Point[], color: string): AnnotationLine { return { id: crypto.randomUUID(), color, width: 0.003, points: points.map(clampPoint), style: 'solid', arrow: 'none', label: null }; }

export interface MapView { scale: number; tx: number; ty: number }
export function constrainMapPan(v: MapView, side: number): MapView {
  const min = side * (1 - v.scale);
  return { ...v, tx: Math.min(0, Math.max(min, v.tx)), ty: Math.min(0, Math.max(min, v.ty)) };
}
/** Zoom around a point in the untransformed square canvas; art and SVG share this transform. */
export function zoomMapAt(v: MapView, factor: number, px: number, py: number, side: number): MapView {
  const scale = Math.min(6, Math.max(1, v.scale * factor));
  return constrainMapPan({ scale, tx: px - (px - v.tx) * scale / v.scale, ty: py - (py - v.ty) * scale / v.scale }, side);
}
