# Change log — 1 October 2026

Every change made today, grouped by app. Standing rule: **any change to `apps/mobile` gets an entry here on the day it lands.** Forward-looking work lives in [plans.md](./plans.md).

Verified today: `cd apps/mobile && npx tsc --noEmit` → clean. `cd apps/webapp && npx tsc --noEmit` → clean. `npx jest` in `apps/mobile` → no tests configured (607 files, 0 test matches).

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
| `src/app/(auth)/layout.tsx` + `authLayout.module.css` | **Rebuilt.** Removed the invented "Z" mark, "Watch it. Want it. Buy it." headline and invented bullet points. Desktop (≥900px) is now a real split screen: the left half is the landing-page hero — eyebrow *"Social shopping, made for Nigeria"*, the `Shop the sellers you already watch.` heading with its yellow price tag, the landing lede, the landing proof list (`shield24` / `sealCheck20` / `truck24`), and a three-phone stage built from real screenshots — over the landing gradient. Right half is the wordmark + form. Below 900px the aside collapses and only the form shows. |
| `src/app/(auth)/welcome/page.tsx` + `welcome.module.css` | **New.** Splash (`#f7f8fe`, lowercase `zudomart` wordmark, 1200ms — matching `apps/mobile/app.json`'s splash config) then the mobile `Onboarding` screen: three staggered rows of the market photo, *"Discover real sellers around you"* / *"Shop real sellers, pay safely with escrow."*, `Continue with Apple`, `Continue with Google`, `Use username`, `LegalText`, and the `Already have an account? / Log in` switch. The splash is CSS-hidden on desktop viewports. |
| `src/app/(auth)/login/page.tsx` | **Rebuilt.** Dropped the invented `Welcome back` / `Sign in to keep shopping and chatting.` Now exactly `LoginScreen`: back arrow to `/welcome`, fields labelled `Email or username` (placeholder `Enter your email`) and `Password` (placeholder `Enter password`), `Forgot password?`, the `Log in` button (disabled until both fields are non-empty, as mobile does), and mobile's `Don't have an account? / Sign up` switch copy. Non-API failures use mobile's own fallback: `Couldn't log in. Check your connection and try again.` |
| `src/app/(auth)/signup/page.tsx` | **Rebuilt.** Replaced the invented `StepDots` wizard with mobile's exact step order and copy: **Contact** (`What's your phone number?` / `What's your email?`, `Phone number`/`Email` tabs, `NG +234` prefix, `Save login info…` checkbox, the phone-privacy helper line, `Send Code`) → **Verify** (`Enter 6-digit code`, 6-box OTP that auto-verifies, `Resend code` + 60s timer, `Didn't get a code? Request a call`) → **Birthday** (`When's your birthday?`, `dd/mm/yyyy`, the ≥13 and real-date errors) → **Password** (`Create password`, live requirements list + strength bar with `Weak`/`Medium`/`Strong`) → **Username** (`Create username`, debounced availability with mobile's exact `@x is available` / `That username is already taken.` messages, `Confirm` + `Skip`) → **Personalization** (`Personalize your feed`, `Add or edit topics you follow. Chose three or more.`, minimum 3 topics, `Continue` / `Skip`, `Customizing your feed…` for 1.5s). Back arrow walks one step at a time and returns to `/welcome`. The invented "Your name (optional)" field is gone — mobile has no name field at signup. Validators are ported verbatim from `apps/mobile/src/utils/validators.util.ts`. |
| `src/app/(auth)/authForm.module.css` | Rewritten for the above: back bar, step heading, channel tabs, phone prefix field, checkbox row, 6-box OTP, resend rows, password rules + strength bar, topic chips. Removed the unused `StepDots`/`dividerRow` rules. |

### Routing

| File | Change |
| --- | --- |
| `src/proxy.ts` | `/welcome` added to the public allow-list (and it redirects to `/` when a session already exists). Unauthenticated requests now land on `/welcome` instead of `/login`, so the splash/onboarding is the front door. Static assets (`.webp`, `.jpg`, `.svg`, …) pass straight through — without this the new `public/screens` and `public/onboardingMarketPhoto.jpg` would have been bounced to `/login`. |
| `.env.example` | Added `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_APPLE_CLIENT_ID` (both empty). |

---

## docs

| File | Change |
| --- | --- |
| `docs/plans.md` | **New.** The working plan: feed media, feed video audio, chat keyboard/voice/timestamps/typing, creator subscriptions (what exists, four gaps, and the **end-to-end subscribe flow** for both creator and subscriber), Creator Studio requirements (gating, coins/wallet/earnings, clips vs normal videos, audience selection, thumbnails + Python job), and webapp auth parity + desktop split. |
| `docs/CHANGELOG.md` | **New.** This file. |
