# Provenance Map

This build is additive. Donor repositories remain unchanged.

## Primary application shell
Repository: `justappgrabbin/stellar-proximology-full-v0.1.0`

Reused:
- Android WebView shell and accessibility service
- Stellar Proximology visual interface
- SynthiaUnit
- GraphRuntime
- compiled IsoHuman / Human Design chart runtime
- Five-space state machinery
- Klein mesh/tool stack already wired through SynthiaUnit
- ResonanceNetwork
- local memory / cultivation / experiment machinery
- bundled `assets/web/runtime/proot-arm64`
- bundled `assets/web/runtime/proot-arm`
- bundled ARM64/ARM Linux rootfs archives

Explicitly excluded from the runtime assembly:
- `assets/web/synthia-server`
- remote deployment/server bundles
- large source-learning corpora not required for runtime boot

## Claims + experiment semantics + execution grammar
Repository: `justappgrabbin/Back-up-`

Reused:
- `vendor/execution-spine-v0.4.0/src/pure-synthia`
- canonical claim statuses and promotion gate
- hypothesis registry
- universal execution bridge
- Pure Synthia automata, including Klein analogy and computational grammar pieces

The claim status system remains the authority for evidence labels. A successful run does not automatically become EMPIRICALLY_SUPPORTED.

## Neural component
Repository: `justappgrabbin/LCM-State-space-`

Reused:
- `extracted/session_build-1/hopfieldAttractor.js`
- `extracted/session_build-1/kingWen.js`
- `extracted/session_build-1/spectrumColor.js`

This is a deterministic Hopfield attractor network, not a language model.

## Build-only integration code
This repository contains only the glue required to assemble, patch, sandbox, package, and verify the donors above.
