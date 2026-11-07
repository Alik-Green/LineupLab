use lineuplab_core::catalog::{Catalog, HttpTransport, ValorantApi};
use lineuplab_core::config::{LineupAbilityConfig, ModeConfig};
use lineuplab_core::db::Database;
use lineuplab_core::state_machine::DraftState;
use lineuplab_core::storage::{hash_bytes, MediaStore};
use lineuplab_core::*;
use std::sync::{Arc, Mutex};

#[test]
fn database_round_trip_and_tombstone() {
    let db = Database::memory().unwrap();
    let device = db.device_id().unwrap();
    let mut l = Lineup::new(
        "map".into(),
        "Sova".into(),
        "Ability2".into(),
        device.clone(),
    );
    l.title = "A site execute".into();
    l.tags = vec!["postplant".into()];
    l.is_favorite = true;
    db.save_edited(&mut l, &device).unwrap();
    assert_eq!(
        db.filter(&LineupFilter {
            search: Some("execute".into()),
            favorites: Some(true),
            tags: Some(vec!["postplant".into()]),
            ..Default::default()
        })
        .unwrap()
        .len(),
        1
    );
    db.tombstone(&l.id, &device).unwrap();
    assert!(db.all(false).unwrap().is_empty());
    assert!(db.get(&l.id).unwrap().unwrap().deleted);
    db.save_draft("current", &l).unwrap();
    assert_eq!(db.load_draft("current").unwrap().unwrap().id, l.id);
}
#[test]
fn content_addressing_keeps_originals_and_rejects_traversal() {
    let dir = tempfile::tempdir().unwrap();
    let store = MediaStore::new(dir.path()).unwrap();
    let img = image::RgbImage::from_pixel(32, 20, image::Rgb([20, 80, 120]));
    let mut bytes = vec![];
    img.write_to(
        &mut std::io::Cursor::new(&mut bytes),
        image::ImageFormat::Jpeg,
    )
    .unwrap();
    let hash = store.put(&bytes).unwrap();
    assert_eq!(hash, hash_bytes(&bytes));
    assert_eq!(store.get(&hash).unwrap(), bytes);
    assert!(store.thumbnail_path(&hash).unwrap().exists());
    assert!(store.path("../../escape").is_err());
    assert!(store.path("ABC").is_err());
    let (encoded, mime) = MediaStore::encode_capture(&bytes, 16, 85, false).unwrap();
    assert_eq!(mime, "image/jpeg");
    assert_eq!(image::load_from_memory(&encoded).unwrap().width(), 16);
}
#[test]
fn modes_and_multilevel_undo() {
    let cfg = ModeConfig::load().unwrap();
    cfg.validate().unwrap();
    let mut state = DraftState::new(Lineup::new(
        "map".into(),
        "Sova".into(),
        "Ability2".into(),
        "device".into(),
    ));
    state.switch_mode("single", &cfg).unwrap();
    assert!(!state.visible_slots().contains(&Slot::Stand2));
    state.set_image(Slot::Stand1, Some("a".into()));
    state.set_image(Slot::Aim1, Some("b".into()));
    state.switch_mode("double", &cfg).unwrap();
    assert!(state.visible_slots().contains(&Slot::Aim2));
    assert!(state.visible_slots().contains(&Slot::Stand2));
    assert_eq!(state.lineup.slot(Slot::Stand1).image.as_deref(), Some("a"));
    assert!(state.lineup.attribute_bool("doubleShock"));
    assert!(state.undo());
    assert_eq!(state.lineup.mode, "single");
    assert!(state.undo());
    assert!(state.redo());
    assert_eq!(state.lineup.slot(Slot::Aim1).image.as_deref(), Some("b"));
    assert!(state.validate_save(false).is_err());
    state.lineup.draft = true;
    assert!(state.validate_save(true).is_ok());
}
#[test]
fn mock_capture_and_alt_x_geometry() {
    let dir = tempfile::tempdir().unwrap();
    let store = MediaStore::new(dir.path()).unwrap();
    let mut img = vec![];
    image::RgbImage::new(100, 80)
        .write_to(&mut std::io::Cursor::new(&mut img), image::ImageFormat::Png)
        .unwrap();
    let mut provider = capture::MockCaptureProvider::new(img);
    let mut state = DraftState::new(Lineup::new(
        "map".into(),
        "Sova".into(),
        "Grenade".into(),
        "device".into(),
    ));
    state.select(Slot::Aim1);
    state.capture(&mut provider, &store, 1600, 85).unwrap();
    assert_eq!(provider.captures, 1);
    state.add_focus_circle(0.5, 0.5, 0.02, true).unwrap();
    assert_eq!(state.lineup.slot(Slot::Aim1).circles.len(), 1);
    let c = &state.lineup.slot(Slot::Aim1).circles[0];
    let crop = geometry::lens_rect(c, 1600, 900);
    assert!(
        crop.x >= 0. && crop.y >= 0. && crop.x + crop.width <= 1. && crop.y + crop.height <= 1.
    );
    let inset = geometry::inset_rect(c, 1600, 900);
    assert!((inset.width * 1600. - inset.height * 900.).abs() < 0.0001);
}
#[test]
fn default_configs_and_archived_references() {
    let modes = ModeConfig::load().unwrap();
    assert_eq!(modes.modes("Sova", "Grenade").len(), 10);
    assert!(modes.mode("Sova", "Grenade", "recon").is_some());
    let abilities = LineupAbilityConfig::load().unwrap();
    assert!(abilities.enabled("Sova", "Ability1", &serde_json::json!({})));
    assert!(!abilities.enabled(
        "Sova",
        "Ability1",
        &serde_json::json!({"Sova":{"Ability1":false}})
    ));
    let l = Lineup::new(
        "removed-map".into(),
        "removed-agent".into(),
        "Grenade".into(),
        "device".into(),
    );
    let mut c = Catalog::default();
    c.archive_missing(&[l.clone()]);
    assert!(c.is_archived(&l));
    assert_eq!(c.maps.len(), 1);
    c.archive_missing(&[l]);
    assert_eq!(c.maps.len(), 1);
}
struct MockHttp {
    calls: Mutex<Vec<String>>,
    fail_version: Mutex<bool>,
}
#[async_trait::async_trait]
impl HttpTransport for MockHttp {
    async fn get(&self, url: &str) -> Result<Vec<u8>> {
        self.calls.lock().unwrap().push(url.into());
        if url.ends_with("/version") {
            let mut fail = self.fail_version.lock().unwrap();
            if *fail {
                *fail = false;
                return Err(Error::Io(std::io::Error::new(
                    std::io::ErrorKind::ConnectionReset,
                    "offline test",
                )));
            }
            return Ok(br#"{"data":{"version":"v1"}}"#.to_vec());
        }
        if url.contains("/agents?") {
            return Ok(br#"{"data":[{"uuid":"sova","displayName":"Sova","displayIcon":"https://art.example/sova.png","isPlayableCharacter":true,"abilities":[{"slot":"Grenade","displayName":"Recon Bolt","displayIcon":"https://art.example/recon.png"}]}]}"#.to_vec());
        }
        if url.ends_with("/maps") {
            return Ok(br#"{"data":[{"uuid":"abyss","displayName":"Abyss","displayIcon":"https://art.example/abyss.png","splash":null},{"uuid":"range","displayName":"The Range","displayIcon":"https://art.example/range.png","splash":null}]}"#.to_vec());
        }
        let mut bytes = Vec::new();
        image::DynamicImage::new_rgba8(1, 1)
            .write_to(
                &mut std::io::Cursor::new(&mut bytes),
                image::ImageFormat::Png,
            )
            .unwrap();
        Ok(bytes)
    }
}
#[tokio::test]
async fn catalog_retries_caches_and_works_offline() {
    let dir = tempfile::tempdir().unwrap();
    let http = Arc::new(MockHttp {
        calls: Mutex::new(vec![]),
        fail_version: Mutex::new(true),
    });
    let api = ValorantApi::with_transport("https://api.example/v1", dir.path(), http.clone());
    let c = api.refresh(false).await.unwrap();
    assert!(!c.offline, "{:?}", c.warning);
    assert_eq!(c.agents.len(), 1);
    assert_eq!(c.maps.len(), 1);
    assert_eq!(
        http.calls
            .lock()
            .unwrap()
            .iter()
            .filter(|u| u.ends_with("/version"))
            .count(),
        2
    );
    let calls = http.calls.lock().unwrap().len();
    let c = api.refresh(false).await.unwrap();
    assert_eq!(c.maps.len(), 1);
    assert_eq!(http.calls.lock().unwrap().len(), calls + 1);
    assert!(api
        .image_for_url(Some("https://art.example/abyss.png"))
        .is_some());
    let audit = api.audit_assets(&c).unwrap();
    assert_eq!(audit.types["agent"].cached, 1, "{:?}", audit);
    assert_eq!(audit.types["ability"].cached, 1);
    assert_eq!(audit.types["minimap"].cached, 1);
    assert_eq!(audit.errors.len(), 0);
    let progress = Mutex::new(Vec::new());
    api.refresh_with_progress(false, |p| progress.lock().unwrap().push(p))
        .await
        .unwrap();
    assert_eq!(progress.lock().unwrap().last().unwrap().phase, "ready");
    struct Offline;
    #[async_trait::async_trait]
    impl HttpTransport for Offline {
        async fn get(&self, _: &str) -> Result<Vec<u8>> {
            Err(Error::Io(std::io::Error::new(
                std::io::ErrorKind::NotConnected,
                "offline",
            )))
        }
    }
    let offline =
        ValorantApi::with_transport("https://api.example/v1", dir.path(), Arc::new(Offline));
    let c = offline.refresh(false).await.unwrap();
    assert!(c.offline);
    assert_eq!(c.agents.len(), 1);
}
