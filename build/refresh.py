"""Phase 1 step 7 — complete refresh orchestration (`PLAN.md`, "Fetch layer
and refresh orchestration" / "Phase 1 implementation order" item 7).

The sole writer of `data/venues.json` and `web/index.html`. Order is a
contract, not a convenience (`PLAN.md`):

  1. Coarsen new raw visits FIRST, against the currently-deployed histogram —
     the only step that can capture busyness in effect at visit time.
  2. Fetch both interfaces for every venue, catching failures per source and
     per venue — one venue's or one source's failure never blocks another's.
  3. Contract validation is inherent in step 2: `fetch_place_snapshot` and
     `fetch_busyness` raise on malformed data, so a source that "succeeded"
     here already passed the contract.
  4. Merge with the existing `venues.json`, retaining last-known-good for
     any failed source.
  5. Record `last_attempt_at` / `last_success_at` / `status` per source.
  6. Run `validate_return_transport` unconditionally over the whole of
     `venues_meta.json` and stamp `return_transport_status` on every venue —
     mandatory even when every fetch failed this run. It classifies and
     never aborts a per-venue result, but a broken bridge (`BridgeError`)
     stops the whole refresh before the next step.
  7. Write to a temp file and replace atomically.
  8. Regenerate `web/index.html`.

`make refresh` (the Makefile target) never commits — inspecting the diff,
committing and pushing stay separate manual actions.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from build.coarsen import coarsen  # noqa: E402
from build.generate import generate_index_html  # noqa: E402
from build.return_validator_bridge import validate_return_transport  # noqa: E402
from scraper.busyness import BusynessValidationError  # noqa: E402
from scraper.fetchers import IdentityValidationError, fetch_busyness, fetch_place_snapshot  # noqa: E402
from scraper.hours import HoursValidationError  # noqa: E402
from scraper.places import PlacesError  # noqa: E402
from scraper.serpapi import SerpApiError  # noqa: E402
from scraper.venue_sources import RegistryValidationError, load_registry, validate_registry  # noqa: E402

SINGAPORE_TZ = ZoneInfo("Asia/Singapore")

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
WEB_DIR = REPO_ROOT / "web"

TEMPLATE_PATH = WEB_DIR / "index.template.html"
RANKING_JS_PATH = WEB_DIR / "ranking.js"
APP_JS_PATH = WEB_DIR / "app.js"
STYLE_CSS_PATH = WEB_DIR / "style.css"
INDEX_HTML_PATH = WEB_DIR / "index.html"

HOURS_TIMEZONE = "Asia/Singapore"
HISTOGRAM_TIMEZONE = "Asia/Singapore"

# A single (hours) or (histogram) source's own failure — caught per source
# per venue so one source's or one venue's failure never blocks the rest
# (PLAN.md: "A busyness failure still refreshes hours, and vice versa.
# Degradation must be visible.").
HOURS_FAILURES = (PlacesError, HoursValidationError, IdentityValidationError)
BUSYNESS_FAILURES = (SerpApiError, BusynessValidationError)

HOURS_CONTRACT_FIELDS = (
    "current_hours_valid_from",
    "current_hours_valid_through",
    "regular_hours",
    "current_hours_by_date",
)
IDENTITY_FIELDS = ("name", "lat", "lng", "business_status")


class RefreshError(Exception):
    """The refresh contract was violated before any file is touched — a
    broken venue-source registry precondition. Never partially applied.
    """


def _resolve_freshness(previous_source_block, succeeded, now_iso):
    """The one status/last_attempt_at/last_success_at rule, applied per
    source per venue (`PLAN.md`, "The three statuses resolve from one rule,
    applied per source per venue").
    """
    if succeeded:
        return "ok", now_iso, now_iso
    previous_last_success = (previous_source_block or {}).get("last_success_at")
    if previous_last_success:
        return "stale", now_iso, previous_last_success
    return "failed", now_iso, None


def _merge_hours_source(existing_venue, snapshot, now_iso):
    """Returns `(identity_fields, hours_block)` for one venue's Places side.

    `snapshot` is `fetch_place_snapshot`'s result on success, `None` on
    failure. Identity and hours came from the same Places response and are
    retained together as one last-known-good unit on failure — never a
    fresh identity paired with stale hours or vice versa.
    """
    previous_hours = (existing_venue or {}).get("hours")
    status, last_attempt_at, last_success_at = _resolve_freshness(
        previous_hours, snapshot is not None, now_iso
    )

    if snapshot is not None:
        hours_block = {
            "source": "places_api",
            "last_attempt_at": last_attempt_at,
            "last_success_at": last_success_at,
            "status": status,
            **snapshot["hours"],
        }
        return dict(snapshot["identity"]), hours_block

    identity_fields = {}
    if existing_venue is not None:
        for field in IDENTITY_FIELDS:
            if field in existing_venue:
                identity_fields[field] = existing_venue[field]

    hours_block = {"source": "places_api", "last_attempt_at": last_attempt_at, "status": status}
    if last_success_at is not None:
        hours_block["last_success_at"] = last_success_at
    if previous_hours is not None and status == "stale":
        for field in HOURS_CONTRACT_FIELDS:
            if field in previous_hours:
                hours_block[field] = previous_hours[field]
    return identity_fields, hours_block


def _merge_histogram_source(existing_venue, days, now_iso):
    """Returns the `histogram` block. `days` is `fetch_busyness`'s result —
    a dict, possibly `{}` for a confirmed-absent venue — on success, `None`
    on failure.
    """
    previous_histogram = (existing_venue or {}).get("histogram")
    status, last_attempt_at, last_success_at = _resolve_freshness(
        previous_histogram, days is not None, now_iso
    )

    if days is not None:
        return {
            "source": "serpapi",
            "last_attempt_at": last_attempt_at,
            "last_success_at": last_success_at,
            "status": status,
            "days": days,
        }

    histogram_block = {"source": "serpapi", "last_attempt_at": last_attempt_at, "status": status}
    if last_success_at is not None:
        histogram_block["last_success_at"] = last_success_at
    if previous_histogram is not None and status == "stale" and "days" in previous_histogram:
        histogram_block["days"] = previous_histogram["days"]
    return histogram_block


def _fetch_one_venue(source, existing_venue, hours_api_key, busyness_api_key, now_iso, request_date):
    """Fetch both sources for one venue, catching failures independently.
    Never raises for an ordinary fetch failure — that is data, not a stop
    condition.
    """
    try:
        snapshot = fetch_place_snapshot(source, hours_api_key, request_date=request_date)
    except HOURS_FAILURES:
        snapshot = None

    try:
        days = fetch_busyness(source, busyness_api_key)
    except BUSYNESS_FAILURES:
        days = None

    identity_fields, hours_block = _merge_hours_source(existing_venue, snapshot, now_iso)
    histogram_block = _merge_histogram_source(existing_venue, days, now_iso)

    return {
        "id": source["venue_id"],
        "place_id": source["place_id"],
        **identity_fields,
        "hours": hours_block,
        "histogram": histogram_block,
    }


def _load_existing_venues(venues_json_path):
    if not venues_json_path.exists():
        return {}
    data = json.loads(venues_json_path.read_text(encoding="utf-8"))
    return {v["id"]: v for v in data.get("venues", [])}


def _write_venues_json_atomic(venues_json_path, venues):
    payload = {
        "hours_timezone": HOURS_TIMEZONE,
        "histogram_timezone": HISTOGRAM_TIMEZONE,
        "venues": venues,
    }
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    tmp_path = venues_json_path.parent / f".{venues_json_path.name}.tmp-{os.getpid()}"
    tmp_path.write_text(text, encoding="utf-8")
    os.replace(tmp_path, venues_json_path)


def refresh(
    *,
    data_dir=DATA_DIR,
    web_dir=WEB_DIR,
    hours_api_key,
    busyness_api_key,
    node_path="node",
    now=None,
):
    """Run the whole pipeline once. Returns a per-venue/per-source summary
    dict for the caller to report.

    Raises `RefreshError` (registry precondition failure) or `CoarsenError`
    before any API call; `BridgeError` (a broken return-validator bridge)
    before `data/venues.json` is touched; `GenerationError` if the final
    generation step's own structural assertions fail — which happens only
    *after* `data/venues.json` has already been atomically replaced,
    exactly as `PLAN.md`'s step 7-then-8 order requires.
    """
    venue_sources_path = data_dir / "venue_sources.json"
    venues_meta_path = data_dir / "venues_meta.json"
    venues_json_path = data_dir / "venues.json"
    holidays_path = data_dir / "holidays.json"
    seatlog_path = data_dir / "seatlog.csv"

    template_path = web_dir / "index.template.html"
    ranking_js_path = web_dir / "ranking.js"
    app_js_path = web_dir / "app.js"
    style_css_path = web_dir / "style.css"
    output_path = web_dir / "index.html"

    venues_meta = json.loads(venues_meta_path.read_text(encoding="utf-8"))
    registry = load_registry(venue_sources_path)
    try:
        validate_registry(registry, venues_meta.keys())
    except RegistryValidationError as exc:
        raise RefreshError(f"venue-source registry invalid: {exc}") from exc

    known_venue_ids = {record["venue_id"] for record in registry}

    # Step 1: coarsen first, against the histogram about to be replaced.
    coarsen(data_dir, venues_json_path, known_venue_ids)

    now_dt = now or datetime.now(SINGAPORE_TZ)
    now_iso = now_dt.isoformat()
    request_date = now_dt.date()

    existing_venues = _load_existing_venues(venues_json_path)

    # Steps 2-5: fetch both sources per venue, independently, retaining
    # last-known-good on failure.
    venues = [
        _fetch_one_venue(
            source,
            existing_venues.get(source["venue_id"]),
            hours_api_key,
            busyness_api_key,
            now_iso,
            request_date,
        )
        for source in registry
    ]

    # Step 6: mandatory, unconditional, whole-file. A broken bridge
    # (BridgeError) propagates uncaught, stopping everything before the
    # atomic replace; a per-venue "invalid" is an ordinary stamped result.
    return_status = validate_return_transport(venues_meta_path, node_path=node_path)
    for venue in venues:
        venue["return_transport_status"] = return_status[venue["id"]]

    # Step 7: write to a temp file and replace atomically.
    _write_venues_json_atomic(venues_json_path, venues)

    # Step 8: regenerate the self-contained page from the data just written.
    generate_index_html(
        venues_path=venues_json_path,
        venues_meta_path=venues_meta_path,
        holidays_path=holidays_path,
        seatlog_path=seatlog_path,
        template_path=template_path,
        ranking_js_path=ranking_js_path,
        app_js_path=app_js_path,
        style_css_path=style_css_path,
        output_path=output_path,
    )

    return {
        "venue_count": len(venues),
        "hours_status": {v["id"]: v["hours"]["status"] for v in venues},
        "histogram_status": {v["id"]: v["histogram"]["status"] for v in venues},
        "return_transport_status": {v["id"]: v["return_transport_status"]["state"] for v in venues},
    }


def main():
    from dotenv import load_dotenv

    load_dotenv()
    hours_api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    busyness_api_key = os.environ.get("SERPAPI_API_KEY")
    if not hours_api_key or not busyness_api_key:
        sys.exit(
            "GOOGLE_PLACES_API_KEY and SERPAPI_API_KEY must both be set "
            "(in .env or the environment)"
        )

    report = refresh(hours_api_key=hours_api_key, busyness_api_key=busyness_api_key)
    print(f"refreshed {report['venue_count']} venue(s)")
    for label, statuses in (
        ("hours", report["hours_status"]),
        ("histogram", report["histogram_status"]),
        ("return_transport", report["return_transport_status"]),
    ):
        degraded = {venue_id: status for venue_id, status in statuses.items() if status != "ok"}
        if degraded:
            print(f"  {label}: {len(degraded)} venue(s) not ok: {degraded}")


if __name__ == "__main__":
    main()
