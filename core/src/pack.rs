//! The legacy ValLineups ZIP is the only interchange format.
//! Parsing is deliberately tolerant; archive structure and resource limits are not.
use crate::{
    db::Database,
    storage::{hash_bytes, MediaStore},
    *,
};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::io::{Cursor, Read, Write};
use zip::ZipArchive;

pub const MAX_ENTRIES: usize = 20_000;
pub const MAX_ENTRY_BYTES: u64 = 64 * 1024 * 1024;
pub const MAX_TOTAL_BYTES: u64 = 512 * 1024 * 1024;
const MAX_JSON_BYTES: u64 = 4 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackManifest {
    #[serde(default = "one")]
    pub format_version: u32,
    #[serde(default = "new_id")]
    pub pack_id: String,
    #[serde(default = "untitled")]
    pub name: String,
    #[serde(default)]
    pub author: String,
    #[serde(default = "now")]
    pub created_at: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub is_seed_placeholder: bool,
    #[serde(flatten)]
    pub extra: JsonObject,
}
fn one() -> u32 {
    1
}
fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}
fn untitled() -> String {
    "Untitled pack".into()
}
impl Default for PackManifest {
    fn default() -> Self {
        Self {
            format_version: 1,
            pack_id: new_id(),
            name: untitled(),
            author: String::new(),
            created_at: now(),
            description: String::new(),
            is_seed_placeholder: false,
            extra: JsonObject::new(),
        }
    }
}
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, clap::ValueEnum)]
#[serde(rename_all = "snake_case")]
#[value(rename_all = "kebab-case")]
pub enum ConflictPolicy {
    Skip,
    #[default]
    OverwriteIfNewer,
    ImportAsCopy,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportStatus {
    New,
    Identical,
    NewerInPack,
    NewerLocally,
    Error,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportEntry {
    pub path: String,
    pub id: String,
    pub title: String,
    pub status: ImportStatus,
    pub selected: bool,
    pub warnings: Vec<String>,
    pub probable_duplicates: Vec<String>,
    pub lineup: Option<Lineup>,
    #[serde(skip)]
    pub original: Value,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub token: String,
    pub manifest: PackManifest,
    pub entries: Vec<ImportEntry>,
    pub warnings: Vec<String>,
    pub media_count: usize,
    pub total_bytes: u64,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub batch_id: String,
    pub imported: usize,
    pub skipped: usize,
    pub errors: usize,
    pub copied: usize,
    pub overwritten: usize,
    pub warnings: Vec<String>,
    pub imported_ids: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    pub phase: String,
    pub message: String,
    pub current: usize,
    pub total: usize,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub name: String,
    pub author: String,
    pub description: String,
    pub legacy_compatible_images: bool,
    pub bake_annotations: bool,
}
impl Default for ExportOptions {
    fn default() -> Self {
        Self {
            name: "LineupLab export".into(),
            author: String::new(),
            description: String::new(),
            legacy_compatible_images: true,
            bake_annotations: false,
        }
    }
}
#[derive(Debug, Clone)]
pub struct PackArchive {
    pub manifest: PackManifest,
    pub lineups: Vec<(String, Value)>,
    pub media: BTreeMap<String, Vec<u8>>,
    pub warnings: Vec<String>,
    pub total_bytes: u64,
    pub errors: BTreeMap<String, String>,
}

/// Reads into memory with hard limits; never extracts archive paths to the filesystem.
pub fn read_archive(bytes: &[u8]) -> Result<PackArchive> {
    let mut zip = ZipArchive::new(Cursor::new(bytes))?;
    if zip.len() > MAX_ENTRIES {
        return Err(Error::Invalid(format!(
            "Archive exceeds {MAX_ENTRIES} entries"
        )));
    }
    let mut names = BTreeSet::new();
    let mut media = BTreeMap::new();
    let mut documents = vec![];
    let mut manifest_bytes = None;
    let mut total = 0u64;
    let mut errors = BTreeMap::new();
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let name = entry.name().to_string();
        if !names.insert(name.clone()) {
            return Err(Error::Invalid(format!("Duplicate ZIP entry: {name}")));
        }
        if entry.enclosed_name().is_none()
            || name.starts_with('/')
            || name.starts_with('\\')
            || name.contains('\\')
            || name.contains(':')
            || name.split('/').any(|p| p == ".." || p == ".")
        {
            return Err(Error::Invalid(format!("Unsafe archive path: {name}")));
        }
        if entry.is_dir() {
            continue;
        }
        if entry.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000) {
            return Err(Error::Invalid(format!(
                "Symlink entry is not allowed: {name}"
            )));
        }
        let json_entry = name == "manifest.json"
            || (name.starts_with("lineups/")
                && name.ends_with(".json")
                && name[8..name.len() - 5].len() > 0
                && !name[8..name.len() - 5].contains('/'));
        let media_entry =
            name.starts_with("media/") && !name[6..].contains('/') && is_allowed_media(&name);
        if !json_entry && !media_entry {
            return Err(Error::Invalid(format!("Unsupported archive entry: {name}")));
        }
        let limit = if json_entry {
            if name == "manifest.json" {
                1024 * 1024
            } else {
                MAX_JSON_BYTES
            }
        } else {
            MAX_ENTRY_BYTES
        };
        if entry.size() > limit {
            return Err(Error::Invalid(format!(
                "Entry too large: {name} ({} bytes)",
                entry.size()
            )));
        }
        let mut buf = Vec::with_capacity(entry.size().min(limit) as usize);
        entry.by_ref().take(limit + 1).read_to_end(&mut buf)?;
        if buf.len() as u64 > limit {
            return Err(Error::Invalid(format!(
                "Decompressed entry too large: {name}"
            )));
        }
        total = total
            .checked_add(buf.len() as u64)
            .ok_or_else(|| Error::Invalid("Archive size overflow".into()))?;
        if total > MAX_TOTAL_BYTES {
            return Err(Error::Invalid(format!(
                "Archive exceeds {MAX_TOTAL_BYTES} total bytes"
            )));
        }
        if name == "manifest.json" {
            manifest_bytes = Some(buf);
        } else if json_entry {
            match serde_json::from_slice::<Value>(&buf) {
                Ok(value) => documents.push((name, value)),
                Err(e) => {
                    errors.insert(name.clone(), format!("Malformed JSON: {e}"));
                    documents.push((name, Value::Null));
                }
            }
        } else {
            media.insert(name, buf);
        }
    }
    let raw = manifest_bytes.ok_or_else(|| Error::Invalid("Missing manifest.json".into()))?;
    let value: Value = serde_json::from_slice(&raw)?;
    let mut warnings = vec![];
    let manifest = parse_manifest(&value, &mut warnings)?;
    Ok(PackArchive {
        manifest,
        lineups: documents,
        media,
        warnings,
        total_bytes: total,
        errors,
    })
}
pub fn is_allowed_media(name: &str) -> bool {
    matches!(
        name.rsplit('.')
            .next()
            .map(|s| s.to_ascii_lowercase())
            .as_deref(),
        Some("jpg" | "jpeg" | "png" | "webp" | "mp4" | "webm" | "mov")
    )
}
fn parse_manifest(v: &Value, warnings: &mut Vec<String>) -> Result<PackManifest> {
    let obj = v
        .as_object()
        .ok_or_else(|| Error::Invalid("manifest.json must be an object".into()))?;
    let mut extra = obj.clone();
    for key in [
        "formatVersion",
        "packId",
        "name",
        "author",
        "createdAt",
        "description",
        "isSeedPlaceholder",
    ] {
        extra.remove(key);
    }
    let mut m = PackManifest {
        format_version: u32_number(obj.get("formatVersion"), 1),
        pack_id: string(obj.get("packId"), &new_id(), "manifest.packId", warnings),
        name: string(obj.get("name"), "Untitled pack", "manifest.name", warnings),
        author: string(obj.get("author"), "", "manifest.author", warnings),
        created_at: string(obj.get("createdAt"), &now(), "manifest.createdAt", warnings),
        description: string(obj.get("description"), "", "manifest.description", warnings),
        is_seed_placeholder: boolean(obj.get("isSeedPlaceholder"), false),
        extra,
    };
    if m.format_version != 1 {
        warnings.push(format!(
            "Unsupported manifest formatVersion {}; importing best-effort as 1",
            m.format_version
        ));
        m.format_version = 1;
    }
    Ok(m)
}
fn string(v: Option<&Value>, default: &str, key: &str, warnings: &mut Vec<String>) -> String {
    match v {
        None | Some(Value::Null) => default.into(),
        Some(Value::String(s)) => s.clone(),
        Some(x) => {
            warnings.push(format!("{key}: coerced {} to string", type_name(x)));
            match x {
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                _ => default.into(),
            }
        }
    }
}
fn boolean(v: Option<&Value>, default: bool) -> bool {
    match v {
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|n| n != 0.),
        Some(Value::String(s)) => match s.to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" => true,
            "false" | "0" | "no" => false,
            _ => default,
        },
        _ => default,
    }
}
fn number(v: Option<&Value>, default: f64) -> f64 {
    match v {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(default),
        Some(Value::String(s)) => s.trim().parse().unwrap_or(default),
        _ => default,
    }
    .max(0.)
}
fn u32_number(v: Option<&Value>, default: u32) -> u32 {
    number(v, default as f64).min(u32::MAX as f64) as u32
}
fn type_name(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}
fn object(v: Option<&Value>) -> JsonObject {
    v.and_then(Value::as_object).cloned().unwrap_or_default()
}
fn point(
    v: Option<&Value>,
    key: &str,
    warnings: &mut Vec<String>,
    invalid: &mut JsonObject,
) -> Option<Point> {
    let v = v?;
    if v.is_null() {
        return None;
    }
    let p = Point {
        x: number(v.get("x"), f64::NAN),
        y: number(v.get("y"), f64::NAN),
    };
    if !p.finite() {
        warnings.push(format!(
            "{key}: invalid coordinate retained under x_lineuplab.invalidFields"
        ));
        invalid.insert(key.into(), v.clone());
        return None;
    }
    if p.x < 0. || p.x > 1. || p.y < 0. || p.y > 1. {
        warnings.push(format!("{key}: clamped to minimap bounds"));
    }
    Some(p.clamped())
}
fn parse_circle(v: &Value, warnings: &mut Vec<String>) -> std::result::Result<FocusCircle, Value> {
    let mut obj = match v.as_object() {
        Some(o) => o.clone(),
        None => return Err(v.clone()),
    };
    for key in [
        "x",
        "y",
        "radius",
        "zoomScale",
        "zoomSize",
        "zoomX",
        "zoomY",
    ] {
        if obj.contains_key(key) && !obj[key].is_number() {
            obj.insert(key.into(), json!(number(obj.get(key), 0.)));
        }
    }
    if let Some(color) = obj.get("color") {
        if !color.is_string() {
            obj.insert(
                "color".into(),
                json!(string(Some(color), "cyan", "circle.color", warnings)),
            );
        }
    }
    if let Some(show) = obj.get("showZoom") {
        if !show.is_boolean() {
            obj.insert("showZoom".into(), json!(boolean(Some(show), false)));
        }
    }
    serde_json::from_value(Value::Object(obj)).map_err(|_| v.clone())
}
fn circles(v: Option<&Value>, slot: &mut SlotData, warnings: &mut Vec<String>) -> Vec<FocusCircle> {
    let mut out = vec![];
    if let Some(arr) = v.and_then(Value::as_array) {
        for c in arr {
            match parse_circle(c, warnings) {
                Ok(c) => out.push(c),
                Err(raw) => {
                    warnings.push("Invalid circle retained in slot extras".into());
                    slot.extra
                        .entry("invalidCircles")
                        .or_insert_with(|| json!([]))
                        .as_array_mut()
                        .map(|a| a.push(raw));
                }
            }
        }
    }
    out
}
fn infer_mode(attrs: &JsonObject, root: &JsonObject, extensions: &Extensions) -> String {
    if let Some(v) = extensions.extra.get("mode").and_then(Value::as_str) {
        return v.into();
    }
    if let Some(v) = root.get("mode").and_then(Value::as_str) {
        return v.into();
    }
    let double = boolean(attrs.get("doubleShock"), false);
    if double {
        return "double".into();
    }
    if attrs.contains_key("bounces") || attrs.contains_key("chargeStage") {
        return format!(
            "recon-{}-{}",
            u32_number(attrs.get("bounces"), 0),
            u32_number(attrs.get("chargeStage"), 0)
        );
    }
    if boolean(attrs.get("doubleShock"), false) {
        return "double".into();
    }
    "standard".into()
}

