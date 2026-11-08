use crate::storage::hash_bytes;
use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ability {
    pub slot: String,
    pub display_name: String,
    pub display_icon: Option<String>,
    #[serde(default)]
    pub description: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Role {
    #[serde(default)]
    pub uuid: String,
    pub display_name: String,
    #[serde(default)]
    pub display_icon: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub uuid: String,
    pub display_name: String,
    pub display_icon: Option<String>,
    #[serde(default)]
    pub role: Option<Role>,
    #[serde(default)]
    pub abilities: Vec<Ability>,
    #[serde(default)]
    pub is_playable_character: bool,
    #[serde(default)]
    pub archived: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameMap {
    pub uuid: String,
    pub display_name: String,
    pub display_icon: Option<String>,
    pub splash: Option<String>,
    #[serde(default)]
    pub list_view_icon: Option<String>,
    #[serde(default)]
    pub archived: bool,
    /// Optional normalized map callouts for location-aware titles. Unknown or
    /// non-normalized upstream shapes are ignored rather than breaking catalog load.
    #[serde(default, deserialize_with = "deserialize_callouts")]
    pub callouts: Vec<MapCallout>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapCallout {
    pub name: String,
    pub x: f64,
    pub y: f64,
}
fn deserialize_callouts<'de, D>(d: D) -> std::result::Result<Vec<MapCallout>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let v = Value::deserialize(d)?;
    let mut out = vec![];
    if let Some(arr) = v.as_array() {
        for c in arr {
            let name = c
                .get("name")
                .or_else(|| c.get("regionName"))
                .or_else(|| c.get("superRegionName"))
                .and_then(Value::as_str);
            let loc = c.get("location").unwrap_or(c);
            let x = loc.get("x").and_then(Value::as_f64);
            let y = loc.get("y").and_then(Value::as_f64);
            if let (Some(name), Some(x), Some(y)) = (name, x, y) {
                if (0.0..=1.0).contains(&x) && (0.0..=1.0).contains(&y) {
                    out.push(MapCallout {
                        name: name.into(),
                        x,
                        y,
                    });
                }
            }
        }
    }
    Ok(out)
}
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub version: String,
    pub last_updated: Option<String>,
    pub agents: Vec<Agent>,
    pub maps: Vec<GameMap>,
    #[serde(default)]
    pub offline: bool,
    #[serde(default)]
    pub warning: Option<String>,
}
impl Catalog {
    pub fn archive_missing(&mut self, lineups: &[crate::Lineup]) {
        for l in lineups {
            if !self.maps.iter().any(|m| m.uuid == l.map_id) {
                self.maps.push(GameMap {
                    uuid: l.map_id.clone(),
                    display_name: format!("Archived map · {}", &l.map_id[..l.map_id.len().min(8)]),
                    display_icon: None,
                    splash: None,
                    list_view_icon: None,
                    callouts: vec![],
                    archived: true,
                });
            }
            if !self.agents.iter().any(|a| a.uuid == l.agent_id) {
                self.agents.push(Agent {
                    uuid: l.agent_id.clone(),
                    display_name: format!(
                        "Archived agent · {}",
                        &l.agent_id[..l.agent_id.len().min(8)]
                    ),
                    display_icon: None,
                    role: None,
                    abilities: vec![],
                    is_playable_character: true,
                    archived: true,
                });
            }
        }
    }
    pub fn is_archived(&self, l: &crate::Lineup) -> bool {
        !self
            .maps
            .iter()
            .any(|m| m.uuid == l.map_id && !m.archived && m.display_icon.is_some())
            || !self
                .agents
                .iter()
                .any(|a| a.uuid == l.agent_id && !a.archived)
    }
}
#[async_trait::async_trait]
pub trait HttpTransport: Send + Sync {
    async fn get(&self, url: &str) -> Result<Vec<u8>>;
}
pub struct ReqwestTransport {
    client: reqwest::Client,
}
impl Default for ReqwestTransport {
    fn default() -> Self {
        Self::new()
    }
}
impl ReqwestTransport {
    pub fn new() -> Self {
        crate::ensure_crypto_provider();
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(5))
            .user_agent(format!("LineupLab/{}", env!("CARGO_PKG_VERSION")))
            .build()
            .unwrap_or_default();
        Self { client }
    }
}
#[async_trait::async_trait]
impl HttpTransport for ReqwestTransport {
    async fn get(&self, url: &str) -> Result<Vec<u8>> {
        Ok(self
            .client
            .get(url)
            .send()
            .await?
            .error_for_status()?
            .bytes()
            .await?
            .to_vec())
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetProgress {
    pub phase: String,
    pub done: usize,
    pub total: usize,
    pub failed: usize,
    pub current: String,
    pub version: String,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetTypeReport {
    pub total: usize,
    pub cached: usize,
    pub missing: usize,
    pub invalid: usize,
    pub bytes: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetAudit {
    pub version: String,
    pub cache_bytes: u64,
    pub types: std::collections::BTreeMap<String, AssetTypeReport>,
    pub errors: Vec<String>,
}

/// Explicit TDM/practice identities; name-only filtering missed District.
pub fn is_standard_map(m: &GameMap) -> bool {
    const NON_STANDARD: &[&str] = &[
        "690b3ed2-4dff-945b-8223-6da834e30d24", // District
        "12452a9d-48c3-0b02-e7eb-0381c3520404", // Kasbah
        "de28aa9b-4cbe-1003-320e-6cb3ec309557", // Piazza
        "2c09d728-42d5-30d8-43dc-96a05cc7ee9d", // Drift
        "d6336a5a-428f-c591-98db-c8a291159134", // Glitch
        "ee613ee9-28b7-4beb-9666-08db13bb2244", // The Range
        "5914d1e0-40c4-cfdd-6b88-eba06347686c", // The Range (alt)
        "1f10dab3-4294-3827-fa35-c2aa00213cf3", // Basic Training
    ];
    if NON_STANDARD.contains(&m.uuid.to_lowercase().as_str()) {
        return false;
    }
    let n = m.display_name.to_lowercase();
    !matches!(
        n.as_str(),
        "district"
            | "kasbah"
            | "piazza"
            | "drift"
            | "glitch"
            | "the range"
            | "basic training"
            | "the practice range"
            | "practice range"
    ) && !n.contains("deathmatch")
        && !n.contains("tdm")
}

/// Bundled, normalized English callouts for location-aware titles. Upstream
/// callout locations are world coordinates; the bundled dataset is already
/// minimap-normalized. Existing normalized upstream callouts win.
pub fn bundled_callouts() -> std::collections::BTreeMap<String, Vec<MapCallout>> {
    #[derive(Deserialize)]
    struct Entry {
        callouts: Vec<MapCallout>,
    }
    #[derive(Deserialize)]
    struct File {
        maps: std::collections::BTreeMap<String, Entry>,
    }
    let raw = include_str!("../data/map_callouts.json");
    serde_json::from_str::<File>(raw)
        .map(|f| f.maps.into_iter().map(|(k, v)| (k, v.callouts)).collect())
        .unwrap_or_default()
}
pub fn merge_bundled_callouts(c: &mut Catalog) {
    let bundled = bundled_callouts();
    for m in &mut c.maps {
        if m.callouts.is_empty() {
            if let Some(cs) = bundled.get(&m.uuid) {
                m.callouts = cs.clone();
            }
        }
    }
}

pub fn asset_urls(c: &Catalog) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for a in &c.agents {
        if let Some(u) = &a.display_icon {
            out.push(("agent".into(), u.clone()));
        }
        if let Some(u) = a.role.as_ref().and_then(|r| r.display_icon.as_ref()) {
            out.push(("role".into(), u.clone()));
        }
        for b in &a.abilities {
            if let Some(u) = &b.display_icon {
                out.push(("ability".into(), u.clone()));
            }
        }
    }
    for m in &c.maps {
        if let Some(u) = &m.display_icon {
            out.push(("minimap".into(), u.clone()));
        }
        if let Some(u) = &m.list_view_icon {
            out.push(("map".into(), u.clone()));
        }
        if let Some(u) = &m.splash {
            out.push(("mapSplash".into(), u.clone()));
        }
    }
    out.sort();
    out.dedup();
    out
}
#[derive(Clone)]
pub struct ValorantApi {
    pub base_url: String,
    pub cache_dir: PathBuf,
    transport: Arc<dyn HttpTransport>,
}
#[derive(Deserialize)]
struct Envelope<T> {
    data: T,
}
impl ValorantApi {
    pub fn new(cache_dir: impl AsRef<Path>) -> Self {
        Self {
            base_url: "https://valorant-api.com/v1".into(),
            cache_dir: cache_dir.as_ref().into(),
            transport: Arc::new(ReqwestTransport::new()),
        }
    }
    pub fn with_transport(
        base_url: impl Into<String>,
        cache_dir: impl AsRef<Path>,
        transport: Arc<dyn HttpTransport>,
    ) -> Self {
        Self {
            base_url: base_url.into(),
            cache_dir: cache_dir.as_ref().into(),
            transport,
        }
    }
    async fn fetch(&self, path: &str) -> Result<Vec<u8>> {
        let url = if path.starts_with("https://") || path.starts_with("http://") {
            path.to_string()
        } else {
            format!("{}/{}", self.base_url.trim_end_matches('/'), path)
        };
        let mut attempt = 0;
        loop {
            match self.transport.get(&url).await {
                Ok(bytes) => return Ok(bytes),
                Err(e)
                    if attempt < 2
                        && (matches!(&e, Error::Io(_))
                            || matches!(&e,Error::Network(n) if n.is_timeout() || n.is_connect() || n.status().is_some_and(|s| s.as_u16()==429 || s.is_server_error()))) =>
                {
                    tokio::time::sleep(Duration::from_millis(150 * (1 << attempt))).await;
                    attempt += 1;
                }
                Err(e) => return Err(e),
            }
        }
    }
    fn read_cache<T: serde::de::DeserializeOwned>(&self, name: &str) -> Result<Option<T>> {
        let p = self.cache_dir.join(name);
        if !p.exists() {
            return Ok(None);
        }
        Ok(Some(serde_json::from_slice(&std::fs::read(p)?)?))
    }
    fn write_cache(&self, name: &str, bytes: &[u8]) -> Result<()> {
        std::fs::create_dir_all(&self.cache_dir)?;
        let tmp = self
            .cache_dir
            .join(format!("{name}.{}.tmp", uuid::Uuid::new_v4()));
        if let Some(parent) = tmp.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&tmp, bytes)?;
        std::fs::rename(tmp, self.cache_dir.join(name))?;
        Ok(())
    }
    pub fn cached_catalog(&self) -> Result<Option<Catalog>> {
        self.read_cache("catalog.json")
    }
    pub async fn refresh(&self, force: bool) -> Result<Catalog> {
        self.refresh_with_progress(force, |_| {}).await
    }
    pub async fn refresh_with_progress<F>(&self, force: bool, progress: F) -> Result<Catalog>
    where
        F: Fn(AssetProgress),
    {
        let previous: Catalog = self.read_cache("catalog.json")?.unwrap_or_default();
        let result = async {
            let version: Envelope<Value> = serde_json::from_slice(&self.fetch("version").await?)?;
            let version = version.data.get("version").and_then(Value::as_str).unwrap_or("unknown").to_string();
            let mut next = if force || version != previous.version || previous.agents.is_empty() {
                let agents: Envelope<Vec<Agent>> = serde_json::from_slice(&self.fetch("agents?isPlayableCharacter=true").await?)?;
                let maps: Envelope<Vec<GameMap>> = serde_json::from_slice(&self.fetch("maps").await?)?;
                Catalog { version: version.clone(), last_updated: Some(crate::now()), agents: agents.data.into_iter().filter(|a| a.is_playable_character).collect(), maps: maps.data.into_iter().filter(|m| m.display_icon.is_some() && is_standard_map(m)).collect(), offline: false, warning: None }
            } else { previous.clone() };
            merge_bundled_callouts(&mut next);
            let assets = asset_urls(&next);
            let total = assets.len();
            let mut done = 0; let mut failed = 0;
            let mut pending = Vec::new();
            for (kind, url) in assets {
                if self.image_path(&url)?.exists() { done += 1; } else { pending.push((kind, url)); }
            }
            progress(AssetProgress { phase: "downloading".into(), done, total, failed, current: String::new(), version: version.clone() });
            let mut pending = pending.into_iter();
            let mut tasks = tokio::task::JoinSet::new();
            loop {
                while tasks.len() < 6 {
                    let Some((kind, url)) = pending.next() else { break };
                    let api = self.clone();
                    tasks.spawn(async move { let result = api.download_image(&url).await; (kind, url, result) });
                }
                let Some(joined) = tasks.join_next().await else { break };
                done += 1;
                let current = match joined {
                    Ok((kind, url, Ok(_))) => format!("{kind}: {url}"),
                    Ok((kind, url, Err(e))) => { failed += 1; tracing::warn!(error=%e, kind=%kind, url=%url, "Art download failed; cached art remains available"); format!("{kind}: {url}") }
                    Err(e) => { failed += 1; tracing::warn!(error=%e, "Art download task failed"); String::new() }
                };
                progress(AssetProgress { phase: "downloading".into(), done, total, failed, current, version: version.clone() });
            }
            if failed > 0 { next.warning = Some(format!("{failed} artwork downloads failed. Cached images remain available; retry from Settings → Data.")); }
            self.write_cache("catalog.json", &serde_json::to_vec(&next)?)?;
            progress(AssetProgress { phase: "ready".into(), done: total, total, failed, current: String::new(), version });
            Ok::<_, Error>(next)
        }.await;
        match result {
            Ok(c) => Ok(c),
            Err(e) => {
                tracing::warn!(error=%e, "Catalog refresh failed");
                if !previous.agents.is_empty() {
                    let mut c = previous;
                    merge_bundled_callouts(&mut c);
                    c.offline = true;
                    c.warning = Some(format!("Using cached data: {e}"));
                    progress(AssetProgress {
                        phase: "offline".into(),
                        done: 0,
                        total: 0,
                        failed: 0,
                        current: String::new(),
                        version: c.version.clone(),
                    });
                    Ok(c)
                } else {
                    progress(AssetProgress {
                        phase: "offline".into(),
                        done: 0,
                        total: 0,
                        failed: 1,
                        current: String::new(),
                        version: String::new(),
                    });
                    Ok(Catalog { offline: true, warning: Some(format!("No cached art yet. Connect to the internet or sync with a desktop: {e}")), ..Default::default() })
                }
            }
        }
    }
    pub async fn download_image(&self, url: &str) -> Result<PathBuf> {
        let path = self.image_path(url)?;
        if path.exists() {
            return Ok(path);
        }
        let bytes = self.fetch(url).await?;
        // Reject HTML/error payloads before they enter the image cache.
        let format = image::guess_format(&bytes)
            .map_err(|e| Error::Invalid(format!("Downloaded art is not a supported image: {e}")))?;
        if !matches!(
            format,
            image::ImageFormat::Png
                | image::ImageFormat::Jpeg
                | image::ImageFormat::WebP
                | image::ImageFormat::Gif
                | image::ImageFormat::Avif
        ) {
            return Err(Error::Invalid(format!(
                "Unsupported art format: {format:?}"
            )));
        }
        self.write_cache(&format!("art/{}.img", hash_bytes(url.as_bytes())), &bytes)?;
        Ok(path)
    }
    pub fn audit_assets(&self, c: &Catalog) -> Result<AssetAudit> {
        let mut types = std::collections::BTreeMap::new();
        let mut errors = Vec::new();
        let mut cache_bytes = 0;
        for (kind, url) in asset_urls(c) {
            let entry = types
                .entry(kind.clone())
                .or_insert_with(AssetTypeReport::default);
            entry.total += 1;
            let path = self.image_path(&url)?;
            if !path.exists() {
                entry.missing += 1;
                errors.push(format!("Missing {kind}: {url}"));
                continue;
            }
            let len = std::fs::metadata(&path)?.len();
            entry.bytes += len;
            cache_bytes += len;
            let valid = std::fs::read(&path)
                .map_err(Error::from)
                .and_then(|bytes| image::guess_format(&bytes).map_err(Error::from));
            match valid {
                Ok(_) => entry.cached += 1,
                Err(e) => {
                    entry.invalid += 1;
                    errors.push(format!("Invalid {kind} cache file: {e}"));
                }
            }
        }
        Ok(AssetAudit {
            version: c.version.clone(),
            cache_bytes,
            types,
            errors,
        })
    }
    pub fn image_path(&self, url: &str) -> Result<PathBuf> {
        Ok(self
            .cache_dir
            .join("art")
            .join(format!("{}.img", hash_bytes(url.as_bytes()))))
    }
    pub fn image_for_url(&self, url: Option<&str>) -> Option<Vec<u8>> {
        std::fs::read(self.image_path(url?).ok()?).ok()
    }
}
