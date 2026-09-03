# Outbound-mirror design: is transport still running *to* the venue at departure time?

**Status:** design approved by the user 2026-09-04, converged out-of-protocol per `WORKFLOW.md`'s
"Architecture exploration happens outside the protocol" — not yet formalized as an `ARCH-###`
assignment. This document is the input to that formalization, not a substitute for it: the actual
reviewable artifact, when this is opened as an assignment, is the diff this design forces into
`PLAN.md` and `CLAUDE.md`, exactly as `ARCH-001` was reviewed against `plan.md`/`CLAUDE.md` directly,
not against a separate spec file. This doc exists to settle the design before that transcription, per
the project's own convention. Revised twice after initial approval — see git history for prior
versions:

- **First revision**: resolved two internal inconsistencies (the `MALFORMED` control-flow
  contradiction between "Evaluation" and "Validation stage"; the holiday-field non-goal overclaiming a
  shared physical route) and closed the one open question (outbound cycling-safety cutoff, resolved as
  Decision 7).
- **Second revision**: corrected the first revision's own overcorrection — it had made
  `outbound_transport_status` a **venue-wide** precondition, which silently contradicted the design's
  positive-evidence rules (a schedule-free mode or a core-span query settles the question without
  reading timetable data at all; a malformed *unrelated* entry must not be able to override that).
  Validity is now scoped **per origin/mode**, consulted only at step 4, with a diagnostics-only
  venue-level rollup. Also softened Decision 5's claim about operator behavior to a stated model
  assumption rather than an empirical claim about network-wide practice.

**Origin:** `PLAN.md`'s "Getting home: session-end return transport" section, "What this design
deliberately does not do", flagged this explicitly: *"It does not model the outbound mirror. Whether
transport still runs to the venue at the departure time is the same question from the other side, and
the same data shape would serve it. It is out of scope here and is flagged as a separate assignment
rather than folded in."* (`PLAN.md:1511-1513`)

## Problem

The tool checks whether a venue is **open** for the whole session and whether transport still runs to
get you **home** at session end (`ARCH-001`, implemented). It never checks the third leg: whether
transport is actually running at the user-chosen `leave_at` to get you **to** the venue in the first
place. `leave_at` is a raw UI input (`PLAN.md:316,323`) with no time-of-day restriction, so a session
planned to start at 02:00 or 05:00 is a real, reachable input today, and nothing currently distinguishes
it from a 15:00 departure.

## Why this isn't simply "reuse `return_transport`'s machinery as-is"

The return leg's dual-bound (`mid`/`upper`) machinery exists because `session_end` is **derived** —
computed from `leave_at + travel_time + duration`, and travel time carries real uncertainty (a band).
`leave_at` itself carries no such derived uncertainty; it is the raw input. So the outbound leg has
no natural "pessimistic bound" to resolve independently the way `session_end_mid`/`session_end_upper`
does. This changes the shape of the mirror substantially: no tier, no dual-bound resolution, no
`overall_tier` composition — see "Decisions" below.

## Decisions

Reached through structured brainstorming; each is a real fork, not a default.

1. **Hard filter, not a soft tier.** When the chosen mode has no confirmed service running at
   `leave_at`, the venue/mode combination is excluded outright — the same treatment as a missing
   `access[origin][mode]` entry today. Rejected: a soft `outbound_tier` folded into `overall_tier` via
   `worse_of()`, mirroring `return_tier`. Reason: the return leg's soft-tier design works because a
   shortened session — "leave earlier" — is genuinely actionable advice for a *return* problem. There
   is no equivalent single-ranking-run fix for a *bad outbound departure*; the only fix is picking a
   different `leave_at`, which the pipeline doesn't do. Ranking the venue but demoting it would risk
   exactly the "confident-looking bad recommendation" `ARCH-001` exists to prevent.
2. **Missing outbound-schedule data is also hard-filtered**, not waved through. Consistent with the
   return leg's core principle — "silence is silence, never a positive." Cost, stated plainly: every
   venue needs a curated outbound entry before it can ever be recommended for an early/late `leave_at`,
   on top of the `return_transport` curation already done (26/28 venues, real manual effort).
3. **The pre-dawn gap (04:00–07:00) is hard-filtered unconditionally**, for a schedule-bound-only mode
   set — no new "first departure" data concept. This deliberately mirrors the return leg's own stance
   ("The pre-dawn gap is not modelled") rather than building the "model the wait" extension `PLAN.md`
   already named as a distinct future assignment for the return side. A schedule-free mode
   (`walk`, or `cycle` where recorded) still settles it immediately — same positive-evidence rule as
   the return leg's step 2.
