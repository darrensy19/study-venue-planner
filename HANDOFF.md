# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-011`
- **Work type**: implementation
- **State**: `review_requested`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, medium
- **Route triggers**: correctness depends on negative/fail-closed paths, and on proving tests are not vacuous — `PLAN.md`'s "The coarsening stage" enumerates ~20 required negative-path fixture cases (malformed rows, an unmirrored prefix change, four boundary-condition pairs for the insertion/deletion mechanism) that a passing-but-wrong implementation could satisfy vacuously; also a destructive-data-operation flavor (atomic replace of the committed, privacy-load-bearing `data/seatlog.csv`) (`WORKFLOW.md` hard triggers)
- **Baseline commit**: `3222ff9`
- **Artifact under review**: new `build/coarsen.py`, new `tests/python/test_coarsen.py`
- **Objective**: Phase 1 step 5 (`PLAN.md`'s "Phase 1 implementation order" / "The coarsening stage") — reads a private raw seat-log CSV, derives `processed_count` from the committed `data/seatlog.csv` (no cursor file), re-projects and compares the raw prefix against it, joins each new row against the currently-deployed `data/venues.json` histogram, and atomically replaces `data/seatlog.csv` with the committed prefix plus the new coarsened suffix
- **Scope exclusions**: `build/refresh.py` orchestration/wiring (step 7, not yet built — `coarsen.py` is called, not itself the orchestrator); the fetchers (already built, `IMP-006`/`IMP-008`); frontend/generator (step 6); live refresh (step 8); no change to `web/ranking.js` or any settled per-venue primitive
- **Acceptance criteria**: candidate selection exactly as specified (0/1/2+ raw-log locations, `data/seatlog.raw.csv` or non-recursive `data/raw/*.csv`); both raw and committed schemas fully validated, any malformed row aborting the whole attempt with no partial write; `processed_count` derived from the committed file, never a stored cursor; prefix comparison on the 4-column projection only, row-for-row; every one of `PLAN.md`'s ~20 enumerated fixture cases (Group 1/Group 2 instances, both insertion/deletion boundary pairs, the coordinated-edit cases) implemented with its own non-vacuous test; suffix rows stamped from the *pre-fetch* deployed histogram's own `last_success_at`, never this run's fetch; atomic replace via a same-directory temp file, validated before the swap
- **Required verification**: `.venv/bin/pytest tests/python/ -q` — 128 passed, 0 failed (78 pre-existing + 50 new); `node --test tests/js/*.test.js` unaffected — 178 passed, no `web/` file touched; `git status`/`git diff` confined to `build/coarsen.py`, `tests/python/test_coarsen.py`, `HANDOFF.md`, `reviews/IMP-011-gate.md`; every negative-path test independently confirmed non-vacuous by mutation, re-verified after each gate-round fix
- **Claude gate result**: `GATE_FAIL` (invocation 1: `test_insertion_or_deletion_shifting_a_differing_projection_fails` was vacuous — masked by an unrelated missing-histogram error rather than isolating the prefix-comparison mismatch it names) → corrected (fixture given a complete histogram; two secondary non-gating notes also fixed) → `GATE_PASS` (invocation 2)
- **Independent review**: `required` — `codex_terra`, medium
- **Gate evidence**: `reviews/IMP-011-gate.md`
- **Review record**: `reviews/IMP-011.md` (pending — reviewer writes this)
- **User decision**: pending
- **Next action**: Independent review by `codex_terra` — see the fenced handoff prompt.
