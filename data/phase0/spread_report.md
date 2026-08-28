# Phase 0 — Popular Times spread, coverage, and the N / P proposal

28 venues, 147 populated venue/weekday curves, 147 of them at or above MIN_HISTOGRAM_HOURS = 6.

**This measures the histogram's shape. It does not establish that Popular Times predicts seat availability** — nothing in Phase 0 can, and no line below should be read as evidence for it.

**Closed-hour buckets are excluded from every statistic below (397 buckets removed).** Popular Times reports 0 busyness for hours a venue is closed — that is a fact about closure, not a `quiet` reading, and an earlier run of this script that did not exclude them reported a median range roughly 3-4x too high because it was measuring 'closed vs peak' rather than 'quiet vs busy while open'. Any weekday whose regular hours could not be determined (e.g. the `multi_day_period` gap recorded in decisions.md) filters to zero open hours and correctly drops out of eligibility below, rather than being scored on a guess.

## Headline

| Measure | Value |
| --- | --- |
| Median per-curve range (max − min) | **56.0** points |
| Mean per-curve range | 58.1 points |
| Median per-curve IQR | 21.0 |
| Median per-curve median→max | 27.5 |
| Proposed `N` | **15** |
| Proposed `P` | **0** |

## Coverage — is `MIN_HISTOGRAM_HOURS = 6` right?

| Measure | Value |
| --- | --- |
| Populated curves | 147 |
| Min hourly buckets on a curve | 14 |
| Median hourly buckets | 15 |
| Max hourly buckets | 24 |
| Curves below 6 buckets (band → `unknown`) | 0 |

## Choosing `N` — distribution of |delta| from each curve's own median

| Percentile | \|delta\| |
| --- | --- |
| 50th | 11 |
| 67th | 17 |
| 75th | 21.0 |
| 90th | 34.5 |

`N` is proposed as **15**, the candidate nearest the 67th percentile (17). That leaves roughly two thirds of hours `typical` and splits the rest between `busy` and `quiet` — often enough to be useful, rarely enough to mean something.

Band mix at each candidate `N` (peak precedence applied at the proposed `P`):

| `N` | peak | busy | typical | quiet |
| --- | --- | --- | --- | --- |
| 5 | 7% | 30% | 27% | 37% |
| 8 | 7% | 24% | 39% | 30% |
| 10 | 7% | 21% | 46% | 26% |
| 12 | 7% | 18% | 51% | 24% |
| 15 ← | 7% | 13% | 60% | 20% |
| 20 | 7% | 8% | 70% | 15% |
| 25 | 7% | 6% | 76% | 11% |

## Choosing `P` — how wide is "within P points of the maximum"?

| `P` | mean peak hours per curve | max peak hours on one curve |
| --- | --- | --- |
| 0 ← | 1.2 | 3 |
| 2 | 1.6 | 6 |
| 3 | 1.9 | 7 |
| 5 | 2.3 | 10 |
| 8 | 3.2 | 10 |
| 10 | 3.7 | 12 |
| 15 | 4.9 | 14 |
| 20 | 6.3 | 15 |

`P` is proposed as the smallest candidate averaging 1-3 `peak` hours per venue/weekday. Wider and `peak` stops marking the genuinely worst hour and starts swallowing the afternoon.

> **Caveat.** The smallest candidate on the grid (`P` = 0) already fits, so the grid did not bracket the answer from below. `P` = 0 means *exactly at the maximum*, which makes `peak` fire on a single bucket that ordinary noise could move. Look at the curve shapes before accepting it.

## Does `very_quiet` earn a place?

plan.md admits it only on repeatable troughs around `2N` = 30 points below the median. Read here as the trough appearing on at least four of seven weekdays.

