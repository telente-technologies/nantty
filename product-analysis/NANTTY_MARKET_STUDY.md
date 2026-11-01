# Nantty Market Study

**Prepared:** 31 October 2026  
**Status:** Internal strategic research; not an audited market-size opinion, financial forecast, legal opinion, or claim of product launch  
**Geographic beachhead:** Nigeria; additional markets require separate validation  
**Evidence rule:** repository facts, cited external data, founder decisions, and hypotheses are labelled separately.

## Executive view

Nantty is being built as a social platform with commerce embedded in the experience: people discover posts and creators, while merchants can operate a store and turn attention into enquiries and orders. The opportunity is not simply “African e-commerce is large.” The investable question is narrower: can Nantty acquire a dense cohort of credible Nigerian sellers and creators, make discovery produce measurable buyer intent, and complete transactions with reliable support and payment handling at an acquisition cost the business can sustain?

Nigeria has substantial digital-payment activity and a large MSME base, but access is not universal. A 2025 GSMA Nigeria connectivity analysis reports that only 27% of the population owned a smartphone in 2024 and estimates a 58% mobile-internet usage gap; network coverage therefore should not be treated as equivalent to addressable users. The NCC’s 2025 statistics show 179.6 million active mobile subscriptions, but subscriptions are not unique people or app-ready customers. These facts support a mobile-first product with low-data media choices; they do not prove demand for Nantty.

The original market-size approach overstates certainty. Its Africa digital-economy headline combines unlike sectors, and its Nigeria e-commerce range, growth rates, seller counts, CACs, conversion targets, and three-year revenue forecast are not supported by a reproducible current calculation. Its assumptions also conflict with Nantty’s later decision not to charge sellers sales commission. This report does not carry those numbers forward. Nantty should publish a bottom-up TAM/SAM/SOM only after it has current category, geography, seller-activation, and transaction evidence.

## 1. Company and product context

### Repository-confirmed product direction

The codebase describes a preproduction social-commerce platform spanning mobile and web surfaces. Repository audits dated 29 October 2026 find code for accounts and profiles; feed, posts, replies, reactions and reposts; stories and clips; messaging and notifications; seller storefronts, catalog, inventory and orders; checkout, escrow, wallet and withdrawals; subscriptions and verification; ads; analytics; Creator Program tools; video live; and audio Spaces. The same audit calls several areas partial or integration-sensitive and explicitly does not establish production launch or end-to-end readiness. See [`FEATURE_INVENTORY.md`](FEATURE_INVENTORY.md) and [`FEATURE_IMPLEMENTATION_STATUS.md`](FEATURE_IMPLEMENTATION_STATUS.md).

The founder’s current commercial policy is:

- No Nantty sales commission on completed marketplace sales.
- Store creation: USD $1 on web; approximately USD $1.50 in mobile stores, subject to exact store price points, local currency, tax and store policy.
- Payment processing and withdrawals are charged at the payment provider’s actual applicable cost and shown before confirmation.
- Commercial verification subscriptions and ad/promotional products are separate monetization possibilities; creator access remains independently subject to Creator Program approval.
- Coin gifts are an in-product monetization path. Gifts are intended to credit recipients without celebratory animation; production settlement and accounting must be verified before calling this revenue realized.

These are owner decisions and implementation requirements, not proof that active database pricing, app-store SKUs, provider fees, or public checkout currently match them. Price changes belong in the database-backed admin pricing process described in [`FINAL_SUBSCRIPTION_SPEC.md`](FINAL_SUBSCRIPTION_SPEC.md); runtime values still require authorized environment verification.

### Working positioning hypothesis

> **Nantty helps Nigerian creators and small businesses turn social discovery into trusted, trackable commerce—without taking a commission on seller sales.**

This is a hypothesis to test, not a validated customer promise. Lead with the seller outcome (discovery → qualified conversation → fulfilled order), then prove trust and convenience with observed data. Avoid claiming “fraud-proof,” guaranteed sales, automatic verification, or nationwide delivery.

