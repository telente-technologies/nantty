# Payments-security fixes (2026-10-11)

Nothing was committed. Note that a separate batch-commit process has been committing working-tree files ("… batch 1"), and some of my files may already be in those commits.

## PAY-1 (High): double charge from card plus wallet. Fixed.
- **Enforced in the database.** Migration `payments/src/migrations/20261011093518_one_settlement_per_payment_subject` adds a partial unique index `payment_intents_one_settlement_per_subject` on (purpose, subject_id) WHERE status='succeeded' AND failure_reason NOT LIKE 'duplicate%'.
  - A dedupe step runs before the index. It flags any existing extra settlement as `duplicateSettlementNeedsReview`.
  - Atlas validate passes. Atlas lint passes with one MF101 warning, which the dedupe step covers.
- **New `lateCharges.service.go`.** A successful card charge that lands on an intent that is already succeeded or failed is handled the same way in every case: a late webhook, a webhook racing the wallet (inside `applyVerificationInTransaction`), or a charge after a failed attempt.
  - The charge is recorded as its own duplicate intent (`<ref>-late-<hash>`).
  - It is posted to the ledger and refunded through `refundDuplicatePaymentInTransaction`, using the outbox `paymentRefund.requested` and then the Flutterwave refund.
- **Finance alert.** `refundDuplicatePaymentInTransaction` now also opens a `duplicateSettlement` reconciliation case. That emits the `reconciliation.alertRaised` event and an alert metric.
- **Buyer notice.** The buyer is notified through the `payment.duplicateRefunded` event, via a new notifications mapping (in-app and push) plus its fixture.
- **Wallet path.**
  - It asks Flutterwave first. If the card already paid, it settles the card and returns 409 without debiting the wallet.
  - It refuses with 409 if another intent already settled the subject.
  - A unique-index violation maps to 409 `ALREADY_PAID` and rolls the debit back.
  - Because of this, a wallet payment can never be the duplicate, so no wallet credit-back path is needed.
- **Tests** (`deployables/flutterwaveFlows/flutterwaveDoublePay_test.go`):
  - the saved repro (`TestAuditCardChargeAfterWalletPaymentIsRefunded`);
  - card settled first;
  - card charged with the webhook still in flight;
  - a 6-round concurrent race, in which both winners occurred and the buyer was always charged exactly once;
  - the database refusing a second settled row.
  - The race test found a real gap, now fixed: a webhook that waited behind the wallet lock used to be dropped silently.

## PAY-2 (Medium): reusable user step-up token. Fixed.
- **Direct routes.** A new `RequireUserAccessTokenAndSingleUseStepUp` in ledger middlewares consumes sha256(token) in `step_up_consumptions`, keyed to "user:<id>" and method+path, for 15 minutes.
  - A replay gets 401 `STEP_UP_REUSED`; a store error gets 503.
  - It is applied to POST withdrawals, POST payout-accounts and PUT payout-onboarding/me/bank.
- **Seller relay.** The goCommerce seller relay now forwards `X-Step-Up-Token-Digest`.
  - go-money consumes that digest on the internal seller POST payouts, POST payout-accounts and PATCH payout-accounts routes, through `RequireRelayedSingleUseStepUp`.
  - Both paths share one table, so a token spent on one cannot be spent on the other.
- **Clients** already forget the cached token and prompt again on `STEP_UP_REUSED`.
- **Tests:**
  - `flutterwaveStepUpSingleUse_test.go`: a replay across withdrawal, payout account and bank change; 4 concurrent uses of one token, where exactly 1 is accepted.
  - `wallet.sellerMoney_integration_test.go`: updated.

## PAY-3 (Medium) and PAY-8 (Low). Fixed.
- **Atomic check.** `SpendWalletToPlatformInTransaction` (ads funding and boosts paid from balance) now calls `requireWithinWalletDailyLimit` under `LockUserWalletMoney`, so the limit check and the debit are atomic.
- **Counting.** `ReadWalletDailyLimit` adds today's `wallet.spentOnPlatform` outgoing credits, read through a new ledger `SumLinesOfKindPostedSince`.
- **PAY-8.** Only succeeded wallet intents count, net of `refunded_minor`.
- **Tests** (`flutterwaveWalletSpendLimit_test.go`): the shared limit, 1 kobo over refused, the exact edge allowed, the next-day reset, and 6 concurrent spends that stop exactly at the limit.
- **Not done:** the ads step-up threshold. Ads funding arrives as an internal call from goAds.

