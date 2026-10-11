# Widgets report (2026-10-10)

Nothing is committed. The full API contract is in `docs/architecture/widgetsApiContract.md`.

## STOP: package blocked by the supply-chain policy

**`expo-notifications@57.0.22` fails `trustPolicy: no-downgrade`** (`ERR_PNPM_TRUST_DOWNGRADE`: earlier versions had a trusted publisher, but 57.0.22 has no provenance). I added no exception and the lockfile is unchanged.

Effect: the app can't receive the widget-refresh silent pushes yet. The server side is built and tested. Widgets refresh on their 20–30 min timeline and through `expo-background-task`.

To enable it, the owner can approve an exact `trustPolicyExclude` entry for `expo-notifications@57.0.22`, like the other Expo 57 patches. The app then also needs Expo push-token registration (`POST /api/v1/notifications/device-tokens`) and a background-notification handler that calls `syncHomeScreenWidgetsNow({ force: true })`.

## Packages added (both pass the policy, with no build scripts)

- `@bacons/apple-targets@5.0.0`, published 2026-07-17. It works with SDK 57 (verified with prebuild). It pulls in `@expo/config-plugins@55` internally.
- `react-native-android-widget@0.22.1`, published 2026-08-17. Peer dependency: `expo >= 54`.

## Widget token (auth, gateway, Go)

- `POST` and `DELETE /api/v1/auth/widget-token` are in `services/go/modules/auth/src/modules/widgetTokens`.
- The token is a JWT with `aud: zudomart-widgets` and `scope: widgets:read`, bound to `sid` and `jti`, with a 24h TTL (`AUTH_WIDGET_TOKEN_TTL`).
- There is one current `jti` per session in Valkey, so rotating the token revokes the previous one.
- Signing out or revoking the device denylists the session for the token's lifetime and deletes the key.
- Signing keys stay published for the longest token TTL.
- Verification:
  - Gateway: `src/services/widgetTokenVerifier.service.ts` and `src/routes/widget.routes.ts`. A widget token is accepted only on `GET /api/v1/widgets/*`; anything else gets `401 WIDGET_TOKEN_SCOPE`.
  - Go: `platform/jwtauth/widgetToken.go` (`RequireAccessTokenOrWidgetToken`). It fails closed if Valkey errors.
