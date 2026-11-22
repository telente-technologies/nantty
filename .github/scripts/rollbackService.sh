#!/usr/bin/env bash
set -euo pipefail

service=${1:?service required}
environment=${2:?environment required}
mode=${3:?rollback mode required (--task-definition, --target-sha, or --previous-revision)}
shift 3

[[ "$environment" =~ ^(staging|prod)$ ]] || {
  echo "Invalid environment: $environment" >&2
  exit 1
}
[[ "$service" =~ ^[a-z0-9-]+$ ]] || {
  echo "Invalid service name: $service" >&2
  exit 1
}

cluster="nantty-${environment}"
family="nantty-${environment}-${service}"

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

verify_task_def_json() {
  local td_json_file=$1
  jq -e --arg fam "$family" '
    .family == $fam and
    (.status // "ACTIVE") == "ACTIVE" and
    any(.containerDefinitions[]; .name == "tls-proxy" and .essential == true)
  ' "$td_json_file" > /dev/null
}

describe_service_info() {
  aws ecs describe-services --cluster "$cluster" --services "$service" --output json > "$tmp_dir/svc.json"
  jq -e '.services | length == 1' "$tmp_dir/svc.json" > /dev/null || {
    echo "ECS service not found: $cluster/$service" >&2
    exit 1
  }
}

describe_service_info
controller=$(jq -r '.services[0].deploymentController.type // "ECS"' "$tmp_dir/svc.json")
current_td=$(jq -r '.services[0].deployments[] | select(.status == "PRIMARY") | .taskDefinition' "$tmp_dir/svc.json" | head -n1)
if [ -z "$current_td" ] || [ "$current_td" = "null" ]; then
  current_td=$(jq -r '.services[0].taskDefinition' "$tmp_dir/svc.json")
fi

target_td=""

case "$mode" in
  --task-definition)
    requested_td=${1:?task definition ARN required}
    aws ecs describe-task-definition --task-definition "$requested_td" --query taskDefinition > "$tmp_dir/target_td.json"
    verify_task_def_json "$tmp_dir/target_td.json" || {
      echo "Refusing rollback to unsafe or mismatched task definition: $requested_td" >&2
      exit 1
    }
    target_td=$(jq -er '.taskDefinitionArn // empty' "$tmp_dir/target_td.json" || true)
    [ -n "$target_td" ] || target_td="$requested_td"
    ;;

  --target-sha)
    target_tag=${1:?target image tag required}
    registry=${2:?ECR registry host required}
    [[ "$target_tag" =~ ^[a-zA-Z0-9._-]+$ ]] || {
      echo "Invalid target image tag: $target_tag" >&2
      exit 1
    }
    for repo in "nantty/${service}" "nantty/tls-proxy"; do
      aws ecr batch-get-image \
        --repository-name "$repo" \
        --image-ids "imageTag=${target_tag}" \
        --output json > "$tmp_dir/ecr.json"
      jq -e '.images | length > 0' "$tmp_dir/ecr.json" > /dev/null || {
        echo "Target image ${registry}/${repo}:${target_tag} does not exist in ECR" >&2
        exit 1
      }
    done
    image="${registry}/nantty/${service}:${target_tag}"
    proxy_image="${registry}/nantty/tls-proxy:${target_tag}"
    aws ecs describe-task-definition --task-definition "$family" --query taskDefinition > "$tmp_dir/latest_td.json"
    jq -e --arg image "$image" --arg proxy "$proxy_image" --arg name "$service" '
      select(any(.containerDefinitions[]; .name == "tls-proxy" and .essential == true))
      | .containerDefinitions |= map(
          if .name == $name then .image = $image
          elif .name == "tls-proxy" then .image = $proxy
          else . end
        )
      | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy, .deregisteredAt, .tags)
    ' "$tmp_dir/latest_td.json" > "$tmp_dir/next_td.json"
    target_td=$(aws ecs register-task-definition --cli-input-json "file://$tmp_dir/next_td.json" --query taskDefinition.taskDefinitionArn --output text)
    echo "Registered rollback task definition $target_td ($image)"
    ;;

  --previous-revision)
    [ -n "$current_td" ] && [ "$current_td" != "null" ] || {
      echo "Cannot determine current task definition for $cluster/$service" >&2
      exit 1
    }
    aws ecs describe-task-definition --task-definition "$current_td" --query taskDefinition > "$tmp_dir/current_td.json"
    current_rev=$(jq -er '.revision' "$tmp_dir/current_td.json")
    current_image=$(jq -er --arg name "$service" '.containerDefinitions[] | select(.name == $name) | .image' "$tmp_dir/current_td.json")
    if [ "$current_rev" -le 1 ]; then
      echo "No previous revision exists before ${family}:${current_rev}" >&2
      exit 1
    fi
    min_rev=$(( current_rev > 10 ? current_rev - 10 : 1 ))
    rev=$(( current_rev - 1 ))
    while [ "$rev" -ge "$min_rev" ]; do
      candidate="${family}:${rev}"
      if aws ecs describe-task-definition --task-definition "$candidate" --query taskDefinition > "$tmp_dir/cand_td.json" 2>/dev/null; then
        if verify_task_def_json "$tmp_dir/cand_td.json"; then
          cand_image=$(jq -r --arg name "$service" '.containerDefinitions[] | select(.name == $name) | .image' "$tmp_dir/cand_td.json")
          if [ -n "$cand_image" ] && [ "$cand_image" != "$current_image" ]; then
            target_td=$(jq -r '.taskDefinitionArn // empty' "$tmp_dir/cand_td.json")
            [ -n "$target_td" ] || target_td="$candidate"
            echo "Selected previous stable revision $target_td ($cand_image, replacing $current_image)"
            break
          fi
        fi
      fi
      rev=$(( rev - 1 ))
    done
    if [ -z "$target_td" ]; then
      echo "No active differing previous task definition found in ${family}:${min_rev}..$((current_rev - 1))" >&2
      exit 1
    fi
    ;;

  *)
    echo "Unknown rollback mode: $mode" >&2
    exit 1
    ;;