## MONEY-008 and MONEY-010 remainders. Fixed.
- **MONEY-008.** With `BlockWhileProcessing` off, processing withdrawals are now subtracted too. Test: `withdrawals.service_test.go`.
- **MONEY-010.** `AllocateCheckoutGroups` now has an overflow guard. Test: `checkoutAllocation.model_test.go`.

## STF-07 (Medium). Fixed.
- **New endpoint.** goIdentity serves `GET /api/v1/internal/admins/{staffId}/network-policy?address=` (X-Internal-Token; global plus per-staff allow-list).
- **Client.** `platform/staffauth`: `RemoteNetworkPolicy` caches answers for 30 s.
  - `NetworkGate` fails closed with 503 in production and staging when the policy is unconfigured or unreachable.
  - A refused address gets 403 `IP_NOT_ALLOWED`.
  - A process-wide gate is configured from env: `STAFF_NETWORK_POLICY_URL`, then `ADMIN_INTERNAL_URL`, then `MODERATION_USERS_INTERNAL_URL`, plus `ADMIN_INTERNAL_API_TOKEN`.
- **Wired into every Go staff middleware outside goIdentity:** moderation, ledger (covers wallet, payments, escrow, subscriptions and currency), catalog, orders, ads and live.
- **Tests:**
  - `platform/staffauth/remoteNetworkPolicy.client_test.go`;
  - `moderation/src/middlewares/staffPermission.middleware_test.go`;
  - `admin/adminAccountSecurity.integration_test.go`, which now also covers the new endpoint.
- **Infra follow-up:** go-live has neither `ADMIN_INTERNAL_URL` nor `ADMIN_INTERNAL_API_TOKEN` in Terraform, so its staff route returns 503 in production until the infra agent adds them.
- **Not covered:**
  - TS-service staff routes behind the gateway;
  - the catch-all staff audit outside goIdentity.

## xmldom (DEP-01). Fixed.
- **Who depended on it.** `pnpm why`: only `apps/mobile > @bacons/apple-targets > @bacons/xcode > @expo/plist@0.0.18` used 0.7.13.
- **Change.** Added the override `"@xmldom/xmldom@<0.8.15": "^0.8.15"` in pnpm-workspace.yaml and ran `pnpm install`. The lockfile now has 0.8.15 and 0.9.12 only. No other pnpm security setting was touched.
- **Audit.** `pnpm audit` no longer lists xmldom. The one remaining advisory is a moderate on sprintf-js with no patched release, and it is not mine.
- **Mobile checks:**
  - @expo/plist 0.0.18 round-trips a plist with 0.8.15;
  - `expo prebuild` (ios and android, run in a scratch copy) succeeds, including the widgets extension;
  - mobile tsc is clean;
  - jest: 85 suites, 431 tests pass.

## Other changes
- Removed the stale `Flutterwave.WebhookIpAllowlist` line in `flutterwaveHarness_test.go`, which had broken `go vet`.
- PAY-7 is still open. Failing closed would break harnesses that configure no caps.

## QA
- **Go tests.** `go test -p 1` passes for platform, ledger, payments, wallet, orders, moderation, catalog, ads, live, admin and deployables.
- **Race.** `-race` passes on the changed packages and on the new flow tests.
- **Builds.** All 6 deployables build, with output to the scratchpad `payfix-bin`. `go vet` passes on flutterwaveFlows.
- **Flutterwave smoke.** I started the stack (the ports were free) and ran `apiSmoke tests/flutterwaveJourney.smoke.test.ts`: 4/4 pass. The stack was stopped afterwards.
  - The first attempt failed only because the smoke env vars were missing.
  - `backend:down` also stopped valkey, rabbitmq, localstack and object-storage, because they were not running when `up` started.
