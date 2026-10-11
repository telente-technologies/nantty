# Zudomart Go Backend - Deep Scan Report

> Status update (2026-10-08): not all findings are resolved. The session denylist, trusted-proxy IP resolution, webhook allowlist default, HTTP security headers/CORS, financial arithmetic items F1/F2/F3/F5/F6/F11, and invalid-duration config guard have been remediated with focused tests. The critical payout duplicate-retry and message-handler panic findings are guarded in current code and now have regression tests. Ads settlement and the remaining findings are still open. See `security/audit/reports/REMEDIATIONS.md` for verified status.

> Generated: 2026-10-08
> Scope: services/go (platform + 17 modules + 8 deployables, 5841 .go files)
> Severity: CRITICAL / HIGH / MEDIUM / LOW

---

## 1. EXECUTIVE SUMMARY

The Go backend demonstrates strong security practices: Argon2id password hashing with timing-safe comparison, EdDSA JWT signing, constant-time comparisons, HMAC-based OTP with pepper, refresh token rotation with reuse detection, double-entry ledger with overflow guards, and serializable transactions. However, it contains multiple exploitable vulnerabilities - most critically a failing-open session denylist (revoked sessions allowed during Redis outages) and unvalidated X-Real-Ip/X-Forwarded-For headers that defeat IP-based access controls.

Priority actions:
1. Fix session denylist to fail-closed for admin/step-up operations (G1).
2. Validate X-Real-Ip/X-Forwarded-For only behind a trusted, configured proxy (G2, H4, H5).
3. Add security headers, CORS, and rate limiting to the HTTP server (G3-G6).
4. Move secrets out of .env.example and reject known placeholder values in production (G7).
5. Fix webhook IP allowlist default behavior (H5).

---

## 2. CRITICAL

### G1 - Failing-Open Session Denylist Allows Revoked Sessions During Redis Outages
File: services/go/platform/jwtauth/sessionDenylist.go:46-60

The function isSessionRevokedFailingOpen returns false (allow) on any Redis error:
go
revoked, err := denylist.IsSessionRevoked(checkCtx, sessionId)
if err != nil {
    denylistCheckFailures.Add(1)
    slog.ErrorContext(ctx, "session denylist check failed; allowing token until it expires", ...)
    return false  // FAILING OPEN
}

Risk: If Redis is unavailable or slow (>150ms), revoked sessions are allowed to continue until the access token expires (15 min default). An attacker with a stolen refresh token could maintain access during Redis outages.

Fix: Consider failing closed for high-security operations (step-up auth, admin actions). Add a circuit breaker that blocks all auth after N consecutive denylist failures. Reduce access token TTL to limit exposure window.

### G2 - Unvalidated X-Real-Ip Header Enables IP Spoofing
File: services/go/platform/staffauth/staffGuard.middleware.go:162-170
go
func ClientAddress(request *http.Request) string {
    if forwarded := strings.TrimSpace(request.Header.Get("X-Real-Ip")); forwarded != "" {
        return forwarded
    }
    host, _, err := net.SplitHostPort(request.RemoteAddr)
    if err != nil {
        return request.RemoteAddr
    }
    return host
}

Risk: The code trusts X-Real-Ip without verifying it comes from a trusted proxy. Attackers can spoof this header to bypass IP allowlists for admin access. Also used in modules/payments/src/modules/webhooks/controllers/webhooks.controller.go:36 (X-Forwarded-For).

Fix: Only trust these headers when running behind a known, configured reverse proxy. Add a configuration option TrustedProxyHeaders / TrustedProxyCIDRs.

### G3 - Missing Security Headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
File: services/go/platform/httpserver/ - no security headers set anywhere.

Risk: XSS, clickjacking, MIME sniffing, lack of HTTPS enforcement.

Fix: Add a security headers middleware setting Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, Permissions-Policy.

### G4 - No CORS Configuration
File: services/go/platform/httpserver/http.server.go - CORS is completely absent.

Risk: Any origin can make requests to the API. CSRF, data exfiltration from browser clients.

Fix: Implement CORS with strict origin allowlist.

### G5 - No Rate Limiting on Any Endpoint
File: Entire httpserver package - no rate limiting middleware exists.

