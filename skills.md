# starbucks-planner — plugins & skills

Per-project tooling record, following the pattern in
[claude-project-installs](../claude-project-installs/). Sources:
[claude-plugins-reference](../claude-plugins-reference/README.md) (marketplace plugins) and
[claude-skills-reference](../claude-skills-reference/README.md) (standalone skills).
Those docs carry the full tier rationale, token costs, and install commands — this file is the
per-project decision record.

**Live state verified 2026-08-28** by running `claude plugin list` and `npx skills ls` from
inside `/Users/darrensy/Projects/starbucks-planner`, not read off the reference tables.

> **Project scope does not cascade.** Plugins installed at `~/Projects` (`document-skills`,
> `hyperframes`, `grill-me`, `grill-with-docs`) do **not** apply here — confirmed: they all
> report `✘ disabled` from inside this directory. Anything wanted here must be installed here.

## Currently active (verified, nothing installed project-scoped yet)

All 13 come from global/user scope. This project has **zero** project-scoped plugins or skills.

| Name | Type | Tier | Description | Scope |
| --- | --- | --- | --- | --- |
| [claude-mem](../claude-plugins-reference/claude-mem.md) | Plugin | 1 | Persists context across sessions | Global |
| [security-guidance](../claude-plugins-reference/security-guidance.md) | Plugin | 1 | Flags injection/XSS/secrets on edits and commits | Global |
| [context7](../claude-plugins-reference/context7.md) | Plugin | 1 | Up-to-date library docs on demand | Global |
| [code-review](../claude-plugins-reference/code-review.md) | Plugin | 1 | Catches logic bugs before they ship | Global |
| [code-simplifier](../claude-plugins-reference/code-simplifier.md) | Plugin | 1 | Cleanup pass on recently-changed code | Global |
| [claude-md-management](../claude-plugins-reference/claude-md-management.md) | Plugin | 1 | Keeps project memory/docs current | Global |
| [superpowers](../claude-plugins-reference/superpowers.md) | Plugin | 1 | TDD, debugging, planning discipline | Global |
| [find-skills](../claude-skills-reference/find-skills.md) | Skill | 1 | Discover other agent skills | Global |
| [close](../claude-skills-reference/close.md) | Skill | 1 | Session wrap-up (manual `/close`) | Global |
| [git-guardrails-claude-code](../claude-skills-reference/git-guardrails-claude-code.md) | Skill | 1 | Blocks destructive git commands | Global |
| [managing-claude-tooling](../claude-skills-reference/managing-claude-tooling.md) | Skill | 1 | Installs/removes tooling, syncs tracking docs | Global |
| [analyze-session-tokens](../claude-skills-reference/analyze-session-tokens.md) | Skill | 1 | Audits token/context efficiency of a past session | Global |
| [loose-ends](../claude-skills-reference/loose-ends.md) | Skill | 1 | Scans conversation for unresolved items | Global |

Baseline cost: ~650 tokens/msg (plugins) + ~420 (skills) ≈ **1,070 tokens/message** before
anything project-specific.

---

## Recommended — install now

Four items, **~113 tokens/message total**. Two are effectively free.

| Name | Type | Tier | Cost | Why this project |
| --- | --- | --- | --- | --- |
| [playwright](../claude-plugins-reference/playwright.md) | Plugin | 2 | **0** | Strongest recommendation. Solves two concrete problems at zero always-on cost: (1) Phase 0 needs the `starbucks.com.sg/stores/` XHR endpoint, which is invisible in the HTML and needs a browser to capture; (2) Phase 1's acceptance criterion is "readable on iPhone portrait", which needs a real viewport, not a guess. |
| [frontend-design](../claude-plugins-reference/frontend-design.md) | Plugin | 2 | 54 | There is a real UI — a mobile-first ranked list with a drill-down sparkline. This is the whole Phase 1 deliverable. |
| [web-design-guidelines](../claude-skills-reference/web-design-guidelines.md) | Skill | 2 | ~46 | Audits the built UI against interface guidelines; framework-agnostic, so it works on vanilla HTML/CSS. Pairs with `frontend-design` (design vs. audit, not duplicates). |
| [grill-me](../claude-skills-reference/grill-me.md) | Skill | 4 | ~13 | Manual-invoke only, so near-free. `plan.md` is about to go through external review and still has open Phase 0 questions — an adversarial interview is exactly the current need. Do **not** assume the Projects-root install covers this; it doesn't. |

```bash
cd /Users/darrensy/Projects/starbucks-planner
claude plugin install playwright@claude-plugins-official --scope project
claude plugin install frontend-design@claude-plugins-official --scope project

nvm use 24   # Anaconda's default Node v18.15 crashes the skills CLI
npx skills add vercel-labs/agent-skills@web-design-guidelines -y
npx skills add mattpocock/skills@grill-me -y
```

## Recommended — defer until a phase actually needs it

