"""Popular Times parser — SerpApi Google Maps `place_results` payloads into
the `venues.json` busyness contract (`PLAN.md`, "Fetch layer and refresh
orchestration").

An empty histogram (`{}`) is a legitimate result — some venues genuinely
carry no Popular Times data on Google Maps (2 of 28 in Phase 0). It must
never be conflated with a `BusynessValidationError`, which marks a
malformed or unidentifiable response instead ("Two independent fetch
interfaces", `PLAN.md`).

Writes nothing — callers own every file, per the fetch-layer contract.
"""

import re

FULL_DAY_TO_KEY = {
    "monday": "mon",
    "tuesday": "tue",
    "wednesday": "wed",
    "thursday": "thu",
    "friday": "fri",
    "saturday": "sat",
    "sunday": "sun",
}

TIME_RE = re.compile(r"^\s*(\d{1,2})\s*(AM|PM)\s*$", re.IGNORECASE)


class BusynessValidationError(ValueError):
    """The payload violates the busyness contract — the search returned no
    identifiable venue, or a retry candidate lacked the fields needed to
    build the `data`-parameter follow-up.

    Raised rather than guessed through, mirroring `HoursValidationError`.
    """


def _parse_hour(label):
    """'6 AM' -> 6, '12 PM' -> 12, '12 AM' -> 0. None if unparseable."""
    match = TIME_RE.match(label or "")
    if not match:
        return None
    hour = int(match.group(1)) % 12
    if match.group(2).upper() == "PM":
        hour += 12
    return hour


def extract_histogram(payload):
    """A SerpApi Maps response -> {weekday: [{hour, busyness}]}.

    Empty ({}) when the response carries no `popular_times` at all —
    absence is the caller's concern (retry once, per PLAN.md, before
    treating it as confirmed), not this function's.
    """
    graph = (
        ((payload or {}).get("place_results") or {}).get("popular_times") or {}
    ).get("graph_results") or {}

    histogram = {}
    for raw_day, entries in graph.items():
        day_key = FULL_DAY_TO_KEY.get(raw_day.lower())
        if day_key is None:
            continue
        buckets = []
        for entry in entries or []:
            hour = _parse_hour(entry.get("time"))
            if hour is None:
                continue
            score = entry.get("busyness_score")
            if score is None:
                continue
            buckets.append({"hour": hour, "busyness": int(score)})
        histogram[day_key] = sorted(buckets, key=lambda b: b["hour"])
    return histogram
