use lineuplab_core::{
    db::Database,
    server::{spawn, ServerConfig},
    storage::{hash_bytes, MediaStore},
    sync::*,
    *,
};
async fn server() -> (
    lineuplab_core::server::ServerHandle,
    tempfile::TempDir,
    SyncClient,
) {
    let dir = tempfile::tempdir().unwrap();
    let h = spawn(ServerConfig {
        bind: "127.0.0.1:0".parse().unwrap(),
        data_dir: dir.path().to_path_buf(),
        name: "test".into(),
        pairing_code: Some("123456".into()),
        require_pairing_code: true,
        advertise_mdns: false,
    })
    .await
    .unwrap();
    let pair = SyncClient::pair(&format!("http://{}", h.addr), "123456", "tester")
        .await
        .unwrap();
    let client = SyncClient::new(format!("http://{}", h.addr), pair.token);
    (h, dir, client)
}
fn local() -> (Database, MediaStore, tempfile::TempDir) {
    let dir = tempfile::tempdir().unwrap();
    let store = MediaStore::new(dir.path().join("media")).unwrap();
    (Database::memory().unwrap(), store, dir)
}
fn lineup(title: &str, updated: &str, device: &str, rev: u64) -> Lineup {
    let mut l = Lineup::new(
        "map".into(),
        "agent".into(),
        "Grenade".into(),
        device.into(),
    );
    l.title = title.into();
    l.updated_at = updated.into();
    l.revision = rev;
    l
}
#[tokio::test]
async fn pairing_required_and_tokens_authenticate() {
    let (h, _dir, client) = server().await;
    let base = format!("http://{}", h.addr);
    assert!(matches!(
        SyncClient::pair(&base, "000000", "x").await,
        Err(Error::Unauthorized)
    ));
    let anon = SyncClient::new(&base, "");
    assert!(matches!(
        anon.manifest(None).await,
        Err(Error::Unauthorized)
    ));
    let m = client.manifest(None).await.unwrap();
    assert_eq!(m.protocol_version, PROTOCOL_VERSION);
    assert!(m.entries.is_empty());
    let health = reqwest::get(format!("{base}/health")).await.unwrap();
    assert!(health.status().is_success());
    h.shutdown().await.unwrap();
}
#[tokio::test]
async fn pairing_attempts_are_rate_limited() {
    let (h, _dir, _client) = server().await;
    let base = format!("http://{}", h.addr);
    for _ in 0..10 {
        assert!(matches!(
            SyncClient::pair(&base, "999999", "x").await,
            Err(Error::Unauthorized)
        ));
    }
    let resp = reqwest::Client::new()
        .post(format!("{base}/pair"))
        .json(&serde_json::json!({"code":"123456"}))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), reqwest::StatusCode::TOO_MANY_REQUESTS);
    h.shutdown().await.unwrap();
}
#[tokio::test]
async fn incremental_push_pull_images_tombstones_and_conflicts() {
    let (h, _sdir, client) = server().await;
    let (mut a, ast, _ad) = local();
    let (mut b, bst, _bd) = local();
    let bytes = b"synthetic image bytes".to_vec();
    let hash = ast.put(&bytes).unwrap();
    let mut l = lineup("Original", "2026-01-01T00:00:00Z", "device-a", 1);
    l.slot_mut(Slot::Aim1).image = Some(hash.clone());
    a.put(&l).unwrap();
    let up = push_local(&client, &a, &ast, "device-a").await.unwrap();
    assert_eq!(up.pushed, 1);
    assert_eq!(up.images, 1);
    let down = pull(&client, &mut b, &bst, None).await.unwrap();
    assert_eq!(down.pulled, 1);
    assert_eq!(down.images, 1);
    assert_eq!(b.get(&l.id).unwrap().unwrap().title, "Original");
    assert!(bst.has(&hash));
    assert_eq!(bst.get(&hash).unwrap(), bytes);
    // B edits newer and pushes; A pulls.
    let mut edited = b.get(&l.id).unwrap().unwrap();
    edited.title = "Edited on B".into();
    edited.updated_at = "2026-02-01T00:00:00Z".into();
    edited.revision = 2;
    edited.device_id = "device-b".into();
    b.put(&edited).unwrap();
    assert_eq!(
        push_local(&client, &b, &bst, "device-b")
            .await
            .unwrap()
            .pushed,
        1
    );
    assert_eq!(pull(&client, &mut a, &ast, None).await.unwrap().pulled, 1);
    assert_eq!(a.get(&l.id).unwrap().unwrap().title, "Edited on B");
    // Older A write is a deterministic conflict, not an overwrite.
    let mut stale = a.get(&l.id).unwrap().unwrap();
    stale.title = "Stale".into();
    stale.updated_at = "2025-12-01T00:00:00Z".into();
    stale.revision = 9;
    stale.device_id = "device-a".into();
    a.put(&stale).unwrap();
    let resp = client.push("device-a", &[stale]).await.unwrap();
    assert_eq!(resp.conflicts, vec![l.id.clone()]);
    // Tombstone propagates.
    b.tombstone(&l.id, "device-b").unwrap();
    push_local(&client, &b, &bst, "device-b").await.unwrap();
    pull(&client, &mut a, &ast, None).await.unwrap();
    assert!(a.get(&l.id).unwrap().unwrap().deleted);
    assert!(a.all(false).unwrap().is_empty());
    // Hash mismatch is rejected.
    assert!(client
        .put_image(&hash_bytes(b"other"), b"different")
        .await
        .is_err());
    h.shutdown().await.unwrap();
}
#[tokio::test]
async fn manifest_since_is_incremental_and_complete_fields_round_trip() {
    let (h, _sdir, client) = server().await;
    let (a, ast, _ad) = local();
    let mut l = lineup("Full fields", "2026-03-01T00:00:00Z", "device-a", 3);
    l.tags = vec!["tag".into()];
    l.attributes
        .insert("chargeStage".into(), serde_json::json!(2));
    l.legacy.insert("future".into(), serde_json::json!({"x":1}));
    l.stand1_pos = Some(Point { x: 0.1, y: 0.2 });
    l.land_pos = Some(Point { x: 0.8, y: 0.9 });
    a.put(&l).unwrap();
    push_local(&client, &a, &ast, "device-a").await.unwrap();
    let m = client.manifest(Some("2026-02-01T00:00:00Z")).await.unwrap();
    assert_eq!(m.entries.len(), 1);
    assert_eq!(m.entries[0].revision, 3);
    assert_eq!(m.entries[0].device_id, "device-a");
    let old = client.manifest(Some("2026-04-01T00:00:00Z")).await.unwrap();
    assert!(old.entries.is_empty());
    let full = client.lineups(&[l.id.clone()]).await.unwrap();
    assert_eq!(full[0].legacy["future"]["x"], 1);
    assert_eq!(full[0].land_pos, l.land_pos);
    assert_eq!(full[0].tags, l.tags);
    h.shutdown().await.unwrap();
}

