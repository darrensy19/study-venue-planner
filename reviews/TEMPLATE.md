# Review, gate, and audit record schemas

Three distinct artifact types share this file because they share one discipline: append-only,
role-owned sections, never edited or reordered after being written. Create or append only the
sections owned by the active role; never copy unused placeholders into a live record.

## Review records (`reviews/<id>.md`)

One file belongs to one assignment. Seal the record when the assignment becomes `completed` or
`abandoned`.

### Reviewer creates: assignment header

```markdown
# Review record: <assignment-id>

## Assignment

- **Assignment ID**: `<assignment-id>`
- **Work type**: `<workflow | architecture/high-level | implementation>`
- **Primary route**: `<route>` — `<model>`, effort `<level>`
- **Reviewer route**: `<route>` — `<model>`, effort `<level>`
- **Baseline commit**: `<sha>`
- **Reviewed diff or commit**: `<exact files, diff, tree hash, or sha>`
- **Scope**: `<what is included and excluded>`
- **Finding disposition schema**: `factual-assessment/v1`
```

The reviewer creates the header once. Neither role later edits it; a changed review target is
identified in the next review round.

**`Finding disposition schema`** is the compatibility boundary for the `Factual assessment` field
below: on a record that declares `factual-assessment/v1`, every disposition must carry the field,
and `.cross-agent-workflow/finding_state.py` fails open on one that omits it. A record with no such
field — every one written before this field existed — is read as legacy: the factual assessment
stays optional there, exactly as it always has. Same discipline as `WORKFLOW.md`'s own protocol
schema marker: written once, at header creation, never edited afterward.

What the schema and the parser check is narrow: that the field is *present* and that its token is
one of `confirmed | refuted | partial | not_verified` and not self-contradictory against the
disposition heading — `not_verified` is only legal paired with `blocked_on_user`, since evidence
that cannot be established either way is never a basis for `accepted` or `rebutted`. Neither the
schema nor the parser can verify that a `refuted` assessment's cited evidence is real, or that a
`partial` assessment's prose actually states what was confirmed versus what remains uncertain —
that first-hand review is the primary's and reviewer's job, not something a Markdown parser can do.

### Reviewer appends: review round N

```markdown
## Review round <N> — <YYYY-MM-DD>

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `<route>`
- **Runtime model verification**: per the standing constant in `WORKFLOW.md`, unless this round
  deviates — then state how.
- **Reviewed artifact**: `<exact diff, tree hash, or commit>`

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `<assignment-id>-R<prior-round>-F<NN>` | `<resolved \| unresolved \| blocked_on_user>` | `<specific evidence>` |

Write `None — first review round.` when there are no prior findings.

### Findings

Order by severity. One block per finding. Round 2 is routed by correction delta and verification
completeness — see `WORKFLOW.md`'s "Round 2 is targeted, never skipped" section — never by a class
assigned here; no finding carries a routing tag.

#### `<assignment-id>-R<N>-F<NN>` — <Critical | High | Medium | Low> — <title>

- **Status at issuance**: `open`
- **Evidence**: `<file:line, command output, data result, or primary source>`
- **Impact**: `<what becomes incorrect, unsafe, ambiguous, or unreliable>`
- **Recommended correction**: `<specific action>`

If there are no findings, write `No findings.` explicitly. Put suggestions that do not block
approval under `### Non-blocking observations`; do not assign them finding IDs — but do not drop
them either, since a non-blocking observation is exactly what a user has previously promoted to a
required change.

### Verification performed

- `<all required checks rerun first-hand, plus finding-specific checks>`

### Could not verify

- `<unperformed check and reason, or None>`

An **empty** `Could not verify` with every required check performed is a precondition for round-2
de-escalation — see `WORKFLOW.md`.

### User decisions required

- `<decision and options, or None>`

### Recommendation

`<APPROVE | CHANGES_REQUESTED | BLOCKED_ON_USER>`

`APPROVE` requires every finding, including those issued this round, to be `resolved`, and every
required verification check to have run unless the user explicitly waived one. It recommends user
approval; it does not change the assignment to `user_approved`.

**If `APPROVE`, also emit the reconciliation handoff** — see `WORKFLOW.md`'s one-writer protocol,
step 5. The reviewer cannot write `HANDOFF.md`; the fenced prompt below the recommendation is what
gets the state to `review_complete` rather than leaving it silently stale.

---
```

### Primary appends: response to review round N

Append only after independently checking every finding, making accepted corrections, and rerunning
the assignment's required verification.

```markdown
## Primary response to review round <N> — <YYYY-MM-DD>

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `<route>`
- **Reviewed artifact after response**: `<exact diff, tree hash, or commit>`

