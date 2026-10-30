# Current feature entitlements

Audit date: 2026-10-29. Distinguish platform verification subscriptions from seller commerce plans and creator-program approval.

## Blue / Gold / Black source catalogue

| Plan | Configured benefits | Enforcement / access evidence | Caveat |
|---|---|---|---|
| Free individual | Core social account; no paid checkmark | Baseline account routes | Essential safety/recovery must not be paywalled. |
| Blue Essential | Priority recovery, impersonation protection, edit posts within 1h, 25% fewer ads | Plan catalogue and ad-load config; server subscription record exists | No Blue mark; does not fit requested two commercial Blue levels. |
| Blue Verified | Blue mark, comment ranking, clips up to 10m, 40% fewer ads | Subscription/checkmark modules; ad-load config | Verification is not just a purchase; separate eligibility remains. |
| Blue Premium | Verified benefits, ad-free, monthly boost credit, priority support, up to 5 business profiles, Gold bundle discount | Premium status is checked by linked-profile limit service; ad-load config | Every advertised perk needs a corresponding server entitlement/fulfillment check; catalogue copy is not proof. |
| Gold | Gold business badge, verified product label, 50% fewer ads | Gold plan code and ad-load mapping | Free seller dashboard may already provide many basic store tools. |
| Gold Pro | Gold + dashboard, verified product label, 50% fewer ads; catalogue dashboard caps 3 staff, 1 location, 2,000 catalog import | Seller plan resolver independently enforces Pro caps (5 staff seats, 3 locations, 2,000 active products) | Caps differ across catalogue and actual seller resolver. |
| Gold Business | Gold Pro, account manager, lower escrow fee, no ads; catalogue says 15 seats/10 locations/20k import | Seller resolver Business limits 25 seats, 10 locations, unlimited active products | Help docs say 15 seats; fee benefit is inconsistent with advertised policy and configurable fee. |
| Black Official | Government/institution badge, 20% normal ad load | Non-self-serve; government profile / review path; ad-load=20 | Do not sell. Need validate government account and authorized representative. |

## Seller operational plans (a different entitlement system)

`services/go/platform/sellerplans/sellerPlans.resolver.go` currently enforces:

| Capability | Free | Pro | Business |
|---|---:|---:|---:|
| Active products | 100 | 2,000 | Unlimited (0 sentinel) |
| Locations | 1 | 3 | 10 |
| Staff seats | 0 | 5 | 25 |
| Analytics history | 30 days | 365 days | 730 days |
| Feature-gated | Shipping rules | Advanced inventory, bulk tools, advanced analytics/reports, customer segments, team, promotions, ads tools, warehouses, alerts, API/webhooks | Multiple stores, advanced permissions, accounting integrations |

Resolver cache is up to 1 minute for paid plans; failed resolution returns Free. Production requires an entitlement URL; missing URL in development enables `AllowAll`. That development behavior must not be confused with production enforcement.

## Other entitlement boundaries

- Creator Program approval is distinct from any Blue subscription; program grants creator tools and eligibility for live/gifts/affiliate/revenue features.
- Ads budget/campaign charges are separate from a plan’s ad-load reduction or ad credits.
- Linked business-profile cap is currently Free/non-Premium 2 linked profiles vs Premium 5, while a separate one-owned-store rule remains. Confirm exact included profile counting before product copy.
- Creator fan memberships are a creator-set price and membership entitlement, not a platform checkmark tier.
- New post scheduling and rescheduling are server-gated to active paid Blue/Gold entitlements, with an unlimited queue and 90-day horizon. Cancellation and publish-now remain available for existing accepted schedules after expiry. Full lifecycle behavior still needs runtime/end-to-end verification; see `POST_SCHEDULING_ARCHITECTURE.md`.

## Claims requiring reconciliation

1. Gold Pro/Business dashboard caps differ among `planCatalogue.loader.go`, `sellerPlans.resolver.go`, and Support help content.
2. Legacy Gold Business catalogue copy says “lower escrow fee,” but the approved launch policy has no sales commission. Fresh-install revenue settings now default escrow deductions to 0 bps; persisted settings may still carry the superseded 150/100-bps values until explicitly updated.
3. Support pages claim some API/webhook access while a working external developer API could not be found.
4. Blue Premium/Gold Business ad-free claim must align to all placements, sponsorships and other monetized content; ad-load 0 only establishes configured ad inventory suppression, not all sponsored content.
