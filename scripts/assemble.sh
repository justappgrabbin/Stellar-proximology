#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/build/assembled"

mkdir -p "$OUT"

test -d "$ROOT/donors/stellar"
test -d "$ROOT/donors/backup"
test -d "$ROOT/donors/lcm"

# Copy only what is needed. Donor trees are never modified.
rsync -a \
  --exclude='.git/' \
  --exclude='assets/web/synthia-server/' \
  --exclude='assets/web/knowledge/books/' \
  --exclude='assets/web/knowledge/biverse/data/source-learning/' \
  --exclude='assets/web/knowledge/biverse/data/empirical/' \
  --exclude='assets/web/knowledge/biverse/data/synthia/builds/generative-mesh-v1/rag-index.json' \
  --exclude='assets/web/os-shell/expo-workbench/' \
  "$ROOT/donors/stellar/" "$OUT/"

mkdir -p "$OUT/assets/web/lab"
rsync -a "$ROOT/donors/backup/vendor/execution-spine-v0.4.0/src/pure-synthia/" \
  "$OUT/assets/web/lab/pure-synthia/"
cp "$ROOT/donors/backup/vendor/execution-spine-v0.4.0/src/canonical-address.mjs" \
  "$OUT/assets/web/lab/canonical-address.mjs"

mkdir -p "$OUT/assets/web/neural"
cp "$ROOT/donors/lcm/extracted/session_build-1/hopfieldAttractor.js" "$OUT/assets/web/neural/"
cp "$ROOT/donors/lcm/extracted/session_build-1/kingWen.js" "$OUT/assets/web/neural/"
cp "$ROOT/donors/lcm/extracted/session_build-1/spectrumColor.js" "$OUT/assets/web/neural/"

cp "$ROOT/android/LocalLinuxRuntime.java" "$OUT/src/com/synthia/autonomy/LocalLinuxRuntime.java"
cp "$ROOT/web/local-lab.mjs" "$OUT/assets/web/local-lab.mjs"

python3 "$ROOT/scripts/patch_runtime.py" "$OUT"

# Guard against accidentally bundling the known transformer/LLM donor.
if find "$OUT" -type f \( -name 'model.py' -o -name 'train.py' -o -name '*.gguf' -o -name '*.safetensors' \) | grep -q .; then
  echo "Refusing build: model/LLM payload detected" >&2
  exit 40
fi

# Required local-runtime evidence.
for required in \
  assets/web/runtime/proot-arm64 \
  assets/web/runtime/rootfs-arm64.tar \
  assets/web/core/SynthiaUnit.mjs \
  assets/web/runtime/GraphRuntime.js \
  assets/web/neural/hopfieldAttractor.js \
  assets/web/lab/pure-synthia/state-space/claim-status.js
do
  test -s "$OUT/$required" || { echo "Missing required donor: $required" >&2; exit 41; }
done

mkdir -p "$ROOT/dist"
(
  cd "$OUT"
  zip -qr "$ROOT/dist/Stellar-Proximology-source.zip" .
)

echo "Assembled at $OUT"
