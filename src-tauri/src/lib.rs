#[tauri::command]
fn is_valorant_running() -> bool {
  use sysinfo::{System, SystemExt};
  let mut sys = System::new_all();
  sys.refresh_all();
  for (_, proc) in sys.processes() {
    let name = format!("{:?}", proc.name()).to_lowercase();
    if name.contains("valorant") {
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
