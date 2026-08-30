# Decisions

Append-only log of what actually got resolved or changed as the project progressed, as distinct from [plan.md](plan.md) (the spec). One entry per decision: date, what was decided, why.

## 2026-08-28 — Design review: the plan was solving the wrong question

The original plan optimised busyness for a single hour ("where should I go at 3pm on a Tuesday"). Sessions are actually 3-6 hours, which makes **closing time the binding constraint most of the time** — a store closing at 9pm is useless at 4pm regardless of busyness. Reframed the goal around the real query: day + arrival + duration + origin + travel mode → ranked list.

Consequences, all now in plan.md: opening hours added as a first-class data source; `usable_hours` became the primary ranking key with busyness demoted to a tiebreaker; primary view changed from heatmap to ranked list (the heatmap survives as a per-store drill-down sparkline); `typical_stay_minutes` dropped from the data contract since duration is a per-query input, not a store property.

## 2026-08-28 — Peak busyness during the session doesn't matter

Only the **arrival hour's** busyness affects the decision. Once seated I stay, so how crowded it gets at hour four is irrelevant. Rejected an earlier proposal to show arrival-busyness and peak-busyness as separate numbers.

## 2026-08-28 — Outcome taxonomy collapsed to two values

`seat_outlet` / `seat_no_outlet` / `no_seat` → **`seat` / `no_seat`**. Power outlets don't affect how I work, so the third value was pure logging friction on a two-tap-or-nothing interaction.

## 2026-08-28 — Repo is public; seat log is coarsened instead

Decided a public repo is acceptable for a personal tool at this scale. This settles the deploy target: **GitHub Pages**, whose free tier only serves sites built from public repos (private-repo Pages needs Pro/Enterprise). Cloudflare Pages is no longer needed.

Consequence: a committed dated `seatlog.csv` would publish a timestamped record of where I was. Resolved by committing a **coarsened** log — `(store_id, day_of_week, hour, outcome)`, calendar date dropped. Calibration only ever consumes those four fields, so nothing analytical is lost. The raw dated CSV stays in iCloud Drive and is gitignored.

## 2026-08-28 — Travel is origin- and mode-dependent

Four real combinations in use: home→cycle, home→transit, work→transit, work→walk. Stored as hand-maintained travel minutes in `stores_meta.json` rather than computed — no Distance Matrix API, consistent with the no-backend rule. A missing key means the mode isn't viable for that store; an explicit `null` means not yet measured (shown as "travel unknown", not excluded).

Rain disables cycle-mode reachability via a **manual toggle** — live weather would violate the no-live-data non-goal for little gain.

## 2026-08-28 — Generated and hand-maintained data split into separate files

`stores.json` (generated, rewritten wholesale by the scrapers) vs `stores_meta.json` (hand-maintained, never written by code) vs `holidays.json`. The original single-file contract mixed scraped fields with hand-entered ones (`seats_est`, `notes`), so every scraper run risked clobbering an evening's worth of typing. Merged by `id` in the browser at load time.

## 2026-08-28 — SerpApi free tier confirmed at 250 searches/month

Checked the live pricing page, resolving plan.md's open "sources disagree on 100 vs 250". At ~10 calls/month this is comfortably inside it. `populartimes` / `LivePopularTimes` demoted to explicit fallback — the project's own README acknowledges instability and carries an open legal-concern issue.

## 2026-08-28 — External review (Codex), pre-Phase-0

An external review raised ten findings. Nine were accepted, one sub-point rejected, and a further
ten issues were found during the response. Entries below record each resolution. All external facts
were re-verified against primary sources rather than accepted from the review.

## 2026-08-28 — Places API Enterprise free cap resolved; supersedes the open cost question

The opening-hours fields are billed under the **Enterprise** SKU, which has a free cap of **1,000
calls per SKU per month** — confirmed from two independent Google sources
(`developers.google.com/maps/billing-and-pricing/pricing` and `mapsplatform.google.com/pricing`).
At ~10 calls/month the cost is **$0**. Overage is $20/1,000.

**Two figures recorded earlier were wrong:** "~$0.25/month" and "$25 per 1,000". Both are corrected
in plan.md. A GCP billing account and API key are still required, which is now the *only* real
friction in choosing the Places API.

This flips the comparison. Places API is stronger on every axis except the billing account: free at
this volume, officially supported, structured, and the only source providing `businessStatus`. The
Starbucks SG locator remains worth **one timeboxed attempt** because it avoids the billing
relationship entirely — but it is unverified, undocumented, and has no closure signal.

## 2026-08-28 — Time input is "leave at", not "arrival"

The goal statement is "it's 4pm and I'm **at work**", but the formula treated the selected time as
store arrival and never added travel. Corrected to `store_arrival = leave_at + travel_minutes`, with
leave-at defaulting to now.

Three consequences the review didn't name, all now explicit in plan.md: arrival becomes **per-store**
because travel time is, so (1) the open-on-arrival filter must test each store's own arrival, (2) the
busyness figure shown is for that store's arrival hour, and (3) arrival times are no longer round, so
the busyness bucket is chosen by **flooring** (16:25 reads hour 16).

## 2026-08-28 — Busyness removed from the ranking entirely

Popular Times is normalised to each store's own peak. Using it to order stores implies a
comparability the number does not have — a contradiction that sat inside the plan, which stated the
non-comparability and then ranked on it anyway. Busyness is now **display-only**, labelled
store-relative, until Phase 3 produces a calibrated `P(seat)`.

`seats_est` was supposed to fix comparability by normalising per seat. It does not: the numerator
counts everyone in the geofence including the takeaway queue, and geofence size varies between
stores. Nothing computes with the field now; it is retained for one phase as a hand-maintained
judgement aid and dropped if it stays unused.

## 2026-08-28 — Ranking key is `surplus_minutes`, not `usable_minutes`

`usable_minutes` caps at the requested duration, so once several stores all deliver the full session
it stops discriminating and the ranking collapses onto preference. `surplus_minutes =
(store_close − closing_buffer) − (store_arrival + duration)` is the same quantity without the cap, so
it still separates a store closing at 11pm from one closing at 10:15pm for a session ending at 10pm.

`usable_minutes` is retained as the **display** value ("6h of 6h", "4h — closes 8pm"). One number
ranks, another displays.

## 2026-08-28 — Preference becomes a strict 1-10 total order

A 1-5 rating across ten stores puts most of them on 3 or 4, so ties would not break — and preference
is now the *second* ranking key, so it has to resolve. A forced total order guarantees it does.

## 2026-08-28 — Latest viable departure added

`latest_leave_at = (store_close − closing_buffer) − duration − travel_minutes`, shown per store.
Answers "is it already too late?" directly, instead of requiring the ranking to be re-run at
different leave-times until something breaks. Same data, no new source.

## 2026-08-28 — Travel published as ordinal rank, not minutes

`stores_meta.json` is committed to a public repo. Travel times in minutes from `home` and `work` to
ten stores whose coordinates are also published are enough to **trilaterate both origins**. The
review proposed five-minute bands; banding alone does not stop trilateration, it only coarsens it.

Adopted instead: **ordinal rank per origin/mode**, plus a coarse band for display, under neutral
`origin_a` / `origin_b` ids. The ranking pipeline only ever uses travel for *ordering*, so ordinal
data loses nothing it actually consumes. The origin-name mapping is not committed.

**Accepted residual risk:** this is a reduction in precision, not a guarantee. Ordinal and banded
data still leak something about relative position. Judged acceptable for a personal tool; recorded
here so the tradeoff is explicit rather than assumed away.

## 2026-08-28 — Hours contract uses explicit known / closed / unknown

The `{open, close}` shape with `null` meaning closed made a **fetch failure indistinguishable from a
genuine closure**. Replaced with per-day `state` of `known` | `closed` | `unknown` plus an array of
periods. Times are integer minutes from local midnight; `close > 1440` means after-midnight, and a
24-hour store is `{"open": 0, "close": 1440}`. Multiple periods per day are supported.

Whether any of the ten stores actually needs after-midnight, 24-hour or split periods is a Phase 0
question — if none do, the array is carrying complexity it hasn't earned.

## 2026-08-28 — One orchestrator owns stores.json; no global generated_at

Two fetchers both writing the same file was an unresolved clobbering hazard. `build/refresh.py` now
solely owns `data/stores.json` and `web/index.html`: it calls both fetch interfaces, validates,
merges, retains **last-known-good per source** on failure, records `last_attempt_at` /
`last_success_at` / `status` per source, and replaces files atomically only after validation.

The top-level `generated_at` is **removed**. With last-known-good retention one source can be fresh
while the other is a month stale, and a single global timestamp would make retained stale data look
freshly fetched.

**A store vanishing from a source is not a closure.** Disappearance is a per-store fetch failure with
last-known-good retained and a loud warning. Only an explicit signal (the Places API's
`businessStatus`) may mark a store closed. The locator has no such signal, which is a real argument
for the Places API.

## 2026-08-28 — Data inlined into a generated HTML file; localStorage rejected

`localStorage` was proposed for offline and rejected — and on inspection it was the wrong tool
anyway: with no signal the page shell (`index.html`, `app.js`, `style.css`) does not load either, so
nothing is running to read it. It only ever covered the narrow case where the page loads from HTTP
cache but a data fetch fails.

Adopted instead: `build/refresh.py` inlines all data into `web/index.html` as
`<script type="application/json">` blocks, generated from `web/index.template.html`. The app makes
**no network requests at runtime**.

This resolves the deployment question as a side effect — no `fetch()` means no CORS, no `file://`
restriction, no local dev server requirement, and no `web/`-vs-`data/` path problem under Pages.
It also produces **one portable file** that works with no network at all when saved to the phone.

Cost: `web/index.html` becomes a generated artifact and must never be hand-edited. This is a
data-inlining step, not a bundler, so the no-npm / no-build-system rule stands.

**Scope stated honestly:** this gives *portable* offline and *best-effort* cached offline. Guaranteed
offline for the hosted URL would still need a service worker — deliberately still deferred.

## 2026-08-28 — Site layout and Pages configuration fixed

GitHub Pages serves from the repo root or `/docs` only, so `web/` cannot be the site root. Decided:
serve from **repo root**, app at `/web/index.html`, manifest `start_url` `/web/index.html` and scope
`/web/`. No data URLs, since data is inlined.

## 2026-08-28 — Seat log gains histogram lineage; the earlier privacy claim corrected

Phase 3 would have joined each visit to the **current** histogram. Since the histogram is a rolling
average refreshed monthly, a four-month-old visit would be paired with a predictor that did not exist
when it happened. `seatlog.csv` now carries `histogram_busyness` and `histogram_fetched_at`, captured
at coarsening time.

**Correcting an earlier entry in this log:** the 2026-08-28 entry "Repo is public; seat log is
coarsened instead" states that dropping the date means "nothing analytical is lost". That is too
strong, and it contradicted the plan's own note that seasonality is a real effect. Dropping dates
permanently forecloses analysing **seasonality, trend over time, and visit ordering** from my own
data. What survives is the `(store, day_of_week, hour) → outcome` relationship, which is what the
Phase 3 model consumes. The loss is accepted for the privacy gain; it is not zero.

The review also suggested publishing aggregate counts instead of coarsened rows. **Rejected:** with
~30 observations spread across 10 stores × 7 days × ~15 hours, nearly every cell holds zero or one
observation, so an aggregate table is near-identical to the row list and harder to join. Revisit only
if the log grows enough for cells to hold several observations.

## 2026-08-28 — Public holidays substitute the Sunday curve rather than only warning

Previously the plan showed a banner and gave up on both sources. For mall-based stores, SG public
holidays behave far more like Sundays than like the nominal weekday, so the histogram now falls back
to the Sunday curve **and flags that it has done so** — carrying on with a curve known to be wrong is
worse than substituting a closer one and saying so. `holidays.json` gains a `substitute_curve` field
and a worked schema, which it previously lacked entirely.

Hours are **not** substituted. `currentOpeningHours` carries real holiday overrides for a 7-day
horizon; beyond that, `unknown` is the honest answer rather than a guess.

## 2026-08-28 — Seat log made useful at n=1

Under the previous plan the log paid out nothing until ~30 observations, roughly four months at two
visits a week. That makes Phase 2 an unrewarded chore, and an unrewarded logging habit stops — taking
Phase 3 with it, along with the only thing that makes this tool better than reading Google Maps.

