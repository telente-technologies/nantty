# Findings (static review, 4 Oct 2026)

Scope and rules are in `../ENVIRONMENT_BOUNDARY.md`, the attack surface in `ATTACK_SURFACE.md`, and fixes with their checks in `REMEDIATIONS.md`. Secrets appear only as redacted prefixes.

Severity weighs impact against likelihood for this checkout, which is pre-launch with no live money.

Status values:
- **Fixed**: code changed and tests pass.
- **Fixed, owner review**: code changed; a named owner must sign off.
- **Fixed by the money agent**: owned and fixed in the money paths.
- **Accepted risk**: left as is, with a reason.

| ID | Title | Severity | Status |
|---|---|---|---|
| SEC-0001 | Forged `X-Forwarded-For` bypasses gateway rate limits | High | Fixed |
| SEC-0002 | Smile ID callback accepts stale signatures and results for another user | High | Fixed |
| SEC-0003 | Staff invite tokens written to logs | Medium | Fixed |
| SEC-0004 | Paystack `authorization_code` kept in stored webhook payloads | Medium | Fixed |
| SEC-0005 | Protocol-relative `//host` links treated as internal | Medium | Fixed |
| SEC-0006 | In-app browser opens non-http schemes | Medium | Fixed |
| SEC-0007 | Identity verification start has no rate limit | Medium | Fixed |
| SEC-0008 | Paystack authorization_code returned to and accepted from devices | High | Fixed |
| SEC-0009 | Copyright takedown and strike decisions lack admin step-up | Medium | Fixed |
| SEC-0010 | TS services trust an unsigned gateway account header | High | Fixed |
| SEC-0011 | Shipping address PII readable by every service role | Medium | Fixed, owner approved 2026-10-04 |
| SEC-0012 | grpc-go GO-2026-6443 reachable from goMoney | Medium | Fixed |
| SEC-0013 | Refund amount ≤0 treated as a full refund | High | Fixed |
| SEC-0014 | Monetisation hold read-then-write race | Medium | Fixed |
| SEC-0015 | Google Play RTDN push token in the query string | Low | Fixed (follow-up open) |
| SEC-0016 | Dead legal-notice routes in go-identity | Low | Fixed |
| SEC-0017 | Ad click redirect broken through the gateway | Low | Fixed |
| SEC-0018 | Realtime channel membership not rechecked | Medium | Fixed |
| SEC-0019 | Test RSA key in testdata trips secret scanners | Info | Accepted risk |
| SEC-0020 | pnpm audit highs in build-time-only packages | Low | Accepted risk |
| SEC-0021 | Local compose images pinned to `:latest` | Low | Accepted risk |
| SEC-0022 | Ledger owner role can drop append-only triggers | Medium | Accepted risk |
| SEC-0023 | User access tokens ignore session revocation and account status | Medium | Fixed |
| SEC-0024 | Login username lookup skips NFKC normalisation | Low | Fixed |

---

## SEC-0001 Forged X-Forwarded-For bypasses gateway rate limits
- **Where:** client IP resolution in `services/typescript/gateway`.
- **Issue:** the gateway trusted the leftmost `X-Forwarded-For` value. Every request could claim a new IP and so dodge per-IP limits and probe detection.
- **Fix:** `TRUSTED_PROXY_HOPS` (default 1) picks the address added by the last trusted proxy. The value must be a non-negative integer.
- **Test:** `gateway/tests/clientIpTrust.handler.test.ts`.
- **Status:** Fixed (static agent).

## SEC-0002 Smile ID signature freshness and user match
- **Where:** `users/src/modules/identityVerification/services/smileCallback.service.go`.
- **Issue:** a captured signed callback could be replayed later. A result could also be applied to a case owned by another user.
- **Fix:** callbacks must fall inside a timestamp window, and the callback's user must match the case owner.
- **Test:** `smileCallback.service_test.go`.
- **Status:** Fixed (static agent).

## SEC-0003 Staff invite tokens in logs
- **Where:** `admin/src/integrations/invitationDelivery.integration.go`.
- **Issue:** the log-only delivery path printed the invite link with its token.
- **Fix:** the token is redacted from log lines.
- **Status:** Fixed (static agent).

## SEC-0004 authorization_code in stored webhook payloads
- **Where:** payments webhook persistence.
- **Issue:** stored raw payloads kept Paystack's `authorization_code`, which is a reusable card authorisation.
- **Fix:** the code is redacted before storage (`payments/src/utils/webhookRedaction.util.go`).
- **Test:** `webhookRedaction.util_test.go`.
- **Status:** Fixed (static agent).

