# Infra: Redis for intelligence, prod env audit, health/readiness, INFRA-004, Flutterwave egress (2026-10-11)

Nothing committed. No terraform plan/apply. package.json/lockfiles untouched.

## 1. Redis (Valkey) for intelligence
Decision: a **separate small Valkey** (`platform/intelligence_cache.tf`), not a logical DB on the shared cluster.
- The shared cluster runs `volatile-lru` and holds TTL'd security keys (session denylist, rate limits, idempotency). Intelligence's large write-heavy feature state would push those out under memory pressure, and a revoked session would then be accepted again.
- A security group can't scope access per logical DB or key prefix. A separate cluster lets its SG admit only the intelligence task.
Wiring:
- `valkey` module is generalized: `client_security_group_ids`, `name_suffix`, `description`, `maxmemory_policy`, `logical_database`. The cluster has TLS, AUTH token, KMS at rest and slow logs, and the `rediss://` URL is in Secrets Manager `zudomart/<env>/valkey-intelligence/url`.
- New SG `aws_security_group.intelligence` is attached to the intelligence task (plus the shared tasks SG). The intelligence cache SG admits only that SG on 6379.
- Intelligence secret `INTELLIGENCE_REDIS_URL` points at the new secret ARN, and the execution role may read it. Intelligence no longer gets the shared `VALKEY_URL` (`valkey = false`).
- `intelligence_valkey` is a variable in the env roots. Sizes: dev t4g.micro×1, staging t4g.small×1, prod t4g.small×2 (Multi-AZ).

## 1b. Production env audit (Go/TS/Elixir/Python config loaders vs task defs); fixes in `platform/{deploy,wiring,services}.tf`
- **APP_ENV was `dev`/`prod`.** Go compares it to `production`, so prod checks (placeholder-secret rejection, denylist requirement) never ran. Now `local.app_env`: prod→production, staging/dev→staging. `INTELLIGENCE_ENVIRONMENT` gets the same mapping; it was `dev`/`prod`, which failed intelligence's Literal validation at boot.
- All Go: `AUTH_SESSION_DENYLIST_URL` (secret; it is a hard fail when missing).
- go-identity: `AUTH_OTP_DELIVERY=event`, `ADMIN_INVITATION_DELIVERY=none` (only a log implementation exists), `ADMIN_CONSOLE_URL`, `USERS_MEDIA_PUBLIC_BASE_URL`, `USERS_SOCIAL/LIVE_INTERNAL_URL` plus token secrets.
- go-commerce: secrets `CATALOG_DATA_ENCRYPTION_KEY`, `USERS_INTERNAL_API_TOKEN`, `MEDIA_INTERNAL_TOKEN`, `ORDERS_SOCIAL_INTERNAL_TOKEN`; env `MEDIA_INTERNAL_URL`, `ORDERS_SOCIAL_INTERNAL_URL`.
- go-money: `SAVED_CARD_FINGERPRINT_KEY` and `SOCIAL_INTERNAL_API_TOKEN` (secrets), `SOCIAL_INTERNAL_URL`, `ADMIN_INTERNAL_URL`.
- go-live: `LIVE_RECORDING_S3_REGION`.
- go-ads: `ADS_ASSETS_BUCKET` (media bucket, with IAM limited to `ads-media/*` and `ads-reports/*` plus the media KMS key; CloudFront serves only `processed/`), `ADS_STAFF_JWKS_URL`, `ADS_STAFF_TOKEN_ISSUER`, `IDENTITY_INTERNAL_URL`, `ADMIN_INTERNAL_URL`, `ADS_PUBLIC_URL`, `ADS_APP_URL`, `ADS_VERIFY_URL`, plus secrets `ADS_MONEY_HTTP_TOKEN`, `IDENTITY_INTERNAL_TOKEN`, `ADMIN_INTERNAL_API_TOKEN`.
- go-trust: `INTELLIGENCE_URL` and the `INTELLIGENCE_SHARED_SECRET` secret.
- gateway: `UPSTREAM_ADS_URL`.
- social: `MEDIA_INTERNAL_URL`, `ADS_INTERNAL_URL`, plus secrets `MEDIA_INTERNAL_TOKEN`, `ADS_INTERNAL_SHARED_SECRET`, `INTELLIGENCE_ID_HASH_SECRET`.
- search: `INTELLIGENCE_ID_HASH_SECRET`.
- notifications: `PUSH_PROVIDER=expo`, `ZUDOMART_WEB_BASE_URL`.
- media: `S3_REGION`.
- realtime: `ALLOWED_ORIGINS` (fetch_env! crashed at boot), the `RELEASE_COOKIE` secret, and `rel/env.sh.eex` (long node names on the task IP for DNSCluster).
- intelligence: `INTELLIGENCE_S3_REGION`, `INTELLIGENCE_TRUSTED_PROXY_IPS`=VPC CIDR, and the `INTELLIGENCE_ID_HASH_SECRET` secret.
- OTel: the Go exporter is gRPC but the endpoint was the HTTP port 4318. Go now gets `http://127.0.0.1:4317`, and per-service env can override the module default.