/// `resolve` maps a legacy media path to a content hash. None means the reference is preserved as a warning and the slot stays empty.
pub fn parse_lineup(
    v: &Value,
    device_id: &str,
    mut resolve: impl FnMut(&str) -> Option<String>,
) -> Result<(Lineup, Vec<String>)> {
    let root = v
        .as_object()
        .ok_or_else(|| Error::Invalid("Lineup JSON must be an object".into()))?
        .clone();
    let mut warnings = vec![];
    let mut invalid = JsonObject::new();
    let schema = u32_number(root.get("schemaVersion"), 1);
    if schema > 1 {
        warnings.push(format!("schemaVersion {schema}: imported best-effort; original version retained in x_lineuplab"));
    }
    let id = string(root.get("id"), &new_id(), "id", &mut warnings);
    let created = string(root.get("createdAt"), &now(), "createdAt", &mut warnings);
    let updated = string(root.get("updatedAt"), &created, "updatedAt", &mut warnings);
    let mut l = Lineup::new(
        string(root.get("mapUuid"), "", "mapUuid", &mut warnings),
        string(root.get("agentUuid"), "", "agentUuid", &mut warnings),
        string(
            root.get("abilitySlot"),
            "Grenade",
            "abilitySlot",
            &mut warnings,
        ),
        string(root.get("deviceId"), device_id, "deviceId", &mut warnings),
    );
    l.id = id;
    l.created_at = created;
    l.updated_at = updated;
    l.title = string(root.get("title"), "Untitled lineup", "title", &mut warnings);
    l.site = string(root.get("site"), "", "site", &mut warnings);
    l.difficulty = string(
        root.get("difficulty"),
        "medium",
        "difficulty",
        &mut warnings,
    );
    l.throw_type = string(root.get("throwType"), "normal", "throwType", &mut warnings);
    l.notes = string(root.get("notes"), "", "notes", &mut warnings);
    l.author = string(root.get("author"), "", "author", &mut warnings);
    l.source = string(root.get("source"), "", "source", &mut warnings);
    l.is_favorite = boolean(root.get("isFavorite"), false);
    l.side = match string(root.get("side"), "both", "side", &mut warnings)
        .to_ascii_lowercase()
        .as_str()
    {
        "attack" | "attacker" => Side::Attack,
        "defense" | "defence" | "defender" => Side::Defense,
        _ => Side::Both,
    };
    l.tags = match root.get("tags") {
        Some(Value::Array(a)) => a
            .iter()
            .map(|v| string(Some(v), "", "tag", &mut warnings))
            .filter(|s| !s.is_empty())
            .collect(),
        Some(Value::String(s)) if !s.is_empty() => vec![s.clone()],
        _ => vec![],
    };
    l.stand1_pos = point(root.get("start"), "start", &mut warnings, &mut invalid);
    l.land_pos = point(root.get("end"), "end", &mut warnings, &mut invalid);
    l.bounces = root
        .get("bounces")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|v| point(Some(v), "bounces[]", &mut warnings, &mut invalid))
                .collect()
        })
        .unwrap_or_default();
    l.revision = root
        .get("revision")
        .map(|v| u32_number(Some(v), 0) as u64)
        .unwrap_or(0);
    l.deleted = boolean(root.get("deleted"), false);
    l.draft = boolean(root.get("draft"), false);

    let mut attrs = object(root.get("attributes"));
    let media = object(root.get("media"));
    let projectiles = attrs
        .get("projectiles")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let slot_circles = object(attrs.get("slotCircles"));
    let mut throws = vec![];
    let mut throw_forms = JsonObject::new();
    for (i, p) in projectiles.iter().enumerate() {
        let mut forms = JsonObject::new();
        for key in ["chargeStage", "chargeBars", "bounces"] {
            if let Some(Value::String(_)) = p.get(key) {
                forms.insert(key.into(), p[key].clone());
            }
        }
        if !forms.is_empty() {
            throw_forms.insert(i.to_string(), Value::Object(forms));
        }
        let mut extra = object(Some(p));
        for k in [
            "index",
            "label",
            "aimImage",
            "standImage",
            "chargeStage",
            "chargeBars",
            "bounces",
            "throwType",
            "focusCircles",
        ] {
            extra.remove(k);
        }
        let mut focus_slot = SlotData::default();
        let focus = circles(p.get("focusCircles"), &mut focus_slot, &mut warnings);
        if !focus_slot.extra.is_empty() {
            extra.insert(
                "invalidFocusCircles".into(),
                focus_slot
                    .extra
                    .get("invalidCircles")
                    .cloned()
                    .unwrap_or(json!([])),
            );
        }
        throws.push(Throw {
            index: u32_number(p.get("index"), i as u32),
            label: string(
                p.get("label"),
                &format!("Throw {}", i + 1),
                "projectiles.label",
                &mut warnings,
            ),
            stand_image: p
                .get("standImage")
                .and_then(Value::as_str)
                .and_then(&mut resolve),
            aim_image: p
                .get("aimImage")
                .and_then(Value::as_str)
                .and_then(&mut resolve),
            charge_stage: u32_number(p.get("chargeStage"), 0),
            charge_bars: u32_number(p.get("chargeBars"), 0),
            bounces: u32_number(p.get("bounces"), 0),
            throw_type: string(
                p.get("throwType"),
                &l.throw_type,
                "projectiles.throwType",
                &mut warnings,
            ),
            focus_circles: focus,
            extra,
        });
    }
    let mut steps = vec![];
    if let Some(arr) = root.get("steps").and_then(Value::as_array) {
        for (i, s) in arr.iter().enumerate() {
            let mut extra = object(Some(s));
            for k in ["order", "text", "imageRef"] {
                extra.remove(k);
            }
            steps.push(Step {
                order: u32_number(s.get("order"), i as u32),
                text: string(s.get("text"), "", "steps.text", &mut warnings),
                image_ref: s
                    .get("imageRef")
                    .and_then(Value::as_str)
                    .and_then(&mut resolve),
                extra,
            });
        }
    }
    steps.sort_by_key(|s| s.order);
    let mut used_steps = BTreeSet::new();
    let mut missing = vec![];
    let mut media_ref = |v: Option<&Value>| -> Option<String> {
        v.and_then(Value::as_str).and_then(|path| {
            let hash = resolve(path);
            if hash.is_none() {
                missing.push(path.to_string());
            }
            hash
        })
    };
    let primary = [
        (
            Slot::Stand1,
            media_ref(media.get("standImage")),
            media.get("standImage").and_then(Value::as_str).is_some(),
        ),
        (
            Slot::Aim1,
            media_ref(media.get("aimImage")),
            media.get("aimImage").and_then(Value::as_str).is_some(),
        ),
        (
            Slot::Stand2,
            media_ref(attrs.get("stand2Image")),
            attrs.get("stand2Image").and_then(Value::as_str).is_some(),
        ),
        (
            Slot::Aim2,
            throws.get(1).and_then(|t| t.aim_image.clone()),
            false,
        ),
        (
            Slot::Landing,
            media_ref(media.get("landingImage")),
            media.get("landingImage").and_then(Value::as_str).is_some(),
        ),
    ];
    for (slot, hash, explicit_reference) in primary {
        let fallback = match slot {
            Slot::Stand1 => throws.first().and_then(|t| t.stand_image.clone()),
            Slot::Aim1 => throws.first().and_then(|t| t.aim_image.clone()),
            Slot::Stand2 => throws.get(1).and_then(|t| t.stand_image.clone()),
            Slot::Aim2 => throws.get(1).and_then(|t| t.aim_image.clone()),
            Slot::Landing => None,
        };
        let fallback = fallback.or_else(|| {
            if !explicit_reference && matches!(slot, Slot::Stand1 | Slot::Aim1 | Slot::Landing) {
                steps
                    .iter()
                    .enumerate()
                    .find(|(i, s)| !used_steps.contains(i) && s.image_ref.is_some())
                    .map(|(i, s)| {
                        used_steps.insert(i);
                        s.image_ref.clone().unwrap_or_default()
                    })
            } else {
                None
            }
        });
        let data = l.slot_mut(slot);
        data.image = hash.or(fallback);
        data.circles = circles(slot_circles.get(slot.as_str()), data, &mut warnings);
    }
    // slotCircles is canonical. Projectile-only circles merge by id into the matching aim slot.
    for t in &throws {
        let slot = if t.index == 0 { Slot::Aim1 } else { Slot::Aim2 };
        let canonical = l.slot_mut(slot);
        for c in &t.focus_circles {
            if let Some(existing) = canonical.circles.iter().find(|x| x.id == c.id) {
                if existing != c {
                    warnings.push(format!(
                        "Circle {} differs in slotCircles and projectiles; slotCircles wins",
                        c.id
                    ));
                }
            } else {
                canonical.circles.push(c.clone());
            }
        }
    }
    l.throws = throws;
    l.steps = steps;
    let clip = media_ref(media.get("videoClip"));
    let thumbnail = media_ref(media.get("videoThumbnail"));
    if clip.is_some() || thumbnail.is_some() {
        let mut extra = media.clone();
        for k in [
            "standImage",
            "aimImage",
            "landingImage",
            "videoClip",
            "videoThumbnail",
        ] {
            extra.remove(k);
        }
        l.video = Some(Video {
            clip: clip.unwrap_or_default(),
            thumbnail,
            extra,
        });
    }
    l.stand2_pos = point(
        attrs.get("stand2Point"),
        "stand2Point",
        &mut warnings,
        &mut invalid,
    );
    attrs.remove("projectiles");
    attrs.remove("slotCircles");
    attrs.remove("stand2Image");
    attrs.remove("stand2Point");
    for (k, v) in &attrs {
        if let Value::String(s) = v {
            let parsed = if s.eq_ignore_ascii_case("true") {
                Some(json!(true))
            } else if s.eq_ignore_ascii_case("false") {
                Some(json!(false))
            } else if let Ok(n) = s.parse::<u32>() {
                Some(json!(n))
            } else if let Ok(n) = s.parse::<f64>() {
                n.is_finite().then(|| json!(n))
            } else {
                None
            };
            if let Some(parsed) = parsed {
                l.extensions.attribute_forms.insert(k.clone(), v.clone());
                l.attributes.insert(k.clone(), parsed);
                continue;
            }
        }
        l.attributes.insert(k.clone(), v.clone());
    }
    // Preserve unknown fields at every documented nesting level.
    let known = [
        "schemaVersion",
        "id",
        "title",
        "mapUuid",
        "agentUuid",
        "abilitySlot",
        "side",
        "site",
        "start",
        "end",
        "bounces",
        "throwType",
        "difficulty",
        "tags",
        "notes",
        "author",
        "source",
        "isFavorite",
        "createdAt",
        "updatedAt",
        "attributes",
        "steps",
        "media",
        "x_lineuplab",
        "mode",
        "revision",
        "deviceId",
        "deleted",
        "draft",
    ];
    for (k, v) in &root {
        if !known.contains(&k.as_str()) {
            l.legacy.insert(k.clone(), v.clone());
        }
    }
    if root.get("mode").is_some() {
        l.legacy.insert("mode".into(), root["mode"].clone());
    }
    let mut media_extra = media.clone();
    for k in [
        "standImage",
        "aimImage",
        "landingImage",
        "videoClip",
        "videoThumbnail",
    ] {
        media_extra.remove(k);
    }
    if !media_extra.is_empty() {
        l.legacy.insert("media".into(), Value::Object(media_extra));
    }
    if let Some(x) = root.get("x_lineuplab").and_then(Value::as_object) {
        if let Some(lines) = x.get("slotLines").and_then(Value::as_object) {
            for (key, value) in lines {
                if let Ok(slot) = key.parse::<Slot>() {
                    match serde_json::from_value::<Vec<AnnotationLine>>(value.clone()) {
                        Ok(lines) => {
                            for line in &lines {
                                if !crate::geometry::valid_line(line) {
                                    warnings.push(format!(
                                        "Invalid line in {key} retained as imported data"
                                    ));
                                }
                            }
                            l.slot_mut(slot).lines = lines;
                            l.extensions
                                .slot_lines
                                .insert(slot, l.slot(slot).lines.clone());
                        }
                        Err(_) => {
                            l.extensions
                                .extra
                                .insert(format!("invalidSlotLines_{key}"), value.clone());
                            warnings.push(format!(
                                "Invalid slotLines.{key} preserved under x_lineuplab"
                            ));
                        }
                    }
                }
            }
        }
        if let Some(forms) = x.get("attributeForms").and_then(Value::as_object) {
            l.extensions.attribute_forms = forms.clone();
        }
        if let Some(meta) = x.get("meta").and_then(Value::as_object) {
            l.revision = meta
                .get("revision")
                .and_then(Value::as_u64)
                .unwrap_or(l.revision);
            l.device_id = string(
                meta.get("deviceId"),
                device_id,
                "x_lineuplab.meta.deviceId",
                &mut warnings,
            );
            l.deleted = boolean(meta.get("deleted"), l.deleted);
            l.draft = boolean(meta.get("draft"), l.draft);
        }
        if let Some(version) = x.get("sourceSchemaVersion") {
            l.extensions
                .extra
                .insert("sourceSchemaVersion".into(), version.clone());
        }
        for (k, v) in x {
            if ![
                "slotLines",
                "attributeForms",
                "meta",
                "originalMedia",
                "bakedImages",
                "sourceSchemaVersion",
                "mode",
            ]
            .contains(&k.as_str())
            {
                l.extensions.extra.insert(k.clone(), v.clone());
            }
        }
    }
    if schema > 1 {
        l.extensions
            .extra
            .insert("sourceSchemaVersion".into(), json!(schema));
    }
    l.mode = infer_mode(&l.attributes, &root, &l.extensions);
    if !invalid.is_empty() {
        l.extensions
            .extra
            .insert("invalidFields".into(), Value::Object(invalid));
    }
    if !throw_forms.is_empty() {
        l.extensions
            .extra
            .insert("throwForms".into(), Value::Object(throw_forms));
    }
    if !missing.is_empty() {
        warnings.push(format!("Missing media: {}", missing.join(", ")));
    }
    let required_missing = [Slot::Stand1, Slot::Aim1, Slot::Landing]
        .iter()
        .any(|s| l.slot(*s).image.is_none());
    if required_missing || !missing.is_empty() {
        l.extensions.extra.insert("incomplete".into(), json!(true));
    }
    Ok((l, warnings))
}

