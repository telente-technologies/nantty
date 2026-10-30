# Financial integrity test results

Date: 2026-10-29. Only synthetic local data and a disposable Postgres DB were used. No real payment, refund, payout or provider API call was made.

## Passed test scope

`MONEY_TEST_DATABASE_URL=<isolated admin URL> go test ./modules/ledger/src/...` passed using test/admin credentials. Existing ledger integration tests exercised balanced entries, rollback, idempotent references, negative-balance protection, append-only records and ledger health. In particular, 40 parallel spends against a 100-unit balance produced 10 successful spends and 30 insufficient-balance rejections; 20 same-reference operations yielded one posting and 19 replays; 72 concurrent gift postings left the ledger balanced. These broader concurrency tests use the test/admin identity.

The opt-in `TestLedgerRuntimeRoleIsLeastPrivilegeAndTransactionsRemainAtomic` also passed against a fresh disposable PostGIS 17 DB as `svc_money`. It denied DDL and role escalation, then successfully posted a balanced journal entry, confirmed correct debit/credit and account balances, rolled back a tentative post, rejected an unbalanced post without persistence, and rejected journal mutation through the append-only trigger.

The fresh all-money bootstrap test also verified runtime DELETE is granted only on the three application cleanup tables (`payments.provider_payout_destinations`, `creators.creator_brand_deals`, and `ledger.step_up_consumptions`). Synthetic rows were inserted by the isolated admin and deleted under `svc_money`; other money tables deny DELETE and all tested money tables deny TRUNCATE.

The test initially exposed a real failure: PostgreSQL runs FK checks with the referencing table owner's privileges, and the append-only migration had revoked that owner's UPDATE. A later forward migration restored only owner column `UPDATE(id)`; table-level journal UPDATE remains revoked and runtime `svc_money` received no schema or owner membership. Local test evidence closes the posting compatibility blocker, but production AWS roles and migration task prerequisites remain unverified.

## Remaining financial workflows

The payment module's fake-provider HTTP/controller/service tests, synthetic Postgres migrations, selected webhook/refund concurrency and race-detector cases were executed as recorded below. Still not exercised in this continuation: checkout through the deployed-style gateway, live provider-signed ingress, payouts, wallet transfers/withdrawal reservation, escrow release/refund/cancel races, order settlement, affiliate commission and provider reconciliation as a running multi-service stack. The normal launcher would reuse existing DB/service ports, so it was not used. Existing test files are not counted as executed unless listed above.

## Payment workflow verification — isolated fake-provider run

A separate disposable PostGIS container (`nantty-payments-security-20261029`, loopback `127.0.0.1:25434`, bounded to 1 CPU/768 MiB/128 PIDs, no persistent volume) was used with synthetic payment intents and a fake Flutterwave server. No real provider endpoint was called.

- `MONEY_TEST_DATABASE_URL=... go test ./modules/payments -count=1`: **passed** on the current source (22.607s) against disposable PostGIS and the local fake provider, including all database-backed cases in the core payments package.
- `MONEY_TEST_DATABASE_URL=... go test ./modules/payments/... -count=1`: core package and the remaining packages passed except **five Apple/Google provider fixture cases** in `src/integrations`; those fixtures are rejected for invalid certificate markers/signatures/claims. This remains a failed full-tree run, not a clean pass. No verifier was relaxed.
- `MONEY_TEST_DATABASE_URL=... go test -race ./modules/payments -run 'Test(ConcurrentRefundReferenceReplaysAfterPaymentLock|WebhookDeliveredTwiceAndConcurrentlyIsProcessedOnce|ARefundIsSentToABankAccountInTheBuyersOwnNameOnlyOnceUnderConcurrentSubmits)$' -count=1`: **passed**, 3 tests (3.182s after race build). This is bounded race coverage, not proof against multi-instance or provider/queue races.
- A real mismatch-state defect was reproduced: the underpaid charge was dead-lettered for finance but its intent stayed `pending`. The early guard was narrowed so the transactional branch marks pending underpaid intents `failed`; cancelled intents with mismatched late charges remain cancelled and uncredited. The three focused status/fee/late-charge tests passed after the change.
- The same-reference refund concurrency test now seeds a synthetic succeeded order intent. The former card-verification setup automatically requests and consumes a refund, so it was not a valid remaining-capacity race fixture. The corrected test passed and verifies one persisted refund plus replay returning the same refund ID.
- The test harness now applies the payment migration bundle explicitly to its disposable schema; normal application startup migration remains disabled. This fixed the test harness only and did not alter production behavior.

