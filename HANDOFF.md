# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-003`
- **Work type**: implementation
- **State**: `review_requested`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, effort medium
- **Route triggers**: correctness depends on negative/fail-closed paths (unknown-histogram fallback, coverage-floor rejection, `peak`-over-`busy` precedence, ladder clamping) and non-vacuous tests
- **Baseline commit**: `bf75ce0`; implementation at `82dd79f`
- **Artifact under review**: `web/ranking.js` (`resolveBusynessBand`, `resolveSeatConfidence`) and `tests/js/ranking.test.js` (13 new tests, 108 total)
- **Objective**: Implement `relative_busyness` banding and `seat_confidence` — `PLAN.md`, "3. `relative_busyness`" and "4. `seat_confidence`"
- **Scope exclusions**: `backup_strength`, Plan A/B recalculation, any top-level "rank all venues" function (all `IMP-001`'s original exclusions, split further and deferred to a later assignment); `build/refresh.py`, `app.js`, any live busyness fetcher — histogram data is consumed only as a `venue.popularTimes` input parameter, never fetched or generated here
- **Acceptance criteria**: `resolveBusynessBand` (open-hours filtering, `MIN_HISTOGRAM_HOURS` coverage floor, `peak` precedence over `busy`, arrival-hour flooring), `resolveSeatConfidence` (explicit lookup, ladder clamping, `unknown` baseline always `unknown`, `unknown` busyness leaves baseline unchanged with evidence flagged weak) — per `PLAN.md` sections 3-4 and `CLAUDE.md`'s decision-model rules
- **Required verification**: `tests/js/` via `node --test tests/js/*.test.js` (never the bare-directory form)
- **Claude gate result**: `GATE_PASS`
- **Independent review**: pending — round 1 not yet started
- **Gate evidence**: `reviews/IMP-003-gate.md`
- **User decisions required**: —
- **Next action**: hand off to `codex_terra` for round-1 review (see fenced prompt)

<!--
When State is `blocked_on_user`, add exactly these two fields (still inside the 25-line cap):
- **Blocked reason**: <concrete, one line>
- **Resume state**: <draft | changes_requested | review_requested — the only legal values>
Omit both fields in every other state.
-->
