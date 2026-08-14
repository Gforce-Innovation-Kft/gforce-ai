#!/usr/bin/env bash
# Runs every tests/test-*.sh. No network, no LLM calls — safe in CI on every PR.
set -euo pipefail
cd "$(dirname "$0")"
rc=0
for t in test-*.sh; do
  echo "== $t"
  bash "$t" || rc=1
done
exit $rc
