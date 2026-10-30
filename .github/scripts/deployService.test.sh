#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
aws() {
  case "$1 $2" in
    'ecs describe-task-definition')
      [[ "$4" == nantty-staging-go-money ]] || return 90
      jq -cn --arg mode "${MOCK_MODE:-}" '{family:"nantty-staging-go-money",containerDefinitions:([{name:"go-money",image:"old",environment:[{name:"ESCROW_FEE_BPS",value:"0"},{name:"ESCROW_FEE_BUSINESS_PLAN_BPS",value:"0"}]}]+(if $mode == "no-proxy" then [] else [{name:"tls-proxy",image:"old-proxy",essential:true}] end))}' ;;
    'ecs register-task-definition')
      jq -e '
        any(.containerDefinitions[]; .name == "go-money" and .image == "registry/nantty/go-money:sha" and all(.environment[]; .value == "0")) and
        any(.containerDefinitions[]; .name == "tls-proxy" and .image == "registry/nantty/tls-proxy:sha" and .essential == true)
      ' "${4#file://}" > /dev/null || return 91
      echo registered-task ;;
    'ecs update-service') echo '{}' ;;
    'ecs wait') return 0 ;;
    'ecs describe-services') echo COMPLETED ;;
    *) echo "Unexpected AWS call: $*" >&2; return 99 ;;
  esac
}
export -f aws
bash .github/scripts/deployService.sh go-money registry/nantty/go-money:sha staging
if MOCK_MODE=no-proxy bash .github/scripts/deployService.sh go-money registry/nantty/go-money:sha staging; then
  echo 'FAIL: accepted task definition without TLS proxy' >&2; exit 1
fi
echo 'PASS: latest family selected, both images promoted, zero fees retained, proxy-less definition rejected (mock AWS only)'
