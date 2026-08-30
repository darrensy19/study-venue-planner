# Gate record: IMP-001

## Gate invocation 1 — 2026-08-30

- **Gate route**: `claude_sonnet`, effort high
- **Brief source**: generated from HANDOFF.md acceptance criteria + required verification

### Checks run

- **Artifact exists and postdates baseline.** `git log --oneline f6aa4f0 -1` confirms `f6aa4f0` = "Adopt cross-agent-workflow". `git diff f6aa4f0 --stat -- web/ranking.js tests/js/` shows `web/ranking.js` (414 insertions, new file) and `tests/js/ranking.test.js` (579 insertions, new file) both introduced since baseline, in commit `1677066` ("Implement ranking.js's hours-resolution and feasibility-tier core (IMP-001)"). `git log --oneline -1 -- web/ranking.js` confirms `1677066` is the only commit touching the file. Full diff since baseline (`git diff f6aa4f0 HEAD --stat`) also shows `package.json` (new, `{"private": true, "type": "module"}`) and one line added to `.gitignore` (`.claude/RESUME.md`) plus `HANDOFF.md`/`reviews/LEDGER.md` bookkeeping — incidental supporting changes (ESM resolution for `node --test`), not touching any excluded artifact (`fetch_hours.py`, `fetch_busyness.py`, `build/refresh.py`, `app.js`, `index.template.html`).

