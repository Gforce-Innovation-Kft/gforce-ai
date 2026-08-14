#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
. tests/lib.sh
REPO_ROOT="$(pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

GIT="git -c user.email=t@test -c user.name=t"
R="$TMP/repo"
mkdir -p "$R/skills/gforce-x" "$R/agents" "$R/standards/evals"
git -C "$R" init -q -b main .

agent_file() { # agent_file <version> <extra-line>
  printf -- '---\nname: gforce-a\ndescription: >\n  Reviews things.\n  TRIGGER when: reviewing.\n  DO NOT TRIGGER when: not reviewing.\ntools: Read\nmodel: sonnet\nversion: %s\n---\n\n# A\n%s\n' "$1" "${2:-}"
}

printf -- '---\nname: gforce-x\ndescription: Demo.\nversion: 1.0.0\n---\n\n# X\nrule one\n' > "$R/skills/gforce-x/SKILL.md"
agent_file "1.0.0" > "$R/agents/gforce-a.md"
$GIT -C "$R" add -A && $GIT -C "$R" commit -qm base
BASE="$(git -C "$R" rev-parse HEAD)"

VB="bash $REPO_ROOT/scripts/check-version-bump.sh"
SC="bash $REPO_ROOT/scripts/check-scorecard.sh"

# Skill content changed, version unchanged → FAIL.
printf -- '---\nname: gforce-x\ndescription: Demo.\nversion: 1.0.0\n---\n\n# X\nrule one\nrule two\n' > "$R/skills/gforce-x/SKILL.md"
$GIT -C "$R" commit -qam "change without bump"
assert_fail "skill change without bump fails" $VB "$BASE" "$R"

# Version bumped → PASS.
printf -- '---\nname: gforce-x\ndescription: Demo.\nversion: 1.1.0\n---\n\n# X\nrule one\nrule two\n' > "$R/skills/gforce-x/SKILL.md"
$GIT -C "$R" commit -qam "bump"
assert_ok "bumped skill passes" $VB "$BASE" "$R"

# Brand-new unit → exempt.
mkdir -p "$R/skills/gforce-new"
printf -- '---\nname: gforce-new\ndescription: New.\nversion: 1.0.0\n---\n' > "$R/skills/gforce-new/SKILL.md"
$GIT -C "$R" add -A && $GIT -C "$R" commit -qm "new skill"
assert_ok "new unit exempt" $VB "$BASE" "$R"

# Bad base ref must fail loudly, not pass silently.
assert_fail "unresolvable base fails" $VB "no-such-ref" "$R"

# --- scorecards ---
# Agent changed (with bump), no scorecard → strict FAIL, advisory PASS.
agent_file "1.1.0" "extra rule" > "$R/agents/gforce-a.md"
$GIT -C "$R" commit -qam "agent change"
assert_fail "agent change without scorecard fails" $SC "$BASE" "$R"
assert_ok "advisory mode only warns" $SC --advisory "$BASE" "$R"

# Matching scorecard → PASS; stale hash → FAIL.
if command -v sha256sum >/dev/null 2>&1; then H="$(sha256sum "$R/agents/gforce-a.md" | cut -d' ' -f1)"; else H="$(shasum -a 256 "$R/agents/gforce-a.md" | cut -d' ' -f1)"; fi
printf '{ "agent": "gforce-a", "content_sha256": "%s", "recall": {"hits": 1, "total": 1}, "false_positives": 0, "clean_total": 1, "run_at": "2026-08-14", "cost_cents": 1 }\n' "$H" > "$R/standards/evals/gforce-a.scorecard.json"
assert_ok "current scorecard passes" $SC "$BASE" "$R"
printf '{ "agent": "gforce-a", "content_sha256": "stale" }\n' > "$R/standards/evals/gforce-a.scorecard.json"
assert_fail "stale scorecard hash fails" $SC "$BASE" "$R"

finish
