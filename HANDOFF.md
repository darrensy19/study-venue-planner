# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-012`
- **Work type**: implementation
- **State**: `review_requested`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, medium
- **Route triggers**: negative/fail-closed paths and non-vacuity proof — `</script>` JSON-escaping round-trip, module-inlining top-level-scope-collision, venues/meta ID-mismatch (both directions), `holidays.json`-absent failure, and an additive 2-field change to `rankVenues()`'s settled output shape (`WORKFLOW.md` hard triggers)
- **Baseline commit**: `3db87d9`
- **Artifact under review**: new `build/generate.py`, `web/app.js`, `web/index.template.html`, `web/style.css`, `web/manifest.webmanifest`, `tests/python/test_generate.py` + `tests/python/fixtures/generate/template.html`; 2-line additive change to `web/ranking.js`'s `rankVenues()` (adds `baselineSeatability`/`busynessBand` to each candidate — needed for CLAUDE.md's "baseline and adjustment shown separately" rule, which the prior shape didn't expose; no existing field, behaviour, or test changed — all 178 pre-existing `tests/js/` pass unmodified)
- **Objective**: Phase 1 step 6 (`PLAN.md`'s "Phase 1 implementation order" / "Frontend: plain HTML, no framework") — hand-written frontend shell (`app.js`, `index.template.html`, `style.css`) plus a fixture-driven generator merging `venues.json`+`venues_meta.json` by id and inlining data/code/styles into a self-contained `web/index.html`
- **Scope exclusions**: `build/refresh.py` wiring / `Makefile` target (step 7); live refresh (step 8); `holidays.json` maintenance; visit-history UI (Phase 2, not started)
- **Acceptance criteria**: met — module-inlining contract (import stripped, no collisions, verified against the real files); `<` escaped as the 6-char JSON unicode escape with a `</script>`-round-trip test; venues/meta merge with ID-mismatch failure both directions; `app.js` DOM-only, one state object, one `render(state)`; no `fetch()`/`localStorage`/external refs beyond the optional manifest; all paths relative; every automatable "Generated-artifact acceptance" bullet (`PLAN.md` line ~2429) checked against the real generated page. **Deferred, not automated** (gate-flagged; all three stay on the manual acceptance checklist): the malformed-band removal-notice runtime-render check; `file://` visual rendering; and the page "renders and functions correctly when [the manifest] is removed" — structurally implied by the no-fetch/DOM-only checks but not runtime-exercised. No headless-DOM test runtime exists in this repo
- **Required verification**: `.venv/bin/pytest tests/python/ -q` — 161 passed, 0 failed; `node --test tests/js/*.test.js` — 178 passed, 0 failed; `git status` confined to the artifact list above plus `HANDOFF.md`/`reviews/IMP-012*`/`reviews/LEDGER.md`
- **Claude gate result**: `GATE_PASS` (invocation 1)
- **Independent review**: pending — round 1 not yet run
- **Gate evidence**: `reviews/IMP-012-gate.md`
- **Review record**: not yet created — reviewer creates `reviews/IMP-012.md` on round 1
- **User decision**: pending
- **Next action**: hand off to Codex Terra for round-1 review
