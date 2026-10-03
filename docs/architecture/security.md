# Security architecture

As of 2026-10-03. Labels: **EXISTING** (cite path), **MOCK-ONLY**, **PROPOSED**, **OPTIONAL FUTURE**. Sources: `inventory.md` section 7, `SECURITY.md` (written against the legacy `apps/api` paths), `docs/backendPlan.md` 5.4-5.8.
Privacy is in `privacy.md`; pipeline and network in `devops.md`; logging in `observability.md`.

## 1. Trust zones and request path

```mermaid
flowchart LR
  subgraph Public[Public internet]
    U[Browser / Mobile]
  end
  subgraph Edge[Edge: PROPOSED]
    CF[CloudFront + WAF]
    ALB[ALB TLS 1.2+]
  end
  subgraph Web[Next apps EXISTING UI]
    BFF[BFF route handlers\nhttpOnly cookies + CSRF]
  end
  subgraph Priv[Private subnets: PROPOSED]
    GW[TS gateway\nJWKS verify, CORS, rate limit]
    RT[Phoenix realtime\n/ws first-frame auth]
    GO[Go deployables x6]
    PY[Python intelligence\nHMAC signed]
  end
  subgraph Data[Data subnets: PROPOSED]
    DB[(Aurora per-service roles)]
    RD[(Valkey)]
    S3[(S3 + KMS)]
  end
  U --> CF --> ALB
  ALB --> BFF
  ALB --> GW
  ALB --> RT
  BFF --> GW
  GW --> GO
  GO --> PY
  GO --> DB
  GO --> RD
  GO --> S3
```

| Zone | Rule | Status |
| --- | --- | --- |
| Public | Only CloudFront, ALB, Route 53. Nothing else has a public IP or public security-group rule | PROPOSED (`infra/aws/README.md` not applied) |
| App tier | Fargate tasks in private subnets, security group allows inbound only from the ALB (gateway, realtime, BFFs) or the gateway (Go services, Python) | PROPOSED |
| Data tier | Aurora, Valkey: inbound only from the app-tier SG on 5432/6379. `publicly_accessible=false` | PROPOSED |
| Local | Postgres, Valkey, LocalStack bound to `127.0.0.1` | EXISTING `infra/local/docker-compose.yml` |

## 2. Authentication

```mermaid
sequenceDiagram
  participant C as Client / BFF
  participant G as Gateway
  participant A as go-identity auth
  participant D as Aurora auth schema
  C->>G: POST /api/v1/auth/login (stricter limit)
  G->>A: proxy
  A->>D: verify argon2id hash
  A->>D: new session + refresh hash + outbox event (one tx)
  A-->>C: EdDSA access (15 min) + opaque refresh
  C->>G: Bearer access token
  G->>G: verify via JWKS (jose), forward x-zudomart-account-id / session-id
  C->>A: POST /refresh (old refresh)
  A->>D: rotate; if old token reused revoke whole session
```

| Control | Detail | Status | Evidence |
| --- | --- | --- | --- |
| Password hashing | argon2id | EXISTING | `services/go/modules/auth/internal/credentials/argon2id.hasher.go` |
| Access token | EdDSA JWT, 15 min default, staff TTL 10 min config | EXISTING | `internal/signingkeys/access_token.issuer.go`, `internal/config/auth.config.go` |
| Signing keys | Private keys encrypted in DB (`AUTH_SIGNING_KEY_ENCRYPTION_KEY`), rotation every 30 days, JWKS at `GET /.well-known/jwks.json`, old keys stay published until tokens expire | EXISTING | `internal/signingkeys/signing_key.service.go` |
| Verifiers | Go `platform/jwtauth`, gateway `jose`, realtime `jose` with key cache | EXISTING | `platform/jwtauth`, `services/typescript/gateway/src`, `services/elixir/realtime/lib/realtime_web/auth` |
| Refresh rotation | Stored as hash, rotated on use, reuse revokes session and emits `session.refreshTokenReuseDetected` | EXISTING, tested | `refresh_session_tokens.command.go`, `auth.module_integration_test.go` |
| OTP | 5 min, 5 attempts, 1 min resend cooldown, peppered hash. Delivery `log` only; production refuses `log` delivery | EXISTING, no real provider | `one_time_code.delivery.go` |
| Password reset / change | `POST /auth/password/reset`, `POST /auth/password/change` | EXISTING (added during audit window) | `internal/httpapi/auth.routes.go` |
| Sessions / devices | `GET/DELETE /auth/sessions`, `DELETE /auth/sessions/{id}` EXISTING; device registry, push tokens, "new device" alerts PROPOSED | EXISTING / PROPOSED | `auth.routes.go` |
| Social login | `POST /auth/google`, `/auth/apple`, ID-token verifier | EXISTING | `internal/socialidentity/identity_token.verifier.go` |
| Admin MFA / step-up | Frontend: enrollment, WebAuthn options, step-up, keep-alive BFF routes (MOCK-ONLY). Backend: separate admin audience, TOTP + WebAuthn, 5-min step-up token PROPOSED. `staffauth` guard and staff TTL config EXISTING, no staff login route | MOCK-ONLY / PROPOSED | `apps/admin/src/app/bff/auth/{mfa,step-up,keep-alive}`, `platform/staffauth` |
| Realtime auth | First frame `{type:"auth",accessToken}` within 10 s else close; browser tickets (60 s, `POST /realtime/tickets`) PROPOSED | EXISTING / PROPOSED | `client_socket.ex` |
| Service-to-service | Python: HMAC-SHA256 + nonce (Redis, fail closed) + 300 s skew EXISTING. Go-to-Go and gateway-to-Go: plain `x-zudomart-*` headers, trust rests on network isolation. Recommendation below | EXISTING (Python) / gap | `apps/intelligence/apiContract.md` s2 |

