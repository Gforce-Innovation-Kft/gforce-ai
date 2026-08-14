# CLAUDE.md

## What this repo is

`gforce-ai` is the canonical home for Gforce Innovation Kft's shared Claude Code **skills**,
**agents**, and **engineering standards**. It exists so those things are authored once and
consumed everywhere, instead of being copy-pasted and drifting per repo. This repo is public:
`npx skills add` must work without auth, and its contents are engineering standards, not secrets.

## Layout

- `skills/` — shared, fleet-consumable Claude Code skills.
- `agents/` — shared agent definitions.
- `commands/` — shared slash commands.
- `evals/` — eval suites that check skill/agent behavior against expectations.
- `standards/` — fleet-wide documentation and policy that skills and agents are checked against.
  Start here: `standards/doc-standard.md` and `standards/skill-scope.md`.
- `baseline/` — the minimum bootstrap every consuming repo starts from.
- `migrations/` — dated notes for breaking changes to anything above, so consumers can upgrade
  deliberately instead of guessing.

## How other repos consume this

- **Skills:** `npx skills add Gforce-Innovation-Kft/gforce-ai@<skill>`. This is the only supported
  distribution path for skills — never vendor a copy into a consuming repo.
- **Agents:** the `skills` CLI has no agent verb, so agents are copied or symlinked into the
  consuming repo's `.claude/agents/` directory by hand (or by a bootstrap script). Keep them in
  sync with this repo rather than editing the copy in place.

## The three-layer model

Every consuming repo's configuration is layered, and **L3 > L2 > L1** on any conflict:

- **L1 — fleet.** This repo. Standards and defaults that apply everywhere.
- **L2 — capability.** Skills/agents scoped to a capability marker (e.g. `sfdx-project.json`,
  `Dockerfile*`) — see `standards/skill-scope.md` for the full marker table.
- **L3 — repo.** The consuming repo's own overrides.

## The one hard rule: never fork a shared skill

A repo that needs to specialize a shared skill does **not** copy and edit it — that breaks
`npx skills update` permanently and drifts silently. Instead it adds
`.claude/references/local-standards.md`. Shared skills read that file **last**, and it **wins** on
conflict. That is the only sanctioned L3 extension point.

## Where to look next

This file intentionally stays thin. For the actual rules — required docs, length limits, skill
scoping, capability markers — read `standards/` directly rather than trusting a restatement here.
