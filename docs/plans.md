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
- Social buttons: **[DONE]** both render on the onboarding screen in mobile's exact order and copy (`Continue with Apple`, `Continue with Google`). Neither is wired yet, so a tap shows mobile's own `…sign-in isn't configured yet.` message — the same `SocialSignInNotConfiguredError` text the app uses when a platform has no client id. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_APPLE_CLIENT_ID` are in `.env.example`. **[NEXT]** implement the PKCE popup flow against `POST /api/v1/auth/google|apple` once the client ids exist, and switch to `SocialSignInNotConfiguredError` only when they are absent. Do not ship a button that silently does nothing.
- `src/proxy.ts`: `/welcome` is on the public allow-list, and static assets pass through so `public/screens` and `public/onboardingMarketPhoto.jpg` resolve. **[DONE]** Legal links (`Terms of Service`, `Privacy Policy`, `Learn more`) intentionally point at `NEXT_PUBLIC_MARKETING_SITE_URL`, i.e. the `apps/web` landing site — the webapp has no local `/terms` or `/privacy` and needs none while those are the only links.

### 6.3 Desktop split-screen **[DONE]**

- Left panel = landing page vibes from `apps/web`: palette from `apps/web/src/app/globals.css`, proof points/wording from the landing page, and real phone screenshots from `apps/web/public/screens/*.webp` (786×1704: `homeFeedScreen`, `creatorProfileScreen`, `productDetailScreen`, `homeMartScreen`, `martProductsScreen`, `chatWithSellerScreen`, `shoppingCartScreen`).
- Right panel = the auth form (mobile copy).
- Collapse to a single column under the existing breakpoint; on mobile viewports show splash → onboarding only.
- No new artwork, no new logo, no invented illustration.

### 6.4 Phase 2 (unchanged) **[LATER]**

Clips, create/story/live, wallet, seller, creator, boost, disputes — plus the subscription screens of §4. **[LATER]** none of creator subscriptions in the webapp until phase 2.

---

## 7. Deferred / open questions

- Verify the server accepts `audience: "subscribers"` (§5.4).
- Python thumbnail worker (§5.5).
- `components/ui/icons.tsx` full replacement by mobile icons (§6.2), beyond the auth screens.
