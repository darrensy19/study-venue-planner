# Gate record: IMP-013

## Gate invocation 1 — 2026-09-03

- **Gate route**: `claude_sonnet`, effort high
- **Brief source**: generated from HANDOFF.md acceptance criteria + required verification

### Checks run

- `git status --porcelain` / `git diff --stat` — matches the brief's artifact list exactly:
  modified `DECISIONS.md`, `HANDOFF.md`, `build/generate.py`, `reviews/LEDGER.md`,
  `scraper/fetchers.py`, `tests/python/test_fetchers.py`, `tests/python/test_generate.py`;
  untracked `Makefile`, `build/refresh.py`, `data/holidays.json`,
  `tests/python/fixtures/place_snapshot_ordinary.json`, `tests/python/test_refresh.py`.
  `reviews/LEDGER.md`'s diff is exactly one new row for `IMP-013`, as expected — no other stray
  content.
- Read every changed/new file in full: `build/refresh.py` (330 lines), `data/holidays.json`,
  `Makefile`, `tests/python/test_refresh.py` (350 lines), `tests/python/fixtures/place_snapshot_ordinary.json`,
  and the diffs of `scraper/fetchers.py`, `build/generate.py`, `tests/python/test_fetchers.py`,
  `tests/python/test_generate.py`. Also read `build/coarsen.py` and `build/return_validator_bridge.py`
  in full to check `refresh.py`'s calls against their real signatures/contracts, and
  `DECISIONS.md`'s final entry ("2026-09-03 — IMP-013 in progress") against the actual code.
- Independently reran `.venv/bin/pytest tests/python/ -q` from repo root — **188 passed, 0 failed**,
  matching the brief exactly.
- Independently reran `node --test tests/js/*.test.js` from repo root — **184 passed, 0 failed**,
  matching the brief exactly.
