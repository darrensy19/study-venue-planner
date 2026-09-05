# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-017`
- **Work type**: implementation
- **State**: `completed`
- **Primary route**: `claude_sonnet` — Sonnet, effort high — single-module implementation against a settled contract
- **Verification route**: `claude_only`
- **Route triggers**: none fired — a thin CLI wrapper around `generate_index_html()`, already built and tested under `IMP-012`; no architecture, schema, auth, public-contract or concurrency/idempotency question is newly decided here
- **Baseline commit**: `6e68b27`
- **Artifact under review**: `build/generate.py` (new `main()` + `__main__` guard), `Makefile` (new `generate` target), `tests/python/test_generate.py` (new tests) — the diff to these three files
- **Objective**: Slice 0 (`PLAN.md`, "Phase 1 review-response slice order") — `make generate`, a no-network target regenerating `web/index.html` from whatever `data/venues.json` already holds on disk
- **Scope exclusions**: no change to `generate_index_html()`, `render_page()`, or any already-tested function in `build/generate.py`; no change to `build/refresh.py`'s publish ordering (that's slice 5, separately scoped)
- **Acceptance criteria**: `make generate` runs with zero network calls and regenerates a valid `web/index.html` from on-disk data; a `GenerationError` (e.g. missing `holidays.json`) yields a clean nonzero exit and stderr message, never a traceback, and writes nothing; `tests/python/` covers both paths via `tmp_path` fixtures, no real repo files touched by the tests themselves
- **Required verification**: run `.venv/bin/pytest tests/python/ -q` and `node --test tests/js/*.test.js` (no regressions); run `make generate` against the real repo and confirm it succeeds with no network access and reproduces `web/index.html` byte-identical to its last committed generation (proving determinism); confirm the new tests use `tmp_path`, never real `data/`/`web/` paths
- **Claude gate result**: `GATE_PASS` (invocation 1) — `reviews/IMP-017-gate.md`. Gate independently ran `pytest` (190 passed), `node --test` (184 passed), and `make generate` against real data with a deliberately unreachable proxy to force any real network attempt to fail loudly — exited 0, `web/index.html` byte-identical to committed
- **Independent review**: `not_required` — `claude_only` route, no hard trigger fired
- **Review record**: none — `claude_only` route has no Codex review record
- **User decision**: approved — close and commit, per the standing "follow protocol, commit, proceed" instruction for this session (2026-09-06)
- **Next action**: none — assignment closed. Next in `PLAN.md`'s slice order: Slice 0b (dependency-free DOM stub; make `app.js` importable). Open a new ID when ready to proceed
