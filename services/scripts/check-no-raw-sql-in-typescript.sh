#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../typescript"
raw_sql=$(grep -rEn '\$(queryRaw|executeRaw)(Unsafe)?|sql`|\.query\(\s*["'"'"'`](SELECT|INSERT|UPDATE|DELETE)' --include='*.ts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=generated . || true)
sql_files=$(find . -name '*.sql' -not -path '*/node_modules/*' -not -path '*/prisma/migrations/*' || true)
if [ -n "$raw_sql$sql_files" ]; then
  echo "TypeScript services use Prisma only (no raw SQL, no hand-written .sql files):"
  echo "$raw_sql"
  echo "$sql_files"
  exit 1
fi
echo "No raw SQL in TypeScript services."
