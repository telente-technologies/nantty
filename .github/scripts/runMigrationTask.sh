#!/usr/bin/env bash
set -euo pipefail
environment=${1:?environment required}
[[ "$environment" =~ ^(staging|prod)$ ]] || exit 1
: "${MIGRATE_TASK_DEFINITION:?required}"
: "${MIGRATION_IMAGE:?the exact go-money image for this deployment is required}"
: "${PRIVATE_SUBNETS:?required}"
: "${TASKS_SECURITY_GROUP:?required}"
definition=$(aws ecs describe-task-definition --task-definition "$MIGRATE_TASK_DEFINITION" --output json)
family=$(jq -er '.taskDefinition.family' <<< "$definition")
[[ "$family" == "nantty-${environment}-migrate" ]] || {
  echo "migration task definition must belong to nantty-${environment}-migrate" >&2
  exit 1
}
migration_container=migration
jq -e --arg name "$migration_container" '
  .taskDefinition.containerDefinitions[]
  | select(.name == $name)
  | ([.secrets[]?] | length == 1 and .[0].name == "MONEY_MIGRATION_DATABASE_URL" and (.[0].valueFrom | contains("svc_migrator")))
  and ([.environment[]?.name] | all((ascii_upcase | test("(^|_)(DATABASE_URL|DB_URL)$")) | not))
' <<< "$definition" > /dev/null || {
  echo 'migration task must have only the svc_migrator MONEY_MIGRATION_DATABASE_URL secret and no other database URL environment values' >&2
  exit 1
}
essential=$(jq -ce --arg name "$migration_container" '[.taskDefinition.containerDefinitions[] | select(.essential != false) | .name] | select(length > 0 and any(.[]; . == $name))' <<< "$definition")
payload=$(jq -ce --arg name "$migration_container" --arg image "$MIGRATION_IMAGE" '
  .taskDefinition
  | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy, .deregisteredAt, .tags)
  | .containerDefinitions |= map(if .name == $name then .image = $image | .entryPoint = ["/app"] | .command = ["--migrate-money"] | .essential = true else . end)
' <<< "$definition")
registered=$(aws ecs register-task-definition --cli-input-json "$payload" --output json)
task_definition=$(jq -er '.taskDefinition.taskDefinitionArn' <<< "$registered")
network=$(jq -cn --arg subnets "$PRIVATE_SUBNETS" --arg groups "$TASKS_SECURITY_GROUP" \
  '{awsvpcConfiguration:{subnets:($subnets|split(",")|map(gsub("^\\s+|\\s+$";""))),securityGroups:($groups|split(",")|map(gsub("^\\s+|\\s+$";""))),assignPublicIp:"DISABLED"}}')
result=$(aws ecs run-task --cluster "nantty-$environment" --task-definition "$task_definition" \
  --launch-type FARGATE --started-by "migration-${GITHUB_RUN_ID:?required}" --network-configuration "$network" --output json)
task=$(jq -er 'select((.failures | length) == 0 and (.tasks | length) == 1) | .tasks[0].taskArn' <<< "$result")
aws ecs wait tasks-stopped --cluster "nantty-$environment" --tasks "$task"
result=$(aws ecs describe-tasks --cluster "nantty-$environment" --tasks "$task" --output json)
# Container order is not a contract. Every essential container must have exited
# successfully; a successful telemetry sidecar cannot conceal a failed migration.
jq -e --argjson names "$essential" '
  select((.failures | length) == 0 and (.tasks | length) == 1)
  | .tasks[0] | select(.lastStatus == "STOPPED" and .stopCode != "TaskFailedToStart")
  | .containers as $containers
  | all($names[]; . as $name | any($containers[]; .name == $name and .lastStatus == "STOPPED" and .exitCode == 0))
' <<< "$result" > /dev/null
