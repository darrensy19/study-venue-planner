> **Provenance.** Imported 2026-09-05 from the Claude Design project
> "Study Venue Planner Redesign"
> (`https://claude.ai/design/p/00b69199-f550-4711-b988-f904576e1b79`),
> file `design_handoff_study_plan/study-plan-v1.md`. Body below is verbatim;
> only this provenance block was added. Companion:
> `2026-09-05-study-plan-frontend-handoff.md` (per-component measurements).
> Scheduled as **slice 4** of `2026-09-05-review-response-design.md` §13.

# Study Plan — design specification v1.0

Confirmed 2026-09-05. Design direction: **Warm Dusk**, Manrope, iPhone-only.

Target is the existing production shape: one generated, self-contained
`index.html`, vanilla HTML/CSS/JS, data inlined, no runtime backend, no
external assets. **Nothing here asks for a change to `ranking.js`.**

The current screen shows twelve facts at one weight. This ranks them by what a
decision actually needs, in the order the question is asked.

---

## 1. Information hierarchy

| Rank | What | How |
| --- | --- | --- |
| 1 | **Where** | Venue name at 30px, the largest type on the screen. Area, closing time and door-to-door minutes on one supporting line. Nothing competes with it. |
| 2 | **How long** | **Achievable** duration at 46px, with the requested duration demoted to a tag beside it. Requested is context; achievable is the answer. When they differ the tag turns accent and states the shortfall. |
| 3 | **Timing, seat, home** | Labelled rows, 1px rules, identical structure: a bold verdict word plus one sentence of grounds. Scannable in three fixations. |
| 4 | **Warnings** | Immediately below the verdict rows, never inside a disclosure. |
| 5 | **If it's full** | The next block's summary line, so it clears the fold. Phrased as an action ("8 min walk to …"), not a venue name. |
| 6 | **Everything else** | Why this one, Other options, Ruled out, Evidence — all collapsed. Same vocabulary as the old cards, moved behind disclosure rather than deleted. |

Refusals invert the layout: the headline states what is impossible, the
mechanism is one grey line beneath it, and the only affordances are trip
changes whose stated outcome the pipeline can actually produce. There is **no
metric block at all** — a zero cannot be mistaken for a recommendation because
no number is rendered.

### Three screens

- **Asking** holds every question and nothing else. It **must fit one screen
  with no scrolling** — a hard constraint on anything added to it.
- **Result** is the plan.
- **What's checked** is a reference page: last session, the four checks the
  pipeline runs, and per-source evidence freshness. Reachable from the asking
  screen only. It is orientation, not part of the flow.

### The asking screen

Cold open is a question, not a form: **"Where should I study?"** at 28px,
centred, with the animated cup beside it. Then five decisions.

The two wide ones (*Leaving*, *Studying for*) get a label above a row of four
equal-width controls. The three narrow ones (*From*, *By*, *Rain*) put a 40px
label to the left of the row — that is what buys the vertical space to fit one
screen. No dividing rules; spacing alone groups them.

Defaults are set so a single tap on *Find me somewhere* is a complete request.

**Every row is exactly four controls on one line, and the fourth is always
`Custom`.** Leaving reads Now / +1 hr / +2 hr / Custom; studying-for reads
3h / 6h / 9h / Custom. `Custom` opens a bottom sheet rather than growing the
row — that is what keeps both rows one line tall and the screen one screen
tall. The word is the same in both places on purpose.

**The sheets offer only what the tool can honour.** The leaving sheet is
Today / Tomorrow plus whole hours from 7am to 11pm — no date field, no
minutes; nothing outside that window has a venue open with a verified way
home, so offering it would be a false choice. The duration sheet is 1h–12h.

**Duration is hours, never minutes.** Minutes remain the internal unit and the
request the pipeline receives is unchanged, but no minute value is ever an
input.

Two derived things sit between the inputs and the primary action, both careful
not to promise a venue:

- a **range preview** — travel across the venues on record runs 20–58 min, so
  sit-down falls between two clock times;
- a **pre-flight warning** when the requested session would end past 9:30pm,
  because that is where a per-venue late timetable becomes necessary and most
  venues have none. Better to say so before the trip than to return a refusal
  after it.

