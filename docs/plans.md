# Zudomart — Working Plans

Living plan for the work in flight. Status markers:

- **[DONE]** — shipped and verified in this repo
- **[NEXT]** — approved, ready to build
- **[LATER]** — agreed direction, not scheduled

Update this file whenever a plan item changes shape. The record of what actually changed, file by file, lives in [CHANGELOG.md](./CHANGELOG.md).

---

## 1. Feed media behaviour (mobile)

### 1.1 Images fit the placeholder, one at a time **[DONE]**

`MediaPager` now measures its own container with `onLayout` and uses that measured width as `pageWidth` for `getItemLayout`, page children and paging snap. Previously `pageWidth = min(windowWidth, 393)` while the container was the full card width, so on any device wider than 393 (iPhone Pro Max 430, tablets, foldables, web) the pages and the `pagingEnabled` snap points disagreed — images bled into each other and did not sit centred in the placeholder.

- `contentFit="contain"` so the whole image is visible and centred, never cropped.
- One image per page; the only way to advance is a sideways swipe.
- The maximum-width cap now applies **only** to the derived video height, so wide screens do not get enormous feed videos while paging still matches the container.

### 1.2 Image review viewer **[DONE]**

Tapping an image in the feed opens `MediaLightbox` (`components/feed/mediaLightbox.tsx`): full-screen, paged through the post's images with the tapped one focused, `n / total` counter, close button, double-tap to zoom (2.5x) with pan while zoomed, single tap to close. Zoom state is lifted so the pager disables horizontal scrolling while zoomed.

### 1.3 Landscape video rotate-to-fill **[DONE]**

`landscapeVideoFullScreenModal.tsx` opens in the current orientation instead of forcing landscape. When the clip is landscape and the viewer is portrait, a rotate button (`ArrowsOutSimple24Icon`) is shown; pressing it locks native orientation to landscape (or, on web, applies the swapped-dimension + `rotate(90deg)` stage). Orientation is restored to portrait on close.

---

## 2. Audio: feed video mute control **[DONE]**

Requirement: **every video in the feed has an audible/played state the user controls, and the choice persists.** A feed video playing with sound must take over audio from whatever else is playing.

- `store/videoAudio.store.ts` — zustand store persisted to AsyncStorage (`zm.videoAudioPreference`), default muted on native, audible on web. Survives app restarts.
- `services/videoAudio.service.ts` — `claimAudioFocusForVideoPlayback()` / `releaseAudioFocusForVideoPlayback()` flip the session `Audio` mode (`playsInSilentMode`, `allowsRecording`) so a loud feed video silences external music apps; releasing restores normal playback behaviour.
- `mediaPager.tsx` — audio button in the pager overlay (icon `SpeakerHigh24Icon`, muted state shown at `opacity: 0.35`, matching the established convention in `clipPlaybackControls.tsx`), plus focus-claim effect gated on the active page being a visible video and the store being unmuted.
- Preference is passed into `MediaPagerPage`, `ClipVideoPlayer` and `LandscapeVideoFullScreenModal`, so the feed, the lightbox and full-screen playback all agree.
- `clips.screen.tsx` now reads the same store (`useVideoAudioStore`) and toggles via `toggleMute`, so the setting is app-wide rather than per-screen; it also claims audio focus while a clip is allowed to play unmuted.

---

## 3. Chat: keyboard and composer **[DONE]**

- New hook `hooks/useKeyboardInset.hook.ts` measures baseline container height against keyboard height (`RESIZE_DETECTION_RATIO 0.6`, survives rotation) and returns `{ inset, handleLayout }`.
- `chat.screen.tsx` dropped `KeyboardAvoidingView` (which fought the screen container and dropped content behind the keyboard on Android) for a plain bottom padding driven by the hook, `Screen edges={["top","bottom"]}`, `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`, and an auto scroll-to-end whenever the inset grows.

Result: tapping the input raises the keyboard and the composer rides on top of it.

### 3.1 Voice note play/pause **[DONE]**

`voiceNoteBubble.tsx` renders `PauseFill24Icon` while `status.playing` and `Play24Icon` otherwise, and reverts automatically because playback sets `playing=false` on finish (`seekTo(0)` on `didJustFinish`).

### 3.2 Message timestamps **[DONE]**

Every message bubble now shows a clock time (`formatClockTime`, `hour: minute`, locale time) in an 11px muted meta row under the bubble, aligned to the bubble's side. A failed message shows `· Not sent` in the same row instead of a standalone line. System notices stay timestamp-free.

### 3.3 Typing indicator (three floating dots) **[DONE]**

New `components/chat/typingDots.tsx` — three 6px dots in a bubble-shaped chip that bounce in a staggered loop (`Animated.loop` + `Animated.sequence`, 160ms stagger, 320ms bounce, native driver), with an accessible "Typing" label.

- `chatHeader.tsx` — when someone is typing, the header second line swaps the plain `typing…` text for the dots on direct conversations; group/channel conversations keep the text (`Ada is typing…` / `2 people are typing…`) and show the dots beside it.
- `chat.screen.tsx` — a `ListFooterComponent` typing bubble floats at the bottom of the message list for direct conversations, so it appears exactly where the next message will land.

Typing signals were already flowing (`realtimeService.sendTypingSignal` → `typingIndicators.store`, with 3s expiry); this is presentation only.

---

## 4. Creator subscriptions

The backend and most of the client already exist. This plan is the gap list, not a from-scratch build.

### 4.1 What already exists **[DONE]**

