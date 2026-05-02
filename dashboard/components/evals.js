function casesArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.cases)) return data.cases;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

export async function renderEvals(root, { api }) {
  const data = await api.get('/api/evals');
  if (!data) {
    root.innerHTML = `<div class="panel"><h2>Evals</h2><div class="empty">No eval data yet. Run <code>agentrc eval</code> from the Actions tab.</div></div>`;
    return;
  }
  const cases = casesArray(data);
  const passed = cases.filter((c) => c.pass ?? c.passed ?? c.status === 'pass').length;
  const total = cases.length;
  root.innerHTML = `
    <section class="grid cols-3">
      <div class="panel kpi"><span class="lbl">Total Cases</span><span class="num">${total}</span></div>
      <div class="panel kpi"><span class="lbl">Passing</span><span class="num" style="color:var(--good)">${passed}</span></div>
      <div class="panel kpi"><span class="lbl">Failing</span><span class="num" style="color:var(--bad)">${total - passed}</span></div>
    </section>
    <div class="panel">
      <h2>Cases</h2>
      ${total === 0 ? '<div class="empty">No cases reported.</div>' : `
        <table>
          <thead><tr><th></th><th>Name</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>
            ${cases.map((c) => {
              const ok = c.pass ?? c.passed ?? c.status === 'pass';
              return `<tr>
                <td><span class="dot ${ok ? 'good' : 'bad'}"></span></td>
                <td>${c.name || c.id || '(unnamed)'}</td>
                <td>${ok ? 'pass' : 'fail'}</td>
                <td style="color:var(--muted)">${(c.message || c.detail || '').toString().slice(0, 200)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`}
    </div>`;
}
