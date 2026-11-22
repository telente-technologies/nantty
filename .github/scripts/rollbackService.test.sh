#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp_test=$(mktemp -d)
trap 'rm -rf "$tmp_test"' EXIT

aws() {
  case "$1 $2" in
    'ecr batch-get-image')
      local repo="" tag=""
      local args=("$@")
      for ((i = 0; i < ${#args[@]}; i++)); do
        if [ "${args[$i]}" = "--repository-name" ]; then repo="${args[$((i+1))]}"; fi
        if [ "${args[$i]}" = "--image-ids" ]; then tag="${args[$((i+1))]#imageTag=}"; fi
      done
      if [ "${MOCK_MISSING_ECR:-}" = "$repo" ] || [ "$tag" = "missing-sha" ]; then
        echo '{"images":[]}'
      else
        echo '{"images":[{"imageId":{"imageTag":"'"$tag"'"}}]}'
      fi
      ;;

    'ecs describe-task-definition')
      local td=""
      local args=("$@")
      for ((i = 0; i < ${#args[@]}; i++)); do
        if [ "${args[$i]}" = "--task-definition" ]; then td="${args[$((i+1))]}"; fi
      done
      case "$td" in
        arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41|nantty-staging-go-money:41)
          echo '{"family":"nantty-staging-go-money","revision":41,"status":"ACTIVE","taskDefinitionArn":"arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41","containerDefinitions":[{"name":"go-money","image":"reg/nantty/go-money:good-sha"},{"name":"tls-proxy","image":"reg/nantty/tls-proxy:good-sha","essential":true}]}'
          ;;
        arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-gateway:12|nantty-staging-gateway:12|nantty-staging-gateway)
          echo '{"family":"nantty-staging-gateway","revision":12,"status":"ACTIVE","taskDefinitionArn":"arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-gateway:12","containerDefinitions":[{"name":"gateway","image":"reg/nantty/gateway:bad-sha"},{"name":"tls-proxy","image":"reg/nantty/tls-proxy:bad-sha","essential":true}]}'
          ;;
        nantty-staging-go-money:42)
          # Intermediate revision that still had the broken image
          echo '{"family":"nantty-staging-go-money","revision":42,"status":"ACTIVE","taskDefinitionArn":"arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:42","containerDefinitions":[{"name":"go-money","image":"reg/nantty/go-money:bad-sha"},{"name":"tls-proxy","image":"reg/nantty/tls-proxy:bad-sha","essential":true}]}'
          ;;
        arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:43|nantty-staging-go-money:43|nantty-staging-go-money)
          echo '{"family":"nantty-staging-go-money","revision":43,"status":"ACTIVE","taskDefinitionArn":"arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:43","containerDefinitions":[{"name":"go-money","image":"reg/nantty/go-money:bad-sha"},{"name":"tls-proxy","image":"reg/nantty/tls-proxy:bad-sha","essential":true}]}'
          ;;
        arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:99)
          # Proxy-less unsafe task definition
          echo '{"family":"nantty-staging-go-money","revision":99,"status":"ACTIVE","taskDefinitionArn":"arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:99","containerDefinitions":[{"name":"go-money","image":"reg/nantty/go-money:good-sha"}]}'
          ;;
        *)
          return 90
          ;;
      esac
      ;;

    'ecs register-task-definition')
      local file_arg=""
      local args=("$@")
      for ((i = 0; i < ${#args[@]}; i++)); do
        if [ "${args[$i]}" = "--cli-input-json" ]; then file_arg="${args[$((i+1))]#file://}"; fi
      done
      jq -e '
        any(.containerDefinitions[]; .name == "go-money" and .image == "reg/nantty/go-money:good-sha") and
        any(.containerDefinitions[]; .name == "tls-proxy" and .image == "reg/nantty/tls-proxy:good-sha" and .essential == true)
      ' "$file_arg" > /dev/null || return 91
      echo "arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:44"
      ;;

    'ecs update-service')
      local td=""
      local args=("$@")
      for ((i = 0; i < ${#args[@]}; i++)); do
        if [ "${args[$i]}" = "--task-definition" ]; then td="${args[$((i+1))]}"; fi
      done
      if [ -n "${MOCK_EXPECT_TD:-}" ] && [ "$td" != "$MOCK_EXPECT_TD" ]; then
        echo "Expected task definition $MOCK_EXPECT_TD, got $td" >&2
        return 92
      fi
      echo '{}'
      ;;

    'ecs wait')
      return 0
      ;;

    'ecs describe-services')
      local args_str="$*"
      if [[ "$args_str" == *"rolloutState"* ]]; then
        if [ "${MOCK_ROLLOUT_FAIL:-}" = "1" ]; then
          echo "FAILED"
        else
          echo "COMPLETED"
        fi
        return 0
      fi
      if [[ "$args_str" == *"--output text"* ]]; then
        echo "arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41"
        return 0
      fi
      local controller="${MOCK_CONTROLLER:-ECS}"
      local current_td="${MOCK_CURRENT_TD:-arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:43}"
      jq -cn --arg ctrl "$controller" --arg td "$current_td" '{
        services: [{
          deploymentController: { type: $ctrl },
          taskDefinition: $td,
          loadBalancers: [{ containerName: "tls-proxy", containerPort: 18443 }],
          deployments: [{ status: "PRIMARY", taskDefinition: $td, rolloutState: "COMPLETED" }]
        }]
      }'
      ;;

    'deploy create-deployment')
      echo "d-rollback-123"
      ;;
    'deploy wait')
      return 0
      ;;
    'deploy get-deployment')
      echo "Succeeded"
      ;;

    *)
      echo "Unexpected AWS call: $*" >&2
      return 99
      ;;
  esac
}
export -f aws

