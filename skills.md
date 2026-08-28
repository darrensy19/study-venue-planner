# starbucks-planner — plugins & skills

Per-project tooling record, following the pattern in
[claude-project-installs](../claude-project-installs/). Sources:
[claude-plugins-reference](../claude-plugins-reference/README.md) (24 marketplace plugins) and
[claude-skills-reference](../claude-skills-reference/README.md) (22 standalone skills) — 46 total,
all listed below.

**Live state verified 2026-08-28** by running `claude plugin list` and `npx skills ls` from inside
`/Users/darrensy/Projects/starbucks-planner`, not read off the reference tables.

> **Project scope does not cascade.** Plugins and skills installed at `~/Projects`
> (`document-skills`, `hyperframes`, `grill-me`, `grill-with-docs`) do **not** apply here —
> confirmed: they report `✘ disabled` from inside this directory. Anything wanted here must be
> installed here.

**Recommend column:** ✅ Yes = install (or already have it) · ⏳ Later = real fit, but only once a
specific phase needs it · ❌ No = not applicable to this project.

**Origin column** — where the thing actually comes from, resolved by `readlink` on each install
rather than trusting `npx skills ls`, which reports both hand-authored and Claude-Code-bundled
skills as "local":

- **Mine** — hand-authored by me, versioned in [`~/Projects/claude-skills`](../claude-skills/)
  (pushed to `darrensy19/Claude-skills`) and symlinked into `~/.claude/skills/`.
- **Public** — third-party: a marketplace plugin, or an `npx skills` install from someone else's
  repo. All 24 plugins are public.
- **Bundled** — ships inside Claude Code itself; a real directory with no lock entry, nothing to
  install or remove.

## Full catalogue

