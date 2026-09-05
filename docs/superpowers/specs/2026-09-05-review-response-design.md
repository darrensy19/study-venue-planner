# Review-response design: recommendation eligibility, achievable-time semantics, evidence visibility, publication robustness

**Status:** candidate design, **revision 5**, converged out-of-protocol per `WORKFLOW.md`'s
"Architecture exploration happens outside the protocol". **Not yet formalized as an assignment.**
The reviewable artifact, when this is opened, is the diff it forces into `PLAN.md` and `CLAUDE.md`.

**Trigger notice** (`CLAUDE.md`, "Flagging, without opening"): this trips the hard architecture /
public-contract trigger. No assignment ID has been allocated; per `CLAUDE.md` one is never opened
unilaterally.

**Origin:** an independent review by Astra at clean checkout `3e3decb`, then two adversarial
architecture reviews of revisions 0 and 1.

### What revision 5 changed

Round-2 targeted re-review (`ARCH-004`, `codex_sol`) returned `CHANGES_REQUESTED`: `F05` `resolved`,
`F01`-`F04` `unresolved` — the revision-4 corrections did not yet close their recorded failure modes.
All four were independently re-verified and **all four are accepted**; none was rebutted.

| Finding | Change |
| --- | --- |
| `F01` | The surviving live sentence calling identity + `failed` "a state the refresh pipeline cannot produce" is **deleted**, replaced by the qualified statement: not produced from a coherent history, but re-emitted from accepted inconsistent prior state |
| `F02` | The `metricsBasis` criterion becomes **two otherwise-identical hand-built renderer inputs differing only in `metricsBasis`**, because `returnTier` and `metricsBasis` co-vary exactly in real pipeline output |
| `F03` | Decision 40 gains **step semantics** (a UI affordance, not a validation rule — Decision 35 unchanged) and **deep immutability**; the form-derivation criterion becomes a **sentinel-contract** test through a dependency seam |
| `F04` | Naming for **all** 1a non-candidate diagnostics (`removed` **and** `travelUnknown`) moves into migration step 1a, the naming criterion is **split** into a 1a half and a 1b half, and D40 is described as a **module export**, not a returned-shape field |

### What revision 4 changed

Round-1 repo-grounded review (`ARCH-004`, `codex_sol_high`) returned `CHANGES_REQUESTED` with five
findings. All five were independently reproduced and **all five are accepted**; none was rebutted.

| Finding | Change |
| --- | --- |
| `F01` | **§6.4's unreachability claim was false as stated and is corrected.** `refresh.py` *does* emit identity + `failed` when handed an inconsistent prior record. Decision 38's guard becomes a live fail-closed boundary, not defence in depth |
| `F02` | `metricsBasis` added to §10's audit — it is rendered today and the audit missed it |
| `F03` | **Decision 40** adds one ranking-owned control contract the renderer consumes; `ORIGINS`/`MODES`/duration bounds stop being renderer-owned |
| `F04` | The "shape changes exactly once" claim is withdrawn and replaced by an explicit **two-step** public-shape migration, with naming/status foundations moved into slice 1a |
| `F05` | The interrupted-write criterion now requires a fault **after a partial prefix reaches the staging target** |

### What revision 3 changed

Revision 2 received **APPROVE WITH CONDITIONS**. This revision is narrowly scoped to those
conditions and reopens no settled architecture.

| # | Change | Driver |
| --- | --- | --- |
| A | **Decision 39** gives the naming contract a fallback source — the registry's `resolved_name` — so a venue with no Places identity still yields a labelled removal | The failed-hours path can produce a venue with **no stored `name`**, which the naming contract required |
| B | **§6.4 and Decision 38 are corrected.** ~~The reported crash is *not reachable* from any state `build/refresh.py` can emit~~; the reachable defect is a **misdiagnosis**, not a blank page. **The struck half is withdrawn — see revision 4 (`F01`) and revision 5.** It records what revision 3 claimed, not what this design now holds: the crash **is** reachable from accepted inconsistent prior state | Re-verified against the realistic record shape — see §6.4. Revision 2 overstated this; revision 3 then overcorrected |
| C | **Decision 16 no longer mandates a `generate_index_html()` signature change.** The existing `venues_path`/`output_path` seam already supports staging | The generator is already path-parameterised; the signature change was unnecessary |
| D | **Decision 15 gains a helper-level unit test** proving the projector does not erase unrelated structure, and reserves the two freshness field names | The behavioural non-vacuity control alone would pass a projector returning `{}` |
| E | Evidence tags updated for the final packet | `web/index.html` and the two Python test files are now included |

### What revision 2 changed

| # | Change | Driver |
| --- | --- | --- |
| 1 | **`FEASIBILITY_TOLERANCE_MINUTES = 15` moves to `ranking.js`.** No longer an open question | Revision 1 called this "a change to a settled contract" and deferred it. **That was factually wrong** — see §3.4 |
| 2 | Plan B presentation object carries `travelMinutesMid`; `bestAlternative` is selected by the pipeline; `invalid_request` carries its violated constraint | Revision 1 claimed the shape changed once but left three values the renderer could not obtain without deriving policy |
| 3 | `nothing_evaluable` carries **four** diagnostics simultaneously, including `snapshotEmpty` | A zero-venue snapshot produced no diagnostic at all; simultaneous causes were collapsed |
| 4 | `invalid_request` covers **all** user controls, not duration alone | An unsupported `mode` was indistinguishable from "no venue has access for this mode" |
| 5 | The stale-data invariant becomes a **structural** projection — delete freshness fields recursively, deep-compare the rest | Revision 1's hand-maintained whitelist would silently stop covering any field added later |
| 6 | Semantic UI criteria must prove **positive** rendering, not absence of bad text | Several could pass on a renderer that omitted the field entirely |
| 7 | Publication wording corrected; HTML must be generated from **prospective** data | Revision 1 said both artifacts are "rendered and validated in memory first (already true of both)". **That was factually wrong** — see §7.1 |
| 8 | DOM stub scope bounded explicitly, in both directions | Accepted direction, unbounded scope |
| 9 | **New defect, found while auditing freshness visibility:** a `failed` hours source mishandled — *revision 2 described this as a crash; **corrected in revision 3**, see §6.4* | §6.4 |
| 10 | Evidence tags updated for the expanded review packet | |

---

## 1. Evidence basis

Authored **with full repository access**; every claim checked against the working tree at `3e3decb`.
Claims are tagged for a reviewer holding the current review packet — `PLAN.md`, `CLAUDE.md`,
`DECISIONS.md`, `web/ranking.js`, `web/app.js`, `build/generate.py`, `build/refresh.py`,
`package.json`, `Makefile`, `tests/js/ranking.test.js`:

- **[packet]** — checkable from those files.
- **[repo]** — depends on material outside the packet. Treat as asserted.

The final packet additionally contains **`web/index.html`** (the generated artifact, with the data
snapshot inlined) and **`tests/python/test_refresh.py`** and **`tests/python/test_generate.py`**.
Claims resting on those files are therefore tagged `[packet]` from revision 3 onward, including all
four reproduced snapshot claims. `[repo]` is now reserved for evidence genuinely absent from the
packet: live test counts, the `data/` source files, and the remainder of the Python suite.

No conclusion below changed because an evidence tag changed.

**[packet]** Reproductions run against the snapshot embedded in `web/index.html`, not
`data/venues.json`: the hand-maintained meta — `access`, `area`, `preference`,
`baseline_seatability`, `return_transport`, `fallbacks` — is merged in at generation time, so the
embedded array is the only artifact reflecting what `rankVenues()` receives.

**[repo]** Baseline at `3e3decb`: 188 Python tests pass, 184 JS tests pass. Every confirmed defect
below is invisible to that suite.

**[packet]** Transport coverage in the embedded snapshot: `return_transport` on 26 of 28 venues,
`return_transport_status` on 28 (all `ok`), `outbound_transport` on 0.

---

## 2. Adjudication summary

| # | Finding | Classification |
| --- | --- | --- |
| 1 | Plan A can recommend a venue with 0 usable minutes | **Confirmed design gap** |
| 2 | Requested session end displayed as the session's end | **Confirmed implementation bug + contract gap** |
| 2b | `latest_leave_at` renders bare when already past | **Confirmed implementation bug** |
| 3 | Source freshness invisible | **Confirmed implementation gap against an existing unmet acceptance criterion** |
| 4 | Refresh can leave JSON and HTML from different runs | **Confirmed**; "stage and validate HTML" rejected as already partly implemented; preflight partially valid |
| 5 | Information hierarchy | **Accepted**, contradicts `PLAN.md`'s "every row shows every value" |
| 6 | Use stored venue names | **Partially valid** — 7 of 28 stored names are non-distinguishing |
| 7-11 | Vocabulary, midnight markers, focus, mobile testing, no framework | **Accepted** |
| 12 | Refusal populations not exhaustive or exclusive | **Confirmed defect in revision 0** |
| 13 | Session duration contradicts `PLAN.md`'s 3-6 hour scope | **Confirmed** |
| **14** | *(revision 2)* `FEASIBILITY_TOLERANCE_MINUTES` sited in `app.js` against an explicit `PLAN.md` contract | **Confirmed implementation drift** |
| **15** | *(revision 2, corrected in 3)* A first-ever failed source is misdiagnosed as `not_operational`; `resolveHours` is additionally non-total | **Confirmed implementation bug — but a misdiagnosis, not the blank page revision 2 claimed. See §6.4** |

