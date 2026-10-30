# Nantty TypeScript Backend — Deep Scan Report

> **Historical scan (2026-10-08).** The `apps/api` monolith named below was removed on 2026-10-10; its paths no longer exist. The ported Go services and the 2026-10-10 verification table at the end are the current evidence.

> Generated: 2026-10-08
> Scope: `apps/api`, `services/typescript/gateway`, `services/typescript/social`
> Severity: CRITICAL / HIGH / MEDIUM / LOW

---

## 1. EXECUTIVE SUMMARY

This report documents gaps, bugs, and security issues found across the Nantty TypeScript backend. The codebase is **well-architected** (modular, double-entry ledger, serializable transactions, RBAC, idempotency, webhook verification), but contains **multiple exploitable security vulnerabilities** — most critically a proxy-trust misconfiguration that defeats every IP-based control, and an admin surface that defaults to unauthenticated.

**Priority actions:**
1. Fix proxy-trust default (C1) — breaks IP spoofing.
2. Default admin routes to `authentication: "required"` and close the IP allowlist by default (H1).
3. Reject known placeholder secrets in production (H2).
4. Fail-closed on gate-lookup errors and remove client headers from guest rate-limit keys (H3, H4).

---

## 2. CRITICAL

### C1 — Default `TRUSTED_PROXY_HOPS=1` allows source-IP spoofing via `X-Forwarded-For`

**Files:**
- `services/typescript/gateway/src/configs/gateway.config.ts:68`
- `services/typescript/gateway/src/app.ts:62`
- HTTP adapter package version 1.5.0, `httpTrustProxy.helper.js:79-101`

The gateway defaults to hop-count proxy trust. The underlying adapter compiles `hops=1` into `(_address, index) => index < 1`, which returns `true` for **any** peer. `getClientIp()` then walks the `X-Forwarded-For` chain and returns the right-most forwarded entry as `remoteAddress`.

**Impact.** Any client that can open a TCP connection to the gateway can send `X-Forwarded-For: <any IP>` and have it adopted as `context.request.remoteAddress`. This defeats every control keyed on `remoteAddress`:
- Global rate limit — `routeRateLimit.middleware.ts:8`
- Guest rate limit — `upstreamDispatch.handler.ts:86`
- Human-verification IP limit — `humanVerification.handler.ts:39`
- **Admin network allowlist** — `adminNetwork.middleware.ts:36`; an attacker outside the allowlist can send `X-Forwarded-For: 203.0.113.20` (an allowed CIDR) and pass the network gate.
- Probe detector IP subject — `accessProbeDetector.service.ts:68`

The gateway also binds to `0.0.0.0` by default (`gateway.config.ts:56`), so direct exposure is the default posture.

**Fix:** Default `TRUSTED_PROXY_HOPS` to `0` (or require an explicit proxy IP/CIDR list). Add a test that rotates the **right-most** `X-Forwarded-For` entry and asserts limits still apply.

**Test suite gives false confidence:** `tests/clientIpTrust.handler.test.ts:40-47` rotates only the left-most forwarded entry while keeping the right-most constant, so all three requests land in one bucket and the test passes. `tests/adminNetwork.middleware.test.ts:39-51` likewise demonstrates that `X-Forwarded-For` is honored, which under default config is exactly the spoofing vector.
---

## 3. HIGH

### H1 — Admin routes default to `authentication: "optional"` at the gateway, and the admin network allowlist defaults to open

**Files:**
- `services/typescript/gateway/src/routes/upstream.routes.ts:193-228` — the entire admin surface is registered as optional auth (e.g. `/api/v1/admin/ledger/`, `/api/v1/admin/withdrawals`, `/api/v1/admin/payouts/`, `/api/v1/admin/refunds` POST, `/api/v1/admin/`).
- `services/typescript/gateway/src/middlewares/adminNetwork.middleware.ts:31-32` — empty allowlist (the default, `.env.example:27` `ADMIN_IP_ALLOWLIST=`) disables the network gate entirely:
  ```ts
  if (allowList.length === 0) return (_context, next) => next();
  ```
- `services/typescript/gateway/src/services/anonymousMutationGuard.service.ts:20-22` — anonymous admin mutations are allowed whenever *any* `Authorization` header is present, even a garbage one:
  ```ts
  return !(path.startsWith("/api/v1/admin/") && extractBearerTokenFromAuthorizationHeader(authorizationHeader) !== undefined);
  ```

**Impact.** With default config, the gateway forwards unauthenticated (or invalidly-tokened) requests to every admin endpoint. The gateway provides **zero** admin-auth guarantee; security rests entirely on each upstream enforcing admin auth. Combined with C1, the network allowlist is also bypassable.

**Fix:** Default admin routes to `authentication: "required"` and default `ADMIN_IP_ALLOWLIST` to closed (fail-closed).

### H2 — Known default/internal secrets are accepted in production

**Files:**
- `.env.example:12,18,25` ships well-known placeholder secrets:
  - `IDENTITY_INTERNAL_TOKEN=local-only-users-internal-token-0123456789`
  - `TRUST_INTERNAL_TOKEN=local-only-moderation-internal-token-0123456789`
  - `GATEWAY_IDENTITY_SECRET=local-only-gateway-identity-secret-0123456789`

