# Checkout, payment and payout flow plan

Owner rules from 2026-10-03. Zudomart is the merchant of record: every payment lands in Zudomart's provider account, the go-money ledger decides who is owed what, and buyers and sellers never choose or see the provider.

## 1. Rules

| Rule | Detail |
|---|---|
| Unverified store | Escrow is the only payment mode. |
| Verified store | The buyer picks Escrow or Pay directly. The store shows a verified badge and its success rate. |
| Verified means | Gold business checkmark after KYB. The rules are admin-configurable. |
| Success rate | completed ÷ (completed + seller-cancelled + seller-fault refunds + lost disputes), over a rolling 90 days. Shown once the store has at least 20 orders (admin setting). Computed on the server. |
| Escrow | Held until the buyer confirms delivery or the auto-release timer ends, then credited to the seller. |
| Direct | Credited to the seller when payment is confirmed, still subject to the 24-hour lock. |
| 24-hour lock | Only credits older than 24 hours are withdrawable. Newer credits are locked to cover refunds. |
| Payout run | Withdrawals are queued and paid in a daily batch every 24 hours. |
| Providers | Paystack is the primary. Flutterwave is an automatic fallback, added after launch. |
| Client UX | Native SDK first (Paystack React Native SDK; Inline JS on the web). The hosted payment URL is the fallback. |
| Visibility | Sellers see balances and payouts only. Buyers see "Pay" only. No provider names anywhere. |
| Digital goods in the apps | Coins, premium and boosts use Apple and Google in-app purchase. This plan covers marketplace orders. |

## 2. Backend (go-commerce + go-money)

**Ledger accounts per seller** (int64 minor units + currency):

- `seller:{id}:escrow`
- `seller:{id}:pending` (locked, has `availableAt`)
- `seller:{id}:available`
- `seller:{id}:reservedPayout`

**Platform accounts:** `platform:clearing:paystack`, `platform:clearing:flutterwave`, `platform:fees`, `platform:refunds`, `platform:sellerReserve`.

**Flow:**

1. **`POST /checkout` (go-commerce).**
   - Recompute each seller order group, including shipping.
   - Per group, read the store's verification status. Unverified forces `paymentMode=escrow`. Verified accepts `escrow | direct`.
   - Reject a `direct` request for an unverified store with a 422.
2. **`POST /payments/intents` (go-money).**
   - Uses an idempotency key and the server-computed amount.
   - Calls the provider adapter (`paystack`) to get an SDK access code plus a hosted URL as the fallback.
3. **Fallback.**
   - When Paystack initialisation fails (5xx, timeout, unsupported method), create the attempt on Flutterwave.
   - Only one live attempt is allowed per intent. A new attempt cancels the previous reference.
4. **Confirmation.**
   - Accepted only from a signature-verified webhook. A replay table blocks duplicates, and a server-side verify call to the provider follows.
   - The client SDK's "success" is never trusted.
5. **`payment.completed`, in one ledger transaction per group.**
   - Escrow group: clearing → `seller:escrow`.
   - Direct group: clearing → `seller:pending` (net of the fee into `platform:fees`), with `availableAt = now + 24h`.
6. **Escrow release** (on delivery confirmed or the auto-release timer): `seller:escrow` → `seller:pending` net of the fee, with `availableAt = now + 24h`.
7. **Maturing job** (every 5 minutes): moves credits with `pending` and `availableAt ≤ now` into `available`, then emits `sellerCredit.matured`.
8. **`POST /withdrawals`.**
   - Limited to the `available` balance, which moves to `reservedPayout`.
   - Requires a verified payout account (bank resolve), the KYC tier, and the quoted provider fee.
9. **Daily payout run.**
   - Batch transfers through Paystack Transfers, with Flutterwave as the fallback, each carrying a transfer reference.
   - On success: `reservedPayout` → clearing.
   - On failure: reverse to `available` and notify the seller.
10. **Refunds.**
    - Escrow orders: refund from `escrow`.
    - Direct orders: refund from `pending`, then `available`.
    - If the money was already withdrawn, the seller's balance goes negative and is recovered from future credits. A configurable rolling reserve applies to risky sellers.
11. **Daily reconciliation.** Match provider settlement reports against the clearing accounts and alert on mismatches.

