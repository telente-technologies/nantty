# Nantty Internal Business and Product Review

**Prepared:** 31 October 2026  
**Audience:** Nantty founder and authorized internal reviewers  
**Status:** Confidential internal working review; not for public circulation without founder review  
**Decision context:** Product is still being built; it is not ready for beta or public launch based on the evidence reviewed.

## 1. Bottom line

Nantty has substantial source-code foundations for a social product with marketplace, seller, payment, subscription, creator, advertising, analytics and administration surfaces. That is meaningful execution progress, but it is not the same as a verified, supportable, secure launch product. Existing internal audits explicitly identify incomplete cross-service validation, fee/configuration reconciliation and integration gaps. No independent user traction, revenue, conversion, retention, CAC or completed-order data was evidenced in the materials reviewed for this report.

The immediate company task is to reduce the distance between “code exists” and “a small group of users completes the core loop safely.” Do not set a public beta date until a bounded pilot scope, support owner, price truth, payments/ledger reconciliation, complaint workflow and complete release tests are agreed and passed.

### Recommendation

Run a closed, instrumented validation cohort only after the launch gates in Section 7 pass. Keep the first product story simple: **social discovery for Nigerian sellers and creators, with a clear path to a store and an order**. Do not lead with a broad continent-scale marketplace, “all-in-one” feature checklist, or claims of validated trust and sales uplift.

## 2. Current company and product record

### Product status from repository review

The repository’s 29 October 2026 audit classifies account/profile, feed, marketplace and billing code as implemented at source level; creator tools and audio Spaces as partially implemented; ads and analytics as partial; and payment/escrow/wallet as financially critical but not live- or sandbox-validated in that audit. It warns that mocks/help copy do not prove runtime behavior, and identifies schedule publication editing/retries/moderation, active pricing configuration and creator/Space integration as open verification areas. The source references are in [`FEATURE_IMPLEMENTATION_STATUS.md`](FEATURE_IMPLEMENTATION_STATUS.md), [`FEATURE_INVENTORY.md`](FEATURE_INVENTORY.md), [`POST_SCHEDULING_ARCHITECTURE.md`](POST_SCHEDULING_ARCHITECTURE.md), and [`SUBSCRIPTION_SECURITY_GAPS.md`](SUBSCRIPTION_SECURITY_GAPS.md).

The living plan [`docs/plans.md`](../docs/plans.md) contains completed items, partial items, historical paths and later work. Treat its status markers and dated notes as project context, not proof of current production operation. Before external use, reconcile planned, complete, and unverified claims against a fresh code/build/runtime check.

### Current founder-approved business rules found in project context

- No Nantty commission on seller product/service sales.
- Payment processing and withdrawal costs are passed through at actual provider cost, disclosed before confirmation.
- Opening a store costs $1 on web; mobile target is approximately $1.50, with final platform price/currency set to supported store tiers and shown before purchase.
- Nigeria web subscription assumptions currently recorded: Blue Basic ₦2,500/month, Blue Premium ₦20,000/month, Gold Basic ₦5,000/month, Gold Premium ₦30,000/month. They are not a substitute for querying active database and store prices. Black Government pricing remains unresolved and must not be publicly self-served.
- Creator Program approval is separate from Blue subscription. Government identity approval is separate from commercial billing.
- Spaces are creator-hosted; listeners may join; gifts are coin-based; no leaderboard or gift animation. These are product decisions, not proof that all integrations/settlement behavior are launch-ready.

See [`FINAL_SUBSCRIPTION_SPEC.md`](FINAL_SUBSCRIPTION_SPEC.md), [`FOUNDER_DECISIONS_REQUIRED.md`](FOUNDER_DECISIONS_REQUIRED.md), [`GOVERNMENT_VERIFICATION_FLOW.md`](GOVERNMENT_VERIFICATION_FLOW.md) and [`docs/architecture/payments.md`](../docs/architecture/payments.md). Price source-of-truth is intended to be admin-managed backend data. Effective staging/runtime prices, app-store price points and stored platform revenue settings still require read-only reconciliation and explicit review.

