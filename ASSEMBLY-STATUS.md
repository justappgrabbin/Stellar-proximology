# Stellar Computer Assembly Status

Branch: `stellar-computer-assembly`

## Current pass

The branch now has both:
1. preservation-first staging for the supplied systems, and
2. an interface census of the first computer / autonomy / lab / social / business surfaces.

### Registered existing sources

- 22 whole ZIP/APK packages are now recorded with exact filenames, byte sizes, roles, and SHA-256 hashes.
- `justappgrabbin/Back-up-` is pinned to commit `1c45318a668de3bb3c54ae488b3d5f4109d1ba6b`.
- `justappgrabbin/stellar-proximology-full-v0.1.0` is pinned to commit `57f5daf9097c1291eccbc5183f2e97573716d43c`.

Newly registered in Pass 2:
- `Stellar-Comp-MCP-Computer-v0.1.zip`
- `Synthia-System-Auto-Lab-CANONICAL.zip`
- `Synthia-MCP-Opportunity-Consent-v1.0.zip`

These were added because they already implement three important missing connection roles:
- common cross-system capability/manifest assembly,
- the canonical local Auto Lab runtime,
- external capability-gap resolution with consent.

### What the staging script does

`scripts/stage-existing-systems.sh`:

1. reads `systems/SYSTEMS-MANIFEST.json`;
2. verifies each supplied archive against its recorded SHA-256;
3. preserves a whole copy under `systems/packages/`;
4. unpacks a working copy under `systems/installed/<system-id>/`;
5. preserves APK artifacts intact;
6. clones the existing GitHub systems into `systems/repos/`;
7. checks those repositories out at the exact recorded commits;
8. reports missing source packages rather than substituting anything.

The source packages themselves are not modified.

## Interface census

See `systems/INTERFACE-CENSUS.md`.

The important result is that the shared orchestration/assembly mechanism already exists in `Stellar-Comp-MCP-Computer-v0.1`. It defines a `stellar.manifest`, capability registry, placement resolver, authority resolver, event bus, append-only ledger, system admission, health checks, reconciliation and invocation.

The canonical Auto Lab also already exists as a local runtime with project, experiment, evidence, ingestion, cycle, package scanning, system registry and publishing behavior.

## Status vocabulary

| Status | Meaning |
|---|---|
| PRESENT | Exact source/application has been identified and registered. |
| PARTIALLY WIRED | Some real runtime connections exist, but not the complete intended flow. |
| WIRED | Real inputs/outputs/state are connected through the intended application flow. |
| VERIFIED | The complete path has been run end-to-end with the expected result. |

## Current status

All entries in `SYSTEMS-MANIFEST.json`: **PRESENT / REGISTERED FOR STAGING**.

Existing internal wiring inside the source packages is preserved as-is. This assembly branch has not yet claimed new cross-package runtime wiring.

## Next pass

Use the already-existing Stellar Comp manifest/registry contract to attach the staged systems without replacing them.

First connection order:
1. Stellar CPU machine/residence
2. Stellar Comp capability registry
3. Synthia Unit / Integrated Automata
4. canonical Auto Lab
5. Stellar Proximology project/social application
6. business / goal / orchestration providers
7. Opportunity & Consent unresolved-capability path

Then run end-to-end tests and produce the actual missing-capabilities list.