Risk: Brute force, DoS, and API abuse. Auth endpoints (login, OTP, password reset) are especially vulnerable.

Fix: Add rate limiting middleware (token bucket per IP/user). Implement exponential backoff on failed auth attempts.

### G6 - Non-JSON Requests Have No Body Size Limit
File: services/go/platform/httpserver/json.response.go:11,35
go
const DefaultMaximumJsonBodyBytes = 1 << 20  // 1MB - only for JSON decoding

Risk: Non-JSON requests (multipart, form, binary) have no body size limits. http.MaxBytesReader is only applied in DecodeJsonBodyRejectingUnknownFields.

Fix: Apply body size limits to all request types, not just JSON.

### G7 - Hardcoded/Weak Secrets in .env.example
File: services/go/.env.example (multiple lines)

Issues:
- AUTH_SIGNING_KEY_ENCRYPTION_KEY decodes to local-only-signing-key-encryption
- AUTH_ONE_TIME_CODE_PEPPER decodes to local-only-one-time-code-pepper-
- USERS_INTERNAL_API_TOKEN=local-only-users-internal-token-0123456789
- LIVEKIT_API_KEY=devkey, LIVEKIT_API_SECRET=secret-only-for-local-development-0001
- AWS_ACCESS_KEY_ID=test, AWS_SECRET_ACCESS_KEY=test
- AUTH_OTP_EVENT_KEY, CATALOG_DATA_ENCRYPTION_KEY - all local-only-* placeholders

Risk: If .env.example is copied to .env without modification in production, all cryptographic keys and tokens would be predictable. Anyone who reads this repo can forge internal tokens and decrypt sensitive data.

Fix: Remove all secret values from .env.example - use empty placeholders. Add a startup check that rejects local-only-* values in production.


---

## 3. HIGH

### H1 - Refresh Token Reuse Detection Revokes Session But Does Not Invalidate Access Tokens Immediately
File: services/go/modules/auth/src/modules/sessions/commands/refreshSessionTokens/refreshSessionTokens.handler.go:44-49, 79-90

When refresh token reuse is detected, the session is revoked (added to denylist), but the current access token remains valid until expiry (up to 15 minutes). An attacker with a stolen access token continues to have access.

Fix: Add the session to denylist immediately. Consider shortening access token TTL to 5 minutes for faster revocation.

### H2 - OTP Delivery Mode log Allowed in Production (Insufficient Check)
File: services/go/modules/auth/src/configs/auth.config.go:75-77
go
if settings.IsProduction() && settings.OneTimeCodeDeliveryMode == "log" {
    reader.ReadRequiredString("AUTH_OTP_DELIVERY_NOT_LOG_IN_PRODUCTION")
}

Risk: This only adds a validation error but does not prevent startup - the app could still start with AUTH_OTP_DELIVERY=log in production if the error is ignored.

Fix: Make this a hard startup failure (panic/exit) rather than a collected problem.

### H3 - Social Sign-In Nonce Validation Has Timing Leak
File: services/go/modules/auth/src/integrations/socialIdentity.integration.go:115-122
go
return subtle.ConstantTimeCompare([]byte(claimed), []byte(rawNonce)) == 1 ||
       subtle.ConstantTimeCompare([]byte(strings.ToLower(claimed)), []byte(hex.EncodeToString(hashed[:]))) == 1

Risk: Two sequential ConstantTimeCompare calls create a timing side-channel. An attacker can distinguish between raw nonce match (fast return), hashed nonce match (slower), and no match (slowest).

Fix: Use a single constant-time comparison by always computing both and combining results.

