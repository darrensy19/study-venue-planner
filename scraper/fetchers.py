"""The Phase 1 fetcher entry points — reusable, orchestrated only by
`build/refresh.py`. Neither fetcher writes any file; both take a full
source record from `data/venue_sources.json`, never a bare Place ID
(`PLAN.md`, "Fetch layer and refresh orchestration").

`fetch_busyness(source)` is step 2 and is not implemented here.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from scraper.hours import parse_hours
from scraper.places import place_details

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