**Still open, needs an owner decision:**
- media: the code expects three buckets (quarantine/public/private) and CloudFront signing keys, but Terraform has one media bucket with CloudFront on `processed/`. This needs a storage design and I didn't guess. ClamAV isn't deployed.
- `USERS_EXPORT_BUCKET` and `USERS_MEDIA_UPLOAD_BASE_URL` (no bucket or endpoint exists for them).
- social `IDENTITY_READ_DATABASE_URL`: no grants for `users`/`auth`.
- notifications: company legal name and address for email footers.
- `ADS_MEDIA_URL`.
- Admin invitation delivery has no real implementation.
- Intelligence model registry path.
- Shared Valkey `volatile-lru` can evict denylist keys. Consider `noeviction` or moving the denylist.

## 2. Health and readiness
- **Go** (`platform/health`): checks run concurrently, 2 s each inside a 3 s budget. The runner registers `valkey` (denylist PING) and `rabbitmq` (opens and closes a channel on the shared connection) next to the module Postgres checks. New loopback-only `GET /metrics` (`platform/telemetry/http.metrics.go`) serves route-pattern RED histograms, goroutines and the denylist failure counters, and isn't reachable through the gateway or ALB.
- **TS** (social, notifications, media, search, support): `/readyz` runs `database` and `rabbitmq` checks with a 2 s timeout each; there's a new `utils/readiness.util.ts` and `RabbitMqConnection.checkReachable`. The gateway gets a new `/readyz` that always returns 200 and reports `cache:"degraded"` when Valkey is down. Valkey is a soft dependency by design, and failing would pull every gateway at once.
- **Realtime**: new `/readyz` (`Realtime.Readiness`) is 503 while the AMQP consumer has no channel, using a 1 s call timeout.
- **Python**: already had `/health/ready` (Redis plus dead consumer jobs) with tests. It now gets its own Redis.
- **Terraform**: ALB target groups use readiness (`ready` per catalog entry). Container health checks stay on liveness. The ADOT sidecar now takes an inline config (`AOT_CONFIG_CONTENT`): OTLP→X-Ray, and a Prometheus scrape of Go `/metrics` → EMF `Zudomart/<env>` with low-cardinality dimensions (service, status_class), plus a per-service metrics log group and IAM.
- **Not done:** app-level metrics for TS, Python and Elixir, because no metrics library is installed and package.json is off-limits. They have ALB target-group RED and Container Insights.
- **Tests:**
  - Go: `health.handler_test`, `sharedReadiness_test`, `rabbitmq.readiness_test`, `sessionDenylist_test` (Ping), `http.metrics_test`.
  - TS: readiness tests in all 6 services, all passing, and tsc is clean (done by a sub-agent).
  - Realtime: `test/realtime/readiness_test.exs`; 11 tests passed with the consumer tests.

## 3. INFRA-004 (now fixed)
- **Ledger:** the integrity, maturing and money-event consumers run under `SuperviseWorkerUntilContextDone`. The gRPC listener and the outbox relay run under the new `servicemodule.RunWorkersStoppingAllOnFirstFailure`, so a gRPC listen failure is fatal.
- **`ErrWorkerDisabled`:** the supervisor treats this error as "no broker in dev" and stops instead of looping.
- **Subscriptions:** the billing consumer and due-jobs loop are supervised. A queue setup error in production is fatal; the inline fallback stays outside production.
- **Moderation:** the live-safety consumer is supervised.
- **Observability:** a log metric filter and alarm on "background worker stopped; restarting" (`observability/workers.tf`).
- **Tests:** `fatalWorkers_test.go`, `workerSupervisor_test.go` (disabled worker), and the readiness tests.
- **Report rows updated:** INFRA-004 and INFRA-016 are Fixed now, and INFRA-014 is still partly fixed (moderation setup). The rows are in `GO_BACKEND_DEEP_SCAN.md` and `VERIFICATION_SUMMARY.md`.

