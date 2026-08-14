# Documentation standard

Precedence: **L3 (repo) > L2 (capability) > L1 (fleet)**.

| File | Required | Length | Rule |
|---|---|---|---|
| `standards/*.md` | always | **≤300 lines** | Fleet-wide standards consumed by every repo; the authority other documents defer to. |
| `README.md` | always | any | Humans: what it is, how to run it. |
| `CLAUDE.md` | always | **≤150 lines** | Purpose, key commands, guardrails. Points outward. Never duplicates `standards/` or `references/`. |
| `AGENTS.md` | always | — | **Symlink → `CLAUDE.md`.** Covers Codex/Cursor/Copilot at zero maintenance cost. |
| `.claude/references/*.md` | as needed | ≤300 each | Detail that `CLAUDE.md` points to. Must be reachable from a router. |
| `.claude/references/local-standards.md` | SFDX/GHA repos that specialize | ≤300 | **The L3 extension point.** Shared skills read it LAST; it WINS on conflict. |
| `ARCHITECTURE.md` | codebases only | ≤300 | Structure and why. |
| `DECISIONS.md` | where decisions recur | append-only | ADR log, dated, one per entry. |
| `AI_CONTEXT.md` | **never** | — | Rejected: duplicates `CLAUDE.md` and drifts. One file per audience. |
| `ROADMAP.md` | not per repo | — | Belongs in `career-os`. |

`CLAUDE.md` reaching 150 lines is the signal to move detail into `references/` or a skill.

## Why a repo never forks a shared skill

Copying an L2 skill to tweak it breaks `npx skills update` permanently and drifts silently.
Specialize by adding `.claude/references/local-standards.md` instead. The shared skill's router
reads it last and it wins on conflict.
