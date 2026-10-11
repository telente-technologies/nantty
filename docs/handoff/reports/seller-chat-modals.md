# Seller store inbox to mobile/webapp level, and chat modals (2026-10-11)

Nothing was committed. No package.json, lockfile or pnpm-workspace.yaml was touched. apps/studio and apps/admin were not touched.

## 1. Seller dashboard store inbox (apps/seller)

### What a staff member now gets
- **Device key setup on first use.** If this browser has no secure chat key yet, the thread shows a "Set up secure messages on this browser" card. It explains that the key is created and stays in the browser, that only the public half is shared, that only messages from now on are readable, and that signing out removes it. Nothing is registered until the staff member clicks the button. This uses the new `ChatCryptoClient.hasDeviceIdentity(userId)` in chatCrypto, which checks without registering.
- **Encrypted attachments** (images, video, documents up to 100 MB). Files are encrypted in the browser with `encryptAttachment` (the same path as webapp chat), uploaded as `application/vnd.zudomart.encrypted` with purpose `chat`, and sent with `mediaId`. The key travels only inside the ciphertext. If the upload fails part-way, the upload session is abandoned (`DELETE /media/uploads/:id`), nothing is sent, and the bubble offers Retry or Discard. Retry reuses a finished upload.
  - File: `services/chatCrypto/chatAttachmentUpload.service.ts`.
- **Shared cards** (Paperclip and ShareFat buttons in the composer, plus a share dialog with the `share` intent).
  - Product cards are sent as `kind: "shared"` with `sharedContent {product}`, and render through `GET /chat/content`.
  - Order cards are sent as `kind: "text"`. The encrypted text is a readable summary plus `sharedContent {order}`. The dashboard renders a card from `/seller/orders/:id`; customer apps show the text.
  - **⚠ Gap:** social has no `order` share kind, so customers see text rather than a rich order card.
- **Realtime.** The thread shows new messages, the customer typing ("typing…" in the header plus an indicator), and "Seen" on the last store reply the customer has read. The list and nav refresh on events.
  - Reconnect uses exponential backoff with jitter, capped at 30 s, with a heartbeat.
  - While live updates are down, a banner explains it; the thread polls every 8 s and the list every 30 s. On reconnect it catches up with `?after=<lastId>`, deduplicated by id and ordered by time.
  - Mock mode has no socket: `/bff/realtime` returns 404 REALTIME_UNAVAILABLE and the dashboard polls.
- **Optimistic sends with retry.** Messages appear at once. One idempotency key per send means a retry can't duplicate. Failures show Retry and Discard.
- **Unread count in the nav.** A badge on "Messages" in the sidebar, refreshed by realtime, by inbox changes and by a 60 s poll when not live.
- **Client-side search** was already there and is unchanged.
- **Staff assignment:** the backend has no assignee model, so nothing is displayed. Each store reply already shows the staff member's `senderName` to the team.
- **Multi-tab safety** (`services/chatCrypto/tabLeader.ts`, `storeChatEngine.ts`).
  - A Web Locks leader owns the only `ChatCryptoClient` in the browser, plus the realtime socket.
  - Other tabs send every crypto operation (ensureReady, decrypt, encrypt-and-send, previews) over BroadcastChannel RPC, and receive events and status from the leader.
  - Encrypt and POST run as one leader operation, so the ratchet state is only ever touched by the leader.
  - When the leader tab closes, the next tab takes the lock, builds its client from the same sealed IndexedDB, and re-sends any call that was in flight.
  - Typing frames and conversation-topic claims are relayed to the leader. Topics are reference-counted per tab.
- Loading states use `BrandLoader`. New icons were added to the seller registry `zudoIcon.tsx`: paperclip, shareFat, shieldCheck, lockKey, package, receipt, fileText, checks and wifiSlash.

### Seller BFF
- `POST /bff/realtime` (new) is CSRF-checked and requires `messages:manage`. It returns `{ url, accessToken }`. The URL comes from `SELLER_REALTIME_URL`, or `<SELLER_API_URL>/ws` by default. If the access cookie has expired, the refresh token is rotated.
  - **⚠ Trade-off:** this hands the browser a full access token for the socket. A scoped realtime ticket from auth would be better. Flagged for the owner.
