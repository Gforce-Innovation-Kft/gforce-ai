# Governance invariants

The rules the whole system is built on. ● marks the **non-overridable core**:
`local-standards.md` wins on everything else, but a ● rule cannot be overridden
locally — an exception requires a `gforce-ai` PR, not a local edit.

1. ● **Upstream content is never modified in place, mirrored, or forked.**
   GForce maintains deltas (`skills/*/overrides.json`); upstream stays the
   floor, never the ceiling.
2. ● **Every upstream dependency is pinned** — lockfile hash in the consumer,
   ratified commit in `upstream/catalog.json`.
3. ● **Upstream changes touching an override require central human review.**
   The ratification PR is the fleet's prompt-injection boundary and is never
   auto-merged.
4. ● **No personal access tokens anywhere in the fleet** — scoped GitHub App
   installation tokens only.
5. ● **Consumer agent copies are read-only.** Changes land in `gforce-ai`
   first; `gforce-manifest.json` hashes catch local edits as DRIFT.
6. ● **`npx skills check`/`update` run only on dedicated branches** — they
   rewrite installed skills and the lockfile in place.
7. ● **Governance checks are read-only** outside a controlled update PR; the
   SessionStart report never writes.
8. **Overrides are deltas with machine-readable provenance**
   (schema-validated `upstream_paths` + `tripwires`), never restatements.
9. **Every GForce-owned agent and skill carries the `gforce-` namespace**
   (validator-enforced).
10. **Consumers converge only from a ratified state** — ratify first, bump
    second.
11. **Agent changes carry a current eval scorecard** (`standards/evals/`);
    running evals is always an explicit human decision, never an ambient CI
    cost.
12. **Local standards are the final extension point** and win on everything
    outside the ● core.

Enforcement map: 8–9 → `validate.yml` (schemas, naming) · 5 → manifest verify
+ session report · 3 → `upstream-ratification.yml` + branch protection ·
11 → scorecard freshness check · the rest are review rules stated here once.