#[tokio::test]
async fn open_lan_download_is_additive_resumable_and_never_requests_empty_image_route() {
    let _dir = tempfile::tempdir().unwrap();
    let h = spawn(ServerConfig {
        bind: "127.0.0.1:0".parse().unwrap(),
        data_dir: _dir.path().into(),
        name: "open".into(),
        pairing_code: None,
        require_pairing_code: false,
        advertise_mdns: false,
    })
    .await
    .unwrap();
    let base = format!("http://{}", h.addr);
    let p = SyncClient::connect(&base, "phone").await.unwrap();
    let client = SyncClient::new(&base, p.token);
    let (host, hs, _hd) = local();
    let (mut phone, ps, _pd) = local();
    let hash = hs.put(b"offline image").unwrap();
    let mut l = lineup("Offline", "2026-01-01T00:00:00Z", "desktop", 1);
    l.slot_mut(Slot::Aim1).image = Some(hash.clone());
    l.slot_mut(Slot::Stand1).image = Some("".into()); // legacy blank must not GET /images/
    l.slot_mut(Slot::Stand2).image = Some("missing-image".into()); // invalid warning, not fatal
    host.put(&l).unwrap();
    push_local(&client, &host, &hs, "desktop").await.unwrap();
    let mut phases = vec![];
    let r = download_library(&client, &mut phone, &ps, |p| phases.push(p.phase))
        .await
        .unwrap();
    assert_eq!((r.downloaded, r.images, r.failed), (1, 1, 1));
    assert!(ps.has(&hash));
    assert!(
        phases.contains(&"manifest".to_string())
            && phases.contains(&"images".to_string())
            && phases.contains(&"complete".to_string())
    );
    let again = download_library(&client, &mut phone, &ps, |_| {})
        .await
        .unwrap();
    assert_eq!((again.downloaded, again.existing, again.images), (0, 1, 0));
    assert_eq!(again.failed, 1);
    host.tombstone(&l.id, "desktop").unwrap();
    push_local(&client, &host, &hs, "desktop").await.unwrap();
    download_library(&client, &mut phone, &ps, |_| {})
        .await
        .unwrap();
    assert_eq!(phone.get(&l.id).unwrap().unwrap().title, "Offline");
    assert!(ps.has(&hash));
    assert!(client.image("").await.is_err());
    h.shutdown().await.unwrap();
}

#[tokio::test]
async fn discovery_probe_rejects_stopped_server_and_stale_cache_candidates() {
    let (h, _dir, _client) = server().await;
    let base = format!("http://{}", h.addr);
    assert!(probe_server(&base).await);
    h.shutdown().await.unwrap();
    // A cached mDNS entry may still contain this address, but the live health
    // probe must remove it from Find desktop results.
    assert!(!probe_server(&base).await);
}

#[tokio::test]
async fn download_persists_lineups_for_open_and_fresh_library_connections() {
    let (h, dir, client) = server().await;
    let server_db = Database::open(dir.path().join("lineuplab.sqlite3")).unwrap();
    let mut l = lineup("Downloaded", "2026-01-01T00:00:00Z", "desktop", 1);
    l.draft = false;
    server_db.put(&l).unwrap();
    drop(server_db);
    let phone_path = dir.path().join("phone.sqlite3");
    let mut phone = Database::open(&phone_path).unwrap();
    // Browse keeps a managed connection open while SyncSettings downloads on
    // another connection. It must see the committed rows without a restart.
    let browse = Database::open(&phone_path).unwrap();
    let store = MediaStore::new(dir.path().join("phone-media")).unwrap();
    let report = download_library(&client, &mut phone, &store, |_| {})
        .await
        .unwrap();
    assert_eq!(report.downloaded, 1);
    assert_eq!(browse.get(&l.id).unwrap().unwrap().title, "Downloaded");
    drop(phone);
    let reopened = Database::open(&phone_path).unwrap();
    assert_eq!(reopened.get(&l.id).unwrap().unwrap().title, "Downloaded");
    h.shutdown().await.unwrap();
}
