#!/usr/bin/env node
// Wrapper around `npx github:microsoft/agentrc <cmd> --json`.
// Writes results into <repoRoot>/.agentrc-cockpit/.

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const COMMANDS = {
  readiness: { args: ['readiness', '--json'], out: 'readiness.json', historyOut: 'readiness-history.jsonl' },
  generate:  { args: ['instructions', '--json'], out: 'generate.json' },
  eval:      { args: ['eval', '--json'], out: 'evals.json' },
};

export function repoRoot(cwd = process.cwd()) {
  return cwd;
}

export function dataDir(root = repoRoot()) {
  return path.join(root, '.agentrc-cockpit');
}

export async function ensureDataDir(root = repoRoot()) {
  const dir = dataDir(root);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function runAgentRC(cmd, { root = repoRoot(), onLine } = {}) {
  const spec = COMMANDS[cmd];
  if (!spec) throw new Error(`Unknown agentrc command: ${cmd}`);
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['-y', 'github:microsoft/agentrc', ...spec.args], {
      cwd: root,
      shell: process.platform === 'win32',
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => {
      const s = b.toString();
      stdout += s;
      if (onLine) s.split(/\r?\n/).forEach((l) => l && onLine('stdout', l));
    });
    child.stderr.on('data', (b) => {
      const s = b.toString();
      stderr += s;
      if (onLine) s.split(/\r?\n/).forEach((l) => l && onLine('stderr', l));
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr, spec }));
  });
}

export async function runAndStore(cmd, opts = {}) {
  const root = opts.root ?? repoRoot();
  const dir = await ensureDataDir(root);
  const result = await runAgentRC(cmd, { root, onLine: opts.onLine });
  const spec = COMMANDS[cmd];
  let json = null;
  try { json = JSON.parse(result.stdout); } catch { /* ignore */ }
  if (json) {
    await fs.writeFile(path.join(dir, spec.out), JSON.stringify(json, null, 2));
    if (spec.historyOut) {
      const snap = { ts: new Date().toISOString(), data: summarizeReadiness(json) };
      await fs.appendFile(path.join(dir, spec.historyOut), JSON.stringify(snap) + '\n');
    }
  }
  await updateArtifacts(root);
  return { ...result, json };
}

function summarizeReadiness(json) {
  if (!json) return null;
  const pillars = json.pillars || json.scores || {};
  return { level: json.level ?? json.maturity ?? null, pillars };
}

const KNOWN_ARTIFACTS = [
  '.github/copilot-instructions.md',
  '.vscode/mcp.json',
  '.vscode/settings.json',
  'agentrc.eval.json',
  'AGENTS.md',
];

export async function updateArtifacts(root = repoRoot()) {
  const dir = await ensureDataDir(root);
  const items = [];
  for (const rel of KNOWN_ARTIFACTS) {
    const full = path.join(root, rel);
    try {
      const st = await fs.stat(full);
      items.push({ path: rel, exists: true, size: st.size, mtime: st.mtime.toISOString() });
    } catch {
      items.push({ path: rel, exists: false });
    }
  }
  await fs.writeFile(path.join(dir, 'artifacts.json'), JSON.stringify({ ts: new Date().toISOString(), items }, null, 2));
  return items;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('run-agentrc.js')) {
  const cmd = process.argv[2];
  if (!cmd) {
    console.error('usage: run-agentrc.js <readiness|generate|eval|artifacts>');
    process.exit(2);
  }
  if (cmd === 'artifacts') {
    updateArtifacts().then((items) => { console.log(JSON.stringify(items, null, 2)); }).catch((e) => { console.error(e); process.exit(1); });
  } else {
    runAndStore(cmd, { onLine: (stream, line) => process[stream === 'stderr' ? 'stderr' : 'stdout'].write(line + '\n') })
      .then((r) => process.exit(r.code ?? 0))
      .catch((e) => { console.error(e); process.exit(1); });
  }
}
