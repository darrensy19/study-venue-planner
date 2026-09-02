"""scraper/fetchers.py — fetch_hours, against fixture responses only.

`place_details` is monkeypatched in every test here; nothing touches the
network, per HANDOFF.md's required verification for IMP-006.
"""

import json
from datetime import date
from pathlib import Path

import pytest

import scraper.fetchers as fetchers
from scraper.hours import HoursValidationError
from scraper.places import PlacesError

FIXTURES = Path(__file__).parent / "fixtures"

SOURCE = {
    "venue_id": "starbucks-centrepoint",
    "place_id": "ChIJRZ1c0JYZ2jERZi1GJIoRVy0",
    "resolved_name": "Starbucks Centrepoint",
    "resolved_address": "176 Orchard Rd, Singapore 238843",
}


def load_fixture(name):
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


def test_fetch_hours_uses_source_place_id_and_parses_the_response(monkeypatch):
    seen_calls = []

    def fake_place_details(place_id, api_key):
        seen_calls.append((place_id, api_key))
        return load_fixture("ordinary_venue"), True

    monkeypatch.setattr(fetchers, "place_details", fake_place_details)

    result = fetchers.fetch_hours(SOURCE, "fake-api-key", request_date=date(2026, 8, 29))

    assert seen_calls == [("ChIJRZ1c0JYZ2jERZi1GJIoRVy0", "fake-api-key")]
    assert result["current_hours_valid_from"] == "2026-08-29"
    assert result["current_hours_by_date"]["2026-08-29"]["state"] == "known"


def test_fetch_hours_accepts_a_full_source_record_not_a_bare_place_id(monkeypatch):
    """Passing the record through — never just source["place_id"] alone —
    is what lets a caller pass venue_id/resolved_name/resolved_address too
    without fetch_hours needing to know about them."""
    monkeypatch.setattr(
        fetchers, "place_details", lambda place_id, api_key: (load_fixture("ordinary_venue"), True)
    )
    # SOURCE carries venue_id, resolved_name, resolved_address alongside
    # place_id — fetch_hours must accept the whole record without error.
    fetchers.fetch_hours(SOURCE, "fake-api-key", request_date=date(2026, 8, 29))


def test_fetch_hours_propagates_transport_failure_and_writes_nothing(monkeypatch, tmp_path):
    def failing_place_details(place_id, api_key):
        raise PlacesError("place details returned 500", status=500, body="server error")

    monkeypatch.setattr(fetchers, "place_details", failing_place_details)

    monkeypatch.chdir(tmp_path)
    files_before = list(tmp_path.iterdir())
    with pytest.raises(PlacesError):
        fetchers.fetch_hours(SOURCE, "fake-api-key", request_date=date(2026, 8, 29))
    assert list(tmp_path.iterdir()) == files_before


def test_fetch_hours_propagates_parse_failure_and_writes_nothing(monkeypatch, tmp_path):
    payload = load_fixture("ordinary_venue")
    periods = payload["currentOpeningHours"]["periods"]
    payload["currentOpeningHours"]["periods"] = [
        p for p in periods if p["open"]["date"] != {"year": 2026, "month": 9, "day": 1}
    ]
    monkeypatch.setattr(fetchers, "place_details", lambda place_id, api_key: (payload, True))

    monkeypatch.chdir(tmp_path)
    files_before = list(tmp_path.iterdir())
    with pytest.raises(HoursValidationError, match="malformed"):
        fetchers.fetch_hours(SOURCE, "fake-api-key", request_date=date(2026, 8, 29))
    assert list(tmp_path.iterdir()) == files_before
