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

The full protocol preserves the same review semantics as `prepare-validation`, `repo-validate`, and
`review-round`. Lifecycle states add orchestration, persistence, routing, and authority; they do not
redefine the underlying review model.

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

### Architecture exploration happens outside the protocol

The protocol governs assignments. It does not govern the thinking that precedes one. Unsettled
architecture, workflow, and strategy discussion — weighing approaches and discarding most of them —
is **out-of-protocol** work: it opens no assignment, allocates no ID, and writes no record.

Deliberately so. That discussion needs no repository access, so holding it inside a repo-grounded
agent pays for context it never reads. It belongs wherever the thinking is cheapest, including
outside this repository entirely.

What enters the protocol is a **coherent candidate design** — settled enough to be validated, not
presumed correct. Claude formalizes it into an `ARCH-###` assignment; Codex then performs the
repo-grounded validation: does this design hold against the dependencies, patterns, and constraints
actually present here?

**That validation can send the design back.** A repo constraint discovered at this step is a normal
outcome, not a failure of the exploration — it is the entire reason the step exists. Revision
returns to exploration; the candidate is never forced through because it arrived looking finished.

The operating split this produces:

| Where | Role |
| --- | --- |
| Out-of-protocol discussion | Architecture exploration and critique — needs no repo access |
| Claude | Formal drafting and implementation |
| Codex | Repo-grounded validation and diff verification |
| User | Sequencing and approval authority |

Only the last three are protocol parties. The first row names no agent because the protocol has no
authority over it: nothing there holds a role, writes a record, or receives a handoff prompt.

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
- **`low` is assigned to exactly one route, `codex_terra_low`** — a round-2-or-later correction
  re-review of an exact, deterministic text-or-format fix, matching the lightweight `/repo-validate`
  protocol's own `Codex Terra, effort low` tier for the same case. It is not a general-purpose or
  initial-review tier, and no other route selects it.
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

Every fenced handoff prompt opens with **five lines**, before the assignment content below. A
prompt addressed to a reviewer — inviting it to conduct or continue a review — carries a sixth,
`Review phase:`. This is the same conceptual header `prepare-validation`, `repo-validate`, and
`review-round` use for their own handoffs; `Action:` and `Review phase:` are this protocol's
equivalent of those skills' `Action:` and `Review phase:` fields, restated here because this
protocol's turns are lifecycle steps rather than skill invocations.

```text
Run as: Codex Terra, effort medium   (gpt-5.6-terra)
Why: IMP-008 round-1 implementation review — settled contract; focused runtime verification.
Conversation: START NEW — first independent review of this assignment.
Action: Review IMP-008
Review phase: INITIAL REVIEW
Goal: Add paired-baseline comparison to the backtest evaluator.
```

Claude-side, with the concrete way to set each field:

```text
Run as: Claude Sonnet, effort high   (/model sonnet; effort via --effort or settings.json)
Why: IMP-004 implementation — contract settled, one module; no trigger fired, claude_only.
Conversation: CONTINUE — same primary through corrections on this assignment.
Action: Implement IMP-004
Goal: Centralize candidate-pool selection between production and every evaluator.
```

- `Run as:` — the route's pinned model and effort.
- `Why:` — the route and the triggers that selected it. Never blank.
- `Conversation:` — `START NEW` or `CONTINUE`, per the boundary table below. **These are the only
  two values a handoff prompt may carry.** `END` is not a handoff value: it is a closing-response
  directive that appears on its own, outside any fenced prompt — see `END` closes the current thread.
- `Action:` — the specific step this turn performs, in a short verb phrase: `Review <id>`,
  `Correct <id> round N findings`, `Implement <id>`, `Reconcile HANDOFF.md to review_complete`. This
  names the step, never restates the objective — see `Goal:` below for that.
- `Review phase:` — present only when `Action:` hands the recipient a review to conduct: `INITIAL
  REVIEW` for a round-1 review, `REPO VALIDATION` for a round-2-or-later correction re-review, or
  `FINAL REVIEW` for a genuine final architecture approval pass. Absent on every primary-directed
  handoff, which has no review phase to name.
