"""Phase 0, step 4 — hours, timezone and the date-override horizon.

    .venv/bin/python3 build/phase0_hours.py

Answers three Phase 0 questions with measurements rather than assumptions:

  item 3  how far ahead does currentOpeningHours actually reach?
  item 4  what is hours_timezone, confirmed from this source alone?
  item 6  does any venue close after midnight, run 24h, or split its day?

Item 6 decides whether the periods array and the previous-date lookup in
plan.md earn their complexity. A clean "no venue does any of this" is a real
finding — it does not mean the machinery should be deleted, since the contract
must still represent what it represents, but it does mean the risk is lower
than the design assumed.

Reads data/phase0/place_ids.csv. Writes data/phase0/hours_summary.json,
data/phase0/hours_report.md and the raw responses.
"""

import csv
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from build.phase0_common import (  # noqa: E402
    PHASE0_DIR,
    RAW_DIR,
    WEEKDAYS,
    ensure_dirs,
    rel,
    require_env,
    write_json,
)
from scraper.places import PlacesError, place_details  # noqa: E402

PLACE_IDS_PATH = PHASE0_DIR / "place_ids.csv"
SUMMARY_PATH = PHASE0_DIR / "hours_summary.json"
REPORT_PATH = PHASE0_DIR / "hours_report.md"