The only production-side check is a length floor for the signing secret — no rejection of the known default value:
- `gateway.config.ts:80` — `GATEWAY_IDENTITY_SECRET` only checked for `length >= 32`; `local-only-gateway-identity-secret-0123456789` is 43 chars and passes.
- `IDENTITY_INTERNAL_TOKEN` has **no** validation at all (`gateway.config.ts:61`).
- `TRUST_INTERNAL_TOKEN` is only checked for non-empty (`security.config.ts:27-28`).

**Impact.** An operator who copies `.env.example` into production deploys with publicly-known internal tokens and a publicly-known gateway identity signing secret. Anyone who reads this repo can forge gateway-to-upstream identity signatures and call internal trust/policy endpoints.

**Fix:** Reject `local-only-*` values in production and enforce minimum entropy on all internal tokens.

### H3 — Fail-open on policy-gate and human-verification gate lookup errors

**File:** `services/typescript/gateway/src/handlers/upstreamDispatch.handler.ts:60-67` (policy gate) and `:68-75` (human-verification gate):
```ts
} catch (error) {
  options.logger.warn("policy gate lookup failed; letting the request through", { ... });
}
...
} catch (error) {
  options.logger.warn("human verification gate lookup failed; letting the request through", { ... });
}
```

**Impact.** If the identity/trust service is slow or down (both use a 2s timeout), users with pending policy acceptance or active bot challenges bypass those controls for the duration of the outage. An attacker who can induce errors against the identity/trust dependency (or simply wait for an outage) escapes the human-verification gate.

**Fix:** Fail closed for `everyAction`/`acceptanceRequired` states, or at least cache the last-known restrictive state.

### H4 — Guest rate-limit key incorporates client-controlled headers — anonymous limit bypass

**File:** `services/typescript/gateway/src/handlers/upstreamDispatch.handler.ts:85-86`:
```ts
const deviceId = request.getHeader("x-device-id") ?? request.getHeader("x-client-region") ?? "";
const decision = await rateLimitStore.hit(`rl:guest:${sensitive ? "s" : "g"}|${request.remoteAddress ?? ""}|${deviceId}`, ...);
```

`x-device-id` and `x-client-region` are arbitrary client headers. Because they are part of the rate-limit key, an anonymous client rotates `X-Device-Id` to mint a fresh bucket per request, bypassing the guest limits. The only backstop is the global per-IP limit (which is itself spoofable per C1).

**Fix:** Remove client-controlled headers from the anonymous rate-limit key, or validate/normalize them.

---

## 4. MEDIUM

### M1 — Spoofable client headers forwarded upstream (geo/platform/device)

**File:** `services/typescript/gateway/src/services/upstreamProxy.service.ts:23`:
```ts
const forwardedRequestHeaders = ["accept", "authorization", "content-type", "idempotency-key", "if-match", "if-none-match", "x-chunk-sha256", "x-seller-store", "x-seller-location", "user-agent", "x-client-platform", "x-client-region", "x-device-id", "x-step-up-token", "x-store-storefront", "cloudfront-viewer-country"];
```

`cloudfront-viewer-country`, `x-client-region`, `x-client-platform`, `x-device-id`, `x-store-storefront`, and `x-step-up-token` are passed through verbatim from the client. Unless the gateway is provably behind CloudFront, any client can spoof their country. If any upstream uses these for geo-pricing, access, or step-up decisions, this is a bypass.

**Fix:** Strip or overwrite geo headers the gateway does not itself set.

### M2 — In-memory stores flush-all under memory pressure — counter-reset evasion

**Files:**
- `services/typescript/gateway/src/services/security/securityStore.service.ts:26,37` — `if (this.windows.size > 50_000) this.windows.clear();` and `if (this.flags.size > 50_000) this.flags.clear();`
- `services/typescript/gateway/src/services/rateLimitStore.service.ts:31` — only evicts at 10k, then scans

**Impact.** When used as the Valkey fallback (or when no Valkey is configured), an attacker who generates >50k distinct keys forces a full `clear()`, resetting all probe-detection and rate-limit counters. This is a deliberate DoS-evasion vector against the security store.

**Fix:** Evict per-key with LRU/sampling instead of clearing everything.

### M3 — Circuit-breaker fallback to per-instance in-memory limits during Valkey outage

**Files:**
- `services/typescript/gateway/src/services/valkeyRateLimitStore.service.ts:19,27-30`
- `services/typescript/gateway/src/services/security/securityStore.service.ts:95-104`

On any Valkey error, limits/security windows silently degrade to per-instance in-memory state for 5s. In a multi-replica deployment, an attacker can rotate across instances during the fallback window, and each instance counts independently.

**Fix:** Consider fail-closed or a shared fallback during outages.

### M4 — Fixed-window rate limiting allows 2x burst at the boundary

**File:** `services/typescript/gateway/src/services/rateLimitStore.service.ts:21-27`:
```ts
if (current === undefined || moment - current.windowStartedAt >= windowMs) {
  this.windows.set(key, { windowStartedAt: moment, count: 1 });
  return { allowed: true, retryAfterSeconds: 0 };
}
current.count += 1;
```

