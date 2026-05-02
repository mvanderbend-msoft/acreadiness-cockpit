# acreadiness-cockpit

A GitHub Copilot **agent plugin** that turns [Microsoft AgentRC](https://github.com/microsoft/agentrc) into a browser-based **AI-readiness cockpit** for any repo.

> Visualizes readiness pillars, generated artifacts, conversation history, and eval/drift results — all in plain HTML/CSS/JS, no frameworks, no build step.

![overview](docs/overview.png)

## Features

- **Readiness panel** — 9-pillar radar + bar scores, maturity level badge, trend sparkline, drilldown remediation modal.
- **Artifacts panel** — inventory of `.github/copilot-instructions.md`, `.vscode/mcp.json`, `.vscode/settings.json`, `agentrc.eval.json`, `AGENTS.md` with freshness indicators.
- **Conversation history** — timeline of prompts and tool calls captured by lifecycle hooks, filterable by session, with a file-touch heatmap.
- **Evals / drift** — pass/fail counts and per-case detail.
- **Quick actions** — buttons that run `agentrc readiness | instructions | eval` with live SSE-streamed output.
- **MCP server `agentrc-live`** — exposes the same data as Copilot tools (`get_readiness`, `run_readiness`, …) for the chat agent.
- **Hooks** — automatically capture conversation events to populate the history panel.

## Prerequisites

- **Node.js 20+** (required by AgentRC)
- VS Code with Copilot agent plugins enabled (`chat.plugins.enabled`)

## Install

### From source (VS Code)

`Extensions` → **Agent Plugins** → **Install from Source…**, then point at this repo URL:

```
https://github.com/mvanderbend-msoft/acreadiness-cockpit
```

### From a marketplace manifest

```
https://raw.githubusercontent.com/mvanderbend-msoft/acreadiness-cockpit/main/.github/plugin/marketplace.json
```

## Usage

In Copilot chat:

```
/cockpit            # launches the dashboard server and opens it in your browser
/cockpit-refresh    # re-runs `agentrc readiness` and updates artifacts
/cockpit-eval       # re-runs `agentrc eval`
@readiness-coach    # ask the coaching agent for targeted improvements
```

The dashboard is served at `http://127.0.0.1:4717` (or the next free port).

## Data

All cockpit data is stored under `<repo>/.agentrc-cockpit/`:

| File | Purpose |
| --- | --- |
| `readiness.json` | Latest readiness output |
| `readiness-history.jsonl` | Append-only snapshots for trend |
| `history.jsonl` | Conversation events from hooks |
| `artifacts.json` | Generated-file inventory |
| `evals.json` | Latest eval results |
| `state.json` | Server port + start time |

Add `.agentrc-cockpit/` to your `.gitignore`.

## Manual (non-Copilot) usage

You can also run the dashboard standalone:

```bash
node acreadiness-cockpit/scripts/server.js --open
```

## Layout

```
acreadiness-cockpit/
  plugin.json
  .mcp.json
  hooks/hooks.json
  skills/{cockpit,cockpit-refresh,cockpit-eval}/SKILL.md
  agents/readiness-coach.agent.md
  scripts/{server.js,run-agentrc.js,record-event.js}
  mcp/agentrc-mcp.js
  dashboard/{index.html,styles.css,app.js,components/*}
```

## License

MIT
