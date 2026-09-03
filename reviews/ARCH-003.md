# Review record: ARCH-003

## Assignment

- **Assignment ID**: `ARCH-003`
- **Work type**: `architecture/high-level`
- **Primary route**: `claude_sonnet` — Sonnet, effort `high`
- **Reviewer route**: `codex_sol` — Sol, effort `medium`
- **Baseline commit**: `dde868b`
- **Reviewed diff or commit**: uncommitted `PLAN.md` / `CLAUDE.md` diff against `dde868b`; SHA-256 `464059d5fc5f817d9c05e81b8070d0c8e2ba0de7927ba164d15e7d7dff25a155`
- **Scope**: initial repo-grounded review of the outbound-mirror design transcription into `PLAN.md` and `CLAUDE.md`; implementation, venue-data curation, lifecycle reconciliation, commit, and push are excluded
- **Finding disposition schema**: `factual-assessment/v1`

## Review round 1 — 2026-09-04

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_sol`
- **Reviewed artifact**: uncommitted `PLAN.md` / `CLAUDE.md` diff against `dde868b`; SHA-256 `464059d5fc5f817d9c05e81b8070d0c8e2ba0de7927ba164d15e7d7dff25a155`

### Resolution of prior findings

None — first review round.

### Findings

#### `ARCH-003-R1-F01` — Medium — The main pipeline contract omits outbound exclusions and contradicts their required visible-removal path

- **Status at issuance**: `open`
- **Evidence**: The settled design requires every outbound failure to be a hard exclusion with a user-facing label: `pre_dawn_gap`, `missing_data`, and `after_last_departure` surface as `"outbound_gap"`, while `invalid_metadata` surfaces as `"outbound_data_error"` (`docs/superpowers/specs/2026-09-04-outbound-mirror-design.md:295-331`; transcribed at `PLAN.md:1717-1742`). But the load-bearing whole-dataset entry-point sequence still moves directly from travel-band parsing to return-status removal and evaluation, with no outbound-admissibility stage (`PLAN.md:1811-1819`). Its table is still declared exhaustive (`PLAN.md:1823`) but has no row for either outbound removal class (`PLAN.md:1825-1840`). The nearest existing analogy is missing `access[origin][mode]`, which the same table says is not a candidate at all (`PLAN.md:1831`); the implementation contract likewise says that path is absent even from `removed` (`web/ranking.js:1617-1619`). That conflicts with the new text calling outbound failure “the same treatment as a missing `access` entry” (`PLAN.md:1547-1549`) while also requiring a rendered removal notice and label (`PLAN.md:1734-1742`, `PLAN.md:2694`).
- **Impact**: A future implementation can satisfy the new section while violating the established entry-point contract, or follow the existing missing-access path and silently discard the two required labels. The supposedly exhaustive taxonomy and its one-test-per-row obligation cannot prove either outbound removal path, and the exact insertion point in the single ranking pipeline is left unstated.
- **Recommended correction**: Reconcile the existing integration contract with the settled design: add outbound admissibility to the ordered `rankVenues` ownership sequence after the selected access entry/travel band is confirmed and before downstream evaluation; add explicit exhaustive-taxonomy rows for `"outbound_gap"` and `"outbound_data_error"`, both as visible unranked removals; and qualify “same treatment as missing access” to mean the same hard exclusion from ranking, not the missing-access path’s deliberate omission from removal output. Keep the two labels and their three-versus-one reason mapping unchanged.

### Non-blocking observations

- `BACKLOG.md` has an unrelated pre-existing working-tree modification (`BL-002`). It is outside the declared ARCH-003 artifact and was not attributed to this assignment.
- `outbound_transport_status` is intentionally allowed to have an implementation-chosen diagnostic shape. The normative constraint is that ranking never reads it; the transcription preserves that boundary and names direct non-consumption tests.

### Verification performed

- Read `HANDOFF.md` first, inspected the exact diff against baseline `dde868b`, then read the final four-revision design, the changed `PLAN.md` / `CLAUDE.md` contract surfaces, and the unchanged ranking/refresh/generation code reached by the design.
- Confirmed the design file has the initial commit plus four revisions: `0a7bdfb`, `98f46f8`, `2617e32`, `c89c78d`, `dde868b`.
- Confirmed the core transcription matches the settled design: hard filter rather than tier; origin-keyed data; holiday-classification reuse without a shared-route claim; shared renamed service constants; schedule-free/core-span short-circuits; pre-dawn exclusion before lookup; selected-entry-only runtime validation; diagnostics-only `outbound_transport_status`; lower-edge comparison; intentional outbound-cycling asymmetry; and distinct exclusion labels.
- `rg -n "RETURN_CORE_[A-Z_]*|RETURN_SERVICE_DAY_START_MINUTES" PLAN.md CLAUDE.md` returned no matches.
- `git diff --check dde868b` passed with no diagnostics.
- `.venv/bin/pytest tests/python/ -q` passed: **188 passed in 1.14s**.
- `node --test tests/js/*.test.js` passed: **184 passed, 0 failed**.

### Could not verify

- None.

### User decisions required

- None. The correction follows the already-approved fourth-revision requirement for distinct, visible outbound removal labels and does not reopen the design.

### Recommendation

`CHANGES_REQUESTED`

The transcription is faithful on the design itself, the constant rename is complete, and both unchanged suites pass. Approval is blocked only by `ARCH-003-R1-F01`: the existing whole-dataset pipeline contract and exhaustive taxonomy must be reconciled with the new visible outbound-removal paths before a future implementation can follow one unambiguous contract.

---

## Primary response to review round 1 — 2026-09-04

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Reviewed artifact after response**: uncommitted `PLAN.md` / `CLAUDE.md` diff against `dde868b`; `PLAN.md` SHA-256 `656a57cfef5eb04df10e63b96dc118290fdc69508b2f836760089797b2b17e60` (`CLAUDE.md` unchanged by this correction — SHA-256 `68a688729660137ecadd49a27dd0b97c038a2bb7c7f506d10700343b36909632`, same as round 1)

### Finding dispositions

#### `ARCH-003-R1-F01` — `accepted`

- **Factual assessment**: `confirmed` — independently re-read the exact evidence before accepting, not merely trusting the citation.
- **Independent verification**: read `PLAN.md:1811-1819` (pre-correction) — the whole-dataset ownership sequence went straight from travel-band parsing (step 3) to return-status removal (step 4), with no outbound step. Read `PLAN.md:1823-1840` (pre-correction) — the table declared exhaustive at line 1823 had no row for either `"outbound_gap"` or `"outbound_data_error"`. Read `web/ranking.js:1615-1619` directly — confirmed its doc comment states access-key-missing venues are "absent even from" the `removed` diagnostic array, i.e. invisible by design. Read `PLAN.md:1547-1549` (pre-correction) — confirmed it called outbound exclusion "the same treatment as a missing `access[origin][mode]` entry" with no qualification, which read naturally as importing *all* of that entry's properties, including invisibility. Cross-checked against this section's own later requirement (`PLAN.md:1734-1742` — "Two user-facing labels, not one") that every outbound exclusion must produce a visible removal notice. The two claims are in direct tension as originally written: real defect, not a reviewer misreading.
- **Response**: Accepted as reported. This is a genuine contradiction introduced during transcription, not a design defect — the approved spec (`docs/superpowers/specs/2026-09-04-outbound-mirror-design.md`) never claimed outbound exclusions should be invisible; I reused an established codebase phrase ("same treatment as missing access") to convey "hard filter, not a tier" without checking that the phrase's *full* meaning in this codebase also implies invisibility, which contradicts the spec's own visible-removal-notice requirement. The correction is a documentation reconciliation only: it does not reopen the design, change the hard-filter decision, or touch the three-versus-one reason mapping (`pre_dawn_gap`/`missing_data`/`after_last_departure` → `"outbound_gap"`; `invalid_metadata` → `"outbound_data_error"`), all of which are preserved exactly as approved.
- **Changes made**:
  - `PLAN.md`, "One entry point, pure, whole-dataset": inserted a new step 4, "**Outbound admissibility**," into the ownership sequence, positioned after step 3 (travel-band parsing/arrivals — the point at which the recommended correction said the selected access entry/travel band is confirmed) and before the renumbered step 5 (return-status `STEP 0` removal) and all downstream evaluation. Steps 4–7 renumbered to 5–8.
  - `PLAN.md`, the exhaustive taxonomy table: added two rows — `outbound_admissible` failing with `pre_dawn_gap`/`missing_data`/`after_last_departure` → unranked removal, visible diagnostic, reason `"outbound_gap"`; and failing with `invalid_metadata` → unranked removal, visible diagnostic, reason `"outbound_data_error"`, explicitly distinct from `"outbound_gap"`. Placed immediately after the `return_transport_status` row, which is the row these two actually behave like (visible unranked removal), not the `access[origin][mode]` **missing entirely** row, which behaves oppositely (invisible hard filter).
  - `PLAN.md`, "This is not the return leg reversed" (the `PLAN.md:1547-1549` sentence cited in the finding): rewrote to state the analogy is "the same hard exclusion from ranking," explicitly stopping there, and added a sentence contrasting it with the missing-`access` path's additional, un-shared property of being invisible even in `removed` — outbound exclusions must appear in a visible removal notice instead.
  - `PLAN.md`, "Pipeline integration and exclusion reasons" (opening paragraph): applied the same qualification to its own instance of the ambiguous comparison ("the same category as 'mode isn't viable there'"), and added a pointer to the new ownership-sequence step, since a reader landing on this section alone would otherwise hit the identical ambiguity Codex found in the other section.
  - `CLAUDE.md`: no change. Its existing "Getting there" bullet already said "excluded outright — a hard filter, not a soft tier like `return_tier`" without invoking the ambiguous missing-access comparison at all, so it carried no instance of this defect.
- **Verification**: `.venv/bin/pytest tests/python/ -q` → 188 passed (unchanged); `node --test tests/js/*.test.js` → 184 passed (unchanged); `grep -rn "RETURN_CORE_FROM_MINUTES\|RETURN_CORE_UNTIL_MINUTES\|RETURN_SERVICE_DAY_START_MINUTES" PLAN.md CLAUDE.md` → no matches; `git diff --check dde868b` → clean, no diagnostics; `.venv/bin/python3 .cross-agent-workflow/finding_state.py reviews/ARCH-003.md` → `ARCH-003-R1-F01  open` (expected — this response section is what the reducer reads next; round 2 will record it `resolved`).

### User-directed revisions

- None.

### User decisions required

- None.

### Re-review readiness

- **Ready for re-review**: yes
- **Reason**: The correction is bounded to reconciling two already-approved, unchanged decisions (the hard-filter treatment and the two-label reason mapping) with the pre-existing pipeline contract's ownership sequence and taxonomy table. No new behavior, policy, or design question is introduced; both test suites and the constant-rename grep are unchanged and clean.

```text
Run as: Codex Terra, effort medium   (gpt-5.6-terra)
Why: ARCH-003 round-2 correction re-review — ordinary docs correction against an already-agreed contract (WORKFLOW.md's correction-delta table); round 1 recorded an empty Could not verify with all required checks performed first-hand, so de-escalation from codex_sol is permitted.
Conversation: CONTINUE — same reviewer thread, already has the round-1 findings.
Action: Review ARCH-003
Review phase: REPO VALIDATION
Goal: transcribe the approved outbound-mirror design (`docs/superpowers/specs/2026-09-04-outbound-mirror-design.md`, 4 revisions, user-approved) into `PLAN.md`/`CLAUDE.md`
```

---

## Review round 2 — 2026-09-04

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_terra`
- **Runtime model verification**: per the standing constant in `WORKFLOW.md`; the user's `codex_terra`, effort medium route selection is relied on because the runtime exposes no independent model signal
- **Reviewed artifact**: targeted correction in `PLAN.md` against `dde868b`; current `PLAN.md` SHA-256 `656a57cfef5eb04df10e63b96dc118290fdc69508b2f836760089797b2b17e60`; `CLAUDE.md` unchanged by the correction at SHA-256 `68a688729660137ecadd49a27dd0b97c038a2bb7c7f506d10700343b36909632`

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-003-R1-F01` | `unresolved` | The correction fixes the missing ownership step, adds both taxonomy rows, and clearly distinguishes outbound removals from the invisible missing-access path (`PLAN.md:1548-1554`, `PLAN.md:1724-1732`, `PLAN.md:1821-1830`, `PLAN.md:1834-1853`). However, its corrected lines call `"outbound_gap"` / `"outbound_data_error"` the removal **reason** (`PLAN.md:1826`, `PLAN.md:1844-1845`). The approved fourth-revision contract instead distinguishes four internal reasons (`pre_dawn_gap`, `missing_data`, `invalid_metadata`, `after_last_departure`) from two user-facing labels and explicitly requires all four reasons to remain individually available for diagnostics (`docs/superpowers/specs/2026-09-04-outbound-mirror-design.md:302-331`). That distinction is load-bearing in the present repository: `rankVenues` removal records already have separate `{ venueId, reason, kind }` fields (`web/ranking.js:1617-1619`), and `app.js` currently renders `removal.reason` (`web/app.js:221-224`). The corrected taxonomy therefore still admits an implementation that overwrites the internal reason with the label, contrary to the settled contract. Resolve by naming `"outbound_gap"` / `"outbound_data_error"` as the user-facing **label/kind**, preserving the exact internal reason separately, and stating that both remain available on the removal record; apply the same terminology to the new ownership-sequence sentence. |

### Findings

No new findings. `ARCH-003-R1-F01` remains unresolved because its correction still conflates the two outputs whose visible-removal path the finding required the contract to specify.

### Non-blocking observations

- The unrelated `BACKLOG.md` modification remains outside ARCH-003's declared artifact and correction delta.
- The diagnostic-only, implementation-chosen shape of `outbound_transport_status` remains unchanged and outside this correction.

### Verification performed

- Used the typed round-2 extractor: `.venv/bin/python3 .cross-agent-workflow/finding_state.py reviews/ARCH-003.md --emit-chunks --actor reviewer-round2`; pre-review reduced state was `ARCH-003-R1-F01 primary_accepted`.
- Independently checked every corrected location against the original finding, the approved fourth-revision design, and the existing `rankVenues` / renderer result-shape contract.
- Confirmed the primary-reported file hashes exactly: `PLAN.md` `656a57cfef5eb04df10e63b96dc118290fdc69508b2f836760089797b2b17e60`; `CLAUDE.md` `68a688729660137ecadd49a27dd0b97c038a2bb7c7f506d10700343b36909632`.
- `rg -n "RETURN_CORE_[A-Z_]*|RETURN_SERVICE_DAY_START_MINUTES" PLAN.md CLAUDE.md` returned no matches.
- `git diff --check dde868b` passed with no diagnostics.
- `.venv/bin/pytest tests/python/ -q` passed: **188 passed in 1.08s**.
- `node --test tests/js/*.test.js` passed: **184 passed, 0 failed**.

### Could not verify

- None.

### User decisions required

- None. The approved design already requires separate internal reasons and user-facing labels; this is a deterministic documentation correction, not a reopened policy decision.

### Recommendation

`CHANGES_REQUESTED`

The correction fixes the ordering, taxonomy coverage, and missing-access visibility contradiction, but it does not yet preserve the approved reason-versus-label distinction in the corrected integration contract. `ARCH-003-R1-F01` remains unresolved until those two outputs are named separately.

---

## Primary response to review round 2 — 2026-09-04

- **Lifecycle state addressed**: `changes_requested`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Reviewed artifact after response**: uncommitted `PLAN.md` / `CLAUDE.md` diff against `dde868b`; `PLAN.md` SHA-256 `d1daa47c4464a13d3740d380eaffc002af4fecbfe893eb8fb1239aee469de964` (`CLAUDE.md` unchanged — SHA-256 `68a688729660137ecadd49a27dd0b97c038a2bb7c7f506d10700343b36909632`, same as rounds 1–2)

### Finding dispositions

#### `ARCH-003-R1-F01` — `accepted`

- **Factual assessment**: `confirmed` — independently re-read every cited location before accepting.
- **Independent verification**: read `PLAN.md:1826` (pre-correction, per round-2's citation) — it read "removed with a visible diagnostic — reason `"outbound_gap"` or `"outbound_data_error"`", literally naming the label the removal's *reason*. Read `PLAN.md:1844-1845` (pre-correction) — both taxonomy rows said "a visible diagnostic naming the venue and reason `"outbound_gap"`"/`"outbound_data_error"`", same conflation. Read `web/ranking.js:1617-1619` directly — confirmed the existing `removed` shape is `{ venueId, reason, kind }`, two distinct fields already. Read `web/app.js:221-224` directly — confirmed `renderRemovalNotice` currently interpolates `removal.reason` into the rendered text. Read the approved spec at `docs/superpowers/specs/2026-09-04-outbound-mirror-design.md:302-331` directly — confirmed it consistently calls `pre_dawn_gap`/`missing_data`/`invalid_metadata`/`after_last_departure` the four **reasons** and `"outbound_gap"`/`"outbound_data_error"` the two **labels**, and states explicitly: "All four reasons stay individually available for diagnostics regardless of which label surfaces." My round-1 correction had used the spec's own "label" terminology correctly in "Pipeline integration" (`PLAN.md:1734-1742`, unaffected by this finding) but reintroduced the conflation in the two locations round 2 cites. Confirmed real: the correction was incomplete, not fully applying the vocabulary it had already gotten right elsewhere in the same section.
- **Response**: Accepted as reported. I do not commit to which literal field of the existing `{ venueId, reason, kind }` shape ultimately carries which value (label vs. specific reason) — that is an implementation decision for the future `IMP-###` work this assignment explicitly excludes, and prescribing it here would overstep this assignment's own stated scope. What I *am* stating, per the approved spec and the recommended correction, is the contract: the specific internal reason and the user-facing label are two separate values that must both be retained on the removal record, never collapsed into one string — and that the existing two-field shape already accommodates this without a schema change. Design, hard-exclusion behavior, ordering, and the three-versus-one label mapping are unchanged.
- **Changes made**:
  - `PLAN.md`, ownership-sequence step 4 ("Outbound admissibility"): rewrote to state the removal record preserves "two separate values, never collapsed into one" — the exact internal reason and the user-facing label — explicitly citing the existing `{ venueId, reason, kind }` shape as already accommodating both.
  - `PLAN.md`, both new taxonomy rows: rewrote each to name the venue, **the specific internal reason**, and **the user-facing label** as three separate pieces of the same visible diagnostic, with "both retained, never collapsed into one string" stated on the `outbound_gap` row and "both retained" on the `outbound_data_error` row.
  - Verified no other location introduced by round 1 carries the same conflation: "Pipeline integration and exclusion reasons" (`PLAN.md:1734-1742`) and `CLAUDE.md`'s "Two exclusion labels, not one" bullet both already say "surface as" / "labels", never "reason" — confirmed clean, left unchanged.
  - `CLAUDE.md`: no change — independently verified it carries no instance of this conflation (checked every `outbound_gap`/`outbound_data_error` occurrence directly).
- **Verification**: `.venv/bin/pytest tests/python/ -q` → 188 passed (unchanged); `node --test tests/js/*.test.js` → 184 passed (unchanged); stale-constant grep → no matches; `git diff --check dde868b` → clean; `.venv/bin/python3 .cross-agent-workflow/finding_state.py reviews/ARCH-003.md` → `ARCH-003-R1-F01  reviewer_unresolved` (expected — reflects round 2's recorded status; this response is what round 3 reduces next).

### User-directed revisions

- None.

### User decisions required

- None.

### Re-review readiness

- **Ready for re-review**: yes
- **Reason**: Narrow, mechanical terminology correction — renaming what two sentences called a removal's "reason" to correctly call it a "label", and adding one clause stating both the label and the specific internal reason are retained together. No design, behavior, or mapping change. Round 2's own verification was performed first-hand with an empty `Could not verify`.

```text
Run as: Codex Terra, effort low   (gpt-5.6-terra)
Why: ARCH-003 round-3 correction re-review — exact, deterministic text-or-format fix against an already-agreed contract (WORKFLOW.md's correction-delta table); round 2 recorded a named unresolved risk (ARCH-003-R1-F01) and performed all verification first-hand with an empty Could not verify, so the lightweight tier applies.
Conversation: CONTINUE — same reviewer thread, already has both prior rounds' findings.
Action: Review ARCH-003
Review phase: REPO VALIDATION
Goal: transcribe the approved outbound-mirror design (`docs/superpowers/specs/2026-09-04-outbound-mirror-design.md`, 4 revisions, user-approved) into `PLAN.md`/`CLAUDE.md`
```

---

## Review round 3 — 2026-09-04

- **Lifecycle state reviewed**: `review_requested`
- **Reviewer route**: `codex_terra_low`
- **Runtime model verification**: the user's Codex Terra, effort low route selection is relied on because the runtime exposes no independent model signal
- **Reviewed artifact**: targeted round-2 correction in `PLAN.md` against `dde868b`; current `PLAN.md` SHA-256 `d1daa47c4464a13d3740d380eaffc002af4fecbfe893eb8fb1239aee469de964`; `CLAUDE.md` unchanged at SHA-256 `68a688729660137ecadd49a27dd0b97c038a2bb7c7f506d10700343b36909632`

### Resolution of prior findings

| Finding ID | Status | Evidence |
| --- | --- | --- |
| `ARCH-003-R1-F01` | `resolved` | The ownership sequence now requires each failed outbound candidate's visible removal record to preserve two separate values: the exact internal reason (`pre_dawn_gap`, `missing_data`, `invalid_metadata`, or `after_last_departure`) and the user-facing label (`outbound_gap` or `outbound_data_error`), explicitly never collapsed and consistent with the existing `{ venueId, reason, kind }` shape (`PLAN.md:1821-1830`). Both taxonomy rows likewise require the venue, specific internal reason, and user-facing label to remain available together (`PLAN.md:1844-1845`). This matches the approved fourth-revision contract (`docs/superpowers/specs/2026-09-04-outbound-mirror-design.md:302-331`) and closes the only named risk without prescribing a future implementation's literal field mapping. |

### Findings

No findings.

### Non-blocking observations

- The unrelated `BACKLOG.md` modification remains outside ARCH-003's declared artifact and correction delta.
- The diagnostic-only, implementation-chosen shape of `outbound_transport_status` remains unchanged and outside this correction.

### Verification performed

- Used the typed round-2 extractor before review: `.venv/bin/python3 .cross-agent-workflow/finding_state.py reviews/ARCH-003.md --emit-chunks --actor reviewer-round2`; reduced state was `ARCH-003-R1-F01 primary_accepted`.
- Independently checked the corrected ownership and taxonomy text against the approved fourth-revision design and the existing `{ venueId, reason, kind }` removal shape.
- Confirmed file hashes: `PLAN.md` `d1daa47c4464a13d3740d380eaffc002af4fecbfe893eb8fb1239aee469de964`; `CLAUDE.md` `68a688729660137ecadd49a27dd0b97c038a2bb7c7f506d10700343b36909632`.
- `rg -n "RETURN_CORE_[A-Z_]*|RETURN_SERVICE_DAY_START_MINUTES" PLAN.md CLAUDE.md` returned no matches.
- `git diff --check dde868b` passed with no diagnostics.
- `.venv/bin/pytest tests/python/ -q` passed: **188 passed in 1.05s**.
- `node --test tests/js/*.test.js` passed: **184 passed, 0 failed**.

### Could not verify

- None.

### User decisions required

- The user decides whether to approve ARCH-003. Review approval does not authorize implementation, commit, or push.

### Recommendation

`APPROVE`

The deterministic correction preserves the approved distinction between four internal reasons and two user-facing labels at every location implicated by `ARCH-003-R1-F01`. The prior finding is resolved, no new finding was introduced, and all required checks pass first-hand.

---