- `Goal:` — a **mechanical, byte-identical copy** of the assignment's `Objective` field, never a
  paraphrase. Orientation for whoever pastes the prompt, not a substitute for reading `HANDOFF.md`,
  the governing `WORKFLOW.md` sections, the relevant `PLAN.md` contract, or the full diff. A
  mismatch or omission fails prompt generation. `Action:` and `Goal:` never duplicate each other:
  `Action:` names the step, `Goal:` names the assignment's objective, and neither substitutes for
  the other.

This rule applies to every **agent-directed** handoff prompt. It does not apply to user-only
approval choices, which emit no agent prompt at all under the one-recipient rule.

### Conversation boundaries

`START NEW` and `CONTINUE` describe the **next recipient's** conversation. `END` describes the
**current** one. They therefore never compete for the same slot — see `END` closes the current
thread below.

| Situation | Directive |
| --- | --- |
| Opening a new assignment ID | `START NEW` (primary) |
| Reviewer, round 1 | `START NEW` — preserves context independence |
| Reviewer, round 2 | `CONTINUE` where practical — it already knows the findings |
| Primary through corrections and closure of the same assignment | `CONTINUE` |
| Architecture closes, implementation opens | `START NEW` |
| Assignment reaches `completed` or `abandoned` | `END` — close the thread; unrelated work opens a new one |
| Repository, objective, or evidence base changes | `START NEW` |
| Active conversation grows long and tool-heavy | Emit one compact handoff, then `START NEW` |

Not a fresh conversation after every handoff — that discards useful same-assignment context.

### `END` closes the current thread

`START NEW` and `CONTINUE` both address the *next* recipient. `END` addresses the **current**
conversation, and it is the only directive that does: it says this thread's scope is finished and
nothing further should be asked of it.

Emit it when an assignment reaches `completed` or `abandoned`, as a **standalone line in the closing
response** — never as a field inside a fenced handoff prompt, and never accompanied by `Run as:`,
`Why:`, or `Goal:`, which describe a recipient `END` does not have:

```text
Conversation: END — assignment complete; do not continue this thread for unrelated work.
```

It reuses the `Conversation:` label because it answers the same question a reader is scanning for.
It is not the four-field block, and a prompt generator or validator must not treat it as one.

An `END` line is not a handoff prompt and names no recipient, so the one-recipient rule is untouched
— `END` closes a thread rather than addressing one. The next assignment is opened in a new
conversation, composed from `HANDOFF.md` and the review record, never from this thread's scrollback.

**`END` and `START NEW` never collide**, because a response carrying `END` emits no agent handoff
prompt. At `completed` and `abandoned` the one-recipient rule already makes the closing response
user-directed: it awaits the user's sequencing decision and has no eligible agent to address. So the
successor assignment's prompt — `Conversation: START NEW`, per the row above it — is not composed
here at all. It is composed once the user has chosen the next task, by the new conversation that
reads current state. The boundary table's `START NEW` rows and its `END` row describe two different
responses, not two candidate values for one field.

This is also what the closing response's list of next tasks is for. Those three tasks are picked up
in a **new** conversation; listing them is not an invitation to start one here.

### Why in-place model switches get expensive

Switching the active model mid-conversation (`/model` on the Claude side; relaunching Codex under a
different route without closing the session) forces the new model to rebuild the KV cache for
everything already in that window. Cost scales with how much is already cached, not with the switch
itself: early in a small conversation this is a non-event; once the window has grown to hundreds of
thousands of tokens, an in-place switch costs far more than ending the conversation and starting
fresh. Measured session data showed in-place switching dominating the bill — millions of creation
tokens across a run, against tens of thousands to re-cache after a fresh start.

This is why most rows above resolve to `START NEW` rather than `CONTINUE` at a route change — a
different route usually means a different model. `CONTINUE` is never license to swap models in place
once the conversation has grown large: if a `CONTINUE` conversation is long and the next step's route
needs a different model, that **is** the "active conversation grows long and tool-heavy" case —
emit one compact handoff, then `START NEW`, rather than switching in place.

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
| `codex_luna` | Luna | medium | Narrow spot-checks; cross-file documentation consistency; batched sampling audits |
| `codex_terra_low` | Terra | low | Round-2-or-later correction re-review of an exact, deterministic text-or-format fix only — never an initial-review route |
| `codex_terra` | Terra | medium | Implementation correctness; runtime probes; negative paths; suspiciously green tests |
| `codex_sol` | Sol | medium | Repo-grounded validation of a candidate design; plan review; bounded policy analysis |
| `codex_sol_high` | Sol | high | Final architecture approval review; unresolved ambiguity; statistical methodology; security/privacy; broad system audits |

