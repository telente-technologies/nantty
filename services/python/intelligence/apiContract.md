# Nantty Intelligence API Contract (v1)

This is the authoritative contract between the callers (ts-social, ts-search, ts-media, go-ads,
go-users, go-moderation) and the Python intelligence service (`services/python/intelligence`). The Pydantic DTOs in `src/modules/*/dtos/*.py`, `src/dtos/` and `src/events/` are the source
of truth; this document mirrors them.

Rule: **the Go and TypeScript services own the product, Python owns intelligence, events connect them.** Python never
reads the product database. Every answer from Python is advisory: the API re-validates every id it
gets back and falls back to deterministic logic whenever Python is slow, down or degraded.

## 1. General conventions

- Transport: HTTP/1.1 JSON, internal network only. Base URL e.g. `http://intelligence:8090`.
- JSON keys are **camelCase**. Unknown fields are **rejected** (`extra="forbid"`), so send only
  documented fields.
- Timestamps: ISO 8601 **with timezone** (`2026-09-29T12:00:00Z`). Naive timestamps are rejected.
- `now` (optional on most requests): the API's clock. Send it for deterministic behaviour; Python uses
  its own UTC clock otherwise.
- Ids (`OpaqueIdentifier`): `^[A-Za-z0-9_\-:.]{1,128}$`. Send **opaque or hashed ids only**. Never send
  names, emails, phone numbers, addresses, raw search text or free text of any kind.
- **User id hashing** (personalization surfaces: viewer ids, `authorId`, `creatorId`, followed/blocked/muted
  account ids, event `actorId`): `u_` + the first 40 lowercase hex chars of
  `HMAC-SHA256(key, "user:" + rawUserId)`. Search queries: `q_` + 40 hex of `HMAC-SHA256(key, "query:" + q)`
  where `q` is NFKC-normalised, trimmed, lowercased and whitespace-collapsed. `key` is
  `INTELLIGENCE_ID_HASH_SECRET` (UTF-8) when set, otherwise `HMAC-SHA256(INTELLIGENCE_SHARED_SECRET,
  "nantty:intelligence:user-id-hash")` (raw 32 bytes), so every caller that signs requests can derive it.
  Hashing is idempotent: a value already matching `^u_[0-9a-f]{40}$` is used unchanged. Python hashes the
  raw ids it receives in domain events with the same key, so features written from events and ids sent
  over HTTP line up. Risk, trust, bot, chat-spam, gift and value-flow endpoints keep raw account ids,
  because goTrust and the money services act on them.
- Topic / hashtag slugs: `^[a-z0-9_\-]{1,64}$` (lowercase, no `#`). Max 20 per item.
- Country: ISO 3166-1 alpha-2 uppercase (`NG`). Region: `^[A-Z0-9\-]{1,12}$` (e.g. `LA`, `NG-LA`).
- Currency: ISO 4217 (`NGN`).
- Age bracket: one of `13-17`, `18-24`, `25-34`, `35-44`, `45-54`, `55-64`, `65+`.
- Money: `{"amountMinor": <int 0..10^15>, "currency": "NGN"}`. Amounts in different currencies are
  never added or compared directly. Where a comparison is needed the request carries
  `exchangeRates`: `[{"currency": "NGN", "usdPerMajorUnit": "0.00065"}]` (decimal string or number,
  > 0, up to 12 decimal places; USD is implied as 1). Minor-unit exponent is 2 except JPY/KRW/XOF/XAF/UGX/RWF (0)
  and KWD/BHD/OMR/TND (3).
- Lists of candidates: max 500 unless stated.

### Common objects

`ViewerContext`

| field | type | notes |
|---|---|---|
| userId | id | required, hashed/opaque |
| country | country \| null | |
| region | region \| null | |
| chosenTopics | topic[] ≤50 | the personalization topics the user picked at onboarding |
| ageBracket | ageBracket \| null | used only for ad targeting |
| followedAccountIds | id[] ≤5000 | users and stores the viewer follows |
| blockedAccountIds | id[] ≤5000 | always excluded |
| mutedAccountIds | id[] ≤5000 | always excluded |
| hiddenItemIds | id[] ≤5000 | always excluded |
| seenItemIds | id[] ≤5000 | recently seen; Python also tracks the last 1000 seen items from events |

`RankingResponseMetadata` (on every ranking-style response)

```json
{"requestId": "c1f0...", "rankingSource": "for_you:model", "modelVersion": "20260929T122750Z-7de672a5",
 "degraded": false, "generatedAt": "2026-09-29T12:00:00Z"}
```

`degraded: true` means the online feature store (Redis) was unavailable and the answer used request
data only. It is still valid; the API may log it and may prefer its fallback for money-sensitive paths.
`rankingSource` suffix `heuristic` means no trained model was active (rule-based cold start). For
For You requests with more than 120 candidates the source is `for_you:model_two_stage` (all candidates
pre-ranked by the rule heads, the best 120 re-scored by the model; the rest are not returned). Treat
`rankingSource` as informational only.

`ExcludedItem`: `{"itemId": "...", "reason": "duplicate_candidate" | "blocked_or_muted_author" | "hidden_by_viewer" | "already_seen"}`.

## 2. Authentication: HMAC request signing

Every `/v1/*` request must be signed. `/health/*` is unsigned.

Headers:

| header | value |
|---|---|
| `x-nantty-timestamp` | Unix time in seconds (9–11 digits) |
| `x-nantty-nonce` | 16–64 chars, `^[A-Za-z0-9_\-]+$`, unique per request |
| `x-nantty-signature` | `v1=` + lowercase hex HMAC-SHA256 |
| `content-type` | `application/json` |

Canonical string (lines joined with `\n`, no trailing newline):

```
v1
<HTTP METHOD, uppercase>
<path exactly as sent, plus "?" + raw query string if there is one>
<timestamp header value>
<nonce header value>
<lowercase hex SHA-256 of the raw request body bytes (empty body => sha256 of "")>
```

Signature = `HMAC-SHA256(INTELLIGENCE_SHARED_SECRET, canonicalString)`, hex encoded, prefixed `v1=`.

Rules enforced by the service:

- `|now - timestamp| <= 300 s` (configurable), otherwise 401.
- The nonce is single-use: it is stored in Redis for 900 s; a replay returns 401.
- If the replay store is unavailable the request is refused with **503** (fail closed).
- `INTELLIGENCE_PREVIOUS_SHARED_SECRET` is also accepted, so secrets can be rotated without downtime
  (deploy the new secret to Python as current + old as previous, then roll the API).
- Sign the exact bytes you send. Do not re-serialize the body after signing.
- Body limits: 1 MiB for all `/v1/*` routes except `/v1/events` (4 MiB). Over the limit => 413.
- Rate limit: token bucket per client IP (default 2000 req/s, burst 4000) => 429 with `Retry-After`.
- Authentication failures always return `{"error":{"code":"unauthenticated"}}` with no detail.

TypeScript reference:

```ts
import { createHash, createHmac, randomBytes } from "node:crypto";

export function signIntelligenceRequest(secret: string, method: string, pathWithQuery: string, body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(18).toString("base64url"); // 24 url-safe chars
  const bodyDigest = createHash("sha256").update(body, "utf8").digest("hex");
  const canonical = ["v1", method.toUpperCase(), pathWithQuery, timestamp, nonce, bodyDigest].join("\n");
  const signature = createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
  return {
    "content-type": "application/json",
    "x-nantty-timestamp": timestamp,
    "x-nantty-nonce": nonce,
    "x-nantty-signature": `v1=${signature}`,
  };
}
// const body = JSON.stringify(payload); fetch(url, { method: "POST", body, headers: signIntelligenceRequest(secret, "POST", "/v1/feed/rank", body) })
```

## 3. Errors

| status | body | meaning / client action |
|---|---|---|
| 401 | `{"error":{"code":"unauthenticated"}}` | bad/missing signature, skew, replay. Do not retry with the same nonce. |
| 413 | `{"error":{"code":"request_body_too_large"}}` | split the batch |
| 422 | `{"error":{"code":"invalid_request","fields":["body.candidates.0.createdAt", ...]}}` | contract bug on the API side; use fallback and log |
| 429 | `{"error":{"code":"rate_limited"}}` + `Retry-After` | fallback now, back off |
| 503 | `{"error":{"code":"deadline_exceeded" \| "replay_protection_unavailable" \| "event_storage_unavailable" \| "feature_store_unavailable"}}` | fallback; events: retry later with the same eventIds |
| 500 | `{"error":{"code":"internal_error"}}` | fallback |

