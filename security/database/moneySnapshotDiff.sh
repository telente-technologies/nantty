#!/usr/bin/env bash
# Test name:           Money snapshot diff (historical rows must be unchanged)
# Target:              source tree only (compares two .rows files from moneySnapshot.sh)
# Expected behavior:   Every row hash present before is present after, except in outbox_events and
#                      idempotent_requests (relays and replay caches update those). Prints new rows per table.
# Dangerous behavior:  A missing pre-existing hash in a money table = history was modified or deleted -> STOP.
# Cleanup:             None.
# Financial safety:    SAFE (local file comparison only)
set -euo pipefail
before="${1:?before.rows}"; after="${2:?after.rows}"
changed=$(comm -23 "$before" "$after" | grep -Ev '\.(outbox_events|idempotent_requests)	' || true)
echo "new rows per table:"; comm -13 "$before" "$after" | cut -f1 | sort | uniq -c || true
if [ -n "$changed" ]; then
  echo "HISTORICAL ROWS CHANGED OR DELETED - STOP:"; echo "$changed" | cut -f1 | sort | uniq -c; exit 2
fi
echo "OK: all historical money rows unchanged"
