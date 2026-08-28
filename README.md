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

**Nothing is built yet.** The repo currently holds the plan and its supporting docs. The next step
is Phase 0 in `plan.md`, which is blocked on one thing only: **a list of venue names as they appear
in Google Maps, plus each one's brand.** Nothing else is needed to start — Place IDs, stable venue
ids, venue types and areas are all Phase 0's job to resolve and record.

Once there is code, setup will be a standard venv:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Always invoke Python via `.venv/bin/python3` — a bare `python3` on this machine resolves to an
Anaconda install that won't have this project's dependencies.

## A note on scope

This is a personal tool making a few dozen requests a month. Automated scraping of Google Maps is
against Google's terms of service, so while the repo is public, this should not be run as a
product or a service in this form.