Still untested: end-to-end checkout HTTP with gateway identity, real signed provider ingress through a running service, wallet/escrow/order settlement and payout races, and provider reconciliation. All test operations were synthetic/local.

## Wallet and escrow package verification — isolated fake-provider run

Using disposable PostGIS on loopback port 25437 (synthetic DB only): `MONEY_TEST_DATABASE_URL=... go test ./modules/wallet -count=1` and `... go test ./modules/escrow -count=1` both passed. The wallet harness had first failed because it created an empty schema after runtime migrations were decoupled; the test-only harness now applies the embedded wallet migrations to its fresh schema. Escrow needed no harness change. Both packages also passed `go test -race ./modules/wallet ./modules/escrow -count=1`. This does not establish full-stack HTTP authorization, external provider ingress, or multi-instance money-operation safety; see remaining risks.

## Inventory/order settlement protection — isolated test run

Against disposable PostGIS on loopback port 25438, `go test ./modules/inventory ./modules/orders -count=1` passed. Inventory’s 60-request contention test conserved stock (20 accepted, 40 rejected, no reserved quantity above on-hand). A targeted Go race-detector run covering that test plus concurrent per-customer coupon limits and invoice numbering passed. These tests do not cover live checkout-to-payment-to-escrow settlement, multi-instance service behavior, or production queue redelivery.

## Ads credit and withdrawal suite — 2026-10-29

`ADS_TEST_DATABASE_URL=<disposable loopback PostGIS> go test ./modules/ads -count=1` passed the full ads package. Existing tests verify admin credit permission plus step-up audit/remainder revocation, earliest-expiring credit spend order, cashback only on real-money spend, expiry boundary behavior, withdrawal requiring settled funds and step-up, and one-time payout behavior. These tests are sequential/package integration coverage; no ads-specific parallel withdrawal/credit race or multi-instance idempotency test was run. External wallet/payment/provider settlement remains unverified.

The added 16-request same-key withdrawal race test passed after a service fix. It asserted one persisted withdrawal, one ledger debit, one fake downstream payout and the correct remaining real balance; Go `-race` reported no data race in this scenario. Different-key contention and real wallet/provider settlement remain unverified.

## Latest isolated rerun — 2026-10-29

- Wallet: `MONEY_TEST_DATABASE_URL=<disposable-loopback-db> go test ./... -count=1` in `services/go/modules/wallet` passed, including full synthetic wallet integration tests against fake Flutterwave.
- Ledger: the same command in `services/go/modules/ledger` passed. The opt-in production-shaped `svc_money` privilege test did not run because the exact owner/runtime schema fixture was not provisioned; do not interpret the package pass as fresh confirmation of runtime grants.
- Escrow follow-up: the masked 500 came from the local integration harness creating an empty escrow schema after startup migrations were disabled; applying the escrow migration set fixed the fixture. The underpayment case also paired a 100-minor-unit synthetic successful charge with a fee computed from the full order amount. The helper now derives the fake fee from the overridden charge amount. The complete escrow package suite and focused payment underpayment regression both pass against the disposable database. No provider was contacted and no actual transfer or charge occurred.
- The throwaway PostGIS/Valkey containers used for this continuation were removed after verification. No provider was contacted and no actual transfer or charge occurred.
