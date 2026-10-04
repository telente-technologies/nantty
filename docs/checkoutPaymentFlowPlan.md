# Checkout, payment and payout flow plan (Paystack)

> **Bachs and Anchor dropped; Paystack adopted (owner, 2026-10-03).** Paystack (https://paystack.com/docs) is the single payment provider: cards, bank transfer and USSD at checkout, Dedicated Virtual Accounts, transfers and payouts with account resolution, split payments with subaccounts, and multi-currency where Paystack supports it. Everything about Bachs is removed (section 12 lists the code). The short Anchor evaluation of the same day is abandoned and left no files.

Owner direction (fixed): **Zudomart holds as little user money as possible.** Prefer subaccount splits so seller money goes from Paystack to the seller's bank without passing through Zudomart. The escrow design is to be confirmed with Paystack (section 4).

Paystack facts, quotes, fees, go-live checklist and the open questions for Paystack: [`docs/integrations/paystack.md`](integrations/paystack.md). Claims cite that file's source keys (for example API-SUBACCOUNT). Anything Paystack does not document is **UNCONFIRMED — ask Paystack**. Not legal advice.

## 1. Rules

| Rule | Detail |
|---|---|
| Unverified store | Escrow is the only payment mode. |
| Verified store | The buyer picks Escrow or Pay directly. Verified = gold business checkmark after Zudomart KYB (admin-configurable). Zudomart's badge; Paystack does not verify sellers. |
| Success rate | completed ÷ (completed + seller-cancelled + seller-fault refunds + lost disputes), rolling 90 days, shown from 20 orders (admin setting). Server-computed. |
| Escrow | Release when the buyer confirms delivery, or automatically 3 days after delivery (admin-configurable). A dispute pauses the timer. |
| Direct | The seller's share is split to the seller's Paystack subaccount at charge time and settles to the seller's bank on Paystack's T+1 schedule. |
| 24-hour lock | Escrow releases are paid out only 24h after release. For direct payments, Paystack's T+1 settlement is the lock (Zudomart never holds that money). |
| Payout run | Escrow payouts and creator payouts are Paystack transfers in a daily batch, one transfer per payee per run. Only go-money calls the transfer API. |
| Provider | Paystack only, behind the `PaymentProvider` interfaces so another provider can be added later (no active work). |
| Client UX | Paystack checkout: Popup on web, the `authorization_url` in an in-app browser on mobile (section 7). Native SDKs later if needed. |
| Visibility | Sellers see balances and payouts. Buyers see "Pay". No provider names in UI copy. |
| Receipts | The account's verified email is sent to Paystack on every transaction; checkout never asks for an email (section 13). |
| Digital goods | Coins, gifts, premium, boosts and creator subscriptions: IAP in the apps, Paystack on the web (`architecture/payments.md`). Zudomart revenue in Zudomart's main account. |
| Saved cards | The device stores the Paystack `authorization_code` only (never card data). Subscriptions use authorizations Paystack holds (section 6.4). |
| Onboarding | Asynchronous: queued jobs with idempotent lookups, retries, dead letter, "Try again" (section 3). |

## 2. Paystack setup

### 2.1 Accounts

- **Zudomart main account** (the Paystack integration). Receives escrow fees, escrow (launch path E2), digital-goods revenue, subscription revenue and ads payments. Source of all transfers ("Only balance for now", API-TRANSFER).
- **Seller settlement subaccount** (`ACCT_`), one per seller with a verified bank account: `business_name`, `bank_code`, `account_number`, `settlement_schedule: auto` (T+1) (API-SUBACCOUNT). Receives direct-mode shares only.
- **Seller escrow subaccount** (option E1, only if Paystack confirms): same bank account, `settlement_schedule: manual` ("payout to the subaccount should only be made when requested", API-SUBACCOUNT).
- **Transfer recipient** (`RCP_`, type `nuban`) for every seller and creator (RECIPIENTS). Receives escrow payouts (E2) and creator payouts.
- No buyer DVA or wallet at launch (paystack.md section 8; owner decision).

### 2.2 Who pays the Paystack fee

**Fee policy (owner, 2026-10-03; docs/pricing.md §3.3): 0% commission on products.** Escrow groups pay an escrow fee of 1.5% of the group total including shipping (1% for Business-plan sellers), deducted from the seller payout at release; no fee on refunded amounts. Direct groups pay no Zudomart fee; the seller covers only Paystack's processing fee. Buyers pay nothing extra. Dynamic split with `bearer_type: account`: Zudomart pays Paystack, so each direct group's flat share is `groupTotal − allocatedPaystackFee` (the fee allocated across groups pro rata), which keeps the seller's share exact (MSPLIT). On escrow groups the allocated Paystack fee is also deducted from the payout (assumption, owner to confirm), and the escrow fee comes on top. Finance may switch to `all-proportional`. Fees: local 1.5% + NGN 100 (waived under NGN 2,500, capped NGN 2,000), international 3.9% + NGN 100, transfers NGN 10 / 25 / 50 by amount band (PRICING).

## 3. Seller and creator onboarding ("Get paid", plans.md §38)

Becoming a seller or creator unlocks everything that does not need Paystack. Direct payments and withdrawals wait for the payout account. Escrow sales are allowed before onboarding finishes; released money waits as "pending transfer".

1. **Who you are**: legal name, DOB, address, BVN or NIN; sellers choose "registered business". Stored by go-money; only the last 4 digits of the id are kept.
2. **Business** (registered sellers): CAC number, business type. Reviewed by Zudomart admin KYB for the verified badge.
3. **Bank**: bank list `GET /bank?currency=NGN`, live name with `GET /bank/resolve` (RESOLVE). The resolved name must match the legal name (`NAME_MISMATCH`).
4. **Verify your ID**: Paystack has no hosted ID check for payees. The step becomes an in-app document upload (media service) reviewed by Zudomart or a KYC vendor. It is needed for the verified badge and higher payout limits, not for the Paystack account.

Jobs (go-money, outbox → `jobs-payments` queue), each idempotent:

| Job | Paystack calls | Idempotency |
|---|---|---|
| `createRecipient` | `POST /transferrecipient` (nuban, metadata `zudomartUserId`) | look up the stored `recipient_code`, else list recipients and match account + metadata (Paystack documents no idempotency header) |
| `createSettlementSubaccount` (sellers) | `GET /subaccount` match, else `POST /subaccount`, then `PUT /subaccount/{code}` `settlement_schedule: auto` | match on `account_number` + `metadata.zudomartUserId` |
| `createEscrowSubaccount` (E1 only) | as above with `manual` | same |
| `validateBvn` (optional, if Paystack allows for payees) | `POST /customer/{code}/identification` | wait for `customeridentification.success` or `failed` |
| `movePendingTransfers` | none (queues payouts) | ledger references |

Five attempts with exponential backoff, then dead letter: `accountStatus = failed`, the user sees "Try again" (`POST payout-onboarding/me/retry`). States stay as in §38 (`pending_creation | documentsRequired | underReview | failed | actionRequired | verified`).

## 4. Where the money is (ledger mapping)

**The Zudomart ledger is the source of truth for what money means. Paystack numbers are evidence for reconciliation and are never shown as a wallet.**

| Zudomart state | Where the money is | Rule |
|---|---|---|
| Checkout pending | Nowhere yet | Paystack transaction initialized; stock reserved for the payment session timeout. |
| In escrow (E2) | Zudomart main balance | `charge.success` verified. Liability `seller:<id>:escrow:<escrowId>`. |
| In escrow (E1) | Seller escrow subaccount, unsettled at Paystack | Mirror only. Released by a settlement request (UNCONFIRMED). |
| Locked 24h | Main balance (E2) | Released; `availableAt = release + 24h`. |
| Pending transfer | Main balance | Released but the seller has no recipient yet. |
| Payout queued / in flight | Main balance → Paystack transfer `pending` | Resolved only by `transfer.success` or `transfer.failed`. |
| Paid out | Seller's bank | `transfer.success`. |
| Settling by Paystack (direct) | Seller settlement subaccount | Mirror only. `settled` when `GET /settlement?subaccount=` shows it (API-SETTLEMENT). |
| Seller debt | — | Refund or chargeback after the seller was paid. Recovered from later escrow payouts; direct mode is switched off while debt is open. |
| Escrow fee (escrow groups only) | Main balance, then Zudomart's bank (T+1) | Zudomart revenue. No commission exists. |

Ledger accounts: `platform:paystack:mainBalance` (asset, must equal escrow + locked + pending transfer + payouts in flight + creator payables + refunds in flight + unsettled Zudomart revenue), `revenue:escrowFees`, `expense:paystackFees`, `seller:<id>:processingFeesRecoverable`, `seller:<id>:escrow:*`, `seller:<id>:locked`, `seller:<id>:pendingTransfer`, `seller:<id>:reservedPayout`, `seller:<id>:debt`, memo `seller:<id>:settlingByPaystack`, `creator:<id>:earningsPayable`.

## 5. Escrow mechanics

Paystack documents no escrow product. Two designs:

- **E2 (launch path, documented, high confidence):** escrow groups are left out of the split, so their money stays in Zudomart's main balance. Release is a ledger move; after the 24h lock the payout run sends a transfer (`POST /transfer`, reference `po-<uuid>`) to the seller's recipient (TRANSFERS). Cost: one transfer fee per seller per run. Exposure: Zudomart controls escrowed money in its Paystack balance. Needs Paystack to keep a float in the balance instead of settling everything T+1 to Zudomart's bank (**UNCONFIRMED**, paystack.md Q3).
- **E1 (preferred if confirmed, low confidence today):** escrow groups split to the seller's escrow subaccount with `settlement_schedule: manual`. Paystack holds the money; release asks Paystack to settle. Blocked on: how a manual settlement is requested, whether it can be per order or amount, and how refunds work on unsettled subaccount funds (paystack.md Q1, Q4).

Rules either way: unverified stores always escrow; 3-day auto-release after delivery (`escrow.policy`); buyer disputes and `charge.dispute.create` pause the timer and freeze the group; 24h lock before payout; a rolling reserve for risky sellers is a ledger hold on payouts (E2) — not possible for direct splits, so risky sellers lose direct mode.

## 6. Flows

### 6.1 Checkout (one transaction per checkout)

1. `POST /checkout` (go-commerce): recompute each seller group (items, shipping, escrow fee for escrow groups; no commission). Unverified stores force `paymentMode=escrow`; direct for an unverified store is a 422. Verified stores need an active settlement subaccount for direct.
2. `POST /payments/intents` (go-money) with an idempotency key. Intent written first (tx1), then `POST /transaction/initialize` after commit (ACCEPT):
   - `email` = buyer's verified account email; `label` may show the username instead of the email (ACCEPT)
   - `amount` = checkout total in kobo (our int64 minor units, no conversion)
   - `reference` = `chk-<uuid>` (only `- . =` and alphanumerics)
   - `channels` = `card`, `bank`, `ussd`, `bank_transfer` (admin-configurable)
   - `callback_url` = universal link (section 7)
   - `metadata` = checkout id, order group ids and modes
   - `split` (only when at least one direct group): `{ type: "flat", bearer_type: "account", subaccounts: [{ subaccount: ACCT_seller, share: sellerNetKobo }] }`. `sellerNetKobo` = group total minus the allocated Paystack fee (no Zudomart fee on direct). Escrow groups are the remainder that stays with the main account (MSPLIT).
   Store `authorization_url`, `access_code` and the Paystack transaction id on the intent (tx2).
3. The buyer pays. **Confirmation only from a signature-verified `charge.success` webhook plus `GET /transaction/verify/{reference}`**; redirects and popup callbacks only trigger a status check (ACCEPT, VERIFY).
4. Checks before marking paid: `data.status = success`, amount, currency, reference, and the `split` object match the intent. Mismatch → `amount_mismatch`, no fulfilment, automatic refund of what was paid.
5. One ledger transaction: escrow groups → `escrow`; direct groups → `settlingByPaystack`; the escrow fee is booked to `revenue:escrowFees` at release (not at payment), so refunds before release never earn a fee; Paystack fee (`data.fees`) → `expense:paystackFees`; outbox `payment.succeeded`.
6. **Multi-seller cart = one payment.** A cart with escrow and direct groups is still one transaction; only direct groups appear in the split. This replaces the Bachs "one payment per seller" UX.
7. Stock reservation = payment session timeout (`PUT /integration/payment_session_timeout`, default 30 minutes). A success for an expired checkout is fulfilled if stock can still be reserved, else refunded.
8. Bank transfer at checkout: a wrong amount raises `bank.transfer.rejected` (PAYCH): intent `transfer_rejected`, buyer told the bank will be refunded, retry allowed. Refund timing for rejected transfers is **UNCONFIRMED — ask Paystack**. The transfer account lives 15 minutes to 8 hours; set it equal to the payment session timeout.

### 6.2 Escrow release and payout run

- Release (buyer confirms, or 3 days after delivery, no open dispute): ledger `escrow → locked24h` minus the escrow fee (1.5%, or 1% on Business, of the released amount incl. shipping) to `revenue:escrowFees` (E2), or settlement request (E1). Idempotent on the escrow id.
- Maturing job (every 5 minutes): `locked24h → payout queued` when `availableAt ≤ now` and the seller has a recipient, else `pendingTransfer`.
- Daily payout run: check `GET /balance` covers all queued payouts; one `POST /transfer` per seller (sum of matured releases), `reference = po-<uuid>` (lowercase, 16–100 characters), `source: balance`. Response `pending`; **paid only on `transfer.success`**; `transfer.failed` returns the amount to the queue with the reason; `transfer.reversed` reopens it and alerts ops (TRANSFERS). After a timeout, retry with the same reference or `GET /transfer/verify/{reference}`.
- OTP for transfers disabled on the dashboard; if a response still says `otp`, alert and stop the run (never auto-finalize).
- The transfer fee band (NGN 10 / 25 / 50) is shown in `GET payout-fees` and charged to Zudomart or deducted from the payout (finance decision; default deducted and shown).

### 6.3 Refunds

- `POST /refund` with the transaction reference and `amount` (partial allowed, never above the original; REFUNDS, API-REFUND). Events `refund.pending`, `refund.processing`, `refund.processed`, `refund.failed` ("Your account is credited with refund amount"). Processed refunds can take up to 10 business days to reach the buyer.
- Bank-transfer payments may need the buyer's account: a `needs-attention` refund is retried with `POST /refund/retry_with_customer_details/{id}` after the buyer enters an account in the app (never by email) (OPENAPI).
- Source of funds: the refund debits Zudomart's balance. Escrow groups: the escrow liability covers it. Direct groups: if the seller share already settled, book `seller:<id>:debt` and recover it from later escrow payouts; switch the store to escrow-only while debt is open. Whether Paystack reverses the subaccount share is **UNCONFIRMED** (paystack.md Q4).
- Whether Paystack returns its fee on refund: **UNCONFIRMED**. Which fees Zudomart absorbs is a finance decision.

### 6.4 Saved cards and subscriptions

- Saved card: after a card `charge.success` with `authorization.reusable = true`, go-money returns `authorization_code`, brand, last4 and expiry to the app once; the app stores them in Keychain or Keystore behind biometrics. The server keeps only `authorization.signature` (dedupe) and never persists the code (RECUR).
- Pay with a saved card: app unlocks the code, server calls `POST /transaction/charge_authorization` with the **account email** ("only the email used to create an authorization can be used to charge it", RECUR), amount, reference and the same split rules. `paused: true` → open the returned `authorization_url` for 2FA.
- If the account email changes, saved cards stop working; the app deletes them.
- Subscriptions (seller plans, Premium web, creator subscriptions, Gold and Black billing): Paystack Plans; `POST /subscription` with the Paystack-held authorization; trials = NGN 50–100 verification charge refunded at once, then `start_date` = trial end ("a free period", SUBS). Dunning from `invoice.payment_failed`, card update by manage link, cancellation by `POST /subscription/disable`. Web only; apps use IAP.

### 6.5 Disputes and chargebacks

- `charge.dispute.create`, `charge.dispute.remind`, `charge.dispute.resolve` (WEBHOOKS); daily `GET /dispute` poll as a backstop.
- On create: freeze the order group's escrow and pause the timer. Evidence through `POST /dispute/{id}/evidence` and the upload URL; decision through `PUT /dispute/{id}/resolve` (`merchant-accepted` with `refund_amount`, or `declined`) (OPENAPI).
- Zudomart's main account is presumably liable on every transaction, split or not (**UNCONFIRMED**, paystack.md Q5). A lost dispute on a settled direct group becomes seller debt.
- Zudomart's own buyer-seller disputes (item not as described) stay in Zudomart's flow and end in a refund or a release.

### 6.3a Payment mode choice at checkout (4 Oct 2026)

- `POST /api/v1/orders/checkout` accepts `paymentModes: [{ storeId, paymentMode: "escrow" | "direct" }]` (default escrow, max 20). go-commerce validates per seller group: `direct` for a store that is not verified (Gold) is rejected with 422 `DIRECT_PAYMENT_NOT_ALLOWED`; unknown values are 400 `VALIDATION_FAILED`. The mode is stored immutably on the order group (`order_groups.payment_mode`), sent to go-money's `RegisterCheckoutPayables` (`payment_mode`, `store_verified`), and part of the idempotency fingerprint.
- Order views (buyer and seller) expose `paymentMode`; the buyer store summary exposes `verified`. Cart seller groups expose `store.verified`, `rating`, `ratingCount`.
- Clients show the choice only for verified stores (success rate where available, else rating, plus the Gold badge): "Escrow protection (recommended)" vs "Pay directly". Unverified stores show "Protected by Zudomart Escrow". No fee lines for buyers.
- Direct orders have no escrow hold, so no in-app dispute button; refunds go through the seller or support (seller-initiated refund books a seller debt per 6.3). Store success rate: share of paid order groups of the last 90 days that completed with no refund (settled = completed, refunded, returned or cancelled after payment), kept in `orders.store_success_stats` (rebuilt every 6h by a sweep, env `ORDERS_SUCCESS_RATE_ROLLUP_INTERVAL`), shown only from 20 settled orders (else `successRate: null`, clients say "New store"). Served as `successRate` (0..1) on store, product, cart-group and order store summaries via the `StoreSuccessRates` port.

## 7. Clients

- **Web (webapp, seller dashboard, ads, Studio web):** Paystack Popup with the server-created `access_code`, or redirect to `authorization_url`. The client never sees the secret key (ACCEPT).
- **Mobile (Expo):** open `authorization_url` in an in-app browser (`expo-web-browser` `openAuthSessionAsync`), `callback_url` = universal link `https://zudomart.com/pay/return?ref=...`. Native Paystack SDKs (Android `paystack-ui`, iOS Swift Package, both driven by `access_code`, ACCEPT) need a dev client; evaluate later. Show "Confirming payment…" until the server confirms (realtime or push, polling fallback).
- **Checkout UI per seller group:** unverified: fixed escrow line; verified: Escrow (recommended) or Pay directly. One Pay button for the whole cart.
- **Seller area:** Available, Locked (with time), In escrow, Pending transfer, Settling to your bank (direct), Debt. Withdraw shows the next payout run and the transfer fee band.
- **Admin:** hold period, auto-release days, success-rate minimum, verification rules, reserve percentages, payout run monitor, reconciliation breaks, manual hold or release, audit log.

## 8. Platform revenue and creator money

### 8.1 Ads billing

Advertisers pay by Paystack checkout on the main account (web `ads.` app). Prefer postpaid or small top-ups; prepaid credit is money not yet earned (lawyer).

### 8.2 Coins

- Web coin packs: Paystack checkout on the main account. Apps: Apple and Google IAP; that money reaches Zudomart's bank through the stores.
- **Per-channel pricing (1 coin is not NGN 1):**
  1. Finance sets the target **net value per coin** `n` (illustration: NGN 10).
  2. For each channel pick the price tier `P`; `coins = floor(P × (1 − fee_c) ÷ n)`.
  3. `fee_c`: app_ios and app_android = store cut (15% small-business programmes, 30% standard; re-check), web = Paystack 1.5% + NGN 100 (waived under NGN 2,500, capped NGN 2,000) (PRICING).
  4. Illustration at `n = 10`, `P = 1,500`: 105 coins at 30%, 127 at 15%, 147 on web (fee 1.5% = NGN 22.50, NGN 100 waived).
  5. `CoinPack` has `channel` (`app_ios`, `app_android`, `web`) with its own price and coin count.
- **Steering:** in the apps never link to or mention the cheaper web price where store rules forbid it. Re-check Apple 3.1, Google Play payments policy and regional anti-steering rules before launch and each major release. Default: no steering anywhere.

### 8.3 Creator gift earnings

- Gifts are bought with coins, so the cash is Zudomart revenue; the creator share is `creator:<id>:earningsPayable`.
- Creators need only a transfer recipient (no subaccount; they do not sell).
- Payout run (daily or weekly, minimum per creator): `POST /transfer` from the main balance to the creator's recipient, `reference = cr-<uuid>`; resolved by `transfer.success` / `transfer.failed`.
- Funding gap: IAP proceeds land in Zudomart's bank. Treasury keeps the Paystack balance funded for payouts (top-up method **UNCONFIRMED**). Pay creators on a short cycle to limit how long Zudomart owes them.

## 9. Webhooks and idempotency

- Endpoint `POST /webhooks/paystack` (go-money, not re-serialised by the gateway). Allowlist 52.31.139.75, 52.49.173.169, 52.214.14.220 (WEBHOOKS).
- Verify `x-paystack-signature` = hex HMAC-SHA512 of the raw body with the **secret key**, constant-time compare, before parsing. During a secret-key rotation accept old and new keys briefly.
- Dedupe: no event id is documented, so `event_key = event + data.id + data.status` (transfers and refunds use `data.reference` / `data.id` + status). Unique `(provider, event_key)` in `webhook_events`.
- Persist raw, return 200 immediately, process in a job, re-fetch (`/transaction/verify`, `/transfer/verify`, `/refund/{id}`), post ledger and outbox in one transaction. Retries: live every 3 minutes ×4 then hourly for 72 hours; test hourly for 10 hours (WEBHOOKS).
- Subscribed events: `charge.success`, `bank.transfer.rejected`, `transfer.success|failed|reversed`, `refund.pending|processing|processed|failed`, `charge.dispute.create|remind|resolve`, `subscription.create|disable|not_renew|expiring_cards`, `invoice.create|update|payment_failed`, `customeridentification.success|failed`.
- Idempotency to Paystack: the transaction and transfer `reference` are the keys; retry with the same reference, verify by reference after timeouts. Formats `chk-`, `po-`, `cr-`, `rf-`, `sub-` + uuid. Postgres `idempotent_requests` remains the long-term guard.

## 10. Open questions

**For the owner:**

1. Buyer wallet funded by DVA: recommendation **no** at launch (coins only, refunds to source).
2. E2 (escrow in Zudomart's Paystack balance) at launch, moving to E1 if Paystack confirms manual settlement per order?
3. Who bears the Paystack fee on splits (default Zudomart) and the transfer fee on payouts (default deducted and shown).
4. Direct mode for sellers with open debt: off until repaid (recommended).

**For a Nigerian fintech lawyer:** whether E2 escrow (buyer money in Zudomart's Paystack balance until release) needs a licence or specific terms; prepaid ad credit and unspent coins as stored value; seller terms allowing debt recovery.

**For Paystack:** paystack.md section 11 (manual settlement API, escrow approval, balance float, refunds and disputes on splits, bank-transfer mismatches, KYC duties, limits, webhook event ids, mobile path, currencies).

## 11. Edge cases

- Webhook and callback both arrive: idempotent on reference and event key.
- Buyer pays twice for one checkout: refund the second transaction.
- Chargeback after a direct share settled: seller debt, store forced to escrow-only, recovered from later payouts.
- Store loses verification: new checkouts escrow-only; existing orders keep their mode.
- Subaccount deactivated or bank changed: direct mode off until the new subaccount is active; payouts wait for a new recipient.
- Paystack outage: hide Pay, keep browse and cart; sweepers verify pending intents and transfers by reference afterwards.
- Amount mismatch: no fulfilment, refund, admin notice.

## 12. Code changes needed

Status 2026-10-03: implemented in go-money (see `docs/integrations/paystack.md` §12 for what is built and what stays open). The previous Paystack adapter can be read from git (`git show 3f200f96:services/go/modules/payments/src/integrations/paystack.integration.go`) as a starting point, but it predates splits, transfers and the current interfaces.

### 12.1 Remove (every Bachs file and reference)

**go-money integrations (delete):**
- `services/go/modules/payments/src/integrations/bachsConnect.integration.go`, `bachsConnect.integration_test.go`
- `bachsConnectAccounts.integration.go`, `bachsConnectCheckout.integration.go`, `bachsConnectDisputesAndSubscriptions.integration.go`, `bachsConnectHttpClient.integration.go`, `bachsConnectMoneyMovement.integration.go`
- `bachsConnectSavedCards.integration.go`, `bachsConnectSavedCards.integration_test.go`
- `bachsConnectWebhooks.integration.go`, `bachsConnectWebhooks.integration_test.go`
- `bachsPayoutFeeSchedule.integration.go`, `bachsPayoutFeeSchedule.integration_test.go`
- `paymentsTesting/fakeBachs.util.go`, `fakeBachsMoney.util.go`, `fakeBachsRoutes.util.go`
- `testdata/bachs/` (all 13 fixtures: `createAccount`, `createCharge`, `createCheckoutSession`, `createCustomer`, `createPayout`, `createRefund`, `createTransfer`, `getBalances`, `getCheckoutSession.completed`, `insufficientBalance.error`, `listAccounts.empty`, `paymentMethodUnusable.error`, `savedPaymentMethodNotFound.error`)
- `services/go/modules/wallet/src/integrations/bachsManualPayoutSettlement.integration.go`

**go-money edits:**
- `payments/src/integrations/paymentsTesting/paymentsHarness.util.go`, `paymentsHarnessConnect.util.go`: wire the fake Paystack instead.
- `payments/src/integrations/appleAppStore.integration.go`: rename `maximumBachsResponseBytes`.
- `payments/src/configs/payments.config.go` and `payments.config_test.go`: drop `BACHS_*` settings and the `sk_live_`/`sk_sandbox_` check; add `PAYSTACK_*` (section 12.2).
- `payments/src/constants/payments.constant.go`: `ProviderBachs` → `ProviderPaystack = "paystack"`.
- `payments/src/container/payments.container.go`: `NewBachsProviderFromSettings` → Paystack provider.
- `payments/src/modules/checkoutPayments/validators/checkoutPayments.validator.go`, `wallet/src/modules/coins/validators/coins.validator.go`: provider `paystack`.
- `payments/src/modules/gateway/services/webhookProcessing.service.go`: saved-payment-method notification and provider constant.
- `payments/src/modules/gateway/models/payoutOnboarding.model_test.go`, `gateway/services/connectedAccountVerification.service_test.go`: Bachs requirement wording and states.
- `payments/payments.connectedAccounts_integration_test.go`, `payments.payoutOnboarding_integration_test.go`: rewrite for recipients and subaccounts.
- `wallet/src/configs/wallet.config.go`, `wallet/src/container/wallet.container.go`: `WALLET_SELLER_SETTLEMENT_ADAPTER` default `bachsManualPayout` → `paystackTransfer`.
- `wallet/wallet.creatorPayouts_integration_test.go`, `wallet.module_integration_test.go`: creator payouts by transfer from the main balance.
- `escrow/escrow.chargebacks_integration_test.go`, `escrow.checkoutModes_integration_test.go`, `escrow.harness_integration_test.go`, `escrow.module_integration_test.go`: escrow in main balance; direct via split.
- `ledger/src/modules/journal/services/ledgerPosting.service_integration_test.go`, `ledger/src/modules/journal/validators/journalEntry.validator_test.go`: account codes.
- `orders/src/services/sellerOrderPresenter.service.go`: provider wording.
- Migrations: the `*_bachs_connect_mirror` migrations in `payments`, `escrow`, `ledger`, `wallet` (`src/migrations`, listed in each `atlas.sum`) are already applied in dev. Do **not** edit them; add new forward migrations (section 12.2) and regenerate `atlas.sum` with Atlas.
- `services/go/.env.example`: remove `PAYMENTS_DEFAULT_PROVIDER=bachs`, `BACHS_API_BASE_URL`, `BACHS_SECRET_KEY`, `BACHS_WEBHOOK_SIGNING_SECRETS`, `BACHS_PAYOUT_FEE_OVERRIDES`, `BACHS_PAYOUT_FEE_SCHEDULE`, `BACHS_MAXIMUM_ATTEMPTS`, `BACHS_SUBSCRIPTION_PLAN_PRODUCTS`, `WALLET_SELLER_SETTLEMENT_ADAPTER=bachsManualPayout`.

**TypeScript services:**
- `services/typescript/gateway/tests/upstreamRoutes.routes.test.ts`: `/webhooks/bachs` and `/api/v1/payments/webhooks/bachs` → `/webhooks/paystack`; update the gateway route table to match.
- `services/typescript/notifications/tests/fixtures/eventFixtures.fixture.ts`: `provider: "bachs"` → `"paystack"`; drop the `wallet_top_up` example if the buyer wallet stays out.

**Frontends (copy and mocks):**
- `apps/webapp/src/app/(app)/coins/return/page.tsx`, `subscriptions/return/page.tsx`: "waiting for Bachs" → neutral copy ("Confirming your payment…"; no provider names).
- `apps/webapp/src/components/live/coinPurchaseDialog.tsx`, `components/actions/subscribeToCreatorDialog.tsx`: remove "Checkout opens on Bachs".
- `apps/webapp/src/mocks/coins.mock.ts`, `mocks/creatorSubscriptions.mock.ts`: `provider: "paystack"`, rename `MOCK_BACHS_RETURN_PATH`.
- `apps/seller/src/types/subscription.type.ts`: provider union → `"paystack" | null`.
- `apps/seller/src/components/settings/billingSettingsView.tsx`, `app/billing-checkout/demo/page.tsx`, `mocks/handlers/billingOffer.mock.ts`: provider label and demo copy.
- `apps/seller/apiContract.md` (free trials section): Paystack plan + verification charge + `start_date`.
- `apps/admin/src/components/configuration/rules/trustRulesEditors.tsx`: trial copy ("card saved on the web through Bachs").
- `apps/api/src/generated/prisma/internal/class.ts`: generated from the reference monolith schema; regenerate if the schema enum mentions Bachs (the monolith is never deployed).
- Mobile and Studio "Get paid" (plans.md §38): replace the hosted `document-link` step with in-app upload; payout fee from `GET payout-fees` (Paystack bands).

**Docs:** `services/README.md` (money section, dev command note), `services/zudojsStructure.md` (`bachsConnect` example), `docs/plans.md` (§38 title and wording, coin and subscription rows, billing bullets), `docs/CHANGELOG.md` (add an entry; keep history). Done in this change: `docs/integrations/bachs.md` deleted, `docs/integrations/paystack.md` added, this plan, `docs/architecture/{payments,marketplace,system,security,privacy,backend,devops,disaster-recovery}.md`, `docs/database/{schema,domains,transactions}.md`, `docs/backendPlan.md`.

### 12.2 Build

- **Paystack adapter** `payments/src/integrations/paystack*.integration.go` (files ≤ 300 lines each): HTTP client (bearer secret key, 15 s timeout, retries only on GET and on reference-keyed POSTs, JSON `status/message/data` envelope); `InitializeTransaction` (email, amount, reference, channels, callback, metadata, dynamic split), `VerifyTransaction`, `ChargeAuthorization`, `CreateRefund`, `RetryRefundWithCustomerDetails`, `ListBanks`, `ResolveAccount`, `CreateTransferRecipient`, `InitiateTransfer`, `VerifyTransfer`, `FetchBalance`, `CreateSubaccount`, `UpdateSubaccount` (settlement schedule), `ListSettlements`, `ListSettlementTransactions`, disputes (list, evidence, upload URL, resolve), plans and subscriptions (create, disable, manage link), `ValidateCustomer`, `UpdatePaymentSessionTimeout`.
- **Interfaces:** replace `ConnectedAccountProvider` (accounts, onboarding links, persons, manual schedule) with `PayeeProvider` (recipient, subaccount, resolve, validate); keep `PaymentProvider`, `MoneyMovementProvider` (transfers, balance), `DisputeProvider`, `SubscriptionProvider`, `SavedCardProvider` (charge authorization). No Paystack types leak into services.
- **Webhook** `POST /webhooks/paystack`: raw body, HMAC-SHA512 with the secret key (old + new during rotation), IP allowlist at the edge, `event_key` dedupe, store raw, 200 fast, job processing, re-fetch before posting.
- **Fake Paystack API and fixtures** for integration tests (`paymentsTesting/fakePaystack*.util.go`, `testdata/paystack/`), including split, transfer, refund `needs-attention`, dispute and subscription cases.
- **Schema (new forward migrations):** `payout_accounts` (user, role, `paystack_recipient_code`, `paystack_settlement_subaccount_code`, `paystack_escrow_subaccount_code`, bank summary, status, internal step, attempts, last error); drop use of `connected_accounts` Bachs columns (`capabilities`, `requirements`, `manual_schedule_confirmed`, `virtual_account`); `payment_intents` add `paystack_access_code`, `authorization_url`, `split_snapshot jsonb`; `withdrawals`/`payout_transfers` add `paystack_transfer_code`; `saved_card_signatures` (user, signature, brand, last4) without the authorization code.
- **Ledger:** replace the provider-held mirror (`sellerProviderHeld`, `providerHeld`) with section 4 accounts; per-subaccount settlement memo; main-balance reconciliation against `GET /balance` and `/balance/ledger`.
- **Escrow:** release → `locked24h` → payout queue (E2); E1 behind a feature flag once Paystack confirms.
- **Payout run** (`wallet`, `SellerSettlementAdapter = paystackTransfer`): one transfer per seller per run, balance check first, `transfer.*` resolution, reversal handling. Creator run reuses it.
- **Checkout:** one intent per checkout (resolves `schema.md` G6: `subject_id` = checkout id), split built from direct groups, session timeout aligned with stock reservation, verified account email.
- **Refunds:** refund API, `needs-attention` retry with buyer-entered account, seller debt for settled direct shares.
- **Disputes:** webhooks + daily poll, escrow freeze, evidence and resolve endpoints for admin.
- **Subscriptions and trials:** plans per product, verification charge + refund + `start_date`, dunning.
- **Saved cards:** return the authorization once, charge-authorization endpoint, signature dedupe.
- **Onboarding jobs:** section 3, with DLQ and retry endpoint.
- **Config:** `PAYSTACK_API_BASE_URL` (`https://api.paystack.co`), `PAYSTACK_SECRET_KEY` (must start `sk_test_` outside production and `sk_live_` in production), `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_PREVIOUS_SECRET_KEY` (rotation window), `PAYSTACK_WEBHOOK_IP_ALLOWLIST`, `PAYSTACK_PAYMENT_SESSION_TIMEOUT_SECONDS` (1800), `PAYSTACK_TRANSFER_FEE_BANDS` (`5000:1000;50000:2500;*:5000` in kobo), `PAYSTACK_CHECKOUT_CHANNELS`, `PAYSTACK_SPLIT_BEARER` (`account`), `ESCROW_MODE` (`e2` or `e1`), `PAYSTACK_PLAN_CODES`.
- **CI:** `.github/workflows/backend.yml` env names.

## 13. Customer email (owner, 2026-10-03)

Checkout never asks for an email. go-money sends the account's verified email (from go-identity) to Paystack on every transaction, and every receipt, refund notice and payment email goes to that address. If the account has no verified email, checkout is blocked with "Verify your email to continue". Clients never send an email field; the server ignores one if sent. Saved-card charges must use the same email that created the authorization.
