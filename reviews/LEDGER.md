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
| `ARCH-001` | 2026-08-30 | architecture/high-level | Session-end/return-transport feasibility requirement |
| `WF-001` | 2026-08-31 | workflow amendment | Sync WORKFLOW.md/AGENTS.md/CLAUDE.md/reviews/TEMPLATE.md and `.cross-agent-workflow/` scripts to the updated skill templates |
| `IMP-002` | 2026-08-31 | implementation | Implement ARCH-001's session-end return-transport design in ranking.js |
| `IMP-003` | 2026-08-31 | implementation | relative_busyness banding and seat_confidence lookup in ranking.js |
| `IMP-004` | 2026-08-31 | implementation | backup_strength grading and Plan B recalculation in ranking.js |
| `IMP-005` | 2026-08-31 | implementation | travel-band ("N-Mm") string-to-minutes parser for access[][].band / fallbacks[].travel_band |
| `ARCH-002` | 2026-09-01 | architecture/high-level | Phase 1 orchestration/UI-shell architecture — fetch layer, venue-source registry, coarsening, refresh orchestration, return-validator bridge, ranking pipeline, HTML generation, frontend shell |
| `IMP-006` | 2026-09-03 | implementation | Phase 1 step 1: venue-source registry + bootstrap, hours parser, fetch_hours |
| `IMP-007` | 2026-09-03 | implementation | Fix GAP 2: currentOpeningHours decomposition emits a zero-length entry on a period closing exactly at 00:00 |
| `IMP-008` | 2026-09-03 | implementation | Phase 1 step 2: SerpApi transport/parser and fetch_busyness(source) |
| `IMP-009` | 2026-09-03 | implementation | Phase 1 step 3: Node return-validator bridge (validateReturnTransport export + subprocess.run bridge) |
