# starbucks-planner

Personal tool for picking which Singapore Starbucks to study at. Answers one question:

> It's 4pm and I want to study for 3-6 hours. I'm at work. Where do I go?

Roadmap, architecture, and data contracts: `plan.md`. Working conventions and non-negotiables:
`CLAUDE.md`. What got decided and why: `decisions.md`. Which Claude Code plugins and skills this
project uses: `skills.md`.

## What it actually does

Sessions run three to six hours, and that length is what makes the problem non-obvious. **Closing
time is usually the binding constraint, not how busy a store is** — a store that closes at 9pm is
useless at 4pm no matter how empty it is. So the tool filters on hours and travel first, and only
uses busyness to break ties between stores that already work.

It combines four things, in decreasing order of how much they can be trusted:

1. **Opening hours** from an authoritative source — the hard filter.
2. **Google Popular Times** — a slow-moving weekly busyness curve, used only for the arrival hour.
   Once you have a seat you keep it, so how crowded it gets at hour four doesn't matter.
3. **Hand-maintained store facts** — travel minutes by origin and mode, personal preference,
   seating and wifi. Nothing scrapes these and over six hours they matter more than a few
   busyness points.
4. **A personal seat log** — what actually happened when you showed up. Busyness counts everyone
   in the geofence including the takeaway queue, so it is not seat availability; the log is the
   correction.

The output is a ranked list, not a heatmap: pick a day, arrival time, duration, origin and travel
mode, and see which stores survive, how many of your requested hours each actually gives you, and
what it costs to get there.

## How it's built

Two halves, deliberately kept apart:

- **Python scripts run by hand on the Mac** fetch hours and busyness, and write JSON into `data/`.
- **A static page** reads that committed JSON. Vanilla HTML/CSS/JS, no framework, no build step,
  deployed to GitHub Pages.

Nothing is fetched at request time. The data changes slowly, so generating it locally and
committing it means the deployed page has no runtime dependencies and can't break because Google
changed its markup. When a fetcher breaks it breaks on the laptop, not in front of you on a
Saturday morning.

Seat logging is an Apple Shortcut writing to a CSV in iCloud Drive — two taps, because anything
slower won't get used.

## Status

**Nothing is built yet.** The repo currently holds the plan and its supporting docs. The next step
is Phase 0 in `plan.md`, which is blocked on filling in the ten stores and their Google place IDs.

Once there is code, setup will be a standard venv:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Always invoke Python via `.venv/bin/python3` — a bare `python3` on this machine resolves to an
Anaconda install that won't have this project's dependencies.

## A note on scope

This is a personal tool making roughly ten requests a month. Automated scraping of Google Maps is
against Google's terms of service, so while the repo is public, this should not be run as a
product or a service in this form.