| Venue | Weekdays with a deep trough |
| --- | --- |
| Baker & Cook - Eng Kong Park | 6 |
| Starbucks | 17 |
| Starbucks - Jurong Point | 7 |
| Starbucks Hillion Mall | 6 |
| Starbucks UE Square | 6 |
| Starbucks United Square | 7 |
| The Coffee Bean & Tea Leaf | 8 |

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
| Starbucks - Fusionopolis | mon | 0 | — | — | — | — | — | — |
| Starbucks - Fusionopolis | tue | 0 | — | — | — | — | — | — |
| Starbucks - Fusionopolis | wed | 0 | — | — | — | — | — | — |
| Starbucks - Fusionopolis | thu | 0 | — | — | — | — | — | — |
| Starbucks - Fusionopolis | fri | 0 | — | — | — | — | — | — |
| Starbucks - Fusionopolis | sat | 0 | — | — | — | — | — | — |
| Starbucks - Fusionopolis | sun | 0 | — | — | — | — | — | — |
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
| Starbucks - West Mall | fri | 15 | 44 | 83 | 39 | 68.0 | 11 | 15.0 |
| Starbucks - West Mall | sat | 15 | 44 | 100 | 56 | 68.0 | 15 | 32.0 |
| Starbucks - West Mall | sun | 15 | 31 | 81 | 50 | 53.0 | 18 | 28.0 |
| Starbucks - HillV2 | mon | 15 | 26 | 66 | 40 | 38.0 | 7 | 28.0 |
| Starbucks - HillV2 | tue | 15 | 29 | 70 | 41 | 37.0 | 13 | 33.0 |
| Starbucks - HillV2 | wed | 15 | 30 | 79 | 49 | 43.0 | 13 | 36.0 |
| Starbucks - HillV2 | thu | 15 | 22 | 77 | 55 | 36.0 | 24 | 41.0 |
| Starbucks - HillV2 | fri | 16 | 27 | 80 | 53 | 44.0 | 25 | 36.0 |
| Starbucks - HillV2 | sat | 16 | 37 | 98 | 61 | 51.5 | 13 | 46.5 |
| Starbucks - HillV2 | sun | 15 | 22 | 100 | 78 | 50.0 | 42 | 50.0 |
| Starbucks HomeTeamNS Bukit Batok | mon | 14 | 29 | 64 | 35 | 45.0 | 10 | 19.0 |
| Starbucks HomeTeamNS Bukit Batok | tue | 14 | 28 | 81 | 53 | 49.5 | 18 | 31.5 |
| Starbucks HomeTeamNS Bukit Batok | wed | 14 | 33 | 100 | 67 | 54.5 | 16 | 45.5 |
| Starbucks HomeTeamNS Bukit Batok | thu | 14 | 33 | 85 | 52 | 45.5 | 24 | 39.5 |
| Starbucks HomeTeamNS Bukit Batok | fri | 15 | 37 | 54 | 17 | 50.0 | 7 | 4.0 |
| Starbucks HomeTeamNS Bukit Batok | sat | 15 | 45 | 80 | 35 | 67.0 | 11 | 13.0 |
| Starbucks HomeTeamNS Bukit Batok | sun | 14 | 48 | 80 | 32 | 66.5 | 13 | 13.5 |
| Starbucks United Square | mon | 15 | 9 | 97 | 88 | 45.0 | 15 | 52.0 |
| Starbucks United Square | tue | 15 | 8 | 88 | 80 | 48.0 | 20 | 40.0 |
| Starbucks United Square | wed | 15 | 10 | 93 | 83 | 51.0 | 24 | 42.0 |
| Starbucks United Square | thu | 15 | 7 | 82 | 75 | 49.0 | 23 | 33.0 |
| Starbucks United Square | fri | 15 | 7 | 77 | 70 | 57.0 | 30 | 20.0 |
| Starbucks United Square | sat | 15 | 12 | 100 | 88 | 62.0 | 29 | 38.0 |
| Starbucks United Square | sun | 15 | 10 | 96 | 86 | 62.0 | 24 | 34.0 |
| Starbucks Tekka Place | mon | 0 | — | — | — | — | — | — |
| Starbucks Tekka Place | tue | 0 | — | — | — | — | — | — |
| Starbucks Tekka Place | wed | 0 | — | — | — | — | — | — |
| Starbucks Tekka Place | thu | 0 | — | — | — | — | — | — |
| Starbucks Tekka Place | fri | 0 | — | — | — | — | — | — |
| Starbucks Tekka Place | sat | 0 | — | — | — | — | — | — |
| Starbucks Tekka Place | sun | 0 | — | — | — | — | — | — |
| Starbucks | mon | 15 | 26 | 77 | 51 | 54.0 | 27 | 23.0 |
| Starbucks | tue | 15 | 40 | 71 | 31 | 57.0 | 7 | 14.0 |
| Starbucks | wed | 15 | 24 | 71 | 47 | 66.0 | 18 | 5.0 |
| Starbucks | thu | 15 | 40 | 87 | 47 | 61.0 | 22 | 26.0 |
| Starbucks | fri | 17 | 31 | 86 | 55 | 74.0 | 22 | 12.0 |
| Starbucks | sat | 24 | 13 | 100 | 87 | 71.0 | 51 | 29.0 |
| Starbucks | sun | 22 | 16 | 71 | 55 | 44.0 | 36 | 27.0 |
| Starbucks Valley Point | mon | 0 | — | — | — | — | — | — |
| Starbucks Valley Point | tue | 0 | — | — | — | — | — | — |
| Starbucks Valley Point | wed | 0 | — | — | — | — | — | — |
| Starbucks Valley Point | thu | 0 | — | — | — | — | — | — |
| Starbucks Valley Point | fri | 0 | — | — | — | — | — | — |
| Starbucks Valley Point | sat | 0 | — | — | — | — | — | — |
| Starbucks Valley Point | sun | 0 | — | — | — | — | — | — |
| Starbucks UE Square | mon | 15 | 27 | 96 | 69 | 71.0 | 29 | 25.0 |
| Starbucks UE Square | tue | 15 | 24 | 100 | 76 | 79.0 | 20 | 21.0 |
| Starbucks UE Square | wed | 15 | 25 | 96 | 71 | 80.0 | 16 | 16.0 |
| Starbucks UE Square | thu | 15 | 31 | 97 | 66 | 75.0 | 25 | 22.0 |
| Starbucks UE Square | fri | 15 | 29 | 93 | 64 | 76.0 | 31 | 17.0 |
| Starbucks UE Square | sat | 15 | 19 | 72 | 53 | 50.0 | 23 | 22.0 |
| Starbucks UE Square | sun | 15 | 18 | 55 | 37 | 42.0 | 17 | 13.0 |
| Starbucks The Cathay | mon | 0 | — | — | — | — | — | — |
| Starbucks The Cathay | tue | 0 | — | — | — | — | — | — |
| Starbucks The Cathay | wed | 0 | — | — | — | — | — | — |
| Starbucks The Cathay | thu | 0 | — | — | — | — | — | — |
| Starbucks The Cathay | fri | 0 | — | — | — | — | — | — |
| Starbucks The Cathay | sat | 0 | — | — | — | — | — | — |
| Starbucks The Cathay | sun | 0 | — | — | — | — | — | — |
| Starbucks - One Holland Village | mon | 15 | 13 | 79 | 66 | 22.0 | 23 | 57.0 |
| Starbucks - One Holland Village | tue | 15 | 18 | 72 | 54 | 25.0 | 18 | 47.0 |
| Starbucks - One Holland Village | wed | 15 | 13 | 93 | 80 | 26.0 | 22 | 67.0 |
| Starbucks - One Holland Village | thu | 15 | 15 | 83 | 68 | 29.0 | 18 | 54.0 |
| Starbucks - One Holland Village | fri | 15 | 22 | 97 | 75 | 30.0 | 16 | 67.0 |
| Starbucks - One Holland Village | sat | 15 | 28 | 100 | 72 | 33.0 | 10 | 67.0 |
| Starbucks - One Holland Village | sun | 15 | 19 | 85 | 66 | 24.0 | 17 | 61.0 |
| Starbucks - Jurong Point | mon | 24 | 5 | 93 | 88 | 40.0 | 31 | 53.0 |
| Starbucks - Jurong Point | tue | 24 | 5 | 100 | 95 | 42.5 | 31 | 57.5 |
| Starbucks - Jurong Point | wed | 24 | 5 | 97 | 92 | 44.5 | 32 | 52.5 |
| Starbucks - Jurong Point | thu | 24 | 5 | 95 | 90 | 39.5 | 29 | 55.5 |
| Starbucks - Jurong Point | fri | 24 | 6 | 98 | 92 | 46.0 | 35 | 52.0 |
| Starbucks - Jurong Point | sat | 24 | 5 | 89 | 84 | 47.5 | 40 | 41.5 |
| Starbucks - Jurong Point | sun | 24 | 3 | 99 | 96 | 48.5 | 52 | 50.5 |
| Starbucks Hillion Mall | mon | 17 | 12 | 80 | 68 | 47.0 | 29 | 33.0 |
| Starbucks Hillion Mall | tue | 17 | 16 | 90 | 74 | 52.0 | 32 | 38.0 |
| Starbucks Hillion Mall | wed | 17 | 17 | 82 | 65 | 49.0 | 25 | 33.0 |
| Starbucks Hillion Mall | thu | 17 | 13 | 87 | 74 | 53.0 | 36 | 34.0 |
| Starbucks Hillion Mall | fri | 18 | 12 | 100 | 88 | 57.0 | 38 | 43.0 |
| Starbucks Hillion Mall | sat | 24 | 10 | 89 | 79 | 48.0 | 51 | 41.0 |
| Starbucks Hillion Mall | sun | 24 | 7 | 90 | 83 | 33.5 | 60 | 56.5 |
| Starbucks | mon | 15 | 7 | 69 | 62 | 47.0 | 18 | 22.0 |
| Starbucks | tue | 15 | 7 | 73 | 66 | 52.0 | 22 | 21.0 |
| Starbucks | wed | 15 | 8 | 72 | 64 | 52.0 | 22 | 20.0 |
| Starbucks | thu | 15 | 8 | 75 | 67 | 57.0 | 21 | 18.0 |
| Starbucks | fri | 15 | 5 | 77 | 72 | 63.0 | 21 | 14.0 |
| Starbucks | sat | 15 | 6 | 98 | 92 | 80.0 | 43 | 18.0 |
| Starbucks | sun | 15 | 5 | 100 | 95 | 69.0 | 43 | 31.0 |
| Starbucks ION Orchard | mon | 15 | 28 | 86 | 58 | 53.0 | 15 | 33.0 |
| Starbucks ION Orchard | tue | 15 | 36 | 72 | 36 | 50.0 | 23 | 22.0 |
| Starbucks ION Orchard | wed | 15 | 34 | 68 | 34 | 45.0 | 12 | 23.0 |
| Starbucks ION Orchard | thu | 15 | 27 | 77 | 50 | 48.0 | 8 | 29.0 |
| Starbucks ION Orchard | fri | 15 | 31 | 75 | 44 | 48.0 | 11 | 27.0 |
| Starbucks ION Orchard | sat | 15 | 45 | 78 | 33 | 51.0 | 11 | 27.0 |
| Starbucks ION Orchard | sun | 15 | 39 | 100 | 61 | 69.0 | 24 | 31.0 |
| Starbucks Delfi Orchard | mon | 0 | — | — | — | — | — | — |
| Starbucks Delfi Orchard | tue | 0 | — | — | — | — | — | — |
| Starbucks Delfi Orchard | wed | 0 | — | — | — | — | — | — |
| Starbucks Delfi Orchard | thu | 0 | — | — | — | — | — | — |
| Starbucks Delfi Orchard | fri | 0 | — | — | — | — | — | — |
| Starbucks Delfi Orchard | sat | 0 | — | — | — | — | — | — |
| Starbucks Delfi Orchard | sun | 0 | — | — | — | — | — | — |
| Starbucks Orchard Gateway | mon | 15 | 19 | 80 | 61 | 48.0 | 32 | 32.0 |
| Starbucks Orchard Gateway | tue | 15 | 35 | 100 | 65 | 70.0 | 23 | 30.0 |
| Starbucks Orchard Gateway | wed | 15 | 51 | 96 | 45 | 64.0 | 16 | 32.0 |
| Starbucks Orchard Gateway | thu | 15 | 45 | 80 | 35 | 61.0 | 16 | 19.0 |
| Starbucks Orchard Gateway | fri | 15 | 45 | 93 | 48 | 54.0 | 7 | 39.0 |
| Starbucks Orchard Gateway | sat | 15 | 22 | 83 | 61 | 48.0 | 17 | 35.0 |
| Starbucks Orchard Gateway | sun | 15 | 38 | 96 | 58 | 77.0 | 3 | 19.0 |
| Starbucks Takashimaya | mon | 14 | 34 | 85 | 51 | 52.5 | 20 | 32.5 |
| Starbucks Takashimaya | tue | 14 | 37 | 85 | 48 | 49.5 | 17 | 35.5 |
| Starbucks Takashimaya | wed | 14 | 28 | 65 | 37 | 41.0 | 17 | 24.0 |
| Starbucks Takashimaya | thu | 14 | 37 | 100 | 63 | 75.5 | 17 | 24.5 |
| Starbucks Takashimaya | fri | 14 | 40 | 74 | 34 | 54.0 | 20 | 20.0 |
| Starbucks Takashimaya | sat | 14 | 48 | 71 | 23 | 65.0 | 11 | 6.0 |
| Starbucks Takashimaya | sun | 14 | 37 | 74 | 37 | 58.0 | 14 | 16.0 |
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
| The Coffee Bean & Tea Leaf | mon | 14 | 41 | 71 | 30 | 58.0 | 18 | 13.0 |
| The Coffee Bean & Tea Leaf | tue | 14 | 54 | 100 | 46 | 72.0 | 29 | 28.0 |
| The Coffee Bean & Tea Leaf | wed | 14 | 39 | 86 | 47 | 58.5 | 26 | 27.5 |
| The Coffee Bean & Tea Leaf | thu | 14 | 26 | 93 | 67 | 43.0 | 30 | 50.0 |
| The Coffee Bean & Tea Leaf | fri | 15 | 39 | 80 | 41 | 56.0 | 15 | 24.0 |
| The Coffee Bean & Tea Leaf | sat | 15 | 34 | 97 | 63 | 45.0 | 7 | 52.0 |
| The Coffee Bean & Tea Leaf | sun | 14 | 32 | 80 | 48 | 54.0 | 26 | 26.0 |
| The Coffee Bean & Tea Leaf | mon | 16 | 29 | 70 | 41 | 52.0 | 17 | 18.0 |
| The Coffee Bean & Tea Leaf | tue | 16 | 29 | 92 | 63 | 59.0 | 16 | 33.0 |
| The Coffee Bean & Tea Leaf | wed | 16 | 36 | 63 | 27 | 43.5 | 12 | 19.5 |
| The Coffee Bean & Tea Leaf | thu | 16 | 27 | 84 | 57 | 42.5 | 24 | 41.5 |
| The Coffee Bean & Tea Leaf | fri | 16 | 31 | 70 | 39 | 49.0 | 23 | 21.0 |
| The Coffee Bean & Tea Leaf | sat | 16 | 27 | 100 | 73 | 45.5 | 20 | 54.5 |
| The Coffee Bean & Tea Leaf | sun | 16 | 24 | 76 | 52 | 36.0 | 8 | 40.0 |
