# Nantty System Assessment Inventory (Phase 0 Baseline)

- **Assessment Date**: 2026-11-20 (branch `arena/341bf572-nantty`, base `3954249590693c2de112193169cdc2d26094b39f`)
- **Scope**: Full-stack white-box architecture, trust-boundary, threat-surface, Red Team, and Blue Team security verification across web apps, mobile apps, shared packages, TypeScript/Go/Elixir/Python services, CI/CD workflows, and AWS Terraform IaC.

---

## 1. Application & Package Inventory

| Component | Path | Stack / Runtime | Primary Responsibility | Trust / Auth Boundary |
| --- | --- | --- | --- | --- |
| Public Web / Marketing | `apps/web` | Next.js 16 (`^16.4.5`) | Public landing, legal, locale visitor detection | Unauthenticated public origin; strict CSP & static security headers |
| Consumer Webapp | `apps/webapp` | Next.js 16 (`^16.4.5`) | Feed, chat, live, commerce, verification, developer SSO handoff | HttpOnly cookies (`nantty_web_*`), BFF `/bff/*` + `/api/v1/auth/sso/authorize`, per-request CSP nonce |
| Seller Dashboard | `apps/seller` | Next.js 16 (`^16.4.5`) | Store ops, catalog, orders, wallet/payouts, E2EE store inbox | Store-scoped BFF (`/bff/*`), step-up enforcement, CSRF origin guard |
| Creator Studio | `apps/studio` | Next.js 16 (`^16.4.5`) | Live stream setup, WHIP ingest, overlays, creator analytics | BFF `/bff/*`, CSP permitting WHIP ingest + WSS realtime |
| Admin Console | `apps/admin` | Next.js 16 (`^16.4.5`) | Staff operations, KYC/Black review, finance, trust & safety | IP allowlist (`adminNetwork`), staff JWT + MFA + single-use step-up, `no-store`, `noindex` |
| Ads Manager | `apps/ads` | Next.js 16 (`^16.4.5`) | Ad account chooser, campaigns, creatives, billing top-ups | Ad-account-scoped BFF (`/bff/*`), `isSafeAccountForwardPath`, CSRF origin guard |
| Developer Portal | `apps/developer` | Next.js 16 (`^16.4.5`) | Dev orgs, API keys, webhooks, SSO handoff, production business API | Local portal cookie + production SSO cookie, `/api/*` BFF with CSRF & capability checks |
| API Sandbox Portal | `apps/sandbox` | Next.js 16 (`^16.4.5`) | Isolated sandbox explorer & webhook testing | Isolated `SANDBOX_CONTROL_TOKEN` / explorer proxy; separate from production data |
| Mobile App | `apps/mobile` | React Native / Expo | Consumer + creator + seller mobile client, Apple/Google IAP, biometrics | Expo SecureStore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), custom schemes `nantty`, `com.nantty.app` |
| Messenger App | `apps/messenger` | React Native / Expo | Dedicated E2EE messenger client | SecureStore keys, trusted-device authorization, Signal-v1 / Double Ratchet / Sender Keys |
| E2EE Crypto Library | `packages/chatCrypto` | TypeScript (`@noble/*`) | X3DH, Double Ratchet, Sender Keys, AES-GCM/ChaCha20-Poly1305 envelopes | Client-side only; zero plaintext key exposure to server |

---

## 2. Backend Service Inventory

| Service / Deployable | Path | Language / Framework | Core Domains | Exposed Port / Ingress |
| --- | --- | --- | --- | --- |
| API Gateway | `services/typescript/gateway` | Fastify + Node.js | Edge routing, JWT/JWKS/denylist verification, rate limits, probe detection, HMAC identity signing | Public ALB/CloudFront ingress (`https://api.nantty.com`) |
| `goIdentity` | `services/go/modules/{auth,users}` | Go (`net/http` + Ent) | Auth, sessions, MFA/Passkeys, Developer SSO, Developer Orgs, profiles, Smile ID KYC, Black Gov | Gateway proxy + `/internal/*` |
| `goMoney` | `services/go/modules/{ledger,payments,wallet,subscriptions,escrow}` | Go (`net/http` + Ent) | Double-entry ledger, Flutterwave/Apple/Google payments, payouts, plans/Black/Combined Gold, escrow | Gateway proxy + raw webhooks + `/internal/*` |
| `goCommerce` | `services/go/modules/{catalog,orders}` | Go (`net/http` + Ent) | Stores, products, stock reservations, cart, checkout, shipping, returns, seller ops | Gateway proxy + `/internal/*` |
| `goAds` | `services/go/modules/ads` | Go (`net/http` + Ent) | Ad accounts, campaigns, delivery, signed click redirects (`/api/v1/ads/r/{token}`), budgets | Gateway proxy + `/internal/*` |
| `goLive` | `services/go/modules/live` | Go (`net/http` + Ent) | Lives, LiveKit tokens, battles, gifts, overlays, widget tokens | Gateway proxy + LiveKit webhooks + `/internal/*` |
| `goTrust` | `services/go/modules/moderation` | Go (`net/http` + Ent) | Reports, strikes, appeals, copyright/IP, account health, security probe ingest | Gateway proxy + `/internal/*` |
| Social Service | `services/typescript/social` | Fastify + Prisma | Posts, clips, stories, comments, E2EE chat, store inbox, scheduled posts, downloads, link previews | Gateway proxy + `/internal/*` |
| Media Service | `services/typescript/media` | Fastify + Prisma | Multipart/presigned uploads, transcode state, downloads/watermarks, asset ACLs | Gateway proxy + S3/CloudFront |
| Notifications Service | `services/typescript/notifications` | Fastify + Prisma | Inbox, device tokens, bulk staff email, HMAC-signed unsubscribe | Gateway proxy + `/internal/*` |
| Support Service | `services/typescript/support` | Fastify + Prisma | Support tickets, staff live chat, developer/sandbox macros | Gateway proxy + `/internal/*` |
| Search Service | `services/typescript/search` | Fastify + Prisma | Visibility/block/follower/age-filtered search queries | Gateway proxy + `/internal/*` |
| Sandbox Service | `services/typescript/sandbox` | Fastify + Prisma | Isolated sandbox API, credentials, SSRF-guarded webhook outbox | Developer/Sandbox portal via `SANDBOX_CONTROL_TOKEN` (note: omitted from `deploy.yml`) |
| Realtime Service | `services/elixir/realtime` | Elixir / Phoenix | WebSocket push, topic authorization, live revocation ETS broadcast | ALB `/ws*` proxy (via Gateway or ALB target) |
| Intelligence Service | `services/python/intelligence` | Python / Starlette | Feed ranking, fraud/abuse signals, media moderation | Internal-only (`SignedRequestMiddleware` HMAC-SHA256 + timestamp + nonce replay store) |

