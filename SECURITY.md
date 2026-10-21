# Security

## Reporting a vulnerability

Do not open a public issue. Email the maintainers with the details and steps to reproduce; we reply within 72 hours.

## Baseline rules

Every module follows these. A pull request that breaks one needs a written reason.

### Secrets and configuration
- Secrets live only in environment variables loaded from a secret manager in production. Only `*.example` env files are committed.
- The mobile app and the landing page are public: anything in `apps/mobile` or a `NEXT_PUBLIC_*` variable is readable by anyone.
- Use different keys per environment. Rotate any key that has been in a log, a screenshot or a chat.

### Dependencies
- pnpm only. `pnpm-workspace.yaml` blocks releases younger than 24h, git/tarball sub-dependencies, trust downgrades and unapproved install scripts. Do not weaken these settings to make an install pass.
- Commit `pnpm-lock.yaml`. CI and Docker install with `--frozen-lockfile`.
- Run `pnpm audit` before each release; fix every high or critical advisory.

### Authentication (`services/go/modules/auth`)
- Passwords are hashed with argon2id (`services/go/platform/passwordhash/argon2id.hasher.go`); never logged, never returned.
- Access tokens are short-lived (15 min). Refresh tokens rotate on each use, are stored only as hashes, and reuse of an old refresh token revokes the whole session.
- OTPs expire (5 min), are single-use, are stored hashed, and lock after 5 failed attempts (`AUTH_OTP_TTL`, `AUTH_OTP_MAX_ATTEMPTS`).
- Login, OTP and password-reset endpoints have their own stricter rate limit, and responses never reveal whether an account exists.
- On mobile, tokens are kept in the OS secure store (`apps/mobile/src/utils/secureStorage.util.ts`), never AsyncStorage.

### Authorization
- Every protected Go route is wrapped by session middleware, and staff/store routes declare the permission they need. The catalogs are `services/go/platform/staffauth/permissionCatalog.constant.go` and `services/go/platform/commerceports/storeRolePermissions.constant.go`; denied by default.
- Ownership is checked on the server for every resource ID taken from a request: a store member can only touch their store's products and orders, a buyer only their own orders, carts, addresses and wallet.

### Money (`orders`, `payments`, `escrow`, `wallet`, `ledger`)
- Amounts are integers in minor units (kobo) with an explicit currency. No floating point.
- Prices and totals are computed on the server at checkout; client-sent prices are ignored.
- A payment counts as paid only after the server verifies it with the provider (webhook or verify call), never on a client redirect.
- Payment webhooks are rejected unless the signature verifies (`services/go/modules/payments/src/integrations/flutterwaveWebhooks.integration.go`), and each provider event is stored once.
- Money-moving endpoints (checkout, withdrawal, escrow release, refund) require an `Idempotency-Key` header.
- Wallet balances change only through append-only journal entries (`services/go/modules/ledger/src/modules/journal/services/ledgerPosting.service.go`) inside a database transaction, so concurrent requests cannot overdraw a balance.
- Escrow release, refunds, dispute decisions, payouts and staff role changes are written to the staff audit log (`services/go/modules/admin/src/modules/auditLog`) and the money ledger.

### Data
- Validate every request body, query and param against a schema (`validators/`) before it reaches a handler.
- Database access is parameterised; no string-built SQL.
- Payout bank numbers and selected PII are encrypted at rest with field keys (`DATA_ENCRYPTION_KEY`, `CATALOG_DATA_ENCRYPTION_KEY`) and masked in responses.
- Go logs pass through `services/go/platform/logging/nestedRedaction.go`: no passwords, tokens, OTPs, card or bank data. Support's auto-FAQ scrubs personal data before it is stored or sent.
- Uploads go through signed, size- and type-limited URLs (`services/typescript/media`); MIME types are checked against a purpose policy and magic bytes, and new objects land in a quarantine bucket first.

### Transport and headers
- HTTPS only in production. The API sends security headers, CORS is an explicit allow-list (`CORS_ORIGINS`), and a global rate limit is on (`RATE_LIMIT_MAX_PER_MINUTE`).
- Postgres, Valkey, RabbitMQ, LocalStack, SeaweedFS, LiveKit and the observability services are bound to `127.0.0.1` in `infra/local/docker-compose.yml` and are never exposed publicly.
