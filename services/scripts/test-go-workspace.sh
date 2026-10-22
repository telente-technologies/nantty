#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../go"
packages=$(go list -m -f '{{.Dir}}/...')
go build -p 2 $packages
go vet -p 2 $packages
go test -p 2 -race -count=1 $packages
