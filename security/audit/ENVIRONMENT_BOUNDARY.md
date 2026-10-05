# Environment boundary (Phase 1)

Reviewed 4 Oct 2026 from the repo, `.env.example` files, `infra/local/docker-compose.yml`, `infra/aws`, and one read-only `docker ps`. No secrets were printed; every value below is redacted to its prefix.

## Verdict

**No live money and no production endpoint is configured in this checkout.** There are no real `.env` files (only `*.env.example`, and `.gitignore:10-11` ignores `.env` and `.env.*`). Paystack keys are empty, and `payments.config.go:138` refuses an `sk_live_` key outside production and an `sk_test_` key inside it.

Three things still look production-like:

1. **`PAYSTACK_API_BASE_URL=https://api.paystack.co`** is the default in `services/go/.env.example:86`. With an `sk_test_` key it reaches Paystack's real test mode on the internet. Active tests must point it at the fake Paystack server (`services/go/modules/payments/src/integrations/paymentsTesting`) or `services/scripts/apiSmoke` fakes.
2. **Terraform is initialised for dev, staging and prod** (`infra/aws/envs/*/.terraform` exists, provider plugins downloaded). State lives in S3 (`zudomart-terraform-state-{env}`, `eu-west-1`), so local files cannot tell whether real AWS resources exist. Treat every AWS name as real. No `terraform plan/apply` and no AWS CLI call in any phase.
3. **`SMILE_ID_*` and `HUMAN_VERIFICATION_*`** point at real third parties when keys are set. Smile ID must stay `SMILE_ID_ENVIRONMENT=sandbox`; Turnstile uses Cloudflare's published test keys (`1x0000…AA`).

## In scope (local only)

| Component | Host:port | Source |
|---|---|---|
| Postgres (all service schemas) | 127.0.0.1:15432 | compose `postgres` (container `zudomart-backend-postgres-1`) |
| Valkey | 127.0.0.1:16379 | compose `valkey` |
| LocalStack (SQS/SNS/SES) | 127.0.0.1:14566 | compose `localstack`, creds `test/test` |
| RabbitMQ | 127.0.0.1:5672, mgmt 15672, metrics 15692 | compose `rabbitmq` |
| OpenSearch | 127.0.0.1:19200 | compose `opensearch` |
| SeaweedFS S3 | 127.0.0.1:18333 | compose `object-storage` |
| LiveKit | 127.0.0.1:7880-7882 | compose `livekit`, `devkey/secret…` |
| OTel / Jaeger | 127.0.0.1:4317-4318, 16686 | compose |
| ClickHouse | loopback | compose `clickhouse` |
| Gateway | :8080 | `services/typescript/gateway` |
| go-identity / live / money / trust / commerce / ads | :8101 / 8102 / 8103 / 8106 / 8107 / 8110 | `package.json` `backend:dev:*` |
| ts notifications / social / media / search / support | :8104 / 8105 / 8108 / 8109 / 8111 | `.env.example` |
| Python intelligence | 127.0.0.1:8090 | `services/python/intelligence` |
| Realtime (Phoenix) | runtime.exs (4002 in tests) | `services/elixir/realtime` |

Every compose port binds to `127.0.0.1` only.

## Out of scope (never touch)

- `betng-postgres` (0.0.0.0:55432) and `betng-redis` (0.0.0.0:56379): another project, bound to all interfaces. Exclude by name and port.
- Anything on AWS (`infra/aws`), Paystack live, Smile ID production, Apple/Google store APIs, SES production, Cloudflare beyond test keys.
- Any non-loopback address.

## Credential inventory (redacted)

| Credential | Where | Value class | Risk |
|---|---|---|---|
| Paystack secret/public/previous | `services/go/.env.example:88-90` | empty | none in repo |
| Paystack test keys in tests | `paystackWebhooks.integration_test.go:16`, `apps/api/tests/fixtures/testApplication.fixture.ts:72` | `sk_test_****` fakes | none |
| Fake Paystack key | `paymentsTesting/fakePaystack.util.go:16` | `sk_test_fake…` | none |
| Internal service tokens | `*.env.example` (`*_INTERNAL_*TOKEN`) | `local-only-…` | local only; must be rotated per env |
| Encryption keys / peppers | `services/go/.env.example:8,9,13,22,124` | base64 of `local…` | local only |
| AWS | `services/go/.env.example:77-78` | `test/test` (LocalStack) | none |
| Media S3 | `services/typescript/media/.env.example:15-16` | `local/local-only` | none |
| Postgres roles | `infra/local/postgres/create-databases.sh` | `<role>_local_only` | local only |
| LiveKit | `services/go/.env.example:33-34` | `devk…/secr…` | local only |
| Turnstile | `services/typescript/gateway/.env.example` | Cloudflare public test keys | none |
| Google Play service account | `payments/src/integrations/testdata/googlePlay/serviceAccount.json` | generated test RSA key, project `zudomart-test`, `TOKEN_URI` placeholder | none, but trips secret scanners (accepted, SEC-0019) |
| Smile ID | `services/go/.env.example:212-213` | empty, `sandbox` | none |

Git history scan (`git log --all -p -G` for `sk_live_`, `AKIA`, private keys, Slack/GitHub/Google/SendGrid tokens, `whsec_`) found only test fixtures.

## Safety switches for active phases

- Refuse to start if any env var value starts with `sk_live_` or `pk_live_`, or if `APP_ENV=production`.
- Refuse to start if `PAYSTACK_API_BASE_URL` is not a loopback URL.
- Refuse any target host that is not `127.0.0.1`/`localhost`.
