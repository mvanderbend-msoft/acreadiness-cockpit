#!/usr/bin/env node
// Hook helper. Reads a JSON event payload from stdin (the VS Code agent
// plugin runtime supplies one), augments it with an event type, and
// appends it to <repoRoot>/.agentrc-cockpit/history.jsonl.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const eventType = process.argv[2] || 'unknown';
const root = process.cwd();
const dir = path.join(root, '.agentrc-cockpit');

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) return resolve('');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 200);
  });
}

(async () => {
  try {
    await fs.mkdir(dir, { recursive: true });
    const raw = await readStdin();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { raw }; }
    const entry = {
      ts: new Date().toISOString(),
      type: eventType,
      sessionId: payload?.sessionId ?? payload?.session_id ?? process.env.COPILOT_SESSION_ID ?? null,
      payload,
    };
    await fs.appendFile(path.join(dir, 'history.jsonl'), JSON.stringify(entry) + '\n');
  } catch (e) {
    // Hooks should never fail loud — log to stderr and exit 0.
    process.stderr.write(`record-event error: ${e.message}\n`);
  }
  process.exit(0);
})();
