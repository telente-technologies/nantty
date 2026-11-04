# React Native ↔ Android Kotlin parity audit

**Audit date:** 2026-11-04  
**Scope:** `apps/mobile` React Native app versus `apps/native/android` Kotlin/Jetpack Compose app. This is a source and route audit; it is not a claim of production, device, or backend verification.

## Method and status vocabulary

Compared screen files, React Navigation route registrations, Android root destinations and Compose screens, API/repository contracts, and existing platform parity notes. Route/component existence alone is not evidence of working behavior; rows should be traced through navigation, state, service, authorization, errors, and tests.

- **Implemented (source):** user path and relevant data contract exist in Kotlin source; runtime still needs device/API checks.
- **Partial:** some actions or states exist, but the RN journey has meaningful omissions.
- **Missing:** no equivalent reachable Android path was found in this pass.
- **Intentional:** a platform-specific interaction is acceptable if the user outcome is preserved and documented.
- **Unverified:** source/tests exist but execution against a device, isolated service, or real provider was not performed.

## Reachable navigation comparison

React Native declares 5 main tabs (`Home`, `Clips`, `Create`, `Chats`, `Me`) and 107 main-stack registrations, in addition to the auth stack. The screen tree contains 134 files; these counts are not feature-completion percentages because some files are helpers, nested screens, sheets, and tests.

Android currently has 9 root `Destination` values in `NanttyApp.kt`; the bottom navigation exposes 6 after filtering (`Home`, `Discover`, `Activity`, `Messages`, `Wallet`, `Profile`). Mart and Orders are opened from the header. Cart, post detail, public profile, and composer are additional local-state destinations. Several registered RN journeys have no Android route/screen equivalent. In particular, Clips and the full Create menu are not bottom destinations; Android's composer is text-only and directly entered from Feed.

The single generic Android placeholder (`NanttyApp.kt` `MainContent`) still renders “coming to the native app” for unsupported root destinations. The screen classes on disk therefore overstate reachable parity if counted without checking navigation.

## Family-level comparison — initial verified map

| Flow family | React Native reference | Android source coverage | Status / outstanding gap |
|---|---|---|---|
| Authentication | `auth.navigator.tsx`; login, signup/OTP, birthday, username, personalization, recovery, guest entry, Google/Apple provider buttons | `AuthGatewayScreen`, registration/recovery Compose screens, `SocialBirthdayScreen`, `AuthFlowApi` | **Partial.** Android now offers guest entry and public browsing, uses Credential Manager for Google, exchanges the token/nonce with the server, and handles the backend's first-time `BIRTHDAY_REQUIRED` challenge. Apple remains iOS-only, matching the RN platform availability check. Remaining auth gaps include the RN first-time social birthday challenge and guest action replay parity; provider configuration and device sign-in are unverified. See `android-auth-guest-parity.md`. |
| Home / Following feed | `HomeScreen`, feed services, post interactions | `FeedRepository`, `FeedTopicSelector`, Feed destination/interactions, `HomeWalletPreviewCard` | **Partial.** For You/Following, followed-topic filtering, post interactions, cursor paging, and a signed-in read-only wallet preview exist in source. Curated creator modules and clips/media remain absent; device behavior is unverified. |
| Clips / Stories / Live / Spaces / sound | corresponding RN screen families and create routes | no corresponding root destination or complete Kotlin experience found in this pass | **Missing / major gap.** Native media capture/playback, creation flows, and associated routes are not equivalent. |
| Explore / search | RN Explore search and categories/scopes/results | `SearchScreen` and `SearchRepository` | **Partial.** Global search, recent-query list/record/remove/clear, cursor paging, and validated post/product destinations exist. Contextual Mart/store/profile scopes and other RN result types/destinations remain broader. |
| Posts / comments | RN post detail, comment thread, nested focused thread, quotes, analytics, comment identity | `PostDetailScreen`, `PostDetailRepository`, image viewer, profile identity selector | **Partial.** Core thread, replies, reactions and paging have slices. Focused subtree navigation and complete clip-comment behavior remain gaps. |
| Profiles / connections / managed brands | RN current/public/edit profiles, connections, follow requests, brand/business management | current and public read-oriented profile screens | **Partial.** Edit, connections, requests, profile management and associated workflows do not have full Android parity. |
| Messaging | RN inbox, conversation, create DM/group, info, encrypted chat settings/passcode | `MessagesScreen`, `MessagesRepository`, `ConversationThreadScreen` | **Partial and intentionally receive-limited.** Tappable inbox rows open the thread, authenticated history loads, and the thread is marked read. Ciphertext remains hidden and composer disabled until a full RN-compatible device/key/session/envelope implementation passes conformance tests; DM/group creation, requests/spam, media/reactions and realtime remain absent. |
| Notifications | RN Activity and settings | `NotificationsScreen`, `NotificationsRepository`, account notification settings screen/repository | **Partial.** Inbox/read/filter/paging actions exist, and the Android milestone push/email preference is now represented. Push integration, broader target routes and device verification remain open. |
| Mart / product discovery | RN Mart/category/store/product/reviews | `MartScreen`, `MartRepository`, `SearchScreen`; `MartProductDetailScreen` | **Partial.** Product browsing/detail slices exist; reviews, store detail, cross-surface navigation and complete catalog actions require flow-level verification. |
| Cart / checkout / payment | RN cart, checkout, payment, success, delivery and escrow handoff | `CartScreen`, `CartRepository`, product-detail add-to-cart | **Partial.** Android supports authenticated add, cart review, quantity changes and removal. Shipping quote/address selection, checkout, payment handoff/verification, success and order recovery are missing; do not infer purchase readiness from the cart screen. |
| Orders / disputes / escrow | RN orders, detail, dispute creation/detail, escrow status | `BuyerOrdersScreen`, `BuyerOrderDetailScreen`, `BuyerOrdersRepository` | **Partial.** Read-oriented buyer order flows exist; mutations/disputes/escrow and seller-specific order lifecycle are not equivalent. |
| Wallet / payouts / rewards | RN wallet, transactions, add funds, withdraw, payout setup/accounts, rewards/coins | `WalletScreen`, `WalletRepository` | **Partial.** Android wallet is read-only; funding, withdrawals, payout configuration and coin-purchase operations are missing. |
| Seller / creator operations | RN seller onboarding/dashboard/products/orders/documents and creator program/application/affiliate/subscription | no complete Kotlin seller/creator flow found | **Missing / major gap.** No production-ready native parity for seller or creator operating flows. |
| Settings / support / verification / trust | RN settings subsections, privacy, blocked/hidden content, support tickets, verification, ads/boost | limited notification preference and sign-out surfaces | **Partial / missing.** Broad settings, privacy/safety, support, identity verification, ads/boost and review workflows are not fully available. |
| Widgets / deep links | RN exposes five widget kinds and a broad route map | Android launch/Orders widgets; internal widget actions | **Partial.** Several RN widget kinds and inbound HTTPS/internal content routes have no native equivalent; see prior detailed audit notes. |

