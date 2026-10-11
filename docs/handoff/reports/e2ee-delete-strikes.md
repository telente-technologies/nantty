# Chat E2EE gaps, deleting posts and stories, strike lengths (2026-10-11)

Nothing was committed and no package or lock files were touched. The API contract is in `scratchpad/e2ee-contract.md`.

## 1. Chat E2EE

### Design
- **Inside the ciphertext now:** locations (coordinates and label), polls (question and options), votes, reactions, live-location updates and stops, documents (file name and type), shared post or product references, and group names and descriptions.
- **Control messages:** reactions, votes, live-location updates and stops travel as a new kind of message, `control`. The server relays them without counting them as unread, changing the chat preview or sending a push. Clients hide them and tally them with `ChatControlLedger` in chatCrypto, which is shared by mobile and web.
- **Votes follow Signal:** they are not anonymous; the server can't count them, and clients tally them.
- **Group names and descriptions (Signal-style):** they are sealed with a per-group key. The key travels inside every group message and rotates when someone is removed. Only `encryptedAttributes` is stored.
- **Channels:** they are public broadcasts, so their names stay plaintext.
- **Metadata the server still sees (routing):** sender, conversation, time, message kind, media id of the encrypted file, user ids of anyone mentioned (needed to notify them), read state and typing.
- **Trade-off: shared-item cards.** The card is fetched with `GET /chat/content` when it's shown. The server sees the item being looked at, but never stores which chat it was sent to.

### Server (social)
- **Migration `20261011120000_chat_e2ee_rich_content`:**
  - Removes `location`, `document`, `sharedContent`, `pollQuestion` and `pollAllowMultiple` from messages.
  - Removes the `message_reactions` and `message_poll_*` tables.
  - Deletes old plaintext rows.
  - Adds `encryptedAttributes`, clears the plaintext names of existing groups, and adds a CHECK rule so a group can never have a plaintext title or description.
  - Adds the `control` message kind.
- **Old clients get clear errors:**
  - Sending plaintext `text`, `location`, `poll`, `document` or `sharedContent` returns 422 `PLAINTEXT_NOT_ACCEPTED`, with the offending fields listed.
  - The old reaction, vote and live-location endpoints return 410 `ENCRYPTED_CLIENT_REQUIRED`.
  - A plaintext group name returns 422.
  - A share without an encrypted envelope for every chat returns 422.
- **Every message kind now needs an encryption envelope.** The `signal-v1-pending` protocol is no longer accepted.
- **Pushes:** they no longer include the group name, and server-side chat search no longer matches groups by name.
- **Link previews:** the chat preview lookup no longer saves the previewed URL in the shared cache. Post previews still use the cache.
- **Tests:** a new `tests/messages/chatE2eeServer.test.ts` checks that the schema has no plaintext columns, the 410 and 422 errors, sealed group names and control-message relaying. The validation, realtime and link-preview tests were updated.

### Shared library (chatCrypto)
- New files: `richContent.ts`, `controls.ts` and `groupAttributes.ts`. The client gained group-key handling.
- New tests in `tests/richContent.test.ts`.

### Mobile
- Every rich message is sent encrypted, and control messages are folded into reactions, poll results and live location. Group names are sealed and keys rotate.
- Group keys are kept in SecureStore, and the sealed SQLite history moved to v4.
- Mocks and contract tests were updated. The unused leftover service files now just re-export the current ones.

### Webapp
Chat now matches mobile, all encrypted:
- Groups, with a create flow and an info page at `/chats/[id]/info`.
- Per-chat settings, plus a new `/chats/settings` page.
- Encrypted images, video, voice notes and documents.
- Locations, including live location, plus polls and reactions.
- Shared cards.
- Group search runs in the browser.

### Audit
- **Edits, replies/quotes and forwards:** these features don't exist.
- **Message search:** it only matches names; it never searches message text.
- **Typing and read receipts:** these stay as metadata.
- **Voice notes and attachments:** already encrypted.
- **⚠ Store inbox (customer ↔ store chats) is still plaintext.** Messages are saved with `store-plaintext-v1`, by both the customer endpoint and the store-staff endpoint. Fixing this needs a design for E2EE that several store staff can share, so I didn't change it.

### Gaps
- **Group photos:** none on mobile or web. Members have no way to get a signed download link for an encrypted group photo; this needs a server endpoint.
- **Webapp:**
  - Sends aren't optimistic.
  - No chat passcode lock and no streaks.
  - Live location only updates while the tab is open.
