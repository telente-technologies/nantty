# Payments-security handoff (2026-10-11, machine shutdown)

Nothing has been committed (owner rule). Some files may already sit in the batch commits ("cleanup batch …") that another process made. Full round 1–3 detail was in the scratchpad `reports/pay-fixes.md`; the essentials are below.

## Rounds 1–3: all DONE
- **PAY-1 (double charge from card plus wallet).**
  - The database enforces it: the payments migration `20261011093518_one_settlement_per_payment_subject` adds a unique index on (purpose, subject_id) where status is succeeded and the row isn't a duplicate. A dedupe step flags existing extras for review first.
  - `lateCharges.service.go`: a late card charge on a settled intent is recorded as a duplicate intent, then auto-refunded through Flutterwave. It also raises a reconciliation alert and sends `payment.duplicateRefunded` to the buyer.
  - The wallet path checks Flutterwave first and answers 409 `ALREADY_PAID`.
  - Tests: `deployables/flutterwaveFlows/flutterwaveDoublePay_test.go`.
- **PAY-2 (reusable step-up token).** Step-up tokens are single-use: sha256 of the token is stored in `step_up_consumptions`, and a replay gets 401 `STEP_UP_REUSED`.
  - Covers withdrawals, payout accounts, the bank change and the seller relay (`X-Step-Up-Token-Digest`).
  - Ads payments above `payments.limits.adsStepUpAbove` (₦50,000 default) spend from the same table.
- **PAY-3/PAY-8 (wallet daily limit).** The daily wallet limit is checked under the wallet lock, includes platform spends, and counts only succeeded intents net of refunds.
- **PAY-7 (uncapped currencies).** Withdrawals fail closed: a currency or level with no cap gets 422 `WITHDRAWAL_CURRENCY_NOT_AVAILABLE`.
- **MONEY-008 / MONEY-010.** Processing withdrawals are subtracted from the available amount; the checkout allocation has an overflow guard.
- **STF-07 (staff network policy).**
  - New goIdentity endpoint: `GET /api/v1/internal/admins/{id}/network-policy`.
  - `platform/staffauth` `RemoteNetworkPolicy` is wired into all Go staff middlewares, and the gateway has `StaffNetworkGate`.
  - Both fail closed with 503 in production.
- **DEP-01.** xmldom is overridden to `^0.8.15` in `pnpm-workspace.yaml`.
- **Wallet views.** The wallet summary and seller views read the Flutterwave wallet ledger through `ReadUserWalletBalances`.
- **Ads funding nets debt.** Spending past what's left after debts gets 409 `WALLET_DEBT_OUTSTANDING`, and withdrawals also refuse while seller or creator debt is outstanding.
- **Dead pre-PSA pooled code deleted.** Direct-sale refunds and chargebacks are kept, in escrow `escrowDirectRefunds.service.go`.
- **Smoke fixes.** Realtime token, E2EE chat devices, trust report search, ads L1, seller step-up, and the sitemap routes.

## Current follow-ups

### 1. Affiliate commissions go into the Flutterwave wallets: DONE
- **Lifecycle.** A commission is created `pending`.
  - `creators/.../affiliates/services/commissionWalletMoves.service.go` moves the money from the seller wallet to the creator wallet. The movement kind is `affiliateCommission` with reference `aff-<id>`, and the status goes `processing` → `paid`.
  - If the seller can't cover it, the commission stays pending. The `SettlePendingCommissions` worker retries every minute.
- **Refunds.**
  - Refund before payout: the commission is cancelled and no money moves.
  - Refund while the commission is in flight: the reversal is deferred (`applied=false`) and applied once the movement lands.
  - Refund after payout: a clawback moves money back from the creator (`affclaw-`). Any shortfall is booked as creator wallet debt, credited to the seller from the platform, with a `wallet.debtRecorded` event and an alert.
- **Migration.** creators `20261011145404_affiliate_commissions_in_flutterwave_wallets`.
- **Container.** The creators container now takes `Payments` (from `SharedPaymentGateway` in goMoney) instead of `Sellers`.
- **Reserves.** The ledger `sellerBalances` module is deleted, and its reserve policy moved to `ledger/src/modules/sellerReserves`.
  - Escrow now applies the reserve as a wallet hold (`escrowSellerReserves.service.go`, reference `<ref>:reserve`, held for `HoldFor`).
  - The ledger maturity worker is removed. The schema and table are kept; no migration was dropped.
- **Latent bug fixed.** Wallet movement subjects longer than 100 characters are now hashed (`movementSubject` in payments `walletSpending.service.go`). Before, they were truncated and the walletCredit stuck in `processing` (this also affected ads earnings refunds).
- **Creator view.** A creator's affiliation `salesCount` now counts pending, processing and paid commissions; `earned` counts only paid ones.
- **Tests.** `deployables/flutterwaveFlows/flutterwaveAffiliates_test.go` has 6 tests: one move only, waiting for seller funds, clawback plus debt, reversal in flight, refund inside escrow, and the long subject.