4. **Data shape is a direct mirror of `return_transport`**, per `PLAN.md`'s own framing ("the same data
   shape would serve it") — see "Data contract" below. No first-departure field, exactly as
   `return_transport` deliberately omits one.
5. **No new holiday field.** `holiday_return_policy` is read directly by the new resolver; no
   `holiday_outbound_policy`. The reuse rests on a narrower claim than "same route": `holiday_return_policy`
   encodes **a date-level service-day classification (weekday / Saturday / Sunday-holiday) that this
   model assumes is shared by the outbound and return legs for the relevant venue/service** — not that
   the two legs travel the same physical route, line, transfers, or service path. This is a stated
   model assumption, not an empirical claim about how transit operators behave network-wide. Reusing
   the field only requires that classification to match between the outbound and return legs — **it
   does not require, and this design does not assume, the same physical route in both directions.**
   The actual `last_departure_band` facts for outbound and return remain independent transport-service
   data and may differ arbitrarily; only the
   holiday-type classification is assumed shared. Precedent for one field governing both legs already
   exists: `wet_weather_mode` substitutes the outbound mode *and* drops `cycle` from the return set.
   The field keeps its existing name (`holiday_return_policy`) despite now governing both directions —
   renaming would touch 26 hand-curated venue records for no functional gain; the dual-purpose is
   called out explicitly in the data contract instead.
6. **The three service-window constants are renamed and shared, not duplicated.** They describe *when
   the network runs*, a fact independent of direction: `RETURN_CORE_FROM_MINUTES` →
   `SERVICE_CORE_FROM_MINUTES`, `RETURN_CORE_UNTIL_MINUTES` → `SERVICE_CORE_UNTIL_MINUTES`,
   `RETURN_SERVICE_DAY_START_MINUTES` → `SERVICE_DAY_START_MINUTES`. Both `resolve_return_service` and
   the new `resolve_outbound_service` read the same three constants. `RETURN_TOLERANCE_MINUTES` and
   `RETURN_CYCLE_LATEST_MINUTES` are **not** renamed or shared — see Decision 7 for why the latter
   stays return-only.
7. **Outbound cycling stays unconditionally schedule-free — no time-of-day cutoff — and this asymmetry
   with the return leg is intentional, not an oversight.** `RETURN_CYCLE_LATEST_MINUTES` encodes a
   safety/personal-policy judgment (riding home alone very late at night), not a
   transport-service-availability fact — it sits outside the domain `outbound_admissible` governs,
   which is purely "does scheduled service exist," the same domain the return leg's
   core-span/pre-dawn logic occupies. A generalized, direction-aware time-of-day cycling-safety policy
   is a real possible future need, but it is a distinct assignment from this transport-availability
   mirror, not folded in here.

## Data contract

A new hand-maintained block in `data/venues_meta.json`, alongside `return_transport` and subject to
the same rules (never written by a script, merged at generation time, bands not exact values):

```json
"outbound_transport": {
  "home": {
    "transit": {
      "default":    {"last_departure_band": "23:20-23:25"},
      "by_weekday": {"fri": {"last_departure_band": "23:50-23:55"}},
      "basis": "last train from the origin's own station toward the venue's line; rechecked 2026-09"
    }
  },
  "office": {
    "transit": {
      "default": {"last_departure_band": "22:40-22:45"}
    }
  }
}
```

