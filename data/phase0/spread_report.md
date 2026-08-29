# Phase 0 — Popular Times spread, coverage, and the N / P proposal

28 venues, 178 populated venue/weekday curves, 178 of them at or above MIN_HISTOGRAM_HOURS = 6.

**This measures the histogram's shape. It does not establish that Popular Times predicts seat availability** — nothing in Phase 0 can, and no line below should be read as evidence for it.

**Closed-hour buckets are excluded from every statistic below (575 buckets removed).** Popular Times reports 0 busyness for hours a venue is closed — that is a fact about closure, not a `quiet` reading, and an earlier run of this script that did not exclude them reported a median range roughly 3-4x too high because it was measuring 'closed vs peak' rather than 'quiet vs busy while open'. Any weekday whose regular hours could not be determined (e.g. the `multi_day_period` gap recorded in decisions.md) filters to zero open hours and correctly drops out of eligibility below, rather than being scored on a guess.

## Headline

| Measure | Value |
| --- | --- |
| Median per-curve range (max − min) | **54.0** points |
| Mean per-curve range | 56.5 points |
| Median per-curve IQR | 19.0 |
| Median per-curve median→max | 25.8 |
| Proposed `N` | **15** |
| Proposed `P` | **0** |

## Coverage — is `MIN_HISTOGRAM_HOURS = 6` right?

| Measure | Value |
| --- | --- |
| Populated curves | 178 |
| Min hourly buckets on a curve | 10 |
| Median hourly buckets | 15 |
| Max hourly buckets | 24 |
| Curves below 6 buckets (band → `unknown`) | 0 |

## Choosing `N` — distribution of |delta| from each curve's own median

| Percentile | \|delta\| |
| --- | --- |
| 50th | 10.0 |
| 67th | 16 |
| 75th | 20 |
| 90th | 33.0 |

`N` is proposed as **15**, the candidate nearest the 67th percentile (16). That leaves roughly two thirds of hours `typical` and splits the rest between `busy` and `quiet` — often enough to be useful, rarely enough to mean something.

Band mix at each candidate `N` (peak precedence applied at the proposed `P`):

| `N` | peak | busy | typical | quiet |
| --- | --- | --- | --- | --- |
| 5 | 7% | 29% | 27% | 37% |
| 8 | 7% | 23% | 39% | 31% |
| 10 | 7% | 19% | 47% | 26% |
| 12 | 7% | 16% | 53% | 24% |
| 15 ← | 7% | 12% | 62% | 19% |
| 20 | 7% | 7% | 72% | 14% |
| 25 | 7% | 5% | 77% | 11% |

## Choosing `P` — how wide is "within P points of the maximum"?

| `P` | mean peak hours per curve | max peak hours on one curve |
| --- | --- | --- |
| 0 ← | 1.2 | 4 |
| 2 | 1.6 | 6 |
| 3 | 1.8 | 7 |
| 5 | 2.3 | 10 |
| 8 | 3.3 | 10 |
| 10 | 3.8 | 12 |
| 15 | 5.0 | 14 |
| 20 | 6.4 | 15 |

`P` is proposed as the smallest candidate averaging 1-3 `peak` hours per venue/weekday. Wider and `peak` stops marking the genuinely worst hour and starts swallowing the afternoon.

> **Caveat.** The smallest candidate on the grid (`P` = 0) already fits, so the grid did not bracket the answer from below. `P` = 0 means *exactly at the maximum*, which makes `peak` fire on a single bucket that ordinary noise could move. Look at the curve shapes before accepting it.

## Does `very_quiet` earn a place?

plan.md admits it only on repeatable troughs around `2N` = 30 points below the median. Read here as the trough appearing on at least four of seven weekdays.

