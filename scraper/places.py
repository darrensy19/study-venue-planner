"""Google Places API (New) client.

Returns parsed responses. Writes nothing — build/ scripts own every file, per the
fetch-layer contract in plan.md.

Two calls are used in Phase 0:

  search_text()    resolve a venue name (+ address hint) to a Place ID
  place_details()  hours, business status, timezone for a known Place ID

Opening-hours fields bill under the Enterprise SKU. Both calls are deliberately
one-venue-at-a-time so a bad seed costs one call, not a batch.
"""

import requests

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"

# Roughly the centre of Singapore, with a radius that covers the whole island.
# A bias, not a filter: it ranks local results up without excluding anything.
SG_CENTRE = {"latitude": 1.3521, "longitude": 103.8198}
SG_RADIUS_M = 30000.0

SEARCH_FIELDS = (
    "places.id,"
    "places.displayName,"
    "places.formattedAddress,"
    "places.location,"
    "places.businessStatus"
)

# `timeZone` is requested but may not be served by every API version. Callers
# handle its absence rather than assuming an IANA name is available — Phase 0
# item 4 is to confirm the timezone, not to assert it.
DETAILS_FIELDS_WITH_TZ = (
    "id,displayName,formattedAddress,location,businessStatus,"
    "utcOffsetMinutes,timeZone,regularOpeningHours,currentOpeningHours"
)
DETAILS_FIELDS_NO_TZ = (
    "id,displayName,formattedAddress,location,businessStatus,"
    "utcOffsetMinutes,regularOpeningHours,currentOpeningHours"
)

TIMEOUT_SECONDS = 20


class PlacesError(RuntimeError):
    """A Places call failed. Carries the status and body for the report."""

    def __init__(self, message, status=None, body=None):
        super().__init__(message)
        self.status = status
        self.body = body


def search_text(text_query, api_key, max_results=5):
    """Resolve a free-text query to candidate places, best match first.

    Returns the full candidate list rather than picking a winner. Choosing
    among several matches is a judgement the caller must make visibly.
    """
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": SEARCH_FIELDS,
    }
    body = {
        "textQuery": text_query,
        "regionCode": "SG",
        "languageCode": "en",
        "maxResultCount": max_results,
        "locationBias": {"circle": {"center": SG_CENTRE, "radius": SG_RADIUS_M}},
    }
    response = requests.post(SEARCH_URL, headers=headers, json=body, timeout=TIMEOUT_SECONDS)
    if response.status_code != 200:
        raise PlacesError(
            f"searchText returned {response.status_code}",
            status=response.status_code,
            body=response.text[:2000],
        )
    return response.json().get("places", [])


def place_details(place_id, api_key):
    """Fetch details for one Place ID.

    Returns (payload, timezone_field_available). If the API rejects the
    `timeZone` field mask, the call is retried without it and the flag comes
    back False — that absence is itself a Phase 0 finding, not an error.
    """
    for field_mask, tz_available in (
        (DETAILS_FIELDS_WITH_TZ, True),
        (DETAILS_FIELDS_NO_TZ, False),
    ):
        headers = {"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": field_mask}
        response = requests.get(
            DETAILS_URL.format(place_id=place_id), headers=headers, timeout=TIMEOUT_SECONDS
        )
        if response.status_code == 200:
            return response.json(), tz_available
        # Only a field-mask rejection is worth retrying; anything else is real.
        if not (tz_available and response.status_code == 400 and "timeZone" in response.text):
            raise PlacesError(
                f"place details returned {response.status_code}",
                status=response.status_code,
                body=response.text[:2000],
            )
    raise PlacesError("unreachable")
