# Nantty subscription restructuring — final working specification

Status: implementation specification, dated 2026-10-29. It records founder-approved product rules and explicitly marks unresolved commercial choices. It is not a public price sheet and does not establish production database values.

## Canonical commercial plans

| Plan | Audience | Badge after approval | Monthly working price | Channels | Paid scheduling |
|---|---|---|---:|---|---|
| Blue Basic | eligible personal accounts, including creators | Blue | NGN 2,500 (Nigeria web) | web and store prices configured separately | Yes |
| Blue Premium | eligible personal accounts, including creators | Blue | NGN 20,000 (Nigeria web) | web and store prices configured separately | Yes |
| Gold Basic | verified businesses, brands and stores | Gold | NGN 5,000 (Nigeria web) | web-first; channel availability explicitly configured | Yes |
| Gold Premium | verified businesses, brands and stores | Gold | NGN 30,000/month confirmed by founder for Nigeria web pricing | web-first; channel availability explicitly configured | Yes |
| Black Government | approved government institutions and authorized accounts | Black | **USD 300/month (NG) / USD 500/month (international)** based on verified legal jurisdiction | web only (private authorized checkout; monthly-only; no discounts) | Not applicable |

The founder confirmed NGN 30,000/month for Gold Premium on 2026-10-29, superseding the prior NGN 17,000 working assumption, and finalized Black Government pricing on 2026-11-16 at **USD 300/month (Nigeria legal jurisdiction)** and **USD 500/month (international)**, USD-only, monthly-only, web-only, with no discounts, zero unpaid grace days, and mandatory recurring USD card authorization. Existing subscriber prices/history must not be rewritten by changing defaults.

Exactly three badge colors exist: blue, gold and black. Tier changes features/limits, never badge color. Verification/eligibility approval and billing are separate state machines: a paid subscription cannot make an unverified identity eligible, and verification cannot imply a paid subscription. Black is a government vetting class, not an admin role.

## Entitlement policy

### Free individual

Retain standard account, posting, feed, messaging, privacy controls, recovery, safety reporting, moderation appeals, and consumer-protection functionality. Keep essential security/privacy/recovery and legally required controls free. Creator Program approval remains independent of a Blue plan.

### Blue Basic

- Blue badge only after successful independent verification approval.
- Unlimited accepted scheduled feed posts; 90-day maximum horizon.
- Reduced platform-controlled ad inventory at the existing 60% normal-load setting (confirm exact interpretation is “60% of normal,” not 60% reduction, before customer copy).
- Basic post analytics only where the existing backend supports it.
- No claims for missing or mock-only tools.

### Blue Premium

- Includes Blue Basic; same Blue badge.
- No platform-controlled ad inventory. This does not promise removal of creator sponsorships, user posts, or other non-platform-controlled content.
- Unlimited scheduled posts, 90-day horizon.
- Advanced analytics/reporting and export only where implemented and access-controlled.
- Up to five linked business profiles, while preserving the separate one-owned-store rule and profile ownership rules.
- Priority support response only if an operational SLA and staffing process exist; otherwise mark as future/not included.
- Creator tools/live access remain subject to independent Creator Program acceptance and safety rules.

### Free business/store

Keep baseline seller/store access and the currently enforced Free operational limits. The audit found resolver defaults of 100 active products, 1 location, 0 staff seats and 30-day analytics. Verify these against all deployed settings and help copy before representing as universally current.

### Gold Basic

- Gold badge after business/store identity approval.
- Verified product label only when identity and the product association qualify.
- Unlimited scheduled posts; 90-day horizon.
- Existing ad-load policy is 50% of normal (confirm percentage wording).
- Core seller capabilities and the existing Free seller operational limits; do not grant a second seller subscription implicitly.
- Basic store reporting only where enforced.

### Gold Premium

- Includes Gold Basic; same Gold badge.
- No platform-controlled ad inventory.
- Unlimited scheduled posts; 90-day horizon.
- Advanced inventory and bulk tools; unlimited active products; maximum 10 store locations; maximum 25 staff seats; up to 730 days seller analytics history; advanced reporting.
- Customer segmentation/promotions only where implemented.
- Reconcile and grant existing Business seller entitlements through a single Gold Premium entitlement. Do not require a separately purchased seller subscription.
- Priority support only if staffed and operationally defined.
- Gold Premium is not permission to create multiple owned stores or bypass seller verification, financial risk checks, moderation or payment controls.

### Black Government

- Black badge only for approved government institutions and authorized accounts.
- Manual vetting and two distinct authorized staff approvals remain mandatory.
- Proposed paid subscription is separate from institution/representative approval. Do not expose self-serve purchase.
- Preserve 20% of normal ad load unless the founder explicitly changes the policy.
- Web-only checkout. Annual billing remains disabled until separately approved.
- No admin, financial, moderation or policy-exemption privileges.

## Billing and lifecycle invariants