pub fn preview(archive: &PackArchive, db: &Database) -> Result<ImportPreview> {
    let device = db.device_id()?;
    let local = db.all(true)?;
    let mut warnings = archive.warnings.clone();
    let mut entries = vec![];
    let mut seen = BTreeSet::new();
    // Legacy-compatible WebP exports include the original plus an old-app JPEG view.
    let original_media: BTreeMap<String, String> = archive
        .lineups
        .iter()
        .filter_map(|(_, v)| {
            v.get("x_lineuplab")?
                .get("originalMedia")?
                .as_object()
                .map(|o| {
                    o.iter()
                        .filter_map(|(k, v)| {
                            Some((k.clone(), v.get("path")?.as_str()?.to_string()))
                        })
                        .collect::<Vec<_>>()
                })
        })
        .flatten()
        .collect();
    let hashes: BTreeMap<String, String> = archive
        .media
        .iter()
        .map(|(p, b)| (p.clone(), hash_bytes(b)))
        .collect();
    for (path, value) in &archive.lineups {
        if let Some(error) = archive.errors.get(path) {
            entries.push(ImportEntry {
                path: path.clone(),
                id: path.clone(),
                title: "Malformed JSON".into(),
                status: ImportStatus::Error,
                selected: false,
                warnings: vec![error.clone()],
                probable_duplicates: vec![],
                lineup: None,
                original: Value::Null,
            });
            continue;
        }
        let mut resolve = |ref_path: &str| -> Option<String> {
            let original_path = original_media
                .get(ref_path)
                .map(String::as_str)
                .unwrap_or(ref_path);
            hashes
                .get(original_path)
                .cloned()
                .or_else(|| hashes.get(ref_path).cloned())
        };
        match parse_lineup(value, &device, &mut resolve) {
            Ok((mut l, mut entry_warnings)) => {
                if !seen.insert(l.id.clone()) {
                    entry_warnings.push("Duplicate id in pack; select only one entry".into());
                    l.extensions
                        .extra
                        .insert("duplicateInPack".into(), json!(true));
                }
                let existing = local.iter().find(|x| x.id == l.id);
                let status = if l.extensions.extra.contains_key("duplicateInPack") {
                    ImportStatus::Error
                } else {
                    match existing {
                        None => ImportStatus::New,
                        Some(old) => {
                            if semantic_equal(old, &l) {
                                ImportStatus::Identical
                            } else if crate::sync::pack_is_newer(&l, old) {
                                ImportStatus::NewerInPack
                            } else {
                                ImportStatus::NewerLocally
                            }
                        }
                    }
                };
                let probable: Vec<String> = local.iter().filter(|old| !old.deleted && old.id != l.id && old.map_id == l.map_id && old.agent_id == l.agent_id && old.ability_slot == l.ability_slot && old.mode == l.mode && matches!((old.land_pos,l.land_pos),(Some(a),Some(b)) if a.distance(b) <= 0.025)).map(|x| x.id.clone()).collect();
                if !probable.is_empty() {
                    entry_warnings.push(
                        "Probable duplicate: same map/agent/ability/mode and nearby landing".into(),
                    );
                }
                let selected = !archive.manifest.is_seed_placeholder
                    && matches!(status, ImportStatus::New | ImportStatus::NewerInPack);
                entries.push(ImportEntry {
                    path: path.clone(),
                    id: l.id.clone(),
                    title: l.title.clone(),
                    status,
                    selected,
                    warnings: entry_warnings,
                    probable_duplicates: probable,
                    lineup: Some(l),
                    original: value.clone(),
                });
            }
            Err(e) => {
                let id = value
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or(path)
                    .to_string();
                entries.push(ImportEntry {
                    path: path.clone(),
                    id: id.clone(),
                    title: value
                        .get("title")
                        .and_then(Value::as_str)
                        .unwrap_or("Invalid lineup")
                        .into(),
                    status: ImportStatus::Error,
                    selected: false,
                    warnings: vec![e.to_string()],
                    probable_duplicates: vec![],
                    lineup: None,
                    original: value.clone(),
                });
            }
        }
    }
    if archive.manifest.is_seed_placeholder {
        warnings.push("Seed placeholder pack: entries are unchecked by default".into());
    }
    Ok(ImportPreview {
        token: new_id(),
        manifest: archive.manifest.clone(),
        entries,
        warnings,
        media_count: archive.media.len(),
        total_bytes: archive.total_bytes,
    })
}
fn semantic_equal(a: &Lineup, b: &Lineup) -> bool {
    let mut a = a.clone();
    let mut b = b.clone();
    a.import_batch_id = None;
    b.import_batch_id = None;
    a.device_id.clear();
    b.device_id.clear();
    a.revision = 0;
    b.revision = 0;
    a.extensions.extra.remove("incomplete");
    b.extensions.extra.remove("incomplete");
    serde_json::to_value(a).ok() == serde_json::to_value(b).ok()
}
pub fn commit(
    db: &mut Database,
    store: &MediaStore,
    archive: &PackArchive,
    preview: &ImportPreview,
    selected: &BTreeSet<String>,
    policy: ConflictPolicy,
) -> Result<ImportReport> {
    commit_with_progress(db, store, archive, preview, selected, policy, |_| {})
}

