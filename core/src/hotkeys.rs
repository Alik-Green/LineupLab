//! Rebindable Alt-hotkey registry. Platform global registration lives behind `HotkeyProvider`.
use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyBinding {
    pub action: String,
    pub label: String,
    pub keys: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyConfig {
    pub version: u32,
    pub bindings: Vec<HotkeyBinding>,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum HotkeyFeedback {
    Ok { message: String },
    Conflict { message: String, action: String },
    Invalid { message: String },
}
impl HotkeyFeedback {
    pub fn is_ok(&self) -> bool {
        matches!(self, Self::Ok { .. })
    }
}

pub fn default_bindings() -> Vec<HotkeyBinding> {
    let rows = [
        ("capture", "Capture current slot", "Alt+C"),
        ("crosshair_circle", "Crosshair circle (Alt+X)", "Alt+X"),
        ("retake", "Retake last capture", "Alt+R"),
        ("next_slot", "Next slot", "Alt+N"),
        ("prev_slot", "Previous slot", "Alt+P"),
        ("slot_stand1", "Select stand", "Alt+1"),
        ("slot_aim1", "Select aim", "Alt+2"),
        ("slot_stand2", "Select second stand", "Alt+3"),
        ("slot_aim2", "Select second aim", "Alt+4"),
        ("slot_landing", "Select landing", "Alt+5"),
        ("save", "Save lineup", "Alt+S"),
        ("save_next", "Save & next", "Alt+Shift+S"),
        ("discard", "Discard draft", "Alt+D"),
        ("undo", "Undo", "Alt+Z"),
        ("redo", "Redo", "Alt+Y"),
        ("overlay_toggle", "Show/hide overlay", "Alt+V"),
        (
            "overlay_controls",
            "Overlay controls (disable click-through)",
            "Alt+O",
        ),
        ("overlay_mode", "Toggle Create/Learn overlay mode", "Alt+M"),
        ("overlay_minimal", "Toggle minimal overlay", "Alt+I"),
        ("view_next", "Learn: next image", "Alt+Right"),
        ("view_prev", "Learn: previous image", "Alt+Left"),
        ("lineup_next", "Learn: next lineup", "Alt+Down"),
        ("lineup_prev", "Learn: previous lineup", "Alt+Up"),
        ("view_flip", "Learn: flip steps/map", "Alt+F"),
        ("checklist_toggle", "Create: toggle checklist", "Alt+H"),
    ];
    rows.into_iter()
        .map(|(action, label, keys)| HotkeyBinding {
            action: action.into(),
            label: label.into(),
            keys: normalize(keys).unwrap(),
        })
        .collect()
}
impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            version: 1,
            bindings: default_bindings(),
        }
    }
}
/// Canonical modifier order: Ctrl+Alt+Shift+Meta+Key. Alt is mandatory.
pub fn normalize(keys: &str) -> Result<String> {
    let mut mods = Vec::new();
    let mut key = None;
    for part in keys.split('+').map(str::trim).filter(|p| !p.is_empty()) {
        match part.to_ascii_lowercase().as_str() {
            "alt" => mods.push("Alt"),
            "ctrl" | "control" => mods.push("Ctrl"),
            "shift" => mods.push("Shift"),
            "meta" | "cmd" | "super" | "win" => mods.push("Meta"),
            _ => {
                if key.is_some() {
                    return Err(Error::Invalid(format!("Multiple keys in hotkey: {keys}")));
                }
                key = Some(canonical_key(part)?);
            }
        }
    }
    if !mods.contains(&"Alt") {
        return Err(Error::Invalid("Hotkeys must include Alt".into()));
    }
    let key = key.ok_or_else(|| Error::Invalid("Hotkey needs a key".into()))?;
    mods.sort();
    mods.dedup();
    mods.push(&key);
    Ok(mods.join("+"))
}
fn canonical_key(part: &str) -> Result<String> {
    let lower = part.to_ascii_lowercase();
    let named = match lower.as_str() {
        "left" | "arrowleft" => "Left",
        "right" | "arrowright" => "Right",
        "up" | "arrowup" => "Up",
        "down" | "arrowdown" => "Down",
        "space" => "Space",
        "enter" | "return" => "Enter",
        "tab" => "Tab",
        "esc" | "escape" => "Escape",
        "backspace" => "Backspace",
        "delete" | "del" => "Delete",
        "insert" => "Insert",
        "home" => "Home",
        "end" => "End",
        "pageup" => "PageUp",
        "pagedown" => "PageDown",
        "plus" => "Plus",
        "minus" => "Minus",
        "comma" => "Comma",
        "period" => "Period",
        "slash" => "Slash",
        "backslash" => "Backslash",
        "semicolon" => "Semicolon",
        "quote" => "Quote",
        "bracketleft" => "BracketLeft",
        "bracketright" => "BracketRight",
        _ => "",
    };
    if !named.is_empty() {
        return Ok(named.into());
    }
    if lower.starts_with('f')
        && lower[1..]
            .parse::<u8>()
            .is_ok_and(|n| (1..=24).contains(&n))
    {
        return Ok(format!("F{}", lower[1..].parse::<u8>().unwrap()));
    }
    if part.chars().count() == 1 {
        let c = part.chars().next().unwrap();
        if c.is_ascii_alphanumeric() {
            return Ok(c.to_ascii_uppercase().to_string());
        }
    }
    Err(Error::Invalid(format!("Unsupported hotkey key: {part}")))
}
impl HotkeyConfig {
    pub fn validate(&self) -> Result<()> {
        let mut seen = BTreeMap::new();
        for b in &self.bindings {
            let k = normalize(&b.keys)?;
            if let Some(other) = seen.insert(k, &b.action) {
                return Err(Error::Invalid(format!(
                    "Hotkey conflict: {} and {} both use {}",
                    other, b.action, b.keys
                )));
            }
        }
        Ok(())
    }
    pub fn conflict(&self, keys: &str, except_action: &str) -> Option<&HotkeyBinding> {
        let k = normalize(keys).ok()?;
        self.bindings.iter().find(|b| {
            b.action != except_action && normalize(&b.keys).ok().as_deref() == Some(k.as_str())
        })
    }
    pub fn rebind(&mut self, action: &str, keys: &str) -> HotkeyFeedback {
        let keys = match normalize(keys) {
            Ok(k) => k,
            Err(e) => {
                return HotkeyFeedback::Invalid {
                    message: e.to_string(),
                }
            }
        };
        if let Some(other) = self.conflict(&keys, action) {
            return HotkeyFeedback::Conflict {
                message: format!("{} already uses {}", other.label, other.keys),
                action: other.action.clone(),
            };
        }
        match self.bindings.iter_mut().find(|b| b.action == action) {
            Some(b) => {
                b.keys = keys.clone();
                HotkeyFeedback::Ok {
                    message: format!("{} bound to {}", b.label, keys),
                }
            }
            None => HotkeyFeedback::Invalid {
                message: format!("Unknown action {action}"),
            },
        }
    }
    pub fn action_for(&self, keys: &str) -> Option<&str> {
        let k = normalize(keys).ok()?;
        self.bindings
            .iter()
            .find(|b| normalize(&b.keys).ok().as_deref() == Some(k.as_str()))
            .map(|b| b.action.as_str())
    }
}
/// Platform adapter contract. Windows uses global shortcuts; tests use the mock.
pub trait HotkeyProvider: Send + Sync {
    fn register(&mut self, keys: &str, action: &str) -> Result<()>;
    fn unregister(&mut self, keys: &str) -> Result<()>;
    fn registered(&self) -> Vec<(String, String)>;
}
#[derive(Default)]
pub struct MockHotkeyProvider {
    pub map: BTreeMap<String, String>,
    pub presses: Vec<String>,
}
impl HotkeyProvider for MockHotkeyProvider {
    fn register(&mut self, keys: &str, action: &str) -> Result<()> {
        let k = normalize(keys)?;
        if let Some(old) = self.map.get(&k) {
            if old != action {
                return Err(Error::Invalid(format!("Hotkey already registered: {k}")));
            }
        }
        self.map.insert(k, action.into());
        Ok(())
    }
    fn unregister(&mut self, keys: &str) -> Result<()> {
        self.map.remove(&normalize(keys)?);
        Ok(())
    }
    fn registered(&self) -> Vec<(String, String)> {
        self.map
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    }
}
impl MockHotkeyProvider {
    pub fn press(&mut self, keys: &str) -> Option<String> {
        let k = normalize(keys).ok()?;
        self.presses.push(k.clone());
        self.map.get(&k).cloned()
    }
}
