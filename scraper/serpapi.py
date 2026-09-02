"""SerpApi Google Maps transport — the busyness source (`PLAN.md`, "Fetch
layer and refresh orchestration").

Returns parsed responses. Writes nothing — `build/refresh.py` owns every
file, per the fetch-layer contract.

Two calls, both against the `google_maps` engine:

  search_maps(query_text, api_key)  free-text search; may collapse directly
                                     to `place_results` (this project's
                                     queries — venue name + exact address —
                                     do this in every payload seen so far,
                                     DECISIONS.md 2026-08-29) or return a
                                     `local_results` candidate list
  place_by_data(data_param, api_key)  follow-up lookup by a candidate's
                                       `data_id` + `gps_coordinates`, used
                                       when the first response's
                                       `popular_times` came back empty
"""

import requests

SERPAPI_URL = "https://serpapi.com/search.json"
TIMEOUT_SECONDS = 60


class SerpApiError(RuntimeError):
    """A SerpApi call failed. Carries the status and body for the report."""

    def __init__(self, message, status=None, body=None):
        super().__init__(message)
        self.status = status
        self.body = body


def _redact_key(text, api_key):
    """Strip the API key out of response text before it reaches an
    exception, a log, or a report — SerpApi echoes request context into
    some error bodies."""
    return (text or "").replace(api_key, "***")


def _get(params, api_key):
    query = dict(params)
    query["api_key"] = api_key
    response = requests.get(SERPAPI_URL, params=query, timeout=TIMEOUT_SECONDS)
    if response.status_code != 200:
        raise SerpApiError(
            f"SerpApi returned {response.status_code}",
            status=response.status_code,
            body=_redact_key(response.text, api_key)[:2000],
        )
    payload = response.json()
    if "error" in payload:
        raise SerpApiError(payload["error"], body=_redact_key(response.text, api_key)[:2000])
    return payload


def search_maps(query_text, api_key):
    return _get({"engine": "google_maps", "type": "search", "q": query_text, "hl": "en"}, api_key)


def place_by_data(data_param, api_key):
    return _get({"engine": "google_maps", "type": "place", "data": data_param, "hl": "en"}, api_key)