- **TypeScript.** notifications tsc is clean; its template and dispatcher tests pass (124).
- **Reports updated.** The finding rows in `SECURITY_SCAN_2026-10-11.md` and `VERIFICATION_SUMMARY.md` now read "Fixed now", with test references.

# Round 2 (coordinator follow-ups)

## PAY-7. Fixed.
- The daily withdrawal cap now fails closed: a currency or level with no configured cap gets 422 `WITHDRAWAL_CURRENCY_NOT_AVAILABLE`.
- The defaults now cover NGN, GHS, KES and ZAR at L1 and L2. The non-NGN amounts are my picks; the owner should confirm them.
- Tests: `withdrawalLimits.config_test.go`; the flow test `TestAWithdrawalInACurrencyWithoutADailyCapIsRefused`.

## Ads step-up threshold. Done.
- **Setting.** `payments.limits` gets a new `adsStepUpAbove`, defaulting to ₦50,000. It must not exceed the ads top-up maximum, and older saved documents get the default.
  - Updated in: the admin Go validator, the admin UI panel and mock, and the TS contract test.
- **Enforcement.** goAds requires a user step-up above the threshold for fund-from-earnings and for boosts paid from balance or wallet.
  - It verifies the token, then spends it single-use through a new go-money endpoint, `POST /api/v1/internal/ads/step-up-consumptions`. That shares the `step_up_consumptions` table, so a token spent on a withdrawal can't confirm an ads payment.
- **Clients.**
  - Ads manager: a new BFF route `/bff/auth/step-up` (password), header forwarding, and no session refresh on `STEP_UP_REUSED`. The pay-from-balance dialog asks for the password when needed.
  - Webapp: boosts now use `withStepUpIfRequired`.
  - Mobile can't pay boosts from balance, so it needs no change.
- **Tests:**
  - `ads/adsStepUpThreshold.integration_test.go`: the edge amount, required, accepted, replay, another user's token, and boost.
  - The flow test `TestAStepUpSpentOnAWithdrawalCannotConfirmAnAdsPayment`.
  - The ads contract test `bffStepUp.test.ts`.

## TS staff routes. Done.
- The gateway's `StaffNetworkGate` checks every staff admin route after verifying the staff token, using the goIdentity network-policy endpoint (30 s cache).
- It fails closed with 503 in production. `ADMIN_INTERNAL_API_TOKEN` is required in production.
- Tests: `gateway/tests/staffNetworkPolicy.handler.test.ts`. The `deepScanHardening` tests were updated for the new production requirement. The gateway suite passes: 1651 tests.

## Infra. Done.
- go-live: `ADMIN_INTERNAL_URL` and the `ADMIN_INTERNAL_API_TOKEN` secret key.
- go-trust: `ADMIN_INTERNAL_URL`.
- gateway: the `ADMIN_INTERNAL_API_TOKEN` secret key.
- **Operators must** copy go-identity's token value into the go-live and gateway app secrets, because the secret JSON ignores keys added later.
- Checks: `fmt`, then `init -backend=false` and `validate` for dev, staging and prod, all pass. trivy shows only four existing findings (edge ALB, HTTP listener, logs bucket SSE, egress); none come from this change.

# Round 3 (coordinator queue)

## 1. Wallet summary and seller views read the Flutterwave wallet ledger.
- **Shared reader.** A new `ReadUserWalletBalances` in wallet payouts reads:
  - `wallet:{user}:available`, `depositHold` and `reservedPayout`;
  - walletDebt, sellerDebt and creatorDebt;
  - creator earnings;
  - the seller's held and disputed escrows from the escrow table;
  - the next hold release.
- **What now uses it:**
  - the `/api/v1/wallets/me` summary, keeping the same 7 lines;
  - its transactions list (wallet available and hold, with hold-release entries skipped);
  - the seller dashboard balances, transactions and statements;
  - the payments onboarding `pendingWithdrawable`.
- Studio and the ads manager read `/wallets/me`, so they are fixed too. The ads prepaid balance already read the right accounts.
- **Test:** `flutterwaveFlows/flutterwaveWalletSummary_test.go`. It seeds real activity (deposit, wallet purchase, escrow, release, hold release) and checks both the summary and the seller views.

