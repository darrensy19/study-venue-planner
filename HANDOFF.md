# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-002`
- **Work type**: implementation
- **State**: `completed`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, effort medium
- **Route triggers**: correctness depends on fail-open/fail-closed paths (missing service info vs. missing validation) and negative-path/non-vacuous tests, per `WORKFLOW.md`'s hard triggers
- **Baseline commit**: `0dfd855`
- **Artifact under review**: `web/ranking.js` (return-transport functions) and `tests/js/`
- **Objective**: Implement `ARCH-001`'s session-end return-transport design — `PLAN.md`, "Getting home: session-end return transport"; full design in `reviews/ARCH-001.md`
- **Scope exclusions**: `seat_confidence`, `backup_strength` grading, Plan A/B recalculation (all still `IMP-001`'s original exclusions, deferred to a later assignment); `fetch_hours.py`, `fetch_busyness.py`, `app.js`, `index.template.html`; `build/refresh.py`'s fetch/coarsen pipeline — only `validate_return_transport` itself is in scope, not its call site
- **Acceptance criteria**: per `PLAN.md`'s "Getting home" contract and `reviews/ARCH-001.md`: `resolve_return_service`, `validate_return_transport`, `admissible_return_modes`, `overall_tier` (worse of hours tier and return tier), binding-limit composition, `unverified` vs. `UNKNOWN` kept distinct, route-prerequisite-before-clock ordering, core-span waiving timetable not route, pre-dawn gap unmodelled
- **Required verification**: `tests/js/` via `node --test`, covering the return-transport list in `CLAUDE.md`'s Testing section
- **Claude gate result**: `GATE_PASS`
- **Independent review**: round 2 `APPROVE` — `IMP-002-R1-F01` resolved, no new findings
- **Gate evidence**: `reviews/IMP-002-gate.md`
- **Review record**: `reviews/IMP-002.md`
- **User decisions required**: —
- **Next action**: None — terminal. A new task requires a new assignment ID.

<!--
When State is `blocked_on_user`, add exactly these two fields (still inside the 25-line cap):
- **Blocked reason**: <concrete, one line>
- **Resume state**: <draft | changes_requested | review_requested — the only legal values>
Omit both fields in every other state.
-->