| Name | Type | Tier | Cost | Install when |
| --- | --- | --- | --- | --- |
| [firecrawl](../claude-plugins-reference/firecrawl.md) | Plugin | 2 | **1,458** | Only if Phase 0 shows the Starbucks SG locator needs real HTML scraping. SerpApi returns structured JSON and needs no scraper at all, so this may never be justified — it is the most expensive item in the entire catalog, ~1.4× the current total baseline. |
| [just-scrape](../claude-skills-reference/just-scrape.md) | Skill | 2 | ~87 | The cheap alternative to `firecrawl` if light scraping turns out necessary. Prefer this over `firecrawl` at 1/17th the cost unless crawling/monitoring is genuinely needed. |
| [jupyter-notebook](../claude-skills-reference/jupyter-notebook.md) | Skill | 2 | — | Phase 3. Fitting P(seat) on ~30 thin observations is exploratory work a notebook suits. Roughly four months out — don't carry it until then. |
| [writing-guidelines](../claude-skills-reference/writing-guidelines.md) | Skill | 2 | ~52 | Optional now. The repo is currently 100% prose (`plan.md` is 373 lines) and the reference's own lookup table maps "docs-heavy repo" to this. Judgement call — the docs are already reviewed. |
| [claude-code-setup](../claude-plugins-reference/claude-code-setup.md) | Plugin | 3 | 92 | Optional, and *now* is the only sensible moment — it's a one-time kickoff automation audit. Install, run, remove. |

## Not applicable (checked, deliberately skipped)

| Name | Type | Tier | Why not |
| --- | --- | --- | --- |
| [document-skills](../claude-plugins-reference/document-skills.md) | Plugin | 2 | 1,028 tokens for Word/Excel/PowerPoint/PDF. This project outputs JSON and a static page. |
| [figma](../claude-plugins-reference/figma.md) | Plugin | 2 | No Figma file; the UI is being designed in code. |
| [impeccable](../claude-plugins-reference/impeccable.md) | Plugin | 2 | Alternative to `frontend-design` — don't run both. |
| [typescript-lsp](../claude-plugins-reference/typescript-lsp.md) | Plugin | 2 | Vanilla JS with no build step and no TypeScript — a deliberate `plan.md` decision, not an oversight. |
| [claude-api](../claude-plugins-reference/claude-api.md) | Plugin | 2 | No LLM-powered feature. The scrapers call SerpApi and Google, not Anthropic. |
| [mattpocock-skills](../claude-plugins-reference/mattpocock-skills.md) | Plugin | 2 | Alternative to `superpowers` — don't run both. |
| [feature-dev](../claude-plugins-reference/feature-dev.md) | Plugin | 2 | Explore/architect/review agent split; overlaps `superpowers` and this is a small solo build. |
| [notion](../claude-plugins-reference/notion.md) | Plugin | 2 | Docs live in this repo. |
| [pr-review-toolkit](../claude-plugins-reference/pr-review-toolkit.md) | Plugin | 2 | Solo repo, no PR workflow. |
| [task-observer](../claude-plugins-reference/task-observer.md) | Plugin | 2 | Not vetted; rewrites skills unattended. |
| [skill-creator](../claude-plugins-reference/skill-creator.md) | Plugin | 3 | Not authoring a skill here. |
| [learning-output-style](../claude-plugins-reference/learning-output-style.md) | Plugin | 3 | Output style, not workflow-relevant. |
| [example-skills](../claude-plugins-reference/example-skills.md) | Plugin | 4 | 12 unrelated bundled skills, all-or-nothing. |
| [hyperframes](../claude-skills-reference/hyperframes.md) | Skill | 2 | No video or motion output. |
| [grill-with-docs](../claude-skills-reference/grill-with-docs.md) | Skill | 4 | `grill-me` covers the need; ADRs + glossary are overkill for a personal tool. |
| [improve-codebase-architecture](../claude-skills-reference/improve-codebase-architecture.md) | Skill | 4 | No codebase yet — revisit if Phase 3 triggers the React port. |
| [mlflow-onboarding](../claude-skills-reference/mlflow-onboarding.md) | Skill | 5 | Experiment tracking for a pooled logistic regression on ~30 observations is disproportionate. |
| Tier 3 Vercel/React skills (all 7) | Skill | 3 | Deploys to **GitHub Pages**, not Vercel, and uses vanilla JS, not React. Both gates fail. Covers `deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-composition-patterns`, `vercel-optimize`, `vercel-react-best-practices`, `vercel-react-native-skills`, `vercel-react-view-transitions`. |

Revisit the Tier 3 block only if `plan.md`'s "tipping point" clause fires and the frontend ports
to React — and even then, only the React-specific ones; the Vercel deploy skills stay irrelevant
while this is on GitHub Pages.

---

## Tracking-doc drift found while writing this

Recorded, not yet fixed — these live in other repos:

1. **`starbucks-planner` has no column** in the "Installed where" matrix of either reference
   README, and no `claude-project-installs/starbucks-planner.md`. Only `fantasy-hoops`,
   `cadence`, and `trackers` have files.
2. **`claude-project-installs/fantasy-hoops.md:55`** says `grill-me`/`grill-with-docs` are
   "available globally-adjacent via Projects root if ever needed". That is wrong — project scope
   does not cascade, verified live from this directory. The same misreading would have led to
   skipping `grill-me` here.
3. **`claude-skills-reference/README.md:56` has a broken link.** It lists `frontend-design` in
   its Tier 2 table pointing at `frontend-design.md` — that file does not exist in
   `claude-skills-reference/`. `frontend-design` is a marketplace plugin, tracked at
   `claude-plugins-reference/frontend-design.md`. It also isn't in that README's own "Installed
   where" matrix, so the row is an orphan in two ways.
