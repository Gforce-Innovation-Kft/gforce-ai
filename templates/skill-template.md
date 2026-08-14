---
name: gforce-<domain>
description: >
  <One sentence of scope, then:>
  TRIGGER when: <precise firing condition>.
  DO NOT TRIGGER when: <precise non-firing condition>.
version: 1.0.0
---

# <Skill title>

<House deltas only — never restate an upstream or fleet rule (a restated rule
drifts; standards/upstream-policy.md). If this skill overrides an upstream
rule, declare it in this directory's overrides.json (schema:
schemas/overrides.schema.json) so the ratification scan can defend it.>

<End by reading `.claude/references/local-standards.md` in the consuming repo
last — it wins on conflict, except the non-overridable core in
standards/invariants.md.>
