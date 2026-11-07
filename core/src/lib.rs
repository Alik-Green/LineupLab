//! LineupLab's portable core. It has no dependency on Valorant or a window system.
pub mod capture;
pub mod catalog;
pub mod config;
pub mod db;
pub mod error;
pub mod geometry;
pub mod logging;
pub mod models;
pub mod pack;
pub mod server;
pub mod state_machine;
pub mod storage;
pub mod sync;

pub use error::{Error, Result};
pub use models::*;
