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
pub struct Agent {
    pub uuid: String,
    pub display_name: String,
    pub display_icon: Option<String>,
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
    pub archived: bool,
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
    pub async fn refresh(&self, force: bool) -> Result<Catalog> {
        let previous: self::Catalog = self.read_cache("catalog.json")?.unwrap_or_default();
        let result=async {
            let version:Envelope<Value>=serde_json::from_slice(&self.fetch("version").await?)?;
            let version=version.data.get("version").and_then(Value::as_str).unwrap_or("unknown").to_string();
            let mut next=if force || version!=previous.version || previous.agents.is_empty() {
                let agents:Envelope<Vec<Agent>>=serde_json::from_slice(&self.fetch("agents?isPlayableCharacter=true").await?)?;
                let maps:Envelope<Vec<GameMap>>=serde_json::from_slice(&self.fetch("maps").await?)?;
                Catalog { version:version.clone(),last_updated:Some(crate::now()),agents:agents.data.into_iter().filter(|a| a.is_playable_character).collect(),maps:maps.data.into_iter().filter(|m| m.display_icon.is_some() && !matches!(m.display_name.to_lowercase().as_str(),"the range"|"basic training"|"the practice range")).collect(),offline:false,warning:None }
            } else { previous.clone() };
            // URL-addressed image cache: changed URLs naturally produce a different key; old files remain usable offline.
            for url in next.agents.iter().flat_map(|a| std::iter::once(a.display_icon.as_ref()).chain(a.abilities.iter().map(|b| b.display_icon.as_ref()))).chain(next.maps.iter().flat_map(|m| [m.display_icon.as_ref(),m.splash.as_ref()])).flatten().collect::<Vec<_>>() {
                if self.image_path(url)?.exists(){continue;}
                match self.fetch(url).await { Ok(bytes)=>self.write_cache(&format!("art/{}.img",hash_bytes(url.as_bytes())),&bytes)?,Err(e)=>{tracing::warn!(error=%e,"Art download failed; cached art remains available"); next.warning=Some("Some artwork is unavailable. Refresh when online.".into());} }
            }
            self.write_cache("catalog.json",&serde_json::to_vec(&next)?)?; Ok::<_,Error>(next)
        }.await;
        match result {
            Ok(c) => Ok(c),
            Err(e) => {
                tracing::warn!(error=%e,"Catalog refresh failed");
                if !previous.agents.is_empty() {
                    let mut c = previous;
                    c.offline = true;
                    c.warning = Some(format!("Using cached data: {e}"));
                    Ok(c)
                } else {
                    Ok(Catalog { offline:true,warning:Some(format!("No cached art yet. Connect to the internet or sync with a desktop: {e}")),..Default::default() })
                }
            }
        }
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
