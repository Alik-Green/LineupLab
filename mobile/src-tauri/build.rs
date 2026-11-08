fn main() {
    // Android 15+ 16 KB page-size devices: align ELF LOAD segments as well as
    // ZIP entries. Tauri's Gradle runner overrides .cargo/config rustflags.
    if std::env::var("TARGET").unwrap_or_default().contains("android") {
        println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg=-Wl,-z,common-page-size=16384");
    }
    tauri_build::build()
}