# 1. Capture pre-deploy task definition revisions
bash .github/scripts/captureServiceRevisions.sh staging "$tmp_test/revisions.json" go-money gateway
jq -e '."go-money" == "arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41" and ."gateway" == "arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41"' "$tmp_test/revisions.json" > /dev/null

# 2. Roll back using captured --task-definition ARN
MOCK_EXPECT_TD="arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41" \
  bash .github/scripts/rollbackService.sh go-money staging --task-definition "arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41"

# 3. Skip cleanly if already stable on target ARN
MOCK_CURRENT_TD="arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41" \
  bash .github/scripts/rollbackService.sh go-money staging --task-definition "arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41"

# 4. Reject proxy-less target task definition
if bash .github/scripts/rollbackService.sh go-money staging --task-definition "arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:99"; then
  echo "FAIL: accepted proxy-less task definition on rollback" >&2
  exit 1
fi

# 5. Roll back by --target-sha (verifies ECR images + registers clean revision)
MOCK_EXPECT_TD="arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:44" \
  bash .github/scripts/rollbackService.sh go-money staging --target-sha good-sha reg

# 6. Reject --target-sha if tls-proxy image is missing in ECR
if MOCK_MISSING_ECR="nantty/tls-proxy" bash .github/scripts/rollbackService.sh go-money staging --target-sha good-sha reg; then
  echo "FAIL: accepted missing tls-proxy image tag in ECR" >&2
  exit 1
fi

# 7. Roll back by --previous-revision (skips rev 42 with same bad-sha and picks rev 41)
MOCK_EXPECT_TD="arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41" \
  bash .github/scripts/rollbackService.sh go-money staging --previous-revision

# 8. Roll back CodeDeploy Blue/Green service
MOCK_CONTROLLER="CODE_DEPLOY" \
  bash .github/scripts/rollbackService.sh go-money staging --task-definition "arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41"

# 9. Batch rollback from captured file (subset + summary output)
jq -n '{
  "go-money": "arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-go-money:41",
  "gateway": "arn:aws:ecs:us-east-1:123:task-definition/nantty-staging-gateway:12"
}' > "$tmp_test/batch-revisions.json"
bash .github/scripts/rollbackBatch.sh staging --from-file "$tmp_test/batch-revisions.json" --services "gateway,go-money" --summary-file "$tmp_test/summary.json"
jq -e '.environment == "staging" and .mode == "--from-file" and (.services | length == 2)' "$tmp_test/summary.json" > /dev/null

# 10. Reject unknown service in batch rollback
if bash .github/scripts/rollbackBatch.sh staging --previous-revision --services "go-money,nonexistent-service"; then
  echo "FAIL: accepted unknown service in rollbackBatch" >&2
  exit 1
fi

echo "PASS: captureServiceRevisions, rollbackService, and rollbackBatch verified (mock AWS only)"
