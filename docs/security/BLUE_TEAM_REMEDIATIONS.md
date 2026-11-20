# Nantty Blue Team Remediations

This document tracks root-cause Blue Team engineering fixes implemented across waves `SEC-0025`–`SEC-0032` and `SEC-2026-001`–`SEC-2026-014`, plus actionable remediation patches for the two open CI/CD items (`SEC-2026-008`, `SEC-2026-009`).

---

## 1. Remediations Implemented & Verified in Code

| ID | Root Cause & Architectural Fix | Files Modified | Regression Test |
| --- | --- | --- | --- |
| `SEC-2026-001` | Black Government late settlement failed to validate active institutional verification at settlement time. Added fail-closed lookup (`!found \|\| app.Status != "approved" \|\| !app.InstitutionalEmailVerified`) and explicit revocation handling. | `services/go/modules/subscriptions/src/modules/billing/services/renewalSettlement.service.go` | `blackGovernmentBilling_integration_test.go` *(Go CI pending)* |
| `SEC-2026-002` | IAP subscription redemption updated existing rows by `OriginalTransactionId` without enforcing owner/profile identity binding. Added `row.OwnerUserID == request.UserId && row.ProfileID == profile.ProfileId` enforcement. | `services/go/modules/subscriptions/src/modules/billing/services/storeSubscriptions.service.go` | `storeSubscriptionsSecurity_integration_test.go` *(Go CI pending)* |
| `SEC-2026-003` | `publishNow` scheduled post endpoint omitted `canSchedulePosts` entitlement check enforced on sibling endpoints. Added identical `context.premium.canSchedulePosts` guard. | `services/typescript/social/src/modules/posts/controllers/scheduledPosts.controller.ts` | `scheduledPosts.test.ts` *(Prisma CI pending)* |
| `SEC-2026-004` | Developer and Sandbox Next.js configs omitted full CSP/HSTS/COOP/CORP and `/api/:path*` `no-store` headers. Added standardized Next.js security header rules. | `apps/developer/next.config.ts`, `apps/sandbox/next.config.ts` | `apps/developer/tests/securityHeaders.test.ts` (35/35), `apps/sandbox/tests/securityHeaders.test.ts` (1/1) |
| `SEC-2026-005` | Sandbox webhook SSRF IPv6 filter did not reject Teredo `2001::/32` addresses. Added explicit `2001::/32` prefix rejection in `isPublicAddress`. | `services/typescript/sandbox/src/webhookSecurity.ts` | `services/typescript/sandbox/tests/webhookSecurity.test.ts` (55 passed, 2 DB-skipped) |
| `SEC-2026-006` | Gateway allowed `//` protocol-relative or un-collapsed double-slash paths before route matching. Added pre-routing `404` rejection in `upstreamDispatch.handler.ts`. | `services/typescript/gateway/src/handlers/upstreamDispatch.handler.ts` | `services/typescript/gateway/tests/gatewayPathConfusion.test.ts` (7/7; 1,937/1,937 suite) |
| `SEC-2026-007` | Duplicate `"nantty"` deep-link scheme entry in Expo manifest. Deduplicated `scheme` array. | `apps/mobile/app.json` | Config verification |
| `SEC-2026-013` | `apps/admin` `/bff/:path*` omitted `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` while `proxy.ts` bypassed CSP injection for `/bff`. Added strict CSP header on `/bff/:path*`. | `apps/admin/next.config.ts` | `apps/admin/src/contracts/bffGatewayEnforcement.test.ts` (12/12) + `tsc --noEmit` |
| `SEC-2026-014` | `readVerifiedDeveloperSsoRedirect` checked `expected.hostname !== "localhost"` independently of protocol, allowing non-HTTP localhost schemes (`ftp://localhost`, `ws://localhost`). Tightened to `expected.protocol === "https:" \|\| (expected.protocol === "http:" && expected.hostname === "localhost")`. | `apps/webapp/src/server/developerSsoHandoff.service.ts` | `apps/webapp/src/server/developerSsoHandoff.service.test.ts` (2/2) + `tsc --noEmit` |
| `SEC-0025` – `SEC-0032` | Suspended principal block, Messenger auth rate limits, sealed Black institutional OTPs, right-most `X-Forwarded-For` IP parsing, `/api/v1/admin/analytics/` routing, Developer logout revocation, Messenger `allowBackup=false`, Sandbox `..`/`\` rejection. | See `docs/security/REMEDIATION_CHANGELOG.md` | Gateway (1,937), Sandbox (55), Admin IP (3), Developer (35) |

---

## 2. Recommended Patches for Open CI/CD Items

### `SEC-2026-008`: Include `sandbox` in `.github/workflows/deploy.yml`
1. Add `services/typescript/sandbox/Dockerfile` matching sibling Fastify TS services (`gateway`, `social`, `media`, `notifications`, `support`, `search`).
2. Provision `sandbox` ECR repository and isolated ECS service/task definition in `infra/aws/` (pointing to isolated sandbox DB/Valkey).
3. Add `sandbox` to the `deploy.yml` build matrix and staging/prod deployment sequence.

### `SEC-2026-009`: Pin Third-Party GitHub Actions to Full Commit SHAs
Replace mutable tag refs (`@v7.0.1`, `@v6.1.0`, `@v4`, `@v1`) across `.github/workflows/{deploy,security,backend,frontend,androidApk,pages-deploy}.yml` with 40-character commit SHAs + version comments (matching `aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0`).
