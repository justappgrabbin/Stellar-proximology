# Self Cult of Agents — local-first Android v0.2
This is an **additive** version of the Self Cult of Agents pilot. The existing Stellar app and the previous hosted pilot are preserved unchanged.

The new **Android app runs without an external server or hosted web page**. Its HTML/CSS/JavaScript are packaged inside the APK. A native encrypted LAN listener runs while the app is visible. Each phone retains its own local state. Two participants on the same Wi-Fi or hotspot can share a pairing key, enter the peer's LAN IP, and explicitly sync authored events. Offline local functions remain available when disconnected.

The first implementation of shared agency is intentionally bounded: participants record their own projects; source/target project owners explicitly approve cross-project publication of composed text primitives; the resulting tools run locally with execution traces and relationship observations. The peer event exchange uses AES-GCM with a shared secret and a single paired peer. Private earnings/contributions and agent settings remain local.

**No Qwen/TinyLlama model weights or actual model inference are bundled. No canonical StateSpace/Klein/ATO integration or autonomous tool creation is claimed.** This is not internet-wide P2P, and real two-phone testing is still needed. Manual IP pairing and foreground app presence are required. The APK package ID is changed to `org.selfcult.agents.local` so it can coexist with the previous server-dependent launcher.

## Files

- [Local-first full source ZIP](self-cult-localfirst-source.zip) (includes detailed `self-cult/ANDROID_LOCAL_FIRST.md`, source and tests)
- [GitHub Actions Android build](.github/workflows/self-cult-android.yml)
- [Earlier hosted pilot archive, preserved](self-cult-source.zip)

The Android workflow's `Self-Cult-LocalFirst-APK` build artifact contains the installable development-signed APK, if CI compilation succeeds.
