# DeenPath build and install


The current release is v0.3.4, versionCode 7. Updated artifacts are in `deliverables/v0.3.4/`. Install over the original app using the same signing key; do not uninstall or clear app data. The original v0.1.0 artifacts are retained. See the current testing report and checksums.

## Prerequisites

- Node 22.20+ and npm; install the lockfile with `npm ci`.
- JDK 21; Android Studio with SDK Platform 36 and Build Tools 36.0.0.
- A compatible Android System WebView on the device.
- Android 10/API 29 minimum; compile/target SDK 36 in this project.

There is no Firebase configuration or Google Services Gradle plugin. Android Gradle Plugin is 8.13.0, Gradle wrapper 8.14.3, Kotlin 2.2.20. Versions are explicit in the committed project. `android/gradlew` and `gradlew.bat` are included.

## Standard build

```
npm ci
npm test
php tests/backend.php
npm run check:php
npm run android:sync
cd android
gradlew.bat assembleDebug
```

On macOS/Linux use `./gradlew assembleDebug` (make the wrapper executable if the filesystem did not retain its executable bit). Debug output: `android/app/build/outputs/apk/debug/app-debug.apk`. Never distribute an older APK after changing React code without rerunning `npm run android:sync` and Gradle.

Set `JAVA_HOME` to JDK 21 and `ANDROID_HOME` to the SDK, or open `android/` in Android Studio and let it create ignored `local.properties`. Do not commit machine paths.

## Portable tools used in this workspace

The optional ignored `.tools/` directory is a development convenience, not part of the source or hosting upload. `node scripts/fetch-build-tools.mjs` downloads Windows JDK 21 from Adoptium and Android command-line tools from Google using verified HTTPS endpoints and range downloads. It does not install them globally. Extract the archives, run `sdkmanager` for SDK 36/build-tools/platform-tools, and review the SDK license before using the tools. Keep `ANDROID_USER_HOME` and `GRADLE_USER_HOME` inside `.tools/` when using the restricted workspace. Android Studio remains the recommended user-facing setup.

## Install on a real phone

1. Copy the debug APK to the phone. Allow installation from that specific file manager when Android asks, then install. Disable that permission afterward if desired.
2. Alternatively enable Developer Options → USB debugging and use `adb install -r app-debug.apk` with an authorized USB device.
3. Open DeenPath, confirm city/coordinates/time zone and method under Settings. Do not rely on the default Karachi location if traveling or living elsewhere.
4. Enable Prayer Reminders and allow notifications on Android 13+. Exact alarms require a separate Alarms & Reminders grant on relevant versions; denial uses an inexact fallback.
5. Under Settings, tap Notification sound to open Android's native picker. Choose Arabic + English or Arabic + Urdu for Quran reminder translation, then use Test notification. Per-stage sounds are optional. Android notification volume, silent mode, DND and channel settings still control playback.
6. Configure the existing HTTPS API URL only after deployment. Register and sync, then test airplane mode and reconnect.

## Signed release

Use Android Studio → Build → Generate Signed App Bundle or APK → APK → Create/choose keystore. Store the keystore outside the repository with a secure backup. Use a unique strong password, never the debug signing key. Choose the release variant and retain the same signing key for all future updates. Android refuses updates signed by a different key.

Increase `versionCode` and `versionName` in `android/app/build.gradle` for each release. Run the checks and `npm run android:sync` first. Android Studio can sign interactively without committing passwords or `key.properties`. A CLI release build is unsigned until a signing configuration is provided privately; `assembleRelease` alone is not proof of a distributable signed release.

Verify the final APK with SDK `apksigner verify --verbose PATH.apk` and calculate its SHA-256. Follow [RELEASE.md](RELEASE.md). A compiled debug APK proves compilation and packaging, not physical-device behavior or production security.
