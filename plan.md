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
│   ├── venue_seeds.csv         # HAND-MAINTAINED input: name, brand, address_hint
│   ├── phase0/                 # Phase 0 outputs; phase0/raw/ gitignored
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
| `strong` | a fallback where **the requested session fits** — `robust` or `tight` at its delayed arrival — with confidence at least `PLAN_B_MIN_CONFIDENCE` |
| `salvage` | at least `PLAN_B_MIN_SESSION_MINUTES` remains and confidence is at least `PLAN_B_MIN_CONFIDENCE`, **but the requested session does not fit** |
| `none` | less than `PLAN_B_MIN_SESSION_MINUTES` remains, or confidence is below `PLAN_B_MIN_CONFIDENCE`, or no fallback is valid at all |

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

`latest_leave_at` answers "when must I leave for the session to still fit". It does **not** account for the busyness band worsening at a later arrival.

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

This replaces the hard cliff at `surplus >= 0`, which relegated 5h59m while ranking 6h00m despite the boundary being noisier than the arithmetic implied.

---

## The ranking pipeline

1. **Hard filter — reachability.** A **missing** `access` entry for the selected origin/mode means the mode isn't viable there. Excluded.
2. **Hard filter — open on arrival**, at that venue's own arrival, against its active period.
3. **Feasibility tier** — `robust` before `tight`; `shorter` moves to its own group.
4. **`seat_confidence` tier**, best first.
5. **`backup_strength`**, `strong` → `salvage` → `none`.
6. **Travel burden** (`travel_minutes_mid`), least first.
7. **`preference`**, best first.
8. **`surplus_mid`**, most first — final tiebreak only.

Feasibility comes first because a venue that can't hold the session isn't a candidate at any confidence. Seat confidence is next because it is the objective. Backup strength ranks above travel because the whole point is minimising the cost of being wrong.

A **thin-margin warning** appears on any `tight` venue.

### Venues that cannot be ranked

An `access` entry of explicit `null` means *not yet measured*. Without travel time there is no `venue_arrival`, so nothing downstream is computable. These sit in a **separate "travel time unknown" group**, never interleaved.

### Missing busyness never removes a venue

If the histogram is missing or below `MIN_HISTOGRAM_HOURS`, `relative_busyness` is `unknown`, and `seat_confidence` falls back to `baseline_seatability` alone with a **visible lower-evidence warning**.

**It is not treated as `typical`.** Absence of evidence is recorded as absence, not as an average.

### The tool is allowed to say no

When no venue reaches at least `mixed` confidence, the correct output is:

> **No low-risk option found for the requested session.**

...shown with the reasons and the best of a bad set, rather than promoting something weak into Plan A. A confident-looking recommendation built on nothing is worse than an honest refusal.

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
- rain and `wet_weather_mode` effects on a leg that may differ from the origin leg

Plan B is not a simplified calculation. Anything less and the fallback would be recommended on weaker evidence than the option it is meant to rescue.

### Plan B viability floor

Both thresholds are **provisional**:

- **`PLAN_B_MIN_SESSION_MINUTES = 90`** — below an hour and a half the trip isn't worth making.
- **`PLAN_B_MIN_CONFIDENCE = mixed`** — a `poor` or `unknown` fallback is not a plan.

These set the floor for `salvage`. Clearing the floor is **not** the same as satisfying the request: a fallback only reaches `strong` when the requested session actually fits. If nothing clears the floor, `backup_strength` is `none` and the UI says so rather than inventing a fallback.

### Presentation

A `strong` Plan B — the requested session survives:

```
Plan A
Starbucks Holland Village
High seat confidence · full 6h session · 27m from origin
Baseline: dependable · Adjustment: typical for this venue

If full: Plan B
Coffee Bean Holland Village
6-10m from Plan A · medium confidence · full 6h session
Baseline: usually available · Adjustment: busy for this venue
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

**Result:** Plan A and Plan B, then "More alternatives" expanding to the full ranked list grouped by area — each row showing `seat_confidence` with its two components, feasibility tier, `usable_minutes`, `latest_leave_at`, travel, `backup_strength`, preference, and my own visit history (Phase 2). Tap a venue for its day curve with the session window shaded.

### Constraints — write vanilla in a React-shaped way

1. **One state object. Never read state back out of the DOM.**
2. **One `render(state)` function.**
3. **Pure data functions in `ranking.js`, importing nothing DOM-related** — ranking, time and date arithmetic, hours resolution, active-period lookup, the busyness band, the `seat_confidence` lookup, feasibility tiers, Plan B recalculation, backup strength, the venues/meta merge, holiday policy, area grouping, the log→venue join.
4. **CSS in a stylesheet with plain class names.**

`ranking.js` stays a real file specifically so `node --test` can import it; the generator copies its contents into the artifact.

---

## Data contracts

**Generated files and hand-maintained files are separate.** `refresh.py` rewrites `venues.json` wholesale, so anything hand-typed there would be destroyed by a refresh. They are merged by `id` at generation time.

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

`business_status` catches permanently-closed or relocated venues — surfaced loudly, never silently ranked.

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

Hours are handled separately, by the resolution order above.

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
fetch_hours(place_id) -> Hours          # official source, reliable
fetch_busyness(place_id) -> Histogram   # SerpApi, fragile
```

**Neither fetcher writes `venues.json`.** `build/refresh.py` solely owns it, and **order matters**:

1. **Coarsen new raw visits from iCloud first**, joining each against the **currently deployed** histogram — the one about to be replaced. This is the only step that can capture "busyness in effect at visit time"; running it after the fetch would stamp every new visit with the *new* histogram value and silently destroy the lineage the Phase 3 join depends on.
2. Call both fetch interfaces for all venues, catching failures per source and per venue.
3. **Validate** against the contract.
4. **Merge** with existing `venues.json`, retaining **last-known-good** for any failed source.
5. Record `last_attempt_at`, `last_success_at`, `status` per source.
6. Write to a temp file and **replace atomically** only after validation passes.
7. Regenerate `web/index.html` — inline the data (unicode-escaping every `<`), `ranking.js` then `app.js` into one module script with `app.js`'s import stripped, and `style.css`.

A busyness failure still refreshes hours, and vice versa. Degradation must be visible.

**A venue vanishing from a source is not a closure.** That is `status: failed` (or `stale`) with last-known-good retained and a loud warning. Only an explicit `businessStatus` may mark a venue closed.

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
- Feasibility tier shown; thin-margin warning on `tight`.
- Per-source freshness with `ok` / `stale` / `failed` distinguished.
- Missing busyness falls back to baseline with a lower-evidence warning — **never treated as `typical`**.
- "No low-risk option found for the requested session" when nothing reaches `mixed`.
- `shorter` venues in their own group; unrankable venues in theirs.
- `unknown` hours distinct from `closed`; non-`OPERATIONAL` venues flagged loudly.
- Holiday policy applied per venue and stated in the UI.
- Alternatives grouped by area; `latest_leave_at` shown.

**Acceptance, in two parts** — because every venue starts at `baseline_seatability: unknown`, which correctly yields no Plan A at all:

1. **With no baselines assessed**, the app returns "No low-risk option found for the requested session", showing the candidates and why each is unknown. This is the correct behaviour, not a failure.
2. **Once at least one venue has an assessed baseline**, the app produces a Plan A, and a Plan B where a viable fallback exists, and I can see why each was chosen — without thinking hard.

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
- ranking order, the `shorter` split, and the "no low-risk option" condition
- venues/meta merge, `closing_buffer_minutes` default, per-venue `holiday_policy`, `wet_weather_mode` substitution
- area grouping, the log→venue join, and "last visit" resolved from row order

**`tests/python/` — pytest, fixture-based**, using small trimmed real responses:
- hours parsing — cross-midnight, 24-hour (no `close`), split periods, missing fields, **multi-day periods** (`day_gap` 2 and 6), **truncated endpoints** (both ends, one end, and interior truncation failing validation), and the **materialised seven-date current-hours map**
- fixtures trimmed from the saved Phase 0 payloads: a 24/7 venue with both-end-truncated current hours; a Sunday→Saturday span with clipped endpoints; a Friday→Sunday span mixed with ordinary weekday periods; and an **ordinary** venue with a truncated final-window close, which is the case proving truncation is a property of the window rather than of unusual venues. A special-closure fixture must be **synthetic and labelled so** — no saved payload contains `specialDays`
- popular-times parsing
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
- **the file opens and renders correctly from `file://`**, which is the real test of every point above
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

---

## Known problems to design around

**Popular Times is not seat availability.** It counts everyone in the geofence including the takeaway queue. A high-throughput venue can read 70% with every table free; a quiet one can read 30% with six students camped for five hours.

**The band is within-venue only.** `quiet` at a chronically packed venue can be worse than `busy` at a usually-empty one.

**"Open till 10pm" is not "study till 10pm".** That is `closing_buffer_minutes`.

**The rain toggle changes arrival time.** `wet_weather_mode` makes the substitution explicit, but the later arrival can shift the busyness band, downgrade the feasibility tier, and change Plan B's leg. Correct behaviour — but it must be *visible*, not a silent reorder.

**Public holidays are handled per venue.** Default `unknown` rather than a global Sunday substitution, which is plausible for mall cafés and wrong for kiosks and independents.

**Selection bias in the log.** I only log when I go, and I go where I expect a seat. Mitigations: log `no_seat` for venues walked past or abandoned, and surface which venue/time cells have zero observations.

**Correlated failure between neighbours.** Nearby venues share crowds, weather and events — which is why `backup_strength` is qualitative and venue probabilities are never multiplied.

**Seasonality is washed out and unrecoverable.** The histogram is a multi-month rolling average, and dropping calendar dates means the log can't recover exam periods either. (Visit *ordering* does survive; absolute dates do not.)

**Venue closure drift.** A venue vanishing from a source is a fetch failure, not a closure — so a real closure could persist as stale data if the source simply stops listing it.

**`baseline_seatability` is memory, not measurement, until Phase 3.** Subject to recency bias and the same selection bias as the log. Start venues at `unknown`.

---

## Build notes

**Model:** run Claude Code on `opusplan`. Reach for Opus explicitly at Phase 0 debugging (a timezone, date-boundary or parse bug will look plausible while being wrong) and at the Phase 3 pooling decision.

**`make refresh` does not commit.** Inspecting the diff, committing and pushing stay separate manual actions.

**Watch for the tipping point.** If the UI needs materially more interactive state than expected, that is the signal to port to React rather than push through.

## Venue list

**The list lives in `data/venue_seeds.csv`, not in this document.** A markdown table cannot be read by the resolver, and the empty table this section used to hold had no column for the address that four venues need.

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
- **How many fallback links are actually needed**, and does the hand-maintained set stay maintainable as brands are added?
- ~~**How many venues in total?**~~ **Answered: 28** — 24 `starbucks`, 3 `coffee_bean`, 1 `baker_and_cook`, final. The consequences are recorded in `decisions.md` — a SerpApi ceiling of 4–8 refreshes a month on the free tier (1–2 calls per venue depending on whether a retry is needed, not a flat count), and 28 venues of hand-maintained meta whose *cross-venue ordinal ranks* are the part that will not scale. Both were open questions; neither is a blocker for Phase 0.