# Places numbers days 0=Sunday; the venues.json contract keys them mon..sun.
PLACES_DAY_TO_KEY = {0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat"}


def to_minutes(point):
    return point.get("hour", 0) * 60 + point.get("minute", 0)


def period_to_contract(period):
    """One Places period as {open, close} in minutes from the open day's midnight.

    close > 1440 means the venue closes after midnight — the encoding the
    venues.json contract specifies. A period with no close is Google's
    representation of a 24-hour venue.
    """
    open_point = period.get("open") or {}
    close_point = period.get("close")
    open_minutes = to_minutes(open_point)
    if close_point is None:
        return {"open": 0, "close": 1440, "always_open": True}
    day_gap = (close_point.get("day", 0) - open_point.get("day", 0)) % 7
    return {
        "open": open_minutes,
        "close": to_minutes(close_point) + 1440 * day_gap,
        "always_open": False,
    }


def point_date(point):
    raw = (point or {}).get("date")
    if not raw:
        return None
    return date(raw["year"], raw["month"], raw["day"]).isoformat()


def parse_regular(payload):
    """regularOpeningHours -> {weekday: [periods]}, in contract form.

    A period with no `close` key is Google's encoding of "always open, every
    day" — it is anchored to a single day in the API response, but
    `weekdayDescriptions` confirms it applies to the whole week. Assigning it
    only to its anchor day was an earlier bug here: it left the other six days
    "absent" from a venue that is actually open every one of them.
    """
    by_day = defaultdict(list)
    for period in (payload.get("regularOpeningHours") or {}).get("periods", []):
        contract = period_to_contract(period)
        if contract["always_open"]:
            for day_key in WEEKDAYS:
                by_day[day_key].append(dict(contract))
            continue
        day_key = PLACES_DAY_TO_KEY.get((period.get("open") or {}).get("day"))
        if day_key is None:
            continue
        by_day[day_key].append(contract)
    return dict(by_day)


def parse_overrides(payload):
    """currentOpeningHours -> {iso_date: [periods]} plus the horizon it reaches."""
    by_date = defaultdict(list)
    for period in (payload.get("currentOpeningHours") or {}).get("periods", []):
        iso = point_date(period.get("open"))
        if iso is None:
            continue
        by_date[iso].append(period_to_contract(period))
    horizon = max(by_date) if by_date else None
    return dict(by_date), horizon


def describe_shapes(regular, overrides):
    """Flag the hours shapes that drive plan.md's complexity decisions.

    `after_midnight` (close spills at most one calendar day past its start) is
    kept distinct from `multi_day_period` (close lands two or more calendar
    days later — e.g. Fri 07:30 -> Sun close, or Sun -> the following Sat).
    The distinction is load-bearing, not cosmetic: CLAUDE.md's resolve_hours
    only ever inspects the arrival date and the single date before it. A
    period that spills exactly one day is representable within that rule —
    it is exactly the case the rule was written for. A period spanning two or
    more days is not: a day in the middle of the span has no period of its
    own, so it would incorrectly read as `day_absent_from_regular_hours`
    unless something upstream normalises it first. That normalisation does
    not exist yet — recording the shape here, not inventing a fix in Phase 0.
    """
    flags = set()
    all_periods = [p for periods in regular.values() for p in periods]
    all_periods += [p for periods in overrides.values() for p in periods]
    for period in all_periods:
        if period["always_open"]:
            flags.add("24_hour")
        elif period["close"] > 2 * 1440:
            flags.add("multi_day_period")
        elif period["close"] > 1440:
            flags.add("after_midnight")
    for periods in list(regular.values()) + list(overrides.values()):
        if len(periods) > 1:
            flags.add("split_periods")
    missing = [day for day in WEEKDAYS if day not in regular]
    if missing:
        flags.add("day_absent_from_regular_hours")
    return sorted(flags), missing


def load_place_rows():
    if not PLACE_IDS_PATH.exists():
        sys.exit(
            f"missing {rel(PLACE_IDS_PATH)} — run build/phase0_resolve.py first."
        )
    with PLACE_IDS_PATH.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    usable = [r for r in rows if r.get("place_id")]
    unresolved = [r for r in rows if not r.get("place_id")]
    flagged = [r for r in usable if r.get("match_status") != "confident"]
    if unresolved:
        print(f"  skipping {len(unresolved)} seed(s) with no Place ID")
    if flagged:
        print(
            f"  WARNING: {len(flagged)} row(s) are not marked `confident`. Their hours "
            f"will be fetched, but confirm the Place IDs before trusting the numbers."
        )
    return usable


def main():
    api_key = require_env("GOOGLE_PLACES_API_KEY")
    ensure_dirs()
    (RAW_DIR / "details").mkdir(parents=True, exist_ok=True)

    rows = load_place_rows()
    print(f"fetching details for {len(rows)} venue(s)\n")

    venues = []
    tz_field_served = None
    for row in rows:
        try:
            payload, tz_available = place_details(row["place_id"], api_key)
        except PlacesError as error:
            print(f"  FAILED {row['seed_name']}: {error} {error.body}")
            venues.append(
                {
                    "seed_no": int(row["seed_no"]),
                    "proposed_venue_id": row["proposed_venue_id"],
                    "place_id": row["place_id"],
                    "error": str(error),
                }
            )
            continue

        tz_field_served = tz_available if tz_field_served is None else tz_field_served
        write_json(RAW_DIR / "details" / f"seed_{int(row['seed_no']):02d}.json", payload)

        regular = parse_regular(payload)
        overrides, horizon = parse_overrides(payload)
        flags, missing_days = describe_shapes(regular, overrides)

        venues.append(
            {
                "seed_no": int(row["seed_no"]),
                "proposed_venue_id": row["proposed_venue_id"],
                "place_id": row["place_id"],
                "name": (payload.get("displayName") or {}).get("text", ""),
                "address": payload.get("formattedAddress", ""),
                "business_status": payload.get("businessStatus", ""),
                "utc_offset_minutes": payload.get("utcOffsetMinutes"),
                "time_zone_id": (payload.get("timeZone") or {}).get("id"),
                "regular_hours": regular,
                "date_overrides": overrides,
                "overrides_valid_through": horizon,
                "shape_flags": flags,
                "days_absent_from_regular_hours": missing_days,
            }
        )
        print(
            f"  {row['seed_no']:>3}. {venues[-1]['name'][:44]:<44} "
            f"tz={venues[-1]['time_zone_id'] or venues[-1]['utc_offset_minutes']} "
            f"horizon={horizon or '-'} {' '.join(flags)}"
        )

    ok = [v for v in venues if "error" not in v]
    today = date.today()

    offsets = sorted({v["utc_offset_minutes"] for v in ok if v["utc_offset_minutes"] is not None})
    zone_ids = sorted({v["time_zone_id"] for v in ok if v["time_zone_id"]})
    horizons = sorted({v["overrides_valid_through"] for v in ok if v["overrides_valid_through"]})
    horizon_days = [
        (date.fromisoformat(h) - today).days + 1 for h in horizons
    ]
    statuses = sorted({v["business_status"] for v in ok if v["business_status"]})
    all_flags = sorted({flag for v in ok for flag in v["shape_flags"]})

    summary = {
        "fetched_on": today.isoformat(),
        "venue_count": len(ok),
        "failed_count": len(venues) - len(ok),
        "timezone_field_served_by_api": tz_field_served,
        "utc_offset_minutes_observed": offsets,
        "time_zone_ids_observed": zone_ids,
        "override_horizon_dates_observed": horizons,
        "override_horizon_days_ahead": sorted(set(horizon_days)),
        "business_statuses_observed": statuses,
        "shape_flags_observed": all_flags,
        "venues": venues,
    }
    write_json(SUMMARY_PATH, summary)
    write_report(summary)

    print(f"\nWrote {rel(SUMMARY_PATH)} and {rel(REPORT_PATH)}")
    print(f"  utcOffsetMinutes observed: {offsets}   (Singapore is +480, no DST)")
    print(f"  timeZone ids observed:     {zone_ids or 'field not served by the API'}")
    print(f"  override horizon:          {horizon_days or 'no date overrides returned'} day(s) ahead")
    print(f"  business statuses:         {statuses}")
    print(f"  hours shapes present:      {all_flags or 'none — every venue is same-day, single-period'}")
    if len(offsets) > 1 or len(zone_ids) > 1:
        print("  WARNING: venues disagree on timezone. hours_timezone cannot be a single value.")


def write_report(summary):
    lines = [
        "# Phase 0 — hours, timezone and override horizon",
        "",
        f"Fetched {summary['fetched_on']} from the Google Places API (New).",
        f"{summary['venue_count']} venue(s) resolved, {summary['failed_count']} failed.",
        "",
        "## Source-level findings",
        "",
        "| Question | Measurement |",
        "| --- | --- |",
        f"| `hours_timezone` (IANA, from `timeZone`) | {summary['time_zone_ids_observed'] or 'field not served'} |",
        f"| UTC offset observed | {summary['utc_offset_minutes_observed']} |",
        f"| `overrides_valid_through` horizon | {summary['override_horizon_days_ahead']} day(s) ahead |",
        f"| `businessStatus` values seen | {summary['business_statuses_observed']} |",
        f"| Hours shapes present | {summary['shape_flags_observed'] or 'none'} |",
        "",
        "## Per venue",
        "",
        "| # | Venue | Status | Horizon | Shapes |",
        "| --- | --- | --- | --- | --- |",
    ]
    for venue in summary["venues"]:
        if "error" in venue:
            lines.append(f"| {venue['seed_no']} | (failed) | — | — | {venue['error']} |")
            continue
        lines.append(
            f"| {venue['seed_no']} | {venue['name']} | {venue['business_status']} | "
            f"{venue['overrides_valid_through'] or '—'} | "
            f"{' '.join(venue['shape_flags']) or 'plain'} |"
        )
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
