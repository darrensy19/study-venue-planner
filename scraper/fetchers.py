"""The Phase 1 fetcher entry points — reusable, orchestrated only by
`build/refresh.py`. Neither fetcher writes any file; both take a full
source record from `data/venue_sources.json`, never a bare Place ID
(`PLAN.md`, "Fetch layer and refresh orchestration").
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from scraper.busyness import BusynessValidationError, extract_histogram
from scraper.hours import parse_hours
from scraper.places import place_details
from scraper.serpapi import place_by_data, search_maps

SINGAPORE_TZ = ZoneInfo("Asia/Singapore")


def _today_singapore():
    return datetime.now(SINGAPORE_TZ).date()


def fetch_hours(source, api_key, request_date=None):
    """A venue_sources.json record -> Hours, keyed by source["place_id"].

    Propagates a transport failure (`PlacesError`) or a contract violation
    (`HoursValidationError`) to the caller. Writes nothing.
    """
    request_date = request_date or _today_singapore()
    payload, _ = place_details(source["place_id"], api_key)
    return parse_hours(payload, request_date)


def fetch_busyness(source, api_key):
    """A venue_sources.json record -> Histogram, searched on
    `resolved_name` + `resolved_address` (SerpApi's Maps search does not
    accept a Place ID).

    Propagates a transport failure (`SerpApiError`) or a contract violation
    (`BusynessValidationError`) to the caller. Writes nothing.

    Retries via the `data` parameter — built from the first response's
    `data_id` + `gps_coordinates` — before accepting an empty
    `popular_times` as confirmed absence: a negative on the first response
    is intermittent per call, not a property of the venue (`PLAN.md`,
    "Fetch layer and refresh orchestration"; `DECISIONS.md`, "Popular
    Times coverage, take two").
    """
    query_text = f"{source['resolved_name']}, {source['resolved_address']}"
    search = search_maps(query_text, api_key)

    place_results = search.get("place_results")
    if place_results:
        histogram = extract_histogram(search)
        if histogram:
            return histogram
        candidate = place_results
    else:
        local_results = search.get("local_results") or []
        if not local_results:
            raise BusynessValidationError(
                f"no search match for {source['venue_id']!r} — neither "
                "place_results nor local_results in the response"
            )
        candidate = local_results[0]

    data_id = candidate.get("data_id")
    coords = candidate.get("gps_coordinates") or {}
    lat, lng = coords.get("latitude"), coords.get("longitude")
    if not data_id or lat is None or lng is None:
        raise BusynessValidationError(
            f"search candidate for {source['venue_id']!r} is missing data_id "
            "or gps_coordinates — cannot build the data-param retry"
        )

    data_param = f"!4m5!3m4!1s{data_id}!8m2!3d{lat}!4d{lng}"
    retry = place_by_data(data_param, api_key)
    return extract_histogram(retry)
