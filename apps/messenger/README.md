# Nantty Messenger (Expo)

This is the React Native/Expo Messenger app for Android and iOS, aligned to the Expo SDK 58 / React Native 0.88.1 versions already used by `apps/mobile`. Its messaging surface now uses Nantty's encrypted chat protocol, authenticated realtime endpoint, and notification/device-token APIs. Read [Chat Bubbles implementation and limits](docs/chat-bubbles.md) before making native-build or release claims.

## Product boundaries

- Messenger is communication-first and contains no feed, marketplace browsing, clips, live rooms, Spaces, advertising, ad SDKs, or tracking.
- Ordinary messaging and Stories are intended to use the same Nantty identity and backend records as the main app.
- Business messages and shared product/order references may appear inside a conversation later; this app does not add commerce browsing or checkout.
- The current UI does not fabricate conversation, message, or Story data. Empty inbox, API failure, and not-yet-integrated screens are distinct states.

## Structure and design patterns

```text
index.ts                          Expo entry point
app.json                         independent app identity and native configuration
src/
  App.tsx                        composition root
  MessengerRoot.tsx              session gate and system appearance
  auth/AuthProvider.tsx           login, refresh rotation, sign-out, secure token storage
  api/apiClient.ts                real HTTP transport and typed failures
  api/conversations.ts            inbox projection of the existing mobile API DTO
  api/messengerChat.service.ts     E2EE key bootstrap, sealed cache/outbox, encrypted send/read
  api/messengerRealtime.service.ts authenticated shared /ws protocol for chat updates and typing
  api/messengerNotifications.service.ts push token registration and platform channels
  notifications/                   secure notification-action routing and encrypted reply dispatch
  navigation/MessengerAppShell.tsx adaptive phone tabs / tablet side rail
  screens/SignInScreen.tsx        existing Nantty login endpoint
  screens/InboxScreen.tsx         server-backed conversation list, search, retry/refresh
  screens/StoriesScreen.tsx       explicit integration boundary (no fake Story content)
  screens/ConversationScreen.tsx   encrypted conversation view and text composer
  screens/SettingsScreen.tsx      bubble, preview, sound, vibration, push and session settings
  ui/FloatingConversationBubbles.tsx in-app draggable bubbles and compact conversation modal
  ui/                            brand lockup, navigation item, state panels, theme hook
```

The shell uses Expo's monorepo-aware Metro defaults, React Native primitives, the shared `@nantty/design-tokens` semantic light/dark palette, the existing Nantty app icon asset, and `phosphor-react-native` 3.0.6 (the same icon pack as the main mobile app). On narrow windows it uses a bottom tab bar; at 820 logical pixels and wider it switches to a side rail. Colors come from the shared Nantty tokens; the brand blue is not redefined here.

The inbox row type is a deliberately small local projection of `apps/mobile/src/types/messaging.type.ts::Conversation`, because `@nantty/contracts` currently has no shared messaging DTO export. The app calls the existing conversation, encrypted-message, device-key, chat-settings, read, notification-token, and realtime-token APIs. It does not import application screens or code from `apps/mobile`.

## Authentication and API configuration

Messenger authentication uses a dedicated step-up flow; it does not call the generic login endpoint:

- `POST /api/v1/auth/messenger/authorizations` validates existing Nantty credentials. A trusted device can receive a session; a new installation receives a short-lived proof-bound authorization request and no session.
- `GET /api/v1/auth/messenger/authorizations/{id}` checks that request using the proof only in an Authorization header.
- `POST /api/v1/auth/messenger/authorizations/{id}/verify-code` and `/recovery/*` complete the approved verification paths; `/complete` issues the session once.
- `POST /api/v1/auth/refresh` with `{ refreshToken }` (refresh-token rotation).
- `GET /api/v1/users/me` to restore the account summary.
- `POST /api/v1/auth/logout` when signing out.
- `GET /api/v1/auth/messenger/devices` and `DELETE /api/v1/auth/messenger/devices/{id}` list/revoke remembered installations.
- `GET /api/v1/conversations?filter=all` for the actual inbox.

Development defaults are platform-aware (Android emulator `10.0.2.2`, iOS simulator `localhost`). A physical device needs a reachable LAN/HTTPS development origin. EAS preview/production must configure the real HTTPS API origin; the current intended host is `api.nantty.com`, which did not resolve during this implementation, so live API reachability remains a deployment blocker. User-facing errors are sanitized and never disclose environment or server configuration.

The Messenger app identifiers are independent (`com.nantty.messenger`, scheme `nantty-messenger`). Android/iOS secure storage belongs to this app and is not shared with `apps/mobile`; Messenger persists its own rotated refresh token and trusted-device credential with Expo SecureStore. It never copies or reads the main app's session. Signing out revokes the remembered Messenger device when the API is reachable and clears local credentials regardless of the network result.

The main app’s Settings → Security screen lists pending Messenger sign-ins, shows device/platform/time/location when available, and offers approve, deny, one-time-code issuance, and trusted-device revocation. Email recovery sends a login-purpose OTP only to the verified account email and authorizes only that specific pending request; it does not issue a session until `/complete` succeeds. See [`docs/architecture/messenger-auth-contract.md`](../../docs/architecture/messenger-auth-contract.md) for the API and threat-control contract.

## Run and verify

From the repository root, with the pinned Node 26.13.0 runtime:

```sh
pnpm install --filter @nantty/messenger
pnpm --filter @nantty/messenger start
pnpm --filter @nantty/messenger typecheck
pnpm --filter @nantty/messenger test
```

The Android Bubble notification renderer is supplied by `plugins/withAndroidChatBubbles.js`; it customizes Expo Notifications' existing presentation receiver and preserves ordinary notifications as the failure/unsupported fallback. Use a native development or production build (`pnpm --filter @nantty/messenger android`, EAS Build, or the repo's Android Gradle target); Expo Go cannot load this custom Kotlin integration. iOS supports interactive notification actions and in-app bubbles only.

## Integration and release gates

The following are deliberately visible gaps, not hidden placeholders:

1. **Conversation richness:** this Messenger surface currently sends encrypted text and renders encrypted text history. It does not yet include quote-replies, reactions, attachment upload/rendering, message pagination, or the main mobile app's complete control-message folding UI.
2. **Stories:** the shared Story API/viewer/replies/privacy/expiry are not connected; Messenger shows an explicit integration state and contains no ads.
3. **Native/device release checks:** bubble visibility, notification action presentation, device revocation, and OS setting behavior still require a built Android device/emulator and iOS device/simulator. An installed development build has not been exercised in this workspace.
4. **Production readiness:** verify push credentials, migration application, deployed API reachability, App Links/Universal Links, app signing, privacy disclosures, secure-store behavior, and native E2E tests before release.

The pasted Messenger/API specifications remain the broader product target. This implementation must not be described as a complete or production-ready Messenger client until the remaining gaps and native release tests are closed.
