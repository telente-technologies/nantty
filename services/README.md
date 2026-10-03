# Zudomart backend services

The backend is polyglot and lives here. `apps/api` is the old Zudojs monolith: it is a **reference only** (validators,
DTO shapes, state machines, tests to port) and is never deployed or edited. The service map and the platform rules are
in [`docs/architecture/microservicesPlan.json`](../docs/architecture/microservicesPlan.json) (`platform` section first),
and the contract inventory is in [`docs/backendPlan.md`](../docs/backendPlan.md).

## Run locally

Requirements: Docker, Go 1.26, Node 24 + pnpm 11. Elixir runs in the `elixir:1.19` image, so it does not need a local install.

```bash
pnpm backend:up                # Postgres+PostGIS, Valkey, LocalStack (SNS/SQS), SeaweedFS (S3), LiveKit, OTel collector, Jaeger
pnpm backend:dev:identity      # go-identity on :8101 (auth module), reads services/go/.env.example
pnpm backend:dev:gateway       # gateway on :8080, verifies JWTs via JWKS and proxies /api/v1/auth/* to go-identity
```

Point the mobile app at `http://<your-ip>:8080` with mocks off to use real auth. One-time codes are written to the
go-identity log in development (`AUTH_OTP_DELIVERY=log`, refused in production).

Optional profiles: `docker compose -f infra/local/docker-compose.yml --profile search --profile analytics up -d` adds
OpenSearch and ClickHouse. Traces: http://localhost:16686.

| Local port | What |
| --- | --- |
| 8080 | gateway (TS) |
| 8101 | go-identity |
| 4000 | realtime (Phoenix, `/ws`) |
| 15432 | Postgres (`zudomart`, `zudomart_test`, `atlas_dev`) |
| 16379 | Valkey |
| 14566 | LocalStack (SNS topic `zudomart-domain-events`, SQS job and consumer queues + DLQs) |
| 18333 | SeaweedFS S3 API (MinIO no longer publishes public images) |
| 7880 | LiveKit (`devkey` / local-only secret) |
| 4317/4318 | OTel collector |

Tests: `pnpm backend:test:go` (unit + integration against the compose Postgres; integration tests skip when it is down),
`pnpm backend:test:gateway`, `pnpm backend:test:realtime`, and `pnpm backend:check` (300-line limit, no raw SQL in TS).

## Layout

```
services/
  contracts/           buf (proto for internal gRPC) + events/ (JSON Schema per domain event, AsyncAPI 3 doc)
  go/
    go.work
    platform/          shared Go libraries (below)
    modules/<service>/ one Go module per JSON service: auth, users, currency, admin (go-identity) are built, the rest are skeletons
    deployables/       6 binaries that group modules; one Dockerfile each (build context services/go)
  typescript/gateway/  Zudojs (@zudojs/http) edge: CORS, rate limit, JWKS verification, upstream routing
  elixir/realtime/     Phoenix: raw JSON WebSocket at /ws, PubSub topics, Presence, JWKS auth, domain event router
  python/              pointer to apps/intelligence (not duplicated)
  scripts/             CI checks and test runners
infra/local/           docker-compose + bootstrap scripts;   infra/aws/  Terraform module layout (README only)
```

### Internal gRPC contracts

Protos live in `contracts/proto`; regenerate with
`docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -v "$PWD":/workspace -w /workspace bufbuild/buf generate` from
`services/contracts`. Generated Go is committed under `contracts/gen/go` (Go module `zudomart/contracts`, in `go.work`);
other languages stay ignored.

| Proto | Server | Callers |
| --- | --- | --- |
| `zudomart/money/v1/live_money.proto` (`LiveMoneyService`: `ChargeGiftAndCreditCreator`, `SettleBattle`, `GetBattleGiftTotals`, `GetCoinBalance`) | go-money (`MONEY_GRPC_ADDRESS`, default `:9103`) | go-live |
| `zudomart/auth/v1/account_directory.proto` | go-identity | admin, moderation |