A **footer** carries the last session and two actions (*Same again*,
*What's checked*).

---

## 2. Component structure

| Component | Contents |
| --- | --- |
| `AskScreen` | `AskHead` (headline + cup) → `WhenRow` → `DurationRow` → `OriginRow` + `ModeRow` + `RainRow` → `RangePreview` → `PreflightWarning` → primary action → `Footer` (last session + two actions) |
| `CustomSheet` | Bottom sheet over a scrim. Two modes: leaving (Today/Tomorrow + hours 7am–11pm) and duration (1h–12h). Overlays; never extends the page. |
| `TripBar` | On the result screen: the whole input set collapsed to one sentence, expanding to the same controls. Native `<details>`. |
| `Recommendation` | `VerdictHead` (kicker / name / subtitle) → `AchievableMetric` → `FactRow` ×2 (Timing, then Seat + Home side by side) → `SeatHistoryLine` |
| `SeatMeter` | Three 12×5px ticks, filled 3/2/1 for likely / possible / doubtful. Qualitative by construction — no scale label, no percentage anywhere in the markup. |
| `WarningStack` | Two lists, `critical` and `note`. One entry per source failure; never merged. |
| `FallbackBlock` | A `<details>` whose **summary is the one-line answer**, so the fallback clears the fold without being stated twice; the recalculation basis and salvage footer live inside. Three renderings from `backup_strength`: `strong`, `salvage` (summary carries the real duration, body adds "Salvage, not a swap"), `none` ("Nothing nearby works" + what going elsewhere costs). Never a summary line and an expanded card at once. |
| `Refusal` | Kicker / headline / body / mechanism / `RecoveryAction` list |
| `UnverifiedDisclosure` | Collapsed by default, opt-in. Inside: an accent-bordered panel and an hours-only ceiling stated as a ceiling. |
| `Disclosures` | `WhyThisOne` (key/value list), `OtherOptions`, `RuledOut`, `Evidence` |
| `SeatLogBar` | `Got a seat` / `No seat`, then a logged line with Undo |

---

## 3. Typography, spacing, colour

| | |
| --- | --- |
| **Family** | Manrope 400/500/600/700/800, one family. |
| **Scale** | 46 achievable duration · 30 venue name · 28 asking headline · 25 refusal headline · 20 resolved date-time · 19 fallback action · 14.5 body and verdict words · 13 supporting grounds · 12–12.5 labels and tags. Nothing below 11.5px, and nothing below 13px carries information you need to act on. |
| **Ground / surface** | `#12100f` desk · `#1c1917` app · `#241f1c` card · `#2b231c` fallback card. Hairline `#322b26`, border `#3d3630`. Separation comes from these steps, not from rules. |
| **Ink** | `#fdf6ec` headlines · `#f2ebe3` body · `#b3a89d` grounds · `#a89e94` labels. All ≥4.5:1 on their own surface. |
| **Accent** | Honey `#e5a95f` — primary action, selected control, disclosure carets. Positive `#93c19a` for a met request and a likely seat. Warning field `#33221b` / border `#63392a` / text `#ffd6c2` / label `#f5a982`. |
| **Radius** | 22px app shell · 16–18px cards · 13–15px controls, inputs and buttons · 8–10px tags. Softened rectangles, not pills. |
| **Labels** | Sentence case at 12.5–13px. No uppercase micro-labels. |
| **Selected state** | Controls are `<button>` pills, not radios: honey fill with `#241a0c` text when selected, transparent with a `#3d3630` border when not. Needs no `:has()` support. |
| **Touch** | Every control ≥44px tall; disclosure summaries 48–52px. |
| **Viewport** | iPhone only. Designed at **430 × 932 (iPhone 15 Pro Max)**, checked against **390 × 844 (iPhone 12/13/14)**, which is the binding case for the one-screen rule. No desktop layout. |
| **Time display** | 12-hour throughout, lower-case suffix, minutes omitted when zero: `4pm`, `4:22pm`, `12:15am`. One formatter owns every clock string on every screen — no 24-hour value is ever shown. |
| **Vertical fill** | The asking screen is a full-height flex column of seven sibling groups with `justify-content: space-between` over a 12px minimum gap. Spare height is **divided evenly between the groups** — 52px gaps at 430×932, 38px at 390×844, 12px in the worst case — rather than collected into one void. Pinning the footer with `margin-top: auto` was tried and rejected: it moves the empty space from the page edge, where it reads as the end of the page, into the middle, where it reads as a missing section. |
| **Motion** | Two uses, both CSS keyframes on static markup. *Decorative:* a takeaway cup beside the asking headline, sized to the headline's own height (26×34px against 28px type) — three steam wisps on a 2.8s loop staggered 0.7s, and a 4.6s tilt. Built from five divs with a `clip-path` taper, **not a brand mark**; a chain's logo should not ship in a tool that ranks three chains against each other. *Functional:* a 420ms 16px rise-and-fade on the whole recommendation block when Plan B is promoted, so the recalculation reads as a replacement rather than a silent content swap. |

---

## 4. Interaction behaviour

| | |
| --- | --- |
| **Ask → result** | The asking screen is the cold-open state; the trip bar on the result screen is the same input set collapsed to a sentence. One state object serves both, so returning to asking never loses a value. |
| **Trip changes** | Any control change re-runs the pipeline immediately — no submit button. Duration presets and the sheet are two views of one value. |
| **Cycle → bicycle** | Choosing Cycle sets `bicycle_with_you` true and says so in one line. Raining removes cycle from the admissible return set, per `admissibleReturnModes`. |
| **Advisory slot** | The pre-flight warning and the bike note **share one slot**. When the warning shows, the bike line becomes a second line inside it. They never need separate emphasis, and stacking two cards broke the one-screen rule. |
| **Range preview** | Recomputed on every input change from the fastest and slowest measured travel bands. States a range, never a venue. If the travel-band set is empty for the chosen origin and mode, suppress it rather than widen it. |
| **Pre-flight warning** | Advisory, never blocking. The user may still ask, and the result screen delivers whatever the pipeline returns. |
| **Disclosure** | Native `<details>` everywhere, all closed on load. Warnings are outside every `<details>` in the emitted HTML — assert this in the generator test. |
| **No seat** | Promotes Plan B to the verdict position, relabels the kicker `Plan A was full — go to`, animates the block in, and shows the recalculated clock from the seat-check buffer, not the original origin. When `backup_strength` is `none` it says so instead of promoting anything. |
| **Got a seat** | Collapses the bar to a logged line with Undo. Writes one seat-log row; no history view. |
| **Next day** | Any clock past midnight renders as `2:29am next day` in metrics and `2:29am on Sun 6 Sep` in prose. Never a bare post-midnight time. |
| **Recovery actions** | A refusal's buttons only ever change trip inputs, and their labels state the outcome the pipeline returns for those inputs. No action fabricates a result. |
| **Focus** | A visible 2px accent focus ring at 2px offset on every interactive element. Never the browser default. |

---

## 5. Data fields

All of these already exist on the candidate object `rankVenues()` returns, or
in `venues.json`. The screen reads them; it derives nothing.

| Group | Fields |
| --- | --- |
| Identity | `venue_id`, `area`, resolved close time for the arrival date |
| Duration | `usable_minutes_mid`, the requested duration, `metrics_basis` (`hours_only` suppresses the achievable figure and shows a ceiling instead) |
| Timing | `leave_at`, `travel_minutes_mid`, `session_end_mid_abs`, `latest_leave_at`, `binding_constraint`, the travel band string |
| Seat | `seat_confidence.confidence`, `baseline_seatability`, `busyness_band.band` |
| Home | `return_tier`, `return_basis`, `return_modes` |
| Fallback | `plan_b.venue_id`, `.mode`, `.travel_band`, `.usable_minutes_mid`, `.overall_tier`, `backup_strength`, the seat-check buffer |
| Freshness | `hours.status` + `hours.last_success_at`, and `histogram.status` + `histogram.last_success_at`, read **independently** — two fields, two warnings, never merged |
| Refusals | `refusals.no_low_risk_option`, `refusals.no_verified_return`, `removed[]` with reasons, `travel_unknown[]` |
| Rank | `preference`, `hours_tier`, `overall_tier` (disclosure only) |

### Assumed — needs confirming before build

| | |
| --- | --- |
| **Resolved closing label** | "closes 10pm" needs the resolved close for the arrival date exposed on the candidate. If it is only reachable via `latest_leave_at` plus the binding constraint, the subtitle must drop it rather than infer it. |
| **Warning age in days** | "28 days old" is computed from `last_success_at` against the generation date. There is deliberately no global `generated_at`, so **`build/refresh.py` must stamp a per-source age at build time.** |
| **Fallback walk minutes** | "8 min walk" uses the midpoint of `fallbacks[].travel_band`. Confirm a midpoint is acceptable for display where feasibility uses the pessimistic edge. |
| **Recovery-action outcomes** | Each refusal button's label quotes a result. That requires re-running the pipeline for the alternative inputs at generation time, or client-side on press. Cheap either way — but it is new work. |
| **Seat-log aggregation** | Per venue, visit outcomes from the seat log — `venue_id`, timestamp, got-a-seat boolean — aggregated into a count and a total. The Apple Shortcut already writes the rows; nothing reads them. |
| **Seat-log write path** | Production has no backend: either keep the Shortcut and make the button a deep link, or write to `localStorage` and export. |

---

## 6. Product-policy decisions (not decided here)

The two blocking ones are **P1** in `backlog-additions.md`.

1. **Should unverified-return options be shown at all?** The design shows one
   behind an opt-in disclosure with an explicit "way home not verified" panel
   and no achievable figure. The alternative is to hide them entirely. A
   risk-appetite call, not a UI call.
2. **Is there a minimum useful session?** The 90-minute Plan B floor is reused
   in the copy as the threshold for "useful". If Plan A has no floor of its
   own, a 40-minute Plan A is possible and this design would present it as a
   real recommendation.
3. **Should staleness affect ranking?** Today it does not, and the design says
   so out loud. If it should, that is a ranking change and belongs upstream.
4. **How old is too old?** The copy states an age without a verdict. No
   threshold exists above which hours should stop being trusted.
5. **The pre-dawn gap.** A session ending 4am–7am is unverified with basis
   `pre_dawn_gap`, but reads identically to "no timetable data".
6. **Cycle-at-night cutoff.** `RETURN_CYCLE_LATEST_MINUTES` is `null`. Until
   it is set, cycling home at 3am passes as schedule-free and the screen says
   `Verified`.

---

## 7. Prototype → production translation

| | |
| --- | --- |
| **Framework** | The prototype is a component with a render-from-state loop. Production keeps `app.js`'s existing `render(state)` + `el()` pattern — the structure maps one-to-one; every component in §2 is a function returning a node. `renderCandidateCard` is removed. |
| **Styling** | Literal hex throughout, no design-system stylesheet and no CSS custom properties required. Ports to `style.css` as plain CSS with no dependency to strip. |
| **Font** | Manrope is loaded from Google Fonts in the prototype. Production loads no external assets — either self-host a subset as base64 in the inlined CSS, or fall back to the system stack and re-check the type scale, since Manrope is narrower than most system UI faces. |
| **Demo shell** | The screen switch, device toggle, state chips and artboard frame are prototype scaffolding. None of it ships. |
| **Data** | Six hand-authored scenarios stand in for the pipeline. Venue ids, areas and `baseline_seatability` come from `data/venues_meta.json`; travel bands, closing times and timetable bands are realistic stand-ins. |
| **Clock** | *Now* resolves to a fixed 4pm Sat 5 Sep so the prototype is deterministic. Production reads the real clock, which also makes the pre-flight warning fire on its own. |
| **Travel range** | 20–58 min is the observed spread of transit midpoints in `venues_meta.json`, hard-coded. Production should derive it per origin and mode from the loaded data, and omit venues whose band is unmeasured. |
| **Live arithmetic** | Editing time or duration recomputes achievable, sit-down and pack-up against the shown venue's closing time. Venues are **not** re-ranked. In production the whole pipeline re-runs and the venue can change. |

---

## 8. Making the seat log pay off

The log currently has no return path: you tap *Got a seat* and nothing ever
comes back, which is why logging stops happening. The result screen shows the
smallest thing that closes the loop — one line under the seat verdict:

> You have logged a seat here 4 of the last 5 visits.

It is a **count of what happened, not a probability**, so it needs no
calibration and no model. Three rules make it honest:

- Show it only at **three or more visits** to that venue. Below that the count
  is noise and inviting a read on it is worse than silence.
- Window it to the **last five visits and roughly six months** — a café that
  got busy in March should not be defended by last year.
- Keep it strictly **beside** `seat_confidence`, never folded into it. The
  moment the log adjusts the tier, it is a ranking change and belongs upstream
  in `ranking.js`, not in this screen.

This is the one backlog item where the data already exists and only the
plumbing is missing.

---

## 9. Acceptance checklist

- [ ] **Ten-second test.** From a cold look, a reader can state the venue, the
      achievable duration, whether they can get home, and the fallback —
      without opening a disclosure and without scrolling.
- [ ] **Asking fits one screen.** At 390 × 844 the asking screen's content
      height never exceeds the viewport, with and without the pre-flight
      warning and the bike note showing. Assert `scrollHeight ≤ clientHeight`.
      The `Custom` sheets must not be able to break this — they overlay, they
      never extend the page.
- [ ] **One-tap ask.** On cold open, pressing the primary action with no other
      interaction produces a valid request.
- [ ] **Preview promises nothing.** The asking screen names no venue, no count
      of matches and no single clock time — ranges only.
- [ ] **Hours only.** No minute value appears as an input anywhere, and no
      24-hour clock string appears in the emitted HTML.
- [ ] **One header.** Each screen has exactly one element at headline scale.
- [ ] **Requested ≠ achievable.** When they differ, the achievable figure is
      the large one and the shortfall is stated in words. The requested figure
      never appears alone.
- [ ] **Zero minutes.** No render path produces a recommendation with a zero
      or negative achievable duration. Below the useful floor the screen is a
      refusal with no metric block.
- [ ] **Unverified return.** No screen shows `Verified` unless `return_tier`
      is `robust` or `tight`. An unverified option never occupies the verdict
      position, never shows an achievable duration, and always carries the
      accent-bordered panel.
- [ ] **Stale vs failed.** A fixture with `hours.status == "stale"` and
      `histogram.status == "ok"` emits exactly one warning, naming hours. Two
      stale sources emit two separate warnings with different dates. `failed`
      renders as "no data on record — not ranked", distinct from stale.
- [ ] **Warnings not hidden.** Every critical warning is outside every
      `<details>` element in the emitted HTML.
- [ ] **Ranking unchanged.** Rendered venue order and Plan A identity are
      byte-identical between an `ok` and a `stale` run over the same
      last-known-good data.
- [ ] **Plan B provenance.** The fallback states the recalculated departure
      time, not the original one, and the salvage variant states its own
      duration and the fact that it is not the requested one.
- [ ] **Fallback stated once.** Never a summary line and an expanded card at
      the same time.
- [ ] **No fallback.** `backup_strength: none` renders the "Nothing nearby
      works" block. It is never blank and never omitted.
- [ ] **Midnight crossing.** Every clock past midnight is labelled next-day in
      metrics and dated in prose. Grep the emitted HTML for a bare
      post-midnight time.
- [ ] **Qualitative seat.** No percentage, probability or numeric score for
      seating appears anywhere in the emitted HTML.
- [ ] **Seat history.** The visit-count line appears only at three or more
      logged visits, sits beside `seat_confidence` and never inside it, and
      states a count — never a percentage.
- [ ] **Busyness framing.** Any mention of busyness says historical and
      within-venue. No copy compares busyness across venues.
- [ ] **No invention.** No route names, line names, photographs, maps or
      charts. Travel is a duration and a mode only.
- [ ] **Touch and contrast.** All controls ≥44px. Body text ≥4.5:1; warning
      copy checked on its tinted field.
- [ ] **Offline.** The generated file opens from `file://` with no network and
      renders identically.