- **`node --test tests/js/` rerun independently.** `node --version` → `v18.15.0`. Ran `node --test tests/js/` from repo root myself (not trusting any prior claim): output ends `# tests 38`, `# pass 38`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`. All 38 subtests printed `ok`. **Passing, confirmed first-hand.**

- **No DOM imports / no `fetch()`.** `grep -n -E 'fetch\(|document\.|window\.|localStorage' web/ranking.js` → no matches (exit 1). `grep -n '^import' web/ranking.js` → no matches (exit 1). File header (line 1) also self-declares "No DOM, no fetch, no imports." Confirmed clean by grep, not by trusting the comment.

- **Every `surplus_*` use goes through an accessor.** Read `web/ranking.js` in full and grepped every `surplus` occurrence (lines 261–414). Findings: the only code that inspects `surplus.kind` / `surplus.minutes` directly is inside the four named accessor functions themselves (`passesFeasibility` L261-263, `finiteShortfall` L269-277, `sortKey` L279-281, `display` L295-300) — i.e., that *is* the accessor implementation, not a bypass. Every external call site consumes a surplus value only via `passesFeasibility(...)` (L394, L402) or `finiteShortfall(...)` (L402), or constructs/forwards the tagged object without arithmetic (`surplus: AT_LEAST_0` L341, `surplus: finiteSurplus(...)` L348, `surplusMid`/`surplusUpper` passthrough L410/L412). No raw comparison, subtraction, or string-formatting of `surplus.minutes` outside the accessors. Confirmed compliant.

- **Acceptance-criteria test-coverage cross-check** (read `tests/js/ranking.test.js` in full, 580 lines, 38 tests — not just counted names):
  - **Multi-day decomposition**: L287-306, a 7-day decomposed chain (Mon anchor → Sat close) joining through self-contained daily entries to the true final close. Genuinely represented.
  - **Window handling**: only the "missing in-window entry treated as malformed" sub-case is represented (L123-126, `resolveHours` throws). The other two sub-cases CLAUDE.md's Testing section lists under this heading — "all seven dates materialised" and "interior truncation failing validation" — are **not present anywhere in the repo** (confirmed: `find tests -type f` returns only `tests/js/ranking.test.js`; `tests/python/` does not exist yet). On inspection, `web/ranking.js` itself contains no window-completeness or truncation-validation logic — `resolveHours` only looks up the one date it's asked for and throws if absent; truncation/window-materialisation is fetcher-side work. That places these two sub-cases outside IMP-001's declared scope exclusion (`fetch_hours.py`), so their absence here is a scope boundary, not a defect in this artifact — but it means the acceptance criterion "window handling" is only partially represented in `tests/js/`.
  - **Continuity across the window edge**: L332-345 (ends at boundary as a known close), L347-360 (joins into 24/7 regular, COVERED), L362-375 (crossing into unresolvable date → UNKNOWN). The specific sub-case "a `closing_buffer` that crosses midnight" has no test isolating the buffer as the specific contributor to a midnight crossing — but `requiredEndAbs` is computed as one sum (`arrivalAbs + durationMinutes + closingBufferMinutes`, L327) with no code path distinguishing duration- vs buffer-driven crossing, and the existing midnight-crossing tests (L259, L287, L308, L332, L347, L362, L377) exercise that arithmetic path regardless of which term drives it. Functionally covered; not narrated as a standalone case.
  - **Source authority**: strongly represented — L196-205 (in-window `closed` beats a 24/7 regular previous day), L207-216 (out-of-window holiday beats regular overnight carry-in), L377-422 (three period shapes — finite overnight, finite multi-day, `always_open` — all correctly yield `UNKNOWN` rather than outranking a later date's holiday authority).
  - **The lazy walk**: L259-273 and L308-318 both use a `tripwireRegular()` fixture that throws if the walk ever resolves a date it shouldn't need — proves laziness by construction, not just by assertion on the result.
  - **`NONE` vs `UNKNOWN`**: L511-525 (upper `NONE` fails `robust`, midpoint still evaluates to `tight`), L527-536 (midpoint `NONE` → `shorter`), L538-550 (either bound `UNKNOWN` → `hours-unknown`, no tier metrics). Matches CLAUDE.md's testing spec precisely.
  - **`AT_LEAST(0)` accessors**: L426-445, L566-579 — all three accessors plus the `display()`-never-falls-back-to-`sortKey()` guarantee (finite -10 renders "10m short", not "0").
  - **Tier boundaries**: L471-484 (shortfall exactly at `toleranceMinutes` → `tight`), L486-494 (one minute past → `shorter`) — the `FEASIBILITY_TOLERANCE_MINUTES` edge CLAUDE.md's Testing section explicitly calls for. L496-509 covers `robust` being upper-bound-only (full midpoint coverage, upper-bound shortfall → `tight`).

- **Spot-check against CLAUDE.md's hours-resolution contract** (read `CLAUDE.md` in full; inspected `web/ranking.js` L58-60, 127-175, 215-251, 363-414 against it):
  - Minimum-`period_end_abs` tie-break only among *equal* matches, disagreeing matches rejected as `validation_failure` (L154-163) — matches the refined rule in CLAUDE.md's Testing section (not the looser "take the minimum" phrasing in Non-negotiables alone), and is itself under test (L218-232 equal tie-break; L234-255 disagreement rejected).
  - Source-authority admission of the previous date gated on `authority === "regular"` only (L131), matching "current" and "holiday_unknown" both excluding the lookback.
  - `effectiveClose`'s `needsVerification` gate (L223-226) correctly trusts a `current`-authority crossing entry directly (only `authority === "regular"` triggers the crossing check) and requires verification for `always_open` / `continues_beyond_window` / a `regular` crossing — matches the three-shape rule.
  - `robust` computed on the upper bound alone (L394); `tight`'s `finiteShortfall` call is provably safe only via the `!midNone` guard plus OR short-circuit (L401-403), matching the accessor's own documented precondition.
  - `AT_LEAST(0)` never serialises `Infinity` — asserted directly by test L578 (`JSON.stringify` with an `Infinity`-substitution replacer, confirming none reaches the result object) and by the module comment (L57).
  - No violation found in this spot-check. One non-blocking observation: a `regular`-authority period that crosses midnight but whose `requiredEndAbs` falls **before** the midnight boundary returns `COVERED` (L229) rather than a finite close, even though the pre-midnight portion of that close is independently trustworthy. Reasoned through against the "walk only looks as far as `required_end_abs` demands" principle (CLAUDE.md, `effective_close` non-negotiable) and against `AT_LEAST(0)`'s definition ("a real integer margin, or the tag") — this is consistent with intended lazy-walk semantics (returning a precise number here isn't needed and isn't required by the contract), not a violation. No test isolates this exact corner, but the behavior it would exercise is only a precision question, not a correctness one.

### Could not verify

- None. All required checks (test run, DOM/fetch grep, accessor-discipline read, acceptance-criteria cross-check, contract spot-check) were performed directly against the repo.

### Not asked to check

- `tests/python/` and the fetcher-side (`fetch_hours.py`) validation logic that would cover "all seven dates materialised" and "interior truncation failing validation" — explicitly out of IMP-001's scope exclusions, and not evaluated here.
- `app.js` / `index.template.html` integration — how `ranking.js` will actually be consumed by the browser UI (import-line stripping, top-level scope collision with `app.js`) — explicitly excluded from this assignment's scope and not checked.
- `seat_confidence`, `backup_strength`, Plan A/B machinery — explicitly deferred to later assignments per the brief; not evaluated.
- Runtime/model verification of which model actually authored the primary's commit — not observable from this environment; not claimed either way.
- Whether `HANDOFF.md`'s prose (beyond baseline commit and artifact identification, which were independently confirmed via `git log`/`git diff`) accurately narrates the implementation — not re-derived beyond what the brief itself covers.

### Status

`GATE_PASS`

---
