use crate::Result;
/// Implementations capture ordinary screen pixels. They MUST NOT open the game process.
pub trait CaptureProvider: Send + Sync {
    fn capture(&mut self) -> Result<Vec<u8>>;
    fn monitor_name(&self) -> String;
}
pub struct MockCaptureProvider {
    pub image: Vec<u8>,
    pub captures: usize,
}
impl MockCaptureProvider {
    pub fn new(image: Vec<u8>) -> Self {
        Self { image, captures: 0 }
    }
}
impl CaptureProvider for MockCaptureProvider {
    fn capture(&mut self) -> Result<Vec<u8>> {
        self.captures += 1;
        Ok(self.image.clone())
    }
    fn monitor_name(&self) -> String {
        "Mock monitor".into()
    }
}
/// The desktop shell supplies its platform provider; Linux tests use MockCaptureProvider.
pub fn system_provider() -> Result<Box<dyn CaptureProvider>> {
    Err(crate::Error::Unsupported(
        "Use the Windows desktop capture adapter or the mock provider".into(),
    ))
}

/// Fast-capture defaults: ≤1600 px wide, ~85 quality WebP (JPEG fallback), separate thumbnail.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSettings {
    pub max_width: u32,
    pub quality: u8,
    pub webp: bool,
    pub thumbnail: bool,
    pub target_ms: u64,
}
impl Default for CaptureSettings {
    fn default() -> Self {
        Self {
            max_width: 1600,
            quality: 85,
            webp: true,
            thumbnail: true,
            target_ms: 150,
        }
    }
}
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureOutcome {
    pub hash: String,
    pub width: u32,
    pub height: u32,
    pub mime: String,
    pub elapsed_ms: u64,
    pub exceeded_target: bool,
    pub monitor: String,
}
/// Capture ordinary screen pixels, downscale/encode, content-address and thumbnail.
/// The original screenshot is never written over; each capture is a new immutable object.
pub fn capture_processed(
    provider: &mut dyn CaptureProvider,
    store: &crate::storage::MediaStore,
    settings: &CaptureSettings,
) -> Result<CaptureOutcome> {
    let start = std::time::Instant::now();
    let raw = provider.capture()?;
    let (bytes, mime) = crate::storage::MediaStore::encode_capture(
        &raw,
        settings.max_width.max(16),
        settings.quality.clamp(1, 100),
        settings.webp,
    )?;
    let (width, height) = store.dimensions(&bytes).unwrap_or((0, 0));
    let hash = store.put_with_thumbnail(&bytes, settings.thumbnail)?;
    let elapsed_ms = start.elapsed().as_millis() as u64;
    Ok(CaptureOutcome {
        hash,
        width,
        height,
        mime: mime.into(),
        elapsed_ms,
        exceeded_target: elapsed_ms > settings.target_ms,
        monitor: provider.monitor_name(),
    })
}
