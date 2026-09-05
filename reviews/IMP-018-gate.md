# Gate record: IMP-018

## Gate invocation 1 — 2026-09-06

- **Gate route**: `claude_sonnet`, effort high
- **Brief source**: generated from HANDOFF.md acceptance criteria + required verification

### Checks run

- **Diff scope confirmed against brief**: `git status` shows working-tree changes to `BACKLOG.md`
  (pre-existing, unrelated, per brief — ignored), `HANDOFF.md` and `reviews/LEDGER.md` (expected
  allocation bookkeeping, one new `IMP-018` row), `web/app.js` (in scope), and `web/index.html`
  (not named in the brief's "Artifact under review" list, but independently confirmed below to be
  a pure mechanical `make generate` regeneration output of the `app.js` change — see the
  determinism check). New untracked `tests/js/app.test.js` and `tests/js/dom-stub.js` (in scope).
  Untracked `.claude/` is unrelated local tooling scaffolding, not part of this assignment.
- **Full diff read**: `git diff -- web/app.js` shows exactly three hunks — `export` added to
  `const state`, `export` added to `function render(state)`, and the bootstrap guard changed from
  bare `if (document.readyState === "loading") {...} else {...}` to
  `if (typeof document !== "undefined") { <same body> }`. Nothing else in the file changed — no
  `ranking.js` touch, no rendering/vocabulary change, no dependency added. Both new test files read
  in full (`tests/js/dom-stub.js`, `tests/js/app.test.js`).
- **`.venv/bin/pytest tests/python/ -q`**: `190 passed` — matches `IMP-017`'s gate baseline (190),
  no regression, and this assignment does not touch Python.
- **`node --test tests/js/*.test.js`**: `187 passed, 0 failed` — up from `IMP-017`'s recorded
  baseline of 184, exactly `+3` for the two new tests plus the importability test added in this
  assignment (`tests/js/app.test.js` contributes 3 top-level tests: importability, `render()`
  structure, and the submit-handler round trip).
- **Non-vacuity — bootstrap-guard revert**: replaced the guarded block in `web/app.js` with the
  original unguarded `if (document.readyState === "loading") {...} else {...}` (verbatim, via a
  scripted string replace against the exact committed hunk text), reran
  `node --test tests/js/app.test.js`. Result: all 3 tests fail —
  `Cannot read properties of undefined (reading 'state')`, because `import("../../web/app.js")`
  itself throws (`document` is not defined at module scope with no guard) and `appModule` stays
  `undefined`, cascading into the other two tests. Confirms the new tests actually catch the
  regression they exist to catch. Restored `web/app.js` from a pre-revert backup; `git diff --
  web/app.js` afterward is byte-identical to the pre-revert diff (same three hunks, same content);
  reran `node --test tests/js/app.test.js` after restore — `3 passed, 0 failed`, confirming the
  restore was exact and did not leave the tree in a different state.
- **`make generate` determinism, network blocked, twice**: ran
  `https_proxy=http://127.0.0.1:1 http_proxy=http://127.0.0.1:1 make generate` twice in direct
  succession. Both runs exited `0` (`.venv/bin/python3 build/generate.py` / "Wrote
  .../web/index.html"). `md5` of `web/index.html` was identical across both runs
  (`82d8fd7e98651d3146da5114bdf57013`) and also identical to the working-tree copy that was already
  present before these two runs — which independently confirms the pre-existing `web/index.html`
  diff in `git status` was itself exactly this regeneration (i.e., mechanical build output tracking
  the `app.js` change, not a hand edit introducing separate scope).
- **Scope discipline on `web/app.js`**: confirmed via the full diff read above — only the two
  `export` keywords and the bootstrap-guard rewrite. No `ranking.js` changes, no `style.css`
  changes, no rendering/vocabulary changes, and `readControlsFromForm()`'s pre-existing
  missing-fields gap (flagged as out of scope, deferred to slice 1a) is untouched.
- **DOM stub dependency-free and bounded**: `grep -rn "jsdom\|playwright"` across the repo (outside
  `node_modules`) returns only the negation comment inside `dom-stub.js` itself ("no jsdom, no
  Playwright"). `package.json` is `{"private": true, "type": "module"}` — no `dependencies` key at
  all, zero-dependency confirmed. `tests/js/dom-stub.js`'s `StubElement`/`StubDocument`/
  `StubFormData` implement only node creation, `className`/`textContent`, `setAttribute`/
  `getAttribute`, `appendChild`/`replaceChildren`, `addEventListener`/`dispatchEvent`, and a
  `findByName` test helper explicitly marked "not a real DOM API" — no CSS/layout, no real browser
  form-validity API, no focus/IME, no accessibility-tree surface. Matches `CLAUDE.md`'s stated
  bounds for this stub verbatim.
- **Event-driven rendering test exercises real production code, not a shortcut**: traced
  `tests/js/app.test.js`'s submit test against `web/app.js` source —
  `form.addEventListener("submit", ...)` at line 290 calls `readControlsFromForm(form)` at line 292,
  which itself calls `new FormData(form)` (line 87) unmodified. The test binds
  `globalThis.FormData = StubFormData` before dispatching the submit event, so the real,
  unmodified `readControlsFromForm` → `FormData.get()` → `rankVenues()` → `render()` path runs
  end to end; nothing in `app.js` was changed or bypassed to make the test pass. Confirmed the
  "Test Venue" text assertion in the first render test is real production output, not a fixture
  artifact: `makeVenue()` sets no `name` field, but `app.js`'s `displayName(venueId)` (line 66)
  title-cases the venue id (`"test-venue"` → `"Test Venue"`), so the assertion is exercising real
  code, not asserting against a value the fixture happened to supply directly. No assertion in
  either new render test would pass against a `render()` that did nothing — both check for
  specific structural output (`root.children[0].tagName === "FORM"`, a `plan-card tier-robust`
  node with matching text, and the form node identity actually changing after re-render).

### Could not verify

- None — every acceptance criterion and required verification item in the brief was independently
  reproduced first-hand (test run outputs, the revert/restore round trip, and the two `make
  generate` runs), not taken from the primary's report.

### Not asked to check

- The brief's required verification does not ask for a check of `web/index.html`'s diff at all
  (it names only the three artifact files); this gate performed one anyway, since an unexplained
  fourth modified file in `git status` is exactly the kind of thing scope review exists to catch.
  It resolved cleanly (mechanical regeneration output), but future briefs for this same slice
  pattern may want to name `web/index.html` explicitly as an expected side effect rather than
  leaving a gate to reconstruct that on its own.
- Not independently re-verified: `readControlsFromForm()`'s pre-existing missing-fields gap
  (explicitly out of scope per the brief and `DECISIONS.md`'s 2026-09-06 note) — confirmed only
  that this assignment's diff does not touch that function, not the gap's own behavior.
  `tests/js/ranking.test.js` and the rest of the pre-existing `tests/js/` suite were exercised only
  as part of the full `node --test tests/js/*.test.js` run, not individually re-read for content
  changes (`git status` shows no modification to any pre-existing test file, so none was needed).
- The `.claude/` untracked directory and `BACKLOG.md`'s pre-existing uncommitted diff were noted
  but not read in detail, per the brief's explicit instruction to treat them as out of scope for
  this assignment.

### Status

`GATE_PASS`

---
