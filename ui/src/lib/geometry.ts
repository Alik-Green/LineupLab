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
/** Pan clamp for a square map centered in a possibly rectangular stage.
 * tx/ty are offsets from the unzoomed centered base; the scaled canvas must be
 * able to reach every stage edge/corner instead of being clamped by base side. */
export function constrainMapPan(v: MapView, side: number, width = side, height = side): MapView {
  if (!(side > 0) || !Number.isFinite(v.tx) || !Number.isFinite(v.ty)) return { scale: 1, tx: 0, ty: 0 };
  const scale = Number.isFinite(v.scale) ? Math.min(6, Math.max(1, v.scale)) : 1;
  const scaled = side * scale;
  const axis = (length: number, t: number) => {
    const base = (length - side) / 2;
    const minAbs = Math.min(0, length - scaled), maxAbs = Math.max(0, length - scaled);
    return Math.min(maxAbs - base, Math.max(minAbs - base, t));
  };
  return { scale, tx: axis(width, v.tx), ty: axis(height, v.ty) };
}
/** Zoom around a point in the untransformed square canvas; art and SVG share this transform. */
export function zoomMapAt(v: MapView, factor: number, px: number, py: number, side: number, width = side, height = side): MapView {
  const scale = Math.min(6, Math.max(1, v.scale * factor));
  return constrainMapPan({ scale, tx: px - (px - v.tx) * scale / v.scale, ty: py - (py - v.ty) * scale / v.scale }, side, width, height);
}

/** Rectangular image viewer pan clamp (content fills the stage at scale 1). */
export function clampImagePan(v: MapView, width: number, height: number): MapView {
  const minX = width * (1 - v.scale), minY = height * (1 - v.scale);
  return { ...v, tx: Math.min(0, Math.max(minX, v.tx)), ty: Math.min(0, Math.max(minY, v.ty)) };
}
export function zoomImageAt(v: MapView, factor: number, px: number, py: number, width: number, height: number): MapView {
  const scale = Math.min(8, Math.max(1, v.scale * factor));
  return clampImagePan({ scale, tx: px - (px - v.tx) * scale / v.scale, ty: py - (py - v.ty) * scale / v.scale }, width, height);
}

/** Centered contain frame for an image inside an arbitrary box. Annotation SVGs
 * and pointer math must use this exact frame, not the letterboxed outer box. */
export function containFrame(boxW: number, boxH: number, imageW: number, imageH: number) {
  if (!(boxW > 0) || !(boxH > 0) || !(imageW > 0) || !(imageH > 0)) return { left: 0, top: 0, width: 0, height: 0 };
  const scale = Math.min(boxW / imageW, boxH / imageH);
  const width = imageW * scale, height = imageH * scale;
  return { left: (boxW - width) / 2, top: (boxH - height) / 2, width, height };
}
