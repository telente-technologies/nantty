# React Native ↔ Android business-workspace parity

Last reviewed: 2026-11-05

## Scope and parity baseline

React Native exposes seller, creator, brand/business-profile, and advertising journeys as distinct stack routes. The current Android working tree now has four authenticated workspace panels reachable from the signed-in profile's Business tools entry. They provide read-only summaries (plus active-profile switching); they are not full equivalents of the RN application, catalog, fulfilment, brand-management, or campaign-action flows. This document describes current source, including dirty/uncommitted work; it is not a clean-baseline or release certification.

| Domain | React Native routes | Core flow | Android baseline |
|---|---|---|---|
| Seller | `SellerApplication`, `SellerApplicationStatus`, `SellerDashboard`, `SellerProducts`, `ProductForm`, `SellerOrders`, `SellerOrderDetail`, `BusinessDocuments` | Android now adds the RN-equivalent five-step seller application, Nigeria-only server-country gate, required logistics choice, identity document upload, bank account-name verification and idempotent submission; the gate links to country preferences. | **Partial.** Application submit/status and country preference change are source-wired. Product lifecycle, business-document management and full seller order detail/fulfilment actions remain incomplete. Form/upload/account verification and country update are not device or staging validated. |
| Creator | `CreatorProgram`, `CreatorApplication`, `CreatorApplicationStatus`, `CreatorDashboard`, `CreatorAffiliates`, `CreatorSubscribe`, `MySubscriptions` | RN supports eligibility/application/status, dashboard, affiliates and subscriptions. Android exposes application submission/status/reapply, existing payout-account selection, up to three uploaded sample images, and now a decision badge/progress indicator using server-returned current/required values. | **Partial.** Adding/managing payout accounts, resumable/offline upload queue semantics, affiliates, subscription management and analytics navigation remain missing. Upload and progress UI are not staging/device verified. |
| Brand/business profiles | `BrandProfile`, `CreateBrand`, `CreateBusinessProfile`, `ManageProfiles` | Android `BrandProfilesScreen`/`BrandProfilesRepository` list acting profiles and switch active identity. | **Partial.** No create brand/business profile, public brand detail/follow, or brand selling controls. |
| Ads/boost | `PromotePost`, `PromoteDestination`, `CreateAd`, `BoostStatus`, `AdsHub`, `AdBalance` | Android `AdsWorkspaceScreen`/`AdsWorkspaceRepository` display paged campaign summaries and balance overview; campaign detail/report and server-authorized pause/resume/stop open from a campaign row. | **Partial.** Campaign creation/quote/payment, budget changes, balance ledger/top-up/withdrawal, and promoted-target navigation remain absent. |

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
| Ads campaign detail, daily report, pause/resume/stop | Implemented for supported lifecycle actions | Repository tests cover detail/report and authenticated idempotent lifecycle POSTs; Compose interaction test covers row-to-detail and pause/resume. Stop is confirmation-gated. Instrumentation execution still requires a device. |
| Creator application and status submission | Implemented for Android form submit, pending/rejected status display and eligible reapply. RN contract is `GET /api/v1/creators/applications/me` and `POST /api/v1/creators/applications` with `Idempotency-Key`; Go now validates and persists a user-scoped key plus request-payload hash, returns the prior response for an identical replay and rejects reuse with a different body. Android sends the same submit fields and retains the same key during transport/session-refresh retries. | Android repository/form tests and Compose instrumentation-source compilation pass. Go code generation and package compilation pass. PostgreSQL-backed integration tests remain unverified because the local database connection at `localhost:15432` is unavailable/authentication fails. |
| Creator sample content and payout method | Android now calls the authenticated RN wallet listing endpoint and offers existing accounts as an optional selection; applications still work with no payout account. The Compose form now picks up to three images, re-encodes them to JPEG, uploads through the same `dispute_evidence` media-session/chunk/complete/process contract used by RN's picker, and submits the resulting public URLs. Android does not yet persist/resume uploads or match RN's offline/retry queue, and has no native add/manage payout-account destination. | Media transport/preparation and payout-list contracts have unit coverage; Android full JVM suite and instrumentation-source compile pass. No emulator or staging media endpoint was exercised. Do not claim real-service verification. |
| Seller application | Implemented (partial end-to-end client flow) | Seller form/repository tests and Android-test-source compilation pass; application mutation includes required logistics choice and existing private identity upload/payout verification contracts. The seller gate now opens the supported-country preference destination and restores the application destination on return/save; device/staging validation remains open. |
| Seller product/order lifecycle, fulfilment, documents | Pending / partial | Seller orders are reachable from workspace, but product management, document management, and complete seller fulfilment/order actions are not yet at parity. |
| Brand creation/detail/follow | Pending | Not implemented |
| Ad campaign create/manage and balance operations | Partial | Pause/resume/cancel are implemented from server-returned action flags. Creation, quote/payment, budget management, promoted-target opening, balance transactions, top-up and withdrawal remain pending. |

