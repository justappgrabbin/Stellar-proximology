#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: verify-deep-ingest.py <assembled-root>")

root = Path(sys.argv[1])
ingest = root / "assets/web/deep-ingest.mjs"
index = root / "assets/web/index.html"
main = root / "src/com/synthia/autonomy/MainActivity.java"

for path in (ingest, index, main):
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"deep ingest wiring failed; missing: {path}")

text = ingest.read_text()
html = index.read_text()
java = main.read_text()

required_ingest = [
    "import IntakeGate",
    "stellar.deep.ingest.v1",
    "indexedDB.open",
    "function dependenciesFor(",
    "function behaviorSignals(",
    "function publicIntakeView(",
    "function probableEntrypoint(",
    "function inferGraph(",
    "async function ingestFiles(",
    "async function ingestZip(",
    "original-zip-plus-private-workspace-expansion",
    "privateAnalysis",
    "async function probeCapsule(",
    "async function integrateCapsule(",
    "integrator-not-registered",
    "function registerAnalyzer(",
    "function registerIntegrator(",
    "globalThis.StellarIngest",
]
required_java = [
    "public String unpackWorkspaceZip(",
    "public String listWorkspaceFiles(",
    "archive-path-rejected",
    "archive-path-escaped-sandbox",
    "archive-entry-limit",
    "archive-size-limit",
]
missing = [f"ingest:{x}" for x in required_ingest if x not in text]
missing += [f"android:{x}" for x in required_java if x not in java]

for script in ("./local-lab.mjs", "./deep-ingest.mjs", "./adaptive-seed.mjs"):
    if script not in html:
        missing.append("index:" + script)

if not missing:
    if not (html.index("./local-lab.mjs") < html.index("./deep-ingest.mjs") < html.index("./adaptive-seed.mjs")):
        missing.append("index:expected load order local-lab -> deep-ingest -> adaptive")

# Public capsule summaries must not explicitly surface the private planetary layer.
for forbidden in ("planetaryDimension", "addressBasis", "resonantAddresses"):
    if forbidden in text:
        missing.append("surface-leak:" + forbidden)

if missing:
    raise SystemExit("deep ingest verification failed; " + ", ".join(missing))

print("Deep ingest verified: preserve -> analyze purpose/behavior/relationships -> dependency graph -> capsule -> optional probe -> explicit integrator")