## 2. Market evidence and what it does—and does not—say

| Evidence | Latest source/result used | Strategic implication | Limitation |
|---|---|---|---|
| MSME scale | PwC’s 2024 survey cites the NBS/SMEDAN 2020 estimate of 39,654,385 MSMEs; the survey itself covers 557 businesses in 13 sectors. | The business population is large and diverse; segment by seller workflow, not only business size. | 2020 estimate is not a 2026 count, and not all enterprises are online, formal, addressable, or willing to sell through Nantty. Survey percentages are sample findings, not a national census. |
| Connectivity | GSMA’s 2025 Nigeria report estimates 27% smartphone ownership in 2024 and a 58% mobile internet usage gap. | Optimize onboarding and media for affordability, low bandwidth, and intermittent connectivity; validate Android device coverage. | A countrywide estimate does not describe the intended urban pilot cohort. |
| Network subscriptions | NCC’s industry statistics list 179,642,333 mobile subscriptions for 2025 and 164,926,599 for 2024. | Mobile distribution is strategically important. | SIM subscriptions are not unique users, smartphones, broadband users, or likely Nantty customers. NCC notes methodology and NIN-linked SIM changes. |
| Digital payments | CBN reports 22.42 billion non-cash retail transactions and about ₦1.559 quadrillion in value for January–June 2024 across listed channels. | Digital payment rails are material infrastructure for Nigerian commerce. | The aggregate spans multiple channels and use cases; it is not e-commerce GMV, unique shoppers, or Nantty’s obtainable spend. |
| Merchant digitization needs | PwC’s 2024 MSME survey reports demand pressure and constraints including purchasing power, finance, electricity and taxes among its respondents. | Product should reduce seller effort and make value obvious; avoid assuming subscriptions are affordable before value is demonstrated. | Convenience sample of 557, not a current Nantty customer study. |

**Key conclusion:** these sources justify testing the market. They do not justify claiming a specific Nantty market share, GMV, customer count, growth rate, CAC, or revenue forecast.

## 3. Customer segments and jobs to be done

### Initial supply-side segments

1. **Social-first micro-merchants:** already promote products through messaging or social posts; need an organized catalog, persistent profile/store, enquiry handling, and a way to turn discovery into a completed order.
2. **Small neighborhood retailers and emerging brands:** need repeatable product publishing, inventory/order visibility, customer confidence, and promotion measurement. Their willingness to pay is likely conditional on measurable incremental value.
3. **Creators and specialist service providers:** need an audience, a clear profile, content tools, monetization options, and a separately reviewed path into creator-only products. Creator Program approval must not be represented as automatically granted by paying for a badge.
4. **Buyers:** need useful discovery, credible seller information, transparent total cost, responsive support, and clear recourse if an order or payment fails.

### Early buyer-side hypotheses to test

- Short-form posts and creator recommendations can generate qualified product discovery more efficiently than a separate seller directory.
- Trust signals, payment transparency, seller responsiveness and dispute handling influence conversion more than a badge alone.
- Sellers will create and maintain a Nantty store if setup is fast and the fee is explicit; the USD $1 web fee and mobile-store price difference need usability and willingness-to-pay testing.
- No sales commission is a compelling seller message, but sustainable revenue must then come from voluntary, clearly priced services (e.g., subscriptions, advertising/promotions, store setup, gifts) after value has been demonstrated.

Do not describe any of these hypotheses as validated until interviews, funnel metrics, and completed transactions support them.

## 4. Competition and substitutes

Competition is defined by the user job—product discovery, seller storefronts, conversations, checkout, fulfillment—not by one narrow “social commerce” label.

