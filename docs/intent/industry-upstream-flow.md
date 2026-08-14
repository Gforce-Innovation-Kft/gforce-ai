# Intent — industry-upstream skill flow

Confirmed by Gabor, 2026-08-14 (`interview-me` session). Downstream artifacts:
`standards/upstream-policy.md`, `upstream/catalog.json`,
`.github/workflows/upstream-ratification.yml`, `skills/*/overrides.json`.

- **Outcome:** `gforce-ai` stops being sole author and becomes **curator + ratifier** —
  industry skills (`forcedotcom/sf-skills`) are the base, `gforce-ai` holds only company
  *deltas* plus the approved catalog, repos add local constraints; upstream updates flow
  through one governed pipeline.
- **User:** any developer (or Claude session) opening a GForce repo — full rule stack
  active, zero setup.
- **Why now:** `gforce-ai` just launched; `sf-skills` exists and is maintained by
  Salesforce; the level-naming decision was already on the table (2026-08-14 proposal).
- **Success:** one upstream update = one human review in `gforce-ai`, fleet converges
  mechanically; delta conflicts surfaced in the ratification PR; repo open shows a
  one-line "governed & current" report.
- **Constraint:** never mirror or fork upstream content; the GForce rule always wins at
  runtime; nothing writes on session start.
- **Out of scope:** per-repo upstream reviews, re-hosting upstream bytes, MCP for static
  docs, renaming repos.

## Rulings from the interview

1. **Industry upstream always first.** Never re-author what forcedotcom maintains;
   GForce skills state only the deltas.
2. **Bytes install direct from upstream** (`npx skills add`, hash-pinned per repo).
   `gforce-ai` is catalog-of-record, never a mirror.
3. **Upstream updates are reviewed once, centrally**, in a `gforce-ai` ratification PR.
   Consumer repos converge via mechanical bump PRs; urgent fixes use the existing
   dispatch-trigger path (`actions:write`, never `contents:write`).
4. **Delta conflicts are surfaced in the ratification PR review** — "upstream touched a
   rule you override; confirm or update the delta." At runtime the GForce rule wins
   regardless.
5. **Repo open = read-only report**, one line when clean, expanded only on drift. Drift
   *detection* on open; drift *fixing* only via the scheduled PR path.
6. **Precedence naming:** industry → fleet → shared → local (last wins) — never L1/L2/L3.