---

## 3. Plan A eligibility

### 3.1 Reproduction

**[packet]** `home`/`transit`/`2026-09-05` (a Saturday)/`23:00`/`240`:

```
planA = starbucks-chinatown-food-street
  overall_tier       = shorter   (hours shorter, return shorter)
  usable_minutes_mid = 0
  surplus_mid        = finite(-257)
  binding_constraint = venue_close
refusals = { noLowRiskOption: false, noVerifiedReturn: null }
```

Rendered card: `Usable: 0m · latest leave: 18:43 · ends ~03:47 · 47m travel`. **No refusal banner.**
25 of 26 `shorter` candidates have `usable_minutes_mid` of `0` or `undefined`.

Arithmetic: the Saturday period is `open 450, close 1440`; `closing_buffer_minutes` is `null` so the
default 30 applies; arrival `23:47`; buffered close `23:30`, already behind the arrival.
`usable = max(0, min(1410, 1667) − 1427) = 0`.

### 3.2 Why this is a design gap

**[packet]** `PLAN.md`'s taxonomy bars **only** `unverified` from Plan A, and `ranking.js` implements
exactly that: `const planA = groups.ranked[0] ?? groups.shorter[0] ?? null`. `PLAN.md` states the
governing principle — *"A confident-looking recommendation built on nothing is worse than an honest
refusal"* — but wires it only to `seat_confidence`.

### 3.3 Design

**Decision 1 — separate "ranked" from "eligible for recommendation".** Group membership is unchanged;
`NONE` still never removes a venue. Only the **Plan A slot** gains an eligibility test.

**Decision 2 — Plan A requires `overall_tier ∈ {robust, tight}` and `seat_confidence ≥ mixed`.** No
duration floor, no new constant.

**[packet]** `robust`/`tight` already *mean* "the requested session fits"; `shorter` already means it
does not. `PLAN.md` already fixes the value of a partial session for Plan B: ≥
`PLAN_B_MIN_SESSION_MINUTES` (90) makes a fallback `salvage`, explicitly *"not a substitute for the
session"*. A design calling 90 minutes "not a substitute" when it rescues a failed trip and "good
enough to be the primary recommendation" when it is the best on offer holds two incompatible
positions on one number. Revision 0 did exactly that. **The tier already encodes the answer.**

`PLAN_A_MIN_SESSION_MINUTES` is **withdrawn**; no separate use remains.

**Decision 3 — Plan A is the first candidate in the existing sorted `ranked` population whose seat
confidence is at least `mixed`. Filter; never re-sort.** **[packet]** The established order is
`overall_tier`, `seat_confidence`, `backup_strength`, `travel_minutes_mid`, `preference`,
`surplus_mid`, `venue_id`. Because tier outranks confidence, a `robust`/`poor` candidate sorts ahead
of a `tight`/`dependable` one, so Plan A is **not** necessarily `ranked[0]`. Re-sorting eligible
candidates by confidence would install a second ranking order beside the documented one.

**Decision 4 — `shorter` is a visible degraded alternative, never Plan A.** It stays ranked and in its
own group. Under `session_does_not_fit` the pipeline names one **best degraded alternative** to show
below the refusal, explicitly labelled as not a recommendation — see Decision 33.

**Decision 5 — closed-at-arrival is a distinct fact.** A candidate whose `usable_minutes_mid` is
`undefined` renders as **"closed when you'd arrive"**, never `Usable: unknown`.

### 3.4 The tolerance constant — correcting revision 1

**Revision 1 was factually wrong here and the correction changes the outcome.** It claimed siting
`FEASIBILITY_TOLERANCE_MINUTES` in `app.js` was "a settled contract" that this design should not
disturb, and left it as the sole open question.

**[packet]** `PLAN.md` says the opposite, twice:

- the constants table: `| FEASIBILITY_TOLERANCE_MINUTES = 15 | constant (provisional) | ranking.js |`
- and in prose: *"`FEASIBILITY_TOLERANCE_MINUTES = 15`, provisional, **a named constant in
  `ranking.js`**"*

**[packet]** `web/app.js` defines it locally instead, with a comment observing that `ranking.js` has
no internal default for the hours-side tolerance. That is **implementation drift from an explicit
contract**, not a contract to preserve. Revision 1 inverted the direction of the deviation.

**Decision 31 — `FEASIBILITY_TOLERANCE_MINUTES = 15` is owned by `ranking.js`.**

- Declared in `ranking.js` alongside `RETURN_TOLERANCE_MINUTES`, `SEAT_CHECK_BUFFER_MINUTES`,
  `PLAN_B_MIN_SESSION_MINUTES` and `PLAN_B_MIN_CONFIDENCE`, all of which **[packet]** already live
  there with internal defaults.
- `rankVenues()` applies it as the default for `toleranceMinutes` when the caller supplies none,
  matching the existing parameter-default idiom (`returnToleranceMinutes = RETURN_TOLERANCE_MINUTES`).
- Tests may still override it explicitly; **[packet]** `tests/js/ranking.test.js` already passes an
  explicit tolerance throughout, so this removes no coverage.
- `app.js` no longer declares, owns or selects it. This restores `PLAN.md`'s stated placement and
  removes the last business-policy constant from the renderer.
- **The value stays 15.** This amendment relocates ownership; it does not retune. **[packet]**
  `PLAN.md`'s own "Open questions" section already carries *"Is `FEASIBILITY_TOLERANCE_MINUTES = 15`
  right?"* — tuning stays that question's business, in that section, not this design's.

This matters more under Decision 2 than it did before: with the duration floor withdrawn, this
constant alone fixes the `robust`/`tight` versus `shorter` boundary, and therefore the Plan A
boundary. A policy constant that decides whether a recommendation exists cannot live in the file
whose stated contract is that it decides nothing.

### 3.5 Consequence worth stating

A 6-hour request missed by 30 minutes is `shorter`, so there is no Plan A — where revision 0 would
have promoted it. That is the semantically correct outcome under `PLAN.md`, and stricter than today.

**Interaction preserved.** For a `shorter` candidate the return leg is still evaluated at the
*requested* session end. Rewiring it would change tier semantics document-wide and is out of scope.

---

## 4. Result states: total, disjoint, and diagnostically complete

### 4.1 What revision 0 got wrong

Three independent booleans cannot express mutual exclusion. With an all-`unverified` population,
revision 0's duration refusal fired **and** the unverified refusal fired; worse, the duration message
asserts no venue gives a usable session, which is **false** when hours support the full request and
only the return leg is unknown.

### 4.2 Live reproduction of the empty board

**[packet]** `origin=office`, `mode=cycle`: no venue carries an `access.office.cycle` key, so every
venue is hard-filtered before candidacy:

```
office/cycle → ranked=0 shorter=0 unverified=0 travelUnknown=0 removed=0
               planA=null   refusals={ noLowRiskOption: true, noVerifiedReturn: null }
```

The page states **"No low-risk option found for the requested session."** Nothing was evaluated;
there is no low-risk judgement to report.

### 4.3 Design

**Decision 6 — one discriminated `resultState`, not a set of booleans.** Exhaustiveness and exclusion
become properties of the type rather than of a precedence rule a reader must reconstruct.

**Decision 7 — control validation runs first**, before any population state. See Decision 35.

**Decision 8 — the six states. Exactly one holds, always.**

| Order | Condition | `resultState` | Means | Fix |
| --- | --- | --- | --- | --- |
| 0 | Controls invalid | `invalid_request` | The request is outside the supported range | Correct the request |
| 1 | `ranked` non-empty, ≥1 clears `mixed` | `plan_a` | A recommendation exists | — |
| 1b | `ranked` non-empty, none clears `mixed` | `no_low_risk_option` | Somewhere fits your session, but nowhere is likely to seat you | Different time, or accept the risk |
| 2 | `ranked` empty, `shorter` non-empty | `session_does_not_fit` | Everywhere shuts too soon, or needs you to leave for the last way home | Leave earlier, or shorten the session |
| 3 | `ranked` and `shorter` empty, `unverified` non-empty | `no_verified_return` | Nobody has recorded whether you can get back | Fill in `return_transport` data |
| 4 | All three groups empty | `nothing_evaluable` | Nothing could be assessed | Depends on the diagnostics |

**Why this is total and disjoint by construction, not by convention.** **[packet]**
`RETURN_TIER_RANK` makes `unverified` the lowest rank and `overallTier()` returns the worse of the
hours and return tiers, so a candidate whose return is `unverified` **always** has
`overall_tier === "unverified"`. **The `shorter` group therefore can never contain an unverified
return.** States 2 and 3 need no extra filtering to be disjoint. States 1/1b partition one
population; 2, 3 and 4 partition the remainder by successive emptiness; and every candidate lands in
exactly one of the three groups because `overall_tier` is a total function into four values, of which
`robust`/`tight` map to `ranked`. State 0 is evaluated before any of this and short-circuits.

