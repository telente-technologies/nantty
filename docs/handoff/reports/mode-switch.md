# Mock to backend switch: report

## Commands (repo root)
- `pnpm mode:backend` / `pnpm mode:mock` / `pnpm mode:status` (options: `--app <name>` (repeatable), `--api-url <url>`, `--mobile-api-url <url>`, `--media-url <origin>`)
- `pnpm backend:up` (`-- --lan`, `-- --full`, `-- --no-seed`), `pnpm backend:check`, `pnpm backend:down` (`-- --keep-infra`, `-- --force`), `pnpm backend:seed`
- `pnpm check:no-mocks [app...] [--require-build]`
- Renamed: old `backend:up`/`backend:down` (compose only) became `backend:infra:up`/`backend:infra:down`; old `backend:check` (file-length + raw SQL lint) became `backend:lint`. README.md and services/README.md updated.

## Files
New: scripts/localMode/{modeSwitch,appTargets,envFile,lanAddress}.mjs, scripts/localStack/{backend.sh,backendCheck.mjs,lanForward.mjs,seedDemo.mts,demoAccounts.mts}, scripts/checkNoMocksInBuild.mjs, docs/runningLocally.md (linked from docs/README.md).
Edited: root package.json (scripts only), 5 Next transports (apps/{webapp,studio}/src/server/apiTransport.service.ts, admin/ads/seller *ApiTransport.service.ts), 5 *Environment.config.ts (isMockBackendEnabled is false in production), seller login + forgot-password pages, 5 mock entry files (+1 marker line), apps/mobile/eas.json (preview = real backend, new `demo` = mocks), apps/mobile/src/config/api.config.ts (unset flag defaults to __DEV__, not true), .github/workflows/frontend.yml (check step after next build and in the mobile job), README.md, services/README.md.

