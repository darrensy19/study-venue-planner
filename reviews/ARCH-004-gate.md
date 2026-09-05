# ARCH-004 pre-gate

Run by `claude_sonnet`, effort high, fresh context. Per `CLAUDE.md`'s pre-gate role: this file
recommends nothing, approves nothing, and advances no lifecycle state. Brief generated
mechanically from `HANDOFF.md` (reproduced in the assignment prompt).

Baseline commit checked: `abe6cf7` (matches `git rev-parse HEAD` at gate time).

---

## 1. Required verification — exact commands and raw output

### `.venv/bin/pytest tests/python/ -q`

```
$ .venv/bin/pytest tests/python/ -q
........................................................................ [ 38%]
........................................................................ [ 76%]
............................................                             [100%]
188 passed in 1.54s
```

Matches brief's "expect 188 pass" exactly.

### `node --test tests/js/*.test.js`

```
$ node --test tests/js/*.test.js
...
1..184
# tests 184
# pass 184
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 124.06875
```

(Full per-test output omitted here for length; every subtest reported `ok`, zero `fail`/
`cancelled`.) Matches brief's "expect 184 pass" exactly.

### `git diff --check`

```
$ git diff --check
$ echo "EXIT:$?"
EXIT:0
```

No output, exit 0 — no whitespace/conflict-marker errors in the tracked diff.

### `git status --short`

```
$ git status --short
 M HANDOFF.md
 M reviews/LEDGER.md
?? docs/superpowers/specs/2026-09-05-review-response-design.md
```

---

## 2. Per-criterion findings

### Criterion: every `[packet]`/`[repo]` claim in the design holds against the tree, or is named as false

**Met**, for the sample checked (the brief asks for a spot-check, not exhaustive verification —
see "Could not verify" below for what was not sampled). Every claim sampled below was **[packet]**
and reproduced or read exactly as stated, with no discrepancy found:

- `package.json` is exactly `{"private": true, "type": "module"}`; `Makefile` has exactly one
  target, `refresh`. Matches §11.2 and §7.2.
- `generate_index_html()` already takes `venues_path`/`output_path` as keyword parameters (read
  `build/generate.py:261-272`) — matches §7.3's "no signature change required" claim (revision 3's
  correction C).
- `generate.py:333-334`: `validate_generated_artifact(html_text)` runs immediately before
  `output_path.write_text(html_text)` (direct write, not atomic) — matches §7.1/§7.2 exactly.
- `refresh.py`: step 7 (`_write_venues_json_atomic`, line 281) runs before step 8
  (`generate_index_html(venues_path=venues_json_path, ...)`, lines 283-293), and
  `generate_index_html` reads `venues_path.read_text()` — confirms "HTML is generated only after
  the new JSON is already on disk, and reads it back from the deployed path" (§7.1).
- `_merge_hours_source`'s docstring (`refresh.py:98-105`) contains, verbatim, "never a fresh
  identity paired with stale hours or vice versa" — matches the design's quotation in §6.4.
  `IDENTITY_FIELDS = ("name", "lat", "lng", "business_status")` (line 76) confirms all four are
  bundled together and absent together on a first-ever failure.
- `ranking.js:1649-1685`: the `business_status !== "OPERATIONAL"` removal (line 1649) runs before
  `resolveOverallFeasibility` is called (line 1680, which is what reaches `resolveHours`) — confirms
  §6.4's "tested before any hours resolution" claim by direct code order, not inference.
- Live-called `resolveHours({id:"test"}, {}, "2026-09-05")` (no `hours` block) throws
  `TypeError: Cannot read properties of undefined (reading 'current_hours_valid_from')` — confirms
  the "real but currently unreachable" `TypeError` claimed in §6.4/Decision 38.
- Live-called `resolveBusynessBand({id:"test", histogram:{status:"failed"}}, 1000)` returns exactly
  `{band:"unknown", reason:"insufficient_coverage", coverageHours:0}` — matches §6.3 verbatim.
