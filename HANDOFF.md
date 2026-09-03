# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-012`
- **Work type**: implementation
- **State**: `user_approved` — user approved after round-3 `APPROVE`; committing correction, then closing
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, medium
- **Route triggers**: negative/fail-closed paths and non-vacuity proof — `</script>` JSON-escaping round-trip, module-inlining top-level-scope-collision, venues/meta ID-mismatch (both directions), `holidays.json`-absent failure, and additive changes (round 1 + its correction) to `rankVenues()`'s and `resolveReturnBound()`'s settled output shapes (`WORKFLOW.md` hard triggers)
- **Baseline commit**: `3db87d9`
- **Artifact under review**: unchanged from round 1 (`build/generate.py`, `web/app.js`'s round-1 state, `web/index.template.html`, `web/style.css`, `web/manifest.webmanifest`, `tests/python/test_generate.py` + fixture) plus round-1 + round-2 corrections, all uncommitted, cumulative diff from `80c423c`: `web/ranking.js` (+88/-43 — round 1's field-threading plus round 2's fix: `resolveOverallFeasibilityAtArrivals`'s unverified-return branch now derives `bindingConstraint` from `hoursResult.latestLeaveAt`'s 3-state outcome instead of hard-coding `"venue_close"`), `web/app.js` unchanged since round 1 (+68/-25 total, 0 this round — its label map already handled the fix's `"none"` output), `tests/js/ranking.test.js` (+140/-9 — round 1's fixes/additions plus round 2's: 1 flawed test replaced, 1 new finite-hours regression added). See `reviews/IMP-012.md`'s round-2 primary response for the full trace.
- **Objective**: Phase 1 step 6 (`PLAN.md`'s "Phase 1 implementation order" / "Frontend: plain HTML, no framework") — hand-written frontend shell (`app.js`, `index.template.html`, `style.css`) plus a fixture-driven generator merging `venues.json`+`venues_meta.json` by id and inlining data/code/styles into a self-contained `web/index.html`
- **Scope exclusions**: `build/refresh.py` wiring / `Makefile` target (step 7); live refresh (step 8); `holidays.json` maintenance; visit-history UI (Phase 2, not started)
- **Acceptance criteria**: met — module-inlining contract (import stripped, no collisions, verified against the real files); `<` escaped as the 6-char JSON unicode escape with a `</script>`-round-trip test; venues/meta merge with ID-mismatch failure both directions; `app.js` DOM-only, one state object, one `render(state)`; no `fetch()`/`localStorage`/external refs beyond the optional manifest; all paths relative; every automatable "Generated-artifact acceptance" bullet (`PLAN.md` line ~2429) checked against the real generated page. **Deferred, not automated** (gate-flagged; all three stay on the manual acceptance checklist): the malformed-band removal-notice runtime-render check; `file://` visual rendering; and the page "renders and functions correctly when [the manifest] is removed" — structurally implied by the no-fetch/DOM-only checks but not runtime-exercised. No headless-DOM test runtime exists in this repo. **Round-1 correction**: `PLAN.md:1754`/`2263-2265`'s full per-row field set (both feasibility tiers, named binding constraint + return mode, `latest_leave_at`, preference, `backup_strength`) is now rendered on Plan A and every alternative row, not just the composed tier — see `reviews/IMP-012.md`
- **Required verification**: `.venv/bin/pytest tests/python/ -q` — 161 passed, 0 failed; `node --test tests/js/*.test.js` — 184 passed, 0 failed (183 − 1 replaced + 2 new); `git status` confined to the artifact list above plus `HANDOFF.md`/`reviews/IMP-012*`/`reviews/LEDGER.md` — **not yet committed**, per this correction's explicit instruction
- **Claude gate result**: `GATE_PASS` (invocation 1)
- **Independent review**: round 1 `CHANGES_REQUESTED` (`IMP-012-R1-F01`) → round 2 `CHANGES_REQUESTED` (same finding, fix incomplete: `bindingConstraint` hard-coded `"venue_close"` even when hours were `COVERED`) → round 3 `APPROVE` — `IMP-012-R1-F01` `resolved` (`reviews/IMP-012.md` round 3's resolution table)
- **Gate evidence**: `reviews/IMP-012-gate.md`
- **Review record**: `reviews/IMP-012.md`
- **User decision**: approved — user authorized commit and close after round-3 `APPROVE`
- **Next action**: commit the correction, then mark `completed`
