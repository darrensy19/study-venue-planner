# Gate record: IMP-012

## Gate invocation 1 — 2026-09-03

- **Gate route**: `claude_sonnet`, effort high
- **Brief source**: generated from HANDOFF.md acceptance criteria + required verification

### Checks run

- `git status --porcelain` — matches the brief's artifact list exactly: modified `HANDOFF.md`,
  `web/ranking.js`; untracked `build/generate.py`, `tests/python/fixtures/generate/`,
  `tests/python/test_generate.py`, `web/app.js`, `web/index.template.html`,
  `web/manifest.webmanifest`, `web/style.css`. No `reviews/LEDGER.md` change and no other stray
  files.
- `git diff -- HANDOFF.md web/ranking.js` — read in full. The `web/ranking.js` hunk is exactly 2
  added lines inside the existing `candidates.push({...})` object literal in `rankVenues()`
  (`baselineSeatability: venue.baseline_seatability,` and `busynessBand: busyness,`); nothing else
  in the file is touched. `HANDOFF.md`'s diff is the assignment-state update described in the brief.
- Read in full: `build/generate.py` (316 lines), `web/app.js` (320 lines),
  `web/index.template.html`, `web/style.css`, `web/manifest.webmanifest`,
  `tests/python/test_generate.py` (423 lines), `tests/python/fixtures/generate/template.html`.
- Read governing `PLAN.md` sections: "The generated page is self-contained" / "The module inlining
  contract" / "Escaping embedded JSON" (lines 99-158), "Frontend: plain HTML, no framework" /
  "Constraints — write vanilla in a React-shaped way" (lines 1742-1767), "Data contracts" merge
  rules (lines 1769-1777), and "Generated-artifact acceptance" (lines 2429-2452). Read `CLAUDE.md`'s
  `seat_confidence` non-negotiable ("The UI must always show baseline and adjustment separately").
- Independently reran `.venv/bin/pytest tests/python/ -q` from repo root — **161 passed, 0 failed**,
  matching the brief.
- Independently reran `node --test tests/js/*.test.js` from repo root — **178 passed, 0 failed**,
  matching the brief.
- `merge_venues` id-mismatch, both directions: read `build/generate.py:47-71` — computes
  `generated_ids - meta_ids` and `meta_ids - generated_ids` independently and raises
  `GenerationError` naming both sets when either is non-empty. Confirmed exercised by
  `test_merge_venues_fails_on_generated_venue_with_no_meta_entry`,
  `test_merge_venues_fails_on_meta_entry_with_no_generated_venue`, and
  `test_merge_venues_fails_on_mismatch_in_both_directions_at_once` (asserts both `"only-generated"`
  and `"only-meta"` appear in the raised message) — real, non-vacuous assertions, not just
  "raises".
- `to_embedded_json` escaping: read `build/generate.py:74-81` —
  `json.dumps(data).replace("<", "\\u003c")`, matching `PLAN.md`'s six-character escape exactly.
  `test_to_embedded_json_escapes_ordinary_less_than` asserts the literal 6-char output.
  `test_to_embedded_json_round_trips_a_value_containing_script_close_tag` uses a value containing
  the literal string `</script><script>alert(1)</script>`, asserts `"</script>" not in embedded`
  and `json.loads(embedded) == original` — both directions actually checked, not merely "no
  exception."
- `check_no_top_level_collisions` against the real files: `test_check_no_top_level_collisions_passes_for_the_real_project_files`
  reads `web/ranking.js` and `web/app.js` from disk and calls the real function, asserting no
  raise. Independently re-verified by hand: grepped every top-level `const|let|var|function|class`
  declaration in `web/ranking.js` (`MINUTES_PER_DAY`, `WEEKDAYS`, ... through `rankVenues`, ~65
  names) against `web/app.js`'s top-level names (`FEASIBILITY_TOLERANCE_MINUTES`, `ORIGINS`,
  `MODES`, `state`, `el`, `render`, `init`, ...) — no overlap found. The test and this
  independent check agree.
- `web/app.js` DOM-only / no reimplemented logic: read in full. No `fetch(`, no `localStorage`
  anywhere in the file. `readEmbeddedJson` reads only from `document.getElementById(...).textContent`.
  All formatting helpers (`minutesToClock`, `formatMinutesDisplay`, `displayName`,
  `seatConfidenceLine`, `metricsLine`) read fields already computed by `rankVenues()`
  (`candidate.tier`, `candidate.seatConfidence.confidence`, `candidate.busynessBand.band`,
  `candidate.backupStrength`, etc.) and format them as text; none re-derive a tier, ordering, or
  refusal condition. Cross-checked the field shapes against `web/ranking.js`: `resolveBusynessBand`
  returns `{band, ...}` (line 692-734) and `resolveSeatConfidence` returns `{confidence,
  evidenceQuality}` (line 752-763) — both match what `app.js` reads.
