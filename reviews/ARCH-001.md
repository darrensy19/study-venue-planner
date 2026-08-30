# Review record: ARCH-001

## Assignment

- **Assignment ID**: `ARCH-001`
- **Work type**: architecture/high-level
- **Primary route**: `claude_opus` — Opus, effort high
- **Reviewer route**: `codex_sol` — Sol, effort medium
- **Baseline commit**: `9e19ebc`
- **Reviewed diff or commit**: uncommitted working-tree diff against `9e19ebc`, pre-review SHA-256 `ad5da4297d563e959a17f66eac171cba9e0a553268d239f7704fb699befe1131`; `plan.md` SHA-256 `5c98eac96f35427f0597e8df287d3603db4408645194fd345b6cf25f61dba188`; `CLAUDE.md` SHA-256 `70fabb807a1cbe1465f43184bb8e01800c56e50f984c1ee58b0f907c1ae9745a`; untracked gate record SHA-256 `68aa312dc1feb7ba81aff69355ca5b69ddbdb2d4dce0cf5cae9851d2c8887d38`
- **Scope**: design for session-end return-transport feasibility in `plan.md` and the amendments it forces in `CLAUDE.md`; bookkeeping in `HANDOFF.md` and `reviews/LEDGER.md` inspected for preflight only; implementation and the existing arrival-side hours machinery excluded