**Selection is total:**

1. Select the primary route from the work.
2. Apply the hard triggers below to decide `claude_only` versus Codex.
3. If Codex is required, select the verification route: exact or narrow independent check → Luna ·
   implementation or runtime probe → Terra · candidate-design validation or policy → Sol medium ·
   final architecture, statistics, security, or broad audit → Sol high.
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
4. If changes are requested, the reviewer stops after recording them. When the assignment's primary
   route is Claude, the reviewer's final response ends with exactly one fenced Claude correction
   prompt: it hands back only the recorded findings, names the assigned Claude primary route, and
   directs that primary to reconcile `HANDOFF.md` to `changes_requested`, independently assess and
   address each finding, rerun required verification, append its response, and return the assignment
   to `review_requested`. No prose follows that prompt. The primary reconciles `HANDOFF.md`,
   independently verifies each finding and records its factual assessment, makes accepted corrections
   or escalates per **Review records**' escalation triggers, reruns required verification, and
   appends a primary-owned response section covering every finding ID. It never edits a reviewer-owned
   section, then returns the assignment to `review_requested`. When it does, the primary's final
   response ends with exactly one fenced reviewer re-review prompt. Select its Codex route from the
   correction delta table, provide the round-2 slice, and state `REPO VALIDATION`; no prose follows
   that prompt.
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

| Correction delta | Route |
| --- | --- |
| Exact text or format, deterministic proof | `codex_terra_low` |
| Ordinary implementation, docs, or config correction against an already-agreed contract | `codex_terra` |
| Correction that changes or reopens the design, contract, or policy itself | `codex_sol` |
| User-directed revision after a prior approval recommendation | Original route, mandatory |

Classify by what the correction actually changed, never by the finding's original class or the
previous round's route — route the correction, not its history. A rebuttal, a scope expansion, or a
new behavioural claim is routed by whichever of the first three rows its actual delta matches; none
of them is a route of its own. Final architecture approval is not a correction re-review: route it
as `codex_sol_high` under **Choosing a route**, in a fresh review (`START NEW`), never through this
table.

**De-escalation requires a clean verification record.** Round 2 may drop a tier only when round 1
recorded an **empty `Could not verify`** and every required verification was performed first-hand
with no outstanding waiver.

The round-2 prompt carries only: the original finding blocks, primary dispositions, the correction
diff, the exact checks proving resolution, outstanding user decisions, unresolved non-blocking
observations, user-directed revisions since the preceding review, and the contract sections the
correction delta makes load-bearing — not the full set the round-1 prompt carried.

### Round 3 requires a reason to exist

Rounds are not free — each one re-reads a diff and re-derives context. After round 2 the loop closes
by default. A round 3 or later opens only when one of these holds, and the prompt's `Why:` names
which:

| Condition | What it means |
| --- | --- |
| A named unresolved risk | Round 2 recorded a specific finding it could not resolve — a concrete risk, not general unease |
| Newly introduced material change | The correction added behaviour or scope beyond what round 2 reviewed |
| Failed verification | A required check ran and did not pass |
| Explicit user request | The user asked for a further round |

With none of them firing, the loop closes: the reviewer recommends `APPROVE`, or the assignment goes
to `blocked_on_user` for a decision the reviewer cannot make. **"One more look to be safe" is not a
condition — it is the absence of one.** A reviewer that cannot name which row it is invoking has
already answered the question.

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

At the start of each assignment, and again after another agent or the user has acted. **The order is
load-bearing: each step scopes the next, and the diff cannot scope anything until `HANDOFF.md` has
named which diff it is.**

1. Read `HANDOFF.md` in full, **first** — its assignment block is capped at 25 lines, so this is
   cheap, and it is the only artifact that names the diff or commit under review.
