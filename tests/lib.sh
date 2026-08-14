# Minimal assert helpers — bash 3.2 compatible, sourced by every test.
FAILURES=0

assert_ok() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "ok: $desc"
  else
    echo "FAIL: $desc (expected success)"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_fail() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "FAIL: $desc (expected failure)"
    FAILURES=$((FAILURES + 1))
  else
    echo "ok: $desc"
  fi
}

assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  case "$haystack" in
    *"$needle"*) echo "ok: $desc" ;;
    *)
      echo "FAIL: $desc (missing: $needle)"
      FAILURES=$((FAILURES + 1))
      ;;
  esac
}

finish() {
  if [ "$FAILURES" -gt 0 ]; then
    echo "$FAILURES failure(s)"
    exit 1
  fi
  echo "all passed"
}
