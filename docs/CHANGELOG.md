# Change log — 1–2 October 2026

Every change made today, grouped by app. Standing rule: **any change to `apps/mobile` gets an entry here on the day it lands.** Forward-looking work lives in [plans.md](./plans.md).

Verified: `cd apps/mobile && npx tsc --noEmit` → clean. `cd apps/webapp && npx tsc --noEmit` → clean. `cd apps/studio && npx tsc --noEmit` → clean. `npx jest` in `apps/mobile` → no tests configured (607 files, 0 test matches).

---

## Copyright for videos, clips and sounds, and account status (4 Oct) — go test moderation (unit + integration), media/social/notifications/gateway vitest, email templates vitest, mobile jest, webapp/studio/seller/admin tsx --test, tsc on every touched app

Design: [plans.md §49](./plans.md). Legal wording pending counsel review.

| Area | Change |
| --- | --- |
| go-trust (moderation) | Claims require proof, segments, accuracy declaration and signature; uphold applies the remedy (audio mute order, takedown warning with configurable deadline, immediate takedown for live); deadline worker takes down and strikes; `post.deleted` before the deadline records voluntary removal; copyright policy settings (admin, step-up); copyright strikes last 90 days; thresholds restrict `GOING_LIVE` and open a suspension review; strike expiry announcements; strike appeals; account health for users, admin and internal callers; migration 20261004104548; unit and integration tests |
| services/typescript (media) | `clipAudio.muteRequested/restoreRequested` → `media.muteAudio` job: silent soundtrack rendition, variant swap, `media.processed` + `media.audioMuted/audioRestored`; tests with a faked transcoder |
| services/typescript (social) | Applies audio mute/restore: disables the sound for reuse and fans out mute requests for every clip using it |
| services/typescript (notifications), packages/emailTemplates | Seven copyright and strike notifications with branded emails |
| gateway, contracts, infra/local/rabbitmq | Account status and admin routes; 12 new event schemas, asyncapi, topology and definitions |
| mobile, webapp | Claim form with proof and signature from post, clip and sound menus; Account status page with appeals and counter-notices; countdown banner on the owner's content |
| studio, seller, admin | Account status summaries; admin claim evidence, remedy banner, copyright policy card, user account health with appeal decisions |
| docs | plans §49, help article draft in `services/typescript/support/content/drafts` |

---

## Abuse protection: access probing, bots and human checks (4 Oct) — go test moderation (policy unit + Postgres integration), orders ownership, users build/vet, gateway vitest (1018) + tsc + eslint, social vitest, intelligence pytest + ruff + mypy, mobile jest + tsc, tsc admin/webapp

Design: [plans.md §48](./plans.md), [security.md §10](./architecture/security.md).

| Area | Change |
| --- | --- |
| services/typescript (gateway) | Probe classifier and detector (Valkey sliding windows per account and device), reports to go-trust; 428 `HUMAN_VERIFICATION_REQUIRED` gate for flagged and suspected-bot accounts; `/api/v1/security/human-verification` with Turnstile (hCaptcha-ready) verification, rate limits, no token logging; trust routes for client signals and the admin queue; security env in `.env.example` |
| services/go (go-trust) | `accessSecurity` module, three tables and migration, deterministic policy, automatic temporary suspension, suspected-bot marking, Security cases admin API with step-up and audit, bus consumers, evidence retention, device attestation interfaces |
| services/go (go-identity, orders, staffauth) | Suspension source `security` and reason `SECURITY`; internal `delete` enforcement action; `getMyOrder` returns 404 instead of panicking on an empty view; `security:cases` permission |
| apps/intelligence | `bot_detection` module and `/v1/trust/bot-score` (advisory), bot score publisher to go-trust |
| apps/admin | Trust & safety > Security cases (queue, filters, evidence timeline, devices and networks, challenge history, permission-gated actions), mocks, API contract |
| apps/webapp | Turnstile sheet with automatic retry on 428, `/security-check` page for the app, CSP for challenges.cloudflare.com, test site key in `.env.example` |
| apps/mobile | In-app browser security check with deep-link return and retry on 428; jest tests |
| apps/web, support content | Privacy policy draft disclosure; help article `account-and-login/security-checks.md` |
| contracts, infra | Event schemas and AsyncAPI, RabbitMQ topology/definitions, Terraform gateway secrets and bot queue env |

---

## Checkout: buyer chooses escrow or direct payment per verified store (4 Oct) — go test orders services, webapp tsx --test, mobile jest, tsc webapp/mobile/apiSmoke

| Area | Change |
| --- | --- |
| go-commerce (orders) | Checkout accepts `paymentModes` per seller group; direct only for verified stores (422 `DIRECT_PAYMENT_NOT_ALLOWED`); `order_groups.payment_mode` column (migration 20261004120000) and ent regen; mode and `storeVerified` passed to go-money; `paymentMode` on buyer and seller order views; cart group store info (`verified`, rating); unit tests for the resolver |
| webapp, mobile | Per-seller payment choice on checkout (escrow recommended vs pay directly, Gold badge, trust line), "Protected by Zudomart Escrow" for unverified stores; order detail shows the mode and hides escrow dispute and release copy for direct orders; unit tests |
| apiSmoke | Direct order case (reject unverified, create, pay, seller paid, seller refund books debt). Not run, needs docker: include in the final run |
| store success rate | Orders rolls up 90-day success per store (`store_success_stats`, migration 20261004130000, indexed, 6h sweep); shown only from 20 settled orders; served on store, product, cart and order responses through a new port; tests for threshold and calculation |
| docs | checkoutPaymentFlowPlan 6.3a, seller apiContract |

---

## Help Centre: support service, tickets with reply emails, auto-FAQ from resolved questions (4 Oct) — support vitest (62), notifications vitest, gateway vitest, email templates vitest, intelligence pytest, go test staffauth, tsc admin/mobile/webapp/seller/studio

Design: [plans.md §44](./plans.md).

| Area | Change |
| --- | --- |
| services/typescript (support) | New service: help categories/topics (versioned Markdown, votes, related, search), 82 seeded articles covering every part of the platform, tickets (statuses, SLAs, notes, assignment, ratings, unread, live chat channel, attachments via media URLs), macros, outbox events, auto-FAQ with PII scrubber, dedupe/merge, intelligence writer with template fallback, account-deletion anonymisation, Dockerfile, migrations |
| services/typescript (notifications) | `ticket.created`, `ticket.replied` (staff only) and `ticket.resolved` mapped to the support templates with push and in-app links |
| services/typescript (gateway) | `support` upstream: public help reads, authenticated votes and tickets, admin support and help CMS routes |
| packages/emailTemplates | Support templates: no emoji rating labels, ticket links under `/help/tickets`, no reply-by-email promise |
| apps/intelligence | `POST /v1/help/answer-drafts` (signed, deterministic template, defensive redaction) |
| services/go (staffauth) | Permission `support:helpContent` in the catalogue and Support template |
| infra | RabbitMQ topology and definitions, Terraform service, wiring and gateway upstream |
| apps/admin | Help centre CMS (topics, auto topics, categories, editor with preview, merge, versions, settings); ticket statuses `OPEN/AWAITING_USER/AWAITING_SUPPORT/RESOLVED/CLOSED` and new categories; mocks |
| apps/mobile | Help centre home, category and article screens with votes; ticket unread badges, read marking, ratings; notification routing to tickets; help links from live reports and the views dialog |
| apps/webapp | `/help`, category and article pages with SEO, ticket list, form, thread and rating pages; guest rules; links from settings and orders |
| apps/seller, apps/studio | Help link in the header |

## Fair feed ranking, trends, headlines and the Explore home (4 Oct) — intelligence pytest + ruff + mypy; social vitest + tsc; gateway vitest; go test (admin, moderation); support content test; mobile jest + tsc; webapp tsx tests + tsc; admin tsx tests + tsc

Design: [plans.md §46](./plans.md), [recommendations.md §7](./architecture/recommendations.md).

| Area | Change |
| --- | --- |
| apps/intelligence | capped, disclosed boosts (`ranking_boost_caps_constant.py`), engagement integrity discount + manipulation flags to go-trust, safety filter, explanations; ingestion-time velocity cap and cluster/low-trust discounts; trending per category with manipulation and spam exclusion; `/v1/trending/headlines`; `INTELLIGENCE_SERVER_WORKERS`; consent read folded into one Valkey round trip; `content.sensitivityAdvised` publisher from processed images; tests (fairness, trends, headlines, advisory) |
| services/typescript/social | `explore` module (trends, headlines, who-to-follow, posts-for-you, categories); fair deterministic ranker; signed intelligence feed ranker (250 ms + breaker + fallback); admin ranking settings client; author tiers/Official/country from identity read; DB integrity signals; `PostView.ranking`; tests |
| services/typescript/gateway | `/api/v1/explore/` → social (guest GET); test |
| services/go | admin settings `feed.ranking` (hard caps, tier order, no push fields) and `trending.moderation` (removal only) + `GET/PUT /api/v1/admin/trending/moderation`; moderation `modelVersion` filter on suspension cases; users grant on `admin_created_accounts` |
| apps/mobile | Explore home on the Search screen (headline cards, trends, category tabs, who to follow, posts for you with "Why am I seeing this?"), service, types, mocks, guest access, test |
| apps/webapp | Explore home on `/explore`, service, types, mocks, guest API pattern, test |
| apps/admin | Feed ranking, Trends & headlines and Manipulation flags pages, mocks, validation, nav, API access, test |
| infra | social env (`ADMIN_INTERNAL_URL`, `INTELLIGENCE_URL`, `FEED_RANK_TIMEOUT_MS`, secrets), intelligence workers and media bucket, RabbitMQ publish permission for intelligence |
| docs | help article "How your feed works", terms "How we rank content", recommendations §7, plans §46 |

---

## Regional pricing follow-up: USD web billing, single price book, research-based ad pricing and estimates (4 Oct) — go test (regionpricing, payments, subscriptions, wallet incl. integration, ads, admin incl. integration, users checkmarks), gateway vitest, tsc admin/ads/mobile/seller, contract tests

| Area | Change |
| --- | --- |
| services/go (payments) | `PAYSTACK_SUPPORTED_CURRENCIES` is read (default `NGN,USD`) |
| services/go (subscriptions, wallet) | Web prices fall back to the US price in USD with `billingNote: "Billed in USD"`; `canBuyOnWeb`; `422 WEB_CURRENCY_NOT_ENABLED` when neither the region currency nor USD can be charged; legacy NGN price overrides removed (price book only); wallet integration tests updated for the regional coin catalogue |
| services/go (admin, users) | `checkmark-pricing` keeps bundle and grace rules only; suggestion emails quote the regional default price; seeded-settings test counts 12 |
| services/go (platform, ads) | Research-based floors and suggested CPM/CPC/CPV and budgets per region; `EstimateCampaign` (duration, per-region split by audience size, FX notes, cost per result) and regional boost packages; `POST /api/v1/ads/pricing/estimate`; richer `/api/v1/ads/pricing`, boost options and boost estimates; tests |
| services/typescript (gateway) | `/api/v1/ads/pricing` accepts POST |
| apps/admin | "Plans & prices" → "Plans & perks" (prices removed, links to Regional pricing); checkmark pricing editor without prices; regional editor shows suggested bids and budgets |
| apps/ads | Budget step shows the cost picture (suggested and minimum budgets, totals for the schedule, per-region breakdown with FX notes); mocks |
| apps/mobile | Boost screen shows regional packages with reach, impressions, cost per result and the minimum daily budget |
| apps/seller | `regionalPrices.test.ts` typing fixed |
| docs | pricing.md §5 (benchmarks, floors, estimates, boost packages), §7 (USD decision, owner setup checklist) |

---

## Regional pricing for checkmarks, Premium, coins, creator bands, boosts and ads (4 Oct) — go test (platform/regionpricing, subscriptions, wallet, ads, admin), gateway vitest, tsc admin/ads/mobile/studio

Design and research: [pricing.md](./pricing.md), [backendPlan.md §4.8](./backendPlan.md).

| Area | Change |
| --- | --- |
| services/go (platform) | `regionpricing`: regions NG/GH/KE/ZA/GB/EU/US with US/USD fallback, storefront parsing (Apple alpha-3, Play alpha-2), resolution storefront > profile > CDN/IP > client hint > US, price-point rounding, default plan/coin/creator-band/ad price book, FX conversion and strictest-floor maths; `staffaudit` HTTP recorder for the admin audit log; tests |
| services/go (subscriptions) | `plan_prices` gains yearly, iOS and Android monthly/yearly and store product ids (migration `20261004120000_regional_plan_prices`); seeds every region; channel-aware quotes; explicit yearly prices; unknown countries and uncharged web currencies use the US price; store receipts map product ids through the price book; `GET /api/v1/pricing/region|plans|creator-subscription-bands`; audited admin price edits |
| services/go (wallet) | Coin packs priced per channel × 7 currencies (tier 6 added, store ids `com.zudomart.app.coins.tierN`), missing currencies merged into existing packs, pricing currency from the region resolver (no `?currency` on purchases), store receipts matched per platform, audited price edits |
| services/go (ads) | Floors, minimum budgets and boost minimums per targeted region in the billing currency (FX from the currency schema), bid floors on max CPM/CPC, viewer-region auction reserve, `GET /api/v1/ads/pricing`, USD `reportingSpend`; creator share unchanged (test) |
| services/go (admin) | Platform setting `regional-pricing` (validated, versioned, audited, public) |
| services/typescript (gateway) | Routes `/api/v1/pricing/*` (money) and `/api/v1/ads/pricing` (ads), optional auth; forwards `X-Client-Platform`, `X-Store-Storefront`, `CloudFront-Viewer-Country` |
| apps/admin | Configuration → Regional pricing (plan price book, coin packs, ad floors and creator bands), step-up and reason on every edit, mocks and seed |
| apps/ads | Budget step shows the minimum daily budget for the targeted regions from `/ads/pricing`; mock route |
| apps/mobile | Store billing adapter (`storeBilling.service.ts`): sends `X-Client-Platform` and `X-Store-Storefront` when a native store module is installed; coin packs bought in the app use the server's `storeProductId` and redeem via `/api/v1/coins/iap/receipts` |
| apps/seller, apps/studio | Removed hardcoded ₦50 verification-charge and withdrawal-fee copy |
| docs | `pricing.md` rewritten with per-region tables, research and Paystack constraints; `backendPlan.md` §4.8 |

