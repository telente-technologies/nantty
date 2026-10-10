# DevOps architecture

As of 2026-10-03. Labels: **EXISTING** (cite path), **PROPOSED**, **OPTIONAL FUTURE**. Nothing in `infra/aws` is applied; everything AWS here is PROPOSED.

## 1. What exists today

| Item | Status | Evidence |
| --- | --- | --- |
| `Backend` workflow: file-length (300) and no-raw-SQL checks; Go build/vet/test against compose Postgres; `govulncheck`; gateway typecheck + vitest; realtime tests in Docker | EXISTING (`backend.yml` untracked in git at audit time) | `.github/workflows/backend.yml` |
| `androidApk.yml`: mobile APK build | EXISTING | `.github/workflows/androidApk.yml` |
| Scripts | EXISTING | `services/scripts/{check-backend-file-lengths,check-no-raw-sql-in-typescript,test-go-workspace,test-realtime-in-docker}.sh` |
| Dockerfiles: 6 Go (distroless nonroot), gateway, realtime, `services/python/intelligence` | EXISTING | `services/go/deployables/*/Dockerfile` |
| Local stack: Postgres/PostGIS 17, Valkey 9, RabbitMQ 4 (management UI 127.0.0.1:15672, definitions from `infra/local/rabbitmq`), LocalStack (SES only), SeaweedFS, LiveKit, OTel collector, Jaeger; ports on 127.0.0.1 | EXISTING | `infra/local/docker-compose.yml` |
| Atlas migrations embedded and applied at service start | EXISTING | `platform/postgres` `ApplyPendingMigrationsFromEmbeddedDirectory` |
| Terraform layout | PROPOSED, README only | `infra/aws/README.md` |
| Not present | CI for 6 Next apps, mobile (lint/typecheck/build), `services/python/intelligence`; Dockerfiles for Next apps; deploy pipeline; `pnpm audit`, SAST, secret scan, container scan; E2E, contract, load tests; frontend tests (0) | `inventory.md` s6, s8 |

## 2. DevOps architecture

```mermaid
flowchart LR
  DEV[Developer] --> GIT[GitHub repo]
  GIT --> PR[Pull request]
  PR --> CI[GitHub Actions CI]
  CI --> Q[lint, typecheck, tests,\nsecurity scans]
  Q --> B[Build images]
  B --> ECR[(ECR per env account)]
  ECR --> DEP[Deploy to ECS Fargate]
  TF[Terraform infra/aws] --> INF[VPC, Aurora, Valkey,\nAmazon MQ RabbitMQ, S3, ALB, WAF]
  INF --> DEP
  DEP --> MON[CloudWatch + OTel\nalarms and dashboards]
  MON -. alarm .-> RB[Auto rollback]
  RB --> DEP
```

Rules: CI authenticates to AWS with GitHub OIDC (no stored keys); one deploy role per environment account; Terraform state in S3 with locking, one state per environment; `plan` posted on PR, `apply` from main only after approval.

## 3. CI/CD pipeline

```mermaid
flowchart TD
  A[PR opened] --> B[Lint + format + typecheck]
  B --> C[Unit tests]
  C --> D[Integration tests\ndocker compose]
  D --> E[Security: SAST, dependency,\nsecret scan]
  E --> F[Build images]
  F --> G[Container scan\nTrivy / ECR scan]
  G --> H{merge to main}
  H --> I[Push to ECR, tag git sha]
  I --> J[Atlas migrate\npre-deploy ECS task, staging]
  J --> K[Deploy staging]
  K --> L[Smoke + contract + E2E]
  L --> M{Manual approval\nprod}
  M --> N[Atlas expand migration, prod]
  N --> O[Deploy prod:\nrolling, blue/green for go-money]
  O --> P[Health checks + canary window]
  P -->|alarm| Q[Automatic rollback]
  P -->|ok| R[Done]
```