Go import: `moneyv1 "zudomart/contracts/gen/go/zudomart/money/v1"`.

### Go deployables (ECS/Fargate)

| Deployable | Modules | Why grouped |
| --- | --- | --- |
| go-identity | auth, users, currency, admin | low write volume, shared session/JWKS concerns |
| go-commerce | catalog, inventory, orders, analytics | stock reservation and order creation in one transaction |
| go-money | payments, wallet, ledger, escrow, subscriptions, creators, rewards | every balance change commits in one Postgres transaction |
| go-live | live | hot, latency-sensitive state machine (sessions, guests, battles, gifts) |
| go-ads | ads | separate scaling and billing cadence |
| go-trust | moderation | async, queue-driven |

A module never imports another module's packages (use `platform/identityports`, events or gRPC). Splitting a module into its own deployable is a `main.go` change.

### Go platform (`services/go/platform`)

| Package | Provides |
| --- | --- |
| `config` | `EnvironmentReader` that collects every missing/invalid variable into one error |
| `logging` | slog JSON logger that redacts passwords, tokens, codes, card/bank fields |
| `money` | `Money{AmountMinor int64, Currency}` with overflow-checked maths, basis points, lossless allocation; JSON `{amountMinor, currency}` |
| `idempotency` | `Idempotency-Key` middleware (8-128 `[A-Za-z0-9_-]`, scoped to principal + route, 409 in flight, 422 on reuse with a different body, replay with `Idempotent-Replayed: true`) backed by Redis |
| `jwtauth` | access-token verifier (remote JWKS with cache, or a local key set) and `RequireVerifiedAccessToken` middleware |
| `postgres` | pgx pool for ent, schema-scoped URLs (`search_path`), embedded migration runner |
| `events` | `DomainEventPublisher`, `JobQueue`, outbox relay, event envelope; SNS/SQS implementations; recording/discarding publishers for tests and local runs |
| `health` | `/healthz` and `/readyz` with named readiness checks |
| `telemetry` | OpenTelemetry tracing (OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set) and HTTP instrumentation |
| `httpserver` | graceful server, request id, panic recovery, access log, JSON/error helpers, `ApiError`, `CursorPage` |
| `servicemodule` | `Module` interface and `RunDeployableWithModulesUntilTerminationSignal` |

## Conventions

- Almost no comments. Long, self-explanatory names: `RotateRefreshTokenAndDetectReuse`, `rotateRefreshTokenAndDetectReuse`.
- Every backend file is at most 300 lines (generated code excluded). CI enforces it.
- File names follow [`zudojsStructure.md`](zudojsStructure.md): `<name>.<kind>.<ext>` with camelCase multi-word names in every
  language (`registerAccount.handler.go`, `upstreamDispatch.handler.ts`); Python is the one snake_case exception.
- Money is always integer minor units + ISO currency; coins are a separate integer unit. Never hardcode NGN.
- Errors: `{ "message", "code", "issues"?: [{path, message}] }`. Single resources are returned as the object; every list
  is `{ "data": [...], "nextCursor": string|null }`.
- Every money-moving route requires `Idempotency-Key`. Every route declares its permission and denies by default.
- Validate every body, query and param before it reaches a command. Reject unknown JSON fields.

### Persistence

- **One Aurora PostgreSQL cluster, one database, one schema per owning service.** Only the owner writes its tables. Each
  service logs in as `svc_<service>`, which owns its schema; every service role is a member of `zudomart_readers`, and
  owners grant read access table by table (column by column for sensitive tables) in their own migrations. See
  `modules/auth/src/migrations/*_grant_read_access_to_other_services.up.sql`: other services can read account ids,
  usernames and names, but never password hashes, sessions or keys.
