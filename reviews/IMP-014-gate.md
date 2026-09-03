# Gate record: IMP-014

## Gate invocation 1 — 2026-09-03

- **Gate route**: `claude_sonnet`, effort high
- **Brief source**: generated from HANDOFF.md acceptance criteria + required verification — reran
  `.venv/bin/python3 .cross-agent-workflow/gate_brief.py HANDOFF.md` myself and confirmed its output
  matches the brief I was handed byte-for-byte; no laundering detected.

### Checks run

- `git log --oneline -5` and `git status --porcelain` from repo root: baseline commit `01bd0f4`
  confirmed as the immediate parent of the allocation commit (`5e2b31c`, "Allocate IMP-014...").
  Working tree diff is exactly: `M HANDOFF.md`, `?? data/venues.json`, `?? web/index.html` — matches
  the brief's artifact list exactly, no stray files. `git diff --stat` confirms `HANDOFF.md`'s only
  change is the assignment block (3 fields updated: `Artifact under review`, `Required verification`,
  `Next action`); no other tracked file touched, confirming the "no code changes" claim independently
  rather than trusting it.
- **`HANDOFF.md` internal consistency and 25-line cap**: `## Current assignment` block is 15 lines
  (header through `Next action`), well inside the 25-line cap. Fields are internally consistent —
  `Route triggers` names money/external-side-effects, `Verification route` is `codex_terra`, and
  `Next action` correctly states the money trigger routes to `review_requested` even on
  `GATE_PASS`, matching `WORKFLOW.md`'s hard-trigger table.
