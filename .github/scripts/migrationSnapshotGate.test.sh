#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export AURORA_CLUSTER_ID=nantty-staging-aurora RESTORE_JOB_ID=restore-job
export MIGRATE_TASK_DEFINITION=nantty-staging-migrate:1
export GITHUB_SHA=0123456789abcdef GITHUB_RUN_ID=123 GITHUB_RUN_ATTEMPT=2
export MOCK_CLUSTER_ARN=arn:aws:rds:eu-west-1:123456789012:cluster:nantty-staging-aurora
aws() {
  case "$1 $2" in
    'rds describe-db-clusters')
      jq -cn --arg arn "$MOCK_CLUSTER_ARN" '{DBClusters:[{Status:"available",StorageEncrypted:true,DBClusterArn:$arn}]}' ;;
    'backup describe-restore-job')
      jq -cn --arg source "$MOCK_CLUSTER_ARN" --arg date "$(date -u -d "${MOCK_AGE:-1} days ago" --iso-8601=seconds)" --arg status "${MOCK_VALIDATION:-SUCCESSFUL}" \
        '{SourceResourceArn:$source,Status:"COMPLETED",ValidationStatus:$status,ResourceType:"Aurora",CompletionDate:$date,BackupVaultArn:"arn:aws:backup:eu-west-1:123456789012:backup-vault:aurora",RecoveryPointArn:"recovery",CreatedResourceArn:"arn:aws:rds:eu-west-1:123456789012:cluster:restored"}' ;;
    'backup describe-recovery-point')
      jq -cn --arg arn "${MOCK_SOURCE:-$MOCK_CLUSTER_ARN}" '{ResourceArn:$arn,Status:"COMPLETED",IsEncrypted:true}' ;;
    'rds create-db-cluster-snapshot') echo SNAPSHOT_CREATED >&2 ;;
    'rds wait') return 0 ;;
    'rds describe-db-cluster-snapshots')
      jq -cn --arg cluster "$AURORA_CLUSTER_ID" --arg encrypted "${MOCK_ENCRYPTED:-true}" '{DBClusterSnapshots:[{DBClusterIdentifier:$cluster,DBClusterSnapshotIdentifier:"nantty-staging-pre-migration-0123456789ab-123-2",Status:"available",StorageEncrypted:($encrypted == "true"),KmsKeyId:"key"}]}' ;;
    *) echo "Unexpected AWS call: $*" >&2; return 99 ;;
  esac
}
export -f aws
output=$(bash .github/scripts/migrationSnapshotGate.sh staging 2>&1)
[[ "$output" == *'Verified encrypted snapshot'* ]]
for scenario in failed unvalidated stale future wrong-source missing-job unencrypted; do
  (
    case "$scenario" in
      failed) export MOCK_VALIDATION=FAILED ;;
      unvalidated) export MOCK_VALIDATION=VALIDATING ;;
      stale) export MOCK_AGE=8 ;;
      future) export MOCK_AGE=-1 ;;
      wrong-source) export MOCK_SOURCE=another-cluster ;;
      missing-job) unset RESTORE_JOB_ID ;;
      unencrypted) export MOCK_ENCRYPTED=false ;;
    esac
    if output=$(bash .github/scripts/migrationSnapshotGate.sh staging 2>&1); then
      echo "FAIL: accepted $scenario" >&2; exit 1
    fi
    if [[ "$scenario" != unencrypted && "$output" == *SNAPSHOT_CREATED* ]]; then
      echo "FAIL: created snapshot before rejecting $scenario" >&2; exit 1
    fi
  )
done
echo 'PASS: valid restore accepted; seven unsafe cases rejected (mock AWS only)'
