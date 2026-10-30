#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export MIGRATE_TASK_DEFINITION=nantty-staging-migrate:1 MIGRATION_IMAGE=registry.invalid/nantty/go-money:test PRIVATE_SUBNETS=subnet-1 TASKS_SECURITY_GROUP=sg-1 GITHUB_RUN_ID=123
aws() {
  case "$1 $2" in
    'ecs describe-task-definition')
      task='{"taskDefinition":{"family":"nantty-staging-migrate","containerDefinitions":[{"name":"telemetry","essential":false},{"name":"migration","essential":true,"image":"registry.invalid/old","secrets":[{"name":"MONEY_MIGRATION_DATABASE_URL","valueFrom":"arn:aws:secretsmanager:eu-west-1:123:secret:nantty/staging/db/svc_migrator:url::"}],"environment":[]}]}}'
      case ${MOCK_TASK_CONFIG:-} in
        wrong-family) task=$(jq '.taskDefinition.family = "nantty-prod-migrate"' <<< "$task") ;;
        missing-migrator) task=$(jq 'del(.taskDefinition.containerDefinitions[1].secrets)' <<< "$task") ;;
        runtime-credential) task=$(jq '.taskDefinition.containerDefinitions[1].secrets += [{"name":"MONEY_DATABASE_URL","valueFrom":"arn:runtime"}]' <<< "$task") ;;
        runtime-environment) task=$(jq '.taskDefinition.containerDefinitions[1].environment += [{"name":"DB_URL","value":"postgres://runtime"}]' <<< "$task") ;;
      esac
      echo "$task" ;;
    'ecs register-task-definition')
      payload=${4:?missing task definition JSON}
      jq -e '.containerDefinitions[] | select(.name == "migration" and .image == "registry.invalid/nantty/go-money:test" and .command == ["--migrate-money"] and .essential == true)' <<< "$payload" >/dev/null
      echo '{"taskDefinition":{"taskDefinitionArn":"arn:aws:ecs:eu-west-1:123:task-definition/nantty-staging-migrate:2"}}' ;;
    'ecs run-task')
      if [[ ${MOCK_FAILURE:-} == launch ]]; then echo '{"failures":[{"reason":"capacity"}],"tasks":[]}'
      else echo '{"failures":[],"tasks":[{"taskArn":"task"}]}'; fi ;;
    'ecs wait') return 0 ;;
    'ecs describe-tasks')
      jq -cn --arg mode "${MOCK_FAILURE:-}" '{failures:[],tasks:[{lastStatus:"STOPPED",stopCode:(if $mode == "start" then "TaskFailedToStart" else "EssentialContainerExited" end),containers:([{name:"telemetry",lastStatus:"STOPPED",exitCode:0}]+(if $mode == "missing" then [] else [{name:"migration",lastStatus:"STOPPED",exitCode:(if $mode == "exit" then 1 else 0 end)}] end))}]}' ;;
    *) echo "Unexpected AWS call: $*" >&2; return 99 ;;
  esac
}
export -f aws
bash .github/scripts/runMigrationTask.sh staging
for mode in launch start exit missing; do
  if MOCK_FAILURE=$mode bash .github/scripts/runMigrationTask.sh staging; then
    echo "FAIL: accepted $mode" >&2; exit 1
  fi
done
for config in wrong-family missing-migrator runtime-credential runtime-environment; do
  if MOCK_TASK_CONFIG=$config bash .github/scripts/runMigrationTask.sh staging; then
    echo "FAIL: accepted unsafe task configuration $config" >&2; exit 1
  fi
done
echo 'PASS: migration accepted; launch, start, migration exit and missing-container failures rejected (mock AWS only)'
