"""build/refresh.py — Phase 1 step 7, complete refresh orchestration
(`PLAN.md`, "Fetch layer and refresh orchestration" / "Phase 1 implementation
order" item 7). Fixture-based; no network. `coarsen`, `generate_index_html`
and the real Node return-validator bridge run for real in most tests here —
only the two network-touching fetchers and (where a test needs a broken
bridge) `validate_return_transport` are monkeypatched — so the wiring itself,
not just the mocked call sequence, is what is under test.

Test naming tracks `PLAN.md`'s and `CLAUDE.md`'s own "Phase 1 orchestration
adds" testing obligations, plus the 8-step order contract.
"""

import json
from datetime import datetime
from pathlib import Path

import pytest

import build.refresh as refresh_module
from build.coarsen import CoarsenError
from build.generate import GenerationError
from build.refresh import RefreshError, refresh
from build.return_validator_bridge import BridgeError
from scraper.busyness import BusynessValidationError
from scraper.fetchers import IdentityValidationError
from scraper.places import PlacesError

TEMPLATE_HTML = (Path(__file__).parent / "fixtures" / "generate" / "template.html").read_text()
RANKING_STUB = "export function rankVenues(snapshot, controls) {\n  return { planA: null };\n}\n"
APP_STUB = (
    'import { rankVenues } from "./ranking.js";\n'
    "\n"
    "const result = rankVenues({ venues: [], holidays: {} }, {});\n"
)
STYLE_STUB = "body { margin: 0; }\n"

SOURCES = [
    {"venue_id": "v1", "place_id": "place-v1", "resolved_name": "Venue One", "resolved_address": "1 Road"},
    {"venue_id": "v2", "place_id": "place-v2", "resolved_name": "Venue Two", "resolved_address": "2 Road"},
]
META = {
    "v1": {"brand": "starbucks", "area": "A", "preference": 1},
    "v2": {"brand": "starbucks", "area": "B", "preference": 2},
}
HOLIDAYS = {"2026-01-01": {"name": "New Year's Day"}}

NOW = datetime(2026, 8, 29, 10, 0, 0, tzinfo=refresh_module.SINGAPORE_TZ)
NOW_ISO = NOW.isoformat()

HOURS_CONTRACT = {
    "current_hours_valid_from": "2026-08-29",
    "current_hours_valid_through": "2026-09-04",
    "regular_hours": {"mon": {"state": "known", "periods": [{"open": 480, "close": 1320, "always_open": False}]}},
    "current_hours_by_date": {
        "2026-08-29": {"state": "known", "periods": [{"open": 480, "close": 1320, "always_open": False}]}
    },
}


def make_snapshot(place_id, name="A Venue", lat=1.0, lng=103.0, business_status="OPERATIONAL"):
    return {
        "identity": {"place_id": place_id, "name": name, "lat": lat, "lng": lng, "business_status": business_status},
        "hours": dict(HOURS_CONTRACT),
    }


def setup_project(tmp_path, sources=SOURCES, meta=META, existing_venues=None, holidays=HOLIDAYS):
    data_dir = tmp_path / "data"
    web_dir = tmp_path / "web"
    data_dir.mkdir()
    web_dir.mkdir()

    (data_dir / "venue_sources.json").write_text(json.dumps({"venues": sources}), encoding="utf-8")
    (data_dir / "venues_meta.json").write_text(json.dumps(meta), encoding="utf-8")
    if holidays is not None:
        (data_dir / "holidays.json").write_text(json.dumps(holidays), encoding="utf-8")
    if existing_venues is not None:
        (data_dir / "venues.json").write_text(
            json.dumps(
                {"hours_timezone": "Asia/Singapore", "histogram_timezone": "Asia/Singapore", "venues": existing_venues}
            ),
            encoding="utf-8",
        )

    (web_dir / "index.template.html").write_text(TEMPLATE_HTML, encoding="utf-8")
    (web_dir / "ranking.js").write_text(RANKING_STUB, encoding="utf-8")
    (web_dir / "app.js").write_text(APP_STUB, encoding="utf-8")
    (web_dir / "style.css").write_text(STYLE_STUB, encoding="utf-8")

    return data_dir, web_dir


