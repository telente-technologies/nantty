# Webapp ↔ mobile parity: report (2026-10-10)

Mobile (apps/mobile) is the reference. Status is the state **after** this pass. Nothing was committed.

## Step 1: broken builds fixed

### Webapp (11 → 0 tsc errors)
- **Message requests and inbox folders.** `ConversationFilter` stays `"all" | "direct"`, the same as mobile and the social validator.
  - Folders are a separate `InboxFolder` (`chats | requests | spam`). They are listed via `GET /api/v1/conversations?folder=…`, as in `conversations.validator.ts`.
  - New `types/chatSafety.type.ts` holds `InboxFolder` and `SharedContent*`. `SharedContentKind` includes `story` because social's `referenceKinds` does.
  - `Conversation` gained `inboxFolder` and `spamReason`. `Message` gained `sharedContent` and `attachment`.
  - The list panel now has mobile's Chats/Requests/Spam title menu. All/Direct tabs appear only in Chats.
  - New `inboxRequestActions.tsx` mirrors mobile:
    - Accept or Not spam, Delete, and Block (with confirm).
    - Report, and Report and block.
    - Explanations: "They won't see that you've read this until you accept." / spam reason.
  - In the chat page, requests and spam behave like mobile: no read receipt is sent, the composer is hidden, the actions are shown, and Delete/Block return to /chats.
  - Endpoints: `POST /conversations/:id/accept`, `/not-spam`, `/block`, and `DELETE /conversations/:id`. All are checked against `conversations.routes.ts`.
- **Shared content cards (E2EE chat).** These are typed now. The card shows the image, price, live viewer count and out-of-stock state. Story, clip and profile links are added.
- **Saved replies (comment).** The `comment` type has a "Replies" tab and the copy "No saved replies".
  - **Contract bug fixed:** social returns `preview.author` as a *username string* and `title` as nullable. The web type expected `UserSummary`, so the real backend would have rendered "@undefined". The type and mocks now match social.
  - Hrefs are now built client-side: social's `/products/:id` and `/clips/:id` don't exist on web. Replies link to the new thread route.
- **`clipTaggedPill`:** removed the unused import. Mobile's pill has no icon.

### Admin (31 → 0 tsc errors)
- The owner's commit `a6e109a9a` had already moved money to the real go-wallet endpoints:
  - `GET /admin/withdrawals`
  - `GET /admin/withdrawals/{id}`
  - `POST /admin/withdrawals/{id}/review` (`{decision, reason}` plus a required Idempotency-Key; staff permission `money.withdrawals.*`)
- That commit left the old `payout*` UI and its mock orphaned.
- `fetchPayouts`, `fetchPayoutDetail` and `decidePayout` are now exported, wired to those real endpoints (`decidePayout` → review, key required).
- The orphaned `payoutsWorkspace`, `payoutDetailPanel`, `payoutDecisionDialog` and `payouts.mock` are now thin re-exports of the withdrawal implementations. The page already uses `WithdrawalsWorkspace`.
  - The permission system blocked deleting these files. They can be deleted safely if you want.
- `apiAccess.config.ts` was checked and is consistent: `/admin/withdrawals` and `/admin/payouts` are behind `payouts:approve`, and step-up applies to review and `payouts/run`.
  - **Gap:** `POST /admin/payouts/run` is allowed but no UI calls it.
  - **Gap:** `/admin/wallet/seller-reserves` (go) has no access rule or UI.

## Step 3: comments cursor expiry (mobile + webapp)
Social returns `400 CURSOR_EXPIRED` from `rankedConversation.service.ts`, on both `/posts/:id/thread` and `/posts/:id/comments`. The fix:
- Detects it and never retries it.
- **Once** per list, trims the cached infinite query to page 1 and refetches from the start (no skeleton flash).
- Scrolls the list to the top and shows the toast "Comments updated".
- If the restart itself fails, the normal error shows. A second expiry shows the normal error rather than looping.

Where it lives:
- **Mobile:** `hooks/useRestartCommentsOnExpiredCursor.hook.ts`, wired into `usePostConversation` (post detail) and `useTopLevelCommentsForPost` (clips sheet). 7 jest tests.
- **Webapp:** `utils/commentsCursor.util.ts` plus `components/feed/restartCommentsOnExpiredCursor.hook.ts`, wired into `conversationPanel`, `commentsPanel` and `clipCommentsSheet`. 4 node tests, including a real `QueryClient` restart.

