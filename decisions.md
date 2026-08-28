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