## Design
- Env merge: only mode keys are rewritten (every duplicate occurrence), other lines and secrets untouched; backups in .data/modeBackups/<app>/ (last 5). Next uses .env.local, Expo uses apps/mobile/.env. Mobile gets http://<LAN IP>:8080 automatically.
- backend:up wraps infra/local compose (core 5 containers by default) + prisma migrate deploy (social, media, search, notifications, support) + go build of 6 deployables + bootstrapSuperadmin into .data/localStack/bin + security/regression/startSandboxStack.sh (SANDBOX_PAYMENTS_PROVIDER=flutterwave, SANDBOX_RELAXED_LIMITS=1), bounded /healthz waits (240s required, 300s optional for realtime/intelligence), then the idempotent seed. If the gateway is already healthy it reuses the running stack; a half-started stack (ports busy, gateway unhealthy) is refused. No Paystack references in my scripts or docs (per the coordinator's update).
- --lan: Node TCP forward LAN_IP:8080/18333 to 127.0.0.1 (services stay loopback-only; preflight is unaffected).
- Prod stripping: the mock dispatcher is loaded with `process.env.NODE_ENV === "production" ? reject : import()`, and Turbopack folds it. Seller demo hints use the same pattern.

## QA results
- check:no-mocks on the stale pre-change builds: FAIL (webapp 61, seller 39, studio 6, ads 20, admin 177 marker hits). After rebuilding with the change: all 5 OK, 0 hits. webapp was also rebuilt in backend mode: OK. Mobile EAS check OK.
- Builds: seller/admin/ads/studio/webapp `next build` exit 0. Mobile tsc clean. Contract tests: webapp 81/81, seller 41/41, ads 15/15, studio 54/54, admin 35/38. The 3 admin money-contract failures call the mock handlers directly (no transport import) and are not related to this change; likely in-progress work by others (admin mocks are modified in git status).
- mode:backend wrote 7 env files; merge test kept a custom key, a comment and a duplicate key; staging --api-url clears stale local media keys.
- backend:up: all 12 required services up, intelligence up, realtime DOWN (optional; the elixir container did not become healthy in 300s, same Hex issue noted in earlier smoke runs). Seed created 3 accounts, store, 3 products, 2 posts, creator approval, live, buyer address/follows, staff admin. A rerun is idempotent.
- backend:check: 9/9 PASS (clips list is empty because the host has no ffmpeg; check reports it as expected).
- LAN forward: gateway reachable at http://172.20.10.6:8080; mode:status shows mobile reachable.
- Browser E2E (webapp, dev mode, real backend): 20 passed, 5 failed, 3 skipped. Failures:
  1. buyer checkout via fake Paystack: ECONNREFUSED 127.0.0.1:18999. The spec is outdated now that Paystack is removed (Flutterwave agent's area).
  2. chat two devices: message box never appeared; needs realtime (down) and E2EE setup.
  3. creator applies + plan: 403 VERIFICATION_REQUIRED from subscription plans (backend rule vs spec).
  4. guest: browser console logs 409 WALLET_NOT_READY from /payments/wallet/me. The webapp handles it (returns null); only the harness's console-error assertion flags it. Could be changed to a 200 with a not-ready state on the backend.
  5. like count after reload not exactly 1 (possibly eventual counter update); not investigated further.
- backend:down: all services, the LAN forward and the realtime container stopped; compose stopped. Verified no listeners on stack ports, no zudomart containers, no stack processes. Note: the compose infra had been running before this task; it is now stopped.
- Env files created during QA were removed afterwards (none existed before), so the apps are back on their code defaults (mocks in dev).

## Known gaps
- Clips need ffmpeg on the host (`sudo apt install ffmpeg`, then `pnpm backend:seed`). The seed then generates 4s test videos.
- The seeded live may not appear in /lives (no stream or heartbeat) and can end; a seed rerun restarts it.
- The mobile release bundle still contains (inactive) mock modules: Metro doesn't tree-shake static imports from apiClient and the live gift emitters (the livestream agent owns those). Only the config is guarded.
- On a phone over Wi-Fi, media URLs point to localhost:18333 (services read MEDIA_PUBLIC_BASE_URL from .env.example). Use adb reverse for images.
- EAS preview/production need EXPO_PUBLIC_API_URL set in the EAS environment (none is committed; app.json falls back to localhost).

## Follow-up round (coordinator items 1-8)

1. Like count after reload: backend was correct (idempotent like, API repro: count 1). The bug was in the webapp: a synchronous double click toggled like then unlike, and the server ended at 0. Fix: `togglePostLiked` in apps/webapp/src/utils/postEngagementCache.util.ts ignores a second toggle of the same post inside a 400 ms double-tap window; `usePostLike.hook.ts` uses it. Regression tests: 2 new cases in postEngagementCache.util.test.ts (7/7 pass). E2E like assertion now passes.
2. wallet/me 409: a GET returned 409 WALLET_NOT_READY for an unprovisioned wallet. go-money now returns 200 `{"wallet":null,"status":"not_ready"}` (providerWallets.controller.go). Webapp + mobile services map it to null (and still accept the old 409); mobile hook treats null as missing; both mocks match. Tests: services/go/modules/payments/payments.walletNotReady_integration_test.go (passes; fails on HEAD), deployables/flutterwaveFlows/flutterwaveWalletNotReady_test.go (that package does not compile right now because of another agent's in-flight harness edit: WebhookIpAllowlist), mobile src/services/money/__tests__/providerWallet.service.test.ts (2/2).
3. Demo creator is L1: the seed runs the real payout onboarding against the fake Flutterwave (resolve, identity with the resolved holder name, bank with step-up, BVN consent, then wallet activation). The demo buyer stays unverified. The E2E creator spec now also verifies its creator via apiSmoke verifyNigerianUserToLevelOne before creating a plan.
4. Realtime: backend:up removes the sandbox's docker realtime and runs `mix phx.server` natively (MIX_ENV=dev, 127.0.0.1:4000, JWKS/issuer/audience, the live/social internal tokens read from the services' .env.example; the docker launch used a mismatched live token). Realtime is now a required health check. backend:check adds realtime /healthz plus a real socket auth (`/api/v1/auth/realtime-token` then WS `auth` frame, expects auth.ok). 11/11 pass.
5. Checkout spec: new services/scripts/browserE2e/src/helpers/flutterwave.helper.ts rewrites the fake hosted link to checkout-testing.flutterwave.com (the webapp's allowlist), completes the charge with the fake's signed webhook, redirects to /pay/return; the spec polls GET /api/v1/payments/{reference} for succeeded. The buyer (3 checkout tests) and creator subscription specs are switched; no Paystack left in webapp specs. Button label now "Pay securely". All 7 buyer tests pass.
6. Mobile mocks stripped: apps/mobile/metro.config.js resolves any import of src/mocks from outside it to src/config/mocksDisabled.stub.js when EXPO_PUBLIC_USE_MOCKS is "false" (or unset in a production export). `expo export` production: 0/84 mock markers (bundle 7.5 MB); demo export (mocks on): 84/84 flagged (8.1 MB). New `pnpm check:no-mocks:mobile` (export + scan), also in the CI mobile job. Demo profile is unaffected.
7. backend:down only stops what up started: up records infra services that were not running in .data/localStack/startedInfra.txt and stops only those; services are stopped only via its own pid files. Verified: postgres (already running) was left up.
8. Clips: committed fixture scripts/localStack/fixtures/demoClip.mp4 (4 s synthetic testsrc2 + sine tone, H.264/AAC, 308 KB), seeded as 3 clips. Without a host ffmpeg, backend:up builds `zudomart-local-ffmpeg:1` (scripts/localStack/ffmpeg/Dockerfile, alpine + apk ffmpeg) and prepends docker-backed ffmpeg/ffprobe wrappers to the media service's PATH.

Other app-to-backend breakages found and fixed in the webapp: creator plans, connections and blocked lists read list envelopes as bare arrays (switched to sendListRequestToWebappServer; the Subscribe button was missing); clips without a sound crashed ClipPlayerCard (sound optional, "Original audio"); the profile never showed the viewer's follow state or a fresh follower count after reload (now read from /users/{id}/follow-status); double-submit on chat Send and "Continue to checkout" (synchronous ref guards); the subscription checkout never stored the pending subscription id, so the return page fell back to /orders; the escrow read is skipped for unpaid orders (404 noise). Stale E2E bits fixed: the chat request flow (accept via the Message request region; Requests is now a folder switcher), the ciphertext check column (sharedContent is gone; linkPreviewEnvelope), a stale test.fail on the web chat photo (it passes now).

Webapp browser E2E against the real backend (dev mode): 20 passed at the start of the round, then 21, 24, 27, 30, 27, and a final 35 passed, 2 failed, 6 skipped. The buyer spec alone is 7/7 and the creator spec alone passes. Remaining:
- chat "report: pick messages" fails because the spec opens Bob in a fresh browser context (a new E2EE device), which by design cannot decrypt or report earlier messages; the spec needs to reuse Bob's device.
- register "expired session": console 401s from /legal/policy-versions/current and /users/me/policy-acceptances because the BFF forwards the expired token. A BFF retry without the token for public routes would quiet it.
Production-mode harness (`--mode=start`) is not a fair local target: production CSP blocks http://localhost:18333 media and secure cookies expect HTTPS.

Checks: webapp tsc clean, units 7/7, contracts 81/81; mobile tsc clean, jest 8/8; browserE2e tsc clean; payments integration test pass; backend:check 11/11.
Note: pnpm 11 checks dependencies before running a script, so `pnpm backend:down` once synced node_modules to the lockfile that another agent had changed (-30 packages). I did not change the lockfile.
Everything started was stopped: no stack listeners, no stack processes; postgres stays up because it was running before this round. No app env files left behind.

## Final round: chat report spec and expired sessions

Chat spec (services/scripts/browserE2e/specs/webapp/chat.spec.ts): Bob's first browser context (his first E2EE device) is kept open after the two-device test and reused by the report test, so it decrypts the earlier messages; it is closed in afterAll. The "new device" test now also asserts that a brand-new device shows "Sent before this device joined secure chat" (correct E2EE behaviour).

Expired sessions in the Next BFFs:
- New per-app helper `src/server/accessTokenExpiry.service.ts` (webapp, seller, studio, ads, admin) reads the JWT `exp` (unverified; the gateway verifies) with a 10 s skew. A token known to be expired is never forwarded: the BFF refreshes first.
- webapp (`server/gateway.service.ts`) and studio: refresh once per request (before forwarding if expired, or after a 401). If the refresh fails, optional-auth routes (public reads, studio public routes) are retried anonymously, viewer fields are reset and the session cookies cleared; auth-only routes answer 401 SESSION_EXPIRED with cleared cookies and the API is not called.
- seller, ads: pre-flight refresh; a failed refresh (before or after a 401) ends in SESSION_EXPIRED with cleared cookies; no double refresh in one request.
- admin: pre-flight refresh added; it already ended the session on a failed refresh.
- Webapp client (services/clientApi.service.ts + utils/sessionExpiry.util.ts): SESSION_EXPIRED on any method sends member-only pages to /login?next=<page> (once) and only prompts sign-in on guest-browsable pages. The other four apps already redirect on these codes.
- `/api/v1/legal/policy-versions/current` added to the webapp's guest public reads (the gateway serves it anonymously).
- Tests: `src/contracts/bffExpiredSession.test.ts` in all five apps, run against a fake gateway on a random local port. Webapp has 6 cases: expiry parsing, refresh-before-forward, anonymous fallback on a public read, SESSION_EXPIRED on a member route, anonymous retry after a gateway 401, and the client decision. The other apps have 3 each. They fail on HEAD (webapp 4 of 6, seller 2 of 3) and pass now.

Checks: tsc clean in all five apps; contracts webapp 87/87, seller 44/44, studio 57/57, ads 18/18, admin 38/41 (the same 3 pre-existing money-contract failures, unrelated). backend:check 11/11.

**Final webapp browser E2E against the real backend (dev mode): 37 passed, 0 failed, 6 skipped. The 6 skips are deliberate product-decision fixme/skip markers plus one data-dependent skip.**

Stopped everything this round started (services, realtime, infra it brought up). Postgres was already running and was left alone. No stack listeners or processes, and no app env files left behind.
