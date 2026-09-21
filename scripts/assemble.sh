#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/build/assembled"

rm -rf "$OUT"
mkdir -p "$OUT/assets/web" "$OUT/src/com/synthia/autonomy" "$OUT/assets/web/lab" "$OUT/assets/web/neural" "$OUT/assets/web/neural-hd" "$OUT/assets/web/runtime"

test -d "$ROOT/donors/backup"
test -d "$ROOT/donors/lcm"

# Android shell: exact donor copies previously read from the private Stellar repo.
cp "$ROOT/android/AndroidManifest.xml" "$OUT/AndroidManifest.xml"
cp "$ROOT/android/MainActivity.donor.java" "$OUT/src/com/synthia/autonomy/MainActivity.java"
cp "$ROOT/android/SynthiaAccessibilityService.java" "$OUT/src/com/synthia/autonomy/SynthiaAccessibilityService.java"
cp "$ROOT/android/LocalLinuxRuntime.java" "$OUT/src/com/synthia/autonomy/LocalLinuxRuntime.java"
cp "$ROOT/android/StellarMcpServer.java" "$OUT/src/com/synthia/autonomy/StellarMcpServer.java"

# State-space app body: public single-file sovereign runtime already in Back-up-.
cp "$ROOT/donors/backup/vendor/kimi-agent-automata-state-space-merge/sovereign.html" "$OUT/assets/web/index.html"

# Existing scientific / experimental engine.
rsync -a "$ROOT/donors/backup/vendor/execution-spine-v0.4.0/src/pure-synthia/" "$OUT/assets/web/lab/pure-synthia/"
cp "$ROOT/donors/backup/vendor/execution-spine-v0.4.0/src/canonical-address.mjs" "$OUT/assets/web/lab/canonical-address.mjs"
cp "$ROOT/donors/backup/src/execution/execution-pipeline.mjs" "$OUT/assets/web/lab/execution-pipeline.mjs"
cp "$ROOT/donors/backup/src/execution/integrated-address-resolver.mjs" "$OUT/assets/web/lab/integrated-address-resolver.mjs"
cp "$ROOT/donors/backup/src/governance/observation-engine.mjs" "$OUT/assets/web/lab/observation-engine.mjs"

# Existing deterministic neural net.
cp "$ROOT/donors/lcm/extracted/session_build-1/hopfieldAttractor.js" "$OUT/assets/web/neural/"
cp "$ROOT/donors/lcm/extracted/session_build-1/kingWen.js" "$OUT/assets/web/neural/"
cp "$ROOT/donors/lcm/extracted/session_build-1/spectrumColor.js" "$OUT/assets/web/neural/"

# Existing trained Human Design GraphSAGE inference network.
cp "$ROOT/donors/backup/vendor/pure-synthia-v0.4.0/src/synthia/neural/humanDesignGNN.mjs" "$OUT/assets/web/neural-hd/"
cp "$ROOT/donors/backup/vendor/pure-synthia-v0.4.0/src/synthia/neural/humanDesignGNNWeights.mjs" "$OUT/assets/web/neural-hd/"

# Integration-only presentation and local execution bridge.
cp "$ROOT/web/local-lab.mjs" "$OUT/assets/web/local-lab.mjs"
cp "$ROOT/web/adaptive-seed.mjs" "$OUT/assets/web/adaptive-seed.mjs"
cp "$ROOT/web/stellar.css" "$OUT/assets/web/stellar-donor.css"

python3 "$ROOT/scripts/patch_runtime.py" "$OUT"

# The Android PRoot + rootfs are supplied by fetch-runtime-assets.sh before packaging.
bash "$ROOT/scripts/fetch-runtime-assets.sh" "$OUT/assets/web/runtime"

# No model payloads are permitted.
if find "$OUT" -type f \( -name 'model.py' -o -name 'train.py' -o -name '*.gguf' -o -name '*.safetensors' -o -name '*.onnx' \) | grep -q .; then
  echo "Refusing build: language/model payload detected" >&2
  exit 40
fi

for required in \
  assets/web/index.html \
  assets/web/adaptive-seed.mjs \
  assets/web/runtime/proot-arm64 \
  assets/web/runtime/rootfs-arm64.tar \
  assets/web/lab/pure-synthia/state-space/human-design.js \
  assets/web/lab/pure-synthia/state-space/claim-status.js \
  assets/web/lab/pure-synthia/experiments/hypothesis-registry.js \
  assets/web/lab/pure-synthia/automata/tools/tool-03-klein-analogy.js \
  assets/web/neural/hopfieldAttractor.js \
  assets/web/neural-hd/humanDesignGNN.mjs
do
  test -s "$OUT/$required" || { echo "Missing required donor: $required" >&2; exit 41; }
done

mkdir -p "$ROOT/dist"
(
  cd "$OUT"
  zip -qr "$ROOT/dist/Stellar-Proximology-source.zip" .
)

echo "Assembled at $OUT"
