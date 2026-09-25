# Swarm Handoff — Stellar Deep Ingest

## What this is

This branch is the **Deep Ingest substrate for Stellar Proximology**.

It is the build created so Stellar can receive an unfamiliar app, folder, file set, or ZIP and understand it as a system before execution or integration.

**Branch:** `integration/deep-ingest`  
**PR:** #4 — Add deep system ingestion and capsule substrate  
**Verified head:** `5a1f5dcea11a3fa3c529c513a3d2c615f3ba912c`  
**Successful Android verification run:** `35607109435`

## Current verified path

```text
preserve original
-> decompose
-> analyze purpose / behavior / relationships / concepts
-> detect dependencies
-> detect likely entrypoints
-> build system graph
-> create System Capsule
-> optional explicit runtime probe
-> explicit integration adapter
```

The Android build chamber passed assembly, JavaScript syntax, Java compilation, APK packaging, MCP verification, adaptive-system verification, self-installer verification, and Deep Ingest verification.

Status:

- Deep Ingest source/runtime: **WIRED**
- APK build/package: **VERIFIED**
- A real imported Automata / YOU-N-I-VERSE system: **not device-VERIFIED yet**

## Canonical rules for the swarm

1. **Preserve originals.** Imported source files and archives are evidence. Do not rewrite or destructively normalize them during ingestion.
2. **ANALYZED is not INTEGRATED.** Parsing a system does not mean it is installed or connected.
3. **Probe is explicit.** Ingestion maps first. Runtime execution occurs only through the explicit probe path.
4. **Integration requires an adapter.** `registerIntegrator(id, fn)` is the gate for actual mounting into the computer.
5. **Analysis can grow.** `registerAnalyzer(id, fn)` exists so future systems can teach Stellar additional ways to understand imported systems.
6. **Keep private Stellar Proximology mechanics off the public surface.** Planetary/HD addressing may remain internal substrate, but the user-facing capsule exposes ordinary software concepts only.
7. **Do not redesign the OS in this branch.** Deep Ingest is substrate work. Computer-shell/UI work belongs in a separate patch.
8. **Do not replace MCP, adaptive seed, self-update, Lab, Paper, Social, Market, or existing donor behavior.** Changes remain additive.

## Immediate intended ingestion order

The creator's intended next systems are:

1. the Automata / related engine material;
2. YOU-N-I-VERSE.

When they arrive, ingest them first and inspect the produced capsule/graph before writing integration assumptions.

## ZIP handling

Android ZIP ingestion:

- preserves the original archive;
- expands only inside Stellar's private workspace;
- rejects traversal paths;
- caps archive entries at 5,000;
- caps expanded bytes at 512 MB;
- runs extracted files through the same capsule analyzer.

## Key files

- `web/deep-ingest.mjs`
- `scripts/verify-deep-ingest.py`
- `scripts/patch_runtime.py`
- `.github/workflows/verify-deep-ingest.yml`

## Handoff request

Swarm: treat this branch as the current ingestion baseline. Continue from the verified head, preserve all existing behavior, and report any next work as:

`ACCEPT -> WORK LOG -> ARTIFACTS -> TEST -> HANDOFF`

If blocked:

`BLOCKED -> exact blocker -> evidence -> safest next action`

Do not silently reinterpret an analyzed capsule as an integrated app.
