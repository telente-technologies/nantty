# Final check report (overnight verification and final QA pass, 2026-10-04)

Local machine only (8 cores, 15 GB RAM, Docker compose stack). Nothing was committed or pushed. Every number is a local baseline, not a production figure.

## 0.6 End-to-end QA beyond the happy path (2026-10-05, overnight)

Sandbox booted with `security/regression/startSandboxStack.sh` (fake Paystack, every listener on 127.0.0.1, `SANDBOX_RELAXED_LIMITS=1`), now including Phoenix realtime (127.0.0.1:4000) and Python intelligence (127.0.0.1:8090). Pre-flight passed before and after boot. Nothing committed; `docker compose stop` at the end; betng-* untouched; no ledger rows edited (tests only read the ledger; timers were moved on escrow, subscription, deletion and seller-credit rows).

### 0.6.1 Results

| Run | Result |
| --- | --- |
| apiSmoke baseline (old 54 tests) | 53/54; the one failure was the sandbox (live had no money gRPC, see fix 1) |
| apiSmoke final, full suite (19 files) | **89/89**. 2,502 calls, p50 3.3 ms, p95 39 ms, max 105 ms; only 5xx were the expected 503s for unconfigured Google/Apple sign-in; all DLQs empty |
| New journeys (35 tests in 10 files) | signup 5, social 5, checkout 6, seller 3, gifts 3, subscriptions 2, verification 1, downloads 4, deletion 4, contract fixes 2 |
| Go, every module, integration on (`go vet` + `go test -p 2`) | 20/20 modules, 126 packages ok |
| Vitest | gateway 1065, social 204 (`RUN_INTEGRATION=1`), notifications 193, media 110, search 64, support 67 |
| Realtime `format --check-formatted`, `compile --warnings-as-errors`, `mix test` | 63/63 (hex.pm unreachable at the end; ran with the cached hex home) |
| Intelligence pytest / ruff / ruff format / mypy | 233 passed, 2 skipped / clean / clean / clean |
| `tsc --noEmit`: 7 apps, 6 TS services, apiSmoke | 0 errors |
| App contract tests: webapp 30, studio 5, seller 4, ads 8, admin 7; mobile jest 115 | pass |
| `backend:check` | pass |

### 0.6.2 Journeys and the unhappy variants covered

Every variant asserts the HTTP status, a `{message, code}` body with a readable message, and the end state; money variants also assert one provider charge/refund and that every journal entry since the test started balances.

- **Sign up** (`signupEdgeJourney`): wrong code then right code; code locked after 5 wrong guesses, fresh code works; taken username gives `USERNAME_TAKEN` + suggestions, no account row, and the same verified email retries; Create account tapped twice creates one account; app closed after the code step: old code dead, new code works, token for another email refused.
- **Social** (`socialEdgeJourney`): Follow double-tap is one row; self-follow refused; following someone who blocked you refused; tagging a blocker silently drops the tag (no notification, not a candidate) while the friend gets a notification that links to the post; comment on a deleted post gives `POST_NOT_FOUND`; delete racing 6 comments keeps `commentCount` equal to saved comments.
- **Buy** (`checkoutEdgeJourney`): last unit bought by someone else between cart and pay (`INSUFFICIENT_STOCK`, cart shows unavailable, no half order); seller removes stock after add-to-cart; price change before checkout charges the new price, after checkout keeps the agreed price; double-tapped Pay (same key replays, two keys supersede, both charges captured, the duplicate auto-refunded, escrow holds once); paying again after paid (`ALREADY_PAID`); payment landing after the buyer cancelled (escrow refunded, one provider refund, order stays cancelled, re-pay refused with `ORDER_CANCELLED`); cancel after shipping (`ORDER_NOT_CANCELLABLE`, money stays held).
- **Sell** (`sellerEdgeJourney`): free-plan seller runs products, orders, inventory levels/summary, customers, shipping profile; Pro tools answer 402 `PLAN_FEATURE_REQUIRED` with `requiredPlan: pro`; refund above the paid amount and a zero refund are refused; a partial refund works once, a second refund for the rest is refused; one provider refund; refunded total never exceeds paid.
- **Live and gifts** (`giftEdgeJourney`): no coins gives `INSUFFICIENT_COINS` and moves nothing; double-tap with one key charges once and credits the host once; two keys are two gifts; an oversized gift is refused without touching the balance; a 10-gift burst never goes below zero (`GIFT_RATE_LIMITED` where it applies).
- **Subscribe / trial** (`subscriptionEdgeJourney`): seller trial with a ₦50 card check refunded at once; cancel during the trial keeps access until the end, then ends with no charge and the plan back to free; a second trial gets `TRIAL_NOT_AVAILABLE`. Card declined at renewal: `past_due` with the reason kept, plan kept during dunning, the failed period listed, `pay-now` with a good card restores `active`.
- **Verification** (`verificationRefundJourney`): Pro plan opens a case; staff reject refunds only the checkmark share (one provider refund, plan stays active); a second reject is refused.
- **Downloads** (`downloadsEdgeJourney`): allowed for a public post; guests asked to sign in; downloads off gives `DOWNLOADS_DISABLED` (author still can); private account refused for strangers and followers; blocked viewer refused.
- **Account deletion** (`accountDeletionJourney`): unconfirmed request refused; deletion scheduled exactly 30 days out; second request refused; signing in within 30 days cancels it with a notice and keeps profile and posts; once the grace passes the account is switched off and sign-in answers `ACCOUNT_DELETED`; a deactivated account comes back on sign-in.

### 0.6.3 Fixed in this pass

| # | Defect | Fix |
| --- | --- | --- |
| 1 | Sandbox: gifts used an in-memory money fake (no `LIVE_MONEY_GRPC_ADDRESS`), ads boosts likewise; seller plans were never enforced (no entitlements URL, so every seller was Business); realtime/intelligence not started; realtime bound 0.0.0.0 in dev | `startSandboxStack.sh` wires live/ads money gRPC, `SELLER_PLAN_ENTITLEMENTS_URL`, starts intelligence and realtime (`REALTIME_HTTP_IP=127.0.0.1` read in `config/runtime.exs`), optional relaxed limits; `preflight.sh` checks port 4000 |
| 2 | **Every inventory adjustment and stock transfer returned 500**: ent always sets the `*[]byte` for a NULL `response_body`, so `RunIdempotently` unmarshalled empty JSON | `inventory`, `orders`, `catalog` `container/transaction.container.go` (`len > 0`); new `inventory.idempotency_integration_test.go` |
| 3 | Cart said `available: true` and `stock: 0` for everything, so buyers only found out at checkout | `orders/services/cartView.service.go` + `cartViewAssembly.service.go`: stock from inventory, short items unavailable |
| 4 | A cancelled unpaid order could still be paid (charged, then auto-refunded) | `payments` initialize refuses with 409 `ORDER_CANCELLED` (order status read, fail-open with a warning; late-payment refund stays as the safety net); orders migration `20261005030000_grant_order_status_read_to_money` (column grant), `PAYMENTS_ORDER_STATUS_SCHEMA` |
| 5 | A comment racing a post delete could be saved on the deleted post and notify its author | `social` createComment increments `commentCount` only where `deletedAt` is null inside the transaction, else 404 `POST_NOT_FOUND` |
| 6 | **Deactivated accounts could never sign in again** (the app says "hidden until you log in again"; login said the password was wrong); executed deletions also said "wrong password" | `auth` login reactivates a deactivated account (notice "Welcome back…", `accountStatus.changed`), refuses executed deletions with 403 `ACCOUNT_DELETED`; port `AccountDeletionExecuted`; auth integration test |
| 7 | Notifications had no link, so a tapped notification could not open the post | `notifications` inbox adds `url` (from the stored `data.url`, relative paths only) |
| 8 | Private media bucket refused every write (SeaweedFS ran out of volume slots: "Not enough data nodes"), so downloads were 503 | `infra/local/docker-compose.yml`: `-master.volumeSizeLimitMB=128 -volume.max=64` |
| 9 | Contract: ads invites by email; theme preference; webapp guest pages | go-ads email-or-username invites (+ test, UI shows `@username`); `profiles.theme` + `PATCH /users/me/preferences {theme}` + `GET /users/me.theme` (migration `20261005022135_add_profile_theme`); webapp `SignInRequiredState`, auth-only reads removed from the guest list, live list/chat/gift tray/who-to-follow ask guests to sign in (+ contract test) |
| 10 | Old tests: money refund check matched other orders' partial-refund fee lines | scoped to its own escrow |

Fake Paystack: `/__smoke/charges/{ref}/complete?card=decline` saves a card that declines on later charges.

### 0.6.4 Remaining

| Item | Note |
| --- | --- |
| Self-service deletion keeps the auth row (email, password hash) | all seeded retention policies are `retain`, so execution only deactivates; erasure needs the owner's retention decision |
| Blue/Gold checkout needs verification eligibility | journeys use the seller Pro checkmark-share refund; full Blue refund is covered by the Go test only |
| Social sign-in after deactivation | only the password login reactivates |
| Gift right after creator approval | `RECIPIENT_CANNOT_RECEIVE_GIFTS` for a few seconds until the creator event lands (clear message, nothing charged) |
| Unknown-method responses from Go muxes are plain text 405, not `{message, code}` | e.g. `GET /seller/shipping/rules` |
| Webapp `/videos`, `/trending`, `/topics`, `/mart/highlights`, creator plans | still no backend |
| Hex.pm unreachable at the end of the run | realtime tests used the cached hex home |

## 0. Final QA and integration pass (2026-10-04, evening)

Compose stack started with `docker compose up -d --wait postgres valkey rabbitmq localstack object-storage` (LiveKit, OpenSearch, Jaeger not needed). Go migrations applied by the services at start (embedded Atlas); `prisma migrate deploy` for social, notifications, media, search, support. Services ran as built binaries / `tsx src/server.ts` from `.env.example`, goMoney against the fake Paystack, Phoenix realtime in `elixir:1.19` with `--network host` (the bridge network has no DNS for hex.pm on this machine). Nothing committed.

### 0.1 Results

