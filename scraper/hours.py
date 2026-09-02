"""Hours parser — Google Places `regularOpeningHours` / `currentOpeningHours`
into the `venues.json` hours contract (`PLAN.md`, "Fetch layer and refresh
orchestration" and the hours-ingestion non-negotiables in `CLAUDE.md`).

Two decomposition rules, and they are deliberately different:

  regularOpeningHours (weekday-keyed, recurring): a period is decomposed into
  one entry per touched weekday only when `day_gap = (close.day - open.day)
  mod 7 >= 2`. At day_gap 0 or 1 a single entry suffices, because
  `resolve_hours`'s one-day lookback resolves the adjacent weekday at
  runtime (CLAUDE.md, "The one-day lookback holds by construction").

  currentOpeningHours (date-keyed): a period is decomposed into one
  self-contained entry per touched CALENDAR DATE for every `day_gap >= 1`,
  not just `>= 2`. This is required by two explicit rules that don't apply
  to regular hours: `current_hours_by_date` must be a *complete* schedule
  for every window date, including "a date covered only by a period
  spanning in from an earlier date" (PLAN.md, "resolve_hours"); and an
  arrival date with *current* authority never admits the previous date at
  all ("Deriving the active period", step 2) — so there is no runtime
  lookback to lean on the way regular hours can. The per-day formula is
  the same one CLAUDE.md documents for the day_gap>=2 case ("anchor day
  keeps its real open time, every other touched day gets open: 0, and each
  carries a close equal to the true remaining distance to the real
  close"); for current hours it is simply applied uniformly rather than
  only above the day_gap>=2 threshold.

Writes nothing — callers own every file, per the fetch-layer contract.
"""

