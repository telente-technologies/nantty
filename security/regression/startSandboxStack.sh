#!/usr/bin/env bash
# Test name:           Sandbox stack launcher for live phases (apiSmoke procedure, loopback-pinned)
# Target:              127.0.0.1 only; compose infra must already be up (postgres valkey rabbitmq localstack object-storage)
# Expected behavior:   Starts fake Paystack (127.0.0.1:18999) and, with SANDBOX_PAYMENTS_PROVIDER=flutterwave, fake Flutterwave
#                      (127.0.0.1:18998, PAYMENTS_PROVIDER=flutterwave for go-money), six Go deployables, gateway + five TS services,
#                      Phoenix realtime (127.0.0.1:4000, elixir:1.19 container on the host network) and Python
#                      intelligence (127.0.0.1:8090), every listener pinned to 127.0.0.1, PAYSTACK_API_BASE_URL
#                      forced to the fake. Writes PIDs + logs to $ZLOGS. SANDBOX_RELAXED_LIMITS=1 raises gateway
#                      route limits so a single-IP smoke run is not throttled.
# Dangerous behavior:  A listener on 0.0.0.0, or goMoney reaching api.paystack.co or api.flutterwave.com. Pre-flight refuses either.
# Cleanup:             kill $(cat "$ZLOGS"/*.pid); docker stop zudomart-realtime-smoke;
#                      then docker compose -f infra/local/docker-compose.yml stop
# Financial safety:    SANDBOX-ONLY (fake Paystack, sk_test_ fake key; snapshot money tables before tests)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ZBIN="${ZBIN:?set ZBIN to the directory holding goIdentity goCommerce goMoney goLive goAds goTrust}"
ZLOGS="${ZLOGS:?set ZLOGS to a log directory}"
mkdir -p "$ZLOGS"
export PAYSTACK_API_BASE_URL="http://127.0.0.1:18999"
SANDBOX_PAYMENTS_PROVIDER="${SANDBOX_PAYMENTS_PROVIDER:-paystack}"
case "$SANDBOX_PAYMENTS_PROVIDER" in paystack|flutterwave) ;; *) echo "SANDBOX_PAYMENTS_PROVIDER must be paystack or flutterwave" >&2; exit 1 ;; esac
export FLUTTERWAVE_API_BASE_URL="http://127.0.0.1:18998/v3"
bash "$ROOT/security/authorization/preflight.sh"

start() { local name="$1"; shift; nice -n 5 "$@" >"$ZLOGS/$name.log" 2>&1 & echo $! >"$ZLOGS/$name.pid"; }

(cd "$ROOT/services/go/modules/payments" && export FAKE_PAYSTACK_LISTEN_ADDRESS=127.0.0.1:18999 && \
  start fakePaystack go test -count=1 -timeout 0 -run TestServeFakePaystackForLocalApiSmoke ./src/integrations/paymentsTesting/)
if [ "$SANDBOX_PAYMENTS_PROVIDER" = flutterwave ]; then
  (cd "$ROOT/services/go/modules/payments" && export FAKE_FLUTTERWAVE_LISTEN_ADDRESS=127.0.0.1:18998 && \
    start fakeFlutterwave go test -count=1 -timeout 0 -run TestServeFakeFlutterwaveForLocalApiSmoke ./src/integrations/paymentsTesting/)
fi

