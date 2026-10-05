# Remediations (4 Oct 2026)

What changed per finding, how it was verified, and what is still to do before deploying. Findings are in `FINDINGS.md`.

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
- The obsolete Paystack `subscription.create` step was removed from `tests/businessPlanFee.smoke.test.ts`, along with its now-unused helper in `src/fakePaystack.util.ts`.
- The subscriptions integration tests pass. The full smoke needs the whole stack and was not run.
