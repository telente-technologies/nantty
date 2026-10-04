# Zudomart — Backend Plan

Status: **draft (3 Oct 2026)**. Nothing here is built unless marked **ref** (logic exists in `apps/api` and can be ported). Items marked **[CONFIRM]** need an owner decision before that piece starts.

Inputs read: `docs/plans.md` (incl. §5.4 contract debt, §8 Studio, §13 checkmarks, §20 creator live), `docs/CHANGELOG.md`, `docs/architecture/microservicesPlan.json`, `SECURITY.md`, `apps/api` (Zudojs reference monolith), `apps/{seller,ads,admin,intelligence}/apiContract.md`, `apps/mobile/src/services` + `src/mocks`, and the BFF layers of `apps/webapp` and `apps/studio`.

---

## 0. Ground rules for the implementation

These apply to every backend file, whether a person or an agent writes it.

- Almost no code comments. Leave a comment only for a non-obvious *why*. No docblocks that restate the code and no banner comments.
- **No backend file is longer than 300 lines** in any language. Split by command, query, handler or repository well before that.
- **TypeScript services use Prisma only.** No hand-written SQL, no `.sql` files and no `$queryRaw`. The one exception is the `migration.sql` that `prisma migrate` generates. The Go, Elixir and Python services follow the same spirit: generated migrations from the service's schema tool, parameterised queries only, no string-built SQL. **[CONFIRM]** the per-language migration tool with the foundation agent (suggested: Atlas for Go, Ecto migrations for Elixir, Alembic for Python).
- TypeScript file naming is `<name>.<kind>.ts`, and multi-word names are camelCase: `verifyOtp.command.ts`, `sendLiveGift.handler.ts`, `liveBattle.prisma.repository.ts`. Folders use the same names (`commands/verifyOtp/`), and barrels stay `index.ts`. Python keeps `snake_case` with a kind suffix (`feed_rank.route.py`), which matches `services/python/intelligence`. Go and Elixir use their idiomatic file names but keep the same long, descriptive identifiers.
- Function names are long and self-explanatory, for example `calculateCartTotalsInKobo`, `settleLiveBattleAndPostLedgerEntries`, `assertViewerCanGiftStreamerOnStage`.
- Every route declares its permission and is denied by default. Every body, query and params object is schema-validated before it reaches a handler. Every money-moving route requires `Idempotency-Key`.
- Money is always `{ amountMinor: integer, currency }`. Coins are plain integers in their own unit (`COIN`) and are never mixed with fiat minor units. The server resolves the viewer's currency, and nothing hardcodes NGN.
- **Referral and purchase loyalty/cashback removed (owner, 2026-10-03).** There is no referral system and no platform-funded points or cashback on purchases; the go-money `rewards` module and the `referrals` block in `microservicesPlan.json` are gone. ZudoPoints engagement and gift points stay (non-monetary, in go-live). **Seller-funded store rewards (owner, 2026-10-03):** stores may fund store credit (see Store rewards below).
- **There is no in-store POS or cash register.** No registers, shifts, cash movements, offline sales, parked sales, PIN cashier switching, manager-PIN discount approvals or POS pay links. The `pos` block in `microservicesPlan.json` (registers, shifts, cash sales, `staffPins`) must go. The foundation agent owns that JSON and is removing it. The POS sections of `apps/seller/apiContract.md` and their mocks must also be deleted (§4.3.9).

---

## 1. Architecture — **DECIDED (revised 3 Oct): polyglot services on one Postgres cluster**

| Stack | Owns | Why this stack |
| --- | --- | --- |
| **Go** | users/accounts (auth, profiles, verification/KYB), wallet + ledger, payments, marketplace (catalog, inventory, stores), orders + escrow, subscriptions, creators (gifts, earnings), ZudoPoints, live (sessions, guests, battles), ads decision + attribution, admin | Strong typing and simple concurrency for money and the core state machines |
| **TypeScript (Zudojs)** | gateway, social orchestration (posts, comments, clips, stories, sounds, follows, privacy), feed orchestration, notifications, media, support, integrations (webhooks, couriers, partner APIs) | I/O-heavy fan-out; the existing Zudojs code in `apps/api` ports almost line for line |
| **Elixir / Phoenix** | realtime: chat, presence, typing, live activity (comments, gifts, goals, scores, viewer counts), in-app notification stream | Cheap processes, built-in presence and pub/sub, made for socket fan-out. **Never touches money** |
| **Python** | `services/python/intelligence`: ranking, recommendations, risk/fraud and moderation **scores**, ads pCTR, analytics pipelines | ML ecosystem. **Python returns scores; Go/TS make the deterministic policy decision** (thresholds live in config tables) |
| **OpenSearch** | search (products, people, businesses, posts, sounds) | Fed from domain events, later |
| **Redis** (ElastiCache) | cache, rate limits, leaderboards, combos, idempotency fast path | |

**Data:** one primary **Aurora PostgreSQL + PostGIS** cluster. Each owning service has **its own schema** (`accounts`, `ledger`, `payments`, `marketplace`, `orders`, `social`, `realtime`, `ads`, `points`, …). Only the owner writes; other services get **read-only grants** for joins and read models. Writes across ownership boundaries go through the owner's API or an event, never a direct cross-schema write. ClickHouse/OpenSearch are added later, fed from events.

**Events (no Kafka on day one; RabbitMQ adopted, owner, 2026-10-03):** every owner writes a transactional **outbox** row with its business change. A relay publishes it with publisher confirms to the RabbitMQ topic exchange **`zudomart.events`** (routing key = event name); each consumer service owns a durable quorum queue bound to the keys it needs. Work goes through the direct exchange **`zudomart.jobs`** (one quorum queue per job type). Every queue has retry queues (30 s, 2 m, 10 m, 30 m) and a `.dlq` after 5 attempts. Locally RabbitMQ runs in Docker; in AWS it is Amazon MQ for RabbitMQ (cluster deployment, private subnets). The code depends on one `DomainEventPublisher` / `JobQueue` / `QueueConsumer` interface per language, so the broker can change again without touching business code (the SNS/SQS adapters remain behind `EVENT_BUS=sqs` until the cut-over is proven). Phoenix consumes its own queue bound to the live/chat routing keys.

**Compute:** **ECS on Fargate** first (one service per deployable, autoscaling on CPU/queue depth). EKS only if ECS limits are hit. **Media:** S3 + CloudFront (signed URLs), LiveKit for live.

**Feed pipeline** (TS orchestrates, Python scores, TS/Go decide): `candidates` (follow graph, interests, trending, ads slots reserved) → `safety/integrity` (fraud, policy, quality scores → deterministic filters: drop/downrank/label) → `ranking` (py `/v1/feed/rank`, deterministic fallback) → `diversity rules` (author/format/topic caps, no two ads adjacent) → ad insertion by the Ad Decision Engine (§4.4).

### 1.1 Role of `apps/api`

`apps/api` becomes a **reference implementation**. It does not get deployed. It holds 354 routes, 124 Prisma models, a double-entry ledger, idempotency, escrow, disputes, legacy card gateways (replaced by the Paystack adapter in the new stack), coins and gifts, and the auth rules from SECURITY.md. Its validators, DTO shapes, state machines and tests are the spec to port. Its current 4 type errors (missing `admin.loader`, missing admin routes, `SocialSharedServices.discovery`, and `ads` `parentName`) do not need fixing.

| `apps/api` module | Ports to | Reuse |
| --- | --- | --- |
| auth, users (+ usernames), verifications, currency, admin, audit | go.auth, go.users, go.currency, go.admin | Rules and validators translate 1:1. Admin has commands but no routes yet |
| stores, products, categories, carts, orders, reviews | go.catalog, go.inventory, go.orders | Reviews go to go.catalog (product engagement) |
| payments, wallets, escrows, coins, creatorSubscriptions, subscriptions | go.payments, go.wallet, go.ledger, go.escrow, go.subscriptions | Ledger + idempotency + webhook dedupe are the most valuable logic to port carefully |
| creators (gifts, tips, earnings, affiliations) | go.creators | Gift catalogue and splits move to config tables |
| posts (incl. live + stories), feeds, follows, media, notifications, search, support, waitlist | ts.social, ts.feed, ts.media, ts.notifications, ts.search, ts.support, ts.campaigns; **live → go.live** | Copy most of the TS code directly |
| messages (+ realtime hub) | elixir.realtime (sockets, presence) + chat persistence in elixir.realtime | The WebSocket JSON envelope is kept (§5.6) |
| moderation, automation | go.moderation (automation rules live there per JSON) | |
| ads | go.ads | Rich schema (~30 models) but only account routes exist |
| intelligence (client) | stays as the client side inside each calling service | HMAC signing + circuit breaker + outbox pattern copied |

### 1.2 Deployment shape **[CONFIRM with foundation agent]**

The JSON lists about 17 Go services. Running 17 separately deployed Go binaries, each with its own database, would force distributed sagas onto every money path from day one. Recommendation: **one Go repository with one module per JSON service, grouped into a few deployables that share an Aurora cluster but own separate schemas.**

| Deployable | JSON services inside | Reason |
| --- | --- | --- |
| `go-identity` | auth, users, currency, admin | Low write volume, shared session/JWKS concerns |
| `go-commerce` | catalog, inventory, orders | Stock reservation and order creation in one transaction |
| `go-money` | payments, wallet, ledger, escrow, subscriptions, creators | **Every balance change commits in one Postgres transaction**, so there are no cross-service money sagas |
| `go-live` | live (sessions, guests, battles, LiveKit tokens) | Hot, latency-sensitive state machine |
| `go-ads` | ads | Separate scaling and billing cadence |
| `go-trust` | moderation | Async, queue-driven |

Cross-deployable calls go over gRPC/HTTP (sync) or outbox → RabbitMQ (async). Deployables share the cluster but own separate schemas, so splitting one out later is a deploy change, not a rewrite.

### 1.3 Request path

```
mobile / webapp BFF / studio BFF / seller BFF / ads BFF / admin BFF
        │  HTTPS  /api/v1/*                  │  WSS  /ws
        ▼                                     ▼
  ts.gateway (Zudojs)                 Phoenix realtime
  - JWT verify (JWKS), rate limits    - auth via access token or ticket
  - idempotency fast path, currency   - topics user:*, conversation:*, live:*
        │ gRPC/HTTP                           ▲ RabbitMQ queue (bound to zudomart.events)
        ▼                                     │
  go-* / ts-* services ──outbox──► publisher ─┘   python intelligence (HMAC, internal; scores only)
        └──────── one Aurora cluster, schema per owner, read-only grants ────────┘
```

Frontend paths stay exactly as they are (`/api/v1/...`). The gateway's route table maps prefixes to services (§2). No frontend URL changes.

---

## 2. Contract inventory

Legend. **Callers**: M = mobile, W = webapp, St = studio, SD = seller dashboard, Ad = ads manager, Adm = admin, L = landing (`apps/web`). **Ref**: ✅ = logic exists in `apps/api` to port, ◐ = partial, ✗ = missing. **Owner** = JSON service (`go.x` / `ts.x` / `ex.realtime` / `py.intelligence`). All paths are under `/api/v1`.

### 2.1 Auth and session — owner **go.auth**

| Endpoint | Callers | Ref | Notes / mismatch |
| --- | --- | --- | --- |
| POST /auth/login `{identifier,password}` | M W St SD Ad | ✅ | Identifier is email or username; UI says "Email" only (plans §6.4) **✅ built (go-identity).** |
| POST /auth/register `{email,birthday,password,username?,name?,otpToken}` | M W | ✅ | Webapp BFF sends `name`, mobile does not: accept optional `name` **✅ built (go-identity).** |
| POST /auth/otp/send, /auth/otp/verify | M W SD | ✅ | `purpose: signup\|reset\|login` **✅ built (go-identity).** |
| POST /auth/password/reset, /auth/password/change | M W SD | ✅ | **✅ built (go-identity).** |
| POST /auth/refresh, /auth/logout | all | ✅ | Rotation + reuse detection (SECURITY.md) **✅ built (go-identity).** |
| POST /auth/google `{idToken,nonce}`, /auth/apple `{identityToken,nonce,fullName?}` | M W | ✅ | Studio mock lacks these routes (`apps/studio/src/mocks/auth.mock.ts`), so social sign-in 404s there **✅ built (go-identity).** |
| GET /auth/username-available | M W | ✅ | **✅ built (go-identity).** Taken responses and register 409 add `suggestions` (3), see plans.md §50. |
| GET /auth/username-suggestion?seed | M W | ✗ | Add to go.users.usernames (`suggestUsername` is in the JSON) **✅ built (go-identity).** |
| GET/DELETE /auth/sessions[/:id] | — | ✅ | No UI yet **✅ built (go-identity).** |

### 2.2 Users, profiles, social graph — owner **go.users** (follows → **ts.social**)

| Endpoint | Callers | Ref | Notes / mismatch |
| --- | --- | --- | --- |
| GET/PATCH /users/me, GET /users/:id, GET /users/username/:username | M W | ✅ | PATCH sends `avatarUrl`/`bannerUrl` URLs, but media elsewhere uses `mediaId`s. Accept `avatarMediaId`/`bannerMediaId`, keep URL for one release **✅ built (go-identity).** |
| GET/PATCH /users/me/settings, PATCH /users/me/preferences `{countryCode}`, POST /users/me/deactivate | M W | ✅ | Mobile `AccountSettings.language` is the literal `"en"` (`apps/mobile/src/types`): widen to a locale string **Partly built:** only `PATCH /users/me/preferences` and `POST /users/me/deactivate` exist; settings and topics stay mocked. |
| GET/PUT /users/me/topics, GET /topics | M W | ✅ | Webapp mock topic ids `t_1` vs server uuid validation on `topicId` |
| CRUD /users/me/addresses | M W | ✅ | Mobile address has only `line1,city,state`. Server needs `countryCode` (currency/shipping), optional `line2`, `postalCode` **✅ built (go-identity).** |
| GET /users/me/username-policy, PATCH /users/me/username | M W | ◐ | Prisma models `UsernameChange/Hold/ReservedUsername` exist, but no routes **✅ built (go-identity).** |
| GET /users/me/profiles, GET/PUT /users/me/acting-profile | M | ✗ | go.users.actingProfiles **✅ built (go-identity).** |
| GET/POST /brands, /brands/:id[/products,/follow] | M | ✗ | go.users.brands + go.catalog.listBrandProducts |
| POST/DELETE /users/:id/follow, /stores/:id/follow; GET followers/following/follow-status/connections | M W | ✅ | Offline queue sends `Idempotency-Key` on follow and the online path does not, so the key must be **optional** here | **✅ built (ts-social)** for users (follow states, requests inbox, searchable lists, `GET /users/:id/follow-status`); store follows stay in go-catalog.
| POST/DELETE /users/:id/block, GET /users/me/blocked | M W | ✅ | | **✅ built (ts-social).**
| GET /search/people | M W | ✅ | → ts.search |
| GET /locale, /locale/countries, /currencies | M W L | ✅ | → go.currency **✅ built (go-identity).** |
| GET /verification/plans, /verification/me, POST /verification/applications, /verification/subscription/cancel | M | ◐ | Server has `/verification/apply` + `/verification/me`. Rename to the mobile paths, and add plans (go.subscriptions) |

### 2.3 Feed, posts, clips, stories, sounds — owner **ts.social / ts.feed**

| Endpoint | Callers | Ref | Notes / mismatch |
| --- | --- | --- | --- |
| GET /feeds/for-you, /feeds/following, /feeds/suggested-clips, /clips?tab | M W | ✅ | **Envelope mismatch** (§5.1): server pages are `{data,nextCursor}` and mobile `apiClient.service.ts:65` unwraps `payload.data`, so mobile loses `nextCursor` | **✅ built (ts-social)** plus `GET /feeds/popular` (guest fallback), honours personalization consent; `/clips?tab=`.
| POST /feeds/feedback, /feeds/interactions | M | ✅ | | **✅ feedback built (ts-social).**
| POST /posts `{text,mediaIds,audience,kind,soundId,visibility?}` | M | ✅ | **`audience: "followers"` is rejected**: server is `schema.enum(["everyone"])` (`apps/api/src/modules/posts/validators/posts.validator.ts:22`), mobile sends `everyone\|followers` (`apps/mobile/src/components/create/postToolbar.tsx`). Decision §3.3 | **✅ built (ts-social):** `audience everyone|followers`, `visibility`, `kind post|clip|story`, `isAiGenerated`, `replyToComment`+`stickerLayout`; media descriptors are read from the request body until ts.media exists.
| GET/DELETE /posts/:id, like/unlike, share, /posts/:id/products | M W | ✅ | | **✅ built (ts-social).**
| POST /posts/:id/repost `{text?}` | M W | ✅ | Server must create a new post with `resharedFrom` (plans §7). Confirm `RepostBodySchema` accepts `text` | **✅ built (ts-social).**
| GET /posts/:id/analytics | M W | ✗ | Owner-only, `403 NOT_POST_OWNER` (plans §11). Read model from ClickHouse via ts.feed |
| GET/POST /posts/:id/comments, /comments/:id/replies, comment like, DELETE /comments/:id | M | ✅ | | **✅ built (ts-social)** (tree: `/comments/:id/replies` returns direct children).
| GET /users/:id/posts, /stores/:id/posts | M W | ✅ | | **✅ built (ts-social)** (users only).
| Stories: /stories/tray, /users/:id/stories, POST /stories, seen, replies | M | ✅ | Mobile sends both `mediaId` and a full `media` object: server reads `mediaId` only | **✅ tray, user stories, publish, seen built (ts-social); story replies not built.**
| Sounds: GET /sounds, /sounds/trending, /saved, /:id, /:id/clips; PATCH /sounds/:id; POST/DELETE /sounds/:id/save | M | ✗ | ts.social.sounds |
| POST /posts/:id/gifts, POST /tips `{targetType,targetId,coins}` | M | ✅ | → go.creators. Tip balance field is `balance`, live gift receipt is `coinBalance`: unify on `coinBalance` |

### 2.4 Media — owner **ts.media**

| Endpoint | Callers | Ref | Notes / mismatch |
| --- | --- | --- | --- |
| POST /media/uploads `{fileName,mimeType,sizeBytes,purpose,sha256?}` | M SD Ad | ✅ | Purposes: post, clip, story, avatar, chat_image, voice, product, ad_creative, dispute_evidence, gift_animation (new) |
| PUT /media/uploads/:id/chunks/:i (octet-stream + `X-Chunk-Sha256`) | M SD Ad | ✅ | Mobile mock receives JSON `{byteLength,chunkSha256}`, but the real path sends raw bytes. The server contract is raw bytes |
| GET /media/uploads/:id, POST /complete, GET /media/:id, DELETE | M SD Ad | ✅ | Move storage to S3 multipart + CloudFront signed URLs; processing jobs (AVIF/WebP, HLS) |
| — | M SD | — | Disputes, support and seller products send **URLs** (`evidenceUrls`, `attachmentUrls`, `imageUrls`, `logoUrl`), while chat and posts send `mediaId`s. Standardise on `mediaIds` everywhere; accept URLs only from our own CDN during the transition |

### 2.5 Messaging and realtime — owner **ex.realtime**

| Endpoint / event | Callers | Ref | Notes / mismatch |
| --- | --- | --- | --- |
| GET/POST /conversations, GET/PATCH /conversations/:id, /search | M W | ✅ | | **✅ built (ts-social)** (metadata only; messages are ciphertext envelopes).
| GET/POST /conversations/:id/messages (`{text}`, `{kind:"voice",mediaId,durationSeconds,text:""}`, `{kind:"image",mediaId,text:""}`) | M W | ✅ | No client message id in the body. Use `Idempotency-Key` as the dedupe key and echo it as `clientMessageId` in `message.created` so the optimistic bubble reconciles | **✅ built (ts-social):** `encryption {deviceId, ciphertext, protocol}` replaces `text`; `Idempotency-Key` is the `clientMessageId`.
| POST /conversations/:id/read, GET /messages/unread-count, reactions | M | ✅ | | **✅ read, reactions built (ts-social).**
| Groups: /conversations/groups, members, admins, leave; Channels: /channels, subscribe | M | ✅ | |
| POST /stores/:storeId/conversations, GET /seller/conversations | M SD | ✅ | Seller inbox shares the same conversations (§4.3) |
| POST /realtime/tickets | — | ✅ | Short-lived socket ticket for browsers (BFF cookies cannot reach the socket) |
| WS `/ws`: client `auth{accessToken}`, `ping`, `typing`; server `message.created/updated`, `conversation.updated`, `typing`, `reaction`, `pong` | M | ✅ | Keep this exact JSON envelope in Phoenix (§5.6). **No live, gift or notification events exist yet**: added in §4.1/§4.2 |