## 4. Flutterwave fixed egress IPs (coordinator request)
- `nat_per_az = true` in dev and staging (prod already had it), so each environment has 3 NAT gateways, each with its own Elastic IP.
- The env output `nat_public_ips` is documented for whitelisting.
- Added `docs/integrations/flutterwaveMigration.md` §7.1, a go-live checklist with the whitelist steps. It is Flutterwave-only, with no Paystack.
- **Egress allowlist for go-money: documented, not applied.** The security-group split (a dedicated go-money SG that Aurora, MQ, Valkey and the internal ALB must admit) was blocked by the permission classifier because it modifies shared data-store SGs, and it needs owner sign-off.
- A hostname allowlist needs Network Firewall (~$865/mo for 3 AZs) or an egress proxy (~$30–60/mo); both are documented.

## 5. Validation
- `terraform fmt -check`: clean.
- `init -backend=false` plus `validate`: dev, staging and prod all valid.
- `trivy config infra/aws --severity HIGH,CRITICAL`: the only findings are AWS-0053, AWS-0054 and AWS-0104 at pre-existing locations, all already listed in `.trivyignore`. The local trivy build ("dev") didn't apply the repo `.trivyignore`; with an explicit ignore file of the same IDs, exit is 0. The changes add no new findings.
- Go:
  - platform health/events/servicemodule/jwtauth/telemetry tests pass.
  - All 6 deployables build.
  - vet is clean on ledger, subscriptions and moderation.

## 6. New monthly cost (eu-west-1, on-demand, approximate)
- Intelligence Valkey: dev ~$12, staging ~$25, prod ~$50, so **~$87/mo**.
- NAT per AZ in dev and staging: 4 extra NAT gateways (~$35 each) plus 4 EIPs (~$3.65 each), so **~$155/mo** plus data processing. Prod is unchanged.
- CloudWatch EMF metrics, metric filters and alarms: **~$60/mo** across the 3 environments.
- **Total: ~$300/mo** (prod share ~$70).
- Not added: Network Firewall (~$865/mo).

Other: killed a leftover `tail -f .../readiness-run.log` follower (PID 3883149) from the TS sub-agent.

## Addendum: owner-approved follow-ups (2026-10-11)

### A. go-money egress lockdown (security groups; no Network Firewall)
- New `platform/payments_egress.tf`: go-money's tasks run **only** in `aws_security_group.payments`. Every rule is a separate `aws_vpc_security_group_*_rule` with its own description.
  - Egress, VPC: 5432 to Aurora/RDS Proxy, 6379 to the shared Valkey, 5671 to Amazon MQ, 80 to the internal ALB, 9101 to go-identity gRPC, 443 to the interface endpoints SG, and 443 to the S3 gateway prefix list.
  - Egress, internet: 443 to `payments_internet_egress_cidrs`, default `0.0.0.0/0`. That covers Flutterwave, plus the App Store and Google Play APIs that subscriptions call.
  - Ingress: 8080 from the internal ALB, and 9103 from the task SG.
- Dedicated `payments_security_group_id` ingress blocks were added to Aurora, Valkey, MQ and the internal ALB (ingress 80, egress 8080), and to the task SG for 9101. No other service's access changed.
- New outputs: `network.s3_prefix_list_id`, `network.endpoints_security_group_id`, `valkey.security_group_id` and `messaging.security_group_id`.
- Limit: a security group can't name hosts, so the internet rule is "443 only" until the provider CIDRs are confirmed.
- Documented in `flutterwaveMigration.md` §7.1.

### B. Media storage layout (separate buckets)
- New `storage/media_buckets.tf`: `-media-uploads` (private originals and quarantine, browser PUT CORS), `-media-public` (derivatives, CloudFront OAC on `/m/*`) and `-media-private` (chat, KYC and documents, served by signed CloudFront `/p/*` when the signing key is set, otherwise presigned S3).
  - All three are KMS (media key), versioned, with public access blocked, TLS-only, access-logged and lifecycle-managed.
- The CloudFront distribution gains two origins and two behaviors. The existing `/processed` default is unchanged.
- Media env: `MEDIA_QUARANTINE_BUCKET`, `MEDIA_PUBLIC_BUCKET`, `MEDIA_PRIVATE_BUCKET`, `MEDIA_PRIVATE_KMS_KEY_ID`, `CDN_BASE_URL`, and `CDN_PRIVATE_BASE_URL` plus `CDN_SIGNING_KEY_PAIR_ID` when the key exists. `CDN_SIGNING_PRIVATE_KEY` is a new secret key.
- IAM for the media task covers the three buckets.
- Gap: the new buckets are not in the DR cross-region replication yet.

