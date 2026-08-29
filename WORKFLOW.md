# Cross-agent workflow

Protocol schema: cross-agent-workflow/v1

`WORKFLOW.md` is the single, complete, normative source for cross-agent collaboration in this
repository — including ID allocation, route selection, gate mechanics, and prompt construction.
`AGENTS.md` and `CLAUDE.md`'s cross-agent section are adapters: they may name lifecycle states and
role write-boundaries, but never define a transition, a gate, or the route tables. If a rule needed
for daily operation lived only in a reference file loaded by explicit invocation, it would be
unreachable on an ordinary turn — so nothing normative lives outside this file. `PLAN.md` remains
the product roadmap; `HANDOFF.md` remains the current assignment snapshot.

This file is edited only through a `WF-###` assignment, and the schema marker above is edited only
at that assignment's `user_approved` step — never while the change is still in `draft`, or the
assignment that changed the marker could not itself finish (see Assignment ID allocation).

## Roles

Two work-type categories, fixed, each with an ID series and a typical route pairing. The routes
themselves are selected per assignment under **Choosing a route** — this table is the starting
point, not the answer.

| Category | Typical primary | Typical verification | ID prefix |
| --- | --- | --- | --- |
| Architecture and high-level | `claude_opus` | `codex_sol` or `codex_sol_high` | `ARCH-###` |
| Implementation | `claude_sonnet` | `codex_terra`, or `claude_only` when no trigger fires | `IMP-###` |
| Changes to this workflow | `claude_opus` | `codex_sol_high` | `WF-###` |

`WF-###` is not a third category — amending the workflow is architectural work, using the
architecture pairing; the separate prefix keeps workflow amendments legible as their own series in
`reviews/`.

Architecture and high-level work means methodology, data-source policy, schemas, lineage,
evaluation and promotion policy, and any change that spans components or invalidates an approved
design.

## The three parties

Primary, reviewer, and user. The user is a participant in turn-taking, not merely a gate at the end.

| Party | May write | Authority |
| --- | --- | --- |
| Primary agent | Assignment artifacts, `HANDOFF.md`, `reviews/LEDGER.md`, `reviews/AUDIT-LOG.md`, its own `Primary response to review round N` sections | None over transitions |
| Reviewer agent | Only reviewer-owned sections of `reviews/<id>.md` | Recommends; never approves |
| Pre-gate subagent | Only `reviews/<id>-gate.md`, while the primary is frozen | Nothing — reports to the primary |
| User | Anything | Sole approval, sequencing, and model authority |

### One recipient per response

Every response ends addressed to exactly one party:

- Another agent is eligible → emit the fenced handoff prompt, and no question to the user.
- The user's input is required → ask the question, and emit no handoff prompt.

The rule binds whoever holds write authority over the assignment. A response carrying a user
question *and* a handoff prompt invites the next agent to start before the answer exists — two
writers on one assignment.

**The reviewer is narrowly exempt**, because it is read-only by construction and cannot create a
second writer. When only one of several findings needs a user decision, the reviewer may state that
question *and* emit a hand-back prompt whose permitted scope excludes the blocked finding — never
inviting the primary to advance the blocked portion.

### Return to sender

1. The asking agent states the question and stops. No handoff prompt.
2. The user answers **that agent** — the one that asked.
3. Only then does that agent incorporate the answer and emit the handoff prompt for the other agent.

If the question blocks an open assignment, the primary sets `HANDOFF.md` to `blocked_on_user` with
a concrete `blocked_reason` and the `resume_state` to restore. Questions arising before any
assignment is open need no lifecycle record.

### Subagents may hold only the pre-gate role

Neither the primary nor the reviewer may be a subagent. A role belongs to a named agent running
under a user-selected route. A subagent may hold exactly one role, the pre-gate:

| The pre-gate may | The pre-gate may not |
| --- | --- |
| Write exactly one path, `reviews/<id>-gate.md`, while the primary is frozen | Write any other file |
| Emit a terminal status and evidence | Recommend, approve, or advance the lifecycle |
| Report to the primary | Hold the primary or reviewer role |

An agent may still use read-only exploration inside its own turn — locating files, searching for a
symbol. What is never permitted: delegating a workflow role, or handing a review to a subagent.

**The verification ladder** — three tiers, ordered by cost, each catching what the previous cannot:

| Tier | Who | Independence | May write | May recommend |
| --- | --- | --- | --- | --- |
| Scripted checks | Deterministic, run by the primary | Total | Nothing | No |
| Pre-gate | Fresh-context Claude subagent | Context only | `reviews/<id>-gate.md` | No |
| Independent review | Codex — a different engine | Context and failure-mode | `reviews/<id>.md` | Yes |

A Claude subagent is genuinely independent by context — it did not write the work and is not
anchored to the reasoning that produced it. It is **not** independent by failure-mode: it shares
Claude's blind spots, so it cannot substitute for a different engine on the errors that matter most.

## Model variant vocabulary

A variant is model × effort. Both closed vocabularies.

