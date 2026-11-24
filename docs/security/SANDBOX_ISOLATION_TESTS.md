# Nantty Developer & API Sandbox Isolation Assessment

- **Scope**: `services/typescript/sandbox` (`@nantty/sandbox-service`), `apps/sandbox`, `apps/developer`, `services/go/modules/auth/src/modules/developerProduction`, and Gateway developer/sandbox routes.
- **Verification Basis**: Live local execution of `@nantty/sandbox-service` (`vitest run`: 55 passed, 2 DB-gated skipped), `@nantty/developer` (`tsx --test`: 35/35), `apps/sandbox` (`1/1`), and Gateway (`1,937/1,937`), plus static review of Go `developerProduction`.

---

## 1. Tenant, Credential & Environment Isolation Controls

| Boundary | Control Tested / Inspected | Evidence & Status |
| --- | --- | --- |
| **Credential Prefix Separation** | `apps/sandbox/src/server/sandboxExplorerProxy.ts` enforces `^ntsb_test_[A-Za-z0-9_-]{32,128}$` and rejects production keys; `@nantty/developer` (`developerAuthProxy.test.ts`) rejects non-sandbox hosts and requires explicit `credentials.manage` Identity capability before touching Sandbox. | **PASS** (`35/35` developer tests, `55/55` sandbox tests) |
| **Production Credential Gate** | `services/go/modules/auth/src/modules/developerProduction` `authenticateLiveCredential` checks both `c.status = 'active'` and `a.status = 'approved'`; local portal cookie is rejected for production SSO. | **PASS** (Static Go inspection + Developer test #18) |
| **Control Plane Path Traversal (`SEC-0032`)** | `services/typescript/sandbox/src/sandboxApp.ts` `preHandler` strips query strings and rejects `..`, `\`, and `%2e` before `/readyz` and `/v1/control/*` exemptions. | **PASS** (`sandboxApp.test.ts` 12/12) |
| **Webhook SSRF & Teredo Block (`SEC-005`)** | `services/typescript/sandbox/src/webhookSecurity.ts` blocks private/loopback/link-local/CGNAT/NAT64/6to4/ULA/IPv4-mapped AND Teredo (`2001::/32`) IPv6 ranges; `sandboxExplorerProxy.ts` uses `redirect: "error"` and 10s abort timeout. | **PASS** (`webhookSecurity.test.ts` 14/14) |
| **Portal HTTP Security Headers (`SEC-004`)** | `apps/developer/next.config.ts` and `apps/sandbox/next.config.ts` enforce CSP, HSTS, X-Frame-Options, COOP/CORP, and `/api/:path*` `Cache-Control: no-store` + `CSP: default-src 'none'; frame-ancestors 'none'`. | **PASS** (`35/35` & `1/1`) |
| **Deployment Pipeline Gap (`SEC-2026-008`)** | `services/typescript/sandbox` is currently omitted from `.github/workflows/deploy.yml` matrix/rollout and lacks a dedicated `Dockerfile`/ECS task in `infra/aws/`. | **OPEN (Infra/Release)** |

---

## 2. Database-Gated Sandbox Integration Tests (Skipped Locally)

The following two `@nantty/sandbox-service` integration suites are intentionally skipped when `TEST_DATABASE_URL` / local PostgreSQL is absent and **must execute in CI**:
- `tests/credentialControl.integration.test.ts` (1 test skipped)
- `tests/webhookControl.integration.test.ts` (1 test skipped)
