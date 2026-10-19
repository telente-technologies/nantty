# Fix Changelog — audit remediation tracker

Every code change made while fixing `docs/audit/frontend-backend-audit.md` is logged here with file, lines, audit ID, verification, and rollback notes. Investigations that concluded "no change needed" are logged too. Newest first.

## 2026-10-17 — ZM-016 (Part B): debt in the withdrawal tx, payout send claim, refund bank-destination guard, direct-payout gate, dead-lettered mismatches

**Audit:** ZM-016 (all bullets, in order)
**Changes:**
1. Resolve → claim → step split / payout readers not waiting for `CreateRecipient` — **re-validated at payout.**
   - `payments/.../customerValidation.service.go:115-132`: the new `latestConfirmedPayeeBankAccount` only returns a bank from a `createRecipient` job with status `succeeded`. BVN validation keeps using the latest job.
   - The direct-payout path uses it, so money only goes to a bank whose recipient creation completed.
   - The onboarding save itself is still three steps (not made single-transaction).
2. Direct-payout gate — `payments/.../walletPayouts.service.go:106-118`. `PrepareDirectSellerPayoutInTransaction` now requires:
   - `RequireVerificationLevel(VerificationLevelPayout)`;
   - no debt in any currency (`ErrDirectPayoutDebtOutstanding`, read inside the transaction);
   - the confirmed recipient bank above.
   - Not applied: the two withdrawal-only checks, `RequirePayoutAccountVerified` (Flutterwave NGN wallet) and `RequireSellerVerifiedForWithdrawal` (business verification). Direct payouts only run for non-NGN sales, and those checks failed the verified-Ghana-seller e2e (`seller payout after settlement: 0`). Listed for the owner.
   - Test: `payments.directPayoutGate_integration_test.go` (unverified, recipient not confirmed → refused; verified → prepared; verified with a USD seller debt → `ErrDirectPayoutDebtOutstanding`).
3. Debt-limit bypass.
   - Correction to the audit: the withdrawal transaction already refused any same-currency `SellerDebt`/`WalletDebt`/`CreatorEarningsDebt` (`walletBalances.service.go:26-28` via `providerWalletWithdrawals.service.go:24`).
   - The real gap was a debt in **another currency**. `providerWalletWithdrawals.service.go:27-31` now calls `payments/.../sellingEligibility.service.go:66-69` (`ReadUserDebtsInAnyCurrencyInTransaction`, inside the transaction). The seller-payout relay goes through the same handler.
   - Test: `wallet.withdrawalDebts_integration_test.go` "SellerDebtInAnotherCurrency…". Before: `201 … withdrawalStatus queued`; after: 409 `WALLET_DEBT_OUTSTANDING`.
4. Transfer double-send — new nullable `payout_transfers.send_claimed_at`:
   - schema `payoutTransfer.schema.go:47`; ent regenerated (8 files, `payouttransfer*`, `mutation.go`, `runtime.go`, `migrate/schema.go`);
   - migration `payments/src/migrations/20261017120000_payout_transfer_send_claim.{up,down}.sql`;
   - `atlas.sum` recomputed with `ariga.io/atlas/sql/sqltool` (the tool first reproduced the old `h1:aK47…` exactly).
   - `sellerPayouts.service.go:80-99` adds `claimAndSendPayoutToProvider`. It is a guarded `UPDATE … WHERE status='processing' AND provider_transfer_code='' AND (send_claimed_at IS NULL OR send_claimed_at < now−15m)`; only the claimant calls `CreateTransfer`. It is used by `SendPreparedSellerPayout` and by the reconciler resend (:196).
   - A crashed sender's claim expires after 15 minutes, and the provider dedups by reference.
   - Test: `wallet.payoutSendClaim_integration_test.go` (lost reply, then 5 concurrent senders). Before: `3 posts`; after: 1 post, then paid.
