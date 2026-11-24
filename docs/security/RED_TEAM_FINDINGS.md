# Nantty Red Team Findings Log

All findings below were discovered through authorized white-box static analysis, route-table differential auditing, and controlled local test-harness probing. **Zero production or external systems were probed.**

---

## 1. Active & Remediated Findings (`SEC-2026-001` – `SEC-2026-014`)

### `SEC-2026-001` — Black Government Late Settlement Bypass on Missing/Revoked Verification (High — **FIXED**)
- **Attack Vector**: A Black Government organization obtains approval, starts monthly billing, and subsequently has institutional verification revoked (`status = "revoked"`), missing, or email-unverified (`institutionalEmailVerified = false`). A delayed webhook/renewal settlement arriving later could reactivate the entitlement if settlement failed to re-check current verification state.
- **Root Cause**: `services/go/modules/subscriptions/src/modules/billing/services/renewalSettlement.service.go` did not fail closed on `!found || app.Status != "approved" || !app.InstitutionalEmailVerified`.
- **Status**: Fixed in code with integration test `blackGovernmentBilling_integration_test.go` (Go runtime verification pending CI).

### `SEC-2026-002` — Cross-Account IAP Subscription Takeover via `OriginalTransactionId` (High — **FIXED**)
- **Attack Vector**: An attacker attempts to redeem an existing Apple/Google `OriginalTransactionId` (e.g., replay or cross-profile redemption) to rebind an active subscription record to a different `UserId` or `ProfileId`.
- **Root Cause**: `services/go/modules/subscriptions/src/modules/billing/services/storeSubscriptions.service.go` (`RedeemStoreSubscription`) updated existing subscription rows without verifying `row.OwnerUserID == request.UserId` and `row.ProfileID == profile.ProfileId`.
- **Status**: Fixed in code with integration test `storeSubscriptionsSecurity_integration_test.go` (Go runtime verification pending CI).

### `SEC-2026-003` — `publishNow` Bypassed Paid Scheduling Entitlement (Medium — **FIXED**)
- **Attack Vector**: User whose scheduling entitlement lapsed after scheduling a post invokes `POST /api/v1/posts/:postId/schedule/publish-now` directly.
- **Root Cause**: `services/typescript/social/src/modules/posts/controllers/scheduledPosts.controller.ts` enforced `canSchedulePosts` on `create`, `reschedule`, and `editContent`, omitting `publishNow`.
- **Status**: Fixed in code + `scheduledPosts.test.ts` updated (Prisma Vitest run blocked in sandbox by `binaries.prisma.sh` egress restriction).

### `SEC-2026-004` — Missing Defense-in-Depth Headers on Developer & Sandbox Portals (Medium — **FIXED & VERIFIED**)
- **Attack Vector**: Framing, MIME-sniffing, or cached `/api/*` token/secret responses on `apps/developer` and `apps/sandbox`.
- **Status**: Fixed in `apps/developer/next.config.ts` & `apps/sandbox/next.config.ts`; verified (`35/35` & `1/1`).

### `SEC-2026-005` — SSRF Filter Gap for Teredo IPv6 (`2001::/32`) in Sandbox Webhooks (Medium — **FIXED & VERIFIED**)
- **Attack Vector**: Developer supplies a `2001::/32` Teredo IPv6 address to `POST /v1/webhooks` in `services/typescript/sandbox` to tunnel to internal IPv4 targets.
- **Status**: Fixed in `services/typescript/sandbox/src/webhookSecurity.ts`; verified via `webhookSecurity.test.ts` (`55 passed, 2 DB-skipped`).

### `SEC-2026-006` — Protocol-Relative `//` & Un-Collapsed `//` Path Confusion at Gateway (Medium — **FIXED & VERIFIED**)
- **Attack Vector**: Requests such as `//evil.example/api/v1/...` or `/api/v1//internal/x` reaching downstream path parsing before normalization.
- **Status**: Fixed in `services/typescript/gateway/src/handlers/upstreamDispatch.handler.ts`; verified via `gatewayPathConfusion.test.ts` (`1,937/1,937` gateway tests pass).

### `SEC-2026-007` — Duplicate Deep-Link Scheme Entry in Mobile Expo Config (Low — **FIXED**)
- **Location**: `apps/mobile/app.json` (`scheme` array contained `"nantty"` twice). Removed duplicate.

### `SEC-2026-008` — `sandbox` Service Omitted from `.github/workflows/deploy.yml` (Medium — **OPEN**)
- **Risk**: `services/typescript/sandbox` is excluded from automated ECR/ECS build and rollout loops in `deploy.yml`, risking drift or unpatched deployments once `sandbox` ECS infra is provisioned.