- **8-step order in `build/refresh.py:refresh()` (lines 210-301), checked line by line against
  `PLAN.md:1972-2008`**:
  - Step 1 (coarsen first): `coarsen(data_dir, venues_json_path, known_venue_ids)` at line 251,
    called before `_load_existing_venues` (257) and before any fetch (261-271). `venues_json_path`
    is not written anywhere before this call, so `coarsen()` reads the *currently deployed*
    histogram, not one from this run. `test_coarsen_runs_before_any_fetch_call` confirms via an
    ordering list, not just a name.
  - Steps 2-5 (fetch, catch per-source/per-venue, merge, stamp freshness): `_fetch_one_venue`
    (164-188) wraps `fetch_place_snapshot` in `try/except HOURS_FAILURES` (167-172, covering
    `PlacesError`, `HoursValidationError`, `IdentityValidationError`) and `fetch_busyness` in
    `try/except BUSYNESS_FAILURES` (174-177, covering `SerpApiError`, `BusynessValidationError`)
    independently — one venue's or one source's exception never propagates past `_fetch_one_venue`.
  - **Atomic replace gated on fetched-data validation**: by construction, `fetch_place_snapshot`
    raises before returning any value if `_extract_identity` or `parse_hours` finds malformed data
    (`scraper/fetchers.py:63-99`), so a value that reaches `_merge_hours_source`/`_merge_histogram_source`
    as "succeeded" has already passed contract validation; a failure is caught and converted to a
    per-source `stale`/`failed` status carrying only last-known-good or no data — never malformed
    fetched content. There is no path by which unvalidated fetched data reaches
    `_write_venues_json_atomic` (line 281).
  - **Bridge failure stops the refresh pre-replace**: `validate_return_transport(...)` (line 276)
    is called with no try/except around it in `refresh()`, so a `BridgeError` propagates uncaught
    and `_write_venues_json_atomic` (line 281, after it) is never reached. Confirmed by reading the
    code path (not just a test name) and by `test_broken_bridge_stops_refresh_before_atomic_replace`
    (asserts neither `venues.json` nor `index.html` exists after) and
    `test_broken_bridge_never_overwrites_an_existing_venues_json` (asserts a pre-existing
    `venues.json`'s bytes are unchanged).
  - **Per-venue `invalid` lets generation continue**: `return_status[venue["id"]]` (278) is
    attached to every venue unconditionally, whatever its `state`; nothing branches on `invalid`
    to skip the write. `test_per_venue_invalid_return_status_lets_generation_continue` asserts
    `venues.json` is written with the `invalid` entry intact and `index.html` exists.
  - Step 7 (write) at line 281, step 8 (generate) at lines 284-294 — generation is called only
    after the atomic write, and reads back `venues_json_path` (the just-written file) rather than
    an in-memory value, so a generation-time failure (e.g. `holidays.json` missing) necessarily
    happens after the write. `test_holidays_json_absent_fails_generation_but_venues_json_is_already_written`
    confirms: `GenerationError` raised, `venues.json` exists with both venues, `index.html` absent.
- **Last-known-good / freshness merge logic**, checked against `PLAN.md`'s "three statuses resolve
  from one rule" paragraph and against actual test *assertions*, not just names:
  - `_resolve_freshness` (85-95): first success → `ok`/`now`/`now`; failure with no prior
    `last_success_at` → `failed`/`now`/`None`; failure with a prior `last_success_at` → `stale`/`now`/
    `<original last_success_at, unchanged>`. Matches the rule exactly.
  - `test_hours_failure_falls_back_to_last_known_good_and_status_becomes_stale` asserts concrete
    field values, not just presence: `v1_hours["status"] == "stale"`, `last_success_at` equals the
    *old* (2026-07-29) timestamp rather than `now`, `regular_hours`/`current_hours_by_date` equal
    the old `HOURS_CONTRACT` dict, and `venues["v1"]["name"]`/`lat` equal the old values — a
    non-vacuous check that identity and hours are genuinely retained together as one unit on a
    Places failure, exactly as `DECISIONS.md`'s Gap-1 rationale claims.
  - `test_hours_failure_with_no_prior_history_yields_failed_with_no_data` asserts the `hours` block
    is *exactly* `{"source": "places_api", "last_attempt_at": NOW_ISO, "status": "failed"}` (no
    `last_success_at` key at all) and that `name`/`lat`/`business_status` are absent from the venue
    — matches "failed... carries no data at all," and is a real dict-equality/absence check, not a
    weaker "status is failed" check that a broken implementation could still pass.
  - `test_busyness_failure_independent_of_hours_success` and the reverse direction (hours failing
    while busyness succeeds, exercised in `test_hours_failure_falls_back_to_last_known_good...`)
    together confirm "a busyness-only or hours-only failure still refreshes the other."
- **Two settled-contract corrections, verified as real, not just claimed**:
  - `fetch_hours()` byte-for-byte unchanged: `git diff scraper/fetchers.py`'s single hunk starts
    immediately *after* `fetch_hours()`'s closing `return parse_hours(payload, request_date)` line
    with only `+` lines following — no line inside the existing function body is touched.
  - `fetch_place_snapshot` makes exactly one `place_details` call: `scraper/fetchers.py:91`, one
    `payload, _ = place_details(...)` call, no second call anywhere in the function.
    `test_fetch_place_snapshot_returns_identity_and_hours_from_one_call` asserts
    `seen_calls == [(...)]` (a one-element list), a real single-call check, not "was called."
  - `build/generate.py`'s wrapper-object check (296-308): rejects a non-dict payload and a payload
    whose `venues` key is missing or non-list, both via `GenerationError`. Confirmed the three new
    parametrized tests in `test_generate.py` (`test_generate_index_html_rejects_a_malformed_venues_json_wrapper`)
    actually inject a bare array, a dict missing `venues`, and a dict with `venues` as a non-list
    (`{"a": {...}}`), assert the specific `GenerationError` match text for each, and assert
    `output_path` was never written — genuinely exercising the new negative paths, not just
    re-testing the happy path with a renamed fixture.
- `data/holidays.json`: valid JSON, flat date-map schema matching `PLAN.md`'s documented shape
  exactly (`{"YYYY-MM-DD": {"name": ...}}`), 11 entries for 2026 SG public holidays. Cross-checked
  against `DECISIONS.md`'s claim: New Year's Day, Chinese New Year (2 days, matching `PLAN.md`'s
  own worked example), National Day, Labour Day, Christmas Day are named "certain"; Good Friday
  "computed"; Hari Raya Puasa/Haji, Vesak Day, Deepavali named as the 4 unverified lunar/Islamic
  estimates — that is exactly 4 of the 11 entries, matching the "4/11 unverified" claim in both
  `HANDOFF.md` and `DECISIONS.md`. The file itself carries no `verified`/`estimated` flag (per
  `PLAN.md`'s own "no maintenance-status enum in this file" rule), so the honesty lives correctly
  in `DECISIONS.md`, not the data file, which is the documented design.
- `Makefile`: `refresh:` target runs exactly `.venv/bin/python3 build/refresh.py` — the
  `.venv/bin/python3` form `CLAUDE.md` requires, and no `git` command anywhere in the file, so
  `make refresh` never commits.
- **`existing_venues.get(source["venue_id"])` — merge by id, not position**: `_load_existing_venues`
  (191-195) builds `{v["id"]: v for v in ...}`, and `_fetch_one_venue` is called with
  `existing_venues.get(source["venue_id"])` (264) inside a list comprehension over `registry` — a
  dict lookup, not an index. `return_status[venue["id"]]` (278) is likewise a dict lookup.
  `test_return_transport_status_attached_by_id_not_position` registers sources in reversed order
  (`[SOURCES[1], SOURCES[0]]`, i.e. v2 before v1 in the registry) with a status map where v1 is
  `invalid` and v2 is `ok`, and asserts the correct id gets the correct state — a genuinely
  non-trivial fixture that would fail under a position-based implementation.
- **Dry-run plausibility, actually reproduced (not just eyeballed)**: copied the real
  `data/venue_sources.json`, `data/venues_meta.json`, `data/holidays.json` (28 venues, 28 meta
  entries, registry validation confirmed consistent) and the real `web/index.template.html`,
  `web/ranking.js`, `web/app.js`, `web/style.css` into a scratch directory, monkeypatched only
  `fetch_place_snapshot`/`fetch_busyness` on `build.refresh`, and called `refresh()` for real —
  real `coarsen()` (clean no-op, no raw log present, matching the repo's actual current state),
  real Node return-validator bridge against the real `venues_meta.json`, real `generate_index_html`.
  Result: all 28 venues written with `hours_status`/`histogram_status`/`return_transport_status`
  all `ok`, a `venues.json` with the correct wrapper shape and 28 entries, and a 157KB
  `web/index.html` produced. This confirms the real bridge accepts the real hand-maintained
  `return_transport`/`holiday_return_policy` data without a `BridgeError`, and that nothing in
  `refresh()` depends on a test-only path — the dry-run claim in `HANDOFF.md` is not merely
  plausible, it reproduces cleanly against the actual repository data.
- Confirmed via `grep` that neither `refresh.py` nor `generate.py` ever calls `.write_text`/`.write`
  against `holidays_path` or `venues_meta_path` — the only writes are `_write_venues_json_atomic`
  (to `venues_json_path`) and `output_path.write_text` (in `generate.py`, to the HTML output).

### Could not verify

- The 4 unverified movable-date estimates in `data/holidays.json` (Hari Raya Puasa, Hari Raya Haji,
  Vesak Day, Deepavali) against the official MOM gazette — this is an explicitly named scope
  exclusion (deferred to step 8), and the gate has no external calendar source to check against
  regardless.
- Whether the real `GOOGLE_PLACES_API_KEY`/`SERPAPI_API_KEY`-driven live fetch path in
  `scraper/fetchers.py` behaves correctly against the live Google Places / SerpApi services — no
  network calls were made (correctly out of scope for this gate and for step 7 generally; step 8
  is excluded).
- `data/venues_meta.json`'s actual `return_transport`/`holiday_return_policy` content for
  correctness beyond "the bridge validates it without a `BridgeError`" — hand-curated data fill is
  a named, separate, privacy-sensitive scope exclusion; the dry-run confirms the bridge mechanics
  work against the real file, not that every entry's content is itself correct.

### Not asked to check

- Step 8 (live refresh spending a real API call) — named scope exclusion in `HANDOFF.md`.
- `return_transport`/`holiday_return_policy` hand-curated data fill — named scope exclusion.
- The outbound-mirror ARCH — named scope exclusion, deliberately unscoped.
- Verifying `holidays.json`'s 4 movable-date estimates against the official gazette — named scope
  exclusion, flagged for step 8.
- `web/ranking.js`'s `validateReturnTransport()` implementation and the return-transport tier logic
  it feeds — unchanged in this diff (not in the artifact list), out of scope for this gate.
- General code style, accessibility, and performance beyond what `PLAN.md`'s non-negotiables and
  the stated acceptance criteria require.

### Status

`GATE_PASS`

---
