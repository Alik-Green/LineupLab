use tauri::Manager;

#[tauri::command]
fn is_valorant_running() -> bool {
  false
}

#[tauri::command]
fn capture_screen() -> Result<String, String> {
  // Capture primary screen using screenshots crate; return base64 png
  // Fallback to error so JS can use getDisplayMedia
  (|| -> Result<String, String> {
    let screens = screenshots::Screen::all().map_err(|e| e.to_string())?;
    let screen = screens.into_iter().next().ok_or("no screen")?;
    let img = screen.capture().map_err(|e| e.to_string())?;
    let mut buf: Vec<u8> = Vec::new();
    {
      let mut enc = image::codecs::png::PngEncoder::new(&mut buf);
      use image::ImageEncoder;
      enc.write_image(img.buffer(), img.width(), img.height(), image::ColorType::Rgba8)
        .map_err(|e| e.to_string())?;
    }
    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buf))
  })()
}

#[tauri::command]
fn open_pip_overlay(app: tauri::AppHandle, title: String, image: String, idx: u32, total: u32) -> Result<(), String> {
  // Create or focus always-on-top PiP window in corner
  let label = "pip";
  if let Some(win) = app.get_webview_window(label) {
    let _ = win.set_focus();
    let _ = win.set_title(&format!("{title} {}/{}", idx+1, total)).map_err(|e| e.to_string());
    // eval to update image
    let js = format!("document.body.innerHTML = '<div style=\"margin:0;background:#0B0E14;display:flex;flex-direction:column;height:100vh\"><div style=\"padding:8px;background:#1B1B1F;color:#EDEDED;font-weight:800;font-size:12px;border-bottom:1px solid #2A2B32\">{title} — {idx}/{total}</div><div style=\"flex:1;display:flex;align-items:center;justify-content:center;background:#131315;padding:8px\"><img src=\"{}\" style=\"max-width:100%;max-height:100%;object-fit:contain;border-radius:6px\" /></div></div>'", image.replace('\'', "%27"));
    let _ = win.eval(&js);
    let _ = win.set_always_on_top(true);
    return Ok(());
  }
  let _ = tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App("index.html?pip=1".into()))
    .title(title)
    .inner_size(420.0, 320.0)
    .position(1280.0, 720.0)
    .always_on_top(true)
    .decorations(false)
    .transparent(false)
    .skip_taskbar(true)
    .resizable(true)
    .min_inner_size(280.0, 180.0)
    .build()
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
fn lan_get_addrs() -> String {
  // Return local ip:port — best-effort, let frontend fallback to mock
  // Try to read from env or return placeholder; real impl would enumerate interfaces
  "192.168.1.42:3030".to_string()
}
#[tauri::command]
fn lan_host_start(port: u16) -> Result<String, String> { Ok(format!("hosting on {}", port)) }
#[tauri::command]
fn lan_host_stop() -> Result<(), String> { Ok(()) }
#[tauri::command]
fn lan_join(addr: String) -> Result<String, String> { Ok(format!("joined {}", addr)) }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![is_valorant_running, capture_screen, open_pip_overlay, lan_get_addrs, lan_host_start, lan_host_stop, lan_join])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
