"""scraper/fetchers.py — fetch_hours and fetch_busyness, against fixture
responses only.

`place_details` / `search_maps` / `place_by_data` are monkeypatched in
every test here; nothing touches the network, per HANDOFF.md's required
verification for IMP-006 and IMP-008.
"""

import json
from datetime import date
from pathlib import Path

import pytest

import scraper.fetchers as fetchers
from scraper.busyness import BusynessValidationError
from scraper.fetchers import IdentityValidationError
from scraper.hours import HoursValidationError
from scraper.places import PlacesError
from scraper.serpapi import SerpApiError

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


def test_fetch_place_snapshot_returns_identity_and_hours_from_one_call(monkeypatch):
    seen_calls = []

    def fake_place_details(place_id, api_key):
        seen_calls.append((place_id, api_key))
        return load_fixture("place_snapshot_ordinary"), True

    monkeypatch.setattr(fetchers, "place_details", fake_place_details)

    result = fetchers.fetch_place_snapshot(SOURCE, "fake-api-key", request_date=date(2026, 8, 29))

    # Exactly one Places Details call — the whole point of the composite
    # boundary is not spending a second billed call for data already present.
    assert seen_calls == [("ChIJRZ1c0JYZ2jERZi1GJIoRVy0", "fake-api-key")]
    assert result["identity"] == {
        "place_id": "ChIJRZ1c0JYZ2jERZi1GJIoRVy0",
        "name": "Starbucks Centrepoint",
        "lat": 1.3008,
        "lng": 103.8383,
        "business_status": "OPERATIONAL",
    }
    assert result["hours"]["current_hours_valid_from"] == "2026-08-29"
    assert result["hours"]["current_hours_by_date"]["2026-08-29"]["state"] == "known"


def test_fetch_place_snapshot_uses_source_place_id_never_the_bare_response_id(monkeypatch):
    """The registry's own place_id is the value written into venues.json,
    validated against the response rather than blindly replaced by it."""
    monkeypatch.setattr(
        fetchers, "place_details", lambda place_id, api_key: (load_fixture("place_snapshot_ordinary"), True)
    )

    result = fetchers.fetch_place_snapshot(SOURCE, "fake-api-key", request_date=date(2026, 8, 29))

    assert result["identity"]["place_id"] == SOURCE["place_id"]


def test_fetch_place_snapshot_rejects_a_returned_id_that_disagrees_with_the_source(monkeypatch):
    payload = load_fixture("place_snapshot_ordinary")
    payload["id"] = "ChIJ-some-other-place-entirely"
    monkeypatch.setattr(fetchers, "place_details", lambda place_id, api_key: (payload, True))

    with pytest.raises(IdentityValidationError, match="does not match"):
        fetchers.fetch_place_snapshot(SOURCE, "fake-api-key", request_date=date(2026, 8, 29))


@pytest.mark.parametrize(
    "mutate,match",
    [
        (lambda p: p.pop("displayName"), "displayName"),
        (lambda p: p.__setitem__("displayName", {}), "displayName"),
        (lambda p: p.pop("location"), "location"),
        (lambda p: p.__setitem__("location", {"latitude": 1.3008}), "location"),
        (lambda p: p.pop("businessStatus"), "businessStatus"),
        (lambda p: p.__setitem__("businessStatus", ""), "businessStatus"),
    ],
)
def test_fetch_place_snapshot_rejects_malformed_identity_fields(monkeypatch, mutate, match):
    payload = load_fixture("place_snapshot_ordinary")
    mutate(payload)
    monkeypatch.setattr(fetchers, "place_details", lambda place_id, api_key: (payload, True))

    with pytest.raises(IdentityValidationError, match=match):
        fetchers.fetch_place_snapshot(SOURCE, "fake-api-key", request_date=date(2026, 8, 29))


def test_fetch_place_snapshot_propagates_transport_failure_and_writes_nothing(monkeypatch, tmp_path):
    def failing_place_details(place_id, api_key):
        raise PlacesError("place details returned 500", status=500, body="server error")

    monkeypatch.setattr(fetchers, "place_details", failing_place_details)

    monkeypatch.chdir(tmp_path)
    files_before = list(tmp_path.iterdir())
    with pytest.raises(PlacesError):
        fetchers.fetch_place_snapshot(SOURCE, "fake-api-key", request_date=date(2026, 8, 29))
    assert list(tmp_path.iterdir()) == files_before


def test_fetch_place_snapshot_propagates_hours_parse_failure_with_valid_identity(monkeypatch, tmp_path):
    """A malformed hours payload fails the whole snapshot even though the
    identity fields alone would have been fine — identity and hours are one
    Places snapshot, never split at the fetch boundary."""
    payload = load_fixture("place_snapshot_ordinary")
    periods = payload["currentOpeningHours"]["periods"]
    payload["currentOpeningHours"]["periods"] = [
        p for p in periods if p["open"]["date"] != {"year": 2026, "month": 9, "day": 1}
    ]
    monkeypatch.setattr(fetchers, "place_details", lambda place_id, api_key: (payload, True))

    monkeypatch.chdir(tmp_path)
    files_before = list(tmp_path.iterdir())
    with pytest.raises(HoursValidationError, match="malformed"):
        fetchers.fetch_place_snapshot(SOURCE, "fake-api-key", request_date=date(2026, 8, 29))
    assert list(tmp_path.iterdir()) == files_before