**API** (`apps/api/src/modules/creatorSubscriptions`, `apps/api/src/modules/creators`):

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /creators/me/subscription-plans` | list incl. inactive, create plan |
| `PATCH /creators/me/subscription-plans/:planId` | rename / describe / benefits / activate |
| `GET /creators/me/subscribers` | people currently subscribed |
| `GET /creators/:creatorId/subscription-plans` | a creator's active plans (public) |
| `POST /creators/:creatorId/subscriptions` | start hosted checkout (idempotency key required) |
| `GET /creator-subscriptions` | my subscriptions |
| `POST /creator-subscriptions/verify` | verify payment with provider |
| `GET /creator-subscriptions/:id` | one subscription's state |
| `POST /creator-subscriptions/:id/cancel` \| `/resume` | stop or restart renewals |

Plan shape: `name` (≤80), `description?`, `price { amountMinor, currency }` (100 … 1_000_000_000), `interval: month | year`, `benefits[]` (≤20, string or `{name, description}`).

**Mobile**:

- Plan configuration lives in `components/creator/subscriptionPlansSection.tsx` — name, price (converted to minor units), interval, benefits (one per line), pause/resume per plan, recent subscriber list. Rendered from `screens/creator/creatorDashboard.screen.tsx`.
- `screens/profile/userProfile.screen.tsx` shows **Subscribe** in the profile identity row when the creator has active plans (§4.2).
- `screens/creator/creatorSubscribe.screen.tsx` — plan picker, `Subscribe for {price}` CTA, hosted checkout via `paymentsService.openHostedCheckoutInAppBrowser`, success state.
- Subscriber-only gating on feed and clips: `components/coins/subscriberOnlyLock.tsx` (`isContentLockedForViewer`), used by `feed/postCard.tsx` and `clips/clipPage.tsx`.

### 4.2 Gap A — Subscribe button prominence **[DONE]**

Today Subscribe was the **fourth** action in `ProfileSummary`'s row (after Follow, Message, View Shop), so on narrow screens it was crowded and easy to miss. Requirement: a button **next to the creator's name**.

Shipped:

- `components/profile/profileSummary.tsx` gained an optional `identityAction` rendered inside the identity row, to the right of the name/username block — a primary (filled) `Subscribe` pill, 34px, outlined when not highlighted.
- `components/profile/profileView.tsx` passes it through as `identityAction`.
- `screens/profile/userProfile.screen.tsx` builds it when the viewer isn't the creator and `GET /creators/:creatorId/subscription-plans` returns ≥1 active plan. The duplicate `Subscribe` entry in the overflow actions row was removed.
- State: `Subscribed` (outlined) when `GET /creator-subscriptions` contains an active row for that creator, and it jumps to the new **Subscriptions** screen (§4.4). Otherwise `Subscribe` (filled) opens `CreatorSubscribe`.
- Webapp mirror is **Phase 2** (creator subscriptions UI is not in the Phase 1 webapp scope).

### 4.3 Gap B — verify the checkout result **[DONE]**

`creatorSubscribe.screen.tsx` opened the hosted checkout and then polled the **wrong** endpoint (`GET /api/v1/subscriptions/:id`, the seller-subscriptions module), and never called `POST /creator-subscriptions/verify`, so a paid subscription stayed `pending` forever.

Shipped, mirroring the existing coins pattern (`coinWallet.hook.ts`):

- `services/creatorProgram.service.ts`: `verifySubscriptionCheckout(reference)` → `POST /api/v1/creator-subscriptions/verify`; `fetchSubscriptionState` now points at `GET /api/v1/creator-subscriptions/:id`; added `listMySubscriptions`, `cancelSubscription`, `resumeSubscription`.
- `screens/creator/creatorSubscribe.screen.tsx`: captures `reference` + `subscription` from the checkout response, re-arms the idempotency key, opens the browser (`.catch(() => "dismissed")`), then calls `verifySubscriptionCheckoutUntilSettled` — up to 6 attempts, 1.5s·attempt backoff, stopping as soon as `status !== "pending"`. A thrown verify falls back to the seeded `pending` state, which the footer already renders as *"Payment not completed yet. Try again when ready."*
- On `active`: invalidates both `plansOfCreator(creatorId)` and `mySubscriptions`, and the success screen shows as before.

### 4.4 Gap C — subscriber management **[DONE (mobile)]**

A subscriber had no surface to cancel or resume.

Shipped:

- New `screens/creator/mySubscriptions.screen.tsx` — creator avatar/name (from `useUserProfileQuery`), price/interval, `Renews {date}` / `Ended {date}`, a `StatusPill` for all six statuses (`pending|active|past_due|cancelled|expired|failed`), and row actions **Cancel subscription** (`outline`) while `active|past_due` or **Resume subscription** while `cancelled`.
- Cancel asks for confirmation via `showAlertWithButtons`: *"Stop renewing this subscription?"* / *"Your access continues until {date}."* / `Not now` · `Cancel subscription`.
- Registered as `MySubscriptions` in `navigation.types.ts` + `main.navigator.tsx`.
- Entry points: **Settings → Payment Methods → Subscriptions**, and the profile `Subscribed` button (§4.2). This makes the success screen's *"Manage or cancel anytime in Settings."* true.
- Webapp screen under `(app)/settings/subscriptions` is **Phase 2**.

### 4.5 Gap D — price configuration discoverability **[LATER]**

Plan creation is currently buried inside Creator Dashboard. Requirement was "a spot where creators can configure how much they want to charge monthly". Keep it in Creator Studio (§5) but surface a shortcut: Creator profile (own) → "Subscription plans" row → jumps straight to the plans section rather than scrolling the dashboard.

### 4.6 End-to-end subscribe flow **[DONE]**

The happy path, as built:

**Creator side (configure a monthly price)**

1. Creator is accepted into the Creator Program (§5.1).
2. Open **Creator dashboard** → **Subscription plans** section.
3. **Create a plan** → name, price (major units, converted to `amountMinor` with the active currency), interval (`month` / `year`), benefits (one per line).
4. `POST /creators/me/subscription-plans` → plan appears in the list with `Active` pill, price/interval and subscriber count.
5. Creator can **Pause new sign-ups** / **Resume plan** any time (`PATCH /creators/me/subscription-plans/:planId { active }`).

**Subscriber side (subscribe to a creator)**

1. Open the creator's profile. Because they have ≥1 active plan, the **Subscribe** button renders next to their name (§4.2).
2. Tap it → `CreatorSubscribe` screen with `creatorId`.
3. Screen loads `GET /creators/:creatorId/subscription-plans` and lists the plans; the first is preselected. The CTA reads **Subscribe for ₦x**.
4. Tap → `POST /creators/:creatorId/subscriptions { planId }` with an `Idempotency-Key` → returns a hosted-checkout URL.
5. `paymentsService.openHostedCheckoutInAppBrowser(checkout.checkoutUrl)` → user pays with the saved card / provider.
6. On return: `POST /creator-subscriptions/verify { reference }` retried until `status !== "pending"` **(Gap B, shipped)**, then the returned `CreatorSubscriptionStateDto` drives the success screen.
7. Status `active` → success screen: *"You're subscribed to {creator}!"* with **Back to profile**.
8. From then on, that creator's `subscriberOnly` posts and clips unlock — `isContentLockedForViewer({ subscriberOnly, viewerHasAccess })` stops showing `SubscriberOnlyLock` and the blurred preview.

**Managing it later**

- Cancel: `POST /creator-subscriptions/:id/cancel` — access continues until `currentPeriodEnd`.
- Resume: `POST /creator-subscriptions/:id/resume`.
- UI for both shipped in **MySubscriptions** (§4.4): Settings → Payment Methods → Subscriptions.

---

## 5. Creator Studio

Requirement: a dedicated studio for users **accepted into the creator program**, covering coins, wallet/earnings, video uploads, and separate flows for clips (shorts/reels) vs normal videos, with audience selection and thumbnails (manual choice or Python-job-generated fallback).

### 5.1 Gating **[DONE] / [NEXT]**

- Exists: `screens/creator/creatorProgram.screen.tsx` (apply), `creatorApplicationStatus.screen.tsx` (review states), `creatorProgramService.fetchMyCreatorEligibility / fetchMyCreatorApplication / submitCreatorApplication`, and `CreatorDashboardScreen` already degrades to "See the Creator Program" when the dashboard call fails.
- **[NEXT]** Make the gate explicit at the entry point: Creator Studio is reachable only when eligibility is `eligible` or the application status is `approved`; pending → `CreatorApplicationStatus`; rejected → status screen with the reason. Do not surface Studio in navigation for ineligible accounts.

### 5.2 Studio surface **[DONE] / [NEXT]**

Current `CreatorDashboardScreen` already provides: period chips (week/month/all-time), earnings card, "Withdraw earnings" → Wallet, top lives & posts with views + earnings, affiliations, subscription plans, revenue rules.

**[NEXT]** restructure into a Studio home with the four required blocks, in this order:

1. **Coins** — balance, send/convert (`convertEarnedCoins`), link to coin activity.
2. **Wallet / earnings** — `CreatorEarningsCard` + withdraw → `screens/wallet/{wallet,transactions,withdraw,payoutAccounts}.screen.tsx`.
3. **Content** — entry to the upload flows (§5.3).
4. **Subscription plans** — existing `SubscriptionPlansSection` (§4.1).

### 5.3 Upload flows: clips vs normal videos **[NEXT]**

Requirement: two clearly separate upload paths — **clips** (short-form, vertical, feed of shorts) and **normal videos** (long-form, landscape/portrait, watch page).

- Shared: media pick (`components/create/pickMedia.util.ts`), draft upload tracking (`postDraftUploads.hook.ts`), title/caption, **audience**, thumbnail, publish.
- **Clips**: vertical-first editor, default duration cap, sound picker reuse from `soundPickerSheet.tsx`, lands in the clips feed.
- **Normal videos**: full-screen preview with the new rotate affordance (§1.3), no duration cap, lands on the posts feed / watch.
- `CreateModePill` / `createModeSheet` becomes the single chooser: **Clip** | **Video** | Photo | Live.
- Today `createPost.screen.tsx` only publishes `storiesService.publishPost({ text, audience, mediaIds })` with `audience: everyone | followers` — video-specific fields are not sent yet. **[NEXT]** extend the composer draft with `kind: "clip" | "video" | "photo"` and thread it through the publish call.

### 5.4 Audience selection **[NEXT]**

Existing `PostAudience` is `everyone | followers` (`postToolbar.tsx` toggle: "Everyone"/"Followers"). Requirement adds a subscriber tier:

- Extend to `everyone | followers | subscribers`.
- `subscribers` is only offered when the author has ≥1 active plan **and** the viewer set is resolved server-side (already modelled by `subscriberOnly` / `viewerHasAccess` on posts and clips).
- Toolbar chip cycles through the three values with the same 25px pill; keep `Everyone`/`Followers` copy exactly as-is and add `Subscribers`.
- Server contract: confirm `storiesService.publishPost` accepts `audience: "subscribers"` before exposing the option — **do not ship the chip until that is verified** (no inventing API fields).

### 5.5 Thumbnails **[LATER]**

- Manual: creator picks a frame from the uploaded video (scrubber) or uploads an image.
- Automatic: Python job generates a frame-selection thumbnail when none is chosen; stored as `thumbnailUrl` (already consumed by `CreatorDashboardScreen` top-content rows, `suggestedClipsRow.tsx`, `postProductsSheet.tsx`).
- Requires an API endpoint + worker; not built yet. Until then, default to `media[0].posterUrl` and fall back to `null`.

---

## 6. Webapp auth parity

Requirement: from splash → register → login, the web must behave and look like the mobile app. No invented forms, copy, icons, logos or behaviours.

### 6.1 Reference (mobile) **[DONE]**

| Screen | Exact copy to mirror |
| --- | --- |
| Splash (1200ms, `#F7F8FE`, `./assets/splashLogo.png`, width 200, contain) | logo only |
| `Onboarding` | `Continue with Google`, `Continue with Apple`, `Use username` |
| `LoginScreen` | action `Log in`; fields `Email or username` / `Enter your email`, `Password` / `Enter password`; `Forgot password?` |
| `SignUpContact` | tabs `Phone` / `Email`, CTA `Send Code` |
| `VerifyOtp` | code entry |
| `SignUpBirthday` | `dd/mm/yyyy` |
| `SignUpPassword` | password + requirements list |
| `SignUpUsername` | availability check, skippable |
| `Personalization` | topic chips, finish |