### Current source corrections (2026-11-04)

The initial route-family table above is a baseline, and portions became stale as parallel slices landed. Current source evidence should be interpreted with these corrections:

- **Feed topics:** Android now loads the signed-in followed-topic list, renders selectable For You chips, carries `topicId` through first-page and continuation requests, and clears it when switching feed mode. See `FeedRepository.kt`, `FeedTopicSelector.kt`, and the feed section in `NanttyApp.kt`; unit and Compose-test source exists. This closes topic-filter parity at source level, not device-level.
- **Global search:** signed-in recent searches can be loaded, recorded on explicit submit/result open, selected, removed, and cleared; guest history requests are suppressed. Android is still global-scope, so RN's Mart/store/profile contextual search and broader result destinations remain gaps.
- **Cart:** product detail can add an available variant; cart can load, display server totals, update quantity, remove a line, and refresh. Checkout, shipping/address quote, payment, confirmed-success, dispute and seller-order operations remain absent. Android is not purchase-ready.
- **Messaging:** inbox rows open a thread, history is fetched, and the thread is marked read. The thread does not render server ciphertext as plaintext; send stays disabled pending full Kotlin compatibility with RN's custom device/key/session/envelope protocol and cross-client tests. There is no Signal/libsignal compatibility claim.
- **Home wallet preview:** Kotlin now has a signed-in-only preview component and `NanttyApp` integration using the existing authenticated `WalletRepository`; the component has focused Compose UI test source for loading, repository data, error/retry, signed-out suppression, account switching, and wallet navigation. The serialized Gradle run passed app compilation, **207 JVM tests**, and instrumentation-source compilation; no emulator/device was attached, so UI tests were not executed. It remains read-only.

These updates do not close the wider route inventory. Source or test-file existence is not equivalent to runtime, backend, payment-provider, accessibility-service, or adaptive-device verification.

### Deep scan follow-up (2026-11-04)

Five focused source audits compared auth/guest, feed/social, commerce, messaging/account, and creator/seller/logistics journeys. The highest-priority findings are:

1. **P0 — checkout and payment are absent in Kotlin.** Cart review is not a purchase flow; shipping/address selection, server checkout creation, payment handoff and verification, confirmed success, and recovery are missing. Continue to use server-calculated totals, authorization, and idempotency when implementing; do not simulate payment success.
2. **P0 — messaging is receive-limited, not E2E parity.** Kotlin can open a conversation, fetch history, and mark it read, but cannot safely decrypt/send using RN-compatible device/key/session/envelope behavior. The composer remains disabled, there is no WebSocket/reconnect parity, and inbox request/search/group flows are absent. Keep encrypted payloads hidden until protocol conformance is established.
3. **P1 — guest action replay is missing.** Android routes protected guest actions to auth but does not retain and replay the pending action/return destination as RN does. Public guest route coverage is also narrower.
4. **P1 — social onboarding needs cross-client alignment.** Kotlin handles the backend's first-time Google `BIRTHDAY_REQUIRED` challenge. RN's initial Google/Apple exchange currently sends no birthday, so a newly registered social account may dead-end there. Apple remains intentionally iOS-only. OAuth audience/provider setup and live sign-in remain unverified.
5. **P1 — seller/creator operations and media journeys are substantially incomplete.** Live, Clips, Stories, Spaces, creator program/subscriptions/affiliate operations, seller onboarding/inventory/order/logistics operations have no complete native equivalent. Some RN capabilities are themselves mock/demo or provider-config dependent; reports must distinguish those from production integrations. Seller logistics tracking metadata entered in RN is not evidence of a courier API integration.
6. **P1 — discovery and social creation are narrower.** Kotlin Explore lacks RN's landing modules and contextual scopes; public profile omits several content/store tabs; post creation hardcodes audience/kind and has no equivalent media/mention/quote/draft/scheduling flow. Comments and core feed have partial parity, not full feature equivalence.
7. **P1/P2 — wallet, orders, and account controls are partial.** Kotlin wallet is read-only; order lifecycle/dispute/escrow and seller operations are incomplete. Connections/follow requests, broad privacy/security/account management, support workflows, device push registration, and notification target resolution are also missing or partial.

The first bounded remediation in this pass is the direct Android sign-in surface: the Kotlin sign-in screen now exposes Google when the Android server client ID is configured, invokes the existing Credential Manager flow, displays provider errors, and hides the option when unconfigured. Focused Compose test source verifies visibility/callback and the missing-config case. This does not resolve the separately identified guest-action replay or RN social-birthday gap.

This table is a baseline, not a line-by-line closure. The domain workstreams are adding evidence at screen/flow granularity and implementing their first bounded fixes in separate reports.

## Cross-cutting quality observations

1. **Navigation is the first parity bottleneck.** Screen components are not enough: destinations absent from the Android shell cannot be reached as user flows. The main Android shell has a different bottom-nav information architecture from React Native, which is acceptable only if equivalent tasks remain discoverable.
2. **Backend/API parity is not UI parity.** Existing API methods (for example cart/order actions or social providers) must not be reported as usable until a reachable Android flow handles loading, error, auth, cancellation, and success states.
3. **No-hardcoding review is still in progress.** Audit config/endpoint origins, business policy values, labels, route IDs, demo content and fallback behavior per domain. UI copy and design tokens can be constants; endpoint origins, user/account values, financial policy, availability and server-controlled eligibility must not be invented in Compose.
4. **Mocks and fixtures are not production integrations.** Every report should label mock-only, source-wired, API-contract-tested, emulator-tested, and staging-tested separately.
5. **Platform differences:** Android should use Material controls, predictive/system Back, accessible semantics and layouts that adapt to window size/posture/input. Pixel-matching RN is not the goal; equivalent task outcomes and clear differences are. Android’s official overview describes phone through tablet/foldable support and modular/testable apps; its UI guide emphasizes native components, adaptive layouts, interaction patterns and accessibility.

## Domain reports and active remediation

- Feed/social: [`parity-android-feed-social.md`](parity-android-feed-social.md).
- Discovery/search and category/store/product: [`parity-android-discovery-commerce.md`](parity-android-discovery-commerce.md).
- Cart/checkout/orders/wallet: [`parity-android-commerce-wallet.md`](parity-android-commerce-wallet.md).
- Messaging flows: [`parity-android-messaging.md`](parity-android-messaging.md).
- Messaging/profile/settings/notifications: [`parity-android-messaging-account.md`](parity-android-messaging-account.md).

## Verification gates

- Unit/API contract tests and Android-test-source compilation are useful evidence but do not prove a screen works on device.
- **2026-11-04 latest verification:** `:app:testDebugUnitTest`, `:app:compileDebugKotlin`, and `:app:compileDebugAndroidTestKotlin` completed successfully in a serialized Gradle run (`--no-daemon --no-parallel --max-workers=1`). The unit-test reports contain **210 tests, 0 failures, 0 errors**. Instrumentation test sources (including the new sign-in Google option checks) compiled; they were not executed because no Android device/emulator was attached. The debug APK was assembled in the preceding serialized run. Existing Compose/Android deprecation warnings remain.
- Run app installation and critical journeys on at least a compact phone, large phone, tablet/foldable, with keyboard, system Back, TalkBack/large fonts and both light/dark appearance.
- Use a seeded isolated backend for real auth, social, checkout, messaging and seller/creator flows; never production/customer records.
- Compare the API contract and auth/ownership rules for each write, particularly money, orders, profile identity, media uploads and privacy settings.
- Keep release status **not ready for parity sign-off** until major missing flows above are either implemented or explicitly removed from the supported Android scope and product-approved.

## References

- [Android Get started overview](https://developer.android.com/get-started/overview)
- [Android UI design](https://developer.android.com/design/ui)
- [Android adaptive apps with Compose](https://developer.android.com/develop/ui/compose/layouts/adaptive/get-started-with-adaptive-apps)
- Existing dated/source evidence: [`native-app-feature-parity.md`](native-app-feature-parity.md)