esac

if [ "$mode" = "--task-definition" ] && [ "$target_td" = "$current_td" ]; then
  active_deployments=$(jq '.services[0].deployments | length' "$tmp_dir/svc.json")
  rollout_state=$(jq -r '.services[0].deployments[0].rolloutState // ""' "$tmp_dir/svc.json")
  if [ "$active_deployments" -eq 1 ] && [ "$rollout_state" = "COMPLETED" ]; then
    echo "Service $service already stable on $target_td; skipping update"
    exit 0
  fi
fi

if [ "$controller" = "CODE_DEPLOY" ]; then
  lb_name=$(jq -r '.services[0].loadBalancers[0].containerName // "tls-proxy"' "$tmp_dir/svc.json")
  lb_port=$(jq -r '.services[0].loadBalancers[0].containerPort // 18443' "$tmp_dir/svc.json")
  app_spec=$(jq -cn --arg td "$target_td" --arg name "$lb_name" --argjson port "$lb_port" '{
    version: 1,
    Resources: [{
      TargetService: {
        Type: "AWS::ECS::Service",
        Properties: {
          TaskDefinition: $td,
          LoadBalancerInfo: { ContainerName: $name, ContainerPort: $port }
        }
      }
    }]
  }')
  revision=$(jq -cn --arg content "$app_spec" '{revisionType:"AppSpecContent",appSpecContent:{content:$content}}')
  dep_id=$(aws deploy create-deployment \
    --application-name "$family" \
    --deployment-group-name "$family" \
    --revision "$revision" \
    --description "Automated rollback to $target_td" \
    --output text --query deploymentId)
  echo "Started CodeDeploy rollback $dep_id -> $target_td"
  aws deploy wait deployment-successful --deployment-id "$dep_id"
  status=$(aws deploy get-deployment --deployment-id "$dep_id" --query 'deploymentInfo.status' --output text)
  if [ "$status" != "Succeeded" ]; then
    echo "::error::CodeDeploy rollback $dep_id for $service ended with status $status"
    exit 1
  fi
else
  aws ecs update-service --cluster "$cluster" --service "$service" --task-definition "$target_td" --force-new-deployment > /dev/null
  aws ecs wait services-stable --cluster "$cluster" --services "$service"
  state=$(aws ecs describe-services --cluster "$cluster" --services "$service" --query "services[0].deployments[?taskDefinition=='$target_td'] | [0].rolloutState" --output text)
  if [ "$state" != "COMPLETED" ]; then
    echo "::error::Rollback of $service to $target_td ended as $state"
    exit 1
  fi
fi

echo "Rolled back $service in $environment to $target_td"
