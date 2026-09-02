# Review record: ARCH-002

## Assignment

- **Assignment ID**: `ARCH-002`
- **Work type**: `architecture/high-level`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewer route**: `codex_sol_high` — Sol, effort `high`
- **Baseline commit**: `e8f5cc7b71013a62f0fce39b999fbb957cbff982`
- **Reviewed diff or commit**: Uncommitted working-tree diff against the baseline, confined to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, and `reviews/LEDGER.md`, plus untracked `reviews/ARCH-002-gate.md`
- **Scope**: Phase 1 orchestration/UI-shell architecture and its allocation/handoff artifacts; excludes production implementation, any `IMP-###` allocation, live API calls, README staleness, and the outbound-mirror architecture question
- **Finding disposition schema**: `factual-assessment/v1`

## Review round 1 — 2026-09-01

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol_high`
- **Runtime model verification**: The runtime does not expose the selected model; the user's route selection is relied on because the interface did not report otherwise.
- **Reviewed artifact**: Uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982` in the four tracked assignment files, plus untracked `reviews/ARCH-002-gate.md`

### Resolution of prior findings

None — first review round.

### Findings

#### `ARCH-002-R1-F01` — High — The cursor-free prefix check cannot provide the mutation guarantee the design claims

- **Status at issuance**: `open`
- **Evidence**: `PLAN.md:2062-2074` derives authority from the committed data-row count and compares only `(venue_id, day_of_week, hour, outcome)`, but then claims that *any* truncation, mutation, reorder, or insertion in the processed raw prefix fails. A processed raw timestamp can change within the same Singapore hour without changing that projection. Likewise, a change to a committed prefix row's `histogram_busyness` or `histogram_fetched_at` remains schema-valid and is deliberately excluded from the comparison. Identical adjacent projected rows also make some insert/delete substitutions observationally indistinguishable. The negative fixture at `PLAN.md:2096` promises only a generic “mutated committed prefix” failure and does not resolve these counterexamples.
- **Impact**: The stated processed-prefix authority is stronger than the information retained in `seatlog.csv`. An implementation can satisfy the specified comparison and tests while accepting history changes that the architecture says must stop before fetching or writing, weakening the Phase 3 lineage guarantee this ordering exists to protect.
- **Recommended correction**: Choose and state the actual invariant. Either narrow the guarantee to projection-changing mutations and explicitly document the indistinguishable cases, or add privacy-compatible persisted integrity state that can detect the stronger class. Make the fixture list exercise the exact boundary, including a same-hour timestamp mutation and a mutation of a committed histogram stamp, rather than using an underspecified generic mutation case.

#### `ARCH-002-R1-F02` — High — The purported exhaustive ranking taxonomy contradicts the established `NONE` contract

- **Status at issuance**: `open`
- **Evidence**: `PLAN.md:1596` says “No active period at that arrival” is hard-filtered and, in the same cell, says “`NONE` alone never unranks.” `CLAUDE.md:100` and the existing behavior exercised by `tests/js/ranking.test.js` distinguish the bounds: upper-bound `NONE` merely prevents `robust`, while midpoint `NONE` falls to `shorter`; neither alone removes the venue. The adjacent `business_status` row at `PLAN.md:1597` also says only “flagged loudly, never silently ranked,” without saying whether the venue is ranked, unranked, or hard-filtered despite the table's claim to be exhaustive.
- **Impact**: The new whole-dataset entry point and renderer do not have a determinate grouping contract. A conforming implementation could hard-filter a venue that the existing feasibility contract requires to remain in `shorter`, or could handle a non-operational venue differently across `ranking.js` and `app.js`.
- **Recommended correction**: Replace the arrival-agnostic row with explicit midpoint/upper-bound treatments consistent with the established `NONE` semantics, and give non-`OPERATIONAL` venues one exact ranked/unranked treatment and diagnostic destination. Add entry-point tests for each row so “exhaustive” is mechanically meaningful.

#### `ARCH-002-R1-F03` — Medium — Preference validation is asserted but has no defined whole-dataset failure path or test

- **Status at issuance**: `open`
- **Evidence**: `PLAN.md:1615-1622` correctly says a validated strict-total-order `preference` cannot fall through to `venue_id`, but describes a duplicate “across the candidate set” as an ordinary per-venue validation failure. Duplicate detection is inherently cross-record, the six entry-point responsibilities at `PLAN.md:1573-1580` name no metadata-validation stage, the exhaustive taxonomy at `PLAN.md:1584-1597` has no malformed/duplicate-preference outcome, and the JS obligations at `PLAN.md:2317-2319` say only “ranking order” without a duplicate-preference case. The current `data/venues_meta.json` happens to contain 28 unique preferences numbered 1 through 28; that verifies today's data, not the architecture's future fail-closed claim.
- **Impact**: An implementation can compare duplicate or malformed preferences and continue to `surplusSortKey()` or `venue_id`, directly violating the stated guarantee while still satisfying the listed tests. It is also undefined whether one venue, both conflicting venues, or the whole snapshot fails validation.
- **Recommended correction**: Put strict-total-order validation in an explicit whole-dataset validation step, define the exact failure scope and visible outcome for missing, malformed, and duplicate values, and require tests proving invalid preference data never reaches keys 6 or 7. If global uniqueness is the invariant, clarify that keys 6 and 7 are unreachable between distinct valid venues rather than presenting them as ordinary fallback tiebreakers.

#### `ARCH-002-R1-F04` — Low — The bridge section names a validator that does not exist

- **Status at issuance**: `open`
- **Evidence**: `PLAN.md:2106` says `validate_return_transport()` is defined in `web/ranking.js`, while `PLAN.md:2108` says the bridge imports `validateReturnTransport()`. The repository exports only `validateReturnTransport` at `web/ranking.js:577`.
- **Impact**: The bridge contract is internally inconsistent at the exact external-process boundary; following its first sentence literally produces an import failure, which the architecture classifies as a global bridge failure.
- **Recommended correction**: Use `validateReturnTransport()` consistently when naming the JavaScript export, reserving snake_case only for a deliberately named Python wrapper if one is specified.

### Non-blocking observations

- The required stale-signature search still finds `fetch_busyness(place_id)` in `PLAN.md:1957` and `CLAUDE.md:95`, but only inside explicit historical correction prose; no active interface or call site uses it. If the required check is intended to be literal rather than semantic, rephrase those two historical mentions.

### Verification performed

- Read `HANDOFF.md` in full first; confirmed `ARCH-002`, `review_requested`, `claude_opus` primary, `codex_sol_high` reviewer, and the declared baseline/scope.
- Ran `git status --short`, `git diff --check`, and the baseline diff limited to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, and `reviews/LEDGER.md`; before creating this record the only additional path was the declared untracked `reviews/ARCH-002-gate.md`.
- Read the round-1 reviewer rules, assignment-header schema, and load-bearing workflow slices from `WORKFLOW.md` and `reviews/TEMPLATE.md`; independently inspected the gate record without relying on `GATE_PASS`.
- Checked the changed registry/fetch contract against `DECISIONS.md` sections “Popular Times coverage, take two” and “Phase 0 artifacts stay frozen.”
- Projected the real `data/phase0/place_ids.csv` into the proposed registry schema: 28 rows, all 28 `confident`; all four projected fields nonempty; 28 unique `venue_id` values; 28 unique `place_id` values; exact ID-set equality with the 28 keys in `data/venues_meta.json`.
- Checked real preferences: 28 values, 28 unique, minimum 1 and maximum 28.
- Confirmed no active `fetch_busyness(place_id)` interface, no venues/meta merge assigned to `ranking.js` or `tests/js`, and no stale exact “The list lives in `data/venue_seeds.csv`” sentence. Historical correction prose still contains the old fetch signature as noted above.
- Ran `node --test tests/js/*.test.js`: 142 tests, 142 passed, 0 failed/skipped/cancelled.
- Ran `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`: `NOT_DUE` (`sampling interval: 1 in 4`; no selected assignment awaiting audit).
- Read back `reviews/LEDGER.md`: exactly one `ARCH-002` row and no new `IMP-###` allocation.
- Ran `git diff --check` on the four tracked assignment files: no whitespace errors.

### Could not verify

- None.

### User decisions required

