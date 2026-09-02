# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-008`
- **Work type**: implementation
- **State**: `completed`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, medium
- **Route triggers**: correctness depends on a negative/fail-closed path — the "confirmed absent only after both routes tried" logic, the exact site of three retracted designs in `DECISIONS.md`'s "Popular Times coverage, take two" (`WORKFLOW.md`'s "correctness depends on negative or fail-closed paths" hard trigger)
- **Baseline commit**: `be3d3c2`; implementation `f0dabe6`
- **Artifact under review**: `scraper/serpapi.py`, `scraper/busyness.py` (new), `fetch_busyness` in `scraper/fetchers.py`, and their `tests/python/` coverage
- **Objective**: Phase 1 step 2 (`PLAN.md`, "Phase 1 implementation order") — a reusable SerpApi transport and Popular Times parser under `scraper/`, plus `fetch_busyness(source)` in `scraper/fetchers.py`, mirroring `fetch_hours`'s registry-record-in/data-out/no-file-writes/propagate-failures pattern
- **Scope exclusions**: `build/refresh.py` orchestration (step 7); the return-validator bridge (step 3); `ranking.js` entry point (step 4); coarsening (step 5); frontend/generator (step 6); no import of or edit to frozen `build/phase0_busyness.py` — read as reference only, per "Phase 0 artifacts stay frozen"
- **Acceptance criteria**: `fetch_busyness(source)` takes the full `venue_sources.json` record, never a bare Place ID; searches SerpApi on `resolved_name` + `resolved_address`; when the first response's `popular_times` is empty, retries via the `data` parameter built from that response's `data_id` + `gps_coordinates` before accepting absence as confirmed (`PLAN.md`, "Fetch layer and refresh orchestration"); handles both the collapsed `place_results` shape and the `local_results` list shape; extracts a `{weekday: [{hour, busyness}]}` histogram; propagates transport failures (a `SerpApiError` analogous to `PlacesError`) and malformed-candidate failures (missing `data_id`/coordinates) to the caller; writes no file
- **Required verification**: `.venv/bin/pytest tests/python/` — new fixture tests covering the search-collapse route, the `local_results` route, the data-param retry succeeding after an empty first response, confirmed-absent after both routes return empty, transport failure propagation, and a malformed candidate (no `data_id` or coordinates) failing rather than guessing; `node --test tests/js/*.test.js` as a no-regression check (142 passing, unaffected — Python-only); `git status`/`git diff` confined to `scraper/`, `tests/python/`, `HANDOFF.md`, `reviews/LEDGER.md`
- **Claude gate result**: `GATE_PASS`
- **Gate evidence**: `reviews/IMP-008-gate.md`
- **Review record**: `reviews/IMP-008.md` — round 1 `APPROVE`, no findings
- **Independent review**: `codex_terra`, medium — 1 round, complete
- **User decision**: 2026-09-03 — approved, and commit authorized; recorded in `DECISIONS.md`
- **Next action**: None — terminal. A new task requires a new assignment ID.