## Review round 1 — 2026-08-30

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol`
- **Runtime model verification**: per the standing constant in `WORKFLOW.md`; the runtime does not expose the selected model, so the user's route selection is relied on.
- **Reviewed artifact**: the exact uncommitted diff and file hashes recorded in the assignment header, including the two corrections made after gate invocation 2

### Resolution of prior findings

None — first review round. The two pre-gate invocations are evidence, not prior reviewer rounds; their status and conclusions were not trusted.

### Findings

#### `ARCH-001-R1-F01` — High — The core-span branch passes without establishing any recorded route home

- **Status at issuance**: `open`
- **Evidence**: `plan.md:764-769` and `CLAUDE.md:48` require the return leg to use `access[origin_a]`; `plan.md:812-824` defines an empty admissible set as `unverified`. But the first branch at `plan.md:872-878` returns `PASS(core_span, AT_LEAST(0))` before `admissible_return_modes()` is evaluated. Therefore a venue with no `origin_a` entry, only null entries, or no currently admissible mode passes inside 07:00-21:30. This directly contradicts the promised test at `plan.md:1638` (no `origin_a` must be `unverified`) and the fail-open rule at `plan.md:929-932` / `CLAUDE.md:54`. All 28 current metadata records happen to contain a non-null `origin_a.transit` entry, but the documented schema and test explicitly permit the absent case, and Plan B must evaluate each fallback independently.
- **Impact**: absent return evidence can read as "service exists" and can produce a `robust` return tier and Plan A. This violates the assignment's central negative-path acceptance criterion and assumes last-mile availability from a city clock alone.
- **Recommended correction**: derive the admissible return-mode set before the core-span shortcut. An empty set must return `UNVERIFIED`; the core span may waive only the per-venue schedule lookup for an already-recorded admissible schedule-bound route (while an admissible schedule-free mode remains its own positive-evidence branch). Add an inside-core test with no usable `access[origin_a]` entry and require `unverified`.

#### `ARCH-001-R1-F02` — High — `first_departure_band` is a lower bound that cannot use the design's upper binding-limit and `shorter` semantics

- **Status at issuance**: `open`
- **Evidence**: the pre-dawn branch returns `MARGIN(session_end_b - first_departure_b)` (`plan.md:887-894`). Before the first departure, shortening the session moves its end earlier and makes the result worse; after it, the result improves. That is the opposite monotonic direction from a last departure or venue close, where shortening the session creates more margin. Yet every resolved return is then composed through the upper binding limit `min(close - buffer, last_departure)` (`plan.md:955-995`), and `shorter` is presented as a known partial session that becomes feasible by leaving earlier (`plan.md:951-953`, `CLAUDE.md:56`). No binding-limit row exists for a finite *first* departure. In addition, one earliest departure proves that service exists at that instant, not that every later instant through 07:00 is continuously usable; the text supplies no headway or continuity rule for `plan.md:893-894` to assume.
- **Impact**: a 05:00 end with a 06:00 first departure can be labelled as a shorter session even though ending still earlier cannot make the way home work, and the design cannot derive `usable_minutes`, `surplus_*`, or `latest_leave_at` from that lower-bound result. Conversely, a later pre-dawn end can be called robust from a single first-departure fact without a recorded service-continuity claim. The 04:00-07:00 hole is honestly identified when data is absent, but it is not correctly closed when the optional field is present.
- **Recommended correction**: specify the product policy for the pre-dawn case and give it a type that matches that policy. If waiting for first service is allowed, model the wait explicitly and do not coerce it into `shorter` or an upper binding limit. If departure must be possible at session end, define what evidence establishes a service interval after the first departure and how pre-first results rank and display. Then add binding/metric rows and tests for before, inside, and after that interval. Do not reuse the last-departure arithmetic for a lower-bound constraint.

#### `ARCH-001-R1-F03` — Medium — The return resolver and several values it consumes are used but never fully defined

- **Status at issuance**: `open`
- **Evidence**: `resolve_return_service(...)` appears only at `plan.md:881`; there is no resolver contract stating the lookup order among `holiday_return_policy`, `by_weekday`, and `default`, which weekday is selected, what malformed bands do, or the exact missing result. `admissible_return_modes(venue, outbound_mode, raining)` reads an undeclared `session_end` when applying `RETURN_CYCLE_LATEST_MINUTES` (`plan.md:812-819`), even though evaluation is per bound and the stored constant is a clock-time value. The pre-dawn `MIN over entries` at `plan.md:893` includes entries that may not carry `first_departure_band`, despite the field being optional. For Plan B, the design does not explicitly say whether the cycle-possession argument is the original trip mode or `fallbacks[].mode`; those differ when the bicycle was left at Plan A. The symbol table also describes `return_margin_*` only as `last_departure_* - session_end_*` (`plan.md:341-343`), omitting the reversed first-departure case.
- **Impact**: two conforming implementers can select different service days/weekday overrides, holiday behavior, bound inputs, and Plan B cycle availability. Optional fields can also produce undefined edge arithmetic. The schema shape is readable, but it is not yet an executable contract suitable for the required TDD implementation.
- **Recommended correction**: define `resolve_return_service` and `admissible_return_modes` as total functions with explicit inputs, output variants, precedence, validation failures, and absent-data behavior. State that aggregation operates only on entries carrying the required field. Define the Plan B bicycle-state input and update the symbol table and tests to cover each resolution branch.

#### `ARCH-001-R1-F04` — Medium — The global 07:00-21:30 service claim is still provisional and has no durable recorded basis

- **Status at issuance**: `open`
- **Evidence**: `plan.md:854-858` calls service in the span "unquestionable" and says its LTA basis is recorded, but the constants remain "Provisional" at `plan.md:1099-1105`, and `plan.md:1777` still asks whether they are right and instructs a future check against LTA. LTA's current rail overview supports a broad 05:30-to-around-midnight norm but explicitly tells users to check operator changes; LTA's current announcements include line-specific altered operating hours and substitute shuttles. Those sources support 07:00 and 21:30 as conservative network-level candidates, not universal route-to-origin availability: [LTA Rail Network](https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/rail_network.html) and [LTA service announcements](https://www.lta.gov.sg/content/ltagov/en/map/announcement.html).
- **Impact**: the only branch allowed to assume service exists is also the only factual premise the design leaves unresolved. Without a cited source, checked date, scope, and maintenance rule, a later implementer cannot distinguish a frozen verified invariant from a provisional convenience assumption. The claim also cannot cure F01's absence of route evidence.
- **Recommended correction**: record the authoritative source, checked date, precise scope, and review/update rule; phrase the claim as a maintained network-level assumption rather than universal route proof. Retain a separate admissible-route precondition per F01. If that evidence cannot be established, make the core shortcut `unverified` until per-route data exists.

### Non-blocking observations

- The ordering `robust > tight > shorter > unverified` is coherent with the project's wasted-trip bias and is stated consistently in `plan.md:943-953`, `plan.md:1130`, `CLAUDE.md:24`, and `CLAUDE.md:56`. A known shortened session with a verified way home is more actionable than a full session whose return is unchecked. This conclusion assumes F02 is corrected so `shorter` retains its actual "leave earlier" meaning.
- `unverified` and hours `UNKNOWN` are kept distinct in both governing documents: `plan.md:927-935`, `plan.md:948-949`, `plan.md:1143-1151`, `CLAUDE.md:54-55`, and the paired testing obligations at `plan.md:1643-1645` / `CLAUDE.md:119`. No remaining textual conflation was found.
- The 04:00 service-day boundary correctly prevents a 03:30 end from reading the following night's last departure (`plan.md:826-841`), and the no-`first_departure_band` path honestly returns `unverified`. LTA's broad published norms (trains and most regular buses beginning around 05:30) make 04:00 a conservative namespace boundary, but they do not prove that every exceptional service fits it; that limit is recorded below.
- The corrected `basis` rule prevents direct publication of exact timetable entries, lines, directions, and routes, and both worked examples now comply (`plan.md:1050-1072`, `plan.md:1386-1396`, `CLAUDE.md:58`). Five-minute bands still create a cross-venue timetable fingerprint when combined with public venue locations and existing `access[origin_a]` bands. The plan accurately calls banding a reduction in precision rather than a guarantee (`plan.md:1090-1095`, `plan.md:1422`); no stronger anonymity claim should be made.

### Verification performed

- Read the required `WORKFLOW.md` sections (Roles, Choosing a route, Lifecycle, One-writer protocol, Review records), `HANDOFF.md` in full, the governing decision-model/return/data/testing sections of `plan.md`, all relevant `CLAUDE.md` non-negotiables, both complete gate invocations, and the review template.
- Confirmed `HEAD == 9e19ebc3318556d863d4b03a2ecfd738c877c3bf`; inspected `git status`, `git diff 9e19ebc`, changed-file scope, hashes, and `git diff --check` (clean). No production code is in the reviewed diff.
- Reran `.venv/bin/python3 .cross-agent-workflow/gate_brief.py HANDOFF.md`; its objective, acceptance criteria, required verification, baseline, artifact, and exclusions match the recorded gate brief.
- Independently traced every `Evaluating one bound` branch: (1) core span currently passes even with no admissible route (F01); (2) schedule-free requires an admissible recorded mode and is genuine positive evidence; (3) all missing/empty schedule-bound entries yield `UNVERIFIED`; (4) absent first-departure data yields `UNVERIFIED`, while present data has the lower-bound defect in F02; (5) the ordinary last-departure branch takes `MAX` over present admissible modes and missing data does not become a pass.
- Cross-checked Plan A and Plan B composition, both independent bounds, `overall_tier`, binding-limit tag handling, `AT_LEAST(0)`, `NONE`, `UNKNOWN`, `COVERED`, `unverified`, `backup_strength`, refusal wording, no-live-data policy, no numeric seat probability, brand neutrality, and hand-maintained-file ownership across `plan.md` and `CLAUDE.md`.
- Verified the two corrections made after gate invocation 2 first-hand: the second `venues_meta.json` `basis` example at `plan.md:1392` contains no exact time/direction/route, and `CLAUDE.md:119` now explicitly requires a `shorter` return tier to grade Plan B as `salvage` rather than `strong`, matching `plan.md:1648`.
- Searched both governing documents for the old leaked `basis` example, exact-time/direction text in `basis` values, stale `_lower` naming, return resolver definitions, and every use of the new constants and result tags.
- Inspected current `data/venues_meta.json`: 28/28 venues currently have at least one non-null `origin_a` mode and all 28 have `transit`; this bounds F01's present-data exposure but does not resolve the schema/test contradiction.
- Cross-checked the core-span and service-day claims against current official LTA rail-network and service-announcement material. The sources support broad normal operating spans while requiring route/change-specific qualification; they do not establish a route home for each venue-origin pair.

### Could not verify

- Runtime model identity; the interface does not expose it, so the user's `codex_sol` route selection is relied on.
- Runtime behavior or test activation, because this is explicitly a design-only assignment and no implementation exists.
- Route-specific service availability to the private `origin_a` for every venue, weekday, holiday, and temporary service adjustment; doing so would require the private mapping and maintained timetable evidence the design intentionally does not publish.
- That 04:00 is later than every exceptional prior-night service and earlier than every exceptional new-day service. Official sources establish broad norms, not an exhaustive all-service boundary. The branch remains fail-open for 04:00-07:00 only when `first_departure_band` is absent; F02 covers the present-data case.
- That five-minute `last_departure_band` values, combined across venues with published coordinates and existing `access[origin_a]` bands, cannot materially narrow the private origin. The documents promise coarsening, not anonymity, and no re-identification analysis is supplied.

### User decisions required

- None. The findings require the primary to make the design internally complete; they do not require a new product-policy decision unless the primary determines that waiting for first service is a user preference rather than a fixed planner rule.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 1 — 2026-08-30

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort high. The runtime does not expose the selected model, so the user's route selection is relied on; this is stated, not claimed as verified.
- **Reviewed artifact after response**: the uncommitted working-tree diff against `9e19ebc`, `git hash-object` digest `96a1de62955e63cff595f323a8da1c1d3a134766`. Changed files: `plan.md`, `CLAUDE.md`, `HANDOFF.md`, plus this section of `reviews/ARCH-001.md`. No production code; nothing committed. `reviews/ARCH-001-gate.md` and the reviewer-owned round above are untouched.
- **Gate status**: a third pre-gate invocation is prohibited — two non-`GATE_PASS` attempts are already recorded in `reviews/ARCH-001-gate.md`. Every correction below is therefore **ungated** and rests on the primary's own verification plus this round-2 review.

### Finding dispositions

#### `ARCH-001-R1-F01` — `accepted`

- **Factual assessment**: `confirmed` — a genuine fail-open leak, correctly rated High, against the assignment's central negative-path criterion.
- **Independent verification**: read the cited pseudocode first-hand before editing. The core-span branch was the **first** statement in `Evaluating one bound` and returned `PASS(basis: "core_span", margin: AT_LEAST(0))` with no prior call to `admissible_return_modes()`. Confirmed the contradiction the reviewer names: the empty-set rule and the promised test both require `unverified` for a venue with no usable `access[origin_a]` entry, and neither could fire between 07:00 and 21:30. Independently confirmed the reviewer's data claim against `data/venues_meta.json` — 28/28 records carry a non-null `origin_a.transit` entry — so the defect was invisible in current data and live in the contract, exactly as stated.
- **Response**: accepted in full, and the reviewer's recommended shape adopted — the route is a prerequisite, the span is a timetable waiver. The distinction is the safety property: a clock can say *when* service runs, never *whether* a route exists.
- **Changes made**: `plan.md` "Evaluating one bound" restructured — step 1 is now the unconditional route prerequisite returning `UNVERIFIED(basis: "no_recorded_route")` on an empty admissible set; the core-span shortcut moved to step 4, after the modes are derived and entries resolved, and it passes **only** when a recorded entry is present, otherwise `UNVERIFIED(basis: "no_data")` even inside the span. Section retitled "The core service span waives the timetable lookup, never the route", with a two-column table separating what the span answers from what it does not. "Admissible return modes" now states no later branch may overturn an empty set. `CLAUDE.md` gains two non-negotiables: the route prerequisite as unconditional and derived first, and the span as a timetable waiver only. Two test obligations added: the route prerequisite tested **inside** the core span with both a missing and an all-`null` `access[origin_a]`; and the timetable-versus-route distinction tested at 13:00 with and without a recorded entry.
- **Verification**: scripted check confirms `THE ROUTE PREREQUISITE, FIRST` precedes the first `basis: "core_span"` occurrence in the flattened document, and that the core-span branch is guarded by `if present is non-empty:`. Read the rewritten block in full — the only unguarded `PASS` is `schedule_free`, which requires an admissible recorded mode by construction.

#### `ARCH-001-R1-F02` — `accepted`

- **Factual assessment**: `confirmed` — correct on every limb; it identifies a type error, not a wording problem.
- **Independent verification**: traced the arithmetic myself rather than accepting the summary. `MARGIN(session_end_b − first_departure_b)` improves as the session end moves **later**; `MARGIN(last_departure_b − session_end_b)` improves as it moves **earlier**. Both fed one `return_margin_*`, consumed by `passes_feasibility()` / `finite_shortfall()` and then by `binding_limit_b = min(effective_close − closing_buffer, last_departure_b)` — an upper bound throughout — and by a `shorter` tier whose stated meaning is "leave earlier". Confirmed the binding-limit table had no first-departure row, and that no headway or continuity rule existed anywhere in the section.
- **Response**: accepted; the mechanism is **removed, not patched**. A lower-bound constraint cannot share the last-departure type, the binding limit, or the `shorter` tier, and half-modelling it is worse than the honest `unverified` that already covered the case without it. On the reviewer's open question — whether waiting for first service is a user preference or a planner rule — **no such determination was made and none is implied**. The half-modelled mechanism was removed and the case scoped out; nothing in the contract now asserts a waiting policy in either direction. This deliberately avoids inferring a product policy from silence.
- **Changes made**: `first_departure_band` deleted from the data contract (JSON example, field table, and the `venues_meta.json` contract bullet), with an explicit *(no first-departure field)* row saying why. "Evaluating one bound" step 5 now returns `UNVERIFIED(basis: "pre_dawn_gap")` unconditionally for a session end in `[04:00, 07:00)`, regardless of what `return_transport` contains. New subsection "The pre-dawn gap is not modelled" records all three reasons for removal and what closing it properly would require — the **wait** as its own outcome, with a recorded service-interval claim, in its own assignment. `CLAUDE.md` gains a non-negotiable forbidding a first departure from being coerced into `return_margin_*`, `binding_limit_*` or `shorter`. Symbol table, "What this design deliberately does not do", Known problems and the test list updated; the stale test asserting the removed behaviour is replaced by one requiring the pre-dawn case to be terminal.
- **Verification**: scripted check confirms the pre-dawn branch contains no `first_departure` reference and returns only `UNVERIFIED(basis: "pre_dawn_gap")`; that `first_departure_band": "` no longer appears anywhere in `plan.md`; and that the single surviving mention of the removed expression is the prose explaining why it is gone. `CLAUDE.md` contains zero `first_departure` occurrences.

#### `ARCH-001-R1-F03` — `accepted`

- **Factual assessment**: `confirmed` — correct on all six sub-points, and one is more serious than "under-specified": `admissible_return_modes` compared `RETURN_CYCLE_LATEST_MINUTES`, a clock-time offset, against `session_end`, an absolute minute. That is a coordinate-system mix, which `CLAUDE.md`'s "All time comparisons use absolute minutes" already forbids as a frozen invariant — so this limb is a contract violation, not only a definitional gap.
- **Independent verification**: confirmed each cited omission first-hand — `resolve_return_service(...)` appeared only at its call site with no contract anywhere; `admissible_return_modes(venue, outbound_mode, raining)` read an undeclared `session_end`; the pre-dawn `MIN over entries` ranged over entries that need not carry the optional field; the symbol table described `return_margin_*` in last-departure terms only. On Plan B: confirmed the design named no bicycle-state input, and independently confirmed against `data/venues_meta.json` that **22 of 86** current `fallbacks[]` links carry `mode: "cycle"` — every one unusable on a trip that started by transit. That is a defect in the existing Plan B contract which this work exposes rather than creates; it is recorded, not silently fixed.
- **Response**: accepted; both functions are made total functions of explicit inputs, with named outcome variants and fixed precedence, and the bicycle state is threaded as an input rather than re-derived per leg.
- **Changes made**: new `plan.md` section defining `resolve_return_service(venue, destination, mode, service_date)` — explicit precedence **holiday policy → `by_weekday` → `default` → `MISSING`**, weekday taken from the **service date**, three outcomes `PRESENT` / `MISSING` / `MALFORMED`, an outcome table, and validation rules (parse, strictly increasing edges, offsets within `[0, 2 × 1440)`). `MALFORMED` is a **per-venue validation failure** — flagged, venue not ranked — never a quiet `unverified`, on the same reasoning that makes a contradictory `period_end_abs` pair a validation failure; the return tier gains `invalid`, **checked first**, stated as not a tier value and never reaching `overall_tier`. `admissible_return_modes(venue, bicycle_with_you, raining, session_end_abs, service_date)` is now total, with the cycle cutoff resolved as `cycle_cutoff_abs = abs(service_date, RETURN_CYCLE_LATEST_MINUTES)` under the `> 1440` convention, fixing the coordinate mix. `bicycle_with_you` defined and threaded — `outbound_mode == "cycle"` for Plan A, **Plan A's value unchanged** for Plan B, never re-derived from `fallbacks[].mode` — with the consequence for `fallbacks[].mode == "cycle"` links stated in the design, the Plan B bullet list, Known problems, and `CLAUDE.md`. Optional-field aggregation is gone: `MAX` ranges only over `PRESENT` entries. Symbol table gains `bicycle_with_you` and a corrected `return_margin_*` description naming both variants and stating there is no third. The composition section records that `MALFORMED` joins `UNKNOWN` as an outcome unranked **before** `overall_tier` and not a position in the ordering. Eight test obligations added, covering resolver precedence (including a 03:30 Saturday end selecting the `fri` override), malformed-versus-`unverified`, the cycle cutoff resolved against the service date, `bicycle_with_you` threading into Plan B, `cycle` fallback links dropped, and the two bounds producing different admissible sets across the cycle cutoff — impossible if the function closes over a shared `session_end`.
- **Verification**: scripted checks confirm the resolver signature, the `abs(service_date, RETURN_CYCLE_LATEST_MINUTES)` form, the threaded Plan B bicycle state, and the `MALFORMED` rule in both documents. Grepped both documents for every symbol introduced or renamed; no stale `outbound_mode`-based admissibility statement survives.

#### `ARCH-001-R1-F04` — `accepted`

- **Factual assessment**: `confirmed` — and it was a self-contradiction inside one document: the section asserted the basis was "recorded" while the constants table said "Provisional" and the open question still instructed a future check.
- **Independent verification**: confirmed all three cited passages first-hand, and confirmed that no source, checked date, or scope appeared anywhere in the document. **I did not independently re-check LTA's published spans** — this session has no browsing — so the reviewer's source characterisation is recorded *as the reviewer's finding, attributed and dated*, not restated as the primary's own measurement. That attribution is written into the document itself so a later reader can see whose check stands behind the constant.
- **Response**: accepted. The claim is recorded with a durable basis and re-scoped as a **maintained assumption** rather than either a provisional convenience or a frozen invariant — and, per F01, route existence stays a separate unconditional prerequisite, so the span can never cure an absence of route evidence.
- **Changes made**: new `plan.md` block "The claim, its basis, its scope, and its maintenance" — the claim stated plainly; the two LTA sources; **Checked** 2026-08-30 by the round-1 reviewer, with the non-re-verification stated; what the sources support (a network-level norm of roughly 05:30 to around midnight, with an instruction to check operator changes, leaving 07:00/21:30 well inside at both edges); **Scope** — network-level and ordinary-day only, not per-route proof and not proof against temporary altered operating hours or substitute shuttles; **Maintenance** — annual re-check plus after any network-wide change, and **withdrawal of the shortcut** if the norm stops holding. The overclaiming word "unquestionably" is removed. The constants table relabels both core-span constants **maintained assumption**, explicitly neither provisional nor frozen, pointing at the basis block. The open question is struck through and replaced by the standing annual re-check. Known problems gains an entry that the assumption is maintained rather than frozen and that temporary altered operating hours are not modelled. `CLAUDE.md` carries the same scoping and the withdrawal rule.
- **Verification**: scripted check confirms all four of `**Sources**`, `**Checked**`, `**Scope**` and `**Maintenance**` are present in the basis block, that "unquestionably" no longer appears, and that the route prerequisite is stated separately and unconditionally per F01.

### User-directed revisions

- None. The user directed the primary to address the four findings and to preserve the earlier verified corrections; no change outside the review's findings was directed.

### User decisions required

- None. The `RETURN_CYCLE_LATEST_MINUTES` value remains an open question in `plan.md`, not a blocker: the design is complete and safe with the current `null`, and setting it is a later refinement rather than a decision this assignment waits on.

### Preserved from earlier rounds

- Both `basis` worked examples remain free of exact times, line names, directions and routes.
- `CLAUDE.md`'s Plan B test obligation still requires a `shorter` return tier to grade `salvage` rather than `strong`.
- `unverified` remains distinct from hours `UNKNOWN` in both documents, and the ordering `robust > tight > shorter > unverified` is unchanged — no correction made it inconsistent. `MALFORMED` / `invalid` was added **outside** that ordering rather than inside it, precisely so the ordering contract is untouched.

### Verification rerun

- Required verification (internal consistency against `plan.md`'s decision model and every relevant `CLAUDE.md` non-negotiable; no contradiction with frozen invariants): rerun as a 16-assertion scripted sweep over both documents, flattened to defeat line-wrapping. All 16 pass. One earlier assertion failed on its own faulty predicate — it excluded the whole tail after the phrase "An earlier draft carried", which contains the deliberate historical quotation of the removed expression; re-checked against the pseudocode block alone and confirmed clean.
- Frozen-invariant cross-check: no live data and no fetcher added; `venues_meta.json` remains hand-maintained and script-free; naming stays brand-neutral; bands rather than exact values, with the `basis` privacy rule intact; `AT_LEAST(0)` still consumed only through the named accessors; `NONE` / `UNKNOWN` / `COVERED` still distinct and branched before arithmetic; and the absolute-minute rule is now **better** satisfied than at round 1, since F03's cycle-cutoff fix removed a coordinate mix.
- `git diff --check` — clean, exit 0.

---

---

## Review round 2 — 2026-08-30

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol`
- **Runtime model verification**: per the standing constant in `WORKFLOW.md`; the runtime does not expose the selected model, so the user's route selection is relied on.
- **Reviewed artifact**: correction delta represented by the uncommitted working-tree diff against `9e19ebc`, `git hash-object` digest `96a1de62955e63cff595f323a8da1c1d3a134766`; `plan.md` SHA-256 `7ed335e8ef0d176316e581f79fcf85547615dc4a3172fdd4bcf1564d0159957b`; `CLAUDE.md` SHA-256 `af0d2286dde751e83164e645d361463770f26f911ddfd22ec433f839d2e7605b`; primary response through `reviews/ARCH-001.md:150`

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-001-R1-F01` | `resolved` | `plan.md:985-991` derives the per-bound admissible set first and returns `UNVERIFIED(no_recorded_route)` when it is empty. Schedule-free passage at `plan.md:993-996` requires a recorded admissible mode and is positive non-timetable evidence. Schedule-bound modes cannot pass on missing data: `MALFORMED` fails validation, and no `PRESENT` entry returns `UNVERIFIED(no_data)` both inside and outside the core span (`plan.md:998-1016`). Plan B invokes the same machinery with each fallback's own `access[origin_a]` and `return_transport` (`plan.md:1193-1198`, `plan.md:1361-1369`). The route-leak reported in round 1 is closed; the distinct core-span contradiction introduced by the correction is `ARCH-001-R2-F01` below. |
| `ARCH-001-R1-F02` | `unresolved` | The lower-bound field and arithmetic are substantively removed: all surviving `first_departure` references in `plan.md` are historical/negative explanations (`plan.md:1043-1065`, `plan.md:1233`, `plan.md:1282-1285`, testing prose), none appears in `CLAUDE.md`, and no first-departure value reaches `return_margin_*`, `binding_limit_*`, the schema, or a positive test. No waiting policy is adopted. However the correction's stronger guarantee that 04:00-07:00 is *always* and *terminally* `unverified` is false: the schedule-free branch at `plan.md:993-996` precedes the pre-dawn branch at `plan.md:1018-1022`, so an admissible walk or cycle returns `PASS`; this contradicts `plan.md:1061-1064`, `plan.md:1282-1285`, `plan.md:1889`, and `CLAUDE.md:57`. The primary must either scope the terminal rule to schedule-bound-only sets or move it ahead of schedule-free evidence and accept that policy consequence. |
| `ARCH-001-R1-F03` | `unresolved` | Service-date/weekday selection, holiday precedence, `PRESENT`/`MISSING`/`MALFORMED`, aggregation over `PRESENT`, explicit per-bound inputs, Plan B bicycle state, and the absolute cycle-cutoff formula are now specified (`plan.md:809-925`, `plan.md:998-1026`, `plan.md:1361-1369`). The cycle-cutoff test uses `abs(service_date, 1500)` and correctly distinguishes 00:30 from 01:30 (`plan.md:1815`); 22 of 86 current fallback links are independently confirmed as `cycle`, and the consequence is explicitly bounded as a pre-existing Plan B defect exposed by this invariant (`plan.md:839-847`, `plan.md:1889-1891`). But `resolve_return_service` still does not define how an after-midnight clock string such as `00:30-00:35` becomes an offset above 1440. It requires `HH:MM-HH:MM`, strictly increasing parsed edges, and `[0, 2880)` offsets (`plan.md:906-911`), while later prose only says the conversion happens (`plan.md:1244-1247`). One implementation can parse those edges as 30/35 and another as 1470/1475; both fit the written text and select different absolute departures. The claimed total executable contract is therefore not complete. |
| `ARCH-001-R1-F04` | `unresolved` | The source attribution is accurate to round 1: the same two LTA pages were checked by this reviewer, and the recorded characterization—broad 05:30-to-around-midnight norm, operator-change qualification, network-level ordinary-day scope—is no stronger than that check (`plan.md:955-971`). The constants table and closed open question correctly call it a maintained assumption with withdrawal/re-check rules (`plan.md:1261-1269`, `plan.md:1957`). However the earlier symbol table still labels both core constants `constant (provisional)` at `plan.md:336`, directly contradicting the correction's “not provisional” wording. |

### Findings

#### `ARCH-001-R2-F01` — Medium — The corrected core span says it waives timetable data while requiring and validating that data

- **Status at issuance**: `open`
- **Evidence**: the governing prose says the span waives the per-venue timetable lookup (`plan.md:931-953`, `CLAUDE.md:54`), Phase 1 says an in-span session requires no `return_transport` data (`plan.md:1733`), and the test list requires no `return_transport` lookup (`plan.md:1803`). The pseudocode does the opposite: it calls `resolve_return_service` for every schedule-bound mode, parses/validates the band, and requires `present` to be non-empty before the core pass (`plan.md:998-1013`). The adjacent test at `plan.md:1812` encodes this contradictory behavior—no matching entry is `unverified`, but an entry passes “without any band being read”—even though the resolver must read and validate the band to produce `PRESENT`.
- **Impact**: implementers cannot satisfy the prose, Phase 1 acceptance, pseudocode, and tests simultaneously. The current algorithm also restores the 28-venue timetable-maintenance burden the core span was introduced to avoid, while still claiming that burden is waived.
- **Recommended correction**: choose one contract and make every occurrence agree. The round-1 correction requires a recorded admissible route from `access[origin_a]`; it does not require a `return_transport` timetable inside the maintained span. If that remains the intended design, place the core-span pass after the non-empty route check and schedule-free check but before `resolve_return_service`, and update tests accordingly. If a `return_transport` entry is intentionally required, stop calling the span a timetable waiver and update Phase 1, both governing documents, and the test obligations to state the actual data burden.

### Non-blocking observations

- `invalid` / `MALFORMED` does not disturb `robust > tight > shorter > unverified`. Although the pseudocode uses `invalid` as a dispatch label, `plan.md:1085-1088` and `plan.md:1111-1114` remove it through the per-venue validation path before `overall_tier`; `CLAUDE.md:55` states the same behavior. It remains distinct from both ranked `unverified` and hours `UNKNOWN`.
- The round-1 ordering observation still holds after removal of the lower-bound mechanism. Every finite `shorter` return now comes from `last_departure - session_end`, so leaving earlier improves it; a known partial session with a verified way home remains coherently above an unchecked return (`plan.md:1116-1118`, `CLAUDE.md:60`).
- The Plan B cycle-link consequence is within the requested F03 correction rather than an unscoped redesign. It applies the already-recorded bicycle-possession invariant to fallback viability, states the exact affected population (22/86, independently reproduced), and does not change unrelated Plan B ranking or travel formulas.

### Verification performed

- Ran the required finding-state extractor with `--emit-chunks --actor reviewer-round2`; independently read the resulting original findings and primary dispositions rather than accepting their reduced states.
- Re-read `AGENTS.md`, the required `WORKFLOW.md` headings, `HANDOFF.md` in full, the round-1 record and primary response, and only the governing correction sections of `plan.md` / `CLAUDE.md`.
- Confirmed lifecycle `review_requested`, `HEAD` at `9e19ebc3318556d863d4b03a2ecfd738c877c3bf`, correction digest `96a1de62955e63cff595f323a8da1c1d3a134766`, changed-file scope, absence of production-code changes, and `git diff --check` exit 0.
- Re-traced every corrected return branch first-hand: empty admissible set; schedule-free positive evidence; `MALFORMED`; core-span with and without `PRESENT`; outside-core missing data; pre-dawn; and ordinary `MAX` last departure. Repeated the trace for Plan B's independently computed fallback state.
- Used multiline-aware searches over both governing documents for core-span claims, pre-dawn/first-departure remnants, `invalid`/`MALFORMED` ordering, bicycle-state propagation, and provisional core labels.
- Verified `first_departure_band` is absent from the live schema and positive algorithm; only historical/negative explanations remain. Confirmed no implicit waiting rule was adopted.
- Independently counted `data/venues_meta.json`: 86 fallback links total, 22 `cycle`, 64 `walk`.
- Cross-checked the F04 attribution against this reviewer's actual round-1 source check and confirmed the two recorded URLs, checked date, scope, and maintenance/withdrawal rule match what was established.
- Cross-checked `invalid`, `unverified`, hours `UNKNOWN`, `AT_LEAST(0)`, and the unchanged ordering across `plan.md` and `CLAUDE.md`.

### Could not verify

- Runtime model identity; the interface does not expose it, so the user's `codex_sol` route selection is relied on.
- Runtime behavior or test activation, because this remains a design-only assignment with no implementation.
- Which of the contradictory core-span and pre-dawn statements reflects the primary's intended final policy; the documents support incompatible readings, so this cannot be inferred safely.

### User decisions required

- None. The primary can restore internal consistency without a new user policy decision. If the primary believes the core span should require timetable data or that schedule-free modes should be suppressed pre-dawn, that would be a policy change and must be surfaced rather than silently selected.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 2 — 2026-08-30

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort high. The runtime does not expose the selected model, so the user's route selection is relied on; this is stated, not claimed as verified.
- **Reviewed artifact after response**: the uncommitted working-tree diff against `9e19ebc`, `git hash-object` digest `ae6bdce4258c832bd0f0f1f481bcb84ca8f13c80`. Changed: `plan.md`, `CLAUDE.md`, `HANDOFF.md`, plus this section. No production code; nothing committed. Both reviewer rounds, the round-1 primary response and `reviews/ARCH-001-gate.md` are untouched.
- **Gate status**: no third pre-gate invocation — prohibited, and none was attempted. These corrections are **ungated**, as round 1's were.
- **`ARCH-001-R1-F01` is `resolved` and was not reopened.** The unconditional recorded-route prerequisite is unchanged and still the first statement in the branch; only what happens *after* it changed.

### Finding dispositions

#### `ARCH-001-R1-F02` — `accepted`

- **Factual assessment**: `confirmed` — the removal of the lower-bound mechanism was complete, but the *claim* I wrote about the result was false. The schedule-free branch returns before the pre-dawn branch is reached, so "04:00–07:00 is `unverified`, always" was contradicted by my own branch order in four places.
- **Independent verification**: re-read the branch first-hand rather than accepting the citation. Confirmed `PASS(basis: "schedule_free")` at what was step 2 precedes the pre-dawn check at what was step 5, so an admissible `walk` or `cycle` at 05:00 returns `PASS`. Confirmed all four contradicting statements exist as cited — the "So a session ending between 04:00 and 07:00 is `unverified`, always" sentence, the "What this design deliberately does not do" bullet, the Known-problems entry, and the `CLAUDE.md` non-negotiable. Also confirmed the reviewer's positive half: no first-departure value reaches `return_margin_*`, `binding_limit_*`, the schema or any positive test, and no waiting policy had been adopted.
- **Response**: the prose was wrong, not the branch order. **Scoped the terminal rule to schedule-bound-only mode sets**, which is the option the reviewer listed first and the only one that is not a policy change. A schedule-free mode has no first service to wait for — the pre-dawn gap is a *timetable* phenomenon, and "schedule-free" means exactly "not subject to a timetable". Suppressing a walk home at 05:00 would be a real product decision; it is **not adopted**, and both documents now say so explicitly so it cannot be made later by an accidental reordering.
- **Changes made**: `plan.md` "The pre-dawn gap is not modelled" now carries a two-row scope table (schedule-free set → `robust`/`schedule_free`; schedule-bound-only set → `unverified`/`pre_dawn_gap`), states that the branch order is what enforces the scope, and names the suppression option as a policy change that is not taken. The pseudocode gains an explicit `EVERYTHING BELOW THIS LINE RUNS ON A SCHEDULE-BOUND-ONLY MODE SET` marker after the schedule-free return, and the pre-dawn branch comment now says "on a schedule-bound-only set". The "What this design deliberately does not do" bullet, the *(no first-departure field)* schema row and the Known-problems entry are all re-scoped. `CLAUDE.md`'s pre-dawn non-negotiable is rewritten to the same scope, including the not-adopted policy statement. The test obligation now requires **both** halves: `transit`-only at 05:00 → `unverified` with `resolve_return_service` never called, **and** an admissible `walk` at 05:00 → `robust` with basis `schedule_free`, with a note that asserting `unverified` for the walk case asserts a policy this design does not adopt.
- **Verification**: scripted multiline check confirms the schedule-free return precedes `pre_dawn_gap` in the branch; that no unqualified "`unverified`, always" claim survives in either document; that the scope table and the not-adopted policy statement are present in both; and that the walk-at-05:00 test obligation exists. Re-read the full branch block to confirm the marker sits between the two returns.

#### `ARCH-001-R1-F03` — `accepted`

- **Factual assessment**: `confirmed` — a genuine and consequential gap. `00:30-00:35` admitted two conforming readings, `(30, 35)` and `(1470, 1475)`, selecting different absolute departures. Worse than the reviewer states: the validation order made it unfixable in place, because "edges are not strictly increasing" applied to raw digits would have rejected `23:55-00:05`, a perfectly ordinary band.
- **Independent verification**: read the resolver's validation lines and the data-contract prose first-hand. Confirmed the resolver required `HH:MM-HH:MM`, strictly increasing edges and `[0, 2 × 1440)` offsets, with no statement of how a clock string becomes an offset, and that the later prose only asserted that the conversion happens. Worked the `23:55-00:05` case by hand and confirmed the pre-normalisation increasing check rejects it — so the omission was not merely under-specification, it was a live defect on a band the design's own examples imply.
- **Response**: accepted; the conversion is defined explicitly and reuses the service-day boundary already in the contract rather than introducing a second rule. One boundary, one rule: a clock time earlier than `RETURN_SERVICE_DAY_START_MINUTES` belongs to the following calendar date and gains 1440. Validation is re-ordered to run **after** normalisation, and the range is tightened from `[0, 2 × 1440)` — which was both too loose and, being checked first, unreachable in the cases that mattered — to `[240, 1680)`, the service day exactly.
- **Changes made**: new `plan.md` subsection "From clock string to service-day offset" defining `normalise_edge` and `normalise_band`, with a worked table covering `23:20-23:25`, the midnight-straddling `23:55-00:05`, the wholly-after-midnight `00:30-00:35`, the boundary-straddling `03:58-04:02` (`MALFORMED`, caught by `lo < hi` with no extra rule), and `25:00-25:05` (`MALFORMED` — offsets are written as clock times, never pre-added). `resolve_return_service`'s validation block now normalises first and requires `lo < hi` afterwards, with a comment saying why. New subsection "`edge(band, b)` — which end each bound takes": the **upper** bound takes `lo` (pessimism on a last departure is *earlier* service, the mirror of a travel band's *longer* journey), the **mid** bound takes `floor((lo + hi) / 2)`, floored because rounding a last departure down can only warn sooner and because every offset downstream must be an integer. The data-contract prose now points at the rule and gives the `00:30` → `1470` example rather than asserting the conversion abstractly. `CLAUDE.md`'s resolver non-negotiable carries the normalisation rule, the range, the after-normalisation ordering check and the `edge()` asymmetry. Two test obligations added: band normalisation across all five table cases, and `edge()` taking opposite ends for the two bounds **with a travel band in the same test still taking its upper edge**, so the two rules cannot be silently merged.
- **Verification**: scripted checks confirm the `raw + 1440` rule, the `00:30-00:35` → `(1470, 1475)` row, the after-normalisation ordering check, the `[240, 1680)` range in both documents, the `edge()` definition for both bounds, and that the stale `[0, 2 × 1440)` bound is gone. Two of these initially reported FAIL against a whitespace-flattened copy of the document because the predicates contained the pseudocode's column alignment; re-checked against the raw file and confirmed present at `plan.md:938` and `plan.md:966-967`. This is the same class of predicate error the round-1 response recorded, and it is recorded again rather than quietly re-run.

#### `ARCH-001-R1-F04` — `accepted`

- **Factual assessment**: `confirmed` — the basis block, the constants table and the closed open question were all correct and consistent; the symbol table was simply missed. A one-line contradiction, but it is the label a reader meets first.
- **Independent verification**: read the cited line first-hand and confirmed it still read `constant (provisional)` for both core constants. Also re-read the basis block and the constants table to confirm the reviewer's positive findings — the attribution to the round-1 reviewer's own check, the scope, and the withdrawal/re-check rules — so the fix would not reintroduce an overclaim.
- **Response**: accepted; the label is corrected to match the maintained-assumption contract, and it points at the basis block rather than restating it, so the two cannot drift apart again.
- **Changes made**: the symbol-table row now reads `constant (**maintained assumption** — neither provisional nor frozen; see "The claim, its basis, its scope, and its maintenance")`.
- **Verification**: scripted check confirms no `constant (provisional)` label remains on either core-span constant, that the maintained-assumption label is present, and that the basis block still carries all four of Sources, Checked, Scope and Maintenance.

#### `ARCH-001-R2-F01` — `accepted`

- **Factual assessment**: `confirmed` — and the reviewer's impact analysis is the decisive part. The algorithm resolved and validated every schedule-bound entry *before* the span check and then required a `PRESENT` entry to pass, which restored the whole 28-venue timetable-maintenance burden the span was introduced to remove, while three other places in the document continued to say that burden was waived.
- **Independent verification**: read all five cited locations first-hand — the governing prose, `CLAUDE.md`'s non-negotiable, Phase 1's acceptance criterion, the test obligation, and the pseudocode — and confirmed that the first four say no `return_transport` data is needed inside the span while the fifth requires it. Confirmed the reviewer's sharpest point: my own test obligation said an entry passes "without any band being read", which is impossible when the resolver must parse and validate that band to return `PRESENT`. The contradiction was self-evident once the two were read together.
- **Response**: accepted, and the timetable-waiver contract is the one kept — it is what the span exists for, and it is what Phase 1 acceptance was written against. The core-span pass moves **after** the route prerequisite and the schedule-free check but **before** `resolve_return_service`, so no lookup occurs inside the span. This does not weaken resolved `R1-F01`: the recorded-route prerequisite is unchanged, unconditional and still first. The two files answer two different halves — `access[origin_a]` says *whether* a route home exists and is required at every hour; `return_transport` says *when* the last service leaves and is what the span waives. Conflating them is what produced both defects, so the distinction is now stated as a table rather than left to prose.
- **Changes made**: `plan.md` "Evaluating one bound" restructured to route → schedule-free → **core span (no lookup)** → pre-dawn (no lookup) → resolve → `no_data` → `MAX`; only step 5 touches `return_transport`, and the block says so. The core-span section gains an `access` versus `return_transport` table with a "Required inside the span?" column and a paragraph recording what the earlier draft did and why it was wrong. A consequence I had left implicit is now stated: **a malformed band is not detected by a bound that never reaches step 5**, so a daytime session will not surface a typo — the backstop is a **structural check over `data/venues_meta.json` as a whole**, independent of any evaluation path, added to the test obligations alongside the existing `basis` privacy check, with `MALFORMED` at step 5 remaining the runtime guard. `CLAUDE.md`'s core-span non-negotiable is rewritten to name `access` as the route and `return_transport` as the timetable, and to state that requiring a `PRESENT` entry inside the span reinstates the maintenance it claims to waive. The contradictory test obligations are replaced: in-span pass is now asserted on a venue whose `return_transport` is **entirely absent**, with `resolve_return_service` **never called** (assert the call count, not just the outcome), and the paired case is no usable `access[origin_a]` at the same hour → `unverified` / `no_recorded_route`. The out-of-span `no_data` case is tested at 22:00.
- **Verification**: scripted multiline checks confirm the core-span pass precedes the single `resolve_return_service` call site in the branch; that no `if present is non-empty` guard survives; that the branch contains exactly one resolver call; that the prose, `CLAUDE.md`, Phase 1 acceptance and the test obligations now all state that no entry is required or read inside the span; and that the new test asserts the never-called resolver. Read the rewritten branch block in full to confirm the ordering.

### User-directed revisions

- None beyond the four unresolved IDs. The user directed the primary to preserve all resolved round-1 behaviour, which the verification rerun checks explicitly rather than assuming.

### User decisions required

- None. The reviewer noted that suppressing schedule-free evidence pre-dawn, or requiring timetable data inside the span, would each be a policy change requiring surfacing. **Neither was selected.** Both corrections restore the contract that was already written down elsewhere in the documents; the scope table and the `access`/`return_transport` table now make each one explicit rather than inferable.

### Preserved from earlier rounds

- `R1-F01`'s safety property is untouched: the recorded-route prerequisite is still the first statement in the branch, still unconditional, and still returns `UNVERIFIED(no_recorded_route)` on an empty admissible set at every hour of the day.
- Schedule-free modes remain positive evidence; the pre-dawn scoping made that explicit rather than superseding it, and the suppression alternative is named and declined in both documents.
- `unverified` remains distinct from hours `UNKNOWN`; `invalid` / `MALFORMED` remains outside `overall_tier`; the ordering `robust > tight > shorter > unverified` is unchanged; `shorter` still means "leave earlier", since every finite return margin is still `last_departure − session_end`.
- Plan B still uses each fallback's own `return_transport` and `access[origin_a]`; `bicycle_with_you` remains an explicit threaded input; no live transit source and no production code were added.

### Verification rerun

- Required verification rerun as a multiline sweep over both governing documents, grouped by finding and including a preserved-behaviour group for every item the user named. The first run had 33 assertions, of which 31 passed; the 2 failures were predicate errors in the check script itself — both matched pseudocode column alignment against a whitespace-flattened copy — and both were re-checked against the raw file and confirmed present. The final rerun, with those two predicates corrected to read the raw file and two assertions added, is **35 assertions, all passing**. No document defect was found by either run.
- Frozen-invariant cross-check: no live data and no fetcher; `venues_meta.json` still hand-maintained and script-free; brand-neutral naming; bands not exact values with the `basis` privacy rule intact; `AT_LEAST(0)` consumed only through the named accessors; `NONE` / `UNKNOWN` / `COVERED` distinct and branched before arithmetic; absolute-minute arithmetic, now with the clock-to-offset conversion defined rather than assumed.
- `git diff --check` — clean, exit 0.

---

## Review round 3 — 2026-08-30

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol`
- **Runtime model verification**: per the standing constant in `WORKFLOW.md`; the runtime does not expose the selected model, so the user's route selection is relied on.
- **Reviewed artifact**: correction delta represented by the uncommitted working-tree diff against `9e19ebc`, `git hash-object` digest `ae6bdce4258c832bd0f0f1f481bcb84ca8f13c80`, plus the reviewer-frozen `Primary response to review round 2` section at `reviews/ARCH-001.md:213-274`. Scope was limited to the round-2 corrections; no production code exists and nothing is committed.

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-001-R1-F02` | `resolved` | The executable order is route prerequisite → schedule-free pass → core-span pass → schedule-bound-only pre-dawn refusal (`plan.md:1061-1090`). Thus an admissible walk/cycle at 05:00 returns `schedule_free`, while a transit-only set returns `pre_dawn_gap` without a resolver call. The pre-dawn subsection, schema row, deliberate-exclusions bullet, Known problems, `CLAUDE.md:57`, and paired test at `plan.md:1914` all use that scope. Searches found no surviving lower-bound quantity in the symbol table, tier, binding-limit, or positive test contracts; `first_departure_band` survives only in explicit historical/removal prose. No waiting policy is adopted: closing the hole requires a separately modelled wait outcome. The stale branch-number reference is recorded separately as `ARCH-001-R3-F03`; it does not alter this semantic resolution. |
| `ARCH-001-R1-F03` | `unresolved` | `normalise_edge`, `normalise_band`, service-date selection, precedence, aggregation, Plan B bicycle viability, and `edge()` are now determinate. Independent arithmetic reproduces all five table outcomes: `(1400,1405)`, `(1435,1445)`, `(1470,1475)`, boundary-straddling `MALFORMED`, and syntactically invalid `MALFORMED`; wholly 00:00–04:00 bands map consistently to the following calendar date of the selected service day. However, the corrected absolute `MALFORMED`/unranking contract is not executable consistently across early-return paths (`ARCH-001-R3-F01`), and the test obligations still contain the retired range (`ARCH-001-R3-F02`). Two otherwise conforming implementations can therefore differ on whether whole-file validation is mandatory before ranking. |
| `ARCH-001-R1-F04` | `resolved` | The symbol table and constants table both label the two core constants a maintained assumption (`plan.md:336`, `plan.md:1368-1369`); no core-constant `provisional` label survives. The basis block remains unchanged in substance (`plan.md:1031-1047`): its two LTA sources, 2026-08-30 attribution to this reviewer's round-1 check, network-level ordinary-day scope, operator-change limitation, annual/known-change recheck, and withdrawal rule match what round 1 established and make no per-route claim. |
| `ARCH-001-R2-F01` | `resolved` | The core-span pass is after the unconditional route prerequisite and schedule-free branch but before the sole `resolve_return_service` call (`plan.md:1061-1094`). No `if present is non-empty` guard survives. Governing prose (`plan.md:993-1029`), `CLAUDE.md:53-54`, Phase 1 acceptance (`plan.md:1838`), and tests (`plan.md:1908`, `plan.md:1916-1917`; `CLAUDE.md:123`) agree that `access[origin_a]` is always required while `return_transport` is neither required nor read in-span. This does not regress `R1-F01`: absent or all-null access returns `no_recorded_route` before every time branch, and Plan B evaluates each fallback with its own access and return data (`plan.md:1113`, `plan.md:1295-1300`). |

### Findings

#### `ARCH-001-R3-F01` — Medium — Whole-file validation is not placed in the executable pipeline

- **Status at issuance**: `open`
- **Evidence**: schedule-free and core-span evaluation return before `resolve_return_service` (`plan.md:1069-1084`), and the design explicitly acknowledges that those bounds do not detect malformed return data (`plan.md:1121-1125`). Its only specified backstop is a structural check “listed in the test obligations”; `plan.md:1920` and `CLAUDE.md:123` likewise describe a test over the whole file, not a mandatory load/merge validation step. Yet `plan.md:982-987`, `plan.md:1187-1190`, and `CLAUDE.md:55` state without qualification that `MALFORMED` is a per-venue validation failure, is checked first, and prevents ranking. Under the written pipeline, an in-span schedule-bound venue or any schedule-free venue can return `PASS` while its malformed band is never classified. One conforming implementer can run only the required test-time structural check; another can validate on load and mark the venue invalid before evaluation.
- **Impact**: the correction preserves the intended timetable waiver but weakens the round-1 malformed-data invariant: checked-in malformed data can silently produce a ranked pass unless the test suite happened to run and block delivery. The design does not say how the promised per-venue invalid state reaches ranking on paths that intentionally skip the resolver.
- **Recommended correction**: make the whole-file validator an explicit mandatory stage before ranking/generation, define its per-venue failure output, and state that evaluation cannot run for a venue it marks invalid; keep the early returns lookup-free. Alternatively, narrow the unconditional “malformed means unranked” contract and explicitly accept the weaker behavior, which would be a policy change requiring user attention.

#### `ARCH-001-R3-F02` — Medium — A test obligation still uses the retired normalization range

- **Status at issuance**: `open`
- **Evidence**: the corrected contract says every syntactically valid normalized edge lies in `[240, 1680)` and explicitly retires `[0, 2 × 1440)` (`plan.md:929-958`; `CLAUDE.md:55`). The normalization test agrees (`plan.md:1918`), but the adjacent malformed-data test still requires “an offset outside `[0, 2 × 1440)`” to unrank the venue (`plan.md:1922`). No valid `HH:MM` edge under `normalise_edge` can produce such an offset, so that limb is both stale and incapable of testing the new range boundary.
- **Impact**: the required tests disagree about the accepted domain and can be implemented vacuously or against the retired contract, undermining the claimed executable normalization definition.
- **Recommended correction**: replace the retired range in the malformed-data obligation with cases that exercise the actual `[240, 1680)` contract and its syntax rule, without duplicating the already-listed `25:00` case as though it were a valid normalized offset.

#### `ARCH-001-R3-F03` — Low — The pre-dawn subsection points to the wrong branch

- **Status at issuance**: `open`
- **Evidence**: the corrected pseudocode labels the terminal pre-dawn return as step 4 and the resolver as step 5 (`plan.md:1086-1096`), but the subsection immediately below still opens “Step 5 is deliberately terminal” (`plan.md:1131-1134`). Step 5 is not terminal; present entries continue to step 6.
- **Impact**: the prose misidentifies the branch whose terminal behavior enforces the no-wait policy, making the correction internally inconsistent even though the executable ordering itself is clear.
- **Recommended correction**: change the reference to step 4 and re-run the multiline consistency sweep against numbered branch references.

### Non-blocking observations

- The ordering decision still holds after removal of the lower-bound mechanism: every finite return margin remains `last_departure_b - session_end_b`, so `shorter` still means “leave earlier.” The stated ordering `robust > tight > shorter > unverified` consistently prefers a known shortened session with a verified way home over a full session with an unchecked return (`plan.md:1204-1220`; `CLAUDE.md:58-60`).
- Moving the resolver after the span and pre-dawn branches does not put `invalid` inside `overall_tier`; the four-value ordering and the `unverified`/hours-`UNKNOWN` distinction remain intact. The unresolved issue is how an invalid venue is identified before an early return, not how `invalid` is ordered.
- The 22-of-86 cycle-link consequence remains correctly scoped as a pre-existing Plan B defect exposed by this design (`plan.md:839-847`, `plan.md:1999`), not as a broadened fallback policy.

### Verification performed

- Ran the required reducer command exactly: `.venv/bin/python3 .cross-agent-workflow/finding_state.py reviews/ARCH-001.md --emit-chunks --actor reviewer-round2`; independently read the resulting live finding chunks and the full round-2 primary response rather than accepting its dispositions or scripted-check claims.
- Re-read the required `WORKFLOW.md` role, route, lifecycle, one-writer, targeted-round, and review-record sections; `HANDOFF.md` in full; `reviews/TEMPLATE.md`; the governing return-transport, decision-model, data-contract, Plan B, Phase 1, testing, Known problems, and open-question sections of `plan.md`; and all relevant `CLAUDE.md` non-negotiables and test obligations.
- Confirmed `HEAD == 9e19ebc3318556d863d4b03a2ecfd738c877c3bf`, the tracked-diff `git hash-object` digest is exactly `ae6bdce4258c832bd0f0f1f481bcb84ca8f13c80`, `git diff --check` is clean, no production code is in the diff, and the gate record contains only the two prohibited-to-repeat `GATE_FAIL` invocations.
- Re-traced every corrected branch for both bounds and Plan B: empty access cannot pass at any hour; schedule-free returns before both clock shortcuts; core span performs no timetable lookup; schedule-bound-only pre-dawn returns `unverified`; only ordinary out-of-span evaluation resolves data; missing entries become `no_data`; detected malformed entries take validation failure; present entries aggregate with `MAX`. Confirmed the tests require missing and all-null access inside the span and independent fallback data.
- Worked the five normalization cases independently from the written rule and checked service-date/weekday interaction: 03:30 Saturday selects Friday's service date, then an after-midnight normalized edge is added to that service date; a band wholly between 00:00 and 04:00 therefore has one unambiguous coordinate, while a band crossing 04:00 fails `lo < hi` after normalization.
- Used multiline-aware searches for lower-bound remnants, `PRESENT` guards, normalization ranges, provisional core labels, pre-dawn scope, malformed handling, Plan B independence, `invalid`/`overall_tier`, and `unverified`/`UNKNOWN`. Cross-checked the core-span basis against the evidence recorded by this reviewer in round 1 rather than treating the primary's attribution as new evidence.
- Cross-checked the correction delta against the frozen invariants: no live transit data or fetcher; no numerical seat probability; hand-maintained metadata; bands and privacy-limited `basis`; absolute-minute arithmetic; `AT_LEAST(0)` remains tagged; and hours `UNKNOWN` remains distinct from return `unverified`.

### Could not verify

- Runtime model identity; the interface does not expose it, so the user's `codex_sol` route selection is relied on.
- Runtime behavior, test activation, or the proposed whole-file structural validator, because this is a design-only assignment and no implementation exists. This limitation is material to `ARCH-001-R3-F01`.
- Route-specific service availability or temporary service changes beyond the network-level evidence established in round 1; the maintained assumption explicitly excludes those claims.

### User decisions required

- None. The findings can be corrected without selecting a new product policy if the primary makes whole-file validation a mandatory pre-ranking stage and repairs the two stale references.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 3 — 2026-08-30

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort high, the recorded route. The runtime does not expose the selected model, so the user's route selection is relied on; this is stated, not claimed as verified.
- **Reviewed artifact after response**: the uncommitted working-tree diff against `9e19ebc`, `git hash-object` digest `e82cab962543c70e33e3b83a31896a86a9910d8d`. Changed: `plan.md`, `CLAUDE.md`, `HANDOFF.md`, plus this section. No production code; nothing committed. All three reviewer rounds, both earlier primary responses and `reviews/ARCH-001-gate.md` are untouched.
- **Gate status**: no third pre-gate invocation — prohibited, and none was attempted. These corrections are **ungated**.
- **Not reopened**: `ARCH-001-R1-F01`, `R1-F02`, `R1-F04` and `R2-F01` are `resolved`. The verification rerun below re-checks each of them explicitly rather than assuming the corrections left them alone.

### Finding dispositions

#### `ARCH-001-R3-F01` — `accepted`

- **Factual assessment**: `confirmed` — and it is the most serious finding in this round, because it is the one place the design promised an invariant that nothing in the written pipeline could deliver. Two branches deliberately return before the resolver, so on those paths a malformed band was never classified at all, while three separate passages asserted without qualification that `MALFORMED` means the venue is not ranked.
- **Independent verification**: read all five cited locations first-hand and traced the consequence myself. Confirmed the outcome table, the return-tier paragraph and `CLAUDE.md`'s resolver bullet each stated the unconditional contract; confirmed the only named backstop was "listed in the test obligations"; and confirmed by reading the branch that a venue passing at 13:00 via `core_span`, or at any hour via `schedule_free`, never calls `resolve_return_service` and therefore never produces `MALFORMED`. The reviewer's framing is exactly right: a test-suite check fails a build, it does not mark a venue, and two conforming implementers could reasonably differ on whether validation was mandatory at all.
- **Response**: accepted, taking the first of the two options — make the validator a mandatory stage — because the alternative is a policy change (accepting that checked-in malformed data can produce a ranked pass) and nothing about this assignment calls for weakening a resolved round-1 invariant. The enforcement point moved out of the per-bound branch entirely: validation is a whole-file stage that **stamps the venue**, and evaluation reads the stamp as a precondition. That is what satisfies both requirements at once — the contract becomes executable on every path, and the early returns stay lookup-free, because the check is on the venue record rather than on `return_transport`.
- **Changes made**: new `plan.md` subsection "Whole-file validation is a mandatory stage, not a test obligation", defining `validate_return_transport(venues_meta) -> {venue_id: status}` over every reachable entry (`default` and every `by_weekday` key, every destination, every mode), its per-venue output `{"state": "ok"}` / `{"state": "invalid", "reason": …}`, where it runs, what it emits, and what ranking does with it. **A venue with no `return_transport` block at all is `ok`** — absence is `MISSING`, which yields `unverified`, and is explicitly not a validation failure. A `STEP 0` precondition is stated both in that subsection and as a preamble immediately above the "Evaluating one bound" pseudocode, so a reader arriving at either sees it; it does **not** renumber the branch. **Absent counts as invalid**, and the asymmetry is named rather than left to be inferred: missing *service information* fails open to `unverified`, missing *validation* fails closed, on the same reasoning that makes a missing in-window hours entry malformed data rather than a fallback. `build/refresh.py`'s ordered pipeline gains step 6, before the atomic replace, marked mandatory and unconditional because it checks hand-maintained metadata rather than fetched data; the old step 7 becomes 8. `data/venues.json` gains the generated `return_transport_status` field with its own contract paragraph. The resolver's `MALFORMED` outcome and the return tier's `invalid` value are both demoted in writing to redundant runtime guards that point at the stage. `CLAUDE.md` gains a dedicated non-negotiable for the stage and amends both the resolver bullet and the `refresh.py` step-order bullet.
- **Verification**: scripted multiline checks confirm the stage signature, the per-venue failure output, the `STEP 0` precondition text, the absent-means-invalid rule in both documents, the no-block-is-`ok` rule in both documents, the new numbered refresh step and its unconditional wording, the renumbering to step 8, the generated field and its contract paragraph, the "never re-derives" statement in both documents, and the demotion of both redundant guards. Separately re-confirmed that the branch still contains exactly one `resolve_return_service` call site and that the core-span pass still precedes it — the fix must not have bought enforcement back by reinstating a lookup, and it did not.

#### `ARCH-001-R3-F02` — `accepted`

- **Factual assessment**: `confirmed` — the limb was stale, and the reviewer's sharper point is the one that matters: it was also **vacuous by construction**. Under `normalise_edge`, no syntactically valid `HH:MM` input can produce an offset outside `[240, 1680)`, so "supply an offset outside `[0, 2 × 1440)`" names an input that cannot exist, and an implementer could satisfy it with a test that proves nothing.
- **Independent verification**: read the malformed-data obligation and the normalisation obligation side by side and confirmed they disagreed about the accepted domain. Worked the reachability question myself rather than accepting it: the maximum valid raw value is `23:59` → 1439, which is ≥ 240 and so is left unshifted; the minimum is `00:00` → 0, which is < 240 and so gains 1440 → 1440. Every valid input therefore lands in `[240, 1680)`, and the old bound is unreachable. Also confirmed the reviewer's caution about duplication — `25:00-25:05` was already listed in the normalisation obligation, so reusing it here would have made the two overlap rather than complement.
- **Response**: accepted. The retired range is replaced by cases that exercise the *actual* contract, and the range itself is re-expressed as what it is — an **invariant**, tested as a property over the whole input domain rather than by an input that cannot be constructed. That is the only non-vacuous way to test a bound nothing can violate.
- **Changes made**: the malformed-data obligation now lists a syntactically invalid edge (`23:5`, `2360`, `24:00`, `23:60`), a band whose edges are **equal** after normalisation (`23:20-23:20`), and a **plainly inverted** band (`23:25-23:20` → `(1405, 1400)`), with an explicit instruction not to reuse the `03:58-04:02` or `25:00-25:05` cases already covered above. A separate obligation asserts the `[240, 1680)` invariant as a property: `normalise_edge` over **all 1440 clock values** lands in range, with both boundaries hit exactly — `04:00` → `240` (inclusive low) and `03:59` → `1679` (one below the exclusive high) — and states that the retired bound must not appear in any test. The old "structural check over `venues_meta.json`" obligation is replaced by one scoped to `validate_return_transport`'s coverage, including a malformed band under a `by_weekday` key no current session would select. `CLAUDE.md`'s test list carries the property test and its two boundary values.
- **Verification**: scripted checks confirm the retired bound no longer appears in any test obligation; that its only two surviving occurrences are the prose explaining why it was retired; that all three new malformed cases and the no-duplication instruction are present; that the property test and both boundary values appear in `plan.md` and `CLAUDE.md`; and that the stage-coverage obligation replaced the structural-check one.

#### `ARCH-001-R3-F03` — `accepted`

- **Factual assessment**: `confirmed` — a stale reference left by the round-2 reordering. Step 4 is the terminal pre-dawn branch; step 5 resolves and continues to step 6 for present entries, so the sentence named the wrong branch as the one enforcing the no-wait policy.
- **Independent verification**: read the pseudocode's own numbered labels and the subsection opener together, and confirmed the mismatch. Also checked every other numbered branch reference in the surrounding prose so the fix would not be one-of-several: the remaining reference, "`MALFORMED` at step 5", is correct — that *is* the resolver — and no other stale number was found.
- **Response**: accepted; corrected to step 4, and a branch-number check added to the verification sweep so a future reordering cannot leave a stale reference behind silently. This is the second time a reordering has left a numbered reference stranded, which is why the check is now mechanical rather than a reading pass.
- **Changes made**: "Step 5 is deliberately terminal" → "Step 4 is deliberately terminal". No other text changed for this finding.
- **Verification**: the sweep now parses the pseudocode's `# N. …` labels directly and asserts that label 4 is the pre-dawn branch and label 5 the resolver, then asserts the subsection opens on step 4 and that no "Step 5 is deliberately terminal" string survives. All pass. One predicate initially reported FAIL because it matched "return_transport is read" against the block's actual "return_transport read at all"; re-checked against the parsed labels and confirmed correct — a predicate error, not a document defect, and the third of its kind across these rounds, all recorded rather than quietly re-run.