### 2. The 500 on `/api/v1/users/u_me/posts`: DONE
- `social/src/utils/accountParam.util.ts` accepts a UUID or `me`; an anonymous `me` gets 401, and anything else gets 400, not 500.
- Applied to the posts, follows and postNotifications params.
- Test: `social/tests/routes/accountParams.test.ts` (3 pass); tsc is clean.

### 3. The intelligence DLQ: DONE
- The rejected event was actually `content.saved`, not `post.created`. Social sends `actorId` and `postAuthorId`, which the contract allows.
- The fix is in `python/intelligence/src/events/contract_envelope_normalizer.py`. It now reads actorId/accountId/userId and authorId/postAuthorId, and a post of kind clip maps to clip.
- Tests: `tests/test_content_saved_contract.py` and `tests/modules/domain_events/test_social_engagement_translation.py`. 33 pass; ruff and mypy are clean.
- The old DLQ messages are still queued as evidence. Purge them before the DLQ smoke check can pass. One money message dates from 13:00 and belongs to another agent's run.

### 4. Contract fixtures in the smoke runner: PARTIAL (code done, not run)
- **Changes:**
  - `services/scripts/apiSmoke/tests/frontendContracts.smoke.test.ts`: the contract user is now a store owner (`createStoreWithProduct`) and an approved creator (`approveExistingUserAsCreator` under `withRelaxedCreatorThresholds`). Every call sends `x-store-id`.
  - Mock ids are swapped for real ones: u_me, u_21, post_1, post_missing, store_1 and prod_1. `scene_*` paths are skipped as mock-only.
  - `src/liveFixtures.util.ts`: `approveExistingUserAsCreator` was extracted from `registerApprovedCreator`.
- apiSmoke tsc is clean.
- **Missing:** this hasn't run against the stack yet. The stack couldn't start because goIdentity and goCommerce didn't build, due to other agents' in-flight files.
  - If a contract still fails, check whether the seller routes need `x-seller-store` instead of `x-store-id`.
  - Also check that the studio POST `/api/v1/lives` body with store_1/prod_1 passes validation once the ids are real.

## Withdrawal caps awaiting owner confirmation
`wallet/src/configs/withdrawalLimits.config.go` `DefaultWithdrawalDailyCaps` (minor units, per day; override with env):

| Currency | L1 | L2 |
|---|---|---|
| NGN | 500,000 | 5,000,000 |
| GHS | 5,000 | 50,000 |
| KES | 50,000 | 500,000 |
| ZAR | 10,000 | 100,000 |

The non-NGN figures are my guesses. Any other currency is refused until it has a cap.

## Operator step
Terraform now declares `ADMIN_INTERNAL_API_TOKEN` for go-live and the gateway, plus `ADMIN_INTERNAL_URL` for go-live and go-trust. The secret JSON ignores keys added later, so **copy go-identity's `ADMIN_INTERNAL_API_TOKEN` value into the go-live and gateway app secrets by hand.** Without it, staff routes return 503 in production (fail closed).

## Real test state (last runs, 2026-10-11)
- **Go tests.** `go test -p 1 -count=1` for creators, wallet, escrow, ledger, payments, ads and `deployables/flutterwaveFlows`:
  - everything passes except creators, which had 1 failure (the affiliation `earned` expectation);
  - after the view fix above, creators was rerun and passes (EXIT=0). The other packages were not rerun after that one-file change.
- **Python.** Intelligence pytest passes (33).
- **TypeScript.** social tsc and its tests pass; apiSmoke tsc is clean.
- **Not run this round:**
  - `-race` on the affiliates services and flow tests;
  - building goMoney, goTrust, goAds and goLive;
  - `go vet`;
  - atlas validate and lint for the creators migration;
  - the full apiSmoke.
- **Last full smoke (round 3):** 93 passed, 2 failed (DLQ leftovers; contract fixtures, now addressed), 4 skipped.

## Next steps
1. `cd services/go && go vet ./modules/creators/... ./modules/ledger/... ./modules/escrow/... ./deployables/flutterwaveFlows/...`
2. `go test -race -p 1 ./modules/creators/src/modules/affiliates/... ./modules/ledger/src/modules/sellerReserves/...`, and `-run Affiliate ./deployables/flutterwaveFlows/`.
3. Build goMoney, goTrust, goAds and goLive outside the repo. Once the profile-rule agent's files compile, build goIdentity and goCommerce too.
4. Run atlas `migrate validate` and `migrate lint` on `modules/creators/src/migrations` (the hash was already regenerated).
5. Purge the stale DLQ messages after noting them, then run the full apiSmoke: `backend.sh up`, vitest, then `backend.sh down`. Check that ports 8080 and 5432 are free first; port 3000 was held by a frontend dev server. Space the runs apart to avoid the OTP 429.
6. Update the PAY rows in `SECURITY_SCAN_2026-10-11.md` and `VERIFICATION_SUMMARY.md` for round 4: affiliates on wallets, the long-subject fix and the social 400.
7. Get the owner's confirmation on the withdrawal caps.
