use crate::AppState;
use lineuplab_core::{capture, config::ModeConfig, hotkeys::{HotkeyConfig, HotkeyFeedback}, overlay::{OverlaySettings, OverlayState}, pack::{self, ConflictPolicy, ExportOptions}, Lineup, Slot, SLOT_ORDER};
use serde_json::{json, Map, Value};
use std::collections::BTreeSet;
use tauri::{Emitter, Manager, State};

type CmdResult<T> = Result<T, String>;
fn err(e: impl std::fmt::Display) -> String { e.to_string() }

/// Core uses mapId/agentId/video; the shared UI uses mapUuid/agentUuid/videoClip.
pub fn to_ui(l: &Lineup) -> Value {
    let mut v = serde_json::to_value(l).unwrap_or(json!({}));
    if let Some(o) = v.as_object_mut() {
        if let Some(x) = o.remove("mapId") { o.insert("mapUuid".into(), x); }
        if let Some(x) = o.remove("agentId") { o.insert("agentUuid".into(), x); }
        if let Some(video) = o.remove("video") { o.insert("videoClip".into(), video.get("clip").cloned().unwrap_or(Value::Null)); o.insert("videoThumbnail".into(), video.get("thumbnail").cloned().unwrap_or(Value::Null)); }
        let pins = o.get("extensions").and_then(|e| e.get("aimPins")).cloned().unwrap_or(json!({}));
        o.insert("aim1Pos".into(), pins.get("aim1").cloned().unwrap_or(Value::Null));
        o.insert("aim2Pos".into(), pins.get("aim2").cloned().unwrap_or(Value::Null));
        if let Some(slots) = o.get_mut("slots").and_then(Value::as_object_mut) { for s in SLOT_ORDER { slots.entry(s.as_str().to_string()).or_insert_with(|| json!({"image":null,"circles":[],"lines":[]})); } }
    }
    v
}
pub fn from_ui(v: Value) -> Result<Lineup, String> {
    let mut v = v;
    if let Some(o) = v.as_object_mut() {
        if let Some(x) = o.remove("mapUuid") { o.insert("mapId".into(), x); }
        if let Some(x) = o.remove("agentUuid") { o.insert("agentId".into(), x); }
        let clip = o.remove("videoClip").unwrap_or(Value::Null); let thumb = o.remove("videoThumbnail").unwrap_or(Value::Null);
        if clip.is_string() { let mut video = Map::new(); video.insert("clip".into(), clip); if thumb.is_string() { video.insert("thumbnail".into(), thumb); } o.insert("video".into(), Value::Object(video)); } else { o.insert("video".into(), Value::Null); }
        let aim1 = o.remove("aim1Pos").unwrap_or(Value::Null); let aim2 = o.remove("aim2Pos").unwrap_or(Value::Null);
        let ext = o.entry("extensions".to_string()).or_insert_with(|| json!({}));
        if let Some(e) = ext.as_object_mut() { let mut pins = Map::new(); if aim1.is_object() { pins.insert("aim1".into(), aim1); } if aim2.is_object() { pins.insert("aim2".into(), aim2); } if !pins.is_empty() { e.insert("aimPins".into(), Value::Object(pins)); } }
    }
    serde_json::from_value(v).map_err(err)
}