### 6.2 Rebuild **[DONE]**

- `app/(auth)/layout.tsx` — invented "Z" mark and invented headline dropped. **[DONE]**
- `app/(auth)/login/page.tsx` — exact labels/placeholders/CTA from `LoginScreen`. **[DONE]**
- `app/(auth)/signup/page.tsx` — replaced the invented `StepDots` wizard with the mobile step order: Contact (Phone/Email tabs) → OTP → Birthday → Password → Username → Personalization. **[DONE]**
- New `app/(auth)/welcome/page.tsx` — `Onboarding` + splash on mobile viewports (splash first, then onboarding). **[DONE]**
- Icons: source every glyph from `apps/mobile/assets/icons/*.svg` (same set already mirrored at `apps/web/public/icons/`) instead of the hand-drawn set in `components/ui/icons.tsx`, rendered by one `AppIcon` through `mask-image` so colour follows `currentColor`. **[DONE]**
- Social buttons: **[DONE]** both render on the onboarding screen in mobile's exact order and copy (`Continue with Apple`, `Continue with Google`). **[NEXT] Wire them to the mock backend** — the webapp is a demo/mock product exactly like mobile, so a tap must actually sign the user in (mobile's `authService.signInWithSocialProvider` → `POST /api/v1/auth/google|apple` returns a session in mock mode; the webapp must do the same through `POST /bff/auth/social`).
  - When mocks are on → tap signs in and lands on the feed. **No dead buttons.**
  - When mocks are off and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_APPLE_CLIENT_ID` are absent → show mobile's own `…sign-in isn't configured yet.` message (the `SocialSignInNotConfiguredError` text).
  - When mocks are off and client ids exist → PKCE popup flow against `POST /api/v1/auth/google|apple`. **[LATER]** (needs real client ids).