| Model | Agent | Slug |
| --- | --- | --- |
| Fable | Claude Code | `claude-fable-5` |
| Opus | Claude Code | `claude-opus-5` |
| Sonnet | Claude Code | `claude-sonnet-5` |
| Sol | Codex CLI | `gpt-5.6-sol` |
| Terra | Codex CLI | `gpt-5.6-terra` |
| Luna | Codex CLI | `gpt-5.6-luna` |

Effort: `low`, `medium`, `high`, `xhigh`, `max` — identical vocabulary on both sides.

- **Sonnet is the Claude floor.** `claude-haiku-4-5` is excluded; work too small for Sonnet should
  not be an assignment at all.
- **`low` is unassigned.** No route selects it.
- **`xhigh`, `max`, and `ultra` are excluded entirely, for now** — not merely unrouted. No route
  selects them and no prompt may recommend them. Reinstating any of them as a selectable tier is
  itself a policy change, requiring a `WF-###` assignment, not a runtime override.
- **`ultra` is not a Claude effort level** — it is a `/code-review` cloud multi-agent mode. Never
  write it as an `effortLevel` value.

**How a prompt spells the Claude incantation.** `/model <name>` is a real in-session command.
Effort is set via the `--effort` launch flag or the `effortLevel` key in `settings.json` — there is
no `/effort` slash command; never write one into a prompt.

## Installed helpers

Three deterministic scripts live at `.cross-agent-workflow/` in this repository, installed by the
skill at setup and invoked by name throughout this file:

| Path | Purpose |
| --- | --- |
| `.cross-agent-workflow/gate_brief.py` | Generates the pre-gate's brief mechanically from `HANDOFF.md` |
| `.cross-agent-workflow/finding_state.py` | Typed-state reducer and role-aware context extractor for a review record |
| `.cross-agent-workflow/audit_due.py` | Computes `claude_only` sampling-audit due status from `reviews/AUDIT-LOG.md` |
| `.cross-agent-workflow/VERSION` | The protocol schema these scripts were installed for |

They are **copied into the project, not referenced from the skill directory**, for two reasons.
Codex cannot invoke Claude Code skills at all, so a path into the skill's own directory would be
unreachable for half the protocol's participants. And a bare `scripts/…` path would resolve against
whatever `scripts/` directory the project already has — silently running an unrelated same-named
file rather than failing.

`VERSION` must match this file's schema marker. A mismatch means the scripts and the protocol text
were installed at different versions; treat it exactly like an unrecognized schema marker — stop and
route to migration preflight rather than running a stale helper against current rules.

These scripts are stdlib-only Python 3 and need no installation step beyond being copied.

## Model recommendation protocol

### The rule

Every fenced handoff prompt opens with **four lines**, before the assignment content below:

```text
Run as: Codex Terra, effort medium   (gpt-5.6-terra)
Why: IMP-008 round-1 implementation review — settled contract; focused runtime verification.
Conversation: START NEW — first independent review of this assignment.
Goal: Add paired-baseline comparison to the backtest evaluator.
```

Claude-side, with the concrete way to set each field:

```text
Run as: Claude Sonnet, effort high   (/model sonnet; effort via --effort or settings.json)
Why: IMP-004 implementation — contract settled, one module; no trigger fired, claude_only.
Conversation: CONTINUE — same primary through corrections on this assignment.
Goal: Centralize candidate-pool selection between production and every evaluator.
```

- `Run as:` — the route's pinned model and effort.
- `Why:` — the route and the triggers that selected it. Never blank.
- `Conversation:` — `START NEW` or `CONTINUE`, per the boundary table below.
- `Goal:` — a **mechanical, byte-identical copy** of the assignment's `Objective` field, never a
  paraphrase. Orientation for whoever pastes the prompt, not a substitute for reading `HANDOFF.md`,
  the governing `WORKFLOW.md` sections, the relevant `PLAN.md` contract, or the full diff. A
  mismatch or omission fails prompt generation.

This rule applies to every **agent-directed** handoff prompt. It does not apply to user-only
approval choices, which emit no agent prompt at all under the one-recipient rule.

### Conversation boundaries

| Situation | Directive |
| --- | --- |
| Opening a new assignment ID | `START NEW` (primary) |
| Reviewer, round 1 | `START NEW` — preserves context independence |
| Reviewer, round 2 | `CONTINUE` where practical — it already knows the findings |
| Primary through corrections and closure of the same assignment | `CONTINUE` |
| Architecture closes, implementation opens | `START NEW` |
| After `completed` or `abandoned`, before unrelated work | `START NEW` |
| Repository, objective, or evidence base changes | `START NEW` |
| Active conversation grows long and tool-heavy | Emit one compact handoff, then `START NEW` |

Not a fresh conversation after every handoff — that discards useful same-assignment context.

### Advisory, always

A recommendation proposes; it never authorizes. The user runs `/model` or launches Codex with the
named route. If the runtime does not expose the active model, the agent says so rather than
claiming a match.

