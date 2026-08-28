"""Phase 0, step 5 — Popular Times histograms via SerpApi.

    .venv/bin/python3 build/phase0_busyness.py

Confirms the busyness source works, records which venues have no Popular Times
data at all, and establishes `histogram_timezone` independently of the hours
source.

That last one needs saying plainly: **SerpApi does not state a timezone for the
Popular Times graph.** There is no field to read. So this script confirms it the
only way available — by checking the histogram against each venue's own opening
hours from step 4. If a venue opens at 07:30 and its first non-zero bucket is
07:00, the graph is in venue-local time. A systematic offset across every venue
would mean it is not, and `histogram_timezone` would differ from
`hours_timezone` — which is exactly why plan.md keeps them as separate fields.

Reads data/phase0/place_ids.csv and data/phase0/hours_summary.json.
Writes data/phase0/histograms.json, data/phase0/busyness_report.md and raw responses.
"""

import csv
import re
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from build.phase0_common import (  # noqa: E402
    PHASE0_DIR,
    RAW_DIR,
    WEEKDAYS,
    ensure_dirs,
    read_json,
    rel,
    require_env,
    write_json,
)

SERPAPI_URL = "https://serpapi.com/search.json"
PLACE_IDS_PATH = PHASE0_DIR / "place_ids.csv"
HOURS_SUMMARY_PATH = PHASE0_DIR / "hours_summary.json"
HISTOGRAMS_PATH = PHASE0_DIR / "histograms.json"
REPORT_PATH = PHASE0_DIR / "busyness_report.md"

TIMEOUT_SECONDS = 60
FULL_DAY_NAMES = {
    "monday": "mon",
    "tuesday": "tue",
    "wednesday": "wed",
    "thursday": "thu",
    "friday": "fri",
    "saturday": "sat",
    "sunday": "sun",
}
TIME_RE = re.compile(r"^\s*(\d{1,2})\s*(AM|PM)\s*$", re.IGNORECASE)


def parse_hour(label):
    """'6 AM' -> 6, '12 PM' -> 12, '12 AM' -> 0. None if unparseable."""
    match = TIME_RE.match(label or "")
    if not match:
        return None
    hour = int(match.group(1)) % 12
    if match.group(2).upper() == "PM":
        hour += 12
    return hour


def redact_key(url, api_key):
    """Strip the API key out of a URL before it can reach a log or exception."""
    return (url or "").replace(api_key, "***")


def serpapi_get(params, api_key):
    query = dict(params)
    query["api_key"] = api_key
    response = requests.get(SERPAPI_URL, params=query, timeout=TIMEOUT_SECONDS)
    try:
        response.raise_for_status()
    except requests.HTTPError as error:
        # requests.HTTPError's default __str__ embeds response.url, which
        # contains api_key= in plain text. Re-raise with that redacted so a
        # failed call never prints the key to a terminal or a transcript.
        safe_url = redact_key(response.url, api_key)
        raise RuntimeError(
            f"{response.status_code} {response.reason} for url: {safe_url}"
        ) from None
    payload = response.json()
    if "error" in payload:
        raise RuntimeError(payload["error"])
    return payload


def extract_histogram(payload):
    """popular_times -> {weekday: [{hour, busyness}]}. Empty dict when absent."""
    graph = (
        ((payload.get("place_results") or {}).get("popular_times") or {}).get("graph_results")
        or {}
    )
    histogram = {}
    for raw_day, entries in graph.items():
        day_key = FULL_DAY_NAMES.get(raw_day.lower())
        if day_key is None:
            continue
        buckets = []
        for entry in entries or []:
            hour = parse_hour(entry.get("time"))
            if hour is None:
                continue
            score = entry.get("busyness_score")
            if score is None:
                continue
            buckets.append({"hour": hour, "busyness": int(score)})
        histogram[day_key] = sorted(buckets, key=lambda b: b["hour"])
    return histogram


