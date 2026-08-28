# starbucks-planner — plugins & skills

Per-project tooling decisions. The machine-wide catalogue, current install
state, and token costs live in
[`~/Projects/claude-tooling/README.md`](../claude-tooling/README.md) — this
file holds only the judgment specific to this repo.

Everything in the global Tier 1 baseline applies here too and isn't repeated.
Project scope does **not** cascade: the `~/Projects`-root installs
(`document-skills`, `hyperframes`, `grill-me`, `grill-with-docs`) do not reach
this repo — confirmed live, they report `disabled` from inside this directory.

## Installed here, beyond the baseline

~113 tokens/message on top of the ~1,070 baseline. Two of the four are free.

| Name | Kind | Always-on | Why this project |
| --- | --- | --- | --- |
| playwright | Plugin | 0 | Strongest of the four. Solves two concrete problems at zero always-on cost: Phase 0 needs the `starbucks.com.sg/stores/` XHR endpoint, which is invisible in the HTML and needs a browser to capture; and Phase 1's acceptance criterion is "readable on iPhone portrait", which needs a real viewport, not a guess. |
| frontend-design | Plugin | 54 | There is a real UI — a mobile-first ranked list with a drill-down sparkline. That *is* the Phase 1 deliverable. |
| web-design-guidelines | Skill | 46 | Audits the built UI against interface guidelines; framework-agnostic, so it works on vanilla HTML/CSS. Complements `frontend-design` (design vs. audit), doesn't duplicate it. |
| grill-me | Skill | 13 | Manual-invoke only, so near-free. `plan.md` still has open Phase 0 questions and is heading into external review; an adversarial interview is the current need. The Projects-root install does **not** cover this repo. |

## Deliberately skipped

| Name | Kind | Tier | Why not |
| --- | --- | --- | --- |
| firecrawl | Plugin | 2 | Deferred, not rejected — 1,458 tokens/msg is the catalogue's most expensive item, more than this project's entire baseline. SerpApi returns structured JSON, so scraping may never be needed. Revisit only if Phase 0 proves the Starbucks SG locator needs real HTML scraping |
| just-scrape | Skill | 2 | Deferred — the ~87-token alternative to `firecrawl` if light scraping does turn out necessary in Phase 0. Prefer this over `firecrawl` unless crawling/monitoring is genuinely needed |
| jupyter-notebook | Skill | 2 | Deferred to Phase 3 (~4 months out) — fitting P(seat) on ~30 thin observations suits a notebook, but there's no data to explore yet |
| writing-guidelines | Skill | 2 | Optional — repo is currently all prose, but the docs have just been reviewed |
| claude-code-setup | Plugin | 3 | Optional one-time kickoff audit; install-run-remove if wanted, not carried |
| document-skills | Plugin | 2 | 1,028 tokens for Office/PDF work; this project outputs JSON and a static page |
| figma | Plugin | 2 | No Figma file — the UI is designed in code |
| impeccable | Plugin | 2 | Alternative to `frontend-design` — don't run both |
| typescript-lsp | Plugin | 2 | Vanilla JS, no build step, no TypeScript — a deliberate `plan.md` decision |
| claude-api | Plugin | 2 | No LLM-powered feature; the scrapers call SerpApi and Google, not Anthropic |
| mattpocock-skills | Plugin | 2 | Alternative to `superpowers` — don't run both |
| feature-dev | Plugin | 2 | Overlaps `superpowers`; this is a small solo build |
| notion | Plugin | 2 | Docs live in this repo |
| pr-review-toolkit | Plugin | 2 | Solo repo, no PR workflow |
| task-observer | Skill | 2 | Trialled and removed 2026-08-28, before first use. Not a safety call — the bundle inspects clean (no network calls, stdlib-only scripts), and the much-cited Reddit review describes a pre-3.0 build whose data-loss bug no longer exists. Held off as redundant with the auto-memory system at this skill count, for 254 tokens/message |
| skill-creator | Plugin | 3 | Not authoring a skill here |
| learning-output-style | Plugin | 3 | Output style, not workflow-relevant |
| example-skills | Plugin | 4 | 12 unrelated bundled skills, all-or-nothing |
| hyperframes | Skill | 2 | No video or motion output |
| grill-with-docs | Skill | 4 | `grill-me` covers the need; ADRs + glossary are overkill for a personal tool |
| improve-codebase-architecture | Skill | 4 | No codebase yet — revisit if Phase 3 triggers the React port |
| mlflow-onboarding | Skill | 5 | Experiment tracking for a pooled logistic regression on ~30 observations is disproportionate |
| Tier 3 Vercel/React skills (7) | Skill | 3 | Deploys to **GitHub Pages**, not Vercel, and uses vanilla JS, not React — both gates fail |

## Notes

- The Vercel/React tier fails **both** gates: this deploys to GitHub Pages, not
  Vercel, and uses vanilla JS, not React — both deliberate `plan.md` decisions.
  Revisit only if the "tipping point" clause fires and the frontend ports to
  React, and even then only the React-specific skills.
- `firecrawl` is deferred, not rejected. At 1,458 tokens/message it costs more
  than this project's entire baseline; SerpApi returns structured JSON, so it
  may never be justified. If light scraping does turn out necessary, prefer
  `just-scrape` at roughly 1/17th the cost.