- **TypeScript services: Prisma only** (no raw SQL, no hand-written `.sql`, except `prisma migrate` output).
- **Go services: ent + Atlas** (decision to confirm with the owner). The schema is Go code (`src/databases/schema`), ent
  generates a typed query client, and Atlas diffs the schema against the replayed migration directory to write versioned
  migrations. Migrations are embedded in the binary and applied at start-up with golang-migrate (advisory-locked, so it is
  safe with many replicas). Why ent rather than sqlc: sqlc needs hand-written SQL for every query, and the owner banned
  hand-written SQL in the TS monolith. ent is the closest Go equivalent to Prisma (declarative schema, typed client, no
  string SQL, row locks via `ForUpdate`), and Atlas gives Prisma-style generated migrations. The only hand-written SQL is
  in the rare manual migration (grants), which goes through `-rehash` so Atlas still verifies the directory.

```bash
cd services/go/modules/<service>
(cd src/databases && go generate ./)                      # after editing src/databases/schema, writes src/generated/ent
go run ./cmd/generateMigration <name>                     # Atlas diff → src/migrations (needs pnpm backend:up)
go run ./cmd/generateMigration -rehash                    # after adding a manual migration file
```

### Async work: outbox, domain events and jobs

No Kafka on day one. A command writes its business rows **and** an `outbox_events` row in one transaction. The module's
outbox relay (`events.RelayOutboxEventsUntilContextDone`, `FOR UPDATE SKIP LOCKED`) publishes through the
`DomainEventPublisher` interface: SNS topic `zudomart-domain-events` with the `eventType` message attribute, fanned out to
one SQS queue per consumer (filter policies) with a DLQ. Background jobs (email, media, thumbnails, reports, payouts,
search indexing) go through `JobQueue` (SQS). Consumers must be idempotent on the envelope/job id. Kafka/MSK or
EventBridge can replace the implementation later without touching business code.

Event types are `<entity>.<pastTense>` (`account.registered`, `order.created`, `gift.sent`). Each event has a JSON Schema
in `contracts/events/schemas/<type>.v<version>.json` and an entry in `contracts/events/asyncapi.yaml`; the envelope is
`{id, type, source, subject, schemaVersion, occurredAt, data}`.

Python returns scores only; Go/TS apply a deterministic allow / hold / review / reject policy and own the decision.

## go-identity: auth, users, currency, admin

All four modules live in `deployables/go-identity` and follow the Zudojs Go layout (`modules/<service>/src/modules/<feature>/{commands,queries,controllers,routes,dtos,validators,models,services,repositories,events}`;
each command or query is a folder with `<name>.command.go` + `<name>.handler.go`). Modules never import each other. They talk
through narrow ports in `platform/identityports` (registered at start-up, in-process today, replaceable by gRPC when a module is split out):
`AccountDirectory` (auth), `UsernameGuard` and `AccountCountryLookup` (users), `StaffTokenService` (auth), `AuditRecorder` and
`PlatformSettings` (admin). `platform/staffauth` verifies staff tokens and step-up tokens; `platform/usernames` holds the username rules shared by auth and users.

### auth (`modules/auth`)

Matches `apps/mobile/src/services/auth.service.ts`:

| Route | Body → response |
| --- | --- |
| `POST /api/v1/auth/otp/send` | `{destination, purpose: signup\|reset\|login}` → `{expiresIn}`; never reveals whether an account exists |
| `POST /api/v1/auth/otp/verify` | `{destination, code, purpose}` → `{otpToken}`; codes are HMAC-hashed, 5 min, single use, locked after 5 failures |
| `POST /api/v1/auth/register` | `{email, birthday, password, username?, name?, otpToken}` → 201 `AuthSession` |
| `POST /api/v1/auth/login` | `{identifier (email or username), password}` → `AuthSession` |
| `POST /api/v1/auth/refresh` | `{refreshToken}` → `{accessToken, refreshToken, expiresIn, tokenType}`; rotation, reuse revokes the session |
| `POST /api/v1/auth/logout` | bearer token, `{refreshToken?}` → 204 |
| `POST /api/v1/auth/password/reset` | `{otpToken (purpose reset), password}` → 204; revokes every session |
| `POST /api/v1/auth/password/change` | bearer, `{currentPassword, newPassword}` → 204; keeps the current session, revokes the rest (`currentPassword` may be empty for social-only accounts) |
| `POST /api/v1/auth/google` | `{idToken, nonce}` → `AuthSession` (201 when new) |
| `POST /api/v1/auth/apple` | `{identityToken, nonce, fullName?: {givenName, familyName}}` → `AuthSession` (201 when new) |
| `GET /api/v1/auth/sessions` | bearer → `{data: [{id, userAgent, ipAddress, createdAt, lastUsedAt, current}], nextCursor}` |
| `DELETE /api/v1/auth/sessions/{id}` / `DELETE /api/v1/auth/sessions` | bearer → 204; the second revokes every other session |
| `GET /api/v1/auth/username-available?username=` | `{available, reason?: taken\|reserved\|invalid\|recently_used\|withheld}` |
| `GET /.well-known/jwks.json` | public signing keys |

`AuthSession` is `{accessToken, refreshToken, expiresIn, tokenType, isNewUser, user}`. Passwords use argon2id (19 MiB, t=2, p=1). Access tokens are
15-minute EdDSA (Ed25519) JWTs with `sub`, `sid`, `roles`; signing keys are encrypted at rest (AES-GCM, KMS in production),
rotate every 30 days, are published in the JWKS 20 minutes before they sign, and stay published 20 minutes after retirement.
Google/Apple id tokens are verified against the providers' JWKS (cached), the `aud` must be one of `AUTH_GOOGLE_CLIENT_IDS` /
`AUTH_APPLE_CLIENT_IDS` (comma separated; an unconfigured provider answers `503 SOCIAL_SIGN_IN_NOT_CONFIGURED`), the nonce must match
(raw or SHA-256 hex), and an existing account is linked only when the provider reports a verified email. Not built yet: end-user MFA.
Events: `account.registered`, `account.loggedIn`, `account.passwordChanged`, `session.revoked`, `session.refreshTokenReuseDetected`, `account.deactivated`.

### users (`modules/users`)

Profiles are created lazily from the auth account on first access (one personal profile per account, handle = username).

| Route | Notes |
| --- | --- |
| `GET/PATCH /api/v1/users/me` | PATCH `{name?, bio?, website?, isPrivate?, avatarMediaId?, bannerMediaId?, avatarUrl?, bannerUrl?}` (`null` clears; unknown fields rejected; `verified` is server-only) |
| `GET /api/v1/users/{id}`, `GET /api/v1/users/username/{username}` | public view: no email, birthday or roles; follower counts are 0 here (follow state belongs to ts.social, which reads `profiles.is_private` through the read grant or the `profile.visibilityChanged` event) |
| `POST /api/v1/users/me/media/upload-intents` | `{purpose: avatar\|banner, contentType, sizeBytes}` → signed placeholder upload (`placeholder: true`); ts.media replaces it |
| `PATCH /api/v1/users/me/preferences` `{countryCode}`, `POST /api/v1/users/me/deactivate` | country feeds the currency resolver |
| `GET /api/v1/users/me/username-policy`, `PATCH /api/v1/users/me/username`, `GET /api/v1/auth/username-suggestion?seed=` | 30-day cooldown, 3 changes a year, old name quarantined 30 days (`USERS_USERNAME_*`); reserved and look-alike names blocked |
| `GET /api/v1/users/me/profiles`, `GET/PUT /api/v1/users/me/acting-profile` | `{data: [{id, kind: person\|creator\|business, type, name, handle, avatarUrl, ...}], nextCursor}` |
| `POST /api/v1/users/me/business-profiles`, `PATCH .../business-profiles/{id}`, `GET /api/v1/business-categories` | several categories per profile, custom ones stored as `pending_review` |
| `POST /api/v1/users/me/creator-profile` | checks `creator.requirements.minimumAccountAgeDays` from admin settings; followers/posts/strike thresholds are evaluated by the creators module |
| `GET/POST /api/v1/admin/usernames/reserved`, `DELETE .../reserved/{id}`, `POST /api/v1/admin/usernames/withheld`, `DELETE .../withheld/{username}?reason=` | staff + step-up, audited |

