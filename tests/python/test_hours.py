"""scraper/hours.py — fixture-based, no live network.

Fixtures under fixtures/ are small trimmed real Phase 0 payloads except
fixtures/special_closure_synthetic.json, which is hand-built and labelled
as such: no saved payload contains `specialDays`.
"""

import json
from datetime import date
from pathlib import Path

import pytest

from scraper.hours import HoursValidationError, parse_hours

FIXTURES = Path(__file__).parent / "fixtures"
REQUEST_DATE = date(2026, 8, 29)


def load_fixture(name):
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


def test_ordinary_venue_no_unusual_shapes():
    """Plain 8am-10pm venue: no truncation, no multi-day, every date known."""
    result = parse_hours(load_fixture("ordinary_venue"), REQUEST_DATE)
    assert result["current_hours_valid_from"] == "2026-08-29"
    assert result["current_hours_valid_through"] == "2026-09-04"
    for iso in result["current_hours_by_date"]:
        entry = result["current_hours_by_date"][iso]
        assert entry["state"] == "known"
        assert entry["periods"] == [{"open": 480, "close": 1320, "always_open": False}]
    for day in ("mon", "tue", "wed", "thu", "fri", "sat", "sun"):
        assert result["regular_hours"][day]["state"] == "known"


def test_always_open_regular_has_no_close_key():
    result = parse_hours(load_fixture("always_open_both_truncated"), REQUEST_DATE)
    for day in ("mon", "tue", "wed", "thu", "fri", "sat", "sun"):
        periods = result["regular_hours"][day]["periods"]
        assert periods == [{"open": 0, "always_open": True}]
        assert "close" not in periods[0]


def test_both_end_truncated_spans_whole_window_and_close_reaches_seven_days():
    result = parse_hours(load_fixture("always_open_both_truncated"), REQUEST_DATE)
    by_date = result["current_hours_by_date"]
    # Anchor day: close legitimately reaches 7 * 1440 — not capped at 2880.
    assert by_date["2026-08-29"]["periods"][0]["close"] == 7 * 1440
    assert by_date["2026-08-29"]["periods"][0]["continues_beyond_window"] is True
    # continues_beyond_window propagates through every entry of the chain.
    for iso, entry in by_date.items():
        assert entry["periods"][0]["continues_beyond_window"] is True
    # Final window date: close normalises to the exclusive next midnight.
    assert by_date["2026-09-04"]["periods"][0]["close"] == 1440


def test_regular_multiday_decomposition_day_gap_two_appends_across_weekdays():
    """Friday 07:30 -> Sunday 22:00, day_gap=2: appended, self-contained."""
    result = parse_hours(load_fixture("regular_multiday_and_current_mixed"), REQUEST_DATE)
    regular = result["regular_hours"]
    assert regular["fri"]["periods"] == [{"open": 450, "close": 4200, "always_open": False}]
    assert regular["sat"]["periods"] == [{"open": 0, "close": 2760, "always_open": False}]
    assert regular["sun"]["periods"] == [{"open": 0, "close": 1320, "always_open": False}]


def test_current_hours_day_gap_one_decomposes_into_self_contained_entries():
    """A date covered only by a period spanning in from an earlier date is
    marked `known`, with its own self-contained period — not empty and not
    `closed` — because current authority never admits the previous date at
    runtime (see scraper/hours.py's module docstring)."""
    result = parse_hours(load_fixture("regular_multiday_and_current_mixed"), REQUEST_DATE)
    by_date = result["current_hours_by_date"]
    assert by_date["2026-08-29"] == {
        "state": "known",
        "periods": [{"open": 0, "close": 2760, "always_open": False}],
    }
    assert by_date["2026-08-30"] == {
        "state": "known",
        "periods": [{"open": 0, "close": 1320, "always_open": False}],
    }


def test_ordinary_venue_close_only_truncation_at_final_window_date():
    result = parse_hours(load_fixture("open_and_close_truncated"), REQUEST_DATE)
    final = result["current_hours_by_date"]["2026-09-04"]
    assert final["periods"] == [
        {"open": 390, "close": 1440, "always_open": False, "continues_beyond_window": True}
    ]


def test_open_only_truncation_spans_in_from_the_windows_first_date():
    result = parse_hours(load_fixture("open_and_close_truncated"), REQUEST_DATE)
    by_date = result["current_hours_by_date"]
    assert by_date["2026-08-29"]["periods"][0]["open"] == 0
    assert "continues_beyond_window" not in by_date["2026-08-29"]["periods"][0]


