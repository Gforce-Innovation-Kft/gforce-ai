#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
. tests/lib.sh
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

V="bash scripts/validate-naming.sh"

good_agent() { # good_agent <dir> <name> [extra-body-lines]
  mkdir -p "$1/agents"
  {
    printf -- '---\nname: %s\ndescription: >\n  Does things.\n  TRIGGER when: reviewing X.\n  DO NOT TRIGGER when: anything else.\ntools: Read, Grep\nmodel: sonnet\nversion: 1.0.0\n---\n\n# Agent\n\nbody\n' "$2"
    # awk, not `yes | head`: head's early exit SIGPIPEs yes under pipefail.
    if [ "${3:-0}" -gt 0 ]; then awk -v n="${3}" 'BEGIN { for (i = 0; i < n; i++) print "filler line" }'; fi
  } > "$1/agents/$2.md"
}

# Strict-clean fixture: namespaced agent + namespaced skill.
good_agent "$TMP/good" "gforce-demo-reviewer"
mkdir -p "$TMP/good/skills/gforce-demo"
printf -- '---\nname: gforce-demo\ndescription: Demo skill.\nversion: 1.0.0\n---\n\n# Demo\n' \
  > "$TMP/good/skills/gforce-demo/SKILL.md"
assert_ok "clean fixture passes --strict" $V --strict "$TMP/good"

# Un-namespaced name: warning without --strict, error with it.
good_agent "$TMP/ns" "demo-reviewer"
assert_ok "missing prefix is only a warning by default" $V "$TMP/ns"
assert_fail "missing prefix fails under --strict" $V --strict "$TMP/ns"

# name != filename stem.
good_agent "$TMP/stem" "gforce-demo-reviewer"
mv "$TMP/stem/agents/gforce-demo-reviewer.md" "$TMP/stem/agents/other-file.md"
assert_fail "name/filename mismatch fails" $V "$TMP/stem"

# tools: * is banned.
good_agent "$TMP/tools" "gforce-demo-reviewer"
sed -i '' 's/^tools: .*/tools: "*"/' "$TMP/tools/agents/gforce-demo-reviewer.md" 2>/dev/null \
  || sed -i 's/^tools: .*/tools: "*"/' "$TMP/tools/agents/gforce-demo-reviewer.md"
assert_fail "tools: * fails" $V "$TMP/tools"

# Missing TRIGGER contract.
good_agent "$TMP/trig" "gforce-demo-reviewer"
sed -i '' 's/TRIGGER when: reviewing X./nothing here./' "$TMP/trig/agents/gforce-demo-reviewer.md" 2>/dev/null \
  || sed -i 's/TRIGGER when: reviewing X./nothing here./' "$TMP/trig/agents/gforce-demo-reviewer.md"
assert_fail "missing TRIGGER contract fails" $V "$TMP/trig"

# Body over 200 lines.
good_agent "$TMP/long" "gforce-demo-reviewer" 205
assert_fail "201+ line body fails" $V "$TMP/long"

# Bad semver.
good_agent "$TMP/ver" "gforce-demo-reviewer"
sed -i '' 's/^version: .*/version: v1/' "$TMP/ver/agents/gforce-demo-reviewer.md" 2>/dev/null \
  || sed -i 's/^version: .*/version: v1/' "$TMP/ver/agents/gforce-demo-reviewer.md"
assert_fail "non-semver version fails" $V "$TMP/ver"

# The real repo passes in default (pre-rename) mode.
assert_ok "repo passes non-strict" $V .

finish
