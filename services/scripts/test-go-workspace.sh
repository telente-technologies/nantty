#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../go"

emit_error_annotation() {
  local title="$1"
  local logfile="$2"
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    local summary
    summary=$(grep -B 6 -A 2 -E '^(--- FAIL:|panic:|FAIL[[:space:]]|# )' "$logfile" | head -n 50 || true)
    if [ -z "$summary" ]; then
      summary=$(tail -n 30 "$logfile")
    fi
    summary=${summary//'%'/'%25'}
    summary=${summary//$'\r'/'%0D'}
    summary=${summary//$'\n'/'%0A'}
    printf '::error title=%s::%s\n' "$title" "$summary"
  fi
}

while IFS= read -r module_dir; do
  printf '\n==> %s\n' "$module_dir"
  (
    cd "$module_dir"
    tmp_log=$(mktemp)
    trap 'rm -f "$tmp_log"' EXIT

    if ! go build -p 2 ./... 2>&1 | tee "$tmp_log"; then
      emit_error_annotation "go build failed in $module_dir" "$tmp_log"
      exit 1
    fi

    if ! go vet -p 2 ./... 2>&1 | tee "$tmp_log"; then
      emit_error_annotation "go vet failed in $module_dir" "$tmp_log"
      exit 1
    fi

    test_packages=$(go list -f '{{if or .TestGoFiles .XTestGoFiles}}{{.ImportPath}}{{end}}' ./...)
    while IFS= read -r package; do
      [ -z "$package" ] || {
        printf 'testing %s\n' "$package"
        if ! go test -p 2 -race -count=1 -timeout 20m "$package" 2>&1 | tee "$tmp_log"; then
          emit_error_annotation "go test failed: $package" "$tmp_log"
          exit 1
        fi
      }
    done <<< "$test_packages"
  )
done < <(go list -m -f '{{.Dir}}')
