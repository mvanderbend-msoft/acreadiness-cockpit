function summarize(payload) {
  if (!payload) return '';
  if (payload.raw) return String(payload.raw).slice(0, 240);
  if (payload.prompt) return String(payload.prompt).slice(0, 240);
  if (payload.tool) return `tool: ${payload.tool} ${payload.input ? JSON.stringify(payload.input).slice(0, 200) : ''}`;
  return JSON.stringify(payload).slice(0, 240);
}

function fileTouches(entries) {
  const counts = new Map();
  for (const e of entries) {
    const p = e.payload;
    const candidates = [p?.input?.path, p?.input?.file, p?.path, p?.file].filter(Boolean);
    for (const c of candidates) counts.set(c, (counts.get(c) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
}

export async function renderHistory(root, { api }) {
  const data = await api.get('/api/history?limit=300');
  const entries = (data.entries || []).slice().reverse();
  const sessions = [...new Set(entries.map((e) => e.sessionId).filter(Boolean))];
  const touches = fileTouches(entries);

  root.innerHTML = `
    <div class="panel">
      <h2>Conversation History</h2>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px">
        <label style="color:var(--muted)">Session:</label>
        <select id="sessionPick">
          <option value="">all</option>
          ${sessions.map((s) => `<option>${s}</option>`).join('')}
        </select>
        <span style="color:var(--muted)">${entries.length} event(s)</span>
      </div>
      <div class="grid cols-2">
        <div class="timeline" id="tl">
          ${entries.length === 0 ? '<div class="empty">No events recorded yet. Hooks will populate this once you chat with Copilot.</div>' : ''}
          ${entries.map((e) => `
            <div class="ev" data-session="${e.sessionId || ''}">
              <div class="ts">${new Date(e.ts).toLocaleString()} · ${e.sessionId ? `<code>${e.sessionId}</code>` : ''}</div>
              <div><span class="type">${e.type}</span><span style="color:var(--muted)">${summarize(e.payload)}</span></div>
            </div>`).join('')}
        </div>
        <div>
          <h2 style="font-size:13px;color:var(--muted);text-transform:uppercase">File Touch Heatmap</h2>
          ${touches.length === 0 ? '<div class="empty">No file references in events.</div>' : `
            <table>
              <thead><tr><th>File</th><th>Touches</th><th></th></tr></thead>
              <tbody>${touches.map(([f, c]) => `
                <tr><td><code>${f}</code></td><td>${c}</td>
                <td><div class="bar" style="width:120px"><span style="width:${Math.min(100, c * 8)}%"></span></div></td></tr>`).join('')}
              </tbody>
            </table>`}
        </div>
      </div>
    </div>`;

  const sel = root.querySelector('#sessionPick');
  sel.addEventListener('change', () => {
    const v = sel.value;
    root.querySelectorAll('#tl .ev').forEach((el) => {
      el.style.display = !v || el.dataset.session === v ? '' : 'none';
    });
  });
}
