# Assignment ledger

Append-only. One row per allocated ID, written at allocation time, before any other
assignment artifact exists. Never edited, reordered, or deleted. Gaps are expected and
must never be filled.

`ARCH`, `IMP`, and `WF` are counted independently — the next ID for a prefix is one above
the highest ever allocated for that prefix, never derived from this table's row count.

This file answers exactly one question: the next ID. It carries no completion status and
no verification route — those change after the row is written, and a row that changes is
not an allocation record you can trust. See `reviews/AUDIT-LOG.md` for the append-only
event history the sampling audit reads instead.

| ID | Allocated | Work type | Objective (one line) |
| --- | --- | --- | --- |
| `IMP-001` | 2026-08-30 | implementation | ranking.js hours-resolution & feasibility-tier core (resolve_hours, effective_close, tiers) |
