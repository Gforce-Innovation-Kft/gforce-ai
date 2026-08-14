# CLAUDE.md

## What this repo is

`gforce-ai` is the canonical home for Gforce Innovation Kft's shared Claude Code **skills**,
**agents**, and **engineering standards**. It exists so those things are authored once and
consumed everywhere, instead of being copy-pasted and drifting per repo. This repo is public:
`npx skills add` must work without auth, and its contents are engineering standards, not secrets.

## Layout

- `skills/` — shared, fleet-consumable Claude Code skills.
- `agents/` — shared agent definitions.
- `evals/` — eval suites that check agent behavior against expectations.
  **Caveat: agent dispatch is not wired yet, so every fixture currently reports *skipped*.**
  A green `npm test` means the harness's own unit tests pass, not that any agent scored.
- `standards/` — fleet-wide policy that skills and agents are checked against.
  Start here: `standards/doc-standard.md` and `standards/skill-scope.md`.
- `docs/` — not distributed. `architecture.md` (repository responsibilities and boundary
  tests) and `deferred-verification.md` (checks that need a live org).

Nothing else exists yet. `commands/`, `baseline/` and `migrations/` were planned and are
not built; do not reference them as if they were.

## How other repos consume this

- **Skills:** `npx skills add Gforce-Innovation-Kft/gforce-ai@<skill>`. This is the only supported
  distribution path for skills — never vendor a copy into a consuming repo.
- **Agents:** the `skills` CLI has no agent verb, so agents are copied into the consuming repo's
  `.claude/agents/` by hand. **This is a known architectural gap, not a design choice.** A copied
  agent has no hash, no lockfile entry and no drift check, so it can be silently rewritten — a
  Prettier `lint-staged` glob did exactly that on 2026-08-14. The vendored skills were recoverable
  because the lockfile caught them; the agents were not. Closing this gap is on the roadmap in
  `docs/architecture.md`.

## Precedence: fleet → shared → local, last wins

Every consuming repo's configuration is layered. **Local beats shared beats fleet** on any
conflict:

- **fleet** — this repo. Standards and defaults that apply everywhere.
- **shared** — skills and agents placed by capability marker (e.g. `sfdx-project.json`,
  `Dockerfile*`) — see `standards/skill-scope.md` for the full marker table.
- **local** — the consuming repo's own `.claude/references/local-standards.md`.

Say **fleet / shared / local**, not L1/L2/L3. "L1–L4" already means pipeline nesting depth in
`shared-github-actions` (ADR 0002), and "Level 1/2/3" means knowledge generality in the
`sf-devops-agent` design. Three axes were sharing one label; only the pipeline one keeps it.

## The one hard rule: never fork a shared skill

A repo that needs to specialize a shared skill does **not** copy and edit it — that breaks
`npx skills update` permanently and drifts silently. Instead it adds
`.claude/references/local-standards.md`. Shared skills read that file **last**, and it **wins** on
conflict. That is the only sanctioned L3 extension point.

## Where to look next

This file intentionally stays thin. For the actual rules — required docs, length limits, skill
scoping, capability markers — read `standards/` directly rather than trusting a restatement here.

For **which repository owns what**, the boundary tests that settle a placement argument, and the
file-vs-MCP rule for context: `docs/architecture.md`.
