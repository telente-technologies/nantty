# React Native ↔ Kotlin Android commerce and wallet parity

**Audit date:** 2026-11-04  
**Scope:** Cart, checkout, payment, buyer order history/detail/disputes, seller order flow, and wallet.  
**Method:** Source inspection of React Native screens/services/types, Kotlin Compose screens/repositories/routes, and Go HTTP route/DTO contracts. This is a static source audit: no live API, account, payment, or production data was used.

## Executive result

Parity is partial. Android can browse Mart, add a selected product variant, list buyer orders, open buyer-order detail, and view wallet summary/transactions/escrow holds. Before this change, Android had no reachable cart review screen after add-to-cart and no quantity/remove flow. This pass implements that one contained gap: an authenticated Compose cart screen, read/update/delete transport methods, a header entry point, and regression tests.

Android still has no checkout/payment UI, no seller-order UI/actions, and no dispute UI. Do not treat Android as purchase-ready or as feature-equivalent to React Native. Wallet is also a partial read-only surface; payout, withdrawal, funding, provider wallet, and coin/reward actions are not implemented in this Kotlin app.

## Screen and flow comparison

| React Native screen/flow | RN behavior and service contract | Kotlin Android evidence/status | Parity |
|---|---|---|---|
| Mart product detail → add to cart | `MartProductDetailScreen` adds product/quantity/option through `POST /api/v1/cart/items`; RN cart service sends `productId`, `quantity`, optional `size`, `color`, `options` (variant map), and sale `attribution`. | `MartProductDetailScreen.kt` supports product/variant selection and `CartRepository.addProduct`; Android sends `productId`, `quantity`, and one `variantId` (also accepted by the Go DTO). RN’s size/color/options/attribution fields are not exposed here. | Partial; backend accepts selected variant; option map/attribution parity absent. |
| Cart | `CartScreen` loads `/api/v1/cart` or `/api/v1/cart/shipping-quote`; item quantity uses `PATCH /api/v1/cart/items/{itemId}`, removal uses `DELETE` same path; groups, shipping, discounts, address and grand total are shown. | `CartScreen.kt` loads server cart, shows line/variant/store/unit price/overflow-safe line subtotal/server total, refresh, quantity and remove controls; corresponding GET/PATCH/DELETE methods are in `CartRepository.kt`. Shipping-address quote and grouped shipping detail are not included. | Improved to review/edit/remove; still partial. |
| Checkout | `CheckoutScreen` loads addresses and groups; submits `POST /api/v1/orders/checkout` with `addressId`, per-store `paymentModes`, `directPaymentAccepted`, and idempotency key; routes payable order onward to payment and success. | No Kotlin checkout screen, address form, or checkout repository was found. Server route exists in `services/go/modules/orders/src/modules/orders/routes/orders.routes.go`. | Missing on Android. |
| Payment | RN initializes payment (`POST /api/v1/payments/initialize` with `orderId` + idempotency key), supports hosted checkout return, saved-card charge, provider-wallet payment, and verification (`POST /api/v1/payments/orders/{orderId}/verify`). | No Kotlin commerce payment screen or payment repository found. Backend endpoints exist under `services/go/modules/payments/src/modules/checkoutPayments/routes/checkoutPayments.routes.go`, `savedCards.routes.go`, and `providerWallets.routes.go`. | Missing on Android. |
| Buyer order history | RN filters/paginates `GET /api/v1/orders` and uses status filters, refresh, and order-detail navigation. | `BuyerOrdersScreen.kt` + `BuyerOrdersRepository.kt`: filter/paging/list and detail routes are reachable through Orders. | Partial/implemented. |
| Buyer order detail and dispute entry | RN loads `GET /api/v1/orders/{orderId}`, escrow detail, receipt confirmation; conditional dispute entry goes to open-dispute/detail. The current dirty RN diff removes external tracking-URL launch and says updates are shown in Nantty. | `BuyerOrderDetailScreen.kt` is read-only; current dirty Kotlin diff also removes external tracking-URL launch. It does not implement receipt confirmation or dispute actions. | Partial; no confirmation/dispute actions. Existing tracking edits preserved. |
| Open/view dispute and messages | RN opens `POST /api/v1/orders/{orderId}/disputes`, lists/loads disputes, and posts messages to `/api/v1/disputes/{disputeId}/messages`; screen has reason/evidence/status history and seller response context. | No Kotlin dispute screen/repository found. Backend routes exist in `services/go/modules/escrow/src/modules/disputes/routes/disputes.routes.go`. | Missing on Android. |
| Seller orders | RN lists `/api/v1/seller/orders`, loads seller detail, filters, responds to disputes, accepts/rejects/statuses/cancels, notes, refunds, and ships with a selected seller location. Service endpoints include GET list/detail, POST accept/reject/status/fulfilment/cancel/notes/refunds. | No Kotlin seller-order screen/repository found. Backend routes exist in `services/go/modules/orders/src/modules/sellerOrders/routes/sellerOrders.routes.go`. | Missing on Android. |
| Wallet summary, transactions, escrow holds | RN wallet surfaces summary, transaction history, escrow holds, payout accounts/withdrawals, funding/provider wallet, coin activity/store rewards, and payout setup flows through wallet/payment services. | `WalletScreen.kt` + `WalletRepository.kt` cover summary, paginated transactions, and escrow holds. The existing dirty diffs adding escrow holds are preserved. No Kotlin payout/funding/withdrawal/reward actions found. | Partial/read-only. |

