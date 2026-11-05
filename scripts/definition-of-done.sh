#!/usr/bin/env bash
# One reviewable evidence bundle; keep running to report every failing check.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "${1:-}" in
  '') ;;
  --help|-h)
    echo 'Usage: pnpm dod'
    echo 'Runs all checks; PostgreSQL is required for migration verification and API e2e.'
    exit 0 ;;
  *) echo "Unknown argument: $1" >&2; exit 2 ;;
esac
if [ "$#" -gt 1 ]; then echo 'Expected no arguments.' >&2; exit 2; fi

# Store each run separately so parallel invocations and past evidence survive.
mkdir -p "$REPO_ROOT/.verify-app/dod" || exit 1
LOG_DIR="$(mktemp -d "$REPO_ROOT/.verify-app/dod/run.XXXXXX")" || exit 1
cd "$REPO_ROOT" || exit 1
FAILED=()
EVIDENCE=()
SUMMARY="$LOG_DIR/evidence.log"

run_step() {
  local name="$1" status
  shift
  printf '%-20s ' "$name"
  (cd "$REPO_ROOT" && "$@") >"$LOG_DIR/$name.log" 2>&1
  status=$?
  if [ "$status" -eq 0 ]; then
    echo 'PASS'
    EVIDENCE+=("$name PASS")
    echo "PASS $name: $LOG_DIR/$name.log" >>"$SUMMARY"
  else
    echo "FAIL ($status) — $LOG_DIR/$name.log"
    FAILED+=("$name")
    EVIDENCE+=("$name FAIL")
    echo "FAIL $name (exit $status): $LOG_DIR/$name.log" >>"$SUMMARY"
  fi
  return 0
}

run_step check-types pnpm check-types
run_step lint pnpm lint
run_step format pnpm format:check
run_step unit pnpm test
run_step dependencies pnpm dependencies:check
run_step web-tsc-force pnpm --filter web exec tsc -b --force
run_step migration-diff pnpm --filter api db:migrations:check
run_step api-e2e pnpm --filter api test:e2e
run_step web-e2e pnpm --filter web test:e2e

echo
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "definition-of-done: FAILED — ${FAILED[*]}" | tee -a "$SUMMARY"
else
  echo 'definition-of-done: PASS' | tee -a "$SUMMARY"
fi
printf 'evidence: %s\n' "$(IFS=';'; echo "${EVIDENCE[*]}")" | tee -a "$SUMMARY"
echo "Evidence: $SUMMARY"
[ "${#FAILED[@]}" -eq 0 ]
