#[tauri::command]
fn is_valorant_running() -> bool {
  // JS-side detection via mediaDevices is primary; this stub keeps API compat
  // without requiring sysinfo crate which breaks Windows build in 0.30
  false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![is_valorant_running])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