**Decision 10 — no refusal message is reachable from more than one state**, and no two render
together. `plan_a` renders **no** refusal.

### 4.4 `nothing_evaluable` must be diagnostically total

**Decision 36 — the state carries four diagnostics, all preserved simultaneously. The renderer may
summarize; it may never infer which cause emptied the board.**

| Diagnostic | Meaning |
| --- | --- |
| `snapshotEmpty` | the snapshot contained zero venues — a valid input that otherwise produces no candidate, no removal, no travel-unknown entry and no hard-filtered venue, and so was previously undiagnosable |
| `hardFilteredCount` | venues rejected before candidacy for a missing `access[origin][mode]` entry |
| `travelUnknown` | the existing list, entries carrying the naming fields of Decision 21 |
| `removed` | the existing list, entries carrying reason, kind, naming and source status (Decision 37) |

**A single evaluation may have several of these non-empty at once**, and all must survive into the
state. Revision 1 implied a single cause; that was wrong.

**Decision 9 — the hard-filter count is an aggregate, and the taxonomy amendment is precisely
bounded.** **[packet]** `PLAN.md`'s row saying a missing `access` entry is "not a candidate at all —
*not* the travel-unknown group" **stands unchanged**. The amendment is narrower than revision 1's
wording suggested, and reads: *the pipeline may additionally report **aggregate** diagnostics about
pre-candidate rejection, for the sole purpose of explaining an empty board.* A scalar count is not a
per-venue listing; hard-filtered venues do **not** enter any ranking group, do **not** appear in
`removed`, and do **not** behave like removed candidates. Without the count, the `office/cycle` case
is indistinguishable from "every venue was removed".

### 4.5 `invalid_request` covers every user control

**Decision 35 — the pure entry point validates the whole user-facing control contract.** Purpose:
prevent malformed controls being misdiagnosed as a legitimate empty board. **[packet]** An
unsupported mode such as `"teleport"` currently produces zero candidates by hard-filtering every
venue, which is indistinguishable from `office/cycle` — a genuine "no recorded routes" case.

Validated: `origin` ∈ the supported set; `mode` ∈ the supported set; `departureDate` a well-formed
calendar date; `leaveAtMinutes` an integer in `[0, 1439]`; `durationMinutes` an integer in
`[180, 360]` — **every** integer in that range, on-step or not. Decision 40's `step` is a UI increment
and is not validated here.

This is **not** generalized schema validation and does **not** redesign snapshot validation, which
keeps its separate job (`preference` total order, naming uniqueness). Control validation concerns the
request; snapshot validation concerns the data.

**Decision 34 — `invalid_request` carries what the renderer needs to explain itself.** For each
violated control: which control, what was supplied, and the permitted range or set. `app.js` must not
independently know that sessions are 180-360 minutes or which origins exist — those are business
facts, and the renderer holds none.

**Decision 40 — one ranking-owned control contract, consumed by the renderer on every render.**

Revision 3 had a hole `ARCH-004-R1-F03` was right to open: Decision 34 forbids `app.js` from knowing
the supported origins or the duration bounds, while Decision 27 requires the form itself to enforce
`min: 180`/`max: 360`, and the only place revision 3 exposed a permitted set or range was **inside an
`invalid_request` explanation** — a value that exists only once the user has already submitted
something invalid. There was nothing to build the *initial, valid* form from.

**[packet]** Today the renderer can build the form only because it owns the facts: `ORIGINS` and
`MODES` are declared in `web/app.js`, and the duration input's bounds are written into the control it
creates. Under revision 3 an implementer had exactly three options, all bad — duplicate the sets and
bounds in `app.js` (violating Decision 34), fail to render the initial form, or invent an unapproved
export. The design must supply the fourth.

`ranking.js` exports a single **control contract** describing what `rankVenues()` will accept:

| Element | Content |
| --- | --- |
| Supported origins | the value tokens `origin` may take |
| Supported modes | the value tokens `mode` may take |
| Duration bounds | minimum and maximum, in minutes, plus the UI increment `step` — see the step rule below |
| Leave-at bounds | the permitted minute-of-day range |

Rules:

- **It is the single source.** `rankVenues()`'s own validation (Decision 35) and the
  `invalid_request` payload (Decision 34) both read it, and `app.js` builds every control from it.
  No supported value or numeric bound is declared in more than one place, so the form and the
  validator cannot drift — which was the specific failure mode: every `invalid_request` test could
  stay green while the form offered a mode the pipeline rejects.
- **Values are business facts; labels are not.** The contract carries value tokens and numeric
  bounds only. Human-readable labels ("Home", "Transit") stay renderer-owned, consistent with
  Decision 23 keeping the label vocabulary in the presentation layer.
- **It is available before any result exists.** It is a static export, not a field on a result, so
  the first render — which happens before any user submission — can build a valid form from it.
- **`step` is a UI affordance, not a validation rule.** Round 2 was right that the contract could not
  simultaneously carry `step`, say validation reads the contract, and leave Decision 35 accepting every
  integer in `[180, 360]`. **Decision 35 governs and is unchanged:** `rankVenues()` accepts any integer
  in `[min, max]`, on-step or not — `181` is a valid request, evaluated normally, never
  `invalid_request`. `step` lives in the contract only so the increment cannot drift from the bounds it
  belongs to; **[packet]** `web/app.js` writes `step: "15"` into the duration control today, and leaving
  it renderer-owned would reintroduce the exact duplication Decision 40 exists to remove. A form
  narrower than the accepted range is a usability restriction, never a correctness boundary —
  consistent with Decision 27, under which correctness never depends on HTML controls. Validation reads
  the contract's supported sets and numeric bounds; it does **not** read `step`.
- **The export is deeply immutable.** `rankVenues()` reads the contract, so a mutable export would make
  a function documented pure — **[packet]** `web/ranking.js:1`, "Pure hours-resolution and feasibility-tier
  logic. No DOM, no fetch, no imports." — depend on whether `app.js` mutated it earlier, turning a
  renderer bug into a silent change of validation behaviour. The contract is frozen at **every** level
  at module load: the top-level object, each nested bounds object, and each supported-value array. An
  accessor returning a fresh deep copy per call is an acceptable equivalent. Freezing is preferred —
  module code is strict by default, so a mutation attempt throws rather than being silently discarded.
- This adds an export to `ranking.js`, which remains pure, DOM-free and I/O-free. No settled
  foundation moves.

---

## 5. Requested end vs achievable end

### 5.1 Reproduction

**[packet]** `home`/`transit`/`2026-09-05`/`18:00`/`240`, `starbucks-chinatown-point`: travel 42m,
arrival 18:42, `usable_minutes_mid` 198, **achievable end 22:00**, `session_end_mid` 22:42, card
prints `ends ~22:42`. Under Decision 2 this candidate is `shorter` and no longer Plan-A-eligible, but
it is still **shown**, so the defect is unaffected by the eligibility change.

### 5.2 Two defects

**[packet] Implementation bug.** `PLAN.md`'s presentation contract does not list `session_end`, and
its worked mock-ups say "gives 4h20m of the 6h you asked for" and "Leave the venue by 23:35", never an
"ends ~" line. `app.js` invented a display value, and invented the one that is wrong for exactly the
tier where it matters.

**[packet] Contract gap.** `boundBindingMetrics` computes `bindingLimitAbs` — the "leave the venue by"
instant — and **discards it**. No achievable end is exposed either.

### 5.3 Design

**Decision 11 — three named instants, none substitutable.**

| Name | Definition | Meaning |
| --- | --- | --- |
| `requested_session_end_mid` | `arrival_mid + duration` | when you would stand up if the request were granted in full. **Internal** to the return-leg evaluation |
| `achievable_session_end_mid` | `arrival_mid + usable_minutes_mid` | when you would actually stand up |
| `binding_limit_mid` | already computed by `combineBindingLimit` | the instant the binding constraint bites |

- `requested_session_end_*` may **never** be displayed as the session's end; only inside an explicit
  comparison — "gives 3h18m of the 4h you asked for".
- `achievable_session_end_mid` is `undefined` exactly when `usable_minutes_mid` is.
- For a `robust` candidate both ends coincide; the UI prints the achievable end **once**.
- When `binding_limit_mid` is `UNDETERMINED` (`COVERED` hours, unbounded return),
  `achievable_session_end_mid` is `arrival + duration` and the binding line renders the existing "no
  known closing constraint within the verified span" — **never a fabricated clock time.**
  `AT_LEAST(0)` tagged semantics and `usable_minutes = duration` are preserved exactly.
- **No "achievable session start" field.** Study begins at the resolved venue arrival, already carried.

**Decision 12 — `latest_leave_at` carries an explicit state.** **[packet]** At `leave_at=23:00` the
card prints "latest leave: 18:43" — arithmetically right, but beside a 23:00 departure it reads as a
typo. Leaving `app.js` to notice this by comparing times puts a business rule in the renderer.

| State | Meaning |
| --- | --- |
| `future` | a real deadline still ahead of the selected departure |
| `past` | already behind it — you would have had to leave earlier |
| `undetermined` | `COVERED`, no known closing constraint in the verified span |
| `closed_at_arrival` | the midpoint bound is `NONE`; there is no deadline to state |