Classic fixed-window boundary burst (2x limit in 2 seconds at the rollover).

**Fix:** Use a sliding window or token bucket for sensitive endpoints (login/otp/reset).

### M5 — `requestSizeLimit` trusts `Content-Length` and only checks an already-buffered body

**File:** `services/typescript/gateway/src/middlewares/requestSizeLimit.middleware.ts:5-7`:
```ts
const declared = Number(context.request.getHeader("content-length") ?? "0");
const actual = context.request.body instanceof Uint8Array ? context.request.body.byteLength : 0;
if (declared > maximumBytes || actual > maximumBytes) { ... }
```

For chunked requests (no `Content-Length`) where the adapter hands a stream rather than a `Uint8Array`, `declared = 0` and `actual = 0`, so the middleware passes. Also, `Number("abc")` is `NaN`, which passes both comparisons. The adapter does cap the body, so this is defense-in-depth, but the middleware itself is not a reliable guard.

### M6 — CORS preflight and rejected-origin responses bypass rate limiting

**File:** `services/typescript/gateway/src/middlewares/strictCors.middleware.ts:21-31` returns `204` for allowed preflights **without calling `next()`**, and `:18-19` returns `403` for disallowed origins without `next()`. Because CORS runs before the global rate limiter in the pipeline (`src/app.ts:48-58`), neither preflights nor cross-origin-rejected requests are ever rate-limited.

**Fix:** Move CORS after the rate limiter, or rate-limit CORS preflight/rejection paths explicitly.

### M7 — Gateway identity signature payload is newline-delimited without length framing

**File:** `services/typescript/gateway/src/services/gatewayIdentitySigner.service.ts:14-16`:
```ts
return ["v1", String(input.issuedAtSeconds), input.method.toUpperCase(), input.path, input.requestId, ...signedIdentityHeaderNames.map((name) => input.headers[name] ?? "")].join("\n");
```

The signed fields (accountId, sessionId, ageBracket, viewer) are joined with `\n` and not length-prefixed. These values originate from JWT claims. If a claim contains a newline (possible if the identity provider is compromised or malicious), the payload becomes ambiguous and could be confused with a differently-signed request.

**Fix:** Reject control characters in claims or use a length-prefixed/unambiguous canonical encoding.

### M8 — Admin network prefix mismatch: `/api/v1/admin` (no slash) is not network-gated

**File:** `services/typescript/gateway/src/middlewares/adminNetwork.middleware.ts:5,35`:
```ts
const adminPathPrefix = "/api/v1/admin/";
...
if (!context.request.path.startsWith(adminPathPrefix)) return next();
```

`isAdminPath` in `accessProbeClassifier.service.ts:52-54` matches both `/api/v1/admin` and `/api/v1/admin/...`, but the network middleware only matches the trailing-slash form. A request to exactly `/api/v1/admin` skips the network allowlist. In practice the route table has no exact `/api/v1/admin` route (it 404s), so this is a consistency gap rather than an exploitable hole, but the two definitions should be unified.

### M9 — Policy-gate exempt prefixes use `startsWith` — over-matching

**File:** `services/typescript/gateway/src/services/policyAcceptanceGate.service.ts:26-29`:
```ts
return !policyGateExemptPrefixes.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix));
```

`"/api/v1/consentsfoo"` matches the `"/api/v1/consents"` prefix. Exempt-path matching should be segment-aware, not bare `startsWith`.


---

## 5. LOW / OBSERVATIONS

- No `eval`/`Function`/`child_process`/`innerHTML` usage in `src/` (grep confirmed).
- No hardcoded production secrets in source — only the `.env.example` placeholders (see H2).
- SSRF in `upstreamProxy` is not directly exploitable by external input: `forwardRequestToUpstream` builds `new URL(request.pathWithQuery, upstreamBaseUrl)`, and `pathWithQuery` is derived from `requestUrl.pathname`, which URL-normalization always roots at `/`. An attacker cannot override the host via the path, and `upstreamBaseUrl` is operator-configured per route. The gateway never follows redirects server-side (`redirect: "manual"`); it only echoes a `Location` back to the client after `isSafeRedirectLocation` validation, which correctly blocks `javascript:`, `data:`, protocol-relative, credential-bearing, and non-https targets.
- Token verification is otherwise sound: `accessTokenVerifier.service.ts:29-35` pins `algorithms: ["EdDSA"]`, validates issuer/audience, `clockTolerance: 30`, and requires `sub`/`sid`/`exp`. No replay protection (`jti`) at the gateway, and the `roles` claim is parsed but never used for gateway authorization — both are upstream concerns.
- `isTamperedConsumerToken` (`accessProbeClassifier.service.ts:77-86`) uses `decodeJwt` (no signature verification) — it is a detection heuristic for probe signaling only, not an enforcement path, so this is acceptable, but it must never be reused for auth decisions.
- Device-based probe counting is spoofable: `accessProbeDetector.service.ts:64-70` keys a subject on `d:${deviceId.slice(0,128)}` where `deviceId` is the client-controlled `x-device-id` header. Rotation defeats the device subject, partially mitigated because the account subject `a:${accountId}` and IP subject are also counted.
- Webhook signature verification is fully delegated to upstreams. Routes with `rawBodyPassthrough: true` forward raw bodies + signature headers with `authentication: "optional"`. The gateway does not verify the previous payment provider/Smile-ID/Live webhook signatures; a compromise or auth bug in the money/live upstream exposes unauthenticated webhook ingestion.
- `isChatReportSubmission` (`upstream.routes.ts:233-241`) `JSON.parse`s every `POST /api/v1/reports` body to reroute to the trust upstream — bounded by the 1MB body cap, but it is per-request parse cost on an unauthenticated-when-token-invalid path.
- HSTS `preload` is set even though the gateway may serve plain HTTP internally; harmless but worth confirming the edge terminates TLS. CSP `default-src none; frame-ancestors none` is appropriate for an API.
- Valkey connection uses a length-prefixed RESP encoder (no injection), validates bulk-string lengths before slicing, and uses default `rejectUnauthorized` for `rediss://`. AUTH password is read from the URL. No issue found.
- `humanVerificationGate` uses `Math.random()` for like-window member uniqueness — not crypto-strong, but adequate for rate-limit member dedup. The 12-hour session pass and 300s action pass are generous by design.


