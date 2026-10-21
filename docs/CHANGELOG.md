# Changelog

All notable changes to Zudomart are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — 2026-10-21

### Security — media uploads fail closed

- `MODERATION_FAIL_MODE` now defaults to `hold`; invalid values fail config
  validation, and a missing classifier or an empty frame set follows the
  configured mode instead of silently allowing the upload.
- Uploads whose malware scan is `skipped` are rejected with
  `MALWARE_SCAN_UNAVAILABLE` unless `MEDIA_ALLOW_UNSCANNED=true` is set. The
  local `.env.example` enables that override for development only; production
  must leave it off. The service logs a warning when unscanned uploads are on.

### Notifications — order lifecycle updates

- Buyers and sellers now receive in-app and push notifications for
  `orderGroup.*` events: order placed, payment confirmed, preparing, ready,
  shipped, delivered, completed and cancelled. Sellers receive paid and
  cancelled. Dedicated shipped/delivered/completed events are not duplicated
  by status changes.
- Order-group event payloads now carry the order number and buyer/seller IDs;
  shipped and delivered also carry courier and tracking. The v1 schemas,
  AsyncAPI document and local RabbitMQ bindings were updated.
- Order-group email templates remain unsent because the payloads do not yet
  include line items, payment URLs or recipient names.

### Buyer — direct-payment warning

- The mobile and web checkout payment-mode choosers now warn that choosing
  `direct` removes escrow protection: refunds and disputes depend on the
  seller, and Zudomart cannot hold or reverse the payment. Escrow remains the
  default.

## [Unreleased] — 2026-10-20

### Backend — product parcels and logistics foundation

- Products now store actual weight, length/width/height, package category,
  package count, fragile flag, contents description and declared value;
  variants can override weight and dimensions. Seller create/replace/duplicate,
  the seller product form ("Shipping and packaging") and the seller product
  view persist and return the fields, and the checkout `ProductSnapshot`
  carries them.
- Added hidden `orders` tables for delivery policy, quote, shipment, parcel,
  delivery attempt, shipment event, shipment charge, shipment insurance and
  delivery claim, plus a provider-neutral `logistics.Provider` interface and
  registry. `LOGISTICS_ENABLED` defaults to `false`; no provider delivery
  route, checkout option, provider adapter or provider delivery UI is live.

### Buyer — seller delivery updates

- Buyer order detail on web and mobile now shows the seller-managed delivery
  status, rider name and phone, estimated delivery, attempt count and last
  failed-attempt note, plus courier and tracking when shipped. The fields are
  read from the same order record the seller updates, so a seller's changes
  appear after the buyer refreshes or reopens the order. Product parcel
  metadata remains seller/internal. Provider delivery stays hidden while
  `LOGISTICS_ENABLED=false`.

### Docs — logistics v2

- Added [architecture/logisticsV2.md](architecture/logisticsV2.md): the planned
  V2 provider-delivery design, with Chowdeck Relay as the first adapter. It
  records the seller-managed V1 flow, live quotes, route filtering, checkout
  booking gates, delivery cost allocation, free-delivery and subsidy rules,
  parcel weight/dimensions, insurance, failed delivery/redelivery and the
  provider wallet float. No provider integration is implemented.
- Linked the plan from the architecture and documentation indexes and from the
  marketplace shipping notes.

## [Unreleased] — 2026-10-11

### Payments — Flutterwave only

- 2026-10-11: the previous provider was removed; Flutterwave is the sole
  provider. Defaults (`PAYMENTS_PROVIDER=flutterwave`), Terraform secrets and
  WAF rules, the sandbox stack, smoke journeys and docs now cover Flutterwave
  only; the old adapter, webhook route, IP allowlist and secrets are gone.
  Production go-live still needs live Flutterwave keys, IP whitelisting and
  Flutterwave's written answers (`integrations/flutterwaveMigration.md`).

### Docs — cleanup

- Removed finished or superseded docs: `integrations/bachsMigrationCase.md`
  (decision final: no Bachs; payments move to Flutterwave),
  `verification/finalCheckReport.md`, `verification/darkModeScan.md`,
  `verification/requirementsTraceability.md` (one-off 4–5 Oct reports),
  `architecture/improvementReport.md` (3 Oct snapshot) and
  `verification/securityReview.md` (merged into `security/README.md`).
- Merged `architecture/awsServicesAndIntegrations.md` into
  `awsAndThirdPartyIntegrations.md`.
- Docs from before the provider change now describe Flutterwave.
- New single index: `docs/README.md`; the root README links to it.

