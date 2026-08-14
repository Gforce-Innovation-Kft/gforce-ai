# Skill scope policy

> A skill is **global** only if ≥3 repos consume it AND it is not derivable from a capability
> marker. Anything a capability marker can place is **project-scoped** — placement then follows
> from what the repo is, and cannot drift.

## Capability markers

| Marker | Places |
|---|---|
| `sfdx-project.json` | `salesforce-developer` skill + `sf-code-reviewer` agent |
| `.github/workflows/*.y{a,}ml` | `gforce-github-actions` skill + `gha-workflow-author` agent |
| `Dockerfile*` | docker skills |
| `*.tf` | terraform skills |

## Global set (6)

`find-skills` · `lean-ctx` · `research` · `prompt-engineer` · `devops-engineer` · `actions`

Everything else is project-scoped. Audited quarterly by the `skills-auditor` agent.

## Operational trap

**`npx skills check` is NOT read-only.** It fetches upstream and rewrites `SKILL.md` and
`skills-lock.json` in place. Run it deliberately on its own branch and review the diff as a real
content change. Never run it inside another PR expecting a report.
