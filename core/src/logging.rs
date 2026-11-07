/// Structured JSON logs. RUST_LOG accepts trace/debug/info/warn/error/off.
pub fn init() {
    let level = match std::env::var("RUST_LOG")
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "trace" => tracing::level_filters::LevelFilter::TRACE,
        "debug" => tracing::level_filters::LevelFilter::DEBUG,
        "warn" => tracing::level_filters::LevelFilter::WARN,
        "error" => tracing::level_filters::LevelFilter::ERROR,
        "off" => tracing::level_filters::LevelFilter::OFF,
        _ => tracing::level_filters::LevelFilter::INFO,
    };
    let _ = tracing_subscriber::fmt()
        .json()
        .with_max_level(level)
        .with_current_span(false)
        .with_target(true)
        .try_init();
}
