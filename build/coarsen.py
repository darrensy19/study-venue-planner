"""The coarsening stage — Phase 1 step 5 (`PLAN.md`, "The coarsening stage").

Reads a private, gitignored raw seat-log CSV and appends coarsened rows to
the committed `data/seatlog.csv`. It never rewrites the raw input. This is
the only step that can capture busyness in effect at visit time, which is
why `build/refresh.py` (not yet built) must run it before either fetcher.

Orchestrated only by `build/refresh.py`; independently testable against
fixtures, and touches no network.
"""

import csv
import io
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from scraper.fetchers import SINGAPORE_TZ

RAW_HEADER = ("occurred_at", "venue_id", "outcome")
COMMITTED_HEADER = (
    "venue_id",
    "day_of_week",
    "hour",
    "outcome",
    "histogram_busyness",
    "histogram_fetched_at",
)
VALID_OUTCOMES = ("seat", "no_seat")
WEEKDAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


class CoarsenError(Exception):
    """The coarsening stage's contract was violated: a malformed raw or
    committed row, an unmirrored or shortened raw prefix, an ambiguous set
    of raw-log candidates, or an unusable deployed histogram for a row that
    needs one. Never partially applied — no file is written when this is
    raised.
    """


@dataclass(frozen=True)
class RawRow:
    """One validated raw-log row. `occurred_at` is the parsed, offset-aware
    timestamp exactly as recorded; `day_of_week`/`hour` are derived in
    `Asia/Singapore` once, since every consumer (the prefix projection and
    the suffix stamp) needs the same derived values.
    """

    occurred_at: datetime
    venue_id: str
    outcome: str
    day_of_week: str
    hour: int

    def project(self):
        return (self.venue_id, self.day_of_week, self.hour, self.outcome)


@dataclass(frozen=True)
class CommittedRow:
    """One validated committed row. `fields` holds the exact six original
    string values, never reparsed into another representation, so an
    untouched row round-trips byte-identical through a read/write cycle —
    load-bearing for every Group 1 "complete output is asserted
    byte-identical" fixture.
    """

    fields: tuple

    @property
    def venue_id(self):
        return self.fields[0]

    @property
    def day_of_week(self):
        return self.fields[1]

    @property
    def hour(self):
        return int(self.fields[2])

    @property
    def outcome(self):
        return self.fields[3]

    def project(self):
        return (self.venue_id, self.day_of_week, self.hour, self.outcome)


def find_raw_log(data_dir: Path):
    """Exactly two locations are ever considered (`PLAN.md`, "Candidate
    selection"): `data/seatlog.raw.csv` if it is a regular file, and regular
    `*.csv` files directly inside `data/raw/`, non-recursive. Zero
    candidates is a clean no-op (`None`); two or more is a hard failure,
    before any other work — an empty `data/raw/` is zero candidates, not an
    error, and nothing outside these two locations is ever considered.
    """
    candidates = []

    single = data_dir / "seatlog.raw.csv"
    if single.is_file():
        candidates.append(single)

    raw_dir = data_dir / "raw"
    if raw_dir.is_dir():
        for entry in sorted(raw_dir.iterdir()):
            if entry.is_file() and entry.suffix == ".csv":
                candidates.append(entry)

    if len(candidates) == 0:
        return None
    if len(candidates) > 1:
        names = ", ".join(str(c) for c in candidates)
        raise CoarsenError(
            f"{len(candidates)} raw-log candidates found ({names}) — "
            f"refusing to guess which is current"
        )
    return candidates[0]


def _parse_occurred_at(value, line_no):
    try:
        parsed = datetime.fromisoformat(value)
    except (ValueError, TypeError):
        raise CoarsenError(f"raw row {line_no}: unparseable occurred_at {value!r}")
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise CoarsenError(
            f"raw row {line_no}: occurred_at {value!r} has no UTC offset — "
            f"a naive timestamp is never assumed local"
        )
    return parsed


