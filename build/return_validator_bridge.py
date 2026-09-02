"""Python wrapper around the Node return-validator bridge
(`build/validate_return_transport.mjs`), which imports the single
implementation of the whole-file validation rule, `validateReturnTransport()`,
from `web/ranking.js` (`PLAN.md`, "The return-validator bridge").

A per-venue `invalid` status is a *result* — malformed `return_transport`
data for one venue, propagated as ordinary data; the caller is expected to
unrank that venue and continue. A broken bridge (Node missing, a nonzero
exit, stdout that is not valid JSON, or output missing a status for a venue
present in the metadata file) is not a result: it means the mandatory
validation stage did not run, and `BridgeError` is the caller's signal to
stop before generation replaces `venues.json` — an unstamped file is
unrankable at every venue, which is the failure this bridge exists to
prevent shipping.

Writes no file. Reads and reports only.
"""

import json
import subprocess
from pathlib import Path

BRIDGE_SCRIPT = Path(__file__).resolve().parent / "validate_return_transport.mjs"
TIMEOUT_SECONDS = 30


class BridgeError(RuntimeError):
    """The return-validator bridge did not run to a trustworthy result."""


def _is_valid_status(entry):
    """True iff `entry` is exactly the shape `validateReturnTransport()` emits:
    `{"state": "ok"}` or `{"state": "invalid", "reason": <string>}`. Anything
    else — `null`, an empty object, an unknown `state`, an `invalid` entry
    with no string `reason` — is not a value the bridge contract defines and
    must not be mistaken for a real per-venue result.
    """
    if not isinstance(entry, dict):
        return False
    state = entry.get("state")
    if state == "ok":
        return True
    if state == "invalid":
        return isinstance(entry.get("reason"), str)
    return False


def validate_return_transport(meta_path, node_path="node", script_path=BRIDGE_SCRIPT):
    """Run the bridge over `meta_path` and return its per-venue status dict.

    Raises `BridgeError` — never lets a broken bridge pass as a result — for:
    Node missing, a nonzero exit, stdout that is not valid JSON, stdout that
    is not a JSON object, a status missing for any venue id present in
    `meta_path`, or a per-venue value that is not exactly `{"state": "ok"}`
    or `{"state": "invalid", "reason": <string>}` — a malformed per-venue
    value is corruption in the bridge itself, not a legitimate `invalid`
    result, and must fail closed rather than pass through silently.
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