**Events:** `payment.completed`, `payment.failed`, `escrow.released`, `sellerCredit.matured`, `withdrawal.requested`, `payout.completed`, `payout.failed`, `refund.created`.

**Risk:** Python scores direct payments and withdrawals. go-money policy decides allow, hold or review. Python is never in the critical path; on timeout, the policy default applies.

**Admin settings:**

- the hold period (24h)
- escrow auto-release days
- the success-rate minimum order count
- verification rules
- reserve percentages
- the provider order

## 3. Mobile (apps/mobile)

- **Product and store pages.**
  - Verified stores show a badge plus "98% success rate · 1.2k orders".
  - Unverified stores show "Protected by Zudomart Escrow".
- **Checkout, per seller group.**
  - Unverified: a fixed "Escrow (required for unverified stores)" line.
  - Verified: a radio choice between Escrow (recommended) and Pay directly, each with a one-line explanation.
- **Pay.** Uses the Paystack React Native SDK in-app. If it fails, the hosted URL opens in `expo-web-browser`. No provider choice is shown.
- **After paying.** Show "Confirming payment…" until the server confirms (realtime or push, with polling as a fallback). Then show the order with the escrow timeline or "Paid".
- **Seller area (lite).**
  - Balance cards for Available, Locked (with an "available at" time), In escrow, and Payout requested.
  - Withdraw, plus the time of the next payout run.

## 4. Web

- **Webapp checkout.** Same rules and UI. Paystack Inline JS, with the hosted redirect as the fallback. Confirmation happens on the server.
- **Seller dashboard, Finance.**
  - Balance cards: Available, Locked (24h), In escrow, Pending payout, and Negative balance.
  - A credits table with an available-at countdown.
  - The withdraw form, payout history, and CSV/PDF statements.
  - A verification status card that explains how getting verified unlocks direct payments.
- **Admin.** Pages for the settings above, a payout run monitor, reconciliation mismatches, and manual hold/release, all with an audit log.

## 5. Edge cases

- A webhook and a client callback both arrive: idempotency on the provider reference.
- Both providers succeed for one intent: auto-refund the second.
- A chargeback after withdrawal: negative balance plus the reserve.
- A store loses verification: new checkouts are forced to escrow; existing orders keep their mode.
- A multi-seller cart: one payment, split per group in the ledger, and each group has its own mode.

## 6. Open questions for the owner

- **Licensing.** Holding all funds and paying sellers out likely makes Zudomart a payment aggregator or escrow holder. That may need CBN licensing or a licensed partner (Paystack/Flutterwave subaccounts and splits can reduce exposure). Legal review is needed before launch.
- Escrow auto-release period.
- Whether direct-payment refunds need seller approval.
- Whether the Flutterwave fallback covers outages only, or also payment methods Paystack declines.

## 7. Build order

1. Ledger accounts, payment intents, the Paystack adapter and verified webhooks.
2. Checkout mode rules, escrow release and the 24-hour maturing job.
3. Withdrawals, the daily payout run and reconciliation.
4. The Flutterwave fallback adapter.
5. Mobile SDK checkout and webapp Inline checkout.
6. Seller dashboard Finance and the admin settings.

## Settlement model (owner direction, 2026-10-03)

- **Escrow orders:** buyers pay into Zudomart's Paystack account. On escrow release, plus the 24h lock, the seller's share goes out via **Paystack Transfers** to the seller's bank (transfer recipient), less commission.
- **Direct orders (verified stores):** **Paystack split payment** with the seller's subaccount at charge time, so the seller's share never sits in Zudomart's account.
- **To ask Paystack (preferred if supported):** can subaccount settlement be held or manual, so escrow orders also split at charge time and Paystack, not Zudomart, holds the funds until release?
- **Regulatory:** holding escrow funds in Zudomart's account may count as escrow or aggregation activity. Confirm with Paystack compliance and a Nigerian fintech lawyer before launch.
- **Ledger:** the states (inEscrow → locked → available → paidOut) are identical in both models; only the payout adapter differs (Transfers vs releasing a held subaccount settlement).
- **Escrow auto-release (owner, 2026-10-03):** 3 days after delivery (admin-configurable default). A dispute opened within the window pauses the timer.
