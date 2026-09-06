# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-022`
- **Work type**: implementation
- **State**: `review_requested`
- **Primary route**: `claude_sonnet` — Sonnet, effort high — single-module implementation against an already-approved contract (`ARCH-003`, revised `ARCH-004`; `PLAN.md`'s "Getting there: outbound-mirror transport"), no new architecture decision
- **Verification route**: `codex_terra` — hard trigger: correctness depends on several specified negative/fail-closed paths (a malformed `by_weekday` entry must never affect an unrelated query; `outbound_transport_status` must never gate ranking at any granularity) and on proving those tests are not vacuous
- **Baseline commit**: `cc93fa5`
- **Artifact under review**: `web/ranking.js`, `build/refresh.py` + new `build/outbound_validator_bridge.py`/`build/validate_outbound_transport.mjs`, `tests/js/ranking.test.js`+`app.test.js`, `tests/python/test_outbound_validator_bridge.py`+`test_refresh.py` — see `reviews/IMP-022-gate.md` invocation 1 for the full file-by-file trace
- **Objective**: Slice 3 (`PLAN.md`'s "Phase 1 review-response slice order") — `outbound_admissible`, `resolve_outbound_service`, `validate_outbound_transport` in `web/ranking.js`/`build/refresh.py`, plus `outbound_transport` hand-curation in `data/venues_meta.json`
- **Scope exclusions**: no change to `return_transport`/return-leg logic; no UI/`app.js` change beyond rendering the existing generic removal-row shape (hierarchy/disclosure work is Slice 4); no `holiday_outbound_policy` field — reuses `holiday_return_policy`
- **Acceptance criteria**: `PLAN.md`'s "Getting there: outbound-mirror transport" contract in full — hard filter via `outbound_admissible`; origin-keyed lookup; shared `holiday_return_policy`/service-span constants with the return leg; `pre_dawn_gap`/`missing_data`/`after_last_departure` → label `"outbound_gap"`, `invalid_metadata` → label `"outbound_data_error"`, both internal reason and label retained; `outbound_transport_status` diagnostics-only, never read by `outbound_admissible`; `nothing_evaluable`'s diagnostics extended per that section
- **Required verification**: `.venv/bin/pytest tests/python/ -q` (209/209 passing), `node --test tests/js/*.test.js` (286/286 passing), `make generate` offline (ran clean)
- **Gate result**: `GATE_FAIL` ×2, each one real test-coverage finding, no functional defect found either time; retries exhausted per `WORKFLOW.md`'s 2-attempt limit, routed to Codex — full detail in `reviews/IMP-022-gate.md`
- **Blocked**: `data/venues_meta.json`'s `outbound_transport` hand-curation needs the user's real transit knowledge (privacy rule: bands only, no exact times/lines) — code and tests are otherwise complete for this slice
- **Shadow trial**: nominated as `cross-agent-workflow`'s Slice 3 shadow-trial subject — the reviewer creating `reviews/IMP-022.md`'s header must add the round-1 scope declaration per `~/Projects/claude-skills/cross-agent-workflow/references/shadow-trial.md`
- **User decision**: approved — route/scope confirmed, proceed (2026-09-06)
- **Next action**: user runs the fenced Codex Terra handoff prompt below for the round-1 review