def succeed_snapshots(monkeypatch, results):
    """results: {venue_id: snapshot_dict_or_exception}."""

    def fake(source, api_key, request_date=None):
        outcome = results[source["venue_id"]]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(refresh_module, "fetch_place_snapshot", fake)


def succeed_busyness(monkeypatch, results):
    """results: {venue_id: days_dict_or_exception}."""

    def fake(source, api_key):
        outcome = results[source["venue_id"]]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(refresh_module, "fetch_busyness", fake)


def test_full_pipeline_writes_venues_json_and_generates_the_page(tmp_path, monkeypatch):
    data_dir, web_dir = setup_project(tmp_path)
    succeed_snapshots(monkeypatch, {"v1": make_snapshot("place-v1", name="Venue One"), "v2": make_snapshot("place-v2", name="Venue Two")})
    succeed_busyness(monkeypatch, {"v1": {"mon": [{"hour": 8, "busyness": 20}]}, "v2": {}})

    report = refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    assert report["venue_count"] == 2
    assert report["hours_status"] == {"v1": "ok", "v2": "ok"}
    assert report["histogram_status"] == {"v1": "ok", "v2": "ok"}
    assert report["return_transport_status"] == {"v1": "ok", "v2": "ok"}

    venues = json.loads((data_dir / "venues.json").read_text())
    assert venues["hours_timezone"] == "Asia/Singapore"
    by_id = {v["id"]: v for v in venues["venues"]}
    assert by_id["v1"]["place_id"] == "place-v1"
    assert by_id["v1"]["name"] == "Venue One"
    assert by_id["v1"]["return_transport_status"] == {"state": "ok"}
    assert by_id["v2"]["histogram"]["days"] == {}

    assert (web_dir / "index.html").exists()


def test_registry_precondition_failure_raises_before_any_fetch(tmp_path, monkeypatch):
    bad_sources = [SOURCES[0], SOURCES[0]]  # duplicate venue_id
    data_dir, web_dir = setup_project(tmp_path, sources=bad_sources)
    calls = []
    monkeypatch.setattr(refresh_module, "fetch_place_snapshot", lambda *a, **k: calls.append("fetch") or None)

    with pytest.raises(RefreshError, match="duplicate venue_id"):
        refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    assert calls == []
    assert not (data_dir / "venues.json").exists()
    assert not (web_dir / "index.html").exists()


def test_coarsen_runs_before_any_fetch_call(tmp_path, monkeypatch):
    data_dir, web_dir = setup_project(tmp_path)
    order = []
    monkeypatch.setattr(refresh_module, "coarsen", lambda *a, **k: order.append("coarsen"))

    def fake_snapshot(source, api_key, request_date=None):
        order.append(f"fetch:{source['venue_id']}")
        return make_snapshot(source["place_id"])

    monkeypatch.setattr(refresh_module, "fetch_place_snapshot", fake_snapshot)
    succeed_busyness(monkeypatch, {"v1": {}, "v2": {}})

    refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    assert order.index("coarsen") < order.index("fetch:v1")
    assert order.index("coarsen") < order.index("fetch:v2")


def test_coarsen_error_propagates_and_writes_nothing(tmp_path, monkeypatch):
    data_dir, web_dir = setup_project(tmp_path)

    def failing_coarsen(*a, **k):
        raise CoarsenError("2 raw-log candidates found")

    monkeypatch.setattr(refresh_module, "coarsen", failing_coarsen)

    with pytest.raises(CoarsenError):
        refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    assert not (data_dir / "venues.json").exists()
    assert not (web_dir / "index.html").exists()