## SEC-0005 `//host` links treated as internal
- **Where:** `apps/webapp/src/utils/postLinks.util.ts`, `apps/mobile/src/components/chat/chatLinks.util.ts`.
- **Issue:** a link starting with `//` passed the "starts with /" check and navigated off-site.
- **Fix:** protocol-relative links are classified as external.
- **Status:** Fixed (static agent).

## SEC-0006 Non-http schemes in the in-app browser
- **Where:** `apps/mobile/src/components/links/openLink.util.ts`.
- **Issue:** the in-app browser could open `javascript:`, `intent:` and similar schemes.
- **Fix:** only `http(s)` links open in the in-app browser.
- **Status:** Fixed (static agent).

## SEC-0007 Verification start rate limit
- **Where:** the gateway's route rate-limit policy.
- **Issue:** starting identity verification calls a paid third party, and the route had no limit of its own.
- **Fix:** the route now has a dedicated limit.
- **Status:** Fixed (static agent).

## SEC-0008 / SEC-0013 Money paths
- **SEC-0008:** devices no longer receive or send the Paystack `authorization_code`; charges reference an owner-scoped saved-card id and renewals use the server-side encrypted authorization. Tests assert it never appears in responses or logs.
- **SEC-0013:** refund amounts ≤0 are rejected with 422; a full refund must be explicit.
- Both were fixed by the money agent alongside exactly-once refunds (intent row + ledger entry before the Paystack call). Tracked in `docs/verification/finalCheckReport.md` section 0.5.
- **Status:** Fixed.

## SEC-0009 Copyright decisions lack step-up
- **Where:** `moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go`.
- **Issue:** five decision routes needed only the `copyright:review` permission:
  - uphold, which takes content down and issues a strike;
  - counter-notice accept, reject and court-action.

  Comparable decisions also require step-up: IP-claim uphold, verification approve/reject and security-case decide. So a stolen staff access token alone could issue strikes.
- **Fix:**
  - The five routes now require `X-Step-Up-Token`. The policy update route already did.
  - The decisions were already audit-logged: `copyright.upheld`, `user.copyright_strike_added` and `copyright.counter_notice_*`.
  - The admin client sends step-up on these calls (`apps/admin/src/config/apiAccess.config.ts`).
- **Test:** `moderationClaims.integration_test.go` expects 403 without step-up and 200 with it. The copyright integration tests pass against Postgres.
- **Status:** Fixed.

## SEC-0010 Unsigned gateway identity header
- **Where:** social, notifications, media, search and support read `x-zudomart-account-id` with no proof that it came from the gateway.
- **Issue:** anything that can reach a TS service port can act as any user. The Go services re-verify the bearer token; the TS services did not.
- **Fix:**
  - The gateway signs the identity context with HMAC-SHA256, using `GATEWAY_IDENTITY_SECRET` (at least 32 characters). The signature goes in `x-zudomart-identity-signature` and covers:
    - version and timestamp;
    - method, path and request id;
    - account id, session id, age bracket and viewer.
  - Each TS service runs `src/middlewares/gatewayIdentity.middleware.ts` before routing. A request that carries any identity header, or a signature, is rejected with `401 GATEWAY_IDENTITY_INVALID` unless the signature is valid and less than 60 s old.
  - Requests with no identity headers are treated as guests.
  - `GATEWAY_IDENTITY_PREVIOUS_SECRET` allows key rotation. Services refuse to start without the secret.
- **Why HMAC rather than a forwarded JWT:**
  - It needs no new dependency; three of the services lack `jose`.
  - It binds the identity to one request, by method, path, request id and time.
  - A direct call to a service with the user's own token also fails.
- **Test:**
  - `gateway/tests/identitySigning.test.ts`.
  - `tests/middlewares/gatewayIdentity.middleware.test.ts` in each of the five services. It covers unsigned, expired, wrong-key, tampered account and age bracket, a different method or path, and rotation.
- **Status:** Fixed.

## SEC-0011 Shipping address PII readable by every service
- **Where:** `users` migration `20261003170000` granted the address columns to `zudomart_readers`, and every `svc_*` role belongs to that group.
- **Issue:** social, ads, search, intelligence and other services could read recipient name, phone and street address. Only orders actually reads them, through `platform/usersdirectory.FindShippingAddress`.
- **Fix:** migration `users/src/migrations/20261004210000_restrict_shipping_address_reads_to_orders.up.sql`:
  1. grants the same columns to `svc_orders` and `svc_commerce`, but only if the role exists and already belongs to `zudomart_readers`;
  2. revokes `shipping_addresses` from `zudomart_readers`.

  The net effect only removes access; no role gains access it did not already have. Payments does not read addresses, so receipts are unaffected. `atlas.sum` has been rehashed.
- **Status:** Fixed. Owner approved on 2026-10-04.

