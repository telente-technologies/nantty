# Error screens — inventory

## Core (packages/webKit/src/errorExperience)
- One system for every Next app: errorKinds.ts (52 kinds), errorCatalog(.content).ts (icon, tone, motion, copy, actions), errorMapper.ts (errorKindByCode, about 200 backend codes plus HTTP status fallback), errorSignal.ts (duck-types any app error: status/code/details/requestId/retryAfterSeconds/digest).
- Components: ErrorState/ErrorScreen (page/section/inline/compact variants, centred, Phosphor duotone icon in a tinted halo, 404/500/403 hero numerals, float/breathe/glitch motion that is off under reduced motion, reference line with copy, 429 countdown, auto-retry on reconnect, focus on title, alert/status roles), NotFoundScreen (search box and destinations), RouteErrorScreen/GlobalErrorScreen, ConnectionStatus (offline banner and back-online toast), EmptyState presets, MaintenanceBanner, SensitiveContentCover, and connectivity helpers (probe, storage, WebRTC, clock skew).
- Tests: src/errorExperience/__tests__/errorMapper.test.tsx and errorRecovery.test.tsx, 83 passing. The existing pnpm test suite passes (24). package.json was not touched, so these two test files are NOT in the test script yet.

# Error screens — webapp + web (marketing)

All screens come from `@zudomart/web-kit` (`ErrorState` / `ErrorScreen` / `NotFoundScreen` / `RouteErrorScreen` / `GlobalErrorScreen` / `ConnectionStatus` / `EmptyState`). Copy and icons live in the webKit catalog; apps only choose kind/subject or pass the API error.

## Plumbing
- `apps/webapp/src/components/errors/errorExperience.provider.tsx` — `WebappErrorExperienceProvider` (mounted in `components/providers/appProviders.tsx`): home `/`, Next `Link` rendering, search `/explore`, 404 destinations Feed `/` (House), Clips `/clips` (PlayCircle), Mart `/mart` (Storefront), Live `/live` (Broadcast). Actions: signIn → auth prompt (handler), chooseCountry → shared `CountryRequiredDialog` then invalidates queries, verify/upgrade → `/settings/verification`, accountStatus/appeal → `/settings/account-status`, support → `/help`, viewCart/payByCard → `/cart`, viewOrders → `/orders`, resendEmail → `/verify-email`, changeAddress → `/settings/addresses`, clearDebt → `/wallet`, useApp/update → store link.
- `apps/web/src/components/errors/errorExperience.provider.tsx` — `MarketingErrorExperienceProvider` (mounted in `app/layout.tsx`): home `/` ("Back to the homepage"), destinations Home, Sell on Zudomart, About, Contact, Open the web app; support → mailto.
- Request id: `server/apiTransport.service.ts` stamps `x-request-id` (backend echo or the generated outbound id, mock results too); `server/gateway.service.ts` returns `x-request-id` and BFF-generated errors carry one. `WebappRequestError` gains `requestId` + `retryAfterSeconds` (from `Retry-After`), so every ErrorState shows "Ref … · Code …" with copy.
- `readErrorMessageForDisplay` no longer leaks raw text for network/5xx/HTTP_xxx or generic kinds (uses catalog copy); domain 4xx messages and limit copy are kept.
- Offline: `components/ui/offlineBanner.tsx` → webKit `ConnectionStatus` (offline banner + "You're back online" toast); `onlineStatus.hook.ts` re-exports webKit `useIsOnline`. Web already mounts `OfflineBanner` (= ConnectionStatus).

## Next special files
| File | Screen |
|---|---|
| webapp `app/error.tsx`, `app/(app)/error.tsx` | `RouteErrorScreen` (serverError/500 hero, retry, digest as reference) |
| webapp `app/global-error.tsx` | own html/body + globals.css + ThemeInitScript → `GlobalErrorScreen` |
| webapp `app/not-found.tsx` | `NotFoundScreen` (404 hero, "This page wandered off", search + Feed/Clips/Mart/Live) |
| webapp `(app)/product/[productId]`, `(app)/p/[slugAndId]` not-found | contentGone/product (Ghost) |
| webapp `(app)/store/[storeId]` not-found | contentGone/store |
| webapp `(app)/user/[userId]`, `(app)/[username]` not-found | contentGone/profile |
| web `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` | same screens, marketing destinations (old EmptyFieldErrorScene removed) |
forbidden.tsx/unauthorized.tsx not added (need `experimental.authInterrupts` in next.config, off-limits).