from collections import defaultdict
from datetime import date, timedelta

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# Places numbers weekdays 0=Sunday; the contract keys them mon..sun.
PLACES_DAY_TO_KEY = {0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat"}

WINDOW_DAYS = 7  # Google's documented currentOpeningHours horizon: today + 6.

# A truncated close is reported as 23:59 and normalises to the exclusive
# next midnight — "runs through the end of this date", not a real closing
# event. Any other reported clock value at a truncation boundary is
# inconsistent source data and is rejected, never silently coerced.
TRUNCATED_CLOSE_REPORTED_MINUTES = 23 * 60 + 59
NORMALISED_TRUNCATED_CLOSE_MINUTES = 1440


class HoursValidationError(ValueError):
    """The payload violates the hours-ingestion contract.

    Raised rather than guessed through, per CLAUDE.md: "Interior or
    inconsistent truncation fails validation rather than being guessed
    through," and "Inside the window a missing entry is malformed data."
    """


def to_minutes(point):
    return (point or {}).get("hour", 0) * 60 + (point or {}).get("minute", 0)


def _point_date(point):
    raw = (point or {}).get("date")
    if not raw:
        return None
    return date(raw["year"], raw["month"], raw["day"])


def compute_window(request_date):
    """The current-hours window: the request's local date through +6 days.

    Per Google's documented contract: "the next seven days (including
    today) ... starts at midnight on the date of the request and ends at
    11:59 pm six days later." Computed, never inferred from the payload.
    """
    return request_date, request_date + timedelta(days=WINDOW_DAYS - 1)


def _parse_regular_hours(payload):
    """regularOpeningHours -> {weekday: {state, periods}} in contract form."""
    by_day = defaultdict(list)
    for period in (payload or {}).get("periods", []):
        open_point = period.get("open") or {}
        close_point = period.get("close")
        open_day_num = open_point.get("day")
        if open_day_num is None:
            raise HoursValidationError("regularOpeningHours period missing open.day")

        if close_point is None:
            # Google's encoding of "always open, every day": one period,
            # anchored to a single day, with weekdayDescriptions confirming
            # it applies to the whole week (verified against a real 24/7
            # payload — the anchor day carries no other signal of scope).
            for day_key in WEEKDAYS:
                by_day[day_key].append({"open": 0, "always_open": True})
            continue

        close_day_num = close_point.get("day")
        if close_day_num is None:
            raise HoursValidationError("regularOpeningHours period missing close.day")

        open_minutes = to_minutes(open_point)
        close_minutes = to_minutes(close_point)
        day_gap = (close_day_num - open_day_num) % 7

        if day_gap == 0 and close_minutes == open_minutes:
            raise HoursValidationError("zero-duration regular period: close equals open")

        if day_gap <= 1:
            # Untouched: a single entry is sufficient, the one-day lookback
            # resolves the adjacent weekday at runtime.
            entry_close = close_minutes + 1440 * day_gap
            by_day[PLACES_DAY_TO_KEY[open_day_num]].append(
                {"open": open_minutes, "close": entry_close, "always_open": False}
            )
            continue

        # day_gap >= 2: decompose, appended across every touched weekday —
        # never overwriting whatever that weekday already holds.
        real_close_abs = day_gap * 1440 + close_minutes
        for offset in range(day_gap + 1):
            day_key = PLACES_DAY_TO_KEY[(open_day_num + offset) % 7]
            entry_open = open_minutes if offset == 0 else 0
            entry_close = real_close_abs - offset * 1440
            by_day[day_key].append(
                {"open": entry_open, "close": entry_close, "always_open": False}
            )

    return {
        day: {"state": "known" if by_day[day] else "closed", "periods": by_day[day]}
        for day in WEEKDAYS
    }


def _decompose_current_period(period, window_start, window_end):
    """One currentOpeningHours period -> [(date, period_dict), ...].

    Self-contained per calendar date, for every day_gap — see the module
    docstring for why this differs from the regular-hours >= 2 threshold.
    """
    open_point = period.get("open") or {}
    close_point = period.get("close")

    open_date = _point_date(open_point)
    if open_date is None:
        raise HoursValidationError("currentOpeningHours period missing open.date")

    open_truncated = bool(open_point.get("truncated"))
    if open_truncated and (open_date != window_start or to_minutes(open_point) != 0):
        raise HoursValidationError(
            "open.truncated is only valid at the window's first date, 00:00"
        )
    open_minutes = 0 if open_truncated else to_minutes(open_point)

    if close_point is None:
        raise HoursValidationError(
            "currentOpeningHours period has no close — unsupported shape "
            "(a 24/7 window run is represented via both-end truncation, "
            "never a missing close, in every payload this parser has seen)"
        )

    close_date = _point_date(close_point)
    if close_date is None:
        raise HoursValidationError("currentOpeningHours period missing close.date")

    close_truncated = bool(close_point.get("truncated"))
    if close_truncated:
        if close_date != window_end or to_minutes(close_point) != TRUNCATED_CLOSE_REPORTED_MINUTES:
            raise HoursValidationError(
                "close.truncated is only valid at the window's final date boundary, 23:59"
            )
        close_minutes = NORMALISED_TRUNCATED_CLOSE_MINUTES
    else:
        close_minutes = to_minutes(close_point)

    if not (window_start <= open_date <= window_end):
        raise HoursValidationError("period open date falls outside the current-hours window")
    if not (window_start <= close_date <= window_end):
        raise HoursValidationError("period close date falls outside the current-hours window")
    if close_date < open_date:
        raise HoursValidationError("period close date precedes its open date")

    span_days = (close_date - open_date).days
    if span_days == 0 and not close_truncated and close_minutes == open_minutes:
        raise HoursValidationError("zero-duration period: close equals open")

    real_close_abs = span_days * 1440 + close_minutes

    entries = []
    for offset in range(span_days + 1):
        entry_open = open_minutes if offset == 0 else 0
        entry_close = real_close_abs - offset * 1440
        if entry_close == entry_open:
            # A close landing exactly at this date's midnight (entry_close == 0,
            # since entry_open is 0 on every non-anchor day) reaches this date
            # without touching it: the half-open [open, close) interval is
            # empty here. Emitting it would fabricate a zero-length period
            # (BL-001 / GAP 2) instead of correctly contributing nothing.
            # Deliberately exact equality, not <=: an entry_close < entry_open
            # is a different, out-of-scope malformed shape (close before open
            # on the anchor day) and must fall through unchanged, not be
            # silently swallowed here.
            continue
        this_date = open_date + timedelta(days=offset)
        entry = {"open": entry_open, "close": entry_close, "always_open": False}
        if close_truncated:
            # Propagates to every entry of the chain, not just the last —
            # each one is a window artifact, not a real closing event.
            entry["continues_beyond_window"] = True
        entries.append((this_date, entry))
    return entries


def _parse_current_hours(payload, window_start, window_end):
    """currentOpeningHours -> ({date: [periods]}, {closed dates})."""
    by_date = defaultdict(list)
    for period in (payload or {}).get("periods", []):
        for this_date, entry in _decompose_current_period(period, window_start, window_end):
            by_date[this_date].append(entry)

    closed_dates = set()
    for special in (payload or {}).get("specialDays", []):
        if not special.get("closed"):
            continue
        special_date = _point_date({"date": special["date"]}) if special.get("date") else None
        if special_date is not None:
            closed_dates.add(special_date)

    return dict(by_date), closed_dates


def _materialize_current_hours_by_date(periods_by_date, closed_dates, window_start, window_end):
    """Every window date, explicitly `known` or `closed` — never sparse.

    A window date with neither a period nor an explicit closure is
    malformed data (CLAUDE.md), surfaced as such rather than silently
    falling back to the regular schedule.
    """
    by_date = {}
    current = window_start
    while current <= window_end:
        iso = current.isoformat()
        if current in periods_by_date:
            by_date[iso] = {"state": "known", "periods": periods_by_date[current]}
        elif current in closed_dates:
            by_date[iso] = {"state": "closed", "periods": []}
        else:
            raise HoursValidationError(
                f"{iso} has no current-hours entry inside the window — malformed data"
            )
        current += timedelta(days=1)
    return by_date


def parse_hours(payload, request_date):
    """Full Place Details payload -> the venues.json hours contract.

    `request_date` is the local (Asia/Singapore) calendar date the fetch is
    made against — the window is computed from it, never inferred from the
    payload.
    """
    window_start, window_end = compute_window(request_date)
    regular_hours = _parse_regular_hours(payload.get("regularOpeningHours"))
    periods_by_date, closed_dates = _parse_current_hours(
        payload.get("currentOpeningHours"), window_start, window_end
    )
    current_hours_by_date = _materialize_current_hours_by_date(
        periods_by_date, closed_dates, window_start, window_end
    )
    return {
        "current_hours_valid_from": window_start.isoformat(),
        "current_hours_valid_through": window_end.isoformat(),
        "regular_hours": regular_hours,
        "current_hours_by_date": current_hours_by_date,
    }