/// Same transactional import as [`commit`], with coarse media/entry progress for native shells.
pub fn commit_with_progress(
    db: &mut Database,
    store: &MediaStore,
    archive: &PackArchive,
    preview: &ImportPreview,
    selected: &BTreeSet<String>,
    policy: ConflictPolicy,
    mut progress: impl FnMut(ImportProgress),
) -> Result<ImportReport> {
    let batch_id = new_id();
    let mut report = ImportReport {
        batch_id: batch_id.clone(),
        ..Default::default()
    };
    let mut staged = BTreeMap::new();
    let media_total = archive.media.len();
    progress(ImportProgress {
        phase: "media".into(),
        message: format!("Copying pack media (0/{media_total})"),
        current: 0,
        total: media_total,
    });
    for (i, bytes) in archive.media.values().enumerate() {
        let hash = store.put(bytes)?;
        progress(ImportProgress {
            phase: "media".into(),
            message: format!("Copying pack media ({}/{media_total})", i + 1),
            current: i + 1,
            total: media_total,
        });
        staged.entry(hash).or_insert_with(|| {
            (
                crate::storage::mime_for(bytes).to_string(),
                bytes.len() as u64,
                store.dimensions(bytes),
            )
        });
    }
    let tx = db.transaction()?;
    let mut chosen = BTreeSet::new();
    let entry_total = preview.entries.len();
    progress(ImportProgress {
        phase: "lineups".into(),
        message: format!("Writing lineups (0/{entry_total})"),
        current: 0,
        total: entry_total,
    });
    for (i, entry) in preview.entries.iter().enumerate() {
        progress(ImportProgress {
            phase: "lineups".into(),
            message: format!("Writing lineups ({}/{entry_total})", i + 1),
            current: i + 1,
            total: entry_total,
        });
        if !selected.contains(&entry.id) {
            report.skipped += 1;
            continue;
        }
        if entry.status == ImportStatus::Error {
            report.errors += 1;
            report.warnings.extend(entry.warnings.clone());
            continue;
        }
        let Some(mut l) = entry.lineup.clone() else {
            report.errors += 1;
            continue;
        };
        if !chosen.insert(entry.id.clone()) {
            report.skipped += 1;
            report
                .warnings
                .push(format!("Duplicate id {} committed only once", entry.id));
            continue;
        }
        let previous: Option<String> = tx
            .query_row("SELECT document FROM lineups WHERE id=?1", [&l.id], |r| {
                r.get(0)
            })
            .optional()?;
        let previous_lineup: Option<Lineup> =
            previous.as_deref().map(serde_json::from_str).transpose()?;
        if let Some(old) = &previous_lineup {
            match policy {
                ConflictPolicy::Skip => {
                    report.skipped += 1;
                    continue;
                }
                ConflictPolicy::OverwriteIfNewer if !crate::sync::pack_is_newer(&l, old) => {
                    report.skipped += 1;
                    continue;
                }
                ConflictPolicy::ImportAsCopy => {
                    l.id = new_id();
                    l.title = format!("{} (copy)", l.title);
                    l.created_at = now();
                    l.updated_at = now();
                    l.revision = 0;
                    report.copied += 1;
                }
                _ => {
                    report.overwritten += 1;
                }
            }
        }
        if previous_lineup.is_some() && policy != ConflictPolicy::ImportAsCopy {
            l.revision = previous_lineup
                .as_ref()
                .map_or(0, |p| p.revision)
                .max(l.revision)
                + 1;
        }
        l.import_batch_id = Some(batch_id.clone());
        let backup_previous = if policy == ConflictPolicy::ImportAsCopy {
            None
        } else {
            previous
        };
        tx.execute(
            "INSERT INTO import_backups(batch_id,lineup_id,previous_document) VALUES(?1,?2,?3)",
            rusqlite::params![batch_id, l.id, backup_previous],
        )?;
        let document = serde_json::to_string(&l)?;
        tx.execute("INSERT INTO lineups(id,map_id,agent_id,ability_slot,mode,side,updated_at,revision,deleted,favorite,draft,import_batch_id,document) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13) ON CONFLICT(id) DO UPDATE SET map_id=excluded.map_id,agent_id=excluded.agent_id,ability_slot=excluded.ability_slot,mode=excluded.mode,side=excluded.side,updated_at=excluded.updated_at,revision=excluded.revision,deleted=excluded.deleted,favorite=excluded.favorite,draft=excluded.draft,import_batch_id=excluded.import_batch_id,document=excluded.document", rusqlite::params![l.id,l.map_id,l.agent_id,l.ability_slot,l.mode,serde_json::to_value(l.side)?.as_str(),l.updated_at,l.revision,l.deleted,l.is_favorite,l.draft,l.import_batch_id,document])?;
        for hash in l.image_hashes() {
            if let Some((mime, size, dimensions)) = staged.get(&hash) {
                tx.execute("INSERT OR IGNORE INTO media(hash,mime,bytes,width,height) VALUES(?1,?2,?3,?4,?5)", rusqlite::params![hash,mime,*size as i64,dimensions.map(|d|d.0),dimensions.map(|d|d.1)])?;
            }
        }
        report.imported += 1;
        report.imported_ids.push(l.id.clone());
        report.warnings.extend(entry.warnings.clone());
    }
    tx.execute(
        "INSERT INTO import_batches(id,name,created_at,report) VALUES(?1,?2,?3,?4)",
        rusqlite::params![
            batch_id,
            archive.manifest.name,
            now(),
            serde_json::to_string(&report)?
        ],
    )?;
    tx.commit()?;
    progress(ImportProgress {
        phase: "done".into(),
        message: "Import finished".into(),
        current: entry_total,
        total: entry_total,
    });
    Ok(report)
}
pub fn import_bytes(
    db: &mut Database,
    store: &MediaStore,
    bytes: &[u8],
    policy: ConflictPolicy,
    seed_override: Option<bool>,
) -> Result<ImportReport> {
    let archive = read_archive(bytes)?;
    let p = preview(&archive, db)?;
    let selected = p
        .entries
        .iter()
        .filter(|e| seed_override.unwrap_or(e.selected))
        .map(|e| e.id.clone())
        .collect();
    commit(db, store, &archive, &p, &selected, policy)
}
pub fn undo_import(db: &mut Database, batch_id: &str) -> Result<ImportReport> {
    let device = db.device_id()?;
    let mut report = ImportReport {
        batch_id: batch_id.into(),
        ..Default::default()
    };
    let exists: bool = db.conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM import_batches WHERE id=?1 AND undone=0)",
        [batch_id],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(Error::NotFound("Active import batch".into()));
    }
    let mut stmt = db
        .conn
        .prepare("SELECT lineup_id,previous_document FROM import_backups WHERE batch_id=?1")?;
    let rows = stmt.query_map([batch_id], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?))
    })?;
    let mut backups = vec![];
    for row in rows {
        backups.push(row?);
    }
    drop(stmt);
    let tx = db.transaction()?;
    for (id, previous) in backups {
        let current: Option<String> = tx
            .query_row("SELECT document FROM lineups WHERE id=?1", [&id], |r| {
                r.get(0)
            })
            .optional()?;
        let Some(current) = current else {
            continue;
        };
        let mut current: Lineup = serde_json::from_str(&current)?;
        if current.import_batch_id.as_deref() != Some(batch_id) {
            report.skipped += 1;
            report
                .warnings
                .push(format!("{id}: changed by a later import; left intact"));
            continue;
        }
        match previous {
            None => {
                current.deleted = true;
                current.revision += 1;
                current.updated_at = now();
                current.device_id = device.clone();
                tx.execute("UPDATE lineups SET deleted=1,revision=?2,updated_at=?3,document=?4 WHERE id=?1",rusqlite::params![id,current.revision,current.updated_at,serde_json::to_string(&current)?])?;
                report.imported += 1;
            }
            Some(raw) => {
                let mut old: Lineup = serde_json::from_str(&raw)?;
                old.revision = current.revision + 1;
                old.updated_at = now();
                old.device_id = device.clone();
                tx.execute("UPDATE lineups SET map_id=?2,agent_id=?3,ability_slot=?4,mode=?5,side=?6,updated_at=?7,revision=?8,deleted=?9,favorite=?10,draft=?11,import_batch_id=?12,document=?13 WHERE id=?1",rusqlite::params![id,old.map_id,old.agent_id,old.ability_slot,old.mode,serde_json::to_value(old.side)?.as_str(),old.updated_at,old.revision,old.deleted,old.is_favorite,old.draft,old.import_batch_id,serde_json::to_string(&old)?])?;
                report.overwritten += 1;
            }
        }
    }
    tx.execute("UPDATE import_batches SET undone=1 WHERE id=?1", [batch_id])?;
    tx.commit()?;
    Ok(report)
}

