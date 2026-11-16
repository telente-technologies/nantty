# Chat Bubbles architecture

## Current structure

- Shared conversations, authentication, membership checks, encrypted message APIs, offline outbox, realtime events and theme components remain in the Messenger React Native application.
- `plugins/withAndroidChatBubbles.js` is the source of truth for Android notification receiver and manifest configuration. It subclasses Expo Notifications' receiver and presentation delegate; it does not add an overlay service.
- Android uses data-only, high-priority FCM for a message whose recipient preferences permit system bubbles. The custom Expo receiver creates the normal notification first and then adds a conversation shortcut and `BubbleMetadata`. Other messages keep the normal FCM notification payload.
- The bubble shortcut deep-links to `nantty-messenger://chats/{id}?surface=bubble` through a dedicated embedded-capable Activity that subclasses the existing React Native host. The shared React Native conversation screen renders in compact mode after the normal authentication gate and loads the conversation through the existing authorized API.
- In-app floating conversations are separate React Native UI. Their master preference and active conversation IDs are local and independent from Android system-bubble eligibility/mode; changing an in-app bubble never patches Android bubble selection. Drafts are keyed by authenticated account and conversation in the existing AEAD-sealed SQLite record store; floating positions are separately keyed by account and conversation in SecureStore and cleared for that account during logout/session cleanup. Switching accounts cannot reuse another account's saved placement. iOS has only in-app floating conversations and interactive notifications, with no Android system-bubble controls shown.
- iOS notification actions are declared through Expo Notifications categories. Replies foreground Messenger so the existing session and encryption implementation can process them.

## Message flow

1. Social selects recipients and applies per-account preview, sound, vibration and bubble preferences. The `message.sent` contract explicitly allows these optional recipient preference fields; message contents remain excluded.
2. Notifications dispatches to the registered provider. Messenger Android registers a device FCM token; Messenger iOS registers an Expo token.
3. Message pushes carry the target `recipientAccountId` as routing context; this is an account identifier, not a credential. Bubble-eligible FCM messages use generic `title`/`message` copy, not plaintext chat content or secrets. Android derives its stable shortcut and conversation-channel identifiers from a length-framed account ID plus conversation ID, so separate accounts cannot collide or inherit one another's channel overrides. Push `tag` uses the same length-framed identity, so later messages in a conversation replace that notification instead of adding duplicates, while ambiguous account/conversation pairs remain distinct. Missing account routing fails back to a standard notification. `messageId` remains the idempotency anchor for a notification reply.
4. Expo's Android Firebase receiver converts the data message to a notification. Nantty adds bubble metadata only if the API level, channel and operating-system preference permit it. Otherwise the original standard notification remains.
5. Opening a bubble launches the same RN runtime on the compact authorized route. Membership, session and E2EE checks remain in the existing Messenger services.
6. Replies use existing E2EE sending and a deterministic digest of the message/action/reply for the idempotency key; offline delivery uses the existing encrypted outbox. The reply text is not included in the idempotency key. Failed quick replies foreground the conversation and show a recovery message instead of being reported as successful.

## Boundaries and limitations

- Android's non-exported `NanttyBubbleActivity` subclasses the existing RN host and is marked resizable/embedded-capable. Its explicit shortcut URL selects the compact shared React Native conversation route. This design has not yet been validated in an Android bubble window.
- The chosen cross-app policy is to keep chat alerts in both products. On Android, Messenger registers FCM for its custom bubble-capable pipeline while the main app registers Expo for its ordinary notification; the dispatcher routes to both registered provider groups. This intentional per-app behavior is covered by provider-level tests, but not yet verified on a device. Duplicate registrations within the same app (for example, stale tokens after reinstall) are not associated with a shared installation identity.
- Android system settings and manufacturer policies remain authoritative. The app cannot grant bubble permission to itself.
- iOS has no public system-wide floating chat window API. Notification replies foreground the app; secure background reply execution is not claimed.
- Push delivery under force-stop, power restrictions, offline conditions and OEM policy is not guaranteed.
- No end-to-end device verification was possible in this environment; see `CHAT_BUBBLES_IMPLEMENTATION_STATUS.md`.