---

## 6. API BACKEND (`apps/api`) — Additional Findings

### A1 — No CORS configuration visible in the scanned API code

**File:** `apps/api/src` — no explicit CORS middleware configuration found in the scanned files. The server uses `createCorsMiddleware` (`server.ts:69`) with `allowOrigin: config.corsOrigins` and `credentials: false`, which is acceptable, but the origin list defaults must be verified to not include `*` in production.

### A2 — Refresh token rotation only on use; stolen refresh token valid until used

**File:** `apps/api/src/modules/auth/services/token.service.ts:55-73`

Refresh tokens are 30-day JWTs stored as HMAC-SHA256 hashes. Rotation happens only when the token is presented. If a refresh token is stolen, it remains valid until used. There is no family-tracking or proactive revocation.

**Fix:** Consider shorter refresh token TTL or rotation on every use with family tracking.

### A3 — Session revocation reason not rate limited

**File:** `apps/api/src/modules/auth/services/token.service.ts:97-99`

`revokeSessionAfterRefreshTokenReuse` could be abused for DoS if called repeatedly.

### A4 — OTP max attempts: 5 (configurable)

**File:** `apps/api/src/configs/settings.config.ts:87` — `otpMaxAttempts: 5`

Could allow brute force on phone/email OTP codes. Consider lockout after N attempts.

### A5 — No password breach check

**File:** `apps/api/src/modules/auth/services/password.service.ts`

No HaveIBeenPwned integration. Consider adding password strength/breach detection.

### A6 — Default JWT audience/issuer hardcoded

**File:** `apps/api/src/modules/auth/services/token.service.ts:33-35`

```ts
issuer: "nantty-api",
audience: "nantty-app",
```

These are hardcoded. Consider making them configurable.

### A7 — No device fingerprinting for session security

**File:** `apps/api/src/modules/auth/services/token.service.ts:48-49`

Only `userAgent` and `ip` are stored. Consider adding device fingerprinting for session security.

### A8 — Payment amount limits not enforced

**File:** `apps/api/src/modules/payments/services/payments.service.ts`

No min/max per currency/provider. Consider adding payment amount limits.

### A9 — Withdrawal velocity limits not enforced

**File:** `apps/api/src/modules/wallets/services/withdrawals.service.ts`

No daily/monthly caps per user. Consider adding withdrawal velocity limits.

### A10 — Escrow amount validation not enforced

**File:** `apps/api/src/modules/escrows/services/escrows.service.ts`

Ensure escrow amount matches order total. Consider adding explicit validation.

### A11 — Currency conversion rounding not verified

**File:** `apps/api/src/modules/wallets/services/ledger.service.ts:82-99` (`buildLinesMovingMoneyBetweenCurrencies`)

Verify no precision loss in currency conversion. Consider adding explicit rounding checks.

### A12 — Webhook replay window not validated

**File:** `apps/api/src/modules/payments/services/payments.service.ts:120-139`

Only event key claim, no timestamp validation. Consider adding webhook replay window validation.

---

## 7. SOCIAL SERVICE (`services/typescript/social`) — Additional Findings

### S1 — SSRF Vulnerability in Link Previews
**File:** `services/typescript/social/src/modules/linkPreviews/services/linkPreviewParser.service.ts`
Uses regex-based HTML parsing that can be bypassed with malformed HTML. The `safeHttpFetcher` has DNS pinning but the redirect re-validation may not catch all edge cases. No limit on redirect chain depth — potential redirect loop amplification.

### S2 — Missing Rate Limiting on Link Previews
**File:** `services/typescript/social/src/modules/linkPreviews/`
Link preview endpoint has no user-level rate limiting — a single user can spam the preview service, causing excessive outbound requests.

### S3 — Potential IDOR in Store Inbox
**File:** `services/typescript/social/src/modules/storeInbox/queries/getStoreConversation/getStoreConversation.handler.ts:9`
The `findForStore` method checks that the conversation belongs to the store, BUT the authorization only verifies `command.storeId` matches — there is no verification that the requesting user (passed via `senderId` in the message handler) actually owns or works for this store. The `principal.middleware` extracts `accountId` but the store-inbox routes may not verify the principal's `accountId` matches `storeId`.

