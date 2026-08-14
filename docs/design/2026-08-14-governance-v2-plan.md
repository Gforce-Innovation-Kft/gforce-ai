# Governance v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved governance v2 spec (`docs/design/2026-08-14-governance-v2.md`): naming enforcement, hardened overrides, zero-token CI, agent provenance, consumer convergence, versioning/releases, catalog extension.

**Architecture:** All validators are dependency-light shell/node scripts under `scripts/`, wired into one static `validate.yml`; tests run against synthetic git fixtures (no network). Renames land after CI is green in warning mode, then flip to blocking (tag `v2.0.0`).

**Tech Stack:** TypeScript (strict) + vitest + tsx, ajv, node 22, GitHub Actions, `gh` CLI.

> **Amendment (2026-08-14, Gabor):** all governance tooling is TypeScript under
> `src/` with vitest tests under `tests/` — the bash originals were ported and
> deleted (three separate SIGPIPE workarounds made them unreadable). Early-stage
> scope: light tests (only load-bearing cases), CI = typecheck + vitest + the two
> diff-based checks, nothing more. The separate anchors CI job was dropped; dead
> anchors surface as **DEAD ANCHOR** lines in the weekly ratification report,
> which already clones the sources.

## Global Constraints

- Branch: `feat/governance-v2`; conventional commits; commit after every task.
- CI burns zero LLM tokens — `evals/run-suite.ts` is dispatch-only.
- bash 3.2 compatible (no `mapfile`); pipefail-safe grep (`grep -c … || true`, never `grep -q` mid-pipe).
- Namespace regex: `^gforce-[a-z0-9-]+$`. Non-overridable invariants marked ● in `standards/invariants.md`.
- No PATs; GitHub App tokens for anything cross-repo. `npx skills` writes only on dedicated branches.
- Scripts accept a root-dir argument so tests can point them at fixtures.

---

### Task 1: JSON Schemas + ajv validator

**Files:** Create `schemas/catalog.schema.json`, `schemas/overrides.schema.json`, `scripts/validate-schemas.mjs`, `package.json` (root, private, devDep `ajv@^8`), `tests/lib.sh` (assert helpers), `tests/test-schemas.sh`, `tests/run.sh`.

**Interfaces:** `node scripts/validate-schemas.mjs [rootDir]` → exit 0/1, per-file errors on stderr. `tests/run.sh` runs every `tests/test-*.sh`, fails on first failure. `tests/lib.sh` provides `assert_ok "desc" cmd…`, `assert_fail "desc" cmd…`, `assert_contains "desc" haystack needle`.

- [ ] Schemas: catalog requires `sources{ref, ratified_commit(40-hex), ratified_on(date), skills[{name,path,marker}]}`; overrides requires `source`, `overrides[{upstream_paths[](minItems 1), tripwires[](minItems 1), gforce_rule, reason}]`, optional `delta`; `additionalProperties` allowed only for `$comment`.
- [ ] `validate-schemas.mjs`: validate `upstream/catalog.json` + every `skills/*/overrides.json` under rootDir (default `.`).
- [ ] Test: current catalog passes; fixture overrides with old field names (`upstream_rule`) fails (expected to fail until Task 2 migrates the real file — test uses fixtures in `$TMP`, real-file check comes via `tests/run.sh` after Task 2).
- [ ] `npm install`, run tests, commit.

### Task 2: Migrate overrides to `tripwires[]` + ratification script update + verdict tests

**Files:** Modify `skills/salesforce-developer/overrides.json` (`paths`→`upstream_paths`, `upstream_rule`→`tripwires` array — add variant `SECURITY_ENFORCED` to the first, keep `System.debug` single; `delta`→keep, add `reason`), `.github/scripts/upstream-ratification.sh` (jq reads new fields; loop tripwire variants, hits accumulate; new env `SOURCE_BASE_URL` default `https://github.com/` so tests can use `file://`). Create `tests/test-ratification-verdicts.sh`.

**Interfaces:** script contract unchanged: `changed=` to `$GITHUB_OUTPUT`, report to `$REPORT_PATH`, verdicts `CONFLICT`/`Touched` per skill.

- [ ] Verdict test builds a synthetic upstream in `$TMP`: git repo `acme/demo-skills` with `skills/demo/SKILL.md` containing line `Use WITH SECURITY_ENFORCED here.`; temp gforce-ai root with catalog pinned at commit A and one override (`tripwires: ["WITH SECURITY_ENFORCED"]`).
  - UNCHANGED: HEAD==pin → report says no changes, `changed=false`.
  - TOUCHED: commit B edits a different line under `skills/demo/` → verdict `Touched`.
  - CONFLICT: commit C rewords the tripwire line → verdict `CONFLICT`; also assert a second variant (`SECURITY_ENFORCED`) fires when the primary is reworded to `WITH \`SECURITY_ENFORCED\``.
- [ ] Run: `bash tests/test-ratification-verdicts.sh` → all three verdicts asserted. Real overrides file now passes schema test. Commit.