#### `ARCH-001-R1-F03` — `accepted`

- **Factual assessment**: `confirmed` — the reviewer's positive half is accepted as-is: normalisation, service-date selection, precedence, aggregation, Plan B bicycle viability and `edge()` are determinate, and the reviewer reproduced all five table outcomes independently. What remained unresolved was **not** the normalisation contract itself but the two defects it depended on — the unenforceable `MALFORMED` invariant and the stale test range — which are `R3-F01` and `R3-F02` above.
- **Independent verification**: re-derived the reviewer's own arithmetic rather than accepting the reproduction: `23:20-23:25` → `(1400, 1405)`; `23:55-00:05` → `(1435, 1445)`; `00:30-00:35` → `(1470, 1475)`; `03:58-04:02` → `(1678, 242)`, rejected by `lo < hi`; `25:00-25:05` rejected on syntax. Confirmed the wholly-00:00-to-04:00 case the reviewer raised: both edges shift by 1440, so the band stays ordered and maps to a single unambiguous coordinate on the selected service day. Confirmed nothing in the round-3 corrections altered `normalise_edge`, `normalise_band`, `edge()`, the precedence order or the service-date rule.
- **Response**: accepted. No change was made to the normalisation contract, because none was asked for and none is warranted — the finding's residue was entirely the two derived defects. Recording it as its own disposition rather than folding it into `R3-F01` keeps the reviewer's finding-state sequence intact and makes explicit that the primary is claiming resolution *by way of* the other two fixes, not by a fresh edit here.
- **Changes made**: none to the normalisation contract. `resolve_return_service`'s `MALFORMED` outcome paragraph gained a pointer stating that enforcement lives in `validate_return_transport` rather than in the resolver, which is the sentence that closes the "is whole-file validation mandatory?" ambiguity the reviewer named as the reason this finding stayed open.
- **Verification**: scripted checks confirm the normalisation rule, the worked table, the after-normalisation ordering check, the `[240, 1680)` range in both documents and the `edge()` definition are all unchanged and still present; and that the new pointer to the mandatory stage exists in both the resolver paragraph and `CLAUDE.md`'s resolver bullet.