## Call sites (webapp)
- `components/ui/feedback.tsx` `ErrorState` delegates to webKit (keeps `signInDescription` for 401s). ~60 call sites codemodded from `action={<RetryButton …/>}` to `error={query.error} onRetry=…` so mapping, reference id, offline auto-retry and the 429 countdown work everywhere.
- Explicit kinds: post page and comment thread (`subject="post"/"comment"` — gone/private/forbidden via mapper, replaces contentLoadFailureCopy), connections private list (contentPrivate), seller product missing (contentGone/product), escrow + dispute unavailable (orderNotFound), dispute already open (alreadyDone), live room (`subject="live"` → liveUnavailable) and unsupported browser for live video (`WEBRTC_UNAVAILABLE` → unsupportedBrowser/live, "Open in the app").
- Checkout: `CART_CHANGED`/`PRICE_CHANGED`/`CHECKOUT_EXPIRED` etc. render an inline cartChanged/checkoutExpired state ("Review your cart") and refetch the cart; payment flow logic untouched.
- Reset password: missing destination → linkExpired screen ("Get a new code"); OTP_TOKEN_INVALID/TOO_MANY_ATTEMPTS/RATE_LIMITED → inline linkExpired/tooManyAttempts/rateLimited.
- Auth layout: `CookiesRequiredNotice` (storageDisabled, Cookie icon) when cookies/localStorage are blocked.
- Media: `MediaImage` uses `ResilientImage` → ImageBroken placeholder when an image fails.
- Chat: `DecryptionNotice` adds LockKey icon, keeps chatCrypto wording ("Sent before this device joined secure chat.").
- Embed iframe: `renderUnavailableMarkup` → branded Storefront icon + "This store isn't available…" + "Visit Zudomart to keep shopping."
- Empty states moved to kinds: feed, search (explore, chats search, sounds), cart (cart, checkout), orders (orders list, seller orders/dashboard), wallet (wallet, transactions), notifications, inbox, products, reviews, lives, clips.

## Tests
- `apps/webapp/src/contracts/errorExperience.test.ts`: 429 request id + Retry-After → rateLimited with reference; 500 raw text never shown; 502 without body → maintenance; domain 409 copy kept; SESSION_EXPIRED/STEP_UP_REQUIRED/VERIFICATION_REQUIRED/COUNTRY_REQUIRED mapping; root not-found renders hero/search/destinations; product not-found renders gone copy.

# Error screens: dashboards (seller, admin, ads, studio)

All four apps render errors through the webKit error experience (`ErrorState`, `ErrorScreen`, `NotFoundScreen`, `RouteErrorScreen`, `GlobalErrorScreen`). Each app configures it once through `src/components/errors/errorExperience.provider.tsx`, which is mounted in the root layout (studio: `components/providers/appProviders.tsx`).

## Per-app wiring

| | seller | admin | ads | studio |
|---|---|---|---|---|
| Home link | `/dashboard` "Back to your dashboard" | `/` "Go to the console" | `/accounts` "Go to your ad accounts" | `/home` "Back to the studio" |
| 404 destinations | Orders, Products, Messages, Payments, Analytics | Overview, Users, Verification, Audit log, plus a user search (`/users?search=`) | Ad accounts, New ad account, Ad policy | Home, Content, Lives, Earnings, Audience |
| 404 copy (playful) | "Not in stock" | "This console page doesn't exist" | "This page ran out of budget" | "This page wandered off the stage" |
| Action hrefs/handlers | signIn `/login`, verify `/settings/verification`, upgrade `/settings/billing`, support (sellers mailbox), viewOrders, clearDebt `/wallet` | signIn, stepUp (handler: the registered step-up prompt, then reload), support (security mailbox, "Ask for access"), `describePermission` | signIn, verify (handler: opens AdsVerificationProvider through `verificationRequiredEventName`), support (ads mailbox) | signIn, accountStatus/appeal (webapp Account status), support (creators mailbox), useApp |
| Offline banner and back-online toast | `ConnectionStatus` in root layout | root layout | root layout | studio shell and auth layout. It is left out of the OBS overlay route on purpose, so the banner never appears on stream. |

