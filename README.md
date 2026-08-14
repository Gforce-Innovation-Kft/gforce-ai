# gforce-ai

Canonical home for Gforce Innovation Kft's shared Claude Code skills, agents, and engineering
standards. Other repos consume this content via `npx skills add`, rather than vendoring their own
copies.

This repo is public: `npx skills add` needs to work without auth in every consuming context, and
its contents are engineering standards, not secrets.

## Layout

- `skills/` — shared skills, consumed via `skills-lock.json`.
- `agents/` — shared agent definitions.
- `evals/` — fixture suites for the agents. Agent dispatch is not wired yet, so fixtures
  currently report *skipped*; no agent has a score.
- `standards/` — fleet-wide documentation and skill-scope policy that shared skills and agents are
  checked against.
- `docs/` — not distributed to consumers.

Start with [`docs/architecture.md`](docs/architecture.md) for repository responsibilities and the
boundary tests, then `standards/doc-standard.md` and `standards/skill-scope.md` for the authoring
rules.
