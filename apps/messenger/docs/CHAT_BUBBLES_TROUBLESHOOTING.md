# Chat Bubbles troubleshooting

## No Android bubble appears

Check Android notification permission, Messenger's app notification setting, the global bubble setting, and the conversation's channel setting. Android's app-level preference can allow all conversations, only user-selected conversations, or none; a channel can still disallow an individual conversation. Android may require promoting a notification with its bubble control. Use the in-app test bubble to check eligibility; a posted test notification does not prove Android displayed it. If the device is unsupported or bubbles are disabled, ordinary notifications and in-app floating conversations remain available. See [Android NotificationManager bubble preferences](https://developer.android.com/reference/android/app/NotificationManager#BUBBLE_PREFERENCE_ALL).

## A conversation is missing from selection

Only conversations returned by the authenticated Messenger inbox can be selected. Check network connectivity, sign-in and trusted-device authorization. Muted, blocked, archived or otherwise restricted conversations remain subject to the existing messaging and notification policies.

## Notification reply does not send

Secure replies require a valid authorized session and the existing encryption path. Open Messenger and complete any requested authorization. If delivery failed offline, use the conversation's pending/failed state and retry instead of sending a second unrelated message.

## Old conversation notification settings persist

Android owns channel settings and may retain channels after account changes. Shortcut/channel identity is now scoped by recipient account and conversation, and sign-out cleanup removes active notices and shortcuts where supported. If a device still displays stale state, remove the stale notification in Android settings and sign in again; report the OS version and whether the channel existed before account switching.

## iOS differences

iOS does not support system-wide floating chat bubbles through public APIs. Use notification replies or Messenger's in-app floating conversations. If reply actions are absent, enable Messenger notifications and verify the installed build has registered its notification category.

For device authorization problems, use Messenger's normal secure device-authorization flow. Do not send credentials or screenshots containing private message text to support.