### Choosing a route

Two fields, chosen independently and recorded separately in `HANDOFF.md`: the **primary route**
(who does the work) and the **verification route** (who checks it). Effort is pinned per route — no
per-assignment effort judgment.

**Primary route:**

| Route | Model | Effort | Selected when |
| --- | --- | --- | --- |
| `claude_sonnet` | Sonnet | high | Bounded documentation; single-module implementation against a settled contract; standard test writing |
| `claude_opus` | Opus | high | Open design questions; cross-component implementation; adversarial probing |
| `claude_fable` | Fable | high | Large migrations; whole-system analysis where the analysis *is* the deliverable |

**Verification route:**

| Route | Model | Effort | Selected when |
| --- | --- | --- | --- |
| `claude_only` | — | — | No hard trigger fired; the gate is the whole verification |
| `codex_luna` | Luna | medium | Narrow spot-checks; cross-file documentation consistency; exact-correction verification; batched sampling audits |
| `codex_terra` | Terra | medium | Implementation correctness; runtime probes; negative paths; suspiciously green tests |
| `codex_sol` | Sol | medium | Iterative architecture critique, plan review, bounded policy analysis |
| `codex_sol_high` | Sol | high | Final architecture approval review; unresolved ambiguity; statistical methodology; security/privacy; broad system audits |

**Selection is total:**

1. Select the primary route from the work.
2. Apply the hard triggers below to decide `claude_only` versus Codex.
3. If Codex is required, select the verification route: exact or narrow independent check → Luna ·
   implementation or runtime probe → Terra · iterative architecture or policy → Sol medium · final
   architecture, statistics, security, or broad audit → Sol high.
4. If two verification tiers are plausible, take the higher and state the uncertainty in `Why:`.

**Hard Codex triggers** — mandatory when any fires; everything else may close `claude_only`,
provided the gate passes:

- Architecture, methodology, statistical evaluation, or workflow-policy change
- Schema, migration, destructive data operation, frozen artifact, spent holdout, or promotion decision
- Authentication, authorization, secrets, privacy, money, or external side effects
- Public interface, file format, compatibility contract, or shared cross-component invariant
- Production deployment, concurrency, idempotency, or dependency/supply-chain risk
- Correctness depends on negative or fail-closed paths, or on proving tests are not vacuous; **or a
  decision-bearing adequacy claim rests materially on synthetic fixtures** without representative,
  negative-path, or non-vacuity evidence (deliberately narrow — this does not fire merely because a
  test uses fixtures)
- Acceptance criteria are ambiguous or incomplete
- The Claude gate returns `GATE_INCONCLUSIVE`, or the primary rebuts a gate finding
- **The primary route was `claude_opus` or `claude_fable`** — closes the fixed-Sonnet-gate hole
- Any required verification is not reproducible from the final tree
- The user asks for critical or independent review

**Deviations:**

| Trigger | Proposed by | Proposal |
| --- | --- | --- |
| Architecture approved, implementation opening | Both agents, at the transition | Name the implementation primary and verification routes |
| Implementation hits an architecture defect | Implementation reviewer | Escalate: open a new `ARCH-###` on an architecture route |
| Complexity exceeds the current tier | Either agent, mid-assignment | Escalate the route, with the reason |

A deviation re-runs route selection from the base, not just the triggering step.

**De-escalation happens at assignment boundaries only, with one exception.** Mid-assignment,
escalation is permitted (it increases safety); de-escalation is not — the review record's `Primary
route` header is written once and never edited. Work that has genuinely turned mechanical should be
closed and reopened as a new assignment. **Exception:** a handoff whose entire scope is lifecycle
bookkeeping (reconciling `HANDOFF.md`, no assignment artifact touched) may de-escalate to
`claude_sonnet`; record the model actually used for that turn.

## Scaffolded artifacts

| Document | Tense | Mutability | Written by |
| --- | --- | --- | --- |
| `README.md` | Present | Rewritten | kickoff |
| `PLAN.md` | Forward-looking | Rewritten | kickoff |
| `SKILLS.md` | Present | Rewritten | kickoff |
| `DECISIONS.md` | Backward-looking | Append-only | kickoff |
| `CLAUDE.md` | Present | Rewritten; this skill appends one section | both |
| `WORKFLOW.md` | Policy | Stable | this skill |
| `AGENTS.md` | Policy | Stable | this skill |
| `HANDOFF.md` | Present | Replaced each assignment | this skill |
| `reviews/<id>.md` | Backward-looking | Append-only, then sealed | reviewer, per assignment |
| `reviews/LEDGER.md` | Backward-looking | Append-only, never edited | primary, at allocation |
| `reviews/<id>-gate.md` | Backward-looking | Append-only, sealed with the assignment | pre-gate subagent |
| `reviews/AUDIT-LOG.md` | Backward-looking | Append-only, never edited | primary, at every assignment close |
| `reviews/audits/<date>.md` | Backward-looking | Append-only | `codex_luna`, per sampling audit |
| `.cross-agent-workflow/` | Tooling | Replaced on protocol upgrade | this skill, at setup |

### Boundary rules

- **`HANDOFF.md` carries no rationale**, and its `## Current assignment` block is capped at **25
  lines**. `Objective` and `blocked_reason` are rationale-shaped by nature — the cap is what makes
  this checkable, since "no rationale" alone is a judgment that resolves toward writing more.
