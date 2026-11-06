# Group membership invitation boundary

## Current backend contract

The Social service now persists one invitation record per `(conversationId, inviteeId)`, with pending, accepted, declined, revoked, and expired states. Invitations expire seven days after creation. A group owner/admin can invite a non-member; the recipient alone can accept or decline; the inviter or an active group admin can revoke pending or accepted consent. Reissuing a declined, revoked, or expired invitation reuses the pair record. Create/accept/decline/revoke routes are authenticated and idempotency-key capable through the existing route middleware.

Routes:

- `POST /api/v1/conversations/:conversationId/invitations` with `{ "inviteeId": "<uuid>" }`
- `GET /api/v1/group-invitations?direction=received|sent&status=pending|accepted&cursor=<uuid>&limit=<1..100>`; direction defaults to `received`, status defaults to `pending`. Accepted consent can be listed separately so it remains discoverable while secure key handoff is pending.
- `POST /api/v1/group-invitations/:invitationId/accept`
- `POST /api/v1/group-invitations/:invitationId/decline`
- `DELETE /api/v1/conversations/:conversationId/invitations/:invitationId`

## Shareable group invitation links

All link-management routes require authentication. The create, list, and revoke routes also require the caller to be a current group owner/admin; channels and other conversation kinds are not eligible.

- `POST /api/v1/conversations/:conversationId/invitation-links` with optional `{ "expiresInHours": 24 | 168 | 720 }` (default `168`). Returns `{ id, conversationId, token, expiresAt }`; the opaque 32-byte URL-safe token is returned only at creation. The database persists only its SHA-256 hash.
- `GET /api/v1/conversations/:conversationId/invitation-links?cursor=<uuid>&limit=<1..100>` returns `{ data: [{ id, conversationId, createdAt, expiresAt, revokedAt }], nextCursor }`. It includes expired and revoked records so admins can manage links after navigation/restart. Results are ordered by `createdAt DESC, id DESC`; cursors must refer to a link in this conversation. Token and hash are excluded from the query projection and response.
- `GET /api/v1/conversations/invitation-links/:token/preview` returns only `{ group: { title, memberCount }, expiresAt }`; unavailable, expired, and revoked tokens do not reveal group metadata.
- `POST /api/v1/conversations/invitation-links/:token/claim` creates or returns the viewer's pending invitation; it never creates membership or grants history/keys. The viewer must explicitly accept that invitation through `POST /api/v1/group-invitations/:invitationId/accept`. Accepted invitations remain `awaiting_secure_key_handoff`.
- `DELETE /api/v1/conversations/:conversationId/invitation-links/:linkId` revokes a link idempotently. Only a current group owner/admin may do so.

Create, claim, and revoke are limited by the existing authenticated conversation-write rate-limit policy at the gateway. Preview and list remain under the existing authenticated API read limit. No channel subscription is interpreted as group membership or invitation consent.

The invite list deliberately returns only opaque group ID, invitation state/timestamps, and the other participant's public summary. It does not return the group's encrypted attributes or message history.

`PATCH /api/v1/chat/settings` and its GET response now include `preventDirectGroupAdds` (default `false`). When true, the existing create-group and add-members direct-membership paths reject unsolicited membership with `GROUP_INVITATION_REQUIRED`; sending a formal invitation remains allowed.

## E2EE blocker — membership activation is intentionally absent

Accepting an invitation records recipient consent and returns `membershipStatus: "awaiting_secure_key_handoff"`. It does **not** create or upsert a `ConversationMember`, alter encryption recipients, or emit a member-added event.

The current Social service authorizes message history and resolves encryption recipients from active `ConversationMember` rows. The secure-key mailbox deposit path also rejects any recipient who is not already among those recipients. This service has no group epoch/key-rotation or invitation key-handoff operation that can establish a fresh membership key without exposing prior ciphertext. Therefore there is no safe backend action to perform after consent today. A separate E2EE protocol change is required before accepted consent can become active membership; until then accepted records are deliberately inert and do not grant chat access.

Before enabling membership activation, implement and test a protocol-level handoff that: (1) creates a new group key epoch on acceptance, (2) distributes only the new epoch to accepted invitee devices, (3) prevents those devices from receiving earlier ciphertext/key material, and (4) commits membership plus the key-epoch transition atomically or through a recoverable pending state. Existing member-removal key rotation also needs conformance evidence before this can safely proceed.

## Verification recorded for this slice

- Prisma schema validation and client generation passed.
- The SQL migration is added but was not applied to a database in this work.
- TypeScript source and test typechecks passed.
- Focused group invitation/settings route and safety tests passed.
- Full Social service suite: 101 files passed, 4 skipped; 627 tests passed, 6 skipped.
- Social lint passed; the service reports an existing `prefer-const` warning in `safeHttpFetcher.integration.ts`.

This is backend group-invitation groundwork only. It does not implement notification delivery, group E2EE key handoff, client UI, or cross-client parity.