### Task 3: Templates + naming/structure validator

**Files:** Create `templates/agent-template.md`, `templates/skill-template.md`, `scripts/validate-naming.sh`, `tests/test-naming.sh`.

**Interfaces:** `scripts/validate-naming.sh [--strict] [rootDir]` → exit 0 ok / 1 errors; namespace violations are warnings without `--strict`, errors with. Checks agents (`agents/*.md`): name==filename stem, namespace regex, `tools:` explicit (no `*`), `model:` present, `version:` semver, description has `TRIGGER when:` **and** `DO NOT TRIGGER when:`, body ≤200 lines. Skills (`skills/*/SKILL.md`): name==dir name, namespace regex, `version:` semver, `description:` present.

- [ ] Write failing test: good fixture passes strict; bad fixtures (wrong stem, no prefix under --strict, `tools: *`, missing TRIGGER, 201-line body, bad semver) each fail with matching message.
- [ ] Implement, tests green, commit.

### Task 4: Version-bump + scorecard checks

**Files:** Create `scripts/check-version-bump.sh`, `scripts/check-scorecard.sh`, `tests/test-version-bump.sh`, `standards/evals/` (dir + `README.md` describing scorecard format).

**Interfaces:** `check-version-bump.sh <base-ref> [rootDir]` — for each changed `agents/*.md` or `skills/*/…` vs base-ref: frontmatter `version:` must differ from base (new files exempt); exit 1 listing offenders. `check-scorecard.sh [--advisory] <base-ref> [rootDir]` — changed `agents/<n>.md` needs `standards/evals/<n>.scorecard.json` with `.content_sha256 == sha256(agent file)`; advisory → warnings, exit 0. Scorecard format: `{agent, content_sha256, recall:{hits,total}, false_positives, clean_total, run_at, cost_cents}` (written manually from `run-suite.ts` output for now).

- [ ] Test in a synthetic git repo (commit base, change skill without bump → FAIL; with bump → PASS; new file → PASS).
- [ ] Implement both, tests green, commit.

### Task 5: `validate.yml` + dead-anchor check

**Files:** Create `.github/workflows/validate.yml`, `scripts/check-anchors.sh`.

**Interfaces:** `check-anchors.sh [rootDir]` — for each overrides source: shallow-fetch `ratified_commit` from `${SOURCE_BASE_URL:-https://github.com/}<source>`, `git ls-tree` each `upstream_paths` prefix; exit 1 on dead anchor. Workflow: `permissions: {}` top-level; job `static` (contents:read): checkout, node 22, `npm ci`, `validate-schemas.mjs`, `validate-naming.sh` (warning mode until Task 7 flips to `--strict`), `check-version-bump.sh origin/main`, `check-scorecard.sh --advisory origin/main`, `bash tests/run.sh`; job `anchors` (contents:read, network) runs `check-anchors.sh`.

- [ ] Anchor-check test rides the Task 2 synthetic upstream via `SOURCE_BASE_URL=file://…` (add case to `tests/test-ratification-verdicts.sh`: prefix removed upstream → exit 1).
- [ ] yamllint-clean; commit; push branch; verify the run is green on GitHub.

### Task 6: Invariants + docs rewrite

**Files:** Create `standards/invariants.md` (12 invariants from spec, ● core marked, "exceptions to ● require a gforce-ai PR"). Modify `CLAUDE.md` (link invariants; layout additions: schemas/, scripts/, templates/, tests/), `standards/skill-scope.md` + `standards/agent-standard.md` (naming namespace, `version:` field, scorecard format pointer, local-standards limit), `docs/architecture.md` (ASCII layer + update-flow diagram from spec §Architecture; §23 how-to answers: create an agent / create an override / how consumers update / what must never be done).

- [ ] Write, `validate-naming.sh` still green (templates/standards not matched as agents), commit.

### Task 7: Renames — agents + skill → `gforce-` namespace

**Files:** `git mv agents/{sf-code-reviewer→gforce-sf-code-reviewer}.md`, `{gha-workflow-author→gforce-gha-workflow-author}.md`, `{skills-auditor→gforce-skills-auditor}.md`; `git mv skills/salesforce-developer skills/gforce-salesforce-developer`; `git mv evals/sf-code-reviewer evals/gforce-sf-code-reviewer`, `evals/gha-workflow-author evals/gforce-gha-workflow-author`. Update frontmatter `name:` + set `version: 2.0.0` in all renamed files; sweep old names in: `docs/architecture.md`, `docs/deferred-verification.md`, `standards/*.md`, `skills/gforce-salesforce-developer/SKILL.md`, `evals/*/suite.json`, `agents/*.md` cross-references. Flip `validate.yml` naming step to `--strict`. Outside repo (no commit needed): `mv ~/.claude/agents/skills-auditor.md ~/.claude/agents/gforce-skills-auditor.md` + update its `name:`.