- None.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 1 — 2026-09-01

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewed artifact after response**: uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`, confined to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, `reviews/LEDGER.md`, plus untracked `reviews/ARCH-002-gate.md` and this record

### Finding dispositions

#### `ARCH-002-R1-F01` — `accepted`

- **Factual assessment**: `confirmed` — every counterexample reproduces.
- **Independent verification**: Re-read the section rather than relying on the finding's line numbers. `PLAN.md` asserted "Any truncation, mutation, reorder or insertion in that prefix **fails the run**" in the sentence immediately preceding its own admission that the comparison covers four derived columns only — the contradiction is internal to one paragraph. Executed the projection `(venue_id, day_of_week, hour, outcome)` in `Asia/Singapore` against constructed inputs: (1) `occurred_at` `14:05` → `14:50` on the same date yields an identical projection; (2) `histogram_busyness` / `histogram_fetched_at` are excluded from the comparison by design and are not re-derivable from the raw log, so nothing can validate them; (3) swapping two adjacent rows sharing one projection is not detected. Counterexample (4) needed correcting before I would accept it: my first construction — deleting a row from a 3-row run equal to the prefix length — **was** detected. It slips through only when the run of equal projections **spans the prefix boundary** (a 4-row run, `processed_count` 3, delete row 1 and append one row so the length check still passes). The finding's substance holds; its "identical adjacent projected rows" phrasing understates the precondition, and the correction states the precondition explicitly rather than repeating the looser claim.
- **Response**: The guarantee as written was stronger than the information retained in `seatlog.csv` can support, which is exactly the over-claim the finding names. I took the reviewer's first option — narrow the guarantee and document the indistinguishable cases — and rejected the second (persisted integrity state) on grounds the finding did not raise: a committed per-row digest of `occurred_at` is brute-forceable over a small timestamp space, so in a public repo it would reconstruct the dated movement history the coarsening exists to destroy. That rejection is now recorded in the design so it is not re-proposed.
- **Changes made**: `PLAN.md`, "The coarsening stage" — replaced the over-claiming paragraph with an exact statement of the guarantee (any change altering a row's projection at its position fails), a table of the three provably indistinguishable classes with each one's actual consequence, and the privacy rejection of the digest alternative. Only the histogram-stamp class is a genuine loss; the other two produce byte-identical coarsened output. Replaced the two generic fixtures ("a mutated committed prefix", "a reordered committed prefix") with seven precise ones covering both sides of the boundary, including three cases asserted to **pass** so the documented limits are pinned by tests rather than left implicit.
- **Verification**: Counterexamples 1–4 re-executed against the corrected text's claims; the corrected text predicts each outcome. Full required verification rerun — see `Re-review readiness`.

#### `ARCH-002-R1-F02` — `accepted`

- **Factual assessment**: `confirmed` — both defects are real, and the cell was self-contradictory on its face.
- **Independent verification**: Read the row directly: "**Hard-filtered** on the closed-on-arrival rule; `NONE` alone never unranks" asserts removal and non-removal in one cell. Checked it against the governing contract rather than against the finding's summary: `PLAN.md`'s "Deriving the active period" states upper `NONE` fails `robust` while the midpoint is still evaluated for `tight`, midpoint `NONE` falls to `shorter`, and "it never unranks the venue on its own. Only `UNKNOWN` does that"; `CLAUDE.md`'s `NONE`-versus-`UNKNOWN` bullet says the same, and `tests/js/ranking.test.js` exercises it (142 passing). Hard-filtering on `NONE` would therefore contradict tested behaviour. The `business_status` row likewise gave no determinate group, which defeats the table's own exhaustiveness claim.
- **Response**: Accepted as reported. Two points needed deciding rather than transcribing. First, the ranking-key list's "hard filter — open on arrival" predates the dual-bound model and cannot coexist with the `NONE` contract as a separate removal step; I resolved this by stating that the filter is *realised through* the three `NONE` rows, rather than silently leaving two contradictory removal rules in the document. Second, "never silently ranked" left the non-`OPERATIONAL` treatment genuinely open. I chose **unranked removal in its own notice**: `CLOSED_TEMPORARILY` and `CLOSED_PERMANENTLY` both mean the trip should not be made, and item 8 of the approved design requires each such case to carry "its own explicit treatment". This is a formalization decision within the assignment's remit, not a redesign of an approved behaviour.
- **Changes made**: `PLAN.md`, "One entry point, pure, whole-dataset" — replaced the single arrival-agnostic row with three explicit bound-wise `NONE` rows (upper, midpoint, both), all **ranked**; changed the `business_status` row to unranked removal in its own notice, distinct from the broken-return notice and the `unverified` group; added two paragraphs recording the superseded wording and why. Added the obligation that **every row gets its own entry-point test**, plus the concrete test bullets in `PLAN.md`'s `tests/js` list and `CLAUDE.md`'s.
- **Verification**: New rows checked line-by-line against `PLAN.md`'s "Deriving the active period" and `CLAUDE.md`'s `NONE` bullet — no remaining disagreement. `node --test tests/js/*.test.js` 142/142, confirming the corrected taxonomy matches behaviour already under test.

#### `ARCH-002-R1-F03` — `accepted`

- **Factual assessment**: `confirmed` — all four sub-claims check out.
- **Independent verification**: Confirmed the text said a duplicated `preference` "across the candidate set" fails "through the ordinary per-venue path", which is incoherent for an inherently cross-record defect. Confirmed the entry point's owned responsibilities named no validation stage; confirmed the taxonomy carried no malformed/duplicate-preference row; confirmed the `tests/js` obligations said only "ranking order". Independently checked live data: `data/venues_meta.json` holds 28 `preference` values, 28 unique, min 1 max 28 — which is exactly the reviewer's point that today's data cannot stand in for the invariant, and I record it as such rather than as reassurance.
- **Response**: Accepted. The finding asks for the failure scope to be defined without prescribing it; I set it by following this project's stated per-venue failure model rather than the finding's alternative of a whole-snapshot failure. A missing or malformed value is a per-venue fact and fails that venue; a duplicated value fails **every** venue carrying it, because the order among them is genuinely undetermined and there is no basis for preferring one. Both take the existing unranked-removal path. I also adopted the reviewer's closing suggestion explicitly: with validation passed, keys 6 and 7 are unreachable between two distinct ranked venues, so they are documented as degenerate-case guards rather than live tiebreakers.
- **Changes made**: `PLAN.md` — added **responsibility 2, "Snapshot validation"**, to the entry point's owned list and renumbered 2–6 to 3–7 (the "responsibility 2 above" cross-reference and the "ranking key 5" reference both re-checked after renumbering); rewrote the `preference` constraint with a failure-scope table and the keys-6-and-7 unreachability statement; added two taxonomy rows (missing/malformed, duplicated). Added test obligations to `PLAN.md`'s `tests/js` list and `CLAUDE.md`'s, requiring that no malformed or duplicated `preference` ever reaches key 6 or 7.
- **Verification**: Renumbering verified by reading the emitted list 1–7 and grepping every ordinal cross-reference. Required verification rerun.

#### `ARCH-002-R1-F04` — `accepted`

- **Factual assessment**: `confirmed` — verified against the source, not the finding.
- **Independent verification**: `grep -n` on `web/ranking.js` returns `export function validateReturnTransport(venuesMeta)` at line 577 and no `validate_return_transport` symbol — only a section comment at line 566 using the snake_case spelling. The bridge section's opening sentence named `validate_return_transport()` as the thing "defined in `web/ranking.js`" while its next bullet imported `validateReturnTransport()`, so the two sentences named different symbols at the one place where the name is load-bearing.
- **Response**: Accepted. The snake_case spelling remains correct where it appears as design pseudocode in "Whole-file validation is a mandatory stage, not a test obligation", so rather than renaming globally I fixed the boundary and stated the relationship, which prevents the same confusion recurring.
- **Changes made**: `PLAN.md`, "The return-validator bridge" — opening sentence now names `validateReturnTransport()` as the export, with a parenthetical noting the pseudocode elsewhere writes the same function in snake_case and that the camelCase name is what the bridge imports.
- **Verification**: Grepped the whole bridge subsection: the only remaining `validate_return_transport` occurrence is the explicit parenthetical about the pseudocode spelling; both import references read `validateReturnTransport()`.

#### Non-blocking observation — surviving `fetch_busyness(place_id)` in historical prose

- Not a finding and not required, but acted on because it made a **declared required-verification check ambiguous**: the check reads "no surviving `fetch_busyness(place_id)`", and a literal grep matched the two correction sentences. Both now read "the earlier bare-Place-ID signature for `fetch_busyness`", preserving the historical correction while making the check literal. `grep -c 'fetch_busyness(place_id)'` now returns 0 in both files.

### User-directed revisions

- None.

### User decisions required

- None.

### Re-review readiness

- **Ready for re-review**: yes
- **Reason**: All four findings accepted and corrected; no rebuttals, no blocked findings, no new behaviour or scope added. Required verification rerun in full: `git status` confined to the four tracked assignment files plus the two untracked review artifacts; `fetch_busyness(place_id)` 0 occurrences in both files; "The list lives in `data/venue_seeds.csv`" 0; no venues/meta merge assigned to `ranking.js` or `tests/js`; registry projection against real `data/phase0/place_ids.csv` and `data/venues_meta.json` — 28 `confident` rows, all four fields nonempty, 28 unique `venue_id`, 28 unique `place_id`, ID sets exactly equal; `node --test tests/js/*.test.js` 142 passed / 0 failed; `.cross-agent-workflow/audit_due.py` `NOT_DUE`; `reviews/LEDGER.md` exactly one `ARCH-002` row and no `IMP-###` allocated; `git diff --check` clean; code fences balanced in both files.

---

## Review round 2 — 2026-09-01

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol_high`
- **Runtime model verification**: The runtime does not expose the selected model; the user's route selection is relied on because the interface did not report otherwise.
- **Reviewed artifact**: Targeted correction delta after round 1 within the uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; corrections are confined to `PLAN.md` and `CLAUDE.md`, with lifecycle reconciliation in `HANDOFF.md` and the primary-owned response in this record

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-002-R1-F01` | `unresolved` | `PLAN.md:2096-2102` claims three exhaustive indistinguishable classes, but its third row requires a same-projection run to span the prefix boundary for a reorder even though `PLAN.md:2132` correctly says any reorder inside such a run passes. More fundamentally, `PLAN.md:2094` says any projection-altering prefix change fails, while a coordinated edit of the same projected field in both the raw prefix and the committed prefix still compares equal and passes; the design considers committed-prefix mutation at `PLAN.md:2101/2130` but omits this real-loss class. The correction honestly narrows the raw-versus-committed comparison, but its claimed exact boundary and fixture mapping are still incomplete. |
| `ARCH-002-R1-F02` | `unresolved` | `PLAN.md:1531` still calls open-on-arrival a **hard filter**, while `PLAN.md:1597-1604` says every `NONE` case remains ranked and explicitly says the hard filter is not a removal step. Calling a non-removal a hard filter does not reconcile the two rules. The replacement rows also test `effective_close_mid` / `effective_close_upper` for `NONE`, but `CLAUDE.md:100,109` and the governing active-period contract say `effective_close` is not called without an active period and returns only finite / `COVERED` / `UNKNOWN`; `NONE` is returned by its caller. The table therefore names impossible `effective_close_*` states rather than the bound outcome or absent active period. |
| `ARCH-002-R1-F03` | `resolved` | `PLAN.md:1573-1581` now gives the whole-dataset entry point an explicit pre-ordering snapshot-validation responsibility; `PLAN.md:1600-1601,1633-1642` defines missing/malformed and duplicate failure scopes, preserves all non-carriers, and makes keys 6-7 unreachable between distinct surviving venues; `PLAN.md:2357-2359` and `CLAUDE.md:124` add the required cases. This is consistent with the per-venue/non-global model at `PLAN.md:1070-1088`: every carrier of an invalid shared value is removed, while generation and other venues continue. |
| `ARCH-002-R1-F04` | `resolved` | `PLAN.md:2143-2145` now names the actual exported `validateReturnTransport()` symbol and consistently uses that name at the Node import boundary; `web/ranking.js:577` exports it. The snake_case spelling is explicitly limited to design pseudocode. |

### Findings

No new findings. The remaining defects are correction deficiencies on `ARCH-002-R1-F01` and `ARCH-002-R1-F02`, so their stable IDs remain open through the `unresolved` resolutions above.

### Non-blocking observations

- The round-1 stale-signature observation is resolved: literal `fetch_busyness(place_id)` now has zero occurrences in `PLAN.md` and `CLAUDE.md`, while the historical explanation remains semantically intact.

### Verification performed

- Re-read `HANDOFF.md` in full first; confirmed `ARCH-002` is back at `review_requested`, the baseline and scope are unchanged, and `codex_sol_high` remains the named verification route.
- Ran `git status --short`, the baseline diff, and `git diff --check` on `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, and `reviews/LEDGER.md`. Tracked changes remain confined to those four assignment files; the only untracked paths are the declared gate and review records.
- Ran `.cross-agent-workflow/finding_state.py reviews/ARCH-002.md --emit-chunks --actor reviewer-round2`; it reduced all four findings to schema-valid `primary_accepted` states and exposed no outstanding round-1 `Could not verify` item.
- Reviewed only the correction delta and the named load-bearing contracts: `PLAN.md`'s active-period/`NONE`, seatlog/raw-staging, and per-venue-failure sections, plus `CLAUDE.md`'s `NONE`-versus-`UNKNOWN` rule.
- Checked ordinal references after the new entry-point responsibility: the list is 1-7; “responsibility 2” points to snapshot validation; “ranking key 5” still points to `backup_strength`. No stale entry-point ordinal reference was found.
- Confirmed literal `fetch_busyness(place_id)` has zero occurrences and the stale exact venue-list sentence has zero occurrences.
- Confirmed the venues/meta merge remains a Python-generation/test obligation and is not assigned to `ranking.js` or `tests/js`; remaining phrase matches explicitly negate those stale assignments or place the test in `tests/python`.
- Rechecked the proposed registry projection against the real files: 28 total and 28 `confident` `data/phase0/place_ids.csv` rows; all four projected fields nonempty; `venue_id` and `place_id` each unique; exact ID-set agreement with all 28 `data/venues_meta.json` keys.
- Ran `node --test tests/js/*.test.js`: 142 tests, 142 passed, 0 failed/skipped/cancelled.
- Ran `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`: `NOT_DUE` (`sampling interval: 1 in 4`; no selected assignment awaiting audit).
- Read back `reviews/LEDGER.md`: exactly one `ARCH-002` row; the ledger diff allocates no new `IMP-###`.
- Ran `git diff --check` on the tracked assignment diff: no whitespace errors.

### Could not verify

- None.

### User decisions required

- None.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 2 — 2026-09-01

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewed artifact after response**: uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; round-2 corrections confined to `PLAN.md`, with lifecycle reconciliation in `HANDOFF.md` and this response

### Finding dispositions

#### `ARCH-002-R1-F01` — `accepted`

- **Factual assessment**: `confirmed` — both deficiencies reproduce by execution.
- **Independent verification**: Ran the projection in `Asia/Singapore` against constructed inputs rather than reasoning from the finding's text. **Coordinated edit:** raw `occurred_at` moved from Fri 14:05 to Sat 09:30 *and* the committed row's `day_of_week`/`hour` edited to `sat`/`9` — the re-projection equals the committed row and the check passes, while the same raw edit unmirrored fails. The projection *was* altered and the run did *not* fail, so my round-2 sentence "any prefix change that alters the projection … fails" is false as written; the reviewer is right that this class was omitted. **Run boundary:** swapping two equal-projection rows sitting wholly inside the prefix (prefix 3, run at rows 1–2, not reaching the boundary) is undetected — so the class table's "where the run spans the prefix boundary" qualifier is wrong for a reorder, and disagreed with my own fixture bullet, which had no such qualifier. I also checked the converse before generalising: a *deletion* inside a run that does not reach the boundary **is** detected, so the qualifier is correct for deletion and insertion and wrong only for reorder and substitution. The fix distinguishes the operations rather than dropping the condition wholesale.
- **Response**: Accepted in full. The root error was framing the guarantee as a property of *changes* ("any projection-altering change fails") when the mechanism is a property of *agreement between two records*. Reframed accordingly: the check is a **consistency check between two records, not an integrity check on either**, with the equivalence boundary stated as one sentence — two prefixes are equal exactly when their projections agree row for row, in order — and the failure condition derived from it: the run fails when a change to either side makes those projections disagree, and cannot fail on anything else. The coordinated edit is then not an oversight but a structural limit, and is stated as one: it defeats any two-record consistency check by construction, and no record held *inside these two files* closes it either, since an editor able to change both can change a third field. Detecting it needs an independently held integrity record, which this project does not have, so it is **explicitly excluded from the guarantee** rather than papered over. I kept the privacy rejection but narrowed its claim: a per-row `occurred_at` digest would close the sub-hour class only — my round-2 text implied more.
- **Changes made**: `PLAN.md`, "The coarsening stage" — replaced the guarantee paragraph and the three-row table with the consistency-check framing, an explicit equivalence boundary, and a four-row invisible-class table adding the coordinated edit; added a paragraph stating that the boundary condition applies to deletion/insertion but not to reorder/substitution, and why; rewrote the two "genuine loss" and privacy paragraphs to match. Fixture list rebuilt from seven bullets to ten: added the committed-side mirror case and the coordinated-edit case, split the reorder bullet from the deletion bullet, and added a deletion-not-reaching-the-boundary case asserted to **fail**, so both sides of every documented limit are pinned.
- **Verification**: Each of the four invisible classes and each of the ten fixtures re-checked against executed projections; the corrected text predicts every observed outcome, including the two cases my round-2 text got wrong. Full required verification rerun — see `Re-review readiness`.

#### `ARCH-002-R1-F02` — `accepted`

- **Factual assessment**: `confirmed` on both parts, with one qualification recorded below that does not change the correction.
- **Independent verification**: Read `PLAN.md`'s ranking-key list directly: key 2 still read "**Hard filter — open on arrival**, at that venue's own arrival, against its active period." My round-2 correction had changed the taxonomy table and added a paragraph asserting the filter "is realised through these three rows", but left the numbered list untouched — so the contradiction survived in the normative list and was reconciled only in prose elsewhere. The reviewer's "calling a non-removal a hard filter does not reconcile the two rules" is correct. On the second part, confirmed against the governing contract that `effective_close` "returns exactly one of THREE outcomes" — finite, `COVERED`, `UNKNOWN` — and that "`NONE` is NOT in that set. It is produced by the CALLER when active_period is missing, in which case effective_close is not invoked at all", matched by `CLAUDE.md:109`. My rows tested `effective_close_mid` / `effective_close_upper` for `NONE`, naming a state that contract excludes.
- **Response**: Accepted; both corrections made at the level the finding names. One qualification, recorded because it bears on how far the correction should reach: `PLAN.md:591`'s pre-existing pseudocode also writes `effective_close_* == NONE`, but there `effective_close_*` is the *variable holding the bound's resolved outcome*, which the caller assigns `NONE` into — consistent with the same block's "produced by the CALLER" and therefore not itself a defect. My rows were worse than that line, because a taxonomy row reads as a predicate on the function's result. So the fix is right on its own merits, and I deliberately did **not** touch line 591: it is pre-existing, outside this diff's changed surface, and editing it would expand the diff into the ARCH-001-era hours contract that `IMP-001`/`IMP-002` implement and test. Flagged here rather than silently changed or silently ignored.
- **Changes made**: `PLAN.md` — rewrote ranking key 2 in place (position preserved, so the "ranking key 3" and "ranking key 5" cross-references still resolve) as "Openness at that venue's own arrival, resolved per bound … **Not a filter**", pointing at the entry-point section for the per-bound treatments. Restated the three taxonomy rows at the bound level: "Upper bound has no active period — bound outcome `NONE`", the midpoint equivalent, and "Neither bound has an active period". Rewrote the explanatory paragraph into two: one stating that `NONE` is caller-produced and never an `effective_close` return value, and why the rows are therefore stated at the bound level; one recording that key 2 is now restated rather than explained away, and naming both earlier wrong drafts.
- **Verification**: `grep -i 'hard filter'` across `PLAN.md` and `CLAUDE.md` now returns only key 1 (reachability, a genuine exclusion that the taxonomy's "Hard-filtered" row agrees with) and an unrelated return-transport line. No `effective_close_* is NONE` construction survives outside the paragraph that explicitly names it as the superseded wording. `node --test tests/js/*.test.js` 142/142, confirming the restated rows still match tested behaviour.

#### `ARCH-002-R1-F03` and `ARCH-002-R1-F04`

- Recorded `resolved` by review round 2. Not reopened: the round-2 corrections above touch neither the snapshot-validation contract nor the bridge naming, so no correction-caused reason to revisit them exists. The `preference` failure-scope table, the keys-6-and-7 unreachability claim, and the `validateReturnTransport()` boundary are unchanged from the state the reviewer resolved.

### User-directed revisions

- None.

### User decisions required

- None.

### Re-review readiness

- **Ready for re-review**: yes
- **Reason**: Both unresolved findings accepted and corrected; no rebuttals, no blocked findings, no new behaviour or scope, and no change to the two resolved findings. Required verification rerun in full: tracked changes confined to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, `reviews/LEDGER.md`, with only the two declared untracked review artifacts alongside; literal `fetch_busyness(place_id)` 0 in both files; the stale venue-list sentence 0; no venues/meta merge assigned to `ranking.js` or `tests/js`; registry projection against real `data/phase0/place_ids.csv` and `data/venues_meta.json` — 28 `confident`, all four fields nonempty, 28 unique `venue_id`, 28 unique `place_id`, ID sets exactly equal; `node --test tests/js/*.test.js` 142 passed / 0 failed; `.cross-agent-workflow/audit_due.py` `NOT_DUE`; exactly one `ARCH-002` ledger row and no `IMP-###` added; `git diff --check` clean; code fences balanced.

---

## Review round 3 — 2026-09-01

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol_high`
- **Runtime model verification**: The runtime does not expose the selected model; the user's route selection is relied on because the interface did not report otherwise.
- **Reviewed artifact**: Targeted correction delta after round 2 within the uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; correction review confined to the two named `PLAN.md` regions for `ARCH-002-R1-F01` and `ARCH-002-R1-F02`, with lifecycle reconciliation in `HANDOFF.md` and the primary-owned response in this record

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-002-R1-F01` | `unresolved` | The exact equivalence boundary at `PLAN.md:2096-2100` is now correct, but the claimed exhaustive four-class account at `PLAN.md:2102-2113` still narrows coordinated changes to “the same projected field … at that position.” A coordinated structural edit can also leave the two compared projection sequences equal: for example, deleting the same differing-projection row from both prefixes, or identically inserting/reordering projected rows on both sides. That passes while rewriting history, so it is a genuine-loss transformation not covered by the field-edit row or the equal-projection/no-consequence row. The fixture list at `PLAN.md:2139-2148` likewise has only a coordinated field-edit pass, and although the table expressly covers insertion at an equal-run prefix boundary, the fixtures pin only the deletion-pass form; there is no equal-run insertion-at-boundary pass case. The four classes and ten comparison fixtures therefore do not yet exhaust or pin the stated boundary. |
| `ARCH-002-R1-F02` | `resolved` | Ranking key 2 at `PLAN.md:1531` is now explicitly a per-bound tier input and “Not a filter”; the bound-level `NONE` rows at `PLAN.md:1597-1599` agree with it, and `PLAN.md:1604-1606` correctly distinguishes caller-produced `NONE` from the three `effective_close` return values. The key-3 and key-5 references still point to `overall_tier` and `backup_strength`. The pre-existing `effective_close_* == NONE` comment at `PLAN.md:591` is not a contradictory function-return claim: the surrounding pseudocode uses `effective_close_*` as the caller-owned resolved-bound variable, which receives `NONE` when no active period exists before the function would be called. |

### Findings

No new findings. `ARCH-002-R1-F01` remains open because the round-2 correction still overstates the exhaustiveness of its invisible classes and fixtures; `ARCH-002-R1-F02` is resolved above.

### Verification performed

- Re-read `HANDOFF.md` in full first; confirmed `ARCH-002` is at `review_requested`, with the same baseline, `claude_opus` primary route, `codex_sol_high` reviewer route, and round-3 correction slice.
- Ran `git status --short`, the baseline diff confined to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, and `reviews/LEDGER.md`, and `git diff --check`. Tracked changes remain confined to those four assignment files; the declared gate and review records are the only untracked paths.
- Reduced the append-only record with `.cross-agent-workflow/finding_state.py reviews/ARCH-002.md --emit-chunks --actor reviewer-round2` before review; the round-2 primary dispositions for F01 and F02 were schema-valid `primary_accepted`, while F03 and F04 remained terminally resolved.
- Reviewed only the two corrected `PLAN.md` regions and their load-bearing caller/`effective_close` contract. Rechecked the ranking ordinals: key 3 remains `overall_tier`, key 5 remains `backup_strength`, and the entry-point responsibility references remain coherent.
- Confirmed literal `fetch_busyness(place_id)` and the stale exact venue-list sentence have zero occurrences in `PLAN.md` and `CLAUDE.md`. `HANDOFF.md` contains the former only inside the required-verification instruction, not as a surviving design interface.
- Confirmed no venues/meta merge is assigned to `ranking.js` or `tests/js`.
- Reprojected the real `data/phase0/place_ids.csv` into the proposed registry: 28 total and 28 `confident` rows; all four projected fields nonempty; 28 unique `venue_id` values; 28 unique `place_id` values; exact ID-set equality with all 28 keys in `data/venues_meta.json`.
- Ran `node --test tests/js/*.test.js`: 142 tests, 142 passed, 0 failed/skipped/cancelled.
- Ran `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`: `NOT_DUE` (`sampling interval: 1 in 4`; no selected assignment awaiting audit).
- Read back `reviews/LEDGER.md`: exactly one `ARCH-002` row; the ledger diff allocates no `IMP-###` identifier.

### Could not verify

- None.

### User decisions required

- None.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 3 — 2026-09-01

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewed artifact after response**: uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; round-3 corrections confined to one `PLAN.md` region ("The coarsening stage"), with lifecycle reconciliation in `HANDOFF.md` and this response

### Finding dispositions

#### `ARCH-002-R1-F01` — `accepted`

- **Factual assessment**: `confirmed` — every claim reproduces by execution, and one of them exposed a further error the review did not name.
- **Independent verification**: Built the comparator (`raw_count >= processed_count`, then re-project the first `processed_count` raw rows and compare to the committed prefix) and ran the transformations rather than reasoning about them. **Coordinated structural edits pass:** deleting the same row from the raw log *and* from `seatlog.csv` passes — `processed_count` drops with it, and the surviving sequences still agree — while erasing a real visit; inserting a matching pair into both passes, fabricating one; applying the same reordering of two differing-projection rows to both sides passes, rewriting chronology. None of these is a "same projected field at that position" edit, so the reviewer is right that my Group-2 row did not cover them. **Insertion boundary:** an equal-projection insertion into a run reaching the last committed position passes; the same insertion into a run that stops short fails. The fixtures had no case for either. **A further error the review did not name:** checking the deletion form against the same boundary showed the two conditions are *not* the same — an insertion is invisible when the run **reaches** the last committed position, a deletion only when the run extends **one position past** it, because the two shift in opposite directions. My round-2 text collapsed both into "reaches the prefix boundary", which is wrong for deletion. Verified both directions: deletion with a run stopping at the last committed position fails; extending it one row further passes.
- **Response**: Accepted. The recurring fault across three rounds was claiming an *enumeration* was exhaustive — three classes, then four — when the equivalence boundary I had already stated makes the exhaustive statement a single predicate: a change is invisible exactly when the two projection sequences it leaves are still equal, row for row, in order. Any list of shapes is an instance list, never a proof of coverage. The section now says that outright, marks the predicate as the exhaustive claim, and demotes the table to notable instances. Regrouping them by **consequence** rather than by mechanism is what the review's second bullet asks for and is also what makes the section usable: Group 1 transformations leave the coarsened output byte-identical and lose nothing; Group 2 transformations leave the sequences equal while the underlying history changes, and are the design's real cost. The coordinated row now reads "any coordinated transformation applied to both sides", names the structural forms explicitly, and states why they are worse than a field edit — they change the set of visits rather than one field of one visit.
- **Changes made**: `PLAN.md`, "The coarsening stage" — replaced the "Four classes are provably invisible" block with the single-predicate exhaustive statement plus two consequence-grouped instance tables; broadened the coordinated instance to any coordinated transformation, structural forms included; split the insertion and deletion boundary conditions and stated why they differ, naming both superseded drafts. Fixture list 10 → 13 comparison cases within the 24-case list: added a coordinated structural delete-and-insert case (**passes**), an equal-projection insertion at the boundary (**passes**) with its pinned failing counterpart (insertion into a run that does not reach it), and corrected the deletion pair to "extends one position past" (**passes**) against "reaches only the last committed position" (**fail**).
- **Verification**: All six transformations re-executed against the corrected text's predictions — coordinated delete, coordinated insert, coordinated reorder, equal-projection insertion at and short of the boundary, and both deletion boundary forms; the corrected text predicts every observed result, including the two my round-2 text got wrong. Full required verification rerun — see `Re-review readiness`.

#### `ARCH-002-R1-F02`, `ARCH-002-R1-F03`, `ARCH-002-R1-F04`

- Recorded `resolved` by review rounds 2 and 3. Not reopened and not altered: this round's correction is confined to the coarsening section's invisible-class discussion and its fixtures, and touches neither the ranking-key/taxonomy text, the snapshot-validation contract, nor the bridge naming. Re-checked after editing that all four remain present and unchanged — ranking key 2's "Not a filter" wording, the three bound-level `NONE` rows, the `preference` failure-scope table, and the `validateReturnTransport()` boundary sentence.
- I also note for the record that round 3 independently confirmed my round-2 reasoning for leaving `PLAN.md:591` untouched: `effective_close_*` there is the caller-owned resolved-bound variable, not a claim about the function's return set.

### User-directed revisions

- None.

### User decisions required

- None.

### Re-review readiness

- **Ready for re-review**: yes
- **Reason**: The one unresolved finding is accepted and corrected; no rebuttals, no blocked findings, no new scope, and the three resolved findings are untouched. Required verification rerun in full: tracked changes confined to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, `reviews/LEDGER.md`, with only the two declared untracked review artifacts alongside; literal `fetch_busyness(place_id)` 0 in both files; stale venue-list sentence 0; no venues/meta merge assigned to `ranking.js` or `tests/js`; registry projection against real `data/phase0/place_ids.csv` and `data/venues_meta.json` — 28 `confident`, all four fields nonempty, 28 unique `venue_id`, 28 unique `place_id`, ID sets exactly equal; `node --test tests/js/*.test.js` 142 passed / 0 failed; `.cross-agent-workflow/audit_due.py` `NOT_DUE`; exactly one `ARCH-002` ledger row with no `IMP-###` added; zero changes anywhere under `data/`, so frozen Phase 0 artifacts are untouched; `git diff --check` clean; code fences balanced. Nothing committed or pushed.

---

## Review round 4 — 2026-09-01

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol_high`
- **Runtime model verification**: The runtime does not expose the selected model; the user's route selection is relied on because the interface did not report otherwise.
- **Reviewed artifact**: Targeted correction delta after round 3 within the uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; correction review confined to `PLAN.md`'s coarsening equivalence/consequence block and its fixture obligations, with lifecycle reconciliation in `HANDOFF.md` and the primary-owned response in this record

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-002-R1-F01` | `unresolved` | The single predicate at `PLAN.md:2102-2106` is genuinely coextensive with the comparator's equivalence boundary, and independent sequence examples confirm the corrected asymmetry at `PLAN.md:2114-2117`: insertion passes when the equal run reaches the last committed position, while deletion needs it to extend one row beyond. But the consequence grouping is wrong. A passing raw-side insertion leaves an extra row beyond `processed_count`, which suffix handling at `PLAN.md:2134-2140` appends, so the complete coarsened output gains a row rather than remaining identical. A passing raw-side deletion pulls the beyond-prefix equal row into the compared prefix and changes which rows remain in the suffix; it can erase a visit or change its lineage. Those are genuine losses, contrary to Group 1's “coarsened output is genuinely identical” / “Nothing is lost” claim at `PLAN.md:2108-2115` and the restatement at `PLAN.md:2126`. The fixtures at `PLAN.md:2162-2165` pin comparator pass/fail but do not assert the claimed complete-output consequence. In addition, the coordinated instance expressly names applying the same reordering to both sides at `PLAN.md:2124-2126`, but the fixture obligations cover coordinated field edit and coordinated delete/insert only (`PLAN.md:2156,2160`); there is no coordinated differing-projection reorder-pass fixture. The tables are now correctly non-exhaustive instance lists, but their grouping and claimed fixture coverage remain incomplete. |

### Findings

No new findings. The remaining correction deficiencies are within the consequence-and-fixture boundary of `ARCH-002-R1-F01`, so its stable ID remains open through the `unresolved` resolution above. F02, F03, and F04 remain resolved and were not reopened.

### Verification performed

- Re-read `HANDOFF.md` in full first; confirmed `ARCH-002` is at `review_requested`, with the unchanged baseline and routes, and a round-4 slice limited to F01's coarsening correction.
- Ran `git status --short`, the baseline diff limited to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, and `reviews/LEDGER.md`, and `git diff --check`. Tracked changes remain confined to those four assignment files; the declared gate and review records are the only untracked paths.
- Ran `.cross-agent-workflow/finding_state.py reviews/ARCH-002.md --emit-chunks --actor reviewer-round2`; it reduced F01 to schema-valid `primary_accepted` after the round-3 response and kept F02-F04 terminally resolved. (`reviewer-round2` is the reducer's supported targeted-re-review actor name.)
- Independently modeled the documented comparator. Insertion into an equal-projection run reaching the last committed position passed, while insertion short of it failed; deletion passed only when the run extended one row beyond the committed prefix and failed when it reached only the final committed position. The corrected boundary asymmetry is therefore valid.
- Extended that model through the documented suffix rule. A passing insertion changed complete projected output from `[B,A,A]` to `[B,A,A,A]`; a passing deletion changed it from `[B,A,A,A,C]` to `[B,A,A,C]`. This disproves Group 1's complete-output/no-loss claim even before accounting for histogram stamps on appended suffix rows.
- Checked every notable invisible instance against the fixture obligations. Same-hour mutation, histogram-stamp mutation, coordinated field edit, coordinated delete/insert, equal-projection reorder, and both insertion/deletion boundaries are named; the documented coordinated reorder of differing projections has no pass fixture.
- Confirmed literal `fetch_busyness(place_id)` and the stale venue-list sentence have zero occurrences in `PLAN.md` and `CLAUDE.md`; no venues/meta merge is assigned to `ranking.js` or `tests/js`.
- Reprojected the real `data/phase0/place_ids.csv` into the proposed registry: 28 total and 28 `confident` rows; all four projected fields nonempty; 28 unique `venue_id` values; 28 unique `place_id` values; exact ID-set equality with all 28 keys in `data/venues_meta.json`.
- Ran `node --test tests/js/*.test.js`: 142 tests, 142 passed, 0 failed/skipped/cancelled.
- Ran `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`: `NOT_DUE` (`sampling interval: 1 in 4`; no selected assignment awaiting audit).
- Read back `reviews/LEDGER.md`: exactly one `ARCH-002` row; the ledger diff allocates no `IMP-###` identifier.
- Ran both baseline `git diff --name-only -- data/` and `git status --short -- data/`: no tracked or untracked changes anywhere under `data/`.

### Could not verify

- None.

### User decisions required

- None.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 4 — 2026-09-01

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewed artifact after response**: uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; round-4 corrections confined to `PLAN.md`'s coarsening consequence grouping and its fixture obligations, with lifecycle reconciliation in `HANDOFF.md` and this response

### Finding dispositions

#### `ARCH-002-R1-F01` — `accepted`

- **Factual assessment**: `confirmed` — the misgrouping reproduces, and the mechanism is worse than the finding states in one respect.
- **Independent verification**: Extended my model from the prefix comparator to the **whole stage** — length check, prefix comparison, then suffix coarsening — so it emits the complete output rather than a verdict, and ran the transformations through it. **Insertion** at the boundary: comparator passes, and the complete projected output goes from `[A,A,A,C]` to `[A,A,A,A,C]`. The mechanism is that the row which had been *last-processed* is pushed past the prefix boundary and coarsens a **second** time — so the gained row is a **duplicate of an existing visit**, and it carries *this* run's histogram stamp rather than the original row's, which corrupts lineage as well as count. The finding says "an added suffix row that will be coarsened"; that is right, and the duplicate-plus-restamp detail is the part worth recording. **Deletion** past the boundary: comparator passes, and the output goes from `[A,A,A,A,C]` to `[A,A,A,C,D]` — the previously-first-unprocessed row is pulled *into* the compared prefix and is therefore never coarsened, erasing a real visit, with the appended row changing the suffix besides. Both were filed under Group 1 with "nothing is lost", which is false. I also re-ran the members that **stay** in Group 1 to be sure the corrected split is right rather than merely narrower: a sub-hour `occurred_at` edit and a reorder among equal projections both leave the complete output byte-identical. And I confirmed the missing fixture: a coordinated reorder of two differing-projection rows applied to both sides passes the comparator while rewriting chronological order, and no obligation covered it.
- **Response**: Accepted. The underlying mistake was grouping by **comparator blindness** and then asserting a consequence, when the two are different questions — the comparator can only ever inspect the prefix, so any transformation that changes *which rows are the prefix* is outside what it can observe, and its consequence has to be read off the complete output instead. The section now says that explicitly before either table, and the boundary conditions are relabelled as describing comparator blindness only. The two boundary transformations move to Group 2 with their exact consequences stated. Group 1 now holds only transformations that shift nothing across the boundary — sub-hour edits, and reorder or substitution among equal projections — and each row carries a "why the complete output is unchanged" column so the claim is visible rather than implied. I did not broaden beyond the consequence and fixture text: the predicate, the equivalence boundary and the verified insertion/deletion asymmetry are unchanged, and the asymmetry is preserved verbatim in its own paragraph.
- **Changes made**: `PLAN.md`, "The coarsening stage" — added the invisible-is-not-harmless framing paragraph; rebuilt Group 1 as three rows with an added "why the complete output is unchanged" column; moved the boundary insertion and deletion into Group 2 with per-row loss statements (duplicate visit carrying this run's stamp; erased visit plus changed suffix); added a paragraph naming this as the correction that matters most and why two drafts got it wrong; relabelled the preserved asymmetry paragraph as comparator blindness only; extended the closing paragraph to cover the boundary cases under the same "outside anything it can observe" argument. Fixtures: split the combined coordinated delete/insert bullet into two, **added a coordinated differing-projection reorder case**, added a substitution case, and rewrote the two passing boundary cases plus the two Group 1 cases to assert their **complete-output consequence**, not just the comparator verdict.
- **Verification**: Every transformation re-executed through the whole-stage model; the corrected text predicts each complete output, including the two it previously got wrong. Ran a coverage check mapping all ten notable instances in the two tables to fixture bullets — **0 missing**. Counted the coarsening obligations rather than asserting a number: **27 bullets**, of which three passing cases carry an explicit complete-output assertion. I have deliberately put **no fixture count into `PLAN.md`**, since a count in prose is what drifts; the obligations are the record. Full required verification rerun — see `Re-review readiness`.

#### `ARCH-002-R1-F02`, `ARCH-002-R1-F03`, `ARCH-002-R1-F04`

- Recorded `resolved` by review rounds 2 and 3, and confirmed still resolved by round 4. Not reopened and not altered: this round's correction is confined to the coarsening section's consequence grouping and fixture list. Re-checked after editing that all four remain present and unchanged — ranking key 2's "Not a filter" wording, the three bound-level `NONE` rows, the `preference` failure-scope table, and the `validateReturnTransport()` boundary sentence.

### User-directed revisions

- None.

### User decisions required

- None.

### Re-review readiness

- **Ready for re-review**: yes
- **Reason**: The one unresolved finding is accepted and corrected within its stated consequence-and-fixture boundary; no rebuttals, no blocked findings, no scope broadening, and the three resolved findings are untouched. Required verification rerun in full: tracked changes confined to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, `reviews/LEDGER.md`, with only the two declared untracked review artifacts alongside; literal `fetch_busyness(place_id)` 0 in both files; stale venue-list sentence 0; no venues/meta merge assigned to `ranking.js` or `tests/js`; registry projection against real `data/phase0/place_ids.csv` and `data/venues_meta.json` — 28 `confident`, all four fields nonempty, 28 unique `venue_id`, 28 unique `place_id`, ID sets exactly equal; `node --test tests/js/*.test.js` 142 passed / 0 failed; `.cross-agent-workflow/audit_due.py` `NOT_DUE`; exactly one `ARCH-002` ledger row with no `IMP-###` added; `git diff --name-only -- data/` and `git status --short -- data/` both empty, so nothing under `data/` is touched and frozen Phase 0 artifacts are intact; `git diff --check` clean; code fences balanced. No production code written, nothing committed or pushed.

---

## Review round 5 — 2026-09-01

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol_high`
- **Runtime model verification**: The runtime does not expose the selected model; the user's route selection is relied on because the interface did not report otherwise.
- **Reviewed artifact**: Targeted correction delta after round 4 within the uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; correction review confined to `PLAN.md`'s coarsening consequence grouping and fixture obligations, with lifecycle reconciliation in `HANDOFF.md` and the primary-owned response in this record

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-002-R1-F01` | `unresolved` | The round-4 misclassification is corrected for the intended raw-prefix examples: boundary insertion/deletion now sit in Group 2 with the right suffix consequences, and every transformation shape named in the tables has a fixture. But the revised contract still omits qualifiers its consequence claims require. Group 1's reorder and substitution rows at `PLAN.md:2115-2116` do not say **raw-side**. Applied to committed rows with the same projection but different `histogram_busyness` / `histogram_fetched_at`, either operation remains comparator-invisible while changing the byte-level complete output and lineage, contradicting Group 1's claim at `PLAN.md:2110-2116`. They are genuinely inconsequential only as raw-prefix transformations (or if the complete committed rows, not merely their projections, are identical). Likewise, the duplicate-plus-restamp insertion claim at `PLAN.md:2124,2129` is accurate when the insertion occurs **within the processed region** and pushes the previously-last-processed raw row into the suffix; an equal-projection row appended just after the boundary also leaves the compared prefix equal but coarsens the new row once rather than duplicating the old visit, so the position must be stated. Finally, `PLAN.md:2176` says every passing case asserts its documented complete-output consequence, but several fixture bullets assert only `passes` / `documented` — notably coordinated field edit and coordinated structural delete/insert/reorder at `PLAN.md:2161,2165-2167`, and the sub-hour mutation at `PLAN.md:2162` does not assert byte identity. The instance-to-fixture mapping is now complete, but its asserted-consequence guarantee is not. |

### Findings

No new findings. These are remaining precision and fixture-assertion deficiencies within `ARCH-002-R1-F01`'s existing consequence boundary, so its stable ID remains open. F02, F03, and F04 remain resolved and were not reopened.

### Verification performed

- Re-read `HANDOFF.md` in full first; confirmed `ARCH-002` is at `review_requested`, with the unchanged baseline and routes, and a round-5 slice limited to F01's consequence/fixture correction.
- Ran `git status --short`, the baseline diff limited to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, and `reviews/LEDGER.md`, and `git diff --check`. Tracked changes remain confined to those four assignment files; the declared gate and review records are the only untracked paths.
- Ran `.cross-agent-workflow/finding_state.py reviews/ARCH-002.md --emit-chunks --actor reviewer-round2`; it reduced F01 to schema-valid `primary_accepted` after the round-4 response and kept F02-F04 terminally resolved.
- Confirmed the single-predicate equivalence statement at `PLAN.md:2102-2106` survived unchanged and the verified insertion/deletion comparator asymmetry remains intact at `PLAN.md:2131`; neither was re-derived or reopened.
- Extended the insertion example with raw-row identity and histogram stamps. An insertion inside the processed equal-projection run pushed raw row `r3` into the suffix, yielding the existing committed `r3` row plus a second `r3` stamped `current`, so the documented duplicate-plus-restamp consequence is correct for that position. Appending the same-projection new row just after the boundary instead coarsened the new row once, demonstrating why the within-processed-region qualifier is load-bearing.
- Checked the Group 1 rows in both directions. Raw-side sub-hour edit, equal-projection reorder, and equal-projection substitution wholly within the prefix leave the committed prefix and suffix byte-identical. The same reorder/substitution wording also admits committed-side rows with equal projections but distinct stamps, which changes the complete output; the present table does not constrain the side.
- Mapped all table instances to fixture bullets: none is wholly absent, including coordinated differing-projection reorder. Checked the stronger summary at `PLAN.md:2176` separately; multiple passing bullets record only the comparator verdict and do not assert the table's complete-output consequence.
- Confirmed literal `fetch_busyness(place_id)` and the stale venue-list sentence have zero occurrences in `PLAN.md` and `CLAUDE.md`; no venues/meta merge is assigned to `ranking.js` or `tests/js`.
- Reprojected the real `data/phase0/place_ids.csv` into the proposed registry: 28 total and 28 `confident` rows; all four projected fields nonempty; 28 unique `venue_id` values; 28 unique `place_id` values; exact ID-set equality with all 28 keys in `data/venues_meta.json`.
- Ran `node --test tests/js/*.test.js`: 142 tests, 142 passed, 0 failed/skipped/cancelled.
- Ran `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`: `NOT_DUE` (`sampling interval: 1 in 4`; no selected assignment awaiting audit).
- Read back `reviews/LEDGER.md`: exactly one `ARCH-002` row; the ledger diff allocates no `IMP-###` identifier.
- Ran both baseline `git diff --name-only -- data/` and `git status --short -- data/`: no tracked or untracked changes anywhere under `data/`.

### Could not verify

- None.

### User decisions required

- None.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 5 — 2026-09-01

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewed artifact after response**: uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; round-5 corrections confined to `PLAN.md`'s coarsening consequence wording and its fixture obligations, with lifecycle reconciliation in `HANDOFF.md` and this response

### Finding dispositions

#### `ARCH-002-R1-F01` — `accepted`

- **Factual assessment**: `confirmed` — all three deficiencies reproduce.
- **Independent verification**: Extended the whole-stage model so committed rows carry their `histogram_busyness` and `histogram_fetched_at`, which is what the previous model elided and what all three claims turn on. **Side qualifier:** two committed rows sharing a projection but stamped `40/t1` and `75/t2` can be swapped — the comparator passes, and the complete output changes from `[A@40/t1, A@75/t2, …]` to `[A@75/t2, A@40/t1, …]`. The stamps are not in the projection, so nothing detects it, and both rows' Phase 3 lineage is then wrong. My Group 1 wording said only "inside the prefix", which admitted exactly that. **Insertion position:** inserting an equal-projection row *within* the processed region pushes the previously-last-processed raw row past the boundary, and it coarsens a second time carrying this run's stamp — the duplicate. Inserting the same row *just after* the boundary leaves the compared prefix untouched, and the new row simply coarsens once. Worth recording precisely: in my example the two complete outputs coincide, because the inserted row and the pushed row share a projection — so the distinction is not visible in the output, only in the mechanism. That is exactly why the claim needed the qualifier rather than a broader sentence: the row states a mechanism, and the mechanism is true for only one of the two positions. **Fixture assertions:** scanned the obligation list for passing bullets lacking a complete-output assertion — six of them, precisely the ones the finding names (sub-hour mutation, coordinated field edit, coordinated structural deletion, insertion and reorder, and the histogram-stamp case), against a summary sentence claiming every passing case asserts one.
- **Response**: Accepted on all three. On the third I took the "add the assertions" branch rather than narrowing the summary, because the summary states the property that makes the fixtures worth having — a passing case that records only the comparator verdict is compatible with either group, so it cannot pin the grouping. Narrowing the claim would have kept the gap and merely stopped describing it. I did not broaden beyond F01's consequence and fixture wording: the single predicate, the equivalence boundary and the verified insertion/deletion comparator asymmetry are untouched, and I re-checked each of the three after editing.
- **Changes made**: `PLAN.md`, "The coarsening stage" — Group 1's three rows now name the **raw** side explicitly, with a lead-in flagging the qualifier as load-bearing and a following note explaining that the committed-side analogues are Group 2 because equal projections can carry different stamps, and are inconsequential only when the complete rows are identical rather than merely their projections. The Group 2 insertion row now reads "within the processed region — at or before the last committed position", and a new paragraph states why the position is not decoration and what the just-after-boundary case does instead. Fixtures: added complete-output assertions to the six passing bullets that lacked them; added a **contrast case** for the just-after-boundary insertion, asserting the new row coarsens once with **no** duplicate, so the position qualifier is pinned by a test rather than only asserted in prose; tightened the summary sentence and recorded that an earlier draft made it while several bullets fell short of it.
- **Verification**: Each claim re-executed against the stamp-carrying model; the corrected text predicts every result. Re-scanned the obligation list — **11 passing-case bullets, 0 lacking a complete-output assertion** (28 bullets total in the coarsening list). Confirmed the three preserved items survived byte-intact by grepping their distinctive sentences: the single predicate, the insertion/deletion asymmetry paragraph, and — for F02/F03/F04 — ranking key 2's "Not a filter", the three bound-level `NONE` rows, the `preference` failure-scope table, and the `validateReturnTransport()` boundary. Full required verification rerun below.

#### `ARCH-002-R1-F02`, `ARCH-002-R1-F03`, `ARCH-002-R1-F04`

- Recorded `resolved` by rounds 2 and 3 and reconfirmed by rounds 4 and 5. Not reopened and not altered; re-checked present and unchanged after this round's edits.

### User-directed revisions

- None.

### User decisions required

- None.

### Re-review readiness

- **Ready for re-review**: yes
- **Reason**: The one unresolved finding is accepted and corrected within its stated consequence-and-fixture boundary; no rebuttals, no blocked findings, no scope broadening, and the three resolved findings plus the two explicitly preserved items are untouched. Required verification rerun in full: tracked changes confined to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, `reviews/LEDGER.md`, with only the two declared untracked review artifacts alongside; literal `fetch_busyness(place_id)` 0 in both files; stale venue-list sentence 0; no venues/meta merge assigned to `ranking.js` or `tests/js`; registry projection against real `data/phase0/place_ids.csv` and `data/venues_meta.json` — 28 `confident`, all four fields nonempty, 28 unique `venue_id`, 28 unique `place_id`, ID sets exactly equal; `node --test tests/js/*.test.js` 142 passed / 0 failed; `.cross-agent-workflow/audit_due.py` `NOT_DUE`; exactly one `ARCH-002` ledger row with no `IMP-###` added; `git diff --name-only -- data/` and `git status --short -- data/` both empty, so nothing under `data/` is touched; `git diff --check` clean; code fences balanced. No production code written, nothing committed or pushed.

---

## Review round 6 — 2026-09-01

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol_high`
- **Runtime model verification**: The runtime does not expose the selected model; the user's route selection is relied on because the interface did not report otherwise.
- **Reviewed artifact**: Targeted correction delta after round 5 within the uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; correction review confined to `PLAN.md`'s coarsening consequence wording and fixture obligations, with lifecycle reconciliation in `HANDOFF.md` and the primary-owned response in this record

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-002-R1-F01` | `unresolved` | The consequence tables now carry the required qualifiers: Group 1 explicitly applies only to raw-prefix transformations (`PLAN.md:2110-2116`), the committed-side analogues are correctly placed in Group 2 at `PLAN.md:2118`, and the duplicate mechanism is limited to an insertion within the processed region at `PLAN.md:2126,2133`. The fixture assertions are still not fully coextensive with that corrected contract. First, the Group 1 reorder and substitution bullets at `PLAN.md:2172-2173` again say only “prefix,” not **raw prefix**, so as written they admit the committed-side stamped-row counterexample the table now excludes. Second, the paired insertion bullets at `PLAN.md:2174-2175` claim the **complete output** proves that one suffix row is a duplicate of the previously processed visit while the other is the new visit coarsened once. It cannot: `seatlog.csv` discards `occurred_at`, and both source rows necessarily have the same projection and receive the same current histogram stamp. Independent construction produced the same output in both cases — committed `[A@old1,A@old2,A@old3]` plus `[A@current]`. A complete-output assertion can prove one row was appended, but cannot identify which raw visit it represents or distinguish duplicate from new. Pinning the position-dependent mechanism therefore requires an observable seam that records which raw suffix row was coarsened, or the fixture/prose must honestly state that the mechanisms are indistinguishable in output. The current contrast fixture is not assertable as written, and the same limitation applies to the duplicate-identity clause in the preceding fixture. |

### Findings

No new findings. The two remaining fixture precision defects are within `ARCH-002-R1-F01`'s existing consequence-and-fixture boundary, so its stable ID remains open. F02, F03, and F04 remain resolved and were not reopened.

### Verification performed

- Re-read `HANDOFF.md` in full first; confirmed `ARCH-002` is at `review_requested`, with the unchanged baseline and routes, and a round-6 slice limited to F01's side/position/fixture assertions.
- Ran `git status --short`, the baseline diff limited to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, and `reviews/LEDGER.md`, and `git diff --check`. Tracked changes remain confined to those four assignment files; the declared gate and review records are the only untracked paths.
- Ran `.cross-agent-workflow/finding_state.py reviews/ARCH-002.md --emit-chunks --actor reviewer-round2`; it reduced F01 to schema-valid `primary_accepted` after the round-5 response and kept F02-F04 terminally resolved.
- Confirmed the single-predicate equivalence statement at `PLAN.md:2102-2106` and the verified insertion/deletion comparator asymmetry at `PLAN.md:2135` survived intact; neither was re-derived or reopened.
- Checked the revised tables: every Group 1 row now says raw-side/raw-prefix, and the committed-side note correctly treats equal-projection rows with differing histogram stamps as genuine loss without contradicting the existing stamp-mutation row.
- Checked the insertion qualifier in the table, explanation, and principal fixture: all now require an insertion within the processed region. The just-after-boundary prose correctly describes the different raw-row mechanism.
- Independently modeled both insertion positions with identity before coarsening and then projected to the committed schema. The within-prefix case selected the pushed old raw row; the after-boundary case selected the new raw row. After projection and current-histogram stamping, both complete outputs were byte-equivalent, proving the contrast's source-row identity is not observable from output alone.
- Counted 11 passing fixture bullets and confirmed each now includes consequence language. Compared that language to the tables: all other added assertions agree with their groups, while the two Group 1 fixture bullets lack the table's raw-side scope and the paired insertion assertions overclaim what complete output proves.
- Confirmed literal `fetch_busyness(place_id)` and the stale venue-list sentence have zero occurrences in `PLAN.md` and `CLAUDE.md`; no venues/meta merge is assigned to `ranking.js` or `tests/js`.
- Reprojected the real `data/phase0/place_ids.csv` into the proposed registry: 28 total and 28 `confident` rows; all four projected fields nonempty; 28 unique `venue_id` values; 28 unique `place_id` values; exact ID-set equality with all 28 keys in `data/venues_meta.json`.
- Ran `node --test tests/js/*.test.js`: 142 tests, 142 passed, 0 failed/skipped/cancelled.
- Ran `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`: `NOT_DUE` (`sampling interval: 1 in 4`; no selected assignment awaiting audit).
- Read back `reviews/LEDGER.md`: exactly one `ARCH-002` row; the ledger diff allocates no `IMP-###` identifier.
- Ran both baseline `git diff --name-only -- data/` and `git status --short -- data/`: no tracked or untracked changes anywhere under `data/`.

### Could not verify

- None.

### User decisions required

- None.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 6 — 2026-09-01

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewed artifact after response**: uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; round-6 corrections confined to `PLAN.md`'s coarsening fixture wording and a new observability paragraph, with lifecycle reconciliation in `HANDOFF.md` and this response

### Finding dispositions

#### `ARCH-002-R1-F01` — `accepted`

- **Factual assessment**: `confirmed` — both deficiencies reproduce, and the second one is a claim I had myself flagged as doubtful in the round-5 response and then failed to act on.
- **Independent verification**: **Fixture side qualifier:** read the two Group 1 bullets directly; both said "prefix" where the table now says "raw prefix". Since a committed-side reorder or substitution of equal-projection rows with differing stamps is a Group 2 instance — established and verified last round — the bullets as written admitted exactly the counterexample the table had just excluded. **Insertion identity:** modelled the stage with the real committed schema, `occurred_at` discarded and only `(projection, histogram_busyness, histogram_fetched_at)` retained. Inserting an equal-projection row *within* the processed region and inserting the same row *just after* the boundary both produce `[A@40/t1, A@41/t2, A@42/t3, A@99/current]` — byte-identical. Stronger than the finding states: even the raw *index* feeding the suffix is the same in both constructions, so the discriminator is not position-in-the-suffix but raw-row **identity**, which the committed record does not retain in any column. A complete-output assertion can therefore establish that a row was added, with which projection and which stamp — never which visit it represents. The contrast fixture as written was not assertable, and the duplicate-identity clause in the bullet above it had the same defect. I record that my own round-5 response noted "the distinction is not visible in the output, only in the mechanism" and I nonetheless left a fixture asserting it; the reviewer is right to have caught the inconsistency rather than my having caught it myself.
- **Response**: Accepted. I took the second branch — state the limit honestly and drop the claim — rather than defining an observable seam, and recorded the reasoning rather than leaving it implicit. A seam reporting which raw rows the stage consumed would have to surface raw-row identity, i.e. the timestamp this file exists to destroy; confining it to an in-memory return value would avoid the privacy cost, but it buys nothing, because **the two mechanisms have identical consequence** — one spurious row of that projection carrying this run's stamp, either way. Adding production surface to observe a distinction with no difference in outcome is precisely the trade this section rejects for the `occurred_at` digest, and the two rejections now sit together. The Group 2 table row keeps its "within the processed region" qualifier, because the *mechanism* claim it makes is true and derivable from the input; what changes is that the contract now says explicitly that the mechanism is derivable from input position and the algorithm, and **not** observable in the committed record.
- **Changes made**: `PLAN.md`, "The coarsening stage" — added `RAW` to the reorder and substitution fixture bullets, each with a one-clause reason, and added a **committed-side counterpart fixture** asserting the stamps are relocated, so both sides of that distinction are pinned. Rewrote the two insertion bullets: the first now asserts only that the output gained exactly one row of that projection carrying this run's stamp — enough to file it under Group 2, since the output is not identical — and states explicitly that it does **not** assert which visit that row is; the second is re-titled the **paired position case** and asserts the output is *identical* to the first, its purpose being to pin that identity rather than to defeat it. Added an observability paragraph after the position paragraph, stating the byte-identical result, the same-raw-index finding, and the seam rejection with its reasons. Reconciled the summary sentence to claim only what the committed record can establish, with an explicit "the assertions stop where the schema does" paragraph naming the earlier overclaim.
- **Verification**: Both insertion constructions re-executed against the real committed schema; outputs identical, as the corrected text now states. Re-scanned the obligation list: **0 unassertable identity claims remain**, **12 passing bullets, 0 lacking a consequence assertion**, 29 bullets total. Confirmed by grep that the items I was told to keep unchanged survived intact — the single predicate, the insertion/deletion comparator asymmetry, Group 1's raw-side table rows, and the Group 2 within-processed-region row — as did F02/F03/F04's four load-bearing sentences.

#### `ARCH-002-R1-F02`, `ARCH-002-R1-F03`, `ARCH-002-R1-F04`

- Recorded `resolved` by rounds 2 and 3 and reconfirmed by rounds 4, 5 and 6. Not reopened and not altered; re-checked present and unchanged after this round's edits.

### User-directed revisions

- None.

### User decisions required

- None.

### Re-review readiness

- **Ready for re-review**: yes
- **Reason**: The one unresolved finding is accepted and corrected within its stated fixture-and-observability boundary; no rebuttals, no blocked findings, no scope broadening, and every item designated to stay unchanged is verified unchanged. Required verification rerun in full: tracked changes confined to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, `reviews/LEDGER.md`, with only the two declared untracked review artifacts alongside; literal `fetch_busyness(place_id)` 0 in both files; stale venue-list sentence 0; no venues/meta merge assigned to `ranking.js` or `tests/js`; registry projection against real `data/phase0/place_ids.csv` and `data/venues_meta.json` — 28 `confident`, all four fields nonempty, 28 unique `venue_id`, 28 unique `place_id`, ID sets exactly equal; `node --test tests/js/*.test.js` 142 passed / 0 failed; `.cross-agent-workflow/audit_due.py` `NOT_DUE`; exactly one `ARCH-002` ledger row with no `IMP-###` added; `git diff --name-only -- data/` and `git status --short -- data/` both empty; `git diff --check` clean; code fences balanced. No production code written, nothing committed or pushed.

---

## Review round 7 — 2026-09-01

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol_high`
- **Runtime model verification**: The runtime does not expose the selected model; the user's route selection is relied on because the interface did not report otherwise.
- **Reviewed artifact**: Targeted correction delta after round 6 within the uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; correction review confined to `PLAN.md`'s coarsening fixture wording and observability paragraph, with lifecycle reconciliation in `HANDOFF.md` and the primary-owned response in this record

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-002-R1-F01` | `unresolved` | The two round-6 defects are corrected: the Group 1 reorder/substitution fixtures now say raw prefix and have a committed-side Group 2 counterpart (`PLAN.md:2176-2178`), while the paired insertion fixtures assert only the byte-identical committed outputs the schema can establish (`PLAN.md:2179-2180`). The seam rejection at `PLAN.md:2135-2137` is sound: both insertion positions have the same committed output and downstream consequence, so exposing discarded raw identity would add surface without changing a consumer-visible invariant. The Group 2 within-processed insertion mechanism remains consistent because it is explicitly described as derivable from input position and the algorithm but unobservable in output. One symmetric identity overclaim remains. The deletion fixture at `PLAN.md:2182` says the **complete output** establishes that the “previously-first-unprocessed visit” was lost. It cannot identify that visit for the same reason the insertion fixtures cannot: equal-projection raw rows differ only by discarded `occurred_at`. The output can establish that one row of that projection is absent and that the suffix composition changed, while the algorithm/input position establishes which raw row crossed the boundary. The blanket observability statement at `PLAN.md:2188` is limited to which raw visit an **added** row represents and therefore does not reconcile this deletion-side claim. |

### Findings

No new findings. The remaining deletion-side observability defect is the exact symmetric edge of `ARCH-002-R1-F01`'s existing fixture boundary, so its stable ID remains open. F02, F03, and F04 remain resolved and were not reopened.

### Verification performed

- Re-read `HANDOFF.md` in full first; confirmed `ARCH-002` is at `review_requested`, with the unchanged baseline and routes, and a round-7 slice limited to F01's fixture/observability correction.
- Ran `git status --short`, the baseline diff limited to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, and `reviews/LEDGER.md`, and `git diff --check`. Tracked changes remain confined to those four assignment files; the declared gate and review records are the only untracked paths.
- Ran `.cross-agent-workflow/finding_state.py reviews/ARCH-002.md --emit-chunks --actor reviewer-round2`; it reduced F01 to schema-valid `primary_accepted` after the round-6 response and kept F02-F04 terminally resolved.
- Confirmed the single predicate, comparator asymmetry, Group 1 raw-side table rows, and Group 2 within-processed insertion row survived intact; none was re-derived or reopened.
- Confirmed the new raw-prefix qualifiers are present in both Group 1 fixture bullets and that the committed-side counterpart correctly asserts stamp relocation as a Group 2 consequence.
- Independently reconstructed both insertion positions under the committed schema. Their complete outputs are identical and both differ from the pre-change output by one current-stamped equal-projection row. The paired fixture can assert that equality, and its placement and wording do not classify the just-after-boundary case as Group 1.
- Assessed the seam decision: an in-memory provenance seam could expose raw identity without persistence, but no downstream result differs between the two insertion mechanisms. Rejecting that additional interface is proportionate, provided the design retains the now-explicit observability limit.
- Applied the same schema projection to the deletion fixture. The complete output shows one fewer equal-projection row and a changed suffix, but cannot identify which raw event supplied or lost that row. This is the only remaining fixture claim exceeding committed-schema evidence.
- Counted 12 passing fixture bullets; each includes consequence language. All assertions other than the deletion identity clause are supported by the committed output or explicitly limited to algorithmic/input reasoning.
- Confirmed literal `fetch_busyness(place_id)` and the stale venue-list sentence have zero occurrences in `PLAN.md` and `CLAUDE.md`; no venues/meta merge is assigned to `ranking.js` or `tests/js`.
- Reprojected the real `data/phase0/place_ids.csv` into the proposed registry: 28 total and 28 `confident` rows; all four projected fields nonempty; 28 unique `venue_id` values; 28 unique `place_id` values; exact ID-set equality with all 28 keys in `data/venues_meta.json`.
- Ran `node --test tests/js/*.test.js`: 142 tests, 142 passed, 0 failed/skipped/cancelled.
- Ran `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`: `NOT_DUE` (`sampling interval: 1 in 4`; no selected assignment awaiting audit).
- Read back `reviews/LEDGER.md`: exactly one `ARCH-002` row; the ledger diff allocates no `IMP-###` identifier.
- Ran both baseline `git diff --name-only -- data/` and `git status --short -- data/`: no tracked or untracked changes anywhere under `data/`.

### Could not verify

- None.

### User decisions required

- None.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 7 — 2026-09-01

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewed artifact after response**: uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; round-7 corrections confined to `PLAN.md`'s deletion fixture bullet and the observability paragraph, with lifecycle reconciliation in `HANDOFF.md` and this response

### Finding dispositions

#### `ARCH-002-R1-F01` — `accepted`

- **Factual assessment**: `confirmed` — the deletion-side overclaim is real, and it is the exact mirror of the insertion-side one corrected last round.
- **Independent verification**: Modelled the passing deletion against the real committed schema. Before: `[A@t1, A@t2, A@t3, A@current, C@current]`. After deleting the first row of a four-long equal-projection run and appending one row: `[A@t1, A@t2, A@t3, C@current, D@current]`. **Observable:** one row of that projection is absent from the suffix, and the suffix composition changed. **Not observable:** which raw visit is gone — I constructed it both ways, deleting the *first* row of the run and deleting the *last*, and the committed output is byte-identical, because the two differ only in the discarded `occurred_at`. So "the complete output is asserted to have lost the previously-first-unprocessed visit" claims something the record cannot support, for precisely the reason round 6 established for insertion. I also checked the one nearby phrase that survives the sweep — the **coordinated** structural deletion bullet's "lost that visit" — and it is genuinely assertable, because there a specific *committed* row is removed and committed rows carry distinct `histogram_busyness` / `histogram_fetched_at` values; deleting `t1` versus `t2` produces visibly different output. That one is correct as written and I left it alone.
- **Response**: Accepted. This is the second consecutive round caused by my fixing a defect on one side of a symmetric pair and not sweeping for the other — round 6 corrected the insertion identity claim, and the deletion bullet asserting the same unsupported thing was four lines below it. The fix therefore does two things rather than one: it corrects the deletion bullet, and it rewrites the observability statement to cover **added and lost rows together**, in one sentence, so the claim cannot be repaired on one side alone again. The deletion *mechanism* stays where round 7 directs — in the Group 2 table row and the explanatory prose, as something derivable from input position and the algorithm — and the generalised paragraph now says explicitly that both mechanisms are derivable that way and neither is derivable from the record. All other corrected wording is untouched.
- **Changes made**: `PLAN.md`, "The coarsening stage" — the passing deletion fixture now asserts that the output **lost one row of that projection from the suffix** with the changed suffix composition asserted explicitly, states that this is enough to file the instance under Group 2, and states that it does **not** assert which raw visit is gone, noting the both-ways construction that shows why. Generalised "The assertions stop where the schema does" to "…in both directions", covering which visit an added row represents *and* which visit a lost row was, naming the shared cause, keeping the mechanism claims in prose, and recording that earlier drafts made this error on the insertion side and then again on the deletion side.
- **Verification**: Both deletion constructions re-executed; outputs identical, as the corrected bullet now states. Swept the entire coarsening section for any surviving claim that committed output establishes raw-event identity: **0 fixture bullets** make one; the remaining matches are the Group 2 table rows and the explanatory prose, which round 7 directs be kept as mechanism statements. Post-edit: **12 passing bullets, 0 lacking a consequence assertion**, 29 bullets total. Confirmed by grep that every item designated to stay unchanged is unchanged — the predicate, the comparator asymmetry, both consequence tables, the raw-side qualifiers, the committed-side counterpart fixture, and the seam rejection — as are F02/F03/F04's four load-bearing sentences.

#### `ARCH-002-R1-F02`, `ARCH-002-R1-F03`, `ARCH-002-R1-F04`

- Recorded `resolved` by rounds 2 and 3 and reconfirmed by rounds 4 through 7. Not reopened and not altered; re-checked present and unchanged after this round's edits.

### User-directed revisions

- None.

### User decisions required

- None.

### Re-review readiness

- **Ready for re-review**: yes
- **Reason**: The one unresolved finding is accepted and corrected within its stated boundary, and this round additionally swept the whole section for the symmetric class rather than only the instance named, so the same defect cannot remain on an unexamined side. No rebuttals, no blocked findings, no scope broadening; every item designated to stay unchanged is verified unchanged. Required verification rerun in full: tracked changes confined to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, `reviews/LEDGER.md`, with only the two declared untracked review artifacts alongside; literal `fetch_busyness(place_id)` 0 in both files; stale venue-list sentence 0; no venues/meta merge assigned to `ranking.js` or `tests/js`; registry projection against real `data/phase0/place_ids.csv` and `data/venues_meta.json` — 28 `confident`, all four fields nonempty, 28 unique `venue_id`, 28 unique `place_id`, ID sets exactly equal; `node --test tests/js/*.test.js` 142 passed / 0 failed; `.cross-agent-workflow/audit_due.py` `NOT_DUE`; exactly one `ARCH-002` ledger row with no `IMP-###` added; `git diff --name-only -- data/` and `git status --short -- data/` both empty; `git diff --check` clean; code fences balanced. No production code written, nothing committed or pushed.

---

## Review round 8 — 2026-09-01

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol_high`
- **Runtime model verification**: The runtime does not expose the selected model; the user's route selection is relied on because the interface did not report otherwise.
- **Reviewed artifact**: Targeted correction delta after round 7 within the uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; correction review confined to `PLAN.md`'s passing-deletion fixture and generalized observability statement, with lifecycle reconciliation in `HANDOFF.md` and the primary-owned response in this record

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-002-R1-F01` | `unresolved` | The named deletion-side identity overclaim is corrected: `PLAN.md:2182` now asserts only loss of one projection row and changed suffix composition, while `PLAN.md:2188` consistently limits both added- and lost-row assertions to committed-schema evidence. The Group 2 table can retain the deletion mechanism because it is explicitly derivable from input position and the algorithm rather than attributed to output observation. The whole-section sweep found no other fixture claiming raw-event identity. Two fixture assertions nevertheless depend on unstated discriminating constructions. First, the passing boundary-deletion bullet says a row is appended and then asserts one row of the target projection was lost from the suffix, but it does not require the appended row to have a **different projection**. Appending an equal-projection replacement yields the same committed suffix row count/projection/stamp and can make complete output identical, so the asserted loss is not guaranteed by the fixture as written. Second, the coordinated structural deletion bullet at `PLAN.md:2173` retains “lost that visit.” The primary's justification that committed rows carry distinct histogram stamps is not a repository invariant: multiple visits coarsened under the same deployed histogram can share both stamp fields, and equal-projection committed rows can therefore be byte-identical. The assertion is supportable only if this fixture explicitly gives the target committed row a distinguishable complete-row stamp; otherwise output proves one occurrence was removed, not which visit. |

### Findings

No new findings. These are fixture-construction qualifiers within `ARCH-002-R1-F01`'s existing observability boundary, so its stable ID remains open. F02, F03, and F04 remain resolved and were not reopened.

### Verification performed

- Re-read `HANDOFF.md` in full first; confirmed `ARCH-002` is at `review_requested`, with the unchanged baseline and routes, and a round-8 slice limited to F01's deletion fixture and generalized observability statement.
- Ran `git status --short`, the baseline diff limited to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, and `reviews/LEDGER.md`, and `git diff --check`. Tracked changes remain confined to those four assignment files; the declared gate and review records are the only untracked paths.
- Ran `.cross-agent-workflow/finding_state.py reviews/ARCH-002.md --emit-chunks --actor reviewer-round2`; it reduced F01 to schema-valid `primary_accepted` after the round-7 response and kept F02-F04 terminally resolved.
- Confirmed the predicate, comparator asymmetry, both consequence tables, Group 1 raw-side qualifiers, committed-side counterpart fixture, and seam rejection survived intact; none was re-derived or reopened.
- Swept the coarsening section for raw-event identity language. The insertion and boundary-deletion fixtures now stop at schema-observable projection/stamp/count consequences; mechanism statements remain confined to the table/explanatory prose as intended.
- Reconstructed the boundary deletion with the appended row using both a differing projection and the same projection. The former exposes one missing target-projection row; the latter can replace it byte-for-byte, so the current fixture needs the differing-projection qualifier for its asserted consequence to be determinate.
- Checked the coordinated structural deletion exception. A fixture with a uniquely stamped committed target can visibly prove removal of that complete row. But stamp uniqueness is not guaranteed by the design: suffix rows for one venue coarsened under the same deployed histogram can share `histogram_busyness` and `histogram_fetched_at`. With byte-identical committed rows, deleting either position yields identical output and establishes only multiplicity loss.
- Counted 12 passing fixture bullets; every one contains consequence language. Apart from the two missing discriminator requirements above, their assertions match the committed-schema evidence and consequence groups.
- Confirmed literal `fetch_busyness(place_id)` and the stale venue-list sentence have zero occurrences in `PLAN.md` and `CLAUDE.md`; no venues/meta merge is assigned to `ranking.js` or `tests/js`.
- Reprojected the real `data/phase0/place_ids.csv` into the proposed registry: 28 total and 28 `confident` rows; all four projected fields nonempty; 28 unique `venue_id` values; 28 unique `place_id` values; exact ID-set equality with all 28 keys in `data/venues_meta.json`.
- Ran `node --test tests/js/*.test.js`: 142 tests, 142 passed, 0 failed/skipped/cancelled.
- Ran `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`: `NOT_DUE` (`sampling interval: 1 in 4`; no selected assignment awaiting audit).
- Read back `reviews/LEDGER.md`: exactly one `ARCH-002` row; the ledger diff allocates no `IMP-###` identifier.
- Ran both baseline `git diff --name-only -- data/` and `git status --short -- data/`: no tracked or untracked changes anywhere under `data/`.

### Could not verify

- None.

### User decisions required

- None.

### Recommendation

`CHANGES_REQUESTED`

---

## Primary response to review round 8 — 2026-09-01

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_opus` — Opus, effort `high`
- **Reviewed artifact after response**: uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; round-8 corrections confined to two `PLAN.md` fixture bullets in the coarsening section, with lifecycle reconciliation in `HANDOFF.md` and this response

### Finding dispositions

#### `ARCH-002-R1-F01` — `accepted`

- **Factual assessment**: `confirmed` — both defects reproduce, and the second one refutes reasoning I put in the round-7 response.
- **Independent verification**: **Unpinned deletion discriminator.** The fixture appends a row to hold the raw count steady while asserting one row of the run's projection is lost from the suffix. Constructed both ways: appending a **different**-projection row takes the suffix's count of that projection from 1 to 0, so the loss is demonstrable; appending an **equal**-projection row leaves it at 1, and the complete output is the same multiset as before — the asserted loss is then simply false. The fixture as written did not require the difference, so it was satisfiable by a construction that disproves its own assertion. **Stamp distinctness.** I checked my round-7 claim against a realistic committed prefix rather than the one I had built. Every suffix row coarsened in a single run takes that run's `histogram_fetched_at`, and rows sharing a venue, weekday and hour take the same `histogram_busyness`, so three visits to one venue in one hour coarsen to three **byte-identical** committed rows. Deleting the first or the second then yields identical output. My round-7 verification constructed stamps `t1`/`t2`/`t3` by hand and concluded from them that "committed rows carry distinct stamps" — I generalised a property of my own fixture into a property of the schema, which is circular, and it is exactly the failure mode this whole finding has been about. The reviewer is right; the claim is refuted.
- **Response**: Accepted, both. On the second I took the **multiplicity** branch rather than requiring a distinguishable target row. Both were offered and both are sound, but multiplicity holds **unconditionally** — one fewer row of that projection is observable whether or not the stamps happen to differ — whereas the identity branch would reintroduce exactly the pattern that produced the error: an assertion that works because the fixture was built to make it work. The section's discipline elsewhere is to assert what holds generally, and the one fixture that legitimately depends on differing stamps — the committed-side reorder/substitution counterpart — already states that dependence as an explicit precondition. That is the pattern the coordinated-deletion bullet should have followed and now does not need to, since multiplicity needs no precondition at all.
- **Changes made**: `PLAN.md`, "The coarsening stage" — the boundary-deletion fixture now **requires the appended row to carry a projection different from the run's**, pins that as load-bearing, and states what goes wrong with an equal-projection append. The coordinated structural deletion fixture now asserts **one fewer row of that projection**, explicitly labelled multiplicity rather than identity, and records why stamp distinctness is not an invariant. All other wording untouched.
- **Verification**: Both constructions re-executed; the corrected text predicts each outcome, including the equal-projection append that falsifies the old assertion and the byte-identical realistic prefix that falsifies my round-7 reasoning. Swept the fixture list for the general class — assertions resting on a property the fixture does not pin or the schema does not guarantee: **0 bullets claim a nameable visit**, the one remaining bullet mentioning stamp distinctness is the one that now denies it, and the only bullet appending a row pins its projection. The committed-side counterpart fixture was re-read and is correct as written, because it names differing stamps as a fixture precondition rather than assuming them. Post-edit: **12 passing bullets, 0 lacking a consequence assertion**, 29 total; all twelve designated-unchanged sentences verified intact by grep.

#### `ARCH-002-R1-F02`, `ARCH-002-R1-F03`, `ARCH-002-R1-F04`

- Recorded `resolved` by rounds 2 and 3 and reconfirmed by rounds 4 through 8. Not reopened and not altered; re-checked present and unchanged after this round's edits.

### User-directed revisions

- None.

### User decisions required

- None.

### Re-review readiness

- **Ready for re-review**: yes
- **Reason**: The one unresolved finding is accepted and corrected within its stated boundary, and the round additionally swept for the general class — assertions that depend on a property the fixture does not pin or the schema does not guarantee — rather than the two instances named. No rebuttals, no blocked findings, no scope broadening; every item designated to stay unchanged is verified unchanged. Required verification rerun in full: tracked changes confined to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, `reviews/LEDGER.md`, with only the two declared untracked review artifacts alongside; literal `fetch_busyness(place_id)` 0 in both files; stale venue-list sentence 0; no venues/meta merge assigned to `ranking.js` or `tests/js`; registry projection against real `data/phase0/place_ids.csv` and `data/venues_meta.json` — 28 `confident`, all four fields nonempty, 28 unique `venue_id`, 28 unique `place_id`, ID sets exactly equal; `node --test tests/js/*.test.js` 142 passed / 0 failed; `.cross-agent-workflow/audit_due.py` `NOT_DUE`; exactly one `ARCH-002` ledger row with no `IMP-###` added; `git diff --name-only -- data/` and `git status --short -- data/` both empty; `git diff --check` clean; code fences balanced. No production code written, nothing committed or pushed.

---

## Review round 9 — 2026-09-01

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol_high`
- **Runtime model verification**: The runtime does not expose the selected model; the user's route selection is relied on because the interface did not report otherwise.
- **Reviewed artifact**: Targeted correction delta after round 8 within the uncommitted working-tree diff against `e8f5cc7b71013a62f0fce39b999fbb957cbff982`; correction review confined to the two deletion fixture bullets in `PLAN.md`'s coarsening section, with lifecycle reconciliation in `HANDOFF.md` and the primary-owned response in this record

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-002-R1-F01` | `resolved` | The coordinated structural deletion fixture at `PLAN.md:2173` now asserts only one fewer row of the projection — an unconditional multiplicity change when the same row is removed from raw and committed prefixes and `processed_count` drops with them. It explicitly rejects stamp distinctness as an invariant, so byte-identical committed rows do not weaken the assertion. The boundary-deletion fixture at `PLAN.md:2182` now requires its appended row to carry a projection different from the equal run's, making one fewer run-projection row in the suffix observable; the text also records why an equal-projection append would falsify that assertion. Independent constructions confirmed both results and that the run-extending and different-projection prerequisites are jointly satisfiable. The fixture sweep found no remaining assertion that relies on an unstated property or on information the committed schema discards. |

### Findings

No findings. F01 is resolved above; F02, F03, and F04 remain resolved and were not reopened.

### Verification performed

- Re-read `HANDOFF.md` in full first; confirmed `ARCH-002` is at `review_requested`, with the unchanged baseline and routes, and a round-9 slice limited to the two F01 deletion fixtures.
- Ran `git status --short`, the baseline diff limited to `PLAN.md`, `CLAUDE.md`, `HANDOFF.md`, and `reviews/LEDGER.md`, and `git diff --check`. Tracked changes remain confined to those four assignment files; the declared gate and review records are the only untracked paths.
- Ran `.cross-agent-workflow/finding_state.py reviews/ARCH-002.md --emit-chunks --actor reviewer-round2`; it reduced F01 to schema-valid `primary_accepted` after the round-8 response and kept F02-F04 terminally resolved.
- Confirmed the predicate, comparator asymmetry, both consequence tables, raw-side qualifiers, committed-side counterpart fixture, seam rejection, and generalized observability statement survived intact.
- Modeled coordinated deletion with repeated projection values and byte-identical stamps. Removing the same row from raw and committed prefixes preserved the suffix and reduced that projection's complete-output multiplicity by exactly one; no identity or distinct-stamp precondition was needed.
- Modeled the boundary deletion with an equal-projection run extending one row past the committed prefix and a different-projection appended row. The comparator passed, the suffix lost exactly one run-projection row, and both stated preconditions held simultaneously.
- Swept all 12 passing fixture bullets for unstated discriminators, schema-unsupported identity claims, and consequence/group mismatches. None remains; the committed-side reorder/substitution fixture is the sole case depending on differing stamps and states that precondition explicitly.
- Confirmed literal `fetch_busyness(place_id)` and the stale venue-list sentence have zero occurrences in `PLAN.md` and `CLAUDE.md`; no venues/meta merge is assigned to `ranking.js` or `tests/js`.
- Reprojected the real `data/phase0/place_ids.csv` into the proposed registry: 28 total and 28 `confident` rows; all four projected fields nonempty; 28 unique `venue_id` values; 28 unique `place_id` values; exact ID-set equality with all 28 keys in `data/venues_meta.json`.
- Ran `node --test tests/js/*.test.js`: 142 tests, 142 passed, 0 failed/skipped/cancelled.
- Ran `.cross-agent-workflow/audit_due.py reviews/AUDIT-LOG.md`: `NOT_DUE` (`sampling interval: 1 in 4`; no selected assignment awaiting audit).
- Read back `reviews/LEDGER.md`: exactly one `ARCH-002` row; the ledger diff allocates no `IMP-###` identifier.
- Ran both baseline `git diff --name-only -- data/` and `git status --short -- data/`: no tracked or untracked changes anywhere under `data/`.

### Could not verify

- None.

### User decisions required

- None.

### Recommendation

`APPROVE`

---