- **`data/venues.json`, computed independently** (not trusting the brief's counts): parsed the file
  myself (`{hours_timezone, histogram_timezone, venues}` wrapper, 28 entries). Counted
  `hours.status`, `histogram.status`, and `return_transport_status.state` (a nested object, not a
  bare string — checked its actual shape rather than assuming) across all 28: **28/28 `ok`** on all
  three axes, **0** non-`ok`/`invalid`/missing. `business_status` is `OPERATIONAL` for all 28.
  28 unique `id` values, no duplicates. Timestamps (`last_attempt_at`/`last_success_at` ≈
  `2026-09-03T22:03:36+08:00`, `current_hours_valid_from: 2026-09-03`) are consistent with a live run
  on the stated date, roughly two hours after the baseline commit's timestamp (19:56:28 +0800) —
  plausible, not contradictory.
- **`web/index.html`, extracted and parsed myself**: exactly 3 `<script type="application/json">`
  blocks (`data-venues`, `data-holidays`, `data-seatlog`), each parses as valid JSON with Node's
  `JSON.parse` — no exception. Grepped each raw (pre-parse) block for a literal `</script` sequence:
  **none found** in any of the three. `data-venues` holds 28 entries with the meta fields
  (`brand`, `venue_type`, `area`, `baseline_seatability`, `access`, `fallbacks`, `preference`,
  `closing_buffer_minutes`, `holiday_policy`) merged onto the fetched fields — confirms the
  Python-side `venues_meta.json` merge actually ran for this live artifact, not just that
  `data/venues.json` (which correctly omits meta, by design) looks fine in isolation.
  `data-holidays` has 11 entries, `data-seatlog` is empty (no seat-log entries yet, expected —
  Phase 2 hasn't started).
- **Generated-artifact assertions (`PLAN.md:2429-2440`), checked against the real live file myself**,
  not inferred from the fixture-based pytest suite passing: zero `<script src=`, zero
  `<link rel="stylesheet"`, exactly one external reference (`<link rel="manifest"
  href="./manifest.webmanifest">`, relative), zero unresolved `from "./…"` imports, zero `fetch(`
  calls, zero `localStorage` usage, zero absolute (`/…`) paths, exactly one
  `<script type="module">` block (confirming the ranking.js+app.js concatenation happened once, not
  duplicated). Every venue in the inlined data carries `return_transport_status` (checked above).
  No removal-notice check applicable — 0 venues were removed/invalid on this run, so there is no
  removal notice to find in the page (correctly nothing to assert here, not a gap).
- **Independently reran `.venv/bin/pytest tests/python/ -q`** — **188 passed**, matches the brief
  exactly, "unaffected" claim confirmed.
- **Independently reran `node --test tests/js/*.test.js`** — **184 passed**, matches the brief
  exactly.
- **Scenario A and B, reproduced from scratch with my own script**, not the primary's — imported
  `rankVenues` from `web/ranking.js` directly, read `web/app.js`'s `readControlsFromForm()` first to
  get the exact controls field set (`origin`, `mode`, `raining`, `departureDate`, `leaveAtMinutes`,
  `durationMinutes`, `toleranceMinutes`), and ran it against the real embedded `data-venues` /
  `data-holidays` extracted from the live `web/index.html`:
  - Scenario A (`origin_b`, `transit`, `departureDate: 2026-09-03`, `leaveAtMinutes: 540`,
    `durationMinutes: 300`, `toleranceMinutes: 15`, `raining: false`): `refusals` both false/null,
    **Plan A = `starbucks-chinatown-food-street`, `tier: robust`, `returnTier: robust`,
    `returnBasis: core_span`**, Plan B = `starbucks-singhealth-tower`, `strength: strong`,
    `overallTier: robust`. Matches the claimed result exactly, independently derived.
  - Scenario B (`origin_b`, `walk`, `leaveAtMinutes: 1380`, same duration/tolerance): Plan A is
    `null`, **`refusals.noVerifiedReturn === "04:07"`**, matching the claimed exact refusal string
    (rendered by `app.js` as "No option with a verified way home for a session ending at 04:07.").
    Reproduced independently, not taken on faith.
- Checked `reviews/LEDGER.md`'s tail — `IMP-014` row already present (written at allocation, before
  this gate ran), one row, no other stray content in the diff (there is none — LEDGER wasn't touched
  in this working-tree diff, consistent with the ledger row having been committed earlier at
  allocation, commit `5e2b31c`).
- `web/manifest.webmanifest` exists and is already tracked/unchanged (not in `git status`) —
  consistent with "no code changes."

### Could not verify

- **The iPhone device check's substitute, first-hand.** Playwright is not usable in this
  environment: Node is 18.15.0, Playwright requires Node ≥ 20, and it is not installed as a project
  dependency (`package.json` declares no dependencies at all). I could not independently re-run the
  claimed "Playwright/Chromium at 430×932 CSS px, no horizontal scroll, Scenario A reproduced
  identically" check. As a partial, weaker substitute I confirmed the viewport meta tag
  (`width=device-width, initial-scale=1`) is present and grepped for hardcoded `px` widths ≥100 in
  the page — found none — which is mildly corroborating but not equivalent to an actual rendered
  check.
- The visual screenshots the user reviewed for both scenarios in a real desktop browser — not saved
  anywhere accessible to this gate, exactly as flagged in my brief.
- Whether the real Google Places / SerpApi live-fetch path behaved correctly at the network/HTTP
  level beyond its output — no network calls were made by me (correctly out of scope); I verified
  only the resulting `data/venues.json` content, timestamps, and status fields.
- The 4 previously-unverified movable-date holiday estimates — resolved in `DECISIONS.md` prior to
  this assignment (`IMP-013`'s close / a same-day flagged fix), not this assignment's scope.

### Not asked to check

- `return_transport`/`holiday_return_policy` hand-curated data-fill correctness beyond "the bridge
  stamps `ok`" — named, separate, privacy-sensitive scope exclusion.
- The outbound-mirror ARCH — named scope exclusion, deliberately unscoped.
- General code style, accessibility, or performance beyond the stated acceptance criteria — no code
  changed in this assignment.
- Whether `make refresh`'s actual API spend/cost was reasonable — outside the gate's remit.

### Judgment: the iPhone-check substitution

The literal acceptance criterion (`PLAN.md:2301`, "opened from `file://`, and read on the iPhone")
was **not** met as stated. The real device attempt hit a genuine, disclosed environment limitation
(iOS Quick Look does not execute JS for a `file://`-opened HTML file from the Files app) rather than
a defect in the artifact — that part I accept at face value as a plausible, well-known iOS
sandboxing behavior, not something this gate can independently probe without a physical device.

My own judgment on the chosen substitute: **it is a materially weaker check than the criterion's
intent, and should be flagged rather than treated as equivalent.** A desktop Chromium emulation of
the iPhone 15 Pro Max viewport confirms CSS layout at that viewport size (no horizontal scroll) and
re-exercises the ranking logic (Scenario A), but Chromium is not WebKit — it cannot surface
Safari-specific rendering behavior (viewport-unit quirks, `<input type="date">`/`<input
type="time">` rendering, momentum scrolling, safe-area insets, or actual touch/one-handed usability),
all of which the manual checklist (`PLAN.md:2444-2449`) explicitly asks about ("readable one-handed",
"Loads ... in Safari"). It also doesn't retest the exact failure mode encountered (`file://` +
on-device) — it sidesteps it rather than resolving it. Notably, an alternative that **would** have
produced a genuine on-device result was available and does not appear to have been tried first:
serving the file over a local HTTP server (or opening it via GitHub Pages / a temporary tunnel) and
loading that URL in real iPhone Safari would let the JS execute normally, since the Quick Look
limitation is specific to `file://` opened through the Files app's preview, not to Mobile Safari
generally.

This is a real, user-accepted trade-off, not a concealment — the primary disclosed it plainly in
`HANDOFF.md`'s `Required verification` field rather than silently substituting. I am surfacing it as
an **open gap** for the reviewer and the user to weigh, not treating it as satisfied.

### Status

`GATE_PASS`

Every mechanically-checkable required-verification item was independently reproduced and matches the
brief exactly: the live-refresh output (28/28 `ok` across hours/histogram/return-transport, 0
removed), both automated test suites, both live-session scenarios (independently re-derived from the
real embedded data through the real `rankVenues()`, using `app.js`'s actual controls field set), and
every generated-artifact assertion checked against the real `web/index.html`. No code changes were
found beyond the disclosed scope. The one shortfall — the iPhone device-check substitution — is a
disclosed, user-accepted deviation from the literal acceptance criterion, not a hidden defect or a
failed check; it is recorded above under "Judgment" as an open gap for the reviewer/user, not as a
gate failure. Because the money/external-side-effects hard trigger fired regardless of gate outcome
(per `HANDOFF.md`'s own `Route triggers` field), this `GATE_PASS` routes to `review_requested`
(`codex_terra`), not `approval_requested` — Codex should independently weigh the iPhone-substitution
judgment call above rather than treat this gate's `PASS` as having resolved it.

---
