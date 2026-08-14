#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
. tests/lib.sh
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Well-formed fixture (current schema shape) passes.
mkdir -p "$TMP/good/upstream" "$TMP/good/skills/x"
cat > "$TMP/good/upstream/catalog.json" <<'EOF'
{
  "sources": {
    "acme/demo-skills": {
      "ref": "main",
      "ratified_commit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "ratified_on": "2026-08-14",
      "skills": [{ "name": "demo", "path": "skills/demo", "marker": "manual" }]
    }
  }
}
EOF
cat > "$TMP/good/skills/x/overrides.json" <<'EOF'
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
assert_ok "well-formed catalog + overrides pass" node scripts/validate-schemas.mjs "$TMP/good"

# Old-format overrides (singular upstream_rule) are rejected.
mkdir -p "$TMP/old/upstream" "$TMP/old/skills/x"
cp "$TMP/good/upstream/catalog.json" "$TMP/old/upstream/catalog.json"
cat > "$TMP/old/skills/x/overrides.json" <<'EOF'
{
  "source": "acme/demo-skills",
  "overrides": [
    { "paths": ["skills/demo"], "upstream_rule": "FOO", "gforce_rule": "BAR", "delta": "d" }
  ]
}
EOF
assert_fail "old-format overrides rejected" node scripts/validate-schemas.mjs "$TMP/old"

# Catalog with a short commit hash is rejected.
mkdir -p "$TMP/badcat/upstream"
cat > "$TMP/badcat/upstream/catalog.json" <<'EOF'
{
  "sources": {
    "acme/demo-skills": {
      "ref": "main",
      "ratified_commit": "abc123",
      "ratified_on": "2026-08-14",
      "skills": [{ "name": "demo", "path": "skills/demo", "marker": "manual" }]
    }
  }
}
EOF
assert_fail "short ratified_commit rejected" node scripts/validate-schemas.mjs "$TMP/badcat"

# The real repo files validate (overrides migrated to tripwires[] in task 2).
assert_ok "repo catalog + overrides pass schemas" node scripts/validate-schemas.mjs .

finish