2. Inspect `git status` and read **that exact** diff, in full. Every step below is scoped by it.
3. Read acceptance criteria always, and the contract sections they reference — scoped per
   **Diff-first** below.
4. Read `PLAN.md` when it **governs** the work — keyed on the objective and acceptance criteria,
   never on whether the diff happens to touch `PLAN.md`.
5. Slice `WORKFLOW.md` and `reviews/<id>.md` by role and state (below), not by an arbitrary tail.
6. Confirm the assignment names this agent in the intended role and route. If the runtime does not
   expose the selected model, say so rather than claiming a match.
7. When returning as primary after a review, reconcile the latest reviewer recommendation into
   `HANDOFF.md` before editing assignment artifacts.

Reading any of steps 3–5 before step 2 is the failure this ordering exists to prevent: context
loaded before the target is known is context loaded against the wrong scope, and a diff inspected
before `HANDOFF.md` names it may be the working tree's default rather than the assignment's.

### Diff-first, on every reviewing turn

Step 2 is the reviewed diff, and steps 3–5 are scoped **by** it — step 1 exists only to identify
which diff that is. Read the diff before the context; then read only the unchanged contract or
context sections needed to judge what it does. Do not re-read unchanged files wholesale — a file the
diff does not touch is read in the narrow slice that validates the change, or not at all.

This is a token rule with a correctness edge: a reviewer that re-reads everything spends its budget
reconstructing what it already reviewed.

**Narrow reading, not narrow responsibility.** The unit of review is the diff's *blast radius*, not
its line range. Anything the diff causes is a finding against this assignment — including breakage
in code the diff never touched. A changed signature, contract, invariant, schema, or return type
that breaks an unchanged caller is exactly such a finding, and tracing that call graph into
unchanged files is **required**, not a scope violation. Diff-first says start from the diff and read
outward only as far as the change reaches; it never says stop at the diff's edge.

What diff-first does exclude is the **pre-existing** defect that the diff neither introduces nor
disturbs. That is a non-blocking observation, and it belongs in a new assignment rather than in this
one's findings.

Repo-grounded validation is likewise unaffected. Checking a candidate design against the
dependencies, patterns, and constraints already present here means reading unchanged code by
definition — that is the assignment's purpose, not a breach of its scope.

Every reviewer-directed handoff prompt carries the instruction explicitly, in the prompt body:

```text
Review the git diff for this assignment. Read surrounding or unchanged sections only where needed
to validate that diff. Do not re-review unchanged sections — they were covered in a prior round or
fall outside this assignment.
```

Round 2 and later narrow it further, to the correction delta named in **Round 2 is targeted**.

### Role- and state-aware slicing

| Actor and state | Chunks required |
| --- | --- |
| Primary opening an assignment | Lifecycle and allocation sections; current handoff; governing contract section |
| Pre-gate | Handoff acceptance criteria and required verification; full diff; the contract sections the diff makes load-bearing |
| Reviewer, round 1 | Handoff; assignment header; full diff; reviewer rules; the contract sections the diff makes load-bearing |
| Primary addressing findings | Latest review round; complete finding blocks; current handoff; correction-relevant contract sections |
| Reviewer, round 2 | Assignment header; original finding blocks; primary dispositions; correction diff; outstanding `Could not verify`; unresolved non-blocking observations; user-directed revisions since the preceding review; the contract sections the correction delta makes load-bearing |
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
review record — the diff, `HANDOFF.md` and the contract sections the slicing table scopes remain the
caller's to read. This is not a style preference: it is the difference between "outside the
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
- The assignment header may declare **`Finding disposition schema`: `factual-assessment/v1`** —
  written once, at header creation, never edited, same discipline as the protocol schema marker
  above. This is the explicit compatibility boundary for the two rules below, and it is narrow:
  `.cross-agent-workflow/finding_state.py` mechanically enforces only that the field is *present*
  on every disposition (when the schema declares it) and that its *token* is internally
  consistent — one of `confirmed | refuted | partial | not_verified`, and not self-contradictory
  against the action disposition (see below). It does **not** and cannot verify whether the
  evidence behind a `refuted` assessment is real or adequate, or whether a `partial` assessment's
  prose actually states what was confirmed versus what remains uncertain — that is a first-hand
  review question for whoever reads the record, exactly as it always was. A record with no schema
  field — every one written before this field existed — is legacy: the rules below still apply as
  guidance, but the field is optional and the parser only cross-checks its token when present; its
  absence is not an error.
