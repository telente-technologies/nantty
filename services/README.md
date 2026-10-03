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
    modules/<service>/ one Go module per JSON service: auth (complete), the rest are skeletons
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

A module never imports another module's `internal/`. Splitting a module into its own deployable is a `main.go` change.

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
- File names: Go `snake_case.kind.go` (`register_account.command.go`, `auth.routes.go`); TypeScript `<name>.<kind>.ts` with
  camelCase names (`upstreamDispatch.handler.ts`); Python `snake_case_kind.py`; Elixir idiomatic `snake_case.ex`.
- Money is always integer minor units + ISO currency; coins are a separate integer unit. Never hardcode NGN.
- Errors: `{ "message", "code", "issues"?: [{path, message}] }`. Single resources are returned as the object; every list
  is `{ "data": [...], "nextCursor": string|null }`.
- Every money-moving route requires `Idempotency-Key`. Every route declares its permission and denies by default.
- Validate every body, query and param before it reaches a command. Reject unknown JSON fields.

### Persistence

- **One Aurora PostgreSQL cluster, one database, one schema per owning service.** Only the owner writes its tables. Each
  service logs in as `svc_<service>`, which owns its schema; every service role is a member of `zudomart_readers`, and
  owners grant read access table by table (column by column for sensitive tables) in their own migrations. See
  `modules/auth/internal/migrations/*_grant_read_access_to_other_services.up.sql`: other services can read account ids,
  usernames and names, but never password hashes, sessions or keys.
- **TypeScript services: Prisma only** (no raw SQL, no hand-written `.sql`, except `prisma migrate` output).
- **Go services: ent + Atlas** (decision to confirm with the owner). The schema is Go code (`internal/ent/schema`), ent
  generates a typed query client, and Atlas diffs the schema against the replayed migration directory to write versioned
  migrations. Migrations are embedded in the binary and applied at start-up with golang-migrate (advisory-locked, so it is
  safe with many replicas). Why ent rather than sqlc: sqlc needs hand-written SQL for every query, and the owner banned
  hand-written SQL in the TS monolith. ent is the closest Go equivalent to Prisma (declarative schema, typed client, no
  string SQL, row locks via `ForUpdate`), and Atlas gives Prisma-style generated migrations. The only hand-written SQL is
  in the rare manual migration (grants), which goes through `-rehash` so Atlas still verifies the directory.

```bash
cd services/go/modules/<service>
go generate ./internal/ent                                # after editing internal/ent/schema
go run ./cmd/generate-migration <name>                    # Atlas diff → internal/migrations (needs pnpm backend:up)
go run ./cmd/generate-migration -rehash                   # after adding a manual migration file
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

## Auth (the reference vertical slice)

`modules/auth` + `deployables/go-identity` + `typescript/gateway`. Matches `apps/mobile/src/services/auth.service.ts`:

| Route | Body → response |
| --- | --- |
| `POST /api/v1/auth/otp/send` | `{destination, purpose: signup\|reset\|login}` → `{expiresIn}`; never reveals whether an account exists |
| `POST /api/v1/auth/otp/verify` | `{destination, code, purpose}` → `{otpToken}`; codes are HMAC-hashed, 5 min, single use, locked after 5 failures |
| `POST /api/v1/auth/register` | `{email, birthday, password, username?, name?, otpToken}` → 201 `AuthSession` |
| `POST /api/v1/auth/login` | `{identifier (email or username), password}` → `AuthSession` |
| `POST /api/v1/auth/refresh` | `{refreshToken}` → `{accessToken, refreshToken, expiresIn, tokenType}`; rotation, reuse revokes the session |
| `POST /api/v1/auth/logout` | bearer token, `{refreshToken?}` → 204 |
| `GET /api/v1/auth/username-available?username=` | `{available}` |
| `GET /.well-known/jwks.json` | public signing keys |

`AuthSession` is `{accessToken, refreshToken, expiresIn, tokenType, isNewUser, user}`; `user` has the mobile `User` fields
(profile counters are zero until go.users serves profiles). Passwords use argon2id (19 MiB, t=2, p=1). Access tokens are
15-minute EdDSA (Ed25519) JWTs with `sub`, `sid`, `roles`; signing keys are encrypted at rest (AES-GCM, KMS in production),
rotate every 30 days, are published in the JWKS 20 minutes before they sign, and stay published 20 minutes after retirement.
Not built yet: password reset/change, Google/Apple sign-in, session listing, MFA.

## Adding a service or module (template for per-service agents)

1. Read the service's block in `microservicesPlan.json` and its rows in `docs/backendPlan.md`; port rules and validators
   from `apps/api/src/modules/<x>` without editing it.
2. Go: work in `services/go/modules/<service>` (the skeleton already exists and is wired into its deployable). Copy the
   auth layout:
   ```
   <service>.module.go                       NewXModule (servicemodule.Factory): config, migrations, ent client, routes, workers
   cmd/generate-migration/main.go            copy from auth, change the ent import
   internal/config/<service>.config.go       XSettings read with platform/config (env prefix <SERVICE>_)
   internal/ent/schema/*.schema.go           include an outbox_event.schema.go (copy from auth)
   internal/ent/generate.go                  go:generate line (copy from auth)
   internal/migrations/                      generated + embedded.migrations.go + a grants migration
   internal/application/<verb_noun>.command.go / <noun>.query.go   one use case per file, transaction + outbox in the same tx
   internal/httpapi/<service>.routes.go, .handlers.go, .dto.go, .validator.go
   <service>.module_integration_test.go      real Postgres, fresh schema, HTTP-level flow
   ```
   Add `<SERVICE>_DATABASE_URL` (role `svc_<service>`) to `services/go/.env.example`.
3. TypeScript: `services/typescript/<service>` (Zudojs + Prisma, `<name>.<kind>.ts`), then add its route prefix to
   `typescript/gateway/src/routes/upstream.routes.ts` and its URL to `gateway.config.ts`.
4. Contracts: add each new event's JSON Schema + AsyncAPI message, and proto files for any internal gRPC.
5. Infra: if the service consumes events, add its queue in `infra/local/localstack/create-topics-and-queues.sh`.
6. Gateway: add the route prefix with `authentication: "required"` unless the endpoint is public.
7. Prove it: unit table tests, an integration test, `pnpm backend:check`, and the frontend mock for that domain switched off.
