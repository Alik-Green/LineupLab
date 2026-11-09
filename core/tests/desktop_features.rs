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
fn overlay_physical_rect_uses_real_monitor_size_origin_and_dpi() {
    let mut s = OverlayState::default();
    s.settings.corner = Corner::BottomRight;
    // 2560x1440 at 100%: bottom-right is relative to 1440p, not hardcoded 1080p.
    assert_eq!(
        s.settings.physical_rect((0, 0), (2560, 1440), 1.0),
        ((2560 - 420 - 24, 1440 - 320 - 24), (420, 320))
    );
    // Same logical 1920x1080 workspace at 125% scaling, on a secondary monitor.
    assert_eq!(
        s.settings.physical_rect((2560, 0), (2400, 1350), 1.25),
        ((2560 + 1845, 920), (525, 400))
    );
    // Oversized logical window is clamped inside a small monitor.
    s.settings.width = 1600;
    s.settings.height = 1400;
    let ((x, y), (w, h)) = s.settings.physical_rect((-1920, 0), (1280, 720), 1.0);
    assert!(x >= -1920 && y >= 0 && x + w as i32 <= -640 && y + h as i32 <= 720);
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
    s.set_view_lineup(&l, &[Slot::Stand1, Slot::Aim1, Slot::Landing]);
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

#[test]
fn learn_steps_skip_missing_and_duplicated_second_stand() {
    let required = [Slot::Stand1, Slot::Aim1, Slot::Landing];
    let mut l = Lineup::new("map".into(), "Sova".into(), "Grenade".into(), "dev".into());
    let stand = "a".repeat(64);
    let aim = "b".repeat(64);
    let land = "c".repeat(64);
    l.slot_mut(Slot::Stand1).image = Some(stand.clone());
    l.slot_mut(Slot::Aim1).image = Some(aim.clone());
    l.slot_mut(Slot::Landing).image = Some(land.clone());

    // No second throw: a leftover second stand (distinct or copied) is not a step.
    l.slot_mut(Slot::Stand2).image = Some("d".repeat(64));
    assert_eq!(
        learn_slots(&l, &required),
        vec![Slot::Stand1, Slot::Aim1, Slot::Landing]
    );
    let mut s = OverlayState::default();
    s.set_view_lineup(&l, &required);
    assert_eq!(s.view_slots, vec![Slot::Stand1, Slot::Aim1, Slot::Landing]);
    s.update_checklist(&l, &required, &[]);
    assert!(!s.checklist.iter().any(|c| c.slot == Slot::Stand2));

    // Double shock where both throws share the same standing picture: still one stand step.
    let double = [Slot::Stand1, Slot::Aim1, Slot::Aim2, Slot::Landing];
    l.slot_mut(Slot::Stand2).image = Some(stand.clone());
    l.slot_mut(Slot::Aim2).image = Some("e".repeat(64));
    assert!(has_second_throw(&l, &double));
    assert_eq!(
        learn_slots(&l, &double),
        vec![Slot::Stand1, Slot::Aim1, Slot::Aim2, Slot::Landing]
    );
    s.update_checklist(&l, &double, &[]);
    assert!(!s.checklist.iter().any(|c| c.slot == Slot::Stand2));

    // A genuinely different second stand is kept.
    l.slot_mut(Slot::Stand2).image = Some("f".repeat(64));
    assert_eq!(
        learn_slots(&l, &double),
        vec![
            Slot::Stand1,
            Slot::Aim1,
            Slot::Stand2,
            Slot::Aim2,
            Slot::Landing
        ]
    );
    s.update_checklist(&l, &double, &[]);
    assert!(s.checklist.iter().any(|c| c.slot == Slot::Stand2 && c.done));

    // A missing required second stand still appears in the Create checklist.
    l.slot_mut(Slot::Stand2).image = None;
    s.update_checklist(
        &l,
        &[
            Slot::Stand1,
            Slot::Aim1,
            Slot::Stand2,
            Slot::Aim2,
            Slot::Landing,
        ],
        &[],
    );
    assert!(s
        .checklist
        .iter()
        .any(|c| c.slot == Slot::Stand2 && c.required && !c.done));

    // Blank hashes and repeated pictures never become steps.
    l.slot_mut(Slot::Landing).image = Some("   ".into());
    l.slot_mut(Slot::Aim2).image = Some(aim.clone());
    assert_eq!(learn_slots(&l, &double), vec![Slot::Stand1, Slot::Aim1]);
}

#[test]
fn second_throw_is_detected_from_saved_data_for_legacy_modes() {
    let required = [Slot::Stand1, Slot::Aim1, Slot::Landing];
    let mut l = Lineup::new("map".into(), "Sova".into(), "Ability2".into(), "dev".into());
    assert!(!has_second_throw(&l, &required));
    l.slot_mut(Slot::Aim1).image = Some("a".repeat(64));
    l.slot_mut(Slot::Aim2).image = Some("a".repeat(64));
    assert!(
        !has_second_throw(&l, &required),
        "a copied second aim is not a second throw"
    );
    l.slot_mut(Slot::Aim2).image = Some("b".repeat(64));
    assert!(has_second_throw(&l, &required));
    l.slot_mut(Slot::Aim2).image = None;
    l.attributes
        .insert("doubleShock".into(), serde_json::json!(true));
    assert!(has_second_throw(&l, &required));
    l.attributes.clear();
    l.mode = "double".into();
    assert!(has_second_throw(&l, &required));
}

#[test]
fn overlay_lineup_order_steps_wrap_and_survive_legacy_settings() {
    let mut s = OverlayState::default();
    assert_eq!(s.step_lineup(None, true), None);
    s.set_lineup_order(vec![
        "a".into(),
        "".into(),
        "b".into(),
        "a".into(),
        "c".into(),
    ]);
    assert_eq!(s.lineup_order, vec!["a", "b", "c"]);
    assert_eq!(s.step_lineup(Some("a"), true).as_deref(), Some("b"));
    assert_eq!(s.step_lineup(Some("c"), true).as_deref(), Some("a"));
    assert_eq!(s.step_lineup(Some("a"), false).as_deref(), Some("c"));
    assert_eq!(s.step_lineup(Some("missing"), true).as_deref(), Some("a"));
    assert_eq!(s.step_lineup(None, false).as_deref(), Some("c"));
    // Preview 7 overlay.json has no lineupOrder key; settings must still load.
    let legacy = serde_json::json!({
        "settings": OverlaySettings::default(), "visible": true, "mode": "view",
        "showChecklist": true, "checklist": [], "viewSlots": [], "viewIndex": 0, "flipped": false
    });
    let parsed: OverlayState = serde_json::from_value(legacy).unwrap();
    assert!(parsed.lineup_order.is_empty());
    assert_eq!(parsed.mode, OverlayMode::View);
}

#[test]
fn lineup_step_hotkeys_default_to_alt_up_and_down_without_conflicts() {
    let cfg = HotkeyConfig::default();
    cfg.validate().unwrap();
    assert_eq!(cfg.action_for("Alt+Down"), Some("lineup_next"));
    assert_eq!(cfg.action_for("Alt+Up"), Some("lineup_prev"));
    assert_eq!(cfg.action_for("alt+arrowdown"), Some("lineup_next"));
}
