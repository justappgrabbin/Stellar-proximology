# Stellar Computer MCP

Status target: **WIRED only after Android build passes; VERIFIED only after an installed APK serves a successful MCP call end to end.**

## Baseline preserved

Before this integration, Stellar already had real local faculties:

- Android accessibility observation with stable element refs.
- Ref click, coordinate tap, swipe, text entry, and Android global navigation.
- Launchable-app enumeration and app launch.
- Persistent workspace file read/write.
- Embedded ARM/ARM64 PRoot Linux execution.
- Existing Stellar state-space, GNN, experiment, and evidence machinery.

The old `justappgrabbin/mcp` repository contains an MCP-labelled dashboard and Stellar-related Python engines, but it does not implement the Model Context Protocol wire methods. `justappgrabbin/Mcp2` contains a causal-graph action interpreter and an embedded remote MCP chat surface, but it is not itself a local MCP protocol server.

## Added here

The Android app now starts `StellarMcpServer` during `MainActivity.onCreate` and closes it during app destruction.

Preferred endpoint:

`http://127.0.0.1:8877/mcp`

If 8877 is occupied, the server binds another loopback port; `SynthiaAndroid.mcpStatus()` and `SynthiaAndroid.getStatus()` expose the actual URL.

The server implements the MCP 2026-07-28 stateless HTTP core:

- `server/discover`
- `tools/list`
- `tools/call`
- required protocol/method/name header checks
- `resultType: complete`
- cache hints for discovery/tool catalogs
- server identity in result metadata
- explicit JSON-RPC errors

## Computer tools

- `computer.status`
- `computer.observe`
- `computer.click_ref`
- `computer.tap`
- `computer.swipe`
- `computer.type`
- `computer.press`
- `computer.list_apps`
- `computer.launch_app`
- `computer.metrics`
- `computer.adapt`
- `linux.status`
- `linux.prepare`
- `linux.run`
- `linux.run_file`
- `workspace.read`
- `workspace.write`

## What “adapt” means here

This is not an LLM claim. The routing layer persists per-tool success and failure counts in Android SharedPreferences.

For activation/click operations, when both a semantic element ref and coordinates are supplied, it ranks `computer.click_ref` and `computer.tap` from observed route reliability, tries the preferred route first, and falls back when needed. The full attempts array is returned so failure is visible.

Other operation classes route to the concrete hand that already exists.

## Verification boundary

The build pipeline verifies:

1. the MCP class exists in the assembled app;
2. MainActivity creates, starts, exposes, and closes it;
3. all required tool names and protocol methods are present;
4. javac compiles the MCP server with the Android app.

That proves source/build wiring, not device behavior.

A device-level **VERIFIED** result requires:
1. install the APK;
2. enable Stellar accessibility service;
3. read `mcpStatus()`;
4. POST `server/discover`;
5. POST `tools/list`;
6. call `computer.observe`;
7. call at least one observable action such as `computer.click_ref` or `computer.press`;
8. observe the resulting UI change;
9. inspect `computer.metrics` to confirm persistence of the outcome.