#[tauri::command] pub fn list_lineups(state: State<AppState>) -> CmdResult<Vec<Value>> { Ok(state.db.lock().unwrap().all(false).map_err(err)?.iter().map(to_ui).collect()) }
#[tauri::command] pub fn get_lineup(state: State<AppState>, id: String) -> CmdResult<Option<Value>> { Ok(state.db.lock().unwrap().get(&id).map_err(err)?.as_ref().map(to_ui)) }
#[tauri::command] pub fn save_lineup(state: State<AppState>, lineup: Value) -> CmdResult<Value> { let mut l = from_ui(lineup)?; let mut db = state.db.lock().unwrap(); db.save_edited(&mut l, &state.device_id).map_err(err)?; Ok(to_ui(&l)) }
#[tauri::command] pub fn delete_lineup(state: State<AppState>, id: String) -> CmdResult<()> { state.db.lock().unwrap().tombstone(&id, &state.device_id).map_err(err) }
#[tauri::command] pub fn duplicate_lineup(state: State<AppState>, id: String) -> CmdResult<Value> { let mut db = state.db.lock().unwrap(); let mut l = db.get(&id).map_err(err)?.ok_or_else(|| "Not found".to_string())?; l.id = uuid::Uuid::new_v4().to_string(); l.title = format!("{} (copy)", l.title); l.created_at = lineuplab_core::now(); l.updated_at = l.created_at.clone(); l.revision = 0; l.import_batch_id = None; db.save_edited(&mut l, &state.device_id).map_err(err)?; Ok(to_ui(&l)) }
#[tauri::command] pub fn set_favorite(state: State<AppState>, id: String, value: bool) -> CmdResult<()> { state.db.lock().unwrap().favorite(&id, value, &state.device_id).map_err(err)?; Ok(()) }

