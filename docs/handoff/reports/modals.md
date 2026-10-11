# Modals + branded loader: report

## Shared components

### Web: `packages/webKit/src/dialog/` (exported from `@zudomart/web-kit`)
- `Dialog` (`dialog.tsx` + `dialog.module.css`) is the one dialog for every Next app. It has three layouts: `centered`, `sheet` (a bottom sheet with a drag handle on phones) and `sidePanel`. Sizes are small/medium/large, or a custom `width`. It also has:
  - an `intent` that picks the Phosphor icon and the tone, shown in a tinted circle (stacked and centred for small dialogs, inline for form dialogs)
  - an X close button, shown only when the dialog can be dismissed
  - `actions` with primary/secondary/danger variants, plus a custom `footer`
  - `busy`, which disables every control and blocks Esc, scrim and X while the action runs
  - `errorMessage`, shown inline with `role="alert"`
  - `aria-labelledby` / `aria-describedby`, `role="alertdialog"` for confirms, a focus trap, initial focus via `data-autofocus`, focus restored on close, scroll lock, reduced motion, light/dark tokens, a safe-area bottom on sheets, and a scrolling body.
- `dialogIntent.tsx` is the central Phosphor map for the web. It has about 75 intents, e.g. delete→Trash, deleteAccount→WarningOctagon, unfollow→UserMinus, block→Prohibit, report→Flag, signIn→SignIn, stepUp→ShieldCheck, verify→SealCheck, mute→BellSlash, share→ShareFat, link→Link, boost→RocketLaunch, camera→Camera, location→MapPin, money→Wallet, naira→CurrencyNgn, refund→ArrowCounterClockwise, dispute→Scales, suspend→HandPalm, copyright→Copyright, legal→Scroll.
- `confirmation.store.ts` + `confirmDialog.tsx` provide `requestConfirmation({ title, description, confirmLabel, intent, tone, onConfirm?, describeError? })` and `ConfirmDialogHost`. An async `onConfirm` shows a loading state, ignores a second click, keeps errors inline, and the dialog can't be dismissed while it is submitting.
- `dialogLifecycle.hook.ts` has `useAnimatedNativeDialog` and `useModalFocusTrap`, for custom overlays.
- `dialogFocus.util.ts` and `sheetDrag.hook.ts` hold the focus-trap and sheet-drag logic.
- Each app's dialog primitive is now a thin wrapper over webKit `Dialog`, and the duplicated CSS was deleted:
  - webapp: `ui/dialog.tsx`, `ui/modalDialog.tsx`, `ui/confirmDialog.tsx` (deleted `dialog.module.css`, `dialogSheet.module.css`, `sheetDrag.hook.ts`)
  - admin: `ui/modalDialog.tsx` and `ui/confirmActionDialog.tsx`. Confirm dialogs now pick up `intent`, inline errors and busy-locking automatically; step-up uses ShieldCheck and danger uses WarningOctagon by default.
  - seller: `ui/modalDialog.tsx`
  - ads: `ui/overlayDialog.tsx`
- `ConfirmDialogHost` is mounted in the admin `(console)/layout.tsx`, the seller root layout and the ads root layout. Webapp already had it, through the re-export.

### Mobile: `apps/mobile/src/components/ui/`
- `modalIntent.tsx` is the same intent idea on mobile (about 40 intents). It uses glyphs from the registry only. These glyphs were added to `phosphorGlyphs.ts`/`glyphs.ts`: WarningOctagon, CheckCircle, SignIn, Link, CurrencyNgn, StopCircle, XCircle, SealCheck24 and ShareFat24. The icon-count test was updated from 171 to 180.
- `dialog.tsx` has:
  - `intent`, which sets the icon in a tinted circle and the tone
  - an X close button with a 44pt target when the dialog can be dismissed
  - an inline `errorMessage` with `accessibilityRole="alert"`
  - a title wrapped as an accessible header that gets screen-reader focus on open (`accessibilityFocus.hook.ts`)
  - `accessibilityViewIsModal`
  - Android Back and the scrim are blocked while an action is loading
  - a scroll body with `keyboardShouldPersistTaps`
