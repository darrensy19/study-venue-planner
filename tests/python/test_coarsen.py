"""build/coarsen.py — Phase 1 step 5, the coarsening stage (`PLAN.md`, "The
coarsening stage"). Fixture-based; no network, no real raw seat-log data.

Test naming below tracks `PLAN.md`'s own "Negative-path fixture obligations"
list so each PLAN.md bullet is traceable to one test here.
"""

import csv
import json
from datetime import datetime, timedelta, timezone

import pytest

from build.coarsen import CoarsenError, WEEKDAY_KEYS, coarsen, find_raw_log

KNOWN_VENUE_IDS = {"v1", "v2", "v3"}

RAW_HEADER = ("occurred_at", "venue_id", "outcome")
COMMITTED_HEADER = (
    "venue_id",
    "day_of_week",
    "hour",
    "outcome",
    "histogram_busyness",
    "histogram_fetched_at",
)

# A fixed Monday 09:00 +08:00 anchor, so every offset below has a known,
# independently-verifiable (venue_id, day_of_week, hour) projection.
ANCHOR = datetime(2026, 8, 24, 9, 0, 0, tzinfo=timezone(timedelta(hours=8)))
assert ANCHOR.weekday() == 0  # Monday, so WEEKDAY_KEYS[0] == "mon" applies


def occurred_at(offset_hours=0, offset_minutes=0):
    dt = ANCHOR + timedelta(hours=offset_hours, minutes=offset_minutes)
    return dt.isoformat()


def projection_of(offset_hours=0, offset_minutes=0):
    dt = ANCHOR + timedelta(hours=offset_hours, minutes=offset_minutes)
    return WEEKDAY_KEYS[dt.weekday()], dt.hour


def write_raw(tmp_path, rows, path=None):
    """rows: list of (occurred_at_str, venue_id, outcome)."""
    target = path or (tmp_path / "seatlog.raw.csv")
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(RAW_HEADER)
        for row in rows:
            writer.writerow(row)
    return target


def write_committed(tmp_path, rows):
    """rows: list of (venue_id, day_of_week, hour, outcome, busyness, fetched_at)."""
    target = tmp_path / "seatlog.csv"
    with open(target, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(COMMITTED_HEADER)
        for row in rows:
            writer.writerow(row)
    return target


def write_venues_json(tmp_path, venues):
    """venues: {venue_id: {day_of_week: [{"hour": h, "busyness": b}], "status": s,
    "last_success_at": ts}}. Builds the minimal `data/venues.json` shape coarsen.py
    reads (`PLAN.md`, "data/venues.json")."""
    payload = {"venues": []}
    for venue_id, spec in venues.items():
        status = spec.get("status", "ok")
        entry = {
            "id": venue_id,
            "histogram": {
                "source": "serpapi",
                "status": status,
                "last_success_at": spec.get("last_success_at", "2026-08-01T10:00:00+08:00"),
                "days": {day: hours for day, hours in spec.items() if day in WEEKDAY_KEYS},
            },
        }
        payload["venues"].append(entry)
    path = tmp_path / "venues.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def read_committed_rows(path):
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        assert tuple(header) == COMMITTED_HEADER
        return [tuple(row) for row in reader]


def default_venues_json(tmp_path, venue_id="v1", day="mon", hour=None, busyness=42, fetched_at="2026-08-20T10:00:00+08:00"):
    day, resolved_hour = projection_of() if hour is None else (day, hour)
    return write_venues_json(
        tmp_path,
        {venue_id: {day: [{"hour": resolved_hour, "busyness": busyness}], "last_success_at": fetched_at}},
    )


# --- candidate selection -----------------------------------------------------


def test_zero_candidates_is_a_clean_no_op(tmp_path):
    venues_json = default_venues_json(tmp_path)
    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)
    assert result is None
    assert not (tmp_path / "seatlog.csv").exists()


def test_one_candidate_at_seatlog_raw_csv_is_used(tmp_path):
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 1
    assert len(read_committed_rows(tmp_path / "seatlog.csv")) == 1


