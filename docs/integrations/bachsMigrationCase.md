# Should Zudomart move payments back to Bachs?

Reviewed 2026-10-10 against the live Bachs docs (https://docs.bachs.io, every page cited in section 12), https://bachs.io/pricing and https://bachs.io, and against our code and the docs `docs/integrations/paystack.md`, `docs/integrations/smileId.md`, `docs/checkoutPaymentFlowPlan.md` and `docs/architecture/payments.md`. The earlier Bachs review (deleted 2026-10-03, still in git as `79aa2f7c1:docs/integrations/bachs.md`) was used as a baseline, and every point taken from it was re-checked live. This is not legal advice. Anything the Bachs docs do not state is marked **UNCONFIRMED: ask Bachs**.

## 1. Executive summary

**Recommendation: stay on Paystack, keep Smile ID, and do not migrate now, either fully or as the proposed hybrid.** Re-open the question when Bachs answers the gating questions in section 11 in writing. If the owner still wants Bachs virtual accounts for creators, the only reasonable option is a small, flag-gated **creator-payout pilot** (section 10.1). Checkout, escrow, refunds, saved cards and subscriptions must stay on Paystack.

Why:

1. **Virtual accounts do not fix what made us leave Bachs.** We dropped Bachs because of card checkout and subscriptions. Both are still weak:
   - NGN cards are "Beta" at 2% with no cap.
   - NGN card subscriptions are "Limited availability" ("Subscriptions currently bill USD cards only").
   - An NGN card cannot start a free trial, and cannot be saved except while the customer pays.
   - The saved-card charge API is still in beta.
2. **Three Bachs rules break flows we already ship:**
   - **"A payment takes one refund."** We refund one checkout transaction several times, once per seller group, and for checkmark-share refunds.
   - **NGN bank-transfer payments "can't be refunded"**; the docs say to send a payout instead.
   - **There is no API to create a subscription.** A subscription is created only by completing a checkout, so our trial flow (verification charge, then `start_date`) and our own renewal engine have no equivalent.
3. **The hybrid moves money through Zudomart.** In the hybrid, Paystack collects and Bachs pays out. Seller money would have to travel from Paystack to Zudomart's bank and then into a Bachs balance before any payout. That is exactly the "Zudomart holds nobody's money" problem, and it adds a day of float, NGN 5,000,000 per-day virtual-account deposit caps and a second reconciliation surface.
4. **Creators do not need a virtual account to receive earnings.** A virtual account is an *inbound* bank-transfer rail. Creator earnings (gifts, coins, subscriptions) are already inside Zudomart's ledger and leave by transfer. Paystack transfer recipients already cover this, at NGN 10 to 50 per transfer against Bachs's NGN 50. On Bachs, a virtual account is also a `merchant` capability. Each creator would have to pass full merchant onboarding plus BVN and a manual review, not the lighter recipient-only onboarding.
5. **Bachs KYC cannot replace Smile ID.** Connected-account verification means submitting ID numbers and uploading documents, then waiting for a human reviewer. Bachs documents no liveness, no face match and no scores, and the uploaded ID "is not readable back through your API key". Our checkmark flow needs liveness, ID capture and face match, so Smile ID stays either way. Bachs uses Smile ID for its own merchants' go-live, but does not expose it to platforms.
6. **Vendor risk is high and undisclosed:**
   - The operator is "Bachs Technologies Limited". No CBN licence, partner bank or safeguarding statement is published on the docs, the pricing page or the homepage.
   - There is no SLA, status page or SDK.
   - In July 2026 Bachs shipped breaking changes inside `v1` without a version bump.
   - The fees page and the pricing page disagree on virtual-account fees (1.5% capped at NGN 300 against 1%).

Where Bachs is genuinely better:
- A **permanent** NGN account number per connected account, with deposits landing in that account's own Bachs balance rather than Zudomart's.
- Signed webhooks with event ids and a timestamp.
- `Idempotency-Key` on every POST.
- A published rate limit of 500 requests per minute.
- Card fees below Paystack's for orders under NGN 20,000.

None of these outweighs the blockers above.

## 2. Capability matrix

Legend: **Yes** = documented and usable for our case; **Partial** = documented with limits that matter to us; **No** = not offered; **?** = not documented. Paystack facts come from `docs/integrations/paystack.md` (its source keys are in brackets).

| Feature we use | Paystack (today) | Bachs (full migration) | Hybrid (Bachs: VAs, KYC/KYB, payouts; Paystack: cards, subscriptions) |
| --- | --- | --- | --- |
| Card checkout, NGN | Yes. Local cards 1.5% + NGN 100, capped NGN 2,000 (PRICING) | **Partial.** `NGN_CARD` "Beta", 2% uncapped; capability `ngn_card_collection` approved per account; sandbox offers every method, live may not | Paystack |
| Card checkout, international or USD | Yes. 3.9% + NGN 100, settled in NGN | Yes. USD cards 5% + $0.40; non-US cards +1.5% even when the customer bears fees | Paystack |
| Bank-transfer checkout | Yes. Pay with Transfer, account valid 15 minutes to 8 hours, wrong amount → `bank.transfer.rejected` | Yes. 30-minute per-payment number, 1.5% capped NGN 2,000; `collection.underpaid` event | Paystack |
| USSD | Yes | No | Paystack |
| Dedicated virtual account per seller or creator | Partial. DVAs are tied to a *customer* and deposits land in **Zudomart's** balance; 1% capped NGN 300; consent required; default limit 1,000 (DVA) | **Yes.** Permanent NGN number owned by a connected account, deposits credit **that account's** balance; NGN only; default NGN 5M per deposit and per day (excess held for manual review, no release event); needs the merchant `virtual_accounts` capability, representative BVN and manual review; deposits not refundable by API | Bachs, but deposits never pass through Paystack checkout, so they sit outside our checkout and escrow |
| Escrow holding | Yes (E2): funds stay in Zudomart's main balance and leave by transfer after release. E1 (manual subaccount) unconfirmed | Same shape as E2: "separate charges and transfers", platform balance, transfer "whenever you decide to". No hold-until-delivery feature | **Broken.** Funds collected on Paystack must reach Bachs via Zudomart's bank before a transfer: Zudomart holds them |
| Split or platform fee at charge time | Yes. Dynamic multi-split with flat shares per subaccount; one transaction per multi-seller cart (MSPLIT) | Partial. Destination charge names **one** `transfer_data.destination`; multi-seller carts need separate transfers. Platform fee is an amount, never reversed on refund | Paystack split for direct groups; Bachs not involved |
| Payouts with account-name check | Yes. `GET /bank/resolve`, transfer recipients, transfers NGN 10 / 25 / 50 | Yes. `POST /v1/misc/bank-accounts/resolve`, payout destinations need approval (`is_usable`), first payout per account held for review, NGN 50 flat | Bachs, but funded through Zudomart's bank (see escrow row) |
| Refunds | Yes. Several partial refunds per transaction; `needs-attention` bank-transfer refunds retried with customer bank details | **Partial.** "A payment takes one refund"; NGN bank transfers not refundable (use a payout); the original fee and platform fee are not returned; refund refused if the charge owner's balance is short | Paystack |
| Chargebacks or disputes | Yes. Events and evidence API; no separate fee published | Yes. Evidence API; **$15 per dispute**, kept even if won; $29 early warning; a lost dispute can push the balance negative and `ORGANIZATION_IN_DEBT` freezes **all** transfers and withdrawals | Paystack (cards stay there) |
| Recurring subscriptions | Yes. Plans + `POST /subscription`, plus our renewal engine charging `authorization_code` | **Partial.** USD cards only; NGN "available only on accounts where they've been enabled"; created only through checkout (no create endpoint); Bachs runs dunning | Paystack |
| Free trials | Yes. Verification charge + `start_date` | Partial. Trials are supported, but NGN cards "Unsupported" for trials | Paystack |
| Saved cards / tokenised renewals | Yes. `authorization_code` on device, `charge_authorization`, 2FA pause handled | Partial. `pm_` id; `POST /v1/charges` is **beta**; NGN card savable "only while the customer pays"; off-session 3DS cards refused | Paystack |
| USD collections | Partial. USD on transactions and splits, not on transfers | Yes. USD cards and crypto; USD balance settles in 2 days; USD → NGN payout 1%, capped $15 | Paystack |
| KYC for payees (BVN or NIN) | Partial. Customer validation (BVN + bank account) documented for DVA use only | Partial. BVN, NIN, passport or licence numbers submitted; whether they are looked up is not documented; reviewer decides | Bachs (only for accounts that get a VA) |
| Liveness, ID document, face match | No (Smile ID does it) | **No** for connected accounts (Smile ID only for Bachs's own go-live) | Smile ID stays |
| KYB for businesses | No (Zudomart admin review) | Partial. `entity_type: company`, registration number, structure, certificate upload, representative, owners and directors; human review; no CAC registry lookup documented | Zudomart admin KYB stays for the Gold checkmark; Bachs KYB on top for VA holders |
| Webhooks | HMAC-SHA512 of the body with the secret key, no timestamp, no event id; retries 72 hours; fixed source IPs | HMAC-SHA256 over timestamp + body, `X-Bachs-Signature-V2`, 300 s tolerance, separate signing secret with 24 h rotation overlap, `evt_` ids; only 5 attempts over about 1.5 hours, then manual replay; no IP list | Both: two webhook stacks |
| Reconciliation | Transactions, settlements per subaccount, transfers, balance ledger, refunds, disputes | `GET /v1/payments`, balances with `pending_settlements_by_day`, transfers by `transfer_group`, payouts with `total_debited`; VA deposits must be found by filtering (no deposit filter) | Two ledgers to reconcile, plus the treasury hop between them |
| Fees | See section 6 | See section 6 | Paystack fees + Bachs VA and payout fees + treasury transfer cost |
| API stability, rate limits, SLA | Mature; rate limits not published | 500 per minute (prod), 100 (sandbox); breaking changes inside `v1` in July 2026; no SLA or status page documented | Both |
| Licensing disclosed | Licensed payment company ("a Stripe company") | **Not disclosed** (Bachs Technologies Limited) | Both |

## 3. What changed at Bachs since we left (2026-10-03)

From the product and API changelogs (https://docs.bachs.io/changelog/product, https://docs.bachs.io/changelog/api):

| Week | Change | Effect on our decision |
| --- | --- | --- |
| Oct 5, 2026 | Global Payouts: bank payouts in NGN, GHS, KES, TZS, UGX, GBP, USD, CAD, EUR; mobile money in GH, KE, TZ; USDT or USDC | Useful later for non-NG creators; international routes are funded from the USD balance |
| Sep 21, 2026 | **Virtual accounts**: fixed NGN number for the platform or a connected account; needs the `virtual_accounts` capability and the representative's BVN; new key scopes `virtual_accounts:read`/`write` | The trigger for this review |
| Sep 14, 2026 | Checkout without a customer (`customer_creation`) | Minor |
| Sep 7, 2026 | New error codes `ACCOUNT_NOT_ACTIVATED`, `ACCOUNT_PAYMENT_METHODS_RESTRICTED` | Minor |
| Aug 17, 2026 | Currencies per payment method (`payment_method_options`) | Minor |
| Jul 14 to 21, 2026 | Subscriptions end to end; **breaking** path and field renames inside `v1`; `collection.abandoned` removed | Maturity signal |

Nothing in the changelog says NGN cards, NGN card subscriptions or saved-card charges have left beta or limited availability. The payment-method table still shows `NGN_CARD`: subscription "Limited availability", save for later "While paying only", free trial "Unsupported" (https://docs.bachs.io/guides/payments/payment-method-support).

## 4. Bachs findings in detail

### 4.1 Virtual accounts (https://docs.bachs.io/guides/virtual-accounts/overview, /api-reference/virtual-accounts/object, /guides/payments/deposit-limits)

- **One permanent NGN number per currency per account.** "It does not expire." For a number per seller or creator, "create a connected account and issue the number there". No dynamic or static variants, and no per-customer numbers on one account.
- **Requirements.** The `virtual_accounts` capability is requested automatically for Nigerian accounts. Review is manual and Bachs emails when the number can be created. On connected accounts the platform submits the requirements itself, including the representative's BVN. NIN is not mentioned. `virtual_accounts` is listed among the **merchant** capabilities (https://docs.bachs.io/connect/capabilities), so a recipient-only creator account cannot hold one.
- **Settlement.** Confirmed NGN deposits go "to your available balance immediately", after the fee. Example from the docs: NGN 250,000 settles at NGN 249,700 (NGN 300 fee).
- **Limits.** Defaults of NGN 5,000,000 per deposit and NGN 5,000,000 per UTC day. Deposits above these are **held for manual review**, never rejected. `collection.succeeded` still fires and does not say the money is held. Held funds appear in neither pending nor available balance, and "no event is sent on release". Raise limits by email.
- **Refunds.** "Deposits cannot be refunded through the API. Contact support to return one."
- **Webhooks.** `collection.succeeded` with `checkout_id: null` and `virtual_account.type: "permanent"`. Sender name, bank and narration may all be null. Deduplicate on the event `id`. Missed deposits can only be found by listing `GET /v1/payments` filtered to `ngn_bank_transfer` with no checkout.
- **Banks.** The issuing bank partner is not named. Sandbox numbers start with `90` ("Sandbox Test Bank").
- **Fees: the two sources disagree.** The docs say 1.5% capped NGN 300 (https://docs.bachs.io/for-you/fees); the pricing page says 1% capped NGN 300 (https://bachs.io/pricing).

### 4.2 Cards, checkout and saved cards

- Capabilities: `card_collection` (Visa or Mastercard, charged in USD) and `ngn_card_collection` (Nigerian cards, NGN). Card schemes are not listed per currency, and Verve is not mentioned.
- NGN local cards: 2% (Beta), no cap. USD cards: 5% + $0.40. Non-US cards: +1.5%.
- Saved cards: "Saving and charging cards this way is in beta". An off-session charge "cannot ask the customer to authenticate", so cards that need 3DS are refused. An NGN card "can be saved only while the customer pays" (https://docs.bachs.io/guides/payments/charge-a-saved-card).
- Live accounts may not have every method enabled. Check with `GET /v1/accounts/checkout/settings`; a disabled method returns `PAYMENT_METHOD_NOT_ENABLED`.

### 4.3 Subscriptions (https://docs.bachs.io/guides/subscriptions/overview, /trials)

- "Subscriptions currently bill USD cards only." NGN subscriptions are available only where enabled ("Ask us").
- There is no create-subscription endpoint: a subscription comes only from completing a checkout for a recurring product.
- Renewals, dunning (`past_due`, then `unpaid` or `canceled`) and card-update emails are run by Bachs.
- Fees: +0.5% of billing volume, marked "coming soon".
- No import or migration path is documented.

### 4.4 Connect, money movement and escrow (https://docs.bachs.io/connect/money-movement, /connect/split-payments/separate-transfers, /connect/marketplaces/overview, /connect/payout-networks)

- "A charge lands in the balance of whichever account collected it." Marketplaces are told to use **destination charges**: one destination per charge, with the platform as merchant of record. A multi-seller cart therefore needs "separate charges and transfers", one transfer per account sharing a `transfer_group`.
- **There is no escrow or hold-until-delivery feature.** Holding means keeping the money in the platform balance, which is the same as our Paystack E2. Transfers draw on `available_balance` only, so they must wait for settlement.
- Refunds and disputes debit the charge owner. On destination charges or platform transfers that owner is the platform, and "there is no automatic way to claw that share back". It can only be recovered by a transfer back (`destination: "self"`) while the seller still holds the balance.
- Creators use the payout-networks pattern: recipient accounts (`transfers` and `payouts`), one `POST /v1/transfers` per creator with no batch endpoint, then a platform-initiated payout.
- Control:
  - Payouts need the `payouts` capability `active`, which is "enabled on review, never automatically".
  - "There is no revocation path for an active capability"; if the platform disables one, only support restores it.
  - The 2026-10-03 review found that a merchant account holder "can change [the payout schedule] from their own dashboard". Whether holders get a dashboard login at all is still **UNCONFIRMED**.

### 4.5 Identity and KYB (https://docs.bachs.io/connect/guides/identity-verification, /connect/requirements, /connect/onboarding, /go-live)

- **Connected accounts:**
  - "There is no separate identity endpoint or hosted verification session to drive."
  - The platform creates persons (representative, owners, directors) with `id_numbers` of type `nin`, `bvn`, `passport` or driver's licence, and uploads documents (`primary_verification`, `secondary_verification`).
  - "Attaching a document does not verify it: a reviewer accepting it is what moves verification.status to passed."
  - The result is `pending`, `passed` or `failed` plus `failure_reason`. No scores are returned.
  - "The file is not readable back through your API key."
- **Not documented:** liveness, selfie, face match, BVN or NIN registry lookups, CAC registry checks, timing, cost, and use as a stand-alone KYC service for users who are not connected accounts.
- **Companies:** `company.registration_number`, `company.structure` (from `GET /v1/reference/business-structures`), a certificate of incorporation upload, and person relationships (`director`, `owner`, `percent_ownership`). Nigerian filings are not named.
- **Requirements** depend on personas: "a recipient needs only a name, a merchant needs the full identity set". Merchants also need `business_profile.product_description`, `support_email` and `product_category`. `persons.bvn` and `persons.proof_of_address` are `eventually_due`.
- **Two pages conflict on documents.** The requirements and identity pages describe API uploads; the onboarding page says documents "are collected through an account link, in the hosted flow". **UNCONFIRMED.**
- **Bachs's own go-live** uses "A hosted check through Smile ID, using a government-issued ID and a selfie". Bachs "never stores your documents". This applies to the platform's own verification, not to connected accounts.

### 4.6 Webhooks, API and operations

- **Signing:** `X-Bachs-Timestamp` plus `X-Bachs-Signature-V2: t=…,v1=…`, an HMAC-SHA256 over the timestamp and raw body, with a 300 s tolerance. The secret is shown once; during rotation both signatures are sent for 24 h.
- **Retries:** up to 5 attempts, at about 1 min, 5 min, 15 min and 1 h. After that, replay through `POST /v1/webhooks/replay`. Acknowledge within 10 s.
- **Events:** endpoints must set `event_source: connect` or `all`, otherwise connected-account events are never delivered. No IP allowlist is documented (https://docs.bachs.io/guides/webhooks/overview).
- **API:** decimal-string amounts in major units; `Idempotency-Key` on POST and PATCH; 500 requests per minute in production and 100 in sandbox, per key (https://docs.bachs.io/api-reference/api-standards).
- **Tooling:** a CLI exists; no server SDKs are documented. The sandbox is fully isolated and payments succeed by default (https://docs.bachs.io/integrate/sandbox).
- **Not found:** SLA, uptime or status page.

### 4.7 Fees, settlement and disputes (https://docs.bachs.io/for-you/fees, https://bachs.io/pricing)

- **Collections:**
  - NGN bank transfer: 1.5%, capped NGN 2,000.
  - Virtual account: 1.5%, capped NGN 300 (the pricing page says 1%).
  - NGN cards: 2% (Beta).
  - USD cards: 5% + $0.40, +1.5% for non-US cards.
  - Mobile money: 3.5% (the pricing page says 2% or 3%).
  - Crypto: 1.5%.
- **Withdrawals:** NGN 50 flat from NGN; USD 1% (min $1, cap $15); other currencies 0.3%. The fee is added on top of the amount.
- **Settlement:** NGN immediate; USD 2 days; other African currencies 1 day; credited at 09:00 UTC; card weekends roll to Monday.
- **Disputes and refunds:** $15 per dispute, kept even if won; $29 early warning. Refunds have no Bachs fee, but provider reversal costs are passed through and the original fees are not returned.
- **Inconsistency:** the pricing page publishes no payout, subscription or dispute fees, and disagrees with the docs on two numbers.

### 4.8 Compliance and entity (https://bachs.io, https://docs.bachs.io/introduction, /for-you/supported-businesses)

- **Entity and licensing:** the footer names "Bachs Technologies Limited". No CBN licence (PSSP, switching or MMO), partner bank, safeguarding or trust-account statement is published. A web search found no public licensing record. The terms link (`app.bachs.io/legal/terms`) is a dashboard shell that does not render the terms.
- **Marketplaces** are allowed "with proper agreements in place".
- **Not addressed:** escrow, creators, gifts, coins and live streaming. "Unlicensed financial services" are prohibited.

## 5. What our code relies on today (and what a move would touch)

The adapter boundary exists (`services/go/modules/payments/src/interfaces/`), but **Paystack's model leaks through it**:

| Interface or field | Paystack concept baked in | Bachs equivalent |
| --- | --- | --- |
| `ChargeRequest.SplitShares`, `SettlementAccount`, `SubaccountBearsFee` | Dynamic multi-split to subaccounts | Single `transfer_data.destination`, or separate transfers after settlement |
| `PayeeProvider.Find/CreateSettlementSubaccount`, `ManualSettlement` | Subaccounts with settlement schedules | Connected accounts with personas and capabilities, plus async review |
| `SavedCardProvider.ChargeAuthorization`, `CardAuthorization.AuthorizationCode`, `Paused`/`AuthorizationUrl` | `authorization_code` + 2FA pause | `pm_` + `cust_`; no pause path, refused off-session |
| `SubscriptionProvider.CreateSubscription(StartDate)`, `ProviderSubscription.EmailToken` | `POST /subscription` with a start date | None: checkout-only creation |
| `PaymentProvider.RetryRefundWithCustomerBankAccount` | `needs-attention` refunds | Payout instead of refund |
| `MoneyMovementProvider.ListSettlements(subaccountCode)`, `ErrTransferNeedsOtp` | Subaccount settlements, transfer OTP | Balances and `pending_settlements_by_day`; no OTP |
| `subscriptions` schema `channel` enum `web_paystack`; `renewalEngine.service.go` | Zudomart-run renewals on Paystack authorizations | Bachs runs renewals itself |
| Ledger `SellerSettlingByPaystackAccount` (`escrowHolding.service.go`) | T+1 subaccount settlement | Connected balance + payout |

Non-test Go files that mention Paystack:

| Module | Files | Examples |
| --- | --- | --- |
| payments | 28 | adapter, harness, `checkoutAllocation`, `paymentIntentCreation`, `savedCards`, `savedCardCharges`, `paystackReconciliation`, `webSubscriptions`, `sellerPayouts`, webhooks controller, config, container |
| subscriptions | 9 | `renewalEngine`, `checkout`, `planChange`, `cancellation`, `bundleRepricing`, `verificationRefunds`, `sellerSubscription`, schema |
| wallet | 4 | `paystackTransferSettlement`, config, container, coins validator |
| ads | 2 | `startTopUp`, schema |
| escrow | 1 | `escrowHolding` |
| ledger | 1 | `chartOfAccounts` |

The apps contain 93 TypeScript files that mention Paystack (copy, mocks, return pages, saved-card handling); the 2026-10-03 Bachs removal list in `docs/checkoutPaymentFlowPlan.md` section 12 shows what that sweep looks like.

**Rough effort** (one engineer, includes tests, excludes Bachs approval time):

| Scope | Modules changed | Estimate |
| --- | --- | --- |
| Creator-payout pilot (section 10.1) | payments: new `bachs*` payee and money-movement adapter + webhook route; `connected_accounts` gains a `provider` column and Bachs account id; wallet: creator payout adapter selection; ledger: a Bachs balance account; admin: provider shown on payout accounts | 2 to 3 weeks |
| Hybrid as proposed (VAs, KYC/KYB, all payouts on Bachs) | The above, plus seller payouts, escrow release, refunds-after-payout (seller debt recovery across two providers), the treasury top-up job and two-provider reconciliation | 5 to 7 weeks, and it still breaks the "holds nobody's money" rule |
| Full migration | Every module above, plus interface redesign (split → transfers, subscriptions without a create API, single-refund rule), the app sweep and Atlas forward migrations | 8 to 12 weeks, plus a dual-run period; blocked today by NGN subscriptions and refunds |

## 6. Fee comparison (NGN, per transaction)

| Item | Paystack | Bachs |
| --- | --- | --- |
| Card, NGN 2,000 order | NGN 30 (NGN 100 waived under 2,500) | NGN 40 |
| Card, NGN 10,000 | NGN 250 | NGN 200 |
| Card, NGN 20,000 (break-even) | NGN 400 | NGN 400 |
| Card, NGN 50,000 | NGN 850 | NGN 1,000 |
| Card, NGN 200,000 | NGN 2,000 (cap) | NGN 4,000 (no cap) |
| Bank transfer, NGN 50,000 | NGN 850 | NGN 750 |
| Virtual-account deposit, NGN 50,000 | NGN 300 (cap) | NGN 300 (cap; 1.5% or 1% depending on the page) |
| Payout NGN 3,000 / 30,000 / 300,000 | NGN 10 / 25 / 50 | NGN 50 / 50 / 50 |
| Dispute | none published | $15, plus $29 if warned |
| Subscription billing | none extra | +0.5% (coming soon) |

Bachs wins on small card orders and on bank transfers (no NGN 100 add-on). It loses on large card orders, on small payouts (most creator payouts) and on disputes. Treat this as roughly neutral, not as a reason to move.

## 7. Risks

### 7.1 Card coverage

- NGN cards on Bachs are Beta, approved per account, and their scheme coverage (Verve) is undocumented.
- Off-session 3DS cards are refused, with no fallback like Paystack's `paused` + `authorization_url`.
- Losing card checkout reliability hits every order, coin pack, subscription and ads top-up.
- **High risk for a full migration.**

### 7.2 Regulatory

- **Funds custody:**
  - On Paystack, Zudomart holds escrow in its own Paystack balance (E2), at a licensed processor.
  - On Bachs, the same E2 shape applies, with an operator whose licence is undisclosed.
  - Connected-account balances (creator earnings, VA deposits) would sit with Bachs in the user's name. That fits "Zudomart holds nobody's money" only if Bachs (or its partner bank) is the licensed custodian, which is **UNCONFIRMED**.
- **Hybrid treasury hop:** Paystack settles to Zudomart's bank, Zudomart moves it to its Bachs VA, then transfers to sellers. Zudomart would hold third-party funds every day, which is the situation the owner ruled out.
- **Payee identity:** if Zudomart steers payouts from users' Bachs balances (the control model), counsel should confirm this is not wallet operation or stored value requiring Zudomart's own licence.

### 7.3 Vendor maturity

- Breaking `v1` changes on Jul 7 and Jul 14, 2026; core features (NGN cards, saved cards) still Beta.
- Pricing pages disagree with each other.
- No SLA, status page or SDK; webhook retries last only about 1.5 hours.
- Held VA deposits produce no release event.
- `ORGANIZATION_IN_DEBT` freezes all movements after one lost dispute.

### 7.4 Lock-in

- **Paystack:** cards and subscriptions tied to Paystack authorizations are not portable, but this is the same lock-in we already have.
- **Bachs:** adding Bachs adds a second set of non-portable objects: connected accounts, KYC reviews, `pm_` cards. KYC files cannot be read back through the API, so leaving Bachs means re-verifying every payee.

### 7.5 Data migration

- **Saved cards:** Paystack `authorization_code`s cannot be moved to Bachs. Bachs documents no card import, and we never hold PANs. Every user would re-enter their card in a Bachs checkout, and NGN cards can only be saved during a payment.
- **Subscriptions:** Bachs has no create-subscription API and bills USD cards only. Each NGN subscriber would need a fresh checkout at renewal. Expect churn at every migrated renewal date, and run both providers until the last Paystack subscription ends (up to 12 months for annual plans).
- **Payees:**
  - Paystack recipients and subaccounts do not carry over.
  - Every seller and creator re-onboards into a Bachs connected account: new persons, ID numbers, documents, human review, and a first-payout review.
  - Because we keep only the last 4 digits of BVN or NIN (`paystack.md` 6.1) and never store ID images (`smileId.md`), we cannot pre-fill Bachs from our data. Users must re-submit.

### 7.6 KYC: can Bachs replace Smile ID?

No:

| Checkmark need (`smileId.md`) | Smile ID | Bachs connected-account KYC |
| --- | --- | --- |
| Selfie liveness | Yes (SmartSelfie) | Not documented |
| ID document capture + authenticity | Yes (Document Verification) | Upload + human review; no authenticity checks documented |
| Face match to ID | Yes (`Selfie_To_ID_Card_Compare`) | Not documented |
| Government database lookup | Yes (Enhanced Document Verification) | Not documented (ID numbers accepted; lookup unknown) |
| Signed callback with per-check results | Yes | `pending`/`passed`/`failed` + reason, through `account.updated` and `capability.updated` |
| Works for any user (checkmark buyers who are not payees) | Yes | Only for connected accounts |

**Decision:**
- Smile ID stays for all checkmarks.
- Zudomart admin KYB stays for the Gold checkmark.
- If Bachs connected accounts are ever adopted, Bachs KYC/KYB runs *in addition*, only for users who need a Bachs balance or VA.
- To avoid double capture, ask Bachs whether it accepts a reliance on our Smile ID job (Bachs already uses Smile ID; see Q9).

## 8. The creator virtual-account premise

The owner's brief says creators "need a dedicated virtual account to receive earnings". The docs do not support this:

- **Where the money comes from.** Creator earnings come from gifts and coins (IAP or web packs), fan subscriptions and revenue share. All of them are collected by Zudomart and recorded in our ledger, and they leave by transfer. A virtual account only adds a way for *outside* parties to send bank transfers to the creator.
- **Why that inbound rail is a problem:**
  - It bypasses our fees, ledger and moderation, so off-platform tipping becomes invisible to us.
  - Those deposits cannot be refunded through the API.
  - Deposits above NGN 5M are held for manual review.
- **Where earnings land on Bachs.** A creator recipient account's balance is the destination of `POST /v1/transfers`; no VA is needed for that. A VA is a merchant capability, so it would force merchant onboarding (business profile, product category, support email, BVN, manual review) on every creator.
- **If the goal is that Zudomart never holds creator earnings:** the real requirement is a custodial balance in the creator's name at a licensed provider, not a VA. Bachs recipient accounts offer that shape, which is why the conditional pilot in section 10.1 is scoped to creators. Paystack has no per-payee balance; transfers go straight to the bank.
- **If the goal is fans paying creators by bank transfer:** that is a product decision with fee, AML and tax consequences, for owner and counsel review first.

## 9. Recommendation

1. **Stay on Paystack** for:
   - card, bank-transfer and USSD checkout, and one transaction per cart with dynamic split;
   - escrow (E2), refunds, disputes, saved cards, subscriptions and trials;
   - seller and creator payouts, and ads and coin top-ups.
2. **Keep Smile ID** for checkmarks and **keep admin KYB** for the Gold checkmark. Do not adopt Bachs KYC as a replacement.
3. **Do not build the proposed hybrid.** It moves seller money through Zudomart's bank, doubles reconciliation and still needs Paystack for everything buyer-facing.
4. **Optional:** if the owner wants creator earnings held in each creator's own name at a provider, ask Bachs the section 11 questions. If the answers are good, run the creator-payout pilot (section 10.1) behind a flag, without virtual accounts unless a product case for inbound transfers is approved.
5. **Revisit a full migration** only when all of these hold, in writing:
   - NGN card subscriptions and trials are generally available, with a create-subscription API or an import path;
   - several partial refunds per payment are allowed;
   - NGN cards are out of Beta, with Verve coverage stated;
   - the licence and the custodian of connected-account balances are disclosed;
   - an SLA exists;
   - webhook retries last at least 24 to 72 hours.

## 10. Migration plan (only if the owner proceeds)

### 10.1 Conditional creator-payout pilot (recommended scope if anything moves)

Goal: creator earnings move from Zudomart's ledger into each creator's Bachs recipient balance; Zudomart then initiates the payout to the creator's bank. Paystack stays the collector.

| Phase | Work | Exit criteria |
| --- | --- | --- |
| 0. Answers | Written answers to Q1 to Q12 (section 11); counsel review of custody and the control model | Licence and custodian known; holder has no dashboard login or it can be disabled |
| 1. Adapter | `bachsPayees.integration.go` (connected account, recipient persona, persons, payout destination, resolve) and `bachsMoneyMovement.integration.go` (transfers with `Idempotency-Key`, payouts, balances), implementing `PayeeProvider` and `MoneyMovementProvider`. `POST /webhooks/bachs` with V2 signature, `evt_` dedupe and `event_source: connect`. `connected_accounts.provider` column (forward Atlas migration). Fixture tests against sandbox recordings | Sandbox end-to-end: onboard → transfer → payout → `payout.paid` |
| 2. Treasury | Fund the Bachs platform balance: Zudomart's own platform VA receives a daily top-up equal to the creator payout run, under the NGN 5M per-day limit or a raised limit. Ledger account `bachsPlatformBalance`; reconciliation of `GET /v1/balances` against the ledger | Recon clean for 14 days in sandbox |
| 3. Dual run | Flag `CREATOR_PAYOUT_PROVIDER` per creator (default `paystack`). Internal and staff creators first, then 5%, 25%, 100%. Paystack transfers stay live for everyone else | No payout breaks, no stuck first-payout reviews over 24 h, support load acceptable |
| 4. Cut-over | Default `bachs` for new creators; existing creators migrate when they next update payout details | 30 days clean |

**Rollback path:**
- Flip the flag back to `paystack`. Earnings stay in our ledger, so new runs go out by Paystack transfer the next day.
- For money already in Bachs recipient balances, the platform initiates payouts to each creator's bank (`X-Account-Id` + `POST /v1/payouts`), or pulls the money back with `destination: "self"` transfers and withdraws it.
- Keep the Bachs adapter dormant, not deleted, until all balances are zero.

### 10.2 Full migration (only after section 9 item 5 is met)

1. **Interfaces first.**
   - Replace `SplitShares` and subaccounts with "collect, then transfer per seller group after settlement".
   - Replace `ChargeAuthorization` with a saved-payment-method charge that has a hosted-checkout fallback.
   - Model subscriptions as provider-run or Zudomart-run per channel (`web_paystack`, `web_bachs`).
   - Move one-refund-per-payment rules into the refund service; this may mean one payment per seller group again.
2. **Flags:** `PAYMENTS_DEFAULT_PROVIDER` per purpose (`checkout`, `coins`, `ads`, `subscriptions`, `payouts`), not one global switch. Store `provider` on every payment intent, subscription, saved card and payout account, so reads always go to the right provider.
3. **Dual run (at least 60 days):**
   - New checkouts go to Bachs for a cohort, while webhooks, refunds and disputes for older payments keep going to Paystack.
   - Subscriptions move at renewal through a "confirm your card" checkout.
   - Saved cards are re-collected on next purchase.
   - Payees re-onboard with a banner and deadline, and Paystack transfers continue until they finish.
4. **Rollback:** the per-purpose flags flip back instantly for new money. In-flight Bachs payments finish on Bachs. Paystack credentials, webhook route and reconciliation stay live until the last annual subscription and the dispute window (about 120 days) have passed.
5. **Decommission:** after Paystack balances, disputes and subscriptions reach zero. Delete files the way `checkoutPaymentFlowPlan.md` section 12 did; no `rm -rf` after moves.

## 11. Questions for Bachs (ask in writing)

1. **Licence and custody:**
   - Which CBN licence does Bachs Technologies Limited hold, or which licensed partner and bank issue the virtual accounts and hold balances?
   - Are connected-account balances held in trust or safeguarded in the account holder's name?
2. **Holder access:** does a connected-account holder ever get a Bachs dashboard login or receive emails that let them change payout schedules or withdraw? Can that be disabled per platform?
3. **VA on recipient accounts:** can a recipient-only (creator) account hold a virtual account, or must it be a merchant? What exact requirements apply to an individual with no business?
4. **VA limits and holds:** can per-account limits be set by the platform? Can we get an event when a held deposit is released? How do we return a deposit we did not expect?
5. **Escrow:** is holding marketplace funds in the platform balance until delivery (up to 14 days plus disputes) acceptable? Can a connected account's balance be frozen by the platform instead?
6. **Refunds:** will Bachs allow several partial refunds per payment? Will NGN bank-transfer payments become refundable?
7. **NGN cards:** when do NGN cards leave Beta? Is Verve supported? What is the approval process for `ngn_card_collection` on a new platform?
8. **NGN subscriptions and trials:**
   - Can NGN card subscriptions and free trials be enabled for us?
   - Is there an API to create a subscription for an existing customer and saved card?
   - Can existing subscriptions be imported?
9. **KYC reuse:**
   - Which checks run on connected-account persons: BVN or NIN registry lookup, liveness, face match?
   - Can Bachs accept a reliance on our Smile ID job id or result (Bachs uses Smile ID itself)?
   - Can results be returned with per-check detail?
10. **Documents:** are person and company documents uploaded through the API or only through the hosted account link? (The onboarding and requirements pages disagree.) Does the hosted link work in an in-app browser?
11. **Fees:** is the virtual-account fee 1% or 1.5% (pricing against docs)? Is mobile money 2%, 3% or 3.5%? What custom rates apply at our volume? When will the +0.5% subscription fee take effect?
12. **Operations:**
    - Is there an SLA, a status page and an incident channel?
    - Can webhook retries be extended beyond about 1.5 hours?
    - Are webhook source IPs published?
    - What is the versioning policy after the July `v1` breaking changes?
13. **Disputes:** does `ORGANIZATION_IN_DEBT` on one connected account affect the platform? Can the platform prefund a dispute to avoid the freeze?
14. **Payout review:** how long is the first-payout review? Can it be pre-cleared for accounts the platform has already verified?
15. **Supported business:** written confirmation that escrow marketplaces, creator gifts, virtual coins and live streaming are permitted.
16. **Data exit:** if we leave, can we export payee verification status and saved payment methods to another processor?

## 12. Sources

Bachs (read 2026-10-10):

- https://docs.bachs.io/llms.txt
- https://docs.bachs.io/guides/virtual-accounts/overview
- https://docs.bachs.io/api-reference/virtual-accounts/object
- https://docs.bachs.io/guides/payments/deposit-limits
- https://docs.bachs.io/guides/payments/payment-method-support
- https://docs.bachs.io/guides/payments/charge-a-saved-card
- https://docs.bachs.io/guides/subscriptions/overview
- https://docs.bachs.io/guides/subscriptions/trials
- https://docs.bachs.io/guides/refunds
- https://docs.bachs.io/guides/payouts/overview
- https://docs.bachs.io/api-reference/payout-destinations/object
- https://docs.bachs.io/guides/webhooks/overview
- https://docs.bachs.io/api-reference/api-standards
- https://docs.bachs.io/api-reference/overview
- https://docs.bachs.io/integrate/sandbox
- https://docs.bachs.io/go-live
- https://docs.bachs.io/introduction
- https://docs.bachs.io/for-you/fees
- https://docs.bachs.io/for-you/supported-businesses
- https://docs.bachs.io/connect/accounts
- https://docs.bachs.io/connect/capabilities
- https://docs.bachs.io/connect/requirements
- https://docs.bachs.io/connect/onboarding
- https://docs.bachs.io/connect/guides/identity-verification
- https://docs.bachs.io/connect/guides/hosted-onboarding
- https://docs.bachs.io/connect/money-movement
- https://docs.bachs.io/connect/split-payments/separate-transfers
- https://docs.bachs.io/connect/marketplaces/overview
- https://docs.bachs.io/connect/payout-networks
- https://docs.bachs.io/connect/refunds
- https://docs.bachs.io/connect/disputes
- https://docs.bachs.io/changelog/product
- https://docs.bachs.io/changelog/api
- https://bachs.io/pricing
- https://bachs.io
- Earlier review: `git show 79aa2f7c1:docs/integrations/bachs.md` (2026-10-03)

Zudomart: `docs/integrations/paystack.md`, `docs/integrations/smileId.md`, `docs/checkoutPaymentFlowPlan.md`, `docs/architecture/payments.md`, `services/go/modules/payments/src/interfaces/*.interface.go`, `services/go/modules/subscriptions/src/modules/billing/services/renewalEngine.service.go`, `services/go/modules/escrow/src/modules/escrows/services/escrowHolding.service.go`.