- **`PLAN.md` points to `DECISIONS.md`** rather than re-narrating superseded history — `PLAN.md` is
  rewritten in place, so rationale stored there for a superseded design is overwritten, not
  preserved.
- **`reviews/<id>.md` holds finding-level detail**, sealed when the assignment completes.
- **On assignment close, one summary entry goes into `DECISIONS.md`**, linking to `reviews/<id>.md`
  — one paragraph, not a copy of the review. **The primary also appends one `completed` event to
  `reviews/AUDIT-LOG.md`**, naming the assignment's actual verification route — this is the only
  input the sampling audit's due-status calculation reads. `reviews/LEDGER.md` is not touched at
  close; it records allocation only, permanently.

## Lifecycle

| State | Meaning | Active writer / next transition |
| --- | --- | --- |
| `draft` | The bounded assignment is being authored or implemented. | Primary; after the gate, moves to `review_requested` (trigger fired) or `approval_requested` (no trigger). |
| `approval_requested` | The primary has stopped editing and no review was required. | No artifact writer; waits for the user's decision. |
| `review_requested` | The primary has stopped editing and yielded a specific diff for review. | Reviewer; writes only the assignment's review record. |
| `changes_requested` | The latest review round has unresolved findings. | Primary; independently verifies and resolves or rebuts each finding, then returns to `review_requested`. |
| `review_complete` | The reviewer recommends approval and has no unresolved findings. | No artifact writer; waits for the user's decision. |
| `blocked_on_user` | A product, policy, risk, scope, or deadlock decision is required. | No agent proceeds beyond safe read-only verification until the user decides. |
| `user_approved` | The user explicitly approved the transition or closure. | Primary may record the decision and perform only the user-authorized close or commit actions. |
| `completed` | The assignment is closed and its final state is recorded. | Terminal; a new task requires a new assignment ID. |
| `abandoned` | The user ended or superseded the assignment without completion. | Terminal; preserve its artifacts and reason, and use a new ID if work resumes. |

No lifecycle state is ever implied.

### Allowed transitions

| From | Event | To |
| --- | --- | --- |
| `draft` | Gate `GATE_PASS`, no hard trigger fired. | `approval_requested` |
| `draft` | Gate `GATE_PASS`, a hard trigger fired. | `review_requested` |
| `draft` | Gate `GATE_FAIL`. | stays `draft` |
| `draft` | Gate `GATE_INCONCLUSIVE`. | `review_requested` or `blocked_on_user` |
| `draft` | Primary encounters a blocker requiring a user decision. | `blocked_on_user` |
| `approval_requested` | User requests review of the unchanged artifact. | `review_requested` |
| `approval_requested` | User requests revisions. | `draft` |
| `approval_requested` | User explicitly approves. | `user_approved` |
| `review_requested` | Reviewer recommends `CHANGES_REQUESTED`. | `changes_requested` |
| `review_requested` | Reviewer recommends `APPROVE`. | `review_complete` |
| `review_requested` | Reviewer recommends `BLOCKED_ON_USER`. | `blocked_on_user` |
| `changes_requested` | Primary appends its response, completes corrections, and reruns required verification. | `review_requested` |
| `changes_requested` | Primary records a finding as `blocked_on_user`. | `blocked_on_user` |
| `review_complete` | User requests revisions. | `draft` |
| `review_complete` | User explicitly approves. | `user_approved` |
| `blocked_on_user` | User resolves the recorded blocker. | Recorded `resume_state` |
| `user_approved` | User explicitly reopens the undelivered assignment. | `draft` |
| `user_approved` | User authorizes any required commit or close action and the primary records it. | `completed` |
| Any nonterminal state | User abandons or supersedes the assignment. | `abandoned` |

A transition not listed requires an explicit user decision and a `WF-###` amendment; an agent must
not invent one.

Only the primary edits `HANDOFF.md`. Because a reviewer is read-only outside its review record,
`HANDOFF.md` can briefly remain `review_requested` after the reviewer writes a recommendation —
before any other edit, the returning primary reconciles `HANDOFF.md` from that review record. It
may record a review outcome; it may not invent or alter one.

### The gate lives inside `draft`

There is no tenth state; the gate is a step within `draft`.

1. Primary completes the work and the scripted checks.
2. Primary **freezes assignment edits** and invokes the pre-gate.
3. The gate writes `reviews/<id>-gate.md` and emits a terminal status.
4. Primary copies that status **verbatim** into `HANDOFF.md` — never reinterpreted, summarised, or
   softened.

