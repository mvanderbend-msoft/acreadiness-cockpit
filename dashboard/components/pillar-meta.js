// Shared pillar / maturity metadata used by the dashboard report panel.
// Mirrors agents/ai-readiness-reporter.agent.md so the dashboard can build
// a rich report directly from AgentRC's readiness JSON without an LLM.

export const MATURITY = [
  { level: 1, name: 'Functional',    desc: 'Builds, tests, basic tooling in place.' },
  { level: 2, name: 'Documented',    desc: 'README, CONTRIBUTING, custom instructions exist.' },
  { level: 3, name: 'Standardized',  desc: 'CI/CD, security policies, CODEOWNERS, observability.' },
  { level: 4, name: 'Optimized',     desc: 'MCP servers, custom agents, AI skills configured.' },
  { level: 5, name: 'Autonomous',    desc: 'Full AI-native development with minimal human oversight.' },
];

// Each entry: id (matches AgentRC pillar ids — multiple aliases allowed),
// category, displayName, what, aiImpact, defaultRemediation.
export const PILLARS = [
  {
    ids: ['style', 'style-validation', 'styleAndValidation', 'lint', 'linting'],
    category: 'Repo Health',
    displayName: 'Style & Validation',
    what: 'Linter config (ESLint/Biome/Prettier), type-checking (TypeScript/Mypy).',
    aiImpact: 'AI agents produce more consistent code when linting rules are explicit. Without them, generated code may use inconsistent patterns.',
    fix: 'Add an ESLint/Biome config and a type-check script (`tsc --noEmit` / `mypy`).',
  },
  {
    ids: ['build', 'build-system', 'buildSystem'],
    category: 'Repo Health',
    displayName: 'Build System',
    what: 'Build script in package.json, CI workflow config.',
    aiImpact: 'Agents need to know how to build and verify their changes. A clear build system lets agents self-check.',
    fix: 'Add a `build` script and at least one CI workflow that runs it.',
  },
  {
    ids: ['testing', 'tests', 'test'],
    category: 'Repo Health',
    displayName: 'Testing',
    what: 'Test scripts, area-scoped test scripts.',
    aiImpact: 'Agents can run tests to validate their own output. Without tests, there is no automated quality gate.',
    fix: 'Add a `test` script and at least a smoke test per top-level area.',
  },
  {
    ids: ['documentation', 'docs', 'doc'],
    category: 'Repo Health',
    displayName: 'Documentation',
    what: 'README, CONTRIBUTING guide, area-scoped READMEs.',
    aiImpact: 'AI agents use docs as context. A well-documented repo yields dramatically better AI suggestions.',
    fix: 'Add or expand README.md and CONTRIBUTING.md; document each top-level area.',
  },
  {
    ids: ['dev-environment', 'devEnvironment', 'dev', 'environment'],
    category: 'Repo Health',
    displayName: 'Dev Environment',
    what: 'Lockfile (npm/pnpm/yarn/bun), .env.example.',
    aiImpact: 'Reproducible environments mean agents can install and run locally. Missing lockfiles cause version drift in AI-generated dependency changes.',
    fix: 'Commit your lockfile and add a `.env.example` capturing required variables.',
  },
  {
    ids: ['code-quality', 'codeQuality', 'formatter', 'format'],
    category: 'Repo Health',
    displayName: 'Code Quality',
    what: 'Formatter config (Prettier/Biome).',
    aiImpact: 'Formatting rules prevent AI-generated code from triggering style noise in PRs.',
    fix: 'Add a Prettier/Biome config and run it in CI.',
  },
  {
    ids: ['observability', 'obs'],
    category: 'Repo Health',
    displayName: 'Observability',
    what: 'Observability dependencies (OpenTelemetry, Pino, Winston, Bunyan).',
    aiImpact: 'Agents building features benefit from knowing the observability patterns so they instrument new code correctly.',
    fix: 'Adopt a logger and/or OpenTelemetry; document the pattern in copilot-instructions.md.',
  },
  {
    ids: ['security', 'security-governance', 'securityGovernance', 'governance'],
    category: 'Repo Health',
    displayName: 'Security & Governance',
    what: 'LICENSE, CODEOWNERS, SECURITY.md, Dependabot config.',
    aiImpact: 'Security policies guide agents on vulnerability handling. CODEOWNERS ensures AI-generated PRs get proper review.',
    fix: 'Add LICENSE, SECURITY.md, .github/CODEOWNERS, and a Dependabot config.',
  },
  {
    ids: ['ai', 'ai-tooling', 'aiTooling', 'ai-setup', 'aiSetup'],
    category: 'AI Setup',
    displayName: 'AI Tooling',
    what: 'Custom instructions (.github/copilot-instructions.md, AGENTS.md, CLAUDE.md), MCP servers, agent configs, AI skills.',
    aiImpact: 'This is the direct interface between your repo and AI agents. Custom instructions dramatically improve code generation quality by teaching agents your conventions.',
    fix: 'Run `agentrc instructions` to generate copilot-instructions.md and configure .vscode/mcp.json.',
  },
];