---

## 6. Evidence freshness

**Not a design gap.** **[packet]** `PLAN.md` establishes "Degradation must be visible", defines
`ok`/`stale`/`failed` per source per venue, and carries an **unchecked** manual-acceptance item,
"Per-source staleness visible without hunting". **[packet]** `app.js` references no status field.

**Decision 13 — the two freshness signals are exposed separately and never merged.** **[packet]**
`PLAN.md`: "one venue can read `ok` on hours and `stale` on busyness in the same run." Stale hours
means *the opening times may be wrong*; stale busyness means *the crowd estimate is old*.

**Decision 14 — freshness is carried on the candidate:** `hoursStatus` and `histogramStatus`.

### 6.1 The stale-data invariant, stated structurally

**Decision 15 — compare the full result minus freshness fields, computed structurally rather than
from a whitelist.** Revision 0 asserted byte-identity, which its own Decision 14 made unsatisfiable.
Revision 1 replaced it with a hand-maintained list of fields — which silently stops covering any
field added later, exactly the failure mode this document keeps finding elsewhere.

The invariant, as a procedure:

1. compute the full result for the last-known-good data with both sources `ok`;
2. compute it again with **only** the freshness statuses changed to `stale`;
3. deep-copy both results;
4. **recursively delete** every occurrence of `hoursStatus` and `histogramStatus`, at every depth,
   including inside nested Plan B objects, `bestAlternative`, and every entry of `removed`,
   `travelUnknown` and the group arrays;
5. deep-compare what remains. Any difference is a failure.

The named freshness fields are the **only** exclusions, and the deletion is defined once, recursively,
so a field added in a later slice is covered without editing the test. The comparison therefore
covers selection, candidate ordering, group membership, `resultState`, achievable and binding times,
`latestLeaveAt` and its state, every diagnostic, all naming fields, the nested Plan B, and
`bestAlternative`.

**`hoursStatus` and `histogramStatus` are reserved freshness-field names in this result schema.**
Removal by name, at any depth, is therefore intentional and safe: no other field in the shape may
take either name, and §10's audit table is where that reservation is enforced when the shape changes.

**The projector needs its own test, because the behavioural test cannot catch a broken one.** A
projector that returned `{}` for every input would satisfy both the deep-comparison and the
"results differ before deletion" control, and would prove nothing at all. So the helper is tested
directly, against a synthetic nested object rather than a ranking result, and must demonstrate:

- `hoursStatus` removed at **several** nesting depths, not just the top level;
- `histogramStatus` removed at several nesting depths;
- freshness fields removed from objects **inside arrays**;
- unrelated scalar fields survive, with their values intact;
- unrelated **nested objects** survive, structure intact;
- unrelated **array contents** survive, order and length intact;
- the result is **not** emptied — asserted positively against an expected structure, never merely
  by "no freshness field remains".

The behavioural comparison over real ranking results is kept **in addition to** this, not replaced
by it: the helper test proves the projector is sound, the behavioural test proves the pipeline is.

A `stale` source retains last-known-good and ranks on it, exactly as today; down-ranking on staleness
would invent a policy nothing in the pipeline can calibrate. Only presentation changes.

### 6.2 Freshness outside the candidate

**Decision 37 — non-candidate diagnostics carry source status where the pipeline path can produce
one.** Decision 14 covers candidates; **[packet]** a venue whose evidence failed need not survive to
become one. `removed` entries and `travelUnknown` entries therefore carry `hoursStatus` and
`histogramStatus` alongside their existing fields, so the UI can say *why* the evidence failed rather
than only that the venue is absent. Fields are added only on paths that can actually produce them —
hard-filtered venues remain aggregate-only per Decision 9.

### 6.3 A misattributed reason on the busyness side

**[packet]** With `histogram.status == "failed"` (no `days` at all), `resolveBusynessBand` returns
`{band: "unknown", reason: "insufficient_coverage", coverageHours: 0}`. The band is right and
Decision 14 makes the staleness visible — but the *reason* misattributes a **source failure** as thin
data. These have different fixes, which is the distinction `PLAN.md` insists on everywhere else. The
reason string should distinguish them. No tier, band or confidence value changes.

### 6.4 A first-ever failed source is misdiagnosed — and `resolveHours` is not total

**Revision 2 overstated this, and revision 3 corrects it.** Revision 2 reported that a `failed` hours
source crashes `rankVenues()` and blanks the page. The `TypeError` is real. Revision 3 then claimed it was
"not reachable from any record `build/refresh.py` can actually emit" — **that claim was false as
stated, and `ARCH-004-R1-F01` was right to reject it.** The corrected position is below.

**What is actually true, and what is not.** **[packet]** `_merge_hours_source` derives identity and
hours from the *same* Places response and retains them together — its docstring: "never a fresh
identity paired with stale hours or vice versa". For a record **descended from a coherent refresh
history** that does close the path:

- `status: "failed"` means no run ever succeeded, hence no `last_success_at`;
- no successful run means no identity was captured, so `name`, `lat`, `lng` and **`business_status`**
  are absent;
- **[packet]** `rankVenues()` tests `venue.business_status !== "OPERATIONAL"` **before** any hours
  resolution, so the venue is removed there and `resolveHours()` is never reached.

**But that is a property of the pipeline's own history, not of its inputs.** **[packet]**
`_resolve_freshness` derives `failed` solely from the absence of `previous_hours.last_success_at`,
while identity fields are copied from the prior record **independently**, with no check that the two
are coherent; `_load_existing_venues` performs no semantic validation of the file it reads. So a
hand-edited, migrated, restored or otherwise inconsistent-but-parseable `data/venues.json` is
accepted as prior state and **re-emitted with identity plus `failed`**. Reproduced directly against
`_merge_hours_source` with a prior record carrying `business_status: "OPERATIONAL"` and
`hours.status: "failed"`:

```
emitted identity : {'name': ..., 'lat': ..., 'lng': ..., 'business_status': 'OPERATIONAL'}
emitted hours    : {'source': 'places_api', 'last_attempt_at': ..., 'status': 'failed'}
```

Feeding that merged venue to `rankVenues()` passes the operational gate and throws. **Two distinct
malformed shapes exist and they fail differently** — a fact revision 3 missed entirely:

| Shape | `resolveHours` behaviour |
| --- | --- |
| `hours` present, `regular_hours` absent | `TypeError: Cannot read properties of undefined (reading 'sat')` |
| `hours` **absent entirely** | `TypeError: Cannot read properties of undefined (reading 'current_hours_valid_from')` |

Revision 3 tested only the first. The correct conclusion is not that the crash is unreachable, but
that **it is reachable from accepted prior state and must be closed fail-closed.**

**[packet]** Reproduced with the realistic record — a brand-new venue whose first fetch failed,
carrying merged meta but no Places identity:

```
removed: [{ venueId: "starbucks-brand-new",
            reason:  "business_status is undefined",
            kind:    "not_operational" }]
```

**The reachable defect is a misdiagnosis.** `not_operational` tells the user *this venue has closed
down*; the truth is *we have never successfully fetched it*. Those have entirely different fixes —
delete the venue versus re-run the refresh — which is exactly the distinction `PLAN.md` insists on
for every other diagnostic.

**Both malformed shapes are reachable — the unreachability claim is withdrawn in full.** Revision 2's
reproduction reached the `TypeError` by injecting a `failed` hours block while **keeping** the identity
fields. Revision 3 dismissed that as a state the refresh pipeline cannot produce, and revision 4 left
that sentence standing here in live prose even while the analysis above disproved it — which is why
`ARCH-004-R1-F01` was recorded `unresolved` in round 2. **Revision 5 deletes the claim.** The precise
statement, which replaces it: `refresh.py` does **not** produce identity + `failed` from a *coherent
refresh history*, but it **does re-emit exactly that state from accepted inconsistent prior state**, as
reproduced at the top of this section. Both shapes are therefore live — the no-identity first-ever
failure, through the pipeline's own history; identity + `failed`, through its unvalidated prior-state
input — and neither may be implemented or documented as unreachable.

**Decision 38 — a `failed` source is data, not an exception, and is diagnosed as such.**

- A venue whose hours source is `failed` with no last-known-good is removed with **its own reason and
  kind**, distinct from both `not_operational` and `hours_unknown`. `hours_unknown` means the data is
  present but indeterminate for that arrival; this means no data was ever obtained.
- The check is ordered **before** the `business_status` gate, since a missing `business_status` on
  this path is a *consequence* of the failed fetch, not independent evidence of closure.
- The removal carries the source status of Decision 37 and the label of Decision 39.
- **The guard is a live fail-closed boundary on accepted prior state, not defence in depth.**
  Revision 3 labelled it defensive on the strength of the unreachability claim now withdrawn. Because
  `refresh.py` re-emits identity + `failed` from an inconsistent prior file, the guard is what stands
  between a semantically inconsistent `data/venues.json` and a blank page.
- `resolveHours` is made **total over both malformed shapes** — `hours` absent entirely, and `hours`
  present but lacking `regular_hours` — returning a tagged non-schedule outcome rather than
  dereferencing. It must never fabricate a schedule. Totality over one shape is not totality: the two
  throw on different properties, so a test covering only one leaves the other live.

