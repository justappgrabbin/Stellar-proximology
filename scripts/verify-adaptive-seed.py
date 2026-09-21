#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: verify-adaptive-seed.py <assembled-root>")

root = Path(sys.argv[1])
adaptive = root / "assets/web/adaptive-seed.mjs"
index = root / "assets/web/index.html"
lab = root / "assets/web/local-lab.mjs"

for path in (adaptive, index, lab):
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"adaptive seed wiring failed; missing: {path}")

text = adaptive.read_text()
html = index.read_text()

required = [
    "stellar.adaptive.seed.v1",
    "'social','lab','paper','builder'",
    "'market-core'",
    "'typed-feedback'",
    "'revenue-pool'",
    "'hd-matcher'",
    "status:'reserved'",
    "active:false",
    "function propose(",
    "function buildSandbox(",
    "function approveAndActivate(",
    "function rollback(",
    "function scanGaps(",
    "function planCampaign(",
    "function recordRevenue(",
    "function persistReceipt(",
    "runtimeAdapters",
    "function resonanceGraph(",
    "function registerAdapter(",
    "function setPluginActive(",
    "function findMarketMatches(",
    "function createAgreement(",
    "function fulfillAgreement(",
    "wiredBehaviors",
    "pendingBehaviors",
    "generated-workspace",
    "wired-capability",
    "typed-feedback:",
    "publishExternal:'ask'",
    "spendMoney:'ask'",
    "messagePeople:'ask'",
    "commitAppointment:'ask'",
    "globalThis.StellarAdaptive"
]
missing = [item for item in required if item not in text]
if "./adaptive-seed.mjs" not in html:
    missing.append("adaptive module script tag")
if "./local-lab.mjs" not in html:
    missing.append("existing local lab script tag")

if missing:
    raise SystemExit("adaptive seed wiring verification failed; missing: " + ", ".join(missing))

if html.index("./adaptive-seed.mjs") < html.index("./local-lab.mjs"):
    raise SystemExit("adaptive seed must load after local lab so it can reuse the canonical lab/runtime")

print("Adaptive seed source wiring verified: canonical Resonance Social + Lab + Paper + Builder + permissioned growth + market lifecycle + revenue + adapter sockets")
