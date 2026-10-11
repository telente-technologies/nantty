# Remediations (4 Oct 2026)

What changed per finding, how it was verified, and what is still to do before deploying. Findings are in `FINDINGS.md`.

## Go audit update (8 Oct 2026)

The Go deep-scan and financial audit are **partially remediated, not closed**. Verified changes from the current remediation work:

| Finding | Change | Verification |
|---|---|---|
| GO F1/F2 | Signed `int64` multiplication now checks bounds before quantity and basis-point products | `cd services/go && go test ./platform/money` |
| GO F3 | Withdrawal affordability validates reservation bounds before subtraction, preventing underflow | `cd services/go/modules/wallet && go test ./src/modules/payouts/services` |
| GO F5 | Weighted allocation uses exact intermediate arithmetic for total weights and products | `cd services/go && go test ./platform/money` |
| GO F6 | Seller reserve calculation avoids overflowing the basis-point intermediate | `cd services/go/modules/ledger && go test ./src/modules/sellerBalances/services` |
| GO F11 | Ledger journal currency validation accepts only operationally supported currencies plus COIN | `cd services/go/modules/ledger && go test ./src/modules/journal/validators` |
| GO INFRA-008 | Non-positive durations are rejected as config errors and fall back, preventing invalid ticker intervals | `cd services/go && go test ./platform/config` |
| GO HTTP G3/G4 | Security headers and configured CORS allowlist wired into deployables | `cd services/go && go test ./platform/httpserver` |
| GO G1/G2/H4/H5 | Session denylist fails closed; staff/audit/webhook client IPs use trusted proxy resolution; webhook allowlist denies when empty | `cd services/go && go test ./platform/jwtauth ./platform/staffauth` plus focused webhook tests |
| GO MONEY-001 | Transfer POST is single-attempt; uncertain errors remain processing and definitive rejection is verified before failure; regression test added | `cd services/go/modules/payments && go test ./src/integrations -run 'TestCreateTransferDoesNotRetryUncertainProviderFailures|TestTransfersUseTheReferenceAndSurfaceOtpAndLowBalance'` |
| GO INFRA-001 | RabbitMQ and SQS handlers recover panics into the existing retry/redrive path; RabbitMQ regression test added | `cd services/go && go test ./platform/events -run TestHandlerPanicSchedulesRetryInsteadOfCrashingConsumer` |
| GO AUTH-002 | Account-directory gRPC interceptor now fails closed on empty token (matches ledger loader) | `cd services/go/modules/auth && go build ./...` |
| GO TRU-015 | Moderation staff-permission middleware denies on empty permission list instead of allowing | `cd services/go/modules/moderation && go build ./...` |
| GO TRU-016 | All moderation controllers derive audit IP from trusted-proxy `httpserver.ClientIP` instead of raw `X-Real-Ip` | `cd services/go/modules/moderation && go build ./...` |
| GO TRU-002/003/004/008 | Step-up now required for live strike actions (any non-keep_live), content REMOVE/WARN_AUTHOR, chat WARN/RESTRICT/SUSPEND, and appeal OVERTURN outcomes | `cd services/go/modules/moderation && go build ./...` |
| GO AUTH-001 | Suspended users may sign in/refresh (token carries `suspended` role, all actions denied) with allowlisted suspension/appeal reads via `RequireVerifiedAccessTokenAllowingSuspended` | `cd services/go && go test ./platform/jwtauth ./platform/staffauth`; `cd services/go/modules/users && go build ./...` |
| GO HTTP-002/H8 | `RateLimitAuthEndpoints` (10/20 token bucket) wired onto login, refresh, register, username-available, OTP send/verify, social, password-reset | `cd services/go/modules/auth && go build ./...` |
| GO TRU-001 | Settlement shortfall disable + `ad_spend_unrecoverable` record moved to a separate committed tx (previously rolled back); shortfall amount recorded | `cd services/go/modules/ads && go build ./...` |
| GO INFRA-006-adjacent | `staffGuard.authenticate` scoping bug fixed so fail-closed session checker compiles; test guard registers an active session checker | `cd services/go && go test ./platform/staffauth` |

