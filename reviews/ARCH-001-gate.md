# ARCH-001 pre-gate report

Role: pre-gate subagent (fresh context). Not primary, not reviewer. This record does not
recommend, approve, or advance any lifecycle state. Terminal status is reported at the end.

## Gate brief (verbatim)

```
# Gate brief

Generated mechanically from HANDOFF.md — not written by the primary.

- **ID**: `ARCH-001`
- **Objective**: Design the session-end/return-transport feasibility requirement — the decision model currently checks only that a venue is open at arrival, never whether transport still runs for the trip home afterward.
- **Acceptance criteria**: a recorded design covering what return-transport data is needed per origin/fallback, how "transport still runs home" is evaluated for Plan A and Plan B, how it composes with the existing feasibility tiers, and how it degrades when return data is unknown (must fail open to `unknown`, never assume last-mile transport is always available) — consistent with `CLAUDE.md`'s non-negotiables (no live data, no numeric seat probability, `AT_LEAST(0)`/`UNKNOWN` semantics)
- **Required verification**: design cross-checked for internal consistency against `plan.md`'s decision model and every relevant `CLAUDE.md` non-negotiable; no contradiction with frozen invariants
- **Baseline commit**: `9e19ebc`
- **Artifact under review**: `plan.md` (new "Getting home: session-end return transport" section, plus the amendments it forces) and `CLAUDE.md` (non-negotiables). Design only, no code. `decisions.md` gets its summary entry at close, per `WORKFLOW.md`'s boundary rules.
- **Scope exclusions**: implementation (a follow-up `IMP-###`); the existing arrival-side `resolve_hours`/`effective_close` machinery, unchanged unless the design requires it
```

## Method

Read in full: `git diff 9e19ebc` (757 lines, touching `CLAUDE.md`, `HANDOFF.md`, `plan.md`,
`reviews/LEDGER.md`), the new `plan.md` section "Getting home: session-end return transport"
(lines 729–1122) plus every place it forces amendments elsewhere in `plan.md`, and the new
`CLAUDE.md` subsection "Getting home (session-end return transport)" (lines 45–57). File:line
references below are to the current working tree.

---

## 1. Acceptance-criteria coverage, item by item

**(a) What return-transport data is needed per origin/fallback.**
Covered. `plan.md:447-493` ("Data contract") specifies a hand-maintained
`venues_meta.json["return_transport"][dest][mode]` block (`last_departure_band`, optional
`first_departure_band`, optional `by_weekday`, `basis`) plus a venue-level `holiday_return_policy`.
A worked JSON example appears twice (`plan.md:1021-1033` in the contract section and
`plan.md:1351-1362` in the `web/index.template.html` venue-schema example), and a field table at
`plan.md:1382-1383` (new bullets) restates it in the existing "What's in `venues_meta.json`"
section. Per-fallback coverage is explicit: `plan.md:1008-1010` — Plan B reads "its own
`return_transport` block", never Plan A's.

**(b) How "transport still runs home" is evaluated, for Plan A and for Plan B.**
Plan A: covered in full by the "Evaluating one bound" pseudocode (`plan.md:857-894`) and "The
return tier" (`plan.md:905-932`), run independently for `mid` and `upper`.
Plan B: covered by `plan.md:1000-1010` — "Plan B is evaluated with the **same machinery at the
fallback venue**, using the fallback's own `return_transport` block and its own `access[origin_a]`
mode set... Plan B's session end is `plan_b_arrival_* + duration`" — and by the parallel CLAUDE.md
bullet at `CLAUDE.md:54` ("its own `return_tier`, from **its own** `return_transport` block...").
Both directions present.

**(c) How it composes with the existing feasibility tiers.**
Covered: `plan.md:962-967` — `overall_tier = worse_of(hours_tier, return_tier)`, ordering
`robust > tight > shorter > unverified` — and mirrored verbatim in `CLAUDE.md:24`. The ranking
pipeline is updated accordingly (`plan.md` diff, "Feasibility tier" step now reads `overall_tier`).

**(d) How it degrades when return data is unknown — fail open to `unknown`, never assume transport
is always available.**
Explicitly addressed as a named design goal in several places: `plan.md:830-832` ("An **empty**
admissible set means no recorded way home. That is `unverified`, not `closed`"), the pseudocode's
step 3 (`plan.md:876-877`, "if every entry is missing: return UNVERIFIED"), step 4's
`pre_dawn_no_first_departure` branch, and the explicit non-conflation rule at `plan.md:918-923`
("`unverified` never resolves to `robust`, and missing data never reads as 'service exists.'"),
restated in `CLAUDE.md:53`. See §2 for a branch-by-branch trace rather than taking this claim on
faith.

All four acceptance-criteria items are recorded. Whether the recording is internally consistent
and non-negotiable-safe is a separate question — see §§2–5, where I found confirmed problems.

---

## 2. Fail-open trace — every branch of "Evaluating one bound" (`plan.md:857-894`)

```
1. core span               -> PASS(basis: core_span, margin: AT_LEAST(0))
2. schedule-free admissible -> PASS(basis: schedule_free, margin: AT_LEAST(0))
3. every schedule-bound entry missing -> UNVERIFIED(basis: no_data)
4. pre-dawn gap, no first_departure_band -> UNVERIFIED(basis: pre_dawn_no_first_departure)
4. pre-dawn gap, first_departure_band present -> MARGIN(session_end_b - first_departure_b)
5. ordinary case -> MARGIN(last_departure_b - session_end_b), last_departure_b = MAX over
   *present* entries
