"""Phase 0, step 3 — resolve venue seeds to Google Place IDs.

    .venv/bin/python3 build/phase0_resolve.py --dry-run   # print queries, no calls
    .venv/bin/python3 build/phase0_resolve.py

A wrong Place ID silently poisons every downstream measurement — the hours, the
histogram, and the N/P proposal all key off it. So this script never picks a
winner quietly: anything short of one confident match is written out as
`ambiguous` or `no_match` for manual resolution.

Writes data/phase0/place_ids.csv and the raw search responses.
"""

import argparse
import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from build.phase0_common import (  # noqa: E402
    PHASE0_DIR,
    RAW_DIR,
    SEEDS_PATH,
    ensure_dirs,
    read_seeds,
    rel,
    require_env,
    search_query,
    slugify,
    write_json,
)
from scraper.places import PlacesError, search_text  # noqa: E402

OUTPUT_PATH = PHASE0_DIR / "place_ids.csv"
POSTAL_RE = re.compile(r"\b(\d{6})\b")

# Names that identify the brand but not the branch. A seed resolving to one of
# these needs its slug taken from the address instead.
BARE_NAMES = {
    "starbucks",
    "coffee bean & tea leaf",
    "the coffee bean & tea leaf",
    "tim hortons",
    "baker & cook",
}

FIELDNAMES = [
    "seed_no",
    "seed_name",
    "brand",
    "address_hint",
    "match_status",
    "candidate_count",
    "place_id",
    "resolved_name",
    "resolved_address",
    "lat",
    "lng",
    "business_status",
    "proposed_venue_id",
]


def postal_code(text):
    match = POSTAL_RE.search(text or "")
    return match.group(1) if match else None


def classify(seed, candidates):
    """Decide whether the top candidate can be trusted.

    Returns (match_status, chosen_candidate_or_None).
    """
    if not candidates:
        return "no_match", None

    top = candidates[0]

    # An address hint carries a postal code, which is the strongest available
    # check: the resolved address must agree with the one that was asked for.
    hint_postal = postal_code(seed["address_hint"])
    if hint_postal:
        matching = [
            c for c in candidates if postal_code(c.get("formattedAddress")) == hint_postal
        ]
        if len(matching) == 1:
            return "confident", matching[0]
        if not matching:
            return "ambiguous", top
        return "ambiguous", matching[0]

    if len(candidates) == 1:
        return "confident", top

    # Several results and no postal code to arbitrate. Trust the top result only
    # when its name matches the seed and the runner-up's does not — otherwise two
    # branches of the same chain are competing and a human must choose.
    seed_name = seed["name"].lower()
    top_name = (top.get("displayName") or {}).get("text", "").lower()
    second_name = (candidates[1].get("displayName") or {}).get("text", "").lower()
    if top_name == seed_name and second_name != seed_name:
        return "confident", top
    return "ambiguous", top


def propose_venue_id(seed, candidate):
    """Suggest a venue_id slug. `NEEDS_SLUG` where the data cannot name it."""
    if candidate is None:
        return "NEEDS_SLUG"
    resolved_name = (candidate.get("displayName") or {}).get("text", "").strip()
    brand_slug = slugify(seed["brand"]) or "venue"

    if resolved_name and resolved_name.lower() not in BARE_NAMES:
        slug = slugify(resolved_name)
        # "Starbucks Wisma Atria" -> "starbucks-wisma-atria", not doubled up.
        # A plain startswith() check missed "Baker & Cook - Eng Kong Park":
        # slugify() drops "&", so its slug ("baker-cook-...") never matches
        # the brand slug ("baker-and-cook"), and got prepended anyway ->
        # "baker-and-cook-baker-cook-eng-kong-park". Token overlap catches
        # this regardless of how the brand name's punctuation slugifies.
        brand_tokens = set(brand_slug.split("-")) - {"and", "the", "of"}
        slug_tokens = set(slug.split("-"))
        if not (slug_tokens & brand_tokens):
            slug = f"{brand_slug}-{slug}"
        return slug

    # Bare brand name: the address is the only distinguishing text available.
    # Take the street line and flag it, because a street is not a venue name and
    # a human should confirm what this branch is actually called.
    address = candidate.get("formattedAddress", "")
    street = address.split(",")[0].strip() if address else ""
    if street:
        return f"NEEDS_SLUG:{brand_slug}-{slugify(street)}"
    return "NEEDS_SLUG"


