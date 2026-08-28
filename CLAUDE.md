# CLAUDE.md

Personal tool for deciding which Singapore Starbucks to study at, given a 3-6 hour session and where I'm starting from. Read [plan.md](plan.md) first — it is the spec and the architecture doc; don't duplicate it here. Log decisions and deviations in [decisions.md](decisions.md).

## Workflow

- **Solo project. No cross-agent coordination.** There is no primary/reviewer split, no `HANDOFF.md`, no `reviews/` directory, no role preflight. Other projects on this machine use that pattern; this one deliberately does not. Don't import it.
- Run on `opusplan`. Enter plan mode at the start of each phase — that's what makes Opus engage; without it this session runs on Sonnet.
- Before writing code for a phase, critique plan.md against the repo and environment as they exist right now, not as assumed when the plan was written. Say what's wrong before implementing around it.
- Work one phase at a time, in order (0 → 1 → 2 → 3). Don't build ahead — no Phase 2 seat-logging scaffolding while Phase 1 is open.

## Python environment

`.venv/` plus `requirements.txt`. **Always invoke as `.venv/bin/python3` (or `.venv/bin/pytest`) — never bare `python3` or `pytest`.** On this machine a bare `python3` resolves to `/Users/darrensy/anaconda3/bin/python3`, which lacks this project's dependencies and fails with `ModuleNotFoundError`. This trap has already been hit in another project here.

## Non-negotiables (see plan.md for the reasoning)

- **No backend, no server, no API keys shipped in `web/`.** Static files only, deployed to GitHub Pages from this public repo. Fetcher credentials live in a gitignored `.env` on the Mac.
- **No live data of any kind** — no real-time busyness, no weather API, no transit API. Rain is a manual toggle in the UI.
- **`data/stores_meta.json` and `data/holidays.json` are hand-maintained and must never be written by a script.** The scrapers rewrite `data/stores.json` wholesale; if hand-entered facts (preference, travel times, seating notes) lived in that file, every refresh would clobber them. The two are merged by `id` in the browser at load time.
- **Two independent fetch interfaces** — `fetch_hours(place_id)` from an authoritative source, `fetch_busyness(place_id)` from SerpApi. They fail independently: a busyness failure still writes hours. Never take opening hours from the busyness scrape or a third-party aggregator.
- **Busyness is a tiebreaker, not a gate.** A store with missing histogram data is still ranked on hours, reachability and preference, and flagged. The fragile source must never make the reliable ones unusable.
- **Seat log outcomes are `seat` | `no_seat`.** Two values. The committed `data/seatlog.csv` is deliberately coarsened to `(store_id, day_of_week, hour, outcome)` — the calendar date is dropped because the repo is public and a dated café log is a movement history. The raw dated file stays in iCloud Drive, gitignored, and is append-only — never rewrite it from code.
- **Vanilla HTML/CSS/JS in `web/`** — no framework, no build step. Follow the four constraints in plan.md's "Constraints — write vanilla in a React-shaped way", especially: pure logic goes in `ranking.js` with no DOM imports.

## Testing

Unit tests cover the pure functions in `web/ranking.js` only — `usable_hours` (including closing-buffer and past-closing edges), ranking order, the stores/meta merge, holiday detection, and the log/histogram join. The fetchers and `analysis/calibrate.py` are manually-run solo scripts; they get no test scaffolding beyond failing loudly.
