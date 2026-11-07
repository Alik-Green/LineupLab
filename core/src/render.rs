//! Shared raster geometry for flattened shares/export copies and documentation fixtures.
//! The interactive UI uses the same normalized geometry in AnnotatedImage.
use crate::{
    geometry::{inset_rect, lens_rect, pixel_crop},
    Arrow, LineStyle, SlotData,
};
use image::{DynamicImage, Rgba, RgbaImage};
pub fn color(s: &str) -> Rgba<u8> {
    match s.to_ascii_lowercase().as_str() {
        "cyan" => Rgba([34, 211, 238, 255]),
        "red" => Rgba([248, 80, 80, 255]),
        "yellow" => Rgba([250, 204, 21, 255]),
        "green" => Rgba([74, 222, 128, 255]),
        "magenta" => Rgba([232, 121, 249, 255]),
        "white" => Rgba([255, 255, 255, 255]),
        "orange" => Rgba([251, 146, 60, 255]),
        hex if hex.starts_with('#') && hex.len() == 7 => {
            let r = u8::from_str_radix(&hex[1..3], 16).unwrap_or(34);
            let g = u8::from_str_radix(&hex[3..5], 16).unwrap_or(211);
            let b = u8::from_str_radix(&hex[5..7], 16).unwrap_or(238);
            Rgba([r, g, b, 255])
        }
        _ => Rgba([34, 211, 238, 255]),
    }
}
fn blend(img: &mut RgbaImage, x: i32, y: i32, c: Rgba<u8>) {
    if x >= 0 && y >= 0 && (x as u32) < img.width() && (y as u32) < img.height() {
        let bg = *img.get_pixel(x as u32, y as u32);
        let a = c[3] as u32;
        let rgb = [0, 1, 2].map(|i| ((c[i] as u32 * a + bg[i] as u32 * (255 - a)) / 255) as u8);
        let out = Rgba([rgb[0], rgb[1], rgb[2], 255]);
        img.put_pixel(x as u32, y as u32, out);
    }
}
fn disk(img: &mut RgbaImage, x: f64, y: f64, r: f64, c: Rgba<u8>) {
    for yy in (y - r).floor() as i32..=(y + r).ceil() as i32 {
        for xx in (x - r).floor() as i32..=(x + r).ceil() as i32 {
            if ((xx as f64 - x).powi(2) + (yy as f64 - y).powi(2)).sqrt() <= r {
                blend(img, xx, yy, c);
            }
        }
    }
}
fn ring(img: &mut RgbaImage, x: f64, y: f64, r: f64, width: f64, c: Rgba<u8>) {
    for yy in (y - r - width).floor() as i32..=(y + r + width).ceil() as i32 {
        for xx in (x - r - width).floor() as i32..=(x + r + width).ceil() as i32 {
            let d = ((xx as f64 - x).powi(2) + (yy as f64 - y).powi(2)).sqrt();
            if (d - r).abs() <= width / 2. {
                blend(img, xx, yy, c);
            }
        }
    }
}
fn segment(
    img: &mut RgbaImage,
    a: (f64, f64),
    b: (f64, f64),
    width: f64,
    c: Rgba<u8>,
    style: LineStyle,
) {
    let len = ((b.0 - a.0).powi(2) + (b.1 - a.1).powi(2)).sqrt();
    let steps = (len * 1.5).ceil() as usize;
    for i in 0..=steps {
        let t = i as f64 / steps.max(1) as f64;
        let dash = match style {
            LineStyle::Solid => true,
            LineStyle::Dashed => (t * len / 12.) as u32 % 2 == 0,
            LineStyle::Dotted => (t * len / 5.) as u32 % 2 == 0,
        };
        if dash {
            disk(
                img,
                a.0 + (b.0 - a.0) * t,
                a.1 + (b.1 - a.1) * t,
                width / 2.,
                c,
            );
        }
    }
}
fn arrow(img: &mut RgbaImage, from: (f64, f64), to: (f64, f64), size: f64, c: Rgba<u8>) {
    let angle = (to.1 - from.1).atan2(to.0 - from.0);
    for side in [-1., 1.] {
        let a = angle + std::f64::consts::PI + side * 0.55;
        segment(
            img,
            to,
            (to.0 + a.cos() * size, to.1 + a.sin() * size),
            2.,
            c,
            LineStyle::Solid,
        );
    }
}
pub fn flatten(bytes: &[u8], data: &SlotData) -> crate::Result<Vec<u8>> {
    let original = image::load_from_memory(bytes)?;
    let mut img = original.to_rgba8();
    let w = img.width() as f64;
    let h = img.height() as f64;
    for line in &data.lines {
        if line.points.len() < 2 {
            continue;
        }
        let c = color(&line.color);
        let width = (line.width * w).max(2.);
        let pts: Vec<_> = line.points.iter().map(|p| (p.x * w, p.y * h)).collect();
        for pair in pts.windows(2) {
            segment(&mut img, pair[0], pair[1], width, c, line.style);
        }
        if matches!(line.arrow, Arrow::End | Arrow::Both) {
            arrow(&mut img, pts[pts.len() - 2], pts[pts.len() - 1], 14., c);
        }
        if matches!(line.arrow, Arrow::Start | Arrow::Both) {
            arrow(&mut img, pts[1], pts[0], 14., c);
        }
    }
    for circle in &data.circles {
        let c = color(&circle.color);
        let x = circle.x * w;
        let y = circle.y * h;
        let r = circle.radius * w;
        ring(&mut img, x, y, r, 2.5, c);
        disk(&mut img, x, y, 2., c);
        if circle.show_zoom && w >= 200. {
            let crop = pixel_crop(
                lens_rect(circle, img.width(), img.height()),
                img.width(),
                img.height(),
            );
            let inset = pixel_crop(
                inset_rect(circle, img.width(), img.height()),
                img.width(),
                img.height(),
            );
            if crop.2 > 0 && crop.3 > 0 && inset.2 > 2 && inset.3 > 2 {
                let cropped = original
                    .crop_imm(crop.0, crop.1, crop.2, crop.3)
                    .resize_exact(
                        inset.2 - 2,
                        inset.3 - 2,
                        image::imageops::FilterType::Lanczos3,
                    )
                    .to_rgba8();
                segment(
                    &mut img,
                    (x, y),
                    (inset.0 as f64, inset.1 as f64 + inset.3 as f64 / 2.),
                    1.5,
                    Rgba([c[0], c[1], c[2], 140]),
                    LineStyle::Dashed,
                );
                image::imageops::overlay(
                    &mut img,
                    &cropped,
                    inset.0 as i64 + 1,
                    inset.1 as i64 + 1,
                );
                let (ix, iy, iw, ih) = (
                    inset.0 as f64,
                    inset.1 as f64,
                    inset.2 as f64,
                    inset.3 as f64,
                );
                for (a, b) in [
                    ((ix, iy), (ix + iw, iy)),
                    ((ix + iw, iy), (ix + iw, iy + ih)),
                    ((ix + iw, iy + ih), (ix, iy + ih)),
                    ((ix, iy + ih), (ix, iy)),
                ] {
                    segment(&mut img, a, b, 3., c, LineStyle::Solid);
                }
            }
        }
    }
    let mut out = std::io::Cursor::new(vec![]);
    DynamicImage::ImageRgba8(img).write_to(&mut out, image::ImageFormat::Png)?;
    Ok(out.into_inner())
}
