"""build/bootstrap_venue_sources.py — the one-time registry bootstrap.

Uses tmp_path throughout, even for the "does the file already exist"
refusal check — never the real repo's data/ files.
"""

import csv
import json

import pytest

from build.bootstrap_venue_sources import main

PLACE_IDS_ROWS = [
    {
        "proposed_venue_id": "starbucks-centrepoint",
        "place_id": "ChIJRZ1c0JYZ2jERZi1GJIoRVy0",
        "resolved_name": "Starbucks Centrepoint",
        "resolved_address": "176 Orchard Rd, Singapore 238843",
        "match_status": "confident",
    },
    {
        "proposed_venue_id": "starbucks-wisma-atria",
        "place_id": "ChIJkQL5B5IZ2jER520GahisXVQ",
        "resolved_name": "Starbucks Wisma Atria",
        "resolved_address": "435 Orchard Rd, Singapore 238877",
        "match_status": "confident",
    },
    {
        "proposed_venue_id": "some-unresolved-seed",
        "place_id": "",
        "resolved_name": "",
        "resolved_address": "",
        "match_status": "no_match",
    },
]


def write_place_ids(path, rows):
    fieldnames = [
        "proposed_venue_id",
        "place_id",
        "resolved_name",
        "resolved_address",
        "match_status",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_meta(path, venue_ids):
    path.write_text(json.dumps({vid: {} for vid in venue_ids}), encoding="utf-8")


def test_bootstrap_seeds_only_confident_rows(tmp_path):
    place_ids = tmp_path / "place_ids.csv"
    meta = tmp_path / "venues_meta.json"
    registry = tmp_path / "venue_sources.json"
    write_place_ids(place_ids, PLACE_IDS_ROWS)
    write_meta(meta, ["starbucks-centrepoint", "starbucks-wisma-atria"])

    main(registry_path=registry, place_ids_path=place_ids, meta_path=meta)

    written = json.loads(registry.read_text(encoding="utf-8"))
    assert len(written["venues"]) == 2
    assert {v["venue_id"] for v in written["venues"]} == {
        "starbucks-centrepoint",
        "starbucks-wisma-atria",
    }


def test_bootstrap_refuses_when_registry_already_exists(tmp_path):
    place_ids = tmp_path / "place_ids.csv"
    meta = tmp_path / "venues_meta.json"
    registry = tmp_path / "venue_sources.json"
    write_place_ids(place_ids, PLACE_IDS_ROWS)
    write_meta(meta, ["starbucks-centrepoint", "starbucks-wisma-atria"])

    existing_content = '{"venues": [{"hand": "edited"}]}'
    registry.write_text(existing_content, encoding="utf-8")

    with pytest.raises(SystemExit, match="already exists"):
        main(registry_path=registry, place_ids_path=place_ids, meta_path=meta)

    assert registry.read_text(encoding="utf-8") == existing_content


def test_bootstrap_fails_before_writing_on_id_set_disagreement(tmp_path):
    place_ids = tmp_path / "place_ids.csv"
    meta = tmp_path / "venues_meta.json"
    registry = tmp_path / "venue_sources.json"
    write_place_ids(place_ids, PLACE_IDS_ROWS)
    # meta is missing starbucks-wisma-atria — ID sets disagree.
    write_meta(meta, ["starbucks-centrepoint"])

    with pytest.raises(SystemExit, match="invalid registry"):
        main(registry_path=registry, place_ids_path=place_ids, meta_path=meta)

    assert not registry.exists()
