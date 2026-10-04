#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
maximum_lines=300
offenders=$({ find go typescript elixir python \
  \( -path '*/node_modules' -o -path '*/internal/ent' -o -path '*/generated' -o -path '*/deps' -o -path '*/_build' -o -path '*/dist' -o -path '*/gen' -o -path '*/migrations' -o -path '*/.venv' \) -prune -o \
  -type f \( -name '*.go' -o -name '*.ts' -o -name '*.ex' -o -name '*.exs' -o -name '*.py' \) -print 2>/dev/null || true; } \
  | while read -r file; do
      lines=$(wc -l < "$file")
      if [ "$lines" -gt "$maximum_lines" ]; then echo "$lines $file"; fi
    done)
if [ -n "$offenders" ]; then
  echo "Backend files must be at most ${maximum_lines} lines:"
  echo "$offenders"
  exit 1
fi
echo "All backend files are at most ${maximum_lines} lines."
