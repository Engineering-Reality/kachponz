#!/usr/bin/env bash
# Manual smoke test — cek status HTTP tanpa kredensial untuk endpoint publik &
# yang wajib diproteksi auth. Bukan pengganti Vitest (npm run test); ini untuk
# sanity-check cepat sebelum deploy terhadap server yang sedang berjalan.
#
# Usage:
#   npm run dev:server              # terminal 1
#   ./scripts/curl-smoke-test.sh    # terminal 2
#   BASE_URL=http://127.0.0.1:8081 ./scripts/curl-smoke-test.sh

set -uo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8081}"
NIL_UUID="00000000-0000-0000-0000-000000000000"

PASS=0
FAIL=0

# check <method> <path> <expected_status[,expected_status2]> [json_body]
check() {
  local method="$1" path="$2" expected="$3" body="${4:-}"
  local status

  if [[ -n "$body" ]]; then
    status=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" \
      -H 'Content-Type: application/json' -d "$body" "${BASE_URL}${path}")
  else
    status=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "${BASE_URL}${path}")
  fi

  IFS=',' read -ra want <<< "$expected"
  local ok=0
  for w in "${want[@]}"; do
    [[ "$status" == "$w" ]] && ok=1
  done

  if [[ "$ok" == 1 ]]; then
    printf 'PASS  %-7s %-45s got %-3s (expected %s)\n' "$method" "$path" "$status" "$expected"
    PASS=$((PASS + 1))
  else
    printf 'FAIL  %-7s %-45s got %-3s (expected %s)\n' "$method" "$path" "$status" "$expected"
    FAIL=$((FAIL + 1))
  fi
}

echo "Target: ${BASE_URL}"
echo

echo "== Public (tanpa kredensial) =="
check GET  "/health" "200,503"
check GET  "/.well-known/amadeus-agent-card.json" "200"

echo
echo "== /agents — wajib 401 tanpa kredensial =="
check GET    "/agents" "401"
check GET    "/agents/${NIL_UUID}" "401"
check POST   "/agents" "401" '{"agent_name":"smoke-test"}'
check PUT    "/agents/${NIL_UUID}" "401" '{"agent_name":"smoke-test"}'
check DELETE "/agents/${NIL_UUID}" "401"

echo
echo "== /tools — wajib 401 tanpa kredensial =="
check GET    "/tools" "401"
check GET    "/tools/${NIL_UUID}" "401"
check POST   "/tools" "401" '{"name":"smoke-test"}'
check PUT    "/tools/${NIL_UUID}" "401" '{"name":"smoke-test"}'
check DELETE "/tools/${NIL_UUID}" "401"

echo
echo "== /transactions — 401 bila ENABLE_TRANSACTION_ROUTES=true, 404 (route tidak"
echo "   terdaftar) bila false. Dua-duanya sah — bukan bug, itu flag deploy. =="
check GET  "/transactions" "401,404"
check POST "/transactions" "401,404" '{"type":"import_lc","idempotencyKey":"smoke-test-00000001"}'

echo
echo "== /orchestrator/* — wajib 401 tanpa kredensial =="
check GET  "/orchestrator/agents" "401"
check GET  "/orchestrator/executors" "401"
check POST "/orchestrator/run-agentic" "401" '{"idempotencyKey":"smoke-test-00000002"}'

echo
echo "-----------------------------------------------"
echo "PASS: ${PASS}  FAIL: ${FAIL}"
[[ "$FAIL" -eq 0 ]]