pub fn export(
    _db: &Database,
    store: &MediaStore,
    lineups: &[Lineup],
    options: &ExportOptions,
) -> Result<Vec<u8>> {
    let mut zip = zip::ZipWriter::new(Cursor::new(vec![]));
    let file_options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);
    let manifest = PackManifest {
        pack_id: new_id(),
        name: options.name.clone(),
        author: options.author.clone(),
        created_at: now(),
        description: options.description.clone(),
        ..Default::default()
    };
    zip.start_file("manifest.json", file_options)
        .map_err(|e| Error::Zip(e))?;
    zip.write_all(&serde_json::to_vec_pretty(&manifest)?)?;
    let mut paths = BTreeMap::new();
    let mut used = BTreeSet::new();
    for l in lineups {
        for hash in l.image_hashes() {
            if paths.contains_key(&hash) {
                continue;
            }
            let bytes = store.get(&hash)?;
            let mime = crate::storage::mime_for(&bytes);
            let ext = match mime {
                "image/jpeg" => "jpg",
                "image/png" => "png",
                "image/webp" => "webp",
                "video/webm" => "webm",
                _ => "mp4",
            };
            let path = unique_asset(&hash, &mut used, ext)?;
            paths.insert(hash.clone(), (path.clone(), bytes.clone(), mime));
            zip.start_file(&path, file_options)?;
            zip.write_all(&paths[&hash].1)?;
        }
    }
    for l in lineups {
        let mut refs = BTreeMap::new();
        let mut originals = JsonObject::new();
        for hash in l.image_hashes() {
            let (path, bytes, mime) = &paths[&hash];
            if options.legacy_compatible_images && *mime == "image/webp" {
                let jpg_path = unique_asset(&format!("{hash}-jpeg"), &mut used, "jpg")?;
                let img = image::load_from_memory(bytes)?;
                let mut out = vec![];
                let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 95);
                img.write_with_encoder(encoder)?;
                zip.start_file(&jpg_path, file_options)?;
                zip.write_all(&out)?;
                refs.insert(hash.clone(), jpg_path.clone());
                originals.insert(jpg_path, json!({"hash":hash,"path":path}));
            } else {
                refs.insert(hash.clone(), path.clone());
            }
        }
        let mut baked = JsonObject::new();
        if options.bake_annotations {
            for (slot, data) in &l.slots {
                if let Some(hash) = &data.image {
                    if !data.circles.is_empty() || !data.lines.is_empty() {
                        let bytes = store.get(hash)?;
                        let flattened = crate::render::flatten(&bytes, data)?;
                        let path = unique_asset(&hash_bytes(&flattened), &mut used, "png")?;
                        zip.start_file(&path, file_options)?;
                        zip.write_all(&flattened)?;
                        baked.insert(slot.as_str().to_string(), json!(path));
                    }
                }
            }
        }
        let document = legacy_document(l, &refs, &originals, &baked)?;
        zip.start_file(format!("lineups/{}.json", safe_id(&l.id)), file_options)?;
        zip.write_all(&serde_json::to_vec_pretty(&document)?)?;
    }
    let cursor = zip.finish()?;
    Ok(cursor.into_inner())
}
fn safe_id(id: &str) -> String {
    id.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}
