# Phase 0 — Popular Times availability and histogram timezone

26 of 28 venues returned a Popular Times graph. Routes that worked: ['confirmed_absent_after_retry', 'search+data', 'search_collapsed'].

## Venues with no Popular Times data

- Starbucks SingHealth Tower
- Starbucks

## Timezone cross-check

first non-zero busyness hour minus earliest regular opening hour, per venue; SerpApi states no timezone for the Popular Times graph.

Offsets observed (hours): [0]. A tight cluster around 0 means the graph is in venue-local time and `histogram_timezone` equals `hours_timezone`.

| # | Venue | First active hour | Earliest open hour | Offset |
| --- | --- | --- | --- | --- |
| 1 | Starbucks Centrepoint | 08:00 | 08:00 | +0h |
| 3 | Starbucks Wisma Atria | 07:00 | 07:00 | +0h |
| 5 | Starbucks | 07:00 | 07:00 | +0h |
| 6 | Starbucks - Fusionopolis | 07:00 | 07:00 | +0h |
| 7 | Starbucks Rochester Park | 07:00 | 07:00 | +0h |
| 8 | Starbucks - West Mall | 07:00 | 07:00 | +0h |
| 9 | Starbucks - HillV2 | 07:00 | 07:00 | +0h |
| 10 | Starbucks HomeTeamNS Bukit Batok | 07:00 | 07:00 | +0h |
| 11 | Starbucks United Square | 07:00 | 07:00 | +0h |
| 12 | Starbucks Tekka Place | 07:00 | 07:00 | +0h |
| 14 | Starbucks Valley Point | 07:00 | 07:00 | +0h |
| 15 | Starbucks UE Square | 07:00 | 07:00 | +0h |
| 16 | Starbucks The Cathay | 08:00 | 08:00 | +0h |
| 17 | Starbucks - One Holland Village | 07:00 | 07:00 | +0h |
| 20 | Starbucks | 07:00 | 07:00 | +0h |
| 21 | Starbucks ION Orchard | 07:00 | 07:00 | +0h |
| 22 | Starbucks Delfi Orchard | 06:00 | 06:00 | +0h |
| 23 | Starbucks Orchard Gateway | 07:00 | 07:00 | +0h |
| 24 | Starbucks Takashimaya | 07:00 | 07:00 | +0h |
| 25 | Baker & Cook - Eng Kong Park | 07:00 | 07:00 | +0h |
| 27 | The Coffee Bean & Tea Leaf | 08:00 | 08:00 | +0h |
| 28 | The Coffee Bean & Tea Leaf | 07:00 | 07:00 | +0h |
