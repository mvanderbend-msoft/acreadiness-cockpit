// Tiny hash router + state shell for the cockpit dashboard.
import { renderReadiness } from './components/readiness.js';
import { renderArtifacts } from './components/artifacts.js';
import { renderHistory } from './components/history.js';
import { renderEvals } from './components/evals.js';
import { renderActions } from './components/actions.js';

const view = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
const metaEl = document.getElementById('meta');
const statusEl = document.getElementById('status');

export const api = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    return r.json();
  },
  sse(path, { onEvent, onClose, method = 'POST' } = {}) {
    // SSE over POST is awkward; we open with fetch + ReadableStream parser.
    const ctrl = new AbortController();
    fetch(path, { method, signal: ctrl.signal }).then(async (res) => {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split(/\n\n/);
        buf = parts.pop();
        for (const p of parts) {
          const ev = {};
          for (const line of p.split('\n')) {
            const idx = line.indexOf(':');
            if (idx < 0) continue;
            const k = line.slice(0, idx).trim();
            const v = line.slice(idx + 1).trim();
            if (k === 'event') ev.event = v;
            else if (k === 'data') ev.data = v;
          }
          if (ev.event) {
            try { ev.data = JSON.parse(ev.data); } catch { /* keep raw */ }
            onEvent?.(ev);
          }
        }
      }
      onClose?.();
    }).catch((e) => { if (e.name !== 'AbortError') onClose?.(e); });
    return () => ctrl.abort();
  },
};

const ROUTES = {
  '/readiness': renderReadiness,
  '/artifacts': renderArtifacts,
  '/history':   renderHistory,
  '/evals':     renderEvals,
  '/actions':   renderActions,
};

function setActiveTab(route) {
  for (const a of tabsEl.querySelectorAll('a')) {
    a.classList.toggle('active', '#' + route === a.getAttribute('href'));
  }
}

async function render() {
  const route = (location.hash.replace(/^#/, '') || '/readiness');
  setActiveTab(route);
  const fn = ROUTES[route] || renderReadiness;
  view.innerHTML = '<div class="empty">Loading…</div>';
  try {
    await fn(view, { api, setStatus });
  } catch (e) {
    view.innerHTML = `<div class="panel"><h2>Error</h2><pre class="log">${e.stack || e.message}</pre></div>`;
  }
}

export function setStatus(text) { statusEl.textContent = text; }

async function loadMeta() {
  try {
    const s = await api.get('/api/state');
    metaEl.textContent = `${s.repoRoot || ''} · :${s.port || ''}`;
  } catch { /* ignore */ }
}

window.addEventListener('hashchange', render);
loadMeta();
render();
