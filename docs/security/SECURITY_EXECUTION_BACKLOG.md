# Nantty Security Execution Backlog & Remediation Log

## 1. Prioritized Findings Backlog

| ID | Severity | Title | Affected Location(s) | Status | Verification Evidence |
| --- | --- | --- | --- | --- | --- |
| `SEC-2026-001` | **High** | Black Government late settlement did not fail closed when verification missing or email unverified | `services/go/modules/subscriptions/src/modules/billing/services/renewalSettlement.service.go` | **FIXED (Blue Team)** | Checks `!found \|\| app.Status != "approved" \|\| !app.InstitutionalEmailVerified`; revokes if `app.Status == "revoked"`; regression test added in `blackGovernmentBilling_integration_test.go` (awaiting Go+PG CI run) |
| `SEC-2026-002` | **High** | IAP `RedeemStoreSubscription` lacked `OwnerUserID` & `ProfileID` binding on existing `OriginalTransactionId` updates | `services/go/modules/subscriptions/src/modules/billing/services/storeSubscriptions.service.go` | **FIXED (Blue Team)** | Enforces `row.OwnerUserID == request.UserId` and `row.ProfileID == profile.ProfileId`; regression test added in `storeSubscriptionsSecurity_integration_test.go` (awaiting Go+PG CI run) |
| `SEC-2026-003` | **Medium** | `scheduledPosts.controller.ts` `publishNow` bypassed `canSchedulePosts` paid-entitlement check | `services/typescript/social/src/modules/posts/controllers/scheduledPosts.controller.ts` | **FIXED (Blue Team)** | Enforces `context.premium.canSchedulePosts(...)` matching `reschedule`/`editContent`; test updated in `scheduledPosts.test.ts` (awaiting Prisma-enabled CI run) |
| `SEC-2026-004` | **Medium** | `apps/developer` & `apps/sandbox` lacked CSP, HSTS, COOP/CORP, and `/api/*` `no-store` / `frame-ancestors 'none'` headers | `apps/developer/next.config.ts`, `apps/sandbox/next.config.ts` | **FIXED (Blue Team)** | Added full security header suite + `/api/:path*` isolation headers; verified via `apps/developer/tests/securityHeaders.test.ts` (35/35) & `apps/sandbox/tests/securityHeaders.test.ts` (1/1) + `tsc` |
| `SEC-2026-005` | **Medium** | `sandbox/webhookSecurity.ts` IPv6 filter omitted Teredo `2001::/32` transition range | `services/typescript/sandbox/src/webhookSecurity.ts` | **FIXED (Blue Team)** | Blocked `2001::/32` in `isPublicAddress`; verified via `webhookSecurity.test.ts` (55 passed, 2 DB-gated skipped) |
| `SEC-2026-006` | **Medium** | Gateway accepted protocol-relative `//` URLs and un-collapsed `//` paths prior to upstream routing | `services/typescript/gateway/src/handlers/upstreamDispatch.handler.ts` | **FIXED (Blue Team)** | Rejects `request.url.startsWith("//")` or `request.path.includes("//")` with `404` before routing; verified via `gatewayPathConfusion.test.ts` (1,937/1,937 gateway tests pass) |
| `SEC-2026-007` | **Low** | Duplicate `"nantty"` deep-link scheme entry in mobile Expo config | `apps/mobile/app.json` | **FIXED (Blue Team)** | Removed duplicate `"nantty"` scheme entry |
| `SEC-2026-008` | **Medium** | `sandbox` service omitted from `.github/workflows/deploy.yml` build/deploy matrix | `.github/workflows/deploy.yml` | **OPEN (Infra/Release)** | Documented for release pipeline update when `sandbox` ECS task/ECR repo is provisioned in Terraform |
| `SEC-2026-009` | **Medium** | Non-Trivy GitHub Actions in `.github/workflows/*.yml` use version tags rather than immutable commit SHAs | `.github/workflows/{deploy,frontend,backend,security,androidApk}.yml` | **OPEN (CI Hardening)** | Recommended pinning third-party actions to full commit SHAs (matching `trivy-action`) |
| `SEC-2026-010` | **Info / Policy** | Due scheduled posts published by background job (`publishScheduledPosts.job.ts`) do not re-check expired subscriptions at publish time | `services/typescript/social/src/jobs/publishScheduledPosts.job.ts` | **VERIFIED_INTENTIONAL (Policy Note)** | Existing `scheduledPosts.test.ts` asserts due pre-scheduled posts publish without active `canSchedulePosts`; mutation endpoints (`create`, `reschedule`, `editContent`, `publishNow`) strictly gate entitlement |
| `SEC-2026-011` | **Info / Infra** | Fresh HAProxy 3.2 LTS + Private CA mTLS + ECS blueprint in `infra/aws/SECURITY_DEPLOYMENT.md` awaiting live rollout | `infra/aws/` | **BLOCKED_EXTERNAL** | Pending AWS account / Terraform state apply |
| `SEC-2026-012` | **Info / DevSecOps** | External partner configs (Flutterwave live keys, Smile ID callback verification, Kwikpik, Developer SSO keys) & local Node v22 vs v26 mismatch | `docs/master/NANTTY_BLOCKERS.md` | **BLOCKED_EXTERNAL** | Tracked in master blockers; sandbox runs Node `v22.22.3` (`package.json` requires `>=26.13.0 <27`) |
| `SEC-2026-013` | **Low (Hardening)** | `apps/admin` `/bff/:path*` route headers set `Cache-Control: no-store` but omitted `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (unlike `webapp`/`ads`/`seller`/`developer`/`sandbox`) | `apps/admin/next.config.ts` | **FIXED & VERIFIED (Blue Team)** | Added `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` on `/bff/:path*`; regression test added in `apps/admin/src/contracts/bffGatewayEnforcement.test.ts` (`12/12` pass + `tsc --noEmit`) |
| `SEC-2026-014` | **Low (Hardening)** | `readVerifiedDeveloperSsoRedirect` checked `expected.protocol !== "https:" && expected.hostname !== "localhost"`, allowing non-HTTP schemes (`ftp://localhost`, `ws://localhost`) on localhost | `apps/webapp/src/server/developerSsoHandoff.service.ts` | **FIXED & VERIFIED (Blue Team)** | Restricted exception strictly to `expected.protocol === "http:" && expected.hostname === "localhost"`; regression test added in `apps/webapp/src/server/developerSsoHandoff.service.test.ts` (`2/2` pass + `tsc --noEmit`) |

