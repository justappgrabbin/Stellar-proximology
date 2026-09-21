# Synthia v0.5.4 Governance Import

The v0.5.4 package was created in a separate conversation by mistake. It is being imported here deliberately as an existing governance capability, not as a replacement for the Stellar computer or for the v0.5.3 science checkpoint.

## Preserved lineage

- v0.5.3 remains registered as the DNA/RNA/protein translation checkpoint.
- v0.5.4 remains a complete later Synthia checkpoint.
- the v0.5.4 patch is preserved separately as overlay provenance.

A direct file comparison between the supplied v0.5.3 and v0.5.4 checkpoints found:

- 5 new files
- 0 removed files
- 11 changed files

The new files are:
- `RELEASE-v0.5.4.md`
- `docs/FUTURE-FEATURE-TESTING-FINAL-VERIFICATION-v0.5.4.md`
- `docs/FUTURE-FEATURE-TESTING-v0.5.4.md`
- `src/governance/future-feature-testing-registry.mjs`
- `test/16-future-feature-testing-consent.test.mjs`

## Imported capability

The assembly binds the existing `FutureFeatureTestingRegistry` from v0.5.4.

Its source rules are preserved:

- private by default;
- consent belongs to each submission;
- multi-submission testing requires every participating submission to allow cross-submission testing;
- future-development result use is separately controlled;
- mechanism incorporation is separately controlled;
- resulting-feature availability to other users is separately controlled;
- consent history is append-only;
- test-use history is append-only;
- revocation blocks new future uses without erasing prior test history;
- snapshot/restore is supported by the source module.

## Assembly boundary

This import does not make v0.5.4 the computer.

It adds a governance capability to the existing Stellar Comp capability layer.

Current path:

`Stellar Comp -> FutureFeatureTestingRegistry v0.5.4`

Durable computer-owned persistence for this registry should reuse the self-hosted local state layer. The v0.5.4 full organism already demonstrates persistence under `governance:future-feature-testing`; the assembly has not duplicated that persistence mechanism yet.
