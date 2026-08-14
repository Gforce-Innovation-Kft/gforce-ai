# Upstream skill policy

How industry-standard skills (today: `forcedotcom/sf-skills`) enter and stay in the fleet.
Ratified intent: `docs/intent/industry-upstream-flow.md`. Extends the precedence model in
`docs/architecture.md` with a base layer:

> **industry → fleet → shared → local, last wins.**
> An upstream skill is the floor, never the ceiling: any GForce rule — fleet standard,
> shared-skill delta, or `local-standards.md` — beats it on conflict.

## The three rules

1. **Upstream-first.** If industry maintains a skill for the task, we consume it — we do
   not re-author it. GForce skills state only where GForce *differs* (deltas). A GForce
   skill that restates an upstream rule is a rule that will drift — same law as the
   `.github/` surface in `docs/architecture.md`.
2. **Direct install, central approval.** Consumers install upstream skills straight from
   the upstream repo (`npx skills add`), hash-pinned in their own `skills-lock.json`.
   What is *approved*, and at which upstream commit, lives in exactly one place:
   `upstream/catalog.json` in this repo. `gforce-ai` is catalog-of-record, never a mirror
   — re-hosting bytes is forking with extra steps.
3. **One review per upstream change.** Updates reach the fleet only through a
   **ratification PR** in this repo. Consumers never review upstream diffs; they receive
   mechanical bump PRs after ratification.

## The catalog — `upstream/catalog.json`

Per source: `ref` (branch), `ratified_commit` (the last upstream commit a human reviewed
and merged), `ratified_on`, and the approved skill list with a placement `marker`
(capability markers, same mechanism as `skill-scope.md`). A skill absent from the catalog
is not approved — installing it anywhere is a scope violation the `gforce-skills-auditor` flags.

The pin means "last ratified content state": it advances only when approved skill content
changes and the PR merges.

## The ratification pipeline

`.github/workflows/upstream-ratification.yml`, weekly + manual dispatch:

1. Clone each source, diff `ratified_commit..HEAD` restricted to approved skill paths.
   A failed clone **fails the job** — a silent skip would read as an all-clear nobody
   issued.
2. If approved content changed: scan the diff against every delta anchor
   (`skills/*/overrides.json`), advance the pin, and open a PR whose body carries the
   compare link, a per-skill change table, and the conflict checklist.
3. A human reviews and merges. **Merge = ratification.**

**Never auto-merge a ratification PR.** Upstream skill content is third-party
*instructions Claude will execute*; this review is the fleet's prompt-injection boundary.
Read the compare link as instructions, not prose.

## Delta anchors — `skills/<name>/overrides.json`

Machine-readable claims of the form "this GForce skill overrides that upstream rule".
They are what makes conflict notification automatable:

```json
{
  "source": "forcedotcom/sf-skills",
  "overrides": [
    {
      "paths": ["skills/platform-soql-query"],
      "upstream_rule": "WITH SECURITY_ENFORCED",
      "gforce_rule": "WITH USER_MODE — enforces CRUD and sharing as well as FLS",
      "delta": "Hard stops in SKILL.md"
    }
  ]
}
```

- `paths` — directory prefixes **in the upstream repo** the override applies to.
- `upstream_rule` — a literal string grepped for in diff hunks. Keep it short and
  distinctive; it is a tripwire, not a description.
- Detection has two strengths, both surfaced in the PR:
  **CONFLICT** — an anchored path changed *and* the hunk contains `upstream_rule`:
  confirm the delta still stands or update it in the same PR.
  **Touched** — an anchored path changed without the string: skim for a rephrase.
- At runtime none of this matters to precedence: the GForce delta wins whether or not a
  conflict was flagged. Anchors exist for *review*, not for enforcement.

## Consumer convergence

After ratification, consumers converge on their own schedule (poll) or via the dispatch
trigger (latency). The bump PR is mechanical: run `npx skills update` for the affected
skills **on its own branch** (`skills check`/`update` rewrite files — see the trap in
`skill-scope.md`), then verify the resulting lockfile hash corresponds to the ratified
pin. A mismatch means upstream moved past ratification — stop and re-ratify, do not merge.

*Not built yet:* the reusable consumer bump workflow and the hash-vs-pin verifier.
Until they exist, consumer updates are manual but must still follow this order:
ratify first, bump second.

## Session-start report (planned)

Opening a consumer repo yields a **read-only** one-liner when clean —
`gforce-ai ✓ industry@<pin> · company@<version> · local ✓ — no drift` — expanded only on
drift. It never runs `npx skills check` (not read-only) and never mutates anything.
