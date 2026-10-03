#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../go"
packages=$(go list -m -f '{{.Dir}}/...')
go build $packages
go vet $packages
go test $packages