- **Every disposition separates two judgments.** The *factual assessment* — what independent
  verification actually established, `confirmed | refuted | partial | not_verified` — is distinct
  from the *action disposition* on the heading, `accepted | rebutted | blocked_on_user`. Under
  `factual-assessment/v1`, every disposition must state one, mechanically checked for presence and
  token validity only. `partial` is not a hedge: it requires stating exactly what portion was
  confirmed and what remains uncertain or needs a user decision — content no parser checks, so the
  primary and reviewer are the actual guarantee here, not the schema marker. `not_verified` is not
  `partial` either: `partial` says a substantive part of the claim holds and a substantive part does
  not; `not_verified` says the claim cannot be established either way from the available repository
  evidence or permitted verification. Do not write `partial` merely because evidence is
  inconclusive.
- **A rebuttal must be backed by evidence, not asserted.** `rebutted` requires a `refuted` factual
  assessment citing the independent verification that contradicts the reviewer's claim. Whenever a
  factual assessment is present, the parser rejects the token pairing `rebutted`/`confirmed` and
  `accepted`/`refuted` as self-contradictory — but it cannot confirm the cited evidence is real,
  only that the labeling is not internally inconsistent. Neither the reviewer's finding nor the
  primary's counterclaim is treated as fact without evidence — a primary that disagrees without
  contradicting evidence records `blocked_on_user`, never `rebutted`.
- **A `not_verified` disposition requires `blocked_on_user`, unless explicitly marked
  user-directed.** Evidence that cannot be established either way is never a basis for the primary
  to *autonomously* accept a finding as real or rebut it as false; the parser rejects a
  `not_verified` disposition paired with anything but `blocked_on_user`. Once the user explicitly
  resolves that block (see the escalation trigger below and `blocked_on_user`'s `resume_state`
  transition in Lifecycle), the primary may record a further disposition for the same finding —
  `accepted` to carry out the user's instruction, never `rebutted`, since resuming under a user
  decision is not evidence contradicting the claim. That disposition still states `not_verified`,
  unless new evidence actually changed the assessment: a user authorizing a correction does not make
  the claim `confirmed`, and the disposition must carry **`Action authority`: `user_directed`**,
  stating explicitly that the action rests on the user's decision rather than on evidence. The
  parser requires **both** conditions before accepting the pairing — the marker, and a prior
  `blocked_on_user` disposition recorded somewhere earlier for the same finding (not necessarily the
  immediately preceding event; a legitimate intervening record, such as a reviewer round that ran
  before the user's decision was logged, does not break this). Event adjacency alone is **not**
  accepted as proof: the parser does not read the user's instruction or verify the lifecycle
  transition, so an unmarked disposition landing directly after `blocked_on_user` is exactly as
  unauthorized-looking as any other autonomous one, and is rejected. Optionally, and recommended for
  auditability, the disposition may also carry **`User decision`**: a concise statement of what the
  user decided, or a pointer to where it is recorded — not mechanically checked, the same trust
  boundary as every other content field here.
- **Escalate before editing** — record the finding `blocked_on_user` and make no edit until the
  user decides — when any of these hold. Every other finding, including every `confirmed` finding
  accepted for correction, proceeds through the normal verify → correct → validate → re-review
  loop with no per-finding user gate — deliberately: the user already authorized this bounded
  assignment and its correction loop, unlike a lighter-weight review protocol with no persistent
  assignment authority of its own, which asks before every fix:
  - The primary's independent verification and the reviewer's evidence remain in conflict (a
    materially disputed finding).
  - The correction would change policy or scope.
  - The correction would materially expand the diff.
  - The correction would affect architecture, security, or data.
  - The finding or its correction conflicts with evidence already established elsewhere in the
    assignment — the governing contract, prior verification, or an earlier round.
  - Independent verification reaches a `not_verified` factual assessment and no prior
    user-authorized resumption applies — the claim cannot be established either way from available
    evidence, so it is not a basis for the primary to autonomously record `accepted` or `rebutted`.
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