## 3. Authorization

| Layer | Model | Status |
| --- | --- | --- |
| Gateway | Token validity, coarse scope, and header allow-listing only. Never fine-grained | EXISTING (validity) |
| Service | Each service checks fine permission **and** resource ownership; default deny (buyer: own orders/carts/addresses/wallet; store member: own store) | PROPOSED (`SECURITY.md`, `backendPlan.md` 5.4) |
| Platform admin roles | `SUPERADMIN`, `ADMIN`, `SUPPORT`; destructive and money actions need step-up | MOCK-ONLY (`apps/admin/src/types/admin.type.ts`, `apps/admin/src/config/apiAccess.config.ts`) |
| Store team roles | `owner`, `manager`, `inventory`, `sales`, `accountant`; 26 permissions; owner-only: `billing:manage`, `wallet:withdraw`, `developer:manage` | MOCK-ONLY (`apps/seller/src/config/rolePermissions.config.ts`). The server must be the source of truth; UI role sets are only a convenience |
| Ad-account roles | `admin`, `advertiser`, `analyst`, `billing` | MOCK-ONLY (`apps/ads/src/config/rolePermissions.config.ts`) |
| Creator gating | Creator Program membership gates gift payouts and monetization; non-members' gifts settle to the host. Enforced in go-money and go-live from a creator-status read, never from a client claim | PROPOSED (`backendPlan.md` s6, 4.2) |
| Realtime topics | `user:<id>` own only; `conversation:*` deny-all until a membership source exists; `live:*`/`battle:*` any authenticated user | EXISTING `topic_authorizer.ex` |
| Store-scoped data | Every query takes `store_id` from the session context, not from the request body; add row-level checks in the repository layer, and optional Postgres RLS later | PROPOSED |

## 4. Web, edge and transport controls

| Control | Detail | Status | Evidence |
| --- | --- | --- | --- |
| BFF cookies | `__Host-` prefixed in prod (`zd_at`, `zd_rt`, `zd_sid`, `zd_viewer`), `httpOnly`, `sameSite=lax`, 15 min access / 30 d refresh. Tokens never reach browser JS | EXISTING | `apps/webapp/src/config/sessionCookies.config.ts` |
| CSRF | Origin and `sec-fetch-site` check plus HMAC `x-csrf-token` bound to session id (webapp); origin guards in studio, seller, ads, admin | EXISTING | `apps/webapp/src/server/requestOriginGuard.service.ts`, `signedCookie.service.ts` |
| Mobile tokens | OS secure store, not AsyncStorage | EXISTING | `apps/mobile/src/utils/secureStorage.util.ts` |
| CORS | Gateway allow-list `CORS_ORIGINS`, `credentials:false`; realtime `check_origin` from `ALLOWED_ORIGINS`; Go services have no CORS (internal only) | EXISTING | gateway config, `endpoint.ex` |
| Security headers | Gateway: `nosniff`, `no-referrer`, HSTS. Next apps: CSP, frame, HSTS in `next.config.ts` (admin: dedicated CSP service). Go services none (internal) | EXISTING | `apps/*/next.config.ts`, `apps/admin/src/server/contentSecurityPolicy.service.ts` |
| Rate limiting | Gateway: in-memory, 600/min per instance (EXISTING). Go platform: none. Intelligence: token bucket (EXISTING). Per-route table in 5.5 (login/OTP 5/min, gift 20/s, message 30/min, uploads 20/h) with Redis buckets and `429 Retry-After` PROPOSED | EXISTING (weak) / PROPOSED | gateway `RATE_LIMIT_MAX_PER_MINUTE` |
| WAF | AWS WAF on CloudFront/ALB: managed core + bad-inputs + IP reputation rule groups, rate-based rules on `/auth/*`, bot control on signup/login (OPTIONAL FUTURE) | PROPOSED | none |
| Request limits | Gateway 1 MiB body; Go server read-header 5 s, read/write 30 s, 64 KB headers; realtime 64 KB frame; intelligence 1/4 MiB | EXISTING | `platform/httpserver` |
| TLS | TLS 1.2+ at ALB/CloudFront with ACM; HSTS preload after stabilization | PROPOSED | |