def test_one_candidate_inside_data_raw_is_used(tmp_path):
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")], path=tmp_path / "raw" / "phone-export.csv")
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 1


def test_empty_data_raw_directory_is_zero_candidates_not_an_error(tmp_path):
    (tmp_path / "raw").mkdir()
    venues_json = default_venues_json(tmp_path)
    assert coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS) is None


def test_two_or_more_candidates_fails_before_any_write(tmp_path):
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")], path=tmp_path / "raw" / "a.csv")
    venues_json = default_venues_json(tmp_path)

    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)
    assert not (tmp_path / "seatlog.csv").exists()


def test_find_raw_log_ignores_non_csv_files_in_data_raw(tmp_path):
    (tmp_path / "raw").mkdir()
    (tmp_path / "raw" / "notes.txt").write_text("not a candidate")
    assert find_raw_log(tmp_path) is None


# --- malformed raw rows abort the whole attempt ------------------------------


def test_malformed_raw_timestamp_aborts_whole_attempt(tmp_path):
    write_raw(tmp_path, [(occurred_at(), "v1", "seat"), ("not-a-timestamp", "v1", "seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)
    assert not (tmp_path / "seatlog.csv").exists()


def test_naive_raw_timestamp_is_malformed_never_assumed_local(tmp_path):
    write_raw(tmp_path, [("2026-08-24T09:00:00", "v1", "seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_unknown_venue_id_aborts_whole_attempt(tmp_path):
    write_raw(tmp_path, [(occurred_at(), "not-a-real-venue", "seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_unknown_outcome_aborts_whole_attempt(tmp_path):
    write_raw(tmp_path, [(occurred_at(), "v1", "SEAT")])  # case folding rejected too
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


# --- raw log shorter than committed ------------------------------------------


def test_raw_log_shorter_than_committed_fails(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00"),
                                ("v1", day, hour, "no_seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])  # only 1 raw row, 2 already committed
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)
    # no partial output
    assert read_committed_rows(tmp_path / "seatlog.csv") == [
        ("v1", day, str(hour), "seat", "10", "2026-08-01T10:00:00+08:00"),
        ("v1", day, str(hour), "no_seat", "10", "2026-08-01T10:00:00+08:00"),
    ]


# --- unmirrored prefix changes fail ------------------------------------------


def test_unmirrored_raw_side_change_across_hour_boundary_fails(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(offset_hours=1), "v1", "seat")])  # shifted to a different hour
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_unmirrored_raw_side_change_across_weekday_boundary_fails(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(offset_hours=24), "v1", "seat")])  # next day
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_unmirrored_raw_side_venue_id_edit_fails(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(), "v2", "seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_unmirrored_raw_side_outcome_edit_fails(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(), "v1", "no_seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_unmirrored_committed_side_edit_fails(tmp_path):
    """The mirror case: committed row's projected field edited, raw untouched."""
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "no_seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


# --- coordinated edits pass, with the specific asserted consequence ---------


def test_coordinated_projected_field_edit_passes_with_rewritten_value(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "no_seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(), "v1", "no_seat")])  # both sides agree on the (edited) value
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 0
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    assert rows == [("v1", day, str(hour), "no_seat", "10", "2026-08-01T10:00:00+08:00")]


def test_raw_side_mutation_preserving_projection_passes_byte_identical(tmp_path):
    day, hour = projection_of()
    committed = write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    before = committed.read_bytes()
    # occurred_at moved by 10 minutes, staying inside the same SG weekday and hour
    write_raw(tmp_path, [(occurred_at(offset_minutes=10), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 0
    assert committed.read_bytes() == before


def test_mutated_committed_histogram_stamp_passes_and_retains_mutation(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 99, "2026-01-01T00:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 0
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    assert rows == [("v1", day, str(hour), "seat", "99", "2026-01-01T00:00:00+08:00")]


def test_reorder_of_two_prefix_rows_with_differing_projections_fails(tmp_path):
    d1, h1 = projection_of()
    d2, h2 = projection_of(offset_hours=1)
    write_committed(tmp_path, [
        ("v1", d1, h1, "seat", 10, "2026-08-01T10:00:00+08:00"),
        ("v2", d2, h2, "no_seat", 20, "2026-08-01T10:00:00+08:00"),
    ])
    write_raw(tmp_path, [
        (occurred_at(offset_hours=1), "v2", "no_seat"),
        (occurred_at(), "v1", "seat"),
    ])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_coordinated_structural_deletion_passes_with_one_fewer_row(tmp_path):
    """A row of this projection was removed from BOTH the raw prefix and the
    committed prefix by whoever edited them (a "before" state that once had
    2 rows of this projection is never seen by coarsen() at all — it only
    ever reads the already-edited files on disk, which is exactly why the
    deletion is invisible to it: processed_count and raw_row_count shrank
    together, so `raw_row_count >= processed_count` never fires)."""
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 0
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    assert len(rows) == 1  # one fewer row of that projection than the pre-edit 2


def test_coordinated_structural_insertion_passes_with_fabricated_visit(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [
        (occurred_at(), "v1", "seat"),
        (occurred_at(), "v1", "seat"),  # matching row added to both sides
    ])
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 1
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    assert len(rows) == 2


def test_coordinated_reorder_of_differing_projections_passes_with_rewritten_order(tmp_path):
    d1, h1 = projection_of()
    d2, h2 = projection_of(offset_hours=1)
    write_committed(tmp_path, [
        ("v2", d2, h2, "no_seat", 20, "2026-08-01T10:00:00+08:00"),
        ("v1", d1, h1, "seat", 10, "2026-08-01T10:00:00+08:00"),
    ])
    write_raw(tmp_path, [
        (occurred_at(offset_hours=1), "v2", "no_seat"),
        (occurred_at(), "v1", "seat"),
    ])
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 0
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    assert [r[0] for r in rows] == ["v2", "v1"]


# --- Group 1: raw-only reorder/substitution, wholly inside the raw prefix --


def test_reorder_among_equal_projection_rows_wholly_in_raw_prefix_passes_byte_identical(tmp_path):
    day, hour = projection_of()
    committed = write_committed(tmp_path, [
        ("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00"),
        ("v1", day, hour, "no_seat", 10, "2026-08-01T10:00:00+08:00"),
    ])
    before = committed.read_bytes()
    # raw rows reordered relative to whatever originally produced this committed
    # prefix, but both share the same (venue_id, day, hour); pick outcomes to
    # match position-for-position with the committed prefix as-is, since the
    # comparator reads position by position, not by matching-and-reordering.
    write_raw(tmp_path, [
        (occurred_at(offset_minutes=5), "v1", "seat"),
        (occurred_at(offset_minutes=1), "v1", "no_seat"),
    ])
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 0
    assert committed.read_bytes() == before


def test_substitution_of_one_raw_prefix_row_for_equal_projection_passes_byte_identical(tmp_path):
    day, hour = projection_of()
    committed = write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    before = committed.read_bytes()
    # a different raw row of equal projection substituted in (different minute, same hour/outcome)
    write_raw(tmp_path, [(occurred_at(offset_minutes=45), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 0
    assert committed.read_bytes() == before


def test_committed_side_reorder_of_equal_projection_but_different_stamps_relocates_stamps(tmp_path):
    """The committed-side analogue of the two Group 1 cases above is Group 2,
    not Group 1 — two committed rows can share a projection and still differ
    in their histogram stamps. Covers both the "reorder" and "substitution"
    phrasing of PLAN.md's paired bullet: `seatlog.csv` retains no
    `occurred_at`, so a committed-side reorder of two equal-projection rows
    and a substitution of one for another of equal projection are the same
    bytes and the same comparator outcome — there is no fixture that could
    tell them apart (gate finding, IMP-011 pre-gate invocation 1)."""
    day, hour = projection_of()
    write_committed(tmp_path, [
        ("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00"),
        ("v1", day, hour, "seat", 20, "2026-08-02T10:00:00+08:00"),
    ])
    write_raw(tmp_path, [
        (occurred_at(offset_minutes=1), "v1", "seat"),
        (occurred_at(offset_minutes=2), "v1", "seat"),
    ])
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 0
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    assert rows == [
        ("v1", day, str(hour), "seat", "10", "2026-08-01T10:00:00+08:00"),
        ("v1", day, str(hour), "seat", "20", "2026-08-02T10:00:00+08:00"),
    ]


# --- insertion/deletion boundary conditions ----------------------------------


def test_insertion_within_processed_region_reaching_boundary_passes_and_gains_one_row(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    # raw has TWO equal-projection rows; the run "reaches" the last committed
    # position (position 0), so the comparator only ever sees the first one.
    write_raw(tmp_path, [
        (occurred_at(offset_minutes=1), "v1", "seat"),
        (occurred_at(offset_minutes=2), "v1", "seat"),
    ])
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 1
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    assert len(rows) == 2
    # the added row carries THIS run's stamp
    assert rows[1][4] == "42"  # default_venues_json's busyness


def test_paired_position_insertion_just_after_boundary_is_output_identical(tmp_path):
    """Same equal-projection row inserted just after the boundary instead of
    within it — the committed record cannot tell the two mechanisms apart."""
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [
        (occurred_at(offset_minutes=1), "v1", "seat"),  # the single already-processed row
        (occurred_at(offset_minutes=2), "v1", "seat"),  # the new one, just after the boundary
    ])
    venues_json = default_venues_json(tmp_path)

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 1
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    assert len(rows) == 2
    assert rows[1][4] == "42"


def test_insertion_into_a_run_that_does_not_reach_the_boundary_fails(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [
        ("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00"),
        ("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00"),
    ])
    # only ONE raw row of that projection — the run never reaches the second
    # committed position, so the comparator sees a real projection mismatch
    # (raw has only 1 row where 2 were committed).
    write_raw(tmp_path, [(occurred_at(offset_minutes=1), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_deletion_inside_run_extending_one_past_boundary_passes_and_loses_one_row(tmp_path):
    day, hour = projection_of()
    other_day, other_hour = projection_of(offset_hours=1)
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    # raw: two equal-projection rows (run extends one past the committed
    # position) with one deleted, PLUS an appended row of a DIFFERENT
    # projection so the raw count matches what it would have been.
    write_raw(tmp_path, [
        (occurred_at(offset_minutes=1), "v1", "seat"),
        (occurred_at(offset_hours=1), "v2", "no_seat"),  # different projection, load-bearing
    ])
    venues_json = write_venues_json(tmp_path, {
        "v2": {other_day: [{"hour": other_hour, "busyness": 55}], "last_success_at": "2026-08-20T10:00:00+08:00"},
    })

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 1
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    v1_rows = [r for r in rows if r[0] == "v1"]
    assert len(v1_rows) == 1  # lost one row of that projection from the suffix


def test_deletion_inside_run_reaching_only_the_last_committed_position_fails(tmp_path):
    """Deliberately not the same condition as the insertion-boundary test
    above (`PLAN.md`): a deletion needs the equal-projection run to have
    extended one position PAST the last committed row to stay invisible (see
    the passing case above). Here the run reaches only the last committed
    position — 2 committed P rows, and the raw run of P had exactly 2
    members before one was deleted, leaving 1 P plus the next distinct visit
    (Q) pulled into the second compared position. `raw_row_count` (2) still
    equals `processed_count` (2), so this fails via the projection
    comparison at position 1, never the shorter-raw-log length check."""
    day, hour = projection_of()
    other_day, other_hour = projection_of(offset_hours=5)
    write_committed(tmp_path, [
        ("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00"),
        ("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00"),
    ])
    write_raw(tmp_path, [
        (occurred_at(offset_minutes=1), "v1", "seat"),        # position 0: still matches
        (occurred_at(offset_hours=5), "v2", "no_seat"),       # position 1: Q pulled in, not P
    ])
    venues_json = write_venues_json(tmp_path, {
        "v2": {other_day: [{"hour": other_hour, "busyness": 60}], "last_success_at": "2026-08-20T10:00:00+08:00"},
    })
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_insertion_or_deletion_shifting_a_differing_projection_fails(tmp_path):
    """Gate finding (IMP-011 pre-gate, invocation 1): this fixture's raw
    suffix references "v2", but an earlier version supplied a histogram for
    "v1" only — with the prefix-comparison check disabled, the run still
    raised, just via the unrelated missing-histogram guard, not the
    differing-projection mismatch this case is meant to isolate. Both
    venues now have a usable histogram so the *only* way this run can fail
    is the mechanism actually under test."""
    d1, h1 = projection_of()
    d2, h2 = projection_of(offset_hours=2)
    write_committed(tmp_path, [
        ("v1", d1, h1, "seat", 10, "2026-08-01T10:00:00+08:00"),
        ("v2", d2, h2, "no_seat", 20, "2026-08-01T10:00:00+08:00"),
    ])
    # an extra v1 row inserted before the v2 row shifts it out of alignment
    write_raw(tmp_path, [
        (occurred_at(), "v1", "seat"),
        (occurred_at(offset_minutes=1), "v1", "seat"),
        (occurred_at(offset_hours=2), "v2", "no_seat"),
    ])
    venues_json = write_venues_json(tmp_path, {
        "v1": {d1: [{"hour": h1, "busyness": 10}], "last_success_at": "2026-08-20T10:00:00+08:00"},
        "v2": {d2: [{"hour": h2, "busyness": 20}], "last_success_at": "2026-08-20T10:00:00+08:00"},
    })
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


# --- suffix handling ----------------------------------------------------------


def test_valid_suffix_append_appends_exactly_new_rows_prefix_unchanged(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    day2, hour2 = projection_of(offset_hours=3)
    write_raw(tmp_path, [
        (occurred_at(), "v1", "seat"),
        (occurred_at(offset_hours=3), "v2", "no_seat"),
    ])
    venues_json = write_venues_json(tmp_path, {
        "v1": {day: [{"hour": hour, "busyness": 42}], "last_success_at": "2026-08-20T10:00:00+08:00"},
        "v2": {day2: [{"hour": hour2, "busyness": 77}], "last_success_at": "2026-08-21T10:00:00+08:00"},
    })

    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)

    assert result == 1
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    assert rows[0] == ("v1", day, str(hour), "seat", "10", "2026-08-01T10:00:00+08:00")
    assert rows[1] == ("v2", day2, str(hour2), "no_seat", "77", "2026-08-21T10:00:00+08:00")


def test_unprocessed_rows_with_no_deployed_venues_json_fails_before_fetching(tmp_path):
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    missing_venues_json = tmp_path / "venues.json"  # never written
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, missing_venues_json, KNOWN_VENUE_IDS)
    assert not (tmp_path / "seatlog.csv").exists()


def test_no_deployed_venues_json_is_fine_when_nothing_is_unprocessed(tmp_path):
    day, hour = projection_of()
    write_committed(tmp_path, [("v1", day, hour, "seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])  # fully mirrored, no suffix
    missing_venues_json = tmp_path / "venues.json"
    result = coarsen(tmp_path, missing_venues_json, KNOWN_VENUE_IDS)
    assert result == 0


def test_venue_with_no_histogram_entry_for_the_exact_hour_fails_before_any_write(tmp_path):
    """Not literally enumerated in PLAN.md's list, but required by 'it does not
    coarsen with an empty stamp': a deployed histogram that simply has no
    coverage for the visited hour is exactly as unusable as no histogram at
    all for that row."""
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = write_venues_json(tmp_path, {
        "v1": {"mon": [{"hour": 23, "busyness": 5}], "last_success_at": "2026-08-20T10:00:00+08:00"},
    })
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)
    assert not (tmp_path / "seatlog.csv").exists()


def test_venue_histogram_status_failed_is_unusable(tmp_path):
    """A real 'failed' record has no last_success_at at all, by the status
    table's own definition — but this fixture keeps one anyway (alongside
    valid day/hour data) specifically to isolate the status=="failed" check
    itself, rather than relying on the separate absent-last_success_at guard
    to catch it by coincidence (gate finding, IMP-011 pre-gate invocation 1,
    on the sibling "no histogram entry" test)."""
    day, hour = projection_of()
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = write_venues_json(tmp_path, {
        "v1": {
            day: [{"hour": hour, "busyness": 5}],
            "status": "failed",
            "last_success_at": "2026-08-20T10:00:00+08:00",
        },
    })
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_venue_histogram_status_stale_is_still_usable(tmp_path):
    """stale = last-known-good, which is real, usable data — only `failed`
    (no data at all) is unusable."""
    day, hour = projection_of()
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = write_venues_json(tmp_path, {
        "v1": {day: [{"hour": hour, "busyness": 33}], "status": "stale", "last_success_at": "2026-07-01T10:00:00+08:00"},
    })
    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)
    assert result == 1
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    assert rows[0][4:] == ("33", "2026-07-01T10:00:00+08:00")


def test_new_row_stamped_with_the_deployed_pre_fetch_histogram_value(tmp_path):
    """Proves the join reads the *currently deployed* histogram, never a
    later or hypothetical one — coarsen() has no fetcher call to even
    confuse this with."""
    day, hour = projection_of()
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = write_venues_json(tmp_path, {
        "v1": {day: [{"hour": hour, "busyness": 88}], "last_success_at": "2026-08-15T10:00:00+08:00"},
    })
    coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)
    rows = read_committed_rows(tmp_path / "seatlog.csv")
    assert rows[0][4] == "88"
    assert rows[0][5] == "2026-08-15T10:00:00+08:00"


def test_no_partial_output_after_a_mid_run_failure_leaves_files_unchanged(tmp_path):
    day, hour = projection_of()
    raw = write_raw(tmp_path, [
        (occurred_at(), "v1", "seat"),
        ("not-a-timestamp", "v1", "seat"),
    ])
    raw_before = raw.read_bytes()
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)
    assert not (tmp_path / "seatlog.csv").exists()
    assert raw.read_bytes() == raw_before


# --- atomic replace and never rewriting the raw input ------------------------


def test_atomic_replace_leaves_no_temp_file_behind(tmp_path):
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)
    coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)
    leftover = [p for p in tmp_path.iterdir() if p.name.startswith(".seatlog.csv.tmp")]
    assert leftover == []


def test_never_rewrites_the_raw_input(tmp_path):
    raw = write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    before = raw.read_bytes()
    venues_json = default_venues_json(tmp_path)
    coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)
    assert raw.read_bytes() == before


# --- schema validation --------------------------------------------------------


def test_raw_row_wrong_column_count_is_malformed(tmp_path):
    raw = tmp_path / "seatlog.raw.csv"
    raw.write_text("occurred_at,venue_id,outcome\n2026-08-24T09:00:00+08:00,v1\n", encoding="utf-8")
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_raw_header_mismatch_is_malformed(tmp_path):
    raw = tmp_path / "seatlog.raw.csv"
    raw.write_text("time,venue,result\n2026-08-24T09:00:00+08:00,v1,seat\n", encoding="utf-8")
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_committed_header_mismatch_is_malformed(tmp_path):
    (tmp_path / "seatlog.csv").write_text("venue,day,hour,outcome,busy,fetched\n", encoding="utf-8")
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_committed_row_invalid_day_of_week_is_malformed(tmp_path):
    write_committed(tmp_path, [("v1", "someday", 9, "seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_committed_row_out_of_range_hour_is_malformed(tmp_path):
    write_committed(tmp_path, [("v1", "mon", 24, "seat", 10, "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_committed_row_non_integer_busyness_is_malformed(tmp_path):
    write_committed(tmp_path, [("v1", "mon", 9, "seat", "lots", "2026-08-01T10:00:00+08:00")])
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_committed_row_naive_fetched_at_is_malformed(tmp_path):
    write_committed(tmp_path, [("v1", "mon", 9, "seat", 10, "2026-08-01T10:00:00")])
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)
    with pytest.raises(CoarsenError):
        coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)


def test_absent_committed_file_is_processed_count_zero(tmp_path):
    write_raw(tmp_path, [(occurred_at(), "v1", "seat")])
    venues_json = default_venues_json(tmp_path)
    result = coarsen(tmp_path, venues_json, KNOWN_VENUE_IDS)
    assert result == 1
