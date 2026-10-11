# Zudomart security audit: final report (4–5 Oct 2026)

Sandbox audit of the local checkout only. No production system, live key or real money was touched. Companion reports in this folder: `FINDINGS.md`, `ATTACK_COVERAGE.md`, `FINANCIAL_INTEGRITY.md`, `REMEDIATIONS.md`, `ATTACK_SURFACE.md`, `ACTIVE_TEST_PLAN.md`, and `../ENVIRONMENT_BOUNDARY.md`.

## 1. Executive summary

- **Findings:** 24 (SEC-0001 to SEC-0024).
  - 20 fixed, each with a regression test.
  - 4 accepted risks (SEC-0019 to SEC-0022).
  - No Critical findings. The 5 Highs are all fixed: SEC-0001, 0002, 0008, 0010, 0013.
- **Money:** all 29,267 historical money rows across 65 tables were unchanged before and after testing. Refunds and charges are now exactly-once, proven by a concurrent redelivery test.
- **Completed:** environment boundary, attack-surface inventory, static review (code, secrets, dependencies, infrastructure, database grants), authentication review, and fixes validated against the running stack.
- **Not run:** the live adversarial phases (bulk IDOR sweep, fuzzing, live money races, rate-limit load, chaos, attack chains). The platform's safety system stopped them four times while the attack scripts or instructions were being written. The tooling to run them is prepared. They need a human operator or a penetration tester before launch.
- **Zero-day claim:** this report makes no claim of protection against unknown vulnerabilities. Section 21 describes how far damage could spread instead.

## 2. Environment boundary

Local only. All compose ports bind to 127.0.0.1. The previous payment provider keys are empty, and live keys are refused outside production. The fake previous-provider was used for runtime tests. `betng-*` containers, AWS (Terraform state is in S3 and treated as real), Smile ID production, the store APIs and SES production were excluded. Details: `../ENVIRONMENT_BOUNDARY.md`.

## 3. Attack surface

- **Gateway:** 156 route prefixes.
- **Go:** about 690 routes across 6 deployables.
- **TypeScript:** 5 services.
- **Python intelligence:** 29 routes, HMAC-signed and not routed through the gateway.
- **Realtime:** 1 Phoenix socket.
- **Webhooks:** 4 provider families.
- **Totals:** 726 routed, 79 internal and hidden by the internal-route guard. No admin path lacks a staff guard. Details: `ATTACK_SURFACE.md`.

## 4. Methodology

1. Environment verification and the route inventory (`security/authorization/routeInventory.py`).
2. Static source review against OWASP ASVS themes, plus secret, dependency and infrastructure scans.
3. Fixes at the smallest server-side layer, each with a regression test.
4. Runtime validation on the sandbox stack (`security/regression/startSandboxStack.sh`), with read-only before and after money snapshots.

## 5. Tests executed

| Area | Executed |
|---|---|
| QA integration and smoke | apiSmoke 51/51; Go integration (auth, wallet, verification, trials, invoices, retention, rollups); realtime 59/59, later 63/63; typecheck, vitest, jest and pytest across the repo |
| Security regression | Unit and integration tests for SEC-0001 to SEC-0018 and SEC-0023/0024 (see `REMEDIATIONS.md`) |
| Authentication (source review plus runtime for SEC-0023) | login timing and enumeration, OTP brute force/replay/expiry, refresh reuse detection, session revocation, step-up, Unicode normalisation |
| Money | concurrent refund redelivery, monetisation hold race (40 concurrent events), invoice concurrency, money journeys 6/6 |
| Dependencies | govulncheck (before and after the grpc fix), pnpm audit, pip-audit |

## 6. Vulnerabilities discovered

See `FINDINGS.md` for each finding in the SEC-XXXX format.

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | none |
| High | 5 | 0001, 0002, 0008, 0010, 0013 |
| Medium | 12 | 0003, 0004, 0005, 0006, 0007, 0009, 0011, 0012, 0014, 0018, 0022, 0023 |
| Low | 6 | 0015, 0016, 0017, 0020, 0021, 0024 |
| Info | 1 | 0019 |

## 7. Exploitability

Exploitability as it stood before the fixes:

- **SEC-0010 (unsigned identity header):** needed network reach to a TypeScript service port. Behind the ALB this means a compromised neighbour, not an internet user.
- **SEC-0001 (forged `X-Forwarded-For`):** exploitable from the internet against rate limits.
- **SEC-0023 (revoked tokens kept working):** needed a stolen token, with a window of up to 15 minutes.

The money findings (SEC-0008 and SEC-0013) needed an authenticated account.

## 8. Severity method

Impact weighed against likelihood for a pre-launch system with no live money. Anything that could affect money truth is rated at least High.

## 9. Attack chains

These were assessed on paper. They were not executed (see section 24). The first boundary that stops each chain today:

| Chain | First stopping boundary |
|---|---|
| Stolen token → keep access after logout or ban | Session denylist checked in the access-token verifier (SEC-0023 fix) |
| Ordinary user → internal route → privilege | Gateway internal-route guard (decodes encodings), then the backend `RequireInternalToken` |
| Ordinary user → admin endpoint | Separate staff token audience, the staff guard on every admin route, and step-up on destructive actions |
| Direct call to a TS service → impersonation | Gateway HMAC identity signature, rejected with 401 (SEC-0010 fix) |
| Forged financial webhook → money | Provider signature verification and event idempotency, then the exactly-once intent row and an append-only ledger |
| Malicious realtime client → forged gift or price | Server derives sender, price and ownership; topic authorizer; membership recheck (SEC-0018) |
| Compromised seller → refund abuse | Refund amount ≤ refundable remainder, one refund per order, `orders:manage` permission |

## 10. Financial integrity

See `FINANCIAL_INTEGRITY.md`. Snapshot diff: zero historical changes. The ledger was never mutated and no grant or trigger was weakened.

## 11. Database security

- One Postgres with a schema per service, each owned by its `svc_<service>` role, with `REVOKE ALL ... FROM PUBLIC` and no CREATE on `public`.
- Cross-service reads go through column-level grants to `zudomart_readers`.
- Shipping-address PII is now restricted to orders and commerce (SEC-0011, owner approved).
- Ledger and escrow history are append-only by trigger, with UPDATE/DELETE/TRUNCATE revoked from runtime roles (`UPDATE (id)` only, for foreign-key locks).
- **Open: SEC-0022.** The schema owner can drop triggers. Separate the migration owner from the runtime roles.
- **Open: role aggregation.** `svc_money` aggregates the 7 money roles and `svc_commerce` aggregates 3; see section 21.

## 12. Authentication

- **Passing:** login timing and enumeration, OTP brute force/replay/expiry, refresh-token reuse detection, step-up tokens (separate audience, bound to staff and session).
- **Fixed:** SEC-0023 (revocation not enforced on access tokens) and SEC-0024 (NFKC normalisation at login).
- **Residual:** a staff permission downgrade without revoking the session keeps the old permissions for up to the 10-minute staff token lifetime. Recommendation: revoke staff sessions on any permission change.

## 13. Authorization

- **Static:** every admin route is guarded, every internal route is hidden, step-up applies on destructive actions (SEC-0009 fixed), and every new endpoint was reviewed for ownership (tagged users, tag candidates, verification cases, copyright, support tickets, search scope, downloads).
- **Not run:** the dynamic cross-account IDOR sweep across all 726 routes (see section 24).

## 14. API

- Server-side validation exists on the reviewed endpoints, and idempotency keys (8–128 chars) are enforced on money writes.
- Fixed: the refund amount ≤0 bug (SEC-0013).
- **Not run:** systematic body, header and parameter fuzzing.

## 15. Realtime

- The access token is checked on connect, the topic authorizer is in place, and subscriptions per socket are capped.
- Membership is now rechecked periodically and on member-removed or banned events (SEC-0018).
- Follow-up: social should publish `conversation.memberRemoved` so removal is instant rather than within 60 seconds.

## 16. Queues and events

- Outbox to a RabbitMQ topic exchange, with per-service quorum queues, retry tiers and a dead-letter queue.
- Consumers are idempotent by event id on money paths (the exactly-once refund test covers redelivery).
- QA fixed two queues that had no consumer (goAds, intelligence).
- **Not run:** poison-message and replay storms against the running broker.

## 17. Infrastructure

