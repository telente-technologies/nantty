# Financial integrity (4–5 Oct 2026)

This covers what was verified about money safety during the audit, how it was verified, and what was not run. The ledger was never modified by any test, and no grant or trigger was weakened.

## 1. Controls in place

| Control | Where | Evidence |
|---|---|---|
| Append-only ledger: triggers refuse UPDATE, DELETE and TRUNCATE on `journal_entries`, `journal_lines` and `reconciliation_runs` | `ledger/src/migrations/20261003142306_protect_append_only_ledger_history.up.sql` | Migration applies in every integration run |
| Runtime roles lose UPDATE, DELETE and TRUNCATE on ledger history; only `UPDATE (id)` is granted, for foreign-key locks | same file, `20261004090000_allow_foreign_key_checks_on_append_only_ledger` | Owner-approved (option A) |
| Escrow history append-only | `escrow/src/migrations/20261003142306_protect_append_only_escrow_history.up.sql` | Migration applies |
| Money stored as int64 minor units plus currency code; no floats | `services/go/platform/money`, `amountMinor` fields | Requirements traceability scan |
| Server-side prices only; client amounts never trusted | catalog, orders and payments checkout | apiSmoke commerce journeys |
| Exactly-once refunds and charges: the intent row and ledger entry are written before the previous payment provider call; a resend first looks up the earlier one (the previous payment provider refunds take no reference, so ours goes in `merchant_note`) | payments refunds, verification share refund, card-check refund, renewals | Two-consumer redelivery test: one provider call, balanced ledger |
| Renewal charges keyed per subscription and period | subscriptions renewal engine | Unit tests; subscriptions integration tests |
| Refund amount ≤0 rejected (SEC-0013); one refund per order; full-only once paid out | payments and the seller refunds endpoint | Unit and integration tests |
| Monetisation hold race closed with an atomic conditional upsert (SEC-0014) | `wallet/.../monetisationHolds.service.go` | `TestConcurrentHealthEventsSettleOnTheNewestOne` (40 concurrent events) |
| Per-store invoice numbers taken under a row lock | `invoice_counters` with `ForUpdate` | Invoice concurrency integration test |
| Seller credit held 24h before payout | `SELLER_CREDIT_HOLD_PERIOD` in escrow | Escrow harness integration test |
| Escrow auto-release 3 days after delivery; disputes pause the timer | escrow config and disputes module | Escrow integration tests |
| The previous payment provider `authorization_code` never returned to devices, never logged, redacted from stored webhooks (SEC-0004, SEC-0008) | payments | Tests asserting absence in responses and logs |
| Duplicate bank account across stores blocked, with a trust advisory | payments onboarding | Integration test |
| Live keys refused outside production, test keys refused inside it | `payments.config.go:138` | Config unit test |

## 2. Before and after snapshot

| | Value |
|---|---|
| Tool | `security/database/moneySnapshot.sh` (read-only row counts and a per-row checksum of historical rows) and `moneySnapshotDiff.sh` |
| Before | `audit/snapshots/money-before-20261004T204202Z.*` |
| After | `audit/snapshots/money-after-20261004T204538Z.*` |
| Scope | 65 money tables across ledger, wallet, escrow, payments, subscriptions and creators |
| Rows hashed | 29,267 |
| Result | **All historical money rows unchanged.** No unexpected rows. |

## 3. Test results

| Suite | Result |
|---|---|
| apiSmoke `moneyJourneys` | 6/6 pass |
| apiSmoke `businessPlanFee` (1% escrow fee on Business) | Stale step removed; code verified correct. Full smoke not re-run after the edit |
| apiSmoke total (QA run) | 51/51 |
| Integration: payments, escrow, wallet, subscriptions, orders | Pass |
| Verification refunds: full refund, checkmark-share refund, trial card-check refund | Pass |
| RabbitMQ topology incl. `jobs-subscription-billing` | Loads |

## 4. Invariants

| Invariant | Status | How |
|---|---|---|
| Ledger history append-only | Verified | Triggers plus revokes; snapshot diff |
| Debits equal credits per journal entry | Verified by design and tests | Ledger posting validation and money journeys |
| A refund cannot reach the provider twice | Verified | Concurrent redelivery test |
| A renewal cannot charge twice for one period | Verified at unit level | Idempotency key per subscription and period; provider lookup before retry |
| No negative available balance from withdrawals | Covered by existing wallet tests | Not attacked live |
| A gift cannot debit twice / coins cannot mint twice | Covered by existing live and gift tests with idempotency keys | Not attacked live |
| Escrow cannot release twice | Covered by the escrow state machine and integration tests | Not attacked live |

## 5. Not run

The live adversarial money phases were not executed. The platform's safety system stopped them when the attack scripts and instructions were being written. These are:

- concurrent checkout, withdrawal, gift and coin purchase floods;
- forged and out-of-order financial webhooks against the running stack;
- timeout-then-retry and worker-crash chaos on money paths.

The controls above cover these paths by design and by tests, but they have not been attacked live. Run them, or have a penetration tester run them, with `security/regression/startSandboxStack.sh`, `security/authorization/preflight.sh` and the snapshot scripts, before launch.

## 6. Open money risks

- **SEC-0022:** the role that owns the ledger and escrow schemas can drop the append-only triggers. Move schema ownership to `svc_migrator` (already defined in `infra/aws`) and remove ownership from `svc_ledger`, `svc_escrow` and `svc_money`.
- **`svc_money`** is a member of the payments, wallet, ledger, escrow, subscriptions, creators and rewards roles. A compromise of goMoney reaches every money schema; see the blast radius section of `FINAL_SECURITY_AUDIT.md`.
- **Unconfirmed with the previous payment provider:** whether a refund reverses a subaccount split. It is handled as seller debt today.
- **Google Play billing notifications** need Pub/Sub OIDC verification before Play billing is enabled (SEC-0015).
