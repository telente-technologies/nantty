#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
aws() {
  case "$1 $2" in
    'ecs describe-task-definition')
      [[ "$4" == "nantty-staging-${MOCK_SERVICE:-go-money}" ]] || return 90
      if [[ "${MOCK_MODE:-}" == media || "${MOCK_MODE:-}" == media-refresh ]]; then
        jq -cn '{family:"nantty-staging-media",containerDefinitions:[{name:"media",image:"old"},{name:"clamav",image:"old-scanner",essential:true},{name:"tls-proxy",image:"old-proxy",essential:true}]}'
      elif [[ "${MOCK_MODE:-}" == media-missing-scanner ]]; then
        jq -cn '{family:"nantty-staging-media",containerDefinitions:[{name:"media",image:"old"},{name:"tls-proxy",image:"old-proxy",essential:true}]}'
      else
        jq -cn --arg mode "${MOCK_MODE:-}" '{family:"nantty-staging-go-money",containerDefinitions:([{name:"go-money",image:"old",environment:[{name:"ESCROW_FEE_BPS",value:"0"},{name:"ESCROW_FEE_BUSINESS_PLAN_BPS",value:"0"}]}]+(if $mode == "no-proxy" then [] else [{name:"tls-proxy",image:"old-proxy",essential:true}] end))}'
      fi ;;
    'ecs register-task-definition')
      if [[ "${MOCK_MODE:-}" == media ]]; then
        jq -e '
          any(.containerDefinitions[]; .name == "media" and .image == "registry/nantty/media:sha") and
          any(.containerDefinitions[]; .name == "clamav" and .image == "registry/nantty/clamav:sha") and
          any(.containerDefinitions[]; .name == "tls-proxy" and .image == "registry/nantty/tls-proxy:sha" and .essential == true)
        ' "${4#file://}" > /dev/null || return 91
      elif [[ "${MOCK_MODE:-}" == media-refresh ]]; then
        jq -e '
          any(.containerDefinitions[]; .name == "media" and .image == "registry/nantty/media:current") and
          any(.containerDefinitions[]; .name == "clamav" and .image == "registry/nantty/clamav:refresh") and
          any(.containerDefinitions[]; .name == "tls-proxy" and .image == "registry/nantty/tls-proxy:current" and .essential == true)
        ' "${4#file://}" > /dev/null || return 91
      else
        jq -e '
          any(.containerDefinitions[]; .name == "go-money" and .image == "registry/nantty/go-money:sha" and all(.environment[]; .value == "0")) and
          any(.containerDefinitions[]; .name == "tls-proxy" and .image == "registry/nantty/tls-proxy:sha" and .essential == true)
        ' "${4#file://}" > /dev/null || return 91
      fi
      echo registered-task ;;
    'ecs update-service') echo '{}' ;;
    'ecs wait') return 0 ;;
    'ecs describe-services') echo COMPLETED ;;
    *) echo "Unexpected AWS call: $*" >&2; return 99 ;;
  esac
}
export -f aws
bash .github/scripts/deployService.sh go-money registry/nantty/go-money:sha staging
MOCK_MODE=media MOCK_SERVICE=media bash .github/scripts/deployService.sh media registry/nantty/media:sha staging
MOCK_MODE=media-refresh MOCK_SERVICE=media bash .github/scripts/deployService.sh media registry/nantty/media:current staging registry/nantty/tls-proxy:current registry/nantty/clamav:refresh
if MOCK_MODE=no-proxy bash .github/scripts/deployService.sh go-money registry/nantty/go-money:sha staging; then
  echo 'FAIL: accepted task definition without TLS proxy' >&2; exit 1
fi
if MOCK_MODE=media-missing-scanner MOCK_SERVICE=media bash .github/scripts/deployService.sh media registry/nantty/media:current staging registry/nantty/tls-proxy:current registry/nantty/clamav:refresh; then
  echo 'FAIL: accepted scanner refresh without a ClamAV sidecar' >&2; exit 1
fi
echo 'PASS: latest family selected, service/proxy/scanner images promoted, zero fees retained, proxy-less definition rejected (mock AWS only)'