| Field | Meaning |
| --- | --- |
| `last_departure_band` | **The latest recorded departure from the origin, using that mode, that can still reach the venue** — a transit-timetable fact (a specific service's departure time), never a computed venue-arrival cutoff. Mirrors `return_transport`'s own `last_departure_band` ("the latest departure from the venue"), just read from the other end of the same journey. Five-minute clock band, same format. |
| *(no first-departure field)* | Deliberately absent, for the same reason `return_transport` omits one — see Decision 3. |
| `by_weekday` | Same shape and precedence as `return_transport`'s: holiday policy → `by_weekday` → `default` → `MISSING`, weekday taken from the **service date**. |
| `basis` | Same free-text, same privacy rule as `return_transport.basis` — no exact times, no line/direction names, no route toward an origin. |
| *(holiday)* | Read from the existing `holiday_return_policy` field — no new field. Documented here, and in `PLAN.md`, as governing **both** the return and outbound legs' timetable substitution, despite the name. |

Keyed by **origin** (`home`/`office`), not by destination — the outbound leg starts from wherever the
session starts, unlike the return leg which always targets `home` regardless of origin
(`PLAN.md:766-771`). Only `transit` needs entries; `walk` and `cycle` stay schedule-free, exactly as on
the return side, and their outbound admissibility already comes for free from the existing
`access[origin][mode]` presence — no new threading needed (see "Composition with existing mechanisms").

## Evaluation

A **total function**, evaluated once (no dual bounds — see "Why this isn't simply reuse"):

```
outbound_admissible(venue, origin, mode, leave_at_abs, service_date) -> PASS | EXCLUDED

# Precondition, established by the EXISTING pipeline stage, not re-checked here:
# access[origin][mode] is present. This function only ever runs for a mode already
# known to have a recorded route -- it answers WHEN service runs, never WHETHER a
# route exists, exactly as the return leg's core-span step answers WHEN, never
# WHETHER (PLAN.md:1120-1131). "Inside the core span -> pass" below means this
# outbound-timetable check passes; it composes with, and never substitutes for,
# that independent reachability filter.
#
# outbound_transport_status is deliberately NOT a whole-function precondition --
# see step 4. Steps 1-3 below never consult it at all. A malformed entry for one
# (origin, mode) pair must never affect a schedule-free candidate, a core-span
# query, or a different origin/mode for the same venue -- see "Validation stage".

clock = leave_at_abs - abs(service_date, 0)

# 1. Schedule-free mode settles it immediately -- positive evidence, no timetable
#    involved. Mirrors the return leg's step 2. No bicycle_with_you gate here: if
#    "cycle" was offered as an outbound mode at all, access[origin]["cycle"] being
#    present already means the bicycle is at that origin -- unlike the return leg,
#    where bicycle_with_you must be threaded because the return destination is
#    fixed (home) regardless of where the trip started.
if mode is schedule-free (walk, or cycle given access[origin]["cycle"] present):
    return PASS(basis: "schedule_free")

# 2. Inside the core service span: waived, exactly as the return leg's step 3 --
#    the route is already established by the precondition; only the timetable
#    lookup is waived.
if SERVICE_CORE_FROM_MINUTES <= clock <= SERVICE_CORE_UNTIL_MINUTES:
    return PASS(basis: "core_span")

# 3. Pre-dawn gap: hard-filtered unconditionally on a schedule-bound-only mode.
#    No data is read. See Decision 3.
if SERVICE_DAY_START_MINUTES <= clock < SERVICE_CORE_FROM_MINUTES:
    return EXCLUDED(reason: "pre_dawn_gap")

# 4. Only now -- and only for THIS (origin, mode) pair -- is outbound timetable
#    data consulted at all. The precondition here is scoped, not venue-wide:
#    outbound_transport_status.by_origin_mode[origin][mode].state == "ok". An
#    "invalid" stamp for THIS pair excludes only this candidate; it says nothing
#    about a different origin, a different mode, or a schedule-free/core-span query
#    that never reaches this line for ANY origin/mode (see Validation stage).
#    resolve_outbound_service stays defensively total (it CAN independently detect
#    MALFORMED via normalise_band) and the branch below is a redundant guard for
#    this specific pair once validated -- mirroring the return leg's own redundant
#    MALFORMED check ("MALFORMED at step 5 stays as a redundant runtime guard and
#    should be unreachable whenever the stage has run", PLAN.md:1247), just scoped
#    one level finer than the return leg's venue-wide stamp.
resolved = resolve_outbound_service(venue, origin, mode, service_date)

if resolved is MALFORMED:
    return EXCLUDED(reason: "invalid_metadata")   # unreachable for THIS pair once validated; see above
if resolved is MISSING:
    return EXCLUDED(reason: "missing_data")        # Decision 2 -- silence is not a pass
if leave_at_abs > abs(service_date, resolved.last_departure_band.lo):   # pessimistic (earlier) edge
    return EXCLUDED(reason: "after_last_departure")

return PASS(basis: "last_departure")
```

`resolve_outbound_service(venue, origin, mode, service_date)` mirrors `resolve_return_service`
exactly in structure (total function of an explicit service date, same
holiday → `by_weekday` → `default` → `MISSING` precedence, same `PRESENT`/`MISSING`/`MALFORMED`
result), reading `outbound_transport[origin][mode]` and `holiday_return_policy` instead of
`return_transport[destination][mode]`.

**Which edge of the band is pessimistic:** the band's lower edge (`lo`). A last departure's pessimistic
reading is always the **earlier** edge, regardless of which direction the leg runs, because pessimism
means "service actually ended sooner than the midpoint suggests." Comparing `leave_at_abs` against `lo`
(not `hi`) is therefore the direct mirror of `last_departure_upper` taking the band's lower edge on the
return leg (`PLAN.md:971-974`).

## Composition with existing mechanisms

- **Rain:** `wet_weather_mode` already substitutes the outbound mode when raining, upstream of this
  check (`CLAUDE.md`, "The rain toggle's effect is explicit"). By the time `outbound_admissible` runs,
  the mode has already been substituted if needed. No new rain-handling logic.
- **Access reachability:** the existing missing-`access[origin][mode]`-entry hard filter runs first,
  independently. This design adds a second, independent hard-filter condition — it does not touch or
  duplicate the first.
- **`bicycle_with_you` (return-leg concept):** unaffected. Plan A's `bicycle_with_you` is still
  `outbound_mode == "cycle"`, computed exactly as today; this design reads `access[origin]["cycle"]`
  directly and does not need the threaded flag.

## Validation stage

`validate_outbound_transport`, a new step in `build/refresh.py` alongside `validate_return_transport`
— same contract: mandatory, unconditional (hand-maintained metadata, runs even on a fully failed
fetch), classifies rather than aborts, and walks every reachable `outbound_transport` entry (`default`
and every `by_weekday` key, every origin, every mode) across the whole of `venues_meta.json`, exactly
as `validate_return_transport` does. **It differs from the return leg in one deliberate way: it stamps
validity per origin/mode, never per venue**, precisely to avoid the failure this revision exists to
correct — see "Pipeline integration" below.

```json
"outbound_transport_status": {
  "by_origin_mode": {
    "home":   {"transit": {"state": "ok"}},
    "office": {"transit": {"state": "invalid", "reason": "..."}}
  },
  "any_invalid": true
}
```

`by_origin_mode[origin][mode]` is the only part ranking ever reads, and only for the one pair the
candidate being evaluated actually needs, only at step 4 of `outbound_admissible` — never venue-wide,
and never for a schedule-free mode or a core-span query, neither of which reads this structure at all.
`any_invalid` is a **diagnostics-only rollup** — true if any origin/mode pair for this venue is
`invalid` — so a maintainer scanning `data/venues.json` can find broken venues in one pass.
**Ranking must never read `any_invalid`**; only `by_origin_mode[origin][mode]` may gate a candidate.

Same `MISSING`-shapes-stamp-`ok` rule as `validate_return_transport` (`PLAN.md:2390`), applied per
pair: an absent block, an absent origin/mode, and a selected entry with no `last_departure_band` all
stamp `{"state": "ok"}` for that pair — only a **present** band that fails `normalise_band` stamps
`{"state": "invalid", "reason": …}` for that specific pair, leaving every other pair's stamp
unaffected.

**Loud, at two different times, for two different audiences.** The mandatory generation-time walk
still flags every broken `(venue, origin, mode)` combination — in refresh diagnostics/output —
regardless of whether any live query ever needs it; that is what "loud" means for whoever maintains
the data, and it does not depend on the finer scoping above. Separately, a live ranking query produces
the user-facing `"outbound_gap"` removal notice (see "Pipeline integration") only when a candidate it
is actually evaluating hits an invalid entry; that is what "loud" means for the person using the tool.
This two-tier loudness, not a single venue-wide gate, is what makes step 4's `MALFORMED` branch a
redundant guard scoped to one `(origin, mode)` pair — never a venue-wide one.

## Pipeline integration

Folds into ranking-pipeline **step 1 (hard filter — reachability)**, next to the existing missing-
`access`-entry filter (`PLAN.md:1530`) — never into step 3 (feasibility tier). A venue/origin/mode
combination failing `outbound_admissible` is excluded from ranking entirely for that `leave_at`, the
same category as "mode isn't viable there," not a ranked-but-demoted candidate.

**One evaluation point, one scope: the specific candidate being ranked.** All four internal reasons
`outbound_admissible` can produce — `pre_dawn_gap`, `missing_data`, `after_last_departure`, and
`invalid_metadata` — are decided at ranking time, scoped to the exact `(venue, origin, mode, leave_at)`
combination the candidate represents. **None of them is a venue-wide, query-independent removal**: a
broken `outbound_transport.office.transit` entry excludes only an *office*-origin, *transit*-mode
candidate outside the core span — never a *home*-origin candidate, never a schedule-free candidate,
and never a core-span query for that same origin/mode, since those paths return at steps 1–2 without
ever consulting `outbound_transport_status`. This is the correction this revision makes: an earlier
draft gated the whole venue on one venue-level stamp, which silently contradicted the design's own
positive-evidence rules — a schedule-free mode or a core-span query settles the question without
reading timetable data at all, so a malformed *unrelated* entry must never be able to override that.

All four reasons share one unified user-facing label, **`"outbound_gap"`**, on the generated page's
removal notice for the specific query that hits them, mirroring the return leg's "degradation must be
visible" rule (`PLAN.md:1101-1103`). They are retained individually only for diagnostics. Independently
of whether any query ever surfaces one, `validate_outbound_transport`'s generation-time walk flags
every broken `(venue, origin, mode)` pair on its own — see "Validation stage".

## Non-goals

Mirroring `PLAN.md`'s own "What this design deliberately does not do" for the return leg:

- **No first-departure/wait modeling.** Pre-dawn stays a flat exclusion, not a resolved `unverified`
  tier — there is no tier here at all. Closing it later is the same "model the wait" future assignment
  `PLAN.md` already flagged for the return leg (`PLAN.md:1286-1290`), extended to cover both legs, not
  a new one.
- **No live fetcher.** Hand-maintained, exactly like `return_transport`.
- **No direction-specific holiday-policy divergence.** Decision 5 assumes only that the outbound and
  return legs classify a given date the same way (weekday / Saturday / Sunday-holiday) — never that
  they share a physical route, line, transfers, or service path. If that narrower classification
  assumption is ever wrong for a specific venue (the two legs genuinely observe different holiday
  substitution rules), it would need a distinct field; nothing here forecloses that extension, it is
  simply not adopted now because no such case is known.
- **No outbound cycling-safety cutoff.** See Decision 7 — deliberately out of scope for this
  assignment, not an oversight.

## Constants summary

| Constant | Change |
| --- | --- |
| `RETURN_CORE_FROM_MINUTES` → `SERVICE_CORE_FROM_MINUTES` | Renamed, shared by both resolvers |
| `RETURN_CORE_UNTIL_MINUTES` → `SERVICE_CORE_UNTIL_MINUTES` | Renamed, shared |
| `RETURN_SERVICE_DAY_START_MINUTES` → `SERVICE_DAY_START_MINUTES` | Renamed, shared |
| `RETURN_TOLERANCE_MINUTES` | Unchanged, return-only — no outbound equivalent exists (hard filter has no "tight" grading to tolerance-check) |
| `RETURN_CYCLE_LATEST_MINUTES` | Unchanged, return-only — a safety/personal-policy constraint, not a transport-availability fact, so out of this design's scope; see Decision 7 |

## What this forces elsewhere (for the eventual `ARCH-###` transcription)

- `PLAN.md`: a new "Getting there: outbound-mirror transport" section (parallel to "Getting home"),
  the data-contract addition, the constants-rename (touches every existing `RETURN_CORE_*`/
  `RETURN_SERVICE_DAY_START_MINUTES` reference in the return-leg text too), a ranking-pipeline step 1
  bullet, and removal of this item from "What this design deliberately does not do."
- `CLAUDE.md`: a new non-negotiable bullet under "Getting home" (or a sibling section) stating the
  hard-filter treatment and the shared-constants/shared-holiday-field decisions, so a future session
  doesn't re-derive them from scratch.
- `tests/js/`: `outbound_admissible` and `resolve_outbound_service` coverage mirroring the return
  leg's test list structure (schedule-free positive evidence, core-span waiver assuming access already
  filtered, pre-dawn unconditional exclusion, `MAX`-free single-edge comparison, `by_weekday`
  precedence, holiday-field reuse producing the *same* holiday-classification behavior as the return
  leg for the same venue/date) — **plus the scoping correction itself as its own required case**: a
  venue with an `invalid` `outbound_transport_status` entry for one origin/mode must still resolve
  `PASS` for a schedule-free candidate, a core-span query, and a different origin/mode at that same
  venue; only the specific invalid pair, outside the core span, returns `EXCLUDED`.
- `tests/python/`: `validate_outbound_transport` coverage mirroring `validate_return_transport`'s
  (missing-shapes stamp `ok`, malformed stamps `invalid`, one malformed venue doesn't block the write)
  — **scoped per origin/mode**: a malformed `office` entry stamps only `office`'s pair `invalid` while
  a well-formed `home` pair stamps `ok` independently; `any_invalid` is true whenever any pair is
  invalid but must never be read by ranking (a dedicated test asserting `outbound_admissible` never
  touches it, only `by_origin_mode`).
- `data/venues_meta.json`: a new hand-curation pass, `outbound_transport` per venue per relevant
  origin — out-of-protocol data work, like the `return_transport` fill was.