The app now shows raw per-store history from the first entry ("been here 3×, seat 3/3", "last visit:
no seat, Fri 10am"). Not a model — a memory aid, useful at n=1. Phase 2's acceptance criterion now
requires the result to be visible, not just fast to enter.

## 2026-08-28 — Ranked list grouped by area

`lat`/`lng` were in the data contract with no consumer at all. Grouping the list by area costs no new
data and surfaces "three options in Orchard", which is how the fallback actually works when the first
choice is full.

## 2026-08-28 — Fetchers get fixture-based parser tests

The previous rule — "fetchers get no test scaffolding beyond failing loudly" — was too broad. A parse
bug corrupts `stores.json` silently and then drives every ranking downstream, which is exactly the
failure mode worth a test.

Narrowed rather than reversed: **fixture-based parser tests only**, using small trimmed real
responses. No network, no mocking framework. `node --test` for the JS side (built in, no dependency,
consistent with the no-npm rule) and pytest for Python, split under `tests/js/` and `tests/python/`
since the two runtimes previously had no stated home. A manual iPhone / Home Screen acceptance
checklist covers what unit tests cannot.

## 2026-08-28 — `make refresh` does not commit

Previously specified as coarsening the log "and commits". An automated commit pushes unreviewed
generated data, and a bad parse would land in the repo before anyone looked. Refresh now fetches,
validates, merges and regenerates only; inspecting the diff, committing and pushing stay separate
manual actions.

## 2026-08-28 — Smaller corrections from the same pass

- **The rain toggle shifts arrival time.** Disabling cycle mode switches that origin to a slower
  mode, which pushes `store_arrival` later and can flip the ranking or drop a store below viability.
  Correct behaviour, but it must be visible rather than a silent reorder. Added to Known problems.
- **`closing_buffer_minutes` default now has a home.** `null` in `stores_meta.json` means use the
  global 30, which lives in `ranking.js` as a named constant.
- **Timezone split into `hours_timezone` and `histogram_timezone`.** One field could not describe
  both, while "does the histogram come back in SGT or UTC?" was an open question. Phase 0 must
  confirm each independently.
- **Unrankable stores are separated.** With travel unknown there is no `store_arrival`, so
  `surplus_minutes` is uncomputable and the store cannot be honestly ordered. These now sit in their
  own group below the ranked list instead of being interleaved.

## 2026-08-28 — Busyness reinstated as the primary sort; hours become a gate

**This reverses the "Busyness removed from the ranking entirely" entry above**, at the user's
direction — busyness should be one of the important factors in the decision. The earlier entry's
*diagnosis* stands (the raw number is not comparable across stores); its *remedy* was too blunt.
The fix is to transform the number into something comparable, not to discard it.

**Hours become a gate rather than a sort key.** `surplus_minutes` has sharply diminishing value:
once a store gives the full session with an hour spare, another 40 minutes of slack is nearly
worthless — yet sorting on it meant a store with 150 minutes of slack always beat one with 90, even
when the second was half empty and the first packed. Full-duration is now hard pass/fail; stores that
fail go to a separate "shorter session" group showing what they do give. `surplus_minutes` survives
as a final tiebreak, a displayed value, and a thin-margin warning below ~30 minutes.

**New order:** reachable → open on arrival → gives full session → **busyness band** → preference →
travel rank → `surplus_minutes`.

**The transform: deviation from the store's own median, banded** into `quiet` / `typical` / `busy` /
`peak`. Percentile was considered first and rejected — it spreads a store's hours across the full
0-100 range *regardless of whether the underlying spread is meaningful*. A real curve inspected while
deciding this ran roughly 60-100% of peak across the entire day with only a mild evening peak; on a
curve that flat, percentile would present 62% against 65% as the 10th versus 30th percentile, a
manufactured distinction. Deviation in raw points preserves magnitude, so a genuinely flat store
lands wholly in `typical` — the honest answer rather than an invented ranking.

Google itself bands the same way ("A little busy", "As busy as it gets"), which is corroboration that
the raw value doesn't travel between stores for them either.

**What this claims, precisely:** it ranks by *"am I catching this store at a good time for it"*, not
*"is this store less crowded than that one"*. The latter is the question actually wanted and no
transform of Popular Times can answer it — that still needs Phase 3's calibrated `P(seat)`.

**Known blind spot, recorded rather than solved:** a chronically packed store reads `typical` at its
own median, identically to a chronically empty one. `preference` absorbs this in practice, which
means the 1-10 order is not purely taste — it quietly carries absolute-crowding information the
histogram cannot express.

**`N` is deliberately unset.** Phase 0 now must report each store's spread (max−min and IQR) and
propose `N` from it. If the median store's range is under ~20 points, banding won't discriminate,
preference carries the ranking, and that is to be recorded as a finding — not fixed by shrinking `N`
until the bands look busy.

Band `unknown` (missing histogram) sorts **neutrally**, never last: a store must not be demoted for a
fetch failure.

## 2026-08-28 — Defect found in this same pass: `travel_minutes` was undefined

Two changes adopted in the same session contradicted each other. The travel-semantics fix introduced
`store_arrival = leave_at + travel_minutes`, and the privacy fix simultaneously replaced exact travel
minutes in `stores_meta.json` with `{rank, band}`. Nothing then defined `travel_minutes`, so
`store_arrival`, `usable_minutes`, `surplus_minutes` and `latest_leave_at` were all uncomputable —
the entire time model rested on a field that no longer existed.

Each change was sound alone. The failure was not checking them against each other.

**Resolved:** `travel_minutes` is the **band midpoint** — `"15-20m"` → 17, `"25-30m"` → 27. `rank`
orders; `band` both displays and yields the number. The cost is ±2.5 minutes per store, immaterial
against a 3-6 hour session and an order of magnitude below the ~30 minute thin-margin warning.

Minor privacy note: publishing a midpoint is marginally more informative than rank alone. Still far
coarser than exact minutes, and accepted on the same basis.

## 2026-08-28 — Objective restated: reliable seating with minimised failure burden

The stated objective is now:

> Recommend the coffee destination that gives me a high chance of getting a suitable seat for the
> full study session, while minimising the wasted time and energy if the prediction is wrong.

The failure that matters is travelling ~40 minutes, finding no seat, and having to travel again.
That cost dominates any mild sub-optimality in the choice itself, which is why the output changes
from a ranked list to a **Plan A plus a practical Plan B**.

**Opening hours are demoted to a feasibility constraint.** They rule venues out; they never make one
venue better than another. This supersedes the framing in the "hours become a gate" entry above only
in emphasis — hours remain a gate, but the gate is no longer the interesting part of the design.

## 2026-08-28 — `baseline_seatability` added as a separate field

Absolute, hand-maintained, per venue: `dependable` / `usually_available` / `mixed` / `poor` /
`unknown`. This is the **only cross-venue seat signal that exists before Phase 3**.

`unknown` is a missing-knowledge state, not a middle rung — it never averages toward `mixed` and
never resolves upward from busyness evidence.

**This directly fixes a defect recorded above.** The entry "Busyness reinstated as the primary sort"
noted a blind spot: a chronically packed venue reads `typical` at its own median, and `preference`
was expected to absorb that. Letting preference carry crowding made one number mean two things and
hid the crowding signal from everything else. `preference` is now **study quality only** — tables,
comfort, Wi-Fi, noise, atmosphere, food — and crowding lives where it can be displayed, reasoned
about, and eventually validated against the seat log.

## 2026-08-28 — SUPERSEDES "Busyness reinstated as the primary sort"

**The entry above titled "Busyness reinstated as the primary sort; hours become a gate" is no longer
the current design.** Read this entry instead.

Relative busyness is now an **adjustment**, not the answer. It is not the primary sort key and does
not by itself determine ranking.

What survives from that entry: the band transform (deviation from the venue's own median, not
percentile), the rejection of percentile on flat curves, `N` being set from Phase 0 data rather than
guessed, and Google's own qualitative labels as corroboration.

What is corrected:

- **The claim that banding makes venues comparable was too strong.** The band answers *"is this an
  unusually good or bad time to visit this particular venue?"* It does **not** answer *"is this venue
  more likely to have a seat than another venue?"* A `quiet` reading at a chronically packed venue can
  still be worse than a `busy` reading at a usually-empty one. Every statement implying otherwise has
  been corrected in `plan.md`, `README.md` and `CLAUDE.md`.
- **Cross-venue comparison comes from `baseline_seatability`**, and later from calibrated `P(seat)`.
- **`peak` now takes precedence over `busy`**, with a separate threshold `P` measured from the
  venue/day maximum. Phase 0 must determine both `N` and `P`.
- **Missing busyness is no longer treated as `typical`.** That rule invented typical conditions out
  of a source failure. It now falls back to `baseline_seatability` alone with a visible
  lower-evidence warning, and still never removes a venue.

**Four bands plus `unknown`, and no more.** Popular Times is an indirect, noisy proxy for seating —
it counts the takeaway queue — so finer gradations would manufacture precision the signal cannot
support. A `very_quiet` band is **deferred**, to be added only if Phase 0 shows several venues with
genuinely large and repeatable troughs on the order of `2N` below their median. It is deliberately
not in the initial contract.

## 2026-08-28 — `seat_confidence` derived by explicit lookup

`baseline_seatability` adjusted by `relative_busyness` on the ladder
`poor` (1) → `mixed` (2) → `usually_available` (3) → `dependable` (4), clamped to [1, 4]:

`quiet` +1 (capped at `dependable`) · `typical` 0 · `busy` −1 · `peak` −2 · `unknown` busyness leaves
baseline unchanged with evidence flagged weaker · **`unknown` baseline always yields `unknown`
confidence**, because a within-venue reading cannot establish an absolute level.

An explicit table, not a weighted score — any result must be reconstructable. **No numerical
probability before Phase 3.** The UI shows baseline and adjustment separately, never the conclusion
alone.

## 2026-08-28 — Plan A / Plan B, with delayed fallback arrival

The primary output is Plan A, Plan B, and "more alternatives" behind an expander.

**Plan B must not be second place from the origin ranking.** By the time it is needed I am inside
Plan A, later than planned, having already spent the trip:

```
plan_b_arrival = plan_a_arrival + seat_check_buffer_minutes + travel_from_plan_a_to_plan_b
```

`seat_check_buffer_minutes` is a **provisional global, default 10** — entering, scanning for a seat,
deciding to leave. Recorded as provisional; only real use will show whether 10 is right.

Plan B is re-evaluated at that delayed arrival for reachability from Plan A, opening status,
remaining usable session, seat confidence at the later hour (which can cross a band boundary), and
rain/mode effects on a leg that may differ from the origin leg.

**`backup_strength`** (`strong` / `weak` / `none`) is derived from `fallbacks` still viable at
delayed arrival — never from geographic proximity. A neighbour that is closed by the time I'd reach
it is not a fallback.

**Venue probabilities are never multiplied.** "70% and 70% so 91% somewhere" is invalid: neighbouring
venues share crowds, weather and events, so their failures are strongly correlated. This is precisely
why backup strength stays qualitative.

Fallback links are hand-picked between plausible neighbours with coarse travel bands — **not** a full
venue-to-venue matrix.

## 2026-08-28 — Brand-neutral venue architecture

Scope now includes Starbucks, Coffee Bean & Tea Leaf, Tim Hortons and potentially independents.
Because no code exists yet, the domain model is generalised **now** rather than retrofitted:
`venue`, `venue_id`, `venues.json`, `venues_meta.json`, `venue_arrival`. The repo directory keeps the
name `starbucks-planner`; that is a directory name, not an architectural commitment.

`venue_type` (`large_cafe`, `mall_cafe`, `office_cafe`, `takeaway_heavy`, `small_kiosk`,
`independent_cafe`) is recorded from the start but is **descriptive only** — nothing computes with it
until Phase 3 shows it predicts something.

**This changes the hours-source decision recorded above.** The earlier entry preferred trying the
Starbucks SG locator first because it avoided a GCP billing account. That reasoning does not survive
multi-brand scope: Google Places gives one consistent identity/hours/`businessStatus` interface
across every brand, while brand-specific locators would mean a separate undocumented, separately
breaking integration per chain — and none of them provide a closure signal.

**Google Places API is now the primary hours source.** The Starbucks SG locator is demoted to a
timeboxed cross-check experiment that must not shape the generic architecture. The Enterprise SKU's
1,000-call/month free cap still makes this $0 at this volume, so the only cost remains the billing
account — now clearly worth paying once instead of maintaining a scraper per brand.

**Placement note:** `brand`, `venue_type` and `baseline_seatability` are stored in
`venues_meta.json`, not on the generated `venues.json` record, because a refresh rewrites the
generated file wholesale and would clobber hand-entered values. They are merged onto the venue object
at generation time, so the runtime shape is a single venue carrying both.

## 2026-08-28 — Phase 3 target restated

```
P(seat | venue, arrival conditions, personal history)
```

Candidate inputs: brand, `venue_type`, venue-level effect, relative Popular Times signal,
weekday/weekend, personal observed outcomes. **Partial pooling** — never a separate model per venue
at realistic sample sizes; venues with little data shrink toward the population.

`no_seat` observations, **including walk-bys and abandoned attempts**, are the most valuable rows in
the dataset. Without them selection bias concentrates the data in venues already believed safe, and
the model learns that everywhere is fine because I only went where I expected a seat.

Phase 3 is also where `baseline_seatability` stops being memory and gets checked against evidence.
**Not to be designed or implemented now.**

## 2026-08-28 — Follow-up recorded, deliberately not decided: "robust" feasibility

The revised ranking calls for *robust* full-session feasibility, but the current rule is a hard cliff
at `surplus_minutes >= 0` — 5h59m of a 6h session is relegated while 6h00m ranks, and
`travel_minutes` carries ±2.5 minutes of band-midpoint error, so the boundary is noisier than it
looks.

Options are a tolerance band, a soft demotion instead of a hard split, or treating requested duration
as a range. **No decision is invented here.** The hard cliff stands, the thin-margin warning partially
mitigates it, and this is recorded in `plan.md`'s Open Questions as a required follow-up.

## 2026-08-29 — Codex final review: conditional pass, six execution contracts resolved

A final pre-implementation review returned a conditional pass — approve Phase 0 once venue names
exist, but resolve the execution contracts below before Phase 1. Every citation was re-checked
against the actual text: **line numbers drifted by a few lines** (`plan.md:456` pointed at the
`brand`/`venue_type` note rather than the baseline-unknown claim; `:241` and `:595` landed on blank
lines), but **every substantive claim verified as a real defect**. All six accepted.

## 2026-08-29 — The UI selects a calendar date, not a weekday

`holidays.json` was keyed by date while the UI selected a weekday, so the two could never be
reconciled — and the hours schema had nowhere to hold Google's date-specific `currentOpeningHours`
overrides.

`selected_date` is now the input; `selected_weekday` is **derived** in `Asia/Singapore`. The hours
contract splits into `regular_hours` (weekday periods), `date_overrides` (date-keyed), and
`overrides_valid_through` (the horizon, ~7 days).

Resolution order: date override → regular weekday hours if inside the horizon → **`unknown` if the
date is a known holiday beyond the horizon** → regular weekday hours. That third branch matters:
guessing the regular schedule for a holiday when malls close early is exactly the wasted-trip failure
this tool exists to prevent.

## 2026-08-29 — `venue_close` is derived from an active period, not assumed

The contract supported multiple periods and after-midnight closing, but every formula referenced a
singular `venue_close` that nothing produced. **This is the second instance of the same defect class**
— a formula referencing a field the data contract doesn't define, after `travel_minutes` last pass.
Worth treating as a standing check rather than catching by luck.

```
candidate_periods = periods for selected_date
                  + periods from the PREVIOUS date whose close > 1440
active_period     = the period P where P.open <= venue_arrival < P.close
venue_close       = active_period.close
```

Arrival in no period means closed and filtered out. Previous-date periods must be checked for
post-midnight arrivals. Travel can push arrival past midnight, in which case hours resolve for the
**arrival** date, not the departure date.

## 2026-08-29 — "Robust" feasibility resolved: three tiers, using the travel band's upper edge

Supersedes the entry above that deliberately deferred this. Codex's proposal was adopted because it
uses the band's uncertainty properly instead of pretending the midpoint is exact.

Travel now yields **two** derived numbers: `travel_minutes_mid` (midpoint — display, ordering, Plan B
arrival) and `travel_minutes_upper` (band upper edge — the robustness test).

```
robust  : surplus_upper >= 0
tight   : surplus_mid >= 0, or shortfall at midpoint <= FEASIBILITY_TOLERANCE_MINUTES
shorter : otherwise
```

**`FEASIBILITY_TOLERANCE_MINUTES = 15`, provisional.** Bands are five minutes wide so the midpoint
carries ±2.5; 15 minutes is ~4% of a six-hour session — worth flagging, not worth relegating. Both
`robust` and `tight` rank (robust first); `tight` carries a thin-margin warning. This replaces the
hard cliff that relegated 5h59m while ranking 6h00m.

## 2026-08-29 — Plan B viability floor added

`backup_strength` could previously count a fallback offering "materially less session" as `weak` with
no lower bound at all — so a poor venue offering one hour could technically become Plan A's fallback
and register as `strong`.

**`PLAN_B_MIN_SESSION_MINUTES = 90`** and **`PLAN_B_MIN_CONFIDENCE = mixed`**, both provisional. If
nothing clears the floor, `backup_strength` is `none` and the UI says so rather than inventing a
fallback.

## 2026-08-29 — The single-file claim was false; now made true

`plan.md` and `README.md` both stated the page makes "no network requests at all" and produces "one
portable file". **Both were false as designed** — the file tree kept `app.js`, `ranking.js`,
`style.css` and a manifest as separate assets, so the page fetched four of them. Inlining only JSON
never produced a self-contained page.

This error survived three consistency sweeps because those sweeps grepped for *superseded* claims
rather than checking *new* claims against the file tree. Correcting the claim was not enough; the
design had to change to match it.

**Resolved by inlining code and styles too**, while keeping the source files real:

- `refresh.py` inlines the contents of `ranking.js`, `app.js` and `style.css` into `index.html`,
  alongside the data.
- **`ranking.js` stays a real file** — `tests/js/` imports it directly. Inlining it *instead of*
  keeping it would have broken the entire JS test suite, a tension neither of the review's two
  proposed options addressed.
- **`<` must be escaped in embedded JSON.** A `notes` field or venue name containing `</script>`
  would terminate the block and corrupt the page. Now a required test.
- **The manifest is the one exception** — Safari's `data:` URI manifest support is unreliable, so it
  stays a separate file. Consequence, stated rather than hidden: the AirDropped file works fully
  offline, but "Add to Home Screen" requires the hosted version.

**Pages paths corrected to relative.** `start_url: "./index.html"`, `scope: "./"`. For a project site
the repository name is a path prefix, so the previously specified absolute `/web/index.html` would
resolve to `darrensy19.github.io/web/` and 404. Relative paths also keep the `file://` copy working.

Also corrected: the claim that Pages publishes "from repo root or `/docs` only". Those are the
*branch-publishing* choices; Pages can alternatively publish a GitHub Actions artifact from any
directory. Root-of-branch remains the choice here, for simplicity.

## 2026-08-29 — Phase 1 acceptance reconciled with baseline bootstrapping

Every venue starts at `baseline_seatability: unknown`, an `unknown` baseline always yields `unknown`
confidence, and the tool refuses to promote `unknown` into Plan A — yet Phase 1 acceptance demanded a
Plan A. As written, Phase 1 could never pass.

Acceptance is now **two-part**: (1) with no baselines assessed, the app correctly returns "No
low-risk option found for the requested session" with the candidates and their reasons — this is the
right behaviour, not a failure; (2) once at least one venue has an assessed baseline, the app
produces a Plan A, and a Plan B where a viable fallback exists.

## 2026-08-29 — Holiday substitution moved from global to per venue

A global Sunday-curve substitution is plausible for mall cafés and wrong for office cafés, kiosks and
independents — and multi-brand scope weakens the global rule further.

`holidays.json` now carries dates and names only. The substitution rule moves to `holiday_policy` in
`venues_meta.json`: **`unknown` (default)** or `substitute_sun`. Unknown is the honest default;
substitution is an explicit per-venue claim.

## 2026-08-29 — Visit ordering is retained; the earlier claim was too strong

The coarsened-log entry above states that "visit ordering is permanently unavailable", while Phase 2
promises "last visit: no seat, Fri 10am". Both could not be true.

**The earlier claim was wrong.** `seatlog.csv` is append-only and rows stay in chronological order, so
**relative ordering survives** — "last visit" and "the last three visits here" are both answerable.
What is genuinely lost is absolute dates, intervals between visits, and seasonality. The loss is real
but narrower than previously recorded.

## 2026-08-29 — Refresh step order is load-bearing

"Busyness in effect at visit time" only holds if new raw visits are coarsened against the histogram
**that is about to be replaced**. Running the fetch first would stamp every new visit with the *new*
value, silently destroying the lineage the Phase 3 join depends on — while looking entirely correct.

`refresh.py`'s order is now explicit and tested: **coarsen first**, then fetch, validate, merge with
last-known-good, record per-source status, replace atomically, regenerate.

## 2026-08-29 — Smaller contracts pinned down

- **`area` moved to `venues_meta.json`.** It sat in generated `venues.json`, but the Places API
  returns no clean neighbourhood field, so it is hand-assigned and a refresh would clobber it — the
  same defect already fixed for `brand` and `venue_type`. The review filed this as a clarification;
  it was a contract error.
- **`status` values defined:** `ok` = fetched this run · `stale` = failed, showing last-known-good ·
  `failed` = failed with no last-known-good.
- **`wet_weather_mode` added to meta**, naming which mode replaces which per origin. The rain
  toggle's effect was previously undefined. A mode with no substitute is simply unavailable in rain.
- **`MIN_HISTOGRAM_HOURS = 6`, provisional** — a median over two or three buckets is meaningless, so
  below this the band is `unknown`. Phase 0 reports real coverage.
- **Venue list count left open.** Ten rows is a starting size, not a limit; multi-brand scope may push
  it well past that, which affects API volume and how much hand-maintained meta stays current.

## 2026-08-29 — Correction pass: six execution defects fixed before Phase 0

A final pre-implementation pass found six defects in the contracts written earlier the same day.
All were real; all are corrected below.

## 2026-08-29 — Absolute minutes as the single coordinate system

The active-period pseudocode combined periods whose offsets were relative to **different dates** and
then compared them directly against an arrival. A Tuesday 00:30 arrival (offset `30`) would fail to
match a Monday period `{open: 450, close: 1500}` despite falling squarely inside it.

Resolved with one coordinate system for every comparison:

```
abs(date, offset) = days_since_epoch(date) * 1440 + offset      # Asia/Singapore
```

Periods become `[abs(D, open), abs(D, close))`, where `close > 1440` rolls into the next day
naturally. The Tuesday 00:30 case now resolves as `abs(Tue, 30) == abs(Mon, 1470)`, inside
`[abs(Mon, 450), abs(Mon, 1500))`. **Offsets are for storage; absolute minutes are for arithmetic**,
and no comparison anywhere mixes the two.

Boundary rule stated explicitly as `open <= arrival < close`. Coverage now specified for arrivals
after midnight, travel crossing midnight, periods closing after midnight, split periods, and the gap
between split periods.

## 2026-08-29 — Midpoint and upper-bound feasibility resolved independently

`venue_close` was derived from the **midpoint** arrival and then reused for `surplus_upper`. That is
wrong near closing, across midnight, and with split periods — a later arrival can fall into a
different period, or into none at all.

Each bound now resolves through its own chain: `arrival_mid` → `active_period_mid` →
`venue_close_mid`, and separately `arrival_upper` → `active_period_upper` → `venue_close_upper`.

```
robust  : active_period_upper exists AND surplus_upper >= 0
tight   : not robust, AND active_period_mid exists,
          AND (surplus_mid >= 0 OR -surplus_mid <= FEASIBILITY_TOLERANCE_MINUTES)
shorter : otherwise
```

`active_period_upper` being none **fails `robust` outright** — it means the venue is shut by the time
you could plausibly arrive, which is not a zero shortfall. Plan B uses the same dual-bound machinery.

**Tolerance rationale corrected.** It previously read "about 4% of a six-hour session", which only
described one end of the supported range. Fifteen minutes is roughly **4-8%** of a 3-6 hour session —
about 8% of three hours, about 4% of six.

## 2026-08-29 — The JSON escaping instruction was a no-op; now specified unambiguously

`plan.md` read "must be escaped (`<` → `<`)" — the same character on both sides, conveying nothing.

The rule is a **JSON-level** unicode escape: `json.dumps(data).replace("<", "\\u003c")`. HTML entities
are *not* decoded inside a `<script>` element, so `&lt;` would place those literal characters into the
parsed data and corrupt the value; the unicode escape is valid JSON that parses back to `<`, so data
round-trips intact while `</script>` never appears literally in the markup.

Noted for future editing: the escape sequence collapsed to a bare `<` **twice more** while writing
this correction, because the six-character sequence is fragile in prose. It is now stated as a Python
expression, which survives. The test requirement stands — a value actually containing `</script>`,
asserting both that the page parses and that the value round-trips.

## 2026-08-29 — The JavaScript inlining contract made executable

"The generator copies `ranking.js` and `app.js` into `<script>` blocks" did not say how ES module
`import`/`export` syntax survives — and a retained `import … from "./ranking.js"` would make the
browser fetch that file, defeating the entire self-contained design.

The convention, dependency-free:

1. `ranking.js` is a real ES module with `export` declarations; `tests/js/` is its only importer.
2. `app.js` imports from it via one fixed-form statement at the top.
3. The generator emits **one** `<script type="module">` with `ranking.js` in full, then `app.js` with
   that import line removed. Shared module scope makes the bindings visible; the `export` keywords
   remain but are inert in an inline module.

**New constraint this creates, recorded rather than discovered later:** the two files share one
top-level scope after concatenation, so their top-level names must not collide. That constrains how
the code is written and needs its own test.

Generated-artifact acceptance criteria added: no external JS or CSS references, no unresolved local
imports, no `fetch()` for bundled data, only the manifest non-inlined, all paths relative, no
top-level name collisions, and the file opening and rendering correctly from `file://` — the last
being the real test of every other point.

## 2026-08-29 — `backup_strength` distinguishes a real Plan B from a salvage

The requested session is 3-6 hours. A fallback offering 90 minutes may rescue the trip, but the old
`weak` state conflated "a bit further away" with "half the session you wanted" — two entirely
different problems — and nothing prevented a 90-minute option being presented as an equivalent backup.

The three states are now graded by **whether the requested session survives**:

- **`strong`** — the requested session fits (`robust` or `tight`) at the fallback's delayed arrival,
  with confidence at least `PLAN_B_MIN_CONFIDENCE`.
- **`salvage`** — at least `PLAN_B_MIN_SESSION_MINUTES` (provisional 90) remains and confidence is at
  least `mixed`, **but the requested session does not fit**.
- **`none`** — below either floor, or no valid fallback.

`salvage` replaces `weak`. **A salvage option must be labelled as such and state its actual duration**
— "gives 1h40m, not the 6h you asked for". Clearing the floor is not the same as satisfying the
request.

## 2026-08-29 — Phase 0 is blocked on venue names and brands only

The venue table implied Place IDs had to be supplied before Phase 0 could start. They do not:
resolving Place IDs is Phase 0's *first task*, and assigning stable `venue_id`s and recording
`venue_type` and `area` are Phase 0 outputs too.

The table now marks its columns explicitly — **Venue name** and **Brand** as user inputs, `venue_id`
and Place ID as Phase 0 outputs — with a legend above it, and `README.md` states the same. The
judgement fields (`baseline_seatability`, `preference`) remain Phase 1 hand-entry, with
`baseline_seatability` starting at `unknown` for every venue.

## 2026-08-29 — Plan B gets independent midpoint and upper-bound arrivals

The Plan B contract defined a single `plan_b_arrival` built from Plan A's **midpoint** arrival plus an
undefined `travel_from_plan_a_to_plan_b`. Two defects in one formula:

1. **The original trip's uncertainty was discarded.** Plan B's robustness test ran off a
   midpoint-derived arrival, so a pessimistic first leg never propagated into the question of whether
   the rescue option is itself robust — precisely where it matters most.
2. **`travel_from_plan_a_to_plan_b` was never defined**, making this the third instance of a formula
   referencing a field the contracts don't produce (after `travel_minutes` and `venue_close`).

The prose immediately beneath the formula already claimed "both travel bounds resolved
independently", which the single-bound formula above it contradicted.

Replaced with an explicit dual-bound chain:

```
plan_b_departure_mid   = plan_a_arrival_mid   + SEAT_CHECK_BUFFER_MINUTES
plan_b_departure_upper = plan_a_arrival_upper + SEAT_CHECK_BUFFER_MINUTES
plan_b_arrival_mid     = plan_b_departure_mid   + fallback_travel_minutes_mid
plan_b_arrival_upper   = plan_b_departure_upper + fallback_travel_minutes_upper
```

`fallback_travel_minutes_mid` / `_upper` derive from `fallbacks[].travel_band` using the same
midpoint-and-upper-edge rule as `access[][].band`, and are now in the symbol table.
`SEAT_CHECK_BUFFER_MINUTES` applies to both bounds — time spent scanning for a seat doesn't depend on
how the journey went.

**The upper bound is deliberately the sum of two upper bounds**, which is the conservative reading and
the intended one: late on leg one, plus the seat check, plus a slow leg two.

Both bounds resolve their own `active_period` independently, each on its own arrival date, since
either can roll past midnight onto a different date from the other. Plan B's `robust` / `tight` /
`shorter` tier follows the same rule as Plan A's, including `active_period_upper` having to exist.

Tests added for the chain, for `plan_b_arrival_upper` deriving from `plan_a_arrival_upper` rather than
the midpoint, and for the two bounds landing on different dates.

## 2026-08-29 — Hours resolution generalised to `resolve_hours(venue, target_date)`

The resolution order was written inline against `selected_date`, while the active-period lookup
separately pulled "periods recorded on" the arrival date and the previous date. Those two paths were
not the same code: the previous date bypassed date overrides, the `overrides_valid_through` horizon,
and the holiday rule entirely.

The consequence was silent and specific: a venue with a **date override on the previous day**, or a
previous day that is a **holiday beyond the horizon**, would have had the wrong after-midnight
periods — or fabricated ones — used for a post-midnight arrival.

Resolution is now a named function of an arbitrary date, `resolve_hours(venue, target_date) ->
{state, periods}`, and **every date goes through it**, including the previous one. Both results are
converted to absolute minutes against their own dates before the period scan.

**`unknown` now propagates explicitly:** if either date resolves `unknown`, the arrival is `unknown`,
not closed. The venue is surfaced as hours-unknown rather than silently filtered out as shut — which
matters because "we don't know" and "it's shut" lead to different decisions.

## 2026-08-29 — The manifest is the sole external asset, and it is optional

Three places claimed the page "loads no external assets" while a fourth stated the manifest is a
separate file. Both cannot be true, and the flat claim was the false one.

Standardised wording, used identically across `plan.md`, `CLAUDE.md` and `README.md`:

> The generated page loads **no external assets except an optional web app manifest**, and functions
> completely without it.

"Optional" is precise, not a hedge: when the manifest is absent or fails to load — exactly what
happens to the AirDropped copy opened from `file://` — nothing degrades except home-screen install.
All data, all logic, every feature still works. The generated-artifact acceptance criteria now include
"exactly one external reference in total, and the page renders and functions correctly when it is
removed".

## 2026-08-29 — `<` corrected from "two-character" to six

The escaping section stated the rule correctly as a **six-character** escape, then four lines later
described the emitted result as "a two-character source sequence". The second was wrong: a backslash
followed by `u`, `0`, `0`, `3`, `c` is six characters in the JSON text, which a parser reads back as
the single character `<`.

Small, but the whole point of that section is byte-level precision about what gets written — and this
is the third time the escape sequence has been stated incorrectly in this document, which is why the
Python expression is now the primary statement of the rule and the prose merely describes it.

## 2026-08-29 — Repository named `study-venue-planner`, published public

Earlier entries recorded that the repo "keeps the name `starbucks-planner` for now". Superseded: on
first push the GitHub repository was created as **`darrensy19/study-venue-planner`**, named for the
real multi-brand scope.

The trigger was deployment, not tidiness. **The repository name becomes the GitHub Pages URL path
prefix** (`darrensy19.github.io/study-venue-planner/`), which the relative-path decision explicitly
depends on. Renaming after Pages went live would have broken every saved link and home-screen
install, so it was worth settling before the first push rather than after.

The local working directory remains `starbucks-planner`. The mismatch is cosmetic and accepted.

**Visibility: public**, per the earlier decision that GitHub Pages' free tier serves only public
repositories. At this point that publishes four planning documents and nothing else — the
privacy-sensitive file (`venues_meta.json`, carrying travel bands and origin labels) does not exist
yet. The commit was scanned for secrets and personal location data before pushing; the only machine
path present is the documented Anaconda one.

## 2026-08-29 — Active-period resolution: positive evidence before missing evidence

The `resolve_hours` generalisation recorded above introduced a short-circuit: if *either* candidate
date resolved `unknown`, the lookup returned `unknown` immediately — before scanning for a matching
period at all.

That discards real information. The previous date only matters for arrivals falling in its
after-midnight tail. If today's hours are known and a known period contains the arrival, the venue
**is** open, and whether yesterday could be resolved is irrelevant to that fact. The short-circuit
would have marked such venues hours-unknown and pushed them out of confident ranking for no reason.

Corrected precedence:

```
1. Resolve hours for both candidate dates.
2. Build candidate periods from every date whose state is known or closed.
3. If any known period contains the arrival, return open.
4. Otherwise, if either candidate date is unknown, return unknown.
5. Otherwise, return closed.
```

The distinction that makes this work is between the two non-contributing states:

| State | Contributes periods | Contributes certainty |
| --- | --- | --- |
| `known` | yes | yes |
| `closed` | no — empty by definition | **yes** — definitely not open then |
| `unknown` | no | **no** — silence, not a negative |

A failed match therefore means `closed` only when every contributing date was *definite*. If any was
`unknown`, the arrival might have fallen inside a period nobody could see, and `unknown` is the honest
answer. `unknown` is still never silently treated as `closed`.

Tests updated to cover the case that motivated this: a known period containing the arrival returning
`open` **while the sibling date is `unknown`**.

## 2026-08-29 — Development tooling untracked from the public repo

`.claude/settings.json` (plugin activation) and `.agents/skills/` (vendored third-party skill content)
are development-environment configuration, not planner product code, and are now untracked and
gitignored. Files remain on disk; the tooling still functions.

The two `.claude/skills/*` symlinks were untracked with them — not an independent decision, but a
forced consequence: they point into `.agents/skills/`, so leaving them tracked would have committed
broken symlinks to a public repo.

**`skills-lock.json` deliberately stays tracked.** It is safe, machine-readable provenance — the two
skills and their source hashes — and is neither plugin activation nor vendored content. It is the
machine-readable counterpart to `skills.md`, which remains the human-readable record of the project's
tooling choices.

Also closed the raw seat-log gap ahead of Phase 2: `data/raw/` and `data/seatlog.raw.csv` are ignored,
while the committed coarsened output `data/seatlog.csv` deliberately is **not** — verified with
`git check-ignore` in both directions, since a rule that caught the output would have broken the
calibration input.

## 2026-08-29 — Raw seat-log staging paths named in the specs, not just in `.gitignore`

The ignore rules were added without the specs ever naming them: `plan.md` and `CLAUDE.md` both said
only that the raw log "stays in iCloud Drive, gitignored". An implementer reading the spec would not
have known *where* to stage a local copy, and any path they invented would not have been ignored.

Since the ignore rules are deliberately narrow — so that `data/seatlog.csv`, the coarsened committed
output, stays committable — a raw file staged anywhere else would have been committed to a public
repo as a timestamped movement history. The narrowness that protects the output is exactly what makes
the convention load-bearing.

**Local staging is restricted to `data/raw/` or `data/seatlog.raw.csv`, and no others.** Both specs
now say so, and both state that any new staging path needs its ignore rule added in the same commit.

## 2026-08-29 — Two naming and wording corrections

- **`skills.md` heading** still read `starbucks-planner`; updated to `study-venue-planner`. It was
  missed in the rename sweep because that pass targeted the four planning docs, and `skills.md` — a
  tracked, public file — was not among them.
- **"Hours resolve for the arrival date, never the departure date"** was left over from the
  single-date model and now contradicts the corrected logic. When travel crosses midnight,
  `arrival_date - 1` **is** the departure date, so the departure date *is* resolved — as the
  previous-date candidate, never as the anchor. Reworded in `plan.md` and `CLAUDE.md` to
  "the arrival date and the date before it, never the departure date alone", with the coincidence
  called out explicitly.
- The directory tree in `plan.md` is annotated to show `starbucks-planner/` is the local working
  directory while the GitHub repo is `study-venue-planner`, so the mismatch reads as deliberate.

## 2026-08-29 — Three prose leftovers contradicting the corrected precedence

Applying the open/unknown/closed precedence rewrote the pseudocode and added the explanation, but
left surrounding prose still asserting the superseded rule. Three statements, all in `plan.md`:

- **`resolve_hours` section** — "`unknown` propagates: if either date resolves to `unknown`, the
  venue's status is `unknown`". Directly contradicted the precedence, and sat in the section an
  implementer reads *first*. Now: "`unknown` propagates only when no known candidate period matches
  the arrival. A known matching period returns `open` even if the sibling date is `unknown`."
- **"If no period matches, the venue is closed on arrival and is filtered out."** Now qualified —
  `closed` only when neither candidate date is `unknown`, otherwise `unknown` and surfaced rather
  than filtered.
- **"Arrival in the gap between two periods means closed."** Same defect, found by a broader sweep
  rather than by the review. An apparent gap is only definitive when both dates are definite; an
  `unknown` date could have held a period covering it.

**Why these survived three consistency sweeps.** Every prior sweep grepped for *phrases I remembered
writing* — "sorts neutrally", "display-only", "never the departure date". These three stated the same
superseded rule in wording I hadn't anticipated ("`unknown` propagates", "closed on arrival", "means
closed"), so no phrase-based search reached them. The sweep that found the third was
concept-based: every assertion containing `closed`, `filtered out`, or `unknown` near a date, read
individually.

**Lesson worth carrying into implementation:** when a rule changes, grep for the *concept* the rule
governs, not for the sentences previously written about it. A phrase-based sweep only finds what the
author already recalls saying.

## 2026-08-29 — Local directory renamed to match the repo; the mismatch is gone

Earlier entries record the GitHub repo as `study-venue-planner` while the local working directory
stayed `starbucks-planner`, and call that mismatch cosmetic and deliberate. **Superseded:** the
directory has been renamed to `study-venue-planner`, so the project now has one name everywhere.

The move preserved everything — `.git`, the index, the remote, branch tracking. The seven staged
tooling deletions and four unstaged doc modifications all survived, since renaming a directory does
not touch repository state.

Path references updated in the same pass: `claude-tooling/README.md`'s relative link and
`claude-tooling/CATALOG.md`'s `cd` target both pointed at the old directory and would have broken.
The clarifying comment added to `CATALOG.md` when the names diverged is now removed, since there is
nothing left to clarify.

`skills-lock.json` needed no change — it stores relative paths, and `.agents/skills/` travelled with
the directory.

---

## 2026-08-29 — Venue list supplied; the seed list moves out of plan.md into a CSV

**24 Starbucks venues in Singapore** — the first batch; four non-Starbucks venues followed the same
day, see the entry below for the final count of 28. Phase 0's only stated blocker is cleared.

The list did not fit the schema `plan.md` defined for it. Two problems:

1. **Four venues are listed in Google Maps as bare "Starbucks"** — 8 College Ave W (138608),
   37 Smith St (058950), 6 Eu Tong Sen St (059817) and 133 New Bridge Rd (059413). Name plus brand
   cannot distinguish them from each other or from the other twenty. The venue-list schema had no
   address column.
2. **A markdown table is not a machine-readable input.** The resolver needs to read the list.

**Decision:** the seed list lives in `data/venue_seeds.csv` — `name,brand,address_hint` — and
`plan.md`'s venue-list section becomes a pointer to it plus the column contract. `address_hint` is
blank except where the name is ambiguous, and its **postal code is the check** the resolver uses:
where a hint is given, a candidate is only `confident` if exactly one result's `formattedAddress`
carries the same six-digit code.

**`venue_id` slugs are not guessed from addresses.** The resolver proposes a slug from the *resolved*
`displayName`; where that comes back as a bare brand name it emits `NEEDS_SLUG:<brand>-<street>` for
a human to name. Deriving "starbucks-utown" from "8 College Ave W" is an inference about what a
building is called, and Phase 0's job is to record what the API returns, not to assert local
knowledge on its behalf.

## 2026-08-29 — The multi-brand check cannot run on a 24-Starbucks list — RESOLVED same day

Phase 0 item 2 is "confirm the Places API path works for a non-Starbucks brand". Every seed in the
first list was Starbucks, so the check had nothing to exercise — and the multi-brand claim is the
stated reason the Places API was chosen over brand-specific store locators at all.

**Resolved:** four non-Starbucks venues added, taking the list to **28 across three brands** —
24 `starbucks`, 3 `coffee_bean`, 1 `baker_and_cook`. Item 2 is now runnable.

Two of the additions test more than "a second brand parses":

- **A Coffee Bean inside West Mall**, the same building as a Starbucks already on the list. Both
  carry postal code 658713, so this is a direct test of whether the `address_hint` postal-code check
  in `phase0_resolve.py` can separate two *different brands at one address* — the case most likely
  to produce a confident wrong answer rather than an honest `ambiguous`.
- **`baker_and_cook` is a bakery-café, not a coffee chain.** Popular Times coverage is likeliest to
  thin out at the edges of the category, and `plan.md` already flags missing histograms as the
  expected failure for non-chain venues.

**New brand vocabulary: `baker_and_cook`.** `plan.md` left the brand list open-ended. Baker & Cook
is a multi-outlet chain, so `independent` would have been wrong — `independent` should mean an
unaffiliated café, not "a brand not yet enumerated". `brand` remains descriptive only; nothing is
computed from it before Phase 3.

**One submission was a duplicate.** "Starbucks - West Mall" was already row 8 and was not added
twice. `phase0_resolve.py` also detects duplicates after resolution, by Place ID — the stronger
check, since two differently-worded seeds can still name one venue.

## 2026-08-29 — API volume ceiling, measured against the real venue count

`plan.md` sized the list at ten. It is 28 — so the volume question is worth answering now rather
than discovering by rate limit.

| Source | Calls per refresh | Free cap | Refreshes/month |
| --- | --- | --- | --- |
| SerpApi (busyness) | 28–56 (see below) | 250 searches/month | **4–8** |
| Places (hours) | 28 | 1,000 calls/SKU/month | 35 |

**SerpApi is the binding constraint, at somewhere between 4 and 8 refreshes a month depending on
how many venues need a retry that day** — see the corrected fetch design in "Popular Times
coverage, take two" (2026-08-29). One live run of all 28 venues spent 31 calls (28 first attempts +
3 retries); worst case, every venue needs the retry and a refresh costs 56. Weekly (4–8 refreshes
possible) fits; daily does not, and is not close either way. This suits the data regardless — Popular
Times is a historical weekly curve and opening hours change rarely, so weekly is the right cadence
on its own merits, not a concession to the cap.

