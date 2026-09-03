# Gate record: ARCH-003

## Verification performed

**Repo state**
- `git status --short` — modified: `BACKLOG.md`, `CLAUDE.md`, `HANDOFF.md`, `PLAN.md`, `reviews/LEDGER.md` (all uncommitted, nothing staged/committed).
- `git diff dde868b --stat -- PLAN.md CLAUDE.md HANDOFF.md reviews/LEDGER.md` — `CLAUDE.md` +20/-2, `HANDOFF.md` +31/-... (full rewrite of the assignment block), `PLAN.md` +293/-... , `reviews/LEDGER.md` +1.
- Read `HANDOFF.md`'s diff in full — matches the mechanically-generated brief (ID, route, baseline commit, artifact list, acceptance criteria, required verification all consistent).

**Source spec**
- Read `docs/superpowers/specs/2026-09-04-outbound-mirror-design.md` in full (389 lines), including its own revision log (4 rounds: pre-dawn/holiday-overclaim fix + Decision 7 → venue-wide status rejected in favor of per-origin/mode → per-origin/mode also rejected in favor of diagnostics-only/no-stamp-at-query-time → `outbound_data_error` split from `outbound_gap` + `pre_dawn_gap` decoupled from the resolver call). Treated the final (4th-revision) text as authoritative per the task brief.

**PLAN.md**
- Read the full new "## Getting there: outbound-mirror transport" section, `PLAN.md:1525`–`1792` (through to the end of "## The ranking pipeline" item 1 and the two following subsections).
- Read the `data/venues_meta.json` data-contract section, `PLAN.md:2100`–`2163`, including the new `outbound_transport` example block (`2129`–`2136`) and its prose row (`2161`).
- Read the "## Open questions" resolution, `PLAN.md:2791`–`2810` (specifically line `2807`).
- Read the "## Testing" section additions, `PLAN.md:2586`–`2709` — the `tests/js/` bullets (`2661`–`2665`), the `tests/python/` bullet (`2680`), the generated-artifact bullet (`2694`), and the manual-checklist item (`2707`).
- Grepped `^### ` headings for duplicates: `grep -n "^### " PLAN.md | sort -t: -k2 | uniq -f1 -D` → **empty output, no duplicates** (the two duplicates found during drafting are confirmed fixed).
- Checked for stale `PLAN.md:NNN`-style line citations inside the new outbound section itself: none found (`grep -n "PLAN.md:" ` over lines 1525–1792 returned nothing) — the transcription correctly uses section names rather than brittle line numbers for its own new content.
- Spot-checked named cross-references from the new section against where they claim to point:
  - `"Inputs"` (line 1529) → `### Inputs` exists at `PLAN.md:310`. ✓
  - `"The core service span waives the timetable lookup, never the route"` (lines 1497, 2803) → heading exists at `PLAN.md:1109`. ✓
  - `"The pre-dawn gap is not modelled"` (line 1512, via `What this design deliberately does not do`) → heading exists at `PLAN.md:1254`. ✓
  - `"One entry point, pure, whole-dataset"` (ranking-pipeline step 2, line 1769) → heading exists at `PLAN.md:1807`. ✓
  - "the return leg's step 2" / "the return leg's step 3" (outbound pseudocode comments, lines 1632, 1640) → cross-checked against the return leg's own numbered pseudocode in "Evaluating one bound" (`PLAN.md:1167`–`1266`): step 2 is the schedule-free check, step 3 is the core-span waiver. **Numbering matches exactly** — the outbound function's own step 1/2 correctly cite the return leg's absolute step 2/3, since the outbound function has no separate "step 1" route-prerequisite step of its own (it's an unrenumbered precondition).

**CLAUDE.md**
- Read the full "### Getting there (outbound-mirror transport)" section and the testing-paragraph additions (both already present in the live file per the system-provided full CLAUDE.md contents; independently cross-checked every claim in it against the spec, see checklist below).