| Gate status | Hard trigger fired? | Next state |
| --- | --- | --- |
| `GATE_PASS` | no | `approval_requested` |
| `GATE_PASS` | yes | `review_requested` |
| `GATE_FAIL` | — | stays `draft` |
| `GATE_INCONCLUSIVE` | — | `review_requested`, or `blocked_on_user` |

**Retries.** After two non-`GATE_PASS` attempts, a third invocation is prohibited — route to Codex
or `blocked_on_user`. Every invocation is recorded, including superseded ones, so a repeated silent
retry is visible.

**Anti-laundering.** The primary controls neither the gate's brief nor its verdict:

- The brief is **generated by `.cross-agent-workflow/gate_brief.py <path-to-HANDOFF.md>`**, run before the gate
  subagent is invoked — not written freehand by the primary. The script parses the `## Current
  assignment` block mechanically and refuses (non-zero exit, nothing on stdout) if `Objective`,
  `Acceptance criteria`, or `Required verification` is missing or still placeholder-valued. Its
  output is what the gate subagent receives verbatim; a hand-narrowed brief is detectable because
  it will not match the script's output byte-for-byte.
- The gate emits its own `Could not verify` **and** `Not asked to check` lists.
- The record holds raw output, never a verdict the reviewer is invited to trust. Codex never trusts
  the gate's status and may rerun everything.

### One-writer protocol

1. In `draft` or `changes_requested`, only the primary edits assignment artifacts.
2. The primary completes the bounded task, freezes edits, runs the gate, records the exact diff and
   next action in `HANDOFF.md`, sets the state per the gate table above, and stops editing.
3. The reviewer independently verifies the claims and diff. It is read-only everywhere except the
   reviewer-owned sections of `reviews/<id>.md`, and never commits.
4. If changes are requested, the reviewer stops after recording them. The primary reconciles
   `HANDOFF.md`, independently verifies each finding and records its factual assessment, makes
   accepted corrections or escalates per **Review records**' escalation triggers, reruns required
   verification, and appends a primary-owned response section covering every finding ID. It never
   edits a reviewer-owned section, then returns the assignment to `review_requested`.
5. **Reaching `review_complete` requires a prompt, not a hope.** A reviewer recommending `APPROVE`
   emits a fenced prompt scoped to exactly one action — reconcile `HANDOFF.md` to `review_complete`,
   then stop and state the user's decision. `HANDOFF.md` is primary-writable only, so silence here
   would leave it reading `review_requested` while the recommendation sits in prose.
6. The primary records the user's decision. After any explicitly authorized commit or close action,
   it marks the assignment `completed` or records the next user-assigned task.

Primary and reviewer must not edit concurrently. This protocol depends on the user sequencing
turns; it is not a filesystem lock.

### Round 2 is targeted, never skipped

Route the re-review on the **correction delta**, never on a finding's class:

| Correction | Route |
| --- | --- |
| Exact text or format, deterministic proof | `codex_luna`, narrowly scoped |
| Small implementation correction with focused tests | `codex_terra` |
| Material code or policy change, rebuttal, scope expansion, new behavioural claim | Original reviewer route |
| User-directed revision after a prior approval recommendation | Original route, mandatory |

**De-escalation requires a clean verification record.** Round 2 may drop a tier only when round 1
recorded an **empty `Could not verify`** and every required verification was performed first-hand
with no outstanding waiver.

The round-2 prompt carries only: the original finding blocks, primary dispositions, the correction
diff, the exact checks proving resolution, outstanding user decisions, unresolved non-blocking
observations, user-directed revisions since the preceding review, and the governing contract
sections.

### User-mediated agent handoffs

Agents do not assume they can message or activate one another directly. Whenever a response makes
another agent the immediately eligible next actor, it ends with a ready-to-use fenced prompt — this
applies symmetrically to Codex-to-Claude and Claude-to-Codex handoffs.

Do not provide an agent prompt when no agent is eligible. `approval_requested` and `review_complete`
await the user's decision. During `blocked_on_user`, a prompt may hand off only safe, read-only
verification, explicitly prohibiting assignment writes and lifecycle advancement — never inviting
an agent to resume or advance the blocked assignment's writable work.

When an assignment reaches `completed`, the closing response also lists the next three real tasks
in priority order, labelled **Small** (≤5 min), **Medium** (5–15 min), or **Big** (15+ min), derived
from live governing documents — not invented to fill three slots. This list is advisory; it does
not open an assignment or override the user's sequencing authority.

### Exactly one active assignment, with no escape hatch

At most one assignment is active — no "unless the user authorizes otherwise" clause. `HANDOFF.md`'s
single `## Current assignment` block and the absence of a `deps[]` field both depend on this.
Concurrent work means closing one assignment and opening another.

**No dependency field.** Where an implementation assignment implements an approved architecture,
its `Objective` names that assignment in prose — "implement the schema approved in `ARCH-001`."
That is the whole relationship.

## Assignment ID allocation

IDs are `<PREFIX>-<NNN>`, zero-padded to three digits, `ARCH`/`IMP`/`WF` counted independently.