| Competitor / substitute | Strongest current substitute behavior | Nantty’s possible wedge | What Nantty must prove |
|---|---|---|---|
| WhatsApp Business | Catalogs, product/service collections, catalog links, carts and direct customer conversations. | Connect public discovery and persistent storefront information to a social feed and transaction-support flow. | Sellers need more than a chat catalog; buyer conversations can transition safely and reliably. |
| Jiji | High-reach classifieds, listing discovery, seller contact by chat/call, and paid seller promotion. Jiji itself advises users to use caution and avoid advance payments. | Richer relationship/content loop plus clearer transaction state and support, if the implemented protections work. | Trust measures change buyer behavior without adding prohibitive onboarding friction. |
| Jumia | Managed marketplace with seller services, seller tooling, logistics and advertising; SEC filings report about 70,000 sellers and 6.0 million annual active customers across its operating group at 31 December 2025. | More social-native discovery, seller-owned audience/identity, and no Nantty sales commission. | Local supply density, service reliability and repeat purchase can compete with an established marketplace’s operations. Jumia’s figures are group-wide, not Nigeria-only. |
| Facebook/Instagram | Large social audiences, marketplace/social posts, ads and messaging; Meta’s available commerce features vary by country and eligibility. | A joined-up path from social post to store/order, built for Nantty’s target market and policy model. | Nantty can acquire attention and transactions without relying on Meta’s reach or assuming native Shops features are available to every Nigerian seller. |
| TikTok and other video platforms | Short video discovery and creator distribution; commerce capabilities and terms are market-specific. | Link content to persistent merchant storefronts and supportable transaction journeys. | Product discovery can convert on Nantty while retaining creator value. Do not present a US seller page or US fee as a Nigerian market benchmark. |
| Independent storefronts (e.g., Shopify/WooCommerce) | Merchant-controlled catalog and checkout with flexible brand/control. | Combine storefront with native feed discovery, community and creator relationships. | The incremental discovery benefit exceeds the cost of learning and maintaining another channel. |

Competitor fees are deliberately not compared in this study because they vary by category, country, services and campaign; a rate copied from a foreign market would mislead. Recheck current country-specific terms before any public fee comparison.

## 5. TAM, SAM and SOM: defensible method, not false precision

### Why no headline number is published here

The cited MSME count is stale for a current addressable-market estimate, mobile subscriptions are not people, broad African digital-economy value includes businesses Nantty does not serve, and total payment-system values are not online retail GMV. The original figures for African and Nigerian e-commerce, projected CAGR, seller counts, CAC and GMV per merchant cannot be reproduced from stated sources and assumptions. Treat them as withdrawn pending a source-backed model.

### Model to populate with evidence

- **TAM (transaction opportunity):** annual value of Nigeria-based consumer-to-merchant purchases in the categories and digital channels Nantty could support, using a current official or clearly documented dataset. Report separately from platform revenue.
- **TAM (platform revenue):** eligible store-opening fees + voluntary subscriptions + paid advertising/promotions + net retained margin on coin gifts or other products, less store/payment costs, refunds, tax and servicing costs. Do not apply a sales take rate.
- **SAM:** TAM limited to the launch geographies, supported seller categories, eligible devices/networks, allowed payments, fulfillment coverage and operationally supported product features.
- **SOM:** a cohort model: `active paying/monetizing accounts × observed adoption by revenue stream × price × retention`, constrained by actual acquisition capacity, support capacity and seller/buyer liquidity. Publish 12–24 month cases as operating scenarios, not “market share” derived from arbitrary percentages.

### Data required before presenting quantified TAM/SAM/SOM

1. Define included transaction categories and exclude unsupported/regulated goods or services.
2. Obtain up-to-date Nigerian retail e-commerce estimates or conduct a cited bottom-up study; preserve source definitions and base year.
3. Run 30–50 structured interviews across sellers, creators and buyers as discovery research (sample target, not a national estimate), followed by a larger quantitative survey if useful.
4. In pilot, measure active sellers, listings with availability, qualified buyer conversations, order conversion, completed orders, refund/dispute rates, creator activation, payment success and repeat purchase by cohort.
5. Separate GMV from Nantty revenue and distinguish gross subscription receipts from net of store/provider fees, taxes, refunds and creator payouts.

