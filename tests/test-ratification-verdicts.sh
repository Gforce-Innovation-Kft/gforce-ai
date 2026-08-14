#!/usr/bin/env bash
# Exercises all three ratification verdicts (UNCHANGED / TOUCHED / CONFLICT)
# against a synthetic upstream served over file:// — no network, no GitHub.
set -euo pipefail
cd "$(dirname "$0")/.."
. tests/lib.sh
REPO_ROOT="$(pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

GIT="git -c user.email=t@test -c user.name=t"

# --- synthetic upstream: acme/demo-skills, served from a bare file:// remote ---
UP="$TMP/src"
mkdir -p "$UP/skills/demo"
cat > "$UP/skills/demo/SKILL.md" <<'EOF'
# Demo skill
Always query records WITH SECURITY_ENFORCED to stay safe.
Other guidance line.
EOF
git -C "$UP" init -q -b main .
$GIT -C "$UP" add -A
$GIT -C "$UP" commit -qm "pin"
PIN_A="$(git -C "$UP" rev-parse HEAD)"
mkdir -p "$TMP/remotes/acme"
git clone -q --bare "$UP" "$TMP/remotes/acme/demo-skills.git"

# --- fixture gforce-ai root (must be a git repo: the script resolves ROOT) ---
FIX="$TMP/fixture"
mkdir -p "$FIX/upstream" "$FIX/skills/deltas"
git -C "$FIX" init -q -b main .
cat > "$FIX/skills/deltas/overrides.json" <<'EOF'
{
  "source": "acme/demo-skills",
  "overrides": [
    {
      "upstream_paths": ["skills/demo"],
      "tripwires": ["WITH SECURITY_ENFORCED", "SECURITY_ENFORCED"],
      "gforce_rule": "WITH USER_MODE",
      "reason": "USER_MODE supersedes SECURITY_ENFORCED"
    }
  ]
}
EOF

write_catalog() {
  cat > "$FIX/upstream/catalog.json" <<EOF
{
  "sources": {
    "acme/demo-skills": {
      "ref": "main",
      "ratified_commit": "$PIN_A",
      "ratified_on": "2026-08-14",
      "skills": [{ "name": "demo", "path": "skills/demo", "marker": "manual" }]
    }
  }
}
EOF
}

run_script() {
  rm -f "$TMP/report.md" "$TMP/out"
  (cd "$FIX" && SOURCE_BASE_URL="file://$TMP/remotes/" \
    REPORT_PATH="$TMP/report.md" GITHUB_OUTPUT="$TMP/out" \
    bash "$REPO_ROOT/.github/scripts/upstream-ratification.sh" >/dev/null)
}

# --- UNCHANGED: HEAD == pin ---
write_catalog
run_script
assert_contains "unchanged: changed=false" "$(cat "$TMP/out")" "changed=false"
assert_ok "unchanged: report has no verdicts" test ! -s "$TMP/report.md"

# --- TOUCHED: anchored path edited, no tripwire in the diff ---
sed -i '' 's/Other guidance line./Other guidance line, edited./' "$UP/skills/demo/SKILL.md" 2>/dev/null \
  || sed -i 's/Other guidance line./Other guidance line, edited./' "$UP/skills/demo/SKILL.md"
$GIT -C "$UP" commit -qam "touch unrelated line"
$GIT -C "$UP" push -q "file://$TMP/remotes/acme/demo-skills.git" main:main
write_catalog
run_script
report="$(cat "$TMP/report.md")"
assert_contains "touched: changed=true" "$(cat "$TMP/out")" "changed=true"
assert_contains "touched: Touched verdict" "$report" "Touched —"
# The checklist footer always mentions CONFLICT; only verdict lines use "**CONFLICT** —".
assert_fail "touched: no CONFLICT verdict" grep -qF '**CONFLICT** —' "$TMP/report.md"

# --- CONFLICT via secondary variant: new line hits SECURITY_ENFORCED only ---
echo "Remember the SECURITY_ENFORCED keyword." >> "$UP/skills/demo/SKILL.md"
$GIT -C "$UP" commit -qam "mention keyword without WITH"
$GIT -C "$UP" push -q "file://$TMP/remotes/acme/demo-skills.git" main:main
write_catalog
run_script
report="$(cat "$TMP/report.md")"
assert_contains "conflict: CONFLICT verdict" "$report" "**CONFLICT**"
assert_contains "conflict: secondary variant fired" "$report" '`SECURITY_ENFORCED` (1)'
assert_fail "conflict: primary variant did not fire" grep -qF '`WITH SECURITY_ENFORCED` (' "$TMP/report.md"

# --- CONFLICT via primary: the tripwire line itself is reworded ---
( cd "$UP" && sed -i '' 's/WITH SECURITY_ENFORCED/WITH USER_MODE/' skills/demo/SKILL.md 2>/dev/null \
  || sed -i 's/WITH SECURITY_ENFORCED/WITH USER_MODE/' skills/demo/SKILL.md )
$GIT -C "$UP" commit -qam "upstream adopts USER_MODE"
$GIT -C "$UP" push -q "file://$TMP/remotes/acme/demo-skills.git" main:main
write_catalog
run_script
assert_contains "conflict: primary fires on removal" "$(cat "$TMP/report.md")" '`WITH SECURITY_ENFORCED` ('

finish
