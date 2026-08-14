#!/usr/bin/env bash
# Static naming + structure validator for agents/*.md and skills/*/SKILL.md.
# Zero tokens, zero network; bash 3.2 compatible.
#
# Usage: validate-naming.sh [--strict] [rootDir]
#   Namespace (gforce- prefix) violations are warnings without --strict,
#   errors with it. Everything else is always an error.
set -euo pipefail

strict=false
root="."
for arg in "$@"; do
  case "$arg" in
    --strict) strict=true ;;
    *) root="$arg" ;;
  esac
done

errors=0
warnings=0
err() { echo "ERROR: $1"; errors=$((errors + 1)); }
warn() { echo "WARN: $1"; warnings=$((warnings + 1)); }
ns_violation() { if [ "$strict" = true ]; then err "$1"; else warn "$1"; fi; }

NS='^gforce-[a-z0-9-]+$'
SEMVER='^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$'

# Frontmatter = lines between the first two "---" markers; captured once per
# file into a variable so no early-exiting grep ever SIGPIPEs a producer.
frontmatter() { awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$1"; }
body_line_count() { awk '/^---$/{n++; next} n>=2{c++} END{print c+0}' "$1"; }
fm_value() { printf '%s\n' "$1" | awk -F': ' -v k="$2" '$1==k {sub(/^[^:]*: */, ""); print; exit}'; }

check_agent() {
  local f="$1" base name fm tools model version
  base="$(basename "$f" .md)"
  fm="$(frontmatter "$f")"
  name="$(fm_value "$fm" name)"
  tools="$(fm_value "$fm" tools)"
  model="$(fm_value "$fm" model)"
  version="$(fm_value "$fm" version)"

  [ -n "$name" ] || { err "$f: missing frontmatter 'name'"; return; }
  [ "$name" = "$base" ] || err "$f: name '$name' must equal filename stem '$base'"
  printf '%s' "$name" | grep -Eq "$NS" || ns_violation "$f: name '$name' lacks the gforce- namespace"
  [ -n "$tools" ] || err "$f: missing explicit 'tools' list"
  case "$tools" in *'*'*) err "$f: tools must be an explicit list, never '*'" ;; esac
  [ -n "$model" ] || err "$f: missing 'model'"
  printf '%s' "$version" | grep -Eq "$SEMVER" || err "$f: 'version' must be semver (got '${version:-<missing>}')"
  # "DO NOT TRIGGER when:" contains "TRIGGER when:" as a substring, so the
  # positive-trigger check must look at the frontmatter with DO-NOT lines
  # removed (captured, not piped — grep -q would SIGPIPE the producer).
  fm_positive="$(printf '%s\n' "$fm" | { grep -v 'DO NOT TRIGGER' || true; })"
  printf '%s\n' "$fm_positive" | grep -q "TRIGGER when:" || err "$f: description must contain 'TRIGGER when:'"
  printf '%s\n' "$fm" | grep -q "DO NOT TRIGGER when:" || err "$f: description must contain 'DO NOT TRIGGER when:'"
  [ "$(body_line_count "$f")" -le 200 ] || err "$f: body exceeds 200 lines (agent-standard budget)"
}

check_skill() {
  local d="$1" f dirname name fm version
  f="$d/SKILL.md"
  dirname="$(basename "$d")"
  [ -f "$f" ] || { err "$d: missing SKILL.md"; return; }
  fm="$(frontmatter "$f")"
  name="$(fm_value "$fm" name)"
  version="$(fm_value "$fm" version)"

  [ -n "$name" ] || { err "$f: missing frontmatter 'name'"; return; }
  [ "$name" = "$dirname" ] || err "$f: name '$name' must equal directory name '$dirname'"
  printf '%s' "$name" | grep -Eq "$NS" || ns_violation "$f: name '$name' lacks the gforce- namespace"
  printf '%s' "$version" | grep -Eq "$SEMVER" || err "$f: 'version' must be semver (got '${version:-<missing>}')"
  printf '%s\n' "$fm" | grep -q "^description:" || err "$f: missing 'description'"
}

for f in "$root"/agents/*.md; do
  [ -e "$f" ] || continue
  check_agent "$f"
done

for d in "$root"/skills/*/; do
  [ -d "$d" ] || continue
  check_skill "${d%/}"
done

echo "naming: $errors error(s), $warnings warning(s)"
[ "$errors" -eq 0 ] || exit 1