| Stage | Detail | Status |
| --- | --- | --- |
| Lint / format / typecheck | `golangci-lint`, `gofmt`, `go vet`; `tsc` + eslint + stylelint for every Next app and mobile; `ruff` + `mypy` for Python; `mix format --check` + credo. Path filters per app | Go vet only EXISTING; rest PROPOSED |
| Conventions | file-length and no-raw-SQL | EXISTING |
| Unit | `go test -race`, vitest, pytest, ExUnit, jest | Go/gateway/realtime/intelligence EXISTING, frontend none |
| Integration | `docker compose up` Postgres, Valkey, RabbitMQ, LocalStack (SES); per-service ent + Atlas against real DB | auth only EXISTING |
| SAST | `semgrep` (TS/Go/Python), `gosec` via golangci-lint, CodeQL | PROPOSED |
| Dependencies | `govulncheck` EXISTING; `pnpm audit --prod`, `pip-audit`, `mix deps.audit`, Dependabot/Renovate | partly PROPOSED |
| Secret scan | gitleaks on PR diff and full history weekly | PROPOSED |
| Build | Docker buildx, cache; SBOM (syft); image tag = git sha, immutable ECR tags | PROPOSED |
| Container scan | Trivy fail on HIGH/CRITICAL with fix available; ECR scan on push | PROPOSED |
| IaC scan | `terraform validate`, `tflint`, `checkov` | PROPOSED |
| Migration check | `atlas migrate lint` against `atlas_dev` DB; fail on destructive change not marked contract phase | PROPOSED |
| Deploy | ECS rolling (min healthy 100%, max 200%, circuit breaker with rollback) for all but go-money; CodeDeploy blue/green with canary 10% for 5 min and alarm hooks for go-money (ledger) | PROPOSED |
| Rollback | ECS circuit breaker plus CloudWatch alarms (5xx rate, p99, ledger imbalance); schema stays expand-compatible so image rollback is safe | PROPOSED |

## 4. Environments

| Concern | local | dev | staging | prod |
| --- | --- | --- | --- | --- |
| AWS account | none (Docker RabbitMQ, LocalStack SES) | shared `zudomart-dev` | `zudomart-staging` | `zudomart-prod` (all in an AWS Organization) |
| Data | compose volumes, synthetic seed | synthetic | synthetic or masked, never prod copies | real |
| Secrets | `.env` from `*.example`, throwaway keys | Secrets Manager (dev) | Secrets Manager (staging) | Secrets Manager (prod), separate KMS keys |
| Payment providers | test/sandbox | sandbox | sandbox | live keys, only in prod account |
| Config | `.env.example` | Terraform vars | Terraform vars | Terraform vars, reviewed |
| Access | developer machine | all engineers via SSO | engineers via SSO | few, break-glass, MFA, read-only default |
| Deploy | manual | auto on merge | auto on merge | manual approval |
| Egress | open | open | restricted | allow-list |

Guarantee that local cannot reach prod: (1) separate AWS accounts with no cross-account roles from dev/local to prod; (2) prod DB and Valkey in private subnets with no public endpoint, reachable only via SSM from approved roles; (3) prod secrets exist only in the prod account, no copy in CI variables or repo; (4) the Go config reader refuses `DOMAIN_EVENTS_TOPIC_ARN` ARNs from another account via an `ENVIRONMENT` check (PROPOSED, a startup assertion) and production mode already refuses log OTP delivery (EXISTING); (5) CI deploy roles trust only the branch/environment claim in the GitHub OIDC token.

## 5. Migrations

| Rule | Detail |
| --- | --- |
| Tool | Atlas versioned migrations from ent schemas, one directory per module (EXISTING for auth, live) |
| Today | applied at service start by the service itself (EXISTING). In prod this races across tasks and gives the runtime role DDL rights |
| Target | one-off ECS task `migrate` per deployable using a separate migration DB role (owner of schema), run before the service update, deployment aborts on failure. Runtime role keeps DML only |
| Expand / contract | Release N: add nullable column / new table / dual-write. Release N+1: backfill, switch reads. Release N+2: drop old. No rename or drop in the same release as code that stops using it |
| Locks | `SET lock_timeout`, `CREATE INDEX CONCURRENTLY` (separate non-transactional file), batch backfills |
| Down files | exist but are not used in prod; rollback = roll back image, keep expand schema |
| Prisma (TS) | same rules; `prisma migrate deploy` in the same pre-deploy task |

