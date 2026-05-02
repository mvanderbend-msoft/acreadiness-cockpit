# acreadiness-cockpit

A GitHub Copilot **agent plugin** that drives [Microsoft AgentRC](https://github.com/microsoft/agentrc) through three skills and one custom agent — no servers, no MCP, just chat.

> Frames every interaction inside AgentRC's **Measure → Generate → Maintain** loop.

## What's in the plugin

### Custom agent

| Agent | What it does |
|---|---|
| `@ai-readiness-reporter` | Runs `agentrc readiness --json`, interprets every result against the 9-pillar / 5-level model, then writes a self-contained `reports/index.html` you can open with `file://`. Honours policies (disabled criteria, overrides, pass-rate thresholds) and surfaces extras separately. |

### Skills

| Skill | What it does |
|---|---|
| `/assess` | **Measure** — runs the readiness scan and hands off to `@ai-readiness-reporter` to produce the static HTML dashboard. Accepts `--policy <path-or-pkg>` and `--per-area`. |
| `/generate-instructions` | **Generate** — wraps `agentrc instructions` to write `.github/copilot-instructions.md` (default) or `AGENTS.md`. Supports `flat`/`nested` strategies and emits per-area `.github/instructions/<area>.instructions.md` files with `applyTo` globs for monorepos. |
| `/policy` | **Maintain** — helps you pick, scaffold, or apply an AgentRC policy. Knows the schema (`criteria.disable` / `criteria.override` / `extras` / `thresholds`), the impact-weight table, and CI gating with `--fail-level`. |

## What gets produced

`reports/index.html` — a single self-contained HTML file rendered from a fixed template (`agents/report-template.html` in the plugin) so the report looks identical for every user. It contains:

- Maturity badge (L1–L5) and overall score / grade (A–F)
- Pass-rate vs threshold (when a policy sets one)
- Maturity progression table ("◼ You are here")
- **Active policy** summary (disabled/overridden criteria, threshold)
- **Repo Health** breakdown (8 pillars) — each card shows *AI relevance* (High/Medium/Low), *what it measures*, *why it matters for AI*, *current state*, *recommendation*
- **AI Setup** breakdown (AI Tooling pillar)
- **Extras** (informational only — agents-doc, pr-template, pre-commit, architecture-doc)
- **Prioritised Remediation Plan** (🔴 Fix First / 🟡 Fix Next / 🔵 Plan)
- Embedded raw AgentRC JSON for re-use

## Prerequisites

- **Node.js 20+** on PATH (required by AgentRC)
- VS Code with Copilot agent plugins enabled (`chat.plugins.enabled`)

## Install

### Option A — marketplace (recommended)

In VS Code: **Extensions → Agent Plugins → Add Marketplace**, then paste:

```
https://raw.githubusercontent.com/mvanderbend-msoft/acreadiness-cockpit/main/.github/plugin/marketplace.json
```

### Option B — install from source

**Extensions → Agent Plugins → Install from Source…**:

```
https://github.com/mvanderbend-msoft/acreadiness-cockpit
```

## Usage

In Copilot chat:

```text
/assess                                  # measure → reports/index.html
/assess --policy ./policies/strict.json  # measure with a policy
/generate-instructions                    # asks: flat or nested?
/generate-instructions --strategy flat    # one .github/copilot-instructions.md
/generate-instructions --strategy nested  # hub + per-topic files in .agents/
/generate-instructions --areas            # also emit per-area .instructions.md with applyTo
/generate-instructions --area frontend --apply-to "apps/frontend/**"
/policy new my-policy                     # scaffold a custom policy
@ai-readiness-reporter                    # invoke the reporter directly
```

### Output: VS Code-native by default

`/generate-instructions` writes to `.github/copilot-instructions.md` by default — the file VS Code Copilot picks up automatically as always-on instructions. Pass `--output AGENTS.md` if you want the multi-agent format instead (Copilot + Claude + others).

### Per-area instructions with `applyTo`

For monorepos with `agentrc.config.json` areas, the skill also emits VS Code `.instructions.md` files — one per area — at `.github/instructions/<area>.instructions.md`. Each file starts with frontmatter so VS Code only loads it when the active file matches:

```markdown
---
applyTo: "apps/frontend/**"
---

# Frontend area instructions
…
```

The skill reads each area's `paths` from `agentrc.config.json` and uses that as the `applyTo` glob. You can override on a single-area call with `--apply-to "<glob>"`. The root `.github/copilot-instructions.md` always loads; `.instructions.md` files layer on top for matching paths.

### Flat vs nested instructions

`/generate-instructions` always asks which layout you want unless you pass `--strategy` explicitly. Pick based on the shape of your repo:

| | **Flat** *(default)* | **Nested** |
|---|---|---|
| Hub file | `.github/copilot-instructions.md` | `.github/copilot-instructions.md` |
| Detail files | — | `.github/instructions/<topic>.instructions.md` (each with `applyTo` glob) |
| Best for | Small / medium repos, single stack, single team | Large or multi-stack repos, monorepos, multiple teams |
| Review | One file, one PR | Multiple smaller files — each topic can be reviewed by its owners |
| Token cost for the agent | Lowest — the whole file always loads | Lower per-task — VS Code only loads topics whose `applyTo` matches the active file |
| Optional | — | Add `--claude-md` to also emit `CLAUDE.md` |
| Monorepos | Combine with `--areas` for per-area `applyTo` files | Combine with `--areas` — topic files + per-area files coexist in `.github/instructions/` |

**Why `.github/instructions/` and not `.agents/`?** When the main output is `.github/copilot-instructions.md`, this skill rewrites AgentRC's nested output into VS Code's native `.instructions.md` layout — that's the location Copilot auto-discovers. If you instead choose `--output AGENTS.md`, nested keeps AgentRC's default `.agents/` layout for agent-agnostic tooling.

**Rule of thumb:** start with `flat`. Switch to `nested` once the file grows beyond ~300 lines, you have more than 5 top-level directories, or different parts of the repo have meaningfully different conventions.

You can also pass options directly:

```text
/generate-instructions --output .github/copilot-instructions.md --strategy flat
/generate-instructions --output AGENTS.md --strategy flat
/generate-instructions --strategy nested --claude-md
/generate-instructions --strategy nested --areas
/generate-instructions --area frontend --apply-to "apps/frontend/**"
/generate-instructions --strategy flat --dry-run      # preview, no writes
```

## Layout

```
acreadiness-cockpit/
  plugin.json
  agents/
    ai-readiness-reporter.agent.md
    report-template.html       # canonical HTML/CSS template for reports/index.html
  skills/
    assess/SKILL.md
    generate-instructions/SKILL.md
    policy/SKILL.md
  .github/plugin/marketplace.json
  README.md
```

## Concepts (cheat sheet)

- **Maturity**: L1 Functional → L2 Documented → L3 Standardized → L4 Optimized → L5 Autonomous
- **Pillars** (Repo Health): Style · Build · Testing · Docs · Dev Environment · Code Quality · Observability · Security
- **Pillars** (AI Setup): AI Tooling
- **Impact weights**: critical 5 · high 4 · medium 3 · low 2 · info 0
- **Grades**: A ≥ 0.9 · B ≥ 0.8 · C ≥ 0.7 · D ≥ 0.6 · F < 0.6
- **Loop**: Measure (`/assess`) → Generate (`/generate-instructions`) → Maintain (`/policy` + CI `--fail-level`)

## License

MIT
