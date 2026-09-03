# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-012`
- **Work type**: implementation
- **State**: `draft`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, medium
- **Route triggers**: correctness depends on negative/fail-closed paths and on proving tests are not vacuous — the `</script>` JSON-escaping round-trip, the module-inlining top-level-scope-collision constraint, the venues/meta ID-mismatch generation-contract failure (both directions), and the manifest-absent fail-open behaviour (`WORKFLOW.md` hard triggers)
- **Baseline commit**: `3db87d9`
- **Artifact under review**: TBD — `web/index.template.html`, `web/app.js`, `web/style.css`, a fixture-driven HTML generator (Python, path TBD), `web/manifest.webmanifest`, plus new `tests/python/` and `tests/js/` cases
- **Objective**: Phase 1 step 6 (`PLAN.md`'s "Phase 1 implementation order" / "Frontend: plain HTML, no framework" / "The generated page is self-contained") — build the hand-written frontend shell (`app.js`, `index.template.html`, `style.css`) plus a fixture-driven generator that merges `venues.json`+`venues_meta.json` by id, inlines data/code/styles per the module-inlining and JSON-escaping contracts, and emits a self-contained `web/index.html`
- **Scope exclusions**: `build/refresh.py` orchestration wiring and the `Makefile` target (step 7); live refresh / manual iPhone acceptance (step 8); `holidays.json` maintenance; no change to `web/ranking.js`'s settled functions
- **Acceptance criteria**: module-inlining contract exact (one `<script type="module">`, import line stripped, no top-level name collisions); `<` escaped as backslash-u-0-0-3-c (six characters, per `PLAN.md`'s "Escaping embedded JSON") in every embedded JSON block, with a `</script>`-containing round-trip test; venues/meta merge by id in Python at generation time, ID mismatch in either direction a hard generation failure; `app.js` is DOM-only — one state object, one `render(state)`, no business rule reimplemented, reads only the `rankVenues()`-shaped pipeline output; no `fetch()`/`localStorage`/external JS or CSS, manifest absent or failing degrades only home-screen install; all paths relative; generated-artifact assertions (code/styles/data present and parseable) pass on a fixture dataset
- **Required verification**: `.venv/bin/pytest tests/python/ -q`; `node --test tests/js/*.test.js`; `git status`/`git diff` confined to the new `web/` files, the generator, `tests/`, `HANDOFF.md`, `reviews/IMP-012*`
- **Claude gate result**: pending
- **Independent review**: pending
- **Gate evidence**: pending
- **Review record**: pending
- **User decision**: pending
- **Next action**: Implement per TDD — fixtures and tests first, then the generator and frontend shell; run the pre-gate before requesting review
