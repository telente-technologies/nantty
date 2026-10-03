# Checkout, payment and payout flow plan (Bachs)

Owner direction, 2026-10-03 (fixed): **Zudomart does not hold anyone's money.** Payments run on Bachs only (https://docs.bachs.io). Paystack and Flutterwave are dropped. Every seller gets a Bachs connected account. Buyer payments are credited directly to the seller's account, and Zudomart's fee goes to Zudomart's own Bachs account. Escrow stays locked inside the seller's account until release.

Every Bachs claim cites its doc page. Anything the docs do not confirm is marked **UNCONFIRMED — ask Bachs**. This plan is not legal advice. See section 9.

## 1. Rules

| Rule | Detail |
|---|---|
| Unverified store | Escrow is the only payment mode. |
| Verified store | The buyer picks Escrow or Pay directly. Verified means the gold business checkmark after Zudomart KYB (admin-configurable). This is Zudomart's badge, separate from Bachs onboarding. |
| Success rate | completed ÷ (completed + seller-cancelled + seller-fault refunds + lost disputes), rolling 90 days, shown from 20 orders (admin setting). Server-computed. |
| Escrow | The money sits in the **seller's** Bachs account, not withdrawable until release. Release: buyer confirms delivery, or auto-release 3 days after delivery (admin-configurable). A dispute pauses the timer. |
| Direct | Same Bachs charge. In the ledger the money goes straight to the 24h lock. |
| 24-hour lock | Also lives in the seller's Bachs account. Only credits older than 24h are withdrawable. |
| Payout run | Withdrawals are queued and paid in a daily batch. Zudomart is the only party that calls the payout API. |
| Provider | Bachs only. The adapter interface leaves room for another provider later (one line, no active work). |
| Client UX | Hosted Bachs checkout. In the apps, it opens in an in-app browser with a deep-link return. Web uses the overlay or redirect (section 6). |
| Visibility | Sellers see balances and payouts only. Buyers see "Pay" only. No provider names in UI copy. |
| Digital goods | Coins, gifts, premium and boosts follow `architecture/payments.md` (IAP in the apps, Bachs on the web). Their money is Zudomart revenue and goes to Zudomart's own account. |

## 2. Bachs setup

### 2.1 Charge type: direct charge

