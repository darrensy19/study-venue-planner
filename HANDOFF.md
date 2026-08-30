# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `WF-001`
- **Work type**: workflow amendment
- **State**: `abandoned`
- **Primary route**: `claude_opus` — Opus, effort high (never used)
- **Verification route**: `codex_sol_high` — Sol, effort high (never used)
- **Route triggers**: workflow-policy change; primary route `claude_opus` — both hard triggers, moot once abandoned
- **Baseline commit**: `ea07366`
- **Artifact under review**: `WORKFLOW.md`, `AGENTS.md`, `CLAUDE.md`'s "Cross-agent coordination" section, `reviews/TEMPLATE.md`, `.cross-agent-workflow/finding_state.py` and `VERSION` — all synced to the current `cross-agent-workflow` skill templates/scripts outside this gated assignment; schema marker stays `v1`
- **Objective**: superseded — see `decisions.md`, "WF-001 abandoned: workflow sync applied directly"
- **Scope exclusions**: —
- **Acceptance criteria**: —
- **Required verification**: n/a — no gate or review ran; verification actually performed (file diffs, sealed-record legacy parsing, skill's 110-test suite) is recorded in `decisions.md`
- **Claude gate result**: — (gate never invoked; assignment abandoned before `draft` work began)
- **Independent review**: `not_required` — superseded before the gate that would have triggered it
- **Gate evidence**: —
- **Review record**: —
- **User decisions required**: —
- **Next action**: None — terminal. `reviews/LEDGER.md`'s `WF-001` row stands per the append-only rule; a new task requires a new assignment ID.

<!--
When State is `blocked_on_user`, add exactly these two fields (still inside the 25-line cap):
- **Blocked reason**: <concrete, one line>
- **Resume state**: <draft | changes_requested | review_requested — the only legal values>
Omit both fields in every other state.
-->
