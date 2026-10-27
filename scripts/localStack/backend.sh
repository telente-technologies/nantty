#!/usr/bin/env bash
# pnpm backend:up [-- --lan] [-- --full] [-- --no-seed] | backend:down [-- --keep-infra] [-- --force] | backend:infra:up | backend:infra:down
# Wraps infra/local (docker compose) and security/regression/startSandboxStack.sh; every listener stays on 127.0.0.1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="$ROOT/.data/localStack"
export ZBIN="${ZBIN:-$STATE/bin}" ZLOGS="${ZLOGS:-$STATE/logs}"
COMPOSE=(docker compose -f "$ROOT/infra/local/docker-compose.yml")
CORE_INFRA=(postgres valkey rabbitmq localstack object-storage)
GO_DEPLOYABLES=(goIdentity goLive goMoney goTrust goCommerce goAds)
PRISMA_SERVICES=(social media search notifications support)
REQUIRED_HEALTH=(goIdentity=http://127.0.0.1:8101/healthz goLive=http://127.0.0.1:8102/healthz goMoney=http://127.0.0.1:8103/healthz
  goTrust=http://127.0.0.1:8106/healthz goCommerce=http://127.0.0.1:8107/healthz goAds=http://127.0.0.1:8110/healthz
  social=http://127.0.0.1:8105/healthz media=http://127.0.0.1:8108/healthz search=http://127.0.0.1:8109/healthz
  notifications=http://127.0.0.1:8104/healthz support=http://127.0.0.1:8111/healthz gateway=http://127.0.0.1:8080/healthz
  realtime=http://127.0.0.1:4000/healthz)
OPTIONAL_HEALTH=(intelligence=http://127.0.0.1:8090/health/live)
STARTED_INFRA="$STATE/startedInfra.txt"
STACK_PORTS=(8080 8101 8102 8103 8104 8105 8106 8107 8108 8109 8110 8111 4000 8090 18998)

log() { printf '[backend] %s\n' "$*"; }
isHealthy() { curl -fsS -m 3 -o /dev/null "$1" 2>/dev/null; }
listenerPids() { ss -ltnpH "( sport = :$1 )" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u; }

waitHealthy() { # name=url timeoutSeconds
  local name="${1%%=*}" url="${1#*=}" deadline=$((SECONDS + $2))
  while [ $SECONDS -lt $deadline ]; do isHealthy "$url" && { printf '  %-14s up\n' "$name"; return 0; }; sleep 2; done
  printf '  %-14s DOWN after %ss (%s; log %s/%s.log)\n' "$name" "$2" "$url" "$ZLOGS" "$name"; return 1
}

infraUp() {
  local wanted=("${CORE_INFRA[@]}") running service
  [ "${FULL_INFRA:-0}" = 1 ] && mapfile -t wanted < <("${COMPOSE[@]}" config --services)
  running="$("${COMPOSE[@]}" ps --services --status running 2>/dev/null || true)"
  mkdir -p "$STATE"; touch "$STARTED_INFRA"
  for service in "${wanted[@]}"; do
    grep -qx "$service" <<<"$running" || grep -qx "$service" "$STARTED_INFRA" || echo "$service" >>"$STARTED_INFRA"
  done
  "${COMPOSE[@]}" up -d --wait "${wanted[@]}"
}

ensureFfmpeg() {
  command -v ffmpeg >/dev/null && return 0
  docker image inspect nantty-local-ffmpeg:1 >/dev/null 2>&1 || docker build -q -t nantty-local-ffmpeg:1 "$ROOT/scripts/localStack/ffmpeg" >/dev/null
  export PATH="$ROOT/scripts/localStack/ffmpeg/bin:$PATH"
  log "no ffmpeg on this machine: media processes videos with the local nantty-local-ffmpeg image"
}

startRealtime() {
  docker rm -f nantty-realtime-smoke >/dev/null 2>&1 || true
  [ -f "$ZLOGS/realtimeLogs.pid" ] && { killTree "$(cat "$ZLOGS/realtimeLogs.pid")"; rm -f "$ZLOGS/realtimeLogs.pid"; }
  if ! command -v mix >/dev/null; then log "mix not installed; realtime (chat, live sockets) stays down"; return 0; fi
  local liveToken socialToken
  liveToken="$(grep -m1 '^LIVE_INTERNAL_API_TOKEN=' "$ROOT/security/regression/sandboxSecrets.env" | cut -d= -f2-)"
  [ -n "$liveToken" ] || liveToken="$(grep -m1 '^LIVE_INTERNAL_API_TOKEN=' "$ROOT/services/go/.env.example" | cut -d= -f2-)"
  socialToken="$(grep -m1 '^SOCIAL_INTERNAL_TOKEN=' "$ROOT/services/typescript/social/.env.example" | cut -d= -f2-)"
  ( cd "$ROOT/services/elixir/realtime"
    export MIX_ENV=dev PHX_SERVER=true REALTIME_HTTP_IP=127.0.0.1 PORT=4000
    export AUTH_JWKS_URL=http://127.0.0.1:8101/.well-known/jwks.json AUTH_TOKEN_ISSUER=http://localhost:8101 REALTIME_TOKEN_AUDIENCE=nantty-realtime
    export LIVE_INTERNAL_URL=http://127.0.0.1:8102 LIVE_INTERNAL_API_TOKEN="$liveToken"
    export SOCIAL_INTERNAL_URL=http://127.0.0.1:8105 SOCIAL_INTERNAL_TOKEN="$socialToken"
    export RABBITMQ_URL=amqp://realtime:realtime-local-only@localhost:5672/nantty
    mix deps.get >"$ZLOGS/realtime.log" 2>&1
    nohup nice -n 5 mix phx.server >>"$ZLOGS/realtime.log" 2>&1 &
    echo $! >"$ZLOGS/realtime.pid" )
}

buildGo() {
  mkdir -p "$ZBIN"
  for bin in "${GO_DEPLOYABLES[@]}"; do
    log "building $bin"
    (cd "$ROOT/services/go" && nice -n 5 go build -o "$ZBIN/$bin" "./deployables/$bin")
  done
  (cd "$ROOT/services/go/modules/admin" && nice -n 5 go build -o "$ZBIN/bootstrapSuperadmin" ./cmd/bootstrapSuperadmin)
}

migrateTypescript() {
  for svc in "${PRISMA_SERVICES[@]}"; do
    log "prisma migrate deploy: $svc"
    (cd "$ROOT/services/typescript/$svc" && set -a && . ./.env.example && set +a && npx prisma migrate deploy >"$ZLOGS/migrate-$svc.log" 2>&1) \
      || { log "migration failed for $svc, see $ZLOGS/migrate-$svc.log"; return 1; }
  done
}

startLanForward() {
  local address
  address="$(node --input-type=module -e 'import { detectLanAddress } from "'"$ROOT"'/scripts/localMode/lanAddress.mjs"; console.log(detectLanAddress() ?? "");')"
  if [ -z "$address" ]; then log "no LAN address found; skipping the LAN forward"; return 0; fi
  nohup node "$ROOT/scripts/localStack/lanForward.mjs" "$address" 8080 18333 >"$ZLOGS/lanForward.log" 2>&1 &
  echo $! >"$ZLOGS/lanForward.pid"
  log "phone access: http://$address:8080 (gateway) and http://$address:18333 (media) forward to loopback"
}

killTree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do killTree "$child"; done
  kill -TERM "$1" 2>/dev/null || true
}

up() {
  mkdir -p "$ZLOGS"
  if isHealthy http://127.0.0.1:8080/healthz; then
    log "gateway already answers on 127.0.0.1:8080; reusing the running stack (not starting a second one)"
  else
    local busy=()
    for port in "${STACK_PORTS[@]}"; do [ -n "$(listenerPids "$port")" ] && busy+=("$port"); done
    if [ ${#busy[@]} -gt 0 ]; then
      log "ports already in use without a healthy gateway: ${busy[*]}"
      log "a half-started stack is running; run 'pnpm backend:down -- --force' first"; exit 1
    fi
    log "starting infra (${FULL_INFRA:+everything in infra/local}${FULL_INFRA:-${CORE_INFRA[*]}})"
    infraUp
    migrateTypescript
    buildGo
    ensureFfmpeg
    rm -f "$ZLOGS"/*.pid
    SANDBOX_RELAXED_LIMITS="${SANDBOX_RELAXED_LIMITS:-1}" bash "$ROOT/security/regression/startSandboxStack.sh"
    startRealtime
    echo started >"$STATE/servicesStartedByUp"
  fi
  log "waiting for health (Go services apply their migrations on start)"
  local failed=0
  for entry in "${REQUIRED_HEALTH[@]}"; do waitHealthy "$entry" "$([ "${entry%%=*}" = realtime ] && echo 900 || echo 240)" || failed=1; done
  for entry in "${OPTIONAL_HEALTH[@]}"; do waitHealthy "$entry" 300 || log "(optional) ${entry%%=*} is not up; live sockets or ranking fall back"; done
  [ $failed = 0 ] || { log "required services are down; see $ZLOGS"; exit 1; }
  [ "${LAN:-0}" = 1 ] && startLanForward
  if [ "${SEED:-1}" = 1 ]; then
    log "seeding demo data"
    [ -x "$ZBIN/bootstrapSuperadmin" ] && export SMOKE_BOOTSTRAP_SUPERADMIN_BINARY="$ZBIN/bootstrapSuperadmin"
    SMOKE_IDENTITY_LOG="${SMOKE_IDENTITY_LOG:-$ZLOGS/goIdentity.log}" SMOKE_GATEWAY_URL=http://127.0.0.1:8080 \
      "$ROOT/services/scripts/apiSmoke/node_modules/.bin/tsx" "$ROOT/scripts/localStack/seedDemo.mts"
  fi
  log "ready. Logs: $ZLOGS. Next: pnpm mode:backend, pnpm backend:check"
}

down() {
  local pidfile pid
  for pidfile in "$ZLOGS"/*.pid; do
    [ -f "$pidfile" ] || continue
    pid="$(cat "$pidfile")"
    kill -0 "$pid" 2>/dev/null && killTree "$pid"
    rm -f "$pidfile"
  done
  [ -f "$STATE/servicesStartedByUp" ] && docker rm -f nantty-realtime-smoke >/dev/null 2>&1 || true
  rm -f "$STATE/servicesStartedByUp"
  sleep 3
  local leftover=()
  for port in "${STACK_PORTS[@]}"; do [ -n "$(listenerPids "$port")" ] && leftover+=("$port"); done
  if [ ${#leftover[@]} -gt 0 ]; then
    if [ "${FORCE:-0}" = 1 ]; then
      for port in "${leftover[@]}"; do for pid in $(listenerPids "$port"); do kill -TERM "$pid" 2>/dev/null || true; done; done
      log "stopped leftover listeners on ${leftover[*]}"
    else
      log "still listening (started outside this script?): ${leftover[*]}; rerun with -- --force to stop them"
    fi
  fi
  local started=()
  [ -f "$STARTED_INFRA" ] && mapfile -t started <"$STARTED_INFRA"
  if [ "${KEEP_INFRA:-0}" = 1 ]; then log "services stopped; infra left running"
  elif [ ${#started[@]} -eq 0 ]; then log "services stopped; infra was already running before backend:up, so it is left running"
  else "${COMPOSE[@]}" stop "${started[@]}"; rm -f "$STARTED_INFRA"; log "stopped the infra backend:up started (${started[*]}); anything already running before is left alone"; fi
}

action="${1:-}"; shift || true
for argument in "$@"; do
  case "$argument" in
    --lan) LAN=1 ;; --full) FULL_INFRA=1 ;; --no-seed) SEED=0 ;; --keep-infra) KEEP_INFRA=1 ;; --force) FORCE=1 ;; --) ;;
    *) echo "unknown option $argument" >&2; exit 1 ;;
  esac
done
case "$action" in
  up) up ;;
  down) down ;;
  infra-up) infraUp ;;
  infra-down) "${COMPOSE[@]}" stop ;;
  *) echo "usage: backend.sh up|down|infra-up|infra-down [--lan] [--full] [--no-seed] [--keep-infra] [--force]" >&2; exit 1 ;;
esac
