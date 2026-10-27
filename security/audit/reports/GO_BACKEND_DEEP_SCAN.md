# Go Backend Deep Scan — Gaps, Bugs & Security Issues

> Status update (2026-10-08): this backlog is not fully resolved. Remediated with focused tests: fail-closed session denylist, trusted-proxy IP resolution, deny-by-default webhook allowlist, HTTP security headers/CORS, financial findings F1/F2/F3/F5/F6/F11, and rejection of non-positive duration settings. The payout duplicate-retry and message-handler panic findings are guarded in current code and have regression tests. Ads settlement, auth rate limiting, stricter production config gates, and other findings remain open. The original finding list below is a historical scan, not a closure report; see `security/audit/reports/REMEDIATIONS.md` for verified status.

**Date:** 2026-10-06
**Scope:** `services/go` — the entire Go workspace (19 modules: `platform`, `deployables`, 17 business modules), ~1.24M LOC of non-test Go, 945 HTTP route registrations, 6 deployable binaries.
**Method:** automated tooling (`go build`, `go vet`, `gosec`, `govulncheck`) + 8 parallel deep-review agents (auth, money-core, money-flows, HTTP surface, platform infra, commerce, identity/admin, ads-live-moderation), each tracing request flows end-to-end against source.
**Baseline:** cross-checked against the prior audit `security/audit/reports/FINDINGS.md` (SEC-0001…SEC-0024, mostly TypeScript gateway). No finding below duplicates a SEC finding; regression notes are in §9.

> **95 findings:** 3 Critical · 18 High · 33 Medium · 26 Low · 15 Info.
> Finding IDs are scoped by reviewer: `MONEY-`, `FLOW-`, `COM-` (money/commerce), `AUTH-`, `ADM-` (identity), `HTTP-`, `INFRA-` (cross-cutting/platform), `TRU-` (ads/live/moderation).

---

## 1. Executive summary

The Go backend is **fundamentally well-built**: parameterised SQL everywhere, `pgx.Identifier.Sanitize()` for dynamic identifiers, 1 MiB body caps with `DisallowUnknownFields`, constant-time token comparisons, signature-verified webhooks (the previous payment provider/LiveKit/Smile-ID), a real double-entry ledger with append-only triggers, `FOR UPDATE SKIP LOCKED` claim loops, argon2id passwords with timing equalisation, and JWT verification via JWKS with issuer/audience/skew checks. `go build`, `go vet` are clean; `govulncheck` reports **0 reachable vulnerabilities**.

The problems are in the **edges, the fail-open defaults, and the ordering of side effects**:

### Top 10 must-fix

| # | ID | Finding | Sev |
|---|----|---------|-----|
| 1 | **MONEY-001** | Payout `POST /transfer` auto-retry (3×, `retrySafe: true`) with no verify-before-fail → timeout-then-4xx **double-pays the seller and refunds them** | Critical |
| 2 | **INFRA-001** | No `recover()` in Rabbit/SQS message handlers → one poison message **crash-loops an entire deployable** (e.g. go-money), bypassing the DLX machinery | Critical |
| 3 | **TRU-001** | Ad settlement caps debit at available funds and **silently drops the shortfall** while recording full spend + expired credit counts as spendable → **unbounded free ad delivery** | Critical |
| 4 | **COM-001/002** | Payment confirmation swallows stock shortage (`return nil`) **and** `Reserve` treats expired/released reservations as success → **paid orders with zero held stock** | High |
| 5 | **COM-003** | Store-credit balance read outside the checkout tx, no lock → concurrent checkouts **over-redeem credit** (direct loss) | High |
| 6 | **FLOW-001** | Charged price/currency decided by client-influenceable region chain (`X-Client-Region`, `X-Client-Platform`) → buy at the cheapest region's price | High |
| 7 | **AUTH-001** | Suspension not enforced at login/refresh/request time — suspended users keep full write access indefinitely | High |
| 8 | **AUTH-002** | gRPC money servers **fail open when the auth token is unset** and bind `0.0.0.0`; `.env.example` ships a token that passes the ≥32-char prod check | High |
| 9 | **HTTP-001/003** | Staff login rate limit + staff IP allowlist keyed on spoofable `X-Real-Ip`; customer auth endpoints have **no limiter or lockout at all** | High |
| 10 | **TRU-002/003/004** | Strike-, suspension- and ban-bearing moderation actions reachable **without step-up re-auth** (inconsistent with SEC-0009 precedent) | High |

### Systemic themes (see §7 for deduplication)

1. **Fail-open everywhere something can fail:** session denylist (Redis error → allow), staff session checker (error → skip), staff network policy (error → allow), idempotency store (nil → format check only), event publisher (non-prod → discard silently), webhook IP allowlist (unset → allow), stock release on cancel (`return nil`).
2. **Client-controlled trust:** `X-Real-Ip`/`X-Forwarded-For` (rate limits, IP allowlist, audit IPs), region/pricing headers, `X-Client-Platform`.
3. **Side effects committed before validation:** ship/deliver before the state tx, provider-cancel before local state, escrow auto-release clock before the delivery transition.
4. **Step-up coverage is a per-action allowlist** in moderation — several account-availability actions have no step-up while their equivalents elsewhere do.
5. **No supervision for background workers:** consumers/goroutines log-and-die with green `/readyz`.

---

## 2. Methodology & automated tooling

| Tool | Result |
|------|--------|
| `go build ./...` (all 19 modules) | ✅ clean |
| `go vet ./...` (all 19 modules) | ✅ clean |
| `govulncheck -mode=source` (platform, deployables, auth, payments, wallet, ledger, escrow, orders, users) | ✅ **0 reachable vulnerabilities** (1 vuln in a required-but-uncalled module) |
| `gosec` (16+ modules, ~1.1M LOC) | ⚠️ ~64 issues — triaged below |
| `go test` | ❌ not run — integration suites require Postgres/Redis/Rabbit (see §8 blind spots) |

### gosec triage

| Rule | Count | Verdict |
|------|------:|---------|
| G101 "hardcoded credentials" | ~30 | **Almost all noise**: ent generated field names (`FieldCredentialID`, `PasskeysTable`), test constants (`TestTokenAudience`), dev DB fallback in `cmd/generateMigration` tools, `FakeLegacyProviderSecretKey = "sk_test_fake_legacyProvider"` (test-only). Real: **none found** in prod paths. |
| G202 SQL concatenation | ~25 | **Mostly safe**: table names via `pgx.Identifier{...}.Sanitize()` or compile-time constants. **Verify manually**: `creators/.../creatorsDirectory.repository.go:181,217` (`WHERE "+where` — check how `where` is built), `admin/.../metricsSources.service.go:52,91` (partial identifier concat). |
| G115 int→int32/int64 conversions | ~18 | Mostly benign protobuf/count conversions (`int32(len(x))`). `platform/usernames/usernameRules.util.go:158` and `catalog` rating `rune('0'+n)` are range-guarded in practice. Low priority. |
| G404 weak RNG | 1 | `platform/events/rabbitmq.connection.go:82` — `math/rand` for **backoff jitter only**. Acceptable (not security-sensitive). |
| G505 SHA-1 | 1 | `admin/.../totp.util.go` — **correct**: TOTP is specified with HMAC-SHA1 (RFC 6238). False positive. |
| G704 SSRF taint | 1 | `ads/.../moneyTopUps.integration.go:79` — verify the gateway URL is config-fixed, not request-derived. |
| G304 file inclusion | 1 | `payments/.../payments.config.go:196` — `os.ReadFile` of a config-provided path. Low risk; accept or scope with `os.Root`. |
| G104 unhandled errors | 3 | `ads/.../storeCampaignReport.handler.go:67` (`result.Close()` — real but trivial); 2 in ent generated code. |

---

## 3. Critical findings (3)

### [MONEY-001] Payout transfer auto-retry can double-pay a seller *(Severity: Critical)*

- **Where:** `modules/payments/src/integrations/legacyProviderTransfers.integration.go:45`, `legacyProviderHttpClient.integration.go:78-94,129-146`, `modules/gateway/services/sellerPayouts.service.go:87-107`, `platformTransfers.service.go:52-56`, `modules/wallet/.../payoutRun.service.go:130-138`
- **Issue:** `CreateTransfer` is the only money-moving POST marked `retrySafe: true`; `send()` runs up to 3 attempts on any transport error/5xx/429. On a **definitive 4xx** after an earlier ambiguous timeout, `sellerPayouts.service.go:101` records `Failed` → `HandleTransferFailed` credits the seller's `available` balance back — **while the first attempt already disbursed from the platform's bank account**. Alternative: attempt 2 succeeds with no provider dedup → two disbursements, one `payout_transfers` row.
- **Impact:** Direct platform cash loss per incident. Ledger stays internally balanced, so `GET /admin/ledger/integrity` will not detect it.
- **Fix:** The guard already exists in the same file — call `VerifyTransfer` (line 162-167 pattern, `GET /transfer/verify/{reference}`) *before* recording failure at line 101; set `retrySafe: false` on `POST /transfer`; add a test forcing a transport error on attempt 1 and asserting exactly one disbursement.

### [INFRA-001] Unrecovered panic in message handlers crash-loops the deployable *(Severity: Critical)*

- **Where:** `platform/events/rabbitmq.consumer.go:88-101`, `platform/events/sqs.queue.go:50-58`
- **Issue:** Message handlers are invoked with no `recover()` on either bus; the only panic barrier in the binary is the HTTP middleware. Even the money tx layer rolls back and **re-panics** (`ledger/.../moneyTransaction.database.go:48-53`). A panic → process death → unacked message returns to queue head → panic again. `Ack`/`Nack` never run, so the retry/DLX machinery is **bypassed entirely**.
- **Impact:** One unprocessable message = permanent CrashLoopBackOff of the whole deployable (go-money serves payments+wallet+ledger+escrow+subscriptions+creators at once) until manual queue drain.
- **Fix:** `recover()` inside `settleDelivery` and the SQS loop; convert panics to handler errors so they flow through the existing retry/DLX path; log with stack.

### [TRU-001] Ads deliver impressions that settlement silently writes off *(Severity: Critical)*

- **Where:** `modules/ads/src/services/adSettlement.service.go:89-101`, `candidateIndex.service.go:166`, `modules/decision/.../candidates.go:29`, `modules/campaigns/services/statusMachine.service.go:27-31`
- **Issue:** Three defects compound: (1) settlement caps the debit at available funds (`min(debit, balance)`) and **drops the shortfall** while recording full spend and marking impressions settled; (2) the serve-time funds gate counts **expired** credit (`BalanceMinor + CreditMinor`, ignoring `CreditExpiresAt`, which is never zeroed); (3) the expiry-aware `RequireFundsToRun` runs only at activation, never during serving.
- **Impact:** An account with 0 balance + expired promo credit keeps serving forever; every settlement debits 0 while recording full spend. Permanent, advertiser-controllable platform revenue loss; reporting (`amount_spent_micros` vs `debited_minor`) diverges permanently.
- **Fix:** Make `AvailableFundsMicros` expiry-aware; treat settlement shortfall as a hard condition (pause candidates + `ad_spend.unrecoverable` ledger entry + alert); periodically enforce `RequireFundsToRun` across all active accounts.

