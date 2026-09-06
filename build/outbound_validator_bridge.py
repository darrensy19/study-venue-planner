"""Python wrapper around the Node outbound-validator bridge
(`build/validate_outbound_transport.mjs`), which imports the single
implementation of the whole-file validation rule,
`validateOutboundTransport()`, from `web/ranking.js` (`PLAN.md`, "Getting
there: outbound-mirror transport" — "Validation: diagnostics only, never a
runtime gate").

Unlike the return-validator bridge, this stage's per-venue result is *never*
consulted by ranking, at any granularity — it exists purely to surface a
broken `outbound_transport` record to a maintainer at refresh time, even if
no query ever exercises it. A broken bridge itself (Node missing, a nonzero
exit, stdout that is not valid JSON, or output missing/malformed for a venue
present in the metadata file) is still treated as an infrastructure fault via
`BridgeError`, distinct from an ordinary per-venue/origin/mode result — that
distinction is about which *data* gates ranking, not about whether the
generation-time integrity check itself can fail closed.

Writes no file. Reads and reports only.
"""

import json
import subprocess
from pathlib import Path

BRIDGE_SCRIPT = Path(__file__).resolve().parent / "validate_outbound_transport.mjs"
TIMEOUT_SECONDS = 30


class BridgeError(RuntimeError):
    """The outbound-validator bridge did not run to a trustworthy result."""


def _is_valid_per_mode_entry(entry):
    if not isinstance(entry, dict):
        return False
    state = entry.get("state")
    if state == "ok":
        return True
    if state == "invalid":
        return isinstance(entry.get("reason"), str)
    return False


def _is_valid_status(entry):
    """True iff `entry` is exactly the shape `validateOutboundTransport()`
    emits: `{"rollup": "ok"|"invalid", "perOriginMode": {origin: {mode:
    {"state": "ok"} | {"state": "invalid", "reason": <string>}}}}`, and the
    rollup is internally consistent with whether any origin/mode entry is
    actually invalid — a rollup that disagrees with its own per-entry data is
    corruption in the bridge itself, not a legitimate result.
    """
    if not isinstance(entry, dict):
        return False
    rollup = entry.get("rollup")
    if rollup not in ("ok", "invalid"):
        return False
    per_origin_mode = entry.get("perOriginMode")
    if not isinstance(per_origin_mode, dict):
        return False

    any_invalid = False
    for modes in per_origin_mode.values():
        if not isinstance(modes, dict):
            return False
        for mode_entry in modes.values():
            if not _is_valid_per_mode_entry(mode_entry):
                return False
            if mode_entry.get("state") == "invalid":
                any_invalid = True

    return rollup == ("invalid" if any_invalid else "ok")


def validate_outbound_transport(meta_path, node_path="node", script_path=BRIDGE_SCRIPT):
    """Run the bridge over `meta_path` and return its per-venue status dict.

    Raises `BridgeError` — never lets a broken bridge pass as a result — for:
    Node missing, a nonzero exit, stdout that is not valid JSON, stdout that
    is not a JSON object, a status missing for any venue id present in
    `meta_path`, or a per-venue value that is not exactly the
    `{"rollup", "perOriginMode"}` shape described above.
    """
    meta_path = Path(meta_path)
    try:
        expected_venue_ids = set(json.loads(meta_path.read_text(encoding="utf-8")).keys())
    except (OSError, json.JSONDecodeError) as exc:
        raise BridgeError(f"could not read {meta_path}: {exc}") from exc

    try:
        result = subprocess.run(
            [node_path, str(script_path), str(meta_path)],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
    except FileNotFoundError as exc:
        raise BridgeError(f"node executable not found: {node_path!r}") from exc
    except subprocess.TimeoutExpired as exc:
        raise BridgeError(f"bridge timed out after {TIMEOUT_SECONDS}s") from exc

    if result.returncode != 0:
        raise BridgeError(f"bridge exited {result.returncode}: {result.stderr.strip()[:2000]}")

    try:
        status = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise BridgeError(f"bridge stdout was not valid JSON: {exc}") from exc

    if not isinstance(status, dict):
        raise BridgeError("bridge stdout was not a JSON object")

    missing = expected_venue_ids - status.keys()
    if missing:
        raise BridgeError(f"bridge output missing status for: {sorted(missing)}")

    malformed = [venue_id for venue_id, entry in status.items() if not _is_valid_status(entry)]
    if malformed:
        raise BridgeError(f"bridge output has malformed per-venue status for: {sorted(malformed)}")

    return status
