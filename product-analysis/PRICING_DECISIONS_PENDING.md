# Pricing decisions pending

As of 2026-10-29. These are the remaining commercial decisions that must be resolved before the related price or checkout can be activated. Gold Premium Nigeria pricing has been confirmed at NGN 30,000/month; its new-install source default is updated, but no live price database was queried and existing database rows are unchanged.

## Founder confirmation required

| Decision | Latest working assumption | Earlier conflicting instruction | Safe default until confirmed |
|---|---|---|---|
| Gold Premium Nigeria web monthly | NGN 30,000 | NGN 17,000 (superseded) | Confirmed; default updated, existing database rows await effective-dated admin approval |
| Black Government monthly | USD 300, web only | USD 500 | Keep both as unpublished proposals; Black remains non-self-serve |
| Blue + Gold combo discount | 10% proposed | “10% of the most” may mean discount only the larger plan | No combo discount active; do not create/redemptions until interpretation is selected |
| Bundle + annual discount stacking | No stacking is safest | Not explicitly stated | Apply no combo until both discount amount and stacking rules approved |
| Black annual billing | Disabled | No approval | Keep disabled until separate explicit approval |

### Bundle interpretations

- **A — percentage off combined subtotal:** eligible Blue + Gold plan subtotal × 10% discount.
- **B — discount amount indexed to the higher plan:** calculate a 10% discount amount from only the higher-priced plan, then decide whether to subtract that amount from the combined subtotal. This must be defined precisely if intended.

Do not infer which interpretation the founder intended from “10% of the most.”

## Operational confirmation required before platform prices can be calculated

1. Verify Apple/Google fee program enrollment and actual storefront-supported points for Nantty’s developer accounts. Do not presume Apple Small Business Program approval.
2. Confirm which country-specific Google fee schedule, install cohort, billing fee and effective date apply to Nantty’s subscriptions. Do not use one global Play fee.
3. Confirm Flutterwave merchant-level USD recurring-card eligibility, supported card countries, settlement and billing currency, tokenization/recurring authorization, renewals, retries and refunds before Black checkout.
4. Approve country-level tax inclusion/exclusion behavior with finance/legal/tax support and preserve the price’s tax basis.
5. Confirm whether Black remains at 20% of normal ads and verify Blue Basic 60% / Gold Basic 50% mean the shown fraction of normal platform-controlled inventory.

## Confirmed enough to implement as non-published configuration/design

- Canonical colors: Blue, Gold, Black only.
- Commercial tiers: Blue Basic/Premium and Gold Basic/Premium; verification approval is separate from subscription payment.
- Nigeria working monthly web prices: Blue Basic NGN 2,500; Blue Premium NGN 20,000; Gold Basic NGN 5,000; Gold Premium NGN 30,000 (confirmed). Except for the Gold Premium source default, remaining canonical price changes still need an effective-dated admin approval before public launch.
- Annual discount default remains configurable at 20%.
- Benchmark multiplier defaults to 0.75; 0.70 is an allowed alternate version. Benchmark outputs are suggestions requiring admin approval. Nigeria explicit founder prices are not replaced by benchmark suggestions.
- Preserve supported currencies NGN, GHS, KES, ZAR, GBP, EUR and USD; allow future currencies without assuming two minor-unit decimals.
- Paid scheduling for the four Blue/Gold tiers: unlimited accepted queue, maximum 90-day horizon; preserve previously accepted posts after expiry.

## Release rule

Until an item is confirmed, represent it only as a non-active draft/suggestion. Do not make it a default in code, seed data, database migration, admin active schedule, storefront SKU, checkout quote, mobile mock, marketing page or customer support script. Preserve prior active subscriber prices and historical records regardless of the decision.

