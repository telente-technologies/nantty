# Change log — 1–2 October 2026

Every change made today, grouped by app. Standing rule: **any change to `apps/mobile` gets an entry here on the day it lands.** Forward-looking work lives in [plans.md](./plans.md).

Verified: `cd apps/mobile && npx tsc --noEmit` → clean. `cd apps/webapp && npx tsc --noEmit` → clean. `cd apps/studio && npx tsc --noEmit` → clean. `npx jest` in `apps/mobile` → no tests configured (607 files, 0 test matches).

---

## apps/mobile

### Feed — images

| File | Change |
| --- | --- |
| `src/components/feed/mediaPager.tsx` | **Root-cause fix for "images didn't fit the placeholder".** `pageWidth` was `min(windowWidth, 393)` while the pager container was the full card width, so on any device wider than 393 the page sizes and the `pagingEnabled` snap points disagreed — images bled into the next page. The root `View` now reports its real width via `onLayout`, and that measured width drives `getItemLayout`, the page children, the indicator and scroll-index maths. `MAXIMUM_PAGER_WIDTH` (393) now only caps the *derived video height*, so wide screens don't get giant feed videos while paging still matches the container. |
| `src/components/feed/mediaPager.tsx` | Image pages use `contentFit="contain"` (was `"cover"`) — the whole image is visible and centred in the placeholder, never cropped. |
| `src/components/feed/mediaPager.tsx` | Image pages are wrapped in an absolute-fill `Pressable` that opens the review viewer. |
| `src/components/feed/mediaLightbox.tsx` | **New.** Full-screen review viewer (`FrameAwareModal`): horizontal paged `FlatList` of the post's images with `getItemLayout`/`initialScrollIndex` so the tapped image is focused, close button + `n / total` counter, double-tap zoom to 2.5x with `PanResponder` panning, single tap closes, zoom state lifted to the parent so the list disables scrolling while zoomed. |

Only a sideways swipe advances pages; there is no auto-advance and no tap-to-advance.

### Feed — landscape video

| File | Change |
| --- | --- |
| `src/components/media/landscapeVideoFullScreenModal.tsx` | Rewritten. It no longer forces landscape the moment a clip is previewed. `showRotateButton = isLandscapeClip && !isRotated`; `rotateToFillScreen()` locks native orientation to landscape (`ScreenOrientation.lockAsync`) or, on web, sets `isRotated`. Rotation is applied with `styles.rotatedStage` — swapped `{width, height}` + `rotate: "90deg"`. Portrait is restored on close. Also fixed a duplicate `stageStyle` declaration and a broken `StyleSheet.absoluteFillObject` reference. |

### Feed — audio

| File | Change |
| --- | --- |
| `src/store/videoAudio.store.ts` | **New.** Persisted zustand store (AsyncStorage key `zm.videoAudioPreference`). Default: muted on native, audible on web. The user's play/mute choice survives app restarts. |
| `src/services/videoAudio.service.ts` | **New.** `claimAudioFocusForVideoPlayback()` / `releaseAudioFocusForVideoPlayback()` switch the Expo `Audio` session mode (`playsInSilentMode`, `allowsRecording`), so a feed video playing with sound **takes over from external music apps**; releasing restores normal behaviour. |
| `src/components/feed/mediaPager.tsx` | Overlay now renders an audio toggle on video pages (`SpeakerHigh24Icon`, muted state at `opacity: 0.35` — the same treatment already used by `clipPlaybackControls.tsx`; there is no speaker-slash glyph in the icon set). Reads/toggles the store, claims audio focus when the active page is a visible video and the store is unmuted, and passes `isMuted` down to `MediaPagerPage`, `ClipVideoPlayer` and `LandscapeVideoFullScreenModal` so pager, lightbox and full-screen playback agree. |
| `src/screens/clips/clips.screen.tsx` | Dropped the local `isMuted` state in favour of `useVideoAudioStore`, and claims audio focus while the active clip is allowed to play unmuted — so the mute choice is now one app-wide, persisted preference instead of per-screen. |

### Chat

| File | Change |
| --- | --- |
| `src/hooks/useKeyboardInset.hook.ts` | **New.** Measures the container's baseline height against the keyboard height (`RESIZE_DETECTION_RATIO 0.6`), survives rotation, returns `{ inset, handleLayout }`. |
| `src/screens/messages/chat.screen.tsx` | Replaced `KeyboardAvoidingView` (which fought the screen container and dropped content behind the keyboard on Android) with a plain bottom padding driven by the hook. `Screen` now uses `edges={["top", "bottom"]}`, `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`, and scrolls to end when the inset grows. Tapping the input now raises the keyboard with the composer riding on top of it. |
| `src/components/chat/voiceNoteBubble.tsx` | Play control renders `PauseFill24Icon` while `status.playing`, `Play24Icon` otherwise. It reverts automatically because playback sets `playing=false` on finish (`seekTo(0)` on `didJustFinish`). |
| `src/components/chat/chatBubble.tsx` | **Timestamps.** Every message bubble now carries a meta row with `formatClockTime(message.createdAt)` (11px, muted, aligned to the bubble side). A failed message shows `· Not sent` in error colour in the same row. System notices are unchanged (no timestamp). |
| `src/utils/formatDate.util.ts` | Added `formatClockTime(date)` → `hour: minute` in locale time. |
| `src/components/chat/typingDots.tsx` | **New.** Three 6px dots in a bubble-shaped chip bouncing in a staggered loop (`Animated.loop` + `Animated.sequence`, 160ms stagger, 320ms bounce, native driver), `accessibilityLabel="Typing"`. |
| `src/components/chat/chatHeader.tsx` | When someone is typing, direct conversations swap the plain `typing…` text for the dots; groups/channels keep `Ada is typing…` / `2 people are typing…` and show the dots alongside. Avatar still sizes up while the second line is present. |
| `src/screens/messages/chat.screen.tsx` | Added a `ListFooterComponent` typing bubble (`TypingRow`) for direct conversations, so the three dots float at the bottom of the message list exactly where the next message will land. Typing *signals* already worked (`realtimeService.sendTypingSignal` → `typingIndicators.store`); this is presentation only. |

### Creator subscriptions

