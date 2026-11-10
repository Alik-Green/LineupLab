use tauri::{Manager, Emitter};
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
struct OverlayData {
    lineup: serde_json::Value,
    idx: Option<u32>,
    opacity: Option<f64>,
}

#[tauri::command]
fn is_valorant_running() -> bool {
  false
}

#[tauri::command]
fn capture_screen() -> Result<String, String> {
  Err("native capture not available — use getDisplayMedia".to_string())
}

// ----- Overlay window commands (desktop only — separate frameless always-on-top window) -----
#[cfg(desktop)]
#[tauri::command]
async fn open_overlay(app: tauri::AppHandle, lineup: serde_json::Value, idx: Option<u32>) -> Result<String, String> {
    let w = create_or_get_overlay(app.clone()).await?;
    let _ = w.set_always_on_top(true).map_err(|e| e.to_string());
    let _ = w.show().map_err(|e| e.to_string());
    let _ = w.set_focus().map_err(|e| e.to_string());
    let payload = serde_json::json!({ "lineup": lineup, "idx": idx.unwrap_or(0) });
    let _ = app.emit("overlay:update", payload);
    Ok("opened".to_string())
}

#[cfg(not(desktop))]
#[tauri::command]
async fn open_overlay(_app: tauri::AppHandle, _lineup: serde_json::Value, _idx: Option<u32>) -> Result<String, String> {
    Ok("overlay not supported on mobile".to_string())
}

#[cfg(desktop)]
#[tauri::command]
async fn close_overlay(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.hide().map_err(|e| e.to_string());
    }
    Ok(())
}

#[cfg(not(desktop))]
#[tauri::command]
async fn close_overlay(_app: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
async fn set_overlay_corner(app: tauri::AppHandle, corner: String) -> Result<(), String> {
    let label = "overlay";
    if let Some(w) = app.get_webview_window(label) {
        position_overlay_window(&w, &app, &corner).await?;
    }
    Ok(())
}

#[cfg(not(desktop))]
#[tauri::command]
async fn set_overlay_corner(_app: tauri::AppHandle, _corner: String) -> Result<(), String> {
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
async fn set_overlay_size(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: width as u32, height: height as u32 })).map_err(|e| e.to_string());
    }
    Ok(())
}

#[cfg(not(desktop))]
#[tauri::command]
async fn set_overlay_size(_app: tauri::AppHandle, _width: f64, _height: f64) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn get_overlay_data(_app: tauri::AppHandle) -> Option<serde_json::Value> {
    None
}

#[tauri::command]
fn lan_get_addrs() -> String { "192.168.1.42:3030".to_string() }
#[tauri::command]
fn lan_host_start(port: u16) -> Result<String, String> { Ok(format!("hosting on {}", port)) }
#[tauri::command]
fn lan_host_stop() -> Result<(), String> { Ok(()) }
#[tauri::command]
fn lan_join(addr: String) -> Result<String, String> { Ok(format!("joined {}", addr)) }

#[cfg(desktop)]
async fn create_or_get_overlay(app: tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(w) = app.get_webview_window("overlay") {
        return Ok(w);
    }
    let win = tauri::WebviewWindowBuilder::new(&app, "overlay", tauri::WebviewUrl::App("index.html?overlay=1".into()))
        .title("LineupLab Overlay")
        .inner_size(420.0, 300.0)
        .min_inner_size(280.0, 180.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;
    let _ = position_overlay_window(&win, &app, "bottom-right").await;
    Ok(win)
}

#[cfg(desktop)]
async fn position_overlay_window(win: &tauri::WebviewWindow, app: &tauri::AppHandle, corner: &str) -> Result<(), String> {
    let monitor = win.current_monitor().map_err(|e| e.to_string())?.ok_or("no monitor")?;
    let scale = monitor.scale_factor();
    let mon_size = monitor.size();
    let win_size = win.outer_size().map_err(|e| e.to_string())?;
    let pad = (16.0 * scale) as i32;
    let (x, y) = match corner {
        "top-left" => (pad, pad),
        "top-right" => (mon_size.width as i32 - win_size.width as i32 - pad, pad),
        "bottom-left" => (pad, mon_size.height as i32 - win_size.height as i32 - pad),
        "bottom-right" => (mon_size.width as i32 - win_size.width as i32 - pad, mon_size.height as i32 - win_size.height as i32 - pad),
        _ => (mon_size.width as i32 - win_size.width as i32 - pad, mon_size.height as i32 - win_size.height as i32 - pad),
    };
    let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y })).map_err(|e| e.to_string());
    let _ = app.emit("overlay:corner", corner.to_string());
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
        is_valorant_running, capture_screen,
        open_overlay, close_overlay, set_overlay_corner, set_overlay_size, get_overlay_data,
        lan_get_addrs, lan_host_start, lan_host_stop, lan_join
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
