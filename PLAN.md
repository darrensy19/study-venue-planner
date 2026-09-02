# Study Venue Planner — Build Plan

## Goal

> Recommend the coffee destination that gives me a high chance of getting a suitable seat for the full study session, while minimising the wasted time and energy if the prediction is wrong.

The failure this tool exists to prevent is **travelling 40 minutes to a venue, finding no seat, and having to travel somewhere else.** That failure costs more than any amount of mild sub-optimality in the choice itself, which is why the output is not just a ranked list but a **Plan A and a practical Plan B**.

Two queries it answers:

> It's 4pm and I want to study for 3-6 hours. I'm at work. Where do I go, and where do I go if that fails?

> I want six hours today. When do I need to leave?

Sessions run **3-6 hours**. At that length opening hours are a **feasibility constraint** — a venue that closes at 9pm is useless at 4pm regardless of how empty it is — but feasibility is not the goal. **Getting and keeping a suitable seat is the goal**, and hours only rule out venues that cannot deliver it.

### What each input contributes

| Input | What it tells us | What it cannot tell us |
| --- | --- | --- |
| **Opening hours** (Places API) | Whether the full session physically fits | Anything about seats |
| **`baseline_seatability`** (hand-maintained) | How reliably *this venue* seats me, in absolute terms | Whether today/this hour is unusual |
| **Google Popular Times** (histogram) | Whether this is an unusually good or bad *time* for this venue | Whether this venue beats another venue |
| **Seat log** (personal, growing) | What actually happened when I showed up | Much of anything yet — needs volume |

The two middle rows are the crux: **neither one alone answers "will I get a seat here"**. Baseline gives the absolute level and is the only cross-venue signal available before calibration. Popular Times gives the time-relative adjustment and is *not* cross-venue comparable at all. They are combined into a `seat_confidence` tier, never conflated.

## Non-goals (explicit — do not build these)

- No live / real-time busyness. No "check now" button. Popular Times means the **historical** weekly histogram, never the live overlay.
- No live weather, traffic, or transit APIs. Rain is a manual toggle.
- No deployed backend, no server-side code, no API keys in the deployed app.
- No auth, no multi-user, no accounts.
- No native iOS app.
- No service worker in v1.
- **No numerical seat probability before Phase 3.** Confidence is qualitative until there is enough personal outcome data to earn a number.
- **No full venue-to-venue travel matrix.** Only hand-picked fallback links between plausible neighbours.

## Multi-brand from the start

Scope now includes **Starbucks, Coffee Bean & Tea Leaf, Tim Hortons, and potentially independent cafés.** Because no code exists yet, the domain model is **brand-neutral now** — retrofitting it later would mean renaming every contract, function and label.

Use `venue`, `venue_id`, `venues.json`, `venues_meta.json`, `venue_arrival`. Never bake a brand into a contract name, a function name, or UI copy.

The project is **`study-venue-planner`** throughout — GitHub repository and local directory alike — named for the real scope rather than the first brand in it. The repo name becomes the GitHub Pages URL prefix, so it was worth settling before deployment rather than after links existed.

`venue_type` is a small, extensible, **descriptive** classification, seeded with `large_cafe`, `mall_cafe`, `office_cafe`, `takeaway_heavy`, `small_kiosk`, `independent_cafe`. "Extensible" turned out to matter immediately: Phase 0's real 28-venue list needed `hospital_cafe`, `campus_cafe`, `tourist_cafe`, `clubhouse_cafe`, `standalone_cafe` and `strip_mall_cafe` to describe venues the original six couldn't fit precisely — see `decisions.md`, 2026-08-29, and the values actually assigned in `data/venues_meta.json`. It is recorded from the start so Phase 3 can eventually test whether it predicts anything. **Nothing computes with it until there is evidence that it should.**

## Architecture

Everything is either a **local Python script** (run manually on the Mac) or a **static page** (deployed, read-only).

```
study-venue-planner/
├── scraper/
│   ├── places.py               # Places API (New) client — returns data, writes nothing
│   ├── fetch_hours.py          # official source
│   └── fetch_busyness.py       # SerpApi
├── build/
│   ├── phase0_common.py        # Phase 0 — shared paths, seed loading, env
│   ├── phase0_resolve.py       # Phase 0 — seeds → Place IDs
│   ├── phase0_hours.py         # Phase 0 — hours, timezone, override horizon
│   ├── phase0_busyness.py      # Phase 0 — histograms + timezone cross-check
│   └── refresh.py              # ORCHESTRATOR — owns venues.json and index.html
├── analysis/
│   ├── phase0_spread.py        # Phase 0 — spread, coverage, N/P proposal
│   └── calibrate.py            # run occasionally, Phase 3
├── data/
│   ├── venue_seeds.csv         # HAND-MAINTAINED resolution input (Phase 0 only)
│   ├── phase0/                 # Phase 0 outputs, FROZEN; phase0/raw/ gitignored
│   ├── venue_sources.json      # CANONICAL Phase 1 fetch registry — id + resolved identity
│   ├── venues.json             # GENERATED by refresh.py, committed
│   ├── venues_meta.json        # HAND-MAINTAINED, never written by code
│   ├── holidays.json           # HAND-MAINTAINED SG public holidays
│   ├── seatlog.csv             # coarsened log, committed
│   └── calibration.json        # generated by analysis, Phase 3
├── web/
│   ├── index.template.html     # HAND-WRITTEN source
│   ├── index.html              # GENERATED — never hand-edit
│   ├── app.js                  # SOURCE — DOM + render only; inlined into index.html
│   ├── ranking.js              # SOURCE — pure functions, no DOM imports; inlined
│   ├── style.css               # SOURCE — inlined
│   └── manifest.webmanifest    # NOT inlined — see below
├── tests/
│   ├── js/                     # node --test, imports ranking.js directly
│   └── python/                 # pytest, fixture-based parser tests
├── requirements.txt
└── Makefile                    # `make refresh` = coarsen + fetch + validate + generate
```

**Python environment:** `.venv/` plus `requirements.txt`. Always invoke as `.venv/bin/python3`, **never bare `python3`** — on this machine that resolves to an Anaconda install (`/Users/darrensy/anaconda3/bin/python3`) which will not have this project's dependencies. This trap has already been hit in another project on this Mac.

**Seat logging:** Apple Shortcut on iPhone appends a row to a CSV in iCloud Drive. The Mac reads the same file via the local iCloud path. No sync code to write — iCloud does it.

### Why this shape

The histogram and the opening hours are both near-static, so there is no reason to fetch either at request time. Generating everything on the Mac and committing it means the deployed app has zero runtime dependencies and cannot break because Google changed its HTML. When a fetcher breaks, it breaks on my laptop where I can see it, not in front of me at 9am on a Saturday.

### The generated page is self-contained

`build/refresh.py` generates `web/index.html` from `web/index.template.html`, inlining:

- **the data** — `venues.json`, `venues_meta.json`, `holidays.json`, `seatlog.csv` as `<script type="application/json">` blocks
- **the code** — `ranking.js` then `app.js`, into **one** `<script type="module">` block
- **the styles** — the contents of `style.css` into a `<style>` block

**The source files remain real files on disk.** They are the source of truth, hand-edited, and `tests/js/` imports `ranking.js` directly. Only the *generated artifact* is a single file. An earlier draft inlined the JSON alone and then claimed "one portable file" and "no network requests at all" — both false, because the page still fetched four assets. That error survived three consistency sweeps because they grepped for stale claims rather than checking new claims against the file tree.

#### The module inlining contract

Source files are ES modules so Node can import them; the artifact must have no module graph at all. The convention, which needs no npm and no bundler:

1. `ranking.js` is a valid ES module using `export` declarations. `tests/js/` imports it directly — this is the only consumer of those exports.
2. `app.js` imports from it with a **single, fixed-form** statement at the top of the file:
   `import { … } from "./ranking.js";`
3. The generator emits one `<script type="module">` containing the full text of `ranking.js`, then the full text of `app.js` **with that import statement removed**.

Because both files land in the same module scope, `ranking.js`'s top-level bindings are directly visible to `app.js` code — no import needed at runtime. `export` declarations remain in the concatenated module; they are syntactically legal in an inline module script and simply have no importer, so they are inert.

**Constraint this creates:** after concatenation the two files share one top-level scope, so **`ranking.js` and `app.js` must not declare colliding top-level names.** That is a real constraint on how the code is written, and it needs a test.

Leaving the import in place would defeat the whole design — the browser would fetch `./ranking.js` over the network, reintroducing exactly the external dependency inlining exists to remove.

#### Escaping embedded JSON

**Inside a `<script type="application/json">` block, every `<` in the serialised JSON must be written as its six-character JSON unicode escape** — a backslash, then `u003c`:

In Python, unambiguously:

```python
json.dumps(data).replace("<", "\\u003c")
```

That writes **six characters** into the JSON text — a backslash, then `u`, `0`, `0`, `3`, `c` — which a JSON parser reads back as the single character `<`.

This is a **JSON-level** escape, not an HTML one. HTML entities are *not* decoded inside a `<script>` element, so writing `&lt;` would place the literal characters `&lt;` into the parsed data and corrupt the value. The unicode escape is valid JSON that parses back to a less-than sign, so the data round-trips intact while the byte sequence `</script>` can never appear literally in the markup.

A `notes` field, a venue name, or an upstream string containing `</script>` would otherwise terminate the block and corrupt the page. **This must have a test using a value that actually contains `</script>`**, asserting both that the page still parses and that the value survives round-trip.

Consequences of the whole arrangement:

- **No `fetch()`, no unresolved imports, and exactly one external reference** — the manifest, described below. No CORS, no `file://` restriction, no local dev server needed.
- **No relative-path question** between `web/` and `data/` under GitHub Pages.
- **Genuinely one portable file** that can be AirDropped and opened with no network at all.

**The manifest is the sole external asset, and it is optional.** `<link rel="manifest">` accepts a `data:` URI in principle, but Safari support has been unreliable — and Safari is the only browser that matters here — so `manifest.webmanifest` stays a separate file.

It is *optional* in the precise sense that **the page is fully functional without it**. When the manifest is absent or fails to load — which is exactly what happens to the AirDropped copy opened from `file://` — nothing degrades except the ability to install to the home screen. Every feature, all data, all logic works.

So the accurate claim, used consistently across these documents, is:

> The generated page loads **no external assets except an optional web app manifest**, and functions completely without it.

Not "no external assets", which was the earlier wording and was false.

`localStorage` was considered and rejected: with no signal the page shell doesn't load either, so there is nothing running to read it.

