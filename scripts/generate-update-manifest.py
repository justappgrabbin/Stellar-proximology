#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ANDROID = "{http://schemas.android.com/apk/res/android}"

parser = argparse.ArgumentParser()
parser.add_argument("--apk", required=True)
parser.add_argument("--manifest", required=True)
parser.add_argument("--repository", required=True)
parser.add_argument("--commit", required=True)
parser.add_argument("--out", required=True)
args = parser.parse_args()

apk = Path(args.apk)
manifest_path = Path(args.manifest)
out = Path(args.out)

if not apk.is_file():
    raise SystemExit(f"APK not found: {apk}")
if not manifest_path.is_file():
    raise SystemExit(f"AndroidManifest not found: {manifest_path}")

root = ET.fromstring(manifest_path.read_text(encoding="utf-8"))
package_name = root.attrib.get("package")
version_code = int(root.attrib[ANDROID + "versionCode"])
version_name = root.attrib[ANDROID + "versionName"]

digest = hashlib.sha256()
with apk.open("rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
        digest.update(chunk)
sha256 = digest.hexdigest()

payload = {
    "schema": "stellar.self-update.v1",
    "repository": args.repository,
    "packageName": package_name,
    "versionCode": version_code,
    "versionName": version_name,
    "commitSha": args.commit,
    "apkAsset": apk.name,
    "sha256": sha256,
    "bytes": apk.stat().st_size,
}

out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
(out.parent / f"{apk.name}.sha256").write_text(
    f"{sha256}  {apk.name}\n",
    encoding="utf-8",
)

print(json.dumps(payload))
