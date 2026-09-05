# Gate record: IMP-016

## Gate invocation 1 — 2026-09-06

- **Gate route**: `claude_sonnet`, effort high
- **Brief source**: generated from HANDOFF.md acceptance criteria + required verification

### Checks run

- Read `HANDOFF.md`'s current-assignment block for IMP-016 (ID, objective, acceptance criteria, required verification, scope exclusions).
- Ran `git status` and `git diff -- docs/superpowers/specs/2026-09-05-study-plan-frontend-design.md`: confirms only §5 ("Data fields") and its "Assumed — needs confirming before build" subsection changed; single hunk, ends before `## 6.`.
- Read the new §5 in full, in context (through the start of `## 6. Product-policy decisions`).
- Cross-checked every field named in the new field table against `PLAN.md`'s "Result states" (line 1813), "Requested end vs achievable end" (1845), "Evidence freshness and a first-ever failed source" (1866), and "The returned presentation shape" (1926) sections, plus, where PLAN.md's presentation table pointed at underlying mechanics, the actual definitions elsewhere in `PLAN.md` (`seat_confidence`'s two components at 1928/2625; `binding_constraint`/`binding_limit_mid` at 1853/1364) and `web/ranking.js` (field names `bindingConstraint`, `hoursTier`, `metricsBasis`, `busynessBand.reason`) as an independent cross-source check. Result: every field named (`venueId`, `displayName`/`disambiguatedLabel`, `area`, `usableMinutesMid`, `metricsBasis`, `leaveAt`, `travelMinutesMid`, `achievableSessionEndMid`, `latestLeaveAt`+`latestLeaveAtState`, `bindingLimitMid`+`bindingConstraint`, `seatConfidence`, `baselineSeatability`, `busynessBand`, `returnTier`, `returnBasis`, `returnModes`, `planB.*`, `backupStrength`, `hoursStatus`/`histogramStatus`, `resultState`, `bestAlternative`, `removed[]`, `travelUnknown[]`, `snapshotEmpty`/`hardFilteredCount`, `preference`, `hoursTier`, `overallTier`) exists per PLAN.md's cited sections or their referenced mechanics. Nothing named is absent from the migrated shape. Nothing in PLAN.md's returned-shape table (§"The returned presentation shape") is missing from the new field list.
- Confirmed the removed old fields (`refusals.no_low_risk_option`, `refusals.no_verified_return`) are correctly described as gone, replaced by the single `resultState` discriminant — matches PLAN.md 1813-1830 exactly, including that the two old names survive only as `resultState` *values*, which PLAN.md's state table (1819-1826) confirms.
- Verified the Identity row's internal consistency: the old table's "resolved close time for the arrival date" was dropped, matching the new "Resolved closing label" item's own conclusion that no such field exists — the field table and the assumed-list resolution do not contradict each other.
- Checked each of the six "Assumed" items against its cited source:
  - **Resolved closing label**: verified PLAN.md's returned-shape table (1926-1942) adds no raw venue-close field, only `bindingLimitMid` and `latestLeaveAt`/`latestLeaveAtState` — claim supported.
  - **Warning age in days**: grepped `BACKLOG.md` — `BL-008` row (2026-09-05) reads "Staleness threshold (P3)... age... without a verdict... `build/refresh.py` must stamp a per-source age" — matches the citation exactly.
  - **Fallback walk minutes**: grepped `docs/superpowers/specs/2026-09-05-review-response-design.md` — Decision 19 is at §8 (line 709), §10 (line 780) lists `planB.travelMinutesMid` as "added — see below" (796-807); also present in PLAN.md's returned-shape table (1937). Citation and resolution both check out.
  - **Recovery-action outcomes**: grepped both design docs and `BACKLOG.md` for "recovery-action"/"refusal button"/"re-running the pipeline" — no hits anywhere. "Still open, not addressed, not backlogged" is accurate.
  - **Seat-log aggregation**: `BL-007` row (2026-09-05) reads "Seat-log aggregation (P2)... nothing reads the rows..." — matches.
  - **Seat-log write path**: grepped `BACKLOG.md` — no separate item for the write path exists; `BL-007` is aggregation, not the write path. "Still open, distinct from BL-007" is accurate.
- Scope check: `git status` shows only `HANDOFF.md`, the frontend design doc, and `reviews/LEDGER.md` modified (LEDGER.md's diff is a routine one-line assignment-log append, not a decision change). `PLAN.md`, `DECISIONS.md`, `web/ranking.js` and every other code file are untouched. Confirmed the diff's edited region stops before `## 6. Product-policy decisions (not decided here)` (items 1-6, i.e. this doc's own policy decisions) — that section and `ARCH-004`'s settled decisions in `PLAN.md`/`DECISIONS.md` are unmodified. No code changes, no re-opened decisions.

### Could not verify

- The migrated shape's fields (`resultState`, `hoursStatus`/`histogramStatus`, `bindingLimitMid`, `planB.travelMinutesMid`, `bestAlternative`, `latestLeaveAtState`, `displayName`/`disambiguatedLabel`, `achievableSessionEndMid`) do not yet exist in `web/ranking.js` — grepped and confirmed absent; only `bindingConstraint`, `hoursTier`, `metricsBasis`, `busynessBand` (with `reason`) are implemented today. This is expected: `ARCH-004` is an approved *design* not yet built (per `BACKLOG.md`'s `ARCH-005`/slice sequencing), and the assignment's required verification is explicitly "diff §5 against `PLAN.md`'s sections" (design-to-design), not against runtime code — so this is not a defect in IMP-016's work, just a fact worth the primary/user knowing before slice 4 build starts.

### Not asked to check

- The new §5 preface's dating and wording quality (not part of acceptance criteria).
- §7-§9 of the frontend design doc (prototype-to-production translation, acceptance checklist) — untouched by the diff and outside this reconciliation's scope.
- Whether `BL-007`/`BL-008`'s priority levels (P2/P3) are themselves well-calibrated — only that the citations accurately describe the rows.

### Status

`GATE_PASS`

---
