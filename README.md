# study-venue-planner

Personal tool for picking a coffee venue to study at in Singapore. It answers:

> It's 4pm and I want to study for 3-6 hours. I'm at work. Where do I go — and where do I go if
> that's full?

Roadmap, architecture, and data contracts: `plan.md`. Working conventions and non-negotiables:
`CLAUDE.md`. What got decided and why: `decisions.md`. Which Claude Code plugins and skills this
project uses: `skills.md`.

## What it actually does

The goal is **a high chance of getting a suitable seat for the whole session, and a small penalty
when that's wrong.** The failure worth designing around is travelling 40 minutes, finding no seat,
and having to travel somewhere else. That costs far more than picking a slightly worse venue.

So the output isn't a list — it's a **plan**:

- **Plan A**, the recommended venue.
- **Plan B**, the best fallback *if Plan A has no seat* — recalculated from Plan A, not just second
  place. By the time you need it you're standing in Plan A, ten minutes later than you planned, so
  Plan B is re-checked from there with the same arithmetic as Plan A: still open? still gives you the
  session you asked for? A fallback that only rescues part of the session is labelled a **salvage**
  option and tells you the real duration — "gives 1h40m, not the 6h you asked for" — rather than
  pretending it's an equivalent backup.
- **More alternatives** behind an expander.

### How a recommendation is reached

Four inputs, each answering a different question:

1. **Opening hours** (Google Places) — a feasibility constraint. A venue closing at 9pm is useless at
   4pm no matter how empty it is. Hours rule venues out; they don't make one better than another.
2. **Baseline seatability** — hand-maintained, per venue: *dependable*, *usually available*,
   *mixed*, *poor*, or *unknown*. How reliably that venue seats you in absolute terms. This is the
   only signal that compares venues to each other, until there's enough logged data to do better.
3. **Google Popular Times** — the historical weekly curve, not live busyness. It's normalised to each
   venue's own peak, so 60% at one venue and 60% at another describe different rooms. It's used only
   as a **within-venue** adjustment: *is this an unusually good or bad time for this place?* It
   cannot tell you whether one venue is likelier to seat you than another, and nothing in this tool
   pretends otherwise.
4. **A personal seat log** — what actually happened when you showed up. Useful from the first entry
   as a memory aid, and eventually the only thing that can turn any of this into a real probability.

Baseline and busyness combine into a qualitative **seat confidence** tier. The reasoning is always
shown, never just the verdict:

```
Medium seat confidence
Baseline: usually available
Adjustment: busy for this venue
```

There are no numerical probabilities yet — those need real outcome data to earn. And when every
option is poor or unassessed, the tool says **"no low-risk option found"** rather than dressing up a
weak choice as a confident one.

## Multiple coffee brands

Scope isn't just Starbucks — it covers Coffee Bean & Tea Leaf, Tim Hortons, and potentially
independent cafés. Since no code exists yet, the data model is brand-neutral from the start:
everything is a *venue*, never a *store*. The repo keeps its original name for now.

This is also why hours come from Google Places rather than a chain's own store locator: Places gives
one consistent interface across every brand, where brand-specific locators would mean a separate
fragile scraper per chain.

## How it's built

Two halves, deliberately kept apart:

- **Python scripts run by hand on the Mac** fetch hours and busyness. A single orchestrator
  validates and merges them into `data/`, keeping the last good copy when a source fails.
- **A static page**, with the data inlined directly into it. Vanilla HTML/CSS/JS, no framework, no
  npm, deployed to GitHub Pages.

The generated page is **self-contained** — the data, the JavaScript and the CSS are all written into
`index.html` when it's generated. It loads **no external assets except an optional web app manifest,
and works completely without that**. It opens straight from a file, needs no local server to develop
against, and can be saved to a phone and used with no signal.

The source files stay separate and hand-edited; only the generated artifact is a single file. The
manifest is the one thing that can't be reliably inlined in Safari, so it stays separate — which
costs nothing except that "Add to Home Screen" needs the hosted version rather than the saved copy.

The data changes slowly, so generating it locally and committing it means the deployed page has no
runtime dependencies and can't break because Google changed its markup. When a fetcher breaks it
breaks on the laptop, not in front of you on a Saturday morning.

Seat logging is an Apple Shortcut writing to a CSV in iCloud Drive — two taps, because anything
slower won't get used.

## Status

**Phase 0 is closed.** 28 venues in Singapore across Starbucks, Coffee Bean & Tea Leaf and Baker &
Cook were resolved to Place IDs, their hours and Popular Times histograms fetched, and `N`/`P` set
from the real measured curves. See `plan.md`'s Phase 0 section and `decisions.md` for the full
record, including two real bugs found and fixed in the spread analysis after an independent review.
`data/venues_meta.json` carries `venue_type`/`area` for all 28. **Phase 1 is next** — fetchers, the
refresh orchestrator, and Plan A/B — and it opens with one unresolved design question:
`resolve_hours`'s one-day lookback can't handle the 3 venues whose opening period spans multiple
calendar days (see `CLAUDE.md`).