### 2.6 Live — owner **go.live** (activity fan-out **ex.realtime**, gifts **go.creators**)

| Endpoint | Callers | Ref | Notes / mismatch |
| --- | --- | --- | --- |
| POST /lives `{title,category,storeId?,productIds?,visibility?}` | M St | ◐ | Server body has no `category` (plans §20). Studio `app/(studio)/lives/page.tsx` calls `createLive(title)` without category (type error) **✅ built (go-live):** creates and goes live (`startNow:false` keeps `idle`); category, visibility, storeId/productIds (seller only), live-ad settings + `acceptedLiveAdTermsVersion` stored per session. |
| GET /lives, /lives/suggested, /lives/:id | M St | ✅ | Studio expects `state: idle\|connecting\|live\|ended`, `ingestUrl`, `streamKey`, `hlsUrl`, `peakViewers`, `earnings{coins,giftCount,newSubscribers,topGifters,battles}`; server has `status` and none of the media fields. Mobile expects `playbackUrl`, `coverUrl`, `giftsEnabled`, `hostIsCreator`, `pinnedProductId`. **One `LiveSessionDto` must cover both** (§4.2.6) **✅ built (go-live):** `GET /lives/:id` and `/lives/suggested` (bare array, as the mobile mock). `products` is `[]` until go-commerce summaries are wired; `coverUrl`/`playbackUrl` are null. |
| POST /lives/:id/start | St | ✗ | idle → connecting **✅ built (go-live):** idle → live. |
| POST /lives/:id/stream-key → `{ingestUrl,streamKey}` | M St | ✗ | LiveKit Ingress (RTMP/WHIP) |
| POST /lives/:id/end, join, leave, reactions, share | M St | ✅ | **✅ built (go-live):** reactions is a 204 acknowledgement, share awards share points. |
| GET/POST /lives/:id/comments | M St | ✅ | Studio expects bare `LiveComment[]` with `authorName`; webapp/mobile expect `Page` with `author{}`. Standardise on `Page<LiveComment>` with `author{id,name,username,avatarUrl}` and change Studio |
| GET/POST /lives/:id/products, POST /lives/:id/pins `{productId}`, GET /live-products | M St | ◐ | Server has only POST /products `{productId(uuid), pin}`. Add GET, `/pins`, and a seller catalogue picker; products only for hosts with a store (plans §20) **✅ built (go-live):** `POST /pins`, `GET /products` (seller role only). Comments and overlays are not built. |
| GET/PUT /lives/:id/overlays, GET /overlay-scenes/:sceneId (public) | St | ✗ | go.live (scene JSON in Postgres JSONB) |
| GET /gifts, POST /lives/:id/gifts `{giftId,quantity}` | M W | ✅ | Gift ids differ: API `rose,heart,fire,crown,rocket`; webapp mock `gift_rose,gift_jollof,…`; mobile mock 6 gifts. Catalogue becomes server data (§4.1) **✅ built (go-live):** `GET /gifts` (ETag), `POST /live/gifts` and the `/lives/:id/gifts` alias, admin CRUD under `/admin/gifts`; money via go-money `ChargeGiftAndCreditCreator`. |
| Guests, battles | — | ✗ | New (§4.2) **✅ built (go-live):** guests, join requests, battles, `GET /stage`, media-token; shapes follow the mobile mock (`LiveStage` snapshots). |

### 2.7 Coins, creators, subscriptions — owner **go.creators / go.wallet / go.subscriptions**

| Endpoint | Callers | Ref | Notes / mismatch |
| --- | --- | --- | --- |
| GET /coins/balance `{coins,earnedCoins}` | M W | ✅ | Webapp mock omits `earnedCoins` **✅ built (go-money).** |
| GET /coins/packages (alias /coins/packs) | M W | ✅ | Drop the `/packs` alias after wiring **✅ built (go-money).** |
| POST /coins/purchases `{packageId}` → `{reference,purchaseChannel,authorizationUrl?}`; POST /coins/purchases/:ref/verify; POST /coins/iap/receipts | M W | ✅ | Coin verify takes the reference in the **path** and creator-subscription verify takes it in the **body**. Keep both (both exist server-side); new endpoints use the body **✅ built (go-money).** |
| GET /coins/transactions, /coins/transfers/quote, POST /coins/transfers | M W | ✅ | 25% transfer fee (config) **✅ built (go-money).** |
| POST /creators/earnings/convert `{coins}` | M | ✅ | 422 minimum payout surfaces verbatim **✅ built (go-money).** |
| GET /creators/me, /eligibility, /applications/me, POST /applications, /dashboard?period, /earnings, /revenue-rules, /affiliations, /me/affiliated-products | M W | ✅ (affiliated-products ✗) | Dashboard `topContent[].kind` includes `live`. Studio's earnings panel needs per-live gifts/battles (§4.2) |
| Creator subscription plans + subscriptions (11 routes, plans §4.1) | M | ✅ | Already aligned (plans §4.3) |

### 2.8 Commerce (buyer) — owner **go.catalog / go.orders / go.payments / go.escrow / go.wallet**

| Endpoint | Callers | Ref | Notes / mismatch |
| --- | --- | --- | --- |
| GET /mart/home, /products, /products/featured, /products/:id, like, bookmark, /categories, /stores/:id[/products] | M W | ✅ | `GET /stores/:id` currently lives in posts. It moves to go.catalog, with posts composed by the gateway |
| GET /search?q&scope | M W | ✅ (1 route) | → ts.search on OpenSearch. Response `{products,stores,people,brands?}` |
| Reviews: GET/POST /products/:id/reviews, rating-summary, /stores/:id/reviews, reply | M SD | ✅ | |
| Cart: GET/DELETE /cart, POST /cart/items `{productId,quantity,size?,color?}`, PATCH/DELETE /cart/items/:id | M W | ✅ | Request sends `size`/`color`, response has `variant: string\|null`. Accept `variantId` (preferred) or `size`+`color`, and return `variant{id,size,color,sku}` |
| POST /orders/checkout `{addressId}` → `{orderGroups,payableCheckoutId,total}` | M W | ✅ | One `Checkout`, **one order group per seller** (§4.6). Mobile reads `orders`/`payableOrderId` today; rename during wiring |
| GET /orders?status, /orders/:id, cancel, confirm-receipt | M W | ✅ | Mobile `GET /orders` expects a bare array, which needs a page envelope; `status` filter values must match §4.3.5 |
| GET /orders/:id/escrow, POST /orders/:id/disputes, GET /disputes, /disputes/:id, messages | M W | ✅ (GET /disputes list ✗) | **✅ built (go-money).** |
| POST /payments/initialize `{checkoutId}` (Paystack transaction, one per checkout, dynamic split for direct groups), POST /payments/orders/:id/verify, POST /webhooks/paystack | M W | ✅ | Paid only after webhook/verify (SECURITY.md) **✅ built on Paystack (go-money): one transaction per seller order (one per checkout is a later step), subaccount split for direct orders.** |
| GET /wallets/me `{available,pending}`, transactions, payout accounts, withdrawals (+quote), top-ups, GET /banks | M | ✅ | Top-ups not built yet. **✅ built (go-money).** |
| GET /wallets/me/escrow-holds, POST /banks/resolve-account | M | ✗ | **✅ built (go-money).** |
| GET /store-rewards/me (per-store credit balances), GET /seller/marketing/rewards/summary | M S | ✅ | **New, seller-funded** (§ Store rewards below). Per-store credit ledger in go-commerce, not go-money cash. Referral and platform loyalty/cashback endpoints removed |
| GET /notifications (bare array), read, read-all, preferences, device tokens | M W | ✅ | Needs a page envelope; → ts.notifications. **✅ built (ts.notifications):** `GET /notifications?filter=all\|mentions` → `{data,nextCursor}`, `POST /notifications/:id/read`, `/read-all`, `GET /notifications/unread-count`, `GET\|PATCH /notifications/preferences`, `POST\|DELETE /notifications/device-tokens`, `GET\|POST /email/unsubscribe` (one-click), admin `/admin/support/email/*` and `/admin/legal/{notices,versions/:id/notice-draft,notice-preview}`; consumes domain events from RabbitMQ (`notifications-domain-events`, jobs on `jobs-email`) and sends SES email through `@zudomart/email-templates` |
| Reports, appeals, copyright claims, support tickets | M | ◐ (`/copyright/claims` ✗) | go.moderation / ts.support |
| POST /waitlist | L | ✅ | ts.campaigns |

### 2.9 Seller dashboard — owner mostly **go.catalog / go.inventory / go.orders / go.money**, analytics **ClickHouse**

Contract: `apps/seller/apiContract.md`, types in `apps/seller/src/types/*.type.ts`, mock toggle `SELLER_USE_MOCKS`. `apps/api` has only a thin slice (access, verification, dashboard, orders + ship/deliver, `GET /seller/inventory`, products CRUD + variants, affiliate commissions, conversations).