> The next ID for a prefix is one above the highest ever allocated for that prefix. IDs are never
> reused, never renumbered, and gaps are never filled.

`reviews/LEDGER.md` is the source of truth — not the `reviews/` directory listing (an
`approval_requested` assignment never gets a review file, so a directory-based count would recycle
IDs), not `HANDOFF.md` (replaced wholesale each assignment), not `DECISIONS.md` (an `abandoned`
assignment may never reach it).

```markdown
# Assignment ledger

Append-only. One row per allocated ID, written at allocation time, before any other
assignment artifact exists. Never edited, reordered, or deleted. Gaps are expected and
must never be filled.

| ID | Allocated | Work type | Objective (one line) |
| --- | --- | --- | --- |
| `ARCH-001` | 2026-08-29 | architecture/high-level | v1 session-record schema |
```

No outcome or state column — an edited file is not a trustworthy allocation record. State lives in
`HANDOFF.md`, outcomes in `DECISIONS.md`.

**Allocation procedure:**

0. **Before allocating, run `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`.** This is the sampling
   audit's forcing function — stated here because allocation is the one step every new assignment
   passes through, so this is the point where a due audit cannot be silently skipped. `DUE` means
   surface a visible warning to the user; it does not block allocation, per the sampling audit
   section's forcing-function rule.
1. Read `reviews/LEDGER.md`. Take the highest `NNN` for the requested prefix; `000` if none.
2. Add one, zero-pad to three digits.
3. **Append the ledger row first**, before writing `HANDOFF.md` or anything else. A session that
   dies mid-assignment burns an ID rather than allowing reuse; a burned ID is a legal gap.
4. If **either** `reviews/<new-id>.md` **or** `reviews/<new-id>-gate.md` already exists, stop and
   report — the ledger and the directory disagree.
5. **Re-read the ledger and confirm your row is the only row bearing that ID.** If another row
   carries it, stop and report. This read-back is what converts a concurrent-allocation collision
   into a stop condition rather than a silent one.

**Retrofit seeding** (migration preflight only): seed one row per prefix at the maximum found across
`reviews/`, `HANDOFF.md`, and `DECISIONS.md`, with `seeded` in the objective column. A floor, not a
reconstruction — an under-count self-corrects on the next allocation, since allocation only moves
up. Seeding is a write; it happens only after the user approves adoption.

## Contract-aware preflight

At the start of each assignment, and again after another agent or the user has acted:

1. Read the diff, in full, always.
2. Read acceptance criteria and the contract sections they reference, always.
3. Read `PLAN.md` when it **governs** the work — keyed on the objective and acceptance criteria,
   never on whether the diff happens to touch `PLAN.md`.
4. Slice `WORKFLOW.md` and `reviews/<id>.md` by role and state (below), not by an arbitrary tail.
5. Read `HANDOFF.md` in full — it is capped at 25 lines for the assignment block.
6. Inspect `git status` and the exact diff or commit named in `HANDOFF.md`.
7. Confirm the assignment names this agent in the intended role and route. If the runtime does not
   expose the selected model, say so rather than claiming a match.
8. When returning as primary after a review, reconcile the latest reviewer recommendation into
   `HANDOFF.md` before editing assignment artifacts.

### Role- and state-aware slicing

| Actor and state | Chunks required |
| --- | --- |
| Primary opening an assignment | Lifecycle and allocation sections; current handoff; governing contract section |
| Pre-gate | Handoff acceptance criteria and required verification; full diff; governing contract sections |
| Reviewer, round 1 | Handoff; assignment header; full diff; reviewer rules; governing contract sections |
| Primary addressing findings | Latest review round; complete finding blocks; current handoff; correction-relevant contract sections |
| Reviewer, round 2 | Assignment header; original finding blocks; primary dispositions; correction diff; outstanding `Could not verify`; unresolved non-blocking observations; user-directed revisions since the preceding review; relevant contract sections |
| Reconciliation after approval | Latest recommendation and current handoff only |

A reviewer does not need setup, migration, ledger allocation, kickoff integration, or every routing
example on every turn — slice `WORKFLOW.md` by heading the same way.

### The extractor is a typed state reducer

**Run `.cross-agent-workflow/finding_state.py`** rather than reading the record and reducing it by
eye. The exact command depends on what you need — the bare form prints reduced states only, and
does **not** produce the role-aware slice the table above describes:

| You are | Run |
| --- | --- |
| Checking finding states only | `.cross-agent-workflow/finding_state.py reviews/<id>.md` |
| Primary, addressing findings | `.cross-agent-workflow/finding_state.py reviews/<id>.md --emit-chunks --actor primary-correction` |
| Reviewer, round 2 or later | `.cross-agent-workflow/finding_state.py reviews/<id>.md --emit-chunks --actor reviewer-round2` |
| Reconciling after `APPROVE` | `.cross-agent-workflow/finding_state.py reviews/<id>.md --emit-chunks --actor reconciliation` |

