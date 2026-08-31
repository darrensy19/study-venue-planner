# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-004`
- **Work type**: implementation
- **State**: `completed`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, effort medium
- **Route triggers**: correctness depends on negative/fail-closed paths (unverified-return cap on `salvage`, `cycle`-fallback-without-bicycle exclusion, delayed-arrival closure, return-capped-vs-hours-capped floor) and non-vacuous tests — same pattern as `IMP-002`/`IMP-003`
- **Baseline commit**: `07e8b67`; implementation `bdf7ada`; round-1 correction `5eebfdc`
- **Artifact under review**: `web/ranking.js` (Plan B recalculation + `backup_strength` grading) and `tests/js/ranking.test.js`
- **Objective**: Implement `backup_strength` grading and Plan B recalculation in `web/ranking.js` — `PLAN.md`, "5. `backup_strength`" and "Plan A and Plan B"
- **Scope exclusions**: band-string ("N-Mm") parsing for `fallbacks[].travel_band` / `access[][].band` (fallback travel minutes enter as resolved numbers, mirroring `resolveOverallFeasibility`'s existing `travelMinutesMid/Upper` parameter shape — that string-to-minutes conversion is Phase 1 orchestrator work, not yet built for the origin leg either); selecting/ranking the best fallback among several candidates for one venue (that is "rank all venues"-adjacent, already deferred); `build/refresh.py`, `app.js`, any top-level ranking function
- **Acceptance criteria**: Plan B's dual-bound arrival chain (`plan_b_departure_*` from Plan A's arrival + `SEAT_CHECK_BUFFER_MINUTES`, `plan_b_arrival_*` from there + fallback travel), each bound resolved independently through the same hours/return machinery as Plan A (no shared-departure shortcut); `backup_strength` three-way (`strong`/`salvage`/`none`) graded on the fallback's `overall_tier` and confidence floor; `unverified` return capping at `salvage`; a `cycle`-mode fallback link excluded when `!bicycle_with_you`; the floor minutes are the return-capped `usable_minutes`, never hours-capped — per `PLAN.md` §5 and "Plan A and Plan B"
- **Required verification**: `tests/js/` via `node --test tests/js/*.test.js` (never the bare-directory form)
- **Claude gate result**: `GATE_PASS`
- **Independent review**: round 1 `CHANGES_REQUESTED` — `IMP-004-R1-F01` accepted and corrected in `5eebfdc`; round 2 `REPO VALIDATION` on that correction returned `APPROVE` — `IMP-004-R1-F01` `resolved`, no new findings
- **Gate evidence**: `reviews/IMP-004-gate.md`
- **Review record**: `reviews/IMP-004.md`
- **User decisions required**: —
- **Next action**: None — terminal. A new task requires a new assignment ID.
