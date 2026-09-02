# Gate record: IMP-006

## Gate invocation 1 — 2026-09-03

- **Gate route**: `claude_sonnet`, effort high
- **Brief source**: `.cross-agent-workflow/gate_brief.py HANDOFF.md` — generated mechanically from `HANDOFF.md`'s `## Current assignment` block, not from the primary's prose

### Checks run

- **`git status --porcelain` / `git diff` scope**: `M HANDOFF.md`, `M reviews/LEDGER.md`, and five untracked paths — `build/bootstrap_venue_sources.py`, `data/venue_sources.json`, `scraper/fetchers.py`, `scraper/hours.py`, `scraper/venue_sources.py`, `tests/python/`. Every path falls inside the brief's named scope (`data/venue_sources.json`, `scraper/`, `build/bootstrap_venue_sources.py`, `tests/python/`, `HANDOFF.md`, `reviews/LEDGER.md`). `git diff -- HANDOFF.md reviews/LEDGER.md` read in full: `HANDOFF.md`'s assignment block was fully replaced (`ARCH-002` → `IMP-006`, all fields consistent with the gate brief); `LEDGER.md` gained exactly one new row. `data/phase0/place_ids.csv` does **not** appear in `git status` — confirmed untouched, byte-identical to baseline.
- **`.venv/bin/pytest tests/python/ -v`**: 37 passed, 0 failed. Full list read: `test_bootstrap_venue_sources.py` (3), `test_fetchers.py` (4), `test_hours.py` (18), `test_venue_sources.py` (12, including all four `test_missing_field_fails[...]` / `test_empty_field_fails[...]` parametrizations, `test_duplicate_venue_id_fails`, `test_duplicate_place_id_fails`, `test_extra_registry_venue_not_in_meta_fails`, `test_extra_meta_venue_not_in_registry_fails` — both directions of ID-set disagreement present).
- **`node --test tests/js/*.test.js`**: `# tests 142`, `# pass 142`, `# fail 0`, `# cancelled 0`, `# skipped 0`. No regression.
- **`.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`** — verbatim output:
  ```
  NOT_DUE
  sampling interval: 1 in 4
  reason: no selected assignment is awaiting audit
  ```
