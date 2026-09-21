# Existing Systems Staging Area

This directory belongs to the `stellar-computer-assembly` branch.

Its purpose is preservation-first assembly. It does **not** define a replacement architecture.

## Layout

- `SYSTEMS-MANIFEST.json` — exact package names, SHA-256 hashes, roles, and pinned repository commits.
- `packages/` — whole original ZIP/APK packages copied without modification by the staging script.
- `installed/` — unpacked working copies created from those preserved packages.
- `repos/` — pinned checkouts of existing GitHub systems.

The package and installed directories are local assembly material and should not be edited as source-of-truth originals.

Run:

`scripts/stage-existing-systems.sh /path/to/folder-containing-the-existing-packages`

The script verifies every archive hash before copying or unpacking it. Missing packages are reported rather than silently substituted.

## Status

At this stage, a system being present here means **PRESENT** only.

It does not mean the system is WIRED or VERIFIED.