const ID_TO_PILLAR = (() => {
  const m = new Map();
  for (const p of PILLARS) for (const id of p.ids) m.set(id.toLowerCase(), p);
  return m;
})();

export function lookupPillar(id) {
  if (!id) return null;
  return ID_TO_PILLAR.get(String(id).toLowerCase()) || null;
}

export function severityFor(score) {
  const s = Number(score) || 0;
  if (s >= 0.75) return { icon: '✅', cls: 'good', label: 'strong' };
  if (s >= 0.4)  return { icon: '⚠️', cls: 'warn', label: 'partial' };
  return { icon: '❌', cls: 'bad', label: 'gap' };
}

// Normalize whatever AgentRC emits into a flat array:
// [{ id, name, score:0..1, level?, category, meta, raw }]
export function normalizePillars(readiness) {
  if (!readiness) return [];
  const src = readiness.pillars || readiness.scores || readiness;
  const arr = [];
  const push = (id, raw) => {
    const score = typeof raw === 'number' ? raw
                 : Number(raw?.score ?? raw?.value ?? raw?.percentage ?? 0);
    const meta = lookupPillar(id) || lookupPillar(raw?.id) || lookupPillar(raw?.name);
    arr.push({
      id: id || raw?.id || raw?.name || 'unknown',
      name: meta?.displayName || raw?.name || raw?.title || id || 'Unknown',
      score: score > 1 ? score / 100 : score,
      level: raw?.level ?? null,
      category: meta?.category || (raw?.category ?? 'Repo Health'),
      meta,
      raw: typeof raw === 'object' ? raw : null,
    });
  };
  if (Array.isArray(src)) {
    for (const item of src) push(item.id || item.name, item);
  } else if (src && typeof src === 'object') {
    for (const [k, v] of Object.entries(src)) push(k, v);
  }
  return arr;
}

export function overallScore(readiness, pillars) {
  if (readiness?.overall != null) {
    const o = Number(readiness.overall);
    return o > 1 ? o / 100 : o;
  }
  if (readiness?.score != null) {
    const o = Number(readiness.score);
    return o > 1 ? o / 100 : o;
  }
  if (!pillars.length) return 0;
  return pillars.reduce((s, p) => s + (p.score || 0), 0) / pillars.length;
}

export function maturityFromReadiness(readiness, pillars) {
  const lvl = Number(readiness?.level ?? readiness?.maturity);
  if (Number.isFinite(lvl) && lvl >= 1 && lvl <= 5) return MATURITY[lvl - 1];
  // Fallback heuristic from overall score.
  const s = overallScore(readiness, pillars);
  const idx = Math.min(4, Math.max(0, Math.floor(s * 5)));
  return MATURITY[idx];
}

export function classifyFinding(pillar) {
  const s = pillar.score;
  // High impact / Low effort: critical pillars below 0.4
  const critical = ['ai', 'documentation', 'testing', 'build'];
  const isCritical = pillar.meta && pillar.meta.ids.some((i) => critical.includes(i));
  if (s < 0.4 && isCritical) return 'fix-first';
  if (s < 0.4) return 'fix-next';
  if (s < 0.75) return 'plan';
  return 'ok';
}