## [Unreleased] — 2026-10-09 (batch 3)

### Mobile — services reorganization

- `apps/mobile/src/services/` (92 files) grouped into domain folders
  with at most 6 files each, subfolders where natural: `core`, `auth`,
  `account`, `content`, `feed`, `social`, `clips`, `chat`, `live`,
  `money`, `commerce`, `sellers`, `media`, `moderation`, `catalog`,
  `geo`, `creators`, `ads`, `support` (plus existing `chatCrypto` and
  `__tests__`). All 250+ import sites updated; also fixed two
  pre-existing broken relative imports in `chatCrypto` and the service
  test mocks. Full Jest suite passes.

## [Unreleased] — 2026-10-09 (batch 2)

### Mobile — comment section (X-style)

- Thread sort is now a dropdown with Relevant, Latest and Most liked
  instead of Top/Latest tabs; the dropdown sits opposite the View quotes
  link in the thread header (`ThreadSortDropdown`, `postDetail.screen`).
- Comment rows carry the full action set — Reply, Repost, Like, Bookmark,
  Share — and nested replies inherit the same row (`threadReplyRow`,
  `threadReplyBranch`).
- Reposting a reply opens the parent post reshare sheet; sharing a reply
  sends a permalink to its thread; bookmarking a reply saves it.
- Tapping a comment opens a focused thread screen showing the original
  post, the ancestor chain, the highlighted focus comment and its
  replies (`commentThread.screen`, `fetchCommentThread`).
- Per-reply view counts are intentionally omitted: no per-comment view
  tracking exists server-side, and post-level views are retained.

### Mobile — comment bookmarks (backend wired)

- Saves accept a `comment` target end to end: Prisma enum + migration,
  validators, ownership-checked save handler, saved-views resolution
  with comment previews, `CommentView.bookmarked`, mobile
  `SaveTarget`, mock entries, a Replies filter and text tiles on the
  Saved screen.

### Mobile — stories: ads, analytics, effects

- Sponsored story cards interleave as viewers move story to story (first
  after 2 organics, then every 5), decided through the standard
  `/api/v1/ads/decide` story slot with Python pCTR auction, frequency
  caps and brand safety; cards show the advertiser, CTA, skip control
  and record batched impressions/clicks, so long-story viewers see ads
  and creators earn their revenue share (`storyAds.service`,
  `storyAdSession.store`, `sponsoredStoryPage`, `story.screen`,
  `storyAds.mock`).
- Story analytics screen for authors: views, unique viewers, replies,
  shares, profile visits, new follows, viewer list and an earnings
  entry point for creators (`storyAnalytics.screen`, story options
  sheet, `GET /api/v1/stories/:storyId/viewers`).
- Story capture has the same Effects looks as clips with live preview,
  and stories publish/play looks and sounds (`storyCapturePanel`,
  story viewer, `NewStoryInput`/`StoryView` look + sound).

### Mobile — interface swipe, T&C, profile

- Feed↔Mart switching is now an interface-level horizontal swipe on the
  home screen (feed swipes left to Mart, Mart swipes right back); the
  per-post swipe cards and Mart-only swipe responder are removed, so
  photo carousels keep their own gestures
  (`home.screen`, `feedTab`, `martTab`, deleted `swipeablePostCard`).
- Policy banners only reappear for genuinely new policy versions:
  banner dismissals persist on-device (`policyUpdate.store` persisted).
- The redundant "Acting as" chip is removed from the profile; the
  Instagram-style username switcher at the top is the single switching
  entry, and switching refreshes profile, posts and shop
  (`ownProfileCards`, `profileSwitcher`, `myProfile.screen`).
- Clip comment field removed from the page chrome: commenting happens
  through the comment icon into the comment session sheet
  (`clips.screen`).

### Mobile — watermark, header, composer

- Videos show a TikTok-style `@handle · Zudomart` tag during in-app
  playback (clips and feed video pages); downloads already burn in the
  owner-handle watermark plus the animated brand end-card server-side,
  and screenshots prompt a tagged copy (`videoWatermark`, `clipPage`,
  `mediaPager`).
- Home wordmark is centered between the Feed/Mart tabs and the action
  icons (`homeHeader`).
- Clip preview stage uses proportional flex so the canvas and editing
  panel fit short screens without cut-off (`clipPreviewStage`).

### Mobile — suggestions & sounds

