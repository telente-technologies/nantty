# Nantty Security Release Gate

A release candidate **MUST NOT** be promoted to production until **all Mandatory Gates** below are green. Items marked **CI / STAGING BLOCKED** cannot be bypassed based on local JS/TS test passes alone.

---

## 1. Mandatory Code & Static Gates (Current Status)

| Gate | Status | Evidence |
| --- | --- | --- |
| Backend `<=300` line policy (`check-backend-file-lengths.sh`) | **PASS** | All backend files <= 300 lines |
| `pnpm audit --prod --audit-level=high` | **PASS** | 0 high/critical vulnerabilities |
| Gateway security suite + path confusion (`@nantty/gateway`) | **PASS** | 1,937/1,937 tests pass |
| E2EE cryptographic test vectors (`@nantty/chat-crypto`) | **PASS** | 98/98 tests pass |
| Sandbox isolation & Teredo SSRF (`@nantty/sandbox-service`) | **PASS** *(unit)* | 55/55 pass (2 DB tests skipped) |
| Web BFF security contracts (`admin`, `webapp`, `ads`, `seller`, `studio`, `developer`, `sandbox`) | **PASS** | All targeted security suites pass; `tsc --noEmit` 0 errors |
| Mobile & Messenger JS/TS security suites | **PASS** | `307/307` (`mobile`) + `37/37` (`messenger`) |

---

## 2. Mandatory CI / Staging / External Release Gates (**BLOCKED / PENDING**)

| Gate | Status | Required Action Before Production Launch |
| --- | --- | --- |
| **CI Workflow `.github/workflows/security.yml`** | **PENDING CI** | Full `gitleaks`, `govulncheck`, `pip-audit`, `mix hex.audit`, `trivy-action` (fs & terraform config) green on PR |
| **Go Backend Suites & Race Detector** | **BLOCKED (Env)** | Run `go test -race ./...` across `goIdentity`, `goMoney` (incl. `SEC-2026-001`, `SEC-2026-002`, `flutterwaveFlows`), `goCommerce`, `goAds`, `goLive`, `goTrust` against ephemeral PostgreSQL + Valkey |
| **Prisma TS Services** | **BLOCKED (Env)** | Run `prisma generate` + `vitest run` in `social` (incl. `SEC-2026-003`), `media`, `notifications`, `search`, `support` |
| **Sandbox DB Integration Suites** | **BLOCKED (Env)** | Run `@nantty/sandbox-service` `credentialControl.integration.test.ts` & `webhookControl.integration.test.ts` against PostgreSQL |
| **Elixir & Python Suites** | **BLOCKED (Env)** | Run `mix test` (`realtime`) and `pytest` (`intelligence`) |
| **CI/CD Hardening (`SEC-2026-008`, `SEC-2026-009`)** | **OPEN** | Pin third-party GitHub Actions to commit SHAs; provision & wire `sandbox` deployment in `deploy.yml` before enabling public Sandbox |
| **AWS Terraform & Live Sandbox Smoke (`SEC-2026-011`, `SEC-2026-012`)** | **BLOCKED_EXTERNAL** | Apply `infra/aws/` HAProxy/Private CA mTLS stack; execute live sandbox verification for Flutterwave, Smile ID, Kwikpik, Apple/Google IAP |
| **Native Mobile Store Builds** | **NOT TESTED (Env)** | Execute Android APK/AAB (`.github/workflows/androidApk.yml`) & iOS archive builds on CI runners |
