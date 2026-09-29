# Zudomart Intelligence API Contract (v1)

This is the authoritative contract between the TypeScript API (`apps/api`) and the Python
intelligence service (`apps/intelligence`). The Pydantic models in `app/models/*.py` are the source
of truth; this document mirrors them.

Rule: **the TS API owns the product, Python owns intelligence, events connect them.** Python never
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
| `x-zudo-timestamp` | Unix time in seconds (9–11 digits) |
| `x-zudo-nonce` | 16–64 chars, `^[A-Za-z0-9_\-]+$`, unique per request |
| `x-zudo-signature` | `v1=` + lowercase hex HMAC-SHA256 |
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
    "x-zudo-timestamp": timestamp,
    "x-zudo-nonce": nonce,
    "x-zudo-signature": `v1=${signature}`,
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
| POST /v1/feed/rank | 100 ms | For You: `recency × engagement` score (e.g. `(likes+2·comments+3·shares+1)/(ageHours+2)^1.5`), cap 1 consecutive post per author/store, drop blocked/muted/hidden/seen. Following: pure reverse chronological. |
| POST /v1/clips/rank | 100 ms | recency × historical completion rate, no consecutive same creator, drop seen |
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
| referral_rewarded | referralId, refereeId |

`targetType`: `post` \| `clip` \| `story` \| `live` \| `product` \| `store` \| `account` \| `comment` \| `ad`.
`placement`: `feed` \| `clips` \| `mart` \| `search` \| `live` \| `story` \| `post_detail`.

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

```json
{"requestId": "clipreq_1", "viewer": {"userId": "u_9f2c"}, "limit": 20, "explorationShare": 0.2,
 "candidates": [{"itemId": "c_1", "creatorId": "u_c1", "createdAt": "2026-09-28T10:00:00Z", "durationMs": 21000,
   "topics": ["comedy"], "hashtags": [], "viewCount": 5000, "completionCount": 1900, "rewatchCount": 300,
   "creatorFollowerCount": 800, "creatorIsNew": false, "country": "NG", "isSensitive": false}]}
```