## Seller prices per country, region-based product visibility, 30-day deletion grace (4 Oct) — Go, search and social tests; tsc per app

Design: [plans.md §45](./plans.md).

| Area | Change |
| --- | --- |
| services/go (catalog) | Variant `regionalPrices` (jsonb) and store `shippingCountryCodes` (migration `20261004090000`); buyer lists, store pages, related products, product detail (404 `PRODUCT_NOT_AVAILABLE_IN_REGION`), share cards (`not_in_region`) and search sources filter by the viewer country; sellers and store members still see their own products; `priceIsRegional` and `approxPrice` on product views; tests |
| services/go (orders) | Cart and checkout price lines for the delivery country (regional price in its own currency; non-shipping sellers become unavailable); shipping rule saves and deletes sync the store's deliverable countries to the catalog and reindex its products |
| services/go (platform) | `viewerregion` (profile, proxy-resolved IP header, client hint; FX reader over the currency schema) captured for every request; `commerceports` regional resolve and shipping-countries ports |
| services/go (auth, users) | `USERS_DELETION_GRACE_DAYS` default 30; a password or social login during the grace cancels the deletion and returns `notice: "Your account deletion has been cancelled"`; tests |
| services/typescript (search, social) | `shippingRegions` on product documents (migration) and a region filter in search; share cards carry `not_in_region` |
| apps/seller | "Prices by country" section in the product editor (all plans), validation, mocks, contract test |
| apps/mobile, apps/webapp | "approx." prices, "Not available in your region" product state, 30-day delete-account copy, login notice toast |
| packages/emailTemplates | `accountDeletionScheduled` says the account is permanently deleted in 30 days, log in to cancel |

---

## Birthday and Zudoversary celebrations (4 Oct) — go test (users utils), notifications vitest, emailTemplates vitest, mobile jest, webapp unit tests, tsc per app

Design: [plans.md §47](./plans.md).

| Area | Change |
| --- | --- |
| services/go (users) | `celebrations` module: `GET /users/me/celebrations`, `POST /users/me/celebrations/seen`, `PATCH /users/me/celebrations/settings`; `birthdayToday` and `anniversaryToday` on profile views (age and date of birth never exposed to others); hourly timezone-aware anniversary scheduler (08:00 local, idempotent) emitting `account.anniversaryReached`; migration `20261004030000_add_celebrations`; unit tests for timezone edges (UTC midnight vs Lagos, London, Los Angeles), leap days and the first-year rule; integration tests (skipped without Postgres) for once-per-day, self-only age, privacy opt-out and a single email event |
| services/contracts | `account.anniversaryReached` schema, asyncapi message, notifications consumer row |
| services/typescript/notifications | `milestones` preference category, `milestones.mapping.ts`, fixture |
| packages/emailTemplates | `zudoversary` template (category `milestones`, transactional) with tests |
| apps/mobile | Reanimated balloons (tap to pop), static confetti under reduced motion, app-open overlay, own-profile and visitor profile layers, Zudoversary pill, Birthday balloons switch, mock routes, jest tests |
| apps/webapp | CSS/SVG balloons, reduced-motion confetti, app-open dialog, profile layers, privacy switch, mock routes, unit tests |

---

## Link previews, /username links, guest view-only, product SEO, create gating (4 Oct) — tests and tsc per app/service; one `next dev` curl check

Design: [plans.md §41](./plans.md).

| Area | Change |
| --- | --- |
| services/typescript/social | `linkPreviews` module: unfurl on post create and on demand, `GET /link-previews/resolve`, SSRF guard (IPv4/IPv6 private ranges, pinned socket, re-validated redirects, caps), OG/Twitter/oEmbed parser, `link_preview_cache` + `posts.linkPreview` (Prisma migration), image proxied through media; SSRF and unfurler tests |
| services/typescript/media | Internal intents accept `post`; `POST /internal/v1/media/:mediaId/complete` (owner-checked); test |
| services/typescript/gateway | Anonymous non-GET refused with 401 except auth/consent/unsubscribe/webhooks; `link-previews` route; test hitting every mutating route anonymously |
| services/go | Reserved usernames cover all web app routes (+ test); go-catalog `SellingStoreMember` (`STORE_NOT_APPROVED`) on create/publish/duplicate (+ test); go-live creator gate test |
| apps/webapp | SSR `/p/<slug>-<id>` (metadata, JSON-LD Product/Offer/AggregateRating/Breadcrumb/Organization), SSR `/store/<id>` (new) and `/<username>` (ProfilePage), 308s for `/product`, `/u`, `/user` in `proxy.ts`, `sitemap.xml` index + paginated sitemaps, `robots.txt`, link preview cards (external + internal), share links on `NEXT_PUBLIC_SITE_URL`, clip like button, creator gating, Buy now/Add to cart fix, reserved-route sync test, mocks |
| apps/mobile | `webAppLinks` share links (`app.zudomart.com/<username>`, `/p/<slug>-<id>`), deep linking config + `UserProfileByUsername`, feed link cards (in-app browser, risky-domain sheet, rich internal cards), create pill Product/Live gating + `RoleGateScreen`, guest telemetry skipped, guest gaps fixed, live-ended share, mocks, tests |
| apps/web | `Organization` + `WebSite` JSON-LD |
| apps/seller | Contract: `403 STORE_NOT_APPROVED` |
---

## Views help, quotes, reply controls, deep threads, sensitive content (4 Oct) — social, search, gateway vitest; go-auth `go test`; mobile jest; webapp unit and contract tests; tsc per app

Design and contract: [plans.md §42](./plans.md).

| Area | Change |
| --- | --- |
| services/typescript/social | Reply policies enforced on every comment and reply, subscriber-only posts limited to approved creators, quotes (`isQuote`, `quoteCount`, `GET /posts/:id/quotes` with privacy filtering), threads of any depth (`depth` + materialised `path`, `GET /posts/:id/thread`, nested `GET /comments/:id/thread`, one-query subtree delete), sensitive labels from poster, moderation and advisory scores, age-gated reads (feeds, profiles, threads, quotes, direct links), content preferences, migration with backfill |
| services/typescript/search, gateway, go auth/moderation | Search drops `restricted_for_minors` posts for non-adults; gateway forwards the token's age bracket and routes content preferences; access tokens carry an `age` claim (never the birthday); `content.visibilityChanged` can carry `labels`; RabbitMQ binds `content.sensitivityAdvised` to social |
| apps/mobile | Centred Views dialog with "Learn more" to the new About views help article, "View quotes" with a quotes screen, composer "Who can reply", Subscribers only and Mark as sensitive, "Edit reply settings" on own posts, locked composer note when replies are restricted, indented threads with "View thread" drill-in, sensitive-content interstitial remembered per post, Settings → Privacy → Content preferences, mocks |
| apps/webapp | Centred Views dialog with `/help/views`, "View quotes" and `/post/:id/quotes`, reply settings control and restricted composer, indented threads with focus drill-in, sensitive-content interstitial, content preferences in Privacy & Data, mocks |

---

## Rich ad formats (4 Oct) — go-ads `go test`; tsc per app; mobile jest; ads and webapp contract tests

Design and contract: [plans.md §43](./plans.md) and `apps/ads/apiContract.md`.

| Area | Change |
| --- | --- |
| services/go/modules/ads | Creative `type` (single, carousel 2-10 cards, app_install with iOS/Android/web store links and deep links, promoted_post), new CTAs and `app_store` destination, UTM builder, https and store-URL validation, review-time destination checks (blocked domains, shorteners, raw IPs), signed click tokens plus `GET /api/v1/ads/r/{token}` redirect that only resolves the creative's own destination, `card_view` events and `ad_card_stats_dailies` with `GET .../ads/{adId}/cards/report`, review payload with cards and app. Tests: no open redirect, platform link selection, carousel validation |
| apps/ads | Ad type picker, carousel card editor with reordering, app-install fields with store URL validation, UTM builder, media-click option, previews for feed, comment thread, reels and mart, per-card results on the ad page, mock backend and review scanner updated |
| apps/mobile | Carousel, app-install row and tappable media in dedicated sponsored components, in-app browser for external links, deep link or store for installs, in-app navigation for internal targets, signed-token impression, click and card-view events, "Promoted" label, ad posts excluded from the swipe-to-like gesture, comment-thread ads support all formats, mocks added |
| apps/webapp | `sponsoredAd` components (carousel with `data-swipe-ignore`, app install, media link), feed ad posts excluded from swipe, thread ads support all formats, ad events carry tokens, mocks added |

---

## Studio landing redesign (4 Oct) — `apps/studio` tsc and `next build` clean

| Area | Change |
| --- | --- |
| apps/studio | Public landing (`/`) rebuilt as a sibling of the Dashboard, Ads and zudomart.com landings: same floating deep-blue header pill with yellow Sign in and full-screen mobile menu, mono ticker band, 20 px cards, FAQ accordion, brand-blue CTA panel and deep-blue footer with giant wordmark and theme switcher. New sections: hero with an HTML/CSS live battle stage (LIVE badge, blue vs yellow score bar, gift combo toasts, gift goal, phone live, example earnings card), "Go live your way" tabs (phone, OBS/WHIP with a real control room screenshot, up to 10 on stage), live features bento (gifts, battles, overlays, moderation, ZudoPoints, replays, analytics, Blue checkmark), earnings band (gifts, 80% of fan subscriptions, ad revenue share, ₦50 payout fee), creator categories carousel, three-step Creator Program flow, FAQ and final CTA. Copy principles and references in [design/studioLandingReferences.md](./design/studioLandingReferences.md) |
| apps/studio/public | 11 Unsplash photos of African creators as WebP (44–177 KB) in `public/photos/`, credited in `apps/studio/mediaCredits.json`; Studio control room (dark and light) and overlay editor screenshots in `public/screens/`; unused `viewerLiveScreen.webp` removed |

---

## Live-stream safety (4 Oct) — Go, Python and TS unit tests; tsc per app

Design, thresholds, cost per stream-hour and legal notes: [architecture/liveSafety.md](./architecture/liveSafety.md).

| Area | Change |
| --- | --- |
| apps/mobile | Live viewer menu and a long-press on the host chip open a live report sheet (child safety, self-harm and violence marked urgent, self-harm support resources, optional details, auto-attached moment and frame reference, 60 s cooldown, guests through `requireAuthThen`); "Report @host" files an account report. Viewers get a blurred "This live is paused while we review it" overlay; the host gets a banner with the reason and an appeal sheet. Realtime `live.safety.*` events refresh state; mocks use `live_safety_paused` |
| apps/webapp | `/live/[id]`: live report dialog with the same reasons and context, blur overlay for viewers while paused, host banner with appeal |
| apps/studio | Control room shows the safety hold or warning with the reason and an appeal form, and a "Guests on stage" card where the host can report a guest |
| apps/admin | New Trust & safety page "Live incidents" (`/moderation/live-incidents`): urgent and paused first, latest and flagged frames with labels and confidence, transcript snippets, viewer reports, host appeal; Keep live, Keep paused, End live, End + suspend (step-up), all audited; mock handlers and queue counter |
| go-live | `live_safety_states` table; frame sampler (LiveKit egress image outputs to S3, newest frame every 5 s, 2 s when boosted) enqueues `liveFrame.captured`; optional audio segments (`liveAudio.segmentCaptured`); consumes `live.safetyHold/Released/Warning`, `live.samplingBoosted`, `live.moderatorEnded`; holds mute publishers and revoke `canPublish`; `GET /api/v1/lives/{id}/safety` and `safety` on the session view |
| go-trust | `liveSafety` module: incidents, signals and legal reports tables; policy (severe + 0.90 hold, 0.70 warn, 5 reports in 3 min surge, repeat-offender threshold), report hook with live context, `intelligence-trust-live-safety` consumer, admin endpoints, host appeal `POST /api/v1/live-safety/{liveId}/appeal`, strikes on moderator decisions, S3 evidence vault and frame previews; classifier content scores no longer change live visibility |
| intelligence | `live_safety` module: `RekognitionImageModerationModel` (DetectModerationLabels, MinConfidence, label to category mapping), transcript scorer, Transcribe batch transcriber, CSAM hash-match hook (disabled by default), score publisher and job consumers; NoSignal stays the default without AWS credentials; recorded fixtures in tests |
| social, gateway, realtime | Social accepts `targetType: live`, `scam`, `intellectual_property` and `liveContext`; urgent priority for live child safety, self-harm and violence. Gateway routes `/api/v1/live-safety` and `/api/v1/admin/live-incidents` to trust. Realtime routes `liveSafety.paused/resumed` to `live:<id>` and `liveSafety.hostNotice` to `user:<hostId>` |
| Contracts and infra | 11 JSON schemas and AsyncAPI channels; RabbitMQ topology and definitions regenerated; env examples; Terraform least-privilege IAM for Rekognition, Transcribe, capture prefixes and evidence writes, prefix-scoped `s3:ListBucket` via statement conditions, 1-day lifecycle on `live-safety/` |

## Feed views for everyone (4 Oct) — verified with tsc per app

| App | Change |
| --- | --- |
| apps/mobile | Every feed post shows the Views (analytics) icon with a compact count; owner taps open `PostAnalytics`, everyone else gets a "Views" Dialog. `PostAnalytics` type, mock and screen extended (engagements, rate, saves, shares, clicks, new follows, video, audience). Clips unchanged. |
| apps/webapp | Same in `postActions.tsx` (non-owner button opens a sheet Dialog) and `/analytics/post/[postId]`. Plans section 11 rule updated. |

## Feed swipe & X-style comments (4 Oct) — verified with tsc per app