### User-directed revisions

- None beyond the four IDs. The user directed the primary to preserve the resolved behaviours, which the verification rerun checks explicitly as its own group rather than assuming.

### User decisions required

- None. The reviewer noted that narrowing the "malformed means unranked" contract would be a policy change requiring user attention. **That option was not taken.** The invariant is preserved and made executable instead, which is the correction the reviewer recommended first.

### Preserved from earlier rounds

- `R1-F01`: the recorded-route prerequisite is still the first statement in the branch, unconditional, returning `UNVERIFIED(no_recorded_route)` on an empty admissible set at every hour. The new `STEP 0` sits **above** it as a venue-level precondition and does not disturb the branch numbering.
- `R1-F02`: schedule-free still precedes the pre-dawn refusal, so an admissible walk or cycle at 05:00 still returns `PASS(schedule_free)`; no lower-bound arithmetic and no `first_departure_band` returned; no waiting policy adopted.
- `R2-F01`: the core span still performs **no** `return_transport` lookup — verified after the change, since the whole risk of this round's fix was buying enforcement back by reinstating a read. The branch still contains exactly one resolver call site.
- `R1-F04`: the maintained-assumption attribution, sources, checked date, scope and withdrawal rule are untouched; no `provisional` label returned.
- Plan B still uses each fallback's own `return_transport` and `access[origin_a]`; `bicycle_with_you` remains explicit; `unverified` remains distinct from hours `UNKNOWN`; `invalid` remains outside `overall_tier`; the ordering `robust > tight > shorter > unverified` is unchanged and `shorter` still means "leave earlier"; no live transit source, no fetcher, no production code.

