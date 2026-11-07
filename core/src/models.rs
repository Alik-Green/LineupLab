use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

pub const SLOT_ORDER: [Slot; 5] = [
    Slot::Stand1,
    Slot::Aim1,
    Slot::Stand2,
    Slot::Aim2,
    Slot::Landing,
];
pub type JsonObject = Map<String, Value>;
pub static EMPTY_SLOT: std::sync::LazyLock<SlotData> = std::sync::LazyLock::new(SlotData::default);

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Slot {
    Stand1,
    Aim1,
    Stand2,
    Aim2,
    Landing,
}
impl Slot {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stand1 => "stand1",
            Self::Aim1 => "aim1",
            Self::Stand2 => "stand2",
            Self::Aim2 => "aim2",
            Self::Landing => "landing",
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Self::Stand1 => "Stand",
            Self::Aim1 => "Aim",
            Self::Stand2 => "Second stand",
            Self::Aim2 => "Second aim",
            Self::Landing => "Landing",
        }
    }
    pub fn is_aim(self) -> bool {
        matches!(self, Self::Aim1 | Self::Aim2)
    }
}
impl std::fmt::Display for Slot {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}
impl std::str::FromStr for Slot {
    type Err = crate::Error;
    fn from_str(s: &str) -> crate::Result<Self> {
        match s {
            "stand1" => Ok(Self::Stand1),
            "aim1" => Ok(Self::Aim1),
            "stand2" => Ok(Self::Stand2),
            "aim2" => Ok(Self::Aim2),
            "landing" => Ok(Self::Landing),
            _ => Err(crate::Error::Invalid(format!("Unknown slot: {s}"))),
        }
    }
}
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Attack,
    Defense,
    #[default]
    Both,
}
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Point {
    pub x: f64,
    pub y: f64,
}
impl Point {
    pub fn finite(self) -> bool {
        self.x.is_finite() && self.y.is_finite()
    }
    pub fn clamped(self) -> Self {
        Self {
            x: self.x.clamp(0., 1.),
            y: self.y.clamp(0., 1.),
        }
    }
    pub fn distance(self, other: Self) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }
}
fn uid() -> String {
    uuid::Uuid::new_v4().to_string()
}
fn default_zoom() -> f64 {
    3.5
}
fn default_zoom_size() -> f64 {
    0.24
}