## Step 2: what I built (priority order)

1. **Feed and composer.** New page `/post/new`, linked as "Post" in the sidebar and "Create" in the bottom nav when signed in.
   - **Text:** 280 characters, or 2000 for Premium (from mobile). Counter turns amber or red near the limit. Hint: "Type @ to mention someone or # to add a hashtag".
   - **Mentions:** `MentionAutocompleteInput` now has a multiline mode.
   - **Media:** up to 10 photos or videos.
     - Add them by picker, drag-drop or paste.
     - The app's validation and copy are used for format, size and video length.
     - Each tile has a progress bar, retry, reorder and remove.
   - **Quote:** pasting a post link shows the quote preview, which can be removed.
   - **Audience:** Everyone or Followers.
   - **Advanced settings:** who can reply, subscribers-only (approved creators only), mark as sensitive with labels (adult labels only for adults), and AI generated.
   - **Tags:** tag people via `GET /tags/candidates`, and product tags (`productIds`, which social accepts).
   - **Button label:** "Uploading N%…", then "Posting…". After posting it replaces the page with the post. Mobile's Drafts became an autosaved local draft with "We kept your unsent draft · Discard draft".
   - **Uploads** use the media service's session protocol:
     - `POST /media/uploads`
     - Parts ≤ 8 MB go through the BFF raw `PUT /media/uploads/:id/chunks/:i`. Bigger parts use presigned URLs.
     - Then `POST …/complete`.
     - Up to 4 parts run in parallel. Transient failures back off and retry. Remove aborts the upload. Uploads retry automatically when the browser comes back online.
   - **Not built because mobile/backend have no such feature:** scheduling (no `scheduledAt`) and hashtag autocomplete.
   - **Location tag skipped:** mobile calls `GET /api/v1/places/search`, which **does not exist** in the gateway or any service. This is a mobile bug.
2. **Post detail and comments.**
   - New guest-readable deep link `/post/[postId]/comment/[commentId]`, the equivalent of mobile's CommentThread. It uses `GET /comments/:id/thread` (focus, ancestors and replies) and has a reply composer.
   - Post detail and thread now tell apart "no longer available" (404/410), "You can't view this post" (401/403) and "Couldn't load" (with retry), using mobile's copy.
   - The webapp thread mock returned `{data:[]}` for a deleted comment and had no focus/ancestors. It now returns 404 `COMMENT_NOT_FOUND`, matching social.
3. **Profile.**
   - Own profile has search and ⋯ beside it. The ⋯ menu is a port of `ownProfileMenu.util`, same items and order:
     - Seller dashboard
     - Creator entry (Creator tools / application status / Switch to creator account)
     - Follow requests with a badge
     - Saved, My orders, Wallet
     - Verification / Get verified
     - Settings
   - The body shortcuts (Saved/Orders/Notifications/Settings icons) and the /me footer were removed. The body now has "Edit profile" and "Share profile", as in mobile.
   - New pages:
     - `/me/edit`: name ≤50, bio ≤160, avatar and banner uploads → `PATCH /users/me {avatarMediaId, bannerMediaId}`.
     - `/me/follow-requests`: Approve and Decline.
     - `/user/[id]/connections`: Followers/Following/Shopped/Suggested/Blocked, with search, follow/unblock and the private-account message.
   - Followers and following counts are now links.
   - Visitor ⋯ gained "Block {name}", with mobile's confirm copy.
4. **Chats.** Folders, request actions and shared cards (Step 1). New "New message" dialog using `GET /search/people`, then start a conversation.
5. **Mart and checkout** (payment step untouched):
   - `/product/[id]/reviews`: average, 5→1 breakdown from `/rating-summary`, infinite list with verified purchase and seller reply. Guest-readable.
   - `/product/[id]/review`: write a review. Mobile's validation and error mapping are ported (`ALREADY_REVIEWED` 409, `REVIEW_REQUIRES_PURCHASE` 403, invalid input, network).
   - "Write a review" appears on delivered or completed order items. The product rating links to the reviews page.
   - Contract fix: the review author has no `verified` field (go `ReviewAuthorView`).