```

- Branches 3 and 4's "missing data" sub-cases correctly return `UNVERIFIED`, never a pass. Traced
  and confirmed no fail-open leak here.
- An **empty** admissible-modes set (e.g. rain removes `cycle`, no `transit` entry in `access`)
  routes through step 3's `entries = []`; "every entry is missing" is vacuously true for an empty
  list, which correctly yields `UNVERIFIED`. This reading is never stated in prose — it works only
  because of the implicit assumption that "every X in an empty set" is vacuously true — and I could
  not find this edge case named anywhere in the design text (see `Could not verify`). The
  **outcome** is right; the **specification** of that outcome is implicit, not explicit.
- Branches 1 and 2 are **not** missing-data branches — they are the two documented positive-evidence
  paths (a single global claim about the city's core service span, and admissible schedule-free
  modes). `RETURN_CYCLE_LATEST_MINUTES = null` (`plan.md:503`, "Provisional... `null` means no
  limit") means an admissible `cycle` return is currently unconstrained at any hour, including very
  late ones — this is disclosed as a known limitation ("Cycling home late at night is treated as
  unconstrained", `plan.md:1707`) rather than hidden, so I am not treating it as a fail-open
  violation, only noting it is a live, named gap.
- I found **no branch** where the absence of per-venue return data produces a `robust`,
  `passing`, or "service exists" result. The design's fail-open intent for the two per-venue
  `unverified` paths holds under trace.

**However**, the *composition* layer downstream of this pseudocode contains a confirmed defect —
see Finding 1 below — which is a correctness (not fail-open) problem: it computes tag-unsafe
arithmetic rather than mis-classifying missing data as present.

---

## 3. Non-negotiable consistency — confirmed findings

### Finding 1 (CONFIRMED) — `latest_leave_at` formula does untyped arithmetic on a tagged value, contradicting the "branch before arithmetic" invariant

`CLAUDE.md`'s frozen rule (unedited by this diff, in the "24-hour venue" / `effective_close`
paragraphs): *"`effective_close` returns exactly one of: a finite absolute close, `COVERED`, or
`UNKNOWN`... **Branch on the outcome before any arithmetic** — subtracting from a value that may
hold `COVERED`, `NONE` or `UNKNOWN` is a type error."*

`plan.md:948` states the general binding-limit formula:
```
binding_limit_b = min( effective_close_b - closing_buffer,  last_departure_b )
```
immediately followed (`plan.md:950-957`) by "Branch on the tags before any arithmetic, as
everywhere else" and a 6-row table that correctly branches on `effective_close_b ∈ {finite,
COVERED, NONE, UNKNOWN}` before computing `binding_limit_b`.

The next code block (`plan.md:963-966`) gives three formulas. The first two correctly route through
the already-branched `binding_limit_*`:
```
usable_minutes  = max(0, min(binding_limit_mid, arrival_mid + duration) - arrival_mid)
surplus_b       = binding_limit_b - (arrival_b + duration)
```
The third does not:
```
latest_leave_at = min( (effective_close_mid - closing_buffer) - duration - travel_minutes_mid,
                       last_departure_mid                     - duration - travel_minutes_mid )
```
This subtracts `closing_buffer` directly from `effective_close_mid` — the same tagged value the
table three lines above exists specifically to branch on. If `effective_close_mid` is `COVERED`
(the exact case this section's own narrative — "A `COVERED` venue can now have a real
`latest_leave_at`" — is built around) or `UNKNOWN`, this line is the type error CLAUDE.md's
non-negotiable explicitly names. The prose right after makes the same error explicit rather than
accidental: `plan.md:969-971` — *"`min(UNDETERMINED, finite)` is the finite value."* Treating
`UNDETERMINED` as a comparable operand inside a literal `min()` is precisely what "branch on the
tags before any arithmetic" forbids; the correct statement, given the table two paragraphs above,
is `latest_leave_at = binding_limit_mid - duration - travel_minutes_mid` (with `binding_limit_mid`
already resolved through the branch table, `COVERED` case included).

This is a direct, textual contradiction of a frozen invariant, inside the very artifact whose
required verification is "no contradiction with frozen invariants." Confirmed by direct
side-by-side quotation, not inference.

### Finding 2 (CONFIRMED) — the `basis` free-text field's own worked examples embed exact times and route information, contradicting "bands, not exact times"

`CLAUDE.md`'s frozen privacy rule: *"`data/venues_meta.json` carries no exact travel minutes and no
real origin names... This repo is public..."* and the new section's own privacy paragraph
(`plan.md:1055-1060`) states: *"Bands, not exact times — and the same privacy trade already
accepted... Coarsened to a five-minute band and accepted deliberately."*

The structured field (`last_departure_band`) is correctly banded. But the `basis` field — described
at `plan.md:1043` as free text "so a maintainer can re-check it against a published timetable" — is
populated, in **both** worked examples in this same diff, with exactly what the design says it will
never store:

- `plan.md:1029`: `"basis": "last train Beauty World -> home direction 23:31, plus a 6-8 min walk to the platform"`
- `plan.md:1357`: `"basis": "last train Beauty World -> home direction 23:31, plus a 6-8 min walk"`

`"23:31"` is an exact, un-banded time — the literal thing "bands, not exact times" prohibits. `"->
home direction"` is new route/directional information about the leg toward home, beyond what the
existing `access` rank-plus-band already discloses (rank and a coarse duration band say nothing
about *which line or direction* is taken). `plan.md`'s own privacy paragraph for this section
(`1055-1060`) discusses only the structured `last_departure_band` field's coarsening — it never
mentions the `basis` field at all, and does not acknowledge that the field it specifies (free text,
intended for timetable cross-checking) is, by its own stated purpose, an invitation to write exactly
this kind of precise, un-banded, directional information into a hand-maintained file this same
document repeatedly says is public. This is a confirmed gap between the stated privacy invariant and
what the design's own examples do under it.

