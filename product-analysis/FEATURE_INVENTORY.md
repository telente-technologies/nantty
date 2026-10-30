# Nantty feature inventory

Audit date: 2026-10-29. This is a repository-source audit, not a live production/database inspection. “Implemented” means relevant code paths exist; end-to-end status is not asserted unless explicitly marked. Mocks and help content are not proof of runtime behavior.

## Platform map

| Feature area | Purpose / availability | Status and enforcement | Source anchors |
|---|---|---|---|
| Accounts, authentication, identity | Registration, login, recovery, profiles, privacy and verification journeys; all account types | Implemented, multiple auth paths; sensitive operations are server-owned. Recovery/security remains a free capability. | `services/go/modules/auth`, `users`, `admin`; `services/typescript/gateway`; `apps/mobile/src/screens/auth`; `apps/webapp/src/app/(auth)`; `apps/webapp/src/app/(app)/settings` |
| Social profiles and follow graph | Personal, business, brand, government profiles; public/private follows and requests | Implemented, with privacy paths and profile types. Individual entitlements vary by subscription. | `services/go/modules/users`; `apps/webapp/src/app/(app)/[username]`; `apps/mobile/src/screens/profile`; `apps/admin/src/types/platformUser.type.ts` |
| Feed, posts, comments, reactions, reposts, quotes | Publish and consume social content | Implemented; post API/ownership and visibility checks are server-side. Scheduled publishing exists separately (see scheduling report). | `services/typescript/social/src/modules/posts`; social comments/reactions modules; `apps/webapp/src/components/feed`; `apps/mobile/src/components/feed`, `screens/posts` |
| Stories, clips, discovery | Short-lived and vertical video content, suggestions and discovery | Implemented/partially implemented across web/mobile; actual media processing is in media service. | `services/typescript/media`; social post modules; `apps/webapp/src/app/(app)/clips`; `apps/mobile/src/services/clips`, `screens/clips` |
| Messaging, notifications, realtime | Direct and group communication, delivery and presence/events | Implemented across gateway, notifications and Elixir realtime; end-to-end security needs runtime testing. | `services/typescript/gateway`; `services/typescript/notifications`; `services/elixir/realtime`; `apps/webapp/src/app/(app)/chats`; `apps/mobile/src/screens/messages` |
| Creator program and tools | Creator approval, creator studio, affiliate earning, fan subscriptions, ad revenue share, gifts/live eligibility | Partially implemented as a separately approved program; a paid Blue plan does not itself qualify a user. | `services/go/modules/creators`; `services/go/modules/ads`; `services/go/modules/live`; `services/go/modules/subscriptions/src/modules/creatorSubscriptions`; `apps/studio/src/app/(studio)` |
| Live video | Real-time creator broadcast and viewers | Implemented but provider/configuration dependent; host access is Creator Program-gated by default. | `services/go/modules/live/src/services/createLiveSession.service.go`; `apps/webapp/src/app/(app)/live`; mobile live screens; media/realtime services |
| Spaces (audio) | Scheduled/live audio sessions attached to social posts | Partially implemented; verify backend persistence and gateway integration independently. Product decisions in prior requests: creator hosts, everyone can listen; no leaderboard. | `services/go/modules/live`/Spaces modules; `services/typescript/gateway`; `services/elixir/realtime`; `apps/webapp/src/app/(app)/spaces`; `apps/mobile/src/screens/spaces` |
| Marketplace, stores and catalog | Seller storefronts, products/services, inventory, orders, reviews and fulfillment | Implemented across domain modules; Free/Pro/Business seller plans enforced in backend for mapped features and limits. | `services/go/modules/catalog`, `inventory`, `orders`; `services/go/platform/sellerplans/sellerPlans.resolver.go`; `apps/webapp/src/app/(app)/mart`; `apps/seller/src/app/(workspace)` |
| Cart, checkout, payment, escrow, wallet | Buyer payment, escrow, seller settlement, wallet and withdrawals | Implemented in separate services, financial critical paths exist; this audit did not execute live transaction tests. Seller fee configuration conflicts with previously stated no-commission product policy. | `services/go/modules/payments`, `escrow`, `ledger`, `wallet`; `apps/webapp/src/app/(app)/cart`, `checkout`, `wallet`; `apps/seller/src/app/(workspace)/wallet` |
| Ads and promotion | Self-serve campaigns, promotion/boost, targeting, billing and reporting | Partially/mostly implemented; ad spend is separate from subscription. Account ad-load reduction is tier-configured. | `services/go/modules/ads`; `apps/ads/src/app`; `apps/webapp/src/app/(app)/ads`; `apps/seller/src/app/(workspace)/ads` |
| Analytics and reporting | User/creator/seller/campaign performance | Partially implemented; seller history/feature gates exist. Scope varies by plan, but dashboard copy and enforced seller plan caps disagree. | `services/go/modules/analytics`; `services/go/platform/sellerplans`; `apps/studio/src/app/(studio)/analytics`; `apps/seller/src/app/(workspace)/analytics`, `reports` |
| Checkmarks / trust verification | Blue individual, Gold business/brand, Black government marks | Implemented with applications, eligibility and separate staff review; plan taxonomy is more complex than requested 3-color/2-tier model. | `services/go/modules/subscriptions/src/constants/plans.constant.go`; `services/go/modules/subscriptions/src/loaders/planCatalogue.loader.go`; `services/go/modules/admin`; `apps/admin/src/mocks/seed/configurationTrustRules.mock.ts`; support content under `services/typescript/support/content/help/checkmarks-and-verification` |
| Platform subscriptions / billing | Commercial checkmark plans, bundles, billing lifecycle and store receipts | Implemented, source-backed defaults plus database-managed prices; active runtime prices not inspected. | `services/go/modules/subscriptions/src/modules/billing`; `services/go/modules/subscriptions/src/modules/verification`; `services/go/modules/subscriptions/src/modules/creatorSubscriptions`; pricing routes in billing routes |
| Developer API | External integration/API credentials | Planned or unverified. Seller entitlements/help mention `api_webhooks`, but no public developer key portal/API routes were located in this audit. | `services/go/platform/sellerplans/sellerPlans.resolver.go` (`api_webhooks` gate); no dedicated public developer-API module located |
| Admin and trust operations | Account, plans/prices, verification, moderation, support and platform configuration | Implemented in UI/services; admin plan seed and backend catalogue need reconciliation with actual plan enforcement. | `apps/admin/src`; `services/go/modules/admin`; `services/typescript/support` |
| Infrastructure and delivery | Build/deploy, AWS infrastructure and platform dependencies | Implemented as IaC/workflows; deployment readiness/security are outside this product entitlement audit. | `infra/aws`; `.github/workflows`; root workspace manifests |