## 5. Data and application controls

| Control | Detail | Status |
| --- | --- | --- |
| Input validation | Go: strict JSON decode (`platform/httpserver`) plus `auth.validator.go`, `input.validation.go` (tested). TS services: schema validation at the edge of each handler. Python: pydantic. Reject unknown fields | EXISTING (auth) / PROPOSED (rest) |
| SQL injection | Go: ent builders and generated queries; any raw SQL needs review and parameters. TS: Prisma only; CI `check-no-raw-sql-in-typescript.sh` blocks raw SQL | EXISTING (`services/scripts/check-no-raw-sql-in-typescript.sh`, `backend.yml` job `conventions`) |
| Secrets | Env vars loaded from AWS Secrets Manager at task start (ECS `secrets:` mapping); never in source, images or Terraform state in plaintext. Only `*.example` committed. Per-environment keys. CI secret scan | PROPOSED in AWS; EXISTING `.gitignore` + `*.example`, fail-fast config reader (`platform/config`) |
| Encryption in transit | TLS everywhere; Aurora `rds.force_ssl=1`; Valkey in-transit encryption + AUTH | PROPOSED |
| Encryption at rest | Aurora, S3, EBS, SQS, SNS under customer-managed KMS keys, one key per data class (identity, money, media, logs). Application-level envelope encryption for bank account numbers and KYB documents (`DATA_ENCRYPTION_KEY` pattern). Auth signing keys already encrypted by app key | PROPOSED; signing-key encryption EXISTING |
| Money integrity | int64 minor units; server recomputes prices; payment paid only after provider verification; `Idempotency-Key` on money endpoints; ledger inside DB tx with row locks | PROPOSED (`platform/idempotency` and `platform/money` EXISTING, not wired to routes) |
| Audit log | Append-only `AuditEvent` (actor, actingAs, action, subject, before/after, reason, ip, UA, requestId). Required for escrow release, refunds, disputes, payouts, role/staff/plan changes, API keys, admin config. DB role for writers is INSERT only | PROPOSED (`backendPlan.md` 5.7); events via outbox EXISTING in auth |
| Inbound webhooks | Gateway forwards `/webhooks/*` to go-money byte-for-byte (WAF limits `/webhooks/paystack` to Paystack IPs). Verify signature on raw body before parsing, unique provider event id, process once, ack fast, process async. Providers: Paystack, couriers, LiveKit, App Store/Play | Bachs and Anchor dropped; Paystack adopted (owner, 2026-10-03). PROPOSED in go-money (`POST /webhooks/paystack`): hex HMAC-SHA512 of the raw body with the Paystack secret key compared in constant time with `x-paystack-signature` (old and new key accepted during a key rotation), source IPs 52.31.139.75, 52.49.173.169, 52.214.14.220 allowlisted at the edge, no signed timestamp so dedupe on `event + data.id + status` in `webhook_events`, object re-fetched with `verify` before any ledger posting. The Bachs handler in code is deleted by `checkoutPaymentFlowPlan.md` §12. Couriers, LiveKit, stores ABSENT |
| Outbound webhooks | HMAC-SHA256 `X-Zudomart-Signature`, backoff for 24 h, replay, SSRF guard (deny private/link-local ranges, resolve then pin IP, no redirects) | PROPOSED |
| File uploads | Presigned S3 multipart URLs with size and content-type limits; server re-checks magic bytes; objects land in a quarantine prefix, malware scan, then moved to the processed bucket; processed media served by CloudFront with OAC and signed URLs; buckets block public access; strip EXIF GPS | PROPOSED (`backendPlan.md` media rows; legacy `apps/api` media module) |
| Logging | Central redaction (passwords, tokens, OTPs, card, bank). See `observability.md` | Go key-based redaction EXISTING (`platform/logging`); other stacks PROPOSED |
| Dependencies | pnpm 24 h release age block, frozen lockfile, `govulncheck` EXISTING in CI; `pnpm audit`, `pip-audit`, Trivy, SAST, secret scan PROPOSED | see `devops.md` |

