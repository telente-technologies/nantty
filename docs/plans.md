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

### 5.1 Gating **[DONE — §16]**

- Exists: `screens/creator/creatorProgram.screen.tsx` (apply), `creatorApplicationStatus.screen.tsx` (review states), `creatorProgramService.fetchMyCreatorEligibility / fetchMyCreatorApplication / submitCreatorApplication`, and `CreatorDashboardScreen` already degrades to "See the Creator Program" when the dashboard call fails.
- **[DONE — §16]** Gating is now explicit at the entry point via one shared helper: `useCreatorEntry()` in `hooks/useCreatorStatus.hook.ts` resolves `CreatorDashboard` (status or application `approved`) → `CreatorApplicationStatus` (`pending` / `rejected`) → `CreatorProgram` (otherwise, incl. ineligible — which already renders "Apply when you're eligible"). Applied at every entry: profile shortcuts (`ownProfileShortcuts.tsx`), Settings row, and `openCreatorProgramOrSettings(navigation, destination)` (create/live lock paths). Studio is never surfaced for ineligible accounts.

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
- **[DONE — §16] Contract verification (the gate this item required): NOT supported as written.** `CreatePostBodySchema` (apps/api `posts.validator.ts`) is `audience: schema.enum(["everyone"]).optional()` — there is no `subscribers` value. The subscriber tier exists instead as a separate field: `visibility: schema.enum(["public", "subscribers"])`, guarded server-side by `assertApprovedCreator` (approved creators only). **The chip stays unshipped.** Ship in a deliberate follow-up as: approved creator + ≥1 active plan → chip offers "Subscribers" → publish sends `visibility: "subscribers"` (with `audience: "everyone"`), not `audience: "subscribers"`.
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
| 16 | Settings | `/settings/*` (store, account, security, notifications, payouts, delivery, locations, taxes, loyalty, team, developers, integrations, billing, verification) | Alerts and API Pro; accounting Business | **[DONE]** |

### 19.5 Later

- **[LATER]** Backend implementation of the new contract sections (catalog extras, delivery, conversations, reviews, analytics, finance, storefront, developers, integrations).
- **[LATER]** Multiple stores under one Business account is gated but has no create-store flow yet (store switcher only).
- **[LATER]** Product video upload (links only today); real Ads Manager data shared between `/ads` and the ads report (each seeds its own).
- **[LATER]** Landing screenshots are older captures; reshoot once the new pages are final.



---

## 21. Social graph, profiles & ZudoPoints (mobile) **[DONE — mock]**

Contracts: backendPlan §4.5 (ZudoPoints, social graph) and §4.4 (live ads). Mock mode only; `services/**` untouched.

| # | Feature | Mobile scope | Marker |
| --- | --- | --- | --- |
| 1 | Private profiles | Public/Private chips in Settings > Privacy (`PATCH /users/me { isPrivate }`); follow states `none/requested/accepted/rejected/blocked`; button reads Follow / Requested / Following; private profile hides posts and shows "This account is private"; Follow requests inbox (approve/decline) from the own-profile shortcuts and Privacy | **[DONE]** |
| 2 | Followers / Following | Profile counts open a searchable list (`GET /users/:id/followers\|following?q=` returning `{ data, nextCursor }`); private lists return 403 for non-followers and render the private state | **[DONE]** |
| 3 | Profile switching | Existing switcher sheet extended: Personal / Creator (only when `useCreatorEntry` resolves to approved) / Business; "Create business profile" form with category > subcategory, several allowed, plus custom (pending review); open to any organisation | **[DONE]** |
| 4 | AI-generated label | "AI generated" switch in the composer sends `isAiGenerated: true`; label on posts and clips | **[DONE]** |
| 5 | ZudoPoints on live | Supporter board ranks by points (gifts 1 coin = 1 point, like, share, follow, watch time); like-points capped at 10/min in the mock while visual likes stay unlimited; viewer's own points pill; leaderboard chip/sheet and live-ended Top Supporters use points; Rankings screen (Global / Country / Category x Streamers / Supporters / Creators). No cash-out or money display | **[DONE]** |
| 6 | Live-ad settings | "Live monetization" sheet in go-live setup: allow ads (off by default), placements, max interruptions 0-3, minimum interval, ad indicator, live-ad terms (`acceptedLiveAdTermsVersion` stored with the session), free-text own sponsorship line | **[DONE]** |

### 21.1 Notes

- `isAiGenerated` is used on `NewPostInput` and `Post` (backendPlan names it `aiGenerated`; reconcile when wiring).
- Posts from private profiles are hidden on the profile post list; feed and search filtering is **[LATER]**.
- **[LATER]** Real points awards via domain events, hourly ranking rebuild, creator profile created server-side on approval, business verification (KYB), live-ad delivery, "who can see my followers" setting.


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

