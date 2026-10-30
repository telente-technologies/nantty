# Nantty global pricing engine specification

Status: partial implementation; reviewed 2026-10-29. No live FX or active production price table was queried. Nigeria working prices are defaults, not a statement of current database values or public prices.

## Existing code boundary

- `services/go/platform/regionpricing/regionPricing.plans.go` holds initial monthly defaults for NG, GH, KE, ZA, GB, EU and US, computes yearly from monthly with a 20% default discount, derives app estimates, and maps store product IDs. Nigeria defaults include Blue Basic NGN 2,500, Blue Premium NGN 20,000, Gold Basic NGN 5,000, and Gold Premium NGN 30,000.
- `services/go/modules/subscriptions/src/modules/billing/services/priceTable.service.go` uses database rows and append-only effective-dated price versions as the runtime price authority. Admin changes write web monthly/yearly amounts and server-derived Apple/Google estimates in one immutable version; old rows remain as compatibility baselines. Existing database rows are not changed by this code update or by editing seed defaults.
- `services/go/platform/regionpricing/regionPricing.storeFees.go` and the admin `appStore.fees` document currently provide global Apple/Google fee assumptions. The admin price editor makes web values editable and displays derived store amounts. Store product IDs remain configurable.
- The verification-plan response now carries `channel` and `storeProductId`, and Gold seller plans are marked in-app eligible. The mobile verification application screen still uses a mock purchase sheet; its live Gold store-purchase flow, provider receipt ownership binding, and store-console SKU setup are not complete. Do not treat this as launch-ready in-app billing.
- Immutable effective-dated versions are implemented, but approval workflow, subscriber-impact preview/notice handling, and persisted country/program/install-cohort/Apple paid-tenure fee schedules remain gaps. Existing account eligibility and store policy controls still apply.

## Price record and lifecycle

The implemented `plan_price_versions` record stores the following core fields; the remaining schedule/approval metadata below is still recommended:

- `price_id`, `plan_code`, `country_code`, `currency`, `billing_interval`, `platform` (`web`, `ios`, `android`), integer `amount_minor`, and ISO-4217 exponent/minor-unit metadata.
- `effective_from`, optional `effective_until`, `created_at`, `created_by`, approval status, approver, approval timestamp, change reason, and prior-version pointer.
- Price origin: `founder_override`, `manual_admin`, `benchmark_suggestion`, or `store_price_point`; benchmark source URL/retrieved date/version and multiplier; any country override and its rationale.
- Optional store product/SKU/storefront price-point reference, tax inclusion mode/rate jurisdiction, provider processing schedule, and store fee schedule ID.
- Per-account subscription references keep the actual signed/accepted price version and renewal source. Never mutate that accepted agreement when an active price changes.

Admin writes are permission-gated, attributed, reasoned, effective-dated and immutable. Runtime quote selection honors the current effective version. A distinct approver/approval workflow, impact preview, second-review rule, and subscriber notice/consent orchestration are not yet implemented and remain launch prerequisites for material public price changes.

## Price sources and precedence

For any plan/market/platform, resolve in this order:

1. Approved explicit country + currency + platform override.
2. Approved regional/platform price derived from an official, captured X reference or independent owner-approved base price.
3. Explicit configured fallback market and currency, disclosed before payment.
4. If no approved price exists: unavailable; never invent FX, use a hidden USD charge, or silently reuse a different currency.

Nigeria web prices are explicit founder-set overrides and cannot be replaced by benchmark calculations. The conflicting Gold Premium and Black amounts remain drafts only and cannot be active. `NGN`, `GHS`, `KES`, `ZAR`, `GBP`, `EUR`, `USD` remain supported. Currency registry should allow adding future ISO-4217 currencies and exponents without code paths that assume all currencies have two decimals.

## X benchmark model

The X pages are reference observations, not a guarantee that all countries expose the same price or benefit package. X currently describes Basic, Premium and Premium+ (Premium checkmark after eligibility) and distinguishes business/organization offerings. Its FAQ warns that prices vary by region and by web vs in-app. Use only a verifiable country/storefront amount captured with currency, source URL, retrieval date, plan identity, channel and benchmark version. If a regional X price is not verifiable from the official source, record `unavailable`; do not substitute a guessed exchange rate.

`benchmark_multiplier` is versioned and configurable: default 0.75, alternate supported value 0.70. Calculate proposed price = reference amount × multiplier using exact rational/decimal arithmetic in minor units, then currency-specific rounding and permitted local store price point selection. This produces a *suggestion*. It must be manually reviewed and approved. It never overwrites active or Nigeria founder-set prices.