**Superseded:** the paragraph below described the busyness fetcher's *third, wrong* fetch design
(`place_id` → search → `data_id`) and its cost. That design was retracted after being shown wrong on
real data — see "Popular Times coverage, take two" for what replaced it and why.

~~Note the busyness fetcher can spend more than one call per venue: it tries `place_id` first and,
finding no `popular_times`, falls back to a search and then a `data_id` lookup — up to three calls
for that venue. A refresh where many venues take the fallback route could approach double the
figure above. Phase 0 will show which route works, and the estimate should be corrected then.~~

**Both figures were re-verified 2026-08-29** against Google's pricing/data-fields documentation and
SerpApi's pricing page. The planning-time numbers hold, and two details that were not previously
recorded came out of the check:

- **Places bills per field tier, and one request is charged against every tier its field mask
  touches.** This project's mask spans all three: Essentials (`id`, `formattedAddress`, `location`),
  Pro (`displayName`, `businessStatus`, `utcOffsetMinutes`, `timeZone`) and **Enterprise**
  (`regularOpeningHours`, `currentOpeningHours`). Free caps are 10,000 / 5,000 / **1,000** per SKU
  per month, so **Enterprise is the binding tier** and the ~35-refresh figure above is correct. A
  billing account is required regardless of the $0 bill.