## API contract inventory

Routes below are confirmed in the checked-in Go route mounts; RN service calls are independently confirmed in `apps/mobile/src/services/commerce/`, `apps/mobile/src/services/moderation/disputes.service.ts`, and `apps/mobile/src/services/sellers/seller.service.ts`.

| Domain | Contract(s) | Android state after this pass |
|---|---|---|
| Cart | `GET /api/v1/cart`; `POST /api/v1/cart/items`; `PATCH /api/v1/cart/items/{itemId}` `{quantity}`; `DELETE /api/v1/cart/items/{itemId}`; `POST /api/v1/cart/shipping-quote` `{addressId}` | GET/add/PATCH/DELETE supported. Shipping quote not wired to cart UI. |
| Checkout and orders | `POST /api/v1/orders/checkout` with idempotency; `GET /api/v1/orders`; `GET /api/v1/orders/{orderId}`; `POST /api/v1/orders/{orderId}/confirm-receipt` | GET list/detail supported. Checkout and receipt-confirmation not implemented. |
| Payment | `POST /api/v1/payments/initialize`; `POST /api/v1/payments/orders/{orderId}/verify`; saved-card setup/complete/charge; provider-wallet payment | Not implemented in Kotlin. |
| Buyer disputes | `POST /api/v1/orders/{orderId}/disputes`; `GET /api/v1/disputes`; `GET /api/v1/disputes/{disputeId}`; `POST /api/v1/disputes/{disputeId}/messages` | Not implemented in Kotlin. |
| Seller orders | `GET /api/v1/seller/orders[/{orderId}]`; POST accept/reject/status/fulfilment/cancel/notes/refunds | Not implemented in Kotlin. |
| Wallet | `GET /api/v1/wallets/me`; `GET /api/v1/wallets/me/transactions`; `GET /api/v1/wallets/me/escrow-holds`; additional payout-account/withdrawal routes | Summary, transaction history, escrow holds supported; mutations and remaining surfaces not implemented. |

## Implemented gap: authenticated cart review and line management

**Why this was selected:** React Native exposes the cart as the handoff between product discovery and checkout. Android previously showed “Added to your cart” after the POST but offered no cart destination to inspect, adjust, or remove that item. This gap could be addressed without creating orders, charging money, or contacting payment providers.

**Changes:**

- Added `CartScreen.kt`, reachable from the signed-in app header. It loads the server cart, renders item name, variant/store, unit price and server total, supports refresh, quantity decrement/increment, and removal. It states checkout is not available in Android rather than presenting a nonfunctional purchase button.
- Extended `CartRepository.kt` for authenticated GET, PATCH quantity, and DELETE item requests. Identifiers and quantity are validated; no API origin or commerce values are hardcoded. Failures are translated to safe retry/session messages.
- Added repository tests for response parsing, exact HTTP paths/methods, authentication gating, and input validation; added Compose UI coverage for cart rendering and quantity/remove request sequence.
- Added a named cart action in the app header, preserving the existing dirty `NanttyApp.kt` edits and limiting modifications to the needed insertion points.

## Validation evidence

Commands run in the local Android checkout:

```text
./gradlew :app:testDebugUnitTest :app:compileDebugAndroidTestKotlin --no-daemon
./gradlew :app:testDebugUnitTest --tests com.nantty.android.data.CartRepositoryTest --no-daemon
```

The isolated `CartRepositoryTest` run passed all 8 tests, including malformed-total fail-closed behavior. The final serialized integrated run of `:app:compileDebugKotlin`, `:app:testDebugUnitTest`, and `:app:compileDebugAndroidTestKotlin` completed successfully with **195 unit tests, 0 failures, 0 errors**; Kotlin app and Android-test sources compiled. An earlier broader run had one feed query-order assertion failure, which was corrected in the test to match the implementation's valid query ordering; an intermediate concurrent build-cache collision was avoided by serializing the final run. `adb devices -l` returned no attached device, so Compose cart/header UI tests compiled but were not executed. No live API or external service was called.

## Dirty-worktree handling

The checkout was already dirty across mobile, Android, iOS, web, admin, backend, infrastructure, and existing parity documentation. Changes to the existing `BuyerOrderDetailScreen.kt`, `BuyerOrdersRepository.kt`, `WalletScreen.kt`, `WalletRepository.kt`, and shared `docs/native-app-feature-parity.md` were inspected but not reverted or rewritten. This audit is deliberately in a new file to avoid overlapping the existing parity report.

