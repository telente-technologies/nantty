# Nantty Go Backend - Financial Correctness Audit Report

> Status update (2026-10-08): this report is not fully closed. Remediated and focused-tested: F1/F2 signed multiplication overflow, F3 withdrawal reservation subtraction underflow, F5 weighted-allocation intermediate overflow, F6 seller reserve overflow, and F11 validation against the supported operational currency set. The earlier auth fail-open issues and HTTP hardening are also addressed. MONEY-001's duplicate-transfer failure mode and INFRA-001's queue panic failure mode were verified as already guarded in current code, with regression tests added. All other financial findings remain open unless explicitly listed as fixed in `security/audit/reports/REMEDIATIONS.md`.

> Generated: 2026-10-08
> Scope: platform/money, modules/ledger, modules/wallet, modules/escrow, modules/orders, modules/subscriptions, modules/payments
> Severity: CRITICAL / HIGH / MEDIUM / LOW

---

## 1. EXECUTIVE SUMMARY

The Go backend has a solid cryptographic foundation (Argon2id, EdDSA, AES-GCM, constant-time comparisons, refresh token rotation) and demonstrates good architectural patterns (modular monolith, serializable transactions, double-entry ledger). However, there are **critical gaps in defense-in-depth**:

1. **Failing-open patterns** in session denylist and network policy checks allow attackers to bypass core security controls during infrastructure outages.
2. **Unvalidated forwarded headers** (X-Real-Ip, X-Forwarded-For) defeat IP-based access controls and audit logging integrity.
3. **Missing HTTP security infrastructure** (security headers, CORS, rate limiting, body size limits) leaves the API exposed to common attacks.
4. **Hardcoded placeholder secrets** in .env.example could be predictable in production if the file is copied without modification.

The fixes for the P0 items are straightforward and should be prioritized. The remaining findings represent defense-in-depth improvements that reduce the attack surface and improve forensic capabilities.


---

## 2. CRITICAL

### F1 - Integer Overflow in MultiplyByQuantity for Negative Amounts
File: services/go/platform/money/money.value.go:79-88
go
func (amount Money) MultiplyByQuantity(quantity int64) (Money, error) {
    if quantity == 0 || amount.AmountMinor == 0 {
        return ZeroMoneyInCurrency(amount.Currency), nil
    }
    product := amount.AmountMinor * quantity
    if product/quantity != amount.AmountMinor {
        return Money{}, ErrAmountOverflow
    }
    return Money{AmountMinor: product, Currency: amount.Currency}, nil
}

Risk: The overflow check product/quantity != amount.AmountMinor works for positive values but fails for negative amounts. For example, -10 * -3 = 30, and 30 / -3 = -10 (passes incorrectly). For large negative quantities, overflow can occur silently.

Fix: Use a proper overflow check that handles both signs: quantity > 0 && amount.AmountMinor > math.MaxInt64/quantity || quantity < 0 && amount.AmountMinor < math.MinInt64/quantity.

### F2 - Integer Overflow in ApplyBasisPointsRoundingHalfToEven for Negative Values
File: services/go/platform/money/money.value.go:90-96
go
func (amount Money) ApplyBasisPointsRoundingHalfToEven(basisPoints int64) (Money, error) {
    numerator := amount.AmountMinor * basisPoints
    if basisPoints != 0 && numerator/basisPoints != amount.AmountMinor {
        return Money{}, ErrAmountOverflow
    }
    return Money{AmountMinor: divideRoundingHalfToEven(numerator, 10_000), Currency: amount.Currency}, nil
}

Risk: Same overflow check bug for negative amount.AmountMinor or negative basisPoints.

Fix: Use a proper overflow check that handles both signs.

### F3 - Underflow Risk in Withdrawal Balance Check
File: services/go/modules/wallet/src/modules/payouts/services/withdrawals.service.go:69
go
if providerAvailableMinor-alreadyReserved < amountMinor {
    return dtos.WithdrawalDto{}, ErrInsufficientFunds
}

Risk: providerAvailableMinor - alreadyReserved can underflow if alreadyReserved > providerAvailableMinor (e.g., due to race condition or bug). This would wrap to a large positive int64, incorrectly passing the check and allowing an overdraw.

Fix: Check providerAvailableMinor < alreadyReserved + amountMinor using AddWithoutOverflow, or verify alreadyReserved <= providerAvailableMinor first.

### F4 - Double-Entry Violation in Partial Refund escrowSettlement
File: services/go/modules/escrow/src/modules/escrows/services/escrowSettlement.service.go:145
go
absorbedProcessingFee := refundMinor + sellerMinor + commissionKeptMinor - held.SellerAmountMinor - held.CommissionMinor
lines = paymentservices.AppendPositiveLine(lines, ledgermodels.RefundedProcessingFeesExpenseAccount(held.Currency), ledgermodels.Debit, absorbedProcessingFee)