Critical ads settlement (TRU-001) and the remaining findings are still open. MONEY-001 and INFRA-001 are verified existing protections rather than code changes from this pass. Do not use the historical finding text below as evidence that all other issues have been fixed.

## Deploy checklist (do in order)

1. **Generate `GATEWAY_IDENTITY_SECRET`** (32+ random bytes, base64). Store it in each environment's Secrets Manager entry for `gateway`, `social`, `notifications`, `media`, `search` and `support`.
   - The key was added to `secret_keys` in `infra/aws/modules/platform/services.tf`.
   - `secrets.tf` ignores changes to secret values, so existing environments need the key added by hand.
   - The placeholder value `CHANGE_ME` is too short on purpose: services refuse to start with it.
2. **Roll out the TS services and the gateway together.**
   - A gateway with the secret works with old services, which ignore the new header.
   - New services behind an old gateway reject all identity, so users appear logged out.
   - So deploy the gateway first, then the services.
3. **Rotating the secret later:**
   1. set `GATEWAY_IDENTITY_PREVIOUS_SECRET` to the current value on the services;
   2. change `GATEWAY_IDENTITY_SECRET` on the services, then on the gateway;
   3. remove the previous secret after one deploy.
4. **SEC-0011 migration:** owner approved on 2026-10-04.
5. **Local `.env` files** need `GATEWAY_IDENTITY_SECRET` (the `.env.example` files have a `local-only-…` value). Without it the TS services fail at startup with a clear config error.

## Per finding

| ID | Change | Files | Verified by |
|---|---|---|---|
| SEC-0001…0007 | See FINDINGS (static agent) | as listed there | their unit tests |
| SEC-0009 | Step-up on uphold and counter-notice accept/reject/court-action; admin client marks them step-up | `moderation/.../copyrightClaims.routes.go`, `apps/admin/src/config/apiAccess.config.ts`, moderation integration tests | moderation copyright integration tests (Postgres) pass |
| SEC-0010 | Gateway HMAC identity signature; verifying middleware in five services; secret in config, `.env.example` and Terraform | `gateway/src/services/gatewayIdentitySigner.service.ts`, `upstreamProxy.service.ts`, `gateway.config.ts`, `*/src/middlewares/gatewayIdentity.middleware.ts`, `*/src/app.ts`, `*/src/configs/*.config.ts`, `infra/aws/modules/platform/services.tf` | gateway vitest (13 files, 1063 tests); middleware tests in each service; `tsc` clean in all six |
| SEC-0011 | Address columns revoked from `zudomart_readers` and kept for `svc_orders` and `svc_commerce` | `users/src/migrations/20261004210000_restrict_shipping_address_reads_to_orders.{up,down}.sql`, `atlas.sum` | migration applies in the users integration run; owner approved 2026-10-04 |
| SEC-0012 | grpc moved to the fixed commit | `services/contracts/go.mod`, `services/go/platform/go.mod`, `services/go/deployables/go.mod`, go.sum files, `go.work.sum` | `go build` and `go test` for deployables, platform, contracts; govulncheck shows 0 reachable |
| SEC-0014 | Atomic conditional upsert; a suppressed stale update returns nil | `wallet/.../monetisationHolds.service.go` and its tests | unit test; two wallet integration tests pass on Postgres |
| SEC-0015 | Query token ignored; header or bearer accepted; gateway forwards the push-token header on webhooks | `payments/.../webhooks.controller.go`, its test, `gateway/.../upstreamProxy.service.ts` | controller unit test |
| SEC-0016 | Seven duplicate admin legal-notice routes removed from identity | `users/.../legal.routes.go`, `legal.controller.go`, `usersDocumentsLegalAndPrivacy.integration_test.go` | users legal integration test passes |
| SEC-0017 | Redirect passthrough on one gateway route with a safe-target check; backend `IsSafeClickTarget` | `gateway/src/routes/upstream.routes.ts`, `upstreamProxy.service.ts`, `upstreamDispatch.handler.ts`, `ads/.../adDestination.service.go`, `redirectAdClick.handler.go` | `adRedirect.handler.test.ts`, ads unit tests |
| SEC-0018 | Periodic and event-driven subscription recheck that kicks revoked topics | `realtime/lib/realtime/topics/subscription.guard.ex`, `clientSocket.socket.ex`, `domainEvent.router.ex`, `test/realtime/subscription.guard_test.exs` | `mix format --check-formatted`, `mix compile --warnings-as-errors`, `mix test` (63/0) in Docker |