### S4 — Hardcoded Secrets Exposure in `.env.example`
**File:** `services/typescript/social/.env.example`
Contains realistic secret placeholders that could be mistaken for real values in production deployments.

### S5 — Potential Race Condition in Streak Restoration
The `restoreStreak.handler.ts` checks conversation membership before applying streak restoration, but there is no transaction isolation to prevent race conditions where a user is removed from a conversation between the check and the action.

### S6 — Cursor Pagination Bug in `listStoreConversations`
**File:** `services/typescript/social/src/modules/storeInbox/queries/listStoreConversations/listStoreConversations.handler.ts:13,25`
When filtering with text, the unread count is computed separately from the filtered list, so `unreadConversationsCount` does not reflect the filtered subset. Also, the `nextCursor` checks `views.length > query.limit` but `views` is the filtered full list, not the sliced `page` — this can return a cursor that points beyond the actual filtered results if filtering significantly reduced the count.

### S7 — Potential N+1 Query in `buildStoreConversationViews`
Called with arrays of conversations but the view-building service likely fetches customer profiles and last messages per conversation without batching.

### S8 — Missing Input Validation on `senderLabel`
**File:** `services/typescript/social/src/modules/storeInbox/commands/sendStoreMessage/sendStoreMessage.handler.ts:25`
The `senderLabel` is accepted from the command and used directly in the message envelope without length validation — the schema at `storeInbox.validator.ts:13` validates `senderName` but not `senderLabel`.

### S9 — Inconsistent Error Handling in Store Inbox
**File:** `services/typescript/social/src/modules/storeInbox/commands/openStoreConversation/openStoreConversation.handler.ts`
`openStoreConversationRow` does not check if the buyer has been blocked by the store before creating/opening a conversation — no `blockRepository` check before DM creation.

### S10 — Potential Phantom Reads in Feed Pagination
**File:** `services/typescript/social/src/modules/feeds/queries/getFollowingFeed/getFollowingFeed.handler.ts:17`
`buildPageFromOverfetchedRows` fetches `limit + 1` rows, but if posts are deleted/updated between requests, the cursor-based pagination can skip or duplicate results.

### S11 — No Circuit Breaker on Outbound HTTP
**File:** `services/typescript/social/src/integrations/safeHttpFetcher.integration.ts`
The link preview fetcher has no circuit breaker pattern — if an external service is down, the service will continue attempting requests, potentially exhausting connection pools.

### S12 — Missing Idempotency on Message Send
**File:** `services/typescript/social/src/modules/storeInbox/commands/sendStoreMessage/sendStoreMessage.handler.ts`
While the route layer has idempotency middleware, the message send handler does not check for duplicate message content within a short time window — two quick sends with different idempotency keys could produce duplicate messages to the same recipient.

### S13 — No CASCADE Deletes in Prisma Schema
**File:** `services/typescript/social/prisma/schema/messagingKeys.prisma`
`ChatDeviceKey` and related prekey models have `onDelete: Cascade` on some relations, but `ConversationMember` deletion does not cascade to messages — orphaned messages remain when a member is removed.

### S14 — Integer Overflow Risk in `preKeyClaimLimit.service.ts`
Rate limiting for pre-key claims uses simple counter increments that could overflow on 32-bit integers under heavy load.

---

## 8. API BACKEND (`apps/api`) — Additional Findings

### A1 — No explicit CORS middleware configuration in scanned API code
**File:** `apps/api/src` — the server uses `createCorsMiddleware` (`server.ts:69`) with `allowOrigin: config.corsOrigins` and `credentials: false`, which is acceptable, but the origin list defaults must be verified to not include `*` in production.

### A2 — Refresh token rotation only on use; stolen refresh token valid until used
**File:** `apps/api/src/modules/auth/services/token.service.ts:55-73`
Refresh tokens are 30-day JWTs stored as HMAC-SHA256 hashes. Rotation happens only when the token is presented. If a refresh token is stolen, it remains valid until used. There is no family-tracking or proactive revocation.
**Fix:** Consider shorter refresh token TTL or rotation on every use with family tracking.

### A3 — Session revocation reason not rate limited
**File:** `apps/api/src/modules/auth/services/token.service.ts:97-99`
`revokeSessionAfterRefreshTokenReuse` could be abused for DoS if called repeatedly.

### A4 — OTP max attempts: 5 (configurable)
**File:** `apps/api/src/configs/settings.config.ts:87` — `otpMaxAttempts: 5`
Could allow brute force on phone/email OTP codes. Consider lockout after N attempts.

### A5 — No password breach check
**File:** `apps/api/src/modules/auth/services/password.service.ts`
No HaveIBeenPwned integration. Consider adding password strength/breach detection.

### A6 — Default JWT audience/issuer hardcoded
**File:** `apps/api/src/modules/auth/services/token.service.ts:33-35`
```ts
issuer: "nantty-api",
audience: "nantty-app",
```
These are hardcoded. Consider making them configurable.