- `ranking.js:408,415-416`: `RETURN_TIER_RANK = {unverified:0, shorter:1, tight:2, robust:3}` and
  `overallTier()` returns the lower-ranked (worse) of the two tiers — algebraically confirms §4.3's
  "a candidate whose return is unverified always has overall_tier === unverified" (unverified has
  the lowest rank, so it can only be overridden by an equally-unverified hours tier, which the
  code's own comment says never happens).
- `ranking.js:1759-1761,1770`: `noVerifiedReturn = formatClockTime(groups.unverified[0].sessionEndMidAbs)`,
  returned inside `refusals` — matches Decision 24's claim about stringifying before returning,
  variable names included.
- `app.js:7`: `const FEASIBILITY_TOLERANCE_MINUTES = 15;` declared locally in the renderer, with a
  comment (lines 3-6) reading "ranking.js's hours-side toleranceMinutes has no internal default
  (unlike the return-side tolerance and the Plan B thresholds, which do)" — matches §3.4 exactly,
  including which constants *do* have internal defaults in `ranking.js`
  (`RETURN_TOLERANCE_MINUTES`, `SEAT_CHECK_BUFFER_MINUTES`, `PLAN_B_MIN_SESSION_MINUTES`,
  `PLAN_B_MIN_CONFIDENCE`, all confirmed present at `ranking.js:23,38-40`).
- `app.js:175`: the exact "ends ~" line construction and `formatLatestLeaveAt` (lines 167-171) with
  no comparison against the selected departure time — confirms §5.2/Decision 12's claim that the
  renderer currently has no "past vs. future" distinction for `latest leave`.
- `PLAN.md:328`: `| FEASIBILITY_TOLERANCE_MINUTES = 15 | constant (provisional) | ranking.js |` and
  `PLAN.md:729`: "a named constant in `ranking.js`" — both quoted verbatim in the design (§3.4) and
  confirmed to match the source exactly, refuting revision 1's inverted claim as the design says.
- `PLAN.md:1807`: "No low-risk option found for the requested session." — exact match to the quoted
  refusal string.
- `DECISIONS.md:2465-2467`: the `IMP-014` entry documents a live refusal "ending 04:07" and quotes
  "No option with a verified way home for a session ending at 04:07." — matches Decision 24's
  citation exactly.
- `data/venue_sources.json`: 28 records, each carrying non-empty `venue_id`, `place_id`,
  `resolved_name`, `resolved_address` (verified programmatically — zero records missing a field);
  23 distinct `resolved_name` values across 28, with `Starbucks` × 4 and `The Coffee Bean & Tea
  Leaf` × 3 — matches §6.4/Decision 39's claim of "exactly the same distinctness as the stored
  names" precisely.
- Embedded snapshot in `web/index.html` (extracted and parsed): 28 venues, 28 distinct `name`
  values collapsing to 23 distinct strings with the same two duplicate groups (`Starbucks` × 4,
  `The Coffee Bean & Tea Leaf` × 3) — matches §8.2/Decision 22 exactly.
- Embedded snapshot transport coverage: `return_transport` present on 26/28 venues,
  `return_transport_status` present on all 28 (all `state: "ok"`), `outbound_transport` present on
  0/28 — matches §1's transport-coverage claim exactly, field-for-field and count-for-count.

**Live reproductions**, run against `rankVenues()` imported directly from `web/ranking.js` with the
snapshot embedded in `web/index.html` (Node's native ESM import — no test framework):

- `home`/`transit`/`2026-09-05`/`23:00`/`240`: `planA.venueId === "starbucks-chinatown-food-street"`;
  that candidate has `usableMinutesMid: 0`, `surplusMid: {kind:"finite", minutes:-257}`,
  `bindingConstraint: "venue_close"`; `groups.shorter.length === 26`, of which 25 have
  `usableMinutesMid` of `0` or `undefined`; `refusals === {noLowRiskOption:false,
  noVerifiedReturn:null}` — an **exact** match, field-for-field, number-for-number, to §3.1/§4.2's
  reproduction.
- `home`/`transit`/`2026-09-05`/`18:00`/`240`, `starbucks-chinatown-point`: `usableMinutesMid: 198`,
  `travelMinutesMid: 42`; achievable end computed as `18:42 + 198min = 22:00` and
  `sessionEndMidAbs` clocks to `22:42` — matches §5.1's "achievable end 22:00" /
  "`session_end_mid` 22:42" exactly.
- `office`/`cycle`/`2026-09-05`/`18:00`/`240`: `ranked:0 shorter:0 unverified:0 travelUnknown:0
  removed:0`, `planA:null`, `refusals:{noLowRiskOption:true, noVerifiedReturn:null}` — an **exact**
  match to §4.2's "empty board" reproduction.

No claim sampled was found to be false, overstated, or unverifiable-as-stated. The revision's own
self-corrections (B and C in the "What revision 3 changed" table — the crash being unreachable, and
no generator signature change being required) were themselves independently confirmed rather than
taken on the document's word.

### Criterion: each of Decisions 1-39 is implementable without an unapproved architectural change

**Met, to the extent a pre-gate can establish this.** Cross-checked against `HANDOFF.md`'s scope
exclusions (re-opening pure ranking logic, DOM-only rendering, ranking/tier model, busyness model,
Plan B recalculation, Python/Node boundary, static generated page, no framework, no npm; retuning
`FEASIBILITY_TOLERANCE_MINUTES`; the `ARCH-003` outbound design) and against §15's "what this
design does not change" list, which states the same set. No decision was found that requires
touching those foundations:

- Decision 31 relocates `FEASIBILITY_TOLERANCE_MINUTES`'s ownership from `app.js` to `ranking.js`
  but explicitly does not change its value (confirmed: the design text says so and gives no new
  value); this is consistent with the "retuning ... excluded" scope note, since relocation isn't
  retuning, and consistent with `PLAN.md`'s own stated placement (confirmed above).
- Decision 26 explicitly keeps "no framework, and no npm runtime dependency" — confirmed consistent
  with `package.json`'s current zero-dependency state.
- Decision 28's DOM stub is stated to be dependency-free, exercised by `node --test` — consistent
  with `package.json` carrying no `jsdom`/Playwright dependency today.
- Slice 3 (`Outbound feasibility (IMP-015)`) is treated as **not yet implemented, independent
  future work** — confirmed: `ranking.js` has no `outbound_admissible`/`resolveOutboundService`
  and the embedded snapshot has 0/28 venues with `outbound_transport`; `resolveOutboundMode` (the
  only "outbound"-named function in `ranking.js`) is pre-existing rain-substitution logic, not the
  `ARCH-003` hard filter. This confirms the design does not silently assume `ARCH-003`'s runtime
  behavior already exists.

This criterion also has an irreducible judgment component — whether a given code change **counts**
as "architectural" under `WORKFLOW.md`'s definition is exactly what `codex_sol_high`'s independent
review is for. This gate confirms the design's own factual premises for staying in scope are true;
it does not re-litigate the judgment call itself.

### Criterion: the six result states are total and disjoint over `ranking.js`'s actual groups

**Met.** The design's disjointness argument for states 2/3 (`shorter` vs. `unverified`) rests on
`overallTier()` always returning the worse tier and `unverified` having the lowest rank. Both are
confirmed directly in `ranking.js:408,415-416` (`RETURN_TIER_RANK` and the `overallTier` body), so
the claim "a candidate whose return is unverified always has `overall_tier === unverified`" follows
algebraically from code actually in the tree, not merely asserted. States 0 (control validation)
and 1/1b (partition of the `ranked` population) are new proposals with no current equivalent to
check against, so their soundness rests on the design's own reasoning (§4.3), which reads
internally consistent (state 0 short-circuits; 1/1b partition one population by a single boolean;
2/3/4 partition the remainder by successive emptiness).

### Criterion: §10's returned-shape audit is complete against `app.js`'s render path

**Met, for the fields sampled.** Read `web/app.js` in full (365 lines). Every field §10 marks
"present today" was confirmed present on the live candidate/result objects (via the reproductions
above) and/or read directly by `app.js`'s render functions: `hoursTier`/`returnTier`/`tier`
(`feasibilityLine`), `bindingConstraint`/`returnBasis`/`returnModes` (`bindingLine`),
`baselineSeatability`/`busynessBand`/`seatConfidence` (`seatConfidenceLine`), `travelMinutesMid`,
`backupStrength`/`preference` (`rankingLine`), and the nested `planB` object's exact current shape
`{venueId, mode, overallTier, strength, usableMinutesMid}` (confirmed via live reproduction,
zero-field mismatch) — matching §10's claim that `planB.travelMinutesMid` is the one field missing
from the existing nested object. `removed` entries confirmed as exactly `{venueId, reason, kind}`
(`ranking.js:1645-1651`); `travelUnknown` entries confirmed as exactly `{venueId}`
(`ranking.js:1661`) — both match §10's cited shapes exactly. `app.js`'s own `displayName()`
(line 66-71) is confirmed to be the ID-reconstruction the design criticizes ("Starbucks Utown"
etc.), supporting Decision 21/22's premise. I did not independently re-derive every one of §10's
"added" rows (D11/D12/D14/D33/D34/D36/D24 — these don't exist yet, by construction, since nothing
has been implemented) — those are prospective and can only be checked once slice 1b exists.

### Criterion: §12 criteria are executable and non-vacuous

**Met on read-through.** Every bullet in §12 either pins a concrete reproducible value (several of
which were independently reproduced above and matched exactly) or states an explicit anti-vacuity
control in the same sentence (e.g., "A fixture whose first candidate already clears the floor
proves nothing"; "That alone is insufficient — a projector returning `{}` would satisfy it"; "The
absence half alone is insufficient — it passes on a renderer that shows no end time at all"). This
is a design-time property of well-specified test criteria, not something a pre-gate can execute
before the tests exist; "met" here means the criteria are concrete and self-aware about the
vacuity failure modes the design itself identifies (§11.1), not that the criteria have been run.

### Criterion: §13's slice order carries no hidden dependency

**Met on read-through, with one point independently confirmed.** Slice 3 (outbound feasibility) is
claimed "independent of 1-2" — confirmed above that no outbound hard-filter exists yet in
`ranking.js`, so there is nothing in the current tree for slices 1-2 to have implicitly assumed
about it. Slice 0's premise ("the only command that regenerates [`web/index.html`] today is `make
refresh`, which spends live API calls") is confirmed: the `Makefile` has exactly one target,
`refresh`, and no `generate`-only target exists yet. Slices 1a→1b→2 are stated as building on each
other's outputs in order, and 4 needs 2's vocabulary — this is a straightforward, statable
dependency chain with no cross-reference I could find into a later slice from an earlier one.

### Working tree state matches the brief

**Met.** `git status --short` shows exactly two modified files and one untracked file:

- `HANDOFF.md` — diffed in full; the change is entirely the `ARCH-003` → `ARCH-004` assignment-block
  swap (closing out `ARCH-003`'s completed record, opening `ARCH-004`'s draft record). No `PLAN.md`
  or `CLAUDE.md` content is touched by this diff.
- `reviews/LEDGER.md` — diffed; one line appended registering the `ARCH-004` assignment. No other
  change.
- `docs/superpowers/specs/2026-09-05-review-response-design.md` — untracked, as the brief states.

No changes exist to `PLAN.md`, `CLAUDE.md`, or any file under `web/`, `build/`, `data/`, `scraper/`,
or `tests/` — confirmed by `git diff --stat` showing only the two files above.

---

## 3. Could not verify

- **Exhaustive `[packet]`/`[repo]` coverage.** The design makes well over 100 individually tagged
  claims across 15 sections. I sampled roughly 20-25 of the most load-bearing ones (every numeric
  reproduction, every quoted docstring/comment, every cited exact string, the three most consequential
  live scenarios) and every one checked out exactly. I did not check every claim in §2's adjudication
  table row-by-row, §8/§9's presentation-contract claims beyond what §10 required, or §11's DOM-stub
  boundary claims beyond confirming `package.json` has zero dependencies.
- **Whether each of Decisions 1-39 individually counts as "architectural" under `WORKFLOW.md`'s
  specific trigger definitions.** I confirmed the design's own factual premises (no framework/npm
  dependency added, foundations left untouched, `ARCH-003` genuinely unimplemented) but did not
  perform `WORKFLOW.md`'s route-selection test against each of the 39 decisions individually — that
  judgment is what the independent reviewer step exists for.
- **§14's self-audit table's claims 8-11 beyond what was independently reproduced.** Item 8's "not
  cross-file atomic" caveat and item 11's "helper-level test" claim describe *prospective* tests and
  code that don't exist yet, so they cannot be checked against the tree — only their internal
  consistency with the rest of the document was assessed.
- **Full text of `tests/js/ranking.test.js` and `tests/python/test_refresh.py` /
  `test_generate.py`** against every claim resting on them (e.g., "already passes an explicit
  tolerance throughout" — I confirmed 18 `rankVenues(` call sites against 35 `toleranceMinutes`
  mentions in `ranking.test.js`, which is consistent but not a line-by-line proof that all 18 calls
  supply it explicitly).
- **Whether `codex_sol_high` (the assigned independent reviewer) would reach the same conclusions**
  on the judgment-heavy criteria (implementability without unapproved architecture, slice-order
  soundness) — by design, this pre-gate does not substitute for that review.

## 4. Not asked to check

- **The soundness of the design's own arguments**, e.g., whether Decision 2's reasoning (a 90-minute
  fallback session being "not a substitute" for Plan B but adequate for Plan A is self-contradictory)
  is actually the right call, or whether Decision 33's "pipeline names `bestAlternative`, renderer
  only renders it" is the right architectural boundary. These are design-quality judgments for the
  independent reviewer, not repo-grounded facts a pre-gate checks.
- **DECISIONS.md consistency beyond the one citation checked.** I did not sweep `DECISIONS.md` for
  other prior entries that might bear on decisions in this design (e.g., prior discussion of
  `FEASIBILITY_TOLERANCE_MINUTES` placement, or of the `not_operational` vs. failed-source
  distinction) beyond the single `IMP-014` citation the design itself makes.
- **The quality/completeness of the "Not asked to check" and scope-exclusion boundaries themselves**
  — e.g., whether `HANDOFF.md`'s scope-exclusion list is itself complete, or whether other settled
  foundations exist that aren't named there.
- **`tests/python/test_refresh.py` / `test_generate.py` contents**, beyond running the full Python
  suite (188 pass). The design's Publication-robustness §12 criteria describe tests that don't exist
  yet; I did not review the *current* content of these two files for anything beyond what was needed
  to confirm the `generate_index_html()` signature and write-order claims.
- **Whether opening this design as an assignment and beginning slice 0 is otherwise appropriate right
  now** (e.g., competing priorities, `BACKLOG.md` ordering) — that's a project-management call, not
  a gate criterion.
- **The manual-acceptance-checklist items §12 adds** ("narrow-phone layout with a long warning", "a
  Plan A card with every optional line absent") — these are by definition unautomatable and outside
  what any gate (pre- or independent) can check against the tree.

---

## GATE_PASS