**Constant rename**
- `grep -n "RETURN_CORE_FROM_MINUTES\|RETURN_CORE_UNTIL_MINUTES\|RETURN_SERVICE_DAY_START_MINUTES" PLAN.md CLAUDE.md` → **no matches** (exit code 1), confirming zero remaining old-name occurrences in either file.
- `grep -n "SERVICE_CORE_FROM_MINUTES\|SERVICE_CORE_UNTIL_MINUTES\|SERVICE_DAY_START_MINUTES" PLAN.md CLAUDE.md` → spot-checked every occurrence (16 lines across both files): all read correctly in context, no corrupted/garbled names, no duplicated constant, surrounding prose intact at each site (constants table, pseudocode, "New constants" table, open-questions resolution, both files' testing paragraphs).

**Test suites (independently rerun from repo root)**
- `.venv/bin/pytest tests/python/ -q` → `188 passed in 1.56s`. Matches the pre-existing count exactly.
- `node --test tests/js/*.test.js` → `# tests 184`, `# pass 184`, `# fail 0`. Matches the pre-existing count exactly.
- No production code (`ranking.js`, `build/refresh.py`) is touched by this diff (confirmed via the `git diff --stat` above — only `PLAN.md`/`CLAUDE.md`/`HANDOFF.md`/`reviews/LEDGER.md` changed), consistent with the unchanged counts.

## Faithfulness checklist (spec → transcription)

| Check | Spec (final revision) | PLAN.md / CLAUDE.md | Result |
| --- | --- | --- | --- |
| Hard filter, never folded into `overall_tier` | Decision 1 | `PLAN.md:1541,1549`, ranking pipeline step 1 (`PLAN.md:1768`); CLAUDE.md "a hard filter... never folded into `overall_tier`" | Match |
| `outbound_transport_status` diagnostics-only, never gates ranking at any granularity; `resolve_outbound_service` sole runtime authority | "Validation stage" §, lines 254–293 | `PLAN.md:1692–1709`; CLAUDE.md line "the one and only runtime check lives inside `resolve_outbound_service`" | Match |
| Two distinct exclusion labels (`outbound_gap` vs `outbound_data_error`) | 4th-revision "Pipeline integration" §, lines 320–331 | `PLAN.md:1734–1742`; CLAUDE.md "Two exclusion labels, not one" | Match |
| Pessimistic edge is the band's **lower** (`lo`) edge | "Which edge of the band is pessimistic" §, lines 236–240 | `PLAN.md:1662,1675`; CLAUDE.md "same pessimistic-lower-edge rule" | Match |
| `pre_dawn_gap` decided at step 3 by clock alone, before `resolve_outbound_service` is ever called | 4th-revision correction, lines 34–37, 310–313 | `PLAN.md:1646–1649,1728–1730` | Match |
| Holiday-field reuse is the narrow date-level-classification claim, not shared physical route | Decision 5, lines 88–102 | `PLAN.md:1586–1597,2161`; CLAUDE.md "assumes only a shared date-level service-day classification... never a shared physical route" | Match |
| Outbound-cycling asymmetry intentional; `RETURN_CYCLE_LATEST_MINUTES` is a safety/personal-policy constraint out of scope | Decision 7 | `PLAN.md:1755–1760`, constants table `1500–1501`; CLAUDE.md "this asymmetry with the return leg is intentional, not an oversight" | Match |
| `outbound_transport` keyed by origin (`home`/`office`), not destination | "Data contract" §, lines 149–151 | `PLAN.md:1581–1584,2161`; CLAUDE.md "keyed by origin, not destination" | Match |
| No trace of the two rejected architectures (venue-wide stamp, per-origin/mode stamp) surviving as current | 2nd/3rd revision notes | Both mentions in `PLAN.md:1699–1702,2807` and `CLAUDE.md:70` are explicitly framed as rejected/historical ("were tried and rejected", "two coarser attempts... both proved unsound") | Match |

## Other checks

- Markdown structure: no duplicate `###` headings in `PLAN.md`.
- `data/venues_meta.json` example in the data-contract section matches the spec's example block verbatim (`PLAN.md:1558–1572` and `2129–2136`).
- Test-list additions in both `tests/js/`/`tests/python/`/generated-artifact/manual-checklist sections cover every item the spec's "What this forces elsewhere" section calls for, including the progressively-finer-grained scoping-correction cases (malformed `office` entry, malformed `by_weekday.fri` vs. untouched `default`, schedule-free/core-span never calling the resolver, and the never-reads-`outbound_transport_status` assertion).
- `BACKLOG.md` also shows an uncommitted diff (`BL-002`, a UI/UX backlog item dated 2026-09-04) that is not part of ARCH-003's declared artifact list. This appears unrelated to the outbound-mirror transcription and does not contradict any acceptance criterion; noting it only as an out-of-scope observation, not a gate finding.

## Findings

None. No contradiction between the approved spec's final (4th-revision) state and the `PLAN.md`/`CLAUDE.md` transcription was found. The constant rename is complete and uncorrupted. Both required test suites pass at their pre-existing counts. No duplicate headings remain. All spot-checked cross-references resolve to real, correctly-named sections.

GATE_PASS
