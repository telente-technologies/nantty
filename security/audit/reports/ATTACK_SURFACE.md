# Attack surface inventory (Phase 2)

Generated 4 Oct 2026 by `python3 security/authorization/routeInventory.py` (static, read-only) and reviewed by hand. Regenerate after route changes; the table below is the script output.

## Entry points

| Surface | Count / location | Auth model |
|---|---|---|
| Public HTTP gateway | `services/typescript/gateway`, 156 route prefixes in `src/routes/upstream.routes.ts` | JWT (EdDSA, JWKS) verified at the gateway; identity forwarded as `x-zudomart-account-id`; Go backends re-verify the bearer token (`jwtauth`); TS services (social, media, search, support, notifications) trust the gateway-set `x-zudomart-account-id` header without a signature (SEC-0010) |
| Go services (ServeMux) | 6 deployables, ~690 routes | `jwtauth.RequireVerifiedAccessToken`, `staffauth.Guard.RequireStaff(permission, stepUp)`, `RequireInternalToken` (constant-time) |
| TS services | social, media, search, notifications, support | route factory `authentication: required/optional/internal` keyed off the gateway header; staff routes verify a staff JWT with `perm:` roles |
| Python intelligence | 29 routes on 127.0.0.1:8090 | HMAC request signature (`request_signature_util.py:84`, `compare_digest`); never routed by the gateway |
| Phoenix realtime | one WebSocket (`realtimeWeb/clientSocket.socket.ex`) | access token on connect; `topic.authorizer.ex` allows `user:<self>`, conversation members, live access check; max subscriptions per socket |
| Webhooks | `/webhooks/{provider}` (Paystack), `/webhooks/store-notifications/{apple,google}`, `/api/v1/webhooks/smile-id`, `/api/v1/live/webhooks/livekit` | provider signatures; gateway passes raw bytes and signature headers only on these routes |
| Health | `/healthz`, `/readyz` (TS), `/health/live|ready` (Python), gateway `/healthz` | unauthenticated, not routed except the gateway's own |
| Staff/admin APIs | every `/api/v1/admin/*` | gateway `optional` (staff tokens use a different audience); backend staff guard on every route, step-up on destructive actions |

## Diff against the gateway

