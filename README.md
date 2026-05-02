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
| `/generate-instructions` | **Generate** — wraps `agentrc instructions` to write `AGENTS.md` (recommended) or `.github/copilot-instructions.md`. Supports `flat`/`nested` strategies, monorepo `--areas`, and `--claude-md`. |
| `/policy` | **Maintain** — helps you pick, scaffold, or apply an AgentRC policy. Knows the schema (`criteria.disable` / `criteria.override` / `extras` / `thresholds`), the impact-weight table, and CI gating with `--fail-level`. |

## What gets produced

`reports/index.html` — a single self-contained HTML file with:

- Maturity badge (L1–L5) and overall score / grade (A–F)
- Pass-rate vs threshold (when a policy sets one)
- Maturity progression table ("◼ You are here")
- **Active policy** summary (disabled/overridden criteria, threshold)
- **Repo Health** breakdown (8 pillars) — *what it measures*, *why it matters for AI*, *recommendation*
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
/generate-instructions                    # generate AGENTS.md
/policy new my-policy                     # scaffold a custom policy
@ai-readiness-reporter                    # invoke the reporter directly
```

## Layout

```
acreadiness-cockpit/
  plugin.json
  agents/
    ai-readiness-reporter.agent.md
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
