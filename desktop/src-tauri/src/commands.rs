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

fn remote_or_cached(_api: &lineuplab_core::catalog::ValorantApi, url: Option<&str>) -> Value {
    // Catalog DTOs keep stable remote URLs. The shared image layer asks
    // catalog_image_url for a cache hit and converts absolute paths itself.
    match url { Some(u) => json!(u), None => Value::Null }
}
fn catalog_json(app: &tauri::AppHandle, api: &lineuplab_core::catalog::ValorantApi, c: &lineuplab_core::catalog::Catalog, lineups: &[Lineup]) -> Value {
    let mut c = c.clone(); c.archive_missing(lineups);
    let agents: Vec<Value> = c.agents.iter().map(|a| json!({
        "uuid": a.uuid, "displayName": a.display_name,
        "displayIcon": remote_or_cached(api, a.display_icon.as_deref()),
        "role": a.role.as_ref().map(|r| r.display_name.clone()),
        "roleIcon": a.role.as_ref().map(|r| remote_or_cached(api, r.display_icon.as_deref())).unwrap_or(Value::Null),
        "isArchived": a.archived,
        "abilities": a.abilities.iter().map(|b| json!({"slot": b.slot, "displayName": b.display_name, "displayIcon": remote_or_cached(api, b.display_icon.as_deref()), "description": b.description})).collect::<Vec<_>>()
    })).collect();
    let maps: Vec<Value> = c.maps.iter().map(|m| json!({
        "uuid": m.uuid, "displayName": m.display_name,
        "displayIcon": remote_or_cached(api, m.display_icon.as_deref()),
        "listViewIcon": remote_or_cached(api, m.list_view_icon.as_deref()),
        "splash": remote_or_cached(api, m.splash.as_deref()),
        "isArchived": m.archived
    })).collect();
    json!({"agents": agents, "maps": maps, "version": c.version, "updatedAt": c.last_updated.clone().unwrap_or_else(lineuplab_core::now), "stale": c.offline, "warning": c.warning, "dataDir": app.state::<AppState>().data_dir.to_string_lossy()})
}
#[tauri::command] pub async fn get_catalog(app: tauri::AppHandle) -> CmdResult<Value> {
    let state = app.state::<AppState>();
    let lineups = state.db.lock().unwrap().all(false).map_err(err)?;
    let api = state.api.clone(); drop(state);
    let c = match api.cached_catalog().map_err(err)? { Some(c) => c, None => api.refresh(false).await.map_err(err)? };
    Ok(catalog_json(&app, &api, &c, &lineups))
}
#[tauri::command] pub async fn prepare_assets(app: tauri::AppHandle, force: bool) -> CmdResult<Value> {
    let state = app.state::<AppState>();
    let lineups = state.db.lock().unwrap().all(false).map_err(err)?;
    let api = state.api.clone(); drop(state);
    let emitter = app.clone();
    let c = api.refresh_with_progress(force, move |p| { let _ = emitter.emit("lineuplab://assets", p); }).await.map_err(err)?;
    Ok(catalog_json(&app, &api, &c, &lineups))
}
#[tauri::command] pub fn catalog_image_url(state: State<AppState>, url: String) -> CmdResult<String> {
    let p = state.api.image_path(&url).map_err(err)?;
    if p.exists() { return Ok(p.to_string_lossy().into_owned()); }
    Ok(url)
}
#[tauri::command] pub async fn asset_diagnostics(app: tauri::AppHandle) -> CmdResult<Value> {
    let state = app.state::<AppState>(); let api = state.api.clone(); let data_dir = state.data_dir.clone(); drop(state);
    let c = api.cached_catalog().map_err(err)?.unwrap_or_default();
    let audit = api.audit_assets(&c).map_err(err)?;
    Ok(json!({"audit": audit, "dataDir": data_dir.to_string_lossy(), "cacheDir": data_dir.join("art-cache").to_string_lossy(), "assetProtocol": {"enabled": true, "scope": ["$APPDATA/**", "$APPLOCALDATA/**", "$APPCACHE/**", "$APPCONFIG/**", "$RESOURCE/**"]}, "platform": std::env::consts::OS}))
}
#[tauri::command] pub fn log_image_error(url: String, message: String) { tracing::warn!(url=%url, error=%message, "UI image load failed"); }
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
#[tauri::command] pub fn media_path(state: State<AppState>, hash: String) -> CmdResult<String> {
    let p = std::path::Path::new(&hash);
    if p.is_absolute() && p.starts_with(&state.data_dir) && p.exists() { return Ok(p.to_string_lossy().into_owned()); }
    Ok(state.store.path(&hash).map_err(err)?.to_string_lossy().into_owned())
}
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
#[tauri::command] pub fn get_hotkeys(state: State<AppState>) -> CmdResult<Vec<Value>> { Ok(state.hotkeys.lock().unwrap().bindings.iter().map(|b| json!(b)).collect()) }
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

