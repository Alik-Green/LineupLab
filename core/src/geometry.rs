use crate::{AnnotationLine, FocusCircle, Point};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
/// Crops use the original image, never a thumbnail or previously annotated render.
/// zoomX/zoomY denote the inset's TOP-LEFT, provisionally until the real fixture is supplied.
pub fn lens_rect(c: &FocusCircle, image_width: u32, image_height: u32) -> Rect {
    let w = image_width.max(1) as f64;
    let h = image_height.max(1) as f64;
    let size = c.zoom_size.clamp(0.04, 1.);
    let scale = c.zoom_scale.clamp(1.5, 8.);
    let crop_w = (size / scale).min(1.);
    let crop_h = (size * w / (scale * h)).min(1.);
    Rect {
        x: (c.x - crop_w / 2.).clamp(0., 1. - crop_w),
        y: (c.y - crop_h / 2.).clamp(0., 1. - crop_h),
        width: crop_w,
        height: crop_h,
    }
}
pub fn inset_rect(c: &FocusCircle, image_width: u32, image_height: u32) -> Rect {
    let aspect = image_width.max(1) as f64 / image_height.max(1) as f64;
    let w = c.zoom_size.clamp(0.04, 1.);
    let h = (w * aspect).min(1.);
    let w = if h < w * aspect { h / aspect } else { w };
    Rect {
        x: c.zoom_x.clamp(0., 1. - w),
        y: c.zoom_y.clamp(0., 1. - h),
        width: w,
        height: h,
    }
}
pub fn pixel_crop(r: Rect, width: u32, height: u32) -> (u32, u32, u32, u32) {
    let x = (r.x * width as f64).round() as u32;
    let y = (r.y * height as f64).round() as u32;
    let w = ((r.width * width as f64).round() as u32)
        .max(1)
        .min(width.saturating_sub(x));
    let h = ((r.height * height as f64).round() as u32)
        .max(1)
        .min(height.saturating_sub(y));
    (x, y, w, h)
}
pub fn snap_angle(start: Point, end: Point, degrees: f64) -> Point {
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let step = degrees.to_radians();
    let angle = (dy.atan2(dx) / step).round() * step;
    let length = (dx * dx + dy * dy).sqrt();
    Point {
        x: start.x + angle.cos() * length,
        y: start.y + angle.sin() * length,
    }
    .clamped()
}
pub fn valid_line(line: &AnnotationLine) -> bool {
    line.points.len() >= 2
        && line.points.iter().all(|p| p.finite())
        && line.width.is_finite()
        && line.width > 0.
}
pub fn minimap_transform(p: Point, calibration: Option<&crate::config::MapCalibration>) -> Point {
    calibration.map_or(p, |c| c.apply(p))
}