- **`timeZone` is a real Place Details field, at the Pro tier.** `scraper/places.py` was written to
  retry without it if the field mask were rejected — that defence is now known to be unnecessary,
  but it is kept, since it costs one branch and covers the field being withdrawn.
- **SerpApi's free plan is throttled to 50 searches/hour** as well as 250/month. With the fallback
  route costing up to three calls per venue, a bad refresh could approach 84 calls and hit the
  hourly ceiling mid-run, not just the monthly one.

**The hand-maintained meta load is the other consequence, and the less tractable one.** 24+ venues
each need `baseline_seatability`, `preference`, per-origin `access`, `fallbacks`, `holiday_policy`
and `wet_weather_mode`. The `access` bands are per venue and independent, but the **ordinal `rank`
is cross-venue** — adding one venue can renumber the rest. That is a Phase 1 problem; noting it here
so it is not a surprise then.

## 2026-08-29 — `histogram_timezone` has to be confirmed indirectly

`plan.md` requires `hours_timezone` and `histogram_timezone` be confirmed **independently**, on the
grounds that the two sources may disagree. Building the fetcher exposed an asymmetry the plan did
not anticipate: **SerpApi states no timezone for the Popular Times graph.** There is no field to
read. Places, by contrast, returns `utcOffsetMinutes` and may return an IANA `timeZone`.

**Decision:** `phase0_busyness.py` confirms the histogram's timezone by cross-checking it against
each venue's *own* opening hours — the first non-zero busyness hour against the earliest regular
opening hour. A venue opening at 07:30 whose graph goes live at 07:00 is in venue-local time. A
systematic offset across every venue would mean it is not.

This is weaker evidence than reading a field, and it is recorded as such. It is also the only
evidence available, which is precisely why the two fields stay separate in the contract.

## 2026-08-29 — Phase 0 harness built before the credentials exist

Neither API account existed when the venue list arrived, so nothing could be *measured*. The probes
were written anyway: `scraper/places.py`, `build/phase0_{common,resolve,hours,busyness}.py` and
`analysis/phase0_spread.py`.

Verified without a key, because unverified code waiting on a credential is a trap:

- `phase0_resolve.py --dry-run` prints the query built for all 24 seeds and makes no calls.
- The hours parser was exercised against a synthetic Places payload covering **all four shapes at
  once** — plain same-day, Fri 07:30→Sat 01:00 (`close: 1500`), a split Tuesday, and a 24-hour
  Sunday encoded as a period with no `close` key. Override-horizon extraction and the shape flags
  were asserted against it.
- `analysis/phase0_spread.py` was run end to end on a synthetic 27-venue set, including one curve
  below `MIN_HISTOGRAM_HOURS` and one venue with no histogram at all, and produced the full report.

**The `N`/`P` proposal is a proposal with its evidence attached, not an answer.** The script reports
the band mix at every candidate `N` and the peak count at every candidate `P`, so the choice can be
argued with. It also prints `plan.md`'s own warning when the median curve range comes in under ~20
points — banding barely discriminates, `baseline_seatability` carries the ranking, and that is a
finding to record rather than a reason to shrink `N` until the bands look busy.

## 2026-08-29 — Phase 0 resolver run for real: all 28 venues, first try, no manual fixes

`build/phase0_resolve.py` ran live against the Places API for the first time. Result: **28 of 28
`confident`, single candidate each, zero duplicate Place IDs, every `business_status: OPERATIONAL`.**
No seed needed a second look from the disambiguation logic itself.

**The West Mall pair is the test this batch existed to run, and it passed.** Row 8 (Starbucks) and
row 26 (Coffee Bean) both carry postal code 658713, and resolved to two distinct Place IDs —
`ChIJd2Ve700R2jERIK2KnTMT4C8` and `ChIJsaG12D4Q2jEREGLtQIJZepU`. The address-hint postal-code check
in `phase0_resolve.py` correctly separated two different brands sharing one building, which was
named in advance as the case most likely to produce a confident wrong answer rather than an honest
`ambiguous`.

**Seven venues came back `NEEDS_SLUG`** — every seed whose Maps name is a bare brand, resolved
against only a street address (seeds 4, 5, 13, 20, 26, 27, 28). Per the rule that a `venue_id` slug
is never inferred from an address alone, these were named by asking the human directly rather than
guessing from the resolved `formattedAddress`. All seven confirmed 2026-08-29:

| Seed | Resolved address | `venue_id` |
| --- | --- | --- |
| 4 | 8 College Ave W, B1-01, 138608 | `starbucks-utown` |
| 5 | 37 Smith St, #01-01 & #02-01, 058950 | `starbucks-chinatown-food-street` |
| 13 | 6 Eu Tong Sen St, #01-29 The Central, 059817 | `starbucks-the-central` |
| 20 | 133 New Bridge Rd, #01-08, 059413 | `starbucks-chinatown-point` |
| 26 | 1 Bukit Batok Central, #01-09 West Mall, 658713 | `coffee-bean-west-mall` |
| 27 | 2 Jurong East St 21, #01-126 IMM Building, 609601 | `coffee-bean-imm` |
| 28 | 271 Bukit Timah Rd, #01-07 Balmoral Plaza, 259708 | `coffee-bean-balmoral-plaza` |

