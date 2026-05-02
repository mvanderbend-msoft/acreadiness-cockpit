#!/usr/bin/env node
// Zero-dependency HTTP server for the AgentRC cockpit dashboard.
// - Serves dashboard/ as static files.
// - Exposes /api/* JSON endpoints reading from <repoRoot>/.agentrc-cockpit/.
// - /api/run/:cmd streams agentrc output via Server-Sent Events.

import http from 'node:http';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runAndStore, updateArtifacts, dataDir } from './run-agentrc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = path.resolve(__dirname, '..');
const DASHBOARD_DIR = path.join(PLUGIN_ROOT, 'dashboard');
const REPO_ROOT = process.env.AGENTRC_COCKPIT_ROOT || process.cwd();
const DATA_DIR = dataDir(REPO_ROOT);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

async function readJsonSafe(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function readJsonl(file, { limit = 500, tail = true } = {}) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const slice = tail ? lines.slice(-limit) : lines.slice(0, limit);
    return slice.map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } });
  } catch { return []; }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const safe = path.normalize(urlPath).replace(/^[/\\]+/, '');
  const full = path.join(DASHBOARD_DIR, safe);
  if (!full.startsWith(DASHBOARD_DIR)) { send(res, 403, { error: 'forbidden' }); return; }
  try {
    const st = await fs.stat(full);
    if (st.isDirectory()) { send(res, 404, { error: 'not found' }); return; }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    createReadStream(full).pipe(res);
  } catch {
    send(res, 404, { error: 'not found', path: urlPath });
  }
}

function sse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  return {
    send(event, data) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    end() { res.end(); },
  };
}

const ROUTES = {
  'GET /api/state': async () => {
    const state = await readJsonSafe(path.join(DATA_DIR, 'state.json'), {});
    return { ...state, repoRoot: REPO_ROOT, dataDir: DATA_DIR };
  },
  'GET /api/readiness': async () => ({
    current: await readJsonSafe(path.join(DATA_DIR, 'readiness.json')),
    history: await readJsonl(path.join(DATA_DIR, 'readiness-history.jsonl'), { limit: 100 }),
  }),
  'GET /api/artifacts': async () => {
    await updateArtifacts(REPO_ROOT);
    return await readJsonSafe(path.join(DATA_DIR, 'artifacts.json'), { items: [] });
  },
  'GET /api/history': async (req) => {
    const url = new URL(req.url, 'http://localhost');
    const limit = Number(url.searchParams.get('limit') || 500);
    const session = url.searchParams.get('session');
    let entries = await readJsonl(path.join(DATA_DIR, 'history.jsonl'), { limit });
    if (session) entries = entries.filter((e) => e.sessionId === session);
    return { entries };
  },
  'GET /api/evals': async () => await readJsonSafe(path.join(DATA_DIR, 'evals.json'), null),
};

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const key = `${req.method} ${url.pathname}`;
  if (req.method === 'POST' && url.pathname.startsWith('/api/run/')) {
    const cmd = url.pathname.slice('/api/run/'.length);
    const stream = sse(res);
    stream.send('start', { cmd, ts: new Date().toISOString() });
    try {
      const result = await runAndStore(cmd, {
        root: REPO_ROOT,
        onLine: (s, line) => stream.send('log', { stream: s, line }),
      });
      stream.send('done', { code: result.code, hasJson: !!result.json });
    } catch (e) {
      stream.send('error', { message: e.message });
    } finally {
      stream.end();
    }
    return;
  }
  if (ROUTES[key]) {
    try { send(res, 200, await ROUTES[key](req)); }
    catch (e) { send(res, 500, { error: e.message }); }
    return;
  }
  send(res, 404, { error: 'not found' });
}

function tryListen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => { server.removeListener('listening', onListen); reject(err); };
    const onListen = () => { server.removeListener('error', onError); resolve(port); };
    server.once('error', onError);
    server.once('listening', onListen);
    server.listen(port, '127.0.0.1');
  });
}

export async function start({ port, root = REPO_ROOT, open = false } = {}) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const preferred = Number(port ?? process.env.AGENTRC_COCKPIT_PORT ?? 4717) || 4717;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) return handleApi(req, res);
    return serveStatic(req, res);
  });
  let finalPort = preferred;
  try {
    await tryListen(server, preferred);
  } catch {
    finalPort = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
  }
  const url = `http://127.0.0.1:${finalPort}`;
  await fs.writeFile(path.join(DATA_DIR, 'state.json'), JSON.stringify({
    port: finalPort, url, startedAt: new Date().toISOString(), repoRoot: root,
  }, null, 2));
  console.log(`[agentrc-cockpit] dashboard: ${url}`);
  if (open) openInBrowser(url);
  return { server, url, port: finalPort };
}

function openInBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
            : process.platform === 'darwin' ? ['open', [url]]
            : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref(); } catch { /* ignore */ }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const open = process.argv.includes('--open');
  start({ open }).catch((e) => { console.error(e); process.exit(1); });
}
