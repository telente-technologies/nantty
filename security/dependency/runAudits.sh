#!/usr/bin/env bash
# Test name: dependency vulnerability audit (npm/pnpm, Go, Python)
# Target: source tree and lockfiles only (pnpm-lock.yaml, go.work modules, services/python/intelligence/uv.lock)
# Expected behavior: no high/critical advisory in runtime dependencies
# Dangerous behavior: a reachable vulnerable symbol (govulncheck "Your code is affected") or a runtime high advisory
# Cleanup: none; results land in security/audit/evidence/
# Financial safety: SAFE - reads lockfiles and the public advisory databases only
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
evidence="$root/security/audit/evidence"
stamp="$(date +%F)"
cd "$root" && nice -n 10 pnpm audit --prod > "$evidence/pnpmAudit-prod-$stamp.txt" || true
cd "$root/services/go/deployables" && nice -n 10 "${GOVULNCHECK:-govulncheck}" ./... > "$evidence/govulncheck-goDeployables-$stamp.txt" || true
cd "$root/services/python/intelligence"
requirements="$(mktemp)"
uv export --frozen --no-dev --no-hashes --no-emit-project > "$requirements"
nice -n 10 uvx pip-audit -r "$requirements" --no-deps --disable-pip > "$evidence/pipAudit-intelligence-$stamp.txt" 2>&1 || true
rm -f "$requirements"