def fetch_one(query_text, api_key, raw_dir, seed_no):
    """Search; if that response has no `popular_times`, retry via the `data`
    parameter before accepting the negative. Absence is only trusted once
    both routes have been tried and both came back empty.

    Three designs preceded this one, each retracted in decisions.md,
    2026-08-29, after being contradicted by directly checking Google Maps:

    1. `type=place&place_id=...` as the primary lookup. Silently omitted real
       `popular_times` on Delfi Orchard, Fusionopolis, Tekka Place and Valley
       Point.
    2. Always search, then always a `data`-parameter follow-up. Missed that a
       specific query (venue name + exact address) makes the search collapse
       directly into a `place_results` object that already carries
       `popular_times` when it has any — so the follow-up was usually
       redundant.
    3. Trusting a missing `popular_times` on the *first* response (collapsed
       or not) as a confirmed absence. Still wrong: Fusionopolis and HillV2
       both come back with popular_times missing on the first response but
       present once retried via `data` — the omission is intermittent per
       call, not a property of the venue. Only SingHealth Tower and UTown
       stayed empty on both the first response and the retry, matching a
       direct check of Google Maps for those two specifically.

    So: extract `data_id` + `gps_coordinates` from whichever object the
    search response gives (the collapsed `place_results`, or the top
    `local_results` candidate when it doesn't collapse) and, if the first
    histogram is empty, spend the second call before calling it absent.
    """
    search = serpapi_get({"engine": "google_maps", "type": "search", "q": query_text, "hl": "en"}, api_key)
    write_json(raw_dir / f"seed_{seed_no:02d}_search.json", search)

    place_results = search.get("place_results")
    if place_results:
        histogram = extract_histogram({"place_results": place_results})
        if histogram:
            return histogram, "search_collapsed", ["search"]
        candidate = place_results
    else:
        locals_found = search.get("local_results") or []
        if not locals_found:
            return {}, "no_search_match", ["search"]
        candidate = locals_found[0]

    data_id = candidate.get("data_id")
    coords = candidate.get("gps_coordinates") or {}
    lat, lng = coords.get("latitude"), coords.get("longitude")
    if not data_id or lat is None or lng is None:
        return {}, "search_missing_fields", ["search"]

    data_param = f"!4m5!3m4!1s{data_id}!8m2!3d{lat}!4d{lng}"
    payload = serpapi_get({"engine": "google_maps", "type": "place", "data": data_param, "hl": "en"}, api_key)
    write_json(raw_dir / f"seed_{seed_no:02d}_by_data_param.json", payload)
    histogram = extract_histogram(payload)
    route = "search+data" if histogram else "confirmed_absent_after_retry"
    return histogram, route, ["search", "data"]


def first_active_hour(histogram):
    """Earliest hour with non-zero busyness across the week, or None."""
    hours = [
        bucket["hour"]
        for buckets in histogram.values()
        for bucket in buckets
        if bucket["busyness"] > 0
    ]
    return min(hours) if hours else None


def earliest_open_hour(venue_hours):
    """Earliest regular opening hour across the week, or None."""
    opens = [
        period["open"] // 60
        for periods in (venue_hours.get("regular_hours") or {}).values()
        for period in periods
        if not period.get("always_open")
    ]
    return min(opens) if opens else None


def load_hours_by_seed():
    if not HOURS_SUMMARY_PATH.exists():
        print(
            f"  note: {rel(HOURS_SUMMARY_PATH)} not found — the timezone cross-check "
            f"needs it. Run build/phase0_hours.py first for that part."
        )
        return {}
    summary = read_json(HOURS_SUMMARY_PATH)
    return {v["seed_no"]: v for v in summary.get("venues", []) if "error" not in v}