**Decision 39 — the naming contract has a fallback source, so a venue with no Places identity is
still labelled.** Decisions 21-22 define `displayName` from the stored `name`, which this path does
not have. **[packet]** The canonical registry `data/venue_sources.json` carries `resolved_name` for
every venue — the Phase 0 resolved identity, a committed fact about which Place the venue refers to.

- Naming resolution takes `name` when present, otherwise the registry's `resolved_name`. No new
  naming system is introduced, and nothing is derived from the venue ID.
- **This fabricates no Places evidence.** `resolved_name` is not a claim that this run's fetch
  succeeded; it is the identity resolution that was recorded when the venue was admitted, and it
  exists precisely because a venue cannot enter the registry without one.
- **[packet]** Disambiguation stays consistent because it is the same problem: `resolved_name` has
  exactly the same distinctness as the stored names — **23 distinct values across 28 venues**, with
  `Starbucks` on 4 and `The Coffee Bean & Tea Leaf` on 3 — so Decision 22's rule, append `area` when
  the name is not unique, applies unchanged and produces the same labels.
- The registry value must be available where naming is resolved. **[packet]** The smallest seam is
  `build/refresh.py`, which already holds the registry `source` record when it builds each venue
  (`source["venue_id"]`, `source["place_id"]`) and can carry `resolved_name` alongside them. Nothing
  further is prescribed.
- **[packet]** Every registry record carries a non-empty `resolved_name`, and registry validation
  already requires all four fields to be present and non-empty before any API call — so the fallback
  cannot itself be absent.

**Scope note.** This belongs in the design because Decision 20 requires failed evidence to be
visible, and a removal the renderer cannot label is not visible. Whether it ships in slice 1a or as
its own small fix is an implementation-sequencing call for whoever opens the assignment.

---

## 7. Refresh publication robustness

### 7.1 Correcting revision 1's factual claim

Revision 1 said: *"Both artifacts are rendered and validated in memory first (already true of both)."*
**That is wrong**, and the error matters because it made the skew look smaller than it is.

**[packet]** The actual current behaviour, from `build/refresh.py` and `build/generate.py`:

1. the prospective venue data is fetched and validated, then **atomically written** to
   `data/venues.json` (step 7);
2. **only then** is the HTML generated — and `generate_index_html()` reads the venue data **back from
   the deployed path on disk**, renders, validates the rendered text, and writes it;
3. therefore a generation failure leaves the **new** JSON deployed beside the **old** HTML.

So it is true that each artifact is validated before its own write — `validate_generated_artifact()`
does run before `output_path.write_text()`, which is why revision 0's "stage and validate the HTML"
recommendation was rejected as already implemented. It is **not** true that both are validated before
either is written. Revision 1 conflated the two.

### 7.2 Confirmed and rejected sub-claims

| Sub-claim | Verdict | Basis |
| --- | --- | --- |
| JSON replacement precedes generation; a generation failure leaves newer JSON with older HTML | **Confirmed** | **[packet]** `refresh.py` step order; its own docstring states the skew is intended |
| HTML is written directly, not atomically | **Confirmed** | **[packet]** `generate.py` — `output_path.write_text(html_text)`, asymmetric with `_write_venues_json_atomic` |
| Stage **and validate** the HTML | **Rejected — validation already precedes the write** | **[packet]** `validate_generated_artifact(html_text)` runs before the write |
| Preflight local inputs before API work | **Partially valid** | **[packet]** The registry and the registry↔meta ID-set equality **are** already checked before any API call. The Node bridge is **not** — it runs after the entire fetch. Generation's local inputs are first touched at step 8 |
| No offline regeneration command | **Confirmed** | **[packet]** `generate.py` has no `__main__`; the `Makefile` has one target, `refresh` |

### 7.3 Design

**Decision 16 — validate both prospective artifacts before replacing either.** The required order:

1. produce and validate the prospective venue data;
2. produce and validate the prospective HTML **against that same prospective data**;
3. only after both succeed, replace the deployed artifacts — each via temp file + atomic rename.

**The architecture requirement, stated implementation-neutrally:** *generation must consume the
prospective snapshot without replacing the deployed venue data first.* That is the whole of it.

**No generator signature change is required.** **[packet]** `generate_index_html()` already takes
both `venues_path` and `output_path` as parameters, so the existing path-based seam supports staging
directly:

```
prospective venue data
  → write to a staging venues file
  → generate_index_html(venues_path=<staged json>, output_path=<staged html>)
  → validate
  → publish both artifacts
```

This satisfies validate-both-before-replacing-either while preserving the current generator API and
the test contracts in `tests/python/test_generate.py`. Revision 2 claimed step 2 was "impossible"
without an in-memory data parameter and called the change "signature-level"; **both were wrong** —
the generator is already path-parameterised. Prefer this staged-path seam; only if repository review
finds a concrete reason it is insufficient should a signature change be considered.

**What this does and does not guarantee.** Both renames still happen in sequence, so a crash between
them can still leave a mismatched pair. This is **not** cross-file atomicity, which a plain filesystem
cannot provide. What it removes is the *failure-driven* skew — the case where generation fails and the
old page survives beside new data — which is the case that actually occurs. The residual window is two
adjacent renames.

**Decision 17 — preflight everything local before the first API call:** the return-validator bridge's
availability, and generation's local inputs (`holidays.json` exists and parses; the template carries
every placeholder; `ranking.js`/`app.js` have no top-level collision). **Ordering constraints
preserved:** coarsening stays *before* the fetch, and the venue-data write stays *after* contract
validation of fetched data.

**Decision 18 — `make generate`,** a no-network target regenerating the page from the on-disk venue
data. The recovery command, and a prerequisite for the presentation slices.

---

## 8. Presentation contract, labels and hierarchy

### 8.1 The contradiction

**[packet]** `PLAN.md` requires **every** row — "Plan A and every 'More alternatives' row alike" — to
show all eleven values, and `app.js` implements that faithfully, which is most of why the page reads
as a wall of text. Progressive disclosure **directly contradicts** this and cannot be adopted by
quietly outgrowing the sentence. The proposed hierarchy is closer to `PLAN.md`'s *own* mock-ups than
the current page is; the sentence and the mock-ups have been in tension since they were written.

### 8.2 Design

**Decision 19 — three presentation surfaces.**

| Surface | Carries |
| --- | --- |
| **Plan A** | display name, area, travel time, **achievable** duration, qualitative seat confidence, binding constraint, Plan B as "if full, go here" with its **transfer time** and `strong`/`salvage` wording |
| **Row** | display name, area, travel, achievable duration, qualitative confidence, tier |
| **Disclosure** | baseline seatability, busyness adjustment and its reason, both tiers and the overall tier, return basis and modes, `latest_leave_at` with its state, preference, `surplus` |

Every value the current contract mandates remains reachable without leaving the page. Disclosure moves
values; it never drops them.

**Decision 20 — the always-visible set, which disclosure may never absorb:** stale or failed hours
evidence; stale or failed busyness evidence; a `tight` tier's thin-margin warning; an `unverified` way
home; the active refusal; every removal notice required by the existing "the diagnostic is required,
not optional" rule.

**Decision 21 — naming is resolved once from the whole snapshot and propagated to every returned
object that names a venue.** **[packet]** `removed` entries are `{venueId, reason, kind}`,
`travelUnknown` entries are `{venueId}`, and the nested Plan B is
`{venueId, mode, overallTier, strength, usableMinutesMid}` — none carries a name, so `app.js` had no
choice but to reconstruct one. Resolution happens in the existing snapshot-validation step, and the
naming fields attach to **candidates, the nested Plan B, `bestAlternative`, `travelUnknown` entries
and `removed` entries**.

**Decision 22 — two naming fields, so `area` is never printed twice.**

| Field | Definition | Used by |
| --- | --- | --- |
| `displayName` | the stored `name`, unmodified | surfaces that also show `area` on its own line — Plan A, rows |
| `disambiguatedLabel` | `displayName`, plus `area` **only when `displayName` is not unique in the snapshot** | inline contexts with no separate area line — Plan B, removal notices, travel-unknown list |

**[packet]** Only **23 distinct stored names cover 28 venues** — `Starbucks` appears 4 times,
`The Coffee Bean & Tea Leaf` 3 times — so naive adoption of `venue.name` renders indistinguishable
cards. But the current ID reconstruction is also wrong, producing `Starbucks Utown`, `Starbucks Ue
Square`, `Starbucks Hillv2`, `Starbucks Ion Orchard`, `Baker Cook Eng Kong Park`.

**Decision 23 — a stated label vocabulary.** **[packet]** `PLAN.md` permits friendlier labels
("`High`/`Good`/`Medium`/`Low`/`Unknown`... the underlying states are preserved and reconstructable")
but never fixes the mapping, so `app.js` prints raw identifiers like `usually_available`. The mapping
becomes a contract table covering `seat_confidence`, `baseline_seatability`, busyness bands and return
bases.