def test_hours_failure_falls_back_to_last_known_good_and_status_becomes_stale(tmp_path, monkeypatch):
    existing = [
        {
            "id": "v1",
            "place_id": "place-v1",
            "name": "Venue One (old name)",
            "lat": 1.1,
            "lng": 103.1,
            "business_status": "OPERATIONAL",
            "hours": {
                "source": "places_api",
                "last_attempt_at": "2026-07-29T10:00:00+08:00",
                "last_success_at": "2026-07-29T10:00:00+08:00",
                "status": "ok",
                **HOURS_CONTRACT,
            },
            "histogram": {"source": "serpapi", "last_attempt_at": "2026-07-29T10:00:00+08:00", "status": "failed"},
        },
        {
            "id": "v2",
            "place_id": "place-v2",
            "hours": {"source": "places_api", "last_attempt_at": "2026-07-29T10:00:00+08:00", "status": "failed"},
            "histogram": {"source": "serpapi", "last_attempt_at": "2026-07-29T10:00:00+08:00", "status": "failed"},
        },
    ]
    data_dir, web_dir = setup_project(tmp_path, existing_venues=existing)
    succeed_snapshots(monkeypatch, {"v1": PlacesError("500"), "v2": make_snapshot("place-v2")})
    succeed_busyness(monkeypatch, {"v1": {}, "v2": {}})

    refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    venues = {v["id"]: v for v in json.loads((data_dir / "venues.json").read_text())["venues"]}
    v1_hours = venues["v1"]["hours"]
    assert v1_hours["status"] == "stale"
    assert v1_hours["last_attempt_at"] == NOW_ISO
    assert v1_hours["last_success_at"] == "2026-07-29T10:00:00+08:00"
    assert v1_hours["regular_hours"] == HOURS_CONTRACT["regular_hours"]
    assert v1_hours["current_hours_by_date"] == HOURS_CONTRACT["current_hours_by_date"]
    assert venues["v1"]["name"] == "Venue One (old name)"
    assert venues["v1"]["lat"] == 1.1


def test_hours_failure_with_no_prior_history_yields_failed_with_no_data(tmp_path, monkeypatch):
    data_dir, web_dir = setup_project(tmp_path)  # no existing venues.json
    succeed_snapshots(monkeypatch, {"v1": IdentityValidationError("bad"), "v2": make_snapshot("place-v2")})
    succeed_busyness(monkeypatch, {"v1": {}, "v2": {}})

    refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    venues = {v["id"]: v for v in json.loads((data_dir / "venues.json").read_text())["venues"]}
    v1 = venues["v1"]
    assert v1["hours"] == {"source": "places_api", "last_attempt_at": NOW_ISO, "status": "failed"}
    assert "name" not in v1
    assert "lat" not in v1
    assert "business_status" not in v1
    # place_id and id are registry-sourced, never withheld by a fetch failure.
    assert v1["id"] == "v1"
    assert v1["place_id"] == "place-v1"


def test_busyness_failure_independent_of_hours_success(tmp_path, monkeypatch):
    data_dir, web_dir = setup_project(tmp_path)
    succeed_snapshots(monkeypatch, {"v1": make_snapshot("place-v1"), "v2": make_snapshot("place-v2")})
    succeed_busyness(monkeypatch, {"v1": BusynessValidationError("no match"), "v2": {}})

    report = refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    assert report["hours_status"] == {"v1": "ok", "v2": "ok"}
    assert report["histogram_status"] == {"v1": "failed", "v2": "ok"}
    venues = {v["id"]: v for v in json.loads((data_dir / "venues.json").read_text())["venues"]}
    assert "days" not in venues["v1"]["histogram"]
    assert venues["v2"]["histogram"]["days"] == {}


def test_confirmed_absent_busyness_is_ok_not_a_failure(tmp_path, monkeypatch):
    data_dir, web_dir = setup_project(tmp_path)
    succeed_snapshots(monkeypatch, {"v1": make_snapshot("place-v1"), "v2": make_snapshot("place-v2")})
    succeed_busyness(monkeypatch, {"v1": {}, "v2": {}})

    report = refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    assert report["histogram_status"] == {"v1": "ok", "v2": "ok"}