- The CSP `connect-src` now includes the realtime origin (`next.config.ts`).
- `GET /chat/content` is allowed for `messages:manage`.
- Chat upload paths (`/media/uploads…` and `/media/:id/encrypted-blob`) are allowed for `messages:manage` without `media:upload`, so the sales role can send attachments (`grantsChatMediaAccess`).
- The mock transport can now return binary bodies.
- Mocks were extended:
  - encrypted chat uploads, abort, and the encrypted blob download
  - `after` on threads and `customerLastReadAt`
  - media on replies, including MEDIA_REQUIRED
  - `/chat/content` for products
- `apiContract.md` was updated.

### Backend (social)
- **Realtime membership:** current store inbox staff (`messages:manage`, via the existing team port) are now members of the store conversation topic, with role `storeTeam`. Typing frames carry the store's name and logo, never the staff member's. Removed staff get 404, so the topic is revoked at the next recheck.
- **Fan-out:** `message.created` events for store chats, sent by the customer or by staff, include `memberIds` set to the inbox team. Staff get fan-out on `user:<id>` without becoming push or `message.sent` recipients.
- **Store read:** `POST …/read` now emits `conversation.read` to the customer and all teammates. Store conversation views include `customerLastReadAt`.
- **Elixir:** no change was needed. The existing router already fans out `memberIds`.
- **Removal timing:** a removed staff member stops getting new fan-out within the 10 s team cache. Their conversation-topic subscription is revoked at the realtime recheck (60 s, plus a 30 s membership cache). Anything sent after removal is unreadable to them because of sender-key rotation.

## 2. Chat modals (a sub-agent did this; details in its report)
- **Mobile:**
  - chatLockGate "Forgot passcode?" uses lock (LockKey).
  - The inbox-request block and `chatBlockDialog` use block (Prohibit); `chatBlockDialog` also gained an inline error.
  - conversationInfo: remove member uses removeMember (UserMinus), leave uses leave (SignOut), and the group photo uses camera.
  - Microphone dialogs use microphone; attachment errors use attachment (Paperclip).
  - sendInChatSheet uses share (ShareFat). In shareToChat, "Copy link" now uses Link and "Share link" uses ShareFat.
  - chatLocationSheet and the first load of the chat thread use BrandLoader.
- **Webapp:**
  - The block dialogs moved to `requestConfirmation` (block).
  - The report dialog uses report (Flag), with a busy lock and an inline error.
  - New message uses message; new group uses team.
  - Poll and location use poll and location; group members uses removeMember; info leave uses leave.
  - shareToChatDialog uses share (ShareFat).
- **Registries:** webKit `dialogIntent` gained leave (SignOut), microphone, attachment (Paperclip) and poll. Mobile `modalIntent` gained leave and attachment. The Paperclip glyph was added and the icon-count test went from 180 to 181.
- **Not needed:** delete message, because no delete-message confirm exists, and ShieldCheck, because safety number is an inline section, not a dialog.
- **Kept:** menus (not dialogs) and the content-shaped skeletons.
- **Seller:** its only chat dialog is the new share dialog, which uses the webKit `Dialog` through `ModalDialog` with the `share` intent.

## QA
| Check | Result |
|---|---|
| chatCrypto | vitest 51/51 (new hasDeviceIdentity test) |
| social | tsc (src and tests) clean; vitest 406 passed, 4 skipped (new `storeInboxRealtime.test.ts`, 4 tests) |
| seller | tsc clean; contracts 39/39 (new `storeInboxLive.test.ts`, 8 tests); units 4/4; eslint on changed files: 0 errors |
| seller `next build` (`SELLER_USE_MOCKS=true`) | OK; tsc clean after the final lint fixes |
| webapp (sub-agent) | tsc clean, units 178/178, contracts 78/78 |
| mobile (sub-agent) | tsc clean, jest 371/371 (including modalSystem) |
| webKit dialog tests (sub-agent) | 21/21 |
| gateway | not touched, not run |
| Elixir realtime | `mix` is not installed on this machine, so it wasn't run. No Elixir files were changed. |