| App | Change |
| --- | --- |
| apps/mobile | `SwipeablePostCard` (`components/feed/swipeablePostCard.tsx`, PanResponder + Reanimated; gesture-handler is not installed) on the home feed: swipe right likes with haptic and heart pop, left opens post detail, threshold 28% or fling, pink/blue hints, reduced-motion fade, no swipe from multi-item media pagers, screen-reader actions. Post detail rebuilt as an X-style conversation (`components/feed/thread/*`): connector lines, Show replies, Top/Latest, Author badge, Promoted items from ads decide (`feedCommentThread`), sticky "Post your reply" composer, skeleton/empty/error states. New `postThread.service.ts`, `types/postThread.type.ts`, `mocks/postThread.mock.ts`. Single-image pagers no longer scroll. Clips comments unchanged. See plans section 40. |
| apps/webapp | Touch-only swipe on home feed cards (`postSwipe.hook.ts`, pointer events, `(pointer: coarse)`); desktop keeps buttons. Post page uses the new `ConversationPanel` with the same thread, ads and sticky composer; watch page keeps `CommentsPanel`. Matching service, types and mocks. |

## Feed action icons, X-style (4 Oct) — verified with tsc per app

These icons intentionally depart from the original Figma by owner request: X/Twitter is the reference, Instagram is a secondary reference. The glyphs are original drawings in that visual language; no X or Instagram paths or assets are used.

| App | Change |
| --- | --- |
| apps/mobile | New outline set at 1.8px on a 24px grid in `components/icons/custom/feedActionIcons.tsx` (reply, repost, like/filled, views, bookmark/filled, share, send, gift). `PostActionRow` and `PostActionButton` in `components/feed` replace the post card's counters on the feed and post detail: one row spaced edge to edge, counts beside each icon including saves (compact 1.2K, hidden at 0), 44px targets, a tinted press halo (reply/bookmark brand blue, repost green, like pink), filled active states with a pop that respects reduced motion. Views stay owner-only. The clip rail uses the same set (send for share, gift for tips) in its vertical layout. Unused `BrandLine24`, `Heart24Alt` and `Bookmark24` icons and their SVGs are removed. |
| apps/webapp | The same glyphs in `components/ui/icons.tsx`. New `PostActions` (`components/feed/postActions.tsx`) on post cards in the feed, post detail and profile tabs: hover/focus halo, tinted counts, pop on toggle, repost via `postsService.repostPost`, share opens send-in-chat. `SaveToggleButton` and the clip rail use the new icons. Unused `bookmarkSimpleFill24` is removed. |

## go-money follow-ups (4 Oct) — Go tests with Postgres

| Area | Change |
| --- | --- |
| Checkout | one Paystack transaction per checkout with a dynamic split for direct groups; escrow groups held per group; per-group partial refunds; direct settlements reconciled per group |
| Ads | `ads_money.proto` generated with buf (Go, TS, Python); wallet serves `AdsMoneyService` on the money gRPC server; go-ads calls it (`ADS_MONEY_GRPC_ADDRESS`, `ADS_MONEY_INTERNAL_TOKEN`) with the internal HTTP endpoints as fallback (`ADS_MONEY_HTTP_URL`) |
| Identity | goIdentity consumes `entitlement.granted|revoked|graceStarted` (`USERS_ENTITLEMENT_EVENTS_QUEUE`): Blue/Gold/Black checkmarks (Gold only after KYB), seller plan + trial state and Premium on `profile_signals` |
| Trials | `auth.accounts.phone_hash` readable by money; one trial per phone enforced |
| Payout onboarding | the ID-document step is never required on Paystack |

## go-money on Paystack (3 Oct) — Go tests with Postgres

| Area | Change |
| --- | --- |
| Provider | Bachs adapter, fake, fixtures, config and env removed; Paystack adapter behind `FullPaymentProvider` (transactions, splits, transfers, recipients, subaccounts, refunds, disputes, plans, subscriptions, saved cards, settlements), webhook HMAC-SHA512, fake Paystack API and recorded fixtures |
| Fees | escrow fee 1.5% (1% Business) + Paystack fee paid by the seller, separate ledger lines; no commission; direct orders pass only Paystack's fee to the seller |
| Payout accounts | queued recipient/subaccount jobs with retries, dead letter, "Try again", reconciliation; plans §38 routes and `GET /payments/payout-fees`; withdrawals refused until verified; `payoutAccount.*` events and schemas |
| Subscriptions | new module: per-country price table, trials with eligibility and reminders, bundle vs yearly, Black grace, IAP, internal entitlements endpoint |
| Wallet | prepaid ad balances (top-ups, spend batches, boost debit/refund), seller reserve %, creator earnings paid by transfer after verification |
| Escrow | commerce refunds (`orderGroup.refundRequested` on `money-domain-events` and an internal endpoint); escrow events carry `orderNumber` |
| Messaging | money publisher on the RabbitMQ factory; `money-domain-events` queue in the topology |

---

## Paystack frontend migration (3 Oct) — verified with tsc per app, mock mode only

| App | Change |
| --- | --- |
| apps/webapp | `@paystack/inline-js` loaded dynamically on checkout, coin and creator-subscription flows with redirect fallback (`utils/paystackCheckout.util.ts`); checkout lists server channels instead of a provider picker; provider is Paystack only; return pages say "Confirming payment…"; mocks return `authorizationUrl`, `accessCode`, `reference`, plus `GET /payments/channels`. |
| apps/seller | Plan and trial checkout opens the Paystack Popup; provider union is `"paystack"`; order payment panel shows "Payment processing fee" and "Escrow fee (1.5%)" (direct orders: processing only); plan cards say "1.5% escrow fee" / "1% escrow fee on Business"; demo order payouts no longer apply a 5% cut; apiContract updated. |
| apps/ads | Top-ups and card setup open the Paystack Popup, Flutterwave removed, allowed checkout host is `checkout.paystack.com`; mocks return `accessCode`. |
| apps/mobile | Checkout shows server channels, optional "save card on this device", saved card paid after a biometric prompt (`authorization_code` and brand/last4/expiry in SecureStore, sent only at charge time), "Saved on this device" with remove under Payment Methods; payment screen confirms server-side ("Confirming payment…"); payout onboarding copy has no provider names and the ID step is conditional (`requiresDocumentStep`). |
| apps/mobile | Media uploads: chunks go straight to S3 via `GET .../chunks/:i/url` presigned PUT (no gateway, no auth header), resume from the service chunk list, abort on cancel; images re-encoded to JPEG (HEIC/HEIF included, EXIF dropped) up to 4096px; types add `document`, `mediaId`, `pageCount`, `failureReason`, blurhash; mocks serve the url and delete routes. tsc clean, not on a device. |
| apps/mobile, apps/webapp | Size-adaptive uploads: follows server plan `mode`/`partSizeBytes`/`partCount` (single PUT under 8 MB, 4 parallel parts above, only failed part retried, batch presign `POST .../chunks/urls` with per-part fallback); post publishes as soon as the session returns `mediaId`; draft thumbs show a progress ring and blurhash. Webapp has no uploader, only its mock and types updated. tsc clean. |
| apps/studio | "Get paid" mirrors the mobile onboarding changes (conditional ID step, neutral copy). |
| apps/admin | Trial copy says Paystack. |

---

## apps/mobile

### Per-domain real API switch, list envelopes, identity contract (3 Oct) — verified with tsc and jest, not on a device

| File | Change |
| --- | --- |
| `config/api.config.ts`, `types/env.d.ts`, `.env.example`, `app.json` | `EXPO_PUBLIC_REAL_API_PREFIXES` (comma list) sends matching paths to the gateway while mocks stay on; default API URL is the gateway `:8080`. |
| `services/apiClient.service.ts`, `payments`, `media`, `mediaUploadTransport`, `realtime` services, live gift hooks | Mock branch decided per path (`shouldUseMockForPath`). Page envelopes keep `nextCursor`; new `api.getPage` and `api.getList`. |
| `users`, `orders`, `brands`, `geo`, `live`, `liveGuests`, `messages`, `notifications`, `disputes`, `coins`, `banks`, `wallets` services | List reads use `getList` (bare array or `{data,nextCursor}`). Mocks for profiles, addresses, countries, geo, suggested lives and viewers return `{data,nextCursor}`. |
| `services/profileImageUpload.service.ts`, `screens/profile/editProfile.screen.tsx`, `mocks/users.mock.ts` | Avatar and banner go through `POST /users/me/media/upload-intents` and are saved as `avatarMediaId`/`bannerMediaId`. |
| `services/auth.service.ts`, `mocks/username.mock.ts`, `mocks/auth.mock.ts`, `types/account.type.ts`, `types/cartOrder.type.ts`, `types/geo.type.ts` | `SOCIAL_SIGN_IN_NOT_CONFIGURED` maps to the not-configured error; username codes (`USERNAME_TAKEN`, `USERNAME_INVALID`, `USERNAME_UNAVAILABLE`, `USERNAME_CHANGE_TOO_SOON`) and policy fields; address `countryCode`; geo country `code`; empty `name` falls back to `username`. |
| `mocks/index.ts` | `GET /lives/suggested` registered before the creators `/lives/:liveId` route that shadowed it. |
| `contracts/*`, `package.json`, `tsconfig.json` | Dependency-free contract schemas and a jest test that validates mock responses (`npx jest`, 24 tests pass). |


### Payout onboarding "Get paid" (§38, 3 Oct) — not tested on a device

| File | Change |
| --- | --- |
| `screens/wallet/payoutSetup.screen.tsx`, `components/payoutOnboarding/*` | **New.** Four-step flow (identity with BVN or NIN, business, bank with live name match, secure ID verification), per-step sync badges, account setup and retry panel, Pending review, Action needed and Verified status, resume, shared seller and creator account. |
| `services/payoutOnboarding.service.ts`, `types/payoutOnboarding.type.ts`, `mocks/payoutOnboarding.mock.ts`, `mocks/banks.mock.ts`, `mocks/index.ts` | Contract and mocks for onboarding, retry, fresh document link, payout fees. |
| `screens/wallet/withdraw.screen.tsx` | Locked until verified ("Finish payout setup"), published flat fee and arrival estimate from the fees endpoint, fee counted in the balance check. |
| `screens/creator/creatorDashboard.screen.tsx`, `screens/wallet/wallet.screen.tsx`, `screens/seller/sellerDashboard.screen.tsx`, `navigation/*` | Entry card (verify-to-withdraw amount, 24h lock countdown for sellers), `PayoutSetup` route. |

### Emojis replaced with vector icons (owner, 3 Oct) — not tested on a device

| File | Change |
| --- | --- |
| `components/icons/custom/*` (flame, heartBroken, bellSlash, trophy, medal, crown, handshake, lightning, flag, swords, users, microphoneSlash, signOut, hand, hourglass), `components/ui/iconRow.tsx`, `bulletLine.tsx` | New Lucide-geometry icons (24px grid, 1.5 stroke, themed ink) and two layout helpers. |
| `chatSafety/streak*.tsx`, `chat/conversationRow.tsx`, `screens/messages/conversationInfo.screen.tsx`, `live/battle/*`, `live/guests/*`, `live/gifts/liveGiftGoalBar.tsx`, `store/storeProfileHeader.tsx`, bullet lists in settings, creator and sheets | Streak flame and broken heart, mute bell, lock, battle trophy, draw, MVP star, coin, crown, stage rail glyphs, ratings, ticks and list bullets are icons. Chat emoji panel, reaction pickers and live reaction rail stay emoji (content). |

### Modal & dialog system, policy update redesign, live polish (§36, 3 Oct) — not tested on a device

| File | Change |
| --- | --- |
| `components/ui/dialog.tsx`, `dialogHost.tsx`, `store/dialog.store.ts`, `modalActions.tsx`, `modalChrome.constant.ts`, `fullScreenModal.tsx` | **New.** Themed `Dialog` (icon slot, up to 3 actions, haptic on destructive), queued `showDialog()`, `FullScreenModal`, shared modal palette, tones and motion. |
| `components/ui/bottomSheet.tsx` | Handle, subtitle, close chip, `scrollable`, sticky `footer`/`footerActions`, fade and slide, dark border, tuned scrim. Same props as before. |
| `components/ui/toastHost.tsx`, `store/toast.store.ts` | Toast tones, icon and animation. `showToast(text, { tone })` works with existing calls. |
| `utils/crossPlatformAlert.util.ts` | `showAlertWithButtons` now opens the themed Dialog (no native alert or `window.confirm`). |
| `navigation/root.navigator.tsx` | Mounts `DialogHost`, also over the suspended and re-accept screens. |
| `components/legal/*`, `hooks/usePolicyUpdates.hook.ts`, `types/policyUpdate.type.ts`, `mocks/legal.mock.ts` | Policy banner card, "What changed" sheet, `PolicyDocumentCard`, re-accept screen with checkbox gate and data and delete choices, `whatChanged[]`, `acceptAllPending`. |
| `components/escrow/confirmActionSheet.tsx`, `components/settings/deleteAccountSheet.tsx`, `themePreferenceSheet.tsx`, `components/auth/guestAuthSheet.tsx` | Confirmations moved to Dialog; delete account, theme and guest sign-in sheets redesigned. |
| `screens/messages/conversationInfo.screen.tsx`, `components/profile/profileMoreSheet.tsx`, `components/live/guests/liveGuestsSheet.tsx` | New confirmations: leave group or channel, remove member, block, remove guest. |
| `components/live/**`, `screens/live/*`, `types/models.type.ts` | Live theme pass, glass tokens (`liveSurface.constant.ts`), redesigned header, comment bar, comments feed (`kind: "follow"`), join card, invite prompt, battle and gift sheets, live-ended screen. |
| `components/ui/actionSheet.tsx`, `clips/commentRow.tsx`, `clips/clipCommentsSheet.tsx`, `moderation/contentOptionsSheet.tsx`, `chatReport/*`, `chat/chatAttachmentMenu.tsx`, `chat/chatsOptionsMenu.tsx`, `chat/messageReactionPicker.tsx`, `chatSafety/inboxFolderMenu.tsx`, `home/topicFilterRow.tsx`, `profile/profileSwitcher.tsx`, `create/liveMonetizationSheet.tsx`, `create/soundPickerSheet.tsx`, `feed/mediaLightbox.tsx`, `media/landscapeVideoFullScreenModal.tsx` | Second pass: shared ActionSheet, popover surface and media glass. Every remaining sheet, menu and viewer is restyled; behaviour unchanged. |