Risk: absorbedProcessingFee can be negative (if refundMinor + sellerMinor + commissionKeptMinor < held.SellerAmountMinor + held.CommissionMinor). AppendPositiveLine skips amounts <= 0, so the journal entry would be unbalanced (debits != credits), violating double-entry accounting.

Fix: Ensure absorbedProcessingFee is never negative, or handle it as a separate credit line when negative.

### F5 - Integer Overflow in AllocateByWeightsWithoutLosingMinorUnits
File: services/go/platform/money/money.allocation.go:21-22
go
share := amount.AmountMinor / totalWeight * weight
share += amount.AmountMinor % totalWeight * weight / totalWeight

Risk: The intermediate calculation amount.AmountMinor % totalWeight * weight can overflow int64 for very large amounts. For example, if amountMinor = 9e18 and totalWeight = 1 and weight = 1e9, the multiplication overflows.

Fix: Use AddWithoutOverflow for intermediate calculations, or cap weights to prevent overflow.

### F6 - Integer Overflow in SellerReserveAmount
File: services/go/modules/ledger/src/modules/sellerBalances/services/sellerReserve.service.go:42
go
reserve := (availableMinor*min(reserveBps, 10_000) + 5_000) / 10_000

Risk: availableMinor * min(reserveBps, 10000) can overflow int64 for large balances (e.g., 9e18 * 10000 > MaxInt64). The result wraps around, producing incorrect reserve amount.

Fix: Use AddWithoutOverflow or check for overflow before multiplication.

### F7 - Escrow Split Loses or Creates Minor Units
File: services/go/modules/escrow/src/modules/escrows/models/escrowStateMachine.model.go:50
go
seller := amountMinor/10_000*sellerShareBps + amountMinor%10_000*sellerShareBps/10_000

Risk: Integer division truncates. For amountMinor=100, commissionBps=3333: seller = 0 + 100*6667/10000 = 66, commission = 34. But 6667/10000 = 66.67% of 100 = 66.67, so 33.33 commission. The split doesn't equal original amount: 66 + 34 = 100 (correct), but for amountMinor=101: seller = 66, commission = 35 = 101 (correct). However, this formula can lose or create minor units when amountMinor % 10000 * sellerShareBps overflows int64 for very large amounts.

Fix: Use money.AllocateByWeightsWithoutLosingMinorUnits which guarantees no minor unit loss.


---

## 3. HIGH

### F8 - Ignored Debt Settlement Return Value in Withdrawal Flow
File: services/go/modules/wallet/src/modules/payouts/services/withdrawals.service.go:85-95
go
if _, err := withdrawals.settleDebtsBeforeWithdrawal(ctx, transaction, userId, currency, created.ID.String()); err != nil {
    return dtos.WithdrawalDto{}, err
}
_, err = withdrawals.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
    Reference: "withdrawal-requested:" + created.ID.String(), Kind: "withdrawal.requested", Description: created.DestinationLabel,
    Metadata: map[string]any{"withdrawalId": created.ID.String()},
    Lines: []ledgermodels.JournalLineRequest{
        {Account: ledgermodels.SellerAvailableAccount(userId, currency), Direction: ledgermodels.Debit, AmountMinor: amountMinor},
        {Account: ledgermodels.SellerReservedPayoutAccount(userId, currency), Direction: ledgermodels.Credit, AmountMinor: amountMinor},
    },
})

Risk: settleDebtsBeforeWithdrawal returns a settled amount (debt repaid from available balance), but the withdrawal journal entry still debits the full amountMinor from SellerAvailableAccount. If debts were settled, the available balance was already reduced, so this double-debits the available account.

Fix: Use the returned settled amount to adjust the debit, or ensure the debt settlement doesn't reduce the available balance before the withdrawal journal entry.

### F9 - Escrow State Machine Allows Refund After Release (Clawback)
File: services/go/modules/escrow/src/modules/escrows/models/escrowStateMachine.model.go:26
go
var allowedEscrowTransitions = map[EscrowStatus][]EscrowStatus{
    EscrowHeld:     {EscrowReleased, EscrowRefunded, EscrowDisputed, EscrowPartiallyRefunded},
    EscrowDisputed: {EscrowReleased, EscrowRefunded, EscrowPartiallyRefunded, EscrowHeld},
    EscrowReleased: {EscrowRefunded},  // Can refund AFTER release
}

