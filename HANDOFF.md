# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-001`
- **Work type**: implementation
- **State**: `draft`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, effort medium
- **Route triggers**: correctness depends on fail-closed paths (`UNKNOWN`/`NONE` distinction, `AT_LEAST(0)` sum type) — mandatory Codex per hard trigger list
- **Baseline commit**: `f6aa4f0`
- **Artifact under review**: `web/ranking.js` (new)
- **Objective**: Implement `web/ranking.js`'s `resolve_hours`, `effective_close` and feasibility-tier machinery per `plan.md`'s decision model and `CLAUDE.md`'s hours-resolution contract.
- **Scope exclusions**: `fetch_hours.py`, `fetch_busyness.py`, `build/refresh.py`, `app.js`, `index.template.html`, `seat_confidence`/`backup_strength`/Plan A-B (deferred to later assignments)
- **Acceptance criteria**: `tests/js/` covers the resolve_hours/effective_close/feasibility-tier cases listed in `CLAUDE.md`'s Testing section (multi-day decomposition, window handling, continuity across the window edge, source authority, the lazy walk, `NONE` vs `UNKNOWN`, `AT_LEAST(0)` accessors, tier boundaries)
- **Required verification**: `node --test tests/js/` passing; no DOM imports or `fetch()` in `ranking.js`; every `surplus_*` use goes through an accessor
- **Claude gate result**: —
- **Independent review**: `required`
- **Gate evidence**: —
- **Review record**: —
- **User decisions required**: —
- **Next action**: Implementation and tests done (38/38 passing), staged but uncommitted. Run the pre-gate next (brief already generated via `.cross-agent-workflow/gate_brief.py HANDOFF.md`), then route to `review_requested` (`codex_terra`) once `GATE_PASS` lands, since a hard trigger already fired.

<!--
When State is `blocked_on_user`, add exactly these two fields (still inside the 25-line cap):
- **Blocked reason**: <concrete, one line>
- **Resume state**: <draft | changes_requested | review_requested — the only legal values>
Omit both fields in every other state.
-->