### Founder-provided team context

The current internal team description is one founder leading founder/software engineering, two designers and one additional developer. This is founder-provided context, not a verified HR roster. The earlier materials’ co-founder identity, three-developer count, past experience claims, funding ask and allocation are stale or conflicting; do not repeat those in a deck, website or application. Confirm titles, employment/contract status and consent before public bios.

## 3. Business model review

| Component | Current direction | Evidence / concern | Recommendation |
|---|---|---|---|
| Store opening | $1 web / approximately $1.50 mobile | Founder-provided pricing intent; active runtime/store catalog has not been checked here. | Charge once at clear store creation boundary; describe what the fee covers; confirm app-store policy, taxes, local price points, refund handling and exact price before public display. |
| Sales commission | 0% | Founder decision and current architecture notes; old settings or UI may still contradict it. | Audit effective persisted fees and quote/ledger paths in isolated staging; reconcile public copy and existing customer terms before launch. |
| Provider costs | Actual processing/withdrawal amounts at cost | Contract, payment method, market and amount may affect fee. | Retrieve provider amount, disclose it line-item before consent, and reconcile charged amount with ledger; never invent a percentage. |
| Commercial subscriptions | Blue/Gold tiers with configurable country/platform prices | Price records are database-backed by design, but active values and store SKUs are unverified. | Maintain versioned plans and effective dates in admin. Test renewals, refunds, price notices and store-specific billing rules. |
| Ads/promotions | Optional paid campaigns and promoted inventory | Code exists, but revenue/attribution and full operation are not proven. | Launch only with clear labels, budgets, targeting disclosure, pacing, refunds and measurement. Keep ad-free entitlements accurate. |
| Coin gifts | In-product creator gifts, including Spaces/profile entry points | Product request exists; recipient share, replay, refund, creator eligibility and cash conversion need financial-integrity evidence. | No animation; provide a clear credited receipt/notification. Keep coin ledger, payout and chargeback effects auditable and idempotent. |
| Creator monetization | Creator program, subscriptions/affiliate-related capabilities | Partially implemented/integration-sensitive; independent approval is required. | Gate by accepted status and server-side checks; disclose payout terms and settlement timing; do not treat badge purchase as creator access. |

### Unit economics: what is missing

No decision-grade forecast can be made from feature scope alone. A real model needs:

- Cohort volumes by acquisition channel, activation, seller listing quality, buyer conversion and repeat orders.
- Price/discount, platform, market, billing frequency, taxes and renewal/retention assumptions by product.
- Payment-provider and app-store costs, refunds, disputes, fraud loss and creator payout share.
- Media/CDN/streaming, support, KYC, moderation, logistics integrations and customer service cost per active user/order.
- Team/contractor, cloud/infrastructure and compliance operating costs; actual runway and financing need confirmed by finance records.
- Sensitivity cases and cash-flow timing, including settlement/payout working capital and failure scenarios.

Do not revive an old three-year projection until all assumptions can be tied to validated research or tagged as an explicit scenario. Separate marketplace GMV from Nantty net revenue. Since sales commission is 0%, GMV is not recognized as Nantty revenue.

## 4. Market and competitive review

Nigeria’s enterprise and mobile-payment opportunity is material, but headline population, SIM subscriptions and electronic payment totals are not Nantty’s reachable market. The latest sources reviewed show an MSME survey based on 557 firms and a 2020 cited national MSME count; GSMA estimates 27% smartphone ownership in 2024 and a substantial mobile-internet usage gap; and NCC reports mobile subscriptions rather than unique app users. These support targeted research and low-bandwidth design, not a precise TAM/SAM/SOM claim. See [`NANTTY_MARKET_STUDY.md`](NANTTY_MARKET_STUDY.md) for definitions and sources.

