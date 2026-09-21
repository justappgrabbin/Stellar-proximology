#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${1:-}"
MANIFEST="$ROOT/systems/SYSTEMS-MANIFEST.json"
PACKAGES="$ROOT/systems/packages"
INSTALLED="$ROOT/systems/installed"
REPOS="$ROOT/systems/repos"

if [[ -z "$SOURCE_DIR" || ! -d "$SOURCE_DIR" ]]; then
  echo "Usage: $0 /path/to/existing-package-folder" >&2
  exit 2
fi

command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 3; }
command -v unzip >/dev/null || { echo "unzip is required" >&2; exit 3; }
command -v git >/dev/null || { echo "git is required" >&2; exit 3; }

mkdir -p "$PACKAGES" "$INSTALLED" "$REPOS"

python3 - "$MANIFEST" "$SOURCE_DIR" "$PACKAGES" "$INSTALLED" <<'PY'
import hashlib, json, os, shutil, subprocess, sys, zipfile
manifest_path, source_dir, packages_dir, installed_dir = sys.argv[1:]

with open(manifest_path, "r", encoding="utf-8") as f:
    manifest = json.load(f)

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

missing = []
staged = []

for item in manifest["archives"]:
    src = os.path.join(source_dir, item["filename"])
    if not os.path.isfile(src):
        missing.append(item["filename"])
        continue

    actual = sha256(src)
    if actual != item["sha256"]:
        raise SystemExit(f"HASH MISMATCH: {item['filename']}\nexpected {item['sha256']}\nactual   {actual}")

    dst = os.path.join(packages_dir, item["filename"])
    if not os.path.exists(dst):
        shutil.copy2(src, dst)
    elif sha256(dst) != item["sha256"]:
        raise SystemExit(f"Existing staged package has wrong hash: {dst}")

    target = os.path.join(installed_dir, item["id"])
    os.makedirs(target, exist_ok=True)
    marker = os.path.join(target, ".stellar-source.json")

    if item["kind"] == "zip":
        if not os.path.exists(os.path.join(target, ".extracted")):
            with zipfile.ZipFile(dst) as z:
                z.extractall(target)
            open(os.path.join(target, ".extracted"), "w").close()
    elif item["kind"] == "apk":
        # APK is itself a whole runnable artifact. Preserve it intact.
        apk_dst = os.path.join(target, item["filename"])
        if not os.path.exists(apk_dst):
            shutil.copy2(dst, apk_dst)

    with open(marker, "w", encoding="utf-8") as f:
        json.dump(item, f, indent=2)
        f.write("\n")

    staged.append(item["id"])

print(f"STAGED {len(staged)} existing systems:")
for x in staged:
    print(f"  - {x}")

if missing:
    print(f"MISSING FROM SOURCE FOLDER {len(missing)}:")
    for x in missing:
        print(f"  - {x}")
PY

python3 - "$MANIFEST" "$REPOS" <<'PY'
import json, os, subprocess, sys
manifest_path, repos_dir = sys.argv[1:]
with open(manifest_path, "r", encoding="utf-8") as f:
    manifest = json.load(f)

for item in manifest["repositories"]:
    target = os.path.join(repos_dir, item["id"])
    url = f"https://github.com/{item['repository']}.git"
    if not os.path.isdir(os.path.join(target, ".git")):
        subprocess.run(["git", "clone", url, target], check=True)
    subprocess.run(["git", "-C", target, "fetch", "--all", "--tags"], check=True)
    subprocess.run(["git", "-C", target, "checkout", "--detach", item["ref"]], check=True)
    print(f"PINNED {item['id']} -> {item['ref']}")
PY

echo
echo "Staging complete."
echo "No staged source was modified."
echo "Next step is census + interface mapping before runtime wiring."