fn unique_asset(seed: &str, used: &mut BTreeSet<String>, ext: &str) -> Result<String> {
    for n in 0u64..1_000_000 {
        let digest = hash_bytes(format!("{seed}:{n}").as_bytes());
        let path = format!("media/asset_{}.{ext}", &digest[..8]);
        if used.insert(path.clone()) {
            return Ok(path);
        }
    }
    Err(Error::Invalid("Too many asset-name collisions".into()))
}
fn restore_attrs(l: &Lineup) -> JsonObject {
    let mut attrs = l.attributes.clone();
    for (k, v) in &l.extensions.attribute_forms {
        attrs.insert(k.clone(), v.clone());
    }
    attrs
}
pub fn legacy_document(
    l: &Lineup,
    refs: &BTreeMap<String, String>,
    originals: &JsonObject,
    baked: &JsonObject,
) -> Result<Value> {
    let path = |hash: &Option<String>| {
        hash.as_ref()
            .and_then(|h| refs.get(h))
            .cloned()
            .map(Value::String)
            .unwrap_or(Value::Null)
    };
    let mut root = l.legacy.clone();
    root.insert("schemaVersion".into(), json!(1));
    root.insert("id".into(), json!(l.id));
    root.insert("title".into(), json!(l.title));
    root.insert("mapUuid".into(), json!(l.map_id));
    root.insert("agentUuid".into(), json!(l.agent_id));
    root.insert("abilitySlot".into(), json!(l.ability_slot));
    root.insert("side".into(), serde_json::to_value(l.side)?);
    root.insert("site".into(), json!(l.site));
    root.insert(
        "start".into(),
        l.stand1_pos
            .map(|p| serde_json::to_value(p).unwrap_or(Value::Null))
            .unwrap_or(Value::Null),
    );
    root.insert(
        "end".into(),
        l.land_pos
            .map(|p| serde_json::to_value(p).unwrap_or(Value::Null))
            .unwrap_or(Value::Null),
    );
    root.insert("bounces".into(), json!(l.bounces));
    for (k, v) in [
        ("throwType", &l.throw_type),
        ("difficulty", &l.difficulty),
        ("notes", &l.notes),
        ("author", &l.author),
        ("source", &l.source),
        ("createdAt", &l.created_at),
        ("updatedAt", &l.updated_at),
    ] {
        root.insert(k.into(), json!(v));
    }
    root.insert("tags".into(), json!(l.tags));
    root.insert("isFavorite".into(), json!(l.is_favorite));
    let mut attrs = restore_attrs(l);
    let mut slot_circles = JsonObject::new();
    for slot in SLOT_ORDER {
        slot_circles.insert(slot.as_str().into(), json!(l.slot(slot).circles));
    }
    attrs.insert("slotCircles".into(), Value::Object(slot_circles));
    attrs.insert("stand2Image".into(), path(&l.slot(Slot::Stand2).image));
    attrs.insert(
        "stand2Point".into(),
        l.stand2_pos
            .map(|p| serde_json::to_value(p).unwrap_or(Value::Null))
            .unwrap_or(Value::Null),
    );
    let mut projectiles = vec![];
    let mut throws = l.throws.clone();
    if throws.is_empty()
        && (l.slot(Slot::Aim1).image.is_some() || l.slot(Slot::Aim2).image.is_some())
    {
        for (i, slot) in [Slot::Aim1, Slot::Aim2].into_iter().enumerate() {
            if l.slot(slot).image.is_some() || i == 0 {
                throws.push(Throw {
                    index: i as u32,
                    label: format!("Throw {}", i + 1),
                    stand_image: l
                        .slot(if i == 0 { Slot::Stand1 } else { Slot::Stand2 })
                        .image
                        .clone(),
                    aim_image: l.slot(slot).image.clone(),
                    charge_stage: l.attribute_u32("chargeStage").unwrap_or(0),
                    charge_bars: l.attribute_u32("chargeBars").unwrap_or(0),
                    bounces: l.attribute_u32("bounces").unwrap_or(0),
                    throw_type: l.throw_type.clone(),
                    focus_circles: l.slot(slot).circles.clone(),
                    extra: JsonObject::new(),
                });
            }
        }
    }
    for t in &throws {
        let mut obj = t.extra.clone();
        let forms = l
            .extensions
            .extra
            .get("throwForms")
            .and_then(Value::as_object)
            .and_then(|m| m.get(&t.index.to_string()))
            .and_then(Value::as_object);
        obj.insert("index".into(), json!(t.index));
        obj.insert("label".into(), json!(t.label));
        obj.insert("aimImage".into(), path(&t.aim_image));
        obj.insert("standImage".into(), path(&t.stand_image));
        obj.insert(
            "chargeStage".into(),
            forms
                .and_then(|f| f.get("chargeStage"))
                .cloned()
                .unwrap_or(json!(t.charge_stage)),
        );
        obj.insert(
            "chargeBars".into(),
            forms
                .and_then(|f| f.get("chargeBars"))
                .cloned()
                .unwrap_or(json!(t.charge_bars)),
        );
        obj.insert(
            "bounces".into(),
            forms
                .and_then(|f| f.get("bounces"))
                .cloned()
                .unwrap_or(json!(t.bounces)),
        );
        obj.insert("throwType".into(), json!(t.throw_type));
        let canonical = if t.index == 0 {
            l.slot(Slot::Aim1)
        } else {
            l.slot(Slot::Aim2)
        };
        obj.insert("focusCircles".into(), json!(canonical.circles));
        projectiles.push(Value::Object(obj));
    }
    attrs.insert("projectiles".into(), json!(projectiles));
    root.insert("attributes".into(), Value::Object(attrs));
    let steps: Vec<Value> = l
        .steps
        .iter()
        .map(|s| {
            let mut o = s.extra.clone();
            o.insert("order".into(), json!(s.order));
            o.insert("text".into(), json!(s.text));
            o.insert("imageRef".into(), path(&s.image_ref));
            Value::Object(o)
        })
        .collect();
    root.insert("steps".into(), json!(steps));
    let mut media = l
        .legacy
        .get("media")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    media.insert("standImage".into(), path(&l.slot(Slot::Stand1).image));
    media.insert("aimImage".into(), path(&l.slot(Slot::Aim1).image));
    media.insert("landingImage".into(), path(&l.slot(Slot::Landing).image));
    media.insert(
        "videoClip".into(),
        l.video
            .as_ref()
            .map(|v| refs.get(&v.clip).cloned())
            .flatten()
            .map(Value::String)
            .unwrap_or(Value::Null),
    );
    media.insert(
        "videoThumbnail".into(),
        path(&l.video.as_ref().and_then(|v| v.thumbnail.clone())),
    );
    root.insert("media".into(), Value::Object(media));
    let mut x = l.extensions.extra.clone();
    x.remove("incomplete");
    x.remove("duplicateInPack");
    x.remove("originalMedia");
    x.remove("bakedImages");
    x.insert("mode".into(), json!(l.mode));
    x.insert("meta".into(),json!({"revision":l.revision,"deviceId":l.device_id,"deleted":l.deleted,"draft":l.draft,"importBatchId":l.import_batch_id}));
    let lines: JsonObject = SLOT_ORDER
        .into_iter()
        .filter(|s| !l.slot(*s).lines.is_empty())
        .map(|s| (s.as_str().into(), json!(l.slot(s).lines)))
        .collect();
    if !lines.is_empty() {
        x.insert("slotLines".into(), Value::Object(lines));
    }
    if !l.extensions.attribute_forms.is_empty() {
        x.insert(
            "attributeForms".into(),
            Value::Object(l.extensions.attribute_forms.clone()),
        );
    }
    if !originals.is_empty() {
        x.insert("originalMedia".into(), Value::Object(originals.clone()));
    }
    if !baked.is_empty() {
        x.insert("bakedImages".into(), Value::Object(baked.clone()));
    }
    let slot_extras: JsonObject = SLOT_ORDER
        .into_iter()
        .filter(|s| !l.slot(*s).extra.is_empty())
        .map(|s| (s.as_str().into(), Value::Object(l.slot(s).extra.clone())))
        .collect();
    if !slot_extras.is_empty() {
        x.insert("slotExtras".into(), Value::Object(slot_extras));
    }
    root.insert("x_lineuplab".into(), Value::Object(x));
    Ok(Value::Object(root))
}
pub fn inspect(bytes: &[u8]) -> Result<Value> {
    let archive = read_archive(bytes)?;
    let db = Database::memory()?;
    let p = preview(&archive, &db)?;
    Ok(
        json!({"manifest":p.manifest,"lineups":p.entries.len(),"media":p.media_count,"bytes":p.total_bytes,"warnings":p.warnings,"entries":p.entries}),
    )
}
