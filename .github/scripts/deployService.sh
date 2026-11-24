#!/usr/bin/env bash
set -euo pipefail

service=$1
image=$2
environment=$3
cluster="nantty-${environment}"
proxy_image="${4:-${image%/nantty/*}/nantty/tls-proxy:${image##*:}}"
clamav_image="${5:-${image%/nantty/*}/nantty/clamav:${image##*:}}"
require_clamav=false
if [[ $# -ge 5 ]]; then
  require_clamav=true
fi

# Services deploy concurrently; task-definition files must never be shared.
deploy_tmp=$(mktemp -d)
trap 'rm -f "$deploy_tmp/current.json" "$deploy_tmp/next.json"; rmdir "$deploy_tmp"' EXIT

# Latest active family revision picks up Terraform's runtime/SG-independent task
# configuration after bootstrap or infrastructure changes, rather than cloning
# the older definition still attached to the service.
aws ecs describe-task-definition --task-definition "nantty-${environment}-${service}" --query taskDefinition > "$deploy_tmp/current.json"
jq -e --arg image "$image" --arg proxy "$proxy_image" --arg clamav "$clamav_image" --arg name "$service" --arg require_clamav "$require_clamav" '
  select(any(.containerDefinitions[]; .name == "tls-proxy" and .essential == true))
  | select($require_clamav != "true" or any(.containerDefinitions[]; .name == "clamav" and .essential == true))
  | .containerDefinitions |= map(if .name == $name then .image = $image elif .name == "tls-proxy" then .image = $proxy elif $name == "media" and .name == "clamav" then .image = $clamav else . end)
  | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)
' "$deploy_tmp/current.json" > "$deploy_tmp/next.json"
next=$(aws ecs register-task-definition --cli-input-json "file://$deploy_tmp/next.json" --query taskDefinition.taskDefinitionArn --output text)
echo "registered $next"

aws ecs update-service --cluster "$cluster" --service "$service" --task-definition "$next" --force-new-deployment > /dev/null
aws ecs wait services-stable --cluster "$cluster" --services "$service"
state=$(aws ecs describe-services --cluster "$cluster" --services "$service" --query "services[0].deployments[?taskDefinition=='$next'] | [0].rolloutState" --output text)
if [ "$state" != "COMPLETED" ]; then
  echo "::error::$service rollout ended as $state (the circuit breaker rolls back automatically)"
  exit 1
fi