fn icon_url(app: &tauri::AppHandle, api: &lineuplab_core::catalog::ValorantApi, url: Option<&str>) -> Value {
    match url { Some(u) => { if let Ok(p) = api.image_path(u) { if p.exists() { if let Ok(asset) = app.path().convert_file_src(&p) { return json!(asset.to_string()); } } } json!(u) }, None => Value::Null }
}
#[tauri::command] pub async fn get_catalog(app: tauri::AppHandle, state: State<'_, AppState>) -> CmdResult<Value> {
    let lineups = state.db.lock().unwrap().all(false).map_err(err)?;
    let mut c = state.api.refresh(false).await.map_err(err)?;
    c.archive_missing(&lineups);
    let agents: Vec<Value> = c.agents.iter().map(|a| json!({"uuid":a.uuid,"displayName":a.display_name,"displayIcon":icon_url(&app,&state.api,a.display_icon.as_deref()),"role":Value::Null,"isArchived":a.archived})).collect();
    let maps: Vec<Value> = c.maps.iter().map(|m| json!({"uuid":m.uuid,"displayName":m.display_name,"displayIcon":icon_url(&app,&state.api,m.display_icon.as_deref()),"isArchived":m.archived})).collect();
    Ok(json!({"agents":agents,"maps":maps,"version":c.version,"updatedAt":c.last_updated.unwrap_or_else(lineuplab_core::now),"stale":c.offline,"warning":c.warning}))
}
#[tauri::command] pub fn get_modes() -> CmdResult<Vec<Value>> {
    let cfg = ModeConfig::load().map_err(err)?; cfg.validate().map_err(err)?;
    let mut seen = BTreeSet::new(); let mut out = vec![];
    for m in cfg.defaults.iter().chain(cfg.rules.iter().flat_map(|r| &r.modes)) {
        if !seen.insert(m.id.clone()) { continue; }
        let attrs: Map<String, Value> = m.attributes.iter().map(|(k, v)| { let ty = if v.is_boolean() { "boolean" } else if v.is_number() { "number" } else { "string" }; (k.clone(), json!({"type":ty,"default":v})) }).collect();
        out.push(json!({"id":m.id,"label":m.label,"requiredSlots":m.required_slots,"optionalSlots":m.optional_slots,"attributes":attrs}));
    }
    Ok(out)
}
#[tauri::command] pub fn media_path(state: State<AppState>, hash: String) -> CmdResult<String> { Ok(state.store.path(&hash).map_err(err)?.to_string_lossy().into_owned()) }
#[tauri::command] pub fn put_image(state: State<AppState>, bytes: Vec<u8>, mime: String) -> CmdResult<String> { if !mime.starts_with("image/") { return Err("Only image uploads are accepted here".into()); } state.store.put(&bytes).map_err(err) }
#[tauri::command] pub fn capture_monitor(state: State<AppState>, _monitor: Option<u32>) -> CmdResult<capture::CaptureOutcome> {
    if state.capture_blocked.load(std::sync::atomic::Ordering::SeqCst) { return Err("Capture blocked: overlay could not be excluded from capture (Windows 10 2004+ required).".into()); }
    let settings = state.capture.lock().unwrap().clone();
    #[cfg(windows)] { let mut provider = crate::capture::system_provider().map_err(err)?; return capture::capture_processed(provider.as_mut(), &state.store, &settings).map_err(err); }
    #[cfg(not(windows))] { Err("Screen capture is implemented by the Windows desktop adapter; Linux uses mocks.".into()) }
}
#[tauri::command] pub fn import_preview(state: State<AppState>, bytes: Vec<u8>) -> CmdResult<Value> {
    let archive = pack::read_archive(&bytes).map_err(err)?; let db = state.db.lock().unwrap(); let p = pack::preview(&archive, &db).map_err(err)?;
    let entries: Vec<Value> = p.entries.iter().map(|e| json!({"id":e.id,"title":e.title,"status":e.status,"selected":e.selected,"warnings":e.warnings})).collect();
    Ok(json!({"entries":entries,"warnings":p.warnings,"seed":archive.manifest.is_seed_placeholder}))
}
#[tauri::command] pub fn import_commit(state: State<AppState>, bytes: Vec<u8>, selected: Vec<String>, policy: String) -> CmdResult<Value> {
    let policy = match policy.as_str() { "skip" => ConflictPolicy::Skip, "import-as-copy" => ConflictPolicy::ImportAsCopy, _ => ConflictPolicy::OverwriteIfNewer };
    let archive = pack::read_archive(&bytes).map_err(err)?; let mut db = state.db.lock().unwrap(); let p = pack::preview(&archive, &db).map_err(err)?;
    let report = pack::commit(&mut db, &state.store, &archive, &p, &selected.into_iter().collect::<BTreeSet<_>>(), policy).map_err(err)?;
    Ok(serde_json::to_value(report).map_err(err)?)
}
#[tauri::command] pub fn export_pack(state: State<AppState>, ids: Option<Vec<String>>, legacy_images: bool, bake: bool) -> CmdResult<Vec<u8>> {
    let db = state.db.lock().unwrap(); let all = db.all(false).map_err(err)?;
    let lineups: Vec<Lineup> = match ids { Some(ids) => all.into_iter().filter(|l| ids.contains(&l.id)).collect(), None => all };
    let opts = ExportOptions { legacy_compatible_images: legacy_images, bake_annotations: bake, ..Default::default() };
    pack::export(&db, &state.store, &lineups, &opts).map_err(err)
}
#[tauri::command] pub fn undo_import(state: State<AppState>, batch_id: String) -> CmdResult<()> { pack::undo_import(&mut state.db.lock().unwrap(), &batch_id).map_err(err)?; Ok(()) }