1. The server selects the active immutable price quote. A client never supplies authoritative amount, currency, fee, discount, tax, or renewal total.
2. Every quote binds plan, target profile, owning account, country/region, currency, platform/storefront, billing interval, price-version, discounts, tax treatment, final amount and expiry.
3. Checkout revalidates quote freshness, account/profile ownership, current eligibility, active price, promotion limits and platform purchase requirements.
4. Store receipts and provider webhooks are cryptographically/provider-verified and idempotent. Entitlement activation requires confirmed payment, except approved legacy/grandfathered records.
5. Keep subscription periods, renewal identifiers, transaction/payment history, purchase tokens, refunds/chargebacks and prior price versions immutable. A future price affects new cohorts only unless a compliant platform-specific repricing flow receives required notice/consent.
6. Grace/past-due/cancel-at-period-end semantics must follow the existing lifecycle, provider events and customer disclosures. Security-critical capabilities never depend on billing status.
7. Expiration blocks new scheduling and rescheduling, but already accepted posts remain queued and may publish after expiry, subject to moderation and account safety. Do not delete accepted work solely for nonrenewal.

## Discounts and bundles

- Annual discount default: configurable 20%; apply once to the applicable plan subtotal using integer minor units and documented rounding.
- Promotion engine supports percent/fixed offers, campaign windows, country/tier/account eligibility, new-customer rules, usage limits, admin override, redemption audit and single-use claims.
- Do not stack discounts unless a campaign explicitly authorizes a stacking policy; the default is one best eligible promotion plus the configured annual reduction only if the promotion allows it.
- Blue + Gold bundle proposal: 10% is not active. Interpretation A: reduce the combined eligible subtotal by 10%. Interpretation B: calculate a discount amount equal to 10% of only the higher-priced plan, then apply it to the combined subtotal. Founder confirmation is required.
- Quotes reserve/redemption-limit atomically; concurrent claims cannot exceed limits. Bundle line items explicitly bind one personal profile and the business/store profile(s) covered.
- Customer receipt and checkout show list price, each discount, applicable tax, platform-specific final amount, renewal amount/date, and cancellation terms.

## Legacy compatibility and verification

Legacy codes (`blue_essential`, `blue`, `premium`, `gold_only`, `seller_pro`, `seller_business`, `gold_combined`, `black`) remain readable during a compatibility period. Map behavior in code without rewriting old transaction/subscription history. Paid-through entitlements remain continuous. Move Blue Essential’s security/recovery benefits to Free before retiring its plan. Preserve seller operational benefits and only migrate a seller tier after comparing effective capabilities.

Do not apply persistence migrations or alter active price records until the migration is reversible, backed up, and tested on a production-like snapshot. Add new canonical plans as versioned identifiers, dual-read legacy codes, backfill with explicit audit rows, compare counts/entitlements, then switch new checkout/catalogue and retain legacy reads through the rollback window.

## Known implementation gaps to close

- Canonical new plan IDs and exact legacy mapping are not yet implemented.
- `plan_prices` remains the database authority for legacy rows, while admin edits now append immutable effective-dated snapshots in `plan_price_versions`; runtime quote resolution uses the latest version effective at the request time. The migration is prepared but unapplied. Seed defaults still initialize only missing rows. Full draft/approval state and price-impact reporting are not yet implemented.
- Current store fee settings are global: Apple 30%/15% toggle and Google 15%; they are not country-, tenure-, eligibility-, effective-date-, billing-fee-, tax- or storefront-aware.
- Seller operational entitlement resolution is separate and currently tied to old subscription codes. Catalogue cap values conflict with resolver caps.
- Scheduled post creation and rescheduling now check paid entitlement on the exact verified posting profile, and fail closed if the internal billing check is unavailable. Owner listings now use bounded cursor pagination; edit-content/media, backoff/lease recovery and timezone preference still need work. Focused code tests pass; deployment/device verification has not been performed.
- Admin price table supports scheduled effective dates, required reasons, next-effective display, and a bounded recent-history view. The immutable-history migration still requires a safe database migration rollout. Full price approval/version workflow beyond the append-only record, campaign tooling and government invitation/checkout workflows remain incomplete.
- Existing Black applications use an official checklist and two distinct approvers; secure email OTP, authority verification, invitation token, payment and renewal states are not yet verified end-to-end.

## Release gates

- **Resolved 2026-11-16:** Black Government is USD 300/month for Nigeria and USD 500/month internationally. Authorized monetization administrators may change future regional prices through audited effective-dated versions; existing subscriber terms and price history are not rewritten.
- Confirm bundle discount meaning and stacking with annual reduction.
- Confirm ad-load interpretation, priority-support SLA, and Gold Premium seller entitlement reconciliation.
- Approve Black annual eligibility (default off) and confirm Flutterwave USD recurring capability with account-specific evidence.
- Verify store rates and supported price points in Nantty’s actual developer accounts and storefronts.
- Run migration rehearsal, legacy entitlement reconciliation, all-plan/currency/provider tests, concurrency tests, receipt/webhook tests, and rollback rehearsal.

