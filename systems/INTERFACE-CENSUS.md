# Existing Interface Census — Pass 2

Branch: `stellar-computer-assembly`

This pass maps callable interfaces that already exist. It does not replace any application.

## 1. StellarCPU-Rough-v0.1.0 — computer host

Status: **PRESENT**

Existing contract:
- root package: `synthia-unified-computer-app@0.9.8`
- native workspaces: Build, Business, Research, Create, Life, Lab, MCP Hub, YOU-N-I-VERSE Living View
- computer contract: inspect reality -> register/address -> determine capabilities -> arrange runtime/workspace/tools -> execute -> observe -> adapt
- Foreman contract: observe purpose/context -> locate friction -> arrange support -> observe evidence -> adapt support

Existing machine interface:
- package: `packages/stellar-machine`
- CLI/controller: `stellarctl`
- operations already exposed by package scripts: doctor, plan, download, init, install, start, status, stop, serve
- control server exists at `packages/stellar-machine/src/control-server.mjs`

Existing resident-computer interface:
- `packages/computer-core/core/SynthiaUnit.mjs`
- `ask(intent, options)`
- `autonomousCycle(options)`
- `openOrgans(ids)`
- `snapshot()`
- internal `MCPBus`
- internal `OrganRegistry`

Existing routed organs include advice, media, builder, browser planning, resonance, world, economy, AutoLing, grammar, DISEMINER, research, forms and cultivation.

## 2. Synthia-Unified-v0.9.6-5D-LINUX-RESIDENCE — resident runtime

Status: **PRESENT**

Existing local runtime:
- `core/SynthiaUnit.mjs`
- same `ask`, routing, memory, graph runtime, organ registry and autonomous-cycle family

Existing Linux interface:
- `runtime/LinuxResidence.js`
- operations:
  - `file.read`
  - `file.write`
  - `file.list`
  - `file.stat`
  - `process.exec`
- `createLinuxTransport()` already exposes the residence through a transport boundary

Important: default allowed process command in this package is `node`; a host may configure a different allowlist.

## 3. Stellar Comp MCP Computer v0.1 — existing cross-system assembly layer

Status: **PRESENT**

This is the already-built handshake/assembly computer. Do not invent a replacement.

Existing invariant:
> MCP runs the computer; the systems run themselves.

Existing callable core:
- `StellarComp.admit(manifest, runtime)`
- `StellarComp.healthCheck(id)`
- `StellarComp.reconcile()`
- `StellarComp.invoke({ requester, capability, input, target })`
- `StellarComp.snapshot()`

Existing support:
- CapabilityRegistry
- PlacementResolver
- AuthorityResolver
- EventBus
- AppendOnlyLedger
- `stellar.manifest` schema
- browser-global adapter
- MCP server-card adapter
- legacy map adapter
- AUTOLING boundary adapter

Its own integration map already names:
- MCP Hub
- AgentRegistry
- EventBus
- FoundryRegistry
- MCPMaintenanceLayer
- MCP Task OS
- AUTOLING
- Resonance installer
- Auto-Lab
- Synthia

This package is therefore the first existing candidate for the shared self-evolving coordination layer.

## 4. Synthia System Auto Lab — canonical lab runtime

Status: **PRESENT**

Existing app entry:
- `app.py` — Streamlit Synthia Computer / Stellar Proximology surface
- Docker compose exposes 8501 and 8081

Existing Auto Lab core:
- `autolab/core.py::AutoLab`
- persistent project, experiment, evidence, connection and event state
- `create_project()`
- `propose_experiment()`
- `add_observation()`
- `ingest_bytes()`
- `cycle()`
- `set_autopilot()`

The cycle explicitly waits for real recorded observations rather than fabricating a result.

Existing Stellar lab control interface:
- `stellar_lab/orchestrator.py::handle(text)`
- status
- list/create experiments
- list findings
- publish site
- list systems
- scan packages
- index workspace

Existing registry:
- `stellar_lab/registry.py`
- Synthia
- Stellar Proximology
- YOU-N-I-VERSE
- Resonance Network historical entry
- mounted creator/agent/social-organism packages
- System Auto Lab

The current package uses its own five internal AutoLab agent labels: hypothesis, experiment, evidence, resonance, maintenance. These are package facts and are not being substituted for any separate role model.

## 5. Stellar Proximology social/project application

Status: **PRESENT**

Existing entry points:
- frontend: React/Vite, `frontend/package.json`
- backend: FastAPI, `backend/main.py`
- persistence: SQLite in the supplied application

Direct backend routes include:
- health
- chart calculation
- profile create/update/read
- follow/follower/following/relationship
- feed posting/exploration/reactions
- project create/list/read
- project fork/connect/disconnect/react/update/status
- user projects

This remains the human-facing social/project environment rather than being flattened into the assembly layer.

## 6. Back-up- / Synthia Integrated Automata

Status: **PRESENT**

Existing runnable server:
- `src/ui/server.mjs`
- creates the organism through `FederatedSynthia.create()`

Existing HTTP interface includes:
- GET `/api/status`
- GET `/api/tray`
- GET `/api/channels`
- GET `/api/proposals`
- POST `/api/chat`
- POST `/api/execute`
- POST `/api/tray`
- POST `/api/proposals`

This is already a callable autonomous organism and should be attached rather than recreated.

## 7. Synthia MCP Opportunity & Consent v1.0

Status: **PRESENT**

Existing external-capability cascade:
`local -> organism -> network -> MCP -> human`

Existing `SynthiaRuntimeBridge`:
- reads unresolved IntentFlow demands
- reads AspirationCore gaps
- normalizes them as capability needs
- can feed external outcomes into ScienceMode
- can feed outcomes into SuccessAutomaton-compatible systems
- can publish outcomes into the mesh

This is the existing path for a self-evolving system to recognize that an ability is absent locally and look outward without pretending the capability exists.

## 8. Existing business / planning surfaces

Status: **PRESENT, interface census still continuing**

Already identified:
- Stellar CPU native Business workspace
- Synthia Unit `economy` and browser-planning organs
- Stellar Proximology Projects / Builder Hub / Market / Missions / Outcomes application surfaces
- `AutopoeticApp` BusinessEngine + SuccessDrivenPurposeCore
- Goal-Oriented Inference package for goal sessions / plan generation / success criteria
- Autonomous Site Orchestrator for materials, assembly tasks, research references and feedback-driven learning
- Auto Lab project / experiment / evidence cycle

No new business planner should be built until these are exercised together.

## First binding order

The lowest-destructive-risk order is:

1. **Stellar CPU** supplies the machine/residence.
2. **Stellar Comp MCP Computer** supplies the common system handshake and capability registry.
3. **Synthia Unit / Integrated Automata** register the capabilities they actually carry.
4. **Auto Lab** attaches as observer/scientist and receives project/research work.
5. **Stellar Proximology application** remains the human-facing project/social surface.
6. **Business / goal / orchestrator systems** register as planning and execution providers.
7. **Opportunity & Consent** handles unresolved capability gaps after local/organism/network resolution.
8. Test outcomes are written to evidence/state before any learned route is promoted.

## What has NOT happened yet

This census does not claim:
- that the above systems share one live process,
- that Auto Lab is already calling Stellar Comp,
- that the social application is already using the computer state,
- that business planning is end-to-end verified.

Those become WIRED or VERIFIED only after the runtime connections are actually exercised.
