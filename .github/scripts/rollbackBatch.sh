#!/usr/bin/env bash
set -euo pipefail

environment=${1:?environment required}
mode=${2:?mode required (--from-file, --target-sha, or --previous-revision)}
shift 2

[[ "$environment" =~ ^(staging|prod)$ ]] || {
  echo "Invalid environment: $environment" >&2
  exit 1
}

all_services=(
  go-money
  go-identity
  go-commerce
  go-live
  go-ads
  go-trust
  gateway
  social
  notifications
  media
  search
  support
  realtime
  intelligence
)

revisions_file=""
target_sha=""
registry=""
services_csv="all"
summary_file=""

case "$mode" in
  --from-file)
    revisions_file=${1:?revisions JSON file required}
    shift
    [ -f "$revisions_file" ] || {
      echo "Revisions file not found: $revisions_file" >&2
      exit 1
    }
    ;;
  --target-sha)
    target_sha=${1:?target SHA/tag required}
    registry=${2:?ECR registry host required}
    shift 2
    ;;
  --previous-revision)
    ;;
  *)
    echo "Unknown rollback batch mode: $mode" >&2
    exit 1
    ;;
esac

while [ "$#" -gt 0 ]; do
  case "$1" in
    --services)
      services_csv=${2:?value required for --services}
      shift 2
      ;;
    --summary-file)
      summary_file=${2:?value required for --summary-file}
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

selected=()
if [ "$services_csv" = "all" ] || [ -z "$services_csv" ]; then
  selected=("${all_services[@]}")
else
  IFS=',' read -r -a requested <<< "$services_csv"
  for raw in "${requested[@]}"; do
    svc=$(echo "$raw" | tr -d '[:space:]')
    [ -n "$svc" ] || continue
    valid=0
    for allowed in "${all_services[@]}"; do
      if [ "$svc" = "$allowed" ]; then
        valid=1
        break
      fi
    done
    if [ "$valid" -ne 1 ]; then
      echo "Unknown or non-rollbackable service: $svc" >&2
      exit 1
    fi
    already=0
    for existing in "${selected[@]+"${selected[@]}"}"; do
      if [ "$existing" = "$svc" ]; then
        already=1
        break
      fi
    done
    [ "$already" -eq 1 ] || selected+=("$svc")
  done
fi

[ "${#selected[@]}" -gt 0 ] || {
  echo "No valid services selected for rollback" >&2
  exit 1
}

run_one() {
  local svc=$1
  case "$mode" in
    --from-file)
      local td
      td=$(jq -r --arg s "$svc" '.[$s] // empty' "$revisions_file")
      if [ -z "$td" ]; then
        echo "No pre-deploy revision recorded for $svc in $revisions_file; skipping"
        return 0
      fi
      bash .github/scripts/rollbackService.sh "$svc" "$environment" --task-definition "$td"
      ;;
    --target-sha)
      bash .github/scripts/rollbackService.sh "$svc" "$environment" --target-sha "$target_sha" "$registry"
      ;;
    --previous-revision)
      bash .github/scripts/rollbackService.sh "$svc" "$environment" --previous-revision
      ;;
  esac
}

# Roll back go-money first if present so callers revert after the ledger/wallet core is restored.
remaining=()
has_go_money=0
for svc in "${selected[@]}"; do
  if [ "$svc" = "go-money" ]; then
    has_go_money=1
  else
    remaining+=("$svc")
  fi
done

if [ "$has_go_money" -eq 1 ]; then
  run_one go-money
fi

if [ "${#remaining[@]}" -gt 0 ]; then
  pids=()
  for svc in "${remaining[@]}"; do
    run_one "$svc" &
    pids+=($!)
  done
  failed=0
  for pid in "${pids[@]}"; do
    wait "$pid" || failed=1
  done
  [ "$failed" -eq 0 ] || {
    echo "One or more service rollbacks failed in $environment" >&2
    exit 1
  }
fi

if [ -n "$summary_file" ]; then
  mkdir -p "$(dirname "$summary_file")"
  jq -cn \
    --arg env "$environment" \
    --arg mode "$mode" \
    --arg target "${target_sha:-}" \
    --argjson svcs "$(printf '%s\n' "${selected[@]}" | jq -R . | jq -s .)" \
    '{environment: $env, mode: $mode, targetSha: (if $target == "" then null else $target end), services: $svcs}' \
    > "$summary_file"
fi

echo "Rollback batch completed for ${#selected[@]} service(s) in $environment"
