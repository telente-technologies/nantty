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