`--actor` without `--emit-chunks` is rejected rather than ignored. The script only ever sees the
review record — the diff, `HANDOFF.md` and the governing contract sections named in the slicing
table remain the caller's to read. This is not a style preference: it is the difference between "outside the
model," genuinely deterministic, and an LLM performing the same reduction in its head, which can
make the exact mistake this reducer exists to prevent. The script exits non-zero with
`FULL_READ_REQUIRED: <reason>` on stderr, and nothing on stdout, for every fail-open case below —
that exit code is what "fail open to a full read" means operationally, not a suggestion to
double-check.

A finding carries three distinct status vocabularies:

```text
Reviewer issuance:     open
Primary disposition:   accepted | rebutted | blocked_on_user
Reviewer resolution:   resolved | unresolved | blocked_on_user
```

"Take the latest status line" is wrong: after a primary records `accepted`, the latest line reads
`accepted`, which means *awaiting reviewer confirmation*, not resolved. Reduce a typed sequence per
finding ID instead:

```text
open → primary_accepted | primary_rebutted | blocked_on_user
     → reviewer_resolved | reviewer_unresolved | blocked_on_user
```

**Fail open to a full read** on: an unknown finding ID; a duplicate issuance block; a missing
expected disposition or resolution; invalid ordering; unknown status vocabulary; or a lifecycle
state inconsistent with the reduced finding states. `.cross-agent-workflow/finding_state.py` implements every one
of these checks except the last (lifecycle-state consistency is checked by the caller against
`HANDOFF.md`, since the script only ever sees the review record).

### Hash-gated re-reads

Re-read a slice when its hash differs from the one **this session recorded on its own last read** —
never a digest stored in the file itself, which could be updated by whoever edits it. No recorded
hash, or any mismatch, forces a full read.

## Review records

- Every assignment reserves one permanent path: `reviews/<id>.md`, created from
  `reviews/TEMPLATE.md` only when review is required. If not required, `HANDOFF.md` records that
  fact and no placeholder is created — `reviews/<id>-gate.md` still exists regardless, since the
  gate runs on every assignment.
- If the path already exists for a different assignment, stop and request a new ID. Never replace
  or recycle it.
- The reviewer owns the assignment header, review rounds, findings, resolution decisions, and
  recommendations. The primary owns only `Primary response to review round N` sections. Neither
  edits, deletes, or rewrites an earlier section or the other's sections.
- Every finding receives a stable ID: `<id>-R<round>-F<NN>`. Never reused or renumbered.
- A finding begins `open`. The primary records `accepted`, `rebutted`, or `blocked_on_user`. The
  reviewer then records `resolved`, `unresolved`, or `blocked_on_user`, with evidence. Status
  history is appended, never mutated.
- **Every disposition separates two judgments.** The *factual assessment* — what independent
  verification actually established, `confirmed | refuted | partial` — is distinct from the
  *action disposition* on the heading, `accepted | rebutted | blocked_on_user`. `partial` is not a
  hedge: it requires stating exactly what portion was confirmed and what remains uncertain or
  needs a user decision.
- **A rebuttal must be backed by evidence, not asserted.** `rebutted` requires a `refuted` factual
  assessment citing the independent verification that contradicts the reviewer's claim. Neither
  the reviewer's finding nor the primary's counterclaim is treated as fact without evidence — a
  primary that disagrees without contradicting evidence records `blocked_on_user`, never
  `rebutted`.
- **Escalate before editing** — record the finding `blocked_on_user` and make no edit until the
  user decides — when any of these hold. Every other finding, including every `confirmed` finding
  accepted for correction, proceeds through the normal verify → correct → validate → re-review
  loop with no per-finding user gate:
  - The primary's independent verification and the reviewer's evidence remain in conflict (a
    materially disputed finding).
  - The correction would change policy or scope.
  - The correction would materially expand the diff.
  - The correction would affect architecture, security, or data.
  - The finding or its correction conflicts with evidence already established elsewhere in the
    assignment — the governing contract, prior verification, or an earlier round.
- `APPROVE` requires every finding resolved and every required check run, unless the user
  explicitly waived one. It recommends user approval; it does not change the lifecycle state.
- **`Runtime model verification` is a constant** — state it once here: *the runtime does not expose
  the selected model; the user's route selection is relied on unless the interface reports
  otherwise.* Record a round's own line only when it deviates from this constant.
- After `completed` or `abandoned`, the record is sealed. Reopening requires a new assignment and a
  review file that links to the earlier one.

## Stage gates and escalation

- Architecture must receive explicit user approval before its implementation assignment begins.
- An implementation primary that meets a missing or contradictory architectural decision stops,
  records it in `HANDOFF.md`, and escalates to the user. It does not silently redesign.
- The user may open a new architecture assignment; the blocked implementation assignment remains
  preserved rather than being quietly repurposed.
- Model or artifact promotion never rests on unit tests or reviewer opinion alone — it follows the
  predeclared, evidence-backed gates in `PLAN.md`.