- `dialogHost.tsx`: actions may return a Promise. While it runs, that action shows a loading spinner and the others are disabled. A double tap is ignored. If it fails, the dialog stays open with the error inline; if it succeeds, the dialog closes. Dialogs without an intent get one from the tone (destructive→WarningOctagon, problem→Warning, success→CheckCircle).
- `showAlertWithButtons(title, message, buttons, { intent })` takes the new 4th argument. When an intent is given and the buttons are neutral, the intent's tone is used.
- `bottomSheet.tsx` and `fullScreenModal.tsx` focus the title on open and have 44pt close targets. In `toastHost.tsx` the action is now 44pt tall.
- `escrow/confirmActionSheet.tsx` now uses the shared `intent` and `errorMessage`.

## Inventory (modal → icon)

### Mobile
| Modal | Icon |
|---|---|
| Delete product (productForm) | Trash |
| Remove payout account | Trash |
| End live | StopCircle |
| Stop renewing subscription | Crown |
| Deactivate account (now async: loading + inline error) | WarningOctagon |
| Log out | SignOut |
| Some files weren't added | Image |
| Delete post/clip (useDeleteOwnPost) | Trash |
| Delete reply | Trash |
| Delete comment | Trash |
| Delete review | Trash |
| Remove guest from stage | UserMinus |
| Block (profile more sheet, connection options) | Prohibit |
| Pin limit reached | PushPin |
| End battle | Sword |
| Leave the stage | StopCircle |
| Suspicious/shortened link | Link |
| Unfollow (confirmedFollowToggle) | UserMinus |
| Confirm receipt (order detail, escrow status) | CurrencyNgn |
| Cancel verification | SealCheck |
| Error alerts ("Couldn't…", "Not sent", …) | Warning (inferred) |

Content options sheet: "Copy link" now uses Link instead of Copy, and "Share via…" uses ShareFat. "Share or copy profile link" also uses ShareFat.

### Webapp
| Modal | Icon |
|---|---|
| Sign in prompt | SignIn |
| Step-up (wallet) | ShieldCheck |
| Human verification | ShieldCheck |
| Delete account | WarningOctagon |
| Deactivate account | userMinus (kept) |
| Report (post/clip/live) | Flag |
| Copyright claim | Copyright |
| Counter-notice | Copyright |
| Strike appeal | Scales |
| Policy update | Scroll |
| Escrow confirm receipt | Wallet |
| New subscription plan | Crown |
| Delete product ×2 | Trash |
| Delete post | Trash |
| Cancel order | XCircle |
| Stop renewing subscription | XCircle |
| Suspicious link | Link |
| Block | Prohibit |
| Sign out | SignOut |
| Unfollow | UserMinus |

These kept their existing icons: celebration (Gift), share to chat (ShareFat action icon), coins (Coin), subscribe to creator (Star), reshare (Repost), views (Views), tagged people (PersonTag), address (MapPin).

`clipCommentsSheet` gained a focus trap, Esc and focus restore (`useModalFocusTrap`). `policyReacceptScreen` gained a Tab trap. Toast actions are now 44px tall and stay up for 7s.

### Admin (about 55 dialogs, `intent` added)
| Intent | Icon | Dialogs |
|---|---|---|
| moderation | ShieldWarning | strikes |
| verify | SealCheck | applications, identity checks, business docs, checkmarks, verification decisions |
| addMember | UserPlus | create account |
| signOut | SignOut | sessions |
| security | ShieldCheck | admin state, staff settings, security cases |
| publish | PaperPlaneTilt | versioned save, feature publish, legal publish |
| settings | GearSix | flags, evidence retention |
| delete | Trash | help category/topic, macros |
| archive | Archive | versioned record |
| lock | LockKey | reveal PII, reserve/withhold name, idle session |
| suspend | HandPalm | suspensions, advertiser, suspended accounts |
| live | Broadcast | live incident |
| ads | Megaphone | ad review, ad policy |
| send | PaperPlaneTilt | email outreach |
| remove | XCircle | reserved name |
| edit | PencilSimple | help category, username assign, topic, feature editor |
| transfer | ArrowsLeftRight | username move |
| restore | ArrowUUpLeft | reclaim, version restore, legal rollback |
| report | Flag | report and chat-report actions |
| store | Storefront | official store |
| legal | Scroll | return to draft |
| copyright | Copyright | IP claim, counter-notice, copyright decision/policy |
| tag | Tag | categories |
| notes | ClipboardText | macros manager |
| dispute | Scales | appeals |
| coins / naira | Coins / CurrencyNgn | pricing dialogs |
| team | UsersThree | admin access |
| stepUp | ShieldCheck | step-up provider |