pub fn register_hotkeys(app: &tauri::AppHandle, cfg: &HotkeyConfig) {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    for b in &cfg.bindings { if let Ok(s) = b.keys.parse::<tauri_plugin_global_shortcut::Shortcut>() { if let Err(e) = gs.register(s) { tracing::warn!(error=%e, keys=%b.keys, "Hotkey registration failed"); } } }
}
#[tauri::command] pub fn get_hotkeys(state: State<AppState>) -> CmdResult<Vec<Value>> { Ok(serde_json::to_value(&state.hotkeys.lock().unwrap().bindings).map_err(err)?) }
#[tauri::command] pub fn rebind_hotkey(app: tauri::AppHandle, state: State<AppState>, action: String, keys: String) -> CmdResult<HotkeyFeedback> {
    let mut cfg = state.hotkeys.lock().unwrap(); let feedback = cfg.rebind(&action, &keys);
    if feedback.is_ok() { let _ = std::fs::write(state.data_dir.join("hotkeys.json"), serde_json::to_vec_pretty(&*cfg).unwrap()); register_hotkeys(&app, &cfg); let _ = app.emit("lineuplab://hotkeys-changed", &cfg.bindings); }
    Ok(feedback)
}
fn apply_overlay(app: &tauri::AppHandle, s: &OverlayState) {
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.set_ignore_cursor_events(s.settings.click_through);
        let _ = w.set_always_on_top(true);
        let (x, y) = s.settings.position(1920, 1080);
        let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
        let _ = w.set_size(tauri::PhysicalSize::new(s.settings.width, s.settings.height));
        if s.settings.enabled && s.visible { let _ = w.show(); } else { let _ = w.hide(); }
    }
}
#[tauri::command] pub fn get_overlay_settings(state: State<AppState>) -> CmdResult<OverlaySettings> { Ok(state.overlay.lock().unwrap().settings.clone()) }
#[tauri::command] pub fn set_overlay_settings(app: tauri::AppHandle, state: State<AppState>, settings: OverlaySettings) -> CmdResult<()> {
    let mut s = state.overlay.lock().unwrap(); s.settings = settings; s.settings.clamp(); let _ = std::fs::write(state.data_dir.join("overlay.json"), serde_json::to_vec_pretty(&*s).unwrap()); apply_overlay(&app, &s); let _ = app.emit("lineuplab://overlay-changed", &*s); Ok(())
}
#[tauri::command] pub fn get_capture_settings(state: State<AppState>) -> CmdResult<capture::CaptureSettings> { Ok(state.capture.lock().unwrap().clone()) }
#[tauri::command] pub fn set_capture_settings(state: State<AppState>, settings: capture::CaptureSettings) -> CmdResult<()> { let mut c = state.capture.lock().unwrap(); *c = settings; let _ = std::fs::write(state.data_dir.join("capture.json"), serde_json::to_vec_pretty(&*c).unwrap()); Ok(()) }
#[tauri::command] pub fn get_overlay_view(state: State<AppState>) -> CmdResult<Value> {
    let s = state.overlay.lock().unwrap().clone(); let id = state.overlay_lineup.lock().unwrap().clone();
    let lineup = match id { Some(id) => state.db.lock().unwrap().get(&id).map_err(err)?.as_ref().map(to_ui), None => None };
    Ok(json!({"state":s,"lineup":lineup}))
}
#[tauri::command] pub fn set_overlay_lineup(app: tauri::AppHandle, state: State<AppState>, id: Option<String>) -> CmdResult<()> {
    *state.overlay_lineup.lock().unwrap() = id.clone();
    if let Some(id) = id { if let Some(l) = state.db.lock().unwrap().get(&id).map_err(err)? { let mut s = state.overlay.lock().unwrap(); s.set_view_lineup(&l); let required = ModeConfig::load().ok().and_then(|c| c.mode(&l.agent_id, &l.ability_slot, &l.mode).or_else(|| c.mode("*", &l.ability_slot, &l.mode))).map(|m| m.required_slots).unwrap_or_else(|| vec![Slot::Stand1, Slot::Aim1, Slot::Landing]); s.update_checklist(&l, &required, &[]); } }
    let _ = app.emit("lineuplab://overlay-changed", &*state.overlay.lock().unwrap()); Ok(())
}
#[tauri::command] pub fn overlay_action(app: tauri::AppHandle, state: State<AppState>, action: String) -> CmdResult<()> {
    let mut s = state.overlay.lock().unwrap();
    match action.as_str() { "overlay_toggle" => s.toggle_visible(), "overlay_controls" => s.controls(), "overlay_mode" => s.toggle_mode(), "view_next" => s.view_next(), "view_prev" => s.view_prev(), "view_flip" => s.flip(), "checklist_toggle" => s.show_checklist = !s.show_checklist, _ => {} }
    apply_overlay(&app, &s); let _ = app.emit("lineuplab://overlay-changed", &*s); Ok(())
}