## Remaining work, ordered by risk

1. Complete Android purchase parity: native address creation/editing, RN payment choices and eligibility disclosures, provider return recovery, and purchase confirmation.
2. Buyer receipt confirmation and dispute open/detail/message behavior, with role/status-based availability.
3. Seller order list/detail, fulfillment/status actions, and dispute response, preserving backend authorization and idempotency requirements.
4. Remaining wallet surfaces and step-up-protected mutations; keep money amounts/currency sourced from API and never present mock balance as live.
5. Cart shipping quotes, saved delivery address selection, discounts/credits, unavailable-line states, and parity for option maps/sale attribution.
6. Adaptive/accessibility pass on phone, expanded width, font scaling, TalkBack semantics, and keyboard/switch input. Current screen uses a width-constrained list and labeled Compose controls; no emulator matrix run was available in this audit.

### Cart line subtotal follow-up — 2026-11-04

Cart rows display a per-line subtotal computed from the API-provided unit amount and quantity using overflow-safe multiplication. The API-provided cart total remains authoritative. Compose test source covers an updated subtotal after quantity change and overflow omission. Shipping quote and payment flow have since been added in the bounded first slice below; full RN parity remains outstanding.

### Checkout and payment first slice — 2026-11-04

This working-tree update adds a bounded buyer path beyond cart review:

- Cart can open an adaptive Compose checkout screen; checkout loads saved delivery addresses, requests a server shipping quote for the selected address, displays server-returned total components where present, and submits order creation with an idempotency key. Checkout uses the API's escrow defaults (`paymentModes: []`, `directPaymentAccepted: false`) rather than exposing a direct-payment choice without the RN trust disclosure and eligibility parity.
- A successful checkout response is labeled as an order requiring payment, not as a completed purchase. Payment initialization uses the server-provided payable order ID; the returned HTTPS checkout URL is opened externally. On return, the buyer must explicitly request server verification, and only the `paid` response displays confirmation. Pending, failed, and verification-error states remain distinct.
- `CheckoutRepositoryTest.kt` covers address parsing, shipping quote request, escrow-only checkout payload/idempotency, URL safety, verification states, and missing-session gating. Values and amounts are sourced from the backend response; the address ID and currency are not synthesized in the purchase flow.
- **Still missing:** native address creation/editing (buyers with no saved address must add one on Nantty web), direct payment and its eligibility confirmation, provider-wallet/saved-card integration, provider callback/deep-link restoration, purchase receipt success/detail parity, and a live seeded-backend or device run. This slice is not full commerce parity or production sign-off.

Separately, the product-detail delta in [`parity-android-discovery-commerce.md`](parity-android-discovery-commerce.md) adds quantity selection 1–10 and passes selected quantity to the existing cart API.

**Integrated validation for these deltas:** `./gradlew --no-daemon --no-parallel --max-workers=1 :app:testDebugUnitTest :app:compileDebugAndroidTestKotlin :app:assembleDebug` succeeded. The unit suite reported **221 tests, 0 failures, 0 errors**; app and Android-test Kotlin sources compiled, and the debug APK assembled. `adb devices -l` found no attached device, so the Compose UI tests were compiled but not run on emulator/device. No live/staging API, payment provider, or production data was used.

<!-- Duplicate of the preceding checkout first-slice note removed. -->

This working-tree update adds a bounded buyer path beyond cart review:

- Cart can open an adaptive Compose checkout screen; checkout loads saved delivery addresses, requests a server shipping quote for the selected address, displays server-returned total components where present, and submits order creation with an idempotency key. Checkout uses the API's escrow defaults (`paymentModes: []`, `directPaymentAccepted: false`) rather than exposing a direct-payment choice without the RN trust disclosure and eligibility parity.
- A successful checkout response is labeled as an order requiring payment, not as a completed purchase. Payment initialization uses the server-provided payable order ID; the returned HTTPS checkout URL is opened externally. On return, the buyer must explicitly request server verification, and only the `paid` response displays confirmation. Pending, failed, and verification-error states remain distinct.
- `CheckoutRepositoryTest.kt` covers address parsing, shipping quote request, escrow-only checkout payload/idempotency, URL safety, verification states, and missing-session gating. Values and amounts are sourced from the backend response; the address ID and currency are not synthesized in the purchase flow.
- **Still missing:** native address creation/editing (buyers with no saved address must add one on Nantty web), direct payment and its eligibility confirmation, provider-wallet/saved-card integration, provider callback/deep-link restoration, purchase receipt success/detail parity, and a live seeded-backend or device run. The checkout slice is not full commerce parity or production sign-off.

The product-detail slice documented in [`parity-android-discovery-commerce.md`](parity-android-discovery-commerce.md) separately adds quantity selection 1–10 and passes the selected quantity to the existing cart API; its UI test source is pending integrated compile/test confirmation.

