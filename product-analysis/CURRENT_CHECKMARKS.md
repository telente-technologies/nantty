# Current checkmarks (source-backed)

Audit date: 2026-10-29.

## Colors

The code recognizes exactly three checkmark colors: Blue, Gold and Black. The admin profile type defines `BLUE | GOLD | BLACK` in `apps/admin/src/types/platformUser.type.ts`; subscription plan definitions map profiles to `blue`, `gold` or `black` in `services/go/modules/subscriptions/src/constants/plans.constant.go`. Database color is stored as a string, so the database column itself may not enforce the three-value enum.

## Current plan taxonomy

| Current plan code | Display name | Color / eligibility | Commercial status |
|---|---|---|---|
| `blue_essential` | Blue Essential | Personal; no checkmark in plan definition | Self-serve; price exists |
| `blue` | Blue Verified | Blue, personal | Self-serve; price exists |
| `premium` | Blue Premium | Blue, personal | Self-serve; price exists |
| `gold_only` | Gold | Gold, business/brand | Self-serve; price exists |
| `seller_pro` | Gold Pro | Gold, business/brand; grants seller Pro | Self-serve; price exists |
| `seller_business` | Gold Business | Gold, business/brand; grants seller Business | Self-serve; price exists |
| `gold_combined` | Gold for all your businesses | Gold bundle attached to personal account | Self-serve bundle; uses bundle price selection logic |
| `black` | Black Official | Government profile only | Not self-serve; application/review |

Source: `services/go/modules/subscriptions/src/constants/plans.constant.go`, `loaders/planCatalogue.loader.go`, and pricing services. Admin keys alias into these codes; `GOLD_PREMIUM` currently aliases to `seller_business`, rather than an independent plan.

## Verification versus subscription

Commercial purchase is not a substitute for identity, business or government eligibility. Trust rules are seeded in `apps/admin/src/mocks/seed/configurationTrustRules.mock.ts`; Blue and Gold requirements include account age, identity/business evidence, audience/order history and a clean standing window. Creator Program eligibility is a different approval system. Black plan is explicitly non-purchasable in the server catalogue and government eligibility is separately reviewed.

## Notable issues

- Blue Essential is a paid plan but does not grant a Blue checkmark; its perks include account recovery/impersonation protection. Essential account recovery/security should be available to everyone, not tied to a paid badge.
- Blue currently has Essential, Verified and Premium, not the requested Basic/Premium pair.
- Gold is split into Gold-only, Gold Pro, Gold Business and Gold bundle; the latter also overlaps a distinct seller plan.
- Same color across a Basic/Premium tier is achievable, but labels, eligibility and grant/revoke state must use one canonical entitlement source.
- Database color being a string means application validation—not column typing—must prevent non-approved colors.