## Open follow-ups

| Item | Owner | Why |
|---|---|---|
| Pub/Sub OIDC JWT verification for Play RTDN | payments | Google cannot send our header (SEC-0015) |
| Publish `conversation.memberRemoved` / `memberLeft` from social | social | instant kick instead of the 60 s recheck (SEC-0018) |
| Add `GATEWAY_IDENTITY_*` and the new realtime events to `services/contracts/events/asyncapi.yaml` and `docs/architecture/security.md` | platform | contract docs |
| Delete the unused identity notice commands/queries and the uncalled internal progress route | identity | dead code left by the SEC-0016 fix |
| Bump grpc to `v1.85.0` once it is tagged | platform | replace the dev pseudo-version |
| Separate migration-owner role from runtime roles | platform/DBA | SEC-0022 |
| Secret-scanner allowlist entry for the Play testdata key | platform | SEC-0019 |

## Related fix (not a finding)

- apiSmoke `businessPlanFee`: the billing code is correct (Business escrow fee 100 bps, from `ESCROW_FEE_BUSINESS_PLAN_BPS`). Plans now activate from the paid checkout and renew at full price through the renewal engine.
- The obsolete the previous payment provider `subscription.create` step was removed from `tests/businessPlanFee.smoke.test.ts`, along with its now-unused helper in `src/fakeLegacyProvider.util.ts`.
- The subscriptions integration tests pass. The full smoke needs the whole stack and was not run.

## Python audit update (9 Oct 2026)

P0 items from `PYTHON_BACKEND_DEEP_SCAN.md` remediated in `services/python/intelligence`
(all gates green: `ruff check`, `ruff format --check`, `mypy` strict, `pytest` 249 passed / 2 skipped):

| Finding | Change | Verified by |
|---|---|---|
| PYEVT-001 / PYSEC-011 | Staging/prod startup now rejects `EVENT_BUS=rabbitmq` without `RABBITMQ_URL` and `EVENT_BUS=sqs` without `DOMAIN_EVENTS_QUEUE_URL`; every `Null*Publisher` construction logs ERROR; publishers expose `delivers` (False on Null) and bot/trust/sensitivity callers report it instead of `True` | `tests/test_event_bus_configuration.py` (new), full suite |
| PYBUG-001 / PYHTTP-001 / PYEVT-004 | `classify_image` runs via `asyncio.to_thread` on the HTTP handler and the consumer path; new shared `AWS_CLIENT_CONFIG` (5 s connect / 20 s read) on rekognition, transcribe, s3, sqs clients | module suites |
| PYEVT-002 / PYBUG-007 / PYBUG-021 / PYBUG-008 / PYHTTP-004 | Domain-consumer, ingestion, bot, suspension and audio claims release on `BaseException` (cancel-safe, re-raise original, guarded release); ingestion guards the full accept path; audio excerpt TTL 20 y → 10 min | 2 new regression tests, module suites |
| PYBIZ-001 | `exchange_rate_unavailable` weight 0.0 → 0.35 floor (medium threshold) in order + coin-purchase rules | updated risk test asserts `review` |
| PYBIZ-002 / PYBUG-006 | Image-model failure logs, reports `model_version="unavailable"`, floors action at `review`; consumer logs `image_moderation_unavailable_for_media` instead of silent drop | new service test |
| PYBIZ-006 | Missing reserve-currency rate rejects every eligible ad with `reserve_unavailable` (new `resolve_reserve_price_or_reject`) instead of zeroing the floor | 2 new auction tests |
| PYSEC-001 | `server_workers > 1` without Redis rejected outside tests; `.env.example` ships `SERVER_WORKERS=1` | new config tests |
| PYBUG-022 / PYHTTP-014 | JSON formatter includes `stack_trace`; 500 handler logs with `exc_info`, method and path | suite |
| PYHTTP-005 | Rate-limiter evicts stalest entry instead of global `clear()` | suite |
| PYBUG-009 / PYBUG-010 | Logs added to head-model fallback, text-moderation degradation, experiment exposure writes | suite |
| PYBUG-016 / PYBUG-017 | `resolve_request_time` clamps client `now` to [−24 h, +5 min]; decay `pow` guarded; `ContractModel(allow_inf_nan=False)`; non-finite risk score fails closed to hold | suite |
| PYML-001 / PYBUG-004 / PYML-002 / PYBUG-005 | Reload + flush loops survive per-iteration exceptions; broader per-model catch; flush re-buffers rows on failure (bounded, counted); lifespan done-callbacks + isolated shutdown steps (PYBUG-020) | suite |