| # | Item | Result |
| --- | --- | --- |
| 1 | Auth register + username suggestions, 409 `USERNAME_TAKEN` with suggestions (`TestTakenUsernameReturnsSuggestionsFromAvailabilityAndRegister`, `TestUsernameAvailability…`) | pass |
| 1 | Wallet monetisation holds (`TestRestrictedCreatorEarningsStayPendingUntilMonetisationIsRestored`) | **failed, fixed**, pass |
| 1 | Live host restrictions (`TestRestrictedHostsCannotGoLiveUntilTheirAccountRecovers`, needs `LIVE_TEST_DATABASE_URL=…/zudomart_test`); copyright claim, third strike, admin policy | pass |
| 1 | Verification: pay → Smile ID callback → auto-approve; reject → full refund (`TestIdentityVerificationJourneyFromRequestToAutoApproval`, `TestRejectedVerificationRequestsARefund`) | pass |
| 1 | Plan → checkmark-share partial refund with ledger idempotency key | no integration test existed; **added** `payments.checkmarkShareRefund_integration_test.go` (provider outage then retry: one journal entry `verification-share:<case>`, one provider refund of the share, reuse with other amount refused) | pass |
| 1 | Trial ₦50 card check refunded at once (`TestCardVerificationChargeIsRefundedAsSoonAsTheCardIsSaved`), seller trial (`TestSellerTrialSaves…`) | pass |
| 1 | `invoice_counters` concurrency (`TestInvoiceNumbersAreUniqueAndSequentialUnderConcurrency`), evidence retention (`TestEvidenceRetention…`) | pass |
| 1 | Orders success-rate rollup | no integration test existed; **added** `orders.successRate_integration_test.go` (20 settled in 90 days → 0.85, under-20 store has no rate, stale stores drop out) | pass |
| 1 | Whole Go workspace, integration on, per module (`go test -p 2 ./...`, `go vet`) | all 20 modules pass after the fixes below. `platform/zzsumcheck` does not compile (see 0.3) |
| 2 | apiSmoke journeys: social 10, trust 6, commerce 8, live 10 (incl. realtime socket fan-out), money 6 (incl. direct order), **Business plan 1% fee 3 (new)** | 43 / 43 |
| 2 | Route sweep (848 routes: 763 public, 60 internal hidden, 25 non-API) as guest, customer, superadmin; event flow (consumers, drain, empty DLQs) | 5 / 5 and 3 / 3 after fixes |
| 3 | Realtime `mix format --check-formatted`, `compile --warnings-as-errors`, `mix test` | 59 / 59 (one test file reformatted) |
| 3 | Terraform `init -backend=false && validate` | dev, staging, prod valid (staging/prod initialised offline with `-plugin-dir` from dev's aws 5.100.0 after the network drop; this left untracked `.terraform.lock.hcl` files in each env) |
| 4 | `tsc --noEmit`: mobile, webapp, web, studio, seller, ads, admin; gateway, social, notifications, media, search, support (+ test tsconfigs), apiSmoke | 0 errors |
| 4 | The old monolith (legacy) typecheck | 4 errors, not trivial (missing `loaders/admin.loader.js` and `modules/admin/routes`, `SocialSharedServices.discovery`, `AudienceSpec` shape); left, and the monolith was removed on 2026-10-10 |
| 4 | Vitest: gateway 1051, social 183 (`RUN_INTEGRATION=1`), notifications 183, media 89, search 50, support 62, email templates 205; mobile jest 98; app contract tests admin 7, seller 4, webapp 20, studio 5, ads 8 | all pass after fixes |
| 4 | Intelligence: pytest 233 passed / 2 skipped, ruff, ruff format, mypy (483 files) | pass |
| 4 | `backend:check` (300-line limit, no raw SQL in TS) | pass |
| 5 | Atlas: all 16 `atlas.sum` files verify with `migrate.Validate` (atlas v0.36.2 library, golang-migrate dir); every file is `<14-digit>_<snake>.{up,down}.sql` with a matching pair | pass |
| 5 | Hand-written SQL | migrations: grants, append-only protections, the owner's ledger FK grant, the two approved users data moves; one extra: `ads/20261003180000_drop_ad_monetization_policies` (hand-written `DROP TABLE`). Runtime: outbox, idempotency store, advisory locks, giftShare SUM (approved) plus cross-schema reads not in the G13 list: `subscriptions/repositories/identityDirectory`, `checkmarkEligibility`, `payments/repositories/verifiedAccountDirectory`, `wallet/utils/viewerCurrency` (all parameterised, identifiers sanitised) | pass with listed deviations |

### 0.2 Speed (per service, smoke journeys through the gateway, ms)

Client: `node:http` (see fix 9). 361 calls in the journeys; the route sweep (1647 calls, mostly 4xx) is p50 5.3 / p95 14.0.

| Service | Calls | p50 | p95 | max |
| --- | --- | --- | --- | --- |
| go:admin | 18 | 19.2 | 154.6 | 171.2 (staff login, argon2id) |
| go:auth | 53 | 18.3 | 125.0 | 144.7 (register/login) |
| go:catalog | 17 | 27.8 | 63.8 | 65.4 |
| go:escrow | 2 | 24.4 | 28.1 | 28.6 |
| go:inventory | 8 | 9.6 | 12.8 | 13.3 |
| go:live | 26 | 29.2 | 91.9 | 96.2 |
| go:moderation | 5 | 37.6 | 41.9 | 42.1 |
| go:orders | 37 | 45.2 | 123.4 | 142.1 (checkout) |
| go:payments | 42 | 14.4 | 47.3 | 62.3 |
| go:subscriptions | 1 | 76.8 | 76.8 | 76.8 |
| go:users | 43 | 16.9 | 43.1 | 45.7 |
| go:wallet | 48 | 18.4 | 45.9 | 51.4 |
| ts:media | 30 | 24.5 | 58.0 | 61.0 |
| ts:notifications | 4 | 9.8 | 11.6 | 11.8 |
| ts:search | 1 | 25.9 | 25.9 | 25.9 |
| ts:social | 26 | 49.4 | 210.1 | 316.7 (first DM, for-you feed) |
| all | 361 | 21.8 | 109.0 | 316.7 |

All within the `performance.md` §5 targets. Single-user journey numbers, not load figures (k6 is not installed any more; section 7 keeps the earlier k6 baselines).

### 0.3 Fixed in this pass

| # | Defect | Fix |
| --- | --- | --- |
| 1 | Monetisation holds were queried without the wallet schema (`MonetisationHold` missing from the ent `SchemaConfig`), so every hold read/write failed with `relation "monetisation_holds" does not exist` in any deployment | `go/modules/wallet/src/container/wallet.container.go` |
| 2 | Anniversary scheduler always failed on Postgres (`?` placeholders in `sql.ExprP`), so no zudoversary email ever went out | `go/modules/users/src/modules/celebrations/services/anniversaryScheduler.service.go` (`sql.P` + `Args`) |
| 3 | Six lists without `nextCursor`: `/pricing/creator-subscription-bands`, `/explore/categories`, `/explore/who-to-follow`, `/admin/strike-appeals`, `/admin/live-incidents`, `/admin/verification-cases` | `subscriptions/.../views.service.go`, `social/.../explore.controller.ts`, `moderation/.../listStrikeAppeals.handler.go`, `listLiveIncidents.handler.go`, `users/.../identityVerificationAdmin.controller.go` (additive `nextCursor: null`) |
| 4 | Invalid ad click link returned a plain-text 404 | `ads/.../tracking.controller.go` (`{message, code: AD_LINK_INVALID}`) |
| 5 | goAds never consumed `ads-domain-events` or `jobs-ads-reports` locally (consumer only created when `ADS_REPORT_QUEUE_NAME` is set); intelligence had no RabbitMQ URL, so `intelligence-domain-events` piled up (273) | `services/go/.env.example` (`ADS_REPORT_QUEUE_NAME`), `services/python/intelligence/.env.example` (`INTELLIGENCE_RABBITMQ_URL`) |
| 6 | Stale ads test expected the old 50,000 reserve; the regional pricing table is now the source | `ads/adsFlow.integration_test.go` reads the reserve from the pricing table |
| 7 | Direct-order smoke: seller onboarded as creator (no subaccount) and called a seller refund route that does not exist | `apiSmoke/src/commerceFixtures.util.ts` (`?role=seller`), `tests/moneyJourneys.smoke.test.ts` (refund through seller reject) |
| 8 | Business plan 1% fee had no end-to-end check | new `apiSmoke/tests/businessPlanFee.smoke.test.ts`: Business checkout → charge + `subscription.create` → active → escrow `commission_bps` 100, fee 11,500 on 1,150,000 → `revenue:escrowFees` 11,500 at release. Fake Paystack: `POST /__smoke/subscriptions/{reference}/create`, ids offset by start time so restarts never reuse recipient codes (`fakePaystackServer_test.go`) |
| 9 | Latency numbers were wrong: Node 24.19 `fetch` (undici) stalls 1–2 s after short idle gaps on this machine (curl and `node:http` are fast) | `apiSmoke/src/apiClient.util.ts` uses `node:http`, optional `SMOKE_LATENCY_LOG` |
| 10 | Search keyset test assumed an empty index; support content test flagged official `@zudomart.com` addresses as personal data; seller contract tests loaded a CSS module through the web-kit barrel | `search/tests/integration/searchPostgres.integration.test.ts`, `support/tests/content/helpContentSeed.test.ts`, `apps/seller/src/config/siteMetadata.config.ts` (imports the two pure helpers directly) |

### 0.5 Money fixes after QA (exactly-once refunds, duplicate bank, seller refunds, SEC-0008/0013)

| # | Defect | Fix | Test |
| --- | --- | --- | --- |
| 1 | Redelivered checkmark-share / full verification refund could call Paystack twice | Refund intent row (`idempotent_requests`, scope `billingRefund`, key `verification-share:{caseId}` / `verification-refund:{caseId}`) moves pending → submitted → succeeded/failed under a row lock; the ledger entry is posted in the same transaction as pending → submitted, before Paystack is called. A fresh `submitted` row answers `409 REFUND_IN_FLIGHT`; an unknown or stale outcome is looked up (`GET /refund`) before any resend. Paystack refunds take no client reference, so the reference travels in `merchant_note` as `[ref:…]` and the lookup matches on it (`billingRefundIntents.service.go`, `paystackRefundLookup.integration.go`) | `payments.billingRefundExactlyOnce_integration_test.go`: two consumers at once → one `POST /refund`, ledger balanced; lost reply → looked up, not resent; full refund concurrent |
| 1 | Audit of other Paystack money calls | `payment_refunds` (orders, escrow, card check, subscription payments): a retried attempt (`attempt_count > 1`) is looked up first; stale "provider call failed" rows are requeued by the sweep. Transfers: resent only when `/transfer/verify` says not found (the reference makes Paystack dedupe anyway). `charge_authorization`: Paystack refuses a reused reference; a "Duplicate Transaction Reference" now reads as pending, and the renewal engine confirms the previous attempt's reference with Paystack before charging a new one (`billingChargeOutcome.service.go`, `renewalEngine.service.go`) | `TestCardCheckRefundWithLostReplyIsNotSentTwice`, `TestRenewalWithALostPaystackReplyChargesTheCardOnce` |
| 2 | Two stores with one bank account retried onboarding forever | HMAC fingerprint of bank code + account number in `provider_payout_destinations` (advisory lock per fingerprint). A second store gets `409 BANK_ACCOUNT_ALREADY_LINKED` "This bank account is already linked to another store.", nothing is queued, and `payoutAccount.duplicateBankAccount` (advisory) goes to `trust-domain-events` → go-trust opens an advisory suspension case. Jobs already queued fail once and are excluded from reconciliation | `payments.duplicateSettlementAccount_integration_test.go`, `payoutDuplicateBank.job_test.go` |
| 3 | `POST /api/v1/seller/orders/{id}/refunds` missing | go-commerce, `orders:manage`, `Idempotency-Key` required; amount 1 … total − refunded (422 `REFUND_AMOUNT_INVALID` for ≤ 0); 409 `ORDER_NOT_REFUNDABLE` when disputed, unpaid, cancelled/refunded or a refund is already on its way. Escrow held: partial or full out of escrow; released or direct: full only (seller balance, or seller debt for direct). Emits `orderGroup.refundRequested`; go-money's escrow handler posts the ledger and calls Paystack. Gateway route covered by the existing commerce prefix | `orders.sellerRefund_integration_test.go`, `escrow.sellerRefund_integration_test.go`, gateway `upstreamRoutes.routes.test.ts` |
| SEC-0013 | Refund amount ≤ 0 meant "full" | `RefundSubscriptionPayment` needs an amount > 0 or an explicit `Full: true` (422 `REFUND_AMOUNT_INVALID`); seller refunds likewise | `TestRefundAmountsAtOrBelowZeroAreRefusedNotTreatedAsFull` |
| SEC-0008 | Paystack `authorization_code` returned to and accepted from devices | Device card setups store the encrypted authorization server-side (AES-GCM, `billing_authorizations`); `/saved-cards/setups/{ref}/complete` returns `savedCardId`; `/saved-cards/charges` takes `savedCardId`, scoped to the owner. Mobile types, mock, service and secure storage switched to `savedCardId` (old key wiped) | `TestSavedCardAuthorizationNeverLeavesTheServerAndChargesUseTheOwnersSavedCardId` (not in any response, column or log) |

Runs (one at a time, `nice -n 5`): payments, escrow, subscriptions (incl. `TestSellerTrialConverts…`, `TestBlackKeeps…`), orders, moderation pass; notifications vitest 193 pass; apiSmoke `moneyJourneys` 6/6 (needs `LEDGER_SELLER_CREDIT_MATURING_INTERVAL=5s`, relaxed gateway OTP limits, `ORDERS_MONEY_GRPC_ADDRESS=localhost:9103`); RabbitMQ definitions load (`jobs-subscription-billing` and the new trust binding present).

Not caused by these fixes:
- apiSmoke `businessPlanFee` fails at `POST /__smoke/subscriptions/{ref}/create` ("no paid plan checkout"): the renewal engine no longer sends a Paystack plan at checkout, so the smoke step is out of date (billing work).
- wallet `TestRestrictedCreatorEarnings…` / `TestConcurrentHealthEvents…` passed earlier in this pass, then failed (`sql: no rows`) while `monetisationHolds.service.go` and its tests were being edited by another agent.

Limits: one seller refund per order (escrow allows one partial settlement); released/direct orders refund only in full. The full verification refund path still posts no ledger entry of its own (unchanged).

### 0.4 Remaining

| Item | Reason |
| --- | --- |
| `services/go/platform/zzsumcheck/main.go` breaks `go build/vet ./...` for the platform module and `pnpm backend:test:go` (imports `ariga.io/atlas/cmd/atlas/x`, calls undefined `sqltoolDir`) | committed scratch file; deleting it was blocked by the permission classifier. Owner: delete it |
| `order.cancelled` from checkout abort has no `buyerUserId`, so notifications drop it (WARN, not DLQ) | known 6.2 item: producer/consumer contract |
| The old monolith type errors | moot: the monolith was removed on 2026-10-10 |
| Docker bridge DNS | `test-realtime-in-docker.sh` cannot fetch hex without `--network host` on this machine |
| Payments ent schema/migration files changed during this pass by the billing agent | not part of these results; re-run payments tests after that work lands |


## 1. Summary

| Area | Result |
| --- | --- |
| Stack | `backend:reset` + `backend:up`, all migrations applied (embedded Atlas for Go, `prisma migrate deploy` for social, notifications, media, search). All 13 processes started and reported ready: goIdentity, goCommerce, goMoney, goLive, goAds, goTrust, gateway, social, notifications, media, search, Phoenix realtime (`elixir:1.19` container), intelligence |
| API sweep | 785 service routes inventoried. 709 are public through the gateway: all 709 answer without 5xx, with the right auth behaviour (guest, customer, staff) and the `{message, code}` / `{data, nextCursor}` shapes. 53 internal routes are hidden (404). 0 unrouted, 0 misrouted |
| Journeys | First pass: 34 of 40 smoke tests pass; the 6 failures were **ledger writes refused under the real service roles**. Second and third pass (sections 6.1, 6.1.1): the ledger fix and the order fix work. Commerce 8/8, new money journeys 5/5 (multi-seller, fees, 72 h auto-release, 24 h lock, payout, refund), creator payout and USD checkout pass, live journey passes except the realtime socket assertions (no hex network). Direct orders are not reachable over HTTP |
| Test suites | All green: Go 92 packages (450 test functions, integration on), gateway 109, social 68, notifications 157 (+4 integration), media 81, search 46, realtime 57, intelligence 177 (ruff, format, mypy clean), email templates 172, mobile jest 24, app contract tests 18, `backend:check` |
| Frontend | `tsc` clean in all 7 apps. `next build` passes for admin, ads, seller, studio, web, webapp (admin was failing at HEAD; fixed). Lint has 0 errors (was 6) |
| Terraform | `terraform validate` passes for `envs/dev`, `staging`, `prod` |
| Speed | Every measured endpoint is within the `performance.md` section 5 targets at 5–10 VUs. Notes: intelligence `/v1/feed/rank` p95 is 119 ms against its 100 ms client timeout; realtime fan-out p50 is 192–455 ms (outbox poll bound) |
| RabbitMQ | Every domain-event queue has a consumer, queues drain, and all DLQs stay empty after the journeys and the k6 runs (they had 106 + 4 + 1 dead letters before the fixes) |

## 2. How it was run

- Services ran from the source tree with `services/go/.env.example` and each service's `.env.example`. The gateway ran with raised `RATE_LIMIT_*_PER_MINUTE` / `GUEST_*` limits, otherwise signup and OTP limits stop a sweep.
- goMoney used the **Paystack provider fake**: no `PAYSTACK_*` test keys exist in the environment. The fake is the existing payments test harness, served by the new env-gated test `TestServeFakePaystackForLocalApiSmoke`, with `PAYSTACK_SECRET_KEY=sk_test_fake_paystack` and `PAYSTACK_API_BASE_URL=http://127.0.0.1:18999`.
- New smoke/contract suite: `services/scripts/apiSmoke` (vitest, workspace package `@zudomart/api-smoke`, root script `pnpm backend:test:smoke`). It needs `SMOKE_IDENTITY_LOG` (path to the go-identity log, where `AUTH_OTP_DELIVERY=log` writes signup codes) and, optionally, `SMOKE_BOOTSTRAP_SUPERADMIN_BINARY`, `SMOKE_GATEWAY_URL`, `SMOKE_REALTIME_URL`, `SMOKE_FAKE_PAYSTACK_URL`. It creates its own users, seller, creators and a superadmin (through the bootstrap CLI, with TOTP enrolment and step-up). Reports go to `services/scripts/apiSmoke/reports/` (ignored by git).
- k6 v2.3.0 (local binary): `services/scripts/apiSmoke/load/serviceBaselines.k6.js`, with fixtures from `load/prepareLoadFixtures.script.ts`. Each scenario ran on its own, constant VUs for 20 s.

## 3. What passed (test counts)

| Suite | Command | Result |
| --- | --- | --- |
| Go workspace (build, vet, unit + integration against compose Postgres) | `pnpm backend:test:go` | 92 packages ok, 0 failed |
| Gateway | vitest | 109 / 109 |
| Social (`RUN_INTEGRATION=1`) | vitest | 68 / 68 |
| Notifications | vitest (+ `NOTIFICATIONS_INTEGRATION_DATABASE_URL`) | 153 + 4 integration / 157 |
| Media (`RUN_INTEGRATION=1`) | vitest | 81 / 81 |
| Search (`RUN_INTEGRATION=1`) | vitest | 46 / 46 |
| Realtime (Phoenix) | `pnpm backend:test:realtime` (format check, warnings as errors, tests) | 57 / 57 |
| Intelligence | `uv run pytest`, `ruff check`, `ruff format --check`, `mypy` | 177 passed, 2 skipped; all clean |
| Email templates | vitest | 172 / 172 |
| Backend rules | `pnpm backend:check` | pass (300-line limit, no raw SQL in TS) |
| App contract tests | `pnpm test:contracts` in admin, seller, webapp, studio, ads | 2 + 2 + 7 + 5 + 2, all pass |
| Frontend types | `tsc --noEmit` in admin, ads, seller, studio, webapp, web, mobile | 0 errors |
| Next builds (sequential) | `pnpm build` in admin, ads, seller, studio, web, webapp | all pass |
| Mobile | `jest` | 24 / 24 |
| Lint | `pnpm -r --workspace-concurrency=1 run lint`, `pnpm lint:styles` | 0 errors (warnings only) |
| API smoke | `pnpm backend:test:smoke` | 34 / 40 (section 6.1) |
| Terraform | `terraform init -backend=false && terraform validate` | dev, staging, prod valid |
| Atlas lint | `atlas migrate lint` | not run: the atlas CLI is not installed |

## 4. What was fixed

### Correctness and contract bugs found by the API checks

| Problem | Fix (files) |
| --- | --- |
| Gateway had no `ads` upstream, so all 80 go-ads routes were unreachable. Subscriptions, returns, `/ads/balance`, `/admin/wallet`, `/admin/subscriptions`, `/admin/ads*`, `/admin/advertisers`, `/admin/ad-policies` and the public overlay scene were unrouted or misrouted (104 routes in total) | `services/typescript/gateway/src/configs/gateway.config.ts` (`UPSTREAM_ADS_URL`, default `:8110`), `src/routes/upstream.routes.ts`, `.env.example`, `tests/upstreamRoutes.routes.test.ts` (new cases); `tests/gatewayHardening.handler.test.ts` and `tests/upstreamDispatch.handler.test.ts` (fixtures were already missing `search`, so the test typecheck failed) |
| LiveKit webhooks (`/api/v1/live/webhooks/livekit`) were behind "required" auth, so they could never pass the gateway | `upstream.routes.ts` (raw-body passthrough route with optional auth) |
| Live admin gift catalogue only accepted a customer token with role `admin`, which nobody has; staff tokens were refused (and the gateway refused them too) | `services/go/modules/live/src/middlewares/live.middleware.go`, `src/app.go`, `src/container/live.container.go` (staff JWKS verifier, permission `config:revenue` / `money.monetization.manage` or superadmin), gateway route now optional auth |
| Approved creators never got the `creator` role in their token, so `LIVE_REQUIRE_CREATOR_PROGRAM_TO_HOST` blocked every host | `services/go/platform/identityports/identityPorts.interface.go` (`SetAccountRole`), `identitytest/fakeAccountEnforcement.fake.go`, `services/go/modules/auth/src/services/accountEnforcement.service.go`, `services/go/modules/users/src/modules/creatorProgram/services/creatorRole.service.go` (new), `commands/submitCreatorApplication/*.handler.go`, `commands/decideCreatorApplication/*.handler.go` |
| Approved creators were never enrolled in the gift program, so every gift failed ("Neither the recipient nor the host is in the Creator Program") and surfaced as a misleading 502 `MONEY_UNAVAILABLE` | `services/go/modules/ledger/src/loaders/moneyDomainEvents.loader.go` (several handlers per event type), `services/go/modules/creators/src/app.go` + `modules/creatorProgram/services/creatorProgram.service.go` (enrol in the default tier on `creatorApplication.approved`; never overrides a staff-set tier), live: `interfaces/moneyGateway.interface.go`, `integrations/moneyGrpc.integration.go`, `services/sendGift.service.go` (409 `RECIPIENT_CANNOT_RECEIVE_GIFTS`) |
| Mobile sends only `mediaIds` when posting, but social demanded a full media descriptor for each, so every mobile post with media failed with 422 | `services/typescript/social/src/integrations/httpMediaDescriptorResolver.integration.ts` (new), `src/interfaces/mediaDescriptorResolver.interface.ts` (new), `src/modules/posts/commands/createPost/createPost.handler.ts`, `src/types/handlerContext.type.ts`, `src/configs/social.config.ts`, `src/app.ts`, `.env.example` (`MEDIA_INTERNAL_URL/TOKEN`). The resolver also checks ownership |
| Presigned S3 PUT URLs contained the CRC32 of an empty body (AWS SDK v3 default), so **every real upload failed** with `BadDigest` (AWS S3 rejects the same way) | `services/typescript/media/src/integrations/s3ObjectStorage.integration.ts` (`requestChecksumCalculation`/`responseChecksumValidation: WHEN_REQUIRED`) |
| First direct message in a conversation returned 500: the streak sender-day row referenced a `chat_streaks` row that did not exist yet | `services/typescript/social/src/modules/streaks/repositories/streak.repository.ts` |
| People search returned 500 whenever there was a match (Prisma also reads `users.account_suspensions.id`, which was not granted) | `services/go/modules/users/src/migrations/20261004020000_grant_read_access_to_account_suspension_ids.{up,down}.sql` + `atlas.sum` (rehashed) |
| Users who never opened their profile had no `users.profiles` row, so social treated them as deleted (couldn't be mentioned, messaged or searched) | `services/go/modules/users/src/modules/checkmarks/checkmarks.module.go`, `services/entitlementEvents.service.go` (+ test): users consumes `account.registered` and creates the personal profile. `infra/local/rabbitmq/topology.json` + `definitions.json` bind it to `identity-domain-events`. Lazy creation still works as a fallback |
| `GET /lives/{id}/points/me` returned 500 for any viewer without points (`SUM` over no rows is NULL) | `services/go/modules/live/src/services/awardEngagementPoints.service.go` |
| Search raw queries ran without a `search_path`, so indexing and querying failed ("relation documents does not exist") | `services/typescript/search/src/databases/prisma.database.ts` |
| Search indexing crashed on stores with no categories (Go sent `null`) | `services/go/modules/catalog/src/modules/internalSources/services/searchSourceBuilder.service.go`, `services/typescript/search/src/modules/indexing/services/entityDocumentBuilders.service.ts` |
| Notifications dead-lettered every camelCase event type (`creatorApplication.*`, `payoutAccount.*`, `dataExport.*`, …) as "invalid envelope" | `services/typescript/notifications/src/modules/eventIngestion/validators/domainEvent.validator.ts`, `tests/domainEventEnvelope.test.ts` (new) |
| Every email failed with "React is not defined": under `tsx`, email-template `.tsx` outside the tsconfig `include` compiled with the classic JSX runtime. Production starts notifications with `tsx` too | `services/typescript/notifications/tsconfig.json` |
| Admin `next build` failed at HEAD: an App Route pulls the email renderer through the mock backend, and `createContext` does not exist in the react-server build | `packages/emailTemplates/src/blocks/emailRenderContext.ts` (AsyncLocalStorage instead of React context), `layout/emailDocument.layout.tsx`, `render/renderEmail.tsx` |
| Intelligence dead-lettered `follow.created`, `block.created`, `report.created`, `message.sent` (no envelope mapping) | `services/python/intelligence/src/events/domain_event_dto.py`, `tests/modules/domain_events/test_contract_envelope_normalization.py` (new) |
| Media → intelligence moderation calls were rejected (no HMAC signature), so with `MODERATION_FAIL_MODE=allow`, **uploads were never moderated** | `services/typescript/media/src/integrations/httpModerationClient.integration.ts` (v1 HMAC like search), `tests/integrations/scanAndModeration.test.ts`, `.env.example`, `services/python/intelligence/.env.example` (shared local secret) |
| Realtime never received `liveComment.*`, `liveViewer.*`, `liveRoomSettings.updated`, `liveRecording.*`, `overlayScene.*` (the topic binding `live.*` does not match them) | `infra/local/rabbitmq/topology.json`, `definitions.json` |
| Five lists missed `nextCursor` | `go/modules/wallet/src/modules/coins/controllers/coinPriceTable.controller.go`, `go/modules/users/src/modules/legal/queries/listCurrentPolicyVersions/*.handler.go`, `listLegalDocuments/*.handler.go`, `go/modules/admin/src/modules/staffAdmins/queries/listStaffRoles/listStaffRoles.query.go`, `typescript/search/src/modules/recentSearches/controllers/recentSearches.controller.ts` |
| Notifications had no `/readyz` | `services/typescript/notifications/src/app.ts` |

### Startup and configuration

| Problem | Fix |
| --- | --- |
| `services/go/.env.example` could not be sourced (unquoted `;` in `PAYSTACK_TRANSFER_FEE_BANDS`) | quoted |
| goAds could not start from `.env.example` (no `ADS_DATABASE_URL`; staff JWKS default pointed at go-money) | `ADS_DATABASE_URL`, `ADS_DATABASE_SCHEMA`, `ADS_REDIS_URL`, `ADS_STAFF_JWKS_URL`, `ADS_STAFF_TOKEN_ISSUER` added; root script `backend:dev:ads` (`:8110`) |
| Notifications `.env.example` could not be sourced (unquoted `<…>` in `SES_FROM_ADDRESS`) | quoted |
| Social `prisma migrate` only read `SOCIAL_DATABASE_URL` (`.env.example` sets `DATABASE_URL`) | `services/typescript/social/prisma.config.ts` falls back to `DATABASE_URL` |
| Search migrations ran against `public` (`DATABASE_URL` has no `?schema=`) and `pg_trgm` needs database CREATE | `services/typescript/search/prisma.config.ts` (adds the schema from `DATABASE_SCHEMA`), `infra/local/postgres/create-databases.sh` (creates `pg_trgm` in schema `search`) |
| Phoenix defaulted the live internal URL to `:8110` (live is `:8102`) | `services/elixir/realtime/config/runtime.exs` |
| Realtime `mix.lock` lacked the `amqp` deps declared in `mix.exs`, and 11 files failed `mix format --check-formatted` | lock synced by `mix deps.get`; formatter applied (formatting only) |
| LocalStack 4.9 does not emulate SESv2, so every email dead-lettered locally | `EMAIL_PROVIDER=log` (new `src/integrations/loggingEmail.integration.ts`, config, container; refused when `NODE_ENV=production`), set in notifications `.env.example`; SES stays the default |

### Tests, tooling and lint

- Flaky media test (root cause): the pipeline tests re-encode large images to AVIF/WebP/JPEG. Under parallel workspace runs, libvips' per-worker thread pools oversubscribe the CPU, and the tests ran 3× slower (up to 2.5 s each here, past 5 s on a busier machine). Fix: small images where size is not asserted, `sharp.concurrency(2)` per test worker (`tests/setup/limitSharpThreads.setup.ts`), and `testTimeout: 20 s` (`services/typescript/media/vitest.config.ts`, `tests/pipeline/mediaPipeline.test.ts`). Under the same CPU contention, the slowest test dropped from 2.5 s to 1.2 s.
- Lint errors (6): `packages/eslintConfig/createConfig.mjs` (`no-namespace` allows declarations, needed for `declare global` augmentation in mobile); literal BOM characters replaced with `﻿` in `apps/ads/src/mocks/handlers/reports.mock.ts` and `apps/seller/src/components/catalog/productImportView.tsx`; `apps/seller/src/components/catalog/productBasicsSection.tsx` uses `next/link`.
- New: `services/scripts/apiSmoke/**` (route inventory, sweep, 5 journeys, event-flow checks, k6 load scenarios), `services/go/modules/payments/src/integrations/paymentsTesting/fakePaystackServer_test.go` (skipped unless `FAKE_PAYSTACK_LISTEN_ADDRESS` is set), root scripts `backend:test:smoke` and `backend:dev:ads`, `pnpm-workspace.yaml` entry, `pnpm-lock.yaml` importer.

## 5. API coverage

Journeys (`services/scripts/apiSmoke/tests`):

| Journey | Steps | Result |
| --- | --- | --- |
| Social (`socialJourney`) | signup (OTP) → profile → follow → upload plan → S3 PUT → processing → post with media and mention → following feed → comment with mention → like → bookmark (`saveCount` = 1) → people and post search → notifications for both users | 10 / 10 |
| Commerce (`commerceJourney`) | business profile → store → shipping + location → product with image and stock → address → cart → shipping quote → checkout → payment initialize → fake Paystack charge + signed webhook through the gateway → escrow → accept, ship, deliver → confirm receipt → release → payout onboarding → wallet → transfer | 4 / 8: stops at settlement (section 6.1) |
| Live (`liveJourney`) | staff relaxes `creator-thresholds` (step-up) and restores it → creator approval grants the role → staff creates a gift and coin package → live start → viewer joins + realtime subscription → live comment fan-out over the socket → coin purchase via fake → gift → guest invite → battle → settlement → end | 6 / 8: coins and gift blocked (section 6.1) |
| Trust (`trustJourney`) | message request (E2E envelope) → requests folder → accept → reply → outsider refused → report a post → staff `HIDE` → post hidden → admin queue refuses a customer token → recipient inbox | 6 / 6 |
| Events (`eventFlow`) | consumers on every domain queue, queues drain, every DLQ empty | 3 / 3 |
| Route sweep (`routeSweep`) | inventory, internal routes hidden, every public route as guest, customer and superadmin | 5 / 5 |

### Route table

Each route was called through the gateway with sample ids and an empty body (writes), as guest, customer and (admin GET routes) superadmin. Statuses are the gateway responses. "pass" means: no 5xx, auth enforced (guest gets 401 on authenticated routes, customer tokens get 401/403 on admin routes), every 4xx has `{message, code}`, and every 200 list has `{data, nextCursor}`. Self-destructive customer routes (logout, revoke sessions, deactivate, deletion request, username/password change, acting-profile switch) were only swept as guest.

Totals: 785 service routes; 709 public through the gateway, 53 internal-only (gateway answers 404), 23 non-API (health, JWKS, `/internal/v1`), 0 unrouted, 0 misrouted.

| Service | Method | Path | Gateway | Guest | Customer | Staff | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| go:admin | GET | `/api/v1/admin/admins` | identity (optional) | 401 | 401 | 200 | pass |
| go:admin | POST | `/api/v1/admin/admins` | identity (optional) | 401 | 401 | – | pass |
| go:admin | GET | `/api/v1/admin/admins/{staffId}` | identity (optional) | 401 | 401 | 404 | pass |
| go:admin | POST | `/api/v1/admin/admins/{staffId}/approve` | identity (optional) | 401 | 401 | – | pass |
| go:admin | POST | `/api/v1/admin/admins/{staffId}/disable` | identity (optional) | 401 | 401 | – | pass |
| go:admin | POST | `/api/v1/admin/admins/{staffId}/enable` | identity (optional) | 401 | 401 | – | pass |
| go:admin | PATCH | `/api/v1/admin/admins/{staffId}/permissions` | identity (optional) | 401 | 401 | – | pass |
| go:admin | PUT | `/api/v1/admin/admins/{staffId}/permissions` | identity (optional) | 401 | 401 | – | pass |
| go:admin | POST | `/api/v1/admin/admins/{staffId}/reset-mfa` | identity (optional) | 401 | 401 | – | pass |
| go:admin | POST | `/api/v1/admin/admins/{staffId}/revoke` | identity (optional) | 401 | 401 | – | pass |
| go:admin | POST | `/api/v1/admin/admins/{staffId}/suspend` | identity (optional) | 401 | 401 | – | pass |
| go:admin | GET | `/api/v1/admin/audit` | identity (optional) | 401 | 401 | 200 | pass |
| go:admin | GET | `/api/v1/admin/audit/export` | identity (optional) | 401 | 401 | 200 | pass |
| go:admin | GET | `/api/v1/admin/audit/facets` | identity (optional) | 401 | 401 | 200 | pass |
| go:admin | GET | `/api/v1/admin/audit/{entryId}` | identity (optional) | 401 | 401 | 404 | pass |
| go:admin | POST | `/api/v1/admin/auth/accept-invitation` | identity (optional) | 400 | 400 | – | pass |
| go:admin | POST | `/api/v1/admin/auth/login` | identity (optional) | 400 | 400 | – | pass |
| go:admin | POST | `/api/v1/admin/auth/logout` | identity (optional) | 401 | skip | – | pass |
| go:admin | GET | `/api/v1/admin/auth/me` | identity (optional) | 401 | 401 | 200 | pass |
| go:admin | POST | `/api/v1/admin/auth/mfa/enroll/confirm` | identity (optional) | 400 | 400 | – | pass |
| go:admin | POST | `/api/v1/admin/auth/mfa/enroll/start` | identity (optional) | 400 | 400 | – | pass |
| go:admin | POST | `/api/v1/admin/auth/mfa/verify` | identity (optional) | 400 | 400 | – | pass |
| go:admin | POST | `/api/v1/admin/auth/refresh` | identity (optional) | 400 | 400 | – | pass |
| go:admin | POST | `/api/v1/admin/auth/step-up` | identity (optional) | 401 | 401 | – | pass |
| go:admin | GET | `/api/v1/admin/config` | identity (optional) | 401 | 401 | 200 | pass |
| go:admin | GET | `/api/v1/admin/config/{key}` | identity (optional) | 401 | 401 | 404 | pass |
| go:admin | PUT | `/api/v1/admin/config/{key}` | identity (optional) | 401 | 401 | – | pass |
| go:admin | GET | `/api/v1/admin/roles` | identity (optional) | 401 | 401 | 200 | pass |
| go:admin | POST | `/api/v1/admin/roles` | identity (optional) | 401 | 401 | – | pass |
| go:admin | GET | `/api/v1/admin/staff-settings` | identity (optional) | 401 | 401 | 200 | pass |
| go:admin | PUT | `/api/v1/admin/staff-settings` | identity (optional) | 401 | 401 | – | pass |
| go:admin | POST | `/api/v1/internal/admin/audit-entries` | internal | – | – | – | hidden (404) |
| go:admin | GET | `/api/v1/internal/admins/{staffId}/notification-recipient` | internal | – | – | – | hidden (404) |
| go:admin | POST | `/api/v1/internal/audit/events` | internal | – | – | – | hidden (404) |
| go:admin | GET | `/api/v1/internal/audit/history` | internal | – | – | – | hidden (404) |
| go:admin | GET | `/api/v1/internal/platform-config/{key}` | internal | – | – | – | hidden (404) |
| go:admin | GET | `/api/v1/platform-config/creator-requirements` | identity (optional) | 200 | 200 | – | pass |
| go:ads | GET | `/api/v1/admin/ad-policies` | ads (optional) | 401 | 401 | 200 | pass |
| go:ads | POST | `/api/v1/admin/ad-policies` | ads (optional) | 401 | 401 | – | pass |
| go:ads | PUT | `/api/v1/admin/ad-policies/{policyId}` | ads (optional) | 401 | 401 | – | pass |
| go:ads | GET | `/api/v1/admin/ads` | ads (optional) | 401 | 401 | 200 | pass |
| go:ads | GET | `/api/v1/admin/ads-policies` | ads (optional) | 401 | 401 | 200 | pass |
| go:ads | PUT | `/api/v1/admin/ads-policies/frequency/{format}` | ads (optional) | 401 | 401 | – | pass |
| go:ads | GET | `/api/v1/admin/ads/{adId}` | ads (optional) | 401 | 401 | 404 | pass |
| go:ads | POST | `/api/v1/admin/ads/{adId}/appeal/resolve` | ads (optional) | 401 | 401 | – | pass |
| go:ads | POST | `/api/v1/admin/ads/{adId}/approve` | ads (optional) | 401 | 401 | – | pass |
| go:ads | POST | `/api/v1/admin/ads/{adId}/reject` | ads (optional) | 401 | 401 | – | pass |
| go:ads | GET | `/api/v1/admin/advertisers` | ads (optional) | 401 | 401 | 200 | pass |
| go:ads | POST | `/api/v1/admin/advertisers/{advertiserId}/reinstate` | ads (optional) | 401 | 401 | – | pass |
| go:ads | POST | `/api/v1/admin/advertisers/{advertiserId}/suspend` | ads (optional) | 401 | 401 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts` | ads (required) | 401 | 200 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | PATCH | `/api/v1/ads/accounts/{accountId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/activity` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/ad-sets` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/ad-sets` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/ad-sets/{adSetId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | PATCH | `/api/v1/ads/accounts/{accountId}/ad-sets/{adSetId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/ads` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/ads` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/ads/{adId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | PATCH | `/api/v1/ads/accounts/{accountId}/ads/{adId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/ads/{adId}/appeal` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/audiences` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/audiences` | ads (required) | 401 | 400 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/audiences/customer-lists` | ads (required) | 401 | 400 | – | pass |
| go:ads | DELETE | `/api/v1/ads/accounts/{accountId}/audiences/{audienceId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | PATCH | `/api/v1/ads/accounts/{accountId}/audiences/{audienceId}` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/billing` | ads (required) | 401 | 404 | – | pass |
| go:ads | PUT | `/api/v1/ads/accounts/{accountId}/billing/funding-mode` | ads (required) | 401 | 404 | – | pass |
| go:ads | PUT | `/api/v1/ads/accounts/{accountId}/billing/spend-limit` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/billing/transactions` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/bulk-actions` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/campaigns` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/campaigns` | ads (required) | 401 | 404 | – | pass |
| go:ads | DELETE | `/api/v1/ads/accounts/{accountId}/campaigns/{campaignId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/campaigns/{campaignId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | PATCH | `/api/v1/ads/accounts/{accountId}/campaigns/{campaignId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/campaigns/{campaignId}/duplicate` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/campaigns/{campaignId}/submit` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/content-sources` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/creatives/media/uploads` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/creatives/media/{mediaId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/creatives/media/{mediaId}/complete` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/entitlements` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/estimates/audience` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/invites` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/invites` | ads (required) | 401 | 400 | – | pass |
| go:ads | DELETE | `/api/v1/ads/accounts/{accountId}/invites/{inviteId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/members` | ads (required) | 401 | 404 | – | pass |
| go:ads | DELETE | `/api/v1/ads/accounts/{accountId}/members/{userId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | PATCH | `/api/v1/ads/accounts/{accountId}/members/{userId}` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/reports` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/reports/export` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/reports/export.pdf` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/accounts/{accountId}/reports/scheduled` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/accounts/{accountId}/reports/scheduled` | ads (required) | 401 | 400 | – | pass |
| go:ads | DELETE | `/api/v1/ads/accounts/{accountId}/reports/scheduled/{scheduledReportId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/boosts` | ads (required) | 401 | 400 | – | pass |
| go:ads | POST | `/api/v1/ads/boosts/estimate` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/boosts/options` | ads (required) | 401 | 200 | – | pass |
| go:ads | GET | `/api/v1/ads/boosts/{boostId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/business-profiles` | ads (required) | 401 | 200 | – | pass |
| go:ads | POST | `/api/v1/ads/decide` | ads (required) | 401 | 400 | – | pass |
| go:ads | POST | `/api/v1/ads/events` | ads (required) | 401 | 400 | – | pass |
| go:ads | GET | `/api/v1/ads/invites/{inviteId}` | ads (required) | 401 | 404 | – | pass |
| go:ads | POST | `/api/v1/ads/invites/{inviteId}/accept` | ads (required) | 401 | 404 | – | pass |
| go:ads | GET | `/api/v1/ads/memberships` | ads (required) | 401 | 200 | – | pass |
| go:ads | POST | `/internal/v1/ads/accounts/{accountId}/funds` | nonApi | – | – | – | n/a |
| go:ads | POST | `/internal/v1/ads/audiences/membership` | nonApi | – | – | – | n/a |
| go:ads | POST | `/internal/v1/ads/boosts/{boostId}/payment-confirmed` | nonApi | – | – | – | n/a |
| go:ads | PUT | `/internal/v1/ads/content-signals` | nonApi | – | – | – | n/a |
| go:ads | POST | `/internal/v1/ads/conversions` | nonApi | – | – | – | n/a |
| go:ads | POST | `/internal/v1/ads/decide` | nonApi | – | – | – | n/a |
| go:ads | POST | `/internal/v1/ads/media/{mediaId}/processed` | nonApi | – | – | – | n/a |
| go:ads | POST | `/internal/v1/ads/premium-pool/allocate` | nonApi | – | – | – | n/a |
| go:auth | GET | `/.well-known/jwks.json` | nonApi | – | – | – | n/a |
| go:auth | POST | `/api/v1/auth/apple` | identity (optional) | 400 | 400 | – | pass |
| go:auth | POST | `/api/v1/auth/google` | identity (optional) | 400 | 400 | – | pass |
| go:auth | POST | `/api/v1/auth/login` | identity (optional) | 400 | 400 | – | pass |
| go:auth | POST | `/api/v1/auth/logout` | identity (required) | 401 | skip | – | pass |
| go:auth | POST | `/api/v1/auth/otp/send` | identity (optional) | 400 | 400 | – | pass |
| go:auth | POST | `/api/v1/auth/otp/verify` | identity (optional) | 400 | 400 | – | pass |
| go:auth | POST | `/api/v1/auth/password/change` | identity (required) | 401 | skip | – | pass |
| go:auth | POST | `/api/v1/auth/password/reset` | identity (optional) | 400 | 400 | – | pass |
| go:auth | POST | `/api/v1/auth/refresh` | identity (optional) | 400 | 400 | – | pass |
| go:auth | POST | `/api/v1/auth/register` | identity (optional) | 400 | 400 | – | pass |
| go:auth | DELETE | `/api/v1/auth/sessions` | identity (required) | 401 | skip | – | pass |
| go:auth | GET | `/api/v1/auth/sessions` | identity (required) | 401 | 200 | – | pass |
| go:auth | DELETE | `/api/v1/auth/sessions/{sessionId}` | identity (required) | 401 | 404 | – | pass |
| go:auth | GET | `/api/v1/auth/username-available` | identity (optional) | 200 | 200 | – | pass |
| go:catalog | POST | `/api/v1/analytics/product-interactions` | commerce (optional) | 400 | 400 | – | pass |
| go:catalog | GET | `/api/v1/brands` | commerce (optional) | 200 | 200 | – | pass |
| go:catalog | GET | `/api/v1/categories` | commerce (optional) | 200 | 200 | – | pass |
| go:catalog | GET | `/api/v1/internal/audience-sources/stores/{storeId}/visitors` | internal | – | – | – | hidden (404) |
| go:catalog | GET | `/api/v1/internal/moderation/targets/{type}/{id}` | internal | – | – | – | hidden (404) |
| go:catalog | GET | `/api/v1/internal/search-sources/{collection}/{id}` | internal | – | – | – | hidden (404) |
| go:catalog | GET | `/api/v1/internal/share-cards/{kind}/{id}` | internal | – | – | – | hidden (404) |
| go:catalog | GET | `/api/v1/mart/home` | commerce (optional) | 200 | 200 | – | pass |
| go:catalog | GET | `/api/v1/products` | commerce (optional) | 200 | 200 | – | pass |
| go:catalog | GET | `/api/v1/products/featured` | commerce (optional) | 200 | 200 | – | pass |
| go:catalog | GET | `/api/v1/products/{productId}` | commerce (optional) | 404 | 404 | – | pass |
| go:catalog | DELETE | `/api/v1/products/{productId}/bookmark` | commerce (required) | 401 | 404 | – | pass |
| go:catalog | POST | `/api/v1/products/{productId}/bookmark` | commerce (required) | 401 | 404 | – | pass |
| go:catalog | DELETE | `/api/v1/products/{productId}/like` | commerce (required) | 401 | 404 | – | pass |
| go:catalog | POST | `/api/v1/products/{productId}/like` | commerce (required) | 401 | 404 | – | pass |
| go:catalog | GET | `/api/v1/products/{productId}/rating-summary` | commerce (optional) | 200 | 200 | – | pass |
| go:catalog | GET | `/api/v1/products/{productId}/reviews` | commerce (optional) | 200 | 200 | – | pass |
| go:catalog | POST | `/api/v1/products/{productId}/reviews` | commerce (required) | 401 | 400 | – | pass |
| go:catalog | GET | `/api/v1/seller/access` | commerce (required) | 401 | 200 | – | pass |
| go:catalog | GET | `/api/v1/seller/categories` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | POST | `/api/v1/seller/categories` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | DELETE | `/api/v1/seller/categories/{categoryId}` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | PATCH | `/api/v1/seller/categories/{categoryId}` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | GET | `/api/v1/seller/marketing/featured-products` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | PUT | `/api/v1/seller/marketing/featured-products` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | GET | `/api/v1/seller/products` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | POST | `/api/v1/seller/products` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | POST | `/api/v1/seller/products/barcodes` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | POST | `/api/v1/seller/products/bulk` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | GET | `/api/v1/seller/products/export` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | GET | `/api/v1/seller/products/usage` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | DELETE | `/api/v1/seller/products/{productId}` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | GET | `/api/v1/seller/products/{productId}` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | PATCH | `/api/v1/seller/products/{productId}` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | POST | `/api/v1/seller/products/{productId}/duplicate` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | POST | `/api/v1/seller/products/{productId}/publish` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | POST | `/api/v1/seller/products/{productId}/unpublish` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | GET | `/api/v1/seller/reviews` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | GET | `/api/v1/seller/reviews/summary` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | DELETE | `/api/v1/seller/reviews/{reviewId}/reply` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | PUT | `/api/v1/seller/reviews/{reviewId}/reply` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | POST | `/api/v1/seller/reviews/{reviewId}/report` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | PATCH | `/api/v1/seller/store` | commerce (required) | 401 | 403 | – | pass |
| go:catalog | GET | `/api/v1/seller/stores/mine` | commerce (required) | 401 | 200 | – | pass |
| go:catalog | POST | `/api/v1/stores` | commerce (required) | 401 | 400 | – | pass |
| go:catalog | GET | `/api/v1/stores/{storeId}` | commerce (optional) | 404 | 404 | – | pass |
| go:catalog | GET | `/api/v1/stores/{storeId}/products` | commerce (optional) | 200 | 200 | – | pass |
| go:catalog | GET | `/api/v1/stores/{storeId}/reviews` | commerce (optional) | 200 | 200 | – | pass |
| go:catalog | POST | `/api/v1/stores/{storeId}/reviews` | commerce (required) | 401 | 400 | – | pass |
| go:creators | GET | `/api/v1/admin/creator-tiers` | money (optional) | 401 | 401 | 200 | pass |
| go:creators | PUT | `/api/v1/admin/creator-tiers/{tierId}` | money (optional) | 401 | 401 | – | pass |
| go:creators | PUT | `/api/v1/admin/creators/{userId}/program` | money (optional) | 401 | 401 | – | pass |
| go:currency | GET | `/api/v1/admin/exchange-rates` | identity (optional) | 401 | 401 | 200 | pass |
| go:currency | PUT | `/api/v1/admin/exchange-rates/{currency}` | identity (optional) | 401 | 401 | – | pass |
| go:currency | GET | `/api/v1/currencies` | identity (optional) | 200 | 200 | – | pass |
| go:currency | GET | `/api/v1/currency/convert` | identity (optional) | 400 | 400 | – | pass |
| go:currency | GET | `/api/v1/locale` | identity (optional) | 200 | 200 | – | pass |
| go:currency | GET | `/api/v1/locale/countries` | identity (optional) | 200 | 200 | – | pass |
| go:escrow | GET | `/api/v1/admin/disputes` | money (optional) | 401 | 401 | 200 | pass |
| go:escrow | GET | `/api/v1/admin/disputes/{disputeId}` | money (optional) | 401 | 401 | 404 | pass |
| go:escrow | POST | `/api/v1/admin/disputes/{disputeId}/messages` | money (optional) | 401 | 401 | – | pass |
| go:escrow | POST | `/api/v1/admin/disputes/{disputeId}/resolve` | money (optional) | 401 | 401 | – | pass |
| go:escrow | GET | `/api/v1/admin/orders/{orderId}/escrow` | money (optional) | 401 | 401 | 404 | pass |
| go:escrow | POST | `/api/v1/admin/orders/{orderId}/escrow/refund` | money (optional) | 401 | 401 | – | pass |
| go:escrow | GET | `/api/v1/disputes` | money (required) | 401 | 200 | – | pass |
| go:escrow | GET | `/api/v1/disputes/{disputeId}` | money (required) | 401 | 404 | – | pass |
| go:escrow | POST | `/api/v1/disputes/{disputeId}/close` | money (required) | 401 | 404 | – | pass |
| go:escrow | POST | `/api/v1/disputes/{disputeId}/messages` | money (required) | 401 | 400 | – | pass |
| go:escrow | POST | `/api/v1/internal/order-groups/{orderGroupId}/refunds` | internal | – | – | – | hidden (404) |
| go:escrow | GET | `/api/v1/internal/stores/{storeId}/disputes` | internal | – | – | – | hidden (404) |
| go:escrow | GET | `/api/v1/internal/stores/{storeId}/disputes/{disputeId}` | internal | – | – | – | hidden (404) |
| go:escrow | POST | `/api/v1/internal/stores/{storeId}/disputes/{disputeId}/responses` | internal | – | – | – | hidden (404) |
| go:escrow | POST | `/api/v1/orders/{orderId}/disputes` | money (required) | 401 | 400 | – | pass |
| go:escrow | GET | `/api/v1/orders/{orderId}/escrow` | money (required) | 401 | 404 | – | pass |
| go:escrow | GET | `/api/v1/wallets/me/escrow-holds` | money (required) | 401 | 200 | – | pass |
| go:inventory | GET | `/api/v1/seller/inventory/adjustments` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | POST | `/api/v1/seller/inventory/adjustments` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | GET | `/api/v1/seller/inventory/levels` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | GET | `/api/v1/seller/inventory/locations` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | GET | `/api/v1/seller/inventory/movements` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | GET | `/api/v1/seller/inventory/reorder` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | PATCH | `/api/v1/seller/inventory/reorder-levels` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | GET | `/api/v1/seller/inventory/summary` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | GET | `/api/v1/seller/inventory/transfers` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | POST | `/api/v1/seller/inventory/transfers` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | POST | `/api/v1/seller/inventory/transfers/{transferId}/cancel` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | POST | `/api/v1/seller/inventory/transfers/{transferId}/receive` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | GET | `/api/v1/seller/locations` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | POST | `/api/v1/seller/locations` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | PATCH | `/api/v1/seller/locations/{locationId}` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | GET | `/api/v1/seller/suppliers` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | POST | `/api/v1/seller/suppliers` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | DELETE | `/api/v1/seller/suppliers/{supplierId}` | commerce (required) | 401 | 403 | – | pass |
| go:inventory | PATCH | `/api/v1/seller/suppliers/{supplierId}` | commerce (required) | 401 | 403 | – | pass |
| go:ledger | GET | `/api/v1/admin/ledger/integrity` | money (optional) | 401 | 401 | 200 | pass |
| go:ledger | POST | `/api/v1/admin/ledger/journal-entries/{entryId}/reversal` | money (optional) | 401 | 401 | – | pass |
| go:ledger | GET | `/api/v1/admin/ledger/statement` | money (optional) | 401 | 401 | 400 | pass |
| go:live | GET | `/api/v1/admin/gifts` | live (optional) | 401 | 403 | 200 | pass |
| go:live | POST | `/api/v1/admin/gifts` | live (optional) | 401 | 403 | – | pass |
| go:live | DELETE | `/api/v1/admin/gifts/{giftId}` | live (optional) | 401 | 403 | – | pass |
| go:live | PATCH | `/api/v1/admin/gifts/{giftId}` | live (optional) | 401 | 403 | – | pass |
| go:live | POST | `/api/v1/battles/{battleId}/{action}` | live (required) | 401 | 404 | – | pass |
| go:live | GET | `/api/v1/creators/me/analytics/gifts/streams/{liveId}` | live (required) | 401 | 404 | – | pass |
| go:live | GET | `/api/v1/gifts` | live (required) | 401 | 200 | – | pass |
| go:live | GET | `/api/v1/internal/live/topic-access` | internal | – | – | – | hidden (404) |
| go:live | GET | `/api/v1/internal/live/{liveId}/ad-eligibility` | internal | – | – | – | hidden (404) |
| go:live | POST | `/api/v1/internal/live/{liveId}/presence` | internal | – | – | – | hidden (404) |
| go:live | GET | `/api/v1/internal/moderation/targets/{type}/{id}` | internal | – | – | – | hidden (404) |
| go:live | GET | `/api/v1/internal/share-cards/live/{id}` | internal | – | – | – | hidden (404) |
| go:live | POST | `/api/v1/live/gifts` | live (required) | 401 | 400 | – | pass |
| go:live | POST | `/api/v1/live/webhooks/livekit` | live (optional) | 401 | 401 | – | pass |
| go:live | GET | `/api/v1/lives` | live (optional) | 401 | 200 | – | pass |
| go:live | POST | `/api/v1/lives` | live (required) | 401 | 400 | – | pass |
| go:live | GET | `/api/v1/lives/suggested` | live (required) | 401 | 200 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}` | live (optional) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/battles` | live (required) | 401 | 400 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/comments` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/comments` | live (required) | 401 | 400 | – | pass |
| go:live | DELETE | `/api/v1/lives/{liveId}/comments/{commentId}` | live (required) | 401 | 404 | – | pass |
| go:live | PUT | `/api/v1/lives/{liveId}/comments/{commentId}/pin` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/end` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/engagement` | live (required) | 401 | 400 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/gift-goals` | live (required) | 401 | 200 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/gift-goals` | live (required) | 401 | 400 | – | pass |
| go:live | DELETE | `/api/v1/lives/{liveId}/gift-goals/{goalId}` | live (required) | 401 | 404 | – | pass |
| go:live | PATCH | `/api/v1/lives/{liveId}/gift-goals/{goalId}` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/gifts` | live (required) | 401 | 400 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/guests/invitations` | live (required) | 401 | 400 | – | pass |
| go:live | DELETE | `/api/v1/lives/{liveId}/guests/invitations/{slotId}` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/guests/invitations/{slotId}/{response}` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/guests/me/connection` | live (required) | 401 | 400 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/guests/me/leave` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/guests/requests` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/guests/requests/{requestId}/{decision}` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/guests/{userId}/mute` | live (required) | 401 | 400 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/guests/{userId}/remove` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/join` | live (required) | 401 | 404 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/leaderboard` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/leave` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/media-token` | live (required) | 401 | 404 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/moderators` | live (required) | 401 | 404 | – | pass |
| go:live | DELETE | `/api/v1/lives/{liveId}/moderators/{userId}` | live (required) | 401 | 404 | – | pass |
| go:live | PUT | `/api/v1/lives/{liveId}/moderators/{userId}` | live (required) | 401 | 404 | – | pass |
| go:live | PUT | `/api/v1/lives/{liveId}/monetization` | live (required) | 401 | 400 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/overlay-scenes` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/overlay-scenes` | live (required) | 401 | 404 | – | pass |
| go:live | DELETE | `/api/v1/lives/{liveId}/overlay-scenes/{sceneId}` | live (required) | 401 | 404 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/overlay-scenes/{sceneId}` | live (required) | 401 | 404 | – | pass |
| go:live | PUT | `/api/v1/lives/{liveId}/overlay-scenes/{sceneId}` | live (required) | 401 | 404 | – | pass |
| go:live | DELETE | `/api/v1/lives/{liveId}/overlay-scenes/{sceneId}/publish` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/overlay-scenes/{sceneId}/publish` | live (required) | 401 | 404 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/overlays` | live (required) | 401 | 404 | – | pass |
| go:live | PUT | `/api/v1/lives/{liveId}/overlays` | live (required) | 401 | 404 | – | pass |
| go:live | DELETE | `/api/v1/lives/{liveId}/pinned-comment` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/pins` | live (required) | 401 | 400 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/points/me` | live (required) | 401 | 200 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/products` | live (required) | 401 | 200 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/reactions` | live (required) | 401 | 204 | – | pass |
| go:live | PUT | `/api/v1/lives/{liveId}/recording` | live (required) | 401 | 400 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/recordings` | live (required) | 401 | 404 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/room-settings` | live (required) | 401 | 404 | – | pass |
| go:live | PUT | `/api/v1/lives/{liveId}/room-settings` | live (required) | 401 | 400 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/share` | live (required) | 401 | 404 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/stage` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/start` | live (required) | 401 | 404 | – | pass |
| go:live | DELETE | `/api/v1/lives/{liveId}/stream-key` | live (required) | 401 | 404 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/stream-key` | live (required) | 401 | 404 | – | pass |
| go:live | POST | `/api/v1/lives/{liveId}/stream-key` | live (required) | 401 | 404 | – | pass |
| go:live | GET | `/api/v1/lives/{liveId}/viewers` | live (required) | 401 | 404 | – | pass |
| go:live | DELETE | `/api/v1/lives/{liveId}/viewers/{userId}/ban` | live (required) | 401 | 404 | – | pass |
| go:live | PUT | `/api/v1/lives/{liveId}/viewers/{userId}/ban` | live (required) | 401 | 404 | – | pass |
| go:live | DELETE | `/api/v1/lives/{liveId}/viewers/{userId}/mute` | live (required) | 401 | 404 | – | pass |
| go:live | PUT | `/api/v1/lives/{liveId}/viewers/{userId}/mute` | live (required) | 401 | 404 | – | pass |
| go:live | GET | `/api/v1/overlay-scenes/{sceneId}` | live (optional) | 404 | 404 | – | pass |
| go:live | GET | `/api/v1/rankings` | live (required) | 401 | 400 | – | pass |
| go:moderation | GET | `/api/v1/admin/chat-reports` | trust (optional) | 401 | 401 | 200 | pass |
| go:moderation | GET | `/api/v1/admin/chat-reports/retention` | trust (optional) | 401 | 401 | 200 | pass |
| go:moderation | PUT | `/api/v1/admin/chat-reports/retention` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | GET | `/api/v1/admin/chat-reports/{reportId}` | trust (optional) | 401 | 401 | 404 | pass |
| go:moderation | POST | `/api/v1/admin/chat-reports/{reportId}/actions` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | GET | `/api/v1/admin/copyright-claims` | trust (optional) | 401 | 401 | 200 | pass |
| go:moderation | GET | `/api/v1/admin/copyright-claims/{claimId}` | trust (optional) | 401 | 401 | 404 | pass |
| go:moderation | POST | `/api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/accept` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | POST | `/api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/court-action` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | POST | `/api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/reject` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | POST | `/api/v1/admin/copyright-claims/{claimId}/reject` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | POST | `/api/v1/admin/copyright-claims/{claimId}/request-info` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | POST | `/api/v1/admin/copyright-claims/{claimId}/uphold` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | GET | `/api/v1/admin/ip-claims` | trust (optional) | 401 | 401 | 200 | pass |
| go:moderation | GET | `/api/v1/admin/ip-claims/{claimId}` | trust (optional) | 401 | 401 | 404 | pass |
| go:moderation | POST | `/api/v1/admin/ip-claims/{claimId}/reject` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | POST | `/api/v1/admin/ip-claims/{claimId}/request-info` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | POST | `/api/v1/admin/ip-claims/{claimId}/uphold` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | GET | `/api/v1/admin/reports` | trust (optional) | 401 | 401 | 200 | pass |
| go:moderation | GET | `/api/v1/admin/reports/{reportId}` | trust (optional) | 401 | 401 | 404 | pass |
| go:moderation | POST | `/api/v1/admin/reports/{reportId}/actions` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | POST | `/api/v1/admin/reports/{reportId}/suspend-author` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | GET | `/api/v1/admin/suspensions/cases` | trust (optional) | 401 | 401 | 200 | pass |
| go:moderation | GET | `/api/v1/admin/suspensions/cases/{caseId}` | trust (optional) | 401 | 401 | 404 | pass |
| go:moderation | POST | `/api/v1/admin/suspensions/cases/{caseId}/approve` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | POST | `/api/v1/admin/suspensions/cases/{caseId}/dismiss` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | POST | `/api/v1/admin/suspensions/cases/{caseId}/escalate` | trust (optional) | 401 | 401 | – | pass |
| go:moderation | POST | `/api/v1/copyright/claims` | trust (required) | 401 | 422 | – | pass |
| go:moderation | POST | `/api/v1/copyright/claims/{claimId}/counter-notices` | trust (required) | 401 | 422 | – | pass |
| go:moderation | GET | `/api/v1/internal/accounts/{accountId}/strikes` | internal | – | – | – | hidden (404) |
| go:moderation | POST | `/api/v1/internal/accounts/{accountId}/strikes` | internal | – | – | – | hidden (404) |
| go:moderation | PUT | `/api/v1/internal/copyright-claims/{claimId}/audio-matches` | internal | – | – | – | hidden (404) |
| go:moderation | POST | `/api/v1/internal/ip-claims` | internal | – | – | – | hidden (404) |
| go:moderation | POST | `/api/v1/internal/strikes/counts` | internal | – | – | – | hidden (404) |
| go:moderation | POST | `/api/v1/internal/strikes/{strikeId}/revoke` | internal | – | – | – | hidden (404) |
| go:moderation | POST | `/api/v1/internal/suspension-cases` | internal | – | – | – | hidden (404) |
| go:moderation | POST | `/api/v1/ip-claims/{claimId}/response` | trust (required) | 401 | 400 | – | pass |
| go:moderation | POST | `/api/v1/reports` | social (required) | 401 | 400 | – | pass |
| go:moderation | GET | `/api/v1/reports/me` | trust (required) | 401 | 200 | – | pass |
| go:orders | DELETE | `/api/v1/cart` | commerce (required) | 401 | 200 | – | pass |
| go:orders | GET | `/api/v1/cart` | commerce (required) | 401 | 200 | – | pass |
| go:orders | POST | `/api/v1/cart/items` | commerce (required) | 401 | 400 | – | pass |
| go:orders | DELETE | `/api/v1/cart/items/{itemId}` | commerce (required) | 401 | 404 | – | pass |
| go:orders | PATCH | `/api/v1/cart/items/{itemId}` | commerce (required) | 401 | 400 | – | pass |
| go:orders | POST | `/api/v1/cart/shipping-quote` | commerce (required) | 401 | 400 | – | pass |
| go:orders | GET | `/api/v1/internal/audience-sources/stores/{storeId}/purchasers` | internal | – | – | – | hidden (404) |
| go:orders | GET | `/api/v1/orders` | commerce (required) | 401 | 200 | – | pass |
| go:orders | POST | `/api/v1/orders/checkout` | commerce (required) | 401 | 400 | – | pass |
| go:orders | GET | `/api/v1/orders/{orderId}` | commerce (required) | 401 | 404 | – | pass |
| go:orders | POST | `/api/v1/orders/{orderId}/cancel` | commerce (required) | 401 | 400 | – | pass |
| go:orders | POST | `/api/v1/orders/{orderId}/confirm-receipt` | commerce (required) | 401 | 404 | – | pass |
| go:orders | POST | `/api/v1/orders/{orderId}/returns` | commerce (required) | 401 | 400 | – | pass |
| go:orders | GET | `/api/v1/returns` | commerce (required) | 401 | 200 | – | pass |
| go:orders | GET | `/api/v1/seller/customers` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/customers/export` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/customers/summary` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/customers/{customerId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/customers/{customerId}/notes` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/customers/{customerId}/purchases` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/delivery/shipments` | commerce (required) | 401 | 403 | – | pass |
| go:orders | PATCH | `/api/v1/seller/delivery/shipments/{orderId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/delivery/shipments/{orderId}/attempts` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/delivery/summary` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/disputes` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/disputes/{disputeId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/disputes/{disputeId}/responses` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/marketing/bundles` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/marketing/bundles` | commerce (required) | 401 | 403 | – | pass |
| go:orders | DELETE | `/api/v1/seller/marketing/bundles/{bundleId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | PATCH | `/api/v1/seller/marketing/bundles/{bundleId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/marketing/flash-sales` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/marketing/flash-sales` | commerce (required) | 401 | 403 | – | pass |
| go:orders | DELETE | `/api/v1/seller/marketing/flash-sales/{flashSaleId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | PATCH | `/api/v1/seller/marketing/flash-sales/{flashSaleId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/marketing/rewards/settings` | commerce (required) | 401 | 403 | – | pass |
| go:orders | PUT | `/api/v1/seller/marketing/rewards/settings` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/marketing/rewards/summary` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/orders` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/orders/{orderId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/orders/{orderId}/accept` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/orders/{orderId}/cancel` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/orders/{orderId}/fulfilment` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/orders/{orderId}/notes` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/orders/{orderId}/reject` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/orders/{orderId}/shipping-snapshot` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/orders/{orderId}/status` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/promotions` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/promotions` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/promotions/validate-code` | commerce (required) | 401 | 403 | – | pass |
| go:orders | DELETE | `/api/v1/seller/promotions/{promotionId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/promotions/{promotionId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | PATCH | `/api/v1/seller/promotions/{promotionId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/reports/exports` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/reports/exports` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/reports/exports/{exportId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/reports/{reportKind}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/returns` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/returns/{returnId}/approve` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/returns/{returnId}/decline` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/returns/{returnId}/receive` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/shipping/preview` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/shipping/profile` | commerce (required) | 401 | 403 | – | pass |
| go:orders | PATCH | `/api/v1/seller/shipping/profile` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/seller/shipping/profiles` | commerce (required) | 401 | 403 | – | pass |
| go:orders | POST | `/api/v1/seller/shipping/rules` | commerce (required) | 401 | 403 | – | pass |
| go:orders | DELETE | `/api/v1/seller/shipping/rules/{ruleId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | PATCH | `/api/v1/seller/shipping/rules/{ruleId}` | commerce (required) | 401 | 403 | – | pass |
| go:orders | GET | `/api/v1/store-rewards/me` | commerce (required) | 401 | 200 | – | pass |
| go:payments | POST | `/api/v1/admin/payments/disputes/{providerDisputeId}/evidence` | money (optional) | 401 | 401 | – | pass |
| go:payments | POST | `/api/v1/admin/payments/payout-accounts/jobs/{jobId}/retry` | money (optional) | 401 | 401 | – | pass |
| go:payments | GET | `/api/v1/admin/payments/payout-accounts/stuck` | money (optional) | 401 | 401 | 200 | pass |
| go:payments | POST | `/api/v1/admin/payments/payout-accounts/{userId}/verification-prompt` | money (optional) | 401 | 401 | – | pass |
| go:payments | POST | `/api/v1/admin/payments/reconciliations` | money (optional) | 401 | 401 | – | pass |
| go:payments | GET | `/api/v1/banks` | money (required) | 401 | 200 | – | pass |
| go:payments | POST | `/api/v1/banks/resolve-account` | money (required) | 401 | 400 | – | pass |
| go:payments | GET | `/api/v1/payments/channels` | money (required) | 401 | 200 | – | pass |
| go:payments | GET | `/api/v1/payments/connected-accounts/me` | money (required) | 401 | 409 | – | pass |
| go:payments | POST | `/api/v1/payments/connected-accounts/me` | money (required) | 401 | 202 | – | pass |
| go:payments | POST | `/api/v1/payments/connected-accounts/me/onboarding-link` | money (required) | 401 | 409 | – | pass |
| go:payments | POST | `/api/v1/payments/initialize` | money (required) | 401 | 400 | – | pass |
| go:payments | POST | `/api/v1/payments/orders/{orderId}/verify` | money (required) | 401 | 404 | – | pass |
| go:payments | GET | `/api/v1/payments/payout-fees` | money (required) | 401 | 200 | – | pass |
| go:payments | GET | `/api/v1/payments/payout-onboarding/me` | money (required) | 401 | 200 | – | pass |
| go:payments | PUT | `/api/v1/payments/payout-onboarding/me/bank` | money (required) | 401 | 400 | – | pass |
| go:payments | PUT | `/api/v1/payments/payout-onboarding/me/business` | money (required) | 401 | 400 | – | pass |
| go:payments | POST | `/api/v1/payments/payout-onboarding/me/document-link` | money (required) | 401 | 409 | – | pass |
| go:payments | PUT | `/api/v1/payments/payout-onboarding/me/identity` | money (required) | 401 | 400 | – | pass |
| go:payments | POST | `/api/v1/payments/payout-onboarding/me/resolve` | money (required) | 401 | 400 | – | pass |
| go:payments | POST | `/api/v1/payments/payout-onboarding/me/retry` | money (required) | 401 | 200 | – | pass |
| go:payments | POST | `/api/v1/payments/refunds/{refundId}/bank-destination` | money (required) | 401 | 400 | – | pass |
| go:payments | POST | `/api/v1/payments/saved-cards/charges` | money (required) | 401 | 400 | – | pass |
| go:payments | POST | `/api/v1/payments/saved-cards/setups` | money (required) | 401 | 201 | – | pass |
| go:payments | POST | `/api/v1/payments/saved-cards/setups/{reference}/complete` | money (required) | 401 | 404 | – | pass |
| go:payments | POST | `/api/v1/payments/store-notifications/{store}` | money (required) | 401 | 422 | – | pass |
| go:payments | POST | `/api/v1/payments/subscriptions/checkout` | money (required) | 401 | 400 | – | pass |
| go:payments | POST | `/api/v1/payments/webhooks/{provider}` | money (required) | 401 | 404 | – | pass |
| go:payments | POST | `/internal/v1/payments/domain-events` | nonApi | – | – | – | n/a |
| go:payments | POST | `/webhooks/store-notifications/{store}` | money (optional) | 422 | 422 | – | pass |
| go:payments | POST | `/webhooks/{provider}` | money (optional) | 404 | 404 | – | pass |
| go:subscriptions | GET | `/api/v1/admin/subscriptions/price-table` | money (optional) | 401 | 401 | 200 | pass |
| go:subscriptions | PUT | `/api/v1/admin/subscriptions/price-table/{planCode}/{countryCode}` | money (optional) | 401 | 401 | – | pass |
| go:subscriptions | GET | `/api/v1/internal/entitlements/{userId}` | internal | – | – | – | hidden (404) |
| go:subscriptions | POST | `/api/v1/seller/subscription/checkout` | money (required) | 401 | 400 | – | pass |
| go:subscriptions | GET | `/api/v1/seller/subscription/plans` | money (required) | 401 | 200 | – | pass |
| go:subscriptions | GET | `/api/v1/seller/subscription/trial` | money (required) | 401 | 404 | – | pass |
| go:subscriptions | POST | `/api/v1/seller/subscription/trial/checkout` | money (required) | 401 | 400 | – | pass |
| go:subscriptions | POST | `/api/v1/subscriptions/checkout` | money (required) | 401 | 400 | – | pass |
| go:subscriptions | GET | `/api/v1/subscriptions/me` | money (required) | 401 | 200 | – | pass |
| go:subscriptions | GET | `/api/v1/subscriptions/offer` | money (required) | 401 | 404 | – | pass |
| go:subscriptions | GET | `/api/v1/subscriptions/plans` | money (required) | 401 | 200 | – | pass |
| go:subscriptions | POST | `/api/v1/subscriptions/store-receipts` | money (required) | 401 | 400 | – | pass |
| go:subscriptions | POST | `/api/v1/subscriptions/{subscriptionId}/cancel` | money (required) | 401 | 404 | – | pass |
| go:users | POST | `/api/v1/admin/accounts` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/accounts/created` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | GET | `/api/v1/admin/applications/creators` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | GET | `/api/v1/admin/applications/creators/{applicationId}` | identity (optional) | 401 | 401 | 404 | pass |
| go:users | POST | `/api/v1/admin/applications/creators/{applicationId}/approve` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/applications/creators/{applicationId}/reject` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/black-applications` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | POST | `/api/v1/admin/black-applications/{blackId}/approve` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/black-applications/{blackId}/checklist` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/black-applications/{blackId}/reject` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/black-applications/{blackId}/reverification-reminder` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/black-applications/{blackId}/revoke` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/business-documents` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | GET | `/api/v1/admin/business-documents/{submissionId}/documents/{documentId}/access` | identity (optional) | 401 | 401 | 404 | pass |
| go:users | POST | `/api/v1/admin/business-documents/{submissionId}/documents/{documentId}/approve` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/business-documents/{submissionId}/documents/{documentId}/reject` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/checkmark-grants` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | POST | `/api/v1/admin/checkmark-grants` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/checkmark-grants/{grantId}/revoke` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/legal/documents` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | GET | `/api/v1/admin/legal/documents/{key}` | identity (optional) | 401 | 401 | 404 | pass |
| go:users | POST | `/api/v1/admin/legal/documents/{key}/rollback` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/legal/documents/{key}/versions` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/legal/notices` | notifications (optional) | 401 | 401 | 200 | pass |
| go:users | POST | `/api/v1/admin/legal/notices` | notifications (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/legal/notices/{noticeId}` | notifications (optional) | 401 | 401 | 404 | pass |
| go:users | GET | `/api/v1/admin/legal/versions/{versionId}` | identity (optional) | 401 | 401 | 404 | pass |
| go:users | PUT | `/api/v1/admin/legal/versions/{versionId}` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/legal/versions/{versionId}/acceptance` | identity (optional) | 401 | 401 | 404 | pass |
| go:users | GET | `/api/v1/admin/legal/versions/{versionId}/notice-draft` | notifications (optional) | 401 | 401 | 404 | pass |
| go:users | PUT | `/api/v1/admin/legal/versions/{versionId}/notice-draft` | notifications (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/legal/versions/{versionId}/notice-draft/test-send` | notifications (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/legal/versions/{versionId}/notice-preview` | notifications (optional) | 401 | 401 | 404 | pass |
| go:users | POST | `/api/v1/admin/legal/versions/{versionId}/publish` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/legal/versions/{versionId}/return` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/legal/versions/{versionId}/submit` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/policy-versions` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/retention-policies` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | PUT | `/api/v1/admin/retention-policies/{category}` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/suspensions/accounts` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | POST | `/api/v1/admin/suspensions/accounts/{caseId}/appeal/decide` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/suspensions/accounts/{caseId}/reinstate` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/usernames/held` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | GET | `/api/v1/admin/usernames/hold` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | GET | `/api/v1/admin/usernames/reserved` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | POST | `/api/v1/admin/usernames/reserved` | identity (optional) | 401 | 401 | – | pass |
| go:users | DELETE | `/api/v1/admin/usernames/reserved/{ruleId}` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/usernames/withheld` | identity (optional) | 401 | 401 | – | pass |
| go:users | DELETE | `/api/v1/admin/usernames/withheld/{username}` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/users` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | GET | `/api/v1/admin/users/{userId}` | identity (optional) | 401 | 401 | 404 | pass |
| go:users | POST | `/api/v1/admin/users/{userId}/ban` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/users/{userId}/delete` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/users/{userId}/reinstate` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/users/{userId}/restrict` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/users/{userId}/suspend` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/users/{userId}/unban` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/users/{userId}/username/assign-held` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/users/{userId}/username/reassign` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/admin/verifications` | identity (optional) | 401 | 401 | 200 | pass |
| go:users | GET | `/api/v1/admin/verifications/{verificationId}` | identity (optional) | 401 | 401 | 404 | pass |
| go:users | POST | `/api/v1/admin/verifications/{verificationId}/approve` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/verifications/{verificationId}/reinstate` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/verifications/{verificationId}/reject` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/verifications/{verificationId}/revoke` | identity (optional) | 401 | 401 | – | pass |
| go:users | POST | `/api/v1/admin/verifications/{verificationId}/suspend` | identity (optional) | 401 | 401 | – | pass |
| go:users | GET | `/api/v1/auth/username-suggestion` | identity (optional) | 200 | 200 | – | pass |
| go:users | GET | `/api/v1/business-categories` | identity (optional) | 200 | 200 | – | pass |
| go:users | GET | `/api/v1/consents` | identity (optional) | 400 | 400 | – | pass |
| go:users | PUT | `/api/v1/consents` | identity (optional) | 400 | 400 | – | pass |
| go:users | POST | `/api/v1/creators/applications` | identity (required) | 401 | 422 | – | pass |
| go:users | GET | `/api/v1/creators/applications/me` | identity (required) | 401 | 200 | – | pass |
| go:users | GET | `/api/v1/creators/eligibility` | identity (required) | 401 | 200 | – | pass |
| go:users | GET | `/api/v1/geo/admin-areas/{areaId}/cities` | identity (optional) | 200 | 200 | – | pass |
| go:users | GET | `/api/v1/geo/countries` | identity (optional) | 200 | 200 | – | pass |
| go:users | GET | `/api/v1/geo/countries/{countryId}/regions` | identity (optional) | 404 | 404 | – | pass |
| go:users | GET | `/api/v1/geo/regions/{regionId}/admin-areas` | identity (optional) | 200 | 200 | – | pass |
| go:users | GET | `/api/v1/geo/regions/{regionId}/cities` | identity (optional) | 200 | 200 | – | pass |
| go:users | GET | `/api/v1/internal/accounts/{accountId}/contact-privacy` | internal | – | – | – | hidden (404) |
| go:users | GET | `/api/v1/internal/accounts/{accountId}/policy-gate` | internal | – | – | – | hidden (404) |
| go:users | POST | `/api/v1/internal/checkmarks/{profileId}/billing-events` | internal | – | – | – | hidden (404) |
| go:users | POST | `/api/v1/internal/enforcement/actions` | internal | – | – | – | hidden (404) |
| go:users | PUT | `/api/v1/internal/legal/notices/{noticeId}/progress` | internal | – | – | – | hidden (404) |
| go:users | GET | `/api/v1/internal/notification-audience/segments` | internal | – | – | – | hidden (404) |
| go:users | GET | `/api/v1/internal/notification-audience/{segmentId}` | internal | – | – | – | hidden (404) |
| go:users | GET | `/api/v1/internal/notification-audience/{segmentId}/count` | internal | – | – | – | hidden (404) |
| go:users | PUT | `/api/v1/internal/profiles/{profileId}/signals` | internal | – | – | – | hidden (404) |
| go:users | GET | `/api/v1/internal/search-sources/users/{id}` | internal | – | – | – | hidden (404) |
| go:users | GET | `/api/v1/internal/users/by-username/{username}/notification-recipient` | internal | – | – | – | hidden (404) |
| go:users | POST | `/api/v1/internal/users/summaries` | internal | – | – | – | hidden (404) |
| go:users | POST | `/api/v1/internal/users/{accountId}/marketing-unsubscribe` | internal | – | – | – | hidden (404) |
| go:users | GET | `/api/v1/internal/users/{accountId}/notification-recipient` | internal | – | – | – | hidden (404) |
| go:users | GET | `/api/v1/internal/users/{accountId}/privacy-settings` | internal | – | – | – | hidden (404) |
| go:users | GET | `/api/v1/legal/policy-versions/current` | identity (optional) | 200 | 200 | – | pass |
| go:users | GET | `/api/v1/policies/current` | identity (optional) | 200 | 200 | – | pass |
| go:users | GET | `/api/v1/seller/business-documents` | identity (required) | 401 | 200 | – | pass |
| go:users | PUT | `/api/v1/seller/business-documents/{kind}` | identity (required) | 401 | 404 | – | pass |
| go:users | POST | `/api/v1/seller/business-documents/{kind}/upload-intents` | identity (required) | 401 | 404 | – | pass |
| go:users | GET | `/api/v1/users/by-username/{username}` | identity (optional) | 404 | 404 | – | pass |
| go:users | GET | `/api/v1/users/me` | identity (required) | 401 | 200 | – | pass |
| go:users | PATCH | `/api/v1/users/me` | identity (required) | 401 | 200 | – | pass |
| go:users | GET | `/api/v1/users/me/acting-profile` | identity (required) | 401 | 200 | – | pass |
| go:users | PUT | `/api/v1/users/me/acting-profile` | identity (required) | 401 | skip | – | pass |
| go:users | GET | `/api/v1/users/me/addresses` | identity (required) | 401 | 200 | – | pass |
| go:users | POST | `/api/v1/users/me/addresses` | identity (required) | 401 | 400 | – | pass |
| go:users | DELETE | `/api/v1/users/me/addresses/{addressId}` | identity (required) | 401 | 404 | – | pass |
| go:users | GET | `/api/v1/users/me/addresses/{addressId}` | identity (required) | 401 | 404 | – | pass |
| go:users | PATCH | `/api/v1/users/me/addresses/{addressId}` | identity (required) | 401 | 404 | – | pass |
| go:users | POST | `/api/v1/users/me/business-profiles` | identity (required) | 401 | 400 | – | pass |
| go:users | PATCH | `/api/v1/users/me/business-profiles/{profileId}` | identity (required) | 401 | 404 | – | pass |
| go:users | GET | `/api/v1/users/me/consents` | identity (required) | 401 | 200 | – | pass |
| go:users | PUT | `/api/v1/users/me/consents` | identity (required) | 401 | 400 | – | pass |
| go:users | POST | `/api/v1/users/me/consents/merge` | identity (required) | 401 | 400 | – | pass |
| go:users | POST | `/api/v1/users/me/creator-application` | identity (required) | 401 | 201 | – | pass |
| go:users | GET | `/api/v1/users/me/data-exports` | identity (required) | 401 | 200 | – | pass |
| go:users | POST | `/api/v1/users/me/data-exports` | identity (required) | 401 | 202 | – | pass |
| go:users | GET | `/api/v1/users/me/data-exports/{exportId}` | identity (required) | 401 | 404 | – | pass |
| go:users | POST | `/api/v1/users/me/deactivate` | identity (required) | 401 | skip | – | pass |
| go:users | GET | `/api/v1/users/me/deletion-request` | identity (required) | 401 | 404 | – | pass |
| go:users | POST | `/api/v1/users/me/deletion-request` | identity (required) | 401 | skip | – | pass |
| go:users | POST | `/api/v1/users/me/deletion-request/cancel` | identity (required) | 401 | 404 | – | pass |
| go:users | POST | `/api/v1/users/me/media/upload-intents` | identity (required) | 401 | 400 | – | pass |
| go:users | GET | `/api/v1/users/me/mention-privacy` | identity (required) | 401 | 200 | – | pass |
| go:users | PUT | `/api/v1/users/me/mention-privacy` | identity (required) | 401 | 200 | – | pass |
| go:users | GET | `/api/v1/users/me/message-privacy` | identity (required) | 401 | 200 | – | pass |
| go:users | PUT | `/api/v1/users/me/message-privacy` | identity (required) | 401 | 200 | – | pass |
| go:users | GET | `/api/v1/users/me/policy-acceptances` | identity (required) | 401 | 200 | – | pass |
| go:users | PATCH | `/api/v1/users/me/preferences` | identity (required) | 401 | 400 | – | pass |
| go:users | GET | `/api/v1/users/me/privacy-settings` | identity (required) | 401 | 200 | – | pass |
| go:users | PATCH | `/api/v1/users/me/privacy-settings` | identity (required) | 401 | 400 | – | pass |
| go:users | GET | `/api/v1/users/me/profiles` | identity (required) | 401 | 200 | – | pass |
| go:users | GET | `/api/v1/users/me/suspension` | identity (required) | 401 | 404 | – | pass |
| go:users | POST | `/api/v1/users/me/suspension/appeal` | identity (required) | 401 | 400 | – | pass |
| go:users | GET | `/api/v1/users/me/terms-acceptances` | identity (required) | 401 | 200 | – | pass |
| go:users | POST | `/api/v1/users/me/terms-acceptances` | identity (required) | 401 | 400 | – | pass |
| go:users | PATCH | `/api/v1/users/me/username` | identity (required) | 401 | skip | – | pass |
| go:users | GET | `/api/v1/users/me/username-policy` | identity (required) | 401 | 200 | – | pass |
| go:users | GET | `/api/v1/users/username/{username}` | identity (required) | 401 | 404 | – | pass |
| go:users | GET | `/api/v1/users/{userId}` | identity (required) | 401 | 404 | – | pass |
| go:users | POST | `/api/v1/verification/applications` | identity (required) | 401 | 400 | – | pass |
| go:users | POST | `/api/v1/verification/black-applications` | identity (required) | 401 | 400 | – | pass |
| go:users | GET | `/api/v1/verification/me` | identity (required) | 401 | 200 | – | pass |
| go:users | GET | `/api/v1/verification/suggestions` | identity (required) | 401 | 200 | – | pass |
| go:users | POST | `/api/v1/verification/suggestions/{color}/dismiss` | identity (required) | 401 | 404 | – | pass |
| go:wallet | GET | `/api/v1/admin/coins/price-table` | money (optional) | 401 | 401 | 200 | pass |
| go:wallet | PUT | `/api/v1/admin/coins/price-table/{packageId}` | money (optional) | 401 | 401 | – | pass |
| go:wallet | POST | `/api/v1/admin/payouts/run` | money (optional) | 401 | 401 | – | pass |
| go:wallet | GET | `/api/v1/admin/wallet/seller-reserves` | money (optional) | 401 | 401 | 200 | pass |
| go:wallet | DELETE | `/api/v1/admin/wallet/seller-reserves/{sellerUserId}` | money (optional) | 401 | 401 | – | pass |
| go:wallet | PUT | `/api/v1/admin/wallet/seller-reserves/{sellerUserId}` | money (optional) | 401 | 401 | – | pass |
| go:wallet | GET | `/api/v1/admin/withdrawals` | money (optional) | 401 | 401 | 200 | pass |
| go:wallet | POST | `/api/v1/admin/withdrawals/{withdrawalId}/review` | money (optional) | 401 | 401 | – | pass |
| go:wallet | GET | `/api/v1/ads/balance` | money (required) | 401 | 200 | – | pass |
| go:wallet | POST | `/api/v1/ads/balance/refund` | money (required) | 401 | 400 | – | pass |
| go:wallet | POST | `/api/v1/ads/balance/top-ups` | money (required) | 401 | 400 | – | pass |
| go:wallet | GET | `/api/v1/coins/balance` | money (required) | 401 | 200 | – | pass |
| go:wallet | POST | `/api/v1/coins/iap/receipts` | money (required) | 401 | 400 | – | pass |
| go:wallet | GET | `/api/v1/coins/packages` | money (optional) | 200 | 200 | – | pass |
| go:wallet | GET | `/api/v1/coins/packs` | money (optional) | 200 | 200 | – | pass |
| go:wallet | POST | `/api/v1/coins/purchases` | money (required) | 401 | 400 | – | pass |
| go:wallet | POST | `/api/v1/coins/purchases/{reference}/verify` | money (required) | 401 | 404 | – | pass |
| go:wallet | GET | `/api/v1/coins/transactions` | money (required) | 401 | 200 | – | pass |
| go:wallet | POST | `/api/v1/coins/transfers` | money (required) | 401 | 400 | – | pass |
| go:wallet | GET | `/api/v1/coins/transfers/quote` | money (required) | 401 | 400 | – | pass |
| go:wallet | POST | `/api/v1/creators/earnings/convert` | money (required) | 401 | 400 | – | pass |
| go:wallet | GET | `/api/v1/internal/accounts/{accountId}/deletion-blockers` | internal | – | – | – | hidden (404) |
| go:wallet | POST | `/api/v1/internal/ads/boost-debits` | internal | – | – | – | hidden (404) |
| go:wallet | POST | `/api/v1/internal/ads/boost-refunds` | internal | – | – | – | hidden (404) |
| go:wallet | POST | `/api/v1/internal/ads/spend-batches` | internal | – | – | – | hidden (404) |
| go:wallet | GET | `/api/v1/wallets/me` | money (required) | 401 | 200 | – | pass |
| go:wallet | GET | `/api/v1/wallets/me/payout-accounts` | money (required) | 401 | 200 | – | pass |
| go:wallet | POST | `/api/v1/wallets/me/payout-accounts` | money (required) | 401 | 400 | – | pass |
| go:wallet | DELETE | `/api/v1/wallets/me/payout-accounts/{payoutAccountId}` | money (required) | 401 | 404 | – | pass |
| go:wallet | GET | `/api/v1/wallets/me/transactions` | money (required) | 401 | 200 | – | pass |
| go:wallet | GET | `/api/v1/wallets/me/withdrawals` | money (required) | 401 | 200 | – | pass |
| go:wallet | POST | `/api/v1/wallets/me/withdrawals` | money (required) | 401 | 400 | – | pass |
| go:wallet | GET | `/api/v1/wallets/me/withdrawals/quote` | money (required) | 401 | 400 | – | pass |
| go:wallet | POST | `/api/v1/wallets/me/withdrawals/{withdrawalId}/cancel` | money (required) | 401 | 404 | – | pass |
| ts:media | GET | `/api/v1/media/:mediaId` | media (required) | 401 | 404 | – | pass |
| ts:media | POST | `/api/v1/media/:mediaId/complete` | media (required) | 401 | 404 | – | pass |
| ts:media | POST | `/api/v1/media/uploads` | media (required) | 401 | 400 | – | pass |
| ts:media | DELETE | `/api/v1/media/uploads/:uploadId` | media (required) | 401 | 404 | – | pass |
| ts:media | GET | `/api/v1/media/uploads/:uploadId` | media (required) | 401 | 404 | – | pass |
| ts:media | PUT | `/api/v1/media/uploads/:uploadId/chunks/:chunkIndex` | media (required) | 401 | 400 | – | pass |
| ts:media | GET | `/api/v1/media/uploads/:uploadId/chunks/:chunkIndex/url` | media (required) | 401 | 400 | – | pass |
| ts:media | POST | `/api/v1/media/uploads/:uploadId/chunks/urls` | media (required) | 401 | 400 | – | pass |
| ts:media | POST | `/api/v1/media/uploads/:uploadId/complete` | media (required) | 401 | 404 | – | pass |
| ts:media | GET | `/healthz` | nonApi | – | – | – | n/a |
| ts:media | GET | `/internal/v1/media/:mediaId` | nonApi | – | – | – | n/a |
| ts:media | POST | `/internal/v1/media/:mediaId/review` | nonApi | – | – | – | n/a |
| ts:media | POST | `/internal/v1/media/:mediaId/signed-url` | nonApi | – | – | – | n/a |
| ts:media | POST | `/internal/v1/media/delete` | nonApi | – | – | – | n/a |
| ts:media | POST | `/internal/v1/media/intents` | nonApi | – | – | – | n/a |
| ts:media | GET | `/readyz` | nonApi | – | – | – | n/a |
| ts:notifications | GET | `/api/v1/admin/legal/notices` | notifications (optional) | 401 | 401 | 200 | pass |
| ts:notifications | POST | `/api/v1/admin/legal/notices` | notifications (optional) | 401 | 401 | – | pass |
| ts:notifications | GET | `/api/v1/admin/legal/notices/:noticeId` | notifications (optional) | 401 | 401 | 404 | pass |
| ts:notifications | GET | `/api/v1/admin/legal/versions/:versionId/notice-draft` | notifications (optional) | 401 | 401 | 404 | pass |
| ts:notifications | PUT | `/api/v1/admin/legal/versions/:versionId/notice-draft` | notifications (optional) | 401 | 401 | – | pass |
| ts:notifications | POST | `/api/v1/admin/legal/versions/:versionId/notice-draft/test-send` | notifications (optional) | 401 | 401 | – | pass |
| ts:notifications | GET | `/api/v1/admin/legal/versions/:versionId/notice-preview` | notifications (optional) | 401 | 401 | 404 | pass |
| ts:notifications | POST | `/api/v1/admin/support/email/preview` | notifications (optional) | 401 | 401 | – | pass |
| ts:notifications | GET | `/api/v1/admin/support/email/segments` | notifications (optional) | 401 | 401 | 200 | pass |
| ts:notifications | POST | `/api/v1/admin/support/email/send` | notifications (optional) | 401 | 401 | – | pass |
| ts:notifications | GET | `/api/v1/admin/support/email/sends` | notifications (optional) | 401 | 401 | 200 | pass |
| ts:notifications | GET | `/api/v1/admin/support/email/templates` | notifications (optional) | 401 | 401 | 200 | pass |
| ts:notifications | GET | `/api/v1/email/unsubscribe` | notifications (optional) | 400 | 400 | – | pass |
| ts:notifications | POST | `/api/v1/email/unsubscribe` | notifications (optional) | 400 | 400 | – | pass |
| ts:notifications | GET | `/api/v1/notifications` | notifications (required) | 401 | 200 | – | pass |
| ts:notifications | POST | `/api/v1/notifications/:notificationId/read` | notifications (required) | 401 | 404 | – | pass |
| ts:notifications | DELETE | `/api/v1/notifications/device-tokens` | notifications (required) | 401 | 400 | – | pass |
| ts:notifications | POST | `/api/v1/notifications/device-tokens` | notifications (required) | 401 | 400 | – | pass |
| ts:notifications | GET | `/api/v1/notifications/preferences` | notifications (required) | 401 | 200 | – | pass |
| ts:notifications | PATCH | `/api/v1/notifications/preferences` | notifications (required) | 401 | 400 | – | pass |
| ts:notifications | POST | `/api/v1/notifications/read-all` | notifications (required) | 401 | 204 | – | pass |
| ts:notifications | GET | `/api/v1/notifications/unread-count` | notifications (required) | 401 | 200 | – | pass |
| ts:search | GET | `/api/v1/search` | search (optional) | 400 | 400 | – | pass |
| ts:search | DELETE | `/api/v1/search/recent` | search (required) | 401 | 204 | – | pass |
| ts:search | GET | `/api/v1/search/recent` | search (required) | 401 | 200 | – | pass |
| ts:search | POST | `/api/v1/search/recent` | search (required) | 401 | 400 | – | pass |
| ts:search | DELETE | `/api/v1/search/recent/:id` | search (required) | 401 | 204 | – | pass |
| ts:search | GET | `/api/v1/search/suggest` | search (optional) | 400 | 400 | – | pass |
| ts:search | GET | `/healthz` | nonApi | – | – | – | n/a |
| ts:search | GET | `/internal/search/event-types` | nonApi | – | – | – | n/a |
| ts:search | POST | `/internal/search/events` | nonApi | – | – | – | n/a |
| ts:search | GET | `/readyz` | nonApi | – | – | – | n/a |
| ts:social | GET | `/api/v1/chat/content` | social (required) | 401 | 400 | – | pass |
| ts:social | GET | `/api/v1/chat/settings` | social (required) | 401 | 200 | – | pass |
| ts:social | PATCH | `/api/v1/chat/settings` | social (required) | 401 | 200 | – | pass |
| ts:social | POST | `/api/v1/chat/shares` | social (required) | 401 | 400 | – | pass |
| ts:social | GET | `/api/v1/clips` | social (optional) | 200 | 200 | – | pass |
| ts:social | DELETE | `/api/v1/comments/:commentId` | social (optional) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/comments/:commentId` | social (optional) | 404 | 404 | – | pass |
| ts:social | DELETE | `/api/v1/comments/:commentId/like` | social (optional) | 401 | 204 | – | pass |
| ts:social | POST | `/api/v1/comments/:commentId/like` | social (optional) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/comments/:commentId/replies` | social (optional) | 404 | 404 | – | pass |
| ts:social | GET | `/api/v1/conversations` | social (required) | 401 | 200 | – | pass |
| ts:social | POST | `/api/v1/conversations` | social (required) | 401 | 400 | – | pass |
| ts:social | DELETE | `/api/v1/conversations/:conversationId` | social (required) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/conversations/:conversationId` | social (required) | 401 | 404 | – | pass |
| ts:social | PATCH | `/api/v1/conversations/:conversationId` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/conversations/:conversationId/accept` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/conversations/:conversationId/admins` | social (required) | 401 | 400 | – | pass |
| ts:social | DELETE | `/api/v1/conversations/:conversationId/admins/:userId` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/conversations/:conversationId/block` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/conversations/:conversationId/leave` | social (required) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/conversations/:conversationId/members` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/conversations/:conversationId/members` | social (required) | 401 | 400 | – | pass |
| ts:social | DELETE | `/api/v1/conversations/:conversationId/members/:userId` | social (required) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/conversations/:conversationId/messages` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/conversations/:conversationId/messages` | social (required) | 401 | 404 | – | pass |
| ts:social | PUT | `/api/v1/conversations/:conversationId/mute` | social (required) | 401 | 400 | – | pass |
| ts:social | POST | `/api/v1/conversations/:conversationId/not-spam` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/conversations/:conversationId/read` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/conversations/:conversationId/restrict` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/conversations/:conversationId/streak/celebrated` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/conversations/:conversationId/streak/restore` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/conversations/groups` | social (required) | 401 | 400 | – | pass |
| ts:social | GET | `/api/v1/conversations/search` | social (required) | 401 | 400 | – | pass |
| ts:social | POST | `/api/v1/feeds/feedback` | social (optional) | 401 | 400 | – | pass |
| ts:social | GET | `/api/v1/feeds/following` | social (optional) | 401 | 200 | – | pass |
| ts:social | GET | `/api/v1/feeds/for-you` | social (optional) | 200 | 200 | – | pass |
| ts:social | GET | `/api/v1/feeds/popular` | social (optional) | 200 | 200 | – | pass |
| ts:social | GET | `/api/v1/feeds/suggested-clips` | social (optional) | 200 | 200 | – | pass |
| ts:social | POST | `/api/v1/follow-requests/:requestId/accept` | social (required) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/follow-requests/:requestId/reject` | social (required) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/internal/ad-sources/content` | internal | – | – | – | hidden (404) |
| ts:social | GET | `/api/v1/internal/audience-sources/accounts/:accountId/engagers` | internal | – | – | – | hidden (404) |
| ts:social | GET | `/api/v1/internal/audience-sources/accounts/:accountId/followers` | internal | – | – | – | hidden (404) |
| ts:social | GET | `/api/v1/internal/digests/:kind` | internal | – | – | – | hidden (404) |
| ts:social | GET | `/api/v1/internal/moderation/targets/:type/:id` | internal | – | – | – | hidden (404) |
| ts:social | GET | `/api/v1/internal/save-counts` | internal | – | – | – | hidden (404) |
| ts:social | GET | `/api/v1/internal/search-sources/:collection/:id` | internal | – | – | – | hidden (404) |
| ts:social | GET | `/api/v1/mentions/candidates` | social (optional) | 401 | 400 | – | pass |
| ts:social | POST | `/api/v1/mentions/resolve` | social (optional) | 400 | 400 | – | pass |
| ts:social | POST | `/api/v1/messages/:messageId/live-location/stop` | social (required) | 401 | 404 | – | pass |
| ts:social | PATCH | `/api/v1/messages/:messageId/location` | social (required) | 401 | 400 | – | pass |
| ts:social | POST | `/api/v1/messages/:messageId/poll-votes` | social (required) | 401 | 400 | – | pass |
| ts:social | POST | `/api/v1/messages/:messageId/reactions` | social (required) | 401 | 400 | – | pass |
| ts:social | DELETE | `/api/v1/messages/:messageId/reactions/:emoji` | social (required) | 401 | 400 | – | pass |
| ts:social | POST | `/api/v1/posts` | social (optional) | 401 | 422 | – | pass |
| ts:social | DELETE | `/api/v1/posts/:postId` | social (optional) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/posts/:postId` | social (optional) | 404 | 404 | – | pass |
| ts:social | GET | `/api/v1/posts/:postId/analytics` | social (optional) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/posts/:postId/comments` | social (optional) | 404 | 404 | – | pass |
| ts:social | POST | `/api/v1/posts/:postId/comments` | social (optional) | 401 | 400 | – | pass |
| ts:social | POST | `/api/v1/posts/:postId/impressions` | social (optional) | 404 | 404 | – | pass |
| ts:social | DELETE | `/api/v1/posts/:postId/like` | social (optional) | 401 | 204 | – | pass |
| ts:social | POST | `/api/v1/posts/:postId/like` | social (optional) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/posts/:postId/profile-visits` | social (optional) | 404 | 404 | – | pass |
| ts:social | POST | `/api/v1/posts/:postId/repost` | social (optional) | 401 | 404 | – | pass |
| ts:social | POST | `/api/v1/posts/:postId/share` | social (optional) | 404 | 404 | – | pass |
| ts:social | POST | `/api/v1/reports` | social (required) | 401 | 400 | – | pass |
| ts:social | DELETE | `/api/v1/saves` | social (required) | 401 | 400 | – | pass |
| ts:social | GET | `/api/v1/saves` | social (required) | 401 | 200 | – | pass |
| ts:social | POST | `/api/v1/saves` | social (required) | 401 | 400 | – | pass |
| ts:social | PATCH | `/api/v1/saves/:saveId` | social (required) | 401 | 400 | – | pass |
| ts:social | GET | `/api/v1/saves/collections` | social (required) | 401 | 200 | – | pass |
| ts:social | POST | `/api/v1/saves/collections` | social (required) | 401 | 400 | – | pass |
| ts:social | GET | `/api/v1/search/people` | social (optional) | 400 | 400 | – | pass |
| ts:social | GET | `/api/v1/sounds` | social (optional) | 200 | 200 | – | pass |
| ts:social | POST | `/api/v1/sounds` | social (optional) | 401 | 400 | – | pass |
| ts:social | GET | `/api/v1/sounds/:soundId` | social (optional) | 404 | 404 | – | pass |
| ts:social | PATCH | `/api/v1/sounds/:soundId` | social (optional) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/sounds/:soundId/clips` | social (optional) | 200 | 200 | – | pass |
| ts:social | DELETE | `/api/v1/sounds/:soundId/save` | social (optional) | 401 | 204 | – | pass |
| ts:social | POST | `/api/v1/sounds/:soundId/save` | social (optional) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/sounds/saved` | social (optional) | 401 | 200 | – | pass |
| ts:social | GET | `/api/v1/sounds/trending` | social (optional) | 200 | 200 | – | pass |
| ts:social | POST | `/api/v1/stories` | social (required) | 401 | 400 | – | pass |
| ts:social | POST | `/api/v1/stories/:storyId/replies` | social (required) | 401 | 400 | – | pass |
| ts:social | POST | `/api/v1/stories/:storyId/seen` | social (required) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/stories/tray` | social (required) | 401 | 200 | – | pass |
| ts:social | DELETE | `/api/v1/users/:userId/block` | social (required) | 401 | 204 | – | pass |
| ts:social | POST | `/api/v1/users/:userId/block` | social (required) | 401 | 404 | – | pass |
| ts:social | DELETE | `/api/v1/users/:userId/follow` | social (required) | 401 | 204 | – | pass |
| ts:social | POST | `/api/v1/users/:userId/follow` | social (required) | 401 | 404 | – | pass |
| ts:social | GET | `/api/v1/users/:userId/follow-status` | social (optional) | 404 | 404 | – | pass |
| ts:social | GET | `/api/v1/users/:userId/followers` | social (optional) | 404 | 404 | – | pass |
| ts:social | GET | `/api/v1/users/:userId/following` | social (optional) | 404 | 404 | – | pass |
| ts:social | GET | `/api/v1/users/:userId/posts` | social (optional) | 404 | 404 | – | pass |
| ts:social | GET | `/api/v1/users/:userId/stories` | social (optional) | 404 | 404 | – | pass |
| ts:social | GET | `/api/v1/users/me/blocked` | social (required) | 401 | 200 | – | pass |
| ts:social | GET | `/api/v1/users/me/follow-requests` | social (required) | 401 | 200 | – | pass |
| ts:social | GET | `/healthz` | nonApi | – | – | – | n/a |
| ts:social | GET | `/readyz` | nonApi | – | – | – | n/a |

## 6. Remaining failures and open issues

### 6.1 Ledger permission blocker: fixed, re-verification partly complete (2026-10-04, second pass)

The owner added `20261004090000_allow_foreign_key_checks_on_append_only_ledger` (`GRANT UPDATE (id)` on `journal_entries` and `journal_lines` to `svc_ledger` and `svc_money`). goMoney applied it on start (`ledger.schema_migrations` version `20261004090000`, not dirty; `has_column_privilege('svc_money', 'ledger.journal_entries', 'id', 'UPDATE')` is true). The migration and the triggers were not touched.

Regression test (new): `services/go/modules/ledger/src/modules/journal/services/ledgerPosting.serviceRole_integration_test.go`. It builds a fresh schema, grants the real service role only what the app gets (no UPDATE or DELETE on the append-only tables beyond the migration), connects as `svc_money` and `svc_ledger` (not superuser), posts a balanced entry with lines (succeeds), then `UPDATE` and `DELETE` on `journal_entries` and `journal_lines` (both refused). It skips when Postgres or the role is missing. Passes for both roles.

Re-run of the money journeys with goIdentity, goCommerce, goMoney, goLive, gateway, media (+ object storage for the product image), Phoenix realtime, LiveKit, Valkey, RabbitMQ and the fake Paystack:

| Journey | Result |
| --- | --- |
| Live journey (coin purchase via fake, gift, `gift.sent` over the socket, battle, settlement) | 8 / 8 pass. This covers the coin purchase and the gift/battle ledger postings that failed before |
| Commerce: checkout, payment initialize, signed `charge.success` webhook, escrow funded (held), seller accept, fulfilment, seller marks delivered | pass (settlement and escrow hold were the failures before) |
| Commerce: buyer confirm receipt, release, seller wallet, payout transfer | FAIL, new finding below |
| Multi-seller checkout, direct-order split, refund, creator payout, 3-day auto-release, 24h lock, fee postings (escrow 1.5% / 1% Business, Paystack fee as separate seller lines) | NOT verified (see below) |

New defects found and fixed this pass:

- goCommerce and goLive need `ORDERS_MONEY_GRPC_ADDRESS` / `LIVE_MONEY_GRPC_ADDRESS` (both empty in `.env.example`). Empty means an in-memory money fake, so checkout registered no payables (`ORDER_NOT_FOUND` on payment initialize) and gifts never reached the ledger. Run with `localhost:9103` for local verification. Consider failing startup outside tests when empty.
- The fake Paystack restarted its charge ids at 1, so the webhook dedupe (`charge.success:<id>:success`) swallowed every webhook after a fake restart on a reused database (HTTP 200, nothing processed). The fake smoke server now offsets ids by the start time (`fakePaystackServer_test.go`).

### 6.1.1 Third pass: order fix applied, money journeys verified (2026-10-04)

The owner allowed the buyer to move an order to `completed` and `disputed`. Buyer confirm-receipt now works end to end. All results below ran against the compose Postgres with the real service roles (`svc_money`, `svc_ledger`), the fake Paystack and the real gateway. Time travel: `ESCROW_AUTO_RELEASE_SWEEP_INTERVAL=2s`, `LEDGER_SELLER_CREDIT_MATURING_INTERVAL=5s`, and `UPDATE` of `escrow.escrows.auto_release_at` / `ledger.seller_credit_maturities.available_at` into the past (the policy values themselves, 72 h and 24 h, are asserted unchanged first). The journal tables were never touched.

New suite `services/scripts/apiSmoke/tests/moneyJourneys.smoke.test.ts` (helpers in `src/commerceFixtures.util.ts`), plus two new steps in `liveJourney.smoke.test.ts`:

| Journey | Result |
| --- | --- |
| Buyer confirm-receipt, escrow released, seller wallet, payout transfer (`commerceJourney`) | pass (8/8) |
| Multi-seller cart: 2 sellers, one checkout, one payment intent, one webhook, 2 escrows held | pass |
| Fees: escrow fee 1.5% (`commission_bps` 150, 17,250 on 1,150,000) booked to `liability:platformFeesUnearned` at hold and moved to `revenue:escrowFees` only at release; Paystack processing fee (60,000, split 30,000 per group pro rata) booked to `expense:paymentProcessingFees` as its own line; the seller credit is amount minus both (1,102,750) | pass |
| Auto-release timer is exactly 72 h after delivery; after time travel the sweep releases with trigger `autoRelease` | pass |
| 24 h lock: the credit sits in `pending` / `locked`, nothing withdrawable, a withdrawal is refused during the lock; after the lock the maturity job moves it to `available` | pass |
| Payout: withdrawal, staff review, payout run, transfer reaches the provider, settle webhook, withdrawal paid (`withdrawal.requested` then `withdrawal.paid` postings) | pass |
| Escrow refund (seller rejects a paid order): buyer refunded in full (1,150,000), escrow fee reversed (no fee on refunded amounts), processing fee booked as `refundedProcessingFees`, provider received the refund | pass |
| Creator payout: gift earnings converted (`coins.convertedToCash`), payout onboarding, admin payout run moves earnings to withdrawable, withdrawal, transfer, settle, paid | pass |
| USD web checkout (coin package priced in USD, fresh user from the US, `PAYSTACK_SUPPORTED_CURRENCIES=NGN,USD`): intent is `USD` / 500, coins credited | pass |
| Gift send and battle settlement (HTTP and ledger) | pass; the three realtime socket assertions were not re-run (the `elixir:1.19` container could not fetch hex without network this pass) |
| Business plan 1% fee | not over HTTP (seller plans need a Paystack plan checkout); covered by the Go suites `escrowFees.service_test.go` (150 vs 100 bps) and `subscriptions.module_integration_test.go`, both green |
| Direct-order split and direct refund | NOT reachable over HTTP, see below; the Go integration suites pass (`TestDirectCheckoutSplitsToTheSellerSubaccountAndEscrowStaysOnTheMainBalance`, `TestOneCheckoutPaymentSplitsDirectGroupsAndHoldsEscrowGroupsWithPerGroupRefunds`, `TestUnverifiedStoresAreEscrowOnlyAndDirectPaymentsLockTheSellerCreditUntilRefunded`) |

Findings from this pass:

1. **Direct payments cannot be chosen through go-commerce.** `modules/orders/src/integrations/checkoutMoneyGrpc.integration.go` always sends `ORDER_PAYMENT_MODE_ESCROW`, and the checkout request has no payment-mode field. The money side supports direct, but no API path reaches it. Needs a product decision (checkout field per seller group, verified stores only).
2. Cold start: the first checkout right after goMoney starts can fail with 502 `PAYMENT_SERVICE_UNAVAILABLE` (register-payables gRPC deadline). A retry works.
3. Seller credit maturing runs every 5 minutes by default (`LEDGER_SELLER_CREDIT_MATURING_INTERVAL`), so the money can show up to 5 minutes after the 24 h lock ends.
4. A payout onboarding finishes asynchronously: a withdrawal right after onboarding returns 403 `PAYOUT_ACCOUNT_NOT_VERIFIED` for a few seconds.
5. `GET /wallets/me` returns amounts in the viewer currency (USD for a user with no region), so a Nigerian seller without `x-client-region: NG` sees zeros. Worth deriving the currency from the wallet's own balances.
6. The fake Paystack smoke server now offsets charge ids by start time (webhook dedupe) and accepts `?fee=` on the charge-complete call.
7. Run time: auto-release took over 30 s once when the money journey ran in parallel with the other two files; run the money file alone.

Everything started for this pass was stopped, including `docker compose stop` (betng-* untouched).

### 6.2 Found, not fixed (product or contract decisions)

| Item | Detail |
| --- | --- |
| Order notifications never fire | `contracts/events/consumers/notifications.md` expects goCommerce to publish `order.placed/paid/sellerAccepted/sellerRejected/shipped/delivered/completed` with rich payloads. goCommerce publishes `order.created`, `orderGroup.paid`, `orderGroup.statusChanged`, `order.cancelled`. Buyers and sellers get no order notifications except cancellation. Needs a producer in orders, or a mapping in notifications |
| Two sources of creator requirements | The public `creator.requirements` setting (`/platform-config/creator-requirements`) is display-only. Eligibility reads the `creator-thresholds` rule document. They can drift |
| No seeded business categories | `GET /business-categories` is empty on a fresh database. Seller onboarding works only with custom categories, which go to pending review |
| Guest live viewing | The gateway allows guests on `GET /lives/{id}`, but go-live requires a token. Decide whether shared live links should open for guests |
| Legal notice routes exist twice | `/admin/legal/notices*` and `/admin/legal/versions/*/notice-*` exist in go-users and notifications; the gateway sends them to notifications |
| Payment webhook alias | `/api/v1/payments/webhooks/{provider}` sits under authenticated `/api/v1/payments/` and is unusable through the gateway (`/webhooks/{provider}` works) |
| Boost refund check swallows errors | `wallet/src/modules/adBalances/services/boostFunding.service.go` treats any error while summing earlier refunds as zero refunded |
| Live comment limit | Per-user comment rate limiting returns 429 at about 1 comment/s per user (k6: 31% 429 at 1 comment/s per VU). Expected, noted for load planning |
| Job queues without consumers | `jobs-ads-reports`, `jobs-payouts`, `jobs-reports`, `jobs-search-indexing` had 0 consumers during the run. `events.md` lists payouts and ads reports as consumed by goMoney/goAds; check the flags that enable those workers |
| Atlas lint | Not run (CLI missing) |

## 7. Speed (local-machine baselines)

Through the gateway unless noted. Constant VUs for 20 s, one scenario at a time, 8-core laptop with the whole stack on it. Latency is in ms.

| Scenario | VUs | p50 | p95 | p99 | req/s | Errors | Target (`performance.md` §5, endpoint p50/p95/p99) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gateway passthrough `GET /currencies` | 10 | 9.5 | 29.7 | 41.5 | 821 | 0% | direct to identity: 6.6 / 28.2 / 37.3 at 1117 req/s, so the gateway adds about 3 ms p50 |
| Identity login (argon2id) | 5 | 58.7 | 78.2 | 90.2 | 83 | 0% | 120 / 250 / 500 ✔ |
| Identity `GET /users/me` | 10 | 10.1 | 16.4 | 31.7 | 886 | 0% | profile read 15 / 40 / 90 ✔ |
| Social feed (following / for-you) | 10 | 29.6 | 46.6 | 57.2 | 327 | 0% | 40 / 100 / 250 ✔ |
| Social post create (text) | 10 | 75.3 | 96.6 | 111.2 | 132 | 0% | no target (similar writes 120 / 300 / 600) ✔ |
| Search query | 10 | 30.1 | 47.0 | 59.2 | 310 | 0% | browse 60 / 150 / 300 ✔ |
| Commerce cart add / read | 5 | 11.5 / 6.4 | 18.5 / 10.2 | 23.1 / 13.8 | 511 | 0% | catalog page 30 / 80 / 150 ✔ |
| Commerce checkout (order + reservation) | 5 | 33.6 | 51.3 | 66.2 | 202 | 0% | 120 / 300 / 600 ✔ |
| Money payment initialize (fake provider) | 5 | 19.0 | 34.6 | 45.0 | 185 | 0% | no target ✔ |
| Money Paystack webhook (signature + store) | 10 | 15.4 | 34.5 | 44.8 | 556 | 0% | no target ✔ |
| Live gift send (go-live → go-money gRPC charge) | 10 | 25.0 | 40.0 | 51.4 | 371 | 100% 402 by design (no coins, section 6.1) | 60 / 150 / 350 ✔ path latency |
| Realtime fan-out (comment POST → `live.comment` on the socket) | 5 | 192–455 | 243–522 | 249–526 | n/a | 31% 429 (comment limit) | outbox to publish p50 < 1 s, p99 < 5 s ✔ |
| Notifications inbox | 10 | 11.3 | 17.1 | 21.9 | 820 | 0% | 25 / 70 / 150 ✔ |
| Media upload plan (session + presign) | 10 | 40.6 | 54.9 | 74.0 | 228 | 0% | no target ✔ |
| Ads decide (feed slot, no campaigns) | 10 | 12.3 | 21.6 | 35.1 | 727 | 0% | no target ✔ |
| Intelligence `/v1/feed/rank` (100 candidates, signed, direct) | 10 | 78.6 | 119.1 | 213.6 | 113 | 0.4% | contract client timeout 100 ms: p95 exceeds it, so about 5–10% of calls would fall back under this concurrency |

Bottleneck review: sequential scans on `payments.payment_intents`, `payments/auth/admin.outbox_events` disappeared after `ANALYZE` (stale statistics on new tables; the right indexes exist and are used). No N+1 or missing index stood out at these volumes, so no performance code change was made. Intelligence ranking is the slowest hop; run more uvicorn workers or reduce candidates per request before production.

## 8. Needs the owner

- Decide the ledger privilege fix (6.1). It is the only thing between the current state and a full green smoke run.
- Paystack test keys (`PAYSTACK_SECRET_KEY=sk_test_…`, `PAYSTACK_PUBLIC_KEY`) for a run against real Paystack test mode; everything here used the fake. Webhook IP allowlist and live keys for production.
- App Store / Play: store product ids for coin packs and subscriptions (`SUBSCRIPTIONS_STORE_PRODUCT_PLANS`, coin package `storeProductId`), App Store Server Notifications and Play RTDN endpoints (`/webhooks/store-notifications/{store}`).
- AWS: real SES (SESv2 is not available in LocalStack community; locally `EMAIL_PROVIDER=log`), S3 buckets/KMS/CloudFront signing keys for media, `LIVE_RECORDING_S3_*`, `ADS_ASSETS_BUCKET`, Amazon MQ/RabbitMQ topology, RDS roles. `terraform plan` was not run (no credentials).
- Device testing: mobile against the real gateway (camera upload, E2E chat keys, LiveKit, push via Expo).
- Product decisions listed in 6.2 (order notification producer, business category seed, guest live viewing, creator requirements source).
- ffmpeg is not installed locally, so video/audio processing was not exercised (uploads stay "processing"); ClamAV not configured.
