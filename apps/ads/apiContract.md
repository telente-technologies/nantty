# Zudomart Ads Manager — API contract

Consumer: `apps/ads` (Ads Manager, `ads.<domain>`). Implementer: go-ads (`services/go/modules/ads`, deployable `goAds`) behind the gateway; identity routes are go-identity, `/users/me/*` go-users. go-ads calls the Python ads service (`services/python/intelligence`) for ranking, the second-price auction with quality score, pacing and frequency capping. This app never talks to the Python service.

Rows marked **mock-only** have no backend route yet; the mock adapter serves them and the real gateway returns 404.

The browser never calls the API directly. It calls the Ads Manager BFF (`/bff/...`), which adds `Authorization: Bearer <accessToken>` from an httpOnly cookie, checks the ad-account role, verifies CSRF, and forwards to `GET|POST|PUT|PATCH|DELETE {ADS_API_URL}/api/v1/<path>`. The mock adapter (`src/mocks/**`, on by default in dev via `ADS_USE_MOCKS`) implements every endpoint below and is the reference behaviour.

## Conventions

- **Schemas**: the TypeScript interfaces in `apps/ads/src/types/*.type.ts` are the canonical request/response shapes (names in the tables refer to them). Timestamps are ISO-8601 UTC strings; report dates are `YYYY-MM-DD` in the ad account time zone.
- **Money**: always `Money = { amountMinor: integer, currency: ISO-4217 }` in the **ad account currency** (set from the account country at creation and immutable). Reject any request whose `currency` differs from the account currency with `400 VALIDATION_FAILED`. Never assume NGN.
- **Errors**: `{ message: string, code: string, issues?: { path: string, message: string }[] }`. `path` uses dot notation matching the request body (e.g. `adSet.budget.amount`, `ads.0.creative.headline`). Common codes: `400 VALIDATION_FAILED` (generic `message: "Validation failed"`; the UI shows the first issue's message), `400 INVALID_JSON` (also for unknown fields and wrong number types: go-ads rejects unknown keys), `400 IDEMPOTENCY_KEY_REQUIRED`, `401 UNAUTHENTICATED` (gateway) / `UNAUTHORIZED` (service), `403 FORBIDDEN`, `404 NOT_FOUND | AD_ACCOUNT_NOT_FOUND`, `409 <STATE_CONFLICT>`, `402 INSUFFICIENT_BALANCE`, `413 MEDIA_TOO_LARGE`, `415 MEDIA_TYPE_NOT_SUPPORTED`, `429 RATE_LIMITED`, `503 UPSTREAM_UNAVAILABLE | STORAGE_UNAVAILABLE`.
- **Pagination**: `?cursor=<opaque>&limit=<1..200>` (content sources: 1..50). Lists come back as `{ data: T[], nextCursor: string | null, total?: number }` (`total` only on campaigns, ad sets and ads). `adaptListEnvelope` (`src/utils/listEnvelope.util.ts`) turns that into the internal `Page<T> = { items, nextCursor, total }` at the client boundary, so `{ items }` in the tables below means the server's `{ data }`.
- **Idempotency**: `Idempotency-Key` (8–128 of `A-Z a-z 0-9 - _`) is **required** (400 `IDEMPOTENCY_KEY_REQUIRED` without it) on `POST /ads/accounts`, `POST …/campaigns`, `POST …/campaigns/:id/duplicate`, `POST …/ad-sets`, `POST …/ads`, `POST …/audiences/customer-lists` and the payment endpoints. Same key + same request replays the first response and sets `Idempotent-Replayed: true`; same key + different request is 409 `IDEMPOTENCY_KEY_REUSED`.
- **Delivery range**: list/detail endpoints for campaigns, ad sets and ads accept `?from=YYYY-MM-DD&to=YYYY-MM-DD`; `delivery` metrics cover that range (lifetime when omitted). `delivery.spentToday` is today's spend so far.
- **Account scoping**: every `/ads/accounts/:accountId/...` handler must load the caller's membership for `:accountId` and enforce the permission below (404 `AD_ACCOUNT_NOT_FOUND` for non-members, 403 `FORBIDDEN` for insufficient role). The BFF checks the same matrix, but the API is the authority.

### Roles → permissions

| Permission | admin | advertiser | analyst | billing |
|---|---|---|---|---|
| account:view | ✓ | ✓ | ✓ | ✓ |
| account:manage, members:manage | ✓ | | | |
| campaigns:view, reports:view | ✓ | ✓ | ✓ | ✓ |
| campaigns:manage, audiences:manage, tools:manage | ✓ | ✓ | | |
| billing:view | ✓ | ✓ | | ✓ |
| billing:manage | ✓ | | | ✓ |

## Auth and user (existing endpoints)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| POST | /auth/login | `{ identifier, password }` | `{ accessToken, refreshToken, expiresIn, tokenType, user: { id, name, username, email, avatarUrl } }` | 401 INVALID_CREDENTIALS, 429 |
| POST | /auth/refresh | `{ refreshToken }` | `{ accessToken, refreshToken, expiresIn }` (rotates; old token revoked) | 401 INVALID_REFRESH_TOKEN |
| POST | /auth/logout | `{ refreshToken }` + `Authorization: Bearer` (the gateway requires it; the BFF refreshes once on 401) | 204 | 401 |
| GET | /users/me | — | `{ id, name, username, email, avatarUrl }` | 401 |
| GET | /topics | — | `Topic[]` — **mock-only** | — |
| PATCH | /users/me/preferences | `{ theme: "system" \| "light" \| "dark" }` (go-users; also takes `countryCode`) | 204 | 400 |
| PUT | /users/me/consents | `{ policyVersion, consents: Record<string, boolean> }` (go-users) | consent state | 409 STALE_POLICY_VERSION |

## Accounts, members and invites

| Method | Path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | /ads/memberships | signed in | — | `{ data: AdAccountMembership[] }` (used by the BFF to cache roles) | 401 |
| GET | /ads/accounts | signed in | — | `{ items: AdAccountSummary[] }` (`myRole` = caller's role) | 401 |
| POST | /ads/accounts | signed in | `CreateAdAccountRequest` | 201 `AdAccount` (caller becomes owner + admin; currency from country) | 400 (`storeId` not owned/managed, store already has an account, max 10 admin accounts) |
| GET | /ads/business-profiles | signed in | — | `{ items: LinkedBusinessProfile[] }` stores the caller owns/manages | 401 |
| GET | /ads/accounts/:accountId | account:view | — | `AdAccount` | 404 |
| PATCH | /ads/accounts/:accountId | account:manage | `UpdateAdAccountRequest` | `AdAccount` | 400, 403 |
| GET | /ads/accounts/:accountId/entitlements | account:view | — | `AdsEntitlements` — `verifiedBusiness` true only when the linked store has a verified **Gold** profile; `monthlyAdCredit` for Gold Premium | 404 |
| GET | /ads/accounts/:accountId/members | account:view | — | `{ items: AdAccountMember[] }` | 404 |
| PATCH | /ads/accounts/:accountId/members/:userId | members:manage | `{ role }` | `AdAccountMember` | 409 OWNER_ROLE_LOCKED |
| DELETE | /ads/accounts/:accountId/members/:userId | members:manage | — | 204 | 409 OWNER_CANNOT_BE_REMOVED |
| GET | /ads/accounts/:accountId/invites | account:view | — | `{ items: AdAccountInvite[] }` (pending only; never return tokens) | 404 |
| POST | /ads/accounts/:accountId/invites | members:manage | `{ email, role }` or `{ username, role }` (an existing Zudomart user; a `username` that is an email address is looked up by email) | 201 `AdAccountInvite` (`username` of the invitee, never their email), valid 7 days. The accept link is `https://ads.<domain>/invites/<inviteId>`; go-ads does not send it yet (see backend gaps) | 400 (unknown user, duplicate pending, already member) |
| DELETE | /ads/accounts/:accountId/invites/:inviteId | members:manage | — | 204 | 404 |
| GET | /ads/invites/:inviteId | signed in (invitee) | — | `InvitePreview` | 403 INVITE_USER_MISMATCH, 404 INVITE_NOT_FOUND |
| POST | /ads/invites/:inviteId/accept | signed in (invitee) | — | `{ accountId }` | 403 INVITE_USER_MISMATCH, 404 |
| GET | /ads/accounts/:accountId/activity | account:view | `?objectType=&cursor=&limit=` | `Page<ActivityEntryResponse>` newest first: `{ id, objectType, objectId, actor: string ("System" for automatic), summary, changes: object, createdAt }`. `accountsApi.listActivity` converts it to the UI `ActivityEntry` | 404 |

Write an activity entry for every mutation below (actor, summary, field changes), plus system entries for review decisions and rule actions.

## Campaigns, ad sets and ads

Status machine for campaigns, ad sets and ads: `draft → in_review → active ⇄ paused → completed`, `in_review → rejected`, `rejected → in_review` (after edit or submit). Editing the creative of a non-draft ad sends it back to `in_review`. A campaign becomes `active` when at least one of its ads is approved, `rejected` when all are rejected.

| Method | Path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | /ads/accounts/:accountId/campaigns | campaigns:view | `?status=&objective=&search=&from=&to=&cursor=&limit=` | `Page<Campaign>` | 404 |
| POST | /ads/accounts/:accountId/campaigns | campaigns:manage | `CampaignDraftSubmission` (campaign + one ad set + 1–6 ads; `submitForReview`) + `Idempotency-Key` | 201 `CampaignDraftResult` | 400 (issues paths `campaign.*`, `adSet.*`, `ads.N.*`), 409 AD_ACCOUNT_NOT_ACTIVE |
| GET | /ads/accounts/:accountId/campaigns/:campaignId | campaigns:view | `?from=&to=` | `Campaign` | 404 |
| PATCH | /ads/accounts/:accountId/campaigns/:campaignId | campaigns:manage | `Partial<CampaignInput> & { status?: "active" \| "paused" }` (objective immutable; go-ads treats `null` as "unchanged", so `spendCap: null` and `schedule.endAt: null` cannot clear a value yet) | `Campaign` | 400, 402 INSUFFICIENT_BALANCE, 409 STATUS_CHANGE_NOT_ALLOWED |
| DELETE | /ads/accounts/:accountId/campaigns/:campaignId | campaigns:manage | — | 204 (drafts only, cascades) | 409 ONLY_DRAFTS_CAN_BE_DELETED |
| POST | /ads/accounts/:accountId/campaigns/:campaignId/submit | campaigns:manage | — | `Campaign` (draft/rejected ads → in_review) | 409 NOTHING_TO_SUBMIT |
| POST | /ads/accounts/:accountId/campaigns/:campaignId/duplicate | campaigns:manage | — | 201 `Campaign` (draft copy with ad sets and ads) | 404 |
| POST | /ads/accounts/:accountId/bulk-actions | campaigns:manage | `{ level: "campaign"\|"ad_set"\|"ad", ids: string[≤100], action: BulkAction }` | `BulkActionResult` (partial success allowed) | 400 |
| GET | /ads/accounts/:accountId/ad-sets | campaigns:view | `?campaignId=&from=&to=` | `Page<AdSet>` | 404 |
| POST | /ads/accounts/:accountId/ad-sets | campaigns:manage | `{ campaignId } & AdSetInput` | 201 `AdSet` (draft) | 400 |
| GET | /ads/accounts/:accountId/ad-sets/:adSetId | campaigns:view | `?from=&to=` | `AdSet` | 404 |
| PATCH | /ads/accounts/:accountId/ad-sets/:adSetId | campaigns:manage | `Partial<AdSetInput> & { status? }` (go-ads cannot clear `frequencyCap` or `schedule.endAt` with `null` yet) | `AdSet` | 400, 409 |
| GET | /ads/accounts/:accountId/ads | campaigns:view | `?campaignId=&adSetId=&reviewStatus=&from=&to=` | `Page<Ad>` | 404 |
| POST | /ads/accounts/:accountId/ads | campaigns:manage | `{ adSetId } & AdInput` | 201 `Ad` (draft) | 400 |
| GET | /ads/accounts/:accountId/ads/:adId | campaigns:view | `?from=&to=` | `Ad` | 404 |
| PATCH | /ads/accounts/:accountId/ads/:adId | campaigns:manage | `{ name?, creative?: CreativeInput, status? }` | `Ad` | 400, 409 |
| POST | /ads/accounts/:accountId/ads/:adId/appeal | campaigns:manage | `{ message }` (20–1000 chars) | `Ad` with `review.appeal.status = "pending"` | 409 NOT_REJECTED, 409 ALREADY_APPEALED (one appeal per decision) |

Validation (mirror `src/mocks/mockCampaignValidation.mock.ts`): name ≤120; lifetime budget needs `endAt`; `endAt > startAt`; daily budget ≥ per-currency minimum (NGN 100,000 minor, GHS 1,000, KES 10,000, ZAR 2,000, GBP/EUR/USD 100); `budgetLevel: "campaign"` ⇒ campaign budget and no ad-set budget, `"ad_set"` ⇒ the reverse; bid `amount` required unless `auto`; frequency cap 1–20 impressions per 1–30 days; ages 18–65 (65 = 65+); ≥1 location; custom audiences must belong to the account (go-ads currently rejects any `customAudienceIds` with "Custom audiences are not available yet."); placements ⊆ `feed, clips, mart, search, stories, live` (automatic = all); headline ≤60, primary text ≤500; destination `url` must be `https://` without credentials (see Rich ad formats for card, app-install and promoted-post rules); creative sources must belong to the account and be eligible.

Policy review: run automated checks at submit (prohibited categories in `src/constants/policy.constant.ts`), then human review. On rejection set `review.policyCode` (a code from the policy page, used for `/policy#<code>` links) and a plain-language `policyReason`.

## Placements and ad formats

Ads take the shape of the content in the slot. `AdPlacement` values map to four formats advertisers pick from:

| Format | Placements | Creative accepted | Shown as |
|---|---|---|---|
| Marketplace | `mart` (Mart grids, categories), `search` | product sources only | product tile marked **Ad**, inserted at fixed slots (2nd, 7th, 12th, 19th…), never adjacent |
| Feed | `feed` | images 4:5–1.91:1 (others cropped to 4:5); videos only if landscape or ≥60 s; live sessions as live cards | sponsored post card |
| Reels | `clips` (reels pager), `stories` | vertical 9:16 video 3–90 s; landscape video ≤10 min letterboxed with **View full screen**; stories also accept vertical images; live sessions as full-screen live cards in `clips` | full-screen clip / story |
| Live | `live` (live discovery) | live sessions (`ContentSource.type = "live"`, scheduled or live) | promoted live card; also eligible in `feed` and `clips` |

The rules live in `src/utils/adPlacementRules.util.ts` and must be mirrored server-side: on create/update of an ad, reject with `400` and path `ads.N.creative.placements` (or `creative.placements` for single-ad endpoints) when the creative fits **none** of its ad set's placements; when it fits only some, deliver only where it fits (automatic placements = all six). The mobile app's `AdPlacement` type currently lacks `stories` and `live`; the API should send those values once the app renders them.

## Creatives and media

| Method | Path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | /ads/accounts/:accountId/content-sources | campaigns:view | `?type=post\|clip\|product\|live\|store&search=&cursor=&limit=` (live = scheduled or ongoing sessions with `live: CreativeLiveStream`) | `Page<ContentSource>` from the account owner's profile or linked store; `eligible:false` + `ineligibleReason` for giveaways, removed or age-restricted content. `type=store` lists the same stores as `promotable-destinations` (`id` = store id, `text: ""`, `media` = the logo if any, zero engagement, `product: null`) | 404 |
| GET | /ads/accounts/:accountId/promotable-destinations | campaigns:view | `?type=profile\|store` | `{ data: PromotableDestination[] }` (not paginated). Profiles: the account owner's own profile (`id` = the owner's user id). Stores: stores the owner owns plus the store linked to a business account. Suspended or closed entries come back with `eligible:false` and an `ineligibleReason` | 400 VALIDATION_FAILED (other types), 404 |
| POST | /ads/accounts/:accountId/creatives/preview | campaigns:view | `CreativeInput` | `Creative` resolved exactly as it will render (identity, verified badge, media, product price) — **mock-only** | 400 |
| POST | /ads/accounts/:accountId/creatives/media/uploads | campaigns:manage | `{ fileName, mimeType, sizeBytes, clientMetadata?: { width, height, durationSeconds } \| null }` (integers; hints read in the browser) | 201 `MediaUploadIntent` `{ mediaId, uploadUrl, uploadHeaders, expiresAt }` | 400, 413 MEDIA_TOO_LARGE, 415 MEDIA_TYPE_NOT_SUPPORTED, 503 STORAGE_UNAVAILABLE |
| PUT | `uploadUrl` | presigned | the whole file, with `uploadHeaders` (the browser sends it straight to object storage) | 200 | storage error |
| POST | /ads/accounts/:accountId/creatives/media/:mediaId/complete | campaigns:manage | — | `{ mediaId, status: "processing" }` | 404 MEDIA_NOT_FOUND, 409 UPLOAD_INCOMPLETE |
| GET | /ads/accounts/:accountId/creatives/media/:mediaId | campaigns:view | — | `UploadedMedia` (`processing` until transcoded) | 404 MEDIA_NOT_FOUND |

`PromotableDestination` = `{ kind: "profile" | "store", id, name, handle, avatarUrl: string | null, verified, checkmarkColor?, private, available, eligible, ineligibleReason: string | null }`. When `destination.type` is `profile` or `store`, `destination.targetId` must be the `id` of an eligible entry; anything else is rejected with `400 VALIDATION_FAILED`, path `ads.N.creative.destination.targetId` (or `creative.destination.targetId` on single-ad endpoints) and "You can only promote content you own or manage." Store staff can promote a store only with the owner or manager role. A resolved `Creative` whose source or destination is a store or profile carries `promoted: { kind, id, name, handle, avatarUrl, verified, checkmarkColor?, private }`; such ads stop serving while the store or profile is suspended or deleted and resume when it is reinstated. The wizard picks the entry in `src/components/campaignWizard/promotedDestinationPicker.tsx` and shows a "View profile" / "View store" card in the preview. Store and profile creatives serve in `feed` (including feed comment threads) only; never in pre-roll/post-roll, `clips`, `stories`, `live`, `mart` or `search` yet.

`/accounts?next=<relative path>` (e.g. `next=campaigns%2Fnew%3Fobjective%3Dstore_promotion`) forwards to `/accounts/{chosen}/<path>`, straight away when the user has one ad account; only relative segments of letters, digits, `-` and `_` plus a query are honoured (`src/utils/accountForwardPath.util.ts`). `/accounts/{id}/campaigns/new?objective=<CampaignObjective>` preselects the objective.

Accepted: JPG, PNG, WebP, AVIF, MP4, MOV up to 500 MB. `mediaIds` and card `mediaId`s in a `CreativeInput` must be ids from this flow (the generic `/media/uploads` ids are unknown to go-ads). The upload origin must be in `ADS_UPLOAD_URL` (CSP `connect-src`) and allow CORS `PUT` from the Ads Manager origin; `Creative.media[].url` must be an https CDN URL whose origin is set as `ADS_MEDIA_URL`. The mock returns a same-origin `uploadUrl` through the BFF (12 MB limit).

## Rich ad formats

`CreativeInput` and `Creative` gain these fields (all optional on old data; a missing `type` means `single`):

| Field | Meaning |
|---|---|
| `type` | `single \| carousel \| app_install \| promoted_post` |
| `mediaClickable` | `single` only: tapping the media opens the destination |
| `cards[]` | `carousel` only, 2-10: input `{ mediaId, headline (<=40), description (<=90), callToAction, destination }`; resolved `{ media: CreativeMedia, ... }`. Feed format only (`format: "feed_post"`) |
| `app` | `app_install` only: `{ appName (<=50), iconMediaId?, iconUrl?, rating: 1-5 \| null, iosStoreUrl, androidStoreUrl, webFallbackUrl, iosDeepLink, androidDeepLink }`; destination type `app_store` |
| `destination.type` | adds `app_store`; `destination.utm?: { source?, medium?, campaign?, content?, term? }` for `url` |
| `callToAction` | adds `install`, `download`, `book_now`, `contact_us` |

Validation (mirrors `src/utils/adCreativeFormats.util.ts` and go-ads `creativeFormats.validator.go`): carousel needs 2-10 cards, each with media, a headline and a valid destination, and is feed-only; `iosStoreUrl` must be `https://apps.apple.com|itunes.apple.com/.../app/...`, `androidStoreUrl` `https://play.google.com/store/apps/details?id=...`, deep links custom schemes only (never http, javascript, data, file, intent); at least one store link, and a `webFallbackUrl` whenever only one store link is set; `promoted_post` needs source `post|clip` and a `post` destination with the same id. Paths use dot notation (`ads.0.creative.cards.1.headline`, `ads.0.creative.app.iosStoreUrl`). UTM values: letters, digits, `-`, `_`, `.`, up to 60 characters; missing `utm_source`/`utm_medium` default to `zudomart`/`paid`; parameters already on the link are kept.

Review: external destinations are checked at review against `ADS_BLOCKED_DOMAINS` (CRITICAL), link shorteners, raw IPs and punycode hosts (HIGH); card text and app name are scanned with the headline. The review queue item adds `creative.type`, `creative.cards[] { imageUrl, headline, description, callToAction, landingUrl }`, `creative.app`.

Delivery (`POST /api/v1/ads/decide` in the social apps, not the Ads Manager): `DecidedAd.clickLinks { media?, cta?, cards? }` are signed `GET /api/v1/ads/r/{token}` redirects that log the click and `302` to the creative's own destination only; bad tokens return 404 with no redirect. `POST /api/v1/ads/events` accepts `token`, `cardIndex` and event type `card_view`.

| Method | Path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | /ads/accounts/:accountId/ads/:adId/cards/report | reports:view | `?from&to` | `{ items: [{ cardIndex, headline, imageUrl, impressions, clicks, ctr }] }` for carousels (empty for other types) | 404 |

## Audiences and estimates

| Method | Path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | /ads/locations | signed in | `?search=&countryCode=` | `{ items: LocationTarget[] }` (≤25; countries, states/regions, cities; Nigeria-first ordering) — **mock-only** | — |
| GET | /ads/behaviours | signed in | — | `{ items: Behaviour[] }` — **mock-only** | — |
| GET | /ads/accounts/:accountId/audiences | campaigns:view | `?type=` | `Page<CustomAudience>` | 404 |
| POST | /ads/accounts/:accountId/audiences | audiences:manage | `CreateCustomAudienceRequest` | 201 `CustomAudience` (`building`, becomes `ready`/`too_small`) | 400 (store audience without linked store, lookalike of lookalike, similarity not 1–10) |
| POST | /ads/accounts/:accountId/audiences/customer-lists | audiences:manage | `CustomerListUploadRequest` + `Idempotency-Key` | 201 `CustomAudience` | 400 unless every row is a 64-char lowercase SHA-256 hex; 1–50,000 rows per request |
| PATCH | /ads/accounts/:accountId/audiences/:audienceId | audiences:manage | `{ name }` | `CustomAudience` | 404 |
| DELETE | /ads/accounts/:accountId/audiences/:audienceId | audiences:manage | — | 204 | 409 AUDIENCE_IN_USE |
| POST | /ads/accounts/:accountId/estimates/audience | campaigns:view | `AudienceEstimateRequest` | `AudienceEstimate` (ranges, breadth, daily reach/results, warnings) | 400 |

Customer lists: the browser normalizes (emails trimmed + lowercased; phones to E.164 digits without `+`) and hashes with SHA-256 before upload. The API must never accept, log or store raw identifiers, must match against identically-normalized hashes, and should delete unmatched hashes after matching. Audiences below 100 matched people are `too_small` and cannot be targeted. Estimates come from the ads service and must be rounded ranges (never exact counts) so small audiences cannot be probed.

## Billing

| Method | Path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | /ads/accounts/:accountId/billing | billing:view | — | `BillingOverview` | 404 |
| POST | /ads/accounts/:accountId/billing/top-ups **(mock-only)** | billing:manage | `{ amount: Money, provider: "flutterwave", returnPath }` + **Idempotency-Key** (the Go handler accepts `"flutterwave"` or an empty provider and records the one actually used) | 201 `TopUpCheckout` `{ topUpId, reference, provider: "flutterwave", checkoutUrl?, authorizationUrl, accessCode? }` — the app redirects to `checkoutUrl ?? authorizationUrl` (hosted checkout, host allowlisted, no inline script); the provider returns to `https://ads.<domain><returnPath>?status=…&tx_ref=<ref>&transaction_id=…` (Flutterwave). The redirect is display-only: the return page ignores `status` and polls `GET …/top-ups/:reference` every 3 s for up to 2 min, pausing offline | 400 (amount outside min/max, wrong currency), 400 IDEMPOTENCY_KEY_REQUIRED |
| GET | /ads/accounts/:accountId/billing/top-ups/:reference **(mock-only)** | billing:view | — | `TopUp` — verify with the provider server-side (and via webhook); credit the balance exactly once | 404 |
| POST | /ads/accounts/:accountId/billing/fund-from-earnings | billing:manage (and the account owner) | `{ amount: Money }` + **Idempotency-Key** | 201 `EarningsFunding` `{ fundingId, amount, status: "succeeded" }` — moves the caller's "Available to withdraw" (GET /wallets/me) into this ad account's prepaid balance. UI label "Pay from my Zudomart balance", next to the card top-up; a new key per attempt, reused only to retry the same amount after a network/5xx failure | 403 VERIFICATION_REQUIRED, 403 FORBIDDEN (not the owner), 409 IDEMPOTENCY_KEY_REUSED, 422 INSUFFICIENT_FUNDS ("Amount is more than your available balance.") |
| GET | /ads/verification | signed in | — | `AdsVerification` `{ level, verified, nextStep, message, verifyUrl }` — when `verified` is false the app shows a "Verify to advertise" prompt linking to `verifyUrl` (only http/https URLs are followed) | 503 VERIFICATION_UNAVAILABLE |
| GET | /wallets/me (go-money) | signed in, GET only | — | `ZudomartWalletSummary` (apps/ads/src/types/zudomartWallet.type.ts). The billing page renders `lines` in order with the backend `label` and `description`, coins (currency `"COIN"`) as "N coins", never summed | 401 |
| GET | /ads/accounts/:accountId/billing/transactions | billing:view | `?cursor=&limit=` | `Page<BillingTransaction>` (signed amounts) | 404 |
| GET | /ads/accounts/:accountId/billing/transactions/:transactionId/receipt **(mock-only)** | billing:view | — | PDF (`Content-Disposition: attachment`) | 404 NO_RECEIPT |
| GET | /ads/accounts/:accountId/billing/invoices **(mock-only)** | billing:view | `?cursor=&limit=` | `Page<Invoice>` monthly, with VAT | 404 |
| GET | /ads/accounts/:accountId/billing/invoices/:invoiceId/download **(mock-only)** | billing:view | — | PDF attachment | 404 |
| PUT | /ads/accounts/:accountId/billing/spend-limit | billing:manage | `{ amount: Money \| null }` (monthly account spending limit; null removes) | `BillingOverview` | 400 |
| PUT | /ads/accounts/:accountId/billing/funding-mode | billing:manage | `{ fundingMode }` | `BillingOverview` | 400 (card modes need a card; go-ads accepts only `prepaid` for now) |
| POST | /ads/accounts/:accountId/billing/payment-methods **(mock-only)** | billing:manage | `{ provider, returnPath }` + **Idempotency-Key** | 201 `TopUpCheckout` (card authorization on the hosted checkout page; returns with `?cardReference=`) | 400 |
| POST | /ads/accounts/:accountId/billing/payment-methods/:paymentMethodId/default **(mock-only)** | billing:manage | — | `BillingOverview` | 404 |
| DELETE | /ads/accounts/:accountId/billing/payment-methods/:paymentMethodId **(mock-only)** | billing:manage | — | 204 | 409 CARD_REQUIRED |

go-money already serves `POST /ads/balance/top-ups` (`{ adAccountId, amount, returnTo }` + Idempotency-Key → `{ id, adAccountId, reference, status, amount, checkoutUrl }`, NGN only, ₦1,000–₦10,000,000), but go-ads does not credit the ad account from it and has no status lookup, so the app keeps the account-scoped top-up rows above (mock-only).

Spend order: ad credits (Gold Premium monthly grant, expires at month end) → prepaid balance → default card (when `fundingMode` allows). Delivery pauses at zero available funds or when the monthly spend limit or a campaign `spendCap` is reached. Card data never touches Zudomart servers (tokenized by the provider). The mock adapter returns plain-text receipts and invoices; the real API returns PDFs. The ads service bills on actual second-price clearing; creator revenue share for ads served on creator content is computed server-side and is not exposed to advertisers.

## Reports

| Method | Path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | /ads/accounts/:accountId/reports | reports:view | `?from&to` (≤400 days) `&compareFrom&compareTo&breakdown=campaign\|ad_set\|ad\|placement\|day\|country\|state\|age\|gender&campaignIds=a,b&clickWindowDays=1\|7\|28&viewWindowDays=0\|1` | `ReportResponse` (totals, rows, daily series, optional comparison) | 400 |
| GET | /ads/accounts/:accountId/reports/export | reports:view | same query + `&columns=spend,impressions,…` (`MetricKey`s) | `text/csv; charset=utf-8` with BOM, attachment; money columns in major units with the currency in the header; cells starting with `= + - @` prefixed with `'` | 400 |
| GET | /ads/accounts/:accountId/reports/export.pdf | reports:view | same query | `application/pdf` attachment (served by go-ads, not used by the app yet) | 400 |
| GET | /ads/accounts/:accountId/reports/scheduled | reports:view | — | `Page<ScheduledReport>` | 404 |
| POST | /ads/accounts/:accountId/reports/scheduled | reports:view | `ScheduledReportInput` (1–10 recipients) | 201 `ScheduledReport` | 400 |
| DELETE | /ads/accounts/:accountId/reports/scheduled/:scheduledReportId | reports:view | — | 204 | 404 |

Metric definitions: CTR = clicks/impressions; CPC = spend/clicks; CPM = spend/impressions×1000; frequency = impressions/reach; ROAS = conversionValue/spend; `conversions`/`conversionValue` are Zudomart store orders attributed within the chosen click/view windows (last-touch; one order counted once); `averageWatchPercent` is a 0–1 ratio. Demographic rows under 100 people are merged into "Other" to protect privacy.

## Tools

Every row in this section is **mock-only**.

| Method | Path | Permission | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | /ads/accounts/:accountId/conversion-events | campaigns:view | — | `Page<ConversionEvent>` (built-in store events are created automatically for business accounts) | 404 |
| POST | /ads/accounts/:accountId/conversion-events | tools:manage | `ConversionEventInput` | 201 `ConversionEvent` | 409 STORE_REQUIRED |
| PATCH | /ads/accounts/:accountId/conversion-events/:eventId | tools:manage | `{ name?, status?: "active"\|"paused" }` | `ConversionEvent` | 409 BUILT_IN_EVENT |
| GET | /ads/accounts/:accountId/experiments | campaigns:view | — | `Page<Experiment>` | 404 |
| POST | /ads/accounts/:accountId/experiments | tools:manage | `ExperimentInput` (2–5 ad sets of one campaign, split sums to 100, ≥4 days, ad set in one test at a time) | 201 `Experiment` | 400 |
| POST | /ads/accounts/:accountId/experiments/:experimentId/stop | tools:manage | — | `Experiment` | 409 NOT_RUNNING |
| GET | /ads/accounts/:accountId/rules | campaigns:view | — | `Page<AutomatedRule>` | 404 |
| POST | /ads/accounts/:accountId/rules | tools:manage | `AutomatedRuleInput` (1–5 conditions; money thresholds in major units of the account currency, `ctr` as a percent number e.g. `1.5`) | 201 `AutomatedRule` | 400 |
| PATCH | /ads/accounts/:accountId/rules/:ruleId | tools:manage | `Partial<AutomatedRuleInput> & { status? }` | `AutomatedRule` | 400 |
| DELETE | /ads/accounts/:accountId/rules/:ruleId | tools:manage | — | 204 | 404 |

Experiments split traffic by user (not impression) so a person only sees one arm; `result` carries the winner and statistical confidence. Rules run on the schedule in `checkEveryMinutes`, act only on items in the account, and log an `ActivityEntry` with the system actor "Automated rule".

## Verification (L1 payout-verified required)

Any ads-platform action by a user below L1 (ad account creation, campaign publish/submit, top-ups, paying from balance) returns `403 { code: "VERIFICATION_REQUIRED", message }`; `503 VERIFICATION_UNAVAILABLE` when the level cannot be read. The API client broadcasts VERIFICATION_REQUIRED so the app shell shows the same verify prompt as GET /ads/verification, and the create-account form, campaign wizard and top-up/pay-from-balance dialogs show the prompt instead of a generic error. Mock mode: `ibrahim@ifelifestyle.ng` is L0; every other demo user is L1.