## Ads workspace source trace (2026-11-05)

RN source trace: `apps/mobile/src/screens/ads/adsHub.screen.tsx` uses the server-backed status/cursor list and balance query; tapping a row routes to `BoostStatus`. `apps/mobile/src/screens/boost/boostStatus.screen.tsx` reads boost detail and report and gates mutations with the server `actions` object. `apps/mobile/src/services/ads/adsHub.service.ts` and `services/feed/boosts.service.ts` declare the HTTP contracts. No RN defect was found in this exact workspace flow during source inspection. Existing utility tests cover status-filter mapping and server action gating.

Backend route verification: `services/go/modules/ads/src/modules/boosts/routes/boosts.routes.go` mounts authenticated list, detail, and report GETs plus pause/resume, budget, and cancel routes. Controllers query using the authenticated actor user ID; detail and report constrain records to that owner. `services/go/modules/ads/src/modules/adFunds/routes/adFunds.routes.go` mounts balance and balance-operation endpoints. No API route changes were needed for this read-only Android parity slice.

Kotlin makes campaign rows actionable and loads selected campaign detail plus its daily report through owner-scoped GET routes. It displays returned status, spend, key-result values, report totals and daily series; errors have retry and auth-recovery actions. Pause, resume, and stop now consume backend-provided action permissions and lifecycle mutations; unavailable actions are not shown. This slice adds no client-side entitlement, price, balance policy or server-controlled campaign policy. Later verification below supersedes this initial read-only checkpoint.

RN type-check note: the supplied Ads-related error concerns sponsored-feed telemetry rather than the Ads workspace routes. Installed `react-native` is `0.88.1`; `apps/mobile/node_modules/react-native/types_generated/index.d.ts` exports `ListViewToken`, while it does not export `ViewToken`. Both `apps/mobile/src/services/ads/adEvents.service.ts` and `apps/mobile/src/services/adEvents.service.ts` import the missing `ViewToken`. These files were left unchanged because feed impression batching is outside this workspace-only scope. The full mobile type-check also reports other pre-existing errors outside Ads; this should not be read as a clean RN typecheck.

The serialized Android verification on 2026-11-05 passed `:app:testDebugUnitTest` and `:app:compileDebugAndroidTestKotlin` after creator form, payout selection, and media-upload coverage. Those results do not prove the screen is runtime-correct. No device/emulator was attached; no production service or live account integration was exercised. The Go idempotency code compiled and generated successfully, but its PostgreSQL-backed behavior is not integration-tested in this environment. Creator upload persistence/offline retry, payout-account add/manage, affiliates, subscriptions, and the other pending workspace actions remain open.

### Ads lifecycle continuation (2026-11-05)

The Go Ads route package already mounted authenticated owner-scoped `POST /pause`, `/resume`, and idempotent `/cancel` actions, and backend integration tests cover allowed/denied transitions. RN and web already call these endpoints and use returned `actions` flags. Android now parses the canonical permission flags, sends the matching authenticated POST with an idempotency key, retries once after a 401 session refresh, and updates the detail view from the canonical response. Stop displays an irreversible-action/refund confirmation before calling cancel. Budget changes are intentionally not included in this slice because the existing RN flow requires server quote and payment-aware confirmation; Android remains without that UI. No Go route/backend change was necessary.