goEnv() {
  set -a; . "$ROOT/services/go/.env.example"; set +a
  while IFS= read -r line; do
    case "$line" in ''|\#*) continue ;; esac
    name="${line%%=*}"
    if [ -z "${!name:-}" ]; then export "$line"; fi
  done <"$ROOT/security/regression/sandboxSecrets.env"
  export PAYSTACK_API_BASE_URL="http://127.0.0.1:18999" PAYSTACK_SECRET_KEY="sk_test_fake_paystack"
  export PAYSTACK_WEBHOOK_IP_ALLOWLIST="${PAYSTACK_WEBHOOK_IP_ALLOWLIST:-127.0.0.1}"
  if [ "$SANDBOX_PAYMENTS_PROVIDER" = flutterwave ]; then
    export PAYMENTS_PROVIDER=flutterwave FLUTTERWAVE_API_BASE_URL="http://127.0.0.1:18998/v3"
    export FLUTTERWAVE_SECRET_KEY="FLWSECK_TEST-fakeflutterwave0000000000-X" FLUTTERWAVE_WEBHOOK_HASH="fake-flutterwave-webhook-hash-0123456789abcdef"
    export FLUTTERWAVE_MERCHANT_ID="F400000001" WALLET_ALIAS_EMAIL_DOMAIN="wallets.zudomart.test" PAYMENTS_PROCESS_WEBHOOKS_IN_BACKGROUND=false
    if [ "${SANDBOX_RELAXED_LIMITS:-0}" = 1 ]; then
      export DEPOSIT_WITHDRAWAL_COOLDOWN=1s FIRST_DEPOSIT_WITHDRAWAL_COOLDOWN=1s NEW_PAYOUT_ACCOUNT_COOLDOWN=1s SELLER_CREDIT_HOLD_PERIOD=1s WALLET_WITHDRAWAL_MINIMUM_GAP=1s
    fi
  fi
  export AUTH_ACCOUNT_DIRECTORY_GRPC_ADDRESS=127.0.0.1:9101 MONEY_GRPC_ADDRESS=127.0.0.1:9103
  export ORDERS_MONEY_GRPC_ADDRESS=localhost:9103 AUTH_SESSION_DENYLIST_URL=redis://127.0.0.1:16379
  export LIVE_MONEY_GRPC_ADDRESS=127.0.0.1:9103 ADS_MONEY_GRPC_ADDRESS=127.0.0.1:9103
  export SELLER_PLAN_ENTITLEMENTS_URL=http://127.0.0.1:8103 SELLER_PLAN_ENTITLEMENTS_TOKEN="$MONEY_INTERNAL_API_TOKEN"
  export CATALOG_ADS_INTERNAL_URL=http://127.0.0.1:8110 ORDERS_ADS_INTERNAL_URL=http://127.0.0.1:8110
  if [ "${SANDBOX_RELAXED_LIMITS:-0}" = 1 ]; then export LEDGER_SELLER_CREDIT_MATURING_INTERVAL=5s; fi
}
for spec in goIdentity:8101:go-identity goLive:8102:go-live goMoney:8103:go-money goTrust:8106:go-trust goCommerce:8107:go-commerce goAds:8110:go-ads; do
  IFS=: read -r bin port user <<<"$spec"
  ( goEnv; export HTTP_ADDRESS="127.0.0.1:$port"
    if [ "$bin" != goIdentity ]; then export RABBITMQ_URL="amqp://$user:$user-local-only@localhost:5672/zudomart"; fi
    cd "$ROOT/services/go" && start "$bin" "$ZBIN/$bin" )
done

relaxLimits() {
  [ "${SANDBOX_RELAXED_LIMITS:-0}" = 1 ] || return 0
  export RATE_LIMIT_MAX_PER_MINUTE=100000 GUEST_RATE_LIMIT_PER_MINUTE=100000 GUEST_SENSITIVE_RATE_LIMIT_PER_MINUTE=100000
  for name in LOGIN OTP RESET SIGNUP REPORT UPLOAD SEARCH USERNAMECHECK POSTWRITE TAGSEARCH VERIFICATION MEDIADOWNLOAD SELLERPEOPLESEARCH SELLERTEAMWRITE SELLERMONEYWRITE STOREMESSAGESEND; do
    export "RATE_LIMIT_${name}_PER_MINUTE=100000"
  done
}
for spec in social:8105 media:8108 search:8109 notifications:8104 support:8111 gateway:8080; do
  IFS=: read -r svc port <<<"$spec"
  ( cd "$ROOT/services/typescript/$svc"; set -a; . ./.env.example; set +a
    export HOST=127.0.0.1 PORT="$port"; if [ "$svc" = gateway ]; then relaxLimits; fi
    start "$svc" npx tsx src/server.ts )
done

( cd "$ROOT/services/python/intelligence"; set -a; . ./.env.example; set +a
  export INTELLIGENCE_HOST=127.0.0.1 INTELLIGENCE_SERVER_WORKERS=1
  start intelligence uv run --frozen zudomart-intelligence-serve )

docker rm -f zudomart-realtime-smoke >/dev/null 2>&1 || true
docker run -d --name zudomart-realtime-smoke --network host --user "$(id -u):$(id -g)" \
  -e HOME=/tmp/home -e MIX_HOME=/tmp/home/.mix -e HEX_HOME=/tmp/home/.hex -e MIX_ENV=dev -e PHX_SERVER=true \
  -e REALTIME_HTTP_IP=127.0.0.1 -e PORT=4000 -e LIVE_INTERNAL_API_TOKEN=local-only-live-internal-api-token-0123456 \
  -e LIVE_INTERNAL_URL=http://127.0.0.1:8102 -e SOCIAL_INTERNAL_URL=http://127.0.0.1:8105 \
  -e SOCIAL_INTERNAL_TOKEN=local-only-social-internal-token-0123456789 \
  -v "$ROOT/services/elixir/realtime:/work" -w /work elixir:1.19 \
  bash -c 'mkdir -p /tmp/home && mix local.hex --force >/dev/null && mix local.rebar --force >/dev/null && mix deps.get >/dev/null && mix phx.server' >/dev/null
( docker logs -f zudomart-realtime-smoke >"$ZLOGS/realtime.log" 2>&1 & echo $! >"$ZLOGS/realtimeLogs.pid" )
echo "started; logs in $ZLOGS"