### Chat reporting (§37, 3 Oct) — not tested on a device

- `components/chatReport/*`: report sheet (reason, evidence picker, confirmation), header options menu, block dialog, launcher hook. Entry points: chat header menu, long-press "Report message", group info (group and member), Requests and Spam rows. Evidence is built on the device with a SHA-256 integrity hash (`utils/chatReportEvidence.util.ts`).
- `types/chatReport.type.ts`, `services/chatReports.service.ts`, mocks `chatReports.mock.ts` (validation, rate limit 5 per hour, report and block, restrict, entries in `GET /reports/me`).

### Creator = personal account upgrade (owner, 2026-10-03)

- `ActingProfile.kind` no longer has `creator`; the Personal profile carries `creatorStatus` (`none|pending|approved|rejected|suspended`). Profile switcher lists Personal, Business, Brand, Store only. `useCreatorEntry` reads the personal account's creator status; Settings row reads "Switch to creator account" / "Creator application status" / "Creator tools". Blue stays on the Personal profile, creator-enabled or not.

### Reply to comments with video (§35, 3 Oct) — not tested on a device

- `components/clips/videoReply/*`: draggable/pinch sticker, create-flow stage, playback overlay, "Replying to" link, "Replied with video" chip. Comment row, thread, sheet, controller, `ClipPage`, `ClipDetails`, create screen and composer panel wired in (author only).
- Types: `replyToComment`, `stickerLayout`, `Comment.videoReplies`, notification kind `videoReply`. Mocks: post create validation, `GET /comments/:id`, notification.

### Referral and purchase loyalty/cashback removed (owner, 2026-10-03); Seller-funded store rewards (owner, 2026-10-03)

| File | Change |
| --- | --- |
| `screens/wallet/referral.screen.tsx`, `types/rewards.type.ts`, `services/rewards.service.ts`, `mocks/rewards.mock.ts`, `components/wallet/loyaltyCard.tsx` | **Deleted.** Referral, loyalty and cashback. |
| `navigation/*`, `config/guestAccess.config.ts`, `settings.screen.tsx`, `ownProfileShortcuts.tsx`, `wallet.screen.tsx`, `walletQueries.hook.ts`, `mocks/index.ts` | Removed the Referral route, "Invite friends" rows and loyalty queries. |
| `checkout.screen.tsx`, `services/orders.service.ts` | Removed the "Use loyalty points" row and `redeemLoyaltyPoints`. |
| `types/storeRewards.type.ts`, `services/storeRewards.service.ts`, `mocks/storeRewards.mock.ts`, `screens/wallet/storeRewards.screen.tsx`, `components/store/earnBackLine.tsx` | **New.** Store rewards list per store, wired to Wallet and the `StoreRewards` route. |
| `cartGrandTotalCard.tsx`, `types/cartOrder.type.ts`, `types/shipping.type.ts`, `mocks/commerceFixtures.mock.ts`, `aboutShopCard.tsx`, `storeProfileHeader.tsx` | "Store credit −X" in the order total; "Earn X% back at this store" on product and store pages. ZudoPoints untouched. Not run on a device. |


### Policy update banner and re-accept screen (§32, 3 Oct) — not tested on a device

| File | Change |
| --- | --- |
| `types/policyUpdate.type.ts`, `services/legal.service.ts`, `mocks/legal.mock.ts`, `mocks/privacy.mock.ts`, `mocks/index.ts` | **New.** Current policy versions and acceptances mocks; the consents PUT records `policyVersionId`. |
| `store/policyUpdate.store.ts`, `hooks/usePolicyUpdates.hook.ts` | **New.** Pending versions, banner dismissal (in memory) and accept mutation. |
| `components/legal/policyUpdateBanner.tsx`, `policyReacceptScreen.tsx`, `navigation/root.navigator.tsx` | **New.** Dismissible banner with summary sheet; blocking re-accept screen after the effective date of a material change (Accept, Download my data, Delete account). `makeThemedStyles`. |

### Keyboard handling, clips dark mode, clips coach overlay (2026-10-03) — not tested on a device

| File | Change |
| --- | --- |
| `package.json`, root `pnpm-lock.yaml`, `App.tsx`, `app.json` | Added `react-native-keyboard-controller` 1.21.9, `react-native-reanimated` 4.5.1 and `react-native-worklets` 0.10.1. `KeyboardProvider` at the root. Android `softwareKeyboardLayoutMode: "resize"`. **Needs a new EAS dev-client/APK build.** |
| `components/ui/keyboardSpacer.tsx`, `hooks/useLastKeyboardHeight.hook.ts` | New shared spacer that follows the real keyboard height frame by frame, rests at the bottom safe area, and snaps instead of animating when reduced motion is on. Deleted `hooks/useKeyboardInset.hook.ts`. |
| `chat.screen.tsx`, `messageComposerBar.tsx`, `chatComposerWithVoiceNotes.tsx` | Composer sits flush on the keyboard. Inverted message list. iOS interactive dismiss. Emoji panel uses the last keyboard height with no jump. |
| `clipCommentsSheet.tsx`, `commentComposer.tsx`, `postDetail.screen.tsx`, `ui/bottomSheet.tsx`, `threadedCommentList.tsx` | Comment input sits on the keyboard in the sheet and on post detail. The sheet rises and shrinks with the keyboard. All `BottomSheet` users are covered. |
| `story.screen.tsx`, `live.screen.tsx`, `supportTicketDetail.screen.tsx`, `disputeDetail.screen.tsx`, `createPost.screen.tsx`, `editProfile.screen.tsx`, `authStep.tsx` | RN `KeyboardAvoidingView` (which did nothing on Android) replaced with the spacer / `KeyboardAwareScrollView` / the library's KAV. Live comment bar now avoids the keyboard. |
| `mainTabs.navigator.tsx`, `clipCommentBar.tsx`, `clipPage.tsx` (bottom chrome), `clipPlaybackControls.tsx`, `commentRow.tsx`, `commentThread.tsx`, `threadedCommentList.tsx`, `commentComposer.tsx`, `clipCommentsSheet.tsx`, `followPill.tsx` | Clips dark mode: removed the forced-light scope on the Clips tab and moved the surrounding UI to `makeThemedStyles`. Video, scrims and on-video text stay as they were. |
| `gestureTipsOverlay.tsx`, `clipGestureTipsSeen.util.ts`, `storageKeys.constant.ts`, `clips.screen.tsx` | Rebuilt the coach overlay: real clip gestures (swipe up/down, tap, double-tap, hold for 2×, ⋮ for options) with real icons and SVG glyphs, an animated hand that respects reduced motion, a dark scrim, "Got it" plus tap anywhere. "Seen" is saved in SecureStore (`zm.clipGestureTipsSeen`, plus a per-account key), so it shows once per install and once per new account. |

### Action icon refinement (2026-10-03)

| File | Change |
| --- | --- |
| `postCard.tsx`, `saveToggleButton.tsx` | Feed action icons 24 → 22; icon–count gap 8 → 4; group gap 20 → 16; tap targets kept at 44 high via hitSlop. |
| `clipActionRail.tsx` | Rail icons 24 → 22; vertical gap 16 → 20; hitSlop 6/8 → 11 vertical. |
| `landscapeVideoFullScreenModal.tsx` | Fullscreen icon 18 → 16. Live reaction rail untouched (emoji, not icons). |

### Mentions (2026-10-03)

| File | Change |
| --- | --- |
| `src/types/mention.type.ts`, `src/utils/mentions.util.ts`, `src/services/mentions.service.ts` | Structured entities `{ userId, username, start, length }` / `{ type: "all", ... }`, edit-safe offsets, 20-mention cap. |
| `components/mentions/*`, `store/toast.store.ts`, `components/ui/toastHost.tsx` | `useMentionComposer` (debounced autocomplete, `requireAuthThen` for guests), suggestion list with `@all`, `MentionText` (brand colour, pill, suspended plain, "User not found" toast). |
| `commentComposer.tsx`, `commentRow.tsx`, `postComposerPanel.tsx`, `postCard.tsx`, `clipDetails.tsx`, `messageComposerBar.tsx`, `chatBubble.tsx`, `conversationInfo.screen.tsx` | Mentions in comments, replies, posts, clip captions and group chats; group setting "Only admins can @all". |
| `settingsPrivacy.screen.tsx`, `mentionPrivacySection.tsx` | Privacy: Who can mention me (Everyone, People I follow, No one). |
| `mocks/mentions*.mock.ts`, `comments`, `media`, `chats`, `groups`, `notifications` mocks | Candidates, resolve, privacy, enforcement, "mentioned you" notifications. See plans.md section 31. |

### Verification checkmarks by profile type (2026-10-03)

| File | Change |
| --- | --- |
| `src/utils/verificationProfile.util.ts`, `components/profile/verificationBadge.tsx`, `profileSwitcher.tsx`, `mocks/brands.mock.ts`, `mocks/userDirectory.mock.ts` | Badge colour follows the profile type (Blue personal/creator, Gold business/brand, Black government); never from the account. Black grace period shows the badge, with "Renewal due" for staff only. |
| `screens/verification/*`, `checkmarkSuggestionCards.tsx`, `mockIapSheet.tsx`, `services/webHandoff.service.ts`, `brandProfile.screen.tsx` | Blue uses a mock IAP sheet; Gold shows "Manage on the web" (dashboard.zudomart.com billing, in-app browser, no prices); Black shows "Apply for government verification" on government profiles; "Gold after business verification" until KYB. |

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

### Saved items (plans §27)

| File | Change |
| --- | --- |
| `src/types/saves.type.ts` | **New.** `SavedItemType` (post, video, clip, product), `SaveTarget`, the `SavedItem` union, `saveTargetForPost` (a post with video media saves as `video`). |
| `src/services/saves.service.ts` | **New.** `POST /api/v1/saves`, `DELETE /api/v1/saves?type=&targetId=`, `GET /api/v1/saves?type=&cursor=` (`{ data, nextCursor }`). |
| `src/store/savedItems.store.ts`, `src/hooks/useSaveToggle.hook.ts` | **New.** One optimistic saved state per target, shared by every surface. Light haptic on save, selection haptic on unsave, rollback on failure, `["saves"]` invalidated on success. |
| `src/components/saves/saveToggleButton.tsx` | **New.** Figma `bookmark-24` outline; filled `BookmarkFill24Icon` (new, `icons/custom`) when saved. Spring pop on save, skipped under `useReducedMotionPreference`. Labels "Save post" / "Remove post from saved", `selected` state. |
| `src/components/feed/postCard.tsx` | Action row now matches Figma "Frame 735": counters on the left (gap 20 so four counters fit), bookmark + share on the right (gap 16). |
| `src/components/clips/clipActionRail.tsx`, `clipPage.tsx` | Save/Saved button on the reels rail (white on video). |
| `src/components/media/landscapeVideoFullScreenModal.tsx`, `feed/mediaPager.tsx` | Video viewer gets a save button top right; the pager passes the post's target through. |
| `src/screens/product/productDetail.screen.tsx`, `services/products.service.ts`, `product/productPriceBlock.tsx` | Product bookmark now uses the same save toggle (it used to POST on every tap, even to unsave). Legacy `/products/:id/bookmark` POST/DELETE write the same saved list. |
| `src/screens/profile/saved.screen.tsx`, `components/saves/savedFilterTabs.tsx`, `savedItemTile.tsx` | **New.** Saved screen: All / Posts / Videos / Clips / Products, 3-column 130:170 grid, infinite scroll, pull to refresh, empty and error states. |
| `src/components/profile/ownProfileShortcuts.tsx`, `screens/settings/settings.screen.tsx`, `navigation/*` | "Saved" shortcut on own profile and a Settings row; `Saved` route. |
| `src/mocks/saves.mock.ts`, `savedEntries.mock.ts`, `feed/posts/clips/products.mock.ts`, `mocks/index.ts` | Mock routes and seeds; feed, post, clip and product responses report the viewer's saved state (`bookmarked`, `savedByViewer`). |

### Dark mode (plans §27, `docs/darkModePlan.md` mobile)

| File | Change |
| --- | --- |
| `src/theme/*` | **New.** `ThemeProvider` (stored preference + `useColorScheme`), `useTheme()`, `makeThemedStyles((colors, scheme) => …)`, `ForcedColorSchemeScope`, `useThemedIconInk`. Light colours are the existing `colors.constant` values plus aliases (`primarySolid`, `onPrimary`, `elevated`, `successTint`…) that equal today's light values. Dark values follow Figma (see the palette row below). |
| `src/store/themePreference.store.ts`, `constants/storageKeys.constant.ts` | Preference `light / dark / system` in SecureStore (localStorage on web) under `zm.themePreference`, read synchronously for first paint. Default **Light**. |
| `App.tsx`, `navigation/root.navigator.tsx`, `components/ui/screen.tsx` | Status bar, react-navigation theme (`DarkTheme`/`DefaultTheme` with our colours), `Appearance.setColorScheme` (native keyboards and alerts follow) and `SystemUI` root background follow the theme, so transitions never flash white. |
| `src/screens/settings/settingsAppPreference.screen.tsx`, `components/settings/themePreferenceSheet.tsx`, `services/users.service.ts`, `mocks/settings.mock.ts` | Theme row opens Light / Dark (Beta) / System; also PATCHes `users/me/preferences { theme }`. The mock no longer wipes `countryCode` when only `theme` is sent. |
| `scripts/migrateStaticColorsToTheme.mjs` | **New codemod** (Babel, text splices so formatting is kept): module `StyleSheet.create` → `makeThemedStyles`, hook calls inserted into the components that use them, `useTheme()` for inline colours, safe semantic renames (`backgroundColor: white→surface`, `primary→primarySolid`, `color: black→text`, placeholder text). 262 files migrated, 0 skipped. Light values are unchanged by construction. |
| `scripts/reportThemeCoverage.mjs` | **New.** Coverage report (see §27). |
| `scripts/generateIconComponents.mjs`, `components/icons/**` | Icons default to a themed ink (`#000000` → text etc. in dark only); regenerated. |
| ui kit (`text`, `button`, `chip`, `avatar`, `bottomSheet`, `frameAwareModal`, `deviceFrame`), `navigation/tabBar.tsx`, status pills, escrow timeline, password meters, verification badge, banners, page dots | Hand fixes: default params, module-level colour maps, raw hex, dark tab-bar blur, sheets on `elevated`, dark status tones. |
| `navigation/main.navigator.tsx`, `mainTabs.navigator.tsx` | Live, Live ended, Story, Clips and the Create composer render inside `ForcedColorSchemeScope("light")`, so they look exactly as today in both themes. |
| `src/theme/themeColors.constant.ts`, `darkStatusTones.constant.ts`, `navigation/tabBar.tsx` | **Dark palette re-derived from Figma node 874:5002** (owner decision): canvas `#0E0E10`, surface `#2C2C2C`, elevated `#3A3A3D`, divider `#3D3D40`, white text, brand `#2043F5` fills and yellow as in Figma. Grey text lightened only to reach AA: `@handle` `#5B5B5B` → `#B3B3B3` (6.7:1 on surface), metadata `#909090` → `#A6A6A6` (5.7:1). Blue text `#7A8DF9`, pending design confirmation (`#2043F5` text is 2.1:1). Mobile only; `packages/designTokens` untouched. |

