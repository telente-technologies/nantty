#!/usr/bin/env bash
set -euo pipefail

environment=${1:?environment required}
output_file=${2:?output file required}
shift 2

[[ "$environment" =~ ^(staging|prod)$ ]] || {
  echo "Invalid environment: $environment" >&2
  exit 1
}
[ "$#" -gt 0 ] || {
  echo "At least one service name is required" >&2
  exit 1
}

cluster="nantty-${environment}"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

echo '{}' > "$tmp_dir/revisions.json"

for service in "$@"; do
  [[ "$service" =~ ^[a-z0-9-]+$ ]] || {
    echo "Invalid service name: $service" >&2
    exit 1
  }
  task_def=$(aws ecs describe-services \
    --cluster "$cluster" \
    --services "$service" \
    --query 'services[0].deployments[?status==`PRIMARY`] | [0].taskDefinition' \
    --output text)
  if [ -z "$task_def" ] || [ "$task_def" = "None" ]; then
    task_def=$(aws ecs describe-services \
      --cluster "$cluster" \
      --services "$service" \
      --query 'services[0].taskDefinition' \
      --output text)
  fi
  if [ -z "$task_def" ] || [ "$task_def" = "None" ]; then
    echo "Unable to determine active task definition for $cluster/$service" >&2
    exit 1
  fi
  jq --arg svc "$service" --arg td "$task_def" '. + {($svc): $td}' "$tmp_dir/revisions.json" > "$tmp_dir/next.json"
  mv "$tmp_dir/next.json" "$tmp_dir/revisions.json"
done

mkdir -p "$(dirname "$output_file")"
cp "$tmp_dir/revisions.json" "$output_file"
echo "Captured pre-deploy revisions for $# services in $output_file"