## 6. AWS mapping and why

| Service | Used for | Why (and why not the alternative) | Status |
| --- | --- | --- | --- |
| Route 53 | DNS, health checks, failover records | native alias to CloudFront/ALB, cheap | PROPOSED |
| CloudFront | media and static CDN, edge TLS, WAF attach | cut media egress and latency; OAC keeps S3 private; signed URLs for paid media | PROPOSED |
| WAF | managed rules, rate rules on auth | blocks commodity attacks before the gateway | PROPOSED |
| ALB | HTTP + WebSocket ingress to gateway, realtime, BFFs | simplest L7 for Fargate; raised idle timeout for `/ws` | PROPOSED |
| ECS Fargate | all 11 deployables | no node management, no K8s ops burden for a small team; per-task IAM | PROPOSED (owner decision) |
| ECR | image registry with scan on push, immutable tags | same account as runtime, replication to DR region | PROPOSED |
| Aurora PostgreSQL + PostGIS | single cluster, schema per service | owner decision; PITR, Multi-AZ failover, read replica; one cluster keeps cost and ops low | PROPOSED |
| ElastiCache Valkey | cache, rate limit, idempotency, nonces, presence | managed, Multi-AZ, cheaper than Redis OSS licensing | PROPOSED |
| S3 | media, exports, KYB docs, Parquet, backups | durable, versioned, lifecycle rules | PROPOSED |
| Amazon MQ for RabbitMQ (RabbitMQ adopted, owner, 2026-10-03) | domain event fan-out (`zudomart.events`) and job queues (`zudomart.jobs`), quorum queues with retry queues and DLQs | **cluster deployment** (3 brokers across AZs, `mq.m7g.large` prod / single-instance `mq.m7g.medium` staging), **private subnets only**, no public accessibility, security group allows 5671 from ECS task SGs only; TLS (`amqps`), one user per service from Secrets Manager; definitions imported via the management API on deploy; same broker family as local Docker | RabbitMQ EXISTING locally, Amazon MQ PROPOSED |
| SES feedback SNS → SQS | bounce/complaint feedback only | SES cannot publish to RabbitMQ; one small SQS queue `notifications-ses-feedback` | PROPOSED |
| Secrets Manager + KMS | secrets, rotation, envelope keys | per-task injection, audited | PROPOSED |
| IAM | task roles, OIDC deploy roles | least privilege per service | PROPOSED |
| VPC, private subnets, NAT, endpoints | network isolation | private app/data subnets; start with one NAT per AZ for prod, one total for staging; add S3, SQS (SES feedback), ECR, Secrets Manager, KMS, Logs endpoints to cut NAT data cost; Amazon MQ sits inside the VPC | PROPOSED |
| CloudTrail | API audit, org trail | forensic baseline | PROPOSED |
| CloudWatch | logs, metrics, alarms, dashboards | zero extra ops; OTel collector sidecar exports traces to X-Ray (see `observability.md`) | PROPOSED |
| Step Functions | payout runs, dispute timelines only if real orchestration | avoid until needed | OPTIONAL FUTURE |
| LiveKit | media plane (Cloud first, self-host later) | owner decision | PROPOSED |

### 6.1 ALB routing and provider webhooks

| Priority | Path | Target | Why |
| --- | --- | --- | --- |
| 20 | `/ws*` | realtime target group (idle timeout raised) | WebSocket |
| 100 | everything else | gateway target group | auth, rate limit, upstream routing |