---

## 3. Critical Trust Boundaries & Security Invariants

1. **External -> Next.js BFFs -> Gateway**:
   - Browser holds `HttpOnly`, `SameSite=Lax`, `Secure` cookies; access/refresh tokens are stripped from JSON responses.
   - BFFs validate `Origin` / `Referer` / `Sec-Fetch-Site` on state-changing mutations and enforce route/method/permission/step-up allowlists.
2. **Gateway -> Internal Microservices**:
   - Gateway verifies EdDSA JWTs via JWKS + Valkey session revocation denylist, rejects `internal` path segments, blocks path confusion (`//`), blocks suspended accounts on non-exempt mutations, enforces policy acceptance and Turnstile human-verification gates, and signs forwarded `x-nantty-*` identity headers (`X-Gateway-Identity-Signature`).
   - Services **must not** trust raw `x-nantty-account-id` without verifying the Gateway HMAC signature or JWT directly, and `/internal/*` routes require `X-Internal-Token` (constant-time comparison).
3. **Payment, Escrow, Wallet & Subscription Invariants**:
   - All server-authoritative pricing (`checkout.service.go`, `blackGovernmentCheckout.service.go`, `storePurchases.service.go`).
   - Flutterwave (`Verif-Hash` / `flutterwave-signature` SHA-256 constant-time), Apple JWS (OID + Apple Root CA chain + ES256), Google Play (constant-time push token / RS256 OIDC JWT), Smile ID (HMAC-SHA256 + timestamp freshness + subject binding).
   - **Black Government Separation**: USD 300/mo (NG) / USD 500/mo (other), monthly only, zero discounts, manually approved institutional verification required at checkout, reactivation, retry, **and payment settlement**; card removal immediately auto-pauses entitlement; payment cannot restore revoked verification.
4. **SSRF & Outbound Network Boundaries**:
   - Both `social/safeHttpFetcher.integration.ts` and `sandbox/webhookSecurity.ts` resolve DNS pre-request, reject non-public/unspecified/loopback/link-local/CGNAT/NAT64/6to4/Teredo/ULA/IPv4-mapped ranges, pin TCP `lookup` to the validated IP, cap payload/response bytes, and disable unvalidated redirects.
5. **E2EE Messaging Boundary**:
   - `packages/chatCrypto` uses `@noble/{ciphers,curves,hashes}` (X25519/Ed25519/HKDF-SHA256/HMAC-SHA256/AEAD); `social` rejects plaintext payloads (`assertNoPlaintext`) and verifies sender device key registration.

---

## 4. Supply-Chain, Infrastructure & Environment Findings Summary

- **Dependency Audit (`corepack pnpm audit --prod --audit-level=high`)**: `No known vulnerabilities found` (verified 2026-11-20).
- **CI/CD (`.github/workflows/`)**:
  - `security.yml` runs dependency audits (pnpm/govulncheck/pip-audit/hex.audit), Trivy FS/secret/misconfig (SHA-pinned `trivy-action@ed142fd...`), and Terraform fmt/validate/config scan.
  - `deploy.yml` builds/deploys 11 services (`gateway`, 6 Go deployables, `social`, `media`, `notifications`, `support`, `search`, `realtime`, `intelligence`) — **`sandbox` is missing from `deploy.yml`**. Non-Trivy actions use version tags (`@v7.0.1`, `@v6`) rather than immutable commit SHAs.
- **Terraform AWS IaC (`infra/aws/`)**:
  - `SECURITY_DEPLOYMENT.md` defines the target HAProxy 3.2 LTS + AWS Private CA mTLS + Aurora/Valkey/RabbitMQ architecture (not yet applied to live AWS).
  - `infra/aws/modules/livekit` exposes `0.0.0.0/0` media/TURN ports intentionally for WebRTC ingress; non-edge modules restrict DB/cache/internal SGs.
- **Tooling Constraints Observed in Local Verification**:
  - Host runs Node `v22.22.3` (`package.json` specifies `>=26.13.0 <27`).
  - `go`, `mix`, `pytest`, and outbound `binaries.prisma.sh` (needed for `prisma generate` in `@nantty/social`) are absent/blocked in this sandbox, so Go, Elixir, Python, and Prisma-generated runtime suites could not execute locally and require CI/runner verification.
