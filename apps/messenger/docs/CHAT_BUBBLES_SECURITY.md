# Chat Bubbles security model

- Bubble identifiers route to an existing conversation; they do not grant membership or session access.
- The compact route is rendered only after Messenger's existing session restoration and trusted-device authorization gate succeeds.
- Conversation summaries/history and send operations use the existing authenticated endpoints. Message sends use the existing E2EE envelope and idempotency key path.
- Push payloads contain generic message copy and routing identifiers only. No authentication tokens, encryption keys or plaintext chat messages are added.
- Android notification actions remain explicit Expo notification actions. Their response is processed by the authenticated app; the implementation does not add an externally exported reply receiver.
- `NanttyBubbleActivity` is non-exported. Android notification permission and bubble preferences are never overridden. No overlay permission or accessibility service is requested.
- Logout removes registered push token where the backend is reachable, clears local bubble preferences/state and dismisses Messenger notifications through existing cleanup.
- Terminal session refresh/retry responses (HTTP 401/403) trigger the same local cleanup; transient network and 5xx failures do not clear the session. This prevents stale decrypted views and bubble state from remaining active after an authorization revocation is detected. Server/device integration behavior is not yet device-tested.
- Android cleanup removes Nantty conversation dynamic shortcuts and, on Android 11+, their long-lived copies; pinned shortcuts on Android 7.1–10 are disabled. This source path has not been compiled or exercised on a device.
- Local sign-out also clears Expo's last notification response before dismissing visible notifications so a stale quick-reply action is not replayed after a later sign-in.

## Unverified security checks

Forged conversation identifiers, revoked-device bubble reopening, membership removal, action replay, duplicate action delivery, account switching, lock-screen preview behavior and encrypted sends from native notification actions still require platform integration/security tests. No claim of complete device-revocation cleanup is made.
