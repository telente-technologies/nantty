#!/usr/bin/env bash
set -euo pipefail

base=${1:?base url required}
failures=0

expect_status() {
  local description=$1 expected=$2 method=$3 path=$4
  shift 4
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X "$method" "$@" "${base}${path}" || echo 000)
  if [ "$status" = "$expected" ]; then
    echo "ok   $description ($status)"
  else
    echo "FAIL $description: expected $expected, got $status"
    failures=$((failures + 1))
  fi
}

for attempt in 1 2 3 4 5 6; do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${base}/healthz" || echo 000)" = 200 ]; then break; fi
  sleep 10
done

expect_status "gateway health" 200 GET /healthz
expect_status "unknown route is a gateway 404" 404 GET /api/v1/does-not-exist
expect_status "internal routes are never exposed" 404 GET /api/v1/auth/internal/token
expect_status "private route needs a token" 401 GET /api/v1/wallets/me
expect_status "public JWKS route reaches identity" 200 GET /api/v1/policies/current -H "accept: application/json"
expect_status "webhook route reaches go-money and rejects a bad signature" 401 POST /webhooks/flutterwave -H "content-type: application/json" -H "verif-hash: invalid" --data '{"event":"smoke"}'
expect_status "disallowed origin is refused" 403 GET /healthz -H "origin: https://evil.example"

if [ "$failures" -gt 0 ]; then
  echo "::error::$failures smoke checks failed"
  exit 1
fi
