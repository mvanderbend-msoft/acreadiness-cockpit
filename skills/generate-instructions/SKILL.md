---
name: generate-instructions
description: "Generate tailored AI agent instruction files via AgentRC's `agentrc instructions` command. Produces AGENTS.md (recommended for multi-agent), .github/copilot-instructions.md (Copilot-only), and optional area-scoped instructions for monorepos. Use after running /assess to close gaps in the AI Tooling pillar."
argument-hint: "[--output AGENTS.md|.github/copilot-instructions.md] [--strategy flat|nested] [--areas | --area <name>] [--claude-md] [--dry-run]"
---

# /generate-instructions — write AI agent instructions

Use this skill whenever the user wants to **create**, **regenerate**, or **refresh** their custom instructions for AI coding agents (Copilot, Claude, etc.). This is the *Generate* step in AgentRC's **Measure → Generate → Maintain** loop and the single highest-leverage action for the **AI Tooling** pillar.

## Output options

VS Code recognises several instruction file types — AgentRC generates the most common ones:

| File | Scope | When to use |
|---|---|---|
| `AGENTS.md` | Always-on, whole workspace | **Recommended** — works with Copilot, Claude, and other agents |
| `.github/copilot-instructions.md` | Always-on, whole workspace | Copilot-only repos |
| `.instructions.md` files | File-pattern or task-based | Targeted rules for specific languages or folders |

## Strategies

- **`flat`** *(default)* — single instructions file at the repo root. Simple, easy to review.
- **`nested`** — hub file at the root plus per-topic detail files in `.agents/`. Better for large or multi-stack repos.

For monorepos, generate **area-scoped** instructions (`--areas`, `--area <name>`, or `--areas-only`). Areas are defined in `agentrc.config.json`.

## Steps

1. **Pick the target file**. Default to `AGENTS.md`. Ask only if the user hints at a different scope (e.g. "Copilot only" → `.github/copilot-instructions.md`).
2. **Always ask which strategy to use** — `flat` or `nested` — unless the user already specified one in their message or via `--strategy`. Present the trade-off briefly:
   - **Flat** *(default)* — one file at the repo root. Simple, easy to review in a single PR. Best for small/medium repos with one stack.
   - **Nested** — hub file at the root + per-topic detail files in `.agents/`. Optionally also emits `CLAUDE.md` with `--claude-md`. Best for large or multi-stack repos.
   Recommend `nested` proactively when the repo has > 5 top-level directories, multiple stacks, or already uses a monorepo tool (turbo/nx/pnpm workspaces).
3. **Detect monorepo areas** by reading `agentrc.config.json` (if any). Offer `--areas` if there are areas.
4. **Run dry-run first** so the user can preview:
   ```bash
   npx -y github:microsoft/agentrc instructions --output <file> --strategy <flat|nested> [--areas|--area <name>] [--claude-md] --dry-run
   ```
5. **Show a short summary** of what would change — files that would be created or overwritten, area count, model used (default `claude-sonnet-4.6`).
6. **On confirmation, run the same command without `--dry-run`** (and optionally `--force` if files already exist).
7. **Verify** by reading the generated file(s) back and showing the user a 1-paragraph synopsis: stack detected, conventions captured, length.
8. **Suggest next steps**:
   - Re-run the `assess` skill to confirm the AI Tooling pillar score improved.
   - If the user already has `copilot-instructions.md` and `AGENTS.md`, recommend consolidating to a single source of truth (AgentRC flags this at maturity Level 2+).

## Notes

- AgentRC reads your **actual code** — no templates. Output reflects detected languages, frameworks, and conventions.
- `--claude-md` (nested strategy only) also emits `CLAUDE.md`.
- Never run this skill non-interactively in CI; instructions are part of the repo and should land via PR.
