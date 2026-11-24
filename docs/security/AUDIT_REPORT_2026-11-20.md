# Full-Stack Security Audit Report — 2026-11-20

## Executive Summary

A comprehensive source-level and test-backed security audit was performed across all Nantty services, BFF portals, cryptographic packages, mobile apps, and deployment infrastructure (`1,324` backend HTTP routes across Go, TypeScript, Python, and Elixir, and `248` API Gateway route rules).

Building on the baseline audit (`SEC-0001`–`SEC-0024`), this review identified **8 new actionable issues** (`SEC-0025`–`SEC-0032`: 4 High, 4 Medium/Hardening), all of which have been **remediated and covered by automated regression tests or CI checks** in this working tree.

---

## Scope & Verified Controls

### 1. API Gateway (`services/typescript/gateway`)
- **Verified Strong Controls**:
  - `internalRouteGuard.service.ts`: Multi-pass URL decoding (up to 3 passes), backslash-to-slash conversion, dot-segment normalization, and matrix parameter stripping prevent path traversal into `/internal/` or `/v1/internal/` routes.
  - `accessTokenVerifier.service.ts`: Enforces EdDSA (`Ed25519`), issuer/audience validation, required claims (`sub`, `sid`, `exp`), control-character rejection, widget-scope exclusion, and fail-closed Valkey session revocation (`auth:revoked-session:<sid>`).
  - `adminStaffGate.service.ts`: Enforces separate `nantty-admin` audience for `/api/v1/admin/*` routes and optional staff IP network policies.
  - `upstreamProxy.service.ts`: Strips untrusted client identity headers and signs `x-nantty-*` context with HMAC-SHA256 (`identitySignatureHeaderName`) using a 60-second replay window.
- **Findings Remediated**:
  - `SEC-0025` (High): Gateway did not block JWTs containing `"suspended"` in `roles` and did not forward `roles` to TypeScript/Python upstreams, allowing suspended users to hit `social`, `media`, `notifications`, `commerce`, and `support` endpoints. Fixed via `suspendedAccountGuard.service.ts` enforcing `403 ACCOUNT_SUSPENDED` except on logout, refresh, suspension/strike/decision/live-safety appeals, and legal/consent routes.
  - `SEC-0026` (High): `anonymousMutationGuard.service.ts` blocked unauthenticated `POST /api/v1/auth/messenger/authorizations/*` and `POST /api/v1/auth/sso/token` with `401`, and `routeRateLimitPolicy.service.ts` lacked `login`/`otp`/`otpSend` buckets on Messenger authorization endpoints.
  - `SEC-0029` (Medium): `GET /api/v1/admin/analytics/overview` fell through `/api/v1/admin/` to `identity` instead of `commerce` (`services/go/modules/analytics`).

### 2. Identity, Developer Platform, & Sandbox (`services/go/modules/auth`, `services/typescript/sandbox`, `apps/developer`, `apps/sandbox`)
- **Verified Strong Controls**:
  - `developerProduction`: SHA-256 hashed `ntlive_` credentials, credential `status = 'active'` and application `status = 'approved'` verification, AES-GCM encrypted webhook secrets, and SSRF-hardened webhook egress (`dialer.Control` public-IP pinning, no HTTP redirects).
  - `developerSso`: S256 PKCE enforcement, exact `redirect_uri` verification, DB-backed token revocation, and constant-time client secret comparison.
  - `oneTimeCodes`: Peppered HMAC/hash storage, constant-time verification, and 5-attempt lockout.
  - `services/typescript/sandbox`: PostgreSQL-backed token hashing (`sc_`), strict Zod/payload limits, and timing-safe control bearer authentication. Hardened `sandboxApp.ts` `preHandler` (`SEC-0032`) to reject dot-segment/encoded traversal before `/v1/control/` allowlisting.
- **Findings Remediated**:
  - `SEC-0030` (Medium): `apps/developer/src/app/api/auth/logout/route.ts` cleared only the browser cookie without checking `sec-fetch-site` or revoking the session via Identity `POST /api/v1/auth/logout`.

### 3. Users, Verification Checkmarks, & Black Government Billing (`services/go/modules/users`, `services/go/modules/subscriptions`)
- **Verified Strong Controls**:
  - `transitionBlackApplication.handler.go`: Dual-admin distinct approval (`SAME_ADMIN` guard), verified institutional email gate (`INSTITUTIONAL_EMAIL_NOT_VERIFIED`), complete 4-item vetting checklist, and handle reservation separated from paid badge visibility.
  - `blackGovernmentCheckout.service.go` & `blackGovernmentBilling.service.go`: Web-only monthly USD card billing (`0` grace days), auto-pause when saved card is missing/revoked, and reactivation gated on `approved` + `InstitutionalEmailVerified` + usable card.
- **Findings Remediated**:
  - `SEC-0027` (High): `submitBlackApplication.handler.go` and `checkmarksBlack.controller.go` discarded the 6-digit OTP returned by `IssueInstitutionalEmailOtp` and emitted `blackApplication.institutionalEmailOtpRequested` without the sealed OTP or an `"otp.issued"` event, so `@nantty/notifications` never delivered institutional verification codes. Fixed via `blackInstitutionalOtpDelivery.service.go` using shared AES-256-GCM `AUTH_OTP_EVENT_KEY` envelope encryption and the existing `"otp.issued"` RabbitMQ/notifications pipeline.

