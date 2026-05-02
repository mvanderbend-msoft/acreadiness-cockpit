---
name: cockpit-eval
description: Run AgentRC evals to detect drift in copilot-instructions and other generated artifacts.
---

# Cockpit Eval

Use when the user wants to verify their AI context is still effective.

## Steps

1. From the repo root, run:
   ```bash
   node "${COPILOT_PLUGIN_ROOT}/scripts/run-agentrc.js" eval
   ```
2. Report passing vs failing case counts and any regressions.
3. If failures exist, suggest re-generating instructions with `/cockpit-refresh` followed by an `agentrc instructions` run.