(`"Beauty World"` itself, as a venue/area name, is **not** new information — it already appears as
an existing published venue name and `area` value at `plan.md:1264` and `:1339`, both outside this
diff. The new problem is the *exact time* and the *directional/route* framing attached to it, not
the station name in isolation.)

### Non-negotiables checked and found consistent

- **No live data / no fetcher**: `plan.md:788-790` ("Not a transit API... hand-maintained... exactly
  like `access`"), `plan.md:1090` ("It does not add a fetcher. No live transit source, now or
  later"), `CLAUDE.md:57` ("there is **no transit fetcher, now or later**"). Consistent.
- **`venues_meta.json` hand-maintained, never script-written**: `plan.md:1015-1016` ("hand-maintained
  block... never written by a script, merged at generation time"), `CLAUDE.md:57`. Consistent.
- **Brand-neutral naming**: `return_transport`, `last_departure_band`, `first_departure_band`,
  `holiday_return_policy`, `RETURN_CORE_FROM_MINUTES`, etc. — no brand names introduced. Consistent.
- **`NONE`/`UNKNOWN`/`COVERED` distinct, branched before arithmetic**: the binding-limit table
  (`plan.md:950-957`) itself is correctly branched; only the downstream `latest_leave_at` line
  violates the rule (Finding 1).
- **Absolute-minute arithmetic**: `plan.md:816-822` stores `last_departure_offset` from
  service-day midnight with `> 1440` meaning after-midnight, "exactly as `close`". Consistent.
- **`AT_LEAST(0)` consumed only by named accessors**: `plan.md:906-908` states `return_margin_*`
  "reuses... `passes_feasibility()`, `finite_shortfall()` and `sort_key()` without modification.
  Only `display()` needs a return-specific sibling." Whether a `display()` *sibling* is compatible
  with CLAUDE.md's literal "Exactly three accessors may consume it" is genuinely ambiguous from the
  text alone — flagged under §5, not counted as a confirmed contradiction, since the semantic
  contract (no numeric margin, no fallback to `sort_key()`) is explicitly preserved.

---

## 4. Internal consistency of the edited tree

### Finding 3 (CONFIRMED) — symbol-table naming inconsistency: `last_departure_lower` vs. the `_mid`/`_upper` convention used everywhere else, including by this same design

`plan.md:333` (the symbol table, itself added by this diff):
```
| `last_departure_mid`, `last_departure_lower` | derived | `venues_meta.return_transport[dest][mode].last_departure_band` |
```
Every other bound-pair in the same table uses `_mid`/`_upper`: `plan_a_arrival_mid`/`_upper`
(pre-existing), `fallback_travel_minutes_mid`/`_upper` (pre-existing), and, added by this very diff,
`session_end_mid`/`_upper` (`plan.md:334`), `return_margin_mid`/`_upper` (`plan.md:335`, whose own
right-hand side reads `last_departure_* − session_end_*`, presupposing `last_departure_upper`
exists), and `binding_limit_mid`/`_upper` (`plan.md:336`). The pseudocode itself (`plan.md:875`,
"Evaluating one bound") also uses generic `last_departure_b` for `b ∈ {mid, upper}`, and
`binding_limit_b = min(effective_close_b - closing_buffer, last_departure_b)` (`plan.md:948`) reads
`last_departure_b`, not `last_departure_lower`. Only the symbol-table row itself breaks the pattern.
This appears to be a drafting slip (conflating "the edge of the band selected" with "the name of the
bound"), but as written it is a genuine inconsistency an implementer must resolve by inference
rather than by reading the document.

### Finding 4 (CONFIRMED) — `backup_strength`'s `strong`/`salvage` grading diverges between `plan.md` and `CLAUDE.md`, and neither document states what happens when a fallback's return is `shorter` (verified but insufficient) rather than `unverified`

`plan.md`'s table (`plan.md:280-282`):
```
| strong  | ...robust or tight at its delayed arrival... and a robust or tight return_tier |
| salvage | ...the requested session does not fit — or it fits and the way home is unverified |
```
`CLAUDE.md:74` (this exact bullet is **not** touched by the diff — confirmed via `git diff`, only a
new bullet was inserted above it at `CLAUDE.md:73`):
```
`strong` = the requested session fits (`robust` or `tight`) at the fallback with confidence
≥ `PLAN_B_MIN_CONFIDENCE`.
```
`CLAUDE.md:74` never mentions `return_tier` at all; the new bullet at `CLAUDE.md:73` only states the
`unverified` → capped-at-`salvage` consequence. Read together, `CLAUDE.md` supports the inference
that a fallback whose hours fit and whose `return_tier` is `shorter` (a **known**, verified return
shortfall — the tier the design explicitly defines and gives a worked example for at
`plan.md:1236-1240`, "Starbucks Somewhere... gives 4h20m of the 6h you asked for") still qualifies
as `strong`, since `CLAUDE.md` only disqualifies `unverified`. `plan.md`'s table disagrees — its
`strong` row requires `return_tier ∈ {robust, tight}`, which **excludes** `shorter` — but neither
document's `salvage` row explicitly covers the `shorter` case either (`salvage`'s text names only
"does not fit" and "unverified", not "return is a known shorter"). Whether "the requested session
fits" in `plan.md`'s `strong` row is meant to be evaluated against return-capped `usable_minutes`
(in which case a `shorter` return already makes "does not fit" true and routes to `salvage`
automatically, closing the gap) or against hours alone (leaving a real hole with no defined outcome)
is not stated anywhere in the text. This is a genuine specification gap that would force an
implementer to guess, and a genuine cross-document divergence between the two governing files —
both squarely inside what "internal consistency of the edited tree" was asked to check.

### Checked and found consistent

- **Ranking order / `overall_tier` usage**: `CLAUDE.md:24` and the `plan.md` ranking-pipeline
  section agree; `overall_tier` replaces the bare "feasibility tier" consistently in both files
  everywhere I checked (ranking pipeline, decision-model bullet, Plan A/Plan B section, "no option"
  refusal wording).
- **`latest_leave_at`'s `UNDETERMINED` definition**: both files agree `UNDETERMINED` means "no known
  *closing* constraint", distinct from a last departure — consistent in wording, though the formula
  implementing it is the tag-unsafe one in Finding 1.
- **`UNDETERMINED`/`unverified`/`UNKNOWN` three-way distinction**: `plan.md:918-923` and
  `CLAUDE.md:53` state the same non-conflation rule in matching terms.
- **Testing lists**: both `CLAUDE.md`'s JS-testing paragraph and `plan.md`'s own testing section were
  extended with a large, overlapping "return transport" case list (core-span short-circuit,
  schedule-free positive evidence, `cycle` admissibility and rain removal, `origin_a` redirection,
  04:00 service-day boundary, pre-dawn gap, pessimistic-edge flip, `MAX` over admissible modes,
  `unverified` vs `UNKNOWN` ranking behaviour, binding-limit composition, `backup_strength` capping,
  `holiday_return_policy` independence). Both lists name only the `unverified`-capping case for
  `backup_strength`, never a `shorter`-return case — consistent with each other, but consistent in
  a way that reproduces Finding 4's gap rather than catching it.
- **Phase 1 acceptance criteria**: `plan.md`'s "Acceptance, in two parts" section was amended to
  require `return_transport` data only for sessions ending outside the core span, matching the
  design. Consistent.
- **`venues_meta.json` contract**: the schema example (twice) and the field-reference bullets agree
  on field names and shapes, aside from the privacy issue in Finding 2.

---

## 5. Ambiguity or under-specification

- **Finding 4 above** is the clearest implementer-blocking ambiguity: no stated `backup_strength`
  outcome for "fits on hours, return is `shorter`."
- **Empty admissible-modes set** (§2): the `UNVERIFIED` outcome is correct but relies on an
  unstated vacuous-truth reading of "every entry is missing" over an empty list; not spelled out.
- **`display()` accessor count** (§3): whether a return-specific `display()` sibling is permitted
  under CLAUDE.md's "Exactly three accessors may consume it" wording is not resolved by either
  document.
- **`last_departure_b` vs. `return_margin_b` conflation in `binding_limit_b`**: `plan.md:948`'s
  formula names its second operand `last_departure_b`, a point-in-time, but the branch table two
  lines later shows the return side can also be the tag `AT_LEAST(0)` (no point-in-time exists in
  the core-span/schedule-free case). The formula as literally written has no defined
  `last_departure_b` to plug in for that branch; the table's resolution ("`C - closing_buffer`",
  i.e. the return side contributes no constraint) has to be inferred rather than read directly from
  the formula. Related to, but distinct from, Finding 1.
- **`return_margin_*` symbol-table row** (`plan.md:335`) states only
  `last_departure_* − session_end_*`; it does not mention the reversed direction used by the
  pre-dawn branch (`session_end_b − first_departure_b`, `plan.md:879`). Minor, but the symbol table
  is incomplete for that case.

---

## Could not verify

- No implementation exists yet (design-only assignment, explicitly out of scope) — none of this
  design's pseudocode was executed; all findings above are from direct reading, not test output.
- Whether the vacuous-truth handling of an empty admissible-modes set (§2) is the design's actual
  intent, since it is never discussed in prose.
- Whether CLAUDE.md's "Exactly three accessors may consume it" (`AT_LEAST(0)`) permits or forbids
  the new return-specific `display()` sibling — the invariant's own wording does not resolve this.
- The real-world accuracy of "LTA's published service spans" underlying `RETURN_CORE_FROM_MINUTES` /
  `RETURN_CORE_UNTIL_MINUTES` — the design itself lists this as an open, provisional question
  (`plan.md:1741`) and I performed no external lookup, since the brief's required verification is
  internal-consistency and non-negotiable cross-checking, not fact-checking a transit timetable.

## Not asked to check

- Implementation of any of this (explicit scope exclusion; a follow-up `IMP-###`).
- The existing arrival-side `resolve_hours`/`effective_close` machinery's own correctness — the
  design does not modify its definition, only composes with its output, so it was out of scope per
  the brief.
- `decisions.md`'s close-time summary entry (not yet written; written at close per `WORKFLOW.md`'s
  boundary rules, not part of this gate).
