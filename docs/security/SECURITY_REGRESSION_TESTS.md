# Nantty Security Regression Tests Catalog

This catalog records all automated security regression suites across the repository and their current verification state as of `2026-11-20`.

---

## 1. Executed & Verified Regression Suites (Local Sandbox)

| Suite / Package | Command | Result | Security Controls Covered |
| --- | --- | --- | --- |
| `@nantty/gateway` | `corepack pnpm --filter @nantty/gateway test` | **44 files / 1,937 passed** | Path confusion `//` (`SEC-006`), `/internal/*` traversal block, suspended account guard (`SEC-0025`), Messenger auth & rate limits (`SEC-0026`), HMAC identity header signing, Valkey session revocation denylist, widget token scoping, CORS, client IP trust/denylist, ad redirect safety |
| `@nantty/chat-crypto` | `corepack pnpm --filter @nantty/chat-crypto test` | **14 files / 98 passed** | X3DH, Double Ratchet, Sender Keys, Signal-v1 serialization, store team key rotation on member removal, large-group mailbox distribution |
| `@nantty/sandbox-service` | `corepack pnpm --filter @nantty/sandbox-service test` | **7 passed, 2 DB-skipped / 55 passed, 2 skipped** | `..`/`\`/`%2e` control path traversal (`SEC-0032`), IPv4/IPv6 + Teredo `2001::/32` SSRF (`SEC-005`), `ntsb_test_` credential checks |
| `@nantty/developer` | `corepack pnpm --filter @nantty/developer test` | **35 passed** | CSRF Origin + `Sec-Fetch-Site` rejection, S256 PKCE + `state` mismatch, `http` non-localhost prod fail-closed, capability checks before Sandbox calls, logout revocation (`SEC-0030`), CSP & `no-store` headers (`SEC-004`) |
| `apps/sandbox` | `apps/developer/node_modules/.bin/tsx --test apps/sandbox/tests/*.test.ts` | **1 passed** | Portal CSP/HSTS/COOP/CORP + `/api/:path*` `no-store` & `frame-ancestors 'none'` (`SEC-004`) |
| `@nantty/admin` (Security & Contracts) | `corepack pnpm --filter @nantty/admin exec tsx --test src/contracts/bffGatewayEnforcement.test.ts src/contracts/clientIpAllowlist.test.ts src/contracts/bffExpiredSession.test.ts src/contracts/adminAccessRules.test.ts src/contracts/blackGovernmentContracts.test.ts` | **35 passed** (`12` + `23`) | RBAC fail-closed 403/404, CSRF token rejection, destructive reason requirement, single-use money step-up token, privilege-change auto-logout, right-most trusted `X-Forwarded-For` IP parsing (`SEC-0028`), Black Gov zero unpaid grace + USD monthly-only pricing, `/bff/:path*` `no-store` + `CSP: default-src 'none'; frame-ancestors 'none'` (`SEC-2026-013`) |
| `@nantty/webapp` (Units + SSO Handoff) | `corepack pnpm --filter @nantty/webapp test:units` + `developerSsoHandoff.service.test.ts` | **373 + 2 passed** | SSO `redirect_uri` & `state` exact binding, strict `http://localhost` scheme rule rejecting `ws://`/`ftp://`/`localhost.evil` (`SEC-2026-014`) |
| `@nantty/ads` (Security & PDF) | `corepack pnpm --filter @nantty/ads exec tsx --test src/contracts/bffExpiredSession.test.ts src/contracts/bffStepUp.test.ts src/contracts/accountForwardPath.test.ts src/contracts/reportsPdfExport.test.ts` | **7 passed** | Expired token refresh & `SESSION_EXPIRED` cleanup, `STEP_UP_REUSED` handling, `accountForwardPath` open-redirect guard, PDF report RBAC |
| `@nantty/seller` (Units + Security) | `corepack pnpm --filter @nantty/seller test:units` + `bffExpiredSession` + `storeChatEncryption` | **17 + 7 passed** | Expired token refresh, E2EE store inbox ciphertext-only replies, BFF chat key directory gating |
| `@nantty/studio` | `corepack pnpm --filter @nantty/studio test:contracts` | **111 passed** | Studio BFF expired-session enforcement, live rules, realtime & API access guards |
| `@nantty/messenger` | `corepack pnpm --filter @nantty/messenger exec tsx --test src/**/*.test.ts` | **37 passed** | Expired/revoked session cleanup, ciphertext-only story replies, tampered upload chunk plan abort, bubble deep-link confinement |
| `@nantty/mobile` | `(cd apps/mobile && ./node_modules/.bin/jest src/services/ src/contracts/ --runInBand)` | **69 suites / 307 passed** | Decrypted media at rest, encrypted chat sends, IAP native billing mocks, human verification, realtime socket tokens |
| Static & Supply-Chain Checks | `check-backend-file-lengths.sh`, `pnpm audit --prod --audit-level=high`, `routeInventory.py` | **PASS** | `<=300` line limit across Go/TS/Elixir/Python, 0 high/critical npm vulns, 1,324 backend routes inventoried |

---

## 2. Environment-Blocked Suites (Mandatory CI Gates)

- **Prisma TS Services** (`@nantty/social`, `@nantty/media`, `@nantty/notifications`, `@nantty/search`, `@nantty/support`): Blocked locally because `prisma generate` requires outbound access to `binaries.prisma.sh`. Includes `scheduledPosts.test.ts` (`SEC-2026-003`).
- **Sandbox DB Integration Tests**: `credentialControl.integration.test.ts` and `webhookControl.integration.test.ts` (skipped without PostgreSQL).
- **Go Modules & Deployables**: Includes `blackGovernmentBilling_integration_test.go` (`SEC-2026-001`), `storeSubscriptionsSecurity_integration_test.go` (`SEC-2026-002`), `usersBlackOtpDelivery.integration_test.go` (`SEC-0027`), `flutterwaveFlows`, `sellerDevelopers`, `staffauth` — blocked locally (`go` binary absent).
- **Elixir (`realtime`) & Python (`intelligence`)**: Blocked locally (`mix` and `pytest` binaries absent).
- **Pre-existing Unrelated Non-Security Failures Observed in Frontend Contract Glob**:
  - `apps/webapp/src/services/smileIdWebIntegration.service.test.ts:105` (copy mismatch)
  - `apps/webapp/src/contracts/errorExperience.test.ts:72` (404 markup lacks `action="/explore"`)
  - `apps/{ads,admin,seller}/src/contracts/errorScreens.test.ts` (`.module.css` import under `tsx` without CJS style stub hook)