### A7 — No device fingerprinting for session security
**File:** `apps/api/src/modules/auth/services/token.service.ts:48-49`
Only `userAgent` and `ip` are stored. Consider adding device fingerprinting for session security.

### A8 — Payment amount limits not enforced
**File:** `apps/api/src/modules/payments/services/payments.service.ts`
No min/max per currency/provider. Consider adding payment amount limits.

### A9 — Withdrawal velocity limits not enforced
**File:** `apps/api/src/modules/wallets/services/withdrawals.service.ts`
No daily/monthly caps per user. Consider adding withdrawal velocity limits.

### A10 — Escrow amount validation not enforced
**File:** `apps/api/src/modules/escrows/services/escrows.service.ts`
Ensure escrow amount matches order total. Consider adding explicit validation.

### A11 — Currency conversion rounding not verified
**File:** `apps/api/src/modules/wallets/services/ledger.service.ts:82-99` (`buildLinesMovingMoneyBetweenCurrencies`)
Verify no precision loss in currency conversion. Consider adding explicit rounding checks.

### A12 — Webhook replay window not validated
**File:** `apps/api/src/modules/payments/services/payments.service.ts:120-139`
Only event key claim, no timestamp validation. Consider adding webhook replay window validation.

---

## 9. PRIORITY RECOMMENDATIONS

1. **Fix C1 first:** Change the default `TRUSTED_PROXY_HOPS` to `0` (or require an explicit proxy IP/CIDR list), and document that hop-count trust is only safe when the gateway port is not directly reachable. Add a test that rotates the *right-most* `X-Forwarded-For` entry and asserts limits still apply.
2. **Fix H1:** Default admin routes to `authentication: "required"` and default `ADMIN_IP_ALLOWLIST` to closed (fail-closed).
3. **Fix H2:** Reject `local-only-*` secrets and enforce entropy minimums on all internal tokens in production.
4. **Fix H3/H4:** Fail closed (or cache last-restrictive state) on gate lookup errors; remove client-controlled headers from the guest rate-limit key.
5. Address M1–M9 as a hardening pass (strip geo headers, LRU eviction, sliding windows, segment-aware exempt matching, unify admin prefix).
6. Address S1–S14 in the social service (SSRF, rate limiting, IDOR, pagination bugs, N+1 queries, cascade deletes).
7. Address A1–A12 in the API backend (CORS, refresh token rotation, OTP brute force, payment/withdrawal limits, webhook replay).

---

## 10. CONCLUSION

The Nantty TypeScript backend is **well-architected** with strong financial integrity controls (double-entry ledger, serializable transactions, amount verification) and good security hygiene (token hashing, idempotency, webhook verification, audit trails). However, it contains **multiple exploitable security vulnerabilities** — most critically a proxy-trust misconfiguration that defeats every IP-based control, and an admin surface that defaults to unauthenticated. The priority recommendations above should be addressed before production deployment.

---

## Verification (2026-10-10)

Checked against the current working tree on 2026-10-10. `apps/api` is deleted, so A-findings were checked against the ported Go services (`services/go/modules/auth`, `payments`, `wallet`, `escrow`, `currency`). A1–A12 appear twice in this report (§6 and §8) and are listed once here. Payment code was not edited in this pass (the Flutterwave stage 2 work owns it). "Fixed now" means fixed in this verification pass, with a regression test. Paths are relative to `services/typescript/` unless they start with `services/go`.