def parse_raw_rows(path: Path, known_venue_ids):
    """Fully validates the whole raw file — any malformed row aborts the
    whole attempt, never a partial or skipped-row result (`PLAN.md`: "a
    silently dropped visit is a hole in the Phase 3 dataset that nothing
    later can detect"). Schema only — chronology is a suffix-scoped check,
    see `_validate_suffix_chronological`, since the prefix's original
    ordering is exactly what `PLAN.md`'s own Group 1 reorder instances (a
    raw-side reorder wholly inside the processed prefix, or a coordinated
    reorder mirrored onto the committed side) legitimately no longer
    reflects — the prefix is checked for *consistency* with the committed
    record, never re-validated against a production order nothing on disk
    still attests to.
    """
    rows = []
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        try:
            header = next(reader)
        except StopIteration:
            raise CoarsenError(f"{path}: empty file, header row required")
        if tuple(header) != RAW_HEADER:
            raise CoarsenError(f"{path}: header {header!r} does not match {RAW_HEADER!r}")

        for line_no, raw in enumerate(reader, start=2):
            if len(raw) != len(RAW_HEADER):
                raise CoarsenError(f"raw row {line_no}: expected {len(RAW_HEADER)} columns, got {len(raw)}")
            occurred_at_s, venue_id, outcome = raw

            occurred_at = _parse_occurred_at(occurred_at_s, line_no)

            if venue_id not in known_venue_ids:
                raise CoarsenError(f"raw row {line_no}: unknown venue_id {venue_id!r}")

            if outcome not in VALID_OUTCOMES:
                raise CoarsenError(f"raw row {line_no}: outcome must be 'seat' or 'no_seat', got {outcome!r}")

            local = occurred_at.astimezone(SINGAPORE_TZ)
            day_of_week = WEEKDAY_KEYS[local.weekday()]
            hour = local.hour

            rows.append(RawRow(occurred_at, venue_id, outcome, day_of_week, hour))

    return rows


def _validate_suffix_chronological(suffix_raw_rows):
    """`PLAN.md`, "The private raw schema": "Rows are append-only and
    chronological." Enforced only over the **suffix** — the rows this run
    is actually about to coarsen for the first time, which is exactly what
    a fresh, unedited append from the phone looks like. The already-
    committed prefix is deliberately never re-checked here: `seatlog.csv`
    drops `occurred_at` entirely, so there is no surviving timestamp to
    compare a prefix row against, and `PLAN.md`'s own Group 1 taxonomy
    (a raw-side reorder wholly inside the prefix, or a coordinated reorder
    mirrored onto the committed side) explicitly treats a reordered prefix
    as legitimate, checked for projection consistency, not chronology.

    Compares the **absolute instant** (`occurred_at` compared directly,
    never the derived `Asia/Singapore` local reading, since two rows can
    read the same local hour while genuinely differing in absolute instant
    once arbitrary UTC offsets are involved — "the file is written by a
    phone that can be anywhere"). Equal to its predecessor is accepted: two
    entries can genuinely share an instant (a rapid double-tap); only a row
    strictly **earlier than** its predecessor violates append-only
    chronology.
    """
    previous = None
    for offset, row in enumerate(suffix_raw_rows):
        if previous is not None and row.occurred_at < previous.occurred_at:
            raise CoarsenError(
                f"suffix row {offset}: occurred_at {row.occurred_at.isoformat()!r} is earlier "
                f"than the preceding row's {previous.occurred_at.isoformat()!r} — the raw log "
                f"must be chronological (PLAN.md, \"The private raw schema\")"
            )
        previous = row


def _validate_committed_fields(fields, line_no, path):
    if len(fields) != len(COMMITTED_HEADER):
        raise CoarsenError(f"{path} row {line_no}: expected {len(COMMITTED_HEADER)} columns, got {len(fields)}")
    venue_id, day_of_week, hour_s, outcome, busyness_s, fetched_at_s = fields

    if not venue_id:
        raise CoarsenError(f"{path} row {line_no}: venue_id must not be empty")

    if day_of_week not in WEEKDAY_KEYS:
        raise CoarsenError(f"{path} row {line_no}: day_of_week {day_of_week!r} is not one of {WEEKDAY_KEYS}")

    try:
        hour = int(hour_s)
    except ValueError:
        raise CoarsenError(f"{path} row {line_no}: hour {hour_s!r} is not an integer")
    if not (0 <= hour <= 23):
        raise CoarsenError(f"{path} row {line_no}: hour {hour} out of range 0-23")

    if outcome not in VALID_OUTCOMES:
        raise CoarsenError(f"{path} row {line_no}: outcome must be 'seat' or 'no_seat', got {outcome!r}")

    try:
        int(busyness_s)
    except ValueError:
        raise CoarsenError(f"{path} row {line_no}: histogram_busyness {busyness_s!r} is not an integer")

    fetched_at = _parse_occurred_at(fetched_at_s, line_no)
    del fetched_at  # validated for shape only; the original string is preserved verbatim


def parse_committed_rows(path: Path):
    """Fully validates the whole committed file. Absent file -> `[]`, the
    same "0 if the file is absent" convention `processed_count` uses.
    """
    if not path.exists():
        return []

    rows = []
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        try:
            header = next(reader)
        except StopIteration:
            raise CoarsenError(f"{path}: empty file, header row required")
        if tuple(header) != COMMITTED_HEADER:
            raise CoarsenError(f"{path}: header {header!r} does not match {COMMITTED_HEADER!r}")

        for line_no, fields in enumerate(reader, start=2):
            _validate_committed_fields(fields, line_no, path)
            rows.append(CommittedRow(tuple(fields)))

    return rows


