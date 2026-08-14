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
- `upstream/` — approved industry skills and their ratified pins (`catalog.json`).
  Policy: `standards/upstream-policy.md`. Never a mirror — bytes install from upstream.
- `schemas/`, `src/`, `tests/` — governance tooling (strict TypeScript + vitest):
  schema/naming/version validators, the ratification poller, the consumer manifest
  generator. One entry point: `npx tsx src/cli.ts`. CI (`validate.yml`) is static only —
  typecheck + tests + diff checks, zero LLM tokens.
- `templates/` — canonical agent/skill file shapes; the naming validator enforces them.
- `docs/` — not distributed. `architecture.md`, `deferred-verification.md`, and
  `docs/design/` (specs and plans, kept as historical record).

**Naming:** every GForce-owned agent and skill is namespaced `gforce-*` (validator-
enforced, `standards/invariants.md` #9) so upstream and company-owned content are
mechanically distinguishable. `commands/`, `baseline/` and `migrations/` were planned
and are not built; do not reference them as if they were.

## How other repos consume this

- **Skills:** `npx skills add Gforce-Innovation-Kft/gforce-ai@<skill>`. This is the only supported
  distribution path for skills — never vendor a copy into a consuming repo.
- **Agents:** the `skills` CLI has no agent verb, so agents are copied into the consuming repo's
  `.claude/agents/` — but every copy is hash-pinned in the consumer's `gforce-manifest.json`
  (`npx tsx src/cli.ts manifest <consumer-dir>`). An edited copy surfaces as **DRIFT** in
  `npx tsx src/cli.ts verify <dir>` and in the read-only SessionStart report
  (`scripts/session-report.mjs`, vendored to consumers). A Prettier `lint-staged` glob silently
  rewrote agent copies on 2026-08-14 — that class of failure is now detectable. Agent copies stay
  read-only: changes land here first (`standards/invariants.md` #5).

## Precedence: industry → fleet → shared → local, last wins

Every consuming repo's configuration is layered. **Local beats shared beats fleet beats
industry** on any conflict:

- **industry** — ratified upstream skills (`upstream/catalog.json`, e.g.
  `forcedotcom/sf-skills`). The floor, never the ceiling: any GForce layer beats them.
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
conflict — **except the non-overridable core** marked ● in `standards/invariants.md`
(credential and supply-chain rules); exceptions to those require a PR here, not a local edit.
That local file is the only sanctioned local-layer extension point.

## Where to look next

This file intentionally stays thin. For the actual rules — required docs, length limits, skill
scoping, capability markers — read `standards/` directly rather than trusting a restatement here.

For **which repository owns what**, the boundary tests that settle a placement argument, and the
file-vs-MCP rule for context: `docs/architecture.md`.