### C. Metrics for non-Go services
- **Python (intelligence):** `uv add` added opentelemetry-api/sdk 1.45.1, exporter-otlp-proto-http 1.45.1 and instrumentation-fastapi 0.66b1. All were published 2026-10-06, more than 24h before install; transitive dependencies are older.
  - I used the HTTP exporter rather than the `opentelemetry-exporter-otlp` meta-package, to avoid pulling in gRPC.
  - New `src/loaders/telemetry_loader.py` sends traces and metrics over OTLP/HTTP to the sidecar and does nothing without `OTEL_EXPORTER_OTLP_ENDPOINT`. Health paths are excluded.
  - Terraform sets `OTEL_SEMCONV_STABILITY_OPT_IN=http`, which gives the metric name `http.server.request.duration`.
  - Test `tests/loaders/test_telemetry_loader.py`: the duration histogram uses route templates, never raw IDs, and the no-op path is covered.
  - ruff, mypy strict and the full pytest suite pass.
- **Elixir (realtime):** `telemetry_metrics_prometheus_core` 1.2.1 (published 2024-03-24). I chose it over the OTel Erlang SDK because metrics in that SDK are still experimental.
  - It adds a loopback-only `/metrics` with a request-duration histogram by route and status class, socket connects and VM memory.
  - The sidecar scrapes it, the same way it scrapes Go.
  - `test/realtime/metrics_test.exs` passes; 5 tests pass including readiness. The build compiles with `--warnings-as-errors`.
- **Collector:** `awsemf` now converts resource attributes. Its declarations cover OTLP `http.server.request.duration` (by `service.name` and status code) and the realtime series.
- **TypeScript:** in progress at the time of this addendum; see the final hand-back.

### D. Validation
- `terraform fmt -check` is clean, and `validate` passes in dev, staging and prod.
- trivy config with the CI ignore IDs: exit 0.

### E. Cost change
- go-money security groups: free.
- 3 media buckets: storage they hold is moved from the old layout, not new, plus per-request costs. Roughly **+$5/mo** per environment until there's traffic.
- OTLP metrics from 7 more services into CloudWatch EMF: about 6 to 10 metrics per service, so roughly **+$20 to $25/mo** per environment (about **$70/mo** across 3).
- **TypeScript (all 6 services, done by a sub-agent):**
  - Packages, added with `pnpm add --filter` and published 2026-10-06: `@opentelemetry/api` 1.9.1; `sdk-trace-node`, `sdk-metrics` and `resources` 2.12.0; `exporter-trace-otlp-http`, `exporter-metrics-otlp-http`, `instrumentation` and `instrumentation-http` 0.223.0; plus `instrumentation-amqplib` 0.70.0 everywhere except the gateway.
  - `@opentelemetry/sdk-node` is not used. It pulls in `protobufjs@7.6.6`, which has a postinstall script, and strictDepBuilds refused it. The SDK is built by hand instead, with no gRPC and no protobufjs in the lockfile. `@prisma/instrumentation` was dropped because it needs an older instrumentation line.
  - Code: `src/telemetry/{telemetry,requestMetrics}.ts`. The explicit `http.server.request.duration` histogram is labelled by route template, with "unmatched" otherwise. Without `OTEL_EXPORTER_OTLP_ENDPOINT` it does nothing.
  - Tests: RED-metric and no-op tests in every service, all passing, and typecheck is clean. pnpm-workspace.yaml is untouched.

### F. DR for the media service buckets (closes the gap from B)
- New `storage/media_replication.tf`, active only where `enable_dr` is set (prod):
  - `-media-{uploads,public,private}-dr` replica buckets in the DR region: versioned, public access blocked, encrypted with the DR media KMS key.
  - Replication matches the existing media rule: STANDARD_IA, replication time control and metrics at 15 minutes, delete markers not replicated, and replicas re-encrypted with `media_dr`.
  - Upload replicas expire after 7 days, because uploads are pipeline staging. Old versions expire after 30 days.
  - A separate role policy on the existing replication role (`media-service-buckets`) covers only these buckets and the two media keys.
  - KYC and its Object Lock are untouched.
- Validation: fmt clean, `init -backend=false` plus `validate` pass in all 3 roots, and trivy exits 0.
- Cost (prod only): no fixed cost. About $3.50 per 100 GB of new media replicated (cross-region transfer $0.02/GB, replication time control $0.015/GB), plus about $1.35 per 100 GB-month stored as IA in the DR region.
