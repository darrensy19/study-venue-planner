# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-010`
- **Work type**: implementation
- **State**: `review_requested`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, medium
- **Route triggers**: correctness depends on negative/fail-closed paths — the ranked/unranked taxonomy's hard-filter, unranked-removal and validation-failure rows (`PLAN.md`, "Venues that cannot be ranked" and "The ranked and unranked taxonomy") must each be distinguished from an ordinary ranked outcome, with its own entry-point test; and a shared cross-component invariant — this entry point is the one call site `app.js` and its tests treat as authoritative for ranking order and the Plan-B-before-Plan-A sequencing constraint (`WORKFLOW.md`'s "negative or fail-closed paths" and "shared cross-component invariant" hard triggers)
- **Baseline commit**: `c4737d9`
- **Artifact under review**: `web/ranking.js` (new whole-dataset entry point), `tests/js/ranking.test.js` (extended)
- **Objective**: Phase 1 step 4 (`PLAN.md`, "Phase 1 implementation order") — the single pure, whole-dataset entry-point function in `ranking.js` ("The ranking pipeline" / "One entry point, pure, whole-dataset"), wiring the already-implemented per-venue primitives into control resolution, snapshot validation, travel-band parsing, return-status removal, evaluation, Plan B evaluation, and final grouping/ranking/refusals
- **Scope exclusions**: `app.js`/frontend and the HTML generator (step 6); the coarsening stage (step 5); refresh orchestration and `Makefile` (step 7); live refresh (step 8); no change to the existing per-venue primitives (`resolveOverallFeasibilityAtArrivals`, `resolveBackupStrength`, `evaluatePlanBFallback`, `resolveBusynessBand`, `resolveSeatConfidence`, `validateReturnTransport`) — settled contracts, read-only imports
- **Acceptance criteria**: one pure function, no DOM/I/O, taking the whole snapshot plus control state; ownership order exactly as `PLAN.md` states (control resolution → snapshot validation → travel-band parsing/arrivals → return-status `STEP 0` removal → evaluation → Plan B before `backup_strength` ranks Plan A → grouping/refusals/ordering); the 8-key ranking order and 7-key fallback-selection order exactly as specified, `surplus_mid` only via `surplusSortKey()`; every row of the ranked/unranked taxonomy table implemented with its own entry-point test; both refusal messages present, worded distinctly, never substituted; alternatives grouped by `area`
- **Required verification**: `node --test tests/js/*.test.js` — 176 passed, 0 failed (142 pre-existing + 34 new); `.venv/bin/pytest tests/python/` — 78 passed, unaffected; `git status`/`git diff` confined to `web/ranking.js`, `tests/js/ranking.test.js`, `HANDOFF.md`, `reviews/LEDGER.md`, `reviews/IMP-010-gate.md`
- **Claude gate result**: `GATE_FAIL` (invocation 1) → corrected → `GATE_PASS` (invocation 2)
- **Independent review**: `required` — `codex_terra`, medium
- **Gate evidence**: `reviews/IMP-010-gate.md`
- **Review record**: `reviews/IMP-010.md` (pending — reviewer writes this)
- **User decision**: pending
- **Next action**: Independent review by `codex_terra` — see the fenced handoff prompt.
