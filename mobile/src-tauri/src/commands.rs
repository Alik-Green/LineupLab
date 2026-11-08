use crate::MobileState;
use lineuplab_core::{config::ModeConfig, Lineup, LineupFilter, SLOT_ORDER};
use serde_json::{json, Map, Value};
use std::collections::BTreeSet;
use tauri::{Emitter, Manager, State};
type CmdResult<T> = Result<T, String>;
fn err(e: impl std::fmt::Display) -> String { e.to_string() }
fn to_ui(l: &Lineup) -> Value {
    let mut v = serde_json::to_value(l).unwrap_or(json!({}));
    if let Some(o) = v.as_object_mut() {
        if let Some(x) = o.remove("mapId") { o.insert("mapUuid".into(), x); }
        if let Some(x) = o.remove("agentId") { o.insert("agentUuid".into(), x); }
        if let Some(video) = o.remove("video") { o.insert("videoClip".into(), video.get("clip").cloned().unwrap_or(Value::Null)); o.insert("videoThumbnail".into(), video.get("thumbnail").cloned().unwrap_or(Value::Null)); }
        let pins = o.get("extensions").and_then(|e| e.get("aimPins")).cloned().unwrap_or(json!({}));
        o.insert("aim1Pos".into(), pins.get("aim1").cloned().unwrap_or(Value::Null)); o.insert("aim2Pos".into(), pins.get("aim2").cloned().unwrap_or(Value::Null));
        if let Some(slots) = o.get_mut("slots").and_then(Value::as_object_mut) { for s in SLOT_ORDER { slots.entry(s.as_str().to_string()).or_insert_with(|| json!({"image":null,"circles":[],"lines":[]})); } }
    }
    v
}
#[tauri::command] pub fn list_lineups(state: State<MobileState>) -> CmdResult<Vec<Value>> { Ok(state.db.lock().unwrap().filter(&LineupFilter { include_deleted: Some(false), include_drafts: Some(true), ..Default::default() }).map_err(err)?.iter().map(to_ui).collect()) }
#[tauri::command] pub fn get_lineup(state: State<MobileState>, id: String) -> CmdResult<Option<Value>> { Ok(state.db.lock().unwrap().get(&id).map_err(err)?.as_ref().map(to_ui)) }
fn remote_url(url: Option<&str>) -> Value { match url { Some(u) => json!(u), None => Value::Null } }
fn catalog_json(api: &lineuplab_core::catalog::ValorantApi, c: &lineuplab_core::catalog::Catalog, lineups: &[Lineup]) -> Value {
    let mut c = c.clone(); c.archive_missing(lineups);
    let agents: Vec<Value> = c.agents.iter().map(|a| json!({"uuid":a.uuid,"displayName":a.display_name,"displayIcon":remote_url(a.display_icon.as_deref()),"role":a.role.as_ref().map(|r| r.display_name.clone()),"roleIcon":a.role.as_ref().and_then(|r| r.display_icon.as_deref()).map(|u| json!(u)).unwrap_or(Value::Null),"isArchived":a.archived,"abilities":a.abilities.iter().map(|b| json!({"slot":b.slot,"displayName":b.display_name,"displayIcon":remote_url(b.display_icon.as_deref()),"description":b.description})).collect::<Vec<_>>()})).collect();
    let maps: Vec<Value> = c.maps.iter().map(|m| json!({"uuid":m.uuid,"displayName":m.display_name,"displayIcon":remote_url(m.display_icon.as_deref()),"listViewIcon":remote_url(m.list_view_icon.as_deref()),"splash":remote_url(m.splash.as_deref()),"isArchived":m.archived,"callouts":m.callouts})).collect();
    json!({"agents":agents,"maps":maps,"version":c.version,"updatedAt":c.last_updated.clone().unwrap_or_else(lineuplab_core::now),"stale":c.offline,"warning":c.warning})
}
#[tauri::command] pub async fn get_catalog(app: tauri::AppHandle) -> CmdResult<Value> {
    let state = app.state::<MobileState>(); let lineups = state.db.lock().unwrap().all(false).map_err(err)?; let api = state.api.clone(); drop(state);
    let c = api.cached_catalog().map_err(err)?.unwrap_or_default();
    Ok(catalog_json(&api, &c, &lineups))
}
#[tauri::command] pub async fn prepare_assets(app: tauri::AppHandle, force: bool) -> CmdResult<Value> {
    let state = app.state::<MobileState>(); let lineups = state.db.lock().unwrap().all(false).map_err(err)?; let api = state.api.clone(); drop(state);
    let emitter = app.clone();
    let c = api.refresh_with_progress(force, move |p| { let _ = emitter.emit("lineuplab://assets", p); }).await.map_err(err)?;
    Ok(catalog_json(&api, &c, &lineups))
}
#[tauri::command] pub fn catalog_image_url(state: State<MobileState>, url: String) -> CmdResult<String> { let p = state.api.image_path(&url).map_err(err)?; if p.exists() { return Ok(p.to_string_lossy().into_owned()); } Ok(url) }
#[tauri::command] pub async fn asset_diagnostics(app: tauri::AppHandle) -> CmdResult<Value> {
    let state = app.state::<MobileState>(); let api = state.api.clone(); let data_dir = state.data_dir.clone(); drop(state);
    let c = api.cached_catalog().map_err(err)?.unwrap_or_default(); let audit = api.audit_assets(&c).map_err(err)?;
    Ok(json!({"audit":audit,"dataDir":data_dir.to_string_lossy(),"cacheDir":data_dir.join("art-cache").to_string_lossy(),"assetProtocol":{"enabled":true,"scope":["$APPDATA/**","$APPLOCALDATA/**","$APPCACHE/**","$APPCONFIG/**","$RESOURCE/**"]},"platform":"android"}))
}
#[tauri::command] pub fn log_image_error(url: String, message: String) { tracing::warn!(url=%url,error=%message,"UI image load failed"); }
#[tauri::command] pub fn get_modes() -> CmdResult<Vec<Value>> { let cfg = ModeConfig::load().map_err(err)?; let mut seen = BTreeSet::new(); let mut out = vec![]; for m in cfg.defaults.iter().chain(cfg.rules.iter().flat_map(|r| &r.modes)) { if !seen.insert(m.id.clone()) { continue; } let attrs: Map<String, Value> = m.attributes.iter().map(|(k, v)| { let ty = if v.is_boolean() { "boolean" } else if v.is_number() { "number" } else { "string" }; (k.clone(), json!({"type":ty,"default":v})) }).collect(); out.push(json!({"id":m.id,"label":m.label,"requiredSlots":m.required_slots,"optionalSlots":m.optional_slots,"attributes":attrs})); } Ok(out) }
#[tauri::command] pub fn media_path(state: State<MobileState>, hash: String) -> CmdResult<String> { let p = std::path::Path::new(&hash); if p.is_absolute() && p.starts_with(&state.data_dir) && p.exists() { return Ok(p.to_string_lossy().into_owned()); } Ok(state.store.path(&hash).map_err(err)?.to_string_lossy().into_owned()) }
#[tauri::command] pub async fn pair_sync(base_url: String, code: String, device_name: String) -> CmdResult<Value> { let p = lineuplab_core::sync::SyncClient::pair(&base_url, &code, &device_name).await.map_err(err)?; Ok(serde_json::to_value(p).map_err(err)?) }
#[tauri::command] pub async fn sync_now(app: tauri::AppHandle, base_url: String, token: String) -> CmdResult<Value> {
    let state = app.state::<MobileState>(); let data_dir = state.data_dir.clone(); let store = state.store.clone(); drop(state);
    let (tx, rx) = tokio::sync::oneshot::channel();
    std::thread::spawn(move || {
        let result = (|| -> lineuplab_core::Result<lineuplab_core::sync::SyncReport> {
            let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().map_err(|e| lineuplab_core::Error::Invalid(e.to_string()))?;
            rt.block_on(async move {
                let client = lineuplab_core::sync::SyncClient::new(base_url, token);
                let mut db = lineuplab_core::db::Database::open(data_dir.join("lineuplab.sqlite3"))?;
                // Browse-only companion pulls; it never pushes local edits.
                lineuplab_core::sync::pull(&client, &mut db, &store, None).await
            })
        })();
        let _ = tx.send(result);
    });
    let report = rx.await.map_err(|e| e.to_string())?.map_err(err)?;
    Ok(serde_json::to_value(report).map_err(err)?)
}
#[tauri::command] pub async fn download_library(app: tauri::AppHandle, base_url: String, token: String) -> CmdResult<Value> {
    let state = app.state::<MobileState>(); let data_dir = state.data_dir.clone(); let store = state.store.clone(); let api = state.api.clone(); drop(state);
    let emitter = app.clone();
    let (tx, rx) = tokio::sync::oneshot::channel();
    std::thread::spawn(move || {
        let result = (|| -> lineuplab_core::Result<lineuplab_core::sync::DownloadReport> {
            let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().map_err(|e| lineuplab_core::Error::Invalid(e.to_string()))?;
            rt.block_on(async move {
                let client = lineuplab_core::sync::SyncClient::new(base_url, token);
                let mut db = lineuplab_core::db::Database::open(data_dir.join("lineuplab.sqlite3"))?;
                let report = lineuplab_core::sync::download_library(&client, &mut db, &store, |p| { let _ = emitter.emit("lineuplab://download-progress", p); }).await?;
                // Names/art URLs must not depend on the phone reaching valorant-api.com.
                // A failed optional catalog fetch never hides an already saved library.
                match tokio::time::timeout(std::time::Duration::from_secs(8), client.catalog()).await {
                    Ok(Ok(mut remote)) => { if let Ok(all) = db.all(false) { remote.archive_missing(&all); } let _ = api.save_catalog(&remote); }
                    Ok(Err(e)) => tracing::warn!(error=%e, "Desktop catalog unavailable; keeping local catalog"),
                    Err(_) => tracing::warn!("Desktop catalog timed out; keeping local catalog"),
                }
                Ok(report)
            })
        })(); let _ = tx.send(result);
    });
    let report = rx.await.map_err(|e| e.to_string())?.map_err(err)?;
    let _ = app.emit("lineuplab://library-changed", serde_json::json!({"downloaded": report.downloaded, "existing": report.existing}));
    Ok(serde_json::to_value(report).map_err(err)?)
}
#[tauri::command] pub async fn discover_sync() -> CmdResult<Vec<lineuplab_core::sync::DiscoveredServer>> { lineuplab_core::sync::discover(std::time::Duration::from_millis(1500)).await.map_err(err) }
#[tauri::command] pub fn get_sync_settings(state: State<MobileState>) -> CmdResult<Value> { Ok(state.db.lock().unwrap().metadata("sync").map_err(err)?.unwrap_or(json!({}))) }
#[tauri::command] pub fn set_sync_settings(state: State<MobileState>, settings: Value) -> CmdResult<()> { state.db.lock().unwrap().set_metadata("sync", &settings).map_err(err) }
