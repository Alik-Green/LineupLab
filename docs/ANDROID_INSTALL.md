# Android companion installation (Preview 6)

## Which APK to install

Install `LineupLab-Companion-0.1.0-preview.6-arm64-v8a.apk` on modern 64-bit Android phones, including Google Pixel 9. Preview 6 continues to ship an **arm64-v8a-only** APK instead of the earlier universal APK. Universal/32-bit packaging produced device-incompatible install reports on some modern 64-bit phones; the release job rejects any APK that contains non-arm64 native libraries.

Requirements:

- Android 8.0 / API 26 or newer.
- 64-bit ARM processor (arm64-v8a). Pixel 9 is supported by this ABI.
- Allow installs from the browser/file manager you use: Settings → Apps → Special app access → Install unknown apps.
- If a previous preview was signed with a different ephemeral CI key, uninstall it first. Preview signing keys are not production identities and may change between releases.

## After installing

1. On the desktop, open Settings → Sharing and start sharing on a trusted LAN.
2. On the phone, open **Download**, tap **Find desktop** or enter the desktop address, then tap **Connect & download**.
3. The library is saved for offline browsing and Browse refreshes after completion/relaunch. Stopping desktop sharing removes the live discovery result; a remembered address may remain editable but will fail cleanly if the server is gone.

## What CI verifies

The Android workflow builds split APKs with NDK r28, target SDK 36, minimum SDK 26, and 16 KB page-size linker alignment. It uploads `aapt dump badging` diagnostics with the APK artifact. The release job additionally:

1. selects exactly one arm64-v8a release APK;
2. checks package ID `app.lineuplab.companion`, min SDK 26, target SDK 36, and arm64-only native code;
3. ZIP-aligns uncompressed native libraries for 16 KB pages;
4. signs with an ephemeral preview certificate and verifies the signature;
5. publishes SHA-256 checksums.

These are packaging checks, not a physical-device or gameplay validation. If Android still says “You can't install this app on your device”, capture the exact wording and, if possible, `adb install` output; the failure code distinguishes ABI, SDK, signature, and Play Protect blocks.
