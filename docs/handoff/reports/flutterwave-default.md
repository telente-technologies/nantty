# Flutterwave only: Paystack removed (2026-10-11)

Scope grew from "make Flutterwave the default" to "remove Paystack completely". Nothing committed by me (the owner's batch commits picked up some of these files while I worked).

## Go (services/go)
- Deleted the Paystack adapter (`payments/src/integrations/paystack*.go`, 14 files + testdata) and the fake Paystack (`paymentsTesting/fakePaystack*`). Shared helpers (`ProviderRequestError`, `truncate`, `firstNonEmptyString`) moved to `providerRequestError.integration.go`.
- Config: `PaystackSettings` gone. `PAYMENTS_PROVIDER` defaults to `flutterwave` and only accepts it. New neutral keys: `CHECKOUT_CHANNELS`, `PAYMENT_SPLIT_BEARER`, `CARD_VERIFICATION_AMOUNT_MINOR`, `PAYMENT_PLAN_CODES`. Production refuses to start without `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` (32+), `FLUTTERWAVE_MERCHANT_ID`; local dev may leave them empty; once a key is set, hash + merchant id are required everywhere.
- Containers register only Flutterwave. The webhook route answers 404 for any provider other than `flutterwave`; the Paystack IP allowlist is gone.
- Renames: wallet `PaystackTransferSettlement` -> `ProviderTransferSettlement` (`providerTransfer`), `paystackReconciliation.service.go` -> `providerMirrorReconciliation.service.go`, ledger `SellerSettlingByPaystackAccount` -> `SellerSettlingByProviderAccount` (code `settlingByProvider`), escrow metadata `providerProcessingFeeMinor`, `EstimatePaystackLocalFee` -> `EstimateLocalCheckoutFee` (now Flutterwave 1.4% capped at NGN 2,000; confirm against signed pricing).
- Real bugs fixed (Flutterwave-only exposed them): refunds by charge reference now resolve the Flutterwave transaction id via verify-by-reference; Flutterwave refund webhooks are normalised to `processed`/`failed` so the shared handler settles them (previously ignored); staff withdrawal detail reads the provider's cash account.
- Subscriptions: `web_paystack` channel dropped (migration `20261011090000` converts rows to `web_checkout`), labels say `flutterwave`. Ads: `ad_top_ups.provider` default -> `flutterwave` (new migration `20261011120000` backfills + sets default; old migration text updated too). Payments migration `20261003220702_paystack_…` renamed `…_provider_…` (golang-migrate keys on version only). atlas.sum rehashed; ent regenerated (no diff vs. manual edits).
- Reserved usernames: `paystack` dropped (owner wants zero mentions).
- `.env.example` rewritten for Flutterwave.
- Committed binary `deployables/goIdentity/goIdentity` (81 MB, Oct 4 build) contained the string; rebuilt from current source. It should be deleted from git and ignored.

## Tests
- `paymentsTesting` harness is Flutterwave-only (payout-subaccount mode, users schema, BVN consent onboarding, `SeedWalletAvailable`, `SettleCardPayments`, `FinishTransfer`, `RunMoneyWorkers`, `NonZeroBalances`). Fake gained refund delay/status, seeded charges, refund webhooks, declined cards.
- Converted payments, escrow, wallet, subscriptions, ads, creators, ledger and platform tests to Flutterwave semantics (card escrow locks in the buyer wallet after settlement; refunds after settlement unlock the wallet). Deleted two Paystack-split-only tests (escrow single-checkout split, direct-settlement mirror) and the Paystack-managed subscription webhook test; Flutterwave equivalents live in `deployables/flutterwaveFlows`.

## Sandbox, smoke, E2E
- `startSandboxStack.sh`: fake Paystack (18999) and `SANDBOX_PAYMENTS_PROVIDER` removed; always fake Flutterwave on 127.0.0.1:18998. `scripts/localStack/backend.sh` flag dropped.
- apiSmoke: `fakePaystack.util.ts` deleted; journeys (commerce, money, checkoutEdge, verificationRefund, subscriptionEdge, seller*, live, businessPlanFee) now pay/settle through the Flutterwave fake (`payCheckoutThroughProvider`, `settleTransferThroughProvider`, `readProviderState`); `onboardPayoutAccount` does the BVN consent; Flutterwave journey always runs; k6 webhook uses `verif-hash`.
- browserE2e: `paystack.helper.ts` deleted, ads spec uses `routeFlutterwaveToFake`, checkout hosts are Flutterwave only.

## Infra, CI, docs (fork)
- Terraform: go-money `PAYMENTS_PROVIDER=flutterwave`; Flutterwave secrets (key, hash, merchant id) wired; Paystack secret, variable, WAF IP set/rule and log-redaction entry removed; `terraform validate` passes for dev/staging/prod.
- CI smoke script posts to `/webhooks/flutterwave`. Docs rewritten; `flutterwaveMigration.md` has "Cutover status (2026-10-11)" (sole provider, no rollback, go-live needs live keys, IP whitelisting, Flutterwave's written answers) and no Paystack appendix.
- Security reports: "Paystack" replaced with "the previous payment provider"; VERIFICATION_SUMMARY.md and CHANGELOG carry "2026-10-11: the previous provider was removed; Flutterwave is the sole provider."

## Findings for follow-up (not fixed, money semantics)
1. Wallet summary (`/api/v1/wallets/me`), seller ledger views and debt netting still read the pooled `seller:*` accounts; payout-subaccount users' money lives in `wallet:*` accounts, so these views show 0 for them. The payments `/wallet/me` view is correct.
2. Funding ads from earnings ignores an outstanding `walletDebt` (withdrawals are blocked by it, ad funding is not).
3. Creator earnings run reports `Transferred` again while a movement is in flight (idempotent, report-only).
4. The non-wallet ("pooled") branches in payments/escrow/wallet are now unreachable in production (escrow keys on provider == flutterwave); they can be deleted.
5. `wallet.sellerMoney` integration test fails at the new step-up on payout-account add (another agent's in-flight change).

## Late fixes found by the sandbox smoke
- Escrow auto-release sweep: a card escrow still waiting for settlement blocked every later auto-release, because the sweep stopped at the first error. The sweep now skips unsettled buyer-wallet escrows. Regression test: `escrow.unsettledSweep_integration_test.go`; it fails without the fix.
- `WALLET_MOVEMENT_WORKER_INTERVAL` (default 30s) and `PAYMENTS_SETTLEMENT_POLL_INTERVAL` (default 1h) are now configurable. The relaxed sandbox uses 3s and 5s.
- The sandbox now waits for the fake Flutterwave before starting go-money. Starting go-money first produced connection errors that opened the provider circuit breaker.
- Smoke: `onboardPayoutAccount` sets NG, completes the BVN consent, waits for L1 and opens the wallet. `settleCardPaymentsFor` settles card payments into buyer wallets. The money journeys read the Flutterwave wallet view (`/payments/wallet/me`).

## Verification
- Go tests pass for payments, escrow, wallet, ledger, orders, ads, subscriptions, creators, platform and deployables/flutterwaveFlows. `-race` is clean on payments, escrow, wallet, subscriptions, ads, ledger and flutterwaveFlows.
- All 6 Go deployables build (goIdentity, goLive, goMoney, goTrust, goCommerce, goAds).
- Atlas `migrate validate` and `migrate lint` (community v1.3.0, git base main) are clean for every module.
- apiSmoke and browserE2e `tsc` are clean. The apps fork ran tsc for all 7 apps, the gateway/social/notifications/support tests, mobile jest, the app tests and `next build` in mock mode; the failures it saw are outside this work.
- Sandbox smoke on Flutterwave: all money journeys pass (commerce, money, checkoutEdge, verificationRefund, subscriptionEdge, sellerEdge, businessPlanFee, flutterwave, live payout and coins). The remaining full-suite failures are not about the payment provider:
  - realtime socket auth
  - E2EE device registration
  - route sweep and frontend contracts
  - ads requiring L1
  - seller team trail
  - the intelligence DLQ
  - a step-up on seller payout-account add, which is another agent's in-flight change
- `grep -rhoi paystack` prints 0, both with and without generated dirs and with binaries read as text.
