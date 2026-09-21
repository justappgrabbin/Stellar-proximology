from __future__ import annotations
import json
import sys
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit("usage: auto-lab-bridge.py <source-root> <state-root>")

source_root = Path(sys.argv[1]).resolve()
state_root = Path(sys.argv[2]).resolve()

sys.path.insert(0, str(source_root))

from autolab.core import AutoLab

lab = AutoLab(state_root)
request = json.loads(sys.stdin.read() or "{}")
action = request.get("action")
payload = request.get("input") or {}

if action in {"health", "lab.state"}:
    result = {"ok": True, "state": lab.state()}
elif action == "lab.project.create":
    result = lab.create_project(
        payload["title"],
        payload["question"],
        payload.get("program", "Stellar Proximology"),
    )
elif action == "lab.experiment.propose":
    result = lab.propose_experiment(payload["project_id"])
elif action == "lab.evidence.record":
    result = lab.add_observation(
        payload["experiment_id"],
        payload["text"],
        payload.get("evidence_class", "Observed"),
    )
elif action == "lab.cycle":
    result = lab.cycle()
elif action == "lab.autopilot.set":
    result = lab.set_autopilot(
        bool(payload.get("enabled")),
        payload.get("interval_seconds"),
    )
else:
    raise SystemExit(f"unsupported action: {action}")

print(json.dumps(result, separators=(",", ":")))
