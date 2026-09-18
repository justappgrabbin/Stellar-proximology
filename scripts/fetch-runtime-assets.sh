#!/usr/bin/env bash
set -Eeuo pipefail

OUT="${1:?runtime output directory required}"
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Android-native portable PRoot executables. Build-time dependency only.
curl -fL --retry 3   https://skirsten.github.io/proot-portable-android-binaries/aarch64/proot   -o "$OUT/proot-arm64"
curl -fL --retry 3   https://skirsten.github.io/proot-portable-android-binaries/armv7/proot   -o "$OUT/proot-arm"
chmod 755 "$OUT/proot-arm64" "$OUT/proot-arm"

# Small Alpine userlands. They are fully bundled into the APK after this step.
ALPINE_VERSION="${ALPINE_VERSION:-3.22.1}"
curl -fL --retry 3   "https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/aarch64/alpine-minirootfs-${ALPINE_VERSION}-aarch64.tar.gz"   -o "$TMP/rootfs-arm64.tar.gz"
curl -fL --retry 3   "https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/armv7/alpine-minirootfs-${ALPINE_VERSION}-armv7.tar.gz"   -o "$TMP/rootfs-arm.tar.gz"

gzip -dc "$TMP/rootfs-arm64.tar.gz" > "$OUT/rootfs-arm64.tar"
gzip -dc "$TMP/rootfs-arm.tar.gz" > "$OUT/rootfs-arm.tar"

test -s "$OUT/proot-arm64"
test -s "$OUT/rootfs-arm64.tar"

printf 'runtime-assets\n' > "$OUT/RUNTIME-SOURCE.txt"
printf 'proot: skirsten/proot-portable-android-binaries\n' >> "$OUT/RUNTIME-SOURCE.txt"
printf 'rootfs: Alpine Linux %s minirootfs\n' "$ALPINE_VERSION" >> "$OUT/RUNTIME-SOURCE.txt"