/// Legacy field names are intentional. All coordinates are normalized to image width/height.
/// Lens inset placement is top-left; see DECISIONS.md for fixture limitations.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusCircle {
    #[serde(default = "uid")]
    pub id: String,
    #[serde(default = "default_color")]
    pub color: String,
    pub x: f64,
    pub y: f64,
    pub radius: f64,
    #[serde(default)]
    pub show_zoom: bool,
    #[serde(default = "default_zoom")]
    pub zoom_scale: f64,
    #[serde(default = "default_zoom_size")]
    pub zoom_size: f64,
    #[serde(default)]
    pub zoom_x: f64,
    #[serde(default)]
    pub zoom_y: f64,
    #[serde(flatten, default)]
    pub extra: JsonObject,
}
pub fn default_color() -> String {
    "cyan".into()
}
impl FocusCircle {
    pub fn at(x: f64, y: f64, radius: f64, lens: bool) -> Self {
        Self {
            id: uid(),
            color: default_color(),
            x,
            y,
            radius,
            show_zoom: lens,
            zoom_scale: 3.5,
            zoom_size: 0.24,
            zoom_x: 0.72,
            zoom_y: 0.04,
            extra: JsonObject::new(),
        }
    }
}
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineStyle {
    #[default]
    Solid,
    Dashed,
    Dotted,
}
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Arrow {
    #[default]
    None,
    End,
    Start,
    Both,
}
fn default_width() -> f64 {
    0.003
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnotationLine {
    #[serde(default = "uid")]
    pub id: String,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default = "default_width")]
    pub width: f64,
    pub points: Vec<Point>,
    #[serde(default)]
    pub style: LineStyle,
    #[serde(default)]
    pub arrow: Arrow,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(flatten, default)]
    pub extra: JsonObject,
}
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlotData {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(default)]
    pub circles: Vec<FocusCircle>,
    #[serde(default)]
    pub lines: Vec<AnnotationLine>,
    #[serde(flatten, default)]
    pub extra: JsonObject,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Throw {
    pub index: u32,
    #[serde(default)]
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stand_image: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aim_image: Option<String>,
    #[serde(default)]
    pub charge_stage: u32,
    #[serde(default)]
    pub charge_bars: u32,
    #[serde(default)]
    pub bounces: u32,
    #[serde(default)]
    pub throw_type: String,
    #[serde(default)]
    pub focus_circles: Vec<FocusCircle>,
    #[serde(flatten, default)]
    pub extra: JsonObject,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Step {
    pub order: u32,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_ref: Option<String>,
    #[serde(flatten, default)]
    pub extra: JsonObject,
}
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Video {
    pub clip: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    #[serde(flatten, default)]
    pub extra: JsonObject,
}
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Extensions {
    #[serde(default)]
    pub slot_lines: BTreeMap<Slot, Vec<AnnotationLine>>,
    /// Original JSON types of numeric/boolean attribute strings, retained for lossless export.
    #[serde(default)]
    pub attribute_forms: JsonObject,
    #[serde(default)]
    pub baked_images: BTreeMap<String, String>,
    #[serde(flatten)]
    pub extra: JsonObject,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lineup {
    pub id: String,
    pub map_id: String,
    pub agent_id: String,
    pub ability_slot: String,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default)]
    pub side: Side,
    #[serde(default)]
    pub site: String,
    #[serde(default)]
    pub difficulty: String,
    #[serde(default)]
    pub throw_type: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub is_favorite: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted: bool,
    pub device_id: String,
    #[serde(default)]
    pub revision: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub import_batch_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stand1_pos: Option<Point>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stand2_pos: Option<Point>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub land_pos: Option<Point>,
    #[serde(default)]
    pub bounces: Vec<Point>,
    pub slots: BTreeMap<Slot, SlotData>,
    #[serde(default)]
    pub throws: Vec<Throw>,
    #[serde(default)]
    pub attributes: JsonObject,
    #[serde(default)]
    pub steps: Vec<Step>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video: Option<Video>,
    #[serde(default)]
    pub legacy: JsonObject,
    #[serde(default)]
    pub extensions: Extensions,
    #[serde(default)]
    pub draft: bool,
}
pub fn default_mode() -> String {
    "standard".into()
}
pub fn now() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}
impl Lineup {
    pub fn new(map_id: String, agent_id: String, ability_slot: String, device_id: String) -> Self {
        let now = now();
        Self {
            id: uid(),
            map_id,
            agent_id,
            ability_slot,
            mode: default_mode(),
            side: Side::Both,
            site: String::new(),
            difficulty: "medium".into(),
            throw_type: "normal".into(),
            title: String::new(),
            notes: String::new(),
            tags: vec![],
            author: String::new(),
            source: String::new(),
            is_favorite: false,
            created_at: now.clone(),
            updated_at: now,
            deleted: false,
            device_id,
            revision: 0,
            import_batch_id: None,
            stand1_pos: None,
            stand2_pos: None,
            land_pos: None,
            bounces: vec![],
            slots: SLOT_ORDER
                .into_iter()
                .map(|s| (s, SlotData::default()))
                .collect(),
            throws: vec![],
            attributes: JsonObject::new(),
            steps: vec![],
            video: None,
            legacy: JsonObject::new(),
            extensions: Extensions::default(),
            draft: false,
        }
    }
    pub fn slot(&self, slot: Slot) -> &SlotData {
        self.slots.get(&slot).unwrap_or(&EMPTY_SLOT)
    }
    pub fn slot_mut(&mut self, slot: Slot) -> &mut SlotData {
        self.slots.entry(slot).or_default()
    }
    pub fn preview_hash(&self) -> Option<&str> {
        [
            Slot::Landing,
            Slot::Aim2,
            Slot::Aim1,
            Slot::Stand1,
            Slot::Stand2,
        ]
        .iter()
        .find_map(|s| self.slots.get(s)?.image.as_deref())
        .or_else(|| {
            self.throws
                .iter()
                .rev()
                .find_map(|t| t.aim_image.as_deref())
        })
        .or_else(|| self.steps.iter().find_map(|s| s.image_ref.as_deref()))
    }
    pub fn image_hashes(&self) -> Vec<String> {
        let mut hashes: Vec<_> = self
            .slots
            .values()
            .filter_map(|s| s.image.clone())
            .collect();
        hashes.extend(self.throws.iter().flat_map(|t| {
            [t.stand_image.clone(), t.aim_image.clone()]
                .into_iter()
                .flatten()
        }));
        hashes.extend(self.steps.iter().filter_map(|s| s.image_ref.clone()));
        if let Some(v) = &self.video {
            hashes.push(v.clip.clone());
            hashes.extend(v.thumbnail.clone());
        }
        hashes.extend(self.extensions.baked_images.values().cloned());
        hashes.sort();
        hashes.dedup();
        hashes
    }
    pub fn attribute_u32(&self, key: &str) -> Option<u32> {
        match self.attributes.get(key)? {
            Value::Number(n) => n.as_u64().and_then(|n| u32::try_from(n).ok()),
            Value::String(s) => s.trim().parse().ok(),
            _ => None,
        }
    }
    pub fn attribute_bool(&self, key: &str) -> bool {
        match self.attributes.get(key) {
            Some(Value::Bool(b)) => *b,
            Some(Value::String(s)) => {
                matches!(s.to_ascii_lowercase().as_str(), "true" | "1" | "yes")
            }
            Some(Value::Number(n)) => n.as_f64().is_some_and(|n| n != 0.),
            _ => false,
        }
    }
}
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineupFilter {
    pub map_id: Option<String>,
    pub agent_id: Option<String>,
    pub ability_slot: Option<String>,
    pub search: Option<String>,
    pub side: Option<Side>,
    pub favorites: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub include_drafts: Option<bool>,
    pub include_deleted: Option<bool>,
    pub ids: Option<Vec<String>>,
}
