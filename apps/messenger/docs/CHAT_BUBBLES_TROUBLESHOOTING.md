# Chat Bubbles troubleshooting

## No Android system bubble

Confirm the device runs Android 11 or newer, Messenger notifications are allowed, the conversation is eligible under Messenger's selected/all preference, and Android's app and conversation notification settings allow bubbles. A user or manufacturer setting may suppress bubbles; Nantty cannot enable this on the user's behalf. Standard notifications are the fallback.

## No message notification

Check Messenger notification permission, Android notification channel settings, network connectivity and the account's chat notification preferences. Push delivery may be delayed by force-stop, battery restrictions or OEM policy. Open Messenger to synchronize messages.

## Reply opens Messenger

This is intentional: notification replies are foregrounded so the trusted session and end-to-end encryption path can authorize and encrypt the reply. No plaintext/background bypass is used.

## iPhone behavior differs

iOS does not provide system-wide floating chat bubbles. Use in-app floating conversations and supported interactive notifications.

## Device not authorized

Complete the existing Nantty trusted-device authorization flow. Bubble links and notifications do not bypass authorization.

Settings checks Android version support, notification permission and app-level bubble allowance, and offers a local test notification. Channel-level and OEM behavior can still differ. A posted test notification is not proof that the operating system expanded it.