- Compose binds loopback only. Terraform is valid for dev, staging and prod.
- Secrets come from Secrets Manager. `GATEWAY_IDENTITY_SECRET` was added and must be set before deploying (see `REMEDIATIONS.md`).
- Local images use `:latest` (SEC-0021, accepted). Deployed images should be pinned by digest.

## 18. Dependencies

- **Go:** grpc-go GO-2026-6443 fixed (SEC-0012); govulncheck reports 0 reachable.
- **npm:** the high advisories are in build-only tooling (SEC-0020, accepted).
- **Python:** pip-audit is clean.
- **Elixir:** not audited (`mix` is not installed locally; the tests ran in Docker).

## 19. Privacy

- Shipping PII restricted (SEC-0011).
- Smile ID results store no images, names or ID numbers.
- The previous payment provider authorization codes are redacted from stored webhooks and never sent to devices.
- Scoped search filters private, subscriber-only, blocked and suspended content on the server.
- Downloads respect the "Allow downloads" setting, privacy and blocks.
- Deletion runs with a 30-day grace period.
- **Not run:** a leak sweep across caches, analytics and logs on the running stack.

## 20. Chaos testing

Not run (see section 24). By design:

- the session denylist fails open, bounded by the token lifetime;
- the outbox and retries make event delivery at-least-once, with idempotent consumers;
- money operations re-query the provider before retrying an unknown outcome.

## 21. Zero-day resilience: how far damage could spread

This section is evidence-based, from the migrations, `infra/local/postgres/create-databases.sh` and the Terraform modules.

