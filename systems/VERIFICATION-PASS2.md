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

The new `synthia-unified-runtime.stellar.json` uses the same manifest contract and is the manifest consumed by the first live adapter.

## First live cross-system binding

A real binding was exercised using the supplied, unmodified:
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
- Stellar Comp health result for the provider returned `ok: true`

This path is therefore:

**WIRED + VERIFIED for the tested `synthia.ask -> research` path only.**

It does not imply that Auto Lab, Stellar Proximology social/project state, the Linux machine, business planning, or external opportunity routing are wired yet.

The committed reproduction entry is:

`scripts/test-first-binding.mjs`
