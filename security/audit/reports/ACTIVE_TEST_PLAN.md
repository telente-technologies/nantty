# Active red-team test plan (live phases)

Every run follows `../ENVIRONMENT_BOUNDARY.md` and the script header contract in `security/README.md`.

Ground rules:
- Targets are `127.0.0.1` only. Never `betng-*`.
- The previous payment provider is the fake server. Scripts refuse `sk_live_`/`pk_live_` keys and refuse to run with `APP_ENV=production`.
- One heavy run at a time, under `nice -n 5`.
- Before and after every financial run, snapshot the ledger, wallet, escrow and payments tables to `audit/snapshots/`.
- Ledger triggers and grants are never weakened.
- Logs go to `audit/logs/`; evidence (secrets redacted) goes to `audit/evidence/`.

## Phase 0: setup
1. Start the stack: `docker compose -f infra/local/docker-compose.yml up -d`, then the services from `.env.example` values with `LEGACY_PROVIDER_API_BASE_URL` pointing at the fake previous-provider.
2. Pre-flight script: check loopback-only targets, no live keys, and `GATEWAY_IDENTITY_SECRET` set everywhere.
3. Seed the actors: two buyers, a seller (Business plan), a creator, a staff account with and without step-up, and a minor account.

## Phase 1: regression of fixed findings (`security/regression/`)

| Check | Attack | Pass if | Safety |
|---|---|---|---|
| SEC-0001 | 200 requests with rotating `X-Forwarded-For` | rate limit trips on the real client IP | SAFE |
| SEC-0002 | Replay a signed Smile callback older than the window; send a callback for another user's case | both rejected | SAFE (sandbox signature) |
| SEC-0003/0004 | Grep logs and stored webhook payloads after an invite and a previous-provider charge | no invite token, no `AUTH_` codes | SANDBOX-ONLY |
| SEC-0005/0006 | Render `//evil.test`, `javascript:` and `intent:` links in web and mobile link utils | external or blocked | SAFE |
| SEC-0007 | Burst verification starts | 429 after the limit | SAFE |
| SEC-0009 | Uphold a copyright claim and decide a counter-notice with an access token only | 403; 200 with step-up; audit rows present | SAFE |
| SEC-0010 | Call each TS service port (8104/8105/8108/8109/8111) directly with `x-zudomart-account-id` but no signature, an expired signature, a signature for a different path or method, or a tampered age bracket | 401 `GATEWAY_IDENTITY_INVALID` every time; through the gateway the same calls succeed | SAFE |
| SEC-0011 | As `svc_social`, `svc_ads`, `svc_search` and `svc_intelligence`: `SELECT phone FROM users.shipping_addresses LIMIT 1` | permission denied; `svc_commerce` succeeds | SAFE (read-only SQL) |
| SEC-0012 | gRPC request to goMoney with no `:authority` | no panic; service stays up | SAFE |
| SEC-0014 | Fire 50 concurrent health events (newest = restricted) at the wallet consumer | hold ends paused; payout run moves no creator funds | SANDBOX-ONLY |
| SEC-0015 | POST an RTDN with `?token=` only | rejected; header token accepted | SAFE |
| SEC-0016 | Call identity `/api/v1/admin/legal/notices` directly | 404 | SAFE |
| SEC-0017 | Follow `/api/v1/ads/r/{token}` anonymously; tamper with the token; try to plant an `http:` or `javascript:` destination through ad creation | valid token gets a 302 to the approved https target; tampered token 404; unsafe targets refused at review, backend and gateway | SAFE |
| SEC-0018 | Subscribe to a group conversation, remove the member, wait one recheck interval (set to 2 s for the run); ban a live viewer | `subscriptions.revoked` frame; no further messages | SAFE |

## Phase 2: authentication and authorisation (`security/authorization/`)
- Build the route table with `routeInventory.py`. For every route, try no token, an expired token, a token for another user (IDOR on ids in path and body), a staff token without the permission, and a staff token without step-up.
- Internal routes: hit `/internal/` through the gateway with encodings (`%2e`, double encoding, `\`, `;`); expect 404.
- Check that each Go service rejects the gateway HMAC header when it is used as the only credential (they must keep verifying the JWT).

## Phase 3: business logic (`security/business_logic/`, SANDBOX-ONLY)
- Coupon and price tampering at checkout; changing quantity or price in an in-flight checkout.
- Escrow state skips: confirm receipt before shipping, dispute after release, double release.
- Refund caps: partial refunds summing to more than paid; refund after payout.
- Subscription: renewal at full price after a discount or trial; plan downgrade timing; Business 1% vs 1.5% fee.
- Coins and ZudoPoints: negative amounts, transfer to self, conversion rounding.

## Phase 4: races (`security/race/`, SANDBOX-ONLY, snapshots required)
- Parallel refund requests for one order; parallel withdrawals beyond balance; double webhook delivery (charge, transfer, refund); concurrent coin transfers.
- Pass if the ledger balances, no duplicate provider calls happen (fake previous-provider state), and the before/after snapshot diff matches the expected entries only.

## Phase 5: abuse and fuzzing (`security/abuse/`, `security/fuzz/`)
- OTP, login, report and verification-start floods per IP and device.
- JSON body fuzzing on high-traffic routes: oversized fields, type confusion, unicode, deep nesting. Header fuzzing on the gateway, including spoofed `x-zudomart-*` headers.
- Realtime: subscription flood, frames that are too large, auth deadline.

## Phase 6: resilience (`security/resilience/`, bounded)
- Stop one upstream and check the gateway returns 502/504 with no stack traces.
- Slow Postgres via `pg_sleep` in a test-only path; check timeouts.
- RabbitMQ backlog; check outbox relays and dead-letter queues behave and nothing double-applies on recovery.

## Exit criteria
- Every Phase 1 row passes.
- No new High finding open.
- Ledger snapshots reconcile.
- `docker compose stop` at the end.
- New findings are added to `FINDINGS.md` as SEC-0023 onwards.