Still open: SQS DLQ/redrive (PYEVT-003), advisory-publish isolation (PYEVT-005/007), requeue attempt cap (PYEVT-006), model activation verification/rollback + TOCTOU + unsigned-secret holes (PYML-003/009/010, PYSEC-009/010), parquet retention/erasure (PYSEC-002, PYML-012), degraded-score floors across risk/moderation/spam/ads (PYBIZ-003/004/005/008/010/015, PYML-004/006), CPU off the loop (PYBUG-002/003), plus P2/P3 items.

## Frontend + Python batch (10 Oct 2026)

No code comments are added to the codebase by this work (user policy).

**Clips (apps/mobile):** clip video now sits flush above the bottom tab bar with no gap
(`clipPage.tsx` renders the bottom chrome only while paused and drops the
defunct 50 pt comment-bar offset); the `@handle · Zudomart` playback overlay
was removed from the playing clip. Downloaded copies were already burned
server-side (ffmpeg watermark + end card in `services/typescript/media`).

**Thread screen (apps/mobile):** `commentThread.screen.tsx` splits 404/410,
401/403 and network failures into distinct states with correct retry, renders
an explanatory state for deleted posts, and guards malformed payloads in the
thread branch/row components. `tsc --noEmit` clean.

**Pin comment + pin post:** post authors pin one comment per post (replace);
profile owners pin up to 3 posts (`409 PIN_LIMIT_REACHED`). Backend
`services/typescript/social` (schema `Comment.isPinned`, `Post.isPinned` +
`pinnedAt`, migration `20261010060000_post_comment_pins`, pin/unpin commands,
pinned-first ordering); mobile + webapp UI with Phosphor pin badges and mocks.
Verified: social vitest pin/thread suites pass, mobile `tsc` + jest pass,
webapp `tsc` + units pass.

**Modals (apps/mobile):** all sheets/dialogs without direct iconography now
carry Phosphor header/option icons (48 files), destructive options in error
color, no behavior or copy changes. `tsc --noEmit` clean.

**Python batch 2 (`services/python/intelligence**, gates green: ruff, format,
mypy strict 553 files, pytest 279 passed / 2 skipped): SQS DLQ + redrive with
attempt counting and jittered backoff (PYEVT-003); advisory-publish isolation
from ingest (PYEVT-005); attempt-header-before-publish with DLX cap (PYEVT-006);
single-read pickle verify, fail-closed signing secret, verified activation
with last-good rollback (PYSEC-009/010, PYML-003/009/010); parquet retention
GC + tombstone-first purge with 4-bucket ad-frequency cover (PYSEC-002/005/006,
PYML-012); degraded floors for feed/ads/ad-CTR/clips/recs/chat-spam/value-flow
and guarded fraud-head lookup; risk/text-moderation review floors; feed ranking,
headline clustering and event validation behind `to_thread` plus a bound of 8
on media fingerprinting (PYBUG-002/003).