Competitor substitutes are strong by function: WhatsApp Business catalogs and conversations, Jiji classified reach and paid promotion, Jumia’s managed marketplace/seller/logistics/ads stack, Meta discovery/messaging, video platforms and independent storefront software. Nantty’s potential opening is the connected workflow and 0% seller sales commission—not a claim that every incumbent lacks trust controls. The key unknown is whether sellers/buyers adopt and repeat on a separate platform.

## 5. Internal review findings

### Critical business consistency items

1. **Fees:** explicitly reconcile effective persisted platform settings to the 0% seller-sales commission decision. The product audit notes default seeds can differ from already-persisted rows. Test quote amount, provider response, ledger postings, receipt and marketing/policy language together.
2. **Price authority:** ensure one active database-backed schedule determines web and app display inputs. Admin edits must include currency, platform, effective date, fees/taxes, approval and immutable history. Existing subscriptions should not silently reprice.
3. **Product claims:** distinguish shipped source code from tested behavior. Avoid “verified marketplace,” “secure escrow,” “instant payout,” “live Spaces,” “AI recommendations,” and nationwide coverage unless each claim is scoped, supported and operationally true.
4. **Store verification costs:** founder has discussed Flutterwave-led business verification before using a separate identity vendor in some cases. The report cannot confirm provider capabilities or regulatory sufficiency. Obtain written provider capability confirmation and legal/compliance review; a successful payment is not automatically proof of legal business identity or representative authority.
5. **Creator eligibility and funds:** Nigerian Flutterwave access or identity signals must not be treated as automatic proof of creator suitability or international payout capability. Maintain a clear application/review route for all eligible geographies and verify how creators are paid without unsafe manual workarounds.
6. **Spaces/gifts:** treat voice-room creation, joining, moderation, coin purchase, gifting, recipient attribution, credit notification, refunds and settlement as separate testable state transitions. No leaderboard/animation should be present; money correctness is the launch criterion.

### Investor narrative gaps

The strongest narrative will be a concise and evidenced chain:

1. A precise seller or creator problem in a Nigerian launch segment.
2. How the current behavior fails and the measured cost/friction.
3. Nantty’s focused workflow and 0% sales commission.
4. A working product demonstration with explicit pre-beta scope.
5. Pilot recruitment and measurement plan.
6. Evidence: interviews, active cohort, completed orders, retention, payment quality and contribution margin—only when verified.
7. Business model and transparent unit economics.
8. Competition and why sellers/buyers will use Nantty alongside existing channels.
9. Team roles and relevant proof, accurately described.
10. A specific funding/partnership ask with amount, runway and use-of-funds tied to verified milestones, after current finance records are confirmed.

Do not include an outdated funding amount, stale team names, fictional traction, arbitrary TAM market share, unsupported “10% take rate,” or an unapproved launch date.

## 6. Recommended next 90 days (relative plan, not dated commitment)

### Phase A — Product and controls

- Freeze an explicit pilot scope: account, profile, seller store, catalog, post/discovery, buyer conversation, order/payment status, support and refund/dispute path.
- Reconcile 0% commission and all effective fees/prices in isolated staging; verify admin edits and public disclosures.
- Complete payment/ledger, identity, account recovery, privacy/consent, moderation and admin authorization regression checks.
- Confirm mobile store billing products and web/app price display rules; keep subscription price and store-open price admin-configurable.
- Set up event definitions and dashboards before recruiting the cohort.

### Phase B — Closed cohort

- Recruit a bounded set of sellers and buyers from one geography/category combination chosen through interviews and fulfillment readiness.
- Run assisted onboarding with explicit consent; document every failed step and support request.
- Measure activation, first qualified enquiry, first completed order, repeat purchase, on-time fulfillment, payment success, dispute/refund rate, seller retention and acquisition cost.
- Use qualitative exit interviews with inactive users and sellers who do not complete a listing/order.
- Do not broad-market paid features or paid subscriptions until users can explain the value and prices are accurate.

### Phase C — Gate and decision