The probe scripts that produced Phase 0's data:

| Script | Answers |
| --- | --- |
| `build/phase0_resolve.py` | Which Place ID is each venue? |
| `build/phase0_hours.py` | Opening hours, timezone, how far date overrides reach, and whether any venue closes after midnight, runs 24h, or splits its day |
| `build/phase0_busyness.py` | Do the Popular Times histograms exist, and what timezone are they in? |
| `analysis/phase0_spread.py` | How much do the curves actually vary — and what should `N` and `P` be? |

Both API keys are already set up locally (see [Getting the two API keys](#getting-the-two-api-keys)
below if setting up fresh). The SerpApi key was exposed in this repo's development transcript twice
during Phase 0 (a `.env` diff, and a bug in the busyness fetcher's error handling, both fixed) —
**it was rotated 2026-08-29** and the exposed key is no longer valid.

Setup:

```bash
/Users/darrensy/anaconda3/bin/python3 -m venv .venv
.venv/bin/python3 -m pip install -r requirements.txt
.venv/bin/python3 build/phase0_resolve.py --dry-run   # works with no key
```

Always invoke Python via `.venv/bin/python3` — a bare `python3` on this machine resolves to an
Anaconda install that won't have this project's dependencies.

## Getting the two API keys

Both are free at this project's volume. Figures below were verified 2026-08-29; check them again
before enabling billing, because they have changed before.

### 1. Google Places API — opening hours

A billing account with a real card is required **even though the bill is $0**. Google will not serve
the Enterprise-tier fields without one.

1. **Create a project** at [console.cloud.google.com](https://console.cloud.google.com) — top bar
   project selector → *New project*. Name it anything; `study-venue-planner` is fine.
2. **Link a billing account** — *Billing* → *Link a billing account* → create one, card required.
3. **Enable the API** — *APIs & Services* → *Library* → search **"Places API (New)"** → *Enable*.
   **Enable the one labelled "(New)", not the legacy "Places API".** They are separate products with
   different endpoints, and `scraper/places.py` calls the new one
   (`places.googleapis.com/v1/places:searchText`).
4. **Create the key** — *APIs & Services* → *Credentials* → *Create credentials* → *API key*.
5. **Restrict it** — edit the key → *API restrictions* → *Restrict key* → tick **Places API (New)**
   only. A leaked unrestricted key can be spent against every Google API on the project.
6. **Cap the blast radius** — *APIs & Services* → *Places API (New)* → *Quotas* → set a daily request
   cap (200/day is roomy; a full refresh uses 28). This is what stops a loop bug from becoming a
   bill. Add a budget alert under *Billing* → *Budgets & alerts* as a second line of defence.
7. Paste into `.env` as `GOOGLE_PLACES_API_KEY`.

**Why a billing account is unavoidable:** the Places API bills per *field tier*, and one request is
charged against every tier its field mask touches. This project's mask spans all three:

| Tier | Fields this project requests | Free per month |
| --- | --- | --- |
| Essentials | `id`, `formattedAddress`, `location` | 10,000 |
| Pro | `displayName`, `businessStatus`, `utcOffsetMinutes`, `timeZone` | 5,000 |
| **Enterprise** | **`regularOpeningHours`, `currentOpeningHours`** | **1,000** |

So one refresh of 28 venues costs 28 events in *each* tier. **Enterprise is the binding limit at
1,000/month — about 35 refreshes.** Comfortably free at a weekly cadence.

### 2. SerpApi — Popular Times histograms

1. Sign up at [serpapi.com/users/sign_up](https://serpapi.com/users/sign_up) and verify your email.
2. Copy the key from *Dashboard* → *Your Account* → *API Key*.
3. Paste into `.env` as `SERPAPI_KEY`.

No card needed. The free plan is **250 searches/month**, throttled to **50/hour**.

**SerpApi is the binding constraint on refresh frequency, not Google.** Cost per venue is 1 call
when a search resolves straight to a working histogram, 2 when a `data`-parameter retry is needed —
see `decisions.md`, 2026-08-29, "Popular Times coverage, take two," for why the retry exists: an
empty `popular_times` on the first response is not reliable evidence the venue lacks one. At 28
venues that's **4–8 refreshes a month** depending on how many need the retry that day — weekly fits
either way, daily does not and is not close.

### Then

```bash
cp .env.example .env      # fill in both keys
.venv/bin/python3 build/phase0_resolve.py
```

`.env` is gitignored. This repo is public — never commit a key, and never let one reach `web/`.

Nothing in `web/` exists yet; that's Phase 1.

## A note on scope

This is a personal tool making a few dozen requests a month. Automated scraping of Google Maps is
against Google's terms of service, so while the repo is public, this should not be run as a
product or a service in this form.