Risk: EscrowReleased -> EscrowRefunded is allowed. This means funds can be refunded after the seller already received them. The RefundEscrowInTransaction handles this by calling takeReleasedFundsBackForRefund which debits seller's debt/available. This is a business logic decision, but should be explicitly documented as "clawback".

Fix: Document this as a clawback mechanism. Consider adding a separate "clawback" status instead of reusing "refunded".

### F10 - Idempotency Bypass Risk in Idempotency Record
File: services/go/modules/ledger/src/utils/idempotencyRecord.util.go:21-34
go
result, err := transaction.ExecContext(ctx,
    "INSERT INTO "+store.table()+" (id, created_at, scope, key, request_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (scope, key) DO NOTHING",
    identifier, time.Now().UTC(), scope, key, requestHash)

Risk: Using uuid.NewV7() for ID with ON CONFLICT DO NOTHING means two concurrent requests with the same key both insert (different UUIDs), first wins, second gets "0 rows affected" and loads existing. But the existing record might have a different request_hash (race between insert and select). The check at line 68 in idempotentCommand.util.go catches this, but only after the transaction commits.

Fix: Use INSERT ... ON CONFLICT (scope, key) DO UPDATE SET request_hash = EXCLUDED.request_hash WHERE idempotent_requests.request_hash = EXCLUDED.request_hash, or lock the row with FOR UPDATE.

### F11 - Missing Currency Validation in Journal Entry Validator
File: services/go/modules/ledger/src/modules/journal/validators/journalEntry.validator.go:73-86
go
func IsValidCurrencyOrCoinUnit(currency string) bool {
    if currency == models.CoinUnit {
        return true
    }
    if len(currency) != 3 {
        return false
    }
    for _, character := range currency {
        if character < 'A' || character > 'Z' {
            return false
        }
    }
    return true
}

Risk: Only validates that the currency is a 3-letter uppercase string, but doesn't validate it's a supported ISO 4217 code. Downstream fee estimation assumes NGN/USD etc. An unsupported currency could be used in journal entries, causing reconciliation failures.

Fix: Maintain a list of supported currencies and reject unsupported ones.

### F12 - Race Condition in Auto-Release Timer Reset
File: services/go/modules/escrow/src/modules/escrows/services/escrowFulfilment.service.go:48-50
go
case "delivered":
    ...
    if held.Status == escrow.StatusHeld {
        update.SetAutoReleaseAt(occurredAt.Add(service.Container.Policy(ctx).AutoReleasePeriod))
    }

Risk: If RecordOrderFulfilment is called twice with "delivered" (e.g., webhook retry), the second call sees held.Status == escrow.StatusHeld (not yet updated to Released), and resets the auto-release timer. The ForUpdate() lock prevents concurrent modifications but not sequential retries.

Fix: Check if AutoReleaseAt is already set before resetting, or use a separate flag to track that delivery was already recorded.


---

## 4. MEDIUM

### F13 - Rounding Error in Fee Allocation at Checkout
File: services/go/modules/orders/src/models/checkoutAllocation.model.go:40-61 (inferred from audit)
go
func AllocateProRata(totalMinor int64, weights []int64) []int64 {
    ...
    for index, weight := range weights {
        parts[index] = totalMinor * max(weight, 0) / sum
        allocated += parts[index]
    }
    for index := 0; allocated < totalMinor; index = (index + 1) % len(parts) {
        if weights[index] > 0 {
            parts[index]++
            allocated++
        }
    }
    return parts
}

Risk: The remainder is distributed round-robin starting at index 0, favoring earlier sellers. For total=101, weights=[50,50]: parts=[50,50], allocated=100, remainder=1 -> parts=[51,50]. First seller gets extra. Should use deterministic but fair distribution (e.g., largest remainder method).

Fix: Use the largest remainder method for fair distribution of rounding remainders.

### F14 - Missing Transaction Atomicity in Refund Flow
File: services/go/modules/escrow/src/modules/escrows/services/escrowSettlement.service.go:194-198
go
func (service EscrowService) requestProviderRefund(...) (uuid.UUID, error) {
    refund, err := service.Container.Payments.RequestRefundInTransaction(ctx, transaction, paymentmodels.RefundRequest{...})
    return refund.RefundId, err
}

Risk: The refund request to provider happens inside the transaction, but SendRefundToProviderAfterCommit sends it after commit. If the process crashes between commit and send, the refund is recorded in DB but never sent to provider. The reconciliation job should catch this, but there's a window of inconsistency.

Fix: Use an outbox pattern for the provider refund request, or ensure the send happens before commit.