`data/phase0/place_ids.csv` now has 28 rows, no `NEEDS_SLUG` remaining, no `venue_id` collisions.
This is the input `build/phase0_hours.py` reads next.

## 2026-08-29 — `build/phase0_hours.py` run live: timezone confirmed, and a real gap found in `resolve_hours`

**`hours_timezone` is settled.** All 28 venues report `utcOffsetMinutes: 480` and `timeZone.id:
"Asia/Singapore"` — no disagreement, no missing field. `phase0_hours.py`'s retry-without-`timeZone`
branch never fired.

**Two bugs were found and fixed in the parser before the report could be trusted, and one real
architectural gap survived the fix.** All three came from the same discovery: Google represents a
period with no `close` key as **open every day of the week**, anchored to a single `day` value in
the JSON — not "open only on that one day", which is what a literal read of the field suggests.

1. **Parser bug (fixed).** `parse_regular` was assigning that always-open period only to its anchor
   weekday, leaving the other six days absent from `regular_hours`. `weekdayDescriptions` on the raw
   response ("Monday: Open 24 hours" ×7) proved this was wrong for Starbucks SingHealth Tower,
   Jurong Point and Coffee Bean West Mall. Fixed: an always-open period is now written to every
   weekday.

2. **Report bug (fixed).** `describe_shapes` folded any `close > 1440` into one `after_midnight`
   flag, whether the spillover was a few hours or several days. Split into `after_midnight` (spills
   into exactly the next calendar day) and a new **`multi_day_period`** (spills two or more days
   ahead) — the distinction is load-bearing, not cosmetic, see finding 3.

3. **Real hours shape, not a bug — `multi_day_period` is genuine at three venues, and it breaks a
   stated non-negotiable.** Starbucks UTown, The Central and Hillion Mall each run one continuous
   period spanning several calendar days — e.g. UTown: Sunday 07:30 straight through to the
   following Saturday 17:30 (`weekdayDescriptions` confirms "Open 24 hours" Mon–Fri, closing briefly
   Saturday evening into Sunday morning). This is a single API period with `open.day = 0`,
   `close.day = 6`.

   **`CLAUDE.md` states `resolve_hours` candidates are the arrival date **plus** the date
   immediately before it, and no other** — "hours resolve for the arrival date and the date before
   it, never for the departure date alone." That rule is correct and sufficient for a period that
   spills into *exactly* the next calendar day (the ordinary after-midnight case). It is not
   sufficient for UTown's period: an arrival on, say, Wednesday would need to trace back to Sunday's
   period — three days, not one — to find the period that covers it. Left as encoded, every weekday
   this period touches except its anchor day would read as `day_absent_from_regular_hours`, i.e.
   `unknown`, for a venue that is in fact open.

   **This was measured on real data, not hypothesised: 3 of 28 venues (~11%).** Not an edge case
   worth deferring.

   **Not fixed here — Phase 0 measures, Phase 1 builds, per `CLAUDE.md`'s "work one phase at a time."**
   The resolution direction worth carrying into Phase 1: **decompose a multi-day period into one
   bounded period per calendar day at ingestion time**, each anchored to its own day's midnight,
   using the existing single-day spillover encoding (`close` up to 2880) as the link between
   consecutive days in the chain. Worked through by hand against UTown's case, this preserves
   `resolve_hours`'s one-day lookback exactly — the fetcher normalises the shape away before
   `resolve_hours` ever sees it, rather than the resolution function growing a variable-length
   lookback. This is a proposal for Phase 1 to design and test properly, not a decision made here.

**A related, smaller finding: `currentOpeningHours` overrides for a 24/7 venue also arrive as one
period spanning the whole override horizon**, with `truncated: true` on both endpoints — Google's
own signal that the boundary is an artifact of the query window, not a real event. Seen on seeds 2,
18 and 26. `phase0_hours.py` does not currently read `truncated`; noted here as a field Phase 1's
fetcher should capture, not yet built.

**The override horizon is not a flat constant.** `overrides_valid_through` measured **1, 2 or 7 days
ahead** depending on the venue, not a uniform week. `plan.md` already models this as a per-venue
field, so no contract change is needed — this confirms that design choice was right rather than
correcting it.

**All 28 venues: `business_status: OPERATIONAL`.** No closures, no relocations in this batch.

## 2026-08-29 — `build/phase0_busyness.py` run live: a key-leak bug fixed, one route bug fixed, and `histogram_timezone` confirmed clean

**Security bug in this repo's own code, fixed before it recurred.** The script's generic
`except Exception` handler let `requests.HTTPError`'s default message through unmodified, and that
message embeds the full request URL — including `api_key=` in plain text. It printed to the
terminal and, once pasted here for diagnosis, into this conversation's transcript. Fixed:
`serpapi_get` now catches the HTTP error itself and re-raises with the key redacted before any
caller can print it. Verified the raw JSON response bodies never echo the key back (SerpApi's
`search_parameters` field lists request params but not credentials) — the exposure was the error
path only, not the saved data. **The SerpApi key was exposed twice this session** — once via a
`.env` file-change diff, once via this bug — both non-billing-account, free-tier exposures with no
financial risk, but rotation was offered both times per the same standard applied to the Places key
earlier.

**A second, unrelated bug in the fallback chain, also fixed.** `fetch_one`'s third tier (place
search → `data_id` → place lookup) sent the resolved CID under the request parameter name
`data_id`. SerpApi's `type=place` endpoint does not accept that name — verified directly against
the API: `data_id` returns HTTP 400, body "Missing query `data`, `place_id` or `data_cid`
parameter."; the correct parameter is **`data_cid`**. Confirmed once resolved on Starbucks Delfi
Orchard's CID.
No venue in this batch actually needed this fallback tier to succeed (see below), so the bug never
silently corrupted a result — it only ever produced a clean, visible `FAILED` — but it would have
kept every third-tier venue failing indefinitely once one existed.

**`histogram_timezone` is confirmed: `Asia/Singapore`, matching `hours_timezone` exactly.** SerpApi
states no timezone field for the Popular Times graph, so `phase0_busyness.py` cross-checks it
indirectly — first non-zero busyness hour against each venue's own earliest opening hour. Of the
venues eligible for this check, **every single one shows exactly 0h offset.** Four venues (seeds 13,
18, 19, 26) were excluded from the check rather than counted: they carry the `multi_day_period` flag
from the hours step, whose known parsing gap (a multi-day period is only recorded under its anchor
weekday) makes their *derived* earliest-open-hour wrong in a way unrelated to timezone — including
them the first time this ran produced a false `[-7, -6]`-hour "mismatch" that was really this same
gap, not two sources disagreeing. Excluding the contaminated venues rather than patching the
symptom keeps this measurement honest: **0h offset, zero exceptions, is now a clean result.**

**Popular Times coverage: 21 of 28 (75%) confirmed present, 6 of 28 (21%) confirmed absent, 1 of 28
(4%) genuinely unresolved — three different states, not two.** ~~The `place_id` route alone
accounted for all 21 successes; the fallback chain (search → data_cid) never once produced usable
data in this batch.~~ **SUPERSEDED — every part of this coverage claim was wrong. See "Popular
Times coverage, take two" below.** The `place_id` route was not merely incomplete, it was actively
unreliable, and 5 of the 7 venues called "absent" or "unresolved" here turned out to have real data.

- ~~**Confirmed absent**~~: `starbucks-singhealth-tower`, `starbucks-utown`, `starbucks-fusionopolis`,
  `starbucks-tekka-place`, `starbucks-valley-point`, `starbucks-the-cathay`. **Only the first two are
  actually absent** — see below.
- ~~**Genuinely unresolved**~~: `starbucks-delfi-orchard`. **Has real data**, retrieved once the
  correct request was used — see below.

**Correction to a guess made earlier this session:** I predicted `baker_and_cook` — a bakery-café,
not a coffee chain — was the venue most likely to have thin or missing Popular Times coverage. It
returned a full 126-hour histogram on the first (`place_id`) route. The prediction was reasonable
but wrong; recorded here rather than left standing uncorrected.

## 2026-08-29 — Popular Times coverage, take two: the "confirmed absent" list was mostly wrong

**How this was caught: the user checked Google Maps directly and it disagreed with this report.**
Five venues this session had already called `absent` or `unresolved` — Delfi Orchard, Fusionopolis,
Tekka Place, Valley Point, The Cathay — were shown, one screenshot at a time, to have a real Popular
Times graph on Maps. That is the only reason this got caught: nothing in the code raised a flag,
because every one of those responses came back as valid, well-formed, **empty** JSON. A negative
result that looks exactly like a positive one is the failure mode worth remembering here, not the
specific parameter names below.

**Three fetch designs were tried and retracted in sequence, each disproven by a fresh piece of
evidence rather than by inspection:**

1. **`type=place&place_id=...` as the sole lookup** (the original design). Wrong: silently omitted
   `popular_times` for at least 4 of the 6 "confirmed absent" venues.
2. **Always search, then always a second `type=place&data_cid=...` call** when the first came back
   empty. Fixed the wrong parameter name, but missed that this project's queries (venue name + exact
   address) make Google/SerpApi's search **collapse directly to a `place_results` object** —
   `search_information.local_results_state` literally reads *"Showing results for type: place
   instead of type: search"* — and that object already carries `popular_times` when the venue has
   any. Checking only for a `local_results` list treated every one of these fully-populated,
   collapsed responses as "no match", which made things briefly much worse (27 of 28 read
   `no_search_match` on this design) before the collapse behaviour was found and handled.
3. **Trusting an empty `popular_times` on the first response — collapsed or not — as a confirmed
   absence.** Still wrong. Retrying Fusionopolis and HillV2 via the `data` parameter (built from the
   `data_id` and `gps_coordinates` already present on that same first response) returned real
   histograms on the second attempt. **The omission is intermittent per call, not a property of the
   venue.** Only SingHealth Tower and UTown stayed empty after *both* the first response and the
   retry — and those two are exactly the pair the user independently confirmed absent by checking
   Maps directly, before this retry logic existed to prove it a third way.

**The validated design, in `build/phase0_busyness.py`'s current `fetch_one`:** search once; if
`popular_times` is present, done, one call. If not, extract `data_id` + `gps_coordinates` from
whatever the search returned (the collapsed `place_results`, or the top `local_results` candidate)
and retry via the `data` parameter — `!4m5!3m4!1s{data_id}!8m2!3d{lat}!4d{lng}`. **Absence is only
recorded once both calls have come back empty.**

**Corrected coverage: 26 of 28 (93%) confirmed present, 2 of 28 (7%) confirmed absent, 0
unresolved.** The two absences — `starbucks-singhealth-tower` and `starbucks-utown` — are the only
ones that survived a retry *and* a direct user check of Google Maps; there is no third state left to
explain away. `data/phase0/histograms.json` and `busyness_report.md` were regenerated from this run
and are what's committed; nothing from the two earlier, wrong runs is.

**Cost, corrected.** Per venue is now **1 call if the search collapses with data, 2 if a retry is
needed** — not a flat number either way. This run spent 28 first-attempt calls plus 3 retries
(seeds 6, 9, 22) = 31 total for 28 venues, but that ratio isn't load-bearing: which venues need a
retry looked partly random across identical repeated calls (finding 3, above), so a future refresh
could easily need more. **The API-volume estimate in "API volume ceiling" (below) is corrected on
that basis, not on today's specific 31.**

## 2026-08-29 — `N` and `P`, recomputed against the corrected coverage: unchanged

Re-ran `analysis/phase0_spread.py` after the coverage fix, since `N`/`P` were computed against
data that was missing 5 of 26 now-known-real histograms. Eligible curves rose from 147 to **182** of
196 (the 5 recovered venues × 7 days, minus the usual closed-hour exclusions). The proposed values
barely moved:

| | 21-venue dataset (wrong) | 26-venue dataset (corrected) |
| --- | --- | --- |
| Median per-curve range | 56.0 | 54.5 |
| Proposed `N` | 15 | **15** |

**`N = 15` holds.** The coverage bug changed *which* venues were measured, not the shape of a
typical curve — reassuring, since it means the earlier `N` wasn't an artifact of a biased sample.
`P` remains unresolved for the same reason as before: every candidate down to 0 already fit.

## 2026-08-29 — `P = 5`, set by eyeballing real curves rather than a grid search

The grid search in `analysis/phase0_spread.py` never bracketed an answer — every candidate down to
and including 0 already averaged 1–3 peak hours per curve. Resolved by hand: pulled four real
open-hours-only curves covering different shapes (a gentle single hump, two genuine lunch plateaus,
and a sharp single-hour spike) and checked what each candidate `P` actually selects.

| Venue (day) | Shape | Peak hours at `P=5` | Peak hours at `P=10` |
| --- | --- | --- | --- |
| Centrepoint (Mon) | gentle hump, max 90 at 14:00 | 1 (14:00) | 3 (12:00–14:00) |
| United Square (Sat) | lunch plateau, 99–100 at 12–13:00 | 2 (12–13:00) | 4 (11:00–14:00) |
| UE Square (Wed) | lunch plateau, 94–96 at 11–12:00 | 2 (11–12:00) | 4 (10:00–13:00) |
| One Holland Village (Sat) | sharp spike, 100 at 09:00, drops to 61 by 11:00 | 1 (09:00) | 2 (09–10:00) |

