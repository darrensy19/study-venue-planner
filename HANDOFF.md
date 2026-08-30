# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-001`
- **Work type**: implementation
- **State**: `completed`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, effort medium
- **Route triggers**: correctness depends on fail-closed paths (`UNKNOWN`/`NONE` distinction, `AT_LEAST(0)` sum type) — mandatory Codex per hard trigger list
- **Baseline commit**: `f6aa4f0`
- **Artifact under review**: `web/ranking.js` (new), commit `1677066`
- **Objective**: Implement `web/ranking.js`'s `resolve_hours`, `effective_close` and feasibility-tier machinery per `plan.md`'s decision model and `CLAUDE.md`'s hours-resolution contract.
- **Scope exclusions**: `fetch_hours.py`, `fetch_busyness.py`, `build/refresh.py`, `app.js`, `index.template.html`, `seat_confidence`/`backup_strength`/Plan A-B (deferred to later assignments)
- **Acceptance criteria**: `tests/js/` covers the resolve_hours/effective_close/feasibility-tier cases listed in `CLAUDE.md`'s Testing section (multi-day decomposition, window handling, continuity across the window edge, source authority, the lazy walk, `NONE` vs `UNKNOWN`, `AT_LEAST(0)` accessors, tier boundaries)
- **Required verification**: `node --test tests/js/*.test.js` passing; no DOM imports or `fetch()` in `ranking.js`; every `surplus_*` use goes through an accessor
- **Claude gate result**: `GATE_PASS`
- **Independent review**: `required`
- **Gate evidence**: `reviews/IMP-001-gate.md` (invocation 1, 2026-08-30)
- **Review record**: `reviews/IMP-001.md` (round 1: `CHANGES_REQUESTED`, `IMP-001-R1-F01`; round 2: `APPROVE`, no findings)
- **User decisions required**: —
- **Next action**: User approved and authorized close 2026-08-30. `decisions.md` and `reviews/AUDIT-LOG.md` updated per `WORKFLOW.md`'s boundary rules. `IMP-001` is closed — a new assignment needs a new ID. Phase 1 step 2 meta fields (`access`/`preference`/`fallbacks`/`holiday_policy`/`closing_buffer_minutes`) are now complete for all 28 venues (2026-08-30, outside the assignment system — see `decisions.md`), and the naming-collision rename is done (`bf2c0a5`). Two real candidates remain: (1) an `ARCH-###` for the flagged session-end/return-transport feasibility requirement — not yet designed; (2) `seat_confidence`/`backup_strength`/Plan A-B, excluded from `IMP-001`'s scope, still unimplemented.

<!--
When State is `blocked_on_user`, add exactly these two fields (still inside the 25-line cap):
- **Blocked reason**: <concrete, one line>
- **Resume state**: <draft | changes_requested | review_requested — the only legal values>
Omit both fields in every other state.
-->
