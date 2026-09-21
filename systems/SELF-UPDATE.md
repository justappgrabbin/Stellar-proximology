# GitHub Self-Update Channel

Branch: `stellar-computer-assembly`

## Behavior

The Android app now has a self-hosted GitHub update channel.

### Automatic behavior

On app start:

1. the local UI asks the native Android bridge to check the latest GitHub Release;
2. the app compares the release `versionCode` with the installed `versionCode`;
3. if a newer release exists, the UPDATE indicator lights up.

**The app does not automatically download or install anything.**

### User-approved update flow

1. User opens **UPDATE**.
2. User taps **Download update APK**.
3. The native updater downloads `Stellar-Proximology.apk` from the latest GitHub Release.
4. It verifies:
   - repository
   - HTTPS GitHub release path
   - package name
   - monotonically newer versionCode
   - SHA-256 from `stellar-update.json`
   - Android signing certificate matches the installed app
5. User taps **Install downloaded update**.
6. If Android requires "install unknown apps" permission, the app opens the Android permission page.
7. Android's Package Installer presents the final system confirmation.
8. Only after that approval can the update replace the installed app.

The assembly never performs a silent install.

## GitHub APK browser

The same local panel can:

- query the latest Release of a public `owner/repository`;
- list APK assets;
- download a selected APK through Android DownloadManager into the public Downloads directory.

Generic downloaded APKs are **not** silently installed by this feature.

## GitHub release publisher

`.github/workflows/publish-self-update.yml` is the release producer.

For runtime-affecting pushes to `stellar-computer-assembly`, it is designed to:

1. assemble the preserved app;
2. assign a monotonically increasing Android versionCode;
3. build the APK;
4. sign it with the stable Stellar signing key;
5. generate:
   - `Stellar-Proximology.apk`
   - `Stellar-Proximology.apk.sha256`
   - `stellar-update.json`
   - `Stellar-Proximology-source.zip`
6. publish those files as the latest GitHub Release.

## Signing requirement

Android only accepts an update over an installed app when the new APK is signed by the same signing certificate.

The release workflow therefore requires these GitHub Actions secrets:

- `STELLAR_KEYSTORE_B64`
- `STELLAR_SIGNING_PASSWORD`

The workflow intentionally refuses to publish a self-update release if those secrets are absent. Publishing a randomly signed APK would create a download that Android cannot install over the current app.

Current observed GitHub state during this pass:

- updater source: PRESENT
- UI: PRESENT
- assembly injection: PRESENT
- Android build verification: running through GitHub Actions
- release publication: BLOCKED until the stable signing secrets exist
- GitHub Releases in this repository at the time checked: none

## Preservation

The original donor `MainActivity.donor.java` is not modified for this feature.

The updater bridge is injected by `scripts/patch_runtime.py` during assembly, preserving the donor source while changing the assembled application.