| Endpoint group | Ref | Owner | Mismatch / change |
| --- | --- | --- | --- |
| GET /seller/access | ◐ | go.catalog | **Must change**. Today `SellerAccessService.assertStoreHasActiveSellerAccess` (`apps/api/src/modules/subscriptions/services/sellerAccess.service.ts`) requires Gold verification + an active Gold subscription. The seller frontend does the same (`apps/seller/src/utils/sellerAccessDestination.util.ts` → `billing`). The new rule: **any approved seller on any plan, including Free, gets in** (§4.3.1). The route is also guarded by `orders:fulfil` in apps/api, which is not in the contract |
| /seller/subscription/plans, /subscription, checkout, verify, cancel, resume | ◐ | go.subscriptions | Plans become **Free / Pro / Business** (seller plans), not `GOLD_PRO/GOLD_PREMIUM`. Paid plans grant the Gold business checkmark once the business passes KYB |
| /seller/verification | ✅ | go.users.verification | KYB documents → Gold badge for Pro/Business stores; never gates dashboard access |
| **POS:** /seller/pos/*, /seller/staff/pin-roster, /pin-sessions, /:id/pin, /:id/unlock-pin, `X-Seller-Operator` header | — | **REMOVE** | Delete from the contract, mocks, types and UI (§4.3.9) |
| /seller/categories, /seller/products (CRUD, publish, bulk, barcodes, import ≤2000 rows, export) | ◐ | go.catalog | Contract PATCH is full replace. Import prices arrive as major-unit decimals in CSV: convert on the server with the store currency's exponent |
| /seller/inventory/levels, adjustments, transfers (+receive/cancel) | ◐ | go.inventory | apps/api has `GET /seller/inventory`, which is renamed to `/levels`. `available = onHand − reserved` |
| /seller/orders (+`countsByStatus`), /:id, /:id/fulfilment, /:id/cancel | ◐ | go.orders | apps/api uses `/ship` + `/deliver`. Contract uses `/fulfilment`. Lifecycle in §4.3.5 |
| /seller/returns (+approve/decline/receive), /seller/disputes (+responses) | ✗ | go.orders.returns / go.escrow.disputes | |
| /seller/customers (+export, notes, purchases) | ✗ | go.orders (customer read model) | New `customers` module (not in JSON) |
| /seller/promotions (+validate-code) | ✗ | go.orders (pricing) | Drop the `pos` channel; channels = `app`, `storefront` |
| GET /seller/dashboard, /seller/reports/:kind (+`format=csv`) | ◐ | reporting (ClickHouse) | Drop `sales-by-staff` shifts/register kinds and `shifts`. Add xlsx/pdf (§4.3.13) |
| /seller/wallet/balances, transactions, statements, payout-settings, payouts, banks, payout-accounts | ◐ | go.wallet | Payouts: owner/finance only, step-up re-auth |
| /seller/settings, /seller/locations | ✗ | go.catalog.stores, go.inventory.locations | Remove POS settings (receipt printer, cash rounding, discount-approval PIN threshold) |
| /seller/zudomart-users?q, /seller/staff/candidates, /seller/staff CRUD | ◐ (`/stores/:id/members`) | go.catalog.storeMembers | Staff = existing Zudomart users added by username; they accept in the app. Roles change (§4.3.14) |
| /seller/audit-log | ✗ | go.admin.auditLog (store-scoped view) | |
| /seller/affiliates/* (settings, overview, requests, creators, product-commissions, ledger, directory, live-invitations) | ◐ | go.creators.affiliations | |
| /seller/brands/*, /seller/stores/mine, official store, protection claims | ◐ | go.users.brands, go.moderation.trademarkClaims | Official Store still needs a registered brand (plus Gold) |

### 2.10 Ads manager — owner **go.ads** (decision engine + attribution §4.4; pCTR/fraud scores **py.intelligence**)

Contract: `apps/ads/apiContract.md`, mock toggle `ADS_USE_MOCKS`. apps/api has 16 account routes (memberships, accounts, business profiles, entitlements, members, invites, activity), and they are **not registered** in `src/routes/index.ts`.

| Endpoint group | Ref | Mismatch / change |
| --- | --- | --- |
| /ads/memberships, /ads/accounts[/:id], business-profiles, entitlements, members, invites, activity | ✅ | Invites are by **email** token. That conflicts with the "existing Zudomart users only" staff rule used for sellers. **[CONFIRM]** whether ad-account members must also be existing app users (recommended: yes, invite by username, accept in app) |
| Campaigns (create bundle, submit, duplicate, bulk-actions), ad sets, ads, appeal | ◐ (models only) | |
| Creatives preview, content-sources, chunked media | ◐ | |
| Audiences, customer lists (hashed), locations, behaviours, estimates | ◐ (models) | |
| Billing: top-ups, transactions, receipts (PDF), invoices, spend limit, funding mode, payment methods | ◐ (models) | `Idempotency-Key ≤256` here vs 8–128 elsewhere. Standardise on 8–128 |
| Reports, export, scheduled reports; tools: conversion events, experiments, rules | ◐ (models) | |
| Pagination `{items,nextCursor,total}` | — | Change to `{data,nextCursor,total?}` (§5.1) |
| Mobile: POST /ads/events (batched), /ads/boosts/options, /estimate, POST /ads/boosts, GET /ads/boosts/:id | ✗ | Event ingest → Ad Decision Engine attribution pipeline (§4.4) |

### 2.11 Admin console — owner **go.admin** (+ each domain's admin commands)

Contract: `apps/admin/apiContract.md`, mock toggle `ADMIN_USE_MOCKS`. apps/api has admin commands/queries (login, TOTP, passkeys, step-up, invites, sessions, audit) and **no routes**, plus per-module admin routes (disputes, refunds, withdrawals, moderation, creator/seller applications, subscription plans, coin packs, automation, waitlist, exchange rates).

| Endpoint group | Ref | Notes |
| --- | --- | --- |
| /admin/auth/* (login, TOTP, WebAuthn, step-up, refresh, me, logout), /admin/account/*, /admin/admins/* | ◐ | Separate token audience; SUPERADMIN via CLI only |
| /admin/audit (+facets, export) | ✅ built (B1) | Filters search/area/actor/target/dates, CSV export (formula-safe, audited), `actor.departments`, `stepUpVerified` |
| /admin/metrics/overview | ✗ | ClickHouse + ledger per-currency sums |
| /admin/users (list, detail, restrict, suspend, reinstate, ban, unban, delete, username reassign / assign-held), /admin/usernames/held\|hold, /admin/suspensions/accounts (+reinstate, appeal decide), /admin/suspensions/cases (go-trust) | ✅ built (B1) | warn, force-logout, personal-data reveal are not built | |
| /admin/verifications, /admin/checkmark-grants, /admin/accounts(/created), /admin/black-applications, /admin/business-documents | ✅ built (B1) | Approving KYB on a Pro/Business store turns on the Gold check; it **no longer** turns on dashboard access (contract text must change) |
| /admin/applications/creators | ✅ built (B1) | Sellers still ✅ elsewhere. | Seller approval is what grants dashboard access |
| Moderation reports/appeals/copyright, ads review, advertisers, ad policies, brands, IP claims | ◐ | |
| Orders, escrows, disputes resolve, refunds, payouts (approve/hold/reject), coins review/reverse, ledger read | ✅ mostly | Add **live gift / battle** review: GET /admin/lives/:id/gifts, /admin/battles/:id |
| /admin/config/plans | ◐ | `PlansConfiguration` must split **verification plans** (BLUE_*, GOLD_*, BLACK_OFFICIAL) from **seller plans** (FREE/PRO/BUSINESS with `dashboardEntitlements`) |
| /admin/config/revenue | ◐ | Add `liveGiftCreatorShareBps` tiers (max 7000), battle rules (§4.2) |
| flags, experiments, automation, notification templates, categories, topics, mart home features, support tickets/macros | ◐ | Add gift catalogue admin: /admin/gifts CRUD (§4.1) |
| Pagination page-based `{items,page,pageSize,total}` | — | Allowed for admin tables; rename `items` → `data` (§5.1) |

### 2.12 Intelligence (internal) — owner **py.intelligence**

Internal only, HMAC signed (`x-zudo-timestamp/nonce/signature`), and called by services, never by frontends. Endpoints: `/v1/events`, `/v1/feed/rank`, `/v1/clips/rank`, `/v1/social-proof/select`, `/v1/ads/select`, `/v1/recommendations/{products,accounts,clips}`, `/v1/trending`, `/v1/search/rerank`, `/v1/risk/score`, `/v1/experiments/*`, `/v1/audio/*`. The `apps/api` client only calls events, feed/clips rank, ads select, product recs, rerank and trending. **Risk scoring is not wired**, and it must score `gift`, `coin_purchase`, `coin_transfer` and `payout` before those go live. Error envelope `{error:{code}}` stays internal (the gateway never exposes it). The JSON `python` block lacks an `intelligence` entry; the foundation agent should add it, mapping to `services/python/intelligence`.

| Intelligence endpoint or consumer | Status | Notes |
|---|---|---|
| `/v1/events`, `/v1/feed/rank`, `/v1/clips/rank`, `/v1/recommendations/*`, `/v1/search/rerank`, `/v1/social-proof/select`, `/v1/trending`, `/v1/experiments/*`, `/v1/audio/*` | ✅ done | Candidate filter → ranking → diversity, with popularity/recency fallbacks; callers keep deterministic fallbacks |
| `/v1/ads/select`, `/v1/ads/predicted-ctr` | ✅ done (B7 added pCTR) | `personalized:false` for opted-out viewers |
| `/v1/risk/score` (order, payout, account_event, coin, gift, referral_reward, cashback) | ✅ done | Go/TS decide; callers use timeout + fallback, never inline in a payment |
| `/v1/risk/score-extended` (account, payment, ad_click, referral_removed, refund, marketplace) | ✅ done (B7) | Rule scores, noisy-OR |
| `/v1/chat/spam-score` | ✅ done (B7) | Sender behaviour metadata only; contract rejects content fields |
| `/v1/moderation/classify` | ✅ done (B7) | Text heuristics + pluggable `ModerationModel`; suggestions only |
| `/v1/creators/real-followers` | ✅ done (B7) | Estimate and lower bound; goCreator/goTrust decide eligibility |
| Domain-event consumer (RabbitMQ `intelligence-domain-events`, aio-pika; `EVENT_BUS=sqs` keeps the old SQS poller) | ✅ done (B7) | Idempotent by `eventId`, consent gating (`consent.granted/withdrawn`, `account.deletionRequested/Executed` per published contracts); poison → `.dlq`, failures → retry tiers |
| Suspension suggestions → goTrust advisory queue (RabbitMQ job queue `intelligence-trust-advisory`) | ✅ producer done (B7) | goTrust must consume `suspension.suggested`; advisory only |
| Caller wiring (circuit breakers in go/ts services) | ✗ open | Each calling service owns its client |

### 2.13 Cross-app mismatch list (to fix during wiring)

1. **List envelope.** Server `{data,nextCursor}` vs mobile unwrap in `apps/mobile/src/services/apiClient.service.ts:65` (`payload.data ?? payload`), which drops `nextCursor`. Ads uses `{items,nextCursor,total}`. Admin uses `{items,page,pageSize,total}`. Fix in §5.1.
2. **Post audience.** `audience: "followers"` (mobile `postToolbar.tsx`) vs server `enum(["everyone"])` (`posts.validator.ts:22`). The subscriber tier is `visibility: "subscribers"`. Fix in §3.3.
3. **Gift ids and catalogue.** `apps/api/src/modules/creators/constants/giftCatalog.constant.ts` (5 gifts, no animation field) vs webapp mock `gift_*` ids vs mobile 6 gifts vs `apps/gift/{rose,heart,star}.mp4` (`star` matches nothing; the owner rejected these mp4s as final art). Fix in §4.1.
4. **Live session shape.** Studio `apps/studio/src/types/index.ts` (`state`, `streamKey`, `ingestUrl`, `hlsUrl`, `earnings`) vs mobile `LiveSessionDetails` (`status`, `playbackUrl`, `giftsEnabled`, …) vs server `LiveSession` model (no media fields, no category).
5. **Live comments.** Studio expects a bare array with `authorName`; others expect `Page` with `author{}`.
6. **Live products.** Studio needs `GET /lives/:id/products` and `GET /live-products`; mobile uses `POST /lives/:id/pins`; server has only `POST /lives/:id/products {productId, pin}`.
7. **Cart variant.** Request `size,color` vs response `variant: string|null`.
8. **Address.** Missing `countryCode`, normalized region/admin-area IDs (Nigeria state + LGA), `line2`, `postalCode` (§4.6).
9. **Media references.** URLs (`evidenceUrls`, `attachmentUrls`, `imageUrls`, `logoUrl`, `avatarUrl`, `bannerUrl`) vs `mediaIds`.
10. **Gift/tip receipts.** `coinBalance` vs `balance`.
11. **Bare arrays.** `GET /notifications`, `GET /orders`, `GET /lives/:id/comments` (Studio).
12. **Verify reference placement.** Coin verify uses the path; subscription verify uses the body.
13. **Topic ids.** Webapp mock `t_1` vs server uuid.
14. **Seller access.** Gold + subscription gate in `apps/api` `sellerAccess.service.ts` and `apps/seller/src/utils/sellerAccessDestination.util.ts` vs the new Free-plan rule.
15. **Seller roles.** `cashier` and `pos:*` permissions in `apps/seller/src/config/rolePermissions.config.ts` must go.
16. **Ad-account invites by email** vs the existing-users-only rule (open question).
17. **Idempotency-Key length.** Ads ≤256 vs 8–128.
18. **Studio social sign-in.** No mock route (`apps/studio/src/mocks/auth.mock.ts`).
19. **Live create body.** Studio `createLive(title)` is missing `category` (`apps/studio/src/app/(studio)/lives/page.tsx`).

---

### 2.14 Built so far: go-identity (auth, users, currency, admin)

Done and covered by integration tests: everything marked **✅ built** in §2.1 and §2.2, plus these additions that have no mobile client yet:

- Auth: `DELETE /auth/sessions` (revoke all other sessions), `GET /auth/sessions` is cursor-paged (`{data,nextCursor}`).
- Users: `POST /users/me/media/upload-intents` (signed placeholder upload, replaced by ts.media), `PATCH /users/me/business-profiles/{id}`, `POST /users/me/creator-application` (sets the personal profile's `creatorStatus` to `pending`), `GET /business-categories`, staff username tools (`/admin/usernames/reserved`, `/admin/usernames/withheld`).
- Geo and addresses: `GET /geo/countries`, `/geo/countries/{code}/regions`, `/geo/regions/{id}/admin-areas|cities`, `/geo/admin-areas/{id}/cities`; `/users/me/addresses` carries `regionId`, `adminAreaId`, `cityId` plus resolved names (Nigeria: states and LGAs seeded, the city step stays optional).
- Privacy: consent ledger (`/policies/current`, `/consents` anonymous by `X-Device-Id`, `/users/me/consents`, `/users/me/consents/merge`, `/users/me/terms-acceptances`), `/users/me/privacy-settings`, data export (`/users/me/data-exports`), deletion (`/users/me/deletion-request`).
- Currency: `GET /currency/convert`, staff `GET/PUT /admin/exchange-rates` (step-up).
- Admin: staff auth with TOTP and step-up, invitations, settings store (`creator.requirements`, `monetization.policy`, `gift.shareTiers`), audit log and export. Superadmins are created only with the CLI.

Changes the clients must make before dropping the mocks (prefixes `/api/v1/auth`, `/api/v1/users`, `/api/v1/business-categories`, `/api/v1/locale`, `/api/v1/currencies`, `/api/v1/geo`):

1. **Lists are envelopes.** `GET /users/me/profiles`, `/users/me/addresses`, `/locale/countries`, `/business-categories`, `/auth/sessions`, `/geo/*` return `{data,nextCursor}`. The mobile `apiClient` returns an object that has a `nextCursor` key untouched, so `listMyProfiles`, `listMyShippingAddresses` and `listSupportedCountries` must read `.data`.
2. **Profile and counters.** `GET /users/me` returns `followers`, `following`, `posts` as 0 and no follow state: ts.social must overlay them. `name` is empty until the user sets one (social sign-in fills it from the provider); show `username` as a fallback.
3. **Avatar and banner.** Prefer `avatarMediaId`/`bannerMediaId` from `POST /users/me/media/upload-intents`; `avatarUrl`/`bannerUrl` still work (https only). Clearing sends `null`.
4. **Social sign-in.** Send the raw nonce: Google compares it to the token's `nonce` claim, Apple accepts the SHA-256 hex the app already puts in the token. A missing provider configuration answers `503 SOCIAL_SIGN_IN_NOT_CONFIGURED`.
5. **Username availability** now returns `reason` (`taken|reserved|invalid|recently_used|withheld`); `PATCH /users/me/username` answers 429 `USERNAME_CHANGE_TOO_SOON`, 409 `USERNAME_TAKEN`, 422 `USERNAME_INVALID|USERNAME_UNAVAILABLE`. `GET /users/me/username-policy` also returns `username`, `cooldownDays`, `maxChangesPerYear`, `quarantineDays`, `history`.
6. **Acting profiles** use the mobile vocabulary in `kind` (`person|business`) and the plan vocabulary in `type` (`personal|business`); the personal profile also carries `creatorStatus`; business creation is `POST /users/me/business-profiles` with `categories: [{categoryId, subcategoryId, customName}]`.
7. **Addresses** send `countryCode`, `regionId` (and `adminAreaId`, `cityId` where the country has them); free-text `state`/`city` is accepted only for countries without seeded data.
8. **Password change/reset** return 204 with no body; change keeps the current session and revokes the others, so the app should keep its refresh token.
9. **Still mocked** for these prefixes: `/users/me/settings`, `/topics`, `/users/me/topics`, `/users/me/blocked`, follows, verification, brands (`/brands`).

### 2.15 Built so far: go-money (ledger, payments, escrow, wallet, creators)

Done and covered by integration tests (real Postgres, Paystack faked at the HTTP layer by `paymentsTesting/fakePaystack*.util.go`): everything marked **✅ built (go-money)** in §2.7 and §2.8, plus:

- Internal gRPC for go-live (`LiveMoneyService`: gift charge with tier split / host fallback / battle holdings, battle settlement, battle gift totals, coin balance) and go-commerce (`CheckoutMoneyService`: register checkout payables with escrow/direct mode, record shipped/delivered, confirm receipt, get escrow). See `services/README.md`.
- **Bachs and Anchor dropped; Paystack adopted (owner, 2026-10-03).** The Bachs Connect code is removed; the Paystack implementation is live in go-money (status in `docs/integrations/paystack.md` §12). Target: one Paystack transaction per checkout; direct groups split to seller subaccounts (T+1 settlement, Zudomart never holds that money); escrow in Zudomart's Paystack balance (E2) released after delivery + 24h lock by Paystack transfer, or manual-settlement subaccounts (E1) if Paystack confirms; creator shares paid by transfer; refunds through the Refund API with seller debt for settled direct shares; daily reconciliation against Paystack transactions, balance, settlements and transfers. Full list: `docs/checkoutPaymentFlowPlan.md` §12.
- Seller balances per the checkout plan: in escrow → locked 24h → available → payout requested → paid, with debt recovery instead of negative balances; daily payout run; `GET /wallets/me` adds `locked`, `inEscrow`, `payoutRequested`, `negativeBalance`, `nextAvailableAt`.
- `POST /disputes/:id/close` (buyer withdraws), `POST /wallets/me/withdrawals/:id/cancel`, `GET /wallets/me/withdrawals`.
- Admin: ledger integrity and statements, journal reversal (step-up), provider reconciliation, dispute queue and resolution (release / refund / partial, step-up), escrow refunds, withdrawal review, payout run, creator tiers and membership.

Changes the clients must make: lists are `{data,nextCursor}` (`/coins/packages`, `/banks`, `/wallets/me/transactions`, `/wallets/me/payout-accounts`, `/wallets/me/escrow-holds`, `/disputes`); the coin purchase body is `{packageId}` and app clients get `purchaseChannel: "store_iap"` (they must buy through IAP); `POST /wallets/me/withdrawals` returns a `WalletTransaction` plus `fee`, `netAmount`, `withdrawalStatus`; `EscrowDetail.buyer`/`store` carry only `id` until the gateway composes profiles.

### 2.17 Built in batch B1: identity, admin and trust

Done with integration tests against compose (`pnpm backend:test:go`, `pnpm backend:test:gateway`):

- **Guest browsing** (gateway): anonymous GET on public routes (feeds, clips, posts, explore, products, stores, lives, public profiles incl. `GET /users/by-username/{username}`, `GET /legal/policy-versions/current`), per IP + `X-Device-Id` rate limits (`GUEST_RATE_LIMIT_PER_MINUTE` 120, `GUEST_SENSITIVE_RATE_LIMIT_PER_MINUTE` 30 on feeds/explore/search/products/stores/clips, 429 + `Retry-After`), `x-zudomart-viewer: anonymous` upstream, private routes answer `401 UNAUTHENTICATED`. `POST /reports` goes to go-trust when the body has a `conversationId` or a chat `targetType`.
- **RBAC** (admin): permission catalogue and ten department templates (`staffauth.DepartmentRoleTemplates`), custom roles, several roles per admin (effective permissions are the union and are put in the token with legacy aliases), superadmin implicit, second-superadmin approval (`GET/PUT /admin/staff-settings`, default on), suspend / revoke / enable / reset-mfa with session killing (a session checker also rejects live access tokens at once), "cannot grant what you do not hold", every write audited with staff name, id, departments, target, before/after, reason, IP, request id and step-up flag.
- **User actions** (users, with auth `AccountEnforcement` port): restrict (features + days), suspend (120-day deletion clock, worker deletes profile and users-owned data and emits `account.deletionExecuted` so owners anonymise financial/order records, retained 7 years), ban (permanent bans block email / phone / device re-signup by HMAC hash), delete, username reassign and assign-held (hold bypass flag, audited as `username.assigned_hold_bypassed`), suspension appeals. Python suggestions are advisory `suspension_cases` in go-trust (`POST /internal/suspension-cases` and the `INTELLIGENCE_TRUST_ADVISORY_QUEUE` RabbitMQ consumer); only an admin approval calls the users service.
- **Creator Program**: `GET /creators/eligibility` (checklist + decision), `POST /creators/applications`, `GET /creators/applications/me`, admin review queue; thresholds from the `creator-thresholds` setting; signals (followers, original posts, violations, fraud/risk scores, ID, orders, plan) are written by social / Python / commerce through `PUT /internal/profiles/{profileId}/signals`.
- **Checkmarks v2**: profile-type rule (Personal blue, Business/Brand gold, Government black), suggestions + dismiss, applications, admin transitions, lifetime grants (Black superadmin only), admin-created accounts (superadmin), Black vetting with maker-checker and handle reservation (`reserved_official` hold), yearly re-verification worker, billing hook `POST /internal/checkmarks/{profileId}/billing-events` (`lapsed|restored|ended`) for go-money, state event `profileCheckmark.changed`.
- **Business documents**: presigned S3 PUT intents, confirm, review queue, signed 2-minute view links with watermark; approval of all three grants Gold eligibility and the check when the store plan is paid.
- **Legal**: versioned documents with maker-checker, material-change flag and 30-day notice, rollback, notice drafts, previews, progress, `policy.published` (carries the email draft) and `policyVersion.published` events, acceptance records linked through `policyVersionId` on `PUT /users/me/consents`.
- **Privacy**: `GET/PUT /users/me/mention-privacy`, `/users/me/message-privacy`, internal `GET /internal/accounts/{id}/contact-privacy`; private profile stays on `PATCH /users/me`.
- **Chat reports** (go-trust, port 8106): `POST /reports` (evidence + SHA-256 hash verified over the compacted array as sent, 5 per hour, idempotency key), `GET /reports/me`, admin queue (child safety first), detail with transcript, actions wired to the user actions (per-action permission, step-up for ban / remove group / legal), `report.closed` outcome event, evidence retention (default 180 / legal hold 730 days, purge job).
- **Notification directory** (users): internal recipient, audience, count and marketing-unsubscribe endpoints; `otp.issued` (delivery mode `AUTH_OTP_DELIVERY=event`), `signIn.newDeviceDetected`, `account.deletionExecuted.finalEmail`.

Differences from `apps/admin/apiContract.md` and the mobile mocks (the BFF must adapt):

1. Lists are `{data, nextCursor}` (some also carry `items`), not `{items,page,pageSize,total}`; user lists in go-trust and users use cursors.
2. Staff ids, role ids and case ids are UUIDs (templates have stable UUIDs plus `isTemplate`), not `tpl_*`.
3. Step-up header is `X-Step-Up-Token` (the console sends `X-Admin-Step-Up`); the BFF or gateway must map it.
4. `GET /admin/admins` and the writes need `staff:manage` (not only superadmin); config writes take `value` or `content` and return `{key, value, content, version, ...}` (no `versions` / `restore` endpoints).
5. Staff auth login still answers `{status, challengeToken}` (pre-existing), not `{mfaToken, enrollmentRequired}`; passkeys, `/admin/account/*`, warn, force-logout and PII reveal are not built.
6. `UserDetail`: wallet is empty, strikes empty, `followerCount` is the Python real-follower signal, currency and phoneMasked are null; `status` filter on `GET /admin/users` is not implemented; checkmark document previews and `checks[]` on `/admin/verifications` are empty; `grantsDashboardAccess` is always false.
7. Admin-created BUSINESS / BRAND / GOVERNMENT accounts are single-profile accounts typed by `profileType`.
8. ~~`GET /reports/me` lists chat reports only~~ **Done (§2.19):** `GET /reports/me` merges chat and content reports (`kind: chat|content`), newest first. `POST /verification/applications` returns `checkoutUrl: null` (billing is go-money).
9. Not done: `428 POLICY_ACCEPTANCE_REQUIRED` enforcement (needs a gateway or shared middleware), `PENDING_WITHDRAWALS` check on delete (interface `PendingWithdrawalChecker` exists, no go-money client yet), email-domain allow-list is empty unless `ADMIN_ALLOWED_EMAIL_DOMAINS` is set, `checkmark.suggested` emails (no scheduler), enforcement of restrictions inside other services (they read `users.account_restrictions`).
10. The old hand-written `20261003120000_move_creator_to_personal_profile_status` migration was replaced by the Atlas migration `add_creator_status_to_profiles` plus the hand-written data move; databases that applied the old version must be reset (`pnpm backend:reset`).

### 2.17 Built so far: go-commerce (catalog, inventory, orders)

Done (unit tests, plus integration tests that skip without Postgres): everything below. Lists are `{data,nextCursor}`; seller routes read `X-Seller-Store` and enforce the role permissions from `rolePermissions.config.ts`.

- **catalog**: `POST /stores` (linked to a business profile), `GET /stores/{id}`, `/seller/access`, `/seller/stores/mine`, `PATCH /seller/store`; flexible category tree (platform) plus per-store categories; brands; products with variants, SKUs, attributes, videos, visibility, drafts and scheduled publishing (sweep); seller products CRUD, publish/unpublish, usage, bulk, duplicate, barcodes, CSV export; buyer mart (`/mart/home`, `/products`, `/products/featured`, `/products/{id}`, likes, bookmarks, `/categories`, `/brands`, store products); reviews (verified purchases only), ratings, seller replies and reports; `POST /analytics/product-interactions` (consent honoured, outbox events `product.*`); internal `GET /internal/share-cards/{kind}/{id}`.
- **inventory**: locations, levels, summary, movements, adjustments, transfers, suppliers, reorder levels; reservations with expiry (reserve, confirm, fulfil, release, restock) behind the in-process `commerceports` ports.
- **orders**: seller-grouped cart with shipping quotes, one-transaction checkout (orders + order groups + stock reservation) then `RegisterCheckoutPayables`, order group state machine with timeline and seller notes, buyer orders, cancel and confirm-receipt, seller orders/fulfilment/delivery, shipping profiles/zones/destinations/rules (geo ids from go-identity) recomputed at order creation with an immutable snapshot, seller-funded store credit (earn on completion, reverse on refund, redeem at checkout, liability summary), promotions (coupon, automatic, scheduled sale) applied at checkout, returns, customers read model, report JSON/CSV and export jobs. Money events (`escrow.held`, `escrow.released`, `escrow.refunded`, `dispute.opened|closed`, `directPayment.received`) arrive on the `commerce-domain-events` queue (`ORDERS_EVENTS_QUEUE`).
- **Plan gating**: Pro/Business features answer `402 PLAN_FEATURE_REQUIRED {requiredPlan}` using go-money `GET /api/v1/internal/entitlements/{ownerAccountId}` (expects `{ "sellerPlan": "free|pro|business" }`, header `x-internal-token`; fails closed to Free). Active product and location caps return 409.
- **Not built yet**: customer segments, CSV product import, media upload sessions, ClickHouse analytics module. (Seller disputes, flash sales, bundles and featured products: **done in the 4 Oct integration pass, §2.19**.)
- **Needs go-money**: a refund RPC or consumer for `orderGroup.refundRequested` (payload documented in `services/contracts/events/schemas/orderGroup.refundRequested.v1.json`).

### 2.16 Consolidation notes (go-live, go-money, gateway)

- **go-live money**: go-live calls go-money's `LiveMoneyService` over internal gRPC (`LIVE_MONEY_GRPC_ADDRESS`, bearer `LIVE_MONEY_GRPC_TOKEN`, per-attempt timeout `LIVE_MONEY_CALL_TIMEOUT`, retry on `UNAVAILABLE` only for idempotent calls). The in-memory fake exists only outside production; production refuses to start without the addresses and 32+ character tokens. Names and creator-program roles come from go-identity's `AccountDirectoryService` (`LIVE_ACCOUNT_DIRECTORY_GRPC_ADDRESS`, served by auth on `AUTH_ACCOUNT_DIRECTORY_GRPC_ADDRESS`).
- **Mobile change (go-live lists)**: `GET /lives/suggested` and `GET /lives/:id/viewers` now return `{data, nextCursor}` instead of a bare array. `live.service.ts` `fetchSuggestedLives` and `liveGuests.service.ts` `searchLiveViewersToInvite` (and their mocks in `live.mock.ts` / `liveGuests.mock.ts`) must read `.data`; `nextCursor` is always `null` for now.
- **Gateway**: `GET /orders/{id}/escrow`, `POST /orders/{id}/disputes` and the staff `GET /admin/orders/{id}/escrow`, `POST /admin/orders/{id}/escrow/refund` are routed to go-money (the route table accepts `*` for one path segment). Payment provider webhooks go through the gateway's raw-body passthrough route to go-money only (`docs/architecture/devops.md` 6.1).
- **Money settings**: go-money reads `gift.shareTiers` and the new `escrow.policy` (`autoReleaseDays` 3, `sellerCreditHoldHours` 24, `sellerReserveBps` 0) from the admin settings store through the read-only grant on `admin.platform_settings`, cached for `MONEY_PLATFORM_SETTINGS_TTL` (30 s). Env (`ESCROW_INSPECTION_PERIOD`, `SELLER_CREDIT_HOLD_PERIOD`) and the creator-tier table remain the fallback when the store is unreachable or the row is missing. The gift share is the higher of the creator's staff-granted tier and the admin tier reached by the creator's gift coins this month, capped at 7000 bps. `sellerReserveBps` is read and editable but nothing applies a reserve yet.

### 2.18 Built so far: go-commerce (catalog, inventory, orders)

Built in `services/go/modules/{catalog,inventory,orders}` (ent + Atlas, schemas `catalog`, `inventory`, `orders`), mounted by `deployables/goCommerce` (`pnpm backend:dev:commerce`, :8107). Modules talk through `platform/commerceports` (in-process ports), never each other's packages. Checkout is a saga, not one transaction: price and group server-side, reserve stock per order group (idempotent by group id, expiry), persist checkout + groups, register payables over `CheckoutMoneyService`, release on failure or expiry. Commerce is provider-neutral: it only knows go-money.

- **Done (**✅ built, go-commerce**):** GET /mart/home, /products (+featured, :id), like/bookmark, /categories, /brands, /stores/:id[/products|/reviews], reviews (GET/POST, rating-summary, store reviews), POST /analytics/product-interactions (consent-gated outbox), cart (GET/DELETE, items CRUD, shipping-quote), POST /orders/checkout, GET /orders[/:id], cancel, confirm-receipt, GET /store-rewards/me, internal GET /internal/share-cards/{product|store}/{id}.
- **Seller:** access, store create/update, categories, products (CRUD, publish, bulk, duplicate, barcodes, usage, export), inventory (levels, summary, locations, movements, reorder, adjustments, transfers), suppliers, locations, orders (accept/reject/status/fulfilment/cancel/notes/shipping-snapshot), delivery (summary, shipments, attempts), shipping profile/rules/preview, customers (list, summary, detail, purchases, notes, export), reviews, store rewards (summary, settings), reports (6 kinds, CSV, export jobs).
- **Differences from the mocks:** lists are `{data,nextCursor}` (featured too); `Order` adds `fulfilmentStatus` and `checkoutId`, buyer `status` collapses new/processing/ready to `paid` and refunded/returned to `cancelled`; checkout returns `orderGroups` and `orders`; ids replace size/color on cart add (size+color still accepted); levels sort supports id/onHand/reserved only; adjustments never allow negative on hand; inventory emits `order_released` movements; reorder-levels returns the three fields, not the variant; plan gating (402) is not enforced here; product import, returns/disputes seller endpoints, promotions, segments, manual customers, delivery areas, tax and finance reports are not built.
- **Gap for go-money:** seller reject/cancel of a paid order records `orderGroup.refundRequested` (outbox) because `CheckoutMoneyService` has no refund RPC. go-money must consume it (or add a RefundOrderEscrow RPC).
- **Events:** consumes `escrow.held`, `directPayment.received`, `escrow.released`, `escrow.refunded`, `escrow.partiallyRefunded`, `dispute.opened`, `dispute.closed` from RabbitMQ queue `commerce-domain-events` (`ORDERS_EVENTS_QUEUE`). Publishes the new `product.*`, `store.*`, `review.*`, `order.*`, `orderGroup.*`, `storeCredit.*`, `stock.*`, `reservation.*`, `transfer.*` events (schemas in `contracts/events`).

### 2.19 Integration pass (4 Oct): cross-service gaps closed

Unit-tested per module (Go `-short`, vitest, pytest); integration suites need the compose stack and were not run here.

- **Search sources ✅** `GET /api/v1/internal/search-sources/{collection}/{id}` (`X-Internal-Token`, 404 = tombstone): `users` in goIdentity (`USERS_INTERNAL_API_TOKEN`), `stores|products|categories|brands` in goCommerce catalog (`CATALOG_INTERNAL_API_TOKEN`; brands live in the catalog, which is where the search client already points), `posts|sounds` in social. Shapes match `services/typescript/search/src/interfaces/sourceHydrator.interface.ts` (products also carry `saveCount`, posts `saveCount`).
- **Moderation previews ✅** `GET /api/v1/internal/moderation/targets/{type}/{id}` → `{ownerId,title,text,mediaUrls,soundTitle,createdAt}`: social (post, clip, comment, sound), catalog (product, store), go-live (live).
- **`content.visibilityChanged` consumers ✅** catalog (`catalog-domain-events`: `moderation_visibility` on products/stores, hidden items drop out of listings, detail, share cards and checkout; emits `product.updated`/`store.updated`), go-live (`live-domain-events`: hidden/removed ends the live, suggestions filter it), social (`social-domain-events`: posts/clips/stories/comments get `moderationVisibility`, sounds map to `available|removed`; emits `post.updated`/`sound.updated`, search reindexes on `post.updated`).
- **Trust ✅** WARN_AUTHOR (content) and WARN_USER (chat) call goIdentity `POST /internal/enforcement/actions` with `action: warn`, which audits and emits `account.warned` (notifications: in-app + push).
- **Intelligence ✅** `post.created` (now carries `text`, `mediaIds`) and `media.processed` feed `ContentScoringService`; scores go to the `intelligence-trust-content-scores` job queue in the go-trust contract (`contentScore.generated` schema, advisory only). Image moderation is a pluggable `ImageModerationModel` with a deterministic no-signal placeholder (never blocks); media frame scoring calls `POST /v1/moderation/classify-image`.
- **Media swaps ✅** social consumes `media.processed` / `media.rejected`: post, clip, story and chat media get `status` (`processing|ready|failed`) and the URLs built from `MEDIA_PUBLIC_BASE_URL` + variant keys. Live share cards: social calls `/api/v1/internal/share-cards/live/{id}`, which go-live serves (verified); the commerce share-card guard now accepts `X-Internal-Token` (it only read `Authorization: Bearer`, so social's calls were refused).
- **Save counts ✅** posts/clips/videos return `saveCount` + `isSaved` (false for guests) in every post view and feed, kept in step inside the save/unsave transaction; product saves are counted in `social.save_counters` and exposed at `GET /api/v1/internal/save-counts?type=product&ids=` (catalog adds them to product search sources and share cards). Existing saves are not backfilled (counts start at 0).
- **Ads sources ✅** social `GET /api/v1/internal/ad-sources/content` (boostable posts/clips with `eligible`/`ineligibleReason`), `/internal/audience-sources/accounts/{id}/followers|engagers?source=any_post|clips_watched|messaged`; commerce `/internal/audience-sources/stores/{id}/purchasers` (orders) and `/visitors` (catalog `store_visitors`, recorded only from personalized interactions). Every list is `{data,nextCursor}` and keeps only accounts with `personalized_ads` on. go-ads now uses `X-Internal-Token` (`SOCIAL_INTERNAL_URL/TOKEN`, `COMMERCE_INTERNAL_URL/TOKEN`) instead of the unused HMAC scheme.
- **Commerce marketing ✅** `/seller/marketing/flash-sales` (CRUD, pause/resume/end, 7-day cap, stock caps enforced under row lock at checkout), `/seller/marketing/bundles`, `/seller/marketing/featured-products` (≤12, ≤4 mart), all Pro (`advanced_promotions`, 402 on Free). Checkout applies the best flash price per line, then bundles on the remaining units, on top of the chosen promotion; redemptions recorded in `orders.campaign_redemptions`.
- **Seller disputes ✅** go-money serves store-scoped `GET/POST /api/v1/internal/stores/{storeId}/disputes[/{id}[/responses]]` (`MONEY_INTERNAL_API_TOKEN`); goCommerce exposes `/api/v1/seller/disputes*` behind store permissions (`orders:view`, `orders:manage` + Idempotency-Key) and relays (`ORDERS_MONEY_INTERNAL_URL`). Responses are go-money's `DisputeDto`, not yet the seller contract's `OrderDispute` shape.
- **Consistency ✅** topology adds `identity-domain-events` (entitlements; goIdentity consumed it with no queue), `catalog-domain-events`, `live-domain-events`, `social-domain-events`, `post.updated` → search, `media.processed` → intelligence; `definitions.json` regenerated. `.env.example` files and Terraform (`infra/aws/modules/platform/wiring.tf`, search service added, go-ads secret renamed to `ADS_INTERNAL_SHARED_SECRET`) carry every internal URL, token and queue. Gateway routes `/seller/marketing/`, `/seller/promotions`, `/seller/disputes` to commerce; `/internal/` stays unroutable.
- **Still open:** marketing overview/product-options endpoints, flash-sale prices in the cart quote (applied at checkout only), `live_viewers` and `saved_products` ad engagement sources, image scoring for media processed before its post exists, the seller `OrderDispute` mapping.

### 2.20 Built so far: ts.support (Help Centre and tickets)

`services/typescript/support`, port 8111, Prisma schema `support` (role `svc_support`), Zudojs layout. Design and rules: [plans.md §44](./plans.md).

| Area | Endpoints | Notes |
| --- | --- | --- |
| Public help (guest) | `GET /api/v1/help/categories`, `GET /api/v1/help/categories/{slug}`, `GET /api/v1/help/topics?q&category&limit`, `GET /api/v1/help/topics/{slug}` | Published topics only; merged topics answer with their target and `redirectedFromSlug` |
| Votes (auth) | `POST /api/v1/help/topics/{topicId}/votes { helpful }` | One vote per account, changeable |
| Tickets (auth) | `GET/POST /api/v1/support/tickets`, `GET /api/v1/support/tickets/unread-count`, `GET /api/v1/support/tickets/{id}`, `POST …/{id}/messages`, `POST …/{id}/read`, `POST …/{id}/rating` | `Idempotency-Key` on create; user statuses `open, awaiting_you, awaiting_support, resolved, closed` |
| Admin tickets | `/api/v1/admin/support/tickets*`, `/agents`, `/chats*`, `/macros*` | Contract in apps/admin/apiContract.md |
| Admin help CMS | `/api/v1/admin/help/categories*`, `/topics*` (publish, unpublish, merge), `/auto-topics`, `/settings` | `support:helpContent` to write |
| Internal | `POST /internal/support/auto-faq/run` | `x-internal-token` |

Events published: `ticket.created`, `ticket.replied`, `ticket.resolved` (consumed by notifications). Consumed: `account.deletionExecuted` (queue `support-domain-events`). Outbound: identity internal API (requester name, masked email, staff audit entries) and intelligence `POST /v1/help/answer-drafts` (HMAC; receives only scrubbed text).

## 3. Wiring order

Each phase ends with the frontends for that domain running against the real gateway in a staging environment.

### 3.0 How a frontend switches off mocks, one domain at a time

Today each app has one global switch (`EXPO_PUBLIC_USE_MOCKS`, `WEBAPP_USE_MOCKS`, `STUDIO_USE_MOCKS`, `SELLER_USE_MOCKS`, `ADS_USE_MOCKS`, `ADMIN_USE_MOCKS`). That forces all-or-nothing. Add a second variable per app, `*_REAL_API_PREFIXES` (comma-separated path prefixes, for example `/api/v1/auth,/api/v1/users`). The mock resolver (`apps/mobile/src/mocks/index.ts`, `apps/*/src/mocks/dispatch.mock.ts`, `apps/seller|ads|admin/src/server/*ApiTransport.service.ts`) sends a request upstream when its path matches a listed prefix, even while mocks are on. Each phase below lists the prefixes it adds. Mock mode stays the product default (plans §9); production builds set the global flag off.

### Phase 0 — Foundation (the foundation agent is doing this now)

- **Infra:** ECS/Fargate cluster, one Aurora PostgreSQL + PostGIS cluster (schema per owner, read-only grants), ElastiCache Redis, Amazon MQ for RabbitMQ (cluster, private subnets; quorum queues with retry queues and DLQs), S3 + CloudFront, Secrets Manager/KMS, SES, ECR, GitHub Actions deploys, OpenTelemetry collector.
- **Services:** `ts.gateway` with a route table, JWKS verification, rate limiting, idempotency store (Redis + Postgres), request id, and region/currency headers. A shared transactional outbox + `DomainEventPublisher`/`JobQueue` interface per language (RabbitMQ adapters now, SNS/SQS kept behind `EVENT_BUS=sqs` for rollback). Event naming: `<domain>.<entity>.<event>.v1`.
- **Acceptance:** `GET /health` through the gateway, an end-to-end trace visible across gateway → stub service, and a CI pipeline that enforces the 300-line limit (`scripts/checkFileLength`) and a no-raw-SQL lint.

### Phase 1 — Auth and session

- **Endpoints:** §2.1 (all), `GET /users/me` (minimal).
- **Models:** `User`, `Credential` (argon2id), `Session`, `RefreshToken` (hashed, family id), `OneTimeCode` (hashed, 5 min, 5 tries), `SigningKey` (rotating, JWKS), `SocialIdentity`.
- **Infra:** SES for OTP email; Redis rate-limit buckets (login/OTP/reset stricter); KMS-held signing keys.
- **Frontend switch:** prefixes `/api/v1/auth`, `/api/v1/users/me`, `/api/v1/topics` in mobile, webapp, studio, seller, ads. Add `/auth/google|apple` to the Studio mock.
- **Acceptance:** sign up → OTP → login → refresh rotation → **reuse of an old refresh token revokes the family**; 15-minute access expiry; no account enumeration in responses; webapp BFF cookie refresh path works (`/bff/auth/access-refresh`).

### Phase 2 — Users and profiles

- **Endpoints:** §2.2 (profile, settings, addresses, topics, usernames, follows, blocks, locale, acting profiles, brands read).
- **Models:** `Profile` (personal/brand/store), `UsernameChange/Hold/Reserved`, `Address` (+`countryCode`), `Profile.isPrivate`, `Follow` (state none|requested|accepted|rejected|blocked, §4.5.3), `Block`, `UserSettings`, `Topic`, `UserTopic`, `Country`, `ExchangeRate`.
- **Infra:** go.currency rate refresh job; ts.search indexing of people (OpenSearch).
- **Frontend switch:** `/api/v1/users`, `/api/v1/locale`, `/api/v1/search/people`, `/api/v1/brands`.
- **Acceptance:** username change rate limit; reserved and confusable names blocked; viewer currency resolved from profile → IP → `X-Client-Region` → USD fallback; badges come only from the server.

### Phase 3 — Feed, posts and media uploads

- **Endpoints:** §2.3, §2.4.
- **Decision for the audience debt:** extend the server enum to `audience: everyone | followers` (followers-only posts are a real feature and cheap with the follow graph), and keep `visibility: public | subscribers` as the separate subscriber gate (plans §5.4). Mobile then ships the Subscribers chip by sending `visibility: "subscribers"`. **[CONFIRM]**
- **Models:** `Post` (`kind post|clip|story`, `resharedFrom`, `audience`, `visibility`, `isAiGenerated`), `Comment` (threaded), `Reaction`, `Sound`, `Story`, `MediaAsset`, `UploadSession`, `UploadChunk`, `FeedTimeline` (Redis), `PostImpressionDaily` (ClickHouse).
- **Infra:** S3 multipart, MediaConvert or FFmpeg workers on Fargate (driven by the `jobs-media` queue) (HLS H.264, AVIF/WebP, poster frames, thumbnail job per plans §5.5), CloudFront signed URLs, py.intelligence `/v1/feed/rank` with a deterministic fallback, `post.created` on `zudomart.events` → fan-out worker queue.
- **Frontend switch:** `/api/v1/feeds`, `/api/v1/posts`, `/api/v1/comments`, `/api/v1/clips`, `/api/v1/stories`, `/api/v1/sounds`, `/api/v1/media`. Fix the mobile list unwrap before enabling.
- **Acceptance:** a clip needs exactly one video (`assertMediaFitsPostKind`); up to 10 media per post; a reshare creates a post that embeds the original; analytics return 403 for non-owners; an upload resumes after app kill; the following feed shows only followed authors.

### Phase 4 — Messaging and realtime

- **Endpoints:** §2.5, plus `POST /realtime/tickets`.
- **Models:** `Conversation`, `ConversationMember`, `Message` (+`clientMessageId`), `MessageReaction`, `Channel`, `ChannelSubscription`, `DeviceToken`, `Notification`.
- **Infra:** Phoenix on Fargate (libcluster via ECS service discovery), Redis-backed presence, RabbitMQ consumer, APNs/FCM via ts.notifications.
- **Frontend switch:** `/api/v1/conversations`, `/api/v1/messages`, `/api/v1/channels`, `/api/v1/notifications`, plus the real `/ws` (turn off `realtimeMockEmitter.service.ts`).
- **Acceptance:** message delivered over socket in < 300 ms p95 in-region; typing expires after 3 s; reconnect with backoff replays missed messages via `GET …/messages?after=`; offline queue replays with the same `Idempotency-Key` without duplicates.

### Phase 5 — Coins, gifts, creators, live

- **Endpoints:** §2.6, §2.7, and the new §4.1 + §4.2 contracts.
- **Models:** `CoinPack` (per-currency prices), `CoinPurchase`, ledger accounts for coins, `Gift` (DB, not a constant), `GiftTransaction`, `GiftGoal`, `LiveSession` (+category, state, media fields), `LiveGuestSlot`, `LiveBattle`, `LiveBattleParticipant`, `LiveBattleSettlement`, `OverlayScene`, `CreatorEarning`, `CreatorApplication`, `CreatorSubscriptionPlan/Subscription`.
- **Infra:** LiveKit (rooms, Ingress for RTMP/WHIP, Egress for HLS), Redis sorted sets for leaderboards and combos, Phoenix `live:*` topics.
- **Frontend switch:** `/api/v1/coins`, `/api/v1/gifts`, `/api/v1/tips`, `/api/v1/lives`, `/api/v1/creators`, `/api/v1/creator-subscriptions`, `/api/v1/overlay-scenes`.
- **Acceptance:** §4.1.10 and §4.2.9.

### Phase 6 — Commerce: products, cart, orders, escrow, payments, payouts

- **Endpoints:** §2.8.
- **Models:** `Store`, `Product`, `ProductVariant` (SKU, options), `StockLevel`, `StockReservation`, `Cart`, `Checkout`, `Order`, `OrderItem`, `OrderEvent` (timeline), `Payment`, `WebhookEvent`, `Escrow`, `Dispute`, `DisputeMessage`, `PayoutAccount` (encrypted, masked), `Withdrawal`, ledger accounts.
- **Infra:** Paystack only (https://paystack.com/docs; Bachs and Anchor dropped, owner 2026-10-03) behind provider interfaces: checkout (card, bank transfer, USSD) with dynamic split, subaccounts, transfer recipients, transfers, refunds, disputes, plans and subscriptions, webhooks verified with `x-paystack-signature` (HMAC-SHA512). Zudomart holds as little as possible: direct shares never touch Zudomart; escrow is the only money held (E2) until Paystack confirms E1. Details: `docs/checkoutPaymentFlowPlan.md`, `docs/integrations/paystack.md`. Escrow auto-release scheduler (3 days after delivery, dispute pauses); daily reconciliation against Paystack; py.intelligence `/v1/risk/score` for orders and payouts.
- **Checkout transaction (inside `go-commerce` + `go-money`):** recompute prices, seller grouping, shipping (§4.6), discounts and eligibility on the server → reserve stock (TTL 15 min) → create Checkout/Orders with a locked exchange rate → initialise payment → on verified webhook: mark paid, hold in escrow, commit the reservation → seller fulfils → buyer confirms or auto-release after N days → release escrow minus commission → seller wallet.
- **Frontend switch:** `/api/v1/mart`, `/api/v1/products`, `/api/v1/categories`, `/api/v1/stores`, `/api/v1/search`, `/api/v1/cart`, `/api/v1/orders`, `/api/v1/payments`, `/api/v1/disputes`, `/api/v1/wallets`, `/api/v1/banks`.
- **Acceptance:** client-sent prices ignored; double-submitting checkout with the same key returns the same orders; webhook replay is processed once; concurrent withdrawals cannot overdraw (row lock + version); ledger trial balance = 0 per currency after the e2e suite; escrow release, refunds and payouts are written to the audit log.

### Phase 7 — Seller dashboard

- **Endpoints:** §2.9 minus POS, plus §4.3.
- **Frontend switch:** `/api/v1/seller/*` in `apps/seller` (`SELLER_USE_MOCKS` + prefixes). Delete POS mocks and pages first.
- **Acceptance:** §4.3.17.

### Phase 8 — Ads

- **Endpoints:** §2.10.
- **Infra:** Ad Decision Engine + attribution pipeline (§4.4), spend counters in Redis with periodic ledger postings, py pCTR/fraud scores, creator pool revenue share.
- **Acceptance:** charge price never exceeds the bid; per-currency budgets; spend order is credits → prepaid → card; creator share credited per impression batch.

#### Phase 8 status (go-ads)
Built in `services/go/modules/ads`: accounts/members/invites/activity, campaigns/ad sets/ads/bulk/appeal, admin review + advertisers + frequency policies, boosts (wallet debit via the `AdsMoneyService` contract in `services/contracts/proto/zudomart/money/v1/ads_money.proto`, refund on failed save, in-memory fake refused in production), decide + signed-token events, settlement and creator pools, reports + CSV + server-rendered PDF, scheduled reports (due sweep -> `jobs-ads-reports` RabbitMQ job -> CSV/PDF in S3 -> `adReport.ready` event for notifications to email), saved audiences (hashed email lists matched in go-auth data, only matched user ids stored, lookalikes, ranges only), audience estimates, content sources (social internal API), creative media upload intents (S3 presigned, `adMedia.uploaded` event, `/internal/v1/ads/media/:id/processed` callback), billing overview and internal funds credit (`POST /internal/v1/ads/accounts/:id/funds`).
Creator revenue multipliers are read from the admin `monetization.policy` setting (AI-generated default 0.30 of the normal creator share); go-ads has no policy table of its own. Python is called on `/v1/ads/predicted-ctr` and `/v1/risk/score-extended` (`ad_click`) with a timeout and deterministic fallback.
Open items: phone-hash customer lists (needs go-auth hashing details), engagement/store/follower audience sources (social/commerce membership APIs; audiences end `failed` until wired), social `ad-content-sources` endpoint, go-money implementing `AdsMoneyService`, media pipeline consuming `adMedia.uploaded`, notifications template for `adReport.ready`, conversion-event/experiment/rule tools, invoices/receipts, top-up checkout.

### Phase 9 — Admin

- **Endpoints:** §2.11.
- **Acceptance:** MFA required; step-up for every money and role action; four-eyes on appeals; config writes need `expectedVersion` + `reason`; audit export works.

### Phase 10 — Intelligence

Turn on the remaining py.intelligence calls (risk for gifts/coins/payouts, social proof, account/clip recommendations, experiments, audio fingerprinting) behind circuit breakers with deterministic fallbacks. **Acceptance:** each caller degrades gracefully when intelligence returns 503; event delivery is deduped by `eventId`.

---

## 4. New features that need backend design

Mock-mode frontends for these are being built in parallel. The contracts below are what those mocks should converge on. Field names follow existing conventions (camelCase, `Money`, integer coins, cursor pages).

### 4.1 TikTok-style live gifts

> **Built in go-live (3 Oct 2026).** `POST /live/gifts` validates (live active, gift active, quantity 1-100, receiver on stage, 10 gifts/s per sender), then calls go-money `ChargeGiftAndCreditCreator` with the client `Idempotency-Key`; go-live stores **no money row**. The `GiftTransaction` lives in go-money. go-live keeps the catalogue (`gifts`, seeded with the mobile 26), goals (`gift_goals`), combos (`gift_combos`, 3 s window, Postgres not Redis), and read models fed from the charge response (`gift_contributions`, `goal_contributions`, points, session counters) behind a `processed_gifts` inbox so replays never double-apply. Events `gift.sent`, `goal.progressed|completed`, `leaderboard.updated` go through the outbox; `gift.combo.*` is not emitted (the combo count rides on `gift.sent`).

**Stack and why**

| Concern | Stack | Why |
| --- | --- | --- |
| Gift catalogue, send, combos, splits, ledger | **Go, `go-money`** (go.creators.gifts + go.ledger + go.wallet) | The coin debit, platform credit and creator credit commit in **one Postgres transaction** with row locks. No cross-service money saga |
| Live room membership and gift eligibility | **Go, `go-live`** (gRPC read: is the session live, is the target on stage) | Owns live state |
| Fan-out of gift animations, combo banners and leaderboards to every viewer | **Elixir, `ex.realtime`** | Room broadcast to tens of thousands of sockets; Phoenix PubSub across nodes |
| Leaderboards and combo windows | **Redis** sorted sets / keys with TTL | Sub-millisecond increments; durable totals come from Postgres |
| Animation assets | **S3 + CloudFront** | Transparent-video and Lottie/PAG assets with immutable URLs |
| Fraud | **py.intelligence `/v1/risk/score`** (async, subject `gift`) | Advisory only; never blocks the hot path synchronously above a 50 ms budget |

**4.1.0 Flow (owner spec)**

```
client ─POST /api/v1/live/gifts─► ts.gateway ─► go-money (go.creators.gifts)
   validate: live is active (gRPC go-live), recipient on stage, gift isActive, wallet balance
   one DB transaction: debit sender coins → balanced ledger entry → GiftTransaction row → outbox row
outbox publisher ─► RabbitMQ `zudomart.events` key `gift.sent` ─► consumer quorum queues
   ├─► ex.realtime: fan-out over WebSocket to streamer + all viewers (combos, goals, leaderboards)
   └─► python analytics (Postgres read model now, ClickHouse later), py.intelligence (risk, ranking signals)
```

**Phoenix never touches money.** It only reads events and pushes them.

**4.1.1 Gift config (`Gift`) is separate from `GiftTransaction`**

The catalogue is admin data. A transaction stores only `giftId` plus the **prices and split it was charged at**. No name, asset or tier is copied into transactions.

```
Gift { id, name, description, tier: basic|premium|legendary, priceCoins,
       animationEngine: alphaVideo|lottie|pag|spriteSheet, animationAssetKey, previewAssetKey,
       durationMs, displayLevel: micro|medium|large|global, sound?: assetKey, haptic?: light|medium|heavy|pattern,
       comboable, isActive, sortOrder, metadata (JSON: regionCodes, availableFrom/Until, event tags) }

GiftTransaction { id, senderUserId, receiverUserId, liveId, battleId?, giftId, quantity,
                  unitPriceCoins, totalCoins, platformFee, creatorAmount, currency: "COIN",
                  status: committed|heldForReview|reversed, idempotencyKey, ledgerTransactionId, createdAt }
```

- `displayLevel`: `micro` = side combo banner; `medium` = larger banner; `large` = transparent full-screen in this room; `global` = full-screen plus a platform-wide marquee/notification (rare, legendary gifts).
- **Catalogue:** `GET /api/v1/gifts` returns active gifts, cached with an `ETag`. Clients cache it and **resolve assets by key**: `https://cdn…/gifts/{assetKey}/{variant}`, with variants HEVC-alpha MP4 (iOS), VP9-alpha WebM (Android/web) and Lottie/PAG.
- **New gifts need no app release.** An admin creates the gift (`/api/v1/admin/gifts` CRUD) and uploads the assets through media purpose `gift_animation` to S3/CloudFront. A client that sees an unknown `animationAssetKey` downloads it in the background. Until the download finishes, or if it fails, the client falls back to `previewAssetKey` (a static image) in a micro banner. Clients prefetch `large`/`global` assets when the catalogue changes.
- The `apps/gift/*.mp4` files were rejected as final art and are placeholders only.

**4.1.2 Send a gift**

`POST /api/v1/live/gifts` with header `Idempotency-Key` (required). The existing `POST /api/v1/lives/:liveId/gifts` (mobile today) stays as an alias until mobile moves.

```json
{ "liveId": "live_…", "giftId": "gift_rose", "quantity": 1, "receiverUserId": "usr_…", "comboId": "cmb_…" }
```

- `receiverUserId` is optional. It defaults to the host. In a multi-guest room it must be a streamer currently **on stage** (§4.2).
- `quantity` is 1–100 (the picker offers ×1/5/10/50/100). A combo tap burst is batched client-side every ≤300 ms into one request.
- `comboId` is generated by the client on the first tap of a streak and reused while taps continue. The server attaches the active battle itself (clients never pick a `battleId`).
- Response `201`:

```json
{ "giftTransactionId": "gt_…", "giftId": "gift_rose", "quantity": 5, "totalCoins": 5,
  "receiverUserId": "usr_…", "comboId": "cmb_…", "comboCount": 23,
  "coinBalance": 1180, "battleId": "btl_…", "createdAt": "…" }
```

- Errors: `402 INSUFFICIENT_COINS` (with `coinBalance`), `409 LIVE_NOT_ACTIVE`, `422 RECIPIENT_NOT_ON_STAGE`, `422 RECIPIENT_CANNOT_RECEIVE_GIFTS`, `422 CANNOT_GIFT_SELF`, `429 GIFT_RATE_LIMITED`.
- Post gifts (`POST /posts/:id/gifts`) and tips (`POST /tips`) reuse the same engine without combos or battles.

**4.1.3 Combo streaks**

- The server keeps `combo:{liveId}:{senderId}:{comboId}` in Redis with `count`, `giftId`, `receiverUserId` and a **3 s sliding TTL**. A request after expiry, or for a different gift/recipient, starts a new combo (the server returns a new `comboCount` from 1, and the client rotates `comboId`).
- Combos are presentation only. Every request is its own idempotent ledger posting.

**4.1.4 Leaderboards / top gifters**

- Redis sorted sets: `lb:live:{liveId}` (session), `lb:live:{liveId}:recipient:{userId}` (per streamer on stage), `lb:battle:{battleId}:{userId}`, `lb:creator:{creatorId}:week`.
- `GET /api/v1/lives/:liveId/leaderboard?scope=session|recipient&receiverUserId=&limit=20` → `{ data: [{ rank, user{id,name,username,avatarUrl}, coins }], viewerRank? }`.
- On `live.ended`, final standings are written to Postgres (`LiveGiftLeaderboardEntry`) and feed Studio's `earnings.topGifters`.

**4.1.5 Creator split**

- Platform cut is configurable: `live_gift_platform_cut_bps`, default 3000, which gives **the creator 70%**. "Up to 70%" means creator tiers may get less: `creatorGiftShareBps` comes from a `CreatorTier` table (e.g. starter 5000, partner 6000, top 7000) and is **capped at 7000**. Admin edits it under `/admin/config/revenue`.
- The share is computed in **whole coins, rounding down for the creator**, with the remainder to the platform (`splitCoinsByBasisPoints` in `apps/api/src/modules/coins/services/coinLedger.service.ts`).
- Earned coins convert to cash through `POST /creators/earnings/convert` (cash value per coin per currency, minimum payout).

**4.1.6 Ledger entries (double entry, unit `COIN`)**

Accounts: `user:{id}:coins` (spendable, purchased), `creator:{id}:earnedCoins`, `platform:giftRevenue`, `live:battle:{battleId}:holding:{userId}` (battles only, §4.2.7).

Gift of 100 coins to a creator with a 70% share, no battle:

| Account | Debit | Credit |
| --- | --- | --- |
| `user:{sender}:coins` | 100 | |
| `creator:{recipient}:earnedCoins` | | 70 |
| `platform:giftRevenue` | | 30 |

- One `LedgerTransaction` per gift send, `reference = gift:{liveId}:{senderId}:{idempotencyKey}` (unique), all lines in one DB transaction.
- The sender's coin balance is read with `SELECT … FOR UPDATE` semantics via Go's `pgx` transaction (Go services are outside the TS Prisma rule but still use parameterised queries only) and a version check. A balance can never go negative.
- After commit, an outbox row produces `money.gift.sent.v1`.

**4.1.7 Realtime events (topic `live:{liveId}`)**

| Event | Payload (key fields) | Notes |
| --- | --- | --- |
| `gift.sent` | `giftTransactionId, giftId, animationAssetKey, displayLevel, quantity, totalCoins, sender{id,name,avatarUrl}, receiverUserId, comboId, comboCount, battleId?` | **Keys only, no asset URLs or config blobs.** Clients render from their cached catalogue (fallback in §4.1.1) |
| `gift.combo.updated` / `gift.combo.ended` | `comboId, count, sender, giftId` | Aggregated by realtime: at most 4 updates/s per combo. Ended fires when the 3 s window expires |
| `gift.goal.progress` / `gift.goal.completed` | `goalId, title, targetCoins, progressCoins, topContributors[≤3]` | Progress is throttled to 1/s; completed fires exactly once |
| `leaderboard.updated` | `scope: live\|stream\|recipient, top[≤5]{userId,coins}` | Throttled to 1/s per scope |
| `live.topSupporter` | `liveId, user, coins` | Sent on `live.ended` |
| `live.viewerCount` | `viewers` | Throttled to 1 per 2 s |
| `live.comment.created` | `LiveComment` (kind `comment\|joined\|gift\|system`) | Replaces polling `GET /comments` |

Transport order is not relied on (retries and redeliveries reorder): the producer stamps `comboCount`/`aggregateVersion` and Phoenix stamps `seq` per topic (see `docs/architecture/events.md` 4.1).

**4.1.8 Gift goals, leaderboards, Top Supporter**

- **Goals:** `POST /api/v1/lives/:liveId/gift-goals {title, targetCoins, giftId?}` (host; one active goal at a time), `PATCH …/:goalId {title?, targetCoins?}`, `DELETE`. `GiftGoal { id, liveId, creatorId, title, targetCoins, giftId?, progressCoins, status: active|completed|cancelled, completedAt }`. go-money updates progress in the same transaction as the gift (so progress always matches money) and emits `gift.goal.progress` / `gift.goal.completed` through the outbox.
- **Leaderboards:** "live" = the current session (Redis `lb:live:{liveId}`). "Per-stream" = the stored final board of each past stream. Per-creator weekly/all-time boards come from ClickHouse. Ties rank by who reached the total first.
- **Top Supporter:** on `live.ended`, go-live reads the final board, stores `LiveSession.topSupporterUserId` and emits `live.topSupporter`. The live-ended screen and the Studio earnings panel show it.

**4.1.9 Creator gift analytics — where they live**

- Metrics: revenue by gift, top supporters over time, average gift value, revenue per stream, peak gifting periods (heatmap by minute-of-stream and hour-of-week), goal completion rate, battle results.
- **Home: Studio** (`studio.zudomart.com`, `/analytics/gifts`), because creators are often not sellers. Mobile Creator Studio shows a summary card. The seller dashboard gets a **Live** section only for stores whose members stream, linking live sales and gift revenue for that store's lives.
- **Store:** Postgres read model (replica) at launch, moving to ClickHouse fed from `money.gift.sent.v1` once volume needs it. Columnar storage is justified here: per-gift, per-minute aggregates over every stream are a columnar workload, and the same pipeline serves seller analytics (§4.3). Endpoints are served by the Go `reporting` module: `GET /api/v1/creators/me/analytics/gifts?from&to&granularity`, `…/supporters`, `…/streams/:liveId`. The ledger remains the source of truth for amounts; ClickHouse is for reporting only.

**4.1.10 Acceptance**

- Replaying the same `Idempotency-Key` returns the same `giftTransactionId` and charges once.
- Adding a gift in admin shows it in clients without an app release. An unknown asset key falls back to the preview image.
- A goal completes exactly once.
- 1,000 concurrent sends from one wallet never overdraw it.
- Every viewer sees `gift.sent` < 500 ms p95 after the 201.
- Ledger sums: `Σ debits = Σ credits` per transaction, and `platform + creator = coins`.
- The host cannot gift themselves. Gifts to an ended live are rejected.

- **Adopted from the mobile mock (plans §17):** `GET /api/v1/live/{liveId}/gift-goals` lists goals; the host gets a stream-stats response (`giftCount`, `coinsReceived`, `earnings: { amountMinor, currency }`, `topSupporters`, `recentGifts`); the `gift.sent` event also carries `liveId` and `type`.

### 4.2 Multi-guest live and battles

**Stack and why**

| Concern | Stack | Why |
| --- | --- | --- |
| Guest slots, battle state machine, timers, settlement trigger | **Go, `go-live`** | Authoritative state with Postgres persistence; timers via a Redis-backed scheduler (or a Postgres `due_at` poller) so a pod restart cannot lose a battle end |
| Settlement money movement | **Go, `go-money`** (gRPC `settleLiveBattle(battleId)`, idempotent) | Same transaction rules as gifts |
| Media: up to 10 publishers, many viewers | **LiveKit SFU** | WebRTC simulcast, per-track mute, server-side participant removal, Ingress (RTMP/WHIP for OBS/Studio) and Egress (composite → LL-HLS on CloudFront for large audiences). Chosen over mediasoup because it is a complete server with a token model, Kubernetes deployment and managed-cloud option, so we write no media code |
| Score fan-out, stage layout, invites | **Elixir, `ex.realtime`** | Room broadcast + private `user:{id}` topic for invites |
| Abuse signals | **py.intelligence** risk on settlement and on gift bursts | Advisory |

**4.2.1 Roles and limits**

- Stage = host + up to **9 guests (10 streamers max)**. Only Creator Program members can host (existing rule).
- **Decided:** anyone invited can join the stage and battle. Only Creator Program members are **paid out** for gifts. A gift (or battle holding) for a non-member settles to the **host**.
- Viewers watch through LiveKit (up to ~a few hundred) or HLS Egress (beyond that, switched automatically at a configurable threshold).

**4.2.2 Guest slot state machine**

```
invited ──accept──► joining ──media connected──► onStage ──leave──► left
   │                   │ (timeout 30 s)              │ host remove ► removed
   ├──decline──► declined    └──► failed             │ disconnect ► reconnecting ─(≤30 s)─► onStage
   └──expire (60 s)──► expired                       │                    └─(timeout)─► left
   └──host cancel──► cancelled                       host mute/unmute toggles flags (audioMutedByHost, videoMutedByHost)
```

**4.2.3 Endpoints** (`go-live`, all `Idempotency-Key` optional except where marked)

| Method + path | Who | Body → response |
| --- | --- | --- |
| POST /lives/:id/guests/invitations | host | `{userId}` → `GuestSlot` (409 `STAGE_FULL`, 422 `USER_NOT_FOLLOWING_OR_BLOCKED`) |
| DELETE /lives/:id/guests/invitations/:slotId | host | cancel |
| POST /lives/:id/guests/invitations/:slotId/accept, /decline | invitee | → `GuestSlot` + `{livekit:{url,token}}` on accept |
| POST /lives/:id/guests/:userId/remove | host | `{reason?}` (LiveKit `RemoveParticipant`) |
| POST /lives/:id/guests/:userId/mute | host | `{audio?:bool, video?:bool}` (LiveKit `MutePublishedTrack`; guest cannot unmute a host-mute) |
| POST /lives/:id/guests/me/leave | guest | |
| GET /lives/:id/stage | anyone | `{ layout:"grid\|spotlight\|battle", streamers:[{slotId,user,role:"host\|guest",state,audioMuted,videoMuted,giftEligible,position}] }` |
| POST /lives/:id/media-token | host/guest/viewer | → `{url, token, canPublish}` (short-lived LiveKit JWT) |

`GuestSlot = { id, liveId, user{…}, state, invitedAt, joinedAt?, leftAt?, audioMutedByHost, videoMutedByHost, position }`.

**4.2.4 Battle state machine**

```
            create (host)                 all accepted / start                timer
  ┌──────► pending ───────────────► countdown(3 s) ──► active ──────────────► ended ──► settling ──► settled
  │          │ participant declines (WTA) / host cancels          │ host ends live / all opponents gone ┘
  │          └──► cancelled                                        └──► ended (reason: hostEndedLive|forfeit)
```

- **Create:** `POST /lives/:id/battles` `{ participantUserIds: [2..10 on-stage streamers incl. host or not], durationSeconds: 60..600 (default 300), winnerTakesAll: false (default) }` with `Idempotency-Key` required. Only one battle per live at a time. Returns `Battle`.
- **Consent (decided):** when `winnerTakesAll = true`, every on-stage participant must accept: `POST /battles/:id/accept|decline` (15 s timeout = decline → `cancelled`). With the default rule, participants are notified and no acceptance is required.
- **Visibility:** the rule (`winnerTakesAll`) is shown to all viewers **before** the first gift is accepted, and it cannot change after `countdown`.
- **Cancel (pending only):** `POST /battles/:id/cancel` (host).
- **Early end:** `POST /battles/:id/end` (host). The battle settles at current scores (see edge cases).
- `GET /battles/:id` → `Battle = { id, liveId, state, winnerTakesAll, durationSeconds, startsAt, endsAt, participants:[{userId, user, score, rank, state:"active|left|forfeited"}], winnerUserIds:[], endReason? }`.

**Scores.** Score = gross coins gifted to a participant during `active`, by gifts whose server-side `battleId` matches. Real-time scores come from Redis counters (`HINCRBY battle:{id}:scores`) updated after the ledger commit. **The final score is recomputed from Postgres `GiftTransaction` rows** at settlement, and Redis is never trusted for money.

**4.2.5 Realtime events (topic `live:{liveId}`; invites on `user:{userId}`)**

| Event | Payload |
| --- | --- |
| `guest.invited` (private) | `slotId, live{id,title,host}, expiresAt` |
| `guest.joined`, `guest.left`, `guest.removed`, `guest.muted`, `guest.reconnecting` | `slotId, userId, state, audioMuted, videoMuted, reason?` |
| `stage.updated` | full `stage` snapshot (sent on every change and on subscribe) |
| `battle.created` | `Battle` (pending) |
| `battle.started` | `battleId, startsAt, endsAt, winnerTakesAll, participants` |
| `battle.score.updated` | `battleId, scores:[{userId, score}], topGifters:{[userId]: [{userId,coins}×3]}` (throttled to 2/s) |
| `battle.ended` | `battleId, endReason, finalScores, winnerUserIds, isTie` |
| `battle.winner.celebrated` | `battleId, winnerUserIds, mvpGifter{userId,coins}, animationAssetId` (clients run the winner praise: crown, confetti, banner "{name} wins!") |
| `battle.settled` | `battleId, transfers:[{fromUserId,toUserId,coins}]` (only when WTA moved coins) |
| `battle.cancelled` | `battleId, reason` |

**4.2.6 Shared `LiveSessionDto`** (fixes mismatch 4)

`{ id, host, title, category, state: idle|connecting|live|ended, visibility, startedAt, endedAt, viewers, peakViewers, coverUrl, playbackUrl (HLS), media:{ livekitUrl } , ingestUrl?, streamKey? (host only), giftsEnabled, hostIsCreator, isFollowingHost, products[], pinnedProductId, stage, activeBattle?, earnings? (host only: coins, giftCount, newSubscribers, topGifters, battles[]) }`. Mobile's `status` maps to `state`.

**4.2.7 Settlement in the ledger**

During a battle, the creator share of each gift goes to a holding account instead of straight to the recipient. The platform cut is taken immediately, as for any gift.

Gift of 100 coins to participant B during battle X (70% share):

| Account | Debit | Credit |
| --- | --- | --- |
| `user:{viewer}:coins` | 100 | |
| `platform:giftRevenue` | | 30 |
| `live:battle:X:holding:B` | | 70 |

At settlement, `go-money` runs `settleLiveBattleAndPostLedgerEntries(battleId)` once, keyed by `battle-settle:{battleId}`:

- **Default (each keeps own):** for each participant P, debit `holding:P`, credit `creator:P:earnedCoins` by the full holding.
- **Winner takes all, single winner W:** debit every `holding:P` and credit `creator:W:earnedCoins` with the total. `battle.settled.transfers` lists the coins that moved from each loser to W.
- **WTA tie (decided):** WTA is void; **every participant keeps their own holding**, exactly as with the default rule.
- **Holdings are never refunded to viewers.** A viewer's coin spend is final the moment the gift commits.
- `LiveBattleSettlement { battleId, rule, finalScores, transfers, ledgerTransactionId, settledAt }` is written to the audit log.

**4.2.8 Edge cases**

| Case | Rule |
| --- | --- |
| Guest leaves voluntarily during `active` | Participant state becomes `forfeited`. They cannot win. Default rule: their holding is still paid to them. WTA: their holding goes to the eventual winner. Gifts targeting them are rejected (`RECIPIENT_NOT_ON_STAGE`) |
| Host removes a participant mid-battle | Same as forfeit. **Anti-abuse:** in WTA, the host cannot be the beneficiary of a removal they made, so a removed participant keeps their own holding |
| Streamer disconnects | `reconnecting` for up to 30 s. The battle timer keeps running and gifts to them are still accepted. After 30 s they are treated as left (forfeit) |
| Host ends the live mid-battle | The battle ends with `endReason: hostEndedLive` and settles at current scores, with the chosen rule. This stops a losing host from escaping WTA by ending the stream. Settlement runs even though the room closed |
| Only one non-forfeited participant remains | The battle ends early. That participant wins |
| Battle ends with all scores 0 | No winner. Nothing to settle. `battle.ended.isTie = true` |
| Gift in flight at `endsAt` | The gift's DB commit time decides: committed before `endsAt` counts, after does not (the gift is still a normal gift to the recipient) |
| Duplicate settlement trigger (pod restart, retry) | Idempotent on `battle-settle:{battleId}`; second call returns the stored settlement |
| Self-dealing (participant's alt accounts gifting) | py.intelligence risk on `gift` subjects. High risk → settlement **holds** in `settling` for admin review (`/admin/battles/:id`). Coins still never return to viewers; admin may void a WTA transfer (each keeps own) |
| Recipient not in the Creator Program | Gift accepted; the creator share settles to the host (§4.2.1) |
| Battle created while a participant is muted by host | Allowed. Mute does not affect scoring |

**4.2.9 Acceptance**

- 10 streamers publish and 1,000 synthetic viewers subscribe in staging without dropped tracks. Host remove/mute takes effect in < 1 s.
- A battle with WTA moves exactly the losers' holdings to the winner. The trial balance stays 0. No viewer balance increases at settlement.
- Killing the `go-live` pod mid-battle still ends and settles the battle on time (±2 s).
- Every edge case in §4.2.8 has an integration test.

### 4.3 Seller dashboard (`dashboard.zudomart.com`) — the seller operating system

"App = sell from anywhere, Dashboard = run your business." Online orders are the same marketplace orders placed in the Zudomart apps. There is **no in-store POS**.

**Stack and why**

| Concern | Stack | Why |
| --- | --- | --- |
| Products, variants, inventory, orders, returns, promotions, customers, staff, settings | **Go**: `go-commerce` (catalog, inventory, orders) + `go-money` (wallet, payouts, escrow, subscriptions) | Stock reservation and order writes are transactional; pricing must match checkout exactly |
| Analytics, dashboards, report rows | Aurora read replica first; **ClickHouse** later, fed from outbox events by the Python analytics pipeline, served by a small Go `reporting` module (read-only) | Date-range aggregates over orders, items, traffic and ad spend across many stores are columnar workloads; running them on Aurora would hurt checkout. **Justified once there are more than a few thousand orders per day or once traffic analytics exist. Until then the same API can read Aurora replicas** |
| Exports (CSV, Excel, PDF), bulk import | **Python worker** (`python.dataPipelines.businessReports`) writing to S3, signed download URL | pandas/openpyxl/WeasyPrint are mature; long jobs stay off the request path |
| Webhooks to sellers, API keys | **ts.integrations** (webhooks, partnerApis) | Already in the JSON |
| Messages | **ex.realtime** (same conversations as mobile chat) | One inbox |

**4.3.1 Access rule (owner decision, 3 Oct)**

- **Any approved seller can use the dashboard on the Free plan.** Access requires: an authenticated Zudomart user, an `approved` seller application, and membership of the store (owner or staff). It is **not** tied to Gold verification or a paid subscription.
- Free / Pro / Business **only gate features and limits**. Basic selling (list products, receive and fulfil orders, get paid, chat with buyers, see reviews) is **never locked**.
- **Gold comes with Pro/Business once the business is verified (KYB).** Paying alone does not show the badge; KYB alone on Free does not either. The badge (gold check beside the store name) is removed when the paid plan lapses or KYB is revoked. "Official Store" still requires a **registered brand** on top of that.
- Server check, replacing `SellerAccessService.assertStoreHasActiveSellerAccess`: `assertUserIsApprovedSellerMemberOfStore(userId, storeId)` then `assertStorePlanIncludesFeature(storeId, featureKey)` only for gated features (403 `PLAN_FEATURE_REQUIRED` with `{feature, requiredPlan}`), then `assertStoreRoleHasPermission(userId, storeId, permission)`.
- `GET /seller/access` → `{ storeId, storeName, role, permissions[], plan:{ key:"FREE|PRO|BUSINESS", status, currentPeriodEnd, autoRenew }, entitlements:{…}, verification:{ status, color, tier } }`. There is no `hasSellerToolsAccess` gate. The seller frontend `sellerAccessDestination.util.ts` stops redirecting to `billing`.

**4.3.2 Plan tiers and feature gating** (limits admin-configurable; **[CONFIRM limits]**)

Prices live in a `SellerPlanPrice { planKey, countryCode, currency, interval, amountMinor }` table. Nigeria: **Free ₦0, Pro ₦5,000/month (`500000` NGN minor), Business ₦15,000/month (`1500000`)**. Admin prices other countries; no price is hardcoded.

| Feature | Free | Pro | Business |
| --- | --- | --- | --- |
| Gold business checkmark (after KYB) | — | ✓ | ✓ |
| Products, orders, fulfilment, payouts, messages, reviews | ✓ | ✓ | ✓ |
| Product limit | 100 | 2,000 | unlimited |
| Variants / SKUs per product | 10 | 100 | 250 |
| Staff seats (besides owner) | 1 | 5 | 25 |
| Stock locations / warehouses | 1 | 3 | 20 |
| Bulk import/export (CSV) | export only | ✓ | ✓ + Excel |
| Inventory: adjustments, movements, reorder levels | ✓ basic | ✓ + suppliers, transfers | ✓ + purchase orders |
| Analytics date range | 30 days | 12 months | 36 months + compare |
| Reports export | CSV | CSV, Excel | CSV, Excel, PDF, scheduled email |
| Marketing: discount codes | 3 active | unlimited | unlimited |
| Flash sales, bundles | — | ✓ | ✓ |
| Customers CRM (notes, segments, export) | view | ✓ | ✓ + segments |
| Storefront customisation | theme | + sections, custom domain later | + multiple storefronts |
| API keys and webhooks | — | — | ✓ |
| Commission on products | 0% | 0% | 0% |
| Escrow fee (seller pays, on escrow orders incl. shipping) | 1.5% | 1.5% | 1% |
| Monthly ad credit | — | ₦1,000 | ₦5,000 |

Entitlement keys are strings (`products.max`, `staff.seats`, `locations.max`, `reports.formats`, `marketing.flashSales`, `api.access`, …) stored per plan (`SellerPlanEntitlement`) and edited in admin `/admin/config/plans` under the **seller plans** group.

**4.3.3 Overview metrics** — `GET /seller/dashboard?from&to&locationId?`

`{ revenue: Money, orders, averageOrderValue: Money, unitsSold, conversionRate, visitors, escrowHeld: Money, availableBalance: Money, ordersByStatus:{…}, lowStockCount, topProducts[≤5], salesSeries:[{date, revenue, orders}], compareToPrevious:{…} }`. Money is in the **store currency**. Multi-currency stores show a per-currency array.

**4.3.4 Products, variants, SKUs, bulk import/export**

- `Product { id, storeId, title, description, categoryId, brand?, status: draft|active|archived, media[], options:[{name,values[]}], variants[], tags[], seo{…} }`.
- `Variant { id, sku, barcode?, optionValues{}, price: Money, compareAtPrice?, costPrice? (private), weightGrams?, trackInventory, stockByLocation[] }`.
- Endpoints: as in `apps/seller/apiContract.md` §products (CRUD, publish/unpublish, bulk actions, barcodes). Import: `POST /seller/products/imports` (multipart CSV/XLSX → job) → `GET /seller/products/imports/:id` (rows ok/failed with row errors). Export: `POST /seller/exports {kind:"products"}` → job (§4.3.13).

**4.3.5 Inventory**

- Models: `StockLocation` (warehouse/shop/pickup point), `StockLevel { variantId, locationId, onHand, reserved, reorderLevel, reorderQuantity }`, `StockMovement { type: received|sale|reservation|release|adjustment|transferOut|transferIn|returned|damaged, quantity, reference, actorUserId }` (append-only), `Supplier`, `PurchaseOrder` (Business; receive into a location), `StockTransfer`.
- `available = onHand − reserved`. Checkout reserves; fulfilment commits; cancellation releases. Low-stock alerts when `available ≤ reorderLevel` → notification + `inventory.lowStock` webhook.
- Endpoints: `/seller/inventory/levels`, `/adjustments`, `/movements`, `/transfers` (+receive/cancel), `/locations`, `/suppliers`, `/purchase-orders` (+receive).

**4.3.6 Order lifecycle with timeline**

```
paid(escrow) → new → processing → ready → shipped → delivered → completed
                 └─► cancelled (refund to buyer from escrow)
delivered/completed ─► returned (return approved + received) ─► refunded
any post-payment state ─► disputed ─► resolved (refund / partial / release)
```

- `pendingPayment` orders are never shown to sellers.
- `OrderEvent { orderId, type, fromStatus, toStatus, actor{type:buyer|seller|staff|system|admin, userId}, note, at }` powers the timeline. Endpoints: `POST /seller/orders/:id/accept` (→processing), `/ready`, `/fulfilment {courier, trackingNumber, locationId}` (→shipped), `/deliver` (seller-confirmed or courier webhook), `/cancel {reason}`; buyer `confirm-receipt` → completed (escrow release); auto-complete after N days.
- Returns: `/seller/returns` approve/decline/receive `{restock, locationId}` → refund via go-money (Idempotency-Key). Disputes: go.escrow.

**4.3.7 Customers CRM** — read model built from orders: `GET /seller/customers?segment&q`, `/:id` (orders, lifetime value, last order, notes, tags), `POST /:id/notes`, `PATCH /:id {tags}`, export. Customers are Zudomart users who bought from the store. Contact details shown are limited to what the order needs (shipping name/phone), per privacy rules.

**4.3.8 Analytics** — `GET /seller/analytics/{sales|products|customers|traffic|marketing}?from&to&granularity=day|week|month&compare=previous|yearAgo` from ClickHouse. Traffic covers product views, store visits, add-to-cart and conversion (events from feed/mart), and live-sourced sales.

**4.3.9 POS removal (contract + frontend cleanup)**

Delete from `apps/seller/apiContract.md`, `apps/seller/src/types`, `src/mocks`, `src/config/rolePermissions.config.ts` and the UI: `/seller/pos/*` (registers, catalog snapshot, shifts, cash movements, sales, refunds-at-register, receipts share, parked sales, discount approvals, pay links), `/seller/staff/pin-roster`, `/pin-sessions`, `/:id/pin`, `/:id/unlock-pin`, the `X-Seller-Operator` header, the `cashier` role, `pos:*` permissions, the `shifts` and register-based report kinds, and the POS settings. The memory note also lists `posRegister`, `posOfflineSaleQueue`, `posDeviceMemory` and `posOfflineStock` code as slated for removal. Promotions lose the `pos` channel.

**4.3.10 Marketing** — `DiscountCode { code, type: percent|fixed|freeShipping, valueBps|amount, minSubtotal, usageLimit, perCustomerLimit, startsAt, endsAt, productIds?, categoryIds? }`, `FlashSale { productVariantIds, priceOverride|percentOff, startsAt, endsAt, stockCap }`, `Bundle { items[{variantId,qty}], price }`. All are applied **server-side at checkout** in the same pricing function as the cart (`calculateCartTotalsInKobo`-style, but currency-agnostic). Endpoints: `/seller/promotions` (codes, automatic, flash sales, bundles), `POST /seller/promotions/validate-code`.

**4.3.11 Ads campaigns** — the dashboard links to go.ads with the store's ad account (`/ads/accounts?storeId=`). Boost-a-product shortcut = go.ads boosts.

**4.3.12 Finance** — `/seller/wallet/balances` (`escrow`, `pending`, `available` per currency), `/transactions`, `/payouts` (owner + finance role, step-up, Idempotency-Key), `/payout-accounts` (encrypted, masked), `/statements?month` (job → PDF/CSV), fees and commission breakdown per order.

**4.3.13 Delivery, messages, storefront, reviews, reports**

- **Delivery:** seller shipping profiles, zones and rules as in §4.6 (`/seller/shipping/*`), plus the tracking number and courier name entered at fulfilment. Carrier integrations come later (ts.integrations.couriers).
- **Messages:** `/seller/conversations` = the store's side of the same conversations mobile buyers use. Staff with `messages:reply` answer as the store.
- **Storefront:** `/seller/storefront` (banner, sections, featured products, theme colours, policies); public read via `GET /stores/slug/:slug`.
- **Reviews:** `/seller/reviews` list and reply (existing review module).
- **Reports export:** `POST /seller/exports { kind: salesByDay|salesByProduct|salesByCategory|inventoryValuation|stockMovements|orders|customers|payouts|tax|statement, from, to, format: csv|xlsx|pdf, locationId? }` → `202 {exportId}` → `GET /seller/exports/:id` → `{status, downloadUrl (S3 signed, 15 min)}`; `export.ready` notification. CSV neutralises formula injection and shows money in major units with the currency in the header. Synchronous `GET /seller/reports/:kind` (JSON) stays for on-screen tables.

**4.3.14 Team members, roles and permissions**

- Staff are **existing Zudomart app users**, added by username search (`GET /seller/zudomart-users?q=`). They accept in the app and sign in with their own app credentials. There are no separate staff accounts and no email-only invites.
- Roles: `owner` (one; transfer by owner only, step-up) · `admin` · `manager` · `inventory` · `fulfilment` (replaces cashier) · `support` · `marketing` · `finance` · `analyst` (read-only).
- Permissions (examples): `products:view|manage`, `inventory:view|manage`, `orders:view|fulfil|cancel|refund`, `customers:view|manage`, `marketing:manage`, `ads:manage`, `analytics:view`, `reports:export`, `wallet:view`, `wallet:withdraw` (owner + finance), `billing:manage` (owner), `staff:manage` (owner + admin), `settings:manage`, `apiKeys:manage`, `messages:reply`, `audit:view`.
- Seats are counted against the plan (`409 SEAT_LIMIT_REACHED`). Role changes, removals and payouts go to the audit log.

**4.3.15 Settings, API keys, webhooks** — store profile, currency (fixed after first sale), taxes, policies, notifications, locations. API keys (Business): `POST /seller/api-keys {name, scopes[]}` returns the secret once, stored as a hash; `DELETE` revokes. Webhooks: `POST /seller/webhooks {url, events[]}`, HMAC-SHA256 signature header `X-Zudomart-Signature`, retries with exponential backoff for 24 h, delivery log `GET /seller/webhooks/:id/deliveries`. Events: `order.created|paid|cancelled|shipped|delivered|completed|refunded`, `inventory.lowStock`, `product.updated`, `payout.paid`, `review.created`.

**4.3.16 Billing for plans** — `GET /seller/subscription/plans` (public, localised prices), `POST /seller/subscription/checkout {planKey, interval}` (Paystack checkout and Paystack Plans on Zudomart's main account, Idempotency-Key), `/verify`, `/cancel`, `/resume`. Downgrade above a limit keeps existing data read-only (e.g. the 101st product becomes unpublished-but-kept) rather than deleting.

**4.3.17 Acceptance**

- A newly approved seller with no subscription and no Gold reaches the dashboard and can list, sell, fulfil and withdraw.
- Gated features return `PLAN_FEATURE_REQUIRED` with the plan that unlocks them.
- A staff member added by username sees only what their role allows; ownership is checked on every resource id.
- Stock never oversells under concurrent checkouts.
- The order timeline shows every transition with its actor.
- A 50k-row export completes as a job and downloads.
- Webhook signatures verify; API keys are shown once.
- No POS route, type or permission remains in `apps/seller`.

### 4.4 Ads system — Ad Decision Engine, placements, revenue sharing

**Core rule: "ZudoMart doesn't pay for views; it shares eligible monetization revenue."** Every percentage below comes from config tables. None is hardcoded.

**Stack:** **Go `go-ads`** owns the Ad Decision Engine, campaigns, budgets, frequency caps and attribution. It is **separate from feed ranking**: the feed reserves slots, and the engine fills or declines them. **Redis** holds caps, pacing and spend counters. **Python** returns pCTR and fraud **scores**; Go applies the deterministic thresholds. **Go `go-money`** posts revenue to pools in the ledger.

**4.4.1 Decision steps** (`decideAdForSlot(slot)`, p99 < 50 ms; if the engine fails, the slot stays empty)

1. **Eligibility:** the user (age, region, not Premium-ad-free, consent), the content (brand-safe, not kids/sensitive, not AI-flagged where an advertiser excludes it), and the creator (monetization-eligible, in good standing, has opted in for the placement).
2. **Frequency caps:** per session, hour and day, per format and per advertiser. Defaults are in `AdFrequencyPolicy`.
3. **Campaign match:** targeting, schedule, remaining budget and pacing.
4. **Expected value:** `bid × pCTR (or completion rate) × quality`. A second-price charge is never above the bid.
5. **UX guard:** minimum gap between ads in the feed, no ads adjacent to each other, session ad load cap, and a cooldown after a skip or hide.

**4.4.2 Placements**

| Placement | Rule | Phase |
| --- | --- | --- |
| Sponsored feed post | Native post shape with an "Ad" label; diversity rules apply | **Launch** |
| Pre-roll / post-roll | Long videos only; skippable after N seconds (config) | **Launch** |
| Shorts ads | **Only between clips**, as a full clip slot. Never inside a clip | **Launch** |
| Mid-roll | Only at natural breaks the creator marks (`VideoAdBreak { videoId, atMs }`, auto-suggested from scene changes) and only on videos above a minimum length | Later (switch) |
| Live ads | **Only if the creator opts in**: per-stream `LiveAdSettings { allowAds, placements: beforeJoin\|naturalBreak\|betweenSegments\|overlay\|end, maxInterruptions 0–3, minIntervalMinutes, showAdIndicator, acceptedTermsVersion, acceptedAt }`. Accepted live-ad terms are stored per stream. The creator's **own sponsorship branding** is allowed (overlays, mentions) and is not sold by ZudoMart | Later (switch) |

Each placement is behind a feature flag (`ads.placement.<name>.enabled`).

**4.4.3 Attribution record and pipeline**

```
AdImpression { id, campaignId, adId, userId, contentId, creatorId?, sessionId, placement,
               startedAt, completedAt?, qualified: bool, revenue { amountMinor, currency },
               fraudStatus: pending|clean|invalid, fraudScore, createdAt }
```

The pipeline runs `raw impression` (client `POST /ads/events`, batched and idempotent on event id) → `fraud filter` (py score + deterministic rules: bots, duplicate sessions, view-time floor) → `qualified` (meets the placement's view or completion rule) → `revenue attribution` (charge from the auction, in the advertiser currency, converted at the locked daily rate) → split into the **creator pool** and the **platform pool** using the monetization policy. Invalid impressions are not charged and earn nothing.

**4.4.4 Monetization policy and pools**

- `MonetizationPolicy { key, revenueSource: ads|premium|gifts|subscriptions, contentType, creatorShareBps, multiplier, effectiveFrom, effectiveTo }`. Example: AI-generated content uses `multiplier = 0.30` **applied to the normal creator share** (normal 40% → 12%). **Confirmed by owner 2026-10-03.**
- The **ad creator pool** credits each creator's share of their qualified impressions daily (`creator:{id}:adEarnings` in the ledger), paid out with normal earnings.
- **Premium pool:** Premium subscriber revenue (ad-free, net of store/provider fees) goes into a **separate monthly Premium creator pool**, allocated by Premium members' consumption (qualified watch time per creator / total). It is never mixed with the ad pool.
- **Creator dashboard** (Studio + mobile Creator Studio): estimated ad revenue, qualified impressions, your share, Premium allocation, and per-content breakdown. **Raw advertiser bids and CPMs are never shown.** Estimates are labelled "estimated" until the month closes.

**4.4.5 Launch scope:** sponsored feed, pre-roll, post-roll, Shorts feed ads, attribution, frequency caps, fraud filtering and basic revenue share. Mid-roll and live ads ship later as switches.

### 4.5 ZudoPoints and social graph

> **Creator = personal account upgrade (owner, 2026-10-03).** A creator account is the user's personal account turned into a creator account, not a separate profile. Profile types are Personal, Business/Brand and Government; `creatorStatus` (`none|pending|approved|rejected`) lives on the Personal profile and is set to `approved` when the Creator Program application is approved. It unlocks Creator Studio, going live, monetisation and earnings. Blue applies to the Personal profile whether or not it is creator-enabled.

> **Live part built in go-live (3 Oct 2026).** `points_entries` / `points_rules` live in the `live` schema (not a separate `points` schema). Like points cap at 10/min per user via the `like` rule (`perMinuteCap`), share/follow once per live, watch once a minute; gifts award `support` points to the sender and `stream` points to the receiver (1 per coin, rules `gift`/`giftReceived`). Per-stream boards are stored at `live.ended`; `GET /rankings` aggregates on demand (no hourly rebuild yet); the country scope uses `X-Client-Region` captured when the live starts. Profiles, social graph and follow awards from the users service are not part of this batch.

**4.5.1 ZudoPoints** (Go `points` schema; Redis for rate limits and live boards)

- **Points are not money.** They are never withdrawable, transferable or convertible to coins or cash, and they live outside the money ledger in their own append-only `PointsEntry { userId, type: engagement|support|stream|community|achievement, amount, sourceType, sourceId, streamId?, categoryId?, idempotencyKey, createdAt }`.
- **Sources:** money actions (gifts, coin purchases, subscriptions, orders) award `support` points proportional to coins or amount via the `PointsRule` table. Engagement actions also earn points: double-tap like, share, follow, watch time, challenges, goals.
- **Per-user rate limits:** e.g. at most **10 qualifying like-points per minute**. Visual likes stay unlimited; only the points stop. Daily caps per action and dedupe (unlike/re-like earns nothing) are set in `PointsRule { action, points, perMinuteCap, perDayCap, active }`.
- Points are awarded by consuming domain events (RabbitMQ), so they never slow the action itself.
- **Leaderboards:** each stream has a supporter board by points (Redis during the live, stored in Postgres at `live.ended` and **kept for history**). There are global, country and category rankings for streamers, supporters, creators and engagement, rebuilt hourly from `PointsEntry`. `GET /api/v1/rankings?board=streamer|supporter|creator|engagement&scope=global|country|category&countryCode&categoryId&period=day|week|month|all`.
- **Categories** form an admin-managed, multi-level taxonomy (`Category { id, parentId, kind, name, slug, active }`) shared by lives, creators and businesses.

**4.5.2 Profiles: one account, many profiles** (Go `accounts` schema)

- `Profile { id, accountId, type: personal|business, creatorStatus: none|pending|approved|rejected, handle, displayName, … }`. Every account has one personal profile. Users switch profile with `PUT /users/me/acting-profile` and never create a new account.
- **Creator account:** the personal account is upgraded once requirements are met (`creatorStatus` on the personal profile, no new profile). The thresholds (followers, account age, original posts, no recent strikes) live in `CreatorEligibilityRule`, admin-configurable. This is the existing Creator Program gate.
- **Business profile:** for any organization, not only sellers (brands, NGOs, media, venues). It has flexible multi-level categories (several allowed, plus custom ones pending admin review). A business can later open a store. Business verification (KYB) plus a Pro or Business plan gives the Gold checkmark (§4.3.1).

**4.5.3 Content flags and privacy**

- **AI-generated content:** `Post.isAiGenerated: bool`, set by the author with a default prompt on upload. Python can flag a post as likely AI and the policy then decides whether to label it. Clients show an **"AI generated"** label. The flag drives the ads monetization multiplier (§4.4.4).
- **Private profiles:** `isPrivate` on the profile. The relationship is `Follow { followerId, followeeProfileId, state: none|requested|accepted|rejected|blocked }`. Endpoints: `POST /users/:id/follow` → `requested` when the profile is private, `GET /users/me/follow-requests`, `POST /follow-requests/:id/accept|reject`. Posts from a private profile are visible only to `accepted` followers. Blocking overrides every other state.
- **Followers and following lists** are searchable (`GET /users/:id/followers?q=`), and private profiles' lists are visible only to accepted followers. Later: a "who can see my followers/following" setting.

### 4.6 Shipping and cart (go-commerce)

**For the MVP there is no ZudoMart logistics network.** Sellers ship. ZudoMart validates, calculates, shows and records.

**4.6.1 Models** (`marketplace` / `orders` schemas)

```
ShippingProfile     { id, storeId, name, isDefault, active }
ShippingZone        { id, profileId, name, active }
ShippingDestination { id, zoneId, countryCode, regionId?, adminAreaId? }   (country, then state, then LGA, using normalized geo IDs)
ShippingRule        { id, zoneId, feePerOrderGroup: Money, isFree, freeShippingThreshold?: Money, active }
ShippingMethod      { … }   (later: standard/express, carriers DHL/UPS/local)
ShippingCalculation { id, orderGroupId, profileId, zoneId, ruleId, destination snapshot, subtotal, fee: Money,
                      freeReason?: freeDestination|threshold, calculatedAt }   (immutable snapshot on the order group)
```

- Sellers set destinations at country, region or LGA level, a fee per order group, free destinations, a free-shipping threshold, and active/inactive. No price is hardcoded. All amounts are `{amountMinor, currency}` in the store currency. The most specific matching destination wins (LGA, then state, then country). If nothing matches, the destination is ineligible.
- Addresses and geo reference data (normalized IDs, per-country address structure, Nigeria states and LGAs) are owned by **users (go-identity)**. go-commerce reads them through read-only grants or the users API.

**4.6.2 Cart grouped by seller**

```
Cart { groups: [{ storeId, store{name,badge}, items[], subtotal, shipping: { status: calculated|needsAddress|notDeliverable, fee?, message? },
                  discounts, fees, taxes, total }],
       grandTotal, currency }
```

- **Shipping is charged per seller order group, never per item.**
- One checkout creates **one order group per seller** (today's `Order` per store). Escrow, settlement, refunds, partial cancellation, commissions and taxes all key off the order group.
- Before payment, checkout shows items, shipping, discounts, fees, taxes and total for each group, plus the grand total.
  - No address yet: `needsAddress` with the message *"Enter your delivery address to calculate shipping"*.
  - Ineligible destination: `notDeliverable` with *"This seller does not currently ship to your selected location"*. **Only that group is blocked.** The buyer can remove it or change the address and check out the rest.
- **The server recomputes everything at order creation:** prices, seller IDs, grouping, totals, shipping eligibility and fees, discounts and consent flags. Client values are ignored. A `ShippingCalculation` snapshot is stored on each order group.
- Endpoints: `GET /cart` (grouped), `POST /cart/shipping-quote {addressId}`, `POST /orders/checkout`. For sellers: `/seller/shipping/profiles|zones|destinations|rules` (CRUD), plus `GET /geo/countries/:code/regions` and `/regions/:id/admin-areas` (users service).

**4.6.3 Product interaction events and ranking**

- Events use the `<entity>.<pastTense>` naming: `product.viewed|searched|clicked|liked|shared|saved|addedToCart|removedFromCart|purchased`, `seller.viewed`, `category.viewed`, `search.performed`. Each carries actor, product/seller/category, session, surface and `occurredAt`, and goes through the outbox to RabbitMQ, then Python (and analytics).
- The **MVP uses deterministic ranking** for mart, search and related products: `relevance + recency + popularity + availability (in stock, ships to the viewer) + the viewer's own interactions`, with weights in config. It sits behind a `ProductRankingStrategy` interface that the Python ranker can replace later (with a fallback to deterministic).
- **Personalization consent is honoured:** without `personalization` consent (§4.7), ranking ignores the viewer's interaction history and events are kept only in aggregated, non-personal form.

### 4.7 Privacy and data protection

Built to support **GDPR where it applies and Nigeria's NDPA 2023**. The plan **never claims compliance**. **Counsel review is required** before launch for the policies, retention periods and transfer mechanisms.

- **Privacy by design and data minimization.** A `DataCategoryRegister` (doc + table) lists each data category (identity, contact, KYB, payments/bank, location, content, messages, interactions, device) with its purpose, legal basis, owning service, retention policy key and processors. A field with no documented purpose is not collected.
- **Consent:**
  - `UserConsent { userId, type: essential|analytics|personalization|advertising|marketing, granted, policyVersionId, grantedAt, withdrawnAt, ip, userAgent, source }` is append-only, with the latest row winning.
  - Consent is kept **separate from terms acceptance** (`TermsAcceptance { userId, policyVersionId, acceptedAt, ip, userAgent }`).
  - `PolicyVersion { id, kind: terms|privacy|cookie|liveAdTerms|creatorTerms, version, publishedAt, url }` records each policy release.
  - **Consent is enforced on the server:** the analytics pipeline drops events without `analytics` consent, ranking checks `personalization`, the Ad Decision Engine checks `advertising` (otherwise it serves contextual ads only), and messaging checks `marketing`.
- **Privacy & Data settings** (mobile, webapp): consents, private profile, who can message me, and data export / delete account.
  - **Export:** `POST /privacy/exports` → job → a signed S3 link (expires) plus an email notification.
  - **Deletion:** `POST /privacy/deletion` → grace period → anonymization or erasure per category.
  - Ledger, payment, tax and KYB records are **anonymized or retained per their retention policy** rather than deleted.
  - Retention periods live in a configurable `RetentionPolicy { categoryKey, period, action: delete|anonymize|retain }`. **No periods are set in this plan.** Legal sets them.
- **Privacy Policy and Cookie Policy** (essential / analytics / personalization / advertising). The web apps show a **consent banner before any optional cookie or SDK loads** where required. Essential cookies only (session, CSRF) until the user chooses.
- PII stays encrypted at rest (bank, KYB documents) and redacted in logs (§5.10). Python receives only hashed/opaque IDs (existing intelligence contract).

---

## 5. Cross-cutting

### 5.1 Response envelopes

- **Single resource:** the object itself (current `apps/api` behaviour).
- **Cursor list (all user-facing lists):** `{ "data": [...], "nextCursor": string|null, "total"?: number }`.
- **Admin tables:** `{ "data": [...], "page", "pageSize", "total" }`.
- **Errors:** `{ "message", "code", "issues"?: [{path, message}] }`, with HTTP status as today.
- **Frontend fixes:** mobile `apiClient.service.ts` returns the payload untouched when it has a `nextCursor` key, and unwraps `data` only for legacy single-object responses. Ads renames `items` → `data`. Admin renames `items` → `data`. Mobile `GET /notifications` and `GET /orders`, and Studio comments, move to pages.

### 5.2 Money and currency

- Integer minor units + ISO currency everywhere (`int64` in Go, `BigInt` in Prisma, `integer` in Ecto). Coins are integer `COIN`. The two units are never mixed in one ledger transaction except in the conversion and purchase postings, which use a stored rate.
- The server resolves viewer currency: profile country → IP → `X-Client-Region` → USD for unsupported countries (NGN, GHS, KES, ZAR, GBP, EUR, USD supported). Display prices may be converted. **Checkout locks the rate** (`lockOrderExchangeRate`) and charges in a provider-supported currency. Seller stores have one settlement currency.
- Rounding: banker's rounding is never used. Shares round **down** for the payee, and remainders go to the platform, so a split is always exact.
- Balances change only through ledger postings in one DB transaction with row locks + version columns. A nightly trial balance job asserts `Σ debits = Σ credits` per currency and per unit, and reconciliation compares the ledger with Paystack transactions, balance, settlements and transfers. The ledger is the source of truth for what money means; Paystack figures are evidence, and a mismatch freezes the affected payouts.

### 5.3 Idempotency

- `Idempotency-Key` is 8–128 chars `[A-Za-z0-9_-]` on every platform. It is required on checkout, payments, withdrawals, payouts, refunds, escrow release, coin purchase/transfer/convert, gifts, tips, battle create/settle, stock adjustments/transfers, imports and creating payout accounts. It is optional and honoured on other POSTs (follow, like, message).
- Stored per `(scope = principal + route, key)` with a request hash. A different body with the same key returns `422`. In flight returns `409`. A replay returns the stored response with `Idempotent-Replayed: true`. TTL is 24 h, 7 days for money.
- The gateway does a fast Redis check; the owning service enforces it durably in its own DB transaction.

### 5.4 Auth, sessions and authorization

- go.auth issues 15-minute RS256/EdDSA access tokens (JWKS, rotating keys) and opaque refresh tokens: hashed, rotating, with family revocation on reuse. Argon2id passwords. OTPs hashed, 5 min, 5 tries.
- **Web apps:** the BFFs keep tokens in httpOnly `__Host-` cookies with CSRF HMAC (as built). **Mobile:** tokens in the secure store. **Admin:** separate audience, MFA (TOTP/WebAuthn), 5-minute step-up tokens.
- **Realtime:** mobile sends `{type:"auth", accessToken}`; browsers get a 60 s ticket from `POST /realtime/tickets` via the BFF.
- **Authorization:** the gateway checks token validity and coarse scope. Each service checks the fine permission and **resource ownership** (store member for store resources, buyer for own orders/carts/addresses/wallet). Default deny.

### 5.5 Rate limits

| Bucket | Limit (start) |
| --- | --- |
| Global per IP | 600/min |
| Per user | 300/min |
| Login / OTP send / password reset | 5/min and 20/h per identifier + IP |
| Gift send | 20 requests/s per user per live (combos are batched client-side) |
| Live comments | 1/s per user, slow mode configurable by the host |
| Message send | 30/min per conversation |
| Uploads | 20 sessions/h per user |
| Seller exports / imports | 10/h per store |

Redis token buckets at the gateway; `429` with `Retry-After`.

### 5.6 Realtime contract

- One socket: `wss://<api>/ws` speaking today's JSON envelope (`{type, …}`). Phoenix runs it as a raw WebSocket transport, not the Phoenix channel wire format, so mobile `realtime.service.ts` keeps working.
- Added client messages: `{type:"subscribe", topic:"live:{id}"}` and `{type:"unsubscribe", topic}`. The server authorises each topic: conversation member, live visibility, own `user:{id}`.
- Delivery is at-most-once over the socket. Clients recover by REST (`?after=` for messages, `GET /lives/:id` + `/stage` + `/battles/:id` for live state on resubscribe). Every live event carries `seq` per topic so clients can detect gaps.

### 5.7 Audit log

Append-only `AuditEvent { actor, actingAs (store/admin), action, subjectType, subjectId, before?, after?, reason?, ip, userAgent, requestId, at }`. Required for: escrow release, refunds, dispute decisions, payouts, withdrawals, role and staff changes, plan changes, API key issue/revoke, coin reversals, battle settlement holds/voids, admin config changes, username withholds. Store-scoped view for sellers (`/seller/audit-log`), global for admins.

### 5.8 Webhooks

- **Inbound** (Paystack, couriers, LiveKit, App Store/Play): signature verified before parsing, stored in `WebhookEvent` with a unique provider event id, processed at most once, and acknowledged quickly with processing async.
- **Outbound** (seller webhooks, partner APIs): ts.integrations, HMAC-signed, retry with backoff, dead-letter after 24 h, replay from the dashboard.

### 5.9 Background jobs

- **Go:** an outbox publisher to RabbitMQ (`platform/events` `RabbitPublisher`, publisher confirms), plus scheduled jobs (escrow auto-release, battle timers, stock reservation expiry, subscription renewals, payout processing, reconciliation, trial balance) through a Postgres-backed scheduler with leader election.
- **TS:** media processing queue, notification fan-out, search indexing.
- **Python:** ClickHouse loading, reports and exports, thumbnails, moderation classifiers.
- Every consumer is idempotent on the event id. Poison messages go to a DLQ topic with alerting.

### 5.10 Observability

- OpenTelemetry traces from BFF → gateway → services → RabbitMQ (`traceparent` header) → consumers, keyed by `X-Request-Id`.
- Structured JSON logs passed through redaction (no tokens, OTPs, card or bank data).
- Metrics in Prometheus/Grafana (or CloudWatch).
- **SLOs:** auth p99 < 300 ms; feed p95 < 400 ms; gift send p99 < 300 ms and fan-out p95 < 500 ms; checkout availability 99.95%.
- Business alerts: ledger imbalance, webhook failure rate, payout failures, settlement holds, socket count per node.

### 5.11 Testing strategy

- **Unit:** pure domain functions (splits, pricing, state machines) with table tests. Property tests for the ledger: random postings always balance and never go negative.
- **Contract:** each frontend's mock handlers (`apps/*/src/mocks`) are the consumer fixtures. Generate OpenAPI from each service and run a contract check in CI that every mock route has a matching operation with compatible request/response schemas. That turns the §2.13 list into failing checks until it is fixed.
- **Integration:** per service against real Postgres/Redis (Testcontainers) and RabbitMQ (Docker, `infra/local/rabbitmq/definitions.json`), including Paystack test-mode webhooks (`sk_test_` keys) and a LiveKit dev server.
- **End-to-end:** staging scripts for signup → post → follow → chat → buy coins → gift → battle with WTA → checkout → fulfil → confirm → payout, asserting trial balance = 0 at the end.
- **Load:** k6 for checkout and gift bursts; LiveKit load tester for 10 publishers + 1,000 subscribers.
- **Security:** the existing `apps/api/tests/security` cases ported (enumeration, refresh reuse, webhook signature, idempotency conflicts, IDOR on store resources), plus `pnpm audit` / `govulncheck` / `pip-audit` in CI.

---

## 6. Open questions for the owner

**Answered 2026-10-03:**
- Post audience → server accepts `everyone | followers`; subscriber-only stays the separate `visibility` field.
- Live guests → anyone invited can join and battle; only Creator Program members are paid out for gifts (gifts to a non-member settle to the host).
- Winner-takes-all → every on-stage streamer must accept before the battle starts; a tie means everyone keeps their own coins.
- Gift share → admin-configurable tiers up to 70% (e.g. 50% new creators, up to 70% established/verified).

Still open:

1. **Seller plan limits** in §4.3.2 (prices decided: ₦0 / ₦5,000 / ₦15,000 a month in Nigeria).
3. **Ad-account members:** existing Zudomart users only (like seller staff), replacing email invites? (§2.10)
4. **Go deployable grouping** on ECS (§1.2). Coordinate with the foundation agent.
5. **Per-language migration tools** (Atlas / Ecto / Alembic), given the Prisma-only rule covers TS services. (§0)
6. **Gift art:** commission final transparent HEVC/WebM + Lottie assets. Should `star` join the catalogue?
7. **Points rules:** starting point values and caps per action in `PointsRule` (§4.5.1).

## 4.8 Verification checkmarks and billing (owner, 2026-10-03; supersedes earlier checkmark rules)

> **Creator = personal account upgrade (owner, 2026-10-03).** A creator account is the user's personal account turned into a creator account, not a separate profile. Profile types are Personal, Business/Brand and Government; `creatorStatus` (`none|pending|approved|rejected`) lives on the Personal profile and is set to `approved` when the Creator Program application is approved. It unlocks Creator Studio, going live, monetisation and earnings. Blue applies to the Personal profile whether or not it is creator-enabled.

| Profile type | Checkmark | Billing | Where sold |
|---|---|---|---|
| Personal (incl. creator accounts) | Blue only | Personal subscription tied to the person | App (Apple/Google IAP) or web (Paystack) |
| Business, Brand | Gold only | A separate subscription per business/brand profile, with its own invoices and payment method | Web only (Paystack) |
| Government | Black only | ₦50,000/month, invoiced to the agency | Web only (Paystack) |

- **Prices (docs/pricing.md, 2026-10-03; all admin-editable):** Blue Essential ₦1,000, Blue Verified (the checkmark, `checkmark-pricing.blueMonthlyPrice`) ₦2,500 web / ₦2,900 in app, Blue Premium (the Premium user subscription) ₦4,500 web / ₦5,500 in app; seller Free ₦0, Pro ₦5,000, Business ₦15,000; Gold-only ₦3,000; Black ₦50,000. Yearly = 20% off (12 × monthly × 0.8). **0% commission on products.** Escrow fee 1.5% of the seller-group total incl. shipping (1% on Business), paid by the seller and deducted from the payout (`ESCROW_PLATFORM_COMMISSION_BPS=150`); direct payments carry no Zudomart fee, only Paystack processing paid by the seller; buyers pay no fee. Pro ad credit ₦1,000/mo, Business ₦5,000/mo.
- **Regional pricing (owner, 2026-10-04; [pricing.md](./pricing.md)):** every checkmark, Premium, seller plans, coin packs, creator bands, boosts and ad floors are priced per region NG/GH/KE/ZA/GB/EU/US; any other country pays the US price in USD. Region = app storefront (`X-Store-Storefront` + `X-Client-Platform`) > profile country > CDN/IP country > `X-Client-Region` > US (`platform/regionpricing`). The creator ad share (40%) and subscription share (80% of net) are the same everywhere. Headline Blue Verified: ₦2,500 / GH₵30 / KSh 500 / R59.99 / £5.99 / €5.99 / $5.99 (web; app one step higher). **✅ built:** go-money `plan_prices` holds web/iOS/Android monthly+yearly and store product ids per region (migration `20261004120000_regional_plan_prices`, seeded from research, staff edits never overwritten); `GET /api/v1/pricing/{region,plans,creator-subscription-bands}`; coin packs priced in all 7 currencies per channel; web falls back to the US/USD price when Paystack can't charge the region currency (GBP/EUR always; GHS/KES/ZAR until local Paystack accounts exist); go-ads floors/minimum budgets per targeted region converted into the billing currency with `currency.exchange_rate_revisions` (strictest of several regions), auction reserve by viewer region, `GET /api/v1/ads/pricing`, USD `reportingSpend`; admin setting `regional-pricing` (ad floors, boost minimums, creator bands) and the Regional pricing admin page; staff price edits in go-money are written to the admin audit log (`ADMIN_INTERNAL_URL`; refused in production when the audit log is unreachable). **Owner decision (4 Oct):** UK/EU (and GH/KE/ZA until local Paystack accounts exist) web buyers pay the US price in USD, labelled "Billed in USD"; `PAYSTACK_SUPPORTED_CURRENCIES` defaults to `NGN,USD`; with USD off, web checkout returns `422 WEB_CURRENCY_NOT_ENABLED`. go-money reads prices only from the price book (legacy `checkmark-pricing` prices and the admin "Plans & prices" per-currency prices removed). **Ads (research-based, pricing.md §5):** per-region CPM/CPC floors, suggested CPM/CPC/CPV and suggested/minimum daily budgets; `POST /api/v1/ads/pricing/estimate` returns total cost, impressions, reach, clicks, results and cost per result for a budget and duration, split per region in the billing currency with FX notes; boost options carry regional packages with reach. **Open:** Paystack GH/KE/ZA accounts, the native StoreKit/Play Billing module in the mobile app (adapter and server product ids ready), mobile verification plans still read a mocked `/api/v1/verification/plans`.
- Blue and Gold never cross profile types. Gold requires business verification (CAC/KYB) before it shows. Seller Pro (₦5,000) and Business (₦15,000) include Gold.
- **Gold-only plan** for brands and businesses that don't sell: its own lower admin-set price (proposed ₦3,000/month), with the checkmark and brand-page features but no seller dashboard tools.
- **Blue + Gold bundle:** 15% off a Gold subscription when the same verified identity has an active Blue. It doesn't stack with the yearly discount (the bigger one wins), applies to at most 3 businesses per person, and lapses at the business's next renewal if Blue ends. It never applies to Black. The percentage and cap are admin settings.
- **Black: deep vetting and maker-checker.** Black is never suggested or self-serve; it's by application or invite, followed by manual review. Vetting covers:
  - an official letterhead letter signed by an authorised officer;
  - confirmation through an official channel (a published `.gov.ng` domain or official phone line);
  - representative ID plus BVN/NIN and proof of their role;
  - proof the entity exists (official site or gazette).

  Approval needs two different admins with step-up auth, and is audited. Black is re-verified yearly and whenever the representative changes, and revoked immediately on misuse. The handle stays reserved even if the subscription lapses.
- **Web billing on Paystack (Bachs and Anchor dropped; Paystack adopted, owner 2026-10-03):** `POST /payments/subscriptions/checkout` starts a Paystack checkout with a plan code (`PAYSTACK_PLAN_CODES`: dashboard plans, Premium web, Gold/Black business billing); refused from the apps. Trials: a small verification charge (refunded at once) creates the card authorization, then `POST /subscription` with `start_date` = trial end (Paystack documents `start_date` for a free period). Renewals use the authorization Paystack holds; a failed renewal sets status `attention` and `invoice.payment_failed`; the manage link lets the customer update the card. go-money records `billing_subscriptions` and emits `billingSubscription.downgraded` when recovery runs out. **✅ built:** `modules/subscriptions` (plans, per-country price table, trials, reminders, bundle vs yearly, Black grace, IAP, `GET /api/v1/internal/entitlements/{userId}`).
- **Lapsed payment:** Blue and Gold drop at period end. Black gets a 14-day grace period with reminders (admin-editable) before the badge is removed.
- **Admin-granted lifetime checkmarks** bypass billing but still respect the profile-type rule.

- **Username release hold (owner, 2026-10-03):** when a user changes their username, the old one is held for **120 days** (`USERS_USERNAME_QUARANTINE_DAYS`, default 120) before anyone else can claim it. Only an admin username reassignment (audited, permission `users.reassignUsername`) bypasses the hold.


## Store rewards (backend requirements)

> **Seller-funded store rewards (owner, 2026-10-03).** Not platform-funded: Zudomart holds no money for it.

- Per-store credit ledger in **go-commerce** (schema `orders`), never go-money cash. Entries per (store, buyer): `earn`, `reverse`, `redeem`, `expire`. Append-only, idempotent on `(orderGroupId, kind)`.
- Rules per store (`StoreSettings.storeRewards`): `enabled`, `percentBackBasisPoints` (0–2000), `minimumOrder`, `maxPerOrder`, `expiryDays`.
- Earn only when the order completes (after escrow release: consume `order.completed` / `escrow.released`); reverse on `refund.completed`.
- Redeem only at the issuing store as a discount line on a later order (the seller absorbs it; payout is computed on the discounted subtotal). Never withdrawable, never cross-store, never convertible to cash.
- Seller sees outstanding liability (`GET /seller/marketing/rewards/summary`); buyers see balances per store (`GET /store-rewards/me`).

### ts-media status (3 Oct 2026)

Built in `services/typescript/media` (port 8108, Prisma schema `media`, `pnpm backend:dev:media`): `POST/GET/DELETE /api/v1/media/uploads*` (S3 multipart into a quarantine bucket; chunks either proxied with `PUT .../chunks/:i` (raw bytes, `X-Chunk-Sha256`) or sent straight to S3 with `GET .../chunks/:i/url`; resume via `ListParts`), `POST /api/v1/media/uploads/:id/complete` and `POST /api/v1/media/:mediaId/complete`, `GET /api/v1/media/:mediaId`, per-purpose type/size allowlists, magic-byte sniffing, optional ClamAV, moderation gate (Python `/v1/moderation/classify` advisory score, policy allow/hold/reject, `held` assets resolved by `POST /internal/v1/media/:id/review`), sharp AVIF/WebP/JPEG variants with EXIF stripped, ffmpeg H.264 MP4 + HLS + posters (auto-detected, `FFMPEG_MODE`), voice notes to AAC, PDF page counts, private KMS bucket with 60 s signed GETs and an access log for KYC, CloudFront signing, the 30-day chat media deletion (`chatMedia.expired` from social plus an `expiresAt` sweep), events `media.uploaded|processed|rejected|held|deleted`, and `POST /internal/v1/media/intents` for goIdentity avatar and banner intents. Jobs run on a Postgres-backed `JobQueue` (`processing_jobs`) until the RabbitMQ job adapter replaces it. Not built: blurhash, HEIC decoding (prebuilt sharp has no HEVC), live recording and gift animation purposes, audio fingerprinting, image classification on the Python side (the endpoint is text only today).

### ts-social status (3 Oct 2026)

Built in `services/typescript/social` (port 8105, Prisma schema `social`): follows and requests, blocks, posts/clips/stories, reshares, threaded comments, likes, shares, saves and collections (`/saves*`), mentions (`/mentions/candidates|resolve`, 20 cap, `@all`), video replies, feeds (following, for-you, popular, clips), conversations (direct, groups), message requests and spam folder, chat settings, mute/restrict/block, E2EE message envelopes, polls, locations, documents, reactions, shares to chats, streaks (`/conversations/:id/streak/*`), 30-day chat media expiry job, report intake (`POST /reports`, event `report.created` to goTrust) and the notifications digest source (`GET /api/v1/internal/digests/{weekly|followRequests|messageRequests}`, `x-internal-token`). Open items: reading `who_can_mention_me` needs `GRANT SELECT (who_can_mention_me)` on `users.privacy_settings` for `zudomart_readers` (until then mentions default to `everyone`); link previews are built (4 Oct, see below); story replies, channels, sounds, post analytics and `/search/people` are not built; product and store share cards now resolve (the commerce guard accepts `X-Internal-Token`, §2.19); live cards come from go-live.


**Social contract additions (4 Oct 2026, [plans.md §42](./plans.md)).** Posts: `replyPolicy` (`everyone|following|followers|mentioned|off`), `isQuote`, `quoteCount`, `sensitiveLabels` (effective) with `authorSensitiveLabels`, `moderationSensitiveLabels`, `advisorySensitiveLabels`, `sensitiveLabelsReviewed`; comments: `depth` and materialised `path` (index `rootCommentId, path`); table `content_preferences`. `PostView` adds `quotes`, `isQuote`, `replyPolicy`, `viewerCanReply`, `replyRestriction`, `sensitive { labels, requiresInterstitial }`, `resharedFromUnavailable`. Routes: `PATCH /posts/:id/reply-settings`, `PATCH /posts/:id/sensitivity`, `GET /posts/:id/quotes`, `GET /posts/:id/thread?sort`, `GET /comments/:id/thread`, `GET|PUT /me/content-preferences` (gateway routes `/api/v1/me/content-preferences` to social). Replies are refused with `403 REPLIES_OFF|AUTHOR_FOLLOWS_ONLY|FOLLOWERS_ONLY|MENTIONED_ONLY|SUBSCRIBERS_ONLY`; subscriber-only posts need an approved creator (`CREATOR_ONLY`). Age gate: go-auth access tokens carry `age` (`adult|minor|unknown`, never the date of birth), the gateway forwards `x-zudomart-age-bracket`, social keeps it in request context and withholds `nudity` and `dangerous_acts` from every non-adult read path (direct links `404 POST_NOT_AVAILABLE`); the post search source adds `sensitiveLabels` and search stores `restricted_for_minors`. Consumed events: `labels` on `content.visibilityChanged`, new `content.sensitivityAdvised` (bound to `social-domain-events`); `post.updated` carries `replyPolicy` or `sensitiveLabels` changes.

### Link previews, guest gate and role checks (4 Oct 2026)

- **ts-social**: module `linkPreviews` (`GET /api/v1/link-previews/resolve?url=`, `POST /api/v1/posts/:postId/link-preview`, both auth) and unfurl on post create; `posts.linkPreview` JSONB and `link_preview_cache` table (Prisma-generated migration `20261004120000_post_link_previews`). Outbound fetches go through the SSRF guard (public IPs only incl. IPv6, pinned socket, re-validated redirects, size and time caps). Env: `LINK_PREVIEWS_ENABLED`, `LINK_PREVIEW_MEDIA_OWNER_ID`. Details in [plans.md §41.1](./plans.md).
- **ts-media**: internal intents accept purpose `post`; new `POST /internal/v1/media/:mediaId/complete` `{ accountId }` (owner-checked) so services can ingest images (link preview thumbnails) through the normal scan, moderation and CDN pipeline.
- **gateway**: every non-GET without a valid token is refused with 401 except auth, staff auth bootstrap, `PUT /consents`, email unsubscribe, `POST /mentions/resolve` and webhooks; staff routes pass with a bearer for the owning service to verify. Route added: `GET /api/v1/link-previews/*` → social (required).
- **goIdentity**: reserved usernames include every top-level web app route (kept in sync by `apps/webapp/src/contracts/reservedRoutes.test.ts`).
- **go-catalog**: create, publish and duplicate product need an `active` store (`403 STORE_NOT_APPROVED`). **go-live**: hosting already needs the `creator` role; now unit-tested.
- **Open**: `GET /api/v1/sitemap/{products|stores|profiles}?page=` for the web app sitemap; optional-auth public profile by id in goIdentity.

- **go-catalog / go-orders (regional prices, region visibility):** `product_variants.regional_prices` and `stores.shipping_country_codes`; orders pushes deliverable countries through `commerceports.StoreShippingCountries` after rule saves and the catalog re-emits `product.updated`; `ResolveProductsForCheckoutInCountry` re-prices and marks non-shipping sellers unpurchasable; buyer region via `platform/viewerregion` (`TRUSTED_COUNTRY_HEADER`, default `CloudFront-Viewer-Country`). Search documents carry `shipping_regions`; the share-card endpoint takes `viewerId` and optional `country`.
- **goIdentity:** account deletion grace is 30 days (`USERS_DELETION_GRACE_DAYS`); `identityports.DeletionGraceCanceller` lets auth cancel a pending request on password or social login and return `notice`.

### Create flow: photo clips, trims, location and tags (4 Oct 2026, [plans.md §51](./plans.md))

- **ts-social `POST /api/v1/posts`**: accept `media[]` (`mediaId`, `type`, optional `trim { startMs, endMs }`), `slideshow { durationsMs[], transition: none|crossfade|slide }` (clips only, 1 to 10 images, 1,000 to 10,000 ms each, total 180,000 ms or less), `location { placeId, name, area? }` and `taggedUserIds[]` (cap 20). Errors: `422 CLIP_SLIDESHOW_NEEDS_PHOTOS|CLIP_SLIDESHOW_BAD_DURATION|CLIP_SLIDESHOW_BAD_TRANSITION|CLIP_TOO_LONG|CLIP_BAD_TRIM|SLIDESHOW_NEEDS_CLIP|INVALID_LOCATION|TOO_MANY_TAGS`. A slideshow or trimmed clip is created with one `video` media item, `status: processing` (poster = first photo), and published to feeds only when the render finishes (`media.processed`).
- **ts-media render jobs**: `media.renderSlideshow` (ffmpeg concat of scaled and padded 1080x1920 stills, `xfade` for crossfade or slide, silent track unless a sound is attached, H.264 + HLS like other clips) and `media.trimVideo` (`-ss/-to` with re-encode at keyframes). Input images must be scanned and owned by the author; the output goes through the normal moderation and copyright audio pipeline. Emits `media.processed` with the rendered media id; social swaps it into the post.
- **Places**: `GET /api/v1/places/search?q=` (2+ characters, text only, no coordinates from the client) backed by a provider proxy with caching and a per-user rate limit; store only `placeId`, `name`, `area` on the post. Never infer location from IP or GPS.
- **Tags**: `GET /api/v1/tags/candidates?q=` returns `{ candidates: [{ user, canTag, unavailableReason }] }`. Leave out users who blocked the author (do not reveal the block) and set `canTag: false` for users whose privacy setting turns tagging off (new `allowTagging` / "who can tag me" in go-users privacy, default everyone). On write, social re-checks blocks and settings and silently drops untaggable ids. Store `post_tags (post_id, user_id, created_at)`. Emit `post.tagged` so notifications sends a `postTag` notification ("tagged you in a post/clip"). `DELETE /api/v1/posts/:postId/tags/me` lets a tagged user remove themselves (emits `post.untagged`); the author can edit tags with `PUT /api/v1/posts/:postId/tags`. Blocking someone removes their existing tags on your posts.
- **Tagged people on reads (plans.md §52)**: ts-social `PostView` adds `taggedUsers: [{ id, username, displayName, avatarUrl, checkmark: blue|gold|black|null, isFollowing }]` (first 3, viewer-relative follow state, blocked or deactivated users left out) and `taggedUsersCount`. New `GET /api/v1/posts/:postId/tagged-users?cursor=` returns `{ data: TaggedUser[], nextCursor }` (page size 20, optional auth so guests can read, same visibility checks as `GET /posts/:id`); gateway route → social. `checkmark` comes from the go-users verification read model (visible badge only).
- **Clip share count (plans.md §52)**: ts-social `PostView` for clips adds `shares` (count of `POST /posts/:id/share` events, deduped per viewer per day), separate from `views` and `reposts`; kept as a counter column updated by the share handler.
