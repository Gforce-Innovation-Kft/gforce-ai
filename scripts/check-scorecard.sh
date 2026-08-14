#!/usr/bin/env bash
# A PR that changes an agent must carry a current eval scorecard. CI never
# runs the evals itself (token spend is always an explicit human decision —
# `cd evals && npx tsx run-suite.ts <agent>` or the dispatch workflow); this
# only verifies the recorded scorecard matches the agent's current bytes.
#
# Usage: check-scorecard.sh [--advisory] <base-ref> [rootDir]
set -euo pipefail

advisory=false
if [ "${1:-}" = "--advisory" ]; then
  advisory=true
  shift
fi
base="${1:?usage: check-scorecard.sh [--advisory] <base-ref> [rootDir]}"
root="${2:-.}"
git -C "$root" rev-parse --verify --quiet "$base^{commit}" > /dev/null

sha256() {
  if command -v sha256sum > /dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1
}

problems=0
flag() {
  if [ "$advisory" = true ]; then echo "WARN: $1"; else
    echo "ERROR: $1"
    problems=$((problems + 1))
  fi
}

while IFS= read -r f; do
  case "$f" in agents/*.md) ;; *) continue ;; esac
  [ -f "$root/$f" ] || continue
  name="$(basename "$f" .md)"
  card="$root/standards/evals/$name.scorecard.json"
  if [ ! -f "$card" ]; then
    flag "$f changed but standards/evals/$name.scorecard.json is missing — dispatch the eval suite and record the score"
    continue
  fi
  want="$(sha256 "$root/$f")"
  have="$(jq -r '.content_sha256 // empty' "$card")"
  if [ "$want" != "$have" ]; then
    flag "$f changed but its scorecard hash is stale — re-run the eval suite against the new content"
  fi
done < <(git -C "$root" diff --name-only "$base...HEAD")

echo "scorecards: $problems problem(s) (advisory=$advisory)"
[ "$problems" -eq 0 ] || exit 1