## 6. Business model and pricing logic

| Revenue stream | Current owner direction / evidence | Guardrail |
|---|---|---|
| Store creation | $1 web; approximately $1.50 mobile | Show final local-currency charge, tax and store context before the user creates the paid store. Price and SKU are admin-managed; do not hardcode or imply exact FX equivalence. |
| Marketplace transactions | 0% Nantty sales commission | Provider fees are separate, actual, and disclosed. Audit active configuration before staging; fresh-install defaults do not prove persisted settings. |
| Payment processing / withdrawals | Pass through actual provider charges | Do not add an arbitrary margin. Reconcile displayed quote to provider charge and ledger. |
| Checkmark subscriptions | Blue Basic ₦2,500; Blue Premium ₦20,000; Gold Basic ₦5,000; Gold Premium ₦30,000 monthly web working prices, per current founder decisions/spec | Admin/database is price authority. Existing active subscriber price and billing terms require versioned changes; current runtime price and store SKUs are not verified here. Black price is unresolved and not self-serve. |
| Advertising and promotions | Supported as a potential paid acquisition service; repository contains ad/campaign paths, with partial status | Paid inventory must be clearly labelled and campaign outcomes reported accurately. |
| Coin gifts | Product direction includes gifts in Spaces and creator profiles | Separate purchased coins, creator share, payment cost, refunds, accounting and compliance. No animation is a UI rule, not financial completion evidence. |

## 7. Go-to-market recommendation: prove one dense loop

1. **Select one launch cluster and two or three seller categories** using interviews and logistics/payment readiness; do not expand across Nigeria on day one solely because the population is large.
2. **Recruit supply first in a bounded cohort.** Require current products, accurate price/availability, response SLA and a clear fulfillment promise. Avoid paying to grow empty stores.
3. **Seed creator-to-seller content** around actual products and measurable links. Track attributable qualified conversations and completed orders, not video views alone.
4. **Instrument the funnel:** invite → sign-up → verification → store open → first listing/post → first qualified buyer → first completed order → repeat order.
5. **Run a concierge pilot** with explicit user consent and support. Record reasons for non-conversion, failed payment, cancellation, returns, disputes and seller churn.
6. **Expand only when a cohort repeats:** the first market expansion gate should include contribution margin, seller retention, buyer repeat, on-time fulfillment, support capacity, payment reconciliation, and local legal review.

## 8. Prioritized market validation experiments

| Experiment | Hypothesis | Measure / decision |
|---|---|---|
| Seller problem interviews | Sellers have a recurring discovery/order workflow pain not solved by current social channels. | Record current channel mix, monthly order flow ranges, time spent, failed handoffs and willingness-to-switch; do not treat stated willingness as purchase intent. |
| Store fee comprehension | A one-time store fee is understandable and acceptable when its purpose and final charge are transparent. | Completion and abandonment by platform, price shown, fee comprehension, support/refund requests. Compare only ethically disclosed price tests. |
| Content-to-order attribution | Native creator/product content generates qualified buying intent. | Click/contact → order conversion, incremental orders vs baseline, creator payout cost, repeat purchase. |
| Trust design | Verification and transaction clarity improve confidence. | Compare completed order and dispute rates, not badge impressions alone; do not test misleading “guaranteed safe” claims. |
| Seller no-commission message | Zero sales commission is valued enough to drive activation. | Activated/retained sellers and their actual cost-to-serve; test whether voluntary paid products are adopted later. |

## 9. Risks and launch implications

