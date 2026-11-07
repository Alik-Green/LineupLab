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
        self.height = self.height.clamp(160, 1400);
    }
    /// Physical position within a monitor work area, honoring margins.
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
        }
    }
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
        self.checklist = SLOT_ORDER
            .into_iter()
            .filter(|s| {
                required.contains(s)
                    || matches!(s, Slot::Stand1 | Slot::Aim1 | Slot::Landing)
                    || lineup.slot(*s).image.is_some()
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
    pub fn set_view_lineup(&mut self, lineup: &crate::Lineup) {
        self.view_slots = SLOT_ORDER
            .into_iter()
            .filter(|s| lineup.slot(*s).image.is_some())
            .collect();
        self.view_index = 0;
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