## Next special files (Next 16.4; `error.tsx` receives `{ error, retry }`)

- `app/error.tsx` renders `RouteErrorScreen`: the "Something broke on our side" screen with the 500 hero, a retry button and the digest as its reference. The raw message is never shown.
- Segment `error.tsx`: seller `(workspace)` (new), admin `(console)`, ads `accounts/[accountId]` and studio `(studio)` all use `RouteErrorScreen`, so the app shell stays visible.
- `app/global-error.tsx` (new in all four) provides its own html/body, imports the app's `globals.css`, and adds `ThemeInitScript` in seller/ads/studio. Admin leaves it out because its CSP needs a nonce; there the theme follows the OS colour scheme. It renders `GlobalErrorScreen` with the app config passed in explicitly.
- `app/not-found.tsx` renders `NotFoundScreen` with the copy above. A segment `not-found.tsx` in the same four segments shows "We couldn't find that" with the same destinations.
- ads `invites/[token]/not-found.tsx` shows the `inviteInvalid` kind ("This invite isn't valid anymore"). `InviteAcceptance` maps 404/410 and `INVITE_*` codes to `inviteInvalid` as well.
- I did not add `forbidden.tsx` or `unauthorized.tsx`, because they need `experimental.authInterrupts` in next.config, which this pass must not touch. 401 and 403 are covered by the mapper (`signedOut`/`sessionExpired`/`forbidden`) and by the existing redirects.
- Removed the now-unused `notFound.module.css` files (seller, ads) and `not-found.module.css` (studio).

## Request id, Retry-After and details

- Transports (`sellerApiTransport`, `adminApiTransport`, `adsApiTransport`, studio `apiTransport`): every result now carries `x-request-id`. Mock results get the generated outgoing id, and real results use it when the backend did not echo one.
- Gateways: `x-request-id` was added to `returnedResponseHeaderNames`. BFF-generated errors (`respondWithBffError`, plus admin `bffResponses.service`) now set an `x-request-id`. Admin also passes backend `details` through.
- Client errors (`SellerApiRequestError`, `AdminApiRequestError`, `AdsApiRequestError`, `StudioRequestError`) gained `requestId` (from `readRequestIdHeader`), `retryAfterSeconds` (from `parseRetryAfterHeader`) and `details`.
- Admin FORBIDDEN from the BFF access table now includes `details.permission` (the first permission in the route requirement, or "superadmin"). `describeAdminPermission` turns it into the label from `adminPermissions.constant.ts`, which gives copy like: You don't have the "Ban users" permission. `AccessDeniedNotice` names the permission too, using `findRequirementForPagePath`.
- `readErrorMessageForDisplay` (seller, ads, studio) now calls the new webKit `readFriendlyErrorMessage`. A 4xx business message from the server is kept. Every other error gets the catalog's "Title. Description" copy, so raw 5xx or internal text never reaches the UI. Admin's raw `error.message (CLIENT_ERROR)` fallback was removed; admin's coded server messages stay for staff toasts.
- Removed "Something went wrong": seller `clientApi` and `chatCrypto/tabLeader`, ads client, studio client and `authentication.service`, and the mock-failure strings in the transports.

## Inline and section errors