Verified: `pnpm -C apps/mobile exec tsc --noEmit` clean. **Not checked visually** in dark mode; `app.json` stays `userInterfaceStyle: "light"`.

### Guest browsing (plans §28)

| File | Change |
| --- | --- |
| `src/store/guestSession.store.ts`, `store/pendingAuthIntent.store.ts` | **New.** Memory-only guest flag, guest analytics opt-in and banner dismissal; pending `{ action, returnTo }` and sign-in prompt state. Nothing is persisted. |
| `src/utils/requireAuth.util.ts`, `hooks/useRequireAuth.hook.ts`, `navigation/navigationRef.ts` | **New.** `requireAuthThen(action, returnTo?, reason?)`, `requireAuthAfterClosingModal`, `openAuthFlowThenReturn`, and the root navigation ref. |
| `src/components/auth/guestAuthSheet.tsx`, `guestAuthReplay.tsx`, `guestGate.tsx`, `signInRequiredScreen.tsx`, `guestProfileCard.tsx`, `guestFeedBanner.tsx`, `hooks/useSocialSignIn.hook.ts` | **New.** Compact auth sheet (Apple, Google, Sign in, Create account); coordinator that closes `AuthFlow`, refreshes queries and consents, returns to the route and replays the action; "Sign in to …" screens; guest profile tab; dismissible feed banner. |
| `src/config/guestAccess.config.ts` | **New.** Auth-only route phrases and the public route list. |
| `navigation/root.navigator.tsx`, `main.navigator.tsx`, `mainTabs.navigator.tsx`, `auth.navigator.tsx`, `navigation.types.ts`, `screens/auth/authFlow.screen.tsx` | Main app mounts for guests; `AuthFlow` modal inside the main stack; `screenLayout` gates auth-only routes (screen-level `layout` is composed with the gate). |
| `screens/auth/onboarding.screen.tsx`, `navigation/tabBar.tsx` | "Browse first" (or "Not now" inside `AuthFlow`); Create tab and profile switcher need a session. |
| `hooks/usePostInteractions`, `useSaveToggle`, `useProductLike`, `useCart`; `components/clips/commentThreadController`, `commentRow`; `feed/reshareSheet`; `chatSafety/shareToChat`; `profile/profileMoreSheet`; `moderation/contentOptionsSheet`; `home/feedTab`, `productMasonry`; `live/liveSession`, `guests/liveStage`, `liveStageLayer`; `coins/subscriberOnlyLock` | Like, comment, follow, save, reshare, share to chat, gift, join guest, add to cart, report, block, subscribe and Following tab go through `requireAuthThen`. Sheets close before the prompt opens. Guests skip the cart query. |
| `screens/home`, `clips`, `posts/postDetail`, `product/productDetail`, `store/storeDetail`, `brand/brandProfile`, `profile/userProfile`, `connections`, `sounds/sound`, `live/live` | Same wiring at screen level (follow, message, subscribe, report, comment, gift, share). |
| `services/apiClient.service.ts`, `cache/queryClient.config.ts`, `services/feeds.service.ts` | Mutations 401 for guests open the sign-in sheet; reads fail quietly with no retry; guests get public topics. |
| `mocks/guestAccess.mock.ts`, `mocks/index.ts`, `registry.mock.ts`, `feed.mock.ts` | Guest requests 401 unless public; viewer fields forced to `false`; popular feed for guests. |
| `services/productInteractions.service.ts`, `adEvents.service.ts` | Essential-only analytics for guests until they opt in. |

Verified: `pnpm -C apps/mobile exec tsc --noEmit` clean. **Not run** on a device or simulator (Expo was not started), so the modal-over-modal ordering and the post-sign-in replay timing (350 ms) are unchecked.

### Chat attachments: location, documents, polls (plans §25.3)

Placeholders found: plus menu Location and Documents (COMING_SOON_MESSAGES), plus Poll (same "Coming soon" alert). No other dead buttons in `components/chat`, `screens/messages` or the info screen.

| File | Change |
| --- | --- |
| `types/messaging.type.ts`, `cache/messageHistory.database.ts` | Kinds `location`, `liveLocation`, `document`, `poll`; `SharedLocation`, `MessageDocument`, `MessagePoll`; new fields persist in `extra_json`. |
| `cache/messageHistory.type.ts`, `.database.ts`, `.database.web.ts`, `messageSync.util.ts` | `deleteLocalMessage` (discarding a failed upload). |
| `services/locationSharing.service.ts`, `liveLocationSharing.service.ts`, `store/liveLocationShares.store.ts`, `utils/mapLinks.util.ts` | Permission states, one-time consent, reverse geocoding, 15 s foreground live updates, OSM tile grid, maps URLs. |
| `components/chat/chatLocationSheet.tsx`, `staticMapPreview.tsx`, `locationBubble.tsx`, `optimisticLocationAndPollSender.hook.ts` | Consent, denied and Settings states; current or live (15 min / 1 h / 8 h); map bubble with "Live until", Stop sharing, Open in maps, Copy address. |
| `utils/chatDocument.util.ts`, `components/chat/pickChatDocument.util.ts`, `documentBubble.tsx`, `optimisticDocumentSender.hook.ts`, `services/documentUpload.service.ts`, `documentOpening.service.ts`, `store/documentUploads.store.ts` | Allowlist and 100 MB cap, PDF page count, progress, cancel, Retry, Discard, Open/Save via `expo-sharing` and the folder picker, "File expired". |
| `components/chat/chatPollComposerSheet.tsx`, `pollBubble.tsx`, `richMessageContent.tsx`, `conversationMessageCache.hook.ts` | Poll builder and voting; bubble routing. |
| `components/chat/chatComposerWithVoiceNotes.tsx`, `chatBubble.tsx`, `screens/messages/chat.screen.tsx` | "Coming soon" removed; sheets wired; entry points go through `requireAuthThen`. |
| `mocks/chatAttachments.mock.ts`, `chatAttachmentRoutes.mock.ts`, `chats.mock.ts`, `index.ts`, `services/messages.service.ts` | Seeds, previews ("📍 Location"), PATCH location, stop, poll vote. |
| `mocks/clips.mock.ts` | Clips feed and `findMockClipsByIds` hide suspended authors (as posts already did). |
| `package.json`, `app.json`, `pnpm-lock.yaml` | `expo-location`, `expo-document-picker`, `expo-sharing`, `expo-clipboard` (via `npx expo install`); location permission copy. |
| `apps/mobile/CHANGELOG.md` | Removed; its content is the next entry. |

Verified: `pnpm -C apps/mobile exec tsc --noEmit` clean. **Not run** on a device (no Expo): map tiles, live updates, share sheet and folder picker are unchecked.

### Trust, verification and support (plans §29)

Plan: [plans.md §29](./plans.md). Mock mode only. Verified with `tsc --noEmit`.

| Area | Files | Change |
| --- | --- | --- |
| Suspended accounts | `types/models.type.ts`, `mocks/userDirectory.mock.ts`, `mocks/fixtures.mock.ts`, `mocks/auth.mock.ts`, `mocks/accountStatus.mock.ts`, `mocks/feed.mock.ts`, `mocks/users.mock.ts`, `mocks/chats.mock.ts`, `services/accountStatus.service.ts`, `components/profile/suspendedProfileState.tsx`, `components/chatSafety/suspendedBadge.tsx`, `components/chat/chatHeader.tsx`, `screens/messages/chat.screen.tsx`, `screens/profile/userProfile.screen.tsx`, `screens/account/suspendedAccount.screen.tsx`, `navigation/root.navigator.tsx`, `config/legalLinks.config.ts` | `account.status` on users. Suspended profile and chat states, hidden from search, suggestions and feeds. Full-screen notice for the suspended user with appeal, data download and the 120-day deletion note. |
| Checkmark suggestions | `types/trust.type.ts`, `mocks/checkmarkSuggestions.mock.ts`, `mocks/trustStats.mock.ts`, `services/verification.service.ts`, `components/profile/checkmarkSuggestionCards.tsx`, `verificationQueries.hook.ts`, `ownProfileShortcuts.tsx`, `screens/settings/settings.screen.tsx` | Dismissible Blue and Gold cards when the eligibility endpoint says eligible. Black is never suggested. Apply opens the existing verification flow. |
| Creator Program | `types/creator.type.ts`, `mocks/creatorProgram.mock.ts`, `components/creator/creatorDecisionBanner.tsx`, `screens/creator/creatorProgram.screen.tsx` | Decision states (auto approve, manual review, not eligible), new checklist items (original posts in 60 days, no violations in 90 days). |
| Business documents | `mocks/businessDocuments.mock.ts`, `services/businessDocuments.service.ts`, `components/seller/businessDocumentsQueries.hook.ts`, `businessDocumentsNudge.tsx`, `screens/seller/businessDocuments.screen.tsx`, `screens/seller/sellerDashboard.screen.tsx`, `screens/store/storeDetail.screen.tsx` | CAC, ID and address uploads with status and rejection reason, sent to the admin queue. Nudge banner until approved. Never blocks store creation. |
| Help and support | `mocks/helpCenter.mock.ts`, `mocks/support.mock.ts`, `services/helpCenter.service.ts`, `services/support.service.ts`, `types/support.type.ts`, `screens/support/helpCenter.screen.tsx`, `helpArticle.screen.tsx`, `newSupportTicket.screen.tsx`, `supportTicketDetail.screen.tsx`, `supportTickets.screen.tsx`, `components/support/supportRecordingNotice.tsx`, `screens/orders/orderDetail.screen.tsx`, `screens/checkout/payment.screen.tsx`, `screens/settings/settingsSupport.screen.tsx`, `navigation/*` | Searchable help centre. Tickets link an order or payment. Live "Zudomart Support" thread with a not-E2EE, recorded notice. Entry points on Settings, Order detail and Payment. |
| Marketing emails | `mocks/marketingPreferences.mock.ts`, `services/consents.service.ts`, `components/settings/marketingFrequencyPicker.tsx`, `screens/settings/settingsPrivacyData.screen.tsx` | New marketing copy and a weekly, only important or off choice. |
| Usernames | `types/account.type.ts`, `mocks/username.mock.ts`, `mocks/auth.mock.ts`, `components/settings/usernameAvailability.hook.ts`, `screens/auth/signUpUsername.screen.tsx`, `services/auth.service.ts` | The server's reason ("This username is reserved.") is shown on signup, username change and availability checks. |

## apps/webapp

### Structured addresses with geo pickers (3 Oct) — verified with tsc, not in a browser

| File | Change |
| --- | --- |
| `components/ui/combobox.tsx`, `components/address/*` | Accessible searchable combobox (keyboard, aria) and address form: Country, State/Region, LGA, City driven by each country's levels, plus street, postal code, details, recipient, phone; stores geo ids and `countryCode`. |
| `settings/addresses`, `checkout`, `cart`, `sellerGroupedSummary` | Address book page; checkout add and select address with shipping quote recomputed on change; seller-grouped cart shows per-seller shipping (FREE, add-X-more, not shipped). |
| `services/geo.service.ts`, `mocks/geo*.mock.ts`, `shippingEngine.mock.ts`, `cart.mock.ts` | `/geo/*` and `POST /cart/shipping-quote` mocks mirroring mobile (36 states + FCT). Address types extended. |

### Per-domain real API switch and contract test (3 Oct) — verified with tsc and `pnpm test:contracts`

| File | Change |
| --- | --- |
| `config/*Environment.config.ts`, `server/*ransport.service.ts`, `.env.example` | `WEBAPP_REAL_API_PREFIXES` routes matching paths to the gateway (default `http://localhost:8080`) while mocks stay on. |
| `src/contracts/*`, `package.json` | Contract schemas and `test:contracts` (tsx). |
| Other | Lists read through `sendListRequestToWebappServer`; countries, addresses and suggested lives mocks return `{data,nextCursor}`; username error codes and policy fields; `avatarMediaId`/`bannerMediaId` update type; empty name falls back to username. The address form still needs geo pickers before real addresses work. |


### Emojis replaced with vector icons (owner, 3 Oct)

| File | Change |
| --- | --- |
| `public/icons/sparkle24, searchOff24, shoppingBag24, package24, note24, arrowUp24, arrowDown24, musicNotes24.svg`, `components/ui/appIcon.tsx` | New 24px stroke SVGs added to the `AppIcon` set; new `IconLabel` helper. |
| `app/(app)/*`, `components/commerce/*`, `messages/*`, `orders/*`, `profile/*`, `settings/*`, `feed/postCard.tsx`, `mentions/mentionAutocompleteInput.tsx`, `actions/paymentReturnStatus.tsx` | Empty-state art, star ratings, verified ticks, clip step buttons, sound note and "back" arrows use `AppIcon`. |

### Modal & dialog system and policy update redesign (§36, 3 Oct)