def main():
    api_key = require_env("SERPAPI_KEY")
    ensure_dirs()
    raw_dir = RAW_DIR / "busyness"
    raw_dir.mkdir(parents=True, exist_ok=True)

    if not PLACE_IDS_PATH.exists():
        sys.exit(f"missing {rel(PLACE_IDS_PATH)} — run build/phase0_resolve.py first.")
    with PLACE_IDS_PATH.open(newline="", encoding="utf-8") as handle:
        rows = [r for r in csv.DictReader(handle) if r.get("place_id")]

    hours_by_seed = load_hours_by_seed()
    print(f"fetching Popular Times for {len(rows)} venue(s)")
    print(f"  {len(rows)}-{len(rows) * 2} SerpApi searches (1 if the search collapses to a "
          f"single place, 2 if it needs a data-param follow-up) — count these against the "
          f"monthly free cap\n")

    venues = []
    for row in rows:
        seed_no = int(row["seed_no"])
        name = row["resolved_name"] or row["seed_name"]
        query_text = f"{name}, {row['resolved_address']}"
        try:
            histogram, route, attempts = fetch_one(query_text, api_key, raw_dir, seed_no)
        except Exception as error:  # requests, JSON and SerpApi errors alike
            print(f"  {seed_no:>3}. FAILED {name}: {error}")
            venues.append(
                {"seed_no": seed_no, "name": name, "error": str(error), "histogram": {}}
            )
            continue

        coverage = {day: len(histogram.get(day, [])) for day in WEEKDAYS}
        venues.append(
            {
                "seed_no": seed_no,
                "name": name,
                "place_id": row["place_id"],
                "proposed_venue_id": row["proposed_venue_id"],
                "route": route,
                "attempts": attempts,
                "coverage": coverage,
                "histogram": histogram,
            }
        )
        total_hours = sum(coverage.values())
        print(
            f"  {seed_no:>3}. {name[:44]:<44} route={route:<9} "
            f"{'no popular_times' if not histogram else f'{total_hours} hourly buckets'}"
        )

    # Timezone cross-check: histogram activity against this venue's own opening hour.
    #
    # Excludes venues flagged `multi_day_period` in hours_summary.json. Their
    # regular_hours only records the ONE weekday a multi-day period is anchored
    # to (see decisions.md, 2026-08-29) — earliest_open_hour() reads that single
    # anchor day and has no way to see the period's later reopening on another
    # day, which produces a large false "offset" that is a parsing gap, not a
    # timezone disagreement. Excluding them rather than let them raise a false
    # alarm; decisions.md records the excluded seeds and why.
    checks = []
    excluded_multi_day = []
    for venue in venues:
        venue_hours = hours_by_seed.get(venue["seed_no"])
        if not venue_hours or not venue["histogram"]:
            continue
        if "multi_day_period" in (venue_hours.get("shape_flags") or []):
            excluded_multi_day.append(venue["seed_no"])
            continue
        active = first_active_hour(venue["histogram"])
        opens = earliest_open_hour(venue_hours)
        if active is None or opens is None:
            continue
        checks.append(
            {
                "seed_no": venue["seed_no"],
                "name": venue["name"],
                "first_active_hour": active,
                "earliest_open_hour": opens,
                "offset_hours": active - opens,
            }
        )

    offsets = sorted({c["offset_hours"] for c in checks})
    with_data = [v for v in venues if v["histogram"]]
    without_data = [v for v in venues if not v["histogram"] and "error" not in v]
    failed = [v for v in venues if "error" in v]

    result = {
        "venue_count": len(venues),
        "with_popular_times": len(with_data),
        "without_popular_times": [v["name"] for v in without_data],
        "failed": [v["name"] for v in failed],
        "routes_used": sorted({v.get("route") for v in venues if v.get("route")}),
        "timezone_cross_check": {
            "method": (
                "first non-zero busyness hour minus earliest regular opening hour, per venue; "
                "SerpApi states no timezone for the Popular Times graph"
            ),
            "excluded_multi_day_period_seeds": excluded_multi_day,
            "offsets_observed_hours": offsets,
            "checks": checks,
        },
        "venues": venues,
    }
    write_json(HISTOGRAMS_PATH, result)
    write_report(result)

    print(f"\nWrote {rel(HISTOGRAMS_PATH)} and {rel(REPORT_PATH)}")
    print(f"  with popular_times:    {len(with_data)}/{len(venues)}")
    if without_data:
        print(f"  NO popular_times:      {[v['name'] for v in without_data]}")
    if failed:
        print(f"  failed:                {[v['name'] for v in failed]}")
    print(f"  routes that worked:    {result['routes_used']}")
    if excluded_multi_day:
        print(
            f"  excluded from tz check (multi_day_period, see decisions.md): "
            f"seeds {excluded_multi_day}"
        )
    print(f"  timezone offset check: {offsets or 'not run — need hours_summary.json'}")
    if offsets and any(abs(o) > 1 for o in offsets):
        print(
            "  WARNING: histogram activity does not line up with local opening hours. "
            "histogram_timezone may differ from hours_timezone — investigate before Phase 1."
        )


def write_report(result):
    lines = [
        "# Phase 0 — Popular Times availability and histogram timezone",
        "",
        f"{result['with_popular_times']} of {result['venue_count']} venues returned a "
        f"Popular Times graph. Routes that worked: {result['routes_used']}.",
        "",
        "## Venues with no Popular Times data",
        "",
    ]
    lines.append(
        "\n".join(f"- {name}" for name in result["without_popular_times"])
        or "None — every venue returned a graph."
    )
    lines += [
        "",
        "## Timezone cross-check",
        "",
        result["timezone_cross_check"]["method"] + ".",
        "",
        f"Offsets observed (hours): {result['timezone_cross_check']['offsets_observed_hours']}. "
        "A tight cluster around 0 means the graph is in venue-local time and "
        "`histogram_timezone` equals `hours_timezone`.",
        "",
        "| # | Venue | First active hour | Earliest open hour | Offset |",
        "| --- | --- | --- | --- | --- |",
    ]
    for check in result["timezone_cross_check"]["checks"]:
        lines.append(
            f"| {check['seed_no']} | {check['name']} | {check['first_active_hour']:02d}:00 | "
            f"{check['earliest_open_hour']:02d}:00 | {check['offset_hours']:+d}h |"
        )
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
