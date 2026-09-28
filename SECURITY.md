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

### Authentication (`modules/auth`)
- Passwords are hashed with a memory-hard algorithm (argon2id or scrypt); never logged, never returned.
- Access tokens are short-lived (15 min). Refresh tokens rotate on each use, are stored only as hashes, and reuse of an old refresh token revokes the whole session.
- OTPs expire (5 min), are single-use, are stored hashed, and lock after 5 failed attempts.
- Login, OTP and password-reset endpoints have their own stricter rate limit, and responses never reveal whether an account exists.
- On mobile, tokens are kept in the OS secure store (`src/utils/secure-storage.ts`), never AsyncStorage.

### Authorization
- Every route declares the permission it needs (`src/constants/permissions.constant.ts`). Denied by default.
- Ownership is checked on the server for every resource ID taken from a request: a store member can only touch their store's products and orders, a buyer only their own orders, carts, addresses and wallet.

### Money (`orders`, `payments`, `escrows`, `wallets`)
- Amounts are integers in minor units (kobo) with an explicit currency. No floating point.
- Prices and totals are computed on the server at checkout; client-sent prices are ignored.
- A payment counts as paid only after the server verifies it with the provider (webhook or verify call), never on a client redirect.
- Payment webhooks are rejected unless the signature verifies (`verify-webhook-signature.middleware.ts`), and each event is processed at most once.
- Money-moving endpoints (checkout, withdrawal, escrow release, refund) require an `Idempotency-Key` header.
- Wallet balances change only through ledger entries (`wallets/services/ledger.service.ts`) inside a database transaction, with row locks so that concurrent requests cannot overdraw a balance.
- Escrow release, refunds, dispute decisions, payouts and role changes are written to the audit log (`modules/audit`).

### Data
- Validate every request body, query and param against a schema (`validators/`) before it reaches a handler.
- Database access is parameterised; no string-built SQL.
- Bank account numbers and similar PII are encrypted at rest with `DATA_ENCRYPTION_KEY` and masked in responses.
- Logs pass through `src/loggers/redact.ts`: no passwords, tokens, OTPs, card or bank data.
- Uploads go through signed, size- and type-limited URLs (`modules/media`); file types are checked on the server.

### Transport and headers
- HTTPS only in production. The API sends security headers, CORS is an explicit allow-list (`CORS_ORIGINS`), and a global rate limit is on (`RATE_LIMIT_MAX`).
- Postgres, Redis and Mailpit are bound to `127.0.0.1` in `compose.yaml` and are never exposed publicly.
