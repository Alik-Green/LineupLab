use crate::{Result, Slot};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbilityMode {
    pub id: String,
    pub label: String,
    pub required_slots: Vec<Slot>,
    #[serde(default)]
    pub optional_slots: Vec<Slot>,
    #[serde(default)]
    pub attributes: Map<String, Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModeRule {
    pub agent: String,
    pub ability: String,
    pub modes: Vec<AbilityMode>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModeConfig {
    pub version: u32,
    pub defaults: Vec<AbilityMode>,
    pub rules: Vec<ModeRule>,
}
impl ModeConfig {
    pub fn load() -> Result<Self> {
        Ok(serde_json::from_str(include_str!(
            "../data/ability_modes.json"
        ))?)
    }
    pub fn modes(&self, agent: &str, slot: &str) -> Vec<AbilityMode> {
        self.rules
            .iter()
            .find(|r| {
                (r.agent == agent || r.agent == "*") && (r.ability == slot || r.ability == "*")
            })
            .map_or_else(|| self.defaults.clone(), |r| r.modes.clone())
    }
    pub fn mode(&self, agent: &str, slot: &str, id: &str) -> Option<AbilityMode> {
        self.modes(agent, slot).into_iter().find(|m| m.id == id)
    }
    pub fn validate(&self) -> Result<()> {
        for rule in &self.rules {
            for mode in &rule.modes {
                if mode.required_slots.contains(&Slot::Stand2)
                    && !mode.required_slots.contains(&Slot::Aim2)
                {
                    return Err(crate::Error::Invalid("stand2 requires aim2".into()));
                }
                if mode.required_slots.contains(&Slot::Aim2)
                    && !mode.required_slots.contains(&Slot::Aim1)
                {
                    return Err(crate::Error::Invalid("aim2 requires aim1".into()));
                }
                if mode.optional_slots.contains(&Slot::Stand2)
                    && !(mode.required_slots.contains(&Slot::Aim2)
                        || mode.optional_slots.contains(&Slot::Aim2))
                {
                    return Err(crate::Error::Invalid(
                        "optional stand2 requires aim2".into(),
                    ));
                }
            }
        }
        Ok(())
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineupAbilityRule {
    pub agent: String,
    pub slots: BTreeMap<String, bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineupAbilityConfig {
    pub version: u32,
    pub rules: Vec<LineupAbilityRule>,
}
impl LineupAbilityConfig {
    pub fn load() -> Result<Self> {
        Ok(serde_json::from_str(include_str!(
            "../data/lineup_abilities.json"
        ))?)
    }
    pub fn enabled(&self, agent: &str, slot: &str, overrides: &Value) -> bool {
        if let Some(b) = overrides
            .get(agent)
            .and_then(|v| v.get(slot))
            .and_then(Value::as_bool)
        {
            return b;
        }
        self.rules
            .iter()
            .find(|r| r.agent == agent)
            .or_else(|| self.rules.iter().find(|r| r.agent == "*"))
            .and_then(|r| r.slots.get(slot).copied())
            .unwrap_or(false)
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapCalibration {
    pub map_id: String,
    pub xx: f64,
    pub xy: f64,
    pub yx: f64,
    pub yy: f64,
    pub tx: f64,
    pub ty: f64,
}
impl MapCalibration {
    pub fn apply(&self, p: crate::Point) -> crate::Point {
        crate::Point {
            x: self.xx * p.x + self.xy * p.y + self.tx,
            y: self.yx * p.x + self.yy * p.y + self.ty,
        }
        .clamped()
    }
}
pub fn calibrations() -> Result<Vec<MapCalibration>> {
    Ok(serde_json::from_str(include_str!(
        "../data/map_calibration.json"
    ))?)
}
