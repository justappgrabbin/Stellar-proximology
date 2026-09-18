#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/build/assembled"
BUILD="$ROOT/build/apk"
DIST="$ROOT/dist"

SDK="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
BT="$SDK/build-tools/34.0.0"
ANDROID_JAR="$SDK/platforms/android-34/android.jar"

AAPT="$BT/aapt"
D8="$BT/d8"
ZIPALIGN="$BT/zipalign"
APKSIGNER="$BT/apksigner"

for f in "$AAPT" "$D8" "$ZIPALIGN" "$APKSIGNER" "$ANDROID_JAR"; do
  test -e "$f" || { echo "Missing Android build dependency: $f" >&2; exit 51; }
done

test -s "$APP/AndroidManifest.xml"
test -s "$APP/assets/web/index.html"
test -s "$APP/src/com/synthia/autonomy/MainActivity.java"
test -s "$APP/src/com/synthia/autonomy/LocalLinuxRuntime.java"

mkdir -p "$BUILD/classes" "$BUILD/dex" "$BUILD/native/lib/arm64-v8a" "$BUILD/native/lib/armeabi-v7a" "$DIST"

python3 -m py_compile "$ROOT/scripts/patch_runtime.py"
node --check "$APP/assets/web/stellar.mjs"
node --check "$APP/assets/web/local-lab.mjs"

"$AAPT" package -f \
  -M "$APP/AndroidManifest.xml" \
  -I "$ANDROID_JAR" \
  -A "$APP/assets" \
  -F "$BUILD/base.apk"

javac -source 8 -target 8 \
  -cp "$ANDROID_JAR" \
  -d "$BUILD/classes" \
  "$APP/src/com/synthia/autonomy/MainActivity.java" \
  "$APP/src/com/synthia/autonomy/SynthiaAccessibilityService.java" \
  "$APP/src/com/synthia/autonomy/LocalLinuxRuntime.java"

mapfile -t CLASSES < <(find "$BUILD/classes" -type f -name '*.class' -print)
test "${#CLASSES[@]}" -gt 0

"$D8" --min-api 24 --lib "$ANDROID_JAR" --output "$BUILD/dex" "${CLASSES[@]}"
test -s "$BUILD/dex/classes.dex"

cp "$BUILD/base.apk" "$BUILD/unsigned.apk"
(
  cd "$BUILD"
  zip -q -j unsigned.apk dex/classes.dex
)

# Package the existing PRoot executables as extractable native binaries.
cp "$APP/assets/web/runtime/proot-arm64" "$BUILD/native/lib/arm64-v8a/libproot.so"
cp "$APP/assets/web/runtime/proot-arm" "$BUILD/native/lib/armeabi-v7a/libproot.so"
chmod 755 "$BUILD/native/lib/arm64-v8a/libproot.so" "$BUILD/native/lib/armeabi-v7a/libproot.so"
(
  cd "$BUILD/native"
  zip -q -r "$BUILD/unsigned.apk" lib
)

unzip -t "$BUILD/unsigned.apk" >/dev/null

"$ZIPALIGN" -p -f 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"
"$ZIPALIGN" -c 4 "$BUILD/aligned.apk" >/dev/null

KEYSTORE="$BUILD/stellar-proximology.keystore"
PASSFILE="$BUILD/signing.pass"
if test -n "${STELLAR_SIGNING_PASSWORD:-}"; then
  printf '%s' "$STELLAR_SIGNING_PASSWORD" > "$PASSFILE"
else
  printf '%s' "stellar-local-build-key" > "$PASSFILE"
fi
PASS="$(cat "$PASSFILE")"

if test -n "${STELLAR_KEYSTORE_B64:-}"; then
  printf '%s' "$STELLAR_KEYSTORE_B64" | base64 -d > "$KEYSTORE"
else
  keytool -genkeypair -noprompt \
    -keystore "$KEYSTORE" \
    -alias stellar-proximology \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" \
    -dname "CN=Stellar Proximology Local Build"
fi

"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-key-alias stellar-proximology \
  --ks-pass "pass:$PASS" \
  --key-pass "pass:$PASS" \
  --out "$DIST/Stellar-Proximology.apk" \
  "$BUILD/aligned.apk"

"$APKSIGNER" verify --verbose --print-certs "$DIST/Stellar-Proximology.apk"
"$ZIPALIGN" -c 4 "$DIST/Stellar-Proximology.apk" >/dev/null
unzip -t "$DIST/Stellar-Proximology.apk" >/dev/null

unzip -l "$DIST/Stellar-Proximology.apk" | grep -q 'assets/web/runtime/rootfs-arm64.tar'
unzip -l "$DIST/Stellar-Proximology.apk" | grep -q 'lib/arm64-v8a/libproot.so'
unzip -l "$DIST/Stellar-Proximology.apk" | grep -q 'assets/web/neural/hopfieldAttractor.js'
unzip -l "$DIST/Stellar-Proximology.apk" | grep -q 'assets/web/lab/pure-synthia/state-space/claim-status.js'

echo "APK verified: $DIST/Stellar-Proximology.apk"
