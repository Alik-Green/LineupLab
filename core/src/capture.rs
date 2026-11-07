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
