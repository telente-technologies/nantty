# Dependency and supply-chain assessment

## Executed / available evidence

- Repository contains pnpm lock/workspace, Go modules/workspace, Python uv lock/configuration, Elixir Mix lock, and Terraform provider lock files.
- **2026-10-29 targeted secret scan:** `gitleaks dir --redact` scanned `apps/admin/src`, `apps/mobile/src`, `apps/webapp/src`, `services/typescript/gateway/src`, `services/go/modules` and `infra/aws/modules`. The first five roots reported zero candidates; Go modules returned 40 redacted candidates: 32 generic-api-key matches, two private-key matches and six JWT matches. Manual triage found the generic strings in test code, one Atlas checksum false positive, and Apple/Google signing material and JWS files under payment `testdata`. The Apple key is used only by a verifier test with placeholder issuer/key IDs and an `httptest` API base; the Google service-account fixture is consumed by tests that replace its token URI with `httptest` and check a fake local publisher endpoint. No production provider credential was confirmed in these scanned paths. This is a scoped source-tree result, not a whole-repository or Git-history scan; test keys remain committed fixtures and should stay strictly synthetic/non-production.
- `osv-scanner`, Semgrep and ZAP CLI were unavailable. The repository audit helper was not run because it invokes package managers/download tools and can change lock state or fetch tools.
- Trivy misconfiguration scan completed only against `infra/aws`, using cached checks and no database update. It emitted 28 raw candidates with duplicates across dev/staging/prod; cached policy parsing errors, development-build version and old cache make the result non-authoritative. Manual validation confirmed AUD-NET-001; intended public ALB and versioned private media/KYC buckets were not treated as vulnerabilities.
- Gitleaks previously scanned selected infra, TypeScript, Elixir, Python, packages and workflow trees with full redaction. It returned 42 candidates; reviewed hits were local RabbitMQ development credentials, test/sample values, or untracked vendored/generated dependency artifacts. A later redacted source-tree pass over `services/go` and every `apps/*/src` directory returned zero findings. Git history and non-source assets/configuration remain unscanned; this is not a clean whole-repository/history result. No secret values were emitted.
- No current dependency advisory count is claimed. Prior Dependabot/PR review evidence is historical and not a replacement for this scan.

## Supply-chain surfaces to review

- Root `pnpm-workspace.yaml` and `pnpm-lock.yaml`; app and TypeScript API dependencies.
- Go `go.work`, deployable/module `go.mod` and `go.sum` files.
- `services/python/intelligence/pyproject.toml` and `uv.lock`.
- `services/elixir/realtime/mix.exs` and `mix.lock`.
- Dockerfiles/base images, GitHub Actions pinned refs, Terraform providers/modules, generated protobuf/Ent code.

## Required follow-up

1. Run a current OSV/Dependabot-compatible scan for each lockfile with network access approved and reports redacted.
2. Scan production container images by digest with an updated Trivy DB; distinguish runtime from build-only packages and pin/fix applicable High/Critical CVEs.
3. Run Gitleaks against Git history and worktree with 100% redaction; triage test fixtures separately and rotate any actual credential found.
4. Review GitHub Actions permissions, pinned action SHAs, OIDC trust conditions, provenance/SBOM verification and artifact promotion.
5. Preserve signed lockfiles and verify reproducible builds; do not install unreviewed scanners into the repository.
