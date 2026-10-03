# Bachs integration review

Reviewed 2026-10-03 against https://docs.bachs.io (every page in `llms.txt`, read through `llms-full.txt`) and https://bachs.io/pricing. Not legal advice. Anything the docs do not state is under "Open questions for Bachs". The Bachs docs are marked beta in places (saved-card charges), so re-check before launch.

## 1. Control model (owner decision, fixed)

Sellers and creators reach Bachs only through Zudomart. No Bachs dashboard login for them. Nobody withdraws unless Zudomart allows it.

### Verdict

The API side supports this model fully. The docs do not say anything that gives a connected-account holder a Bachs login, but one sentence implies a holder dashboard exists. Whether login can be refused or is simply never offered is **UNCONFIRMED**.

| Question | Finding |
| --- | --- |
| Does API account creation create a login? | No login is described. "Bachs creates a service user to own the account and sends onboarding correspondence to `contact_email`." (https://docs.bachs.io/connect/accounts) |
| Is the holder a Bachs user? | "The seller or contractor behind it does not sign up for Bachs, and does not connect an account they already have. One API call brings the account into existence." (https://docs.bachs.io/connect/accounts) |
| Is there a per-account API key? | "There is no separate API key per account." (https://docs.bachs.io/connect/accounts) Only the platform key can act. |
| Can platform act for the account while the holder cannot? | "Send `X-Account-Id` with an account's id and the request acts as that account instead." and "The header works on any API-key endpoint, not only the Connect ones." (https://docs.bachs.io/connect/acting-as-an-account). "Withdraw from an account by acting as it with `X-Account-Id`." (https://docs.bachs.io/connect/balances). With no key, the holder has no API route. |
| Payouts only by platform for recipient accounts | "Payout schedules do not apply to a recipient account... Payouts here are always a call you make." (https://docs.bachs.io/guides/payouts/payout-using-api) |
| Manual schedule | Interval values include `manual` (never). "Turn automatic payouts off with `"interval": "manual"`." (https://docs.bachs.io/guides/payouts/payout-schedules) A platform sets it with `X-Account-Id` on `POST /v1/balance_settings`. |
| Can the holder override the schedule? | **Yes, per the docs.** "A platform sets the timing; the account holder can change it from their own dashboard, so treat what you set as a starting point rather than a lock." (https://docs.bachs.io/guides/payouts/payout-schedules). This is the one sentence that breaks "manual schedule, kept". |
| Hosted onboarding links create logins? | Not stated. The page only says the link collects "whatever is currently due and nothing more" and is single-use (https://docs.bachs.io/connect/guides/hosted-onboarding). Documents cannot go through the API: "Files are not part of this flow. A document requirement... is collected through an account link: mint one, send the account holder to it, and they upload in the hosted flow." (https://docs.bachs.io/connect/guides/api-onboarding) |
| Account is not a login | "A Bachs account is not a login. It is a commercial relationship..." (https://docs.bachs.io/for-you/age-requirements, about Bachs accounts in general) |
| Can dashboard access be disabled? | Nothing in the docs says so either way. |

Also relevant: "The first payout from an account is held for a one-time review before it is sent" (https://docs.bachs.io/for-you/payins-payouts). Payouts need `payouts` capability `active`; the capability "is enabled by review, never automatically" (https://docs.bachs.io/connect/overview).

### Recommended setup

1. **Recipient-only accounts for creators** (and for sellers if Zudomart collects and transfers). A recipient has no schedule at all, so every payout is an explicit `POST /v1/payouts` with `X-Account-Id`, made only by go-money. This is the strongest guarantee in the docs. Marketplace shape: Bachs recommends that a marketplace collect and transfer ("Most marketplaces should collect", https://docs.bachs.io/connect/choose-your-integration).
2. **If sellers stay merchant accounts (current direct-charge plan)**: set `interval: manual` per currency at account creation (already done in `bachsConnectAccounts.integration.go`), and re-read `GET /v1/balance_settings` with `X-Account-Id` in the reconciliation job. If the interval is not `manual`, alert and set it back. This is the only mitigation if the holder has a dashboard.
3. **API onboarding for all fields**, so no link is needed. Use `POST /v1/accounts/{id}` for persons, ids and `payout_destination`. Mint an account link only for the document upload step, create it only when the seller taps the button, and never email it.
4. **Use a Zudomart-controlled `contact_email`** (for example a per-account alias on a Zudomart domain) so onboarding correspondence and, on direct charges, dispute emails ("On a direct charge that email goes to the account", https://docs.bachs.io/connect/disputes) land with Zudomart. Today the code passes the seller's own email (`connectedAccounts.service.go`). Trade-off: KYC emails reach nobody personally, so Zudomart must relay.
5. Payouts only via go-money (`wallet` module) with `Idempotency-Key`; the seller UI never sees a Bachs link.
6. Ask Bachs to confirm in writing (open question 1) that holders get no dashboard or can be disabled.

## 2. Fees

Sources: F = https://docs.bachs.io/for-you/fees, P = https://bachs.io/pricing. Zudomart's withdrawal currency is NGN bank transfer.

**Discrepancy**: the pricing page lists no withdrawal fees at all (it says no ACH fees, no forced payouts) and quotes card 5% + 50¢ and mobile money 2% / 3% plus 1% for conversion. The docs fee page, which is the more detailed and more recent, says card 5% + $0.40, mobile money 3.5%. Withdrawal fees are only on F. Treat F as authoritative for config and confirm (open question 6).

### Collections

| Method | Fee | Source |
| --- | --- | --- |
| NGN checkout bank transfer | 1.5%, capped at NGN 2,000 | F, P |
| NGN virtual account deposit | 1.5%, capped at NGN 300 | F |
| NGN local cards (beta) | 2% | F |
| Cards, US-issued (USD) | 5% + $0.40 (P says 5% + 50¢) | F, P |
| International cards | +1.5% on top of base; paid by the account even if the customer pays fees | F |
| Mobile money | 3.5% on F; P says 2% (GHS, KES) or 3% (other) plus 1% conversion | F, P |
| USDT / USDC (EVM) | 1.5% | F, P |
| Fraud screening | no extra fee | F, P |
| Subscriptions (coming soon) | +0.5% on billing volume | F |
| Revenue recovery (coming soon) | 5% of recovered revenue | F |

### Withdrawals (fee charged in the currency withdrawn from, added on top of the amount sent)

| From | Bank transfer | Mobile money | Crypto |
| --- | --- | --- | --- |
| NGN | NGN 50 flat | n/a | n/a |
| USD | 1%, min $1.00, cap $15.00 | 1%, min $1.00 | 1%, min 1 |
| USDT | 1%, min 1 USDT | 1%, min 1 USDT | 1%, min 1 |
| Any other | 0.3% | 0.3% | 1%, min 1 |

Withdrawals available: NGN bank transfer, USDT_TRC20, USDT_BEP20 (https://docs.bachs.io/for-you/supported-currencies). The pay-ins page also lists KES bank transfer (https://docs.bachs.io/for-you/payins-payouts); the currencies page does not. Check live with `GET /v1/currencies/payout-supported`. `amount` is what the destination receives; reconcile on `total_debited` (https://docs.bachs.io/guides/payouts/overview).

### Other

| Item | Fee or rule | Source |
| --- | --- | --- |
| Transfers (platform to account) | no fee published | https://docs.bachs.io/connect/transfers |
| Conversion USD to NGN | "Competitive FX rate, no hidden markup"; rate quoted before confirm | F |
| Refund | no Bachs fee; provider reversal cost passed through; one refund per payment; bank transfers not refundable | F, https://docs.bachs.io/guides/refunds |
| Early dispute warning | $29.00 per payment | F |
| Dispute / chargeback | $15.00, debited when opened, not refunded if won | F, https://docs.bachs.io/connect/disputes |
| Platform fee | always an amount, never a percentage; greater than zero, less than the sale; rounds half-up; not reversed on refund | https://docs.bachs.io/connect/platform-fees |
| Who pays processing fee | `responsibilities.fees.collector` (`bachs` default or `platform`) is fixed at creation; checkout `customer_bears_fee` can override | https://docs.bachs.io/connect/processing-fees |
| Settlement | NGN immediate; USD 2 days; GHS, KES, ZAR, UGX, TZS, ZMW, XAF, XOF, RWF and others 1 day; credited 09:00 UTC; card weekend dates roll to Monday | F |
| Minimums | no payout minimum published; schedule `minimum_amount` is optional; first payout per account held for one review | payout-schedules |
| Limits | per-charge deposit limit per currency, discovered via `DEPOSIT_LIMIT_EXCEEDED.details.max_allowed_amount`; `WITHDRAWAL_LIMIT_EXCEEDED` returns `max_allowed_usd` | https://docs.bachs.io/guides/payments/deposit-limits, https://docs.bachs.io/errors |
| API rate limit | production 500 requests/min per key, sandbox 100 | https://docs.bachs.io/api-reference/api-standards |
| Volume discounts | "custom rates" on request | P |

## 3. Saved cards (device-held reference)

Owner wish: the card lives on the user's device, unlocked by biometrics, not on Zudomart servers.

| Question | Finding |
| --- | --- |
| (a) Reusable token after checkout? | Yes, a `pm_` id, not a bearer token. Send `save_payment_method: true` on checkout creation, with a customer; "Bachs keeps their card against their customer record." Bachs then sends `payment_method.saved` with `payment_method_id`, brand, last4, expiry, `is_default`. (https://docs.bachs.io/guides/payments/charge-a-saved-card) Only cards can be saved; NGN cards only "while the customer pays"; no free-trial or save-for-later on NGN cards (https://docs.bachs.io/guides/payments/payment-method-support). |
| (b) Charge later by token without card re-entry? | Yes: `POST /v1/charges` with `customer`, optional `payment_method`, `amount`, `currency`, `Idempotency-Key`, using the platform API key. 3DS: "an off-session charge cannot ask the customer to authenticate, so a card whose issuer demands it will be refused." The result is a `processing` charge confirmed by `collection.succeeded` or `collection.failed`. Feature is **beta**. |
| (c) Bound to a customer? | Yes. "A saved card belongs to a customer"; `SAVED_PAYMENT_METHOD_NOT_FOUND`: "Cards are scoped to one customer." Zudomart must create a Bachs customer (`cust_`). Note our checkout uses `customer_creation: if_required`; subscription and setup checkouts always create one. |
| (d) Renewals and trials | Bachs holds the card: "Bachs collects the card during checkout and reuses it for every renewal", "charges the customer's saved card off-session"; trial card "is saved at checkout". Subscriptions bill USD cards only (https://docs.bachs.io/guides/subscriptions/overview). |
| (e) Hosted checkout remembers cards for returning customers? | Not documented. The portal shows saved cards to the customer (https://docs.bachs.io/guides/customer-portal/overview). |

Important consequence: the card itself is always stored by Bachs, so "card on device only" is not possible. What can live on the device is the `pm_` reference plus the `cust_` id.

### Recommended design

- Card numbers are typed only in the Bachs hosted page (PCI scope stays with Bachs). Never in the app or on Zudomart servers.
- After `payment_method.saved`, return the `pm_` id (and brand, last4, expiry for display) to the app once. Store it in the device keystore (iOS Keychain, Android Keystore via SecureStore) with biometric access control. The server does not persist the `pm_` id; it keeps only the Bachs customer id mapping that it needs to create the charge.
- To pay: the app unlocks the `pm_` id with biometrics, sends it with the order intent. The server forwards it to `POST /v1/charges` and drops it. Bachs rejects a `pm_` that belongs to another customer, so a stolen id cannot be used against a different account.
- Biometrics is a Zudomart-side check only. Bachs does not see it. Treat the `pm_` id as a sensitive reference anyway.
- If the charge is refused (issuer wants 3DS, `PAYMENT_METHOD_UNUSABLE`, expired), fall back to the hosted checkout, which handles authentication.
- Where this cannot work: subscriptions, trials and any charge while the app is closed need the provider-side saved card, because Bachs runs those. Losing the device does not delete the Bachs card; give the user a "remove card" action (consent and removal duties are ours, per the charge-a-saved-card page). Cards are USD or NGN only.
- Not yet implemented in go-money (no `POST /v1/charges` or `save_payment_method` today).

## 4. Platform go-live checklist (what Bachs needs from Zudomart)

Sources: https://docs.bachs.io/go-live, /connect/go-live, /connect/become-a-platform, /for-you/supported-businesses.

- [ ] Request the `connect` capability **from the Bachs dashboard** (no API route). It converts the account from individual to company, "immediate and cannot be reversed." Review: "Most reviews finish within 48 hours."
- [ ] Business: registration documents, ownership and control, what we sell, and "a bank account in the business name"; its name must match the registered company name. Exact fields depend on country.
- [ ] Directors and owners (persons) with identity: NIN, BVN, passport etc. Identity check is a hosted selfie plus government ID (Smile ID per the go-live page).
- [ ] Product description, website or social link, category, support email. Provide the site, app store links, terms, privacy and refund policy pages (not demanded by name in the docs but needed for the review; see open questions).
- [ ] Category fit: marketplaces are allowed ("Platforms that onboard sub-merchants and collect payments on their behalf using Bachs's connected accounts, with proper agreements in place"). Prohibited include gambling and "mystery boxes and random pack openings", fake reviews, unlicensed financial services. The page is silent on escrow, creators, live streaming, gifts and virtual currency (coins), so ask in writing.
- [ ] Decide irreversible settings before the first account: capabilities per account and `responsibilities.fees.collector`.
- [ ] Production keys `sk_live_` with only needed scopes (`connected_accounts:write`, `transfers:write`, payouts, `webhooks:write`, and others); keys are per environment, go-live is "a key swap" (https://docs.bachs.io/integrate/sandbox). Prefix must match the app environment (the config already enforces it).
- [ ] Production webhook endpoint with `event_source` = `connect` or `all` (default `account` silently drops account events); store the live signing secret (different from sandbox); verify `X-Bachs-Signature-V2` with a 300s tolerance; secret rotation sends several `v1=` values.
- [ ] No IP allowlist is documented (open question).
- [ ] Hosted checkout branding: `PUT /v1/accounts/checkout/settings` only exposes `enabled_payment_methods`, `fee_preference`, `adaptive_pricing`. Logo and colours are not in the API (open question).
- [ ] Support contacts: `hello@bachs.io`; disputes by API (list, upload evidence, save, submit); a lost dispute can drive a balance negative and freeze all transfers and withdrawals (`ORGANIZATION_IN_DEBT`).
- [ ] Confirm card collection is approved on the live account (`GET /v1/accounts/checkout/settings`; sandbox offers every method, live does not).
- [ ] Request `virtual_accounts` only if used (needs the representative's BVN; gradual rollout; emailed request).
- [ ] Rehearse with sandbox forcing values: bank `999`/`0001112223` completes, `998`/`0001112224` fails (https://docs.bachs.io/connect/testing).

## 5. Per seller and creator requirements and our screens

Requirement states: `currently_due`, `eventually_due`, `past_due`, `pending_verification` (https://docs.bachs.io/connect/requirements). Read `GET /v1/accounts/{id}` for the live list; never hard-code.

| Account type | Bachs asks for | Zudomart screen | Gap |
| --- | --- | --- | --- |
| Creator (recipient only) | identity (name, DOB, address, phone, NIN or BVN or passport, ID document) and a payout destination; "identity and a payout destination, little else" | `apps/mobile/src/screens/creator/creatorApplication.screen.tsx`, `wallet/payoutAccounts.screen.tsx`, `wallet/withdraw.screen.tsx` | Confirm the form collects BVN or NIN, DOB, address; the ID document upload needs the hosted link step. Bank resolve (`POST /v1/misc/bank-accounts/resolve`, 20/min) should run inline. |
| Individual seller (merchant) | person as above, plus `business_profile`: product description, support email, category (from `GET /v1/reference/product-categories`), website URL; payout destination | `apps/mobile/src/screens/seller/sellerApplication.screen.tsx`, `sellerApplicationStatus.screen.tsx`, `apps/seller/.../settings/verification`, `settings/payouts` | Category list and support email may be missing; sellers with no website need a social link (go-live page) - check the form allows it. |
| Company seller | company registration, structure (`GET /v1/reference/business-structures`), representative, beneficial owners, directors with ownership percentage, bank account in company name | `apps/seller/.../settings/business-documents` (`businessDocumentsView.tsx`), mobile `seller/businessDocuments.screen.tsx` | Persons array (owners, directors, % ownership) and CAC certificate upload through the hosted link are likely not mapped; map our document types to Bachs requirement keys. |
| Everyone | status shown from `account.updated` and `capability.updated`; deadline banner from `current_deadline` | `sellerApplicationStatus.screen.tsx` | Unlock selling only on `capability.updated` with status `active`. Surface `requirements.errors` reasons (written for the holder). |
| Virtual account (optional) | representative BVN, approval | none | Not planned. |

Our own tiers (Zudomart KYB badge, payout limits) sit on top of Bachs's pass/fail.

## 6. Webhook events

Handled by `bachsConnectWebhooks.integration.go` by prefix: `collection.*`, `checkout.*`, `refund.*`, `payout.*`, `transfer.*`, `dispute.*`, `account.*`, `capability.*`, `customer.subscription.*`, `invoice.*`.

| Event | Action |
| --- | --- |
| `collection.succeeded` / `failed` / `underpaid` | source of truth for payment; fulfil from this, not from redirects or `checkout.completed` |
| `checkout.completed` / `expired` | UI state only |
| `payout.created` / `paid` / `failed` | settle or reverse the withdrawal; failure notifies ops |
| `refund.*`, `dispute.*` | update escrow and ledger; evidence deadline alert |
| `account.updated`, `capability.updated` | requirement and capability state (needs `event_source` `connect` or `all`) |
| `transfer.created` | reconcile transfers |
| `customer.subscription.*`, `invoice.*` | subscription state |
| `payment_method.saved` | **not yet classified** (falls to `other`); needed for saved cards |
| `conversion.*`, `customer.created` / `updated` | ignore (no conversions, `if_required` creates no customer) |

## 7. Error handling notes

- Money is decimal strings at currency precision; always send `Idempotency-Key` on mutations; a 5xx or timeout does not mean failure, retry with the same key or read the object.
- 429: honour `Retry-After` / `X-RateLimit-Reset`.
- Transfers and withdrawals draw only on `available_balance` (`INSUFFICIENT_BALANCE`); transfer on settlement, not on charge success; transfers cannot be cancelled and withdrawn funds cannot be pulled back.
- `ORGANIZATION_IN_DEBT` freezes all transfers and withdrawals for that party across currencies.
- A wrong or misspelled `X-Account-Id` header silently runs the call as the platform ("If the API does not recognize the header, the request runs as your platform"); unknown ids return `403`.
- Other codes seen: `DEPOSIT_LIMIT_EXCEEDED`, `WITHDRAWAL_LIMIT_EXCEEDED`, `capability_configuration_mismatch`, `OFF_SESSION_NOT_SUPPORTED`, `NO_SAVED_PAYMENT_METHOD`, `PAYMENT_METHOD_UNUSABLE`, `CHECKOUT_CANNOT_SAVE_PAYMENT_METHOD`.
- Unknown request fields are accepted silently with defaults; compare responses to the field reference.
- Three failed schedule runs reset the currency to `manual` (`disabled_reason`).

## 8. Open questions for Bachs

1. Does a connected account holder ever get a Bachs dashboard login (service user, onboarding emails, hosted links)? Can it be disabled so only the platform key can change schedules and withdraw? The payout-schedules page says the holder "can change it from their own dashboard".
2. Can a platform lock a connected account's schedule at `manual`, or revoke the `payouts` capability temporarily as a kill switch? (Docs say active capabilities have no revocation.)
3. Are escrow-style holds, creator earnings, live-stream gifts and in-app coins permitted under Supported businesses? Is a delayed release (up to days) acceptable to your risk team?
4. Who owns KYC of connected accounts, Bachs or Zudomart? Can an `individual` without CAC registration hold merchant capabilities?
5. IP allowlisting for API keys or webhook source IPs? Logo and colour branding for hosted checkout and account links? Is the account-link flow usable in an in-app browser on mobile?
6. Which fee table is current (pricing page versus fees page) for cards and mobile money? Any withdrawal minimum or per-withdrawal limit for NGN? Platform negotiated rates?
7. Can `POST /v1/charges` and `save_payment_method` be used with `X-Account-Id` (card saved to a connected account), and is the feature leaving beta? Does an off-session charge on an NGN card work?
8. Are the terms of service for platforms published (only https://app.bachs.io/legal/terms is referenced; `bachs.io/terms` returns 404 and the pricing page has no legal links)?

## 9. Changelog (this review)

- Added this document and linked it from `docs/checkoutPaymentFlowPlan.md` and `services/README.md`.
- `services/go/modules/payments/src/integrations/bachsPayoutFeeSchedule.integration.go` (new): published withdrawal fee table as rules (flat, bps, minimum, cap), defaults NGN flat 50 (`5000` minor), USD 1% min $1 cap $15, any other 0.3%; parsed from `BACHS_PAYOUT_FEE_SCHEDULE` (format `NGN:flat=5000;USD:bps=100,min=100,cap=1500;*:bps=30`).
- `bachsConnectMoneyMovement.integration.go`: `QuotePayoutFee` uses the rule table; removed the hardcoded NGN constant. `BACHS_PAYOUT_FEE_OVERRIDES` still works as a flat per-currency override and wins.
- `configs/payments.config.go`, `container/payments.container.go`, `services/go/.env.example`: new `BACHS_PAYOUT_FEE_SCHEDULE`; override example cleared.
- Tests added (`bachsPayoutFeeSchedule.integration_test.go`); `go test -short ./...` passes in payments and wallet.
- The NGN value was already NGN 50 and matches the published fee. Other currencies previously returned "not supported"; they now quote from the table.
- Not changed: contact email alias, `payment_method.saved` handling, `POST /v1/charges`. These are recommendations above.
