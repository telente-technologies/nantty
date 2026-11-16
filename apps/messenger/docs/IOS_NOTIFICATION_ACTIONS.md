# iOS notification actions

Messenger uses Expo Notifications categories for reply and mark-read actions, conversation thread identifiers for grouping, and the standard notification deep link to open a conversation. Notification replies foreground Messenger so the existing authenticated session, conversation authorization and end-to-end encryption path can process the response. A secure background-send guarantee is not claimed.

iOS has no public API for a general floating chat window over other apps. The supported floating experience is the optional in-app React Native conversation bubble. There is intentionally no system-wide bubble toggle, Picture-in-Picture chat, Live Activity, CallKit, background-audio, private-API or accessibility workaround.

On iOS, verify notification permission and lock-screen preview settings in system Settings. Test reply, mark-read, grouping, deep link, expired-session fallback, logout cleanup and in-app bubbles on an installed iOS build. This Linux workspace has no Xcode or iOS simulator, so these runtime behaviors remain unverified here.

Reference: [Apple actionable notification types](https://developer.apple.com/documentation/usernotifications/declaring-your-actionable-notification-types).
