use clap::{Parser, Subcommand};
use lineuplab_core::{db::Database, pack, storage::MediaStore};
use std::path::PathBuf;
#[derive(Parser)]
#[command(
    name = "lineuplab-pack",
    version,
    about = "Inspect, import and export legacy ValLineups packs"
)]
struct Cli {
    #[arg(long, default_value = "lineuplab-data", global = true)]
    data_dir: PathBuf,
    #[command(subcommand)]
    command: Command,
}
#[derive(Subcommand)]
enum Command {
    /// Validate and summarize a pack without changing the library.
    Inspect { zip: PathBuf },
    /// Preview by default; pass --commit to apply the selected entries.
    Import {
        zip: PathBuf,
        #[arg(long)]
        commit: bool,
        #[arg(long, value_enum, default_value = "overwrite-if-newer")]
        policy: pack::ConflictPolicy,
        #[arg(long)]
        all: bool,
        #[arg(long)]
        seed: bool,
    },
    /// Export the library, or a map/agent subset, as the same legacy ZIP format.
    Export {
        zip: PathBuf,
        #[arg(long)]
        map: Option<String>,
        #[arg(long)]
        agent: Option<String>,
        #[arg(long)]
        name: Option<String>,
        #[arg(long)]
        no_legacy_images: bool,
        #[arg(long)]
        bake: bool,
    },
    /// Soft-delete new imports / restore overwritten records so the undo syncs.
    Undo { batch_id: String },
}
fn main() -> anyhow::Result<()> {
    lineuplab_core::logging::init();
    let cli = Cli::parse();
    let mut db = Database::open(cli.data_dir.join("lineuplab.sqlite"))?;
    let store = MediaStore::new(cli.data_dir.join("media"))?;
    match cli.command {
        Command::Inspect { zip } => println!(
            "{}",
            serde_json::to_string_pretty(&pack::inspect(&std::fs::read(zip)?)?)?
        ),
        Command::Import {
            zip,
            commit,
            policy,
            all,
            seed,
        } => {
            let bytes = std::fs::read(zip)?;
            let archive = pack::read_archive(&bytes)?;
            let preview = pack::preview(&archive, &db)?;
            if !commit {
                println!("{}", serde_json::to_string_pretty(&preview)?);
                return Ok(());
            }
            let selected = preview
                .entries
                .iter()
                .filter(|e| {
                    if all {
                        seed || !archive.manifest.is_seed_placeholder
                            || e.status != pack::ImportStatus::Error
                    } else {
                        seed || e.selected
                    }
                })
                .map(|e| e.id.clone())
                .collect();
            let report = pack::commit(&mut db, &store, &archive, &preview, &selected, policy)?;
            println!("{}", serde_json::to_string_pretty(&report)?);
        }
        Command::Export {
            zip,
            map,
            agent,
            name,
            no_legacy_images,
            bake,
        } => {
            let filter = lineuplab_core::LineupFilter {
                map_id: map,
                agent_id: agent,
                ..Default::default()
            };
            let lineups = db.filter(&filter)?;
            let options = pack::ExportOptions {
                name: name.unwrap_or_else(|| "LineupLab export".into()),
                legacy_compatible_images: !no_legacy_images,
                bake_annotations: bake,
                ..Default::default()
            };
            let bytes = pack::export(&db, &store, &lineups, &options)?;
            if let Some(p) = zip.parent() {
                std::fs::create_dir_all(p)?;
            }
            std::fs::write(zip, bytes)?;
            println!("Exported {} lineups", lineups.len());
        }
        Command::Undo { batch_id } => println!(
            "{}",
            serde_json::to_string_pretty(&pack::undo_import(&mut db, &batch_id)?)?
        ),
    }
    Ok(())
}