- Hooks: `useSellerQuery`, `useCursorPagedList`, `useAdminQuery`, `useAdminMutation` and `useAdsQuery` now expose `error: unknown` next to `errorMessage`.
- Feedback components now delegate to webKit `ErrorState`, with `variant` defaulting to `inline`. Call sites that `return` the component use `variant="section"`, which centres it. The components are seller `ErrorCallout`, admin `ErrorBlock`, ads `ErrorState` (also accepts `kind`) and the studio `ErrorState` wrapper. They pick the error type from `error` through the central mapper. `resolveCallerErrorCopy` keeps the server's 4xx wording; for everything else the catalog copy applies.
- Codemods: seller 40 `ErrorCallout` sites, admin 37 plus 47 destructured `ErrorBlock` sites, ads 22 `ErrorState` sites, and studio 16 `description={readErrorMessageForDisplay(q.error)}` changed to `error={q.error}`. Studio's live-not-found now uses `liveUnavailable`, and post-analytics 404 uses `contentGone`/post.
- The empty states in seller, admin and ads keep their ZudoIcon API but are centred, with a 64px tinted circle and ring. Admin's empty state gained an icon (`squaresFour24` by default).

## Error types as the dashboards see them (icon, then copy summary)

- forbidden (ShieldWarning): admin names the missing permission; elsewhere "Your account or role doesn't include this."
- stepUpRequired (ShieldCheck): admin "Confirm it's you" opens the shared step-up prompt.
- verificationRequired (SealCheck): seller links to `/settings/verification`; ads opens the verification prompt.
- planFeatureRequired (Crown) and quotaReached (Database): seller `PLAN_FEATURE_REQUIRED` and `PRODUCT_LIMIT_REACHED` get "See seller plans", linking to `/settings/billing`.
- sellerDebtLimit (Wallet): "Selling is paused…" with "Settle balance", linking to `/wallet`.
- inviteInvalid (EnvelopeOpen): ads invites.
- liveUnavailable (VideoCameraSlash) and contentGone (Ghost): studio lives and posts.
- offline (WifiSlash), timeout, serverError (Bug, 500 hero), maintenance (Wrench), rateLimited (Gauge, with a Retry-After countdown on the retry button), sessionExpired/signedOut (SignIn) and the rest: generic, through the mapper.

## Tests

- `src/contracts/errorScreens.test.ts` in each app checks three things. The root 404 has a focused h1, the 404 hero, dashboard destinations and no "Something went wrong". The segment not-found renders. The route error boundary shows the server-error screen with the digest reference and hides the raw message.

# Mobile error experience (apps/mobile)

## Architecture
- Central mapper: `src/errors/errorExperience/` — `errorKinds.ts`, `errorCatalog*.ts`, `errorMapper.ts` (code table `errorKindByCode` + status fallback), `errorSignal.ts`, `limitMoney.ts`, `retryCountdown.ts`, `emptyCatalog.ts` are copies of `packages/webKit/src/errorExperience` (same kind names, code table and copy). Mobile-only tweaks: `unsupportedBrowser` → "This device isn't supported"/Update; `liveUnavailable` needsApp → "Update to watch this live"; clock-skew copy mentions phone settings; `AbortError` (client timeout) → timeout.
- Mobile glue: `describeError.ts` (offline override + `describeActionFailure` for inline/dialog errors), `errorActions.ts` (intent → navigation/Linking handlers), `globalErrorHandler.ts` (react-query QueryCache/MutationCache `onError` + `shouldRetryQuery`), `useRetryCountdown.ts`.
- `ApiError` now carries `requestId` (response `x-request-id`, else the `X-Request-Id` the client now sends) and `retryAfterSeconds` (Retry-After). Both `services/core/apiClient.service.ts` and the legacy `services/apiClient.service.ts` were updated. Default backend-less message is "Request failed (HTTP n)" (never shown; screens use the mapper).
- Components: `components/ui/errorState.tsx` (`ErrorState`, `ErrorScreen`; variants page/section/inline/compact; legacy `message/detail/onRetry/retrying/compact` kept), `errorHalo.tsx` (tinted circle + 2 rings + glow; float/breathe/glitch via reanimated; off with reduce motion), `errorReference.tsx` (Ref · Code + copy via expo-clipboard), `emptyState.tsx` (presets), `errorBoundary.tsx` (`ErrorBoundary`, `withScreenErrorBoundary`), `requiresConnection.tsx` (offline overlay for online-only routes), `screens/system/notFound.screen.tsx`.
- Icons: 30 glyphs added to `components/icons/phosphorGlyphs.ts`; `components/icons/errorIcons.tsx` maps every `ErrorIconName` (kept out of the barrel so `iconBarrel.test` count stays 184).

