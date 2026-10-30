# Race conditions and financial integrity

## Safe source review

Money, wallet, escrow, orders, creator payouts and live gifts were identified as mutable financial state. The codebase contains idempotency records/keys, database transactions, locking patterns and immutable journal protections; this is evidence of intended safeguards, not proof that every path satisfies the invariant under concurrency.

## Executed bounded local database tests

Against a disposable PostGIS database, the existing ledger suite passed: 40 concurrent spends against 100 units produced exactly 10 accepted and 30 rejected; 20 same-reference operations produced one post and 19 replays; and 72 concurrent gift entries remained balanced. These tests used the isolated test/admin DB identity. The focused `svc_money` integration test verified a balanced posting, rollback, invalid unbalanced-post rejection, runtime DDL/role-escalation denial and journal immutability, but was not itself concurrent. No provider calls or real transfers were made. Detailed results are in `CONCURRENCY_TEST_RESULTS.md`.

## Not executed

Webhook/refund/withdrawal/escrow/inventory/affiliate/ads-credit/queue races were not run. The prior Go suite coverage does not establish their safety. No active HTTP services, fake provider environment or isolated multi-service stack was available for those tests.

## Required bounded race matrix

Use disposable isolated database state and fake provider only. For each case record initial balances, exact concurrent request count, provider fixture state, final ledger rows and invariant checks. Keep concurrency at 2–10 workers and total runs bounded; no real money:

1. Duplicate payment event (same provider charge + webhook ID); parallel webhook replay and timeout/retry.
2. Card/wallet simultaneous settlement, duplicate settlement, chargeback/refund concurrent with escrow release.
3. Same idempotency key with matching and conflicting payloads; two distinct keys for the same logical operation.
4. Two withdrawal requests whose aggregate exceeds available spendable balance; verify reservation and final account balance.
5. Concurrent escrow buyer-confirm, auto-release, dispute, cancellation and refund transitions.
6. Inventory reserve/confirm/cancel expiry races; assert no paid order lacks stock or refund case.
7. Coupon/offer/subscription claim races and creator affiliate attribution/referral credit replay.
8. Ads wallet/credit spend vs refund/revoke; prevent credit from becoming withdrawable cash.
9. Space gift replay and host/session state transition races (only when feature enabled and fake ledger adapter used).
10. Duplicate outbox delivery and worker retry; compare side effects and idempotency records.

## Accounting invariants

- Posted journal entries are balanced per currency and immutable; correction uses reversal entries.
- One economic operation cannot debit/credit more than once, regardless of webhook, worker or API retries.
- A withdrawal reservation plus in-flight payout cannot exceed available funds.
- Escrow has exactly one terminal settlement path, with seller and platform amounts reconciled separately.
- No client-supplied status, amount, currency, fee, payout destination or seller identity is trusted without server/provider derivation.

For active validation, first inspect existing security runbooks and test harnesses, snapshot the disposable database, preserve all existing append-only guards, run tests serially, then restore and verify state. Never apply migrations or seed data to an unidentified database.
