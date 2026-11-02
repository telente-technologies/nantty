# Nantty for Android

Native Android app built with Kotlin, Jetpack Compose, Material 3 adaptive layouts, and an Android home-screen widget powered by Glance. This is an independent target; it does not embed or load the web or React Native apps.

## Build configuration

Set the API origin with the Gradle property `nanttyApiBaseUrl` or environment variable `NANTTY_API_BASE_URL`. The value must be an HTTPS origin (a local HTTP origin is accepted only for emulator development). When unset, the feed shows a clear configuration message and sends no request. The configured value is exposed as `BuildConfig.NANTTY_API_BASE_URL`.

For example, use `./gradlew :app:assembleDebug -PnanttyApiBaseUrl=https://your-api-origin`. Do not put credentials in Gradle properties or build config. The feed API is public/optional-auth (`GET /api/v1/feeds/for-you`); this app intentionally has no sign-in implementation or token storage. A future authenticated feature must add a reviewed session flow and provide bearer credentials through a dedicated boundary.

The following feed is intentionally not exposed yet because its server contract requires authentication. The app reports network, HTTP, and configuration failures directly and never substitutes mock feed content.

## Build

Use Android Studio with Android SDK 35+ and JDK 17, or run `./gradlew :app:testDebugUnitTest :app:assembleDebug`. The Gradle wrapper is included for reproducible setup.
