# Android placeholder

This folder is created by `tauri android init`. Full Android project is generated in CI via:

```bash
tauri android init
```

Because Rust/Android SDK are not available in the Linux preview sandbox, the full generated tree is not committed here; CI will generate it on `ubuntu-latest` (see `.github/workflows/release.yml`).

To generate locally (Windows/macOS/Linux with Android Studio):

```bash
npm run tauri android init
```

Minimum SDK 26, targets: aarch64-linux-android, armv7-linux-androideabi, i686-linux-android, x86_64-linux-android (NDK 26.1.10909125).