- `src/proxy.ts`: `/welcome` is on the public allow-list, and static assets pass through so `public/screens` and `public/onboardingMarketPhoto.jpg` resolve. **[DONE]** Legal links (`Terms of Service`, `Privacy Policy`, `Learn more`) intentionally point at `NEXT_PUBLIC_MARKETING_SITE_URL`, i.e. the `apps/web` landing site — the webapp has no local `/terms` or `/privacy` and needs none while those are the only links.

### 6.3 Desktop split-screen **[DONE]**
- Left panel = landing page vibes from `apps/web`: palette from `apps/web/src/app/globals.css`, proof points/wording from the landing page, and real phone screenshots from `apps/web/public/screens/*.webp` (786×1704: `homeFeedScreen`, `creatorProfileScreen`, `productDetailScreen`, `homeMartScreen`, `martProductsScreen`, `chatWithSellerScreen`, `shoppingCartScreen`).
- Right panel = the auth form (mobile copy).
- Collapse to a single column under the existing breakpoint; on mobile viewports show splash → onboarding only.
- No new artwork, no new logo, no invented illustration.

### 6.4 Auth copy + account model changes **[DONE]**

| # | Change | Mobile | Webapp |
| --- | --- | --- | --- |
| 1 | Third auth button relabelled | `onboarding.screen.tsx` `Use username` → **`Email`** | `welcome/page.tsx` → **`Email`** (signup mode) |
| 2 | **Registration is email-only** — the Phone/Email tab pair is gone; no phone signup anywhere | `signUpContact.screen.tsx` email-only (`What’s your email?`), `ContactChannelTabs` deleted, `signup.store.ts` `channel` removed | `signup/page.tsx` tabs + phone field + phone-privacy note removed; `ContactChannel` type, `phoneNumber` state and NG phone validators removed |
| 3 | **No phone in any auth screen** — login, register *and* password reset | `forgotPassword.screen.tsx` → `Email` / `Enter your email`, email validation only | `forgot-password/page.tsx` → `Email`; BFF `login` message `"Enter your email or username and your password."`; BFF `register` rejects missing `email` |
| 4 | **Login still accepts a username** — the identifier field keeps `autoComplete="username"` and still posts `identifier`, so a username keeps working. Only the *wording* drops "email/username". | `login.screen.tsx` label `Email or username` → **`Email`**, placeholder stays `Enter your email` | `login/page.tsx` same change |
| 5 | **`/login` offers social sign-in** — Apple + Google, same copy/icons as Onboarding | n/a (mobile keeps social on Onboarding only) | `login/page.tsx` renders `SocialSignInButtons` under `Log in`; shared component `app/(auth)/socialSignIn.tsx` used by both `/welcome` and `/login`; `services/socialSignIn.service.ts` posts `/auth/social` |
| 6 | **`/welcome` mode switch stays on the page** — default mode is `signup`; tapping `Log in` / `Sign up` in the footer only toggles the mode, it does **not** navigate. The primary button relabels: `signup` → **`Email`** (→ `/signup`), `login` → **`Use email/username`** (→ `/login`). Social buttons stay available for both modes. | n/a | `welcome/page.tsx` footer `<Link>` → `<button>` that only `setMode`; button label driven by `mode` |
| 7 | Visual parity: no invented wordmark on mobile viewport; no horizontal overflow | n/a | `authLayout.module.css`: `.wordmark` hidden below 900px; `grid-template-columns: minmax(0, 1fr)` + `min-width: 0` on `.page/.main/.panel` (measured: document 473px vs 390px viewport) |

### 6.5 Phase 2 (unchanged) **[LATER]**

Clips, create/story/live, wallet, seller, creator, boost, disputes — plus the subscription screens of §4. **[LATER]** none of creator subscriptions in the webapp until phase 2.

---

## 7. Reshare (mobile feed)

Requirement: tapping **Repost** must offer a choice — *just reshare* or *quote* — and a reshare must render in the feed as **its own post that visibly wraps the original**, not as a counter bump on the source post.

### 7.1 What exists **[DONE]**

- `usePostInteractions.hook.ts:39` `repostPost()` increments `post.reposts` optimistically and calls `POST /api/v1/posts/:postId/repost`.
- `postCard.tsx:135` `Counter label="Repost"` wired to `onRepost`; `feedTab.tsx:72` passes `repostPost(item.post)`.
- Mock: `mocks/posts.mock.ts:29` — `reposts: p.reposts + 1`.

