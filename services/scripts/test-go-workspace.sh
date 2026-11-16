#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../go"
while IFS= read -r module_dir; do
  printf '\n==> %s\n' "$module_dir"
  (
    cd "$module_dir"
    build_packages=$(go list -f '{{if .GoFiles}}{{.ImportPath}}{{end}}' ./...)
    while IFS= read -r package; do
      [ -z "$package" ] || go build -p 2 -o /dev/null "$package"
    done <<< "$build_packages"

    while IFS= read -r package; do
      [ -z "$package" ] || go vet -p 2 "$package"
    done <<< "$build_packages"

    test_packages=$(go list -f '{{if or .TestGoFiles .XTestGoFiles}}{{.ImportPath}}{{end}}' ./...)
    while IFS= read -r package; do
      [ -z "$package" ] || go test -p 2 -race -count=1 "$package"
    done <<< "$test_packages"
  )
done < <(go list -m -f '{{.Dir}}')