## Wiring
- Root `ErrorBoundary` in `App.tsx`; per-screen boundaries for every stack + tab screen via `screenLayout` in `main.navigator.tsx` / `mainTabs.navigator.tsx` (reset on route key).
- Deep-link 404: `NotFound: "*"` in `linking.config.ts`, `NotFound` stack screen → "This page wandered off", 404 hero, search field (opens Search), Feed/Clips/Mart/Live shortcuts. Note single-segment unknown links still resolve to `UserProfileByUsername` (`:username`), which shows profile-not-found.
- Offline: `cache/offlineIndicator.tsx` banner (WifiSlash, role summary/polite) with "N actions will send when you're back online"; "You're back online" success toast on reconnect via toast store. `ErrorState` offline kind auto-retries on reconnect and "Check again" uses `NetInfo.refresh()`. Online-only routes (Live, Checkout, Payment, AddMoney, Withdraw, PayoutSetup, IdentityVerification, VerificationApply) get a full offline screen overlaid (screen stays mounted, so payment state is untouched).
- Global: `APP_UPDATE_REQUIRED`/426 → `appGate.store` → blocking update screen in `RootNavigator` (no backend min-version signal exists today). `SESSION_EXPIRED` while signed in → one toast (token refresh already signs out). Queries no longer retry 400/401/403/404/409/410/413/415/422/426.
- 53 `ErrorState` call sites now pass `error={query.error}`; destructured ones (wallet, seller, settings, subscriptions…) got `error`; raw `error.message` ErrorStates replaced; 18 non-money mutation error texts now use `describeActionFailure` (keeps specific validation copy, maps known codes/transport failures). Money screens (withdraw, payout accounts, bank step, verification apply/identity) were left as-is for the payments agent.
- "Something went wrong" removed from dialogHost, stepUpSheet, coinWallet.hook, chatPasscode, apiClient (crossPlatformAlert keeps the phrase only inside a tone-detection regex).

