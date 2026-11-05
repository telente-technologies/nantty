# Android guest browsing and social sign-in parity

## React Native behavior used as the reference

- The auth onboarding screen can start a guest session. The root navigator then opens the normal app shell, with public browsing routes available and auth-gated actions replayed after a successful sign-in when possible.
- Google sign-in obtains an ID token and nonce, then posts them to `POST /api/v1/auth/google`. Apple sign-in is exposed only where `expo-apple-authentication` reports support (iOS); it is not an Android provider button.
- The backend verifies the provider token, audience, verified email, and nonce. New social accounts must additionally provide a birthday and pass the minimum-age gate.

## Kotlin Android implementation

- The auth welcome step offers **Browse as guest**. Guest mode is in-memory only and does not create a fake account or session.
- The direct Kotlin sign-in screen now also offers **Continue with Google** when the server OAuth client ID is configured; it calls the same Credential Manager flow as the welcome screen, surfaces provider errors on the sign-in surface, and is omitted when configuration is absent. Apple remains unavailable on Android, matching RN platform capability behavior.
- Guests can browse the implemented public feed, Mart catalogue/product details, and public Discover/search. Public post/profile/product detail can be opened from public results; engagement actions remain disabled.
- Cart, wallet, orders, messages, Following, posting, saved items, and other private destinations require sign-in. A guest who activates an auth-required affordance returns to the auth gateway.
- Google uses Android Credential Manager's Sign in with Google credential flow. The Android app sends the returned ID token and a cryptographically random nonce to Nantty; it never validates or trusts the provider token locally. The resulting Nantty session is persisted through the existing Keystore-backed encrypted session repository.
- First-time Google accounts receive the backend `BIRTHDAY_REQUIRED` response; the client retains the token only in memory, asks for a date of birth, validates the date and minimum age locally for UX, then retries the same token exchange with the ISO birthday. The server remains authoritative.
- Apple sign-in is intentionally unavailable on Android, consistent with the React Native platform capability check. Apple login remains on the iOS client.

## Social account birthday challenge — 2026-11-05

React Native now handles the backend's first-time Google and Apple `BIRTHDAY_REQUIRED` response instead of surfacing it as a generic sign-in failure. It retains only the provider token, nonce, and (for Apple) returned full name in the active screen hook, prompts for a date of birth, validates the date/minimum-age range for user feedback, and retries the same provider exchange with `birthday`. The backend remains authoritative for birthday and age acceptance. Cancel/dismiss clears the challenge, credentials are not persisted to navigation params or device storage, and an unrelated provider/network error does not enter the birthday flow.

The Kotlin Android Google path already implements the same challenge/retry contract through its transient auth registration state and Credential Manager. Apple remains iOS-only. Local RN service tests cover token/nonce reuse for both provider payloads and propagation of non-birthday errors; onboarding tests cover the prompt and retry request. The Go auth integration test covers the missing-birthday challenge followed by successful token reuse with birthday, but it was **skipped in this run** because the configured local PostgreSQL instance was not reachable. Provider configuration and a live device/provider round-trip remain unverified.

## Runtime setup and limitations

Set `NANTTY_GOOGLE_SERVER_CLIENT_ID` (or Gradle property `nanttyGoogleServerClientId`) to the Google OAuth **Web/server client ID** used by Credential Manager. Configure that same audience in the backend's `AUTH_GOOGLE_CLIENT_IDS`. This is a public OAuth client identifier, not a client secret; do not embed OAuth secrets in the app. When the client ID is absent, the Google button is hidden. The backend provider configuration is deployment-specific and was not inspected or changed in this local implementation.

The backend also supports Apple identity verification through `AUTH_APPLE_CLIENT_IDS`, but native Android does not initiate Apple authentication. React Native now handles the same first-time birthday challenge for both supported provider clients without changing Android's provider availability.

## Verification boundary

Unit tests cover the guest destination policy and the Google HTTP request/session/error contract. Android instrumentation source covers the welcome guest affordance and the direct sign-in Google option (visible/click callback when configured; hidden when unconfigured) and is compiled separately; execution requires a connected emulator/device. A successful local build does not establish that Google OAuth consent, signing fingerprints, backend provider audiences, or deployed secrets are configured.