The seller account is the merchant of record. `X-Account-Id: acct_...` on `POST /v1/checkout-sessions` designates a direct charge (https://docs.bachs.io/connect/split-payments/direct). On direct charges:

- "The account is the merchant of record, the sale lands in its balance." Zudomart's `platform_fee` is deducted from the account's proceeds and settles to Zudomart's balance as its own record (direct).
- The account bears refunds and disputes: "A refund debits the account's balance." A lost dispute drains the account's available balance, then its pending balance (direct; https://docs.bachs.io/connect/disputes).
- Sending `X-Account-Id` and `transfer_data` together is an error (direct).

Why not a destination charge: the charge lands in the **platform's** balance, the platform is the merchant, and the platform bears all refunds and lost disputes (https://docs.bachs.io/connect/split-payments/destination). That is exactly the "Zudomart holds the money" model the owner rejected.

**Caveat to raise with the owner.** Bachs recommends the opposite for most marketplaces: "Most marketplaces should collect" (https://docs.bachs.io/connect/choose-your-integration). Direct charges mean the account "needs a payment-accepting capability, which lengthens its requirements" (same page), so seller onboarding is heavier.

### 2.2 Seller account

`POST /v1/accounts` with `contact_email`, `entity_type` (`individual` or `company`), `configuration` and `responsibilities` (https://docs.bachs.io/connect/accounts).

- Personas: `merchant` (collection capabilities) and `recipient` (`payouts`, `transfers`, `conversions`). A seller needs **both** (accounts).
- Merchant capabilities needed for Nigeria: `ngn_card_collection` (Nigerian cards in NGN) and `bank_transfer`. `card_collection` alone does not enable naira cards (https://docs.bachs.io/connect/capabilities).
- Capabilities are requested at creation or update and enabled on review. In production a request lands `restricted` until a reviewer enables it (https://docs.bachs.io/connect/go-live). Gate on `status == "active"` (capabilities).
- `responsibilities.fees.collector` is immutable after creation: `bachs` (default, net settlement) or `platform` (gross settlement) (accounts). **Recommendation:** `bachs`. Separately, `fee_handling` / `customer_bears_fee` decide whether the seller or the buyer pays the processing fee (https://docs.bachs.io/connect/processing-fees).
- Connected accounts have no API keys or logins of their own. One platform key plus `X-Account-Id` decides whose behalf a call is on (https://docs.bachs.io/connect/acting-as-an-account). This is what makes the escrow lock enforceable (section 4). It is also why section 9 matters.
- Platform prerequisite: Zudomart must hold an active `connect` capability on its own live account, with business registration, ownership documents and a business bank account (https://docs.bachs.io/connect/become-a-platform, go-live).

### 2.3 Onboarding

- Use **hosted onboarding**: `POST /v1/accounts/{id}/account-links` with `type` (`onboarding` or `update`), `refresh_url`, `return_url`. Links expire after one hour, and creating a new link invalidates the previous one (https://docs.bachs.io/connect/guides/hosted-onboarding).
- Create a link only when the seller taps "Continue verification", never on page render (onboarding page).
- The return redirect fires even if the seller abandoned the flow. Unlock selling only on the `capability.updated` webhook with `status: "active"` (hosted-onboarding, https://docs.bachs.io/connect/onboarding).
- API onboarding (own UI) is possible but needs maintenance as requirements change (https://docs.bachs.io/connect/guides/api-onboarding). Not recommended at launch.
- Mobile behaviour of hosted onboarding links: UNCONFIRMED — ask Bachs. Plan: open in the in-app browser (section 6).

### 2.4 KYC (answer e)

- Individuals: name, date of birth, address, email, phone and a government ID number (NIN, passport or **BVN** for Nigeria). Registered businesses: registration number, structure and country filings (KYB). Merchants also need a business profile (product description, support email, category). A payout destination (bank account for NGN) is required (https://docs.bachs.io/connect/requirements).
- A reviewer verifies the person's ID document: pending, passed or failed. A passing person does not by itself enable a capability (https://docs.bachs.io/connect/guides/identity-verification).
- Each outstanding field lists `restricts_capabilities` and a deadline. Surface `current_deadline` as a banner (requirements).
- Creators: a recipient-only account has short requirements: "identity and a payout destination, little else" (api-onboarding).
- An NGN virtual account needs the representative's BVN submitted as a person entry plus a capability approval (https://docs.bachs.io/for-you/virtual-accounts). Optional for Zudomart (section 7).
- UNCONFIRMED — ask Bachs: whether an `individual` seller (no CAC registration) can hold the merchant capabilities, and whether Bachs or Zudomart is the party responsible for KYC of connected accounts (become-a-platform does not say).

Zudomart's own tiers (unverified / verified, payout limits) sit on top of Bachs's pass/fail.

## 3. Balance states: Bachs balance mapped to the Zudomart ledger

**Bachs holds the money. The Zudomart ledger is a mirror and record, not custody.** Bachs exposes only `pending_balance` (charged, awaiting settlement, cannot be moved) and `available_balance`, per currency, with `pending_settlements_by_day` (https://docs.bachs.io/connect/balances). There is no reserve or held field (balances), so every Zudomart state below is a ledger label over those two Bachs numbers.

| Zudomart state | Where the money is | Rule |
|---|---|---|
| Awaiting settlement | Seller account `pending_balance` | Not movable (balances). Webhook `collection.succeeded` marks the order paid. |
| In escrow | Seller account, settled | Ledger-locked. No payout is ever created for it. |
| Locked 24h | Seller account | Escrow released or direct payment settled. `availableAt = release + 24h`. |
| Available | Seller account | Withdrawable. Capped by `min(ledger available, Bachs available_balance)`. |
| Payout requested | Seller account | Ledger reservation before `POST /v1/payouts`. |
| Payout in flight | Bachs payout `pending` | Resolved by `payout.paid` or `payout.failed` webhook. |
| Paid out | Seller's bank | `payout.paid`. |
| Debt | Seller account negative | Lost dispute or unfunded refund. Blocks every payout for that account, in every currency (https://docs.bachs.io/connect/payouts, disputes). |

Release itself moves no money. It is a ledger transition, because the funds are already in the seller account. The only thing that can pull money out is a payout call, and only Zudomart can make it.

**Mirror integrity.**

- Zudomart's own revenue (platform fees, coin sales, ads, subscriptions) is in Zudomart's own Bachs account, so it owes nobody.
- Per seller: `Σ seller ledger states = Bachs pending + available ± in-flight payouts`. A nightly job compares via `GET /v1/balances` with `X-Account-Id` (https://docs.bachs.io/connect/walkthroughs/marketplace).
- On mismatch: freeze that seller's payouts and alert. Bachs's balance wins.
- Platform fee: `platform_fee` is a fee-first record queryable at `GET /v1/platform_fees` (https://docs.bachs.io/connect/platform-fees). Reconcile it against the `platform:fees` ledger account.

## 4. Escrow lock mechanics (answer b)

Bachs has no documented "hold" feature. The documented levers are:

1. **Payout schedule `manual`**: "No automation; requires explicit Create Payout calls" (https://docs.bachs.io/guides/payouts/payout-schedules). The platform sets schedules per account via `X-Account-Id` at onboarding (payout-schedules).
2. **Platform-only API access**: accounts have no keys (https://docs.bachs.io/connect/acting-as-an-account). Combined with manual schedules, funds leave only when Zudomart calls `POST /v1/payouts` with `X-Account-Id` (https://docs.bachs.io/guides/payouts/payout-using-api).
3. Production keys scoped narrowly: `connected_accounts:write`, `transfers:write`, `payouts:write` (go-live). Keep the payout key in go-money only.
4. An account's first payout is held for a one-time review and completes a few minutes later (https://docs.bachs.io/connect/money-movement).

Open risks, all **UNCONFIRMED — ask Bachs**:

- payout-schedules says "Account holders may later adjust their own settings from their dashboard", while acting-as says accounts have no logins. Does a connected account ever get a dashboard that could change its schedule or withdraw?
- A `balance_settings` page does not exist at `/api-reference/balance-settings/object` (404). Is there any balance or payout setting that can lock funds at Bachs's side (reserve, hold, minimum)?
- Can Zudomart leave the `payouts` capability inactive on a seller until release, as an extra lock? Capability changes need review, so this is probably too slow.

**Rolling reserve.** There is no native reserve. Zudomart keeps a configurable percentage of a risky seller's balance un-withdrawable in the ledger (the withdrawable cap in section 3).

## 5. Checkout flows

### 5.1 Paying for an order group

Bachs direct charges are per account (`X-Account-Id` selects one). The docs show no way to charge one checkout across several accounts. **A multi-seller cart therefore becomes one Bachs checkout per seller group**, and the buyer pays once per group (sequentially or one after another in the in-app browser). **UNCONFIRMED — ask Bachs:** is there any way to charge once and split across sellers without the platform collecting (that would be a destination charge, which Zudomart rejects)? Product impact: the "one payment, split per group" UX from the old plan is gone. The cart screen must show N payments for N sellers, or cap checkouts to one seller at a time.

1. `POST /checkout` (go-commerce): recompute each group including shipping and commission. Unverified stores force `paymentMode=escrow`. Direct for an unverified store is a 422.
2. `POST /payments/intents` (go-money), per group, with an idempotency key and the server-computed amount. The adapter calls `POST /v1/checkout-sessions` with:
   - `X-Account-Id` = the seller's account
   - `platform_fee` = Zudomart commission in the sale's currency (decimal string at currency precision, between zero and the gross amount; https://docs.bachs.io/connect/platform-fees)
   - `reference` = the order group id (max 128 chars, unique per org; https://docs.bachs.io/guides/checkout/checkout-sessions)
   - `metadata` (up to 20 pairs): checkout id, order group id, payment mode
   - `expires_in_minutes`: match the 15-minute stock reservation
   - `success_url` / `cancel_url`: universal links (section 6)
   - Money is a decimal string, never minor units (https://docs.bachs.io/connect/marketplaces/accept-a-payment). The adapter converts at the boundary.
3. The buyer pays on the hosted page. **Confirmation only from a signature-verified `collection.succeeded` webhook** (section 8). Redirects and overlay events are never trusted (checkout-sessions, https://docs.bachs.io/guides/checkout/overlay-checkout).
4. On confirmation, in one ledger transaction per group:
   - Escrow group: mirror `awaiting settlement → in escrow`.
   - Direct group: mirror `→ locked 24h`.
   - The `platform_fee` is recorded as a receivable to `platform:fees` and reconciled when the platform fee record settles.
5. **Escrow release**: delivered and buyer confirms, or the timer ends 3 days after delivery. Dispute pauses it. The ledger moves `in escrow → locked 24h`. No Bachs call.
6. **Maturing job** (every 5 minutes): `locked → available` when `availableAt ≤ now` and the Bachs balance covers it. A seller's first release also waits for settlement: charges stay `pending_balance` until settled (balances).
7. **`POST /withdrawals`**: limited to available, verified payout destination, KYC tier.
8. **Daily payout run** (section 5.3).

### 5.2 Fees

- Bachs processing fee rates (https://docs.bachs.io/for-you/fees): NGN bank transfer at checkout 1.5% capped at NGN 2,000, local cards 2%, virtual account deposit 1.5% capped at NGN 300. NGN payout NGN 50 flat. Dispute fee USD 15 per dispute. Refunds have no Bachs fee. Rates "can be set per account" (https://docs.bachs.io/connect/processing-fees), so ask for custom pricing.
- Who pays the processing fee is a product decision: seller (`account_pays_fee`) or buyer (`customer_bears_fee`). Default recommendation: seller pays, inside the commission quote shown to sellers.
- A platform fee is not reversed on refund (platform-fees). This drives the refund top-up in 5.4.

### 5.3 Payout run (answers b and the "daily batch")

- Daily at a configured UTC hour, go-money selects each seller's `available` ledger amount, capped by `Bachs available_balance`.
- `POST /v1/payouts` with `X-Account-Id`, `destination` (`pd_...`), `amount`, `reference` and `Idempotency-Key` derived from our payout id (https://docs.bachs.io/guides/payouts/payout-using-api). Amount is what the seller **receives** and the fee is charged on top, so the account balance must cover amount + fee. The run pays `available − fee` and deducts the NGN 50 fee from the seller's withdrawal in the quote.
- `201` is not completion. The ledger resolves on `payout.paid` or `payout.failed`: success books paid-out, failure returns the amount to `available` and notifies the seller (payout-using-api, https://docs.bachs.io/connect/payouts).
- There is no cancel after creation (connect/payouts). Check balance and risk policy before calling.
- Use the first-payout review delay in seller copy ("your first payout can take a few extra minutes").
- Payout destination (bank account) is verified with `POST /v1/misc/bank-accounts/resolve` (api-onboarding).

### 5.4 Refunds (answer c)

- `POST /v1/refunds`, partial supported with `amount` in the settlement currency. One refund per payment. Statuses `processing`, `success`, `failed`; `refund.paid` does not mean the buyer sees the money yet. Card refunds take 5 to 7 working days, mobile money and bank transfer 1 to 7 (https://docs.bachs.io/guides/refunds).
- **NGN bank-transfer payments cannot be refunded** (refunds). For those, Zudomart pays the buyer back with a payout from the seller account (`X-Account-Id`) to the buyer's bank destination, with the buyer's bank details collected at refund time. **UNCONFIRMED — ask Bachs:** is that payout-as-refund acceptable, and what is the refund path for bank transfers.
- On a direct charge the refund debits the **seller account** for the full amount the buyer paid, even though the seller received it net of platform fee. Platform and processing fees are not reversed (https://docs.bachs.io/connect/refunds). If the account lacks funds the refund is rejected, with no overdraft (connect/refunds).
- Zudomart's rule: before refunding, transfer the platform fee (and per policy the processing fee) back to the seller account with `POST /v1/transfers` (platform to account, `transfer_group` = order group id), so the full refund can be debited from escrow. The fee refund is a Zudomart revenue reversal. Which fees Zudomart absorbs is a finance decision.
- `refund.created`, `refund.paid`, `refund.failed` drive the ledger. Escrow refund: `in escrow → refunded`.
- If funds were already paid out, the refund draws on the account's remaining balance and fails if it is short. Fallback: a ledger debt on the seller, recovered from future settlements (section 5.5).
- A transfer cannot be reversed: "cannot be cancelled or reversed", recovery needs a transfer back in the opposite direction (https://docs.bachs.io/connect/transfers). A transfer back works only while the account still holds the money (https://docs.bachs.io/connect/money-movement).

### 5.5 Disputes and chargebacks (answer c)

- `dispute.created` and `dispute.updated` webhooks (events list). Poll **List Disputes** as well; email alone is not enough (https://docs.bachs.io/connect/marketplaces/refunds-and-disputes).
- On a direct charge the account is liable. A lost dispute drains the account's available then pending balance and can leave it negative. Negative in any currency freezes every transfer and withdrawal for that account (connect/disputes). Escrow funds still in the account act as the buffer.
- The dispute fee (USD 15) debits when the dispute opens and is not refunded on a win (connect/disputes). Early dispute warnings cost USD 29 per payment (https://docs.bachs.io/for-you/fees).
- On direct charges with a platform fee, a lost dispute leaves the account short by more than it was credited (connect/disputes). Decision for finance: absorb the fee share or recover from the seller.
- Zudomart submits evidence on the seller's behalf using the dispute API with `X-Account-Id` (https://docs.bachs.io/guides/disputes/overview; connect/disputes).
- When a dispute opens on an order group: freeze its escrow ledger entry and pause the auto-release timer. Card chargebacks can land after payout, so the rolling reserve (section 4) and debt recovery apply.
- **Zudomart's own buyer-seller disputes** (item not as described) stay in Zudomart's dispute flow and end in a Bachs refund or a release.

## 6. Clients (answer g)

Native SDK: the docs describe none. There is an overlay JS SDK (`bachs.js`, `@bachs/js`) that loads the hosted checkout in an iframe modal. It is documented for web only, and webview compatibility is not stated (https://docs.bachs.io/guides/checkout/overlay-checkout). The payment-method page says nothing on mobile SDKs, webviews or 3DS (https://docs.bachs.io/guides/payments/payment-method-support). **Plan: hosted checkout everywhere, no native Bachs SDK.** Confidence that no native mobile SDK exists in the docs: high. Confidence that hosted checkout works in an in-app browser: medium, UNCONFIRMED — ask Bachs (3DS, bank-transfer app switching).

- **Mobile (apps/mobile).**
  - Open `checkout_url` in an in-app browser (`expo-web-browser`, `openAuthSessionAsync`).
  - `success_url` and `cancel_url` are HTTPS universal links (for example `https://zudomart.com/pay/return?group=...`) that the app claims, so the browser closes and returns to the app. UNCONFIRMED — ask Bachs: do they accept custom URL schemes?
  - The return only says "go and look". Show "Confirming payment…" until the server confirms via the `collection.succeeded` webhook (realtime or push, polling fallback).
  - Seller onboarding opens `account-links` the same way, with a deep-link `return_url` and a `refresh_url` handler that issues a fresh link (hosted-onboarding).
- **Webapp.** Overlay (`bachs.js`) with the hosted redirect as fallback. Confirmation is server-side.
- **Product and store pages.** Verified stores show a badge and "98% success rate · 1.2k orders". Unverified stores show "Protected by Zudomart Escrow".
- **Checkout per seller group.** Unverified: fixed escrow line. Verified: radio between Escrow (recommended) and Pay directly. With N sellers, show N payment steps.
- **Seller area.** Balance cards: Available, Locked (with available-at), In escrow, Awaiting settlement, Payout requested, Debt. Withdraw with the next run time and the first-payout note. A verification card shows Bachs onboarding progress and the Zudomart verified-store path.
- **Admin.** Settings (hold period, auto-release days, success-rate minimum, verification rules, reserve percentages), payout run monitor, mirror mismatches, manual hold or release, audit log.

## 7. Platform revenue and creator money

Everything here uses **Zudomart's own Bachs account**, with no `X-Account-Id` (collections land in the platform balance; https://docs.bachs.io/connect/money-movement). It is Zudomart's own revenue, so it owes nobody except the creator shares below.

### 7.1 Ads billing

- Advertiser pays by Bachs hosted checkout on the platform account (web `ads.` app), or by NGN deposit to a Zudomart virtual account (platform virtual accounts are supported; https://docs.bachs.io/for-you/virtual-accounts). Each deposit becomes a payment on the receiving account.
- Spend is recognised as consumed. **Risk flag:** prepaid ad credit is money the advertiser has paid and Zudomart has not yet earned. Prefer postpaid or low-threshold top-ups, or write the credit as non-refundable service credit. Needs a lawyer (section 9).
- Ads revenue share to creators follows 7.3.

### 7.2 Coins, subscriptions

- Web coin packs, seller plans and creator subscriptions are sold by Bachs checkout on the platform account. Bachs offers subscriptions with cards only, NGN card availability limited, and bank transfer or mobile money for one-time only (https://docs.bachs.io/guides/payments/payment-method-support). Seller plans: monthly one-time renewals, or cards only. Subscription billing adds 0.5% on billing volume ("coming soon" in https://docs.bachs.io/for-you/fees).
- In the apps, coins use Apple and Google in-app purchase. That money reaches Zudomart through the stores, not Bachs.
- **Coin pricing (1 coin is not NGN 1).** Per-channel coin pack table, built like this:
  1. Finance sets the target **net value per coin** `n` (net NGN per coin after all channel costs), for example NGN 10 (illustrative only).
  2. For each channel, pick the price tier `P` the channel sells at, then `coins = floor(P × (1 − fee_c) ÷ n)`.
  3. `fee_c`: app_ios and app_android use the store cut (15% for small business programs, 30% standard; re-check each programme and the store's tax treatment), web uses the Bachs processing rate (about 2% for local cards, 1.5% capped for bank transfer; https://docs.bachs.io/for-you/fees).
  4. Illustration at `n = 10`: P = 1,500 gives 105 coins at 30% (1,500 × 0.70 ÷ 10), 119 at 15% (1,500 × 0.85 ÷ 10), and about 147 on web (1,500 × 0.98 ÷ 10). The web buyer gets more coins per naira and Zudomart nets the same per coin.
  5. `CoinPack` has `channel` (`app_ios`, `app_android`, `web`) and per-channel price and coin amount. A pack is a coins count by channel; tiers are the store's price points.
- **Steering rule.** In-app, never link to, name or hint at the cheaper web price in any region where the store forbids it. US and EU anti-steering rules may allow it. **Flag: re-check Apple 3.1 and Google Play payments policy, regional programmes, and each region's current anti-steering rules before launch and each major release.** Default is no steering anywhere.

### 7.3 Creator gift earnings (answer d)

- Gifts are digital and bought with coins, so the cash is Zudomart revenue (7.2). The creator's share is a payable Zudomart owes the creator.
- Creator account: Bachs `recipient` configuration with `transfers` and `payouts` active, identity and bank destination only (https://docs.bachs.io/connect/payout-networks; api-onboarding). A seller who is also a creator keeps one account with both personas.
- Pay from Zudomart's balance:
  1. Creator requests cash-out (minimum payout enforced) or an accrual job runs.
  2. `POST /v1/transfers` (platform to creator account), decimal string amount, one transfer per creator because "there is no batch endpoint", all tagged with one `transfer_group` for the run (payout-networks, https://docs.bachs.io/connect/transfers).
  3. Then `POST /v1/payouts` with `X-Account-Id` to the creator's bank destination.
  4. The `transfer.created` and `payout.paid` webhooks close the ledger entries.
- Transfers draw only on the platform's `available_balance` and fail with `INSUFFICIENT_BALANCE` otherwise. Check the balance before a run (payout-networks, https://docs.bachs.io/connect/balances).
- **Funding gap.** IAP proceeds arrive from Apple and Google into Zudomart's bank, not into Bachs. Creator payouts need Zudomart's Bachs balance funded, by NGN virtual-account deposit. Treasury process needed. UNCONFIRMED — ask Bachs: platform top-up methods and limits.
- **Accrued creator earnings are money Zudomart owes**. To limit holding time, transfer creator shares to creator accounts on a short cycle (daily or weekly) rather than only at cash-out. Unspent coins are stored-value risk: flag to the lawyer.
- Payout networks: the docs give NGN examples only and list no rails or countries for creators. UNCONFIRMED — ask Bachs: supported payout countries and currencies (https://docs.bachs.io/connect/payout-networks).

## 8. Webhooks and idempotency (answer f)

**Webhook verification** (https://docs.bachs.io/guides/webhooks/overview):

- Headers `X-Bachs-Signature-V2` (preferred) and `X-Bachs-Signature` (legacy). Algorithm: HMAC-SHA256 hex digest of `{timestamp}.{raw_body}` with the signing secret.
- Read the **raw body** before parsing. Default tolerance 300 seconds. Compare in constant time.
- Delivery is at-least-once. Deduplicate on the event `id` (`evt_...`). No ordering guarantee is documented, so every handler must be a conditional state transition and treat events as hints to re-fetch (`GET` the payment, transfer or payout) before posting to the ledger.
- Event shape: `id`, `type`, `created_at`, `organization_id`, `data`. For Connect events the endpoint needs `event_source` set to `connect` or `all`; `organization_id` is then the connected account and a top-level `account` field carries the same id (webhooks overview).
- `collection.succeeded` carries `reference`, `checkout_id`, `charge_id`, `status` (`SUCCEEDED`, `ACCEPTED`, `OVERPAID`), `amount`, `settlement_amount`, `processing_fee`, `fee_bearer`, `metadata` (https://docs.bachs.io/guides/webhooks/events/collection-succeeded). Verify amount, currency and `reference` against the pending payment before marking paid. Handle `collection.failed` and `collection.underpaid` (events list).
- Webhooks to subscribe to: `checkout.completed`, `checkout.expired`, `collection.succeeded|failed|underpaid`, `refund.created|paid|failed`, `payout.created|paid|failed`, `dispute.created|updated`, `account.updated`, `capability.updated`, `transfer.created`.
- UNCONFIRMED — ask Bachs: the name of the timestamp header, signing-secret rotation, and the retry schedule.
- Signing secrets differ between sandbox and production (go-live). The gateway must not re-serialise webhook JSON; keep `/webhooks/*` off the gateway (existing devops decision).

**Idempotency** (https://docs.bachs.io/guides/idempotency):

- `Idempotency-Key` header on every POST to `/v1/`. Same key and same body returns the cached 2xx response for 24 hours. Same key with a different body returns `409 IDEMPOTENCY_CONFLICT`. 4xx and 5xx are not cached.
- Derive keys from our own ids, never random per attempt: `chk:{orderGroupId}`, `refund:{refundId}`, `fee-topup:{refundId}`, `payout:{payoutId}`, `creator:{runId}:{creatorId}`.
- Do not treat a network or 5xx error on a transfer as not created: GET the transfer before retrying (transfers).
- Bachs's cache lasts 24 hours, so go-money's own durable idempotency record (Postgres) remains the long-term guard, plus the unique checkout `reference`.

## 9. Open questions

**For the owner and a Nigerian fintech lawyer (before launch):**

1. **Control of funds.** Under Connect, the docs say "Your platform holds and controls all funds" and that connected accounts are "kept separate from yours but controlled by you" (https://docs.bachs.io/connect/overview). Even with direct charges, Zudomart alone decides when escrowed money leaves a seller account. A regulator could still treat Zudomart as controlling or escrowing the funds. This design reduces exposure and does not remove it. The docs contain no licensing statement (overview, become-a-platform, choose-your-integration). Get Bachs's written licensing position and confirm the escrow-in-seller-account model with counsel.
2. Prepaid ad credit and unspent coins as stored value.
3. Who bears the platform fee and processing fee on refunds and lost disputes.
4. Escrow auto-release period (default 3 days) and whether direct-payment refunds need seller approval.
5. Multi-seller cart UX with one payment per seller.

**Questions to send Bachs:**

1. Is the escrow design (manual schedule, platform-only payouts) supported? Is there any hold, reserve or `balance_settings` control? Can a connected account ever log in or change its schedule?
2. Can one buyer payment be charged once and split to several seller accounts without the platform collecting?
3. Can an `individual` seller hold `ngn_card_collection` and `bank_transfer`? Who is responsible for KYC of connected accounts? BVN-only versus CAC for small sellers?
4. Refund path for NGN bank transfers, and whether refunds return the processing fee. Is a payout to the buyer from the seller account acceptable?
5. Does the platform fee on direct charges settle to Zudomart on settlement of the charge or on the account's payout schedule?
6. Hosted checkout and onboarding in an in-app browser: custom-scheme `success_url`, 3DS, bank-transfer app switching. Any native SDK plans?
7. Webhook timestamp header name, secret rotation, retry schedule. Custom pricing and platform virtual accounts.
8. Creator payout rails and countries. Platform balance top-up methods and limits.
9. Written regulatory position (licence, settlement bank) for Connect marketplaces in Nigeria.

## 10. Edge cases

- Webhook and client callback both arrive: idempotent on `reference` and event id.
- Buyer pays twice for one group: refund the second payment.
- Chargeback after payout: seller account negative, all payouts blocked, debt recovered from future settlements, rolling reserve applies.
- Store loses verification: new checkouts forced to escrow, existing orders keep their mode.
- Seller account capability goes `restricted`: stop new checkouts for the store, existing escrow keeps running to release and payout subject to Bachs.
- Checkout session expires (`checkout.expired`): release the stock reservation.
- Payment `underpaid`/`overpaid`: hold the group, notify, resolve by admin.

## 11. Changes needed in services/go money modules

Checklist for the implementing agent. Files are the current Paystack-era code.

- [ ] Add `services/go/modules/payments/src/integrations/bachsConnect.integration.go` implementing the provider interface: create account, account link, create checkout session (with `X-Account-Id`, `platform_fee`, `reference`, `metadata`), get checkout, refunds, transfers, payouts, balances, bank resolve, disputes (list, evidence, submit).
- [ ] Add a fake Bachs API next to `paymentsTesting/fakePaystack.util.go` for integration tests. Delete `paystack.integration.go`, `flutterwave.integration.go`, `fakePaystack.util.go` and the Paystack references in `payments.config.go`, `payments.constant.go`, `payments.container.go`, `webhookSignatures.integration_test.go`, `checkoutPayments.validator.go`.
- [ ] Replace `modules/wallet/src/integrations/paystackTransferSettlement.integration.go` with a Bachs payout and transfer settlement adapter. Update `wallet.config.go`, `wallet.container.go`, `coins.validator.go`.
- [ ] Webhook endpoint `POST /webhooks/bachs`: raw-body HMAC-SHA256 verification of `{timestamp}.{raw_body}` with `X-Bachs-Signature-V2`, 300 second tolerance, `WebhookEvent` unique on the event id, re-fetch before ledger posting, handle all events in section 8.
- [ ] Seller account lifecycle in go-money (or go-identity, owner to decide): `connected_account` table (`seller/store id`, Bachs account id, capability statuses, requirements summary, payout schedule = manual), create at store creation, `account-links` endpoint, `capability.updated` and `account.updated` handlers gating checkout.
- [ ] Checkout: one Bachs checkout per seller group, `reference` = order group id, commission as `platform_fee` computed at charge time, expiry matched to the stock reservation, success and cancel universal links. Update `CheckoutMoneyService` and go-commerce flow for N payment steps.
- [ ] Ledger: rework seller accounts to the mirror states in section 3 and add `awaiting_settlement`, `debt`. Ledger postings come from webhooks only. Add per-seller mirror reconciliation against `GET /v1/balances` with `X-Account-Id`; freeze payouts on mismatch. Drop `platform:clearing:*` accounts and keep `platform:fees`, `platform:refunds`, `platform:sellerReserve`.
- [ ] Escrow: release becomes a ledger transition only, no money movement. Keep auto-release 3 days after delivery with dispute pause, and the 24h lock job, with the withdrawable cap `min(ledger available, Bachs available)`.
- [ ] Payout run: replace the batch Transfers with per-seller `POST /v1/payouts` (`X-Account-Id`, `Idempotency-Key` = `payout:{id}`), fee-on-top handling, resolve on `payout.paid` / `payout.failed`, never on the `201`. Add the first-payout delay copy and the debt block.
- [ ] Refunds: pre-refund fee top-up transfer (platform to seller account) with its own key, then `POST /v1/refunds`. NGN bank-transfer refunds go through the payout-to-buyer path. Handle `INSUFFICIENT_BALANCE` and the unfunded-refund ledger debt.
- [ ] Disputes: poll List Disputes, handle `dispute.created|updated`, freeze escrow, evidence submission with `X-Account-Id`.
- [ ] Creator payouts: per-creator `POST /v1/transfers` with one `transfer_group` per run, balance pre-check, then payout. Add a recipient-only creator account flow.
- [ ] Platform revenue: web coin packs, seller plans, ads top-ups use platform-account checkouts (no `X-Account-Id`). Add `CoinPack.channel`, per-channel price and coins, and IAP verifiers (Apple StoreKit 2 JWS plus Notifications v2, Google Play Developer API plus RTDN) before any mobile coin sale.
- [ ] Config: Bachs API base URL (`https://api.bachs.io`, `https://sandbox-api.bachs.io`), `sk_sandbox_` keys, separate sandbox and production signing secrets, scoped production keys, secrets in the secret store.
- [ ] Update `.github/workflows/backend.yml` and `services/go/.env.example` for the Bachs variables. Update the `paystack.integration.go` mention in `architecture/backend.md`, the webhook route in `architecture/devops.md` and `architecture/security.md`, `architecture/system.md`, `architecture/privacy.md` and `architecture/disaster-recovery.md` (one-provider failure mode: hide the pay button, keep browse and cart).
