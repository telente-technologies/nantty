#!/usr/bin/env bash
# Test name:           Money table snapshot (row counts + per-table checksums)
# Target:              127.0.0.1:15432 via the zudomart-backend-postgres-1 container (read-only SELECTs)
# Expected behavior:   Writes security/audit/snapshots/money-<label>-<ts>.tsv: schema, table, rows, md5 of all rows
#                      ordered by their text form. Compare two snapshots with moneySnapshotDiff in this folder's notes.
# Dangerous behavior:  None; a failure would be a write, which this script never issues.
# Cleanup:             None.
# Financial safety:    SAFE (read-only SQL inside a READ ONLY transaction)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
label="${1:?usage: moneySnapshot.sh <label>}"
out="$ROOT/security/audit/snapshots/money-${label}-$(date -u +%Y%m%dT%H%M%SZ).tsv"
schemas="'ledger','wallet','escrow','payments','subscriptions','creators'"
docker exec -i zudomart-backend-postgres-1 psql -U zudomart -d zudomart -At -F $'\t' -v ON_ERROR_STOP=1 >"$out" <<SQL
BEGIN READ ONLY;
SELECT table_schema, table_name,
  (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text,
  coalesce((xpath('/row/h/text()', query_to_xml(format('SELECT md5(string_agg(t::text, E''\n'' ORDER BY t::text)) AS h FROM %I.%I t', table_schema, table_name), false, true, '')))[1]::text, '-')
FROM information_schema.tables
WHERE table_schema IN ($schemas) AND table_type = 'BASE TABLE'
ORDER BY 1, 2;
COMMIT;
SQL
echo "$out"
rows="${out%.tsv}.rows"
docker exec -i zudomart-backend-postgres-1 psql -U zudomart -d zudomart -At -v ON_ERROR_STOP=1 <<SQL | grep -v '^BEGIN$\|^COMMIT$' | sort >"$rows"
BEGIN READ ONLY;
SELECT table_schema || '.' || table_name || E'\t' || r
FROM information_schema.tables,
LATERAL unnest(xpath('//h/text()', query_to_xml(format('SELECT md5(t::text) AS h FROM %I.%I t', table_schema, table_name), false, false, ''))) AS r
WHERE table_schema IN ($schemas) AND table_type = 'BASE TABLE';
COMMIT;
SQL
echo "$rows"
