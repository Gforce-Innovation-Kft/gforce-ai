#!/usr/bin/env bash
# Polls every upstream source pinned in upstream/catalog.json, diffs the
# approved skill paths since the last ratified commit, scans the diff against
# every delta anchor (skills/*/overrides.json), and emits:
#   - upstream/catalog.json with advanced candidate pins
#   - a ratification PR body at $REPORT_PATH
#   - changed=true|false on $GITHUB_OUTPUT
# Policy: standards/upstream-policy.md. Merge of the resulting PR = ratification.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
CATALOG="$ROOT/upstream/catalog.json"
REPORT="${REPORT_PATH:-${RUNNER_TEMP:-/tmp}/ratification-report.md}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

changed=false
today="$(date -u +%F)"
: > "$REPORT"

while IFS= read -r src; do
  ref="$(jq -r --arg s "$src" '.sources[$s].ref' "$CATALOG")"
  pinned="$(jq -r --arg s "$src" '.sources[$s].ratified_commit' "$CATALOG")"
  dir="$WORK/${src//\//_}"

  # A failed clone must fail the job: a silent skip would read as "no upstream
  # changes" — an all-clear nobody issued.
  git clone --quiet --single-branch --branch "$ref" "https://github.com/$src.git" "$dir"
  head="$(git -C "$dir" rev-parse HEAD)"
  [ "$head" = "$pinned" ] && continue

  if ! git -C "$dir" cat-file -e "$pinned^{commit}" 2>/dev/null; then
    echo "::error::Pinned commit $pinned no longer reachable in $src — upstream history rewritten. Manual ratification required."
    exit 1
  fi

  # while-read instead of mapfile: this also runs on macOS bash 3.2 for manual
  # ratifications, not only on the runner's bash 5.
  skill_paths=()
  while IFS= read -r p; do skill_paths+=("$p"); done \
    < <(jq -r --arg s "$src" '.sources[$s].skills[].path' "$CATALOG")
  changed_files=()
  while IFS= read -r f; do changed_files+=("$f"); done \
    < <(git -C "$dir" diff --name-only "$pinned..$head" -- "${skill_paths[@]}")
  [ "${#changed_files[@]}" -eq 0 ] && continue

  changed=true
  {
    echo "## \`$src\` — \`${pinned:0:7}\` → \`${head:0:7}\`"
    echo
    echo "Full content diff — review as **instructions Claude will execute**, not as prose:"
    echo "https://github.com/$src/compare/$pinned...$head"
    echo
    echo "| Approved skill | Files changed |"
    echo "|---|---|"
    while IFS= read -r skill_json; do
      name="$(jq -r '.name' <<<"$skill_json")"
      path="$(jq -r '.path' <<<"$skill_json")"
      count=0
      for f in "${changed_files[@]}"; do
        case "$f" in "$path"/*|"$path") count=$((count + 1)) ;; esac
      done
      [ "$count" -gt 0 ] && echo "| $name | $count |"
    done < <(jq -c --arg s "$src" '.sources[$s].skills[]' "$CATALOG")
    echo
    echo "### Delta conflicts"
  } >> "$REPORT"

  hits=0
  while IFS= read -r anchors_file; do
    [ "$(jq -r '.source' "$anchors_file")" = "$src" ] || continue
    delta_skill="$(basename "$(dirname "$anchors_file")")"
    while IFS= read -r ov; do
      prefixes=()
      while IFS= read -r p; do prefixes+=("$p"); done < <(jq -r '.paths[]' <<<"$ov")
      rule="$(jq -r '.upstream_rule' <<<"$ov")"
      gforce="$(jq -r '.gforce_rule' <<<"$ov")"

      touched=()
      for f in "${changed_files[@]}"; do
        for p in "${prefixes[@]}"; do
          case "$f" in "$p"/*|"$p") touched+=("$f"); break ;; esac
        done
      done
      [ "${#touched[@]}" -eq 0 ]  && continue

      files="${touched[*]:0:6}"
      extra=$(( ${#touched[@]} > 6 ? ${#touched[@]} - 6 : 0 ))
      [ "$extra" -gt 0 ] && files="$files (+$extra more)"

      # grep -c, not -q: -q exits at first match, git diff dies of SIGPIPE, and
      # under pipefail the pipeline reads as failed — flipping a real CONFLICT
      # into "Touched". -c consumes the whole stream; || true guards its exit 1
      # on zero matches.
      rule_hits="$(git -C "$dir" diff -U0 "$pinned..$head" -- "${prefixes[@]}" | { grep -cF "$rule" || true; })"
      if [ "$rule_hits" -gt 0 ]; then
        echo "- [ ] **CONFLICT** — diff touches \`$rule\` ($rule_hits hunk line(s)), which \`$delta_skill\` overrides (*$gforce*). Confirm the delta still stands or update it in this PR. Files: $files" >> "$REPORT"
      else
        echo "- [ ] Touched — an area \`$delta_skill\` overrides changed, but \`$rule\` is not in the diff; skim for a rephrase. Files: $files" >> "$REPORT"
      fi
      hits=$((hits + 1))
    done < <(jq -c '.overrides[]' "$anchors_file")
  done < <(find "$ROOT/skills" -mindepth 2 -maxdepth 2 -name overrides.json)

  if [ "$hits" -eq 0 ]; then
    echo "- No delta anchors hit — the compare link still needs a full read before merging." >> "$REPORT"
  fi
  echo >> "$REPORT"

  jq --arg s "$src" --arg head "$head" --arg d "$today" \
    '.sources[$s].ratified_commit = $head | .sources[$s].ratified_on = $d' \
    "$CATALOG" > "$CATALOG.tmp" && mv "$CATALOG.tmp" "$CATALOG"
done < <(jq -r '.sources | keys[]' "$CATALOG")

if [ "$changed" = true ]; then
  {
    echo "---"
    echo "## Ratification checklist (merge = ratified)"
    echo "- [ ] Compare link reviewed end-to-end — this PR is the fleet's prompt-injection boundary"
    echo "- [ ] Every **CONFLICT** above resolved: delta confirmed, or updated in this PR"
    echo "- [ ] No GForce skill now restates an upstream rule (deltas only — standards/upstream-policy.md)"
    echo "- [ ] Evals ran (\`cd evals && npm test\`) — note: dispatch unwired, fixtures report *skipped*, do not read green as a score"
    echo
    echo "**Never auto-merge this PR.**"
  } >> "$REPORT"
fi

echo "changed=$changed" >> "${GITHUB_OUTPUT:-/dev/null}"
echo "Ratification poll complete: changed=$changed (report: $REPORT)"