## SEC-0012 grpc-go GO-2026-6443
- **Where:** goMoney calls `platform/servicemodule`, which reaches `transport.http2Server.HandleStreams`.
- **Issue:** a request with no `:authority` or Host header panics the server.
- **Fix:**
  - `google.golang.org/grpc` is raised to `v1.85.0-dev.0.20260825072537-93e31b48545e` in the `services/contracts`, `services/go/platform` and `services/go/deployables` go.mod files. This is the fixed commit; there is no tagged release yet.
  - `go.work`, which every Dockerfile builds with, selects it for all modules.
- **Evidence:** `audit/evidence/govulncheck-goDeployables-after-grpc-2026-10-04.txt` reports 0 reachable vulnerabilities. The deployables, platform and contracts build and their tests pass.
- **Status:** Fixed. Move to `v1.85.0` once it is tagged.

## SEC-0014 Monetisation hold race
- **Where:** `wallet/src/modules/payouts/services/monetisationHolds.service.go`.
- **Issue:** the code read the hold, compared timestamps in Go, then upserted. With two health events in flight at once, an older "can monetise" event could overwrite a newer restriction and release held creator earnings.
- **Fix:**
  - The update is now one atomic upsert on the primary key: `ON CONFLICT (id) DO UPDATE ... WHERE monetisation_holds.health_changed_at <= EXCLUDED.health_changed_at`.
  - A stale event that the database suppresses (it returns no rows) is a no-op.
- **Test:**
  - Unit: `monetisationHolds.service_test.go` checks the SQL shape.
  - Integration: `TestConcurrentHealthEventsSettleOnTheNewestOne` sends 40 concurrent events. It and `TestRestrictedCreatorEarningsStayPendingUntilMonetisationIsRestored` pass against Postgres.
- **Status:** Fixed.

## SEC-0015 Google Play RTDN token in the query string
- **Where:** `payments/src/modules/webhooks/controllers/webhooks.controller.go`.
- **Issue:** a `?token=` value ends up in ALB, CDN and gateway access logs.
- **Fix:**
  - The controller ignores the query string and reads the token from `X-Zudomart-Push-Token` or `Authorization: Bearer`.
  - The gateway forwards `x-zudomart-push-token` on webhook routes.
- **Test:** `webhooks.controller_test.go`.
- **Follow-up (payments owner):** Google Pub/Sub push cannot set custom headers. Before enabling Play billing:
  - switch the subscription to Pub/Sub OIDC push auth;
  - in `googlePlay.integration.go`, verify the Google-signed JWT: issuer `accounts.google.com`, the configured audience, and the configured service-account email.

  Until then, RTDN delivery needs a relay that can set headers.
- **Status:** Fixed (follow-up open).

## SEC-0016 Dead legal-notice routes
- **Where:** go-identity, `users/src/modules/legal/routes/legal.routes.go`.
- **Issue:** seven routes duplicated ones in ts-notifications: `/api/v1/admin/legal/notices*` plus the notice-draft, test-send and preview routes. The gateway only routes them to notifications. The identity copies were unreachable through the gateway but still live on the service port, with their own permission logic.
- **Fix:** the seven routes and their controller methods are removed from identity, leaving notifications as the only implementation. The users legal integration test now expects 404 and passes.
- **Follow-up:** two leftovers can be deleted:
  - the now-unused identity commands and queries for notices;
  - the internal progress route `PUT /api/v1/internal/legal/notices/{id}/progress`, which nothing calls.
- **Status:** Fixed.

## SEC-0017 Ad click redirect
- **Where:** the gateway proxy and `ads/src/modules/tracking`.
- **Issue:** clicks on `/api/v1/ads/r/{token}` failed, because the gateway dropped `Location` and required a bearer token on that route. A naive fix that forwards any `Location` would create an open redirect.
- **Fix:**
  - A dedicated gateway route, `GET /api/v1/ads/r/` with optional auth and `redirectPassthrough`, forwards `Location` only on that route.
  - It forwards only `https://` targets (with a host and no credentials) or `zudomart://` targets. Anything else returns `502 UNSAFE_REDIRECT`.
  - On the backend, the target still comes only from the signed click token and the approved creative, and must now pass `IsSafeClickTarget` before the redirect.
- **Test:** `gateway/tests/adRedirect.handler.test.ts`, `ads/src/services/adDestination.service_test.go`.
- **Status:** Fixed.

