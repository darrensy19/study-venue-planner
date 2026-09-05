# Review record: ARCH-004

## Assignment

- **Assignment ID**: `ARCH-004`
- **Work type**: `architecture/high-level`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewer route**: `codex_sol_high` — Sol, effort `high`
- **Baseline commit**: `abe6cf7`
- **Reviewed diff or commit**: untracked `docs/superpowers/specs/2026-09-05-review-response-design.md` revision 3; SHA-256 `4117ab182e960f9a83d6bace67f2fdc792935713b9d5667839c7fbe968e5ab92`
- **Scope**: initial repo-grounded validation of the revision-3 candidate design before transcription into `PLAN.md` / `CLAUDE.md`; implementation, transcription, lifecycle reconciliation, `ARCH-003`, commit, push, and activation are excluded
- **Finding disposition schema**: `factual-assessment/v1`

## Review round 1 — 2026-09-05

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol_high`
- **Runtime model verification**: the user's Codex Sol, effort high route selection is relied on because the runtime exposes no independent model signal
- **Reviewed artifact**: untracked `docs/superpowers/specs/2026-09-05-review-response-design.md` revision 3; SHA-256 `4117ab182e960f9a83d6bace67f2fdc792935713b9d5667839c7fbe968e5ab92`

### Resolution of prior findings

None — first review round.

### Findings

#### `ARCH-004-R1-F01` — High — The failed-hours retraction is not fail-closed over the refresh pipeline's accepted prior state

- **Status at issuance**: `open`
- **Design claim challenged**: Decision 38 says, “a `failed` source is data, not an exception,” while its supporting claim says the `TypeError` is “not reachable from any record `build/refresh.py` can actually emit” (`docs/superpowers/specs/2026-09-05-review-response-design.md:426-473`).
- **Evidence**: `_merge_hours_source` derives `failed` solely from the absence of `previous_hours.last_success_at`, but independently copies every present identity field from the prior deployed record; it does not validate that those two parts are coherent (`build/refresh.py:85-95`, `build/refresh.py:106-134`). A direct probe with a prior record containing `business_status: "OPERATIONAL"` and `hours.status: "failed"` produced identity plus a new `failed` hours block. Feeding the corresponding merged venue to `rankVenues` reached hours resolution and threw `TypeError: Cannot read properties of undefined (reading 'sat')`: the operational gate passes (`web/ranking.js:1649-1651`), and `resolveHours` dereferences `venue.hours` / `hours.regular_hours` without a failed-status guard (`web/ranking.js:1017-1043`). Atomic file replacement prevents torn bytes, but `_load_existing_venues` performs no semantic validation before this merge (`build/refresh.py:191-195`). The design's own direct-totality criterion also tests only “an hours block lacking `regular_hours`,” not the absent-hours-block case Decision 38 promises (`docs/superpowers/specs/2026-09-05-review-response-design.md:883-886`).
- **Impact**: A hand-edited, migrated, or otherwise semantically inconsistent but parseable `venues.json` can be accepted as prior state and re-emitted by `refresh.py` as `failed` plus operational identity. The design would classify the crash guard as merely defensive and its proposed direct test can pass while `venue.hours` absent still throws, leaving the exact hostile path requested by this assignment unproved.
- **Recommended correction**: Qualify the unreachable claim to coherent outputs descended from a successful/first-ever refresh, and treat Decision 38's early `hours.status == "failed"` guard as a live fail-closed boundary for accepted prior files. Add two discriminating tests: the realistic no-identity first failure and an inconsistent prior record that refresh re-emits with identity plus `failed`, both producing the dedicated removal without throwing. Test `resolveHours` separately with `venue.hours` absent and with a present block lacking `regular_hours`; both must return the tagged non-schedule outcome.

#### `ARCH-004-R1-F02` — Medium — The returned-shape audit omits a value the renderer currently renders

- **Status at issuance**: `open`
- **Design claim challenged**: Decision 32 says, “the shape carries everything `app.js` renders, with no business-rule derivation left in the renderer” (`docs/superpowers/specs/2026-09-05-review-response-design.md:662-686`).
- **Evidence**: `app.js` reads `candidate.metricsBasis` to render the user-visible “hours only — return unverified” qualifier (`web/app.js:173-175`), and `rankVenues` currently carries that field onto every candidate (`web/ranking.js:1720-1729`). Section 10's purported full audit has no `metricsBasis` row; an exact search of the design finds no occurrence of that field. The self-audit nevertheless states that every rendered value is covered (`docs/superpowers/specs/2026-09-05-review-response-design.md:936`).
- **Impact**: Slice 1b can follow the stated checklist while dropping `metricsBasis`; slice 2 must then omit the qualifier or reconstruct the hours-only condition from return/tier fields, violating Decision 32's renderer boundary.
- **Recommended correction**: Add `metricsBasis` to section 10 as a present-today presentation field and add a DOM assertion that an hours-only unverified candidate renders its qualifier from that field. If the qualifier is intentionally retired, state that explicitly and remove the current rendered value from Decision 32's claimed preservation scope.

#### `ARCH-004-R1-F03` — High — Control validation has no shared interface from which the form can render

- **Status at issuance**: `open`
- **Design claim challenged**: Decision 34 says, “`app.js` must not independently know that sessions are 180-360 minutes or which origins exist” (`docs/superpowers/specs/2026-09-05-review-response-design.md:291-294`), while Decision 27 requires the UI control itself to enforce `min: 180`, `max: 360` (`docs/superpowers/specs/2026-09-05-review-response-design.md:649-658`).
- **Evidence**: The current renderer can build its form only because it owns `ORIGINS`, `MODES`, and the duration-input bounds (`web/app.js:9-17`, `web/app.js:241-287`). The proposed returned-shape audit exposes a permitted set/range only inside an `invalid_request` explanation (`docs/superpowers/specs/2026-09-05-review-response-design.md:683-686`); it defines no control contract available during the initial or any valid render. `app.js` is imported before rendering and today constructs defaults and controls from its own constants (`web/app.js:73-97`, `web/app.js:302-305`).
- **Impact**: An implementation must either duplicate the supported sets/ranges in `app.js` (directly violating Decision 34), fail to build the initial valid form, or invent an additional export/result contract not approved by this design. The form and pure-entry-point validation can then drift while all listed `invalid_request` tests still pass.
- **Recommended correction**: Specify one shared control-contract interface owned by `ranking.js` and consumed by `app.js` for every render, including supported origin/mode values and numeric bounds; presentation labels may remain renderer-owned. Add a test deriving the form options/bounds from that interface and asserting the same boundary values against `rankVenues`, so duplicated renderer constants fail.

#### `ARCH-004-R1-F04` — High — The slice plan contradicts its one-time shape migration and hides cross-slice dependencies

- **Status at issuance**: `open`
- **Design claim challenged**: Decision 32's section says, “The shape changes exactly once, in slice 1b” (`docs/superpowers/specs/2026-09-05-review-response-design.md:700-701`).
- **Evidence**: Slice 1a is assigned the result-state machine, control validation, failed-source diagnosis, and fallback naming (`docs/superpowers/specs/2026-09-05-review-response-design.md:908-914`). Those decisions necessarily change the current public result object, which contains only `{planA, groups, alternatives, travelUnknown, removed, refusals}` (`web/ranking.js:1604-1625`, `web/ranking.js:1764-1771`): Decision 6 adds `resultState`; Decision 34 adds the invalid-control payload; and Decision 38 requires source status and Decision 39 naming on the new removal. But slice 1b separately owns freshness, naming, diagnostics, and the presentation-shape migration. In particular, Decision 38 requires the source status of Decision 37 and the label of Decision 39 (`docs/superpowers/specs/2026-09-05-review-response-design.md:462-480`), while Decision 37 and the general naming propagation of Decision 21 are assigned by the sequence to 1b.
- **Impact**: Slice 1a cannot satisfy its own failed-source and state acceptance criteria without making the first returned-shape change and implementing pieces nominally deferred to 1b. Conversely, deferring those fields leaves slice 1a's dedicated removal unlabelled/unstamped. Either route violates the claimed sequence and makes per-slice review targets ambiguous.
- **Recommended correction**: Replace the “exactly once” claim with an explicit two-step public-shape migration: enumerate the state/control/failed-removal fields added in 1a, then the presentation fields added in 1b, and move the required naming/status foundations into 1a. Alternatively merge 1a and 1b. In either case, assign each acceptance criterion to the first slice where all of its required fields exist.

#### `ARCH-004-R1-F05` — Medium — The interrupted-write criterion can pass without exercising the atomic-HTML guarantee

- **Status at issuance**: `open`
- **Design claim challenged**: Decision 16 requires both deployed artifacts to be replaced “each via temp file + atomic rename” (`docs/superpowers/specs/2026-09-05-review-response-design.md:535-560`).
- **Evidence**: The current generator validates the full string and then writes `output_path` directly (`build/generate.py:324-334`), so an interruption after a partial write is the defect the new atomic HTML path must prevent. Section 12 requires only that “An interrupted HTML write leaves no partial page” (`docs/superpowers/specs/2026-09-05-review-response-design.md:890-899`) and does not require the fault to occur after any byte reaches the write target. A test double that raises before writing anything passes against the current direct-write implementation and therefore does not discriminate Decision 16's atomic rename from the defect it targets.
- **Impact**: All publication criteria can be green while HTML is still written directly: the generation-failure test can fail before output, the prospective-data test can cover only successful generation, and the interruption test can interrupt before the first byte. A real mid-write interruption can still leave a truncated deployed page.
- **Recommended correction**: Make the criterion non-vacuous by injecting a writer that writes a partial prefix to the staging target and then raises; assert that the deployed HTML and deployed JSON both retain their exact previous bytes, and that no deploy-path rename occurred. Keep a separate success assertion that both staged artifacts are renamed only after HTML validation.

### Non-blocking observations

- The six-state precedence is total and disjoint for valid controls over the actual three candidate groups. `overallTier` takes the worse tier with `unverified` lowest (`web/ranking.js:408-416`), so `shorter` and `unverified` cannot overlap; zero venues, all-hard-filtered venues, and all-preference-invalid venues all reach the proposed `nothing_evaluable` branch with distinct diagnostics rather than falling through.
- The existing `venues_path` / `output_path` parameters do support generation from staged JSON into staged HTML without a signature change (`build/generate.py:261-334`). The design accurately limits sequential renames to failure-driven skew prevention rather than claiming cross-file transactional atomicity.
- `tests/js/ranking.test.js` supplies `toleranceMinutes: 15` through `BASE_CONTROLS` for every current `rankVenues` call, so adding the ranking-owned default does not remove the existing explicit-override coverage.

### Verification performed

- Read `HANDOFF.md` first; confirmed lifecycle `review_requested`, baseline `abe6cf7`, reviewer-only write ownership, and the frozen primary diff/status.
- Read the required `WORKFLOW.md` roles, lifecycle, one-writer, and review-record sections; read the complete revision-3 design and the gate's explicit unverified/not-asked lists.
- Inspected `web/ranking.js`, `web/app.js`, `build/refresh.py`, `build/generate.py`, `scraper/venue_sources.py`, `data/venue_sources.json`, `package.json`, `Makefile`, the named `PLAN.md` / `CLAUDE.md` / `DECISIONS.md` slices, and the relevant JS/Python tests directly.
- Reproduced the two named ranking scenarios and the empty `office/cycle` population; checked the embedded transport coverage and the registry/stored-name relation. Registry data has 28 non-empty records, 23 distinct names, and the registry names equal the generated stored names per venue.
- Probed `_merge_hours_source` with an inconsistent prior record and then `rankVenues` with the emitted failed-hours/operational-identity shape; observed the identity-plus-`failed` output and the `TypeError` recorded in `ARCH-004-R1-F01`.
- Confirmed the tree from historical evidence commit `3e3decb` through baseline `abe6cf7` did not change the named code, data, tests, or governing documents; reran both suites first-hand at the current baseline.
- `.venv/bin/pytest tests/python/ -q` passed: **188 passed in 1.11s**.
- `node --test tests/js/*.test.js` passed: **184 passed, 0 failed**.
- `git diff --check` passed with no diagnostics.
- `git status --short` before this reviewer-owned record showed modified `HANDOFF.md` and `reviews/LEDGER.md`, plus untracked design and gate files, matching the assignment except that the gate record had since been created.

### Could not verify

- None. Prospective implementation behavior was assessed for executability and non-vacuity; no claim is made that unimplemented UI/publication behavior has run.

### User decisions required

- None. Each correction is a bounded reconciliation of the candidate design with its stated invariant or the current repository interface.

### Recommendation

`CHANGES_REQUESTED`

The six-state model and staged-path seam are sound, but the failed-source reachability claim is not fail-closed, the renderer/control contracts are incomplete, the slice order contradicts the claimed one-time shape change, and one publication criterion is vacuous against the current direct-write defect.

---

## Primary response to review round 1 — 2026-09-05

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewed artifact after response**: untracked `docs/superpowers/specs/2026-09-05-review-response-design.md` **revision 4**; SHA-256 `92d75c8bcd370ac47205eb520a856c5812608439b5f757b85d588fd158bdc8c3` (was `4117ab18…` at revision 3)

### Finding dispositions

#### `ARCH-004-R1-F01` — `accepted`

- **Factual assessment**: `confirmed`
- **Independent verification**: Reproduced the reviewer's probe directly. Calling `_merge_hours_source` with a prior record carrying `business_status: "OPERATIONAL"` and `hours: {status: "failed"}` (no `last_success_at`) emitted `identity = {name, lat, lng, business_status: 'OPERATIONAL'}` alongside `hours = {source, last_attempt_at, status: 'failed'}` — identity and `failed` together, exactly as reported. Ranking that merged venue threw `TypeError: Cannot read properties of undefined (reading 'sat')`. I also verified the reviewer's second half, which revision 3 had not tested at all: `resolveHours` with `venue.hours` **absent entirely** throws on a *different* property, `current_hours_valid_from`. So the two malformed shapes fail differently and totality over one is not totality over both.
- **Response**: Revision 3's claim that the crash was "not reachable from any record `build/refresh.py` can actually emit" was **false as stated**, and I have withdrawn it rather than narrowed it quietly. My reasoning held only for records descended from a coherent refresh history; it silently assumed the pipeline's own outputs are its only inputs, which semantic validation of the prior file would be needed to guarantee, and `_load_existing_venues` performs none. §6.4 now states the true scope, shows the reproduction, and tabulates both malformed shapes with their distinct failure properties. Decision 38's guard is reclassified from defence in depth to a **live fail-closed boundary on accepted prior state**, and `resolveHours` is required total over both shapes. §12 gains the inconsistent-prior-state fixture as the hostile path — the case revision 3 argued away — alongside the existing no-identity fixture, and splits the `resolveHours` totality criterion in two.

#### `ARCH-004-R1-F02` — `accepted`

- **Factual assessment**: `confirmed`
- **Independent verification**: `web/app.js:174` reads `candidate.metricsBasis` to emit the user-visible "(hours only — return unverified)" qualifier, and `rankVenues` carries the field onto every candidate. An exact search of revision 3 returned **zero** occurrences of `metricsBasis`, confirming §10's audit table omitted it while §14 claimed the audit was complete.
- **Response**: Accepted with no qualification. The qualifier is not being retired — it is the only signal distinguishing hours-only metrics from combined ones, and Decision 11 depends on that distinction. `metricsBasis` is added to §10 as a present-today presentation field, labelled as the omission this review caught, and §12 gains a DOM criterion rendering both an `hours_only` and a `combined` candidate, so a renderer that reconstructs the condition from tier fields instead of reading the field fails. §14's item 4 is corrected to record that the audit was incomplete rather than continuing to claim it was not.

#### `ARCH-004-R1-F03` — `accepted`

- **Factual assessment**: `confirmed`
- **Independent verification**: `web/app.js:9-17` declares `ORIGINS` and `MODES`; the duration input's bounds are written into the control the renderer builds. Revision 3 exposed a permitted set or range **only** inside the `invalid_request` payload — a value that exists only after an invalid submission — so nothing was available to build the initial valid form from. The three implementation routes the reviewer names are the only ones revision 3 left, and each breaks a stated rule.
- **Response**: This was a real hole, not a wording problem: Decision 34 forbade the renderer from knowing the supported origins while Decision 27 required the form to enforce bounds, with no interface between them. Added **Decision 40** — one control contract exported by `ranking.js` carrying supported origin and mode value tokens, duration bounds and step, and leave-at bounds; read by `rankVenues()`'s own validation, by the `invalid_request` payload, and by `app.js` for every render including the first. Value tokens are business facts and move; human-readable labels stay renderer-owned, consistent with Decision 23. §12 gains a criterion deriving the form's options and bounds from the contract and asserting the same boundary values against `rankVenues()`, so a locally re-declared set or bound fails. `ranking.js` remains pure, DOM-free and I/O-free; no settled foundation moves.

#### `ARCH-004-R1-F04` — `accepted`

- **Factual assessment**: `confirmed`
- **Independent verification**: The current returned object is `{planA, groups, alternatives, travelUnknown, removed, refusals}`. Slice 1a as written owned the result-state machine (Decision 6 replaces `refusals` with `resultState`), control validation (Decision 34's payload) and the failed-source removal (which Decision 38 requires to carry Decision 37's source status and Decision 39's label) — while slice 1b separately owned freshness, naming and the "one-time" shape migration. Slice 1a therefore could not satisfy its own acceptance criteria without changing the public shape first and implementing pieces nominally deferred to 1b. The contradiction is real.
- **Response**: The "shape changes exactly once, in slice 1b" claim is **withdrawn**. §10 now states an explicit two-step public-shape migration with a per-step field table, and moves Decision 37's source status and Decision 39's naming **into slice 1a**, since a removal that arrives unlabelled or unstamped fails its own criterion. The slice table marks 1a and 1b as migration steps 1 and 2. I did not take the merge-1a-and-1b alternative: keeping them separate preserves the reviewable boundary between logic and presentation, which is the reason the split existed. §10 also states that each acceptance criterion belongs to the first slice in which every field it reads exists, and that this table — not §12's subject-based grouping — governs when each criterion becomes runnable.

#### `ARCH-004-R1-F05` — `accepted`

- **Factual assessment**: `confirmed`
- **Independent verification**: `build/generate.py:334` is `output_path.write_text(html_text)`, called after `validate_generated_artifact(html_text)`. So validation already precedes the write — but the write itself is direct and non-atomic, and a double raising before any byte reaches the target passes against that defective implementation unchanged. Revision 3's criterion, "an interrupted HTML write leaves no partial page", does not require the fault to occur after a partial write and therefore discriminates nothing.
- **Response**: Accepted. The criterion now requires the injected writer to write a **partial prefix to the staging target and then raise**, and to assert that the deployed HTML and the deployed venue data both retain their exact previous bytes and that no rename onto either deploy path occurred. A companion success case asserts both staged artifacts are renamed only after HTML validation passes. This is the assertion that separates Decision 16's atomic rename from the direct-write defect it targets.

### Corrections made

- `docs/superpowers/specs/2026-09-05-review-response-design.md` → **revision 4**. 15 exact-match edits applied; every edit asserted to match exactly once, so no unintended region changed. Decisions now number 1-40, contiguous, with every `Decision N` / `DN` cross-reference resolving. No withdrawn claim survives as a live proposal — the two remaining occurrences of the retracted wording are its own withdrawal notice and the revision-4 changelog.
- No code, test, `PLAN.md` or `CLAUDE.md` change was made; this assignment excludes all of them.

### Verification

- `.venv/bin/pytest tests/python/ -q` → **188 passed in 1.53s**
- `node --test tests/js/*.test.js` → **184 tests, 184 pass, 0 fail**
- `git diff --check` → clean, exit 0
- `git status --short` → ` M HANDOFF.md`, ` M reviews/LEDGER.md`, untracked `docs/superpowers/specs/2026-09-05-review-response-design.md`, `reviews/ARCH-004-gate.md`, `reviews/ARCH-004.md`

### Non-blocking observations acknowledged

The reviewer's three non-blocking observations are accepted as recorded and required no change: the six-state precedence is total and disjoint over the actual groups; the existing `venues_path`/`output_path` parameters support staged generation without a signature change; and `tests/js/ranking.test.js` supplies `toleranceMinutes: 15` through `BASE_CONTROLS` for every current `rankVenues` call, so the ranking-owned default removes no explicit-override coverage.

### Outstanding user decisions

None. No finding required a user decision; all five were resolved against repository evidence. Whether to commit the untracked design, gate and review records remains the user's call and is unchanged by this round.

---

## Review round 2 — 2026-09-05

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol`
- **Runtime model verification**: the user's Codex Sol, effort medium route selection is relied on because the runtime exposes no independent model signal
- **Reviewed artifact**: targeted revision-3-to-revision-4 correction in untracked `docs/superpowers/specs/2026-09-05-review-response-design.md`; revision 4 SHA-256 `92d75c8bcd370ac47205eb520a856c5812608439b5f757b85d588fd158bdc8c3` (round-1 revision 3 SHA-256 `4117ab182e960f9a83d6bace67f2fdc792935713b9d5667839c7fbe968e5ab92`)

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-004-R1-F01` | `unresolved` | Revision 4 correctly withdraws the absolute unreachability claim, reproduces both malformed hours shapes, classifies Decision 38's early guard as live fail-closed, and adds discriminating criteria (`docs/superpowers/specs/2026-09-05-review-response-design.md:477-518`, `536-551`, `974-993`). However, the same live §6.4 analysis still says the identity-plus-`failed` state “is a state the refresh pipeline cannot produce” (`docs/superpowers/specs/2026-09-05-review-response-design.md:529-534`), directly contradicting its corrected proof that `_merge_hours_source` re-emits exactly that state from accepted inconsistent prior data (`:495-518`; repository mechanism at `build/refresh.py:85-95`, `106-134`, `191-195`). A reader can still implement or document the guard as unreachable. Delete or qualify that surviving sentence to say the pipeline does not produce it from a coherent history but does re-emit it from accepted inconsistent prior state. |
| `ARCH-004-R1-F02` | `unresolved` | `metricsBasis` is now present in §10 and the self-audit is corrected (`docs/superpowers/specs/2026-09-05-review-response-design.md:742-765`, `1045-1051`), matching the current renderer read (`web/app.js:173-175`) and candidate field (`web/ranking.js:1720-1729`). The new DOM criterion is not yet non-vacuous: it asks for an `hours_only` candidate that shows the qualifier and a `combined` candidate that does not (`docs/superpowers/specs/2026-09-05-review-response-design.md:967-970`). In the real pipeline, `returnTier === "unverified"` structurally implies `metricsBasis === "hours_only"` (`web/ranking.js:552-609`), so a renderer deriving the qualifier from `returnTier` passes both ordinary fixtures without reading `metricsBasis`. Require two hand-built renderer inputs identical in every relevant field except `metricsBasis`, and assert the qualifier flips only with that field. |
| `ARCH-004-R1-F03` | `unresolved` | Decision 40 supplies the missing pre-result interface and correctly keeps value tokens in ranking while labels remain presentation-owned (`docs/superpowers/specs/2026-09-05-review-response-design.md:309-345`). Two contract holes remain. First, it calls the export a description of what `rankVenues()` accepts, includes the duration `step`, and says validation reads the contract (`:323-335`), while Decision 35 still accepts every integer in `[180,360]` and no criterion distinguishes an off-step value such as `181` (`:291-298`, `904-916`). An implementation may therefore silently narrow the pure API or ignore a field the design says validation reads. State whether step is UI-only (the smallest correction, preserving Decision 35) or a validation rule, and add the corresponding off-step assertion. Second, an exported object/array that `rankVenues()` reads is externally mutable unless the contract requires deep immutability; mutation by `app.js` would make the supposedly pure function's result depend on prior external action, despite `ranking.js`'s existing pure/DOM-free/I/O-free boundary (`web/ranking.js:1-10`). Require a deeply immutable export or a defensive-copy accessor. Finally, make the form-derivation test discriminating by supplying a sentinel contract to the control renderer (or equivalent dependency seam); comparing only today's equal values allows locally duplicated constants to pass despite the criterion's claim that they must fail (`docs/superpowers/specs/2026-09-05-review-response-design.md:904-907`). |
| `ARCH-004-R1-F04` | `unresolved` | The one-time migration claim is withdrawn and the two-step table correctly places state/control fields in 1a and candidate presentation fields in 1b (`docs/superpowers/specs/2026-09-05-review-response-design.md:779-794`, `1020-1032`). But the table moves only the failed-source removal's naming into 1a (`:788`), while Decision 36 requires a 1a `nothing_evaluable` state to carry `travelUnknown` and all `removed` diagnostics with Decision 21 naming (`:267-275`); neither general removal naming nor travel-unknown naming is assigned to a migration step. The rule below the table then assigns the single combined naming criterion to 1a (`:791-794`), although that criterion also reads card and nested Plan B names that the table assigns to 1b (`:789`, `960-962`). Slice 1a can therefore still emit an incompletely named state, and the naming criterion cannot run in the slice to which it is assigned. Put naming on all 1a non-candidate diagnostics (`removed` and `travelUnknown`) in step 1a, keep candidate/Plan-B naming in 1b, and split/assign the naming acceptance criterion accordingly. Also describe D40 as a module export rather than a returned-object field in the migration table, consistent with Decision 40's own static-export rule (`:342-343`). |
| `ARCH-004-R1-F05` | `resolved` | Decision 16's corrected criterion now requires a partial prefix to reach the staging path before the injected failure, exact byte preservation at both deploy paths, and no deploy-path rename; its companion success case requires both renames only after HTML validation (`docs/superpowers/specs/2026-09-05-review-response-design.md:997-1009`). That fails against the current direct `output_path.write_text(html_text)` implementation (`build/generate.py:324-334`) and discriminates staged atomic replacement as required. |

### Findings

No new finding IDs. `ARCH-004-R1-F01` through `F04` remain unresolved because the revision-4 corrections do not yet close their recorded failure modes; `ARCH-004-R1-F05` is resolved.

### Non-blocking observations

- Decision headings are exactly 1 through 40, each appearing once; every `Decision N` and `DN` cross-reference resolves to an existing decision.
- The six-state model, Plan A selection, naming source/fallback rule, tolerance ownership, and staged-path seam remain unchanged by the correction delta and retain round 1's disposition.
- Current `git status --short` includes an untracked `.claude/` path not listed in the primary response. It is outside ARCH-004's artifact and was neither inspected nor attributed to this assignment.

### Verification performed

- Read `HANDOFF.md` first, then reduced the typed correction slice with `.venv/bin/python3 .cross-agent-workflow/finding_state.py reviews/ARCH-004.md --emit-chunks --actor reviewer-round2`; all five prior findings reduced to `primary_accepted` before this round.
- Checked each revision-4 correction directly against its round-1 finding, primary disposition, current `web/ranking.js` / `web/app.js` / refresh/generation seam, and the new acceptance criteria; did not re-review round-1-cleared foundations.
- Reproduced both current `resolveHours` failures first-hand: absent `hours` throws on `current_hours_valid_from`; present `hours` without `regular_hours` throws on the weekday key. Reproduced `_merge_hours_source` re-emitting operational identity plus `hours.status: "failed"` from inconsistent prior state.
- Verified the revision-4 SHA-256 exactly: `92d75c8bcd370ac47205eb520a856c5812608439b5f757b85d588fd158bdc8c3`.
- Parsed decision headings and references mechanically: headings are contiguous 1-40 with no duplicates; no `Decision N` / `DN` reference points outside that set.
- `.venv/bin/pytest tests/python/ -q` passed: **188 passed in 1.09s**.
- `node --test tests/js/*.test.js` passed: **184 passed, 0 failed**.
- `git diff --check` passed with no diagnostics.
- `git status --short` showed modified `HANDOFF.md` and `reviews/LEDGER.md`; untracked `.claude/`, the revision-4 design, gate record, and review record.

### Could not verify

- None. The corrected prospective criteria were assessed for implementability and non-vacuity; no claim is made that unimplemented behavior has executed.

### User decisions required

- None. The remaining corrections are deterministic reconciliations of Decisions 32, 38, and 40 with their own stated invariants and slice contract.

### Recommendation

`CHANGES_REQUESTED`

Revision 4 resolves the atomic-publication finding, but four prior findings remain open: one withdrawn reachability claim survives in live prose, the `metricsBasis` test does not force field consumption, Decision 40 is not yet a total immutable shared contract, and the two-step migration still misassigns diagnostic naming.

---

## Primary response to review round 2 — 2026-09-05

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewed artifact after response**: untracked `docs/superpowers/specs/2026-09-05-review-response-design.md` **revision 5**; SHA-256 `1805cfd9433b21db564d16582a700f7b2e6031219d38ff845a1c2b3156ceda50` (was `92d75c8b…` at revision 4)
- **Scope**: `ARCH-004-R1-F01` through `F04` only. `ARCH-004-R1-F05` is `resolved` and was not reopened; no round-1-cleared foundation was reopened.

### Finding dispositions

#### `ARCH-004-R1-F01` — `accepted`

- **Factual assessment**: `confirmed`
- **Independent verification**: Read the surviving sentence at `docs/superpowers/specs/2026-09-05-review-response-design.md:533-534` (revision 4) — "which is a state the refresh pipeline cannot produce" — sitting in live §6.4 prose roughly 20 lines below the reproduction that disproves it. Re-derived the mechanism rather than trusting round 1's record: `_resolve_freshness` returns `failed` on the sole condition that `previous_hours.last_success_at` is absent (`build/refresh.py:85-95`), while the failure branch of `_merge_hours_source` copies each of `IDENTITY_FIELDS` from `existing_venue` on nothing but a presence test (`build/refresh.py:120-124`), and `_load_existing_venues` does a bare `json.loads` with no semantic validation (`build/refresh.py:191-195`). Re-ran the probe first-hand: a prior record with `business_status: "OPERATIONAL"` and an hours block lacking `last_success_at` emits `identity = {'name', 'lat', 'lng', 'business_status': 'OPERATIONAL'}` with `hours = {..., 'status': 'failed'}`. The two halves are derived independently and never checked against each other, so the sentence is false and the reviewer's `unresolved` is correct.
- **Response**: Accepted with no qualification. The sentence is **deleted**, not softened, and replaced with the precise statement it should always have been: `refresh.py` does not produce identity + `failed` from a *coherent refresh history*, but it does re-emit exactly that state from *accepted inconsistent prior state*, so both malformed shapes are live and neither may be implemented or documented as unreachable. **A consistency sweep found the same withdrawn claim surviving in a second live location the review did not cite** — §2's revision-3 changelog row B, which still read "The reported crash is *not reachable* from any state `build/refresh.py` can emit" in the present tense with no withdrawal marker. Correcting only the cited line would have left the finding's actual failure mode — a reader implementing the guard as unreachable — fully intact. That row is now struck through in place with an explicit pointer to the withdrawal, preserving the changelog as a record of what revision 3 claimed rather than rewriting its history. Decision 38's guard, already reclassified in revision 4, is unchanged; no decision moves.

#### `ARCH-004-R1-F02` — `accepted`

- **Factual assessment**: `confirmed`
- **Independent verification**: Read `web/ranking.js:557-609` directly. `metricsBasis: "hours_only"` is emitted **inside** the `if (returnResult.tier === "unverified")` branch and `metricsBasis: "combined"` only in the fall-through return below it — there is no third path. So over real pipeline output the implication is biconditional, not merely one-way as the finding states it: `metricsBasis === "hours_only"` ⟺ `returnTier === "unverified"`. Revision 4's criterion asked for an `hours_only` candidate that shows the qualifier and a `combined` candidate that does not; any two such fixtures also differ in `returnTier`, so a renderer keying on `candidate.returnTier` instead of `candidate.metricsBasis` (`web/app.js:173-175` reads the latter today) passes both. The criterion discriminated nothing and the reviewer is right.
- **Response**: Accepted. The criterion is rewritten to require **two hand-built renderer inputs identical in every relevant field except `metricsBasis`** — same `tier`, `hoursTier`, `returnTier`, `bindingConstraint`, metrics and naming — with the qualifier asserted present in the first render and absent in the second. Because nothing else varies, only a renderer that actually reads the field can pass. The criterion now also records *why* the co-variance makes ordinary fixtures vacuous, and states explicitly that constructing an input the pipeline would not itself emit is the point rather than a defect in the fixture: this is a renderer-boundary test of Decision 32, not a pipeline test. §10's audit row and §14's item 4 are unchanged in substance; item 4 gains a note that the criterion now discriminates.

#### `ARCH-004-R1-F03` — `accepted`

- **Factual assessment**: `confirmed`
- **Independent verification**: All three sub-claims check out. **(i) Step.** Decision 40's table listed "minimum, maximum and step" and its rules said validation reads the contract, while Decision 35 accepts "an integer in `[180, 360]`" with no step term and no criterion distinguishing `181`. The two cannot both be true of the same reading, so an implementer could narrow the pure API or silently ignore a contract field. **[packet]** `web/app.js:257-264` writes `step: "15"` into the duration control today, so `step` is a real renderer-owned fact, not a hypothetical. **(ii) Mutability.** `web/ranking.js:1` declares the module "Pure hours-resolution and feasibility-tier logic. No DOM, no fetch, no imports." A plain exported object or array is mutable by any importer, and since `rankVenues()` reads the contract, `app.js` mutating it would make that function's behaviour depend on prior external action — purity broken through a seam the design itself introduced. **(iii) Sentinel.** Revision 4's criterion compared the form's derived options and bounds against the contract's values. `app.js`'s local `ORIGINS`/`MODES`/bounds are *equal* to those values today, so a renderer that never reads the contract satisfies the comparison — the criterion's own claim that a locally re-declared constant "must fail this test" was false.
- **Response**: Accepted on all three. **Step is declared UI-only**, which is the correction that preserves Decision 35 rather than reopening it: `rankVenues()` accepts any integer in `[min, max]`, on-step or not; `step` lives in the contract solely so the increment cannot drift from the bounds it belongs to; validation reads the supported sets and numeric bounds and does **not** read `step`. Decision 35 gains an explicit "every integer in that range, on-step or not" clause so the two cannot be read apart again, and §12 gains the off-step assertion — `durationMinutes: 181` is evaluated normally and yields **no** `invalid_request`. **The export is required deeply immutable**, frozen at every level (top-level object, each nested bounds object, each supported-value array) at module load, with a fresh-deep-copy accessor named as an acceptable equivalent; freezing is preferred because module code is strict by default, so a mutation attempt throws rather than being silently discarded. §12 gains a mutation-attempt criterion asserting the contract is unchanged and a following `rankVenues()` call behaves identically. **The form-derivation criterion becomes a sentinel test**: the control renderer takes the contract through an injected dependency seam, the test supplies a sentinel contract whose origins, modes and bounds all differ from the real ones, and the rendered options and bounds must be the sentinel's — with a companion assertion feeding the *real* contract's boundary values to `rankVenues()` so the seam cannot drift from the validator. Decision 40's own scope is unchanged: value tokens and bounds in `ranking.js`, labels renderer-owned, still a static export, still pure and DOM-free.

#### `ARCH-004-R1-F04` — `accepted`

- **Factual assessment**: `confirmed`
- **Independent verification**: Decision 36's diagnostics table requires `travelUnknown` entries to carry "the naming fields of Decision 21" and `removed` entries to carry "reason, kind, naming and source status (Decision 37)", and `nothing_evaluable` — the state that carries them — is a migration step 1a state by §10's own table. But revision 4's 1a row moved only "the failed-source removal's reason/kind, its D37 source status and its D39 naming fields"; naming on the *other* `removed` entries and on `travelUnknown` entries appears in neither step. Slice 1a could therefore emit a `nothing_evaluable` state whose diagnostics are unnamed and still satisfy the table. Separately, §12's single **Naming** criterion asserted on cards (1b), nested Plan B (1b), removal notices (1a) and travel-unknown entries (1a) at once, so the rule "each acceptance criterion is assigned to the first slice in which every field it reads exists" placed it in a slice where it could not run. Finally, the 1a row listed "the D40 control contract" among "Fields entering the public shape" although Decision 40 itself says it "is a static export, not a field on a result". All three are real.
- **Response**: Accepted on all three, taking the reviewer's proposed split rather than any alternative. **Naming moves into step 1a in full for every non-candidate diagnostic** — every `removed` entry and every `travelUnknown` entry, D21/D22/D39 — with the 1a row's rationale now citing Decision 36 as the reason. The 1b row is unchanged and keeps candidate and nested Plan B naming. **The naming criterion is split into two**: a 1a criterion covering removal notices and travel-unknown entries, and a 1b criterion covering cards and nested Plan B; each states its slice, and the rule below §10's table now explains that one criterion reading both diagnostic and candidate names can run in neither slice alone. **Decision 40 is removed from the migration table's field list** and given its own note: it is a static module export, ships in slice 1a alongside the validation that reads it, and changes no returned-shape consumer. §13's slice-1a row is brought into line — "control-contract **export** + validation" and "D37 source status and D21/D39 naming on every `removed` and `travelUnknown` entry". I did not merge 1a and 1b; the reviewable logic/presentation boundary is the reason the split exists and nothing in this round argues against it.

### Corrections made

- `docs/superpowers/specs/2026-09-05-review-response-design.md` → **revision 5**, SHA-256 `1805cfd9433b21db564d16582a700f7b2e6031219d38ff845a1c2b3156ceda50`. 14 exact-match edits, each asserted to match exactly once before application, so no unintended region changed. Twelve implement the four findings; one strikes the second surviving F01 claim found by sweep in §2's changelog row B; one updates §14's item 4.
- Decision headings remain contiguous **1-40** with no duplicates, and no `Decision N` / `DN` reference points outside that set — re-checked mechanically after the edits. **No decision was added, renumbered or withdrawn this round**; every correction is to supporting prose, the §10 migration table, or §12 criteria.
- No code, test, `PLAN.md` or `CLAUDE.md` change was made; this assignment excludes all of them.

### Verification

- `.venv/bin/pytest tests/python/ -q` → **188 passed in 1.97s**
- `node --test tests/js/*.test.js` → **184 tests, 184 pass, 0 fail**
- `git diff --check` → clean, exit 0
- `git status --short` → ` M HANDOFF.md`, ` M reviews/LEDGER.md`, untracked `.claude/`, `docs/superpowers/specs/2026-09-05-review-response-design.md`, `reviews/ARCH-004-gate.md`, `reviews/ARCH-004.md`

### Non-blocking observations acknowledged

The first two are accepted as recorded and required no change: decision headings are exactly 1-40 with every cross-reference resolving, and the six-state model, Plan A selection, naming source/fallback rule, tolerance ownership and staged-path seam are untouched by this correction delta. On the third — the untracked `.claude/` path absent from the round-1 response — the reviewer is correct that it is outside `ARCH-004`'s artifact. It is session-local scratch created after that response was written, contains no assignment artifact, and is not part of this or any assignment's reviewed diff. It is now listed in this round's `git status --short` record so the working tree is stated in full.

### Outstanding user decisions

None. All four corrections are deterministic reconciliations of the design with its own stated invariants, Decision 35's unchanged range, and Decision 36's diagnostics contract; none changes policy, scope, architecture or data. Whether to commit the untracked design, gate and review records remains the user's call and is unchanged by this round.

---

## Review round 3 — 2026-09-05

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol` — Sol, effort `medium`
- **Correction delta**: revision 4 (`92d75c8bcd370ac47205eb520a856c5812608439b5f757b85d588fd158bdc8c3`) to revision 5 (`1805cfd9433b21db564d16582a700f7b2e6031219d38ff845a1c2b3156ceda50`)
- **Scope**: `ARCH-004-R1-F01` through `F04` only. `ARCH-004-R1-F05`, the round-1-cleared foundations, implementation, transcription, lifecycle reconciliation, `ARCH-003`, commit and push were not reopened.

### Resolution of prior findings

| Finding | Status | Evidence |
| --- | --- | --- |
| `ARCH-004-R1-F01` | `resolved` | §6.4 now states the qualified boundary exactly: coherent refresh history does not produce identity + `failed`, while accepted inconsistent prior state is re-emitted as that shape; both malformed shapes remain live and must be handled (`docs/superpowers/specs/2026-09-05-review-response-design.md:565-574`). The second occurrence in §2 row B is struck and identified as a withdrawn revision-3 claim (`:48`). A full-text sweep found no live prose asserting that the state is unproducible; the remaining matches quote, reject, or explain removal of the old claim. |
| `ARCH-004-R1-F02` | `resolved` | §12 now requires two hand-built renderer inputs identical in every field except `metricsBasis`, including identical `returnTier`, and opposite qualifier assertions (`docs/superpowers/specs/2026-09-05-review-response-design.md:1035-1045`). This breaks the exact production covariance in `web/ranking.js:557-609`; a renderer deriving the qualifier from `returnTier` instead of the `metricsBasis` read at `web/app.js:173-175` must fail. |
| `ARCH-004-R1-F03` | `resolved` | Decision 35 accepts every integer in `[180, 360]`, on-step or not (`docs/superpowers/specs/2026-09-05-review-response-design.md:304-316`), while Decision 40 expressly excludes `step` from validation and requires recursive immutability of the exported contract (`:323-375`). §12 pins `181` as valid, injects a sentinel contract whose origins, modes and bounds differ from the real contract, checks rendered controls against that sentinel, and tests mutation attempts at the top level, nested bounds and supported-value array followed by unchanged ranking behavior (`:954-976`). The contract is therefore total for all controls, immutable across the consumer seam, and its consumption is non-vacuously tested. |
| `ARCH-004-R1-F04` | `resolved` | §10 step 1a now assigns D21/D22/D39 naming to every `removed` and `travelUnknown` diagnostic, while 1b retains candidate and nested Plan B naming; Decision 40 is separately identified as a static module export shipping in 1a, not a returned-shape field (`docs/superpowers/specs/2026-09-05-review-response-design.md:816-839`). §12 splits naming into independently runnable 1a diagnostic and 1b candidate/Plan B criteria (`:1023-1031`), and §13 gives slice 1a the control-contract export plus D37/D21/D39 diagnostic fields (`:1098-1103`). This matches Decision 36's required diagnostic shape and the criterion-assignment rule. |

### Findings

No new finding IDs. `ARCH-004-R1-F01` through `F04` are resolved. `ARCH-004-R1-F05` remained out of scope and was not reopened.

### Verification performed

- Read `HANDOFF.md` first, then the round-1 finding blocks, round-2 resolution table, and primary response to round 2 in this record.
- Verified the revision-5 SHA-256 exactly: `1805cfd9433b21db564d16582a700f7b2e6031219d38ff845a1c2b3156ceda50`.
- Checked the revision-5 corrections directly against Decisions 27, 32, 34, 35, 36, 38, 39 and 40; §10's two-step migration and criterion-assignment rule; §12's `invalid_request`, runtime-rendering and failed-source groups; and §13's slice table.
- Re-ran the hostile current-code probes first-hand: both malformed `resolveHours` shapes throw today, while `_merge_hours_source` re-emits operational identity plus `hours.status: "failed"` from accepted inconsistent prior state. The corrected design therefore preserves a live, non-vacuous fail-closed target.
- `.venv/bin/pytest tests/python/ -q` passed: **188 passed in 1.09s**.
- `node --test tests/js/*.test.js` passed: **184 passed, 0 failed**.
- `git diff --check` passed with no diagnostics.
- `git status --short` showed modified `HANDOFF.md` and `reviews/LEDGER.md`; untracked `.claude/`, the revision-5 design, gate record, and this review record. The primary identifies `.claude/` as session-local scratch outside the assignment artifact; it was not inspected or attributed to ARCH-004.

### Could not verify

- None. This is design validation: the prospective behavior and criteria were assessed for completeness, implementability and non-vacuity; no claim is made that the excluded implementation has been completed or live-validated.

### User decisions required

- None for this correction delta. Approval does not authorize implementation, `PLAN.md` / `CLAUDE.md` transcription, commit, push, or activation.

### Recommendation

`APPROVE`

Revision 5 closes all four scoped prior findings without reopening the settled architecture. The corrected claims are internally consistent, aligned with the present repository seams, and backed by criteria that fail when the intended rule or dependency is absent.

---