6. **Wallet.** Reachable from the ⋯ menu. The pages themselves were left alone: they carry another agent's uncommitted edits.
7. **Settings.**
   - Rebuilt to match mobile's groups, with **one distinct icon per row**. A test enforces that icons and hrefs are unique.
     - Account: Account, Account status, Security & Password, Privacy, Privacy & Data, Notification.
     - Preferences: App Preference, Shipping Address.
     - Selling: Start selling / Seller dashboard.
     - Support: Support, Your reports, About.
   - Log out is at the bottom.
   - Saved, Orders and Profile were removed, so nothing duplicates the ⋯ menu.
   - New pages:
     - `/settings/account`: username change with availability, policy and cooldown; email and phone; deactivate.
     - `/settings/security`: password change with the rules; Blocked users; Identity verification.
     - `/settings/about`.
   - The privacy page gained a Public/Private profile toggle (`PATCH /users/me {isPrivate}`), plus anchors.
   - Widgets were left to the widgets agent.
8. **Posts.** The own-post ⋯ menu gained "Promote this post", which links to `/boost/[postId]`. That page previously had no entry point.

All mocks were updated so mock mode works. New `composer`, `profileParity` and `productReviews` mocks are placed before the older routes, and folder/accept/not-spam/delete were added to chats. Mock errors use the backend codes:
- `POST_EMPTY`, `TEXT_TOO_LONG`, `MEDIA_NOT_FOUND`, `PRODUCT_NOT_TAGGABLE`
- `COMMENT_NOT_FOUND`, `CONVERSATION_NOT_FOUND`
- `VALIDATION_FAILED`, `ALREADY_REVIEWED`, `REVIEW_REQUIRES_PURCHASE`

## QA
- **webapp tsc:** 0 errors.
- **webapp tests:** units 147/147 and contracts 57/57. New tests:
  - `parityMocks.test.ts`: folders, saved replies, composer happy and sad paths, thread 404, follow requests, profile edit, reviews.
  - Unit tests: `mediaUploadRules`, `composerDraft`, `contentAvailability`, `ownProfileMenu`, `productReviews`, `settingsLinks`, `commentsCursor`.
- **admin tsc:** 0 errors.
- **mobile tsc:** 0 errors.
- **mobile jest:** 57 suites, 311/311 passing. This includes the 7 new cursor-restart tests.
- **`next build`:**
  - Plain run: it compiles and type-checks, then stops prerendering `/sitemap.xml` because `WEBAPP_API_URL` isn't set. That is a production env requirement, not code.
  - With `WEBAPP_USE_MOCKS=true` (env only): exit 0, 67/67 pages. All new routes are built.

### Adversarial checks
| Check | Result |
|---|---|
| Double submit | Ref guard plus a busy button. The same Idempotency-Key is reused until the draft changes. The mock replays identical posts. Reviews use a ref guard and a key that rotates only on non-retryable outcomes. |
| Upload fails mid-way | The tile shows the error and Retry. Post is disabled while any upload has failed. A failure during publish shows "A photo or video didn't upload. Retry it or remove it, then post again." Removing an item aborts it and calls `DELETE` on the session. |
| Refresh mid-flow | Text and settings survive in localStorage per account, with corrupt or blocked storage tolerated. `beforeunload` warns while files are attached or a publish is pending. Media can't survive a reload; this is stated. |
| Deep link to deleted or private item | Post, thread and reply each show distinct copy, with no retry for gone or denied. Chat shared cards show "no longer available" / followers-only. |
| Signed-out user on auth-only page | `/post/new` is excluded from the guest patterns, so the proxy sends the user to /login?next=. There is also a page guard. Thread and reviews pages are guest-readable, as on mobile. Tested in `contentAvailability.util.test.ts`. |
| Back button | Publish and review use `router.replace`, so Back doesn't reopen the form. The thread page falls back to the post when there is no history. Connections tab changes use `replace`. |
| Offline | The composer shows an offline notice and disables Post. Uploads fail with mobile's offline copy and resume on `online`. Request errors use the existing `NETWORK_UNAVAILABLE` copy. |

## Parity matrix
Legend: ✅ present, 🟡 partial, ❌ missing. Rows marked **(this pass)** changed now.

