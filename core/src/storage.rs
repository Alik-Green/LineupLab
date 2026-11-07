use crate::{Error, Result};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct MediaStore {
    pub root: PathBuf,
}
pub fn hash_bytes(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}
pub fn valid_hash(hash: &str) -> bool {
    hash.len() == 64
        && hash
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}
pub fn mime_for(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        "image/jpeg"
    } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        "image/png"
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "image/webp"
    } else if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" {
        "video/mp4"
    } else if bytes.starts_with(b"\x1aE\xdf\xa3") {
        "video/webm"
    } else {
        "application/octet-stream"
    }
}
impl MediaStore {
    pub fn new(root: impl AsRef<Path>) -> Result<Self> {
        let s = Self {
            root: root.as_ref().into(),
        };
        std::fs::create_dir_all(s.root.join("images"))?;
        std::fs::create_dir_all(s.root.join("thumbs"))?;
        Ok(s)
    }
    pub fn path(&self, hash: &str) -> Result<PathBuf> {
        if !valid_hash(hash) {
            return Err(Error::Invalid("Invalid content hash".into()));
        }
        Ok(self.root.join("images").join(&hash[..2]).join(hash))
    }
    pub fn thumbnail_path(&self, hash: &str) -> Result<PathBuf> {
        self.path(hash)?;
        Ok(self.root.join("thumbs").join(format!("{hash}.webp")))
    }
    pub fn has(&self, hash: &str) -> bool {
        self.path(hash).is_ok_and(|p| p.is_file())
    }
    pub fn get(&self, hash: &str) -> Result<Vec<u8>> {
        Ok(std::fs::read(self.path(hash)?)?)
    }
    pub fn put(&self, bytes: &[u8]) -> Result<String> {
        self.put_with_thumbnail(bytes, true)
    }
    pub fn put_with_thumbnail(&self, bytes: &[u8], thumbnail: bool) -> Result<String> {
        let hash = hash_bytes(bytes);
        let path = self.path(&hash)?;
        if !path.exists() {
            std::fs::create_dir_all(
                path.parent()
                    .ok_or_else(|| Error::Invalid("Media path".into()))?,
            )?;
            let tmp = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
            std::fs::write(&tmp, bytes)?;
            if let Err(e) = std::fs::rename(&tmp, &path) {
                let _ = std::fs::remove_file(&tmp);
                return Err(e.into());
            }
        }
        if thumbnail
            && mime_for(bytes).starts_with("image/")
            && !self.thumbnail_path(&hash)?.exists()
        {
            match image::ImageReader::new(std::io::Cursor::new(bytes))
                .with_guessed_format()?
                .decode()
            {
                Ok(img) => {
                    let thumb = img.thumbnail(480, 300);
                    let path = self.thumbnail_path(&hash)?;
                    let tmp = path.with_extension("tmp");
                    let mut encoded = std::io::Cursor::new(vec![]);
                    thumb.write_to(&mut encoded, image::ImageFormat::WebP)?;
                    std::fs::write(&tmp, encoded.into_inner())?;
                    std::fs::rename(tmp, path)?;
                }
                Err(e) => {
                    tracing::warn!(error=%e, hash, "Thumbnail unavailable; original retained")
                }
            }
        }
        Ok(hash)
    }
    pub fn thumbnail(&self, hash: &str) -> Result<Vec<u8>> {
        let path = self.thumbnail_path(hash)?;
        if path.exists() {
            Ok(std::fs::read(path)?)
        } else {
            self.get(hash)
        }
    }
    pub fn dimensions(&self, bytes: &[u8]) -> Option<(u32, u32)> {
        image::ImageReader::new(std::io::Cursor::new(bytes))
            .with_guessed_format()
            .ok()?
            .into_dimensions()
            .ok()
    }
    pub fn encode_capture(
        bytes: &[u8],
        width: u32,
        quality: u8,
        webp: bool,
    ) -> Result<(Vec<u8>, &'static str)> {
        let img = image::load_from_memory(bytes)?;
        let img = if img.width() > width {
            img.resize(width, u32::MAX, image::imageops::FilterType::Lanczos3)
        } else {
            img
        };
        let mut out = vec![];
        if webp {
            img.write_to(
                &mut std::io::Cursor::new(&mut out),
                image::ImageFormat::WebP,
            )?;
            Ok((out, "image/webp"))
        } else {
            let encoder =
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality.clamp(1, 100));
            img.write_with_encoder(encoder)?;
            Ok((out, "image/jpeg"))
        }
    }
}
