#!/usr/bin/env bash
set -euo pipefail

service=$1
image=$2
environment=$3
cluster="zudomart-${environment}"
blue_green=${4:-false}
port=${5:-8080}

current=$(aws ecs describe-services --cluster "$cluster" --services "$service" --query 'services[0].taskDefinition' --output text)
aws ecs describe-task-definition --task-definition "$current" --query taskDefinition > current.json
jq --arg image "$image" --arg name "$service" '
  .containerDefinitions |= map(if .name == $name then .image = $image else . end)
  | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)
' current.json > next.json
next=$(aws ecs register-task-definition --cli-input-json file://next.json --query taskDefinition.taskDefinitionArn --output text)
echo "registered $next"

if [ "$blue_green" = "true" ]; then
  appspec=$(jq -cn --arg task "$next" --arg name "$service" --argjson port "$port" \
    '{version: 1, Resources: [{TargetService: {Type: "AWS::ECS::Service", Properties: {TaskDefinition: $task, LoadBalancerInfo: {ContainerName: $name, ContainerPort: $port}}}}]}')
  revision=$(jq -cn --arg content "$appspec" '{revisionType: "AppSpecContent", appSpecContent: {content: $content}}')
  deployment=$(aws deploy create-deployment \
    --application-name "zudomart-${environment}-${service}" \
    --deployment-group-name "zudomart-${environment}-${service}" \
    --revision "$revision" --query deploymentId --output text)
  echo "codedeploy deployment $deployment (10 percent canary, alarm rollback)"
  aws deploy wait deployment-successful --deployment-id "$deployment"
  exit 0
fi

aws ecs update-service --cluster "$cluster" --service "$service" --task-definition "$next" --force-new-deployment > /dev/null
aws ecs wait services-stable --cluster "$cluster" --services "$service"
state=$(aws ecs describe-services --cluster "$cluster" --services "$service" --query "services[0].deployments[?taskDefinition=='$next'] | [0].rolloutState" --output text)
if [ "$state" != "COMPLETED" ]; then
  echo "::error::$service rollout ended as $state (the circuit breaker rolls back automatically)"
  exit 1
fi
