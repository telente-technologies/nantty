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

## Runtime setup and limitations

Set `NANTTY_GOOGLE_SERVER_CLIENT_ID` (or Gradle property `nanttyGoogleServerClientId`) to the Google OAuth **Web/server client ID** used by Credential Manager. Configure that same audience in the backend's `AUTH_GOOGLE_CLIENT_IDS`. This is a public OAuth client identifier, not a client secret; do not embed OAuth secrets in the app. When the client ID is absent, the Google button is hidden. The backend provider configuration is deployment-specific and was not inspected or changed in this local implementation.

The backend also supports Apple identity verification through `AUTH_APPLE_CLIENT_IDS`, but native Android does not initiate Apple authentication. The RN first-time social registration currently posts no birthday on its first exchange; this implementation handles the server's birthday challenge on Android, but does not change the React Native flow in this task.

## Verification boundary

Unit tests cover the guest destination policy and the Google HTTP request/session/error contract. Android instrumentation source covers the welcome guest affordance and the direct sign-in Google option (visible/click callback when configured; hidden when unconfigured) and is compiled separately; execution requires a connected emulator/device. A successful local build does not establish that Google OAuth consent, signing fingerprints, backend provider audiences, or deployed secrets are configured.