- Compare observed contribution margin and support load with a founder-approved threshold.
- Fix the highest-friction funnel step; add no new major surface unless it removes a validated blocker.
- Decide: expand cohort, repeat it, narrow categories, or pause. Document evidence, date and decision owner.
- Only then set a public beta date and create external launch materials.

## 7. Beta / launch gates

| Gate | Required evidence | Owner type |
|---|---|---|
| Product slice | Published scope, feature flags, known limitations, rollback plan, tested iOS/Android/web flows. | Product + engineering |
| Prices and fees | Admin/database source, staging quote tests, app-store catalog checks, 0% commission, exact provider charge disclosure, renewal behavior. | Finance + engineering |
| Money safety | Idempotent payments/webhooks, escrow release/refund/payout concurrency tests, ledger reconciliation, synthetic sandbox results. | Finance engineering |
| Trust and safety | Reports, moderation, seller verification scope, user appeal, fraud handling, customer-support escalation. | Trust + operations |
| Privacy/legal | Terms, privacy notice, lawful data handling, retention, consent, data-subject requests, vendor agreements, qualified local review. | Privacy/legal |
| Operations | Staff roles, case queue, response coverage, incident contact, refund/dispute playbook and tested backups. | Operations |
| Reliability | Monitoring/alerting, recovery test, rate limits, dependency failure behavior, capacity test bounded to pilot. | SRE/engineering |
| Metrics | Event dictionary, dashboard reconciled to backend/ledger, cohort definitions and export access controls. | Data + product |
| Pilot readiness | Recruit list and consent, geography/category availability, seller stock/fulfillment, buyer demand, support capacity. | Founder + operations |

## 8. Decisions to confirm before external materials

1. Which pilot geography and initial seller category will define the first cohort?
2. Who owns day-to-day support, trust escalation, refunds and reconciliation, and what coverage hours can be promised?
3. What final local-currency prices and taxes will show for the $1 web / approximately $1.50 mobile store-opening charge?
4. Which app-store fee schedules and product SKUs have been approved for each supported market, and which subscriptions are actually available there?
5. What written refund/cancellation policy applies to paid store creation and subscriptions?
6. Which evidence is required before using “verified,” “protected,” “escrow,” “creator approved” or “nationwide” in marketing?
7. What financial statements, runway, financing requirement and funding ask are current and approved for investor circulation?
8. Who has approved the organization’s privacy/data-protection and payment operating model?
9. What are the founder-approved numeric thresholds for a second cohort or public beta?

## 9. Source and provenance

This document synthesizes current repository documentation and product decisions with external references available on 31 October 2026. The current product status is source-derived, not an executed production check. Financial/operating performance is unknown unless supported by a dated, reproducible Nantty data extract.

- Product context: [`FEATURE_INVENTORY.md`](FEATURE_INVENTORY.md), [`FEATURE_IMPLEMENTATION_STATUS.md`](FEATURE_IMPLEMENTATION_STATUS.md), [`FINAL_SUBSCRIPTION_SPEC.md`](FINAL_SUBSCRIPTION_SPEC.md), [`PRICING_ENGINE_SPEC.md`](PRICING_ENGINE_SPEC.md), [`FOUNDER_DECISIONS_REQUIRED.md`](FOUNDER_DECISIONS_REQUIRED.md), [`SUBSCRIPTION_SECURITY_GAPS.md`](SUBSCRIPTION_SECURITY_GAPS.md), [`docs/plans.md`](../docs/plans.md), [`docs/CHANGELOG.md`](../docs/CHANGELOG.md).
- Market evidence and external citations: [`NANTTY_MARKET_STUDY.md`](NANTTY_MARKET_STUDY.md).
- Regulatory primary sources: [NDPC NDP Act 2023](https://www.ndpc.gov.ng/ndp-act-2023/), [FCCPC e-commerce guidance](https://fccpc.gov.ng/business-guidance-on-e-commerce-2/), [CBN payment-system supervision](https://www.cbn.gov.ng/PaymentsSystem/index.html).