### Verification rerun

- Required verification rerun as a multiline sweep over both governing documents, grouped by finding, with a preserved-behaviour group covering every item the user named. One assertion in the first run failed on its own predicate — matching "return_transport is read" against the block's "return_transport read at all" — and was re-checked against the pseudocode's parsed `# N.` labels and confirmed correct. The final sweep is **37 assertions, all passing**. No document defect was found by the rerun.
- The sweep now **parses the pseudocode's branch labels directly** and asserts prose references against them, rather than pattern-matching a step number. This is a permanent addition, added because a reordering has now stranded a numbered reference twice.
- Frozen-invariant cross-check: no live data and no transit fetcher; `venues_meta.json` still hand-maintained and never script-written — the new stage **reads** it and stamps a field on the *generated* `venues.json`, which is `refresh.py`'s own file; brand-neutral naming; bands not exact values with the `basis` privacy rule intact; `AT_LEAST(0)` consumed only through the named accessors; `NONE` / `UNKNOWN` / `COVERED` distinct and branched before arithmetic; absolute-minute arithmetic with the clock-to-offset conversion defined.
- `git diff --check` — clean, exit 0.

---

## Review round 4 — 2026-08-30

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol`
- **Runtime model verification**: per the standing constant in `WORKFLOW.md`; the runtime does not expose the selected model, so the user's route selection is relied on.
- **Reviewed artifact**: round-3 correction delta represented by the uncommitted working-tree diff against `9e19ebc`, `git hash-object` digest `e82cab962543c70e33e3b83a31896a86a9910d8d`, plus the reviewer-frozen `Primary response to review round 3` section at `reviews/ARCH-001.md:349-412`. No production code; nothing committed.

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-001-R1-F03` | `unresolved` | The normalization, `edge()`, precedence, service-date, aggregation, and Plan B bicycle contracts remain determinate and semantically unchanged (`plan.md:855-974`, `plan.md:1106-1166`). The new pointer correctly makes `validate_return_transport` the intended enforcement point. However, the stage still admits divergent implementations on its failure/write behavior (`ARCH-001-R4-F01`) and on whether a selected entry with no band is legitimate `MISSING` or structural invalidity (`ARCH-001-R4-F02`). The earlier ambiguity over mandatory whole-file enforcement is narrowed but not closed end to end. |
| `ARCH-001-R3-F01` | `unresolved` | A mandatory unconditional stage, generated `return_transport_status`, and ranking STEP 0 are now named in both documents (`plan.md:994-1042`, `plan.md:1710`, `plan.md:1826-1840`; `CLAUDE.md:56`, `CLAUDE.md:88`). The stage reads hand-maintained meta and writes only generated output, so it respects file ownership and preserves coarsen-before-fetch. The contract is nevertheless not executable consistently: it both blocks the atomic write on malformed data and promises an emitted `invalid` stamp for ranking, while the absent/invalid removal path has no complete loud-diagnostic or generated-artifact contract (`ARCH-001-R4-F01`); its traversal also conflicts with `MISSING` semantics (`ARCH-001-R4-F02`). |
| `ARCH-001-R3-F02` | `resolved` | Independent enumeration of all 1,440 valid clock strings gives exactly offsets 240–1679, with `04:00 → 240`, `03:59 → 1679`, and no out-of-range result. The retired range survives only in historical prose (`plan.md:956`, `plan.md:2000`), not as a test domain. The obligations separately cover invalid syntax, equal normalized edges, plainly inverted edges, the boundary-straddling case, and pre-added invalid syntax without duplicating the latter two (`plan.md:1995`, `plan.md:1999-2000`). Together these exercise the two actual `MALFORMED` classes: parse failure and `lo >= hi` after normalization. |
| `ARCH-001-R3-F03` | `resolved` | The pseudocode labels route/schedule-free/core/pre-dawn/resolver/aggregation as steps 1–6 (`plan.md:1122-1166`). Every surrounding reference matches: steps 3/4 are lookup-free, step 5 is the resolver and redundant `MALFORMED` guard, step 6 is `MAX`, step 4 is terminal pre-dawn, and step 2 is schedule-free (`plan.md:1135-1139`, `plan.md:1169-1220`, `plan.md:1455`). No stale “Step 5 is deliberately terminal” remains. |