- [ ] `grep -rn "sf-code-reviewer\|gha-workflow-author\|salesforce-developer" --include="*.md" --include="*.json" .` returns only `gforce-*` forms (and historical design docs, which keep old names as record).
- [ ] `validate-naming.sh --strict` green; `tests/run.sh` green; commit.

### Task 8: Manifest + verifier + SessionStart report

**Files:** Create `scripts/gen-manifest.sh`, `scripts/verify-pins.sh`, `scripts/session-report.sh`, `tests/test-manifest.sh`, `schemas/manifest.schema.json`.

**Interfaces:**
- `gen-manifest.sh <consumer-dir>` → writes `<consumer-dir>/gforce-manifest.json`: `{gforce_ai_commit: <HEAD sha of this repo>, gforce_ai_release: <latest v* tag or null>, agents: {name: "sha256:<hex>" for each .claude/agents/*.md}, generated_at}`.
- `verify-pins.sh <consumer-dir> [--online]` → recompute agent hashes vs manifest; `--online` additionally byte-verifies lockfile skills from ratified sources against `ratified_commit`. Prints `OK` or `DRIFT: <detail>` lines; exit 0 ok, 2 drift.
- `session-report.sh <consumer-dir>` → read-only single line: `GForce governance: OK — industry <pin7> → fleet <release|commit7> → shared ✓ → local <active|none>`; on drift prints `GForce governance: DRIFT` + verify-pins detail; catalog staleness via `curl -m 2` fail-soft (`offline`). Never writes.

- [ ] Test: temp consumer with one agent file → gen → verify OK; tamper agent → DRIFT exit 2; session-report contains `OK —` / `DRIFT`.
- [ ] Implement, tests green, commit.

### Task 9: Convergence bump workflow + release workflow

**Files:** Create `.github/workflows/reusable-governance-bump.yml` (`workflow_call`, inputs: `gforce_ai_ref` default `main`; job: checkout consumer, checkout gforce-ai to `$RUNNER_TEMP`, run `verify-pins.sh` local mode → if drift/behind: branch `chore/governance-bump`, `npx skills update`, `gen-manifest.sh .`, `peter-evans/create-pull-request@v7`; `permissions: contents: write, pull-requests: write` at job level only). Create `.github/workflows/release.yml` (on `push: tags: v*.*.*`: `gh release create` with `--generate-notes`; `permissions: contents: write`).

- [ ] yamllint + `gh workflow` syntax check via push; commit.

### Task 10: Catalog extension (3 sources) + branch protection

**Files:** Modify `upstream/catalog.json` — add sources `trailofbits/skills` (skill `devcontainer-setup`, marker `.devcontainer/**`), `sickn33/antigravity-awesome-skills` (skill `docker-expert`, marker `Dockerfile*`), `github/awesome-copilot` (skill `multi-stage-dockerfile`, marker `Dockerfile*`); pins = current HEAD via `git ls-remote`, **content reviewed in this PR** (that's the ratification).

- [ ] Review each skill's content at HEAD (fetch raw SKILL.md, read for instruction-supply-chain red flags) — record verdict in PR body.
- [ ] Schema + `check-anchors.sh` green against the new rows; commit.
- [ ] Repo settings: `gh api -X PATCH repos/Gforce-Innovation-Kft/gforce-ai -f allow_auto_merge=false`; branch protection on `main`: require PR, required status check `static`, no force pushes, `enforce_admins=true`, 0 required approvals (solo maintainer — PR flow enforced, self-merge allowed).

### Task 11: PR, tag, consumer pilot (sf-docker-images)

- [ ] Open PR `feat/governance-v2` → main with §24 summary; merge after green `validate.yml`.
- [ ] Tag `v2.0.0` on main (breaking: renames), push → `release.yml` creates the Release.
- [ ] sf-docker-images (branch `chore/governance-v2-adoption`): rename `.claude/agents/gha-workflow-author.md` → `gforce-gha-workflow-author.md` (+`name:`), update CLAUDE.md references, run `gen-manifest.sh`, add thin caller `.github/workflows/governance-bump.yml` (weekly cron + dispatch → reusable), register SessionStart hook in `.claude/settings.json` → `bash <path>/session-report.sh .` — script vendored into `scripts/governance/` (copies are fine: hash-pinned in the manifest itself). PR, verify session-report prints `OK` line locally, merge.
- [ ] sf-develop-demo agent copies: follow-up bump PR (listed as rollout, not in this change).

## Self-review notes

- Spec §7 scorecard-freshness ships advisory (Task 4/5) because renames (Task 7) change content hashes and regenerating scorecards costs tokens — flipping to blocking is a one-line change once Gabor dispatches one eval run. Recorded as the only remaining gap.
- Verdict tests cover UNCHANGED/TOUCHED/CONFLICT + multi-variant tripwire + dead anchor; manifest tests cover OK/DRIFT; naming tests cover PASS/FAIL — full §22 matrix except eval fixtures, which already exist.
