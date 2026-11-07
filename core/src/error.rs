use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("Database: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("File access: {0}")]
    Io(#[from] std::io::Error),
    #[error("Network: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Image: {0}")]
    Image(#[from] image::ImageError),
    #[error("Pack archive: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("Invalid input: {0}")]
    Invalid(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Unsupported platform: {0}")]
    Unsupported(String),
}
impl serde::Serialize for Error {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
pub type Result<T> = std::result::Result<T, Error>;