- `HANDOFF.md` and `reviews/LEDGER.md`'s own diffs (bookkeeping, not part of the acceptance
  criteria or required verification named in the brief).
- Route/trigger selection correctness (`claude_opus` primary, `codex_sol` verification) — a
  `WORKFLOW.md` process question, not part of this design's acceptance criteria.

---

## Terminal status

`GATE_FAIL`

---
---

## Invocation 2

Role: pre-gate subagent (fresh context, no memory of invocation 1). Not primary, not reviewer.
This record does not recommend, approve, or advance any lifecycle state. Every claim below was
checked first-hand against the current working tree — invocation 1's findings and the primary's
claimed corrections were both re-verified from the files, not taken on faith.

## Gate brief (verbatim)

```
# Gate brief

Generated mechanically from HANDOFF.md — not written by the primary.

- **ID**: `ARCH-001`
- **Objective**: Design the session-end/return-transport feasibility requirement — the decision model currently checks only that a venue is open at arrival, never whether transport still runs for the trip home afterward.
- **Acceptance criteria**: a recorded design covering what return-transport data is needed per origin/fallback, how "transport still runs home" is evaluated for Plan A and Plan B, how it composes with the existing feasibility tiers, and how it degrades when return data is unknown (must fail open to `unknown`, never assume last-mile transport is always available) — consistent with `CLAUDE.md`'s non-negotiables (no live data, no numeric seat probability, `AT_LEAST(0)`/`UNKNOWN` semantics)
- **Required verification**: design cross-checked for internal consistency against `plan.md`'s decision model and every relevant `CLAUDE.md` non-negotiable; no contradiction with frozen invariants
- **Baseline commit**: `9e19ebc`
- **Artifact under review**: `plan.md` (new "Getting home: session-end return transport" section, plus the amendments it forces) and `CLAUDE.md` (non-negotiables). Design only, no code. `decisions.md` gets its summary entry at close, per `WORKFLOW.md`'s boundary rules.
- **Scope exclusions**: implementation (a follow-up `IMP-###`); the existing arrival-side `resolve_hours`/`effective_close` machinery, unchanged unless the design requires it
```

Confirmed byte-identical to invocation 1's recorded brief — the underlying `HANDOFF.md` assignment
block has not been re-narrowed between invocations.

## Method

`git -C /Users/darrensy/Projects/study-venue-planner diff 9e19ebc` (working tree unstaged, 4 files:
`CLAUDE.md`, `HANDOFF.md`, `plan.md`, `reviews/LEDGER.md`; 541 insertions / 36 deletions per
`git diff --stat`). Read `CLAUDE.md`'s diff and the "Getting home" subsection in full (current
working tree, lines 45–74), `plan.md`'s "Getting home: session-end return transport" section in
full (current working tree, lines 737–1136) plus every place it forces amendments elsewhere in
`plan.md` (symbol table ~320–343, `backup_strength` ~275–301, ranking pipeline ~1126–1141, Plan
A/B UI mockup ~1273, Phase 1 acceptance ~1561, testing list ~1631–1660, `venues_meta.json` schema
example ~1367–1409). All line numbers below are to the current working tree unless stated
otherwise. Grepped for stale/leftover text (`_lower` naming, the old tag-unsafe formula, bare
`"basis":` occurrences, `feasibility tier` as a bare phrase) across both files rather than
single-line-scanning prose that is line-wrapped in the source.

---

## Part A — regression check on invocation 1's four findings

### Finding 1 — `latest_leave_at` untyped arithmetic on a tagged value — **CORRECTED**

Invocation 1 quoted the old formula (then `plan.md:963-966`):
```
latest_leave_at = min( (effective_close_mid - closing_buffer) - duration - travel_minutes_mid,
                       last_departure_mid                     - duration - travel_minutes_mid )
