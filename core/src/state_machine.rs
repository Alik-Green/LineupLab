use crate::{
    capture::CaptureProvider, config::ModeConfig, Error, Lineup, Point, Result, Slot, SLOT_ORDER,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftState {
    pub lineup: Lineup,
    pub active_slot: Slot,
    #[serde(skip)]
    pub undo: Vec<(Lineup, Slot)>,
    #[serde(skip)]
    pub redo: Vec<(Lineup, Slot)>,
    pub skipped: Vec<Slot>,
    pub last_captured: Option<Slot>,
}
impl DraftState {
    pub fn new(lineup: Lineup) -> Self {
        Self {
            lineup,
            active_slot: Slot::Stand1,
            undo: vec![],
            redo: vec![],
            skipped: vec![],
            last_captured: None,
        }
    }
    fn checkpoint(&mut self) {
        self.undo.push((self.lineup.clone(), self.active_slot));
        if self.undo.len() > 100 {
            self.undo.remove(0);
        }
        self.redo.clear();
    }
    pub fn set_image(&mut self, slot: Slot, hash: Option<String>) {
        self.checkpoint();
        self.lineup.slot_mut(slot).image = hash;
        self.skipped.retain(|s| *s != slot);
        if self.lineup.slot(slot).image.is_some() {
            self.last_captured = Some(slot);
        }
    }
    pub fn select(&mut self, slot: Slot) {
        self.active_slot = slot;
    }
    pub fn skip(&mut self) -> Result<()> {
        if self.required()?.contains(&self.active_slot) {
            return Err(Error::Invalid("Required slots cannot be skipped".into()));
        }
        if !self.skipped.contains(&self.active_slot) {
            self.skipped.push(self.active_slot);
        }
        self.next();
        Ok(())
    }
    pub fn next(&mut self) {
        if let Some(s) = self
            .visible_slots()
            .into_iter()
            .find(|s| self.lineup.slot(*s).image.is_none() && !self.skipped.contains(s))
        {
            self.active_slot = s;
        }
    }
    pub fn capture(
        &mut self,
        provider: &mut dyn CaptureProvider,
        store: &crate::storage::MediaStore,
        width: u32,
        quality: u8,
    ) -> Result<Slot> {
        let raw = provider.capture()?;
        let (bytes, _) = crate::storage::MediaStore::encode_capture(&raw, width, quality, false)?;
        let hash = store.put(&bytes)?;
        let slot = self.active_slot;
        self.set_image(slot, Some(hash));
        self.next();
        Ok(slot)
    }
    pub fn retake(
        &mut self,
        provider: &mut dyn CaptureProvider,
        store: &crate::storage::MediaStore,
        width: u32,
        quality: u8,
    ) -> Result<Slot> {
        let slot = self.last_captured.unwrap_or(self.active_slot);
        self.active_slot = slot;
        self.capture(provider, store, width, quality)
    }
    pub fn undo(&mut self) -> bool {
        if let Some((l, s)) = self.undo.pop() {
            self.redo.push((self.lineup.clone(), self.active_slot));
            self.lineup = l;
            self.active_slot = s;
            true
        } else {
            false
        }
    }
    pub fn redo(&mut self) -> bool {
        if let Some((l, s)) = self.redo.pop() {
            self.undo.push((self.lineup.clone(), self.active_slot));
            self.lineup = l;
            self.active_slot = s;
            true
        } else {
            false
        }
    }
    pub fn required(&self) -> Result<Vec<Slot>> {
        let cfg = ModeConfig::load()?;
        Ok(cfg
            .mode(
                &self.lineup.agent_id,
                &self.lineup.ability_slot,
                &self.lineup.mode,
            )
            .or_else(|| cfg.mode("*", &self.lineup.ability_slot, &self.lineup.mode))
            .map(|m| m.required_slots)
            .unwrap_or_else(|| vec![Slot::Stand1, Slot::Aim1, Slot::Landing]))
    }
    pub fn visible_slots(&self) -> Vec<Slot> {
        let required = self
            .required()
            .unwrap_or_else(|_| vec![Slot::Stand1, Slot::Aim1, Slot::Landing]);
        let has_aim2 =
            required.contains(&Slot::Aim2) || self.lineup.slot(Slot::Aim2).image.is_some();
        SLOT_ORDER
            .into_iter()
            .filter(|s| {
                required.contains(s)
                    || match s {
                        Slot::Stand2 => has_aim2,
                        Slot::Aim1 => true,
                        _ => false,
                    }
            })
            .collect()
    }
    pub fn switch_mode(&mut self, id: &str, cfg: &ModeConfig) -> Result<()> {
        let mode = cfg
            .mode(&self.lineup.agent_id, &self.lineup.ability_slot, id)
            .or_else(|| cfg.mode("*", &self.lineup.ability_slot, id))
            .ok_or_else(|| Error::Invalid(format!("Unknown mode {id}")))?;
        self.checkpoint();
        self.lineup.mode = id.to_string();
        for (k, v) in mode.attributes {
            self.lineup.attributes.insert(k, v);
        }
        self.lineup.extensions.attribute_forms.clear();
        self.skipped.clear();
        self.next();
        Ok(())
    }
    pub fn set_pin(&mut self, slot: Slot, p: Point) -> Result<()> {
        if !p.finite() {
            return Err(Error::Invalid("Pin must be finite".into()));
        }
        self.checkpoint();
        let p = p.clamped();
        match slot {
            Slot::Stand1 => self.lineup.stand1_pos = Some(p),
            Slot::Stand2 => self.lineup.stand2_pos = Some(p),
            Slot::Landing => self.lineup.land_pos = Some(p),
            _ => {
                return Err(Error::Invalid(
                    "Only stand and landing pins are supported".into(),
                ))
            }
        }
        Ok(())
    }
    pub fn validate_save(&self, draft: bool) -> Result<()> {
        if draft {
            return Ok(());
        }
        let missing: Vec<_> = self
            .required()?
            .into_iter()
            .filter(|s| self.lineup.slot(*s).image.is_none())
            .map(|s| s.to_string())
            .collect();
        if !missing.is_empty() {
            return Err(Error::Invalid(format!(
                "Missing required images: {}",
                missing.join(", ")
            )));
        }
        if self.lineup.stand1_pos.is_none() || self.lineup.land_pos.is_none() {
            return Err(Error::Invalid(
                "Place the stand and landing pins first".into(),
            ));
        }
        if self.lineup.slot(Slot::Aim2).image.is_some()
            && !self.lineup.slot(Slot::Aim1).image.is_some()
        {
            return Err(Error::Invalid("Second aim requires first aim".into()));
        }
        Ok(())
    }
    pub fn add_focus_circle(&mut self, x: f64, y: f64, radius: f64, lens: bool) -> Result<()> {
        let slot = self
            .last_captured
            .filter(|s| s.is_aim())
            .unwrap_or(self.active_slot);
        if self.lineup.slot(slot).image.is_none() {
            return Err(Error::Invalid("Capture an aim image first".into()));
        }
        self.checkpoint();
        self.lineup
            .slot_mut(slot)
            .circles
            .push(crate::FocusCircle::at(
                x.clamp(0., 1.),
                y.clamp(0., 1.),
                radius,
                lens,
            ));
        Ok(())
    }
}
