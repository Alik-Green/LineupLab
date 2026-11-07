//! Deterministic last-writer-wins merge. The transport is added in the LAN milestone.
use crate::{Lineup, Result};
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
            if !has(&h) {
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
