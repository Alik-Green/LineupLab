//! LineupLab Tauri 2 desktop shell. All game-independent logic lives in `lineuplab-core`.
mod commands;
#[cfg(windows)]
mod capture;

use lineuplab_core::{capture::CaptureSettings, catalog::ValorantApi, db::Database, hotkeys::HotkeyConfig, overlay::OverlayState, storage::MediaStore};
use std::sync::{atomic::AtomicBool, Mutex};
use tauri::{Emitter, Manager};

pub struct AppState {
    pub db: Mutex<Database>,
    pub store: MediaStore,
    pub device_id: String,
    pub data_dir: std::path::PathBuf,
    pub api: ValorantApi,
    pub hotkeys: Mutex<HotkeyConfig>,
    pub overlay: Mutex<OverlayState>,
    pub overlay_lineup: Mutex<Option<String>>,
    pub capture: Mutex<CaptureSettings>,
    pub capture_blocked: AtomicBool,
    pub sync_server: Mutex<Option<lineuplab_core::server::ServerHandle>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    lineuplab_core::logging::init();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if let Some(state) = app.try_state::<AppState>() {
                            let cfg = state.hotkeys.lock().unwrap();
                            for b in &cfg.bindings {
                                if b.keys.parse::<tauri_plugin_global_shortcut::Shortcut>().map(|s| s == *shortcut).unwrap_or(false) {
                                    let _ = app.emit("lineuplab://hotkey", b.action.clone());
                                    break;
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let db = Database::open(data_dir.join("lineuplab.sqlite3"))?;
            let store = MediaStore::new(data_dir.join("media"))?;
            let device_id = match db.metadata("deviceId")? {
                Some(serde_json::Value::String(s)) => s,
                _ => { let id = uuid::Uuid::new_v4().to_string(); db.set_metadata("deviceId", &serde_json::json!(id))?; id }
            };
            let mut hotkeys = std::fs::read(data_dir.join("hotkeys.json")).ok().and_then(|b| serde_json::from_slice::<HotkeyConfig>(&b).ok()).filter(|c| c.validate().is_ok()).unwrap_or_default();
            for b in lineuplab_core::hotkeys::default_bindings() { if !hotkeys.bindings.iter().any(|x| x.action == b.action) { hotkeys.bindings.push(b); } }
            let overlay = std::fs::read(data_dir.join("overlay.json")).ok().and_then(|b| serde_json::from_slice::<OverlayState>(&b).ok()).unwrap_or_default();
            let capture = std::fs::read(data_dir.join("capture.json")).ok().and_then(|b| serde_json::from_slice::<CaptureSettings>(&b).ok()).unwrap_or_default();
            let api = ValorantApi::new(data_dir.join("art-cache"));
            app.manage(AppState { db: Mutex::new(db), store, device_id, data_dir: data_dir.clone(), api, hotkeys: Mutex::new(hotkeys.clone()), overlay: Mutex::new(overlay.clone()), overlay_lineup: Mutex::new(None), capture: Mutex::new(capture), capture_blocked: AtomicBool::new(false), sync_server: Mutex::new(None) });
            commands::register_hotkeys(app.handle(), &hotkeys);
            commands::apply_overlay(app.handle(), &overlay);
            if let Some(w) = app.get_webview_window("overlay") {
                let _ = w.set_ignore_cursor_events(overlay.settings.click_through);
                let _ = w.set_always_on_top(true);
                #[cfg(windows)]
                {
                    if let Ok(hwnd) = w.hwnd() {
                        if let Err(e) = capture::exclude_from_capture(hwnd.0 as isize) {
                            tracing::error!(error=%e, "Overlay capture exclusion failed; capture blocked");
                            app.state::<AppState>().capture_blocked.store(true, std::sync::atomic::Ordering::SeqCst);
                        }
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_lineups, commands::get_lineup, commands::save_lineup, commands::delete_lineup,
            commands::duplicate_lineup, commands::set_favorite, commands::get_catalog, commands::prepare_assets, commands::catalog_image_url, commands::asset_diagnostics, commands::log_image_error, commands::get_modes,
            commands::media_path, commands::put_image, commands::capture_monitor,
            commands::import_preview, commands::import_commit, commands::export_pack, commands::undo_import,
            commands::get_hotkeys, commands::rebind_hotkey, commands::get_overlay_settings, commands::set_overlay_settings, commands::resize_overlay,
            commands::get_capture_settings, commands::set_capture_settings, commands::list_monitors, commands::get_overlay_view, commands::set_overlay_lineup,
            commands::overlay_action, commands::learn_lineup,
            commands::start_sync_server, commands::stop_sync_server, commands::get_sync_server_status,
            commands::pair_sync, commands::sync_now, commands::download_library, commands::discover_sync
        ])
        .build(tauri::generate_context!())
        .expect("error while building LineupLab")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app.state::<AppState>();
                let handle = state.sync_server.lock().unwrap().take();
                if let Some(handle) = handle { let _ = tauri::async_runtime::block_on(handle.shutdown()); }
            }
        });
}
