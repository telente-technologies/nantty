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

---

## apps/webapp

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

Verified headless (Chrome CDP): `/welcome` label `Use email` in login mode → `/login` (`Enter your email` + social) → `/signup` (social + divider) → mock login → `/me` (Creator dashboard link) → `/creator` (chips, summary, views rows) → `/analytics/post/post_9` ("Only you can see these numbers.") → `/orders` (7 status filters) → `/orders/o_4108` (escrow step timeline, `pending` badge). Screenshots `/tmp/shots/v2-*.png`.

---

## apps/studio

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

---

## apps/admin

| File | Change |
| --- | --- |
| `src/components/auth/authCard.module.css` | Removed the decorative `4px solid var(--yellow-500)` accent bars on the sign-in brand panel (`border-right` on desktop, `border-bottom` under 900px), per the "no arbitrary decorative bars" rule. |

---

## docs

| File | Change |
| --- | --- |
| `docs/plans.md` | The working plan: feed media, feed video audio, chat keyboard/voice/timestamps/typing, creator subscriptions, Creator Studio requirements, webapp auth parity + desktop split, **reshare (§7)**, **Studio subdomain + live broadcasting (§8)** — with the in-app go-live source picker table (§8.4: Camera / Screen / External for gamers), the mock contract renumbered to **§8.5**, phase markers updated to what is now built, **mock mode (§9)**, **post impressions & owner-only analytics (§11)**, **the feed & chat UX batch (§12)**, plus three new sections: **§13 verification checkmarks proposal** (gold = business/store, blue = personal, two independent subscriptions that never conflict), **§14 orders tracking** (history/details/status — already built on both apps), and **§15 auth wording, social sign-in & creator analytics batch**. |
| `docs/CHANGELOG.md` | **New.** This file. |
