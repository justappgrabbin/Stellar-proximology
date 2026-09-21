# Stellar Computer Assembly Status

Branch: `stellar-computer-assembly`

## Current pass

The branch now has a preservation-first staging mechanism for the systems already supplied.

### Registered existing sources

- 19 whole ZIP/APK packages are recorded with exact filenames, byte sizes, roles, and SHA-256 hashes.
- `justappgrabbin/Back-up-` is pinned to commit `1c45318a668de3bb3c54ae488b3d5f4109d1ba6b`.
- `justappgrabbin/stellar-proximology-full-v0.1.0` is pinned to commit `57f5daf9097c1291eccbc5183f2e97573716d43c`.

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

## Status vocabulary

| Status | Meaning |
|---|---|
| PRESENT | Exact source/application has been identified and registered. |
| PARTIALLY WIRED | Some real runtime connections exist, but not the complete intended flow. |
| WIRED | Real inputs/outputs/state are connected through the intended application flow. |
| VERIFIED | The complete path has been run end-to-end with the expected result. |

## Current status

All entries in `SYSTEMS-MANIFEST.json`: **PRESENT / REGISTERED FOR STAGING**.

No new claim of WIRED or VERIFIED has been made by this assembly pass.

## Next pass

After staging, inspect each whole system's existing entry points, state ownership, inputs/outputs, and callable interfaces. Runtime connections should then be made only between existing interfaces, with no replacement architecture introduced before the census.