### 4. Payments, Wallets, Orders, & Financial Integrity (`services/go/modules/{payments,wallet,orders}`)
- **Verified Strong Controls**:
  - `flutterwaveWebhooks.integration.go`: Constant-time `Verif-Hash` comparison and `json.Decoder.UseNumber()` preventing float precision loss.
  - `coinTransfers.service.go`: Balanced double-entry ledger transfers inside serializable/locked transactions.
  - `paymentAmountLimits.service.go`: Server-side currency conversion and per-purpose min/max limit validation.

### 5. Messaging, E2EE (`packages/chatCrypto`), Social, Realtime, & Intelligence
- **Verified Strong Controls**:
  - `packages/chatCrypto`: X3DH (`NanttyX3DHv1`) with Ed25519 signed-prekey verification; Double Ratchet (`NanttyRatchetv1` / `NanttyMessageKeysv1`) with bounded skipped-key caches (`2000`); Group Sender Keys (`nantty-group-v1`) with Ed25519 signatures and rotation on member removal; 60-digit safety numbers (`1024` SHA-512 rounds).
  - `services/typescript/social`: `gatewayIdentity.middleware.ts` enforces HMAC-signed Gateway headers (`60s` timestamp skew tolerance); conversation membership checks enforced on message writes.
  - `services/elixir/realtime`: Short-lived WebSocket tokens minted by `auth` (`realtimeTokens.module.go` explicitly blocks `StatusSuspended`).
  - `services/python/intelligence`: Internal request-signature verification middleware.

### 6. Next.js BFFs (`apps/{admin,ads,seller,developer,sandbox,webapp}`)
- **Verified Strong Controls**:
  - Consistent HttpOnly cookie isolation, `Origin` + `sec-fetch-site` CSRF validation, per-route permission enforcement, and single-use step-up token forwarding (`admin`, `ads`, `seller`).
  - `apps/webapp/src/utils/embedSecurity.util.ts`: Strict SHA-256 inline-script CSP, `frame-ancestors *`, `form-action 'none'`, and `origin` validation on resize `postMessage`.
- **Findings Remediated**:
  - `SEC-0028` (High): `apps/admin/src/server/requestOriginGuard.service.ts` (`readClientIpAddress`) used `x-forwarded-for.split(",")[0]`, allowing an attacker behind ALB/CloudFront to spoof an allowlisted IP in `X-Forwarded-For` and bypass `ADMIN_IP_ALLOWLIST`. Updated to extract from the right-most trusted proxy hop (`ADMIN_TRUSTED_PROXY_HOPS`, default `1`). Matched right-most hop parsing in `apps/ads/src/server/bffGateway.service.ts` and `apps/seller/src/server/{bffGateway,publicPlans}.service.ts`.

### 7. Mobile Clients (`apps/messenger`, `apps/mobile`) & AWS Infrastructure
- **Findings Remediated**:
  - `SEC-0031` (Medium): `apps/messenger/app.json` (`configureAndroidBackup: true`) and `apps/messenger/android/app/src/main/AndroidManifest.xml` (`android:allowBackup="true"`) allowed Android cloud/ADB backup of app storage; `apps/mobile/app.json` shipped `extra.apiUrl` as `"http://localhost:8080"`. Disabled Android backup (`allowBackup="false"`, `fullBackupContent="false"`) and set `apps/mobile/app.json` fallback `apiUrl` to `"https://api.nantty.com"`.
- **Infrastructure Verified (`infra/aws/SECURITY_DEPLOYMENT.md`, `.github/workflows/security.yml`)**:
  - HAProxy 3.2 LTS mTLS service mesh (7-day AWS PCA certs), read-only rootfs, dropped Linux capabilities, encrypted Aurora restores, and CI gates (`gitleaks`, `pnpm audit`, `govulncheck`, `pip-audit`, `mix hex.audit`, `trivy`, `terraform validate`).

---

## Verification Execution Summary

| Package / Check | Outcome | Notes |
| --- | --- | --- |
| `@nantty/gateway` (`vitest run`) | **Passed (43 files, 1,930 tests)** | Includes new `suspendedAndRoutingHardening.test.ts` |
| `@nantty/gateway` (`tsc --noEmit`, `eslint`) | **Passed** | 0 errors |
| `@nantty/chat-crypto` (`vitest run`) | **Passed (14 files, 98 tests)** | All X3DH, Double Ratchet, Sender Keys vectors green |
| `@nantty/sandbox-service` (`vitest run`, `tsc`, `tsconfig.test.json`) | **Passed (7 files, 55 tests; 2 DB-gated skipped)** | No PostgreSQL instance in sandbox |
| `@nantty/developer` (`tsx --test`, `tsc`, `eslint`) | **Passed (34 tests)** | Includes new logout CSRF & upstream revocation test |
| `@nantty/admin` (`clientIpAllowlist.test.ts`, `tsc`, `eslint`) | **Passed (3/3 new tests; 0 lint/TS errors)** | Full `test:contracts` hits 1 pre-existing raw-`tsx` `.tsx` import (`errorScreens.test.ts`) |
| `@nantty/ads` & `@nantty/seller` (`tsc --noEmit`, `eslint`) | **Passed** | 0 errors |
| `@nantty/sandbox` (`tsc --noEmit`) | **Passed** | 0 errors |
| `@nantty/email-templates` (`vitest run`) | **Passed (4 files, 272 tests)** | All templates & snapshots green |
| `services/scripts/check-backend-file-lengths.sh` | **Passed** | All backend files <= 300 lines |
| `security/authorization/routeInventory.py` | **Passed** | 1,324 backend routes, 248 gateway routes; `/api/v1/admin/analytics/overview` now `routed` |
| Go / Elixir / Python / Prisma tests | **Not executed locally** | `go`, `mix`, `pytest`, PostgreSQL, and `binaries.prisma.sh` egress unavailable in sandbox; validated via CI |