5. Bank-destination hijack — `payments/.../refundBankPayouts.service.go:99-120,122-131`.
   - The resolved account name must match the owner's KYC wallet name (`utils.NamesMatch`). A mismatch returns `REFUND_BANK_NAME_MISMATCH`; no KYC name returns `REFUND_BANK_NAME_UNVERIFIED`.
   - The `awaiting_bank_details → processing` flip is now a claim done **before** the provider call, with an affected-row check (0 → `REFUND_NOT_AWAITING_BANK_DETAILS`). It reverts on provider error.
   - Note: no provider implements `RefundBankDetailsProvider` today (`container/providerCapabilities.container.go:85-87`), so this path is dormant in production.
   - Test: `payments.refundBankDestination_integration_test.go` (stranger's account → 422 with 0 provider retries; 5 concurrent submits → 1 accepted, 1 provider retry). Before: `200 … CHUKWUEMEKA STRANGER`.
6. Card-verification double micro-refund — **not reproducible.**
   - A duplicate-paid intent skips the purpose handler (`paymentSettlement.service.go:173-175`), so only `duplicate-refund-<ref>` exists for it. `refundCardVerificationImmediately` creates no rows, and `SendPendingRefundToProvider` claims exactly once.
   - Regression lock: `payments.cardVerificationRefund_integration_test.go` "SecondChargeOnACardVerification…" (second charge on the same reference, webhook ×3 → refunds `[5000 5000]`).
7. Settlement credit.
   - Already guarded: row `FOR UPDATE` + `provider_settled_at` check (`providerSettlements.service.go:56-58`) + unique `journal_entries.reference` (`ledger/src/databases/schema/journalEntry.schema.go:39`).
   - Regression lock: `payments.providerSettlementOnce_integration_test.go` (4 concurrent runs + 1 → exactly 1 `settled:` entry).
   - Amount mismatch now dead-letters: `webhookProcessing.service.go:91-111` returns `webhookNeedsFinanceReview`, and `webhookInbox.service.go:87-89,127-129` sets `dead_lettered_at` + `last_error` immediately and raises the `webhookDeadLettered` alert. The provider still gets 200 and the intent is still recorded `failed`.
   - Test: `payments.webhookAmountMismatch_integration_test.go`. Before: `processed … dead <nil> error ""`.
8. Level-1 limit on a name-matched-only bank — **already the safe default.** `PAYOUT_BANK_VALIDATION` defaults to `required` (`payments/src/configs/payments.config.go:110`), so NG Level 1 needs a BVN-validated bank. The audit's "mode optional default" was wrong. Owner decision listed for when `optional` is enabled.
9. Clawback shortfall → seller debt — **already the safe default.** The shortfall is booked to the seller's `WalletDebt` with an alert and `wallet.debtRecorded` (`escrowWalletClawback.service.go:51,64-72`). The platform absorbs the returned processing fee. Owner decision listed.
**Verified (real output):**
- `go test -race -count=1 ./...`: payments → `ok zudomart/modules/payments 36.092s` (+8 subpackages ok); wallet → `ok zudomart/modules/wallet 66.808s` (+7 ok); orders → `ok zudomart/modules/orders 14.385s` (+10 ok).
- deployables → `ok …/flutterwaveFlows 143.709s`, `ok …/goCommerce 18.343s`.
- gateway `npx vitest run` → `Test Files 34 passed (34) Tests 1690 passed (1690)`.
- `gofmt -l` clean (generated excluded); `go vet ./...` clean.
**Rollback:**
- Code hunks revert independently.
- `send_claimed_at` rollback: run `20261017120000_payout_transfer_send_claim.down.sql`, then revert the schema, regenerate ent and delete the two migration files and restore `payments/src/migrations/atlas.sum` from git.
- Reverting the send claim re-opens concurrent double-send.
**Remaining in ZM-016:**
- The onboarding resolve/claim/step is still not single-transaction (mitigated at payout).
- The withdrawal level snapshot is still read outside the transaction (`requestWithdrawal.handler.go:28-31`).
- The 7-day settlement re-scan is noisy but harmless.
- Owner decisions below.
**Owner decisions (safest default implemented; not guessed):**
1. NG Level 1 with `PAYOUT_BANK_VALIDATION=optional`: the cap stays ₦500 000/day (`withdrawalLimits.config.go:19`) on a name-matched-only bank. Default is `required`.
2. Clawback shortfall: today it becomes seller wallet debt and the platform absorbs the returned processing fee. Should the seller bear the fee?
3. Undelivered escrow deadline (ZM-015): it is 30 days and **releases to the seller**, as the audit asked. The alternatives are auto-refund to the buyer, or staff review.
4. Direct payouts: should the business-verification gate that withdrawals use also apply to non-NGN direct-sale payouts? It is not applied, because it blocked verified Ghana sellers.
5. Refund to a bank account for buyers without a KYC wallet name: today it is refused (`REFUND_BANK_NAME_UNVERIFIED`). The provider capability is unimplemented anyway.

## 2026-10-17 — ZM-015 (Part B): dust rule, finishing partial refunds, deadline at hold, poison-row sweep, chargebacks after refunds

**Audit:** ZM-015 (all bullets, in order)
**Changes:**
1. Stale-price hold — **investigated; no code change needed.**
   - `order_groups.total_minor` and `checkouts.total_minor` are `Immutable()` (`orders/src/databases/schema/orderGroup.schema.go:42`, `checkout.schema.go:44`).
   - The payable is registered from `group.TotalMinor` (`orders/src/services/checkout.service.go:184-187`), and re-registering with another amount returns `CHECKOUT_PAYABLES_CONFLICT` (`payments/.../orderPayables.service.go:58`).
   - The hold refuses any payment that differs from the payable (`escrowHolding.service.go:45-47`). So the escrow amount, the order total and both refund caps are the same number by construction.
   - Regression lock: `escrow/escrow.payableFrozenAtCheckout_integration_test.go` (re-price → conflict; hold = checkout total; refund of total+1 → 422 `REFUND_DOES_NOT_MATCH_ORDER`).
2. Single dust rule, same base — `escrow/src/modules/escrows/models/escrowStateMachine.model.go:81-89` adds `CommissionKeptOnRemainder`: floor(heldCommission × remainder / amount) using `math/big`, so the dust goes to the seller. `escrowSettlement.service.go:114` uses it in place of `min(bps-on-remainder, held)`; the bps was itself rounded from the held commission.
   - The change can move 1 minor unit either way versus before, but there is now one deterministic rule.
   - Tests: model unit test (capped fee 2 000 on 1 000 000, remainder 333 333 → 666; MaxInt64 case) and `escrow.partialRefundDust_integration_test.go`. Before the fix: `got 2000, want 2001 of 3002`.
3. Partial-terminal trap.
   - `models/escrowStateMachine.model.go:32` allows `partiallyRefunded → refunded`.
   - `refundOrderGroup.handler.go:43` routes a refund of **exactly** `amount − refunded` to `RefundEscrowInTransaction`. Any other amount is still `ESCROW_ALREADY_PARTIALLY_REFUNDED` (the remaining-amount guard).
   - Wallet path: `escrowSettlement.service.go:123-132` and `escrowWalletClawback.service.go:37-48,79-80` reuse the clawback with `buyerOwed = amount − refunded`. The seller's kept share and the platform's kept commission/fee are returned, and the final status is `refunded`.
   - Direct path: `escrowDirectRefunds.service.go:20-40` refunds only `rest`. Before, it re-refunded the full amount to the card.
   - `partiallyRefunded → released` is answered as `AlreadySettled`, with no money moved (`escrowSettlement.service.go:38`): the remainder was released when the partial was made. So it is not a separate allowed transition.
   - Tests: `escrow.partialThenFullRefund_integration_test.go` (wrong amount refused; release → AlreadySettled; rest ×2 → `refunded` once; buyer holds 300 000, seller 0), `escrow.directSaleChargebacks_integration_test.go` "RefundingTheRest…". Before: `ESCROW_INVALID_STATE` and `provider refunds 200000`.
4. Never-delivered escrows locked forever.
   - `escrow/src/configs/escrow.config.go:18-29` adds `ESCROW_UNDELIVERED_RELEASE_PERIOD` (default 30 days, also the fallback for zero-valued settings).
   - `escrowWalletHolding.service.go:54-55` sets `AutoReleaseAt` at hold.
   - `escrowFulfilment.service.go:61-63,74` makes delivery reschedule it to delivery + inspection (extends a late delivery) and announces `escrow.releaseScheduled` once, on first delivery.
   - `escrowViews.service.go:41` keeps the buyer-facing estimate until delivery.
   - Test: `escrow.undeliveredAutoRelease_integration_test.go`. Before: `a never-delivered escrow must still have a deadline: <nil>`.
5. Head-of-line blocking — `escrowFulfilment.service.go:103-143`. The sweep skips a failing row (`IDNotIn(skipped)`), counts it in `escrowAutoReleaseDeadLetter` (payment alert metric with escrowId/orderId/error), and continues. It returns the joined errors and caps attempts at the batch size. Test: `escrow.autoReleasePoisonRow_integration_test.go` (legacy-custody row due first). Before: `released … 0 this escrow was held in the previous provider's pooled account`.
6. + 7. Status-guarded, idempotent chargeback posting with a cross-module refunded-already check, including partial-then-chargeback.
   - New `escrow/.../escrowWalletChargebackRecovery.service.go` is called from `escrowWalletChargebacks.service.go:48-49` for `refunded`/`partiallyRefunded`/`clawedBack`. Before, these statuses returned nil and the receivable stayed open.
   - Cross-module check: `payments/.../providerRefundTotals.service.go` reads `refunded_minor + refund_in_flight_minor` in the same transaction.
   - The withheld amount is split three ways:
     1. the part the provider already refunded to the card stays an open receivable (claim on the provider);
     2. the part refunded in-wallet is recovered from the buyer's wallet, with any shortfall going to the buyer's wallet debt;
     3. any unrecovered rest is recovered from the seller's kept share, and the platform returns its kept commission and fee.
   - Idempotent two ways: skipped if the held-path reference `chargeback-lost:<escrow>` exists (the refund came from the chargeback itself), and a per-dispute reference is checked before posting.
   - Tests: `escrow.walletChargebacksAfterRefunds_integration_test.go` (partial 100 000 then lost → buyer −100 000, seller −kept share, receivable 0, `refunded` 300 000, duplicate notice moves nothing; full wallet refund then lost → buyer −200 000 once; held-path recovered then duplicate → nothing). Before: `receivable 300000` and `receivable 200000, buyer 200000 -> 200000`.
**Verified (real output):**
- `go test -race -count=1 ./...` in `modules/escrow` → `ok zudomart/modules/escrow 66.900s`, `ok …/escrows/models 1.013s`.
- deployables `go test -race -count=1 ./flutterwaveFlows/ ./goCommerce/` → `ok …/flutterwaveFlows 143.709s`, `ok …/goCommerce 18.343s`.
- `gofmt -l` clean; `go vet ./...` clean.
**Rollback:** revert each hunk independently. The dust rule, transitions and deadline need no data migration. Rows held before this change keep `AutoReleaseAt = NULL` until delivered; to backfill, run `UPDATE escrows SET auto_release_at = created_at + interval '30 days' WHERE status = 'held' AND auto_release_at IS NULL` (owner call, not run).
**Remaining in ZM-015:**
- A *partial* chargeback on a **released** wallet escrow recovers the full amount and over-credits the receivable (`escrowWalletChargebacks.service.go:22-41` uses `AmountMinor`, not `disputed`). Found while testing; not fixed in this batch.
- The movement-failure rollback (`released` → `held`) can still disagree with the order service.
- The undelivered-deadline action is an owner decision (below).

## 2026-10-17 — Review corrections to the 2026-10-16 entries (ZM-016, ZM-015, ZM-001, ZM-002)

**Audit:** ZM-016 §8 (payout DELETE regression + seller path), ZM-015 §8 (chargeback guard), ZM-001 (provider amplification, no tests), ZM-002 (other pre-auth endpoints, OPTIONS open item)
**Changes (each with a regression test written first and seen failing):**
1. ZM-016 regression — removing a payout account was broken on web and mobile after the 10-16 `requireStepUp` change.
   - `apps/webapp/src/services/wallets.service.ts:27-28` — `removePayoutAccount(id, stepUpToken)` sends `X-Step-Up-Token` (same option `addPayoutAccount` uses).
   - `apps/webapp/src/app/(app)/wallet/payouts/page.tsx:48-54` — mutation wrapped in `withStepUp`; errors go through `showMutationError` (cancel → `StepUpCancelledError` is silent, like add/withdraw).
   - `apps/mobile/src/services/wallets.service.ts:13-14` and `apps/mobile/src/services/money/wallets.service.ts:13-14` — same header.
   - `apps/mobile/src/screens/wallet/payoutAccounts.screen.tsx:47-54` — `withStepUp` from `useStepUpPrompt` (already mounted for add); cancel shows no error toast.
   - Other callers checked: only the seller dashboard (already sends a token) and the gateway rate-limit rule. No smoke test calls DELETE.
   - Tests: `apps/webapp/src/services/wallets.service.test.ts` (fetch stub asserts the header), `apps/mobile/src/services/money/__tests__/wallets.service.test.ts` (both mobile services).
2. ZM-016 seller path enforced — the token the seller UI sent was never consumed.
   - `services/go/modules/orders/src/modules/sellerMoneyRelay/routes/sellerMoneyRelay.routes.go:45` — DELETE wrapped in `steppedUp`, like PATCH on :44.
   - `services/go/modules/wallet/src/modules/sellerMoney/routes/sellerMoney.routes.go:34` — internal DELETE wrapped in `stepUp` (single-use digest consumption), like :32-33.
   - `services/go/modules/wallet/wallet.sellerMoney_integration_test.go:99` — the in-progress-payout check now sends a fresh step-up.
   - Tests: `orders/.../sellerMoneyRelay/routes/sellerMoneyRelay.routes_test.go` (no step-up → 403 STEP_UP_REQUIRED and nothing relayed; access token as step-up → 403; valid → relayed with a 64-hex digest; PATCH+DELETE), `wallet/wallet.sellerPayoutAccountRemoval_integration_test.go` (none → 403; the add's digest → 401 STEP_UP_REUSED; fresh → removed; replayed → 401).
3. ZM-015 chargeback guard — `services/go/modules/escrow/src/modules/escrows/services/escrowDirectRefunds.service.go:52-95`.
   - `partiallyRefunded` now posts the unrecovered rest, `max(min(disputed, amount − refundedMinor), 0)`; `refunded`/`clawedBack` still skip.
   - The reference is per dispute (`chargeback-lost:<escrow>:<dispute>`) and checked first, so a duplicate notice is a no-op and a second dispute is not rejected as a reused reference.
   - **Extra bug found and fixed:** the lost entry credited `PlatformProviderBalance` even when payments had already moved that money to `chargebackReceivable` (`chargebackLedger.service.go:44-56`, `chargeback-withheld:<dispute>`). The provider balance was reduced twice and the receivable never closed. `chargebackWithholdingAccount` (:90-95) now credits the receivable when the withholding entry exists, and the provider balance only for providers that post no withholding.
   - Refund-then-chargeback keeps the withheld amount as an open receivable: the provider charged back a payment it had already refunded, so it is a claim against the provider. The seller is not charged twice.
   - Tests: `escrow/escrow.directSaleChargebacks_integration_test.go` — direct sale lost (seller debt 200 000, receivable 0, ledger provider-balance delta == fake provider delta); duplicate lost notice ×2 (no extra post); refund → lost (seller debt unchanged, receivable 200 000 open); partial 50 000 lost → second 150 000 lost (debt 200 000, receivable 0, escrow `refunded`).
4. ZM-001 provider amplification — `services/go/modules/payments/src/modules/checkoutPayments/commands/verifyOrderPayment/verifyOrderPayment.handler.go:17,52-57`.
   - The 50-row scan still returns an early `paid`.
   - Only the newest 3 pending intents are verified with the provider (`newestPendingIntentsVerifiedWithProvider`); older pending rows keep their DB status.
   - Tests (there were none): `payments/payments.verifyOrderPayment_integration_test.go` — succeeded oldest of 50 → `paid` with 0 `GET /transactions`; 20 pending → `pending` with 1-3 provider calls (was 20); newest failed → `failed`; wrong buyer → 404 with 0 calls; sibling order resolves its own payable (sibling-only intent ≠ paid, checkout intent = paid).
5. ZM-002 remaining pre-auth admin endpoints — `services/typescript/gateway/src/services/routeRateLimitPolicy.service.ts:7-8,14,16`.
   - `mfa/enroll/confirm` (takes a TOTP code) is now in `otp` (5/min/IP) with `mfa/verify`.
   - `login`, `refresh`, `accept-invitation`, `mfa/enroll/start` and `mfa/webauthn/options` are in `login` (10/min/IP).
   - Exact-path sets mirror `adminStaffGate.service.ts:4-12`; any other spelling still needs a staff token.
   - OPTIONS open item: a CORS preflight (with `Access-Control-Request-Method`) was already answered by `strictCors.middleware.ts`. A **bare** `OPTIONS /api/v1/admin/*` was proxied upstream with no staff token: the new test saw 200 from the fake upstream.
   - Go upstreams answer 405 and run no handler (probe output below). The TS upstreams were never checked.
   - `services/typescript/gateway/src/handlers/upstreamDispatch.handler.ts:72` now answers every OPTIONS on an admin path with an empty 204 at the edge, so no upstream sees it.
   - Tests: `services/typescript/gateway/tests/adminAuthRateLimits.routes.test.ts` (all 7 pre-auth paths bucketed ≤10/min and keyed by IP; `GET /me` and OPTIONS not bucketed), `tests/deepScanHardening.test.ts` "answers a bare admin OPTIONS at the edge…" (4 paths → 204, empty body, 0 forwarded).
6. Audit index corrected (ZM-001, ZM-002, ZM-015, ZM-016 rows and section headers).
**Verified (real output):**
- webapp `npx tsx --test src/services/wallets.service.test.ts` before the fix: `✖ … expected 'step-up-token-1' + actual undefined`; after: `ℹ pass 1 ℹ fail 0`; `tsc --noEmit` 0 errors.
- mobile jest before: `Tests: 2 failed, 2 total`; after: `Tests: 2 passed, 2 total`; `tsc --noEmit` 0 errors.
- relay route test before: `DELETE without a step-up must stop at the relay: 204 (relayed 1)`; after: `ok …/sellerMoneyRelay/routes`.
- wallet removal test before: `removing without a step-up must be refused: 204`; after: `ok zudomart/modules/wallet`.
- direct chargeback tests before: `the ledger moved the provider balance by -400000 while the provider moved it by -200000` and `… -250000 … -200000`; after: `ok zudomart/modules/escrow`.
- verify test before: `a retry storm must not fan out to the provider: 200 {"status":"pending"} after 20 provider calls`; after: `ok zudomart/modules/payments`.
- gateway rate-limit test before: `Tests 3 failed | 1 passed (4)`; OPTIONS test before: `expected 200 to be 204`; after: `Test Files 2 passed (2) Tests 22 passed (22)`.
- Go ServeMux OPTIONS probe: `/api/v1/admin/ledger/entries 405 GET, HEAD handlers run: 0` and `/api/v1/admin/withdrawals/w1/approve 405 POST handlers run: 0`.
**Rollback:**
- Web/mobile: revert the service and screen hunks. Removal stops working; the backend still enforces step-up.
- Relay/internal routes: reverting re-opens seller DELETE without step-up.
- Escrow: reverting re-opens the double provider-balance credit and the unjournaled partial chargebacks.
- Verify handler: reverting re-opens provider fan-out.
- Gateway: reverting re-opens the guest-limit admin endpoints and proxied bare OPTIONS.

## 2026-10-16 — ZM-019 (part): internal token on suspension-cases intake

**Audit:** ZM-019 breakage (bare `POST /api/v1/internal/suspension-cases`)
**Changes:**
1. `services/go/modules/moderation/src/modules/suspensionCases/routes/suspensionCases.routes.go:13-15` — intake wrapped in `middlewares.RequireInternalToken(container.Settings.IntakeToken)`, identical to the five sibling modules (copyrightClaims, accessSecurity, ipClaims, accountHealth, strikes). Unauthenticated suspension-case fabrication closed; gateway already 404s `/internal/*` externally (defense in depth).
**Verified:** `gofmt` clean; `go build ./src/modules/...` clean; `go test ./src/modules/suspensionCases/...` ok.
**Rollback:** revert (re-opens unauthenticated intake).
**Remaining in ZM-019 (queued):** order/battle stuck-state transitions; card-boost forfeit parity; ads open-redirect allowlist; host-middleware; signed attribution; promo locks.

## 2026-10-16 — ZM-015 (part): status guard on direct-sale chargeback posting

**Audit:** ZM-015 §8 (direct-sale double-post)
**Changes:**
1. `services/go/modules/escrow/src/modules/escrows/services/escrowDirectRefunds.service.go:44-47` — `recordLostChargebackOnDirectSale` now returns nil when `held.Status` is already `refunded`, `partiallyRefunded`, or `clawedBack` (mirrors the escrow-mode guard at `escrowWalletChargebacks.service.go:48-49`). Row is `ForUpdate`-locked by the caller (`escrowChargebacks.service.go:17`), so the guard is race-safe. `held`/`released` still post (released = seller owes; held/disputed = funds recovery). ~~Eliminates duplicate seller-debt + double buyer refund on duplicate `lost` webhooks after a prior refund.~~ **Correction (2026-10-17):** a duplicate `lost` webhook could never double-post — `recordProviderDispute` returns early when the stored dispute status is unchanged, and the ledger replays an identical reference (`ledgerPosting.service.go:56-60`, unique `journal_entries.reference`). The real scenario this guard closed was **refund-then-chargeback** (seller debited by the refund, then again by the lost chargeback). The `partiallyRefunded` skip in this entry was itself a bug (withheld money unjournaled) — superseded by the 2026-10-17 "review corrections" entry above.
**Verified:** `gofmt` clean; `go build ./modules/escrow/...` clean; `go test ./modules/escrow/ -run TestAChargebackFreezesEscrow` PASS (1.83s).
**Rollback:** revert guard (re-opens double-post on duplicate lost-chargeback after refund).
**Remaining in ZM-015 (queued):** payable-vs-live-total revalidation at hold; single dust rule; `partiallyRefunded` outgoing transitions; `AutoReleaseAt` at hold + skip-poison-row sweep; cross-module refunded-already check on chargeback posts.

## 2026-10-16 — ZM-007 (investigation, no code change): route-pattern + error-code mapping cleared

**Audit:** ZM-007
**Findings:**
1. `compilePathPattern` (`apps/admin/src/config/apiAccess.config.ts:22-30`) is CORRECT — verified `{disable|enable|…}` compiles to `(?:disable|enable|…)` and matches per-action paths while rejecting others (node one-liner). Original suspicion withdrawn.
2. Unmapped codes (`VALIDATION_FAILED`, `USERNAME_TAKEN`, `REALTIME_UNAVAILABLE`) do NOT degrade UX: frontends match `code` directly (`apps/webapp/src/app/(auth)/signup/page.tsx:80`, `apps/mobile/src/screens/auth/signUpUsername.screen.tsx:74`), and server copy passes through via `isServerWrittenError` (`packages/webKit/src/errorExperience/friendlyMessage.ts:5-11`, 4xx + kind unknown → verbatim message). Only kind-based branching (telemetry) is affected — accepted.
**Remaining in ZM-007 (queued):** seller `GET /api/v1/wallets/me` prefix gap; prod env checklist CI.

## 2026-10-16 — ZM-016 (part): step-up on payout-account DELETE + refund bank-destination + seller UI

**Audit:** ZM-016 §4 (bank-destination hijack) + §8 (payout DELETE without step-up)
**Changes:**
1. `services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:25` — `DELETE /api/v1/wallets/me/payout-accounts/{payoutAccountId}`: `requireUser` → `requireStepUp` (single-use step-up, same wrapper as POST payout-accounts/withdrawals on lines 24/28).
2. `services/go/modules/payments/src/modules/savedCards/routes/savedCards.routes.go:17` — `POST /api/v1/payments/refunds/{refundId}/bank-destination`: `requireUser` → `RequireUserAccessTokenAndSingleUseStepUp` (same wrapper as payout-onboarding bank save). Stolen session alone can no longer redirect a refund; name-match + verified-account binding still queued.
3. `apps/seller/src/components/wallet/payoutAccountsView.tsx:47-59` — `removePayoutAccount` now wraps DELETE in `withStepUp` + `stepUpHeaders(token)` (same pattern as `makeAccountTheDefault` above it); cancel swallows `StepUpCancelledError`. BFF already forwards `x-step-up-token` (`apps/seller/src/server/bffGateway.service.ts:21-22`).
**Verified:** `go build ./modules/wallet/... ./modules/payments/...` clean; `gofmt` clean; `go test ./modules/wallet/src/modules/payouts/...` ok; seller `tsc --noEmit` clean. Next.js guide `backend-for-frontend.md` read before UI edit per `apps/seller/AGENTS.md`.
**Rollback:** revert the 3 hunks; DELETE/bank-destination return to session-only (re-opens hijack — do not rollback without replacement control).
**Remaining in ZM-016 (queued):** seller-debt check inside withdrawal tx; version-guarded transfer send-claim; resolve+claim single-tx; affected-row guard on bank-destination flip; verification-mode default review.

## 2026-10-16 — ZM-001: verify window + early-paid short-circuit + own-row buyer check (with honesty correction)

**Audit:** ZM-001
**Changes:**
1. `services/go/modules/payments/src/modules/checkoutPayments/commands/verifyOrderPayment/verifyOrderPayment.handler.go:31-36` — intent query `Limit(10)` → `Limit(50)` (retry storm could push the succeeded intent off-window → false `pending` → double-pay).
2. Same file: early `paid` return when any DB-`succeeded` intent exists — zero provider `VerifyCharge` calls in the paid case (was up to 10 external calls per verify).
3. Same file: ownership check moved from `payables[0]` (oldest sibling) to the payable with `OrderId == command.OrderId`; query uses its `CheckoutId`.
4. Audit doc ZM-001 rewritten: original "false-paid" theory corrected — `OrderPayable.OrderID` uniqueness (`orderPayables.service.go:55,87`) means ANY-succeeded ⇒ paid is CORRECT semantics; realizable bugs were the reverse direction + edges above.
**Verified:** `gofmt` clean; `go build ./modules/payments/...` clean; `go vet` clean.
**Rollback:** revert handler hunks (re-opens double-pay-after-retry-storm + provider-call amplification).

## 2026-10-16 — ZM-013 (part): mock-guard log fix

**Audit:** ZM-013
**Changes:**
1. `scripts/checkNoMocksInBuild.mjs:86-99` — `checkMobile()` recorded `problems.length` before checks and only prints the `ok mobile…` line when nothing was queued (was unconditional, masking failures in CI logs). Exit-code gate unchanged (still 1 on problems).
**Verified:** `node scripts/checkNoMocksInBuild.mjs mobile` → ok lines + `exit=0`.
**Rollback:** revert (log-only; gate unaffected).
**Remaining in ZM-013 (queued):** `-race -count=1` for money packages in `test-go-workspace.sh`; dev-only local-auth stub flag; e2e-report PII scan.

## 2026-10-16 — ZM-002 (gateway part): admin passkey allowlist + admin login/OTP rate buckets

**Audit:** ZM-002 findings A + B
**Changes:**
1. `services/typescript/gateway/src/services/anonymousMutationGuard.service.ts:10` — allowlist regex gains `mfa/webauthn/options`, matching the staff-gate public set (`adminStaffGate.service.ts:4-12`). Pre-auth passkey `POST /api/v1/admin/auth/mfa/webauthn/options` (`{mfaToken}`, no Bearer) no longer 401s at edge.
2. `services/typescript/gateway/src/services/routeRateLimitPolicy.service.ts:10-12` — `POST /api/v1/admin/auth/login` → `login` bucket (10/min/IP, was generic guest 120/min); `POST /api/v1/admin/auth/mfa/verify` → `otp` bucket (5/min). Highest-privilege accounts now have the strongest edge block.
**Verified:** `pnpm vitest run tests/anonymousMutations.handler.test.ts tests/gatewayHardening.handler.test.ts` → 2 files, 1169 tests passed.
**Rollback:** revert both lines (re-opens 12x brute-force window + breaks admin passkey login).
**Remaining in ZM-002 (queued):** confirm upstream `OPTIONS /api/v1/admin/*` returns empty 204 with no side effects.
