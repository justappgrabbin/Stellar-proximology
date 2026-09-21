#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: verify-mcp.py <assembled-root>")

root = Path(sys.argv[1])
server = root / "src/com/synthia/autonomy/StellarMcpServer.java"
main = root / "src/com/synthia/autonomy/MainActivity.java"

required_server = [
    'PROTOCOL_VERSION = "2026-07-28"',
    '"server/discover"',
    '"tools/list"',
    '"tools/call"',
    '"computer.observe"',
    '"computer.click_ref"',
    '"computer.tap"',
    '"computer.type"',
    '"computer.launch_app"',
    '"computer.adapt"',
    '"linux.run"',
    '"workspace.read"',
    '"workspace.write"',
    'stellar-mcp-metrics',
]
required_main = [
    'private StellarMcpServer mcpServer;',
    'mcpServer = new StellarMcpServer(this, linuxRuntime);',
    'mcpServer.start();',
    'mcpServer.close();',
    'public String mcpStatus()',
]

text = server.read_text()
main_text = main.read_text()

missing = [item for item in required_server if item not in text]
missing += [item for item in required_main if item not in main_text]
if missing:
    raise SystemExit("MCP wiring verification failed; missing: " + ", ".join(missing))

print("MCP source wiring verified: protocol + tools + adaptive persistence + Android lifecycle")