- **`reviews/LEDGER.md` read back**: `grep -c 'IMP-006' reviews/LEDGER.md` → `1`, row reads `| \`IMP-006\` | 2026-09-03 | implementation | Phase 1 step 1: venue-source registry + bootstrap, hours parser, fetch_hours |`.
- **`data/venue_sources.json` checked against real data** (ran a direct Python comparison, not summarized from any doc): file is `{"venues": [...]}` with 28 records. All four required fields (`venue_id`, `place_id`, `resolved_name`, `resolved_address`) nonempty on all 28: 0 violations. `venue_id` unique (28/28 distinct), `place_id` unique (28/28 distinct). `data/phase0/place_ids.csv` has 28 total rows, all 28 `match_status == confident` — registry's `venue_id` set exactly equals the confident rows' `proposed_venue_id` set (both directions empty diff), and the registry's `place_id` set exactly equals the confident rows' `place_id` set. `data/venues_meta.json` has 28 keys; registry `venue_id` set exactly equals that key set (both directions empty diff).
- **`build/bootstrap_venue_sources.py` read in full**: `main()` checks `registry_path.exists()` first and calls `sys.exit(...)` with a message naming the path and "bootstrap is a one-time step" before any other work, writing nothing. Cross-checked against `tests/python/test_bootstrap_venue_sources.py::test_bootstrap_refuses_when_registry_already_exists`, which does not merely check for a raised `SystemExit` but asserts `registry.read_text(...) == existing_content` afterward — genuinely proves byte-unchanged, not just "didn't crash." `build_records()` filters `match_status == "confident"` before mapping `proposed_venue_id` → `venue_id`, matching the acceptance criterion. `validate_registry()` (in `scraper/venue_sources.py`) is called before the write, and `test_bootstrap_fails_before_writing_on_id_set_disagreement` confirms `not registry.exists()` after a rejected run — precondition enforced before any file is produced, and (per `fetch_hours` never being called from bootstrap at all) before any API call.
- **`scraper/venue_sources.py` read in full**: `validate_registry(records, meta_venue_ids)` checks all four fields nonempty (raising on the first violation, per docstring "checked before any API call"), then `venue_id` uniqueness, then `place_id` uniqueness, then exact set equality against `meta_venue_ids`, reporting both `only_registry` and `only_meta` diffs. Matches the brief's "preconditions enforced as a reusable check before any API call" clause; `load_registry()`/`validate_registry()` are pure functions with no network or filesystem side effects beyond the one read.
- **`scraper/fetchers.py` read in full**: `fetch_hours(source, api_key, request_date=None)` takes the full record, reads only `source["place_id"]` to call `place_details()`, and passes the raw payload straight to `parse_hours()` — no re-implementation of hours logic in this file. Does not catch any exception, so both `PlacesError` (transport) and `HoursValidationError` (parse) propagate unmodified to the caller; no file I/O anywhere in the function. `tests/python/test_fetchers.py` (read in full) monkeypatches `place_details` in every test — no live network call — and directly tests: source-record passthrough with `venue_id`/`resolved_name`/`resolved_address` present alongside `place_id`; a transport failure (`PlacesError`, HTTP 500) propagating with `tmp_path` directory contents unchanged; a parse failure (`HoursValidationError`, via a deliberately incomplete `currentOpeningHours` payload) propagating, again with directory contents unchanged.
- **`scraper/hours.py` read in full**: `always_open` regular periods emit `{"open": 0, "always_open": True}` with no `close` key (confirmed both in code at `_parse_regular_hours` and via `test_always_open_regular_has_no_close_key`, which explicitly asserts `"close" not in periods[0]`). Regular-hours decomposition trigger is `day_gap = (close_day_num - open_day_num) % 7`, decomposing only at `day_gap >= 2` with `day_gap <= 1` left as one entry (`entry_close = close_minutes + 1440 * day_gap`) — matches "`day_gap` 0 and 1 untouched." `day_gap == 0` with `close_minutes == open_minutes` raises `HoursValidationError("zero-duration...")`, tested. Regular decomposition entries are built via `by_day[day_key].append(...)` — appended per weekday, never assigned/overwritten. `currentOpeningHours` decomposition (`_decompose_current_period`) computes `span_days` from calendar-`date` subtraction (`(close_date - open_date).days`), never `% 7` — matches "calendar-date difference, never weekday or `mod 7`." The current-hours window (`compute_window`) is `request_date` through `request_date + 6 days`, and every period's `open`/`close` date is validated against `[window_start, window_end]`, raising `HoursValidationError("... falls outside the current-hours window")` on disagreement — tested (`test_period_endpoint_outside_computed_window_fails_loudly`). Truncation: `open.truncated` valid only at `window_start` (else raises), `close.truncated` valid only at `window_end` (else raises) and normalises to minute 1440; `continues_beyond_window: True` is set on every decomposed entry of a truncated chain (`for offset in range(span_days + 1): ... if close_truncated: entry["continues_beyond_window"] = True`), matching "propagated through every entry." `_materialize_current_hours_by_date` raises `HoursValidationError("... malformed data")` for any window date with neither a period nor an explicit `specialDays` closure, and marks span-in-only dates `known` (never `closed`) since they already have an entry in `periods_by_date` from decomposition — matches the brief's "span-in coverage marked `known` not `closed`" clause. `specialDays` handling reads `special["closed"]` and `special["date"]` into a `closed_dates` set, consumed by the same materializer; the fixture supplying it (`tests/python/fixtures/special_closure_synthetic.json`) carries an explicit `"_synthetic": "SYNTHETIC FIXTURE — no saved Phase 0 payload contains specialDays; built by hand to exercise the explicit-closure path."` field, and `tests/python/test_hours.py`'s module docstring states the same. All of the above is read from the code and cross-checked against a passing test for each clause, not accepted from the module docstring's own claims.

### Required-verification gap found — test coverage does not match the brief

The brief's required-verification line for hours parsing lists, among others: **cross-midnight**,
**split periods**, **missing fields**, **multi-day at `day_gap` 2 and 6**, and "**decomposed entries
proven appended not overwritten**." I enumerated every fixture and every regular/current period in
it programmatically (not by reading test names) and found:

- **No regular-hours `day_gap == 1` case is exercised anywhere.** Every fixture's `regularOpeningHours`
  periods have `day_gap` of either 0 or 2 (`open_day == close_day` in every "ordinary" fixture; the
  Friday→Sunday period in `regular_multiday_and_current_mixed.json` and `open_and_close_truncated.json`
  is `day_gap == 2`). `day_gap == 1` — an ordinary overnight closing that crosses midnight into the
  next weekday and is *left as one entry* per the "0 and 1 untouched" rule — is never constructed as
  input, so the `entry_close = close_minutes + 1440 * day_gap` arithmetic at that specific gap value
  is untested. This is the literal "cross-midnight" case named in the brief.
- **No regular-hours `day_gap == 6` case exists.** Only `day_gap == 2` is exercised for regular-hours
  decomposition (`test_regular_multiday_decomposition_day_gap_two_appends_across_weekdays`). No
  fixture or inline payload constructs a `day_gap == 6` regular period, so the "every touched weekday
  present and `known`" claim at the far end of the decomposition range (7 touched weekdays) is
  unverified. (`day_gap == 6` *is* exercised for **current**-hours decomposition, via
  `always_open_both_truncated.json`'s 2026-08-29→2026-09-04 span — but the brief's phrasing tracks
  `PLAN.md`:2345's test-obligation language, "a `day_gap` of 6 and of 2 ... every touched weekday
  present," which is about the weekday-keyed regular-hours case specifically.)
- **No split-period case exists.** No fixture gives any single weekday or calendar date more than one
  period (e.g., a lunch-break gap). `by_day[day_key].append(...)` and `by_date[this_date].append(...)`
  are exercised only ever appending a single element per key across all fixtures, so "decomposed
  entries proven appended not overwritten" is not actually demonstrated by any test — nothing shows a
  second entry surviving alongside a first at the same key.
- **No missing-field case exists.** `_parse_regular_hours` raises `HoursValidationError` for a missing
  `open.day` or missing `close.day`; `_decompose_current_period` raises for a missing `open.date` or
  `close.date`. None of these four raise paths is triggered by any test — every fixture and inline
  payload in `tests/python/test_hours.py` supplies complete `day`/`date` fields throughout.

`pytest tests/python/` genuinely passes 37/37 — every test that exists is correct and does verify what
it claims. The gap is that several named required-verification categories have **no test at all**,
not that an existing test is wrong. This is a required-verification shortfall against the brief as
written, not a design defect in the parser itself.

### Interpretive question flagged for the verification route (as requested)

`scraper/hours.py`'s module docstring argues that `currentOpeningHours` decomposition must trigger at
`day_gap >= 1` (not `>= 2` as for regular hours), because `resolve_hours`'s one-day lookback — the
mechanism that lets a regular-hours `day_gap <= 1` period stay a single entry — is explicitly **not
admitted** when the arrival date resolves under current-hours authority.

I checked this independently against both cited sources rather than accepting the docstring's framing:

- `PLAN.md`'s "Deriving the active period" pseudocode (read in full, lines ~401-429) states exactly
  this: when `authority(arrival_date) == "current"`, `candidates = { arrival_date: arrival_hours }`
  only — the previous date is not added to the candidate set — "Admitting lower-authority regular
  carry-in here would let a 24/7 regular schedule override an explicit current-hours closure." This
  is real and unambiguous; there genuinely is no runtime lookback available for a current-authority
  date.
- `CLAUDE.md`'s "one-day lookback holds by construction" bullet states the regular-hours trigger as
  `day_gap ... >= 2` with "`day_gap` 0 and 1 are untouched," immediately followed by "`currentOpeningHours`
  decomposes by calendar-date difference, never `mod 7`" — this second sentence only settles *how*
  `day_gap` is computed for date-keyed periods, and does not explicitly restate a threshold for
  current hours. It is genuinely ambiguous whether "0 and 1 untouched" was meant to carry over.
  Separately, CLAUDE.md's "`current_hours_by_date` is a complete schedule" bullet requires every
  window date to be materialised, "including dates covered only by a period spanning in from an
  earlier date," with a missing entry being "malformed data" — never a silent regular-hours fallback.

Combining these two settled, already-approved rules (no current-authority lookback; complete-schedule
requirement) leaves no design that satisfies both without decomposing at `day_gap >= 1` for current
hours specifically: an un-decomposed `day_gap == 1` current period would leave the spanned-into date
with no entry in `periods_by_date`, and `_materialize_current_hours_by_date` would then raise
"malformed data" for a date the venue is, in fact, known to be open — which is exactly the sparse-list
defect the "complete schedule" rule was written to close. **My independent assessment: this is a
forced, necessary consequence of two already-approved non-negotiables, not a free architectural
choice the primary invented, and it is not a misreading of the cited text.** It is, however, an
extension beyond what either file states in so many words, and beyond what `PLAN.md`:2345's approved
test-obligation list enumerates (`day_gap` 2 and 6, phrased in the regular-hours idiom). Given
`CLAUDE.md`'s cross-agent rule that a primary must not "make an architectural decision absent from or
contradicting approved architecture," and given this reasoning chain is nontrivial enough that a
different implementer could plausibly have reached the "0 and 1 untouched carries over to current
hours too" reading instead (which would then be in tension with the complete-schedule rule — an
internal-contradiction risk in the settled contract itself, not just in this diff), **this is worth
`codex_terra`'s explicit attention**: confirm independently that no alternative design (e.g.,
materialization-time span-detection without decomposition) was available, and consider whether
`PLAN.md`/`CLAUDE.md` should be updated to state the `day_gap >= 1` current-hours threshold explicitly
rather than leaving it derivable only from a module docstring's cross-reference.