## 6. Network and IAM least privilege (all PROPOSED)

| Item | Design |
| --- | --- |
| Subnets | 3 AZ x (public: ALB/NAT, private-app, private-data). Fargate tasks have no public IP |
| Egress | NAT for payment providers, LiveKit, email, push; VPC endpoints (S3 gateway, SQS, SNS, Secrets Manager, ECR, CloudWatch Logs, KMS) to keep AWS traffic off NAT |
| Security groups | SG per tier. Go services accept only from gateway SG and ALB (health). Python accepts only from Go/TS SGs. Aurora/Valkey accept only from app SG |
| Task roles | One IAM task role per service. go-identity: read its secrets, `kms:Decrypt` on identity key, `sns:Publish` to domain-events topic. go-money: money key, payout queue send/receive. realtime: receive from its queue only. intelligence: its queue, read-only feature bucket. No `*` resources; no shared role. Task execution role only pulls image and secrets |
| DB roles | `svc_<service>` owns its schema (EXISTING in `infra/local/postgres/create-databases.sh`), `zudomart_readers` read-only to others (EXISTING for auth, `20261003094100_grant_read_access_to_other_services`). Migration role separate from runtime role (runtime has no DDL) in prod. go-money ledger tables: runtime role gets INSERT/SELECT only, no UPDATE/DELETE |
| Humans | SSO into per-environment AWS accounts, MFA, no long-lived keys, break-glass role with CloudTrail alert. Prod DB access via SSM session, read-only by default |
| Org guardrails | SCPs deny disabling CloudTrail/GuardDuty, deny public S3, deny leaving the region allow-list |
| Detection | CloudTrail (org-wide, log-file validation), GuardDuty, Security Hub, AWS Config rules for public buckets and open SGs |

## 7. Threat table

| # | Threat | Likelihood / impact | Mitigation | Status |
| --- | --- | --- | --- | --- |
| 1 | Credential stuffing, OTP brute force | High / High | Per-identifier + IP limit 5/min, 20/h; OTP 5 tries lock (EXISTING); uniform responses; WAF bot rule; breached-password check; alert on spike | partial |
| 2 | Refresh token theft | Medium / High | Rotation + reuse detection (EXISTING); httpOnly cookies; device list; revoke-all on password change (EXISTING route) | EXISTING |
| 3 | IDOR / cross-tenant access (store, order, wallet) | High / High | Ownership check per resource in every service; IDOR tests in CI; store id from session | PROPOSED |
| 4 | Payment webhook forgery or replay | Medium / Critical | Signature on raw body, unique event id, provider verify call before crediting, idempotent handler | PROPOSED, ABSENT in `services/**` |
| 5 | Double spend / negative balance via race | Medium / Critical | Ledger tx with row locks, idempotency keys, deferred balance constraint, property tests, reconciliation job and `ledger imbalance` page | PROPOSED |
| 6 | Gift/coin abuse and fraud (self-gifting, stolen cards, chargebacks) | High / High | Python risk score, Go thresholds, per-user rate limit, holds before payout, velocity rules | PROPOSED |
| 7 | Compromised admin account | Low / Critical | Separate audience, MFA/WebAuthn, 5-min step-up, SUPERADMIN count cap, audit, IP allow-list option, dual approval for payouts above a limit | MOCK-ONLY / PROPOSED |
| 8 | Internal service spoofing (forged `x-zudomart-*`) | Low / High | Private subnets + SG; recommended signed internal JWT (see below) | gap |
| 9 | Malicious upload (malware, polyglot, oversized) | Medium / Medium | Type/size limits, magic bytes, quarantine + scan, serve from separate domain, CSP | PROPOSED |
| 10 | SSRF via webhook URLs or link previews | Medium / High | Egress allow-list proxy, block metadata IP 169.254.169.254, IMDSv2 only, no redirects | PROPOSED |
| 11 | Secret leak (repo, logs, CI) | Medium / Critical | Secrets Manager, secret scan in CI and pre-commit, redaction, rotation runbook, OIDC to AWS in CI | PROPOSED |
| 12 | Supply chain (npm, Go, PyPI, base images) | Medium / High | Lockfiles, 24 h release age, govulncheck (EXISTING), audit, Trivy, pinned base digests, SBOM | partial |
| 13 | XSS / UGC injection | Medium / High | React escaping, CSP (EXISTING in Next apps), sanitize rich text server side, no HTML in UGC | EXISTING / PROPOSED |
| 14 | DoS on realtime or feed | Medium / Medium | WAF rate rules, 50 sub cap and 64 KB frame (EXISTING), autoscaling, load-shed in gateway | partial |
| 15 | Insider data access / PII exfiltration | Low / High | Per-service DB roles, read-only prod access, query audit, field encryption, export alerts | PROPOSED |
| 16 | Account takeover through social login mix-up | Low / High | Verify `iss`, `aud`, `nonce`, email verified before linking; no auto-link on unverified email | EXISTING verifier, review linking rules |

