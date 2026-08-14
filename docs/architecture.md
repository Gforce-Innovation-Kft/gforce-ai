# Platform architecture — repository responsibilities

The decisions. The argument behind them, the responsibility matrix and the roadmap live in
the proposal document; this file is the part agents and reviewers need to apply.

Status: **proposal, 2026-08-14.** Not yet ratified. Where this contradicts a repo's own
`CLAUDE.md`, the repo wins until this is agreed.

## Two axes, not one chain

Two different relations run through the estate, and collapsing them into a single arrow
chain is what makes responsibilities feel like they overlap.

**Supply** — who consumes whose build artifacts. Strictly one-directional, always versioned:

```
sf-docker-images ──image tag──▶ shared-github-actions ──@v2 ref──▶ sfdx_template_enterprise ──clone──▶ instances
```

No arrow here may point backwards. Wanting one means a responsibility is in the wrong repo.

**Authority** — whose word wins on a topic. Cross-cutting, never a build dependency:

```
gforce-ai ──skills-lock.json pin──▶ every repo, including sf-devops-agent
```

Nothing fails to build because `gforce-ai` is unreachable. That property is what lets the
AI layer ship into a client repo without becoming a dependency of the client's product.

**The feedback edge** — one edge runs against supply and is load-bearing:
`sf-develop-demo`'s pipelines are dispatched by `sf-docker-images`' tier-2 E2E gate, and
their failure fails the image PR. `sf-develop-demo` is the canary, not the terminal leaf.
It is a sibling of a client project, not a descendant of one.

`sf-devops-agent` sits outside supply by decision — its `CLAUDE.md` states the redundancy
with `shared-github-actions` is deliberate. It is the first product built *on* the
platform, not a sixth peer.

## Vocabulary: "L1/L2/L3" means three things — stop using it for two of them

| Axis | Was | Use |
|---|---|---|
| Pipeline nesting depth | L1–L4 | **L1–L4** — keep. It got there first, it is in ADR 0002, and it genuinely describes depth. |
| Precedence | L1/L2/L3 | **fleet / shared / local** |
| Knowledge generality | Level 1/2/3 | **general / platform / practice** |

"The *local* standard wins over the *shared* skill, which wins over the *fleet* default."
Words carry ordering; numbers do not.

## Four boundary tests

Apply in order. Each has a yes/no answer, so someone who was not in the conversation —
including an agent — can settle the question.

1. **Runtime or orchestration?** Does it run *inside* the container, or decide *which*
   container runs? Inside → `sf-docker-images`. Decides → `shared-github-actions`.
   A tool install is always the former; a permission grant is always the latter.
2. **Would a client ever want a different version?** Yes → a pinned dependency, upstream.
   No → a template file. This is what keeps the template small.
3. **Is it true regardless of which client?** Always → `gforce-ai`. Only here →
   `local-standards.md`. Only for one client → `local-standards.md` in *their* repo.
   There is no fourth option. **Copying a shared skill to modify it is never the answer** —
   it breaks `npx skills update` permanently and silently.
4. **Does the answer change without a commit?** No → it is a **file**; the agent already
   has file tools. Yes → it is **MCP**. This settles the context-layer question: do not
   build an MCP server to serve repo docs.

## Ownership

| Capability | Owner | Source of truth |
|---|---|---|
| Container images, image release | `sf-docker-images` | Dockerfile + tag; `reusable-docker-image-build.yml` |
| Reusable actions & workflows | `shared-github-actions` | `action.yml` / workflow file; consumers in `docs/usage-catalog.md` |
| Salesforce coding standard | `gforce-ai` | `skills/gforce-salesforce-developer/` |
| Salesforce architecture & test patterns | `sfdx_template_enterprise` | the template itself |
| Release & deployment strategy | `shared-github-actions`, `sf-devops-agent` | reusable workflows; agent domain packs |
| AI skills, agents, rules, evals | `gforce-ai` | `skills/`, `agents/`, `standards/`, `evals/` |
| Local overrides | each repo | its own `.claude/references/local-standards.md` |
| Client project template | `sfdx_template_enterprise` | the repo |
| Reference implementation | `sf-develop-demo` | the repo |

## The AI layer

