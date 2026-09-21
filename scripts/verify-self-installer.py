#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: verify-self-installer.py <assembled-root>")

root = Path(sys.argv[1])
manifest = root / "AndroidManifest.xml"
main = root / "src/com/synthia/autonomy/MainActivity.java"
manager = root / "src/com/synthia/autonomy/GitHubUpdateManager.java"
index = root / "assets/web/index.html"
ui = root / "assets/web/github-self-update.mjs"

for path in (manifest, main, manager, index, ui):
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"self-installer wiring failed; missing: {path}")

manifest_text = manifest.read_text()
main_text = main.read_text()
manager_text = manager.read_text()
html = index.read_text()
ui_text = ui.read_text()

required_manifest = [
    "android.permission.REQUEST_INSTALL_PACKAGES",
    'android:launchMode="singleTop"',
]
required_main = [
    "GitHubUpdateManager updateManager",
    "new GitHubUpdateManager(this, webView)",
    "updateManager.handleInstallIntent(getIntent())",
    "protected void onNewIntent(Intent intent)",
    "public String updateStatus()",
    "public String updateCheck()",
    "public String updateDownload()",
    "public String updateInstall()",
    "public String updateInstallPermission()",
]
required_manager = [
    "PackageInstaller",
    "canRequestPackageInstalls",
    "STATUS_PENDING_USER_ACTION",
    "USER_ACTION_REQUIRED",
    "apk-sha256-mismatch",
    "apk-package-name-mismatch",
    "apk-version-code-mismatch",
    "apk-is-not-newer",
    "signing-certificate-mismatch",
    "GET_SIGNING_CERTIFICATES",
    "https-required",
    "SELF_REPOSITORY",
]
required_ui = [
    "bridge.updateCheck()",
    "bridge.updateDownload()",
    "bridge.updateInstall()",
    "Android will show its own final installation approval screen",
    "Automatic check only. Download and installation always require user action.",
]

missing=[]
for x in required_manifest:
    if x not in manifest_text: missing.append("manifest:"+x)
for x in required_main:
    if x not in main_text: missing.append("main:"+x)
for x in required_manager:
    if x not in manager_text: missing.append("manager:"+x)
for x in required_ui:
    if x not in ui_text: missing.append("ui:"+x)
if "./github-self-update.mjs" not in html:
    missing.append("index:self-update-module")
if "./adaptive-seed.mjs" not in html:
    missing.append("index:adaptive-module")
elif html.index("./github-self-update.mjs") < html.index("./adaptive-seed.mjs"):
    missing.append("index:self-update-must-load-after-adaptive")

if missing:
    raise SystemExit("self-installer verification failed; missing: " + ", ".join(missing))

print("Self-installer source wiring verified: signed GitHub update -> checksum/package/version/certificate verification -> Android PackageInstaller -> required system approval")
