// Readiness panel: maturity badge, pillar bars, trend sparkline (canvas).

function pillarsArray(data) {
  if (!data) return [];
  const p = data.pillars || data.scores || data;
  if (Array.isArray(p)) return p.map((x) => ({ name: x.name || x.id, score: x.score ?? x.value ?? 0, level: x.level, details: x }));
  return Object.entries(p).map(([name, v]) => {
    if (typeof v === 'number') return { name, score: v };
    return { name, score: v.score ?? v.value ?? 0, level: v.level, details: v };
  });
}

function levelClass(lvl) {
  const n = Number(lvl);
  return Number.isFinite(n) ? `lvl-${Math.max(0, Math.min(5, n))}` : 'lvl-0';
}

function dotClass(score) {
  if (score >= 0.75) return 'good';
  if (score >= 0.4) return 'warn';
  return 'bad';
}

function drawSparkline(canvas, points) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = 60 * devicePixelRatio;
  ctx.clearRect(0, 0, w, h);
  if (!points.length) return;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = (max - min) || 1;
  ctx.strokeStyle = '#6ea8ff';
  ctx.lineWidth = 2 * devicePixelRatio;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * w;
    const y = h - ((p - min) / range) * (h - 6 * devicePixelRatio) - 3 * devicePixelRatio;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = 'rgba(110,168,255,.15)';
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.fill();
}

function drawRadar(canvas, pillars) {
  const ctx = canvas.getContext('2d');
  const size = Math.min(canvas.clientWidth, 360);
  canvas.width = size * devicePixelRatio;
  canvas.height = size * devicePixelRatio;
  canvas.style.height = size + 'px';
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const cx = size / 2, cy = size / 2, r = size / 2 - 30;
  const n = pillars.length || 1;
  ctx.strokeStyle = '#262c3a';
  ctx.fillStyle = '#8a93a6';
  ctx.font = '11px sans-serif';
  ctx.lineWidth = 1;
  for (let g = 1; g <= 4; g++) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * (r * g / 4);
      const y = cy + Math.sin(a) * (r * g / 4);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.strokeStyle = '#6ea8ff';
  ctx.fillStyle = 'rgba(110,168,255,.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  pillars.forEach((p, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const score = Math.max(0, Math.min(1, Number(p.score) || 0));
    const x = cx + Math.cos(a) * r * score;
    const y = cy + Math.sin(a) * r * score;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8a93a6';
  pillars.forEach((p, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * (r + 14);
    const y = cy + Math.sin(a) * (r + 14);
    ctx.textAlign = Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center';
    ctx.textBaseline = Math.sin(a) > 0.3 ? 'top' : Math.sin(a) < -0.3 ? 'bottom' : 'middle';
    ctx.fillText(String(p.name).slice(0, 18), x, y);
  });
}

function openPillarModal(p) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal">
      <span class="close">✕</span>
      <h3>${p.name}</h3>
      <p><span class="dot ${dotClass(p.score)}"></span>Score: <strong>${(p.score * 100).toFixed(0)}%</strong>${p.level != null ? ` · Level ${p.level}` : ''}</p>
      <pre class="log">${JSON.stringify(p.details ?? p, null, 2)}</pre>
    </div>`;
  back.addEventListener('click', (e) => { if (e.target === back || e.target.classList.contains('close')) back.remove(); });
  document.body.appendChild(back);
}

export async function renderReadiness(root, { api }) {
  const data = await api.get('/api/readiness');
  const cur = data.current;
  if (!cur) {
    root.innerHTML = `<div class="panel"><h2>Readiness</h2><div class="empty">No readiness data yet. Run <code>agentrc readiness</code> from the Actions tab.</div></div>`;
    return;
  }
  const pillars = pillarsArray(cur);
  const level = cur.level ?? cur.maturity ?? 0;
  const overall = cur.overall ?? cur.score ?? (pillars.reduce((s, p) => s + (Number(p.score) || 0), 0) / Math.max(pillars.length, 1));
  const trendPts = (data.history || []).map((h) => {
    const ps = pillarsArray(h.data || h);
    return ps.reduce((s, p) => s + (Number(p.score) || 0), 0) / Math.max(ps.length, 1);
  });

  root.innerHTML = `
    <section class="grid cols-3">
      <div class="panel kpi"><span class="lbl">Maturity Level</span><span class="num"><span class="badge ${levelClass(level)}">L${level}</span></span></div>
      <div class="panel kpi"><span class="lbl">Overall</span><span class="num">${(overall * 100).toFixed(0)}%</span></div>
      <div class="panel"><h2>Trend</h2><canvas id="spark"></canvas><div style="color:var(--muted);font-size:12px;margin-top:6px">${trendPts.length} snapshot(s)</div></div>
    </section>
    <section class="grid cols-2">
      <div class="panel"><h2>Pillars (Radar)</h2><canvas id="radar"></canvas></div>
      <div class="panel">
        <h2>Pillar Scores</h2>
        <table>
          <thead><tr><th></th><th>Pillar</th><th>Score</th><th>Level</th></tr></thead>
          <tbody>
            ${pillars.map((p, i) => `
              <tr data-idx="${i}" style="cursor:pointer">
                <td><span class="dot ${dotClass(p.score)}"></span></td>
                <td>${p.name}</td>
                <td><div class="bar" style="width:120px"><span style="width:${Math.round((p.score || 0) * 100)}%"></span></div></td>
                <td>${p.level ?? '–'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
  drawSparkline(root.querySelector('#spark'), trendPts);
  drawRadar(root.querySelector('#radar'), pillars);
  root.querySelectorAll('tbody tr').forEach((tr) => tr.addEventListener('click', () => {
    openPillarModal(pillars[Number(tr.dataset.idx)]);
  }));
}