- `web/ranking.js` diff additive-only: confirmed directly from the `git diff` output above — the
  two new keys are added inside the existing `candidates.push({...})` literal; no other line of the
  file changed; all 178 `tests/js/` cases pass unmodified.
- Spot-checked "Generated-artifact acceptance" bullets (`PLAN.md` line ~2429) against actual test
  bodies, not names:
  - "no external JS/CSS references" — `test_validate_generated_artifact_fails_on_an_external_script_reference`
    and `..._fails_on_an_external_stylesheet_reference` inject a real `<script src=...>` /
    `<link rel="stylesheet">` into a rendered page and assert `GenerationError`. Real.
  - "no unresolved local imports" — `test_validate_generated_artifact_fails_on_an_unresolved_import`
    injects an `import { helper } from "./other.js";` line into the module text and asserts
    `GenerationError`. Real.
  - "no `fetch()` for bundled data" — `..._fails_on_fetch_in_the_module` injects a literal
    `fetch("./data.json");` and asserts `GenerationError`. Real.
  - "every venue carries `return_transport_status`" —
    `..._fails_when_a_venue_lacks_return_transport_status` uses a venue fixture built without the
    field and asserts the error message names `return_transport_status`;
    `..._passes_when_every_venue_has_return_transport_status` is the positive case. Real, and
    correctly checks *presence*, not any particular value, per the bullet's own wording.
  - "no top-level name collisions" — see above, confirmed against real files.
- CLAUDE.md's seat_confidence non-negotiable: `seatConfidenceLine` in `app.js` renders
  `Baseline: ${candidate.baselineSeatability} · Adjustment: ${adjustmentText} → seat confidence:
  ${candidate.seatConfidence.confidence}` — baseline and adjustment are shown as separate labelled
  components, not collapsed into the conclusion alone. Compliant.
- Formed independent judgment on the "Deferred, not automated" claim (malformed-band
  removal-notice runtime-render check; `file://` visual rendering): checked `package.json` (only
  `{"private": true, "type": "module"}`, no dependencies) and found no `jsdom`/`puppeteer`/
  `playwright` anywhere in the repo — the "no headless-DOM test runtime exists in this repo" claim
  is factually true, not a convenient excuse. Checked that the *data-level* correctness underlying
  the removal notice is already covered elsewhere: `tests/js/ranking.test.js:1963`,
  "taxonomy: return_transport_status absent or not ok is an unranked removal with a visible
  diagnostic," proves `rankVenues()` itself produces the correct `{venueId, reason}` removal entry.
  What's left untested is only `app.js`'s one-line template-string rendering of that already-proven
  data into the DOM (`renderRemovalNotice`), which is trivial and low-risk relative to the logic
  that *is* tested. The manual acceptance checklist (`PLAN.md` line ~2452) explicitly covers both
  deferred items. Judgment: reasonable, clearly-stated scope limitation — not papering over an
  untested defect in the risky part of the logic.

### Could not verify

- The "exactly one external reference ... and the page renders and functions correctly when it is
  removed" clause of the second "Generated-artifact acceptance" bullet: no automated test actually
  removes the manifest `<link>` and confirms the page still functions. This is not called out as
  deferred in HANDOFF.md's acceptance-criteria field (unlike the two items it does name). It is
  *structurally* implied by other confirmed invariants — `app.js` never references the manifest,
  and the "no `fetch()`" / DOM-only checks mean nothing in the JS path depends on it loading — but
  that inference was not independently exercised at runtime, and I flag it as an unlisted gap
  distinct from the two the brief explicitly disclosed.
- Runtime/visual behaviour of the generated page in an actual browser or `file://` context (no
  headless-DOM or browser automation tool available to this gate) — this matches the brief's own
  disclosed deferral and is not a gap the gate could have closed regardless.

### Not asked to check

- The manual acceptance checklist itself (`PLAN.md` line ~2444: iPhone Safari rendering, Add to
  Home Screen from the hosted URL, one-handed readability, etc.) — explicitly deferred to manual
  testing by the brief, not this gate's scope.
- `build/refresh.py` wiring, the `Makefile` target, and live refresh (Phase 1 steps 7-8) — named
  scope exclusions in HANDOFF.md.
- `holidays.json` maintenance and visit-history UI (Phase 2) — named scope exclusions.
- General code style, accessibility beyond what's stated in PLAN.md's non-negotiables, and
  performance — outside the mechanical brief's acceptance criteria and required verification.
- Security review of the generated artifact or the generator script.

### Status

`GATE_PASS`

---