**`P = 5` isolates the genuine peak(s) on every shape tested** — one hour on a sharp spike, two on a
real plateau. **`P = 10` starts pulling in hours that are meaningfully lower than the max** (e.g.
Centrepoint's 12:00 at 80, ten points under its 90 max) and stops reading as "the worst hour,"
reading instead as "the whole busy afternoon" — which `busy` already covers. `P = 5` is the smallest
candidate past the grid's degenerate `P = 0` case (a single bucket ordinary noise could move), so it
was preferred over 0 on the same reasoning `spread_report.md`'s own caveat gave.

## 2026-08-29 — `venue_type` opened up from six fixed values to a free-text, extensible field

`plan.md` already called `venue_type` "small, extensible" when it proposed the original six values
(`large_cafe`, `mall_cafe`, `office_cafe`, `takeaway_heavy`, `small_kiosk`, `independent_cafe`), but
`CLAUDE.md` stated it as a closed parenthetical list, and the real 28-venue list needed more
precision than six categories give: a hospital-tower café, a university-campus café, a heritage
colonial-bungalow café, a clubhouse café, a food-street tourist café, and a strip-mall café — none of
which reads honestly as `large_cafe` or `mall_cafe` just to fit an existing box.

**Resolved: six new values added** — `hospital_cafe`, `campus_cafe`, `tourist_cafe`,
`clubhouse_cafe`, `standalone_cafe`, `strip_mall_cafe` — and `CLAUDE.md` corrected to state the field
is free-text, not a fixed enum. Three of these had two reasonable names on offer and were decided
directly with the user rather than picked unilaterally:

| Venue | Considered | Chosen |
| --- | --- | --- |
| Starbucks Rochester Park (standalone colonial bungalow) | `heritage_cafe` vs `standalone_cafe` | `standalone_cafe` |
| Baker & Cook Eng Kong Park (standalone bakery-café, landed estate) | `independent_cafe` vs `neighbourhood_cafe` | `independent_cafe` — already in the original six, no new value needed |
| Coffee Bean Balmoral Plaza (low-rise commercial strip) | `street_cafe` vs `strip_mall_cafe` | `strip_mall_cafe` |

The caveat this field already carried is unaffected by widening it: **descriptive only, nothing
computed from it until Phase 3 shows it predicts something.**

## 2026-08-29 — `data/venues_meta.json` created — the Phase 0 deliverable that had been missed entirely

`plan.md` assigns `venue_type` and `area` to Phase 0, separate from the judgement fields
(`baseline_seatability`, `preference`, `access`, `fallbacks`, etc.) that are explicitly Phase 1's job.
The file itself had never been created this session — caught only when closing out Phase 0 and
checking the acceptance list line by line rather than trusting memory of what had been done.

**Scope kept deliberately minimal**, matching exactly what `plan.md` assigns to this phase: `brand`,
`venue_type`, `area`, and `baseline_seatability: "unknown"` for all 28 venues — the judgement fields
are left absent, for Phase 1 to add by hand, not pre-guessed here. `venue_type` and `area` were
proposed from each venue's resolved address and confirmed with the user; four were corrected or
reclassified (Rochester Park, HomeTeamNS Bukit Batok, Baker & Cook, Coffee Bean Balmoral Plaza — see
the `venue_type` entry above) and three were reassigned to new, more precise types (SingHealth
Tower, UTown, Chinatown Food Street).

**A real bug surfaced and was fixed while building the venue list for this file:** seed 25's
`venue_id` read `baker-and-cook-baker-cook-eng-kong-park` — the brand slug prepended twice.
`propose_venue_id()` in `phase0_resolve.py` checked `slug.startswith(brand_slug)` to avoid doubling
up, but `slugify()` drops `&`, so "Baker & Cook"'s slug (`baker-cook-...`) never matches the brand
slug built from `baker_and_cook` (`baker-and-cook`) — the check failed to recognise the overlap and
prepended anyway. Fixed to compare token sets instead of a literal prefix, which is robust to
punctuation differences between a brand's `venue_seeds.csv` identifier and its Google-resolved
display name. Confirmed no other of the 28 venue_ids has the same defect (scanned for any brand-name
token repeated in its own venue_id). `data/phase0/place_ids.csv` row 25 corrected to
`baker-cook-eng-kong-park`.

## 2026-08-29 — `N` and `P`: the first spread analysis measured the wrong thing, corrected before being trusted

**The bug.** `analysis/phase0_spread.py`'s first run against real data reported a median per-curve
range of **82.0 points** and proposed `N = 25`. Every non-24-hour venue showed `Min: 0` on every
single weekday, which was the tell. Checked directly against Starbucks Centrepoint's raw Monday
data: busyness reads 0 at 06:00 and 07:00 (before its 08:00 open) and 0 again at 22:00–23:00 (after
its 22:00 close), while the actual open-hours values run 44–90. **Popular Times reports 0 busyness
for hours a venue is closed. That is a fact about closure, not a `quiet` reading**, and letting it
into the median/range/percentile math measures "closed vs peak" instead of "quiet vs busy while
open" — the entire point `relative_busyness` exists to capture, per `CLAUDE.md`: "is this an
unusually good or bad time to visit **this particular venue**", implicitly at a time someone would
actually go.

**The fix.** `phase0_spread.py` now joins each venue/weekday curve against that same day's
`regular_hours` from `hours_summary.json` and drops any hourly bucket outside the recorded open
period before computing anything. A day whose hours could not be determined (the
`day_absent_from_regular_hours` gap on a `multi_day_period` venue) filters to zero open hours and
correctly falls out of eligibility, rather than being scored against a guessed period. No curve
dropped below `MIN_HISTOGRAM_HOURS = 6` as a result — the lowest post-filter curve still cleared it
more than double.

**Corrected measurement — this is the one to trust:**

| Measure | Before fix (wrong) | After fix (real) |
| --- | --- | --- |
| Median per-curve range | 82.0 | **56.0** |
| Proposed `N` | 25 | **15** |
| Closed-hour buckets in the data | included | **397 excluded** |

**`N = 15`, set from measurement, not guessed.** Median range of 56 points is comfortably over the
~20-point flat-curve threshold `plan.md` set in advance — banding will discriminate, and this
result does **not** trigger that finding.

**`P` remains genuinely unresolved, both before and after the fix.** Every candidate on the grid
down to and including 0 already averaged 1–3 peak hours per curve, so the grid never bracketed an
answer from below — `P = 0` is the least-bad candidate tested, not a confirmed value. `P = 0` means
"exactly at the maximum," which lets `peak` fire on a single bucket that ordinary noise could shift.
**Before Phase 1 locks in `P`, look at actual curve shapes** (`data/phase0/spread_report.md`'s
per-venue table) rather than trust this grid search alone.

**`very_quiet` evidence survives the fix, on a different set of venues than the buggy run showed.**
Jurong Point, Hillion Mall, United Square, Coffee Bean (mon) and Baker & Cook show repeatable
troughs ≥`2N` = 30 points below their median on 6+ of 7 weekdays. The buggy run's version of this
same finding named a different, overlapping set of venues — a further sign the earlier numbers were
measuring something other than intra-day crowding.

## 2026-08-29 — Environment facts that differ from the plan's assumptions

- **The venv is built on `/Users/darrensy/anaconda3/bin/python3` (3.11.4).** The only alternative
  present is `/usr/bin/python3` at 3.9.6. `CLAUDE.md`'s rule stands unchanged and matters more than
  ever: invoke `.venv/bin/python3`, never bare `python3`.
- **Node is v18.15.0, and Phase 1's test setup as specified will not run on it.** `plan.md` calls
  for `tests/js/` under `node --test` importing `web/ranking.js` as a real ES module; without
  `"type": "module"` resolution a `.js` file with `export` is parsed as CommonJS and throws.
  nvm has v24.19.0 available. **Flagged, not fixed** — `CLAUDE.md` says work one phase at a time,
  and this is Phase 1's problem to solve when Phase 1 starts.
- **`data/phase0/raw/` is gitignored**, with the rule added in the same commit as the path, per the
  narrow-ignore-rules requirement. The dumps are bulky and regenerable; the reports and summaries
  beside them are committed, because they *are* the Phase 0 record. The raw responses are kept
  locally because Phase 1's parser fixtures will be trimmed copies of these exact payloads.

## 2026-08-29 — Independent review of the closed Phase 0: two real bugs in the analysis script itself

Phase 0 was declared closed and pushed at `4b2fd13`. An independent review of that state — offline,
against the committed artifacts and raw responses, no new API calls — found two real defects in
`analysis/phase0_spread.py` and two documentation staleness issues. **All four claims were verified
directly against the code and data before anything was changed**, not accepted on the review's say-so:

1. **`filter_to_open_hours` did the opposite of what it claimed.** `phase0_spread.py:105` read
   `if periods is None: return buckets` — passing through the *raw, unfiltered* buckets, including
   closed-hour zeros, on exactly the case (a weekday absent from `regular_hours`) its own docstring
   said got "filtered to nothing." **Measured scope, corrected: 4 eligible curves, not 8.** Seeds 4,
   13 and 19 each have weekdays missing from `regular_hours` (the `multi_day_period` gap), but seed 4
   (`starbucks-utown`) has **no Popular Times histogram at all** — its raw bucket count is 0 for every
   day regardless of this bug, so its 6 missing weekdays never contributed a contaminated curve. Only
   seed 13 (The Central, Saturday and Sunday) and seed 19 (Hillion Mall, Saturday and Sunday) — 4
   curves — actually had real histogram data (22-24 raw buckets) leaking through uncontrolled.
   **Fixed:** `periods is None` now returns `[]`.

2. **The same function truncated a venue's last open hour whenever its closing time wasn't
   hour-aligned.** `open_hour_set` computed `end_hour = close // 60` — floor division — so a venue
   closing at 17:30 (`close = 1050`) got `end_hour = 17`, excluding the 17:00 bucket entirely even
   though the venue is genuinely open for half of it. **Measured scope, corrected: 40 curves actually
   lost a bucket, not 42.** 42 (venue, weekday) pairs close on a non-hour boundary, but 2 of those are
   the same `multi_day_period` venues from finding 1 (seed 4 Sunday, seed 19 Friday), whose `close`
   values are the multi-day span figures (9690, 4290 minutes) — capped at `1440` before the hour
   division, landing the "recovered" hour at 24, which is never a valid histogram bucket. Those 2
   structurally match the bug's trigger condition but had no real data to recover. **Fixed:** ceiling
   division (`-(-close // 60)`) — a partial hour still counts, an exact-hour close still excludes the
   hour after it.

3. **`very_quiet_evidence` grouped by display name, not identity**, and four venues in this dataset
   are all literally named "Starbucks" in Google Maps (disambiguated only by address — see the
   `NEEDS_SLUG` entries from venue resolution). Their curves were merging into one dict entry with up
   to 4×7=28 weekday slots. `spread_report.md` printed "Starbucks — 17" and "The Coffee Bean & Tea
   Leaf — 8" — both impossible for a real venue, which has at most 7 weekdays. **Fixed:** grouped by
   `venue_id` (propagated from `proposed_venue_id`, already present on every `histograms.json` entry
   from the resolve step), with the report label showing `Display Name (venue_id)` so two
   same-named venues that both qualify can no longer collide into one row either.

4. **`README.md` and `plan.md` still said Phase 0 hadn't run.** Both files had their *specific*
   answered items updated throughout this session (timezone, hours shapes, coverage, `N`, `P`,
   venue count) but the *top-level framing* above those items — "Phase 0 is written but not yet run,"
   "neither account exists yet" — was never revisited after Phase 0 actually closed. A real
   consistency-sweep miss: the details were kept current, the headline wasn't. Also caught: `plan.md`
   cited a coverage range of "14–24 buckets," a stale figure from an earlier run — the currently
   committed report said 9-24 at review time, and now reads 10-24 after fixes 1-2 above shifted which
   buckets are counted. **Fixed:** both files corrected to state Phase 0 is closed, and the coverage
   figure now cites whatever `spread_report.md` currently says rather than a copied-in number that
   will drift the next time the report regenerates.

**Re-ran `analysis/phase0_spread.py` after fixes 1-2 to check the actual impact, not trusting the
review's own recalculation at face value either:**

| | Before this fix | After this fix | Review's independent recalculation |
| --- | --- | --- | --- |
| Eligible curves | 182 of 196 | **178 of 196** | not stated |
| Median per-curve range | 54.5 | **54.0** | 54.5 |
| Proposed `N` | 15 | **15** | 15 |
| `P` grid proposal | 0 | **0** | 0 |

`N` and the `P` grid result hold exactly. The median range moved slightly further than the review's
own figure (54.0 here vs. their stated 54.5) — a small discrepancy, most likely from a difference in
exactly how each of us handled the boundary cases, and not investigated further since it doesn't
change any decision: still comfortably over the ~20-point flat-curve threshold, `N` unaffected.

**The `P = 5` justification was re-checked on real, corrected data, not assumed to survive.** Two of
the four example curves used to justify `P = 5` (United Square, One Holland Village, both Saturday)
close on a half-hour and were directly affected by fix 2 — each was missing its true final bucket
(16 and 35 respectively, both correctly quiet, neither a new peak). Recomputed: both curves still
show exactly the same peak-hour counts at `P = 5` (2 and 1) as originally reported. **`P = 5` stands,
verified against the fix, not just carried over.**

`data/phase0/hours_summary.json` and `data/phase0/histograms.json` also still carried the pre-fix
`venue_id` for Baker & Cook (`baker-and-cook-baker-cook-eng-kong-park`, from the slugify bug fixed
earlier) even though `place_ids.csv` and `venues_meta.json` had been corrected. Patched both files
directly — no new API calls, since this is metadata already fetched, not new data.

**SerpApi key rotated, 2026-08-29.** It had been exposed twice in this session's transcript (a
`.env` file-diff, and the error-handling bug fixed the same day). Rotated via the SerpApi dashboard;
verified afterward — without printing the key itself at any point — that `.env`'s value differs
from the previously-exposed one and that a live call to SerpApi's account endpoint succeeds under
the new key (`plan_searches_left: 188`, `this_month_usage: 62`, consistent with this session's
actual call volume). The exposed key is no longer valid.

## 2026-08-29 — Hours ingestion: five defects resolved as one contract, before any fetcher exists

`README.md`'s Phase 1 step 1 asked for one thing — resolve the `resolve_hours` multi-day-period gap
Phase 0 measured. Re-deriving the design against the real Phase 0 artifacts found **four more defects
in the same ingestion step**. Two would have produced visibly wrong answers on real venues the moment
`fetch_hours.py` existed; one would have silently defeated the multi-day fix. They are recorded as one
decision because they live in one place — turning a raw Places payload into the contract — and none
can be deferred past the fetcher.

**No code was written for this entry.** Phase 0 measures, Phase 1 builds; this records the design.

### The five defects, all measured against the saved payloads

| # | Defect | Scope |
| --- | --- | --- |
| 1 | A multi-day period is stored only under its anchor weekday; every other day it spans reads `unknown` | 3/28 — UTown (`day_gap=6`), The Central, Hillion Mall (`day_gap=2`) |
| 2 | `always_open` encoded as `{open:0, close:1440}` — a fabricated midnight close on a venue that never closes | 3/28 — seeds 2, 18, 26 |
| 3 | `truncated: true` endpoints treated as real events rather than window edges | 7/28 — seeds 2, 4, 5, 13, 18, 19, 26 |
| 4 | `overrides_valid_through` derived from opening dates rather than the real window | 4/28 understated |
| 5 | The override map is **sparse**, so a special closure silently falls back to regular hours | structural |

Defect 5 is the most dangerous — a genuine closure has no opening period, so the venue would be shown
as open on a day it is shut. Defect 2 is the most frequent: a 22:00 arrival wanting six hours computes
`surplus = (1440−30) − (1320+360) = −270` and is relegated to `shorter` every evening at a venue that
never closes. Defect 3 gates defect 1, because current hours outrank regular hours unconditionally.

### The source contract, quoted from primary source

Fetched directly rather than taken second-hand, from
`developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places`:

> "The hours of operation for the next seven days (including today) incorporating any special opening
> hours. The time period starts at midnight on the date of the request and ends at 11:59 pm six days
> later. If the actual opening hours are outside of this range, the opening hours will be truncated."

> "Whether or not this endpoint was truncated. Truncation occurs when the real hours are outside the
> times we are willing to return hours between, so we truncate the hours back to these boundaries."

So the window is **fixed and computable**, and a truncated endpoint is **by definition a window
artifact** — never a real opening or closing event.

### 1 — Multi-day periods are decomposed at ingestion

For a `regularOpeningHours` period with anchor weekday `D0`, open `T0`, close weekday `D1`, close
time-of-day `T1`, where `day_gap = (D1 − D0) mod 7 >= 2`, write `day_gap + 1` entries:

```
weekday_k = (D0 + k) mod 7          for k = 0 .. day_gap
open_k    = T0 if k == 0 else 0
close_k   = T1 + 1440 * (day_gap - k)
```

`state: "known"` on each, **appended** to that weekday's list, never overwriting. `day_gap` 0 and 1 are
untouched — the ordinary after-midnight case is already correct.

Verified at the maximum span. UTown (`T0=450`, `T1=1050`, `day_gap=6`): `k=0` reproduces the stored
`{open:450, close:9690}` exactly; `k=6` gives `{open:0, close:1050}`, an ordinary same-day close, so a
Saturday 18:00 arrival now resolves `closed` instead of `unknown`.

**`resolve_hours`, the one-day lookback and the `{open, close}` encoding are unchanged.** Each touched
day carries a self-contained entry anchored to its own midnight.

**`currentOpeningHours` decomposes by calendar date, never by weekday modulo** — its endpoints carry
explicit `date` objects, so the span is a plain date difference and `mod 7` must not appear.
`continues_beyond_window` propagates to **every** derived entry of a truncated chain, not only the one
on the final date: they share a single absolute close instant, so if it is an artifact it is an
artifact for all of them, and any of them may be the entry a lookup matches.