| Venue | Weekdays with a deep trough |
| --- | --- |
| Baker & Cook - Eng Kong Park (baker-cook-eng-kong-park) | 6 |
| Starbucks (starbucks-chinatown-food-street) | 7 |
| Starbucks (starbucks-chinatown-point) | 7 |
| Starbucks - Jurong Point (starbucks-jurong-point) | 7 |
| Starbucks Delfi Orchard (starbucks-delfi-orchard) | 6 |
| Starbucks Hillion Mall (starbucks-hillion-mall) | 5 |
| Starbucks UE Square (starbucks-ue-square) | 6 |
| Starbucks United Square (starbucks-united-square) | 7 |
| Starbucks Valley Point (starbucks-valley-point) | 5 |
| The Coffee Bean & Tea Leaf (coffee-bean-west-mall) | 7 |

**Evidence found.** `very_quiet` can be argued for in Phase 1.

## Per venue / weekday spread

| Venue | Day | Hours | Min | Max | Range | Median | IQR | Med→Max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Starbucks Centrepoint | mon | 14 | 44 | 90 | 46 | 66.0 | 14 | 24.0 |
| Starbucks Centrepoint | tue | 14 | 31 | 71 | 40 | 53.5 | 22 | 17.5 |
| Starbucks Centrepoint | wed | 14 | 25 | 60 | 35 | 50.0 | 14 | 10.0 |
| Starbucks Centrepoint | thu | 14 | 37 | 90 | 53 | 61.5 | 23 | 28.5 |
| Starbucks Centrepoint | fri | 14 | 34 | 81 | 47 | 69.0 | 13 | 12.0 |
| Starbucks Centrepoint | sat | 14 | 51 | 100 | 49 | 74.0 | 24 | 26.0 |
| Starbucks Centrepoint | sun | 14 | 31 | 81 | 50 | 54.0 | 26 | 27.0 |
| Starbucks SingHealth Tower | mon | 0 | — | — | — | — | — | — |
| Starbucks SingHealth Tower | tue | 0 | — | — | — | — | — | — |
| Starbucks SingHealth Tower | wed | 0 | — | — | — | — | — | — |
| Starbucks SingHealth Tower | thu | 0 | — | — | — | — | — | — |
| Starbucks SingHealth Tower | fri | 0 | — | — | — | — | — | — |
| Starbucks SingHealth Tower | sat | 0 | — | — | — | — | — | — |
| Starbucks SingHealth Tower | sun | 0 | — | — | — | — | — | — |
| Starbucks Wisma Atria | mon | 15 | 42 | 87 | 45 | 56.0 | 10 | 31.0 |
| Starbucks Wisma Atria | tue | 15 | 26 | 73 | 47 | 52.0 | 10 | 21.0 |
| Starbucks Wisma Atria | wed | 15 | 37 | 88 | 51 | 60.0 | 26 | 28.0 |
| Starbucks Wisma Atria | thu | 15 | 36 | 73 | 37 | 53.0 | 14 | 20.0 |
| Starbucks Wisma Atria | fri | 15 | 46 | 62 | 16 | 52.0 | 6 | 10.0 |
| Starbucks Wisma Atria | sat | 15 | 45 | 72 | 27 | 55.0 | 9 | 17.0 |
| Starbucks Wisma Atria | sun | 15 | 42 | 100 | 58 | 57.0 | 23 | 43.0 |
| Starbucks | mon | 0 | — | — | — | — | — | — |
| Starbucks | tue | 0 | — | — | — | — | — | — |
| Starbucks | wed | 0 | — | — | — | — | — | — |
| Starbucks | thu | 0 | — | — | — | — | — | — |
| Starbucks | fri | 0 | — | — | — | — | — | — |
| Starbucks | sat | 0 | — | — | — | — | — | — |
| Starbucks | sun | 0 | — | — | — | — | — | — |
| Starbucks | mon | 15 | 8 | 62 | 54 | 39.0 | 23 | 23.0 |
| Starbucks | tue | 15 | 15 | 66 | 51 | 58.0 | 15 | 8.0 |
| Starbucks | wed | 15 | 17 | 59 | 42 | 52.0 | 8 | 7.0 |
| Starbucks | thu | 15 | 19 | 60 | 41 | 54.0 | 13 | 6.0 |
| Starbucks | fri | 17 | 19 | 100 | 81 | 70.0 | 17 | 30.0 |
| Starbucks | sat | 17 | 20 | 90 | 70 | 81.0 | 35 | 9.0 |
| Starbucks | sun | 15 | 19 | 78 | 59 | 70.0 | 18 | 8.0 |
| Starbucks - Fusionopolis | mon | 14 | 32 | 96 | 64 | 47.5 | 31 | 48.5 |
| Starbucks - Fusionopolis | tue | 14 | 34 | 100 | 66 | 54.0 | 27 | 46.0 |
| Starbucks - Fusionopolis | wed | 14 | 32 | 84 | 52 | 48.5 | 17 | 35.5 |
| Starbucks - Fusionopolis | thu | 14 | 33 | 95 | 62 | 50.0 | 15 | 45.0 |
| Starbucks - Fusionopolis | fri | 14 | 24 | 74 | 50 | 39.0 | 22 | 35.0 |
| Starbucks - Fusionopolis | sat | 10 | 21 | 41 | 20 | 32.0 | 12 | 9.0 |
| Starbucks - Fusionopolis | sun | 10 | 9 | 29 | 20 | 27.0 | 12 | 2.0 |
| Starbucks Rochester Park | mon | 15 | 21 | 64 | 43 | 43.0 | 6 | 21.0 |
| Starbucks Rochester Park | tue | 15 | 30 | 74 | 44 | 48.0 | 25 | 26.0 |
| Starbucks Rochester Park | wed | 15 | 22 | 67 | 45 | 44.0 | 15 | 23.0 |
| Starbucks Rochester Park | thu | 15 | 34 | 84 | 50 | 51.0 | 20 | 33.0 |
| Starbucks Rochester Park | fri | 15 | 32 | 92 | 60 | 61.0 | 17 | 31.0 |
| Starbucks Rochester Park | sat | 15 | 33 | 100 | 67 | 78.0 | 37 | 22.0 |
| Starbucks Rochester Park | sun | 15 | 26 | 94 | 68 | 78.0 | 31 | 16.0 |
| Starbucks - West Mall | mon | 15 | 44 | 75 | 31 | 51.0 | 20 | 24.0 |
| Starbucks - West Mall | tue | 15 | 42 | 90 | 48 | 59.0 | 23 | 31.0 |
| Starbucks - West Mall | wed | 15 | 31 | 62 | 31 | 48.0 | 17 | 14.0 |
| Starbucks - West Mall | thu | 15 | 35 | 75 | 40 | 51.0 | 9 | 24.0 |
| Starbucks - West Mall | fri | 16 | 44 | 83 | 39 | 67.0 | 19 | 16.0 |
| Starbucks - West Mall | sat | 16 | 35 | 100 | 65 | 67.0 | 15 | 33.0 |
| Starbucks - West Mall | sun | 15 | 31 | 81 | 50 | 53.0 | 18 | 28.0 |
| Starbucks - HillV2 | mon | 15 | 26 | 66 | 40 | 38.0 | 7 | 28.0 |
| Starbucks - HillV2 | tue | 15 | 29 | 70 | 41 | 37.0 | 13 | 33.0 |
| Starbucks - HillV2 | wed | 15 | 30 | 79 | 49 | 43.0 | 13 | 36.0 |
| Starbucks - HillV2 | thu | 15 | 22 | 77 | 55 | 36.0 | 24 | 41.0 |
| Starbucks - HillV2 | fri | 16 | 27 | 80 | 53 | 44.0 | 25 | 36.0 |
| Starbucks - HillV2 | sat | 16 | 37 | 98 | 61 | 51.5 | 13 | 46.5 |
| Starbucks - HillV2 | sun | 15 | 22 | 100 | 78 | 50.0 | 42 | 50.0 |
| Starbucks HomeTeamNS Bukit Batok | mon | 15 | 29 | 64 | 35 | 44.0 | 8 | 20.0 |
| Starbucks HomeTeamNS Bukit Batok | tue | 15 | 28 | 81 | 53 | 50.0 | 17 | 31.0 |
| Starbucks HomeTeamNS Bukit Batok | wed | 15 | 33 | 100 | 67 | 55.0 | 15 | 45.0 |
| Starbucks HomeTeamNS Bukit Batok | thu | 15 | 33 | 85 | 52 | 48.0 | 22 | 37.0 |
| Starbucks HomeTeamNS Bukit Batok | fri | 15 | 37 | 54 | 17 | 50.0 | 7 | 4.0 |
| Starbucks HomeTeamNS Bukit Batok | sat | 15 | 45 | 80 | 35 | 67.0 | 11 | 13.0 |
| Starbucks HomeTeamNS Bukit Batok | sun | 15 | 48 | 80 | 32 | 66.0 | 12 | 14.0 |
| Starbucks United Square | mon | 16 | 9 | 97 | 88 | 43.0 | 30 | 54.0 |
| Starbucks United Square | tue | 16 | 8 | 88 | 80 | 48.0 | 34 | 40.0 |
| Starbucks United Square | wed | 16 | 10 | 93 | 83 | 49.5 | 35 | 43.5 |
| Starbucks United Square | thu | 16 | 7 | 82 | 75 | 48.0 | 33 | 34.0 |
| Starbucks United Square | fri | 16 | 7 | 77 | 70 | 55.5 | 36 | 21.5 |
| Starbucks United Square | sat | 16 | 12 | 100 | 88 | 59.5 | 39 | 40.5 |
| Starbucks United Square | sun | 16 | 10 | 96 | 86 | 61.0 | 27 | 35.0 |
| Starbucks Tekka Place | mon | 15 | 20 | 55 | 35 | 32.0 | 11 | 23.0 |
| Starbucks Tekka Place | tue | 15 | 27 | 53 | 26 | 46.0 | 12 | 7.0 |
| Starbucks Tekka Place | wed | 15 | 29 | 74 | 45 | 52.0 | 17 | 22.0 |
| Starbucks Tekka Place | thu | 15 | 20 | 57 | 37 | 42.0 | 8 | 15.0 |
| Starbucks Tekka Place | fri | 15 | 19 | 89 | 70 | 55.0 | 36 | 34.0 |
| Starbucks Tekka Place | sat | 15 | 18 | 91 | 73 | 61.0 | 36 | 30.0 |
| Starbucks Tekka Place | sun | 15 | 18 | 100 | 82 | 85.0 | 27 | 15.0 |
| Starbucks | mon | 15 | 26 | 77 | 51 | 54.0 | 27 | 23.0 |
| Starbucks | tue | 15 | 40 | 71 | 31 | 57.0 | 7 | 14.0 |
| Starbucks | wed | 15 | 24 | 71 | 47 | 66.0 | 18 | 5.0 |
| Starbucks | thu | 15 | 40 | 87 | 47 | 61.0 | 22 | 26.0 |
| Starbucks | fri | 17 | 31 | 86 | 55 | 74.0 | 22 | 12.0 |
| Starbucks | sat | 0 | — | — | — | — | — | — |
| Starbucks | sun | 0 | — | — | — | — | — | — |
| Starbucks Valley Point | mon | 15 | 33 | 82 | 49 | 65.0 | 5 | 17.0 |
| Starbucks Valley Point | tue | 15 | 31 | 96 | 65 | 79.0 | 29 | 17.0 |
| Starbucks Valley Point | wed | 15 | 45 | 100 | 55 | 75.0 | 16 | 25.0 |
| Starbucks Valley Point | thu | 15 | 35 | 79 | 44 | 72.0 | 18 | 7.0 |
| Starbucks Valley Point | fri | 15 | 23 | 89 | 66 | 70.0 | 23 | 19.0 |
| Starbucks Valley Point | sat | 15 | 29 | 66 | 37 | 43.0 | 18 | 23.0 |
| Starbucks Valley Point | sun | 15 | 24 | 56 | 32 | 46.0 | 16 | 10.0 |
| Starbucks UE Square | mon | 15 | 27 | 96 | 69 | 71.0 | 29 | 25.0 |
| Starbucks UE Square | tue | 15 | 24 | 100 | 76 | 79.0 | 20 | 21.0 |
| Starbucks UE Square | wed | 15 | 25 | 96 | 71 | 80.0 | 16 | 16.0 |
| Starbucks UE Square | thu | 15 | 31 | 97 | 66 | 75.0 | 25 | 22.0 |
| Starbucks UE Square | fri | 15 | 29 | 93 | 64 | 76.0 | 31 | 17.0 |
| Starbucks UE Square | sat | 15 | 19 | 72 | 53 | 50.0 | 23 | 22.0 |
| Starbucks UE Square | sun | 15 | 18 | 55 | 37 | 42.0 | 17 | 13.0 |
| Starbucks The Cathay | mon | 14 | 26 | 94 | 68 | 55.0 | 14 | 39.0 |
| Starbucks The Cathay | tue | 14 | 32 | 60 | 28 | 48.0 | 12 | 12.0 |
| Starbucks The Cathay | wed | 14 | 28 | 98 | 70 | 68.0 | 30 | 30.0 |
| Starbucks The Cathay | thu | 14 | 24 | 74 | 50 | 56.0 | 16 | 18.0 |
| Starbucks The Cathay | fri | 14 | 42 | 96 | 54 | 59.0 | 18 | 37.0 |
| Starbucks The Cathay | sat | 14 | 40 | 100 | 60 | 82.0 | 30 | 18.0 |
| Starbucks The Cathay | sun | 14 | 40 | 78 | 38 | 63.0 | 10 | 15.0 |
| Starbucks - One Holland Village | mon | 15 | 13 | 79 | 66 | 22.0 | 23 | 57.0 |
| Starbucks - One Holland Village | tue | 15 | 18 | 72 | 54 | 25.0 | 18 | 47.0 |
| Starbucks - One Holland Village | wed | 15 | 13 | 93 | 80 | 26.0 | 22 | 67.0 |
| Starbucks - One Holland Village | thu | 15 | 15 | 83 | 68 | 29.0 | 18 | 54.0 |
| Starbucks - One Holland Village | fri | 16 | 22 | 97 | 75 | 30.5 | 16 | 66.5 |
| Starbucks - One Holland Village | sat | 16 | 28 | 100 | 72 | 33.0 | 10 | 67.0 |
| Starbucks - One Holland Village | sun | 15 | 19 | 85 | 66 | 24.0 | 17 | 61.0 |
| Starbucks - Jurong Point | mon | 24 | 5 | 93 | 88 | 40.0 | 31 | 53.0 |
| Starbucks - Jurong Point | tue | 24 | 5 | 100 | 95 | 42.5 | 31 | 57.5 |
| Starbucks - Jurong Point | wed | 24 | 5 | 97 | 92 | 44.5 | 32 | 52.5 |
| Starbucks - Jurong Point | thu | 24 | 5 | 95 | 90 | 39.5 | 29 | 55.5 |
| Starbucks - Jurong Point | fri | 24 | 6 | 98 | 92 | 46.0 | 35 | 52.0 |
| Starbucks - Jurong Point | sat | 24 | 5 | 89 | 84 | 47.5 | 40 | 41.5 |
| Starbucks - Jurong Point | sun | 24 | 3 | 99 | 96 | 48.5 | 52 | 50.5 |
| Starbucks Hillion Mall | mon | 18 | 12 | 80 | 68 | 46.0 | 32 | 34.0 |
| Starbucks Hillion Mall | tue | 18 | 15 | 90 | 75 | 51.0 | 36 | 39.0 |
| Starbucks Hillion Mall | wed | 18 | 16 | 82 | 66 | 49.0 | 30 | 33.0 |
| Starbucks Hillion Mall | thu | 18 | 13 | 87 | 74 | 50.5 | 39 | 36.5 |
| Starbucks Hillion Mall | fri | 18 | 12 | 100 | 88 | 57.0 | 38 | 43.0 |
| Starbucks Hillion Mall | sat | 0 | — | — | — | — | — | — |
| Starbucks Hillion Mall | sun | 0 | — | — | — | — | — | — |
| Starbucks | mon | 15 | 7 | 69 | 62 | 47.0 | 18 | 22.0 |
| Starbucks | tue | 15 | 7 | 73 | 66 | 52.0 | 22 | 21.0 |
| Starbucks | wed | 15 | 8 | 72 | 64 | 52.0 | 22 | 20.0 |
| Starbucks | thu | 15 | 8 | 75 | 67 | 57.0 | 21 | 18.0 |
| Starbucks | fri | 16 | 5 | 77 | 72 | 60.5 | 37 | 16.5 |
| Starbucks | sat | 16 | 6 | 98 | 92 | 76.5 | 53 | 21.5 |
| Starbucks | sun | 15 | 5 | 100 | 95 | 69.0 | 43 | 31.0 |
| Starbucks ION Orchard | mon | 15 | 28 | 86 | 58 | 53.0 | 15 | 33.0 |
| Starbucks ION Orchard | tue | 15 | 36 | 72 | 36 | 50.0 | 23 | 22.0 |
| Starbucks ION Orchard | wed | 15 | 34 | 68 | 34 | 45.0 | 12 | 23.0 |
| Starbucks ION Orchard | thu | 15 | 27 | 77 | 50 | 48.0 | 8 | 29.0 |
| Starbucks ION Orchard | fri | 16 | 31 | 75 | 44 | 50.5 | 11 | 24.5 |
| Starbucks ION Orchard | sat | 16 | 37 | 78 | 41 | 50.5 | 11 | 27.5 |
| Starbucks ION Orchard | sun | 15 | 39 | 100 | 61 | 69.0 | 24 | 31.0 |
| Starbucks Delfi Orchard | mon | 16 | 28 | 80 | 52 | 67.0 | 19 | 13.0 |
| Starbucks Delfi Orchard | tue | 16 | 44 | 82 | 38 | 67.5 | 19 | 14.5 |
| Starbucks Delfi Orchard | wed | 16 | 20 | 91 | 71 | 65.5 | 25 | 25.5 |
| Starbucks Delfi Orchard | thu | 16 | 34 | 84 | 50 | 67.0 | 8 | 17.0 |
| Starbucks Delfi Orchard | fri | 16 | 25 | 75 | 50 | 61.5 | 33 | 13.5 |
| Starbucks Delfi Orchard | sat | 15 | 45 | 98 | 53 | 78.0 | 11 | 20.0 |
| Starbucks Delfi Orchard | sun | 15 | 34 | 100 | 66 | 74.0 | 15 | 26.0 |
| Starbucks Orchard Gateway | mon | 15 | 19 | 80 | 61 | 48.0 | 32 | 32.0 |
| Starbucks Orchard Gateway | tue | 15 | 35 | 100 | 65 | 70.0 | 23 | 30.0 |
| Starbucks Orchard Gateway | wed | 15 | 51 | 96 | 45 | 64.0 | 16 | 32.0 |
| Starbucks Orchard Gateway | thu | 15 | 45 | 80 | 35 | 61.0 | 16 | 19.0 |
| Starbucks Orchard Gateway | fri | 16 | 45 | 93 | 48 | 54.0 | 7 | 39.0 |
| Starbucks Orchard Gateway | sat | 16 | 22 | 83 | 61 | 49.5 | 17 | 33.5 |
| Starbucks Orchard Gateway | sun | 15 | 38 | 96 | 58 | 77.0 | 3 | 19.0 |
| Starbucks Takashimaya | mon | 15 | 34 | 85 | 51 | 54.0 | 15 | 31.0 |
| Starbucks Takashimaya | tue | 15 | 37 | 85 | 48 | 48.0 | 9 | 37.0 |
| Starbucks Takashimaya | wed | 15 | 28 | 65 | 37 | 42.0 | 11 | 23.0 |
| Starbucks Takashimaya | thu | 15 | 37 | 100 | 63 | 74.0 | 12 | 26.0 |
| Starbucks Takashimaya | fri | 15 | 40 | 74 | 34 | 54.0 | 20 | 20.0 |
| Starbucks Takashimaya | sat | 15 | 48 | 71 | 23 | 65.0 | 8 | 6.0 |
| Starbucks Takashimaya | sun | 15 | 37 | 74 | 37 | 62.0 | 8 | 12.0 |
| Baker & Cook - Eng Kong Park | mon | 14 | 26 | 66 | 40 | 50.5 | 24 | 15.5 |
| Baker & Cook - Eng Kong Park | tue | 14 | 20 | 71 | 51 | 62.5 | 17 | 8.5 |
| Baker & Cook - Eng Kong Park | wed | 14 | 22 | 92 | 70 | 55.5 | 25 | 36.5 |
| Baker & Cook - Eng Kong Park | thu | 14 | 22 | 65 | 43 | 57.0 | 17 | 8.0 |
| Baker & Cook - Eng Kong Park | fri | 14 | 20 | 94 | 74 | 77.0 | 34 | 17.0 |
| Baker & Cook - Eng Kong Park | sat | 14 | 22 | 81 | 59 | 73.5 | 24 | 7.5 |
| Baker & Cook - Eng Kong Park | sun | 14 | 27 | 100 | 73 | 78.5 | 24 | 21.5 |
| The Coffee Bean & Tea Leaf | mon | 24 | 10 | 88 | 78 | 55.0 | 42 | 33.0 |
| The Coffee Bean & Tea Leaf | tue | 24 | 14 | 81 | 67 | 48.0 | 25 | 33.0 |
| The Coffee Bean & Tea Leaf | wed | 24 | 11 | 100 | 89 | 52.0 | 33 | 48.0 |
| The Coffee Bean & Tea Leaf | thu | 24 | 14 | 100 | 86 | 48.5 | 40 | 51.5 |
| The Coffee Bean & Tea Leaf | fri | 24 | 12 | 100 | 88 | 59.0 | 41 | 41.0 |
| The Coffee Bean & Tea Leaf | sat | 24 | 12 | 93 | 81 | 61.0 | 50 | 32.0 |
| The Coffee Bean & Tea Leaf | sun | 24 | 9 | 86 | 77 | 58.5 | 57 | 27.5 |
| The Coffee Bean & Tea Leaf | mon | 15 | 41 | 71 | 30 | 58.0 | 13 | 13.0 |
| The Coffee Bean & Tea Leaf | tue | 15 | 54 | 100 | 46 | 71.0 | 21 | 29.0 |
| The Coffee Bean & Tea Leaf | wed | 15 | 39 | 86 | 47 | 54.0 | 22 | 32.0 |
| The Coffee Bean & Tea Leaf | thu | 15 | 26 | 93 | 67 | 41.0 | 17 | 52.0 |
| The Coffee Bean & Tea Leaf | fri | 15 | 39 | 80 | 41 | 56.0 | 15 | 24.0 |
| The Coffee Bean & Tea Leaf | sat | 15 | 34 | 97 | 63 | 45.0 | 7 | 52.0 |
| The Coffee Bean & Tea Leaf | sun | 15 | 32 | 80 | 48 | 56.0 | 24 | 24.0 |
| The Coffee Bean & Tea Leaf | mon | 16 | 29 | 70 | 41 | 52.0 | 17 | 18.0 |
| The Coffee Bean & Tea Leaf | tue | 16 | 29 | 92 | 63 | 59.0 | 16 | 33.0 |
| The Coffee Bean & Tea Leaf | wed | 16 | 36 | 63 | 27 | 43.5 | 12 | 19.5 |
| The Coffee Bean & Tea Leaf | thu | 16 | 27 | 84 | 57 | 42.5 | 24 | 41.5 |
| The Coffee Bean & Tea Leaf | fri | 16 | 31 | 70 | 39 | 49.0 | 23 | 21.0 |
| The Coffee Bean & Tea Leaf | sat | 16 | 27 | 100 | 73 | 45.5 | 20 | 54.5 |
| The Coffee Bean & Tea Leaf | sun | 16 | 24 | 76 | 52 | 36.0 | 8 | 40.0 |
