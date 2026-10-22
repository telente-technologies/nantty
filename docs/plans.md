# Zudomart — Working Plans

Living plan for the work in flight. Status markers:

- **[DONE]** — shipped and verified in this repo
- **[NEXT]** — approved, ready to build
- **[LATER]** — agreed direction, not scheduled

Update this file whenever a plan item changes shape. The record of what actually changed, file by file, lives in [CHANGELOG.md](./CHANGELOG.md). Paths in older mobile entries are relative to `apps/mobile/`; a few name files in the removed monolith and are kept as history.

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

## 3. Chat: keyboard and composer **[REDONE 2026-10-03 — NOT TESTED ON A DEVICE]**

**Why the first version failed.** `useKeyboardInset` only listened to `keyboardWillShow` / `keyboardDidShow`. That missed later height changes (suggestion bar, emoji keyboard, third-party keyboards). It also added the full keyboard height on top of `Screen edges={["top","bottom"]}`, so on iPhones with a home indicator there was a gap the size of the bottom safe area. On Android it reacted only after the keyboard had finished animating. Its "did the window already shrink?" guess (`RESIZE_DETECTION_RATIO`) breaks under Expo SDK 57's enforced edge-to-edge, where `adjustResize` no longer resizes the window. Comments were worse. `ClipCommentsSheet`, `BottomSheet`, `postDetail`, `story`, `support` and `dispute` used React Native's `KeyboardAvoidingView` with `behavior={undefined}` on Android, so they did nothing there. The iOS `"padding"` also kept the safe-area padding (another gap). The live comment bar had no keyboard handling at all.

**Fix.**
- Added `react-native-keyboard-controller` 1.21.9, plus its peers `react-native-reanimated` 4.5.1 and `react-native-worklets` 0.10.1, installed with `npx expo install`. `KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge` wraps the app in `App.tsx`. The library tracks the real keyboard frame on every frame on both platforms. `app.json` sets android `softwareKeyboardLayoutMode: "resize"`, which the library expects. Inside the provider the window is not resized, so the offset is applied once and never doubled.
- **Native rebuild required.** These are native modules, so Expo Go and the current APK/dev client will crash or show nothing until you run a new EAS build (dev client and APK). They are autolinked, so no config plugin is needed. babel-preset-expo adds the worklets plugin automatically.
- One shared primitive, `components/ui/keyboardSpacer.tsx`. Its height is `max(keyboardHeight − offset + openedGap·progress, restingHeight, reservedHeight)`, where `restingHeight` defaults to the bottom safe-area inset. A composer placed directly above it sits flush on the keyboard and drops back above the home indicator when the keyboard closes. With reduced motion on, it jumps to the target height at `onStart`/`onEnd` instead of animating.
- Chat (`chat.screen.tsx`, which covers DMs, groups and channels) is now an **inverted** FlatList, so the newest message stays anchored while the keyboard animates. It uses interactive dismiss on iOS and on-drag on Android. `MessageComposerBar` owns the spacer. The emoji panel renders *inside* the spacer at `useLastKeyboardHeight()` (the last real keyboard height), and that height stays reserved until the keyboard has finished opening again, so switching between keyboard and emoji panel doesn't jump. Read-only notices and the voice-note recorder also sit on a spacer.
- Comments: `CommentComposer` owns a spacer on `postDetail`. In `ClipCommentsSheet` the spacer sits *below* the sheet and the sheet `flexShrink`s, so the 566 pt sheet rises with the keyboard and shrinks on short phones. `BottomSheet` works the same way, which covers the sound picker, report, share-live, poll and gift-goal sheets (floating sheets keep their 14 pt gap).
- Story reply, live comment bar, support chat, dispute chat and the create-post caption use the spacer. `editProfile` uses `KeyboardAwareScrollView`. `authStep` uses the library's `KeyboardAvoidingView` (padding on both platforms).
- Deleted `hooks/useKeyboardInset.hook.ts`. There are no tab bars under these screens (they are stack screens, and Clips hides the tab bar), so `offset` is 0 everywhere.

**Manual test checklist (to run on devices — none of this was tested on a device):**

| Device | Default keyboard | Emoji keyboard | Gboard + suggestion bar | SwiftKey |
| --- | --- | --- | --- | --- |
| Small Android, gesture nav | ☐ | ☐ | ☐ | ☐ |
| Android, 3-button nav | ☐ | ☐ | ☐ | ☐ |
| iPhone SE | ☐ | ☐ | n/a | ☐ |
| iPhone with Dynamic Island | ☐ | ☐ | n/a | ☐ |
| iPad (runs as iPhone app, `supportsTablet: false`; also try split view / floating keyboard) | ☐ | ☐ | n/a | ☐ |

For every cell, check each screen: DM chat, group chat, support chat, dispute chat, post detail comments, clip comments sheet (top-level and reply), live comment bar, story reply, create-post caption, a sheet with a search/field (sound picker, report, gift goal).
- The composer sits flush on the keyboard: no gap and no overlap, including after switching keyboards and toggling the suggestion bar.
- When the keyboard closes, the composer returns above the home indicator / nav bar.
- Chat: the latest message stays visible while the keyboard animates. On iOS, drag the list down to dismiss interactively.
- Chat emoji panel ↔ keyboard switching doesn't jump.
- With Reduce Motion on (iOS) / Remove animations on (Android), the composer repositions without animating.

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

**API** (the old monolith's `creatorSubscriptions` module, the old monolith's `creators` module):

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

### 5.1 Gating **[DONE — §16]**

- Exists: `screens/creator/creatorProgram.screen.tsx` (apply), `creatorApplicationStatus.screen.tsx` (review states), `creatorProgramService.fetchMyCreatorEligibility / fetchMyCreatorApplication / submitCreatorApplication`, and `CreatorDashboardScreen` already degrades to "See the Creator Program" when the dashboard call fails.
- **[DONE — §16]** Gating is now explicit at the entry point via one shared helper: `useCreatorEntry()` in `hooks/useCreatorStatus.hook.ts` resolves `CreatorDashboard` (status or application `approved`) → `CreatorApplicationStatus` (`pending` / `rejected`) → `CreatorProgram` (otherwise, incl. ineligible — which already renders "Apply when you're eligible"). Applied at every entry: the own-profile more menu (`ownProfileMenu.util.ts`), Settings row, and `openCreatorProgramOrSettings(navigation, destination)` (create/live lock paths). Studio is never surfaced for ineligible accounts.

### 5.2 Studio surface **[DONE — §16]**

Current `CreatorDashboardScreen` already provides: period chips (week/month/all-time), earnings card, "Withdraw earnings" → Wallet, top lives & posts with views + earnings, affiliations, subscription plans, revenue rules.

**[DONE — §16]** restructured into a Studio home with the four required blocks, in this order:

1. **Coins** — `StudioCoinsSection` (new): balance + earned coins from `GET /api/v1/coins/balance` (mobile `CoinBalance` type now carries `earnedCoins`, as the API already returns), **Convert earned coins** → `ConvertEarnedCoinsSheet` (new; `POST /api/v1/creators/earnings/convert` with `Idempotency-Key`, receipt shows cash received + earned remaining; 422 minimum-payout/insufficient-earned errors surface verbatim), **Coin activity** → `CoinActivityScreen` (new route): `GET /api/v1/coins/transactions` ledger rows (`+`/`−` coins, balance-after, date) with cursor "Load more". *Send coins* is intentionally **not** in this block: `TransferCoinsSheet` requires a resolved recipient, and sending stays where it already works (a creator's profile → More). Mocks mirror the real contracts (`earnedCoins` on balance, seeded ledger, conversion state machine) — no invented fields.
2. **Wallet / earnings** — `CreatorEarningsCard` + withdraw → `screens/wallet/{wallet,transactions,withdraw,payoutAccounts}.screen.tsx`.
3. **Content** — card with **Create post or clip** → `CreatePost` (mode `post`), followed by the Top lives & posts list.
4. **Subscription plans** — existing `SubscriptionPlansSection` (§4.1). Affiliations + revenue rules remain after as extras.

Header renamed **"Creator Studio"** (shortcut + Settings row labels follow via `useCreatorEntry`).

### 5.3 Upload flows: clips vs normal videos **[DONE — §16] / [LATER]**

Requirement: two clearly separate upload paths — **clips** (short-form, vertical, feed of shorts) and **normal videos** (long-form, landscape/portrait, watch page).

- Shared: media pick (`components/create/pickMedia.util.ts`), draft upload tracking (`postDraftUploads.hook.ts`), title/caption, **audience**, thumbnail, publish. **[DONE]** upload purpose is now `clip` in clip mode, `post` otherwise.
- **Clips**: **[DONE]** own `CreateMode` entry + pill chip, draft `kind: "clip"`, exactly-one-video validation client-side (server's own rule — `assertMediaFitsPostKind`: "A clip needs exactly one video."), publish sends `kind: "clip"`, mock rejects mismatched clip media with the same message, **and the created clip is appended to the mock clips feed** (`appendMockClip`) so `GET /api/v1/clips` shows it — `["clips"]` invalidated on publish. Sound picker reuses the existing `soundId` thread. **[LATER]** vertical-first editor, default duration cap (server enforces a 180s cap, `maxClipSeconds`; the client mirrors it), dedicated clip composer preview layout.
- **Normal videos**: **[DONE]** `kind: "video"` in the draft (media-derived: any video → `video`, else `photo`), wire kind maps `video`/`photo` → `kind: "post"`, lands on the posts feed/watch as before; viewer-side rotate affordance already exists (§1.3).
- `CreateModePill` **[DONE]** is the single chooser; shipped as **Story | Post | Clip | Product | Live** — the required four (Clip | Video | Photo | Live) would remove the Story and Product entries, which other sections depend on; Video/Photo are draft kinds inside the Post composer rather than pill modes (the pill's copy is derived from `CreateMode`, uppercase — no invented labels).
- Today `createPost.screen.tsx` publishes `storiesService.publishPost({ text, audience, mediaIds, kind, soundId })`. **[DONE]** composer draft carries `kind: "clip" | "video" | "photo"`, synced by mode + picked media, and threaded to the contract's `kind: "post" | "clip"` on publish.

### 5.4 Audience selection **[BLOCKED — contract verified, chip not shipped]**

Existing `PostAudience` is `everyone | followers` (`postToolbar.tsx` toggle: "Everyone"/"Followers"). Requirement adds a subscriber tier:

- Extend to `everyone | followers | subscribers`.
- `subscribers` is only offered when the author has ≥1 active plan **and** the viewer set is resolved server-side (already modelled by `subscriberOnly` / `viewerHasAccess` on posts and clips).
- Toolbar chip cycles through the three values with the same 25px pill; keep `Everyone`/`Followers` copy exactly as-is and add `Subscribers`.
- Server contract: confirm `storiesService.publishPost` accepts `audience: "subscribers"` before exposing the option — **do not ship the chip until that is verified** (no inventing API fields).
- **[DONE — §16] Contract verification (the gate this item required): NOT supported as written.** `CreatePostBodySchema` (the old monolith `posts.validator.ts`) is `audience: schema.enum(["everyone"]).optional()` — there is no `subscribers` value. The subscriber tier exists instead as a separate field: `visibility: schema.enum(["public", "subscribers"])`, guarded server-side by `assertApprovedCreator` (approved creators only). **The chip stays unshipped.** Ship in a deliberate follow-up as: approved creator + ≥1 active plan → chip offers "Subscribers" → publish sends `visibility: "subscribers"` (with `audience: "everyone"`), not `audience: "subscribers"`.
  - **Debt flagged:** mobile already sends `audience: "followers"` today — invalid against the real API (mock casts the body, so it only works in mock). Needs a decision: extend the server enum, or drop/replace the client value.

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
- Social buttons: **[DONE]** both render on the onboarding screen in mobile's exact order and copy (`Continue with Apple`, `Continue with Google`). **[DONE — §15] Wired to the mock backend and verified end-to-end headless (fresh profile, `/welcome` → tap *Continue with Google* → 401 → signed in → lands on `/` with a real session cookie, `/bff/api/v1/users/me` returns the demo user)** — the webapp is a demo/mock product exactly like mobile, so a tap must actually sign the user in (mobile's `authService.signInWithSocialProvider` → `POST /api/v1/auth/google|apple` returns a session in mock mode; the webapp does the same through `POST /bff/auth/social`).
  - When mocks are on → tap signs in and lands on the feed. **No dead buttons.** **[DONE]**
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

- **Live session metadata in the API** — the old monolith's `posts` module: `controllers/live.controller.ts`, `registerLiveRoutes()` (`routes/posts.routes.ts:72–90`), commands `startLiveSession` / `endLiveSession` / `joinLiveSession` / `leaveLiveSession` / `commentOnLiveSession` / `reactToLiveSession` / `shareLiveSession` / `addLiveProduct`, queries `getLiveSession` / `listLiveSessions` / `listLiveComments`, model `posts.model.ts:75–98`, DTOs `posts.dto.ts:90–111`, `repositories/live.repository.ts` + `live.prisma.repository.ts`. Endpoints: `/api/v1/lives/*`.
- **Gifting** lives in the `creators` module.
- **Mobile live surfaces** — `src/screens/live/*`, `components/create/liveSetupPanel.tsx`, `Live` / `LiveEnded` nav params, `liveShoppingScreen.webp` asset.
- **Nothing else exists yet:** no RTMP / WebRTC / HLS / ingest infrastructure anywhere in the repo (only the old monolith's compose file), **no overlay/graphics feature anywhere**, no `studio` app, no live surface in the webapp.

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
                          │  the old monolith  /api/v1/lives/*     │  (metadata already exists)
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
- **Dropped by the owner on 2026-10-05:** the launch waitlist (web form, `POST /waitlist`, `ts.campaigns` waitlist). The website links to the app stores, the web app and seller sign-up instead. Phone-number sign-in and phone OTP are removed the same day: email is the only sign-in identifier and code channel. (`backInStock` "waitlisted" below means a product restock alert, not the launch waitlist.)

---

## 11. Post impressions & owner-only analytics

Requirement: *"on both mobile and webapp there should be an icon under all posts that shows number of impressions … I don't want an eye icon, I want something that looks like an analytics icon, just like Twitter. Also create a screen dedicated for analytics for both mobile and webapp — it will only be visible to the owner of the post, not everybody."*

### 11.1 Rules

- **The counter is public.** Every post shows its impression count with a **bar-chart / analytics glyph** (never an eye).
- **The analytics screen is owner-only.** It is reached by pressing the impressions counter **only when you own the post**.
- **Rule change, 4 Oct 2026:** the earlier "owner-only impressions" rule is superseded. Every feed post shows the analytics glyph with the views count (`post.views`, public, compact, hidden at 0) in the X-style action row. The owner's tap opens the full analytics screen; anyone else (or a guest) gets a small "Views" dialog ("Times this post was seen. Learn more") with a Close button and no private metrics. Reels/clips unchanged.
- Data comes from `GET /api/v1/posts/:postId/analytics`, which returns `403 NOT_POST_OWNER` for anyone but the author — the UI never has to guess.

- Full analytics screen (mobile `PostAnalytics`, webapp `/analytics/post/[postId]`) now adds engagements, engagement rate, saves, shares, link and profile clicks, new follows, video views and watch time (video posts only) and an audience split; still "Only you can see these numbers".
- **Backend gap [LATER]:** `services/typescript/social` `getPostAnalytics` stays owner-only (`403 NOT_POST_OWNER`) but returns only impressions, uniqueViewers, reach, likes, comments, reposts, shares, saves, profileVisits and `daily`. It still needs `linkClicks`, `profileClicks`, `newFollows`, `engagements`, `engagementRate`, `video` and `audience`. Public post responses do not yet expose the view count (`post.viewCount` exists on the Post row); it must be added to the public post/feed DTO as `views`.

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
- `POST /api/v1/verifications/checkout { subjectType, storeId? }` → payment session (Flutterwave).
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

---

## 20. Creator (non-selling) live

Requirement: streamers who only make content (talk, music, gaming, IRL, education) can go live end-to-end and sell nothing.

### 20.1 Rules

- Only **Creator Program** members can go live (unchanged). They earn through **gifts, creator subscriptions and affiliate commissions**, never through a store.
- Every live has a **category**: `justChatting` / `gaming` / `music` / `irl` / `education` / `shopping`. **Shopping** is offered only to accounts with a store (`hasStore` in Studio, `isSeller` on mobile).
- **Products are optional.** Pinning, the products card and product counts appear only for accounts with a store. A live without products is a normal live.
- Dashboard numbers lead with **coins, gifts, subscribers, viewers, top gifters and battle results**, never product counts.

### 20.2 Status

| Surface | Scope | Marker |
| --- | --- | --- |
| Studio landing | Copy and hero for all creators (OBS gaming, talk, music, battles, gifts); selling is one optional use case | **[DONE]** |
| Studio create + dashboard | Category picker on create; earnings panel (coins, gifts, subscribers, viewers, top gifters, battles) on `/lives` and the control room; pinning hidden without a store | **[DONE]** |
| Studio mock | `LiveSession.category` + `earnings`; `User.hasStore`; `POST /api/v1/lives` accepts `category` | **[DONE]** |
| Web landing | Live described as creator streaming and shopping; creator program copy says no store is needed | **[DONE]** |
| Mobile go-live | Category picker in `liveSetupPanel`; no product step in the create flow; `category` sent to `POST /api/v1/lives` | **[DONE]** |
| Mobile live room | Products button and sheets only when the live has products (host: Creator + products or `shopping`); category chip in `LiveHeader` | **[DONE]** |
| Webapp | No live pages exist yet; apply the same rules when the viewer lands (§8.3.9) | **[LATER]** |

---

## 17. Live gifts (TikTok-style) **[DONE — mock]**

Gifting works on any live, including lives with no products: for content creators, gifts are the main way to earn. No gift UI assumes a store. The mock contract follows [backendPlan.md §4.1](./backendPlan.md) field for field. The deviations are listed in §17.6.

### 17.1 Catalogue — `GET /api/v1/gifts` → `{ data: LiveGift[], nextCursor }`

```
LiveGift { id, name, description?, tier: basic|premium|legendary, priceCoins,
           animationEngine: alphaVideo|lottie|pag|spriteSheet, animationAssetKey, previewAssetKey,
           durationMs, displayLevel: micro|medium|large|global, sound?, haptic?: light|medium|heavy|pattern,
           comboable, isActive, sortOrder, metadata? }
```

- 26 seeded gifts. **Quick** (basic/micro): Like, Clap, Fire, Heart, Star, Thumbs Up, Smile, Sparkle. **Fun** (basic/medium): Rose, Gift Box, Crown, Diamond, Rocket, Lightning, Fireworks, Money Rain. **Premium** (large): Golden Crown, Luxury Car, Private Jet, Treasure Chest, Diamond Shower, Golden Rain, Supernova. **Legendary** (global): Zudo Galaxy, Zudo King, Zudo Empire.
- The client maps `animationAssetKey` to a local vector preset (`liveGiftArtworkPresets.constant.ts`). An unknown key falls back to a generic gift-box preset, so adding a gift is only a config change.
- Panel sections: Popular = `basic`, Premium = `premium`, Legendary = `legendary`.

### 17.2 Send — `POST /api/v1/live/gifts` (header `Idempotency-Key`)

```
→ { liveId, giftId, quantity: 1–100, receiverUserId?, comboId? }
← 201 { giftTransactionId, giftId, quantity, totalCoins, receiverUserId, comboId, comboCount, coinBalance, battleId?, createdAt }
```

- Errors: `402` (not enough coins: the client rolls back the optimistic balance and opens Recharge), `422` (gifting yourself), `400` (quantity out of range). Replaying an `Idempotency-Key` returns the same receipt.
- The client batches taps within 300 ms into one request and reuses `comboId` while taps continue inside the 3 s window. The server owns `comboCount`.
- Amounts are always whole coins. Money appears only as `{ amountMinor, currency }`, taken from the server (stream stats `estimatedEarnings`). The client never hardcodes a currency.

### 17.3 Realtime — `gift.sent` (topic `live:{liveId}`)

```
{ type: "gift.sent", liveId, giftTransactionId, giftId, animationAssetKey, displayLevel, quantity, totalCoins,
  sender: { id, name, avatarUrl }, receiverUserId, comboId, comboCount, battleId? }
```

- Mock: `services/liveGiftMockEmitter.service.ts` simulates fake viewers sending gifts every 3–7 s (62% micro, 28% medium, ~8.5% large, ~1.5% global), with combos up to ×12.
- Display: `micro` = aggregated side banner + float near the streamer. `medium` = banner + fly-in across part of the screen. `large` = queued full-screen spotlight with a dim. `global` = queued full-screen spotlight with the stream still visible, plus "to @streamer". Only large/global are exclusive.
- Combo escalation thresholds are 1 / 5 / 10 / 50 / 100. Each threshold grows the float or flyer. Crossing 50 queues a large spotlight, and crossing 100 queues a global one.
- Chat line: "Name sent Rocket ×10 to @creator". There is one line per combo, updated in place.

### 17.4 Leaderboards, goals, host stats

- `GET /api/v1/lives/:liveId/leaderboard?scope=session|recipient&receiverUserId=&limit=20` → `{ data: [{ rank, user{id,name,username,avatarUrl}, coins }], viewerRank? }`. Used by the top gifters sheet and the live-ended **Top Supporter** card.
- `GET /api/v1/lives/:liveId/gift-goals` → `{ data: GiftGoal[], nextCursor }`. `POST …/gift-goals { title, targetCoins, giftId? }`, `PATCH …/gift-goals/:goalId { title?, targetCoins? }`, `DELETE …/gift-goals/:goalId`.
  `GiftGoal { id, liveId, creatorId, title, targetCoins, giftId?, progressCoins, status: active|completed|cancelled, completedAt }`.
- `GET /api/v1/creators/me/analytics/gifts/streams/:liveId` → `{ liveId, giftCount, totalCoins, creatorCoins, estimatedEarnings: Money|null, topSupporters[] }` (host dashboard). Recent gifts come from the `gift.sent` stream.

### 17.5 Reusable API (for battles / multi-guest)

```ts
useSendLiveGift({ liveId, recipientUserId? }) → { sendLiveGift(gift, quantity?) → boolean, comboWindow, endComboWindow,
                                                  isSendingGift, hasNotEnoughCoins, giftSendingErrorMessage, dismissGiftError }
subscribeToLiveGiftSentEvents(liveId, listener, streamerUserId?) → unsubscribe
useLiveGiftSentEvents(liveId, listener, streamerUserId?)
<LiveGiftPickerSheet liveId recipientUserId? visible onClose />
useLiveGiftCatalog(enabled?) → { catalog, giftsById, giftsBySection }
```

`recipientUserId` targets an on-stage streamer. A battle score can subscribe with `useLiveGiftSentEvents` and add `totalCoins` by `receiverUserId`.

### 17.6 Deviations and later

- **Art:** `animationEngine` is seeded as `lottie`, but the client draws every engine with built-in `react-native-svg` + `Animated` vector presets keyed by `animationAssetKey` (no Lottie/Skia dependency yet). Real Lottie/alpha-video assets can replace presets one key at a time. **[LATER]**
- **Owner's mp4s** (`apps/gift/*.mp4`): 1280×720 H.264 with a **checkerboard baked into the pixels** (fake transparency) and no alpha. Overlaid, they show as a boxed clip, and they can't be keyed cleanly because the gold sparkles share the checker's greys. The new vector art keeps their idea (the object grows in, a gold orbit ring, a sparkle burst, a light-ray finale). They are not used.
- **Quantity 100:** decided — requests allow 1–100 and the panel offers ×1/5/10/50/100 (backendPlan §4.1 updated). **[DONE]**
- **Tiers:** the owner's four tiers (Quick/Fun/Premium/Legendary) map to the plan's `basic` + `displayLevel` (micro vs medium).
- **Additions to the plan:** `GET …/gift-goals` (list), the host stream-stats endpoint shape, and `liveId` + `type` in the `gift.sent` envelope.
- **Later:** `gift.combo.*` / `gift.goal.*` / `leaderboard.updated` events (the mock refetches on `gift.sent`, throttled to 1/s). Gift sounds. Platform-wide marquee for `global`. Per-stream ranking history beyond the live-ended card.

---

## 18. Multi-guest live & battles (mobile, mock mode) **[DONE (mock) / LATER (LiveKit + go-live)]**

Requirement: TikTok-style multi-guest LIVE (host + up to 9 guests) and gift battles between on-stage streamers. Works on any live, with or without products. The backend contract is [backendPlan.md §4.2](./backendPlan.md); differences are listed in 18.7.

### 18.1 Rules

- **Stage:** host + up to **9 guests (10 streamers)**. The host invites from the viewer list (search) or approves viewers who request to join. Invites expire after **60 s**.
- **Host controls:** remove a guest, mute their mic, turn off their camera. A guest can mute themselves, turn off their camera, or leave.
- **Anyone invited can be a guest and battle.** Only **Creator Program** members get gift payouts. Gifts to a non-member guest still count toward their score but settle to the **host** (`LiveStageStreamer.isCreatorProgramMember`, `LiveBattlePayout.paidToUserId`). The gift picker says so.
- **Battle:** the host picks 2–10 on-stage streamers, a duration (1 / 3 / 5 min; the API accepts 60–600 s) and the rule. Score = coins gifted to a streamer while the battle is `active`. Viewers tap a tile to gift that streamer.
- **Default rule:** each streamer keeps the coins they received.
- **Winner takes all (host toggle):** every guest in the battle must accept first. If anyone declines (or 15 s pass), the host either **runs a normal battle** or **cancels**. When it ends, coins gifted to the other participants move to the single winner.
- **Tie (or every score 0):** no winner, and everyone keeps their own coins, whatever the rule.
- Viewers are never refunded. A coin spend is final when the gift commits.

### 18.2 State machine

Stage `phase` (derived by the server, `LiveStage.phase`):

```
idle ─invite─► inviting ─accept─► onStage ─create(WTA)─► battlePending ─all accept─► battleCountdown(3 s) ─► battling ─timer/end/forfeit─► settling(2 s) ─► result(10 s) ─► onStage
                                     └─create(default)─────────────────────────────►┘        declined ─► host: run normal │ cancel ─► onStage
```

Battle `state`: `countdown → active → settling → settled` (backendPlan's `pending` is the separate `battleProposal`). After the 10 s celebration the battle moves to `battleHistory` and a summary card shows under the grid until it is dismissed.

### 18.3 Layout

| Streamers | Layout |
| --- | --- |
| 1 | Full-screen video (existing `LiveVideoStage`) |
| 2 | Side-by-side split, tug-of-war bar under the grid |
| 3 | Host tall on the left, two stacked on the right |
| 4 | 2 × 2 |
| 5–6 | 3 × 2 |
| 7–9 | 3 × 3 |
| 10 | 4 × 3 |

Empty seats show "Invite" for the host. Each tile shows name, mic state, HOST tag, and in a battle the score chip (plus a rank chip when there are 3+), a crown + MVP on the winner, dimmed losers and "Left · forfeited". The timer pill pulses red in the last 10 s, with a big countdown number. The result banner shows the winner, coins moved by winner takes all and the MVP supporter, with confetti. Animations use React Native `Animated` (Reanimated is not installed).

### 18.4 Mock contract (paths match backendPlan §4.2 where it defines them)

| Method + path | Who | Notes |
| --- | --- | --- |
| `GET /api/v1/lives/:id/stage` | anyone | `LiveStage` snapshot (polled every 1 s in mock; `stage.updated` in production) |
| `GET /api/v1/lives/:id/viewers?q=` | host | Invite search (**addition**) |
| `POST /api/v1/lives/:id/guests/invitations` | host | `{userId}`; 409 `STAGE_FULL` |
| `POST /api/v1/lives/:id/guests/invitations/:slotId/accept\|decline` | invitee | |
| `POST /api/v1/lives/:id/guests/requests` | viewer | Request to join (**addition**) |
| `POST /api/v1/lives/:id/guests/requests/:requestId/approve\|decline` | host | (**addition**) |
| `POST /api/v1/lives/:id/guests/:userId/remove` | host | Forfeits a battle participant; in WTA they keep their own coins (anti-abuse) |
| `POST /api/v1/lives/:id/guests/:userId/mute` | host, or `me` | `{audio?, video?}` → `audioMuted` / `videoMuted` |
| `POST /api/v1/lives/:id/guests/me/leave` | guest | Forfeits a running battle |
| `POST /api/v1/lives/:id/battles` | host | `{participantUserIds, durationSeconds, winnerTakesAll}`, `Idempotency-Key` |
| `POST /api/v1/battles/:id/accept\|decline` | participant | Winner-takes-all consent |
| `POST /api/v1/battles/:id/start-without-winner-takes-all` | host | After a decline (**addition**) |
| `POST /api/v1/battles/:id/cancel` | host | Pending proposal only |
| `POST /api/v1/battles/:id/end` | host | Settles at current scores (`endReason: hostEnded`) |
| `POST /api/v1/battles/:id/gifts` | viewer | **Mock only:** credits a score after `useSendLiveGift` succeeds. In production the gift itself carries the battle |

Shapes (`src/types/liveStage.type.ts`): `LiveStage { layout, phase, myRole, streamers[], invitations: GuestSlot[], joinRequests[], invitationForMe, myJoinRequest, battleProposal, activeBattle, recentBattleGifts[], battleHistory[], serverNow }`; `LiveBattle { id, liveId, state, winnerTakesAll, durationSeconds, countdownStartedAt, startsAt, endsAt, settledAt, celebrationEndsAt, participants[{userId, user, score, rank, state, topGifters}], winnerUserIds, isTie, endReason, mvpGifter, transfers[{fromUserId,toUserId,coins}], payouts[{userId, score, earnedCoins, paidToUserId}] }`. Coins are integers; no money fields.

Events the client expects in production (backendPlan §4.2.5): `stage.updated`, `guest.invited` (private), `battle.created`, `battle.started`, `battle.score.updated`, `battle.ended`, `battle.winner.celebrated`, `battle.settled`, `battle.cancelled`.

### 18.5 Settlement

- **Default:** `earnedCoins = score` for every participant.
- **Winner takes all, single winner W:** each other participant P with `score > 0` yields a transfer `{fromUserId: P, toUserId: W, coins: score(P)}`; P earns 0 and W earns the total. A participant **removed by the host** keeps their own coins.
- **Tie or all zero:** no transfers, everyone keeps their own.
- `paidToUserId` is the participant if they are a Creator Program member, otherwise the host.

### 18.6 Edge cases

| Case | Behaviour |
| --- | --- |
| Guest leaves mid-battle | `state: forfeited`, cannot win; coins handled by the rule. Further gifts to them are ignored |
| Host removes a participant | `state: left`; keeps their own coins even under WTA |
| Only one active participant left | Battle ends early (`endReason: forfeit`); that participant wins if they scored |
| Host ends early | Settles at current scores |
| Stage full | Invite / approve return 409 `STAGE_FULL` |
| A WTA participant leaves during the proposal | Counts as a decline |

### 18.7 Mock demo script and differences from backendPlan §4.2

- **Viewer:** open `live_s1` (6 streamers), `live_s2` (4) or any other live (2). A battle starts after 5 s and repeats; every second battle is winner takes all. In 4+ player battles the last guest drops halfway (forfeit). After 20 s the host invites you; accept to join the stage (then you get the WTA consent prompt). "Join" requests are auto-approved after 3 s.
- **Host:** go live, open **Guests**, invite viewers (every 4th declines). Join requests arrive at 12 s, 40 s and 90 s. Start a **Battle**. With winner takes all on, about 1 in 5 guests declines, so the run-normal / cancel choice appears.
- Differences: guest slot states `joining` / `reconnecting` are not simulated; there is no `DELETE` invitation (cancel); join requests, viewer search and `start-without-winner-takes-all` are additions; `Battle.state` `pending` is modelled as `battleProposal`; backendPlan's WTA-tie split is replaced by the owner's decision (a tie keeps own); `celebrationEndsAt`, `countdownStartedAt` and `payouts` are client-display additions.

### 18.8 Later

- Real media through LiveKit (one publisher per tile). Today the host tile plays the live stream or camera, and guest tiles show the guest's avatar.
- Replace polling with `stage.updated` / `battle.score.updated` over `ex.realtime`.
- Remove `POST /battles/:id/gifts` once `useSendLiveGift` sends `battleId` and the gift service credits scores.

---

## 19. Seller dashboard (dashboard.zudomart.com) **[DONE — mock]**

**ZudoMart App = sell from anywhere. ZudoMart Dashboard = run your business.** `apps/seller` is the seller operating system. Contract: [apps/seller/apiContract.md](../apps/seller/apiContract.md).

### 19.1 Rules

- **Free for every approved Zudomart seller.** Access needs only a store membership — no Gold verification, no paid plan. Suspended or revoked stores see a restricted page.
- **No in-store POS.** No register, cash drawer, shifts, offline sales or cashier PINs. Online orders are the marketplace orders customers place in the Zudomart app.
- **Staff are Zudomart users.** Added by username search, they accept in the app and sign in with their own app credentials. Never separate staff accounts or email invites.
- **Money** is always `{ amountMinor, currency }` from the API, formatted with `money.util`. Plan prices come from `GET /seller/subscription/plans` (Nigeria: Pro ₦5,000/mo, Business ₦15,000/mo). Pro and Business include the Gold business checkmark once the business is verified.
- **Basic selling is never locked.** Locked features stay visible with an upgrade link; the API answers `402 PLAN_FEATURE_REQUIRED` with `requiredPlan`.

### 19.2 Plans (`src/config/planFeatures.config.ts`)

| Plan | Limits | Unlocks |
| --- | --- | --- |
| Free | 100 active products, 1 location, no team, 30 days of analytics | Orders, products, stock levels, adjustments, low-stock alerts, customers, messages, delivery, reviews, storefront, discount codes, payouts, core Sales/Inventory reports (CSV) |
| Pro | 2,000 products, 3 locations, 5 seats, 365 days | Advanced inventory, bulk tools, advanced analytics and reports (Excel/PDF), segments, team, flash sales/bundles/Mart featuring, ad results, multiple warehouses, automated alerts, API keys and webhooks |
| Business | Unlimited products, 10 locations, 25 seats, 730 days | Multiple stores, per-member permissions, accounting integrations |

### 19.3 Roles

Owner (everything), Manager (all but billing, withdrawals, developer), Inventory staff, Sales staff (orders, delivery, customers, messages, reviews), Accountant (money, reports, analytics, ads, read-only orders). Business stores can override a member's permissions.

### 19.4 Sections

| # | Section | Route(s) | Gating | Marker |
| --- | --- | --- | --- | --- |
| 1 | Overview | `/dashboard` | Free | **[DONE]** |
| 2 | Products | `/products`, `/products/categories`, `/products/import` | Bulk tools Pro; product cap per plan | **[DONE]** |
| 3 | Inventory | `/inventory`, `/adjustments`, `/movements`, `/transfers`, `/reorder`, `/suppliers`, `/locations` | Movements/transfers/reorder/suppliers Pro; second location Pro | **[DONE]** |
| 4 | Orders | `/orders`, `/orders/[id]`, invoice/receipt, returns, disputes | Free | **[DONE]** |
| 5 | Customers | `/customers`, `/customers/segments` | Segments Pro | **[DONE]** |
| 6 | Sales & Analytics | `/analytics` | Breakdowns and >30 days Pro | **[DONE]** |
| 7 | Marketing | `/marketing`, `/marketing/discounts`, flash sales, bundles, featured | Flash sales, bundles, Mart featuring Pro | **[DONE]** |
| 8 | Ads | `/ads` (+ link to ads.zudomart.com) | Pro | **[DONE]** |
| 9 | Payments & finance | `/wallet` (escrow, settlements, fees, refunds, withdraw, statements, accounts) | Free; accounting export Business | **[DONE]** |
| 10 | Delivery | `/delivery`, `/delivery/settings` | Free | **[DONE]** |
| 11 | Messages | `/messages` | Free | **[DONE]** |
| 12 | Storefront | `/storefront` | Free | **[DONE]** |
| 13 | Reviews | `/reviews` | Free | **[DONE]** |
| 14 | Team | `/staff`, `/staff/roles`, `/staff/activity` | Team Pro; permission toggles Business | **[DONE]** |
| 15 | Reports | `/reports`, `/reports/[kind]` | Core Sales/Inventory CSV free; rest + Excel/PDF Pro | **[DONE]** |
| 16 | Settings | `/settings/*` (store, account, security, notifications, payouts, delivery, locations, taxes, team, developers, integrations, billing, verification) | Alerts and API Pro; accounting Business | **[DONE]** |

### 19.5 Later

- **[LATER]** Backend implementation of the new contract sections (catalog extras, delivery, conversations, reviews, analytics, finance, storefront, developers, integrations).
- **[LATER]** Multiple stores under one Business account is gated but has no create-store flow yet (store switcher only).
- **[LATER]** Product video upload (links only today); real Ads Manager data shared between `/ads` and the ads report (each seeds its own).
- **[LATER]** Landing screenshots are older captures; reshoot once the new pages are final.



---

## 21. Social graph, profiles & ZudoPoints (mobile) **[DONE — mock]**

> **Creator = personal account upgrade (owner, 2026-10-03).** A creator account is the user's personal account turned into a creator account, not a separate profile. Profile types are Personal, Business/Brand and Government; `creatorStatus` (`none|pending|approved|rejected`) lives on the Personal profile and is set to `approved` when the Creator Program application is approved. It unlocks Creator Studio, going live, monetisation and earnings. Blue applies to the Personal profile whether or not it is creator-enabled.

Contracts: backendPlan §4.5 (ZudoPoints, social graph) and §4.4 (live ads). Mock mode only; `services/**` untouched.

| # | Feature | Mobile scope | Marker |
| --- | --- | --- | --- |
| 1 | Private profiles | Public/Private chips in Settings > Privacy (`PATCH /users/me { isPrivate }`); follow states `none/requested/accepted/rejected/blocked`; button reads Follow / Requested / Following; private profile hides posts and shows "This account is private"; Follow requests inbox (approve/decline) from the own-profile more menu (shown for private accounts or when requests are pending) | **[DONE]** |
| 2 | Followers / Following | Profile counts open a searchable list (`GET /users/:id/followers\|following?q=` returning `{ data, nextCursor }`); private lists return 403 for non-followers and render the private state | **[DONE]** |
| 3 | Profile switching | Existing switcher sheet extended: Personal / Business (creator is a status on the Personal profile, not a switchable profile; owner correction 2026-10-03); "Create business profile" form with category > subcategory, several allowed, plus custom (pending review); open to any organisation | **[DONE]** |
| 4 | AI-generated label | "AI generated" switch in the composer sends `isAiGenerated: true`; label on posts and clips | **[DONE]** |
| 5 | ZudoPoints on live | Supporter board ranks by points (gifts 1 coin = 1 point, like, share, follow, watch time); like-points capped at 10/min in the mock while visual likes stay unlimited; viewer's own points pill; leaderboard chip/sheet and live-ended Top Supporters use points; Rankings screen (Global / Country / Category x Streamers / Supporters / Creators). No cash-out or money display | **[DONE]** |
| 6 | Live-ad settings | "Live monetization" sheet in go-live setup: allow ads (off by default), placements, max interruptions 0-3, minimum interval, ad indicator, live-ad terms (`acceptedLiveAdTermsVersion` stored with the session), free-text own sponsorship line | **[DONE]** |

### 21.1 Notes

- `isAiGenerated` is used on `NewPostInput` and `Post` (backendPlan names it `aiGenerated`; reconcile when wiring).
- Posts from private profiles are hidden on the profile post list; feed and search filtering is **[LATER]**.
- **[LATER]** Real points awards via domain events, hourly ranking rebuild, `creatorStatus` set to approved on the personal profile server-side on approval, business verification (KYB), live-ad delivery, "who can see my followers" setting.


---

## 22. Shipping, addresses & privacy (mobile) **[DONE: mock]**

Contracts: backendPlan §4.6 and §4.7. Mock mode only; `services/**` untouched.

| # | Feature | Mobile scope | Marker |
| --- | --- | --- | --- |
| 1 | Structured addresses | Country > State/Region > LGA > City pickers (searchable), levels per country (Nigeria shows State + LGA + City; Ghana/Kenya region only); geo IDs stored with street, postal code, details, recipient, phone; address book reused at checkout | **[DONE]** |
| 2 | Seller-grouped cart | Per seller: items, subtotal, discounts, shipping, total; grand total (items, shipping, total) before payment; needs-address, not-shipped, FREE and add-X-more messages; sellers that do not ship are excluded from totals and the order | **[DONE]** |
| 3 | Shipping engine | Rules with country/state/LGA zones, free destinations, free threshold; `POST /cart/shipping-quote {addressId}`; checkout recomputes and ignores client prices | **[DONE]** |
| 4 | Privacy & Data | `GET/PUT /users/me/consents` with `policyVersionId`, `GET /privacy/exports/latest`, `POST /privacy/exports`, `POST /privacy/deletion`, policy links | **[DONE]** |
| 5 | Interaction tracking | `trackProductInteraction` batches to `POST /analytics/product-interactions`; personalization events skipped when off; analytics off sends no events at all | **[DONE]** |

### 22.1 Notes

- Differences from backendPlan: the plan has no consents GET/PUT, no export-status GET and no city level in geo, so the mock uses `GET/PUT /users/me/consents`, `GET /privacy/exports/latest` and `GET /geo/admin-areas/:id/cities`. Cart groups use flat `storeName` and no `fees`/`taxes`/`badge`; the grand total is `itemsTotal`/`shipping`/`total` on `Cart` (no `grandTotal`/`currency`); quotes add `isFree`, `freeThreshold`, `amountToFreeShipping`. Consent keys are `essential` omitted (not toggleable), `analytics`, `personalization`, `advertising`, `marketing`.
- **[LATER]** Real geo dataset (all LGAs, cities), carrier rates, per-item weight rules, stored shipping on orders, real data-export job and deletion grace-period cancel.

## 23. Shipping config & web privacy **[DONE: mock]**

Mock mode only; `apps/mobile/**` and `services/**` untouched. Sellers ship themselves; ZudoMart validates and calculates. Shipping is priced per order group, never per item.

| # | Feature | Scope | Marker |
| --- | --- | --- | --- |
| 1 | Seller shipping rules | Delivery > Shipping rules (also Settings > Shipping): destination tree Country > State > LGA with select-all at each level, flat fee or free per destination group, free-shipping threshold, per-rule active toggle, live preview, per-order-group notice. Free plan (`shipping_rules`, minimum plan free) | **[DONE]** |
| 2 | Order shipping snapshot | Order detail shows destination, rule applied, and fee or free | **[DONE]** |
| 3 | Seller API contract | `apiContract.md` "Shipping configuration": ShippingProfile / ShippingZone / ShippingRule / ShippingDestination, `/seller/shipping/*`, `/seller/orders/:id/shipping-snapshot` | **[DONE]** |
| 4 | Marketing legal pages | `/privacy` and `/cookies` rewritten or added as DRAFTS with a "pending review by qualified legal counsel" notice and version and effective-date placeholders; `/terms` carries the same notice; footer links | **[DONE]** |
| 5 | Cookie consent | `@zudomart/web-kit` banner, `useConsent(category)`, `ConsentGuard`; first-party cookie with policy version; signed-in choices POST to a mock consents endpoint; mounted in web, webapp, studio, seller, ads, admin | **[DONE]** |
| 6 | Webapp Privacy & Data | `/settings` hub and `/settings/privacy` mirroring mobile; settings link restored on the profile | **[DONE]** |

### 23.1 Notes

- Resolution order: the most specific matching active rule wins (LGA, then state, then country); a free rule gives free shipping; otherwise a free threshold at or above the order group subtotal gives free shipping; otherwise the flat fee. No match means the address cannot check out.
- The consents endpoint is `POST /bff/api/v1/consents` in webapp and studio. The seller, ads and admin gateways only allow their own namespaces, so those apps use `/bff/seller/consents`, `/bff/ads/consents` and `/bff/admin/consents`.
- Policy text is a draft and makes no compliance claim. Retention periods, the processor list, the cookie inventory and the legal entity details are marked for the team and counsel to fill in.
- **[LATER]** LGAs for the remaining states, carrier rates, per-item weight rules, snapshot stored on the order at checkout by the real backend, optional scripts (analytics and advertising SDKs) wrapped in `ConsentGuard` once chosen, real consent storage and audit trail.


---

## 24. Live badge on stories and profile avatars **[DONE (mobile, mock)]**

- `UserSummary.live?: { liveId, startedAt } | null` (`types/models.type.ts`, `CreatorLiveStatus`). The backend fills it from go-live; Phoenix `livestream.started/ended` should invalidate cached summaries.
- Stories tray (`components/chat/storyTray.tsx`): live creators sort first and get a pulsing red ring with a LIVE pill (`components/live/liveAvatarRing.tsx`). Tapping opens `Live`, not the story.
- Story viewer (`screens/story/story.screen.tsx`): when the author is live, a "LIVE · Watch" pill in the header replaces the viewer with the livestream.
- Profile (`components/profile/profileSummary.tsx`): the avatar gets the LIVE ring and opens `Live` on tap.
- Rules: live beats story; the pulse is off under reduced motion; the mock hides `live` on private profiles for non-followers (`mocks/users.mock.ts`). Hosts are mapped in `mocks/activeLives.mock.ts`.
- **[LATER]** the badge on feed and post authors, search, followers lists and the chat header; a lock and subscribe prompt for subscriber-only lives; realtime invalidation.


---

## 25. Chat privacy, spam, links & streaks (mobile) **[DONE (mobile, mock)]**

Mock mode only; `services/**` and the web apps untouched. Real Signal-protocol encryption (libsignal, per-device keys) stays **[LATER]**: the app only carries the placeholder fields and shows the notice.

| # | Feature | Scope | Marker |
| --- | --- | --- | --- |
| 1 | Inbox folders | Dropdown Chats / Requests / Spam. Requests: Accept, Delete, Block; read receipts hidden and `read` not sent until accepted. Spam: server-flagged by sender behaviour metadata only, never content; "Not spam" moves the chat to Requests | **[DONE]** |
| 2 | Chat settings | Request audience Everyone / People I follow / Followers / Nobody (server enforced); device passcode 4-6 digits + biometrics + auto-lock (device only, forgot = re-login); 30-day media notice; blocked accounts (same list as profiles); push toggles + message preview; per-chat mute | **[DONE]** |
| 3 | Media expiry | `mediaExpiresAt = sentAt + 30d`; expired media renders "Media expired"; text stays | **[DONE]** |
| 4 | Link previews | Built on the sender, stored on the message. Warning sheet before opening shortened or suspicious domains; never auto-open. Internal links render permission-aware cards | **[DONE]** |
| 5 | Share to chat | "Send in chat" sheet with multi-select and note; rich card message; share count increments | **[DONE]** |
| 6 | Streaks | 1-to-1 only; +1 when both send on their own local day; hourglass at 4h left; break resets to 0; restores 3/month (Premium 6), 48h window, either person restores for both; milestones every 100 days | **[DONE]** |
| 7 | E2EE placeholders | `Message.encryption { deviceId, ciphertext, protocol: "signal-v1-pending" }`; "Messages are end-to-end encrypted" in conversation info and settings | **[DONE: notice only]** |

### 25.1 Mock contract

| Method + path | Request | Response |
| --- | --- | --- |
| `GET /conversations?folder=chats\|requests\|spam&filter=` | | `Conversation[]` with `inboxFolder`, `spamReason`, `streak`, `mutedUntil`. Requests from senders outside the viewer's audience are hidden |
| `POST /conversations/:id/accept` | | `Conversation` (moves to Chats, receipts enabled) |
| `DELETE /conversations/:id` | | void |
| `POST /conversations/:id/block` | | void; adds the peer to the shared block list (`/users/me/blocked`) |
| `POST /conversations/:id/not-spam` | | `Conversation` (to Requests) |
| `PUT /conversations/:id/mute` | `{ duration: "8h"\|"1w"\|"always"\|"off" }` | `{ mutedUntil }` |
| `GET/PATCH /chat/settings` | `{ messageRequestsFrom, notifications { messages, requests, groups, streakReminders, showMessagePreview } }` | `ChatSettings` |
| `POST /conversations/:id/messages` | `{ text, kind?, linkPreview?, sharedContent? }` | `Message` with `mediaExpiresAt`, `encryption`. 403 when the peer's audience rejects a new request |
| `GET /link-previews/resolve?url=` | | `LinkPreview { url, domain, title, description, imageUrl }` (lookup table, fallback domain-only) |
| `GET /chat/content?kind=&id=` | kind: post, clip, product, live, store, profile | `SharedContentCard { availability: available\|private\|unavailable, title, subtitle, imageUrl, priceLabel, stock, isLive, viewerCount, followsAuthor }` |
| `POST /chat/shares` | `{ conversationIds, reference { kind, id }, note }` | `{ sentCount, shareCount }` |
| `POST /conversations/:id/streak/restore` | | `ChatStreak`; 403 when no restores are left, 409 outside 48h |
| `POST /conversations/:id/streak/celebrated` | | void |

`ChatStreak`: `count`, `state` (none, active, broken), `hourglass`, `secondsUntilMyDayEnds`, `sentToday { me, peer }`, `restoresRemaining`, `restoresPerMonth`, `restorableUntil`, `countBeforeBreak`, `milestoneDays`, `milestoneCelebrationPending`.

### 25.2 Notes

- Spam scoring (`mocks/chatInboxState.mock.ts`): recipients in the last hour >= 50, or account under 3 days with >= 20 recipients, or duplicate-message ratio >= 0.8. Production: the Python service scores behaviour metadata and the chat service decides.
- Streak days use each user's saved timezone (`savedTimezoneByUserId`). Restores reset on the 1st local, no carry-over. Premium = the user subscription (`verification.tier === "PREMIUM"`); seller Pro does not count (open question kept at the recommended answer).
- The passcode is salted SHA-256 in `expo-secure-store` and never leaves the device. Auto-lock fires when the app returns from background after the chosen delay.
- Seeds: `c_1` is at 99 days (send once to hit 100 and see the celebration), `c_3` is broken with a restore available, `c_req_*` are requests, `c_spam_*` are spam, `c_1` has expired and fresh media plus every link type.
- **[LATER]** libsignal sessions and per-device keys, server-side 30-day media purge, push delivery honouring mute and preview settings, group streaks (open), timezone change rate-limit.

### 25.3 Attachments: location, documents, polls (mock contract)

Message `kind` gains `location`, `liveLocation`, `document` and `poll`. Entries in the plus menu never show "Coming soon"; each opens a working flow.

| Method + path | Request | Response |
| --- | --- | --- |
| `POST /conversations/:id/messages` | `{ kind: "location"\|"liveLocation", location { latitude, longitude, address, liveUntil? } }` | `Message` with `location { ..., updatedAt }` |
| `POST /conversations/:id/messages` | `{ kind: "document", document { fileName, mimeType, sizeBytes, pageCount?, url } }` | `Message` with `document` and `mediaExpiresAt = sentAt + 30d` |
| `POST /conversations/:id/messages` | `{ kind: "poll", poll { question, allowMultipleAnswers, options: string[] } }` | `Message` with `poll { question, allowMultipleAnswers, options[ { id, text, voteCount, votedByMe } ] }` |
| `PATCH /messages/:id/location` | `{ latitude, longitude, address }` | `Message`; 409 once `liveUntil` has passed |
| `POST /messages/:id/live-location/stop` | | `Message` with `location.liveUntil = now` |
| `POST /messages/:id/poll-votes` | `{ optionId }` (toggles; single-answer polls move the vote) | `MessagePoll` |

- Location: first use shows "Your location is shared only with this chat" (consent kept on the device). Choices: send current location, or live for 15 min / 1 h / 8 h. Denied permission shows an explanation; permanently denied links to Settings. The address comes from `expo-location` reverse geocoding. Live updates go out every 15 s while the app is foregrounded (timers in `liveLocationSharing.service.ts`); the bubble shows "Live until 14:30" with "Stop sharing" for the sender and "Live location ended" afterwards, including after an app restart (the timer does not survive it).
- Map: static OpenStreetMap tiles (2x2 grid, zoom 15) with a pin and the required "© OpenStreetMap" credit. `react-native-maps` is not installed. "Open in maps" uses `maps.apple.com` (iOS), `geo:` (Android) or Google Maps (web). "Copy address" copies the address or the coordinates.
- Documents: `expo-document-picker`, type allowlist (PDF, Word, Excel, PowerPoint, txt, zip, jpg/png/webp/heic as files), 100 MB cap. The bubble shows a typed badge, name, size and PDF page count (counted on the device for PDFs up to 20 MB). Upload progress, cancel, Retry and Discard use the optimistic sender pattern (`optimisticDocumentSender.hook.ts`). Upload is simulated in mock mode (`documentUpload.service.ts`). Tap offers Open (system share/view sheet via `expo-sharing`) or Save (folder picker). After 30 days the bubble reads "File expired".
- Polls: 2 to 6 options, unique, optional multiple answers; tapping an option votes or unvotes.
- Seeds in `c_1`: a location, a live location (45 min left), a PDF, an expired XLSX and a poll.
- **[LATER]** server-side live location fan-out and purge, real document upload through the media service, background live location (needs a background-location review), poll closing.

---

## 26. Webapp tablet/desktop, dark mode & saved **[DONE (webapp, mock)]**

Scope: `apps/webapp` only. Theme plumbing comes from `@zudomart/web-kit` (`ThemeProvider`, `ThemeSwitcher`, `ThemeInitScript`, `theme` cookie) and dark values from `@zudomart/design-tokens`. Files are listed in [CHANGELOG.md](./CHANGELOG.md) under apps/webapp.

### 26.1 Layouts

| Width | Navigation | Content | Right rail |
| --- | --- | --- | --- |
| < 768 | top bar with search, bottom bar (Home, Mart, Clips, Chats, Me) | single column | none |
| 768–1023 | 76px icon rail; the toggle opens a labelled overlay drawer (Esc or scrim closes it) | single column; two panes on Messages and Orders | none |
| ≥ 1024 | 232px labelled sidebar (Home, Explore, Mart, Clips, Live / Messages, Notifications, Orders, Saved / Creator, Profile, Settings) with a collapse toggle remembered in `localStorage` | per-route width (`shellLayout.config.ts`): reading 680px, wide 1240px, full | home, post and notifications from 1024; explore, mart and profile from 1280 |

- Right rail modules: wallet and coins, who to follow, trending in Nigeria, cart summary on mart pages. Guests only see trending and who to follow.
- Two-pane routes use nested layouts with `useSelectedLayoutSegment`: `/chats` (list + conversation) and `/orders` (list + detail). On phones, the list and the detail stay separate pages.
- Product detail: the gallery has vertical thumbnails on desktop and the buy box is sticky. Cart and checkout group items by seller and show a sticky seller-grouped summary. Checkout never asks for an email: the server uses the account's verified email for the payment provider and receipts. When the account email is unverified, the pay button is replaced by "Verify your email to continue", which links to `/verify-email` (§26.6).
- Profile: cover, overlapping avatar header, stats, then Posts / Media tabs (3-column media grid) and a Saved shortcut on your own profile.
- New routes: `/mart`, `/clips` (snap feed, one clip per screen, j/k and arrow keys, desktop action column), `/watch/[videoId]` (16:9 player, Up next rail, comments), `/live` (live grid), `/post/[postId]` (post + read-only comments), `/saved`.
- Pointer and keyboard: hover states, `:focus-visible` rings from `--focus-ring`, tablists with arrow keys, `--control-*` sizes (32–36px on fine pointers, 44px on coarse). Skeleton, empty and error states use the web-kit kit.

### 26.2 Dark mode

Follows [darkModePlan.md](./darkModePlan.md) step 4. The root layout reads the `theme` cookie, sets `data-theme` on `<html>` server-side and mounts `ThemeInitScript`. `AppProviders` wraps everything in `ThemeProvider` and PATCHes `users/me/preferences { theme }` when signed in. The switcher sits in Settings → Appearance and in the avatar menu.

- Raw `--blue-*` and `--yellow-*` ramps and hex values in webapp CSS modules are mapped to semantic tokens (`--color-brand`, `--color-brand-solid(-hover)`, `--color-brand-tint`, `--color-border-strong`, `--color-inverse`, `--color-warn-text`, `--color-overlay`). `pnpm lint:styles` reports no `color-no-hex` in the webapp. The one exception is `ui/phoneFrame` device artwork, kept with an inline disable. The auth brand panel keeps its navy gradient in both themes.
- Status colours on text use the `-text` variants. Media is never filtered.
- Every main route was screenshotted at 768, 1024 and 1440 in light and dark.

### 26.3 Saved (bookmarks)

The contract matches §27.1 (mobile). The webapp extends it in three ways:

| Method + path | Request | Response |
| --- | --- | --- |
| `POST /api/v1/saves` | `{ type, targetId, collectionId? }` | `SavedItem` |
| `DELETE /api/v1/saves?type=&targetId=` | | void, idempotent |
| `GET /api/v1/saves?type=all\|post\|video\|clip\|product&collectionId=&cursor=` | | `{ data: SavedItem[], nextCursor }`, 12 per page, newest first |
| `GET /api/v1/saves/collections` | | `SaveCollection[] { id, name, itemCount, coverUrl }` |
| `POST /api/v1/saves/collections` | `{ name }` (1–40 chars) | `SaveCollection` |
| `PATCH /api/v1/saves/:saveId` | `{ collectionId \| null }` | `SavedItem` |

- `SavedItem.preview { title, thumbnailUrl, href, author, price, durationSeconds }` lets the grid render without fetching each target. The backend (or the gateway) should compose it.
- Toggles: post cards (Figma `bookmarkSimple24`, with a filled variant), the watch view, the clips action column and the product buy box. They are optimistic, with a toast ("Post saved · View saved") and rollback plus an error toast on failure.
- `/saved`: tabs All / Posts / Videos / Clips / Products, collection chips with counts, "New collection", a per-card collection picker, infinite scroll, and empty states that link to the right surface. It is linked from the sidebar, the avatar menu, the profile header and tabs, and Settings.
- Mock: `mocks/saveState.mock.ts` holds the saved set. Feed, clip, video and product responses read `bookmarked` from it. The legacy `POST products/:id/bookmark` writes to the same list. Landscape video posts (`mocks/videos.mock.ts`, Blender open movies, CC BY) are mixed into the feed.
- **[LATER]** rename and delete collections; bulk remove; backend module (`go.social` saves keyed by user, type and target).

### 26.4 Guest browsing

Anyone can browse without signing in: home (popular feed fallback, `GET /feeds/popular`), explore and search, mart, product, category, collection, store and brand pages, public profiles, post detail with read-only comments, clips, watch and live.

- `config/guestBrowsing.config.ts` owns two allowlists. Pages: the proxy lets anonymous requests through. Everything else (messages, notifications, orders, checkout, cart, wallet, creator, settings, `/me`, saved) still sends the visitor to `/login?next=`. API reads: the BFF forwards anonymous public GETs without a token, and `server/anonymousViewerFields.service.ts` forces viewer fields (`liked`, `bookmarked`, `isFollowing*`, `savedByViewer`, `reactedByMe`, `isSubscribed`) to `false`.
- Every action goes through `requireAuthThen(action, reason)` (`components/auth/authPrompt.store.ts`): like, save, follow, message, add to cart and buy are wired today. Signed-in viewers run the action immediately. Guests get `AuthPromptModal`, a native `<dialog>` with an inline sign-in form and links to `/login?next=` and `/signup?next=`. After an inline sign-in the page refreshes and the pending action replays once, held in memory only.
- A 401 (`UNAUTHENTICATED` or `SESSION_EXPIRED`) on a mutation opens the same prompt instead of a hard redirect. For guests, the shell skips badge, cart, wallet and notification queries, and the sidebar shows only the browse group.
- **[LATER]** give the guest home a sign-up banner; add SEO metadata to public pages.

### 26.5 Web actions (parity with mobile)

All of these go through `requireAuthThen`. Guests can read comments and watch lives.

| Action | Surface | Contract |
| --- | --- | --- |
| Comments (threaded) | post detail, watch view | `GET /posts/:id/comments` (with `previewReplies`), `GET /comments/:id/replies`, `POST /posts/:id/comments { text, parentCommentId?, mentions[] }`, `POST/DELETE /comments/:id/like`, `DELETE /comments/:id` (own only) |
| Send in chat | "More" menu on posts, clips, videos, lives, profiles; Share on product | `POST /chat/shares { conversationIds (1–20), reference { kind, id }, note }` returns `{ sentCount, shareCount }` (§25.1) |
| Report | "More" menu, comment rows | `POST /reports { targetType, targetId, reason, details }` |
| Live gifts | `/live/[liveId]` | `GET /gifts`, `POST /lives/:id/gifts { giftId, quantity }`. A `402 INSUFFICIENT_COINS` response opens the coin store |
| Buy coins (web) | coin store dialog | `GET /coins/packages?channel=web`, `POST /coins/purchases { packageId, channel: "web" }` returns `{ reference, checkoutUrl }` (redirect to the Flutterwave hosted checkout link). `/coins/return?reference=` shows "Confirming payment…" until `POST /coins/purchases/:ref/verify` reports `succeeded`. Production confirms only from the `collection.succeeded` webhook (checkoutPaymentFlowPlan §6–8) |
| Subscribe to creator | visitor profile (only when the creator has plans) | `GET /creators/:id/subscription-plans` (public), `POST /creators/:id/subscriptions { planId }` returns `{ subscriptionId, checkoutUrl }` (Flutterwave). `/subscriptions/return` polls `GET /subscriptions/:id` |

In mock mode the checkout URLs point straight at the return pages.

### 26.6 Email verification

`/verify-email?next=`: send a code (`POST /users/me/email/verification` returns `{ expiresIn, resendAfterSeconds }`), enter the 6-digit OTP (`POST /users/me/email/verification/confirm { code }` returns `{ email, emailVerified }`), then return to `next`. `GET /users/me/email` reads the status. The checkout gate reads it and links to `/verify-email?next=/checkout`. The client never sends an email address. In the mock, the demo seller is verified and the fan account is not.

### 26.7 @mentions (web)

Follows §31; the web changes no part of the contract.

- Comment composer: typing `@` opens a combobox fed by `GET /mentions/candidates?surface=comment&q=` (ranked following, recent, other). People who don't allow mentions are greyed out with "Doesn't allow mentions" and can't be picked. Arrow keys, Enter or Tab, and Esc work. The composer shows `n/20 mentions`. For guests, focusing the input runs `requireAuthThen`.
- Entities follow §31.2: `{ userId, username, start, length }` or `{ type: "all", start, length }`, sent as `mentions` on `POST /posts/:id/comments`. The mock re-checks bounds, overlaps, blocks, suspended users and `whoCanMentionMe`, and returns `422 TOO_MANY_MENTIONS` above 20.
- Rendering (`MentionText`): usernames are re-resolved through `POST /mentions/resolve`, which is public for guests. Active users link to their profile, `deleted` shows a "User not found" toast, `suspended` renders as plain text, and `@all` renders as a non-tappable pill.
- Settings → Privacy & data → "Who can mention me" (`everyone`, `following`, `no_one`) uses `GET/PUT /users/me/mention-privacy`.
- **[LATER]** composer and mentions for posts and group chats on web, since the web has neither yet.

---

## 27. Saved items & dark mode (mobile) **[DONE (mobile, mock) / dark mode BETA]**

### 27.1 Saved items

`docs/backendPlan.md` had no saves contract (only `products/:id/bookmark`), so it is defined here. There was no wishlist or collections feature to reuse; the old product bookmark route now writes the same saved list.

| Method + path | Request | Response |
| --- | --- | --- |
| `POST /api/v1/saves` | `{ type: "post"\|"video"\|"clip"\|"product", targetId }` | void, idempotent; 422 on an unknown type |
| `DELETE /api/v1/saves?type=&targetId=` | | void, idempotent |
| `GET /api/v1/saves?type=&cursor=` | `type` optional (All) | `{ data: SavedItem[], nextCursor }`, newest first, 12 per page |

`SavedItem`: `{ id, type, targetId, savedAt }` plus `post` (post, video), `clip` or `product`. Feed, post, clip and product responses carry the viewer's state (`bookmarked`, `savedByViewer`). A post with any video media saves as `video`. Saves are private.

- Surfaces: post card action row (Figma `bookmark-24`, right of the row next to share, as in Figma "Frame 735"), reels rail, full-screen video viewer, product detail. Optimistic, haptic, reduced-motion aware.
- Saved screen: own-profile shortcut and Settings row.
- **[LATER]** backend module (`go.social` saves table keyed by user, type, target), named collections, removing a save from the Saved grid by long press.

### 27.2 Dark mode

Follows Figma (owner decision, 2026-10-03): the mobile dark palette comes from Figma node `874:5002` ("Profile for Normal User (Dark Mode)"), the only dark frame in the specs. `packages/designTokens` keeps its navy dark values for web; mobile no longer uses them for neutrals.

| Token | Light (unchanged) | Dark | Source / check |
| --- | --- | --- | --- |
| background / surface | `#F7F8FE` / `#FFFFFF` | `#0E0E10` / `#2C2C2C` | Figma |
| elevated (sheets, menus) / sunken | `#FFFFFF` / `#F7F8FE` | `#3A3A3D` / `#1A1A1D` | derived greys |
| divider / placeholder / chip / skeleton / avatar | `#D9D9D9` … | `#3D3D40` / `#3A3A3D` / `#3A3A3D` / `#38383B` / `#48484B` | derived greys |
| text | `#000000` | `#FFFFFF` | Figma; 14.0:1 on surface |
| textMuted (Figma `@username` `#5B5B5B`) | `#5B5B5B` | **`#B3B3B3`** | lightened: Figma value is 2.8:1 on canvas; now 6.7:1 on surface, 5.4:1 on elevated |
| textSubtle (Figma metadata `#909090`) | `#909090` | **`#A6A6A6`** | lightened: Figma value is 4.4:1 on surface; now 5.7:1 on surface, 7.9:1 on canvas, 4.7:1 on elevated |
| primarySolid (fills) / onPrimary | `#2043F5` / `#FFFFFF` | `#2043F5` / `#FFFFFF` | Figma "Follow" button; 6.6:1 |
| primary (blue text, links, icons) | `#2043F5` | `#7A8DF9` | Figma has no blue text in dark; `#2043F5` text is 2.1:1 on `#2C2C2C`. **Needs design confirmation** |
| accent yellow | `#F5E320` | `#F5E320` | unchanged |
| error / success / caution | palette 500 | `#F87171` / `#34D399` / `#FBBF24` | ≥ 5:1 on surface |

- Switch: Settings → App Preference → Theme: Light (default), Dark **Beta**, System. Stored in SecureStore (`zm.themePreference`), PATCHed to `users/me/preferences.theme`.
- `app.json` stays `userInterfaceStyle: "light"`: the main flows are migrated in code but dark mode has not been checked on a device. `ThemeProvider` calls `Appearance.setColorScheme` so native chrome follows the in-app choice. Flip to `"automatic"` (and add an `expo-splash-screen` `dark` block) after visual QA and sign-off.
- Live, Live ended, Story, Clips and the Create composer stay on their current look in both themes (`ForcedColorSchemeScope`).
- Coverage (`node apps/mobile/scripts/reportThemeCoverage.mjs`): before, 262 non-dark-first files built their styles from static `colors`; now 279 of 290 UI files use the theme, **0** static `colors` references inside `StyleSheet.create`, 14 static references left (light-only maps in three status pills, the dark-screen nav option), 24 raw colour literals left in styles (mostly scrims over media and the camera stage, intentionally fixed). 65 dark-first files are excluded.
- **[NEXT]** visual QA in both themes with screenshot diffs to prove zero light-mode change; Create composer in dark; dark variants for `toneTextColor` dots and chart series; sync the server preference on sign-in.

---

## 28. Guest browsing (mobile) **[DONE (mobile, mock)]**

Owner rule: anyone who downloads the app can use the public parts without registering or logging in. Trying an action sends them through sign-in and back to exactly where they were, with the action completed when possible. The webapp equivalent is §26.4.

### 28.1 Flow

- Fresh install: splash, then onboarding with **Browse first** under the sign-in options. It sets `useGuestSessionStore.isBrowsingAsGuest` (memory only) and `RootNavigator` mounts the main app with no session. After a sign-out the user sees onboarding again.
- Auth lives inside the main stack as the `AuthFlow` screen (a full-screen modal wrapping the auth stack, opened at Onboarding with `mode` and a "Not now" button). The main navigator stays mounted underneath, so scroll position and route survive sign-in.
- `requireAuthThen(action, returnTo?, reason?)` (`utils/requireAuth.util.ts`, hook `useRequireAuth`): signed in runs the action at once. A guest stores `{ action, returnTo }` in `pendingAuthIntent.store.ts` (memory only, never persisted) and opens `GuestAuthSheet` (Continue with Apple / Google, Sign in, Create account). `returnTo` defaults to the focused route and its params.
- `GuestAuthReplayCoordinator` waits for the status to become signed in, closes `AuthFlow`, invalidates all queries (viewer fields refresh), refreshes tracking consents, navigates to `returnTo` if the user is elsewhere, then replays the action once. Dismissing the sheet or leaving `AuthFlow` without signing in discards the intent.
- `requireAuthAfterClosingModal` closes a sheet first (a native modal cannot open over another one) and then prompts.
- Auth-only routes render `SignInRequiredScreen` ("Sign in to see your orders") through the navigators' `screenLayout`, so their queries never run for guests. The Profile tab shows `GuestProfileCard` (sign in, create account, appearance and region, about and legal, usage analytics opt-in). The Create tab asks for sign-in instead of opening the composer. The feed shows a dismissible "Sign in to like, follow and shop" banner.

### 28.2 Routes

| Public (no token) | Auth-only (sign-in screen or prompt) |
| --- | --- |
| Home For you feed, Clips, Search, Category, Mart | Chats tab, Chat, NewMessage, NewGroup, ConversationInfo, chat settings |
| ProductDetail, ProductReviews, Store, BrandProfile | Notifications |
| UserProfile, Connections, Story | Create tab, CreatePost (posts, clips, go live), PostAnalytics, PromotePost, BoostStatus |
| PostDetail with read-only comments, Sound, Rankings | Wallet, Transactions, CoinActivity, Withdraw, PayoutAccounts, StoreRewards |
| Live and LiveEnded (watch, read chat) | Cart, Checkout, Payment, OrderSuccess, Orders, OrderDetail, OpenDispute, EscrowStatus, DisputeDetail |
| SettingsAppPreference (appearance, region), SettingsAbout (legal) | Me tab content, EditProfile, Saved, Settings and every other settings screen, Verification, Support tickets |
| | Seller screens, Creator screens, CreatorSubscribe, MySubscriptions, CreateBrand, CreateBusinessProfile, FollowRequests |

Actions wired to `requireAuthThen`: like (post, clip, comment, product, live reaction), comment (post, clip, live), follow (creator, user, shop, brand, live host), save and bookmark, reshare, share to chat, gift (live and battle), join as live guest, add to cart, message, report, block, subscribe, save sound, go live and create (Create tab, route gate), the Following feed tab. The cart is not local for guests: add to cart needs an account.

The source of truth for routes is `config/guestAccess.config.ts`.

### 28.3 Services, mocks and consents

- The client sends no `Authorization` header without a token. A 401 on a **mutation** opens the sign-in sheet; a 401 on a read is returned silently (queries do not retry a 401), so no screen shows an error page for private data. Guests do not fetch the cart.
- Mock layer (`mocks/guestAccess.mock.ts`): a guest request is allowed only for the public GET list, `auth/*`, and a few anonymous write-only calls (live join and leave, ad events, product interactions, feed feedback, story seen, post share, device preferences). Everything else throws `ApiError(401)`. Responses for guests have `liked`, `isFollowing`, `isFollowingAuthor`, `isFollowingHost`, `savedByViewer`, `bookmarked` and `following` forced to `false`. `feeds/for-you` returns the most popular posts for guests. The topic row uses `GET /topics`.
- Consents: guests send **essential-only** analytics. `trackProductInteraction` and sponsored impressions and clicks are dropped until the guest turns on "Allow usage analytics" in the guest profile card (memory only today). Personalisation, advertising and marketing stay off. Signing in reloads the account's stored consents.

### 28.4 Backend requirement

- Every endpoint behind a public screen must accept **anonymous requests** (no `Authorization`): the GET list in `mocks/guestAccess.mock.ts`, plus `POST lives/:id/join|leave`, `POST ads/events`, `POST analytics/product-interactions` (honouring consent), `POST feeds/feedback`, `POST stories/:id/seen`, `POST posts/:id/share`, `POST lives/:id/engagement`.
- Anonymous requests are **rate-limited by IP and device** (`X-Device-Id` or the existing `X-Client-Region` plus IP), with stricter limits on search and feeds, and cached at the edge where the response is viewer-independent. Responses must set viewer fields to `false` and never include blocked-user, private-account or own-state data.
- `GET /feeds/for-you` without a token returns the popular feed (the webapp calls it `GET /feeds/popular`; pick one). Anonymous 401 is `{ code: "UNAUTHENTICATED" }`; expired sessions keep `SESSION_EXPIRED`.
- **[LATER]** persist guest analytics consent on the device and send it with anonymous event calls; local guest cart merged on sign-in; guest sessions remembered across launches; deep links open the target and prompt only on action.

---

## 29. Trust, verification & support (mobile) **[DONE (mobile, mock)]**

> **Creator = personal account upgrade (owner, 2026-10-03).** A creator account is the user's personal account turned into a creator account, not a separate profile. Profile types are Personal, Business/Brand and Government; `creatorStatus` (`none|pending|approved|rejected`) lives on the Personal profile and is set to `approved` when the Creator Program application is approved. It unlocks Creator Studio, going live, monetisation and earnings. Blue applies to the Personal profile whether or not it is creator-enabled.

Spec: owner trust/verification/admin bullets and "Decided 2026-10-03". Mobile only, mock mode. Defaults below are admin-editable on the backend.

### 29.1 Suspended accounts

- `account.status` is `active | suspended | deactivated` on `UserSummary`. Mock suspended users: `u_16`, `u_22`. Log in with an identifier containing `suspended` (for example `suspended.zudomart@gmail.com`) to be the suspended user.
- Profile: `SuspendedProfileState` (greyed avatar, "This account is suspended", Learn more to the community guidelines link). No posts, tabs, follow or message buttons.
- Chat: header `SuspendedBadge`, composer replaced by "You can't message this account", history stays visible (mock conversation `c_susp`).
- Hidden from search, suggestions, connection suggestions, ranking lists and feeds; `GET /users/:id/posts` returns an empty page.
- The suspended user sees `SuspendedAccountScreen` instead of the app: reason, date, "Appeal this decision" (creates an `account` support ticket), Download my data (existing export section), the 120-day deletion notice (profile, posts, media and messages deleted; financial and order records kept, anonymised, for the legal period) and Log out.
- Python may only suggest suspensions; an admin decides.

### 29.2 Checkmark suggestions

- Cards "You may qualify for a verified checkmark" on Settings and the own-profile shortcuts, shown only when `eligible && !dismissed` and only for the active profile's colour: Personal (including creator accounts) gets Blue, Business and Brand get Gold, Government gets Black (never suggested). Blue never shows on a business and Gold never on a person. Badges render from the profile (`verificationForProfileKind`, `VerificationBadge` rejects a colour that doesn't match its profile type), never from the account.
- Blue (Personal, incl. creator accounts): Apply opens `VerificationApply` (ID check, then a mock in-app purchase sheet, no real StoreKit). Not now dismisses.
- Gold (Business/Brand): not sold in the app. The card, the Verification screen and "Verify brand" show "Manage on the web", which opens dashboard.zudomart.com billing in an in-app browser. No prices, price links or discounts anywhere in the app. Status reads "Gold after business verification" until KYB is approved.
- Black (Government profiles only): "Apply for government verification" opens the web application flow.
- Lapsed Black keeps its badge for everyone during the 14-day grace period (`graceEndsAt`); staff also see "Renewal due". Blue and Gold drop at period end.
- Blue rules: ID verified, account at least 90 days, at least 1,000 real followers, no violations in 90 days, no active checkmark yet. Gold rules: business verification passed, active store or brand, success rate at least 90%.

### 29.3 Creator Program

- `GET /creators/eligibility` now returns `decision` (`auto_approve | manual_review | not_eligible`) and `decisionNote`. Checklist: real followers (for example 720 / 1,000), account age 30 days, verified phone, 10 original posts in 60 days, no violations in 90 days. All met and ID verified with no risk flag is auto-approved (the application is stored as `approved`); all met with a risk flag or no ID goes to manual review; anything else is not eligible. Shown by `CreatorDecisionBanner` above `EligibilityChecklist`.

### 29.4 Business documents

- Store creation never waits for documents. `BusinessDocumentsScreen` (Settings for sellers) takes a CAC certificate, government ID and proof of address, each `not_uploaded | pending | approved | rejected` with the rejection reason. Uploads go to the admin review queue. `BusinessDocumentsNudge` shows on the seller dashboard and the owner's store page until all three are approved.

### 29.5 Help and support

- Help centre (`HelpCenter`, `HelpArticle`) with search; public for guests, contacting support is gated with `requireAuthThen`.
- Tickets: category, optional linked order or payment, screenshots. "Get help" on Order detail and Payment passes the link. List shows status and the link.
- Ticket thread is a live chat (3 s poll, typing indicator) with an admin agent labelled "Zudomart Support". A notice states it is not end-to-end encrypted and is recorded for quality and safety.

### 29.6 Marketing emails and usernames

- Privacy & Data: marketing toggle reads "Personalised picks from verified sellers, price drops, back in stock, weekly digest" with a frequency choice (weekly, only important, off). "Off" turns the marketing consent off. Emails go out through AWS SES, only to opted-in users and only about verified sellers.
- Usernames: the server returns `message` with the reason ("This username is reserved.") on availability checks, username change and register; the app shows it as is.

### 29.7 Mock contracts

| Method and path | Response |
| --- | --- |
| `GET /users/me/suspension` | `{ reason, suspendedAt, deletionScheduledFor, retentionDays }` (404 when active) |
| `GET /verification/suggestions` | `CheckmarkSuggestion[]` (`color`, `eligible`, `dismissed`, `headline`, `detail`, `rules[]`) |
| `POST /verification/suggestions/:color/dismiss` | 204 |
| `GET /creators/eligibility` | `{ eligible, decision, decisionNote, requirements[] }` |
| `GET /seller/business-documents` | `{ documents[], allApproved }` |
| `PUT /seller/business-documents/:kind` | body `{ fileUrl }`, returns the state, document becomes `pending` |
| `GET /help/articles?q=`, `GET /help/articles/:id` | `HelpArticle[]`, `HelpArticle` |
| `POST /support/tickets` | body adds `linkedReference: { kind, id, label } \| null` |
| `GET /support/tickets/:id` | adds `linkedReference`, `agentTyping` |
| `POST /support/tickets/:id/messages` | appends the user message; the mock agent replies after about 1.5 s |
| `GET/PUT /users/me/marketing-preferences` | `{ frequency: weekly \| important_only \| off }` |
| `GET /auth/username-available` | adds `message` |

### 29.8 Backend requirements and open items

- Server enforces: suspended users cannot post, message, follow or sell; suspended content is excluded from search, feeds and suggestions; deletion job at 120 days.
- Admin queue for business documents and creator manual reviews; support chat transcripts stored and audited.
- **[LATER]** real file upload for the appeal, email to the suspended user, web checkmark purchase after approval, push for document decisions.


## 30. Admin trust & support, seller trials & documents **[DONE (admin + seller, mock)]**

> **Creator = personal account upgrade (owner, 2026-10-03).** A creator account is the user's personal account turned into a creator account, not a separate profile. Profile types are Personal, Business/Brand and Government; `creatorStatus` (`none|pending|approved|rejected`) lives on the Personal profile and is set to `approved` when the Creator Program application is approved. It unlocks Creator Studio, going live, monetisation and earnings. Blue applies to the Personal profile whether or not it is creator-enabled.

Spec: owner trials/verification/admin bullets, "Decided 2026-10-03" and backendPlan §4.8. Mock mode; endpoints are in `apps/admin/apiContract.md` and `apps/seller/apiContract.md`, change log in docs/CHANGELOG.md.

### 30.1 Admin

- Suspensions: queue of risk-service suggestions plus user reports, approve (reason + note), dismiss, escalate; suspended list with a 120-day deletion countdown (profile, posts, media and messages deleted; order/payment records anonymised and kept), appeal queue, reinstate. Python never suspends. Every action needs step-up and is audited.
- Accounts: admin-created accounts bypass the reserved check and force a password change; lifetime free checkmarks respect profile type (Blue personal incl. creators, Gold business/brand, Black government, superadmin only). Reserved usernames manager already covered exact/prefix/pattern/confusables and the test box.
- Business documents review (CAC, ID, proof of address) and Black applications: four-item vetting checklist, two-admin maker-checker with step-up, handle reserved (kept on revoke), yearly re-verification reminders.
- Rules: checkmark suggestions, Creator thresholds, trial rules and yearly discount, and pricing (bundle 15%, cap 3, Gold-only NGN 3,000, Black NGN 50,000, Black grace 14 days).
- Support: live chat (recorded, not E2EE) and SES email with marketing consent and unsubscribe.

- Staff: first superadmin from the CLI only; then superadmins create superadmins and admins from the UI (step-up, second-superadmin approval setting default ON), and suspend or revoke any access with sessions killed. Admins never create or edit superadmins and can only grant permissions they hold.
- Permissions and departments: fine-grained `area:action` keys across the system, nine department templates plus custom roles, several roles per admin; the nav and buttons hide by permission and the mock BFF returns 403.
- Audit: staff id, departments, action, target, before/after, reason, IP, time; viewer with filters and CSV export; last actions on each staff page.
- User actions: restrict, suspend (120-day flow), ban (blocks re-signup by email, phone, device), delete (anonymise and retain financial records), reassign username (old owner gets an auto name; history kept). Each is gated, reasoned, audited and notifies the user.

- Username hold: a username given up is held 120 days. The reassign flow shows the release and available dates and lets `usernames:reassign` holders assign it anyway (reason, step-up, audited as "hold bypassed"). The reserved-usernames manager lists held names with dates.

### 30.2 Seller (web)

- Trial (7 days or 1 month) with card saved through Flutterwave, refunded verification charge, reminders at 3 and 1 day, one-tap cancel; eligibility comes from the server. Account email only, read-only.
- Per-business billing; "Blue + Gold bundle -15%" shown when Blue is active, yearly wins when it is bigger (no stacking); Gold-only plan card; Gold shows only after business verification.
- Business documents page and dashboard banner never block selling.
- Store switcher no longer clips at 390px (CSS fix, not browser-verified).

### 30.3 Open items

- Real Flutterwave hosted card setup and refund webhooks; SES delivery and unsubscribe handling; document upload through the media API.
- Eligibility signals (device, card, phone, risk score) come from the backend and Python; the mock uses seeded values.
- Bundle lapse at renewal when Blue ends needs a billing job.


## 31. Mentions (mobile) **[DONE (mobile, mock)]**

Spec: owner mention rules. Mobile only, mock mode. Typing `@` in a post, comment, reply, clip caption or group chat opens autocomplete; the app stores structured entities, never only text.

### 31.1 Rules

- Posts, comments, replies and clip captions: `@username` can tag anybody except users who blocked the author.
- Group chats: only current members, plus `@all` (notifies every member). Group setting `onlyAdminsCanMentionAll` (default `false`, admins toggle it in Group info, "Only admins can @all"); when on, non-admins cannot use `@all`.
- One-to-one chats: the app does not offer autocomplete; a mention of the peer is allowed and never notifies specially.
- Max 20 mentions per post, comment or message (`422 TOO_MANY_MENTIONS`); the composer shows `n/20 mentions` and blocks further picks.
- Privacy, Settings, Privacy, "Who can mention me": `everyone` (default), `following` (only people the target follows), `no_one`. A disallowed mention is stored as plain text (entity dropped), sends no notification, and the autocomplete greys the person out with "Doesn't allow mentions".
- Guests cannot compose: input focus runs `requireAuthThen`.

### 31.2 Entity format

Sent as `mentions` on `POST /posts` (`NewPostInput`), `POST /posts/:postId/comments` (`NewCommentInput`) and `POST /conversations/:id/messages`, and returned on `Post`, `Comment`, `Message`.

```json
[
  { "userId": "u_21", "username": "blessing.etim", "start": 6, "length": 14 },
  { "type": "all", "start": 30, "length": 4 }
]
```

- `start` and `length` are UTF-16 offsets into `text` and cover the `@` plus the label. The server validates bounds, de-duplicates overlaps and re-checks every rule above, returning only the entities that survived.
- Links use `userId`, so renames do not break them. Clients render the current username from the resolve endpoint.
- Rendering: highlighted in the theme primary colour; tap opens the profile, or shows a "User not found" toast when the status is `deleted`; `suspended` renders as plain text; `@all` renders as a pill and is not tappable.

### 31.3 Mock endpoints

| Method and path | Request and response |
| --- | --- |
| `GET /mentions/candidates?surface=post\|comment\|group&q=&conversationId=` | `{ candidates: [{ user: UserSummary, allowsMentions, rank: following\|recent\|other\|member }], everyone: { available, unavailableReason } \| null }`. Posts and comments rank following, then recently interacted, then others; groups return members only, and `everyone` is the first option (non-null only for groups). Excludes suspended users, the author and users who blocked the author. |
| `POST /mentions/resolve` | body `{ userIds }`, returns `{ [userId]: { username \| null, status: active\|suspended\|deleted } }`. Public for guests. |
| `GET/PUT /users/me/mention-privacy` | `{ whoCanMentionMe: everyone\|following\|no_one }` |
| `PATCH /conversations/:id` | accepts `onlyAdminsCanMentionAll` (admins only); `Conversation` returns it |

Notifications: each tagged user gets "X mentioned you in a post / comment / group"; `@all` gives other members "X mentioned everyone in a group". The mock adds them to `GET /notifications` for the tagged user (category `social`). The notifications screen has no filters yet, so there is no "Mentions" filter; add one with a `mention` kind when filters exist.

### 31.4 Backend requirements and open items

- Store entities as JSONB next to the text; fan out notifications from the outbox; resolve statuses in one batched query per page.
- Enforce block, privacy, membership, admin-only `@all` and the 20 cap on write; never trust client entities.
- **[LATER]** in-input highlighting while typing, one-to-one autocomplete, mentions in story replies and live chat, a Mentions notification filter.


### 31.5 Plain `@username` tags (3 Oct, mock)

- Any `@username` in user text is a link even with no entity (regex: boundary before `@`, 1-30 of letters, digits, `.`, `_`, trailing dots trimmed, not followed by more name characters; emails and URLs excluded). Entities still win. `@all` is never a link; outside groups it is plain text.
- Backend: add `GET /users/by-username/:username` returning `{ id }` (404 if missing; suspended users still return their id so the suspended-profile state opens). Reserve the exact username `all` at signup and rename. Mention suggestions: ranked following, followers, recent chats, then platform search, exact match first.
- Web route `/u/:username` redirects to `/user/:id`. Not yet covered: story reply bubbles, group chat web, webapp live chat and messages (no such surfaces or no MentionText yet).

## 32. Legal admin & policy versioning **[DONE (admin + web + webapp + mobile, mock)]**

Spec: owner rules. Superadmins create Legal admins; Legal admins manage the privacy policy, terms and other legal documents; all users get an email when privacy or terms change. Mock mode; endpoints are in `apps/admin/apiContract.md` ("Legal documents and policy versioning").

### 32.1 Admin

- "Legal" department template with `legal.documents.view|edit|publish` and `legal.notices.send`; superadmins hold every permission implicitly (checked centrally in UI, BFF and mock). Two demo Legal admins are seeded.
- Documents: Terms of Service, Privacy Policy, Cookie Policy, Community Guidelines, Seller Terms, Creator Program Terms, Ads Policy, Refund and Escrow Policy. Markdown editor with live preview; draft, in review, published, superseded.
- Each version has a number, change summary, effective date and a material-change flag. Publish needs a second Legal admin or a superadmin (never the author or submitter) and step-up. Side-by-side diff, full history, and rollback that creates a new draft version. Every action is audited with the admin's name.
- Material change: effective date defaults to 30 days later (editable), flagged for LEGAL REVIEW; a shorter notice needs an explicit "legal cleared it" confirmation.
- Policy updated email: drafted in the admin (subject, summary, "what changed" list generated from the diff, effective date, re-accept note), previewed, test-sent to the author, then queued to all users on publish. Preview shows recipient count, skipped bounces and suppressions, batch size and rate; progress page polls while sending.

### 32.2 Users

- apps/web: `/terms`, `/privacy`, `/cookies` plus `/community-guidelines`, `/seller-terms`, `/creator-terms`, `/ads-policy`, `/refund-escrow-policy` render the current version with version, effective date and a "View previous versions" list (`/legal-archive/{slug}/{version}`). Build-time mock data; the "Draft, pending legal review" notice stays until a version has `isReviewedByLegal`.
- apps/webapp and apps/mobile: dismissible "We've updated our Terms/Privacy Policy" banner with a summary sheet; for material changes a blocking re-accept screen after the effective date (Accept, Download my data, Delete account). Acceptance goes through `PUT /users/me/consents` with `policyVersionId`. Guests just read the latest documents.

### 32.3 Backend requirements

- Tables: `legal_documents(key)`, `legal_versions(id, document_key, version_number unique per document, status, body, change_summary, effective_at, is_material, created_by, submitted_by, published_by, published_at, rolled_back_from)`, `legal_notice_drafts(version_id, subject, summary, what_changed jsonb, reaccept_note)`, `policy_acceptances(user_id, policy_version_id, accepted_at, source, ip, user_agent)` with a unique key on user and version. Published versions are immutable; one open version per document.
- Maker-checker enforced in the service (publisher differs from author and submitter), step-up required, audit row per action with the admin's name.
- On publish write the version and an outbox row in one transaction; a worker expands recipients (all active users) in pages and enqueues SQS jobs of 50. Send through SES with a throttle at the account rate (start at 14 per second), idempotency key per user and version, retries with backoff. Transactional legal notice: ignore marketing consent but skip the SES suppression list, hard bounces and complaints, and record every skip. Webhooks (SNS) update the suppression table. Progress counters feed `GET /admin/legal/notices`.
- Material changes: `must_accept_by = effective_at`; clients ask for current versions and the user's acceptances; the API returns `428 POLICY_ACCEPTANCE_REQUIRED` for write calls after the date until accepted. Account deletion and data export stay available while blocked.
- Public `GET /legal/policy-versions/current` is cacheable; the web site rebuilds (or revalidates) when a version is published.

### 32.4 Open items

- ~~Render the draft preview with the `policyUpdated` template~~ Done: the admin preview uses `@zudomart/email-templates` (§34). Sending with it is part of the notifications worker.
- Real SES, SQS and SNS; real acceptance records; the web site still reads build-time mock data.
- Webapp/mobile banner dismissal is per device (webapp localStorage, mobile in memory). Not tested in a browser or on a device.


---

## 33. Referral and purchase loyalty/cashback removed; seller-funded store rewards (3 Oct 2026)

> **Referral and purchase loyalty/cashback removed (owner, 2026-10-03).** Reason: "we don't know how to pay for them".

- **Removed:** referral codes, links, invite-and-earn screens, referral attribution at signup and referral rewards; platform-funded loyalty points and cashback on orders and escrow release; loyalty tiers and redemption at checkout; the admin referral/loyalty/cashback revenue rules; the seller "Loyalty" settings page and per-customer point adjustments.
- **Kept:** ZudoPoints engagement and gift points on lives (leaderboards, rankings, streak points). They are non-monetary.
- **Seller-funded store rewards (owner, 2026-10-03).** A store can turn on "Store rewards" under Marketing: X% of order value back as store credit, with minimum order, max per order, expiry and an on/off switch. Credit is redeemable only at that store as a discount on a future order, never cash, never withdrawable. Earned after escrow release; reversed on refund. The seller sees outstanding liability. Mobile and webapp show "Store credit −₦X" in the checkout summary, a "Store rewards" list per store (balance, expiry) and "Earn X% back at this store" on product and store pages. Mock contracts: `apps/seller/apiContract.md` (Store rewards), `GET /api/v1/store-rewards/me` (buyer apps). Backend: per-store credit ledger in go-commerce (see `backendPlan.md`, Store rewards).

---

## 34. Email templates **[DONE (package + admin gallery, mock rendering)]**

Spec: owner (3 Oct 2026). Every email is branded, carries the company legal name and address, support contacts and app links, and covers every flow. Provider: AWS SES, sent by the TypeScript notifications worker.

### 34.1 Package `@zudomart/email-templates` (`packages/emailTemplates`)

- React Email (`react-email` 6.11, the successor of the now-deprecated `@react-email/components`) plus `@react-email/render` 2.1. Each template is a typed `defineEmailTemplate<Props>()` definition with a React component, a subject builder, a preheader, a plain-text version built from the same content blocks, catalogue metadata (category, kind, audience, trigger event, consent rule) and sample props.
- `renderEmail(templateKey, props, { locale, theme, timeZone, brand, links })` → `{ subject, html, text }`. `theme` is `auto` (light + `prefers-color-scheme` dark overrides, also `[data-ogsc]` for Outlook.com), `light` or `dark`. Defaults: `en-NG`, `Africa/Lagos`. The worker passes the per-recipient `unsubscribeUrl` (signed token) for marketing emails.
- Money is always `{ amountMinor, currency }`, formatted with `Intl` using the currency's minor digits. Nothing hardcodes ₦.
- Layout: 600 px table layout, inline styles, no JS, alt text on every image, colours from `@zudomart/design-tokens` (contrast checked for text and buttons; danger buttons use the AA-safe red in both themes), Inter with system fallbacks. Header: wordmark (CDN image from `ZUDOMART_EMAIL_LOGO_URL`, otherwise an HTML "z" tile + "zudomart" wordmark that renders everywhere), an optional mono reference (order, case, ticket number). Brand strip (blue with the yellow accent), hero with a tone eyebrow, content blocks, bulletproof button (table cell with `bgcolor` + React Email's MSO padding). Signature block: a progress "track" showing where the order or money is (Ordered → Paid → Shipped → Delivered → Complete; In escrow → Locked 24h → Available → Payout sent; dispute stages).
- Footer: app store links (badge images when `ZUDOMART_EMAIL_APP_STORE_BADGE_URL` / `..._PLAY_STORE_BADGE_URL` are set), social links, a "why you got this email" line, **Unsubscribe + Manage email preferences only on marketing emails**, Manage notifications on transactional, security and legal emails, Help Centre, support email (support@zudomart.com; see docs/emailAddresses.md), official App Store and Google Play badges, "we never ask for your password or code", © legal name and address.
- **OWNER TO FILL:** `ZUDOMART_COMPANY_LEGAL_NAME` and `ZUDOMART_COMPANY_ADDRESS` (placeholders render literally until set; `isBrandConfigComplete()` lets the worker refuse to send in production), the App Store id, social handles, and a hosted PNG wordmark + store badges on the CDN. `readEmailBrandFromEnvironment(process.env)` reads them.
- Marketing products are typed `VerifiedProduct` (`sellerVerified: true`) so only verified sellers and brands can appear.
- `pnpm --filter @zudomart/email-templates preview` renders every template (light, dark, text) into `packages/emailTemplates/previews/` (gitignored) with an `index.html`. `pnpm --filter @zudomart/email-templates test` runs the vitest suite (render in light and dark, footer/legal content present, unsubscribe only on marketing, money formatting, 4 plain-text snapshots).

### 34.2 Admin

- **Support → Email templates** (`/support/email-templates`, `support:email` or superadmin): searchable list grouped by category with a kind badge, trigger/audience/consent facts, a sandboxed `srcDoc` iframe preview with sample data, a light/dark toggle and a plain-text view. Rendered by the mock admin BFF (`GET /admin/email-templates`, `GET /admin/email-templates/:key/preview?theme=`).
- The legal notice draft and publish dialog now render the real `policyUpdated` template (subject, summary, "what changed", effective date, re-accept note → re-accept CTA) in light and dark via `POST /admin/email-templates/policy-updated/preview` (support or legal permissions; inputs validated).
- In production the admin CSP (`style-src` nonce) blocks the email's `<style>` inside the preview iframe, so the auto dark-mode and mobile media queries don't apply there; the Dark toggle renders the dark palette inline, so it still works. Not tested in a browser (no dev server run).

### 34.3 Catalogue

Kinds: transactional, security and legal emails ignore marketing consent (security and legal can't be turned off); marketing needs marketing consent and always includes unsubscribe. No referral or cashback emails (removed, §33).

| Key | Category | Trigger event | Audience | Type | Consent rule |
| --- | --- | --- | --- | --- | --- |
| `emailOtp` | auth | `auth.otp.requested` | Any user | Transactional (security) | Always (security) |
| `newSignIn` | auth | `identity.session.new_device` | Any user | Transactional (security) | Always (security) |
| `passwordChanged` | auth | `identity.password.changed` | Any user | Transactional (security) | Always (security) |
| `passwordReset` | auth | `identity.password.reset_requested` | Any user | Transactional (security) | Always (security) |
| `sessionsRevoked` | auth | `identity.sessions.revoked` | Any user | Transactional (security) | Always (security) |
| `twoFactorEnabled` | auth | `identity.mfa.enabled` | Any user | Transactional (security) | Always (security) |
| `verifyEmail` | auth | `identity.email.verification_requested` | Any user | Transactional (security) | Always (security) |
| `welcome` | auth | `identity.account.created` | New user | Transactional (transactional) | Always (account/transaction) |
| `orderCancelled` | orders | `commerce.order.cancelled` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `orderCompleted` | orders | `commerce.order.completed` | Buyer | Transactional (transactional) | On by default; user can turn off |
| `orderDelivered` | orders | `commerce.shipment.delivered` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `orderPlaced` | orders | `commerce.order.placed` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `orderShipped` | orders | `commerce.shipment.dispatched` | Buyer | Transactional (transactional) | On by default; user can turn off |
| `paymentConfirmed` | orders | `payments.charge.succeeded` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `refundIssued` | orders | `payments.refund.succeeded` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `sellerAccepted` | orders | `commerce.order.seller_accepted` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `sellerRejected` | orders | `commerce.order.seller_rejected` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `disputeOpened` | escrow | `escrow.dispute.opened` | Buyer and seller | Transactional (transactional) | Always (account/transaction) |
| `disputeResolved` | escrow | `escrow.dispute.resolved` | Buyer and seller | Transactional (transactional) | Always (account/transaction) |
| `disputeUpdate` | escrow | `escrow.dispute.updated` | Buyer and seller | Transactional (transactional) | Always (account/transaction) |
| `escrowAutoReleaseReminder` | escrow | `escrow.release.reminder (24h before)` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `escrowFundsProtected` | escrow | `escrow.hold.created` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `escrowReleased` | escrow | `escrow.hold.released` | Seller | Transactional (transactional) | Always (account/transaction) |
| `payoutFailed` | seller | `money.payout.failed` | Seller | Transactional (transactional) | Always (account/transaction) |
| `payoutScheduled` | seller | `money.payout.scheduled` | Seller | Transactional (transactional) | On by default; user can turn off |
| `payoutSent` | seller | `money.payout.paid` | Seller | Transactional (transactional) | Always (account/transaction) |
| `sellerFundsAvailable` | seller | `money.balance.available` | Seller | Transactional (transactional) | On by default; user can turn off |
| `sellerFundsLocked` | seller | `money.balance.locked` | Seller | Transactional (transactional) | On by default; user can turn off |
| `sellerLowStock` | seller | `catalog.inventory.below_threshold (daily digest)` | Seller | Transactional (transactional) | On by default; user can turn off |
| `sellerNewOrder` | seller | `commerce.order.paid (per seller group)` | Seller | Transactional (transactional) | Always (account/transaction) |
| `sellerOrderCancelled` | seller | `commerce.order.cancelled (per seller group)` | Seller | Transactional (transactional) | Always (account/transaction) |
| `documentsApproved` | seller | `verification.business_documents.approved` | Seller | Transactional (transactional) | Always (account/transaction) |
| `documentsReceived` | seller | `verification.business_documents.submitted` | Seller | Transactional (transactional) | Always (account/transaction) |
| `documentsRejected` | seller | `verification.business_documents.rejected` | Seller | Transactional (transactional) | Always (account/transaction) |
| `planPaymentFailed` | seller | `billing.invoice.payment_failed` | Seller | Transactional (transactional) | Always (account/transaction) |
| `planReceipt` | seller | `billing.invoice.paid` | Seller | Transactional (transactional) | Always (account/transaction) |
| `planTrialConverted` | seller | `billing.trial.converted` | Seller | Transactional (transactional) | Always (account/transaction) |
| `planTrialEnding` | seller | `billing.trial.ending (T-3d, T-1d)` | Seller | Transactional (transactional) | Always (account/transaction) |
| `planTrialStarted` | seller | `billing.trial.started` | Seller | Transactional (transactional) | Always (account/transaction) |
| `cardVerificationRefunded` | payments | `billing.card_verification.refunded` | Any user starting a trial | Transactional (transactional) | Always (account/transaction) |
| `coinPurchaseReceipt` | payments | `coins.purchase.succeeded (web)` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `paymentFailed` | payments | `payments.charge.failed` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `paymentReceipt` | payments | `payments.charge.succeeded (receipt)` | Buyer | Transactional (transactional) | Always (account/transaction) |
| `subscriptionReceipt` | payments | `billing.subscription.invoice_paid` | Subscriber | Transactional (transactional) | Always (account/transaction) |
| `storeCreditEarned` | orders | `rewards.store_credit.earned (on order completion)` | Buyer | Transactional (transactional) | On by default; user can turn off |
| `storeCreditExpiring` | orders | `rewards.store_credit.expiring (7 days before)` | Buyer | Transactional (transactional) | On by default; user can turn off |
| `creatorApplicationReceived` | creator | `creator.application.submitted` | Creator | Transactional (transactional) | Always (account/transaction) |
| `creatorApproved` | creator | `creator.application.approved` | Creator | Transactional (transactional) | Always (account/transaction) |
| `creatorEarningsStatement` | creator | `creator.statement.generated (monthly)` | Creator | Transactional (transactional) | On by default; user can turn off |
| `creatorGiftMilestone` | creator | `live.gifts.milestone_reached` | Creator | Transactional (transactional) | On by default; user can turn off |
| `creatorNeedsReview` | creator | `creator.application.manual_review` | Creator | Transactional (transactional) | Always (account/transaction) |
| `creatorNotEligibleYet` | creator | `creator.application.not_eligible` | Creator | Transactional (transactional) | Always (account/transaction) |
| `creatorPayoutSent` | creator | `creator.payout.paid` | Creator | Transactional (transactional) | Always (account/transaction) |
| `blackVettingUpdate` | checkmarks | `verification.black.vetting_step_changed` | Government applicant | Transactional (transactional) | Always (account/transaction) |
| `checkmarkApplicationReceived` | checkmarks | `verification.application.submitted` | Applicant or checkmark holder | Transactional (transactional) | Always (account/transaction) |
| `checkmarkApproved` | checkmarks | `verification.application.approved` | Applicant or checkmark holder | Transactional (transactional) | Always (account/transaction) |
| `checkmarkRejected` | checkmarks | `verification.application.rejected` | Applicant or checkmark holder | Transactional (transactional) | Always (account/transaction) |
| `checkmarkRenewalDue` | checkmarks | `verification.renewal.payment_failed` | Applicant or checkmark holder | Transactional (transactional) | Always (account/transaction) |
| `checkmarkRevoked` | checkmarks | `verification.checkmark.revoked` | Applicant or checkmark holder | Transactional (transactional) | Always (account/transaction) |
| `checkmarkSuggestion` | checkmarks | `verification.suggestion.created (rule-based)` | Eligible user | Transactional (transactional) | On by default; user can turn off |
| `followRequestDigest` | social | `social.follow_request.digest (daily, private accounts)` | Any user | Transactional (transactional) | On by default; user can turn off |
| `liveStarted` | social | `live.stream.started (opt-in per creator)` | Any user | Transactional (transactional) | On by default; user can turn off |
| `mentionedYou` | social | `social.mention.created (if not seen in app within 1h)` | Any user | Transactional (transactional) | On by default; user can turn off |
| `messageRequestDigest` | social | `chat.message_request.digest (daily)` | Any user | Transactional (transactional) | On by default; user can turn off |
| `accountBanned` | trust | `trust.enforcement.banned` | Affected user | Transactional (transactional) | Always (account/transaction) |
| `accountRestricted` | trust | `trust.enforcement.restricted` | Affected user | Transactional (transactional) | Always (account/transaction) |
| `accountSuspended` | trust | `trust.enforcement.suspended` | Affected user | Transactional (transactional) | Always (account/transaction) |
| `appealDecision` | trust | `trust.appeal.decided` | Affected user | Transactional (transactional) | Always (account/transaction) |
| `reportOutcome` | trust | `trust.report.closed` | Reporter | Transactional (transactional) | On by default; user can turn off |
| `accountDeletionCompleted` | privacy | `privacy.deletion.completed` | Account owner | Transactional (legal) | Always (legal notice) |
| `accountDeletionScheduled` | privacy | `privacy.deletion.scheduled` | Account owner | Transactional (legal) | Always (legal notice) |
| `consentConfirmation` | privacy | `privacy.consent.changed` | Account owner | Transactional (legal) | Always (legal notice) |
| `dataExportReady` | privacy | `privacy.export.completed` | Account owner | Transactional (security) | Always (security) |
| `policyUpdated` | privacy | `legal.policy_version.published (notice)` | Account owner | Transactional (legal) | Always (legal notice) |
| `supportAgentReplied` | support | `support.ticket.agent_replied` | User with a ticket | Transactional (transactional) | Always (account/transaction) |
| `supportTicketReceived` | support | `support.ticket.created` | User with a ticket | Transactional (transactional) | Always (account/transaction) |
| `supportTicketResolved` | support | `support.ticket.resolved` | User with a ticket | Transactional (transactional) | Always (account/transaction) |
| `abandonedCart` | marketing | `commerce.cart.abandoned (24h, once per cart)` | Users with marketing consent | Marketing | Marketing consent required; unsubscribe link |
| `backInStock` | marketing | `catalog.inventory.restocked (saved or waitlisted)` | Users with marketing consent | Marketing | Marketing consent required; unsubscribe link |
| `pickedForYou` | marketing | `marketing.recommendations.weekly` | Users with marketing consent | Marketing | Marketing consent required; unsubscribe link |
| `priceDrop` | marketing | `catalog.price.dropped (saved items)` | Users with marketing consent | Marketing | Marketing consent required; unsubscribe link |
| `weeklyDigest` | marketing | `marketing.digest.weekly` | Users with marketing consent | Marketing | Marketing consent required; unsubscribe link |

### 34.4 Backend requirements and open items

- Notifications worker (TypeScript): consume outbox events from SQS, map event → template key, load the recipient's locale, time zone, verified email and consent, check marketing consent and the SES suppression list, render with `renderEmail`, send through SES with `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers on marketing mail, idempotency key per event and recipient, record sends, bounces and complaints (SNS).
- Digest jobs (follow requests, message requests, low stock, weekly digest) and timers (trial T-3d/T-1d, escrow auto-release T-24h, store credit T-7d) are scheduled jobs that emit the trigger events above.
- Copy is English only; `locale` drives number, money and date formatting. Translations later.
- Test in Litmus or Email on Acid (Gmail web/app, Outlook desktop/365, Apple Mail light/dark) before launch.


---

## 35. Reply to comments with video **[DONE (mobile, mock)]**

Owner rule: only the author of a clip can reply to comments on it with a video (TikTok style).

- **Entry points (author only, signed in):** a video icon next to Reply on each comment, a "Reply with video" item in the long-press menu, and a "Reply with video" button at the top of the comments sheet that turns on pick mode (tap a comment). Non-authors and guests never see them. Hidden when the commenter blocked the author (`videoReplyBlocked`).
- **Creation:** opens `CreatePost` in clip mode with `videoReply` params. Header reads "Reply to @user's comment". Draggable, pinch-resizable (and rotatable) comment sticker over the picked video: avatar, @username, text cut at 150 characters. Smaller, Larger and Hide buttons are the accessible fallback. Clip rules unchanged (exactly one video, 180s cap). The commenter is auto-mentioned.
- **Sticker is metadata, not burned in:** `stickerLayout { x, y, scale, rotation, hidden? }`, x and y normalised to 0..1, rendered as an overlay in `ClipPage` so it can be hidden later.
- **Publish:** `POST /api/v1/posts` with `kind: "clip"`, `replyToComment { commentId, clipId, commenterUserId }`, `stickerLayout`. Mock rejects with 403 if the signer is not the clip author or the commenter blocked them, 404 if the comment is missing.
- **Read side:** `GET /api/v1/comments/:id` returns the comment with `videoReplies[] { clipId, thumbnailUrl, createdAt }`; list endpoints include it too. Comment row shows a "Replied with video" chip with a thumbnail that opens the reply clip. The reply clip shows the sticker plus a tappable "Replying to @user's comment" link to the original clip.
- **Notification:** kind `videoReply`, "@author replied to your comment with a video", sent to the commenter.
- **Edge cases:** deleted comment (GET 404) shows "Comment deleted" in the sticker and "Replying to a deleted comment" in the link. If the original clip is subscriber-only the reply defaults to Followers, with a warning when the author picks Everyone. Theme-aware styles; the sticker has no animation, so reduced motion is respected.
- **Demo and links:** mock clips `clip_me_demo_1` and `clip_me_demo_2` are owned by the demo user. The overlay also renders in `PostCard` (PostDetail, feeds). The "Replying to" link opens the Clips tab at the original clip with the comments sheet open, scrolled to and highlighting the comment (top-level or preview reply only).
- **Open items:** real server enforcement of audience, block and author rules; deeper nested replies are not scrolled to. Not tested on a device.

---

## 36. Modal & dialog system **[DONE (mobile + webapp, mock)]**

Owner complaint: the Terms/Privacy update notice was not designed, and modals looked rough in dark mode. One modal language for both apps, light and dark.

### 36.1 Shared rules

- **Surfaces:** light uses the elevated white surface with a soft navy shadow; dark uses the surface step (`#2C2C2C` mobile, `--color-surface` web) plus a hairline border, no heavy shadow.
- **Scrim:** light `rgba(10,10,20,0.45)`, dark `rgba(0,0,0,0.68)`.
- **Shape and rhythm:** dialog radius 20, sheet top radius 24, action radius 12 (web buttons stay pills), 20px edge padding, 48px action height, icon badge 52px tinted by tone (neutral, brand, destructive, success, caution).
- **Actions:** up to 3, stacked on phones (primary first), side by side on desktop. Destructive solid is `#D32F2F` light / `#C8333B` dark so white text passes AA; cancel is always a visible secondary button. Mobile plays a warning haptic on destructive confirms.
- **Motion:** about 240ms in and 180ms out (fade and scale for dialogs, slide for sheets). Reduced motion turns it off (`useReducedMotionPreference` on mobile, `prefers-reduced-motion` on web).

### 36.2 Mobile (`components/ui`)

- `Dialog`: centred card with an icon or illustration slot, title, body, children and up to 3 actions. `dismissible` controls backdrop and back-button close. Long text scrolls inside.
- `DialogHost` plus `showDialog()` (`store/dialog.store.ts`), queued. `showAlertWithButtons` now opens the themed Dialog everywhere (it used to be the native alert, or `window.confirm` on web): cancel buttons become secondary, destructive buttons get the destructive tone and icon, and "Couldn't…" titles get the caution tone.
- `BottomSheet`: drag handle, title and subtitle, close button, `scrollable` body, sticky `footer` / `footerActions`, safe-area and keyboard aware through `KeyboardSpacer`. Backdrop fades and the sheet slides. Same props as before, so all 51 existing sheets picked up the new look.
- `FullScreenModal`: header with close, scrollable content, sticky footer, keyboard aware. Ready to adopt; nothing uses it yet.
- `ModalActionStack` / `ModalActionButton`, `modalChrome.constant.ts` (palette, tones, radii, motion), and the toast now has tones (`showToast(text, { tone })`), an icon and enter and exit animation.

### 36.3 Webapp (`components/ui`)

- `Dialog` on native `<dialog>` + `showModal()`: `aria-modal`, `aria-labelledby` / `aria-describedby`, `alertdialog` role for confirms, Tab focus trap, first focus on the first control (on Cancel for destructive confirms), focus returns to the trigger, page scroll lock, Esc and overlay close only when `dismissible`, exit animation before close. `layout="sheet"` turns it into a bottom sheet under 640px.
- `requestConfirmation()` + `ConfirmDialogHost` (promise based). `ModalDialog` now wraps `Dialog`, so report, share to chat, subscribe and coin purchase picked it up.
- Migrated: sign-in prompt, sign out (user menu and Me page now confirm first), delete account (new `DeleteAccountDialog`).

### 36.4 Policy update experience (from §32)

- **Banner:** card with a shield icon, "We've updated our {documents}", effective date, "Review changes" and dismiss.
- **"What changed" sheet/dialog:** one card per document with name, version, effective date, an "Important change" chip, the highlighted list from Legal (`whatChanged[]`, falling back to the summary split into lines) and "Read full policy" (in-app browser on mobile, new tab on web). Non-material: "Got it" records the acknowledgement. Material, before the date: "Accept the update" or "Remind me later", with a note saying when acceptance becomes required.
- **Blocking re-accept screen** (material change after the effective date): wordmark, shield badge, a calm title, the same document cards for every pending Terms/Privacy version, "Not ready to agree?" with Download my data and Delete my account, and a sticky footer with the checkbox "I have read and agree to the updated Terms and Privacy Policy" and Accept, which stays disabled until the box is ticked. Accept records every pending version. Copy allows up to 2× text scaling on mobile, and the layout has been checked at 150% root font size on the web.
- `PolicyVersionSummary.whatChanged?: string[]` added (mobile + webapp types and mocks). Backend: return the admin "what changed" list from `legal_notice_drafts.what_changed` in `GET /legal/policy-versions/current`.

### 36.5 Live polish (owner request)

- Live follows the theme off video. Over video, every overlay uses one glass treatment (`components/live/liveSurface.constant.ts`: `rgba(12,12,18,0.5)` plus a hairline white border, white text, readable text shadow). The LIVE red is now `#E0201B` (white text 4.8:1).
- Header: chips for back and more, host pill with avatar, name, badge and follower count, category chip, viewer badge.
- Comment bar: input pill with an emoji shortcut, round send button with a sending state, a gold gift button, tip and products buttons, and the keyboard theme matches.
- Comments feed: rows with avatar, name and verification badge, @mentions highlighted, glass or themed bubbles. Joined, follow (new optional `kind: "follow"`) and gift rows are styled differently. Entry animation respects reduced motion. Max height 232, and the oldest rows fade at the top.
- Join card: cover preview with the LIVE badge, host avatar with the live ring, title, category chip, viewer count, "Join live" and "Not now". Guest invite prompt, battle setup (sticky Start), battle proposal, guests sheet (with a confirmation before removing a guest), gift pickers, leaderboards, share, products and the live-ended screen all use theme tokens.

### 36.6 Counts and open items

- Mobile: all 35 `showAlertWithButtons` calls now open the themed Dialog. 4 new confirmations: leave group or channel, remove a member, block from a profile, remove a stage guest. `ConfirmActionSheet` is now a Dialog (3 screens). 51 sheets got the new look. Delete account and theme sheets were redesigned.
- **Second pass (3 Oct):** new `ActionSheet` / `ActionSheetOptionList` (`components/ui/actionSheet.tsx`, grouped option rows, destructive tone with haptic, Cancel footer). Comment options and delete (clips), content options, chat options and report-a-member, and the chat attachment menu now use it. Chat report sheet: sticky footer actions, and "report and block" uses the destructive style. Profile switcher: selectable cards with a radio. Live monetization: scrollable with Done; sound picker: pill search. Popover menus (topic filter, chats options, inbox folder) share `buildPopoverMenuSurface`. The reaction picker uses the modal scrim and surface. The media lightbox and landscape video use `mediaGlass` controls. The clip comments sheet has the sheet handle, radius, scrim and close chip. Web cookie banner (`packages/webKit`): dialog card on desktop, bottom sheet on phones, dark surface step and border, grouped category list, Accept on top on mobile.
- **Remaining: 0.** Custom `FrameAwareModal` is kept only where a popover or media viewer needs it (7 files), and all of them use the shared tokens.
- Webapp home feed overflow at 360/390 is fixed: on sponsored posts the post action row (Sponsored pill plus impressions) now wraps instead of pushing the layout to 405px. Checked: no horizontal scroll on home, explore, mart, me, settings and chats.
- Mobile not checked visually (no Expo); type checks are clean.

---

## 37. Chat reporting **[DONE (mobile + webapp + admin, mock)]**

Owner requirement: in chats a user can report a user, report and block, report a conversation or message, or report a group, and it reaches an admin for review. Chats are end-to-end encrypted (§25), so Zudomart cannot read them: the reporter's device attaches the messages it chooses.

### 37.1 Entry points

| Surface | Mobile | Webapp |
| --- | --- | --- |
| Chat header menu | Report user, Report and block, Report conversation, Block (groups: Report group, Report a member, Conversation info) | Same (header menu; groups: Report group) |
| Message | Long-press picker adds "Report message" (other people's messages only) | "Report" button beside each incoming message |
| Group info | "Report group", "Report member" per member row | Not built (no group UI on web) |
| Requests and Spam lists | "Report" and "Report and block" under Accept/Delete/Block | Not built (web has no Requests or Spam folders) |

Guests cannot report: every entry goes through `requireAuthThen`.

### 37.2 Report flow

- Reasons: child safety (urgent, priority path), self-harm (shows support resources), violence or threats, harassment or bullying, hate, sexual content, spam or scam, fraud or payment scam, impersonation, selling prohibited items, other (text required). Optional details, 500 characters.
- Conversation, message and group reports add an evidence step: last N messages (10, 20 default, 50) or pick messages (up to 100 newest). Consent notice: "These messages will be sent to Zudomart for review. The other person won't be told who reported them."
- The device sends per message: `messageId`, `senderId`, `senderName`, `sentAt`, `text`, `attachments[]` (type, mime, file name, size, duration; file bytes are never sent), plus `evidenceHash` (SHA-256 of the JSON evidence array) for integrity.
- Report and block is one request (`blockReportedUser: true`).
- Confirmation "Thanks, we'll review this" with Block, Mute (mobile) and Restrict buttons and a link to "My reports" (mobile) / Settings, Your reports (webapp).
- The reported user is never told who reported them. Reporter outcome is "We took action" or "No violation found", nothing about the other person.
- Rate limit: 5 reports per rolling hour per account (429 `REPORT_RATE_LIMITED`).

### 37.3 Mock contract (mobile and webapp)

| Method + path | Request | Response |
| --- | --- | --- |
| `POST /api/v1/reports` | `{ targetType: user\|message\|conversation\|group, targetId, conversationId, reportedUserId, reason, details, blockReportedUser, evidence[], evidenceSelection: last_messages\|picked_messages\|null, evidenceHash }` | `{ id, status: "received", priority: normal\|urgent }`. 422 `EVIDENCE_REQUIRED` for message, conversation and group without evidence, `DETAILS_REQUIRED` for `other`; 429 when rate limited. Idempotency key header |
| `GET /api/v1/reports/me` | | `ContentReport[]` including chat reports (`targetType` gains `conversation`, `group`) |
| `POST /api/v1/conversations/:id/restrict` | | void (their messages move to Requests) |
| `POST /api/v1/conversations/:id/block` | | void (existing) |

### 37.4 Admin

`/moderation/chat-reports` queue (permission `chat-reports:review`): filters for status, report type, reason and priority; child-safety reports sort first and are always URGENT. Detail shows reporter, reported user or group, reason, details, the submitted transcript as a read-only chat labelled "Submitted by reporter", the hash check, the retention date and the Python spam score. Actions (each needs a reason, is audited, and the reporter gets the outcome notification): dismiss, warn, restrict messaging (`users:restrict`), suspend (`users:suspend`), ban (`users:ban`, step-up), remove group (step-up, group reports only), escalate to legal (`chat-reports:legal`, step-up). Evidence retention is configurable (default 180 days, legal hold 730 days, 30 to 730) and every evidence block carries the **LEGAL REVIEW** tag. Endpoints are in `apps/admin/apiContract.md`.

### 37.5 Open items

- **[LATER]** real server-side evidence storage with encryption at rest and a purge job; counsel to confirm the retention defaults and the lawful basis for reading user-submitted messages; NCMEC-style child-safety reporting hand-off.
- Webapp Mute, Requests and Spam report entries and group member reporting wait for those surfaces on the web.
- Not tested on a device or in a browser; types checked only.

## 38. Payout onboarding (Flutterwave) **[DONE (mobile + studio + seller, mock)]**

> Frontend flow (3 Oct; provider is Flutterwave since 11 Oct): steps are personal details (BVN/NIN), business (registered sellers), bank account (resolved name), and the ID document step only when the state has `requiresDocumentStep`; copy names no provider. Seller fees UI: no product commission; "Payment processing fee" plus "Escrow fee (1.5%, 1% on Business)" on escrow orders, "Payment processing fee" only on direct orders; buyers see no fee lines. Web redirects to the Flutterwave hosted checkout link; mobile physical goods open the link in an in-app browser and confirm server-side; a saved card is only a provider token, never card data, confirmed with biometrics ("Saved on this device"). See CHANGELOG 3 Oct.

One "Get paid" flow for sellers and creators. Users never see the payment provider: no dashboard, no login. Provider-side setup (the payout subaccount and account resolve) runs in the background (outbox job in go-money), so a Flutterwave outage never blocks onboarding. Becoming a seller or creator unlocks everything that does not need Flutterwave. Only direct payments and withdrawals wait. Earnings meanwhile are recorded and show as pending transfer. One account per user: verified as seller means creators skip to "You're verified", and the reverse.

### 38.1 Flow

1. Who you are: legal name, DOB, address, BVN or NIN (11 digits). Sellers choose "registered business".
2. Business (registered sellers only): CAC number, business type.
3. Bank: bank list, 10-digit account number, live name resolution. The resolved name must match the legal name (order and case ignored).
4. Verify your ID: only active when `accountStatus = documentsRequired`. A fresh link is requested on every tap and never cached. It opens in an in-app browser (mobile `openAuthSessionAsync` with `zudomart://payouts/verification-return`; web popup with a return page that signals the opener). Return is never trusted: "Checking your documents…", short status poll, then `underReview` (shows `reviewEstimate` from the API), `verified`, or `actionNeeded` with the exact reasons and "Fix it". 503 on the link: "Try again in a moment". Closed halfway: "Verify your ID: not finished".

Steps save to Zudomart immediately and are sent to Flutterwave later. Per-step sync badge: Saved, Sending, Done, Needs attention. Resume uses `currentStep` from the server.

### 38.2 Contract for go-money (`/api/v1/payments/...`)

Existing: `GET|POST connected-accounts/me`, `POST connected-accounts/me/onboarding-link` (reuse as the document-link minting call). New:

| Route | Body | Response |
| --- | --- | --- |
| `GET payout-onboarding/me` | | `PayoutOnboardingState` |
| `PUT payout-onboarding/me/identity` | `legalName, dateOfBirth, addressLine1, city, state, idType bvn\|nin, idNumber, registeredBusiness` | state (store only last 4 of the id, send the rest to Flutterwave via the job) |
| `PUT payout-onboarding/me/business` | `cacNumber, businessType` | state |
| `POST payout-onboarding/me/resolve` (web) or `POST /api/v1/banks/resolve-account` (mobile) | `bankCode, accountNumber` | `{ accountName }` full name, never masked here |
| `PUT payout-onboarding/me/bank` | `bankCode, bankName, accountNumber, resolvedAccountName` | state; 422 `NAME_MISMATCH` if the name differs from the legal name |
| `POST payout-onboarding/me/retry` | | state; safe to call repeatedly; re-queues account creation when `failed` |
| `POST payout-onboarding/me/document-link` | | `{ url, returnUrl, expiresAt }`; fresh every call; 409 `ACCOUNT_NOT_READY` unless `documentsRequired`; 503 `LINK_UNAVAILABLE` when Flutterwave is down |
| `GET payout-fees` | | `{ currency, kind: "flat", fee: Money, arrivalEstimate, firstPayoutNote }`, quoted from Flutterwave (`GET /v3/transfers/fee`), never hardcoded in clients |

Seller dashboard BFF mirrors these under `/seller/payout-onboarding/*` (`fees` instead of `payout-fees`). `document-link/complete` exists only in mocks, standing in for the hosted page and webhook. Real status changes come from Flutterwave webhooks plus push.

State: `role, status (not_started|in_progress|pending_review|action_needed|verified), currentStep, completedSteps, requiresBusinessStep, legalName, idType, idLast4, bankSummary, documentStatus, accountStatus (pending_creation|documentsRequired|underReview|failed|actionRequired|verified), syncByStep, earningsPendingTransfer, pendingWithdrawable (Money), reviewEstimate, reasons[{step, code, message}], verifiedVia, withdrawalsEnabled, firstEarningsUnlockAt`.

Withdraw endpoints must reject with 403 until `withdrawalsEnabled`. Push: "Your payout account is ready. Verify your ID" when `documentsRequired` is reached, plus gentle reminders and review outcomes (not built yet).

### 38.3 Entry points

Mobile: Creator Studio home, Wallet, seller dashboard (card with 24h-lock countdown copy), Withdraw (locked state, "Finish payout setup", published fee and arrival estimate). Seller dashboard: Settings, Payouts (full flow), Wallet overview and Withdraw (banner, locked form). Studio web: Lives banner and the new Earnings page.

### 38.4 Mock triggers

ID ending `0000` leads to `actionNeeded`; ID starting `99` leaves account creation `failed` until Try again; ID ending `5030` makes the first link request return 503; account number starting `111` resolves to a different name; `000` is not found. Creation takes about 6 s, review about 12 s.

### 38.5 Open items

- **[LATER]** push and in-app notices, reminder cadence, admin view of onboarding states.
- Mobile Withdraw only checks verification client-side in mock mode.
- Not tested on a device or in a browser; types checked only.

## 39. Save counts (backend note)

- **[BACKEND]** `services/typescript/social` does not return `saveCount` on posts, clips, videos or products. Clients read optional `saveCount` and default it to 0; the server should return it and keep it in step with save and unsave.

## 40. Feed swipe & X-style comments **[DONE (mobile + webapp, mock)]**

> 4 Oct. Home feed post cards take a horizontal swipe; post detail becomes an X-style conversation with promoted replies. Reels/clips comments are unchanged (`components/clips/**` untouched, `/posts/:id/comments` mock unchanged).

### 40.1 Swipe on feed cards

- Right: like (optimistic, light haptic, the heart pops in the action row). Already liked: nothing happens and the hint reads "Liked". Guests get the sign-in prompt (`requireAuthThen`).
- Left: open the post detail (read-only for guests).
- Activation 18px horizontal while vertical stays under 12px (2:1 dominance), so vertical scrolling is never taken. Commit at 28% of the card width or a fling over 0.8 px/ms past 48px. Drag capped at 45%. Hints (pink heart left, blue reply right) follow the finger, then the card springs back. Reduced motion: the card stays still, the hint fades in as a pill and fades out.
- Touches that start on a multi-item `MediaPager` (or the web carousel, `data-swipe-ignore`) never start a swipe. Single-image pagers no longer scroll or bounce, so the swipe works on the image and the lightbox tap still opens.
- Mobile uses `PanResponder` + Reanimated: `react-native-gesture-handler` is **not** installed in `apps/mobile` (adding it needs a new dev build plus `GestureHandlerRootView`). Swap `SwipeablePostCard` to `Gesture.Pan().activeOffsetX([-18, 18]).failOffsetY([-12, 12])` once it is added. The feed list disables scrolling during an active swipe.
- Screen readers: the card body exposes "Like post" and "Open comments" accessibility actions.
- Webapp: `(pointer: coarse)` only, pointer events with `touch-action: pan-y`, click suppression after a swipe; desktop keeps the buttons.

### 40.2 Conversation view

Post shown full at the top with the action row and counts, a full timestamp and views line, Top/Latest tabs, then replies rendered like posts (avatar, name, @handle, time, mentions, media, reply/like with counts). Connector lines link a parent to its first visible child; further siblings show "Replying to @x". "Show N replies" expands a branch through the thread-replies endpoint. The post owner's replies carry an "Author" badge. Sticky "Post your reply" composer (mobile: keyboard-aware via `KeyboardSpacer`, mention autocomplete; guests see "Sign in to reply"). Skeleton, empty and error states; infinite scroll on `{ data, nextCursor }`.

### 40.3 Social thread endpoints (needed in `services/typescript/social`)

| Route | Query | Response |
| --- | --- | --- |
| `GET /api/v1/posts/:postId/thread` | `sort=top\|latest`, `cursor` | `Page<ThreadReply>` of top-level replies |
| `GET /api/v1/comments/:commentId/thread` | `cursor` | `Page<ThreadReply>` of direct replies |

`ThreadReply` = `Comment` + `media?: Media[]`, `isPostAuthor`, `connector { depth, hasParentAbove, hasChildBelow, isLastInChain }`, `inlineReplies: ThreadReply[]` (at most one preferred child per level, two levels deep, preferring the post author's reply). `replyCount` counts direct replies. Top sort: likes plus a reply weight; Latest: newest first. Public reads for guests (viewer flags cleared). Writes reuse `POST /api/v1/posts/:postId/comments`.

### 40.4 go-ads placement `feedCommentThread`

- New slot kind `feedCommentThread` mapped to placement `feed` in `placementRules.service.go`; formats `feed_post` and `product`. Clients call `POST /api/v1/ads/decide` with `slot { kind: "feedCommentThread", contentId: postId, slotIndex, slotsSinceLastAd, neighbourContentIds }` and get `{ ad: DecidedAd | null, declinedReason }` with `label: "Promoted"`.
- Frequency caps enforced server-side: never before the first 3 top-level replies, then at most 1 per 8 replies, at most one decision per `slotIndex` per session; decline with `frequencyCap`.
- Viewers who opted out of personalised ads get contextual ads only (post topics, never audience or behavioural targeting); decline with `contextualOnly` when nothing contextual fits. Premium ad-free viewers get no ad. Guests get none (decide is authenticated).
- Impressions (50% visible for 1 s) and clicks go to `/api/v1/ads/events` with placement `feedCommentThread` (added to `AdPlacement` in both apps).
- Creator share (owner, 2026-10-12): comment ads appear under any feed post (no creator opt-in), but revenue is shared only with the post's creator when they are an approved Creator Program member, at the same rate as pre/post-roll (40% default, AI multiplier, fraud filter, monetisation holds). go-ads keeps `ad_creator_program_members` from `creatorApplication.decided` (approved) and `creator.standingChanged` (approved/suspended), ignoring out-of-order events; with no row it falls back to the content signal's `monetizationEligible`. A creator viewing their own post earns nothing. Unsafe content declines `content_not_brand_safe`; `post.deleted` marks the signal `removed` and declines `content_removed`.
- Ad load by plan (owner, 2026-10-12): every decision first reads the viewer's `adLoadPercent` from go-money internal entitlements (cached 1 min). 0 declines `plan_ad_free`; between 1 and 99 a deterministic per-slot roll declines `plan_ad_load`. Defaults: free 100, Blue Essential 75, Blue Verified 60, Gold and Gold Pro 50, Black Official 20, Blue Premium and Gold Business 0 (locked). Admin edits them in Configuration > Plans & prices (`freeAdLoadPercent`, `plans[].adLoadPercent`); the lowest of a person's live plans wins.

### 40.5 Open items

- **[BACKEND]** the go-ads slot kind above. The two thread routes are built in social (§42.4).
- **[LATER]** add `react-native-gesture-handler` and port the swipe.
- Not tested on a device or in a browser; types checked only.

## 42. Views help, quotes, reply controls, deep threads and sensitive content **[DONE (social + search + gateway + go-auth, mobile + webapp, mock)]**

> 4 Oct. Owner rules: centred Views dialog with a help article, "View quotes", X-style reply controls and creator subscriber-only posts, threads of any depth, and a sensitive-content interstitial with an under-18 age gate. Reels/clips UI unchanged; every backend rule also applies to clips.

### 42.1 Views dialog

- Non-owners tapping the views icon get the centred `Dialog` (mobile `components/ui/dialog`, webapp `layout="centered"`), not a sheet. "Learn more" opens the **About views** article: mobile `HelpArticle { articleId: "ha_views" }` (added to the help centre data, paragraphs with headings), webapp `/help/views` (static page, guest browsable, canonical URL). Content: what a view is, what counts (every appearance, repeats, guests, promotions, partial video), what doesn't (author's own views, automated traffic, moderated posts), who sees what (totals for everyone, analytics for the author) and privacy (anonymous totals, view data is never sold, personalisation switch).

### 42.2 Quotes

- A quote is a repost with text (`posts.isQuote`); quoting a quote points at that quote, a plain repost of a repost points at the original. `posts.quoteCount` (backfilled) goes up on quote, down when the quote is deleted; `repostCount` still counts every repost.
- `GET /api/v1/posts/:postId/quotes?cursor&limit` returns `Page<PostView>` newest first (index `posts(resharedFromId, isQuote, id)`). Privacy: the original must be visible to the viewer; quotes from private authors the viewer doesn't follow, blocked either way, followers-only quotes of non-followed authors and age-withheld quotes are dropped (`selectQuotesVisibleToViewer`); the cursor comes from the raw page so pages never repeat.
- UI: "View quotes (N)" under the action row when `quotes > 0`; mobile `PostQuotes` screen, webapp `/post/:id/quotes`, both infinite scroll. A quote whose original is withheld shows "This post isn't available" (`resharedFromUnavailable`).

### 42.3 Reply controls and subscriber-only posts

- `posts.replyPolicy`: `everyone | following` (people the author follows) `| followers | mentioned | off`. Set in the composer ("Who can reply", mobile) and changed later with `PATCH /api/v1/posts/:postId/reply-settings { replyPolicy }` (author only; mobile post menu "Edit reply settings", webapp "Who can reply: … Change" above the conversation).
- `POST /posts/:postId/comments` (any depth) is refused with `403` and a clear code/message: `REPLIES_OFF`, `AUTHOR_FOLLOWS_ONLY`, `FOLLOWERS_ONLY`, `MENTIONED_ONLY`, `SUBSCRIBERS_ONLY` (`decideReplyPermission`). The author can always reply. Every `PostView` carries `replyPolicy`, `viewerCanReply` and `replyRestriction { reason, message }`; composers show a locked "Who can reply?" note instead of the input.
- `visibility: subscribers` needs an approved creator (`403 CREATOR_ONLY`). Non-subscribers get the existing locked preview with Subscribe; comments, replies and threads of such posts answer `403 SUBSCRIBERS_ONLY`.

### 42.4 Threads of any depth

- `comments` gains `depth` and a materialised `path` (ancestor ids joined by `/`, top level `""`), plus `rootCommentId` and `parentCommentId`; index `comments(rootCommentId, path)`; existing rows backfilled in the migration. No raw SQL: a subtree is one Prisma query on `rootCommentId` + `path startsWith` + `depth <= n`; deleting a reply removes its subtree with one query.
- `GET /api/v1/posts/:postId/thread?sort=top|latest&cursor` (top-level page, one preferred reply chain two levels deep, author's reply first) and `GET /api/v1/comments/:commentId/thread?cursor` (direct replies with nested `inlineReplies` up to 3 levels below the focus, plus `focus`, `ancestors`, `maximumVisibleDepth`). Each reply has `connector`, `isPostAuthor`, `hasMoreReplies` and `continuesInThread`.
- UI: nested replies indent with connector rails for 3 levels; deeper replies flatten with "Replying to @user"; "Show more replies" loads in place and "View thread" drills in (mobile `CommentThread` screen, webapp focus mode with "Back to all replies").

### 42.5 Sensitive content and the age gate

- Labels: `nudity` (adult content only where policy allows), `graphic_violence`, `dangerous_acts`, `self_harm`. Sources stored apart: poster (composer "Mark as sensitive" or `PATCH /posts/:postId/sensitivity`), moderation (`labels` on go-trust `content.visibilityChanged`) and Python advisory scores (`content.sensitivityAdvised { targetType, targetId, scores[{label, score}] }`, only scores >= 0.8). Effective `sensitiveLabels` = poster ∪ moderation ∪ advisory; once moderation reviews, its labels replace the advisory ones (Python never decides alone and can only add warnings). Changes emit `post.updated`; sensitive posts can't be promoted.
- Age bracket: go-auth adds an `age` claim (`adult | minor | unknown`, computed from the birthday at token issue, the date never leaves goIdentity); the gateway forwards only the verified claim as `x-zudomart-age-bracket` (client copies are dropped). Guests and accounts without a birthday are `unknown`.
- Under-18 and unknown viewers never receive `nudity` or `dangerous_acts`: filtered in feeds before ranking, profiles, threads, quotes, saves, sound pages and embedded originals (`buildPostViews` defaults to the strictest policy), direct links answer `404 POST_NOT_AVAILABLE`, and search drops `restricted_for_minors` documents unless the viewer is a verified adult. Under-18 authors can't post those categories (`403 SENSITIVE_LABEL_NOT_ALLOWED`).
- Adults see a blurred "Sensitive content: This post may contain …" interstitial with a View button; the choice is remembered per post on the device. `GET/PUT /api/v1/me/content-preferences { showSensitiveWithoutWarning }` (adults only; others get the explanation) backs Settings → Privacy → Content preferences on both apps.

### 42.6 Tests and open items

- Tests: social `tests/posts/{replyPolicy,quoteVisibility,ageGate}.test.ts`, `tests/comments/commentThread.test.ts`, `tests/contentEvents/sensitiveLabelEvents.test.ts`; search `ageRestrictedSearch.test.ts`; gateway `ageBracketForwarding.test.ts`; go-auth `ageBracket.util_test.go`; mobile `utils/__tests__/sensitiveContent.util.test.ts`; webapp `utils/sensitiveContent.util.test.ts` (`npm run test:units`).
- **[BACKEND]** intelligence has no publisher for `content.sensitivityAdvised` yet (the media classifier must emit it); go-trust moderation tools need a way to set `labels`.
- **[LATER]** mobile UI to edit a post's sensitivity after publishing (endpoint exists); webapp has no composer, so reply and sensitivity controls at publish time are mobile only.
- Not run on a device or in a browser; types and unit tests only.

## 41. Link previews, /username links, guest view-only, product SEO, create menu gating **[DONE (social + media + gateway + go + webapp + mobile, mock UI)]**

> 4 Oct. Owner requirements batch plus a follow-up audit.

### 41.1 Link previews in feed posts

- **Server unfurl** (`services/typescript/social`, module `linkPreviews`): when a text post has no media, `createPost` unfurls the first external URL (waits at most 1.5 s, then finishes in the background) and stores `posts.linkPreview` (`{ url, domain, title, description, siteName, imageUrl, imageMediaId }`). Older posts: `POST /api/v1/posts/:postId/link-preview` (auth) fills it on demand. Chat senders: `GET /api/v1/link-previews/resolve?url=` (auth). Results are cached per normalised URL (tracking params stripped, params sorted) in `link_preview_cache` (24 h ready, 1 h failed); concurrent unfurls of one URL are deduplicated.
- **SSRF guard** (`utils/ssrfGuard.util.ts`, `integrations/safeHttpFetcher.integration.ts`): http/https only, ports 80/443, no credentials, internal hostnames (`localhost`, `*.local`, `*.internal`, metadata names, bare or numeric hosts) refused; every DNS answer must be public (IPv4 private, CGNAT, loopback, link-local/metadata, multicast, reserved; IPv6 loopback, ULA incl. `fd00:ec2::254`, link-local, site-local, multicast, documentation, IPv4-mapped/NAT64/6to4 checked against the embedded IPv4); the socket is pinned to the validated address (no DNS rebinding); redirects are manual (max 3) and every hop is re-validated; 5 s budget, HTML capped at 512 KB, images 5 MB (jpeg/png/webp/avif only), oEmbed JSON 64 KB; user agent `ZudomartBot/1.0`. Parser reads Open Graph, Twitter Card, `<title>`/description and oEmbed discovery.
- **No hotlinking**: the image is downloaded through the guard and uploaded to ts-media via a `post`-purpose internal intent, presigned PUT and the new `POST /internal/v1/media/:mediaId/complete` (owner-checked), so it is scanned, moderated and served from the CDN; without media the card has no image. Owner account: `LINK_PREVIEW_MEDIA_OWNER_ID`.
- **Internal links** (`app.zudomart.com`, `zudomart.com`) are never unfurled: clients render the existing rich cards (mobile `SharedContentCardView` when signed in, a light tappable card for guests; webapp product/store cards from public reads).
- **Frontends**: card under the text (image 1.91:1, site/domain, title, two-line description), themed for light and dark. Mobile opens external links in the in-app browser (`expo-web-browser`, page sheet); shortened or suspicious domains get the chat warning sheet first. Webapp opens a new tab (`noopener noreferrer nofollow ugc`) with a confirmation dialog for risky domains. Mocks: post_31 (external) and post_32 (internal product) in both apps, `POST /posts/:id/link-preview` mock.
- Tests: `social/tests/linkPreviews/*` (SSRF guard incl. IPv6, rebinding, redirect hops; parser; cache; no-hotlink), `media/tests/pipeline/internalLinkPreviewIngest.test.ts`.

### 41.2 Profile share links `https://app.zudomart.com/<username>`

- Every share/copy link uses the web app domain and no `@`: mobile `config/webAppLinks.config.ts` (profile, product `/p/<slug>-<id>`, store, post, clip, live) replaces the old `zudomart.com/@…`, `/products/…`, `/posts/…`, `/clips/…`, `/lives/…` links; webapp copy-link uses `NEXT_PUBLIC_SITE_URL`. No QR code exists in either app yet (nothing to update).
- Webapp: SSR `/(app)/[username]` with metadata (title, description, canonical, OG `profile`, Twitter) and `ProfilePage` + breadcrumb JSON-LD; `/u/<username>` and `/user/<id>` answer 308 to it from `proxy.ts`. Profile links in the feed, threads, mentions, explore and the right rail point straight at `/<username>`.
- Reserved names: `config/reservedRoutes.config.ts` lists every top-level route; goIdentity `webRouteTerms` (exact, confusable-skeleton match) now covers all of them plus `_next`, `sitemap(s)`, `robots`, legal pages, `bff`, `api`, …. `src/contracts/reservedRoutes.test.ts` fails if a new webapp route is missing from either list.
- Mobile deep links: `navigation/linking.config.ts` (prefixes `zudomart://`, the web app URL, `zudomart.com`): `/`, `/clips`, `/p/<slug>-<id>` (+`/product/:id`), `/store/:id`, `/post/:id`, `/live/:id`, `/user/:id`, `/:username` → new `UserProfileByUsername` resolver screen, plus explore, cart, orders, saved, settings, `create/:mode`, creator. Chat link parsing understands `/username` and `/p/` slugs (it used to open `/u/<name>` as a user id).

### 41.3 Guests are view-only

- Gateway: any non-GET without a valid access token gets 401 before reaching a service, except auth (`otp`, `password/reset`, `google`, `apple`, `login`, `refresh`, `register`), staff auth bootstrap, `PUT /consents`, email unsubscribe, `POST /mentions/resolve` (a read), webhooks; staff routes still pass with a bearer token for the owning service to verify. `tests/anonymousMutations.handler.test.ts` sends every mutating route in the table anonymously (900+ cases) and asserts nothing reaches an upstream.
- Mobile: background telemetry (`lives/:id/join|leave|engagement`, `stories/:id/seen`, `posts/:id/share|impressions|profile-visits|link-preview`, ad events, product interactions, preferences) is skipped for guests in the API client instead of popping a sign-in sheet; the mock guest allowlist now matches the gateway (only reads + `mentions/resolve`). Fixed gaps: hide / not interested and the follow button on shared cards now prompt sign-in. Already gated (verified): like, double tap, swipe like, comment/reply, repost, save, share to chat, follow, message, gift (single and battle), live comment, report, subscribe, add to cart, buy, coins, create.
- Webapp: every guest-reachable action goes through `requireAuthThen` (verified: post actions, swipe like, comments, thread replies, saves, share to chat, report, follow, message, subscribe, gifts, live chat, store follow, add to cart, buy); the BFF already refuses anonymous mutations. Clip like is now a real button (it was a static count) and comments link to the thread.

### 41.4 Product SEO (webapp)

- `/p/<slug>-<id>` server-renders the product (React Query seeded with the SSR data, refetched for viewer flags): `generateMetadata` (title with price, description, canonical, `en-NG` + `x-default` hreflang placeholders, OG/Twitter with up to 4 images, `product:price:*` and availability), JSON-LD `Product` + `Offer` (price in major units, availability, seller) + `AggregateRating` + `BreadcrumbList` + `Organization`, `<` escaped. Old `/product/<id>` → 308 from `proxy.ts`; a stale slug redirects in-page to the canonical slug. Gallery thumbnails got descriptive alt text; the main image is `priority` (LCP).
- New SSR store page `/store/<id>` (it was linked from products and explore but missing): metadata, `Store` + breadcrumb JSON-LD, follow (sign-in gated), share, product grid.
- `sitemap.xml` is an index of `/sitemaps/static.xml` and paginated `products-N`, `stores-N`, `profiles-N` files (500 per file in mocks) with hreflang alternates; `robots.txt` allows public pages and blocks private ones. Guests can open product, store and profile pages. Marketing site (`apps/web`) gained `Organization` + `WebSite` JSON-LD (it already had sitemap, robots and OG).
- Verified with one `next dev` run: curl of `/p/ankara-wrap-midi-dress-pr_f1` (3 JSON-LD blocks parse; canonical, OG, Twitter, price tags present), `/store/s_ada`, `/adaeze.styles`, all sitemaps parse as XML, `/product/pr_f1`, `/u/…`, `/user/u_1` → 308.

### 41.5 Create (+) menu gating

- Mobile create pill shows Story / Post / Clip to everyone, Product only when `isSeller`, Live only when the personal profile's creator status is approved (`useCreateMenuAccess`). Deep links and direct routes (`create/product`, `create/live`, `ProductForm`) show a friendly `RoleGateScreen` ("Become a seller" → seller application, "Join the Creator Program"). The `product` mode param used to fall through to the live setup panel.
- Webapp has no composer; "Go live from the app" shows only to creators (others get "Join the Creator Program"), and `/creator` shows a join screen instead of an error for non-creators.
- Backend: go-catalog `SellingStoreMember` refuses create, publish and duplicate unless the store is `active` (`STORE_NOT_APPROVED`); non-members were already refused. go-live already refuses hosts without the `creator` role (`CREATOR_PROGRAM_REQUIRED`, now unit-tested).

### 41.6 Audit: fixed

- Webapp product page: "Add to cart" navigated to the cart and "Buy now" did not; now Add stays with a confirmation and Buy goes to checkout. Breadcrumb includes Mart.
- Webapp: missing store route, clip like/comment were inert, `/creator` dead end, profile share path was `/user/<id>`.
- Mobile: share links pointed at non-existent `zudomart.com` paths; no deep link handling at all; `/u/<name>` chat links opened a user id; live-ended "More options" did nothing (now shares the live).

### 41.7 Open items

- **[BACKEND]** `GET /api/v1/sitemap/{products|stores|profiles}?page=` (`{ entries: [{ id, name, updatedAt }], totalPages }`) is mock-only; build it in go-catalog (products, stores) and goIdentity (public profiles).
- **[BACKEND]** goIdentity `GET /api/v1/users/{userId}` requires a token while both apps let guests open profiles by id; `/user/<id>` redirects therefore 404 for guests on the real backend. Make it optional-auth (public fields only) or keep clients on `/users/by-username`.
- **[BACKEND]** product SSR prices use `x-client-region: NG`; per-visitor currency comes from the client refetch.
- **[DEVICE]** universal links need `apple-app-site-association` / `assetlinks.json` on the web app domain and associated domains in `app.json`.
- Mobile product detail starts "Follow shop" as not following (no follow state in the product payload); the webapp guest `notFound()` on SSR pages is a soft 404 (streamed 200 with `noindex`) because `(app)/loading.tsx` streams.
- Not run on a device; webapp checked with curl only.

## 43. Rich ad formats **[DONE (go-ads, Ads Manager, mobile + webapp, mock)]**

Owner brief: people promote ads with CTA buttons (download an app, several pictures, click the image to reach the link or the post).

### 43.1 Formats (go-ads creative schema)

`Creative.type`: `single` (default for old creatives), `carousel`, `app_install`, `promoted_post`. `format` still means where it is shaped to run (`feed_post`, `clip`, ...). Stored in the existing `creative` JSON column, so no table change for creatives.

- **single**: one image or video; `mediaClickable` makes the media itself open the destination.
- **carousel**: `cards[]` of 2-10 (`mediaId`, headline <=40, description <=90, `callToAction`, own `destination`); feed only; the ad-level headline still applies. Resolved cards carry the media URL.
- **app_install**: `app { appName, iconMediaId, rating? (1-5), iosStoreUrl, androidStoreUrl, webFallbackUrl, iosDeepLink, androidDeepLink }`, destination type `app_store`. App Store links must be `https://apps.apple.com|itunes.apple.com/.../app/...`, Google Play `https://play.google.com/store/apps/details?id=...`; deep links are custom schemes only (no http, javascript, data, file, intent). At least one store link; one store link needs a web fallback.
- **promoted_post**: source `post` or `clip`, destination must be `post` with the same id; the click opens the post.
- CTAs: `shop_now learn_more install download sign_up book_now contact_us watch_more` (plus the older `visit_store send_message follow order_now`).
- Destinations: `url` (https only, no credentials, optional `utm {source,medium,campaign,content,term}`; missing source/medium default to `zudomart`/`paid`, existing query params are never overwritten), internal `post|product|store|profile|messages`, and `app_store`.

### 43.2 Review

`RunAutomatedPolicyChecks` now scans card headlines, descriptions and the app name, and runs `RunDestinationChecks` on every external URL (ad, cards, app web fallback): blocked domains from `ADS_BLOCKED_DOMAINS` (CRITICAL, auto-reject like other critical flags), link shorteners, raw IPs and punycode hosts (HIGH). The review queue payload (`AdForReview.creative`) adds `type`, `cards[]` (image, headline, description, CTA, landing URL with UTM applied) and `app`.

### 43.3 Click tracking

- `POST /api/v1/ads/decide` returns `clickLinks { media?, cta?, cards? }`: signed redirect URLs `GET /api/v1/ads/r/{token}` (`ADS_PUBLIC_URL` base). The click token (`c1.<kid>.<payload>.<sig>`, HMAC with the ad token keys, separate version so it cannot be used as an impression token) carries the impression token, ad id, viewer id and card index.
- The redirect verifies the click token and the embedded impression token, loads the ad, derives the target **only** from the creative's stored destination (`ResolveClickTarget`; `platform` query or User-Agent picks the store link), logs the click through the normal event pipeline (fraud policy, daily stats), then `302` with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Any bad, forged, expired or mismatched token is a `404` with no `Location`; no request parameter ever supplies the target (no open redirect).
- Internal and deep-link opens cannot use the redirect, so clients post a `click` event (with `token` and `cardIndex`) to `/api/v1/ads/events`.
- Events accept `cardIndex`; new event type `card_view` (once per impression and card) feeds per-card stats.

### 43.4 Reporting per card

Table `ad_card_stats_dailies` (migration `20261004090000_add_ad_card_stats`) keyed by day, ad and card index. `GET /api/v1/ads/accounts/{accountId}/ads/{adId}/cards/report?from&to` (`reports:view`) returns `{ items: [{ cardIndex, headline, imageUrl, impressions, clicks, ctr }] }`; the Ads Manager ad page shows it for carousels.

### 43.5 Ads Manager

Ad type picker, carousel card editor (add, remove, reorder with Earlier/Later, per-card media, headline, description, button, link), app-install fields with store URL validation, UTM builder with a live resulting link, media-click toggle, and previews in Feed, Comments (`feedCommentThread`), Reels (clips between items) and Mart tiles. Placement fit rules block carousels outside the feed/comments and app installs in product grids and live. The review status panel and mock review scanner cover the new fields.

### 43.6 Rendering (mobile + webapp)

- Dedicated ad components only: mobile `sponsoredCarousel`, `sponsoredAppInstall`, `sponsoredMedia`, `sponsoredContent`, `thread/sponsoredThreadItem`; webapp `feed/sponsoredAd`. Label is "Promoted" for rich ads.
- Carousel swipes horizontally. Mobile: ad posts do not get the swipe-to-like pan responder at all (`SwipeablePostCard` skips `panHandlers` when `post.sponsored`). Webapp: ad posts disable `usePostSwipe` and the carousel carries `data-swipe-ignore`.
- Taps (`resolveAdTapAction`, unit tested on both apps): internal destinations navigate in app; external https links open the signed redirect in the in-app browser (mobile) or a new tab (web); installs try the platform deep link first (mobile), else the iOS/Android/web store link; non-https and unknown targets do nothing.
- Impression and click events carry the impression token; carousel cards log `card_view` once per session.

### 43.7 Open items

- **[BACKEND]** social/commerce internal lookups for `post|product|store|profile` destination ownership (an advertiser could target another account's product id today; same gap as before for single ads).
- **[LATER]** malware feed (Safe Browsing or similar) behind `DestinationHostFlags`; video cards in the carousel autoplay; device Universal Links verification files for the click host.
- Not run on a device or in a browser; unit tests and type checks only.


## 45. Seller prices per country, region visibility and 30-day deletion grace **[DONE (go-catalog, go-orders, go-auth, go-users, search, social, seller, mobile, webapp)]**

- **Prices by country:** optional per variant, per market currency (NGN, GHS, KES, ZAR, GBP, EUR, USD), every plan (`planFeatures.config` has no feature for it). Region comes from the existing order: profile country, proxy-resolved IP header, client hint. A market price is charged in its own currency; without one the default price shows with an "approx." local amount (currency module rates). Because one seller's order has one currency, a market price only applies when all of that seller's lines have one. Checkout re-prices server-side from the delivery address country. Bulk percent repricing leaves country prices untouched.
- **Region visibility:** the catalog stores each store's deliverable countries (from active shipping zones and rules; none configured means its own country). Lists, store pages, related products, product detail (404-style), share cards ("Not available in your region") and search (`shippingRegions` facet) hide products from other regions; owners and staff see their own. Unknown viewer region hides nothing. Feed product cards are not built yet (post products are empty).
- **Deletion grace:** 30 days (`USERS_DELETION_GRACE_DAYS`). Logging in again cancels the request and shows "Your account deletion has been cancelled". Financial-record retention is unchanged.
- **Open:** per-product (not per-variant) editing of country prices; no IP-geolocation lookup inside goCommerce (relies on the edge header); help centre and legal copy have no deletion-period text yet.

## 46. Fair feed ranking, trends and the Explore home **[DONE (intelligence, social, gateway, go-admin, go-trust, go-users grant, mobile + webapp + admin, mock UI)]**

Owner rules (4 Oct): the feed cannot be manipulated and favours nobody in secret; suggestions follow trends and what the viewer engages with; checkmarks get a modest, capped, disclosed boost (Black/Official >= Gold Business >= Premium >= Blue Verified >= Blue Essential); admin-created accounts with a checkmark are labelled **Official** with a disclosed editorial boost; free accounts can go viral; all weights are admin-configurable inside server-side caps and audited; disclosed in "How your feed works" and the terms. Architecture: [recommendations.md §7](./architecture/recommendations.md).

| Area | Delivered |
| --- | --- |
| Ranking (Python) | `feed_fairness_service.py` (safety filter, integrity discount before scoring, quality prior and completion, capped boost, explanations), `ranking_boost_policy_service.py` (hard caps, tier order), `engagement_integrity_service.py`; `author_is_verified` neutralised; manipulated authors advised to go-trust; response adds `explanations`, `boostMultiplier`, `trustedEngagementShare`, `manipulatedItemIds` |
| Ranking (social) | candidates with checkmark tier, Official flag, country and DB integrity signals (new accounts, suspended engagers, pods, bursts, spam tags); `intelligenceFeedRanker` (signed, 250 ms, circuit breaker) with the deterministic fair ranker as fallback; `PostView.ranking` carries "Why am I seeing this?" |
| Anti-manipulation | ingestion: per-actor velocity cap (60/h), same-cluster and low-trust discounts, integrity counters in Valkey; trending excludes manipulated and spammy items; politics needs 2x distinct actors |
| Trends and headlines | `/v1/trending` per country + category; `/v1/trending/headlines` clusters public posts into stories with neutral extractive titles, template fallback, "Summarised from posts"; social endpoints `/api/v1/explore/{categories,trends,headlines,who-to-follow,posts-for-you}` (guest GET) |
| Admin | Configuration > Feed ranking (`feed.ranking`, caps enforced in Go and re-applied in social/Python); Trust & safety > Trends & headlines (`trending.moderation`, removal only, policy reason + audit); Trust & safety > Manipulation flags (suspension cases filtered by `modelVersion=engagement_integrity`) |
| Explore UI | mobile Search screen and webapp `/explore`: What's happening cards, Trends for you, category tabs, Who to follow (Official label), Posts for you with "Why am I seeing this?"; skeletons, empty and error states, dark/light, guest-viewable; typing switches to search results |
| Latency | Python path 4-5 ms per request in-process; p95 119 ms was single-worker queueing. `INTELLIGENCE_SERVER_WORKERS`, one Valkey round trip for consent + features, client timeout 250 ms with fallback |
| Also | intelligence publishes `content.sensitivityAdvised` from processed images (Rekognition when credentials exist, no signal otherwise) for social's advisory labels; RabbitMQ topology lets intelligence publish domain events |
| Docs | help article `services/typescript/support/content/help/posts-and-feed/how-your-feed-works.md`, terms section "How we rank content" (`apps/web`) |

Open: run the k6 feed scenario with 2 workers; producers should start sending `context.actorClusterKey` (hashed /24 + device) and `context.actorTrust` with events; the "Why am I seeing this?" item in the main feed post menu waits for the feed UI work in progress (data is already on `PostView.ranking`).

## 47. Birthday and Zudoversary celebrations **[DONE (go-identity users, notifications, email templates, mobile + webapp, mock)]**

Owner rules: X-style birthday balloons, and a yearly "Zudoversary" on the join date. No birthday email. Anniversary email respects the "Milestones" notification preference. The date of birth is never exposed.

### 47.1 Backend (go-identity, `users` module `celebrations`)

- Pure logic `utils.ComputeCelebrationDay(birthday, joinedAt, timezone, now)`. The local date comes from the **account timezone** (IANA, default UTC until the client syncs the device timezone). The stored birthday is a calendar date and is never shifted by timezone; only "now" is converted. Leap-day birthdays and joins are celebrated on **Feb 28 in common years**. No birthday in the birth year; the first anniversary is one year after joining.
- Tables (migration `20261004030000_add_celebrations`): `celebration_settings` (`timezone`, `birthday_balloons_visible` default true, `joined_at`) and `celebration_views` (account, kind `birthday|anniversary`, surface `app|profile|email`, `local_date`; unique, so recording is idempotent).
- `GET /api/v1/users/me/celebrations` returns `timezone`, `timezoneConfigured`, `localDate`, `birthdayBalloonsVisible`, `birthday { today, age (self only), shown { app, profile } }`, `anniversary { today, years, shown, stats { followers, orders } }`. `POST /me/celebrations/seen { kind, surface }` (204, idempotent) is the server-side once-per-day memory. `PATCH /me/celebrations/settings { timezone?, birthdayBalloonsVisible? }`.
- Profile views (`GET /users/{id}`, `/users/by-username/{u}`, `/users/me`) gain `birthdayToday` and `anniversaryToday`, computed in the **profile owner's** timezone. Visitors get `birthdayToday` only when the owner's balloons setting is on; the age and date of birth are never in a visitor response (own profile always sees their own).
- Scheduler (hourly, timezone-aware, idempotent): backfills `joined_at` from the account directory, selects accounts whose join month-day is within two days of UTC today, confirms the local date in the account timezone, waits until **08:00 local**, then inserts the `email` view row and the outbox event in one transaction. The unique row means one `account.anniversaryReached` per account per local date.
- Event `account.anniversaryReached` `{ accountId, years, localDate, timezone, joinedAt, stats? }` (schema in `services/contracts/events`, matched by the existing `account.*` notifications binding).

### 47.2 Notifications and email

- New preference category `milestones` (push and email on by default). `milestones.mapping.ts` maps the event to an in-app item and the `zudoversary` email.
- New template `zudoversary` in `packages/emailTemplates` (`milestones.template.tsx`, category `milestones`, kind `transactional`, consent `transactionalOptOut`): hero, thank-you copy, optional "Your time on Zudomart" stats card (only non-zero figures), open-app button.

### 47.3 Mobile and webapp

- Message copy: "Happy 25th birthday, Ada! Wishing you an amazing year ahead from all of us at Zudomart." and "Happy 2nd Zudoversary! Thanks for being part of Zudomart for 2 years." plus a stats card.
- Once per day per surface: local memory (AsyncStorage on mobile, localStorage on web, keyed by account, kind, surface, local date) plus the server `shown` flags. Birthday wins over the anniversary on a surface.
- Surfaces: first open of the app (overlay, `CelebrationHost`) and first view of the own profile (balloons over the header plus a message note). Visitors see balloons over the header without a message or age, and a "Zudoversary" pill.
- Vector balloons only (SVG, theme tokens, no emojis). Mobile uses Reanimated; web uses CSS keyframes. Balloons are buttons ("Pop balloon") and pop on tap. Reduced motion shows a static confetti illustration instead.
- Accessibility: the message is announced (`announceForAccessibility` on mobile, a polite live region on web); the dialog is an alert dialog.
- Settings: "Birthday balloons" switch (Privacy & Data on mobile, Settings > Privacy on web). Clients send the device timezone once when none is set.

### 47.4 Open items

- Posts and lives (last 12 months) come from new internal endpoints `GET /api/v1/internal/accounts/{id}/activity-counts` in social (`posts`) and go-live (`lives`); users reads them via `USERS_SOCIAL_INTERNAL_URL` + `SOCIAL_INTERNAL_API_TOKEN` and `USERS_LIVE_INTERNAL_URL` + `LIVE_INTERNAL_API_TOKEN` (best effort, zero or failure is omitted). The Milestones push and email switches live in mobile Settings > Notifications and webapp Settings.
- **[LATER]** a timezone picker in settings (today the device timezone is synced once).
- Go integration tests need the local Postgres (`pnpm backend:up`) and were compiled but skipped here; unit tests, vitest, jest and tsc were run.

---

## 44. Help Centre **[DONE (ts-support, notifications, gateway, intelligence, admin + mobile + webapp, mock UI)]**

Owner requirements (4 Oct): a Help Centre that explains every part of Zudomart; tickets with email on every staff reply; admins answer tickets; a deep FAQ that grows by itself from resolved questions, with admin create, edit and delete.

### 44.1 Backend: `services/typescript/support` (port 8111, Prisma schema `support`)

- **Help content**: categories → topics (Markdown, slug unique per locale, tags, related topics, version history, helpful votes one per account). Search uses the Prisma API only (keyword `contains` on a normalised `search_text` column + tags, ranked in TypeScript with trigram and keyword scores; no raw SQL). 82 starter articles live in `content/help/<category>/<slug>.md` and are seeded at start-up; staff edits are never overwritten and untouched seed topics refresh when the file changes. Merged topics redirect to their target.
- **Tickets**: categories (order, payment, account, seller, verification, creator, live, ads, safety, other), linked order/payment/live/report/dispute, attachments restricted to media-service URLs, statuses `open | awaiting_user | awaiting_support | resolved | closed`, SLA due dates by priority, internal notes, assignment (self, or others with `support:assign`), satisfaction rating 1-5, unread counts, reopen within 7 days, auto-close 7 days after resolution, live chat as a ticket channel (`chat`, recorded, not E2EE). Account deletion anonymises the requester's tickets (consumes `account.deletionExecuted`).
- **Events** (outbox → `zudomart.events`): `ticket.created`, `ticket.replied` (agent replies carry the message), `ticket.resolved`. Notifications maps them to `supportTicketReceived`, `supportAgentReplied` (email + push + in-app, sent immediately) and `supportTicketResolved`.
- **Auto-FAQ** (job every 30 s on tickets queued at resolution): customer question + staff answer → PII scrubber (emails incl. obfuscated, phones in Nigerian and international formats, cards with Luhn, bank/BVN/NIN digits, order/ticket/payment references, UUIDs, amounts in every supported currency, addresses and postcodes, IPs, dates, @handles, links, names from greetings, sign-offs, introductions, honorifics, participants and capitalised pairs) → residual check → intelligence `POST /v1/help/answer-drafts` (HMAC, deterministic template; never called when residue remains) with a TypeScript template fallback → re-scrub → dedupe (title trigram + keyword Jaccard against published topics and their related-question headings): ≥ 0.55 appends a "Related question" section to that topic, ≥ 0.8 is skipped as already answered, otherwise a new topic is created with related links. Topics are published automatically and marked "From a resolved question" unless the admin setting `autoFaqRequiresReview` is on (default off) or residue was found. Safety tickets are never used. Every outcome is logged for the admin list.
- **Access**: guests read published help (`GET /api/v1/help/*`); voting and every ticket route need an account; admin routes verify the staff JWT (`zudomart-admin` audience) and permissions `support:tickets`, `support:assign`, `support:chat`, new `support:helpContent`; `/internal/support/*` needs the internal token. Gateway, RabbitMQ topology (`support-domain-events`, ticket events on `notifications-domain-events`), Dockerfile, `pnpm backend:dev:support`, CI matrix and Terraform entry added.

### 44.2 Frontends

| Surface | Scope |
| --- | --- |
| Mobile | Help centre home (search, categories, Contact support, My requests with unread badge), category list, article view (Markdown, helpful votes, related, contact support), ticket form with the new categories, ticket list with unread badges and references, thread marks replies read, rating card, closed state; notification taps open the ticket; Settings > Support shows unread replies; live report sheet links to "How live safety works"; views dialog opens the new article |
| Webapp | `/help` (search, categories), `/help/[category]`, `/help/[category]/[slug]` (SSR metadata, canonical, Open Graph, Article + breadcrumb JSON-LD, votes), `/help/tickets`, `/help/tickets/new` (deep links with category and linked order), `/help/tickets/[id]` (live thread, rating), `/help/tickets/[id]/rate` (email rating links); `/help/views` redirects; guests can read help but tickets need sign-in; Settings and order detail link here |
| Admin | Support → Help centre: topics table with filters, auto-topic log, categories CRUD, auto-publish setting; topic editor with Markdown + live preview, related topics, publish/unpublish, merge, delete and version history; ticket queue uses the new statuses, shows references, channel, rating and help-topic outcome |
| Seller dashboard, Studio | Header "Help" links to the web Help Centre (selling, live) |

### 44.3 Open items

- **[LATER]** Real push delivery from the mobile app (no expo-notifications handler yet; in-app notifications route to the ticket).
- **[LATER]** Feeding help topics into the search service (no `helpTopic.*` events are bound yet) and localisation beyond `en`.
- **[LATER]** Staff email on the agents list needs an identity endpoint; agents are discovered from recent support activity.

## 48. Abuse protection: access probing, bots and human checks **[DONE (gateway, go-trust, go-identity, intelligence, contracts, infra, admin + webapp + mobile)]**

Owner rules (4 Oct): probing other people's endpoints or data flags the account and requires a human check; repeated failures suspend it temporarily; deletion or a ban only after a person analyses the evidence; suspected bots are challenged every time. Architecture: [security.md §10](./architecture/security.md).

| Area | Delivered |
| --- | --- |
| Gateway | Probe classifier (route templates, private resource families, admin routes, internal paths, tampered tokens, replayed idempotency keys) and detector with Valkey sliding windows per account and device; reports to go-trust; human verification gate (428 `HUMAN_VERIFICATION_REQUIRED`) with a 15 s state cache, 12 h session pass and single-use action pass; `POST/GET /api/v1/security/human-verification` with Turnstile (or hCaptcha) siteverify, rate limits, no token logging; routes for client signals and the admin queue |
| go-trust | New `accessSecurity` module: tables `security_account_states`, `security_events`, `security_cases` (migration `20261004103816`); deterministic policy (challenge, clear for 24 h, suspend after 5 failed checks or probing after 3 checks in 24 h, suspected bot rules); automatic suspension through go-identity; outbox events `security.challengeRequired/challengeCleared/caseOpened/accountAutoSuspended/botSuspected/caseDecided`; consumes `security.accessViolationDetected` on `trust-domain-events` and `intelligence-trust-bot-scores`; client signals with Play Integrity / App Attest verifier interfaces; admin list, detail and decide (clear, keep restricted, suspend, ban, delete) with step-up, per-action permission and audit; 365-day evidence retention |
| go-identity | Suspension source `security`, reason code `SECURITY`; internal enforcement accepts `delete` (reuses the admin delete flow with financial-record anonymisation and the pending-payout guard) |
| Intelligence | `bot_detection` module: `POST /v1/trust/bot-score` (cadence, headless signals, attestation verdict, account age, follow/like/comment velocity, duplicate comments, engagement manipulation share, shared device/IP clusters), advisory only, publishes high scores once per 6 h |
| Consistent 404s | Orders, seller orders, conversations, messages, disputes and escrow return the same 404 for "not yours" and "missing" (tests in orders and social); `getMyOrder` no longer panics on an empty view |
| Admin | Trust & safety > Security cases: filters (status, trigger, severity), evidence timeline, linked devices and network prefixes, challenge history, bot signals, actions shown only with the matching permission; `security:cases` permission (Trust & Safety template) |
| Web and mobile | Webapp: Turnstile sheet on any 428 and one retry; session-free `/security-check` page for the app. Mobile: in-app browser sheet to `/security-check`, deep-link return `zudomart://security-check#token=…`, shared in-flight check, retry |
| Contracts and infra | JSON schemas and AsyncAPI entries for `security.accessViolationDetected`, `security.accountAutoSuspended`, `security.caseDecided`, `security.botScoreComputed`; RabbitMQ topology and definitions; Terraform secrets `TRUST_INTERNAL_TOKEN`, `TURNSTILE_SECRET_KEY` (gateway) and queue env |
| Privacy and help | Privacy policy draft ("Security", Cloudflare in "Who we share data with"); help article `services/typescript/support/content/help/account-and-login/security-checks.md` for the help agent to import |

### 48.1 Where the Turnstile keys go

Never commit real keys. Defaults everywhere are Cloudflare's public **test** keys (site `1x00000000000000000000AA` always passes, secret `1x0000000000000000000000000000000AA` always passes; `2x0000000000000000000000000000000AA` always fails, for negative tests). The gateway refuses the test secret when `NODE_ENV=production`.

| Key | Local (gitignored files) | AWS |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` (server only) | `services/typescript/gateway/.env` | Secrets Manager `zudomart/<environment>/gateway/app`, JSON key `TURNSTILE_SECRET_KEY` (created by Terraform with `CHANGE_ME`; paste the real value in the console or `aws secretsmanager put-secret-value`) |
| `TRUST_INTERNAL_TOKEN` (gateway → go-trust, same value as go-trust's `MODERATION_INTERNAL_API_TOKEN`) | `services/typescript/gateway/.env` | `zudomart/<environment>/gateway/app` key `TRUST_INTERNAL_TOKEN`, and `zudomart/<environment>/go-trust/app` key `MODERATION_INTERNAL_API_TOKEN` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public) | `apps/webapp/.env.local` | build-time variable of the webapp deployment (not a secret) |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (public) | `apps/mobile/.env` | EAS environment variable; reserved for a native WebView, the app currently uses the webapp page |

In the Cloudflare dashboard add every web origin (app, and any preview domains) to the widget's hostnames. `HUMAN_VERIFICATION_HOSTNAMES` is filled from `app_origins` by Terraform.

### 48.2 Open items

- **[LATER]** Real Play Integrity and App Attest verifiers (interfaces exist; verdict is `unavailable` until then), and the mobile client sending `client-signals`.
- **[LATER]** Producers for the bot score: call `/v1/trust/bot-score` from the events pipeline with cadence and velocity features (today it is on-demand).
- **[LATER]** Go services can publish `security.accessViolationDetected` directly (the consumer exists); the gateway is the only producer today.
- **[LATER]** "Clear" does not reinstate an automatically suspended account; staff reinstate from Suspensions > Suspended accounts.
- **[LATER]** A native WebView renderer for mobile if the in-app browser sheet feels heavy.

## 49. Copyright for videos, clips and sounds, and account status **[DONE (go-trust, media, social, notifications, email templates, gateway, contracts, mobile + webapp + studio + seller + admin, mock UI)]**

Owner rules (2026-10-04). Legal wording (claim declarations, counter-notice declaration, help article, email copy) is **pending counsel review**: a DMCA-style notice and counter-notice process adapted for Nigeria's Copyright Act 2022.

### 49.1 Claims with proof

- `POST /api/v1/copyright/claims` now requires the claimant's full legal name, the original work (link or upload media id), proof of ownership (up to 10 links and 10 uploaded documents), the infringing segments (start and end seconds; optional only for whole-sound claims), the good-faith and accuracy declarations and an electronic signature that must match the legal name. `claimScope` is `audio` or `video` (sounds default to audio).
- Mobile: "Report copyright" in the post/clip menu, a report action on the sound page, and the existing Report > Copyright path; evidence uploads go through the media queue as private `dispute_evidence`. Webapp: "Report copyright" and "Report the sound for copyright" in the content menu, and Report > Copyright continues into the claim form. Guests are asked to sign in.

### 49.2 Remedies on uphold (go-trust `copyrightClaims`)

| Claim | Remedy | Strike |
| --- | --- | --- |
| Audio on a clip, post or sound | `copyrightClaim.audioMuteOrdered` → social disables the sound for reuse and emits `clipAudio.muteRequested` for every clip using it → media produces a muted rendition (silent AAC track, picture copied, HLS ladder rebuilt under `muted/`), swaps variants and re-emits `media.processed` so social swaps playback URLs | No |
| Video on a clip or post | Warning record (strike kind `warning`), `copyrightClaim.warningIssued` with the deadline (default 48 h). A worker takes it down at the deadline (`content.visibilityChanged` → hidden) and issues a strike. `post.deleted` before the deadline marks it `removed_voluntarily` with no strike | Only at the deadline |
| Live, or unknown uploader | Immediate takedown | Yes (when the uploader is known) |

Audio fingerprint matches stay advice only in the admin console.

### 49.3 Strikes, thresholds and expiry

Admin-configurable in `copyright_policy_settings` (`GET/PUT /api/v1/admin/copyright-policy`, step-up): takedown deadline 48 h, strike lifetime 90 days, warning kept 180 days, counting window 90 days, restriction at 3 copyright strikes in the window (monetisation and going live paused; `GOING_LIVE` restricted through go-users for 30 days), suspension review at 3 (a `copyright_strikes` suspension case). An hourly job announces `strike.expired` once per strike. Users can appeal a strike (`POST /api/v1/account/status/strikes/{id}/appeal`); staff decide in `/api/v1/admin/strike-appeals`.

### 49.4 Account status

`GET /api/v1/account/status` (and the admin and internal equivalents) returns Good standing / At risk / Restricted, restrictions, `canMonetise` and `canGoLive`, warnings, strikes with expiry and affected content, copyright notices with deadlines and counter-notice state, and help links. Pages: mobile Settings > Account status (with a countdown banner on the owner's clip), webapp `/settings/account-status` (countdown on the owner's post card), Studio earnings and seller dashboard summaries, admin user detail "Account health" with appeal decisions. `accountHealth.changed` is published on every change for creator eligibility and monetisation consumers.

### 49.5 Counter-notice and restore

Unchanged 10-business-day restore with court-action hold. Restoring an audio claim emits `copyrightClaim.restored` with `remedy: audio_muted`, so social re-enables the sound and media swaps the original rendition back; restoring a takedown publishes visibility `visible`. Any strike and warning from the claim are revoked.

### 49.6 Events and notifications

New schemas: `copyrightClaim.audioMuteOrdered`, `.warningIssued`, `.contentTakenDown`, `.contentRemovedVoluntarily`, `strike.expired`, `strike.appealed`, `strike.appealDecided`, `accountHealth.changed`, `clipAudio.muteRequested`, `clipAudio.restoreRequested`, `media.audioMuted`, `media.audioRestored`; extended `copyrightClaim.received/decided/counterNoticeReceived/restored`, `post.deleted`, `sound.updated`. Topology: trust consumes `post.deleted`; social consumes the audio mute and restore; media consumes `clipAudio.*`; notifications consume the copyright and strike events. Email templates (branded layout): `copyrightWarning`, `audioMuted`, `contentTakenDown`, `strikeIssued`, `strikeExpired`, `counterNoticeReceived`, `contentRestored`.

### 49.7 Monetisation pause, published help and audio match advice

- `accountHealth.changed` is consumed by go-money (wallet `monetisation_holds`: the creator earnings sweep skips paused creators, so gift, coin and subscription earnings stay pending in `earningsPayable` until monetisation returns), go-ads (`ad_creator_monetisation_holds`: a paused creator's share of each spend batch goes to the platform and they are left out of the premium pool; queue `ads-domain-events`) and go-live (`live_host_restrictions`: creating or starting a live returns 403 `LIVE_RESTRICTED`). Out-of-order events are ignored by `occurredAt`.
- The help article is published at `content/help/safety-and-reporting/copyright-and-account-status.md` (also in the web and mobile help mocks).
- Audio match advice: media exposes `POST /internal/v1/media/{id}/audio-fingerprint` (Chromaprint via `fpcalc` when installed, otherwise unavailable); intelligence `POST /v1/audio/copyright-matches` aligns fingerprints and returns advisory scores; go-trust requests it when a claim with an uploaded original arrives and from "Run audio match" in the console, and stores it as audio match hints.

### 49.8 Open items

- **[LATER]** Counsel review of all legal wording (claim declarations, counter-notice declaration, help article, emails).
- **[LATER]** A restore only unmutes clips currently using the sound; clips muted by a different claim on the same sound are not tracked separately.
- **[LATER]** Webapp claim form takes links only (mobile also supports uploads); audio match needs an uploaded original.

## 50. Username suggestions on a taken username **[DONE (go-identity, gateway, mobile + webapp, mock UI)]**

### 50.1 Behaviour

- `GET /auth/username-available?username=&name=` and the register `409 USERNAME_TAKEN` body carry `suggestions: string[]` (3 items). Returned for `taken` and `recently_used`; absent when available, invalid, reserved or withheld.
- Candidates come from the requested name and the display name or email local part: underscore or digit suffixes, the year, a dotted suffix and a short variant. All follow the username rules and skip reserved terms.
- One batched check per request: `account.UsernameIn` in auth, plus `FindBlockedUsernames` on the username guard port (users: handle `IN`, active holds `IN` including the 120-day quarantine, reserved rules). No per-candidate queries, no reservation hold.
- Rate limit: gateway class `usernameCheck`, 30 per minute per IP (`RATE_LIMIT_USERNAMECHECK_PER_MINUTE`).

### 50.2 Clients

Mobile and webapp sign-up username steps debounce the check, show "That username is taken" with chips; tapping a chip fills the field and re-checks; a register 409 race shows the returned chips the same way.

### 50.3 Open items

- **[LATER]** Suggestions on the brand and business handle forms (mobile hook already returns them).
- **[LATER]** Send the display name on sign-up so suggestions can use it (the sign-up draft has no name yet).

## 51. Create flow redesign, photo clips, tagging and tappable links **[DONE (mobile + webapp, mock UI; backend pending)]**

Owner rules (Instagram-like). Mobile is the only app with a composer; the webapp got link handling only.

### 51.1 Keyboard

Opening the composer never pops the keyboard (no `autoFocus`). It opens when the caption is tapped and closes on tap outside, swipe down (`keyboardDismissMode` interactive on iOS, on-drag on Android) or the "Done" accessory (in the post toolbar, or a bar above the keyboard on the clip caption step). `KeyboardSpacer` keeps the toolbar above the keyboard.

### 51.2 Feed post composer

Compose step: caption with mentions and hashtags, photos and videos, audience chip. No sound picker (sounds are clip-only; a video reply still has one). Next opens **Post settings**: summary, Tag people, Add location, then **Advanced settings** (Who can reply, Subscribers only for approved creators, Mark as sensitive, AI generated). Who can reply stays editable after posting.

### 51.3 Clip composer (`components/create/clip/`)

1. **Media**: record a video, choose a video, or make a photo clip from up to 10 photos.
2. **Preview**: large preview with play/pause and a full-screen view. Video: basic trim (start and end steppers, 1 s steps, the existing 180 s cap). Photos: reorder (move earlier or later), per-photo duration 1 to 10 s (default 3 s), remove, transition None, Fade or Slide. Shows the length against 3:00.
3. **Caption and sound**: caption with mentions, then the sound picker: the clip's own audio or a library sound. Photo clips have no audio of their own, so the empty choice reads "No sound".
4. **Post settings**: the same step as feed posts (tags, location, advanced).

### 51.4 Photo clip render: server-side

Chosen: the media service renders the slideshow with ffmpeg into one normal clip video. The player stays unchanged and every surface (feed, clips, share, downloads, moderation, copyright audio matching) keeps seeing a single video. A client-composed manifest would need a new player and moderation path. Contract (`POST /api/v1/posts`):

```
{ kind: "clip", text, mentions, audience, mediaIds,
  media: [{ mediaId, type: "image" | "video", trim?: { startMs, endMs } }],
  slideshow?: { durationsMs: number[], transition: "none" | "crossfade" | "slide" },
  soundId?, location?: { placeId, name, area? }, taggedUserIds?: string[],
  replyPolicy, visibility, sensitiveLabels?, isAiGenerated? }
```

`media` gives the order and trims; `mediaIds` is kept for older clients. A slideshow needs 1 to 10 images, one duration (1,000 to 10,000 ms) per image and a total of 180 s or less. The response has one `video` media item with `status: processing` and `posterUrl` set to the first photo; it becomes `ready` when the render finishes. Trimmed videos also come back as `processing`. Backend work is listed in backendPlan.md under "Create flow".

### 51.5 Tag people

People search (`GET /api/v1/tags/candidates?q=`), removable chips, a cap of 20. People who blocked the author are left out of results; people who turned tagging off are listed but can't be selected ("Doesn't allow tags"). Tags apply to the whole post or clip, not to positions in a photo. The payload is `taggedUserIds`. Tagged people get a `postTag` notification and can remove themselves. How tags are shown on posts and clips is a separate piece of work.

### 51.6 Location

Optional and never automatic: a text place search (`GET /api/v1/places/search?q=`, at least 2 characters). The device location is never read. Stored on the post as `location { placeId, name, area }`.

### 51.7 Links in posts, comments, bios and messages

`MentionText` (mobile and webapp) now renders mentions and URLs together. Every `https://` and `www.` URL is tappable and coloured whether or not a preview card exists: mobile `colors.link` (light #2043F5, dark #8FA1FA, at least 4.5:1 on surfaces in both themes); webapp `--color-brand`. Links in your own chat bubbles are underlined in the bubble's text colour.
- Mobile: Zudomart links (`zudomart.com`, `app.zudomart.com`, `zudomart.app`) open in the app. Other links open in the in-app browser (`expo-web-browser`, full screen, themed toolbar, share menu). It has the system "Open in Safari" or "Open in Chrome" control. Shortened and suspicious links show the warning dialog first. Preview cards (feed and chat) use the same path, so chat previews now open in the app instead of going straight to the external browser.
- Other mobile web links now use the same in-app browser: legal, guidelines, creator terms, seller dashboard and Ads Manager pages open directly (`openTrustedWebPage`). Brand websites and escrow tracking links show the risk check first (`openUserSuppliedWebLink`). `mailto:`, maps, ad deep links, document and export downloads stay on `Linking`.
- Webapp: Zudomart links navigate in the same tab. External links open in a new tab with `rel="noopener noreferrer nofollow ugc"`, and risky ones show the confirm dialog first.

### 51.8 Open items

- **[NEXT]** Backend: slideshow and trim render jobs, `places` search, tag candidates and tag storage (see backendPlan.md).
- **[LATER]** Show the location on post cards and clips (only stored for now).
- **[LATER]** Seek the video preview to the trim start; a drag handle trim bar (needs gesture-handler).
- **[LATER]** A webapp composer (none exists today).

## 52. Tagged people on posts and clips, and compact counts **[DONE (mobile + webapp, mock UI; backend pending)]**

### 52.1 Feed posts

A tag line under the media (person-and-tag glyph, "Ada and 3 others"). Tapping it opens a centred dialog (mobile `Dialog`, webapp centred `Dialog`) listing avatar, name, @username, checkmark and a Follow button. A row closes the dialog and opens the profile (`/username` on web). Guests can read the list; Follow goes through `requireAuthThen` (after the dialog closes). Screen readers hear "Tagged: Ada and 3 others".

### 52.2 Clips

A glass pill (`mediaGlass`) above the caption: up to 3 stacked mini avatars and "N people" (the name when one). It opens a bottom sheet with the same rows; the clip pauses while the sheet is open. The rest of the reel layout is unchanged.

### 52.3 Data

`Post.taggedUsers: { id, username, displayName, avatarUrl, checkmark, isFollowing? }[]` (preview of 3) and `taggedUsersCount`. Longer lists page through `GET /api/v1/posts/:postId/tagged-users` (`{ data, nextCursor }`). Backend in backendPlan.md under "Create flow".

### 52.4 Counts

One formatter, `utils/formatCount.util.ts` (`formatCompactCount`): 999, 1.2K, 12.3K, 123K, 1.2M, 2.5B; no decimal at 100K and above, never more than 5 characters. `formatCountWithThousandsSuffix` is now an alias, so every count reads the same. The clips rail uses a fixed 44 pt column, one-line tabular counts and the same width for every item; the feed action bar and the webapp rail and action bar no longer wrap counts.

### 52.5 Open items

- **[NEXT]** Backend: `taggedUsers` on `PostView` and the tagged-users endpoint.
- **[LATER]** Let tagged people remove themselves from the list sheet.

## 53. Checkmark verification journey with Smile ID **[DONE (go-identity, go-money, go-trust, intelligence, notifications, email templates, gateway, contracts, infra, admin + mobile + webapp + seller)]**

Owner rules, 2026-10-04 (asked for as §50, which was already taken by username suggestions). Integration details, flows and data handling: [integrations/smileId.md](./integrations/smileId.md).

### 53.1 Eligibility

- Personal (creator or not) verifies for Blue, Business/Brand for Gold. Government keeps the Black vetting with maker-checker; the hub only points there.
- go-identity asks Python `POST /v1/verification/eligibility` with the profile signals and the admin checkmark thresholds. Score 75+ with every hard threshold met is **Buy now**; otherwise **Request verification** queues the profile (`verification_eligibilities.state = requested`).
- A worker (hourly; per profile at most every `VERIFICATION_ELIGIBILITY_RECHECK_EVERY`, default 24 h, or sooner when Python asks) re-scores queued profiles. The first time one qualifies it emits `verification.eligible` once: in-app, push and email "You can now apply for verification" with a deep link to `/settings/verification?step=pay` (mobile: `zudomart://settings/verification`).
- Intelligence down: Go falls back to `request`, never `buy_now`.
- go-money refuses web checkout for `blue` and `gold_only` (`409 VERIFICATION_NOT_ELIGIBLE`) unless the profile is eligible or already passed identity once (read-only grant on two users columns). Seller plans and Premium are not gated; their checkmark still needs the identity check.

### 53.2 Pay first, then verify

- `entitlement.granted` for a Blue/Gold plan no longer switches the badge on for a profile that never passed identity verification: it opens a `verification_cases` row (idempotent on the subscription id), recording whether the profile was eligible when it paid. Renewals and profiles verified before keep the old behaviour.
- Consent then capture: `POST /verification/cases/{id}/capture` requires the current biometric consent version and a supported photo ID, then returns a Smile ID web token (webapp hosted web integration) or a single-use Smile Link (apps, opened with `expo-web-browser`).
- The signed Smile ID callback (`POST /api/v1/webhooks/smile-id`, through the gateway) is verified, idempotent on our job id and on the case state, and never stores images, names or ID numbers (only check results, scores, ID type, country, dates and a keyed fingerprint of the ID number).

### 53.3 Decision

- Auto-approve only when liveness, document, face match all pass, the government lookup did not fail, name match is 0.88+ (fuzzy, Jaro-Winkler per token), trust 60+ and not blocked, the profile was eligible when it paid, the ID is not used on another account and (Gold) business documents are approved.
- Anything else goes to the admin queue (`/verification/identity`): Smile ID result, scores, reasons, profile health, Approve / Reject with reason, both behind step-up and audited. Admins can also pass a case before the result arrives.
- Spoof attempt, ID name mismatch, ID number not found and ID reused across accounts go to go-trust as advisory suspension cases (`verification.fraudSignalDetected`; nothing is enforced automatically).

### 53.4 Reject means refund

- Rejecting a `blue` or `gold_only` case emits `verificationCase.refundRequested`; go-money refunds the full Flutterwave charge and disables the subscription (web), revokes the Play subscription with a full refund (Google), or cancels and flags a manual refund for App Store purchases (Apple has no developer refund API). A running trial was never charged, so it is just cancelled. Outcomes come back as `verificationRefund.*` and update the case.
- **Seller plans (Pro, Business) and Premium keep running on reject** (owner, 2026-10-04). Features stay active; only the checkmark is withheld, and only the checkmark's share of the current period's payment is refunded: the standalone checkmark price for the region, channel and interval (Blue for Premium, Gold-only for Pro/Business; `regionpricing.CheckmarkShareMinor`, read from the price book with the research defaults as fallback), capped at what the subscription paid. Web: a Flutterwave partial refund posted as a ledger entry first under the idempotency key `verification-share:{caseId}`; the subscription keeps renewing. Google Play: partial refund when the verifier supports it (none does today), otherwise flagged for manual review like Apple. A running trial charged nothing, so the plan just continues. A standalone Blue, Gold-only, Black or bundle tier keeps the full refund and cancellation above; in a Blue+Gold bundle each tier is its own subscription and case, so a failed tier refunds its own (capped) amount and the other tier stays.
- Outcome events carry `refundScope` (`full` or `checkmark_share`) and `refundAmount`. For a keep-running plan the rejection email and push wait for the outcome, because only go-money knows the amount: "Your plan stays active; we've refunded ₦X for the checkmark" (card), or the store wording with the amount (Google/Apple). The admin queue and the user hub show the same scope.
- Users can re-apply later (30 days after the rejection).
- Emails: `verificationEligible`, `verificationUnderReview`, `verificationApproved`, `verificationRejectedRefunded` (branded layout, refund wording per channel, try again after 30 days).

### 53.5 Trial card check

- The trial card-verification charge (₦50 in Nigeria, regional amounts from `regionpricing.CardVerificationCharge`) is now refunded the moment the card is saved: the first refund call runs inline after settlement, transient failures retry after 5 s, 30 s and 2 min, and a definitive failure or exhausted retries log an `ALERT` and emit `cardVerification.refundFailed`. The five-minute sweep stays as a safety net.
- Seller UI copy: "₦50 charged to verify your card — refunded immediately" (amount from the offer).

### 53.6 Open items

- **[OWNER]** Legal review of the consent text and retention under NDPA 2023 (biometrics are sensitive data); DPA with Smile ID.
- **[DECIDED: no, §54.1]** ~~Renewals must not charge for the checkmark until the profile is verified.~~ Owner, 4 Oct: plans renew at the full price. Only the one-time checkmark-share refund on rejection applies. Billing has no line item for this (a web renewal charges one plan amount; store prices are fixed per product), so after a rejection the plan keeps renewing at its full price. Needs a checkmark-less price per seller plan and Premium, switched at the next renewal and restored on approval.
- **[DONE → §54 for web card billing; Google Play partial refund still open]** Refund the latest charge rather than `billing_reference` (the first charge) when a rejection lands after a renewal; Google Play partial refund once the Play API call exists.
- **[NEXT]** Native IAP in the app (dev build). Until then "Buy now" in the app opens the web checkout.
- **[NEXT]** Confirm Smile ID document `id_type` codes per country and the Google Play `fullRefund` revoke context against the live APIs.
- **[LATER]** A dedicated `identity_verification` source on go-trust suspension cases (uses `python_suggestion` with model `smile_id_verification` for now, to avoid a moderation schema change).
- **[LATER]** Name-change re-verification for identity-verified profiles.

## 54. Renewals and free-trial charging **[DONE (go-money subscriptions + payments, notifications, email templates, contracts, RabbitMQ topology); apps UI pending]**

Owner request, 2026-10-04. Plain-language guide with timelines, state diagram and edge cases: [billing/renewalsAndTrials.md](./billing/renewalsAndTrials.md).

### 54.1 Line items

- Every period is an invoice (`subscription_periods`) built from line items: plan base + checkmark (+ bundle discount, − upgrade credit). The checkmark part is the regional standalone checkmark price (Gold-only for Pro/Business, Blue for Premium), capped at the plan price.
- **Owner decision (4 Oct, later the same day): no renewal discount for an unverified or rejected checkmark.** Pro, Business and Premium always renew at the full plan price. The checkmark line stays on receipts for transparency and is always charged. A rejection still refunds the current period's checkmark share once (§53.4). Standalone checkmarks are unchanged: rejected means cancelled and refunded.
- Price from the price book at renewal time. Increases wait for a 30-day notice email (legal notice) and apply from the first renewal on or after that date. Decreases apply at once.

### 54.2 Renewal engine (web)

- Our own scheduler + Flutterwave tokenized charges with the saved card token (sealed in `payments.billing_authorizations`) instead of provider payment plans, because the amount changes.
- Charged on the period end in the region currency (USD fallback). Idempotency key `renewal:{subscriptionId}:{periodStart}`, a fixed `ren-` Flutterwave `tx_ref` per period, and a ledger entry per paid period (`subscription.periodBilled`).
- Dunning: retries at +1, +3 and +5 days, then a 7-day grace with the plan on, then Free. The checkmark comes off unless another live subscription on the profile grants it. A notification and email at each step, plus a card-expiring notice.
- Cancel any time: the plan stays until the period end, with no partial refunds (verification rule excepted). Upgrades are charged now minus unused time. Downgrades apply at the next renewal.
- Yearly: one charge at 20% off, with a reminder 7 days before. Monthly: no reminder, except trial conversions.
- Jobs: queue `jobs-subscription-billing` on `zudomart.jobs`, using the standard retry tiers and DLQ.

### 54.3 Free trials

- Trial start (7 days / 1 month): ₦50 (regional) card check, refunded immediately, and the card saved. Reminders 3 days and 24 hours before the end, with the exact amount, date and cancel link.
- At trial end the full first period is charged via `charge_authorization`. If it fails, retries run at +1 and +3 days, then Free (features stay at most 3 days).
- One trial per person: account, device, phone and card fingerprint (keyed hash of the card details Flutterwave returns). Cancelling during the trial means no charge.
- Apple and Google run trials and renewals natively. We only map their notifications (renewed, failed, grace, expired, refunded) to the same states. Store product ids and offers are owner to-dos in the guide (§8).

### 54.4 Open items

- **[OWNER]** Create the store introductory offers and turn on grace periods (guide §8). Review the price-change and renewal-reminder wording for UK/EU consumer law.
- **[NEXT]** Webapp / seller dashboard billing screens: line-item invoices (`GET /subscriptions/{id}/periods`), upcoming charge preview, Pay now, change plan, update card.
- **[LATER]** Google Play partial refund call for the checkmark share.

## 55. Mart: ranked hero carousel and sticky category tabs **[DONE (mobile + webapp, mock UI; backend pending)]**

Owner request, 2026-10-04.

### 55.1 Ranked hero carousel **[DONE]**

- The hero at the top of Mart is a carousel of highlights (deals of the day, featured brands, new arrivals, category spotlights, trending) chosen and ordered per viewer from `GET /api/v1/mart/highlights` → `{data, nextCursor}`, each with `ranking.reason` shown on the slide (for example "Because you browsed Shoes"). Mocks re-rank on every request.
- Refreshes on pull-to-refresh (mobile), and on return to the screen or app after 5 minutes (mobile focus + AppState; webapp window focus + mount).
- Auto-advances every 5 s; pauses while touched, hovered or focused, when scrolled off-screen, when the screen or tab is hidden, and with a screen reader on (mobile). Reduce Motion turns auto-advance off. Dots show position; webapp has a pause button and clickable dots, mobile is an adjustable control for screen readers.
- **[NEXT — backend]** go.catalog serves the endpoint, py.intelligence ranks it (backendPlan §2.8, §2.12).

### 55.2 Sticky category tabs **[DONE]**

- Mobile: the category row is a `stickyHeaderIndices` child of the Mart scroll view, so it pins under the app header and products scroll beneath it, then returns below the banners at the top. A divider appears while pinned. The selected tab scrolls into view, and changing category while pinned keeps the row pinned with results starting under it.
- Webapp: `position: sticky` at `--top-bar-height` (new token in `globals.css`), with the same divider, selected-chip-in-view and scroll behaviour.
- **[CHECK]** Not run on a device or browser yet; confirm `--top-bar-height` still matches once the top bar wordmark lands.

## 56. Contextual sheets and the Zudomart wordmark **[DONE (mobile + webapp + web-kit)]**

### 56.1 Bottom sheets instead of centred dialogs

- Mobile `BottomSheet` now supports swipe-down to dismiss on the handle and title row (`components/ui/sheetDragDismiss.hook.ts`; it uses PanResponder because the app has no gesture-handler). The handle has a bigger touch area, max height is 90% of the window, and the backdrop tap, safe-area padding, keyboard spacer and internal scrolling are unchanged.
- Converted on mobile: tagged people on a post, the Views explainer on someone else's post (the "analytics" sheet for posts that aren't yours), the message reaction and report picker, and the Share chooser (`useShareToChat`, which was a centred alert).
- Webapp `Dialog layout="sheet"` is a bottom sheet below 768 px (it was 640 px) and a centred modal above that. Sheets cap at 90dvh, stack their footer actions and can be dragged down from the handle or header (`components/ui/sheetDrag.hook.ts`). Converted to sheets: the Views explainer, tagged people, and Who can reply.
- Kept centred because they are short blocking confirmations or alerts: `DialogHost` / `showAlertWithButtons` (delete post, comment or reply, log out, end live, remove member, errors), the suspicious-link warning, chat Block, escrow `ConfirmActionSheet`, and on web `ConfirmDialog`, Delete account and the celebration dialog. Anchored dropdowns (feed mode, inbox folder, chats options) stay popovers.
- **[DONE]** `documentBubble` "Open or save" is now a `BottomSheet` (file name, size, Open / Save to device).

### 56.2 Wordmark

- Bricolage Grotesque (OFL), outlined to SVG paths in `packages/webKit/src/brand/zudomartBrand.path.ts`. The rationale is in [design/brandWordmark.md](./design/brandWordmark.md).
- Mobile home bar: wordmark, divider, Feed / Mart switch. It collapses to the logo mark below 380 pt. Webapp top bar: the logo mark below 380 px. Every web app's `ZudomartWordmark` now draws outlines instead of SVG `<text>`.
- **[CHECK]** Not yet seen on a device or in a browser.

## 57. Branded downloads and the screenshot share prompt **[DONE (ts-media, ts-social, gateway, mobile + webapp, mock UI)]**

Owner request, 2026-10-04: content saved from Zudomart carries the brand, like X and TikTok.

### 57.1 Photos **[DONE]**

- Download (post `⋯` menu, the image viewer's download button on mobile, the webapp `⋯` menu) saves a copy with a small Zudomart badge and the owner's `@username` in the bottom-right corner: 72% opacity, scaled to 6% of the short side. Rendered server-side with sharp (the media service already had it), so one privacy check covers every client.
- Mobile saves to the gallery with expo-media-library (write-only photo/video permission); if refused, the share sheet opens instead. Webapp downloads through the signed link.

### 57.2 Videos and clips **[DONE]**

- ffmpeg "download variant" in ts-media: the logo and `@username` move TL → TR → BR → BL every 4 s so a single crop can't remove them, and a 1.8 s end card shows the logo fading and rising in on brand blue. Cached per media id, username and source; made on the first request, served by a 5-minute signed URL.
- Clients show progress: "Adding the Zudomart tag… n%" while the server renders (polling), then byte progress while saving (mobile). Cancel at any time.
- Copyright-muted clips stay silent in the download; muting throws away cached copies.

### 57.3 Privacy **[DONE]**

- New owner setting **Allow downloads** (Settings → Privacy, default on). Off hides the button (`PostView.viewerCanDownload`) and the server refuses.
- Never downloadable by others: stories, subscriber-only posts, posts from private accounts, moderation-restricted posts; blocked users get 404. Owners can always download their own.

### 57.4 Screenshots **[DONE — limited by the OS]**

- Apps can't change the image the OS saves for a screenshot. While a post detail or the active clip is on screen, mobile listens for screenshots (`expo-screen-capture`) and shows a small non-blocking "Share this post?" card with Share link and Save tagged copy. It closes itself after 8 s.
- Works on iOS and Android 14+ only; the webapp can't detect screenshots.

### 57.5 Next **[LATER]**

- **[CHECK]** Native modules `expo-media-library` and `expo-screen-capture` were added: needs a new dev client / EAS build. Not run on a device. The real renderer was run against Alpine ffmpeg 6.1 (8 s 360p test clip and a 1080x1350 image): the watermark moves corners, the end card fades and rises, and stripped clips measure -91 dB. A dark translucent backdrop was added behind the watermark so it reads on white.
- Pre-render at publish for popular clips, real ffmpeg progress, a lottie-style animated logo for the end card, branded copies from the webapp image viewer.

## 58. Scoped search: where you open search decides what it searches **[DONE (ts-search, mobile + webapp, mock UI)]**

Owner request, 2026-10-04.

### 58.1 Scopes **[DONE]**

| opened from | searches | placeholder | chip |
|---|---|---|---|
| Feed (home bar, clips, settings) | people, posts, clips, products, stores, brands, hashtags | "Search people, posts, products..." | none |
| Mart (mart tab, product detail, cart, webapp `/mart`) | marketplace products and their categories | "Search Mart" | "In: Mart" |
| A business store page | that store's products and the owner's posts | "Search <store name>" | "In: <store name>" |
| A user profile (own or someone else's) | that user's posts, clips and products | "Search @username" | "In: @username" |

- The chip sits inside the search field. Removing it widens the same query to a global search. Scoped searches with no results offer "Search everywhere".
- Result tabs follow the scope: global Top/People/Posts/Clips/Products/Stores/Brands/Hashtags; store All/Products/Posts; profile All/Posts/Clips/Products; Mart has no tabs.
- Recent searches are kept per scope (signed-in viewers; 20 per scope). Mobile records on submit and when a result is opened; webapp records on submit from the top bar.
- Webapp: pages register their scope (`SearchScopeRegistrar` on `/mart`, store pages and profiles) and the top-bar search reads it; `/explore?q=&scope=&scopeLabel=&type=` carries the scope.

### 58.2 API **[DONE]**

- `GET /api/v1/search?q&scope&type&cursor&limit` → `{data:[{type,...summary}], nextCursor, scope}`. `scope` is `global | mart | store:<uuid> | profile:<uuid>`; `type` is the tab (`top` default). The legacy `scope=<tab>` and `scope=all` (grouped `{products,stores,people,brands}`) still work.
- `GET|POST|DELETE /api/v1/search/recent?scope=`; `DELETE` without `scope` clears every scope.

### 58.3 Next **[LATER]**

- Store-specific posts (posts made "as the store") once social records the store on a post; today the store scope uses posts by the store owner's account.
- Scope-aware suggestions (`/search/suggest`) and Mart filters (price, rating, ships-to) on the scoped results.

## 59. V2 logistics: provider delivery, Chowdeck first **[LATER]**

Owner direction, 2026-10-20: provider delivery is a **V2** feature, not launch. Seller-managed delivery remains the current flow. The full design is in [architecture/logisticsV2.md](./architecture/logisticsV2.md).

- **V1 (now):** sellers set their own delivery price and update delivery status; no third-party courier API.
- **Foundation (2026-10-20):** product/variant weight, dimensions, package category/count, fragile, contents and declared value are stored, collected in the seller product form and exposed through the seller API; checkout product snapshots carry them. Hidden orders tables for policy, quotes, shipments, parcels, attempts, events, charges, insurance and claims exist behind `LOGISTICS_ENABLED=false`. Adapter interface is in place; buyer order detail now shows seller-managed delivery status, rider contact, ETA and attempts, but no provider adapter, provider delivery route or provider delivery UI is live.
- **V2.0:** logistics orchestrator, delivery ledger split, live quotes, buyer selection, seller-ready booking gate, Chowdeck Relay adapter, tracking, cancellation and redelivery.
- **V2.1+:** second provider, coverage sync, insurance partnerships, rural partners.
- **Before V2 code:** fix the shipping/commission ledger split, capture address coordinates, add store pickup coordinates and provider contracts.
- **Chowdeck blockers:** production base URL, Relay webhook contract, coverage/serviceability list, weight/dimension rules, insurance terms and prepaid-wallet/float treatment.

No provider integration is to be built until the V2 design is approved and the seller-managed flow remains unchanged behind the disabled feature flag.

## 60. Order notifications and fail-closed media (2026-10-21) **[DONE]**

- **Order lifecycle notifications:** `orderGroup.created`, `.paid`, `.statusChanged`, `.shipped`, `.delivered` and `.completed` now map to in-app and push notifications. Buyers get placed/paid/preparing/ready/shipped/delivered/completed/cancelled; sellers get paid/cancelled. Shipped/delivered/completed are not duplicated by `statusChanged`. Producer payloads carry the order number and buyer/seller IDs; shipped/delivered also carry courier/tracking. Email templates remain queued because line items and payment URLs are not in the payload.
- **Media safety:** moderation defaults to `hold` on classifier failure; invalid fail modes fail startup; a skipped ClamAV scan rejects the upload unless `MEDIA_ALLOW_UNSCANNED=true` is explicitly set for local development.
- **Direct-payment warning:** both checkout choosers now state that direct payment removes escrow protection and that Zudomart cannot reverse it. Escrow remains the default.
- **Still open:** audio/PDF moderation, presigned Content-Type binding, stronger direct-payment confirmation, per-store promo issues, and the ZM-018/019/020 API sweeps.

## 61. Checkout confirmation, upload binding, admin step-up and route limits (2026-10-22) **[DONE]**

- **Direct payment:** mobile and web checkouts now require the buyer to type `DIRECT` before switching a store from escrow to direct payment. The escrow-loss warning stays visible while confirming; `escrow` remains the default. Server-side acceptance flag and per-store promo issues are still queued.
- **Media uploads:** presigned PUTs bind both `Content-Type` and `Content-Length`, so an upload intent cannot be reused with a different declared type. Production media config rejects an empty, placeholder or short `MEDIA_INTERNAL_TOKEN`.
- **Gateway auth:** media download and link-preview refresh now require authentication at the gateway instead of inheriting the optional posts rule.
- **Rate limits:** added account-scoped buckets for mentions resolve, comments, post engagement/saves, messages, conversation/channel writes, chat keys, support writes, admin email and unsubscribe.
- **Device directory:** `chat/keys/devices/query` is scoped to the requester and existing conversation peers, closing arbitrary device enumeration. Mobile story replies start or resume the direct conversation before encrypting so first-time recipients still work.
- **Admin step-up:** user enforcement, verification review, business-document review and creator decisions now require recent re-auth; staff settings and superadmin approvals now require the superadmin role rather than an empty permission check.
- **Still open:** provider logistics remains deferred; audio/PDF moderation, single-use unsubscribe replay tracking, staff-JWKS assertion and the remaining ZM-018/ZM-020 items are unchanged.

## 62. Direct-payment acceptance, author-only previews and expiring unsubscribe links (2026-10-22) **[DONE]**

- **Direct payment:** `POST /api/v1/orders/checkout` now accepts `directPaymentAccepted`. Request validation requires it when any store selects `direct`, and the service layer enforces the same rule. Both checkouts send it only when the buyer has actually chosen direct for a store. The flag is part of the checkout idempotency fingerprint, and the persisted order group continues to record `paymentMode: direct`.
- **Link previews:** refreshing a post's cached link preview is now author-only. Any other viewer who can see the post still gets a `403 NOT_POST_OWNER`, and no fetch or cache write occurs.
- **Anonymous counters:** anonymous share, impression and profile-visit requests now return before loading the post, so they can no longer be used for unauthenticated read amplification while reporting success.
- **Unsubscribe links:** tokens now carry issued-at/expiry claims and default to 90 days (`UNSUBSCRIBE_TOKEN_TTL_DAYS`, 1–365). Expired, future-issued, tampered or legacy claim-less tokens are rejected. Repeat clicks remain idempotent rather than burning the link.
- **Staff audience:** gateway startup rejects `AUTH_TOKEN_AUDIENCE=zudomart-admin`, preventing a config mistake from making ordinary user tokens satisfy the staff audience.
- **Still open:** per-store promo `issues[]`, single-use replay tracking for unsubscribe, audio/PDF moderation and the remaining ZM-018/ZM-020 items.

## 63. Internal route guards (2026-10-22) **[DONE]**

- **Shared guard:** `platform/httpserver.RequireInternalToken` accepts `X-Internal-Token` or a Bearer token, uses a constant-time comparison and fails closed when the configured token is empty.
- **Coverage:** every `/api/v1/internal/*` mutator in users, wallet, admin, escrow and creators is now guarded at the route level. The existing controller-level checks remain as defence in depth.
- **Still open:** FX staleness alerting, username oracles, audit-record coverage and the rest of ZM-018/ZM-020.

## 64. Currency rate seed path and missing-rate handling (2026-10-22) **[DONE]**

- **Latest revision:** rates are ordered by `created_at` then ID instead of ID alone.
- **Missing rate:** conversion now returns `EXCHANGE_RATE_UNAVAILABLE` (503) instead of surfacing a not-found error as a 500.
- **First admin write:** if a supported currency has no revision, the transaction seeds its default rate before applying the admin change and the large-change check.
- **Still open:** alerting/TTL for rates that have not been refreshed.

## 65. In-product appeal links (2026-10-22) **[DONE]**

- **Backend URLs:** enforcement appeal URLs now point at `/settings/account-status` and checkmark appeal URLs at `/settings/verification`, both of which exist.
- **In-app data:** restricted, warned, suspended, banned and appeal-decided notifications carry `{ url, screen: "AccountStatus" }`; revoked checkmarks carry `{ url, screen: "Verification" }`.
- **Clients:** web notifications navigate to the stored `url` on click, and mobile opens `AccountStatus` or `IdentityVerification` natively from the stored screen.
- **Still open:** per-store promo `issues[]`, single-use replay tracking for unsubscribe, audio/PDF moderation and the rest of ZM-010/ZM-020.

## 66. Audit record for automation content hides (2026-10-22) **[DONE]**

- **Audit entry:** an applied automation hide now records `report.automation_hide` against the content report with the automation as a `system` actor.
- **Failure handling:** an audit failure is logged and does not reopen the content.
- **Still open:** stale-rate alerting, username oracles, the remaining audit-coverage gaps and the rest of ZM-018/ZM-020.
