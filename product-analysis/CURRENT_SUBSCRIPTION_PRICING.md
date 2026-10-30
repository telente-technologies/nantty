# Current subscription pricing (repository defaults, not live DB)

Audit date: 2026-10-29. Amounts below are source-backed regional defaults. `plan_prices` is persisted and can be edited by staff; app startup seeds defaults only when missing and does not overwrite existing monthly amounts. No connected production database was queried, so these are not represented as current active production prices. Following founder confirmation, the Nigeria `seller_business` default (Gold Premium candidate) is now ₦30,000/month; any already-existing database row remains as-is until an audited, effective-dated admin price change is approved. The legacy `black` row is an obsolete NGN source seed and must not be published: Black Government is manually approved, web-only, and has a USD 300/month working proposal pending confirmation against USD 500.

Codes: `blue_essential` = Blue Essential (legacy); `blue` = Blue Verified (legacy Blue Basic candidate); `premium` = Blue Premium; `gold_only` = Gold; `seller_pro` = Gold Pro (legacy Gold Basic candidate); `seller_business` = Gold Business (legacy Gold Premium candidate); `black` = Black Official (government). Web/app columns are monthly/yearly. Annual defaults are computed as 12 monthly charges less 20%, with currency-specific price-point rounding (`services/go/platform/regionpricing/regionPricing.plans.go`). The current source marks `blue_essential`, `blue`, `premium`, `seller_pro` and `seller_business` as in-app price-derivation eligible; `gold_only` and `black` are web-only in defaults. Store prices are computed estimates from configured fee settings, not proof of a published Apple/Google product or a working native checkout. “—” means no store price derivation is configured.

## NGN (Nigeria)

| Plan | Web month / year | iOS & Android month / year |
|---|---:|---:|
| Blue Essential | ₦1,000 / ₦9,600 | ₦1,200 / ₦12,000 |
| Blue Verified | ₦2,500 / ₦24,000 | ₦2,900 / ₦28,000 |
| Blue Premium | ₦20,000 / ₦192,000 | Derived by configured fees; checkout/store catalog is authoritative |
| Gold | ₦3,000 / ₦29,000 | — |
| Gold Pro | ₦5,000 / ₦48,000 | — |
| Gold Business | ₦30,000 / ₦288,000 | — |
| Black Official | ₦50,000 / ₦480,000 | — |

## GHS (Ghana)

| Plan | Web month / year | App month / year |
|---|---:|---:|
| Blue Essential | GH₵12 / GH₵116 | GH₵15 / GH₵144 |
| Blue Verified | GH₵30 / GH₵288 | GH₵35 / GH₵336 |
| Blue Premium | GH₵55 / GH₵528 | GH₵65 / GH₵624 |
| Gold | GH₵36 / GH₵346 | — |
| Gold Pro | GH₵60 / GH₵576 | — |
| Gold Business | GH₵180 / GH₵1,728 | — |
| Black Official | GH₵600 / GH₵5,760 | — |

## KES (Kenya)

| Plan | Web month / year | App month / year |
|---|---:|---:|
| Blue Essential | KSh 200 / 1,950 | KSh 250 / 2,400 |
| Blue Verified | KSh 500 / 4,800 | KSh 600 / 5,800 |
| Blue Premium | KSh 900 / 8,650 | KSh 1,100 / 10,600 |
| Gold | KSh 600 / 5,800 | — |
| Gold Pro | KSh 1,000 / 9,600 | — |
| Gold Business | KSh 3,000 / 28,800 | — |
| Black Official | KSh 10,000 / 96,000 | — |

## ZAR (South Africa)

| Plan | Web month / year | App month / year |
|---|---:|---:|
| Blue Essential | R29.99 / R287.99 | R34.99 / R335.99 |
| Blue Verified | R59.99 / R575.99 | R69.99 / R671.99 |
| Blue Premium | R109.99 / R1,055.99 | R129.99 / R1,247.99 |
| Gold | R89.99 / R863.99 | — |
| Gold Pro | R149.99 / R1,439.99 | — |
| Gold Business | R449.99 / R4,319.99 | — |
| Black Official | R1,499.99 / R14,399.99 | — |

## GBP (United Kingdom)

| Plan | Web month / year | App month / year |
|---|---:|---:|
| Blue Essential | £2.49 / £23.99 | £2.99 / £28.99 |
| Blue Verified | £5.99 / £57.99 | £6.99 / £67.99 |
| Blue Premium | £9.99 / £95.99 | £11.99 / £115.99 |
| Gold | £9 / £86.99 | — |
| Gold Pro | £15 / £144.99 | — |
| Gold Business | £45 / £432.99 | — |
| Black Official | £149 / £1,430.99 | — |

## EUR (Eurozone)

| Plan | Web month / year | App month / year |
|---|---:|---:|
| Blue Essential | €2.49 / €23.99 | €2.99 / €28.99 |
| Blue Verified | €5.99 / €57.99 | €6.99 / €67.99 |
| Blue Premium | €10.99 / €105.99 | €12.99 / €124.99 |
| Gold | €10 / €96.99 | — |
| Gold Pro | €17 / €163.99 | — |
| Gold Business | €49 / €470.99 | — |
| Black Official | €169 / €1,622.99 | — |

## USD (United States)

| Plan | Web month / year | App month / year |
|---|---:|---:|
| Blue Essential | $2.49 / $23.99 | $2.99 / $28.99 |
| Blue Verified | $5.99 / $57.99 | $6.99 / $67.99 |
| Blue Premium | $9.99 / $95.99 | $11.99 / $115.99 |
| Gold | $10 / $96.99 | — |
| Gold Pro | $17 / $163.99 | — |
| Gold Business | $49 / $470.99 | — |
| Black Official | $169 / $1,622.99 | — |

## Other recurring products (not platform checkmark plans)

- Creator fan subscriptions are creator-defined monthly/yearly plans constrained by regional bands in `services/go/platform/regionpricing/regionPricing.catalogue.go` and `services/go/modules/subscriptions/src/models/creatorSubscription.model.go`. Nigeria default monthly band endpoints: web ₦500–₦5,000; app ₦600–₦5,900. Annual allowed range is 10 to 12 monthly prices. These are not the creator's own verification subscription and should not be conflated with Blue/Gold pricing.
- Seller-plan rows above (Gold Pro/Business) are currently coupled to operational seller entitlements. The separate seller-plan help page contains a conflicting plan/cap table; see `CURRENT_FEATURE_ENTITLEMENTS.md`.

## Mock-only contradictory amounts

`apps/admin/src/mocks/seed/peopleVerifications.mock.ts` has hard-coded approximate fee amounts that differ materially from the backend plan-price defaults (for NGN it uses 2,500 / 5,000 / 12,000 for Blue tiers and 45,000 / 120,000 for Gold Pro/Business). `apps/mobile/src/mocks/verification.mock.ts` uses USD mock price points and different perks. These are mocks, not authoritative production price records, but can mislead demo/admin screens and should be reconciled.
