"""Shared paths, seed loading and env access for the Phase 0 probes.

Phase 0 writes everything under data/phase0/. Raw API responses go to
data/phase0/raw/, which is gitignored — this repo is public and the dumps are
bulky. They are kept locally because Phase 1's parser tests are built from
trimmed copies of these exact responses.
"""

import csv
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
SEEDS_PATH = DATA_DIR / "venue_seeds.csv"
PHASE0_DIR = DATA_DIR / "phase0"
RAW_DIR = PHASE0_DIR / "raw"

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def require_env(name):
    """Read one required key from .env, failing loudly and early."""
    load_dotenv(REPO_ROOT / ".env")
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(
            f"{name} is not set.\n"
            f"Copy .env.example to .env and fill it in. See the Phase 0 prerequisites "
            f"in plan.md — this script makes no calls without a key."
        )
    return value


def read_seeds():
    """Load data/venue_seeds.csv as a list of dicts, in file order.

    File order is the seed's only identity until a Place ID is resolved, so it
    is preserved everywhere downstream.
    """
    if not SEEDS_PATH.exists():
        sys.exit(f"missing {SEEDS_PATH.relative_to(REPO_ROOT)}")
    with SEEDS_PATH.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    seeds = []
    for index, row in enumerate(rows, start=1):
        seeds.append(
            {
                "seed_no": index,
                "name": (row.get("name") or "").strip(),
                "brand": (row.get("brand") or "").strip(),
                "address_hint": (row.get("address_hint") or "").strip(),
            }
        )
    return seeds


def search_query(seed):
    """The text query for one seed.

    The address hint is the disambiguator for venues whose Maps name is bare
    ("Starbucks"). Without it those four seeds are indistinguishable.
    """
    parts = [seed["name"]]
    if seed["address_hint"]:
        parts.append(seed["address_hint"])
    # The hints already end "Singapore 138608"; don't append the country twice.
    if "singapore" not in " ".join(parts).lower():
        parts.append("Singapore")
    return ", ".join(parts)


def slugify(text):
    """Lowercase hyphenated slug, for proposing a venue_id."""
    text = re.sub(r"[^a-z0-9]+", "-", text.lower())
    return text.strip("-")


def ensure_dirs():
    PHASE0_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def rel(path):
    """Repo-relative path, for readable log lines."""
    return Path(path).resolve().relative_to(REPO_ROOT)
