# Authorization test results

Date: 2026-10-29. Tests used repository source and synthetic local database roles. No real user records or external services were accessed.

## Executed

- Static route contract for `/api/v1/spaces`: Go Live upstream registered; list/detail GET optional authentication; all other paths/methods require authentication. `pnpm --filter @nantty/gateway exec vitest run tests/upstreamRoutes.routes.test.ts` passed **110/110**.
- Money DB role boundary on a fresh disposable local DB: `svc_money` was not a member of `svc_migrator` or module-owner roles, lacked `CREATE` on all six money schemas, and PostgreSQL rejected table/schema DDL and role escalation attempts. Journal DELETE/TRUNCATE were denied. DELETE was granted only to the three source-verified cleanup tables and synthetic rows were successfully removed from each.
- Python static contracts passed **5/5** (Space route registration, ledger migration-role shape, egress allowlists, admin allowlist requirement).
- Gateway HTTP test runs passed **1,474 tests across seven files** in the current rerun, including absent/expired-token rejection before upstream dispatch, anonymous mutation rejection, staff route/network policy behavior, and synthetic identity forwarding. These exercise the gateway with fake upstreams, not upstream resource ownership. The current run emitted Fastify `FSTWRN004`; it did not fail tests.
- A bounded burst sent 20 concurrent requests through an in-process gateway; configured global limit 5 yielded 5 accepted and 15 rate-limited responses.
- `USERS_TEST_DATABASE_URL=<disposable loopback PostGIS>` with `go test ./modules/users/src/modules/privacy -count=1` passed. The package exercises separate synthetic identities and confirmed one user receives 404 when reading, patching or deleting another user’s address; consent endpoints and retention/deletion flows also passed.
- Full `services/go/modules/auth` Go test tree passed against a loopback-only disposable PostGIS database and ephemeral Valkey: `AUTH_TEST_DATABASE_URL=... AUTH_TEST_VALKEY_URL=... go test ./... -count=1`. This executed the DB-backed auth HTTP module harness, including synthetic OTP/signup, login/lockout, reset/change, session rotation/revocation, social token validation, role downgrade, and session-denylist checks. The required `nantty_readers NOLOGIN` role existed only in the disposable database. This is module-level HTTP coverage, not a separately deployed Go API/gateway stack.
- `go test ./modules/users/src/modules/privacy -count=1` passed against the same disposable PostGIS database; synthetic cross-account address read/patch/delete attempts returned 404, and consent/deletion/retention cases passed.
- The broad payments tree exposed five invalid provider fixtures: Apple signed payload certificate chains lack verifier-required Apple marker OIDs, and Apple notification/Google RTDN fixture signatures/claims fail validation (including stale package data). The application correctly rejected them; no signature validation was relaxed.

## Commerce ownership coverage — 2026-10-29

`INVENTORY_TEST_DATABASE_URL=<disposable loopback PostGIS>` with `go test ./modules/inventory ./modules/orders -count=1` passed after the isolated DB was provisioned with the migration-required `nantty_readers NOLOGIN` role. The orders package includes `TestAnotherBuyersOrderLooksExactlyLikeAMissingOrder`, which passed; this is evidence for that specific order ownership boundary, not all order/admin routes or tenant resources. Other profiles, products, messages, wallets, payouts, stores and staff objects remain unverified across identities. The commerce DB was disposable and stopped after testing.

## Ads and campaign authorization coverage — 2026-10-29

The complete ads module integration suite passed against disposable PostGIS. It includes non-owner campaign transition refusal, staff permission/step-up controls for admin credits, minor and unknown-age contextual ad decisions, advertiser targeting validation, and rejection of unknown ad categories. Test-only corrections enforced the existing minimum idempotency-key length in fixtures and accepted the API's 400 or 422 validation status. This does not establish authorization for all advertiser, store, staff, billing or cross-service paths, nor live provider integration.

## Not verified dynamically

Cross-user object access for profiles, follow requests, orders, products, messages, wallets, payouts, business tenants, S3/private media, and upstream staff/admin handlers remains untested. Auth tests use the service module's real HTTP handlers with synthetic tokens and isolated DB/Valkey but do not prove deployed gateway-to-auth integration or authorization inside every resource service. The users privacy integration covers only its address/consent/deletion surface; other database-backed user suites were not all run. Realtime module tests pass, but live WebSocket room identity and queue recipient isolation remain unverified. Runtime authorization must be retested with separate seeded synthetic identities across the remaining services once an isolated full-stack environment is available.
