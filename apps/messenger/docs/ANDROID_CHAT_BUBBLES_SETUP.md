# Android Chat Bubbles setup and build

## Project integration

Messenger uses Expo/React Native for conversation UI and a config plugin plus app-local Kotlin integrations for Android's official notification Bubbles API. The plugin is registered in `app.json`; do not rely on Expo Go for this feature. The bubble activity reuses the existing React Native host and must remain non-exported. No overlay permission, foreground service, or accessibility workaround is used.

## Build

From the repository root, use the Messenger development build scripts:

```sh
pnpm --filter @nantty/messenger exec expo start --dev-client
pnpm --filter @nantty/messenger android
```

Native source/plugin changes require a new development or release build; a JavaScript OTA update cannot add native notification behavior. Regenerate native projects only through the repository's reviewed Expo prebuild workflow, after checking for local native changes. Do not run destructive prebuild commands over uncommitted native work.

## Setup on device

1. Grant Messenger notification permission if Android requests it.
2. In Messenger Settings → Notifications → Chat Bubbles, enable the feature and choose eligible conversations.
3. Open Android notification/bubble settings from that screen if system bubbles are disabled.
4. Post the local test notification. Android may require promoting a conversation notification to a bubble; the app cannot grant that setting itself.
5. Send a real message from another authorized account and test the bubble while another app is foregrounded.

Android's global bubble setting, app notification permission, channel overrides, focus mode and manufacturer policy remain authoritative. Standard notifications are the fallback.

## Current environment gate

The last recorded local Gradle attempt stopped before Kotlin compilation because Android NDK `27.1.12297006` lacked `source.properties`; no emulator/device was attached. Repair the NDK in a suitable Android development environment, then build/install and complete the Android scenarios in `CHAT_BUBBLES_TEST_MATRIX.md`. Do not treat Expo config evaluation as a native build.

Official references: [Android bubbles](https://developer.android.com/develop/ui/views/notifications/bubbles), [Android conversations](https://developer.android.com/develop/ui/views/notifications/conversations), [FCM receive messages](https://firebase.google.com/docs/cloud-messaging/android/receive-messages), [Expo config plugins and native modules](https://docs.expo.dev/modules/config-plugin-and-native-module-tutorial/).