### 7.2 Gaps **[DONE]**

| Gap | Today | Needed |
| --- | --- | --- |
| No choice offered | Tap → instant counter bump | Tap → `ReshareSheet` with **Reshare** / **Quote** |
| Nothing new appears in the feed | Only `reposts` count changes | A new post is inserted that embeds the original |
| No type carries it | `Post` (`models.type.ts:109–128`) has no reshare field | `resharedFrom?: Post \| null`. The quote comment lives in the existing `text` field (plain reshare = empty `text`), so no duplicate `quoteText` field and no contract ambiguity |
| `kind` stays `"post"` | — | Do **not** invent enum values the server does not accept; a reshare is `kind: "post"` with `resharedFrom` set |

### 7.3 Build order **[DONE]**

1. **Types** — `resharedFrom?: Post | null` on `Post`. **[DONE]**
2. **`components/feed/reshareSheet.tsx`** — `BottomSheet` (`floating`), rows styled exactly like `contentOptionsSheet.tsx` `OptionRow` (52px min height, 16px padding, 14px gap, 24px icon slot): **Reshare** (`Refresh24Icon`) and **Quote** (`ChatCircle24Icon`). **[DONE]**
3. **Quote composer** — a second `BottomSheet` titled `Quote` with a multiline `TextField` (`boxStyle` height 96) + `Repost` button; ships `text` with the repost. **[DONE]**
4. **Service** — `postsService.repostPost(postId, text?)` returns the created `Post`. Plain reshare posts `{}`, quote posts `{ text }`. **The mock route defines the contract until the real backend lands** — `text` is contract-pending (§10). **[DONE]**
5. **Mock route** (`posts.mock.ts`) — bumps the original's `reposts`, builds a new `Post` authored by `getSignedInMockUser()` with `resharedFrom: withCurrentProductPrices(original)`, stores it in `mockPostsState` and returns it. **[DONE]**
6. **Rendering** — `ResharedPostBlock` (`components/feed/resharedPostBlock.tsx`): bordered inner surface (1px `colors.divider`, 8px radius, 12px padding) with the original author avatar + name + verification + timestamp, original text, original media via `MediaPager isVisibleOnScreen={false}` (a reshare must not start audio), and the original like/comment/repost counts. Rendered by `PostCard` under the resharer's quote text. **[DONE]**
7. **Feed insertion** — `usePostInteractions.resharePost(post, text?)` calls the service, bumps the original's cached `reposts`, then prepends the created post to page 0 of every cached feed (deduped by id). **[DONE]**
8. **Mock seeds** — `postCatalog.mock.ts` seeds `reshare_seed_1` (plain) and `reshare_seed_2` (quoted) so the rendering is visible on first load. **[DONE]**
9. **Wire-up** — `feedTab.tsx` and `postDetail.screen.tsx` open `ReshareSheet` instead of calling `repostPost` directly. **[DONE]**

---

## 8. Studio subdomain + live broadcasting

Requirement: a dedicated **`studio.zudomart.com`** web app where creators **go live**, connect an external encoder like **OBS**, and compose **overlays (text, logos, anything)** on top of the livestream — plus **in-app go-live** on mobile for everyone including gamers, who can stream **their phone screen** or connect an **external source**. Studio is mock-driven exactly like the mobile app and the webapp.

### 8.1 What already exists **[DONE]**

- **Live session metadata in the API** — `apps/api/src/modules/posts/`: `controllers/live.controller.ts`, `registerLiveRoutes()` (`routes/posts.routes.ts:72–90`), commands `startLiveSession` / `endLiveSession` / `joinLiveSession` / `leaveLiveSession` / `commentOnLiveSession` / `reactToLiveSession` / `shareLiveSession` / `addLiveProduct`, queries `getLiveSession` / `listLiveSessions` / `listLiveComments`, model `posts.model.ts:75–98`, DTOs `posts.dto.ts:90–111`, `repositories/live.repository.ts` + `live.prisma.repository.ts`. Endpoints: `/api/v1/lives/*`.
- **Gifting** lives in the `creators` module.
- **Mobile live surfaces** — `src/screens/live/*`, `components/create/liveSetupPanel.tsx`, `Live` / `LiveEnded` nav params, `liveShoppingScreen.webp` asset.
- **Nothing else exists yet:** no RTMP / WebRTC / HLS / ingest infrastructure anywhere in the repo (only `apps/api/compose.yaml`), **no overlay/graphics feature anywhere**, no `studio` app, no live surface in the webapp.

### 8.2 Architecture **[DONE (frontend) / LATER (ingest)]**

```
                          ┌───────────────────────────────┐
  OBS / encoder ──RTMP──► │  ingest (MediaMTX or SRS)     │──HLS──► viewers (webapp + app)
  phone screen-cast ─────► │  rtmp://studio.zudomart.com/  │
  Studio browser source ─► │          live/<streamKey>     │
                          └───────────────────────────────┘
                                     ▲            │
                     session + stream key   overlay scene JSON
                                     │            ▼
                          ┌────────────────────────────────┐
                          │  apps/api  /api/v1/lives/*     │  (metadata already exists)
                          └────────────────────────────────┘
```

