# Stellar self-install / self-update channel

## What "self installing" means on Android

The first installation must still be approved by Android. After Stellar is installed, the app can:

1. check its own GitHub release channel;
2. detect a newer version;
3. download the APK itself;
4. verify the release SHA-256;
5. verify the package name;
6. verify the version is newer;
7. verify the APK has the same signing certificate as the installed app;
8. create an Android PackageInstaller session;
9. open Android's required final approval screen;
10. receive the install result back in Stellar.

The app cannot silently bypass Android's install confirmation as an ordinary user-installed application. Silent unattended installation requires privileged/root/device-owner conditions and is intentionally not claimed here.

## User interface

The installed app exposes one primary control:

**INSTALL / UPDATE STELLAR**

One tap performs the application-controlled portion of the flow:

`check -> download -> verify -> handoff to Android installer`

If Android requires its one-time "Allow from this source" setting, Stellar opens that setting and resumes when the user returns.

Android's own final Install/Update confirmation remains visible because ordinary user-installed Android apps cannot bypass it.

Technical details and the generic GitHub APK browser are moved under a collapsed Advanced details section.

The app may check for availability automatically in the background. It does not begin the download/install flow until the user presses the one-button control.

## Release trust chain

Self-update depends on a stable signing certificate.

The publishing workflow refuses to create update releases unless these repository Actions secrets exist:

- `STELLAR_KEYSTORE_B64`
- `STELLAR_SIGNING_PASSWORD`

This is deliberate. A fresh signing key on every build would make Android reject upgrades.

The update release workflow is gated to `main` or explicit manual dispatch. Integration-branch verification does not publish a release.

## Update release contents

A release publishes:

- `Stellar-Proximology.apk`
- `Stellar-Proximology.apk.sha256`
- `stellar-update.json`
- `Stellar-Proximology-source.zip`

The manifest records package name, version code/name, commit SHA, APK asset name, SHA-256 and byte size.

## Verification status

Build verification can prove the updater is compiled, packaged and connected to the Android bridge.

Actual self-update becomes device-VERIFIED only after a stable-signed bootstrap APK is installed and a later APK signed by the same key successfully updates it through:

`check -> download -> verify -> PackageInstaller -> Android approval -> installed`
