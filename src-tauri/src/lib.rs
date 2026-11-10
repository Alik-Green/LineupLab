#[tauri::command]
fn is_valorant_running() -> bool {
  use sysinfo::{System, ProcessesToUpdate};
  let mut sys = System::new_all();
  sys.refresh_processes_specifics(ProcessesToUpdate::All, true);
  for (_, proc) in sys.processes() {
    let name = proc.name().to_string_lossy().to_lowercase();
    if name.contains("valorant") || name.contains("valorant-win64-shipping") {
      return true;
    }
  }
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