1. **Studio app** — `apps/studio`, package `@zudomart/studio`, **port 3600**, host `studio.zudomart.com`. Server layer copied from `apps/webapp` (BFF pattern: `server/*service.ts`, `app/bff/{auth/[…path]}`, `proxy.ts`, httpOnly `zd_*` cookies, CSRF HMAC), **mock backend ON by default** (`STUDIO_USE_MOCKS`). Public routes: `/` (landing), `/login`, `/overlay*` (browser source). Everything else requires a session and lives under `(studio)` → shell → `/lives`. **[DONE]**
2. **Ingest** — RTMP endpoint per session with a per-session **stream key** issued by `POST /api/v1/lives/:id/stream-key`. Creator pastes Server URL + Stream Key into OBS (or any encoder, or a phone screen-recorder's RTMP output).
3. **Playback** — LL-HLS from the ingest host; viewers play `<hlsUrl>` on the session.
4. **Overlays** — scenes stored per session; a transparent **browser-source page** (`studio.zudomart.com/overlay/:sceneId`, 1920×1080, no chrome) renders the current scene. The creator adds it in OBS as a **Browser Source** and the graphics land on the outgoing stream. For in-app viewers who are not on OBS, the same scene JSON is fetched with the session and composited client-side over the player.
   - Overlay layer types: **text**, **image (logo)**, **shape/badge**, **countdown**, **ticker**. Each layer: `x`, `y`, `w`, `h`, `zIndex`, `opacity`, colour, font size, and per-type payload.
5. **Mobile go-live source picker** — extend `liveSetupPanel.tsx` with three sources: **Camera** (exists today) | **Screen** (phone screen capture) | **External** (shows the same RTMP server URL + stream key to paste into an encoder or screen-cast app).
6. **Webapp** — viewer-facing live surface + a "Go live" hand-off to Studio (Phase 2, §6.4).

### 8.3 Phases

| # | Scope | Marker |
| --- | --- | --- |
| 8.3.1 | **Studio app skeleton** — `apps/studio` scaffolded from `apps/webapp`'s server layer (BFF pattern: `server/*service.ts`, `app/bff/{auth/[…path]}`, `proxy.ts`, `zd_*` cookies, CSRF HMAC), port **3600**, package `@zudomart/studio`, `STUDIO_*` env, mock backend on by default, `/login`. | **[DONE]** |
| 8.3.2 | **Studio landing page + split auth** — public `/` marketing landing (hero, feature grid, how-it-works, CTA), `/login` rendered as a **split screen**: brand/design half + form half (same format as the webapp auth layout). Signed-in visits to `/` and `/login` redirect to `/lives`. | **[DONE]** |
| 8.3.3 | **Studio shell + navigation** — `studioShell` (sidebar + mobile top bar, sign out), `(studio)` route group, `Lives` dashboard at **`/lives`** (create live, state badges, control-room/overlay-editor links). | **[DONE]** |
| 8.3.4 | **Live control room** — `/lives/:id`; **Start / End**; **stream key card** with copy affordances (`rtmp://studio.zudomart.com/live` + key + overlay browser-source URL + HLS) and explicit **OBS setup steps**; connection state (`idle` / `connecting` / `live` / `ended`); viewer count, chat, product pinning. | **[DONE]** |
| 8.3.5 | **Overlay editor + browser-source page** — `/lives/:id/overlay`: toolbar (text / image / shape / countdown / ticker), 1920×1080 preview canvas, layer list, inspector (content, font size, colours, x/y/w/h, opacity, z-order, delete), save/discard. Public **`/overlay/:sceneId`** renders the scene with no chrome and no session (proxied as public, fetched through `GET /api/v1/overlay-scenes/:sceneId`). | **[DONE]** |
| 8.3.6 | **Mobile source picker** — Camera / Screen / External segmented picker in `liveSetupPanel.tsx`. Camera = existing backdrop; Screen = capture-stage placeholder; External = creates the session, issues the key via `POST /api/v1/lives/:id/stream-key`, then shows the **server URL + stream key card with a Share sheet** and an "Open live room" action. | **[DONE]** |
| 8.3.7 | **Screen capture** — iOS ReplayKit broadcast extension + Android MediaProjection. Requires a **dev client** (not Expo Go) and a capability check; falls back to External when unavailable. | **[LATER]** |
| 8.3.8 | **Media ingest + playback infra** — deploy MediaMTX/SRS, issue/validate stream keys, publish `hlsUrl`, scale/record. **Backend work; not started.** | **[LATER]** |
| 8.3.9 | **Webapp live viewer + Go-live entry** — Phase 2 (§6.4). | **[LATER]** |
| 8.3.10 | **Audience / analytics for lives** — retention curve, top moments, earnings per session (extends §5.2). | **[LATER]** |

### 8.4 In-app go-live (gamers included)

Requirement: *"on both there and inside the app, they can go live, gamers too — stream the screen of their mobile phone, or connect to external stuff."*

| Source | Who it is for | How it works | Marker |
| --- | --- | --- | --- |
| **Camera** | Sellers, reviewers, Q&A | Existing mobile flow (front/back camera) | **[DONE]** |
| **Screen** | Gamers, app demos | OS screen capture → RTMP (`ingestUrl` + `streamKey` from the session). iOS ReplayKit / Android MediaProjection (§8.3.7). | **[LATER]** |
| **External** | OBS, vMix, screen-cast apps, capture cards | Studio shows the same **Server URL + Stream Key** card; any encoder pushes to `rtmp://studio.zudomart.com/live/<key>` | **[DONE]** |

Mock rule (§9): all three sources must be **selectable and complete end-to-end in mock mode** — picking Screen/External issues a mock stream key and flips the session to `connecting`, exactly like the API would.

### 8.5 Mock contract (Studio)

Frontend is mock-first, so the Studio mock server **defines** the contract until the backend is built. Routes to implement in `apps/studio/src/mocks/`:

- `GET /api/v1/lives` — sessions for the signed-in creator (state, startedAt, viewers, hlsUrl).
- `POST /api/v1/lives` — start a session (`title`, `products`).
- `POST /api/v1/lives/:id/start` / `:id/end`.
- `POST /api/v1/lives/:id/stream-key` — issue/rotate the key.
- `GET /api/v1/lives/:id/overlays` / `PUT /api/v1/lives/:id/overlays` — scene JSON.
- `GET /api/v1/lives/:id/comments`, `POST /api/v1/lives/:id/comments`.
- `GET /api/v1/lives/:id/products` / `POST /api/v1/lives/:id/products`.

Every response shape gets written down in `docs/apiContract.md` so the backend can be built against it later.

---

## 9. Mock mode is the product

Requirement: *"just like the mobile app is a demo mock, so the webapp should be too, and also Studio too."*

| App | Switch | Default | Location |
| --- | --- | --- | --- |
| mobile | `EXPO_PUBLIC_USE_MOCKS` | **on** | `src/config/api.config.ts` |
| webapp | `WEBAPP_USE_MOCKS` | **on** unless explicitly set off | `src/server/apiTransport.service.ts:79` |
| studio | `STUDIO_USE_MOCKS` | **on** | `apps/studio/src/server/*` (same pattern) |

Rules:

- Every screen must be **usable end-to-end in mock mode** — no button that dead-ends with "isn't configured yet" while mocks are on.
- Mock routes live next to the feature (`mocks/handlers/*.ts`) and are seeded on first load.
- Real-API behaviour is opt-in only; documented in each app's `.env.example`.
- Social sign-in, go-live, stream keys and overlays all **must work in mock mode** (§6.2, §8.3, §8.4).

---

## 10. Deferred / open questions

- Verify the server accepts `audience: "subscribers"` (§5.4).
- Python thumbnail worker (§5.5).
- `components/ui/icons.tsx` full replacement by mobile icons (§6.2), beyond the auth screens.
- Contract confirmation for the quote-reshare body field `text` (§7.3 step 4).
- Media ingest provider choice: MediaMTX vs SRS, and whether recording/VOD is required at launch (§8.3.8).

---

## 11. Post impressions & owner-only analytics

Requirement: *"on both mobile and webapp there should be an icon under all posts that shows number of impressions … I don't want an eye icon, I want something that looks like an analytics icon, just like Twitter. Also create a screen dedicated for analytics for both mobile and webapp — it will only be visible to the owner of the post, not everybody."*

### 11.1 Rules

- **The counter is public.** Every post shows its impression count with a **bar-chart / analytics glyph** (never an eye).
- **The analytics screen is owner-only.** It is reached by pressing the impressions counter **only when you own the post**; everyone else's counter is inert text.
- Data comes from `GET /api/v1/posts/:postId/analytics`, which returns `403 NOT_POST_OWNER` for anyone but the author — the UI never has to guess.

### 11.2 Shipped **[DONE]**

| Surface | File |
| --- | --- |
| Mobile glyph | `src/components/icons/custom/analytics24.tsx` (`Analytics24Icon`, three ascending bars + baseline), exported through `icons/custom/index.ts` and the icons barrel. |
| Mobile counter | `src/components/feed/postCard.tsx` — `Impressions` counter with the analytics glyph; `onPressAnalytics` only fires for `isOwnPost`. |
| Mobile screen | `src/screens/posts/postAnalytics.screen.tsx` — owner note, 4 metric cards, 7-day bar chart, post summary; registered as `PostAnalytics` in `navigation.types.ts` + `main.navigator.tsx`; wired from `feedTab.tsx` and `postDetail.screen.tsx`. |
| Webapp glyph | `src/components/ui/icons.tsx` → `AnalyticsIcon`. |
| Webapp counter | `src/components/feed/postCard.tsx` — owner renders a `<Link href={/analytics/post/:id}>`, everyone else a plain `<span>`; both show the glyph + "impressions". |
| Webapp screen | `src/app/(app)/analytics/post/[postId]/page.tsx` + `page.module.css` — `useSession()` owner guard, metric grid, 7-day chart, engagement rows. |
| Contract | `PostAnalytics` / `PostAnalyticsDaily` in both `types/models.type.ts`; `fetchPostAnalytics` in both `services/posts.service.ts`; owner-only mock route in both `mocks/posts.mock.ts`. |
| Creator dashboard | mobile `creatorDashboard.screen.tsx` — per-post/live views with the `Analytics24Icon` glyph, post rows open `PostAnalytics`; webapp `/creator` (`(app)/creator/page.tsx`) — period chips, earnings summary, top lives & posts with views + `AnalyticsIcon`, post rows → owner-only `/analytics/post/:id`, entry from `/me`. **[DONE — §15]** |

### 11.3 Next

- ~~Webapp creator dashboard with views per post~~ — shipped as `/creator` this batch (§15.1).
- Real analytics numbers from the API once the backend lands (**[LATER]**).

---

## 12. Feed & chat UX batch (mobile + webapp)

Requirement (2 Oct): impressions counter last everywhere + owner-only analytics tap; `For You` as a dropdown with `Following`; ad CTA buttons that open the actual product; filled-red like icon + double-tap like with centre burst (feed, reels, live); hold-to-2× on reels; chat emoji panel + a plus menu (Photos/Camera real, Location/Documents/Poll soon) with **no emoji library**; tapping a reshared block opens the original post; **tipping only in reels, not the feed**; and the duplicate `.$ad_post_1` React key warning.

### 12.1 Shipped **[DONE]**

- **Mobile:** `postCard.tsx` (impressions last, solid `HeartFill72Icon`, double-tap + `LikeBurst`, tip removed), `topicFilterRow.tsx` (`For You ▾` → For you/Following menu), `feedTab.tsx` (feedMode + following query + **id dedupe**), `resharedPostBlock.tsx` (whole block → original post), `sponsoredContent.tsx` (CTA → `ProductDetail`/`Store`), `clipPage.tsx` (hold → 2× + badge), `live.screen.tsx` (double-tap → ❤️ + burst), chat composer/attachment/image-message stack (`messageComposerBar`, `chatAttachmentMenu`, `chatComposerWithVoiceNotes`, `optimisticImageMessageSender`, `messages.service`, `chats.mock`, `chatBubble`, `chat.screen`, custom `document24`/`poll24` icons).
- **Webapp:** footer order (impressions last), For you/Following dropdown + following query, feed id dedupe — verified with headless Chrome (mock login) via screenshots.
- Gates: `npx tsc --noEmit` clean in `apps/mobile` and `apps/webapp`.

### 12.2 Decisions

- Emoji = the panel's plain unicode `const` **plus** the user's own keyboard; no emoji dependency.
- Location / Documents / Poll deliberately show a *coming soon* alert — no `expo-location` / document-picker installed.
- Tipping removed from `PostCard` only; reels (`clipPage`) and live (`live.screen`) keep their tip sheets.
- Sponsored slots rotate `ad_post_1..4` every 4 pages (stateless cursor mocks) — duplicates are prevented client-side, not by changing the mock contract.

### 12.3 Later / watch

- The `Text strings must be rendered within a <Text>` console warning: static + type-aware scans of `apps/mobile/src` find **no** offenders in current code (the pasted bundle predated these fixes) — if it survives a reload, capture the DevTools component stack and chase it.
- Webapp `postCard` doesn't render reshared posts yet, so "tap original repost" has no surface there.
- Real following-feed content once the backend lands (mock filter is `isFollowingAuthor`).

---

## 13. Verification checkmarks — business (gold) vs personal (blue) **[PROPOSAL]**

Requirement (2 Oct): *"businesses and brands use gold checkmarks, while users use only blue. If a user pays for a business checkmark for their store — which appears beside the store or brand name — they must purchase their personal one separately. They can pay for only the business, or only the personal, or both; the two must never conflict."*

### 13.1 The two tiers

| Tier | Colour | Attached to | Shown beside | Purchased how |
| --- | --- | --- | --- | --- |
| **Business / brand** | **Gold** checkmark | a store / brand record | store name — store page, product cards, seller messages, brand mentions | its own subscription, one per store |
| **Personal** | **Blue** checkmark | the user account | display name / `@username` — posts, comments, profile header, creator surfaces | its own subscription, one per account |

### 13.2 Rules

- **Two independent purchases.** Backed by two separate subscription records (`subjectType: "user" | "store"`). Buying one never grants or upgrades the other — no bundle, no auto-inheritance.
- **Either or both.** A seller can hold: personal only, business only, or both at the same time. Checkout for the second tier is a normal, separate payment.
- **No conflict, ever.** Rendering is keyed by subject, not by user: a store name always gets the gold badge, a person's name always gets the blue badge. One person with both sees blue beside their name and gold beside their store **on the same screen** — two badges, no overwrite.
- **Business tier requires a business.** Only purchasable against an approved store/brand. Personal tier is per account. Cancelling either tier removes only that badge; the other keeps working.
- **Single shared badge component** (`VerifiedBadge`, variant `gold | blue`) across mobile, webapp and Studio — the checkmark glyph appears nowhere else in the UI.
- Pricing, billing period and eligibility per tier: **TBD** (open question before build).

### 13.3 API sketch (for when the backend starts)

- `GET /api/v1/verifications/me` → `{ personal: {...} | null, business: { storeId, ... } | null }`.
- `POST /api/v1/verifications/checkout { subjectType, storeId? }` → payment session (Paystack/Flutterwave).
- Webhook `subscription.updated` → set/clear `verified` flag on the `users` row (personal) or `stores` row (business).
- Badge payloads are returned on user/store responses; the client never decides verification.

### 13.4 Status

**Proposal only — no code yet.** Approved in principle (2 Oct); pricing + billing shape still open.

---

## 14. Orders tracking (history, details, status) **[DONE]**

Requirement: *"a dedicated page for orders tracking, where they will see history of the orders, check details of the orders and status too."*

| Surface | Where | What |
| --- | --- | --- |
| Webapp list | `(app)/orders/page.tsx` — `/orders` | full history, status filter chips (All / Pending / Paid / Shipped / Delivered / Completed / Cancelled), status badges, link to detail |
| Webapp detail | `(app)/orders/[orderId]/page.tsx` | escrow **status timeline** (Order placed → Paid into escrow → Shipped → Delivered → Completed), items, totals, pay / confirm / dispute actions |
| Mobile list | `screens/orders/orders.screen.tsx` | grouped sections + horizontal filter chips, `OrderListItem` → detail |
| Mobile detail | `screens/orders/orderDetail.screen.tsx` | `StatusPill`, escrow status screen, confirm-receipt / dispute actions |
| Entries | webapp `/me` profile icon → `/orders`; mobile profile shortcuts → **My orders**; payment success → **View my orders**; order notifications → Orders |

Status: **[DONE]** — both apps have history + detail + status end-to-end in mock mode.

---

## 15. Auth wording, social sign-in & creator analytics batch (2 Oct)

Requirement: *social sign-in everywhere on the webapp without deviating from the mobile plan; no "username" wording or phone registration in auth; `/welcome` defaults to signup with the login mode staying on the page and the button heading to `/login`; creator dashboard shows views per post with an analytics-style icon (never an eye); owner-only analytics stays owner-only.*

### 15.1 Shipped **[DONE]**

- **Webapp social sign-in** — `SocialSignInButtons` (Apple + Google) rendered on `/welcome` (above the Email button), `/login` (below the form) and `/signup` contact step (below the "or" divider) — same order/format as mobile onboarding.
- **Auth wording** — the only "email/username" offender (`welcome/page.tsx` login-mode label) now reads **"Use email"**; every login placeholder is "Enter your email"; no phone input exists in any register flow (only the decorative device mockup in the auth design half); no eye icon anywhere near views/impressions.
- **`/welcome` flow** — defaults to `signup` mode; the footer "Log in" toggles in place (stays on `/welcome`); in login mode the Email button becomes "Use email" and navigates to `/login` for the form; social buttons remain for direct sign-in.
- **Mobile creator dashboard** — every top-content row now shows views with the `Analytics24Icon` bar-chart glyph and posts open the owner-only `PostAnalytics` screen.
- **Webapp creator dashboard** — new `/creator` screen (period chips, earnings summary, top lives & posts with views + `AnalyticsIcon`), entry from `/me`; post rows link to the owner-only `/analytics/post/:id` screen. Data from the already-shipped `GET /api/v1/creators/dashboard` mock.

### 15.2 Decisions

- Welcome login-mode button says **"Use email"** (never "…/username") — the backend still accepts username-or-email identifiers, but no UI says so (§6.4 rule).
- Dashboard rows for **lives** show views but are not pressable (no live-analytics screen yet); only **posts** open the analytics screen.
- The business/personal checkmark split is documented as a proposal only (§13) — no badge code until pricing lands.

### 15.3 Later / watch

- Live analytics screen (retention, top moments) for dashboard rows of kind `live` (extends §8.3.10).
- Creator Program join flow on the webapp (dashboard shows the API's 403 message until then).
- Real dashboard numbers once the backend lands (§9 mock contract).