Adversarial checks:
- **Two tabs:** a real-crypto test runs two tabs sharing one sealed store. Only the leader creates a ChatCryptoClient, and the follower's decrypts go through the leader. After the leader closes, the follower takes over and decrypts the next message from the same ratchet state. A call that was in flight when the leader closed is re-run by the new leader.
- **Staff removed mid-session:** social tests show a removed staff member gets 404 on topic membership, which revokes their subscription, and is left out of fan-out. Sends return 403 NOT_STORE_INBOX_MEMBER (existing test). Key rotation on removal is covered by the existing chatCrypto sender-key rotation test.
- **Upload failing part-way:** a corrupted chunk returns 422. The session is aborted and its completion returns 404, so nothing is sent. Plaintext uploads (`application/pdf` for chat) return 415. A good upload round-trips, and the stored bytes don't contain the plaintext.
- **Offline then reconnect:** the socket closes, the backoff is scheduled, the reconnect re-authenticates and re-subscribes, and status goes live, then polling, then live. The catch-up merge drops duplicates and keeps time order, and pending messages confirmed by the server are removed.
- **Old plaintext client gets 422:** the existing seller contract, social and Go tests still pass (PLAINTEXT_NOT_ACCEPTED). The mock chat upload also refuses non-encrypted mime types.

## Owner follow-ups
- Add `"@zudomart/chat-crypto": "workspace:*"` to apps/seller (still on the earlier tsconfig-alias workaround).
- Consider a short-lived, socket-only realtime ticket instead of handing the access token to the browser.
- Add an `order` kind to social's shared-content cards so customers get a rich order card.
- Staff assignment needs a backend model before it can be displayed.

---

# Follow-up (2026-10-11): realtime socket token, instant staff revoke, order cards

`@zudomart/chat-crypto` is now in apps/seller/package.json (the coordinator added it). No package or lock files were touched by me, and nothing was committed.

## 1. Short-lived socket-only realtime token
- **Auth service (`modules/auth/src/modules/realtimeTokens`):** new `POST /api/v1/auth/realtime-token`.
  - Requires a session access token, is rate-limited, and only works for an active account with a live, unrevoked session. Suspended accounts are refused, and a scoped token can't be used to mint another one.
  - The token it returns has audience `zudomart-realtime`, `scope: "realtime"`, the session's `sid`, a `jti`, and lasts 90 s (`jwtauth.RealtimeToken*` constants: allowed range 30–120 s).
  - It is only used to open the socket.
- **Refused everywhere else:**
  - The Go `jwtauth.VerifyAccessTokenAndExtractPrincipal` now rejects any token that carries a `scope` claim, on top of the audience check, so widget and realtime tokens can never pass as access tokens.
  - The gateway `AccessTokenVerifier` does the same. TS services trust the gateway's identity headers, so they are covered too.
  - The gateway routes `/api/v1/auth/realtime-token` to identity (signed-in only, with the same rate limit as widget-token).
- **Elixir realtime:** the verifier now requires `scope == "realtime"` (`@realtime_scope`, overridable in config). The audience is `zudomart-realtime` in config, test and runtime (env `REALTIME_TOKEN_AUDIENCE`). Session access tokens and widget tokens are refused on the socket. The verifier and socket tests were updated, and a scope test was added.
- **Logout closes sockets:**
  - `logOutSession` now emits `session.revoked` (reason "logout") in the same transaction. Previously only the revoke-session endpoint did.
  - The existing realtime account-enforcement router puts the session on its revocation list and disconnects that session's sockets (close code 4403, `session.ended`).
  - Revoke-session and revoke-others already emitted this event.
- **Clients:**
  - The seller `/bff/realtime` now exchanges the session server-side for a realtime token and returns `{ url, realtimeToken }`, so the access token never reaches the browser.
  - Mobile `core/realtime.service.ts` fetches a fresh realtime token before every connect and reconnect. The duplicate `services/realtime.service.ts` now just re-exports it, and there's a mock route for the token.
  - The webapp has no socket.

## 2. Removed staff lose the subscription immediately
- Catalog already emits `store.staff_removed` / `store.staff_updated` (`{storeId, accountId, role, status}`). Social now consumes both: the local RabbitMQ topology and definitions were regenerated with `generateDefinitions.mjs`, adding only those two bindings.
- The new social handler `revokeStoreInboxAccess`:
  - drops social's 10 s cached inbox team for that store and re-reads the live team
  - if the account no longer has `messages:manage`, emits `conversation.memberRemoved {conversationId, accountId}` for the store's 500 most recent conversations
