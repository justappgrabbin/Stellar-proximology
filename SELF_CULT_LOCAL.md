# Self Cult of Agents — local-first Android pilot
The requested **external-server-free** Android variant is supplied by [self-cult-local-source.zip](self-cult-local-source.zip), preserving the previous server-backed pilot for comparison.

- Each Android install has its own local event-sourced state space and bounded executable primitive engine.
- Two phones can pair by sharing a private SC1 invitation and synchronize directly on the same Wi-Fi/hotspot using encrypted TCP packets (AES-GCM).
- A participant remains functional offline and can work without the other device.
- Each participant controls their projects and private model instructions. Private earnings/contributions never leave the device.
- Cross-project execution requires both project owners' recorded approvals; outcomes and receipts can be replayed locally.
- This pilot has no server, no internet-wide networking, no model weights, and no autonomous model inference. The full Synthia StateSpace, Klein, ATO and Tool Factory are not yet integrated into this bounded pilot.
- Read `self-cult/ANDROID_LOCAL_FIRST.md` inside the ZIP for pairing steps and limitations.
- The Android application ID is `org.selfcult.agents.local`, different from the old URL launcher, so both versions can coexist.

CI pipeline [Build Self Cult Local APK](.github/workflows/self-cult-local-android.yml) verifies the source and outputs a development-signed APK. This does not prove physical two-phone pairing; it requires installation tests. Source is a ZIP in the repository to avoid overwriting older verified Stellar source trees.