**This corrects the fix direction sketched in "`build/phase0_hours.py` run live" above.** That entry
proposed chaining days "using the existing single-day spillover encoding (`close` up to 2880)". That
does not survive UTown: capping `close` at 2880 loses the true close for spans over two days (UTown's
Monday entry needs `close = 8250`) and reintroduces an artificial midnight close. Each day carries the
true remaining distance, uncapped.

**Extending the lookback to seven days was rejected — but on narrower grounds than first argued.** The
claim that "any one of seven dates resolving `unknown` would drag an otherwise-known arrival to
`unknown`" was **wrong**: under the positive-evidence precedence recorded above, a known period
containing the arrival returns `open` regardless of a sibling's state. The real cost is that it widens
only the **no-match** case — more candidate dates make a failed match likelier to resolve `unknown`
rather than the definite `closed` it should be — and multiplies `resolve_hours` calls sevenfold for a
case ingestion already handles.

### 2 — `always_open` becomes a genuinely unbounded period

`{open: 0, close: 1440, always_open: true}` becomes a period with **no `close` key**:
`{"open": 0, "always_open": true}`. The period **records no known close** — a fact about that source
period, not a promise about other dates. **Only after the cross-date authority walk verifies the
required span** is `venue_close_abs` unbounded within it, with `closing_buffer` having nothing to apply
against and `latest_leave_at` set to `UNDETERMINED`. The UI says **"no known closing constraint within
the verified span"**, never "no latest departure" — nothing looked past `required_end_abs`, so nothing
may claim what lies beyond it.
`null` is deliberately not used — it was already rejected here for making a fetch failure
indistinguishable from a closure.

**Scoped, not blanket.** The unbounded result holds only where the **resolved** hours for every date
the session spans are this form. A current-hours closure or an `unknown` date **overrides the regular
24/7 schedule**. "Always `robust`" is a property of the resolved period, never of the venue.

### 3 — `truncated` marks a window edge, never an event

`open.truncated` is valid only at the window's first date, 00:00; `close.truncated` only at the final
date's boundary. A truncated close reported as 23:59 normalises to the **exclusive next midnight** and
carries `continues_beyond_window: true`. **Interior or inconsistent truncation fails validation**
rather than being guessed through.

**The normalisation reproduces an independently known answer.** Seed 5's truncated Friday close
normalises to Saturday 00:00, and its `regular_hours` records Friday's real close as `1440` — Saturday
00:00 exactly.

### 4 — The current-hours window is computed, then validated

Record **both** `current_hours_valid_from` and `current_hours_valid_through`, computed from the
request's local date as start through start + 6 days, then **validate** that every period endpoint date
falls inside it. The documented contract is the source; the data is the check, so a future change in
Google's window fails loudly instead of silently.

**This supersedes the "override horizon is not a flat constant" entry above.** That entry recorded the
horizon as "1, 2 or 7 days ahead depending on the venue" and read the spread as *confirming* the
per-venue field design. **The spread was an artifact of `parse_overrides` keying on opening dates.**
Measured across all 28 saved payloads, every venue covers 2026-08-29 through 2026-09-04 — a flat
seven-day window. The per-venue field stays, now holding a validated window rather than an accident,
but the evidence cited for it was wrong.

### 5 — Current hours are a complete schedule, not a sparse exception list

`parse_overrides` creates an entry only for dates on which a period *opens*, while `resolve_hours`
falls back to `regular_hours` when an entry is absent. **A special closure has no opening period**, so
it produces no entry, and the regular schedule is silently resurrected on a day the venue is shut.
Demonstrable in the committed data today — seed 13's dates run `2026-08-29, 2026-08-31, …`, with
`2026-08-30` simply absent.

All seven dates are now **materialised**, each explicitly `known` or `closed`, with coverage computed
from *all* periods including those spanning in from an earlier date (seed 13's `2026-08-30` is covered
by the `2026-08-29` period and is `known`, not `closed`). Inside the window a missing entry is
**malformed data**, surfaced as such — never "use regular hours". Outside it: known holiday →
`unknown`, otherwise `regular_hours`.

**`date_overrides` is renamed `current_hours_by_date`**, because it is a complete current schedule, and
the old name invites exactly the sparse reading that caused this defect.

### 6 — Feasibility requires continuous known coverage, including across the window edge

Being open *on arrival* does not prove the session fits. `state: known` per spanned date is necessary
but not sufficient — the next date may be known and closed, or known and reopening later, and a period
ending at a window edge is not a real close. For the midpoint and upper bounds **independently**:

1. Derive the **effective continuous known open run** from the active period. `closing_buffer` is inside
   the span deliberately — it can cross midnight when the session does not.
2. Where a matching period ends at a `continues_beyond_window` boundary, resolve the next date and try
   to join.
3. **Join only if the next date's known period begins exactly at 00:00**; `effective_close` becomes
   that period's real close, which may itself be unbounded.
4. Next date known but with a gap at 00:00 → **the venue genuinely closes at the gap**, and that is a
   *known* close.
5. Run cut short by an **`unknown`** boundary before `arrival + duration + closing_buffer` →
   **hours-unknown, not ranked at all**.
6. Otherwise compute `surplus_*` against `effective_close` and apply the **ordinary tiers unchanged**.

**This does not abolish `tight`, and an earlier draft of this rule would have.** Demanding literal
continuous coverage of the whole interval would relegate a venue closing one minute short, silently
destroying the `FEASIBILITY_TOLERANCE_MINUTES` band the tier contract deliberately provides. The
distinction is between a **known** shortfall and an **unknown** one: `COVERED` or sufficient finite
coverage **at the upper bound** is `robust` (full midpoint coverage alone is not); a known shortfall within
tolerance is still `tight` with its thin-margin warning; a larger known shortfall is `shorter`; and
**only an `unknown` boundary removes a venue from the ranking**. A known 10-minute shortfall stays
`tight`.

**Bounded to at most two calendar dates**, since `duration + closing_buffer` is under 24 hours — no
lookahead loop and no cycle bound. Both branches have real data: **seed 2** (24/7) joins, because the
next date resolves to the `always_open` form beginning at 00:00; **seed 5** (an ordinary venue) does
not, because Saturday reopens at 07:30, so it correctly closes at Saturday 00:00.

### 7 — Source authority decides which dates may contribute periods

The positive-evidence precedence recorded earlier says a known period containing the arrival returns
`open` even when the sibling date is `unknown`. Combined with the new complete current-hours map, that
rule had a hole nobody had reconciled: **it never asked where a matching period came from.**

Counterexample, and the reason this is not theoretical — 3 of 28 venues have a 24/7 *regular* schedule:

> Tuesday is the first current-hours date and its materialised entry is explicitly `closed`. Monday
> falls outside the window, so it resolves from `regular_hours`, which is 24/7 and therefore unbounded.
> Monday's period contains every Tuesday arrival, positive evidence fires, and the venue reads **open
> on a day the current hours say it is shut.**

Amended candidate construction:

- **Arrival date inside the current-hours window** → its materialised entry is **complete and
  authoritative**, already containing coverage from periods spanning in from earlier dates. The
  previous date is **not admitted at all**. Lower-authority regular carry-in may not override it.
- **Arrival date is a known holiday outside the window** → return `unknown` immediately. The holiday
  rule is a positive assertion of ignorance about *that* date; a regular overnight period carried in
  from the previous day must not overturn it. A Monday 22:00–02:00 pattern is evidence about ordinary
  Mondays, not about the eve of a holiday.
- **Otherwise** → both dates are admitted under compatible regular authority, as before.

**This does not weaken positive evidence.** That rule concerns a *known* arrival date with an
`unknown` sibling, which still returns `open`. These cases are the reverse — stopping a
*lower-authority* sibling from manufacturing `open` for an arrival date whose own hours are either
authoritative or deliberately unknown.

### 8 — `UNBOUNDED` is a runtime value and is never serialised

Introducing a no-`close` period created a second instance of the defect class this log already records
three times — a formula and a contract field that do not match — this time inverted: the contract grew
a field the formulas could not consume. `plan.md`'s active-period scan built `abs(d, p.close)` and
every downstream formula assumed a finite close, so an `always_open` period would have produced
`undefined` on exactly the venues that are open the longest.

- The period end is derived through `period_end_abs(d, p)`, which yields `UNBOUNDED` when
  `p.always_open` and `abs(d, p.close)` otherwise. **Reading `p.close` directly is a bug.**
- `UNBOUNDED` compares greater than every arrival, so an always-open period contains any arrival at or
  after its open.
- **`always_open` means "no known close *in this source period*", not "open forever".** It does not
  exempt a session from the coverage walk: every calendar date crossed by
  `[arrival, arrival + duration + closing_buffer)` must still be resolved wherever **source authority
  or holiday status can change**. A 24/7 *regular* schedule says nothing about a date the current-hours
  window explicitly closes, nor about a known holiday beyond that window. A session starting on an
  ordinary date and running past midnight into an out-of-window known holiday is **hours-unknown**, not
  `robust` inherited from the prior period's unbounded end. `UNBOUNDED` propagates only while every
  crossed date agrees.
- **A covered span is not a no-close claim.** When the walk covers `required_end_abs` without reaching a
  close it returns **`COVERED`**, which deliberately does *not* distinguish a genuinely never-closing
  venue from one whose close simply lies beyond `required_end_abs` — because the walk stopped there and
  never looked. `surplus_*` is then **`AT_LEAST(0)`**: `COVERED` proves `close >= required_end_abs` and
  therefore `surplus >= 0`, which is enough to pass the tier tests but is **not a measurement**. It sorts
  at its proven bound (0) in the final `surplus_mid` tiebreak, never overstating against a venue with a
  real measured surplus, and is **never displayed as a number** — the UI says the session fits with the
  margin not established, never "3h spare". `usable_minutes` is the full requested `duration`, and
  `latest_leave_at` is **`UNDETERMINED`**, shown as **"no known closing constraint within the verified
  span"** — never "no latest departure". An unverified later close must not drive exact surplus or
  later-departure advice. `UNBOUNDED` stays a **period-level** value for containment only and never
  becomes a feasibility claim.
- **`AT_LEAST(0)` is a tagged outcome, not a number.** `surplus_*` is a sum type — a real integer
  margin, or the tag — and the tag must never be compared, subtracted from, or formatted as an ordinary
  number. Exactly three accessors consume it: `passes_feasibility()` → **true**; `sort_key()` → **0**,
  the proven lower bound, so it never out-ranks a genuinely-verified surplus on a tiebreak it did not
  earn; `display()` → **no numeric margin**. **`display()` must never fall back to `sort_key()`** —
  rendering the tag as "0" would claim the venue closes exactly at the deadline when its close was never
  established. The two failure modes are opposite, which is why sorting and display stay separate.
- **Every feasibility comparison goes through an accessor; no tier test touches `surplus_*` directly.**
  `robust` is `effective_close_upper is not NONE AND passes_feasibility(surplus_upper)`; `tight` adds
  `passes_feasibility(surplus_mid) OR finite_shortfall(surplus_mid) <= FEASIBILITY_TOLERANCE_MINUTES`.
  Writing `surplus_upper >= 0` or `-surplus_mid <= …` is a type error — the second literally negates a
  tag. **`finite_shortfall()` is a partial function on the finite variant** and rejects `AT_LEAST(0)`
  rather than coercing it; it is never reached with the tag, since `passes_feasibility` short-circuits
  first, so the rejection guards against a future refactor reordering the operands.
- **`COVERED` proves the required span is open**, not that a close exists beyond `required_end_abs` —
  an always-open period may have no close at all. The earlier wording "proves close > required_end_abs"
  asserted the existence of a close the walk had not found and may not exist.
- **The `required_end_abs` boundary is inclusive on the close side.** A finite close **at exactly**
  `required_end_abs` is returned as a finite close, giving an exact `surplus` of **0** — a verified thin
  margin that displays as one. Only a close **strictly beyond** `required_end_abs` yields `COVERED`,
  because that is the case the walk genuinely did not reach.
- **The walk is not scoped to unbounded or truncated periods**, and **a period's own extent is never
  evidence about a date it crosses and actually reaches.** A finite Monday 22:00–Tuesday 02:00 regular
  period must not establish known Tuesday coverage when Tuesday is an out-of-window known holiday, and
  neither must a finite multi-day suffix entry. An earlier draft scoped the walk to `always_open` and
  `continues_beyond_window` only, leaving both finite cases broken.
- **But the walk is sequential and lazy, and stops at the first known close** — the correction to the
  over-eager version of the rule above. Start at the active period; a known close before the next date
  boundary returns immediately; a covered `required_end_abs` returns `COVERED`; the following date is
  resolved **only** when the run reaches that boundary *and* `required_end_abs` lies beyond it. **A date
  the run never reaches is never resolved and can never contribute `UNKNOWN`.** Counterexample that
  forced this: arrival Monday 18:00, a **known** Monday close at 22:00, `required_end` Tuesday 00:30,
  Tuesday an out-of-window holiday. The answer is a **known shortfall** against the 22:00 close —
  `tight` or `shorter` — not hours-unknown. Resolving every intersected date up front would have
  unranked a venue whose closing time is perfectly well known. Ignorance about a date you never reach
  is not ignorance about your session.
- **`NONE` is distinct from `UNKNOWN`.** `effective_close` is never called with a missing active
  period; the caller returns `NONE`. `NONE` is a definite "not open then" and never unranks a venue on
  its own — an upper-bound `NONE` fails `robust` while the midpoint is still evaluated and may be
  `tight`; a midpoint `NONE` falls to `shorter`. Only `UNKNOWN` removes a venue from ranking.
- **The signature is explicit** — `effective_close(venue, active_period, arrival_abs, required_end_abs)`.
  It takes `venue` so it can call `resolve_hours()` and read source authority for any date it needs, and
  `required_end_abs` so it knows exactly how far coverage must be proven, rather than depending on
  unstated surrounding variables.
- **The formulas consume `effective_close_mid` / `effective_close_upper`, never a raw
  `active_period.period_end_abs`.** Each bound derives its own run independently, and
  **`effective_close` returns exactly one of: a finite absolute close, `COVERED`, or `UNKNOWN`** —
  never `UNBOUNDED`, which is period-level containment only and never a feasibility result. **`NONE` is
  returned by the caller** when `active_period` is missing; `effective_close` is not called then.
  **Branch on the outcome before any arithmetic** — subtracting from a value that may hold `COVERED`,
  `NONE` or `UNKNOWN` is a type error, not a shortcut. On `UNKNOWN` the venue is surfaced hours-unknown
  and **no tier and no metrics are computed for it at all**.
- **`robust` is judged on the upper bound alone** — full midpoint coverage does not make a venue
  `robust`, which is the point of resolving both bounds independently.
- **The JSON contains no `Infinity`.** It is not valid JSON and `JSON.parse` rejects it. The stored form
  is the absence of a `close` key plus `always_open: true`; the unbounded end is derived at runtime in
  `ranking.js`.

### Contract amendments this forces

- **The "at most one period can contain a given instant" claim is false** and is corrected in
  `plan.md`. A Tuesday arrival at UTown matches both Tuesday's `{0, 6810}` and Monday's `{0, 8250}`;
  both resolve to `period_end_abs = abs(Tue, 6810)`, the same real close, so the overlap is benign —
  but several candidates **may** match, and they must agree on `period_end_abs`.
