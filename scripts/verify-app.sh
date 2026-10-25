#!/usr/bin/env bash
# Boots the full dev stack (Postgres, API, web) the way a developer runs it and
# checks it answers. Unit and e2e suites load the app differently from the real
# server, so a passing test run does not prove the app starts.
#
#   scripts/verify-app.sh          start the stack, wait for it, run API checks
#   scripts/verify-app.sh stop     stop the API and web started by this script
#                                  (Postgres keeps running; pnpm db:stop stops it)
#
# The stack keeps running after a successful start so the browser check in the
# verify-app skill can use it. Logs: .verify-app/dev.log
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$REPO_ROOT/.verify-app"
LOG="$STATE_DIR/dev.log"
PID_FILE="$STATE_DIR/dev.pid"
TIMEOUT_SECONDS="${VERIFY_APP_TIMEOUT:-120}"

read_env() {
  local file="$1" key="$2" default="$3" value=""
  if [ -f "$file" ]; then
    value="$(sed -n "s/^${key}=//p" "$file" | tail -n 1)"
  fi
  echo "${value:-$default}"
}

API_PORT="$(read_env "$REPO_ROOT/apps/api/.env" PORT 3000)"
WEB_PORT="$(read_env "$REPO_ROOT/apps/web/.env" WEB_PORT 5173)"
API_URL="http://localhost:$API_PORT"
WEB_URL="http://localhost:$WEB_PORT"

command -v lsof > /dev/null || { echo "verify-app: lsof is required" >&2; exit 1; }

listeners() {
  lsof -nP -iTCP:"$API_PORT" -iTCP:"$WEB_PORT" -sTCP:LISTEN -t 2>/dev/null || true
}

stop_stack() {
  # Only touch processes this script started: another project may be serving
  # on the same ports.
  [ -f "$PID_FILE" ] || return 0
  kill -- "-$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
  # `nest start --watch` can leave its child holding the port.
  local pids
  pids="$(listeners)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
  fi
}

# pino and nest colorize their output, which hides words from grep patterns.
strip_colors() {
  sed $'s/\x1b\\[[0-9;]*m//g'
}

fail() {
  echo "verify-app: FAIL — $1" >&2
  if [ -f "$LOG" ]; then
    echo "--- last errors in $LOG ---" >&2
    strip_colors < "$LOG" | grep -E "ERROR|Error|exited with code" | grep -v "Found 0 errors" | tail -n 20 >&2 || true
  fi
  stop_stack
  exit 1
}

if [ "${1:-}" = "stop" ]; then
  stop_stack
  echo "verify-app: stopped"
  exit 0
fi

if [ -n "$(listeners)" ]; then
  echo "verify-app: FAIL — ports $API_PORT/$WEB_PORT are already in use; a server that is not this checkout's would answer. Stop it first (scripts/verify-app.sh stop, if this script started it)." >&2
  exit 1
fi

mkdir -p "$STATE_DIR"
: > "$LOG"
cd "$REPO_ROOT"

echo "verify-app: starting database and applying migrations"
pnpm db:start >> "$LOG" 2>&1 || fail "database did not start"
SNAPSHOT_BEFORE="$(git status --porcelain -- apps/api/src/database/migrations 2>/dev/null || true)"
for attempt in $(seq 1 15); do
  pnpm db:migrate:up >> "$LOG" 2>&1 && break
  [ "$attempt" = 15 ] && fail "migrations did not apply"
  sleep 2
done
if [ "$(git status --porcelain -- apps/api/src/database/migrations 2>/dev/null || true)" != "$SNAPSHOT_BEFORE" ]; then
  echo "verify-app: WARNING — migrating rewrote files under migrations/; the local database does not match this branch's schema. Review before committing." >&2
fi

echo "verify-app: starting API ($API_URL) and web ($WEB_URL)"
set -m
pnpm exec turbo run dev --ui=stream >> "$LOG" 2>&1 &
echo $! > "$PID_FILE"
set +m

for _ in $(seq 1 "$TIMEOUT_SECONDS"); do
  if grep -q "exited with code" "$LOG"; then
    fail "a dev server crashed during boot"
  fi
  if curl -sf -m 5 "$API_URL/health/live" > /dev/null && curl -sf -m 5 "$WEB_URL" > /dev/null; then
    break
  fi
  sleep 1
done
curl -sf -m 5 "$API_URL/health/live" > /dev/null || fail "API did not answer $API_URL/health/live within ${TIMEOUT_SECONDS}s"
curl -sf -m 5 "$WEB_URL" > /dev/null || fail "web did not answer $WEB_URL within ${TIMEOUT_SECONDS}s"

curl -sf -m 5 "$API_URL/health/ready" > /dev/null || fail "$API_URL/health/ready is not healthy (database)"
curl -sf -m 5 "$API_URL/openapi.yaml" > /dev/null || fail "$API_URL/openapi.yaml is not served"

BOOT_ERRORS="$(strip_colors < "$LOG" | grep -E "\bERROR\b" | grep -v "Found 0 errors" || true)"
if [ -n "$BOOT_ERRORS" ]; then
  echo "$BOOT_ERRORS" >&2
  fail "errors were logged during boot"
fi

echo "verify-app: OK — API $API_URL, web $WEB_URL (stack left running; stop with: scripts/verify-app.sh stop)"