- The realtime service already handles `conversation.memberRemoved`. It forgets the cached membership for that account and topic, re-checks with social (now 404), and pushes `subscriptions.revoked`, which the dashboard shows as "You no longer have access to this conversation."
- Conversations beyond the newest 500 are still covered by the 60 s recheck. Fan-out to `user:<id>` stops as soon as the team cache is dropped, and sender-key rotation keeps new messages unreadable.
- Social tests cover the revoke, the no-op when the teammate keeps access, and the router (including a malformed event).

## 3. Order share cards
- **Go orders:** `GET /api/v1/internal/share-cards/order/{orderId}?viewerId=` (internal token). It sits beside catalog's `{kind}/{id}` route on the shared goCommerce mux, where the more specific pattern wins.
  - It returns a minimal summary only to the buyer, or to a member of that store's team with `orders:view`: "Order ZM-1042", "3 items · shipped", total, `priceLabel`, first item image.
  - Anyone else gets a 404, which social turns into `availability: "unavailable"`.
- **Social:** `order` was added to the share reference kinds (validator, model, resolver) and goes through the existing commerce share-card resolver.
- **Clients:**
  - Seller sends order cards as `kind: "shared"` with `sharedContent {order}` inside the ciphertext (the text fallback is gone) and renders them through `/chat/content`. The mock was updated.
  - The webapp card has an Order label, links to `/orders/:id`, and shows "Only the buyer and the store can see this order." when unavailable.
  - Mobile opens OrderDetail from the card; types and mock were updated.

## Incident: disk full (fixed)
The disk hit 100% (Go build cache). A write I made at that moment truncated four social files to 0 bytes, and I restored all four:
- `interfaces/shareCardResolver.interface.ts` and `services/sharedContentCard.service.ts` were restored from HEAD, which is identical to the versions I had read earlier that day.
- `models/message.model.ts` was restored exactly from the E2EE agent's transcript, which printed the full file right after its last edit.
- `validators/messages.validator.ts` was rebuilt from my own earlier reads of the post-E2EE file, which covered every line (39 lines).

Social tsc is clean and the full suite passes, which supports the rebuild. Still, ask the E2EE owner to glance at `messages.validator.ts`. I also deleted Go build-cache entries older than 12 h to free space before the coordinator cleared it.

## QA (follow-up)
| Check | Result |
|---|---|
| Go jwtauth | pass (new: realtime token refused by access, widget and widget-or-access middleware; lifetime bounds) |
| Go auth | vet clean; all tests pass. The new `TestRealtimeTokenIsShortLivedSocketOnlyAndSessionBound` ran against local Postgres (localhost:15432) and passed; widget token test also passed |
| Go orders | vet and build clean; `getOrderShareCard` unit test passes. The viewer-authorization query is not covered by a DB test (orders has no ent test harness) |
| goCommerce + goIdentity | build OK |
| social | tsc (src and tests) clean; full suite 410 passed + 1 fixed (`orderShareCard` assertion), 4 skipped; storeInbox and order-card tests 14/14 |
| gateway | tsc clean; 1638/1638 (new: realtime token refused on 4 routes; issuance route) |
| seller | tsc clean; contracts 39/39 |
| Elixir realtime | `mix compile --warnings-as-errors` clean in the test env. **`mix test` did not run:** it fails at startup with `Could not start application syntax_tools: could not find application file`. The OS Erlang/OTP 29 install is missing the `erlang-syntax-tools` package; `code:lib_dir(syntax_tools)` returns `bad_name`. Owner action: `sudo apt install erlang-syntax-tools`, then `mix test`. The updated ExUnit tests (verifier scope, socket token claims) are therefore unrun |
| webapp | tsc clean; contracts 78/78, units 181/181 |
| mobile | tsc clean (after adding the `order` label to `postLinkCard`); jest: the full run had 71 of 72 suites passing (375 tests). The one failing suite was the new `realtimeSocketToken` test, which broke on a jest mock-variable naming rule; after fixing it, it passes (3 tests) along with the deep-link suite. The full run wasn't repeated |
| seller | `next build` with `SELLER_USE_MOCKS=true` OK |
