---
name: cockpit-report
description: Produce a full, human-readable AI-readiness report for the current repository. Runs AgentRC readiness, then opens the cockpit Report tab. For an LLM-authored narrative version saved to reports/ai-readiness-report.md, use the @ai-readiness-reporter custom agent.
---

# Cockpit Report

Use this skill when the user asks for an **AI-readiness report**, an **assessment**, or wants to **see how AI-ready** their repo is.

## Steps

1. From the repo root, refresh the data:
   ```bash
   node "${COPILOT_PLUGIN_ROOT}/scripts/run-agentrc.js" readiness
   node "${COPILOT_PLUGIN_ROOT}/scripts/run-agentrc.js" artifacts
   ```
2. Launch the cockpit if it isn't already running:
   ```bash
   node "${COPILOT_PLUGIN_ROOT}/scripts/server.js" --open
   ```
3. Direct the user to the **Report** tab (`/#/report`). Tell them:
   - The **Generated** view is built directly from AgentRC JSON and explains every pillar in plain English.
   - The **Saved markdown** view shows `reports/ai-readiness-report.md` if the `@ai-readiness-reporter` custom agent has produced one.
4. Summarise in chat: maturity level, overall score, top 3 lowest pillars, and recommended next steps.
