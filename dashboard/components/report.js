import {
  MATURITY, normalizePillars, overallScore, maturityFromReadiness,
  severityFor, classifyFinding,
} from './pillar-meta.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Tiny markdown renderer (headings, bold/italic, code, lists, tables, hr, paragraphs).
// Sufficient for the structured report markdown produced by the agent.
function renderMarkdown(md) {
  if (!md) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const inline = (s) => escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\W)\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    if (/^---+\s*$/.test(line)) { out.push('<hr/>'); i++; continue; }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      const lvl = m[1].length;
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      i++; continue;
    }
    if (/^```/.test(line)) {
      i++;
      const buf = [];
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre class="log">${escapeHtml(buf.join('\n'))}</pre>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*[-: ]+/.test(lines[i + 1])) {
      const header = line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim()));
        i++;
      }
      out.push('<table><thead><tr>' + header.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      out.push('<ul>' + items.map((it) => `<li>${inline(it)}</li>`).join('') + '</ul>');
      continue;
    }
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^#{1,6}\s+/.test(lines[i]) && !/^---+\s*$/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

function maturityTable(currentLevel) {
  return `<table>
    <thead><tr><th>Level</th><th>Name</th><th>Status</th></tr></thead>
    <tbody>
      ${[...MATURITY].reverse().map((m) => {
        const here = m.level === currentLevel;
        return `<tr><td>${m.level}</td><td>${m.name}</td><td>${here ? '◼ <strong>You are here</strong>' : '◻'}</td></tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function pillarSection(p) {
  const sev = severityFor(p.score);
  const pct = Math.round((p.score || 0) * 100);
  const current = p.raw?.detail || p.raw?.message || p.raw?.note || '(see Readiness tab for raw data)';
  return `
    <div class="panel">
      <h3 style="margin:0 0 8px;display:flex;align-items:center;gap:10px">
        <span>${escapeHtml(p.name)}</span>
        <span class="badge ${sev.cls === 'good' ? 'lvl-3' : sev.cls === 'warn' ? 'lvl-1' : 'lvl-0'}">${pct}% ${sev.icon}</span>
      </h3>
      <div class="bar" style="margin-bottom:10px"><span style="width:${pct}%"></span></div>
      <p><strong>What this measures:</strong> ${escapeHtml(p.meta?.what || '—')}</p>
      <p><strong>Current state:</strong> ${escapeHtml(typeof current === 'string' ? current : JSON.stringify(current))}</p>
      <p><strong>Why it matters for AI:</strong> ${escapeHtml(p.meta?.aiImpact || 'Affects how well AI agents can reason about your repo.')}</p>
      <p><strong>Recommendation:</strong> ${escapeHtml(p.meta?.fix || 'Improve this area to raise overall maturity.')}</p>
    </div>`;
}

function buildReportFromJSON(readiness, repoRoot) {
  const pillars = normalizePillars(readiness);
  const overall = overallScore(readiness, pillars);
  const maturity = maturityFromReadiness(readiness, pillars);
  const repoHealth = pillars.filter((p) => p.category === 'Repo Health');
  const aiSetup    = pillars.filter((p) => p.category === 'AI Setup');

  const findings = pillars.map((p) => ({ p, bucket: classifyFinding(p) }));
  const fixFirst = findings.filter((f) => f.bucket === 'fix-first');
  const fixNext  = findings.filter((f) => f.bucket === 'fix-next');
  const planList = findings.filter((f) => f.bucket === 'plan');

  const findingRow = (f, i) => `<tr>
    <td>${i + 1}</td>
    <td>${escapeHtml(f.p.name)} — ${Math.round(f.p.score * 100)}%</td>
    <td>${escapeHtml(f.p.meta?.fix || '—')}</td>
  </tr>`;

  return `
    <div class="panel">
      <h2 style="font-size:22px;color:var(--text);text-transform:none;letter-spacing:0">AI Readiness Report</h2>
      <div class="grid cols-3" style="margin-top:12px">
        <div><span class="lbl" style="color:var(--muted);font-size:12px;text-transform:uppercase">Repository</span><div><code>${escapeHtml(repoRoot || 'current')}</code></div></div>
        <div><span class="lbl" style="color:var(--muted);font-size:12px;text-transform:uppercase">Maturity</span><div><span class="badge lvl-${maturity.level}">L${maturity.level} — ${maturity.name}</span></div></div>
        <div><span class="lbl" style="color:var(--muted);font-size:12px;text-transform:uppercase">Overall</span><div style="font-size:22px;font-weight:700">${Math.round(overall * 100)}%</div></div>
      </div>
    </div>

    <div class="panel">
      <h2>What is AI Readiness?</h2>
      <p>AI coding agents are only as effective as the context they receive. A Copilot session that knows your repo's stack, naming conventions, and testing strategy produces dramatically better code than one flying blind.</p>
      <p>AgentRC measures how "AI-ready" a repository is by analyzing 9 pillars across <strong>repo health</strong> and <strong>AI setup</strong>, then maps the result to a 5-level maturity model.</p>
    </div>

    <div class="panel">
      <h2>Maturity Level Assessment</h2>
      <p><strong>Current level: ${maturity.level} — ${maturity.name}.</strong> ${escapeHtml(maturity.desc)}</p>
      ${maturityTable(maturity.level)}
    </div>

    <div class="panel">
      <h2>Repo Health Breakdown (${repoHealth.length} pillars)</h2>
      <div class="grid cols-2">
        ${repoHealth.map(pillarSection).join('')}
      </div>
    </div>

    <div class="panel">
      <h2>AI Setup Breakdown (${aiSetup.length} pillar)</h2>
      <div class="grid cols-2">
        ${aiSetup.length ? aiSetup.map(pillarSection).join('') : '<div class="empty">No AI setup pillar reported.</div>'}
      </div>
    </div>

    <div class="panel">
      <h2>Prioritised Remediation Plan</h2>
      <h3 style="margin-top:6px;color:var(--bad)">🔴 Fix First (High impact / Low effort)</h3>
      ${fixFirst.length === 0 ? '<div class="empty">Nothing critical — nice work.</div>' : `
      <table><thead><tr><th>#</th><th>Finding</th><th>Recommendation</th></tr></thead>
        <tbody>${fixFirst.map(findingRow).join('')}</tbody></table>`}
      <h3 style="margin-top:18px;color:var(--warn)">🟡 Fix Next (Medium impact / Low effort)</h3>
      ${fixNext.length === 0 ? '<div class="empty">Nothing here.</div>' : `
      <table><thead><tr><th>#</th><th>Finding</th><th>Recommendation</th></tr></thead>
        <tbody>${fixNext.map(findingRow).join('')}</tbody></table>`}
      <h3 style="margin-top:18px;color:var(--accent)">🔵 Plan (Medium impact / Medium effort)</h3>
      ${planList.length === 0 ? '<div class="empty">Nothing here.</div>' : `
      <table><thead><tr><th>#</th><th>Finding</th><th>Recommendation</th></tr></thead>
        <tbody>${planList.map(findingRow).join('')}</tbody></table>`}
    </div>

    <div class="panel">
      <h2>Next Steps</h2>
      <ol>
        <li>Run <code>agentrc instructions</code> to generate or refresh <code>.github/copilot-instructions.md</code>.</li>
        <li>Address each item under <strong>🔴 Fix First</strong>; re-run readiness to verify the score improves.</li>
        <li>Run <code>agentrc eval</code> to detect drift between your instructions and the agent's behaviour.</li>
        <li>Schedule the <strong>🔵 Plan</strong> items for the next sprint and track maturity progression in the cockpit Trend chart.</li>
        <li>Invoke the <code>@ai-readiness-reporter</code> custom agent for an LLM-authored narrative version of this report saved to <code>reports/ai-readiness-report.md</code>.</li>
      </ol>
    </div>`;
}

export async function renderReport(root, { api, setStatus }) {
  setStatus('loading report…');
  const [readinessResp, reportResp] = await Promise.all([
    api.get('/api/readiness').catch(() => ({})),
    api.get('/api/report').catch(() => ({ exists: false })),
  ]);
  const state = await api.get('/api/state').catch(() => ({}));
  const readiness = readinessResp?.current;

  const tabsHtml = `
    <div class="panel" style="display:flex;gap:8px;align-items:center">
      <strong>Source:</strong>
      <button data-mode="generated" class="primary">Generated from JSON</button>
      <button data-mode="markdown">Saved markdown ${reportResp.exists ? '' : '(none yet)'}</button>
      <span class="spacer" style="flex:1"></span>
      <button id="dl">Download .md</button>
    </div>`;

  const generatedHtml = readiness
    ? buildReportFromJSON(readiness, state.repoRoot)
    : `<div class="panel"><h2>No readiness data</h2><div class="empty">Run <code>agentrc readiness</code> from the Actions tab first.</div></div>`;

  const mdHtml = reportResp.exists
    ? `<div class="panel report-md">${renderMarkdown(reportResp.content)}</div>`
    : `<div class="panel"><h2>Saved markdown report</h2><div class="empty">No <code>reports/ai-readiness-report.md</code> yet. Run the <code>@ai-readiness-reporter</code> custom agent in Copilot chat to generate one.</div></div>`;

  root.innerHTML = tabsHtml + `<div id="reportBody">${generatedHtml}</div>`;

  const body = root.querySelector('#reportBody');
  const btnG = root.querySelector('button[data-mode="generated"]');
  const btnM = root.querySelector('button[data-mode="markdown"]');
  btnG.addEventListener('click', () => { body.innerHTML = generatedHtml; btnG.classList.add('primary'); btnM.classList.remove('primary'); });
  btnM.addEventListener('click', () => { body.innerHTML = mdHtml; btnM.classList.add('primary'); btnG.classList.remove('primary'); });

  root.querySelector('#dl').addEventListener('click', () => {
    const md = reportResp.exists ? reportResp.content : buildMarkdownFromJSON(readiness, state.repoRoot);
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ai-readiness-report.md';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  setStatus('report ready');
}

// Used for the download button when no saved markdown exists.
function buildMarkdownFromJSON(readiness, repoRoot) {
  const pillars = normalizePillars(readiness);
  const overall = overallScore(readiness, pillars);
  const maturity = maturityFromReadiness(readiness, pillars);
  const lines = [];
  lines.push(`# AI Readiness Report`, '');
  lines.push(`**Repository:** ${repoRoot || 'current'}`);
  lines.push(`**Assessed:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`**Maturity Level:** ${maturity.level} — ${maturity.name}`);
  lines.push(`**Overall Score:** ${Math.round(overall * 100)}%`, '', '---', '');
  lines.push(`## Maturity Level Assessment`, '', `Current level: ${maturity.level} — ${maturity.name}. ${maturity.desc}`, '');
  lines.push('| Level | Name | Status |', '|---|---|---|');
  for (const m of [...MATURITY].reverse()) lines.push(`| ${m.level} | ${m.name} | ${m.level === maturity.level ? '◼ You are here' : '◻'} |`);
  lines.push('', '---', '', `## Repo Health Breakdown`, '');
  for (const p of pillars.filter((p) => p.category === 'Repo Health')) {
    const sev = severityFor(p.score);
    lines.push(`### ${p.name} — ${Math.round(p.score * 100)}% ${sev.icon}`, '');
    lines.push(`**What this measures:** ${p.meta?.what || '—'}  `);
    lines.push(`**Why it matters for AI:** ${p.meta?.aiImpact || ''}  `);
    lines.push(`**Recommendation:** ${p.meta?.fix || ''}`, '');
  }
  lines.push('---', '', `## AI Setup Breakdown`, '');
  for (const p of pillars.filter((p) => p.category === 'AI Setup')) {
    const sev = severityFor(p.score);
    lines.push(`### ${p.name} — ${Math.round(p.score * 100)}% ${sev.icon}`, '');
    lines.push(`**What this measures:** ${p.meta?.what || '—'}  `);
    lines.push(`**Why it matters:** ${p.meta?.aiImpact || ''}  `);
    lines.push(`**Recommendation:** ${p.meta?.fix || ''}`, '');
  }
  return lines.join('\n');
}