### Findings

#### `ARCH-001-R4-F01` — Medium — Validation cannot both block the write and emit an invalid record for ranking

- **Status at issuance**: `open`
- **Evidence**: the new stage says a malformed band “blocks the write rather than reaching the generated page” (`plan.md:1019-1022`), and the ordered pipeline atomically replaces `venues.json` “only after validation passes” (`plan.md:1833-1840`). The same contract says the stage emits `{"state": "invalid", "reason": …}` into generated `venues.json`, ranking consumes that stamp, and tests require an invalid venue to be absent from ranked output at every hour (`plan.md:1011-1033`, `plan.md:1710`, `plan.md:2001`; `CLAUDE.md:56`, `CLAUDE.md:124`). Those outcomes are mutually exclusive unless “passes” is defined to include per-venue invalid results, which contradicts “blocks the write.” The only ranking-side failure surface is the pseudocode phrase “reason surfaced”; no UI/output obligation says where an invalid or absent-stamp reason appears, and the test requires only disappearance. Step 8 inlines the replaced data into the portable page, so a successful valid generation carries the stamp to `file://`; but the contract does not decide whether invalid meta leaves the prior page untouched or produces a new page containing an invalid stamp, nor does generated-artifact acceptance assert the stamp or its diagnostic.
- **Impact**: two conforming implementations can retain the last generated artifact globally or publish a per-venue invalid record. Under the latter reading, one missing validation stage can remove every venue with no required visible explanation; under the former, ranking never observes the `invalid` state the schema and tests require. The AirDropped and stale-artifact behavior therefore cannot be derived from the written pipeline.
- **Recommended correction**: choose and specify one failure model. If validation is per-venue, define stage completion as successful even with invalid statuses, atomically write those statuses, require a loud user-visible diagnostic for invalid and absent stamps, and assert the stamp/diagnostic in generated `index.html` including `file://`. If any invalid venue aborts generation, remove the unreachable invalid-stamp ranking contract, define retention and warning behavior for the last-known-good page, and keep absent-stamp handling for genuinely incompatible artifacts rather than silent filtering.