Reference pages (checked 2026-10-29): [About X Premium](https://help.x.com/en/using-x/x-premium), [X Premium FAQ](https://help.x.com/en/using-x/x-premium-faq), [Premium Organizations](https://help.x.com/en/using-x/premium-organizations). Preserve the observation snapshot alongside each suggestion because those pages and prices may change.

## Net-target and fee-aware calculation

Use integer minor units and exact rational/big-integer arithmetic. No IEEE floating-point money values. Let `N` be required net target in minor units; proportional fees include applicable platform/service, billing and processing percentages; fixed fees are `F`; customer tax behavior is `T`; the store’s permitted point set is `P`.

For a fee that is a percentage of pre-tax gross, minimum pre-tax customer gross is:

`G = ceil((N + F) / (1 - sum(applicable percentage fee rates)))`

If tax is charged on top, compute applicable tax after the untaxed gross and add it according to local law/store rules. If displayed price is tax-inclusive, solve the documented inclusive-tax equation instead; never subtract tax twice. Store provider commission, store billing fee, payment processor fee, fixed transaction fee, tax and promotional discount are separate line items/schedules. Validate total percentage remains below 100%, fee bases are defined, and quote arithmetic has no overflow.

Finally round upward or to a configured currency/store-supported price point according to the storefront’s allowed price tiers. Persist both the calculation inputs and final selected price point. Display customer’s actual final and renewal amounts; do not show a made-up “store surcharge” percentage. Web payment processing is not an app-store commission and must be configured by provider, market, method, effective date and fee basis.

### Store fee schedule dimensions

Each schedule row must identify store/provider, country/storefront, product category and recurring/non-recurring transaction class, developer program enrollment/eligibility, customer/subscriber tenure where relevant, fee rate(s), billing fee, effective start/end, source terms URL, retrieved date and operator approval. A plan price is not recalculated for an existing subscriber without the store/provider’s compliant price-change, notice and consent flow.

Apple schedule inputs must not assume Small Business Program admission. Apple’s current standard schedule describes 30% commission and 15% for qualifying auto-renewing subscription renewals after more than one year of paid service in the subscription group; approved Small Business Program participation has its own reduced rate (15% in the standard schedule). Other storefronts/alternative purchase arrangements can use different terms. Model subscriber paid tenure and storefront, and load the terms applicable to Nantty’s account rather than hard-coding a universal rate. Read the current account agreement and App Store Connect price points before creating launch values.

Google schedule inputs must be market-, fee-program-, install cohort/date-, revenue tier- and transaction-class aware. As of retrieved Google Play service-fee page on 2026-10-29, updated schedules roll out June 30, 2026 in EEA/UK/US and September 30, 2026 in Australia/Japan; the listed auto-renewing subscription structure in those markets is 10% service fee plus 5% billing fee. Other markets retain a 15% subscription rate until rollout; other transaction rates vary by revenue tier/program/install class. Do not collapse this into one global 15% value.

Official references: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Apple IAP/subscription pricing and availability](https://developer.apple.com/help/app-store-connect/reference/pricing-and-availability/in-app-purchase-and-subscriptions-pricing-and-availability), [Apple set a price](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price), [Apple Developer Program terms](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/), [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622).

## Store-compliant checkout

- iOS digital paid features use StoreKit/App Store in-app subscriptions where required by Apple policy and storefront. The app checks product availability and renders the exact App Store product price, trial/renewal/cancellation facts.
- Android digital subscriptions use Google Play Billing where required by current Play policy and market rules. Verify alternative billing/links only when Nantty is enrolled and the relevant market/policy allows it.
- Web checkout remains its own channel and is priced independently. It cannot be a universal substitute for required in-app purchase flows.
- Receipt verification is server-side. Store notifications are signed/authenticated, replay-safe and idempotent. Store records own renewal state; app clients do not assert it.
- X’s published localized pricing should be captured from official price pages/storefronts; exact market values should not be inferred from current US list amounts.

Apple and Google references above are policy sources checked 2026-10-29; confirm actual current account eligibility and market terms before launch.

## Discounts, taxes and quote object

Discounts operate against the eligible base subtotal in a declared order. Default: 20% annual reduction is configurable. Promo, new-customer, country, plan, user and campaign eligibility are server-evaluated; one best offer by default; stacking requires an explicit rule. Bundle is disabled pending founder interpretation. Store offer APIs and price points must be used where their policies require it.

Quote object is immutable, expiring and signed/identified server-side. It binds account, target profiles, plan lines, price versions, platform, storefront, currency, interval, discount IDs/amounts, tax mode/amount, fees, total and renewal amount/date. Checkout accepts quote ID only and revalidates account/profile ownership, entitlement/verification eligibility, availability, redemption atomicity and platform receipt flow. Concurrent use of a limited promotion is serialized/uniquely constrained in the database.

## Admin controls and audit

Admin may create a draft price, schedule an effective date, create manual override, configure benchmark multiplier (0.75 default / 0.70 alternate), manage fees/sources, annual discounts and promotions, and view impact cohort counts. Publishing requires authorized role and an audited approval. For each change record old/new values, currency, platform, effective dates, actor/approver, reason, affected active subscribers and notification/consent plan. Never retroactively rewrite a subscriber’s accepted price.

Government price/interval controls are separate and default non-purchasable; monthly USD 300 is unresolved vs USD 500 and remains unpublished. Government annual checkout has an explicit disabled-by-default approval flag.

## Provider limitations to resolve

Flutterwave’s public Payment Plans docs describe monthly/yearly recurring schedules, payment-plan association on initial checkout and subsequent automated charges; the public docs do not establish that Nantty’s merchant account can collect USD recurring card payments in every required country or that a particular USD government account is eligible. Confirm merchant/account capabilities, card coverage, recurring authorization, settlement/charge currency, tokenization, refunds, failed renewal policy, and webhooks with Flutterwave and sandbox-test them before offering Black checkout. Do not store PAN/CVV; use provider tokenization. See [Flutterwave Payment Plans](https://developer.flutterwave.com/docs/payment-plans-1), [payment methods](https://developer.flutterwave.com/docs/payment-methods), and [card on file](https://developer.flutterwave.com/docs/card-on-file), retrieved 2026-10-29.

## Test and operations requirements

Test currency exponents and rounding (including zero-/three-decimal currencies), exact fee arithmetic, negative/overflow handling, store price-point selection, taxes, fixed+percent fees, discounts, quote expiry/replay, concurrent redemption, regional overrides, fallback-unavailable behavior, benchmark provenance, admin role/approval audit, immutable subscription price versions, renewal and cancellation. Keep price source snapshots and run a diff/approval workflow when providers change published terms.

## Implementation status (2026-10-29)

- Added an integer-minor-unit commission gross-up calculator using big-integer intermediate math; invalid fee rates and overflow are rejected. The existing legacy helper delegates to it while preserving its prior fallback contract.
- Added a validated store-fee schedule model/resolver that requires exact platform, storefront, program eligibility, install cohort, recurrence, paid tenure and effective-date matching. It rejects drafts, ambiguous matches, invalid sources and schedules whose fees consume the full price. No rates or schedules have been activated.
- Added an integer discount calculator for percentage, fixed, annual and explicit bundle-total/bundle-higher interpretations. It accepts one discount at a time, clamps fixed discounts to the subtotal, and does not activate promotions, redemption counters, annual pricing, or the unresolved bundle policy.
- Added effective-dated, append-only regional price snapshots. The existing `plan_prices` row is preserved as the legacy baseline, and the first staff edit copies that baseline into history before appending a new version. Runtime quotes select the latest version effective at request time; scheduled future prices do not apply early.
- Added database triggers rejecting SQL `UPDATE`, `DELETE`, and `TRUNCATE` on price history. The admin price book now accepts effective dates and required change reasons, shows the next scheduled date, and displays up to 20 recent versions per region/plan. The existing staff audit event remains in place.
- The additive migration is prepared and its Atlas checksum is regenerated; it has not been applied to any application database. A disposable PostgreSQL test confirmed the migration applies and the database rejects update/delete/truncate attempts. Go billing tests, admin contract tests (56/56), and admin typecheck pass.
- Prices remain database-authoritative after seeding. Regional defaults are fallback candidates for missing rows; the admin edit path writes version rows rather than changing those seed constants or rewriting existing prices. The confirmed Nigeria Gold Premium candidate is NGN 30,000/month, but no active database price was changed or publicly deployed.
- Remaining: version platform fee schedules and benchmark-source data; connect approved schedules, discounts and immutable quotes to checkout; implement store price-point selection/tax; add approval states and impact reporting; implement the unresolved canonical-plan and government-verification flows. These remain separate from the now-working regional price history mechanism.