def main():
    parser = argparse.ArgumentParser(description="Resolve venue seeds to Place IDs.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the query built for each seed and exit without calling the API",
    )
    args = parser.parse_args()

    seeds = read_seeds()
    print(f"{len(seeds)} seeds in {rel(SEEDS_PATH)}\n")

    if args.dry_run:
        for seed in seeds:
            print(f"{seed['seed_no']:>3}. {search_query(seed)}")
        print("\nDry run — no API calls made, nothing written.")
        return

    api_key = require_env("GOOGLE_PLACES_API_KEY")
    ensure_dirs()
    (RAW_DIR / "search").mkdir(parents=True, exist_ok=True)

    rows = []
    for seed in seeds:
        query = search_query(seed)
        try:
            candidates = search_text(query, api_key)
        except PlacesError as error:
            print(f"{seed['seed_no']:>3}. FAILED  {query}\n      {error} {error.body}")
            rows.append(
                {
                    **{key: "" for key in FIELDNAMES},
                    "seed_no": seed["seed_no"],
                    "seed_name": seed["name"],
                    "brand": seed["brand"],
                    "address_hint": seed["address_hint"],
                    "match_status": "error",
                    "candidate_count": 0,
                    "proposed_venue_id": "NEEDS_SLUG",
                }
            )
            continue

        write_json(RAW_DIR / "search" / f"seed_{seed['seed_no']:02d}.json", candidates)
        status, chosen = classify(seed, candidates)
        location = (chosen or {}).get("location", {})
        rows.append(
            {
                "seed_no": seed["seed_no"],
                "seed_name": seed["name"],
                "brand": seed["brand"],
                "address_hint": seed["address_hint"],
                "match_status": status,
                "candidate_count": len(candidates),
                "place_id": (chosen or {}).get("id", ""),
                "resolved_name": ((chosen or {}).get("displayName") or {}).get("text", ""),
                "resolved_address": (chosen or {}).get("formattedAddress", ""),
                "lat": location.get("latitude", ""),
                "lng": location.get("longitude", ""),
                "business_status": (chosen or {}).get("businessStatus", ""),
                "proposed_venue_id": propose_venue_id(seed, chosen),
            }
        )
        marker = {"confident": "ok", "ambiguous": "CHECK", "no_match": "NONE"}[status]
        print(
            f"{seed['seed_no']:>3}. {marker:<5} {rows[-1]['resolved_name'] or query}"
            f"  [{len(candidates)} candidates]\n      {rows[-1]['resolved_address']}"
        )

    # Two seeds landing on one Place ID means a duplicate in the venue list, or a
    # failed disambiguation. Either way it must not pass silently.
    seen = {}
    for row in rows:
        if row["place_id"]:
            seen.setdefault(row["place_id"], []).append(row["seed_no"])
    duplicates = {pid: nos for pid, nos in seen.items() if len(nos) > 1}

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    counts = {}
    for row in rows:
        counts[row["match_status"]] = counts.get(row["match_status"], 0) + 1
    print(f"\nWrote {rel(OUTPUT_PATH)}")
    print("  " + "  ".join(f"{status}: {count}" for status, count in sorted(counts.items())))
    if duplicates:
        print("\n  DUPLICATE Place IDs — resolve before continuing:")
        for place_id, seed_nos in duplicates.items():
            print(f"    {place_id}  seeds {seed_nos}")
    needs_attention = counts.get("ambiguous", 0) + counts.get("no_match", 0) + counts.get("error", 0)
    if needs_attention or duplicates:
        print(
            f"\n  {needs_attention} row(s) need a human decision. Fix them in "
            f"{rel(OUTPUT_PATH)} before running phase0_hours.py — every later "
            f"measurement keys off these Place IDs."
        )


if __name__ == "__main__":
    main()
