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

---

## Open — to be resolved in Phase 0

**Hours source.** Two authoritative candidates; hours must not come from the busyness scrape or a third-party aggregator.

1. **Starbucks SG store locator** (`starbucks.com.sg/stores/`) — the operator's own data, free, no API key. The page is a JS app and the store data loads from an endpoint not visible in the HTML; finding it needs one DevTools Network-tab session. **Try this first.**
2. **Google Places API Place Details** — returns `regularOpeningHours`, `currentOpeningHours` (holiday overrides, 7-day horizon) and `businessStatus`. Official and ToS-clean. **Unresolved cost question:** the opening-hours fields are billed under the *Enterprise* SKU; the 10,000-free-calls figure found during planning applies to *Essentials*, and no free Enterprise allowance was confirmed. Worst case ~$0.25/month at 10 calls, but needs a GCP billing account. Check live pricing before committing.

Note: the Places API does **not** expose popular times. It does expose opening hours. These are two different questions and the API answers only one of them.
