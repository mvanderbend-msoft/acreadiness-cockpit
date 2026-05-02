---
name: cockpit-refresh
description: Refresh AgentRC readiness data for the cockpit dashboard. Runs `agentrc readiness --json` and updates the artifact inventory.
---

# Cockpit Refresh

Use when the user wants up-to-date readiness scores in the dashboard.

## Steps

1. From the repo root, run:
   ```bash
   node "${COPILOT_PLUGIN_ROOT}/scripts/run-agentrc.js" readiness
   node "${COPILOT_PLUGIN_ROOT}/scripts/run-agentrc.js" artifacts
   ```
2. Summarize the resulting maturity level and the lowest-scoring pillars.
3. Suggest concrete next steps based on the lowest pillars (the dashboard's pillar drilldown also lists these).