### Finding dispositions

#### `<finding-id>` — `<accepted | rebutted | blocked_on_user>`

- **Factual assessment**: `<confirmed | refuted | partial | not_verified>` — what independent
  verification established, separate from what the primary decided to do about it. `confirmed`: the
  finding is real as reported. `refuted`: verification found evidence contradicting the reviewer's
  claim — cite it in Independent verification below; never rebut without this. `partial`: state
  exactly what portion is confirmed and what remains uncertain or needs a user decision — see
  `WORKFLOW.md`'s Review records section. `not_verified`: the claim cannot be established either way
  from available repository evidence or permitted verification — not a hedge for `partial`. A
  `not_verified` disposition requires `blocked_on_user` on the heading above, never `accepted` or
  `rebutted`, **unless** it carries `Action authority` (below) *and* the finding has previously
  recorded a `blocked_on_user` disposition — landing directly after that block is not, by itself,
  enough. The assessment stays `not_verified` unless new evidence actually changed it; a user
  authorizing a correction never upgrades it to `confirmed`.
- **Action authority**: `<user_directed, present only on a not_verified disposition resuming after
  an explicit user decision — omit otherwise>` — the explicit marker required for that pairing; the
  parser checks its presence and token, not whether the cited decision is real.
- **User decision** (optional, recommended for auditability): `<a concise statement of what the
  user decided, or a pointer to where it is recorded>`
- **Independent verification**: `<evidence checked before deciding — this is "I confirmed the
  finding was real," distinct from the Verification line below>`
- **Response**: `<why the finding is accepted, rebutted, or needs the user — must follow from the
  factual assessment above, not substitute for it>`
- **Changes made**: `<specific files/sections, or None>`
- **Verification**: `<checks and results — this is "I confirmed my fix worked">`

Repeat for every finding ID from the review round.

### User-directed revisions

- `<any revision the user directed that the review did not raise as a finding, or None>`

Include this section whenever the user directs a change after a review round —
`WORKFLOW.md`'s round-2 slice requires it, and `fantasy-hoops`' `WF-002` is the case that proves
why: the user withheld approval after an `APPROVE` and directed two changes the review had never
raised. Without a section for them, the next round's compact prompt drops them entirely.

### User decisions required

- `<decision and options, or None>`

### Re-review readiness

- **Ready for re-review**: `<yes | no>`
- **Reason**: `<short explanation>`

---
```

The reviewer then appends review round `N+1`, records each prior finding `resolved`, `unresolved`,
or `blocked_on_user`, and may issue new stable finding IDs. Neither role edits the primary response
after it is appended.

## Gate reports (`reviews/<id>-gate.md`)

The pre-gate subagent's own record — not a review, and never treated as one. One file per
assignment, sealed with it. The primary controls neither the brief below nor the verdict; the brief
is generated mechanically from `HANDOFF.md`'s acceptance criteria and required verification.

```markdown
# Gate record: <assignment-id>

## Gate invocation <N> — <YYYY-MM-DD>

- **Gate route**: `claude_sonnet`, effort high
- **Brief source**: generated from HANDOFF.md acceptance criteria + required verification

### Checks run

- `<each check, with the actual result — not a summary>`

### Could not verify

- `<unperformed check and reason, or None>`

### Not asked to check

- `<anything the generated brief did not cover, stated explicitly — this is what stops the primary
  laundering its own scope through a subagent it prompted>`

### Status

`<GATE_PASS | GATE_FAIL | GATE_INCONCLUSIVE>`

---
```

Every invocation is recorded, including superseded ones — after two non-`GATE_PASS` attempts, a
third invocation is prohibited by `WORKFLOW.md`, and the record is what makes a silent retry
visible.

## Audit reports (`reviews/audits/<date>.md`)

One file per sampling audit, covering the batch of `claude_only` assignments it sampled. Never
touches the sealed assignment records it reviews.

```markdown
# Sampling audit: <date>

- **Auditor route**: `codex_luna`, effort medium (escalated to `codex_terra` if noted below)
- **Assignments sampled**: `<id, id, id>`

## Per-assignment findings

### `<assignment-id>`

- **What the gate caught**: `<summary>`
- **What this audit additionally caught, if anything**: `<finding, or None>`
- **Severity**: `<Critical | High | Medium | Low | N/A>`
- **Should a routing trigger have fired?**: `<yes, name it | no>`
- **Did independent re-verification falsify a primary claim the gate had accepted?**: `<yes,
  describe | no>`

Repeat per sampled assignment.

## Outcome

- **Material findings**: `<count>` — each opens its own new assignment referencing this audit,
  never a direct edit here.
- **Rate change triggered**: `<yes, new rate and why | no>`

---
```
