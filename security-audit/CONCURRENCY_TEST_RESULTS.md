# Concurrency test results

Date: 2026-10-29. This records bounded tests executed in the ledger Go suite against a disposable local DB, plus remaining concurrency gaps. No live money provider or external queue was used.

| Test | Parallelism / invariant | Result |
| --- | --- | --- |
| `TestConcurrentSpendsNeverOverdrawAndSameReferencePostsOnce` | 40 concurrent 10-unit spends against 100 units; then 20 duplicate-reference requests | Pass under test/admin DB identity: exactly 10 accepted, 30 rejected; replay phase recorded one posting and 19 replays, final balance 30. |
| `TestConcurrentGiftsSpreadOverPlatformStripesAndTheLedgerStaysBalanced` | 24 synthetic senders × 3 concurrent gift postings (72 posts) | Pass under test/admin DB identity; expected platform revenue and healthy trial balance. |
| Runtime-role balanced-posting regression | Same journal transaction using `svc_money`; verifies role grants, balanced posting, rollback, bad-entry rejection and append-only behavior | Pass after restoring column-only `UPDATE(id)` to the referencing table owner for FK checks. Runtime does not gain schema-owner membership; journal UPDATE/DELETE/TRUNCATE remains blocked. |
| Refund reference race | Two concurrent transactions request the same full refund against one synthetic succeeded order intent | Passed against disposable PostGIS: one refund row is created, both callers return the same ID, and exactly one response is a replay. The initial card-verification fixture was invalid because that flow already requests a full refund; it was replaced with a succeeded order intent. The test plus webhook and bank-destination races passed under Go `-race`. |
| Webhook/refund race regression set | Duplicate webhook delivery and concurrent customer bank-destination submissions | Passed in the payment package integration selection and in the selected Go `-race` run against fake Flutterwave and disposable PostGIS; these verify one webhook processing/one accepted bank retry under bounded concurrency. |

These are functional database concurrency tests, not a benchmark or load test. The wider 40/20/72 concurrency tests ran under test/admin credentials; the focused least-privilege transaction test ran as `svc_money` but was not itself a parallel stress test. Coverage includes same-reference refunds, webhook redelivery, and bank-destination submission using fake provider/database harnesses, but does not cover payout/escrow races, inventory reservations, external queue redelivery or multi-instance behavior. Re-run concurrency tests against the production-shaped runtime identity in isolated staging after AWS roles/grants are provisioned.

## Current-source rerun — 2026-10-29

Against a disposable loopback PostGIS DB and fake Flutterwave, this command passed under Go's race detector:

```sh
MONEY_TEST_DATABASE_URL=<disposable-loopback-db> go test -race ./modules/payments -run 'Test(ConcurrentRefundReferenceReplaysAfterPaymentLock|WebhookDeliveredTwiceAndConcurrentlyIsProcessedOnce|ARefundIsSentToABankAccountInTheBuyersOwnNameOnlyOnceUnderConcurrentSubmits)$' -count=1
```

Result: **3 tests passed**. The tests assert one refund row/replayed refund ID for the concurrent same-reference case, one processed webhook effect for duplicate concurrent delivery, and single-use buyer-owned bank-refund behavior. This verifies Go data-race freedom and DB invariants only for those tested requests; payout/escrow, inventory, multi-instance scheduling, and external broker redelivery remain untested.

## Wallet and escrow race-detector package rerun — 2026-10-29

Against the same disposable PostGIS endpoint and synthetic fixtures, `MONEY_TEST_DATABASE_URL=... go test -race ./modules/wallet ./modules/escrow -count=1` passed both packages. The wallet suite needed a test-only schema setup correction: it now applies wallet migrations before constructing the module, matching the deliberately migration-free runtime startup. The escrow suite passed as-is. No application service logic was modified and no exploit was confirmed. Package `-race` success is bounded; it does not cover deployed multi-instance races, external payment/broker redelivery, or every withdrawal/payout/release interleaving.

## Inventory/order race checks — 2026-10-29

With isolated PostGIS and synthetic inputs, `INVENTORY_TEST_DATABASE_URL=... go test -race ./modules/inventory ./modules/orders -run 'Test(ConcurrentCheckoutsNeverReserveMoreThanAvailable|PerCustomerCouponLimitHoldsUnderConcurrentCheckouts|InvoiceNumbersAreUniqueAndSequentialUnderConcurrency)$' -count=1` passed. Stock contention was 60 reservations against 20 units (20 succeeded, 40 were rejected; final stock invariant held). Per-customer coupon limit and invoice sequence concurrency cases also passed. This is process-level package testing; distributed replicas, DB failover and queue duplicate delivery remain out of scope.

## Ads money paths — 2026-10-29

The ads withdrawal same-key race was reproduced and fixed. Sixteen simultaneous identical withdrawal requests originally yielded some false `WITHDRAWAL_ABOVE_AVAILABLE` responses after the first request reserved funds. The service now re-reads the idempotency key within the account-locked transaction before checking available funds. The new `TestConcurrentWithdrawalReplayCreatesOnePayoutAndLedgerDebit` passed both normally and under `go test -race`; persisted assertions showed one withdrawal, one ledger debit, one downstream payout, identical withdrawal IDs for all 16 callers, and the expected remaining balance. This does not test different idempotency keys spending concurrently, multi-instance deployment or real downstream wallet behavior.