```
and the accompanying prose "`min(UNDETERMINED, finite)` is the finite value" (old `plan.md:969-971`).

Current text, `plan.md:983-994` ("Only reached on the first four rows of the table; the NONE and
UNKNOWN rows never get here"):
```
binding_limit_b is finite:
    usable_minutes  = max(0, min(binding_limit_mid, arrival_mid + duration) - arrival_mid)
    surplus_b       = binding_limit_b - (arrival_b + duration)
    latest_leave_at = binding_limit_mid - duration - travel_minutes_mid

binding_limit_b is the "none" row (COVERED hours AND an AT_LEAST(0) return):
    usable_minutes  = duration
    surplus_b       = AT_LEAST(0)
    latest_leave_at = UNDETERMINED
```
`latest_leave_at` now reads only the already-branched `binding_limit_mid` (from the six-row table
at `plan.md:968-975`, unchanged in substance from invocation 1's reading and still branching
`effective_close_b ∈ {finite, COVERED, NONE, UNKNOWN}` before any arithmetic). Grepped the whole
tree for the old pattern and for `min(UNDETERMINED` — zero hits in both `plan.md` and `CLAUDE.md`.
No comparable formula anywhere else in the diff does untyped arithmetic on a tagged value. Confirmed
corrected, not merely reworded.

### Finding 2 — `basis` free-text field leaks exact times / route direction — **CORRECTED, BUT INCOMPLETELY: the same violation is still present verbatim in the second worked example**

Invocation 1 cited two occurrences of the same offending string, at old `plan.md:1029` and
`plan.md:1357`. Current state:

- `plan.md:1059` (the "Data contract" section's worked example) — **fixed**:
  `"basis": "last train from the venue's own station, plus the walk to the platform; rechecked 2026-08"`.
  No exact time, no direction, no route.
- `plan.md:1392` (the `data/venues_meta.json` full-venue schema example under "What's in
  `venues_meta.json`") — **unchanged, still violating**:
  `"basis": "last train Beauty World -> home direction 23:31, plus a 6-8 min walk"`.
  `grep -n '"basis":' plan.md` returns exactly these two lines — confirming the second occurrence
  was never touched.

This is a direct, textual contradiction of a frozen invariant restated multiple times in the
*same diff*, not an inherited pre-existing problem:
- `CLAUDE.md:58` (added by this diff): "The privacy rule binds the free-text `basis` field as hard
  as the bands: **no exact times, no line or direction names, no route toward an origin**".
- `plan.md:1071` (field-reference table, added by this diff): "**Subject to the same privacy rule
  as every other field in this file: no exact times, no line or direction names, no route toward
  an origin.**"
- `plan.md:1085-1088` (added by this diff): "**The privacy rule binds `basis` as hard as it binds
  the bands.** 'Last train Beauty World toward X at 23:31' in a free-text note publishes exactly
  what the five-minute band was chosen to withhold, and it publishes the *direction*... Record the
  kind of source and the date it was checked; never the timetable entry itself." — this sentence
  names almost the exact string still sitting, unedited, 300 lines earlier in the same document at
  `plan.md:1392`.
- `plan.md:1655` (new testing-list bullet, added by this diff): "**the `basis` field carries no
  exact times and no direction names** — a lint or review check over `venues_meta.json`, since
  nothing else validates a free-text field."

So the document now explicitly (a) states the rule three times, (b) uses almost this exact
sentence as the illustrative example of *what a violation looks like*, and (c) calls for a check
that would catch it — while its own worked schema example, in the same file, contains that
violation unmodified. This is worse than an oversight caught nowhere: the design text itself
proves the author was aware of the specific string and its problem, and one of the two copies
was never corrected. **Verdict: corrected but incompletely — a confirmed, still-present
contradiction of a non-negotiable ("bands, not exact times", "brand/route-neutral").**

### Finding 3 — symbol-table naming inconsistency (`last_departure_lower` vs. `_mid`/`_upper`) — **CORRECTED**

Current symbol table, `plan.md:341`:
`| `last_departure_mid`, `last_departure_upper` | derived | ... — named for the **bound** that
consumes it, as every other pair here is; `last_departure_upper` takes the band's **lower** edge |`

Now consistent with every other `_mid`/`_upper` pair in the same table (`plan_a_arrival_*`,
`fallback_travel_minutes_*`, `session_end_*`, `return_margin_*`, `binding_limit_*`) and with the
pseudocode's own `last_departure_b` / `last_departure_upper` usage (`plan.md:781-782`, `897-898`,
`970-972`). Grepped the whole tree for `_lower` — zero hits in `plan.md` or `CLAUDE.md`. Confirmed
corrected.

