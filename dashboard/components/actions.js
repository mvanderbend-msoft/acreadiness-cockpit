const COMMANDS = [
  { id: 'readiness', label: 'Run Readiness', desc: 'agentrc readiness --json' },
  { id: 'generate',  label: 'Generate Instructions', desc: 'agentrc instructions --json' },
  { id: 'eval',      label: 'Run Eval', desc: 'agentrc eval --json' },
];

export async function renderActions(root, { api, setStatus }) {
  root.innerHTML = `
    <div class="panel">
      <h2>Quick Actions</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        ${COMMANDS.map((c) => `<button class="primary" data-cmd="${c.id}">${c.label}</button>`).join('')}
      </div>
      <div style="color:var(--muted);font-size:12px;margin-bottom:8px">Output stream:</div>
      <pre class="log" id="log"><span style="color:var(--muted)">Idle. Click a button above to run AgentRC.</span></pre>
    </div>`;
  const logEl = root.querySelector('#log');
  let stop = null;
  for (const btn of root.querySelectorAll('button[data-cmd]')) {
    btn.addEventListener('click', () => {
      if (stop) stop();
      logEl.textContent = '';
      const cmd = btn.dataset.cmd;
      setStatus(`running ${cmd}…`);
      btn.disabled = true;
      stop = api.sse(`/api/run/${cmd}`, {
        onEvent: (ev) => {
          if (ev.event === 'log') {
            const span = document.createElement('span');
            if (ev.data.stream === 'stderr') span.className = 'stderr';
            span.textContent = ev.data.line + '\n';
            logEl.appendChild(span);
            logEl.scrollTop = logEl.scrollHeight;
          } else if (ev.event === 'start') {
            logEl.appendChild(document.createTextNode(`▶ ${ev.data.cmd} @ ${ev.data.ts}\n`));
          } else if (ev.event === 'done') {
            logEl.appendChild(document.createTextNode(`\n✓ exit ${ev.data.code}\n`));
            setStatus(`done: ${cmd}`);
            btn.disabled = false;
          } else if (ev.event === 'error') {
            logEl.appendChild(document.createTextNode(`\n✗ ${ev.data.message}\n`));
            setStatus(`error: ${cmd}`);
            btn.disabled = false;
          }
        },
        onClose: () => { btn.disabled = false; },
      });
    });
  }
}