## 8. Recommendations

### R1. Redis-backed per-route rate limits
- **Problem:** login, OTP send and reset have no stricter limit; gateway limit is in-memory per instance.
- **Current:** `RATE_LIMIT_MAX_PER_MINUTE=600` per instance (`services/typescript/gateway`); `SECURITY.md` requires route limits; no limiter in Go platform.
- **Why it matters:** with N tasks the effective limit is 600xN; auth endpoints are open to brute force and OTP cost abuse.
- **Recommendation:** Redis token buckets in the gateway keyed by route class + identifier + IP; a small Go `platform/ratelimit` for defense in depth on auth routes.
- **Complexity:** S. **Risk:** low (fail open for non-auth, fail closed for auth). **Priority: P0**, because go-identity is the only live service and it is the one exposed.
- **Tag:** MVP.

### R2. Sign gateway-to-service identity
- **Problem:** `x-zudomart-account-id/session-id` are plain headers.
- **Current:** `upstreamProxy.service.ts` forwards them; Go services trust them via network isolation only.
- **Why it matters:** any SG misconfiguration or compromised task becomes full impersonation, including admin and money.
- **Recommendation:** gateway mints a 60 s internal JWT (EdDSA, audience per service) or forwards the user token for Go to verify with `platform/jwtauth`; Go ignores raw headers. Prefer the second (already built).
- **Complexity:** S. **Risk:** low. **Priority: P1**, before go-money handles real funds.
- **Tag:** MVP.

### R3. Webhook verification library before the payments module
- **Problem:** no verification code in `services/**`.
- **Why it matters:** forged "paid" events credit wallets.
- **Recommendation:** `platform/webhooks` with HMAC verify on raw body, constant-time compare, timestamp tolerance, `webhook_events` unique `(provider, event_id)`; port tests from `apps/api/tests/security`.
- **Complexity:** S. **Risk:** low. **Priority: P0**, a hard prerequisite for any payment endpoint.
- **Tag:** MVP.

### R4. Server-side roles as source of truth
- **Problem:** role and permission sets exist only in frontend config; seller UI still carries POS-era roles per `backendPlan.md`.
- **Why it matters:** UI checks are not authorization.
- **Recommendation:** permission catalog in `go-commerce` (store roles) and `go-identity` (admin, staff), delivered in token claims or `/seller/access`; contract tests assert frontend sets equal backend sets.
- **Complexity:** M. **Risk:** medium. **Priority: P1**, needed before store routes ship.
- **Tag:** MVP.

### R5. CI security gates
- **Problem:** only `govulncheck` runs; no secret scan, SAST, container scan, `pnpm audit`, `pip-audit`.
- **Recommendation:** see `devops.md` pipeline.
- **Complexity:** S. **Risk:** low (initial noise). **Priority: P1**, cheap and blocks regressions.
- **Tag:** MVP.

### R6. Outbox row hardening and audit immutability
- **Problem:** outbox has no attempt counter; audit table not yet designed.
- **Recommendation:** audit table INSERT-only role, hash chain per day optional (OPTIONAL FUTURE, `signed-audit-trails` pattern).
- **Complexity:** S. **Risk:** low. **Priority: P2**, becomes P1 when payouts launch.
- **Tag:** Near term.

## 9. Compliance statement

These controls are engineering measures. They do not constitute PCI DSS, GDPR, or NDPA compliance. Card data never touches Zudomart systems (hosted provider checkout only), which keeps PCI scope minimal but still needs a qualified assessor's confirmation.
