//! Portable overlay state. The Tauri shell creates the transparent/frameless/non-focusable/
//! always-on-top window; this module never touches the game process.
use crate::{Result, Slot, SLOT_ORDER};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Corner {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}
impl Corner {
    pub fn cycle(self) -> Self {
        match self {
            Self::TopLeft => Self::TopRight,
            Self::TopRight => Self::BottomRight,
            Self::BottomRight => Self::BottomLeft,
            Self::BottomLeft => Self::TopLeft,
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OverlayMode {
    Create,
    View,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlaySettings {
    pub enabled: bool,
    pub click_through: bool,
    pub corner: Corner,
    pub monitor: u32,
    pub margin_x: u32,
    pub margin_y: u32,
    pub width: u32,
    pub height: u32,
    pub opacity: f64,
}
impl Default for OverlaySettings {
    fn default() -> Self {
        Self {
            enabled: true,
            click_through: true,
            corner: Corner::TopRight,
            monitor: 0,
            margin_x: 24,
            margin_y: 24,
            width: 420,
            height: 320,
            opacity: 0.9,
        }
    }
}
impl OverlaySettings {
    pub fn clamp(&mut self) {
        self.opacity = self.opacity.clamp(0.2, 1.0);
        self.width = self.width.clamp(200, 1600);
        self.height = self.height.clamp(64, 2400);
    }
    /// Logical position within a monitor, honoring margins. Settings width/height/margins
    /// are CSS/logical pixels; native shells convert the result with the monitor scale factor.
    pub fn position(&self, screen_w: u32, screen_h: u32) -> (i32, i32) {
        let x = match self.corner {
            Corner::TopLeft | Corner::BottomLeft => self.margin_x as i32,
            _ => (screen_w.saturating_sub(self.width + self.margin_x)) as i32,
        };
        let y = match self.corner {
            Corner::TopLeft | Corner::TopRight => self.margin_y as i32,
            _ => (screen_h.saturating_sub(self.height + self.margin_y)) as i32,
        };
        (x.max(0), y.max(0))
    }

    /// Global physical rectangle for a monitor at `origin` with `monitor_size` physical pixels.
    /// Keeps the window inside that monitor, including mixed-DPI multi-monitor setups.
    pub fn physical_rect(
        &self,
        origin: (i32, i32),
        monitor_size: (u32, u32),
        scale_factor: f64,
    ) -> ((i32, i32), (u32, u32)) {
        let scale = if scale_factor.is_finite() && scale_factor > 0.0 {
            scale_factor
        } else {
            1.0
        };
        let logical_w = ((monitor_size.0 as f64) / scale).floor().max(1.0) as u32;
        let logical_h = ((monitor_size.1 as f64) / scale).floor().max(1.0) as u32;
        let mut effective = self.clone();
        effective.width = self.width.min(logical_w);
        effective.height = self.height.min(logical_h);
        let (x, y) = effective.position(logical_w, logical_h);
        let w =
            (((effective.width as f64) * scale).round().max(1.0) as u32).min(monitor_size.0.max(1));
        let h = (((effective.height as f64) * scale).round().max(1.0) as u32)
            .min(monitor_size.1.max(1));
        let max_x = origin
            .0
            .saturating_add(monitor_size.0 as i32)
            .saturating_sub(w as i32);
        let max_y = origin
            .1
            .saturating_add(monitor_size.1 as i32)
            .saturating_sub(h as i32);
        let px = origin
            .0
            .saturating_add(((x as f64) * scale).round() as i32)
            .clamp(origin.0, max_x.max(origin.0));
        let py = origin
            .1
            .saturating_add(((y as f64) * scale).round() as i32)
            .clamp(origin.1, max_y.max(origin.1));
        ((px, py), (w, h))
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistItem {
    pub slot: Slot,
    pub label: String,
    pub required: bool,
    pub done: bool,
    pub skipped: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayState {
    pub settings: OverlaySettings,
    pub visible: bool,
    pub mode: OverlayMode,
    pub show_checklist: bool,
    pub checklist: Vec<ChecklistItem>,
    pub view_slots: Vec<Slot>,
    pub view_index: usize,
    pub flipped: bool,
    /// Browse order for Alt+Up/Alt+Down lineup stepping. Defaults to empty so
    /// overlay.json files written before Preview 8 still load untouched.
    #[serde(default)]
    pub lineup_order: Vec<String>,
}
impl Default for OverlayState {
    fn default() -> Self {
        Self {
            settings: OverlaySettings::default(),
            visible: true,
            mode: OverlayMode::Create,
            show_checklist: true,
            checklist: vec![],
            view_slots: vec![],
            view_index: 0,
            flipped: false,
            lineup_order: vec![],
        }
    }
}
/// A capture that can be shown as a step: present and not blank.
fn step_image(lineup: &crate::Lineup, slot: Slot) -> Option<&str> {
    lineup
        .slot(slot)
        .image
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

/// True when this lineup actually has a second throw. The mode's required slots
/// are authoritative; saved throws, double-shock attributes, legacy `double`
/// mode ids and a distinct second aim image also prove it. Single-throw lineups
/// never gain a phantom second stand from leftover or duplicated data.
pub fn has_second_throw(lineup: &crate::Lineup, required: &[Slot]) -> bool {
    if required.contains(&Slot::Aim2) || required.contains(&Slot::Stand2) {
        return true;
    }
    if lineup.throws.iter().any(|t| t.index >= 2) {
        return true;
    }
    let flag = |key: &str| {
        lineup
            .attributes
            .get(key)
            .is_some_and(|v| v.as_bool() == Some(true) || v.as_f64().is_some_and(|n| n > 0.0))
    };
    if flag("doubleShock") || flag("hasSecondStand") || flag("secondThrow") {
        return true;
    }
    if lineup.mode.to_ascii_lowercase().contains("double") {
        return true;
    }
    match step_image(lineup, Slot::Aim2) {
        Some(aim2) => step_image(lineup, Slot::Aim1) != Some(aim2),
        None => false,
    }
}

/// Learn-mode steps: only captured, distinct pictures that belong to this
/// lineup. A second stand that repeats the first image (or belongs to a
/// single-throw lineup) is not a step, and neither is any other duplicate.
/// Stored data is never modified.
pub fn learn_slots(lineup: &crate::Lineup, required: &[Slot]) -> Vec<Slot> {
    let second = has_second_throw(lineup, required);
    let mut seen: Vec<&str> = Vec::new();
    let mut out = Vec::new();
    for slot in SLOT_ORDER {
        let Some(image) = step_image(lineup, slot) else {
            continue;
        };
        if matches!(slot, Slot::Stand2 | Slot::Aim2) && !second {
            continue;
        }
        if seen.contains(&image) {
            continue;
        }
        seen.push(image);
        out.push(slot);
    }
    out
}

impl OverlayState {
    pub fn toggle_visible(&mut self) {
        self.visible = !self.visible;
    }
    /// Alt+O temporarily disables click-through so the overlay can be dragged/configured.
    pub fn controls(&mut self) {
        self.settings.click_through = !self.settings.click_through;
        self.visible = true;
    }
    pub fn set_opacity(&mut self, v: f64) {
        self.settings.opacity = v;
        self.settings.clamp();
    }
    pub fn toggle_mode(&mut self) {
        self.mode = match self.mode {
            OverlayMode::Create => OverlayMode::View,
            OverlayMode::View => OverlayMode::Create,
        };
        self.flipped = false;
    }
    pub fn update_checklist(
        &mut self,
        lineup: &crate::Lineup,
        required: &[Slot],
        skipped: &[Slot],
    ) {
        let second = has_second_throw(lineup, required);
        let steps = learn_slots(lineup, required);
        self.checklist = SLOT_ORDER
            .into_iter()
            .filter(|s| {
                required.contains(s)
                    || matches!(s, Slot::Stand1 | Slot::Aim1 | Slot::Landing)
                    // An optional second stand/aim only earns a row when this
                    // lineup really has a second throw and the capture is its
                    // own picture rather than a copy of the first one.
                    || (second && steps.contains(s))
            })
            .map(|slot| ChecklistItem {
                slot,
                label: slot.label().into(),
                required: required.contains(&slot),
                done: lineup.slot(slot).image.is_some(),
                skipped: skipped.contains(&slot),
            })
            .collect();
    }
    pub fn set_view_lineup(&mut self, lineup: &crate::Lineup, required: &[Slot]) {
        self.view_slots = learn_slots(lineup, required);
        self.view_index = 0;
    }
    /// Replace the Alt+Up/Alt+Down order with what Browse is currently showing.
    /// Blank ids and repeats are dropped; the first occurrence wins.
    pub fn set_lineup_order(&mut self, ids: impl IntoIterator<Item = String>) {
        let mut next: Vec<String> = Vec::new();
        for id in ids {
            if !id.trim().is_empty() && !next.contains(&id) {
                next.push(id);
            }
        }
        self.lineup_order = next;
    }
    /// Next/previous lineup id, wrapping at both ends. An unknown or missing
    /// current id starts at the first (down) or last (up) entry.
    pub fn step_lineup(&self, current: Option<&str>, forward: bool) -> Option<String> {
        let len = self.lineup_order.len();
        if len == 0 {
            return None;
        }
        let index = match current.and_then(|id| self.lineup_order.iter().position(|x| x == id)) {
            Some(i) => {
                if forward {
                    (i + 1) % len
                } else {
                    (i + len - 1) % len
                }
            }
            None => {
                if forward {
                    0
                } else {
                    len - 1
                }
            }
        };
        self.lineup_order.get(index).cloned()
    }
    pub fn view_next(&mut self) {
        if !self.view_slots.is_empty() {
            self.view_index = (self.view_index + 1) % self.view_slots.len();
        }
    }
    pub fn view_prev(&mut self) {
        if !self.view_slots.is_empty() {
            self.view_index = (self.view_index + self.view_slots.len() - 1) % self.view_slots.len();
        }
    }
    pub fn current_view_slot(&self) -> Option<Slot> {
        self.view_slots.get(self.view_index).copied()
    }
    pub fn flip(&mut self) {
        self.flipped = !self.flipped;
    }
    pub fn validate(&self) -> Result<()> {
        if !(0.2..=1.0).contains(&self.settings.opacity) {
            return Err(crate::Error::Invalid(
                "Overlay opacity must be 0.2–1.0".into(),
            ));
        }
        Ok(())
    }
}
