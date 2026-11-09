# Releasing LineupLab

This document explains how to create Windows and Android releases via GitHub Actions.

## Prerequisites

- Tag follows `v*` (e.g. `v0.1.0`)
- Workflows require `contents: write` permission (already set)
- Windows build runs on `windows-latest`, Android on `ubuntu-latest`

## Creating a release

```bash
git tag v0.1.0
git push --tags
# or via workflow_dispatch in GitHub Actions UI
```

The `release.yml` workflow will:
1. Build Windows NSIS installer `.exe` via `tauri-action`
2. Build Android APK (signed if secrets present, else debug)
3. Create/update a GitHub Release with artifacts:
   - `LineupLab-<version>-windows-setup.exe`
   - `LineupLab-<version>-android.apk`
   - `SHA256SUMS.txt`

## Android signing (once)

Generate a keystore locally:

```bash
keytool -genkey -v -keystore lineuplab-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias lineuplab
# choose passwords, fill prompts
```

Encode and add to GitHub Secrets (`Settings → Secrets and variables → Actions`):

```bash
base64 -w 0 lineuplab-release.jks
# copy output to secret ANDROID_KEYSTORE_BASE64
```

Add three more secrets:
- `ANDROID_KEYSTORE_PASSWORD` - the store password
- `ANDROID_KEY_ALIAS` - `lineuplab`
- `ANDROID_KEY_PASSWORD` - the key password (often same as store password)

If secrets are absent, the workflow falls back to the debug keystore so the APK still installs (with a warning in logs). Debug APKs are installable but not suitable for Play Store.

CI will place the keystore at `/tmp/keystore.jks` and Tauri will sign automatically.

## Installing the artifacts

### Windows

Download `LineupLab-<version>-windows-setup.exe` from the Release page.
Windows SmartScreen will warn for unsigned installers ("Unknown publisher" / "Windows protected your PC"). Click **More info → Run anyway** (or sign later with a paid cert).

The portable `.exe` (if present) needs no installer.

### Android

Download `LineupLab-<version>-android.apk` on your device.
Enable **Install unknown apps** for your browser/file manager if prompted.
Minimum SDK 26 (Android 8.0).

## Manual QA (Linux)

You cannot run Windows/Android builds locally on Linux:

```bash
npm run build   # must pass
cargo check     # must pass (requires Rust, not available in this CI sandbox)
```

Validate YAML:

```bash
npx actionlint .github/workflows/*.yml
# or use https://rhysd.github.io/actionlint/
```

## Versioning

Tag and `tauri.conf.json` version should match (bump both before release).

## Troubleshooting

- `ANDROID_KEYSTORE_BASE64 invalid` → re-encode without newlines (`base64 -w 0`)
- `sdkmanager not found` → ensure `android-actions/setup-android@v3` is used
- Windows build fails on `tauri-action` → check `beforeBuildCommand` runs (`npm run build` must succeed)
