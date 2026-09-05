# Audit log

Append-only event history for the `claude_only` sampling audit. Kept separate from
`reviews/LEDGER.md` deliberately: allocation must never be edited once written, but sampling needs
to know which assignments completed, with which verification route, and whether they were sampled
— facts only known after the ID already exists. Splitting the two files lets both stay genuinely
append-only: `LEDGER.md` never gains a new column after the row is written; this file only ever
gains new rows, never edits an old one.

One row per event. Never edit, reorder, or delete a row — a correction is a new row, not a fix to
an old one. Dates are ISO `YYYY-MM-DD`.

| Date | Event | Assignment ID | Verification route | Detail |
| --- | --- | --- | --- | --- |
| 2026-08-30 | completed | IMP-001 | codex_terra | |
| 2026-08-31 | completed | ARCH-001 | codex_sol | |
| 2026-08-31 | completed | IMP-002 | codex_terra | |
| 2026-08-31 | completed | IMP-003 | codex_terra | |
| 2026-08-31 | completed | IMP-004 | codex_terra | |
| 2026-09-01 | completed | IMP-005 | codex_terra | |

## Event vocabulary

- **`completed`** — an assignment reached `completed`. Appended by the primary at closure, alongside
  the `DECISIONS.md` entry the boundary rules already require. `Verification route` is the
  assignment's actual route; `Detail` is empty.
- **`sampled`** — an assignment was selected for the sampling audit. **`Assignment ID` is the exact
  ID of the `completed` event it applies to** — matched by ID, never by date, since two events can
  share a calendar date. `Detail` **must** carry an `audit=<id>` token naming the audit it belongs
  to, e.g. `audit=2026-09-01`. A `sampled` row for an assignment with no prior `completed` event is
  rejected, as is one with no `audit=` token.
- **`audited`** — a sampling audit completed. `Assignment ID` is empty; `Detail` **must** carry the
  matching `audit=<id>` token plus the outcome, e.g. `audit=2026-09-01; no material finding`.
- **`rate_changed`** — the sampling rate moved. `Assignment ID` is empty; `Detail` **must** carry an
  `interval=<n>` token, e.g. `interval=2; missed High finding in audit 2026-09-01`. Without a
  machine-readable interval the escalation rule cannot be applied at all, so a `rate_changed` row
  lacking one is rejected rather than silently ignored.

**Selection and clearing are two different events.** `sampled` records that an assignment was
*selected*; only a matching `audited` row clears it from the pending list. An assignment that is
selected but whose audit never completes stays pending forever — which is the intended behaviour,
since the audit is the backstop and an abandoned one should keep showing as outstanding.

**Order is enforced.** Selection must precede audit: an `audited` row with no preceding `sampled`
row carrying its token is rejected, as is a `sampled` row naming a token that already closed, and
any token closed twice. All rows here are written by the **primary** — `codex_luna` writes only
`reviews/audits/<date>.md`. See `WORKFLOW.md`'s handback sequence for who writes what, when.

## Deriving audit-due status

**Run `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`** rather than computing this by
eye — the algorithm has three subtleties that are easy to get backwards, described below.

1. Number every `completed` event with `Verification route = claude_only` by its **permanent
   ordinal position** among such events, in document order: 1st, 2nd, 3rd, ... Because the log is
   append-only, this ordinal never changes for a given row once assigned — it does not get
   recomputed as other rows are added or as other assignments get sampled.
2. **Selected** = every ordinal that is a multiple of the interval in force when it landed
   (4, 8, 12, ... at the default interval of 4).
3. For each selected assignment, check for a `sampled` row carrying that **exact Assignment ID**
   whose `audit=<id>` token also appears on a completed `audited` row. **Pending** = selected
   assignments not yet cleared that way.
4. Due when `len(pending) >= 3`, **or** the oldest pending assignment's `completed` date is 30 or
   more days ago — whichever comes first. This handles "no prior audit exists yet" automatically,
   since it never reads a last-audit date at all; it only ever asks how long the oldest pending
   candidate has been waiting.

**The interval is not fixed at 4.** It starts at 4 and changes at each `rate_changed` event,
applying **forward only** — completions appended before the change keep the interval that was in
force when they landed. Applying a rate change retroactively would re-select historical ordinals and
break the permanence rule below.

**Why ordinals must be permanent, not recomputed from a filtered list.** An earlier version of this
rule counted "every fourth assignment **not yet sampled**" — i.e., it filtered out already-sampled
completions first, then counted position 4 in what remained. That is wrong: after completion 4 is
sampled, the remaining list is `[1, 2, 3, 5, 6, 7, ...]`, whose 4th entry is completion **6**, not
completion 8 — every completion after the first sample becomes a candidate almost immediately, and
the rate silently runs far hotter than "1 in 4." Assigning the ordinal once, from the full
unfiltered sequence, and never recomputing it, is what keeps the rate actually 1-in-4.

Continued from the row above (`IMP-005`) — split into a second table only because the reference
material above landed between them; document order, which is what `audit_due.py` reads, is
unaffected by the split.

| Date | Event | Assignment ID | Verification route | Detail |
| --- | --- | --- | --- | --- |
| 2026-09-03 | completed | ARCH-002 | codex_sol_high | |
| 2026-09-03 | completed | IMP-006 | codex_terra | |
| 2026-09-03 | completed | IMP-007 | codex_terra | |
| 2026-09-03 | completed | IMP-008 | codex_terra | |
| 2026-09-03 | completed | IMP-009 | codex_terra | |
| 2026-09-03 | completed | IMP-010 | codex_terra | |
| 2026-09-03 | completed | IMP-011 | codex_terra | |
| 2026-09-03 | completed | IMP-012 | codex_terra | |
| 2026-09-03 | completed | IMP-013 | codex_terra | backfilled 2026-09-04 — missed at original close |
| 2026-09-04 | completed | IMP-014 | codex_terra | |
| 2026-09-04 | completed | ARCH-003 | codex_sol | round 1 codex_sol, round 2 codex_terra, round 3 codex_terra_low (de-escalated per correction-delta table) |
| 2026-09-05 | completed | ARCH-004 | codex_sol_high | round 1 codex_sol_high, rounds 2-3 codex_sol (correction-delta table; no de-escalation below sol — each delta reopened the design/contract) |
| 2026-09-06 | completed | IMP-015 | claude_only | no hard trigger fired; pre-gate ran twice (invocation 1 GATE_FAIL, corrected; invocation 2 GATE_PASS) |
| 2026-09-06 | completed | IMP-016 | claude_only | no hard trigger fired; pre-gate GATE_PASS on invocation 1 |