- **Two-sided cold start:** start with a narrow supply/demand cluster; broad feature breadth does not create liquidity by itself.
- **Affordability and connectivity:** low-bandwidth behavior and data usage are market requirements, not polish. GSMA’s usage-gap evidence supports measuring failed uploads and slow-network completion.
- **Trust and consumer protection:** transparent seller identity, product claims, full price, delivery terms, complaint handling, cancellation/refund policy and response times matter. FCCPC e-commerce guidance calls for clear terms, upfront disclosures and an accessible complaint-redress path.
- **Payments boundary:** the CBN regulates payment-system participants. Legal review must confirm the contractual and operational model with the licensed provider; do not imply Nantty is a bank, wallet issuer or licensed payment processor absent authorization.
- **Data protection:** NDPC says the Nigeria Data Protection Act applies to relevant processing and emphasizes lawful, accountable processing and user rights. KYC, identity, financial and creator data require minimization, retention controls and incident-response readiness.
- **Revenue-model mismatch:** stale product copy, stored fee settings or tests that continue to charge commission would contradict the 0% founder policy. Reconcile runtime configuration and customer terms before public launch.
- **Feature-readiness risk:** repository implementation is not production readiness. Creator payouts, Spaces integrations, payment flows, media moderation, disputes and operational support need integrated test evidence.

## Research sources

Sources accessed 31 October 2026. Figures retain each source’s measurement year and definitions.

1. [NCC — Industry Statistics](https://testing.ncc.gov.ng/market-data-reports/industry-statistics) — annual mobile subscription statistics; subscriptions are not unique people.
2. [GSMA — Nigeria smartphone adoption and connectivity analysis (2025 report)](https://www.gsma.com/about-us/regions/africa/wp-content/uploads/2025/11/GSMA-SmartPhone_Adoption_Report_sm.pdf) — 2024 smartphone ownership and usage-gap estimates.
3. [CBN — e-Payment Statistics](https://www.cbn.gov.ng/PaymentsSystem/ePaymentStatistics.html) — January–June 2024 channel totals.
4. [CBN — Payment Modes](https://www.cbn.gov.ng/PaymentsSystem/modes.html) — discussion and channel context through June 2024.
5. [PwC Nigeria — MSME Survey 2024](https://www.pwc.com/ng/en/publications/strategies-for-msme-success.html) — primary survey of 557 firms; cites the NBS/SMEDAN 2020 MSME count.
6. [Jumia Group — 2025 annual report filed with the SEC](https://www.sec.gov/Archives/edgar/data/1756708/000175670826000015/jmia-20251231.htm) — group-wide seller/customer scale and marketplace/seller services.
7. [Jiji — About and how the marketplace works](https://jiji.ng/about.html) — listing, buyer contact and safety guidance.
8. [WhatsApp Business — Features](https://whatsappbusiness.com/products/business-app-features/) — catalogs, catalog links, carts and messaging distribution.
9. [TikTok Shop — Seller information](https://seller.tiktok.com/) — market-specific seller offering; country terms must be checked locally.
10. [NDPC — NDP Act 2023](https://www.ndpc.gov.ng/ndp-act-2023/) and [NDPC FAQs](https://ndpc.gov.ng/faqs/) — Nigerian privacy regulator materials.
11. [FCCPC — Business Guidance on E-commerce](https://fccpc.gov.ng/business-guidance-on-e-commerce-2/) — disclosure and complaint-redress guidance.

## Repository evidence reviewed

[`product-analysis/FEATURE_INVENTORY.md`](FEATURE_INVENTORY.md), [`FEATURE_IMPLEMENTATION_STATUS.md`](FEATURE_IMPLEMENTATION_STATUS.md), [`FINAL_SUBSCRIPTION_SPEC.md`](FINAL_SUBSCRIPTION_SPEC.md), [`PRICING_DECISIONS_PENDING.md`](PRICING_DECISIONS_PENDING.md), [`docs/architecture/marketplace.md`](../docs/architecture/marketplace.md), [`docs/architecture/payments.md`](../docs/architecture/payments.md), [`docs/plans.md`](../docs/plans.md), and [`docs/CHANGELOG.md`](../docs/CHANGELOG.md). Code status was source-audited, not exercised against production or a live payment provider.