def _histogram_busyness_for(deployed_venues, venue_id, day_of_week, hour):
    """The currently-deployed histogram value for one (venue, day, hour), or
    `None` when that venue's histogram cannot supply one — absent from
    `deployed_venues`, no `histogram` block, `status == "failed"` (no data
    at all, per `PLAN.md`'s status table), or no entry for that exact hour.
    `None` here is always a fail-the-whole-run condition at the call site,
    never a stamp of its own — this function makes no `seat`/`no_seat`-style
    "acceptable absence" judgement, unlike a hard-filtered ranking input.
    """
    venue = deployed_venues.get(venue_id)
    if venue is None:
        return None
    histogram = venue.get("histogram")
    if not histogram or histogram.get("status") == "failed":
        return None
    fetched_at = histogram.get("last_success_at")
    if not fetched_at:
        return None
    day_entries = (histogram.get("days") or {}).get(day_of_week) or []
    for entry in day_entries:
        if entry.get("hour") == hour:
            busyness = entry.get("busyness")
            if busyness is None:
                return None
            return busyness, fetched_at
    return None


def _load_deployed_venues(venues_json_path: Path):
    import json

    if not venues_json_path.exists():
        return None
    with open(venues_json_path, encoding="utf-8") as handle:
        data = json.load(handle)
    return {v["id"]: v for v in data.get("venues", [])}


def _write_committed_atomic(committed_path: Path, rows):
    tmp_path = committed_path.parent / f".{committed_path.name}.tmp-{os.getpid()}"
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(COMMITTED_HEADER)
    for row in rows:
        writer.writerow(row.fields)
    tmp_path.write_text(buffer.getvalue(), newline="", encoding="utf-8")

    # Validate the temp file against the committed schema before the swap —
    # a safety net against this function's own writer producing something
    # that would fail to round-trip, never expected to fire in practice.
    parse_committed_rows(tmp_path)

    os.replace(tmp_path, committed_path)


def coarsen(data_dir: Path, venues_json_path: Path, known_venue_ids):
    """Run the whole coarsening stage once. `None` on a clean no-op (zero
    raw-log candidates); raises `CoarsenError` on any contract violation,
    with `data/seatlog.csv` left completely untouched. On success, returns
    the number of rows appended (0 is possible: a raw log whose every row
    is already reflected in the committed file).
    """
    raw_path = find_raw_log(data_dir)
    if raw_path is None:
        return None

    committed_path = data_dir / "seatlog.csv"

    raw_rows = parse_raw_rows(raw_path, known_venue_ids)
    committed_rows = parse_committed_rows(committed_path)
    processed_count = len(committed_rows)

    if len(raw_rows) < processed_count:
        raise CoarsenError(
            f"raw log has {len(raw_rows)} rows, fewer than the "
            f"{processed_count} already committed — it was truncated or replaced"
        )

    for index, (committed_row, raw_row) in enumerate(zip(committed_rows, raw_rows[:processed_count])):
        if committed_row.project() != raw_row.project():
            raise CoarsenError(
                f"raw/committed prefix disagree at position {index}: "
                f"committed {committed_row.project()!r} != raw {raw_row.project()!r}"
            )

    suffix_raw_rows = raw_rows[processed_count:]
    if len(suffix_raw_rows) == 0:
        return 0

    _validate_suffix_chronological(suffix_raw_rows)

    deployed_venues = _load_deployed_venues(venues_json_path)
    if deployed_venues is None:
        raise CoarsenError(
            f"{len(suffix_raw_rows)} unprocessed raw row(s), but no deployed "
            f"{venues_json_path} to stamp them against — coarsening runs "
            f"before the fetch, so the first-ever refresh has nothing to join"
        )

    new_rows = []
    for raw_row in suffix_raw_rows:
        found = _histogram_busyness_for(deployed_venues, raw_row.venue_id, raw_row.day_of_week, raw_row.hour)
        if found is None:
            raise CoarsenError(
                f"venue {raw_row.venue_id!r} has no usable deployed histogram "
                f"for {raw_row.day_of_week} hour {raw_row.hour} — refusing to "
                f"coarsen with an empty stamp"
            )
        busyness, fetched_at = found
        new_rows.append(
            CommittedRow(
                (
                    raw_row.venue_id,
                    raw_row.day_of_week,
                    str(raw_row.hour),
                    raw_row.outcome,
                    str(busyness),
                    fetched_at,
                )
            )
        )

    _write_committed_atomic(committed_path, committed_rows + new_rows)
    return len(new_rows)