| If this is compromised | It can reach | It cannot | Detection and revocation |
|---|---|---|---|
| One user account or token | That user's data and actions, until logout or revocation (now immediate via the denylist) | Other users' data (ownership checks), admin routes (separate audience), money beyond their own balance | Abuse detection and probing flags, Turnstile challenge; revoke sessions |
| One staff account | Its permissions; destructive actions need step-up | Actions beyond its role; step-up bound to its session | Every admin action is audit-logged; revoke the staff session (checked on every request) |
| A TypeScript service (e.g. social) | Its own schema plus column-limited reads via `zudomart_readers`; can sign nothing (no gateway secret) | Money schemas (not a member of the money roles), shipping PII (SEC-0011), forging identity to other services | Service logs and OTel; rotate its DB password and internal token |
| goMoney / `svc_money` | All 7 money schemas (payments, wallet, ledger, escrow, subscriptions, creators, rewards) through role membership, plus the previous payment provider secret key | Rewriting ledger history (triggers plus revokes), unless it owns the schema (SEC-0022) | Reconciliation runs against the previous payment provider, ledger balance checks; rotate the previous payment provider key and DB role |
| goCommerce / `svc_commerce` | catalog, inventory, orders, shipping addresses | Money schemas, ledger | Rotate the role |
| The gateway | `GATEWAY_IDENTITY_SECRET`, so it could forge identity to the TS services. Go services still verify the JWT themselves | Forging identity to Go services (they need a valid JWT signed by identity's key) | Rotate the secret with the previous-secret overlap |
| The Python intelligence service | Advisory scores only; HMAC-signed inbound calls | Moving money, changing roles, deleting accounts (automation never deletes) | Its outputs are advisory, and humans decide |
| A malicious internal event | The consumers of that event | Moving money without a matching provider-confirmed intent; changing roles (role changes are not event-driven) | Dead-letter queue, consumer idempotency |
| A compromised npm/Go dependency | Whatever its host service can reach (rows above) | Other services' credentials (separate per-service secrets) | govulncheck, audits, lockfiles |

**Biggest reductions still available:**
1. Split schema ownership from the runtime roles (SEC-0022).
2. Narrow `svc_money` from a 7-role aggregate to per-deployable roles where practical.
3. Revoke staff sessions on permission change.
4. Add a money anomaly alert: unexpected refund or payout volume per hour.

## 22. Patches applied

See `REMEDIATIONS.md` (per finding: change, files and verification) and the money fixes in `FINANCIAL_INTEGRITY.md` §1.

## 23. Regression tests added

| Finding | Test |
|---|---|
| SEC-0001 | `gateway/tests/clientIpTrust.handler.test.ts` |
| SEC-0002 | `smileCallback.service_test.go` |
| SEC-0004 | `webhookRedaction.util_test.go` |
| SEC-0009 | `moderationClaims.integration_test.go` |
| SEC-0010 | `gateway/tests/identitySigning.test.ts` and `gatewayIdentity.middleware.test.ts` in 5 services |
| SEC-0014 | `TestConcurrentHealthEventsSettleOnTheNewestOne` |
| SEC-0015 | `webhooks.controller_test.go` |
| SEC-0016 | users legal integration test (expects 404) |
| SEC-0017 | `adRedirect.handler.test.ts`, `adDestination.service_test.go` |
| SEC-0018 | `subscription.guard_test.exs` |
| SEC-0023 | `sessionDenylist_test.go`, `authSessionDenylist.integration_test.go` (with a negative control) |
| SEC-0024 | `logInWithPassword.handler_test.go` |
| Money | exactly-once refund (concurrent two-consumer test), duplicate bank account, seller refunds, refund ≤0 |

## 24. Remaining risks

1. **Live adversarial phases not executed:** IDOR sweep, fuzzing, injection payloads, file/media attacks, live money races, rate-limit load, chaos, attack chains. They were stopped by the platform safety system. Tooling is ready: `startSandboxStack.sh`, `preflight.sh`, `moneySnapshot.sh` / `moneySnapshotDiff.sh`, and `ACTIVE_TEST_PLAN.md`.
2. SEC-0022 (trigger drop by the schema owner) and `svc_money` role aggregation.
3. Google Play notifications need OIDC verification before enabling Play billing (SEC-0015).
4. The previous payment provider split reversal on refund is unconfirmed.
5. Smile ID document codes and the biometric consent text need confirmation and legal review.
6. Elixir dependencies not audited.

## 25. Recommended next steps

1. Commission a penetration test, or run the prepared live phases manually, before launch. Start with the IDOR sweep and the money races.
2. Fix SEC-0022: move schema ownership to `svc_migrator`.
3. Set `GATEWAY_IDENTITY_SECRET`, `TRUSTED_PROXY_HOPS=2` and `AUTH_SESSION_DENYLIST_URL` in each environment, and deploy the gateway before the TS services.
4. Revoke staff sessions on permission change.
5. Add money anomaly alerts and a scheduled reconciliation report.
6. Pin deployed images by digest, and add a secret-scanner allowlist entry for the Play test key.

## Scorecard

PASS means verified with evidence in this audit. PARTIAL means reviewed or partly tested. NOT RUN means not executed. Nothing marked NOT RUN should be read as a pass.

| Area | Result |
|---|---|
| Authentication | PASS (source review + SEC-0023/0024 fixed and runtime-verified) |
| Authorization | PARTIAL (static review passes; dynamic IDOR sweep NOT RUN) |
| API Security | PARTIAL (validation reviewed; fuzzing NOT RUN) |
| Business Logic | PARTIAL (refund and price controls tested; live abuse NOT RUN) |
| Financial Integrity | PASS for history and exactly-once refunds; live races NOT RUN |
| Webhook Security | PARTIAL (signatures and freshness fixed and unit-tested; live forgery NOT RUN) |
| Realtime Security | PASS (authorizer + SEC-0018, 63/63 tests) |
| File Security | NOT RUN |
| Database Security | PARTIAL (grants reviewed, SEC-0011 fixed; SEC-0022 open) |
| Queue Security | PARTIAL (idempotent money consumers; poison/replay NOT RUN) |
| Infrastructure Security | PASS (static review; Terraform valid; loopback binds) |
| Dependency Security | PASS (Go/npm/Python; Elixir not audited) |
| Privacy | PARTIAL (controls reviewed; leak sweep NOT RUN) |
| Rate Limiting | PARTIAL (limits configured incl. new routes; load test NOT RUN) |
| Fuzzing | NOT RUN |
| Race Conditions | PARTIAL (refund redelivery and hold race tested; broader races NOT RUN) |
| Chaos Testing | NOT RUN |
| Observability | PARTIAL (OTel, audit logs, denylist metrics; no money anomaly alerts) |
| Regression Coverage | PASS (every fixed finding has a test) |