def test_special_closure_synthetic_marks_the_date_closed():
    result = parse_hours(load_fixture("special_closure_synthetic"), REQUEST_DATE)
    assert result["current_hours_by_date"]["2026-09-01"] == {"state": "closed", "periods": []}
    assert result["current_hours_by_date"]["2026-08-31"]["state"] == "known"


def test_current_hours_span_covered_date_is_known_not_closed():
    """A date materialised only via span-in coverage from an earlier date
    must never read as `closed` — that was the defect this contract fixes."""
    result = parse_hours(load_fixture("regular_multiday_and_current_mixed"), REQUEST_DATE)
    assert result["current_hours_by_date"]["2026-08-30"]["state"] == "known"


def test_missing_in_window_date_is_malformed_not_regular_fallback():
    payload = load_fixture("ordinary_venue")
    periods = payload["currentOpeningHours"]["periods"]
    payload["currentOpeningHours"]["periods"] = [
        p for p in periods if p["open"]["date"] != {"year": 2026, "month": 9, "day": 1}
    ]
    with pytest.raises(HoursValidationError, match="malformed"):
        parse_hours(payload, REQUEST_DATE)


def test_interior_truncation_fails_validation():
    payload = load_fixture("ordinary_venue")
    # Mark an interior (non-boundary) date's close as truncated — invalid.
    interior = payload["currentOpeningHours"]["periods"][2]
    assert interior["open"]["date"] == {"year": 2026, "month": 9, "day": 1}
    interior["close"]["truncated"] = True
    with pytest.raises(HoursValidationError, match="truncated"):
        parse_hours(payload, REQUEST_DATE)


def test_open_truncated_away_from_windows_first_date_fails_validation():
    payload = load_fixture("ordinary_venue")
    second = payload["currentOpeningHours"]["periods"][1]
    assert second["open"]["date"] == {"year": 2026, "month": 8, "day": 31}
    second["open"]["truncated"] = True
    with pytest.raises(HoursValidationError, match="truncated"):
        parse_hours(payload, REQUEST_DATE)


def test_open_truncated_at_the_right_date_but_wrong_clock_fails_validation():
    """Date-correct, time-incorrect: the contract requires 00:00, not just
    the window's first date. A wrong clock must be rejected, never silently
    coerced to 0 (IMP-006-R1-F01)."""
    payload = load_fixture("open_and_close_truncated")
    truncated_open = next(
        p for p in payload["currentOpeningHours"]["periods"] if p["open"].get("truncated")
    )
    assert truncated_open["open"]["date"] == {"year": 2026, "month": 8, "day": 29}
    truncated_open["open"]["hour"] = 12
    truncated_open["open"]["minute"] = 0
    with pytest.raises(HoursValidationError, match="00:00"):
        parse_hours(payload, REQUEST_DATE)


def test_close_truncated_at_the_right_date_but_wrong_clock_fails_validation():
    """Date-correct, time-incorrect close truncation must also be rejected,
    never silently coerced to the exclusive next midnight (IMP-006-R1-F01)."""
    payload = load_fixture("open_and_close_truncated")
    truncated_close = next(
        p for p in payload["currentOpeningHours"]["periods"] if p["close"].get("truncated")
    )
    assert truncated_close["close"]["date"] == {"year": 2026, "month": 9, "day": 4}
    truncated_close["close"]["hour"] = 12
    truncated_close["close"]["minute"] = 59
    with pytest.raises(HoursValidationError, match="23:59"):
        parse_hours(payload, REQUEST_DATE)


def test_regular_zero_duration_period_rejected():
    payload = {
        "regularOpeningHours": {
            "periods": [
                {"open": {"day": 1, "hour": 9, "minute": 0}, "close": {"day": 1, "hour": 9, "minute": 0}}
            ]
        },
        "currentOpeningHours": {"periods": []},
    }
    with pytest.raises(HoursValidationError, match="zero-duration"):
        parse_hours(payload, REQUEST_DATE)


def test_current_zero_duration_period_rejected():
    payload = load_fixture("ordinary_venue")
    first = payload["currentOpeningHours"]["periods"][0]
    first["close"] = dict(first["open"])
    with pytest.raises(HoursValidationError, match="zero-duration"):
        parse_hours(payload, REQUEST_DATE)


def test_current_period_with_no_close_is_unsupported():
    payload = {
        "regularOpeningHours": {"periods": []},
        "currentOpeningHours": {
            "periods": [
                {"open": {"day": 6, "hour": 0, "minute": 0, "date": {"year": 2026, "month": 8, "day": 29}}}
            ]
        },
    }
    with pytest.raises(HoursValidationError, match="no close"):
        parse_hours(payload, REQUEST_DATE)


