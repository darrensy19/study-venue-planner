# BACKLOG.md

Deferred items surfaced by `/close` and `/loose-ends` — parked, not forgotten.
Not for active or in-progress work (see PLAN.md / DECISIONS.md). Flip Status
to `closed` in place rather than deleting a row; detail stays below for the
record.

| ID    | Date       | Source | Item | Status |
| ----- | ---------- | ------ | ---- | ------ |
| BL-001 | 2026-09-03 | /close | `scraper/hours.py`'s `_decompose_current_period` emits a spurious zero-length `{open:0, close:0}` entry when a `currentOpeningHours` period closes exactly at 00:00 on the next date (e.g. `08-29 07:30 → 08-30 00:00`), instead of emitting no entry for that date at all. Reproduced directly against the shipped `IMP-006` parser. Fix: skip emitting an entry when the decomposed `open == close` for that offset (the half-open `[open, close)` interval doesn't touch a date the close merely reaches). Fixed in `IMP-007` (closed 2026-09-03). | closed |

---