- Suggested-clips row moved deeper in the feed (position 4).
- Not-interested feedback now revises suggestions: disliked posts are
  excluded as before, and topics/hashtags from recent not-interested
  feedback are demoted to the end of ranked results across feed, clips
  and suggested clips (`rankedFeed.service`, `mutedTopics`).
- Every sound surface credits the original owner (`@owner` in clip rows,
  header cards, pickers and story pills).

### Mobile — livestream hardening & gifting

- Live screen shows loading and retryable error states instead of a
  blank view when the session fails to load; join failures surface a
  toast (`live.screen`).
- Gifting verified working: catalog, idempotent sends, balance
  deduction/rollback, combos, leaderboard, goals and stream stats all
  covered by passing contract tests.

### Backend — social (TypeScript)

- Conversation sort `relevant`/`latest`/`likes` (`top` accepted as a
  legacy alias), with offset pagination for ranked sorts
  (`commentThread.repository`, conversation handler/validator).
- Story analytics owner checks accept business-authored stories;
  `GET /api/v1/stories/:storyId/viewers` lists viewers owner-only
  (validator, controller, routes, module wiring).
- `look` allowed on stories (look-only clip edits); story views expose
  `sound` and `look`.

### Verification

- Mobile `tsc --noEmit` clean; full Jest suite passes (36 suites).
- Social `tsc --noEmit` (app + tests) clean; full vitest run passes.
- Go and Python ad/auction paths for the `story` slot kind already
  existed and were reused unchanged.

## [Unreleased] — 2026-10-09

### Mobile — feed & posts

- Moved the "View quotes" entry point off the post card and into the
  comments thread header on the post detail screen, so quotes are
  discovered inside the conversation instead of a standalone row below
  the action buttons (`postCard`, `postDetail.screen`).
- Repost action now uses the round Phosphor `ArrowsClockwise` glyph
  instead of the angular `Repeat` glyph, matching the profile repost tab
  icon (`feedActionIcons`).
- Feed action row order is now Like → Reply → Repost → Views → Save →
  Share, with Like first and comments ahead of Share (`postActionRow`).
- Share action uses the rounded `ShareNetwork` glyph (`feedActionIcons`,
  `Share24Icon`).
- Post captions are word-limited (40 words) with an inline more / Show
  less affordance; full text stays one tap away (`ExpandableText` in
  `postCard`).
- Posts published as a business identity show a "Posted as {name}"
  attribution line under the author row (`postCard`, `Post.postedAs`).
- Swipe on feed cards: swipe right likes, swipe left opens Mart;
  swipe-to-comment was removed (`swipeablePostCard`, `feedTab`,
  `martTab`, `home.screen`).

### Mobile — marketplace

- Product gallery pages one image at a time on both platforms by using
  `snapToInterval` + `getItemLayout` instead of `pagingEnabled`, fixing
  neighbouring images peeking on Android (`productGallery`).
- Active page indicator is now brand blue instead of black, in the feed
  pager and the product gallery (`pageIndicator`, `productGallery`).
- Mart quick-add (+): products with variants open the variant picker
  sheet (size / color / custom options / quantity); variant-free products
  still add instantly (`productMasonry`, `variantPickerSheet`).
- Post "In this post" sheet: every product row has its own add button
  (variant-aware); "Add all to Cart" only appears for multi-product posts
  (`postProductsSheet`, `feedTab`).
- Sellers can define custom variant groups (name + options, e.g.
  Storage, Material) beyond size/color; buyers must pick every required
  option before checkout (`productFormFields`, `productForm.screen`,
  product detail, variant sheet, cart input `variants` → `options`).

### Mobile — clips & live

- Clips keep the bottom tab bar; the top back button is gone
  (`clips.screen`, `clipsHeader`).
- The comment composer is a single fixed bar pinned flush above the
  bottom tab bar instead of scrolling with each page (`clips.screen`).
- Sponsored clips render a minimal rail (More options only); likes,
  comments, shares, saves, views and tips are hidden unless the
  advertiser enables them, double-tap-to-like is disabled, and the fixed
  comment bar is hidden on sponsored pages (`clipActionRail`,
  `clipPage`, `clips.screen`).
- Sponsored lives hide the reaction rail, double-tap likes and share
  actions, and the live comment composer; products, gifts, tips and the
  read-only comment feed stay (`live.screen`, `liveCommentBar`
  `hideComposer`).
- Clip captions are word-limited (20 words); tapping the caption expands
  the rest (`clipDetails`, `ExpandableText`).