| File | Change |
| --- | --- |
| `src/services/creatorProgram.service.ts` | `fetchSubscriptionState` pointed at the **wrong module** (`/api/v1/subscriptions/:id` = seller subscriptions) and there was no verify call at all. Now: `verifySubscriptionCheckout(reference)` → `POST /api/v1/creator-subscriptions/verify`, `fetchSubscriptionState` → `GET /api/v1/creator-subscriptions/:id`, plus new `listMySubscriptions`, `cancelSubscription`, `resumeSubscription`. |
| `src/types/creator.type.ts` | `CreatorSubscriptionCheckout` gains `reference` and `subscription`; `CreatorSubscriptionState` gains `creatorId`, `price`, `interval`, `currentPeriodEnd` and the full status union (`pending\|active\|past_due\|cancelled\|expired\|failed`) so the state can be rendered without a second fetch. |
| `src/screens/creator/creatorSubscribe.screen.tsx` | After the hosted checkout closes it now calls `verifySubscriptionCheckoutUntilSettled` (6 attempts, 1.5s·attempt backoff, stops as soon as `status !== "pending"`, seeded from the checkout's own `subscription` object), re-arms the idempotency key, catches browser-dismissal, and invalidates `plansOfCreator` + `mySubscriptions` on success. Previously it polled the wrong endpoint and never verified, so a paid subscription stayed `pending`. |
| `src/components/profile/profileSummary.tsx` | New optional `identityAction` rendered **inside the identity row**, right of the name — 34px, outlined in `colors.primary`, filled when `highlighted`. This is the prominent **Subscribe** button the requirement asked for (it used to be buried as the 4th action in the row below). |
| `src/components/profile/profileView.tsx` | Passes `identityAction` through. |
| `src/screens/profile/userProfile.screen.tsx` | Builds `identityAction`: `Subscribe` (filled) when the viewer isn't the creator and the creator has ≥1 active plan; `Subscribed` (outlined, opens the new screen) when `GET /creator-subscriptions` already has an active row for them. Removed the duplicate `Subscribe` entry from the overflow actions row. |
| `src/screens/creator/mySubscriptions.screen.tsx` | **New.** The subscriber's management surface: avatar + name (via `useUserProfileQuery`), `₦x / month`, `Renews {date}` / `Ended {date}`, `StatusPill` for all six statuses, **Cancel subscription** (outline, confirm sheet: *"Stop renewing this subscription?"* / *"Your access continues until {date}."* / `Not now`) while `active\|past_due`, **Resume subscription** while `cancelled`. Empty state when there are none. |
| `src/navigation/navigation.types.ts` + `src/navigation/main.navigator.tsx` | Registered the `MySubscriptions` stack screen. |
| `src/screens/settings/settingsPaymentMethods.screen.tsx` | Added a **Subscriptions** row between *Wallets* and *Payout for Sellers*. This is what makes the subscribe success screen's *"Manage or cancel anytime in Settings."* true. |
| `src/components/creator/creatorQueries.hook.ts` | New `mySubscriptions` query key + `useMySubscriptionsQuery(enabled)`. |
| `src/mocks/creatorSubscriptions.mock.ts` | Reworked to match: `presentState()` now emits the full `CreatorSubscriptionState`, checkout returns `reference` + `subscription`, and the single `GET /api/v1/subscriptions/:id` route was replaced with `GET /creator-subscriptions`, `POST /creator-subscriptions/verify`, `GET /creator-subscriptions/:id`, `POST …/:id/cancel`, `POST …/:id/resume`. |

Still **not** done here: webapp mirrors of these screens (Phase 2), the subscriber-side "Manage subscription" shortcut on the *subscriber's own* profile, and Gap D — a shortcut from the creator's profile straight to plan creation (plans §4.5).

### Auth — email only, no phone

| File | Change |
| --- | --- |
| `src/store/signup.store.ts` | Dropped the `channel` (`phone` \| `email`) choice. `destination` stays so the code path still knows what to verify. |
| `src/screens/auth/signUpContact.screen.tsx` | Email-only contact step: `What's your email?` / `Enter your email`. The `Phone number`/`Email` tabs, `NG +234` prefix and phone-privacy helper are gone. |
| `src/screens/auth/login.screen.tsx` | Field label **`Email`** (placeholder `Enter your email`). `autoComplete="username"` retained so username login still works; no rendered copy says "email/username". |
| `src/screens/auth/onboarding.screen.tsx` | `Use username` → **`Email`**. Footer switch only flips `setMode`; the primary button label follows the mode (`Email` → signup, `Use email/username` → `/login`). |
| `src/screens/auth/forgotPassword.screen.tsx` | Email-only recovery. |
| `src/services/auth.service.ts` | `RegisterInput.phone` removed. |
| `src/navigation/…` + `src/components/auth/contactChannelTabs.tsx` | Channel tab component deleted. |
| `src/components/icons/custom/analytics24.tsx` + `custom/index.ts` + `icons/index.ts` | **New.** `Analytics24Icon` — three ascending bars over a baseline (the Twitter/X-style analytics glyph, **not** an eye), exported from the icons barrel. |

### Feed — reshare

| File | Change |
| --- | --- |
| `src/types/models.type.ts` | `Post.resharedFrom?: Post \| null` (the quote body stays in the existing `text` field). |
| `src/services/posts.service.ts` + `src/mocks/posts.mock.ts` | `repostPost(postId, text?)`; mock repost route + `reshare_seed_1/2`. |
| `src/components/feed/reshareSheet.tsx` | **New.** Bottom sheet with **Repost** and **Quote** actions. |
| `src/components/feed/resharedPostBlock.tsx` | **New.** The dedicated reshare presentation inside a feed card. |
| `src/hooks/usePostInteractions.hook.ts` | Added `resharePost` + `prependToEveryCachedFeed` so the reshared post appears at the top of every cached feed page immediately. |
| `src/components/home/feedTab.tsx`, `src/screens/posts/postDetail.screen.tsx` | Reshare opens `ReshareSheet` instead of calling `repostPost` directly. |

### Live — go-live source picker (Camera / Screen / External)

| File | Change |
| --- | --- |
| `src/types/social.type.ts` | New `LiveSource = "camera" \| "screen" \| "external"`; `LiveSessionDetails` gains `ingestUrl?` and `streamKey?`. |
| `src/services/live.service.ts` | New `issueStreamKey(liveId)` → `POST /api/v1/lives/:liveId/stream-key` → `{ ingestUrl, streamKey }`. |
| `src/mocks/live.mock.ts` | New `POST /api/v1/lives/:liveId/stream-key` mock: issues (and then reuses) `rtmp://studio.zudomart.com/live` + `sk_live_…`, and writes both onto the hosted session so `GET /api/v1/lives/:id` returns them afterwards. |
| `src/components/create/liveSetupPanel.tsx` | **Source picker** above the record button: `Camera` / `Screen` / `External` segmented control (`camera24`, `arrowsOutSimple24`, `videoCamera24` glyphs). Camera keeps the existing `CameraBackdrop`; Screen shows a dark capture stage (*"Your screen goes live"*); External shows either *"Go live to get a server URL and stream key"* or the issued **Server URL + Stream Key card** with a native **Share** sheet and *"Waiting for your encoder to connect."* When the key exists the record button is replaced by **Open live room**. |
| `src/screens/create/createPost.screen.tsx` | Owns `liveSource` + `liveCredentials`. `goLive` creates the session and, for `external`, issues the key before rendering — camera/screen still navigate straight to `Live`, external stays on the panel with the key card. |

Real screen capture (ReplayKit / MediaProjection) is still plans §8.3.7 **[LATER]** — the Screen source is the mock-stage today.

### Impressions + owner-only analytics

| File | Change |
| --- | --- |
| `src/components/feed/postCard.tsx` | `Impressions` counter under every post with `Analytics24Icon`. `onPressAnalytics` fires **only** when `isOwnPost`. |
| `src/screens/posts/postAnalytics.screen.tsx` | **New.** Owner note, 4 metric cards, 7-day bar chart, post summary. |
| `src/navigation/navigation.types.ts` + `main.navigator.tsx` | Registered `PostAnalytics`. |
| `src/components/home/feedTab.tsx`, `src/screens/posts/postDetail.screen.tsx` | Wire the counter to the screen (owner only). |
| `src/types/models.type.ts`, `src/services/posts.service.ts`, `src/mocks/posts.mock.ts` | `PostAnalytics` / `PostAnalyticsDaily`, `fetchPostAnalytics()`, and an owner-only mock route returning `403 NOT_POST_OWNER` for anyone but the author. |

### Feed / like / reels / live batch

| File | Change |
| --- | --- |
| `src/components/feed/postCard.tsx` | **Impressions counter is now last** (Like → Comments → Repost → Share → Impressions). **Tip counter removed** — tipping lives in reels (and lives), not the feed. Liked state renders the **solid** `HeartFill72Icon` instead of the outline. Double-tap on the card body likes the post, pops the centre `LikeBurst` red-heart animation, and defers the single-tap navigation by `DOUBLE_TAP_WINDOW_MS` (280ms) so nav and like never race. New `onPressOriginalPost` prop. |
| `src/components/home/topicFilterRow.tsx` | The `For You` chip is a **dropdown**: `FrameAwareModal` menu with `For you` / `Following` + `Check16Icon`, label tracks the active mode; picking a topic returns the mode to For You. |
| `src/components/home/feedTab.tsx` | `feedMode` state → `[...feedQueryKeyPrefix, feedMode, selectedTopicId]`; following queries `fetchFollowingFeedPage`. **Dedupe by post id across pages** — fixes the `Encountered two children with the same key, .$ad_post_1` warning (the sponsored slot repeats `ad_post_1` every 4 pages). Wires `onPressOriginalPost`. |
| `src/components/feed/resharedPostBlock.tsx` | The **whole reshared block is pressable** → opens the original post's `PostDetail` (nested author pressable still opens the profile). |
| `src/components/feed/sponsoredContent.tsx` | CTA buttons actually work: `ctaUrl` is matched for `/products/:id` → `ProductDetail`, `/stores/:id` → `Store`, other `https://` links via `Linking.openURL`; the ad click is still recorded. |
| `src/mocks/productCatalog.mock.ts` | Sponsored placements now carry a `ctaUrl` (`https://zudomart.com/products/<id>`) so `Shop now` has a destination. |
| `src/components/clips/clipPage.tsx` | **Hold the clip for 300ms → temporary 2× playback** with a `2×` badge; release restores the selected speed. (Double-tap like + centre burst already existed on reels.) |
| `src/screens/live/live.screen.tsx` | **Double-tap the live stage likes it** — viewers only: `sendReaction("❤️")` + `LikeBurst` overlay. |

### Chat — emoji panel, plus menu, image messages

| File | Change |
| --- | --- |
| `src/components/chat/messageComposerBar.tsx` | Smiley toggles an in-bar **emoji panel** (a plain `CHAT_EMOJI` unicode `const` — **no emoji library added**; typing emoji from the keyboard keeps working). The right-side image icon is replaced by `Plus24Icon`. |
| `src/components/chat/chatAttachmentMenu.tsx` | **New.** `FrameAwareModal` bottom sheet: Photos, Camera, Location, Documents, Poll (custom `Document24Icon` / `Poll24Icon` — no file/poll glyph existed in the icon set). |
| `src/components/chat/chatComposerWithVoiceNotes.tsx` | `onPressPlus` opens the sheet; **Photos & Camera fully work** via the system picker (`pickPhotosAndVideosFromLibrary` / `takePhotoWithSystemCamera`); Location / Documents / Poll show a *coming soon* alert (deliberately no new native deps). |
| `src/components/chat/optimisticImageMessageSender.hook.ts` | **New.** `enqueueLocalMediaForUpload(…, "chat")` → optimistic image bubble with the local url → `waitForUploadedMediaId` → `sendImageToConversation`; local-url fallback, failure marks the message *Not sent*. |
| `src/services/messages.service.ts`, `src/mocks/chats.mock.ts` | `sendImageToConversation()` (`POST …/messages`, `{kind:"image", mediaId}`) + mock POST handler support for image messages (`media.type:"image"`). |
| `src/components/chat/chatBubble.tsx` | Renders image messages (`expo-image`, 200×260 bubble, padding override so the photo isn't cramped). |
| `src/screens/messages/chat.screen.tsx` | Wires `useOptimisticImageMessageSender` → `onSendImage`. |
| `src/components/icons/custom/document24.tsx`, `poll24.tsx` | **New** custom stroke icons, exported through `icons/custom/index.ts`. |

### Creator dashboard — analytics glyph + post drill-down

| File | Change |
| --- | --- |
| `src/screens/creator/creatorDashboard.screen.tsx` | Top-content rows are now `Pressable`: **posts open the owner-only `PostAnalytics` screen** (`{ postId }`); live rows stay non-interactive (no live-analytics screen yet). Each row's meta line now leads with the `Analytics24Icon` bar-chart glyph (never an eye) beside `Post · 9.8k views`, matching the feed's impressions counter. New `metrics` style row (icon + text, gap 4). |

### Creator Studio gating (§5.1)

| File | Change |
| --- | --- |
| `src/hooks/useCreatorStatus.hook.ts` | **New `useCreatorEntry()`** — the single gate: `CreatorDashboard` when status or application is `approved`, `CreatorApplicationStatus` when `pending`/`rejected`, else `CreatorProgram` (label: *Creator Studio* / *Application status* / *Join Creator Program*). `openCreatorProgramOrSettings(navigation, destination?)` now accepts the gated route (defaults to the old behaviour). |
| `src/components/profile/ownProfileShortcuts.tsx` | Shortcut chip uses `useCreatorEntry()` (was a plain `isApprovedCreator` binary); `ShortcutRoute` gains `CreatorApplicationStatus`. |
| `src/screens/settings/settings.screen.tsx` | The creator row uses `useCreatorEntry()` for both label and destination (was `isApprovedCreator ? "Creator dashboard" : "Creator Program"`). |
| `src/screens/create/createPost.screen.tsx` | Both live-lock escapes pass `creatorEntry.route` into `openCreatorProgramOrSettings`. |
| `src/screens/live/live.screen.tsx` | Same, for the host-blocked-from-going-live effect. |

### Creator Studio home — coins (§5.2)

| File | Change |
| --- | --- |
| `src/screens/creator/creatorDashboard.screen.tsx` | Restructured into the four blocks in order: **Coins** → **Wallet & earnings** (title + `CreatorEarningsCard` + Withdraw) → **Content** (new card: *Create post or clip* → `CreatePost`) → Top lives & posts → **Subscription plans**; affiliations + revenue rules stay after as extras. Header now **"Creator Studio"**. |
| `src/components/creator/studioCoinsSection.tsx` | **New.** Coins card: balance + earned rows (`useCoinBalance`), **Convert earned coins** (sheet), **Coin activity** (navigates to the new screen). |
| `src/components/coins/convertEarnedCoinsSheet.tsx` | **New.** Bottom sheet mirroring `TransferCoinsSheet`: numeric input validated against earned coins, `POST /api/v1/creators/earnings/convert` with a generated `Idempotency-Key` (kept across retries, cleared on success), success state shows cash received + earned coins remaining, balance invalidated; API errors (minimum payout, not enough earned coins) shown verbatim via `describeCoinError`. |
| `src/screens/wallet/coinActivity.screen.tsx` | **New.** `GET /api/v1/coins/transactions` as an infinite list: `+`/`− N coins` (credit green / debit red), balance-after, friendly date; pull-to-refresh + cursor **Load more**; empty state. |
| `src/navigation/navigation.types.ts` + `src/navigation/main.navigator.tsx` | New `CoinActivity` route registered next to `Transactions`. |
| `src/types/social.type.ts` | `CoinBalance` gains `earnedCoins?` (the API already returns it; optional so `liveGifting.hook`'s partial `setQueryData` still type-checks). New `CoinConversionReceipt` and `CoinActivityEntry` (exactly the API DTOs). |
| `src/services/coins.service.ts` | `listCoinActivity(cursor)` → `GET /api/v1/coins/transactions`; `convertEarnedCoins(coins, idempotencyKey)` → `POST /api/v1/creators/earnings/convert`. |
| `src/mocks/coins.mock.ts` | Wallet gains an `earned` pot (250/180); balance route returns `earnedCoins`; new ledger seed (4 entries, consistent balance-after chain); **convert** mock mirrors the real service order (whole coins → cash value per coin using the API's default `coin_cash_values` + `creator_minimum_payout_minor` → minimum-payout 422 → insufficient-earned 422 → deduct both pots, prepend a debit ledger entry, return the receipt); new `GET /api/v1/coins/transactions` route. |

### Upload flows — clip vs video (§5.3)

| File | Change |
| --- | --- |
| `src/types/social.type.ts` | `CreateMode` gains `"clip"`; `NewPostInput` gains `kind?: "post" \| "clip"`. |
| `src/navigation/navigation.types.ts` | `CreatePost` param mode union gains `"clip"`. |
| `src/components/create/createModePill.tsx` | Chooser is now **STORY / POST / CLIP / PRODUCT / LIVE** (single chooser; pill copy stays derived from `CreateMode`). |
| `src/components/create/postComposerPanel.tsx` | `PostComposerDraft` gains `kind: "clip" \| "video" \| "photo"`; new `mode` prop (the pill's active state is no longer hard-coded to `post`); new `validationHint` line rendered under the media strip. |
| `src/screens/create/createPost.screen.tsx` | Draft starts with `kind: "photo"`; kind is synced by mode + picked media (clip mode forces `clip`, otherwise any video → `video`, else `photo`); upload purpose is `clip` in clip mode; publish sends `kind: clip → "clip"`, `video`/`photo` → `"post"`; clip validation mirrors the server ("A clip needs exactly one video.") and gates the Next button; header title **Clip**; `["clips"]` invalidated when the post comes back as a clip; step-back/preview logic covers clip mode. |
| `src/mocks/media.mock.ts` | `POST /api/v1/posts` respects `input.kind`, **rejects a clip that isn't exactly one video** with the server's message/code, and — when the created post is a clip — appends it to the mock clips feed via `appendMockClip`. |
| `src/mocks/clips.mock.ts` | `allClips` is mutable; **new `appendMockClip(clip)`** unshifts created clips so the clips feed shows them (built from the returned `Post` + `durationSeconds` + `currentSoundForClip`). |

### Live — creator categories, products optional

| File | Change |
| --- | --- |
| `src/types/social.type.ts` | New `LiveCategory`; `LiveSessionDetails.category?`. |
| `src/services/live.service.ts` | `startLiveSessionWithTitle(title, category)` sends `category`. |
| `src/mocks/live.mock.ts` | `POST /api/v1/lives` stores `category`; only `shopping` lives get products. |
| `src/components/create/liveSetupPanel.tsx` | Horizontal category picker (Just chatting, Gaming, Music, IRL, Education, Shopping) above the source picker; `Shopping` only when `canSell`. |
| `src/screens/create/createPost.screen.tsx` | Owns `liveCategory`; `canSell` from `profile.isSeller`. |

### Review fixes

| File | Change |
| --- | --- |
| `src/components/coins/convertEarnedCoinsSheet.tsx` | Idempotency key resets whenever the typed amount changes; success also invalidates `["coin-activity"]`. |
| `src/services/mediaPreparation.service.ts` | Clip limit 180s (server `maxClipSeconds`) and 512 MB size cap. |
| `src/screens/create/createPost.screen.tsx` | Crossing the clip boundary discards draft media and uploads so the user re-picks under the right purpose; live-lock redirect waits for creator entry to load. |
| `src/screens/wallet/coinActivity.screen.tsx` | Error state with Retry instead of the empty state. |
| `src/mocks/coins.mock.ts` | Minimum-payout 422 message formatted as money. |
| `src/types/social.type.ts` | Top-level `Money` import replaces inline `import()` types. |
| `src/hooks/useCreatorStatus.hook.ts`, `src/screens/settings/settings.screen.tsx`, `src/components/profile/ownProfileShortcuts.tsx` | `useCreatorEntry` exposes `isLoading`; Settings row and profile shortcut do not navigate while it loads. |

### Live — TikTok-style gifts

| File | Change |
| --- | --- |
| `src/components/live/gifts/*` | **New folder** replacing `liveGiftBurst.tsx`, `liveGifting.hook.ts` and `liveGiftPickerSheet.tsx`. Picker with Popular / Premium / Legendary tabs, obvious coin prices, tap-to-send, hold-to-send, ×1/5/10/50/99 per tap, combo ring button (3 s), balance chip + Recharge. Overlay: aggregated side banners (max 2 visible, ×N bump), micro floats near the streamer, medium fly-ins, queued large/global full-screen spotlights with a transparent background, top gifters chip + leaderboard sheet, gift goal bar with a celebration, host gift dashboard and goal editor. |
| `src/components/live/gifts/sendLiveGift.hook.ts` | `useSendLiveGift({ liveId, recipientUserId? })`: batches taps within 300 ms, `Idempotency-Key` per request, optimistic coin balance with rollback, 402 opens recharge, haptics from the gift's `haptic` field, publishes `gift.sent` locally. |
| `src/components/live/gifts/liveGiftEventStream.hook.ts` | Per-live `gift.sent` channel (`subscribeToLiveGiftSentEvents`, `useLiveGiftSentEvents`), deduped by `giftTransactionId`. Uses `realtimeService` against the API, and `services/liveGiftMockEmitter.service.ts` (fake viewers sending random gifts and combos) in mock mode. |
| `src/components/live/gifts/liveGiftArtwork.tsx` + `liveGiftArtworkPresets.constant.ts` + `liveGiftGlyphs.constant.ts` | Vector art resolved by `animationAssetKey`, with no emoji. Bespoke Rose and Zudo Galaxy art; the other 24 gifts use shared glyphs + gradients + particle presets. |
| `src/types/liveGift.type.ts` | **New.** `LiveGift`, `SendLiveGiftInput`, `SentLiveGiftReceipt`, `LiveGiftSentEvent`, leaderboard, goal and stream-stats types matching backendPlan §4.1. `gift.sent` joins `RealtimeServerEvent`. |
| `src/mocks/giftCatalog.mock.ts`, `src/mocks/gifts.mock.ts` | 26 gifts in 4 groups (basic micro/medium, premium, legendary). `POST /live/gifts` (+ old `/lives/:id/gifts` alias), leaderboard, stream stats, gift-goal CRUD, server-side combos, idempotent replay. |
| `src/mocks/index.ts`, `src/mocks/registry.mock.ts`, `src/services/apiClient.service.ts` | Mock handlers now receive `idempotencyKey`. |
| `src/mocks/live.mock.ts` | `live_olumide_cuts` and `live_s2` have no products, so gifting can be tested on a content-only live. |
| `src/screens/live/live.screen.tsx` | Mounts `LiveGiftOverlay` + the new picker; gift chat lines read "sent Rocket ×10 to @creator". |
| `src/screens/live/liveEnded.screen.tsx` | Top Supporter card. |
| `package.json` | `expo-haptics` (via `npx expo install`). |

### Live — multi-guest stage & battles (plans §18)

| File | Change |
| --- | --- |
| `src/types/liveStage.type.ts` | **New.** `LiveStage`, `LiveStageStreamer`, `GuestSlot`, `LiveBattle`, `LiveBattleProposal`, transfers/payouts, inputs. Field names follow backendPlan §4.2. |
| `src/services/liveGuests.service.ts` | **New.** Stage, invitations, join requests, remove/mute/leave, create/accept/decline/cancel/end battle, mock-only battle gift credit. |
| `src/mocks/liveStageSeeds.mock.ts`, `liveStageStore.mock.ts`, `liveBattleEngine.mock.ts`, `liveBattleProposal.mock.ts`, `liveGuests.mock.ts`, `liveBattle.mock.ts` | **New.** Deterministic simulation that advances lazily on every request: invite replies, join requests, host invites the viewer, seeded viewer gifts with lead changes and a last-10-seconds frenzy, mid-battle forfeit, winner-takes-all consent, settlement (keep own / WTA to a single winner / tie keeps own / non-creators paid to the host). Registered in `src/mocks/index.ts`. |
| `src/components/live/guests/*` | **New.** `liveStage.hook.ts` (react-query, 1 s poll, server clock offset), `stageGridLayout.util.ts` (1 / 2 / 3 spotlight / 2×2 / 3×2 / 3×3 / 4×3), `liveStageGrid.tsx`, `liveStageTile.tsx`, `liveGuestsSheet.tsx` (on stage, requests, invite search), `liveStageInvitePrompt.tsx`, `liveStageControlRail.tsx` + `liveStageRailButtons.util.ts`, `liveStageLayer.tsx`. |
| `src/components/live/battle/*` | **New.** Setup sheet (participants, 1/3/5 min, winner-takes-all toggle with explanation), WTA proposal sheet (guest accept/decline, host run-normal/cancel), tug-of-war bar, timer pill with last-10-seconds pulse, 3-2-1 countdown, result banner + confetti + MVP, history card, streamer-targeted gift picker (non-creator note), `sendBattleGift.adapter.ts` over `useSendLiveGift`. |
| `src/screens/live/live.screen.tsx` | Mounts `LiveStageLayer`; hides `LiveVideoStage` when 2+ streamers are on stage; products button and sheets only when the live has products (host: Creator + products or `shopping`). |
| `src/components/live/liveHeader.tsx` | Category chip (not shown for Just chatting). |

### Audit fixes

| File | Change |
| --- | --- |
| `src/components/ui/skeleton.tsx`, `listSkeleton.tsx`, `errorState.tsx` | **New** feedback kit: pulse block on `colors.skeleton`, avatar + two-line rows, message + Retry. |
| ~35 screens/tabs (orders, checkout, cart, escrow, disputes, support, wallet, seller, creator, boost, store, product, home) | Centred `ActivityIndicator` initial loads now `ListSkeleton`; query errors on store, order, product, dispute, escrow, brand, referral, cart, post analytics now `ErrorState` with refetch. Button spinners, pagination footers and sheet loaders unchanged. |
| `src/hooks/useReducedMotionPreference.hook.ts` | **New.** `AccessibilityInfo.isReduceMotionEnabled` plus change listener. |
| `live/gifts/liveGiftSpotlight.tsx`, `liveGiftStaticCard.tsx`, `liveGiftFlyingAnimations.tsx`, `liveGiftComboButton.tsx` | Reduce motion: static gift card + caption instead of spotlight/particles, flyers skipped, no combo bounce. |
| `live/battle/battleConfetti.tsx`, `battleTimerPill.tsx`; `clips/likeBurst.tsx` | Confetti off, no final-seconds pulse, heart fades without spring. |
| `app.json` | `userInterfaceStyle` set to `light` until dark mode ships. |
| `colors.constant.ts`, `placeholderScreen.tsx` | New `textFaint` (`#6E6E80`, AA) replaces hardcoded `#909090` on the placeholder screen. |

### Social graph, profiles & ZudoPoints

| File | Change |
| --- | --- |
| `src/types/socialGraph.type.ts` | **New.** `FollowState`, `FollowRequest`, business categories and profile input, `LiveAdSettings`, `LiveMonetizationInput`, points awards, ranking types. `User.isPrivate/followState`, `Post.isAiGenerated`, `NewPostInput.isAiGenerated`, leaderboard `points`/`viewerPoints`, `ActingProfile.kind` gains `creator`/`business`. |
| `src/services/follows.service.ts`, `brands.service.ts`, `live.service.ts`; `points.service.ts` | Followers/following lists (`?q`, `{ data, nextCursor }`), follow requests accept/reject, business categories and business profile create, live start accepts monetization, rankings and live engagement points. |
| `src/mocks/followGraph.mock.ts`, `socialGraph.mock.ts`, `users.mock.ts` | **New/changed.** Private users, requested state, incoming requests, 403 on private lists, private posts hidden. |
| `src/mocks/businessProfiles.mock.ts`, `brands.mock.ts` | **New/changed.** Category taxonomy, business profiles, creator profile in the profile list. |
| `src/mocks/zudoPoints.mock.ts`, `gifts.mock.ts`, `live.mock.ts`, `media.mock.ts` | **New/changed.** Per-live points board (10 like-points/min cap), rankings, leaderboard ranked by points, live ad terms check, `isAiGenerated` on created posts. |
| `src/screens/settings/settingsPrivacy.screen.tsx`, `screens/profile/followRequests.screen.tsx`, `screens/rankings/rankings.screen.tsx`, `screens/brand/createBusinessProfile.screen.tsx` | **New** screens, registered in `main.navigator.tsx`; Settings gains Privacy and Create business profile rows; own-profile shortcuts gain Follow requests and Rankings. |
| `src/components/profile/*` | **New/changed.** `followState.util.ts`, `followRequestRow.tsx`, `followRequests.hook.ts`, `businessCategoryPicker.tsx`; `profileSwitcher.tsx` lists Personal/Creator/Business; `profileView.tsx` private state; `connections.screen.tsx` searchable lists with skeleton/error states. |
| `src/components/feed/aiGeneratedLabel.tsx`, `create/aiGeneratedToggleRow.tsx` | **New.** Label on `postCard` and `clipDetails`; composer switch. |
| `src/components/live/points/*`, `live/gifts/liveTopGiftersChip.tsx`, `liveGiftLeaderboard*.tsx`, `liveTopSupporterCard.tsx`, `liveTopSupportersList.tsx`, `screens/live/live.screen.tsx`, `liveEnded.screen.tsx` | **New/changed.** Points hook and pill, chip/sheet/list show points, engagement awards on double-tap, share, follow and watch time, ended screen Top Supporters by points. |
| `src/components/create/liveMonetization*.ts(x)`, `liveSetupPanel.tsx`, `screens/create/createPost.screen.tsx` | **New/changed.** Live monetization sheet and payload builder (ads off until terms are accepted). |

### Shipping, addresses & privacy

| File | Change |
| --- | --- |
| `src/types/geo.type.ts`, `shipping.type.ts`, `privacy.type.ts`; `cartOrder.type.ts`, `account.type.ts` | **New/changed.** Geo levels and selection, `ShippingQuote`, `CartSellerGroup`, consents, data export, interaction events. `Cart` gains `groups`, `addressId`, `payableGroupCount`; `Address` stores geo IDs plus postal code and details. |
| `src/mocks/geo.mock.ts`, `geoNigeria.mock.ts`; `services/geo.service.ts` | **New.** Nigeria (36 states + FCT, LGAs for every state, full lists for Lagos/Ogun/Oyo/Ondo/FCT/Rivers), Ghana and Kenya at region level. `GET /geo/countries`, `GET /geo/areas?parentId=`. |
| `src/mocks/shippingEngine.mock.ts`, `commerceFixtures.mock.ts`, `cart.mock.ts`, `orders.mock.ts` | **New/changed.** Per-seller rules (country/state/LGA zones, free destinations, free threshold), amounts as `{amountMinor, currency}`. Cart is grouped by seller; `POST /cart/shipping-quote` quotes shipping (statuses `calculated|needsAddress|notDeliverable`); checkout recomputes server-side style, ignores client prices and only orders sellers that ship to the address. |
| `src/components/settings/geoPickerField.tsx`, `addressGeoFields.tsx`, `geoQueries.hook.ts`; `screens/settings/addressForm.screen.tsx`, `addressRow.tsx` | **New/changed.** Searchable Country, State/Region, LGA, City pickers driven by the country's levels; recipient, phone, street, postal code, details. |
| `src/components/cart/cartSellerGroupCard.tsx`, `shippingStatusLine.tsx`, `cartGrandTotalCard.tsx`, `deliveryAddressPicker.tsx`; `store/deliveryAddress.store.ts`; `cart.screen.tsx`, `checkout.screen.tsx` | **New/changed.** Seller groups with subtotal, discounts, shipping and total; needs-address, not-shipped, FREE and add-X-more states; grand total before payment. `orderSummaryCard.tsx` removed. |
| `src/mocks/privacy.mock.ts`, `services/consents.service.ts`, `config/legalLinks.config.ts`; `components/settings/privacyQueries.hook.ts`, `consentToggleRow.tsx`, `dataExportSection.tsx`, `deleteAccountSheet.tsx`; `screens/settings/settingsPrivacyData.screen.tsx` | **New.** Settings > Privacy & Data: consents (with policy version), data export request/status, account deletion, policy links. |
| `src/services/productInteractions.service.ts`; product detail, store, search, category, `productMasonry.tsx`, `useCart.hook.ts`, checkout | **New/changed.** Batched `trackProductInteraction`; personalization events dropped when personalization is off; analytics off sends no events. |

Verified: `pnpm -C apps/mobile exec tsc --noEmit` clean.

---

### Live badge on stories and profile (§24)

| File | Change |
| --- | --- |
| `src/components/live/liveAvatarRing.tsx` | **New.** Red ring + LIVE pill around an avatar; the pulse respects reduced motion. |
| `src/components/chat/storyTray.tsx` | Live creators sort first, show the ring, and tap → `Live`. New `onPressLive` prop. |
| `src/screens/messages/chats.screen.tsx` | Passes `onPressLive` → `navigation.navigate("Live", { liveId })`. |
| `src/screens/story/story.screen.tsx` | "LIVE · Watch" header pill when the story author is live. |
| `src/components/profile/profileSummary.tsx` | The profile avatar shows the LIVE ring and opens the livestream. |
| `src/types/models.type.ts` | `CreatorLiveStatus`; `UserSummary.live`. |
| `src/mocks/activeLives.mock.ts`, `userDirectory.mock.ts`, `users.mock.ts` | Hosts mapped to active lives; summaries carry `live`; hidden for private non-followed profiles. |

### Tap any image to preview it

| File | Change |
| --- | --- |
| `src/components/ui/previewableImage.tsx` | **New.** `useImagePreview()` + `PreviewableImage` open the existing `MediaLightbox` (full screen, swipe, double-tap zoom) for any image URL list. |
| `src/components/profile/profileSummary.tsx` | Profile photo and cover photo open the preview; when the user is live, tap still opens the live and **long-press** opens the photo. |
| `src/components/store/storeProfileHeader.tsx`, `src/screens/brand/brandProfile.screen.tsx` | Store and brand logo + cover open the preview. |
| `src/components/product/productGallery.tsx` | Tapping a product image opens the full gallery at that image. |
| `src/components/chat/chatBubble.tsx`, `src/components/escrow/disputeMessageBubble.tsx` | Chat photos and dispute attachments open the preview (attachments swipe as a gallery). |

### Chat — privacy, spam, links & streaks (plans §25)

| File | Change |
| --- | --- |
| `src/types/chatSafety.type.ts`, `src/types/messaging.type.ts` | **New / extended.** `InboxFolder`, `ChatSettings`, `LinkPreview`, `SharedContentCard`, `ChatStreak`, `MessageEncryptionEnvelope` (`deviceId`, `ciphertext`, `protocol: "signal-v1-pending"`, no crypto). `Conversation` gains `inboxFolder`, `spamReason`, `streak`, `mutedUntil`; `Message` gains `mediaExpiresAt`, `linkPreview`, `sharedContent`, `readAt`, `encryption`, kind `"shared"`. |
| `src/cache/messageHistory.database.ts`, `src/cache/offlineMutation*.ts` | New message fields persist in `extra_json`; queued sends carry `linkPreview`. |
| `src/services/chatSafety.service.ts`, `linkPreviews.service.ts`, `messages.service.ts` | Settings, mute, content resolve, share-to-chats, streak restore/celebrated; sender-side link preview; inbox folder, accept, delete, block, not-spam. |
| `src/screens/messages/chats.screen.tsx`, `src/components/chatSafety/inboxFolderMenu.tsx`, `inboxRequestActions.tsx` | Chats / Requests / Spam dropdown. Requests: Accept, Delete, Block, receipts hidden until accepted. Spam: reason plus "Not spam". |
| `src/screens/messages/chatSettings.screen.tsx`, `chatNotificationSettings.screen.tsx`, `chatPasscode.screen.tsx` | Request audience, passcode (4-6 digits, biometrics, auto-lock), media-retention notice, blocked accounts (existing list), push toggles incl. message preview. New routes `ChatSettings`, `ChatNotificationSettings`, `ChatPasscode`. |
| `src/utils/chatPasscode.util.ts`, `src/store/chatLock.store.ts`, `src/components/chatSafety/chatLockGate.tsx` | Salted SHA-256 passcode in `expo-secure-store`; `expo-local-authentication` biometrics; lock on background after the auto-lock timer; "Forgot passcode" logs out and wipes the device passcode. |
| `src/components/chat/chatBubble.tsx`, `chatLinks.util.ts`, `src/components/chatSafety/linkPreviewCard.tsx`, `sharedContentCardView.tsx` | "Media expired" tile, external preview card with warning sheet for shortened or suspicious domains (never auto-open), permission-aware internal cards (product price + stock, profile Follow, live LIVE + viewers, "This post is private", "No longer available"). |
| `src/components/chatSafety/sendInChatSheet.tsx`, `shareToChat.hook.tsx` | "Send in chat" from feed posts, post detail, clips, products, lives, stores and profiles. |
| `src/components/chatSafety/streakBadge.tsx`, `streakSheet.tsx`, `streakMilestoneCelebration.tsx`, `chatMuteSheet.tsx`, `src/components/chat/chatHeader.tsx`, `conversationRow.tsx` | Flame + days and hourglass in list and header, restore sheet with remaining restores, milestone celebration (static under reduced motion), per-chat mute 8h / 1 week / always. E2EE notice in conversation info. |
| `src/mocks/chat*.mock.ts`, `chats.mock.ts`, `live.mock.ts`, `index.ts` | Inbox state, spam-by-sender-behaviour, streak engine with per-user timezones, link lookup table, content resolver, share route, expired-media and link seed messages. `buildLiveSession` exported. |
| `package.json`, `app.json` | `expo-local-authentication` (via `npx expo install`) and its config plugin. |

---

## apps/webapp

### Shipping config & web privacy (§23)

| File | Change |
| --- | --- |
| `src/components/privacy/consentBannerHost.tsx`, `src/components/providers/appProviders.tsx` | **New.** Mounts the shared `CookieConsentBanner`; signed-in choices POST to the app's mock consents endpoint. |
| `src/mocks/privacy.mock.ts`, `src/mocks/index.ts` | **New.** `POST /api/v1/consents` (banner) plus `GET/PUT /users/me/consents`, data-export status/request and deletion, mirroring mobile. |
| `src/app/(app)/settings/page.tsx`, `settings/privacy/page.tsx`, `src/components/settings/*`, `src/services/privacy.service.ts`, `src/types/privacy.type.ts`, `src/config/legalLinks.config.ts` | **New.** Settings hub and Privacy & Data: personalization, personalized ads, analytics and marketing toggles, Download my data, Delete account explanation with DELETE confirmation, policy links. |
| `src/components/profile/profileView.tsx` | Settings icon link restored (the Edit profile button stays hidden). |

Auth was rebuilt to mirror `apps/mobile` exactly — no invented forms, copy, icons or behaviour. The desktop layout now carries the `apps/web` landing-page look.

### Assets (copied, not drawn)

- `public/icons/*.svg` — 35 glyphs from `apps/web/public/icons` (same set as `apps/mobile/assets/icons`).
- `public/screens/*.webp` — 14 real app screenshots from `apps/web/public/screens` (786×1704).
- `public/onboardingMarketPhoto.jpg` — the mobile onboarding collage photo.

### New / changed components

| File | Change |
| --- | --- |
| `src/components/ui/appIcon.tsx` + `.module.css` | **New.** Renders the mobile icon set through `mask-image` so colour follows `currentColor`, with `google24` rendered as a full-colour `<img>` (masking would flatten the multicolour logo). |
| `src/components/ui/phoneFrame.tsx` + `.module.css` | **New.** The landing-page phone frame, ported from `apps/web`. |
| `src/components/ui/field.tsx` | Added `hideLabel` to `TextField`/`FieldShell` — labels stay in the accessibility tree (`visuallyHidden`) but don't render, matching the mobile fields that only have placeholders. |

### Auth screens

| File | Change |
| --- | --- |
| `src/app/(auth)/layout.tsx` + `authLayout.module.css` | **Rebuilt.** Removed the invented "Z" mark, "Watch it. Want it. Buy it." headline and invented bullet points. Desktop (≥900px) is now a real split screen: the left half is the landing-page hero — eyebrow *"Social Commerce, made for Nigeria"*, the `Shop the sellers you already watch.` heading with its yellow price tag, the landing lede, the landing proof list (`shield24` / `sealCheck20` / `truck24`), and a three-phone stage built from real screenshots — over the landing gradient. Right half is the wordmark + form. Below 900px the aside collapses and only the form shows. |
| `src/app/(auth)/welcome/page.tsx` + `welcome.module.css` | **New.** Splash (`#f7f8fe`, lowercase `zudomart` wordmark, 1200ms — matching `apps/mobile/app.json`'s splash config) then the mobile `Onboarding` screen: three staggered rows of the market photo, *"Discover real sellers around you"* / *"Shop real sellers, pay safely with escrow."*, `Continue with Apple`, `Continue with Google`, `Email`, `LegalText`, and the `Already have an account? / Log in` switch. The splash is CSS-hidden on desktop viewports. |
| `src/app/(auth)/login/page.tsx` | **Rebuilt.** Dropped the invented `Welcome back` / `Sign in to keep shopping and chatting.` Now exactly `LoginScreen`: back arrow to `/welcome`, fields labelled **`Email`** (placeholder **`Enter your email`**, `autoComplete="username"` so a username still works) and `Password` (placeholder `Enter password`), `Forgot password?`, the `Log in` button (disabled until both fields are non-empty, as mobile does), `SocialSignInButtons` (Apple + Google) and mobile's `Don't have an account? / Sign up` switch copy. Non-API failures use mobile's own fallback: `Couldn't log in. Check your connection and try again.` **No phone number anywhere in login.** |
| `src/app/(auth)/signup/page.tsx` | **Rebuilt, then simplified to email-only.** Replaced the invented `StepDots` wizard with mobile's exact step order and copy: **Contact** (**`What's your email?`**, `Enter your email`, `Save login info…` checkbox, `Send Code` — **the `Phone number`/`Email` tabs, `NG +234` prefix and phone-privacy line are gone**) → **Verify** (`Enter 6-digit code`, 6-box OTP that auto-verifies, `Resend code` + 60s timer, `Didn't get a code? Request a call`) → **Birthday** (`When's your birthday?`, `dd/mm/yyyy`, the ≥13 and real-date errors) → **Password** (`Create password`, live requirements list + strength bar with `Weak`/`Medium`/`Strong`) → **Username** (`Create username`, debounced availability with mobile's exact `@x is available` / `That username is already taken.` messages, `Confirm` + `Skip`) → **Personalization** (`Personalize your feed`, `Add or edit topics you follow. Chose three or more.`, minimum 3 topics, `Continue` / `Skip`, `Customizing your feed…` for 1.5s). Back arrow walks one step at a time and returns to `/welcome`. The invented "Your name (optional)" field is gone — mobile has no name field at signup. Validators are ported verbatim from `apps/mobile/src/utils/validators.util.ts`. |
| `src/app/(auth)/authForm.module.css` | Rewritten for the above: back bar, step heading, checkbox row, 6-box OTP, resend rows, password rules + strength bar, topic chips, `.socialStack`, and the `.divider`/`.dividerText` "or" rule used above the social buttons. Channel tabs and the phone prefix field were removed along with phone registration. Removed the unused `StepDots`/`dividerRow` rules. |

### Routing

| File | Change |
| --- | --- |
| `src/proxy.ts` | `/welcome` added to the public allow-list (and it redirects to `/` when a session already exists). Unauthenticated requests now land on `/welcome` instead of `/login`, so the splash/onboarding is the front door. Static assets (`.webp`, `.jpg`, `.svg`, …) pass straight through — without this the new `public/screens` and `public/onboardingMarketPhoto.jpg` would have been bounced to `/login`. |
| `.env.example` | Added `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_APPLE_CLIENT_ID` (both empty). |

### Auth copy + social sign-in

| File | Change |
| --- | --- |
| `(auth)/welcome/page.tsx` | Default mode **`signup`**. The footer switch only calls `setMode`; the primary button label follows the mode — `Email` → `/signup`, `Use email/username` → `/login`. Social buttons are always rendered, so a first-time visitor can sign in without ever opening the form. |
| `(auth)/login/page.tsx` | Label **`Email`**, placeholder **`Enter your email`** (no "email/username" string), `SocialSignInButtons` (Apple + Google) under the `Log in` button. |
| `(auth)/signup/page.tsx` | Email-only contact step (phone tabs/prefix removed) **and** `SocialSignInButtons` under an `or` divider on the first step, matching the mobile onboarding. |
| `(auth)/forgot-password/page.tsx` | Email-only. |
| `(auth)/authForm.module.css` | `.divider` / `.dividerText` added for the `or` rule above the social buttons. |
| `services/auth.service.ts`, `bff/auth/{login,register,social}/route.ts` | `phone` removed from registration. |

### Impressions + owner-only analytics

| File | Change |
| --- | --- |
| `components/ui/icons.tsx` | **New.** `AnalyticsIcon` — the bar-chart glyph (not an eye). |
| `components/feed/postCard.tsx` | Every post shows the glyph + `impressions`. The owner's counter is a `<Link href={/analytics/post/:id}>`; everyone else's is a plain inert `<span>`. `.actionViews` became `inline-flex` so the glyph and count align. |
| `app/(app)/analytics/post/[postId]/page.tsx` + `page.module.css` | **New.** Owner-only analytics screen (`useSession()` guard): metric grid, 7-day bar chart, engagement rows, post summary. |
| `types/models.type.ts`, `services/posts.service.ts`, `mocks/posts.mock.ts` | `PostAnalytics` / `PostAnalyticsDaily`, `fetchPostAnalytics()`, owner-only mock route (`403 NOT_POST_OWNER`). |

### Routing fix

| File | Change |
| --- | --- |
| `src/proxy.ts` | **Fixed an infinite redirect loop.** A signed-in visit to `/login` (or `/signup`, `/forgot-password`, `/reset-password`) redirected to `/bff/auth/access-refresh?next=/login`, which 303'd straight back to `/login` — and the loop repeated forever. Signed-in users hitting any auth page now go to `/` (same rule `/welcome` already had). |

### Feed UX batch — order, dropdown, dedupe

| File | Change |
| --- | --- |
| `src/components/feed/postCard.tsx` | Footer order fixed: engagement actions → sponsored label → **impressions last** (`.actionViews` keeps `margin-left:auto`, so the analytics glyph + count pin to the right edge). Owner counter still links to `/analytics/post/:id`. |
| `src/app/(app)/page.tsx` | `feedMode` state (`for-you` \| `following`). `TopicFilterRow` gains the **For you ▾ dropdown**: fixed-position menu (`For you ✓` / `Following`) with a click-away backdrop; selecting a topic switches back to For You. `FeedSection` queries `fetchFollowingFeedPage` when `following` (own query key). **Feed dedupe by post id** across pages — same `ad_post_1` duplicate-key fix as mobile. |
| `src/app/(app)/home.module.css` | `.feedModeWrap`, `.modeMenu`, `.modeMenuItem`, `.modeMenuBackdrop` (fixed positioning so `.topicRow`'s `overflow-x` can't clip the menu). |

Verified headless (Chrome CDP, mock login): chip `For you ▾` → menu → `Following ▾` re-queries the feed, and the footer ends with `6.3k impressions` (screenshots `/tmp/shots/webapp-{feed,dropdown,following}.png`).

### Auth wording + creator dashboard batch

| File | Change |
| --- | --- |
| `src/app/(auth)/welcome/page.tsx` | The last "email/username" copy in the system: the login-mode button now reads **"Use email"** (signup mode stays **"Email"** — same label as mobile onboarding). Flow unchanged: default signup mode, footer "Log in" toggles in place, the button then navigates to `/login` for the form; social sign-in stays for direct login. |
| `src/app/(app)/me/page.tsx` | **Fixed a server/client crash** — the page calls `useQuery` but never declared `"use client"`, so any visit to `/me` threw *"Attempted to call useQuery() from the server"*. Directive added. Footer now links to **Creator dashboard** (`/creator`) above Sign out. |
| `src/app/(app)/me/page.module.css` | `.creatorLink` (pill button matching the Sign out control) + footer becomes a column. |
| `src/services/creatorProgram.service.ts` | **New.** `fetchCreatorDashboard(period)` → `GET /api/v1/creators/dashboard` (mock route already existed in `src/mocks/creatorProgram.mock.ts`, previously unused). |
| `src/app/(app)/creator/page.tsx` + `page.module.css` | **New.** Creator dashboard: period chips (This week / This month / All time), earnings summary grid (total / available / pending / followers gained), **Top lives & posts** — every row shows the `AnalyticsIcon` glyph + `Post · 9.8k views`; **post rows link to the owner-only `/analytics/post/:id`**, live rows are plain; owner note at the bottom. No decorative accent bars. |

Social sign-in coverage confirmed headless: `Continue with Apple` + `Continue with Google` render on `/welcome` (both modes), `/login`, and the `/signup` contact step (below the "or" divider) — same order as mobile onboarding.

**Social sign-in wired end-to-end (§6.2) and verified headless (no code change this batch):** fresh browser profile → `/welcome` → `GET /bff/api/v1/users/me` = **401** → tap **Continue with Google** → `POST /bff/auth/social` (mock demo identity token) → signed in → redirected to `/` → `GET /bff/api/v1/users/me` returns the demo user (Temitope Adeyemi). No error notice. Screenshot `/tmp/shots/v2-social.png`.

Verified headless (Chrome CDP): `/welcome` label `Use email` in login mode → `/login` (`Enter your email` + social) → `/signup` (social + divider) → mock login → `/me` (Creator dashboard link) → `/creator` (chips, summary, views rows) → `/analytics/post/post_9` ("Only you can see these numbers.") → `/orders` (7 status filters) → `/orders/o_4108` (escrow step timeline, `pending` badge). Screenshots `/tmp/shots/v2-*.png`.

### Review fixes

| File | Change |
| --- | --- |
| `src/utils/safeRedirectPath.util.ts`, `src/server/requestOriginGuard.service.ts`, `src/app/(auth)/login/page.tsx` | One shared `readSafeRelativeRedirectPath` (rejects `//`, `/\\`, `/bff`) used by the login page and the server. |
| `src/config/webappEnvironment.config.ts` | Production session secret must be exactly 64 hex characters and never the `.env.example` placeholder. |
| `src/server/gateway.service.ts` | 401 retry exchanges the renewed session's rotated refresh token when present. |
| `src/config/sessionCookies.config.ts` | Dev cookie names prefixed `zd_webapp_`. |
| `src/app/bff/auth/social/route.ts` | No `idToken` and mocks off returns the 501 "isn't configured yet" response. |
| `src/proxy.ts` | Duplicate signed-in redirect branches merged. |

---

## apps/studio

### Shipping config & web privacy (§23)

| File | Change |
| --- | --- |
| `src/components/privacy/consentBannerHost.tsx`, `src/components/providers/appProviders.tsx` | **New.** Mounts the shared cookie consent banner. |
| `src/mocks/consents.mock.ts`, `src/mocks/index.ts` | **New.** `POST/GET /api/v1/consents` mock. |

New app: **`studio.zudomart.com`** (local port **3600**, package `@zudomart/studio`). Creator-facing broadcast control room, mock-driven exactly like the mobile app and the webapp (`STUDIO_USE_MOCKS`, on by default).

### Scaffold

| File | Change |
| --- | --- |
| `package.json`, `.env.example`, `next.config.ts`, `tsconfig.json` | New workspace app on port 3600 with `STUDIO_*` env (`RTMP_INGEST_URL`, `HLS_PLAYBACK_URL`). |
| `src/server/*`, `src/types/apiError.type.ts`, `src/services/clientApi.service.ts`, `src/store/auth.store.ts`, `src/config/*` | Copied from `apps/webapp` and renamed (`Webapp`→`Studio`, `WEBAPP_`→`STUDIO_`, `sendRequestToWebappServer`→`sendRequestToStudioServer`, `WebappRequestError`→`StudioRequestError`). `grep -rn "webapp\|Webapp\|WEBAPP" apps/studio/src` is clean. |
| `src/app/bff/{auth/login,auth/logout,auth/access-refresh,auth/social,session,[…path]}/route.ts` | Studio BFF. `auth/register` is not copied — Studio is sign-in only, accounts are made on Zudomart. |
| `src/proxy.ts` | Public: `/` (landing), `/login`, `/overlay*` (OBS has no session). Signed-in visits to `/` and `/login` redirect to `/lives`; everything else needs a session. |
| `src/app/layout.tsx`, `globals.css`, `public/icons/*`, `components/ui/*`, `components/providers/*` | Root layout, design tokens, the 35-icon set and the shared UI kit. |

### Screens

| File | Change |
| --- | --- |
| `src/app/page.tsx` + `page.module.css` | **New.** Public marketing landing: sticky top bar, hero (`Your shop, on air.`) with a mocked stream preview + viewers/impressions/products metrics, 6-card feature grid, 3-step "how it works", CTA band, footer. |
| `src/app/login/layout.tsx` + `authLayout.module.css` | **New.** Split-screen auth in the same format as the webapp: left half is the brand/design panel (eyebrow, headline, lede, numbered proof points, a mocked 16:9 stream preview with LIVE badge, OBS chip, lower third and pinned-product ticker); right half is the wordmark + form. Collapses to form-only below 900px. |
| `src/app/login/page.tsx` + `page.module.css` | Sign-in: `Email` / `Enter your email` / `Password`, `Log in`, `or` divider, `Continue with Apple`, `Continue with Google`, link to the Zudomart app to create an account. `next` defaults to `/lives`. |
| `src/components/shell/studioShell.tsx` + `.module.css` | Sidebar (brand, `Lives` nav, avatar + sign out) with a mobile top-bar variant and `<main id="main-content">`. |
| `src/app/(studio)/lives/page.tsx` + `page.module.css` | **Lives dashboard** — create a live, state badges (`Ready` / `Connecting` / `Live` / `Ended`), peak viewers, product count, links to the control room and overlay editor. |
| `src/app/(studio)/lives/[liveId]/page.tsx` + `page.module.css` | **Control room** — Start / End, rotate stream key, the OBS setup steps, copy fields for Server URL, Stream key, overlay browser source and HLS playback, pinned products + catalogue chips, live chat with a comment form, 5s refetch. |
| `src/app/(studio)/lives/[liveId]/overlay/page.tsx` + `page.module.css` | **Overlay editor** — add Text / Image / Shape / Countdown / Ticker layers, 1920×1080 preview canvas, layer list, inspector (content, font size, colours, x/y/w/h, opacity, z-order, delete), save/discard, and the copyable OBS browser-source URL. |
| `src/app/overlay/[sceneId]/page.tsx` + `page.module.css` | **Public browser source.** Transparent 1920×1080 renderer, no chrome, no session; poll-fetches the scene every 4s. |
| `src/services/lives.service.ts`, `src/mocks/{auth,lives}.mock.ts`, `src/mocks/index.ts` | Mock contract: lives CRUD, start/end, stream key, overlays, comments, products, and the public `GET /api/v1/overlay-scenes/:sceneId`. |
| `src/server/gateway.service.ts` | `publicApiPathPrefixes = ["/api/v1/overlay-scenes/"]` so the browser source can fetch its scene unauthenticated. |

### Landing + auth restructure (mirrors ads/seller)

The public pages now follow the same file layout as `apps/ads` and `apps/seller`: the route file only exports `metadata` and composes section components out of `src/components/landing` / `src/components/auth`.

| File | Change |
| --- | --- |
| `src/app/page.tsx` | Rewritten as a server component exporting `metadata` (absolute title, description, canonical, `robots: index: true`) and composing the landing sections. |
| `src/app/page.module.css` | Split into `src/components/landing/landingPage.module.css` (page shell, eyebrow, section wrappers, primary/secondary actions) plus one module per section. |
| `src/components/landing/landingHeader.tsx`, `landingHero.tsx`, `landingFeatures.tsx`, `landingSteps.tsx`, `landingCallToAction.tsx`, `landingFooter.tsx` | **New.** Same section split as the ads and seller landings: header → hero → features → how-it-works → CTA → footer. |
| `src/app/login/layout.tsx` | Replaced by `src/components/auth/authSplitLayout.tsx` + `.module.css` (brand panel left, form panel right), the format used by `apps/ads` and `apps/seller`. |
| `src/app/login/page.tsx` | Server component exporting `metadata: { title: "Sign in" }`, wrapping `LoginForm` in `<Suspense>`, plus the mock-mode demo hint and the contact line — matching the ads/seller login. |
| `src/components/auth/loginForm.tsx` + `.module.css` | **New.** The sign-in form moved out of the route file: `Email` / `Enter your email`, `Log in`, `or` divider, `Continue with Apple`, `Continue with Google`. |
| `src/constants/contact.constant.ts` | **New.** Same contact helpers as `apps/ads` for the sign-in help line. |

### Decorative accent bars removed

| File | Change |
| --- | --- |
| `src/app/login/authLayout.module.css`, `src/app/page.module.css` | Dropped the `4px` yellow `border-left` rules that ran down the lower third on both the landing preview and the auth brand panel. The `.accent` highlight span on the auth headline is gone too. |
| `apps/admin/…/authCard.module.css` | Same treatment on the admin sign-in: the `border-right` / `border-bottom` `4px solid var(--yellow-500)` accent on the brand panel is removed. Status-coloured borders (toasts, queue severity, plan tiers) are left in place — those carry meaning. |

### Creator (non-selling) live

| File | Change |
| --- | --- |
| `src/components/landing/*.tsx`, `src/app/page.tsx`, `src/app/layout.tsx` | Copy repositioned for all creators (gaming via OBS, talk, music, battles, gifts and earnings); selling is one optional feature. Hero stage shows a gift goal and gifts/subscribers instead of products. |
| `src/types/index.ts` | New `LiveCategory`, `LiveEarnings`, `LiveGifter`, `LiveBattleResult`; `LiveSession.category` and `earnings`; `User.hasStore`. |
| `src/constants/liveCategories.constant.ts` | **New.** Category options and labels. |
| `src/mocks/lives.mock.ts`, `src/mocks/auth.mock.ts` | Seeded gaming, music and shopping lives with gifters and battles; `POST /api/v1/lives` accepts `category`. |
| `src/components/live/liveEarningsPanel.tsx` | **New.** Coins, gifts, subscribers, viewers, top gifters, battle results. |
| `src/app/(studio)/lives/page.tsx` | Category chips on create (`Shopping` only with a store); aggregate earnings panel; rows show category and coins. |
| `src/app/(studio)/lives/[liveId]/page.tsx` | Earnings panel; "Pinned products (optional)" card and its queries only when `viewer.hasStore`. |

### Review fixes

| File | Change |
| --- | --- |
| `src/utils/safeRedirectPath.util.ts`, `src/server/requestOriginGuard.service.ts`, `src/components/auth/loginForm.tsx` | One shared `readSafeRelativeRedirectPath` (rejects `//`, `/\\`, `/bff`) used by the login form and the server. |
| `src/config/studioEnvironment.config.ts` | Production session secret must be exactly 64 hex characters and never the `.env.example` placeholder. |
| `src/types/index.ts`, `src/mocks/lives.mock.ts`, `src/utils/formatMoney.util.ts`, `src/utils/deviceRegion.util.ts`, `src/app/(studio)/lives/[liveId]/page.tsx` | `LiveProduct.priceLabel` replaced by `price: Money` (minor units + currency), formatted with `formatMoneyForDisplay`. |
| `src/server/gateway.service.ts` | 401 retry exchanges the renewed session's rotated refresh token when present. |
| `src/config/sessionCookies.config.ts` | Dev cookie names prefixed `zd_studio_` so they no longer collide with webapp. |
| `src/app/bff/auth/social/route.ts` | No `idToken` and mocks off returns the 501 "isn't configured yet" response. |

---

## apps/seller

### Shipping config & web privacy (§23)

| File | Change |
| --- | --- |
| `src/types/shipping.type.ts`, `src/utils/shippingCalculation.util.ts`, `src/utils/shippingDestinationSelection.util.ts`, `src/constants/nigeriaGeo.constant.ts` | **New.** ShippingProfile / Zone / Rule / Destination shapes (`Money` amounts); most-specific-wins resolution (LGA over state over country; free rule, then free threshold, then flat fee); 36 states + FCT with LGAs for Lagos, Ogun, Oyo, FCT, Rivers, Kano, Kaduna, Enugu, Anambra, Edo and Delta. |
| `src/components/delivery/shipping/*`, `src/app/(workspace)/delivery/shipping`, `src/app/(workspace)/settings/shipping` | **New.** Shipping rules page (Delivery tab and Settings tab): rules DataTable with per-rule active toggle, destination tree (Country, State, LGA with select-all at each level), free-shipping threshold, live preview ("A customer in Ogun ordering ₦30,000 pays ₦2,000 shipping"), per-order-group notice. |
| `src/components/orders/orderShippingSnapshotPanel.tsx`, `orderDetailView.tsx` | Order detail shows the shipping calculation snapshot (destination, rule applied, fee or free). |
| `src/mocks/handlers/shippingHandlers.mock.ts`, `src/mocks/seed/demoShippingProfile.mock.ts`, `src/config/rolePermissions.config.ts` | **New.** `/seller/shipping/*` and `/seller/orders/:id/shipping-snapshot` mocks; gateway permissions (`delivery:manage`). |
| `src/config/planFeatures.config.ts` | `shipping_rules` feature, minimum plan Free (never gated). |
| `src/components/privacy/consentBannerHost.tsx`, `src/app/layout.tsx`, `src/mocks/handlers/consentsHandlers.mock.ts`, `next.config.ts`, `package.json` | **New.** Cookie consent banner, `POST /seller/consents` mock, `@zudomart/web-kit` dependency. |
| `apiContract.md` | New "Shipping configuration" section. |

### Seller operating system (dashboard.zudomart.com) — mock mode

**ZudoMart App = sell from anywhere. ZudoMart Dashboard = run your business.** Free for every approved seller; Pro and Business unlock extra tools. Details and status in [plans.md §19](./plans.md).

| File | Change |
| --- | --- |
| `src/app/(register)/**`, `src/app/(workspace)/sales/**`, `src/components/pos/*`, `src/hooks/usePos*`, `src/services/posDeviceMemory.service.ts`, `src/services/posOfflineSaleQueue.service.ts`, `src/utils/pos*.ts`, `src/utils/receipt*.ts`, `src/types/pos*.type.ts`, `src/server/offlineOperatorPass.service.ts`, `src/app/bff/pos/**`, `src/app/bff/session/operator/**`, `src/app/offline/**`, `settings/receipt`, `settings/payments`, POS mocks and seeds | **Removed.** The in-store register, offline sale queue, shifts, cashier PINs and operator cookie are gone. `public/serviceWorker.js` now unregisters itself and clears its caches. |
| `src/utils/sellerAccessDestination.util.ts`, `src/proxy.ts`, `src/server/bffGateway.service.ts` | Dashboard access needs only a store membership. No Gold verification or paid plan; suspended/revoked stores see a restricted page. The `/access/billing` gate is deleted. |
| `src/config/planFeatures.config.ts`, `src/hooks/usePlanFeatures.hook.ts`, `src/components/billing/planGate.tsx` | **New.** Single source of plan gating: `minimumPlanByFeature`, `planLimitsByPlan` (Free/Pro/Business), `PlanGate`, `PlanLockedNotice`, `FeaturePlanBadge`. Locked features stay visible with an upgrade link. |
| `src/config/rolePermissions.config.ts`, `src/constants/roles.constant.ts` | Roles are Owner, Manager, Inventory staff, Sales staff, Accountant. Permissions widened to 26 (delivery, messages, reviews, analytics, ads, storefront, developer…). `StaffMember.permissions` / `SellerAccess.permissions` carry a custom list (Business). |
| `src/config/navigation.config.ts`, `src/components/layout/*` | New navigation: Overview, Orders, Delivery, Messages, Customers, Reviews, Products, Inventory, Storefront, Analytics, Marketing, Ad results, Affiliates, Payments & finance, Reports, Team, Brand, Settings. Plan badges in the sidebar and switcher (Free/Pro/Business). Below 640px store, plan and location collapse into one switcher (`compactWorkspaceSwitcher.tsx`). |
| `src/components/ui/dataTable.tsx`, `src/hooks/useClientTableState.hook.ts`, `src/components/ui/tablePagination.tsx` | Sortable columns, error/retry state, footer slot, page-numbered pagination; rows become stacked cards below 640px. |
| `src/components/charts/lineChart.tsx`, `horizontalBarList.tsx`, `sparkline.tsx` | **New** dependency-free SVG charts. |
| `src/components/dashboard/*`, `src/components/analytics/*` | Overview (sales, orders by status, balances, views, conversion, customer growth, alerts, activity) and Sales & Analytics (gross/net, AOV, conversion, best/slow sellers, by category/location/time, refunds; breakdowns Pro). |
| `src/components/catalog/*`, `src/components/inventory/*` | Categories page, drafts, scheduled publishing, visibility, attributes, videos, duplicate, supplier; active-product meter; movements, reorder, suppliers, locations pages (advanced inventory Pro; bulk tools Pro). |
| `src/components/orders/*`, `src/components/delivery/*`, `src/components/messages/*` | Ten order statuses, accept/reject/status/notes/refund, invoice + receipt print route, contact customer; delivery pipeline and areas & fees; customer conversations shared with the app. |
| `src/components/customers/*`, `src/components/marketing/*`, `src/components/ads/*`, `src/components/reviews/*` | CRM with segments (Pro), Marketing hub (codes, product discounts free; flash sales, bundles, Mart featuring Pro), Ad results summary (Pro), Reviews with replies, trends and reporting. |
| `src/components/wallet/*`, `src/components/reports/*`, `src/utils/xlsxWorkbook.util.ts`, `src/utils/zipArchive.util.ts` | Escrow, settlements, fees, refunds, statements (CSV + printable PDF); 18 reports in 7 groups with CSV, Excel (dependency-free .xlsx) and PDF (Excel/PDF and non-core reports Pro). |
| `src/components/storefront/*`, `src/components/staff/*`, `src/components/settings/*` | Storefront editor; team with per-member permission toggles (Business) and roles matrix; Account, Security, API keys & webhooks (Pro), Integrations (accounting Business). `StoreSettings.receipt`, `paymentMethods`, `discountApprovalThresholdBasisPoints` removed. |
| Landing, login, README, `src/mocks/seed/demoFinance.mock.ts` | Copy states "Free for every Zudomart seller — upgrade to Pro or Business when you grow". Plans endpoint prices Pro ₦5,000/mo and Business ₦15,000/mo (from the API, never hardcoded); paid plans list the Gold checkmark after business verification. Mobile login hides the brand panel below 768px. `--ink-faint` darkened to `#6e6e80` for AA. |
| `apiContract.md` | Access/plans rules, `402 PLAN_FEATURE_REQUIRED`, new roles, POS sections removed; catalog, orders, delivery, messages, customers, promotions, marketing, ads, reviews, analytics, finance, reports, storefront, security, developers and integrations sections. |

Verified: `pnpm -C apps/seller exec tsc --noEmit` → clean; `pnpm -C apps/seller build` → 97 routes; `next start` smoke test with mocks: 28 section pages return 200 for a Business owner and a Free owner; Free gets 402 on Pro endpoints; Sales staff are redirected away from Payments.

## apps/web

### Shipping config & web privacy (§23)

| File | Change |
| --- | --- |
| `src/app/privacy/page.tsx`, `src/content/privacyPolicy.content.ts` | Rewritten as a full DRAFT: data collected, purposes, legal basis, sharing (Paystack, Flutterwave, hosting, analytics, advertising), transfers, retention (no invented periods), security, rights, contact, updates. |
| `src/app/cookies/page.tsx`, `src/content/cookiePolicy.content.ts`, `src/app/sitemap.ts` | **New.** Cookie Policy: essential, analytics, personalization, advertising. |
| `src/components/legal/legalDocument.tsx` + css | "Draft — pending review by qualified legal counsel" notice, version and effective date placeholders, bullet lists and tables. `/terms` uses the same notice. |
| `src/components/layout/siteFooter.tsx`, `cookieSettingsButton.tsx`, `src/app/layout.tsx`, `next.config.ts`, `package.json` | Footer Cookie policy link and Cookie settings button; banner mounted; `@zudomart/web-kit` dependency. |

### Creator (non-selling) live copy

| File | Change |
| --- | --- |
| `src/components/sections/socialShoppingFeatures.content.ts` | Live tab now covers shows, music, games and shopping; alt text no longer implies a seller. Uses the existing real `liveShoppingScreen` capture. |
| `src/components/sections/creatorProgramSection.tsx` | Gifts card says no store is needed. |
| `src/app/layout.tsx`, `src/components/layout/siteFooter.tsx` | Keywords add live streaming and creator gifts; footer link reads "Posts, clips and live streams". |

---

## apps/admin

### Shipping config & web privacy (§23)

| File | Change |
| --- | --- |
| `src/components/privacy/consentBannerHost.tsx`, `src/app/layout.tsx` | **New.** Mounts the cookie consent banner. |
| `src/mocks/handlers/platform/consents.mock.ts`, `src/config/apiAccess.config.ts` | **New.** `POST /admin/consents` mock; any signed-in admin may call it. |

| File | Change |
| --- | --- |
| `src/components/auth/authCard.module.css` | Removed the decorative `4px solid var(--yellow-500)` accent bars on the sign-in brand panel (`border-right` on desktop, `border-bottom` under 900px), per the "no arbitrary decorative bars" rule. |

---

## apps/ads

### Shipping config & web privacy (§23)

| File | Change |
| --- | --- |
| `src/components/privacy/consentBannerHost.tsx`, `src/app/layout.tsx` | **New.** Mounts the cookie consent banner. |
| `src/mocks/handlers/consents.mock.ts`, `src/mocks/mockHandlerRegistry.mock.ts`, `src/config/rolePermissions.config.ts` | **New.** `POST /ads/consents` mock; signed-in-only path. |

---

## packages/webKit

### Shipping config & web privacy (§23)

| File | Change |
| --- | --- |
| `src/consent/*`, `src/index.ts` | **New.** `CookieConsentBanner` (Accept all, Reject optional, Manage with per-category toggles), `useConsent(category)`, `ConsentGuard`, `openCookieSettings`. Choice stored in the first-party `zudomart_consent` cookie with the policy version; optional scripts must be wrapped in `ConsentGuard`. |

---

## docs

| File | Change |
| --- | --- |
| `docs/plans.md` | The working plan: feed media, feed video audio, chat keyboard/voice/timestamps/typing, creator subscriptions, Creator Studio requirements, webapp auth parity + desktop split, **reshare (§7)**, **Studio subdomain + live broadcasting (§8)** — with the in-app go-live source picker table (§8.4: Camera / Screen / External for gamers), the mock contract renumbered to **§8.5**, phase markers updated to what is now built, **mock mode (§9)**, **post impressions & owner-only analytics (§11)**, **the feed & chat UX batch (§12)**, plus three new sections: **§13 verification checkmarks proposal** (gold = business/store, blue = personal, two independent subscriptions that never conflict), **§14 orders tracking** (history/details/status — already built on both apps), and **§15 auth wording, social sign-in & creator analytics batch**. This batch: **§5.1 gating, §5.2 Studio home, §5.3 clip/video upload paths → [DONE — §16]**; **§5.4 → [BLOCKED]** with the contract finding (`audience` is `everyone`-only; the subscriber tier is the separate `visibility: "public" | "subscribers"` field + `assertApprovedCreator`, and today's mobile `audience: "followers"` sends are invalid against the real API — flagged as debt); **§6.2 social sign-in → [DONE — §15]** (verified end-to-end headless). |
| `docs/CHANGELOG.md` | **New.** This file. |

---

## Design system pass

### packages (new)

| File | Change |
| --- | --- |
| `packages/designTokens/tokens.css`, `native.ts` | `@zudomart/design-tokens`: raw ramps, semantic colour tokens (light active, `[data-theme="dark"]` defined but not wired), type scale `--fs-12..32`, spacing, radius 6/10/14/pill, shadows, motion, control heights 32/36/44 (44 on `pointer: coarse`). Faint text is `#6E6E80`; status colours have AA `-text` variants. |
| `packages/webKit` | `@zudomart/web-kit`: `ZudomartWordmark` (optional product label), `Skeleton`, `EmptyState`, `ErrorState` with retry. Transpiled via `transpilePackages` in webapp, studio, ads, admin. |
| `stylelint.config.mjs`, `package.json` | `pnpm lint:styles`: warns on raw hex and px `font-size` in `*.module.css` outside `packages/designTokens`. |

### apps/webapp

| File | Change |
| --- | --- |
| `src/app/globals.css` | Imports `tokens.css`; legacy names aliased to shared tokens; text scale snapped to the shared scale. |
| `src/app/(app)/explore/page.tsx` | Fixed the broken `./explore.module.css` import (blocker) and an undefined `ScopeValue` type. |
| `src/components/shell/appShell.tsx` | "Z box" replaced by `ZudomartWordmark`. |
| `src/components/feed/postCardSkeleton.tsx`, `src/components/commerce/productCardSkeleton.tsx` | New skeletons, used on feed, explore, home mart, collections and orders instead of spinners. |
| `src/app/(app)/notifications/page.tsx` | New page on the existing notifications service (mark one / all read). |
| `src/components/profile/profileView.tsx`, `src/app/(app)/checkout/page.tsx` | `/settings` links hidden: no settings service exists outside mocks. |
| `src/app/(app)/home.module.css` | Feed column capped at `--reading-width` (680px) and centred. |
| `src/app/(auth)/welcome/page.tsx` | 7 distinct images from the repo instead of one photo repeated 14 times. |
| `src/components/ui/icons.tsx`, `public/icons/*` | 26 glyphs now render the Figma `AppIcon` SVGs; the rest keep hand-drawn paths. |
| `src/app/not-found.tsx`, `error.tsx`, `(app)/loading.tsx`, `(app)/error.tsx` | New route-level states. |
| `*.module.css` | Status text uses `-text` tokens. |

### apps/studio

| File | Change |
| --- | --- |
| `src/app/globals.css`, `components/ui/feedback.*` | Shared tokens; feedback kit re-exported from `@zudomart/web-kit`. |
| `src/components/shell/studioShell.tsx` | Sidebar (single "Lives" entry) replaced by a slim top bar with the wordmark. Wordmark also on landing header and sign-in. |
| `src/components/shell/creatorProgramGate.tsx` | Signed-in users with `isCreator: false` see "Join the Creator Program" (links to webapp `/creator`) instead of `/lives`. |
| `src/app/(studio)/lives/page.tsx` | "Control room" is now secondary (Create live is the one primary); live title input has a visible label. |
| `src/components/live/liveEarningsPanel.module.css` | Won/Lost use `-text` tokens. |
| `src/app/(studio)/loading.tsx`, `error.tsx`, `src/app/error.tsx` | New route-level states. |

### apps/ads

| File | Change |
| --- | --- |
| `src/app/globals.css` | Shared tokens with legacy aliases. |
| `src/components/shell/adsWordmark.*` | Removed; `ZudomartWordmark productLabel="Ads"` used everywhere. |
| `src/**/*.module.css` | Font sizes snapped to `--fs-*`; radii to `--radius-sm/md/lg/pill`; buttons use control heights. |
| `src/components/creative/adPreviewSurfaces.module.css` | All hex colours replaced by tokens. |
| `src/app/loading.tsx`, `error.tsx`, `accounts/[accountId]/loading.tsx`, `error.tsx` | New route-level states. |

### apps/admin

| File | Change |
| --- | --- |
| `src/app/globals.css` | Shared tokens. The blue ramp was shifted one step (`--blue-50` was `#eef1fe`); usages remapped to `--color-brand-tint` / `--blue-50..200`. |
| `src/components/shell/sidebarNavigation.tsx`, `auth/authCard.tsx` | `ZudomartWordmark productLabel="Admin"`. |
| `src/app/(console)/loading.tsx`, `src/app/error.tsx` | New route-level states. |

### apps/web

| File | Change |
| --- | --- |
| `src/app/globals.css` | Imports `tokens.css`; marketing radii stay local (art directed). |