**Offline, honestly scoped:** *portable* offline (a saved file always works) and *best-effort* cached offline (repeat visits to the hosted URL depend on the browser's HTTP cache). Guaranteed offline for the hosted URL would need a service worker. Deferred.

### Deploy

**GitHub Pages, publishing from the repository root of the default branch.** The repo is public — Pages' free tier only serves public repositories.

- Site root: `/` (repo root) · App URL: `<site>/web/index.html`
- **All paths in the manifest and the page are relative**, never absolute:

  ```json
  "start_url": "./index.html",
  "scope": "./"
  ```

  For a project site the repository name is a path prefix (`darrensy19.github.io/study-venue-planner/`), so an absolute `/web/index.html` would resolve to `darrensy19.github.io/web/` and 404. Relative paths also keep the AirDropped `file://` copy working.

- No data URLs, no asset URLs — everything except the manifest is inlined.

**Note on publishing sources:** branch-based publishing offers repo root or `/docs`, but Pages can also publish a GitHub Actions artifact from any directory. Root-of-branch is chosen here for simplicity; the "root or `/docs` only" framing in an earlier draft was incomplete.

"No server" means **no deployed backend**. A local server is permitted, and under the inlined design isn't needed.

---

## The decision model

Four derived quantities, computed in order. **Every one is shown separately in the UI — never blended into a single opaque score.**

### 1. `baseline_seatability` — hand-maintained, absolute, per venue

How reliably this venue seats me *in general*, independent of time of day. This is the **only cross-venue seat signal available before Phase 3**.

| State | Meaning |
| --- | --- |
| `dependable` | I would make a long trip here without needing a nearby backup |
| `usually_available` | I normally get a seat, but busyness or a backup still matters |
| `mixed` | Genuinely unpredictable |
| `poor` | I frequently fail to get a suitable seat |
| `unknown` | Not enough personal experience to judge |

**`unknown` is a missing-knowledge state, not a rung on the scale.** It never averages, never substitutes for `mixed`, and never resolves upward from busyness evidence alone.

### 2. `preference` — hand-maintained, strictly about study quality

Tables, seating comfort, Wi-Fi, noise, atmosphere, food, and how much I actually enjoy working there.

**Preference must not carry crowding information.** An earlier version of this plan let preference silently absorb "this place is always full", which made one number mean two things and hid the crowding signal from every other part of the system. Crowding now lives in `baseline_seatability`.

### 3. `relative_busyness` — derived from the Popular Times histogram

Computed from the **historical** Google Maps Popular Times curve for that venue — never live busyness.

For the selected date and that venue's **own arrival hour**:

```
busyness_delta = arrival_hour_popular_times
               - median_popular_times_for_that_venue_and_weekday
```

| Band | Rule |
| --- | --- |
| `peak` | within `P` points of that venue/weekday's maximum |
| `busy` | `delta >= N`, unless already `peak` |
| `typical` | `-N < delta < N` |
| `quiet` | `delta <= -N` |
| `unknown` | histogram missing, or coverage below the minimum |

**`peak` takes precedence over `busy`.** `N` and `P` are **determined in Phase 0 from the observed curves** and recorded in `decisions.md`. They are not guessed here.

**Minimum coverage for a median.** A median over two or three hourly buckets is meaningless. A venue/weekday curve needs at least **`MIN_HISTOGRAM_HOURS = 6`** populated hourly buckets to compute a median; below that the band is `unknown`. Provisional — Phase 0 reports actual coverage and this can be revised.

**Four bands and no more.** Popular Times is an indirect, noisy proxy for seating — it counts everyone in the geofence including the takeaway queue. Finer gradations would manufacture precision the underlying signal cannot support.

A `very_quiet` band **may** be added later, and only if Phase 0 shows several venues with genuinely large and repeatable troughs — on the order of `2N` below their median. Deliberately **not** in the initial contract.

#### What this band does and does not mean

It answers: **is this an unusually good or bad time to visit this particular venue?**

It does **not** answer: **is this venue more likely to have a seat than another venue?**

This distinction is load-bearing. A `quiet` reading at a venue that is always packed can still be worse than a `busy` reading at a venue that is usually empty. The band is a **within-venue adjustment**; the absolute level it adjusts comes from `baseline_seatability`, and later from calibrated `P(seat)`. Any statement that the band makes venues comparable is wrong.

### 4. `seat_confidence` — the combination

`baseline_seatability` adjusted by `relative_busyness`, on the same four-level ladder, **conservatively**.

Ladder: `poor` (1) → `mixed` (2) → `usually_available` (3) → `dependable` (4). Clamped to [1, 4].

| `relative_busyness` | Adjustment |
| --- | --- |
| `quiet` | **+1** level, capped at `dependable` |
| `typical` | no change |
| `busy` | **−1** level |
| `peak` | **−2** levels |
| `unknown` | **no adjustment** — use baseline alone, and mark the evidence as weaker |

**If `baseline_seatability` is `unknown`, `seat_confidence` is `unknown`, always.**

```
poor              + quiet    → mixed
usually_available + busy     → mixed
dependable        + typical  → dependable
mixed             + peak     → poor
unknown baseline  + quiet    → unknown
usually_available + unknown  → usually_available   (evidence flagged weaker)
```

An explicit lookup, not a weighted score. **The UI must always show the components:**

```
Medium seat confidence
Baseline: usually available
Adjustment: busy for this venue
```

User-facing labels may be friendlier (`High` / `Good` / `Medium` / `Low` / `Unknown`), but the underlying states are preserved and reconstructable.

### 5. `backup_strength` — how bad it is to be wrong

Derived from hand-maintained `fallbacks` links, evaluated **at their delayed arrival time**, not from geographic proximity.

The requested session is 3-6 hours. A fallback offering 90 minutes may still rescue the trip, but it is **not** a substitute for the session — and presenting it as an equivalent backup would be dishonest. The three states are therefore graded by *whether the requested session survives*, not merely by whether somewhere is open:

| Strength | Rule |
| --- | --- |
| `strong` | a fallback where **the requested session fits** — `robust` or `tight` at its delayed arrival — with confidence at least `PLAN_B_MIN_CONFIDENCE`, **and a `robust` or `tight` `return_tier`** |
| `salvage` | at least `PLAN_B_MIN_SESSION_MINUTES` remains and confidence is at least `PLAN_B_MIN_CONFIDENCE`, **but the requested session does not fit** — or it fits and the way home is `unverified` |
| `none` | less than `PLAN_B_MIN_SESSION_MINUTES` remains, or confidence is below `PLAN_B_MIN_CONFIDENCE`, or no fallback is valid at all |

The minutes counted against `PLAN_B_MIN_SESSION_MINUTES`, and the duration a `salvage` option states, are the **return-capped** `usable_minutes` — see "Getting home: session-end return transport". A rescue that strands you is not a rescue, and "gives 1h40m" is a lie if the last train leaves in forty minutes.

**"The requested session fits" means the fallback's `overall_tier` is `robust` or `tight`**, not its hours tier alone. The three cases this settles, which are otherwise easy to leave unstated:

| Fallback's hours tier | Fallback's `return_tier` | `overall_tier` | `backup_strength` |
| --- | --- | --- | --- |
| `robust` / `tight` | `robust` / `tight` | `robust` / `tight` | `strong`, if confidence clears the floor |
| `robust` / `tight` | `shorter` | `shorter` | **`salvage`** if the return-capped minutes clear `PLAN_B_MIN_SESSION_MINUTES`, else `none` — the requested session does not fit, because you have to leave to catch the last way home |
| `robust` / `tight` | `unverified` | `unverified` | **capped at `salvage`**, labelled as an unverified way home rather than a short session |

`salvage` replaces the earlier `weak`, which was too vague to act on — it conflated "a bit further away" with "you'll get half the session you wanted", which are entirely different problems.

**A `salvage` option must always be labelled as such and must state its actual duration.** "Plan B: still provides 1h40m of your 6h" is useful. Presenting the same venue as though it satisfies the request is not.

**Do not multiply probabilities across venues.** "Venue A is 70% and venue B is 70%, so 91% chance of a seat somewhere" is invalid — neighbouring venues share the same crowd, weather, events and lunch rush. Their failures are strongly correlated. Backup strength is deliberately qualitative for exactly this reason.

---

## Time, dates and hours resolution

All time arithmetic is in **integer minutes from local midnight**, never string comparison. All dates are resolved in **`Asia/Singapore`**.

### Inputs

**`selected_date`** (a calendar date, defaulting to today), **leave-at time** (defaulting to now), session duration, origin, travel mode, and a manual "raining" toggle.

```
selected_weekday = weekday(selected_date, tz="Asia/Singapore")
departure_date   = selected_date          # the date the journey starts
```

Every symbol used in a formula below resolves to one of these:

| Symbol | Kind | Source |
| --- | --- | --- |
| `selected_date`, `leave_at`, `duration`, `origin`, `mode`, `raining` | input | UI controls |
| `selected_weekday`, `departure_date` | derived | from `selected_date`, above |
| `travel_minutes_mid`, `travel_minutes_upper` | derived | `venues_meta.access[origin][mode].band` |
| `closing_buffer` | derived | `venues_meta.closing_buffer_minutes`, or `CLOSING_BUFFER_DEFAULT_MINUTES` when `null` |
| `CLOSING_BUFFER_DEFAULT_MINUTES` = 30 | constant | `ranking.js` |
| `FEASIBILITY_TOLERANCE_MINUTES` = 15 | constant (provisional) | `ranking.js` |
| `PLAN_B_MIN_SESSION_MINUTES` = 90 | constant (provisional) | `ranking.js` |
| `PLAN_B_MIN_CONFIDENCE` = `mixed` | constant (provisional) | `ranking.js` |
| `SEAT_CHECK_BUFFER_MINUTES` = 10 | constant (provisional) | `ranking.js` |
| `MIN_HISTOGRAM_HOURS` = 6 | constant (provisional) | `ranking.js` |
| `N`, `P` | constant (**unset** until Phase 0) | `ranking.js` |
| `plan_a_arrival_mid`, `plan_a_arrival_upper` | derived | Plan A's own `arrival_mid` and `arrival_upper` |
| `arrival_date`, `today`, `yesterday` | derived | `date(arrival_abs)`, and `resolve_hours` for that date and the one before |
| `fallback_travel_minutes_mid`, `fallback_travel_minutes_upper` | derived | `venues_meta.fallbacks[].travel_band` |
| `RETURN_CORE_FROM_MINUTES` = 420, `RETURN_CORE_UNTIL_MINUTES` = 1290 | constant (**maintained assumption** — neither provisional nor frozen; see "The claim, its basis, its scope, and its maintenance") | `ranking.js` |
| `RETURN_SERVICE_DAY_START_MINUTES` = 240 | constant | `ranking.js` |
| `RETURN_TOLERANCE_MINUTES` = 10 | constant (provisional) | `ranking.js` |
| `RETURN_CYCLE_LATEST_MINUTES` = `null` | constant (provisional) | `ranking.js` |
| `session_end_mid`, `session_end_upper` | derived | `arrival_*` + `duration` |
| `last_departure_mid`, `last_departure_upper` | derived | `venues_meta.return_transport[dest][mode].last_departure_band` — named for the **bound** that consumes it, as every other pair here is; `last_departure_upper` takes the band's **lower** edge |
| `return_margin_mid`, `return_margin_upper` | derived | `last_departure_*` − `session_end_*`, as the `surplus_*` sum type — or `AT_LEAST(0)` on a `core_span` / `schedule_free` pass. There is no other variant: the pre-dawn case returns `unverified`, never a margin |
| `bicycle_with_you` | derived | `outbound_mode == "cycle"` for Plan A; **Plan A's value, unchanged**, for Plan B |
| `binding_limit_mid`, `binding_limit_upper` | derived | `min(effective_close_* − closing_buffer, last_departure_*)` |

`duration` is the requested session length in minutes. `closing_buffer` is always the resolved value, never the raw nullable field.

**The UI selects a date, not a weekday.** An earlier draft selected a weekday while `holidays.json` was keyed by date, so the two could never be reconciled — and the hours schema had nowhere to hold Google's date-specific overrides. `selected_weekday` is derived, never chosen directly.

### `resolve_hours(venue, target_date)`

Hours resolution is a **function of an arbitrary date**, not of the user's selected date. It is called for *every* date whose periods might matter. Because of after-midnight closing that is often two dates, but **not always** — the source-authority rules below decide whether the previous date is admitted at all, and a session crossing midnight can pull in a following date as well.

```
resolve_hours(venue, target_date) -> {state, periods}

    target_weekday = weekday(target_date, tz="Asia/Singapore")

    if current_hours_valid_from <= target_date <= current_hours_valid_through:
        return venue.hours.current_hours_by_date[target_date]   # every date in the window is materialised
    elif target_date is in holidays.json:
        return {state: "unknown", periods: []}            # beyond the window, known holiday
    else:
        return regular_hours[target_weekday]
```

**Every date goes through this function — never through `regular_hours` directly.** An earlier draft wrote the resolution inline against `selected_date` and then had the active-period lookup pull "periods recorded on" the arrival and previous dates, bypassing overrides and holiday handling for both. A venue with a date override on the previous day, or a previous day that is a holiday beyond the horizon, would have had the wrong periods — or fabricated ones — silently used for a post-midnight arrival.

**A known public holiday beyond the current-hours window yields `unknown` hours, never inferred regular hours.** `currentOpeningHours` covers exactly seven days including the request date; past that, a holiday's hours are genuinely not known, and guessing the regular weekday schedule on a day when malls close early is the exact failure this tool exists to prevent.

**`unknown` propagates only when no known candidate period matches the arrival.** A known matching period returns `open` even if the sibling date is `unknown` — see the precedence in "Deriving the active period" below, which is authoritative. `unknown` is never resolved to `closed`.

**The current-hours window is computed, then validated.** `current_hours_valid_from` and `current_hours_valid_through` are derived from the request's local date — start date through start + 6 days — per Google's documented contract: *"the next seven days (including today) … starts at midnight on the date of the request and ends at 11:59 pm six days later."* Every period endpoint date is then validated against that window, so a future change in Google's behaviour fails loudly instead of silently. This makes the window explicit for the UI ("beyond this date, regular schedule only"), and replaces an earlier rule that derived the horizon from the latest date a period *opened* — which understated it at 4 of 28 venues.

**Every date inside the window is materialised**, explicitly `known` or `closed`, including dates covered by a period that spans in from an earlier date. Inside the window, a **missing entry is malformed data** and is surfaced as such — never silently treated as "use regular hours". That fallback was a real defect: a special closure has no opening period, so it produced no entry at all, and the regular schedule was silently resurrected on a day the venue is shut.

### One coordinate system: absolute minutes

Periods carry offsets from **their own start date's** local midnight, and a period can close after midnight. Comparing such an offset directly against an arrival time expressed relative to a *different* date is meaningless — a Tuesday 00:30 arrival (`30`) would fail to match a Monday period `{open: 450, close: 1500}` even though 00:30 Tuesday falls squarely inside it.

Everything is therefore converted to **absolute minutes** before any comparison:

```
abs(date, offset) = days_since_epoch(date) * 1440 + offset      # date in Asia/Singapore
```

For a period `{open, close}` recorded on date `D`:

```
period_start_abs = abs(D, open)
period_end_abs   = UNBOUNDED            if p.always_open
                   abs(D, close)        otherwise
                                        # close > 1440 rolls into D+1 naturally
```

Worked example — Monday period `{open: 450, close: 1500}` spans `abs(Mon, 450)` to `abs(Mon, 1500)`, i.e. Monday 07:30 to Tuesday 01:00. A Tuesday 00:30 arrival is `abs(Tue, 30)` = `abs(Mon, 1470)`, which lies inside `[abs(Mon,450), abs(Mon,1500))`. It matches, as it must.

**No comparison anywhere in the codebase mixes coordinate systems.** Offsets are for storage; absolute minutes are for arithmetic.

### Deriving the active period

```
arrival_abs   = abs(departure_date, leave_at) + travel_minutes
arrival_date  = date(arrival_abs)

# 1. Resolve the arrival date, and note the AUTHORITY it was resolved under.
#    authority = "current" when the date is inside the current-hours window,
#                "regular" otherwise. Current outranks regular.
arrival_hours = resolve_hours(venue, arrival_date)

# 2. Decide whether the previous date may contribute at all.
if authority(arrival_date) == "current":
    # The materialised entry is COMPLETE — it already includes coverage from
    # periods spanning in from earlier dates. Admitting lower-authority regular
    # carry-in here would let a 24/7 regular schedule override an explicit
    # current-hours closure.
    candidates = { arrival_date: arrival_hours }

elif arrival_date is a known holiday outside the window:
    # The holiday rule is a positive assertion of ignorance about THIS date.
    # A regular overnight period from the previous date must not overturn it.
    return unknown

else:
    candidates = { arrival_date:         arrival_hours,
                   arrival_date - 1 day: resolve_hours(venue, arrival_date - 1 day) }

# 3. Build periods from every date whose state is known or closed.
#    (a closed date contributes zero periods, but contributes certainty)
candidate_periods = [ [abs(d, p.open), period_end_abs(d, p))
                      for d, h in candidates if h.state in ("known", "closed")
                      for p in h.periods ]

    where period_end_abs(d, p) = UNBOUNDED        if p.always_open
                                 abs(d, p.close)  otherwise

# 4. A known period containing the arrival settles it.
#    UNBOUNDED compares greater than every arrival, so an always-open period
#    contains any arrival at or after its open.
matches = [ P for P in candidate_periods
            where P.period_start_abs <= arrival_abs < P.period_end_abs ]

if matches is non-empty:
    # Several may match — decomposed chain entries all encode the same close.
    if the matches do NOT all share one period_end_abs:
        # Contradictory source data. Do NOT pick one; the venue is not ranked.
        raise validation failure   # per-venue: flag, keep last-known-good, stale
    # All ends are equal; the minimum is a deterministic tie-break over identicals.
    active_period   = the P in matches with the smallest period_end_abs
    venue_close_abs = active_period.period_end_abs        # may be UNBOUNDED
    return open

# 5. Nothing matched — was that certainty, or ignorance?
if any(h.state == "unknown" for h in candidates):
    return unknown

# 6. Every contributing date was definite and none contained the arrival.
return closed
```

**Positive evidence wins over a missing sibling.** An earlier draft returned `unknown` the moment *either* date was unknown — before even looking for a match. That discarded real information: if today's hours are known and a known period contains the arrival, the venue **is** open, regardless of whether yesterday's hours could be resolved. Yesterday only matters for arrivals that fall in its after-midnight tail, and if the arrival didn't land there, its unavailability is irrelevant.

The precedence above encodes the distinction that makes this work:

| Date state | Contributes periods? | Contributes certainty? |
| --- | --- | --- |
| `known` | yes | yes |
| `closed` | no (empty by definition) | **yes** — definitely not open then |
| `unknown` | no | **no** — silence, not a negative |

So a failed match is only `closed` when every contributing date was *definite*. If any was `unknown`, the honest answer is `unknown` — the arrival might have fallen inside a period nobody could see.

- **Both dates go through `resolve_hours`** *when the previous date is admitted at all*. It is resolved with the same window and holiday logic as the arrival day, never read raw from `regular_hours`.
- **Source authority governs whether the previous date is admitted.** Current hours outrank regular hours, and the precedence is not merely about which entry wins for a single date — it decides which dates may contribute periods at all:
  - **Arrival date inside the current-hours window** → its materialised entry is **complete and authoritative**, already including coverage from periods spanning in from earlier dates. The previous date is **not** admitted. Without this, a venue whose regular schedule is 24/7 would have its unbounded regular period match an arrival on a date the current hours explicitly record as **closed** — and positive-evidence precedence would return `open` on a day the venue is shut.
  - **Arrival date is a known holiday outside the window** → return `unknown` immediately. The holiday rule is a positive assertion of ignorance about *that specific date*, and a regular overnight period carried in from the previous day must not be allowed to overturn it. A Monday 22:00–02:00 regular pattern is evidence about ordinary Mondays, not about the eve of a holiday.
  - **Otherwise** → both dates are admitted under compatible regular authority, and the ordinary previous-date lookup applies.
- **This does not weaken the positive-evidence rule**, which concerns a *known* arrival date with an `unknown` sibling — that still returns `open`. The cases above are the reverse: they stop a *lower-authority* sibling from manufacturing `open` for an arrival date whose own hours are authoritative or deliberately unknown.
- **Boundary rule is `period_start_abs <= arrival_abs < period_end_abs`.** Arriving exactly at opening is fine; arriving exactly at closing is not open. Stated through `period_end_abs`, never through a raw `close`, because an `always_open` period has no `close` — its end is `UNBOUNDED`, which compares greater than every arrival.
- **The previous date is a candidate whenever the authority rules admit it** — an arrival shortly after midnight belongs to yesterday's after-midnight period, not to today's, so under compatible regular authority it must always be resolved. It is *not* admitted when the arrival date's own hours come from the complete materialised current-hours entry, which already contains that span-in coverage.
- **`unknown` is never silently treated as `closed`.** A venue whose hours could not be resolved is surfaced as hours-unknown, not filtered out as shut.
- **Travel can cross midnight**: `arrival_abs` is computed from the *departure* date plus travel, then the *arrival* date is read back off it. **Hours resolve for the arrival date and the date before it — never for the departure date alone.** Note that when travel crosses midnight those coincide: `arrival_date - 1` *is* the departure date, so it does get resolved — as the previous-date candidate, not as the anchor. The rule is that the departure date never drives resolution on its own.
- **Several candidate periods may contain one instant, and they must agree on `period_end_abs`.** An earlier draft claimed at most one period can contain a given instant. That is false once a multi-day period is decomposed: a Tuesday arrival at UTown matches both Tuesday's `{0, 6810}` and Monday's `{0, 8250}`. Both resolve to `abs(Tue, 6810)` — the same real close — so the overlap is benign. The policy is explicit, and the two halves must not be confused:

  - **Equal matching ends — valid.** This is the normal decomposed-chain case. Selecting the minimum is a deterministic tie-break over identical values; it changes nothing and simply makes the choice reproducible.
  - **Unequal matching ends — validation failure.** This is contradictory source data, and it is **not** resolved by taking the smallest. The venue is **not ranked**: it goes through the per-venue failure path (flag loudly, retain last-known-good, `status: stale`), exactly as two overlapping `known` periods on the *same* weekday do.

An earlier draft said the minimum was "pessimistic if they ever disagree, which matches this project's bias against the wasted trip". **That was wrong** — it would silently rank a venue on data known to be self-contradictory. Choosing the safer of two numbers you have no reason to trust is not caution; it is guessing quietly. The minimum is a tie-break among equals, never a resolution of disagreement.
- **Split periods** are handled by the same scan. Arrival in the gap between two *known* periods resolves by the same precedence as any other non-match — `closed` only when neither candidate date is `unknown`, since an unknown date could have held a period covering that apparent gap.
- **If no period matches**, the result depends on why: `closed` (and filtered out) **only when neither candidate date is `unknown`**; otherwise `unknown`, and surfaced as hours-unknown rather than filtered.

### Travel: two derived values

`venues_meta.json` stores a coarse band, never exact minutes. Two numbers come from it:

```
travel_minutes_mid   = band midpoint      # display, ordering, Plan B arrival
travel_minutes_upper = band upper edge    # the robustness test
```

Using the midpoint everywhere would pretend a ±2.5 minute estimate is exact. Using the upper edge for feasibility means `robust` genuinely survives the pessimistic case. The same derivation applies to `fallbacks[].travel_band`.

### Per-venue derived values — resolved independently for each bound

**The two bounds must be resolved separately, all the way through.** A later arrival can fall into a *different* period, or into no period at all — so reusing the midpoint's closing time for the upper-bound test is wrong near closing, across midnight, and with split periods.

```
arrival_mid           = abs(departure_date, leave_at) + travel_minutes_mid
active_period_mid     = period containing arrival_mid           (may be none)
required_end_mid      = arrival_mid   + duration + closing_buffer
effective_close_mid   = NONE if active_period_mid is none else
                        effective_close(venue, active_period_mid,
                                        arrival_mid,   required_end_mid)

arrival_upper         = abs(departure_date, leave_at) + travel_minutes_upper
active_period_upper   = period containing arrival_upper         (may be none)
required_end_upper    = arrival_upper + duration + closing_buffer
effective_close_upper = NONE if active_period_upper is none else
                        effective_close(venue, active_period_upper,
                                        arrival_upper, required_end_upper)

# effective_close(venue, active_period, arrival_abs, required_end_abs)
#
#   Takes `venue` so it can call resolve_hours() and read source authority for
#   any date it needs — it must not depend on unstated surrounding variables.
#   Takes required_end_abs so it knows exactly how far coverage must be proven.
#   NEVER called with active_period == none; the caller returns NONE instead.
#
#   Returns exactly one of THREE outcomes — never UNBOUNDED, which is a
#   period-level containment value and never a feasibility result:
#     an absolute minute  — a real close, REACHED and authoritatively validated
#     COVERED             — required_end_abs authoritatively covered, and no close
#                           was reached at or before it. A close may well exist
#                           STRICTLY BEYOND required_end_abs; the walk deliberately
#                           did not look, so nothing may be claimed about it.
#                           A close exactly AT required_end_abs is NOT this case —
#                           it is returned as a finite close (exact surplus 0).
#     UNKNOWN             — the run reached a date boundary it could not
#                           authoritatively resolve, BEFORE required_end_abs
#   NONE is NOT in that set. It is produced by the CALLER when active_period is
#   missing, in which case effective_close is not invoked at all. It means "not
#   open at this arrival" — a definite fact, not unresolved hours.
#
#   THE WALK IS SEQUENTIAL AND LAZY, AND STOPS AT THE FIRST OF:
#     1. a known close inside the span      -> return that close
#     2. required_end_abs covered           -> return COVERED
#     3. an unresolvable date boundary      -> return UNKNOWN
#
#   A following date is resolved ONLY when the known open run actually reaches
#   that date boundary AND required_end_abs lies beyond it. A date the run never
#   reaches is never consulted and can never contribute UNKNOWN.
#
#   Each bound resolves its own run independently, on its own arrival date.

# BRANCH ON THE OUTCOME BEFORE ANY ARITHMETIC.
# Subtracting from effective_close_* while it may hold COVERED, NONE or UNKNOWN
# is a type error, not a shortcut — these are tagged outcomes, not numbers.

case effective_close_mid:

  UNKNOWN:
      -> hours-unknown. No tier, no metrics. usable_minutes, surplus_mid and
         latest_leave_at are all undefined and MUST NOT be computed or shown.

  NONE:
      -> not open at that arrival. Metrics undefined; the venue cannot be tight
         and falls to shorter. This is definite, not unresolved — it does not
         unrank the venue.

  COVERED:
      usable_minutes  = duration
      surplus_mid     = AT_LEAST(0)
      latest_leave_at = UNDETERMINED

  a finite absolute close C:
      usable_minutes  = max(0, min(C - closing_buffer, arrival_mid + duration) - arrival_mid)
      surplus_mid     = (C - closing_buffer) - (arrival_mid + duration)
      latest_leave_at = (C - closing_buffer) - duration - travel_minutes_mid

case effective_close_upper:

  UNKNOWN:                  -> hours-unknown, as above
  NONE:                     -> fails robust; the midpoint is still evaluated
  COVERED:                  -> surplus_upper = AT_LEAST(0)
  a finite absolute close C -> surplus_upper = (C - closing_buffer) - (arrival_upper + duration)

# effective_close_* == UNKNOWN -> hours-unknown; the venue is NOT ranked, and no
#                                 surplus is computed for it at all
#
# effective_close_* == NONE    -> no active period at that arrival:
#     upper NONE  -> fails robust, but the MIDPOINT is still evaluated for tight
#     mid   NONE  -> cannot be tight; falls to shorter
#   NONE is a definite "not open then", NOT unresolved hours — it never unranks
#   the venue on its own. Only UNKNOWN does that.
#
# effective_close_* == COVERED -> surplus_*       = AT_LEAST(0)
#                                 usable_minutes  = duration
#                                 latest_leave_at = UNDETERMINED
#
#   COVERED proves the required span is open — hence surplus >= 0, enough to pass
#   the tier tests, but NOT an exact figure. Note it does NOT prove a close exists
#   beyond required_end_abs: an always-open period may have no close at all.
#
#   UNDETERMINED is NOT "there is no latest departure". The walk stopped once
#   required_end_abs was covered and deliberately looked no further, so a close
#   may well exist beyond it. The UI says "no known closing constraint within the
#   verified span". A later close that was never reached and validated must not be
#   used for exact surplus or later-departure advice.
```

`surplus_upper` is **undefined** when `active_period_upper` is none — that is not a shortfall of zero, it is "the venue is shut by the time you could plausibly arrive", and it fails `robust` outright.

#### `AT_LEAST(0)` is a tagged outcome, not a number

`surplus_*` is therefore a **sum type**: either a real integer margin, or the tag `AT_LEAST(0)`. It is never an ordinary number that happens to be zero, and code must not compare, subtract from, or format it as one. Three derived accessors, and **only** these three, may consume it:

| Accessor | `AT_LEAST(0)` yields | A finite surplus `s` yields |
| --- | --- | --- |
| `passes_feasibility()` — the `surplus >= 0` test | **true** | `s >= 0` |
| `finite_shortfall()` — minutes short, for the tolerance test | **not applicable — rejects the tag** | `-s` (only when `s < 0`) |
| `sort_key()` — the final `surplus_mid` tiebreak | **`0`** | `s` |
| `display()` — UI margin text | **no numeric margin**; "fits — margin not established" | `"3h spare"` |

**Every comparison goes through an accessor; no tier test touches `surplus_*` directly.** Writing `surplus_upper >= 0` or `-surplus_mid <= FEASIBILITY_TOLERANCE_MINUTES` is a type error — the second literally negates a tag.

**`finite_shortfall()` is a partial function on the finite variant only**, and rejects `AT_LEAST(0)` rather than coercing it. It can never be reached with the tag anyway: `passes_feasibility(AT_LEAST(0))` is `true`, so the `OR` short-circuits before it. The rejection is a guard against a future refactor reordering those operands, not a live path.

`sort_key()` returning the proven lower bound is deliberate: it **never overstates** the margin against a venue with a real measured surplus, so a `COVERED` venue can never out-rank a genuinely-verified one on a tiebreak it did not earn. And `display()` must never fall back to `sort_key()` — rendering `AT_LEAST(0)` as the number "0" would claim a venue is closing exactly at your deadline when in fact its closing time was never established. **The two failure modes are opposite and both are wrong**; that is why display and sorting are separate accessors rather than one value.

**`UNBOUNDED` is a runtime value, never a serialised one.** JSON has no `Infinity` literal — it is not valid JSON and `JSON.parse` rejects it — so the stored form of an always-open period is simply **the absence of a `close` key**, plus `always_open: true`. `ranking.js` derives the unbounded end when it builds `candidate_periods`, and nothing writes a sentinel number into `venues.json`. Any code that reads `p.close` directly, rather than going through `period_end_abs(d, p)`, is a bug: it will read `undefined` on exactly the venues that are open the longest.

**Arrival is per-venue**, because travel time is. Three consequences, all easy to get wrong:

1. The "open on arrival" test uses *that venue's* arrival, against *that venue's* active period.
2. `relative_busyness` is read at *that venue's* `arrival_mid` hour.
3. Arrival hours are rarely round. **The busyness bucket is chosen by flooring** — 16:25 reads hour 16.

`latest_leave_at` answers "when must I leave for the session to still fit". As defined here it is the **hours-side** answer only; the published value is the minimum of this and the return-side deadline — see "Getting home: session-end return transport", which is what makes the plan's second query correct on any evening where the last departure binds before the closing time. It does **not** account for the busyness band worsening at a later arrival.

### Feasibility tiers

```
hours-unknown : effective_close_mid == UNKNOWN OR effective_close_upper == UNKNOWN
                -> surfaced as hours-unknown and NOT ranked; no tier is assigned
                   (UNKNOWN only — a NONE on either bound does NOT unrank)

robust  : effective_close_upper is not NONE
          AND passes_feasibility(surplus_upper)

tight   : not robust
          AND effective_close_mid is not NONE
          AND ( passes_feasibility(surplus_mid)
                OR finite_shortfall(surplus_mid) <= FEASIBILITY_TOLERANCE_MINUTES )

shorter : otherwise — including effective_close_mid == NONE
```

`robust` requires the **upper-bound arrival to land inside a genuinely open period** and the whole requested session to fit before that period's closing buffer. `tight` is judged on the midpoint plus the named tolerance.

#### Continuous known coverage, including across the window edge

Being open *on arrival* does not prove the session fits. A `known` state on each spanned date is necessary but **not sufficient** — the next date may be known and closed, or known and reopening later, and a period ending at a window edge is not a real close. For the midpoint and upper bounds **independently**:

1. **Walk forward sequentially from the active period, and stop at the first of three outcomes** — a known close, a covered `required_end_abs`, or an unresolvable date boundary. `required_end_abs = arrival_abs + duration + closing_buffer`.

   ```
   1. Start at the active period.
   2. If a known close C falls before the next date boundary:
        if C <= required_end_abs                            -> return C;
        else (required_end_abs < C)                         -> return COVERED.
   3. If required_end_abs is covered                        -> return COVERED.
   4. If the run REACHES the next date boundary and
      required_end_abs lies beyond it:
        resolve that following date;
        if it cannot be authoritatively resolved            -> return UNKNOWN;
        if it joins (period begins exactly 00:00)           -> continue the walk;
        otherwise the run ends at the boundary              -> return that close.
   ```

   **The `required_end_abs` boundary is inclusive on the close side.** A finite close at exactly `required_end_abs` is **returned as a finite close**, not folded into `COVERED` — which makes its `surplus` exactly `0`, a real measured zero rather than the `AT_LEAST(0)` tag. Only a close *strictly beyond* `required_end_abs` yields `COVERED`, because that is the case the walk genuinely did not reach and cannot speak for. The distinction matters: an exact `0` is a verified thin margin and displays as one; `AT_LEAST(0)` is an unestablished margin and must not.

   **The walk is lazy: a date the run never reaches is never resolved, and therefore can never contribute `UNKNOWN`.** This is load-bearing, and an earlier draft got it backwards by resolving every date intersected by the span up front. Worked counterexample:

   > Arrival Monday 18:00; the venue has a **known** Monday close at 22:00; `required_end` is Tuesday 00:30; Tuesday is an out-of-window known holiday and therefore `unknown`.

   The correct answer is a **known shortfall** measured against the Monday 22:00 close — `tight` or `shorter` depending on its size. Tuesday is **irrelevant**, because the continuous open run ended at 22:00, before Tuesday began. Resolving Tuesday eagerly would have returned `hours-unknown` and unranked a venue whose closing time is perfectly well known. Ignorance about a date you never reach is not ignorance about your session.

   Where a period ends at a boundary flagged `continues_beyond_window`, the walk resolves the next date and attempts to join, exactly as step 4 describes.

   **The walk applies to every period shape, without exception** — ordinary overnight, multi-day, truncated and `always_open` alike. **A period's own extent is never evidence about a date it merely crosses** *and actually reaches*. The source period records what the venue's schedule *says*; it cannot speak for a date whose authority differs:

   | Active period | Crossing into | Naive result | Correct result |
   | --- | --- | --- | --- |
   | Finite overnight, Mon 22:00–Tue 02:00 (regular) | Tuesday, an out-of-window known holiday | `known` coverage to 02:00 | **hours-unknown** |
   | Finite multi-day suffix entry (regular) | a crossed date that is an out-of-window known holiday | `known` coverage to the chain's close | **hours-unknown** |
   | `always_open` (regular 24/7) | an out-of-window known holiday | `robust` forever | **hours-unknown** |

   An earlier draft scoped this walk to `always_open` and `continues_beyond_window` periods only, which left the first two rows broken: a perfectly ordinary Monday-night regular period would have established known Tuesday coverage on a day nobody can vouch for.

   **`always_open` specifically means *"this source period records no known close"*, not "open forever regardless of what other dates say".** A 24/7 *regular* schedule says nothing about a date the current-hours window explicitly closes, nor about a known holiday beyond that window. An `always_open` period therefore yields `COVERED` — never a claim of no close — and only once every date the run actually reaches has agreed.
2. **Join only if the next date's known period begins exactly at 00:00.** The run then continues into that period, and `effective_close` becomes whatever the walk ultimately returns — a later known close, or `COVERED` once `required_end_abs` is passed.
3. If the next date is known but leaves a gap at 00:00, the run ends there — **the venue genuinely closes at the gap**, and that is a *known* close.
4. If the run is cut short because hours became **`unknown`** before `arrival + duration + closing_buffer`, feasibility is **hours-unknown**: the venue is surfaced as such and is **not ranked**, in neither the ranked list nor the `shorter` group.
5. Otherwise the run ended at a known close. **Compute `surplus_*` against `effective_close` and apply the ordinary tiers unchanged.**

**This does not override the feasibility tiers, and in particular does not abolish `tight`.** An earlier draft of this rule demanded that the whole interval be continuously covered, which would have relegated any venue closing even a minute short — silently destroying the `FEASIBILITY_TOLERANCE_MINUTES` band the tier contract deliberately provides. The distinction is between a **known** shortfall and an **unknown** one:

| `effective_close` outcome | Result |
| --- | --- |
| `COVERED` (or a sufficient known close) **on the upper bound** | `robust` |
| `COVERED` on the midpoint only | **not** `robust` — falls to `tight` |
| Known close, shortfall ≤ `FEASIBILITY_TOLERANCE_MINUTES` | `tight`, with the thin-margin warning |
| Known close, larger shortfall | `shorter`, in its own group |
| **`NONE` on the upper bound** | fails `robust`; the **midpoint is still evaluated** and may be `tight` |
| **`NONE` on the midpoint** | cannot be `tight` → `shorter` |
| Either bound returns **`UNKNOWN`** | **hours-unknown — not ranked at all** |

**`NONE` and `UNKNOWN` are different and must not be conflated.** `NONE` is a definite fact — the venue is *not open* at that arrival — and it never unranks a venue by itself; an upper-bound `NONE` simply fails `robust` while the midpoint is still assessed. `UNKNOWN` is unresolved hours, and only it removes the venue from ranking entirely.

**`robust` is judged on the upper bound alone.** Full coverage at the midpoint does not make a venue `robust` — that is the whole point of resolving the two bounds independently. A venue that fits comfortably on an optimistic journey but not on a pessimistic one is `tight`, not `robust`, and `active_period_upper` failing to exist fails `robust` outright rather than reading as a zero shortfall.

A known 10-minute shortfall is still `tight`. Only ignorance removes a venue from the ranking — never a small, measured shortfall. `closing_buffer` is inside the span deliberately: it can cross midnight even when the requested session itself does not.

**This is bounded to at most two calendar dates**, because `duration + closing_buffer` is under 24 hours. It is not a general lookahead and needs no cycle bound.

Both branches occur in the real venue set. A 24-hour venue joins, because the next date resolves to the `always_open` form beginning at 00:00. An ordinary venue whose Friday period was clipped at the window edge does **not** join, because Saturday reopens at 07:30 — so it correctly closes at Saturday 00:00, which its own `regular_hours` independently confirms.

**`FEASIBILITY_TOLERANCE_MINUTES = 15`, provisional**, a named constant in `ranking.js`. Bands are five minutes wide, so the midpoint carries ±2.5. Fifteen minutes is roughly **4-8% of a supported session** — about 8% of a three-hour one and about 4% of a six-hour one. A shortfall worth flagging, not worth relegating. Adjust after real use.

`robust` and `tight` are both ranked, `robust` first. `shorter` drops to the separate group showing what it does give ("4h of 6h — closes 8pm").

**This is the hours tier, not the whole feasibility answer.** The session must also be one you can get home from; the return tier and the combined `overall_tier` that actually drives ranking are defined in "Getting home: session-end return transport" below.

This replaces the hard cliff at `surplus >= 0`, which relegated 5h59m while ranking 6h00m despite the boundary being noisier than the arithmetic implied.

---

## Getting home: session-end return transport

Everything above answers one question — **is the venue open for the whole session?** It never asks
the second one: **when the session ends, does anything still run to take me home?**

A six-hour session leaving at 18:00 ends around 00:30. A venue open until 02:00 clears every test
above, ranks `robust`, and still strands you. That is the same failure this tool exists to prevent —
a wasted trip — arriving from the far end of the evening instead of the near end, and it is arguably
worse, because by then the trip has already been spent.

The return question is therefore a **second feasibility constraint on the same session**, resolved
with the same machinery: hand-maintained data, coarse bands, absolute minutes, two independently
resolved bounds, tagged outcomes, and positive evidence before silence.

### What it is not

- **Not a transit API.** No live data of any kind, per the non-goals. Return service is
  hand-maintained in `venues_meta.json`, exactly like `access`.
- **Not a routing engine.** One number per venue per destination per mode — *the latest departure
  from the venue that still gets you home* — not a journey plan.
- **Not a hard filter.** "You can go, but leave by 23:10" is actionable advice, not a
  disqualification. The constraint shortens the session; it rarely removes the venue.

### The return leg is not the outbound leg reversed

Three things differ, and all three matter.

**The destination is home, not the origin.** Sessions start from `origin_a` (home) or `origin_b`
(work); they end by going home. The return leg is therefore evaluated against
`access[origin_a]` — the modes and routes recorded for the *home* leg — regardless of which origin
the trip started from. *Assumption, stated deliberately:* the session always ends by going home. A
return-destination control is a plausible later addition; nothing in this design forbids it, which is
why `return_transport` is keyed by destination rather than hard-coding `origin_a`.

**The bicycle is a physical object.** `decisions.md`, 2026-08-30 already records that cycling is
viable only from home, because that is where the bicycle is kept. The return leg inherits the
consequence: **`cycle` is an admissible return mode only if `bicycle_with_you`.** If you took transit
from work, the bicycle is at home and cannot carry you back to it — and it is still at home when you
walk on to Plan B, which is why `bicycle_with_you` is threaded rather than re-derived per leg.

**The pessimistic edge flips.** For travel duration, pessimism is the band's **upper** edge — the
journey took longer. For a last departure, pessimism is the band's **lower** edge — service ended
earlier than the midpoint suggested. The two bounds still resolve independently, and the pessimistic
pairing is `session_end_upper` against `last_departure_upper`: a longer journey ends the session
later *and* is tested against the earlier plausible last service. **Every derived value is named for
the bound that consumes it** — `last_departure_upper` is the value the *upper bound* uses, and it is
the band's *lower* edge. Naming any of them after the edge instead would break the `_mid`/`_upper`
convention that every other pair in this document follows.

### Schedule-free modes versus schedule-bound modes

| Mode | Kind | Return availability |
| --- | --- | --- |
| `walk` | schedule-free | Available whenever it is recorded as viable at all |
| `cycle` | schedule-free | Available whenever it is recorded as viable **and** `bicycle_with_you` **and** the rain toggle is off, subject to `RETURN_CYCLE_LATEST_MINUTES` |
| `transit` | schedule-bound | Available until that service day's last departure |

This split is what keeps the hand-maintained burden proportionate: **only `transit` needs a recorded
last departure.** A schedule-free mode's viability is already encoded by its presence in `access` —
no new data, no new judgement, no second contract to keep in sync.

A schedule-free admissible mode is **positive evidence** and settles the question, exactly as a known
period containing the arrival settles the hours question even when the sibling date is `unknown`.
Missing transit data only produces an unresolved answer when nothing else can carry you home.

**Rain removes `cycle` from the return set**, mirroring `wet_weather_mode`'s outbound substitution.
When the toggle is on, `wet_weather_mode` has already replaced the outbound `cycle` with `transit`,
so the bicycle is at home anyway and the rule is consistent rather than merely parallel. Rain that
starts *after* departure is not modelled — there is no weather source, by design — and this is the
case where the return constraint bites hardest, so the UI must say which mode it is counting on.

### Admissible return modes

A **total function of explicit inputs.** It reads nothing from surrounding scope — the same rule
`effective_close(venue, active_period, arrival_abs, required_end_abs)` already follows, and for the
same reason: it is resolved **per bound**, so an implicit `session_end` would silently collapse the
two bounds into one.

```
return_destination = origin_a                       # see the assumption above

admissible_return_modes(venue, bicycle_with_you, raining,
                        session_end_abs, service_date) -> set of modes

    modes = { m for m in access[return_destination] if the entry is present and not null }

    if not bicycle_with_you:  modes -= {"cycle"}     # the bicycle is elsewhere
    if raining:               modes -= {"cycle"}     # same substitution as wet_weather_mode

    if RETURN_CYCLE_LATEST_MINUTES is not null:
        # A CLOCK-TIME OFFSET, resolved against the service date like every other
        # offset in this model. > 1440 means after midnight (1500 == 01:00 the
        # next day). Comparing a raw offset against an absolute minute would be
        # the exact coordinate-system error the periods array already forbids.
        cycle_cutoff_abs = abs(service_date, RETURN_CYCLE_LATEST_MINUTES)
        if session_end_abs > cycle_cutoff_abs:
            modes -= {"cycle"}

    return modes
```

**`bicycle_with_you` is threaded, not inferred.** For Plan A it is `outbound_mode == "cycle"`. For
Plan B it is **Plan A's** value, unchanged — the bicycle is wherever you rode it, and a fallback leg
does not put it back at home. Two consequences, both of which must be implemented:

- Plan B's return set is computed with Plan A's `bicycle_with_you`, never with `fallbacks[].mode`.
- **A `fallbacks[].mode == "cycle"` link is only viable when `bicycle_with_you` is true.** This is a
  pre-existing gap in the Plan B contract that this design exposes rather than creates: 22 of the
  current fallback links are `cycle`, and every one of them is unusable on a trip that started by
  transit. Plan B must drop such a link exactly as it drops a fallback closed at the delayed arrival.

An **empty** admissible set means no recorded way home. That is `unverified`, not `closed`:
`access` is hand-maintained and incomplete by construction, so its silence is silence, never a
negative — the same distinction the hours model draws between an `unknown` date and a `closed` one.
**No later branch may overturn an empty set** — see "Evaluating one bound", where the admissible set
is derived first, before anything else is consulted.

### The service day starts at 04:00, not at midnight

A last departure is a property of a **night**, and nights straddle midnight. Storing it as an offset
from the service day's local midnight — with `> 1440` meaning after midnight, exactly as `close`
already does — keeps one coordinate system and one convention.

Which night applies is then decided by a **service-day boundary**, not by the calendar date:

```
service_date(t) = date(t - RETURN_SERVICE_DAY_START_MINUTES)          # 04:00
last_departure_abs = abs(service_date, last_departure_offset)         # offset may exceed 1440
```

Anchoring on the calendar date would compare a session ending at 03:30 on Saturday against
*Saturday night's* last departure, some twenty hours away, and cheerfully report a comfortable
margin. The 04:00 boundary puts that session on Friday night's service, where it belongs.

### `resolve_return_service(venue, destination, mode, service_date)`

The return leg's counterpart to `resolve_hours` — a **total function of an arbitrary service date**,
never inline logic against the session's own date, and the single place the precedence among
`holiday_return_policy`, `by_weekday` and `default` is decided.

```
resolve_return_service(venue, destination, mode, service_date)
    -> PRESENT(entry) | MISSING | MALFORMED(reason)

    block = venue.return_transport?[destination]?[mode]
    if block is absent:
        return MISSING

    # The weekday is that of the SERVICE DATE, already chosen by the 04:00
    # boundary — never the weekday of session_end.
    target_weekday = weekday(service_date, tz="Asia/Singapore")

    # 1. Holidays first, exactly as resolve_hours puts the holiday rule ahead of
    #    the regular weekday schedule.
    if service_date is in holidays.json:
        if venue.holiday_return_policy == "substitute_sun":
            entry = block.by_weekday?["sun"] or block.default
        else:                                   # "unknown", the default
            return MISSING                      # -> unverified, never guessed
    # 2. A weekday override outranks the default.
    elif block.by_weekday?[target_weekday] is present:
        entry = block.by_weekday[target_weekday]
    # 3. Otherwise the default.
    elif block.default is present:
        entry = block.default
    else:
        return MISSING

    if entry has no last_departure_band:                 return MISSING

    # Normalise BEFORE validating -- see "From clock string to service-day
    # offset" below. Validating the raw clock numbers would reject every
    # legitimate after-midnight band.
    lo, hi = normalise_band(entry.last_departure_band)   # may return MALFORMED
    if either is MALFORMED:                              return MALFORMED(reason)
    if not (lo < hi):                                    return MALFORMED("edges not increasing after normalisation")

    return PRESENT(entry with lo, hi)
```

#### From clock string to service-day offset

The band is stored as `HH:MM-HH:MM` because that is what a timetable shows and what a human
maintains. Turning it into an offset is **not** "parse the digits": a last departure at `00:30`
belongs to the night that began the previous evening, so it is offset **1470**, not **30**. Leaving
that to the implementer is the ambiguity this section exists to remove — two conforming readings of
the earlier text picked 30 and 1470 and selected different absolute departures.

The rule reuses the service-day boundary already defined above, and nothing else:

```
normalise_edge(HH:MM) -> offset | MALFORMED

    if the string is not HH:MM with 00 <= HH <= 23 and 00 <= MM <= 59:
        return MALFORMED("unparseable edge")

    raw = HH * 60 + MM                                   # 0 .. 1439

    # One boundary, one rule: a clock time before the service day starts belongs
    # to the FOLLOWING calendar date, which is the same night.
    offset = raw + 1440   if raw < RETURN_SERVICE_DAY_START_MINUTES
             raw          otherwise

    return offset                                        # always in [240, 1680)

normalise_band("A-B") -> (lo, hi) | MALFORMED
    lo = normalise_edge(A);  hi = normalise_edge(B)
    both must normalise, and lo < hi must hold AFTER normalisation.
```

| Band | `lo` | `hi` | Note |
| --- | --- | --- | --- |
| `23:20-23:25` | 1400 | 1405 | Ordinary evening |
| `23:55-00:05` | 1435 | 1445 | Straddles midnight; **increasing only after normalisation** — validating the raw digits would read `1435 > 5` and wrongly reject it |
| `00:30-00:35` | 1470 | 1475 | Wholly after midnight |
| `03:58-04:02` | 1678 | 242 | **`MALFORMED`** — the band straddles the service-day boundary, so it names two different nights. The `lo < hi` check catches it; no separate rule is needed |
| `25:00-25:05` | — | — | **`MALFORMED`** — offsets are written as clock times, never as pre-added values |

**The resulting range is `[240, 1680)` — the service day, exactly.** The earlier `[0, 2 × 1440)`
bound was both too loose (it admitted 0-239, which no service day contains) and, because it was
checked before normalisation, unreachable in the cases that mattered.

`abs(service_date, offset)` then converts to absolute minutes for every comparison, exactly as
`period_end_abs` does for a `close` above 1440. No comparison anywhere mixes the two.

#### `edge(band, b)` — which end each bound takes

```
edge((lo, hi), b) = lo                        if b == upper     # pessimistic
                    floor((lo + hi) / 2)      if b == mid       # representative
```

The **upper** bound takes `lo` because pessimism on a last departure is *earlier* service — the
mirror of a travel band, where pessimism is a *longer* journey and therefore the upper edge. The
**mid** bound takes the midpoint, **floored to an integer minute**, which is the conservative
direction here: rounding a last departure down can only make the tool warn sooner, never later.
Every offset downstream is an integer, per the project's integer-minutes rule.

**Three outcomes, and they are not interchangeable.**

| Outcome | Meaning | Result |
| --- | --- | --- |
| `PRESENT` | A usable band for this service date | Feeds the comparison |
| `MISSING` | Nothing recorded — including the honest holiday default | Contributes nothing; if **every** admissible mode is `MISSING`, the bound is `unverified` |
| `MALFORMED` | A recorded value that cannot be true | **Per-venue validation failure**: flag loudly, do **not** rank the venue |

`MALFORMED` is a validation failure rather than a quiet `unverified` for the same reason two
contradictory `period_end_abs` values are: degrading self-contradictory data to "unknown" hides a
typo in a hand-maintained file, and this file has no fetcher to re-derive it from. It takes the same
per-venue failure path as a contradictory hours record.

**But `resolve_return_service` cannot be where that contract is enforced**, because two of the
evaluation branches deliberately return before it is ever called. Enforcement lives in the stage
below; the `MALFORMED` outcome here is a redundant runtime guard, and it should be unreachable
whenever that stage has run.

#### Whole-file validation is a mandatory stage, not a test obligation

The core-span and schedule-free branches never read `return_transport` — that is the point of them —
so a malformed band on such a venue would never be classified at all, and "malformed means unranked"
would be a promise nothing kept. A structural check that exists only in the test suite is not a
pipeline: it fails a build, it does not mark a venue.

So `return_transport` validation is an **explicit mandatory stage over the whole file**, run once per
generation, independent of any bound's evaluation path:

```
validate_return_transport(venues_meta) -> {venue_id: status}

    ONLY A PRESENT BAND IS VALIDATED. Traversal mirrors resolve_return_service's
    MISSING semantics exactly, so the stage can never turn absent service
    information into a validation failure.

    for each venue:
        failures = []
        for each destination, for each mode:
            block = venue.return_transport?[destination]?[mode]
            if block is absent:                      continue     # MISSING
            for each entry in {default} + every by_weekday value:
                if the entry is absent:              continue     # MISSING
                if entry has no last_departure_band: continue     # MISSING
                r = normalise_band(entry.last_departure_band)
                if r is MALFORMED:
                    failures += "<mode>/<day key>: <what failed>"

        status[venue] = {"state": "ok"}                        if failures empty
                        {"state": "invalid", "reason": <all>}  otherwise
```

**The three `MISSING` shapes, spelled out, because conflating any of them with
`MALFORMED` breaks the fail-open requirement:**

| Shape | Stage result | Evaluation-time result |
| --- | --- | --- |
| No `return_transport` block at all | `ok` | `unverified` (`no_data`) unless other evidence settles it |
| Block present, this destination/mode absent | `ok` | as above |
| Entry selected but carrying no `last_departure_band` | `ok` | `MISSING` from the resolver → `unverified` |

Only a **present** `last_departure_band` that fails `normalise_band` yields `invalid`. This is the
same three-way split `resolve_return_service` already draws — `PRESENT` / `MISSING` / `MALFORMED` —
and the stage must not draw it differently, or the two would disagree about the same record.

- **Where it runs, and that it never aborts.** `build/refresh.py`, as a numbered step in the ordered
  pipeline below, after the merge and before the atomic replace. It validates hand-maintained
  metadata, so it is **not conditional on any fetch succeeding**; a fully failed refresh still runs
  it. **The stage completes successfully whatever it finds** — including when every venue is
  `invalid`. It is a *classifier*, not a gate: its job is to label each venue, and the labels are
  written atomically with the rest of `venues.json`, so the generated page always carries the stamp
  the ranking contract requires. **Malformed metadata never blocks the write**, and this is the whole
  failure model — see "One failure model: per-venue, never global" below.
- **What it emits.** `return_transport_status` on each venue object in the generated
  `data/venues.json`, exactly as the per-source `ok` / `stale` / `failed` fields are stamped there.
- **What ranking does with it.** `ranking.js` **reads the stamped field; it never re-derives it.**
  The check is a precondition on the *venue*, evaluated once before either bound:

  ```
  # STEP 0 -- a precondition on the venue, not a branch inside a bound.
  if venue.return_transport_status is absent
     or venue.return_transport_status.state != "ok":
         the venue is NOT RANKED -- per-venue validation failure, reason surfaced
  ```

  **Absent counts as invalid.** A record with no stamp means the mandatory stage did not run, so the
  data is unvalidated and must not be ranked. This is the one place the return design fails *closed*,
  and the distinction is deliberate: missing *service information* fails open to `unverified`, while
  missing *validation* fails closed, exactly as a missing in-window hours entry is malformed data
  rather than a fallback to the regular schedule.

Every branch of "Evaluating one bound" therefore runs on a venue already known to be structurally
valid, and the early returns stay lookup-free — the two properties the design needs at once.

#### One failure model: per-venue, never global

A malformed band is a **per-venue** fact and is handled exactly like every other per-venue failure in
this project. Stating it once, unambiguously, because two readings were possible and they are
mutually exclusive:

| | |
| --- | --- |
| **Stage outcome** | Always success. An `invalid` status is a *result*, not an error — the stage cannot fail as a whole |
| **The write** | Always proceeds. Statuses are written atomically with the rest of `venues.json`; malformed metadata never withholds a generation |
| **Scope of the damage** | One venue. Every other venue generates, ranks and displays normally |
| **What ranking does** | Drops that venue at `STEP 0` |
| **What the user sees** | A **loud, visible diagnostic** — see below. Never a silent disappearance |

The alternative — abort generation and retain the previous page — was considered and rejected. It
would make the `invalid` stamp unreachable, contradicting the schema and the ranking contract that
depend on it; it would let one typo in one venue's metadata withhold an entire refresh; and it has no
counterpart anywhere else in this pipeline, where a per-source failure degrades one field and a
`businessStatus` change flags one venue.

**The diagnostic is required, not optional.** A venue removed at `STEP 0` must be surfaced with the
same prominence as a `stale` source or a non-`OPERATIONAL` venue:

- Every venue dropped at `STEP 0` is listed, by name, with its `reason` string — or with "return
  transport data was never validated" when the stamp is **absent** rather than `invalid`.
- The listing appears **in the page itself**, not only in a console message or the refresh log,
  because the deployed artifact is what the user actually reads.
- It is a **removal notice**, distinct from the `unverified` group: `unverified` means "we could not
  establish a way home"; this means "this venue's return data is broken and needs fixing". The fixes
  are different, so the wording must be too.

"Degradation must be visible" already governs the per-source freshness fields. This is the same rule
applied to the one removal path this design adds, and it is what stops a missing validation stage
from silently emptying the board.

**A `MISSING` holiday is not a bug.** `holiday_return_policy: unknown` is the default and it is a
positive assertion of ignorance about that date, exactly as the out-of-window holiday rule is for
hours. It yields `unverified`, and that is the intended answer until someone records the pattern.

### The core service span waives the timetable lookup, never the route

Most sessions end in the middle of the day and raise no transport question at all. Requiring
per-venue return data for a session ending at 15:00 would make the whole feature unadoptable — 28
venues of data to answer a question nobody asked.

```
RETURN_CORE_FROM_MINUTES  = 420    # 07:00
RETURN_CORE_UNTIL_MINUTES = 1290   # 21:30
```

**What the span does and does not license, stated precisely, because the difference is the whole
safety property:**

| The span answers | The span does not answer |
| --- | --- |
| *When* scheduled service runs on the network | *Whether a route home is recorded for this venue* |
| So the per-venue **timetable lookup** may be waived | So the per-venue **route** may never be assumed |

A session end inside the span therefore passes **only when an admissible return mode already exists**
in `access[return_destination]` for this venue. With no recorded route the answer is `unverified` at
every hour of the day — a clock cannot supply a route it has never been told about. This is why
"Evaluating one bound" derives the admissible set **before** consulting the span at all.

**The recorded route is `access`, not `return_transport`.** Inside the span, **no `return_transport`
entry is required and none is read** — that is precisely what "waives the timetable lookup" means,
and it is why a daytime session needs no per-venue return data at all. The two files answer the two
halves of the question and must not be confused:

| File | Answers | Required inside the span? |
| --- | --- | --- |
| `access[origin_a]` | Is there a route home from this venue at all? | **Yes** — unconditionally, at every hour |
| `return_transport` | When does the last service on that route leave? | **No** — the span answers it |

An earlier draft required a `PRESENT` `return_transport` entry before the in-span pass. That
contradicted this section, Phase 1's acceptance criteria and the test obligations all at once, and it
quietly reinstated the 28 venues of timetable maintenance the span was introduced to avoid.

#### The claim, its basis, its scope, and its maintenance

**Claim.** On an ordinary day, scheduled public transport across the Singapore network is running
between 07:00 and 21:30 local time.

| | |
| --- | --- |
| **Sources** | [LTA rail network](https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/rail_network.html) and [LTA service announcements](https://www.lta.gov.sg/content/ltagov/en/map/announcement.html) |
| **Checked** | 2026-08-30, by the `ARCH-001` round-1 reviewer (`codex_sol`), against the two pages above. Not independently re-checked by the primary; recorded here as the review's finding, not as the primary's own measurement. |
| **What they support** | A broad network-level norm of roughly 05:30 to around midnight, with an explicit instruction to check operator changes. 07:00 and 21:30 sit well inside that norm at both edges. |
| **Scope** | Network-level and ordinary-day only. **Not** proof of a route between any particular venue and any particular origin, and **not** proof against a temporary altered operating hour or a substitute shuttle, both of which LTA publishes and this design does not model. |
| **Maintenance** | Re-check annually and after any known network-wide service change. **If the norm is ever found not to hold, the shortcut is withdrawn** — every out-of-core session then needs per-venue data, and this section says so rather than leaving a stale constant in place. |

This is deliberately **a maintained assumption, not a frozen invariant.** It is the only place the
design assumes anything about service existing at all, it is stated where a reviewer can attack it,
and it is bounded on the other side by the route prerequisite above — so even at its most generous
it can never manufacture a way home out of nothing.

Outside the span, per-venue data is required, and its absence is `unverified`.

### Evaluating one bound

**Precondition, checked once per venue before either bound:** `return_transport_status.state == "ok"`.
A venue whose stamp is missing or `invalid` is unranked and never reaches this function at all — see
"Whole-file validation is a mandatory stage, not a test obligation". Nothing below re-derives it,
which is what lets steps 3 and 4 return without reading `return_transport` while the "malformed means
unranked" contract still holds.

For each bound `b` in `{mid, upper}` — resolved independently, all the way through, as everywhere
else in this model:

```
session_end_b  = arrival_b + duration                  # the instant you stand up
clock_b        = session_end_b - abs(date(session_end_b), 0)      # local clock offset
service_date_b = date(session_end_b - RETURN_SERVICE_DAY_START_MINUTES)

# 1. THE ROUTE PREREQUISITE, FIRST AND UNCONDITIONALLY.
#    Nothing below may run without a recorded, currently-admissible way home.
#    No clock, no span, no default can supply a route that was never recorded.
modes = admissible_return_modes(venue, bicycle_with_you, raining,
                                session_end_b, service_date_b)
if modes is empty:
    return UNVERIFIED(basis: "no_recorded_route")

# 2. A schedule-free admissible mode is positive evidence and settles it.
#    Strongest available answer: no timetable is involved at all.
if any m in modes is schedule-free:
    return PASS(basis: "schedule_free", mode: m, margin: AT_LEAST(0))

#    EVERYTHING BELOW THIS LINE RUNS ON A SCHEDULE-BOUND-ONLY MODE SET.
#    That is what scopes step 4: a schedule-free mode has no first service to
#    wait for, so the pre-dawn gap is not its problem and never was.

# 3. Inside the core service span the TIMETABLE is waived. Step 1 has already
#    established a recorded route; the span supplies WHEN service runs, never
#    WHETHER a route exists. NO return_transport lookup happens here -- that is
#    the entire point of the span, and the reason it does not reinstate 28
#    venues of timetable maintenance for a session that ends at 15:00.
if RETURN_CORE_FROM_MINUTES <= clock_b <= RETURN_CORE_UNTIL_MINUTES:
    return PASS(basis: "core_span", margin: AT_LEAST(0))

# 4. The pre-dawn gap, on a schedule-bound-only set: last night's service has
#    finished and this morning's has not started. No last departure can answer
#    that, so nothing is looked up -- see "The pre-dawn gap is not modelled".
if RETURN_SERVICE_DAY_START_MINUTES <= clock_b < RETURN_CORE_FROM_MINUTES:
    return UNVERIFIED(basis: "pre_dawn_gap")

# 5. Only now is return_transport read at all.
resolved = [ (m, resolve_return_service(venue, return_destination, m, service_date_b))
             for m in modes ]                  # every m here is schedule-bound

if any result is MALFORMED:
    return VALIDATION_FAILURE(reason)          # per-venue; the venue is not ranked

present = [ entry for (m, r) in resolved if r is PRESENT(entry) ]
if present is empty:
    return UNVERIFIED(basis: "no_data")

# 6. Compare against the latest last departure available to you.
last_departure_b = MAX over present of edge(last_departure_band, b)   # b=upper -> EARLIER edge
return MARGIN(last_departure_b - session_end_b, basis: "last_departure")
```

**Step 1 is the safety property of this whole section**, and its position is load-bearing. An earlier
draft put the core-span shortcut first, which let a venue with no `access[origin_a]` entry at all —
or only `null` ones, or none currently admissible — pass as `robust` between 07:00 and 21:30 on the
strength of a city-wide clock. All 28 current records happen to carry a non-null `origin_a.transit`
entry, so the defect was invisible in the data and live in the contract; the schema permits the
absent case and Plan B evaluates each fallback independently.

**Only step 5 touches `return_transport`.** Steps 3 and 4 both return before any lookup, which is
what makes "the span waives the timetable lookup" literally true rather than merely intended. An
earlier draft resolved and validated every entry *before* the span check and then required a
`PRESENT` entry to pass — which reinstated the whole maintenance burden the span exists to avoid,
while still calling it waived.

**A malformed band is caught before any of this runs**, by the mandatory
`validate_return_transport` stage — see "Whole-file validation is a mandatory stage, not a test
obligation". That is what lets steps 3 and 4 return without reading anything while the
"malformed means unranked" contract still holds: the venue was already marked invalid and never
reached step 1. `MALFORMED` at step 5 stays as a redundant runtime guard and should be unreachable
whenever the stage has run.

`MAX` in step 6 is correct and is not the same shape as the hours model's minimum tie-break: several
modes may be admissible, you would take whichever runs latest, and they are independent facts rather
than the decomposed encodings of one fact.

#### The pre-dawn gap is not modelled

Step 4 is deliberately terminal. An earlier draft carried an optional `first_departure_band` and
returned `MARGIN(session_end_b - first_departure_b)` here. **That was a type error dressed as a
feature**, and it is removed rather than patched:

- **The monotonicity is reversed.** Against a last departure, ending the session *earlier* creates
  margin — which is exactly what `shorter` means and what makes "leave earlier" actionable. Against a
  first departure, ending earlier makes it *worse*. Feeding both into one `return_margin_*`, one
  `binding_limit`, and one `shorter` tier would have labelled "you finish 65 minutes before anything
  runs" as a session you could fix by cutting it short.
- **The binding limit has no row for it.** `min(effective_close − closing_buffer, last_departure)` is
  an upper bound on when you must leave. A first departure is a *lower* bound on when you may leave.
  They do not compose, and no row of the binding-limit table was ever written for one.
- **One first departure is not a service interval.** Knowing the first bus leaves at 06:05 does not
  establish that service runs continuously from 06:05 to 07:00; the design records no headway or
  continuity rule, and inventing one would be the guess this whole feature exists to avoid.

So a session ending between 04:00 and 07:00 is `unverified` **whenever the way home depends on a
timetable at all**. The scope matters and is not a hedge:

| Admissible return set | Session ends 05:00 | Why |
| --- | --- | --- |
| Contains a schedule-free mode (`walk`, or `cycle` with the bicycle) | `robust`, basis `schedule_free` | A walk has no first service to wait for. The pre-dawn gap is a **timetable** phenomenon, and a schedule-free mode is not subject to one — that is what "schedule-free" means |
| Schedule-bound only (`transit`) | `unverified`, basis `pre_dawn_gap` | No recorded last departure can speak for an instant before service resumes |

The branch order in "Evaluating one bound" is what enforces this: the schedule-free check returns at
step 2, so step 4 is only ever reached with a schedule-bound-only set. **Suppressing schedule-free
evidence pre-dawn would be a policy change — that you may not walk home at 05:00 — and it is not
adopted here.** It is not a change that could be made silently by branch ordering, which is why the
scope is written into the contract rather than left to the reader.

That is honest, it is safe, and it costs almost nothing: the remaining case needs an overnight
session at one of the three 24-hour venues with no walkable or cyclable way home.
Closing it properly means modelling the **wait** as its own outcome — neither `shorter` nor a binding
limit — with a recorded service-interval claim behind it. That is a separate assignment, and this
section is the record of why it cannot be folded into this one.

### The return tier

`return_margin_*` reuses the existing `surplus_*` sum type unchanged — a finite integer margin, or
`AT_LEAST(0)` — and therefore reuses `passes_feasibility()`, `finite_shortfall()` and `sort_key()`
without modification. Only `display()` needs a return-specific sibling, because the wording differs
("last train 23:35 — 40m spare", "no last-service constraint (cycle home)").

```
return_tier =
  invalid    : either bound returned VALIDATION_FAILURE   -- checked FIRST
  unverified : either bound returned UNVERIFIED
  robust     : passes_feasibility(return_margin_upper)
  tight      : not robust
               AND ( passes_feasibility(return_margin_mid)
                     OR finite_shortfall(return_margin_mid) <= RETURN_TOLERANCE_MINUTES )
  shorter    : otherwise
```

`invalid` is **not a tier value and never reaches `overall_tier`.** It takes the existing per-venue
validation-failure path — flag loudly, do not rank — exactly as a contradictory `period_end_abs` pair
does on the hours side. It is checked first so a malformed record can never be laundered into
`unverified` and quietly ranked last instead of being fixed.

**The contract is enforced by `validate_return_transport`'s STEP 0 precondition, not by this tier
value.** A venue whose stamp is missing or `invalid` never reaches a bound at all, so it never
reaches this table either; `invalid` here is the redundant guard for a record that somehow slipped
past the stage. Placing the enforcement in the tier alone would have left it unreachable on exactly
the branches that skip the resolver.

Deliberately the same four-position shape as the hours tier, with **one asymmetry that must not be
lost**: the hours model's `UNKNOWN` removes a venue from ranking entirely, because feasibility is
then undecidable. `unverified` does **not** remove a venue. It is a *tier value*, ranked last, and it
is named `unverified` rather than `unknown` solely so the two can never be confused in code, in
prose, or in the UI. What it shares with `UNKNOWN` is the part that matters: **it never resolves to
`robust`, and missing data never reads as "service exists."**

`unverified` if **either** bound is unresolved, including the common boundary case where
`session_end_mid` lands inside the core span and `session_end_upper` lands outside it. That is the
honest reading — the optimistic journey is fine and the pessimistic one is unchecked — and it is what
will prompt the data to be filled in around 21:30, where it actually matters.

### Composing with the existing feasibility tiers

The two axes stay **separate fields** and are combined into **one ordering key**:

```
overall_tier = worse_of(hours_tier, return_tier)
               robust > tight > shorter > unverified
```

`hours_tier` never takes `unverified`, and `return_tier` never takes `hours-unknown`. Two outcomes are
already gone before this composition is reached and are **not** positions in the ordering: a venue
whose hours are `UNKNOWN`, and a venue whose return data is `MALFORMED` — both are unranked, by
different paths, for different reasons.

The ordering places a **known** partial session above an **unverified** way home: "gives 4h of the 6h
you asked for, and you can get home" beats "gives the full 6h, and nobody has checked whether you can
get home." That is the project's standing bias against the wasted trip, applied to the return leg.

**The metrics compose through a single binding limit**, computed per bound and only when
`return_tier` is not `unverified`:

Informally:

```
binding_limit_b ~= min( effective_close_b - closing_buffer,  last_departure_b )
```

That line is a summary, **not the contract** — both operands can hold tags, so it is not something
any code may execute. The table below is the contract: branch on the tags first, exactly as
everywhere else in this model, and only then is there a number to take a minimum of.

| `effective_close_b` | Return side | `binding_limit_b` | `binding_constraint` | `latest_leave_at` |
| --- | --- | --- | --- | --- |
| finite `C` | finite last departure | `min(C - closing_buffer, last_departure_b)` | whichever won | finite |
| finite `C` | `AT_LEAST(0)` (core span / schedule-free) | `C - closing_buffer` | `venue_close` | finite |
| `COVERED` | finite last departure | `last_departure_b` | `last_departure` | **finite** |
| `COVERED` | `AT_LEAST(0)` | none — `surplus_b = AT_LEAST(0)` | `none` | `UNDETERMINED` |
| `NONE` | any | metrics undefined, as today | — | undefined |
| `UNKNOWN` | any | venue unranked, as today | — | undefined |

**All three metrics read `binding_limit_*`, never a raw `effective_close_*`.** The table above is
where the tags are branched; everything below it operates on the finite value that branching
produced, or on the explicit "none" row. Subtracting `closing_buffer` from `effective_close_mid`
again down here would be the exact type error the tag discipline exists to prevent.

```
# Only reached on the first four rows of the table; the NONE and UNKNOWN rows
# never get here.

binding_limit_b is finite:
    usable_minutes  = max(0, min(binding_limit_mid, arrival_mid + duration) - arrival_mid)
    surplus_b       = binding_limit_b - (arrival_b + duration)
    latest_leave_at = binding_limit_mid - duration - travel_minutes_mid

binding_limit_b is the "none" row (COVERED hours AND an AT_LEAST(0) return):
    usable_minutes  = duration
    surplus_b       = AT_LEAST(0)
    latest_leave_at = UNDETERMINED
```

Two consequences worth stating plainly:

- **A `COVERED` venue can now have a real `latest_leave_at`.** `UNDETERMINED` means "no known
  *closing* constraint within the verified span"; a known last departure is a different constraint
  and does determine a latest departure. That is not a numeric `min` against `UNDETERMINED` — it is
  the third row of the table above, where a `COVERED` hours side contributes no candidate at all and
  `binding_limit_b` simply *is* the last departure. `UNDETERMINED` survives only on the fourth row,
  where neither side bounds the session. A 24-hour venue is exactly where this matters most.
- **This finally makes the plan's second query answerable correctly.** "I want six hours today — when
  do I need to leave?" was previously answered against the venue's closing time alone, which is the
  wrong constraint on any evening where the last train binds first.

When `return_tier` is `unverified`, the metrics are computed from the hours side alone **and labelled
as such**. They are not wrong; they are incomplete, and the UI must not present them as a verified
session length.

### Where it enters the pipeline

`overall_tier` replaces `feasibility tier` as ranking key 3. Nothing else in the order moves:
being stranded is a feasibility failure, not a comfort one, and it belongs above seat confidence for
the same reason hours do.

**A venue whose `overall_tier` is `unverified` can never be Plan A.** This is the same rule that
already forbids promoting a `poor` or `unknown` `seat_confidence` into a confident-looking
recommendation, applied to the return leg. Where nothing has a verified way home, the tool says so in
its own words rather than borrowing the seat-confidence refusal:

> **No option with a verified way home for a session ending at 00:30.**

...shown with the candidates, their venue-side tiers, and exactly which return data is missing.

### Plan B

Plan B is evaluated with the **same machinery at the fallback venue**, using the fallback's own
`return_transport` block and its own `access[origin_a]` mode set — never Plan A's. Plan B's session
end is `plan_b_arrival_* + duration`, so its later arrival pushes it later into the evening, which is
precisely when the return constraint starts to bind. A rescue option that strands you is not a rescue.

`backup_strength` is amended in two places, both following from the grading rule already stated —
*whether the requested session survives*:

- **`strong` additionally requires the fallback's `return_tier` to be `robust` or `tight`.** An
  `unverified` return **caps `backup_strength` at `salvage`**, and the salvage label states why.
- **`salvage`'s stated duration is the return-capped `usable_minutes`**, never the hours-capped one.
  "Gives 1h40m, not the 6h you asked for" is a lie if the last train leaves in forty minutes. The
  existing requirement that a `salvage` option state its actual duration is what forces this.

### Data contract

A new hand-maintained block in `data/venues_meta.json`, alongside `access` and subject to every rule
that governs that file — never written by a script, merged at generation time, bands rather than
exact values.

```json
"return_transport": {
  "origin_a": {
    "transit": {
      "default":    {"last_departure_band": "23:20-23:25"},
      "by_weekday": {"fri": {"last_departure_band": "23:50-23:55"},
                     "sat": {"last_departure_band": "23:50-23:55"},
                     "sun": {"last_departure_band": "23:05-23:10"}},
      "basis": "last train from the venue's own station, plus the walk to the platform; rechecked 2026-08"
    }
  }
},
"holiday_return_policy": "unknown"
```

| Field | Meaning |
| --- | --- |
| `last_departure_band` | The latest departure **from the venue** that still gets you home, as a five-minute clock band. Includes the walk to the stop — the number is about leaving your table, not about being on the platform. |
| *(no first-departure field)* | Deliberately absent. A lower-bound constraint cannot share this type, and a schedule-bound way home in the pre-dawn window is `unverified` instead — see "The pre-dawn gap is not modelled". |
| `by_weekday` | Optional per-weekday overrides, keyed by the existing `WEEKDAYS` abbreviations and by the weekday of the **service date**, not of the session end. Absent keys fall back to `default`. Precedence is fixed by `resolve_return_service`: holiday policy → `by_weekday` → `default` → `MISSING`. |
| `basis` | Free text naming *what kind of source* the band came from and when it was last checked, so a maintainer can re-derive it. Not consumed by any code. **Subject to the same privacy rule as every other field in this file: no exact times, no line or direction names, no route toward an origin.** A free-text field is not a privacy exemption — it is the easiest place to leak, precisely because nothing validates it. |
| `holiday_return_policy` | `unknown` (default) or `substitute_sun`. Venue-level, exactly like `holiday_policy`. |

**`holiday_return_policy` is a separate field from `holiday_policy` on purpose.** `holiday_policy`
governs which *busyness* curve substitutes on a holiday. Reusing it for transport would make one
field mean two things — the precise mistake `preference` and `baseline_seatability` were split to
avoid. On a date in `holidays.json`, the default `unknown` yields `unverified`, which is the honest
answer: holiday service patterns are a real thing and nobody has checked them.

**Offsets, not clock strings, once parsed.** The band is stored in clock form because that is what a
timetable shows and what a human maintains. It is converted to minutes-from-service-day-midnight at
load by the rule in "From clock string to service-day offset" — a clock time before
`RETURN_SERVICE_DAY_START_MINUTES` gains 1440, so `00:30` is `1470` — and every comparison thereafter
is in absolute minutes, the same storage-versus-arithmetic split the periods array already uses.

**The privacy rule binds `basis` as hard as it binds the bands.** "Last train Beauty World toward
X at 23:31" in a free-text note publishes exactly what the five-minute band was chosen to withhold,
and it publishes the *direction*, which the band does not. Record the kind of source and the date it
was checked; never the timetable entry itself.

**Bands, not exact times — and the same privacy trade already accepted.** A last departure toward
home is weaker information than a travel duration to home: it is dominated by the *venue* end for
most venues, and the repo already publishes venue coordinates and `access` bands to `origin_a`, which
is the far stronger trilateration signal. What it does add is a hint about the home end, since the
binding constraint on a long journey is often the last connection there. Coarsened to a five-minute
band and accepted deliberately, on the same reasoning recorded for `access`.

### New constants

| Constant | Value | Status |
| --- | --- | --- |
| `RETURN_CORE_FROM_MINUTES` | 420 (07:00) | **Maintained assumption**, not provisional and not frozen — source, checked date, scope and re-check rule recorded in "The core service span waives the timetable lookup, never the route". Waives the timetable lookup only; never the route |
| `RETURN_CORE_UNTIL_MINUTES` | 1290 (21:30) | Same |
| `RETURN_SERVICE_DAY_START_MINUTES` | 240 (04:00) | Structural, not a judgement — it names which night a departure belongs to |
| `RETURN_TOLERANCE_MINUTES` | 10 | Provisional, and **separate from `FEASIBILITY_TOLERANCE_MINUTES`** |
| `RETURN_CYCLE_LATEST_MINUTES` | `null` | Provisional; `null` means no limit. A **clock-time offset** resolved against the service date (`> 1440` after midnight), never compared raw against an absolute minute. **Needs a real-world answer** — see Open questions |

`RETURN_TOLERANCE_MINUTES` is deliberately not `FEASIBILITY_TOLERANCE_MINUTES`. Fifteen minutes short
of a closing time costs fifteen minutes of study; fifteen minutes short of a last train costs a taxi
or a night out. The band exists to flag *"your margin is inside the measurement noise"* — five-minute
bands carry ±2.5 at each end — not to excuse a real miss, so it is tighter and it warns rather than
reassures.

### What this design deliberately does not do

- **It does not model the outbound mirror.** Whether transport still runs *to* the venue at the
  departure time is the same question from the other side, and the same data shape would serve it.
  It is out of scope here and is flagged as a separate assignment rather than folded in.
- **It does not model the pre-dawn gap for a schedule-bound way home.** A session ending between
  04:00 and 07:00 on a schedule-bound-only mode set is `unverified` — see "The pre-dawn gap is not
  modelled". A schedule-free mode still settles it, at step 2, because it has no first service to
  wait for. An earlier draft carried an optional `first_departure_band`; it is removed, because a
  lower-bound constraint cannot share the last-departure type, the binding limit, or the `shorter`
  tier.
- **It does not model service continuity or headway.** Every claim is about a single instant — the
  session end — against a single recorded last departure.
- **It does not model weather after departure**, connection reliability, taxi or ride-hail
  availability, or walking home as a last resort from an unrecorded route.
- **It does not add a fetcher.** No live transit source, now or later, per the non-goals.

---

## The ranking pipeline

1. **Hard filter — reachability.** A **missing** `access` entry for the selected origin/mode means the mode isn't viable there. Excluded.
2. **Openness at that venue's own arrival**, resolved per bound against its active period. **Not a filter.** A bound with no active period yields the bound outcome `NONE`, which shapes the tier and never removes the venue; only `UNKNOWN` hours do that. The exact per-bound treatments are in "One entry point, pure, whole-dataset".
3. **Feasibility tier** — `overall_tier`, the worse of the hours tier and the return tier: `robust` before `tight`, then `shorter`, then `unverified`. `shorter` and `unverified` move to their own groups.
4. **`seat_confidence` tier**, best first.
5. **`backup_strength`**, `strong` → `salvage` → `none`.
6. **Travel burden** (`travel_minutes_mid`), least first.
7. **`preference`**, best first.
8. **`surplus_mid`**, most first — final tiebreak only.

Feasibility comes first because a venue that can't hold the session isn't a candidate at any confidence — and "can't hold the session" now includes "can't get you home afterwards", which is why `overall_tier` and not the hours tier alone is the key. Seat confidence is next because it is the objective. Backup strength ranks above travel because the whole point is minimising the cost of being wrong.

A **thin-margin warning** appears on any `tight` venue, naming which constraint is thin — the venue's closing time or the last departure home.

**A venue whose `overall_tier` is `unverified` is ranked, but can never be Plan A.** See "Getting home: session-end return transport" — this is the same rule that forbids promoting a `poor` or `unknown` `seat_confidence` into a confident-looking recommendation.

### Venues that cannot be ranked

An `access` entry of explicit `null` means *not yet measured*. Without travel time there is no `venue_arrival`, so nothing downstream is computable. These sit in a **separate "travel time unknown" group**, never interleaved.

### Missing busyness never removes a venue

If the histogram is missing or below `MIN_HISTOGRAM_HOURS`, `relative_busyness` is `unknown`, and `seat_confidence` falls back to `baseline_seatability` alone with a **visible lower-evidence warning**.

**It is not treated as `typical`.** Absence of evidence is recorded as absence, not as an average.

### The tool is allowed to say no

When no venue reaches at least `mixed` confidence, the correct output is:

> **No low-risk option found for the requested session.**

...shown with the reasons and the best of a bad set, rather than promoting something weak into Plan A. A confident-looking recommendation built on nothing is worse than an honest refusal.

There is a **second refusal**, for the return leg, and it must not borrow the first one's wording — the two say different things and have different fixes:

> **No option with a verified way home for a session ending at 00:30.**

...shown with the candidates, their venue-side tiers, and exactly which `return_transport` entries are missing. The first refusal means "nowhere is likely to seat you"; the second means "nobody has recorded whether you can get back", and the fix for it is filling in data rather than choosing a different day.

### One entry point, pure, whole-dataset

Everything above is reached through **one pure function in `ranking.js`**, taking the whole embedded snapshot plus the control state and returning a presentation-ready result. It touches no DOM, performs no I/O, and `app.js` calls it exactly once per render.

It owns, in order:

1. **Control resolution** — selected origin, travel mode and the rain toggle, including `wet_weather_mode` substitution and the removal of `cycle` from the return mode set.
2. **Snapshot validation** — the whole-dataset checks that cannot be made one venue at a time, chiefly the `preference` strict total order below. It runs before any ordering key reads a value it validates.
3. **Travel-band parsing and per-venue arrivals** — `access[origin][mode].band` through the band parser, giving `travel_minutes_mid` / `_upper` and each venue's own `arrival_mid` / `arrival_upper`.
4. **Return-status `STEP 0` removal**, with a diagnostic recorded per removed venue.
5. **Evaluation** — hours resolution, return resolution, combined feasibility through the binding limit, the busyness band, `seat_confidence`.
6. **Plan B evaluation for every candidate Plan A**, before `backup_strength` affects Plan A's ranking.
7. **Grouping, refusals and final ordering** — the taxonomy below.

**Plan B is evaluated before Plan A is ranked.** `backup_strength` is ranking key 5, so an ordering computed before the fallbacks are evaluated would be ordering on a value it does not yet hold. That sequencing constraint is the main reason this is one function: split across `app.js` it becomes something a renderer can get wrong.

**The ranked and unranked taxonomy**, stated exhaustively because several rows were previously implicit:

| Condition | Treatment |
| --- | --- |
| `overall_tier` `robust` or `tight` | **Ranked**, main group |
| `overall_tier` `shorter` | **Ranked**, its own group |
| `overall_tier` `unverified` | **Ranked**, its own group; **barred from Plan A** |
| `access[origin][mode]` explicit `null` | **Unranked** — the "travel time unknown" group |
| `access[origin][mode]` **missing entirely** | **Hard-filtered.** Not a candidate at all — *not* the travel-unknown group |
| `return_transport_status` absent or not `ok` | **Unranked removal**, with a visible diagnostic naming the venue and its reason |
| Hours `UNKNOWN` | **Unranked** — hours-unknown, distinct from closed |
| Contradictory hours — overlapping `known` periods, or matching periods disagreeing on `period_end_abs` | **Unranked** — per-venue validation failure |
| Upper bound has **no active period** — bound outcome `NONE` | **Ranked.** Fails `robust`; the midpoint is still evaluated and may be `tight` |
| Midpoint bound has **no active period** — bound outcome `NONE` | **Ranked.** Cannot be `tight`; falls to `shorter`, in the `shorter` group |
| **Neither** bound has an active period | **Ranked** as `shorter`, by the midpoint row above — `NONE` never unranks on its own |
| `preference` missing or malformed | **Unranked removal** — that venue only |
| `preference` duplicated across venues | **Unranked removal** — every venue carrying the duplicated value |
| `business_status` not `OPERATIONAL` | **Unranked removal**, in its own notice naming the venue and its `business_status`; never Plan A or Plan B |

**`NONE` is a bound outcome produced by the caller, never a value `effective_close` returns.** `effective_close` returns exactly a finite close, `COVERED`, or `UNKNOWN`, and is **not invoked at all** when that bound has no active period — the caller yields `NONE` instead ("Deriving the active period"; `CLAUDE.md`'s `NONE`-versus-`UNKNOWN` rule). The three rows above are therefore stated at the **bound level**, never as an `effective_close_*` value. An earlier draft wrote them as `effective_close_* is NONE`, which names a state that function's contract excludes — precisely the tag-discipline error the surrounding model exists to prevent.

**`NONE` never removes a venue, at either bound.** These rows restate the established contract, which `tests/js/ranking.test.js` already exercises; this taxonomy must not contradict it. **Ranking key 2 has been restated as a per-bound tier input rather than a hard filter**, so the numbered list and this table now say the same thing: under two independently resolved bounds, "not open at that arrival" is a tier outcome, never an exclusion. Two earlier drafts got this wrong in different ways — the first said "hard-filtered on the closed-on-arrival rule" and "`NONE` alone never unranks" in one cell; the second corrected the table but left key 2 still calling it a hard filter, reconciling them only in prose. Only `UNKNOWN` unranks on the hours axis.

**A non-`OPERATIONAL` venue is removed, not merely annotated.** "Never silently ranked" left open whether such a venue still appears in the ranked list carrying a flag. It does not. `CLOSED_TEMPORARILY` and `CLOSED_PERMANENTLY` both mean the trip should not be made, so the venue leaves the ranked set and appears in its **own** removal notice — separate from the broken-return-data notice and from the `unverified` group, because all three have different fixes.

**Every row of this table gets its own entry-point test.** "Exhaustive" is a claim about behaviour, not about prose, and it is checkable only if each row has a case asserting which group the venue lands in — including the rows whose answer is "ranked".

Explicit `null` and a missing key are **different facts**. `null` says "not measured yet", which is a gap worth surfacing so it can be filled; a missing key says "this mode is not viable here", which is not a gap at all. Collapsing them would fill the travel-unknown group with venues nobody ever intended to reach that way, and the list would stop being actionable.

A removal for broken return data is a **removal notice**, worded differently from the `unverified` group: one says "this venue's return data is broken and needs fixing", the other says "we could not establish a way home". **Both refusal states are outputs of this function too** — "No low-risk option found for the requested session" when nothing reaches `mixed`, and "No option with a verified way home for a session ending at HH:MM" when nothing has a verified return. Separate messages, separate fixes, never substituted for one another.

Alternatives are grouped by `area`. The returned shape is presentation-ready: `app.js` renders it and re-derives none of it.

### Choosing among several fallbacks

A venue may carry more than one `fallbacks[]` link. Exactly one is chosen, by this total order:

| # | Key | Direction |
| --- | --- | --- |
| 1 | `backup_strength` | `strong` → `salvage` → `none` |
| 2 | `overall_tier` | `robust` → `tight` → `shorter` → `unverified` |
| 3 | `seat_confidence` | best first |
| 4 | Fallback travel burden **from Plan A** | least first |
| 5 | `preference` | best first — **only once preference has passed validation** |
| 6 | `surplus_mid` | through `surplusSortKey()` **only** |
| 7 | `venue_id` | ascending — a final stable guard |

Three constraints on this that are not negotiable:

- **`surplus_mid` is never compared directly.** It is a sum type that can hold `AT_LEAST(0)`; `surplusSortKey()` is the one accessor licensed to order it, yielding `0` for the tag so an unproven margin never out-ranks a verified one. `display()` is never used for ordering, and `sort_key()` is never used for display.
- **`preference` is validated as a whole-dataset invariant before it is used as a key, and `venue_id` is not its fallback.** `preference` is a strict total order over the merged venue set with no ties, so duplicate detection is inherently **cross-record** and cannot live in a per-venue check. Snapshot validation — responsibility 2 above — resolves it, with a determinate failure scope:

  | Defect | Fails |
  | --- | --- |
  | `preference` missing, non-integer, or otherwise malformed | **That venue only** — a per-venue fact |
  | One `preference` value shared by two or more venues | **Every venue carrying that value** — the order between them is genuinely undetermined and there is no basis for keeping one |

  Everything else generates and ranks normally: this stays the project's per-venue failure model, not a global abort. Failed venues take the **unranked removal** path with their own reason string, exactly as a broken `return_transport_status` does.

  **The consequence is that keys 6 and 7 are unreachable between two distinct ranked venues.** Once validation has passed, every surviving venue holds a unique `preference`, so key 5 always decides. Keys 6 and 7 keep the order total and deterministic in the degenerate case — a candidate compared with itself — and are never a live tiebreaker that a malformed or duplicated `preference` could fall through to.
- **Each fallback is evaluated exactly once**, through `evaluatePlanBFallback()`. `resolveBackupStrength()` is **not** called again on the winner, there is **no Plan C**, and a `none`-strength fallback is **never presented as Plan B** — the UI says there is no viable fallback, which is the honest answer and the one the `salvage` floor exists to produce.

---

## Plan A and Plan B

The primary result is a **plan**: Plan A, Plan B, and "more alternatives" behind an expander.

### Plan B is recalculated, not just second place

By the time I need it I am standing inside Plan A, later than planned, having already spent the trip.

**Plan B carries two bounds, not one**, because the uncertainty in the first leg does not disappear when you walk out of Plan A — it compounds into the second:

```
plan_b_departure_mid   = plan_a_arrival_mid   + SEAT_CHECK_BUFFER_MINUTES
plan_b_departure_upper = plan_a_arrival_upper + SEAT_CHECK_BUFFER_MINUTES

plan_b_arrival_mid     = plan_b_departure_mid   + fallback_travel_minutes_mid
plan_b_arrival_upper   = plan_b_departure_upper + fallback_travel_minutes_upper
```

`fallback_travel_minutes_mid` and `fallback_travel_minutes_upper` come from `fallbacks[].travel_band`, using the same midpoint-and-upper-edge derivation as `access[][].band`.

**The upper bound is the sum of two upper bounds.** If the first leg ran to the pessimistic end, you arrive at Plan A late, spend the seat-check buffer, and *then* travel the second leg — also possibly at its pessimistic end. Collapsing this to a single midpoint-derived arrival, as an earlier draft did, silently discarded the original trip's uncertainty exactly where it matters most: deciding whether the rescue option is itself robust.

`SEAT_CHECK_BUFFER_MINUTES` is a **provisional global, default 10** — entering, scanning for a seat, deciding to leave. It applies identically to both bounds; the time spent looking around doesn't depend on how the journey went.

Plan B is then re-evaluated from scratch using **exactly the same machinery as Plan A**:

- reachable from **Plan A**, using `fallbacks[].travel_band` for both of its travel bounds
- `active_period_mid` resolved at `plan_b_arrival_mid`, and `active_period_upper` resolved **independently** at `plan_b_arrival_upper` — each through the absolute-minutes lookup, on its own arrival date, since either can roll past midnight
- its own `robust` / `tight` / `shorter` tier, computed by the same rule (`robust` requires `active_period_upper` to exist **and** the session to fit before that period's buffer)
- `seat_confidence` at the **delayed** hour taken from `plan_b_arrival_mid`, which can cross a band boundary
- its own `return_tier`, from **its own** `return_transport` block and **its own** `access[origin_a]` mode set — never Plan A's, and evaluated at `plan_b_arrival_* + duration`, which is later into the evening and therefore exactly where the return constraint starts to bind
- **Plan A's `bicycle_with_you`, unchanged** — the bicycle is wherever you rode it, so a trip that started by transit has no `cycle` return at the fallback either. The same input also makes a `fallbacks[].mode == "cycle"` link **unviable** on such a trip, and Plan B must drop it exactly as it drops a fallback closed at the delayed arrival
- rain and `wet_weather_mode` effects on a leg that may differ from the origin leg — including the removal of `cycle` from the return set

Plan B is not a simplified calculation. Anything less and the fallback would be recommended on weaker evidence than the option it is meant to rescue.

### Plan B viability floor

Both thresholds are **provisional**:

- **`PLAN_B_MIN_SESSION_MINUTES = 90`** — below an hour and a half the trip isn't worth making.
- **`PLAN_B_MIN_CONFIDENCE = mixed`** — a `poor` or `unknown` fallback is not a plan.

These set the floor for `salvage`. Clearing the floor is **not** the same as satisfying the request: a fallback only reaches `strong` when the requested session actually fits **and its way home is verified**. An `unverified` return caps `backup_strength` at `salvage`, with the reason stated. If nothing clears the floor, `backup_strength` is `none` and the UI says so rather than inventing a fallback.

The minutes measured against `PLAN_B_MIN_SESSION_MINUTES` are **return-capped**, not hours-capped.

### Presentation

A `strong` Plan B — the requested session survives:

```
Plan A
Starbucks Holland Village
High seat confidence · full 6h session · 27m from origin
Baseline: dependable · Adjustment: typical for this venue
Home by transit — last departure ~23:35, 55m spare

If full: Plan B
Coffee Bean Holland Village
6-10m from Plan A · medium confidence · full 6h session
Baseline: usually available · Adjustment: busy for this venue
Home by transit — last departure ~23:30, 20m spare
```

A venue the return constraint shortens, with the binding constraint named:

```
Starbucks Somewhere
Full session doesn't fit — gives 4h20m of the 6h you asked for
Open until 02:00, but the last way home leaves 23:35
Leave the venue by 23:35 · leave home by 17:15 for the full 6h
```

An `unverified` way home — ranked, flagged, and never Plan A:

```
Starbucks Somewhere
Open until 02:00 · full 6h session on hours alone
No return-transport data for a session ending 00:30 — way home unverified
```

A `salvage` Plan B — labelled, with the real duration stated:

```
If full: Plan B (salvage only)
Coffee Bean Holland Village
6-10m from Plan A · medium confidence
Gives 1h40m, not the 6h you asked for — closes 9pm
```

---

## Frontend: plain HTML, no framework

**Vanilla HTML/CSS/JS. No React, no Vite, no npm.**

Rationale: at Phase 1 scope React and vanilla cost about the same to write; React's advantage shows up later and is worth maybe two hours. Against that, a dependency tree costs a few hours a year and greets me with build errors after any long gap.

The generation step is **not** a build system in this sense — a Python script inlining files into a template. No dependency resolution, no bundler, no transpilation.

### Primary view

**Controls:** date, leave-at time, session duration, origin, travel mode, raining toggle.

**Result:** Plan A and Plan B, then "More alternatives" expanding to the full ranked list grouped by area — each row showing `seat_confidence` with its two components, both feasibility tiers and the `overall_tier`, the **binding constraint** and the return mode being counted on, `usable_minutes`, `latest_leave_at`, travel, `backup_strength`, preference, and my own visit history (Phase 2). Tap a venue for its day curve with the session window shaded.

### Constraints — write vanilla in a React-shaped way

1. **One state object. Never read state back out of the DOM.**
2. **One `render(state)` function.**
3. **Pure data functions in `ranking.js`, importing nothing DOM-related** — ranking, time and date arithmetic, hours resolution, active-period lookup, the busyness band, the `seat_confidence` lookup, feasibility tiers, return-transport resolution and the return tier, the binding-limit composition, Plan B recalculation, backup strength, holiday policy, area grouping, the log→venue join. **The venues/meta merge is not among them** — it happens in Python at generation time; see "Data contracts".
4. **CSS in a stylesheet with plain class names.**
5. **`app.js` renders; it decides nothing.** It reads the shape the pipeline entry point returns and writes DOM. No business rule — no tier, no band, no ordering, no refusal condition, no merge — is reimplemented there. A rule in two places is a rule that will eventually disagree with itself, and only one of the two copies has tests.
6. **No `fetch()`, no `localStorage`, no backend, no credentials, no external JS and no external CSS.** The data, `ranking.js`, `app.js` and the styles are all inlined into the generated page; the optional manifest is the sole external reference. The fixed-form `import` removal described in "The module inlining contract" is what makes this hold, and it is preserved exactly as written there.

`ranking.js` stays a real file specifically so `node --test` can import it; the generator copies its contents into the artifact.

---

## Data contracts

**Generated files and hand-maintained files are separate.** `refresh.py` rewrites `venues.json` wholesale, so anything hand-typed there would be destroyed by a refresh.

**They are merged in Python, at generation time, by `id`.** `data/venues.json` stays generated-only and never carries a hand-maintained field. `build/refresh.py` merges each generated record with its `venues_meta.json` entry while generating `web/index.html`, and the page embeds **one flat merged venue list**. `ranking.js` receives that flat list and performs **no client-side meta merge** — the merge is not one of its responsibilities and its tests do not cover one.

**An ID mismatch between the two files is a generation contract failure**, not a runtime condition. A generated venue with no meta entry, or a meta entry with no generated venue, stops generation. `ranking.js` therefore never has to handle a half-merged venue, and there is no code path in which it could — which is what lets the merge live outside it at all.

**Where the merge's tests live.** The merge is exercised where it happens: **`tests/python/`**, against the generation step, including the ID-mismatch failure in both directions. Earlier wording listed "the venues/meta merge" among `ranking.js`'s pure functions and among the `tests/js/` obligations; that was stale and is corrected here. `closing_buffer_minutes` defaulting, per-venue `holiday_policy` / `holiday_return_policy` and `wet_weather_mode` substitution are **not** merge concerns — they read already-merged fields and stay in `tests/js/`.

### `data/venues.json` — generated, never hand-edited

```json
{
  "hours_timezone": "Asia/Singapore",
  "histogram_timezone": "Asia/Singapore",
  "venues": [
    {
      "id": "starbucks-beauty-world",
      "name": "Starbucks Beauty World Centre",
      "place_id": "ChIJ...",
      "lat": 1.3412,
      "lng": 103.7757,
      "business_status": "OPERATIONAL",
      "return_transport_status": {"state": "ok"},
      "hours": {
        "source": "places_api",
        "last_attempt_at": "2026-08-29T10:00:00+08:00",
        "last_success_at": "2026-08-29T10:00:00+08:00",
        "status": "ok",
        "current_hours_valid_from": "2026-08-29",
        "current_hours_valid_through": "2026-09-04",
        "regular_hours": {
          "mon": {"state": "known", "periods": [{"open": 450, "close": 1320}]},
          "tue": {"state": "known", "periods": [{"open": 450, "close": 1500}]},
          "wed": {"state": "closed", "periods": []},
          "thu": {"state": "unknown", "periods": []}
        },
        "current_hours_by_date": {
          "2026-08-29": {"state": "known", "periods": [{"open": 450, "close": 1320}]},
          "2026-08-30": {"state": "known", "periods": [{"open": 450, "close": 1320}]},
          "2026-08-31": {"state": "known", "periods": [{"open": 600, "close": 1080}]},
          "2026-09-01": {"state": "closed", "periods": []},
          "2026-09-02": {"state": "known", "periods": [{"open": 450, "close": 1320}]},
          "2026-09-03": {"state": "known", "periods": [{"open": 450, "close": 1320}]},
          "2026-09-04": {"state": "known", "periods": [
            {"open": 450, "close": 1440, "continues_beyond_window": true}]}
        }
      },
      "histogram": {
        "source": "serpapi",
        "last_attempt_at": "2026-08-29T10:00:00+08:00",
        "last_success_at": "2026-07-29T10:00:00+08:00",
        "status": "stale",
        "days": {
          "mon": [{"hour": 7, "busyness": 19}, {"hour": 8, "busyness": 34}],
          "tue": []
        }
      }
    }
  ]
}
```

**Hours state:** `known` (periods authoritative) · `closed` (confirmed, periods empty) · `unknown` (source silent, fetch failed, or beyond the current-hours window on a known holiday — **never treated as closed**).

`open`/`close` are **integer minutes from local midnight of the period's start date**. `close > 1440` means after-midnight (`{"open": 450, "close": 1500}` = 07:30 to 01:00 next day).

**`close` can legitimately reach `7 * 1440`.** A single Places period can span several calendar days — e.g. Sunday 07:30 through the following Saturday 17:30. The fetcher decomposes it at ingestion into one entry per calendar day it touches, each still expressed as minutes from *that entry's own* midnight: the anchor day keeps its real open time, every other touched day gets `open: 0`, and each carries a `close` equal to the true remaining distance to the actual close. Nothing caps it at 2880, and a large `close` is not evidence of a parse error. `resolve_hours` and its one-day lookback are unchanged by this, because every touched day's entry is self-contained.

**A 24-hour venue has no `close` at all** — `{"open": 0, "always_open": true}`. The period **records no known close**, which is a statement about that source period and not a promise about any other date. Once the walk has covered the required span without reaching a close, `effective_close` is **`COVERED`** — not a promise that the venue never closes. `closing_buffer` has nothing to apply against *within the verified span*, `surplus_*` is `AT_LEAST(0)` rather than a figure, and `latest_leave_at` is `UNDETERMINED`, meaning **no known closing constraint within the verified span** — never "there is no latest departure". The walk stopped at `required_end_abs` and deliberately looked no further, so nothing may claim what lies past it. `UNBOUNDED` remains a **period-level** value used only for containment, and never travels into a feasibility claim. An earlier draft wrote `{"open": 0, "close": 1440}`, which fabricated a midnight close and relegated genuinely 24-hour venues to the `shorter` group every evening. **The unbounded result is a property of the resolved period, not of the venue** — a current-hours closure or an `unknown` date still overrides the regular 24/7 schedule.

`current_hours_by_date` holds Google's date-specific `currentOpeningHours` as a **complete schedule** for every date in the window, not a sparse list of exceptions — which is why it is no longer called `date_overrides`. `continues_beyond_window: true` marks an endpoint that is a window artifact rather than a real closing event; see the truncation rule below.

**`truncated` endpoints are window edges, never events.** Google clips periods at the window boundary and flags the clipped endpoint. `open.truncated` is valid only at the window's first date, 00:00; `close.truncated` only at the final date's boundary. A truncated close reported as 23:59 normalises to the **exclusive next midnight** and carries `continues_beyond_window: true`. Interior or inconsistent truncation fails validation rather than being guessed through. This affects 7 of the 28 venues — including one with no unusual hours at all, since truncation is a property of the window, not of the venue.

**Timezones are recorded separately** for hours and histogram — different sources, may not agree. Phase 0 confirms each independently.

**Freshness is per source.** No top-level `generated_at`.

| `status` | Meaning |
| --- | --- |
| `ok` | this run fetched successfully; data is from `last_success_at` = `last_attempt_at` |
| `stale` | this run failed; showing **last-known-good** from an earlier `last_success_at` |
| `failed` | this run failed and there is **no** last-known-good to fall back on |

**The three statuses resolve from one rule, applied per source per venue.** A **first success** is `ok`, and that value becomes the first known-good. A **failure with no known-good yet** is `failed`, and carries **no data at all** — not an empty histogram, not a zeroed one, not a guessed schedule; a fabricated value here is indistinguishable from a real measurement everywhere downstream. A **later failure** is `stale`, retaining the known-good and its original `last_success_at`, which a failure never overwrites. `last_attempt_at` is stamped on every run whatever the outcome. The two sources resolve independently, so one venue can read `ok` on hours and `stale` on busyness in the same run.

`business_status` catches permanently-closed or relocated venues — surfaced loudly, never silently ranked.

**`return_transport_status` is stamped by the mandatory validation stage**, `{"state": "ok"}` or `{"state": "invalid", "reason": …}` — see "Whole-file validation is a mandatory stage, not a test obligation". It is the *only* thing `ranking.js` consults about return-data integrity; it never re-derives the check. **A venue whose stamp is absent or `invalid` is not ranked**, because an absent stamp means the stage did not run and the data is unvalidated. A venue with no `return_transport` block at all is `ok` — absence is `MISSING`, which yields `unverified` at evaluation time, not a validation failure.

### `data/venues_meta.json` — hand-maintained, never written by any script

```json
{
  "starbucks-beauty-world": {
    "brand": "starbucks",
    "venue_type": "mall_cafe",
    "area": "Beauty World",
    "baseline_seatability": "usually_available",
    "preference": 3,
    "closing_buffer_minutes": null,
    "holiday_policy": "unknown",
    "access": {
      "origin_a": {"cycle": {"rank": 2, "band": "15-20m"},
                   "transit": {"rank": 4, "band": "25-30m"}},
      "origin_b": {"transit": {"rank": 1, "band": "10-15m"},
                   "walk": null}
    },
    "wet_weather_mode": {"origin_a": {"cycle": "transit"}},
    "return_transport": {
      "origin_a": {
        "transit": {
          "default":    {"last_departure_band": "23:20-23:25"},
          "by_weekday": {"fri": {"last_departure_band": "23:50-23:55"},
                         "sat": {"last_departure_band": "23:50-23:55"}},
          "basis": "last train from the venue's own station, plus the walk to the platform; rechecked 2026-08"
        }
      }
    },
    "holiday_return_policy": "unknown",
    "fallbacks": [
      {"venue_id": "coffee-bean-beauty-world", "mode": "walk", "travel_band": "5-10m"}
    ],
    "attributes": {
      "seating": "communal tables + a few armchairs",
      "table_size": "large",
      "wifi": "good",
      "laptop_policy": "no restrictions seen"
    },
    "notes": ""
  }
}
```

- **`brand`**, **`venue_type`** and **`area`** live here, not in `venues.json`, because all three are hand-assigned and a refresh would clobber them. (The Places API returns no clean neighbourhood field, so `area` is a judgement call, not fetched data.) They are merged onto the venue object at generation time.
- **`baseline_seatability`** — start every venue at `unknown` and only promote from real experience. Guessing corrupts the one cross-venue seat signal that exists.
- **`preference`** — strict total order, no ties. **Study quality only.**
- **`closing_buffer_minutes`** — `null` means use `CLOSING_BUFFER_DEFAULT_MINUTES` (30), a named constant in `ranking.js`. The resolved value is what formulas refer to as `closing_buffer`.
- **`holiday_policy`** — `unknown` (default) or `substitute_sun`. See `holidays.json` below.
- **`access`** — ordinal rank plus a coarse band, never exact minutes. **Missing** mode key = not viable. Explicit **`null`** = not yet measured.
- **`wet_weather_mode`** — which mode replaces which when the rain toggle is on, per origin. Without this the toggle's effect is undefined; with it, disabling `cycle` for `origin_a` explicitly selects `transit`, and the resulting later arrival is a visible consequence rather than a silent reorder. A mode with no wet-weather substitute is simply unavailable in the rain.
- **`fallbacks`** — hand-picked links to plausible nearby venues only. Not a matrix; most venues will have zero, one or two.
- **`return_transport`** — the latest departure **from the venue** that still gets you home, per destination and per schedule-bound mode, as a five-minute clock band. Only `transit` needs an entry; `walk` and `cycle` are schedule-free and their viability is already carried by `access`. Optional `by_weekday` overrides, resolved by `resolve_return_service`. Absent means **`unverified`**, never "service exists"; malformed means a **per-venue validation failure**, not `unverified`. Full contract in "Getting home: session-end return transport".
- **`holiday_return_policy`** — `unknown` (default) or `substitute_sun`. **A separate field from `holiday_policy`**, which governs the busyness curve: one field meaning two things is the mistake `preference` and `baseline_seatability` were split to avoid.

**Privacy: bands, not exact minutes.** This file is committed to a public repo. Exact travel times from `home` and `work` to venues whose coordinates are published would trilaterate both origins. Rank plus a five-minute band gives the pipeline what it consumes — ordering, a midpoint, and an upper bound — while widening the inference considerably. Origins are `origin_a` / `origin_b`; the mapping is not committed. A reduction in precision, not a guarantee, accepted deliberately.

### `data/holidays.json` — hand-maintained

```json
{
  "2026-01-01": {"name": "New Year's Day"},
  "2026-02-17": {"name": "Chinese New Year"},
  "2026-08-09": {"name": "National Day"}
}
```

Dates only. **The busyness substitution rule is per venue**, in `venues_meta.json`'s `holiday_policy`:

- **`unknown`** (default) — on a holiday, `relative_busyness` is `unknown` and confidence falls back to baseline with the lower-evidence warning.
- **`substitute_sun`** — use that venue's Sunday curve, flagged in the UI.

A global Sunday substitution was the earlier rule. It is plausible for mall cafés and wrong for office cafés, kiosks and independents — and multi-brand scope makes a global rule weaker still. `unknown` is the honest default; substitution is an explicit per-venue claim.

Hours are handled separately, by the resolution order above. **Return transport is handled separately again**, by `holiday_return_policy` — see "Getting home: session-end return transport". Three different questions about the same date, three explicit answers.

**Maintenance, and what happens when it lapses.** The file is hand-maintained. `refresh.py` **never creates it and never modifies it** — the same rule as `venues_meta.json`. Generation **fails visibly** if it is absent or malformed, rather than proceeding with an empty calendar: an empty holiday map is indistinguishable from a year with no holidays, and it silently resolves every holiday as an ordinary weekday on both the busyness and the return axes. A **genuinely maintained** calendar covering the dates in use is therefore a precondition for live acceptance, not a later chore.

The schema stays the flat date map above. **No `last_reviewed` field, no maintenance-status enum, and no UI state for calendar staleness** — a stale calendar is a data problem with a one-line fix, and modelling its staleness would add schema and interface surface for a claim nothing in this pipeline can check.

### `data/seatlog.csv` — committed, deliberately coarsened

```csv
venue_id,day_of_week,hour,outcome,histogram_busyness,histogram_fetched_at
starbucks-beauty-world,thu,14,seat,42,2026-08-28T10:00:00+08:00
coffee-bean-holland-v,fri,10,no_seat,71,2026-08-28T10:00:00+08:00
```

- `outcome` — `seat` | `no_seat`. Two values.
- `histogram_busyness` / `histogram_fetched_at` — the busyness value **in effect at visit time**, captured during coarsening. See the refresh order below — this only holds if coarsening runs *before* the histogram is replaced.
- **Calendar date deliberately dropped** — the repo is public and a dated café log is a movement history.

**What dropping the date costs — corrected.** An earlier version said "visit ordering is permanently unavailable". That was wrong: the file is append-only and rows stay in chronological order, so **relative ordering survives** — "last visit" is answerable, and so is "the last three visits here". What is genuinely lost is **absolute dates, intervals between visits, and seasonality**. The loss is real but narrower than previously stated.

**Raw log staging paths.** The canonical raw dated CSV lives in iCloud Drive and is append-only — never rewritten from code. When `refresh.py` needs a local copy to coarsen from, it stages it at one of two gitignored paths, and **only these two**:

```
data/raw/              # directory, for a staged copy or any dated intermediate
data/seatlog.raw.csv   # single-file staging
```

Both are in `.gitignore`; `data/seatlog.csv` — the coarsened, dateless, committed output — deliberately is not. Naming the convention here matters because the ignore rules are narrow by design: **a raw file staged at any other path would not be ignored**, and would land in a public repo as a timestamped movement history. If a different staging path ever becomes necessary, add its ignore rule in the same commit.

Entry must be **two taps**: pick venue, pick outcome.

### `data/calibration.json`

Written by `analysis/calibrate.py`. Shape TBD until Phase 3.

---

## Fetch layer and refresh orchestration

```python
fetch_hours(source)    -> Hours       # Places Details, keyed by source.place_id
fetch_busyness(source) -> Histogram   # SerpApi search on resolved_name + resolved_address
```

**Both take a source record** from `data/venue_sources.json`, never a bare Place ID. The two sources need different identity and it is not interchangeable: Places Details *is* a Place ID lookup, while the SerpApi Maps endpoint is a **search**, and the query Phase 0 validated is the resolved name plus the resolved address — followed by the validated `data`-parameter retry when the first response returns without `popular_times` (`DECISIONS.md`, 2026-08-29, "Popular Times coverage, take two"). That endpoint does not accept a Place ID at all, so the earlier bare-Place-ID signature for `fetch_busyness` encoded an identity the busyness source cannot use. Corrected here.

**Neither fetcher writes `venues.json`.** `build/refresh.py` solely owns it, and **order matters**:

1. **Coarsen new raw visits from iCloud first**, joining each against the **currently deployed** histogram — the one about to be replaced. This is the only step that can capture "busyness in effect at visit time"; running it after the fetch would stamp every new visit with the *new* histogram value and silently destroy the lineage the Phase 3 join depends on.
2. Call both fetch interfaces for all venues, catching failures per source and per venue.
3. **Validate** against the contract.
4. **Merge** with existing `venues.json`, retaining **last-known-good** for any failed source.
5. Record `last_attempt_at`, `last_success_at`, `status` per source.
6. **Validate `return_transport` across the whole of `venues_meta.json`** and stamp
   `return_transport_status` on every venue — `validate_return_transport()`, defined in "Getting
   home: session-end return transport". This step is **mandatory and unconditional**: it checks
   hand-maintained metadata, not fetched data, so a fully failed refresh still runs it. It is what
   makes "a malformed band means the venue is not ranked" true on the evaluation branches that never
   read `return_transport` at all. **It classifies; it never aborts.** An `invalid` status is a
   result, not an error, and it does not withhold the write — one venue's typo must not cost every
   other venue its refresh.
7. Write to a temp file and **replace atomically** only after step 3's contract validation of the
   **fetched** data passes. Step 6's per-venue statuses are written *with* that data, never against
   it: they are outputs of the generation, not a precondition for it.
8. Regenerate `web/index.html` — inline the data (unicode-escaping every `<`), `ranking.js` then `app.js` into one module script with `app.js`'s import stripped, and `style.css`.

A busyness failure still refreshes hours, and vice versa. Degradation must be visible.

**`build/refresh.py` is the sole writer of `data/venues.json` and `web/index.html`.** Nothing else writes either, in any phase. Two of the eight orderings above carry silent data loss if broken, which is why the order is a contract and not a convenience: **step 1 before the fetch**, or the busyness lineage Phase 3 depends on is destroyed; and **step 7 after step 3**, or a page is published from fetched data that never passed contract validation.

`make refresh` runs the whole pipeline and **never commits** — inspecting the diff, committing and pushing stay separate manual actions. **The target is not added to the `Makefile` until the complete contract below is wired**: registry, both fetchers, coarsening, the return-validator bridge, validation, atomic replace and generation. A `make refresh` that runs half the pipeline would write a `data/venues.json` that looks generated and is not, which is worse than having no target.

**A venue vanishing from a source is not a closure.** That is `status: failed` (or `stale`) with last-known-good retained and a loud warning. Only an explicit `businessStatus` may mark a venue closed.

### The venue-source registry

Three files carry venue identity and they are **not** interchangeable:

| File | Status | Read by |
| --- | --- | --- |
| `data/venue_seeds.csv` | Hand-typed **resolution input** — name, brand, address hint | `phase0_resolve.py`, once |
| `data/phase0/place_ids.csv` | **Frozen** Phase 0 output | Read **once**, to seed the registry; never modified |
| `data/venue_sources.json` | The **canonical Phase 1 fetch registry** | Both fetchers, every refresh |

**The venue list does not live in `venue_seeds.csv`.** That file is what the *resolver* consumes; it carries no `venue_id` and no Place ID, so nothing downstream of Phase 0 can fetch from it. Phase 1's list of venues to fetch is `data/venue_sources.json`, and the ID set that must agree with `venues_meta.json` is the registry's, not the seeds file's. Earlier wording that read as though `venue_seeds.csv` were the project's venue list is corrected here and in "Venue list" below.

One record per venue; all four fields required and nonempty:

```json
{
  "venues": [
    {
      "venue_id": "starbucks-centrepoint",
      "place_id": "ChIJRZ1c0JYZ2jERZi1GJIoRVy0",
      "resolved_name": "Starbucks Centrepoint",
      "resolved_address": "176 Orchard Rd, #01-41/42 Centrepoint, Singapore 238843"
    }
  ]
}
```

**Bootstrap, once.** The registry is generated from `data/phase0/place_ids.csv`, taking `proposed_venue_id` as `venue_id` and the resolved identity columns verbatim, for every row whose `match_status` is `confident`. `data/phase0/` stays frozen (`DECISIONS.md`, "Phase 0 artifacts stay frozen") — the bootstrap **reads** it and writes elsewhere. After bootstrap the registry is hand-maintained and `place_ids.csv` is never read again.

**Preconditions, checked before any API call:**

- every record carries all four fields, each a nonempty string
- `venue_id` is unique across the registry, and `place_id` is unique across the registry
- the registry's `venue_id` set **exactly equals** `venues_meta.json`'s key set — no extras on either side

and again **during generation**, where the registry's `venue_id` set must exactly equal the generated venue set. Any of these failing is a hard stop before a call is spent.

The ID-set equality earns its place because identity is hand-assigned in two files edited at different times. A venue in the registry but not in meta generates with no brand, area or preference; a venue in meta but not the registry silently never refreshes and shows last-known-good forever. Neither is visible without this check.

**Adding a venue later** requires, in order: identity resolution to a confident Place ID; matching records in **both** `venue_sources.json` and `venues_meta.json`; and a successful validated fetch. Frozen Phase 0 artifacts are never edited to admit one.

**Module placement.** Reusable transports, parsers and fetchers live under `scraper/` — the Places client, the SerpApi transport, the hours parser, the busyness parser, and the two fetcher entry points. `build/refresh.py` **orchestrates only**: it sequences the stages and owns the files, and holds no parsing or transport logic of its own. That split is what lets `tests/python/` test parsing against trimmed fixtures without going near the orchestrator.

### The coarsening stage

Step 1, and the only step that can capture busyness in effect at visit time. It reads a private, gitignored raw log and appends coarsened rows to the committed `data/seatlog.csv`. **It never rewrites the raw input.**

**The private raw schema.** Three columns, header row required:

```csv
occurred_at,venue_id,outcome
2026-08-28T14:05:00+08:00,starbucks-beauty-world,seat
```

- `occurred_at` — ISO 8601 **with an explicit UTC offset**, converted to `Asia/Singapore` before `day_of_week` and `hour` are derived. A naive timestamp is **malformed**, never assumed local: the file is written by a phone that can be anywhere.
- `venue_id` — must exist in `data/venue_sources.json`.
- `outcome` — exactly `seat` or `no_seat`. No other value, no case folding.
- Rows are **append-only and chronological**, and every valid row produces **exactly one** coarsened row.
- **Any malformed row aborts the whole attempt.** No partial write, no skipped row: a silently dropped visit is a hole in the Phase 3 dataset that nothing later can detect.

**Candidate selection.** Exactly two locations are considered, both gitignored — `data/seatlog.csv`, the coarsened committed output, deliberately is not:

- `data/seatlog.raw.csv`, if it is a **regular file**
- regular `*.csv` files directly inside `data/raw/`, **non-recursive**

| Candidates | Behaviour |
| --- | --- |
| 0 | **No-op.** The refresh continues; there is nothing to coarsen |
| 1 | Use it |
| 2 or more | **Fail**, before any API call and before any write |

The **existence of `data/raw/` is not itself a candidate** — an empty directory is zero candidates, not an error. Nothing outside these two locations is ever considered, whatever it is named: the ignore rules are narrow by design, and a raw dated log staged anywhere else would be committed to a public repo as a movement history.

Refusing on two candidates rather than picking one is deliberate. The two staging paths are alternatives for convenience, not a merge set, and there is no defensible rule for deciding which of two dated logs is current.

**Processed-prefix authority: there is no cursor.** How much of the raw log has already been coarsened is derived, every run, from the committed output:

```
processed_count = number of DATA rows in data/seatlog.csv   (0 if the file is absent)
```

A separate cursor file would be a fourth thing to keep in sync and would go wrong silently. Before appending anything, the stage:

1. Fully validates **both** schemas — raw and committed — rejecting either on any malformed row.
2. Requires `raw_row_count >= processed_count`. A shorter raw log means it was truncated or replaced.
3. **Re-projects** the first `processed_count` raw rows to `(venue_id, day_of_week, hour, outcome)` and compares them **row for row, in order**, against the committed prefix.

**What this actually checks, stated exactly.** The comparison is a **consistency check between two records**, not an integrity check on either one. Its equivalence boundary is precisely this: two prefixes are equal to it exactly when their projections `(venue_id, day_of_week, hour, outcome)` agree **row for row, in order**. Everything the check can and cannot do follows from that one sentence:

> The run fails when a change to the raw prefix **or** to the committed prefix makes those two projections disagree at some position. It cannot fail on anything else.

This is weaker than "no history change goes undetected", and it is also weaker than an earlier draft of this section, which said that any projection-altering change fails. It does not: a change is caught only when it is **unmirrored**.

**What is invisible to it, stated as one predicate.** Because the boundary above is an equality of *projection sequences*, the complete and exhaustive characterisation is a single line, not a list:

> **Any change whatsoever — to either side, of any shape — is invisible exactly when the two projection sequences it leaves behind are still equal, row for row, in order.**

That predicate is the exhaustive statement. **No enumeration of classes can be**, and earlier drafts of this section claimed one anyway — first for three classes, then for four. The table below is therefore a list of the **notable instances** of that predicate, kept because they are the cases an implementer will meet, and grouped by the only distinction that matters operationally: whether the coarsened output changes.

**Invisible to the comparator is not the same as harmless, and the two must be grouped separately.** The predicate above says only that the comparator cannot see a change. Whether that change matters is a different question, answered by the **complete coarsened output** — the committed prefix *plus* the suffix this run appends — not by the prefix comparison alone. An earlier draft grouped by comparator blindness and then asserted "nothing is lost" for all of it, which is false for any transformation that shifts the prefix boundary. The grouping below is by consequence to the complete output.

**Group 1 — invisible and genuinely inconsequential.** The complete output is identical, because nothing shifts across the prefix boundary and every affected row coarsens to the same value. **Every instance here is a transformation of the *raw* prefix**, and that qualifier is load-bearing — see the note below the table.

| Instance | Why it is invisible | Why the complete output is unchanged |
| --- | --- | --- |
| A **raw-side** `occurred_at` edit staying inside the same Singapore weekday **and** hour | It does not alter the projection at all | The row's coarsened value is identical, and the suffix is untouched |
| A **reorder among rows sharing one projection, wholly inside the raw prefix** | Positions holding equal values are interchangeable | Row count is unchanged, nothing crosses the boundary, and equal projections coarsen identically |
| A **substitution of one raw prefix row for another of equal projection** | As above | As above |

**The committed-side analogues of those last two are Group 2, not Group 1.** Two *committed* rows can share a projection and still differ in `histogram_busyness` and `histogram_fetched_at`, because those columns are not part of the projection. Reordering or substituting them therefore leaves the compared sequences equal while relocating the stamps, so the complete output changes byte for byte and the Phase 3 lineage of both rows is wrong. An earlier draft said only "inside the prefix", which admitted exactly that case into the inconsequential group. A committed-side reorder or substitution is inconsequential **only** when the complete rows are identical, not merely their projections — in which case there is nothing to distinguish anyway.

**Group 2 — invisible and a genuine loss.** The projection sequences stay equal *while the record the pipeline produces changes*. These are the real cost of the design.

| Instance | Why it is invisible | What is lost |
| --- | --- | --- |
| An edit to a committed row's `histogram_busyness` or `histogram_fetched_at` | Neither column is in the projection, and neither is re-derivable from the raw log | Phase 3 lineage for that row is silently wrong |
| **Any coordinated transformation** applied to both sides so the sequences remain equal — a projected field edited in the raw row and in its committed row; the same row deleted from both; a matching row inserted into both; the same reordering applied to both | Both sides move together by construction | A visit is rewritten, erased or fabricated, and the chronological ordering the Phase 3 join relies on can be changed |
| A raw-side **insertion** of an equal-projection row **within the processed region** — at or before the last committed position — into a run **reaching** that position | Every compared position still holds the same value | The row that had been last-processed is pushed past the boundary and **coarsens a second time**, so the output gains a duplicate of that visit — and the duplicate carries *this* run's histogram stamp, not the original row's |
| A raw-side **deletion** from a run extending **one position past** the last committed position | The leftward shift lands equal values in every compared position | The previously-first-unprocessed row is pulled **into** the compared prefix and is therefore never coarsened — a real visit is erased — and the suffix composition changes with it |

The coordinated row is **not** limited to same-field, same-position edits, and an earlier draft wrongly wrote it that way. **Structural** coordinated edits — insertion, deletion, reordering applied identically to both prefixes — pass just as cleanly, and are worse, because they change the set of visits rather than one field of one visit.

**The last two rows are the correction that matters most here**, because two earlier drafts filed them under Group 1. A passing raw-side insertion or deletion is invisible to the *comparator*, but it moves the prefix boundary relative to the raw log, and everything on the far side of that boundary is what the suffix step coarsens. So the complete output changes even though the compared prefixes agree — a duplicated visit in the insertion case, an erased one in the deletion case. Neither is "nothing is lost".

**The insertion row's position qualifier is not decoration.** The duplicate-plus-restamp mechanism requires the inserted row to land **inside the processed region**, because that is what pushes the previously-last-processed raw row across the boundary and into the suffix. An equal-projection row inserted **just after** the boundary also leaves the compared prefix equal — trivially, since the prefix is untouched — but it simply coarsens once as an ordinary new suffix row. That is a fabricated visit, which is bad, but it is **not** a duplicate of an existing one and does not restamp anything. Describing both with one sentence would misstate the mechanism for half the cases it covers.

**But that mechanism is not observable in the committed record, and this contract must not pretend otherwise.** `seatlog.csv` discards `occurred_at` by design, and both source rows here necessarily share a projection and receive the same current histogram stamp. So the two positions produce **byte-identical** complete output: the committed prefix plus one equal-projection row stamped by this run. Constructed both ways, even the raw *index* feeding the suffix is the same. The distinction above is therefore real and derivable **from the input position and the algorithm**, and **indistinguishable in output** — a complete-output assertion can prove a row was added, never which visit it represents.

An observable seam — having the stage report which raw rows it consumed, for a test to inspect in memory — would close that gap, and is **rejected**. It would have to surface raw-row identity, which means the timestamp this file exists to destroy; keeping it in memory only would avoid the privacy cost but buys nothing, because **the two mechanisms have the same consequence**: one spurious row of that projection carrying this run's stamp, either way. Production surface added to observe a distinction with no difference in outcome is the trade this section rejects everywhere else. The honest statement is the one recorded here, and the fixtures below assert only what the record can actually establish.

**The insertion and deletion boundary conditions remain as verified, and they are deliberately different.** An insertion shifts later rows rightward, so the comparator is blind when the equal-projection run **reaches** the last committed position; a deletion shifts them leftward, so it needs the run to extend **one row beyond** it, or a differing projection is pulled into a compared position and the check fails. A reorder or substitution shifts nothing and needs no boundary condition at all. Those conditions describe **comparator blindness only** — they say nothing about consequence, which is what the grouping above settles.

No Group 2 instance is fixable from inside this design. The histogram stamps have no second record to check against at all. **A coordinated transformation defeats any two-record consistency check by construction** — and no record stored *inside these two files* closes it either, because an editor able to change both can change a third field too. Detecting it needs an independently held integrity record, which a single-machine, single-repository project does not have. The boundary insertion and deletion are the same problem in a different shape: the comparator can only ever check the prefix, so a change that alters *which rows are the prefix* is outside anything it can observe. All of it is therefore excluded from the guarantee rather than papered over.

The narrower strengthening that would close the sub-hour class alone — committing a per-row digest of the raw `occurred_at` beside each coarsened row — is **rejected on privacy grounds**: the timestamp space is small enough to brute-force, so such a digest in a public repo would reconstruct the dated movement history the coarsening exists to destroy. A weaker honest guarantee is preferred to a stronger one bought with the file's entire reason for existing.

The comparison covers only those four derived columns because `histogram_busyness` and `histogram_fetched_at` record the histogram in effect when that row was *first* coarsened and are correctly not reproducible from today's data.

**Suffix handling.** For each raw row beyond the prefix, in order:

- resolve `venue_id` against `data/venue_sources.json`; an unknown ID is malformed
- derive `day_of_week` and `hour` in `Asia/Singapore`
- join against the **currently deployed, pre-fetch** `data/venues.json` histogram for that venue
- stamp `histogram_busyness` from that histogram, and `histogram_fetched_at` from **that histogram's own `last_success_at`** — never `last_attempt_at`, and never a value from this run's fetch
- preserve chronological order

If there are unprocessed rows but **no deployed `data/venues.json`**, or that venue's histogram is unusable, the run **fails before fetching**. It does not coarsen with an empty stamp and it does not defer: stamping this run's histogram is exactly the lineage destruction the coarsen-first order exists to prevent, and a null stamp is a row Phase 3 can never use. A consequence worth stating: on a first-ever refresh with a non-empty raw log there is no deployed histogram to join against, so the run fails rather than producing unusable rows — the first refresh generates the histogram the second one stamps against.

**Atomic replacement.** The stage builds the complete replacement `seatlog.csv` **in memory** — committed prefix plus new suffix — writes it to a temp file **in the same directory**, validates that temp file against the committed schema, and only then replaces atomically. The file is append-only in *content* and replaced in *mechanism*, so a crash never leaves a half-written log.

**Negative-path fixture obligations.** Each is a `tests/python/` case, and none touches the network:

- zero candidates → clean no-op, refresh continues
- exactly one candidate at `data/seatlog.raw.csv` → used
- exactly one candidate inside `data/raw/` → used
- two or more candidates → fail, with no API call and no write
- a malformed raw row — bad timestamp, **naive** timestamp, unknown `venue_id`, unknown `outcome` → the whole attempt aborts
- raw log **shorter** than the committed data-row count → fail
- an **unmirrored raw-side** projection change — raw `occurred_at` moved across an hour boundary, or across a weekday boundary, or `venue_id` or `outcome` edited → **fail**
- the **mirror case, committed side** — a committed prefix row's `venue_id`, `day_of_week`, `hour` or `outcome` edited with the raw row untouched → **fail**
- a **coordinated** edit — the same projected field changed in the raw row *and* in the committed row at that position → **passes**, asserted as the documented limit of a two-record consistency check, not as an oversight, **with the complete output asserted to carry the rewritten value** rather than the original
- a raw-side prefix mutation that **preserves the projection** — `occurred_at` moved within the same Singapore weekday and hour → **passes**, and the **complete output is asserted byte-identical**, which is what files it under Group 1
- a mutated `histogram_busyness` or `histogram_fetched_at` on a committed prefix row → **passes**, and the **complete output is asserted to retain the mutated stamp**, since nothing can restore it — the documented accepted loss
- a **reorder of two prefix rows whose projections differ** → **fail**
- a **coordinated structural deletion** — the same row removed from the raw prefix **and** from the committed prefix, so `processed_count` drops with it → **passes**, and the complete output is asserted to hold **one fewer row of that projection** than before. The assertion is on **multiplicity, not identity**: an earlier draft asserted that a nameable visit was lost, reasoning that committed rows carry distinct histogram stamps. **They need not.** Every suffix row coarsened in one run takes that run's `histogram_fetched_at`, and rows sharing a venue, weekday and hour take the same `histogram_busyness` too, so several committed rows can be byte-identical; deleting any one of them yields the same output. Multiplicity is observable whether or not the stamps happen to differ, so that is what the fixture asserts
- a **coordinated structural insertion** — a matching row added to both → **passes**, and the **complete output is asserted to carry the fabricated visit**
- a **coordinated reorder of two rows whose projections differ**, applied identically to both sides → **passes**, and the **complete output is asserted to carry the rewritten chronological order**; this is the third structural form the coordinated instance names, and it must have its own case rather than being assumed covered by the deletion and insertion ones
- a **reorder among rows sharing one projection, sitting wholly inside the RAW prefix** — no run/boundary relationship required → **passes**, and the **complete output is asserted byte-identical**, which is what makes it a Group 1 instance. The **raw** qualifier is required: the committed-side analogue is a Group 2 instance, because two committed rows can share a projection and differ in their histogram stamps
- a **substitution of one RAW prefix row for another of equal projection** → **passes**, complete output asserted byte-identical — again raw-side only, for the same reason
- the committed-side counterparts of those two — a **reorder or substitution of committed rows sharing a projection but carrying different `histogram_busyness` / `histogram_fetched_at`** → **passes** the comparator, with the complete output asserted to have the **stamps relocated**, pinning them as Group 2 rather than Group 1
- an **insertion of an equal-projection row within the processed region**, into a run that reaches the last committed position → **passes** the comparator, and the complete output is asserted to have **gained exactly one row**, equal in projection to the run and carrying **this run's histogram stamp** rather than an original one. That is the whole of what the committed record can establish, and it is enough to file the instance under Group 2 — the output is not identical, so the Group 1 claim fails. It is **not** asserted that the added row is the previously-last-processed visit; see the paired case below
- the **paired position case**: the same equal-projection row inserted **just after** the boundary → **passes**, and the complete output is asserted **identical to the case above** — same row count, same projection, same current stamp. This case exists precisely to pin that identity, not to distinguish the two: it is the test that stops a future reader believing the committed record can tell the two mechanisms apart
- an **insertion of an equal-projection row into a run that does not reach it** → **fail**, the pinned boundary for the insertion case
- a **deletion inside a run of equal projections that extends one position past the last committed row**, with a row appended so the raw count is unchanged — and **the appended row must carry a projection different from the run's**, which the fixture pins explicitly. The comparator **passes**, and the complete output is asserted to have **lost one row of that projection from the suffix**, with the changed suffix composition asserted explicitly. That is enough to file the instance under Group 2 — the output is not identical. **The different-projection requirement is load-bearing, not incidental:** append an *equal*-projection row instead and the suffix still holds one row of that projection, so the complete output is the same multiset as before and the asserted loss is simply false. It is **not** asserted *which* raw visit is gone: constructed both ways, deleting the first or the last row of the run yields the same committed output
- a **deletion inside a run that reaches only the last committed position** → **fail**, the pinned boundary for the deletion case, and deliberately not the same condition as the insertion case above
- an insertion or deletion that shifts a **differing** projection into another position → **fail**

Every instance named in the Group 1 and Group 2 tables above has a case in this list, and **every passing case asserts what the committed record can actually establish about its consequence** — byte identity for the Group 1 instances, and for each Group 2 instance the specific observable difference: a relocated stamp, a lost row, a fabricated row, a rewritten order, or an added row carrying this run's stamp. A case that only asserted `passes` would be compatible with either grouping and would not pin what the grouping claims; an earlier draft made that summary claim while several bullets still recorded only the comparator verdict.

**The assertions stop where the schema does, in both directions.** `seatlog.csv` retains no `occurred_at`, so rows sharing a projection are interchangeable in the record. No fixture therefore claims to establish **which raw visit an added row represents**, nor **which raw visit a lost row was** — only that a row of that projection was added or is absent, with which stamp, and how the suffix composition changed. Both limits have the same cause and the same remedy: the *mechanism* on either side — the previously-last-processed row re-coarsening on insertion, the previously-first-unprocessed row being pulled into the compared prefix on deletion — stays derivable from the input position and the algorithm, and is stated as such in the prose above; it is simply not derivable from the committed record, so no test may assert it from there. The two insertion cases are paired to make the limit explicit rather than to defeat it. Earlier drafts asserted visit identity from complete output on the insertion side and then, one round later, still on the deletion side; both are corrected, and the statement is written to cover added and lost rows together so the asymmetry cannot reappear on one side alone.
- a valid suffix append → exactly the new rows appended, the prefix unchanged
- unprocessed rows with **no deployed `venues.json`** → fail before fetching
- the failure occurs **before either fetcher runs** — asserted, not assumed
- **no partial output** after any failure — `seatlog.csv` and the raw input both unchanged
- a new row stamped with the **pre-fetch** histogram value, proving the order

### The return-validator bridge

**`validateReturnTransport()`** is exported from `web/ranking.js` and is the **only** implementation of that rule. (The pseudocode in "Whole-file validation is a mandatory stage, not a test obligation" writes the same function as `validate_return_transport`; the camelCase name is the real export, and it is the name the bridge imports.) Step 6 runs it from Python over the whole of `venues_meta.json`, through a narrow Node bridge:

- A small Node script imports `validateReturnTransport()` from `ranking.js`, reads the metadata path handed to it, and writes **structured JSON and nothing else** on stdout.
- Python invokes it with `subprocess.run([...])`, passing the metadata path as an **argv element**. **Never `shell=True`, never a constructed shell string.** No shell is needed here, and a filesystem path is exactly the kind of value that makes one dangerous.
- **Malformed venue data is a result, not an error.** The bridge returns per-venue `invalid` statuses and generation continues, exactly as "One failure model: per-venue, never global" requires.
- **A broken bridge is not a result.** Node missing, the import or process failing, a nonzero exit, output that is not valid JSON, or output not carrying a status for every generated venue all mean **the mandatory stage did not run** — so the refresh **stops before the atomic replacement**. An unstamped `venues.json` is unrankable at every venue, which is precisely the board-emptying failure the stamp exists to prevent, and shipping one would be worse than not refreshing.
- **Every generated venue receives a status.** There is no default and no omission.
- The bridge **never writes `venues_meta.json`**, or anything else. It reads and reports.

Reimplementing the validation in Python was rejected: two implementations of one rule drift, and the JS one is the one `ranking.js` actually acts on at `STEP 0`.

### Hours source — Places API, chosen for multi-brand

**Google Places API Place Details is the primary hours source.** It returns `regularOpeningHours`, `currentOpeningHours` (date-specific, ~7-day horizon), and `businessStatus`.

Multi-brand scope drove this:

- **One consistent interface** — identity, hours, `businessStatus` — across Starbucks, Coffee Bean, Tim Hortons and independents alike.
- **Brand-specific locators need a separate integration per chain**, each undocumented, each breaking on its own schedule, none providing a closure signal. Four brands would mean four fragile scrapers instead of one supported API.

**Cost, re-verified 2026-08-29:** opening-hours fields are billed under the **Enterprise** SKU, free cap **1,000 calls/SKU/month**. One request is charged against *every* field tier its mask touches, and this project's mask spans all three — Essentials (10,000 free), Pro (5,000), Enterprise (1,000) — so **Enterprise binds first**, at roughly 35 refreshes/month for 28 venues. At a weekly cadence this is **$0**. A GCP billing account and API key are required even so — the only friction, worth paying once rather than maintaining per-brand scrapers. Setup steps are in `README.md`.

The Starbucks SG locator remains a **timeboxed cross-check experiment only**, never an architectural input, and not a prerequisite for anything.

### Busyness source

**SerpApi Google Maps endpoint** — `popular_times` as structured JSON. Free tier **250 searches/month**, throttled to **50/hour** (re-verified 2026-08-29). Cost per venue is 1 call if search returns `popular_times` directly, 2 if a `data`-parameter retry is needed to get a real result — see `decisions.md`, 2026-08-29, "Popular Times coverage, take two." At 28 venues that's **4–8 refreshes/month** depending on how many need the retry that day. SerpApi, not Google, is what caps refresh frequency. Weekly fits; daily does not.

Fallbacks only if `popular_times` proves missing or paywalled: the `populartimes` / `LivePopularTimes` libraries (unstable, open legal-concern issue) or the Apify actor.

Google's Places API does **not** expose popular times. It does expose opening hours. Two different questions.

Terms-of-service note: automated scraping of Google Maps is against Google's ToS. Personal tool, low volume; not to be made commercial in this form.

---

## Phases

### Phase 0 — Verify assumptions before building

**Phase 0 is closed, 2026-08-29.** All 28 venues resolved, hours/timezone/histograms measured, `N`/`P` set from real curves, `venue_type`/`area` recorded in `data/venues_meta.json`. Every item below is answered inline. Two real bugs in the spread analysis itself (closed-hour buckets leaking through when a day had no recorded period; `very_quiet` evidence merged across same-named venues) were found by independent review after the first close-out and are fixed — see `decisions.md`, 2026-08-29, "Independent review of the closed Phase 0."

1. **Resolve each supplied name + brand to a Google Place ID**, then assign a stable `venue_id`, and record `venue_type` and `area` in `venues_meta.json`. **Answered, 2026-08-29.** 28/28 resolved to a confident Place ID (`data/phase0/place_ids.csv`); `venue_type` and `area` recorded for all 28 in `data/venues_meta.json`.
2. **Confirm the Places API path works for a non-Starbucks brand** as well as Starbucks — the multi-brand claim rests on one interface covering all of them. **Answered, 2026-08-29.** Confirmed on Coffee Bean & Tea Leaf (3 venues) and Baker & Cook (1 venue) — same interface, same result shape, no brand-specific handling needed.
3. **Confirm `currentOpeningHours` returns date-specific overrides**, and record the real window it covers. **Answered, 2026-08-29 — and the first answer was wrong.** Confirmed present. Phase 0 reported the horizon as "not a fixed constant — 1 to 7 days ahead depending on the venue"; that spread was an artifact of deriving it from the latest date a period *opened*. Measured across all 28 saved payloads, every venue covers 2026-08-29 through 2026-09-04 — a **flat seven-day window**, matching Google's documented contract. The per-venue field survives, now holding a computed-and-validated window. See `decisions.md`, 2026-08-29, "Hours ingestion: five defects."
4. **Confirm both timezones independently.** `hours_timezone` and `histogram_timezone` are separate fields because the sources may differ. **Answered, 2026-08-29.** Both are `Asia/Singapore` (UTC+480). `hours_timezone` came directly from the Places API response; `histogram_timezone` has no field to read at all, so it was confirmed indirectly (first non-zero busyness hour vs. each venue's own opening hour) — 0h offset on every eligible venue. They agree.
5. **Confirm the busyness source works** for venues of each brand. **Answered, 2026-08-29.** Confirmed for all three: 22/24 `starbucks`, 3/3 `coffee_bean`, 1/1 `baker_and_cook` have real Popular Times data (26/28 overall; the 2 without were independently confirmed absent by checking Google Maps directly, not just an empty API response — see `decisions.md`, 2026-08-29, "Popular Times coverage, take two").
6. **Check real hours shapes.** Any after-midnight closing, 24-hour operation, or split periods? Determines whether the periods array and previous-date lookup earn their complexity. **Answered, 2026-08-29 — and the answer is a real gap, not a clean bill of health.** All three shapes occur (24-hour: 3 venues; after-midnight: several; split periods: none observed). More importantly, **3 of 28 venues run a single period spanning several calendar days** (e.g. Sunday 07:30 through the following Saturday 17:30), which the previous-date-only lookup in `CLAUDE.md` cannot resolve as written. See `decisions.md`, 2026-08-29, "`build/phase0_hours.py` run live". **Resolved 2026-08-29** — the fetcher decomposes a multi-day period at ingestion into one self-contained suffix entry anchored to each touched day — the entries are *not* bounded to a single day; each carries the true remaining distance to the real close — leaving `resolve_hours` and its one-day lookback unchanged. Resolving it surfaced four further defects in the same ingestion step (a fabricated midnight close on 24-hour venues, truncated endpoints read as real events, a miscomputed window, and a sparse current-hours map that let a special closure fall back to regular hours). All five are settled together in `decisions.md`, 2026-08-29, "Hours ingestion: five defects."
7. **Measure the Popular Times spread and set `N` and `P`.** Per venue and weekday: max−min, IQR, distance from median to max, and **hourly coverage** (to validate or revise `MIN_HISTOGRAM_HOURS = 6`). Record `N` and `P` in `decisions.md` with the evidence.

   Also check for repeatable troughs around `2N` below median — that, and only that, would justify `very_quiet` later.

   A curve inspected while planning ran roughly 60-100% of peak all day with only a mild evening peak. **If the median venue's range is under ~20 points, banding will barely discriminate** — most venues will read `typical` and `baseline_seatability` will carry the ranking. A legitimate finding to record, not a problem to fix by shrinking `N` until the bands look busy.

**Acceptance:** one venue's hours and histogram printed and matching the Maps app; both timezones confirmed; the current-hours window recorded; a spread and coverage table across all venues; proposed `N` and `P` with justification.

**This measures the histogram's shape. It does not validate that Popular Times predicts seat availability** — nothing in Phase 0 can establish that, and no Phase 0 output should be read as evidence for it.

### Phase 1 — Fetchers, orchestrator, Plan A / Plan B

`refresh.py` orchestrates coarsening, both fetchers, and generation. `venues_meta.json` is filled in by hand.

Requirements:
- Readable on an iPhone 15 Pro Max in portrait.
- Date picker, not a weekday picker.
- Plan A and Plan B, with Plan B recalculated from Plan A's delayed arrival using the same active-period and dual-bound machinery, and a `salvage` fallback labelled as such with its actual duration stated.
- `seat_confidence` shown **with its baseline and adjustment components**.
- Feasibility tier shown; thin-margin warning on `tight`, naming which constraint is thin.
- **Return transport evaluated at session end**, with the binding constraint named (venue close or last departure), `latest_leave_at` composed from both, an `unverified` way home flagged and barred from Plan A, and the second refusal message when nothing has a verified way home.
- Per-source freshness with `ok` / `stale` / `failed` distinguished.
- Missing busyness falls back to baseline with a lower-evidence warning — **never treated as `typical`**.
- "No low-risk option found for the requested session" when nothing reaches `mixed`.
- `shorter` venues in their own group; unrankable venues in theirs.
- `unknown` hours distinct from `closed`; non-`OPERATIONAL` venues flagged loudly.
- Holiday policy applied per venue and stated in the UI.
- Alternatives grouped by area; `latest_leave_at` shown.

**Acceptance, in two parts** — the design must correctly handle both an unassessed and an assessed venue set:

1. **With no baselines assessed**, the app returns "No low-risk option found for the requested session", showing the candidates and why each is unknown. This is the correct behaviour, not a failure. **Exercised via a hand-built all-`unknown` test fixture, never against live `data/venues_meta.json`** — see the correction below.
2. **With an assessed baseline** (the live case — see below), the app produces a Plan A, and a Plan B where a viable fallback exists, and I can see why each was chosen — without thinking hard. **For a session ending inside the core service span this requires no `return_transport` data at all**; for a session ending outside it, a Plan A additionally requires that venue's `return_transport` entry, and its absence correctly yields the second refusal rather than a recommendation.

**Correction, 2026-08-31:** this section's original premise — "every venue starts at `baseline_seatability: unknown`" — was stale on disk. All 28 venues were assessed during Phase 1 step 2 (`DECISIONS.md`, 2026-08-30), before this correction was written. Acceptance part 1 is therefore exercised only against a synthetic fixture now; part 2 is the path exercisable against live data.

### Phase 1 implementation order

Eight steps in dependency order. **No assignment IDs are allocated here** — each becomes its own assignment when it is opened, under `WORKFLOW.md`'s allocation procedure.

1. Venue-source registry and its bootstrap, plus the hours parser and `fetch_hours`
2. SerpApi transport and parser, plus `fetch_busyness`
3. The Node return-validator bridge
4. The top-level ranking pipeline entry point in `ranking.js`
5. The coarsening stage
6. Frontend shell and the fixture-driven HTML generator
7. Complete refresh orchestration, generation integration, a maintained `holidays.json`, and the `Makefile` target
8. Live refresh and manual acceptance

Steps 1–6 are independently testable against fixtures and touch no network. Step 7 is where the contract is first wired end to end, and the first point at which `make refresh` exists at all. Step 8 is the only step that spends an API call.

**Acceptance, extending the two parts above:**

- the synthetic all-`unknown`-baselines fixture returning the first refusal, per part 1
- a live session **ending inside the core span** (07:00–21:30), producing a Plan A and a Plan B where a viable fallback exists — the case that needs no `return_transport` data at all
- a live session **ending outside the core span** with no `return_transport` recorded, correctly producing the **second** refusal rather than a recommendation
- the generated `index.html` passing the generated-artifact assertions below, opened from `file://`, and read on the iPhone

**Live success does not prove the failure paths.** A successful live refresh exercises the happy path and nothing else. **Partial-source failure, last-known-good retention, malformed-metadata handling and atomic replacement are not demonstrated by it** and stay fixture-tested — a refresh in which both sources succeeded says nothing about what happens when one does not.

**Phase 1 is independently useful.** If Phases 2 and 3 never happen, this was still worth building.

### Phase 2 — Seat logging

- Apple Shortcut: two-tap entry, appends to the raw CSV in iCloud Drive.
- `make refresh` coarsens **before fetching** (see refresh order), dropping the date and capturing `histogram_busyness`. It does **not** commit.
- **The app shows per-venue history from the first entry** — "been here 3×, seat 3/3", "last visit: no seat, Fri 10am". Ordering comes from CSV row order, which is chronological.

Phase 3 needs volume that is months away; if the log pays out nothing until then, logging becomes an unrewarded chore and stops, taking Phase 3 with it. Raw counts are not a model but they are useful at n=1 — and they are what will eventually let `baseline_seatability` be checked against reality rather than memory.

**Acceptance:** logging takes under five seconds at the counter, and the result is visible on the next refresh.

### Phase 3 — Calibration

Target:

```
P(seat | venue, arrival conditions, personal history)
```

Join each log entry to **its own recorded `histogram_busyness`**, never the current histogram.

Candidate inputs: brand · `venue_type` · venue-level effect · relative Popular Times signal · weekday/weekend · personal observed outcomes.

**Use partial pooling.** A separate model per venue will overfit badly at realistic sample sizes; pool across venues with venue-level effects so venues with little data shrink toward the population.

**`no_seat` observations are the most valuable rows in the dataset** — including walk-bys and abandoned attempts. Without them, selection bias concentrates the data in venues already believed safe.

Show **uncertainty**, never a bare probability. This is where cross-venue comparability becomes real and where `baseline_seatability` gets validated against evidence.

**Do not design or implement this model now.**

---

## Testing

Deliberately small. No mocking frameworks, no live-network tests.

**`tests/js/` — `node --test`**, importing `ranking.js` directly from source:
- **`resolve_hours(venue, target_date)` as a pure function of any date** — a current-hours date winning, the `current_hours_valid_from` / `current_hours_valid_through` window boundaries, a holiday beyond the window yielding `unknown`, a holiday *inside* the window resolving from the materialised entry, and `selected_weekday` derived in `Asia/Singapore`
- **multi-day decomposition** — a `day_gap` of 6 and of 2 reproducing the anchor entry unchanged, every touched weekday present and `known`, the close-day entry an ordinary same-day close, untouched weekdays explicitly `closed`, and `day_gap == 0` with `close == open` rejected
- **the current-hours window** — all seven dates materialised, a date covered only by a period spanning in from an earlier date marked `known` rather than `closed`, a missing entry inside the window treated as malformed rather than as regular hours, and interior truncation failing validation
- **continuity across the window edge** — a final-window-day arrival joining into continuous next-day regular hours; the same arrival meeting a known midnight gap and closing at the gap; the same arrival meeting an `unknown` next date and resolving hours-unknown; a session ending before midnight whose `closing_buffer` crosses it; and midpoint and upper bounds resolving differently at the boundary
- **known shortfall versus unknown boundary** — a **known** 10-minute shortfall still ranking as `tight` with its thin-margin warning, while an `unknown` boundary is **not ranked at all**. These must not collapse into one outcome
- **source authority across the date boundary** — a venue whose *regular* hours are 24/7 whose arrival date is inside the window and explicitly `closed` must resolve **closed**, not `open` via the previous date's unbounded regular period; and a known holiday outside the window must resolve **unknown**, not `open` via a regular overnight period carried in from the previous day
- **unbounded periods** — an `always_open` period containing an arrival, `effective_close` returning `COVERED` (never a claim of no close), `surplus_*` as `AT_LEAST(0)` passing the tier test but never displayed as a figure, `usable_minutes` equal to the full duration, **`latest_leave_at` == `UNDETERMINED`** (not a computed time), and the serialised JSON containing **no** `Infinity` and no `close` key
- **the lazy walk stops at the first known close** — arrival Monday 18:00, a **known** Monday close at 22:00, `required_end` Tuesday 00:30, and Tuesday an out-of-window known holiday: the result is a **known shortfall** ranked `tight` or `shorter` against the 22:00 close, **never hours-unknown**. Tuesday must never be resolved, since the run ends before it
- **`NONE` versus `UNKNOWN`** — an upper-bound `NONE` failing `robust` while the midpoint is still evaluated and can be `tight`; a midpoint `NONE` falling to `shorter`; and `UNKNOWN` on either bound unranking the venue. `NONE` must never unrank on its own
- **the exact `required_end_abs` boundary** — a finite close landing **exactly** on `required_end_abs` returns a **finite close** with `surplus == 0` (an exact, displayable zero), while a close one minute **beyond** it returns `COVERED` with `surplus == AT_LEAST(0)`. The two must be distinguishable: the first displays its margin, the second must not
- **`AT_LEAST(0)` accessors** — `passes_feasibility()` true, `sort_key()` == 0, and `display()` emitting **no numeric margin**; plus a guard that `display()` never renders the tag as "0", which would claim a deadline-exact close that was never established
- **the tier tests go through accessors, never raw comparison** — a `COVERED` upper bound reaching `robust` via `passes_feasibility(surplus_upper)`, and `finite_shortfall()` **rejecting `AT_LEAST(0)`** rather than coercing it. A tier test that compares `surplus_*` numerically, or negates it, must fail the suite
- **case dispatch before arithmetic** — `UNKNOWN`, `NONE` and `COVERED` must each be handled without any subtraction from `effective_close_*`, proving the metrics are branched on the tag rather than computed and discarded
- **no period shape may outrank a later date's authority** — all three must resolve **hours-unknown** when the session crosses into an **out-of-window known holiday**: (a) a **finite overnight** regular period, Mon 22:00–Tue 02:00; (b) a **finite multi-day** regular suffix entry; (c) a **24/7 `always_open`** regular period, which must never inherit `robust` from its unbounded end. The first two are the cases an earlier draft's `always_open`-only walk left broken
- **the formulas read the effective closes** — `usable_minutes`, `surplus_mid`, `surplus_upper` and `latest_leave_at` computed against an `effective_close` **extended by a join** across a `continues_beyond_window` boundary, proving they do not read `active_period.period_end_abs` directly; and an `UNKNOWN` effective close producing **no tier and no surplus at all**
- **`robust` is upper-bound only** — a venue with full coverage at the midpoint but a shortfall at the upper bound ranks `tight`, never `robust`
- **minimum-`period_end_abs` selection is a tie-break among equals only** — a decomposed chain whose matching ends are equal resolves deterministically to that end; a synthetic pair whose ends **disagree** is a **validation failure** and the venue is **rejected, not ranked** (per-venue flag, last-known-good retained, `status: stale`). Asserting the smallest end here instead would be a bug, and the test must assert rejection
- **`resolve_hours` applied to the previous date too** — a current-hours entry on the previous day changing which after-midnight period exists
- **the open/unknown/closed precedence** — a known period containing the arrival returning `open` **even when the sibling date is `unknown`**; no match with a sibling `unknown` returning `unknown`; no match with both dates definite (`known` or `closed`) returning `closed`; and a `closed` date contributing certainty rather than doubt
- **absolute-minute conversion** — that a Tuesday 00:30 arrival matches a Monday `{open: 450, close: 1500}` period, the case that motivated the coordinate system
- **active-period lookup** — arrival inside a period, in the gap between split periods, before opening, after closing; previous-date after-midnight periods; travel crossing midnight; the exact `period_start_abs <= arrival_abs < period_end_abs` boundary at both ends, including an `always_open` period whose `UNBOUNDED` end contains every later arrival
- **independent mid/upper resolution** — a case where `arrival_mid` and `arrival_upper` fall in *different* periods, and one where `arrival_upper` falls in **no** period (which must fail `robust`, not read as zero shortfall)
- `usable_minutes` / `surplus_mid` / `surplus_upper` / `latest_leave_at`, including closing-buffer, past-closing, zero and negative cases
- feasibility tiers — `robust` / `tight` / `shorter` boundaries, and the `FEASIBILITY_TOLERANCE_MINUTES` edge
- per-venue arrival derivation and hour flooring
- the busyness band — `peak` over `busy`, `N`/`P` boundaries, a flat curve landing wholly in `typical`, `unknown` below `MIN_HISTOGRAM_HOURS`
- the `seat_confidence` lookup across **every** baseline × band combination, clamping at both ends, `unknown` propagation
- **Plan B's dual-bound arrival chain** — that `plan_b_arrival_upper` derives from `plan_a_arrival_upper` (not from the midpoint), that both bounds resolve their own `active_period` independently, and a case where `plan_b_arrival_upper` rolls past midnight onto a different date than `plan_b_arrival_mid`
- **`backup_strength` three-way** — `strong` only when the requested session fits at the fallback; `salvage` when the floor is cleared but the session does not fit; `none` below the floor, below `PLAN_B_MIN_CONFIDENCE`, or when a nearby fallback is closed by delayed arrival
- **the core service span short-circuits, and only inside itself** — a session end at 20:00 resolving `robust` with basis `core_span` on a venue whose `return_transport` is **entirely absent**, with `resolve_return_service` never called (assert the call count, not just the outcome); the same venue with a session end at 22:00 resolving `unverified` (basis `no_data`)
- **schedule-free modes are positive evidence** — an admissible `walk` or `cycle` return resolving `robust` with `AT_LEAST(0)` even when the `transit` entry is missing entirely; and the same venue resolving `unverified` once that mode is inadmissible
- **the bicycle is a physical object** — `cycle` admissible as a return mode when `bicycle_with_you`, and **inadmissible** when the outbound mode was `transit` from `origin_b`, even though `access.origin_a.cycle` exists
- **rain removes `cycle` from the return set**, and a venue whose only schedule-free return was `cycle` falls from `robust` to whatever `transit` gives — never silently staying `robust`
- **the return leg reads `access[origin_a]`, not the outbound origin** — a trip from `origin_b` whose return mode set comes from `origin_a`; and a venue with **no** `origin_a` entry at all resolving `unverified`, never `closed`
- **the 04:00 service-day boundary** — a session ending 03:30 Saturday tested against **Friday** night's last departure and resolving `shorter`, not against Saturday night's and resolving `robust`. Anchoring on the calendar date must fail this test
- **the pre-dawn gap is terminal for a schedule-bound-only set, and only then** — a session ending 05:00 on a `transit`-only admissible set resolving `unverified` (basis `pre_dawn_gap`) **regardless of what `return_transport` contains**, with `resolve_return_service` never called, and never producing a `return_margin_*`, a `binding_limit_*` or a `shorter` tier; and **the same 05:00 session with an admissible `walk` resolving `robust` (basis `schedule_free`)**. A test asserting `unverified` for the walk case is asserting a policy this design does not adopt
- **the pessimistic edge flips** — the upper bound taking the band's **lower** edge for `last_departure_band` while travel bands keep taking the **upper** edge. A test that passes with one shared edge rule is not testing this
- **the route prerequisite comes first** — a venue with **no** `access[origin_a]` entry, and one with only `null` entries, resolving `unverified` (basis `no_recorded_route`) for a session ending at **13:00, inside the core span**. This is the ordering defect the core-span shortcut caused; a test placed only outside the span cannot catch it
- **the core span waives the timetable, not the route** — at 13:00, a venue with an admissible `access[origin_a].transit` entry and **no** `return_transport` at all resolving `robust` (basis `core_span`); the same venue with **no usable `access[origin_a]`** resolving `unverified` (basis `no_recorded_route`) at the same hour. The two files answer different halves of the question and the test must separate them
- **band normalisation, before validation** — `23:20-23:25` → `(1400, 1405)`; `23:55-00:05` → `(1435, 1445)`, which a pre-normalisation increasing check would wrongly reject; `00:30-00:35` → `(1470, 1475)`, **not** `(30, 35)`; `03:58-04:02` → `MALFORMED`, since it straddles the service-day boundary and names two nights; and `25:00-25:05` → `MALFORMED`. Every normalised offset lies in `[240, 1680)`
- **`edge()` takes opposite ends for opposite bounds** — the upper bound taking `lo` and the mid bound taking `floor((lo + hi) / 2)`, with the floored midpoint an integer; and a travel band in the same test still taking its **upper** edge, proving the two rules are not shared
- **`validate_return_transport` covers every reachable entry** — `default` and every `by_weekday` key, for every destination and mode, across the whole of `data/venues_meta.json`; a malformed band under a `by_weekday` key that no current session would ever select still marks the venue invalid
- **`resolve_return_service` precedence** — holiday-with-`unknown`-policy yielding `MISSING` even when `default` exists; holiday-with-`substitute_sun` taking `by_weekday.sun` and falling back to `default` when `sun` is absent; a `by_weekday` entry outranking `default` on an ordinary date; and the weekday taken from the **service date**, proved by a 03:30 Saturday end selecting the **`fri`** override
- **malformed return data is a validation failure, not `unverified`** — each of these unranking the venue through the per-venue failure path: a **syntactically invalid** edge (`23:5`, `2360`, `24:00`, `23:60`); a band whose edges are **equal** after normalisation (`23:20-23:20`); and a **plainly inverted** band (`23:25-23:20` → `(1405, 1400)`). A test asserting `unverified` for any of these is asserting the laundering this rule forbids. Do **not** reuse the `03:58-04:02` or `25:00-25:05` cases here — they are already covered by the normalisation obligation above, and repeating them would make this obligation duplicate rather than extend it
- **the `[240, 1680)` range is an invariant, so test it as one** — no valid `HH:MM` input can produce an offset outside it, which makes any "supply an out-of-range offset" test vacuous by construction. Assert the property instead: `normalise_edge` over **all 1440 clock values** lands every result in `[240, 1680)`, with both boundaries hit exactly — `04:00` → `240` (inclusive low) and `03:59` → `1679` (one below the exclusive high). The retired `[0, 2 × 1440)` bound must not appear in any test
- **`validate_return_transport` is a pipeline stage, not a test** — the whole-file validator marking a venue `{"state": "invalid", …}`, and that venue **not appearing in ranked output at any hour**, including a session ending at 13:00 that never reads `return_transport`; a venue with **no** `return_transport` block stamping `{"state": "ok"}` and still resolving `unverified` outside the core span; and a venue record whose `return_transport_status` is **absent entirely** being unranked, proving the stamp fails closed when the stage did not run
- **the stage mirrors the resolver's `MISSING` semantics** — all three absent shapes stamping `{"state": "ok"}`: no `return_transport` block; a block present with this destination/mode absent; and **a selected `default` or `by_weekday` entry present but carrying no `last_departure_band`** (e.g. `{}`). Each must then resolve `unverified` at evaluation time outside the core span, never `invalid`. A stage that calls `normalise_band` on an absent value fails this test, which is the point of it
- **the failure model is per-venue and never global** — one venue with a malformed band, and: the stage **returns successfully**; the atomic write **still happens**; every other venue is stamped `ok`, generated and ranked normally; and the malformed venue is absent from ranked output with its diagnostic present. A test in which a malformed band withholds the whole generation is asserting the rejected model
- **the removal is loud, and distinct from `unverified`** — a venue dropped at `STEP 0` appearing in a visible removal notice naming it and its `reason`; an **absent** stamp producing the "never validated" wording instead; and neither being merged into the `unverified` group, since the two have different fixes
- **`RETURN_CYCLE_LATEST_MINUTES` is resolved against the service date** — a cutoff of 1500 (01:00 next day) admitting a 00:30 session end and excluding a 01:30 one. Comparing the raw offset against an absolute minute must fail the suite
- **`bicycle_with_you` is threaded, not re-derived** — Plan B computing its return set from **Plan A's** value, so a transit trip from `origin_b` cannot gain a `cycle` return at the fallback; and a `fallbacks[].mode == "cycle"` link being **dropped as unviable** on that same trip
- **`admissible_return_modes` reads only its parameters** — the two bounds producing different admissible sets when `session_end_mid` and `session_end_upper` straddle the cycle cutoff, which is impossible if the function closes over a single shared `session_end`
- **`MAX` over admissible modes, not `MIN`** — two schedule-bound modes with different last departures resolving against the later one
- **`unverified` never unranks, and `UNKNOWN` always does** — a venue with hours `robust` and return `unverified` still appearing in the ranked output (last, in its own group) while a venue with `effective_close == UNKNOWN` does not appear at all. These two must not collapse
- **`unverified` is barred from Plan A** — a set where the only `robust`-on-hours venue has an `unverified` return produces the **second refusal**, with its own wording, not the seat-confidence one
- **either bound unverified makes the tier unverified** — the boundary case where `session_end_mid` lands inside the core span and `session_end_upper` lands outside it
- **`overall_tier` is the worse of the two** — including that a known `shorter` outranks an `unverified`, which is the ordering decision this design turns on
- **the binding limit composes both sides, and is branched exactly once** — a `COVERED` venue with a finite last departure yielding a **finite** `latest_leave_at` rather than `UNDETERMINED`; a finite close earlier than the last departure yielding `binding_constraint == "venue_close"`; both unbounded yielding `AT_LEAST(0)`, `latest_leave_at == UNDETERMINED` and `binding_constraint == "none"`; and `usable_minutes`, `surplus_*` and `latest_leave_at` all derived from `binding_limit_*` — a test must fail if any of them subtracts from a raw `effective_close_*`
- **`backup_strength` is graded on `overall_tier`** — a fallback whose hours tier is `robust` but whose `return_tier` is `shorter` grading `salvage` (or `none` below the floor) rather than `strong`, with its duration return-capped; and the same fallback with an `unverified` return capping at `salvage` and labelled as an unverified way home rather than as a short session
- **the `basis` field carries no exact times and no direction names** — a lint or review check over `venues_meta.json`, since nothing else validates a free-text field
- **the return metrics are hours-only when `return_tier` is `unverified`**, and are labelled as such rather than presented as a verified session length
- **`backup_strength` respects the return leg** — a fallback where the requested session fits but the return is `unverified` capping at `salvage`; a fallback whose `salvage` duration is the **return-capped** `usable_minutes`, not the hours-capped one
- **Plan B uses its own return data** — a fallback resolving against its own `return_transport` and its own `access[origin_a]`, never Plan A's
- **`holiday_return_policy` is independent of `holiday_policy`** — a venue with `holiday_policy: substitute_sun` and the default `holiday_return_policy: unknown` resolving `unverified` on a holiday, proving the two fields are not read from one another
- ranking order, the `shorter` split, the `unverified` split, and both "no option" conditions
- **one entry-point case per row of the ranked-and-unranked taxonomy**, asserting the group each venue lands in — including the `NONE` rows, whose answer is "ranked", so the table's exhaustiveness is mechanically checked rather than merely claimed
- **snapshot validation of `preference`** — a missing value, a malformed value, and a value duplicated across two venues, each removing exactly the venues the failure-scope table names and leaving every other venue ranked; and an assertion that no malformed or duplicated `preference` ever reaches key 6 or key 7
- **a non-`OPERATIONAL` venue** removed into its own notice, distinct from the broken-return-data notice and from the `unverified` group
- `closing_buffer_minutes` default, per-venue `holiday_policy`, per-venue `holiday_return_policy`, `wet_weather_mode` substitution, and `return_transport` band parsing (clock string to minutes, `> 1440` after midnight, `by_weekday` overriding `default`)
- area grouping, the log→venue join, and "last visit" resolved from row order

**`tests/python/` — pytest, fixture-based**, using small trimmed real responses:
- hours parsing — cross-midnight, 24-hour (no `close`), split periods, missing fields, **multi-day periods** (`day_gap` 2 and 6), **truncated endpoints** (both ends, one end, and interior truncation failing validation), and the **materialised seven-date current-hours map**
- fixtures trimmed from the saved Phase 0 payloads: a 24/7 venue with both-end-truncated current hours; a Sunday→Saturday span with clipped endpoints; a Friday→Sunday span mixed with ordinary weekday periods; and an **ordinary** venue with a truncated final-window close, which is the case proving truncation is a property of the window rather than of unusual venues. A special-closure fixture must be **synthetic and labelled so** — no saved payload contains `specialDays`
- popular-times parsing — including the collapsed `place_results` shape and the `data`-parameter retry path
- **the venues/meta merge at generation time** — merged by `id`, one flat venue list embedded, and an ID mismatch in either direction failing generation
- **venue-source registry preconditions** — a missing or empty field, a duplicate `venue_id`, a duplicate `place_id`, and either direction of ID-set disagreement with `venues_meta.json`, each failing before any API call
- **the coarsening stage's negative paths**, per "The coarsening stage"
- **the return-validator bridge** — per-venue `invalid` statuses letting generation continue, against a broken bridge (missing Node, nonzero exit, non-JSON output, a venue with no status) stopping the refresh before the atomic replace
- **`holidays.json` absent or malformed** failing generation visibly
- `unknown` vs `closed` never conflated
- independent source failure; last-known-good retention; `ok`/`stale`/`failed` assignment
- **coarsening runs before the fetch** — a new visit is stamped with the pre-fetch histogram value
- **JSON unicode-escaping** — a `notes` value containing `</script>` must not break the generated page, and must survive round-trip unchanged when parsed back out

**Generated-artifact acceptance — asserted against the real `index.html`, not assumed:**

- **no external JavaScript or CSS references** — zero `<script src=`, zero `<link rel="stylesheet"`
- **exactly one external reference in total**, the optional manifest, and the page renders and functions correctly when it is removed
- **no unresolved local imports** — no `from "./…"` or `from './…'` survives in the emitted module
- **no `fetch()` for bundled data** — the inlined JSON is read from the DOM, never requested
- **only one non-inlined asset**, the manifest, and it is referenced relatively
- **all paths relative** — no absolute `/…` href or src anywhere
- **every venue in the inlined data carries a `return_transport_status`** — asserted against the real generated `index.html`, since an unstamped record is unrankable and would silently empty the board. Assert the field exists on **all** venues, not that any particular value appears
- **an `invalid` venue's removal notice renders in the generated page** — generate from a fixture with one malformed band, then assert the emitted HTML contains the venue's name and its `reason`, and that the venue is absent from the ranked list. A diagnostic that exists only in the refresh log fails this
- **the file opens and renders correctly from `file://`**, which is the real test of every point above — and specifically that the stamp and the removal notice both survive into the AirDropped copy, since that copy has no network and no second chance to explain itself
- **no top-level name collisions** between `ranking.js` and `app.js`, since concatenation puts them in one module scope

Anything touching the network is excluded.

**Manual acceptance checklist:**
- [ ] Loads on iPhone 15 Pro Max in Safari, portrait, no horizontal scroll
- [ ] "Add to Home Screen" works from the **hosted** URL (the manifest is not inlined)
- [ ] The AirDropped single file opens from `file://` and works fully offline
- [ ] Plan A / Plan B readable one-handed without zooming
- [ ] Seat-confidence components visible without tapping through
- [ ] Per-source staleness visible without hunting
- [ ] Holiday handling stated in the UI
- [ ] A venue removed for broken return data is visibly named, with its reason, and is not confused with the `unverified` group

---

## Known problems to design around

**Popular Times is not seat availability.** It counts everyone in the geofence including the takeaway queue. A high-throughput venue can read 70% with every table free; a quiet one can read 30% with six students camped for five hours.

**The band is within-venue only.** `quiet` at a chronically packed venue can be worse than `busy` at a usually-empty one.

**"Open till 10pm" is not "study till 10pm".** That is `closing_buffer_minutes`.

**The rain toggle changes arrival time, and the way home.** `wet_weather_mode` makes the substitution explicit, but the later arrival can shift the busyness band, downgrade the feasibility tier, and change Plan B's leg — and the toggle also removes `cycle` from the **return** mode set, which can turn a settled way home into a last-departure race. Correct behaviour — but it must be *visible*, not a silent reorder.

**Public holidays are handled per venue.** Default `unknown` rather than a global Sunday substitution, which is plausible for mall cafés and wrong for kiosks and independents.

**Selection bias in the log.** I only log when I go, and I go where I expect a seat. Mitigations: log `no_seat` for venues walked past or abandoned, and surface which venue/time cells have zero observations.

**Correlated failure between neighbours.** Nearby venues share crowds, weather and events — which is why `backup_strength` is qualitative and venue probabilities are never multiplied.

**Seasonality is washed out and unrecoverable.** The histogram is a multi-month rolling average, and dropping calendar dates means the log can't recover exam periods either. (Visit *ordering* does survive; absolute dates do not.)

**Venue closure drift.** A venue vanishing from a source is a fetch failure, not a closure — so a real closure could persist as stale data if the source simply stops listing it.

**Return-transport data duplicates across venues sharing a station, and will drift.** The five Orchard venues share one interchange; their `last_departure_band` values differ only by the walk to the platform. Nothing enforces that they move together when a timetable changes. A shared station table would fix it and was rejected as premature at 28 venues — revisit if the list grows or if a timetable change is ever missed.

**The pre-dawn service gap is not modelled for a schedule-bound way home.** A session ending between 04:00 and 07:00, at one of the three 24-hour venues, is `unverified` unless a schedule-free mode (a walk, or a cycle with the bicycle) settles it first. That is the honest answer and a safe one, but it is not an answer. Closing it needs the **wait** modelled as its own outcome, with a recorded service-interval claim behind it — a separate assignment, not a field.

**A `cycle` fallback link is unusable on a trip that did not start by cycling.** 22 of the current `fallbacks[]` links are `mode: cycle`, and the bicycle is at home unless you rode it. This design threads `bicycle_with_you` so Plan B drops those links correctly; it is recorded here because it is a defect in the existing Plan B contract that this work exposed rather than introduced.

**Rain after departure is not modelled.** The toggle is set when planning, and the return leg's mode set is fixed from it. A dry-looking 18:00 that rains at midnight removes a `cycle` return the model still assumes. There is no weather source by design, so the mitigation is that the UI names the mode it is counting on.

**Cycling home late at night is treated as unconstrained.** `RETURN_CYCLE_LATEST_MINUTES` exists to bound it and is `null` until there is a real-world answer. Until then, ten venues with a home cycle route will show a verified way home at any hour.

**Holiday return service defaults to `unverified`.** Consistent with `holiday_policy`'s honest default, and it means late sessions on public holidays will refuse until someone records the pattern.

**The core-span assumption is maintained, not frozen.** It rests on a network-level norm checked on a recorded date, and LTA publishes temporary altered operating hours and substitute shuttles that this design does not model. If the norm stops holding, the shortcut must be withdrawn rather than quietly left in place.

**`baseline_seatability` is memory, not measurement, until Phase 3.** Subject to recency bias and the same selection bias as the log. Start venues at `unknown`.

---

## Build notes

**Model:** run Claude Code on `opusplan`. Reach for Opus explicitly at Phase 0 debugging (a timezone, date-boundary or parse bug will look plausible while being wrong) and at the Phase 3 pooling decision.

**`make refresh` does not commit.** Inspecting the diff, committing and pushing stay separate manual actions.

**Watch for the tipping point.** If the UI needs materially more interactive state than expected, that is the signal to port to React rather than push through.

## Venue list

**The list of venues to *resolve* lives in `data/venue_seeds.csv`, not in this document.** A markdown table cannot be read by the resolver, and the empty table this section used to hold had no column for the address that four venues need.

**It is not the fetch list.** `venue_seeds.csv` carries no `venue_id` and no Place ID, so nothing after Phase 0 can fetch from it. Phase 1's canonical list of venues to fetch is **`data/venue_sources.json`** — see "The venue-source registry". Earlier wording here read as though `venue_seeds.csv` were the venue list for the whole project; it is the resolver's input, consumed once.

### `data/venue_seeds.csv` — hand-maintained

| Column | Who | Notes |
| --- | --- | --- |
| `name` | **← you** | Exactly as it appears in Google Maps |
| `brand` | **← you** | `starbucks`, `coffee_bean`, `tim_hortons`, `independent`, … |
| `address_hint` | **← you** | **Only when the name is ambiguous.** Four venues are listed in Maps as bare "Starbucks"; the address is the sole disambiguator, and its postal code is what `phase0_resolve.py` checks the resolved match against. |

Everything else — `venue_id`, Place ID, `venue_type`, `area` — is Phase 0's job. `phase0_resolve.py` writes them to `data/phase0/place_ids.csv`, proposing a `venue_id` slug and marking it `NEEDS_SLUG` where the resolved name is a bare brand and a human has to name the branch.

**Current list: 28 venues across three brands** — 24 `starbucks`, 3 `coffee_bean`, 1 `baker_and_cook`. Ten rows was the planning-time guess; the real list is nearly three times that, which is what sets the API-volume ceiling recorded in `decisions.md`.

The non-Starbucks four are what make **Phase 0 item 2 runnable**: `coffee_bean` and `baker_and_cook` exercise the claim that one Places interface covers every brand. Two of them are pointed cases — a Coffee Bean inside West Mall, the same building as a Starbucks already on the list, tests whether the address hint disambiguates two different brands at one postal code; and `baker_and_cook` is a bakery-café rather than a coffee chain, which is where Popular Times coverage is most likely to thin out.

`baseline_seatability`, `preference`, `access`, `fallbacks`, `holiday_policy` and `wet_weather_mode` all live in `venues_meta.json`, not here. `venue_type` and `area` are recorded during Phase 0; the judgement fields (`baseline_seatability`, `preference`) are filled in by hand during Phase 1, and `baseline_seatability` starts at `unknown` for every venue.

### Running Phase 0

```bash
.venv/bin/python3 build/phase0_resolve.py --dry-run   # print queries, no API calls
.venv/bin/python3 build/phase0_resolve.py             # seeds -> Place IDs
.venv/bin/python3 build/phase0_hours.py               # hours, timezone, override horizon
.venv/bin/python3 build/phase0_busyness.py            # histograms + timezone cross-check
.venv/bin/python3 analysis/phase0_spread.py           # spread, coverage, N/P proposal
```

Each step reads the previous step's output, so they run in order. `phase0_resolve.py` stops short of choosing between competing matches — anything not marked `confident` is left for a human, because a wrong Place ID silently poisons every measurement downstream of it.

## Open questions

- ~~**What are `N` and `P`?**~~ **Measured, 2026-08-29: `N = 15`, `P = 5`.** Real Popular Times data, restricted to each venue's own open hours (excluding hours it's closed — see `decisions.md` for why that restriction was necessary), gives a median per-curve range of 54.5 points, comfortably over the ~20-point flat-curve threshold — banding will discriminate. `N`'s grid search resolved cleanly; `P`'s never bracketed an answer (every candidate down to 0 already fit), so `P = 5` was set by eyeballing four real curves of different shapes instead — see `decisions.md`, 2026-08-29, "`P = 5`, set by eyeballing real curves."
- ~~**Is `MIN_HISTOGRAM_HOURS = 6` right?**~~ **Confirmed generous, 2026-08-29.** Real per-venue-per-weekday coverage after open-hours filtering ranged 10–24 buckets ([data/phase0/spread_report.md](data/phase0/spread_report.md), regenerated after the filtering-bug fix in `decisions.md`); the lowest observed curve still cleared 6 by well over half again. No data pushed against this floor.
- **Is `FEASIBILITY_TOLERANCE_MINUTES = 15` right?** Provisional. Too large and `tight` swallows genuine shortfalls; too small and it collapses back to the hard cliff.
- **Are `PLAN_B_MIN_SESSION_MINUTES = 90` and `PLAN_B_MIN_CONFIDENCE = mixed` right?** Provisional. The first few times Plan A actually fails will show whether 90 minutes is worth the trip.
- **Is `SEAT_CHECK_BUFFER_MINUTES = 10` right?** Provisional.
- ~~**Does `very_quiet` earn a place?**~~ **Evidence found, 2026-08-29** — several venues show repeatable troughs ≥`2N` below their median on 6+ of 7 weekdays (`decisions.md`). The fact-finding this question asked for is done; **whether to actually adopt the band is a separate decision, deliberately left for Phase 1** (`CLAUDE.md`) rather than settled by Phase 0's evidence alone.
- ~~**Do `hours_timezone` and `histogram_timezone` agree?**~~ **Confirmed, 2026-08-29: yes, both `Asia/Singapore`.** `hours_timezone` read directly from the Places API; `histogram_timezone` has no field to read, so confirmed indirectly (first non-zero busyness hour vs. each venue's own opening hour) — 0h offset on every eligible venue, no exceptions.
- ~~Do any venues close after midnight, run 24 hours, or have split periods?~~ **Answered, 2026-08-29: yes to the first two, no to split periods** — 3 venues run 24 hours, several close after midnight, no split-period days observed. The real finding here wasn't on this checklist: **3 venues run a single period spanning several calendar days**, which breaks `resolve_hours`'s one-day lookback as written. See item 6 above and `CLAUDE.md`.
- ~~Do all venues have Popular Times data?~~ **Answered, 2026-08-29: 26 of 28.** The 2 without are `starbucks-singhealth-tower` and `starbucks-utown` — confirmed absent by checking Google Maps directly, not just an empty API response. Worth correcting the guess this question was built on: independents were **not** the ones missing data — `baker_and_cook`, the one non-chain-feeling venue in the set, returned a full histogram on the first try.
- Is a per-venue `closing_buffer_minutes` ever needed, or does the global 30 hold?
- ~~**Are `RETURN_CORE_FROM_MINUTES = 420` and `RETURN_CORE_UNTIL_MINUTES = 1290` right?**~~ **Basis recorded, 2026-08-30**, with source, checked date, scope and a re-check rule — see "The core service span waives the timetable lookup, never the route". They remain a *maintained assumption* rather than a frozen invariant; the standing task is the **annual re-check**, not the original question. The route prerequisite is separate and unconditional, so the span can never manufacture a way home on its own.
- **Is `RETURN_TOLERANCE_MINUTES = 10` right?** Provisional, and deliberately tighter than `FEASIBILITY_TOLERANCE_MINUTES` because the consequence of being wrong is a taxi rather than a shorter session.
- **Should `RETURN_CYCLE_LATEST_MINUTES` be set, and to what?** Currently `null`, meaning cycling home is treated as available at any hour. This is a real-world judgement about riding home late at night, not something the data can answer, and it changes the verdict for the ten venues with a home cycle route.
- **Is the return destination always `origin_a`?** Assumed yes — sessions end by going home. `return_transport` is keyed by destination so the assumption can be lifted with a UI control rather than a schema change.
- **Should the outbound mirror be modelled** — whether transport still runs *to* a venue at a late departure time? Same data shape, other direction. Deliberately out of scope here; flagged for its own assignment.
- **How many fallback links are actually needed**, and does the hand-maintained set stay maintainable as brands are added?
- ~~**How many venues in total?**~~ **Answered: 28** — 24 `starbucks`, 3 `coffee_bean`, 1 `baker_and_cook`, final. The consequences are recorded in `decisions.md` — a SerpApi ceiling of 4–8 refreshes a month on the free tier (1–2 calls per venue depending on whether a retry is needed, not a flat count), and 28 venues of hand-maintained meta whose *cross-venue ordinal ranks* are the part that will not scale. Both were open questions; neither is a blocker for Phase 0.