## Account types

The source model includes personal, business, brand and government profiles (`services/go/modules/subscriptions/src/constants/plans.constant.go`). Creator is an approval/program status rather than a subscription profile type. Seller plans (Free/Pro/Business) are operational commerce tiers and are distinct from Gold checkmark billing, though current code couples Gold plan codes to seller plan grants.

## Representative API route families

These are verified route examples, not a claim that this table exhausts every endpoint:

| Domain | Representative routes / route modules |
|---|---|
| Posts, stories, analytics | `POST /api/v1/posts`, `GET /api/v1/posts/:postId`, like/repost/share routes, `POST /api/v1/stories`, story tray/seen/viewers and post analytics in `services/typescript/social/src/modules/posts/routes/posts.routes.ts` |
| Follow graph | `/api/v1/users/:userId/follow`, followers/following/status and `/api/v1/users/me/follow-requests` in `services/typescript/social/src/modules/follows/routes/follows.routes.ts` |
| Messaging | `/api/v1/conversations` list/start, group/member/admin and message routes in social conversations modules; store conversations in `storeInbox` |
| Billing and checkmarks | `/api/v1/pricing/plans`, `/api/v1/subscriptions/plans`, `/api/v1/subscriptions/checkout`, `/api/v1/subscriptions/me`, `/api/v1/verification/plans`, `/api/v1/verification/discounts`, `/api/v1/internal/entitlements/{userId}`, admin price-table routes in `services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go` |
| Creator memberships | `/api/v1/creators/{creatorId}/subscription-plans` and routes in `services/go/modules/subscriptions/src/modules/creatorSubscriptions/routes/creatorSubscriptions.routes.go` |
| Coins and payments | `/api/v1/coins/packages`; provider/store webhook route families in wallet/payments modules |
| Consent and policy | `/api/v1/policies/current`, `/api/v1/consents` and `/api/v1/legal/policy-versions/current` in users modules |
| Ads | Click redirect `/api/v1/ads/r/{token}` and campaign/tracking routes in `services/go/modules/ads` |
| Live | Live session/studio and LiveKit webhook routes in `services/go/modules/live`; Space integration uses live/gateway/realtime modules |

Feature-specific seller/catalog/orders endpoints are mounted in their respective Go module route packages. Their existence and business invariants should be confirmed in dedicated runtime test coverage; this audit is about feature and entitlement inventory rather than endpoint penetration testing.

## Enforcement caveat

Specific seller plan gates/limits are server-side in `services/go/platform/sellerplans/sellerPlans.resolver.go`. Checkmark billing/eligibility is server-backed in the subscriptions/verification modules. Frontend visibility alone is not taken as enforcement evidence. Full runtime end-to-end validation was not performed for this documentation task.
