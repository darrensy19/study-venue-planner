# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `ARCH-001`
- **Work type**: architecture/high-level
- **State**: `completed`
- **Primary route**: `claude_opus` — Opus, effort high
- **Verification route**: `codex_sol` — Sol, effort medium
- **Route triggers**: architecture/methodology change to the decision model; primary route is `claude_opus` — both are hard triggers, Codex mandatory
- **Baseline commit**: `9e19ebc`
- **Artifact under review**: `plan.md` (new "Getting home: session-end return transport" section, plus the amendments it forces) and `CLAUDE.md` (non-negotiables). Design only, no code. `decisions.md` gets its summary entry at close, per `WORKFLOW.md`'s boundary rules.
- **Objective**: Design the session-end/return-transport feasibility requirement — the decision model currently checks only that a venue is open at arrival, never whether transport still runs for the trip home afterward.
- **Scope exclusions**: implementation (a follow-up `IMP-###`); the existing arrival-side `resolve_hours`/`effective_close` machinery, unchanged unless the design requires it
- **Acceptance criteria**: a recorded design covering what return-transport data is needed per origin/fallback, how "transport still runs home" is evaluated for Plan A and Plan B, how it composes with the existing feasibility tiers, and how it degrades when return data is unknown (must fail open to `unknown`, never assume last-mile transport is always available) — consistent with `CLAUDE.md`'s non-negotiables (no live data, no numeric seat probability, `AT_LEAST(0)`/`UNKNOWN` semantics)
- **Required verification**: design cross-checked for internal consistency against `plan.md`'s decision model and every relevant `CLAUDE.md` non-negotiable; no contradiction with frozen invariants
- **Claude gate result**: `GATE_FAIL` (invocation 2 of 2; a third invocation is prohibited, so the assignment routes to Codex per `WORKFLOW.md`'s retry rule)
- **Independent review**: `required`
- **Gate evidence**: `reviews/ARCH-001-gate.md`, invocations 1 and 2. Invocation 1: 4 findings, all corrected. Invocation 2: 1 uncorrected privacy leak (`plan.md` second `basis` example) plus 1 doc-consistency gap — both corrected afterwards and therefore **ungated**.
- **Review record**: `reviews/ARCH-001.md` — sealed. Round 5 (`codex_sol`) `APPROVE`, no findings; all ten findings across five rounds `resolved`. `decisions.md` summary entry and the `reviews/AUDIT-LOG.md` `completed` row are written.
- **User decisions required**: —
- **Next action**: None — terminal. A new task requires a new assignment ID.

<!--
When State is `blocked_on_user`, add exactly these two fields (still inside the 25-line cap):
- **Blocked reason**: <concrete, one line>
- **Resume state**: <draft | changes_requested | review_requested — the only legal values>
Omit both fields in every other state.
-->