## Inventory (kind → icon → copy summary → mobile usage)
| Kind | Icon | Copy (title) | Where in mobile |
|---|---|---|---|
| offline | WifiSlash | You're offline — check data or Wi-Fi, auto reload | any ErrorState when NetInfo offline; RequiresConnection overlay; offline banner |
| timeout | Hourglass | This is taking too long | client AbortError/408/504 |
| serverError | Bug (glitch, 500 hero) | Something broke on our side | 5xx; ErrorBoundary ("This screen hit a snag") |
| maintenance | Wrench | We'll be right back (+ backend maintenanceMessage/endsAt) | 502/503, UPSTREAM_UNAVAILABLE |
| rateLimited | Gauge | Slow down a little + countdown button | 429 / *_RATE_LIMITED |
| tooManyAttempts | LockKey | Sign-in is paused | TOO_MANY_LOGIN_ATTEMPTS, ACCOUNT_LOCKED |
| updateRequired | ArrowCircleUp | Update Zudomart to continue → store | APP_UPDATE_REQUIRED/426 global gate |
| unsupportedBrowser | Browser | This device isn't supported | WEBRTC_UNAVAILABLE |
| clockSkew | Clock | Your device time looks wrong → Open settings | CLOCK_SKEW |
| securityCheckFailed | Robot | We couldn't confirm you're human | HUMAN_VERIFICATION_FAILED |
| notFound | MapTrifold (404 hero) | This page wandered off | NotFound route, 404s |
| linkExpired | LinkBreak | This link has expired | LINK_EXPIRED, OTP_TOKEN_INVALID… |
| inviteInvalid | EnvelopeOpen | This invite isn't valid anymore | INVITE_* |
| signedOut / sessionExpired | SignIn | Sign in to continue / Your session has ended | 401s; guest sign-in prompt |
| forbidden | ShieldWarning | You don't have access to this | 403, comment thread denied |
| stepUpRequired | ShieldCheck | Confirm it's you → `handlers.stepUp` (useStepUpPrompt) | STEP_UP_* |
| verificationRequired | SealCheck | Verify your identity first → IdentityVerification | VERIFICATION_REQUIRED, BVN_REQUIRED |
| emailNotVerified | Envelope | Confirm your email (Resend via handler) | EMAIL_NOT_VERIFIED |
| accountSuspended | UserCircleMinus | Your account is suspended (copyright ladder wording) → Account status | SUSPENDED… (SuspendedAccountScreen still gates whole app) |
| accountRestricted | Warning | This feature is restricted | RESTRICTED, WALLET_ON_HOLD |
| contentGone (post/clip/story/product/store/profile/live/comment) | Ghost / VideoCameraSlash | This post is gone / This store has closed / … | *_NOT_FOUND, 410, comment thread |
| contentPrivate | LockKey | This account is private | connections screen, ACCOUNT_PRIVATE |
| contentBlocked | Prohibit | You can't see this | BLOCKED |
| contentRemoved | ShieldWarning / Copyright | Removed for breaking our rules / after a copyright notice | TAKEN_DOWN, COPYRIGHT |
| sensitiveContent | EyeSlash | Sensitive content (Show anyway) | existing `feed/sensitiveContentGate.tsx` stays the cover UI |
| mediaFailed | ImageBroken / FilmStrip | This image didn't load / This video won't play | MEDIA_UNAVAILABLE |
| decryptionFailed | LockKey | Message unavailable on this device — "Sent before this device joined secure chat." | DECRYPTION_FAILED (chat bubbles keep chatCrypto failureCopy) |
| liveUnavailable | VideoCameraSlash | This live has ended / isn't available / Update to watch | LIVE_* |
| orderNotFound | ReceiptX | We can't find that order → Orders | ORDER_NOT_FOUND |
| storeClosed | Storefront | This store is on a break / closed | STORE_CLOSED |
| outOfStock | Package | Sold out | OUT_OF_STOCK, FLASH_SALE_SOLD_OUT |
| regionUnavailable | GlobeHemisphereWest | Not available in your country | product detail region gate |
| deliveryUnavailable | Truck | We can't deliver there yet → Change address | NOT_DELIVERABLE |
| checkoutExpired / cartChanged | ClockCounterClockwise / ShoppingCart | Your checkout timed out / Your cart changed → Cart | CHECKOUT_*, PRICE_CHANGED |
| paymentFailed / paymentPending | CreditCard / Hourglass | Payment didn't go through / still processing | PAYMENT_* |
| paymentLimit | Wallet | Daily limit reached (remaining amount) / outside the limit | WALLET_DAILY_LIMIT, PAYMENT_AMOUNT_OUT_OF_RANGE |
| sellerDebtLimit | Wallet / Storefront | Selling is paused → Wallet | SELLER_DEBT_LIMIT |
| countryRequired | GlobeHemisphereWest | Choose your country → App preferences country picker | COUNTRY_REQUIRED |
| planFeatureRequired / quotaReached | Crown / Database | Not included in your plan / You've reached your limit | PLAN_FEATURE_REQUIRED, *_LIMIT_REACHED |
| fileTooLarge / unsupportedFile / uploadFailed | FileX / UploadSimple | That file is too large / type isn't supported / Upload didn't finish | FILE_TOO_LARGE, UNSUPPORTED_*, UPLOAD_* |
| alreadyDone / versionConflict | CheckCircle / ArrowsClockwise | This was already done / This changed while you were here | ALREADY_*, VERSION_CONFLICT |
| permissionDenied (camera/mic/location) | Camera / Microphone / MapPin | Allow camera access → Linking.openSettings | *_PERMISSION_DENIED |
| unknown | Warning | That didn't work (caller copy wins) | fallback |
| empty: feed/search/cart/orders/wallet/notifications/inbox/… | Compass/MagnifyingGlassMinus/ShoppingCart/Receipt/Wallet/Bell/ChatsCircle | presets in `EmptyState kind=…` | available; existing call sites keep their own copy |