---

## 4. High findings (18)

### Money & commerce

**[MONEY-002] Staff journal reversal has no kind/state allowlist** *(High)* — `ledger/.../reverseJournalEntry.handler.go:18-27`, `journalReversal.service.go:74-120`. Reversing a `withdrawal.requested` entry mirrors the posting while the withdrawal row stays `queued`; later `HandleTransferSucceeded` debits `reservedPayout` again → negative-balance rejection → transfer stuck `processing` forever, and the seller can re-withdraw the restored balance. Reversing `withdrawal.paid` credits money already banked. Requires staff step-up, but nothing prevents a well-meaning reversal and nothing detects the divergence. **Fix:** allowlist reversible kinds (or emit a compensating command into the owning module's outbox); reconcile every `paid|failed` withdrawal against its ledger entry.

**[FLOW-001] Client-controlled region decides the charged price and currency** *(High)* — `platform/regionpricing/regionPricing.resolver.go:50-86`; consumed by `subscriptions/.../checkout.service.go:85`, `wallet/.../coins.controller.go:40,103`, `ads/.../httpRequest.util.go:81-86`. Resolution order: profile country (optional, empty for default accounts) → CDN header → **`X-Client-Region`**; the IP tier is dead code; `X-Client-Platform: ios` + `X-Store-Storefront` short-circuits *before* profile/CDN. NG web plan = ₦2,500 vs US $5.99; coin packs differ by region. **Fix:** for anything that *charges*, use only server-authoritative country; reject checkout when none exists; keep client hints for display only.

**[COM-001] Payment confirmation marks orders paid after stock reservation failed** *(High)* — `orders/.../orderPayment.service.go:57-81`. On re-reserve, an `InsufficientStockError` is swallowed (`return nil`, line 77), so `markGroupPaid` flips `pending → new, PaymentStatus=paid` and emits `orderGroup.paid` with no stock held (TTL expiry during payment + concurrent checkout consuming the units). Money captured for unfulfillable orders. **Fix:** never swallow the shortage; gate the paid transition on an active reservation in the same tx.

**[COM-002] `Reserve` reports success for expired/released reservations** *(High)* — `inventory/.../reservationReserve.service.go:53-60,112-126`. Existing rows are looked up by `Reference` only (no status filter); settled rows persist with original quantities, so `verifyExistingReservationMatches` returns `nil` **without creating active rows or incrementing `reserved`** — precisely the re-reserve path payment confirmation takes. **Fix:** filter `StatusIn(active, confirmed)`; treat non-active rows as "nothing exists" and run a genuine reserve.

**[COM-003] Store credit over-redeemed by concurrent checkouts** *(High)* — balance read in `cartView.service.go:143` → `checkoutPlan.service.go:118-120` **outside** any lock; redemption inside the ReadCommitted tx guarded only by per-order `dedupe_key`. Two tabs with different idempotency keys both redeem the full balance. Contrast: promotions use an atomic `UsedCountLT` guard. Direct monetary loss absorbed by seller/platform. **Fix:** `SELECT … FOR UPDATE` (or `pg_advisory_xact_lock`) on the buyer's credit rows inside checkout and recompute; fail with `INSUFFICIENT_CREDIT`.

### Identity

**[AUTH-001] Account suspension not enforced at login, refresh, or request time** *(High)* — `auth/.../logInWithPassword.handler.go:34,83`, `refreshSessionTokens.handler.go:52`, `sessionIssuance.service.go:74-79`, `platform/jwtauth/requireAccessToken.middleware.go:30-46`. Login accepts `StatusIn(Active, Suspended, ...)` and rejects only `Banned`; refresh explicitly permits `Suspended`; the `suspended` role claim written into tokens has **zero consumers**; action paths only read `principal.accountId`. Suspension only hides the user's content — they keep a valid session and full write access. **Fix:** reject `Suspended` at login and in refresh's `StatusIn`; reject `suspended` role inside `RequireVerifiedAccessToken`.

**[AUTH-002] Internal gRPC auth fails open when the token is unset** *(High)* — `ledger/.../moneyGrpc.loader.go:60-75` (`if expected == "" { return handler(...) }`), `ledger/.../app.go:30-34` (defaults `MONEY_GRPC_ADDRESS=:9103` → binds 0.0.0.0; prod guard only checks `len ≥ 32`), `auth/.../accountDirectoryGrpcServer.integration.go:79-91`; serves `CheckoutMoneyService`/`AdsMoneyService`/`LiveMoneyService`. `.env.example:89` ships a 39-char example token that passes the length check if copied. **Fix:** fail closed on empty token; default to loopback; reject known example values in prod validation.

### HTTP surface

**[HTTP-001] Admin staff login rate limiting keyed on spoofable `X-Real-Ip`** *(High)* — `admin/.../clientDetails.middleware.go:15,21-27` → `staffAuth.controller.go:35-47` (`Limiter.Allow(path+"|"+ip+email)`, 10/6s per bucket). Random header per request rotates the bucket → unlimited brute force of staff login/MFA/invite. This is the **only** login throttling in the system. **Fix:** derive IP from `RemoteAddr`/trusted hops (or gateway-signed identity header).

**[HTTP-002] No throttling or lockout on customer auth endpoints** *(High)* — `auth/.../sessions.routes.go:14-15`, `registration.routes.go:12-13`, `oneTimeCodes.routes.go:12-13`, `socialSignIn.routes.go:12-13` mount login/refresh/register/OTP/social with no limiter; no failed-attempt counter anywhere in Go (only gateway per-IP policy). OTP cooldown is per-destination only → cross-destination SMS pumping. **Fix:** platform limiter keyed by account identifier + per-account lockout (mirror `failedAttempts.service.go`).

**[HTTP-003] Staff IP allowlist enforced from `X-Real-Ip` and fails open** *(High)* — `platform/staffauth/staffGuard.middleware.go:145-170`; `refuseDisallowedNetwork` returns `nil` (allow) when the network policy port errors (line 147-149). **Fix:** fail closed; only honor the header when the peer is the trusted gateway CIDR.

**[TRU-002] Live-incident decisions issue account strikes without step-up** *(High)* — `moderation/.../liveSafety.routes.go:20` (`staff(false)`), `decideLiveIncident.handler.go:41,99-108`: only `end_and_suspend` checks step-up, but `keep_paused`/`end_live` also issue **permanent strikes**. Staff with only `moderation:reports` can strike hosts without re-auth. **Fix:** `needsStepUp` for any strike-emitting action (copyright-claim precedent).

**[TRU-003] Content-report `REMOVE`/`WARN_AUTHOR` issue strikes without step-up or dedicated permission** *(High)* — `decideContentReport.handler.go:41-42,65,153-160` vs `SUSPEND_AUTHOR` which sets `needsStepUp: true`. Inconsistent with SEC-0009. **Fix:** `needsStepUp: true` + an explicit strike permission (e.g. `users:moderate`).

**[TRU-004] Appeal overturn lifts suspensions and revokes strikes with no step-up** *(High)* — `appeals.routes.go:18` (`RequireStaffWithAnyPermission(..., false)`), `decideAppeal.handler.go:69,74,123` never consults `SteppedUp`. The direct reinstate endpoint requires step-up (`users:suspend`, `true`) — the appeal path bypasses it. Only guard is `SAME_REVIEWER` self-recusal. **Fix:** require step-up for `OVERTURNED` outcomes; consider a second-reviewer requirement.

### Platform infrastructure

**[INFRA-002] Ledger outbox permanently dead-letters domain events after ~17 min of broker trouble** *(High)* — `ledger/.../outbox.event.go:16-17,100-114`: 10 attempts with `1s<<n` capped at 15 min ≈ 17 minutes, then `dead_lettered_at` set forever; nothing in the repo replays or alerts on it. A routine 17-min Rabbit outage silently drops money domain events. **Fix:** retry publish-transient failures indefinitely with capped backoff; alert + replay tool for dead-lettered rows.

**[INFRA-003] Ent-based outbox relays have no per-event retry budget** *(High)* — `users/.../outbox.event.go:37-63` (same shape in admin, ads, auth, catalog, currency, inventory, live, moderation, orders): `ORDER BY created_at` batch, any publish error rolls back with no attempt tracking, retried every 500 ms. One message-specific poison row (SNS size limit) blocks the module's entire event stream forever, readiness stays green. **Fix:** unify on the ledger-style per-row attempt/backoff; skip-and-alert on persistently failing rows.

**[INFRA-004] Background workers terminate permanently with silent errors; health can't see it** *(High)* — `users/app.go:140-145` (`_ =` — not even a log), `ledger/app.go:61-72`, `moderation/contentReports.module.go:45-50`, `subscriptions/app.go:118-122`, `ads/.../adsBackground.job.go:30-40`, `sqs.queue.go:38-41`. `/readyz` pings only Postgres; `/healthz` always 200. A deployable can serve HTTP fine while consumers/outbox/gRPC are dead. **Fix:** supervised restart loops; propagate fatal worker errors to the errgroup; consumer-liveness + Redis/broker readiness checks.

**[INFRA-005] Shutdown closes DB/Rabbit/tracing before background workers drain** *(High)* — `servicemodule/deployable.runner.go:60-70` + `httpserver/http.server.go:53-59`: `OnShutdown` hooks run right after HTTP `Shutdown`, but workers are waited on later by `group.Wait()` — they race against closed pools/channels; all hooks share one 20s context started before `Shutdown`. **Fix:** drain workers first; give hooks a fresh timeout context.

**[INFRA-006] `APP_ENV` defaults to `development`, silently flipping safety gates fail-open** *(High)* — `deployable.runner.go:101-105` (denylist optional), `events/messageBus.factory.go:90-97` (**`DiscardingPublisher` drops all domain events with one Warn while marking rows published**), `sellerplans/sellerPlans.resolver.go:80,87` (`Default.AllowAll = true` → every seller gets Business plan). One missing/typo'd env var = silent wide-ranging fail-open. **Fix:** fail startup without explicit `APP_ENV=production` in prod infra; never allow a publisher that drops events without error in production.

---

## 5. Medium findings (33)

### Money paths

**[MONEY-003] Webhook "claim" commits before processing; retry sweeper takes no claim** *(Medium)* — `payments/.../webhookProcessing.service.go:44-68,110-172`. `ProcessedAt` is set *after* processing, so a concurrent redelivery (the previous payment provider ~10s retry, background processing default) is also told `claimed=true`; `RetryUnprocessedWebhooks` selects rows >60s old with **no `FOR UPDATE`** and re-enters handlers. No money lost today only because every handler re-checks state under `FOR UPDATE` — a future handler without its own guard becomes a double-spend. **Fix:** set `processed_at` in the claim tx; sweeper claims with `FOR UPDATE SKIP LOCKED` + a lease.

**[MONEY-004] Refund capacity consumed at request, never released on failure** *(Medium)* — `payments/.../paymentRefunds.service.go:45-55,217-244`. `OutcomeFailed` sets the refund row `failed` but never decrements `payment_intents.refunded_minor`; the `paymentRefund.failed` event has **zero consumers** in any language (dead letter). One failed refund permanently shrinks (or zeroes) refundable capacity — including for subscription refunds (`subscriptionPaymentRefunds.service.go:46,53`). Bounded by the DB CHECK, but funds stranded with no recovery path. **Fix:** decrement `refunded_minor` under the held `FOR UPDATE` in the failed branch (or only increment on `succeeded`, with a separate in-flight sum).

**[MONEY-005] Saved-card charge: no idempotency key, read-then-charge outside a tx** *(Medium)* — `payments/.../savedCards.routes.go:17`, `savedCards.controller.go:62-80`, `savedCardCharges.service.go:29-96`. The only money-moving endpoint in scope with neither DB nor Redis idempotency; intent loaded unlocked, status checked on a stale snapshot, then `ChargeAuthorization`. Reissue path creates new references with no provider dedup. Double-charge prevented only by emergent advisory-lock + supersede + `paidElsewhere` auto-refund elsewhere. **Fix:** require `ReadRequiredIdempotencyKey` + `RunIdempotentMoneyCommand`; take the intent `FOR UPDATE`.

**[MONEY-006] Webhook IP allowlist reads client-controlled leftmost `X-Forwarded-For`; disabled by default** *(Medium)* — `payments/.../webhooks.controller.go:31-47`, `payments.config.go:90`. Same class as SEC-0001 (fixed in the TS gateway, **not** here); empty allowlist → `return true`. Signature verification still blocks forged events, so this is defence-in-depth degradation + a pre-auth 1 MiB body-read amplification vector. **Fix:** rightmost-untrusted-hop resolution (`TRUSTED_PROXY_HOPS` semantics); fail closed when unconfigured in prod; verify signature before large body reads.

**[MONEY-007] Subscription checkout: no idempotency key, provider state outside any tx** *(Medium)* — `payments/.../connectedAccounts.routes.go:28`, `controller.go:70-97`, `webSubscriptions.service.go:41-77`. Double-tap → N pending `BillingSubscription` rows + N provider checkout sessions (compare `coins/purchases`, which uses `RunIdempotentMoneyCommand`). **Fix:** require idempotency key; cancel prior pending rows per `(owner, plan)` like `paymentIntentCreation.service.go:64-67`.

**[FLOW-002] Second partial refund returns HTTP success without moving money** *(Medium)* — `escrow/.../escrowSettlement.service.go:105-107`. An escrow already `partiallyRefunded` returns `AlreadySettled: true, err=nil` regardless of the new amount; both callers report success (refund handler skips the provider send; dispute path marks resolved, writes the *previous* refund amount, emits `dispute.resolved`). Idempotency keys are per `(OrderGroupId, Reason)`, so a different reason hits the no-op. Audit trail claims a refund that never happened. **Fix:** return `ESCROW_ALREADY_PARTIALLY_REFUNDED` unless `RefundedMinor == requested`.

**[FLOW-003] Withdrawals failing before the transfer row exists are stuck in `processing` forever** *(Medium)* — `wallet/.../payoutRun.service.go:43-82`, `payments/.../sellerPayouts.service.go:54-76`. Only `ErrPayoutNotSentRetryLater` returns to queue; earlier failures (payout account fetch/decrypt, connected-account lookup, provider resolution) leave the row `processing` with no `PayoutTransfer` row — the 15-min sweep only re-drives rows that *have* one. Funds already moved `available → reservedPayout`; staff UI can't review/cancel `processing`. Seller money stranded, manual SQL needed. **Fix:** treat "processing with no transfer row after N minutes" as definitive failure → `reverseWithdrawalInTransaction`; alert.

### Identity & admin

**[AUTH-003] Staff revocation and per-staff IP policy not enforced outside go-identity** *(Medium)* — `staffauth/staffGuard.middleware.go:125-129,162-170`; six module-local staff guards (`ledger`, `catalog`, `moderation`, `orders`, `live`, `ads` — ~109 routes) verify JWT + permissions only, never session state or network policy. Force-logout has no effect on those surfaces until the 10-min staff token expires. **Fix:** one shared platform staff middleware (session + network), or fail closed when the checker port is unregistered.

**[AUTH-004] Session denylist fails open on Redis errors and 150 ms timeouts** *(Medium)* — `jwtauth/sessionDenylist.go:16,46-60`: any error/latency → "allowing token until it expires". Non-prod registers no denylist at all. Residual of SEC-0023. **Fix:** fail closed for revocation reads (or serve from local cache); alert on the failure counters (currently dead code — see INFRA-016).

**[AUTH-005] Customer credential endpoints have no account-level throttling** *(Medium)* — see HTTP-002 (same root issue; staff paths have limiter+lockout, customer paths have neither). **Fix:** identifier-keyed limiter + per-account exponential lockout.

**[AUTH-006] Role/permission changes don't invalidate existing sessions** *(Medium)* — `auth/.../accountEnforcement.service.go:194-209` updates `account.roles` with no session revocation (unlike suspend/password-change); tokens carry a role snapshot and `RequireVerifiedAccessToken` never re-reads. Privilege downgrade lasts up to the 15-min token TTL. **Fix:** denylist sessions on downgrade, or re-resolve roles from DB (short cache).

**[ADM-001] Per-user audit trail + staff IPs readable without `audit:read`** *(Medium)* — `users/.../accountEnforcement.routes.go:13,26-27`, `userDetail.service.go:95-112`: `GET /admin/users/{userId}` (any of 4 read perms) unconditionally embeds 50 audit events including `IpAddress`, `UserAgent`, `Before/After/Reason` — data the audit module itself gates behind `audit:read`. **Fix:** require `audit:read` or strip sensitive fields from `detail.History`.

### HTTP & platform

**[HTTP-004] Staff session revocation not enforced on ~109 staff routes (module-local guards)** *(Medium)* — same root as AUTH-003; route counts: catalog 27, moderation 54, orders 4, ledger 6, live 4, ads 14. Note `moderation` also has the `len(permissions) > 0` empty-list bug (see TRU-015). **Fix:** consolidate into `staffauth.Guard`.

**[HTTP-005] Session denylist check fails open** *(Medium)* — duplicate root of AUTH-004/ADM-007.

**[HTTP-006] `staffauth.Guard` skips the staff-session check when the checker can't be constructed** *(Medium)* — `staffGuard.middleware.go:125-129`: `checkerErr != nil` → entire revocation check bypassed; ~130 `RequireStaff*` routes inherit it. **Fix:** return 503/refuse on checker error.

**[HTTP-007] No security headers on any response** *(Medium)* — global chain is request-id → tracing → panic recovery → viewer-region → logging only (`servicemodule/deployable.runner.go:53-58`): no `X-Content-Type-Options`, `X-Frame-Options`, CSP, HSTS, Referrer-Policy (except one on the ad redirect). No CORS middleware either (fail-closed, safe, but deliberate). **Fix:** add a security-headers middleware; at minimum `nosniff` on the ad-click 302 and JSON APIs.

**[INFRA-007] Idempotency store silently becomes a no-op — including on money routes** *(Medium)* — `catalog/app.go:138-149` (nil store on missing/invalid `*_REDIS_URL`; wrong variable name in the log), `catalog/.../session.middleware.go:24-35`: format-only header check, no reserve/replay, no prod guard. Duplicated in ads/live/orders (TRU-012). **Fix:** fail startup in prod when idempotent routes are mounted with a nil store; fail closed (503) at request time.

**[INFRA-008] Duration config accepts 0/negative → `time.NewTicker` panics → crash loop** *(Medium)* — `platform/config/environment.reader.go:48-59`; call sites: orders sweeps, catalog scheduled publish, inventory reservation expiry, ledger integrity, ads background, subscriptions billing. `"0"` parses fine, ticker panics, no recover (INFRA-001). Only `identityVerification.module.go:25-27` guards `<= 0`. **Fix:** treat `<= 0` as a config problem in `ReadDurationOrDefault`.

**[INFRA-009] Region/pricing signals client-controlled; trusted proxy header never verified** *(Medium)* — `viewerregion/viewerRegion.signals.go:25-35`, `regionpricing/regionPricing.resolver.go:50-87`, `regionPricing.storefront.go:11-25`: `CloudFront-Viewer-Country` accepted from any peer (nothing in `infra/` strips/sets it on origin); `X-Client-Platform`/`X-Store-Storefront` override profile+CDN; unknown storefront code returns `("", true)` (bogus known state). Root of FLOW-001. **Fix:** verify peer IP for edge headers; server-side channel derivation; `known=false` for unmapped codes.

**[INFRA-010] Staff audit records client-supplied `X-Real-Ip` as actor IP** *(Medium)* — `staffaudit/staffAudit.recorder.go:84`; no infra component ever sets the header (grep of `infra/` = 0 hits), so audit IPs are empty today / attacker-chosen if sent. **Fix:** derive from `RemoteAddr` + trusted hop.

**[INFRA-011] Seller-plan lookups fail open on unconfiguration; no failure caching** *(Medium)* — `sellerplans/sellerPlans.resolver.go:80,87,91-137`: package default `AllowAll=true` (landmine for the next module that forgets `ConfigureFromEnvironment`); on fetch failure returns `Free` correctly but doesn't cache → 2 s outbound call per gated request during outages (lands in middleware). **Fix:** default `AllowAll=false`; cache failures 5-15 s; shared `http.Client`.

**[INFRA-012] SQS consumer hot-loops on receive errors; no visibility extension across 10-message batches** *(Medium)* — `events/sqs.queue.go:42-58`: `continue` with no backoff on error (API hammer + log storm); 10 sequential messages per receipt with no `ChangeMessageVisibility` → redelivery mid-processing. **Fix:** exponential backoff + jitter; batch of 1 or heartbeat; `VisibilityTimeout ≥ worst case × batch`.

**[INFRA-013] Idempotency store: unbounded recursion + unconditional Set/Del can clobber a concurrent reservation** *(Medium)* — `idempotency/idempotency.store.go:43-79`: recursion on SetNX/GET race with no cap; `SaveCompletedResponse`/`ReleaseKey` unconditionally overwrite/delete a reservation that may now belong to another request → replay/double-execution window on money routes. **Fix:** bounded loop; Lua compare state+hash before Set/Del.

**[INFRA-014] Boot-time consumer setup errors permanently disable a consumer with one log line** *(Medium)* — `users/.../checkmarks.module.go:64-68` (entitlement events never consumed for process lifetime on transient AWS config error), `subscriptions/app.go:105-116` (degrades to inline, losing retries), `ads/.../adsBackground.job.go:29-40` (nil-guard with no log). **Fix:** retry setup with backoff; fail startup when the queue is required.

### Commerce

**[COM-004] `ShipOrder` fulfils stock and records escrow fulfilment before the status transition is validated** *(Medium)* — `orders/.../sellerOrderOperations.service.go:103-138`: `stock.Fulfil` (own tx) and `Money.RecordOrderFulfilment` commit at :119/:124, the locking validation tx runs at :129 — if the order was concurrently cancelled, tx rolls back with **no compensation**; cancel-after-fulfil finds no restockable rows. Also line 131 `return err` with `err == nil` hides the already-shipped case. **Fix:** validate transition first; fulfil after commit via idempotent marker; explicit `OrderNotShippable`.

**[COM-005] `UpdateOrderStatus` schedules escrow auto-release before the delivery transition commits** *(Medium)* — `sellerOrderOperations.service.go:74-93`: `RecordOrderFulfilment(Delivered)` before the orders tx; escrow sets `AutoReleaseAt = now + period` (`escrowFulfilment.service.go:48-50`) even when the transition then fails → payout clock ticking for an order that never reached `delivered`. **Fix:** move inside the tx or drive escrow from the committed `orderGroup.delivered` outbox event.

**[COM-006] Seller application approval never enforced on the selling path** *(Medium)* — `catalog/.../stores.routes.go:13` (store creation behind `Idempotent` only), `commerceports.interface.go:89-91` (`CanSell` checks store status only), `store.schema.go:32` (`status` defaults `"active"`); the granted `seller` role is checked nowhere (grep across Go middlewares + gateway). Any account with a business profile can sell without review — the approval control is decorative. **Fix:** require approved application at `CreateStore`, or gate `/api/v1/seller/**` on the `seller` role; else delete the dead control.

### Moderation / trust

**[TRU-005] Downstream enforcement records `stepUpVerified` from caller assertion** *(Medium)* — `moderation/.../usersEnforcement.integration.go:23,87-89`, `users/.../accountEnforcementInternal.controller.go:27-34`: internal endpoint (`X-Internal-Token` only) copies `body.Actor.StepUp` verbatim into the audit trail. **Fix:** verify a signed step-up assertion or mark internal-sourced audits `unverified`.

**[TRU-006] `ReleaseLiveSafetyHold` ignores `incidentId` — clears holds from other incidents** *(Medium)* — `live/.../liveSafetyHold.service.go:57-83`, `liveSafetyEvents.job.go:46-47`: only checks `HoldActive`, never compares `HoldIncidentID`. A redelivered release for incident A re-enables publishing for a host still held by incident B. **Fix:** release only when `HoldIncidentID == incidentId`.

**[TRU-007] `content.visibilityChanged` consumers apply visibility with no ordering guard** *(Medium)* — `catalog/.../contentVisibilityConsumer.job.go:50-73`, `live/.../contentVisibilityConsumer.job.go:49`, TS `applyContentVisibility.handler.ts`: unconditional `moderationVisibility` write; `occurredAt` never checked. Stale/redelivered `visible` after `removed` **re-publishes removed content** across posts, products, stores, live sessions — and multiple producers legitimately race. **Fix:** reject `occurredAt <= lastAppliedAt` (persisted per target) or monotonic revision.

**[TRU-008] Chat-report `SUSPEND_USER` requires no step-up while `BAN_USER` does** *(Medium)* — `chatReports/.../chatActionPolicy.service.go:17-22` vs suspension-cases path which uses `staff(true)`. **Fix:** `NeedsStepUp: true` for `SUSPEND_USER`/`RESTRICT_USER`.

**[TRU-009] Chat-report intake: no conversation-membership or target-ownership check** *(Medium)* — `submitChatReport.handler.go:110-148` validates shape + rate limit but never verifies the reporter is in the conversation (the social path does: `requireConversationMember`). Gateway routes any conversation report to moderation → any user can open a real SLA-bearing case against an arbitrary conversation with fabricated evidence. **Fix:** port `requireConversationMember`/`assertReportableBy` or keep these reports on the social intake path.

**[TRU-010] Report-and-block silently drops the block on the trust intake path** *(Medium)* — `submitChatReport.handler.go:55,76` persists `blockReportedUser` and emits `chatReport.received`; **no consumer exists in any language**. User believes they're protected; they're not. **Fix:** consume the event in social (or call block directly); integration test asserting the block exists.

---

## 6. Low & Info findings (41)

### Low (26)

| ID | Finding | Where |
|----|---------|-------|
| AUTH-007 | `X-Real-Ip` trusted unconditionally for staff network policy + audit IP (defence-in-depth; gateway strips it today) | `staffauth/staffGuard.middleware.go:162-170`, `staffaudit/recorder.go:84` |
| AUTH-008 | Smile ID callback `BelongsTo` returns true when `partner_params.user_id` omitted (binding falls back to job-id only) | `users/.../smileCallback.service.go:96-98` |
| MONEY-008 | Withdrawal affordability uses pre-tx provider balance and excludes in-flight `processing` rows → float over-commit, failed payouts (ledger still guards) | `wallet/.../requestWithdrawal.handler.go:20-33`, `withdrawals.service.go:65-71,216-227` |
| MONEY-009 | Idempotency key never released on handler panic (bricked 7 days) and 4xx responses cached for full TTL (402/409 stuck) | `idempotency/requireIdempotencyKey.middleware.go:56-86` |
| FLOW-004 | Per-customer coupon limit enforced by non-transactional read (concurrent checkouts exceed limit of 1) | `orders/.../checkoutPlan.service.go:149`, `checkoutPersist.service.go:169-182` |
| FLOW-005 | FX rates never expire, no staleness alert, updated only by hand/seed | `currency/.../exchangeRate.repository.go:16-23`, `viewerregion/viewerRegion.fx.go:26-53` |
| FLOW-006 | Provider-side cancel committed before local cancellation state (half-succeeded cancel on DB error) | `subscriptions/.../cancellation.service.go:29-39` |
| HTTP-008 | `POST /api/v1/admin/accounts` open to any staff with step-up (`RequireStaff("")`) despite creating full accounts | `users/.../checkmarks.routes.go:41` |
| HTTP-009 | Internal API token min-length inconsistently enforced (strong sites ≥32 chars, others non-empty only) — all constant-time + fail-closed | ads/escrow/subscriptions/wallet/creators vs admin/moderation/users/catalog/orders internal checks |
| HTTP-010 | Payment webhook IP allowlist trusts first XFF hop, disabled when unconfigured (duplicate root of MONEY-006) | `payments/.../webhooks.controller.go:31-47` |
| HTTP-011 | Ad click endpoint 302-redirects to any `https` host — platform usable as trusted redirector (phishing/brand abuse) | `ads/.../tracking.controller.go:65-66` |
| INFRA-015 | DB pools: hardcoded 20 conns/module (go-identity ≈ 80/pod), no `statement_timeout`/`lock_timeout`, no `ConnMaxIdleTime` | `platform/postgres/database.connector.go:18-36` |
| INFRA-016 | Denylist failure counters defined but never consumed; Redis not in readiness; no metrics endpoint at all | `jwtauth/sessionDenylist.go:43-44`, `health/health.handler.go` |
| INFRA-017 | Destructive irreversible UP migrations (`DROP COLUMN`, `DELETE FROM`) with DOWN restoring empty columns; no backup checkpoint step | `auth/src/migrations/20261005170000_*`, `admin/src/migrations/20261005200000_*` |
| INFRA-018 | HTTP bind-failure path skips OnShutdown hooks; clean shutdown with slow request exits non-zero (deploy recorded as failed) | `httpserver/http.server.go:45-60` |
| INFRA-019 | Outbox relays poll every 500 ms with no adaptive backoff (~24 idle tx/s across a deployable; 2 warns/s/module during outages) | `events/outbox.relay.go:21-43` |
| COM-007 | Stock release silently skipped when the stock port fails to initialise (`return nil`) — swept up to TTL later | `orders/.../checkoutAbort.service.go:55-57`, `orderCancellation.service.go:58-64` |
| ADM-002 | End-user session IPs/UA readable without `users:read-pii` (PII elsewhere is gated) | `users/.../userDetail.service.go:95-103` |
| ADM-003 | PII reveal endpoint has no step-up (ban/delete do) — mitigated by mandatory purpose + audit | `users/.../accountEnforcement.routes.go:36` |
| ADM-004 | Superadmin-only routes sit behind "any staff" guard (`RequireStaff("", true)`); handlers self-check, route layer doesn't | `admin/.../staffAdmins.routes.go:14-32`, `checkmarks.routes.go:41` |
| ADM-005 | Staff audit writes fail open silently (`if err != nil { return nil }`) — mis-deployed instance accepts actions with no audit trail | `users/.../staffAudit.service.go:26-29`, `staffauth/staffRequestAudit.middleware.go:67-70` |
| TRU-011 | Content/chat report decisions don't check reporter == deciding staff (only appeals have `SAME_REVIEWER`) | `decideContentReport.handler.go:67-80`, `decideChatReport.handler.go:40-60` |
| TRU-012 | Money idempotency degrades to format-only validation when Redis unavailable (top-ups/boosts can double-charge on retry) | `ads/.../ads.middleware.go:37-48`, same in live/catalog/orders |
| TRU-013 | Unauthenticated regional pricing/estimate endpoints expose exact auction floor tables (and unauthenticated compute) | `ads/.../billing.routes.go:24-25`, `regionalPricing.controller.go:30-111` |
| TRU-014 | Gift burst limit is read-then-charge (no lock) → concurrent requests exceed per-second cap (anti-spam only, money safe) | `live/.../sendGift.service.go:85-92` |
| TRU-015 | `RequireStaffWithAnyPermission` fails open on empty permission list (`len(permissions) > 0 && ...`) — latent; all current callers pass ≥1 | `moderation/.../staffPermission.middleware.go:49-51` |

### Info (15)

| ID | Finding | Where |
|----|---------|-------|
| AUTH-009 | No concurrent session limit (only 180-day absolute lifetime + user-initiated revoke) | `auth/.../sessionIssuance.service.go` |
| MONEY-010 | Allocation helpers accumulate in `int64` with no overflow guard (not reachable today; ledger's own posting *does* guard) | `payments/.../checkoutAllocation.model.go:40-73`, `platform/money/money.allocation.go:7-42` |
| FLOW-007 | Creator-earnings journal reference keyed by date → second same-day run fails for every creator with new earnings (ledger refuses safely; payouts delayed a day) | `wallet/.../creatorEarningsTransfers.service.go:51,64-75` |
| HTTP-012 | Public analytics write endpoint (`POST /analytics/product-interactions`) unthrottled (bounded input, consent honored) | `catalog/.../interactions.routes.go:14` |
| HTTP-013 | No CORS middleware anywhere (fail-closed; note for any future separate-origin SPA) | `services/go` (absent) |
| HTTP-014 | Audit trail IPs from `X-Real-Ip`/`X-Forwarded-For` in catalog & orders seller-money audit | `catalog/.../storeAuditTrail.service.go:36`, `orders/.../sellerMoneyAudit.service.go:53` |
| HTTP-015 | Username availability/suggestion endpoints allow account enumeration, unrated-limited | `auth/.../registration.routes.go:13`, `usernames.routes.go:25` |
| INFRA-020 | Log redaction is key-only (values in `slog.Any("error", err)` pass through); no metrics endpoint anywhere | `logging/structured.logger.go:10-45` |
| INFRA-021 | Tracing samples 100% of requests when OTLP endpoint set (no ratio sampler) | `telemetry/tracing.provider.go:31` |
| ADM-006 | `X-Real-Ip` trusted for staff allowlist/rate-limit/audit (gateway overwrites today) — same cluster as HTTP-001/003 | multiple (see §7.1) |
| ADM-007 | User session denylist fails open (staff equivalent fails closed — asymmetric, undocumented) | `jwtauth/sessionDenylist.go:46-60` |
| ADM-008 | Unauthenticated sitemap bulk-enumerates account UUIDs (1000/page, public cache, no rate-limit class) | `users/.../sitemap.routes.go:10-11` |
| ADM-009 | Permission revocation only lands at next token issuance (≤10 min; disable/suspend unaffected) | `staffauth/staffGuard.middleware.go:45-47` |
| TRU-016 | Moderation controllers use `X-Real-Ip` for audit IP (safe behind gateway only) | `liveSafety.controller.go:31-36`, `suspensionCases.controller.go:65-67` |
| TRU-017 | `analytics` module is an 11-line routeless no-op stub (`RoutelessModule`) — no attack surface, but "analytics" coverage = none | `modules/analytics/analytics.module.go` |

---

## 7. Cross-cutting themes (deduplicated)

Several reviewers hit the same root cause from different angles. One fix per theme closes many findings.

### 7.1 Client IP trust (`X-Real-Ip` / leftmost `X-Forwarded-For`)
**Closes:** HTTP-001, HTTP-003, HTTP-010, HTTP-014, AUTH-007, ADM-006, INFRA-010, TRU-016, MONEY-006.
The gateway strips/overwrites these headers today, so every instance is *conditionally* safe — but the Go code has no defence of its own. **Single fix:** one platform `ClientIP(request)` helper that (a) only trusts forwarded headers when `RemoteAddr` is in a configured gateway CIDR, (b) takes the rightmost untrusted hop, used by rate limiters, staff allowlist, audit recorders, webhook allowlist.

### 7.2 Fail-open degradation
**Closes:** AUTH-004, HTTP-005/006, ADM-007, INFRA-006/007/011/014, TRU-012, COM-007, ADM-005.
Every optional dependency degrades to "allow/discard/skip" on error: Redis denylist, staff session checker, staff network policy, idempotency store, event publisher, seller-plan fetch, stock-port init, audit recorder. **Single principle:** for revocation/authz/money-integrity checks, fail **closed** (or 503); for availability-only checks, fail open *and alert*. Today none of these alert.

### 7.3 Rate limiting & step-up coverage
**Closes:** HTTP-001/002, AUTH-005, TRU-002/003/004/008, ADM-003/004.
Two gaps: (1) customer auth endpoints have no Go-side limiter/lockout at all (staff paths do); (2) moderation step-up is a per-action allowlist where several strike/suspend/appeal actions are `false` while their equivalents elsewhere are `true`. **Single fix:** identifier-keyed limiter middleware for credential endpoints + a policy table stating which actions require step-up, enforced by one wrapper with tests that enumerate it.

### 7.4 Side effects before validation / no compensation
**Closes:** COM-004/005, FLOW-002/006, MONEY-001/003.
Pattern: provider/DB side effect committed first, validation tx second, no compensating action on failure. **Rule:** validate-then-effect inside one tx where possible; otherwise make effects idempotent + derived from committed state (outbox events), with a reconciler for the ambiguous window.

### 7.5 Background job supervision & event delivery
**Closes:** INFRA-001/002/003/004/012/014/019.
Panic-free handler wrapper, unified outbox store (ledger's per-row attempt/backoff design everywhere), supervised consumer restart, readiness including consumer liveness + broker/Redis, DLQ alerting + replay tool.

---

## 8. Coverage & blind spots

**Reviewed (this scan):**
- All 19 modules built and vetted; 16+ modules gosec-scanned; 9 modules govulncheck-scanned (0 reachable vulns).
- Route inventory: **945 registrations** across 17 modules (59 public, 526 user, 259 staff, 94 internal, 7 webhook) with middleware classification per module.
- End-to-end traces: login/refresh/JWT/session lifecycle; charge→ledger→escrow→payout; refund/dispute/partial; withdrawal queue; subscription renewal/cancel; checkout→stock→payment→ship/deliver; gift send; ad top-up→auction→settle→click/convert; moderation intake→decision→appeal→enforcement; staff auth/RBAC/step-up.
- Platform: config, logging, events (Rabbit/SQS/SNS/outbox), postgres, telemetry, health, secretbox, money, idempotency, staffaudit/staffauth, httpserver, servicemodule, regionpricing/viewerregion, sellerplans; 115 migration pairs (money columns all CHECK-constrained); 12 job files; 41 non-test `go func(` sites.
- Verified-healthy: parameterised SQL; `DisallUnknownFields` + 1 MiB caps; constant-time compares; webhook signatures (the previous payment provider HMAC-SHA512, LiveKit, Smile-ID with freshness); JWT JWKS + iss/aud/skew; argon2id + timing equalisation; refresh-token rotation w/ reuse detection; ledger append-only + advisory locks + overflow-checked posting; `SKIP LOCKED` claims; no `float64` in money math (test-only); no `uuid.MustParse` panics on user input; gift split integer-only with advisory lock + unique idempotency.

**Blind spots (not covered):**
1. **Tests not executed** — integration suites need Postgres/Redis/Rabbit; all findings are static-analysis-backed (reachability reasoned, not reproduced).
2. **Edge/infra exploitability** — whether CloudFront/ALB strips spoofed headers, whether Go ports are reachable outside the gateway, actual secret values: severity of the header-trust cluster (§7.1) hinges on this.
3. **TypeScript/Elixir surfaces** — gateway policy layers, social/chat write paths, Elixir realtime internals (beyond topic auth) not audited.
4. **Provider semantics** — the previous payment provider transfer-reference dedup, subaccount-split reversal on refund, webhook retry cadence: assumed from this repo's client code.
5. **Runtime concurrency** — interleavings reasoned from SQL locking; no race detector run, no chaos/load tests (the `security/race/` suite exists but wasn't executed).
6. **Deep IDOR sampling** — 945 routes: high-risk ones traced to SQL predicates; low-risk reads got wrapper-level verification only.

---

## 9. Prior-findings regression check (SEC-0001…0024)

| Prior | Status per this scan |
|-------|----------------------|
| SEC-0001 (gateway XFF rate-limit bypass) | Fixed in TS gateway; **same class unfixed in Go** (MONEY-006 webhook allowlist, HTTP-001/003) — distinct instances, not regressions |
| SEC-0002 (Smile ID stale/foreign signatures) | ✅ verified fixed (freshness + constant-time + job-id); minor residue AUTH-008 (empty user_id binding) |
| SEC-0009 (copyright strike needs step-up) | ✅ fixed there, but **pattern not applied consistently** → TRU-002/003/004/008 are the same gap in adjacent actions |
| SEC-0010 (unsigned gateway account header) | ✅ clean — `x-nantty-*` headers read nowhere in Go |
| SEC-0013 (refund ≤0 = full refund) | ✅ distinct from MONEY-004 (capacity never released) |
| SEC-0014 (monetisation hold race) | ✅ distinct from MONEY-008 (withdrawal float over-commit) |
| SEC-0018 (realtime channel recheck) | ✅ verified present (Elixir `SubscriptionGuard` + event-driven revocation); no regression |
| SEC-0022 (ledger role can drop triggers) | Accepted risk; note: debit=credit & non-negative balances are app-side only (no DB trigger) — see MONEY-002 blast radius |
| SEC-0023 (tokens ignore revocation) | Fixed, but denylist fail-open window remains (AUTH-004/HTTP-005) |
| SEC-0024 (NFKC at login) | ✅ no regression found |

---

## 10. Remediation roadmap

**P0 — fix before any production money traffic**
1. MONEY-001 — verify-before-fail on `POST /transfer` + `retrySafe: false`.
2. INFRA-001 — `recover()` in Rabbit/SQS handlers (poison-message crash loop).
3. TRU-001 — expiry-aware ad funds gate + hard-fail settlement shortfall.
4. COM-001 + COM-002 — stop swallowing stock shortage; status-filter `Reserve`.
5. COM-003 — lock store-credit rows inside the checkout tx.
6. AUTH-002 — fail closed on empty gRPC token; loopback default; reject example tokens.

**P1 — first sprint**
7. AUTH-001 (suspend at login/refresh) · MONEY-002 (reversal allowlist) · FLOW-001/INFRA-009 (server-authoritative pricing region) · HTTP-001/002/003 + §7.1 client-IP helper · TRU-002/003/004/008 (step-up policy table) · INFRA-006 (APP_ENV fail-fast) · FLOW-003 (stuck-withdrawal sweeper) · MONEY-004 (refund capacity release).

**P2 — hardening sprint**
8. §7.2 fail-open audit (denylist, idempotency store, staff checker, audit recorder) · §7.5 worker supervision + outbox unification + DLQ alerting · MONEY-003/005/007 (webhook claim, saved-card & subscription checkout idempotency) · COM-004/005 (effect ordering) · TRU-007/009/010 (visibility ordering, report membership, block enforcement) · INFRA-005 (shutdown order) · HTTP-007 (security headers) · AUTH-003/HTTP-004 (shared staff middleware).

**P3 — backlog**
9. All Low/Info items; gosec `G202` manual verification (creators `WHERE "+where`); INFRA-015 (pool env-tuning + `statement_timeout`); INFRA-020 (metrics endpoint — prerequisites alerting for everything above); run the full test suites + `security/race/` money probes against a local stack to convert static findings into reproduced ones.

---
*Generated by the 2026-10-06 Go deep scan (8 review agents + go build/vet/gosec/govulncheck). Findings are static-analysis-backed; reproduce against a local stack before prioritising fixes by exploitability.*

---

## Verification (2026-10-10)

Each finding was checked against the current code on 2026-10-10. "Stage 1" means the Flutterwave phase 2 stage 1 work (`docs/integrations/flutterwaveMigration.md` §9). Payment, wallet, ledger, escrow, orders-payment and checkout code was not edited in this pass, because the Flutterwave stage 2 work is changing it. Open rows in those areas name the cause and the owner. The combined summary is in `VERIFICATION_SUMMARY.md`.

Counts for the 95 findings:

| Severity | Fixed (before) | Fixed now | Partly fixed | Open | False positive | Total |
|---|---|---|---|---|---|---|
| Critical | 2 | 0 | 1 | 0 | 0 | 3 |
| High | 11 | 4 | 2 | 1 | 0 | 18 |
| Medium | 21 | 10 | 2 | 0 | 0 | 33 |
| Low | 5 | 8 | 3 | 9 | 1 | 26 |
| Info | 6 | 1 | 3 | 4 | 1 | 15 |
| **Total** | **45** | **23** | **11** | **14** | **2** | **95** |

The §2 gosec items: 4 false positives, 1 open (accepted low risk).

| ID | Severity | Status | Evidence | Fix / test |
|---|---|---|---|---|
| MONEY-001 | Critical | Fixed | `legacyProviderTransfers.integration.go` sends a single attempt through `providerHttp`; an uncertain outcome stays `processing` and is verified by reference before it fails (stage 1, B1) | `TestCreateTransferDoesNotRetryUncertainProviderFailures`, `TestWithdrawalTimeoutThenProviderSuccessIsPaidExactlyOnce` |
| INFRA-001 | Critical | Fixed | RabbitMQ and SQS handlers recover panics into the retry/DLX path | `platform/events` `TestHandlerPanicSchedulesRetryInsteadOfCrashingConsumer` |
| TRU-001 | Critical | Fixed now | `SettlePendingCharges` settles each advertiser on its own and joins the errors, so one failure never stops the batch. A shortfall now settles what the balance covers, marks the impressions settled (no re-runs), scales creator and platform shares to what was collected, disables the account and records one `ad_spend_debt` row keyed `shortfall:<batchId>` (`adSettlementShortfall.service.go`). The old `ad_spend_unrecoverable` type was not in the ent enum, so the previous shortfall path could never commit | Test: `adsSettlementShortfall.integration_test.go` `TestOneAdvertisersShortfallIsRecordedAsDebtOnceAndOtherAdvertisersStillSettle` |
| MONEY-002 | High | Fixed (stage 1, B11) | `journalReversal.service.go` allows staff reversal only for `ledger.correction`, `staff.adjustment` and `reconciliation.correction`; any other kind gets 409 `JOURNAL_KIND_NOT_REVERSIBLE` | `TestStaffCanReverseOnlyAllowlistedJournalKinds` |
| FLOW-001 | High | Fixed now | Web subscription checkout now builds `ViewerCountry` with `ResolveChargingRegion` (profile, then trusted CDN header, then IP; never `X-Client-Region` or storefront headers) in `billing/controllers/pricing.controller.go` `resolveChargingCountry`; `checkout.service.go` returns `422 COUNTRY_REQUIRED` when neither the profile nor the account has a country | Test: `subscriptions.chargingRegion_integration_test.go` `TestWebSubscriptionCheckoutIgnoresTheClientRegionHeaderAndNeedsARealCountry` |
| COM-001 | High | Fixed (stage 1, B12) | `orderPayment.service.go` cancels the order and enqueues `orderGroup.refundRequested` in the same transaction when stock is short | `TestPaidOrderWithoutStockIsCancelledAndRefundedExactlyOnce` |
| COM-002 | High | Partly fixed → **Fixed now** | The status filter was present (`reservationReserve.service.go:54-57`), but a re-reserve after expiry at the same location still failed. The reserved-movement dedupe key already existed, so the reserved count was silently not incremented, and the new row then hit the `(reference, variant, location)` unique index. `Confirm` and `Fulfil` also refused because the old released rows were still there. Reservations now carry an `attempt`: dedupe keys and the unique index include it, `Confirm`/`Fulfil` look only at the latest attempt, and re-reserving a shipped order is refused | `inventory/src/services/reservationAttempt.service.go`, schema `stockReservation.schema.go`, migration `inventory/src/migrations/20261010180130_reservation_attempts`; tests `inventory.reReserve_integration_test.go` (`TestReReserveAfterExpiryHoldsStockAgainAndShipsOnce`, `TestReReserveAfterExpiryReportsShortageWhenUnitsWereSold`) |
| COM-003 | High | Fixed | `orders/src/services/storeCreditBalance.service.go:39` locks the buyer's credit rows with `FOR UPDATE` inside the checkout transaction | orders checkout tests |
| AUTH-001 | High | Fixed | `platform/jwtauth/requireAccessToken.middleware.go:52-53` refuses the `suspended` role, except on allowlisted appeal/suspension reads (`RequireVerifiedAccessTokenAllowingSuspended`) | `auth/authEnforcement.integration_test.go` `TestSuspendedAccountsCanSignInAsSuspendedAndBannedOnesCannot` |
| AUTH-002 | High | Fixed | gRPC auth fails closed on an empty token (`ledger/.../moneyGrpc.loader.go` `RequireInternalBearerToken`, `auth/.../accountDirectoryGrpcServer.integration.go:81`); the money gRPC default is `127.0.0.1:9103` (`ledger/src/app.go:30`); production refuses `local-only…` tokens (`platform/config/placeholderSecrets.go`) | `placeholderSecrets_test.go`. Gap: no gRPC interceptor unit test (ledger is owned by stage 2) |
| HTTP-001 | High | Fixed | `admin/src/middlewares/clientDetails.middleware.go` uses `httpserver.ClientIP` for the login limiter key | `admin/adminStaffFlows.integration_test.go` `TestLoginRateLimitReturns429PerEmail` |
| HTTP-002 | High | Fixed now (was Partly) | The per-IP `RateLimitAuthEndpoints` was already on every auth route. The identifier lockout was added now (see AUTH-005). Residual: limiters are in-memory per process, and OTP cross-destination sends are limited per IP only | see AUTH-005 |
| HTTP-003 | High | Fixed | `staffauth/staffGuard.middleware.go:146-158`: 503 on policy-port or lookup failure; IP from `ClientIP` | staffauth tests |
| INFRA-002 | High | Fixed now | `ledger/src/events/outbox.event.go` never dead-letters: a failing event keeps retrying with backoff capped at 15 min; from attempt 10 (and every 10 after) it logs `alert=moneyOutboxStuck` and stamps `dead_lettered_at` as an alert marker only. Rows dead-lettered earlier are picked up again (replay) | Test: `outbox.event_integration_test.go` `TestStuckEventKeepsRetryingPastTheAlertThresholdAndIsDeliveredWhenTheBrokerRecovers` |
| INFRA-003 | High | Fixed now | The 10 ent outbox stores published one batch and rolled back on any error, so one poison row blocked the module's stream forever. New `platform/events/outbox.isolation.go` `PublishIsolatingFailures` falls back to single sends, marks the healthy rows published and keeps the poison row back (logged at ERROR, no relay backoff). It gives up after 3 single failures with nothing sent, so an outage is not hammered | `outbox.isolation_test.go` (3 tests); stores: `admin, moderation, inventory, auth, users, currency, ads, orders, live, catalog` `src/events/outbox.event.go` |
| INFRA-004 | High | Fixed now (2026-10-11) | Every remaining bare worker is now supervised: the ledger integrity, seller-credit and money-event consumers (`ledger/src/app.go`), the subscriptions billing-job consumer and due-jobs loop (`subscriptions/src/app.go`), and the moderation live-safety consumer (`moderation/src/app.go`). The internal money gRPC listener and the ledger outbox relay run through `servicemodule.RunWorkersStoppingAllOnFirstFailure`, so a failed gRPC listen stops the deployable instead of being logged. A missing broker in non-production returns `servicemodule.ErrWorkerDisabled` and stops supervision without a restart loop. `/readyz` now checks Valkey (session denylist ping) and RabbitMQ (channel open) alongside Postgres, runs the checks concurrently, and gives each one 2 s within a 3 s budget. A CloudWatch log metric filter and alarm (`infra/aws/modules/observability/workers.tf`) fire on repeated "background worker stopped; restarting" | `servicemodule/fatalWorkers_test.go`, `workerSupervisor_test.go` (disabled worker), `sharedReadiness_test.go`, `health/health.handler_test.go`, `events/rabbitmq.readiness_test.go`, `jwtauth/sessionDenylist_test.go` |
| INFRA-005 | High | Fixed | `servicemodule/orderedShutdown.go`: workers drain first, then hooks run with a fresh 20 s context | `TestShutdownHooksRunOnlyAfterWorkersDrainWithAFreshContext` |
| INFRA-006 | High | Fixed | `deployable.runner.go:28-30` requires APP_ENV explicitly; `events/messageBus.factory.go:90-93` refuses the discarding publisher in production and staging; `sellerplans.Default.AllowAll=false` | `TestMissingBrokerUrlIsRefusedInStagingInsteadOfDiscardingEvents`, `TestUnconfiguredDefaultResolverDoesNotGrantEveryPlan` |
| TRU-002 | High | Fixed | moderation/.../decideLiveIncident.handler.go:41-43 (any action other than keep_live needs step-up) | decideLiveIncident.stepUp_test.go TestEveryStrikeBearingLiveDecisionRequiresStepUp |
| TRU-003 | High | Partly → Fixed now | step-up was present (decideContentReport.handler.go:41-43,65); the explicit strike permission was missing. REMOVE/WARN_AUTHOR now need users:moderate, SUSPEND_AUTHOR needs users:suspend | decideContentReport.stepUp_test.go TestStrikeBearingContentActionsNeedAStrikePermission; integration tests updated (moderationTrustEnforcement, moderationAppeals) |
| TRU-004 | High | Fixed | decideAppeal.handler.go:53 | decideAppeal.stepUp_test.go TestOverturningAnAppealRequiresStepUp |
| MONEY-003 | Medium | Fixed (stage 1, B2/B26) | Store-first webhook inbox; claims use `FOR UPDATE SKIP LOCKED` plus a lease token (`webhookInbox.service.go`) | `TestWebhookDeliveredTwiceAndConcurrentlyIsProcessedOnce`, `TestSweeperRacingARedeliveryNeverDoubleProcesses` |
| MONEY-004 | Medium | Fixed (stage 1, B4) | A new `refund_in_flight_minor` is released in the same transaction when the refund fails, and a `paymentRefund.failed` consumer handles the event | `TestRefundFailingThenRetriedReleasesCapacityAndPaysOnce` |
| MONEY-005 | Medium | Fixed (stage 1, B5) | `Idempotency-Key` is required, and the intent is locked and claimed once | `TestSavedCardDoubleTapChargesTheCardOnce` |
| MONEY-006 | Medium | Fixed | `payments/src/modules/webhooks/controllers/webhooks.controller.go:30-37`: an empty allowlist denies, and the source is `httpserver.ClientIP` (trusted-proxy resolution) | `platform/httpserver` ClientIP tests. Gap: no controller-level allowlist test (payments is owned by stage 2) |
| MONEY-007 | Medium | Fixed (stage 1, B6) | `Idempotency-Key` is required on `POST /payments/subscriptions/checkout` | `TestWebSubscriptionIsWebOnly…` |
| FLOW-002 | Medium | Fixed (stage 1, B9) | A second distinct partial refund gets 409 `ESCROW_ALREADY_PARTIALLY_REFUNDED` | `TestSecondDistinctPartialRefundIsRejectedAndMovesNoMoney` |
| FLOW-003 | Medium | Fixed (stage 1, B10) | The transfer row is created in the claim transaction, and a reconciler requeues processing rows that have no transfer | `TestProcessingWithdrawalWithoutATransferRowIsQueuedAgainAndPaidOnce` |
| COM-004 | Medium | Fixed (stage 1, B14) | Escrow fulfilment is driven by committed `orderGroup.shipped` outbox events | `TestDeliveredIsAnnouncedOnlyAfterTheOrderCommits…` |
| COM-005 | Medium | Fixed (stage 1, B14) | The auto-release timer is set once, from the committed `orderGroup.delivered` event | `TestDeliveredEventSetsTheReleaseTimerOnceEvenAcrossReplaysAndDisputes` |
| AUTH-003 | Medium | Partly fixed (revocation fixed now; IP policy open) | The module-local staff guards (catalog, moderation, orders, live, ads, ledger) verify through `jwtauth`, which checks the shared Redis denylist, but admin never wrote revoked **staff** sessions to it. An admin ent hook now does, on commit, for logout, own-session revoke, refresh reuse, and disable/suspend/MFA reset. **Still open:** the per-staff IP network policy is enforced only on go-identity routes | Fixed now: `admin/src/modules/staffAuth/services/staffSessionDenylist.service.go` + `admin/src/app.go`, test `admin/adminStaffSessionDenylist.integration_test.go`. Remainder owner: platform/identity (a network-policy port reachable from the other deployables, or rely on the gateway admin IP allowlist) |
| AUTH-004 | Medium | Fixed | `jwtauth/sessionDenylist.go:46-58` fails closed | `TestDenylistOutageFailsClosedAndCountsFailure` |
| AUTH-005 | Medium | Fixed now | Same root as HTTP-002: there was only a per-IP limiter. Password login now has an identifier-keyed lockout (10 failures / 15 min → 15 min lock; unknown identifiers lock the same way) | `platform/loginthrottle/` (+ `loginThrottle_test.go`), `auth/.../logInWithPassword.handler.go`, `auth/src/errors/auth.error.go` (`TOO_MANY_LOGIN_ATTEMPTS`), test `auth/authLoginLockout.integration_test.go` |
| AUTH-006 | Medium | Fixed now | `auth/src/services/accountEnforcement.service.go` `SetAccountRole(…, false)` now revokes every session in the same transaction, and the denylist hook drops the access tokens. No caller removes a role today; this closes the path | test `auth/authRoleDowngrade.integration_test.go` |
| HTTP-004 | Medium | Fixed now | Same root as AUTH-003: staff session revocation now reaches all 109 module-local staff routes through the shared denylist | see AUTH-003 |
| HTTP-005 | Medium | Fixed | Duplicate of AUTH-004 | — |
| HTTP-006 | Medium | Fixed | `staffGuard.middleware.go:124-127` returns 503 when the checker can't be built | staffauth tests |
| HTTP-007 | Medium | Fixed | `httpserver/standard.middleware.go:69` wired in `servicemodule/deployable.runner.go:68` | `TestApplySecurityHeadersSetsHardeningHeaders` |
| INFRA-007 | Medium | Fixed (+ now) | catalog/live/inventory/ads require `*_REDIS_URL` in production, and their idempotency middleware returns 503 when there is no store in production. Fixed now: orders and inventory `src/middlewares/session.middleware.go:25` also fail closed in production (orders previously fell back to format-only checks) | `idempotency` `TestMissingStoreFailsClosed`. Note: `ORDERS_REDIS_URL` is not yet required at orders startup (`orders.config.go` is being edited by stage 2) |
| INFRA-008 | Medium | Fixed | `platform/config/environment.reader.go` rejects durations <= 0 | config tests |
| INFRA-009 | Medium | Fixed now (CDN header) / by design (storefront) | The `CloudFront-Viewer-Country` header is now trusted only from a trusted-proxy peer (`viewerregion/viewerRegion.signals.go`, `regionpricing/regionPricing.resolver.go` `ReadSignalsFromRequest`, new `httpserver.IsFromTrustedProxy`). An unmapped Apple storefront falling back to US prices is intended and covered by a test. Charging paths use `ResolveChargingRegion` (stage 1); the subscription checkout still uses the display resolver (FLOW-001, stage 2) | `viewerRegion_test.go`, `regionPricing.resolver_test.go` (untrusted-peer cases) |
| INFRA-010 | Medium | Fixed | `staffaudit/staffAudit.recorder.go:85` uses `ClientIP`; the request ID now comes from context | — |
| INFRA-011 | Medium | Fixed | `sellerplans/sellerPlans.resolver.go`: `AllowAll=false`; a Free result on failure is cached briefly | `TestEntitlementFailuresAreCachedBrieflyDuringAnOutage` |
| INFRA-012 | Medium | Fixed | `events/sqs.queue.go`: the receive batch defaults to 1 (`SQS_RECEIVE_BATCH_SIZE` 1-10), with receive-error backoff | `TestSqsReceivesOneMessageAtATimeUnlessConfigured` |
| INFRA-013 | Medium | Fixed | `idempotency/idempotency.store.go`: owner-checked save and release; no unbounded recursion | `TestAStaleOwnerCannotOverwriteOrDeleteANewerReservation` |
| INFRA-014 | Medium | Partly → Fixed now (2026-10-11) | Users and ads consumers were already supervised. Subscriptions `startBillingJobConsumer` returns an error in production instead of falling back to inline (stage 2). The moderation `consumeContentSignals` and `consumeAdvisorySuggestions` now retry setup with backoff through `moderation/src/queueConsumerRetry.go`, instead of switching off for the life of the process. See SECURITY_SCAN_2026-10-11.md | `moderation/src/queueConsumerRetry_test.go` |
| ADM-001 | Medium | Fixed now | `GET /admin/users/{id}` embedded 50 audit events (IP, UA, before/after) for any read permission. `users/.../services/userDetailVisibility.service.go` now drops `history` without `audit:read`, applied in `controllers/accountEnforcement.controller.go` `GetUser` | `userDetailVisibility.service_test.go` |
| TRU-008 | Medium | Fixed | chatActionPolicy.service.go:15-20 | chatActionPolicy.stepUp_test.go |
| COM-006 | Medium | By design (owner decision) | The store-opening gate was removed: stores open before verification. Selling risk is controlled instead by the unverified-seller escrow-only cap and withdrawal block in Nigeria, and by the L1 identity requirement to sell outside Nigeria | catalog.storeCreationApproval_integration_test.go (`TestAStoreCanBeOpenedBeforeTheSellerIsVerified`) |
| TRU-005 | Medium | Fixed (previous fork) | users internalStepUp.controller.go verifies a forwarded X-Step-Up-Token; moderation forwards it | internalStepUp.controller_test.go |
| TRU-006 | Medium | Fixed now | liveSafetyHold.service.go: release only when HoldIncidentID == incidentId (previous fork). Its regression test failed because of a second bug: the LiveSafetyState `ON CONFLICT DO NOTHING` insert returns sql.ErrNoRows when the row exists, so every second hold on a live errored. Fixed in liveSafetyHold.service.go:23 and liveSafetySampler.service.go:84 | live/liveSafetyHolds.integration_test.go TestReleasingAnOlderIncidentKeepsTheHoldOfTheCurrentIncident (now passes) |
| TRU-007 | Medium | Fixed now | Go: catalog contentVisibilityConsumer.job.go and live contentVisibilityConsumer.job.go apply only when moderation_visibility_at is null or older (migrations catalog 20261010180155 and live 20261010180326, both from the previous fork). TS social: applyContentVisibility.handler.ts guards posts and comments with moderationVisibilityAt (prisma content.prisma; migration 20261010230000_moderation_visibility_ordering) | catalog.visibilityOrdering_integration_test.go; social tests/contentEvents/visibilityOrdering.test.ts. Messages and sounds are still unordered (messages use hiddenAt; sounds have a separate copyright state) |
| TRU-009 | Medium | Fixed now | moderation submitChatReport.handler.go requireReportable → integrations/chatReportability.integration.go → social GET /api/v1/internal/moderation/conversations/:id/reportability (getChatReportability.handler.ts: reporter is an active member, reported user was a member, message is in the conversation, no self-report). Fails closed (503) when social is down or unconfigured in production; conversation targets need a conversationId | moderation chatReportability.integration_test.go, moderationChatReportMembership.integration_test.go; social tests/internalSources/chatReportability.test.ts |
| TRU-010 | Medium | Fixed now | social contentEventRouter.service.ts handles chatReport.received with blockReportedUser → blockUser (reporter blocks the reported user; USER_NOT_FOUND/CANNOT_BLOCK_SELF are acked); topology.json binds chatReport.received to social-domain-events; definitions.json regenerated (one added binding) | social tests/contentEvents/chatReportBlock.test.ts |
| MONEY-008 | Low | Partly → Fixed (stage 2), small remainder open (2026-10-11) | `RequestWithdrawalInTransaction` locks the user and their cash, then subtracts withdrawals not yet sent to the provider from the provider balance. `BlockWhileProcessing` is on by default. The previous payment provider path is obsolete (the previous payment provider removed 2026-10-11). Remainder: with `WALLET_BLOCK_WITHDRAWAL_WHILE_PROCESSING=false`, include `processing` rows in the sum. See SECURITY_SCAN_2026-10-11.md, "For the payments agent" | `wallet/.../withdrawals.service_test.go` |
| MONEY-009 | Low | Fixed | `platform/idempotency/requireIdempotencyKey.middleware.go:93-118`: on a panic the key is released, and 401/402/403/408/409/423/425/429 and 5xx release the key instead of being cached | `requireIdempotencyKey.middleware_test.go` `TestAPanicReleasesTheKeyInsteadOfBrickingIt`, `TestARetryableClientErrorReleasesTheKeySoTheRetryRunsAgain` |
| FLOW-004 | Low | Fixed now | `RedeemPromotionInTransaction` (`checkoutPersist.service.go`) recounts the buyer's redemptions inside the checkout transaction after the row-locking promotion update and refuses at `UsageLimitPerCustomer` | Test: `orders.couponPerCustomerLimit_integration_test.go` `TestPerCustomerCouponLimitHoldsUnderConcurrentCheckouts` (4 concurrent checkouts, 1 redemption) |
| AUTH-007 | Low | Fixed | `staffauth.ClientAddress` → `httpserver.ClientIP` (trusted CIDRs only) | httpserver tests |
| AUTH-008 | Low | Fixed now | `users/.../identityVerification/services/smileCallback.service.go:96-98`: `BelongsTo` needs a non-empty `partner_params.user_id` equal to the case owner. We always send `user_id` (`users/src/integrations/smileId.integration.go:69,85`) | `smileCallback.service_test.go` (omitted user_id case); `usersIdentityVerification.integration_test.go` now echoes user_id |
| HTTP-008 | Low | Fixed now | `POST /api/v1/admin/accounts` was `RequireStaff("", true)`. It now needs `verification:grant` plus step-up, matching `apps/admin/src/config/apiAccess.config.ts:23` (`users/src/modules/checkmarks/routes/checkmarks.routes.go:41`) | test `users/usersAdminAccountCreation.integration_test.go` |
| HTTP-009 | Low | Partly fixed | At least 32 characters is enforced for admin, moderation, ads, live, orders and auth (prod). users/catalog inbound internal tokens are only required to be non-empty (still constant-time and fail-closed) | Owner: platform. Add `RequireMinimumLength` to the users/catalog configs once the test fixtures use 32-character tokens |
| HTTP-010 | Low | Fixed | Duplicate of MONEY-006 (`payments/.../webhooks.controller.go:30-37`) | — |
| HTTP-011 | Low | False positive | The redirect target is the reviewed creative's destination, found from a **signed** impression token and ad id (`ads/.../redirectAdClick.handler.go:31-49`), and must be https or a `nantty://` deep link (`adDestination.service.go:170`). No request-supplied URL is followed | — |
| INFRA-015 | Low | Partly fixed now | `platform/postgres/database.connector.go`: `POSTGRES_MAX_OPEN_CONNECTIONS`/`POSTGRES_MAX_IDLE_CONNECTIONS` and `ConnMaxIdleTime` 5 min. `statement_timeout`/`lock_timeout` are not set (they need per-module tuning) | `database.connector_test.go` |
| INFRA-016 | Low | Fixed now (2026-10-11) | Every Go deployable serves a loopback-only Prometheus `/metrics`: request duration histograms by route pattern and status class, goroutine count, and `auth_session_denylist_{check,write}_failed_total`. The ADOT sidecar scrapes it and exports EMF to `Nantty/<env>`. Valkey and RabbitMQ are now in readiness | `telemetry/http.metrics_test.go`, `servicemodule/sharedReadiness_test.go` |
| INFRA-017 | Low | Open (process) | The destructive UP migrations remain; there is no backup checkpoint step | Owner: platform/DBA (deploy runbook) |
| INFRA-018 | Low | Partly fixed | Hooks now run after a bind failure (`orderedShutdown.go`). A slow request at shutdown still returns `DeadlineExceeded` (non-zero exit) | `TestShutdownHooksRunWhenTheServerFailsToStart` |
| INFRA-019 | Low | Fixed | `events/outbox.relay.go` exponential backoff (cap 30 s) | `TestOutboxRelayBacksOffWhileTheBrokerIsDown` |
| ADM-002 | Low | Fixed now | The same function blanks session IP and location without `users:read-pii` | same test |
| ADM-003 | Low | Open | `users/.../accountEnforcement.routes.go:36` PII reveal has no step-up (it needs a purpose and is audited) | Owner: identity + apps/admin (the client must send step-up before the route can require it) |
| ADM-004 | Low | Open (defence in depth) | `admin/.../staffAdmins.routes.go` superadmin-only routes use `RequireStaff("", true)`; the handlers check the superadmin role themselves | Owner: identity |
| ADM-005 | Low | Fixed now | `users/src/services/staffAudit.service.go`: a missing audit recorder now refuses the staff action. The `staffauth` catch-all audit logs at ERROR instead of returning silently | test `users/src/services/staffAudit.service_test.go` |
| TRU-015 | Low | Fixed | staffPermission.middleware.go | staffPermission.middleware_test.go TestStaffGuardDeniesAnEmptyPermissionListAndMissingStepUp |
| TRU-011 | Low | Fixed now (code from the previous fork plus new tests) | decideContentReport.handler.go isOwnReport (author or reporter); decideChatReport.handler.go:59 (reporter or reported user); appeals keep SAME_REVIEWER | moderationOwnReport.integration_test.go (2 tests) |
| TRU-012 | Low | Partly → Fixed now (ads/live/catalog 2026-10-10; orders 2026-10-11) | production requires *_REDIS_URL, including `ORDERS_REDIS_URL` (orders.config.go). With a nil store in production, `requireIdempotencyKey` returns 503 IDEMPOTENCY_UNAVAILABLE in ads, live, catalog and orders. | src/middlewares/idempotencyFailClosed_test.go in ads, live, catalog, orders; orders/src/configs/ordersRedisRequired_test.go |
| TRU-014 | Low | Open | live/src/services/sendGift.service.go:86-92: the burst count is read before the gRPC money charge, outside any lock | Recommend a Redis INCR with a 1 s TTL per sender in live before chargeGift. Money is safe (anti-spam only) |
| TRU-013 | Low | Fixed now | ads billing.routes.go:25-26: GET /api/v1/ads/pricing and POST /api/v1/ads/pricing/estimate now require a signed-in user (only apps/ads campaignWizard calls them) | adsPricingAuth.integration_test.go |
| COM-007 | Low | Fixed now | `orders/src/services/stockRelease.service.go`: cancellation, checkout abort and full refund release stock through `ReleaseReservedStock`, which clears `stock_reserved` only after inventory confirms. A failure leaves the flag set and the checkout sweep (`ReleaseStockOfClosedOrders`) retries cancelled/refunded groups until released | Test: `orders.stockReleaseRetry_integration_test.go` `TestCancelledOrderStockIsReleasedByTheSweepWhenTheFirstReleaseFails` |
| FLOW-005 | Low | Open | platform/viewerregion/viewerRegion.fx.go:26-53 reads the latest exchange_rate_revisions with no age check; rates come only from staff or seed | Owner: platform (GO-A) / currency. Reject or flag rates older than e.g. 48 h and alert; add an FX feed job |
| FLOW-006 | Low | Fixed now | `cancellation.service.go` sets `cancelAtPeriodEnd` and enqueues `subscription.providerCancelRequested` in one transaction; the outbox handler (`app.go`) cancels at the provider and skips plans resumed in the meantime. Provider failures are retried by the outbox | Test: `subscriptions.providerCancelOutbox_integration_test.go` `TestCancellingAProviderBilledPlanCommitsLocallyFirstAndCancelsAtTheProviderThroughTheOutbox` |
| AUTH-009 | Info | Open (accepted) | There is no concurrent-session cap; users can list and revoke sessions | Owner: product/identity |
| HTTP-012 | Info | Fixed | The global per-IP limiter (`rateLimit.middleware.go:97`) now covers `POST /analytics/product-interactions` | — |
| HTTP-013 | Info | Fixed | `ApplyCors` allowlist (`standard.middleware.go:83`) | `TestApplyCorsHonorsConfiguredAllowlist` |
| HTTP-014 | Info | Fixed | `catalog/src/services/storeAuditTrail.service.go:32-37` and `orders/.../sellerMoneyAudit.service.go:52` use `ClientIP`. Fixed now: catalog's staff change audit used the raw `X-Request-Id` and now uses the validated context ID | `TestForgedRequestIdsAreReplacedBeforeAuditsCanRecordThem` |
| HTTP-015 | Info | Partly fixed | Username availability is behind the per-IP auth limiter (`registration.routes.go:13`) and the global limiter. Enumeration is inherent to an availability check | Accepted |
| INFRA-020 | Info | Partly fixed now | `platform/logging/nestedRedaction.go` redacts sensitive keys inside structs, maps and slices logged with `slog.Any`. Free-text error messages are not scanned, and there is no metrics endpoint (INFRA-016) | `logging/structured.logger_test.go` |
| INFRA-021 | Info | False positive (configuration) | The OTel SDK used (v1.47.0) honours `OTEL_TRACES_SAMPLER`/`OTEL_TRACES_SAMPLER_ARG` when no sampler is set in code (`telemetry/tracing.provider.go:31`) | Set `OTEL_TRACES_SAMPLER=parentbased_traceidratio` in infra |
| ADM-006 | Info | Fixed | `ClientIP` everywhere | — |
| ADM-007 | Info | Fixed | The user denylist fails closed, the same as staff | — |
| ADM-008 | Info | Open (accepted) | The public sitemap lists public profile UUIDs by design; it is behind the global per-IP limiter | Owner: product/SEO |
| ADM-009 | Info | Partly fixed | Disable, suspend and MFA reset revoke sessions, which now reach the shared denylist (AUTH-003). Permission edits (`changeAdminPermissions.handler.go:66`) still apply at the next token (≤10 min) | Owner: identity |
| TRU-016 | Info | Fixed | moderation controllers use httpserver.ClientIP (10 sites, no raw X-Real-Ip) | platform ClientIP tests (GO-A) |
| TRU-017 | Info | Open (no risk) | modules/analytics/analytics.module.go is still a RoutelessModule stub | product decision |
| FLOW-007 | Info | Fixed now | Creator earnings moves are keyed by the payable account's credit high-water mark (`CreatorEarningsMoveReference(user, currency, creditsTotalMinor)`), not the date: overlapping runs over the same earnings share a reference (the ledger refuses the second), new earnings get a new one | Test: `wallet.creatorEarningsSameDay_integration_test.go` `TestASecondCreatorEarningsRunOnTheSameDayMovesNewEarningsButNeverMovesTheSameBalanceTwice` |
| MONEY-010 | Info | Partly → Fixed (stage 2), small remainder open (2026-10-11) | `AllocateProRata` now uses math/big. `EstimateLocalCheckoutFee` is obsolete (the previous payment provider removed). Remainder: `AllocateCheckoutGroups` total sum needs an overflow guard; it can't be reached under the payment caps. See SECURITY_SCAN_2026-10-11.md | – |
| gosec G202 creators | — | False positive | `creatorsDirectory.repository.go:179-251`: the `where` fragments are constants with `$n` placeholders; `LIMIT` uses `strconv.Itoa`; tables use `pgx.Identifier.Sanitize` | — |
| gosec G202 admin metricsSources | — | False positive | `admin/.../platformMetrics/services/metricsSources.service.go:23` uses `pgx.Identifier{schema,name}.Sanitize()`; all values are bound | — |
| gosec G704 ads moneyTopUps | — | False positive | `ads/.../moneyTopUps.integration.go:40`: the base URL comes from config (`MoneyHttpUrl`); the path segments are `url.PathEscape`d | — |
| gosec G304 payments config | — | Open (accepted, low) | `payments/src/configs/payments.config.go:212` `os.ReadFile` of an operator-set path | Owner: Flutterwave stage 2 (optional: `os.Root`) |
| gosec G104 ads storeCampaignReport | — | False positive | `ads/.../storeCampaignReport.handler.go:67,72`: the main `Close` error is checked; the ignored `Close` is on the scan-error return path | — |
