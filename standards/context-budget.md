# Context budget

Measured, not asserted. Re-measure after any change to global skills, agents, or plugins.

| Date | Scope | Startup tokens | Notes |
|---|---|---|---|
| 2026-08-14 | baseline, pre-demotion | _record from `/context`_ | 21 global skills, 10 plugins, 0 agents |
| 2026-08-14 (Task 13) | 3 agents installed, skills still global | _pending — run /context and record_ | 21 global skills (~899 description words total, `~/.claude/skills/`), 10 enabled plugins (`~/.claude/settings.json`), 3 agents installed fleet-wide (`gha-workflow-author` 60 words, `sf-code-reviewer` 59 words, `skills-auditor` 59 words — 178 words total). Live `/context` run requires an interactive session; not available to this non-interactive task run. |

## What was measured for this row

- **Global skills:** 21 skills in `~/.claude/skills/` (accessibility, actions, ai-engineer,
  ai-wrapper-product, best-practices, canvas-design, core-web-vitals, cv-resume-builder,
  devops-engineer, find-skills, gtm-strategy, lean-ctx, notebook-forge, performance,
  product-strategy-session, prompt-engineer, research, salesforce-developer, scroll-experience,
  seo, web-quality-audit). Their `description:` frontmatter fields sum to roughly 899 words.
- **Enabled plugins:** 10, per `enabledPlugins` in `~/.claude/settings.json` (`ci-cd`,
  `frontend-design`, `fullstack-dev-skills`, `gitops-workflows`, `k8s-troubleshooter`,
  `kubernetes-skill`, `monitoring-observability`, `skill-creator`, `superpowers`, `ui-ux-pro-max`).
- **Agents:** the 3 `gforce-ai/agents/*.md` files (`gha-workflow-author`, `sf-code-reviewer`,
  `skills-auditor`) now installed per-repo across the fleet. Description word counts: 60, 59, 59
  — 178 words combined.

## Known dominant cost

`fullstack-dev-skills` contributes roughly 80 skill descriptions to every session — about 4× the
entire global skill set. Decide it with one query, not a vibe: **invocation count of any
`fullstack-dev-skills:*` skill over the last 30 days**, from session history. If that is ~0, the
descriptions are pure cost.
