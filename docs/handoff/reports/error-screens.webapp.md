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