## 2. Ads from earnings nets debt.
- `SpendWalletToPlatform` with `NetDebts` checks wallet, seller and creator debts under the wallet lock. Spending beyond spendable minus debt gets 409 `WALLET_DEBT_OUTSTANDING`.
- goAds now maps `WALLET_DEBT_OUTSTANDING` and `WALLET_DAILY_LIMIT` instead of reporting "upstream unavailable".
- Withdrawals now also refuse when seller or creator debt is outstanding, not only wallet debt.
- **Test:** `TestFundingAdsFromTheWalletNetsAnOutstandingDebtFirst`.

## 3. Dead pre-PSA code removed.
- **payments:**
  - Removed `UsesProviderWallets()` and all 12 of its branches: connected-account payouts, platform balance reads and the pooled eligibility paths.
- **wallet:**
  - Removed the pooled withdrawal debt settlement and `ReadOutstandingDebts`.
  - Removed the pooled branches of ads funding and refunds, and of creator earnings.
  - `payoutSourceAccount` no longer has a pooled branch.
- **escrow:**
  - Removed the pooled hold, release, refund, partial refund and chargeback bodies.
  - Legacy `sellerEscrow`-custody escrow-mode rows now get `ErrLegacyEscrowCustody`.
  - **Kept and moved:** direct sales are live and keep the `sellerEscrow` custody, so their refund (booked as seller debt) and lost-chargeback paths now live in `escrowDirectRefunds.service.go`.
- **ledger:** `UserCashAccountsForProvider` always returns wallet accounts.
- **Tests:** the pooled seeds in the wallet tests and the ledger unit test were updated. No migrations were touched.
- **Left on purpose:**
  - the ledger `sellerBalances` maturity module, which affiliates still use;
  - creators affiliate commissions and reversals, which still credit pooled `seller:*` accounts. That is a live money bug for its owner.

## 4. Smoke fixes.
- **Realtime:** the harness exchanges the access token for a `scope=realtime` token, and `backend.sh` now feeds realtime the sandbox `LIVE_INTERNAL_API_TOKEN`. It was empty before, so live topics were denied.
- **Secure chat:** a new `src/chatDevices.util.ts` registers real E2EE devices (Ed25519 identity plus a signed X25519 prekey) before the trust journey chats.
- **Trust report:** the list is searched by post id. The report did arrive, but it was beyond page 1 of a priority-sorted list.
- **Ads verification:** the ads owner is verified to L1 first.
- **Step-up:** the seller-dashboard journey sends a fresh step-up for payout-account add and for payouts.
- **Route sweep:** the catalog sitemap routes are now explicit (`products`, `stores`), matching the gateway.
- **Wallet contract:** `/payments/wallet/me` in the not_ready state returns zero balances. The webapp contract allows `wallet: null`, and both mocks were updated.
- **Full smoke result:** 93 passed, 4 skipped, 2 failed.
  - The DLQ check fails on leftovers. The money DLQ message dates from 13:00, before my runs; the 3 intelligence DLQ messages are post-created events rejected by the intelligence consumer.
  - The frontend-contract check fails on app contract fixtures that use non-UUID mock ids or need seller or creator status (webapp and studio). It also shows a real 500 on `/api/v1/users/u_me/posts` for a non-UUID id.
  - The downloads journey's file failed with an OTP 429 from running two suites back to back.

## QA, round 2 and 3
- **Go tests.** `go test -p 1` passes for payments, wallet, escrow, ledger, ads, catalog, creators, subscriptions, orders, admin, platform and flutterwaveFlows.
- **Race.** `-race` passes on the new packages and flow tests.
- **Builds.** goMoney, goTrust, goAds and goLive build.
  - goIdentity and goCommerce currently fail to build because of other agents' untracked in-flight files: `users/linkedProfileRegistry.service.go` and `catalog/listingHold.service.go`.
- **TypeScript.** tsc is clean for webapp, mobile, admin, ads, gateway, notifications and apiSmoke.
- **Contract tests.** The ads contracts pass (22) and the admin contracts pass (45).
- **Smoke.** The Flutterwave journey passes 4/4 after round 2. The stack was stopped after every run.