#### `ARCH-001-R4-F02` — Medium — The validator does not preserve missing-band fail-open semantics

- **Status at issuance**: `open`
- **Evidence**: `resolve_return_service` explicitly returns `MISSING` when a selected entry has no `last_departure_band` (`plan.md:906`), and the new section says missing service information is legitimate and must fail open to `unverified` (`plan.md:1014-1016`, `plan.md:1035-1039`; `CLAUDE.md:56`). But `validate_return_transport` unconditionally calls `normalise_band(entry.last_departure_band)` for every `default` and `by_weekday` entry (`plan.md:1005-1012`). For `{}` or another selected entry without the field, that call receives an absent value and can only be read as an unparseable band/invalid venue; no skip or `MISSING` branch is specified. The new coverage and malformed tests do not include this case (`plan.md:1997-2001`).
- **Impact**: the mandatory stage can turn absent service data into a validation failure that removes the venue, directly contradicting the assignment's fail-open requirement. Two conforming implementers can either skip the absent band to match the resolver or invalidate it to match the validator pseudocode.
- **Recommended correction**: make traversal mirror resolver semantics explicitly: an absent block, absent schedule entry, or selected entry without `last_departure_band` contributes `MISSING` and does not invalidate the venue; only a present band is normalized and may fail validation. Add a stage-level test for a present empty/default or weekday entry and require an `ok` stamp followed by evaluation-time `unverified` where no other evidence settles the return.

### Non-blocking observations

- The new stage does not write `venues_meta.json`; it reads the hand-maintained file and stamps `data/venues.json`, which remains solely owned by `refresh.py`. This respects the ownership invariant.
- Adding step 6 leaves the load-bearing refresh prefix intact: coarsening is still step 1, before either fetch; fetch, validation, merge, and freshness stamping remain steps 2–5. The correction does not disturb visit/histogram lineage.
- The previously resolved return branches did not regress: STEP 0 can only unrank, never manufacture a route; for a valid stamp the empty access set still returns `no_recorded_route`, schedule-free still precedes pre-dawn, the core span remains lookup-free, and the bound block contains exactly one `resolve_return_service` call site. The maintained core-span attribution and non-provisional labels are unchanged.

### Verification performed

- Ran the required command exactly: `.venv/bin/python3 .cross-agent-workflow/finding_state.py reviews/ARCH-001.md --emit-chunks --actor reviewer-round2`; read the live finding chunks and full round-3 primary response rather than accepting dispositions or scripted checks.
- Re-read `AGENTS.md`, the required `WORKFLOW.md` role/route/lifecycle/one-writer/review-record slices, `HANDOFF.md` in full, `reviews/TEMPLATE.md`, and only the governing validation-stage, resolver, bound evaluation, data-contract, refresh-pipeline, Phase 1, generated-artifact, testing, and relevant `CLAUDE.md` sections.
- Confirmed lifecycle `review_requested`, `HEAD == 9e19ebc3318556d863d4b03a2ecfd738c877c3bf`, exact tracked-diff digest `e82cab962543c70e33e3b83a31896a86a9910d8d`, changed-file scope, no production-code diff, `git diff --check` exit 0, and exactly two recorded `GATE_FAIL` outcomes.
- Independently enumerated the 1,440 syntactically valid clock values: minimum normalized offset 240, maximum 1679, zero outside `[240, 1680)`, with both declared boundary examples exact. Cross-checked all malformed cases and the retired-range occurrences multiline-aware.
- Traced the status from `venues_meta.json` through refresh step 6, atomic replacement, generated `venues.json`, HTML inlining, ranking STEP 0, and `file://` acceptance; separately traced invalid, missing stamp, no block, missing selected band, fully failed fetch, and stale/last-known-good branches.
- Parsed the numbered bound block and checked every nearby step reference against labels 1–6. Confirmed one resolver call site in the block, core-span and pre-dawn before it, and the route prerequisite before every time-based return.
- Cross-checked `plan.md` against `CLAUDE.md` for stage signature, unconditional execution, ownership, generated field, absent/invalid behavior, no-block behavior, normalization, `MALFORMED`, pipeline order, Phase 1, JS tests, Python tests, and generated-artifact/file-copy acceptance.

### Could not verify

- Runtime model identity; the interface does not expose it, so the user's `codex_sol` route selection is relied on.
- Runtime behavior, test activation, actual atomic-write behavior, or an AirDropped/stale generated artifact, because this remains a design-only assignment with no implementation. The contract-level ambiguity is recorded as `ARCH-001-R4-F01` rather than guessed through.

### User decisions required

- None. The primary can preserve the existing per-venue-invalid policy by choosing the first correction under `ARCH-001-R4-F01`; choosing global generation abort/last-known-good retention instead would change the recorded behavior and should be surfaced as a policy decision.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 4 — 2026-08-30

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort high, the recorded route. The runtime does not expose the selected model, so the user's route selection is relied on; this is stated, not claimed as verified.
- **Reviewed artifact after response**: the uncommitted working-tree diff against `9e19ebc`, `git hash-object` digest `bf8c329cbd52e6cfb5b5f83a7043f60554cd990d`. Changed: `plan.md`, `CLAUDE.md`, `HANDOFF.md`, plus this section. No production code; nothing committed. All four reviewer rounds, the three earlier primary responses and `reviews/ARCH-001-gate.md` are untouched.
- **Gate status**: no third pre-gate invocation — prohibited, and none was attempted. These corrections are **ungated**.
- **Not reopened**: `R1-F01`, `R1-F02`, `R1-F04`, `R2-F01`, `R3-F02` and `R3-F03` are `resolved`. The verification rerun re-checks each explicitly rather than assuming this round's edits left them alone.

### Finding dispositions

#### `ARCH-001-R4-F01` — `accepted`

- **Factual assessment**: `confirmed` — and it is a straight contradiction, not an ambiguity. The stage said a malformed band "blocks the write rather than reaching the generated page", the pipeline said the atomic replace happens "only after validation passes", and the same contract said the stage emits `{"state": "invalid", …}` into the generated file for ranking to consume. Both cannot be true: if the write is blocked, the `invalid` stamp is unreachable and the schema field, the `STEP 0` precondition and the test that requires the venue absent from ranked output are all dead letters.
- **Independent verification**: read all six cited locations first-hand and worked the two readings through myself rather than accepting the summary. Under "blocks the write", `return_transport_status` can only ever hold `"ok"` in any file that exists, so `STEP 0`'s `!= "ok"` branch is unreachable and the round-3 correction bought nothing. Under "emits invalid", the pipeline sentence is false. Also confirmed the reviewer's secondary point: the only failure surface anywhere was the pseudocode phrase "reason surfaced", with no obligation saying *where* it appears, and the generated-artifact acceptance list asserted neither the stamp nor any diagnostic — so a venue could vanish from the board with no required explanation, which is precisely the silent-disappearance failure this project's "degradation must be visible" rule exists to prevent.
- **Response**: accepted, taking the **per-venue** model — the first of the reviewer's two options, and the one the user directed. It is also the only one consistent with the rest of this pipeline, where a per-source failure degrades one field and a `businessStatus` change flags one venue; nothing here has ever failed globally. The contradictory statements are removed rather than reconciled, the model is stated once in a table so it cannot drift again, and the rejected alternative is recorded with its reasons so a later reader does not re-open a settled choice.
- **Changes made**: "Where it runs" is rewritten to "Where it runs, and that it never aborts" — the stage **completes successfully whatever it finds**, including when every venue is `invalid`; it is a *classifier, not a gate*; statuses are written **atomically with the rest of `venues.json`**; and **malformed metadata never blocks the write**. New subsection "One failure model: per-venue, never global" states stage outcome, write behaviour, damage scope, ranking behaviour and user-visible behaviour in one table, and records the rejected abort-and-retain alternative with its three reasons. Pipeline step 6 gains "It classifies; it never aborts"; step 7's "only after validation passes" is rewritten to name **step 3's contract validation of the fetched data** and to state that step 6's per-venue statuses are outputs of the generation, never a precondition for it. A **required diagnostic** is specified: every venue dropped at `STEP 0` is listed by name with its `reason` — or "return transport data was never validated" for an **absent** stamp — **in the page itself**, not only a console message or the refresh log, and kept **distinct from the `unverified` group** because the two have different fixes. Generated-artifact acceptance gains two assertions — every inlined venue carries a `return_transport_status`, and an `invalid` venue's removal notice renders in the emitted HTML with its name and reason — and the `file://` bullet now requires both to survive into the AirDropped copy. The manual checklist gains a matching item. Three test obligations added: per-venue-never-global (stage returns successfully, write still happens, other venues unaffected), the loud removal notice, and the absent-stamp wording. `CLAUDE.md` carries the classifies-never-aborts rule, the per-venue failure model, the required visible diagnostic, the distinctness from `unverified`, and the amended `refresh.py` step-order bullet.
- **Verification**: scripted multiline checks confirm no "blocks the write" claim survives; that the bare "only after validation passes" wording is gone; that both documents state the stage classifies and never aborts; that the failure-model table and the rejected alternative are recorded; that stamps are written atomically; that the diagnostic is required, page-visible and distinct from `unverified` in both documents; and that the stamp assertion, the removal-notice assertion, the `file://` coverage, the manual checklist item and the three test obligations all exist.

#### `ARCH-001-R4-F02` — `accepted`

- **Factual assessment**: `confirmed` — and this one was a live fail-open violation, not a documentation gap. The traversal called `normalise_band(entry.last_departure_band)` unconditionally for every reachable entry, so a selected entry present but carrying no band handed an absent value to a parser whose only defined outcomes are a pair of offsets or `MALFORMED`. The stage would have turned *absent service information* into a *removal* — the exact inversion of the assignment's central acceptance criterion.
- **Independent verification**: read the validator traversal and `resolve_return_service` side by side. Confirmed the resolver returns `MISSING` for exactly that case at `plan.md:906`, that the new section's own prose calls absence legitimate and requires it to fail open to `unverified`, and that the traversal contradicted both. Confirmed the reviewer's coverage point: none of the new obligations exercised an entry-without-band, so the divergence was untested as well as unspecified. Also checked the two other absent shapes — no block at all, and a block present with this destination/mode absent — and confirmed only the first was named, leaving the middle one to inference.
- **Response**: accepted. The traversal is rewritten to mirror the resolver's three-way split exactly, with each `MISSING` shape an explicit `continue` rather than something a reader has to infer, and all three enumerated in a table. The rule stated positively: **only a present `last_departure_band` that fails `normalise_band` yields `invalid`.** The two functions must not draw the split differently, or they would disagree about the same record.
- **Changes made**: `validate_return_transport`'s pseudocode rewritten with a `ONLY A PRESENT BAND IS VALIDATED` header and three guarded `continue  # MISSING` branches — absent block, absent entry, entry without `last_departure_band` — before `normalise_band` is ever called, and with per-venue `failures` accumulating rather than a single early exit. A three-row table names each `MISSING` shape with its stage result and its evaluation-time result. `CLAUDE.md`'s stage non-negotiable states the same rule and why: a stage that invalidated them would turn absent service information into a removal, which is the opposite of failing open. Test obligation added for all three shapes stamping `ok` and then resolving `unverified` outside the core span, with an explicit note that a stage calling `normalise_band` on an absent value fails it.
- **Verification**: scripted checks confirm the header, exactly three `# MISSING` skips in the traversal, that the missing-band skip **precedes** the `normalise_band` call, the three-shape table, the positive rule statement, the `CLAUDE.md` mirror, and the new test obligation.

#### `ARCH-001-R3-F01` — `accepted`

