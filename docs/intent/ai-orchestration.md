# Intent — AI orchestration and cross-repo context management

Confirmed by Gabor, 2026-10-27 (`interview-me` session, started in the platform requirements repo and
moved here because **everything about how AI is used and how context is managed belongs in `gforce-ai`**).
Status: **requirements draft**. Nothing below is built yet.

- **Outcome:** one standard way that Gabor and Claude work across every GForce repo: how each repo's
  `CLAUDE.md` is shaped, which skills and agents it carries, how requirements reach it as context, and how
  AI runs in CI. `gforce-ai` defines it, ships it, and checks it.
- **User:** Gabor plus Claude now. Client teams later: the model must leave room for a client layer
  without building tenancy now.
- **Why now:** every repo is AI-developed; governance v2 exists here but is barely adopted by consumers
  (no consumer manifests, stale lock paths, pre-v2 agent copies, unapproved skills, large ungoverned
  `.github` instruction files).
- **Success:** the conformance check below passes for every active repo.
- **Constraint:** AI in CI reviews and proposes; **it never merges**. GitHub App tokens only, no PATs.
- **Out of scope:** product requirements (they live in the platform requirements repo), tenancy and
  client layers (later).

## Rulings from the interview

1. **Requirements repos hold requirements only.** How Claude is configured, loaded or governed lives here.
2. **AI in CI, phase 1 = review and propose.** PR review against cited requirement IDs, standards
   checks, failure triage. Phase 2 = propose fixes as PRs, e.g. when a failure matches a known,
   human-validated solution. A human always merges.
3. **Conformance check = definition of done.** For each active repo:
   - `CLAUDE.md` is thin and links to where its requirements live;
   - skills and agents come only from `gforce-ai` (catalog-approved, pinned, no stale copies);
   - its requirement slice is present and current.
4. **Enforcement: warn first, then block per repo.** The check reports in CI for every repo, and each
   repo switches to blocking once it is clean.
5. **Same context locally and in CI.** Skills, agents and requirement slices load identically in a local
   Claude session and in GitHub Actions.

## Candidate requirements (unrefined)

- `CAND-ORC-01` A registry lists every platform repo with role, status and owned units.
- `CAND-ORC-02` One command on a fresh machine clones all active repos as siblings and generates a
  multi-root VS Code workspace (decision so far: registry + init script, **not** git submodules, because
  submodules duplicate existing checkouts and nest existing submodules).
- `CAND-ORC-03` The generated workspace never drifts from the registry.
- `CAND-ORC-04` A baseline lock (repo → SHA) can be recorded and cited by verification evidence.
- `CAND-ORC-05` Each implementation repo receives a generated slice of only its requirements, pinned to
  a commit of the requirements repo, delivered as a PR.
- `CAND-ORC-06` Implementation repos cite requirement IDs in test names and PR titles; a traceability
  matrix (requirement → repo → test → status) is built from them and flags drift.
- `CAND-ORC-07` Each repo's `CLAUDE.md` stays under a size limit (TBD) and carries no copied fleet rules.
- `CAND-ORC-08` Each repo has a context budget (CLAUDE.md + auto-loaded skills ≤ N tokens), measured
  automatically.
- `CAND-ORC-09` Exactly one AI instruction surface per repo is authoritative (`.claude/` vs `.github/`).
- `CAND-ORC-10` Every agent definition declares a permission level: read, propose, or write.
- `CAND-ORC-11` Cross-repo Claude sessions add only the repos involved (`--add-dir`).

## Open questions

- [ ] Upstream the gforce-lab findings (5 layers, policy files, versioned packages) before this is
  `ready`, or keep 4 layers until the first client?
- [ ] Bring existing `.github/instructions` files under governance, or delete them?
- [ ] `CLAUDE.md` size limit and context budget N: baseline with `gforce-skills-auditor` first.
- [ ] Should the registry live in this public repo (repo names and roles become public) or in a private
  repo that this tooling reads?
- [ ] Traceability scan: GitHub code search (App token in CI) or a local scan over sibling checkouts?

## Prior art

A working prototype of the registry, the init/status/workspace/pin CLI and the generated workspace exists
in the history of the private platform requirements repo (`tools/platform.ts`, `registry/`). Port it into
`src/cli.ts` with vitest coverage once these requirements are approved. Don't copy it as-is.
