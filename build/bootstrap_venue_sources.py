"""Bootstrap `data/venue_sources.json`, once.

    .venv/bin/python3 build/bootstrap_venue_sources.py

Seeds the canonical Phase 1 fetch registry from the frozen
`data/phase0/place_ids.csv` (`confident`-match rows only), taking
`proposed_venue_id` as `venue_id` and the resolved identity columns
verbatim. `data/phase0/` is read, never modified.

This is a true one-time step, not an idempotent regenerate: after
bootstrap the registry is hand-maintained (`PLAN.md`, "Bootstrap, once"),
so re-running this script must never silently overwrite hand edits — it
refuses to run, and writes nothing, if `data/venue_sources.json` already
exists.
"""

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scraper.venue_sources import RegistryValidationError, validate_registry  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
PLACE_IDS_PATH = REPO_ROOT / "data" / "phase0" / "place_ids.csv"
META_PATH = REPO_ROOT / "data" / "venues_meta.json"
REGISTRY_PATH = REPO_ROOT / "data" / "venue_sources.json"


def build_records(place_ids_path):
    with place_ids_path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    return [
        {
            "venue_id": row["proposed_venue_id"],
            "place_id": row["place_id"],
            "resolved_name": row["resolved_name"],
            "resolved_address": row["resolved_address"],
        }
        for row in rows
        if row.get("match_status") == "confident"
    ]


def _display(path):
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def main(registry_path=REGISTRY_PATH, place_ids_path=PLACE_IDS_PATH, meta_path=META_PATH):
    if registry_path.exists():
        sys.exit(
            f"{_display(registry_path)} already exists — bootstrap is a one-time step. The "
            "registry is hand-maintained after bootstrap; delete the file first if you "
            "genuinely intend to regenerate it from scratch."
        )
    if not place_ids_path.exists():
        sys.exit(f"missing {_display(place_ids_path)}")
    if not meta_path.exists():
        sys.exit(f"missing {_display(meta_path)}")

    records = build_records(place_ids_path)
    meta_venue_ids = json.loads(meta_path.read_text(encoding="utf-8")).keys()

    try:
        validate_registry(records, meta_venue_ids)
    except RegistryValidationError as error:
        sys.exit(f"bootstrap would produce an invalid registry: {error}")

    registry_path.write_text(
        json.dumps({"venues": records}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"wrote {_display(registry_path)}: {len(records)} venue(s)")


if __name__ == "__main__":
    main()