| Class | Result |
|---|---|
| Internal routes (`/internal/` segment) | 79 backend routes; all hidden by `internalRouteGuard.service.ts` (decodes `%2e`, double encoding, `\`, `;`) |
| Admin paths without a staff guard | 0 after resolving wrapper variables (every `/api/v1/admin/*` handler is wrapped) |
| Unrouted | `/.well-known/jwks.json` (identity; the gateway verifies tokens against identity directly, fine), and the 29 Python routes (by design) |
| Upstream mismatch | `/api/v1/admin/legal/notices*` and `notice-draft/preview/test-send` exist in both go-identity and ts-notifications; the gateway sends them to notifications, so the identity copies are dead code (SEC-0016). `POST /api/v1/reports` is content-routed to trust for chat reports (intended) |
| Optional-auth mutations with no route guard | only `/api/v1/auth/*` (login, register, OTP, refresh, social sign-in, password reset), `PUT /api/v1/consents`, `POST /api/v1/ads/pricing/estimate`: all intentionally anonymous and rate limited |
| Redirect responses through the gateway | the proxy drops `Location` (`upstreamProxy.service.ts:23`), so `GET /api/v1/ads/r/{token}` cannot redirect and also needs a bearer token at the gateway (SEC-0017, functional) |
| Duplicate webhook paths | `/api/v1/payments/webhooks/{provider}` and `/api/v1/payments/store-notifications/{store}` are behind `authentication: required` at the gateway, so providers can only use `/webhooks/*` (fine) |

## Inconsistent auth worth an active test

- Copyright decisions (`copyrightClaims.routes.go:25-30`) need `copyright:review` but no step-up, while verification approve/reject, security-case decide and IP-claim uphold require step-up (SEC-0009).
- Realtime conversation membership is checked at subscribe time only; removal from a group does not drop a live subscription (SEC-0018).

## Summary

| Verdict | Routes |
|---|---|
| routed | 726 |
| hidden | 79 |
| UNROUTED | 29 |
| OPTIONAL-AUTH MUTATION, NO ROUTE GUARD | 10 |
| ops endpoint | 10 |
| UPSTREAM MISMATCH | 8 |

Total backend routes: 862; gateway route entries: 156

## Full inventory

| Method | Path | Service | Route auth | Gateway | Source |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/ad-policies` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adReview/routes/adReview.routes.go:24 |
| POST | `/api/v1/admin/ad-policies` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adReview/routes/adReview.routes.go:25 |
| PUT | `/api/v1/admin/ad-policies/{policyId}` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adReview/routes/adReview.routes.go:26 |
| GET | `/api/v1/admin/ads` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adReview/routes/adReview.routes.go:16 |
| GET | `/api/v1/admin/ads-policies` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adPolicies/routes/adPolicies.routes.go:15 |
| PUT | `/api/v1/admin/ads-policies/frequency/{format}` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adPolicies/routes/adPolicies.routes.go:16 |
| GET | `/api/v1/admin/ads/{adId}` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adReview/routes/adReview.routes.go:17 |
| POST | `/api/v1/admin/ads/{adId}/appeal/resolve` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adReview/routes/adReview.routes.go:20 |
| POST | `/api/v1/admin/ads/{adId}/approve` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adReview/routes/adReview.routes.go:18 |
| POST | `/api/v1/admin/ads/{adId}/reject` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adReview/routes/adReview.routes.go:19 |
| GET | `/api/v1/admin/advertisers` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adReview/routes/adReview.routes.go:21 |
| POST | `/api/v1/admin/advertisers/{advertiserId}/reinstate` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adReview/routes/adReview.routes.go:23 |
| POST | `/api/v1/admin/advertisers/{advertiserId}/suspend` | ads | staff | routed (optional) | services/go/modules/ads/src/modules/adReview/routes/adReview.routes.go:22 |
| GET | `/api/v1/ads/accounts` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:16 |
| POST | `/api/v1/ads/accounts` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:17 |
| GET | `/api/v1/ads/accounts/{accountId}` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:19 |
| PATCH | `/api/v1/ads/accounts/{accountId}` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:20 |
| GET | `/api/v1/ads/accounts/{accountId}/activity` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:30 |
| GET | `/api/v1/ads/accounts/{accountId}/ads/{adId}/cards/report` | ads | user | routed (required) | services/go/modules/ads/src/modules/reporting/routes/reporting.routes.go:15 |
| GET | `/api/v1/ads/accounts/{accountId}/entitlements` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:21 |
| GET | `/api/v1/ads/accounts/{accountId}/invites` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:25 |
| POST | `/api/v1/ads/accounts/{accountId}/invites` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:26 |
| DELETE | `/api/v1/ads/accounts/{accountId}/invites/{inviteId}` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:27 |
| GET | `/api/v1/ads/accounts/{accountId}/members` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:22 |
| DELETE | `/api/v1/ads/accounts/{accountId}/members/{userId}` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:24 |
| PATCH | `/api/v1/ads/accounts/{accountId}/members/{userId}` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:23 |
| GET | `/api/v1/ads/accounts/{accountId}/reports` | ads | user | routed (required) | services/go/modules/ads/src/modules/reporting/routes/reporting.routes.go:14 |
| GET | `/api/v1/ads/accounts/{accountId}/reports/export` | ads | user | routed (required) | services/go/modules/ads/src/modules/reporting/routes/reporting.routes.go:16 |
| GET | `/api/v1/ads/accounts/{accountId}/reports/export.pdf` | ads | user | routed (required) | services/go/modules/ads/src/modules/reporting/routes/reporting.routes.go:17 |
| GET | `/api/v1/ads/accounts/{accountId}/reports/scheduled` | ads | user | routed (required) | services/go/modules/ads/src/modules/reporting/routes/reporting.routes.go:18 |
| POST | `/api/v1/ads/accounts/{accountId}/reports/scheduled` | ads | user | routed (required) | services/go/modules/ads/src/modules/reporting/routes/reporting.routes.go:19 |
| DELETE | `/api/v1/ads/accounts/{accountId}/reports/scheduled/{scheduledReportId}` | ads | user | routed (required) | services/go/modules/ads/src/modules/reporting/routes/reporting.routes.go:20 |
| POST | `/api/v1/ads/boosts` | ads | user | routed (required) | services/go/modules/ads/src/modules/boosts/routes/boosts.routes.go:16 |
| POST | `/api/v1/ads/boosts/estimate` | ads | user | routed (required) | services/go/modules/ads/src/modules/boosts/routes/boosts.routes.go:15 |
| GET | `/api/v1/ads/boosts/options` | ads | user | routed (required) | services/go/modules/ads/src/modules/boosts/routes/boosts.routes.go:14 |
| GET | `/api/v1/ads/boosts/{boostId}` | ads | user | routed (required) | services/go/modules/ads/src/modules/boosts/routes/boosts.routes.go:17 |
| GET | `/api/v1/ads/business-profiles` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:18 |
| POST | `/api/v1/ads/decide` | ads | user | routed (required) | services/go/modules/ads/src/modules/decision/routes/decision.routes.go:15 |
| POST | `/api/v1/ads/events` | ads | user | routed (required) | services/go/modules/ads/src/modules/tracking/routes/tracking.routes.go:13 |
| GET | `/api/v1/ads/invites/{inviteId}` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:28 |
| POST | `/api/v1/ads/invites/{inviteId}/accept` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:29 |
| GET | `/api/v1/ads/memberships` | ads | user | routed (required) | services/go/modules/ads/src/modules/adAccounts/routes/adAccounts.routes.go:15 |
| GET | `/api/v1/ads/pricing` | ads | none-in-route (controller may self-check) | routed (optional) | services/go/modules/ads/src/modules/billing/routes/billing.routes.go:19 |
| POST | `/api/v1/ads/pricing/estimate` | ads | none-in-route (controller may self-check) | OPTIONAL-AUTH MUTATION, NO ROUTE GUARD | services/go/modules/ads/src/modules/billing/routes/billing.routes.go:20 |
| GET | `/api/v1/ads/r/{token}` | ads | none-in-route (controller may self-check) | routed (required) | services/go/modules/ads/src/modules/tracking/routes/tracking.routes.go:14 |
| POST | `/internal/v1/ads/accounts/{accountId}/funds` | ads | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/ads/src/modules/billing/routes/billing.routes.go:21 |
| POST | `/internal/v1/ads/audiences/membership` | ads | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/ads/src/modules/audiences/routes/audiences.routes.go:21 |
| POST | `/internal/v1/ads/boosts/{boostId}/payment-confirmed` | ads | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/ads/src/modules/boosts/routes/boosts.routes.go:18 |
| PUT | `/internal/v1/ads/content-signals` | ads | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/ads/src/modules/decision/routes/decision.routes.go:17 |
| POST | `/internal/v1/ads/conversions` | ads | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/ads/src/modules/tracking/routes/tracking.routes.go:15 |
| POST | `/internal/v1/ads/decide` | ads | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/ads/src/modules/decision/routes/decision.routes.go:16 |
| POST | `/internal/v1/ads/media/{mediaId}/processed` | ads | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/ads/src/modules/creatives/routes/creatives.routes.go:19 |
| POST | `/internal/v1/ads/premium-pool/allocate` | ads | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/ads/src/modules/adPolicies/routes/adPolicies.routes.go:17 |
| POST | `/api/v1/analytics/product-interactions` | commerce | optional-user | routed (optional) | services/go/modules/catalog/src/modules/interactions/routes/interactions.routes.go:13 |
| GET | `/api/v1/brands` | commerce | none-in-route (controller may self-check) | routed (optional) | services/go/modules/catalog/src/modules/brands/routes/brands.routes.go:11 |
| DELETE | `/api/v1/cart` | commerce | user | routed (required) | services/go/modules/orders/src/modules/cart/routes/cart.routes.go:15 |
| GET | `/api/v1/cart` | commerce | user | routed (required) | services/go/modules/orders/src/modules/cart/routes/cart.routes.go:14 |
| POST | `/api/v1/cart/items` | commerce | user | routed (required) | services/go/modules/orders/src/modules/cart/routes/cart.routes.go:17 |
| DELETE | `/api/v1/cart/items/{itemId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/cart/routes/cart.routes.go:19 |
| PATCH | `/api/v1/cart/items/{itemId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/cart/routes/cart.routes.go:18 |
| POST | `/api/v1/cart/shipping-quote` | commerce | user | routed (required) | services/go/modules/orders/src/modules/cart/routes/cart.routes.go:16 |
| GET | `/api/v1/categories` | commerce | none-in-route (controller may self-check) | routed (optional) | services/go/modules/catalog/src/modules/categories/routes/categories.routes.go:15 |
| GET | `/api/v1/internal/audience-sources/stores/{storeId}/purchasers` | commerce | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/orders/src/modules/internalSources/routes/internalSources.routes.go:13 |
| GET | `/api/v1/internal/audience-sources/stores/{storeId}/visitors` | commerce | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/catalog/src/modules/internalSources/routes/internalSources.routes.go:16 |
| GET | `/api/v1/internal/moderation/targets/{type}/{id}` | commerce | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/catalog/src/modules/internalSources/routes/internalSources.routes.go:15 |
| GET | `/api/v1/internal/search-sources/{collection}/{id}` | commerce | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/catalog/src/modules/internalSources/routes/internalSources.routes.go:14 |
| GET | `/api/v1/internal/share-cards/{kind}/{id}` | commerce | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/catalog/src/modules/shareCards/routes/shareCards.routes.go:13 |
| GET | `/api/v1/mart/home` | commerce | optional-user | routed (optional) | services/go/modules/catalog/src/modules/products/routes/products.routes.go:15 |
| GET | `/api/v1/orders` | commerce | user | routed (required) | services/go/modules/orders/src/modules/orders/routes/orders.routes.go:16 |
| POST | `/api/v1/orders/checkout` | commerce | user | routed (required) | services/go/modules/orders/src/modules/orders/routes/orders.routes.go:15 |
| GET | `/api/v1/orders/{orderId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/orders/routes/orders.routes.go:17 |
| POST | `/api/v1/orders/{orderId}/cancel` | commerce | user | routed (required) | services/go/modules/orders/src/modules/orders/routes/orders.routes.go:18 |
| POST | `/api/v1/orders/{orderId}/confirm-receipt` | commerce | user | routed (required) | services/go/modules/orders/src/modules/orders/routes/orders.routes.go:19 |
| POST | `/api/v1/orders/{orderId}/returns` | commerce | user | routed (required) | services/go/modules/orders/src/modules/returns/routes/returns.routes.go:21 |
| GET | `/api/v1/products` | commerce | optional-user | routed (optional) | services/go/modules/catalog/src/modules/products/routes/products.routes.go:16 |
| GET | `/api/v1/products/featured` | commerce | optional-user | routed (optional) | services/go/modules/catalog/src/modules/products/routes/products.routes.go:17 |
| GET | `/api/v1/products/{productId}` | commerce | optional-user | routed (optional) | services/go/modules/catalog/src/modules/products/routes/products.routes.go:18 |
| DELETE | `/api/v1/products/{productId}/bookmark` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/products/routes/products.routes.go:23 |
| POST | `/api/v1/products/{productId}/bookmark` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/products/routes/products.routes.go:22 |
| DELETE | `/api/v1/products/{productId}/like` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/products/routes/products.routes.go:21 |
| POST | `/api/v1/products/{productId}/like` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/products/routes/products.routes.go:20 |
| GET | `/api/v1/products/{productId}/rating-summary` | commerce | none-in-route (controller may self-check) | routed (optional) | services/go/modules/catalog/src/modules/reviews/routes/reviews.routes.go:16 |
| GET | `/api/v1/products/{productId}/reviews` | commerce | none-in-route (controller may self-check) | routed (optional) | services/go/modules/catalog/src/modules/reviews/routes/reviews.routes.go:15 |
| POST | `/api/v1/products/{productId}/reviews` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/reviews/routes/reviews.routes.go:17 |
| GET | `/api/v1/returns` | commerce | user | routed (required) | services/go/modules/orders/src/modules/returns/routes/returns.routes.go:20 |
| GET | `/api/v1/seller/access` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/stores/routes/stores.routes.go:15 |
| GET | `/api/v1/seller/categories` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/categories/routes/categories.routes.go:16 |
| POST | `/api/v1/seller/categories` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/categories/routes/categories.routes.go:17 |
| DELETE | `/api/v1/seller/categories/{categoryId}` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/categories/routes/categories.routes.go:19 |
| PATCH | `/api/v1/seller/categories/{categoryId}` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/categories/routes/categories.routes.go:18 |
| GET | `/api/v1/seller/customers` | commerce | user | routed (required) | services/go/modules/orders/src/modules/customers/routes/customers.routes.go:15 |
| GET | `/api/v1/seller/customers/export` | commerce | user | routed (required) | services/go/modules/orders/src/modules/customers/routes/customers.routes.go:17 |
| GET | `/api/v1/seller/customers/summary` | commerce | user | routed (required) | services/go/modules/orders/src/modules/customers/routes/customers.routes.go:16 |
| GET | `/api/v1/seller/customers/{customerId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/customers/routes/customers.routes.go:18 |
| POST | `/api/v1/seller/customers/{customerId}/notes` | commerce | user | routed (required) | services/go/modules/orders/src/modules/customers/routes/customers.routes.go:20 |
| GET | `/api/v1/seller/customers/{customerId}/purchases` | commerce | user | routed (required) | services/go/modules/orders/src/modules/customers/routes/customers.routes.go:19 |
| GET | `/api/v1/seller/delivery/shipments` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:28 |
| PATCH | `/api/v1/seller/delivery/shipments/{orderId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:29 |
| POST | `/api/v1/seller/delivery/shipments/{orderId}/attempts` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:30 |
| GET | `/api/v1/seller/delivery/summary` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:27 |
| GET | `/api/v1/seller/disputes` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerDisputes/routes/sellerDisputes.routes.go:16 |
| GET | `/api/v1/seller/disputes/{disputeId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerDisputes/routes/sellerDisputes.routes.go:17 |
| POST | `/api/v1/seller/disputes/{disputeId}/responses` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerDisputes/routes/sellerDisputes.routes.go:18 |
| GET | `/api/v1/seller/inventory/adjustments` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/adjustments/routes/adjustments.routes.go:13 |
| POST | `/api/v1/seller/inventory/adjustments` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/adjustments/routes/adjustments.routes.go:14 |
| GET | `/api/v1/seller/inventory/levels` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/levels/routes/levels.routes.go:15 |
| GET | `/api/v1/seller/inventory/locations` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/levels/routes/levels.routes.go:17 |
| GET | `/api/v1/seller/inventory/movements` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/movements/routes/movements.routes.go:13 |
| GET | `/api/v1/seller/inventory/reorder` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/levels/routes/levels.routes.go:18 |
| PATCH | `/api/v1/seller/inventory/reorder-levels` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/levels/routes/levels.routes.go:19 |
| GET | `/api/v1/seller/inventory/summary` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/levels/routes/levels.routes.go:16 |
| GET | `/api/v1/seller/inventory/transfers` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/transfers/routes/transfers.routes.go:15 |
| POST | `/api/v1/seller/inventory/transfers` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/transfers/routes/transfers.routes.go:16 |
| POST | `/api/v1/seller/inventory/transfers/{transferId}/cancel` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/transfers/routes/transfers.routes.go:18 |
| POST | `/api/v1/seller/inventory/transfers/{transferId}/receive` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/transfers/routes/transfers.routes.go:17 |
| GET | `/api/v1/seller/locations` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/locations/routes/locations.routes.go:15 |
| POST | `/api/v1/seller/locations` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/locations/routes/locations.routes.go:16 |
| PATCH | `/api/v1/seller/locations/{locationId}` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/locations/routes/locations.routes.go:17 |
| GET | `/api/v1/seller/marketing/bundles` | commerce | user | routed (required) | services/go/modules/orders/src/modules/marketingCampaigns/routes/marketingCampaigns.routes.go:18 |
| POST | `/api/v1/seller/marketing/bundles` | commerce | user | routed (required) | services/go/modules/orders/src/modules/marketingCampaigns/routes/marketingCampaigns.routes.go:19 |
| DELETE | `/api/v1/seller/marketing/bundles/{bundleId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/marketingCampaigns/routes/marketingCampaigns.routes.go:21 |
| PATCH | `/api/v1/seller/marketing/bundles/{bundleId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/marketingCampaigns/routes/marketingCampaigns.routes.go:20 |
| GET | `/api/v1/seller/marketing/featured-products` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/featuredProducts/routes/featuredProducts.routes.go:14 |
| PUT | `/api/v1/seller/marketing/featured-products` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/featuredProducts/routes/featuredProducts.routes.go:15 |
| GET | `/api/v1/seller/marketing/flash-sales` | commerce | user | routed (required) | services/go/modules/orders/src/modules/marketingCampaigns/routes/marketingCampaigns.routes.go:14 |
| POST | `/api/v1/seller/marketing/flash-sales` | commerce | user | routed (required) | services/go/modules/orders/src/modules/marketingCampaigns/routes/marketingCampaigns.routes.go:15 |
| DELETE | `/api/v1/seller/marketing/flash-sales/{flashSaleId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/marketingCampaigns/routes/marketingCampaigns.routes.go:17 |
| PATCH | `/api/v1/seller/marketing/flash-sales/{flashSaleId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/marketingCampaigns/routes/marketingCampaigns.routes.go:16 |
| GET | `/api/v1/seller/marketing/rewards/settings` | commerce | user | routed (required) | services/go/modules/orders/src/modules/storeRewards/routes/storeRewards.routes.go:16 |
| PUT | `/api/v1/seller/marketing/rewards/settings` | commerce | user | routed (required) | services/go/modules/orders/src/modules/storeRewards/routes/storeRewards.routes.go:17 |
| GET | `/api/v1/seller/marketing/rewards/summary` | commerce | user | routed (required) | services/go/modules/orders/src/modules/storeRewards/routes/storeRewards.routes.go:15 |
| GET | `/api/v1/seller/orders` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:17 |
| GET | `/api/v1/seller/orders/{orderId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:18 |
| POST | `/api/v1/seller/orders/{orderId}/accept` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:20 |
| POST | `/api/v1/seller/orders/{orderId}/cancel` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:24 |
| POST | `/api/v1/seller/orders/{orderId}/fulfilment` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:23 |
| POST | `/api/v1/seller/orders/{orderId}/notes` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:25 |
| POST | `/api/v1/seller/orders/{orderId}/refunds` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:26 |
| POST | `/api/v1/seller/orders/{orderId}/reject` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:21 |
| GET | `/api/v1/seller/orders/{orderId}/shipping-snapshot` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:19 |
| POST | `/api/v1/seller/orders/{orderId}/status` | commerce | user | routed (required) | services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go:22 |
| GET | `/api/v1/seller/products` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:18 |
| POST | `/api/v1/seller/products` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:21 |
| POST | `/api/v1/seller/products/barcodes` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:23 |
| POST | `/api/v1/seller/products/bulk` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:22 |
| GET | `/api/v1/seller/products/export` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:20 |
| GET | `/api/v1/seller/products/usage` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:19 |
| DELETE | `/api/v1/seller/products/{productId}` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:26 |
| GET | `/api/v1/seller/products/{productId}` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:24 |
| PATCH | `/api/v1/seller/products/{productId}` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:25 |
| POST | `/api/v1/seller/products/{productId}/duplicate` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:29 |
| POST | `/api/v1/seller/products/{productId}/publish` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:27 |
| POST | `/api/v1/seller/products/{productId}/unpublish` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/sellerProducts/routes/sellerProducts.routes.go:28 |
| GET | `/api/v1/seller/promotions` | commerce | user | routed (required) | services/go/modules/orders/src/modules/promotions/routes/promotions.routes.go:14 |
| POST | `/api/v1/seller/promotions` | commerce | user | routed (required) | services/go/modules/orders/src/modules/promotions/routes/promotions.routes.go:15 |
| POST | `/api/v1/seller/promotions/validate-code` | commerce | user | routed (required) | services/go/modules/orders/src/modules/promotions/routes/promotions.routes.go:16 |
| DELETE | `/api/v1/seller/promotions/{promotionId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/promotions/routes/promotions.routes.go:19 |
| GET | `/api/v1/seller/promotions/{promotionId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/promotions/routes/promotions.routes.go:17 |
| PATCH | `/api/v1/seller/promotions/{promotionId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/promotions/routes/promotions.routes.go:18 |
| GET | `/api/v1/seller/reports/exports` | commerce | user | routed (required) | services/go/modules/orders/src/modules/reports/routes/reports.routes.go:14 |
| POST | `/api/v1/seller/reports/exports` | commerce | user | routed (required) | services/go/modules/orders/src/modules/reports/routes/reports.routes.go:15 |
| GET | `/api/v1/seller/reports/exports/{exportId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/reports/routes/reports.routes.go:16 |
| GET | `/api/v1/seller/reports/{reportKind}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/reports/routes/reports.routes.go:17 |
| GET | `/api/v1/seller/returns` | commerce | user | routed (required) | services/go/modules/orders/src/modules/returns/routes/returns.routes.go:16 |
| POST | `/api/v1/seller/returns/{returnId}/approve` | commerce | user | routed (required) | services/go/modules/orders/src/modules/returns/routes/returns.routes.go:17 |
| POST | `/api/v1/seller/returns/{returnId}/decline` | commerce | user | routed (required) | services/go/modules/orders/src/modules/returns/routes/returns.routes.go:18 |
| POST | `/api/v1/seller/returns/{returnId}/receive` | commerce | user | routed (required) | services/go/modules/orders/src/modules/returns/routes/returns.routes.go:19 |
| GET | `/api/v1/seller/reviews` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/reviews/routes/reviews.routes.go:20 |
| GET | `/api/v1/seller/reviews/summary` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/reviews/routes/reviews.routes.go:21 |
| DELETE | `/api/v1/seller/reviews/{reviewId}/reply` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/reviews/routes/reviews.routes.go:23 |
| PUT | `/api/v1/seller/reviews/{reviewId}/reply` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/reviews/routes/reviews.routes.go:22 |
| POST | `/api/v1/seller/reviews/{reviewId}/report` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/reviews/routes/reviews.routes.go:24 |
| GET | `/api/v1/seller/shipping/preview` | commerce | user | routed (required) | services/go/modules/orders/src/modules/shipping/routes/shipping.routes.go:21 |
| GET | `/api/v1/seller/shipping/profile` | commerce | user | routed (required) | services/go/modules/orders/src/modules/shipping/routes/shipping.routes.go:15 |
| PATCH | `/api/v1/seller/shipping/profile` | commerce | user | routed (required) | services/go/modules/orders/src/modules/shipping/routes/shipping.routes.go:17 |
| GET | `/api/v1/seller/shipping/profiles` | commerce | user | routed (required) | services/go/modules/orders/src/modules/shipping/routes/shipping.routes.go:16 |
| POST | `/api/v1/seller/shipping/rules` | commerce | user | routed (required) | services/go/modules/orders/src/modules/shipping/routes/shipping.routes.go:18 |
| DELETE | `/api/v1/seller/shipping/rules/{ruleId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/shipping/routes/shipping.routes.go:20 |
| PATCH | `/api/v1/seller/shipping/rules/{ruleId}` | commerce | user | routed (required) | services/go/modules/orders/src/modules/shipping/routes/shipping.routes.go:19 |
| PATCH | `/api/v1/seller/store` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/stores/routes/stores.routes.go:17 |
| GET | `/api/v1/seller/stores/mine` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/stores/routes/stores.routes.go:16 |
| GET | `/api/v1/seller/suppliers` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/suppliers/routes/suppliers.routes.go:14 |
| POST | `/api/v1/seller/suppliers` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/suppliers/routes/suppliers.routes.go:15 |
| DELETE | `/api/v1/seller/suppliers/{supplierId}` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/suppliers/routes/suppliers.routes.go:17 |
| PATCH | `/api/v1/seller/suppliers/{supplierId}` | commerce | user | routed (required) | services/go/modules/inventory/src/modules/suppliers/routes/suppliers.routes.go:16 |
| GET | `/api/v1/store-rewards/me` | commerce | user | routed (required) | services/go/modules/orders/src/modules/storeRewards/routes/storeRewards.routes.go:14 |
| POST | `/api/v1/stores` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/stores/routes/stores.routes.go:13 |
| GET | `/api/v1/stores/{storeId}` | commerce | optional-user | routed (optional) | services/go/modules/catalog/src/modules/stores/routes/stores.routes.go:14 |
| GET | `/api/v1/stores/{storeId}/products` | commerce | optional-user | routed (optional) | services/go/modules/catalog/src/modules/products/routes/products.routes.go:19 |
| GET | `/api/v1/stores/{storeId}/reviews` | commerce | none-in-route (controller may self-check) | routed (optional) | services/go/modules/catalog/src/modules/reviews/routes/reviews.routes.go:18 |
| POST | `/api/v1/stores/{storeId}/reviews` | commerce | user | routed (required) | services/go/modules/catalog/src/modules/reviews/routes/reviews.routes.go:19 |
| GET | `/.well-known/jwks.json` | identity | none-in-route (controller may self-check) | UNROUTED | services/go/modules/auth/src/modules/signingKeys/routes/signingKeys.routes.go:11 |
| POST | `/api/v1/admin/accounts` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:40 |
| GET | `/api/v1/admin/accounts/created` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:39 |
| GET | `/api/v1/admin/admins` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:16 |
| POST | `/api/v1/admin/admins` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:18 |
| GET | `/api/v1/admin/admins/{staffId}` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:17 |
| POST | `/api/v1/admin/admins/{staffId}/approve` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:26 |
| POST | `/api/v1/admin/admins/{staffId}/disable` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:21 |
| POST | `/api/v1/admin/admins/{staffId}/enable` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:22 |
| PATCH | `/api/v1/admin/admins/{staffId}/permissions` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:20 |
| PUT | `/api/v1/admin/admins/{staffId}/permissions` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:19 |
| POST | `/api/v1/admin/admins/{staffId}/reset-mfa` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:23 |
| POST | `/api/v1/admin/admins/{staffId}/revoke` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:25 |
| POST | `/api/v1/admin/admins/{staffId}/suspend` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:24 |
| GET | `/api/v1/admin/applications/creators` | identity | staff | routed (optional) | services/go/modules/users/src/modules/creatorProgram/routes/creatorProgram.routes.go:21 |
| GET | `/api/v1/admin/applications/creators/{applicationId}` | identity | staff | routed (optional) | services/go/modules/users/src/modules/creatorProgram/routes/creatorProgram.routes.go:22 |
| POST | `/api/v1/admin/applications/creators/{applicationId}/approve` | identity | staff | routed (optional) | services/go/modules/users/src/modules/creatorProgram/routes/creatorProgram.routes.go:23 |
| POST | `/api/v1/admin/applications/creators/{applicationId}/reject` | identity | staff | routed (optional) | services/go/modules/users/src/modules/creatorProgram/routes/creatorProgram.routes.go:24 |
| GET | `/api/v1/admin/audit` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/auditLog/routes/auditLog.routes.go:13 |
| GET | `/api/v1/admin/audit/export` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/auditLog/routes/auditLog.routes.go:15 |
| GET | `/api/v1/admin/audit/facets` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/auditLog/routes/auditLog.routes.go:14 |
| GET | `/api/v1/admin/audit/{entryId}` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/auditLog/routes/auditLog.routes.go:19 |
| POST | `/api/v1/admin/auth/accept-invitation` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAuth/routes/staffAuth.routes.go:18 |
| POST | `/api/v1/admin/auth/login` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAuth/routes/staffAuth.routes.go:13 |
| POST | `/api/v1/admin/auth/logout` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAuth/routes/staffAuth.routes.go:19 |
| GET | `/api/v1/admin/auth/me` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAuth/routes/staffAuth.routes.go:20 |
| POST | `/api/v1/admin/auth/mfa/enroll/confirm` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAuth/routes/staffAuth.routes.go:15 |
| POST | `/api/v1/admin/auth/mfa/enroll/start` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAuth/routes/staffAuth.routes.go:14 |
| POST | `/api/v1/admin/auth/mfa/verify` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAuth/routes/staffAuth.routes.go:16 |
| POST | `/api/v1/admin/auth/refresh` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAuth/routes/staffAuth.routes.go:17 |
| POST | `/api/v1/admin/auth/step-up` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAuth/routes/staffAuth.routes.go:21 |
| GET | `/api/v1/admin/black-applications` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:42 |
| POST | `/api/v1/admin/black-applications/{blackId}/approve` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:44 |
| POST | `/api/v1/admin/black-applications/{blackId}/checklist` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:43 |
| POST | `/api/v1/admin/black-applications/{blackId}/reject` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:45 |
| POST | `/api/v1/admin/black-applications/{blackId}/reverification-reminder` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:47 |
| POST | `/api/v1/admin/black-applications/{blackId}/revoke` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:46 |
| GET | `/api/v1/admin/business-documents` | identity | staff | routed (optional) | services/go/modules/users/src/modules/businessDocuments/routes/businessDocuments.routes.go:21 |
| GET | `/api/v1/admin/business-documents/{submissionId}/documents/{documentId}/access` | identity | staff | routed (optional) | services/go/modules/users/src/modules/businessDocuments/routes/businessDocuments.routes.go:22 |
| POST | `/api/v1/admin/business-documents/{submissionId}/documents/{documentId}/approve` | identity | staff | routed (optional) | services/go/modules/users/src/modules/businessDocuments/routes/businessDocuments.routes.go:23 |
| POST | `/api/v1/admin/business-documents/{submissionId}/documents/{documentId}/reject` | identity | staff | routed (optional) | services/go/modules/users/src/modules/businessDocuments/routes/businessDocuments.routes.go:24 |
| GET | `/api/v1/admin/checkmark-grants` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:36 |
| POST | `/api/v1/admin/checkmark-grants` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:37 |
| POST | `/api/v1/admin/checkmark-grants/{grantId}/revoke` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:38 |
| GET | `/api/v1/admin/config` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/platformSettings/routes/platformSettings.routes.go:15 |
| GET | `/api/v1/admin/config/{key}` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/platformSettings/routes/platformSettings.routes.go:16 |
| PUT | `/api/v1/admin/config/{key}` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/platformSettings/routes/platformSettings.routes.go:17 |
| GET | `/api/v1/admin/exchange-rates` | identity | staff | routed (optional) | services/go/modules/currency/src/modules/exchangeRates/routes/exchangeRates.routes.go:21 |
| PUT | `/api/v1/admin/exchange-rates/{currency}` | identity | staff | routed (optional) | services/go/modules/currency/src/modules/exchangeRates/routes/exchangeRates.routes.go:22 |
| GET | `/api/v1/admin/legal/documents` | identity | staff | routed (optional) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:26 |
| GET | `/api/v1/admin/legal/documents/{key}` | identity | staff | routed (optional) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:27 |
| POST | `/api/v1/admin/legal/documents/{key}/rollback` | identity | staff | routed (optional) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:29 |
| POST | `/api/v1/admin/legal/documents/{key}/versions` | identity | staff | routed (optional) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:28 |
| GET | `/api/v1/admin/legal/notices` | identity | staff | UPSTREAM MISMATCH (gateway->notifications) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:40 |
| POST | `/api/v1/admin/legal/notices` | identity | staff | UPSTREAM MISMATCH (gateway->notifications) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:42 |
| GET | `/api/v1/admin/legal/notices/{noticeId}` | identity | staff | UPSTREAM MISMATCH (gateway->notifications) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:41 |
| GET | `/api/v1/admin/legal/versions/{versionId}` | identity | staff | routed (optional) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:30 |
| PUT | `/api/v1/admin/legal/versions/{versionId}` | identity | staff | routed (optional) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:31 |
| GET | `/api/v1/admin/legal/versions/{versionId}/acceptance` | identity | staff | routed (optional) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:35 |
| GET | `/api/v1/admin/legal/versions/{versionId}/notice-draft` | identity | staff | UPSTREAM MISMATCH (gateway->notifications) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:36 |
| PUT | `/api/v1/admin/legal/versions/{versionId}/notice-draft` | identity | staff | UPSTREAM MISMATCH (gateway->notifications) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:37 |
| POST | `/api/v1/admin/legal/versions/{versionId}/notice-draft/test-send` | identity | staff | UPSTREAM MISMATCH (gateway->notifications) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:38 |
| GET | `/api/v1/admin/legal/versions/{versionId}/notice-preview` | identity | staff | UPSTREAM MISMATCH (gateway->notifications) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:39 |
| POST | `/api/v1/admin/legal/versions/{versionId}/publish` | identity | staff | routed (optional) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:34 |
| POST | `/api/v1/admin/legal/versions/{versionId}/return` | identity | staff | routed (optional) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:33 |
| POST | `/api/v1/admin/legal/versions/{versionId}/submit` | identity | staff | routed (optional) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:32 |
| POST | `/api/v1/admin/policy-versions` | identity | staff | routed (optional) | services/go/modules/users/src/modules/consents/routes/consents.routes.go:26 |
| GET | `/api/v1/admin/retention-policies` | identity | staff | routed (optional) | services/go/modules/users/src/modules/retention/routes/retention.routes.go:15 |
| PUT | `/api/v1/admin/retention-policies/{category}` | identity | staff | routed (optional) | services/go/modules/users/src/modules/retention/routes/retention.routes.go:16 |
| GET | `/api/v1/admin/roles` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:28 |
| POST | `/api/v1/admin/roles` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:29 |
| GET | `/api/v1/admin/staff-settings` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:30 |
| PUT | `/api/v1/admin/staff-settings` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:31 |
| GET | `/api/v1/admin/suspensions/accounts` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:37 |
| POST | `/api/v1/admin/suspensions/accounts/{caseId}/appeal/decide` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:39 |
| POST | `/api/v1/admin/suspensions/accounts/{caseId}/reinstate` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:38 |
| GET | `/api/v1/admin/trending/moderation` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/platformSettings/routes/platformSettings.routes.go:19 |
| PUT | `/api/v1/admin/trending/moderation` | identity | staff | routed (optional) | services/go/modules/admin/src/modules/platformSettings/routes/platformSettings.routes.go:20 |
| GET | `/api/v1/admin/usernames/held` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:35 |
| GET | `/api/v1/admin/usernames/hold` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:36 |
| GET | `/api/v1/admin/usernames/reserved` | identity | staff | routed (optional) | services/go/modules/users/src/modules/usernames/routes/usernames.routes.go:26 |
| POST | `/api/v1/admin/usernames/reserved` | identity | staff | routed (optional) | services/go/modules/users/src/modules/usernames/routes/usernames.routes.go:27 |
| DELETE | `/api/v1/admin/usernames/reserved/{ruleId}` | identity | staff | routed (optional) | services/go/modules/users/src/modules/usernames/routes/usernames.routes.go:28 |
| POST | `/api/v1/admin/usernames/withheld` | identity | staff | routed (optional) | services/go/modules/users/src/modules/usernames/routes/usernames.routes.go:29 |
| DELETE | `/api/v1/admin/usernames/withheld/{username}` | identity | staff | routed (optional) | services/go/modules/users/src/modules/usernames/routes/usernames.routes.go:30 |
| GET | `/api/v1/admin/users` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:25 |
| GET | `/api/v1/admin/users/{userId}` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:26 |
| POST | `/api/v1/admin/users/{userId}/ban` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:30 |
| POST | `/api/v1/admin/users/{userId}/delete` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:32 |
| POST | `/api/v1/admin/users/{userId}/reinstate` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:29 |
| POST | `/api/v1/admin/users/{userId}/restrict` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:27 |
| POST | `/api/v1/admin/users/{userId}/suspend` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:28 |
| POST | `/api/v1/admin/users/{userId}/unban` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:31 |
| POST | `/api/v1/admin/users/{userId}/username/assign-held` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:34 |
| POST | `/api/v1/admin/users/{userId}/username/reassign` | identity | staff | routed (optional) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:33 |
| GET | `/api/v1/admin/verification-cases` | identity | staff | routed (optional) | services/go/modules/users/src/modules/identityVerification/routes/identityVerification.routes.go:25 |
| GET | `/api/v1/admin/verification-cases/{caseId}` | identity | staff | routed (optional) | services/go/modules/users/src/modules/identityVerification/routes/identityVerification.routes.go:26 |
| POST | `/api/v1/admin/verification-cases/{caseId}/approve` | identity | staff | routed (optional) | services/go/modules/users/src/modules/identityVerification/routes/identityVerification.routes.go:27 |
| POST | `/api/v1/admin/verification-cases/{caseId}/reject` | identity | staff | routed (optional) | services/go/modules/users/src/modules/identityVerification/routes/identityVerification.routes.go:28 |
| GET | `/api/v1/admin/verifications` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:28 |
| GET | `/api/v1/admin/verifications/{verificationId}` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:29 |
| POST | `/api/v1/admin/verifications/{verificationId}/approve` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:30 |
| POST | `/api/v1/admin/verifications/{verificationId}/reinstate` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:32 |
| POST | `/api/v1/admin/verifications/{verificationId}/reject` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:31 |
| POST | `/api/v1/admin/verifications/{verificationId}/revoke` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:34 |
| POST | `/api/v1/admin/verifications/{verificationId}/suspend` | identity | staff | routed (optional) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:33 |
| POST | `/api/v1/auth/apple` | identity | none-in-route (controller may self-check) | OPTIONAL-AUTH MUTATION, NO ROUTE GUARD | services/go/modules/auth/src/modules/socialSignIn/routes/socialSignIn.routes.go:13 |
| POST | `/api/v1/auth/google` | identity | none-in-route (controller may self-check) | OPTIONAL-AUTH MUTATION, NO ROUTE GUARD | services/go/modules/auth/src/modules/socialSignIn/routes/socialSignIn.routes.go:12 |
| POST | `/api/v1/auth/login` | identity | none-in-route (controller may self-check) | OPTIONAL-AUTH MUTATION, NO ROUTE GUARD | services/go/modules/auth/src/modules/sessions/routes/sessions.routes.go:14 |
| POST | `/api/v1/auth/logout` | identity | user | routed (required) | services/go/modules/auth/src/modules/sessions/routes/sessions.routes.go:16 |
| POST | `/api/v1/auth/otp/send` | identity | none-in-route (controller may self-check) | OPTIONAL-AUTH MUTATION, NO ROUTE GUARD | services/go/modules/auth/src/modules/oneTimeCodes/routes/oneTimeCodes.routes.go:12 |
| POST | `/api/v1/auth/otp/verify` | identity | none-in-route (controller may self-check) | OPTIONAL-AUTH MUTATION, NO ROUTE GUARD | services/go/modules/auth/src/modules/oneTimeCodes/routes/oneTimeCodes.routes.go:13 |
| POST | `/api/v1/auth/password/change` | identity | user | routed (required) | services/go/modules/auth/src/modules/passwords/routes/passwords.routes.go:14 |
| POST | `/api/v1/auth/password/reset` | identity | none-in-route (controller may self-check) | OPTIONAL-AUTH MUTATION, NO ROUTE GUARD | services/go/modules/auth/src/modules/passwords/routes/passwords.routes.go:13 |
| POST | `/api/v1/auth/refresh` | identity | none-in-route (controller may self-check) | OPTIONAL-AUTH MUTATION, NO ROUTE GUARD | services/go/modules/auth/src/modules/sessions/routes/sessions.routes.go:15 |
| POST | `/api/v1/auth/register` | identity | none-in-route (controller may self-check) | OPTIONAL-AUTH MUTATION, NO ROUTE GUARD | services/go/modules/auth/src/modules/registration/routes/registration.routes.go:12 |
| DELETE | `/api/v1/auth/sessions` | identity | user | routed (required) | services/go/modules/auth/src/modules/sessions/routes/sessions.routes.go:18 |
| GET | `/api/v1/auth/sessions` | identity | user | routed (required) | services/go/modules/auth/src/modules/sessions/routes/sessions.routes.go:17 |
| DELETE | `/api/v1/auth/sessions/{sessionId}` | identity | user | routed (required) | services/go/modules/auth/src/modules/sessions/routes/sessions.routes.go:19 |
| GET | `/api/v1/auth/username-available` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/auth/src/modules/registration/routes/registration.routes.go:13 |
| GET | `/api/v1/auth/username-suggestion` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/usernames/routes/usernames.routes.go:25 |
| GET | `/api/v1/business-categories` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/businessProfiles/routes/businessProfiles.routes.go:14 |
| GET | `/api/v1/consents` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/consents/routes/consents.routes.go:19 |
| PUT | `/api/v1/consents` | identity | none-in-route (controller may self-check) | OPTIONAL-AUTH MUTATION, NO ROUTE GUARD | services/go/modules/users/src/modules/consents/routes/consents.routes.go:20 |
| POST | `/api/v1/creators/applications` | identity | user | routed (required) | services/go/modules/users/src/modules/creatorProgram/routes/creatorProgram.routes.go:20 |
| GET | `/api/v1/creators/applications/me` | identity | user | routed (required) | services/go/modules/users/src/modules/creatorProgram/routes/creatorProgram.routes.go:19 |
| GET | `/api/v1/creators/eligibility` | identity | user | routed (required) | services/go/modules/users/src/modules/creatorProgram/routes/creatorProgram.routes.go:18 |
| GET | `/api/v1/currencies` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/currency/src/modules/exchangeRates/routes/exchangeRates.routes.go:19 |
| GET | `/api/v1/currency/convert` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/currency/src/modules/exchangeRates/routes/exchangeRates.routes.go:20 |
| GET | `/api/v1/geo/admin-areas/{areaId}/cities` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/geo/routes/geo.routes.go:16 |
| GET | `/api/v1/geo/countries` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/geo/routes/geo.routes.go:12 |
| GET | `/api/v1/geo/countries/{countryId}/regions` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/geo/routes/geo.routes.go:13 |
| GET | `/api/v1/geo/regions/{regionId}/admin-areas` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/geo/routes/geo.routes.go:14 |
| GET | `/api/v1/geo/regions/{regionId}/cities` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/geo/routes/geo.routes.go:15 |
| GET | `/api/v1/internal/accounts/{accountId}/contact-privacy` | identity | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/contactPrivacy/routes/contactPrivacy.routes.go:18 |
| GET | `/api/v1/internal/accounts/{accountId}/policy-gate` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:45 |
| POST | `/api/v1/internal/admin/audit-entries` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/admin/src/modules/auditLog/routes/auditLog.routes.go:17 |
| GET | `/api/v1/internal/admins/{staffId}/notification-recipient` | identity | staff | hidden (internal segment blocked at gateway) | services/go/modules/admin/src/modules/staffAdmins/routes/staffAdmins.routes.go:27 |
| POST | `/api/v1/internal/audit/events` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/admin/src/modules/auditLog/routes/auditLog.routes.go:16 |
| GET | `/api/v1/internal/audit/history` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/admin/src/modules/auditLog/routes/auditLog.routes.go:18 |
| POST | `/api/v1/internal/checkmarks/{profileId}/billing-events` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:48 |
| POST | `/api/v1/internal/enforcement/actions` | identity | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:43 |
| PUT | `/api/v1/internal/legal/notices/{noticeId}/progress` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:46 |
| GET | `/api/v1/internal/notification-audience/segments` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/notificationDirectory/routes/notificationDirectory.routes.go:14 |
| GET | `/api/v1/internal/notification-audience/{segmentId}` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/notificationDirectory/routes/notificationDirectory.routes.go:15 |
| GET | `/api/v1/internal/notification-audience/{segmentId}/count` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/notificationDirectory/routes/notificationDirectory.routes.go:16 |
| GET | `/api/v1/internal/platform-config/{key}` | identity | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/admin/src/modules/platformSettings/routes/platformSettings.routes.go:22 |
| PUT | `/api/v1/internal/profiles/{profileId}/signals` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/creatorProgram/routes/creatorProgram.routes.go:25 |
| GET | `/api/v1/internal/search-sources/users/{id}` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/searchSources/routes/searchSources.routes.go:12 |
| GET | `/api/v1/internal/users/by-username/{username}/notification-recipient` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/notificationDirectory/routes/notificationDirectory.routes.go:13 |
| POST | `/api/v1/internal/users/summaries` | identity | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:44 |
| POST | `/api/v1/internal/users/{accountId}/marketing-unsubscribe` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/notificationDirectory/routes/notificationDirectory.routes.go:17 |
| GET | `/api/v1/internal/users/{accountId}/notification-recipient` | identity | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/notificationDirectory/routes/notificationDirectory.routes.go:12 |
| GET | `/api/v1/internal/users/{accountId}/privacy-settings` | identity | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/users/src/modules/privacySettings/routes/privacySettings.routes.go:16 |
| GET | `/api/v1/legal/policy-versions/current` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:43 |
| GET | `/api/v1/locale` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/currency/src/modules/locale/routes/locale.routes.go:12 |
| GET | `/api/v1/locale/countries` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/currency/src/modules/locale/routes/locale.routes.go:13 |
| GET | `/api/v1/platform-config/creator-requirements` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/admin/src/modules/platformSettings/routes/platformSettings.routes.go:21 |
| GET | `/api/v1/policies/current` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/consents/routes/consents.routes.go:18 |
| GET | `/api/v1/seller/business-documents` | identity | user | routed (required) | services/go/modules/users/src/modules/businessDocuments/routes/businessDocuments.routes.go:17 |
| PUT | `/api/v1/seller/business-documents/{kind}` | identity | user | routed (required) | services/go/modules/users/src/modules/businessDocuments/routes/businessDocuments.routes.go:19 |
| POST | `/api/v1/seller/business-documents/{kind}/upload-intents` | identity | user | routed (required) | services/go/modules/users/src/modules/businessDocuments/routes/businessDocuments.routes.go:18 |
| GET | `/api/v1/users/by-username/{username}` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/profiles/routes/profiles.routes.go:20 |
| GET | `/api/v1/users/me` | identity | user | routed (required) | services/go/modules/users/src/modules/profiles/routes/profiles.routes.go:14 |
| PATCH | `/api/v1/users/me` | identity | user | routed (required) | services/go/modules/users/src/modules/profiles/routes/profiles.routes.go:15 |
| GET | `/api/v1/users/me/acting-profile` | identity | user | routed (required) | services/go/modules/users/src/modules/actingProfiles/routes/actingProfiles.routes.go:15 |
| PUT | `/api/v1/users/me/acting-profile` | identity | user | routed (required) | services/go/modules/users/src/modules/actingProfiles/routes/actingProfiles.routes.go:16 |
| GET | `/api/v1/users/me/addresses` | identity | user | routed (required) | services/go/modules/users/src/modules/addresses/routes/addresses.routes.go:14 |
| POST | `/api/v1/users/me/addresses` | identity | user | routed (required) | services/go/modules/users/src/modules/addresses/routes/addresses.routes.go:15 |
| DELETE | `/api/v1/users/me/addresses/{addressId}` | identity | user | routed (required) | services/go/modules/users/src/modules/addresses/routes/addresses.routes.go:18 |
| GET | `/api/v1/users/me/addresses/{addressId}` | identity | user | routed (required) | services/go/modules/users/src/modules/addresses/routes/addresses.routes.go:16 |
| PATCH | `/api/v1/users/me/addresses/{addressId}` | identity | user | routed (required) | services/go/modules/users/src/modules/addresses/routes/addresses.routes.go:17 |
| POST | `/api/v1/users/me/business-profiles` | identity | user | routed (required) | services/go/modules/users/src/modules/businessProfiles/routes/businessProfiles.routes.go:15 |
| PATCH | `/api/v1/users/me/business-profiles/{profileId}` | identity | user | routed (required) | services/go/modules/users/src/modules/businessProfiles/routes/businessProfiles.routes.go:16 |
| GET | `/api/v1/users/me/celebrations` | identity | user | routed (required) | services/go/modules/users/src/modules/celebrations/routes/celebrations.routes.go:14 |
| POST | `/api/v1/users/me/celebrations/seen` | identity | user | routed (required) | services/go/modules/users/src/modules/celebrations/routes/celebrations.routes.go:15 |
| PATCH | `/api/v1/users/me/celebrations/settings` | identity | user | routed (required) | services/go/modules/users/src/modules/celebrations/routes/celebrations.routes.go:16 |
| GET | `/api/v1/users/me/consents` | identity | user | routed (required) | services/go/modules/users/src/modules/consents/routes/consents.routes.go:21 |
| PUT | `/api/v1/users/me/consents` | identity | user | routed (required) | services/go/modules/users/src/modules/consents/routes/consents.routes.go:22 |
| POST | `/api/v1/users/me/consents/merge` | identity | user | routed (required) | services/go/modules/users/src/modules/consents/routes/consents.routes.go:23 |
| POST | `/api/v1/users/me/creator-application` | identity | user | routed (required) | services/go/modules/users/src/modules/creatorStatus/routes/creatorStatus.routes.go:13 |
| GET | `/api/v1/users/me/data-exports` | identity | user | routed (required) | services/go/modules/users/src/modules/dataExport/routes/dataExport.routes.go:15 |
| POST | `/api/v1/users/me/data-exports` | identity | user | routed (required) | services/go/modules/users/src/modules/dataExport/routes/dataExport.routes.go:14 |
| GET | `/api/v1/users/me/data-exports/{exportId}` | identity | user | routed (required) | services/go/modules/users/src/modules/dataExport/routes/dataExport.routes.go:16 |
| POST | `/api/v1/users/me/deactivate` | identity | user | routed (required) | services/go/modules/users/src/modules/profiles/routes/profiles.routes.go:18 |
| GET | `/api/v1/users/me/deletion-request` | identity | user | routed (required) | services/go/modules/users/src/modules/accountDeletion/routes/accountDeletion.routes.go:15 |
| POST | `/api/v1/users/me/deletion-request` | identity | user | routed (required) | services/go/modules/users/src/modules/accountDeletion/routes/accountDeletion.routes.go:14 |
| POST | `/api/v1/users/me/deletion-request/cancel` | identity | user | routed (required) | services/go/modules/users/src/modules/accountDeletion/routes/accountDeletion.routes.go:16 |
| POST | `/api/v1/users/me/media/upload-intents` | identity | user | routed (required) | services/go/modules/users/src/modules/profiles/routes/profiles.routes.go:16 |
| GET | `/api/v1/users/me/mention-privacy` | identity | user | routed (required) | services/go/modules/users/src/modules/contactPrivacy/routes/contactPrivacy.routes.go:14 |
| PUT | `/api/v1/users/me/mention-privacy` | identity | user | routed (required) | services/go/modules/users/src/modules/contactPrivacy/routes/contactPrivacy.routes.go:15 |
| GET | `/api/v1/users/me/message-privacy` | identity | user | routed (required) | services/go/modules/users/src/modules/contactPrivacy/routes/contactPrivacy.routes.go:16 |
| PUT | `/api/v1/users/me/message-privacy` | identity | user | routed (required) | services/go/modules/users/src/modules/contactPrivacy/routes/contactPrivacy.routes.go:17 |
| GET | `/api/v1/users/me/policy-acceptances` | identity | user | routed (required) | services/go/modules/users/src/modules/legal/routes/legal.routes.go:44 |
| PATCH | `/api/v1/users/me/preferences` | identity | user | routed (required) | services/go/modules/users/src/modules/profiles/routes/profiles.routes.go:17 |
| GET | `/api/v1/users/me/privacy-settings` | identity | user | routed (required) | services/go/modules/users/src/modules/privacySettings/routes/privacySettings.routes.go:14 |
| PATCH | `/api/v1/users/me/privacy-settings` | identity | user | routed (required) | services/go/modules/users/src/modules/privacySettings/routes/privacySettings.routes.go:15 |
| GET | `/api/v1/users/me/profiles` | identity | user | routed (required) | services/go/modules/users/src/modules/actingProfiles/routes/actingProfiles.routes.go:14 |
| GET | `/api/v1/users/me/suspension` | identity | user | routed (required) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:41 |
| POST | `/api/v1/users/me/suspension/appeal` | identity | user | routed (required) | services/go/modules/users/src/modules/accountEnforcement/routes/accountEnforcement.routes.go:42 |
| GET | `/api/v1/users/me/terms-acceptances` | identity | user | routed (required) | services/go/modules/users/src/modules/consents/routes/consents.routes.go:25 |
| POST | `/api/v1/users/me/terms-acceptances` | identity | user | routed (required) | services/go/modules/users/src/modules/consents/routes/consents.routes.go:24 |
| PATCH | `/api/v1/users/me/username` | identity | user | routed (required) | services/go/modules/users/src/modules/usernames/routes/usernames.routes.go:24 |
| GET | `/api/v1/users/me/username-policy` | identity | user | routed (required) | services/go/modules/users/src/modules/usernames/routes/usernames.routes.go:23 |
| GET | `/api/v1/users/username/{username}` | identity | user | routed (required) | services/go/modules/users/src/modules/profiles/routes/profiles.routes.go:19 |
| GET | `/api/v1/users/{userId}` | identity | user | routed (required) | services/go/modules/users/src/modules/profiles/routes/profiles.routes.go:21 |
| POST | `/api/v1/verification/applications` | identity | user | routed (required) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:25 |
| POST | `/api/v1/verification/black-applications` | identity | user | routed (required) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:26 |
| POST | `/api/v1/verification/cases/{caseId}/capture` | identity | user | routed (required) | services/go/modules/users/src/modules/identityVerification/routes/identityVerification.routes.go:22 |
| GET | `/api/v1/verification/document-types` | identity | user | routed (required) | services/go/modules/users/src/modules/identityVerification/routes/identityVerification.routes.go:21 |
| POST | `/api/v1/verification/eligibility/request` | identity | user | routed (required) | services/go/modules/users/src/modules/identityVerification/routes/identityVerification.routes.go:20 |
| GET | `/api/v1/verification/journey` | identity | user | routed (required) | services/go/modules/users/src/modules/identityVerification/routes/identityVerification.routes.go:19 |
| GET | `/api/v1/verification/me` | identity | user | routed (required) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:24 |
| GET | `/api/v1/verification/suggestions` | identity | user | routed (required) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:22 |
| POST | `/api/v1/verification/suggestions/{color}/dismiss` | identity | user | routed (required) | services/go/modules/users/src/modules/checkmarks/routes/checkmarks.routes.go:23 |
| POST | `/api/v1/webhooks/smile-id` | identity | none-in-route (controller may self-check) | routed (optional) | services/go/modules/users/src/modules/identityVerification/routes/identityVerification.routes.go:23 |
| GET | `/health/live` | intelligence | request signature (internal only) | ops endpoint (not routed) | services/python/intelligence/src/routes/health_routes.py |
| GET | `/health/ready` | intelligence | request signature (internal only) | ops endpoint (not routed) | services/python/intelligence/src/routes/health_routes.py |
| POST | `/v1/ads/predicted-ctr` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/ad_click_prediction/routes/ad_click_prediction_routes.py |
| POST | `/v1/ads/select` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/ads/routes/ads_routes.py |
| POST | `/v1/audio/copyright-matches` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/audio/routes/audio_routes.py |
| POST | `/v1/audio/fingerprints` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/audio/routes/audio_routes.py |
| POST | `/v1/audio/match` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/audio/routes/audio_routes.py |
| POST | `/v1/audio/sounds/status` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/audio/routes/audio_routes.py |
| POST | `/v1/chat/spam-score` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/chat_spam/routes/chat_spam_routes.py |
| POST | `/v1/clips/rank` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/clips/routes/clips_routes.py |
| POST | `/v1/creators/real-followers` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/creator_eligibility/routes/creator_eligibility_routes.py |
| POST | `/v1/events` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/events_ingestion/routes/events_ingestion_routes.py |
| POST | `/v1/experiments/assign` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/experiments/routes/experiments_routes.py |
| GET | `/v1/experiments/{experiment_key}/metrics` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/experiments/routes/experiments_routes.py |
| POST | `/v1/feed/rank` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/feed/routes/feed_routes.py |
| POST | `/v1/help/answer-drafts` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/help_content/routes/help_content_routes.py |
| GET | `/v1/models` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/model_registry/routes/model_registry_routes.py |
| POST | `/v1/moderation/classify` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/moderation/routes/moderation_routes.py |
| POST | `/v1/moderation/classify-image` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/moderation/routes/moderation_routes.py |
| POST | `/v1/recommendations/accounts` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/recommendations/routes/recommendations_routes.py |
| POST | `/v1/recommendations/clips` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/recommendations/routes/recommendations_routes.py |
| POST | `/v1/recommendations/products` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/recommendations/routes/recommendations_routes.py |
| POST | `/v1/risk/score` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/risk/routes/risk_routes.py |
| POST | `/v1/risk/score-extended` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/extended_risk/routes/extended_risk_routes.py |
| POST | `/v1/search/rerank` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/search/routes/search_routes.py |
| POST | `/v1/social-proof/select` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/social_proof/routes/social_proof_routes.py |
| POST | `/v1/trending` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/trending/routes/trending_routes.py |
| POST | `/v1/trending/headlines` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/trending/routes/trending_routes.py |
| POST | `/v1/trust/bot-score` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/bot_detection/routes/bot_detection_routes.py |
| POST | `/v1/verification/eligibility` | intelligence | request signature (internal only) | UNROUTED | services/python/intelligence/src/modules/verification_eligibility/routes/verification_eligibility_routes.py |
| GET | `/api/v1/admin/gifts` | live | staff | routed (optional) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:25 |
| POST | `/api/v1/admin/gifts` | live | staff | routed (optional) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:26 |
| DELETE | `/api/v1/admin/gifts/{giftId}` | live | staff | routed (optional) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:28 |
| PATCH | `/api/v1/admin/gifts/{giftId}` | live | staff | routed (optional) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:27 |
| POST | `/api/v1/battles/{battleId}/{action}` | live | user | routed (required) | services/go/modules/live/src/modules/battles/routes/battles.routes.go:16 |
| GET | `/api/v1/creators/me/analytics/gifts/streams/{liveId}` | live | user | routed (required) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:20 |
| GET | `/api/v1/gifts` | live | user | routed (required) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:16 |
| GET | `/api/v1/internal/accounts/{accountId}/activity-counts` | live | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/live/src/modules/internalApi/routes/internalApi.routes.go:18 |
| GET | `/api/v1/internal/live/topic-access` | live | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/live/src/modules/internalApi/routes/internalApi.routes.go:15 |
| GET | `/api/v1/internal/live/{liveId}/ad-eligibility` | live | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/live/src/modules/internalApi/routes/internalApi.routes.go:16 |
| POST | `/api/v1/internal/live/{liveId}/presence` | live | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/live/src/modules/internalApi/routes/internalApi.routes.go:17 |
| GET | `/api/v1/internal/moderation/targets/{type}/{id}` | live | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/live/src/modules/internalApi/routes/internalApi.routes.go:19 |
| GET | `/api/v1/internal/share-cards/live/{id}` | live | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/live/src/modules/internalApi/routes/internalApi.routes.go:14 |
| POST | `/api/v1/live/gifts` | live | user | routed (required) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:17 |
| POST | `/api/v1/live/webhooks/livekit` | live | none-in-route (controller may self-check) | routed (optional) | services/go/modules/live/src/modules/studio/routes/studio.routes.go:21 |
| GET | `/api/v1/lives` | live | user | routed (optional) | services/go/modules/live/src/modules/studio/routes/studio.routes.go:14 |
| POST | `/api/v1/lives` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:14 |
| GET | `/api/v1/lives/suggested` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:15 |
| GET | `/api/v1/lives/{liveId}` | live | user | routed (optional) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:16 |
| POST | `/api/v1/lives/{liveId}/battles` | live | user | routed (required) | services/go/modules/live/src/modules/battles/routes/battles.routes.go:15 |
| GET | `/api/v1/lives/{liveId}/comments` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:14 |
| POST | `/api/v1/lives/{liveId}/comments` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:15 |
| DELETE | `/api/v1/lives/{liveId}/comments/{commentId}` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:16 |
| PUT | `/api/v1/lives/{liveId}/comments/{commentId}/pin` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:17 |
| POST | `/api/v1/lives/{liveId}/end` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:19 |
| POST | `/api/v1/lives/{liveId}/engagement` | live | user | routed (required) | services/go/modules/live/src/modules/points/routes/points.routes.go:15 |
| GET | `/api/v1/lives/{liveId}/gift-goals` | live | user | routed (required) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:21 |
| POST | `/api/v1/lives/{liveId}/gift-goals` | live | user | routed (required) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:22 |
| DELETE | `/api/v1/lives/{liveId}/gift-goals/{goalId}` | live | user | routed (required) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:24 |
| PATCH | `/api/v1/lives/{liveId}/gift-goals/{goalId}` | live | user | routed (required) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:23 |
| POST | `/api/v1/lives/{liveId}/gifts` | live | user | routed (required) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:18 |
| POST | `/api/v1/lives/{liveId}/guests/invitations` | live | user | routed (required) | services/go/modules/live/src/modules/stage/routes/stage.routes.go:16 |
| DELETE | `/api/v1/lives/{liveId}/guests/invitations/{slotId}` | live | user | routed (required) | services/go/modules/live/src/modules/stage/routes/stage.routes.go:17 |
| POST | `/api/v1/lives/{liveId}/guests/invitations/{slotId}/{response}` | live | user | routed (required) | services/go/modules/live/src/modules/stage/routes/stage.routes.go:18 |
| POST | `/api/v1/lives/{liveId}/guests/me/connection` | live | user | routed (required) | services/go/modules/live/src/modules/stage/routes/stage.routes.go:24 |
| POST | `/api/v1/lives/{liveId}/guests/me/leave` | live | user | routed (required) | services/go/modules/live/src/modules/stage/routes/stage.routes.go:23 |
| POST | `/api/v1/lives/{liveId}/guests/requests` | live | user | routed (required) | services/go/modules/live/src/modules/stage/routes/stage.routes.go:19 |
| POST | `/api/v1/lives/{liveId}/guests/requests/{requestId}/{decision}` | live | user | routed (required) | services/go/modules/live/src/modules/stage/routes/stage.routes.go:20 |
| POST | `/api/v1/lives/{liveId}/guests/{userId}/mute` | live | user | routed (required) | services/go/modules/live/src/modules/stage/routes/stage.routes.go:22 |
| POST | `/api/v1/lives/{liveId}/guests/{userId}/remove` | live | user | routed (required) | services/go/modules/live/src/modules/stage/routes/stage.routes.go:21 |
| POST | `/api/v1/lives/{liveId}/join` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:20 |
| GET | `/api/v1/lives/{liveId}/leaderboard` | live | user | routed (required) | services/go/modules/live/src/modules/gifts/routes/gifts.routes.go:19 |
| POST | `/api/v1/lives/{liveId}/leave` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:21 |
| POST | `/api/v1/lives/{liveId}/media-token` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:25 |
| GET | `/api/v1/lives/{liveId}/moderators` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:21 |
| DELETE | `/api/v1/lives/{liveId}/moderators/{userId}` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:23 |
| PUT | `/api/v1/lives/{liveId}/moderators/{userId}` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:22 |
| PUT | `/api/v1/lives/{liveId}/monetization` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:24 |
| GET | `/api/v1/lives/{liveId}/overlay-scenes` | live | user | routed (required) | services/go/modules/live/src/modules/overlays/routes/overlays.routes.go:16 |
| POST | `/api/v1/lives/{liveId}/overlay-scenes` | live | user | routed (required) | services/go/modules/live/src/modules/overlays/routes/overlays.routes.go:17 |
| DELETE | `/api/v1/lives/{liveId}/overlay-scenes/{sceneId}` | live | user | routed (required) | services/go/modules/live/src/modules/overlays/routes/overlays.routes.go:20 |
| GET | `/api/v1/lives/{liveId}/overlay-scenes/{sceneId}` | live | user | routed (required) | services/go/modules/live/src/modules/overlays/routes/overlays.routes.go:18 |
| PUT | `/api/v1/lives/{liveId}/overlay-scenes/{sceneId}` | live | user | routed (required) | services/go/modules/live/src/modules/overlays/routes/overlays.routes.go:19 |
| DELETE | `/api/v1/lives/{liveId}/overlay-scenes/{sceneId}/publish` | live | user | routed (required) | services/go/modules/live/src/modules/overlays/routes/overlays.routes.go:22 |
| POST | `/api/v1/lives/{liveId}/overlay-scenes/{sceneId}/publish` | live | user | routed (required) | services/go/modules/live/src/modules/overlays/routes/overlays.routes.go:21 |
| GET | `/api/v1/lives/{liveId}/overlays` | live | user | routed (required) | services/go/modules/live/src/modules/overlays/routes/overlays.routes.go:14 |
| PUT | `/api/v1/lives/{liveId}/overlays` | live | user | routed (required) | services/go/modules/live/src/modules/overlays/routes/overlays.routes.go:15 |
| DELETE | `/api/v1/lives/{liveId}/pinned-comment` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:18 |
| POST | `/api/v1/lives/{liveId}/pins` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:26 |
| GET | `/api/v1/lives/{liveId}/points/me` | live | user | routed (required) | services/go/modules/live/src/modules/points/routes/points.routes.go:14 |
| GET | `/api/v1/lives/{liveId}/products` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:27 |
| POST | `/api/v1/lives/{liveId}/reactions` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:22 |
| PUT | `/api/v1/lives/{liveId}/recording` | live | user | routed (required) | services/go/modules/live/src/modules/studio/routes/studio.routes.go:19 |
| GET | `/api/v1/lives/{liveId}/recordings` | live | user | routed (required) | services/go/modules/live/src/modules/studio/routes/studio.routes.go:18 |
| GET | `/api/v1/lives/{liveId}/room-settings` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:19 |
| PUT | `/api/v1/lives/{liveId}/room-settings` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:20 |
| GET | `/api/v1/lives/{liveId}/safety` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:17 |
| POST | `/api/v1/lives/{liveId}/share` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:23 |
| GET | `/api/v1/lives/{liveId}/stage` | live | user | routed (required) | services/go/modules/live/src/modules/stage/routes/stage.routes.go:14 |
| POST | `/api/v1/lives/{liveId}/start` | live | user | routed (required) | services/go/modules/live/src/modules/sessions/routes/sessions.routes.go:18 |
| DELETE | `/api/v1/lives/{liveId}/stream-key` | live | user | routed (required) | services/go/modules/live/src/modules/studio/routes/studio.routes.go:17 |
| GET | `/api/v1/lives/{liveId}/stream-key` | live | user | routed (required) | services/go/modules/live/src/modules/studio/routes/studio.routes.go:16 |
| POST | `/api/v1/lives/{liveId}/stream-key` | live | user | routed (required) | services/go/modules/live/src/modules/studio/routes/studio.routes.go:15 |
| GET | `/api/v1/lives/{liveId}/viewers` | live | user | routed (required) | services/go/modules/live/src/modules/stage/routes/stage.routes.go:15 |
| DELETE | `/api/v1/lives/{liveId}/viewers/{userId}/ban` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:27 |
| PUT | `/api/v1/lives/{liveId}/viewers/{userId}/ban` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:26 |
| DELETE | `/api/v1/lives/{liveId}/viewers/{userId}/mute` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:25 |
| PUT | `/api/v1/lives/{liveId}/viewers/{userId}/mute` | live | user | routed (required) | services/go/modules/live/src/modules/comments/routes/comments.routes.go:24 |
| GET | `/api/v1/overlay-scenes/{sceneId}` | live | none-in-route (controller may self-check) | routed (optional) | services/go/modules/live/src/modules/overlays/routes/overlays.routes.go:23 |
| GET | `/api/v1/rankings` | live | user | routed (required) | services/go/modules/live/src/modules/points/routes/points.routes.go:16 |
| GET | `/api/v1/media/:mediaId` | media | see controller | routed (required) | services/typescript/media/src/modules/uploads/routes/uploads.routes.ts:14 |
| POST | `/api/v1/media/:mediaId/complete` | media | see controller | routed (required) | services/typescript/media/src/modules/uploads/routes/uploads.routes.ts:13 |
| POST | `/api/v1/media/uploads` | media | see controller | routed (required) | services/typescript/media/src/modules/uploads/routes/uploads.routes.ts:6 |
| DELETE | `/api/v1/media/uploads/:uploadId` | media | see controller | routed (required) | services/typescript/media/src/modules/uploads/routes/uploads.routes.ts:8 |
| GET | `/api/v1/media/uploads/:uploadId` | media | see controller | routed (required) | services/typescript/media/src/modules/uploads/routes/uploads.routes.ts:7 |
| PUT | `/api/v1/media/uploads/:uploadId/chunks/:chunkIndex` | media | see controller | routed (required) | services/typescript/media/src/modules/uploads/routes/uploads.routes.ts:9 |
| GET | `/api/v1/media/uploads/:uploadId/chunks/:chunkIndex/url` | media | see controller | routed (required) | services/typescript/media/src/modules/uploads/routes/uploads.routes.ts:10 |
| POST | `/api/v1/media/uploads/:uploadId/chunks/urls` | media | see controller | routed (required) | services/typescript/media/src/modules/uploads/routes/uploads.routes.ts:11 |
| POST | `/api/v1/media/uploads/:uploadId/complete` | media | see controller | routed (required) | services/typescript/media/src/modules/uploads/routes/uploads.routes.ts:12 |
| GET | `/healthz` | media | see controller | ops endpoint (not routed) | services/typescript/media/src/routes/health.routes.ts:7 |
| GET | `/internal/v1/media/:mediaId` | media | see controller | hidden (internal segment blocked at gateway) | services/typescript/media/src/modules/internal/routes/internal.routes.ts:8 |
| POST | `/internal/v1/media/:mediaId/audio-fingerprint` | media | see controller | hidden (internal segment blocked at gateway) | services/typescript/media/src/modules/internal/routes/internal.routes.ts:12 |
| POST | `/internal/v1/media/:mediaId/complete` | media | see controller | hidden (internal segment blocked at gateway) | services/typescript/media/src/modules/internal/routes/internal.routes.ts:11 |
| POST | `/internal/v1/media/:mediaId/review` | media | see controller | hidden (internal segment blocked at gateway) | services/typescript/media/src/modules/internal/routes/internal.routes.ts:10 |
| POST | `/internal/v1/media/:mediaId/signed-url` | media | see controller | hidden (internal segment blocked at gateway) | services/typescript/media/src/modules/internal/routes/internal.routes.ts:9 |
| POST | `/internal/v1/media/delete` | media | see controller | hidden (internal segment blocked at gateway) | services/typescript/media/src/modules/internal/routes/internal.routes.ts:7 |
| POST | `/internal/v1/media/intents` | media | see controller | hidden (internal segment blocked at gateway) | services/typescript/media/src/modules/internal/routes/internal.routes.ts:6 |
| GET | `/readyz` | media | see controller | ops endpoint (not routed) | services/typescript/media/src/routes/health.routes.ts:8 |
| GET | `/api/v1/admin/coins/price-table` | money | staff | routed (optional) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:17 |
| PUT | `/api/v1/admin/coins/price-table/{packageId}` | money | staff | routed (optional) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:18 |
| GET | `/api/v1/admin/creator-tiers` | money | staff | routed (optional) | services/go/modules/creators/src/modules/creatorProgram/routes/creatorProgram.routes.go:17 |
| PUT | `/api/v1/admin/creator-tiers/{tierId}` | money | staff | routed (optional) | services/go/modules/creators/src/modules/creatorProgram/routes/creatorProgram.routes.go:18 |
| PUT | `/api/v1/admin/creators/{userId}/program` | money | staff | routed (optional) | services/go/modules/creators/src/modules/creatorProgram/routes/creatorProgram.routes.go:19 |
| GET | `/api/v1/admin/disputes` | money | staff | routed (optional) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:26 |
| GET | `/api/v1/admin/disputes/{disputeId}` | money | staff | routed (optional) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:27 |
| POST | `/api/v1/admin/disputes/{disputeId}/messages` | money | staff | routed (optional) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:28 |
| POST | `/api/v1/admin/disputes/{disputeId}/resolve` | money | staff | routed (optional) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:29 |
| GET | `/api/v1/admin/ledger/integrity` | money | staff | routed (optional) | services/go/modules/ledger/src/modules/journal/routes/journal.routes.go:17 |
| POST | `/api/v1/admin/ledger/journal-entries/{entryId}/reversal` | money | staff | routed (optional) | services/go/modules/ledger/src/modules/journal/routes/journal.routes.go:19 |
| GET | `/api/v1/admin/ledger/statement` | money | staff | routed (optional) | services/go/modules/ledger/src/modules/journal/routes/journal.routes.go:18 |
| GET | `/api/v1/admin/orders/{orderId}/escrow` | money | staff | routed (optional) | services/go/modules/escrow/src/modules/escrows/routes/escrows.routes.go:20 |
| POST | `/api/v1/admin/orders/{orderId}/escrow/refund` | money | staff | routed (optional) | services/go/modules/escrow/src/modules/escrows/routes/escrows.routes.go:22 |
| POST | `/api/v1/admin/payments/disputes/{providerDisputeId}/evidence` | money | staff | routed (optional) | services/go/modules/payments/src/modules/connectedAccounts/routes/connectedAccounts.routes.go:29 |
| POST | `/api/v1/admin/payments/payout-accounts/jobs/{jobId}/retry` | money | staff | routed (optional) | services/go/modules/payments/src/modules/connectedAccounts/routes/connectedAccounts.routes.go:24 |
| GET | `/api/v1/admin/payments/payout-accounts/stuck` | money | staff | routed (optional) | services/go/modules/payments/src/modules/connectedAccounts/routes/connectedAccounts.routes.go:23 |
| POST | `/api/v1/admin/payments/payout-accounts/{userId}/verification-prompt` | money | staff | routed (optional) | services/go/modules/payments/src/modules/connectedAccounts/routes/connectedAccounts.routes.go:25 |
| POST | `/api/v1/admin/payments/reconciliations` | money | staff | routed (optional) | services/go/modules/payments/src/modules/reconciliation/routes/reconciliation.routes.go:15 |
| POST | `/api/v1/admin/payouts/run` | money | staff | routed (optional) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:31 |
| GET | `/api/v1/admin/subscriptions/price-table` | money | staff | routed (optional) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:34 |
| PUT | `/api/v1/admin/subscriptions/price-table/{planCode}/{countryCode}` | money | staff | routed (optional) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:35 |
| GET | `/api/v1/admin/wallet/seller-reserves` | money | staff | routed (optional) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:38 |
| DELETE | `/api/v1/admin/wallet/seller-reserves/{sellerUserId}` | money | staff | routed (optional) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:40 |
| PUT | `/api/v1/admin/wallet/seller-reserves/{sellerUserId}` | money | staff | routed (optional) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:39 |
| GET | `/api/v1/admin/withdrawals` | money | staff | routed (optional) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:29 |
| POST | `/api/v1/admin/withdrawals/{withdrawalId}/review` | money | staff | routed (optional) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:30 |
| GET | `/api/v1/ads/balance` | money | user | routed (required) | services/go/modules/wallet/src/modules/adBalances/routes/adBalances.routes.go:13 |
| POST | `/api/v1/ads/balance/refund` | money | user | routed (required) | services/go/modules/wallet/src/modules/adBalances/routes/adBalances.routes.go:14 |
| POST | `/api/v1/ads/balance/top-ups` | money | user | routed (required) | services/go/modules/wallet/src/modules/adBalances/routes/adBalances.routes.go:12 |
| GET | `/api/v1/banks` | money | user | routed (required) | services/go/modules/payments/src/modules/banks/routes/banks.routes.go:14 |
| POST | `/api/v1/banks/resolve-account` | money | user | routed (required) | services/go/modules/payments/src/modules/banks/routes/banks.routes.go:15 |
| GET | `/api/v1/coins/balance` | money | user | routed (required) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:21 |
| POST | `/api/v1/coins/iap/receipts` | money | user | routed (required) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:25 |
| GET | `/api/v1/coins/packages` | money | none-in-route (controller may self-check) | routed (optional) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:19 |
| GET | `/api/v1/coins/packs` | money | none-in-route (controller may self-check) | routed (optional) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:20 |
| POST | `/api/v1/coins/purchases` | money | user | routed (required) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:23 |
| POST | `/api/v1/coins/purchases/{reference}/verify` | money | user | routed (required) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:24 |
| GET | `/api/v1/coins/transactions` | money | user | routed (required) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:22 |
| POST | `/api/v1/coins/transfers` | money | user | routed (required) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:27 |
| GET | `/api/v1/coins/transfers/quote` | money | user | routed (required) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:26 |
| POST | `/api/v1/creators/earnings/convert` | money | user | routed (required) | services/go/modules/wallet/src/modules/coins/routes/coins.routes.go:28 |
| GET | `/api/v1/disputes` | money | user | routed (required) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:19 |
| GET | `/api/v1/disputes/{disputeId}` | money | user | routed (required) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:20 |
| POST | `/api/v1/disputes/{disputeId}/close` | money | user | routed (required) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:22 |
| POST | `/api/v1/disputes/{disputeId}/messages` | money | user | routed (required) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:21 |
| GET | `/api/v1/internal/accounts/{accountId}/deletion-blockers` | money | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:19 |
| POST | `/api/v1/internal/ads/boost-debits` | money | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/wallet/src/modules/adBalances/routes/adBalances.routes.go:16 |
| POST | `/api/v1/internal/ads/boost-refunds` | money | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/wallet/src/modules/adBalances/routes/adBalances.routes.go:17 |
| POST | `/api/v1/internal/ads/spend-batches` | money | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/wallet/src/modules/adBalances/routes/adBalances.routes.go:15 |
| GET | `/api/v1/internal/entitlements/{userId}` | money | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:33 |
| POST | `/api/v1/internal/order-groups/{orderGroupId}/refunds` | money | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/escrow/src/modules/escrows/routes/escrows.routes.go:21 |
| GET | `/api/v1/internal/stores/{storeId}/disputes` | money | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:23 |
| GET | `/api/v1/internal/stores/{storeId}/disputes/{disputeId}` | money | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:24 |
| POST | `/api/v1/internal/stores/{storeId}/disputes/{disputeId}/responses` | money | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:25 |
| POST | `/api/v1/orders/{orderId}/disputes` | money | user | routed (required) | services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go:18 |
| GET | `/api/v1/orders/{orderId}/escrow` | money | user | routed (required) | services/go/modules/escrow/src/modules/escrows/routes/escrows.routes.go:18 |
| GET | `/api/v1/payments/channels` | money | none-in-route (controller may self-check) | routed (required) | services/go/modules/payments/src/modules/checkoutPayments/routes/checkoutPayments.routes.go:16 |
| GET | `/api/v1/payments/connected-accounts/me` | money | user | routed (required) | services/go/modules/payments/src/modules/connectedAccounts/routes/connectedAccounts.routes.go:18 |
| POST | `/api/v1/payments/connected-accounts/me` | money | user | routed (required) | services/go/modules/payments/src/modules/connectedAccounts/routes/connectedAccounts.routes.go:19 |
| POST | `/api/v1/payments/connected-accounts/me/onboarding-link` | money | user | routed (required) | services/go/modules/payments/src/modules/connectedAccounts/routes/connectedAccounts.routes.go:20 |
| POST | `/api/v1/payments/initialize` | money | user | routed (required) | services/go/modules/payments/src/modules/checkoutPayments/routes/checkoutPayments.routes.go:15 |
| POST | `/api/v1/payments/orders/{orderId}/verify` | money | user | routed (required) | services/go/modules/payments/src/modules/checkoutPayments/routes/checkoutPayments.routes.go:19 |
| GET | `/api/v1/payments/payout-fees` | money | none-in-route (controller may self-check) | routed (required) | services/go/modules/payments/src/modules/payoutOnboarding/routes/payoutOnboarding.routes.go:21 |
| GET | `/api/v1/payments/payout-onboarding/me` | money | user | routed (required) | services/go/modules/payments/src/modules/payoutOnboarding/routes/payoutOnboarding.routes.go:14 |
| PUT | `/api/v1/payments/payout-onboarding/me/bank` | money | user | routed (required) | services/go/modules/payments/src/modules/payoutOnboarding/routes/payoutOnboarding.routes.go:18 |
| PUT | `/api/v1/payments/payout-onboarding/me/business` | money | user | routed (required) | services/go/modules/payments/src/modules/payoutOnboarding/routes/payoutOnboarding.routes.go:16 |
| POST | `/api/v1/payments/payout-onboarding/me/document-link` | money | user | routed (required) | services/go/modules/payments/src/modules/payoutOnboarding/routes/payoutOnboarding.routes.go:20 |
| PUT | `/api/v1/payments/payout-onboarding/me/identity` | money | user | routed (required) | services/go/modules/payments/src/modules/payoutOnboarding/routes/payoutOnboarding.routes.go:15 |
| POST | `/api/v1/payments/payout-onboarding/me/resolve` | money | user | routed (required) | services/go/modules/payments/src/modules/payoutOnboarding/routes/payoutOnboarding.routes.go:17 |
| POST | `/api/v1/payments/payout-onboarding/me/retry` | money | user | routed (required) | services/go/modules/payments/src/modules/payoutOnboarding/routes/payoutOnboarding.routes.go:19 |
| POST | `/api/v1/payments/refunds/{refundId}/bank-destination` | money | user | routed (required) | services/go/modules/payments/src/modules/savedCards/routes/savedCards.routes.go:17 |
| POST | `/api/v1/payments/saved-cards/charges` | money | user | routed (required) | services/go/modules/payments/src/modules/savedCards/routes/savedCards.routes.go:16 |
| POST | `/api/v1/payments/saved-cards/setups` | money | user | routed (required) | services/go/modules/payments/src/modules/savedCards/routes/savedCards.routes.go:14 |
| POST | `/api/v1/payments/saved-cards/setups/{reference}/complete` | money | user | routed (required) | services/go/modules/payments/src/modules/savedCards/routes/savedCards.routes.go:15 |
| POST | `/api/v1/payments/store-notifications/{store}` | money | none-in-route (controller may self-check) | routed (required) | services/go/modules/payments/src/modules/webhooks/routes/webhooks.routes.go:15 |
| POST | `/api/v1/payments/subscriptions/checkout` | money | user | routed (required) | services/go/modules/payments/src/modules/connectedAccounts/routes/connectedAccounts.routes.go:28 |
| POST | `/api/v1/payments/webhooks/{provider}` | money | none-in-route (controller may self-check) | routed (required) | services/go/modules/payments/src/modules/webhooks/routes/webhooks.routes.go:14 |
| GET | `/api/v1/pricing/creator-subscription-bands` | money | none-in-route (controller may self-check) | routed (optional) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:20 |
| GET | `/api/v1/pricing/plans` | money | none-in-route (controller may self-check) | routed (optional) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:19 |
| GET | `/api/v1/pricing/region` | money | none-in-route (controller may self-check) | routed (optional) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:18 |
| POST | `/api/v1/seller/subscription/checkout` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:25 |
| GET | `/api/v1/seller/subscription/plans` | money | none-in-route (controller may self-check) | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:17 |
| GET | `/api/v1/seller/subscription/trial` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:23 |
| POST | `/api/v1/seller/subscription/trial/checkout` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:26 |
| POST | `/api/v1/subscriptions/checkout` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:24 |
| GET | `/api/v1/subscriptions/me` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:21 |
| GET | `/api/v1/subscriptions/offer` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:22 |
| GET | `/api/v1/subscriptions/plans` | money | none-in-route (controller may self-check) | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:16 |
| POST | `/api/v1/subscriptions/store-receipts` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:32 |
| POST | `/api/v1/subscriptions/{subscriptionId}/cancel` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:27 |
| POST | `/api/v1/subscriptions/{subscriptionId}/change-plan` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:28 |
| POST | `/api/v1/subscriptions/{subscriptionId}/pay-now` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:29 |
| GET | `/api/v1/subscriptions/{subscriptionId}/periods` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:30 |
| GET | `/api/v1/subscriptions/{subscriptionId}/upcoming-charge` | money | user | routed (required) | services/go/modules/subscriptions/src/modules/billing/routes/billing.routes.go:31 |
| GET | `/api/v1/wallets/me` | money | user | routed (required) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:20 |
| GET | `/api/v1/wallets/me/escrow-holds` | money | user | routed (required) | services/go/modules/escrow/src/modules/escrows/routes/escrows.routes.go:19 |
| GET | `/api/v1/wallets/me/payout-accounts` | money | user | routed (required) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:22 |
| POST | `/api/v1/wallets/me/payout-accounts` | money | user | routed (required) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:23 |
| DELETE | `/api/v1/wallets/me/payout-accounts/{payoutAccountId}` | money | user | routed (required) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:24 |
| GET | `/api/v1/wallets/me/transactions` | money | user | routed (required) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:21 |
| GET | `/api/v1/wallets/me/withdrawals` | money | user | routed (required) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:26 |
| POST | `/api/v1/wallets/me/withdrawals` | money | user | routed (required) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:27 |
| GET | `/api/v1/wallets/me/withdrawals/quote` | money | user | routed (required) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:25 |
| POST | `/api/v1/wallets/me/withdrawals/{withdrawalId}/cancel` | money | user | routed (required) | services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:28 |
| POST | `/internal/v1/payments/domain-events` | money | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/payments/src/modules/connectedAccounts/routes/connectedAccounts.routes.go:27 |
| POST | `/webhooks/store-notifications/{store}` | money | none-in-route (controller may self-check) | routed (optional) | services/go/modules/payments/src/modules/webhooks/routes/webhooks.routes.go:13 |
| POST | `/webhooks/{provider}` | money | none-in-route (controller may self-check) | routed (optional) | services/go/modules/payments/src/modules/webhooks/routes/webhooks.routes.go:12 |
| GET | `/api/v1/search` | search | see controller | routed (optional) | services/typescript/search/src/modules/search/routes/search.routes.ts:6 |
| DELETE | `/api/v1/search/recent` | search | see controller | routed (required) | services/typescript/search/src/modules/recentSearches/routes/recentSearches.routes.ts:9 |
| GET | `/api/v1/search/recent` | search | see controller | routed (required) | services/typescript/search/src/modules/recentSearches/routes/recentSearches.routes.ts:6 |
| POST | `/api/v1/search/recent` | search | see controller | routed (required) | services/typescript/search/src/modules/recentSearches/routes/recentSearches.routes.ts:7 |
| DELETE | `/api/v1/search/recent/:id` | search | see controller | routed (required) | services/typescript/search/src/modules/recentSearches/routes/recentSearches.routes.ts:8 |
| GET | `/api/v1/search/suggest` | search | see controller | routed (optional) | services/typescript/search/src/modules/search/routes/search.routes.ts:7 |
| GET | `/healthz` | search | see controller | ops endpoint (not routed) | services/typescript/search/src/routes/index.ts:23 |
| GET | `/internal/search/event-types` | search | see controller | hidden (internal segment blocked at gateway) | services/typescript/search/src/modules/indexing/routes/indexing.routes.ts:7 |
| POST | `/internal/search/events` | search | see controller | hidden (internal segment blocked at gateway) | services/typescript/search/src/modules/indexing/routes/indexing.routes.ts:6 |
| GET | `/readyz` | search | see controller | ops endpoint (not routed) | services/typescript/search/src/routes/index.ts:24 |
| GET | `/api/v1/chat/content` | social | see controller | routed (required) | services/typescript/social/src/modules/messages/routes/messages.routes.ts:15 |
| GET | `/api/v1/chat/settings` | social | see controller | routed (required) | services/typescript/social/src/modules/chatSettings/routes/chatSettings.routes.ts:6 |
| PATCH | `/api/v1/chat/settings` | social | see controller | routed (required) | services/typescript/social/src/modules/chatSettings/routes/chatSettings.routes.ts:7 |
| POST | `/api/v1/chat/shares` | social | see controller | routed (required) | services/typescript/social/src/modules/messages/routes/messages.routes.ts:14 |
| GET | `/api/v1/clips` | social | see controller | routed (optional) | services/typescript/social/src/modules/feeds/routes/feeds.routes.ts:10 |
| DELETE | `/api/v1/comments/:commentId` | social | see controller | routed (optional) | services/typescript/social/src/modules/comments/routes/comments.routes.ts:12 |
| GET | `/api/v1/comments/:commentId` | social | see controller | routed (optional) | services/typescript/social/src/modules/comments/routes/comments.routes.ts:9 |
| DELETE | `/api/v1/comments/:commentId/like` | social | see controller | routed (optional) | services/typescript/social/src/modules/comments/routes/comments.routes.ts:14 |
| POST | `/api/v1/comments/:commentId/like` | social | see controller | routed (optional) | services/typescript/social/src/modules/comments/routes/comments.routes.ts:13 |
| GET | `/api/v1/comments/:commentId/replies` | social | see controller | routed (optional) | services/typescript/social/src/modules/comments/routes/comments.routes.ts:10 |
| GET | `/api/v1/comments/:commentId/thread` | social | see controller | routed (optional) | services/typescript/social/src/modules/comments/routes/comments.routes.ts:11 |
| GET | `/api/v1/conversations/:conversationId/messages` | social | see controller | routed (required) | services/typescript/social/src/modules/messages/routes/messages.routes.ts:6 |
| POST | `/api/v1/conversations/:conversationId/messages` | social | see controller | routed (required) | services/typescript/social/src/modules/messages/routes/messages.routes.ts:7 |
| POST | `/api/v1/conversations/:conversationId/streak/celebrated` | social | see controller | routed (required) | services/typescript/social/src/modules/streaks/routes/streaks.routes.ts:7 |
| POST | `/api/v1/conversations/:conversationId/streak/restore` | social | see controller | routed (required) | services/typescript/social/src/modules/streaks/routes/streaks.routes.ts:6 |
| GET | `/api/v1/explore/categories` | social | see controller | routed (optional) | services/typescript/social/src/modules/explore/routes/explore.routes.ts:6 |
| GET | `/api/v1/explore/headlines` | social | see controller | routed (optional) | services/typescript/social/src/modules/explore/routes/explore.routes.ts:8 |
| GET | `/api/v1/explore/posts-for-you` | social | see controller | routed (optional) | services/typescript/social/src/modules/explore/routes/explore.routes.ts:10 |
| GET | `/api/v1/explore/trends` | social | see controller | routed (optional) | services/typescript/social/src/modules/explore/routes/explore.routes.ts:7 |
| GET | `/api/v1/explore/who-to-follow` | social | see controller | routed (optional) | services/typescript/social/src/modules/explore/routes/explore.routes.ts:9 |
| POST | `/api/v1/feeds/feedback` | social | see controller | routed (optional) | services/typescript/social/src/modules/feeds/routes/feeds.routes.ts:11 |
| GET | `/api/v1/feeds/following` | social | see controller | routed (optional) | services/typescript/social/src/modules/feeds/routes/feeds.routes.ts:8 |
| GET | `/api/v1/feeds/for-you` | social | see controller | routed (optional) | services/typescript/social/src/modules/feeds/routes/feeds.routes.ts:6 |
| GET | `/api/v1/feeds/popular` | social | see controller | routed (optional) | services/typescript/social/src/modules/feeds/routes/feeds.routes.ts:7 |
| GET | `/api/v1/feeds/suggested-clips` | social | see controller | routed (optional) | services/typescript/social/src/modules/feeds/routes/feeds.routes.ts:9 |
| POST | `/api/v1/follow-requests/:requestId/accept` | social | see controller | routed (required) | services/typescript/social/src/modules/follows/routes/follows.routes.ts:12 |
| POST | `/api/v1/follow-requests/:requestId/reject` | social | see controller | routed (required) | services/typescript/social/src/modules/follows/routes/follows.routes.ts:13 |
| GET | `/api/v1/internal/accounts/:accountId/activity-counts` | social | see controller | hidden (internal segment blocked at gateway) | services/typescript/social/src/modules/internalSources/routes/internalSources.routes.ts:12 |
| GET | `/api/v1/internal/ad-sources/content` | social | see controller | hidden (internal segment blocked at gateway) | services/typescript/social/src/modules/internalSources/routes/internalSources.routes.ts:8 |
| GET | `/api/v1/internal/audience-sources/accounts/:accountId/engagers` | social | see controller | hidden (internal segment blocked at gateway) | services/typescript/social/src/modules/internalSources/routes/internalSources.routes.ts:10 |
| GET | `/api/v1/internal/audience-sources/accounts/:accountId/followers` | social | see controller | hidden (internal segment blocked at gateway) | services/typescript/social/src/modules/internalSources/routes/internalSources.routes.ts:9 |
| GET | `/api/v1/internal/digests/:kind` | social | see controller | hidden (internal segment blocked at gateway) | services/typescript/social/src/modules/digests/routes/digests.routes.ts:6 |
| GET | `/api/v1/internal/moderation/targets/:type/:id` | social | see controller | hidden (internal segment blocked at gateway) | services/typescript/social/src/modules/internalSources/routes/internalSources.routes.ts:7 |
| GET | `/api/v1/internal/save-counts` | social | see controller | hidden (internal segment blocked at gateway) | services/typescript/social/src/modules/internalSources/routes/internalSources.routes.ts:11 |
| GET | `/api/v1/internal/search-sources/:collection/:id` | social | see controller | hidden (internal segment blocked at gateway) | services/typescript/social/src/modules/internalSources/routes/internalSources.routes.ts:6 |
| GET | `/api/v1/link-previews/resolve` | social | see controller | routed (required) | services/typescript/social/src/modules/linkPreviews/routes/linkPreviews.routes.ts:6 |
| GET | `/api/v1/me/content-preferences` | social | see controller | routed (required) | services/typescript/social/src/modules/contentPreferences/routes/contentPreferences.routes.ts:6 |
| PUT | `/api/v1/me/content-preferences` | social | see controller | routed (required) | services/typescript/social/src/modules/contentPreferences/routes/contentPreferences.routes.ts:7 |
| GET | `/api/v1/me/tagging-settings` | social | see controller | routed (required) | services/typescript/social/src/modules/posts/routes/postTags.routes.ts:10 |
| PUT | `/api/v1/me/tagging-settings` | social | see controller | routed (required) | services/typescript/social/src/modules/posts/routes/postTags.routes.ts:11 |
| GET | `/api/v1/mentions/candidates` | social | see controller | routed (optional) | services/typescript/social/src/modules/mentions/routes/mentions.routes.ts:6 |
| POST | `/api/v1/mentions/resolve` | social | see controller | routed (optional) | services/typescript/social/src/modules/mentions/routes/mentions.routes.ts:7 |
| POST | `/api/v1/messages/:messageId/live-location/stop` | social | see controller | routed (required) | services/typescript/social/src/modules/messages/routes/messages.routes.ts:11 |
| PATCH | `/api/v1/messages/:messageId/location` | social | see controller | routed (required) | services/typescript/social/src/modules/messages/routes/messages.routes.ts:10 |
| POST | `/api/v1/messages/:messageId/poll-votes` | social | see controller | routed (required) | services/typescript/social/src/modules/messages/routes/messages.routes.ts:12 |
| POST | `/api/v1/messages/:messageId/reactions` | social | see controller | routed (required) | services/typescript/social/src/modules/messages/routes/messages.routes.ts:8 |
| DELETE | `/api/v1/messages/:messageId/reactions/:emoji` | social | see controller | routed (required) | services/typescript/social/src/modules/messages/routes/messages.routes.ts:9 |
| POST | `/api/v1/posts` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:6 |
| DELETE | `/api/v1/posts/:postId` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:8 |
| GET | `/api/v1/posts/:postId` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:7 |
| GET | `/api/v1/posts/:postId/analytics` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:11 |
| GET | `/api/v1/posts/:postId/comments` | social | see controller | routed (optional) | services/typescript/social/src/modules/comments/routes/comments.routes.ts:6 |
| POST | `/api/v1/posts/:postId/comments` | social | see controller | routed (optional) | services/typescript/social/src/modules/comments/routes/comments.routes.ts:7 |
| POST | `/api/v1/posts/:postId/impressions` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:9 |
| DELETE | `/api/v1/posts/:postId/like` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:13 |
| POST | `/api/v1/posts/:postId/like` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:12 |
| POST | `/api/v1/posts/:postId/link-preview` | social | see controller | routed (optional) | services/typescript/social/src/modules/linkPreviews/routes/linkPreviews.routes.ts:7 |
| POST | `/api/v1/posts/:postId/profile-visits` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:10 |
| GET | `/api/v1/posts/:postId/quotes` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/postAudience.routes.ts:8 |
| PATCH | `/api/v1/posts/:postId/reply-settings` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/postAudience.routes.ts:6 |
| POST | `/api/v1/posts/:postId/repost` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:15 |
| PATCH | `/api/v1/posts/:postId/sensitivity` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/postAudience.routes.ts:7 |
| POST | `/api/v1/posts/:postId/share` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:14 |
| GET | `/api/v1/posts/:postId/tagged-users` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/postTags.routes.ts:7 |
| PUT | `/api/v1/posts/:postId/tags` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/postTags.routes.ts:8 |
| DELETE | `/api/v1/posts/:postId/tags/me` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/postTags.routes.ts:9 |
| GET | `/api/v1/posts/:postId/thread` | social | see controller | routed (optional) | services/typescript/social/src/modules/comments/routes/comments.routes.ts:8 |
| POST | `/api/v1/reports` | social | see controller | routed (required) | services/typescript/social/src/modules/reports/routes/reports.routes.ts:6 |
| DELETE | `/api/v1/saves` | social | see controller | routed (required) | services/typescript/social/src/modules/saves/routes/saves.routes.ts:7 |
| GET | `/api/v1/saves` | social | see controller | routed (required) | services/typescript/social/src/modules/saves/routes/saves.routes.ts:8 |
| POST | `/api/v1/saves` | social | see controller | routed (required) | services/typescript/social/src/modules/saves/routes/saves.routes.ts:6 |
| PATCH | `/api/v1/saves/:saveId` | social | see controller | routed (required) | services/typescript/social/src/modules/saves/routes/saves.routes.ts:11 |
| GET | `/api/v1/saves/collections` | social | see controller | routed (required) | services/typescript/social/src/modules/saves/routes/saves.routes.ts:9 |
| POST | `/api/v1/saves/collections` | social | see controller | routed (required) | services/typescript/social/src/modules/saves/routes/saves.routes.ts:10 |
| GET | `/api/v1/search/people` | social | see controller | routed (optional) | services/typescript/social/src/modules/search/routes/search.routes.ts:6 |
| GET | `/api/v1/sounds` | social | see controller | routed (optional) | services/typescript/social/src/modules/sounds/routes/sounds.routes.ts:6 |
| POST | `/api/v1/sounds` | social | see controller | routed (optional) | services/typescript/social/src/modules/sounds/routes/sounds.routes.ts:7 |
| GET | `/api/v1/sounds/:soundId` | social | see controller | routed (optional) | services/typescript/social/src/modules/sounds/routes/sounds.routes.ts:10 |
| PATCH | `/api/v1/sounds/:soundId` | social | see controller | routed (optional) | services/typescript/social/src/modules/sounds/routes/sounds.routes.ts:11 |
| GET | `/api/v1/sounds/:soundId/clips` | social | see controller | routed (optional) | services/typescript/social/src/modules/sounds/routes/sounds.routes.ts:12 |
| DELETE | `/api/v1/sounds/:soundId/save` | social | see controller | routed (optional) | services/typescript/social/src/modules/sounds/routes/sounds.routes.ts:14 |
| POST | `/api/v1/sounds/:soundId/save` | social | see controller | routed (optional) | services/typescript/social/src/modules/sounds/routes/sounds.routes.ts:13 |
| GET | `/api/v1/sounds/saved` | social | see controller | routed (optional) | services/typescript/social/src/modules/sounds/routes/sounds.routes.ts:9 |
| GET | `/api/v1/sounds/trending` | social | see controller | routed (optional) | services/typescript/social/src/modules/sounds/routes/sounds.routes.ts:8 |
| POST | `/api/v1/stories` | social | see controller | routed (required) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:17 |
| POST | `/api/v1/stories/:storyId/replies` | social | see controller | routed (required) | services/typescript/social/src/modules/messages/routes/messages.routes.ts:13 |
| POST | `/api/v1/stories/:storyId/seen` | social | see controller | routed (required) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:19 |
| GET | `/api/v1/stories/tray` | social | see controller | routed (required) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:18 |
| GET | `/api/v1/tags/candidates` | social | see controller | routed (required) | services/typescript/social/src/modules/posts/routes/postTags.routes.ts:6 |
| DELETE | `/api/v1/users/:userId/block` | social | see controller | routed (required) | services/typescript/social/src/modules/blocks/routes/blocks.routes.ts:7 |
| POST | `/api/v1/users/:userId/block` | social | see controller | routed (required) | services/typescript/social/src/modules/blocks/routes/blocks.routes.ts:6 |
| DELETE | `/api/v1/users/:userId/follow` | social | see controller | routed (required) | services/typescript/social/src/modules/follows/routes/follows.routes.ts:7 |
| POST | `/api/v1/users/:userId/follow` | social | see controller | routed (required) | services/typescript/social/src/modules/follows/routes/follows.routes.ts:6 |
| GET | `/api/v1/users/:userId/follow-status` | social | see controller | routed (optional) | services/typescript/social/src/modules/follows/routes/follows.routes.ts:10 |
| GET | `/api/v1/users/:userId/followers` | social | see controller | routed (optional) | services/typescript/social/src/modules/follows/routes/follows.routes.ts:8 |
| GET | `/api/v1/users/:userId/following` | social | see controller | routed (optional) | services/typescript/social/src/modules/follows/routes/follows.routes.ts:9 |
| GET | `/api/v1/users/:userId/posts` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:16 |
| GET | `/api/v1/users/:userId/stories` | social | see controller | routed (optional) | services/typescript/social/src/modules/posts/routes/posts.routes.ts:20 |
| GET | `/api/v1/users/me/blocked` | social | see controller | routed (required) | services/typescript/social/src/modules/blocks/routes/blocks.routes.ts:8 |
| GET | `/api/v1/users/me/follow-requests` | social | see controller | routed (required) | services/typescript/social/src/modules/follows/routes/follows.routes.ts:11 |
| GET | `/healthz` | social | see controller | ops endpoint (not routed) | services/typescript/social/src/routes/health.routes.ts:7 |
| GET | `/readyz` | social | see controller | ops endpoint (not routed) | services/typescript/social/src/routes/health.routes.ts:8 |
| GET | `/api/v1/admin/help/auto-topics` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:24 |
| GET | `/api/v1/admin/help/categories` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:12 |
| POST | `/api/v1/admin/help/categories` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:13 |
| DELETE | `/api/v1/admin/help/categories/:categoryId` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:15 |
| PUT | `/api/v1/admin/help/categories/:categoryId` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:14 |
| GET | `/api/v1/admin/help/settings` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:25 |
| PUT | `/api/v1/admin/help/settings` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:26 |
| GET | `/api/v1/admin/help/topics` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:16 |
| POST | `/api/v1/admin/help/topics` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:17 |
| DELETE | `/api/v1/admin/help/topics/:topicId` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:20 |
| GET | `/api/v1/admin/help/topics/:topicId` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:18 |
| PUT | `/api/v1/admin/help/topics/:topicId` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:19 |
| POST | `/api/v1/admin/help/topics/:topicId/merge` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:23 |
| POST | `/api/v1/admin/help/topics/:topicId/publish` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:21 |
| POST | `/api/v1/admin/help/topics/:topicId/unpublish` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:22 |
| GET | `/api/v1/admin/support/agents` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:29 |
| GET | `/api/v1/admin/support/chats` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:30 |
| GET | `/api/v1/admin/support/chats/:chatId` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:31 |
| POST | `/api/v1/admin/support/chats/:chatId/claim` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:32 |
| POST | `/api/v1/admin/support/chats/:chatId/end` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:34 |
| POST | `/api/v1/admin/support/chats/:chatId/messages` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:33 |
| GET | `/api/v1/admin/support/macros` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:35 |
| POST | `/api/v1/admin/support/macros` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:36 |
| DELETE | `/api/v1/admin/support/macros/:macroId` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:38 |
| PUT | `/api/v1/admin/support/macros/:macroId` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:37 |
| GET | `/api/v1/admin/support/tickets` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:24 |
| GET | `/api/v1/admin/support/tickets/:ticketId` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:25 |
| POST | `/api/v1/admin/support/tickets/:ticketId/assign` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:28 |
| POST | `/api/v1/admin/support/tickets/:ticketId/replies` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:26 |
| POST | `/api/v1/admin/support/tickets/:ticketId/status` | support | see controller | routed (optional) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:27 |
| GET | `/api/v1/help/categories` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:7 |
| GET | `/api/v1/help/categories/:categorySlug` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:8 |
| GET | `/api/v1/help/topics` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:9 |
| POST | `/api/v1/help/topics/:topicId/votes` | support | see controller | routed (required) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:11 |
| GET | `/api/v1/help/topics/:topicSlug` | support | see controller | routed (optional) | services/typescript/support/src/modules/helpContent/routes/helpContent.routes.ts:10 |
| GET | `/api/v1/support/tickets` | support | see controller | routed (required) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:17 |
| POST | `/api/v1/support/tickets` | support | see controller | routed (required) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:18 |
| GET | `/api/v1/support/tickets/:ticketId` | support | see controller | routed (required) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:20 |
| POST | `/api/v1/support/tickets/:ticketId/messages` | support | see controller | routed (required) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:21 |
| POST | `/api/v1/support/tickets/:ticketId/rating` | support | see controller | routed (required) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:23 |
| POST | `/api/v1/support/tickets/:ticketId/read` | support | see controller | routed (required) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:22 |
| GET | `/api/v1/support/tickets/unread-count` | support | see controller | routed (required) | services/typescript/support/src/modules/tickets/routes/tickets.routes.ts:19 |
| GET | `/healthz` | support | see controller | ops endpoint (not routed) | services/typescript/support/src/routes/index.ts:38 |
| POST | `/internal/support/auto-faq/run` | support | see controller | hidden (internal segment blocked at gateway) | services/typescript/support/src/routes/index.ts:47 |
| GET | `/readyz` | support | see controller | ops endpoint (not routed) | services/typescript/support/src/routes/index.ts:39 |
| GET | `/api/v1/account/status` | trust | user | routed (required) | services/go/modules/moderation/src/modules/accountHealth/routes/accountHealth.routes.go:18 |
| POST | `/api/v1/account/status/strikes/{strikeId}/appeal` | trust | user | routed (required) | services/go/modules/moderation/src/modules/accountHealth/routes/accountHealth.routes.go:19 |
| GET | `/api/v1/admin/account-health/{accountId}` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/accountHealth/routes/accountHealth.routes.go:20 |
| GET | `/api/v1/admin/chat-reports` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/chatReports/routes/chatReports.routes.go:20 |
| GET | `/api/v1/admin/chat-reports/retention` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/chatReports/routes/chatReports.routes.go:21 |
| PUT | `/api/v1/admin/chat-reports/retention` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/chatReports/routes/chatReports.routes.go:22 |
| GET | `/api/v1/admin/chat-reports/{reportId}` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/chatReports/routes/chatReports.routes.go:23 |
| POST | `/api/v1/admin/chat-reports/{reportId}/actions` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/chatReports/routes/chatReports.routes.go:24 |
| GET | `/api/v1/admin/copyright-claims` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:23 |
| GET | `/api/v1/admin/copyright-claims/{claimId}` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:24 |
| POST | `/api/v1/admin/copyright-claims/{claimId}/audio-match` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:19 |
| POST | `/api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/accept` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:28 |
| POST | `/api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/court-action` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:30 |
| POST | `/api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/reject` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:29 |
| POST | `/api/v1/admin/copyright-claims/{claimId}/reject` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:26 |
| POST | `/api/v1/admin/copyright-claims/{claimId}/request-info` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:27 |
| POST | `/api/v1/admin/copyright-claims/{claimId}/uphold` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:25 |
| GET | `/api/v1/admin/copyright-policy` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:18 |
| PUT | `/api/v1/admin/copyright-policy` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:20 |
| GET | `/api/v1/admin/ip-claims` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/ipClaims/routes/ipClaims.routes.go:21 |
| GET | `/api/v1/admin/ip-claims/{claimId}` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/ipClaims/routes/ipClaims.routes.go:22 |
| POST | `/api/v1/admin/ip-claims/{claimId}/reject` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/ipClaims/routes/ipClaims.routes.go:24 |
| POST | `/api/v1/admin/ip-claims/{claimId}/request-info` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/ipClaims/routes/ipClaims.routes.go:25 |
| POST | `/api/v1/admin/ip-claims/{claimId}/uphold` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/ipClaims/routes/ipClaims.routes.go:23 |
| GET | `/api/v1/admin/live-incidents` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/liveSafety/routes/liveSafety.routes.go:18 |
| GET | `/api/v1/admin/live-incidents/{incidentId}` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/liveSafety/routes/liveSafety.routes.go:19 |
| POST | `/api/v1/admin/live-incidents/{incidentId}/actions` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/liveSafety/routes/liveSafety.routes.go:20 |
| POST | `/api/v1/admin/live-incidents/{incidentId}/end-and-suspend` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/liveSafety/routes/liveSafety.routes.go:21 |
| GET | `/api/v1/admin/reports` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/contentReports/routes/contentReports.routes.go:16 |
| GET | `/api/v1/admin/reports/{reportId}` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/contentReports/routes/contentReports.routes.go:17 |
| POST | `/api/v1/admin/reports/{reportId}/actions` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/contentReports/routes/contentReports.routes.go:18 |
| POST | `/api/v1/admin/reports/{reportId}/suspend-author` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/contentReports/routes/contentReports.routes.go:19 |
| GET | `/api/v1/admin/security/cases` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/accessSecurity/routes/accessSecurity.routes.go:23 |
| GET | `/api/v1/admin/security/cases/{caseId}` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/accessSecurity/routes/accessSecurity.routes.go:24 |
| POST | `/api/v1/admin/security/cases/{caseId}/decide` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/accessSecurity/routes/accessSecurity.routes.go:25 |
| GET | `/api/v1/admin/strike-appeals` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/accountHealth/routes/accountHealth.routes.go:21 |
| POST | `/api/v1/admin/strike-appeals/{strikeId}/overturn` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/accountHealth/routes/accountHealth.routes.go:23 |
| POST | `/api/v1/admin/strike-appeals/{strikeId}/uphold` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/accountHealth/routes/accountHealth.routes.go:22 |
| GET | `/api/v1/admin/suspensions/cases` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/suspensionCases/routes/suspensionCases.routes.go:16 |
| GET | `/api/v1/admin/suspensions/cases/{caseId}` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/suspensionCases/routes/suspensionCases.routes.go:17 |
| POST | `/api/v1/admin/suspensions/cases/{caseId}/approve` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/suspensionCases/routes/suspensionCases.routes.go:18 |
| POST | `/api/v1/admin/suspensions/cases/{caseId}/dismiss` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/suspensionCases/routes/suspensionCases.routes.go:19 |
| POST | `/api/v1/admin/suspensions/cases/{caseId}/escalate` | trust | staff | routed (optional) | services/go/modules/moderation/src/modules/suspensionCases/routes/suspensionCases.routes.go:20 |
| POST | `/api/v1/copyright/claims` | trust | user | routed (required) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:21 |
| POST | `/api/v1/copyright/claims/{claimId}/counter-notices` | trust | user | routed (required) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:22 |
| GET | `/api/v1/internal/accounts/{accountId}/health` | trust | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/accountHealth/routes/accountHealth.routes.go:24 |
| GET | `/api/v1/internal/accounts/{accountId}/strikes` | trust | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/strikes/routes/strikes.routes.go:14 |
| POST | `/api/v1/internal/accounts/{accountId}/strikes` | trust | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/strikes/routes/strikes.routes.go:15 |
| PUT | `/api/v1/internal/copyright-claims/{claimId}/audio-matches` | trust | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/copyrightClaims/routes/copyrightClaims.routes.go:31 |
| POST | `/api/v1/internal/ip-claims` | trust | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/ipClaims/routes/ipClaims.routes.go:19 |
| POST | `/api/v1/internal/security/access-violations` | trust | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/accessSecurity/routes/accessSecurity.routes.go:18 |
| GET | `/api/v1/internal/security/accounts/{accountId}/challenge-state` | trust | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/accessSecurity/routes/accessSecurity.routes.go:21 |
| POST | `/api/v1/internal/security/bot-scores` | trust | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/accessSecurity/routes/accessSecurity.routes.go:20 |
| POST | `/api/v1/internal/security/challenges` | trust | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/accessSecurity/routes/accessSecurity.routes.go:19 |
| POST | `/api/v1/internal/strikes/counts` | trust | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/strikes/routes/strikes.routes.go:16 |
| POST | `/api/v1/internal/strikes/{strikeId}/revoke` | trust | internal-token | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/strikes/routes/strikes.routes.go:17 |
| POST | `/api/v1/internal/suspension-cases` | trust | none-in-route (controller may self-check) | hidden (internal segment blocked at gateway) | services/go/modules/moderation/src/modules/suspensionCases/routes/suspensionCases.routes.go:15 |
| POST | `/api/v1/ip-claims/{claimId}/response` | trust | user | routed (required) | services/go/modules/moderation/src/modules/ipClaims/routes/ipClaims.routes.go:20 |
| POST | `/api/v1/live-safety/{liveId}/appeal` | trust | user | routed (required) | services/go/modules/moderation/src/modules/liveSafety/routes/liveSafety.routes.go:22 |
| POST | `/api/v1/reports` | trust | user | UPSTREAM MISMATCH (gateway->social) | services/go/modules/moderation/src/modules/chatReports/routes/chatReports.routes.go:18 |
| GET | `/api/v1/reports/me` | trust | user | routed (required) | services/go/modules/moderation/src/modules/chatReports/routes/chatReports.routes.go:19 |
| POST | `/api/v1/security/client-signals` | trust | user | routed (required) | services/go/modules/moderation/src/modules/accessSecurity/routes/accessSecurity.routes.go:22 |