**Decision 24 — every displayed instant that can cross midnight carries a day marker, refusals
included.** **[packet]** `minutesToClock` wraps modulo 1440. **[packet]** `rankVenues()` computes
`noVerifiedReturn = formatClockTime(groups.unverified[0].sessionEndMidAbs)` — it **stringifies before
returning**, destroying the day relationship, and `app.js` cannot recover it. The
`no_verified_return` state therefore carries the **absolute instant**. **[packet]** `DECISIONS.md`'s
`IMP-014` record documents this refusal observed live with a session ending at **04:07**.

**Decision 25 — focus preservation without reading the DOM.** **[packet]** Saving
`document.activeElement` violates `PLAN.md`'s "One state object. Never read state back out of the
DOM." Instead the controls form is **built once and not destroyed** — its values already come from
`state.controls` — and `render(state)` replaces only the results region.

**Decision 26 — no framework, and no npm runtime dependency.**

---

## 9. Session duration input contract

**[packet]** `PLAN.md` scopes the product to **3-6 hour** sessions. **[packet]** `web/app.js` builds
the duration control as `min: "60"` with **no maximum**, and `rankVenues()` validates it not at all.

**Decision 27 — enforced in both places, and not silently broadened.** The UI control becomes
`min: 180`, `max: 360`. **The pure entry point validates the same range** (Decision 35), so
correctness never depends on HTML controls. An out-of-range duration yields `invalid_request` and does
**not throw** — `app.js` calls `rankVenues()` on every render, and an exception there blanks the page
instead of explaining itself. `PLAN.md`'s stated 3-6 hour scope is unchanged; this design enforces it.

---

## 10. The returned presentation shape

**Decision 32 — the shape carries everything `app.js` renders, with no business-rule derivation left
in the renderer.** Audit of every value the renderer needs, against Decisions 11-24:

| Rendered value | Source | Status |
| --- | --- | --- |
| Venue label (cards) | `displayName` + `area` | D21/D22 |
| Venue label (inline) | `disambiguatedLabel` | D21/D22 |
| Tiers, overall tier | `hoursTier`, `returnTier`, `tier` | present today |
| Binding constraint, return basis/modes | `bindingConstraint`, `returnBasis`, `returnModes` | present today |
| Seat confidence, both components | `baselineSeatability`, `busynessBand` (band + reason), `seatConfidence` | present today |
| Achievable duration and end | `usableMinutesMid`, `achievableSessionEndMid` | **added** D11 |
| Hours-only qualifier ("return unverified") | `metricsBasis` | present today — **missed by revision 3's audit**, caught as `ARCH-004-R1-F02` |
| "Leave the venue by" | `bindingLimitMid` | **added** D11 |
| Latest leave, with meaning | `latestLeaveAt` + `latestLeaveAtState` | **added** D12 |
| Travel time | `travelMinutesMid` | present today |
| Backup, preference, surplus | `backupStrength`, `preference`, `surplusMid` | present today |
| Freshness | `hoursStatus`, `histogramStatus` | **added** D14 / D37 |
| **Plan B transfer time** | `planB.travelMinutesMid` | **added — see below** |
| Plan B label, mode, tier, strength, duration | `planB.*` | present today |
| Best degraded alternative | `bestAlternative` | **added** D33 |
| Refusal / state | `resultState` | **added** D6 |
| Empty-board diagnostics | `snapshotEmpty`, `hardFilteredCount`, `travelUnknown`, `removed` | **added** D36 |
| Invalid-control explanation | violated control, supplied value, permitted range | **added** D34 |
| Refusal instant, day-marked | absolute instant on `no_verified_return` | **added** D24 |

**Plan B transfer time.** **[packet]** Decision 19 requires Plan B to show its transfer time from
Plan A, but the nested object is `{venueId, mode, overallTier, strength, usableMinutesMid}` — the
fallback's travel band is parsed inside `selectPlanBFallback` and then discarded. The renderer cannot
obtain it without re-reading `fallbacks[]` and re-parsing the band, which is a business rule. It is
added to the nested object.

**Decision 33 — the pipeline names the best degraded alternative; the renderer only renders it.**
Under `session_does_not_fit`, `bestAlternative` references the one `shorter` candidate to show below
the refusal, carrying the same presentation-ready fields as any candidate. Letting `app.js` reach for
`groups.shorter[0]` would make the renderer choose what to recommend — a policy decision — and would
also hard-code the assumption that group order is selection order.

**The public shape changes in two steps, not one.** Revision 3 claimed it changed "exactly once, in
slice 1b"; `ARCH-004-R1-F04` showed that is impossible, and the claim is withdrawn. **[packet]** The
current returned object is `{planA, groups, alternatives, travelUnknown, removed, refusals}`, and
slice 1a necessarily changes it — Decision 6 replaces `refusals` with `resultState`, Decision 34 adds
the invalid-control payload, and Decision 38's dedicated removal cannot be emitted unlabelled or
unstamped. The migration is therefore stated explicitly:

| Step | Fields entering the public shape | Why here |
| --- | --- | --- |
| **1a** | `resultState` (replacing `refusals`); the `invalid_request` payload of D34; the failed-source removal's reason/kind and **its D37 source status**; **D21/D22/D39 naming on every non-candidate diagnostic — every `removed` entry and every `travelUnknown` entry, not just the failed-source removal**; `snapshotEmpty` and `hardFilteredCount` | Every field a state or a removal cannot be emitted without. Decision 36 requires `nothing_evaluable` — a 1a state — to carry `travelUnknown` and **all** `removed` diagnostics with Decision 21 naming, so that naming moves into 1a **in full**. Revision 4 moved only the failed-source removal's, which `ARCH-004-R1-F04` recorded `unresolved` in round 2 |
| **1b** | `achievableSessionEndMid`, `bindingLimitMid`, `latestLeaveAtState`, `metricsBasis` (retained), `hoursStatus`/`histogramStatus` on candidates, naming on candidates and nested Plan B, `planB.travelMinutesMid`, `bestAlternative` | Presentation values. None is required for a state or a removal to be well-formed |

**Decision 40's control contract is deliberately absent from this table.** It is a **static module
export** of `ranking.js`, not a field on the returned object — Decision 40's own rule, "it is available
before any result exists". Revision 4 listed it in the 1a row as though it entered the returned shape;
it does not, and no returned-shape consumer changes because of it. It still **ships in slice 1a**,
alongside the validation that reads it.

**Each acceptance criterion is assigned to the first slice in which every field it reads exists.**
The failed-source and state criteria therefore belong to 1a; the achievable-end, freshness, Plan B
transfer and `bestAlternative` criteria to 1b. **The naming criterion is split**, because one criterion
reading both diagnostic and candidate names can run in neither slice alone: its non-candidate half —
removal notices and travel-unknown entries — is a **1a** criterion, and its candidate half — cards and
nested Plan B — is a **1b** criterion. §12 states them as two criteria for exactly this reason. §12 is
grouped by subject rather than by slice, so this table — not the group headings — governs when each
criterion becomes runnable.

---

## 11. Test strategy

### 11.1 Why revision 0's presentation criteria were vacuous

**[packet]** `generate_index_html` embeds the data and the application into the page while `app.js`
constructs all candidate DOM **at runtime**. The embedded JSON contains the literal string `"stale"`,
so a grep over the artifact passes whether or not a warning is ever rendered.

### 11.2 The constraint the second review's recommendation had to respect

**[packet]** `PLAN.md` states "**Vanilla HTML/CSS/JS. No React, no Vite, no npm**"; `CLAUDE.md`
repeats "no framework, no npm, no bundler" as a non-negotiable; `package.json` is
`{"private": true, "type": "module"}` — **zero dependencies**. `jsdom` and Playwright are both npm
dependencies.

**Decision 28 — a dependency-free DOM stub in `tests/js/`, exercised by the existing `node --test`
runner, with an explicitly bounded scope.**

| The stub **may** validate | The stub **may not** validate |
| --- | --- |
| Node creation | CSS and layout |
| Child structure and nesting | Real browser form validity |
| Text content | Full `FormData` semantics, unless specifically emulated and tested as such |
| Classes and attributes | Focus, selection and IME behaviour |
| Append and replacement behaviour | The accessibility tree |
| Enough event registration and bootstrap to drive a render | Safari and other browser-specific semantics |

Everything in the right column stays **manual browser acceptance**. The stub must stay intentionally
small: **if an implementation finds itself reproducing substantial browser behaviour, the correct
response is to stop and revisit the test boundary, not to grow the stub into a fake browser.** It is
never evidence about layout, CSS, focus, IME or Safari.

**Decision 29 — `app.js` must become importable.** **[packet]** Its last lines are module-scope side
effects — it reads `document.readyState` and calls `init()`, which immediately reads
`document.getElementById("data-venues")`. Nothing can import it without a DOM already present. The
bootstrap is guarded so render functions can be imported and exercised. A testability change, not a
behavioural one.

**Decision 30 — the automated/manual split.**

| Automated (DOM stub) | Manual (real browser, real device) |
| --- | --- |
| Which semantic elements render for a given pipeline result | Responsive layout, narrow-phone behaviour |
| Warning and refusal text, and **which container** it lands in | Text wrapping, long-warning overflow |
| Achievable-vs-requested end wording | Visual hierarchy, one-handed readability |
| Label vocabulary mapping | Real focus and IME behaviour |
| Day markers on crossing instants | `file://` and on-device checks |

