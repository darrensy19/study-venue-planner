# Codex participation

`WORKFLOW.md` is authoritative and complete — it contains every rule needed for daily operation,
including route selection, gate mechanics, and prompt construction. This file contains only
Codex-specific instructions: when to read `WORKFLOW.md`, which sections, and the write boundaries
for each role Codex may hold. It never restates a transition, a gate, or the route tables.

## Preflight

At the start of each assignment, and again after another agent or the user has acted:

1. Read `WORKFLOW.md`'s Roles, Choosing a route, and Lifecycle sections; `HANDOFF.md`; the relevant
   `PLAN.md` section; and the current review record if it exists — sliced per `WORKFLOW.md`'s
   role- and state-aware slicing table for whichever role this assignment names.
2. Inspect `git status` and the exact diff or commit named in `HANDOFF.md`.
3. Confirm the current assignment names Codex in the intended role and the intended route. If the
   runtime does not expose the selected model, state that it cannot be verified — do not claim a
   match.
4. When returning as primary after a review, reconcile any newer reviewer recommendation into
   `HANDOFF.md` before primary edits resume. If changes were requested, append the primary-owned
   response section required by `WORKFLOW.md` after corrections and verification are complete.

`AGENTS.md` is loaded at session start, not continuously. `HANDOFF.md` and review records change
during the workflow — re-read those state files explicitly rather than relying on session-start
context. After a `WF-###` change to `WORKFLOW.md`, start a fresh Codex session for automatic
instruction discovery.

## Architecture primary — `codex_sol` or `codex_sol_high`

- Work only on the bounded architecture or high-level assignment recorded in `HANDOFF.md`.
- Edit only the named design, roadmap, and handoff artifacts; do not implement production code in
  an architecture assignment.
- Preserve approved project constraints, source policy, frozen artifacts, and spent holdouts.
- Run the assignment's required verification, freeze edits, and invoke the gate. On
  `GATE_PASS` set `review_requested` if a hard trigger fired or `approval_requested` otherwise; on
  `GATE_FAIL` remain in `draft`; on `GATE_INCONCLUSIVE` set `review_requested` or `blocked_on_user`.
  Then stop editing.
- After review, independently verify every finding before resolving or rebutting it. Append only a
  `Primary response to review round N` section; never edit reviewer-owned or earlier sections.

## Implementation reviewer — `codex_terra`, `codex_luna`, or `codex_sol`/`codex_sol_high`

- Remain read-only except for the exact `reviews/<id>.md` path named in `HANDOFF.md`.
- Independently inspect the implementation, rerun every required verification check declared in
  `HANDOFF.md`, and add any checks the findings require. Record anything unavailable under `Could
  not verify`; do not recommend `APPROVE` without an explicit user waiver for an unperformed
  required check.
- Append reviewer-owned sections using `reviews/TEMPLATE.md`, including stable finding IDs and
  resolution statuses; never edit a primary response or an earlier section.
- **On `APPROVE`, emit the reconciliation handoff** — a fenced prompt scoped to reconciling
  `HANDOFF.md` to `review_complete`, per `WORKFLOW.md`'s one-writer protocol. Codex cannot write
  `HANDOFF.md` itself.
- Escalate architectural discoveries rather than supplying a redesign inside implementation review.
- Do not infer policy changes from user facts, preferences, model confirmations, or ambiguous
  statements; recommend `BLOCKED_ON_USER` when an explicit policy decision is required.
- Do not edit code, tests, project documentation, `HANDOFF.md`, or prior review records. Do not
  commit.

## Sampling auditor — `codex_luna`, escalating to `codex_terra`

- Runs only when invoked for a due sampling audit, in a user-sequenced, read-only turn — never
  concurrent with a primary writer.
- Writes only `reviews/audits/<date>.md`, following `reviews/TEMPLATE.md`'s audit schema. Never
  touches a sealed assignment record, and **never writes `reviews/AUDIT-LOG.md`** — that log is
  primary-owned. The primary appends the `sampled` rows before this audit runs and the `audited`
  row after it, per `WORKFLOW.md`'s handback sequence. Report the outcome so the primary can record
  it; an audit whose result is never logged looks identical to one that never ran.
- A material finding is reported in the audit record; it is never corrected in place — a new
  assignment references the audit instead.