| Name | Type | Description | Installed | Origin | Recommend |
| --- | --- | --- | --- | --- | --- |
| [claude-mem](../claude-plugins-reference/claude-mem.md) | Plugin | Persists context across sessions | Global | Public | ✅ Yes |
| [security-guidance](../claude-plugins-reference/security-guidance.md) | Plugin | Flags injection/XSS/secrets on edits and commits | Global | Public | ✅ Yes |
| [context7](../claude-plugins-reference/context7.md) | Plugin | Up-to-date library docs on demand | Global | Public | ✅ Yes |
| [code-review](../claude-plugins-reference/code-review.md) | Plugin | Catches logic bugs before they ship | Global | Public | ✅ Yes |
| [code-simplifier](../claude-plugins-reference/code-simplifier.md) | Plugin | Cleanup pass on recently-changed code | Global | Public | ✅ Yes |
| [claude-md-management](../claude-plugins-reference/claude-md-management.md) | Plugin | Keeps project memory/docs current | Global | Public | ✅ Yes |
| [superpowers](../claude-plugins-reference/superpowers.md) | Plugin | TDD, debugging, planning discipline | Global | Public | ✅ Yes |
| [close](../claude-skills-reference/close.md) | Skill | Session wrap-up (manual `/close`) | Global | **Mine** | ✅ Yes |
| [managing-claude-tooling](../claude-skills-reference/managing-claude-tooling.md) | Skill | Installs/removes tooling, syncs tracking docs | Global | **Mine** | ✅ Yes |
| [analyze-session-tokens](../claude-skills-reference/analyze-session-tokens.md) | Skill | Audits token/context efficiency of a past session | Global | **Mine** | ✅ Yes |
| [loose-ends](../claude-skills-reference/loose-ends.md) | Skill | Scans conversation for unresolved items | Global | **Mine** | ✅ Yes |
| [find-skills](../claude-skills-reference/find-skills.md) | Skill | Discover other agent skills | Global | Bundled | ✅ Yes |
| [git-guardrails-claude-code](../claude-skills-reference/git-guardrails-claude-code.md) | Skill | Blocks destructive git commands | Global | Public | ✅ Yes |
| [playwright](../claude-plugins-reference/playwright.md) | Plugin | Browser automation / E2E testing | **Project** | Public | ✅ Yes |
| [frontend-design](../claude-plugins-reference/frontend-design.md) | Plugin | Distinctive, non-generic UI design | **Project** | Public | ✅ Yes |
| [web-design-guidelines](../claude-skills-reference/web-design-guidelines.md) | Skill | Audits web UI against interface guidelines | **Project** | Public | ✅ Yes |
| [grill-me](../claude-skills-reference/grill-me.md) | Skill | Adversarial interview to sharpen a plan/design | **Project** | Public | ✅ Yes |
| [jupyter-notebook](../claude-skills-reference/jupyter-notebook.md) | Skill | Scaffolds/edits Jupyter notebooks | Not yet | Public | ⏳ Later (Phase 3) |
| [just-scrape](../claude-skills-reference/just-scrape.md) | Skill | Web scraping/crawling via ScrapeGraph | Not yet | Public | ⏳ Later (Phase 0, if needed) |
| [firecrawl](../claude-plugins-reference/firecrawl.md) | Plugin | Web scraping/crawling/monitoring | Not yet | Public | ⏳ Later (Phase 0, last resort) |
| [writing-guidelines](../claude-skills-reference/writing-guidelines.md) | Skill | Audits docs/prose | Not yet | Public | ⏳ Later (optional) |
| [claude-code-setup](../claude-plugins-reference/claude-code-setup.md) | Plugin | One-time automation audit at kickoff | Not yet | Public | ⏳ Later (optional, now or never) |
| [document-skills](../claude-plugins-reference/document-skills.md) | Plugin | Word/Excel/PowerPoint/PDF editing | Not yet | Public | ❌ No |
| [figma](../claude-plugins-reference/figma.md) | Plugin | Read/push Figma designs | Not yet | Public | ❌ No |
| [impeccable](../claude-plugins-reference/impeccable.md) | Plugin | Frontend polish/anti-pattern audit | Not yet | Public | ❌ No |
| [typescript-lsp](../claude-plugins-reference/typescript-lsp.md) | Plugin | TypeScript/JS language server | Not yet | Public | ❌ No |
| [claude-api](../claude-plugins-reference/claude-api.md) | Plugin | Claude/Anthropic API reference | Not yet | Public | ❌ No |
| [mattpocock-skills](../claude-plugins-reference/mattpocock-skills.md) | Plugin | Ticket/spec-driven engineering | Not yet | Public | ❌ No |
| [feature-dev](../claude-plugins-reference/feature-dev.md) | Plugin | Explore/architect/review agent split | Not yet | Public | ❌ No |
| [notion](../claude-plugins-reference/notion.md) | Plugin | Notion docs/tasks/knowledge base | Not yet | Public | ❌ No |
| [pr-review-toolkit](../claude-plugins-reference/pr-review-toolkit.md) | Plugin | Deeper multi-agent PR review | Not yet | Public | ❌ No |
| [task-observer](../claude-plugins-reference/task-observer.md) | Plugin | Meta-improvement of other skills (unvetted) | Not yet | Public | ❌ No |
| [skill-creator](../claude-plugins-reference/skill-creator.md) | Plugin | Author/benchmark a new Claude Code skill | Not yet | Public | ❌ No |
| [learning-output-style](../claude-plugins-reference/learning-output-style.md) | Plugin | Teaching / "★ Insight" output style | Not yet | Public | ❌ No |
| [example-skills](../claude-plugins-reference/example-skills.md) | Plugin | 12 unrelated bundled skills, all-or-nothing | Not yet | Public | ❌ No |
| [grill-with-docs](../claude-skills-reference/grill-with-docs.md) | Skill | Same interview as `grill-me`, plus ADRs + glossary | Not yet | Public | ❌ No |
| [improve-codebase-architecture](../claude-skills-reference/improve-codebase-architecture.md) | Skill | Scans for architecture improvements | Not yet | Public | ❌ No |
| [hyperframes](../claude-skills-reference/hyperframes.md) | Skill | Video/animation from HTML | Not yet | Public | ❌ No |
| [mlflow-onboarding](../claude-skills-reference/mlflow-onboarding.md) | Skill | One-time MLflow onboarding | Not yet | Public | ❌ No |
| [deploy-to-vercel](../claude-skills-reference/deploy-to-vercel.md) | Skill | Deploy to Vercel | Not yet | Public | ❌ No |
| [vercel-cli-with-tokens](../claude-skills-reference/vercel-cli-with-tokens.md) | Skill | Vercel CLI token auth | Not yet | Public | ❌ No |
| [vercel-composition-patterns](../claude-skills-reference/vercel-composition-patterns.md) | Skill | React composition patterns | Not yet | Public | ❌ No |
| [vercel-optimize](../claude-skills-reference/vercel-optimize.md) | Skill | Vercel cost/performance optimization | Not yet | Public | ❌ No |
| [vercel-react-best-practices](../claude-skills-reference/vercel-react-best-practices.md) | Skill | React/Next.js performance guidelines | Not yet | Public | ❌ No |
| [vercel-react-native-skills](../claude-skills-reference/vercel-react-native-skills.md) | Skill | React Native / Expo best practices | Not yet | Public | ❌ No |
| [vercel-react-view-transitions](../claude-skills-reference/vercel-react-view-transitions.md) | Skill | React View Transition API | Not yet | Public | ❌ No |

