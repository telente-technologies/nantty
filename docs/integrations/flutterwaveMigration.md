# Flutterwave migration: wallets, escrow and payouts

Phase 1 spec (research and design, no code changed). Written 2026-10-10. It replaces Paystack with Flutterwave in go-money. Each user's money sits in their own Flutterwave **payout subaccount (PSA)**. Our double-entry ledger stays the source of truth.

Related: [`smileId.md`](smileId.md). The licence analysis and CBN tiers, the Paystack reference and the checkout and payout rules that used to live in separate documents are Appendices A, B and C below.

**Not legal advice.** Fund ownership in a PSA is undocumented (section 9). Counsel must confirm the model before launch.

## 0. Sources and notation

Docs were read on 2026-10-10. The docs site serves raw Markdown and OpenAPI when you append `.md` to any page. `sitemap.xml` is empty; the indexes are `llms.txt` files.

| Key | URL |
|---|---|
| V3 index | https://developer.flutterwave.com/llms.txt |
| V4 index | https://developer.flutterwave.com/v4.0/llms.txt |
| V3D:x | `https://developer.flutterwave.com/docs/x` |
| V3R:x | `https://developer.flutterwave.com/reference/x` |
| V4D:x | `https://developer.flutterwave.com/v4.0.0/docs/x` |
| V4R:x | `https://developer.flutterwave.com/v4.0.0/reference/x` |
| PSA guide | [V3D:payout-subaccount](https://developer.flutterwave.com/docs/payout-subaccount) (2024 reference snapshot: https://web.archive.org/web/20241101222213/https://developer.flutterwave.com/reference/endpoints/payout-subaccounts/) |
| v3 status | Flutterwave Engineering, Jul 2025, edited Dec 2025: "There are currently no plans to deprecate v3" (https://dev.to/flutterwaveeng) |

Raw research notes are in the session scratchpad (`fw-v4-notes.md`, `fw-psa-v3-notes.md`). This document is the distilled version.

**Full API reference (updated from API reference 2026-10-10):** every page of the v3 reference (122), the v4 reference (58) and the v2 legacy reference (109) was read and condensed into [`flutterwaveApiReference.md`](flutterwaveApiReference.md), with a per-URL coverage checklist. `sitemap.xml` returns 404. Changes that reading caused in this spec carry the tag "(updated from API reference 2026-10-10)".

---

## 1. Key findings

1. **PSAs exist only in v3.** The v4 API ([V4 index](https://developer.flutterwave.com/v4.0/llms.txt)) has none of the following: payout subaccounts, split payments, payment plans, BVN consent, hosted checkout or bulk-transfer create. v4 "wallets" are only the merchant's own balances. Confirmed against all 58 v4 reference pages: there is also no v4 endpoint for identity (BVN/NIN), bills, OTP or FX trades, and v4 wallet-to-wallet transfers address another Flutterwave *merchant* by merchant id, never a PSA (updated from API reference 2026-10-10).
2. **PSAs hold NGN only.** The current guide says "These wallets only support payments in NGN" ([V3D:payout-subaccount](https://developer.flutterwave.com/docs/payout-subaccount)). The 2024–2025 versions listed NGN/USD/EUR/GBP. **GHS PSAs have never been documented.** The owner's per-user wallet model therefore works in Nigeria only today. The reference pages agree: the PSA balance, transactions and static-account endpoints each say the only possible currency is NGN ("Only NGN virtual accounts are currently supported"). `POST /payout-subaccounts` accepts any `country` (its sample uses `"US"`), but the wallet it creates is still NGN, so a non-NG PSA does not give a GHS, KES or ZAR wallet (updated from API reference 2026-10-10).
3. **The PSA funding webhook is v3-only.** You enable it under Settings → Webhooks → "Switch to V3 Webhooks" → "Enable payout subaccounts wallet funding hook". If an account must use v3-format webhooks for PSAs, it cannot also receive v4-format webhooks; the docs do not say whether both can be enabled at once.
4. **Webhook authentication.**
   - v3 sends `verif-hash`, which is the plain shared secret, not an HMAC ([V3D:webhooks](https://developer.flutterwave.com/docs/webhooks)).
   - v4 sends `flutterwave-signature` = base64 HMAC-SHA256 of the raw body ([V4D:webhooks](https://developer.flutterwave.com/v4.0.0/docs/webhooks)).
   - Because v3 signs nothing, a v3 webhook can only ever be a *hint*. Every credit is re-fetched from the API by id.
   - The v4 page contradicts itself: the HMAC is described and coded once, but its Node, PHP and Python framework samples compare `flutterwave-signature` to the raw secret. v4 webhooks are delivered through Svix (error `1602422 UNPROCESSABLE_SVIX_RESPONSE`). The v4 events are `charge.completed`, `order.authorization`, `transfer.disburse`, `transfer.reversal` and `refund.completed`, in an envelope `{webhook_id, timestamp, type, data}`. Both versions retry 3 times, 30 minutes apart, with a 60 s timeout (updated from API reference 2026-10-10).
5. **Funding reversals can hit our main balance.** "Your PSA wallet would be debited for the reversal but if the wallet balance isn't sufficient, your main F4B wallet is debited" ([V3D:payout-subaccount](https://developer.flutterwave.com/docs/payout-subaccount)).
6. **PSAs cannot be frozen.** There is no freeze or suspend endpoint. `DELETE` is asynchronous and irreversible, and the docs do not say what happens to a remaining balance. A freeze is therefore enforced in our ledger only.
7. **Transfers need setup in the dashboard.** You must enable "Transfer via API" and whitelist server IPs ([V3D:introduction-6](https://developer.flutterwave.com/docs/introduction-6); v4 errors `220400`/`221400` in [V4D:common-errors](https://developer.flutterwave.com/v4.0.0/docs/common-errors)). Generating new v3 keys invalidates the old ones immediately, with no overlap period ([V3D:authentication](https://developer.flutterwave.com/docs/authentication)).
8. **Identity checks in Flutterwave's API.**
   - **BVN:** a consent flow, `POST /v3/bvn/verifications`, behind an approval email. It returns name, DOB, NIN, phone, a face image and `watchlisted` ([V3D:bvn-verification](https://developer.flutterwave.com/docs/bvn-verification)).
   - **Bank account resolve:** NG and GH banks and GH mobile money.
   - **Not available:** no standalone NIN check in either version, and no Mono product in Flutterwave's docs. Mono (acquired 2026-01-05) "will continue to operate independently" (https://www.pymnts.com/acquisitions/2026/flutterwave-acquires-mono-to-boost-open-banking-offerings/).
   - **More detail (updated from API reference 2026-10-10):** BVN consent needs Flutterwave's approval by email. When the user consented to us before, `data.url` comes back `null` and the result can be fetched at once with the 25-character `reference`. v3 `POST /v3/accounts/resolve` covers NG banks, GH banks, GH mobile money and Flutterwave merchant ids. v4 `POST /banks/account-resolve` adds **UGX** banks, NG **USD** domiciliary accounts and **GBP** Confirmation of Payee, and `POST /wallets/account-resolve` returns a merchant's name. Neither version resolves KES or ZAR accounts, and no version has a Ghana Card, Kenyan ID or SA ID check. The v4 `national_identification` fields on transfer senders and recipients (EGP corridors) are data for the transfer, not a verification.
9. **Apple Pay and Google Pay.** The v3 pages for them were dropped from the current index. The types still appear in the v4 payment-method schema, but with no guide. No v3 reference page covers them either (updated from API reference 2026-10-10).
10. **v4 transport details (updated from API reference 2026-10-10).**
    - OAuth2 client credentials at `https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token`; tokens live 600 s.
    - Live base URL `https://f4bexperience.flutterwave.com`, sandbox `https://developersandbox-api.flutterwave.com`. The environments page's code sample swaps the two.
    - `X-Idempotency-Key` (12–255 alphanumeric) on every POST: a replay returns the first response with `X-Idempotency-Cache-Hit: true`. `X-Trace-Id` (12–255) for support.
    - Rate limit **500 requests/minute** (v3 publishes no number). A charge that times out returns `201` with `next_action: requires_requery`: wait 20 s, then GET.
11. **v4 virtual accounts are not wallets (updated from API reference 2026-10-10).** `POST /virtual-accounts` takes currency NGN, GHS, EGP, KES, MAD or ZAR; KES and EGP need the payer's `customer_account_number`. The guide still says "NGN and GHS only", and every VA is "linked to your settlement wallet", so the money lands pooled in our main balance. v3 VAs take NGN or GHS only. GHS VAs are for Ghana-registered merchants (others ask for activation) and fail on any under- or over-payment.
12. **Useful v3 details (updated from API reference 2026-10-10).**
    - `GET /v3/payout-subaccounts?nuban=` (also `?email=`, `?account_reference=`) finds a PSA by account number.
    - v3 `PUT /chargebacks/{id}` takes only `action` and `comment`. Evidence is uploaded with `POST /v3/upload_image`, which returns a hosted URL; the reference does not say how that URL is attached to the chargeback.
    - Standard checkout nests `session_duration` (max 1440 min) and `max_retry_attempt` inside `configuration`, and supports `link_expiration`.
    - `POST /v3/transfers` saves the destination as a dashboard beneficiary unless `skip_beneficiary_creation` is `1`.
    - `POST /v3/transfers/{id}/retries` re-sends a failed transfer under a new reference (`…_RETRY_n`).
    - `PUT /v3/tokens/{token}` changes the email, name and phone tied to a saved card token.

### v3 or v4: build on v3, behind our own interface

| Need | v3 | v4 |
|---|---|---|
| Per-user wallets (PSA) | yes | **no** |
| PSA funding webhook | yes, v3 format only | no |
| Hosted card checkout | Standard `POST /v3/payments` (PCI SAQ-A) | **none**; card data passes through our servers (SAQ-D, approval needed) |
| Tokenized renewals | `/v3/tokenized-charges` | `recurring: true` on a saved `pmd_` |
| BVN consent | yes | no |
| Transfers / bulk | yes / yes | yes / list only |
| Signed webhooks, idempotency header, OAuth | no | yes |
| Per-currency static accounts | NGN, GHS (pooled to main) | NGN, GHS, EGP, KES, MAD, ZAR in the schema (pooled to main) (updated from API reference 2026-10-10) |
| Account-name resolve | NG bank, GH bank, GH MoMo | NG (NGN and USD), GH, UG, GB (updated from API reference 2026-10-10) |
| Published rate limit | none | 500 requests/min (updated from API reference 2026-10-10) |

**Decision: build on v3.** Our core requirement (PSAs, their funding webhook, and hosted card checkout) exists only there, and v3 is not deprecated. v3 has three weaknesses, and each gets a compensating control:

- **Unsigned webhooks:** re-verify every webhook by id, and accept the webhook only as a trigger.
- **No idempotency header:** use a unique `tx_ref` / `reference` that we generate and store before the call, never retry a POST blindly, and on doubt query by reference.
- **Static key:** keep it in Secrets Manager, only go-money can read it, whitelist our IPs, and keep a rotation runbook.

Keep the adapter v4-ready (amounts in decimal major units, string ids). Move a flow to v4 when Flutterwave ships PSAs there or confirms that v3 and v4 webhooks can coexist (question Q1).

---

## 2. Target architecture

```
apps ──▶ gateway ──▶ go-money (payments, wallet, ledger, escrow, subscriptions, creators)
                          │  provider interfaces (payments/src/interfaces)
                          ├─ PaymentProvider   ─┐
                          ├─ WalletProvider    ─┼─ flutterwave adapter (v3) ──▶ api.flutterwave.com/v3
                          ├─ PayoutProvider    ─┤   paystack adapter (legacy, drain only)
                          └─ IdentityVerifier  ─┘   smileid adapter (L2, non-NG)
```

### 2.1 Interfaces

The current `FullPaymentProvider` (`payments/src/interfaces/paymentProvider.interface.go`) forces every provider to implement Paystack-shaped splits and subscriptions. Split it into capabilities and check each one with a type assertion.

```go
type PaymentProvider interface {           // collections
    Name() string
    SupportsCurrency(currency string) bool
    InitializeCharge(ctx, ChargeRequest) (ChargeSession, error)      // v3 POST /payments (Standard)
    VerifyCharge(ctx, ChargeLookup) (ChargeVerification, error)       // GET /transactions/{id}/verify, or verify_by_reference
    ChargeSavedCard(ctx, TokenChargeRequest) (ChargeVerification, error) // POST /tokenized-charges
    RefundCharge(ctx, RefundRequest) (RefundResult, error)            // POST /transactions/{id}/refund
    ListChargebacks(ctx, since time.Time) ([]ProviderDispute, error)  // GET /chargebacks
    RespondToChargeback(ctx, ChargebackResponse) error                // PUT /chargebacks/{id}
    VerifyWebhookAndParse(raw []byte, h http.Header) (WebhookNotification, error)
}

type WalletProvider interface {            // PSAs
    CreateWallet(ctx, WalletOwner) (ProviderWallet, error)            // POST /payout-subaccounts
    FetchWallet(ctx, accountRef string) (ProviderWallet, error)
    ListFundingAccounts(ctx, accountRef, currency string) ([]FundingAccount, error) // GET /{ref}/static-account?verbose=1
    ReadWalletBalance(ctx, accountRef, currency string) (ProviderBalance, error)    // GET /{ref}/balances
    ListWalletTransactions(ctx, accountRef string, from, to time.Time) ([]WalletLine, error)
    MoveBetweenWallets(ctx, WalletMove) (TransferResult, error)       // POST /transfers, account_bank=flutterwave
    ReverseFunding(ctx, fundingReference, currency string) (RefundResult, error) // POST /payout-subaccounts/refunds
    CloseWallet(ctx, accountRef string) error                         // DELETE; only after the balance is swept to 0
}

type PayoutProvider interface {            // money out to banks / mobile money
    CreatePayout(ctx, PayoutRequest) (TransferResult, error)          // POST /transfers (+debit_subaccount)
    FindPayoutByReference(ctx, reference string) (TransferResult, bool, error) // GET /transfers?reference=
    QuotePayoutFee(ctx, currency string, amountMinor int64, kind string) (int64, error) // GET /transfers/fee
    ReadPlatformBalances(ctx) ([]ProviderBalance, error)              // GET /balances
    ListSettlements(ctx, from, to time.Time) ([]ProviderSettlement, error)
}

type IdentityVerifier interface {
    StartBvnConsent(ctx, BvnConsentRequest) (ConsentSession, error)   // POST /bvn/verifications
    ReadBvnResult(ctx, reference string) (BvnIdentity, error)         // GET /bvn/verifications/{ref}
    ResolveBankAccount(ctx, country, bankCode, number string) (string, error) // POST /accounts/resolve
    ListBanks(ctx, country string) ([]Bank, error)
}
```

Adapter rules, all mandatory:

- **Amounts:** Flutterwave sends decimal **major** units, sometimes as strings with commas ("2,000.00"). Convert them with an exact decimal parser in `platform/money` (`ParseMajorUnits(text, currency) (int64, error)`): reject `float64`, reject more fractional digits than the currency's exponent, and reject negatives.
- **No automatic retry on any POST that moves money.** On a timeout or 5xx, the result is `pending`, and the outcome is found only by `GET` by reference (the MONEY-001 rule, kept). On 503, "Query the transfer status ... If there is no record ..., reinitiate" ([V3D:introduction-6](https://developer.flutterwave.com/docs/introduction-6)); reinitiate with the **same** reference.
- **Ids:** Flutterwave ids (`account_reference`, `barter_id`, transaction `id`, `flw_ref`, transfer `id`) are stored next to our ids, never used as our primary keys.
- **Base URL and keys** come from config, with test and live keys rejected in the wrong environment (as `payments.config.go:138` does for Paystack today).
- **No Flutterwave-side retries or saved state we did not ask for (updated from API reference 2026-10-10):**
  - send `skip_beneficiary_creation: 1` on every transfer, so the dashboard holds no reusable list of payout accounts;
  - never call `POST /transfers/{id}/retries` or bulk tokenized charges (both retry or re-send on Flutterwave's side, under references we did not create);
  - call `PUT /tokens/{token}` only from a staff-approved, audited command.
- **v3 errors are free text.** Decide on the HTTP status and a GET by reference, never on `message` (updated from API reference 2026-10-10).

### 2.2 Ledger mirror

The ledger is the truth for what money *means*. Flutterwave balances are evidence.

| Ledger account (new) | Kind | Mirrors |
|---|---|---|
| `asset:providerWallet:flutterwave:{accountRef}` (per currency) | asset | one PSA's Flutterwave balance |
| `asset:providerBalance:flutterwave` (exists: `PlatformProviderBalanceAccount`) | asset | our main F4B available balance |
| `asset:providerPending:flutterwave` | asset | collected but not yet settled to the F4B balance |
| `wallet:{user}:available` | liability | spendable and withdrawable |
| `wallet:{user}:depositHold` | liability | deposits inside the withdrawal cooldown |
| `wallet:{user}:reservedPayout` (exists as `SellerReservedPayoutAccount`) | liability | withdrawal in flight |
| `wallet:{user}:escrowLocked:{escrowId}` (replaces `seller:{user}:escrow:{escrowId}`) | liability | buyer money locked for an order, still in the buyer's own PSA |

**Invariant, per PSA:** the ledger asset `providerWallet:{ref}` equals the sum of the liability accounts mapped to that PSA, and both equal Flutterwave's `available_balance`. A buyer's PSA liabilities include their `escrowLocked:*` accounts. There is no platform escrow PSA (owner decision, §3.3).

### 2.3 Reconciliation

| When | What | Action on mismatch |
|---|---|---|
| Before every PSA debit (withdrawal, sweep, release) | `GET /{ref}/balances`: the PSA must hold at least our ledger amount | Refuse the debit, freeze the wallet in the ledger, alert |
| Every 15 min | Pending fundings, transfers and refunds older than 10 min: query by reference | Settle or fail them; alert after 1 h |
| Hourly | 5% random sample of active PSAs plus all PSAs with movement in the last hour: balance vs ledger | Alert. Credit nothing automatically |
| Daily 02:00 WAT | Every PSA: `GET /{ref}/transactions` for the previous day, matched line by line to journal entries by provider reference; `GET /v3/balances` vs `providerBalance`; `GET /v3/settlements` vs `providerPending` | Write a `reconciliation_runs` row; any unmatched line creates a case, pages on-call, and freezes the affected wallet |
| Daily | `GET /v3/chargebacks?status=initiated`, `GET /v3/payout-subaccounts/refunds` | Create dispute records (section 3.8) |

Reconciliation never credits a user automatically. It opens a case, and staff resolve it with a compensating command through the owning module (fixing MONEY-002).

---

## 3. Money flows

Shared rules for every flow:

- **Each step is a row first.** The intent or movement row, with our reference, is committed before the provider call.
- **Provider calls run from the outbox worker** after commit.
- **Each provider result is applied in a `SERIALIZABLE` money transaction** that locks the wallet row(s) `FOR UPDATE` in a fixed order (by account ref).

References are `{prefix}-{uuidv7 without hyphens}`, unique in the DB and ≤42 characters.

### 3.1 Deposit to a PSA, then the fee sweep (NG)

1. **Create the wallet (once, at L1; see section 5).**
   - Call `POST /v3/payout-subaccounts` with `{account_name: <BVN name>, email: <alias u+{userId}@wallets.zudomart.com>, mobilenumber, country:"NG"}`. The alias email keeps the user's real email out of Flutterwave and stays unique per PSA.
   - Store `account_reference`, `barter_id`, `nuban` and `bank_code`, then `GET /{ref}/static-account?currency=NGN&verbose=1` and store **every** funding number. All numbers map to the one PSA.
2. **The user transfers** from any Nigerian bank to their NUBAN.
3. **Webhook.** `transfer.completed` arrives with `data.debit_currency == "PSA"`, `narration == "WALLET FUNDING"` and `reference: "PSA_..."`. Check `verif-hash` in constant time, insert into the webhook inbox, and return 200.
4. **Worker: look up and verify.**
   - Map `data.account_number` to the PSA. If unknown, open a case and stop. Cross-check with `GET /v3/payout-subaccounts?nuban=<account_number>`, which returns the owning `account_reference` (updated from API reference 2026-10-10).
   - Verify with `GET /{ref}/transactions?from=&to=`: a `C` line with the same reference or session id and the same amount, plus a `D` line for the Flutterwave fee. There is no direct "verify funding" endpoint (question Q8).
   - Amount and fee come from the transactions list, never from the webhook alone.
5. **Ledger (one entry, reference `fund:{flwRef}`, unique):**
   - Dr `providerWallet:{ref}` gross / Cr `wallet:{user}:depositHold` gross.
   - Dr `wallet:{user}:depositHold` fwFee / Cr `providerWallet:{ref}` fwFee. The user bears Flutterwave's funding fee and sees it on the receipt.
6. **Fee sweep (if the deposit fee is above 0).**
   - Movement row `sweep:{flwRef}`, then `POST /v3/transfers` with `{account_bank:"flutterwave", account_number:<our merchant id>, amount:<fee>, currency:"NGN", debit_subaccount:<ref>, reference:"sweep-..."}`.
   - The docs sample for PSA→main omits `debit_subaccount`. We always send it, and test it in sandbox first (task P2.0).
   - Ledger on success: Dr `wallet:{user}:depositHold` fee / Cr `platformRevenue:depositFee`; Dr `providerBalance` / Cr `providerWallet:{ref}`.
7. **Release the hold.** After `DEPOSIT_WITHDRAWAL_COOLDOWN` (default 24 h; 72 h for a user's first deposit), move `depositHold → available`. Deposits are **spendable inside Zudomart at once**, so a hold-funded purchase debits `depositHold` first. They are withdrawable only after the hold, which stops deposit-and-withdraw cycling through a stolen bank account.
8. **Funding we must reject** (sender name fails sanctions screening, wallet closed, user banned): call `POST /v3/payout-subaccounts/refunds {funding_reference: <ref without "PSA_">, debit_currency:"NGN"}` and reverse the ledger entry. This is irreversible, and it can debit main if the PSA is short, so run it only before any spend.

### 3.2 Checkout by card or another method, for a buyer without a funded wallet

1. go-commerce prices the cart on the server. go-money creates `payment_intent` (`chk-…`) for the order total in the **charging currency**, which comes from the buyer's verified country and never from a client header (fixes FLOW-001).
2. `POST /v3/payments` ([V3D:flutterwave-standard-1](https://developer.flutterwave.com/docs/flutterwave-standard-1)):
   - Body: `{tx_ref, amount, currency, redirect_url, customer:{email,name}, configuration:{session_duration:30, max_retry_attempt:3}, payment_options, meta:{intentId}, payload_hash}`. `payload_hash = sha256(amount+currency+email+tx_ref+sha256(secret))` ([V3D:checksum](https://developer.flutterwave.com/docs/checksum)). `session_duration` and `max_retry_attempt` belong inside `configuration`, as [V3R:checkout](https://developer.flutterwave.com/reference/checkout) shows; `link_expiration` can also cap the link's life (updated from API reference 2026-10-10).
   - `payment_options` by currency: NGN `card, banktransfer, ussd, account, opay`; GHS `card, mobilemoneyghana`; KES `card, mpesa`; ZAR `card, account`. Add `applepay, googlepay` only once Flutterwave confirms them (Q14).
   - The response is `data.link`. Web apps redirect to it, mobile opens it in an in-app browser, and seller billing uses the same link.
3. **Redirect back** with `status`, `tx_ref` and `transaction_id`. This is display only. The app polls `GET /api/v1/payments/{ref}`.
4. **Webhook `charge.completed`, or the redirect poll.** Call `GET /v3/transactions/{id}/verify` and require all of the following, else mark the intent `amountMismatch`, refund, and alert:
   - `status=="successful"`
   - `tx_ref` equals ours
   - `currency` equals ours
   - `amount` exactly equals ours (refund any excess)
   - `customer.email` equals the intent's
   - the `id` was never used before (unique `provider_charge_id`)
5. **Ledger:** Dr `providerPending` charged / Cr `paymentsAwaitingApplication`; Dr Flutterwave `app_fee` to the processing-fee expense. Then apply per purpose (3.3–3.7).
6. **Settlement.**
   - Set the dashboard settlement destination to the **F4B balance**, not a bank, or escrow funds would leave Flutterwave.
   - The daily job matches `GET /v3/settlements` and `GET /v3/settlements/{id}` charges, then posts Dr `providerBalance` / Cr `providerPending`.

### 3.3 Escrow purchase: lock, confirm, release, dispute, refund

**Owner decision (2026-10-10): Zudomart must not hold customer money.** The owner has no licence and can't fund one. So there is **no platform escrow PSA**. Escrow money stays in the **buyer's own PSA**, locked by our ledger, until the order is confirmed. It moves to the seller's PSA only on release. Until release the money is legally still the buyer's, held by Flutterwave. A refund just unlocks it.

Accepted risk: a court or regulator order on the buyer's PSA, or a reversal of the deposit that funded it, can pull locked money out before release. The seller isn't paid until the funds are confirmed, so the seller only loses the sale and is never owed money we hold. Reconciliation alerts on any PSA whose Flutterwave balance falls below its locked total.

| Step | Provider call | Ledger |
|---|---|---|
| **Lock (wallet buyer)** | none: the money stays in the buyer's PSA | Dr `wallet:{buyer}:available` / Cr `wallet:{buyer}:escrowLocked:{e}` |
| **Lock (card buyer)** | The card charge settles to the F4B balance (normal merchant settlement; question Q18 in §8). As soon as it settles, transfer it into the buyer's PSA: `POST /v3/transfers {account_bank:"flutterwave", account_number:<buyer barter_id>, reference:"esc-in-…"}`. A card buyer at L0 gets their PSA created at checkout, if Flutterwave allows that (Q18) | At payment: Dr `paymentsAwaitingApplication` / Cr `wallet:{buyer}:escrowLocked:{e}`. On transfer: Dr `providerWallet:{buyer}` / Cr `providerBalance` |
| **Confirm** | none | Escrow moves to `releasable` when the buyer confirms, or 3 days after a *committed* `orderGroup.delivered` event (set once; fixes F12/COM-005). Disputes pause it |
| **Release** | (1) buyer PSA → seller PSA for the seller's net: `POST /v3/transfers {debit_subaccount:<buyer ref>, account_bank:"flutterwave", account_number:<seller barter_id>, reference:"rel-…"}`; (2) buyer PSA → main for our commission (`reference:"com-…"`) | Dr `wallet:{buyer}:escrowLocked:{e}` / Cr `wallet:{s}:available` + `commissionRevenue`; asset legs mirror |
| **Withdrawable** | none | The existing 24 h seller lock (`SELLER_CREDIT_HOLD_PERIOD`) then applies before withdrawal |
| **Dispute** | none | Escrow → `disputed`; the timer pauses |
| **Refund (any buyer, before release)** | none: unlock in the buyer's PSA. The buyer can spend it or withdraw it (deposit-hold rules apply). A card refund back to the card is an option the buyer chooses: buyer PSA → main, then `POST /v3/transactions/{id}/refund` | Dr `wallet:{buyer}:escrowLocked:{e}` / Cr `wallet:{buyer}:available` |
| **Partial refund** | Same, split. A second partial refund must return `ESCROW_ALREADY_PARTIALLY_REFUNDED` unless the amount matches (fixes FLOW-002) | Balanced split |
| **Clawback after release** | seller PSA → buyer PSA (`debit_subaccount: seller`) up to the seller's ledger `available`; anything still short becomes `seller:{s}:debt` | Status `clawedBack`, separate from `refunded` (F9) |

**Stock shortage after capture** (COM-001): in the same transaction that detects it, create a refund intent and an outbox message. Never loop the webhook.

**Outside NG** (no PSA yet): we do **not** hold escrow in our main balance. Until Flutterwave offers PSAs in that currency, sales there use direct payment: the order is paid by checkout, and the seller's share is paid out (to bank or mobile money) by main → payout as soon as the charge settles. There is no escrow, and the buyer is protected by the dispute and refund policy and the seller's verification level instead. Turn escrow on per country once a PSA exists there.

**Owner rule (2026-10-10): outside Nigeria, nobody can sell until they are identity-verified.** That means L1 via Smile ID: a government ID check, plus a verified payout bank or mobile-money account in their own name. There is no unverified escrow-only selling tier and no sales cap outside NG; the unverified-seller cap applies only in NG, where escrow protects the buyer. Enforce it server-side in catalog (publish a listing), live (store/product in a live), orders (checkout against that seller) and ads/boosts. Store creation can still happen first. Error: 403 `VERIFICATION_REQUIRED`, with `verifyUrl`.

### 3.4 Withdrawal

1. `POST /api/v1/wallets/me/withdrawals` requires all of these:
   - `Idempotency-Key`
   - `x-step-up-token` (fresh re-auth, at most 5 min old)
   - L1 or higher
   - a payout account older than `NEW_PAYOUT_ACCOUNT_COOLDOWN` (48 h); adding or changing an account also needs step-up, and triggers email and push notices
   - velocity checks: at most 3 withdrawals a day, a daily amount cap per KYC tier, and a 10-minute gap
   - no open risk flags, and no withdrawal in progress
2. Transaction:
   - lock the wallet row;
   - quote the fee with `GET /v3/transfers/fee?amount=&currency=NGN&type=account`;
   - check ledger `available` ≥ amount (debts are repaid first and shown in the quote; F8);
   - Dr `wallet:{u}:available` / Cr `wallet:{u}:reservedPayout`;
   - insert the `withdrawal` and `payout_transfer` rows **together** (fixes FLOW-003);
   - outbox.
3. Worker:
   - pre-check `GET /{ref}/balances` (section 2.3);
   - send `POST /v3/transfers` with `{account_bank, account_number, amount:<net>, currency:"NGN", debit_currency:"NGN", debit_subaccount:<user ref>, reference:"wd-…", narration:"Zudomart withdrawal", callback_url, beneficiary_name, skip_beneficiary_creation:1}` (the last field updated from API reference 2026-10-10);
   - save `id` and `status` (`NEW`);
   - **one attempt only.**
4. `transfer.completed`, or a 15-minute sweep: `GET /v3/transfers/{id}` (or `?reference=`).
   - `SUCCESSFUL`: Dr `reservedPayout` / Cr `providerWallet:{ref}`, plus the fee line once Q4 says who pays it.
   - `FAILED`: Cr back to `available`, but only after the GET confirms it.
5. `requires_approval == 1` means a dashboard approval is pending. Alert and wait; never auto-approve.
6. **Mobile money (later, non-NG):** the same call with `account_bank` set to the network code (`MPS`, `MTN`…), `GET /v3/banks/{country}`, and corridor `meta`. Use `GET /v3/banks/{country}?include_provider_type=1` to tell banks from mobile-money providers. M-Pesa and ZAR payouts need `meta` with the sender's and beneficiary's names, phone and country. GH bank payouts need `destination_branch_code` from `GET /v3/banks/{id}/branches` (updated from API reference 2026-10-10).

### 3.5 Ads top-up and funding ads from earnings

- **Card or bank top-up:** purpose `ads-`, flow 3.2. Ledger Dr `paymentsAwaitingApplication` / Cr `advertiserPrepaid:{adAccount}`. The money stays in **main**; prepaid ad credit is our liability, spendable only on our ads.
- **From the wallet or earnings:** `POST /v3/transfers` PSA → main (`debit_subaccount`, `reference:"adsfund-…"`). Ledger Dr `wallet:{u}:available` / Cr `advertiserPrepaid` and Dr `providerBalance` / Cr `providerWallet:{u}`. Step-up is required above a threshold.
- **Spend:** unchanged (`adSpend.service.go`), plus TRU-001: an expiry-aware serve gate, and a shortfall pauses delivery.
- **Refund of unused credit:** to the original card if under 90 days, else to the user's PSA (main → PSA, free).

### 3.6 Creator subscriptions and recurring billing (web)

We keep **our own renewal engine** (`subscriptions/.../renewalEngine.service.go`) and do not use Flutterwave payment plans. Our plans are regional, our trials have card checks, and plan changes are already modelled. Flutterwave plans also auto-cancel after 3 failures and let customers cancel from email links, outside our state ([V3D:payment-plans-1](https://developer.flutterwave.com/docs/payment-plans-1)).

1. **First charge:** Standard checkout (3.2), purpose `csub-`. Verify, then store `data.card.token` (`flw-t1nf-…`) encrypted with `secretbox`, along with `email`, `last4`, `expiry` and `issuer country`. The token is "tied to the email" and valid for a year (V3D:tokenization).
2. **Renewal:** the engine calls `POST /v3/tokenized-charges {token, email, currency, country, amount, tx_ref:"ren-{sub}-{period}"}`. The reference is unique per subscription and period, so renewals are exactly-once. Then verify by id. On `pending`, query; never re-charge. The reference marks `redirect_url` as required on this call; send our neutral return URL. Do not use `POST /v3/bulk-tokenized-charges`: its `retry_strategy` makes Flutterwave re-charge on its own schedule (updated from API reference 2026-10-10).
3. **Split:** money lands in main. Ledger Dr `providerPending` / Cr `creatorSubscriptionPayable:{creator}` (net) + `creatorSubscriptionRevenue` (fee). After `CREATOR_SUB_HOLD` (7 days, the chargeback window), a payout run does main → creator PSA (free) and Cr `wallet:{creator}:available`.
4. **Paying from the wallet:** subscriber PSA → main (fee) and subscriber PSA → creator PSA (net, held in `creatorPending` for 7 days). Both are free wallet transfers.
5. **Seller and Premium plans:** the same engine; revenue goes to main.

### 3.7 Coins and boosts

- **Coins:** card (3.2, purpose `coin-`) or wallet (PSA → main, `coin-w-…`). Ledger as today: Cr `coinSales`/`coinsInCirculation`. Gifts move coins in the ledger only. Creator coin earnings become cash payable, and the payout run does main → creator PSA. Velocity rules stay (`coinRiskRules.service.go`).
- **Boosts:** card or wallet → main; Cr `advertiserPrepaid:user-{id}` (existing `BoostAdAccountId`).

### 3.8 Refunds and chargebacks

- **Refunds:**
  - `refunded_minor` counts *succeeded* refunds only, and a new `refund_in_flight_minor` holds requests. A failure releases the in-flight amount in the same transaction, and a consumer for `paymentRefund.failed` alerts (fixes MONEY-004).
  - Refund webhooks are off by default, so ask support to enable them. Their payload has no envelope (V3 refund reference, via [V3 index](https://developer.flutterwave.com/llms.txt)), so we poll `GET /v3/refunds/{id}` as well.
- **Chargebacks:**
  - Poll `GET /v3/chargebacks?status=initiated` hourly, and ask for the chargeback webhooks (`chargeback.initiated|accepted|declined|lost|won`, on request).
  - Respond within 10 working hours for local disputes ([V3D:chargebacks](https://developer.flutterwave.com/docs/chargebacks)) with `PUT /v3/chargebacks/{id} {action:"decline", comment, prooflink}`, using delivery proof from orders.
  - Correction (updated from API reference 2026-10-10): [V3R:acceptdecline-a-chargeback](https://developer.flutterwave.com/reference/acceptdecline-a-chargeback) lists only `action` (accept|decline) and `comment`. Evidence goes first to `POST /v3/upload_image` (multipart `image`), which returns a hosted URL. Send that URL as `prooflink` and also cite it in `comment` until Flutterwave confirms the field (follow-up F3). The v4 guide gives merchants **48 hours** before an unanswered chargeback is `lost`, so the poll stays hourly and staff are paged at once.
  - The amount is withheld from main at `initiated`. Ledger: Dr `chargebackReceivable` / Cr `providerBalance`.
  - Recovery, in order:
    1. escrow still held: buyer PSA → main (the locked amount);
    2. released: seller PSA → main, up to `available`;
    3. otherwise: `seller:{s}:debt`.
  - Won: reverse.
- **PSA funding disputes (bank-transfer reversals):** "the dispute proceeds under a court order" if unanswered (V3D:chargebacks, Bank Transfer Reversals). We assume main is liable (Q7). The deposit hold (3.1 step 7) limits exposure.

---

## 4. Security model

| # | Control | Implementation |
|---|---|---|
| S1 | **Webhook authentication** | `verif-hash` is compared in constant time to `FLUTTERWAVE_WEBHOOK_HASH` (≥32 random bytes, from Secrets Manager; the header is never logged). A mismatch returns 401 and a metric. The webhook is a *trigger only*: nothing is credited from its body. WAF: rate-limit `/webhooks/flutterwave` and require the header; there is no IP allowlist, because "Flutterwave's IP addresses are dynamic" ([V3D:webhooks](https://developer.flutterwave.com/docs/webhooks)) |
| S2 | **Re-verify by id** | Charges: `GET /transactions/{id}/verify`. Transfers: `GET /transfers/{id}`. Fundings: the PSA transactions list. We match reference, amount (exact, minor units), currency, status, customer and wallet, and the unique `provider_charge_id` blocks reuse of one Flutterwave payment for two intents |
| S3 | **Inbox + outbox** | Webhooks are stored in `webhook_events` (unique `provider, event_key`) and processed by a worker that claims rows with `FOR UPDATE SKIP LOCKED` and a 5-minute lease. There are no bare goroutines (fixes MONEY-003). Provider calls go out only through the outbox after the money transaction commits |
| S4 | **Idempotency** | `Idempotency-Key` is required on every money mutation, including saved-card charge and subscription checkout (fixes MONEY-005/007), through `RunIdempotentMoneyCommand`. Our provider references are unique DB columns, and Flutterwave rejects a duplicate transfer reference ("Payout with this ref already exists"). Webhook handlers are idempotent on our reference |
| S5 | **Concurrency** | Every money transaction is `SERIALIZABLE` and retries on 40001. Wallet rows are locked `FOR UPDATE` in account-ref order. Escrow is driven only by committed order events (fixes COM-004/005) |
| S6 | **Payout safety** | One attempt per POST; uncertain means pending; resolution only by GET. The PSA balance is pre-checked. `failed` is accepted only from a GET. Withdrawal and transfer rows are created together |
| S7 | **Withdrawal step-up and limits** | `x-step-up-token` on withdraw and on adding a payout account. A 48 h cooldown for new accounts, plus email and push notices. Daily count and amount caps per tier. The BVN name must match the resolved account name (Jaro-Winkler ≥0.85, else manual review). Withdrawals go only to accounts in the user's own name; no third-party payouts |
| S8 | **Refund ledger** | Succeeded and in-flight amounts are tracked separately (MONEY-004). Refunds never exceed the captured amount; DB CHECK as today |
| S9 | **No client-trusted amounts** | Prices come from the server; the charging currency comes from the KYC or profile country (`ResolveChargingRegion`), never `X-Client-Region` (FLOW-001). `payload_hash` on checkout |
| S10 | **Secrets** | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`, `FLUTTERWAVE_ENCRYPTION_KEY` (unused unless we ever do direct charges) live in Secrets Manager, readable only by the go-money task role. The key never reaches apps, logs or other services |
| S11 | **IP whitelisting** | go-money egress goes through a NAT gateway with fixed EIPs, which are whitelisted on the Flutterwave dashboard. Transfers from any other IP fail. Changing the list needs the dashboard OTP |
| S12 | **Audit log** | Ledger, escrow and webhook history are append-only (existing triggers). Every staff money action needs step-up and writes `staffaudit`. Journal reversal is allowed only for an allowlist of kinds (MONEY-002) |
| S13 | **Reconciliation** | Section 2.3, with alerts and automatic ledger freezes |
| S14 | **Dashboard hygiene** | Section 4.1 |
| S15 | **Key rotation** | v3 rotation invalidates the old key immediately. Runbook: pause the payout worker and new checkouts (flag), regenerate, write to Secrets Manager, roll the go-money tasks, and resume. Expect about 5 minutes of checkout downtime. Rotate quarterly and on any suspicion |
| S16 | **Rate limits and timeouts** (updated from API reference 2026-10-10) | GETs back off with jitter on 429 and on non-JSON edge responses (Cloudflare `1015`). Reconciliation sweeps are paced to stay well under v4's 500 requests/min, and under whatever v3 allows (no number published; Q15). A v3 503 (about 28 s) on a money POST means "query by reference", never "retry" ([V3D:handling-error-timeouts](https://developer.flutterwave.com/docs/handling-error-timeouts)) |
| S17 | **Provider-side state we did not ask for** (updated from API reference 2026-10-10) | Every transfer sends `skip_beneficiary_creation:1`. We never call the transfer-retry or bulk-tokenized-charge endpoints. Card-token edits (`PUT /tokens/{token}`) run only as audited staff commands. The OTP endpoint (`POST /otps`) returns the OTP in clear text, so we do not use it for user login or step-up |
| S18 | **v4 readiness** (updated from API reference 2026-10-10) | When a flow moves to v4: OAuth token cached in memory and refreshed 60 s before its 600 s expiry; `X-Idempotency-Key` = our movement reference (12–255 alphanumeric, so the hyphens come out); `X-Trace-Id` per call, logged; `flutterwave-signature` checked as base64 HMAC-SHA256 of the raw body in constant time, with the comparison mode confirmed in sandbox first (follow-up F1) |

### 4.1 Money can only leave through Zudomart

**What the docs say about PSAs:**

- The docs describe a PSA's static account only as a way to fund the wallet ([V3D:payout-subaccount](https://developer.flutterwave.com/docs/payout-subaccount)).
- NUBANs cannot be pulled from over the bank rails, so in practice the account is **inbound-only**. The docs never state this explicitly (Q2).
- The docs never mention an end-user login, app, card, USSD or PIN for a PSA. PSAs are created and operated only with the merchant secret key. Whether Flutterwave ever contacts PSA holders is not documented (Q2).
- We use alias emails (3.1), so Flutterwave has no channel to the user that we do not control.

| Way money could leave a PSA | Control |
|---|---|
| **Our API** (`/v3/transfers` with `debit_subaccount`, `/payout-subaccounts/refunds`) | Only go-money calls it, and only from ledger-approved movements. Each one is pre-checked against the ledger and the PSA balance |
| **Flutterwave dashboard users** | Least-privilege roles (Q11); 2FA required for every user; owner and finance only; quarterly access review. Turn on transfer approval (maker-checker) for **dashboard-initiated** transfers if Flutterwave can scope it that way (Q11). Daily reconciliation catches any transfer without a ledger entry and pages on-call |
| **Leaked API key** | Secrets Manager plus the go-money role only; IP whitelisting (a stolen key cannot send transfers from elsewhere); immediate rotation runbook (S15); alerts on any transfer reference that is not ours (reconciliation) |
| **Funding reversals** | Only we can start them (API). They run only before the deposit is spent (3.1 step 8), and they can debit main when the PSA is short |
| **Bank-transfer disputes on fundings** | Initiated by the sender's bank; undefined whether they debit the PSA or main (Q7). The deposit hold limits exposure; recovery goes to user debt |
| **Card chargebacks** | Cards never fund a PSA, so chargebacks hit **main**, never a PSA (V3D:chargebacks: "withheld from the merchant's balance"). Recovery per 3.8 |
| **Deleting a PSA** | Delete only at a ledger balance of 0, after sweeping to main or the user's bank; a two-person staff action with step-up. Behaviour with a remaining balance is undocumented (Q5). Inbound transfers to a deleted PSA "will be returned to the sender's account" |
| **Legal or regulator orders, account closure** | Undocumented (Q6). Flutterwave MFB issues the NUBANs and is subject to CBN, EFCC and court post-no-debit orders. We record the case, freeze the ledger wallet, and never move funds against an order. If our merchant account were closed, PSA balances belong to users (no-forfeiture rule), and the exit procedure must be in the contract (Q6) |
| **Flutterwave-initiated debits** (fees, VAT, stamp duty) | Expected as `D` lines in the PSA statement; each is matched in reconciliation, and an unknown line raises an alert |
| **Transfer retries** (`POST /v3/transfers/{id}/retries`) (updated from API reference 2026-10-10) | The endpoint re-sends a failed transfer from the same source under a new reference (`…_RETRY_n`), so a dashboard user or a leaked key could replay a failed PSA withdrawal. go-money never calls it. Reconciliation treats any `_RETRY_` reference as unknown, pages on-call and freezes the wallet |
| **Saved beneficiaries** (updated from API reference 2026-10-10) | `POST /v3/transfers` saves the destination as a dashboard beneficiary by default. We send `skip_beneficiary_creation:1`, so there is no ready-made list of user payout accounts for a dashboard user to pick from |
| **Re-pointed card tokens** (updated from API reference 2026-10-10) | Not a way out of a PSA (cards never fund a PSA), but `PUT /v3/tokens/{token}` can move a saved card to a different email. Only a staff command with step-up calls it |
| **v4 API** (updated from API reference 2026-10-10) | v4 has no PSA endpoints, and its wallet transfers address merchant ids only. If v4 credentials are issued for the account, they must not be able to debit a PSA; Flutterwave has to confirm this (F2). Until then no v4 client id is created |

---

## 5. KYC levels mapped to providers

| Level | What the user can do | NG | GH | KE | ZA | Others |
|---|---|---|---|---|---|---|
| **L0** (email only) | Browse; buy by card or checkout methods; coins and boosts by card. **No PSA, no deposits, no withdrawals** | — | — | — | — | — |
| **L1** (payout identity) | PSA created; deposits; withdrawals to an own-name account up to the tier caps; receive seller and creator earnings | BVN consent `POST /v3/bvn/verifications` → `GET /v3/bvn/verifications/{ref}` (name, DOB, phone, NIN, `watchlisted`) + `POST /v3/accounts/resolve` name match. Option: Mono Lookup (separate contract) if the BVN feature is refused | Smile ID Ghana Card + Flutterwave `accounts/resolve` (GH bank or MoMo) name match | Smile ID national ID; bank-name check not available in Flutterwave (Q16) | Smile ID SA ID; bank check through Smile ID or manual review | Smile ID |
| **L2** (biometric) | Higher caps, the checkmark, business plans | Smile ID Biometric KYC (liveness + BVN/NIN photo match). Flutterwave's BVN `faceImage` can be a second match source | Smile ID biometric | Smile ID | Smile ID | Smile ID |

Identity sources confirmed against every reference page (updated from API reference 2026-10-10):

- **NG:** BVN consent is the only Flutterwave identity product. Re-consent can return `url: null`, in which case the result is fetched straight away by `reference`; the `bvn.completed` webhook is a hint, and `GET /v3/bvn/verifications/{ref}` is the truth.
- **GH:** bank and MoMo name resolve through v3 `POST /accounts/resolve` (pass `country:"GH"`) or v4 `POST /banks/account-resolve` (`currency:"GHS"`).
- **UG:** v4 resolve covers UGX bank accounts (not MoMo).
- **KE and ZA:** no name check in either version, so the Smile ID path or manual review stays.
- There is no NIN, Ghana Card, Kenyan ID or SA ID endpoint in v2, v3 or v4, so Smile ID remains the L1 check outside NG. That keeps the owner's rule (no selling outside NG without identity verification) unchanged.

The `watchlisted` flag or a sanctions hit means a manual review before any PSA is created. Starting caps are the CBN-tier-modelled limits in [Appendix A.3](#a3-cbn-kyc-tiers-and-zudomart-limits), now replaced by the owner-approved limits; confirm the PSA tier with Flutterwave (Q3). BVN data (including the face image) is sensitive personal data under NDPA s.30. Store only what the decision needs, encrypted with `secretbox`, and discard the image after the match.

---

## 6. Country matrix (as documented today)

| Flow | NG (NGN) | GH (GHS) | KE (KES) | ZA (ZAR) | UG/RW/TZ/ZM, XAF/XOF |
|---|---|---|---|---|---|
| Hosted checkout methods | card, bank transfer, USSD, account, OPay, NQR | card, MoMo | card, M-Pesa | card, account, 1voucher | card, MoMo |
| Per-user PSA wallet | **yes** | **no** (Q9) | no | no | no |
| Static deposit account | PSA NUBAN | Plain GHS VA credits **main** (pooled; licence issue) | v4 VA enum only (undocumented) | v4 VA enum only | no |
| Static deposit account, detail (updated from API reference 2026-10-10) | PSA NUBAN (NGN only) | v3 and v4 GHS VA; Ghana-registered merchants only unless activated; exact-amount only; pooled to main → **not used for deposits** | v4 `currency:"KES"` needs the payer's `customer_account_number`; the guide says NGN/GHS only; pooled → **not used for deposits** | v4 `currency:"ZAR"` in schema only; pooled → **not used for deposits** | none |
| Escrow holding | buyer's own PSA (locked) | none: direct payment, no escrow | none | none | none |
| Payout to bank | yes | yes (branch code required) | yes | yes | yes |
| Payout to mobile money | — | yes (MTN, Vodafone, AirtelTigo) | yes (M-Pesa `MPS`) | — | yes |
| Bank account name resolve | yes | yes (bank + MoMo) | no | no | no |
| Bank account name resolve, detail (updated from API reference 2026-10-10) | v3 and v4 (NGN; also NG USD accounts in v4) | v3 (bank + MoMo) and v4 (bank) | none in any version | none in any version | UG banks via v4 only; others none |
| Payout recipient types in v4 (updated from API reference 2026-10-10) | bank | bank (branch required), MoMo | bank, MoMo | bank (phone, email, address required) | bank: UGX, RWF, XAF, XOF, SLL, MWK; MoMo: UGX, RWF, TZS, ZMW, XAF, XOF |
| Tokenized card renewals | yes | yes | yes | yes | yes |
| L1 identity | BVN (Flutterwave) | Smile ID | Smile ID | Smile ID | Smile ID |
| Selling without verification | escrow-only, capped | **not allowed** | **not allowed** | **not allowed** | **not allowed** |

**Launch order:**

1. **NG on the full PSA model.**
2. **GH, KE and ZA as "direct mode" first:** no stored balance, the seller's share is paid out by main → bank/MoMo as soon as the charge settles. No escrow and no stored balance, so Zudomart never holds customer money.
3. **PSAs in those markets** once Flutterwave offers non-NGN PSAs.

The full reference changes none of this (updated from API reference 2026-10-10). No v2, v3 or v4 page offers a per-user GHS, KES or ZAR balance. The only non-NGN "accounts" are merchant virtual accounts, which pool into our main balance, so using them to hold users' money would break the rule that Zudomart never holds customer money. GH, KE and ZA stay in direct mode with no escrow, and selling there still requires identity verification.

---

## 7. Migration plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 Sandbox spike** | Confirm Q1, Q4, Q8 and Q10 by test: PSA→main with `debit_subaccount`, who pays fees, funding webhook shape, whether v3 and v4 webhooks can coexist | Written results in this doc |
| **P1 Build behind flags** | Adapter, inbox and outbox fixes, PSA tables, flows 3.1–3.8, reconciliation | Fake-Flutterwave integration tests and adversarial QA pass |
| **P2 Internal cohort** | Flag `payments.provider.flutterwave.cohort = staff`. Real money, small caps | 14 days of clean daily reconciliation |
| **P3 New users first** | Every account created after the date gets Flutterwave for checkout and its wallet. Existing users keep Paystack checkout | 30 days clean; chargeback and refund paths exercised |
| **P4 Existing users** | Existing users move to Flutterwave checkout; new intents use Flutterwave. Old intents keep `provider = paystack`, so their refunds, disputes and webhooks still go to Paystack | — |
| **P5 Drain Paystack** | Keep the Paystack webhooks, refunds and dispute polling alive for 180 days, then remove the keys | Paystack balance 0, no open disputes |

**Feature flags:** one flag per flow, in the admin configuration: `checkout`, `walletDeposits`, `withdrawals`, `escrowPsa`, `renewals`, `adsTopUp`. Routing chooses `Providers[name]` at intent creation and stores it on the row (the container already keys providers by name).

**Existing balances:** seller and creator `available` balances today are our liability, held in our Paystack balance.

1. Once a user reaches L1 on Flutterwave and their PSA exists, a migration job sends a Paystack transfer from our Paystack balance to the user's PSA NUBAN, with reference `mig-{user}`.
2. On arrival, the funding is matched to a pre-created `expected_migration` row by PSA account and amount. It skips the deposit fee and the hold, and posts Dr `providerWallet` / Cr `wallet:available` against Cr `providerBalance:paystack`.
3. Users who never verify keep their balance on Paystack and can withdraw it there (no forfeiture).
4. Escrows open at cutover finish on Paystack.

**Subscriptions:** card tokens cannot move between providers.

- Existing Paystack subscriptions keep renewing on Paystack until `current_period_end`.
- 14 days before that, the user is asked to re-add a card via Flutterwave checkout, which carries over the remaining period without a double charge.
- If no card is added, the subscription ends at period end with a grace period, then lapses. We never charge both providers for the same period: renewals are keyed per period and provider, and the Paystack subscription is disabled once Flutterwave succeeds.

**Rollback:**

- Flip the flags back to Paystack for **new** intents.
- Flutterwave money stays put: PSAs remain withdrawable through Flutterwave, and open escrows finish on Flutterwave.
- Rollback never moves balances between providers automatically.

---

## 8. Email to Flutterwave

**Subject:** Zudomart: questions before go-live on payout subaccounts, transfers and webhooks (v3)

> Hello Flutterwave team,
>
> Zudomart is a social marketplace launching in Nigeria first, then Ghana, Kenya and South Africa. We plan to give each verified user their own payout subaccount (PSA) with a static NUBAN. Zudomart does not hold customer money: marketplace escrow stays locked (in our ledger) inside the buyer's own PSA until delivery is confirmed, then moves PSA→PSA to the seller. We use Flutterwave Standard checkout for cards and other methods. Before we go live, could you confirm the following?
>
> **Product and API version**
> 1. Can one merchant account use v3 (PSAs, Standard, tokenized charges, BVN) and v4 at the same time? Can it receive v3-format webhooks (needed for the "payout subaccounts wallet funding hook") alongside v4-format webhooks? Is a v4 PSA API planned, and is there a v3 sunset date?
> 2. Can end users ever access, see or withdraw from a PSA balance outside our API? For example: a Flutterwave login, app, card, USSD, PIN, email or SMS from Flutterwave, or support requests. Is a PSA's static account strictly inbound-only?
>
> **Ownership, KYC and limits**
> 3. Who legally owns funds in a PSA: the end user, or us as the merchant? Which entity holds them (Flutterwave MFB or Flutterwave Technology Solutions)? Are they segregated from our main balance on insolvency? Which CBN KYC tier applies to each PSA, and must we pass BVN/NIN for each PSA?
> 4. What are the PSA limits (single transfer, daily debit, daily inflow, maximum balance)? Does the 30,000,000 / 120,000,000 NGN `transfer_limits` in your 2024 docs still apply, and can it be set per PSA? Is there a cap on the number of PSAs?
> 5. Fees: what is the PSA funding fee schedule? On a transfer with `debit_subaccount`, is the fee taken from the PSA or from our main balance? Is VAT or stamp duty applied? Are PSA↔PSA and PSA↔main transfers free?
>
> **Money leaving a PSA**
> 6. What happens to a PSA's balance when we call DELETE: is it swept to main, frozen, or is the delete refused while the balance is above 0? Is there any way to freeze or suspend a PSA without deleting it?
> 7. How are court orders, post-no-debit (PND), liens and garnishee orders applied: per PSA NUBAN, or to our whole merchant account? How are we notified? If our merchant account is suspended or closed, what happens to PSA balances, and how are end users paid out?
> 8. When the sender of a PSA funding disputes it with their bank, is the PSA or our main balance debited? How are we notified, and how long do we have to respond?
> 9. For the PSA → main transfer, your guide's sample omits `debit_subaccount`. Please confirm the exact request.
>
> **Webhooks and verification**
> 10. Does the PSA funding webhook (`transfer.completed`, `debit_currency: "PSA"`) ever include `account_reference`? Is matching by `account_number` guaranteed for both the `nuban` and every static-account number? Can `GET /v3/transfers/{id}` verify a funding? Please list the webhook source IPs if they are stable, and enable refund and chargeback webhooks for our account.
>
> **Dashboard security**
> 11. Which dashboard roles can initiate or approve transfers, including PSA debits? Can 2FA be enforced for all team members? Can transfer approval (maker-checker) apply to dashboard-initiated transfers only, while our whitelisted API transfers run unattended? How do `requires_approval` and `approver` get set?
> 12. Does IP whitelisting cover every endpoint or only transfers? Can we rotate the secret key with an overlap period?
>
> **Currencies, methods and features**
> 13. Are PSAs NGN-only now? Are GHS, KES or ZAR PSAs available or planned?
> 14. Are Apple Pay and Google Pay available on Standard checkout, and in which countries? What are the mobile money and M-Pesa options per country?
> 15. Please enable for our account: payout subaccounts, BVN verification (consent flow), tokenized charges and transfers via API. What is your numeric rate limit on v3?
> 16. Can split-payment subaccounts point to a PSA (`is_f4b_account` with a PSA `barter_id`)? Is any Mono identity product (BVN, NIN or account lookup) available through Flutterwave? Is there a bank-account name check for Kenya and South Africa?
>
> **Licensing (most important for us)**
> 17. We do not hold an MMO, PSSP or e-money licence. With this model (each user's money in their own PSA, held by Flutterwave; we only instruct transfers via the API and take our commission), does Zudomart need any CBN licence of its own? Is Flutterwave, under its MFB or PSSP licence, the regulated holder of these funds? Do you have marketplaces using PSAs this way?
> 18. Card checkout settles to our main balance before we move it into the buyer's PSA. Can a Standard or tokenized card charge settle **directly into a specific PSA** instead? Can we create a PSA for a buyer at first checkout (before BVN), and what tier and limits apply until BVN is added?
>
> Thank you,
> Zudomart Engineering

### 8.1 Follow-up questions (updated from API reference 2026-10-10)

The email above has been sent and stays unchanged. These came out of reading the full reference and go in a follow-up message or the onboarding call:

- **F1. v4 webhook signature.** The v4 webhooks page describes `flutterwave-signature` as base64 HMAC-SHA256 of the raw body, but its framework samples compare the header to the raw secret. Which is correct, and is it the same for every v4 event?
- **F2. v4 credentials and PSAs.** If we create v4 OAuth credentials on the same merchant account, can they ever debit a PSA, or move money to or from one (for example a v4 wallet transfer to a PSA `barter_id`)? We want v4 keys unable to touch PSAs.
- **F3. v3 chargeback evidence.** `PUT /v3/chargebacks/{id}` documents only `action` and `comment`. How is the URL from `POST /v3/upload_image` attached to a declined chargeback (a `prooflink` field)? Is the response window 10 working hours (v3 guide) or 48 hours (v4 guide)?
- **F4. `debit_subaccount` value.** The transfer reference calls it "the `id` of a payout subaccount", but every sample sends the `account_reference` (`PSA…`). Which does the API expect?
- **F5. Transfer retries and beneficiaries.** Can `POST /v3/transfers/{id}/retries` and dashboard beneficiary lists be disabled for our account? Does `skip_beneficiary_creation: 1` stop the save for PSA-funded transfers too?
- **F6. v4 virtual accounts outside NG/GH.** The v4 schema accepts KES, ZAR, EGP and MAD virtual accounts, but the guide says NGN and GHS only. Which are live, and could any of them be issued *per user* as a balance held for that user rather than pooled into our settlement wallet?
- **F7. v4 hosted checkout.** The v4 error table includes `CHECKOUT_SESSION_NOT_FOUND` and `CHECKOUT_SESSION_ALREADY_EXISTS`. Is a v4 hosted checkout (card data never touching us) available or planned?
- **F8. PSA `country`.** `POST /payout-subaccounts` accepts any country (the sample uses `US`). Does a non-NG `country` change the PSA's KYC tier, limits or currency, or is it always an NGN wallet at Flutterwave MFB?
- **F9. `funding_reference` for reversals.** The reference says to take it from the funding webhook "as `data.response`", while the guide uses `data.reference` without the `PSA_` prefix. Which is right?

(The v3 rate-limit number is already asked in Q15.)

---

## 9. Bug classes in the current Paystack system, and the control for each

Every row was checked in the code on 2026-10-10, not taken from the reports. Rows marked "stage 1" were fixed and regression-tested in the phase 2 stage 1 build the same day. The reports are `security/audit/reports/GO_BACKEND_DEEP_SCAN.md`, `GO_FINANCIAL_AUDIT_REPORT.md`, `GO_DEEPSCAN_REPORT.md` and `DEEPSCAN_REPORT.md`. `docs/CHANGELOG.md` has no payment entries.

| # | Bug class | Finding | Status today | Control in this design |
|---|---|---|---|---|
| B1 | Payout retried after a timeout pays twice, or is marked failed after the money left | MONEY-001 | **Fixed** (single-attempt POST, verify before fail). Stage 1 also: a failed verify GET keeps the payout processing; the saved-card charge POST is no longer retried blindly; all provider POSTs go through `providerHttp` (one attempt, unknown outcome → verify by reference) (`TestWithdrawalTimeoutThenProviderSuccessIsPaidExactlyOnce`) | S6 |
| B2 | Webhook claimed before processing; redeliveries and the sweeper both process | MONEY-003 | **Fixed (stage 1, 2026-10-10)**: store-first inbox; `webhookInbox.service.go` claims with `FOR UPDATE SKIP LOCKED` + 5-minute lease token, bounded worker pool, backoff, dead letter after 12 attempts (`payments.webhookInboxAndRefunds_integration_test.go`) | S3 |
| B3 | Amount or currency not verified | class | **Fixed (stage 1)**: the verified charge id wins over the webhook hint, and a provider charge already used by another intent fails the new intent (`chargeReused`) | S2 (use the id from the verify response) |
| B4 | Refund capacity consumed at request, never released on failure | MONEY-004 | **Fixed (stage 1)**: `refunded_minor` = succeeded only, new `refund_in_flight_minor`; a failure releases it in the same transaction; `paymentRefund.failed` consumer alerts (`TestRefundFailingThenRetriedReleasesCapacityAndPaysOnce`) | S8 |
| B5 | Saved-card charge without an idempotency key or row lock | MONEY-005 | **Fixed (stage 1)**: `Idempotency-Key` required, intent row locked and claimed once (`saved_card_charge_started_at`), single-attempt POST (`TestSavedCardDoubleTapChargesTheCardOnce`) | S4 |
| B6 | Subscription checkout double-tap | MONEY-007 | **Fixed (stage 1)**: `Idempotency-Key` required on `POST /payments/subscriptions/checkout`, run through `RunIdempotentMoneyCommand` | S4 |
| B7 | Webhook IP allowlist trusted `X-Forwarded-For`; open when unset | MONEY-006 | **Fixed** (REMEDIATIONS) | S1 |
| B8 | Client header decides the charged price and currency | FLOW-001 | **Fixed (stage 1)**: coins, boosts and earnings conversion use `ResolveChargingRegion`; the gateway drops a client-sent CDN country unless `TRUST_CDN_COUNTRY_HEADER=true` (`TestCoinPurchasePriceComesFromTheServerNotTheRegionHeader`, `TestBoostPriceIgnoresATamperedRegionHeader`) | S9 |
| B9 | Second partial refund reports success without moving money | FLOW-002 | **Fixed (stage 1)**: 409 `ESCROW_ALREADY_PARTIALLY_REFUNDED` unless an exact replay (`TestSecondDistinctPartialRefundIsRejectedAndMovesNoMoney`) | 3.3 |
| B10 | Withdrawal stuck in `processing` with no transfer row | FLOW-003 | **Fixed (stage 1)**: transfer row created in the claim transaction; reconciler requeues a processing withdrawal with no row (`TestProcessingWithdrawalWithoutATransferRowIsQueuedAgainAndPaidOnce`) | 3.4 step 2 |
| B11 | Staff can reverse any journal kind, so ledger and module state diverge | MONEY-002 | **Fixed (stage 1)**: staff reversal only for `ledger.correction`, `staff.adjustment`, `reconciliation.correction`; else 409 `JOURNAL_KIND_NOT_REVERSIBLE` (`TestStaffCanReverseOnlyAllowlistedJournalKinds`) | S12 |
| B12 | Paid order with no stock held | COM-001/002 | **Fixed (stage 1)**: the same transaction cancels the order and enqueues `orderGroup.refundRequested`; the consumer acks (`TestPaidOrderWithoutStockIsCancelledAndRefundedExactlyOnce`) | 3.3 |
| B13 | Store credit over-redeemed concurrently | COM-003 | **Appears fixed** (`storeCreditBalance.service.go:39` `FOR UPDATE`) | S5 |
| B14 | Escrow fulfilment or timer set before the order transition commits; a repeated "delivered" resets the timer | COM-004/005, F12 | **Fixed (stage 1)**: escrow is driven by committed `orderGroup.shipped/delivered` outbox events; the timer is set once (`TestDeliveredEventSetsTheReleaseTimerOnceEvenAcrossReplaysAndDisputes`) | S5, 3.3 |
| B15 | Integer overflow or underflow in money maths | F1/F2/F3/F5/F6 | **Fixed** with tests | decimal parser (2.1) |
| B16 | Unbalanced journal entry on partial refund | F4 | **Fixed** (`escrowSettlement.service.go:150-154`) | — |
| B17 | Escrow split loses minor units | F7 | **Fixed** (`AllocateByWeightsWithoutLosingMinorUnits`) | — |
| B18 | Debt repaid then the full amount debited at withdrawal | F8 | **Not a money loss**: the ledger refuses a negative balance, so the user gets `INSUFFICIENT_FUNDS`. UX bug | 3.4 quote |
| B19 | Clawback reuses `refunded` | F9 | By design, undocumented | `clawedBack` status |
| B20 | Idempotency insert race | F10 | **Low risk**: Postgres serialises the conflicting insert, and the hash check runs | — |
| B21 | Unsupported currency | F11 / F17 | **Fixed (stage 1)**: checkout rejects a currency outside `ORDERS_CHECKOUT_CURRENCIES` with 422 `CHECKOUT_CURRENCY_NOT_SUPPORTED` before saving | S9 |
| B22 | Refund sent after commit without an outbox | F14 | **Fixed (stage 1)**: `RequestRefundInTransaction` enqueues `paymentRefund.requested` in the same transaction; a go-money consumer sends it (post-commit sends remain as a fast path, claim-guarded) | S3 |
| B23 | Reconciliation by posted date, 72 h lag | F18 | **Fixed (stage 1)**: settlements match by provider reference whatever the posting date; fresh entries inside `SettlementGrace` are `awaitingSettlement`, not breaks; pending intents re-verified for 30 days (`TestReconciliationMatchesByReferenceWhateverThePostedDate`) | 2.3 |
| B24 | Ads served on expired credit; shortfall written off | TRU-001 | **Fixed (stage 1)**: the serve gate evaluates credit expiry at the slot's server time (`TestServeGateIgnoresExpiredAdCredit`) | 3.5 |
| B25 | No withdrawal velocity limits, step-up or new-account cooldown | A9 + Go routes | **Fixed (stage 1)**: `X-Step-Up-Token` (`POST /auth/step-up`) on withdraw and payout-account changes; 3/day, 10-min gap, per-level daily cap, one in flight, 48 h new-account cooldown (`wallet.withdrawalSafety_integration_test.go`) | S7 |
| B26 | Webhook processed in a goroutine that dies with the process | MONEY-003 | **Fixed (stage 1)**: no bare goroutine; the row is stored before 200 and a supervised worker loop claims it (see B2) | S3 |
| B27 | A panic in a message handler crash-loops go-money | INFRA-001 | **Fixed** | — |
| B28 | Float money | class | **Fixed (stage 1)**: Paystack `numberValue` no longer falls back to float; `platform/money.ParseMajorUnits` is exact | decimal parser |

---

## 10. Phase 2 implementation tasks

Sizes: S ≤1 day, M 2–3 days, L 4–6 days. Run them in order; heavy test runs one at a time. Conventions:

- ent + Atlas migrations, files ≤300 lines, money in int64 minor units;
- errors as `{message, code}`;
- `Idempotency-Key` on every mutation and `x-step-up-token` for step-up;
- decoders reject unknown fields.

| # | Task | Files / modules | Size | Status |
|---|---|---|---|---|
| P2.0 | Sandbox spike for Q1, Q4, Q8, Q9, Q10; record the results in §1. Also test F4 (`debit_subaccount` as `account_reference`), F9 (funding reference format) and `GET /payout-subaccounts?nuban=` (updated from API reference 2026-10-10) | scratch scripts only | S | **Open**: needs real sandbox keys (no code can prove Q1/Q4/Q8/Q9/Q10, F4, F9). |
| P2.1 | `ParseMajorUnits` and `FormatMajorUnits` (exact, currency exponent, comma-tolerant), with tests | `services/go/platform/money/money.decimal.go` (+_test) | S | **Done (stage 1).** |
| P2.2 | Webhook inbox: claim with lease and `SKIP LOCKED`; worker instead of goroutine; the sweeper claims too (B2, B26) | `payments/src/modules/gateway/services/webhookProcessing.service.go`, new `webhookInbox.service.go`; ent `webhookevent` + Atlas migration (`locked_until`) | M | **Done (stage 1).** Stage 2: dead letters listable, inspectable (redacted) and replayable by staff. |
| P2.3 | Split `FullPaymentProvider` into `PaymentProvider`, `WalletProvider`, `PayoutProvider`, `IdentityVerifier`; Paystack adapter keeps compiling | `payments/src/interfaces/*.interface.go`, `payments/src/container/payments.container.go` | M | **Done (stage 1).** |
| P2.4 | Flutterwave config + HTTP client (no retry on POST, 429 backoff on GET, env/key guard) | `payments/src/configs/payments.config.go` (`FLUTTERWAVE_*`), `payments/src/integrations/flutterwaveHttpClient.integration.go` | M | **Done (stages 1–2)**: `FLUTTERWAVE_*` config with test/live key guard, hash and merchant-id checks; adapter on the hardened client. |
| P2.5 | Collections: Standard init with `payload_hash`, verify by id and by ref, tokenized charge, refund, chargebacks, banks, resolve; webhook `verif-hash` + parse (`charge.completed`, `transfer.completed`, PSA funding, `subscription.cancelled`, refund, chargeback) | `flutterwaveCharges.integration.go`, `flutterwaveRefunds.integration.go`, `flutterwaveDisputes.integration.go`, `flutterwaveWebhooks.integration.go` | L | **Done (stage 2)**: Standard checkout with `payload_hash`, verify by id then by `tx_ref`, tokenized charges pinned to the issuing email, refunds and refund lookup, chargebacks (poll + webhooks), banks, resolve (NG/GH), `verif-hash` + parser. UG resolve needs v4 (not built). |
| P2.6 | Wallet + payout adapter: PSA create/fetch/static accounts/balances/transactions, wallet moves, funding reversals, close; transfers with `debit_subaccount`, find by reference, fee | `flutterwaveWallets.integration.go`, `flutterwaveTransfers.integration.go` | L | **Done (stage 2)**: PSA create (idempotent by alias email)/fetch/find-by-NUBAN/static accounts/balance/statement, PSA↔PSA, PSA→main and main→PSA moves, funding reversals and their listing, close; transfers always `skip_beneficiary_creation`, never the retry endpoint, verify by reference. |
| P2.7 | Fake Flutterwave server for tests (PSAs, fundings, transfers with injected timeouts, chargebacks) | `payments/src/integrations/paymentsTesting/fakeFlutterwave*.util.go` | L | **Done (stage 2)**: `paymentsTesting/fakeFlutterwave*.util.go` + sandbox server (`TestServeFakeFlutterwaveForLocalApiSmoke`, `SANDBOX_PAYMENTS_PROVIDER=flutterwave`). |
| P2.8 | Schemas: `provider_wallets` (user, currency, provider, account_ref, barter_id, status, frozen_at), `provider_wallet_numbers`, `wallet_fundings` (unique provider ref), `provider_movements` (unique reference, kind, from/to, amount, status, attempts), `expected_migrations`; Atlas migration | `payments/src/databases/schema/*.schema.go`, `payments/src/migrations/` | M | **Done (stage 2)**: `provider_wallets`, `provider_wallet_numbers`, `wallet_fundings`, `provider_movements`, `reconciliation_runs`, `reconciliation_cases`; unique provider charge id (with duplicate clean-up), unique transfer and funding references. `expected_migrations` not built (P2.22). |
| P2.9 | Ledger accounts and an allowlist of reversible kinds (B11) | `ledger/src/modules/journal/models/chartOfAccounts.model.go`, `journalReversal.service.go` | S | **Done (stages 1–2)**: wallet outgoing/inbound/debt, direct-sale payable, chargeback receivable accounts. |
| P2.10 | KYC L1: BVN consent, result, resolve, name match; create the PSA at L1 | `payments/.../customerValidation.service.go`, `verificationLevels.service.go`, new `walletProvisioning.service.go`; `users` webhook for `bvn.completed` | M | **Done (stage 2)**: BVN consent start/poll/webhook, name match (BVN vs legal name vs bank name, ≥0.85), watchlist → manual review, PSA at L1 plus a provisioning worker. |
| P2.11 | Deposits: funding handler, verify via the transactions list, deposit hold, fee sweep, rejection reversal | new `payments/.../walletFundings.service.go`, `wallet/src/modules/payouts/services/depositHolds.service.go` | L | **Done (stage 2)**: funding webhook → NUBAN map → provider owner cross-check → statement verification → hold (24 h / 72 h first) → fee sweep movement → hold release job; staff rejection and bank reversals (debt + alert). |
| P2.12 | Escrow locked in the buyer's PSA: lock (card after settlement into the buyer PSA, wallet at once), release, refund, clawback status; drive delivery from the committed outbox event; fix B9, B12, B14 | `escrow/src/modules/escrows/services/escrowHolding|escrowSettlement|escrowFulfilment.service.go`, `orders/.../sellerOrderOperations.service.go`, `orders/.../orderPayment.service.go` | L | **Done (stage 2)**: buyer-PSA lock (wallet and card after settlement), release PSA→PSA then commission PSA→main, refund unlock / card refund before settlement, partial refund, clawback (`clawedBack`) with seller debt, chargeback recovery chain; escrow refunds now outbox-only; seller-silence escalation after 48 h. |
| P2.13 | Withdrawals on PSAs: step-up, velocity, 48 h new-account cooldown, name match, balance pre-check, one-row creation (B10, B18, B25) | `wallet/src/modules/payouts/routes/*`, `withdrawals.service.go`, `payoutRun.service.go`, `payments/.../sellerPayouts.service.go` | L | **Done (stage 2)**: withdrawals debit the user's PSA (`debit_subaccount`), balance pre-check, wallet debt and own-name checks, stage 1 step-up/velocity/cooldown kept. |
| P2.14 | Refund accounting fix (B4) and idempotency on saved-card charge and subscription checkout (B5, B6) | `paymentRefunds.service.go`, `savedCards.routes.go`, `savedCardCharges.service.go`, `connectedAccounts.routes.go`, `webSubscriptions.service.go` | M | **Done (stage 1).** |
| P2.15 | Renewals through tokenized charges; creator share hold and payout to the creator PSA | `subscriptions/.../renewalEngine.service.go`, `creators` payout run | M | **Partly (stage 2)**: renewals via tokenized charges with the pinned email; creator earnings paid main→creator PSA. Legacy Paystack-plan trials/bundles still need the Paystack Subscriptions API. |
| P2.16 | Ads, coins and boosts: card, plus wallet-to-main funding; use `ResolveChargingRegion` (B8); expiry-aware ad serve gate (B24) | `wallet/src/modules/adBalances/services/*`, `coins.controller.go`, `ads/src/utils/httpRequest.util.go`, `ads/.../adSettlement.service.go` | M | **Done (stage 2)**: card paths unchanged through the adapter; wallet payment (`/payments/wallet-payments/{ref}`) and ads-from-wallet move PSA→main; COUNTRY_REQUIRED instead of a USD fallback (subscriptions too). Boosts stop when the post is deleted (`post.deleted`) or the owner cancels; unspent wallet/balance budget is refunded through the outbox, card budget stays in the ad balance, an undelivered free boost gives the month back. Owner-approved limits, admin-configurable (`payments.limits`, `seller.debtLimits`): order ₦5m, coins ₦500k, ads top-up ₦10m, wallet ₦50k/₦200k/₦5m a day by KYC tier, seller debt ₦10k/₦50k/₦200k by level (half elsewhere, converted). |
| P2.17 | Chargeback polling and responses (evidence via `POST /v3/upload_image`, then `PUT /v3/chargebacks/{id}`; updated from API reference 2026-10-10); recovery chain | `payments/.../providerDisputes.service.go`, `escrow/.../escrowChargebacks.service.go` | M | **Done (stage 2)**: hourly poll of open and resolved chargebacks, withholding to `chargebackReceivable`, recovery buyer PSA → seller PSA → debt; evidence upload (`/upload_image`) not built. |
| P2.18 | Reconciliation jobs (section 2.3): per-PSA, main, settlements; cases and wallet freeze; alerts | new `payments/.../flutterwaveReconciliation.service.go`, `ledger/.../providerReconciliation.service.go` (B23) | M | **Done (stage 2)**: daily run (wallet vs provider vs liabilities, below-locked, debt, unknown statement lines incl. `_RETRY_`, main balance, settlements, reversals, stuck movements) with cases, wallet freezes, outbox `reconciliation.alertRaised` and an EMF metric. |
| P2.19 | Feature flags and provider routing per flow; admin config UI | `payments` container, `apps/admin` configuration | S | **Open**: per-flow flags not built; `PAYMENTS_PROVIDER` routes new intents. |
| P2.20 | Frontends: replace `@paystack/inline-js` with the Standard link redirect; wallet screen shows the PSA account number, deposit hold and fees; withdrawal step-up; update `apiContract.md` files | `apps/webapp/src/utils/paystackCheckout.util.ts`, `apps/seller/src/utils/paystackCheckout.util.ts`, `apps/mobile/src/utils/savedCard.util.ts`, `apps/mobile/src/services/payments.service.ts`, wallet screens, `apps/*/package.json` | L | **Partly (stage 2)**: country picker in mobile and webapp checkout. Hosted-link redirect, wallet screens and copy are stage 4. |
| P2.21 | Infra: secrets, NAT EIPs for whitelisting, WAF rule `/webhooks/flutterwave` (rate limit + header), egress allowlist `api.flutterwave.com` | `infra/aws/modules/platform/services.tf`, `variables.tf`, `infra/aws/modules/edge/waf.tf` | S | **Partly (stage 2)**: secrets wired, WAF hash rule + rate limit + log redaction. NAT EIPs and egress allowlist not done. |
| P2.22 | Migration tooling: Paystack → PSA balance transfer job with `expected_migrations`; subscription re-card prompts | `wallet` + `subscriptions` jobs | M | **Open.** |
| P2.23 | QA: frontend↔backend contract check; adversarial end-to-end runs (forged and replayed webhooks, timeout then retry, concurrent withdrawals, wrong-amount funding, reconciliation drift) against the fake server, then sandbox | `security/regression/*`, integration tests per module | L | **Done against the fake (stage 2)**; sandbox pending keys. |

Critical path: P2.0 → P2.1–P2.4 → P2.5–P2.8 → P2.10–P2.13 → P2.18 → P2.23. The others run alongside once P2.8 lands.

## Appendix A. Licence analysis and CBN tiers

Moved here from the former `paystackWalletKycPlan.md` (2026-10-11). Sources and citations are in the git history of that file.

### A.1 Where stored value starts

1. **Holding funds.** A per-user balance that can be spent later, withdrawn or sent to others is stored value. CBN puts wallet and e-money issuing under the MMO licence (₦2bn capital per secondary sources), with nominee settlement accounts and NDIC pass-through cover (CBN 2020 licence categories, 2021 MMS Guidelines). A PSSP licence does not cover it. With Flutterwave the PSA is held **in the user's own name** by the licensed partner, so Zudomart keeps a ledger mirror and never holds the money (§1).
2. **Outside stored value** (strongest to weakest; counsel to confirm): split at charge time to the seller; spend-from-earnings (set-off of money Zudomart already owes a seller or creator); prepaid ad credit usable only on Zudomart's ads, not transferable or withdrawable, refundable on closure; coins as closed-loop virtual items; escrow in a merchant balance (the old Paystack E2 grey area, removed by locking escrow in the buyer's own PSA).
3. **Would cross the line:** cash top-ups into a balance Zudomart controls that become withdrawable; user-to-user cash transfers from such a balance; interest.

### A.2 Verification levels

| Level | Who | How (NG) | Unlocks |
| --- | --- | --- | --- |
| L0 Account | Everyone | Verified email (email-only login) | Browse, buy by card, coins, gifts sent, sell escrow-only under the debt and sales limits |
| L1 Payout-verified | Sellers, creators, advertisers, wallet users | BVN consent and match against the legal and bank-account names (§5) | Wallet (PSA), withdrawals, creator cash, ads |
| L2 Identity-verified | Checkmarks; anyone above the L1 limits | Smile ID Biometric KYC with BVN or NIN (liveness and face match) | Checkmarks, higher limits |
| KYB | Gold business | Business-documents review | Gold; direct (non-escrow) payments |

Bank-account validation answers "does this account belong to the BVN holder?", never "is this person present?". A stolen BVN plus a mule account passes it; it fails Smile ID's liveness and face match. So payouts use provider validation and checkmarks and high limits use Smile ID.

### A.3 CBN KYC tiers and Zudomart limits

Zudomart is not a wallet issuer, so CBN tier limits bind its licensed partner rather than Zudomart directly. Mirroring them keeps the AML posture defensible. The owner approved these limits on 2026-10-11; all are admin settings (`seller.debtLimits`, `payments.limits`):

- **Wallet payments per day:** basic (L1) ₦50,000, mid (L2) ₦200,000, full (L2 + business verified) ₦5,000,000.
- **One payment:** order ₦5,000,000, coins ₦500,000, ads top-up ₦10,000,000.
- **Seller debt:** ₦10,000 (L0), ₦50,000 (L1), ₦200,000 (L2 or trusted); outside Nigeria half, converted.

CBN tiers for reference (figures conflict between sources; confirm the current CDD Regulations text):

| Tier | Identity | Single / daily limit | Max balance |
| --- | --- | --- | --- |
| 1 | Name, DOB, address, phone, photo; BVN **or** NIN mandatory since Dec 2023 | ₦50,000 single deposit / daily (some sources ₦30,000) | ₦300,000 |
| 2 | BVN **and** NIN, verified ID | ₦200,000 daily (some sources ₦500,000) | ₦500,000 |
| 3 | Full KYC (ID, address verification, BVN and NIN) | ₦5,000,000 daily | Unlimited |

The CBN Dec 2023 circular: no new Tier 1 accounts or wallets without BVN or NIN; funded accounts without one go on "Post No Debit or Credit".

### A.4 Unverified users and dormant balances (no forfeiture)

- **Sales:** an unverified seller sells escrow-only; proceeds are kept for them and shown as "Ready once you verify". Nothing is forfeited (forfeiture is void and an offence risk under FCCPA ss.127, 129, 155). Terms state this before the first sale (FCCPA s.128).
- **Creator cash:** earning features that create a cash liability (gift cash-out, creator subscriptions, ads revenue share) need L1 first. Unverified creators can still receive gifts as coins.
- **Refunding the payer** is right only for undelivered orders, which escrow already handles.
- **Dormant balances:** stay a liability; 12 months without login or verification marks the account dormant for reporting only; on deletion the balance stays payable within the retention period. The CBN July 2024 dormant-accounts guidelines (10 years to the Unclaimed Balances Trust Fund) and Finance Act 2020 s.77 (6 years, deposit money banks) probably bind the licensed partner rather than Zudomart; counsel decides. Never credit an unclaimed balance to revenue.
- **Prepaid ad credit:** refund unused credit on account closure or on request after 30 days of inactivity (card-funded to source, earnings-funded back to Available), deducting the disclosed processing fee.

### A.5 Questions for a Nigerian fintech lawyer

1. Does spend-from-earnings (set-off against our own ad services) count as mobile money or e-money business under the CBN 2020 licence categories and the 2021 MMS Guidelines?
2. Are prepaid ad credit and coins, usable only on Zudomart and not transferable or withdrawable, outside "e-money"?
3. Is locking escrow in the buyer's own PSA (held by the licensed partner) free of any escrow licence, and how long may a lock last?
4. Which KYC and AML duties apply to us as a marketplace (DNFBP and SCUML registration, NFIU reporting, applying CBN tier limits to payouts)?
5. Unverified users' balances: the right disclosure under FCCPA ss.127–128, and any dormancy destination (CBN UBTF, Finance Act 2020 s.77, or neither).
6. Is a "non-refundable prepaid balance" enforceable under FCCPA s.127?
7. Data: NDPA s.30 consent for biometrics; ss.41–43 basis for transfers to Smile ID, Flutterwave and AWS; DPIA and NDPC registration.
8. Ghana (local counsel): entity form, BoG PSP or PFTSP licensing under Act 987, DPC registration (Act 843), VAT Act 1151.

## Appendix B. Paystack reference (fallback provider)

Moved here from the former `docs/integrations/paystack.md` (2026-10-11). Paystack stays selectable with `PAYMENTS_PROVIDER=paystack` until P2.22 finishes the migration.

### B.1 Fees (Nigeria, snapshot 2026-02-05)

| Item | Fee |
| --- | --- |
| Local transactions (card, bank, USSD, bank transfer) | 1.5% + ₦100, ₦100 waived under ₦2,500, capped at ₦2,000 |
| International cards | 3.9% + ₦100 |
| Transfers | ₦10 (up to ₦5,000), ₦25 (₦5,001 to ₦50,000), ₦50 (above ₦50,000) |
| Dedicated Virtual Accounts | 1% per transaction, capped at ₦300 |
| Settlement | T+1, free |

Currencies: transactions and refunds NGN, GHS, ZAR, KES, USD; splits NGN, GHS, ZAR, USD; transfers NGN, ZAR, KES, GHS. Rate limits are not documented.

### B.2 Webhooks

`POST /webhooks/paystack` in go-money. Verify `x-paystack-signature` = hex(HMAC-SHA512(raw body, secret key)) in constant time (accept the previous key during rotation), optionally allowlist Paystack's IPs (`PAYSTACK_WEBHOOK_IP_ALLOWLIST`), dedupe on `event:data.id:data.status`, store the raw event, re-fetch the resource before posting ledger and outbox in one transaction. Live retries last 72 hours; sweepers cover longer outages. Transaction and transfer `reference`s are the idempotency keys (`chk-`, `po-`, `cr-`, `rf-`, `sub-` prefixes).

### B.3 Go-live checklist (Paystack)

Registered business activated with CAC documents; marketplace model explained to Paystack compliance in writing; live keys only in Secrets Manager and only in go-money; webhook and callback URLs set; transfer OTP disabled for automation; payment session timeout set; volume pricing requested; policies published; test-mode rehearsal of cards, transfers and webhook retries.

### B.4 What is built on Paystack (go-money, 2026-10-03)

Adapter (`payments/src/integrations/paystack*.integration.go`): initialize with splits, verify, charge authorization, refunds, banks and resolve, recipients and subaccounts, transfers, balance, settlements, plans, subscriptions, disputes. Escrow E2 (money in Zudomart's main balance, transfer after the 24 h lock); one payment per checkout with flat dynamic-split shares for direct groups; saved cards keep the `authorization_code` on the device only; reconciliation verifies pending intents and transfers by reference. Open with Paystack: checking the `split` object on verify, BVN validation for payees, E1 manual settlement, refund and chargeback treatment of split shares, and balance float for creator payouts.

## Appendix C. Checkout and payout rules

Moved here from the former `docs/checkoutPaymentFlowPlan.md` (2026-10-11). Provider-specific steps for Flutterwave are in §4; for Paystack in Appendix B.

### C.1 Rules

| Rule | Detail |
|---|---|
| Unverified store | Escrow is the only payment mode. |
| Verified store | The buyer picks Escrow or Pay directly. Verified = gold business checkmark after Zudomart KYB. |
| Escrow | Release when the buyer confirms delivery, or automatically 3 days after delivery (`escrow.policy`). A dispute pauses the timer; the seller has 48 h to answer before it escalates. |
| Direct | The seller is paid at charge time (Paystack split) or by PSA move (Flutterwave); Zudomart never holds that money. |
| Seller credit hold | Escrow releases become withdrawable after the hold in `escrow.policy` (default 24 h). |
| Payouts | Withdrawals and creator payouts run as provider transfers; only go-money calls the transfer API. |
| Visibility | Sellers see balances and payouts. Buyers see "Pay". No provider names in UI copy. |
| Digital goods | Coins, gifts, premium, boosts and creator subscriptions: in-app purchase in the apps, web checkout or wallet on the web. |
| Saved cards | The device stores the provider token only, never card data. |

### C.2 Who pays the fees

0% commission on products (owner, 2026-10-03). Escrow groups pay an escrow fee of 1.5% of the group total including shipping (1% for Business-plan sellers), deducted from the seller payout at release; no fee on refunded amounts. Direct groups pay no Zudomart fee; the seller covers only the provider's processing fee. Buyers pay nothing extra. A checkout's processing fee is allocated across its groups pro rata with the largest-remainder method.

### C.3 Escrow mechanics

Flutterwave: escrow is locked in the buyer's own PSA and moves PSA→PSA on release (§4). Paystack: E2, money in Zudomart's main balance until release, paid out by transfer after the hold; E1 manual-settlement subaccounts were never confirmed. Either way: unverified stores always escrow; a dispute or chargeback freezes the group; a refund after release is a clawback that can leave seller debt.

### C.4 Edge cases

- Webhook and callback both arrive: idempotent on reference and event key.
- Buyer pays twice for one checkout: refund the second payment.
- Chargeback after a direct share settled: seller debt, recovered from later earnings; above the debt limit new sales pause.
- Store loses verification: new checkouts are escrow-only; existing orders keep their mode.
- Provider outage: hide Pay, keep browse and cart; sweepers verify pending intents and transfers by reference afterwards.
- Amount mismatch: no fulfilment, refund, admin notice.

