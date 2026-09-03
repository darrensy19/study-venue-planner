# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-013`
- **Work type**: implementation
- **State**: `completed`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, medium
- **Route triggers**: negative/fail-closed correctness (`WORKFLOW.md` hard trigger) — ordered orchestration, last-known-good retention, unconditional classify-never-abort `validate_return_transport`, bridge failure modes, `holidays.json` fail-visible; plus two additive/narrow corrections to previously-closed contracts, both user-directed mid-assignment — `scraper.fetchers.fetch_place_snapshot()` (new, additive; `fetch_hours()` unchanged) and `build.generate.generate_index_html()`'s `venues_path` now requiring the wrapper object it always should have (`IMP-012` regression fix) — see `DECISIONS.md`, 2026-09-03 "IMP-013 in progress"
- **Baseline commit**: `927bfd3`
- **Artifact under review**: `build/refresh.py` (new), `data/holidays.json` (new, hand-maintained, 4/11 dates unverified — see Decisions), `Makefile` (new); `scraper/fetchers.py` (additive: `IdentityValidationError`, `fetch_place_snapshot`); `build/generate.py` (correction: `venues_path` wrapper-object requirement); `tests/python/test_refresh.py` (new), `tests/python/test_fetchers.py` + `tests/python/test_generate.py` (additive/updated), `tests/python/fixtures/place_snapshot_ordinary.json` (new)
- **Objective**: Phase 1 step 7 (`PLAN.md`'s "Phase 1 implementation order" item 7 / "Fetch layer and refresh orchestration", lines 1972-2008) — wire `build/refresh.py`'s 8-step pipeline end to end, populate `data/holidays.json`, add the `Makefile` `refresh` target
- **Scope exclusions**: step 8 (live refresh, spends an API call — manual acceptance only); `return_transport`/`holiday_return_policy` hand-curated data fill (separate, privacy-sensitive, out-of-protocol); the outbound-mirror ARCH (deliberately unscoped); verifying `holidays.json`'s 4 movable-date estimates against the official gazette (flagged, deferred to step 8)
- **Acceptance criteria**: `PLAN.md` lines 1981-2007's 8-step order verbatim — coarsen first, atomic replace gated on fetched-data validation only; per-source/per-venue fetch failures isolated with last-known-good retention (identity+hours retained as one Places snapshot); `validate_return_transport` unconditional, classifies, never aborts; bridge failure modes stop the refresh pre-replace, a per-venue `invalid` lets generation continue; `holidays.json` absent/malformed fails generation visibly, and `venues.json` is already durably written by that point; `refresh.py`/`generate.py` never write `holidays.json`/`venues_meta.json`; `make refresh` never commits; a busyness-only or hours-only failure still refreshes the other — met, see Required verification
- **Required verification**: `.venv/bin/pytest tests/python/ -q` — 188 passed, 0 failed; `node --test tests/js/*.test.js` — 184 passed, 0 failed, unaffected; a full dry-run of `refresh()` against a copy of the real 28-venue `data/`/`web/` (fetchers stubbed, real coarsen/bridge/generate) produced a valid `venues.json` + `index.html` — independently reproduced by the gate
- **Claude gate result**: `GATE_PASS` (invocation 1)
- **Independent review**: round 1 (`codex_terra`) `APPROVE` — no findings, no reviewer-required user decisions
- **Gate evidence**: `reviews/IMP-013-gate.md`
- **Review record**: `reviews/IMP-013.md`
- **User decision**: approved — user authorized commit and close after round-1 `APPROVE`
- **Next action**: none — assignment closed; open a new ID for Phase 1 step 8 or the `return_transport` data fill
