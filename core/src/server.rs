//! Opt-in trusted-LAN sharing. Plain HTTP + bearer tokens; no pairing code by default.
//! Bind only to trusted LAN interfaces, never expose to the Internet. See docs/SYNC.md.
//! All routes except /pair, /connect and /health require a token.
use crate::{
    db::Database,
    storage::{hash_bytes, MediaStore},
    sync::{self, PushRequest, PushResponse, PROTOCOL_VERSION},
    Error, Result,
};
use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::StatusCode,
    middleware::{self, Next},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use rand::Rng;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::{BTreeSet, VecDeque},
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use subtle::ConstantTimeEq;
use tokio::{net::TcpListener, sync::oneshot, task::JoinHandle};

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub bind: SocketAddr,
    pub data_dir: std::path::PathBuf,
    pub name: String,
    pub pairing_code: Option<String>,
    /// No-code sharing is the default; a configured code remains enforced.
    pub require_pairing_code: bool,
    pub advertise_mdns: bool,
}
impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            bind: "0.0.0.0:8765".parse().unwrap(),
            data_dir: std::path::PathBuf::from("."),
            name: "LineupLab".into(),
            pairing_code: None,
            require_pairing_code: false,
            advertise_mdns: true,
        }
    }
}
pub struct ServerHandle {
    pub addr: SocketAddr,
    pub pairing_code: String,
    pub require_pairing_code: bool,
    pub join: JoinHandle<Result<()>>,
    shutdown: Option<oneshot::Sender<()>>,
    mdns: Option<(mdns_sd::ServiceDaemon, String)>,
}
impl ServerHandle {
    pub async fn shutdown(mut self) -> Result<()> {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
        if let Some((daemon, fullname)) = &self.mdns {
            if let Ok(rx) = daemon.unregister(fullname) {
                let _ = rx.recv_timeout(Duration::from_secs(1));
            }
            if let Ok(rx) = daemon.shutdown() {
                let _ = rx.recv_timeout(Duration::from_secs(1));
            }
        }
        self.join.await.map_err(|e| Error::Invalid(e.to_string()))?
    }
}
struct ServerState {
    db: Mutex<Database>,
    store: MediaStore,
    device_id: String,
    name: String,
    pairing_code: String,
    require_pairing_code: bool,
    tokens: Mutex<BTreeSet<String>>,
    tokens_path: std::path::PathBuf,
    attempts: Mutex<VecDeque<Instant>>,
}
fn unauthorized() -> axum::response::Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({"error":"unauthorized"})),
    )
        .into_response()
}
fn ct_eq(a: &str, b: &str) -> bool {
    a.as_bytes().ct_eq(b.as_bytes()).into()
}
async fn auth(
    State(st): State<Arc<ServerState>>,
    req: axum::extract::Request,
    next: Next,
) -> axum::response::Response {
    let path = req.uri().path();
    if path == "/pair" || path == "/health" || path == "/connect" {
        return next.run(req).await;
    }
    let token = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or("");
    if token.is_empty() || !st.tokens.lock().unwrap().iter().any(|t| ct_eq(t, token)) {
        return unauthorized();
    }
    next.run(req).await
}
#[derive(Deserialize)]
struct PairBody {
    code: String,
    #[serde(default)]
    device_name: String,
}
fn issue_token(st: &ServerState, device: &str) -> axum::response::Response {
    let token = uuid::Uuid::new_v4().simple().to_string();
    {
        let mut tokens = st.tokens.lock().unwrap();
        tokens.insert(token.clone());
        if let Err(e) = std::fs::write(
            &st.tokens_path,
            serde_json::to_vec_pretty(&*tokens).unwrap_or_default(),
        ) {
            tracing::error!(error=%e, "Could not persist download token");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "could not save connection",
            )
                .into_response();
        }
    }
    tracing::info!(%device, "Connected download client");
    (StatusCode::OK, Json(json!({"token":token,"serverName":st.name,"deviceId":st.device_id,"protocolVersion":PROTOCOL_VERSION}))).into_response()
}
async fn connect(
    State(st): State<Arc<ServerState>>,
    Json(body): Json<ConnectBody>,
) -> axum::response::Response {
    if st.require_pairing_code {
        return unauthorized();
    }
    issue_token(&st, &body.device_name)
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConnectBody {
    #[serde(default)]
    device_name: String,
}
async fn pair(
    State(st): State<Arc<ServerState>>,
    Json(body): Json<PairBody>,
) -> axum::response::Response {
    if !st.require_pairing_code {
        return issue_token(&st, &body.device_name);
    }
    {
        let mut attempts = st.attempts.lock().unwrap();
        let now = Instant::now();
        while attempts
            .front()
            .is_some_and(|t| now.duration_since(*t) > Duration::from_secs(60))
        {
            attempts.pop_front();
        }
        if attempts.len() >= 10 {
            return (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({"error":"too many attempts; wait a minute"})),
            )
                .into_response();
        }
        attempts.push_back(now);
    }
    if !ct_eq(&body.code, &st.pairing_code) {
        return unauthorized();
    }
    issue_token(&st, &body.device_name)
}
async fn health() -> impl IntoResponse {
    Json(json!({"ok":true,"protocolVersion":PROTOCOL_VERSION}))
}
#[derive(Deserialize)]
struct ManifestQuery {
    since: Option<String>,
}
async fn manifest(
    State(st): State<Arc<ServerState>>,
    Query(q): Query<ManifestQuery>,
) -> impl IntoResponse {
    let db = st.db.lock().unwrap();
    let all = db.all(true).unwrap_or_default();
    Json(sync::manifest(&all, &st.device_id, q.since.as_deref()).unwrap())
}
#[derive(Deserialize)]
struct LineupsQuery {
    ids: Option<String>,
}
async fn lineups(
    State(st): State<Arc<ServerState>>,
    Query(q): Query<LineupsQuery>,
) -> axum::response::Response {
    let db = st.db.lock().unwrap();
    let ids: Option<BTreeSet<String>> = q.ids.map(|s| {
        s.split(',')
            .filter(|x| !x.is_empty())
            .map(String::from)
            .collect()
    });
    let all = db.all(true).unwrap_or_default();
    let out: Vec<Value> = all
        .into_iter()
        .filter(|l| ids.as_ref().map_or(true, |s| s.contains(&l.id)))
        .map(|l| serde_json::to_value(l).unwrap())
        .collect();
    Json(out).into_response()
}
async fn get_image(
    State(st): State<Arc<ServerState>>,
    Path(hash): Path<String>,
) -> axum::response::Response {
    if !crate::storage::valid_hash(&hash) {
        return (StatusCode::BAD_REQUEST, "invalid hash").into_response();
    }
    match st.store.get(&hash) {
        Ok(bytes) => (
            [(
                axum::http::header::CONTENT_TYPE,
                crate::storage::mime_for(&bytes),
            )],
            bytes,
        )
            .into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "missing image").into_response(),
    }
}
async fn put_image(
    State(st): State<Arc<ServerState>>,
    Path(hash): Path<String>,
    body: Bytes,
) -> axum::response::Response {
    if !crate::storage::valid_hash(&hash) || hash_bytes(&body) != hash {
        return (StatusCode::BAD_REQUEST, "hash mismatch").into_response();
    }
    match st.store.put(&body) {
        Ok(_) => (StatusCode::CREATED, Json(json!({"hash":hash}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
async fn push(
    State(st): State<Arc<ServerState>>,
    Json(req): Json<PushRequest>,
) -> impl IntoResponse {
    let db = st.db.lock().unwrap();
    let mut resp = PushResponse::default();
    for incoming in &req.lineups {
        let local = db.get(&incoming.id).unwrap_or(None);
        if sync::merge(local.as_ref(), incoming) {
            if db.put(incoming).is_ok() {
                resp.accepted.push(incoming.id.clone());
            }
        } else {
            resp.conflicts.push(incoming.id.clone());
        }
    }
    resp.cursor = db
        .all(true)
        .unwrap_or_default()
        .iter()
        .map(|l| l.updated_at.clone())
        .max()
        .unwrap_or_default();
    Json(resp)
}
fn router(st: Arc<ServerState>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/pair", post(pair))
        .route("/connect", post(connect))
        .route("/manifest", get(manifest))
        .route("/lineups", get(lineups))
        .route("/images/{hash}", get(get_image).put(put_image))
        .route("/push", post(push))
        .layer(middleware::from_fn_with_state(st.clone(), auth))
        .layer(DefaultBodyLimit::max(64 * 1024 * 1024))
        .with_state(st)
}
fn local_ip() -> std::net::IpAddr {
    std::net::UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("8.8.8.8:80")?;
            s.local_addr()
        })
        .map(|a| a.ip())
        .unwrap_or_else(|_| "127.0.0.1".parse().unwrap())
}
pub async fn spawn(config: ServerConfig) -> Result<ServerHandle> {
    crate::ensure_crypto_provider();
    std::fs::create_dir_all(&config.data_dir)?;
    let db = Database::open(config.data_dir.join("lineuplab.sqlite3"))?;
    let store = MediaStore::new(config.data_dir.join("media"))?;
    let device_id = match db.metadata("deviceId")? {
        Some(Value::String(s)) => s,
        _ => {
            let id = uuid::Uuid::new_v4().to_string();
            db.set_metadata("deviceId", &json!(id))?;
            id
        }
    };
    let pairing_code = config
        .pairing_code
        .clone()
        .unwrap_or_else(|| format!("{:06}", rand::thread_rng().gen_range(0..1_000_000)));
    let tokens_path = config.data_dir.join("tokens.json");
    let tokens: BTreeSet<String> = std::fs::read(&tokens_path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default();
    let st = Arc::new(ServerState {
        db: Mutex::new(db),
        store,
        device_id: device_id.clone(),
        name: config.name.clone(),
        pairing_code: pairing_code.clone(),
        require_pairing_code: config.require_pairing_code,
        tokens: Mutex::new(tokens),
        tokens_path,
        attempts: Mutex::new(VecDeque::new()),
    });
    let listener = TcpListener::bind(config.bind).await?;
    let addr = listener.local_addr()?;
    let mdns = if config.advertise_mdns {
        let daemon = mdns_sd::ServiceDaemon::new().map_err(|e| Error::Invalid(e.to_string()))?;
        let ip = local_ip();
        let host = format!("lineuplab-{}.local.", &device_id[..8]);
        match mdns_sd::ServiceInfo::new(
            "_lineuplab._tcp.local.",
            &config.name,
            &host,
            ip.to_string().as_str(),
            addr.port(),
            [("protocol".to_string(), PROTOCOL_VERSION.to_string())].as_slice(),
        ) {
            Ok(info) => {
                let fullname = info.get_fullname().to_string();
                let _ = daemon.register(info);
                Some((daemon, fullname))
            }
            Err(e) => {
                tracing::warn!(error=%e, "mDNS registration failed");
                None
            }
        }
    } else {
        None
    };
    let (tx, rx) = oneshot::channel();
    let app = router(st);
    let join = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await
            .map_err(|e| Error::Invalid(e.to_string()))?;
        Ok(())
    });
    tracing::info!(%addr, code=%pairing_code, "LineupLab sync server listening (opt-in LAN only)");
    Ok(ServerHandle {
        addr,
        pairing_code,
        require_pairing_code: config.require_pairing_code,
        join,
        shutdown: Some(tx),
        mdns,
    })
}