- Clip creation has an Effects · Look row (None / Warm / Cool / Rosé /
  Aqua / Sunset) with live preview; the look ships with the post and
  renders identically in feed, clips, fullscreen and composer preview
  (`clipLook`, `clipPreviewStage`, `clipComposer`, `clipPage`,
  `mediaPager`, fullscreen modal).
- Sounds attach to clips and stories only — never to feed posts. "Use
  sound" opens the clip composer with the sound preselected
  (`sound.screen` routes to `mode: "clip"`).
- Stories can attach a sound at capture; the story viewer shows a sound
  pill that opens the sound page (`storyCapturePanel`,
  `createPost.screen`, story viewer, `NewStoryInput.soundId`).

### Mobile — profile & accounts

- Active profile tab shows icon + label; inactive tabs show icon only
  (`profileTabs`).
- Own profile header has an Instagram-style account switcher
  (username + caret) at the top; switching refreshes the profile, posts
  and shop, and the Me screen presents store/brand/business profiles
  with their posts, clips and shop tabs (`profileHeaderBar`,
  `myProfile.screen`, `profileSwitcher`, `users.mock`, `brands.mock`).
- Non-sellers never see a marketplace/store tab, on own or other
  profiles; business/brand/store profiles present like normal profiles
  (posts, reposts, clips, shop) when viewed by others
  (`myProfile.screen`, `userProfile.screen`, `users.mock`
  `findBusinessProfileUser`).
- Streak flame icon renders filled in the fire color (`Flame24Icon`
  `weight: "fill"`).
- Freemium posts are limited to 280 characters with a live counter;
  premium accounts keep 2,000 (`captionField`, `postComposerPanel`,
  `User.isPremium` from the profile API).

### Mobile — chat stories

- Watching someone's stories to the end auto-advances to the next person
  with unseen stories instead of closing the viewer; the viewer remounts
  per person so progress and playback reset (`story.screen`).

### Mobile — drafts

- New on-device drafts box for posts and clips: save from either
  settings step, resume later with media re-uploaded, delete anytime.
  Drafts persist in AsyncStorage and never leave the device
  (`composerDrafts.store`, `draftsSheet`, `DraftsButton`,
  `createPost.screen`, `clipComposer`, `postSettingsStep`).

### Backend — social (TypeScript)

- `POST /api/v1/posts` accepts `asProfileId` (validated UUID of a
  profile the caller owns: personal/business/brand/store) and persists
  `authorProfileId` / `authorProfileKind` on the post (new columns +
  migration `20261006000000_post_author_profile`); `PostView` exposes
  `postedAs`, and profile post listings include business-authored posts
  (validator, command, handler, controller, `postView.service`,
  `post.repository.pageByAuthorOrProfile`, identity directory).
- `POST /api/v1/posts` accepts `look` (allowlisted color look, stored in
  `clipEdit`, exposed on `PostView`); invalid values are rejected with
  `INVALID_LOOK`.
- `POST /api/v1/stories` accepts `soundId`; stories join clips in
  supporting sounds (feed posts still rejected with
  `SOUND_REQUIRES_CLIP`).

### Backend — catalog & orders (Go)

- Buyer `ProductSummaryView` exposes `hasVariants` + `options`;
  `ProductDetailView` inherits them and each `BuyerVariantView` carries
  `optionValues`, so quick-add and variant sheets work without extra
  round-trips (types, buyer presenter, detail handler, checkout
  snapshot).
- `POST /api/v1/cart/items` accepts generic `options`
  (`map[string]string`) and matches them case-insensitively against
  variant option values alongside `variantId`/`size`/`color`
  (`AddCartItemRequest`, `matchesRequest`).

### Security notes

- Acting-profile switches are ownership-checked (`403` for foreign
  profiles) in both the mock and real post-creation path.
- Business profile synthesis in mocks only covers profiles owned by the
  signed-in user; private/blocked/suspended gates still apply to regular
  accounts.
- Drafts contain the author's own unpublished content and are stored
  locally only — never transmitted until published.
- Sponsored content hides engagement affordances client-side; counts and
  enforcement remain server-side.

### Verification

- Mobile `tsc --noEmit` clean; Jest suites for profile, feed, create,
  clips, product, home, live, story, posts, seller, mocks and contracts
  pass (incl. new `profileTabs` and `postProductsSheet` tests).
- Social `tsc --noEmit` (app + tests) clean; `vitest` posts/routes suites
  pass; integration fakes updated for the extended identity directory.
- Go `catalog`/`orders` touched packages build (a pre-existing,
  unrelated `platform/staffauth` breakage in the working tree still
  blocks full-module builds).
