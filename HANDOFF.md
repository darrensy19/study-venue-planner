# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-012`
- **Work type**: implementation
- **State**: `completed`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, medium
- **Route triggers**: negative/fail-closed paths and non-vacuity proof — `</script>` JSON-escaping round-trip, module-inlining top-level-scope-collision, venues/meta ID-mismatch (both directions), `holidays.json`-absent failure, and additive changes (round 1 + its correction) to `rankVenues()`'s and `resolveReturnBound()`'s settled output shapes (`WORKFLOW.md` hard triggers)
- **Baseline commit**: `3db87d9`
- **Artifact under review**: `build/generate.py`, `web/app.js`, `web/index.template.html`, `web/style.css`, `web/manifest.webmanifest`, `web/ranking.js` (additive candidate-shape extension), `tests/python/test_generate.py` + fixture, `tests/js/ranking.test.js` extensions — committed `80c423c` (initial) + `992f513` (round-1/2 correction, user-approved after round-3 `APPROVE`)
- **Objective**: Phase 1 step 6 (`PLAN.md`'s "Phase 1 implementation order" / "Frontend: plain HTML, no framework") — hand-written frontend shell (`app.js`, `index.template.html`, `style.css`) plus a fixture-driven generator merging `venues.json`+`venues_meta.json` by id and inlining data/code/styles into a self-contained `web/index.html`
- **Scope exclusions**: `build/refresh.py` wiring / `Makefile` target (step 7); live refresh (step 8); `holidays.json` maintenance; visit-history UI (Phase 2, not started)
- **Acceptance criteria**: met — module-inlining contract (import stripped, no collisions, verified against the real files); `<` escaped as the 6-char JSON unicode escape with a `</script>`-round-trip test; venues/meta merge with ID-mismatch failure both directions; `app.js` DOM-only, one state object, one `render(state)`; no `fetch()`/`localStorage`/external refs beyond the optional manifest; all paths relative; every automatable "Generated-artifact acceptance" bullet (`PLAN.md` line ~2429) checked against the real generated page. **Deferred, not automated** (gate-flagged; all three stay on the manual acceptance checklist): the malformed-band removal-notice runtime-render check; `file://` visual rendering; and the page "renders and functions correctly when [the manifest] is removed" — structurally implied by the no-fetch/DOM-only checks but not runtime-exercised. No headless-DOM test runtime exists in this repo. **Round-1 correction**: `PLAN.md:1754`/`2263-2265`'s full per-row field set (both feasibility tiers, named binding constraint + return mode, `latest_leave_at`, preference, `backup_strength`) is now rendered on Plan A and every alternative row, not just the composed tier — see `reviews/IMP-012.md`
- **Required verification**: `.venv/bin/pytest tests/python/ -q` — 161 passed, 0 failed; `node --test tests/js/*.test.js` — 184 passed, 0 failed
- **Claude gate result**: `GATE_PASS` (invocation 1)
- **Independent review**: round 1 `CHANGES_REQUESTED` (`IMP-012-R1-F01`) → round 2 `CHANGES_REQUESTED` (same finding, fix incomplete) → round 3 `APPROVE` — `IMP-012-R1-F01` `resolved`
- **Gate evidence**: `reviews/IMP-012-gate.md`
- **Review record**: `reviews/IMP-012.md`
- **User decision**: approved — user authorized commit and close after round-3 `APPROVE`
- **Next action**: None — terminal. A new task requires a new assignment ID.
