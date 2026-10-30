# Gold Basic vs Gold Premium

> **Updated 2026-10-29:** Earlier queue limits and seller-plan separation recommendations are superseded by [FINAL_SUBSCRIPTION_SPEC.md](FINAL_SUBSCRIPTION_SPEC.md). Gold Basic and Gold Premium both include unlimited accepted scheduled posts up to 90 days ahead. Gold Premium includes the existing Business seller workspace capabilities in one subscription; preserve Free seller access. Working Nigeria web prices are ₦5,000/month and ₦30,000/month respectively; the founder confirmed Gold Premium at ₦30,000. Existing active database price rows are not repriced by this source-default change.

Proposal for verified business/store subscriptions. The Gold badge is identical on both tiers and requires business verification. Latest founder direction integrates Gold Premium's advanced seller workspace capabilities into one Gold Premium subscription; do not require a second seller subscription. Preserve the Free seller plan and its operational limits.

| Benefit | Free Business/Store | Gold Basic (proposed) | Gold Premium (proposed) |
|---|---|---|---|
| Core store, catalog, order and seller tools | Current Free seller plan | Same, plus verified Gold badge/product label | Same; higher limits through explicit seller plan entitlement |
| Badge | None | Gold after business and control verification | Same Gold after same verification |
| Ads | Standard | Reduced | Ad-free recommendation, while defining “ad-free” precisely |
| Scheduling | Not included | Paid entitlement; unlimited accepted queue; up to 90 days | Paid entitlement; unlimited accepted queue; up to 90 days |
| Basic metrics | Current Free seller 30-day history | Basic store reports | Advanced sales/audience reports, exports and longer history |
| Staff/location/product caps | Current resolver: 100 products, 1 location, 0 staff | Keep Free caps | Include current Business seller resolver entitlements: unlimited active products, up to 10 locations, 25 staff, 730 days analytics; reconcile other Business gates and conflicting catalogue copy |
| Automation/API | Core workflows | No public API claim | Higher automation only after API/webhooks actually ship and are secured |
| Fees | Use approved public fee schedule | No fee discount implied | Do not include lower escrow/transaction fee until policy and ledger configuration are reconciled |
| Dedicated support | Standard support | Standard | Optional priority response, not preferential safety/payment decisions |

The code currently couples `seller_pro`/`seller_business` checkmark plans to seller-plan entitlement. The target policy integrates Gold Premium and its existing Business workspace entitlements without requiring a second seller subscription. New canonical entitlements should be separated in implementation while preserving one Gold Premium purchase. Current resolver limits in `services/go/platform/sellerplans/sellerPlans.resolver.go` are authoritative source evidence; old catalogue limits must not override them silently.