def test_period_endpoint_outside_computed_window_fails_loudly():
    payload = load_fixture("ordinary_venue")
    last = payload["currentOpeningHours"]["periods"][-2]
    assert last["open"]["date"] == {"year": 2026, "month": 9, "day": 4}
    last["open"]["date"] = {"year": 2026, "month": 9, "day": 5}
    last["close"]["date"] = {"year": 2026, "month": 9, "day": 5}
    with pytest.raises(HoursValidationError, match="outside"):
        parse_hours(payload, REQUEST_DATE)


def test_weekday_absent_from_regular_hours_is_closed_not_unknown():
    payload = load_fixture("ordinary_venue")
    payload["regularOpeningHours"] = {
        "periods": [
            {"open": {"day": 1, "hour": 9, "minute": 0}, "close": {"day": 1, "hour": 17, "minute": 0}}
        ]
    }
    result = parse_hours(payload, REQUEST_DATE)
    assert result["regular_hours"]["tue"] == {"state": "closed", "periods": []}


def test_regular_cross_midnight_day_gap_one_stays_a_single_entry():
    """Friday 19:00 -> Saturday 01:00, day_gap=1: untouched — one entry,
    close carrying the after-midnight overflow, no Saturday entry created.
    The adjacent weekday is left to the runtime one-day lookback."""
    payload = load_fixture("ordinary_venue")
    payload["regularOpeningHours"] = {
        "periods": [
            {"open": {"day": 5, "hour": 19, "minute": 0}, "close": {"day": 6, "hour": 1, "minute": 0}}
        ]
    }
    result = parse_hours(payload, REQUEST_DATE)
    assert result["regular_hours"]["fri"]["periods"] == [
        {"open": 1140, "close": 1500, "always_open": False}
    ]
    assert result["regular_hours"]["sat"] == {"state": "closed", "periods": []}


def test_regular_multiday_decomposition_day_gap_six_touches_every_weekday():
    """Sunday 07:30 -> the following Saturday close — CLAUDE.md's own
    worked example of the maximum span, day_gap=6, seven touched weekdays."""
    payload = load_fixture("ordinary_venue")
    payload["regularOpeningHours"] = {
        "periods": [
            {"open": {"day": 0, "hour": 7, "minute": 30}, "close": {"day": 6, "hour": 17, "minute": 30}}
        ]
    }
    result = parse_hours(payload, REQUEST_DATE)
    regular = result["regular_hours"]
    real_close_abs = 6 * 1440 + (17 * 60 + 30)  # 9750
    expected_open_minutes = {"sun": 450}
    for offset, day in enumerate(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]):
        assert regular[day]["state"] == "known"
        periods = regular[day]["periods"]
        assert len(periods) == 1
        assert periods[0]["open"] == expected_open_minutes.get(day, 0)
        assert periods[0]["close"] == real_close_abs - offset * 1440


def test_regular_split_periods_are_appended_not_overwritten():
    """A lunch-break closure — two periods on the same weekday — must both
    survive, proving append rather than assignment."""
    payload = load_fixture("ordinary_venue")
    payload["regularOpeningHours"] = {
        "periods": [
            {"open": {"day": 1, "hour": 8, "minute": 0}, "close": {"day": 1, "hour": 12, "minute": 0}},
            {"open": {"day": 1, "hour": 13, "minute": 0}, "close": {"day": 1, "hour": 22, "minute": 0}},
        ]
    }
    result = parse_hours(payload, REQUEST_DATE)
    assert result["regular_hours"]["mon"]["periods"] == [
        {"open": 480, "close": 720, "always_open": False},
        {"open": 780, "close": 1320, "always_open": False},
    ]


def test_current_hours_split_periods_are_appended_not_overwritten():
    """The same lunch-break shape in currentOpeningHours, for one date —
    both periods must survive under that date's key."""
    payload = load_fixture("ordinary_venue")
    monday = {"year": 2026, "month": 8, "day": 31}
    periods = [
        p for p in payload["currentOpeningHours"]["periods"] if p["open"]["date"] != monday
    ]
    periods.append(
        {
            "open": {"day": 1, "hour": 8, "minute": 0, "date": monday},
            "close": {"day": 1, "hour": 12, "minute": 0, "date": monday},
        }
    )
    periods.append(
        {
            "open": {"day": 1, "hour": 13, "minute": 0, "date": monday},
            "close": {"day": 1, "hour": 22, "minute": 0, "date": monday},
        }
    )
    payload["currentOpeningHours"]["periods"] = periods
    result = parse_hours(payload, REQUEST_DATE)
    assert result["current_hours_by_date"]["2026-08-31"]["periods"] == [
        {"open": 480, "close": 720, "always_open": False},
        {"open": 780, "close": 1320, "always_open": False},
    ]