| Area | Mobile route | Webapp | Status | Remaining gaps |
|---|---|---|---|---|
| Splash/Onboarding/Welcome | Splash, Onboarding, Welcome | (auth)/welcome | ✅ | – |
| Login, Signup steps, OTP, Birthday, Username, Personalization, Forgot/Reset | Auth stack | (auth)/login, signup steps, forgot/reset | ✅ | – |
| Home feed | Home (For you/Following, topics, Feed↔Mart swipe, suggested clips) | / | 🟡 | No Feed↔Mart toggle (Mart is /mart); no suggested-clips row |
| Mart tab + sponsored carousel | martTab, martHighlightsCarousel | /mart | 🟡 | No "Sell on Zudomart" banner |
| CreatePost: post | CreatePost | /post/new **(this pass)** | ✅ | Location (mobile endpoint missing in backend); post-as identity (`asProfileId`) |
| CreatePost: clip | ClipComposer | – | ❌ | Sound, trim, look, slideshow, video reply |
| CreatePost: story | storyCapturePanel | – | ❌ | Story creation (upload service now exists to build on) |
| CreatePost: live (host) | liveSetupPanel, Live host | – | ❌ | Go live, RTMP key, host controls |
| Post detail + X-style replies | PostDetail | /post/[id] | ✅ | – |
| CommentThread | CommentThread | /post/[id]/comment/[cid] **(this pass)** | ✅ | – |
| PostQuotes / PostAnalytics | PostQuotes, PostAnalytics | /post/[id]/quotes, /analytics/post/[id] | ✅ | – |
| Post ⋯ menu | contentOptionsSheet | contentActionsMenu | 🟡 | "Promote this post" added; no "Not interested" |
| Boosted label (rocket) | sponsoredContent | postCard | ✅ | – |
| Clips | Clips (For You/Following) | /clips, /watch | ✅ | No video-reply creation |
| Story view | Story | /stories, /stories/[userId] | 🟡 | Not linked from shell; no reply, ads, report, look |
| Story analytics | StoryAnalytics | one line in viewer | 🟡 | No viewers screen |
| Live watch | Live | /live, /live/[id] | 🟡 | No tips, reactions, share sheet, guest join, safety appeal |
| LiveEnded | LiveEnded | badge only | ❌ | Ended summary, top supporters |
| Own profile + ⋯ menu | Me + OwnProfileMenu | /me **(this pass)** | 🟡 | Profile switcher (acting profile), own-profile cards |
| Other profile + ⋯ | UserProfile(+ByUsername), profileMoreSheet | /[username], /user/[id], /u/[username] | 🟡 | Block added; "Send coins" missing |
| Profile tabs | Posts, Reposts, Clips, Sounds, Store | Posts, Clips, Reposts, Media | 🟡 | Sounds and Store tabs |
| Follow/unfollow confirm, post bell | confirmedFollowToggle, postNotificationsSheet | useFollowUser, PostNotificationsBell | ✅ | – |
| EditProfile | EditProfile | /me/edit **(this pass)** | ✅ | – |
| Connections | Connections | /user/[id]/connections **(this pass)** | ✅ | Sort options |
| FollowRequests | FollowRequests | /me/follow-requests **(this pass)** | ✅ | – |
| Saved | Saved | /saved **(this pass: replies)** | ✅ | – |
| Search/explore/hashtags | Search | /explore | ✅ | No hashtag page on either side |
| Category / Sound | Category, Sound | /category, /collections, /sounds | 🟡 | "Use this sound" needs the clip composer; /sounds unlinked |
| Notifications + per-post mute | Notifications | /notifications + post menu | ✅ | – |
| Chats list (folders) | Chats | /chats **(this pass)** | 🟡 | Story tray |
| Chat (E2EE) | Chat | /chats/[id] **(this pass: requests, shared cards)** | 🟡 | Sending attachments/voice, reactions, typing, mute, streaks, lock gate |
| NewMessage | NewMessage | dialog **(this pass)** | ✅ | – |
| NewGroup / ConversationInfo | NewGroup, ConversationInfo | – | ❌ | Groups and channels creation and info |
| ChatSettings / ChatNotificationSettings / ChatPasscode | (same) | – | ❌ | Who can message, chat notifications, passcode |
| ProductDetail | ProductDetail | /product/[id], /p/[slug] | 🟡 | Reviews linked (this pass); brand not linked |
| ProductReviews / WriteReview | ProductReviews, WriteReview | /product/[id]/reviews, /review **(this pass)** | ✅ | – |
| Wishlist | product like/save | SaveToggleButton | 🟡 | `likeProduct` unused |
| Store | Store | /store/[id] | 🟡 | Posts tab, message store |
| Cart / Checkout / Payment | Cart, Checkout, Payment | /cart, /checkout, /pay/return | ✅ | Left untouched (payments agent) |
| OrderSuccess | OrderSuccess | notice on order page | 🟡 | Dedicated success screen |
| Orders / OrderDetail | Orders, OrderDetail | /orders, /orders/[id] **(this pass: write review)** | 🟡 | Dispute, escrow screen, contact seller |
| OpenDispute / DisputeDetail / EscrowStatus | (same) | – | ❌ | All three (overlaps payments/escrow agent area) |
| Wallet / Transactions / CoinActivity / StoreRewards | (same) | /wallet, /wallet/transactions, /wallet/coins, /store-rewards | 🟡 | Buy-coins sheet; payout setup card; wallet reached via ⋯ (this pass) |
| Withdraw / PayoutAccounts / PayoutSetup | (same) | /wallet/payouts | 🟡 | Cancel withdrawal, bank picker, PayoutSetup onboarding (page under another agent's edits) |
| PromotePost / BoostStatus | PromotePost, BoostStatus | /boost/[id], /boost/status/[id] | ✅ | Entry point added (this pass) |
| Coins / gifts | coin sheet, live gifts | coinPurchaseDialog, liveGiftTray | 🟡 | Send coins to a profile |
| CreatorProgram / Application / Dashboard / Subscribe | (same) | /creator/program, /creator/apply, /creator, subscribe dialog | 🟡 | Document upload is a URL field; no plans management, affiliations or earnings ledger |
| MySubscriptions | MySubscriptions | – | ❌ | List, cancel, resume |
| Verification / Apply / Identity | (same) | /verification, /settings/verification | 🟡 | Document photo upload; /verification now linked via ⋯ |
| Settings home (distinct icons) | Settings | /settings **(this pass)** | ✅ | Payment Methods row/page, business/brand rows |
| SettingsAccount / Username | SettingsAccount, SettingsUsername | /settings/account **(this pass)** | ✅ | Phone change |
| SettingsSecurity / ChangePassword / BlockedUsers | (same) | /settings/security **(this pass)** | 🟡 | 2FA toggle, data sheet |
| SettingsPrivacy / PrivacyData / ContentPreferences | (same) | /settings/privacy **(this pass: private toggle)** | ✅ | – |
| SettingsNotifications / AppPreference | (same) | sections on /settings | 🟡 | Language, country/currency, accessibility |
| SettingsPaymentMethods | SettingsPaymentMethods | – | ❌ | Cards, subscriptions, seller payouts (payments area) |
| ShippingAddresses / AddressForm | (same) | /settings/addresses | ✅ | – |
| SettingsSupport / About | (same) | /help, /settings/about **(this pass)** | ✅ | – |
| Help centre / Support tickets / MyReports | (same) | /help/*, /settings/reports | ✅ | – |
| Legal pages | links | legal links, policy re-accept host | ✅ | – |
| AccountStatus / appeals | AccountStatus | /settings/account-status | ✅ | – |
| Suspended account | suspendedAccount | – | ❌ | Appeal/export/log-out screen |
| Seller application / dashboard / products / orders | Seller* | /seller/* | 🟡 | Product images (`imageUrls: []`; can now use mediaUpload.service), sizes/colours, brand/category, post-as-store |
| BusinessDocuments / Brand / BusinessProfile | (same) | – | ❌ | All |

## Findings for the owner and other agents
1. **Mobile `GET /api/v1/places/search` has no backend route.** Location tagging in the mobile composer can't work.
2. **Mobile `SavedItem` (comment) reads a top-level `postId`, but social returns it inside `comment`.** Mobile's "open saved reply" navigates with `postId` undefined. The web was fixed to read `comment.postId`.
3. **Social's saved `preview.href` uses `/products/:id` and `/clips/:id`,** which no client route serves.
4. **Presigned upload parts over 8 MB need `connect-src` for the storage origin in the webapp CSP** (`next.config.ts`). I didn't touch CSP because the widgets agent owns it. Parts ≤ 8 MB go through the BFF and work today.
5. **Admin:** the orphaned payout files can be deleted. `POST /admin/payouts/run` and `/admin/wallet/seller-reserves` have no UI.

## Remaining work, largest first
- Clip, story and live creation.
- Chat groups, channels, settings, attachments and reactions.
- Disputes and escrow screens; payment methods.
- Creator plans, subscriptions and document uploads.
- Seller product images and options.
- Story tray and story features.
- Profile switcher and Sounds/Store tabs.
- Live tips, reactions and ended screen.
- Send coins, wallet buy-coins sheet and payout setup.
- Suspended-account screen; business/brand profiles; 2FA.
