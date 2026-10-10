# Zudomart architecture inventory (phase 1)

As of: 2026-10-03 10:07-10:20 UTC, git HEAD `295268bc` plus a dirty working tree. `services/**` is being edited by other agents
right now (for example `services/go/modules/auth/internal/httpapi/*` and `services/go/modules/subscriptions/*` were modified or newly added
during this audit), so treat every services/** row as a snapshot. Counts were taken with find/grep, not by running tests.

Status legend: **EXISTING** implemented code; **MOCK-ONLY** frontend mock contract, no real backend behind it; **PROPOSED** only in
`docs/backendPlan.md` or `docs/architecture/microservicesPlan.json`; **ABSENT** not found anywhere.

## 0. Top-level shape

| Path | What it is | Status |
| --- | --- | --- |
| `apps/mobile` | Expo 57 / RN 0.86 app | EXISTING (UI), backend MOCK-ONLY except auth path |
| `apps/webapp`, `apps/studio` | Next 16 buyer web app and creator live studio, each with a BFF | EXISTING UI, MOCK-ONLY data |
| `apps/seller`, `apps/ads`, `apps/admin` | Next 16 seller dashboard, ads manager, admin console, each with a BFF | EXISTING UI, MOCK-ONLY data |
| `apps/web` | Next 16 marketing site (6 pages, no BFF) | EXISTING |
| old monolith | Zudojs modular monolith; removed on 2026-10-10 after everything still in use was ported to the services | REMOVED |
| `services/python/intelligence` | FastAPI scoring service (Python 3.14) | EXISTING (stateless scoring), no event consumer |
| `apps/gift` | three mp4 files (`heart.mp4`, `rose.mp4`, `star.mp4`), no code | assets only |
| `services/go` | Go 1.26 workspace: 14 platform libs, 18 module dirs, 6 deployables | EXISTING, one module complete |
| `services/typescript/gateway` | Zudojs edge proxy | EXISTING, one upstream |
| `services/elixir/realtime` | Phoenix 1.8 raw-WebSocket realtime | EXISTING |
| `services/contracts` | buf protos (3), JSON event schemas (4), AsyncAPI 3 | EXISTING, small |
| `packages/{designTokens,webKit,contracts,shared-types}` | shared packages | see section 1.4 |
| `infra/local` | docker-compose and bootstrap scripts | EXISTING |
| `infra/aws` | README only, "Terraform layout, not applied" | PROPOSED (`infra/aws/README.md`) |
| `.github/workflows/{backend,androidApk}.yml` | CI | EXISTING (`backend.yml` is untracked) |
| `docs/{backendPlan.md,plans.md,CHANGELOG.md,darkModePlan.md}`, `docs/architecture/microservicesPlan.json` | plans | PROPOSED content |

Root `package.json`: pnpm 11 workspace over `apps/*`, `packages/*`, `services/typescript/*`; Node >=24; `backend:*` scripts drive compose, go-identity, gateway, tests.

## 1. Frontend apps

### 1.1 Cross-app facts

| Concern | Finding | Evidence |
| --- | --- | --- |
| Data layer | Every app calls `/api/v1/*`; all five Next apps and mobile switch to in-process mocks by env flag defaulting to true | `apps/*/.env.example` (`WEBAPP_USE_MOCKS=true`, `STUDIO_/SELLER_/ADS_/ADMIN_USE_MOCKS=true`); `apps/mobile/src/config/api.config.ts` (`useMocks` default true); `apps/mobile/src/services/apiClient.service.ts:45` |
| API base URL | Env examples point at `http://localhost:3000` (the old monolith's port), not the gateway on `:8080` | `apps/webapp/.env.example`, `apps/mobile/.env.example`; gateway port in `services/README.md` |
| Mock size | webapp 57 mock files, mobile ~60, ads 15, seller 12, admin 11, studio 5 | `apps/*/src/mocks` |
| BFF pattern (Next apps except web) | Browser calls same-origin `/bff/*`; route handlers keep tokens in httpOnly cookies and forward to the API with a bearer token | `apps/*/src/app/bff/[...path]/route.ts`, `apps/webapp/src/server/{gateway,session,signedCookie,requestOriginGuard}.service.ts` |
| Cookies | `__Host-` prefixed in production (`zd_at`, `zd_rt`, `zd_sid`, `zd_viewer`), `httpOnly`, `sameSite: lax`, 15 min access / 30 day refresh | `apps/webapp/src/config/sessionCookies.config.ts` |
| CSRF | Origin + `sec-fetch-site` check plus HMAC-derived `x-csrf-token` bound to session id (webapp); equivalent origin guards exist in studio, seller, ads, admin | `apps/webapp/src/server/requestOriginGuard.service.ts`, `signedCookie.service.ts`; `apps/{studio,seller,ads,admin}/src/server/*` (csrf mentions: 10, 14, 9, 15 files) |
| Route guard | `src/proxy.ts` (Next 16 middleware) redirects unauthenticated users; webapp redirects to `/bff/auth/access-refresh` when access cookie is missing | `apps/{webapp,studio,seller,ads,admin}/src/proxy.ts` |
| Security headers | CSP / frame / HSTS configured in each `next.config.ts` (admin has a dedicated `contentSecurityPolicy.service.ts`) | `apps/*/next.config.ts`, `apps/admin/src/server/contentSecurityPolicy.service.ts` |
| Admin extras | MFA enrollment, passkey (WebAuthn) options, step-up, keep-alive BFF routes | `apps/admin/src/app/bff/auth/{mfa,step-up,keep-alive}/**` |
| Tests | No frontend test files exist. Only `apps/mobile` has a `test` script (`jest`) and `apps/mobile/tests/` holds `.gitkeep` only. The other Next apps only define `typecheck` (web has none). `pnpm test` therefore runs nothing for the UI | `apps/*/package.json`, `find` of `*.test.*` (48 files, all under the old monolith) |
| Error/empty/loading kit | Web: `@zudomart/web-kit` has `skeleton`, `emptyState`, `errorState`; mobile has own `ui/{errorState,skeleton,listSkeleton}`; webapp `components/ui/feedback.tsx`; admin/ads `ui/feedback.module.css`. Next `error.tsx`/`loading.tsx`: webapp 2/1, studio 2/1, ads 2/2, admin 2/1, seller 1/0, web 1/0 | `packages/webKit/src/*`, `apps/mobile/src/components/ui/*`, find of `error.tsx`, `loading.tsx` |
| Realtime client | Mobile opens `wss://<apiBase>/ws`, sends `{type:"auth",accessToken}`, heartbeat 25 s, backoff 1-30 s, with a mock emitter in mocks mode | `apps/mobile/src/services/realtime.service.ts`; matches `services/elixir/realtime/lib/realtime_web/client_socket.ex` |