| File | Change |
| --- | --- |
| `components/ui/dialog.tsx` + `.module.css`, `confirmDialog.tsx` | **New.** Accessible `Dialog` (focus trap, scroll lock, Esc and overlay close when dismissible, `aria-modal`, reduced-motion enter and exit, sheet layout under 640px) and `requestConfirmation()`. |
| `components/ui/modalDialog.tsx` | Now wraps `Dialog`; old CSS removed. |
| `components/ui/button.module.css`, `app/globals.css` | Danger buttons use `--danger-solid` (AA with white text in both themes). |
| `components/legal/*`, `types/policyUpdate.type.ts`, `mocks/legal.mock.ts` | Policy banner card, "What changed" dialog, re-accept screen with checkbox gate, `DeleteAccountDialog` reuse. |
| `components/auth/authPromptModal.*`, `components/shell/userMenu.tsx`, `components/profile/profileView.tsx`, `components/settings/deleteAccount*` | Sign-in prompt moved to Dialog; sign out asks to confirm; delete account moved into a danger dialog. |
| `components/ui/icons.tsx` | Shield, document, alert, external link and download icons. |
| `packages/webKit/src/consent/cookieConsent.module.css` | Cookie banner in the dialog language: card on desktop, bottom sheet on phones, dark surface and border, grouped categories. |
| `components/feed/postCard.module.css` | Post action row wraps so sponsored posts no longer widen the page to 405px at 360/390. |

Screenshots checked: banner, What changed, re-accept, report, delete account and sign out, at 390 and 1440 px in light and dark.

### Chat reporting (§37, 3 Oct)

- `components/chatReport/*`: report dialog (reason, evidence, confirmation), chat header menu, per-message "Report"; Settings, Your reports page (`/settings/reports`). Mock handlers shared in shape with mobile.

### Creator = personal account upgrade (owner, 2026-10-03)

- `ActingProfile.creatorStatus` on the personal profile mock; "Creator dashboard" links read "Creator tools".

### Referral and purchase loyalty/cashback removed (owner, 2026-10-03); Seller-funded store rewards (owner, 2026-10-03)

| File | Change |
| --- | --- |
| `mocks/rewards.mock.ts`, `types/rewards.type.ts` | **Deleted.** `redeemLoyaltyPoints` removed from checkout and `orders.service.ts`. |
| `app/(app)/store-rewards/page.tsx`, `services/storeRewards.service.ts`, `mocks/storeRewards.mock.ts`, `me/page.tsx` | **New.** Store rewards list (balance, expiry per store). |
| `checkout/page.tsx`, `cart/page.tsx`, `types/orders.type.ts`, `mocks/commerceFixtures.mock.ts`, `product/[productId]/page.tsx` | "Store credit −X" in summaries; "Earn X% back at this store" on product page. |


### Tablet/desktop, dark mode, saved & guest browsing (§26, 3 Oct)

Plan: [plans.md §26](./plans.md). Verified with `tsc --noEmit`, `next build`, `pnpm lint:styles` (no `color-no-hex` in the webapp) and headless Chrome screenshots at 768, 1024 and 1440 in light and dark.

| Area | Files | Change |
| --- | --- | --- |
| Shell | `components/shell/appShell.tsx`, `sideNavigation.tsx`, `topBar.tsx`, `userMenu.tsx`, `rightRail.tsx`, `rightRailModules.tsx`, `shellNavigation.config.tsx`, `shellLayout.config.ts`, `useShellBadgeCounts.hook.ts` + CSS | Phones keep the bottom bar. Tablets get an icon rail with a labelled overlay drawer. Desktop gets a labelled, collapsible sidebar, per-route content widths and a contextual right rail (wallet/coins, who to follow, trending, cart summary). The avatar menu has links, a theme switcher and sign-out. |
| Theme | `app/layout.tsx`, `components/providers/appProviders.tsx`, `components/settings/appearanceSection.tsx`, `settingsHome.module.css`, `app/(app)/settings/page.tsx`, `mocks/settings.mock.ts` | The `theme` cookie sets `data-theme` server-side. Adds `ThemeInitScript`, `themeViewport` and `ThemeProvider`, which saves `preferences.theme`. New Settings hub with Appearance. |
| Tokens | every `*.module.css` touched by `pnpm lint:styles`, `app/globals.css` | Ramps and hex values moved to semantic tokens. Status text uses `-text` variants. `phoneFrame` artwork is allowlisted. |
| Saved | `types/saves.type.ts`, `services/saves.service.ts`, `components/saves/*`, `app/(app)/saved/*`, `mocks/saves.mock.ts`, `mocks/saveState.mock.ts`, `public/icons/bookmarkSimple24.svg`, `bookmarkSimpleFill24.svg` | Optimistic save toggle with toast. `/saved` with type tabs, collections, a move-to-collection picker and infinite scroll. Mock `POST/DELETE/GET /saves`, `/saves/collections`, `PATCH /saves/:id`. |
| Feed | `app/(app)/page.tsx`, `components/feed/postCard.tsx`, `postCardMedia.tsx`, `feedTopicFilterRow.tsx`, `commentsPanel.tsx`, `components/ui/useInfiniteScrollSentinel.hook.ts`, `filterChips.module.css` | Infinite scroll. Save action, timestamp link to `/post/:id`, landscape video cards that open the watch view, shared chips. |
| New routes | `app/(app)/mart`, `clips`, `watch/[videoId]`, `live`, `post/[postId]` | Mart browser, snap clips feed with keyboard stepping, watch page with Up next, live grid, post detail with comments. |
| Two panes | `app/(app)/chats/layout.tsx`, `components/messages/conversationListPanel.tsx`, `app/(app)/orders/layout.tsx`, `components/orders/orderListPanel.tsx` | List + detail from 768px, with placeholders when nothing is selected. |
| Commerce | `components/commerce/productGallery.tsx`, `martBrowser.tsx`, `sellerGroupedSummary.tsx`, `utils/groupCartItemsByStore.util.ts`, `app/(app)/product/[productId]/*`, `cart/page.tsx`, `checkout/page.tsx`, `mocks/commerceFixtures.mock.ts` | Sticky buy box, vertical gallery thumbnails, save on product, seller-grouped cart and checkout summaries, skeletons. Checkout sends no email field and shows "Verify your email to continue" when the account email is unverified (`User.emailVerified`). |
| Profile | `components/profile/profileView.tsx`, `profileContentTabs.tsx` | Cover/header fix, Posts/Media tabs with a media grid, Saved shortcut. |
| Guest browsing | `config/guestBrowsing.config.ts`, `proxy.ts`, `server/gateway.service.ts`, `server/anonymousViewerFields.service.ts`, `components/auth/authPrompt.store.ts`, `authPromptModal.tsx`, `services/clientApi.service.ts`, `mocks/feed.mock.ts` | Public pages and GETs work without a session. Viewer fields are forced to false. `requireAuthThen` opens an inline sign-in dialog and replays the action after sign-in. 401s on mutations open the prompt. Popular feed for guests. |
| Mocks | `mocks/videos.mock.ts`, `discovery.mock.ts`, `index.ts`, `postCatalog.mock.ts`, `clips.mock.ts`, `products.mock.ts` | Landscape videos (Blender open movies, CC BY), suggested accounts, trending, `bookmarked` state. |
| UI kit | `components/ui/toast.tsx`, `underlineTabs.tsx`, `icons.tsx`, `appIcon.tsx`, `public/icons/{coin24,flips34,gift24}.svg` | Toasts (`aria-live`), keyboard tablist, Figma icons copied from mobile. |

### Web actions, email verification & mentions (§26.5–26.7, 3 Oct)

| Area | Files | Change |
| --- | --- | --- |
| Comments | `src/components/feed/commentsPanel.tsx`, `commentThread.tsx`, `commentComposer.tsx`, `commentsPanel.module.css` | Threaded comments: preview replies, "View N replies" paging, reply composer, like, delete own, report. Guests can read; writing goes through `requireAuthThen`. |
| Mentions (§31) | `src/types/mentions.type.ts`, `src/utils/mentions.util.ts`, `src/components/mentions/*`, `src/services/mentions.service.ts`, `src/mocks/mentions.mock.ts`, `src/components/settings/mentionPrivacySection.tsx` | Typing `@` opens an autocomplete fed by `/mentions/candidates`; people who don't allow mentions are greyed out, with an `n/20` counter. Entities are `{ userId, username, start, length }` or `{ type: "all", … }`. Usernames are re-resolved through `/mentions/resolve` (deleted shows a toast, suspended renders as plain text, `@all` as a pill). Adds the "Who can mention me" setting. |
| Share and report | `src/components/actions/contentActionsMenu.tsx`, `shareToChatDialog.tsx`, `shareToChatButton.tsx`, `reportDialog.tsx`, `src/components/ui/modalDialog.tsx`, `src/mocks/webActions.mock.ts` | A "More" menu (Send in chat, Copy link, Report) on post cards, clips, the watch view, lives, product and profiles. Send in chat: multi-select up to 20 chats plus a note (`POST /chat/shares`). Report: reason list plus optional details (`POST /reports`). |
| Live and gifts | `src/app/(app)/live/[liveId]/page.tsx`, `src/components/live/*` | Live room: player, host bar, product strip, live chat, and a gift tray (×1/5/10) that uses the gift catalog and send mocks. When coins run out, a coin store opens Bachs hosted checkout; `/coins/return` confirms with the server. |
| Subscribe | `src/components/actions/subscribeToCreatorDialog.tsx`, `src/components/profile/profileVisitorActions.tsx`, `src/app/(app)/subscriptions/return/page.tsx` | Creator profiles with plans show Subscribe, which opens a plan picker and then Bachs checkout; the return page polls the subscription state. |
| Email verification | `src/app/(app)/verify-email/*`, `src/app/(app)/checkout/page.tsx`, `src/app/(app)/settings/page.tsx`, `src/mocks/users.mock.ts` | `/verify-email` sends a code, takes the OTP and returns to `next`. The checkout gate links there and reads `GET /users/me/email`. Settings has an Email row. |
| Services and types | `src/services/webActions.service.ts`, `src/types/orders.type.ts`, `src/app/(auth)/authSteps.module.css`, `src/app/(auth)/signup/{signupRules.util.ts,passwordRequirements.tsx,signupFieldSteps.tsx,signupVerifyCodeStep.tsx,signupTopicsStep.tsx,useUsernameAvailability.hook.ts}` | One service per action. Cart, order and wallet types are split out of `models.type.ts`. OTP, password and topic styles are split out of `authForm.module.css`. Signup is split into step components and a username hook. Every file is now under 300 lines. |

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

### Policy update banner and re-accept screen (§32, 3 Oct)

| File | Change |
| --- | --- |
| `types/policyUpdate.type.ts`, `services/legal.service.ts`, `mocks/legal.mock.ts`, `mocks/privacy.mock.ts`, `mocks/index.ts` | **New.** Current policy versions and acceptances mocks. Consents PUT now accepts `policyVersionId` and records the acceptance. |
| `components/legal/policyUpdateHost.tsx`, `usePolicyUpdates.hook.ts`, `policyUpdateHost.module.css`, `components/shell/appShell.tsx` | **New.** Dismissible Terms/Privacy banner with summary dialog; blocking re-accept screen after the effective date of a material change (Accept, Download my data, Delete account). Tokenised, dark mode through tokens. `tsc` clean; not browser-tested. |

## apps/studio

### Per-domain real API switch and contract test (3 Oct) — verified with tsc and `pnpm test:contracts`

| File | Change |
| --- | --- |
| `config/*Environment.config.ts`, `server/*ransport.service.ts`, `.env.example` | `STUDIO_REAL_API_PREFIXES` routes matching paths to the gateway (default `http://localhost:8080`) while mocks stay on. |
| `src/contracts/*`, `package.json` | Contract schemas and `test:contracts` (tsx). |
| Other | Social sign-in mock routes added; live comments read `Page<{author}>` and map to `authorName`; lists accept bare arrays or pages. |


### Overlay editor split (owner, 3 Oct)

| File | Change |
| --- | --- |
| `app/(studio)/lives/[liveId]/overlay/page.tsx`, `overlayCanvas.tsx`, `overlayInspector.tsx`, `overlayLayers.util.ts` | 327-line page split into canvas, inspector and layer helpers; all files are under 300 lines. No behaviour change. |

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

### Dark mode

| Area | Change |
| --- | --- |
| `app/layout.tsx`, `components/theme/studioThemeProvider.tsx`, `components/providers/appProviders.tsx` | `<html data-theme>` comes from the `theme` cookie, with `ThemeInitScript` and `themeViewport`. `ThemeProvider` PATCHes `/api/v1/users/me/preferences` when a viewer is signed in |
| `mocks/preferences.mock.ts` | **New.** GET and PATCH `/api/v1/users/me/preferences` |
| `shell/studioShell`, `landing/landingHeader`, `auth/authSplitLayout` | Light/Dark/System switcher |
| CSS modules (auth, landing, lives, ui) | Raw hex moved onto tokens. Status words use `-text` tokens. The control room, overlay editor and stream overlays stay dark in both themes |
| Landing | Token type scale, buttons and radii. Real app screens in `public/screens/`. Responsive from 360 to 1440. Keeps the creator (non-selling) live copy |

## apps/seller

### Per-domain real API switch and contract test (3 Oct) — verified with tsc and `pnpm test:contracts`

| File | Change |
| --- | --- |
| `config/*Environment.config.ts`, `server/*ransport.service.ts`, `.env.example` | `SELLER_REAL_API_PREFIXES` routes matching paths to the gateway (default `http://localhost:8080`) while mocks stay on. |
| `src/contracts/*`, `package.json` | Contract schemas and `test:contracts` (tsx). |
| Other | Gateway default `:8080` (also in the CSP origin in `next.config.ts`). |


### Emojis replaced with vector icons (owner, 3 Oct)

| File | Change |
| --- | --- |
| `public/icons/arrowRight24, arrowUp24, arrowDown24, caretUp24, caretUpDown24.svg`, `components/ui/zudoIcon.tsx` | New 24px stroke SVGs in the existing mask set; `IconLabel` helper. |
| `ui/dataTable.tsx`, `reviews/reviewCard.tsx` (`StarRating`), `reviewsSummaryPanel.tsx`, `storefront/*`, `landing/*`, `billing/gateFrame.tsx`, `staff/staffRolesMatrixView.tsx`, `brand/brandOfficialStoreView.tsx`, `settings/accountSettingsView.tsx` | Sort arrows, star ratings, tick marks, move up/down, and back/forward arrows are icons. Dashboard change text is signed (+/-) instead of triangles. Prose arrows are now "›". |