### `SEC-2026-009` — Non-Trivy CI Actions Pinned to Mutable Tags (Medium — **OPEN**)
- **Location**: `.github/workflows/{deploy,frontend,backend,security,androidApk}.yml` use `@v7.0.1`, `@v6`, etc. rather than immutable 40-char commit SHAs (unlike `aquasecurity/trivy-action@ed142fd...`).

### `SEC-2026-013` — `apps/admin` `/bff/:path*` Missing Strict `Content-Security-Policy` (Low Hardening — **FIXED & VERIFIED**)
- **Detail**: `apps/admin/src/proxy.ts` fast-paths `/bff` to `NextResponse.next()` after IP allowlist validation, and `apps/admin/next.config.ts` only attached `Cache-Control: no-store` to `/bff/:path*` (omitting `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` enforced on `webapp`, `ads`, `seller`, `developer`, and `sandbox`).
- **Status**: Fixed in `apps/admin/next.config.ts` and verified via new test in `apps/admin/src/contracts/bffGatewayEnforcement.test.ts` (`12/12` pass).

### `SEC-2026-014` — Developer SSO Redirect URI Validator Checked `localhost` Without `http:` Scheme Binding (Low Hardening — **FIXED & VERIFIED**)
- **Detail**: `apps/webapp/src/server/developerSsoHandoff.service.ts` checked `if (expected.protocol !== "https:" && expected.hostname !== "localhost") return null;`, permitting non-HTTP schemes like `ws://localhost` or `ftp://localhost` to satisfy the localhost exception.
- **Status**: Fixed to require `expected.protocol === "https:" || (expected.protocol === "http:" && expected.hostname === "localhost")` and verified via `apps/webapp/src/server/developerSsoHandoff.service.test.ts` (`2/2` pass).

---

## 2. Prior Baseline Findings (`SEC-0025` – `SEC-0032`) Summary

See `docs/security/REMEDIATION_CHANGELOG.md` for full records:
- `SEC-0025` (High, **FIXED & VERIFIED**): Gateway blocks `"suspended"` JWT principals from TS/Python upstreams (`suspendedAndRoutingHardening.test.ts`).
- `SEC-0026` (High, **FIXED & VERIFIED**): Messenger device auth & strict rate limits in Gateway.
- `SEC-0027` (High, **FIXED**): Black institutional email OTP sealed delivery via AES-256-GCM (`usersBlackOtpDelivery.integration_test.go`, pending Go CI).
- `SEC-0028` (High, **FIXED & VERIFIED**): Right-most trusted hop `X-Forwarded-For` parsing in `admin`/`ads`/`seller` (`clientIpAllowlist.test.ts` 3/3).
- `SEC-0029`–`SEC-0032` (Medium/Low, **FIXED & VERIFIED**): `/api/v1/admin/analytics/` upstream fix, Developer logout CSRF + Identity revocation (`34/34`), Messenger `allowBackup="false"` & Mobile prod API URL, Sandbox `preHandler` dot-segment rejection (`55/55`).

---

## 3. Cleared Potential False Positives (Verified Safe via Source Inspection)

| Area Investigated | Outcome | Verification Basis |
| --- | --- | --- |
| Dangerous sinks (`eval`, `new Function`, `$queryRawUnsafe`, `exec.Command`) | **Cleared** | Workspace grep returned 0 hits across `apps/`, `services/`, `packages/`. |
| `math/rand/v2` in Go | **Cleared** | Used solely for HTTP retry jitter (`providerHttp.client.go`) and AMQP reconnect jitter (`rabbitmq.connection.go`); all secrets/tokens use `crypto/rand`. |
| Ads PDF/CSV export injection (`PAR-014`) | **Cleared** | `pdfDocument.service.go` (`pdfEscape`) escapes `\`, `(`, `)` and clamps non-ASCII/control chars; `csvExport.service.go` (`SanitizeCsvCell`) neutralizes `=+-@` formula prefixes. |
| Store team request accept/decline (`PAR-012`) & self-untag (`PAR-013`) | **Cleared** | `respondToTeamRequest.handler.go` scopes by `AccountID` + `Status("invited")` + `ForUpdate()`; `postTags.controller.ts` requires auth and uses `principal.accountId`. |
| Social `authentication: "optional"` routes | **Cleared** | Read-only public feeds/posts or `internal-token`-guarded endpoints (plus bounded click recording). |
| `routeInventory.py` 11 `UPSTREAM MISMATCH` & 6 non-intelligence `UNROUTED` alerts | **Cleared** | Verified in `verificationMoney.routes.ts`, `developerOrganization.routes.ts`, `widget.routes.ts`, and `upstreamDispatch.handler.ts`. |