Webhooks enter through the gateway. Its `/webhooks/` route sends only `POST` to go-money, forwards the request body as the exact received bytes (no JSON re-parse or re-serialisation) and passes `X-Paystack-Signature` through, so go-money verifies the signature over the raw body (pinned by the gateway test `webhook passthrough`). The gateway skips guest rate limits on these routes, and the WAF only lets Paystack's source IPs (52.31.139.75, 52.49.173.169, 52.214.14.220) reach `/webhooks/paystack` and blocks any `/internal` path.

Service-to-service HTTP goes through an internal ALB (host rule `<service>.svc.<env>.zudomart.internal`), which also gives the distroless Go images a health check. This design replaces the earlier ALB rule straight to go-money: go-money deploys with CodeDeploy blue/green, which swaps target groups on one listener, so a public rule on a second listener would keep pointing at the standby group after a swap. The old `/api/v1/payments/webhooks/*` paths are not routed. Paystack adopted (owner, 2026-10-03): the endpoint is `https://api.zudomart.com/webhooks/paystack`, set on the Paystack dashboard for live and test modes, and signed with `PAYSTACK_SECRET_KEY`.


## 7. NOT yet

| Technology | Do not adopt until | Trigger metric |
| --- | --- | --- |
| MSK (Kafka) or RabbitMQ streams | outbox + RabbitMQ queues cannot meet needs | sustained > 5,000 events/s on one queue, or need for replay > 14 days of ordered per-key streams for 3+ consumers, or broker CPU/memory alarms despite scaling the instance size |
| EKS / Kubernetes | Fargate limits hit | > 40 services, or need for daemonsets/GPUs/custom schedulers, or Fargate cost > 2x equivalent EC2 at steady load |
| Service mesh | mTLS/traffic policy needed beyond SGs | compliance requires mTLS between services, or canary routing needed across > 10 services (try ECS Service Connect first) |
| OpenSearch | Postgres FTS + trigram insufficient | search p95 > 300 ms at > 50 qps on catalog > 1M products, or ranking features needing BM25 + vectors |
| ClickHouse | analytics queries hurt OLTP or Parquet/Athena too slow | > 50M events/day, or dashboard queries p95 > 10 s on Aurora replica |
| Multi-region active-active | single-region DR RTO unacceptable or regulatory | contractual RTO < 15 min, or > 15% revenue outside one region's latency reach |
| Database sharding | single writer saturated | writer CPU > 70% sustained after read replicas and index work, or table > 1 TB with unpartitionable access |

## 8. Testing architecture

| Layer | Scope | Tooling | Where | Status |
| --- | --- | --- | --- | --- |
| Unit | pure domain: splits, pricing, state machines, money allocation | go test (table tests), vitest, pytest, ExUnit | PR | partial |
| Property | ledger postings always balance, never negative | `rapid` or `testing/quick` | PR | PROPOSED |
| Integration | service + Postgres + Valkey + RabbitMQ | compose / Testcontainers | PR | auth only |
| API | HTTP black-box per service from OpenAPI | `go-http-handler-testing` style, schemathesis | PR | PROPOSED |
| DB | constraints, grants, role permissions, migrations on a copy of prior schema | Atlas lint, SQL tests | PR | PROPOSED |
| Contract | every frontend mock route (`apps/*/src/mocks`) matches a backend OpenAPI operation; events validated against `services/contracts/events/schemas` | custom runner using mocks as consumer fixtures | PR | PROPOSED |
| Frontend | component and BFF route tests | vitest + Testing Library, jest (mobile) | PR | 0 today |
| E2E | signup, post, follow, chat, buy coins, gift, battle, checkout, fulfil, payout; ends with trial balance 0 | Playwright (web), Maestro (mobile) | staging | PROPOSED |
| Load | checkout, gift bursts, feed, 1,000 live viewers | k6, LiveKit load tester | staging nightly | PROPOSED |
| Security | IDOR, refresh reuse, webhook signature, idempotency conflict, enumeration; ZAP baseline | ported from the old monolith's security tests, OWASP ZAP | PR + nightly | PROPOSED |
| Migration | apply all migrations to empty DB and to previous release snapshot, run expand-compat tests against N-1 image | Atlas + CI | PR | PROPOSED |
| Failure / chaos | kill Redis, reboot a RabbitMQ broker, 500 from Python, payment provider timeout, DB failover | toxiproxy, AWS FIS in staging | staging weekly | PROPOSED |