### F15 - Potential Negative Balance in Seller Debt Account
File: services/go/modules/ledger/src/modules/sellerBalances/services/sellerBalances.service.go:162-167
go
available, err := balances.Ledger.ReadAccountBalance(ctx, transaction, models.SellerAvailableAccount(debit.SellerUserId, debit.Currency))
if err != nil { return taken, err }
taken.FromAvailableMinor = min(remaining, max(available, 0))
taken.IntoDebtMinor = remaining - taken.FromAvailableMinor

Risk: max(available, 0) correctly treats negative available as 0. But taken.IntoDebtMinor can be positive even if seller has no debt capacity. The debt account (SellerDebtAccount) has AllowNegativeBalance: true (implied by usage), but there's no limit on how negative it can go.

Fix: Add a debt capacity limit, or reject withdrawals that would exceed a maximum debt amount.

### F16 - Off-by-One in Pagination Cursor
File: services/go/modules/ledger/src/modules/journal/services/accountBalances.service.go:121-130
go
rows, err := query.Order(ent.Desc(journalline.FieldID)).Limit(request.Limit + 1).All(ctx)
if err != nil { return nil, nil, err }
var nextCursor *uuid.UUID
if len(rows) > request.Limit {
    rows = rows[:request.Limit]
    last := rows[len(rows)-1].ID
    nextCursor = &last
}

Risk: Using ID for cursor pagination with DESC order means new entries inserted after the cursor won't appear in subsequent pages (correct for forward pagination). But Limit(limit + 1) with > limit check is correct. No off-by-one here, but the ID cursor assumes monotonic IDs (UUID v7 is time-ordered, so OK).

Fix: None needed - this is correctly implemented.