## Cross-client gaps confirmed in the 2026-11-04 source audit

| Flow | Difference and evidence | Priority / next safe action |
|---|---|---|
| Guest action return (2026-11-04 audit snapshot; updated below) | RN retains a transient action callback plus the focused return route (`apps/mobile/src/utils/requireAuth.util.ts`, `components/auth/guestAuthReplay.tsx`). Android previously exited guest mode and lost that action/context. RN supports a broader public shell including Clips/Stories/Live; Android currently exposes Feed, Mart and Discover. | **High.** See the 2026-11-05 implementation update below; only the explicitly tested Explore follow action is replayed on Android. |
| First-time social registration | RN and Kotlin Android now handle the backend `BIRTHDAY_REQUIRED` challenge and retry the same provider identity proof with birthday; Android exposes Google, while Apple remains iOS-only. | **Source-implemented and locally tested.** Verify live provider configuration and device flows; server-side birthday/age validation remains authoritative. |
| Recovery back navigation | RN retains the verified reset token in shared auth state while navigating; Android holds it in transient recovery-flow state and returning after OTP can discard it. | **Medium.** Keep verified state across recovery subroute back navigation without persisting secrets longer than necessary; cover with flow tests. |
| Identifier copy | RN login service accepts an identifier but labels its field “Email”; Android labels email-or-username. | **Low.** Align user-facing copy with supported input, after confirming RN behavior is intended. |
| Demo mocks | RN development/demo profiles can use fixed auth mocks, while Android AuthApi calls the configured API. | **Important test boundary.** A development RN success is not evidence of server/OAuth parity; compare production/preview behavior or force integration mode for parity validation. |

The Android-only Following intent is implemented: tapping Following while browsing as guest stores that read-only feed choice in saveable root state, opens auth, and selects/loads Following after a successful sign-in. `FeedTabSelectorTest` covers the dedicated intent-preserving callback and verifies the guest selection does not prematurely change the active tab. General guest action replay, recovery back-navigation, and live provider integration remain open except for the bounded Explore follow slice below.

## Protected guest action return and replay — 2026-11-05

React Native behavior was verified in source and a new integration-style coordinator test. `requireAuthThen` captures the focused route and an in-memory action callback; `GuestAuthReplayCoordinator` waits for a signed-out-to-signed-in transition, closes the auth modal, returns to the captured route, and invokes the callback once. `AuthFlowScreen` discards the intent on unmount when the viewer is still signed out, so canceling auth does not leave a stale action to run on a later unrelated sign-in.

Kotlin now keeps the guest app shell composed under a full-screen auth dialog, preserving the active screen and its state instead of rebuilding a default destination after sign-in. Dialog dismissal, system Back, and choosing Browse as guest discard the pending callback and return to the still-mounted guest screen. On successful session creation, a transient `PendingGuestAction` is atomically taken/cleared before invocation. The bounded action implemented is **Explore → Who to follow → Follow**: the suggestion row captures its existing follow operation, makes no write while guest, and replays that operation after sign-in through the existing session-aware `PublicProfileRepository`; its canonical server result updates the row. No destination or action payload is reconstructed from a hardcoded route. Other protected writes do not yet replay on Android, and checkout/purchases are deliberately outside this slice.

Verification: React Native `guestAuthReplay.test.ts` passes (2 tests), covering route return, one-time replay and cancellation/discard. Android `SearchScreenTest` now includes source coverage for deferred Explore follow, no guest write, authenticated replay with the session token and canonical Following state; `PendingGuestActionTest` covers single-consumption and cancellation. Android execution could not verify these Kotlin changes in this workspace because the app Kotlin compilation currently fails in unrelated pre-existing wallet sources: `PayoutAccountsRepository.kt` declares defaults on a functional-interface abstract method, and `WalletScreen.kt` references unresolved `PayoutAccountsScreen`. The instrumentation source and new unit tests therefore remain uncompiled/unexecuted here; no emulator, live sign-in provider or live API was exercised.