def test_broken_bridge_stops_refresh_before_atomic_replace(tmp_path, monkeypatch):
    data_dir, web_dir = setup_project(tmp_path)
    succeed_snapshots(monkeypatch, {"v1": make_snapshot("place-v1"), "v2": make_snapshot("place-v2")})
    succeed_busyness(monkeypatch, {"v1": {}, "v2": {}})

    def broken_bridge(*a, **k):
        raise BridgeError("node executable not found")

    monkeypatch.setattr(refresh_module, "validate_return_transport", broken_bridge)

    with pytest.raises(BridgeError):
        refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    assert not (data_dir / "venues.json").exists()
    assert not (web_dir / "index.html").exists()


def test_broken_bridge_never_overwrites_an_existing_venues_json(tmp_path, monkeypatch):
    existing = [{"id": "v1", "place_id": "place-v1", "hours": {"source": "places_api", "status": "failed", "last_attempt_at": "x"}, "histogram": {"source": "serpapi", "status": "failed", "last_attempt_at": "x"}}]
    data_dir, web_dir = setup_project(tmp_path, existing_venues=existing)
    before = (data_dir / "venues.json").read_text()
    succeed_snapshots(monkeypatch, {"v1": make_snapshot("place-v1"), "v2": make_snapshot("place-v2")})
    succeed_busyness(monkeypatch, {"v1": {}, "v2": {}})
    monkeypatch.setattr(refresh_module, "validate_return_transport", lambda *a, **k: (_ for _ in ()).throw(BridgeError("boom")))

    with pytest.raises(BridgeError):
        refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    assert (data_dir / "venues.json").read_text() == before


def test_per_venue_invalid_return_status_lets_generation_continue(tmp_path, monkeypatch):
    data_dir, web_dir = setup_project(tmp_path)
    succeed_snapshots(monkeypatch, {"v1": make_snapshot("place-v1"), "v2": make_snapshot("place-v2")})
    succeed_busyness(monkeypatch, {"v1": {}, "v2": {}})
    monkeypatch.setattr(
        refresh_module,
        "validate_return_transport",
        lambda *a, **k: {"v1": {"state": "ok"}, "v2": {"state": "invalid", "reason": "malformed band"}},
    )

    report = refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    assert report["return_transport_status"] == {"v1": "ok", "v2": "invalid"}
    venues = {v["id"]: v for v in json.loads((data_dir / "venues.json").read_text())["venues"]}
    assert venues["v2"]["return_transport_status"] == {"state": "invalid", "reason": "malformed band"}
    assert (web_dir / "index.html").exists()


def test_holidays_json_absent_fails_generation_but_venues_json_is_already_written(tmp_path, monkeypatch):
    data_dir, web_dir = setup_project(tmp_path, holidays=None)
    succeed_snapshots(monkeypatch, {"v1": make_snapshot("place-v1"), "v2": make_snapshot("place-v2")})
    succeed_busyness(monkeypatch, {"v1": {}, "v2": {}})

    with pytest.raises(GenerationError, match="holidays.json"):
        refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    assert (data_dir / "venues.json").exists()
    venues = json.loads((data_dir / "venues.json").read_text())
    assert len(venues["venues"]) == 2
    assert not (web_dir / "index.html").exists()


def test_return_transport_status_attached_by_id_not_position(tmp_path, monkeypatch):
    sources = [SOURCES[1], SOURCES[0]]  # v2 registered before v1
    data_dir, web_dir = setup_project(tmp_path, sources=sources)
    succeed_snapshots(monkeypatch, {"v1": make_snapshot("place-v1"), "v2": make_snapshot("place-v2")})
    succeed_busyness(monkeypatch, {"v1": {}, "v2": {}})
    monkeypatch.setattr(
        refresh_module,
        "validate_return_transport",
        lambda *a, **k: {"v1": {"state": "invalid", "reason": "x"}, "v2": {"state": "ok"}},
    )

    refresh(data_dir=data_dir, web_dir=web_dir, hours_api_key="hk", busyness_api_key="bk", now=NOW)

    venues = {v["id"]: v for v in json.loads((data_dir / "venues.json").read_text())["venues"]}
    assert venues["v1"]["return_transport_status"]["state"] == "invalid"
    assert venues["v2"]["return_transport_status"]["state"] == "ok"