def test_fetch_busyness_returns_histogram_when_search_collapses_with_data(monkeypatch):
    seen_queries = []

    def fake_search_maps(query_text, api_key):
        seen_queries.append((query_text, api_key))
        return load_fixture("serpapi_search_collapsed_with_data")

    def fail_place_by_data(data_param, api_key):
        raise AssertionError("the data-param retry must not be spent when the first response has data")

    monkeypatch.setattr(fetchers, "search_maps", fake_search_maps)
    monkeypatch.setattr(fetchers, "place_by_data", fail_place_by_data)

    result = fetchers.fetch_busyness(SOURCE, "fake-api-key")

    assert seen_queries == [
        ("Starbucks Centrepoint, 176 Orchard Rd, Singapore 238843", "fake-api-key")
    ]
    assert result == {
        "mon": [
            {"hour": 12, "busyness": 80},
            {"hour": 13, "busyness": 82},
            {"hour": 14, "busyness": 90},
            {"hour": 15, "busyness": 67},
        ],
        "tue": [
            {"hour": 12, "busyness": 65},
            {"hour": 13, "busyness": 67},
            {"hour": 14, "busyness": 71},
            {"hour": 15, "busyness": 71},
        ],
    }


def test_fetch_busyness_retries_via_data_param_after_empty_first_response(monkeypatch):
    calls = []

    def fake_search_maps(query_text, api_key):
        calls.append("search")
        return load_fixture("serpapi_search_collapsed_empty")

    def fake_place_by_data(data_param, api_key):
        calls.append("data")
        assert data_param.startswith("!4m5!3m4!1s")
        return load_fixture("serpapi_data_retry_found")

    monkeypatch.setattr(fetchers, "search_maps", fake_search_maps)
    monkeypatch.setattr(fetchers, "place_by_data", fake_place_by_data)

    result = fetchers.fetch_busyness(SOURCE, "fake-api-key")

    assert calls == ["search", "data"]
    assert result != {}


def test_fetch_busyness_confirmed_absent_only_after_both_routes_empty(monkeypatch):
    calls = []

    def fake_search_maps(query_text, api_key):
        calls.append("search")
        return load_fixture("serpapi_search_collapsed_confirmed_absent")

    def fake_place_by_data(data_param, api_key):
        calls.append("data")
        return load_fixture("serpapi_data_retry_confirmed_absent")

    monkeypatch.setattr(fetchers, "search_maps", fake_search_maps)
    monkeypatch.setattr(fetchers, "place_by_data", fake_place_by_data)

    result = fetchers.fetch_busyness(SOURCE, "fake-api-key")

    assert calls == ["search", "data"]
    assert result == {}


def test_fetch_busyness_follows_local_results_candidate_via_data_param(monkeypatch):
    """A synthetic case (real queries always collapse) — the local_results
    branch always spends the data-param retry, since no histogram can be
    read off the search response itself."""
    calls = []

    def fake_search_maps(query_text, api_key):
        calls.append("search")
        return load_fixture("serpapi_local_results_synthetic")

    def fake_place_by_data(data_param, api_key):
        calls.append("data")
        assert "0x0000000000000000" in data_param
        return load_fixture("serpapi_data_retry_found")

    monkeypatch.setattr(fetchers, "search_maps", fake_search_maps)
    monkeypatch.setattr(fetchers, "place_by_data", fake_place_by_data)

    result = fetchers.fetch_busyness(SOURCE, "fake-api-key")

    assert calls == ["search", "data"]
    assert result != {}


def test_fetch_busyness_raises_on_no_search_match(monkeypatch):
    monkeypatch.setattr(
        fetchers, "search_maps", lambda q, k: load_fixture("serpapi_no_match_synthetic")
    )
    monkeypatch.setattr(
        fetchers, "place_by_data", lambda d, k: (_ for _ in ()).throw(AssertionError("unreachable"))
    )

    with pytest.raises(BusynessValidationError, match="no search match"):
        fetchers.fetch_busyness(SOURCE, "fake-api-key")


def test_fetch_busyness_raises_on_candidate_missing_data_id_or_coordinates(monkeypatch):
    monkeypatch.setattr(
        fetchers,
        "search_maps",
        lambda q, k: load_fixture("serpapi_local_results_missing_fields_synthetic"),
    )
    monkeypatch.setattr(
        fetchers, "place_by_data", lambda d, k: (_ for _ in ()).throw(AssertionError("unreachable"))
    )

    with pytest.raises(BusynessValidationError, match="missing data_id"):
        fetchers.fetch_busyness(SOURCE, "fake-api-key")


def test_fetch_busyness_propagates_transport_failure_and_writes_nothing(monkeypatch, tmp_path):
    def failing_search_maps(query_text, api_key):
        raise SerpApiError("SerpApi returned 500", status=500, body="server error")

    monkeypatch.setattr(fetchers, "search_maps", failing_search_maps)

    monkeypatch.chdir(tmp_path)
    files_before = list(tmp_path.iterdir())
    with pytest.raises(SerpApiError):
        fetchers.fetch_busyness(SOURCE, "fake-api-key")
    assert list(tmp_path.iterdir()) == files_before