**17 active here** — 13 global + 4 project-scoped, installed 2026-08-28 · 5 deferred ·
24 not applicable.
By origin: 4 Mine · 41 Public · 1 Bundled.

## Installed 2026-08-28 — verified

All four confirmed from inside `/Users/darrensy/Projects/starbucks-planner`:

| Name | Verified by | Result |
| --- | --- | --- |
| `playwright` | `claude plugin list` | `Scope: project` · `Status: ✔ enabled` |
| `frontend-design` | `claude plugin list` | `Scope: project` · `Status: ✔ enabled` |
| `web-design-guidelines` | `npx skills ls` | `.agents/skills/web-design-guidelines`, lock entry present |
| `grill-me` | `npx skills ls` | `.agents/skills/grill-me`, lock entry present |

On-disk artefacts, all committed (matching the convention in `fantasy-hoops`, which tracks the
same set): `.claude/settings.json` (the two plugin registrations), `.agents/skills/*` (12 KB of
vendored skill content), `.claude/skills/*` (symlinks into `.agents/`), and `skills-lock.json`.

---

## Why the four recommendations

~113 tokens/message total on top of the ~1,070 baseline. Two are effectively free.

| Name | Cost | Why this project |
| --- | --- | --- |
| `playwright` | **0** | Strongest of the four. Solves two concrete problems at zero always-on cost: Phase 0 needs the `starbucks.com.sg/stores/` XHR endpoint, which is invisible in the HTML and needs a browser to capture; and Phase 1's acceptance criterion is "readable on iPhone portrait", which needs a real viewport, not a guess. |
| `frontend-design` | 54 | There is a real UI — a mobile-first ranked list with a drill-down sparkline. That *is* the Phase 1 deliverable. |
| `web-design-guidelines` | ~46 | Audits the built UI against interface guidelines; framework-agnostic, so it works on vanilla HTML/CSS. Complements `frontend-design` (design vs. audit), doesn't duplicate it. |
| `grill-me` | ~13 | Manual-invoke only, so near-free. `plan.md` still has open Phase 0 questions and is heading into external review; an adversarial interview is the current need. The Projects-root install does **not** cover this repo. |

```bash
cd /Users/darrensy/Projects/starbucks-planner
claude plugin install playwright@claude-plugins-official --scope project
claude plugin install frontend-design@claude-plugins-official --scope project

nvm use 24   # Anaconda's default Node v18.15 crashes the skills CLI
npx skills add vercel-labs/agent-skills@web-design-guidelines -y
npx skills add mattpocock/skills@grill-me -y
```