Verification for this slice: Kotlin production compilation, JVM unit tests (**406 passed, 0 failures/errors/skips**), Android-test-source compilation, and `:app:lintDebug` passed (**0 errors, 38 warnings**). The new Compose interaction source tests pause/resume using server-returned action flags but cannot be run without an attached emulator/device. Go Ads route and command packages compile; the database-backed owner-transition integration test did not complete in this environment. No live API/account mutation was performed.

## Android design references

- [Get started with Android](https://developer.android.com/get-started/overview)
- [Android UI design](https://developer.android.com/design/ui)
- [Adaptive Compose apps](https://developer.android.com/develop/ui/compose/layouts/adaptive/get-started-with-adaptive-apps)
- [Compose accessibility](https://developer.android.com/develop/ui/compose/accessibility)

### Country preference gate parity continuation (2026-11-05)

React Native's `SellerApplication` country-required gate offers **Open country settings**, navigating to `SettingsAppPreference`. That destination provides a supported-country list, a Country & Currency picker, and saves the choice through `PATCH /api/v1/users/me/preferences` before refreshing the locale. The Go backend mounts that authenticated PATCH route; the supported-country list is served by `GET /api/v1/locale/countries`.

Android now has a focused **Country & currency** destination reachable from Profile and from the seller country gate. It loads `GET /api/v1/locale/countries` and `GET /api/v1/locale`, uses the server-provided supported-country choices, and updates via authenticated `PATCH /api/v1/users/me/preferences`; the server remains authoritative for resulting locale/currency. Navigation returns to the prior destination, whose saveable seller application draft is restored and reloads eligibility. Unit tests cover country parsing, the authenticated update payload, rejection of unsupported values, missing/expired authentication, and refresh-aware requests. Compose instrumentation sources cover the country picker/update action and seller-gate handoff; they are compile-only until a device is attached. Theme/language/accessibility portions of RN's broader App Preference screen are not included in this country-preference slice.

### Pending Space invitation eligibility (2026-11-05)

The authenticated pending-invitation inbox returns only visible Spaces whose state is `scheduled` or `live`; pending invitation records for `ended` or `cancelled` Spaces remain stored but are not surfaced as join actions. This prevents an accept action from leading into a state that cannot join. `TestPendingSpaceInvitationsAreRecipientScopedAndPaginated` creates both cancelled and ended pending invitations and verifies pagination only returns eligible invitations. The focused Go integration test passed against the local ephemeral schema; no deployment was performed.

The recipient flow is now wired in both React Native and Kotlin: signed-in users see a cursor-paginated invitation list with inviter, Space, requested role/title, open-details action, and accept/decline. Stored `moderator` and legacy `cohost` values are presented consistently as “Co-host.” Loading, retryable error, and empty states are covered. Verification: RN typecheck and 15 focused Space invitation tests passed; Kotlin JVM suite passed **492/492**, and the serialized emulator run passed **7/7** Space UI tests (the same run also covered Brand UI, for 9/9 total). Android instrumentation source compilation passed. Backend Go route/integration tests passed locally; the GIN index migration has not been applied to a deployed database.

### Space host invitation search by username (2026-11-05)

The Kotlin host invite dialog now searches the existing social people endpoint after a two-character query, showing account name, `@username`, avatar/verification status, loading/error/empty states, and selectable recipients. Search is debounced and guarded against stale responses; invite still sends the selected account ID to the existing Space invitation route and retains role/title selection. The repository requires authenticated requests and bounds/encodes the search query. RN already had this service contract and search flow; no API or RN changes were needed. Verification: `:app:testDebugUnitTest` passed (**495 tests, 0 failures/errors/skips**); Kotlin production and Android-test source compilation passed; emulator `Medium_Phone_API_37.0` ran `SpacesScreenTest` (**9/9 passed**), including suggestion/loading/error/empty UI and selecting the suggested account with role/title invitation. `git diff --check` passed. This validates the targeted slice only, not complete product parity.
