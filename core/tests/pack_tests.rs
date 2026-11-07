use lineuplab_core::{
    db::Database,
    pack::*,
    storage::{hash_bytes, MediaStore},
    *,
};
use serde_json::{json, Value};
use std::collections::BTreeSet;
fn fixture(name: &str) -> Vec<u8> {
    std::fs::read(format!(
        "{}/fixtures/generated/{name}",
        env!("CARGO_MANIFEST_DIR").replace("/core", "")
    ))
    .unwrap()
}
fn setup() -> (Database, MediaStore, tempfile::TempDir) {
    let dir = tempfile::tempdir().unwrap();
    let store = MediaStore::new(dir.path().join("media")).unwrap();
    (Database::memory().unwrap(), store, dir)
}
fn strip_x(v: &mut Value) {
    if let Some(o) = v.as_object_mut() {
        o.remove("x_lineuplab");
    }
}
fn normalize_media(v: &mut Value, archive: &PackArchive) {
    match v {
        Value::String(s) if s.starts_with("media/") => {
            if let Some(bytes) = archive.media.get(s) {
                *v = json!(format!("content:{}", hash_bytes(bytes)));
            }
        }
        Value::Array(a) => {
            for x in a {
                normalize_media(x, archive);
            }
        }
        Value::Object(o) => {
            for x in o.values_mut() {
                normalize_media(x, archive);
            }
        }
        _ => {}
    }
}
#[test]
fn imports_synthetic_pack_slot_mapping_and_all_referenced_media() {
    let (mut db, store, _dir) = setup();
    let report = import_bytes(
        &mut db,
        &store,
        &fixture("legacy-sample.zip"),
        ConflictPolicy::OverwriteIfNewer,
        None,
    )
    .unwrap();
    assert_eq!(report.imported, 3);
    let all = db.all(false).unwrap();
    assert_eq!(all.len(), 3);
    let abyss = all
        .iter()
        .find(|l| l.id == "custom-abyss-mid-bend-b-site")
        .unwrap();
    assert!(abyss.slot(Slot::Stand1).image.is_some());
    assert!(abyss.slot(Slot::Aim1).image.is_some());
    assert!(abyss.slot(Slot::Landing).image.is_some());
    assert_eq!(
        abyss.stand1_pos,
        Some(Point {
            x: 0.6919,
            y: 0.7016
        })
    );
    assert_eq!(
        abyss.land_pos,
        Some(Point {
            x: 0.3441,
            y: 0.8831
        })
    );
    assert_eq!(abyss.steps.len(), 2);
    assert!(abyss.steps[0].image_ref.is_some());
    assert_ne!(abyss.steps[0].image_ref, abyss.slot(Slot::Stand1).image);
    let double = all
        .iter()
        .find(|l| l.id == "synthetic-double-shock")
        .unwrap();
    assert!(double.slot(Slot::Stand2).image.is_some());
    assert!(double.slot(Slot::Aim2).image.is_some());
    assert_eq!(double.throws.len(), 2);
    assert!(double.attribute_bool("doubleShock"));
    assert_eq!(double.slot(Slot::Aim2).circles.len(), 1);
    assert_eq!(double.slot(Slot::Aim2).circles[0].id, "projectile-only");
}
#[test]
fn corrode_circle_canonical_once_and_exports_to_both_places() {
    let (mut db, store, _dir) = setup();
    import_bytes(
        &mut db,
        &store,
        &fixture("recon-bounces.zip"),
        ConflictPolicy::OverwriteIfNewer,
        None,
    )
    .unwrap();
    let l = db.get("custom-corrode-b-main").unwrap().unwrap();
    assert_eq!(l.slot(Slot::Aim1).circles.len(), 1);
    assert_eq!(
        l.slot(Slot::Aim1).circles[0].extra["legacyNote"],
        "preserve me"
    );
    let bytes = export(&db, &store, &[l.clone()], &ExportOptions::default()).unwrap();
    let archive = read_archive(&bytes).unwrap();
    let (_, doc) = &archive.lineups[0];
    let a = &doc["attributes"]["slotCircles"]["aim1"];
    let b = &doc["attributes"]["projectiles"][0]["focusCircles"];
    assert_eq!(a, b);
    assert_eq!(a.as_array().unwrap().len(), 1);
    let (parsed, warn) = parse_lineup(doc, "device", |p| {
        archive.media.get(p).map(|b| hash_bytes(b))
    })
    .unwrap();
    assert!(warn.is_empty(), "{warn:?}");
    assert_eq!(parsed.slot(Slot::Aim1).circles, l.slot(Slot::Aim1).circles);
}
#[test]
fn round_trip_json_deep_equals_original_modulo_x_and_model_round_trips() {
    let (mut db, store, _dir) = setup();
    let bytes = fixture("legacy-sample.zip");
    let original = read_archive(&bytes).unwrap();
    import_bytes(
        &mut db,
        &store,
        &bytes,
        ConflictPolicy::OverwriteIfNewer,
        None,
    )
    .unwrap();
    let lineups = db.all(false).unwrap();
    let exported = export(&db, &store, &lineups, &ExportOptions::default()).unwrap();
    let archive = read_archive(&exported).unwrap();
    for (path, doc) in &archive.lineups {
        if path.contains("synthetic-double-shock") {
            continue;
        } // projectile-only circles are intentionally canonicalized into both places
        let mut expected = original
            .lineups
            .iter()
            .find(|(p, _)| p == path)
            .unwrap()
            .1
            .clone();
        let mut actual = doc.clone();
        strip_x(&mut expected);
        strip_x(&mut actual);
        normalize_media(&mut expected, &original);
        normalize_media(&mut actual, &archive);
        assert_eq!(actual, expected, "legacy JSON changed for {path}");
    }
    let (mut db2, store2, _dir2) = setup();
    import_bytes(
        &mut db2,
        &store2,
        &exported,
        ConflictPolicy::OverwriteIfNewer,
        None,
    )
    .unwrap();
    for before in db.all(false).unwrap() {
        let after = db2.get(&before.id).unwrap().unwrap();
        assert_eq!(before.slots, after.slots);
        assert_eq!(before.throws, after.throws);
        assert_eq!(before.steps, after.steps);
        assert_eq!(before.attributes, after.attributes);
        assert_eq!(before.legacy, after.legacy);
        assert_eq!(
            before.extensions.attribute_forms,
            after.extensions.attribute_forms
        );
        assert_eq!(before.mode, after.mode);
        assert_eq!(before.land_pos, after.land_pos);
        assert_eq!(before.is_favorite, after.is_favorite);
    }
}
#[test]
fn unknown_fields_numeric_strings_and_newer_schema_are_preserved() {
    let mut doc: Value = serde_json::from_slice(
        &std::fs::read(format!(
            "{}/../fixtures/samples/custom-corrode-b-main.json",
            env!("CARGO_MANIFEST_DIR")
        ))
        .unwrap(),
    )
    .unwrap();
    doc["schemaVersion"] = json!(2);
    doc["attributes"]["chargeStage"] = json!("01");
    doc["attributes"]["customString"] = json!("007");
    doc["steps"][0]["futureStep"] = json!({"a":1});
    doc["attributes"]["projectiles"][0]["futureProjectile"] = json!(true);
    doc["media"]["futureMedia"] = json!("keep");
    let (l, warnings) = parse_lineup(&doc, "device", |_| Some("a".repeat(64))).unwrap();
    assert!(warnings.iter().any(|w| w.contains("schemaVersion 2")));
    assert_eq!(l.attribute_u32("chargeStage"), Some(1));
    assert_eq!(l.extensions.attribute_forms["chargeStage"], "01");
    assert_eq!(l.attribute_u32("customString"), Some(7));
    assert_eq!(l.extensions.attribute_forms["customString"], "007");
    assert_eq!(l.legacy["futureRootField"]["keep"], true);
    assert_eq!(l.legacy["media"]["futureMedia"], "keep");
    assert_eq!(l.steps[0].extra["futureStep"]["a"], 1);
    assert_eq!(l.throws[0].extra["futureProjectile"], true);
    let out = legacy_document(
        &l,
        &Default::default(),
        &Default::default(),
        &Default::default(),
    )
    .unwrap();
    assert_eq!(out["attributes"]["chargeStage"], "01");
    assert_eq!(out["attributes"]["customString"], "007");
    assert_eq!(out["futureRootField"], doc["futureRootField"]);
    assert_eq!(out["x_lineuplab"]["sourceSchemaVersion"], 2);
}
#[test]
fn conflict_policies_seed_preview_and_transactional_undo() {
    let (mut db, store, _dir) = setup();
    let bytes = fixture("legacy-sample.zip");
    let archive = read_archive(&bytes).unwrap();
    let p = preview(&archive, &db).unwrap();
    assert!(p.entries.iter().all(|e| e.selected));
    let report = import_bytes(
        &mut db,
        &store,
        &bytes,
        ConflictPolicy::OverwriteIfNewer,
        None,
    )
    .unwrap();
    assert_eq!(report.imported, 3);
    let again = import_bytes(
        &mut db,
        &store,
        &bytes,
        ConflictPolicy::OverwriteIfNewer,
        None,
    )
    .unwrap();
    assert_eq!(again.imported, 0);
    assert_eq!(again.skipped, 3);
    let copy = import_bytes(&mut db, &store, &bytes, ConflictPolicy::ImportAsCopy, None).unwrap();
    assert_eq!(copy.copied, 0); // identical entries are unchecked by default
    let all = p
        .entries
        .iter()
        .map(|e| e.id.clone())
        .collect::<BTreeSet<_>>();
    let copy = commit(
        &mut db,
        &store,
        &archive,
        &p,
        &all,
        ConflictPolicy::ImportAsCopy,
    )
    .unwrap();
    assert_eq!(copy.copied, 3);
    assert_eq!(db.all(false).unwrap().len(), 6);
    undo_import(&mut db, &copy.batch_id).unwrap();
    assert_eq!(db.all(false).unwrap().len(), 3);
    undo_import(&mut db, &report.batch_id).unwrap();
    assert_eq!(db.all(false).unwrap().len(), 0);
    assert_eq!(db.all(true).unwrap().len(), 6);
    let seed = read_archive(&fixture("seed-placeholder.zip")).unwrap();
    let p = preview(&seed, &db).unwrap();
    assert!(p.entries.iter().all(|e| !e.selected));
    assert!(p.warnings.iter().any(|w| w.contains("Seed placeholder")));
}
#[test]
fn newer_local_and_newer_pack_conflicts() {
    let (mut db, store, _dir) = setup();
    let bytes = fixture("recon-bounces.zip");
    let archive = read_archive(&bytes).unwrap();
    let p = preview(&archive, &db).unwrap();
    let id = "custom-corrode-b-main";
    let mut local = p.entries[0].lineup.clone().unwrap();
    local.updated_at = "2026-01-01T00:00:00Z".into();
    local.title = "Local edit".into();
    db.put(&local).unwrap();
    let p = preview(&archive, &db).unwrap();
    assert_eq!(p.entries[0].status, ImportStatus::NewerLocally);
    assert!(!p.entries[0].selected);
    let selected = BTreeSet::from([id.into()]);
    let r = commit(
        &mut db,
        &store,
        &archive,
        &p,
        &selected,
        ConflictPolicy::OverwriteIfNewer,
    )
    .unwrap();
    assert_eq!(r.imported, 0);
    assert_eq!(db.get(id).unwrap().unwrap().title, "Local edit");
    local.updated_at = "2024-01-01T00:00:00Z".into();
    db.put(&local).unwrap();
    let p = preview(&archive, &db).unwrap();
    assert_eq!(p.entries[0].status, ImportStatus::NewerInPack);
    let r = commit(
        &mut db,
        &store,
        &archive,
        &p,
        &selected,
        ConflictPolicy::OverwriteIfNewer,
    )
    .unwrap();
    assert_eq!(r.overwritten, 1);
    undo_import(&mut db, &r.batch_id).unwrap();
    assert_eq!(db.get(id).unwrap().unwrap().title, "Local edit");
}
#[test]
fn missing_media_and_unknown_uuids_still_import() {
    let (mut db, store, _dir) = setup();
    let r = import_bytes(
        &mut db,
        &store,
        &fixture("missing-image.zip"),
        ConflictPolicy::OverwriteIfNewer,
        None,
    )
    .unwrap();
    assert_eq!(r.imported, 1);
    let l = db.all(false).unwrap().remove(0);
    assert!(l.slot(Slot::Landing).image.is_none());
    assert_eq!(l.extensions.extra["incomplete"], true);
    assert!(r.warnings.iter().any(|w| w.contains("Missing media")));
    let r = import_bytes(
        &mut db,
        &store,
        &fixture("unknown-map.zip"),
        ConflictPolicy::OverwriteIfNewer,
        None,
    )
    .unwrap();
    assert_eq!(r.imported, 1);
    let mut c = catalog::Catalog::default();
    c.archive_missing(&db.all(false).unwrap());
    assert!(c.maps.iter().any(|m| m.archived));
}
#[test]
fn archive_security_cases_are_rejected_or_flagged() {
    for name in [
        "zip-slip.zip",
        "absolute-path.zip",
        "symlink.zip",
        "oversized-entry.zip",
        "unsupported-media.zip",
    ] {
        let err = read_archive(&fixture(name)).unwrap_err();
        assert!(matches!(err, Error::Invalid(_)), "{name}: {err}");
    }
    let archive = read_archive(&fixture("malformed-json.zip")).unwrap();
    let db = Database::memory().unwrap();
    let p = preview(&archive, &db).unwrap();
    assert!(p
        .entries
        .iter()
        .any(|e| e.status == ImportStatus::Error && e.warnings[0].contains("Malformed JSON")));
    let archive = read_archive(&fixture("duplicate-ids.zip")).unwrap();
    let p = preview(&archive, &db).unwrap();
    assert_eq!(
        p.entries
            .iter()
            .filter(|e| e.status == ImportStatus::Error)
            .count(),
        1
    );
}
#[test]
fn lines_round_trip_under_single_x_key_and_old_json_loads() {
    let (mut db, store, _dir) = setup();
    import_bytes(
        &mut db,
        &store,
        &fixture("recon-bounces.zip"),
        ConflictPolicy::OverwriteIfNewer,
        None,
    )
    .unwrap();
    let mut l = db.all(false).unwrap().remove(0);
    let line = AnnotationLine {
        id: "line-1".into(),
        color: "#ff8800".into(),
        width: 0.004,
        points: vec![Point { x: 0.1, y: 0.2 }, Point { x: 0.8, y: 0.7 }],
        style: LineStyle::Dashed,
        arrow: Arrow::Both,
        label: Some("aim here".into()),
        extra: Default::default(),
    };
    l.slot_mut(Slot::Aim1).lines.push(line.clone());
    let bytes = export(&db, &store, &[l.clone()], &ExportOptions::default()).unwrap();
    let archive = read_archive(&bytes).unwrap();
    let doc = &archive.lineups[0].1;
    assert_eq!(
        doc["x_lineuplab"]["slotLines"]["aim1"][0]["label"],
        "aim here"
    );
    assert!(doc["attributes"].get("slotLines").is_none());
    let (parsed, _) = parse_lineup(doc, "device", |p| {
        archive.media.get(p).map(|b| hash_bytes(b))
    })
    .unwrap();
    assert_eq!(parsed.slot(Slot::Aim1).lines, vec![line]);
    let old: Value = serde_json::from_slice(
        &std::fs::read(format!(
            "{}/../fixtures/samples/custom-corrode-b-main.json",
            env!("CARGO_MANIFEST_DIR")
        ))
        .unwrap(),
    )
    .unwrap();
    let (old, _) = parse_lineup(&old, "device", |_| None).unwrap();
    assert!(old.slot(Slot::Aim1).lines.is_empty());
}
#[test]
fn webp_legacy_export_keeps_original_bytes_recoverable() {
    let (db, store, _dir) = setup();
    let mut l = Lineup::new(
        "map".into(),
        "Sova".into(),
        "Grenade".into(),
        "device".into(),
    );
    let mut buf = vec![];
    image::RgbImage::new(80, 50)
        .write_to(
            &mut std::io::Cursor::new(&mut buf),
            image::ImageFormat::WebP,
        )
        .unwrap();
    let hash = store.put(&buf).unwrap();
    l.slot_mut(Slot::Aim1).image = Some(hash.clone());
    db.put(&l).unwrap();
    let bytes = export(&db, &store, &[l], &ExportOptions::default()).unwrap();
    let archive = read_archive(&bytes).unwrap();
    let doc = &archive.lineups[0].1;
    let primary = doc["media"]["aimImage"].as_str().unwrap();
    assert!(primary.ends_with(".jpg"));
    assert!(doc["x_lineuplab"]["originalMedia"].is_object());
    let (mut db2, store2, _dir2) = setup();
    import_bytes(
        &mut db2,
        &store2,
        &bytes,
        ConflictPolicy::OverwriteIfNewer,
        None,
    )
    .unwrap();
    assert_eq!(
        db2.all(false).unwrap()[0].slot(Slot::Aim1).image.as_deref(),
        Some(hash.as_str())
    );
    assert_eq!(store2.get(&hash).unwrap(), buf);
}
#[test]
fn annotation_sample_is_rendered_from_synthetic_original() {
    let bytes = include_bytes!("../../fixtures/generated/legacy-sample.zip");
    let archive = read_archive(bytes).unwrap();
    let db = Database::memory().unwrap();
    let p = preview(&archive, &db).unwrap();
    let l = p
        .entries
        .iter()
        .find(|e| e.id == "custom-corrode-b-main")
        .unwrap()
        .lineup
        .as_ref()
        .unwrap();
    let slot = l.slot(Slot::Aim1);
    let original = archive.media.values().nth(1).cloned().unwrap();
    let rendered = render::flatten(&original, slot).unwrap();
    let dir = format!("{}/../docs", env!("CARGO_MANIFEST_DIR"));
    std::fs::create_dir_all(&dir).unwrap();
    let path = format!("{dir}/annotation_sample.png");
    std::fs::write(path, &rendered).unwrap();
    assert!(image::load_from_memory(&rendered).unwrap().width() == 640);
}