**[packet]** The manual column keeps the method `DECISIONS.md` records: serve `web/` over the LAN and
open it in real Safari — Quick Look does not reliably run the page's JS.

---

## 12. Acceptance criteria

**[repo]** The existing 372 tests pass on every confirmed defect, which is the strongest available
evidence that the current criteria are systematically biased toward happy paths. Every criterion below
is a negative, boundary or positive-rendering case.

**Plan A eligibility**

- Pinned: `home`/`transit`/`2026-09-05`/`23:00`/`240` yields **no Plan A**.
- A `shorter` candidate is never Plan A at any `usable_minutes_mid` — asserted at 0, 89, 90 and 200.
  The 90 boundary is asserted explicitly to pin that the withdrawn floor survives nowhere.
- An `unverified` candidate is never Plan A regardless of its metrics.
- A `robust` candidate below `mixed` yields `no_low_risk_option`.
- **Decision 3, discriminating fixture:** a `robust`/below-floor candidate sorts **before** a
  `tight`/eligible candidate; Plan A is the **latter**, and `groups.ranked` retains its original
  order. A fixture whose first candidate already clears the floor proves nothing.
- A `COVERED` venue with `surplus == AT_LEAST(0)` and `usable_minutes == duration` **is** eligible
  when `robust`/`tight`.
- Group membership is unchanged by eligibility. **Non-vacuity:** the fixture must contain a
  ranked-but-ineligible candidate, asserted present before the membership comparison runs.

**Tolerance ownership**

- `rankVenues()` called with **no** `toleranceMinutes` produces the same tiers as an explicit `15`.
- **[packet]** No `FEASIBILITY_TOLERANCE_MINUTES` declaration remains in `app.js` — asserted against
  the source, since this is a placement contract, not a behaviour.
- An explicit override still takes effect, so test control is retained.

**Result states**

- Each of the six states is produced by its own fixture.
- **Exactly one state is returned, always**, and no result can express two refusals at once.
- Every refusal state renders **exactly one** refusal; **`plan_a` renders none.**
- **The overlap case revision 0 got wrong:** an all-`unverified` population yields
  `no_verified_return`, **not** `session_does_not_fit`.
- **Disjointness asserted, not assumed:** a candidate with `unverified` return and `robust` hours
  lands in `unverified`, never `shorter`.
- **[packet]** The `office/cycle` case: all groups empty, state is `nothing_evaluable` — **not**
  `no_low_risk_option`, which is what ships today.
- Boundary: exactly one ranked candidate clearing `mixed` yields `plan_a`.

**`nothing_evaluable` diagnostics**

- **Zero venues:** a valid snapshot with an empty venue list yields `nothing_evaluable` with
  `snapshotEmpty` true and the other three diagnostics empty.
- **Mixed causes:** one fixture producing hard-filtered venues, `removed` entries **and**
  `travelUnknown` entries simultaneously. All three survive in the returned state, each asserted
  non-empty. A test asserting only one proves nothing.
- Single-cause fixtures each assert the *other* diagnostics are empty.
- Hard-filtered venues appear in **no** group and in `removed` **not at all** — Decision 9's bound.

**`invalid_request`**

- **The control contract is the single source — proved with a sentinel, not with today's values.**
  Comparing the rendered form against the *real* contract discriminates nothing: **[packet]** `app.js`'s
  local `ORIGINS`, `MODES` and duration bounds are equal to the contract's values today, so a renderer
  that never reads the contract passes. The control renderer therefore receives the contract through an
  **injected dependency seam** — a parameter, or a module seam the test substitutes — and the test
  supplies a **sentinel contract** whose supported origins, supported modes and duration bounds all
  differ from the real ones. Assert the rendered options and bounds are the **sentinel's**. A locally
  re-declared set or bound then fails, which is what this criterion claims. A companion assertion feeds
  the real contract's own boundary values to `rankVenues()` and requires them accepted, so the seam
  cannot drift from the validator.
- **The contract export is deeply immutable.** Mutation attempts against the top-level object, a nested
  bounds object, and a supported-value array each leave the contract unchanged — asserted after the
  attempt, and asserted again by a following `rankVenues()` call behaving identically. An accessor
  returning a fresh deep copy satisfies this equally; a plain mutable export fails.
- **Off-step durations are valid.** `durationMinutes: 181` — inside `[180, 360]` but off the contract's
  `step` — is evaluated normally and yields **no** `invalid_request`. This pins `step` as a UI affordance
  and Decision 35's integer range as what the pure entry point actually enforces.
- Unsupported `origin`; unsupported `mode` (e.g. `"teleport"`); malformed `departureDate`;
  `leaveAtMinutes` of `-1` and `1440`; `durationMinutes` of `179` and `361` — each yields
  `invalid_request`.
- `180` and `360` are evaluated normally; `leaveAtMinutes` `0` and `1439` are valid.
- **The misdiagnosis case:** `mode: "teleport"` yields `invalid_request`, **not** `nothing_evaluable`
  — asserted directly against the `office/cycle` fixture, which must still yield `nothing_evaluable`.
- The entry point rejects out-of-range controls **even though the UI would prevent them** — the test
  calls `rankVenues()` directly — and returns the state rather than throwing.
- The state names the violated control, the supplied value and the permitted range.

**Requested vs achievable end**

- **[packet]** Pinned: `chinatown-point` at `18:00`/`240` exposes `achievableSessionEndMid == 22:00` and
  `usableMinutesMid == 198`. A test asserting `22:42` fails.
- `achievableSessionEndMid` is `undefined` exactly when `usableMinutesMid` is.
- A `COVERED` candidate's binding line renders the "no known closing constraint" wording and no clock
  time.
- `latestLeaveAtState` asserted for all four values.

**Stale-data invariant**

- The **structural** comparison of Decision 15: two full results, recursive deletion of `hoursStatus`
  and `histogramStatus` at every depth, deep-compare the remainder. The deletion is defined once and
  reused; the test must not enumerate surviving fields.
- **Non-vacuity, at two levels.** A control assertion proves the two results *do* differ before
  deletion. That alone is insufficient — a projector returning `{}` would satisfy it — so the
  projection helper is additionally tested **directly**, per Decision 15, against a synthetic nested
  object: freshness fields removed at several depths and inside arrays; unrelated scalars, nested
  objects and array contents all surviving intact; and the result asserted positively against an
  expected structure so an over-eager projector fails.
- `failed` is distinguished from `stale`, and both from `ok`.

**Runtime rendering (DOM stub) — positive assertions**

Every criterion asserts on nodes produced by `render()` at runtime, never on the generated HTML file.
Grepping the artifact for a status string is explicitly disallowed: the embedded JSON already contains
those strings.

- **Shortened session, both directions.** A fixture where the requested end is later than the
  achievable end. Assert the rendered DOM **positively contains the achievable end as the session
  end**, *and* that the requested end does not appear as the achieved end. The absence half alone is
  insufficient — it passes on a renderer that shows no end time at all.
- **Past latest-leave.** With `latestLeaveAtState: "past"`, assert the DOM renders past-tense meaning
  ("you would have needed to leave by …"). **A renderer printing identical text for `future` and
  `past` must fail** — asserted by rendering both and comparing.
- **Friendly vocabulary, both halves.** For each representative mapping, assert the raw identifier is
  absent **and** the expected user-facing label is present. Omitting the field entirely must not pass.
- **Stale evidence.** Rendered DOM distinguishes stale hours from stale busyness, with the transposed
  pairing also asserted; the warning node's **parent** is outside any disclosure container — asserted
  structurally, not by string match.
- **Mixed `nothing_evaluable`.** The multi-cause fixture renders a representation of every non-empty
  diagnostic.
- **Naming, non-candidate diagnostics — a slice 1a criterion (§10).** With four venues sharing
  `Starbucks`: removal notices **and** travel-unknown entries show `disambiguatedLabel`, and no rendered
  label equals an ID reconstruction such as `Starbucks Utown`. This half reads only the naming Decision 36
  requires on `removed` and `travelUnknown`, all of which exists after 1a.
- **Naming, candidates and Plan B — a slice 1b criterion (§10).** With the same four venues: cards show
  `displayName` with `area` on its own line and **no duplicated area**, and the nested Plan B shows
  `disambiguatedLabel`. No rendered label equals an ID reconstruction. This half reads candidate and
  nested Plan B naming, which enters the shape in 1b.
- **Day markers.** A candidate and a **refusal** whose instants fall after midnight both render a day
  marker; the refusal case uses a post-midnight session end of the 04:07 shape.
