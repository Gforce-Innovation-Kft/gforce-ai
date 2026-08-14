#!/usr/bin/env bash
# A changed skill or agent must bump its frontmatter version. Static, zero
# tokens; bash 3.2 compatible.
#
# Usage: check-version-bump.sh <base-ref> [rootDir]
#   Compares base-ref...HEAD. New units (absent at base) and deletions are
#   exempt.
set -euo pipefail
base="${1:?usage: check-version-bump.sh <base-ref> [rootDir]}"
root="${2:-.}"

# A bad base must fail loudly — resolving to zero changed files would read as
# a pass nobody earned.
git -C "$root" rev-parse --verify --quiet "$base^{commit}" > /dev/null

fm_version() { awk '/^---$/{n++; next} n==1 && /^version: /{sub(/^version: */, ""); print; exit} n>=2{exit}'; }

offenders=0
units=""
while IFS= read -r f; do
  unit=""
  case "$f" in
    agents/*.md) unit="$f" ;;
    skills/*/*) unit="skills/$(printf '%s' "$f" | cut -d/ -f2)/SKILL.md" ;;
  esac
  [ -n "$unit" ] || continue
  case " $units " in *" $unit "*) continue ;; esac
  units="$units $unit"

  [ -f "$root/$unit" ] || continue                                     # deleted unit
  git -C "$root" cat-file -e "$base:$unit" 2>/dev/null || continue     # new unit
  old="$(git -C "$root" show "$base:$unit" | fm_version)"
  new="$(fm_version < "$root/$unit")"
  if [ "$old" = "$new" ]; then
    echo "ERROR: $unit changed but version stayed '${new:-<missing>}' — bump it"
    offenders=$((offenders + 1))
  fi
done < <(git -C "$root" diff --name-only "$base...HEAD")

echo "version-bump: $offenders offender(s)"
[ "$offenders" -eq 0 ] || exit 1
