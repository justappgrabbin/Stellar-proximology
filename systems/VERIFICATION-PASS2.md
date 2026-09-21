# Pass 2 Verification

## Stellar Comp package test

The supplied `Stellar-Comp-MCP-Computer-v0.1.zip` was unpacked without modification and its own test suite was executed with:

`npm test`

Result:
- 4 tests
- 4 passed
- 0 failed

The passing package tests covered:
1. manifest validation rejects incomplete manifests;
2. a requirement is automatically bound to an available capability;
3. a provider can be invoked while the append-only ledger remains valid;
4. Stellar Comp does not take lifecycle ownership of attached automata.

## Assembly manifests

Observed-interface manifests were checked with the exact `validateManifest()` implementation shipped inside the same Stellar Comp archive.

PASS:
- `stellar-cpu.stellar.json`
- `synthia-integrated.stellar.json`
- `auto-lab.stellar.json`
- `stellar-proximology.stellar.json`
- `opportunity-consent.stellar.json`
- `synthia-unified-runtime.stellar.json`

## Verified binding 1 — Stellar Comp to Synthia Unified

Supplied source packages used without modification:
- `Stellar-Comp-MCP-Computer-v0.1.zip`
- `Synthia-Unified-v0.9.6-5D-LINUX-RESIDENCE.zip`

Path exercised:

`StellarComp -> SynthiaUnit -> synthia.ask -> existing Synthia router -> browser-planner + research -> returned output -> Stellar append-only ledger`

Test intent:

`research a testable question about local system behavior`

Observed result:
- Synthia returned `ok: true`
- route reached `browser-planner`
- route reached `research`
- Stellar Comp ledger verification returned `true`
- provider health returned `ok: true`

Status:

**WIRED + VERIFIED for the tested `synthia.ask -> research` path.**

Reproduction:
- `integration/adapters/synthia-unit-provider.mjs`
- `scripts/test-first-binding.mjs`

## Verified binding 2 — Stellar Comp to canonical Auto Lab

Supplied source packages used without modifying the Auto Lab source:
- `Stellar-Comp-MCP-Computer-v0.1.zip`
- `Synthia-System-Auto-Lab-CANONICAL.zip`

The adapter keeps Auto Lab state in a separate writable runtime directory. The preserved source package remains unchanged.

Path exercised:

`StellarComp -> AutoLab provider -> existing AutoLab.create_project -> existing AutoLab.propose_experiment -> existing AutoLab.cycle -> Stellar append-only ledger`

Observed result:
- project created successfully
- experiment created with status `queued`
- cycle moved that experiment to `running`
- Auto Lab returned: `Awaiting a real observation.`
- Stellar Comp ledger verification returned `true`

Status:

**WIRED + VERIFIED for the tested project -> experiment -> cycle path.**

Reproduction:
- `integration/adapters/auto-lab-bridge.py`
- `integration/adapters/auto-lab-provider.mjs`
- `scripts/test-auto-lab-binding.mjs`

## Boundaries

These two verified paths do not yet prove:
- Linux machine boot
- Stellar Proximology social/project HTTP connection
- business planning end-to-end
- Opportunity & Consent runtime connection
- shared persistent project state across all surfaces

Those remain PARTIALLY WIRED or PRESENT until exercised.
