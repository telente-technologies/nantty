# Nantty for Android

Native Android app built with Kotlin, Jetpack Compose, Material 3 adaptive layouts, and an Android home-screen widget powered by Glance. This is an independent target; it does not embed or load the web or React Native apps.

## Build configuration

Set the API origin with the Gradle property `nanttyApiBaseUrl` or environment variable `NANTTY_API_BASE_URL`. The value must be an HTTPS origin (local HTTP is accepted only for loopback/emulator development). The configured value is exposed as `BuildConfig.NANTTY_API_BASE_URL`.

Google sign-in uses Credential Manager. Set `NANTTY_GOOGLE_SERVER_CLIENT_ID` (or Gradle property `nanttyGoogleServerClientId`) to the Google OAuth Web/server client ID and configure that audience in the backend's `AUTH_GOOGLE_CLIENT_IDS`; the identifier is public configuration, not a secret. Without it, Android hides the Google option. Apple sign-in is iOS-only in the React Native app and is not offered by the Android client. See [`../../../docs/android-auth-guest-parity.md`](../../../docs/android-auth-guest-parity.md) for guest access, first-time social signup birthday handling, and verification limits.

For example, use `./gradlew :app:assembleDebug -PnanttyApiBaseUrl=https://your-api-origin`. Never put account credentials or tokens in Gradle properties or build config. Sign-in uses `POST /api/v1/auth/login`; startup refreshes and rotates saved tokens through `/api/v1/auth/refresh`; sign-out calls `/api/v1/auth/logout` with the current access token. The access token, refresh token, and minimal account identity snapshot are persisted together only as AES-GCM ciphertext in app-private preferences, using an AES key held in Android Keystore. Passwords are never persisted and session credentials are not shared with the home-screen widget. Requests use bounded connect/read timeouts. A rejected refresh clears the saved session; transient network errors preserve encrypted state and offer retry.

The authenticated shell currently opens the For You feed and offers a For You / Following selector. Following uses authenticated `GET /api/v1/feeds/following`; the repository refuses to issue that request without the current access token, and an expired session is surfaced as a sign-in-again state. Both feeds retain server cursors, bounded pages, duplicate-ID filtering, retry feedback, and an explicit end-of-feed state. Switching feeds starts a fresh cursor sequence, and a late response from a previously selected feed cannot replace the current feed. The app also supports Like/Unlike and Repost/Undo, API-backed post detail, nested replies, media previews, a text-only post composer, and the Activity inbox. Activity uses authenticated cursor-based `GET /api/v1/notifications?filter=all|mentions`, plus the existing single and bulk read endpoints. It supports filter switching, refresh, retry, pagination, empty states, and updates read state only after successful API writes. The receipt action opens a buyer-scoped, cursor-paged Orders list and a read-only detail using the existing authenticated order endpoints; cancel, confirm-receipt, dispute and payment actions are not yet included. Text publishing uses the existing authenticated `POST /api/v1/posts` contract with an idempotency key; media attachment, scheduling, and business-profile switching are not included in this composer yet. It is still a narrow native slice rather than a full port. Other destinations remain explicitly marked as not yet native rather than faking functionality. Layouts respond to window classes and include source-level vertical hinge avoidance; foldable posture behavior still needs device verification.

The Android post composer validates the non-empty text and 2,200-character backend limit locally, but the backend remains authoritative. A failed request keeps the same idempotency key until the draft text changes, allowing a safe retry without creating a duplicate post. These limits do not replace backend validation.

After session restore, a signed-out user can choose **Browse as guest** and read the public For You feed, Mart catalogue, and Discover/search. Guests do not receive a fake account/session; account-only destinations and writes return to auth, and the app never requests Following data without a token. Network, HTTP, and configuration failures are reported directly; the app never substitutes mock feed content.

## Build

The current Gradle configuration compiles against SDK 37, targets SDK 35, and supports API 26+. Use Android Studio with those SDK platforms and JDK 21 (the Gradle daemon JVM is pinned in `gradle/gradle-daemon-jvm.properties`), or run:

```sh
./gradlew :app:testDebugUnitTest :app:compileDebugAndroidTestKotlin :app:assembleDebug
```

Set `ANDROID_HOME`/`ANDROID_SDK_ROOT` to the local SDK when Gradle cannot locate it. Instrumented Compose and Keystore tests run with `./gradlew :app:connectedDebugAndroidTest` on an emulator/device; compiling instrumentation sources does not execute those tests. On 2026-11-03, the latest unit suite passed 143 tests, instrumentation Kotlin sources compiled, and `:app:assembleDebug` succeeded on the local Android SDK/JDK 21 setup. No emulator/device UI or Keystore test ran. Release signing and store-upload readiness have not been verified.

The native Android `applicationId` is currently `com.nantty.android`; the React Native reference uses `com.nantty.app`. Confirm whether the native app replaces the existing Play listing or ships as a separate app before changing this identifier or preparing a release. The native app also has a different set of implemented features; see [`../../../docs/native-app-feature-parity.md`](../../../docs/native-app-feature-parity.md).