`limit` 1..100 (default 20); `explorationShare` 0..1 (default 0.2 => every 5th slot, positions 4, 9, 14, …).
Response `items[]`: `{itemId, position, score, isExploration, reasons}`, plus `excluded` and `metadata`.
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
    "brandSafety": "standard", "dayStartUtcOffsetMinutes": 60, "creativeTopics": ["fashion"],
    "lifetimeImpressions": 12000, "lifetimeClicks": 140
  }],
  "exchangeRates": [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}],
  "reservePricePerMille": {"amountMinor": 20000, "currency": "NGN"},
  "adLoad": {"firstAdAfterOrganicItems": 3, "organicItemsBetweenAds": 6, "maximumAds": 5},
  "viewerImpressionsTodayByCampaign": {"cmp_1": 1},
  "now": "2026-09-29T12:00:00Z"
}
```

| field | limits / default |
|---|---|
| placement | `feed` \| `clips` \| `mart` \| `search` \| `live` \| `story` \| `post_detail` |
| organicItems | ≤200 in display order |
| candidates | ≤300 |
| candidates[].status | `active` \| `paused` \| `ended` \| `pending_review` \| `rejected` (only active can win) |
| candidates[].bidType | `cpc` (bid per click) \| `cpm` (bid per 1000 impressions) |
| candidates[].frequencyCapPerDay | 1..50, default 3 |
| candidates[].placements | 1..7 placements |
| candidates[].brandSafety | `strict` \| `standard` (default) |
| candidates[].dayStartUtcOffsetMinutes | -720..840, default 60 (WAT) — budget day boundary |
| exchangeRates | 1..50, required |
| adLoad.firstAdAfterOrganicItems | 2..50, default 3 |
| adLoad.organicItemsBetweenAds | 6..50, default 6 |
| adLoad.maximumAds | 0..20, default 5 |

Response:

```json
{
  "placements": [{
    "adId": "ad_1", "campaignId": "cmp_1", "advertiserId": "st_1", "placement": "feed",
    "position": 3, "insertAfterItemId": "p_3", "hostContentId": null, "hostCreatorId": null,
    "chargeModel": "cpc", "chargePrice": {"amountMinor": 9120, "currency": "NGN"},
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
- **Ad load**: first ad after at least `firstAdAfterOrganicItems` (never above the first 2 posts), at least
  `organicItemsBetweenAds` organic items between ads, never two ads adjacent, never after the last organic item.
- **Brand safety**: no ad directly next to an organic item with `isSensitive` or `isReported` (the slot moves
  later); `strict` ads also need the two neighbours on each side clean. If `hostContentId` is given and
  the host is sensitive or reported, no ads are returned (`host_content_not_brand_safe`). A winner that
  fits no safe slot is rejected with `no_brand_safe_slot`.
- **In-content placements** (clips mid-roll, live, story, post detail): send `hostContentId` +
  `hostCreatorId` and an empty `organicItems`; one slot at position 0 is offered.
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
| account_event | `accountEvent` | eventKind (`signup` \| `login` \| `password_change` \| `email_change` \| `phone_change` \| `payout_destination_change`), isNewDevice, isNewCountry, failedOtpAttemptsLastHour, deviceAccountCount, hoursSinceLastCredentialChange?, signupsOnDeviceLastDay, usesAnonymizingNetwork |
| coin_purchase | `coinPurchase` | amount (Money), coinAmount, accountAgeHours, purchasesLastDay, failedPaymentAttemptsLastDay, isNewPaymentInstrument, deviceAccountCount, paymentCountry?, accountCountry? |
| coin_transfer | `coinTransfer` | recipientId, coinAmount, fractionOfSenderBalance, senderAccountAgeHours, recipientAccountAgeHours, senderAndRecipientShareDevice, senderTransfersLastHour, senderDistinctRecipientsLastDay, minutesSinceSenderReceivedTheseCoins?, observedTransferChainDepthLastDay, coinsBoughtWithNewInstrumentLastDay |
| gift | `gift` | creatorId, coinAmount, senderAccountAgeHours, creatorAccountAgeHours, senderAndCreatorShareDevice, giftsFromSenderToCreatorLastDay, senderShareOfCreatorGiftIncomeLastWeek, coinsBoughtWithNewInstrumentLastDay, hoursUntilCreatorPayoutRequest? |
| referral_reward | `referralReward` | refereeId, referrerAccountAgeHours, refereeAccountAgeHours, shareDevice, sharePaymentInstrument, shareNetworkPrefix, referralsByReferrerLastDay, minutesFromSignupToQualifyingAction?, linkedAccountClusterSize (≥1) |
| cashback | `cashback` | amount (Money), cashbackOrdersLastWeek, refundAfterCashbackRate, cancelledAfterCashbackCount, buyerAndSellerShareDevice, buyerLinkedToSellerAccount, accountAgeHours |

Context for the value-transfer subjects: coin transfers carry a 25% platform fee and gifts pay creators up
to 70%, which makes them attractive for laundering between colluding accounts. For `coin_transfer`,
`gift` and `referral_reward` Python adds graph signals learned from `coin_transferred`, `gift_sent` and
`referral_rewarded` events (reciprocal flows / gift reciprocity, collection points with many senders,
referral volume), so forward those events.

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
`gift_reciprocity_laundering`, `self_referral_ring`, `buyer_linked_to_seller`, `refunds_after_cashback`,
`exchange_rate_unavailable` with weight 0). Send `risk_outcome_labeled` events when cases resolve.

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
- [ ] Send `risk_outcome_labeled` when fraud cases resolve, and `coin_transferred` / `gift_sent` / `referral_rewarded` for value-flow risk signals.
- [ ] Media worker: decode each uploaded sound/clip audio with ffmpeg to 8 kHz mono s16le (≤30 s), call `/v1/audio/fingerprints` (it returns duplicates found before registration), credit `earliestVerifiedSoundId` on reuse, hold uploads matching `isFlaggedCopyright` sounds for review, sync verification/copyright decisions via `/v1/audio/sounds/status`, retry when Python is unavailable without blocking publishing.
- [ ] Keep the service on an internal network only; share `INTELLIGENCE_SHARED_SECRET` through the secret manager and rotate with the previous-secret mechanism.