## SEC-0018 Realtime membership not rechecked
- **Where:** `services/elixir/realtime`.
- **Issue:** conversation and live access was checked only at subscribe time. A removed group member or a banned viewer kept receiving messages.
- **Fix:**
  - Each socket rechecks all of its subscriptions every `:subscription_recheck_ms` (default 60 s). Revoked topics are dropped with a `subscriptions.revoked` frame, and live presence is untracked.
  - The domain event router (`Realtime.Topics.SubscriptionGuard`) turns three events into an immediate recheck for the affected account on that topic: `conversation.memberRemoved`, `conversation.memberLeft` and `liveViewer.banned`.
- **Test:** `test/realtime/subscription.guard_test.exs`. The full suite (63 tests, 0 failures) and the format check pass in Docker `elixir:1.19`.
- **Follow-up:** social does not publish a member-removed event yet. Until it does, revocation can take up to 60 s.
- **Status:** Fixed.

## SEC-0019 Test RSA key in testdata (accepted risk)
- `payments/src/integrations/testdata/googlePlay/serviceAccount.json` is a generated key for project `zudomart-test`, with a placeholder token URI. It grants nothing. Add it to the secret-scanner allowlist.

## SEC-0020 Build-time pnpm highs (accepted risk)
- `audit/evidence/pnpmAudit-prod-2026-10-04.txt`: the high advisories are in build tooling that never ships in a runtime image. Recheck on every dependency bump.

## SEC-0021 `:latest` images (accepted risk)
- These are in local compose only (`infra/local/docker-compose.yml`). Pin them by digest if drift causes problems, and pin deployed images by digest.

## SEC-0022 Ledger owner can drop append-only triggers (accepted risk)
- The runtime role that owns the ledger and escrow schemas can run `DROP TRIGGER`, so an attacker holding that connection could rewrite history. Grants and triggers were not weakened in this review.
- **Recommended follow-up:** use separate roles for migrations and runtime.
  - A migration-owner role owns the schemas, runs Atlas, and is never used at runtime.
  - The runtime `svc_*` roles get DML only and own nothing.

  `infra/aws` already defines `svc_migrator`. Move schema ownership to it, then remove ownership from `svc_ledger`, `svc_escrow` and `svc_money`.

---

## SEC-0023 User access tokens ignore session revocation and account status
- **Severity:** Medium
- **Status:** Fixed (red-team run 2); validated against the running stack with a negative-control reproduction. Owner review recommended for the auth hot-path change.
- **Where:** `services/go/platform/jwtauth/requireAccessToken.middleware.go` + `accessToken.verifier.go`. Contrast staff path `platform/staffauth/staffGuard.middleware.go` which already rechecks `IsStaffSessionActive`.
- **Issue:** Regular-user requests were authorised by a pure stateless JWT check. Logout, "log out other sessions", password change, suspend and ban all revoke the session rows in the DB, but nothing rechecked that state on the read path, so a revoked/stolen access token kept working for up to `AUTH_ACCESS_TOKEN_TTL` (default 15m), including money-adjacent routes.
- **Reproduction (local, 127.0.0.1):** with the denylist disabled, `POST /api/v1/auth/logout` then `GET /api/v1/auth/sessions` with the same token returned 200; after a password change a sibling session's token still returned 200. Evidence: `security/audit/evidence/SEC-0023-reproduction-2026-10-04.txt`.
- **Fix:** Valkey session denylist keyed by `sessionId`, TTL = access-token TTL + 1m, written (after commit) by an ent Session hook on every revoking update plus a 30s sweeper backup; the access-token verifier rejects denylisted sessions. Fail-open on a Valkey outage (TTL bounds exposure; an auth outage would be worse), with error-metric counters. Required in production via `AUTH_SESSION_DENYLIST_URL`/`VALKEY_URL`.
- **Regression tests:** `platform/jwtauth/sessionDenylist_test.go`; `modules/auth/authSessionDenylist.integration_test.go` (pre-revocation token -> 401 after logout, revoke-others, ban, and password change).
- **Residual:** staff role *downgrade* without session revocation still carries old permissions until the 10m staff token TTL (permissions come from JWT claims; session is rechecked but claims are not). Bounded; recommend revoking staff sessions on permission change. Not changed here.

## SEC-0024 Login username lookup skipped the NFKC normalisation registration applies
- **Severity:** Low
- **Status:** Fixed (red-team run 2); table test added.
- **Where:** `modules/auth/src/modules/sessions/commands/logInWithPassword/logInWithPassword.handler.go` vs `platform/usernames/usernameRules.util.go`.
- **Issue:** Registration stored usernames NFKC+lowercased; login lowercased only, so a compatibility-character username (e.g. full-width) failed to match (usability gap, not a bypass — stored usernames are already normalised ASCII; emails were already consistent).
- **Fix:** login routes the username branch through `usernames.NormalizeRequestedUsername`; email branch unchanged. Test `logInWithPassword.handler_test.go`.
