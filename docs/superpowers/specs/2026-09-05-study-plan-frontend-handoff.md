> **Provenance.** Imported 2026-09-05 from the Claude Design project
> "Study Venue Planner Redesign"
> (`https://claude.ai/design/p/00b69199-f550-4711-b988-f904576e1b79`),
> file `design_handoff_study_plan/README.md`. Body below is verbatim; only
> this provenance block was added.
>
> **Two corrections to the body, recorded here rather than edited into it:**
> 1. "Where this lands in the repo" says PLAN.md Phase 1 step 6 "had no design
>    input; this is it." Step 6 was in fact built and closed as `IMP-012`
>    (2026-09-03). This is a redesign of shipped output, not the original
>    build of that step.
> 2. This work is sequenced as **slice 4** of
>    `2026-09-05-review-response-design.md` §13 ("UI hierarchy, disclosure,
>    always-visible warnings, focus"), gated on slice 2's vocabulary. §5's
>    data-field contract below is written against the *pre-migration* shape;
>    §10 of that design changes it in slices 1a/1b. Reconcile before building.
>
> The prototypes (`Study Plan Dusk v1.0.dc.html`, `Current UI (recreated).dc.html`)
> and their `support.js` runtime were deliberately **not** vendored — they are
> design references, not code, and the runtime is a 70KB generated React
> bundle. They remain in the Claude Design project linked above.

# Handoff: Study Plan — venue planner UI v1.0

## Overview

A redesign of the output and input screens for **study-venue-planner**, a
personal mobile tool for choosing a café in Singapore for a study session. It
answers four questions in one screen: where to go, how much useful study time
you actually get, whether and how you can get home, and what to do if the
venue is full.

The existing `web/app.js` renders every candidate as an identical six-line
card, which makes the output read as a diagnostic report rather than a plan.
This design ranks the same facts by decision value and moves the diagnostics
behind progressive disclosure. **No ranking logic changes.**

## About the design files

The HTML files in this bundle are **design references**, not production code.
They are prototypes built in a streaming component format (`.dc.html`) that
shows intended look and behaviour. Do **not** copy them into the app.

The task is to **recreate these designs in the target codebase's existing
environment**: `web/app.js` (vanilla JS, `render(state)` + an `el()` helper),
`web/style.css`, and `web/index.template.html`, generated into one
self-contained `index.html` by `build/refresh.py`. No framework, no npm, no
build step, and **no external assets at runtime**.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, radii, copy and
interactions. Recreate pixel-perfectly using the values in "Design tokens"
below. Every hex value and pixel figure in this document is the intended
final value.

## Environment constraints (read before starting)

- The generated page must open from `file://` with no network and render
  identically. Data, CSS and JS are all inlined at generation time.
- There is deliberately **no global `generated_at`** in the data model.
- `web/ranking.js` is **out of scope**. No tier, ordering, refusal,
  `seat_confidence` or `backup_strength` logic may change. Rendered output
  must be byte-identical between an `ok` and a `stale` run over the same
  last-known-good data.
- Two **product-policy decisions are unresolved** and change what gets built.
  See `decisions-entry-stub.md`. Do not resolve them in code.

---

## Screens / views

Three screens. One state object serves all three, so navigating between them
never loses an input value.

### 1. Asking

**Purpose.** Compose the request. Cold open lands here.

**Hard constraint.** Must fit one screen with **no scrolling** at
390 × 844. This governs anything added to it.

**Layout.** Full-height flex column, `padding: 18px 18px 14px`,
`justify-content: space-between`, `gap: 12px` minimum. Seven sibling groups:

1. Headline row — `display: flex; align-items: center; justify-content: center; gap: 9px`. Centred `<h1>` plus the animated cup.
2. Leaving — 13px label, then a row of four equal-width buttons (`display: flex; gap: 6px`, each `flex: 1`, `min-height: 46px`), then the resolved date-time at 20px/800 with `margin-top: 8px`.
3. Studying for — same label + four-button pattern.
4. From / By / Rain trio — three rows, `gap: 8px` between them. Each row: `display: flex; align-items: center; gap: 10px`, a 13px label at `flex: none; width: 40px`, then the buttons at `flex: 1`, `min-height: 44px`.
5. Range preview — card, `background #241f1c`, `border-radius: 16px`, `padding: 12px 15px`, 13px/1.5 text.
6. Advisory (conditional) — see "Advisory slot" under Interactions.
7. Primary action, then the footer.

Spare height is **divided evenly between the seven groups** by
`space-between` — 52px gaps at 430 × 932, 38px at 390 × 844, 12px in the worst
case. Do not use `margin-top: auto` on the footer: it collects all the slack
into one void in the middle of the screen, which reads as a missing section.

**Components.**

| Component | Spec |
| --- | --- |
| Headline | "Where should I study?" · 28px / 800 / line-height 1.14 / letter-spacing −0.025em / `#fdf6ec` / `text-align: center` |
| Cup | 26 × 34px, `position: relative`. See "Assets" |
| Group label | 13px / 500 / `#a89e94`, sentence case |
| Segmented button (unselected) | `min-height: 44–46px`, `border-radius: 13px`, `border: 1px solid #3d3630`, `background: transparent`, `color: #e0d7cd`, 13.5px / 600 |
| Segmented button (selected) | `background: #e5a95f`, `color: #241a0c`, `border-color: #e5a95f` |
| Resolved date-time | 20px / 800 / letter-spacing −0.015em / `#fdf6ec`. Text: "Sat 5 Sep · 4pm" |
| Range preview | 13px / 1.5 / `#f0e7dc`. Text: "Travel runs 20–58 min, so you would sit down between 4:20pm and 4:58pm." |
| Primary action | full width, `min-height: 54px`, `border-radius: 15px`, `background: #e5a95f`, `color: #241a0c`, 16px / 800, `display: flex; justify-content: space-between; padding: 0 20px` — label left, "→" right |
| Footer | `border-top: 1px solid #2e2823`, `padding-top: 13px`. Row: "Last session" (12.5px/500/`#a89e94`) + date right-aligned (12px/`#8f857b`); then 14px/1.45/`#f0e7dc` "Starbucks Fusionopolis — asked 3h, got 3h, seat found."; then two equal buttons, `min-height: 44px`, `border-radius: 13px`, 1px `#3d3630` border: "Same again" and "What's checked" |

**Control values.**

- Leaving: `Now` / `+1 hr` / `+2 hr` / `Custom`
- Studying for: `3h` / `6h` / `9h` / `Custom`
- From: `Home` / `Office`
- By: `Transit` / `Walk` / `Cycle`
- Rain: single toggle button, label `Not raining` ⇄ `Raining — no cycling home`

**Every row is exactly four controls on one line, and the fourth is always
`Custom`.** `Custom` opens a bottom sheet rather than growing the row — that
is what keeps each row one line tall and the screen one screen tall. Use the
same word in both rows.

### 2. Custom sheet (overlay)

**Purpose.** Pick a non-preset value.

**Layout.** `position: absolute; inset: 0` over the app frame.
`background: rgba(10,8,7,0.66)`. Flex column, `justify-content: flex-end`; the
area above the panel is a tap target that dismisses. Panel:
`background #241f1c`, `border-top: 1px solid #3d3630`,
`border-radius: 22px 22px 0 0`, `padding: 16px 16px 20px`, entering with
`translateY(20px) → 0` and `opacity 0.4 → 1` over 180ms ease-out.

Header row: title 17px / 800 / `#fdf6ec` at `flex: 1`, plus a `Done` button
(`min-height: 38px`, `border-radius: 11px`, 1px `#3d3630`).

Options: `display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px`,
each `min-height: 46px`, same selected/unselected treatment as above.

**Two modes.**

- **Leaving** — title "When are you leaving?". A Today / Tomorrow row above
  the grid (`gap: 6px`, `min-height: 44px`), then whole hours **7am–11pm**.
  No date field. No minutes.
- **Duration** — title "How long do you want?". **1h–12h**.

The windows are deliberate: nothing outside 7am–11pm has a venue open with a
verified way home, so offering it would be a false choice.

**Sheets overlay; they must never extend the page height.**

### 3. Result

**Purpose.** Deliver the plan.

**Layout, top to bottom.** All measurements are bottom-edge positions
against an 844px viewport, to verify the ten-second test:

1. Back control — "← Change trip", `min-height: 40px`, `border-radius: 12px`, 1px `#3d3630`, 13px / 700 / `#ddd4ca`. `padding: 18px 18px 0`.
2. Trip bar — `<details>`, `background #241f1c`, `border-radius: 16px`, `margin: 12px 12px 0`. Summary: the whole input set as one sentence, 13px / 1.4 / `#ddd4ca`, plus a `›` caret in `#e5a95f` that rotates 90° when open. Body repeats the asking screen's controls.
3. Verdict head — kicker 13px / 500 / `#a89e94` ("Go to" / "Best available" / "Plan A was full — go to"); venue name **30px / 800 / line-height 1.14 / letter-spacing −0.025em / `#fdf6ec`**, `text-wrap: balance`; subtitle 13.5px / `#b3a89d` — "one-north · closes 10pm · 22 min by transit". *(≈225px)*
4. Metric card — `background #241f1c`, `border-radius: 18px`, `padding: 18px`, `margin: 16px 12px 0`. Label 13px / 500 / `#a89e94` "Study time you actually get"; then the **achievable** duration at **46px / 800 / letter-spacing −0.035em / `#fdf6ec`**, with a tag beside it. *(≈298px)*
   - Met in full: `background #26332a`, `color #b9dcbe`, `border-radius: 10px`, `padding: 6px 11px`, 12.5px / 600 — "all of the 3h you asked for"
   - Short: `background #3a2c1c`, `color #ffd9a3`, 12.5px / 700 — "1h 02m less than the 3h you asked for"
5. Timing row — `border-top: 1px solid #322b26`, `margin-top: 16px`, `padding-top: 13px`. Label, then 14.5px / 1.5 / `#f2ebe3`: "Leave **4pm**, sit down **4:22pm**, pack up **7:22pm**" (times at weight 800); then 12.5px / `#b3a89d`: "Bounded by closing time (10pm). Travel band 20–25 min."
6. Seat + Home — one rule, then `display: flex; gap: 14px; flex-wrap: wrap`, each `flex: 1 1 140px`. Seat: meter + verdict word 14.5px / 800, then grounds 12.5px / `#b3a89d`. Home: verdict word, then grounds. *(≈509px)*
7. Seat history line (conditional) — rule, then 12.5px / 1.45 / `#b9dcbe`: "You have logged a seat here 4 of the last 5 visits." *(≈610px)*
8. Warnings — see below. Outside every disclosure.
9. Fallback — `<details>`, `background #2b231c`, `border: 1px solid #3d3226`, `border-radius: 18px`. **The summary is the one-line answer**: "If it's full" (12.5px / 600 / `#d9b98c`) above "8 min walk to Starbucks Rochester Park — full session" (14.5px / 700 / `#fdf6ec`). *(≈700px)* Body holds the basis and the salvage note.
10. Disclosures — "Why this one", "Other options", "Ruled out", "Evidence". Each `background #241f1c`, `border-radius: 16px`, summary `min-height: 48px`, 14px / 700, with a count chip (`background #2e2823`, `border-radius: 8px`, `padding: 3px 8px`, 12px / `#b3a89d`) where applicable. The Evidence summary carries a `stale` chip (`background #3a221c`, `color #ffc9ae`, 700) when any source is not `ok`.
11. Seat log bar — 12.5px / `#b3a89d` "Arrived? Tell me what happened.", then two buttons `min-height: 50px`, `border-radius: 14px`: "Got a seat" (outlined) and "No seat" (`#e5a95f` fill, `#241a0c` text, 800).

**Seat meter.** Three 12 × 5px bars, `border-radius: 2px`, `gap: 3px`.
Likely = 3 × `#93c19a`. Possible = 2 × `#e5a95f` + 1 × `#453b33`.
Doubtful = 1 × `#e5a95f` + 2 × `#453b33`. Qualitative by construction —
**no scale label, no percentage, no probability anywhere in the markup.**

**Warnings.** Two kinds, never merged, one entry per source failure:

- *Critical* — `background #33221b`, `border: 1px solid #63392a`,
  `border-radius: 16px`, `padding: 14px 16px`. Label 12.5px / 700 / `#f5a982`;
  body 13.5px / 1.5 / `#ffd6c2`.
- *Note* — `background #241f1c`, no border. Label 12.5px / 700 / `#ddd4ca`;
  body 13px / 1.5 / `#b3a89d`.

**Refusal layout** (replaces items 3–7 when nothing is recommendable). Kicker
13px / 600 / `#f5a982` "No recommendation"; headline 25px / 800 / line-height
1.18 / `#fdf6ec`, `text-wrap: pretty`; body 14.5px / 1.55 / `#f0e7dc`;
mechanism 12.5px / 1.55 / `#b3a89d`. Then a "Change one thing" card with
left-aligned action buttons, `min-height: 48px`, `border-radius: 14px`,
`padding: 12px 15px`, 13.5px / 600 / line-height 1.4. **No metric block at
all** — that is what stops a zero being mistaken for a recommendation.

### 4. What's checked

**Purpose.** Orientation, not part of the flow. Reachable from the asking
screen's footer only.

Back control, then headline "What gets checked" (26px / 800). Then cards at
`border-radius: 16px`, `padding: 16px`, `background #241f1c`, `gap: 10px`:
last session; the four checks (each a rule-separated block with a 14px / 700
title and 13px / 1.5 / `#b3a89d` body); a critical-styled card stating
"Anything without a verified way home is never recommended, however good the
seat looks."; and per-source evidence freshness with the busyness caveat at
12.5px / `#8f857b`.

---

## Interactions & behaviour

| Behaviour | Spec |
| --- | --- |
| **Trip changes** | Any control change re-runs the pipeline immediately. No submit button. Presets and the sheet are two views of one value. |
| **Ask → result** | The primary action switches screens. Returning to asking preserves every value. |
| **Cycle → bicycle** | Choosing Cycle sets `bicycle_with_you` true and says so in one line. Raining removes cycle from the admissible return set, per `admissibleReturnModes`. |
| **Advisory slot** | The pre-flight warning and the bike note **share one slot**. When the warning shows, the bike line becomes a second line inside it (13px, `margin-top: 5px`). Two stacked cards break the one-screen rule. |
| **Range preview** | Recomputed on every input change from the fastest and slowest measured travel bands. States a range, never a venue. If the band set is empty for the chosen origin/mode, suppress it rather than widen it. |
| **Pre-flight warning** | Fires when `leave + fastest travel + duration` passes 21:30. Advisory, never blocking. Copy: "9h from 4pm ends past 9:30pm. Few venues have a verified late way home." |
| **Disclosure** | Native `<details>`, all closed on load. Carets rotate 90° via `details[open] > summary .caret { transform: rotate(90deg) }` with a 120ms transition. |
| **No seat** | Promotes Plan B into the verdict position, relabels the kicker "Plan A was full — go to", and shows the recalculated clock from the seat-check buffer — **not** from the original origin. When `backup_strength` is `none`, says so instead of promoting anything. |
| **Got a seat** | Collapses the bar to a logged line with Undo. Writes one seat-log row. No history view. |
| **Next day** | Any clock past midnight renders "2:29am next day" in metrics and "2:29am on Sun 6 Sep" in prose. Never a bare post-midnight time. |
| **Recovery actions** | A refusal's buttons only ever change trip inputs, and their labels state the outcome the pipeline returns for those inputs. No action fabricates a result. |
| **Focus** | A visible 2px `#e5a95f` focus ring at 2px offset on every interactive element. Never the browser default. |
| **Touch** | Every control ≥44px tall. Disclosure summaries 48–52px. |

### Animations

| Name | Spec |
| --- | --- |
| `steam` | 2.8s ease-out infinite, three wisps staggered 0s / 0.7s / 1.4s. `0% { opacity: 0; transform: translateY(3px) scaleX(0.7) } 30% { opacity: 0.8 } 100% { opacity: 0; transform: translateY(-15px) scaleX(1.3) }` |
| `sip` | 4.6s ease-in-out infinite on the cup body, lid and band. `0%,100% { transform: none } 50% { transform: translateY(-2px) rotate(-3deg) }` |
| `promote` | **420ms `cubic-bezier(0.22,0.9,0.3,1)` both**, applied to the whole recommendation block when Plan B is promoted. `from { opacity: 0; transform: translateY(16px) scale(0.985) } to { opacity: 1; transform: none }` |
| `sheet-in` | 180ms ease-out. `from { transform: translateY(20px); opacity: 0.4 }` |

Drive `promote` from a single animation-name value that changes **only** on
that transition, so it never re-fires on unrelated re-renders.

---

## State management

One state object; never read state back out of the DOM (the existing `app.js`
comment already states this rule — keep it).

| Variable | Values |
| --- | --- |
| `screen` | `ask` \| `result` \| `info` |
| `sheet` | `null` \| `when` \| `hours` |
| `when` | `now` \| `60` \| `120` \| `custom` — which leaving preset is lit |
| `controls` | `{ date, leave (minutes from midnight), duration (minutes), origin, mode, raining }` |
| `seat` | `null` \| `got` \| `none` — drives the seat-log bar and Plan B promotion |
| `result` | Whatever `rankVenues()` returned for the current controls |

**Transitions.** Any control change → recompute and re-render. `Custom` →
open the matching sheet. Choosing a sheet value → set the control, close the
sheet, set `when` to `custom`. Primary action → `screen = result`. Back →
`screen = ask`. `No seat` → `seat = none` → Plan B promoted with the
`promote` animation. `Undo` → `seat = null`.

**Data fetching.** None at runtime. All data is inlined at generation.

---

## Design tokens

### Colour

| Role | Value |
| --- | --- |
| Desk (outside the app) | `#12100f` |
| App ground | `#1c1917` |
| Card | `#241f1c` |
| Fallback card | `#2b231c` (border `#3d3226`) |
| Hairline | `#322b26` |
| Border | `#3d3630` |
| Divider (footer/section) | `#2e2823` |
| Headline ink | `#fdf6ec` |
| Body ink | `#f2ebe3` |
| Secondary ink | `#f0e7dc` |
| Grounds | `#b3a89d` |
| Labels | `#a89e94` |
| Faint | `#8f857b` |
| Accent (honey) | `#e5a95f` |
| Accent hover | `#f0bd7e` |
| On-accent text | `#241a0c` |
| Positive | `#93c19a` · field `#26332a` · text `#b9dcbe` |
| Warning | field `#33221b` · border `#63392a` · body `#ffd6c2` · label `#f5a982` |
| Short-of-request tag | field `#3a2c1c` · text `#ffd9a3` |
| Stale chip | field `#3a221c` · text `#ffc9ae` |
| Empty meter bar | `#453b33` |
| Cup band | `#4a3a28` |

All ink values are ≥4.5:1 on their own surface. Check warning copy on its
tinted field, not on the card.

### Typography

**Manrope**, weights 400 / 500 / 600 / 700 / 800. One family.

| Use | Size / weight |
| --- | --- |
| Achievable duration | 46 / 800, letter-spacing −0.035em |
| Venue name | 30 / 800, −0.025em, line-height 1.14 |
| Asking headline | 28 / 800, −0.025em, line-height 1.14 |
| "What gets checked" | 26 / 800, −0.02em |
| Refusal headline | 25 / 800, −0.02em, line-height 1.18 |
| Resolved date-time | 20 / 800, −0.015em |
| Fallback action | 19 / 800, −0.02em, line-height 1.25 |
| Sheet title | 17 / 800 |
| Disclosure summary | 14–14.5 / 700 |
| Body, verdict words | 14.5 / 400–800, line-height 1.5 |
| Controls | 13.5 / 600 |
| Grounds, supporting | 12.5–13 / 400, line-height 1.45–1.55 |
| Labels, chips | 12–12.5 / 500–700 |
| Faint footnote | 11.5 / 400 |

Nothing below 11.5px; nothing below 13px carries information needed to act.

**Font delivery.** Manrope is loaded from Google Fonts in the prototype. The
production page loads no external assets — either inline a base64 subset in
`style.css`, or fall back to the system stack and re-check the scale (Manrope
is narrower than most system UI faces).

### Spacing, radius, other

- Screen gutter 18px; card padding 16–18px; control padding `0 13–16px`.
- Inter-group gap 12px minimum, distributed by `space-between`.
- Radius: 22 app shell · 16–18 cards · 13–15 controls, inputs, buttons · 8–10 tags and chips.
- No shadows anywhere inside the app. Depth comes from the surface steps.
- **Time format:** 12-hour, lower-case suffix, minutes omitted when zero — `4pm`, `4:22pm`, `12:15am`. One formatter owns every clock string; no 24-hour value is ever shown, including inside disclosures.
- **Duration format:** `3h`, `1h 02m`, `28m`.

---

## Assets

**None external.** No images, icons, photographs, maps or charts. This is
deliberate: the domain rules forbid inventing routes or evidence, and none of
those improve the decision.

The only graphic is the **animated cup**, built from five positioned `<span>`
elements inside a 26 × 34px relative container:

| Part | Spec |
| --- | --- |
| Steam ×3 | `3 × 8px` / `3 × 9px` / `3 × 7px`, `border-radius: 2px`, at `left: 6/13/19px`, `top: 1/−1/2px`, colours `#c98a45` / `#d9974c` / `#c98a45`, `opacity: 0` + the `steam` animation |
| Lid | `left: 0; top: 9px; width: 26px; height: 5px`, `border-radius: 2px`, `#f0bd7e` |
| Body | `left: 3px; top: 14px; width: 20px; height: 20px`, `#e5a95f`, `clip-path: polygon(0 0, 100% 0, 86% 100%, 14% 100%)` |
| Sleeve band | `left: 4px; top: 21px; width: 18px; height: 6px`, `#4a3a28` |

It is a **generic takeaway cup, not a brand mark**. Do not substitute a
chain's logo: the tool ranks Starbucks, Coffee Bean and Baker & Cook against
each other, and branding one of them in the chrome would be misleading.

---

## Files in this bundle

| File | What it is |
| --- | --- |
| `Study Plan Dusk v1.0.dc.html` | **The design.** Interactive prototype: three screens, six demonstration states, two device sizes. Open in a browser. |
| `Current UI (recreated).dc.html` | The "before" — the existing `web/app.js` output, rebuilt faithfully from its formatters and `web/style.css`. Useful for seeing what changed and why. |
| `support.js` | Runtime the two `.dc.html` files need in order to render. Keep it beside them. |
| `study-plan-v1.md` | The specification, including the **data-field contract** (§5), the fields currently **assumed** (§5), the prototype→production translation notes (§7) and a **21-item acceptance checklist** (§9). Read §5 and §9 before writing code. |
| `backlog-additions.md` | P1/P2/P3 items raised in the design round and deliberately not built. |
| `decisions-entry-stub.md` | The two P1 policy questions written up with options, awaiting the owner's call. |

### Demonstration states

The prototype's state chips switch between six outcomes, all internally
consistent. Implement against all six:

1. **Full session** — request met, strong fallback, seat history present
2. **Shorter only** — achievable < requested, salvage fallback
3. **No session** — refusal, nothing clears the useful floor
4. **Return unverified** — refusal, plus an opt-in disclosure for the venue that is open but has no recorded way home
5. **Stale evidence** — two *separate* warnings (hours 28 days old, busyness 12 weeks old), plus a `failed` source distinguished from `stale`
6. **No fallback** — `backup_strength: none`

---

## Where this lands in the repo

`PLAN.md`'s Phase 1 implementation order, **step 6 — "Frontend shell and the
fixture-driven HTML generator."** That step had no design input; this is it.

- `web/app.js` — presentation layer replaced. Keep `render(state)` and `el()`; every component above becomes a function returning a node. `renderCandidateCard` is what goes away.
- `web/style.css` — the tokens above. The prototype uses literal hex and no design-system stylesheet, so this ports as plain CSS with nothing to strip.
- `build/refresh.py` — one addition: stamp a per-source **age in days** at generation time, because there is deliberately no global `generated_at` and the staleness warnings need "28 days old".
- `web/ranking.js` — **not touched.**
- `tests/python/` — the generator assertions in the acceptance checklist (warnings outside `<details>`; stale vs failed; byte-identical ranking under stale data).
