#!/usr/bin/env node
// Minimal stdio MCP server (JSON-RPC 2.0) exposing AgentRC tools.
// Implements: initialize, tools/list, tools/call. No external deps.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAndStore, updateArtifacts, dataDir } from '../scripts/run-agentrc.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = process.env.AGENTRC_COCKPIT_ROOT || process.cwd();
const DATA_DIR = dataDir(REPO_ROOT);

const TOOLS = [
  { name: 'get_readiness', description: 'Return latest AgentRC readiness JSON.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_history',   description: 'Return recent conversation events captured by hooks.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'get_artifacts', description: 'Return inventory of generated AgentRC artifacts.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_evals',     description: 'Return latest AgentRC eval results.', inputSchema: { type: 'object', properties: {} } },
  { name: 'run_readiness', description: 'Run `agentrc readiness --json` and store results.', inputSchema: { type: 'object', properties: {} } },
  { name: 'run_generate',  description: 'Run `agentrc instructions --json` and store results.', inputSchema: { type: 'object', properties: {} } },
  { name: 'run_eval',      description: 'Run `agentrc eval --json` and store results.', inputSchema: { type: 'object', properties: {} } },
];

async function readJsonSafe(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function readJsonl(file, limit = 200) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean).slice(-limit);
    return lines.map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } });
  } catch { return []; }
}

const HANDLERS = {
  get_readiness: async () => ({
    current: await readJsonSafe(path.join(DATA_DIR, 'readiness.json')),
    history: await readJsonl(path.join(DATA_DIR, 'readiness-history.jsonl'), 50),
  }),
  get_history: async (args = {}) => ({ entries: await readJsonl(path.join(DATA_DIR, 'history.jsonl'), Number(args.limit) || 200) }),
  get_artifacts: async () => { await updateArtifacts(REPO_ROOT); return await readJsonSafe(path.join(DATA_DIR, 'artifacts.json'), { items: [] }); },
  get_evals: async () => await readJsonSafe(path.join(DATA_DIR, 'evals.json'), null),
  run_readiness: async () => { const r = await runAndStore('readiness', { root: REPO_ROOT }); return { exitCode: r.code, json: r.json }; },
  run_generate:  async () => { const r = await runAndStore('generate',  { root: REPO_ROOT }); return { exitCode: r.code, json: r.json }; },
  run_eval:      async () => { const r = await runAndStore('eval',      { root: REPO_ROOT }); return { exitCode: r.code, json: r.json }; },
};

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function dispatch(req) {
  const { id, method, params } = req;
  if (method === 'initialize') {
    return { jsonrpc: '2.0', id, result: {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'agentrc-live', version: '0.1.0' },
      capabilities: { tools: {} },
    }};
  }
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }
  if (method === 'tools/call') {
    const fn = HANDLERS[params?.name];
    if (!fn) return { jsonrpc: '2.0', id, error: { code: -32601, message: `unknown tool ${params?.name}` } };
    try {
      const out = await fn(params?.arguments || {});
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] } };
    } catch (e) {
      return { jsonrpc: '2.0', id, error: { code: -32000, message: e.message } };
    }
  }
  if (method === 'notifications/initialized' || method?.startsWith('notifications/')) return null;
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } };
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let req;
    try { req = JSON.parse(line); } catch { continue; }
    const res = await dispatch(req);
    if (res) send(res);
  }
});
process.stdin.on('end', () => process.exit(0));
