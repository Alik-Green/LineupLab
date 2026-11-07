//! Deterministic last-writer-wins merge. The transport is added in the LAN milestone.
use crate::{storage::valid_hash, Error, Lineup, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
pub const PROTOCOL_VERSION: u32 = 1;

pub fn timestamp(s: &str) -> Option<i64> {
    time::OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339)
        .ok()
        .map(|t| t.unix_timestamp_nanos() as i64)
}
/// Invalid timestamps sort before valid ones; revision and deviceId still break ties deterministically.
pub fn is_newer(incoming: &Lineup, local: &Lineup) -> bool {
    match (
        timestamp(&incoming.updated_at),
        timestamp(&local.updated_at),
    ) {
        (Some(a), Some(b)) if a != b => a > b,
        (Some(_), None) => true,
        (None, Some(_)) => false,
        _ => (incoming.revision, &incoming.device_id) > (local.revision, &local.device_id),
    }
}
pub fn pack_is_newer(incoming: &Lineup, local: &Lineup) -> bool {
    is_newer(incoming, local)
}
pub fn merge(local: Option<&Lineup>, incoming: &Lineup) -> bool {
    local.map_or(true, |old| is_newer(incoming, old))
}
pub fn missing_hashes(lineups: &[Lineup], has: impl Fn(&str) -> bool) -> Vec<String> {
    let mut set = BTreeSet::new();
    for l in lineups {
        for h in l.image_hashes() {
            if valid_hash(&h) && !has(&h) {
                set.insert(h);
            }
        }
    }
    set.into_iter().collect()
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestEntry {
    pub id: String,
    pub updated_at: String,
    pub revision: u64,
    pub device_id: String,
    pub deleted: bool,
}
impl From<&Lineup> for ManifestEntry {
    fn from(l: &Lineup) -> Self {
        Self {
            id: l.id.clone(),
            updated_at: l.updated_at.clone(),
            revision: l.revision,
            device_id: l.device_id.clone(),
            deleted: l.deleted,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncManifest {
    pub protocol_version: u32,
    pub device_id: String,
    pub cursor: String,
    pub entries: Vec<ManifestEntry>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushRequest {
    pub device_id: String,
    pub lineups: Vec<Lineup>,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushResponse {
    pub accepted: Vec<String>,
    pub conflicts: Vec<String>,
    pub cursor: String,
}
pub fn manifest(lineups: &[Lineup], device_id: &str, since: Option<&str>) -> Result<SyncManifest> {
    let entries = lineups
        .iter()
        .filter(|l| since.map_or(true, |s| l.updated_at.as_str() > s))
        .map(ManifestEntry::from)
        .collect();
    let cursor = lineups
        .iter()
        .map(|l| l.updated_at.clone())
        .max()
        .unwrap_or_default();
    Ok(SyncManifest {
        protocol_version: PROTOCOL_VERSION,
        device_id: device_id.into(),
        cursor,
        entries,
    })
}

/// Authenticated LAN client. Plain HTTP is the documented alternative to pinned HTTPS (docs/SYNC.md).
#[derive(Clone)]
pub struct SyncClient {
    pub base_url: String,
    pub token: String,
    http: reqwest::Client,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairResponse {
    pub token: String,
    pub server_name: String,
    pub device_id: String,
    pub protocol_version: u32,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    pub pulled: usize,
    pub pushed: usize,
    pub images: usize,
    pub conflicts: usize,
}
impl SyncClient {
    pub fn new(base_url: impl Into<String>, token: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
            token: token.into(),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
        }
    }
    /// Open, explicitly started LAN sharing: no code entry. Older/code-protected
    /// servers still use `pair`; this never bypasses a configured access code.
    pub async fn connect(base_url: &str, device_name: &str) -> Result<PairResponse> {
        crate::ensure_crypto_provider();
        let resp = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()?
            .post(format!("{}/connect", base_url.trim_end_matches('/')))
            .json(&serde_json::json!({"deviceName": device_name}))
            .send()
            .await?;
        if resp.status() == reqwest::StatusCode::NOT_FOUND
            || resp.status() == reqwest::StatusCode::UNAUTHORIZED
        {
            return Err(Error::Invalid("This desktop uses an access code, or is running an older version. Update LineupLab on the desktop, or enter its access code under Advanced.".into()));
        }
        Ok(resp.error_for_status()?.json().await?)
    }
    pub async fn pair(base_url: &str, code: &str, device_name: &str) -> Result<PairResponse> {
        if code.trim().is_empty() {
            return Self::connect(base_url, device_name).await;
        }
        crate::ensure_crypto_provider();
        let http = reqwest::Client::new();
        let resp = http
            .post(format!("{}/pair", base_url.trim_end_matches('/')))
            .json(&serde_json::json!({"code":code,"deviceName":device_name}))
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(crate::Error::Unauthorized);
        }
        Ok(resp.json().await?)
    }
    fn auth(&self, rb: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        rb.bearer_auth(&self.token)
    }
    pub async fn manifest(&self, since: Option<&str>) -> Result<SyncManifest> {
        let mut url = format!("{}/manifest", self.base_url);
        if let Some(s) = since {
            url.push_str(&format!("?since={s}"));
        }
        let r = self.auth(self.http.get(url)).send().await?;
        if r.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(crate::Error::Unauthorized);
        }
        Ok(r.error_for_status()?.json().await?)
    }
    pub async fn lineups(&self, ids: &[String]) -> Result<Vec<Lineup>> {
        let url = format!("{}/lineups?ids={}", self.base_url, ids.join(","));
        Ok(self
            .auth(self.http.get(url))
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?)
    }
    pub async fn image(&self, hash: &str) -> Result<Vec<u8>> {
        if !valid_hash(hash) {
            return Err(Error::Invalid(format!("Invalid media hash: {hash:?}")));
        }
        Ok(self
            .auth(self.http.get(format!("{}/images/{hash}", self.base_url)))
            .send()
            .await?
            .error_for_status()?
            .bytes()
            .await?
            .to_vec())
    }
    pub async fn put_image(&self, hash: &str, bytes: &[u8]) -> Result<()> {
        self.auth(
            self.http
                .put(format!("{}/images/{hash}", self.base_url))
                .body(bytes.to_vec()),
        )
        .send()
        .await?
        .error_for_status()?;
        Ok(())
    }
    pub async fn push(&self, device_id: &str, lineups: &[Lineup]) -> Result<PushResponse> {
        Ok(self
            .auth(
                self.http
                    .post(format!("{}/push", self.base_url))
                    .json(&PushRequest {
                        device_id: device_id.into(),
                        lineups: lineups.to_vec(),
                    }),
            )
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?)
    }
}
/// Pull newer lineups + missing images from the server into the local library.
pub async fn pull(
    client: &SyncClient,
    db: &mut crate::db::Database,
    store: &crate::storage::MediaStore,
    since: Option<&str>,
) -> Result<SyncReport> {
    let manifest = client.manifest(since).await?;
    let ids: Vec<String> = manifest.entries.iter().map(|e| e.id.clone()).collect();
    if ids.is_empty() {
        return Ok(SyncReport::default());
    }
    let incoming = client.lineups(&ids).await?;
    let mut report = SyncReport::default();
    let missing = missing_hashes(&incoming, |h| store.has(h));
    for h in &missing {
        let bytes = client.image(h).await?;
        if crate::storage::hash_bytes(&bytes) != *h {
            return Err(crate::Error::Invalid("Sync image hash mismatch".into()));
        }
        store.put(&bytes)?;
        report.images += 1;
    }
    for l in &incoming {
        let local = db.get(&l.id)?;
        if merge(local.as_ref(), l) {
            db.put(l)?;
            report.pulled += 1;
        } else {
            report.conflicts += 1;
        }
    }
    Ok(report)
}
/// Push local lineups that are newer than the server (including tombstones) plus their images.
pub async fn push_local(
    client: &SyncClient,
    db: &crate::db::Database,
    store: &crate::storage::MediaStore,
    device_id: &str,
) -> Result<SyncReport> {
    let remote = client.manifest(None).await?;
    let remote_map: std::collections::BTreeMap<String, ManifestEntry> = remote
        .entries
        .into_iter()
        .map(|e| (e.id.clone(), e))
        .collect();
    let all = db.all(true)?;
    let mut selected = vec![];
    for l in &all {
        let newer = match remote_map.get(&l.id) {
            Some(e) => {
                let mut probe = l.clone();
                probe.updated_at = e.updated_at.clone();
                probe.revision = e.revision;
                probe.device_id = e.device_id.clone();
                is_newer(l, &probe)
            }
            None => true,
        };
        if newer {
            selected.push(l.clone());
        }
    }
    let mut report = SyncReport::default();
    if selected.is_empty() {
        return Ok(report);
    }
    for h in missing_hashes(&selected, |_| false) {
        if store.has(&h) {
            client.put_image(&h, &store.get(&h)?).await?;
            report.images += 1;
        }
    }
    let resp = client.push(device_id, &selected).await?;
    report.pushed = resp.accepted.len();
    report.conflicts = resp.conflicts.len();
    Ok(report)
}
/// Bidirectional sync: push local changes, then pull remote changes.
pub async fn sync_both(
    client: &SyncClient,
    db: &mut crate::db::Database,
    store: &crate::storage::MediaStore,
    device_id: &str,
    since: Option<&str>,
) -> Result<SyncReport> {
    let up = push_local(client, db, store, device_id).await?;
    let down = pull(client, db, store, since).await?;
    Ok(SyncReport {
        pulled: down.pulled,
        pushed: up.pushed,
        images: up.images + down.images,
        conflicts: up.conflicts + down.conflicts,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredServer {
    pub name: String,
    pub address: String,
    pub port: u16,
}
/// Browse mDNS for `_lineuplab._tcp.local.` for a short window. Manual address entry remains available.
pub fn discover(timeout: std::time::Duration) -> Result<Vec<DiscoveredServer>> {
    let daemon = mdns_sd::ServiceDaemon::new().map_err(|e| crate::Error::Invalid(e.to_string()))?;
    let rx = daemon
        .browse("_lineuplab._tcp.local.")
        .map_err(|e| crate::Error::Invalid(e.to_string()))?;
    let deadline = std::time::Instant::now() + timeout;
    let mut out: std::collections::BTreeMap<String, DiscoveredServer> =
        std::collections::BTreeMap::new();
    while let Some(remaining) = deadline.checked_duration_since(std::time::Instant::now()) {
        match rx.recv_timeout(remaining.min(std::time::Duration::from_millis(200))) {
            Ok(mdns_sd::ServiceEvent::ServiceResolved(info)) => {
                if let Some(ip) = info.get_addresses_v4().iter().next() {
                    let name = info
                        .get_fullname()
                        .split("._lineuplab")
                        .next()
                        .unwrap_or("LineupLab")
                        .to_string();
                    out.insert(
                        info.get_fullname().to_string(),
                        DiscoveredServer {
                            name,
                            address: ip.to_string(),
                            port: info.get_port(),
                        },
                    );
                }
            }
            Ok(_) => {}
            Err(_) => {}
        }
    }
    let _ = daemon.shutdown();
    Ok(out.into_values().collect())
}

/// Phone downloads are additive: remote tombstones never erase an offline copy.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadReport {
    pub downloaded: usize,
    pub existing: usize,
    pub images: usize,
    pub failed: usize,
    pub total_lineups: usize,
    pub total_images: usize,
    pub warnings: Vec<String>,
    pub finished_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub phase: String,
    pub message: String,
    pub current: usize,
    pub total: usize,
}
pub async fn download_library(
    client: &SyncClient,
    db: &mut crate::db::Database,
    store: &crate::storage::MediaStore,
    mut progress: impl FnMut(DownloadProgress),
) -> Result<DownloadReport> {
    progress(DownloadProgress {
        phase: "manifest".into(),
        message: "Reading the desktop library…".into(),
        current: 0,
        total: 0,
    });
    // Always inspect the full manifest: deduplication is by saved revision/media hash,
    // not a cursor that can hide content after a failed/partial download.
    let manifest = client.manifest(None).await?;
    if manifest.protocol_version != PROTOCOL_VERSION {
        return Err(Error::Invalid(format!(
            "Unsupported download protocol {}",
            manifest.protocol_version
        )));
    }
    let ids: Vec<_> = manifest
        .entries
        .iter()
        .filter(|e| !e.deleted)
        .map(|e| e.id.clone())
        .collect();
    let mut report = DownloadReport {
        total_lineups: ids.len(),
        ..Default::default()
    };
    let mut incoming = vec![];
    for (i, chunk) in ids.chunks(200).enumerate() {
        progress(DownloadProgress {
            phase: "lineups".into(),
            message: format!(
                "Reading lineups {}–{} of {}",
                i * 200 + 1,
                i * 200 + chunk.len(),
                ids.len()
            ),
            current: i * 200,
            total: ids.len(),
        });
        incoming.extend(client.lineups(chunk).await?);
    }
    let hashes: BTreeSet<_> = incoming
        .iter()
        .flat_map(|l| l.image_hashes())
        .filter(|h| !h.trim().is_empty())
        .collect();
    report.total_images = hashes.len();
    for (i, hash) in hashes.iter().enumerate() {
        progress(DownloadProgress {
            phase: "images".into(),
            message: format!("Downloading image {} of {}", i + 1, hashes.len()),
            current: i,
            total: hashes.len(),
        });
        if !valid_hash(hash) {
            report.failed += 1;
            report
                .warnings
                .push(format!("Invalid media reference {hash:?}; skipped."));
            continue;
        }
        if store.has(hash) {
            continue;
        }
        match client.image(hash).await {
            Ok(bytes) if crate::storage::hash_bytes(&bytes) == *hash => {
                store.put(&bytes)?;
                report.images += 1;
            }
            Ok(_) => {
                report.failed += 1;
                report
                    .warnings
                    .push(format!("Image {hash} failed its integrity check; skipped."));
            }
            Err(e) => {
                report.failed += 1;
                report.warnings.push(format!("Image {hash}: {e}"));
            }
        }
    }
    for (i, l) in incoming.iter().filter(|l| !l.deleted).enumerate() {
        progress(DownloadProgress {
            phase: "saving".into(),
            message: format!("Saving lineup {} of {}", i + 1, report.total_lineups),
            current: i,
            total: report.total_lineups,
        });
        let local = db.get(&l.id)?;
        if local
            .as_ref()
            .is_none_or(|old| old.deleted || is_newer(l, old))
        {
            db.put(l)?;
            report.downloaded += 1;
        } else {
            report.existing += 1;
        }
    }
    report.finished_at = crate::now();
    progress(DownloadProgress {
        phase: "complete".into(),
        message: format!(
            "{} new lineups, {} new images; {} already saved. {} media warnings.",
            report.downloaded, report.images, report.existing, report.failed
        ),
        current: report.total_images,
        total: report.total_images,
    });
    Ok(report)
}