Privacy and data (`src/modules/{geo,addresses,consents,privacySettings,dataExport,accountDeletion,retention}`):
geo reference data (`GET /api/v1/geo/countries`, `/geo/countries/{code}/regions`, `/geo/regions/{id}/admin-areas|cities`; Nigeria has 36 states + FCT and all 774 LGAs, other supported countries are seeded at region level),
the address book (`/api/v1/users/me/addresses`), the consent ledger (`/api/v1/policies/current`, `/api/v1/consents` anonymous by `X-Device-Id`, `/api/v1/users/me/consents`, `.../consents/merge`, `.../terms-acceptances`),
`GET/PATCH /api/v1/users/me/privacy-settings` (personalization, personalized ads, marketing; events `privacy.settingsChanged`, `consent.granted`, `consent.withdrawn`),
data export (`/api/v1/users/me/data-exports`, async worker -> S3 -> expiring link) and deletion (`/api/v1/users/me/deletion-request`, grace period then `account.deletionExecuted`; other services anonymise on `account.deletionRequested`).
Retention categories are admin-editable and seeded as `retain` with no period and `needsLegalReview=true`; the 14-day grace period (`USERS_DELETION_GRACE_DAYS`) and the placeholder policy texts need legal review.
Other events: `profile.updated`, `profile.visibilityChanged`, `username.changed`, `username.withheld`, `businessProfile.created`, `creatorProfile.created`.

### currency (`modules/currency`)

`GET /api/v1/locale` resolves profile country, then the trusted CDN country header (`CURRENCY_TRUSTED_COUNTRY_HEADER`), then `X-Client-Region`, then USD; unsupported countries answer USD with `isCountrySupported: false`.
`GET /api/v1/locale/countries`, `GET /api/v1/currencies`, `GET /api/v1/currency/convert?amountMinor&from&to` (integer minor units, rounded down),
staff: `GET /api/v1/admin/exchange-rates`, `PUT /api/v1/admin/exchange-rates/{currency}` (permission `currency.rates.write` + step-up, decimal string rate, >30% jumps need `confirmLargeChange`). Rates are append-only revisions (`exchangeRate.updated`), stored as integers (units per USD x 1e8).

### admin (`modules/admin`)

Staff are separate from customer accounts (tokens use audience `zudomart-admin`, step-up tokens `zudomart-admin-step-up`, header `X-Step-Up-Token`, 5 minutes).
Superadmins exist only through the CLI: `cd services/go/modules/admin && ADMIN_DATABASE_URL=... ADMIN_BOOTSTRAP_PASSWORD=... go run ./cmd/bootstrapSuperadmin -email you@example.com -name "Your Name"`.
Login is password then TOTP (`/api/v1/admin/auth/login`, `.../mfa/enroll/start|confirm`, `.../mfa/verify`, `.../refresh`, `.../logout`, `.../me`, `.../step-up`); admins are invited by a superadmin (`/api/v1/admin/admins`, `.../permissions`, `.../disable`, `/api/v1/admin/auth/accept-invitation`).
Settings (`/api/v1/admin/config[/{key}]`, optimistic `expectedVersion` + `reason`, step-up): `creator.requirements`, `monetization.policy`, `gift.shareTiers` (creator share <= 7000 bps). Public read: `GET /api/v1/platform-config/creator-requirements`; other services read settings through `GET /api/v1/internal/platform-config/{key}` with `X-Internal-Token` (never routed by the gateway).
Audit log: `GET /api/v1/admin/audit`, `GET /api/v1/admin/audit/export` (NDJSON, step-up). Events: `staff.invited`, `platformSetting.changed`.