- **Elixir realtime:** it still routes `message.reactionsChanged`, which nothing sends any more. This is harmless.

## 2. Delete post, clip and story
- **`DELETE /api/v1/posts/:id` (social) returns 204:**
  - Only the owner can delete, including someone acting as the brand; anyone else gets 403.
  - Deleting twice is a no-op.
  - It unpins the post and removes saves.
  - Repost and quote counts go down but never below zero. Quotes of the post stay up and show "This post is unavailable".
  - It sends a richer `post.deleted` event.
  - It deletes the media through the media service after the delete is saved.
- **Notifications:** the notifications service now deletes notifications that point at a deleted post.
- **Mobile and webapp:**
  - "Delete" is in the ⋯ menu on your own posts, clips and stories.
  - A confirm dialog asks before deleting.
  - The post disappears at once from every cached list and comes back if the delete fails.
- **⚠ Boost refund is a gap.** Go ads has no boost-cancel endpoint and doesn't listen for `post.deleted`. Payment code is owned by the Flutterwave agent, so it was not touched.

## 3. Strike lengths
What the code says:
- **General strikes:** a strike lasts 12 months and a warning lasts 6 months (`strikePolicy.service.go:10-12`).
- **3 active strikes** restrict the account, which pauses earning and going live.
- **After a report:** removal, a warning to the author or a suspension each add one strike.

What changed:
- The community guidelines and the Help Centre articles under `safety-and-reporting` now match. The old text said 90 days for a strike and 180 days for a warning.
- The copyright ladder (warning → 30-day suspension → review, 12-month lifetimes) was checked against the code and kept.
- **Go fix:** after a strike is added or revoked, moderation now publishes the account-health update. Before this, 3 general strikes never actually paused going live or ad earnings.

