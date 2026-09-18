# Stellar Proximology

Self-contained Human Design state-space laboratory assembled from existing Synthia / Stellar Proximology donor code.

## Runtime invariants

- Android APK first; the web/state-space core remains portable.
- No required cloud backend.
- No required Supabase connection.
- No remote language model runtime.
- MCP is an allowed tool boundary, not a hidden model dependency.
- Existing source repositories are read-only donors. This repository never deletes donor material.
- User-facing identity is represented by ontological addresses rather than personal names.
- State-space, Klein tooling, resonance networking, claims/experiments, and the existing neural attractor are preserved.
- Local file execution uses the existing bundled ARM/ARM64 PRoot + Linux rootfs when running inside the Android APK.
- Unsupported file types are still ingested into the state space and recorded; execution is only reported successful when a local runtime actually returns success.

## Donors

The build assembles from:

- `justappgrabbin/stellar-proximology-full-v0.1.0`
- `justappgrabbin/Back-up-`
- `justappgrabbin/LCM-State-space-`

See `PROVENANCE.md` for the exact pieces.

## Build

GitHub Actions builds inside the Linux build chamber and publishes:

- `Stellar-Proximology.apk`
- `Stellar-Proximology-source.zip`

The same scripts can be run in a Linux container on a phone/computer environment with Docker/Podman-compatible tooling.
