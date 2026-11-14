# iOS notification actions

Messenger registers the `NANTTY_CHAT` category with a text-input Reply action and Mark as read action through Expo Notifications. Incoming message notifications use a conversation thread identifier and generic content; private message text is not placed in the push payload. A reply opens Messenger so the current trusted session, conversation membership and E2EE implementation remain authoritative.

iOS does not provide a public API for system-wide floating chat heads. The supported floating conversation UI is in-app only. Notification actions and grouping have not been verified in an iOS build or on a device in this Linux workspace. Background action execution is not promised; when secure background processing is unavailable, Messenger must foreground and authenticate before sending.