### Could not verify

- None. Every check above was run against the live repository state directly — commands executed and
  their actual output read, files read in full, `git diff` read in full rather than summarized.

### Not asked to check

- Whether `day_gap >= 1` for current-hours decomposition is the objectively *correct* design versus
  some alternative — addressed above as an independent assessment per explicit instruction, but final
  judgment on this design question is `codex_terra`'s, not this gate's.
- Whether the actual model/effort that produced this diff matches `HANDOFF.md`'s claimed
  `claude_sonnet`, effort high — not observable from this subagent.
- `fetch_busyness`/SerpApi, the return-validator bridge, `ranking.js` changes, the coarsening stage,
  frontend/generator work, `build/refresh.py` orchestration, the `Makefile` target, and any live API
  call — all explicit scope exclusions in the brief, not examined.
- `scraper/places.py` beyond confirming `PlacesError`'s shape and `place_details()`'s signature — it
  is a pre-existing Phase 0 file, untouched by this diff, and not itself under review here.
- Prose quality, formatting, or style beyond what the acceptance criteria explicitly require.

### Status

`GATE_FAIL` — required verification is incomplete: the brief's hours-parsing required-verification
line names cross-midnight, split periods, missing fields, and multi-day `day_gap` 2-and-6 cases, and
tests/python/ has no test exercising regular-hours `day_gap == 1` (cross-midnight), no test with more
than one period at a single weekday/date key (split periods, and the "appended not overwritten" claim
is consequently undemonstrated), no test triggering any of the four missing-field validation paths in
`scraper/hours.py`, and no test constructing a regular-hours `day_gap == 6` period. All 37 existing
tests pass and are individually correct; the gap is missing test cases, not a failing test. Everything
else in the brief — registry preconditions, bootstrap refusal, `fetch_hours` propagation and
no-file-write behaviour, truncation/window/materialisation coverage, the synthetic special-closure
fixture, the JS no-regression check, and the git-scope confinement — checks out.

---

## Gate invocation 2 — 2026-09-03