Gateway: `/api/v1/admin/*` is routed with `authentication: "optional"` because staff tokens have a different audience; the modules verify them. `/api/v1/internal/*` is not routed.

## Adding a service or module (template for per-service agents)

1. Read the service's block in `microservicesPlan.json` and its rows in `docs/backendPlan.md`; port rules and validators
   from `apps/api/src/modules/<x>` without editing it.
2. Go: work in `services/go/modules/<service>` using the Zudojs layout from [`zudojsStructure.md`](zudojsStructure.md); copy auth or currency:
   ```
   <service>.module.go                       facade at the module root (package <service>) forwarding to src
   <service>.integration_test.go             real Postgres, fresh schema, HTTP-level flow
   cmd/generateMigration/main.go             copy from auth, change the ent import
   src/app.go                                Start<Service>ModuleWithSettings: config, migrations, ent client, container, routes, workers
   src/container/<service>.container.go      Container (Client, Settings, Logger, Now, RunInTransaction) shared by handlers
   src/configs/<service>.config.go           XSettings read with platform/config (env prefix <SERVICE>_)
   src/databases/{generate.go,schema/}       ent schema (include outboxEvent.schema.go), generates into src/generated/ent
   src/migrations/                           Atlas output + embedded.migrations.go + a grants migration
   src/events/outbox.event.go                outbox enqueue + EntOutboxStore (copy from auth)
   src/modules/<feature>/{commands,queries}/<name>/<name>.command.go + <name>.handler.go, controllers, routes, dtos, validators, services
   ```
   Add `<SERVICE>_DATABASE_URL` (role `svc_<service>`) to `services/go/.env.example`.
3. TypeScript: `services/typescript/<service>` (Zudojs + Prisma, `<name>.<kind>.ts`), then add its route prefix to
   `typescript/gateway/src/routes/upstream.routes.ts` and its URL to `gateway.config.ts`.
4. Contracts: add each new event's JSON Schema + AsyncAPI message, and proto files for any internal gRPC.
5. Infra: if the service consumes events, add its queue in `infra/local/localstack/create-topics-and-queues.sh`.
6. Gateway: add the route prefix with `authentication: "required"` unless the endpoint is public.
7. Prove it: unit table tests, an integration test, `pnpm backend:check`, and the frontend mock for that domain switched off.

## go-live: live (`modules/live`)

Zudojs Go layout like go-identity (`src/{configs,container,databases/schema,errors,events,generated/ent,integrations,interfaces,jobs,middlewares,migrations,modules,services,types,utils}`;
each command/query is `commands|queries/<name>/<name>.command|query.go` + `<name>.handler.go`; modules: sessions, stage, battles, gifts, points). `pnpm backend:dev:live` runs it on :8102.

- Writes only the `live` schema. Money goes through go-money gRPC (`LIVE_MONEY_GRPC_ADDRESS`; without it a clearly logged in-memory fake is used outside production). Names and creator-program roles come from the auth account directory (`LIVE_ACCOUNT_DIRECTORY_GRPC_ADDRESS`, otherwise the granted `auth.accounts` columns).
- Tokens are verified in Go with `platform/jwtauth` against the auth JWKS (`AUTH_JWKS_URL`); the gateway headers are not trusted.
- LiveKit tokens (host, guest, viewer grants) via `livekit/protocol`; remove/mute use the LiveKit RoomService against `LIVEKIT_URL`.
- Durable timers: DB deadlines plus a 1 s sweep (`LIVE_TIMER_POLL_INTERVAL`). Domain events (`gift.sent`, `battle.*`, `guest.*`, `goal.*`, `leaderboard.updated`, `stage.updated`, `live.*`) go through the outbox; Phoenix consumes them from `realtime-domain-events` and fans them out to `live:{liveId}` (`guest.invited` to `user:{id}`).
- Migrations: `cd services/go/modules/live && go run ./cmd/generateMigration <name>`; ent codegen: `cd src/databases && go generate ./...`.