- **Minimum `period_end_abs` is a tie-break among equals, never a resolution of disagreement.** Equal
  matching ends are valid — the normal decomposed-chain case — and taking the minimum simply makes the
  choice reproducible. **Unequal matching ends are a validation failure**: the venue is **not ranked**
  and goes through the per-venue failure path, exactly as two overlapping `known` periods on one
  weekday do. An earlier draft called the minimum "pessimistic if they ever disagree, which matches this
  project's bias against the wasted trip" — **that was wrong.** It would silently rank a venue on data
  known to be self-contradictory; choosing the safer of two untrustworthy numbers is guessing quietly,
  not caution.
- **Validation guards** run through the existing per-venue failure path (flag loudly, retain
  last-known-good, `status: stale`): no two `known` periods on one weekday may overlap, and matching
  periods disagreeing on `period_end_abs` is contradictory source data.
- **`day_gap == 0` with an explicit close requires `close > open`, strictly.** Google represents
  genuine always-open hours by *omitting* `close`, so an equal endpoint is a zero-length period and
  malformed, not a 24-hour venue.
- **Every weekday needs an explicit entry.** `parse_regular` is a `defaultdict`, so a genuinely closed
  weekday is simply absent; untouched weekdays are filled with `state: "closed", periods: []`.

### Phase 0 artifacts stay frozen

`build/phase0_hours.py` keeps its horizon calculation and always-open encoding, and nothing under
`data/phase0/` is regenerated — those artifacts are the record of what Phase 0 measured, not a live
input. **Consequence, stated so it is not rediscovered later:** `hours_summary.json`'s
`override_horizon_days_ahead: [1, 2, 7]` and its per-venue horizons remain wrong on disk, and Phase 1
must not read them as input — it recomputes from the raw payloads.

### What the external review contributed, and what it got wrong

Two rounds, run against HEAD `f22db66` and the saved payloads — not against the proposal, which the
reviewer could not load. Agreement on defects 1–4 is therefore independent corroboration rather than a
shared premise. Every citation across both rounds was checked against the files before being accepted;
all resolved exactly.

**Accepted:** defect 5 in full; the computed-and-validated window with `valid_from`; treating
`truncated` as a window boundary (replacing a narrower both-ends-discard rule that missed seed 4); the
continuity rule in §6; the date-based current-hours decomposition; `close > open` strictly; scoping
"always robust"; and the correction that the seven-day-lookback argument was overstated.

**Rejected, with evidence:** the claim that daily decomposition creates fake midnight closures and the
resolver must therefore coalesce segments with a cycle bound. That is true of the *existing* Phase 0
`{0, 1440}` conversion, but not of `close_k`, which carries the true close — UTown's Monday entry is
`{0, 8250}`, closing Saturday 17:30, never midnight. Coalescing would have added forward lookahead to
`resolve_hours`, the exact complexity decomposition exists to avoid. The reviewer accepted this
rebuttal in the second round.

**Corrected:** the review's own measurement. It reported truncated endpoints at 6 venues (seeds 2, 4,
13, 18, 19, 26); the earlier draft of this decision said 4. Counting truncated endpoints across every
saved payload gives **7** — both were low, and the missed venue matters. **Seed 5
(`starbucks-chinatown-food-street`) has empty `shape_flags`** — neither 24/7 nor multi-day. Its Friday
2026-09-04 period closes at `1440`, past the window edge, so Google truncated it. **Truncation is a
property of the window, not of unusual venues**, and any venue whose period crosses the final boundary
is affected.

---

## Open — to be resolved in Phase 0

**Hours source.** Two authoritative candidates; hours must not come from the busyness scrape or a third-party aggregator.

1. **Starbucks SG store locator** (`starbucks.com.sg/stores/`) — the operator's own data, free, no API key. The page is a JS app and the store data loads from an endpoint not visible in the HTML; finding it needs one DevTools Network-tab session. **Try this first.**
2. **Google Places API Place Details** — returns `regularOpeningHours`, `currentOpeningHours` (holiday overrides, 7-day horizon) and `businessStatus`. Official and ToS-clean. **Unresolved cost question:** the opening-hours fields are billed under the *Enterprise* SKU; the 10,000-free-calls figure found during planning applies to *Essentials*, and no free Enterprise allowance was confirmed. Worst case ~$0.25/month at 10 calls, but needs a GCP billing account. Check live pricing before committing.

Note: the Places API does **not** expose popular times. It does expose opening hours. These are two different questions and the API answers only one of them.

### Status update 2026-08-28 (the block above is left as written; this supersedes part of it)

- **The cost question is CLOSED.** Enterprise SKU has a 1,000-call/month free cap, so ~10 calls/month
  is $0 — see the entry above. The "no free Enterprise allowance was confirmed" wording in the block
  above is superseded. A billing account is still required, and that is now the only remaining
  friction.
- **Still open:** which source actually wins. The Starbucks SG locator gets **one timeboxed session**;
  if the endpoint isn't found and confirmed stable in that time, take the Places API and move on.
- **Added since:** confirm `hours_timezone` and `histogram_timezone` independently rather than
  assuming they agree; and check whether any of the ten stores needs after-midnight, 24-hour or split
  opening periods, which decides whether the periods array earns its complexity.

## 2026-08-30 — `effective_close` slack semantics clarified: same-day/current-authority closes trusted exactly

`plan.md`'s pseudocode read as "any confirmed slack ⇒ `COVERED`, even same-day," which would discard a genuinely verified thin margin. Resolved during `IMP-001`: a period's close is trusted and returned exactly (as a real shortfall or real slack) whenever nothing about a later date could contradict it — `current`-authority closes (same-day, or a decomposed multi-day chain) and `regular`-authority closes that don't cross midnight. `COVERED`/`AT_LEAST(0)` is reserved for `always_open`, `continues_beyond_window`, and `regular`-authority closes that do cross into another calendar date, where a holiday could still override the pattern. User-confirmed via the recommended interpretation. Implemented in `web/ranking.js`'s `effectiveClose`, with the reasoning in its docstring.

## 2026-08-30 — IMP-001 closed: ranking.js hours-resolution and feasibility-tier core

Implemented `resolve_hours`, `effective_close`, and the three feasibility tiers in `web/ranking.js` (commit `1677066`), the first assignment run under the newly-adopted cross-agent-workflow protocol. Pre-gate `GATE_PASS`; independent review (round 1, `codex_terra`) found one low-severity finding — `IMP-001-R1-F01`, a Node-version-dependent test invocation (`node --test tests/js/` failed under Node 24 but not 18) — corrected to the version-independent glob form and reverified on both runtimes; round 2 (`codex_luna`, narrowly scoped) approved. User approved and authorized close. Full detail in `reviews/IMP-001.md` and `reviews/IMP-001-gate.md`.

## 2026-08-30 — Phase 1 step 2 meta fields: first 4 venues, plus reusable access/cycling policy

Filled `preference`, `closing_buffer_minutes`, `holiday_policy`, `access`, `wet_weather_mode`, and `fallbacks` for `starbucks-utown`, `starbucks-west-mall`, `starbucks-hillv2`, and `coffee-bean-west-mall` in `data/venues_meta.json` — the same 4-venue slice an earlier unconsulted session plan had targeted, enough to unblock the Plan A/B acceptance test. `access` bands and `fallbacks[].travel_band` came from Singapore's OneMap SG routing API (free, official, needs a short-lived ~3-day API token from `onemap.gov.sg/apidocs/register`) rather than being estimated by hand — geocoding is unauthenticated, the actual routing endpoint (`/api/public/routingsvc/route`, walk/cycle/pt modes) needs the token.

Three reusable policy calls, to apply consistently when filling the remaining 24 venues:

- **Cycling is only viable from `origin_a` (home), never from `origin_b` (work)** — a hard physical constraint (no bicycle kept at work), not a distance judgment. This holds regardless of measured time, even for venues that happen to be a fast cycle from work (e.g. the Chinatown/CBD cluster near work, some under 10 minutes by the routing engine). `access.origin_b` should never carry a `cycle` key.
- **Max cycle time is ~1 hour one-way from home, but subject to a round-trip sanity check per venue** — `starbucks-utown` measured at 59-min one-way (technically under the cutoff) but was rejected because the round trip is 2 hours; a one-way threshold alone isn't sufficient.
- **Rain always reverts `cycle` → `transit`** — the default `wet_weather_mode.origin_a` entry for any venue with a viable home cycle route, not assessed per-venue.

`holiday_policy: substitute_sun` applied to all 4 (mall/campus-complex venues where Sunday hours already match public holiday hours, per direct confirmation) rather than the `unknown` default.

## 2026-08-31 — ARCH-001 closed: session-end return transport is a second feasibility constraint

The decision model checked only that a venue was open on arrival, never whether anything still ran to take you home when the session ended — so a six-hour session leaving at 18:00 could rank `robust` at a venue open until 02:00 and strand you at 00:30, which is the same wasted trip the tool exists to prevent, arriving from the far end of the evening. `ARCH-001` designs the fix as a **second feasibility constraint on the same session**, resolved with the machinery already in the model: hand-maintained data in `venues_meta.json` (no transit API, now or later), coarse bands, absolute minutes, two independently resolved bounds, tagged outcomes, and positive evidence before silence. The contract is in `plan.md`, "Getting home: session-end return transport"; the non-negotiables it forces are in `CLAUDE.md`. Design only — implementation is a follow-up `IMP-###`. Full detail in `reviews/ARCH-001.md` and `reviews/ARCH-001-gate.md`.

Ten findings across five `codex_sol` rounds, all resolved. The decisions worth preserving are the ones that were contested, because `plan.md` states each conclusion but a later reader would not otherwise know the alternative was considered:

- **A recorded route home is an unconditional prerequisite, derived before any clock branch.** The core service span (07:00-21:30) waives the per-venue *timetable* lookup, never the *route*: `access[origin_a]` says whether a way home exists and is required at every hour; `return_transport` says when the last service leaves and is what the span waives. An earlier ordering let a venue with no `access` entry pass on a city-wide clock alone — invisible in the current data, live in the contract.
- **The core span is a maintained assumption, not a frozen invariant** — network-level and ordinary-day only, with recorded sources, a checked date attributed to the round-1 reviewer, an annual re-check, and a rule that the shortcut is *withdrawn* rather than left stale if the norm stops holding.
- **The pre-dawn gap (04:00-07:00) is not modelled, and `first_departure_band` was removed rather than fixed.** A first departure is a *lower*-bound constraint: opposite monotonicity to a last departure, no row in the binding limit, and one first departure is not a service interval. Closing it means modelling the **wait** as its own outcome, in its own assignment. The rule is scoped to schedule-bound-only mode sets — a walk home at 05:00 still settles it, and suppressing that would be a policy change this design explicitly declines.
- **`unverified` is a ranked tier value, deliberately not hours `UNKNOWN`.** Missing return data never removes a venue and never resolves to `robust`; it ranks last and can never be Plan A, with its own refusal wording. A known partial session outranks an unverified way home — "gives 4h of 6h and you can get home" beats "gives 6h and nobody checked".
- **Malformed return data fails per-venue, never globally.** `validate_return_transport` is a mandatory unconditional stage in `refresh.py` that **classifies and never aborts**: it stamps `return_transport_status` on each generated venue, the atomic write always proceeds, and one typo cannot withhold every other venue's refresh. The rejected alternative — abort generation, retain the previous page — would have made the `invalid` stamp unreachable and had no counterpart anywhere else in this pipeline. Removals must be loudly visible in the page itself, distinct from the `unverified` group, because the two have different fixes.
- **Two directions of failure, deliberately opposite.** Missing *service information* fails open to `unverified`; missing *validation* fails closed and unranks. An absent stamp means the stage never ran, so the data is unvalidated.

Process notes worth recording: the pre-gate returned `GATE_FAIL` on both permitted invocations, so the assignment routed to Codex under `WORKFLOW.md`'s retry rule and **every correction from that point on was ungated** — the five review rounds were the only independent check. Three of the four rounds that found real defects found them in *claims the primary had written about its own corrections* rather than in the corrections themselves, which is the failure mode a same-engine gate is least able to catch.

## 2026-08-31 — WF-001 abandoned: workflow sync applied directly, bypassing its own gate

The user asked to re-implement the `cross-agent-workflow` skill's improvements in this repo. `WORKFLOW.md`'s own text requires that `WORKFLOW.md` be edited only through a `WF-###` assignment, so the first response opened `WF-001` (ledger row allocated, `HANDOFF.md` drafted, `claude_opus`/`codex_sol_high` routed) instead of just applying the change — an inference from the file's self-referential rule, not something the user asked for. The user pushed back: they asked for the update, not for a gated assignment. Per `WORKFLOW.md`'s "three parties" table the user holds sole approval, sequencing, and model authority, so on explicit confirmation the sync was applied directly in the same (Sonnet) session, and `WF-001` was marked `abandoned` rather than run through `draft`/gate/review. Its ledger row stands, per the append-only rule — a burned ID is a legal gap, never reused.

What changed, diffed against `~/.claude/skills/cross-agent-workflow`'s current templates/scripts (schema marker stays `cross-agent-workflow/v1` — this was a content sync, not a version bump): `WORKFLOW.md`, `AGENTS.md`, and `reviews/TEMPLATE.md` replaced wholesale; `CLAUDE.md`'s "Cross-agent coordination" section replaced in place; `.cross-agent-workflow/finding_state.py` and `VERSION` copied in (`gate_brief.py`/`audit_due.py` were already byte-identical). The additions: `Action:`/`Review phase:` handoff header fields, a `Conversation: END` directive for closing a thread at `completed`/`abandoned`, an "architecture exploration happens outside the protocol" split, diff-first reviewing order (read `HANDOFF.md` then the diff before any other context), a "round 3 requires a reason to exist" rule, a new `codex_terra_low` route for exact round-2 corrections, and a `factual-assessment/v1` finding-disposition schema adding a `not_verified` value (paired with mandatory `blocked_on_user` unless explicitly resumed under `Action authority: user_directed`).

Verification actually performed, in place of the gate and review this bypassed: every updated file diffed byte-identical against its skill template/script; `.cross-agent-workflow/finding_state.py` run against both sealed `reviews/IMP-001.md` and `reviews/ARCH-001.md`, confirming they still parse as legacy records (no `Finding disposition schema` line, factual assessment stays optional); the skill's own 110-test `unittest` suite (`scripts/tests/run.sh`) run against the installed script, all passing. No `reviews/WF-001.md` or gate record exists, since the gate was never invoked — this entry is the only record of what verification actually ran.

## 2026-08-31 — IMP-002 closed: session-end return-transport implemented in ranking.js

Implemented `ARCH-001`'s return-transport design in `web/ranking.js`: `resolve_return_service`, `admissible_return_modes`, the six-step `resolveReturnBound` (route prerequisite → schedule-free → core-span → pre-dawn → timetable → `MAX` over present), `overall_tier` composition, the six-row binding-limit table, and `validate_return_transport`, plus 52 new tests (95 total) written test-first. `seat_confidence`/`backup_strength`/Plan A-B stay excluded, matching `IMP-001`'s original scope boundary — `backup_strength` needs `overall_tier`, which this assignment supplies as the dependency, not the consumer. Pre-gate `GATE_PASS`; round 1 (`codex_terra`) found one Medium finding — `IMP-002-R1-F01`, `RETURN_TOLERANCE_MINUTES` declared but never defaulted when `toleranceMinutes` was omitted, silently misranking a ≤10-minute return shortfall as `shorter` instead of `tight` — corrected (a one-line default parameter) with two new regression tests, both watched red before the fix; round 2 (`codex_terra`, narrowly scoped to the correction delta) approved with no findings. User approved and authorized close. Full detail in `reviews/IMP-002.md` and `reviews/IMP-002-gate.md`.