### 1.2 Per-app inventory

| App | Stack and state | Rendering | Routes (real count from `page.tsx`) | Notes |
| --- | --- | --- | --- | --- |
| `apps/mobile` | Expo ~57, RN 0.86.3, React 19.2, React Navigation 7, TanStack Query 5 with persisted cache (AsyncStorage), Zustand 5 (8 stores: `actingProfile`, `auth`, `locale`, `offline`, `profileSwitcherSheet`, `signup`, `uploadQueue`, `videoAudio`) | native | 92 screen files in 29 folders: auth boost brand cart checkout clips create creator disputes escrow explore home live messages notifications orders posts product profile rankings seller settings sounds store story support verification wallet | per-prefix staleTime table, offline mutation queue, expo-sqlite message history (`cache/messageHistory.database.ts`), media upload queue, `useInfiniteQuery` in 7 files, FlatList/FlashList in 27 files, tokens in `utils/secureStorage.util.ts`. 59 service files, all mock-switched |
| `apps/webapp` | Next 16.3, React 19.3, TanStack Query 5, Zustand 5 (`auth.store`, `locale.store`), `@zudomart/design-tokens`, `@zudomart/web-kit` | CSR: 21/21 pages are `"use client"`; 7 route handlers (BFF) | 21 pages: `/`, analytics/post/[postId], cart, category/[categoryId], chats, chats/[conversationId], checkout, collections/[collection], creator, explore, me, notifications, orders, orders/[orderId], product/[productId], user/[userId], plus auth: welcome, login, signup, forgot-password, reset-password | `useInfiniteQuery` + IntersectionObserver on `/` and `productCollectionBrowser`; 16 service files; `cache/messageHistory.type.ts` only |
| `apps/studio` | Next 16.3, TanStack Query, Zustand | mostly CSR (4/6) | 6 pages: login, overlay/[sceneId], lives, lives/[liveId], lives/[liveId]/overlay; 6 BFF routes | no social route in mocks (`backendPlan.md` mismatch 18) |
| `apps/seller` | Next 16.3, React 19.3, no react-query or zustand; hooks in `src/hooks` (7) | Server Components shells (0/88 pages are `"use client"`, 203 client files) | 88 pages: dashboard, orders (+disputes, returns, invoice, packing-slip), products (+import, categories, labels), inventory (locations, movements, transfers, suppliers, reorder, adjustments), customers, marketing, promotions, delivery, wallet (accounts, escrow, fees, refunds, settlements, statements, withdraw), affiliates, brand, staff, reports, reviews, settings/* (15), access/apply, access/verification, billing-checkout/* | `apiContract.md` present; 10 BFF routes incl. password reset and store/location session. Still contains POS-era roles per `backendPlan.md` mismatch 15 (`apps/seller/src/config/rolePermissions.config.ts`) |
| `apps/ads` | Next 16.3, no react-query | Server shells (0/22 client) | 22 pages: login, policy, invites/[token], accounts (+new, [id]/overview, campaigns, ad-sets, ads, audiences, billing, reports, settings, activity, tools/{events,experiments,rules}) | `apiContract.md`; 4 BFF routes |
| `apps/admin` | Next 16.3, no react-query | Server shells (0/44 client) | 44 pages: overview, users, admins, applications, ads review/policies/advertisers, brands, catalog, commerce (orders, disputes, ledger, payouts, refunds, coins), config (automation, flags, plans, revenue, rules, templates), moderation, ip-claims, support, usernames, audit, verification, account/security, login/mfa | `apiContract.md`; 11 BFF routes; MFA/passkey/step-up |
| `apps/web` | Next 16.3 | Server components (0/6 client) | 6 pages: `/`, about, contact, privacy, sellers, terms | No BFF, no proxy, no env example for API; `NEXT_PUBLIC_*` only |

### 1.3 Pagination and envelope drift (frontend vs plan)

| Item | Finding | Evidence |
| --- | --- | --- |
| Cursor pages | webapp and mobile use `useInfiniteQuery`; list envelope `{data,nextCursor}` in the old monolith, mobile unwraps `payload.data ?? payload` and drops `nextCursor` | `docs/backendPlan.md` 2.13 item 1, `apps/mobile/src/services/apiClient.service.ts:65` |
| Go cursor helper | `services/go/platform/httpserver/cursor.page.go` EXISTING, unused by any implemented module endpoint | file list |
| Envelope divergence | ads `{items,nextCursor,total}`, admin `{items,page,pageSize,total}` | `docs/backendPlan.md` 2.13 |

### 1.4 Packages

| Package | Contents | Consumers found |
| --- | --- | --- |
| `@zudomart/design-tokens` (`packages/designTokens`) | `tokens.css`, `native.ts` | webapp, studio, ads, admin, web (package.json) ; mobile keeps its own `src/constants/colors.constant.ts` |
| `@zudomart/web-kit` (`packages/webKit`) | Skeleton, EmptyState, ErrorState, wordmark, feedback css | webapp, studio, ads, admin |
| `@zudomart/contracts` (`packages/contracts`) | 20 TS contract files (auth, carts, orders, products, media, feeds, posts, wallets, escrows, ...) | **none**: no app or service imports it (grep of `apps/*/package.json`, `apps/*/src`, `services/typescript`) |
| `@zudomart/shared-types` | 15 type files (money, order, escrow, post, ...) | **none** found |
| Dark mode | `docs/darkModePlan.md` (95 lines) | PROPOSED; stylelint config at root (`stylelint.config.mjs`) |

## 2. Backend

### 2.1 Go platform libraries (`services/go/platform`, module `zudomart/platform`)

| Package | Provides | Tests |
| --- | --- | --- |
| `config` | env reader with accumulated errors | none |
| `events` | envelope builder, outbox relay (poll 500 ms, batch 100), SNS publisher, SQS enqueue/consume with redrive-based DLQ, AWS config with endpoint override, discard publisher for dev | none |
| `health` | readiness checks | none |
| `httpserver` | server with timeouts (read-header 5 s, read/write 30 s, 64 KB headers, 20 s graceful shutdown), request id, panic recovery, request logging, error mapper, strict JSON decode, cursor page | none |
| `idempotency` | Redis store plus `Idempotency-Key` middleware with response replay | none |
| `identityports` | `AccountDirectory`, username block ports, registry | none |
| `jwtauth` | JWKS-based access token verifier, `RequireVerifiedAccessToken` | 1 file |
| `logging`, `telemetry` | slog; OTLP/gRPC trace exporter when `OTEL_EXPORTER_OTLP_ENDPOINT` set, per-request tracing middleware | none |
| `money` | minor-unit money type | 1 file |
| `postgres` | schema-scoped DB URL, embedded-migration apply, pool defaults, readiness | none |
| `servicemodule` | `Module` interface (`Name`, `MountRoutes`, `RunBackgroundWorkersUntilContextDone`, `Close`), `RoutelessModule`, deployable runner with signal handling | none |
| `staffauth` | staff guard | none |
| `usernames` | username rules | 1 file |

Not present in any Go platform package: rate limiting, CORS, security headers, webhook signature verification, gRPC server wiring (grep `grpc` in `services/go` hits only `telemetry/tracing.provider.go`).

### 2.2 Go modules (`services/go/modules/*`, all 18 listed in `go.work`)

| Module | Status | Evidence |
| --- | --- | --- |
| `auth` | **EXISTING, the only functional module.** 7 ent entities, 3 migrations, 4 test files | `modules/auth/**` |
| `live` | **PARTIAL (data layer only, in flux).** 14 ent schemas and generated code, 1 migration (`create_live_tables`), but `live.module.go` returns `RoutelessModule`; `internal/{application,httpapi,ports,config,media}` dirs are empty; 0 tests | `modules/live/live.module.go`, `modules/live/internal/*` |
| `admin`, `ads`, `analytics`, `catalog`, `creators`, `currency`, `escrow`, `inventory`, `ledger`, `moderation`, `orders`, `payments`, `rewards`, `subscriptions`, `users`, `wallet` | **SKELETON.** One 11-line `<name>.module.go` returning `RoutelessModule`; no ent, no migrations, no tests (`subscriptions` was added to git index during the audit) | `find modules/<name> -name '*.go'` |

Auth module detail:

| Item | Finding |
| --- | --- |
| Routes (8, `auth.routes.go`; file was being modified at audit time) | `POST /api/v1/auth/{register,login,refresh,logout,otp/send,otp/verify}`, `GET /api/v1/auth/username-available`, `GET /.well-known/jwks.json`; logout requires a verified access token |
| Commands/queries | register, login, refresh, logout, send/verify one-time code, check username (`internal/application/*.go`) |
| Crypto | argon2id hasher (`internal/credentials/argon2id.hasher.go`); EdDSA/JWT access tokens (15 min default) with encrypted signing keys in DB, rotation every 30 days, JWKS publication (`internal/signingkeys/*`); refresh tokens stored hashed, rotated on use, reuse revokes session (`refresh_session_tokens.command.go`; asserted by `TestRegisterLoginRefreshRotationReuseDetectionAndLogout`) |
| OTP | 5 min TTL, 5 attempts, 1 min resend cooldown, peppered hash, delivery `log` only (dev; production refuses via `AUTH_OTP_DELIVERY_NOT_LOG_IN_PRODUCTION`); no email/SMS provider |
| Social identities | `social_identities` table and `AUTH_GOOGLE_*`/`AUTH_APPLE_*` config exist; no social login route in `auth.routes.go` at snapshot time |
| Staff auth | `AUTH_STAFF_ACCESS_TOKEN_TTL` config and `platform/staffauth` exist; no staff/admin login route |
| Absent in module | password reset route, `/api/v1/auth/sessions` list/revoke, devices, MFA, passkeys, per-endpoint rate limit |
| ent schemas | `account`, `session`, `refresh_token`, `one_time_code`, `signing_key`, `social_identity`, `outbox_event` (`internal/ent/schema/*.schema.go`) |
| Migrations | Atlas, embedded: `20261003094035_create_auth_tables`, `20261003094100_grant_read_access_to_other_services`, `20261003100736_add_social_identities` (+ down files, `atlas.sum`); applied automatically at start by `postgres.ApplyPendingMigrationsFromEmbeddedDirectory` |
| Events emitted | `account.registered`, `account.loggedIn`, `session.refreshTokenReuseDetected` via outbox (`internal/application/outbox.events.go`) |
| Tests | `auth.module_integration_test.go` (2 tests: full register-login-refresh-reuse-logout flow, OTP lockout after 5 attempts; need compose Postgres), `credentials_test.go`, `signing_key.selection_test.go`, `input.validation_test.go` |
| Env | `AUTH_DATABASE_URL`, `AUTH_DATABASE_SCHEMA=auth`, `AUTH_TOKEN_ISSUER/AUDIENCE`, `AUTH_SIGNING_KEY_ENCRYPTION_KEY`, `AUTH_ONE_TIME_CODE_PEPPER`, `DOMAIN_EVENTS_TOPIC_ARN` (`services/go/.env.example`) |

### 2.3 Go deployables (`services/go/deployables/*`, each 19-31 line `main.go` plus Dockerfile)

| Deployable | Modules composed | Real behaviour today |
| --- | --- | --- |
| `go-identity` | auth, users, currency, admin | auth only; others are routeless |
| `go-commerce` | (25 lines; commerce modules) | routeless; the plan lists catalog, inventory, orders |
| `go-money` | payments, wallet, ledger, escrow, subscriptions, creators | routeless |
| `go-live` | live | routeless |
| `go-ads` | ads | routeless |
| `go-trust` | moderation | routeless |

Dockerfile: multi-stage `golang:1.26-alpine` to `distroless/static-debian13:nonroot`, port 8080, CGO off. go-identity runs on `:8101` locally (`HTTP_ADDRESS`).

### 2.4 TypeScript gateway (`services/typescript/gateway`)

| Item | Finding |
| --- | --- |
| Size | 6 source files (~300 lines), 1 test file (`tests/upstreamDispatch.handler.test.ts`, 134 lines), vitest, Dockerfile |
| Built on | `@zudojs/http`, `@zudojs/logger`, `jose` |
| Route table | 3 prefixes, all to upstream `identity`: `/api/v1/auth/logout` (auth required, POST), `/api/v1/auth/sessions` (auth required), `/api/v1/auth/` (optional auth). `UpstreamName = "identity"` is the only upstream (`src/routes/upstream.routes.ts`, `src/configs/gateway.config.ts`) |
| Auth | JWKS verification via `jose` (`accessTokenVerifier.service.ts`); forwards `x-zudomart-account-id` and `x-zudomart-session-id`, `x-request-id`, `x-forwarded-for`, `x-real-ip`; whitelists forwarded and returned headers |
| Edge controls | CORS allow-list (`CORS_ORIGINS`, `credentials:false`), in-process rate limit (`RATE_LIMIT_MAX_PER_MINUTE` default 600, per instance), 1 MiB body limit, upstream timeout 10 s (502/504 mapping), `nosniff`, `no-referrer`, HSTS |
| Absent | idempotency fast path, per-route stricter limits for login/OTP, aggregation, response caching, other upstreams, Redis-backed limits (all PROPOSED in `backendPlan.md` 1.3, 5.5) |

### 2.5 Elixir realtime (`services/elixir/realtime`)

| Item | Finding | Evidence |
| --- | --- | --- |
| Deps | phoenix 1.8, bandit, jose, telemetry, dns_cluster; no ecto, no phoenix_pubsub-redis | `mix.exs` |
| Transport | Raw JSON WebSocket at `/ws` (a `Phoenix.Socket.Transport`, **not Phoenix Channels**), 64 KB max frame, `check_origin` via `OriginPolicy` (`ALLOWED_ORIGINS`, required in prod), `GET /healthz` | `lib/realtime_web/endpoint.ex`, `router.ex` |
| Socket auth | First frame `{type:"auth",accessToken}` within 10 s else close; JWKS verification with key cache; auto-subscribes `user:<accountId>` | `client_socket.ex`, `auth/{access_token_verifier,jwks_key_cache}.ex` |
| Client frames | `ping`, `auth`, `subscribe`, `unsubscribe`, `typing`; max 50 subscriptions per socket | `client_socket.ex` |
| Topics | `user:<id>` (own only), `conversation:<id>` (membership checker defaults to **deny all**), `live:<id>` and `battle:<id>` (any authenticated user) | `topics/topic_authorizer.ex` |
| Presence | `Realtime.Presence` tracked on `live:*` subscribe; no presence broadcast to clients beyond standard PubSub | `presence.ex`, `client_socket.ex` |
| Event router | Maps domain events to topics: 21 live/battle/gift/guest/stage/leaderboard event types to `live:<liveId>`; `guest.invited` and `notification.created` to `user:*`; `message.created` to `conversation:*`. Throttles goal progress 1 s, leaderboard 1 s, viewer count 2 s, battle score 500 ms | `events/domain_event_router.ex`, `events/throttle.ex` |
| SQS consumer | GenServer long-polls queue `realtime-domain-events`, in-memory dedupe window of 10 000 ids, deletes only after ack, SigV4-signed HTTP client (no AWS SDK) | `events/sqs_consumer.ex`, `sqs_queue_client.ex`, `aws_signature_v4.ex` |
| Tests | 6 ExUnit files: sqs consumer, domain event router, access token verifier, throttle, SigV4, topic authorizer. Run in Docker (`services/scripts/test-realtime-in-docker.sh`) | `test/realtime/*` |
| Absent | chat persistence, message send path, groups/channels, encryption keys, conversation membership data source, presence list API, notification stream producer (all PROPOSED in `microservicesPlan.json` `elixir.realtime`) | |

### 2.6 Python intelligence (`services/python/intelligence`)

| Item | Finding | Evidence |
| --- | --- | --- |
| Stack | FastAPI, polars, pyarrow, scikit-learn, scipy, redis, uv, Python >=3.14; ~12.8k lines of Python | `pyproject.toml` |
| Modules (12) | ads, audio, clips, events_ingestion, experiments, feed, model_registry, recommendations, risk, search, social_proof, trending | `src/modules/*` |
| Endpoints | `POST /v1/events`, `/v1/feed/rank`, `/v1/clips/rank`, `/v1/social-proof/select`, `/v1/ads/select`, `/v1/recommendations/{products,accounts,clips}`, `/v1/trending`, `/v1/search/rerank`, `/v1/risk/score`, `/v1/experiments/assign`, `GET /v1/experiments/{key}/metrics`, `/v1/audio/{fingerprints,match,sounds/status}` + health | `apiContract.md` section 7 |
| Auth | HMAC-SHA256 signed requests (`x-zudo-timestamp`, `x-zudo-nonce`, `x-zudo-signature`), 300 s skew, Redis nonce store (fail closed 503), previous-secret rotation, token-bucket rate limit, 1 MiB/4 MiB body caps | `apiContract.md` section 2 |
| Storage | Redis online features, Parquet feature logs, synthetic data simulators and offline metrics utils | `src/repositories`, `src/utils` |
| Tests | 15 `test_*.py` files in `tests/` (counted by `find`); not run here | `services/python/intelligence/tests` |
| Callers | No Go/TS service calls it yet; `services/python/README.md` says it reads SQS queue `intelligence-domain-events`, but no SQS/boto code exists in `src` (grep). It ingests via `POST /v1/events` | `services/python/README.md`, grep |
| Location | Plan says to move to `services/python/intelligence` later; currently `services/python/` is only a README | `services/python/README.md` |

### 2.7 Legacy monolith (Zudojs, removed on 2026-10-10)

| Item | Count / finding | Evidence |
| --- | --- | --- |
| Modules (34 dirs) | admin ads audit auth automation carts categories coins creators creatorSubscriptions currency escrows feeds follows intelligence media messages moderation notifications orders payments posts products reviews search stores subscriptions support users verifications waitlist wallets | the old monolith's modules |
| Routes | 355 route registrations in 34 `*.routes.ts` files (plan quotes 354); admin has commands but 0 routes; intelligence has 0 routes | grep of `.get(/.post(...` in `src/modules/**/routes`, `docs/backendPlan.md` 1.1 |
| Heaviest modules | posts 35, subscriptions 26, messages 25, creators 25, products 20, ads 16, users 15, auth 14, follows 14, stores 14 | same grep |
| Prisma | 124 models in 40 files under `prisma/schema/`, 1 migration (`20260929112825_init`), Prisma 7 with `@prisma/adapter-pg` | `prisma/schema/*.prisma`, `prisma/migrations` |
| Infra bits | Redis, scheduler (`src/jobs/scheduledJobs.job.ts`, overlap skip), one event (`notificationRequested`), websockets integration, `compose.yaml`, Dockerfile | `src/{jobs,events,integrations}` |
| Tests | 48 test files, the only automated frontend/backend TS tests in the repo outside gateway | find |
| Known state | `docs/backendPlan.md` 1.1 reports 4 type errors (missing `admin.loader`, missing admin routes, ...) | not verified here |

## 3. Data model inventory

Legend: A = the old monolith Prisma model (124 total, reference), G = Go ent entity (EXISTING, `services/go/modules/*/internal/ent/schema`), P = PROPOSED only (microservicesPlan.json / backendPlan.md).

| Domain | Prisma (A) | ent (G) | Status in services |
| --- | --- | --- | --- |
| users, profiles | `User`, `Topic`, `UserTopic`, `UsernameChange`, `UsernameHold`, `ReservedUsername`, `ProfileVerification`, `Block` | none (`users` module is a skeleton; `platform/usernames` has rules only) | PROPOSED |
| auth | `AuthIdentity`, `OtpCode` | `account`, `one_time_code`, `social_identity`, `signing_key` | EXISTING |
| sessions, refresh tokens | `Session` | `session`, `refresh_token` | EXISTING |
| devices, push tokens | `DeviceToken`, `RealtimeTicket` | none | PROPOSED |
| staff, admin auth | `PlatformStaffAccount/Invitation/Challenge/Session`, `WebAuthnCredential` | none | PROPOSED |
| follows | `Follow` | none | PROPOSED (`ts.social`) |
| posts, comments, likes | `Post`, `PostLike`, `Comment`, `CommentLike`, `StoryView` | none | PROPOSED |
| feed | `FeedInteraction` | none | PROPOSED |
| media | `MediaUpload`, `MediaUploadChunk`, `MediaAsset`, `MediaVariant` | none | PROPOSED (`ts.media`) |
| products, variants | `Product`, `ProductVariant`, `ProductLike`, `ProductBookmark`, `Category`, `Review` | none | PROPOSED |
| stores, sellers | `Store`, `StoreMember`, `SellerApplication`, `Address` | none | PROPOSED |
| inventory, warehouses | none in Prisma | none | PROPOSED, **ABSENT in reference code** |
| carts | `CartItem` | none | PROPOSED |
| orders, order groups | `Checkout`, `Order`, `OrderItem` | none | PROPOSED |
| shipping, geo | `Address` only | none | PROPOSED (`backendPlan.md` 4.6) |
| payments | `Payment`, `WebhookEvent` | none | PROPOSED |
| refunds | none as a model | none | PROPOSED |
| escrow, disputes | `Escrow`, `Dispute`, `DisputeMessage` | none | PROPOSED |
| wallets, ledger | `LedgerAccount`, `LedgerTransaction`, `LedgerEntry`, `WalletTopUp` | none | PROPOSED |
| payouts | `PayoutAccount`, `Withdrawal` | none | PROPOSED |
| coins | `CoinPack`, `CoinPurchase` | none | PROPOSED |
| gifts | `LiveGift` | `gift`, `gift_transaction`, `gift_goal` (live module) | schema EXISTING, no code |
| live | `LiveSession`, `LiveViewer`, `LiveComment` | `live_session`, `live_viewer`, `live_product`, `join_request` | schema EXISTING, no code |
| battles, guests | none | `battle`, `battle_participant`, `guest_slot` | schema EXISTING, no code |
| points, leaderboards | none (legacy `LoyaltyReward`, `PointsRedemption`, `ReferralCode`, `Referral`, `CashbackPromo` removed from scope 2026-10-03) | `points_entry`, `points_rule`, `live_leaderboard_entry` | schema EXISTING, no code |
| ads, campaigns, impressions | 22 ad models: `AdAccount`, `AdAccountMember`, `AdAccountInvite`, `AdActivity`, `AdCampaign`, `AdSet`, `Ad`, `AdSpendCounter`, `AdServing`, `AdEvent`, `AdBillingTransaction`, `AdBoost`, `AdPolicyCategory`, `AdCustomAudience`, `AdCustomerListHash`, `AdAccountBillingSettings`, `AdTopUp`, `AdPaymentMethod`, `AdScheduledReport`, `AdConversionEvent`, `AdExperiment`, `AdAutomatedRule` | none | PROPOSED |
| creators, earnings, affiliates | `CreatorApplication`, `CreatorProfile`, `CreatorViolation`, `CreatorEarning`, `AffiliateCommission`, `CreatorAffiliation`, `BrandDeal` | none | PROPOSED |
| subscriptions | `SubscriptionPlan`, `SubscriptionPlanPrice/Entitlement/Perk`, `ProfileSubscription`, `SubscriptionCharge`, `CreatorSubscriptionPlan`, `CreatorSubscription`, `CreatorSubscriptionCharge` | none | PROPOSED |
| notifications | `Notification` | none | PROPOSED |
| messages | `Conversation`, `ConversationParticipant`, `Message`, `MessageReaction` | none | PROPOSED (`ex.realtime` persistence) |
| moderation | `ModerationReport/Case/Decision/Appeal`, `AccountSuspension`, `AutomationRule/Execution/EventOccurrence` | none | PROPOSED |
| fraud | none (only `risk` scoring endpoints in intelligence) | none | PROPOSED |
| consent | none as a model | none | **ABSENT** (`backendPlan.md` 4.7 only) |
| audit | `AuditEvent` | none | PROPOSED |
| support | `SupportTicket`, `SupportTicketMessage`, `SupportContactRequest` | none | PROPOSED |
| idempotency | `IdempotencyRecord` | Redis store in `platform/idempotency` | EXISTING (Redis, not a table) |
| intelligence outbox | `IntelligenceOutboxEvent` | `outbox_event` in `auth` and `live` | EXISTING |
| currency | `ExchangeRate` | none | PROPOSED |
| waitlist | `WaitlistEntry` (the old monolith only) | none | **DROPPED** by the owner on 2026-10-05; not ported |

ent totals: auth 7 entities (6 domain + outbox), live 14 entities (13 domain + outbox); 2 outbox tables, one per module schema. `live_sessions` table has 28 columns including `livekit_room`, `live_ad_settings`, `sponsorship_line`.

DB layout: one Postgres, per-service schema and `svc_<service>` login role for 29 services, plus `zudomart_readers` NOLOGIN role granted to all (`infra/local/postgres/create-databases.sh`). Only auth (`AUTH_DATABASE_SCHEMA=auth`) actually runs against its schema today. `live` has a migration but no module wiring uses it.

## 4. Events and jobs

| Item | Status | Evidence |
| --- | --- | --- |
| Outbox table | EXISTING in `auth` and `live` ent schemas (`id, event_type, subject, payload jsonb, published_at`); auth writes events in the same transaction as the business change | `modules/auth/internal/application/outbox.events.go`, `modules/*/internal/migrations/*create*` |
| Relay | EXISTING: polling relay (500 ms, batch 100) `platform/events/outbox.relay.go`, run from the auth module's background worker, publishes via `DomainEventPublisher` | `modules/auth/auth.module.go` |
| Publisher | EXISTING SNS publisher `platform/events/sns.publisher.go`; dev fallback `DiscardingPublisher` marks events published without sending; production requires `DOMAIN_EVENTS_TOPIC_ARN` | `auth.module.go` `createDomainEventPublisher` |
| Failure handling in relay | no attempt counter or dead-letter column on the outbox row; a failed batch is logged and retried on the next tick forever | `outbox.relay.go` |
| Envelope | `platform/events/event.envelope.go` builds `{id,type,source,subject,version,occurredAt,data}`; JSON Schema `services/contracts/events/schemas/envelope.v1.json` | |
| Event schemas | 3 domain events only: `account.registered`, `account.loggedIn`, `session.refreshTokenReuseDetected` (+envelope) | `services/contracts/events/schemas/*`, `asyncapi.yaml` (AsyncAPI 3.0, one channel `zudomart-domain-events`, 1 operation `publishAuthEvents`) |
| Events consumed but undefined | Elixir router handles `gift.sent`, `goal.*`, `leaderboard.updated`, `live.*`, `guest.*`, `stage.updated`, `battle.*`, `message.created`, `notification.created`; none has a JSON Schema or a producer | `domain_event_router.ex` vs `contracts/events/schemas` |
| Local topology | SNS `zudomart-domain-events`; consumer queues `users-`, `notifications-`, `realtime-`, `intelligence-domain-events` subscribed with RawMessageDelivery; job queues `jobs-email`, `jobs-media`, `jobs-reports`, `jobs-payouts`, `jobs-search-indexing`; each with a `-dlq`, `maxReceiveCount=5`, visibility timeout 60 s | `infra/local/localstack/create-topics-and-queues.sh` |
| Filter policies | AsyncAPI says consumers subscribe "with a filter policy on eventType"; the local script subscribes **without** filter policy (`RawMessageDelivery=true` only), and raw delivery drops the `eventType` message attribute envelope that a filter would need | script vs `asyncapi.yaml` description |
| Consumers (real) | Only Elixir `SqsConsumer` (queue `realtime-domain-events`). No Go SQS consumer in use (`SqsQueues.ConsumeQueueUntilContextDone` exists in `platform/events/sqs.queue.go`, with no caller). Intelligence has no consumer | grep |
| Job queues | `SqsQueues.EnqueueJob` exists in platform; nothing enqueues or consumes jobs; the old monolith used an in-process scheduler | `sqs.queue.go`, the old monolith's scheduler |
| Retry/DLQ | Handled by SQS redrive (5 receives, `sqs.queue.go` log message); no application-level backoff, no DLQ consumer or replay tooling | |
| AWS messaging infra | PROPOSED (`infra/aws/README.md` `messaging/` module); EventBridge "later" | |
| Proto contracts | `account_directory.proto` (auth), `live_money.proto` (money), `money.proto` (common); generated Go/TS/Python committed under `contracts/gen`; `live_money` is the live-to-money gift/battle settlement interface, **with no server or client implementation** | `services/contracts/proto`, grep `grpc` |

## 5. Realtime summary

See 2.5. Contract for clients: `/ws` JSON frames; topics `user:*`, `conversation:*`, `live:*`, `battle:*`; server event names are the right-hand side of `@live_event_names` (for example `gift.sent`, `gift.goal.progress`, `live.viewerCount`, `battle.score.updated`). `docs/backendPlan.md` 5.6 describes the intended envelope; mobile's `RealtimeServerEvent` type in `apps/mobile/src/types` was not diffed against the router.

## 6. Infra

| Item | Finding | Evidence |
| --- | --- | --- |
| Compose services | postgres (postgis 17-3.5), valkey 9, localstack 4.9, object-storage (SeaweedFS), livekit, otel-collector, jaeger; profiles `search` (opensearch 3) and `analytics` (clickhouse). All published ports bound to 127.0.0.1 | `infra/local/docker-compose.yml` |
| Not in compose | gateway, go-identity, realtime, intelligence (run on host or via per-service Dockerfile); `services/README.md` lists port 4000 for realtime but compose has no realtime service | compose vs README |
| Bootstrap | schemas and roles per service, `zudomart_test` and `atlas_dev` DBs, PostGIS | `infra/local/postgres/create-databases.sh` |
| Observability | Go OTLP/gRPC tracing opt-in by env, collector config at `infra/local/otel/collector.yaml`, Jaeger UI :16686; Elixir has `telemetry.ex` metrics only; gateway has no tracing; no metrics backend, no log shipping | `platform/telemetry`, `infra/local/otel` |
| AWS | `infra/aws/README.md` only: planned Terraform modules (network, ecs-cluster, ecs-service, alb, aurora-postgres, elasticache, messaging, step-functions, media, livekit, secrets, observability, opensearch, clickhouse), envs staging/production; "Nothing here is applied" | README |
| Dockerfiles | 6 Go (one per deployable), gateway, realtime, `services/python/intelligence`. None for the Next apps | find |
| CI | `.github/workflows/backend.yml`: file-length and no-raw-SQL checks; Go build/vet/test with compose Postgres plus `govulncheck`; gateway typecheck+test; realtime tests in Docker. `androidApk.yml`: mobile APK build. No CI for the Next apps (no lint/typecheck/build job) or `services/python/intelligence`; no deploy pipeline; no `pnpm audit` job though root script exists | workflows |
| Scripts | `services/scripts/{check-backend-file-lengths,check-no-raw-sql-in-typescript,test-go-workspace,test-realtime-in-docker}.sh` | |
| Env handling | `*.example` env files per app and service; real `.env*` ignored by `.gitignore`; Go config reader fails fast on missing required vars; BFFs require a session secret; no secrets-manager client code (AWS Secrets Manager only in the AWS README plan) | `.gitignore`, `services/go/platform/config` |

## 7. Security

| Control | State | Evidence |
| --- | --- | --- |
| Password hashing | argon2id in Go auth (EXISTING) | `modules/auth/internal/credentials/argon2id.hasher.go` |
| Access tokens | JWT with JWKS endpoint, key rotation, encrypted private keys at rest; verified by Go `jwtauth`, gateway (`jose`), realtime (`jose`) | auth module, gateway, realtime |
| Refresh rotation and reuse detection | EXISTING, tested | `auth.module_integration_test.go` |
| OTP | hashed with pepper, expiry, attempt lock, tested | same |
| BFF cookies and CSRF | EXISTING in 5 Next apps (see 1.1); gateway CORS is `credentials:false`, so only bearer calls cross origin | |
| Rate limits | gateway global in-memory only; intelligence token bucket; none per-endpoint on login/OTP in Go (SECURITY.md requires it); none in Go platform | grep |
| CORS | gateway allow-list; realtime `check_origin` allow-list; Go services none (internal) | |
| Headers | gateway: nosniff, referrer-policy, HSTS; Next apps: CSP etc. in `next.config.ts`; Go services none | |
| Webhook verification | **ABSENT** in new services (no payments module). The old monolith has `verify-webhook-signature.middleware.ts` per SECURITY.md | |
| Service-to-service auth | Python HMAC EXISTING; Go-to-Go none; gateway-to-Go uses plain forwarded `x-zudomart-*` headers with no signing visible, so go-identity trust relies on network isolation | `upstreamProxy.service.ts` |
| Idempotency | Redis middleware in Go platform, not wired to any module route | `platform/idempotency` |
| DB access | one role per service plus read-only group role (`zudomart_readers`); `auth` migration `grant_read_access_to_other_services` | |
| CI guards | 300-line limit, no raw SQL in TS, govulncheck | `backend.yml` |
| SECURITY.md | 50 lines of baseline rules (secrets, deps, auth, authorization, money, data, transport). Written against the old monolith paths (`src/loggers/redact.ts`, `compose.yaml`, `modules/audit`, `verify-webhook-signature.middleware.ts`, `RATE_LIMIT_MAX`); none map to `services/**` | `SECURITY.md` |

## 8. Test suites

| Target | Suites | Count |
| --- | --- | --- |
| Go | auth integration (2), credentials, signing key selection, input validation, jwtauth, money, usernames | 8 `_test.go` files in 5 packages; ~0 tests in the other 29 packages/modules |
| Gateway | vitest | 1 file |
| Realtime | ExUnit | 6 files |
| Intelligence | pytest | 15 files |
| Mobile | jest script, `tests/.gitkeep` only | 0 |
| Next apps (webapp, studio, seller, ads, admin, web) | none | 0 |
| E2E, contract, load tests | none | 0 |

## 9. Gaps and contradictions between docs and code

| # | Doc claim | Reality | Evidence |
| --- | --- | --- | --- |
| 1 | `services/README.md` and AWS README list 6 Go deployables as ECS services | all 6 compile, but only go-identity serves anything (auth); 16 of 18 modules are 11-line skeletons; `live` has schema and no handlers | `services/go/modules/*` |
| 2 | `backendPlan.md` section 0 says the `pos` block in `microservicesPlan.json` must go | already absent from the JSON; the seller UI roles were also cleaned (no `cashier`/`pos:*` left in apps/seller/src, verified 2026-10-03) | grep, `backendPlan.md` 2.13 |
| 3 | `services/python/README.md`: intelligence reads SQS `intelligence-domain-events` | queue exists in LocalStack; no consumer code in `services/python/intelligence` | grep for sqs/boto |
| 4 | AsyncAPI: consumers filter by `eventType` | local subscriptions have no filter policy and use raw delivery | `create-topics-and-queues.sh` |
| 5 | Plan treats Elixir as owner of chat | `message.created` is routed but no component produces it; `conversation:*` authorization denies everyone by default | `topic_authorizer.ex` |
| 6 | Gateway route `/api/v1/auth/sessions` is declared | no such route in go auth module | `upstream.routes.ts` vs `auth.routes.go` |
| 7 | Frontend env examples default `*_API_URL=http://localhost:3000` | gateway listens on 8080; 3000 is the legacy monolith port | `.env.example` files, `services/README.md` |
| 8 | `packages/contracts` and `packages/shared-types` presented as shared contracts | no consumer imports them; apps keep their own `types/` and mocks | grep |
| 10 | Plan: gateway does aggregation, idempotency, per-route limits | gateway proxies 3 prefixes to one upstream | gateway src |
| 12 | Events: Elixir consumes 21+ live event types | only 3 auth events have schemas and producers | contracts vs router |
| 13 | SECURITY.md paths | refer to monolith files; no equivalent for Go/TS/Elixir services | `SECURITY.md` |
| 15 | Local ports table lists realtime on 4000 | not started by compose; started with Mix/Docker script only | compose |
| 16 | CI covers tests | no job lints/typechecks/builds the 6 Next apps or mobile, and frontend has no tests | workflows |
| 18 | Studio/seller/ads/admin docs claim `apiContract.md` | present for seller, ads, admin, intelligence; studio and webapp have none | `ls apps/*` |


## 10. Quick reference for writer agents

- Authoritative "what runs": go-identity (auth), gateway (identity proxy), realtime (`/ws`), intelligence (`/v1/*`).
- Everything commerce, money, social, media, notifications, search, support is **PROPOSED**; the old monolith's Prisma models and routes were the reference spec until it was removed on 2026-10-10; `microservicesPlan.json` is the service map.
- Live: ent schema and migration exist (`services/go/modules/live/internal/{ent,migrations}`), proto `live_money.proto` exists, Elixir routes live events, but no Go live code. Treat as the first wiring candidate.
- When citing counts, re-run the greps: services/** is changing under the audit.
