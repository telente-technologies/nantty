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
