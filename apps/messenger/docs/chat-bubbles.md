# Messenger chat bubbles and notification actions

## Behavior by platform

| Capability | Android | iOS |
| --- | --- | --- |
| Floating UI inside Nantty Messenger | Draggable, edge-snapping bubbles; up to four active conversations; unread count; compact conversation sheet | Same in-app experience |
| System-wide conversation bubbles | Android 11+ conversation notification with a long-lived shortcut and `BubbleMetadata`; ordinary Expo notification is retained as fallback | Not supported by public iOS APIs; never emulate with overlays, PiP, or background privileges |
| Notification reply/read actions | Expo notification category actions; actions open Messenger so the existing session and E2EE client can authorize and encrypt the reply | Interactive notification actions; replies open Messenger for secure encryption and session checks |
| Unsupported or disabled OS feature | Standard notification remains; the OS and its notification/bubble preferences remain authoritative | Standard grouped notification and in-app bubble only |

Android system bubbles are opt-in at both app and OS level and can be suppressed by notification permission, the global bubble preference, conversation/channel controls, OEM policy, focus modes, or user dismissal. Android 10 and earlier only receive standard interactive notifications. The system bubble uses Nantty's app icon as its shortcut icon; per-contact image assets are not currently included in the privacy-safe push payload. In-app bubbles use the conversation avatar from the authenticated inbox response.

## Security/data flow

1. `message.sent` push payloads contain a conversation identifier, category/thread metadata, and generic copy only. They never include decrypted message content. The existing per-recipient chat settings determine whether sender/group identity is shown, whether a bubble is eligible, and sound/vibration channel selection.
2. Expo's registered notification renderer remains responsible for showing regular notifications. The Android config plugin selects a subclass of Expo's `NotificationsService` that adds bubble metadata only for eligible messages on API 30+. Any missing field, permission, shortcut, or platform condition returns the original Expo notification unchanged.
3. Reply actions open Messenger. An authenticated response is encrypted through `@nantty/chat-crypto`, sent to the existing conversation endpoint with an idempotency key, and queued as an AEAD-sealed local envelope if delivery fails. No plaintext server fallback is used. If Messenger has no authorized session or encryption bootstrap fails, the reply is not sent.
4. Conversation history is fetched from the existing API and decrypted locally. The Messenger cache/outbox is encrypted before SQLite writes with a key held in SecureStore. Sign-out clears local message keys, sealed outbox/cache, bubble settings/positions, push token registration when reachable, and visible notifications.
5. Active Messenger screens subscribe to the existing authenticated `/ws` protocol using a short-lived realtime token. The service subscribes only to authorized conversation topics, drops the connection while the app is backgrounded, reconnects with bounded jitter, and fetches authoritative encrypted history on message events.

## Build and configuration

- Keep `plugins/withAndroidChatBubbles.js` in `apps/messenger/app.json`; it generates the Android Kotlin presentation-delegate subclass during prebuild and removes no permissions other than the unnecessary `SYSTEM_ALERT_WINDOW` permission.
- Build a development or production native app. Expo Go does not contain this custom Android receiver. The `android` script uses `expo run:android` for this reason.
- After changing the plugin, regenerate the native project with `pnpm --filter @nantty/messenger exec expo prebuild --platform android --no-install` before Gradle compilation or EAS Build.
- iOS uses Expo Notifications categories/thread identifiers and React Native in-app bubbles; there is intentionally no iOS native overlay implementation.
- Apply the Social chat-settings migration before relying on sound/vibration/bubble eligibility preferences in push delivery.

## Verification and known gaps

Verified in this workspace: TypeScript checks for Messenger, Social, and Notifications; Messenger conversation DTO tests; focused Social chat-settings/message-push tests; Notifications unit suite; Expo config evaluation; Android Expo prebuild and generated manifest/source inspection. Android Gradle Kotlin compilation did not complete: Gradle attempted to download the required 633 MB NDK, which was still transferring at roughly 75 KB/s, so the build was stopped before compilation. No Android emulator/device is attached, and this Linux environment cannot run Xcode/iOS simulator tests. Native and device behavior therefore remains unverified.

The compact conversation currently supports encrypted text and image sends, memory-only image decryption, encrypted reaction control messages, cursor-paginated history, read marking, text delivery/failure retry, and typing indicators. Quote replies and video, voice, and document attachments are not yet available in this Messenger UI; quote-reply metadata is not part of the shared encrypted payload contract. The system-bubble shortcut uses the app icon rather than a contact image. Push provider delivery, real device authorization behavior, manufacturer-specific bubble behavior, Android bubble reply rendering, and iOS notification action behavior remain release-device tests.
