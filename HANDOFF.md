# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-022`
- **Work type**: implementation
- **State**: `completed`
- **Primary route**: `claude_sonnet` — Sonnet, effort high — single-module implementation against an already-approved contract (`ARCH-003`, revised `ARCH-004`; `PLAN.md`'s "Getting there: outbound-mirror transport"), no new architecture decision
- **Verification route**: `codex_terra` — hard trigger: correctness depends on several specified negative/fail-closed paths and on proving those tests are not vacuous
- **Baseline commit**: `cc93fa5`
- **Artifact under review**: `web/ranking.js`, `build/refresh.py` + new `build/outbound_validator_bridge.py`/`build/validate_outbound_transport.mjs`, `tests/js/ranking.test.js`+`app.test.js`, `tests/python/test_outbound_validator_bridge.py`+`test_refresh.py` — committed at `bf4bbf5`
- **Objective**: Slice 3 (`PLAN.md`'s "Phase 1 review-response slice order") — `outbound_admissible`, `resolve_outbound_service`, `validate_outbound_transport` in `web/ranking.js`/`build/refresh.py`, plus `outbound_transport` hand-curation in `data/venues_meta.json`
- **Required verification**: `.venv/bin/pytest tests/python/ -q` (209/209), `node --test tests/js/*.test.js` (286/286), `make generate` offline — all reran clean by the reviewer
- **Gate result**: `GATE_FAIL` ×2 (test-coverage findings only, both fixed), retries exhausted, routed to Codex — `reviews/IMP-022-gate.md`
- **Review round 1**: `codex_terra` — no findings, `APPROVE` — `reviews/IMP-022.md`
- **Blocked (separate, not this assignment)**: `data/venues_meta.json`'s `outbound_transport` hand-curation needs the user's real transit data (bands only, per the privacy rule)
- **User decision**: approved — close and commit (2026-09-06)
- **Next action**: none — assignment closed. Next in `PLAN.md`'s slice order: the `outbound_transport` hand-curation (blocked on the user), then Slice 4/`BL-002` (UI hierarchy/disclosure — needs Slice 2's vocabulary, already settled), Slice 5 — before `ARCH-005` can open