- **Factual assessment**: `confirmed` — the reviewer accepted the stage, the generated field, the `STEP 0` precondition, the ownership respect and the preserved coarsen-before-fetch prefix, and held the finding open solely on the two defects above. That is the correct reading: the structure was right and its failure and traversal semantics were not.
- **Independent verification**: re-read the stage subsection, the pipeline step, the generated-field contract and both `CLAUDE.md` bullets to confirm nothing else in the round-3 correction was in question, and confirmed that the two round-4 findings are jointly sufficient — with the failure model settled and the traversal mirroring the resolver, every path from `venues_meta.json` through the stage, the atomic write, the inlined page and `STEP 0` now has one defined outcome.
- **Response**: accepted, resolved **by way of** `R4-F01` and `R4-F02` rather than by a separate edit here. Recording it as its own disposition keeps the reviewer's finding-state sequence intact and makes the dependency explicit rather than implied.
- **Changes made**: none beyond those recorded under `R4-F01` and `R4-F02`.
- **Verification**: the sweep's `R4-F01` and `R4-F02` groups are the evidence for this finding too; separately confirmed that the stage still respects `venues_meta.json`'s hand-maintained invariant (it reads that file and stamps only the generated `venues.json`), that `refresh.py` remains sole owner, and that coarsening is still step 1 ahead of both fetches.

#### `ARCH-001-R1-F03` — `accepted`

- **Factual assessment**: `confirmed` — the normalisation, `edge()`, precedence, service-date, aggregation and Plan B bicycle contracts are determinate and were not in question; the finding stayed open only on the stage's failure and traversal semantics, which are `R4-F01` and `R4-F02`.
- **Independent verification**: re-confirmed that none of this round's edits touched `normalise_edge`, `normalise_band`, `edge()`, the precedence order or the service-date rule — the only change inside `resolve_return_service`'s neighbourhood is that the validator now mirrors its `MISSING` semantics, which brings the two into agreement rather than altering either.
- **Response**: accepted, resolved by way of the two round-4 corrections. No change to the normalisation contract, because none is warranted.
- **Changes made**: none to the normalisation contract.
- **Verification**: scripted checks confirm the normalisation rule, the service-date rule, `edge()` and the `[240, 1680)` range are all present and unchanged in both documents.

### User-directed revisions

- None beyond the four IDs. The user directed the per-venue option under `R4-F01` and the resolver-mirroring traversal under `R4-F02`; both are what the reviewer recommended first, so neither is a revision the review did not raise.

### User decisions required

- None. The reviewer noted that choosing global abort with last-known-good retention would change recorded behaviour and require surfacing. **That option was not taken** — the per-venue model is preserved and made coherent instead.

### Preserved from earlier rounds

- `R1-F01`: the route prerequisite is still the first statement in the branch and still returns `UNVERIFIED(no_recorded_route)` on an empty admissible set at every hour. `STEP 0` can only unrank; it can never manufacture a route.
- `R1-F02`: schedule-free still precedes the pre-dawn refusal; no lower-bound arithmetic and no `first_departure_band` returned.
- `R2-F01`: the core span still performs no `return_transport` lookup, and the branch still holds exactly one resolver call site — re-checked, because this round's edits touched the stage that feeds it.
- `R1-F04`: sources, checked date, scope, withdrawal rule and the non-provisional labels are untouched.
- `R3-F02` / `R3-F03`: the `[240, 1680)` property test and its boundary values are unchanged, and the branch labels still parse as 2–6 with step 4 the pre-dawn branch.
- Coarsen-before-fetch is still step 1; `refresh.py` remains sole owner of `venues.json` and `index.html`; `venues_meta.json` remains hand-maintained and is never written — the stage reads it and stamps the generated file. `unverified` remains distinct from hours `UNKNOWN`; the ordering `robust > tight > shorter > unverified` is unchanged and `shorter` still means "leave earlier"; Plan B still uses each fallback's own data; no live transit source, no fetcher, no production code.

### Verification rerun

- Required verification rerun as a **39-assertion multiline sweep** over both governing documents, grouped by finding, with a preserved-behaviour group covering every item the user named. All 39 pass on the first run — no predicate errors this time, the branch-label parser and raw-file reads added in earlier rounds having removed that class.
- Frozen-invariant cross-check: no live data and no transit fetcher; `venues_meta.json` hand-maintained and never script-written; brand-neutral naming; bands not exact values with the `basis` privacy rule intact; `AT_LEAST(0)` consumed only through the named accessors; `NONE` / `UNKNOWN` / `COVERED` distinct and branched before arithmetic; absolute-minute arithmetic with the clock-to-offset conversion defined.
- `git diff --check` — clean, exit 0.

---

## Review round 5 — 2026-08-30

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol`
- **Runtime model verification**: per the standing constant in `WORKFLOW.md`; the runtime does not expose the selected model, so the user's route selection is relied on.
- **Reviewed artifact**: round-4 correction delta represented by the uncommitted working-tree diff against `9e19ebc`, `git hash-object` digest `bf8c329cbd52e6cfb5b5f83a7043f60554cd990d`, plus the reviewer-frozen `Primary response to review round 4` section at `reviews/ARCH-001.md:481-544`. Changed assignment artifacts are `plan.md`, `CLAUDE.md`, and `HANDOFF.md`; the review response is appended in this untracked review record. No production code; nothing committed.

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-001-R1-F03` | `resolved` | The current contract still defines clock-to-service-day normalization before validation, the `[240, 1680)` range, `edge()`'s bound-specific ends, holiday/weekday/default precedence, and service-date selection (`plan.md:855-974`; `CLAUDE.md:52-55`). The mandatory classifier, stamped generated field, and STEP 0 precondition now make those resolver outcomes enforceable on branches that never call the resolver (`plan.md:994-1106`, `plan.md:1166-1247`). |
| `ARCH-001-R3-F01` | `resolved` | `validate_return_transport` is an unconditional whole-file generation stage, emits a per-venue status, always completes, and writes the statuses atomically with `venues.json`; ranking consumes the stamp before either bound and never re-derives it (`plan.md:1001-1102`, `plan.md:1166-1172`, `plan.md:1886-1904`; `CLAUDE.md:56`, `CLAUDE.md:88`). The two early return branches remain lookup-free without bypassing validation. |
| `ARCH-001-R4-F01` | `resolved` | The per-venue failure model is now single-valued end to end: invalid data is a classifier result, never a global abort; the write always proceeds; step 7 is conditioned only on step 3's fetched-data contract validation; and each invalid or absent-stamp removal requires a page-visible notice naming the venue and reason or the fixed never-validated wording (`plan.md:1040-1102`, `plan.md:1893-1904`; `CLAUDE.md:56`, `CLAUDE.md:88`). The stamp and rendered-notice obligations extend through the real generated HTML and `file://` acceptance (`plan.md:2065-2068`, `plan.md:2097-2120`). |
| `ARCH-001-R4-F02` | `resolved` | The stage pseudocode has three explicit `continue  # MISSING` guards—absent block, absent entry, and present entry without `last_departure_band`—all before `normalise_band`; the three-shape table and `CLAUDE.md` state the same PRESENT/MISSING/MALFORMED split (`plan.md:1005-1038`; `CLAUDE.md:56`). The stage-level obligation includes a present `{}` entry and explicitly fails an implementation that calls normalization on the absent value, so it is non-vacuous (`plan.md:2066`). |

### Findings

No findings.

### Non-blocking observations

- Return validation adds an intentional additional way for a venue to leave the ranked list, but not a silent one. The unconditional wording “every such removal” / “every venue dropped at STEP 0” requires the validation notice even if the same venue also lacks travel time or if absent stamps empty the board; the notice is separate from the ranked `unverified` group. The existing “travel time unknown”, “no low-risk option”, and “no verified way home” presentations remain about different candidate states and do not excuse or replace the validation notice (`plan.md:1089-1102`, `plan.md:1544-1566`; `CLAUDE.md:56`, `CLAUDE.md:60`).
- The diagnostic obligation is implementable: it fixes the page-visible surface, venue name, invalid reason, absent-stamp wording, separation from `unverified`, generated-artifact assertion, `file://` behavior, and manual check. Visual prominence remains appropriately an acceptance judgment rather than a pixel-level architecture rule.
- A current implementation encountering schema-incompatible inlined data with no stamp must unrank every affected venue and show the never-validated notice for each. A genuinely old self-contained HTML file necessarily retains the code and data embedded when it was generated; this design cannot retroactively change that immutable copy, and makes no contrary claim.
- Stamping a status derived from `venues_meta.json` into generated `venues.json` does not write the hand-maintained source. `refresh.py` remains the sole owner of `venues.json` and `index.html`; the validator reads meta and contributes generated output (`plan.md:1690-1772`, `plan.md:1886-1904`; `CLAUDE.md:63`, `CLAUDE.md:88-90`).
- The generated-artifact assertions add no external asset. The status and diagnostic data are in the already-inlined JSON/page, leaving the optional manifest as the sole external reference (`plan.md:98-153`, `plan.md:2097-2108`; `CLAUDE.md:90-93`).

### Verification performed

- Ran `.venv/bin/python3 .cross-agent-workflow/finding_state.py reviews/ARCH-001.md --emit-chunks --actor reviewer-round2` exactly and used its role-aware finding slice; independently read the round-4 finding blocks and primary dispositions rather than accepting their conclusions or scripted-check claims.
- Re-read `AGENTS.md`, the required `WORKFLOW.md` role/route/lifecycle/one-writer/reviewer slices, `HANDOFF.md` in full, `reviews/TEMPLATE.md`, and the correction-relevant return validator, resolver, evaluation, ranking, UI, data-contract, refresh, Phase 1, testing, generated-artifact, manual-checklist, and matching `CLAUDE.md` sections.
- Confirmed `HEAD == 9e19ebc3318556d863d4b03a2ecfd738c877c3bf`, reproduced the tracked-diff digest `bf8c329cbd52e6cfb5b5f83a7043f60554cd990d`, confirmed the changed-path boundary and no production-code diff, and found exactly two recorded `GATE_FAIL` terminal outcomes with no third invocation.
- Used multiline-aware searches across `plan.md` and `CLAUDE.md` for abort/write/validation wording, stamps, absent-stamp handling, removal notices, refusal messages, unrankable groups, normalization, `edge()`, precedence, service dates, the retired range, and removed first-departure behavior. No surviving statement makes malformed return metadata block or withhold the write, and step 7 names only step 3's fetched-data validation as its condition.
- Parsed the validator and bound pseudocode independently: exactly three MISSING skips precede the only validator normalization call; the bound block retains labels 1–6 in order, with route prerequisite → schedule-free → core span → pre-dawn → its single resolver call. Confirmed the `{}` test and its explicit absent-value failure condition.
- Independently enumerated all 1,440 valid clock values: normalized minimum 240, maximum 1679, zero outside `[240, 1680)`, with `04:00 -> 240` and `03:59 -> 1679`. Rechecked the worked normalization cases and the opposite `edge()` ends.
- Traced four status cases through the written pipeline: valid stamp, invalid stamp, absent stamp, and missing service data with a valid stamp. The first reaches evaluation; the second and third are unranked with mandatory visible diagnostics; the fourth reaches evaluation and can become ranked `unverified`. Also traced the all-absent-stamp case: it can empty the ranked board, but the contract still requires one never-validated notice per removal.
- Cross-checked ownership and generation: `venues_meta.json` remains read-only to scripts, `refresh.py` remains sole generated-file owner, coarsening remains step 1, statuses are outputs of step 6, fetched-data validation alone conditions step 7, and the page remains self-contained except for the optional manifest.
- Rechecked the already-resolved behaviors named by the user: route prerequisite first; schedule-free before pre-dawn; core span lookup-free; exactly one resolver call; sources/maintenance labels intact; `[240, 1680)` property test intact; branch labels 2–6 intact; no live transit source or production code added.
- Ran `git diff --check`; exit 0.

### Could not verify

- Runtime model identity; the interface does not expose it, so the user's `codex_sol` route selection is relied on.
- Runtime behavior, actual atomic-write behavior, browser rendering, or an AirDropped/stale generated artifact, because this remains a design-only assignment with no implementation. The corresponding implementation and acceptance obligations are now determinate in the governing documents.

### User decisions required

- None.

### Recommendation

`APPROVE`

```text
Act as the primary for ARCH-001 on the recorded route. Reconcile only HANDOFF.md from Review round 5: set the assignment state to review_complete, record the APPROVE recommendation and that all four re-reviewed findings are resolved, and set the next action to await the user's explicit decision. Do not edit plan.md, CLAUDE.md, reviews/ARCH-001.md, reviews/ARCH-001-gate.md, reviews/LEDGER.md, production code, or any other file. Do not commit or push. Then stop and state that ARCH-001 is awaiting the user's approval.
```

---
