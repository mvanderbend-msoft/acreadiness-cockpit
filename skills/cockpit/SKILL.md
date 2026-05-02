---
name: cockpit
description: Launch the AgentRC cockpit dashboard in your browser. Starts a local HTTP server on 127.0.0.1 that visualizes readiness, artifacts, conversation history, and evals.
---

# Cockpit

Use this skill when the user asks to **open the cockpit**, **see readiness**, **launch the dashboard**, or otherwise wants a visual overview of repo AI-readiness.

## Steps

1. From the repo root, run:
   ```bash
   node "${COPILOT_PLUGIN_ROOT}/scripts/server.js" --open
   ```
2. The server prints `dashboard: http://127.0.0.1:<port>`. Share that URL with the user.
3. If readiness data does not exist yet, suggest running `/cockpit-refresh` first or clicking **Run Readiness** in the Actions tab.

## Notes

- Server binds to `127.0.0.1` only (no remote access).
- Data lives under `<repo>/.agentrc-cockpit/`. Add it to `.gitignore` if not already.
- The server keeps running until killed; the user may close the terminal window or stop the process to shut it down.