The passkey removal was converted from `window.confirm` to `requestConfirmation` with the passkey intent (Fingerprint) and inline errors.

### Seller (31 dialogs, `intent` added)
| Intent | Icon | Dialogs |
|---|---|---|
| audience | UsersThree | segments |
| stepUp | ShieldCheck | step-up |
| delete | Trash | payout account, promotion, webhook |
| remove | XCircle | affiliate request |
| discount | Percent | flash sale |
| product | Package | bundle |
| inventory | Warehouse | stock adjustment, reorder levels |
| naira | CurrencyNgn | withdraw confirm |
| copyright | Copyright | brand claim |
| delivery | Truck | supplier, shipping rule, shipment |
| live | Broadcast | affiliate live invite |
| removeMember | UserMinus | affiliate creator |
| addMember | UserPlus | brand member, customer |
| location | MapPin | delivery area, location |
| team | UsersThree | staff |
| transfer | ArrowsLeftRight | stock transfer |
| refund | ArrowCounterClockwise | return decision, refund |
| subscribe | Crown | plan cancel/keep |
| report | Flag | review report |
| cancel | XCircle | order cancel/reject |
| tag | Tag | category |
| key | Key | API key create/revoke |
| success | CheckCircle | key created, webhook added |
| webhook | WebhooksLogo | webhook editor |

All 17 `window.confirm` calls were replaced with `requestConfirmation`, using these intents: delete, remove, removeMember, archive, cancel, stop, copyright, tag.

### Ads (13 dialogs, `intent` added)
| Intent | Icon | Dialogs |
|---|---|---|
| upload | UploadSimple | customer list |
| audience | UsersThree | create audience ×2, ad set |
| edit | PencilSimple | rename, edit ad |
| schedule | CalendarDots | report schedule |
| experiment | Flask | A/B test |
| analytics | ChartLineUp | conversion event |
| dispute | Scales | appeal |
| delete | Trash | draft |
| rule | Lightning | rule editor |
| archive | Archive | bulk archive |
| ads | Megaphone | campaign |

All 5 `window.confirm` calls were replaced, using delete, stop and removeMember.

## Native alerts
- `window.confirm`/`alert`/`prompt`: 0 remain in any app.
- `Alert.alert`/`Alert.prompt` on mobile: 0 remain. The OS permission prompts (camera, mic, location) are system dialogs and were not touched.
- Phosphor import audit: only the icon registries import Phosphor directly. Those are `zudoIcon`/`appIcon`/`icons`/`figmaIcon`/`landingIcons`, webKit `dialogIntent`/`errorState`/`themeSwitcher`, and mobile `components/icons/*`. No feature file imports Phosphor directly.

## Skipped (coordination) and left for later

### Chat files: not edited
They still get the restyle through the shared components.
- **Default icons, chosen from the tone:**
  - mobile `components/chat/*`: documentBubble, locationBubble, pollBubble, voiceNoteRecorder, the optimistic*Sender hooks, chatComposerWithVoiceNotes, chatLocationSheet
  - mobile `components/chatSafety/*`: chatLockGate "Forgot passcode?", sendInChatSheet, streakSheet, inboxRequestActions block
  - `components/chatReport/chatBlockDialog`
  - `screens/messages/conversationInfo` (remove member, leave group)
- **Explicit icons can be added later:**
  - Microphone needed → microphone
  - Forgot passcode → lock
  - leave group → removeMember
  - Remove member → removeMember
  - block → block
- **Still to update:**
  - mobile `chatSafety/shareToChat.hook.tsx` still uses Copy for "Copy link" and ShareNetwork for "Share link". Both should move to Link and ShareFat.
  - In webapp, `chatReport/*`, `messages/*` (newGroup, newMessage, chatComposerTools poll/location, inboxRequestActions, groupMembersSection) and `chats/[id]/info` leave group need an intent added.

### Payments: not edited
These were restyled only through the shared components; their flow logic is untouched.
- `apps/admin/src/components/money/*` (withdrawal, refund, dispute, webhook replay, coin reversal) gets a default intent from its tone.
- seller `addPayoutAccountDialog` and `billing/subscriptionPaymentConfirmation`
- webapp `coinPurchaseDialog` and `subscribeToCreatorDialog`
- ads `billing/topUpDialog` and `payFromBalanceDialog`

