use crate::{Error, Lineup, LineupFilter, Result};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::path::Path;

pub struct Database {
    pub conn: Connection,
}
impl Database {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        Self::from_connection(conn)
    }
    pub fn memory() -> Result<Self> {
        Self::from_connection(Connection::open_in_memory()?)
    }
    fn from_connection(conn: Connection) -> Result<Self> {
        conn.execute_batch(include_str!("../migrations/001_initial.sql"))?;
        Ok(Self { conn })
    }
    pub fn get(&self, id: &str) -> Result<Option<Lineup>> {
        let raw: Option<String> = self
            .conn
            .query_row("SELECT document FROM lineups WHERE id=?1", [id], |r| {
                r.get(0)
            })
            .optional()?;
        raw.map(|s| serde_json::from_str(&s).map_err(Error::from))
            .transpose()
    }
    pub fn all(&self, include_deleted: bool) -> Result<Vec<Lineup>> {
        self.filter(&LineupFilter {
            include_deleted: Some(include_deleted),
            ..Default::default()
        })
    }
    pub fn filter(&self, f: &LineupFilter) -> Result<Vec<Lineup>> {
        let mut sql = String::from("SELECT document FROM lineups WHERE 1=1");
        let mut args: Vec<String> = vec![];
        if !f.include_deleted.unwrap_or(false) {
            sql.push_str(" AND deleted=0");
        }
        if !f.include_drafts.unwrap_or(false) {
            sql.push_str(" AND draft=0");
        }
        for (column, value) in [
            ("map_id", &f.map_id),
            ("agent_id", &f.agent_id),
            ("ability_slot", &f.ability_slot),
        ] {
            if let Some(v) = value {
                sql.push_str(&format!(" AND {column}=?"));
                args.push(v.clone());
            }
        }
        if let Some(v) = &f.side {
            sql.push_str(" AND (side=? OR side='both')");
            args.push(serde_json::to_value(v)?.as_str().unwrap_or("both").into());
        }
        if f.favorites == Some(true) {
            sql.push_str(" AND favorite=1");
        }
        if let Some(v) = &f.search {
            sql.push_str(" AND instr(lower(document),lower(?))>0");
            args.push(v.clone());
        }
        if let Some(ids) = &f.ids {
            if ids.is_empty() {
                return Ok(vec![]);
            }
            sql.push_str(&format!(" AND id IN ({})", vec!["?"; ids.len()].join(",")));
            args.extend(ids.iter().cloned());
        }
        sql.push_str(" ORDER BY favorite DESC, updated_at DESC, id");
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(args), |r| r.get::<_, String>(0))?;
        let mut out = vec![];
        for raw in rows {
            let lineup: Lineup = serde_json::from_str(&raw?)?;
            if let Some(tags) = &f.tags {
                if !tags
                    .iter()
                    .all(|t| lineup.tags.iter().any(|x| x.eq_ignore_ascii_case(t)))
                {
                    continue;
                }
            }
            out.push(lineup);
        }
        Ok(out)
    }
    /// Upsert is atomic; callers performing imports wrap many calls in `transaction`.
    pub fn put(&self, l: &Lineup) -> Result<()> {
        self.conn.execute("INSERT INTO lineups(id,map_id,agent_id,ability_slot,mode,side,updated_at,revision,deleted,favorite,draft,import_batch_id,document) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13) ON CONFLICT(id) DO UPDATE SET map_id=excluded.map_id,agent_id=excluded.agent_id,ability_slot=excluded.ability_slot,mode=excluded.mode,side=excluded.side,updated_at=excluded.updated_at,revision=excluded.revision,deleted=excluded.deleted,favorite=excluded.favorite,draft=excluded.draft,import_batch_id=excluded.import_batch_id,document=excluded.document",
        params![l.id,l.map_id,l.agent_id,l.ability_slot,l.mode,serde_json::to_value(l.side)?.as_str(),l.updated_at,l.revision,l.deleted,l.is_favorite,l.draft,l.import_batch_id,serde_json::to_string(l)?])?;
        Ok(())
    }
    pub fn save_edited(&self, l: &mut Lineup, device_id: &str) -> Result<()> {
        let previous = self.get(&l.id)?;
        l.revision = previous.as_ref().map_or(l.revision, |p| p.revision + 1);
        l.device_id = device_id.into();
        l.updated_at = crate::now();
        if l.title.trim().is_empty() {
            l.title = format!("{} · {} · {}", l.ability_slot, l.site, l.mode)
                .trim()
                .into();
        }
        self.put(l)
    }
    pub fn tombstone(&self, id: &str, device_id: &str) -> Result<()> {
        let mut l = self.get(id)?.ok_or_else(|| Error::NotFound(id.into()))?;
        l.deleted = true;
        l.revision += 1;
        l.updated_at = crate::now();
        l.device_id = device_id.into();
        self.put(&l)
    }
    pub fn favorite(&self, id: &str, value: bool, device_id: &str) -> Result<Lineup> {
        let mut l = self.get(id)?.ok_or_else(|| Error::NotFound(id.into()))?;
        l.is_favorite = value;
        self.save_edited(&mut l, device_id)?;
        Ok(l)
    }
    pub fn transaction(&mut self) -> Result<rusqlite::Transaction<'_>> {
        Ok(self.conn.transaction()?)
    }
    pub fn metadata(&self, key: &str) -> Result<Option<Value>> {
        let raw: Option<String> = self
            .conn
            .query_row("SELECT value FROM metadata WHERE key=?1", [key], |r| {
                r.get(0)
            })
            .optional()?;
        raw.map(|s| serde_json::from_str(&s).map_err(Error::from))
            .transpose()
    }
    pub fn set_metadata(&self, key: &str, value: &Value) -> Result<()> {
        self.conn.execute("INSERT INTO metadata(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key,serde_json::to_string(value)?])?;
        Ok(())
    }
    pub fn device_id(&self) -> Result<String> {
        if let Some(v) = self
            .metadata("deviceId")?
            .and_then(|v| v.as_str().map(String::from))
        {
            return Ok(v);
        }
        let id = uuid::Uuid::new_v4().to_string();
        self.set_metadata("deviceId", &json!(id))?;
        Ok(id)
    }
    pub fn save_draft(&self, id: &str, l: &Lineup) -> Result<()> {
        self.conn.execute("INSERT INTO drafts(id,document,updated_at) VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET document=excluded.document,updated_at=excluded.updated_at", params![id,serde_json::to_string(l)?,crate::now()])?;
        Ok(())
    }
    pub fn load_draft(&self, id: &str) -> Result<Option<Lineup>> {
        let raw: Option<String> = self
            .conn
            .query_row("SELECT document FROM drafts WHERE id=?1", [id], |r| {
                r.get(0)
            })
            .optional()?;
        raw.map(|s| serde_json::from_str(&s).map_err(Error::from))
            .transpose()
    }
    pub fn delete_draft(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM drafts WHERE id=?1", [id])?;
        Ok(())
    }
    pub fn stats(&self) -> Result<Value> {
        let total: i64 = self.conn.query_row(
            "SELECT count(*) FROM lineups WHERE deleted=0 AND draft=0",
            [],
            |r| r.get(0),
        )?;
        let favorites: i64 = self.conn.query_row(
            "SELECT count(*) FROM lineups WHERE deleted=0 AND draft=0 AND favorite=1",
            [],
            |r| r.get(0),
        )?;
        let maps: i64 = self.conn.query_row(
            "SELECT count(DISTINCT map_id) FROM lineups WHERE deleted=0 AND draft=0",
            [],
            |r| r.get(0),
        )?;
        Ok(json!({"total":total,"favorites":favorites,"maps":maps}))
    }
}
