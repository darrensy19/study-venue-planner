# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-014`
- **Work type**: implementation
- **State**: `review_requested`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, medium
- **Route triggers**: money / external side effects (`WORKFLOW.md` hard trigger) — this is the first refresh ever run against live Google Places + SerpApi credentials rather than fixtures or stubs
- **Baseline commit**: `01bd0f4`
- **Artifact under review**: `data/venues.json` (new, live-refreshed, 28/28 venues: hours `ok`, histogram `ok`, `return_transport_status` `ok`, 0 removed/invalid), `web/index.html` (new, generated from that data, 3 embedded JSON blocks parse cleanly, no `</script>` escaping defect); no code changes — the live run surfaced no defect
- **Objective**: Phase 1 step 8 (`PLAN.md`'s "Phase 1 implementation order" item 8, lines 2281-2305) — run `make refresh` live for the first time and complete manual acceptance
- **Scope exclusions**: `return_transport`/`holiday_return_policy` hand-curated data fill (separate, privacy-sensitive, out-of-protocol); the outbound-mirror ARCH (deliberately unscoped); no code changes are expected unless the live run surfaces a defect
- **Acceptance criteria**: `PLAN.md` lines 2296-2304 verbatim — a live session ending inside the core span (07:00–21:30) producing Plan A and a Plan B with a viable fallback, needing no `return_transport` data at all; a live session ending outside the core span with none recorded, correctly producing the second refusal rather than a recommendation; the generated `index.html` passing the generated-artifact assertions, opened from `file://`, and read on the iPhone
- **Required verification**: `make refresh` run live — 28/28 venues ok, 0 removed; `.venv/bin/pytest tests/python/ -q` — 188 passed; `node --test tests/js/*.test.js` — 184 passed, both independently rerun by the gate; Scenario A (leave 09:00, 5h, Origin B/Transit) and Scenario B (leave 23:00, 5h, Origin B/Walk) both confirmed twice: in a real desktop browser, and — after the gate flagged that a Chromium-viewport stand-in doesn't exercise real WebKit — on the user's actual iPhone in real Safari (served over a temporary local HTTP server, since Files-app Quick Look does not execute the app's JS): no horizontal scroll, Plan A = Starbucks Chinatown Food Street/`robust`/`core_span` for A, exact refusal "...ending at 04:07" for B. Local server torn down after
- **Claude gate result**: `GATE_PASS` (invocation 1, fresh-context subagent) — independently reran both test suites and the `rankVenues()` scenarios itself; flagged the iPhone-substitution gap, since resolved on real device as above
- **Gate evidence**: `reviews/IMP-014-gate.md`
- **Next action**: awaiting Codex (`codex_terra`) review — money/external-side-effects hard trigger requires it even on `GATE_PASS`; no further primary edits until the review returns
