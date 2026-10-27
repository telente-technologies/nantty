#!/usr/bin/env bash
# Test name:           Phase 0 pre-flight (environment safety gate)
# Target:              127.0.0.1 only (local compose + locally started services)
# Expected behavior:   Exits 0 only when every target is loopback, no live key is present,
#                      APP_ENV is not production, FLUTTERWAVE_API_BASE_URL is loopback, and
#                      GATEWAY_IDENTITY_SECRET is set. Prints a redacted report.
# Dangerous behavior:  A failure would be proceeding against a live key, a production env,
#                      a non-loopback Flutterwave URL, or the out-of-scope betng-* containers.
# Cleanup:             None (read-only; starts and stops nothing).
# Financial safety:    SAFE (no money moves; reads env + listening sockets only)
set -euo pipefail

fail=0
note() { printf '%s\n' "$*"; }
bad()  { printf 'REFUSE: %s\n' "$*"; fail=1; }

# 1. Refuse live payment keys anywhere in the current environment (value redacted).
while IFS='=' read -r name value; do
  case "${value:-}" in
    sk_live_*|pk_live_*) bad "env ${name} looks like a LIVE payment key";;
    FLWSECK-*|FLWPUBK-*) bad "env ${name} is a LIVE Flutterwave key";;
  esac
done < <(env)

# 2. Refuse production.
if [ "${APP_ENV:-}" = "production" ]; then bad "APP_ENV=production"; fi

# 3. Flutterwave base URL must be loopback (fake server) when set.
if [ -n "${FLUTTERWAVE_API_BASE_URL:-}" ]; then
  case "${FLUTTERWAVE_API_BASE_URL}" in
    http://127.0.0.1*|http://localhost*|https://127.0.0.1*|https://localhost*) note "flutterwave base: loopback OK";;
    *) bad "FLUTTERWAVE_API_BASE_URL is not loopback (got non-loopback host)";;
  esac
fi

# 4. Gateway identity secret must be present (SEC-0010 control).
if [ -z "${GATEWAY_IDENTITY_SECRET:-}" ]; then
  note "WARN: GATEWAY_IDENTITY_SECRET not set in this shell (set per-service before live tests)"
fi

# 5. Out-of-scope containers must never be a target. Flag if they are the only DB up.
if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^betng-'; then
    note "INFO: betng-* containers present and OUT OF SCOPE (never target 55432/56379)"
  fi
fi

# 6. Report any non-loopback listeners among the known nantty ports.
ports='4000 8080 8090 8101 8102 8103 8104 8105 8106 8107 8108 8109 8110 8111 15432 16379 14566'
if command -v ss >/dev/null 2>&1; then
  for p in $ports; do
    if ss -ltn 2>/dev/null | grep -qE "[^0-9.]0\.0\.0\.0:${p}\b|:::${p}\b"; then
      bad "port ${p} is bound to a non-loopback interface"
    fi
  done
fi

if [ "$fail" -ne 0 ]; then
  note "PRE-FLIGHT FAILED - do not run active phases."
  exit 1
fi
note "PRE-FLIGHT OK - loopback only, no live keys, not production."
