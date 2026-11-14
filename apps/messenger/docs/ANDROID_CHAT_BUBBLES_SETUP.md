# Android Chat Bubbles setup

## Requirements

- Android 11 (API 30) or newer for system bubbles.
- A custom development/release build; Expo Go does not include Nantty's notification receiver.
- Firebase Messaging configured for the Android application and valid server-side FCM credentials for the Notifications service.
- Notification permission and Android's system bubble settings must permit the conversation.

## Repository commands

From the repository root:

```sh
pnpm --filter @nantty/messenger typecheck
pnpm --filter @nantty/messenger test
pnpm --filter @nantty/messenger android
```

When native directories are generated from Expo config, apply the plugin in a disposable/expected prebuild workflow before compiling. Do not use Expo Go to validate bubbles. This workspace's Gradle build is currently blocked by an incomplete local NDK installation; no device was attached.

## Current implementation notes

- The plugin generates non-exported `NanttyBubbleActivity`, a subclass of the existing RN host, with `android:allowEmbedded="true"` and `android:resizeableActivity="true"`. The launcher Activity remains separate.
- `NanttyChatBubblesModule` reports API/notification/app bubble status, opens the Android notification bubble settings with safe fallbacks, posts a local test-only `MessagingStyle` notification with a long-lived shortcut and bubble metadata, and removes active notifications/shortcuts on logout.
- The plugin removes `SYSTEM_ALERT_WINDOW`, including debug-manifest merges. Nantty does not need “display over other apps” permission for the official Bubbles API.
- Bubble metadata is added only to data-only FCM messages explicitly eligible under server preferences and only when the system/channel permits it. Pushes include a stable message ID for reply idempotency.
- For an eligible conversation, the native delegate creates a stable Android conversation channel associated with the long-lived shortcut. It copies parent sound, vibration, and lock-screen visibility only at channel creation; existing user channel choices are not overwritten. From a conversation header, users can open that Android channel's settings once it exists.
- If a bubble is not displayed, Android should still present the ordinary message notification.
- The test notification is local and clearly labeled. It does not insert a conversation or send a message. A posted result does not prove Android displayed or expanded a bubble; device verification is still required.