---

## 2. Final Verification Summary (2026-11-20)

| Check / Suite | Outcome | Notes |
| --- | --- | --- |
| `bash services/scripts/check-backend-file-lengths.sh` | **PASS** | All backend `.go`, `.ts`, `.ex`, `.exs`, `.py` files <= 300 lines |
| `corepack pnpm audit --prod --audit-level=high` | **PASS** | 0 high/critical vulnerabilities |
| `corepack pnpm --filter @nantty/gateway test` + `tsc --noEmit` | **PASS** | 44 test files, **1,937/1,937** tests passed (incl. 7 `gatewayPathConfusion.test.ts` probes) |
| `corepack pnpm --filter @nantty/sandbox-service test` + `tsc --noEmit` | **PASS** | 55 passed, 2 DB-gated integration tests skipped |
| `corepack pnpm --filter @nantty/chat-crypto test` + `tsc --noEmit` | **PASS** | 14 test files, **98/98** tests passed |
| `corepack pnpm --filter @nantty/developer test` + `typecheck` | **PASS** | **35/35** tests passed, 0 TS errors |
| `apps/developer/node_modules/.bin/tsx --test apps/sandbox/tests/*.test.ts` | **PASS** | **1/1** test passed |
| `corepack pnpm --filter @nantty/admin` security contracts + `typecheck` | **PASS** | `bffGatewayEnforcement.test.ts` (**12/12**) + `clientIpAllowlist` / `bffExpiredSession` / `adminAccessRules` / `blackGovernmentContracts` (**23/23**), 0 TS errors |
| `corepack pnpm --filter @nantty/webapp` unit + SSO handoff tests + `typecheck` | **PASS** | `test:units` (**373/373**), `developerSsoHandoff.service.test.ts` (**2/2**), 0 TS errors |
| `corepack pnpm --filter @nantty/ads` security contracts | **PASS** | `bffExpiredSession`, `bffStepUp`, `accountForwardPath`, `reportsPdfExport` (**7/7**) |
| `corepack pnpm --filter @nantty/seller` units & security contracts | **PASS** | `test:units` (**17/17**), `bffExpiredSession` & `storeChatEncryption` (**7/7**) |
| `corepack pnpm --filter @nantty/studio test:contracts` | **PASS** | **111/111** passed |
| `corepack pnpm --filter @nantty/messenger exec tsx --test src/**/*.test.ts` | **PASS** | **37/37** passed |
| `(cd apps/mobile && ./node_modules/.bin/jest src/services/ src/contracts/ --runInBand)` | **PASS** | **69/69** suites, **307/307** tests passed |
| `python3 security/authorization/routeInventory.py` | **PASS (Static)** | 1,324 backend routes, 249 gateway rules; 0 exposed `/internal/*` or unauthenticated mutation gaps |
| `@nantty/social`, `@nantty/media`, `@nantty/notifications`, `@nantty/search`, `@nantty/support` Vitest | **BLOCKED (Env)** | `prisma generate` requires `binaries.prisma.sh` (outside sandbox egress allowlist) |
| Go (`auth`, `users`, `payments`, `wallet`, `orders`, `subscriptions`, `ads`, `live`, `moderation`), Elixir (`realtime`), Python (`intelligence`) suites | **NOT RUN (Env)** | `go`, `mix`, and `pytest` binaries are not installed in sandbox |
