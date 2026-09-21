# Self-Hosted Runtime Invariant

Branch: `stellar-computer-assembly`

The assembled Stellar Proximology computer is **self-hosted**.

## Core rule

The application must remain useful when external cloud services are unavailable.

The local computer owns the authoritative runtime.

Core functions must run from the user's own Linux/container/Android residence using the systems already supplied.

## Local-first authority

The self-hosted core owns:

- project state
- planning state
- Auto Lab projects / experiments / evidence
- Synthia runtime state and memory
- capability registry and system manifests
- execution routing
- local files and ingested artifacts
- business / research / build workspaces
- provenance and append-only execution evidence
- local application APIs

## Existing pieces that satisfy this direction

- `StellarCPU-Rough-v0.1.0` — computer / machine residence
- `Synthia-Unified-v0.9.6-5D-LINUX-RESIDENCE` — local resident runtime
- `Stellar-Comp-MCP-Computer-v0.1` — local capability registry / assembly bus
- `Synthia-System-Auto-Lab-CANONICAL` — local lab runtime and persistent state
- `Back-up-` — local Synthia Integrated Automata HTTP/runtime
- `stellar-proximology.zip` — FastAPI + React/Vite application; supplied version uses SQLite
- `Synthia-Computer-981-DUAL-RUNTIME-REPAIR-TEST.apk` — Android bundled/local + Linux runtime path

## External services

Supabase, GitHub, Drive, model APIs, external MCP servers, remote deployment services and public web APIs may be connected when useful.

They are **extensions**, not prerequisites for booting or owning the system.

An external service must not become the sole source of truth for core project or agent state unless explicitly chosen later.

## Networking

Self-hosted does not mean isolated.

The computer may:
- access the web,
- call external APIs,
- publish sites,
- synchronize optional replicas,
- use MCP connectors,
- collaborate with other nodes.

The distinction is authority:

**network access may extend the computer; it does not own the computer.**

## Assembly consequence

Cross-system wiring should prefer:
1. local function/module interface,
2. localhost API,
3. local process/IPC,
4. optional network connector.

No cloud backend will be introduced merely to connect two systems that can already communicate locally.
