use clap::Parser;
use lineuplab_core::server::{spawn, ServerConfig};
#[derive(Parser)]
#[command(
    name = "lineuplab-server",
    about = "Opt-in LineupLab LAN sync server (HTTP + pairing token; trusted LAN only)"
)]
struct Args {
    #[arg(long, default_value = ".lineuplab")]
    data_dir: std::path::PathBuf,
    #[arg(long, default_value = "0.0.0.0:8765")]
    bind: std::net::SocketAddr,
    #[arg(long, default_value = "LineupLab")]
    name: String,
    /// Fixed six-digit code (otherwise random, printed once)
    #[arg(long)]
    pairing_code: Option<String>,
    #[arg(long)]
    no_mdns: bool,
}
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    lineuplab_core::logging::init();
    let args = Args::parse();
    let handle = spawn(ServerConfig {
        bind: args.bind,
        data_dir: args.data_dir,
        name: args.name,
        require_pairing_code: args.pairing_code.is_some(),
        pairing_code: args.pairing_code,
        advertise_mdns: !args.no_mdns,
    })
    .await?;
    println!("LineupLab sync server: http://{}", handle.addr);
    println!(
        "Access code: {}  (not required = one-tap trusted-LAN download)",
        if handle.require_pairing_code {
            &handle.pairing_code
        } else {
            "not required"
        }
    );
    println!("Security: trusted LAN only — plain HTTP + bearer token, not for Internet exposure. Ctrl+C to stop.");
    tokio::signal::ctrl_c().await?;
    handle.shutdown().await?;
    Ok(())
}
