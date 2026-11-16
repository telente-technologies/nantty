# Nantty Sandbox service

This is a separately deployable synthetic Business Messaging API. It has its own PostgreSQL target and accepts only `ntsb_test_` credentials. It never calls the production messaging service. The initial routes persist synthetic customers, conversations, business replies, customer-inbound simulation events, and redacted request metadata.

The Developer portal calls server-only BFFs that verify the signed-in actor's Identity capability for the exact organization/application before forwarding to Sandbox. Credential routes require `credentials.manage`; webhook configuration, delivery history, tests, and retry require `webhooks.manage`. The BFF forwards only the actor UUID returned by Identity and never forwards browser cookies to Sandbox. Never expose `/v1/control/*` publicly or treat the service token as user authorization. The credential and webhook lifecycles are database-integration-tested against the grouped migration inside randomly named schemas on a disposable PostgreSQL container. The signed-in Developer browser-to-Identity/Gateway/Sandbox workflow remains unverified, and no persistent database has been migrated.

## Isolation and persistence

`SANDBOX_DATABASE_URL` is mandatory; there is no fallback to `DATABASE_URL`. Production startup also requires `PRODUCTION_DATABASE_URL` and rejects an identical PostgreSQL host, port, and database target even if credentials differ. The initial schema is one grouped SQL migration at `prisma/migrations/20261115120000_sandbox_core/migration.sql`. The integration suite applies it only inside randomly named schemas in a disposable PostgreSQL database; it has not been applied to a persistent service, staging, or production database. Apply it there only in the approved grouped migration window after review and after provisioning a dedicated Sandbox database/user.

The service stores only SHA-256 digests of issued random test credentials. The raw credential is returned once. Request logs omit request and response bodies. Customer data and messages are synthetic records in the isolated database. Message creation requires an idempotency key; reuse with different content is rejected.

Webhook signing secrets are generated with 256 bits of randomness, returned once, and stored using AES-256-GCM with a separately provisioned `SANDBOX_WEBHOOK_SECRET_ENCRYPTION_KEY`. Webhook creation fails closed when that key is absent. Endpoints accept HTTPS only, reject URL credentials/fragments/non-default ports and non-public DNS answers, and the delivery worker resolves and pins a public address for every attempt; redirects are not followed. Sandbox message events are inserted with their webhook delivery rows in the same database transaction. The worker sends HMAC-SHA256 signed payloads with a timestamp and stable event ID, uses a bounded timeout/body size, performs at most eight automatic attempts with exponential delay, retains attempt outcomes, and supports explicit retry of terminal failures. A test action returns `pending` after it queues a synthetic `webhook.test` event; it does not claim that the endpoint received the event. Delivery is at-least-once, so consumers must deduplicate by event ID.

Provision a fresh Sandbox signing key with `openssl rand -base64 32` using the approved secret manager; do not commit or reuse an identity, database, or public API secret as this key.

This is Sandbox-only and does not yet satisfy the production webhook gate: endpoint ownership verification, per-plan quotas/rate limits, retention policy, production event schema, public API integration, signed-in end-to-end browser operation, and actual network delivery against a controlled receiver remain outstanding. Keep production API traffic disabled.

## Run and verify

From the repository root, after workspace dependencies are installed:

```sh
pnpm --filter @nantty/sandbox-service typecheck
pnpm --filter @nantty/sandbox-service test
pnpm --filter @nantty/sandbox-service build
```

Use the dedicated service `.env.example` only as a template. A live service requires the migration to be applied to a dedicated database and secret provisioning through the approved secrets manager. The current application starts only after these required values are present.

## Current scope

Implemented source surface: isolated configuration checks, control-plane application/credential lifecycle, synthetic customer/conversation creation, idempotent business messages, inbound message simulation, outbound status transitions, persisted events, readiness, and redacted request metadata. The Developer portal now has an Identity-authorized Sandbox webhook workspace with endpoint CRUD, test-event queueing, delivery history and retry; Sandbox source has AES-GCM signing-secret storage, public-DNS/SSRF checks, transactional event-to-delivery enqueueing, signed HTTPS delivery, attempt history and bounded retry. Webhook route helpers are in a separate support module; the route controller is under the 300-line source-file limit. Disposable PostgreSQL integration verifies credential lifecycle and the webhook endpoint/secret/outbox/retry audit lifecycle in isolated schemas. Current Sandbox suite: 46 passed, 2 DB integration tests skip without `SANDBOX_TEST_DATABASE_URL`; both integration tests passed against a task-created disposable PostgreSQL 17 database in this execution. Developer suite: 16 passed; typecheck/lint pass; production build passes with explicit public-origin variables (last build preceded the helper-only extraction). The webhooks page rendered but showed an honest unavailable gateway message because local Identity/Gateway endpoints were not configured; signed-in browser workflow and actual outbound HTTPS receiver delivery are unverified. `/v1/control/*` remains private and requires the service token; user-scoped credential/webhook operations additionally require an Identity actor UUID supplied by the BFF. Endpoint ownership verification, public gateway routing, scenarios, reset, quotas, retention policy, production deployment and persistent database migration remain outstanding.