The service enforces an internal per-request deadline of 250 ms for ranking-style routes.

## 4. Client timeouts and fallback summary

| endpoint | client timeout | fallback when Python is down, times out, returns 4xx/5xx |
|---|---|---|
| POST /v1/feed/rank | 250 ms | For You: social `deterministicFeedRanker` (quality x integrity x capped boost, see `docs/architecture/recommendations.md` §7), no consecutive author, drop blocked/hidden/seen. Following: pure reverse chronological. |
| POST /v1/clips/rank | 250 ms | quality × smoothed completion rate × capped boost, no consecutive same creator (social `deterministicClipRanker`) |
| POST /v1/social-proof/select | 80 ms | no banners, or a simple rule: ≥2 followed friends engaged, at most every 5th post |
| POST /v1/ads/select | 120 ms | no ads, or highest-bid eligible ad per slot using the same load rules (first after 3 organic, ≥6 between, never adjacent, skip sensitive/reported neighbours) and charging no more than the bid; never exceed budget |
| POST /v1/search/rerank | 100 ms | text relevance order from the search engine |
| POST /v1/risk/score | 120 ms | API's own conservative rules; unknown => `review`. Never auto-ban. |
| POST /v1/recommendations/* | 150 ms | products: same category / same store bestsellers; accounts: most mutual follows then followers; clips: recent popular in chosen topics |
| POST /v1/trending | 150 ms | API count query over the last 24 h with distinct-user threshold |
| POST /v1/experiments/assign | 80 ms | compute locally with the hash in section 8 (identical result) |
| POST /v1/audio/* | 3 s | accept the upload, queue fingerprint/match for retry; review copyright later |
| POST /v1/events | 2 s | keep in outbox, retry with backoff, same eventIds |

Recommended: a circuit breaker (e.g. open after 5 consecutive failures or >50% errors in 10 s, half-open
after 5 s) so a dead Python service costs nothing on the request path.

## 5. Health (unsigned)

- `GET /health/live` => `200 {"status":"ok"}` (process up).
- `GET /health/ready` => `200 {"status":"ready"}` or `503 {"status":"degraded"}` (feature store unreachable).
- `GET /v1/models` (signed) => `{"models": {"feed_engagement": {"version": "...", "createdAt": "...", "metrics": {...}}, ...}}`
  lists the model versions currently loaded (hot-reloaded every 30 s).

## 6. Event ingestion

### POST /v1/events

```json
{"events": [ <envelope>, ... ]}
```

- 1..500 events per batch, ≤4 MiB.
- Each event is validated independently; valid events are accepted even if others are rejected.
- Idempotent by `eventId` for 7 days: re-sending returns it under `duplicates`.
- Events with `occurredAt` more than 5 minutes in the future are rejected.
- 503 `event_storage_unavailable` => nothing from that batch was stored; retry the whole batch with the same eventIds.

Response:

```json
{"accepted": 498, "duplicates": 1, "rejected": [{"index": 7, "eventId": "evt_01H...", "reason": "missing at post_liked.payload.postId"}]}
```

Rejection reasons never echo values. A rejected event should be fixed or dropped, not retried unchanged.

### Envelope

```json
{
  "eventId": "evt_01J8Z3...",
  "eventType": "post_viewed",
  "eventVersion": 1,
  "occurredAt": "2026-09-29T11:59:58.120Z",
  "producer": "api",
  "actorId": "u_9f2c1e...",
  "country": "NG",
  "region": "LA",
  "context": {
    "surface": "feed_for_you",
    "rankingRequestId": "c1f0a3...",
    "experimentAssignments": {"feed_blend_v2": "treatment"},
    "deviceClass": "android"
  },
  "payload": { ... }
}
```

| field | type | notes |
|---|---|---|
| eventId | id | required, unique, used for idempotency |
| eventType | enum | see table below (discriminator) |
| eventVersion | `1` | bump only on incompatible payload change |
| occurredAt | datetime | when it happened (not when forwarded) |
| producer | `^[a-z_\-]{1,40}$` | default `api` |
| actorId | id | hashed user id of whoever did it |
| country / region | optional | viewer's resolved country/region (drives trending by country) |
| context.surface | `^[a-z_]{1,40}$` optional | e.g. `feed_for_you`, `feed_following`, `clips`, `mart_home`, `search` |
| context.rankingRequestId | id optional | echo `metadata.requestId` from the ranking response that showed the item |
| context.experimentAssignments | map ≤20 | experiment key => variant; drives per-variant metrics |
| context.deviceClass | `android` \| `ios` \| `web` \| `other` | optional |

Items that carry topics accept `topics` and `hashtags` (slug[] ≤20 each) — marked "+topics" below.
They feed topic affinity and trending, so send them.

| eventType | payload fields |
|---|---|
| post_viewed | postId, authorId, dwellMs (0..3 600 000), position?, isProductPost (default false), +topics |
| post_liked | postId, authorId, +topics |
| commented | postId, authorId, +topics |
| shared | postId, authorId, channel (`in_app` \| `external` \| `message` \| `story`, default in_app), +topics |
| followed | targetAccountId, targetKind (`user` \| `store`) |
| clip_watched | clipId, creatorId, watchFraction (0..1), loopCount (0..100, default 0), durationMs, +topics |
| product_viewed | productId, storeId, sourcePostId?, categoryId?, price? (Money), topics? |
| added_to_cart | productId, storeId, quantity (1..10000), sourcePostId? |
| purchased | orderId, storeId, items[1..200] of {productId, quantity, unitPrice (Money)}, sourcePostId? |
| searched | queryHash (id — hash of normalised query, never raw text), resultCount, clickedItemId?, clickedItemType? |
| ad_impression | adId, campaignId, advertiserId, auctionId, placement, hostContentId?, hostCreatorId?, charge? (Money, the accrued CPM charge if you bill per impression) |
| ad_click | adId, campaignId, auctionId, charge? (Money, CPC charge) |
| ad_conversion | adId, campaignId, orderId, value (Money) |
| reported | targetId, targetType, targetAuthorId?, reasonCode (`spam` \| `scam` \| `nudity` \| `violence` \| `hate` \| `counterfeit` \| `harassment` \| `other`) |
| hidden | targetId, targetType, targetAuthorId?, topics? |
| risk_outcome_labeled | subjectType (risk subject types, see 7.10), subjectId, outcome (`fraud_confirmed` \| `fraud_cleared`) — the training label for risk models; send when a case is resolved |
| coin_transferred | transferId, recipientId, coinAmount (≥1) |
| gift_sent | giftId, creatorId, coinAmount (≥1), hostContentId? |
| saved | targetId, targetType (`post` \| `clip` \| `product`), authorId?, +topics |

`targetType`: `post` \| `clip` \| `story` \| `live` \| `product` \| `store` \| `account` \| `comment` \| `ad`.
`placement` (ad events): `feed` \| `clips` \| `mart` \| `search` \| `stories` \| `live` \| `live_discovery`.

Forward "shown" events (post_viewed, clip_watched, ad_impression) for every item actually displayed —
shown ≠ clicked ≠ liked, and training depends on all three. Events are stored append-only as Parquet
partitioned by `event_type` and `event_date` and update online features in Redis (affinities, item
statistics, seen sets, ad frequency/spend, trending, value-flow graph, experiment counters).

## 7. Ranking and decision endpoints

Where a request has `requestId`, the response `metadata.requestId` echoes it (otherwise one is generated).
Echo it in events as `context.rankingRequestId` (for ads it is the `auctionId`).

### 7.1 POST /v1/feed/rank

The API generates candidates (≤500) from its database; Python scores, filters and orders them.

```json
{
  "requestId": "feedreq_123",
  "feedMode": "for_you",
  "viewer": {"userId": "u_9f2c", "country": "NG", "chosenTopics": ["fashion"], "followedAccountIds": ["u_a1"]},
  "candidates": [{
    "itemId": "p_1", "authorId": "u_a1", "storeId": null, "contentKind": "personal", "mediaKind": "image",
    "mediaCount": 3, "createdAt": "2026-09-29T08:00:00Z", "topics": ["fashion"], "hashtags": ["ankara"],
    "likeCount": 120, "commentCount": 8, "shareCount": 3, "viewCount": 900, "authorFollowerCount": 5400,
    "authorIsVerified": false, "country": "NG", "isSensitive": false, "isReported": false, "productPrice": null,
    "friendEngagements": [{"friendId": "u_f1", "action": "liked", "closeness": 0.8}]
  }],
  "limit": 30,
  "options": {"maxConsecutiveSameAuthor": 1, "maxConsecutiveProductPosts": 2, "maximumProductPostShare": 0.4,
              "topicRepeatPenalty": 0.85, "topicWindowSize": 3, "includeSocialProof": true,
              "socialProofMinimumCloseFriends": 2, "socialProofMinimumGap": 5, "socialProofMinimumCloseness": 0.3},
  "now": "2026-09-29T12:00:00Z"
}
```

| field | type / limits | default |
|---|---|---|
| feedMode | `for_you` \| `following` | for_you |
| candidates[].contentKind | `personal` \| `product` | personal |
| candidates[].mediaKind | `image` \| `video` \| `text` \| `carousel` | image |
| candidates[].mediaCount | 0..10 | 1 |
| candidates[].*Count | int ≥0 | 0 |
| candidates[].productPrice | Money \| null | null |
| candidates[].friendEngagements | ≤50 of {friendId, action `liked`\|`commented`\|`shared`\|`purchased`, closeness 0..1 \| null} | [] |
| limit | 1..100 | 30 |
| options.maxConsecutiveSameAuthor | 1..5 | 1 |
| options.maxConsecutiveProductPosts | 1..10 | 2 |
| options.maximumProductPostShare | 0..1 | 0.4 |
| options.topicRepeatPenalty | (0,1] | 0.85 |
| options.topicWindowSize | 0..10 | 3 |
| options.socialProofMinimumCloseFriends | 1..10 | 2 |
| options.socialProofMinimumGap | 1..50 | 5 |

Response:

```json
{
  "items": [{"itemId": "p_1", "position": 0, "score": 0.1197, "reasons": ["following", "topic_affinity", "fresh"],
             "socialProof": {"friendIds": ["u_f1", "u_f2"], "totalFriendCount": 2, "primaryAction": "liked"}}],
  "excluded": [{"itemId": "p_9", "reason": "already_seen"}],
  "metadata": {"requestId": "feedreq_123", "rankingSource": "for_you:model", "modelVersion": "...", "degraded": false, "generatedAt": "..."}
}
```

Behaviour: For You score = engagement blend (like 1, comment 2, share 3, long dwell 0.8, purchase
intent 4) × freshness (half-life 36 h, floor 0.08) × (1 + 0.5·creator affinity) × 0.3 if `isReported`;
then greedy diversity re-rank; already-seen items are excluded. Following = `createdAt` boosted by at most
90 minutes for high affinity/engagement, seen items moved to the end, max 2 consecutive per author.
`reasons` ⊂ {following, creator_affinity, topic_affinity, chosen_topic, friends_engaged, fresh, popular, local}.
Return size ≤ `limit`. The API must still drop anything no longer eligible.

### 7.2 POST /v1/clips/rank

Called by social for the Clips For You tab (`intelligenceClipRanker.integration.ts`). The pinned request
social sends is `tests/modules/clips/fixtures/social_clip_rank_request.json`.

```json
{"viewer": {"userId": "u_9f2c", "country": "NG", "followedAccountIds": ["u_c1"]}, "limit": 20,
 "explorationShare": 0.2, "personalized": true, "trendingTopics": ["dance"],
 "boostPolicy": {"version": 3, "tierBoosts": {"blue_verified": 1.04}, "officialEditorialBoost": 1.1},
 "candidates": [{"itemId": "c_1", "creatorId": "u_c1", "createdAt": "2026-09-28T10:00:00Z", "durationMs": 21000,
   "topics": ["comedy"], "hashtags": [], "viewCount": 5000, "completionCount": 1900, "rewatchCount": 300,
   "likeCount": 40, "commentCount": 3, "shareCount": 2, "saveCount": 1, "authorTier": "blue_verified",
   "authorIsOfficial": false, "isPromoted": false, "integrity": {"engagerCount": 40, "clusteredEngagerShare": 0.1},
   "creatorFollowerCount": 800, "creatorIsNew": false, "country": "NG", "isSensitive": false, "ageRestricted": false}]}
```

`limit` 1..100 (default 20); `explorationShare` 0..1 (default 0.2 => every 5th slot, positions 4, 9, 14, …).
Unknown fields are rejected (422).

Score = P(completion) x (1 + 0.5 P(rewatch)) x freshness (72 h half-life, floor 0.15) x (1 + 0.3 creator affinity)
x (1 + 0.25 engagement) x integrity x capped boost. P(completion) and P(rewatch) come from the `clip_watch` model
or the heuristic heads, fed by the candidate counts and the online `clip_watched` statistics (`watches`,
`completions`, `rewatches`, `watch_fraction_sum`), so watches recorded after social built its counts still count.
Engagement = (likes + 2 saves + 3 comments + 4 shares) / views, saturating at 0.2, so likes break ties but never
beat a clearly better completion rate. Integrity uses the feed's assessment: counts are discounted by the trusted
share and the score is multiplied by 0.3 + 0.7 x trusted share; manipulated clips never get exploration slots.
Boosts are clamped to the hard caps (Black 15%, Gold 12%, Premium 10%, Blue 8%, Blue Essential 5%, Official 15%,
25% combined) and disclosed in `explanations`. Sensitive or age-restricted clips are dropped unless the viewer's
`ageBracket` is adult. `personalized: false` (guests, no consent) skips follows, chosen topics, affinities and
seen items and is not written to the feature log; `metadata.rankingSource` ends in `:non_personalized`.

Response `items[]`: `{itemId, position, score, isExploration, reasons, explanations, boostMultiplier,
trustedEngagementShare}`, plus `excluded`, `manipulatedItemIds`, `boostPolicyVersion` and `metadata`.
Exploration slots go to new creators / clips with <50 watches chosen by Thompson sampling
(Beta(1+completions, 1+non-completions)), seeded by userId+requestId so a retried request returns the
same order. No duplicates, no two consecutive clips from one creator.

### 7.3 POST /v1/social-proof/select

Standalone version of the banner decision (the feed endpoint already includes it).

```json
{"viewer": {"userId": "u_9f2c", "followedAccountIds": ["u_a1"]},
 "orderedItems": [{"itemId": "p_1", "authorId": "u_a1", "storeId": null,
   "friendEngagements": [{"friendId": "u_f1", "action": "liked", "closeness": 0.9}, {"friendId": "u_f2", "action": "shared"}]}],
 "options": {"socialProofMinimumCloseFriends": 2, "socialProofMinimumGap": 5, "socialProofMinimumCloseness": 0.3}}
```

`orderedItems` ≤500 in display order. `options` is the same object as in 7.1 (only the socialProof* fields matter).
Response: `{"selections": [{"itemId": "p_1", "position": 0, "banner": {"friendIds": ["u_f1","u_f2"], "totalFriendCount": 2, "primaryAction": "liked"}}], "metadata": {...}}`.
Rules: closeness = max(API closeness, Python's learned affinity); needs ≥ minimum close friends at or
above minimum closeness; value = Σ closeness × action weight × (1.3 if the viewer does not follow the
author else 0.8) ≥ 0.8; banners are at least `socialProofMinimumGap` positions apart (≤1 in 5 posts by
default); blocked/muted friends and the viewer are never shown; at most 3 friend ids returned.

### 7.4 POST /v1/ads/select

The API sends the final organic list plus candidate ads; Python returns winning ads, their positions
and the charge price.

```json
{
  "requestId": "auction_789",
  "placement": "feed",
  "hostContentId": null, "hostCreatorId": null, "hostContentIsSensitive": false, "hostContentIsReported": false,
  "viewer": {"userId": "u_9f2c", "country": "NG", "region": "LA", "ageBracket": "25-34", "chosenTopics": ["fashion"]},
  "organicItems": [{"itemId": "p_1", "isSensitive": false, "isReported": false}],
  "candidates": [{
    "adId": "ad_1", "campaignId": "cmp_1", "advertiserId": "st_1", "status": "active",
    "startsAt": "2026-09-01T00:00:00Z", "endsAt": null, "bidType": "cpc",
    "bid": {"amountMinor": 15000, "currency": "NGN"},
    "dailyBudget": {"amountMinor": 5000000, "currency": "NGN"}, "totalBudget": null,
    "spentToday": {"amountMinor": 120000, "currency": "NGN"}, "spentTotal": {"amountMinor": 900000, "currency": "NGN"},
    "frequencyCapPerDay": 3, "placements": ["feed", "clips"],
    "targeting": {"countries": ["NG"], "regions": [], "topics": ["fashion"], "ageBrackets": ["18-24", "25-34"],
                  "lookalikeStoreId": "st_1", "lookalikeMinimumSimilarity": 0.3},
    "creative": {"mediaType": "video", "aspectRatio": "9:16", "durationMs": 15000, "isLiveNow": false,
                 "productId": null, "liveStreamId": null},
    "brandSafety": "standard", "dayStartUtcOffsetMinutes": 60, "creativeTopics": ["fashion"],
    "lifetimeImpressions": 12000, "lifetimeClicks": 140
  }],
  "exchangeRates": [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}],
  "reservePricePerMille": {"amountMinor": 20000, "currency": "NGN"},
  "adLoad": {"firstAdAfterOrganicItems": null, "organicItemsBetweenAds": null, "maximumAds": 5, "gridColumns": 2},
  "viewerImpressionsTodayByCampaign": {"cmp_1": 1},
  "now": "2026-09-29T12:00:00Z"
}
```

| field | limits / default |
|---|---|
| placement | `feed` \| `clips` \| `mart` \| `search` \| `stories` \| `live` \| `live_discovery` (see placement table) |
| organicItems | ≤200 in display order |
| candidates | ≤300 |
| candidates[].status | `active` \| `paused` \| `ended` \| `pending_review` \| `rejected` (only active can win) |
| candidates[].bidType | `cpc` (bid per click) \| `cpm` (bid per 1000 impressions) |
| candidates[].frequencyCapPerDay | 1..50, default 3 |
| candidates[].placements | 1..7 placements |
| candidates[].creative | required: `mediaType` (`image` \| `video` \| `carousel` \| `live_stream` \| `product_tile`), `aspectRatio` (`1:1` \| `4:5` \| `9:16` \| `16:9`), `durationMs` (video), `isLiveNow` (live_stream), `productId` (required for product_tile), `liveStreamId` |
| candidates[].brandSafety | `strict` \| `standard` (default) |
| candidates[].dayStartUtcOffsetMinutes | -720..840, default 60 (WAT) — budget day boundary |
| exchangeRates | 1..50, required |
| adLoad.firstAdAfterOrganicItems | optional 0..50; can only make the placement rule stricter |
| adLoad.organicItemsBetweenAds | optional 1..50; can only make the placement rule stricter |
| adLoad.maximumAds | 0..20, default 5 |
| adLoad.gridColumns | 1..6, default 2 — row width for `mart`/`search` grids (first row never gets an ad) |

Response:

```json
{
  "placements": [{
    "adId": "ad_1", "campaignId": "cmp_1", "advertiserId": "st_1", "placement": "feed",
    "position": 3, "insertAfterItemId": "p_3", "hostContentId": null, "hostCreatorId": null,
    "chargeModel": "cpc", "chargePrice": {"amountMinor": 9120, "currency": "NGN"}, "creativeMediaType": "video",
    "predictedClickRate": 0.0143, "auctionId": "auction_789"
  }],
  "rejected": [{"adId": "ad_2", "reason": "frequency_capped"}],
  "metadata": {"requestId": "auction_789", "rankingSource": "ads:model", "modelVersion": "...", "degraded": false, "generatedAt": "..."}
}
```

`position` is the index in the merged (organic + ads) list; `insertAfterItemId` is the organic item
directly before the ad (`null` for in-content slots).

Semantics:

- **Money is never mixed.** `bid`, `dailyBudget`, `totalBudget`, `spentToday`, `spentTotal` of one ad
  must share a currency (else `currency_mismatch`). Bids are compared across ads in USD micro-units
  using `exchangeRates`; an ad whose currency has no rate is rejected (`missing_exchange_rate`).
  `chargePrice` is always in the ad's own bid currency, rounded up to a whole minor unit and never above the bid.
- **Eligibility** (rejection reasons): `not_active`, `placement_not_targeted`, `outside_schedule`,
  `advertiser_blocked_by_viewer`, `currency_mismatch`, `missing_exchange_rate`, `zero_bid`,
  `budget_exhausted`, `frequency_capped`, `geo_mismatch`, `age_mismatch`, `interest_mismatch`
  (targeting.topics must intersect chosenTopics ∪ learned interests), `lookalike_audience_unavailable`,
  `lookalike_mismatch` ("people like my customers": cosine between the viewer's topic affinity and the
  store's customer topic centroid), `paced_out`, `duplicate_candidate`.
- **Auction**: generalized second price with quality. pCTR comes from the ad click model (or a smoothed
  historical CTR prior). eCPM = bid × pCTR × 1000 for CPC, bid for CPM. Ranked by eCPM, one ad per
  advertiser (`advertiser_already_competing`), below `reservePricePerMille` => `below_reserve`, losers
  beyond the slot count => `outbid`. Each winner pays the next ad's eCPM (or the reserve) + 1 minor unit,
  converted back: CPC price = nextECPM / (pCTR × 1000), CPM price = nextECPM; minimum 1 minor unit, max = bid.
- **chargePrice**: CPC => charge `chargePrice` once per valid click. CPM => `chargePrice` is per 1000
  impressions: accrue `chargePrice / 1000` per impression in micro-units and settle the aggregate (do not
  round every impression up to a whole minor unit).
- **Budget and pacing**: an ad is excluded unless its maximum single charge (bid for CPC, ceil(bid/1000)
  for CPM) fits in both the remaining daily and total budget, using max(API spend, spend Python learned
  from ad events). A probabilistic throttle smooths daily spend: participation probability drops from 1 to 0
  as spend runs more than 2% ahead of the linear day-progress target (fully off at ~7% ahead). These
  checks are **advisory**: the API must still debit budgets atomically and refuse a charge that would
  overspend.
- **Frequency caps**: per campaign per user per UTC day, max(`viewerImpressionsTodayByCampaign`, Python's own count).
- **Placements, formats and ad load** (organic items = posts, clips, stories, product tiles or live
  cards, in display order; values the API sends in `adLoad` are clamped so they can only be stricter):

  | placement | what it is | allowed creatives | aspect ratios | first ad after ≥ organic | organic between ads (≈ max 1 ad per N) |
  |---|---|---|---|---|---|
  | `feed` | home feed; live cards allowed | image, video (≤60 s), carousel, live_stream | any | 3 (min 2 — never above the first 2 posts) | 6 (1 per 7) |
  | `clips` | reels, promoted clips incl. landscape | video (≤60 s), live_stream | 9:16, 16:9 | 2 | 4 (max 1 per 5 clips) |
  | `stories` | story tray | image, video (≤15 s) | 9:16 | 2 | 4 (1 per 5) |
  | `mart` | Mart grids, category pages, "Featured with" — sponsored product tiles labelled "Ad" | product_tile | 1:1, 4:5 | `gridColumns` (never in the first row) | 5 (max 1 per 6 tiles) |
  | `search` | sponsored search results / product grid | product_tile, image | 1:1, 4:5 | `gridColumns` | 5 (1 per 6) |
  | `live_discovery` | live discovery grid, promoted live streams | live_stream (`isLiveNow` must be true) | 9:16, 16:9 | 1 | 7 (max 1 per 8) |
  | `live` | inside a live stream (in-content) | image, video (≤30 s), product_tile | any | single slot at position 0; requires `hostContentId` | — |

  Never two ads adjacent, never after the last organic item. Format rejections:
  `creative_media_type_not_allowed`, `creative_aspect_ratio_not_allowed`, `creative_video_too_long`,
  `live_stream_not_live`, `product_tile_missing_product`; `live` without a host =>
  `in_content_placement_requires_host_content`. Promoted clips/live cards inside `feed` or `clips` are
  selected with those placements and a `video`/`live_stream` creative. Render marketplace/search
  winners with a visible "Ad" label.
- **Brand safety**: no ad directly next to an organic item with `isSensitive` or `isReported` (the slot moves
  later); `strict` ads also need the two neighbours on each side clean. If `hostContentId` is given and
  the host is sensitive or reported, no ads are returned (`host_content_not_brand_safe`). A winner that
  fits no safe slot is rejected with `no_brand_safe_slot`.
- **In-content placements** (`live`, or any placement with a `hostContentId` and an empty
  `organicItems`, e.g. a clip mid-roll): send `hostContentId` + `hostCreatorId`; one slot at position 0 is offered.
- **Creator revenue share**: every placement echoes `placement`, `hostContentId` and `hostCreatorId`
  (null for in-feed interstitials unless the API supplied a host). The TS ledger uses them to credit the
  creator 40% of the revenue from ads served on/within their content. Python never moves money.

### 7.5 POST /v1/recommendations/products

```json
{"requestId": "rec_1", "surface": "similar", "viewer": {"userId": "u_9f2c", "country": "NG"},
 "anchorProduct": {"productId": "pr_1", "storeId": "st_1", "categoryId": "cat_shoes", "topics": ["fashion"],
                   "price": {"amountMinor": 2500000, "currency": "NGN"}},
 "candidates": [{"productId": "pr_2", "storeId": "st_2", "categoryId": "cat_shoes", "topics": ["fashion"],
                 "price": {"amountMinor": 2800000, "currency": "NGN"}, "rating": 4.6, "salesCount": 40,
                 "viewCount": 900, "country": "NG", "inStock": true}],
 "excludedProductIds": [], "limit": 20}
```

`surface`: `similar` \| `bought_together` \| `featured_with` \| `mart_home`. `candidates` optional (≤500):
- with candidates: Python scores them (model similarity to the anchor, attribute similarity, personal
  store/topic affinity, popularity — weights per surface) and diversifies (≤2 consecutive per store).
  Out-of-stock, excluded, hidden and blocked-store products are dropped. For `featured_with`, send the
  products co-featured in the same posts as candidates.
- without candidates: returns precomputed neighbours of the anchor from the item-similarity model, or
  popular products. **These ids were not pre-validated — the API must filter them.**

Response (`RecommendationResponse`, shared by all recommendation endpoints):

```json
{"items": [{"itemId": "pr_2", "score": 0.53, "reason": "similar"}], "metadata": {"rankingSource": "products:similar:model", ...}}
```

### 7.6 POST /v1/recommendations/accounts

People and stores to follow.

```json
{"viewer": {"userId": "u_9f2c", "chosenTopics": ["food"], "followedAccountIds": []},
 "candidates": [{"accountId": "st_5", "kind": "store", "mutualFollowCount": 3, "followerCount": 1200,
                 "topics": ["food"], "country": "NG", "isVerified": true}], "limit": 20}
```

Followed, blocked, muted and the viewer themself are excluded. `reason` ∈ {mutual_follows,
shared_interests, you_engaged, popular, verified, nearby}.

### 7.7 POST /v1/recommendations/clips

`{"viewer": {...}, "candidates": [ClipCandidate...] (optional), "limit": 20}`. With candidates it runs the
clip ranker (reason `predicted_watch` / `exploration`); without, it returns popular clips in the viewer's
chosen and learned topics (reason `topic:<slug>`), excluding `seenItemIds`/`hiddenItemIds`. Validate ids.

### 7.8 POST /v1/trending

```json
{"kind": "hashtag", "country": "NG", "limit": 20, "minimumDistinctActors": 5, "excludedIds": []}
```

`kind`: `hashtag` \| `topic` \| `post` \| `clip` \| `product`. `country` null => global.
Response: `{"kind": "hashtag", "scope": "NG", "items": [{"itemId": "ankara", "score": 12.4, "acceleration": 3.1, "distinctActors": 57}], "metadata": {...}}`.
Score = short-horizon (6 h half-life) weight × √min(acceleration, 10) × ln(1+distinct actors) × spam
penalty; acceleration compares the 6 h window with the 7 d baseline. One contribution per actor per item
per hour; items below `minimumDistinctActors` (today or yesterday) never trend; reported/hidden items are
penalised. Moderate the returned hashtags/items before display.

### 7.9 POST /v1/search/rerank

```json
{"viewer": {"userId": "u_9f2c"}, "limit": 30,
 "candidates": [{"itemId": "pr_1", "itemType": "product", "textRelevanceScore": 12.7, "authorId": "st_1",
                 "topics": ["fashion"], "popularityCount": 300, "createdAt": "2026-09-20T00:00:00Z", "country": "NG"}],
 "textRelevanceWeight": 0.7, "personalizationWeight": 0.2, "popularityWeight": 0.1}
```

`itemType`: `post` \| `clip` \| `product` \| `store` \| `account` \| `hashtag`; `textRelevanceScore` 0..1e6
(any engine scale; normalised by the max in the request); `limit` 1..200. Score = weights × (normalised
text relevance, personalisation, log popularity) + 0.02 × freshness. Blocked/muted authors are dropped.
Response: `{"items": [{"itemId": "pr_1", "position": 0, "score": 0.91}], "metadata": {...}}`.

### 7.10 POST /v1/risk/score

Fraud/risk scoring. Returns a score and reasons; **the API decides**. Python never bans, freezes or
reverses anything.

Request: `subjectType`, `subjectId`, `actorId`, `exchangeRates` (≤50, needed for USD thresholds), `now`,
and **exactly one** signals block whose name equals `subjectType` (camelCase), otherwise 422.

| subjectType | block | fields |
|---|---|---|
| order | `order` | amount (Money), accountAgeHours, buyerPreviousOrderCount, buyerMedianOrderAmount?, ordersLastHour, failedPaymentAttemptsLastDay, shippingCountry?, accountCountry?, deviceAccountCount (default 1), isNewPaymentInstrument, buyerAndSellerShareDevice, sellerAccountAgeHours (default 10000), sellerDisputeRate |
| payout | `payout` | amount, lifetimeEarnings (Money), sellerAccountAgeHours, hoursSincePayoutDestinationChanged?, refundRate, disputeRate, payoutsLastDay, payoutDestinationCountry?, sellerCountry?, isIdentityVerified |
| account_event | `accountEvent` | eventKind (`signup` \| `login` \| `password_change` \| `email_change` \| `payout_destination_change`), isNewDevice, isNewCountry, failedOtpAttemptsLastHour, deviceAccountCount, hoursSinceLastCredentialChange?, signupsOnDeviceLastDay, usesAnonymizingNetwork |
| coin_purchase | `coinPurchase` | amount (Money), coinAmount, accountAgeHours, purchasesLastDay, failedPaymentAttemptsLastDay, isNewPaymentInstrument, deviceAccountCount, paymentCountry?, accountCountry? |
| coin_transfer | `coinTransfer` | recipientId, coinAmount, fractionOfSenderBalance, senderAccountAgeHours, recipientAccountAgeHours, senderAndRecipientShareDevice, senderTransfersLastHour, senderDistinctRecipientsLastDay, minutesSinceSenderReceivedTheseCoins?, observedTransferChainDepthLastDay, coinsBoughtWithNewInstrumentLastDay |
| gift | `gift` | creatorId, coinAmount, senderAccountAgeHours, creatorAccountAgeHours, senderAndCreatorShareDevice, giftsFromSenderToCreatorLastDay, senderShareOfCreatorGiftIncomeLastWeek, coinsBoughtWithNewInstrumentLastDay, hoursUntilCreatorPayoutRequest? |

Context for the value-transfer subjects: coin transfers carry a 25% platform fee and gifts pay creators up
to 70%, which makes them attractive for laundering between colluding accounts. For `coin_transfer`
and `gift` Python adds graph signals learned from `coin_transferred` and `gift_sent` events (reciprocal
flows / gift reciprocity, collection points with many senders), so forward those events. Referral and
cashback scoring was removed with the loyalty programme.

```json
{"subjectType": "coin_transfer", "subjectId": "tr_1", "actorId": "u_9f2c",
 "coinTransfer": {"recipientId": "u_77", "coinAmount": 5000, "fractionOfSenderBalance": 0.95,
   "senderAccountAgeHours": 30, "recipientAccountAgeHours": 20, "senderAndRecipientShareDevice": true,
   "minutesSinceSenderReceivedTheseCoins": 4, "observedTransferChainDepthLastDay": 3}}
```

Response:

```json
{"subjectType": "coin_transfer", "subjectId": "tr_1", "score": 0.91, "level": "high",
 "recommendedAction": "hold_for_manual_review", "ruleScore": 0.91, "modelScore": null,
 "reasons": [{"code": "sender_and_recipient_share_device", "weight": 0.45}, {"code": "long_transfer_chain", "weight": 0.35}],
 "metadata": {"rankingSource": "risk:rules", "degraded": false, ...}}
```

Score = noisy-OR of triggered rule weights; for orders a trained logistic model is blended in
(`max(rule, 0.5·rule + 0.5·model)`). Levels: `low` (<0.3) => `allow`, `medium` (<0.7) => `review`,
`high` => `hold_for_manual_review`. Reason codes are stable machine strings (e.g.
`new_account_high_value`, `buyer_and_seller_share_device`, `payout_destination_changed_last_day`,
`otp_bruteforce`, `signup_farm`, `reciprocal_transfer_ring`, `rapid_forwarding_of_received_coins`,
`gift_reciprocity_laundering`, `exchange_rate_unavailable` with weight 0). Send `risk_outcome_labeled` events when cases resolve.

### 7.11 POST /v1/experiments/assign

```json
{"userId": "u_9f2c", "recordExposure": true,
 "experiments": [{"key": "feed_blend_v2", "salt": "", "trafficAllocation": 1.0,
                  "variants": [{"name": "control", "weight": 50}, {"name": "treatment", "weight": 50}]}]}
```

Keys and variant names `^[a-z0-9_\-]{1,64}$`; ≤20 experiments, ≤10 variants, weights 0..10000.
Response: `{"assignments": [{"key": "feed_blend_v2", "variant": "treatment", "bucket": 4821}]}` (`variant` null = not in the experiment).
`recordExposure` counts an exposure and the distinct user for that variant.

Deterministic algorithm (reproduce it in TS for the fallback):

```
h(text) = first 8 bytes of sha256(utf8(text)) as unsigned big-endian integer
allocationBucket = h(`${key}:${salt}:allocation:${userId}`) % 10000
if allocationBucket >= trafficAllocation * 10000 or totalWeight == 0: variant = null
else: v = h(`${key}:${salt}:variant:${userId}`) % totalWeight
      walk variants in order accumulating weight; first with v < cumulative wins
bucket = allocationBucket
```

### 7.12 GET /v1/experiments/{key}/metrics?variants=control,treatment

Signed (sign the path including `?variants=...`). `variants`: 1–10 comma-separated names.
Response: `{"key": "feed_blend_v2", "variants": [{"name": "control", "distinctUsers": 1200, "eventCounts": {"exposures": 3000, "post_liked": 900}, "eventsPerUser": {"exposures": 2.5, "post_liked": 0.75}}]}`.
Counts come from assignment exposures and from events carrying `context.experimentAssignments`. 503 if Redis is down.

### 7.13 Audio fingerprinting (sounds and copyright)

Shazam-style landmark fingerprints let the API detect re-uploads of existing sounds, credit the
original, and hold copyright-flagged audio for review. Python stores only landmark hashes (in Redis);
the audio excerpt itself is never stored or logged.

**Input.** The TS media worker decodes the upload with ffmpeg to mono, 8 kHz, signed 16-bit
little-endian PCM, 3–30 seconds, base64-encoded:

```bash
ffmpeg -v error -i input.mp4 -t 30 -ac 1 -ar 8000 -f s16le - | base64 -w0
```

`audio` object (`PcmAudioExcerpt`):

| field | value |
|---|---|
| encoding | `"s16le"` (only value, default) |
| sampleRateHz | `8000` (only value, default) |
| channels | `1` (only value, default) |
| dataBase64 | standard base64 of raw PCM; whole 16-bit samples; 3–30 s (48 000–480 000 bytes decoded) |

Invalid base64, odd byte counts or out-of-range durations => 422 `invalid_request`. Audio that is
silent or too short after analysis => 422 `audio_unusable_for_fingerprinting`. Fingerprint store down
=> 503 `fingerprint_store_unavailable`. Client timeout: **3 s** (server deadline 3 s). The body limit is
1 MiB, which a 30 s excerpt (~640 KB base64) fits.

#### POST /v1/audio/fingerprints — register a sound

```json
{"soundId": "snd_123", "excerptStartSeconds": 0, "registeredAt": "2026-09-29T12:00:00Z",
 "isVerifiedOriginal": false, "audio": {"dataBase64": "AAABAP7/..."}}
```

| field | notes |
|---|---|
| soundId | id of the sound in the API |
| excerptStartSeconds | 0..3600, default 0 — where the excerpt starts in the full sound (matched positions are reported relative to the full sound) |
| registeredAt | upload time; earlier registrations own a sound |
| isVerifiedOriginal | default false; set true for verified originals (label/creator-verified) |

Response:

```json
{"soundId": "snd_123", "landmarkCount": 812, "durationSeconds": 30.0,
 "matchesBeforeRegistration": { <AudioMatchResponse, computed before this sound was indexed> }}
```

`matchesBeforeRegistration` shows whether the upload duplicates an already registered sound (minimum
confidence 0.05, up to 10 matches, excluding itself). Long sounds are registered as several excerpts
(≤30 s each) under the same soundId with different `excerptStartSeconds` (e.g. 0, 30, 60 …); ownership
fields (`registeredAt`, `isVerifiedOriginal`) are taken from the first excerpt and later excerpts only
add landmarks. 409 `sound_already_registered` if the same soundId + whole-second `excerptStartSeconds`
was already indexed (safe to treat as success when retrying).

#### POST /v1/audio/match — find which registered sounds an excerpt contains

```json
{"audio": {"dataBase64": "..."}, "excludedSoundIds": ["snd_999"], "minimumConfidence": 0.05, "limit": 5}
```

`excludedSoundIds` ≤100; `minimumConfidence` 0..1 (default 0.05); `limit` 1..20 (default 5).
A match also needs at least 8 time-aligned landmarks.

```json
{
  "matches": [{"soundId": "snd_001", "confidence": 0.61, "alignedLandmarkCount": 402,
               "matchedPositionSeconds": 12.288, "registeredAt": "2026-08-01T09:00:00Z",
               "isVerifiedOriginal": true, "isFlaggedCopyright": false}],
  "queryLandmarkCount": 655,
  "earliestVerifiedSoundId": "snd_001",
  "anyFlaggedMatch": false,
  "algorithmVersion": 1
}
```

`confidence` = aligned landmarks / query landmarks (0..1). `matchedPositionSeconds` = where in the
registered sound the excerpt starts. `earliestVerifiedSoundId` = the verified original with the earliest
`registeredAt` among the matches. Store `algorithmVersion`; a version change means sounds must be
re-registered.

#### POST /v1/audio/sounds/status — update ownership / copyright flags

```json
{"soundId": "snd_001", "isVerifiedOriginal": true, "isFlaggedCopyright": null}
```

Null fields are left unchanged. Response `{"soundId": "snd_001", "isVerifiedOriginal": true, "isFlaggedCopyright": false}`.
404 `sound_not_registered` if the soundId was never fingerprinted.

**Decision rules (the API decides; these are recommendations):**

- `confidence ≥ 0.25` or `alignedLandmarkCount ≥ 40` => treat as the same audio; `0.05–0.25` => queue for human review.
- Ownership: the earliest verified registration keeps ownership (`earliestVerifiedSoundId`); a new
  upload reusing it should link to and credit that original sound rather than become a new "original".
- `anyFlaggedMatch` / a match with `isFlaggedCopyright = true` => flag or hold the new upload for review.
- Fallback when Python is down or times out: accept the upload, queue the fingerprint/match job for retry
  with backoff. Never block publishing solely on this check; the copyright review happens afterwards.

## 7b. Safety, trust and consent scoring (B7)

Python returns scores and suggestions only. Go/TS services make every decision and keep a deterministic
fallback; none of these calls may sit in the critical path of a payment (use the timeout and fall back).

| endpoint | client timeout | fallback |
|---|---|---|
| POST /v1/chat/spam-score | 60 ms | no throttle; the caller's own rate limits |
| POST /v1/moderation/classify | 150 ms | existing keyword/report rules, queue for review |
| POST /v1/risk/score-extended | 120 ms | the service's conservative rules; unknown => `review` |
| POST /v1/creators/real-followers | 500 ms | use raw follower count with the manual-review gate |
| POST /v1/ads/predicted-ctr | 80 ms | smoothed historical CTR from the ads store |
| POST /v1/verification/eligibility | 2 s | queue the request (`request` tier) and recheck on schedule |

### POST /v1/chat/spam-score

Sender behaviour metadata only. The contract rejects unknown fields (422), so `text`, `body` or any message content can never be sent.
`behaviour` fields (all optional): `accountAgeHours`, `messagesLastHour`, `messagesLastDay`, `newRecipientsLastHour` (new-recipient fan-out),
`distinctRecipientsLastDay`, `recipientReplyRate`, `blockRate`, `reportRate`, `linksSentLastDay`, `reportedLinksCount`, `deviceAccountCount`, `ipAccountCount`.
`useStoredBehaviour` (default true) merges counters built from `message.sent` metadata events (max of supplied and stored values).
Response: `{senderId, score, level, recommendedAction: allow|throttle|review, reasons[{code,weight}], suspensionSuggested, metadata}`.

### POST /v1/moderation/classify

`{contentId, contentType: post|comment|clip_caption|bio|product_listing|store_description, text (1..5000), authorId?}`.
This endpoint intentionally receives public post text (an explicit exception to the no-free-text rule), and only for public content, never chat or private messages.
Categories: `scam, spam, harassment, violence, prohibited_goods, personal_data`. Text heuristics run first (regex signals, Luhn card check,
noisy-OR); a registered `ModerationModel` (`version`, `classify(text, contentType)`) can only raise a category score, and a model failure
degrades to heuristics (`metadata.degraded`). Response: `{contentId, categories[{category,score,signals}], topCategory, score, suggestedAction: allow|review|block, classifierSources, metadata}`.
`block` is a suggestion; thresholds are 0.5 review, 0.85 block.

### POST /v1/risk/score-extended

Subjects not covered by `/v1/risk/score`: `account, payment, ad_click, refund, marketplace`. Exactly one signals block matching
`subjectType` (`account`, `payment`, `adClick`, `refund`, `marketplace`), camelCase fields as in
`src/modules/extended_risk/dtos/extended_risk_dto.py`. Response: `{subjectType, subjectId, score, level, recommendedAction, reasons, suspensionSuggested, metadata}`.

### Suspension suggestions (goTrust advisory queue)

When an `account`, `ad_click` or `marketplace` risk score, or a chat spam score, is >= 0.8, Python publishes one message per
account, source and UTC day as a persistent RabbitMQ job (exchange `nantty.jobs`, routing key `INTELLIGENCE_TRUST_ADVISORY_QUEUE`, default `intelligence-trust-advisory`; `EVENT_BUS=sqs` keeps `INTELLIGENCE_TRUST_ADVISORY_QUEUE_URL`):
`{suggestionId, subjectType:"account", subjectId, source, score, evidence:[{code,weight}], advisoryOnly:true, generatedAt}`, `message_id = suggestionId`, `type = suspension.suggested`.
It never suspends anything; goTrust opens an advisory case. Publish failures are logged and never fail the scoring call.

### POST /v1/creators/real-followers

`{creatorId, followers[<=5000]: {followerId, accountAgeDays, hasProfilePhoto, postCount, activeDaysLast30, followedAccountCount, deviceClusterSize, signupBurstSize}, totalFollowerCount?}`.
Per-follower authenticity is a multiplicative rule model. Response: `{creatorId, sampledFollowers, estimatedRealRatio, estimatedRealFollowers, realFollowersLowerBound, suspiciousFollowers, topReasons, metadata}`.
With `totalFollowerCount` the sampled ratio is scaled to the total. Use `realFollowersLowerBound` against the eligibility threshold; the decision stays in Go.

### POST /v1/verification/eligibility

Checkmark trust score for the verification hub (go-identity calls it on page view, on "Request verification" and from the recheck scheduler).
`{profileId, color: blue|gold, accountAgeDays, realFollowers, originalPostsLast60Days, daysSinceLastViolation, fraudScore, riskScore, borderlineContent,
emailVerified, accountRestricted, completedOrders, successRatePercent, hasActiveStoreOrBrandPage, thresholds{minimumAccountAgeDays,
minimumRealFollowers, noViolationsInDays, minimumCompletedOrders, minimumSuccessRatePercent}}` (thresholds are the admin-editable checkmark rules).
Response: `{profileId, trustScore 0-100, tier: buy_now|request|blocked, reasons[], recheckAfterHours, scoringSource}`. `buy_now` needs a score of 75+
and every hard threshold met; restricted accounts or fraud >= 80 / risk >= 85 are `blocked`. Go decides; when this endpoint is down Go falls back to
`request` (never `buy_now`) and asks again later.

### POST /v1/ads/predicted-ctr

`{placement, viewer, candidates[<=300 AdCandidate]}` => `{predictions[{adId, predictedClickRate}], personalized, metadata}`. Uses the same features and `ad_click`
model (or heuristic) as `/v1/ads/select`; `personalized:false` when the viewer opted out or the store is unavailable.

### POST /v1/help/answer-drafts

Called by `services/typescript/support` when a resolved ticket becomes a Help Centre topic (plans.md §44). The caller scrubs personal data first and never calls when anything suspicious remains; this endpoint redacts emails, links, amounts, long digit runs and @handles again as a safeguard.

Request `{ category: "order"|"payment"|…, locale: "en", subject, question, answer }` (placeholders such as `[order number]` allowed; unknown fields rejected). Response `{ title, summary, question, answerMarkdown, tags[], source: "template", redactedByIntelligence }`. Deterministic template: greetings, sign-offs and filler removed, placeholders turned into generic words, the first real question (or the subject) becomes the title, step sentences become a numbered list, and the body has "The question", "The answer" and "Still need help?" sections. The caller falls back to its own template when this endpoint is slow or down.

### Domain event consumer (RabbitMQ)

`RABBITMQ_URL` (or `INTELLIGENCE_RABBITMQ_URL`; user `intelligence`) starts an aio-pika consumer on `INTELLIGENCE_DOMAIN_EVENTS_QUEUE` (default `intelligence-domain-events`, prefetch `INTELLIGENCE_RABBITMQ_PREFETCH`, default 20) in the app lifespan, with reconnect backoff. `EVENT_BUS=sqs` keeps the old SQS poller (`INTELLIGENCE_DOMAIN_EVENTS_QUEUE_URL`). Bodies may be raw JSON or SNS-wrapped (`{"Message": "..."}`):
Contract events use the published `services/contracts/events/schemas/envelope.v1.json` shape
(`{id, type, source, subject, schemaVersion, occurredAt, data}`, `type` without version suffix) and are normalised internally;
actor = `data.accountId` (gift.sent: `data.sender.userId`, falling back to `subject`). The other events use a flat internal shape
`{eventId, eventType, occurredAt, actorId, country?, payload}`.

| eventType | source | effect |
|---|---|---|
| account.registered (v1) | contract | account age profile |
| account.loggedIn (v1) | contract | login counter |
| consent.granted / consent.withdrawn (v1) | contract | `consentType` personalization or advertising withdrawn => opt-out, purge and read gating; personalization granted => opt back in; other types ignored |
| account.deletionRequested (v1) | contract | stops personalization immediately |
| account.deletionExecuted (v1) | contract | purges all features, tombstone so late events are dropped |
| gift.sent (v1) | contract | value-flow risk graph (giftTransactionId, receiverUserId, totalCoins, liveId) |

Expected from social/commerce/ads; must match their contract schemas once published (names and flat payloads are provisional):
`product.viewed`, `follow.created`, `post.created`, `message.sent`, `report.created`, `block.created`, `ad.impressionRecorded`.

Social engagement (contract envelope `data`, personalization-gated, translated with hashed ids):

| type | data | becomes |
|---|---|---|
| post.liked | postId, authorId, likedBy, topics?, hashtags? | `post_liked` (actor `likedBy`) |
| post.shared | postId, authorId, sharedBy, channel? | `shared` (actor `sharedBy`; unknown channels => `external`, none => `in_app`) |
| comment.created | commentId, postId, authorId (commenter), recipientUserId, target, postAuthorId? | `commented` once per comment (eventId `comment.created:<commentId>`); needs `postAuthorId` or `target: "post"`, otherwise skipped |
| content.saved | accountId, targetType (`post` \| `video` \| `clip` \| `product`), targetId, authorId? | `saved` (`video` => `post`) |
| post.viewed | postId, authorId (or postAuthorId), viewerId (social sends actorId), dwellMs?, position?, isProductPost? | `post_viewed` (impression; seen set + dwell). Hashtags that are not `[a-z0-9_-]` slugs are dropped, not rejected |
| clip.watched | clipId (social sends postId), creatorId (social sends authorId/postAuthorId), viewerId (social sends actorId), watchFraction, loopCount?, durationMs | `clip_watched` |
| product.viewed (go-commerce) | productId, storeId, categoryId?, sourcePostId?, actorId (only when personalized) | `product_viewed` (actor `actorId`); events without `actorId` are acked as `skipped_unattributed` |
| product.purchased (go-commerce, one per order item) | productId, storeId, variantId, quantity, orderGroupId, unitPrice (Money), actorId (only when the buyer allows personalization), sourcePostId? | `purchased` with one item (actor `actorId`); events without `actorId` are acked as `skipped_unattributed` (never attributed, never dead-lettered) |
`message.sent` carries metadata only: `{recipientId, conversationId, containsLink?, linkReported?, deviceId?, ipHash?}`; extra fields reject the event.
Personalization-gated: product.viewed, product.purchased, follow.created, ad.impressionRecorded, report.created affinity. Safety counters (messages, logins, reports, blocks, posts) are kept for abuse scoring.

Idempotent by `eventId` (7 days); a message is acked once processed or a duplicate; malformed (poison) messages are rejected to `intelligence-domain-events.dlq`;
backend failures are republished to the retry queues (30 s, 2 m, 10 m, 30 m) and dead-lettered after the fifth attempt. Opted-out users get no affinity/seen features and
`read_viewer_online_features` / top-topic reads return empty, so feed, clips, search, recommendations, social proof and ads fall back to
popularity/recency/relevance. Safety counters (messages metadata, logins, reports, gifts) are kept for fraud and abuse scoring.
Known limit: counterparties' incoming value-flow sets still list a deleted account's id until their TTL expires.

## 7c. Fair ranking, integrity and headlines (2026-10-04)

`POST /v1/feed/rank` candidates accept `repostCount`, `saveCount`, `completionRate`, `authorTier` (`none`, `blue_essential`, `blue_verified`, `premium`, `gold_business`, `black_official`), `authorIsOfficial`, `authorQualityPrior` (0-1, default 0.5), `integrity` (`engagerCount`, `newAccountEngagerShare`, `lowTrustEngagerShare`, `suspendedEngagerShare`, `clusteredEngagerShare`, `reciprocalPodShare`, `burstRatio`, `purchasedEngagementSuspected`, `spamHashtagCount`), `isPromoted`, `ageRestricted`. The request accepts `boostPolicy` (`version`, `tierBoosts`, `officialEditorialBoost`; always clamped to the hard caps: tiers 1.05/1.08/1.10/1.12/1.15, Official 1.15, combined 1.25, tier order enforced) and `trendingTopics`. Items add `explanations[]` (`code`, `label`, `detail`), `boostMultiplier` and `trustedEngagementShare`; the response adds `manipulatedItemIds` and `boostPolicyVersion`. `authorIsVerified` is ignored for scoring. Non-adult viewers never receive `ageRestricted` or `isSensitive` candidates. Manipulated authors (10+ engagers, >= 50% suspicious) go to the goTrust advisory queue with `source: "engagement_integrity"`.

Event `context` accepts `actorTrust` (`new`, `low`, `normal`) and `actorClusterKey` (an opaque hash of network /24 + device, never a raw IP). At ingestion a second actor from the same cluster on the same item within an hour counts x0.1, low-trust actors x0.25, and an actor's engagements beyond 60 an hour stop counting for trends.

`POST /v1/trending` accepts `category` (`news`, `sports`, `entertainment`, `music`, `tech`, `business`, `fashion`, `gaming`, `comedy`, `religion`, `food`, `politics`, `lifestyle`, `other`); items add `category` and `manipulationShare`; the response adds `manipulatedIds`. Spam hashtags are never returned; politics needs twice the distinct actors.

`POST /v1/trending/headlines` takes `{ country?, category?, posts: [{ postId, authorId, text, hashtags, topics, createdAt, likeCount, commentCount, repostCount, shareCount, viewCount, isSensitive, ageRestricted, isPublic, integrity? }], limit (<= 20), minimumPostsPerStory (3), minimumDistinctAuthors (3), excludedStoryKeys }` and returns `headlines: [{ storyKey, title, summary, category, postIds (<= 10), postCount, authorCount, topHashtags, sourceLabel: "Summarised from posts", generatedBy: "extractive_v1" | "template_v1", updatedAt }]`. Sensitive, age-restricted, non-public and manipulated posts are dropped; politics and religion always use the template title.

`content.sensitivityAdvised` (domain event, exchange `nantty.events`) is published after a processed image scores on a mapped category: `data: { targetType: "post" | "clip", targetId, ownerId, mediaId, scores: [{ label: "nudity" | "graphic_violence" | "dangerous_acts" | "self_harm", score }], confidence, modelVersion, advisoryOnly: true }`. Rekognition needs `INTELLIGENCE_MEDIA_BUCKET` and AWS credentials; otherwise the image model reports no signal and nothing is published.

`INTELLIGENCE_SERVER_WORKERS` runs that many uvicorn worker processes (default 1).

## 8. What the TS API must do

- [ ] Signed HTTP client (section 2) with per-endpoint timeouts (section 4) and a circuit breaker.
- [ ] Deterministic fallback for every endpoint (section 4); the product must work with Python stopped.
- [ ] Generate candidates from the database; send only opaque/hashed ids and the fields listed here — no PII, no raw search text.
- [ ] Re-validate every id Python returns (still exists, visible, not blocked, in stock, ad still active and funded) before rendering.
- [ ] Pass `exchangeRates` whenever money is compared; never mix currencies.
- [ ] Treat ad `chargePrice`, pacing and budget checks as advisory: debit budgets atomically in the ledger, refuse overspend, record `hostCreatorId` to split creator ad revenue (40%).
- [ ] Never move money or ban accounts on Python's word; risk responses are inputs to the API's own decision.
- [ ] Forward events through an outbox: batch ≤500, sign, retry with backoff on 5xx/timeouts with the same `eventId`s, drop individually rejected events after logging.
- [ ] Emit shown events (post_viewed with dwell, clip_watched with watch fraction, ad_impression) for everything displayed, and echo `metadata.requestId` as `context.rankingRequestId` (`auctionId` for ads).
- [ ] Include `topics`/`hashtags` on item events, `country` on envelopes, `experimentAssignments` when relevant.
- [ ] Send `risk_outcome_labeled` when fraud cases resolve, and `coin_transferred` / `gift_sent` for value-flow risk signals.
- [ ] Media worker: decode each uploaded sound/clip audio with ffmpeg to 8 kHz mono s16le (≤30 s), call `/v1/audio/fingerprints` (it returns duplicates found before registration), credit `earliestVerifiedSoundId` on reuse, hold uploads matching `isFlaggedCopyright` sounds for review, sync verification/copyright decisions via `/v1/audio/sounds/status`, retry when Python is unavailable without blocking publishing.
- [ ] Keep the service on an internal network only; share `INTELLIGENCE_SHARED_SECRET` through the secret manager and rotate with the previous-secret mechanism.
