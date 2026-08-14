# Skill scope policy

> A skill is **global** only if ≥3 repos consume it AND it is not derivable from a capability
> marker. Anything a capability marker can place is **project-scoped** — placement then follows
> from what the repo is, and cannot drift.

## Capability markers

| Marker | Places |
|---|---|
| `sfdx-project.json` | `gforce-salesforce-developer` skill + `gforce-sf-code-reviewer` agent |
| `.github/workflows/*.y{a,}ml` | `gforce-github-actions` skill + `gforce-gha-workflow-author` agent |
| `Dockerfile*` | `docker-expert`, `multi-stage-dockerfile`, `devcontainer-setup` skills |
| `*.tf` | `terraform-test`, `terraform-module-library` skills |

**Note:** unlike the SFDX and GHA rows, the Docker and Terraform rows name **externally vendored
skills with no GForce-authored agent**. That asymmetry is real (nobody has written a
`docker-reviewer` or `terraform-reviewer` agent yet) and is left visible here rather than papered
over with a placeholder name.

## Global set (6)

`find-skills` · `lean-ctx` · `research` · `prompt-engineer` · `devops-engineer` · `actions`

Everything else is project-scoped. Audited quarterly by the `gforce-skills-auditor` agent.

## Upstream-sourced skills

Industry skills (e.g. `forcedotcom/sf-skills`) also place by capability marker, but their
approved set and ratified pins live in `upstream/catalog.json`, governed by
`standards/upstream-policy.md`. A skill absent from that catalog is not approved anywhere.

## Operational trap

**`npx skills check` is NOT read-only.** It fetches upstream and rewrites `SKILL.md` and
`skills-lock.json` in place. Run it deliberately on its own branch and review the diff as a real
content change. Never run it inside another PR expecting a report.