// ---- LAN sync (opt-in) ----
#[tauri::command] pub async fn start_sync_server(app: tauri::AppHandle, name: Option<String>) -> CmdResult<Value> {
    let config = {
        let state = app.state::<AppState>();
        if let Some(h) = state.sync_server.lock().unwrap().as_ref() { return Ok(json!({"running":true,"address":h.addr.to_string(),"pairingCode":h.pairing_code})); }
        let data_dir = state.data_dir.clone();
        drop(state);
        lineuplab_core::server::ServerConfig { data_dir, name: name.unwrap_or_else(|| "LineupLab Desktop".into()), ..Default::default() }
    };
    let h = lineuplab_core::server::spawn(config).await.map_err(err)?;
    let out = json!({"running":true,"address":h.addr.to_string(),"pairingCode":h.pairing_code});
    *app.state::<AppState>().sync_server.lock().unwrap() = Some(h); Ok(out)
}
#[tauri::command] pub async fn stop_sync_server(app: tauri::AppHandle) -> CmdResult<()> { let h = app.state::<AppState>().sync_server.lock().unwrap().take(); if let Some(h) = h { h.shutdown().await.map_err(err)?; } Ok(()) }
#[tauri::command] pub fn get_sync_server_status(state: State<AppState>) -> CmdResult<Value> { let g = state.sync_server.lock().unwrap(); Ok(match g.as_ref() { Some(h) => json!({"running":true,"address":h.addr.to_string(),"pairingCode":h.pairing_code}), None => json!({"running":false}) }) }
#[tauri::command] pub async fn pair_sync(base_url: String, code: String, device_name: String) -> CmdResult<Value> { let p = lineuplab_core::sync::SyncClient::pair(&base_url, &code, &device_name).await.map_err(err)?; Ok(serde_json::to_value(p).map_err(err)?) }
#[tauri::command] pub async fn sync_now(app: tauri::AppHandle, base_url: String, token: String) -> CmdResult<Value> {
    let state = app.state::<AppState>();
    let data_dir = state.data_dir.clone(); let store = state.store.clone(); let device_id = state.device_id.clone();
    drop(state);
    // SQLite connections are not Sync; run the sync future on a dedicated current-thread runtime
    // so no database reference is held across await inside the Tauri (Send) command future.
    let (tx, rx) = tokio::sync::oneshot::channel();
    std::thread::spawn(move || {
        let result = (|| -> lineuplab_core::Result<lineuplab_core::sync::SyncReport> {
            let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().map_err(|e| lineuplab_core::Error::Invalid(e.to_string()))?;
            rt.block_on(async move {
                let client = lineuplab_core::sync::SyncClient::new(base_url, token);
                let mut db = lineuplab_core::db::Database::open(data_dir.join("lineuplab.sqlite3"))?;
                lineuplab_core::sync::sync_both(&client, &mut db, &store, &device_id, None).await
            })
        })();
        let _ = tx.send(result);
    });
    let report = rx.await.map_err(|e| e.to_string())?.map_err(err)?;
    Ok(serde_json::to_value(report).map_err(err)?)
}
#[tauri::command] pub fn discover_sync() -> CmdResult<Vec<lineuplab_core::sync::DiscoveredServer>> { lineuplab_core::sync::discover(std::time::Duration::from_millis(1500)).map_err(err) }
