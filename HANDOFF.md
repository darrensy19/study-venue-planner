# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-014`
- **Work type**: implementation
- **State**: `draft`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, medium
- **Route triggers**: money / external side effects (`WORKFLOW.md` hard trigger) — this is the first refresh ever run against live Google Places + SerpApi credentials rather than fixtures or stubs
- **Baseline commit**: `01bd0f4`
- **Artifact under review**: none yet — pending: live-refresh output (`data/venues.json`, `web/index.html`), any code fix the live run surfaces, and manual-acceptance evidence
- **Objective**: Phase 1 step 8 (`PLAN.md`'s "Phase 1 implementation order" item 8, lines 2281-2305) — run `make refresh` live for the first time and complete manual acceptance
- **Scope exclusions**: `return_transport`/`holiday_return_policy` hand-curated data fill (separate, privacy-sensitive, out-of-protocol); the outbound-mirror ARCH (deliberately unscoped); no code changes are expected unless the live run surfaces a defect
- **Acceptance criteria**: `PLAN.md` lines 2296-2304 verbatim — a live session ending inside the core span (07:00–21:30) producing Plan A and a Plan B with a viable fallback, needing no `return_transport` data at all; a live session ending outside the core span with none recorded, correctly producing the second refusal rather than a recommendation; the generated `index.html` passing the generated-artifact assertions, opened from `file://`, and read on the iPhone
- **Required verification**: a real `make refresh` run against live credentials producing a valid `data/venues.json` + `web/index.html`; the two live-session UI scenarios above exercised in a browser and on the iPhone (device check needs the user); existing `pytest`/`node --test` suites unaffected
- **Next action**: run `make refresh` live (confirm with the user first — spends real API credits), then walk the manual-acceptance checklist; the `file://` iPhone check is the user's step, not Claude's