### H4 - Staff Auth Network Policy Uses Unvalidated Client IP and Fails Open
File: services/go/platform/staffauth/staffGuard.middleware.go:145-158
go
func (guard Guard) refuseDisallowedNetwork(request *http.Request, staff Staff) *httpserver.ApiError {
    policy, err := guard.Registry.StaffNetworkPolicy()
    if err != nil {
        return nil  // Fails open if policy unavailable!
    }

Risk: Uses ClientAddress(request) which trusts X-Real-Ip (Issue G2). Fails open if network policy service is unavailable. An attacker could bypass IP restrictions by spoofing headers or during policy service outages.

### H5 - Webhook IP Allowlist Uses X-Forwarded-For Without Validation and Defaults to Allow-All
File: services/go/modules/payments/src/modules/webhooks/controllers/webhooks.controller.go:31-41
go
func (controller WebhooksController) sourceAllowed(request *http.Request) bool {
    allowlist := controller.Application.Container.Settings.Paystack.WebhookIpAllowlist
    if len(allowlist) == 0 {
        return true  // No allowlist = allow all!
    }
    source := strings.TrimSpace(strings.Split(request.Header.Get("X-Forwarded-For"), ",")[0])

Risk: If PAYSTACK_WEBHOOK_IP_ALLOWLIST is not set, all IPs are allowed. Uses X-Forwarded-For without proxy validation. Paystack webhook signatures are verified separately, so this is defense-in-depth only - but it should use RemoteAddr directly or a trusted proxy header.

### H6 - Argon2id Parameters Below OWASP 2023 Recommendations
File: services/go/platform/passwordhash/argon2id.hasher.go:22
go
var RecommendedArgon2idParameters = Argon2idParameters{
    MemoryKibibytes: 19 * 1024,  // ~19 MB
    Iterations: 2,
    Parallelism: 1,
    SaltLength: 16,
    KeyLength: 32,
}

Risk: 19 MB memory and 2 iterations is below OWASP 2023 recommendations (minimum 47 MB / 3 iterations for Argon2id). Parallelism of 1 doesn't leverage multi-core resistance.

Fix: Increase to at least: Memory=47 MB, Iterations=3, Parallelism=2. Make parameters configurable via environment variables.

### H7 - Registration Endpoint Returns EMAIL_TAKEN (Account Enumeration)
File: services/go/modules/auth/src/modules/registration/commands/registerAccount/registerAccount.handler.go:51-52
go
if taken, err := tx.Account.Query().Where(account.Email(email)).Exist(ctx); err != nil || taken {
    return services.FirstError(err, authErrors.ErrEmailAlreadyInUse)

Risk: Registration endpoint returns EMAIL_TAKEN error, enabling account enumeration.

Fix: Return generic "If this email exists, a verification code has been sent" message regardless of whether account exists.

### H8 - Missing Rate Limiting on All Auth Endpoints
File: Multiple auth handlers - no rate limiting visible.
Endpoints at risk: /auth/sessions/login (brute force), /auth/one-time-codes/send (OTP bombing), /auth/one-time-codes/verify (OTP brute force), /auth/passwords/reset (password reset), /auth/registration (account enumeration).

Fix: Add rate limiting middleware (token bucket per IP/account). Implement exponential backoff on failed attempts. Add CAPTCHA/honeypot after N failures.

### H9 - No Security Headers Middleware
File: services/go/platform/httpserver/standard.middleware.go
No CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers being set.

Fix: Add a security headers middleware.

### H10 - Error Details Potentially Leaked in Responses
File: services/go/platform/httpserver/api.error.go:44-49
go
func ConvertErrorToApiError(err error) *ApiError {
    var apiError *ApiError
    if errors.As(err, &apiError) {
        return apiError  // Returns internal error as-is
    }

Risk: Internal errors wrapped as ApiError return their original message to clients. Stack traces or internal details could leak if ApiError is constructed with sensitive data.

Fix: Sanitize error messages before returning to clients. Never include internal details in production error responses.


---

## 4. MEDIUM

### M1 - X-Device-Id Header Trusted Without Validation
File: services/go/modules/auth/src/utils/httpRequest.util.go:16
go
DeviceId: TruncateToLength(strings.TrimSpace(request.Header.Get("X-Device-Id")), 128)

Risk: The X-Device-Id header is used for new-device detection and session device tracking. An attacker can set this header to a known value to evade new-device detection or impersonate a different device.

Fix: Validate the device ID format (e.g., enforce a specific pattern like UUID or base64). Consider deriving the device ID from a cookie or authenticated token instead of a client-supplied header.

### M2 - Audit Trail IP Address Spoofable via X-Real-Ip
File: services/go/platform/staffauth/staffRequestAudit.middleware.go:75
go
IpAddress: ClientAddress(request),  // Uses unvalidated X-Real-Ip

Risk: Audit logs record the IP address from ClientAddress(), which trusts X-Real-Ip. An attacker can spoof their IP in audit logs, making forensic investigation unreliable.

Fix: Use request.RemoteAddr directly for audit logging, or validate the proxy chain before trusting forwarded headers.

### M3 - Internal API Token Only Validated in Production
File: services/go/modules/admin/src/configs/admin.config.go:76-79

Risk: The ADMIN_INTERNAL_API_TOKEN is required to be at least 32 characters, but this check applies regardless of environment. However, the token defaults to empty string, and in non-production environments, an empty token may be used.

Fix: Always require a non-empty internal API token in all environments, or document the security implications of an empty token in development.

### M4 - Refresh Token TTL of 30 Days
File: services/go/modules/auth/src/configs/auth.config.go:50
go
RefreshTokenTimeToLive: reader.ReadDurationOrDefault("AUTH_REFRESH_TOKEN_TTL", 30*24*time.Hour),

Risk: The default refresh token TTL is 30 days. Combined with a session maximum lifetime of 180 days, this means a stolen refresh token could be valid for up to a month. While refresh token rotation is implemented (which mitigates reuse), the long window increases the risk.

Fix: Reduce the default to 7-14 days, or implement refresh token expiration based on inactivity.

### M5 - Session Maximum Lifetime of 180 Days
File: services/go/modules/auth/src/configs/auth.config.go:51
go
SessionMaximumLifetime: reader.ReadDurationOrDefault("AUTH_SESSION_MAX_LIFETIME", 180*24*time.Hour),

Risk: Sessions can live for 180 days without re-authentication. For sensitive operations, this is a long time.

Fix: Reduce to 30-90 days, or require re-authentication for sensitive operations regardless of session age.

### M6 - OTP Send Endpoint Has No Rate Limiting
File: services/go/modules/auth/src/modules/oneTimeCodes/routes/oneTimeCodes.routes.go

Risk: The OTP send endpoint has no rate limiting. While there is a resend cooldown (default 1 minute), there is no per-IP or per-account limit on total OTP requests. This enables SMS/email bombing and resource exhaustion.

Fix: Add rate limiting on the OTP send endpoint, keyed on destination address and IP.

### M7 - Registration Endpoint Has No Rate Limiting
File: services/go/modules/auth/src/modules/registration/routes/registration.routes.go

Risk: The registration endpoint has no rate limiting. This enables account creation spam and resource exhaustion.

Fix: Add rate limiting on the registration endpoint, keyed on IP and email.

### M8 - ApplySecurityHeaders Defined But Never Wired Into Middleware Chain
File: services/go/platform/httpserver/standard.middleware.go:64-73
File: services/go/platform/servicemodule/deployable.runner.go:53-59

Risk: The ApplySecurityHeaders function exists but is never called in the middleware chain. Zero security headers are applied to any response.

Fix: Add httpserver.ApplySecurityHeaders to the middleware chain. Augment it to include Strict-Transport-Security and Content-Security-Policy.

### M9 - No Global Request Body Size Limit
File: services/go/platform/httpserver/http.server.go:31-39

Risk: The DefaultMaximumJsonBodyBytes (1 MiB) is enforced only in DecodeJsonBodyRejectingUnknownFields. The http.Server struct does not set MaxRequestBodyBytes. Any handler that reads the request body directly has no body size limit.

Fix: Set server.MaxRequestBodyBytes = httpserver.DefaultMaximumJsonBodyBytes on the http.Server struct.

### M10 - Health Check Readiness Probe Exposes Internal Component Names
File: services/go/platform/health/health.handler.go:30-33, 39-54

Risk: The /readyz endpoint returns a map of internal check names (e.g., "database", "redis", "event-bus") and their status to any caller - no authentication is required. This reveals internal architecture details to attackers.

Fix: Add an IP allow-list or authentication to health check endpoints in production. Consider returning a minimal 200/503 without the internal check breakdown to unauthenticated callers.


---

## 5. LOW

### L1 - X-Request-Id Header Used in Audit Logs Without Validation
File: services/go/platform/staffauth/staffRequestAudit.middleware.go:75

Risk: The X-Request-Id header is used in audit logs without validation. An attacker can set this header to arbitrary values, polluting audit trails.

Fix: Generate the request ID server-side, or validate that it matches a specific format (e.g., UUID).

### L2 - Known Dummy Password Constant for Timing Equalisation
File: services/go/modules/auth/src/utils/argon2id.util.go:26
go
const dummyPasswordForTimingEqualisation = "zudomart-timing-equaliser-1"

Risk: This is a known constant used to compute a dummy hash for timing equalisation when an account is not found. While the purpose is legitimate (prevent timing-based account enumeration), the constant is hardcoded and visible in source code.

Fix: Consider using a random per-instance value instead of a hardcoded constant, though the current approach is cryptographically sound.

### L3 - Argon2id Parameters on Lower Side
File: services/go/modules/auth/src/utils/argon2id.util.go:22
File: services/go/platform/passwordhash/argon2id.hasher.go:22
go
var RecommendedArgon2idParameters = Argon2idParameters{
    MemoryKibibytes: 19 * 1024,  // 19 MB
    Iterations: 2,
    Parallelism: 1,
    SaltLength: 16,
    KeyLength: 32,
}

Risk: 19 MB memory and 2 iterations is below current best practices, making offline brute-force attacks faster.

Fix: Increase memory to at least 64 MB (65536 KiB) and consider increasing iterations to 3-4.

### L4 - Password Hash Parameters Duplicated
File: services/go/platform/passwordhash/argon2id.hasher.go:22
File: services/go/modules/auth/src/utils/argon2id.util.go:22

Risk: The RecommendedArgon2idParameters constant is defined in two separate packages. If one is updated without the other, password verification could break or use weaker parameters.

Fix: Define the parameters in a single shared package (e.g., platform/passwordhash) and import from both locations.

### L5 - JWT Acceptable Skew of 30 Seconds
File: services/go/platform/jwtauth/accessToken.verifier.go:75
go
jwt.WithAcceptableSkew(30*time.Second)

Risk: 30 seconds of clock skew is reasonable but slightly generous. Most deployments use 5-30 seconds.

Fix: Reduce to 5-10 seconds if clock synchronization is reliable.

### L6 - Panic Recovery Can Write to an Already-Started Response
File: services/go/platform/httpserver/standard.middleware.go:33-45

Risk: If a handler has already called WriteHeader and/or Write before panicking, WriteJsonResponse will attempt to call WriteHeader(http.StatusInternalServerError) on a response that already has a status code. Go's http.ResponseWriter will log a "http: superfluous response.WriteHeader" warning and the response sent to the client will be corrupted.

Fix: Wrap the http.ResponseWriter in a middleware that tracks whether WriteHeader has been called. Only attempt to write the 500 response if headers have not been sent.

### L7 - Logging Redaction Is Shallow - Struct Fields Are Not Recursively Redacted
File: services/go/platform/logging/structured.logger.go:37-45

Risk: The redactSensitiveAttribute function only checks the top-level attribute key. When a struct is logged via slog.Any("request", requestBody), the entire struct is serialized as a single attribute. Individual fields within the struct are not inspected and will appear in logs in plaintext.

Fix: For attributes logged with slog.Any that resolve to structs, recursively walk the struct fields and redact any whose names match sensitive fragments.

### L8 - Outbox Relay Has No Backoff on Persistent Failures
File: services/go/platform/events/outbox.relay.go:21-44

Risk: When PublishPendingOutboxEventsInTransaction returns an error (e.g., RabbitMQ is down), the relay logs a warning and waits for the next ticker interval (default 500ms). There is no exponential backoff. If a broker outage persists for minutes, the relay generates a warning every 500ms, creating log spam.

Fix: Implement exponential backoff for persistent failures (e.g., start at 500ms, cap at 30s). Add panic recovery to the relay loop.

### L9 - Idempotency Response Is Written to Client Before Being Stored in Redis
File: services/go/platform/idempotency/requireIdempotencyKey.middleware.go:65-74

Risk: The bufferingResponseWriter writes to both the buffer AND the real response writer simultaneously. This means the client receives the response before it is stored in Redis. If the server crashes or the Redis write fails between the handler completing and the response being stored, the client has received a success response but the idempotency key is not persisted.

Fix: Buffer the response entirely (do not write to the client until the idempotency store confirms). Only write to the real ResponseWriter after SaveCompletedResponse succeeds.

### L10 - Health Check Liveness Endpoint Leaks Service Name
File: services/go/platform/health/health.handler.go:35-37

Risk: The /healthz endpoint returns the internal service name (e.g., "go-ads", "go-identity"). While not highly sensitive, it reveals internal service naming conventions and topology to unauthenticated callers.

Fix: Consider omitting the service name from health responses, or require authentication for health endpoints in production.


---

## 6. PRIORITY RECOMMENDATIONS

| Priority | Finding | Action |
|----------|---------|--------|
| P0 | G1 | Fix session denylist to fail-closed for admin/step-up operations |
| P0 | G2 | Validate X-Real-Ip/X-Forwarded-For only behind a trusted, configured proxy |
| P0 | G3 | Add security headers middleware (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) |
| P0 | G4 | Implement CORS with strict origin allowlist |
| P0 | G5 | Add global rate limiting middleware |
| P0 | G6 | Apply body size limits to all request types, not just JSON |
| P0 | G7 | Remove secret values from .env.example; reject local-only-* in production |
| P1 | H1 | Add session to denylist immediately on refresh token reuse |
| P1 | H2 | Make OTP delivery mode check a hard startup failure |
| H1 | H3 | Use single constant-time comparison for social nonce validation |
| P1 | H4 | Fail closed when staff network policy service is unavailable |
| P1 | H5 | Fix webhook IP allowlist default to deny; use RemoteAddr instead of X-Forwarded-For |
| P1 | H6 | Increase Argon2id parameters to OWASP 2023 minimums |
| P1 | H7 | Return generic response on registration to prevent account enumeration |
| P1 | H8 | Add rate limiting on all auth endpoints |
| P2 | H9 | Add security headers middleware |
| P2 | H10 | Sanitize error messages before returning to clients |
| P2 | M1 | Validate X-Device-Id header format |
| P2 | M2 | Use RemoteAddr for audit logging instead of X-Real-Ip |
| P2 | M3 | Require non-empty internal API token in all environments |
| P2 | M4 | Reduce refresh token TTL default to 7-14 days |
| P2 | M5 | Reduce session maximum lifetime to 30-90 days |
| P2 | M6 | Add rate limiting on OTP send endpoint |
| P2 | M7 | Add rate limiting on registration endpoint |
| P2 | M8 | Wire ApplySecurityHeaders into middleware chain |
| P2 | M9 | Set MaxRequestBodyBytes on http.Server struct |
| P2 | M10 | Add authentication to health check endpoints in production |

---

## 7. CONCLUSION

The Go backend has a solid cryptographic foundation (Argon2id, EdDSA, AES-GCM, constant-time comparisons, refresh token rotation) and demonstrates good architectural patterns (modular monolith, serializable transactions, double-entry ledger). However, there are **critical gaps in defense-in-depth**:

1. **Failing-open patterns** in session denylist and network policy checks allow attackers to bypass core security controls during infrastructure outages.
2. **Unvalidated forwarded headers** (X-Real-Ip, X-Forwarded-For) defeat IP-based access controls and audit logging integrity.
3. **Missing HTTP security infrastructure** (security headers, CORS, rate limiting, body size limits) leaves the API exposed to common attacks.
4. **Hardcoded placeholder secrets** in .env.example could be predictable in production if the file is copied without modification.

The fixes for the P0 items are straightforward and should be prioritized. The remaining findings represent defense-in-depth improvements that reduce the attack surface and improve forensic capabilities.

---

## Verification (2026-10-10)

Each finding was checked against the current tree on 2026-10-10. Paths are under `services/go/`. "Fixed" means the fix was already in the tree when checked (from the 2026-10-08 remediation or the earlier pass today). "Fixed now" means this pass fixed it and added a regression test.

| ID | Severity | Status | Evidence | Fix / test |
|---|---|---|---|---|
| G1 | Critical | Fixed (extended now) | `platform/jwtauth/sessionDenylist.go:46-58`: a Redis error or timeout rejects the token. Revoked **staff** sessions were never written to the shared denylist, so module-local staff guards in go-commerce/go-live/go-trust/go-ads/go-money kept accepting them for the full TTL. They are now written | `sessionDenylist_test.go` `TestDenylistOutageFailsClosedAndCountsFailure`. Fixed now: `modules/admin/src/modules/staffAuth/services/staffSessionDenylist.service.go` (ent hook, wired in `admin/src/app.go`), test `admin/adminStaffSessionDenylist.integration_test.go` |
| G2 | Critical | Fixed | `staffauth.ClientAddress` → `httpserver.ClientIP` (`platform/httpserver/clientIp.util.go:73`): forwarded headers are honoured only from trusted proxy CIDRs, using the rightmost untrusted hop. No module reads `X-Real-Ip`/`X-Forwarded-For` directly any more (grep) | httpserver tests |
| G3 | Critical | Fixed | `httpserver/standard.middleware.go:69` (CSP, XFO, nosniff, HSTS, Referrer-Policy), wired in `servicemodule/deployable.runner.go:68` | `TestApplySecurityHeadersSetsHardeningHeaders` |
| G4 | Critical | Fixed | `standard.middleware.go:83` `ApplyCors`, an allowlist from the environment | `TestApplyCorsHonorsConfiguredAllowlist` |
| G5 | Critical | Fixed (extended now) | Per-IP global limiter (`rateLimit.middleware.go:97`) and auth limiter (`:114`) are wired. Added now: an identifier-keyed lockout for password login (10 failures in 15 min lock the identifier for 15 min, unknown identifiers included, so the lockout reveals nothing). The limiters are in-memory per process | `platform/loginthrottle/` + `loginThrottle_test.go`; `auth/.../logInWithPassword.handler.go`; `auth/authLoginLockout.integration_test.go` |
| G6 | Critical | Fixed | `httpserver/requestBodyLimit.middleware.go` (2 MiB default, `HTTP_MAX_REQUEST_BODY_BYTES`), wired at `deployable.runner.go:67` | `TestLimitEveryRequestBody…` (2 tests) |
| G7 | Critical | Fixed | Production startup refuses any `*TOKEN/SECRET/KEY/PEPPER/PASSWORD` that holds a `local-only…` value (plain or base64) or a known example value (`platform/config/placeholderSecrets.go`, `deployable.runner.go:33`). `.env.example` keeps the local-only values for development | `placeholderSecrets_test.go` |
| H1 | High | Fixed | Revoking a session (including on refresh-token reuse, `refreshSessionTokens.handler.go:79-90`) runs the ent hook `auth/src/services/sessionDenylist.service.go:22-50`, which writes the session to the denylist on commit. The access token is rejected at once | `authSessionDenylist.integration_test.go` |
| H2 | High | False positive (message clarified) | A reported config problem already stops startup (`CombinedConfigurationError`, `deployable.runner.go:53`). `auth.config.go:84-85` now reports it with a clear message | — |
| H3 | High | Fixed (test added now) | `auth/src/integrations/socialIdentity.integration.go:120-122` computes both comparisons and combines them with `|` | Added now: `socialIdentity.integration_test.go` |
| H4 | High | Fixed | `staffauth/staffGuard.middleware.go:146-158`: an unavailable policy port or a lookup error returns 503, and the IP comes from `ClientIP` | staffauth tests |
| H5 | High | Fixed | `payments/src/modules/webhooks/controllers/webhooks.controller.go:30-37`: an empty allowlist denies, and the source is `ClientIP` | (payments is owned by Flutterwave stage 2) |
| H6 | High | False positive | `platform/passwordhash/argon2id.hasher.go:22` uses m=19456 KiB, t=2, p=1, which is one of the OWASP Password Storage Cheat Sheet's equivalent Argon2id minimums (alongside 46 MiB/t=1). The report's 47 MB/t=3 is not the OWASP figure. Parameters are encoded in each hash, so they can be raised later | — |
| H7 | High | False positive | `registerAccount.handler.go:41-52`: `EMAIL_TAKEN` is returned only after consuming a signup OTP token proven for that exact email, so only someone who controls the inbox can see it | — |
| H8 | High | Fixed (extended now) | `RateLimitAuthEndpoints` is on login, refresh, register, OTP, social, password reset, step-up and widget tokens. The identifier lockout was added now (see G5) | see G5 |
| H9 | High | Fixed | Same as M8 | see G3 |
| H10 | High | False positive | `ConvertErrorToApiError` passes through only `*ApiError` values, which are deliberately client-facing. Any other error becomes the generic 500 | — |
| M1 | Medium | Fixed | `auth/src/utils/httpRequest.util.go:12-24` keeps only `^[A-Za-z0-9._:-]{8,128}$`. A device ID is client-generated by design | Added now: `httpRequest.util_test.go` |
| M2 | Medium | Fixed | Audit IPs come from `ClientIP` (`staffRequestAudit.middleware.go`, `staffaudit/staffAudit.recorder.go:85`) | — |
| M3 | Medium | False positive | Every internal endpoint refuses an empty token (`expected == "" ||` …, e.g. `admin/.../auditLog.controller.go:134-135`), and the token is length-checked when set | — |
| M4 | Medium | Open (accepted, configurable) | `auth.config.go:55` defaults to 30 days, with rotation and reuse detection | Owner: product/identity. Set `AUTH_REFRESH_TOKEN_TTL` if a shorter window is wanted |
| M5 | Medium | Open (accepted, configurable) | `auth.config.go:56` defaults to 180 days; money actions need user step-up (`POST /auth/step-up`, stage 1) | Owner: product. `AUTH_SESSION_MAX_LIFETIME` |
| M6 | Medium | Fixed | `oneTimeCodes.routes.go:13` adds the per-IP auth limiter, on top of the per-destination cooldown | — |
| M7 | Medium | Fixed | `registration.routes.go:13` has the per-IP auth limiter, and registration needs a verified OTP | — |
| M8 | Medium | Fixed | `deployable.runner.go:68` | `TestApplySecurityHeadersSetsHardeningHeaders` |
| M9 | Medium | Fixed | `deployable.runner.go:67` `LimitEveryRequestBody` | `requestBodyLimit.middleware_test.go` |
| M10 | Medium | Fixed | `health/health.handler.go:55`: check names are shown only to a trusted peer with no forwarded header | `TestReadinessHidesCheckNamesFromForwardedOrPublicCallers` |
| L1 | Low | Fixed now | `AssignRequestIdToEveryRequest` validated the ID, but `staffRequestAudit`, `staffaudit` and `catalog/staffChange` still read the raw header. They now use `httpserver.RequestIdFromContext` | `TestForgedRequestIdsAreReplacedBeforeAuditsCanRecordThem` |
| L2 | Low | Fixed now | `passwordhash/argon2id.hasher.go`: the timing dummy is a random 32-byte value per process | `TestTheTimingDummyIsRandomPerProcessAndMatchesNoGuessablePassword` |
| L3 | Low | False positive | Same as H6 | — |
| L4 | Low | Fixed | `auth/src/utils/argon2id.util.go` aliases `platform/passwordhash`, so there is one definition | — |
| L5 | Low | False positive | A 30 s skew (`accessToken.verifier.go:76`) is within the report's own 5-30 s range | — |
| L6 | Low | Fixed | `standard.middleware.go:38-44` tracks whether headers were sent | `TestRecoverFromPanicsDoesNotRewriteAStartedResponse` |
| L7 | Low | Fixed now | `platform/logging/nestedRedaction.go`: structs, maps and slices logged with `slog.Any` are walked, and sensitive keys are redacted at any depth. Free-text error messages are still not scanned | `logging/structured.logger_test.go` |
| L8 | Low | Fixed | `events/outbox.relay.go`: exponential backoff (cap 30 s) and panic recovery | `TestOutboxRelayBacksOffWhileTheBrokerIsDown`, `TestOutboxRelaySurvivesAPanickingBatch` |
| L9 | Low | Fixed | `idempotency/requireIdempotencyKey.middleware.go:93-106`: the response is buffered and stored before it is written to the client | `TestTheClientSeesNothingBeforeTheResponseIsStored` |
| L10 | Low | Fixed | `health.handler.go:35-36` no longer returns the service name | `TestHealthResponsesDoNotRevealTheServiceName` |

Counts: Critical 7 (Fixed 7) · High 10 (Fixed 6, False positive 4) · Medium 10 (Fixed 7, False positive 1, Open 2) · Low 10 (Fixed 5, Fixed now 3, False positive 2). In total: Fixed 25, Fixed now 3 (L1, L2, L7) plus extensions to G1/G5/H8, False positive 7, Open 2 (M4/M5, both configurable product decisions).