### F17 - Missing Validation on Currency in Checkout
File: services/go/modules/orders/src/services/checkoutAllocation.service.go:17-23 (inferred from audit)
go
currency := payables[0].Currency
for _, payable := range payables {
    if payable.Currency != currency {
        return nil, 0, "", fmt.Errorf("checkout %s mixes currencies", payable.CheckoutId)
    }

Risk: Only validates all payables have same currency, but doesn't validate it's a supported currency (ISO 4217). Downstream fee estimation assumes NGN/USD etc.

Fix: Validate the currency against a list of supported currencies.

### F18 - Provider Reconciliation Time Window
File: services/go/modules/ledger/src/modules/journal/services/providerReconciliation.service.go:95
go
const reconciliationSettlementLag = 72 * time.Hour

Risk: 72-hour lag window means settlements within 3 days of window boundary might be missed or double-counted. Should use provider's settlement date, not posted date, for matching.

Fix: Use the provider's settlement date for matching, not the posted date.

### F19 - No Test Coverage for Money Allocation
File: services/go/platform/money/money.allocation.go

Risk: The allocation function has no test file (money.allocation_test.go doesn't exist). Critical financial logic without tests.

Fix: Add comprehensive tests for AllocateByWeightsWithoutLosingMinorUnits, including edge cases for overflow, negative weights, and large amounts.

---

## Verification (2026-10-10)

Each row was checked against the current code on 2026-10-10. "Stage 1" means the Flutterwave phase 2 stage 1 work (`docs/integrations/flutterwaveMigration.md` §9). Payment, wallet, ledger, escrow and checkout code was not edited in this pass, because the Flutterwave stage 2 work is changing it. Open rows name that work as the owner.

| ID | Severity | Status | Evidence | Fix / test |
|---|---|---|---|---|
| F1 | Critical | Fixed | `platform/money/money.value.go:79-107` (`multiplyInt64WithoutOverflow` checks every sign combination) | `money.value_test.go` `TestMultiplyByQuantityRejectsOverflowForAllSigns` |
| F2 | Critical | Fixed | `money.value.go:87-93` uses the same checked multiply | `TestApplyBasisPointsRejectsOverflowForAllSigns` |
| F3 | Critical | Fixed | `modules/wallet/.../withdrawals.service.go:111-114` (`withdrawalFitsAvailableBalance` checks `alreadyReserved <= available` before subtracting) | wallet payouts service tests |
| F4 | Critical | Fixed | `modules/escrow/.../escrowSettlement.service.go:148-157`: a negative absorbed fee is posted as a credit line, so the entry stays balanced | escrow settlement tests; the ledger rejects unbalanced entries |
| F5 | Critical | Fixed | `platform/money/money.allocation.go` uses `math/big` for the products and the total weight | `TestAllocateByWeightsHandlesExtremeAmountsAndWeights` |
| F6 | Critical | Fixed | `modules/ledger/.../sellerReserve.service.go:55-66` splits the product (`available/10000*bps` plus a checked remainder product) | ledger sellerBalances tests |
| F7 | Critical | Fixed | `escrowStateMachine.model.go:52-54` calls `AllocateByWeightsWithoutLosingMinorUnits` | money allocation tests |
| F8 | High | False positive (no double debit); small UX gap remains open | `debtSettlement.service.go:44-66` only moves debt the seller really owes. The withdrawal entry then needs the full amount, and the ledger's non-negative guard returns `INSUFFICIENT_FUNDS` (`withdrawals.service.go:103`). No money is lost. The withdrawal quote does not subtract outstanding debt, so the seller gets a refusal instead of a correct quote | Open UX item for Flutterwave stage 2 (withdrawal quote, §3.4): subtract the outstanding debt in `QuoteWithdrawal` |
| F9 | High | Fixed now | `clawedBack` status exists. A refund after release of an escrowed order now ends in `clawedBack` on every path (card path in `escrowSettlement.service.go`, wallet paths in `escrowWalletClawback`/`escrowWalletChargebacks`). `released → refunded` stays only for direct orders, which are marked released at payment. Seller dashboard "refunded" filter includes clawed-back rows | Test: `escrow.module_integration_test.go` `TestCheckoutPaymentIsHeldInEscrowOnceAndReleasedAfterInspection` (refund after release → `clawedBack`, second refund no-op); `flutterwaveFlows` `TestChargebackAfterReleaseClawsBackFromTheSellerThenRecordsDebt`; state machine unit test |
| F10 | High | False positive | `ledger/src/utils/idempotencyRecord.util.go:26-45`: Postgres makes the second `INSERT … ON CONFLICT DO NOTHING` wait on the unique index until the first commits. The `SELECT` in the same transaction then loads the committed hash, and `idempotentCommand.util.go:68` rejects a different hash before `Execute` runs | — |
| F11 | High | Fixed | `journalEntry.validator.go:74-76` accepts only `viewerregion.IsSupportedCurrency` or COIN | `journalEntry.validator_test.go:35` ("unsupported currency") |
| F12 | High | Fixed (stage 1, B14) | Escrow is driven by the committed `orderGroup.delivered` outbox event, and the timer is set once | `escrow.fulfilmentEvents_integration_test.go` `TestDeliveredEventSetsTheReleaseTimerOnceEvenAcrossReplaysAndDisputes` |
| F13 | Medium | Fixed now | `AllocateProRata` uses the largest-remainder method with `math/big` products, so the leftover goes to the largest fractions (ties by order) and large totals cannot overflow | Test: `checkoutAllocation.model_test.go` `TestProRataAllocationGivesTheRemainderToTheLargestFractionsAndNeverOverflows` |
| F14 | Medium | Fixed (stage 1, B22) | `RequestRefundInTransaction` enqueues `paymentRefund.requested` in the same transaction, and a go-money consumer sends it | `TestRefundFailingThenRetriedReleasesCapacityAndPaysOnce` |
| F15 | Medium | Fixed now | Owner-approved debt limits by level, admin-configurable (`seller.debtLimits`, env fallback): NG ₦10,000 unverified, ₦50,000 payout-verified, ₦200,000 identity-verified or trusted (90+ days, no upheld disputes or lost chargebacks in 90 days); elsewhere 50 % converted with the currency module rates, with per-currency overrides. Above it, publish and checkout fail with `403 SELLER_DEBT_LIMIT`; fulfilment of existing orders is not gated (`sellingEligibility.service.go`) | Test: `payments.sellerDebtLimit_integration_test.go`, `ledger/src/loaders/moneyLimits.loader_test.go`, admin `moneyLimits.setting_test.go` |
| F16 | Medium | False positive | The report itself says the `Limit+1` cursor is correct, and UUIDv7 IDs are time-ordered | — |
| F17 | Medium | Fixed (stage 1, B21) | Checkout rejects currencies outside `ORDERS_CHECKOUT_CURRENCIES` (`orders.config.go:79`) | `checkoutCurrency.service_test.go` `TestCheckoutCurrencyMustBeAServerSupportedIsoCode` |
| F18 | Medium | Fixed (stage 1, B23) | `providerReconciliation.service.go:35,91` matches by reference and uses `SettlementGrace` | `TestReconciliationMatchesByReferenceWhateverThePostedDate` |
| F19 | Medium | Fixed | The allocation tests are in `platform/money/money.value_test.go:100-155` | `TestAllocateByWeightsKeepsEveryMinorUnit`, `…HandlesExtremeAmountsAndWeights` |

Counts: Fixed 13 (5 of them by stage 1) · False positive 3 (F8 has a UX gap) · Open 3 (F9, F13, F15; all design or low impact, owned by stage 2).