- **Zero venues.** The zero-venue snapshot renders the `nothing_evaluable` state without throwing.
- **Plan B transfer time** is rendered, from the nested value.
- **Hours-only qualifier — discriminated on `metricsBasis` alone.** **[packet]** In real pipeline output
  the field is not independent: `ranking.js` emits `metricsBasis: "hours_only"` **inside** the
  `returnResult.tier === "unverified"` branch and `"combined"` only outside it (`web/ranking.js:557-609`),
  so `returnTier` and `metricsBasis` co-vary exactly. Two ordinary fixtures therefore prove nothing — a
  renderer deriving the qualifier from `returnTier` passes both, which is why round 2 recorded
  `ARCH-004-R1-F02` `unresolved`. The criterion is instead **two hand-built renderer inputs identical in
  every field except `metricsBasis`** — same `tier`, `hoursTier`, `returnTier`, `bindingConstraint`,
  metrics and naming — one `"hours_only"`, one `"combined"`. Assert the qualifier is present in the first
  render and absent in the second. Since the inputs differ in nothing else, only a renderer that actually
  reads `metricsBasis` can pass. Constructing an input the pipeline would not itself emit is the point:
  this is a renderer-boundary test of Decision 32, not a pipeline test.

**Failed-source handling and fallback naming**

- **[packet]** **The inconsistent-prior-state fixture, which is the hostile path.** A prior
  `data/venues.json` record carrying `business_status: "OPERATIONAL"` **and** `hours.status: "failed"`
  is fed through `_merge_hours_source`; the emitted venue (identity + `failed`) is then ranked. It
  must produce the dedicated removal **without throwing**. This is the case revision 3 argued was
  unreachable, and it currently raises `TypeError` — a test that only covers the no-identity fixture
  passes while this path stays live.
- **[packet]** **The realistic first-ever-failure fixture** — a venue with `hours.status == "failed"`,
  no last-known-good and **no Places identity fields at all** (no `name`, no `business_status`), which
  is exactly what `build/refresh.py` emits for a brand-new venue. Assert, in one test:
  1. ranking does **not** throw;
  2. the venue is removed with the dedicated failed-without-last-known-good reason and kind —
     **not** `not_operational` and **not** `hours_unknown`, both asserted explicitly;
  3. the removal carries a usable presentation label, sourced from the registry's `resolved_name`.
- The label is asserted to be non-empty and **not** an ID reconstruction, and where `resolved_name` is
  one of the duplicated values it carries Decision 22's `area` disambiguation, identically to a
  venue named from `name`.
- **[packet]** `resolveHours` totality over **both** malformed shapes, asserted separately because
  they throw on different properties: `hours` present but lacking `regular_hours` (throws on `'sat'`),
  and `hours` **absent entirely** (throws on `'current_hours_valid_from'`). Each must return the
  tagged non-schedule outcome. One test covering one shape is not totality.
- A `failed` histogram degrades to `band: unknown` with a reason distinguishing source failure from
  insufficient coverage.

**Publication robustness** — **[packet]**; `build/refresh.py`, `build/generate.py`, `tests/python/test_refresh.py` and `tests/python/test_generate.py` are all in the final packet

- A generation failure leaves **both** artifacts at their previous contents.
- The prospective HTML is generated from the **prospective** venue data, not from the deployed file —
  asserted by staging data that differs from what is on disk and checking which one reaches the page.
- **An interrupted HTML write leaves no partial page — with the fault injected *after* a partial
  prefix has reached the staging target.** **[packet]** The current generator validates the whole
  string and then calls `output_path.write_text(html_text)` directly, so a writer double that raises
  *before* any byte is written passes against today's defective implementation and discriminates
  nothing. The test must write a partial prefix to the staging path, then raise, then assert that
  the deployed HTML **and** the deployed venue data both retain their exact previous bytes and that
  no rename onto either deploy path occurred. A companion success case asserts both staged artifacts
  are renamed only after HTML validation passes.
- A missing Node bridge fails **before** any fetch — asserted with a fetch double recording zero
  calls. Asserting only the error type would pass today.
- Missing or malformed `holidays.json` fails before any fetch.
- `make generate` regenerates from on-disk data with **zero** network calls.

**Manual checklist additions** — narrow-phone layout with a long warning; the empty-results state
under each refusal; a Plan A card with every optional line absent.

---

## 13. Implementation sequence

| # | Slice | Touches | Why here |
| --- | --- | --- | --- |
| **0** | `make generate` — offline regeneration | `build/generate.py`, `Makefile` | Unblocks verification of every presentation slice at zero API cost |
| **0b** | DOM stub; make `app.js` importable | `tests/js/`, `web/app.js` bootstrap | Later presentation slices are otherwise untestable |
| 1a | Result-state machine, Plan A eligibility, control-contract **export** + validation, tolerance ownership, failed-source diagnosis, **D37 source status and D21/D39 naming on every `removed` and `travelUnknown` entry** | `web/ranking.js` | Pure logic. One slice because the state machine, eligibility and validation define one another. **Public-shape migration step 1 of 2** — see §10 |
| 1b | Presentation shape: achievable end, binding limit, latest-leave state, candidate freshness, candidate/Plan B naming, `metricsBasis`, Plan B transfer, `bestAlternative` | `web/ranking.js` | **Public-shape migration step 2 of 2** — §10's two-step table is the checklist |
| 2 | Presentation: wording, day markers, vocabulary, naming | `web/app.js` | Consumes 1a+1b; decides nothing |
| 3 | Outbound feasibility (`IMP-015`) + curation | `ranking.js`, `refresh.py`, `venues_meta.json` | Independent of 1-2 |
| 4 | UI hierarchy, disclosure, always-visible warnings, focus | `web/app.js`, `web/style.css` | Needs 2's vocabulary settled |
| 5 | Refresh preflight + staged paired publish | `build/refresh.py` | Independent; uses the generator's existing path seam — no signature change (Decision 16) |
| 6 | Phase 2 seat logging | — | After the planner is trustworthy |

**[packet]** **Slice 0 first:** slices 1b, 2 and 4 each need `web/index.html` regenerated to verify, and
the only command that regenerates it today is `make refresh`, which spends live API calls.

**Outbound is not a fix for the zero-usable-minutes defect.** The reproduced case failed on **hours** —
buffered close 23:30, arrival 23:47. `outbound_admissible` governs whether transport runs *to* a venue
and has no view of whether it is open on arrival.

---

## 14. Self-audit

| # | Confirmation | Verdict |
| --- | --- | --- |
| 1 | All six result states total and disjoint over valid input | **Yes** — §4.3. State 0 short-circuits; 1/1b partition one population; 2/3/4 partition the remainder by successive emptiness; every candidate lands in exactly one group because `overall_tier` is total into four values. `shorter`/`unverified` disjointness is structural, from `overallTier()` taking the worse tier |
| 2 | Malformed controls yield `invalid_request`, not a misleading empty board | **Yes** — Decisions 34-35; the `"teleport"` versus `office/cycle` pair is an explicit criterion |
| 3 | `nothing_evaluable` explains zero venues and simultaneous causes | **Yes** — Decision 36, four diagnostics preserved together, with a mixed-cause fixture |
| 4 | Every value `app.js` renders exists explicitly in the returned shape | **Yes, after correction** — §10's audit found Plan B transfer time; round-1 review found `metricsBasis`, which revision 3's audit had missed (`ARCH-004-R1-F02`). Both are now present, and Decision 40 closes the control-contract half that the audit had not covered at all. **Revision 5 makes that contract total** — `step` declared a UI affordance rather than a validation rule, and the export deeply immutable — and makes the `metricsBasis` criterion discriminate on that field alone |
| 5 | `app.js` no longer owns `FEASIBILITY_TOLERANCE_MINUTES` | **Yes** — Decision 31, restoring `PLAN.md`'s stated placement |
| 6 | The stale invariant compares the full result except freshness fields | **Yes** — Decision 15, structural recursive deletion, with a non-vacuity control |
| 7 | Each semantic UI criterion proves intended rendering positively | **Yes** — §12's runtime group; each states a positive assertion, and the absence-only forms are called out as insufficient |
| 8 | Publication cannot expose new data with an old page if generation fails | **Yes for the failure-driven case** — Decision 16, through the generator's existing path seam, with no signature change. **Not** cross-file atomic: a crash between two renames can still mismatch, and the document says so rather than overclaiming |
| 10 | A venue with no Places `name` still yields a correctly labelled removal | **Yes** — Decision 39, falling back to the registry's `resolved_name`, with disambiguation unchanged because its distinctness is identical |
| 11 | The stale projector is independently proven not to erase unrelated structure | **Yes** — Decision 15's helper-level test, which the behavioural test cannot substitute for |
| 9 | Evidence tags match the final packet | **Yes** — §1. All four reproduced snapshot claims are now `[packet]`; `[repo]` is reserved for live test counts, `data/` sources, and the rest of the Python suite |

---

## 15. What this design does not change

Pure ranking logic separated from DOM rendering; the existing ranking and tier model; historical
busyness as a within-venue adjustment rather than a seat probability; Plan B recalculated from the
failed first stop with both bounds; independent per-source failures with last-known-good retention;
coarsening before refresh; the strict Python-Node boundary; the static generated-page architecture; no
frontend framework and no npm runtime dependency; `COVERED` + `AT_LEAST(0)` tagged semantics with
`usable_minutes = duration`; and the existing absolute-minute, date and service-day handling, which
already covers midnight correctly.

No tier rule, no ordering key, no band threshold and no return-leg rule is altered. The changes are:
what may occupy the Plan A slot, how results and refusals are shaped, what the pipeline exposes, where
one policy constant lives, what the renderer prints, what the duration control accepts, how a failed
source is handled, and when files are written.