### Other
- Mobile `create/clip/clipPreviewStage.tsx` uses a raw RN `Modal` with `presentationStyle="fullScreen"` for the video preview. `FrameAwareModal` doesn't support that option, so it was left as is.
- The admin `SidePanel` is a non-modal details drawer. It already has Esc and focus restore, so it was left as is.
- The seller `commandPalette` already uses a native `<dialog>` with `showModal`, so it was left as is.

## Branded loader

### Web: `packages/webKit/src/loader/brandLoader.tsx` (+ css)
- `BrandLoader({ size: sm 24 | md 40 | lg 64, label, showLabel, fill })` renders the logo mark (the same tile and glyph as the splash, never the wordmark).
- Animation: a CSS breathing scale from 1 to 0.92 with an opacity pulse, using transform and opacity only, over 1.8s.
- Light/dark: it uses `--color-brand-solid`.
- Accessibility: `role="status"` with `aria-live="polite"` and a visually hidden "Loading…" label. With reduced motion the animation is set to none, so the mark is static.
- It is wired into webapp and studio `Spinner`. `InfiniteSentinel` uses `sm`; page and section uses use `md`. This covers the infinite-scroll footers, signup topics, profile redirect and pay-return pages, and the people pickers.
- `InlineSpinner` and the button spinners are unchanged; they are brand-coloured micro spinners.
- All `loading.tsx` files are skeletons, so they were kept as skeletons.

### Mobile: `components/ui/brandLoader.tsx`
- Same sizes as the web version, using `ZudomartLogoMark`.
- Animation: Reanimated `withRepeat(withTiming)` on scale (to 0.92) and opacity, running on the UI thread.
- Accessibility: `accessibilityRole="progressbar"` with a busy state and a "Loading…" label. With reduced motion the mark is static.
- `useBreathingStyle` is exported. `BootSplash` (the screen shown after the native splash while the app boots) starts breathing after 600ms, so the hand-off from the native splash stays seamless.
- 31 `ActivityIndicator` usages were migrated to it:
  - full-screen/page: productForm, userProfileByUsername, profileView, live, clipsFeedState
  - sections / list initial loads: story, storyAnalytics, personalization, accountStatus, tagPeople, placeSearch, sound, soundPicker, threadedComments, gift leaderboard, live pin products, gift picker, battle gift picker
  - infinite-scroll footers: feed, mart, category, saved, quotes, reviews, sound clips, tagged people, comments, story viewers
- Pull-to-refresh stays native. Android now gets the brand colour too: `colors={[colors.primary]}` was added to the 16 direct `RefreshControl` usages, and the hook already had it.

### ActivityIndicators left in place
- **Inline micro spinners (by design):**
  - in buttons: ui/button, modalActions, pillComposer, liveCommentBar send
  - inside icons: clipMediaStage, photoEvidencePicker, payment.screen shield
  - small and next to text: threadReplyBranch, quotedPostCard, promotePost estimate, applicationPayoutStep resolving
- **Payments / payout onboarding (other agent):** payoutSetup.screen, payoutOnboarding/{accountSetupPanel, bankStep, documentStep}, wallet/bankPickerSheet, coins/buyCoinsSheet
- **Chat:** chatLocationSheet ×2

## QA
- tsc is clean for mobile, webapp, web, admin, seller, studio, ads and webKit.
- Mobile jest: 69 suites, 368 tests, all passing. New: `ui/__tests__/modalSystem.test.ts` (7 tests: modal accessibility, Android Back, loading lock, destructive confirm, async double-tap, inline error, close on resolve) and `ui/__tests__/brandLoader.test.ts`. The splash test was updated with a reanimated mock.
- webKit: 21 tests, all passing. They cover the focus trap, markup labelling, the destructive variant, the busy lock, the inline error, and the store's double-submit/error/cancel handling, plus a jsdom test for Esc, Tab trap and focus restore, and the BrandLoader tests.
  - Run them with `cd packages/webKit && ../../apps/webapp/node_modules/.bin/tsx --import ./src/dialog/__tests__/registerCssStub.mjs --test src/dialog/__tests__/dialog.test.tsx src/loader/__tests__/brandLoader.test.tsx`.
  - webKit has no test script, because package.json is untouched. `__tests__` is excluded from webKit's tsc because webKit has no @types/node.
- Web contract/unit tests all pass: webapp 78 + 174, admin 16, seller 31, studio 25, ads 12.
- `next build` for webapp with `WEBAPP_USE_MOCKS=true` succeeds.
