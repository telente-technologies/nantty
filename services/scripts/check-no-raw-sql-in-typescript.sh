#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../typescript"
allowed_file="./search/src/repositories/searchQueries.repository.ts"
pattern='\$(queryRaw|executeRaw)(Unsafe)?|sql`|\.query\(\s*["'"'"'`](SELECT|INSERT|UPDATE|DELETE)'
allowed_paths='^\./(search/src/repositories/searchQueries\.repository\.ts|social/src/modules/reports/services/reportRateLimit\.service\.ts|social/tests/reports/(reportRateLimit|reportAndBlock)\.test\.ts|sandbox/(src|tests)/)'
raw_sql=$(grep -rEn "$pattern" --include='*.ts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=generated . | grep -Ev "$allowed_paths" || true)
unsafe=$(grep -rEn '\$(queryRaw|executeRaw)Unsafe|Prisma\.raw|\.query\(' --include='*.ts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=generated "$allowed_file" || true)
sql_files=$(find . -name '*.sql' -not -path '*/node_modules/*' -not -path '*/prisma/migrations/*' || true)
if [ -n "$raw_sql$unsafe$sql_files" ]; then
  echo "TypeScript services use Prisma, except for parameterized report locking, isolated Sandbox SQL, and parameterized Prisma.sql in $allowed_file:"
  echo "$raw_sql"
  echo "$unsafe"
  echo "$sql_files"
  exit 1
fi
echo "No unapproved raw SQL in TypeScript services."