def test_regular_missing_open_day_fails_validation():
    payload = load_fixture("ordinary_venue")
    payload["regularOpeningHours"] = {
        "periods": [{"open": {"hour": 9, "minute": 0}, "close": {"day": 1, "hour": 17, "minute": 0}}]
    }
    with pytest.raises(HoursValidationError, match="open.day"):
        parse_hours(payload, REQUEST_DATE)


def test_regular_missing_close_day_fails_validation():
    payload = load_fixture("ordinary_venue")
    payload["regularOpeningHours"] = {
        "periods": [{"open": {"day": 1, "hour": 9, "minute": 0}, "close": {"hour": 17, "minute": 0}}]
    }
    with pytest.raises(HoursValidationError, match="close.day"):
        parse_hours(payload, REQUEST_DATE)


def test_current_missing_open_date_fails_validation():
    payload = load_fixture("ordinary_venue")
    first = payload["currentOpeningHours"]["periods"][0]
    del first["open"]["date"]
    with pytest.raises(HoursValidationError, match="open.date"):
        parse_hours(payload, REQUEST_DATE)


def test_current_missing_close_date_fails_validation():
    payload = load_fixture("ordinary_venue")
    first = payload["currentOpeningHours"]["periods"][0]
    del first["close"]["date"]
    with pytest.raises(HoursValidationError, match="close.date"):
        parse_hours(payload, REQUEST_DATE)


def _replace_period_for_date(payload, target_date, new_period):
    periods = payload["currentOpeningHours"]["periods"]
    payload["currentOpeningHours"]["periods"] = [
        p for p in periods if p["open"]["date"] != target_date
    ] + [new_period]
    return payload


def test_current_period_closing_exactly_at_midnight_emits_no_entry_on_next_date():
    """BL-001 / GAP 2: 08-29 07:30 -> 08-30 00:00 (day_gap=1, close exactly at
    midnight) must produce exactly one entry, anchored to 08-29 — never a
    spurious zero-length {open:0, close:0} entry on 08-30. The half-open
    [open, close) interval does not touch a date the close merely reaches."""
    payload = load_fixture("ordinary_venue")
    _replace_period_for_date(
        payload,
        {"year": 2026, "month": 8, "day": 29},
        {
            "open": {"day": 6, "hour": 7, "minute": 30, "date": {"year": 2026, "month": 8, "day": 29}},
            "close": {"day": 0, "hour": 0, "minute": 0, "date": {"year": 2026, "month": 8, "day": 30}},
        },
    )
    result = parse_hours(payload, REQUEST_DATE)
    assert result["current_hours_by_date"]["2026-08-29"]["periods"] == [
        {"open": 450, "close": 1440, "always_open": False}
    ]
    # 08-30 keeps only its own ordinary period from the base fixture — no
    # extra {open: 0, close: 0} contributed by the 08-29 span.
    assert result["current_hours_by_date"]["2026-08-30"]["periods"] == [
        {"open": 480, "close": 1320, "always_open": False}
    ]


def test_current_multiday_span_closing_exactly_at_midnight_skips_only_the_final_entry():
    """A day_gap>=2 span whose close also lands exactly at midnight: every
    interior day still gets its self-contained entry, and only the final
    (zero-length) date is skipped — not the whole decomposition."""
    payload = load_fixture("ordinary_venue")
    _replace_period_for_date(
        payload,
        {"year": 2026, "month": 8, "day": 29},
        {
            "open": {"day": 6, "hour": 7, "minute": 30, "date": {"year": 2026, "month": 8, "day": 29}},
            "close": {"day": 1, "hour": 0, "minute": 0, "date": {"year": 2026, "month": 8, "day": 31}},
        },
    )
    result = parse_hours(payload, REQUEST_DATE)
    by_date = result["current_hours_by_date"]
    assert by_date["2026-08-29"]["periods"] == [{"open": 450, "close": 2880, "always_open": False}]
    assert by_date["2026-08-30"]["periods"] == [
        {"open": 480, "close": 1320, "always_open": False},  # the date's own ordinary period
        {"open": 0, "close": 1440, "always_open": False},  # the interior span-in entry
    ]
    # 08-31's own ordinary period only — no trailing {open: 0, close: 0}.
    assert by_date["2026-08-31"]["periods"] == [{"open": 480, "close": 1320, "always_open": False}]


def test_current_period_not_closing_at_midnight_is_unaffected():
    """Control: an ordinary period whose close is not exactly midnight must
    still produce its normal entry — the fix must not skip anything else."""
    result = parse_hours(load_fixture("ordinary_venue"), REQUEST_DATE)
    assert result["current_hours_by_date"]["2026-08-29"]["periods"] == [
        {"open": 480, "close": 1320, "always_open": False}
    ]