- Storage: iOS App Group keychain (`group.com.zudomart.app`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`); Android `expo-secure-store` (Keystore).

## Endpoints (each in the service that owns the data, with no aggregator)

`orders` and `seller-today` (go-commerce), `live-now` (go-live), `creator-today` (go-money creators), `stories` (social).

- Every endpoint has a 45s cache per viewer, `private, max-age=60`, and a gateway limit of 30/min per account.
- `?amounts=hidden` means money values are never computed.
- The creator stats need a new social read-grant migration: `prisma/migrations/20261010220000_grant_widget_reads` (follows.createdAt, posts(id, authorId, deletedAt), post_daily_stats).
- Silent push: `services/typescript/notifications/src/modules/widgetRefresh`. It sends Expo data-only pushes, budgeted to one per user per widget per 5–30 min window. Story refreshes fan out through paged jobs to bell subscribers only.

## Mobile (apps/mobile)

- **JS bridge:** `src/services/widgets/*`. It uses lazy requires and is a no-op in Expo Go. It syncs after login, on foreground and in a 30-min background task, and clears everything on sign-out through `registerSignOutHook`.
- **Settings:** a new Widgets screen (`settingsWidgets.screen.tsx`) with "Hide amounts on widgets", ON by default, and a short how-to.
- **Deep links:** `orders/:orderId`, `seller/dashboard`, `creator/dashboard`, `stories/:userId`, `settings/widgets`.
- **iOS:** `targets/widgets/*.swift`, a WidgetKit extension with 5 widgets.
  - Sizes: small and medium; Stories also has large (1, 4 or 8 people).
  - Light and dark colors come from the design tokens, and a jest test keeps them in sync.
  - Signed out, a widget shows "Sign in to Zudomart".
- **Android:** `src/widgets/android/*` using react-native-android-widget, with `updatePeriodMillis` set to 30 min.
- **Config:** `app.json` adds the App Group entitlement and both plugins.
- **Prebuild check** (scratch copy, then deleted):
  - iOS: the `ZudomartWidgets` appex target is created (bundle `com.zudomart.app.widgets`, iOS 17) and both targets carry the App Group entitlement. The EAS `appExtensions` entry is created.
  - Android: 5 receivers (`exported=false`) and their provider XML.
- **Warnings:**
  - `ios.appleTeamId` is not set. EAS sets signing, but add it to `app.json` for local Xcode builds, and register `group.com.zudomart.app` in the Apple Developer portal.
  - Android `allowBackup="true"` is an existing app-wide setting. Widget snapshots are masked, but turning it off is still advisable.
  - No Xcode is available here, so the Swift code wasn't compiled. Build it with EAS.

EAS build to test widgets:
```
cd apps/mobile && eas build --profile development --platform all
```
(or `--profile preview --platform android` for an installable APK)

## Web embed

- **Webapp:**
  - `src/app/embed/[kind]/[id]/route.ts`, `embed/loader.js`, `oembed`, and an unframeable 404 for unknown `/embed/*` paths.
  - `next.config.ts` excludes embed and oembed from the global `frame-ancestors 'none'` rule; `src/proxy.ts` skips them; `embed` and `oembed` are added to the frontend reserved routes.
- **Policy:** any active store not hidden by moderation can be embedded, with its public, active, published products. Auto-lists show in-stock items only. Suspended stores render "unavailable" (404).
- **Builders:**
  - Seller: `/storefront/embed` ("Embed on your site" in the Catalog nav).
  - Studio: `/embed`. Creators get a Buy button for any product link, plus a store card or products if they own a store.
  - Both have options, a live sandboxed preview and a copy button. Their CSP `frame-src` allows the webapp origin. Phosphor icons are used: `code20` and `CodeIcon`/`CopyIcon`.
- **Shared code:** the snippet builder is in `packages/webKit/src/embed/embedSnippet.ts`.

## Webapp CSP: storage upload origin (coordinator request)

`apps/webapp/next.config.ts` now adds the media upload origin to `connect-src` only:
- **Dev:** `S3_PUBLIC_ENDPOINT` (default `http://localhost:18333`, the local SeaweedFS/MinIO).
- **Prod:**
  - If `S3_PUBLIC_ENDPOINT` is unset, it uses the AWS bucket host `https://${MEDIA_QUARANTINE_BUCKET}.s3.${S3_REGION}.amazonaws.com`. These are the same variables the media service uses for presigned uploads.
  - `WEBAPP_UPLOAD_ORIGINS` (a comma-separated list) adds any other origins.
- `.env.example` is updated with these variables.
- Verified for dev, prod and a custom endpoint. The identity-verification CSP inherits the change; the embed CSP keeps `connect-src 'none'`.

## Test results

- **Go:**
  - `platform`: pass (jwtauth widget scope, revocation and rotation; widgets cache).
  - `modules/auth`: pass (new integration test against real Postgres and Valkey):
    - a widget token can't call `/auth/sessions`, mint itself or step up;
    - rotation, DELETE and sign-out each kill it;
    - each device is independent.
  - `modules/orders`: pass (active orders, out-for-delivery, seller today with hidden amounts).
  - `modules/creators`: pass (widget-only scope; no money moves; amounts hidden; non-member).
  - `modules/live`: the widget test passes.
- **Live failure (not mine):** `TestReleasingAnOlderIncidentKeepsTheHoldOfTheCurrentIncident` fails. It is in an untracked test file from another agent's in-progress live safety-hold work.
- **TS services:**
  - gateway: 1629/1629. New tests: widget routes are GET-only, and a widget token is refused on 8 non-widget routes with zero upstream hits.
  - social: 371 pass (stories visibility tests).
  - notifications: 255 pass (silent-push plan, budget and fanout).
- **tsc:** clean for mobile, webapp, web, seller and studio.
- **Frontend tests:**
  - mobile jest: 311/311 (bridge no-op in Expo Go, keychain options, deep links, colors match tokens, hide amounts).
  - webapp units: 147 pass.
  - seller contracts: 27; studio contracts: 25.
- **Embed security checks** (unit level):
  - Embed CSP allows `frame-ancestors *` and sets no cookies.
  - Every other path keeps `frame-ancestors 'none'` and DENY. Checked with Next's own path matcher: `/`, `/store/x` and `/embedded.user` keep the headers, while `/embed/*` and `/oembed` are excluded.
  - Unknown `/embed/*` paths return an unframeable 404.
  - The loader ignores postMessage from a wrong origin, a wrong window or a wrong frame id.
  - Seller text is escaped and only https images load.
  - A suspended store renders the unavailable page (404).
  - The iframe is sandboxed without `allow-same-origin`.
- **Lint:** clean on all touched mobile, webapp, seller and studio files.
- **Prebuild:** validated in a scratch copy, then deleted.

## Follow-up: client side of the widget silent push

The coordinator installed `expo-notifications@~57.0.22` with an exact `trustPolicyExclude` entry. I did not touch package.json or the lockfile.

- **`src/services/widgets/widgetPush.service.ts`:**
  - Loads expo-notifications lazily. It does nothing in Expo Go, on web or if the module is missing.
  - Gets the Expo push token (`projectId` from `extra.eas`) without showing a permission prompt; silent data pushes don't need one.
  - Registers the token once per value with `POST /api/v1/notifications/device-tokens`.
  - Defines the background task `zudomart-widget-refresh-push` and registers it with `registerTaskAsync`.
  - A foreground `addNotificationReceivedListener` handles data messages while the app is open.
- **Payload handling:** a tolerant parser reads `{ type: "widgetRefresh", widgets: [...] }` from the raw data, `data.dataString` (Android), `data.body`, or `notification.request.content.data`. It refreshes only the widgets named in the push.
- **Sign-out:** the hook first sends `DELETE /api/v1/notifications/device-tokens` with `{ token }`, so the device stops receiving the previous user's pushes. To support this, `api.delete` now accepts an optional body (backward compatible).
- **Registration timing:** registration runs inside every widget sync after the session is restored, so it also re-registers after a sign-out and sign-in.
- **Conflicts:** none. The app had no expo-notifications usage, no `setNotificationHandler` and no device-token registration. I didn't add `setNotificationHandler`, so future visible-notification work can own it.
- **Config:**
  - The `app.json` plugin entry is `["expo-notifications", { enableBackgroundRemoteNotifications: true, color: "#3A2BFF" }]`.
  - `expo config --type introspect` shows iOS `UIBackgroundModes` with `remote-notification`, alongside the existing `fetch`, `audio` and `processing`.
  - Android needs no extra plugin flags for data-only messages.
- **Mocks:** device-token POST and DELETE mock routes were added.
- **Tests:** `__tests__/widgetPush.test.ts` covers the payload shapes, ignoring other pushes, the Expo Go no-op, one-time registration and listener, removing the token on sign-out, and the no-token path.
- **Results:**
  - Mobile jest: 59 suites, 321/321 pass.
  - Lint is clean.
  - Mobile tsc shows no errors in widget or push code. Its 7 errors all belong to another agent's in-progress chat change (`Message.sharedContent`, `NewGroupConversationInput.photoMediaId`).
- **Owner actions for real delivery:**
  - Android: add a Firebase `google-services.json` (`android.googleServicesFile`) and upload FCM credentials to EAS.
  - iOS: EAS needs an APNs key for the bundle (EAS can generate it).
  - Rebuild with `cd apps/mobile && eas build --profile development --platform all`.