*(Minor, carried forward, not one of the four confirmed findings: the same symbol-table row,
`return_margin_mid`/`return_margin_upper` at `plan.md:342`, still states only
`last_departure_* − session_end_*` and does not mention the reversed pre-dawn-branch direction
`session_end_b − first_departure_b` used at `plan.md:894`. This was invocation 1's §5
under-specification note, not a confirmed finding, and it is still present — see "Ambiguity"
below.)*

### Finding 4 — `backup_strength` `strong`/`salvage` grading gap for a `shorter` return tier — **CORRECTED**

Current `plan.md:283`, the `strong` row: "...**and a `robust` or `tight` `return_tier`**." Current
`plan.md:284`, the `salvage` row: "...— or it fits and the way home is `unverified`." A new
explicit three-row table was added at `plan.md:291-295`:
```
| Fallback's hours tier | Fallback's `return_tier` | `overall_tier` | `backup_strength` |
| `robust` / `tight` | `robust` / `tight` | `robust` / `tight` | `strong`, if confidence clears the floor |
| `robust` / `tight` | `shorter` | `shorter` | **`salvage`** if the return-capped minutes clear `PLAN_B_MIN_SESSION_MINUTES`, else `none` — ... |
| `robust` / `tight` | `unverified` | `unverified` | **capped at `salvage`**, labelled as an unverified way home rather than a short session |
```
This resolves invocation 1's exact ambiguity: it was previously undefined whether a fallback whose
hours fit but whose `return_tier` is `shorter` (a verified but insufficient return) qualified as
`strong`; it now explicitly does not, and is graded exactly like a `shorter` hours case. `CLAUDE.md`
was updated in parallel and agrees: `CLAUDE.md:73` — "`backup_strength` is graded on the fallback's
`overall_tier`, not its hours tier... A `shorter` `return_tier` means the requested session does not
fit, so the fallback is `salvage` (or `none` below the floor)." Both documents now state the same
rule in matching terms. `plan.md`'s testing list was also extended to cover this exact case
(`plan.md:1648`: "a fallback whose hours tier is `robust` but whose `return_tier` is `shorter`
grading `salvage`... rather than `strong`"). Confirmed corrected, in the design text, the summary
doc, and the testing list.

**However**, `CLAUDE.md`'s own JS-testing paragraph (`CLAUDE.md:119`, the "Return transport" clause
at the end) was **not** updated to name this same `shorter`-return-tier case — it still says only
"`backup_strength` capped at `salvage` and its stated duration return-capped," which reads as (and,
per invocation 1, previously was) the `unverified`-only case. `plan.md`'s testing list now names
both the `shorter` case and the `unverified` case explicitly; `CLAUDE.md`'s parallel testing
summary names only the latter. Not a contradiction of the design itself (the design table and both
documents' prose agree), but the two testing-obligation lists — which invocation 1 explicitly
checked and found "consistent with each other, but consistent in a way that reproduces Finding 4's
gap" — are now inconsistent with each other on this one point (see Part B §4 below).

---

## Part B — fresh pass

### 1. Acceptance-criteria coverage, item by item

**(a) Return-transport data needed per origin/fallback.** Covered: `plan.md:1044-1064` ("Data
contract") — hand-maintained `return_transport[dest][mode]` block (`last_departure_band`, optional
`first_departure_band`, optional `by_weekday`, `basis`) plus venue-level `holiday_return_policy`,
worked twice (`plan.md:1050-1064`, `plan.md:1386-1396`), and a field table at `plan.md:1066-1072`.
Per-fallback: `plan.md:1030-1031` — Plan B reads "the fallback's own `return_transport` block and
its own `access[origin_a]` mode set — never Plan A's." Present.

**(b) How "transport still runs home" is evaluated, Plan A and Plan B.** Plan A: the "Evaluating
one bound" pseudocode (`plan.md:862-899`) and "The return tier" (`plan.md:910-937`), run
independently per bound. Plan B: `plan.md:1028-1033` and the mirrored `CLAUDE.md:72` bullet. Both
directions present, and Plan B's session end (`plan_b_arrival_* + duration`) is explicitly derived
rather than reused from Plan A.

**(c) Composition with existing feasibility tiers.** `plan.md:939-946`:
`overall_tier = worse_of(hours_tier, return_tier)`, `robust > tight > shorter > unverified` —
mirrored at `CLAUDE.md:24`. Ranking pipeline updated at `plan.md:1130` ("Feasibility tier —
`overall_tier`, the worse of the hours tier and the return tier"). Present.

**(d) Degradation when return data is unknown — fail open to `unknown`, never assume transport
exists.** Named design goal at `plan.md:822-824` ("An empty admissible set means no recorded way
home. That is `unverified`, not `closed`"), pseudocode step 3 (`plan.md:884-885`, "if every entry is
missing: return UNVERIFIED"), step 4's `pre_dawn_no_first_departure` branch (`plan.md:891-892`),
and the non-conflation rule at `plan.md:929-932` ("`unverified` never resolves to `robust`, and
missing data never reads as 'service exists.'"), restated at `CLAUDE.md:53`. Present — see §2 for a
branch-level trace, not a take-on-faith reading.

All four items are recorded in the design. Item (a)'s hand-maintained-data machinery, however,
contains the still-unfixed privacy leak documented in Part A Finding 2 — the *presence* of the
required data contract is not the same as its *conformance* to the non-negotiables it must satisfy.

### 2. Fail-open trace — "Evaluating one bound" (`plan.md:862-899`), re-derived independently

```
1. clock_b inside [RETURN_CORE_FROM_MINUTES, RETURN_CORE_UNTIL_MINUTES] -> PASS(core_span, AT_LEAST(0))
2. any admissible mode is schedule-free                                  -> PASS(schedule_free, AT_LEAST(0))
3. every schedule-bound entry missing                                    -> UNVERIFIED(no_data)
4. pre-dawn gap (RETURN_SERVICE_DAY_START_MINUTES <= clock_b < RETURN_CORE_FROM_MINUTES),
   no entry carries first_departure_band                                 -> UNVERIFIED(pre_dawn_no_first_departure)
4. pre-dawn gap, first_departure_band present                            -> MARGIN(session_end_b - first_departure_b)
5. ordinary case                                                          -> MARGIN(last_departure_b - session_end_b), MAX over present entries
```
- Branch 3's `entries = []` case (an empty admissible-modes set, e.g. rain removes `cycle` and no
  `transit` entry exists in `access`) still routes through "every entry is missing" (vacuously true
  over an empty list) to `UNVERIFIED`. Traced and correct, but — as invocation 1 also noted — this
  reading is nowhere stated in prose; I found no added sentence naming the empty-set case
  explicitly. Still an unstated implicit reading, not a new problem, not a regression.
- No branch anywhere in steps 1-5 returns a passing/`robust` result on the *absence* of per-venue
  data; the two positive-evidence branches (1, 2) are documented affirmative claims, not
  missing-data leaks. `RETURN_CYCLE_LATEST_MINUTES = null` (unconstrained-cycle) remains a disclosed,
  named open question (`plan.md:1717`, `:1779`), not a silent fail-open.
- Downstream, the binding-limit table (`plan.md:968-975`) is correctly branched, and — per Part A
  Finding 1 — the formulas beneath it (`plan.md:983-994`) now consume only the already-branched
  `binding_limit_*`. No fail-open regression found in the composition layer this time.

**Conclusion: the pseudocode's fail-open discipline holds under a fresh, independent trace.** The
confirmed problem in this design (Finding 2) is a privacy/non-negotiable violation in the worked
data example, not a fail-open logic defect.

### 3. Non-negotiable consistency

- **No live data / no fetcher**: `plan.md:753-754`, `plan.md:1122` ("It does not add a fetcher. No
  live transit source, now or later"), `CLAUDE.md:58` ("no transit fetcher, now or later").
  Consistent.
- **`venues_meta.json` hand-maintained, never script-written**: `plan.md:1046-1047`, `CLAUDE.md:58`.
  Consistent.
- **Brand-neutral naming**: `return_transport`, `last_departure_band`, `first_departure_band`,
  `holiday_return_policy`, `RETURN_CORE_FROM_MINUTES`, etc. — no brand names. Consistent.
- **Bands, not exact times (privacy)**: **violated** — Finding 2, confirmed still present at
  `plan.md:1392`, contradicting `CLAUDE.md:58` and `plan.md:1071`/`1085-1088` in the same diff.
- **`NONE`/`UNKNOWN`/`COVERED` distinct, branched before arithmetic**: table at `plan.md:968-975`
  correctly branched; the previously tag-unsafe downstream formula is fixed (Finding 1). No
  remaining violation found in a fresh scan of every formula in the section.
- **Absolute-minute arithmetic**: `plan.md:826-841` (`service_date`/`last_departure_abs`, `> 1440`
  after midnight, exactly as `close`). Consistent.
- **`AT_LEAST(0)` consumed only by named accessors**: `plan.md:912-915` states `return_margin_*`
  "reuses... `passes_feasibility()`, `finite_shortfall()` and `sort_key()` without modification.
  Only `display()` needs a return-specific sibling." `CLAUDE.md:94`'s "Exactly three accessors may
  consume it" wording is unchanged by this diff and does not explicitly resolve whether a
  return-specific `display()` *sibling* counts as a fourth accessor or a variant of the third. Not
  newly introduced by this diff (unchanged text on both sides) and not a contradiction of stated
  semantics (no numeric margin, no `sort_key()` fallback preserved) — carried forward as an
  unresolved ambiguity, not a confirmed violation.

### 4. Internal consistency of the edited tree

- **Ranking order / `overall_tier` usage**: `CLAUDE.md:24` and `plan.md` (ranking pipeline
  `1126-1141`, Plan A/B section, UI mockup `1273`, refusal wording `1024`/`plan.md` "second
  refusal") agree everywhere checked.
- **`latest_leave_at`'s `UNDETERMINED` definition**: both files agree it means "no known closing
  constraint" — and, per Finding 1, the formula implementing it is now tag-safe on both sides.
- **`UNDETERMINED`/`unverified`/`UNKNOWN` three-way distinction**: `plan.md:929-932` and
  `CLAUDE.md:53` state the same non-conflation rule in matching terms.
- **Testing lists — new inconsistency found**: `plan.md`'s testing list (`plan.md:1648`) now names
  the `shorter`-return-tier `backup_strength` case explicitly, closing the exact gap invocation 1
  flagged. `CLAUDE.md`'s parallel JS-testing paragraph (`CLAUDE.md:119`, "Return transport" clause)
  was **not** given the same addition — it still names only the `unverified`-capping case. The two
  lists therefore no longer agree on what test coverage this feature requires, on one specific
  point. Minor (a testing-obligation gap, not a design defect), but squarely inside "internal
  consistency of the edited tree" and it is a fresh divergence, not a pre-existing one.
- **Phase 1 acceptance criteria**: `plan.md:1564` amended — "For a session ending inside the core
  service span this requires no `return_transport` data at all; for a session ending outside it, a
  Plan A additionally requires that venue's `return_transport` entry, and its absence correctly
  yields the second refusal." Consistent with the design.
- **`venues_meta.json` contract**: both worked schema examples agree on field names/shapes; the one
  place they disagree is the `basis` field's content (Finding 2).
- **Symbol table**: `last_departure_*` naming now consistent (Finding 3); `return_margin_*` row
  still incomplete for the pre-dawn direction (see Ambiguity, carried from invocation 1, not a new
  finding).
- **`backup_strength` grading**: `plan.md`'s table (`283-295`) and `CLAUDE.md:73` agree (Finding 4).

### 5. Ambiguity or under-specification

- **Finding 2's incomplete correction** is the clearest concrete problem — not an ambiguity but a
  live, confirmed leak in a worked example the document itself uses to illustrate the rule being
  broken.
- **Empty admissible-modes set**: `UNVERIFIED` outcome is correct under trace (§2) but its
  vacuous-truth reading is still never stated in prose. Unchanged from invocation 1.
- **`display()` accessor count**: still unresolved whether a return-specific `display()` sibling is
  compatible with "Exactly three accessors" — unchanged from invocation 1, not newly introduced.
- **`return_margin_*` symbol-table row** (`plan.md:342`): still states only
  `last_departure_* − session_end_*`, omitting the pre-dawn branch's reversed direction
  (`session_end_b − first_departure_b`, `plan.md:894`). Unchanged from invocation 1's §5 note.
- **CLAUDE.md/plan.md testing-list divergence** on the `shorter`-return-tier `backup_strength` case
  (§4 above) — new since invocation 1, a direct consequence of only one document being updated when
  Finding 4 was fixed.

---

## Could not verify

- No implementation exists yet (design-only assignment, explicitly out of scope); all findings are
  from direct reading of `plan.md`/`CLAUDE.md`, not from executing or testing any pseudocode.
- Whether the vacuous-truth handling of an empty admissible-modes set is the design's actual
  intent — never discussed in prose, in either invocation's read of the text.
- Whether `CLAUDE.md`'s "Exactly three accessors may consume it" (`AT_LEAST(0)`) permits or forbids
  the new return-specific `display()` sibling — the invariant's own wording does not resolve this,
  and this diff does not touch that sentence.
- The real-world accuracy of "LTA's published service spans" underlying `RETURN_CORE_FROM_MINUTES`
  / `RETURN_CORE_UNTIL_MINUTES` — the design itself lists this as an open, provisional question
  (`plan.md:1779` area / Open questions section) and I performed no external lookup, since the
  brief's required verification is internal-consistency and non-negotiable cross-checking, not
  fact-checking a transit timetable.
- Whether the primary intended to fix only one of the two `basis` occurrences, or missed the
  second — I have no access to the primary's reasoning, only the resulting text.

## Not asked to check

- Implementation of any of this (explicit scope exclusion; a follow-up `IMP-###`).
- The existing arrival-side `resolve_hours`/`effective_close` machinery's own correctness — the
  design does not modify its definition, only composes with its output; out of scope per the brief.
- `decisions.md`'s close-time summary entry — not yet written; correctly absent from this diff per
  `WORKFLOW.md`'s boundary rules (`decisions.md` is unchanged in `git diff 9e19ebc`).
- `HANDOFF.md` and `reviews/LEDGER.md`'s own diffs (bookkeeping, not part of the acceptance criteria
  or required verification named in the brief).
- Route/trigger selection correctness (`claude_opus` primary, `codex_sol`/`codex_sol_high`
  verification) — a `WORKFLOW.md` process question, not part of this design's acceptance criteria.
- Whether this is properly invocation 2 under the "no third retry" rule in `WORKFLOW.md` (after two
  non-`GATE_PASS` attempts a third invocation is prohibited) — that is a process check for the
  primary/`WORKFLOW.md`, not something this brief asked the gate to verify about itself.

---

## Terminal status

`GATE_FAIL`