### Must pass before prod (financial flows)

| # | Gate |
| --- | --- |
| 1 | Ledger property tests: balanced, no negative wallet, no float anywhere (int64 minor units) |
| 2 | Concurrency test: 100 parallel gift/withdraw requests cannot overdraw; idempotent replay returns the original response |
| 3 | Webhook tests: bad signature rejected, duplicate event processed once, out-of-order handled |
| 4 | Provider sandbox E2E for top-up, checkout, refund, payout, including failure and timeout paths |
| 5 | Reconciliation job against provider statement in staging with zero unexplained difference |
| 6 | Trial balance = 0 after the full E2E run; ledger imbalance alarm tested by injecting an imbalance |
| 7 | Authorization tests: IDOR on wallet, order, store, payout; admin step-up required |
| 8 | Migration expand/contract verified against previous release; rollback rehearsed |
| 9 | Load test meets SLOs in `observability.md` (gift p99 300 ms, checkout availability) |
| 10 | Restore drill completed within RTO in the last 90 days (`disaster-recovery.md`) |
| 11 | Security scans clean of HIGH/CRITICAL; secrets scan clean |

## 9. Recommendations

### D1. CI for every app and service
- **Problem:** six Next apps, mobile, `services/python/intelligence` have no CI job; frontend has 0 tests.
- **Current:** `backend.yml` covers Go, gateway, realtime only; `pnpm test` runs nothing for the UI.
- **Why it matters:** regressions in BFFs (cookies, CSRF) reach main unseen.
- **Recommendation:** matrix job with typecheck, lint, build per Next app, path-filtered; add intelligence pytest and ruff; add gitleaks and `pnpm audit`.
- **Complexity:** S. **Risk:** low. **Priority: P1**, cheap and unblocks everything else.
- **Tag:** MVP.

### D2. Move migrations out of service startup
- **Problem:** each task applies migrations on boot with its runtime role.
- **Why it matters:** concurrent boot races, DDL privilege in runtime, slow starts, failed deploys mid-rollout.
- **Recommendation:** `migrate` subcommand in each deployable's `main.go` (or Atlas CLI image) run as a pre-deploy ECS task; keep embedded apply for local/dev only behind a flag.
- **Complexity:** S. **Risk:** low. **Priority: P1**, before first staging deploy.
- **Tag:** MVP.

### D3. Stand up staging Terraform first
- **Problem:** `infra/aws` is a README.
- **Recommendation:** order: network, ecr, aurora, valkey, messaging, ecs-service for gateway + go-identity, alb + waf; then others as each service gets real routes. Do not provision services that are still skeletons (16 of 18 Go modules).
- **Complexity:** L. **Risk:** medium. **Priority: P1**, auth is the only live service and needs a real environment to prove the path.
- **Tag:** MVP.

### D4. Contract-test harness using mocks as fixtures
- **Problem:** `packages/contracts` has no consumers; mocks drift from backend (`backendPlan.md` 2.13).
- **Recommendation:** one script that loads each app's mock registry and diffs against generated OpenAPI; run in CI, allow-list known gaps and shrink it.
- **Complexity:** M. **Risk:** low. **Priority: P2**, becomes P1 once the second service ships routes.
- **Tag:** Near term.

### D5. Fix outbox poison handling
- **Problem:** failed outbox batch retries forever with no attempt counter (`platform/events/outbox.relay.go`).
- **Recommendation:** add `attempts` and `dead_at` columns, alarm on dead rows. See `observability.md`.
- **Complexity:** S. **Risk:** low. **Priority: P2.**
- **Tag:** Near term.