### Referral and purchase loyalty/cashback removed (owner, 2026-10-03); Seller-funded store rewards (owner, 2026-10-03)

| File | Change |
| --- | --- |
| `settings/loyalty` page, `loyaltySettingsForm.tsx`, `customerLoyaltyPanel.tsx`, `settingsSectionTabs.tsx` | **Deleted.** Platform-style loyalty points and manual point adjustments (`loyalty-adjustments` route). |
| `marketing/rewards` page, `storeRewardsView.tsx`, `customerStoreCreditPanel.tsx`, `marketingPresentation.util.ts` | **New.** Marketing > Store rewards: on/off, % back, minimum order, max per order, expiry, outstanding credit liability; customer detail shows store credit. |
| `types/store.type.ts` (`StoreRewardsRules`), `types/customer.type.ts` (`storeCreditBalance`), settings validation, seed profiles, customer mocks, `apiContract.md` | `loyalty` replaced by `storeRewards`; `loyaltyPoints` replaced by store credit. |


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

### Dark mode

| Area | Change |
| --- | --- |
| `package.json`, `app/globals.css` | Now imports `@zudomart/design-tokens/tokens.css`. The local `:root` became aliases onto semantic tokens. Print forces light paper tokens |
| `app/layout.tsx`, `components/theme/appThemeProvider.tsx` | Cookie-driven `data-theme`, `ThemeInitScript` and `themeViewport`. PATCH `/seller/users/me/preferences` when signed in |
| `mocks/handlers/consentsHandlers.mock.ts`, `config/rolePermissions.config.ts` | Mock PATCH route plus a `signed_in` rule |
| `layout/topBar`, `settings/accountSettingsView`, `landing/landingFooter` | Light/Dark/System switcher |
| About 70 CSS modules plus charts (`sparkline`, `horizontalBarList`, `reportResultChart`, dashboard and analytics panels) | Raw hex moved onto tokens. SVG series use `--chart-*`, gridlines use `--chart-grid` and labels use `--chart-axis` |
| Landing | Polished on tokens and checked at 390 and 1440 in both themes. Keeps "free for every seller". In-store "counter" copy was replaced, because the dashboard has no POS: the features heading, the sync section and the login note |

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

### Dark mode

| Area | Change |
| --- | --- |
| `app/layout.tsx`, `components/layout/siteThemeProvider.tsx` | `ThemeInitScript` plus `themeViewport`. No `cookies()` read, so every page stays static (`○`) |
| `layout/siteHeader`, `layout/siteFooter` | Icon-only switcher in the header and labelled switcher in the footer. The dark header glass is near-solid so it reads over the yellow hero |
| `app/globals.css` and every section module | Raw hex moved onto app aliases with dark values (navy canvas, deeper brand bands, yellow kept with dark text). Phone frames and photography untouched |
| Landing polish | Token type scale, spacing, wordmark and radii. Checked at 390 and 1440 with no horizontal scroll. Reduced motion stops the marquee |
| Copy fix | Dropped "point of sale for your physical shop" from the sellers page, the FAQ and the site config, because the dashboard has no POS |

### Legal pages with versions (§32, 3 Oct)

| File | Change |
| --- | --- |
| `content/legalPolicies.content.ts`, `content/legalNewDocuments.content.ts` | **New.** Mock versioned registry for eight documents (current plus previous versions). |
| `components/legal/legalPolicyPage.tsx`, `legalDocument.tsx`, `legalDocument.module.css` | **New.** Shows version, effective date and "View previous versions". The "Draft, pending legal review" notice stays until `isReviewedByLegal`. |
| `app/{terms,privacy,cookies,community-guidelines,seller-terms,creator-terms,ads-policy,refund-escrow-policy}/page.tsx`, `app/legal-archive/[slug]/[version]/page.tsx`, `app/sitemap.ts`, `components/layout/siteFooter.tsx` | Five new pages, archive route, sitemap and footer links. `next build` passes. |

## apps/admin

### Per-domain real API switch and contract test (3 Oct) — verified with tsc and `pnpm test:contracts`

| File | Change |
| --- | --- |
| `config/*Environment.config.ts`, `server/*ransport.service.ts`, `.env.example` | `ADMIN_REAL_API_PREFIXES` routes matching paths to the gateway (default `http://localhost:8080`) while mocks stay on. |
| `src/contracts/*`, `package.json` | Contract schemas and `test:contracts` (tsx). |
| Other | `adaptListEnvelope` turns `{data,nextCursor}` and `{data,page,pageSize,total}` into `{items,...}`; mock tables are emitted as `{data,...}`. |


### Emojis replaced with vector icons (owner, 3 Oct)

| File | Change |
| --- | --- |
| `components/ui/zudoIcon.tsx` + `.module.css`, `people/programApplicationPanel.tsx`, `people/verificationDetailWorkspace.tsx`, `support/ticketDetailWorkspace.tsx` | New `IconLabel`. Eligibility and check results use `check16`, `cancel20`, `warning20` icons; "All tickets" back link uses `arrowLeft24`. |
| `trust/*`, `brands/ipClaimDecisionPanel.tsx`, `catalog/featureScheduleText.util.ts`, `configuration/automation/automationWorkspace.tsx`, `people/userUsernamePanel.tsx` | Inline arrows in consequence and range text now read "to" / "matches". |

### Chat reports moderation (§37, 3 Oct)

- `/moderation/chat-reports`: queue (child safety first, filters), detail with read-only "Submitted by reporter" transcript, hash check, spam score, actions (dismiss, warn, restrict, suspend, ban, remove group, escalate to legal) with reason, step-up and audit, evidence retention card tagged LEGAL REVIEW. New permissions `chat-reports:review` and `chat-reports:legal`; Trust & Safety template and demo admins updated. Contract in `apiContract.md` ("Chat reports").

### Creator = personal account upgrade (owner, 2026-10-03)

- Admin `ProfileType` is `PERSONAL|BUSINESS|BRAND|GOVERNMENT`; lifetime checkmark grants and verification copy say "Personal (incl. creators) = Blue". `apiContract.md` updated.

### Email templates gallery and policy email preview (§34, 2026-10-03) — not tested in a browser

| File | Change |
| --- | --- |
| `package.json`, `next.config.ts` | Depends on `@zudomart/email-templates` (workspace) and transpiles it. |
| `app/(console)/support/email-templates/page.tsx`, `components/emailTemplates/*` | New **Support → Email templates** page (`support:email` or superadmin): searchable list by category with kind badges, trigger/audience/consent, sandboxed iframe preview with sample data, light/dark toggle, plain-text view. |
| `mocks/handlers/content/emailTemplates.mock.ts`, `contentHandlers.mock.ts` | Mock BFF renders with the package: `GET /admin/email-templates`, `GET /admin/email-templates/:key/preview?theme=`, `POST /admin/email-templates/policy-updated/preview` (validated draft fields). |
| `config/apiAccess.config.ts`, `config/navigation.config.ts` | Access rule for `/admin/email-templates` (support email or legal permissions); nav item under Support. |
| `services/emailTemplatesApi.service.ts`, `types/emailTemplates.type.ts` | Client calls and types. |
| `components/legal/legalNoticeEmailFrame.tsx` | Placeholder replaced: the legal notice draft and publish dialog render the real `policyUpdated` email (debounced live preview, light/dark). |

### Referral and purchase loyalty/cashback removed (owner, 2026-10-03)

| File | Change |
| --- | --- |
| `types/platformConfiguration.type.ts`, `revenueRulesEditor.tsx`, `revenueEffectPreview.tsx`, `configurationDocuments.mock.ts`, `configurationDocumentValidation.mock.ts`, `apiContract.md` | Removed `loyalty`, `cashback` and `referral` from revenue rules (editor cards, preview row, seed, validation, contract). |


### Shipping config & web privacy (§23)

| File | Change |
| --- | --- |
| `src/components/privacy/consentBannerHost.tsx`, `src/app/layout.tsx` | **New.** Mounts the cookie consent banner. |
| `src/mocks/handlers/platform/consents.mock.ts`, `src/config/apiAccess.config.ts` | **New.** `POST /admin/consents` mock; any signed-in admin may call it. |

| File | Change |
| --- | --- |
| `src/components/auth/authCard.module.css` | Removed the decorative `4px solid var(--yellow-500)` accent bars on the sign-in brand panel (`border-right` on desktop, `border-bottom` under 900px), per the "no arbitrary decorative bars" rule. |

---

### Dark mode

| Area | Change |
| --- | --- |
| `app/layout.tsx`, `components/theme/appThemeProvider.tsx` | Cookie-driven `data-theme`. `ThemeInitScript` gets the CSP nonce from `x-nonce`. Spreads `themeViewport`. PATCH `/admin/users/me/preferences` |
| `config/apiAccess.config.ts`, `mocks/handlers/platform/userPreferences.mock.ts` | `anyAdmin` rule listed before the `/admin/users` prefix, plus the mock route |
| `shell/consoleTopBar`, `account/accountSecurityWorkspace` | Light/Dark/System switcher |
| About 45 CSS modules (shell, auth, ui kit, money, trust, configuration) | Raw hex moved onto tokens. `--surface-hover` now uses `--color-surface-hover`. The `--console-night*` rail stays dark in both themes. Document artwork untouched |

### Legal admin and policy versioning (§32, 3 Oct)

| File | Change |
| --- | --- |
| `constants/adminPermissions.constant.ts`, `adminRoleTemplates.constant.ts`, `config/navigation.config.ts`, `config/apiAccess.config.ts`, `mocks/seed/demoAdmins.mock.ts` | `legal.documents.view/edit/publish` and `legal.notices.send`, a Legal role template, Legal nav group, API access rules, step-up on publish and notice send, two demo Legal admins. |
| `types/legal.type.ts`, `constants/legalDocuments.constant.ts`, `services/legalApi.service.ts`, `utils/legalLineDiff.util.ts` | **New.** Types, document list, API client, line diff. |
| `mocks/handlers/legal/*`, `mocks/seed/legalDocuments.mock.ts`, `mocks/mockHandlerRegistry.mock.ts` | **New.** Versions CRUD, submit/return/publish (maker-checker, step-up, short-notice check), rollback, notice draft/test send/preview/status, acceptance stats, audit entries. |
| `components/legal/*`, `app/(console)/legal/**` | **New.** Documents list, editor with preview, review/publish, history, side-by-side diff, rollback, email draft with placeholder preview frame, notices progress page. `tsc` clean; not browser-tested. |
| `apiContract.md` | Legal documents, notices and user-facing endpoints. |

## apps/ads

### Per-domain real API switch and contract test (3 Oct) — verified with tsc and `pnpm test:contracts`

| File | Change |
| --- | --- |
| `config/*Environment.config.ts`, `server/*ransport.service.ts`, `.env.example` | `ADS_REAL_API_PREFIXES` routes matching paths to the gateway (default `http://localhost:8080`) while mocks stay on. |
| `src/contracts/*`, `package.json` | Contract schemas and `test:contracts` (tsx). |
| Other | `adaptListEnvelope` turns `{data,nextCursor,total}` into the internal `{items,...}` page; memberships mock and BFF read `data`; mock lists are emitted as `{data,...}`. |


### Shipping config & web privacy (§23)

| File | Change |
| --- | --- |
| `src/components/privacy/consentBannerHost.tsx`, `src/app/layout.tsx` | **New.** Mounts the cookie consent banner. |
| `src/mocks/handlers/consents.mock.ts`, `src/mocks/mockHandlerRegistry.mock.ts`, `src/config/rolePermissions.config.ts` | **New.** `POST /ads/consents` mock; signed-in-only path. |

---

### Dark mode

| Area | Change |
| --- | --- |
| `app/layout.tsx`, `components/theme/appThemeProvider.tsx` | Cookie-driven `data-theme`, `ThemeInitScript` and `themeViewport`. PATCH `/ads/users/me/preferences` |
| `mocks/handlers/userPreferences.mock.ts`, `config/rolePermissions.config.ts` | Mock route plus a signed-in-only path |
| `shell/userMenu`, `settings/appearanceCard` | Light/Dark/System switcher |
| Creative previews, landing illustrations, `charts/lineChart` | Driven by tokens and `--chart-*`, `--chart-grid` and `--chart-axis` |
| `shell/accountShell` | The top bar hid nothing below 720 px and overflowed to 526 px. The badges, balance and duplicate "Create campaign" are now hidden there |
| `charts/lineChart.tsx`, `app/globals.css`, `ui/surfaces`, `ui/formFields`, `overview/kpiTileGrid` | The screen-reader data table is wrapped so it can't widen the page. Card headers wrap. The segmented metric control scrolls. KPI values scale down instead of truncating at 390 px |

## packages/emailTemplates

### New package `@zudomart/email-templates` (§34, 2026-10-03)

| File | Change |
| --- | --- |
| `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` | React Email (`react-email` 6.11 + `@react-email/render` 2.1; `@react-email/components` is deprecated upstream), vitest, tsx. `previews/` is gitignored. |
| `src/render/renderEmail.tsx`, `src/render/plainText.ts`, `src/catalogue.ts`, `src/index.ts` | `renderEmail(key, props, { locale, theme, timeZone, brand, links })` → `{ subject, html, text }` for the SES worker; catalogue and sample rendering. |
| `src/layout/*.layout.tsx`, `src/blocks/*.block.tsx`, `src/theme/emailPalette.ts`, `src/config/emailBrand.config.ts`, `src/format/emailFormat.ts` | Branded 600 px layout (wordmark with CDN/inline fallback, brand strip, hero, content blocks, bulletproof button, progress track), footer (legal name/address placeholders, support emails, socials, app links, why-you-got-this, unsubscribe on marketing only, manage notifications otherwise), dark mode, design-token colours, `Intl` money from `{ amountMinor, currency }`. |
| `src/templates/*.template.tsx` | 82 templates: auth/security, buyer orders, escrow and disputes, seller orders/payouts/balances, documents and plan trials/receipts, payments, store credit, creator, checkmarks, social/live, trust, privacy/legal, support, marketing (verified sellers only). |
| `scripts/renderPreviews.script.tsx`, `tests/emailTemplates.test.tsx` | Preview renderer (light, dark, text + index) and 172 vitest checks with 4 plain-text snapshots. |

