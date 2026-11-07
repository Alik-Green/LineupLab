//! LineupLab's portable core. It has no dependency on Valorant or a window system.
pub mod capture;
pub mod catalog;
pub mod config;
pub mod db;
pub mod error;
pub mod geometry;
pub mod hotkeys;
pub mod logging;
pub mod models;
pub mod overlay;
pub mod pack;
pub mod render;
pub mod server;
pub mod state_machine;
pub mod storage;
pub mod sync;

pub use error::{Error, Result};
pub use models::*;

/// Install the ring rustls provider once (reqwest is built with rustls-no-provider).
pub fn ensure_crypto_provider() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let _ = rustls::crypto::ring::default_provider().install_default();
    });
}