- **Gate route**: `claude_sonnet`, effort high (fresh context, per pre-gate rule)
- **Brief source**: `.cross-agent-workflow/gate_brief.py HANDOFF.md`, re-run this invocation — byte-identical
  to the brief invocation 1 recorded (confirmed by direct comparison of both outputs); `HANDOFF.md`'s
  `## Current assignment` block is unchanged since invocation 1 (`git diff -- HANDOFF.md` matches
  invocation 1's quoted diff verbatim)
- **Context**: invocation 1 (above) returned `GATE_FAIL` for a required-verification shortfall, not a
  design defect: four categories named in the brief's required-verification line had no test at all —
  regular-hours `day_gap == 1` (cross-midnight), regular-hours `day_gap == 6`, split periods (proving
  append-not-overwrite), and the four missing-field raise paths (`open.day`, `close.day` for regular;
  `open.date`, `close.date` for current). This invocation re-verifies against the live repo with
  specific scrutiny on those four named gaps.

### Checks run

- **`.venv/bin/pytest tests/python/ -v`**: 45 passed, 0 failed (up from invocation 1's 37 — exactly 8
  new tests, all in `tests/python/test_hours.py`, which now has 25 tests, up from 18).
  `test_bootstrap_venue_sources.py` (3), `test_fetchers.py` (4), `test_venue_sources.py` (12) are
  byte-for-byte the same test names as invocation 1 reported — no regression, nothing weakened there.
- **Each of the four named gaps, read in the actual test body, not trusted from the test name**:
  - **Cross-midnight, regular-hours `day_gap == 1`**:
    `test_regular_cross_midnight_day_gap_one_stays_a_single_entry` (`tests/python/test_hours.py:196`)
    constructs `{open: {day: 5, hour: 19, minute: 0}, close: {day: 6, hour: 1, minute: 0}}` — Friday
    19:00 → Saturday 01:00. `day_gap = (6 − 5) % 7 = 1`, genuinely the named case (not `0`, not `2`).
    Asserts `regular_hours.fri.periods == [{open: 1140, close: 1500, always_open: false}]` (1140 =
    19:00; 1500 = close_minutes 60 + 1440×day_gap 1 — the exact formula at `scraper/hours.py:109`)
    and `regular_hours.sat == {state: closed, periods: []}` — confirming no Saturday entry is created,
    which is the substance of "0 and 1 untouched": the adjacent weekday is left to the runtime
    one-day lookback rather than decomposed. **Closed.**
  - **Regular-hours `day_gap == 6`**:
    `test_regular_multiday_decomposition_day_gap_six_touches_every_weekday`
    (`tests/python/test_hours.py:213`) constructs `{open: {day: 0, hour: 7, minute: 30}, close: {day:
    6, hour: 17, minute: 30}}` — Sunday 07:30 → Saturday 17:30, `CLAUDE.md`'s own cited maximum-span
    example. `day_gap = (6 − 0) % 7 = 6`. Loops all seven weekdays (`sun` through `sat`), asserting
    each is `known`, has exactly one period, and computes the expected `open`/`close` per-day from
    `real_close_abs - offset * 1440` independently in the test body (not copy-pasted from the
    implementation) — genuinely exercises the seven-touched-weekday claim at the far end of the range.
    **Closed.**
  - **Split periods (append, not overwrite)** — both required for regular and current, since the
    brief's required-verification line names this generically and both shapes exist in the parser:
    `test_regular_split_periods_are_appended_not_overwritten` (line 234) gives Monday two periods
    (08:00–12:00, 13:00–22:00 — a lunch-break shape) and asserts `regular_hours.mon.periods` is a
    two-element list with both surviving in order. `test_current_hours_split_periods_are_appended_not_overwritten`
    (line 251) does the identical shape keyed to one calendar date (2026-08-31) in
    `currentOpeningHours` and asserts both periods survive under `current_hours_by_date["2026-08-31"].periods`.
    Neither is achievable if `by_day[...].append(...)` or `by_date[...].append(...)` were actually
    assignment (`=`) rather than append — a second period would have silently replaced the first, and
    the test would see a one-element list. **Closed, both regular and current.**
  - **Four missing-field raise paths**: `test_regular_missing_open_day_fails_validation` (line 279)
    supplies `open: {hour: 9, minute: 0}` with no `day` key, `close` complete; expects
    `HoursValidationError` matching `"open.day"`. `test_regular_missing_close_day_fails_validation`
    (line 288) is the mirror — `open` complete, `close: {hour: 17, minute: 0}` with no `day`; expects
    match `"close.day"`. `test_current_missing_open_date_fails_validation` (line 297) takes a real
    fixture period and `del`s `open["date"]`; expects match `"open.date"`.
    `test_current_missing_close_date_fails_validation` (line 305) mirrors it on `close["date"]`;
    expects match `"close.date"`. Cross-checked against `scraper/hours.py`: `_parse_regular_hours`
    raises exactly `"regularOpeningHours period missing open.day"` (line 84) and `"...missing
    close.day"` (line 97) at the point `open_point.get("day")` / `close_point.get("day")` is `None`;
    `_decompose_current_period` raises exactly `"currentOpeningHours period missing open.date"` (line
    143) and `"...missing close.date"` (line 161) at the point `_point_date(...)` returns `None`. Each
    of the four tests triggers the specific field it names and no other — none of the four omits a
    second field that would make the raise ambiguous about which check fired. **All four closed.**
- **`git status --porcelain`**: ` M HANDOFF.md`, ` M reviews/LEDGER.md`, and untracked
  `build/bootstrap_venue_sources.py`, `data/venue_sources.json`, `reviews/IMP-006-gate.md` (this gate's
  own artifact, expected), `scraper/fetchers.py`, `scraper/hours.py`, `scraper/venue_sources.py`,
  `tests/python/`. Identical scope to invocation 1 (`reviews/IMP-006-gate.md` was untracked-but-present
  at invocation 1 too, just not itemised in that record's git-status paste). Every path falls inside
  the brief's named scope. `git diff -- HANDOFF.md reviews/LEDGER.md` read in full and compared
  side-by-side against invocation 1's quoted diff: byte-identical — neither file changed between
  invocations. `data/phase0/place_ids.csv` confirmed absent from `git status` and its MD5
  (`23dc483027841e54541abe76a0d46415`) checked directly — untouched, frozen artifact intact.
- **`node --test tests/js/*.test.js`**: `# tests 142`, `# pass 142`, `# fail 0`, `# cancelled 0`,
  `# skipped 0` — identical to invocation 1, no regression.
- **No production logic changed to make the new tests pass artificially**: `scraper/hours.py` read in
  full this invocation. Every function, every raise message, every threshold (`day_gap <= 1` untouched,
  `day_gap >= 2` decomposed for regular; every `day_gap >= 1` decomposed for current) matches invocation
  1's detailed description of the same file line-for-line, including the exact wording of all four
  missing-field error messages the new tests assert against. File mtimes corroborate this
  independently: `scraper/hours.py` (02:47), `scraper/fetchers.py` (02:47), `scraper/venue_sources.py`
  (02:48), and the fixtures directory (02:49) all predate `tests/python/test_hours.py` (02:59) — the
  only file touched in this round was the test file itself, adding new cases against an already-correct,
  unchanged parser.

### Could not verify

- None. Every check above was run against the live repository state directly this invocation — pytest
  actually executed and its full output read, test bodies read line-by-line rather than trusted by
  name, `scraper/hours.py` read in full and cross-checked against both the new test assertions and
  invocation 1's independent description of the same file, `git diff`/`git status` re-run and compared
  directly against invocation 1's quoted output, file mtimes checked directly.

### Not asked to check

- Same exclusions as invocation 1: whether `day_gap >= 1` for current-hours decomposition is the
  objectively correct design (already flagged for `codex_terra`'s attention in invocation 1 as an
  interpretive question, unchanged this round since no design logic was touched); whether the actual
  model/effort that produced this diff matches `HANDOFF.md`'s claimed route; `fetch_busyness`/SerpApi,
  the return-validator bridge, `ranking.js`, coarsening, frontend/generator, `build/refresh.py`
  orchestration, the `Makefile` target, and any live API call — all explicit scope exclusions; prose
  quality or style beyond what acceptance criteria require.

### Status

`GATE_PASS` — all four required-verification gaps invocation 1 named are now closed by genuine tests
that construct the specific case they claim (verified by reading each test body against the fixture/
inline-payload it builds and the implementation line it exercises, not by test name alone): regular-hours
`day_gap == 1` (cross-midnight), regular-hours `day_gap == 6`, split periods proven appended-not-overwritten
for both regular and current hours, and all four missing-field raise paths. `pytest tests/python/` is
45/45 passing (37 carried over unchanged plus 8 new), `node --test tests/js/*.test.js` remains 142/142
with no regression, the change set is still confined to exactly the paths the brief names, and no
production logic was altered to make the new tests pass — only `tests/python/test_hours.py` changed
since invocation 1. Every other acceptance criterion and required-verification item invocation 1 already
confirmed (registry preconditions, bootstrap refusal, `fetch_hours` propagation and no-file-write
behaviour, truncation/window/materialisation coverage, the synthetic special-closure fixture) is
unaffected, since neither `scraper/venue_sources.py`, `scraper/fetchers.py`, nor
`build/bootstrap_venue_sources.py` changed between invocations.

---