**Owner to fill:** `ZUDOMART_COMPANY_LEGAL_NAME`, `ZUDOMART_COMPANY_ADDRESS`, App Store id, social handles, CDN wordmark and badge images.

## packages/webKit

### Shipping config & web privacy (§23)

| File | Change |
| --- | --- |
| `src/consent/*`, `src/index.ts` | **New.** `CookieConsentBanner` (Accept all, Reject optional, Manage with per-category toggles), `useConsent(category)`, `ConsentGuard`, `openCookieSettings`. Choice stored in the first-party `zudomart_consent` cookie with the policy version; optional scripts must be wrapped in `ConsentGuard`. |

---

### Dark mode (shared)

| Area | Change |
| --- | --- |
| `packages/designTokens/tokens.css` | Wired `:root[data-theme="dark"]` plus the `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` fallback, `color-scheme` per theme and `prefers-contrast: more`. New tokens: `--color-border-control`, `--color-surface-hover`, `--color-brand-solid-hover`, `--color-inverse` and `--color-on-inverse`, `--color-skeleton` and `-shine`, `--chart-5`, `--chart-grid`, `--chart-axis`. AA tuning: light `--color-text-subtle` is `#68687b` and dark `--color-brand` is `#7b90f9`. `native.ts` kept in sync |
| `src/theme/*` | **New.** `ThemeProvider` and `useTheme()`, `ThemeSwitcher`, `ThemeInitScript`, and `parseThemePreference` / `readHtmlThemeAttribute` / `themeViewport` / `themeCookieName` |
| `feedback.module.css`, `zudomartWordmark.module.css`, `consent/cookieConsent.module.css` | Fully tokenised. The banner sits on `--color-elevated` and has hover states. The hex fallbacks were removed |

## docs

### Creator = personal account upgrade (owner, 2026-10-03)

- backendPlan §4.5/§4.8, plans §21/§29/§30, architecture/database.md, database/domains.md and schema.md: creator is `creatorStatus` on the Personal profile, not a profile type. users module: `profiles.creator_status`, `kind` is `personal|business`, `POST /users/me/creator-application`, migration `20261003120000_move_creator_to_personal_profile_status`.

### Referral and purchase loyalty/cashback removed (owner, 2026-10-03)

| File | Change |
| --- | --- |
| `architecture/microservicesPlan.json` | Removed the go-money `rewards` block and the `referrals` block; go-money description updated; added go-commerce `storeRewards` (seller-funded). |
| `architecture/{events,fraud,payments,backend,inventory,system}.md`, `backendPlan.md`, `plans.md` (§33) | Removed referral/loyalty/cashback; fraud "referral abuse" is now "promo abuse"; added Seller-funded store rewards (owner, 2026-10-03) and backend requirements. |


| File | Change |
| --- | --- |
| `docs/plans.md` | The working plan: feed media, feed video audio, chat keyboard/voice/timestamps/typing, creator subscriptions, Creator Studio requirements, webapp auth parity + desktop split, **reshare (§7)**, **Studio subdomain + live broadcasting (§8)** — with the in-app go-live source picker table (§8.4: Camera / Screen / External for gamers), the mock contract renumbered to **§8.5**, phase markers updated to what is now built, **mock mode (§9)**, **post impressions & owner-only analytics (§11)**, **the feed & chat UX batch (§12)**, plus three new sections: **§13 verification checkmarks proposal** (gold = business/store, blue = personal, two independent subscriptions that never conflict), **§14 orders tracking** (history/details/status — already built on both apps), and **§15 auth wording, social sign-in & creator analytics batch**. This batch: **§5.1 gating, §5.2 Studio home, §5.3 clip/video upload paths → [DONE — §16]**; **§5.4 → [BLOCKED]** with the contract finding (`audience` is `everyone`-only; the subscriber tier is the separate `visibility: "public" | "subscribers"` field + `assertApprovedCreator`, and today's mobile `audience: "followers"` sends are invalid against the real API — flagged as debt); **§6.2 social sign-in → [DONE — §15]** (verified end-to-end headless). |
| `docs/CHANGELOG.md` | **New.** This file. |

---

### Legal admin and policy versioning (3 Oct)

| File | Change |
| --- | --- |
| `docs/plans.md` | New §32 with admin and user behaviour, backend requirements (versions table, maker-checker, SES bulk send through SQS with throttling and suppression, acceptance records) and open items. |

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

---

## apps/admin

### 2026-10-03: trust, accounts, documents, rules and support

Plan: [docs/plans.md §30](../../docs/plans.md). Verified with `tsc --noEmit` and `next build`. Mock mode only.

| Area | Files | Change |
| --- | --- | --- |
| Suspensions | `app/(console)/moderation/suspensions`, `components/trust/suspension*.tsx`, `suspendedAccountsPanel.tsx`, `types/suspensions.type.ts`, `mocks/handlers/trust/suspensions.mock.ts`, `mocks/seed/suspensionsSeed.mock.ts` | Queue of suggested and report-driven cases with signals and evidence, approve (reason + note), dismiss, escalate, suspended list with 120-day deletion countdown, appeal queue, reinstate. Every action needs step-up and is audited. |
| Accounts | `app/(console)/accounts`, `components/people/accounts/*`, `types/accountsAdmin.type.ts`, `mocks/handlers/people/peopleAccountsAdmin.mock.ts` | Create accounts that bypass the reserved check (forced password change), lifetime free checkmarks that respect profile type (Blue personal/creator, Gold business/brand, Black government and superadmin only), revoke. |
| Business documents | `app/(console)/verification/business-documents`, `components/people/businessDocuments*.tsx`, `mocks/handlers/people/peopleBusinessDocuments.mock.ts` | Per-document approve/reject with reasons, watermarked audited viewer, Gold granted when approved on Pro/Business. |
| Black applications | `app/(console)/verification/black`, `components/people/blackApplicationsWorkspace.tsx`, `mocks/handlers/people/peopleBlackApplications.mock.ts` | Four-item vetting checklist, two-admin maker-checker approval with step-up, handle reserved on approval and kept on revoke, yearly re-verification reminders, revocation. |
| Rules | `components/configuration/rules/trustRulesEditors.tsx`, `mocks/handlers/configuration/configurationTrustRulesValidation.mock.ts`, `mocks/seed/configurationTrustRules.mock.ts` | Versioned documents: checkmark suggestion thresholds, Creator auto-approve/review thresholds, trial rules and yearly discount, checkmark pricing (bundle 15%, cap 3, Gold-only NGN 3,000, Black NGN 50,000, grace 14 days). |
| Support | `app/(console)/support/chat`, `support/email`, `components/support/liveChat*.tsx`, `emailOutreachWorkspace.tsx`, `mocks/handlers/content/supportChat.mock.ts`, `supportEmail.mock.ts` | Recorded (not E2EE) live chat with canned replies, and email to a user or segment through SES (mock) with marketing consent checks and automatic unsubscribe link. Ticket queue, notes, macros and SLA timers already existed. |
| Staff, roles and user actions | `components/admins/*`, `mocks/handlers/platform/staffAccess.mock.ts`, `staffManagement.mock.ts`, `constants/adminRoleTemplates.constant.ts`, `mocks/handlers/people/peopleUserActions.mock.ts`, `components/people/userModerationActions.tsx` | Superadmins create superadmins and admins from the UI with step-up and an optional second-superadmin approval (default on); suspend or revoke access kills sessions. Admins cannot create or edit superadmins. New fine-grained permissions, nine department templates plus custom roles, several roles per admin. Audit entries carry staff id and department, and staff pages show last actions. User restrict, suspend, ban (blocks re-signup), delete (anonymise and retain) and username reassign, all permission-gated, audited and notifying. |
| Shared | `services/safetyApi.service.ts`, `services/supportOutreachApi.service.ts`, `config/navigation.config.ts` | New services and nav entries. |

## apps/seller

### 2026-10-03: trials, bundle pricing, business documents

Plan: [docs/plans.md §30](../../docs/plans.md). Verified with `tsc --noEmit` and `next build`. Mock mode only.

| Area | Files | Change |
| --- | --- | --- |
| Free trial | `components/billing/trialOfferNotice.tsx`, `trialStatusPanel.tsx`, `billingPricing.util.ts`, `types/billingOffer.type.ts`, `mocks/handlers/billingOffer.mock.ts` | Card-saved trial through Bachs (mock hosted page), refunded verification charge copy, reminders at 3 and 1 day, one-tap cancel, gentle ineligibility reasons. The account email is shown read-only and never asked for. |
| Plan picker | `components/billing/subscriptionPlanPicker.tsx`, `components/settings/billingSettingsView.tsx`, `mocks/seed/demoFinance.mock.ts` | Monthly/yearly toggle with the yearly discount, "Blue + Gold bundle -15%" when an active Blue exists (yearly wins when bigger), Gold-only plan card, per-business billing note. Yearly prices now carry a 20% discount. |
| Business documents | `components/documents/*`, `components/dashboard/businessDocumentsBanner.tsx`, `app/(workspace)/settings/business-documents`, `mocks/handlers/businessDocuments.mock.ts` | Upload/re-upload CAC, ID and proof of address with statuses and rejection reasons, dashboard banner until approved, Gold checkmark preview. Never blocks selling. |
| Layout fix | `components/layout/compactWorkspaceSwitcher.module.css`, `topBar.module.css` | Store switcher text ellipsizes at 390px instead of clipping. |

### Image preview controls (3 Oct)

| File | Change |
| --- | --- |
| `src/components/feed/mediaLightbox.tsx` | The close button and `n / total` counter now sit below the status bar, notch or Dynamic Island (`safe-area top + 16`, not a fixed 24), with safe-area side padding in landscape. The close button grew from 36 to 40px for easier tapping. Applies everywhere images are previewed (feed, profile and cover photos, store and brand, product gallery, chat, disputes). |

### Tappable @username tags (3 Oct)

| File | Change |
| --- | --- |
| `mobile: utils/usernameTags.util.ts`, `utils/__tests__/usernameTags.util.test.ts`, `components/mentions/mentionText.tsx`, `hooks/useOpenUserByUsername.hook.ts`, `services/users.service.ts` | `MentionText` now also parses plain `@username` tokens (not emails, URLs or `@all`), memoised; entities win. Tag is brand-coloured, weight 600, link role; tap resolves `GET /users/by-username/:username` then opens the profile ("User not found" toast on 404). Wired into bios, store and brand descriptions, product info, reviews, notifications, live comments and video-reply stickers. First jest test file (excluded from tsc as `@types/jest` is not installed). |
| `mobile: mocks/users.mock.ts`, `guestAccess.mock.ts`, `username.mock.ts`, `mentions.mock.ts`, `types/mention.type.ts`; `components/mentions/mentionComposer.hook.ts`, `mentionSuggestionList.tsx` | By-username mock route (guest-readable); `all` reserved exactly; "@" shows following, then followers, then recent, then everyone else under a "More people on Zudomart" divider; exact match first; 150 ms debounce (none for the empty query). |
| `webapp: utils/usernameTags.util.ts`, `components/mentions/mentionText.tsx`, `app/(app)/u/[username]/page.tsx`, `services/users.service.ts`, `mocks/users.mock.ts`, `username.mock.ts`, `mentions.mock.ts`, `mentionAutocompleteInput.tsx`, `mentions.module.css` | Same behaviour with `<Link href="/u/username">` (client navigation); `/u/[username]` resolves and redirects to `/user/:id`. Autocomplete gets the same ranking, divider, verified tick and debounce. No vitest in webapp, so no web test file. |

## apps/seller and apps/studio

### Payout onboarding (§38, 3 Oct) — not tested in a browser

| File | Change |
| --- | --- |
| `apps/seller`: `components/payouts/*`, `mocks/handlers/payoutOnboarding.mock.ts`, `types/payoutOnboarding.type.ts`, `utils/payoutName.util.ts` | **New.** Full flow in Settings, Payouts; popup verification with return signal; banner on Wallet overview and Withdraw. |
| `apps/seller`: `components/wallet/withdrawView.tsx` | Locked until verified, "Finish payout setup", fee from the fees endpoint plus arrival estimate. |
| `apps/studio`: `components/payouts/*`, `app/(studio)/earnings/*`, `services/payoutOnboarding.service.ts`, `mocks/payoutOnboarding.mock.ts`, `components/shell/studioShell.*`, `lives/page.tsx` | **New.** Earnings page with the flow and payout fee, header link, Lives banner. |

## apps/mobile and apps/webapp

### Bookmark shows a count, not a "Saved" label (4 Oct) — types checked only

| File | Change |
| --- | --- |
| `apps/mobile`: `components/saves/saveToggleButton.tsx`, `components/clips/clipActionRail.tsx`, `clipPage.tsx`, `feed/postCard.tsx`, `product/productPriceBlock.tsx`, `screens/product/productDetail.screen.tsx` | "Saved"/"Save" label removed; filled bookmark plus optimistic compact `saveCount` under the icon. |
| `apps/mobile`: `hooks/useSaveToggle.hook.ts`, `store/toast.store.ts`, `components/ui/toastHost.tsx` | "Added to Saved" toast with a "View" action opening the Saved screen. |
| `apps/webapp`: `components/saves/*`, `clips/clipPlayerCard.tsx`, `feed/postCard.tsx`, watch and product pages | Same count behaviour; toast "Added to Saved" with "View" to `/saved`. |
| `types/models.type.ts` (both apps), mocks | Optional `saveCount`. Backend gap noted in `docs/plans.md` §39. |

### Email footer (4 Oct)

| File | Change |
| --- | --- |
| `packages/emailTemplates/src/{config/emailBrand.config.ts,emailTypes.ts,layout/emailFooter.layout.tsx}` | Removed the Instagram / X / TikTok / YouTube links from every email footer (owner: Zudomart is itself a social app). Footers keep the app store badges, help, notification settings and support contacts. |
