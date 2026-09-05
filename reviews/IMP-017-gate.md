# Gate record: IMP-017

## Gate invocation 1 — 2026-09-06

- **Gate route**: `claude_sonnet`, effort high
- **Brief source**: generated from HANDOFF.md acceptance criteria + required verification

### Checks run

- Read `HANDOFF.md`'s `## Current assignment` block for IMP-017 (ID, objective, acceptance criteria, required verification, scope exclusions).
- Read `git diff -- build/generate.py Makefile tests/python/test_generate.py` (working tree, uncommitted) in full.
- Confirmed `generate_index_html()` is byte-for-byte unchanged: the diff's only removed lines (`-`) are two module-docstring comment lines describing orchestration; the function body has zero additions/removals. The new code is a pure append: `import sys`, the new `main(*, data_dir=None, web_dir=None)`, and the `if __name__ == "__main__": sys.exit(main())` guard.
- Read `main()` in full context: it resolves `data_dir`/`web_dir` overrides (defaulting to the repo's real `data/`/`web/` via `Path(__file__).resolve().parent.parent`), calls the unmodified `generate_index_html()` with explicit paths, catches `GenerationError` and prints `generate: {exc}` to stderr returning 1, and on success prints `Wrote {path}` and returns 0. No raise on failure.
- Read the new `Makefile` `generate` target: `.PHONY: refresh generate` includes it; body is `.venv/bin/python3 build/generate.py`, matching `refresh`'s style; no network-capable call, no other logic.
- Read the new tests (`_write_generate_fixture_tree`, `test_main_regenerates_index_html_from_on_disk_data`, `test_main_returns_nonzero_and_reports_to_stderr_on_generation_error`) and grepped the new test code for references to real `data/`/`web/` paths — none found; all fixtures are built under `tmp_path`.
- Ran `.venv/bin/pytest tests/python/ -q` — `190 passed`, no failures.
- Ran `node --test tests/js/*.test.js` — `184 passed`, `0 fail`.
- Ran `make generate` from the repo root with `HTTP_PROXY`/`HTTPS_PROXY` pointed at an unreachable local port (so any real network attempt would fail loudly rather than silently succeed or silently use a real network path). Exit code 0, printed `Wrote /Users/darrensy/Projects/study-venue-planner/web/index.html`.
- Ran `git diff --stat -- web/index.html` immediately after — empty; the regenerated file is byte-identical to the committed one, proving deterministic, network-free regeneration from on-disk data.
- Manually exercised the failure path outside the real repo: wrote a throwaway script (deleted after use, never touched real `data/`/`web/`) building a `tmp_path`-style fixture tree missing `holidays.json`, called `main(data_dir=..., web_dir=...)` directly. Result: exit code 1, stderr `generate: holidays.json is required and was not found at .../data/holidays.json` (no traceback), stdout empty, `web/index.html` not created in that tree.
- Confirmed `build/refresh.py` has no working-tree changes (`git status --porcelain -- build/refresh.py` empty).
- Confirmed no stray files were left behind from the manual failure-path check (`git status --porcelain` clean aside from the reviewed diff plus unrelated pre-existing changes to `HANDOFF.md`/`reviews/LEDGER.md` and an untracked `.claude/` item, none of which this assignment's artifact list covers).

### Could not verify

- None.

### Not asked to check

- `HANDOFF.md` and `reviews/LEDGER.md` also show working-tree modifications, and there is an untracked `.claude/codex-arch-004-round2-prompt.md` — none are part of this assignment's artifact-under-review list (`build/generate.py`, `Makefile`, `tests/python/test_generate.py`), so not evaluated here.

### Status

`GATE_PASS`

---