## Why the five deferrals

| Name | Cost | Install when |
| --- | --- | --- |
| `firecrawl` | **1,458** | Only if Phase 0 proves the Starbucks SG locator needs real HTML scraping. SerpApi returns structured JSON and needs no scraper, so this may never be justified — it is the catalogue's most expensive item, more than the entire current baseline. |
| `just-scrape` | ~87 | The cheap alternative if light scraping does turn out necessary. Prefer this over `firecrawl` at 1/17th the cost unless crawling or monitoring is genuinely needed. |
| `jupyter-notebook` | — | Phase 3. Fitting P(seat) on ~30 thin observations is exploratory work a notebook suits. Roughly four months out. |
| `writing-guidelines` | ~52 | Optional. The repo is currently all prose (`plan.md` is 373 lines) and the reference's own lookup maps "docs-heavy repo" here — but the docs have just been reviewed. |
| `claude-code-setup` | 92 | Optional, and *now* is the only sensible moment — a one-time kickoff automation audit. Install, run, remove. |

## Why the Vercel/React block is out

All seven Tier 3 skills fail both gates: this deploys to **GitHub Pages**, not Vercel, and uses
**vanilla JS**, not React — both deliberate `plan.md` decisions. Revisit only if the "tipping
point" clause fires and the frontend ports to React, and even then only the React-specific ones;
the Vercel deploy skills stay irrelevant on GitHub Pages.

---

## Tracking-doc drift found while writing this

### Fixed 2026-08-28

- **`claude-project-installs/fantasy-hoops.md:55`** claimed `grill-me`/`grill-with-docs` were
  "available globally-adjacent via Projects root if ever needed". Wrong — project scope does not
  cascade, verified live from this directory. The same misreading would have led to skipping
  `grill-me` here. Reason text replaced with the accurate one. Checked `cadence.md` and
  `trackers.md` too — both already gave a correct, different reason, so this was the only instance.
- **`claude-skills-reference/README.md:56` was a broken link.** It listed `frontend-design` in its
  Tier 2 table pointing at `frontend-design.md`, which does not exist in that repo —
  `frontend-design` is a marketplace plugin tracked at
  `claude-plugins-reference/frontend-design.md`, and the row was absent from that README's own
  "Installed where" matrix. Since that doc's stated scope is standalone skills only, the row was
  removed; the quick-lookup entry now cross-links to the plugins reference and labels it a plugin.
  No token total needed recalculating — Tier 2 has no total line. Every relative `.md` link in both
  reference READMEs was then confirmed to resolve.

Neither tracking repo is a git repo, so these are saved to disk with nothing to commit.

### Tracking docs synced 2026-08-28

Done once the four installs landed, so the record describes real state rather than empty cells:

- **Created `claude-project-installs/starbucks-planner.md`** — the fourth per-project file, joining
  `fantasy-hoops`, `cadence`, and `trackers`.
- **Added a `starbucks-planner` column** to the "Installed where" matrix in both reference READMEs
  — 24 plugin rows and 22 skill rows, 17 ✅ between them.
- **Added project-scoped reproduce blocks** to both READMEs, each with a note that scope does not
  cascade from `~/Projects` into this repo.
- **Updated four individual reference files** — `playwright.md`, `frontend-design.md`,
  `web-design-guidelines.md`, `grill-me.md` — Status lines, per-project install/remove notes, and
  rationale.

Two further drift items were found and fixed in `grill-me.md` while updating it: its Remove block
showed `-g`, contradicting its own Status line recording the global copy's removal on 2026-08-23;
and a Notes line claimed a copy existed "in both project and global skills (see Duplicates below)"
— wrong about the global copy, and referring to a `Duplicates` section that has never existed in
that file.
