use lineuplab_core::{capture::*, hotkeys::*, overlay::*, *};
fn png(w: u32, h: u32) -> Vec<u8> {
    let img = image::RgbaImage::from_fn(w, h, |x, y| {
        image::Rgba([(x % 255) as u8, (y % 255) as u8, 128, 255])
    });
    let mut out = vec![];
    img.write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)
        .unwrap();
    out
}
#[test]
fn hotkey_defaults_are_alt_based_unique_and_rebindable() {
    let mut cfg = HotkeyConfig::default();
    cfg.validate().unwrap();
    assert!(cfg.bindings.iter().all(|b| b.keys.contains("Alt")));
    assert_eq!(cfg.action_for("alt+x"), Some("crosshair_circle"));
    let conflict = cfg.rebind("capture", "Alt+X");
    assert!(matches!(conflict, HotkeyFeedback::Conflict { .. }));
    assert!(cfg.rebind("capture", "Ctrl+C").is_ok() == false);
    assert!(cfg.rebind("capture", "alt+shift+q").is_ok());
    assert_eq!(cfg.action_for("Shift+Alt+Q"), Some("capture"));
    cfg.validate().unwrap();
    assert!(matches!(
        cfg.rebind("nope", "Alt+Q"),
        HotkeyFeedback::Invalid { .. }
    ));
}
#[test]
fn mock_hotkey_provider_registers_and_reports_conflicts() {
    let mut p = MockHotkeyProvider::default();
    p.register("Alt+C", "capture").unwrap();
    p.register("Alt+X", "crosshair_circle").unwrap();
    assert!(p.register("alt+c", "other").is_err());
    assert_eq!(p.press("ALT+C").as_deref(), Some("capture"));
    assert_eq!(p.registered().len(), 2);
    p.unregister("Alt+C").unwrap();
    assert_eq!(p.press("Alt+C"), None);
}
#[test]
fn overlay_defaults_click_through_and_positions_by_corner() {
    let mut s = OverlayState::default();
    assert!(s.settings.click_through);
    assert!(s.visible);
    s.settings.corner = Corner::TopLeft;
    assert_eq!(s.settings.position(1920, 1080), (24, 24));
    s.settings.corner = Corner::BottomRight;
    assert_eq!(
        s.settings.position(1920, 1080),
        (1920 - 420 - 24, 1080 - 320 - 24)
    );
    s.controls();
    assert!(!s.settings.click_through);
    s.set_opacity(5.0);
    assert_eq!(s.settings.opacity, 1.0);
    s.set_opacity(0.0);
    assert_eq!(s.settings.opacity, 0.2);
    s.validate().unwrap();
    assert_eq!(Corner::TopLeft.cycle(), Corner::TopRight);
}
#[test]
fn overlay_create_checklist_and_view_flipping() {
    let mut l = Lineup::new("map".into(), "Sova".into(), "Grenade".into(), "dev".into());
    l.slot_mut(Slot::Stand1).image = Some("a".repeat(64));
    l.slot_mut(Slot::Aim1).image = Some("b".repeat(64));
    let mut s = OverlayState::default();
    s.update_checklist(&l, &[Slot::Stand1, Slot::Aim1, Slot::Landing], &[]);
    assert_eq!(s.checklist.len(), 3);
    assert!(s.checklist.iter().filter(|c| c.done).count() == 2);
    assert!(s
        .checklist
        .iter()
        .any(|c| c.slot == Slot::Landing && !c.done));
    s.toggle_mode();
    assert_eq!(s.mode, OverlayMode::View);
    s.set_view_lineup(&l);
    assert_eq!(s.current_view_slot(), Some(Slot::Stand1));
    s.view_next();
    assert_eq!(s.current_view_slot(), Some(Slot::Aim1));
    s.view_next();
    assert_eq!(s.current_view_slot(), Some(Slot::Stand1));
    s.view_prev();
    assert_eq!(s.current_view_slot(), Some(Slot::Aim1));
    s.flip();
    assert!(s.flipped);
}
#[test]
fn mock_capture_pipeline_downscales_encodes_and_thumbnails() {
    let dir = tempfile::tempdir().unwrap();
    let store = storage::MediaStore::new(dir.path().join("media")).unwrap();
    let mut provider = MockCaptureProvider::new(png(3200, 1800));
    let settings = CaptureSettings::default();
    let out = capture_processed(&mut provider, &store, &settings).unwrap();
    assert_eq!(provider.captures, 1);
    assert_eq!(out.width, 1600);
    assert_eq!(out.height, 900);
    assert_eq!(out.mime, "image/webp");
    assert!(store.has(&out.hash));
    assert!(store.thumbnail_path(&out.hash).unwrap().exists());
    assert_eq!(out.monitor, "Mock monitor");
    let jpeg = CaptureSettings {
        webp: false,
        ..Default::default()
    };
    let out2 = capture_processed(&mut provider, &store, &jpeg).unwrap();
    assert_eq!(out2.mime, "image/jpeg");
    assert_ne!(out.hash, out2.hash);
}
#[test]
fn draft_capture_uses_required_slot_flow_and_undo() {
    let dir = tempfile::tempdir().unwrap();
    let store = storage::MediaStore::new(dir.path().join("media")).unwrap();
    let mut provider = MockCaptureProvider::new(png(640, 360));
    let mut draft = state_machine::DraftState::new(Lineup::new(
        "map".into(),
        "Sova".into(),
        "Grenade".into(),
        "dev".into(),
    ));
    assert_eq!(
        draft.capture(&mut provider, &store, 1600, 85).unwrap(),
        Slot::Stand1
    );
    assert_eq!(draft.active_slot, Slot::Aim1);
    draft.capture(&mut provider, &store, 1600, 85).unwrap();
    assert_eq!(draft.active_slot, Slot::Landing);
    assert!(draft.validate_save(false).is_err()); // pins missing
    draft
        .set_pin(Slot::Stand1, Point { x: 0.1, y: 0.2 })
        .unwrap();
    draft
        .set_pin(Slot::Landing, Point { x: 0.8, y: 0.9 })
        .unwrap();
    draft.capture(&mut provider, &store, 1600, 85).unwrap();
    draft.validate_save(false).unwrap();
    assert!(draft.undo());
    assert!(draft.lineup.slot(Slot::Landing).image.is_none());
    assert!(draft.redo());
    assert!(draft.lineup.slot(Slot::Landing).image.is_some());
}
