# Shared Claude + ChatGPT + Codex workflow

This is a short orientation; `WORKFLOW.md` remains the complete authority for
collaboration. The Codex adapter below retains its existing role boundaries.

## Roles and authority

- **ChatGPT:** explore requirements, critique options, and prepare candidate designs.
  Chat discussions are proposals until checked against the repo and accepted through
  the workflow; they do not approve changes or advance assignment state.
- **Claude:** normally formalizes designs and implements the assigned scope.
- **Codex:** normally validates designs against the repo and independently reviews
  implementation diffs; may be architecture primary when explicitly assigned.
- **User:** sequences agents, selects routes, and approves work. Actual assignments
  and write ownership come from `HANDOFF.md` and `WORKFLOW.md`, not these defaults.

## Sources and project layout

- `PLAN.md`: product specification, architecture, and data contracts.
- `WORKFLOW.md`: roles, routing, gates, lifecycle, and handoff prompt requirements.
- `HANDOFF.md`: current assignment, baseline, review target, and next action.
- `DECISIONS.md`: accepted decisions and rationale; `BACKLOG.md`: deferred work.
- `CLAUDE.md`: project conventions and non-negotiables; `reviews/<id>.md`:
  append-only review evidence; `reviews/LEDGER.md`: assignment ID authority.
- Python fetchers live in `scraper/`, orchestration/generation in `build/`, static
  UI sources in `web/`, snapshots and metadata in `data/`, and checks in `tests/`.
  Edit source templates/JS/CSS and regenerate `web/index.html` when required.
- Verify chat claims and draft specs against current files. Surface contradictions
  with approved contracts before changing behavior; do not silently redefine policy.

## Working and handing off

Follow the preflight below: handoff first, exact diff second, relevant contracts
third. Use targeted searches and bounded reads; reuse unchanged context. Review
callers and dependencies affected by the diff, and keep correction reviews focused
on the correction delta. Report concrete findings and evidence, not full-file replay.

Use `WORKFLOW.md`'s user-mediated handoff flow and exact prompt requirements. Include
the assignment, baseline/target, bounded scope, required checks, results, unresolved
findings, and next owner. The primary reconciles reviewer recommendations; review
approval, user approval, commit, and push remain separate actions.

Keep one active assignment and one writer. Freeze primary edits during gate/review;
reviewers write only their designated records. Never overlap edits, commits, or
pushes across agents, or discard someone else's changes. Commit/push only with
user authorization and after checking current status and the intended diff.

## Validation ownership

The primary adds meaningful regression coverage for behavior changes and runs the
assignment's required checks. The reviewer independently reruns required checks
and probes relevant failure paths; a green gate is evidence, not proof of correctness.
Record exact commands/results and anything not verified. Typical offline checks,
run from the repository root, are:

```sh
.venv/bin/pytest tests/python/ -q
node --test tests/js/*.test.js
git diff --check
```

For UI/generation changes, verify the generated page as required by the assignment.
`make refresh` fetches live data and rewrites artifacts; it is not an offline test
and never commits. Keep live refresh work within the user's authorized scope.

# Codex participation

`WORKFLOW.md` is authoritative and complete — it contains every rule needed for daily operation,
including route selection, gate mechanics, and prompt construction. This file contains only
Codex-specific instructions: when to read `WORKFLOW.md`, which sections, and the write boundaries
for each role Codex may hold. It never restates a transition, a gate, or the route tables.

## Preflight

At the start of each assignment, and again after another agent or the user has acted:

Follow `WORKFLOW.md`'s contract-aware preflight in its stated order — the order is load-bearing, and
Codex-side it runs:

1. Read `HANDOFF.md` in full, **first**. It is capped at 25 lines and is the only artifact naming
   the diff or commit under review.
2. Inspect `git status` and read **that exact** diff, in full, before loading any other context.
3. Only then read what the diff makes necessary: acceptance criteria and the contract sections they
   reference, the governing `PLAN.md` section, `WORKFLOW.md`'s Roles / Choosing a route / Lifecycle
   sections, and the current review record — each sliced per `WORKFLOW.md`'s role- and state-aware
   slicing table for whichever role this assignment names. Do not re-read unchanged files wholesale.
4. Confirm the current assignment names Codex in the intended role and the intended route. If the
   runtime does not expose the selected model, state that it cannot be verified — do not claim a
   match.
5. When returning as primary after a review, reconcile any newer reviewer recommendation into
   `HANDOFF.md` before primary edits resume. If changes were requested, append the primary-owned
   response section required by `WORKFLOW.md` after corrections and verification are complete.

`AGENTS.md` is loaded at session start, not continuously. `HANDOFF.md` and review records change
during the workflow — re-read those state files explicitly rather than relying on session-start
context. After a `WF-###` change to `WORKFLOW.md`, start a fresh Codex session for automatic
instruction discovery.

When a closing response carries a standalone `Conversation: END` line — not part of any fenced
handoff prompt — that session is finished; see `WORKFLOW.md`'s *`END` closes the current thread* for
what the directive means. Codex-side, the practical consequence is that a fresh session reloads this
file and reads current state, instead of re-paying for a long scrollback.

## Architecture primary — `codex_sol` or `codex_sol_high`

- Work only on the bounded architecture or high-level assignment recorded in `HANDOFF.md`.
- Edit only the named design, roadmap, and handoff artifacts; do not implement production code in
  an architecture assignment.
- Preserve approved project constraints, source policy, frozen artifacts, and spent holdouts.
- Run the assignment's required verification, freeze edits, invoke the gate, then set the state the
  gate outcome dictates per `WORKFLOW.md`'s *The gate lives inside `draft`* and its allowed-transition
  table — never a state inferred here. Then stop editing.
- After review, independently verify every finding before resolving or rebutting it. Append only a
  `Primary response to review round N` section; never edit reviewer-owned or earlier sections.
- When corrections return the assignment to `review_requested`, end the response with exactly one
  fenced reviewer re-review handoff selected from `WORKFLOW.md`'s correction-delta route table. No
  prose follows the prompt.

## Implementation reviewer — `codex_terra`, `codex_luna`, or `codex_sol`/`codex_sol_high`

- Remain read-only except for the exact `reviews/<id>.md` path named in `HANDOFF.md`.
- Independently inspect the implementation, rerun every required verification check declared in
  `HANDOFF.md`, and add any checks the findings require. Record anything unavailable under `Could
  not verify`; do not recommend `APPROVE` without an explicit user waiver for an unperformed
  required check.
- Append reviewer-owned sections using `reviews/TEMPLATE.md`, including stable finding IDs and
  resolution statuses; never edit a primary response or an earlier section.
- **On `CHANGES_REQUESTED` for a Claude-owned assignment, emit exactly one Claude correction
  handoff** — make it the final content of the response. Scope it to reconciling `HANDOFF.md` to
  `changes_requested`, independently assessing and addressing the recorded findings, rerunning
  required verification, appending the primary response, and returning to `review_requested`.
- **On `APPROVE`, emit the reconciliation handoff** — a fenced prompt scoped to reconciling
  `HANDOFF.md` to `review_complete`, per `WORKFLOW.md`'s one-writer protocol. Codex cannot write
  `HANDOFF.md` itself.
- Report anything the diff **causes**, including breakage in files the diff does not touch; a
  pre-existing defect the diff neither introduces nor disturbs is a non-blocking observation. See
  `WORKFLOW.md`'s *Diff-first, on every reviewing turn* for the boundary.
- Before opening a round 3 or later, satisfy `WORKFLOW.md`'s *Round 3 requires a reason to exist*
  and name in `Why:` which condition applies; otherwise close the loop.
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
