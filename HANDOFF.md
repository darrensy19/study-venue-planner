# Handoff

Current project state, one active assignment, and one next action — nothing else. No rationale;
see `DECISIONS.md` for that. The block below is capped at 25 lines by `WORKFLOW.md`'s boundary
rules; when a field would exceed it, point to `PLAN.md` or the review record instead of expanding.

## Current assignment

- **ID**: `IMP-005`
- **Work type**: implementation
- **State**: `draft`
- **Primary route**: `claude_sonnet` — Sonnet, effort high
- **Verification route**: `codex_terra` — Terra, effort medium
- **Route triggers**: correctness depends on negative/fail-closed paths (malformed vs. not-yet-measured band strings) — same pattern as `IMP-002`/`IMP-003`/`IMP-004`
- **Baseline commit**: `12f7388`
- **Artifact under review**: `web/ranking.js` (new parser) and `tests/js/ranking.test.js`
- **Objective**: Parse `"N-Mm"` travel-band strings (`access[][].band`, `fallbacks[].travel_band`) into `{mid, upper}` minutes — `PLAN.md` "Time, dates and hours resolution" (mid/upper derivation) and "Data contracts" (band format)
- **Scope exclusions**: wiring the parser into `resolveOverallFeasibility`/`evaluatePlanBFallback` (both keep taking pre-resolved minutes, per `IMP-004`'s same exclusion); `build/refresh.py`, `app.js`; selecting/ranking among several fallbacks for one venue
- **Acceptance criteria**: `"N-Mm"` → `mid=(N+M)/2`, `upper=M`; `access[][].band` explicit `null` → defined not-measured sentinel, never throws; `fallbacks[].travel_band` has no stated null case in `PLAN.md` — treated as required whenever a fallback entry exists (a hand-picked link is added complete), so malformed there is a rejection, not a silent guess; any malformed/non-numeric/`N>=M`/missing-`"m"` band string on either field is a rejected, fail-closed result — never silently coerced; pure function, no DOM; covered by `tests/js`
- **Required verification**: `tests/js/` via `node --test tests/js/*.test.js` (never the bare-directory form)
- **Claude gate result**: —
- **Independent review**: `required`
- **Gate evidence**: —
- **Review record**: —
- **User decisions required**: —
- **Next action**: Implement per acceptance criteria (TDD), run required verification, then invoke the pre-gate.