| ID | Severity | Status | Evidence | Fix / test |
|---|---|---|---|---|
| C1 | Critical | Fixed now | `gateway/src/configs/gateway.config.ts:71` defaults `TRUSTED_PROXY_HOPS` to 0, and `gateway/src/app.ts:67` falls back to 0. `productionHardening.config.ts` refuses to start in production without an explicit hop count; infra sets `TRUSTED_PROXY_HOPS=1` (`infra/aws/modules/platform/deploy.tf:71`) | `gateway/tests/deepScanHardening.test.ts` "C1 proxy trust" (the right-most XFF entry rotates and still hits one bucket) |
| H1 | High | Fixed now (staff gate). The allowlist default is still open | `gateway/src/handlers/upstreamDispatch.handler.ts:65` + `services/adminStaffGate.service.ts`: every `/api/v1/admin` request except the 7 public staff-auth POSTs needs a verified staff token (audience `nantty-admin`, matching `platform/staffauth`). Missing, garbage and customer tokens get 401. `ADMIN_IP_ALLOWLIST` is still open when empty, and infra doesn't set it | "H1 admin routes need a staff token". Infra owner: set `ADMIN_IP_ALLOWLIST` in `deploy.tf` |
| H2 | High | Fixed now | `gateway/src/configs/productionHardening.config.ts`: in production, `local-only*`/`change-me`/placeholder values and tokens under 32 characters are rejected for `GATEWAY_IDENTITY_SECRET`, `IDENTITY_INTERNAL_TOKEN` and `TRUST_INTERNAL_TOKEN` | "H2 placeholder secrets" |
| H3 | High | Fixed now | When a lookup fails, the last restrictive answer is kept: `policyAcceptanceGate.service.ts:48`, `security/humanVerificationGate.service.ts:44`. With no cached restriction the request still fails open; that is deliberate, so an outage doesn't lock everyone out | "H3 gate lookups keep the last restrictive answer" |
| H4 | High | Fixed now | `upstreamDispatch.handler.ts:93`: the guest key is IP only (no `x-device-id`/`x-client-region`) | "H4 guest limit ignores client device headers" |
| M1 | Medium | Fixed now | `cloudfront-viewer-country` is forwarded only when `TRUST_CDN_COUNTRY_HEADER=true` (stage 1). `x-client-region` and the storefront headers are still forwarded as display hints, but no checkout charges from them any more: the last one, web subscription checkout, now uses `ResolveChargingRegion` (see GO_BACKEND_DEEP_SCAN FLOW-001) | Test: `subscriptions.chargingRegion_integration_test.go` `TestWebSubscriptionCheckoutIgnoresTheClientRegionHeaderAndNeedsARealCountry` |
| M2 | Medium | Fixed now | `security/securityStore.service.ts` (`evictOldestBeyond`), `rateLimitStore.service.ts` (`maximumTrackedKeys`), and the policy/challenge caches evict one oldest entry instead of calling `clear()` | "M2/M4 counters: keeps other counters when the security store overflows" |
| M3 | Medium | Open (accepted trade-off) | `valkeyRateLimitStore.service.ts`: during a Valkey outage, a 5 s circuit falls back to per-instance memory. Failing closed would make a cache outage a full API outage | Owner: platform. Revisit if replicas grow; per-instance limits still apply |
| M4 | Medium | Fixed now | `rateLimitStore.service.ts` `locateSlidingWindow`/`decideSlidingWindow`: a sliding window in memory and in Valkey (two-key Lua) | "does not allow a double burst across the window boundary" |
| M5 | Medium | Fixed now | `middlewares/requestSizeLimit.middleware.ts`: a non-numeric `Content-Length` gets 400 `INVALID_CONTENT_LENGTH`. The adapter's `maxBodySize` still caps streamed bodies | "refuses a non-numeric Content-Length" |
| M6 | Medium | Fixed now | `gateway/src/app.ts:54,62` + `strictCors.middleware.ts` `isAnsweredByCorsAlone`: preflights and rejected origins are counted against the global limit before CORS answers them; other requests are counted once after CORS | "M6 CORS answers are rate limited" (`[204, 403, 200, 429]`) |
| M7 | Medium | Fixed now | `gatewayIdentitySigner.service.ts`: fields containing CR/LF throw; `accessTokenVerifier.service.ts` rejects `sub`/`sid` with control characters | "refuses identity fields with line breaks", "rejects tokens whose subject carries control characters" |
| M8 | Medium | Fixed now | `middlewares/adminNetwork.middleware.ts:35` uses the shared `isAdminPath` | "network-gates the bare admin prefix" |
| M9 | Medium | Fixed now | `policyAcceptanceGate.service.ts` `isPathWithinPrefix` matches by path segment | "matches policy-gate exemptions by path segment" |
| §5 obs. | Low/Info | No action needed / informational | No eval/innerHTML; SSRF in the proxy is not reachable; JWT verification is sound; webhook signatures are verified in Go (stage 1 inbox); HSTS/CSP are fine. The `x-device-id` probe subject is spoofable but backed by IP and account subjects; the chat-report JSON parse is bounded by the 1 MB cap | — |
| A1 | Low | Fixed | `gateway/src/middlewares/strictCors.middleware.ts:19` drops `*`, and the allowlist comes from config. The Go CORS allowlist is in platform/httpserver (GO HTTP G4) | gateway CORS tests |
| A2 | Low | Fixed (ported) | `services/go/modules/auth/.../refreshSessionTokens.handler.go:45-46,79`: rotated on every use; a reused token revokes the session and denylists it (`sessionDenylist.service.go`). The 30-day TTL is configurable (`AUTH_REFRESH_TOKEN_TTL`) | Go auth session tests |
| A3 | Low | Obsolete / false positive | Revoking after reuse needs a previously valid refresh token, and the refresh endpoint is rate limited (gateway `login` class, Go `RateLimitAuthEndpoints`) | — |
| A4 | Low | Fixed (ported) | `services/go/modules/auth/.../verifyOneTimeCode.handler.go:41-51`: the code is invalidated after `OneTimeCodeMaximumAttempts`, plus gateway `otp` limits (5/min) | Go auth OTP tests |
| A5 | Low | Open (enhancement) | Go auth has no breached-password check | Owner: identity. Add k-anonymity HIBP or an offline top-N list; this needs a dependency/network decision |
| A6 | Info | Fixed (ported) | `services/go/modules/auth/src/configs/auth.config.go:52-53` (`AUTH_TOKEN_ISSUER`, `AUTH_TOKEN_AUDIENCE`) | — |
| A7 | Info | Open (enhancement) | Sessions store user agent and IP only | Owner: identity. Product decision, not a vulnerability |
| A8 | Low | Fixed now | Owner-approved per-type caps, admin-configurable (`payments.limits`, env fallback): order ₦5,000,000 per store order (`PAYMENT_AMOUNT_OUT_OF_RANGE`, reason `contactSupportForLargeOrders`), coins ₦500,000, ads top-up ₦10,000,000, wallet payments ₦50,000 / ₦200,000 / ₦5,000,000 a day by KYC tier (`WALLET_DAILY_LIMIT` with the remaining amount); other currencies converted with overrides; per-currency minimum kept | Test: `paymentAmountLimits.service_test.go`, `flutterwaveFlows/flutterwaveLimits_test.go`, `regionPricing.limits_test.go`, admin `contracts/moneyLimits.test.ts` |
| A9 | Low | Fixed (stage 1, B25) | Wallet withdrawal limits: 3/day, a 10-minute gap, a daily cap, one in flight, a 48 h cooldown, step-up | `wallet.withdrawalSafety_integration_test.go` |
| A10 | Low | Fixed (ported) | `services/go/modules/payments/.../paymentSettlement.service.go:127-151` refuses an amount or currency mismatch against the intent, and escrow amounts come from `AllocateCheckoutGroups` of the verified intent | payments settlement tests |
| A11 | Low | Fixed (ported) | `services/go/modules/currency/.../exchangeRateMath.service.go:60-73` uses exact `big.Int` with floor rounding and an overflow check | `exchangeRateMath.service_test.go` |
| A12 | Low | Fixed (stage 1, B2) / not applicable | The previous payment provider signatures have no timestamp. Replays are deduplicated by the unique provider+event key in the webhook inbox, and every handler re-verifies by API | `TestWebhookDeliveredTwiceAndConcurrentlyIsProcessedOnce` |
| S1 | Medium | False positive | `social/src/integrations/safeHttpFetcher.integration.ts:118-126` caps redirects (`maximumRedirects`) and re-validates and DNS-pins every hop. The regex parser only reads metadata from an already-fetched, size-capped body | existing safeHttpFetcher tests |
| S2 | Medium | Fixed now | `gateway/src/services/routeRateLimitPolicy.service.ts`: per-account `linkPreview` limit (30/min) on resolve and refresh | "S2 link preview limit" |
| S3 | Medium | False positive | `social/src/modules/storeInbox/controllers/storeInbox.controller.ts`: every store-side route is wrapped in `requireInternalToken` (`/api/v1/internal/...`, blocked at the gateway), and only the commerce BFF, which authorises store membership, calls them. Buyer sends use `principal.accountId` | — |
| S4 | Low | Fixed now | `social/src/configs/productionSecrets.config.ts` + `social.config.ts:98`: production refuses `local-only`/`change-me` values for `*_TOKEN`/`*_SECRET`/`*_URL` | `social/tests/linkPreviews/hostCircuitBreaker.test.ts` "production placeholder secrets" |
| S5 | Medium | Fixed now | `social/.../restoreStreak.handler.ts:29`: optimistic `saveIfUnchanged`, and the restore quota is re-checked inside the transaction | `social/tests/streaks/restoreStreakRace.test.ts` |
| S6 | Medium | Fixed now (cursor); unread count is by design | `listStoreConversations.handler.ts`: the cursor continues the scan window when filtering empties a page. `unreadConversationsCount` is the inbox badge total on purpose | `social/tests/storeInbox/storeInbox.service.test.ts` "store inbox search paging" |
| S7 | Low | False positive | `storeInboxView.service.ts:18-21` batches the summaries and latest messages in two queries | — |
| S8 | Low | False positive | `senderLabel` is the validated `senderName` (`storeInbox.validator.ts`, max 80) or `null` for buyers | — |
| S9 | Medium | Fixed now | `social/.../openStoreConversation.handler.ts:11` returns 403 `MESSAGE_NOT_ALLOWED` when a block exists in either direction, before a buyer or store conversation is created or opened | "store inbox blocks" |
| S10 | Low | Fixed now | `social/.../feed.repository.ts:10`: an id keyset (`id < cursor`) replaces Prisma's `cursor`+`skip`, so a deleted cursor row can't end or repeat the feed | `social/tests/feeds/followingFeedCursor.test.ts` |
| S11 | Low | Fixed now | `social/src/integrations/hostCircuitBreaker.integration.ts`, wired at `social/src/app.ts:76` (5 failures → 60 s open, bounded host map) | `social/tests/linkPreviews/hostCircuitBreaker.test.ts` |
| S12 | Low | False positive / by design | The route-level `Idempotency-Key` covers retries; blocking identical text from two deliberate sends would break normal chat | — |
| S13 | Low | False positive | `social/prisma/schema/chat.prisma:82,114`: members and messages cascade from `Conversation`. Keeping messages when one member leaves is the intended history behaviour | — |
| S14 | Low | False positive | `preKeyClaimLimit.service.ts` counts rows (at most 1500/h per requester, pruned after 24 h); JS numbers are 53-bit | — |

Counts (41 rows): Critical 1 (fixed now 1) · High 4 (fixed now 4) · Medium 15 (fixed now 11, partly 1, open 1, false positive 2) · Low/Info 21 (fixed now 3, already fixed via port or stage 1 8, partly 1, open 2, obsolete 1, false positive 5, informational 1).

Gates (2026-10-10): gateway `tsc` (src + tests) clean, vitest 26 files / 1628 tests pass; social `tsc` (src + tests) clean, vitest 54 passed / 3 skipped files, 345 tests pass.