## QA
| Check | Result |
|---|---|
| chatCrypto | tsc clean, 49/49 |
| social | prisma validate OK, tsc (src and tests) clean, 398 passed, 4 skipped |
| gateway | 1631/1631 |
| support content | 73/73 |
| notifications | 257 passed (delete agent's run) |
| Go moderation | build, vet and tests pass (strikes agent's run) |
| mobile | tsc clean, jest 337/337 |
| webapp | tsc clean, units 169/169, contracts 75/75 |

Adversarial checks:
- An old client sending a plaintext poll or location gets 422 `PLAINTEXT_NOT_ACCEPTED`. The old endpoints return 410.
- Deleting the same post twice returns 204 with no new event.
- Deleting a post while it is quoted leaves the quotes up with an unavailable card.
- Deleting a pinned and boosted post unpins it, but the boost is not refunded (gap above).
- A delete by someone who doesn't own the post returns 403.
- Votes for options that don't exist, and live-location moves from anyone but the sharer, are ignored.
- A reaction that fails to send is rolled back.

---

# Follow-up (2026-10-11): store chats E2EE, group photos, optimistic web sends

## Customer ↔ store chats are end-to-end encrypted
- **Model:** each store conversation is now a sender-key group. Its members are the customer plus every active store team member with the `messages:manage` permission.
  - The list of team members comes live from commerce: a new catalog port `ListStoreTeamWithPermission` and a new orders endpoint `GET /api/v1/internal/stores/{storeId}/inbox-team`. Social caches it for 10 seconds.
  - The store's own placeholder account is never a recipient.
- **Rotation:** chatCrypto replaces a sender's key automatically when someone it was sent to drops out of the recipient list. A removed team member, or one who loses the inbox permission, can't read anything sent afterwards.
- **New team members** get no history from before they joined, as in Signal; nobody can re-send old keys to them. A chatCrypto test covers both rotation and this.
- **Who sent it:** each message records the real staff account as the sender, which E2EE needs to verify who sent it. Customers see the store's name and logo; staff are never named. Social now returns `store {id, name, avatarUrl}` on store conversations.
- **New social endpoints:**
  - `GET /conversations/:id/recipients` (all chat types).
  - `POST /conversations/stores/:storeId` (opens a store chat).
  - Internal store recipients and paged threads.
- **What the server stores:** the store inbox now handles only encrypted envelopes. Old clients get 422 `PLAINTEXT_NOT_ACCEPTED` from social, from the orders BFF reply (new Go test) and on the customer's store send.
  - The chat list no longer has a message body; it shows only the type of the last message.
  - Server-side search was removed; search now runs on the device.
- **Migration `20261011130000_store_chat_e2ee`:** deletes plaintext store rows and adds a CHECK rule so every message must use protocol `signal-v1` with ciphertext.
- **Automation:** no server-side auto-replies, macros or system notices write into chats. The seller app has no quick replies.
- **Order disputes are not chat:** their messages (escrow and orders) still carry plaintext `body`. They are flagged here and were not changed.
- **Admin and support** have no way to read store chats. Reports still work by the reporter submitting decrypted evidence, through the moderation chat-reports flow.
- **Seller dashboard (apps/seller):**
  - The browser keeps its keys in sealed IndexedDB, decrypts threads, and sends encrypted replies that appear at once and roll back on error.
  - Search runs in the browser.
  - The BFF lets only `/chat/keys/*` through, for `messages:manage` staff.
  - **⚠ The `@zudomart/chat-crypto` dependency is reached through a tsconfig path alias plus `transpilePackages`, because package.json was off-limits.** The owner should add `"@zudomart/chat-crypto": "workspace:*"`.
  - Gaps: replies are text only, there's no realtime (it refreshes on reload or send), and shared items show only a label.
- **Mobile and webapp:**
  - "Message store" and "Contact seller" now open the store chat.
  - Messages are encrypted to `/recipients`.
  - Chats show the store's name.
  - Nothing sends plaintext.

## Group photos
- **Server:** social checks that a group photo is an encrypted chat upload owned by the admin; `photoMediaId: null` removes it. Members get a signed `photoUrl` that only they can use.
- **Apps:** mobile and webapp encrypt the photo with `encryptAttachment` and put `avatar {mediaId, pointer}` in the sealed group details. They decrypt it in memory, and only if its media id matches `photoMediaId`.
- **Mobile, decrypted media at rest:**
  - Images and voice notes are decrypted in memory only.
  - Video, documents and playing voice notes use a temporary file while they're on screen. These files are wiped when the app goes to the background or the user signs out, and swept on the next start.

## Webapp optimistic sends
Text, attachments, locations, polls, reactions and votes now appear at once. Each send reuses one idempotency key, so the server copy replaces the pending one with no duplicates. A failed reaction or vote is rolled back, and a failed message offers Retry or Discard.

## QA (follow-up)
| Check | Result |
|---|---|
| chatCrypto | 50/50 |
| social | prisma validate OK, tsc (src and tests) clean, 402 passed, 4 skipped |
| gateway | 1631/1631 |
| Go orders, catalog, commerceports | build, vet and tests pass |
| webapp | tsc clean, contracts 78/78, units 174/174 |
| seller | tsc clean, contracts 31/31, `next build` OK |
| mobile | tsc clean, jest 361 passed |

One mobile suite fails: `modalSystem.test.ts`, 5 of its tests. That file is another agent's untracked work in progress on `components/ui` modals and is not related to this work.

Adversarial checks:
- An old dashboard or customer sending plaintext gets 422.
- A removed team member gets 403 `NOT_STORE_INBOX_MEMBER`, and their old key can't decrypt new messages.
- An unregistered device gets 403.
- A group photo with a mismatched media id is ignored.
- A non-owner can't set the group photo (`MEDIA_NOT_OWNED`).

## Review of the restored messages.validator.ts and message.model.ts (after the disk-full truncation)
- **Both files match what I wrote.** The one difference is an `"order"` reference kind added deliberately by another agent; it is used consistently in the share-card service, the resolver interface and the model, so I kept it.
- **Where the E2EE rules live:** the schema is deliberately permissive (`schema.unknown()` for text, location, poll, document and sharedContent) so that plaintext reaches the service check. The rules themselves are in `messageValidation.service.ts`:
  - only `signal-v1` is accepted;
  - every kind needs an envelope;
  - plaintext gets 422 `PLAINTEXT_NOT_ACCEPTED`;
  - control messages are restricted.
  The group rules are in `groupAttributes.service.ts`. Both files are intact.
- **New tests:** the schema does not strip plaintext fields, so the 422 still fires, with all five field names listed; the schema accepts all ten encrypted kinds including `control`, and rejects `system` and unknown kinds.
- **QA:** prisma validate OK, tsc (src and tests) clean, social 413 passed, 4 skipped.
