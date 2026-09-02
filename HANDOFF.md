# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-009`
- **Work type**: implementation
- **State**: `completed`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, medium
- **Route triggers**: correctness depends on a negative/fail-closed path — the broken-bridge-vs-malformed-venue distinction (`PLAN.md`, "The return-validator bridge": a nonzero exit, missing Node, non-JSON stdout, or a venue missing its status must be distinguishable from a per-venue `invalid` result, which is not an error) (`WORKFLOW.md`'s "correctness depends on negative or fail-closed paths" hard trigger)
- **Baseline commit**: `0d5712b`; implementation `112d245`
- **Artifact under review**: `build/validate_return_transport.mjs` (new), `build/return_validator_bridge.py` (new), `tests/python/test_return_validator_bridge.py` (new)
- **Objective**: Phase 1 step 3 (`PLAN.md`, "Phase 1 implementation order") — a narrow Node script that imports the already-implemented `validateReturnTransport()` from `web/ranking.js`, reads a `venues_meta.json` path from argv, and writes structured JSON to stdout; plus a Python wrapper that invokes it via `subprocess.run([...])` and distinguishes a per-venue `invalid` result from a broken-bridge failure
- **Scope exclusions**: `build/refresh.py` orchestration wiring (step 7, not yet built); the `ranking.js` pipeline entry point (step 4); the coarsening stage (step 5); frontend/generator (step 6); no change to `validateReturnTransport()`'s own logic or its existing `tests/js` coverage — settled contract, read-only import
- **Acceptance criteria**: Node script writes **structured JSON and nothing else** to stdout, reads the metadata path handed to it, and calls `validateReturnTransport()` unmodified; every generated venue receives a status, no default or omission; the bridge never writes `venues_meta.json` or anything else; Python wrapper passes the metadata path as an **argv element**, never `shell=True` or a constructed shell string; a per-venue `invalid` status is a **result** (generation continues); Node missing, a nonzero exit, non-JSON stdout, or a missing per-venue status are each a **broken-bridge failure**, distinguishable from the per-venue case, that a caller can use to stop before the atomic replace (`PLAN.md`, "The return-validator bridge")
- **Required verification**: `.venv/bin/pytest tests/python/` — new fixture tests covering a real per-venue `invalid` result, each broken-bridge case (Node missing, nonzero exit, non-JSON stdout, a venue omitted from the output), and a round-trip against `data/venues_meta.json`; `node --test tests/js/*.test.js` as a no-regression check (`validateReturnTransport()` itself is unmodified — 142 passing must stay unaffected); `git status`/`git diff` confined to the new bridge script, the Python wrapper, `tests/python/`, `HANDOFF.md`, `reviews/LEDGER.md`
- **Claude gate result**: `GATE_PASS`
- **Independent review**: `required` — `codex_terra`, medium
- **Gate evidence**: `reviews/IMP-009-gate.md`
- **Review record**: `reviews/IMP-009.md` — round 1 `CHANGES_REQUESTED` (`IMP-009-R1-F01`, accepted and corrected), round 2 `APPROVE` (finding `resolved`, no new findings, one non-blocking observation)
- **User decision**: 2026-09-03 — approved for close.
- **Next action**: None — terminal. A new task requires a new assignment ID.
