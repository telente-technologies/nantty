# React Native ↔ Android business-workspace parity

Last reviewed: 2026-11-05

## Scope and parity baseline

React Native exposes seller, creator, brand/business-profile, and advertising journeys as distinct stack routes. The current Android working tree now has four authenticated workspace panels reachable from the signed-in profile's Business tools entry. They provide read-only summaries (plus active-profile switching); they are not full equivalents of the RN application, catalog, fulfilment, brand-management, or campaign-action flows. This document describes current source, including dirty/uncommitted work; it is not a clean-baseline or release certification.

| Domain | React Native routes | Core flow | Android baseline |
|---|---|---|---|
| Seller | `SellerApplication`, `SellerApplicationStatus`, `SellerDashboard`, `SellerProducts`, `ProductForm`, `SellerOrders`, `SellerOrderDetail`, `BusinessDocuments` | RN supports application/status, dashboard, product lifecycle, seller orders/fulfilment and documents. Android `SellerWorkspaceScreen`/`SellerWorkspaceRepository` read access, application status, dashboard and recent orders. | **Partial.** No application submission/reapply, product/order destinations or mutations, document upload, or seller fulfilment actions. Dashboard rows are informational. |
| Creator | `CreatorProgram`, `CreatorApplication`, `CreatorApplicationStatus`, `CreatorDashboard`, `CreatorAffiliates`, `CreatorSubscribe`, `MySubscriptions` | RN supports eligibility/application/status, dashboard, affiliates and subscriptions. Android `CreatorWorkspaceScreen`/`CreatorWorkspaceRepository` read eligibility/application/dashboard and expose application submission, status, reapply, existing payout-account selection, and up to three uploaded sample images. | **Partial.** Adding/managing payout accounts, resumable/offline upload queue semantics, affiliates, subscription management and analytics navigation remain missing. Sample upload is API-contract/unit-tested but not staging/device verified. |
| Brand/business profiles | `BrandProfile`, `CreateBrand`, `CreateBusinessProfile`, `ManageProfiles` | Android `BrandProfilesScreen`/`BrandProfilesRepository` list acting profiles and switch active identity. | **Partial.** No create brand/business profile, public brand detail/follow, or brand selling controls. |
| Ads/boost | `PromotePost`, `PromoteDestination`, `CreateAd`, `BoostStatus`, `AdsHub`, `AdBalance` | Android `AdsWorkspaceScreen`/`AdsWorkspaceRepository` display paged campaign summaries and balance overview. | **Partial/read-only.** No campaign creation/quote/payment, details/reports/actions, ledger, top-up, or withdrawal. |

RN route registration is in `apps/mobile/src/navigation/main.navigator.tsx` and `navigation.types.ts`. Contracts are declared in seller, creator-program, brands, ads-hub, and boosts services under `apps/mobile/src/services`. These source contracts and server route definitions do not establish that production integrations have been exercised.

## Invariants for the Kotlin implementation

- Keep server authorization authoritative; never expose seller/creator actions because of a client-only role flag.
- Discover the seller's store through `/api/v1/seller/access`; seller dashboard and store-scoped operations must send the server-provided store ID using the backend's expected `X-Seller-Store` header.
- Use server-returned status, application eligibility, ad options, campaign permissions, estimates, prices, and balances. Do not hardcode eligibility thresholds, CPMs, payout values, or payment availability.
- Preserve idempotency for money-affecting/create operations, step-up requirements for protected actions, and hosted checkout boundaries.
- Seller applications are currently Nigeria-only for v1. The application must retain seller logistics choice and phone requirements; creator applications remain a separate eligibility path.
- Treat state explicitly: loading, refresh, empty, retryable error, authorization-required, pending review, rejected, and successful completion.
- Follow Android's adaptive design: layouts respond to available window size and fold posture; on wider layouts prefer useful multi-pane/workspace composition over stretching a phone column. Keep accessible touch targets, semantics, and scalable text.

## Implementation tracking

Initial slices are wired under the signed-in profile's Business tools entry. They are deliberately read-only except for switching the acting profile, and do not yet constitute route-for-route parity.

| Slice | Status | Verification |
|---|---|---|
| Seller access and dashboard surface | Implemented (read-only) | Unit tests + Kotlin compile passed |
| Creator eligibility/dashboard surface | Implemented (read-only) | Unit tests + Kotlin compile passed |
| Brand profile list and acting identity | Implemented (switching supported) | Unit tests + Android-test compile passed |
| Ads campaign list and balance overview | Implemented (read-only) | Unit tests + Kotlin compile passed |
| Creator application and status submission | Implemented for Android form submit, pending/rejected status display and eligible reapply. RN contract is `GET /api/v1/creators/applications/me` and `POST /api/v1/creators/applications` with `Idempotency-Key`; Go now validates and persists a user-scoped key plus request-payload hash, returns the prior response for an identical replay and rejects reuse with a different body. Android sends the same submit fields and retains the same key during transport/session-refresh retries. | Android repository/form tests and Compose instrumentation-source compilation pass. Go code generation and package compilation pass. PostgreSQL-backed integration tests remain unverified because the local database connection at `localhost:15432` is unavailable/authentication fails. |
| Creator sample content and payout method | Android now calls the authenticated RN wallet listing endpoint and offers existing accounts as an optional selection; applications still work with no payout account. The Compose form now picks up to three images, re-encodes them to JPEG, uploads through the same `dispute_evidence` media-session/chunk/complete/process contract used by RN's picker, and submits the resulting public URLs. Android does not yet persist/resume uploads or match RN's offline/retry queue, and has no native add/manage payout-account destination. | Media transport/preparation and payout-list contracts have unit coverage; Android full JVM suite and instrumentation-source compile pass. No emulator or staging media endpoint was exercised. Do not claim real-service verification. |
| Seller application, product/order lifecycle, fulfilment, documents | Pending | Not implemented |
| Brand creation/detail/follow | Pending | Not implemented |
| Ad campaign create/manage and balance operations | Pending | Not implemented |

The serialized Android verification on 2026-11-05 passed `:app:testDebugUnitTest` and `:app:compileDebugAndroidTestKotlin` after creator form, payout selection, and media-upload coverage. Those results do not prove the screen is runtime-correct. No device/emulator was attached; no production service or live account integration was exercised. The Go idempotency code compiled and generated successfully, but its PostgreSQL-backed behavior is not integration-tested in this environment. Creator upload persistence/offline retry, payout-account add/manage, affiliates, subscriptions, and the other pending workspace actions remain open.

## Android design references

- [Get started with Android](https://developer.android.com/get-started/overview)
- [Android UI design](https://developer.android.com/design/ui)
- [Adaptive Compose apps](https://developer.android.com/develop/ui/compose/layouts/adaptive/get-started-with-adaptive-apps)
- [Compose accessibility](https://developer.android.com/develop/ui/compose/accessibility)
