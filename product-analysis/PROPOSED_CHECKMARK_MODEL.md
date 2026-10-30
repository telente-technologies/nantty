# Proposed official checkmark model

This is a recommendation, not an implementation or approved price decision.

## Exactly three color families

| Color | Audience | Tiering | Verification rule |
|---|---|---|---|
| Blue | Eligible individual accounts, including creators | Blue Basic and Blue Premium; identical blue badge | Identity/authenticity and policy eligibility are reviewed independently of payment. Premium adds capability, not stronger truth claims. |
| Gold | Verified businesses and stores | Gold Basic and Gold Premium; identical gold badge | Legal/business identity and control of the represented business/store required. |
| Black | Verified government accounts/institutions | One noncommercial official status; no paid Basic/Premium | Application, authorized-representative proof and manual review; never a checkout product. |

No other color should be introduced. A paid plan cannot override fraud, moderation, financial, or identity safeguards.

## Recommended migration from current taxonomy

- Consolidate `blue_essential`, `blue`, and `premium` into `blue_basic` and `blue_premium`. Move recovery, impersonation reporting/protection and other core account-safety capabilities to all accounts. Do not carry over “Essential” as a paid security layer.
- Map current `blue` (Blue Verified) to Blue Basic only after confirming its specific perks. Keep Premium features as Premium where they are real and enforceable.
- Consolidate `gold_only`, `seller_pro`, and `seller_business` commercial badge rows into Gold Basic / Gold Premium. Keep operational seller plan (Free/Pro/Business) as a separate billing/entitlement axis unless a deliberate bundle is approved.
- Treat `gold_combined` as a billing bundle/discount mechanic, not a fourth checkmark class or separate verification level.
- Keep Black review and official verification outside commercial subscriptions; remove its price from general checkout and expose a noncommercial application workflow.

## Separation of concepts

Store one verification status (pending/verified/revoked) and one badge color; store plan tier/entitlements separately. Badge eligibility is reviewed by Trust. Subscription grants the paid feature set while active, but does not manufacture verification or protect from revocation for fraud/changed identity. Profile type and owning account must be checked server-side.

## Deactivation policy recommendation

On commercial subscription expiration, remove paid entitlements after an explicit grace policy, but do not silently erase content or cancel already scheduled content. A verification mark should follow the published trust policy and any renewal grace period, not be left indefinitely merely because the subscription cache is stale. Black government status should be revalidated under the official policy, never expire for nonpayment.
