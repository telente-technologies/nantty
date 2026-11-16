# Chat Bubbles security boundaries

- All bubble surfaces route into the existing Messenger session and conversation APIs. A deep link is a routing hint, not authorization; the authenticated client must verify the current session and fetch the conversation through its membership-protected API.
- Message pushes carry routing identifiers and generic notification copy, not plaintext message contents, authentication tokens or private encryption keys. `recipientAccountId` is used to scope Android shortcut and channel identities; it is not a credential.
- Android shortcut and channel IDs are deterministic from a length-framed `(recipientAccountId, conversationId)` pair. Missing routing context disables the custom bubble path and retains standard notification behavior.
- Replies use the existing encrypted send path and retry-stable idempotency. They must not bypass the existing device authorization or use plaintext fallbacks. Quick reply foregrounds Messenger when secure processing requires an active session.
- Preview preferences control sender/conversation identifiers exposed in push copy. Lock-screen visibility and channel overrides are owned by the OS and user.
- Logout and terminal session failures trigger local sensitive-state cleanup, push-token cleanup where reachable, native notification removal and shortcut removal/disable. Runtime effectiveness remains unverified until device tests.
- Do not log notification plaintext, reply text, access tokens, private keys or secure cached messages. Do not infer that bubble dismissal marks read, mutes, archives or deletes a conversation.

See `CHAT_BUBBLES_ARCHITECTURE.md` and `CHAT_BUBBLES_IMPLEMENTATION_STATUS.md` for source-level behavior and verification limits.
