#!/usr/bin/env bash
# Requires an AWS Backup restore job with successful restore validation. A date
# entered in a GitHub variable is not evidence that the database was restored.
set -euo pipefail
: "${AURORA_CLUSTER_ID:?required}"
: "${RESTORE_JOB_ID:?a validated AWS Backup restore job is required}"
: "${MIGRATE_TASK_DEFINITION:?migration task definition is required}"
: "${GITHUB_RUN_ID:?required}"
: "${GITHUB_RUN_ATTEMPT:?required}"
: "${GITHUB_SHA:?required}"
environment=${1:?environment required}
[[ "$environment" =~ ^(staging|prod)$ ]] || exit 1
cluster=$(aws rds describe-db-clusters --db-cluster-identifier "$AURORA_CLUSTER_ID" --output json)
cluster_arn=$(jq -er '.DBClusters[0] | select(.Status == "available" and .StorageEncrypted == true) | .DBClusterArn' <<< "$cluster")
job=$(aws backup describe-restore-job --restore-job-id "$RESTORE_JOB_ID" --output json)
jq -e --arg source "$cluster_arn" 'select(.Status == "COMPLETED" and .ValidationStatus == "SUCCESSFUL" and .ResourceType == "Aurora" and .SourceResourceArn == $source)' <<< "$job" > /dev/null
completed=$(jq -er '.CompletionDate' <<< "$job")
if [[ "$completed" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  completed_epoch=${completed%%.*}
else
  completed_epoch=$(date -u -d "$completed" +%s)
fi
now=$(date -u +%s)
(( completed_epoch <= now && now - completed_epoch <= 604800 )) || {
  echo 'Restore validation must be completed within the past seven days' >&2; exit 1;
}
vault=$(jq -er '.BackupVaultArn | split(":backup-vault:")[1]' <<< "$job")
recovery_point=$(jq -er '.RecoveryPointArn' <<< "$job")
point=$(aws backup describe-recovery-point --backup-vault-name "$vault" --recovery-point-arn "$recovery_point" --output json)
jq -e --arg arn "$cluster_arn" 'select(.ResourceArn == $arn and .Status == "COMPLETED" and .IsEncrypted == true)' <<< "$point" > /dev/null
restored_arn=$(jq -er '.CreatedResourceArn' <<< "$job")
[[ "$restored_arn" != "$cluster_arn" && "$restored_arn" == *:cluster:* ]] || exit 1
snapshot_id="nantty-${environment}-pre-migration-${GITHUB_SHA:0:12}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
aws rds create-db-cluster-snapshot --db-cluster-identifier "$AURORA_CLUSTER_ID" --db-cluster-snapshot-identifier "$snapshot_id" > /dev/null
aws rds wait db-cluster-snapshot-available --db-cluster-snapshot-identifier "$snapshot_id"
snapshot=$(aws rds describe-db-cluster-snapshots --db-cluster-snapshot-identifier "$snapshot_id" --output json)
jq -e --arg cluster "$AURORA_CLUSTER_ID" --arg snapshot "$snapshot_id" '
  .DBClusterSnapshots[0] | select(.DBClusterIdentifier == $cluster and
  .DBClusterSnapshotIdentifier == $snapshot and .Status == "available" and
  .StorageEncrypted == true and (.KmsKeyId | length > 0))' <<< "$snapshot" > /dev/null
echo "Verified encrypted snapshot $snapshot_id; validated restore job $RESTORE_JOB_ID ($completed)"
