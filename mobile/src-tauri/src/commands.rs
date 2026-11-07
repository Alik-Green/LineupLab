use crate::MobileState;
use lineuplab_core::{config::ModeConfig, Lineup, SLOT_ORDER};
use serde_json::{json, Map, Value};
use std::collections::BTreeSet;
use tauri::{Manager, State};
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
#[tauri::command] pub fn list_lineups(state: State<MobileState>) -> CmdResult<Vec<Value>> { Ok(state.db.lock().unwrap().all(false).map_err(err)?.iter().map(to_ui).collect()) }
#[tauri::command] pub fn get_lineup(state: State<MobileState>, id: String) -> CmdResult<Option<Value>> { Ok(state.db.lock().unwrap().get(&id).map_err(err)?.as_ref().map(to_ui)) }
fn icon_url(app: &tauri::AppHandle, api: &lineuplab_core::catalog::ValorantApi, url: Option<&str>) -> Value { match url { Some(u) => { if let Ok(p) = api.image_path(u) { if p.exists() { if let Ok(asset) = app.path().convert_file_src(&p) { return json!(asset.to_string()); } } } json!(u) }, None => Value::Null } }
#[tauri::command] pub async fn get_catalog(app: tauri::AppHandle, state: State<'_, MobileState>) -> CmdResult<Value> {
    let lineups = state.db.lock().unwrap().all(false).map_err(err)?; let mut c = state.api.refresh(false).await.map_err(err)?; c.archive_missing(&lineups);
    let agents: Vec<Value> = c.agents.iter().map(|a| json!({"uuid":a.uuid,"displayName":a.display_name,"displayIcon":icon_url(&app,&state.api,a.display_icon.as_deref()),"isArchived":a.archived})).collect();
    let maps: Vec<Value> = c.maps.iter().map(|m| json!({"uuid":m.uuid,"displayName":m.display_name,"displayIcon":icon_url(&app,&state.api,m.display_icon.as_deref()),"isArchived":m.archived})).collect();
    Ok(json!({"agents":agents,"maps":maps,"version":c.version,"updatedAt":c.last_updated.unwrap_or_else(lineuplab_core::now),"stale":c.offline,"warning":c.warning}))
}
#[tauri::command] pub fn get_modes() -> CmdResult<Vec<Value>> { let cfg = ModeConfig::load().map_err(err)?; let mut seen = BTreeSet::new(); let mut out = vec![]; for m in cfg.defaults.iter().chain(cfg.rules.iter().flat_map(|r| &r.modes)) { if !seen.insert(m.id.clone()) { continue; } let attrs: Map<String, Value> = m.attributes.iter().map(|(k, v)| { let ty = if v.is_boolean() { "boolean" } else if v.is_number() { "number" } else { "string" }; (k.clone(), json!({"type":ty,"default":v})) }).collect(); out.push(json!({"id":m.id,"label":m.label,"requiredSlots":m.required_slots,"optionalSlots":m.optional_slots,"attributes":attrs})); } Ok(out) }
#[tauri::command] pub fn media_path(state: State<MobileState>, hash: String) -> CmdResult<String> { Ok(state.store.path(&hash).map_err(err)?.to_string_lossy().into_owned()) }
#[tauri::command] pub async fn pair_sync(base_url: String, code: String, device_name: String) -> CmdResult<Value> { let p = lineuplab_core::sync::SyncClient::pair(&base_url, &code, &device_name).await.map_err(err)?; Ok(serde_json::to_value(p).map_err(err)?) }
#[tauri::command] pub async fn sync_now(state: State<'_, MobileState>, base_url: String, token: String) -> CmdResult<Value> {
    let client = lineuplab_core::sync::SyncClient::new(base_url, token);
    let mut db = lineuplab_core::db::Database::open(state.data_dir.join("lineuplab.sqlite3")).map_err(err)?;
    // Browse-only companion pulls; it never pushes local edits.
    let report = lineuplab_core::sync::pull(&client, &mut db, &state.store, None).await.map_err(err)?;
    Ok(serde_json::to_value(report).map_err(err)?)
}
#[tauri::command] pub fn discover_sync() -> CmdResult<Vec<lineuplab_core::sync::DiscoveredServer>> { lineuplab_core::sync::discover(std::time::Duration::from_millis(1500)).map_err(err) }
#[tauri::command] pub fn get_sync_settings(state: State<MobileState>) -> CmdResult<Value> { Ok(state.db.lock().unwrap().metadata("sync").map_err(err)?.unwrap_or(json!({}))) }
#[tauri::command] pub fn set_sync_settings(state: State<MobileState>, settings: Value) -> CmdResult<()> { state.db.lock().unwrap().set_metadata("sync", &settings).map_err(err) }