**Skills** are knowledge, delivered by content-hashed pin in `skills-lock.json`.
Installed by **capability marker** — `sfdx-project.json` → Salesforce layer,
`.github/workflows/*.y{a,}ml` → GitHub Actions layer. The install decision is not the
firing decision: a repo may match a marker while most of its files are out of scope; the
skill's own trigger contract decides when it speaks.

**Agents** are a prompt *plus a tool grant*, and the grant silently overrides what the
prompt claims:

- A granted tool voids a stated guarantee. "Read-only by construction" while holding
  `Bash` is not read-only — `Bash` subsumes edit and write. Read-only means
  `Read, Grep, Glob` and nothing more.
- Write boundaries bind behaviour, not tools. "Never commits" as a four-command blocklist
  is defeated by `gh api`. Phrase it as: never mutate git history, the remote, or GitHub
  state, regardless of which tool would do it.

**Open gap:** agents are delivered by file copy — no hash, no lockfile, no drift check,
while skills have all three. Every agent copy in the estate is an unversioned fork waiting
to happen; on 2026-08-14 a Prettier `lint-staged` glob forked both. The skills were
recoverable because the lockfile caught them. The agents were not.

**Rules** — precedence is fleet → shared → local, last wins. The router reads
`local-standards.md` last so a repo can specialise without touching the shared artifact.
**The filename is load-bearing**: repo rules under any other name are invisible to the
skill.

**Context** — static context is files (`CLAUDE.md` → skill references →
`local-standards.md`); live context is a small allowlisted MCP surface per domain, with
permissions enforced in code rather than in a prompt, as
`sf-devops-agent/platform/tools/org-tools.ts` already does. Test 4 tells you which you hold.

**Evals** — two metrics per agent, always as a pair: recall on planted defects *and*
false-positive rate on clean fixtures. Recall alone is gameable by an agent that flags
everything. An eval may only assert on vocabulary the agent was explicitly taught — check
the literal category string, not the concept.

**Not yet real:** no agent in this estate has ever been scored. The harness, fixtures and
scorecard exist; dispatch does not, so every fixture reports *skipped*. Until that lands,
`agent-standard.md`'s "fails twice, gets deleted" rule is unenforceable and a green
`npm test` is easy to misread as the suites passing.

## Two AI surfaces, one governed

`.claude/` is lockfile-pinned and hash-verified. `.github/` — `copilot-instructions.md`,
`.github/instructions/*.md`, `PULL_REQUEST_TEMPLATE.md` — is hand-maintained, ~200 KB
across the estate, and governed by nothing. It is the surface that carried the wrong
security rule into two repos and it holds a 51 KB byte-identical duplicate in both
`sf-docker-images` and `sf-develop-demo`.

Rule going forward: **the `.github/` surface may summarise the standard but must name the
skill as authoritative and must not restate a rule.** A restated rule is a rule that will
drift.

## Delivery

Poll by default, dispatch when latency matters, catalog as truth. A consumer pulls on its
own schedule via a scheduled `npx skills check` that opens a PR. When a change must land
fast, push a **trigger**, never content: the push path holds `actions:write`, never
`contents:write`. A fan-out that writes into consumer repos is a fan-out that can corrupt
every one of them at once.

| Artifact | Versioned by | Consumed as | Drift detection |
|---|---|---|---|
| Image | semver tag + cosign | tag string | signature verification |
| Action / workflow | floating `@v2` | `uses:` ref | usage catalog |
| Skill | content hash | `skills-lock.json` | `npx skills check` |
| Agent | *none* | copied file | *none* — the open gap |
| Standard | git history | read from the skill | `gforce-skills-auditor` |
| Template | clone point | repository state | none — inherent |

## Naming

- Repos are owner-scoped, not technology-scoped: `gforce-images`, not `docker-images`.
  The technology is the part most likely to change.
- **Do not rename `sf-docker-images` yet.** Trigger: the second non-Salesforce image
  someone actually needs. Cost today is concrete — the cosign certificate identity is the
  reusable workflow's own file path, so a rename invalidates every published
  `cosign verify` command. The directory-per-image layout already gives the module
  structure a rename would supposedly buy.
- Actions stay `<domain>-<object>-<verb>`; reusable workflows stay
  `reusable-<domain>-<name>.yml` (ADR 0002).