- Every material claim inherited from another agent is independently checked against the cited
  files, commands, data, or primary sources before acceptance.
- A reviewer must not infer a policy change from a fact, preference, model confirmation, or
  ambiguous statement. Policy changes require an explicit user instruction or a `WF-###`
  assignment; if review cannot proceed without one, recommend `BLOCKED_ON_USER`.
- The assignment's declared required verification is the minimum for both primary and reviewer. Any
  check the reviewer cannot run is recorded under `Could not verify`; it must not recommend
  `APPROVE` unless the user explicitly waives it.

## Sampling audit of `claude_only` work

| Aspect | Rule |
| --- | --- |
| Selection | Every 4th `claude_only` completion by **permanent ordinal position** (1st, 2nd, 3rd, ... — assigned once, never recomputed from a filtered list) — computed by `.cross-agent-workflow/audit_due.py`, never derived from `reviews/LEDGER.md` |
| Timing | When three selected-but-unaudited ("pending") assignments accumulate, or the oldest pending one is 30+ days old, whichever first — both computed by the same script |
| Ownership | `codex_luna` writes `reviews/audits/<date>.md`; sealed assignment records are never touched |
| Sequencing | A user-sequenced, read-only turn — never concurrent with a primary writer |
| Escalation | To `codex_terra` only if Luna finds something material or cannot resolve it |
| Remediation | Any material finding opens a new normal assignment referencing the audit |
| Rate change | A missed High finding raises sampling to 1 in 2 until five consecutive sampled assignments show no Codex-only discovery, and tightens the implicated trigger |

Record per audit: what the gate caught, what Codex additionally caught, severity, whether a
trigger *should* have fired, and whether Codex's re-verification falsified a primary claim the gate
had accepted.

### Who writes which audit-log row, and when

The reviewer cannot write `reviews/AUDIT-LOG.md` — only the primary may. Without an explicit
handback, a legitimate audit would stay pending forever because nobody is assigned to close it.
The sequence, in order:

| Step | Actor | Writes |
| --- | --- | --- |
| 1. Assignment closes | Primary | `completed` row, naming the actual verification route |
| 2. Audit comes due | Primary | One `sampled` row per selected assignment, each carrying the same new `audit=<id>` token |
| 3. Audit runs | `codex_luna` | `reviews/audits/<date>.md` only — never the log |
| 4. Reconciliation | Primary | One `audited` row with that `audit=<id>` token, plus a `rate_changed` row if the audit's outcome triggers one |

Step 4 is a short, user-sequenced primary turn. It exists because steps 2 and 3 are done by
different actors with different write permissions, and an audit whose result is never recorded
looks identical to one that never ran.

**Ordering is enforced, not merely conventional.** `audit_due.py` rejects an `audited` row with no
preceding `sampled` row for its token, a `sampled` row naming an already-closed token, and any
token closed twice. Selection must precede audit, and each token closes exactly once.

**Forcing function.** `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md` runs as step 0 of the Assignment
ID allocation procedure above — the one point every new assignment passes through, so a due audit
cannot be silently skipped by omission. Never `reviews/LEDGER.md`, which stays a pure, permanently
immutable allocation record with no audit-relevant field on it. `DUE` is a **visible warning**, not
a hard block — a deliberate act rather than an unnoticed omission. The audit detects routing
failures and supports calibration; it does not bound the consequences of an unaudited miss.

## Document responsibilities

| File | Responsibility |
| --- | --- |
| `README.md` | Project overview, setup and rebuild guidance, architecture summary, standard commands |
| `WORKFLOW.md` | This file — authoritative roles, routes, gate, lifecycle, and ownership |
| `AGENTS.md` | Codex-specific participation instructions only |
| `CLAUDE.md` | Claude-specific participation plus existing repository conventions |
| `PLAN.md` | Durable product, model, validation, and promotion roadmap |
| `HANDOFF.md` | Current project state, one active assignment, one next action |
| `DECISIONS.md` | Append-only durable-decision log, linking to sealed review records |
| `reviews/TEMPLATE.md` | Schema for new review records, gate reports, and audit reports; not itself a record |
| `reviews/<id>.md` | Shared append-only audit record with role-owned sections for one assignment |
| `reviews/<id>-gate.md` | Pre-gate's own append-only record for one assignment |
| `reviews/LEDGER.md` | Append-only assignment-ID allocation record |
| `reviews/audits/<date>.md` | Sampling-audit records |

## What is not enforced automatically

- Files do not lock either agent out. The user must avoid concurrent turns.
- Markdown does not switch or verify models. The user selects the model; if an agent cannot observe
  its interface-selected model, it says so rather than claiming a match.
- `AGENTS.md` is loaded by Codex at session start, not continuously. Codex must explicitly re-read
  changing state in `HANDOFF.md` and the current review record; after a `WF-###` change to this
  file, start a fresh Codex session for automatic instruction discovery.
- No automation assigns IDs, advances lifecycle states, approves transitions, or commits changes.
  Those actions remain explicit and attributable.
