//! Browse-only Android companion. No creation, overlay, hotkeys or screen capture.
mod commands;
use lineuplab_core::{catalog::ValorantApi, db::Database, storage::MediaStore};
use std::sync::Mutex;
use tauri::Manager;

pub struct MobileState {
    pub db: Mutex<Database>,
    pub store: MediaStore,
    pub device_id: String,
    pub data_dir: std::path::PathBuf,
    pub api: ValorantApi,
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    lineuplab_core::logging::init();
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let db = Database::open(data_dir.join("lineuplab.sqlite3"))?;
            let store = MediaStore::new(data_dir.join("media"))?;
            let device_id = match db.metadata("deviceId")? { Some(serde_json::Value::String(s)) => s, _ => { let id = uuid::Uuid::new_v4().to_string(); db.set_metadata("deviceId", &serde_json::json!(id))?; id } };
            let api = ValorantApi::new(data_dir.join("art-cache"));
            app.manage(MobileState { db: Mutex::new(db), store, device_id, data_dir, api });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_lineups, commands::get_lineup, commands::get_catalog, commands::get_modes,
            commands::media_path, commands::pair_sync, commands::sync_now, commands::discover_sync,
            commands::get_sync_settings, commands::set_sync_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running LineupLab Companion");
}
