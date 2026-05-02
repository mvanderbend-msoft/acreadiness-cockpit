function freshnessLabel(mtimeISO) {
  if (!mtimeISO) return { cls: 'bad', label: 'missing' };
  const age = Date.now() - new Date(mtimeISO).getTime();
  const days = age / (1000 * 60 * 60 * 24);
  if (days < 7) return { cls: 'good', label: `${Math.round(days)}d ago` };
  if (days < 30) return { cls: 'warn', label: `${Math.round(days)}d ago` };
  return { cls: 'bad', label: `${Math.round(days)}d ago` };
}

export async function renderArtifacts(root, { api }) {
  const data = await api.get('/api/artifacts');
  const items = data.items || [];
  root.innerHTML = `
    <div class="panel">
      <h2>Generated Artifacts</h2>
      <table>
        <thead><tr><th></th><th>Path</th><th>Status</th><th>Size</th><th>Last modified</th></tr></thead>
        <tbody>
          ${items.map((it) => {
            const f = it.exists ? freshnessLabel(it.mtime) : { cls: 'bad', label: 'missing' };
            return `<tr>
              <td><span class="dot ${f.cls}"></span></td>
              <td><code>${it.path}</code></td>
              <td>${it.exists ? 'present' : '<em>missing</em>'}</td>
              <td>${it.exists ? (it.size + ' B') : '–'}</td>
              <td>${it.exists ? `${new Date(it.mtime).toLocaleString()} · ${f.label}` : '–'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div style="color:var(--muted);font-size:12px;margin-top:10px">Refreshed ${data.ts ? new Date(data.ts).toLocaleString() : ''}</div>
    </div>`;
}
