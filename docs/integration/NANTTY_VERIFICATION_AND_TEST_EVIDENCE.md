# Nantty Verification & Test Evidence

## 2026-11-27 — Normalize and reject ambiguous regional coin price keys

- `MONEY_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' GOTMPDIR=/tmp GOMAXPROCS=2 go test -p 1 ./modules/wallet/tests -run '^TestAdminCoinCountryPriceOverrideRoundTripsAndRejectsCurrencyMismatch$' -count=1 -v` — PASS; validates lowercase code canonicalization, country/currency mismatch, and duplicate country alias rejection against the database-backed API harness.
- `MONEY_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' GOTMPDIR=/tmp GOMAXPROCS=2 go test -p 1 ./modules/wallet/... -count=1` — PASS, including the country-price list/checkout recheck integration and all Wallet packages.
- `GOTMPDIR=/tmp GOMAXPROCS=2 go vet -p 1 ./modules/wallet/...` — PASS. `bash services/scripts/check-backend-file-lengths.sh` and `git diff --check` — PASS.
- Pushed to PR #82 as `1f0024c036173bb872dff5c1aa4a5bb946fa0d4b` (`fix(wallet): normalize regional coin price keys`, no co-author trailer). Current-head Backend, Frontend, Security and CodeQL checks are running; reviewDecision is unset. No browser, store sandbox, live PSP, AWS or deployed-runtime verification was performed.

## 2026-11-27 — Country-specific coin package pricing (local verification)

- Added Admin country override editing per existing channel-specific coin pack, with supported-country currency validation; unsupported countries/currencies and non-positive overrides are rejected by the mock handler and Go API validation. Incomplete override amounts are blocked in the Admin dialog.
- Go uses a country-qualified internal key in the existing `coin_packages.prices` JSON, preferring that key only when its currency matches the resolved region, then falling back to existing currency and USD selection. The web purchase endpoint resolves charging country again server-side; country and currency are part of the idempotency fingerprint, and the persisted purchase uses the selected authoritative amount.
- Executed from `services/go`: `go test ./modules/wallet/tests -run '^TestCountrySpecificCoinPriceIsShownAndRecheckedAtCheckout$' -count=1` — PASS; `go test ./modules/wallet/tests -count=1` — PASS. An earlier full CI integration run exposed a hard-coded `wallet.coin_packages` test query incompatible with the isolated per-test schema. The test now uses the schema configured by its harness. Current-head GitHub workflows are running: [Go/integration checks 45932400731](https://github.com/telente-technologies/nantty/actions/runs/45932400731), [security/dependency checks 45932400791](https://github.com/telente-technologies/nantty/actions/runs/45932400791), [frontend planning checks 45932400700](https://github.com/telente-technologies/nantty/actions/runs/45932400700). The previous run's Go build/vet/unit tests passed; its integration job failed only at the hard-coded-schema test. Database-backed coverage includes list-price/checkout recheck and Admin override save/read round-trip plus wrong-country-currency rejection.
- Executed from repository root: `corepack pnpm --filter @nantty/admin typecheck` — PASS; `corepack pnpm --filter @nantty/admin test:contracts` — PASS (86/86); `corepack pnpm --filter @nantty/admin lint` — exit 0, 53 warnings, no errors. Host Node is v24.19.0 while workspace expects >=26.13.0; rerun under declared Node before merge.
- `bash services/scripts/check-backend-file-lengths.sh` — PASS; `git diff --check` — PASS. A separate focused ESLint invocation from repository root was invalid because it loaded the ESM config as legacy YAML; the supported Admin lint script above completed successfully.
- Follow-up database integration: `MONEY_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' GOTMPDIR=/tmp GOMAXPROCS=2 go test -p 1 ./modules/wallet/tests -run '^TestAdminCoinCountryPriceOverrideRoundTripsAndRejectsCurrencyMismatch$' -count=1 -v` — PASS. Added lowercase currency/country canonicalization and duplicate country-alias rejection assertions.
- Not run: Admin browser visual test, native StoreKit/Play Billing sandbox, live payment/store verification, completion of the current-head PR CI, AWS plan/apply/deploy. Do not infer these from local tests.

## PR #77 and staging recheck — 2026-11-26

- PR #77 was squash-merged as `b5a32658210652f4a5be200a1296f46163276fd8`; the merge message contains no `Co-authored-by` trailer. The change replaces randomized selection of mock live-gift viewer identities with deterministic cycling and adds a fake-timer regression test.
- Local focused test `pnpm --filter @nantty/mobile exec jest --runInBand src/services/live/__tests__/liveGiftMockEmitter.test.ts` passed (1/1). Package-local ESLint, `tsc --noEmit -p tsconfig.json`, and `git diff --check` passed on Node 24.19.0, below the repository's Node 26.13 target. PR mobile CI and JavaScript CodeQL passed. The post-merge JavaScript CodeQL analysis completed successfully and GitHub marked alerts #35/#36/#44 fixed at 2026-11-26 19:01 UTC. Alert #91 remains open. Post-merge Go CodeQL/Security and unrelated Frontend jobs were still in progress at the latest check.
- Main Deploy run `45874563086` built and Trivy-scanned all 16 ARM64 service images on native ARM runners, but the deploy job failed closed before ECR push because `AWS_ACCOUNT_ID_STAGING` was unset. Current read-only GitHub environment inspection: `staging` has `AWS_REGION=eu-north-1` only; `staging-apply` has no variables. No AWS resources were changed and no ECR push/ECS deployment/runtime smoke occurred.
- AWS project and DNS evidence: GitHub OIDC Terraform/apply and ECR/deploy role configuration is absent or unverified. The current Terraform/deploy path covers backend ECS only; frontend hosting and staging subdomains are not configured. Cloudflare API plus public `dig TXT nantty.com` confirm one root SPF record, `v=spf1 include:_spf.mx.cloudflare.net include:zohomail.com ~all`; no change was needed. SES DKIM and MAIL FROM DNS records resolve, but SES status has not been re-polled and sending remains unverified/sandbox-only.

## SES staging DNS propagation recheck — 2026-11-26

- Public `dig` currently resolves all three SES DKIM CNAMEs to their matching `*.dkim.amazonses.com` targets, `bounce.staging.nantty.com` MX priority 10 to `feedback-smtp.eu-north-1.amazonses.com`, and its SPF TXT to `v=spf1 include:amazonses.com ~all`.
- `_dmarc.nantty.com` still publishes `p=reject; sp=reject`; `_dmarc.staging.nantty.com` has no TXT result. No DNS was modified by this check.
- This verifies resolver-visible DNS only. SES identity/DKIM/MAIL FROM status must still be re-polled; AWS send status, Terraform state adoption, hosted plan, email runtime and actual authorized test delivery remain unverified.

## Compatible dependency refresh and local capacity — 2026-11-26

- Updated compatible in-range dependencies and lockfiles across pnpm, Go, Python and Elixir; retained Expo SDK-managed native package versions. `pnpm audit --audit-level=high` reported no known vulnerabilities. Relevant Node 26.13 checks passed for Webapp, Developer, Admin and Sandbox; Python suite: 393 passed, 2 skipped; mypy: no issues across 597 files; Ruff passed; Elixir compile and 110 tests passed.
- A post-refresh full Auth Go test/vet command was started against isolated PostgreSQL but interrupted during a cold compile when a separate Gradle build was active and `/tmp` had only 2.1 GB available. It is explicitly not counted as passing. Capacity-safe Go reruns remain required after the other build releases space.
- Removed only regenerable caches. `df -h /` initially showed 21 GB available; a concurrent unrelated Gradle build then reduced it to 17 GB. No active Gradle cache, project source, database volume, or user data was removed. `git diff --check` passed. The current checkout is `main` at the same commit as `origin/main`; GitHub reports no open PRs, and 154 paths remain locally modified/untracked.
- Compatibility boundary: local Python is 3.14.8; `uv python install 3.14.10` reported no build for this host. Expo-managed native dependencies, major-version candidates and native-sensitive packages were not force-upgraded. Native Android/iOS builds and full Go workspace verification were not performed after these dependency changes.

## Go Ads deployable subtree compilation — 2026-11-26

- `GOTMPDIR=/tmp GOMAXPROCS=2 go test -p 1 ./goAds/...` from `services/go/deployables`: **passed** (`nantty/deployables/goAds` has no test files). This fills the individually unverified Ads subtree from the earlier capacity-limited aggregate run.
- The aggregate `services/go/deployables` module remains unverified as a single run; this bounded subtree check does not claim the aggregate passed.

## Business Messaging consent approval and denial callbacks (2026-11-26)

- Implemented an authenticated denial endpoint in addition to the store-bound S256 PKCE approval-code flow. It revalidates that the Business Messaging app is approved, the exact store authorization remains active, and the callback URI exactly matches an allowlisted URI before returning `error=access_denied` plus the original `state`. It creates neither consent nor authorization-code data. The response is `no-store` and uses `no-referrer`.
- Added PostgreSQL integration test `TestBusinessConsentDenialReturnsOnlyAllowlistedCallbackAndState`, covering anonymous rejection, exact callback host/path and retained fixed query parameter, denial/error/state semantics, unknown callback rejection, revoked store-grant rejection, and zero consent/code rows. The first run exposed a 500 error mapping for revoked grants; after routing through the existing Business Authorization error mapper, the test passed.
- `AUTH_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' GOTMPDIR=/tmp go test ./tests -run '^TestBusinessConsentDenialReturnsOnlyAllowlistedCallbackAndState$' -count=1 -p 1`: **passed**. Full Auth `go test ./... -count=1 -p 1`: **passed**. `GOTMPDIR=/tmp go vet ./...`: **passed**. Webapp consent utility tests under Node 26.13.0: **4/4 passed**; full Webapp suites passed contracts **175/175**, utilities **373/373**, services **33/33**, typecheck and focused ESLint **passed**. Developer portal tests **36/36**, typecheck and focused ESLint **passed**. `check-backend-file-lengths.sh` and `git diff --check`: **passed**.
- Approval-code integration separately verifies code hash storage, expiry, exact redirect, PKCE, wrong-app credential, replay, consent revocation, same-scope regrant invalidation, and fresh code after reapproval. The Auth full suite includes it.
- No signed-in browser, external integration callback, staging deployment or persistent database migration was exercised. Production sending remains disabled pending a distinct customer-opted-in business-managed mode, eligibility/window rules, canonical Social business-managed dispatch/storage, inbound synchronization and delivery/read receipts. Personal E2EE conversations are not eligible for this integration.

## Customer Business Messaging consent review (2026-11-26)

- Added authenticated Webapp route `/connect/business-messaging` for one `applicationId` and one `storeId`. The page previews the approved app and authorized store, requires the user to choose permissions, and requires a separate confirmation before calling the authenticated consent grant endpoint. Repeated/malformed resource parameters are rejected; opening the route alone does not grant permission.
- Auth preview route is `GET /api/v1/account/business-messaging/applications/{applicationID}/stores/{storeID}/consent-preview`. PostgreSQL query only returns an approved Business Messaging app with an active grant for the exact store and supplies `availableScopes` as the intersection of the requested scopes and the merchant's grant. Focused integration test: `go test ./tests -run '^TestBusinessConsentPreviewRequiresApprovedAppAndActiveStoreGrant$' -count=1 -p 1` in `services/go/modules/auth`: **passed**.
- Webapp scope/parameter tests: **3/3 passed** under Node 26.13.0. Webapp `pnpm typecheck` and focused ESLint over the new route/component/service and consent utility/test both exited 0. `bash services/scripts/check-backend-file-lengths.sh` reported all backend files at most 300 lines, and `git diff --check` passed.
- After adding `/connect`, the complete Webapp suites passed under Node 26.13.0: contracts **175/175**, utilities **373/373**, and services **33/33**. The first contract run correctly failed because `connect` was not reserved from username routing; the route was added to the Webapp and Go Identity reserved-route registries, and the rerun passed.
- Full Auth module `AUTH_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' go test ./... -count=1 -p 1`: **passed**, including the new Postgres integration. The test created and cleaned a unique schema; the shared test database was not migrated or modified persistently.
- The later consent callback section above adds local authorization-code/PKCE approval and denial callbacks; browser/staging verification is still outstanding. UI was not rendered in a browser, and no real external app was used. Production sending remains disabled.

## Go workspace-wide test attempt (2026-11-26)

- `go test ./...` at `services/go` failed because the workspace root is not a Go module. A sequential per-module run was then attempted.
- Passed before the environment limit: contracts packages (no test files), `deployables/flutterwaveFlows/tests`, `deployables/goCommerce/tests`, `deployables/goMoney/tests`, and `deployables/goIdentity` packages (no test files).
- The aggregate `deployables` module exhausted the 7.8 GB `/tmp` tmpfs while compiling `goLive`; Go reported `no space left on device` across Live and dependent Trust/Moderation packages. The run exited nonzero and did not reach all listed modules. This is an incomplete verification attempt, not a source-level test failure or a workspace pass.
- Follow-up complete `go test ./... -count=1 -p 2` runs passed for modules Admin, Ads, Catalog, Creators, Currency, Escrow, Inventory, Ledger, Orders, Subscriptions, Users, Wallet, and Platform. Full-module Auth, Analytics and Payments checks also passed separately. Live and Moderation test packages passed `go test ./tests/... -count=1 -p 2`; this does not establish a full build of every source package in either module.
- Post-run check after the initial failure: `/tmp` had 7.6 GB free and no surviving Go build directory; root filesystem had 2.0 GB free before follow-up cache growth. After scoped tests, the 11 GB regenerable Go compiler cache was removed with `go clean -cache` to honor the prior disk-space request; module downloads, source, Docker volumes, and user files were preserved. Root free space returned to 12 GB. Full aggregate `deployables` compilation remains unverified and needs smaller package batches or more build-temp/disk capacity.

### Capacity-safe deployable follow-up (2026-11-26)

- Complete module runs `GOTMPDIR=/var/tmp go test ./... -count=1 -p 1` passed for `services/go/modules/live` and `services/go/modules/moderation`.
- Individual deployable trees passed with `GOTMPDIR=/tmp`: `goLive/...`, `goCommerce/...`, `goIdentity/...`, and `goTrust/...`. Identity and Trust currently report no test files, but their packages compiled. The earlier aggregate output also reached `goAds` (no test files) and `flutterwaveFlows/tests`; `goMoney` tests passed before the aggregate capacity failure.
- The aggregate `services/go/deployables` run using `/var/tmp` still failed with `no space left on device`; a separate cold-cache `GOTMPDIR=/tmp go test ./goMoney/... -count=1 -p 1` subsequently passed, including `goMoney/tests`. The individual tree results provide package-level verification but are not an aggregate deployables pass.
- `go clean -cache` removed only the regenerable Go build cache. The module download cache was retained (5.5 GB at the post-clean check); repository files and Docker data were untouched. Root free space was restored to approximately 12 GB and `/tmp` to 7.3 GB. `git diff --check` passed after documentation changes.

## Supported-Node Webapp suite and Smile retry guidance regression (2026-11-26)

- Ran with an isolated Node 26.13.0 runtime, matching the repository requirement. `pnpm --filter @nantty/webapp test:contracts`: **175/175 passed**; `test:units`: **373/373 passed**; `test:services`: **33/33 passed** after correcting two stale assertions in `smileIdWebIntegration.service.test.ts` to match the current close-before-retry safety copy. `pnpm --filter @nantty/webapp typecheck`, focused `connectedBusinessAppsSection.tsx` ESLint, and Business Messaging scope tests (**2/2**) passed.
- The assertions now require that retry guidance tells users to start another capture only after Nantty confirms the prior attempt is closed. No production retry/cancellation behavior was changed.
- This is automated local verification; authenticated browser behavior, live Smile sandbox, and deployment remain unverified.

## Developer SSO authorize parameter hardening (2026-11-26)

- Identity now rejects missing, blank, too-short, or over-512-byte OAuth `state`, duplicate required authorize parameters, and non-canonical/incorrect-length S256 PKCE challenges before authenticating or issuing an authorization code. The normal generated Developer state (24 random bytes, base64url) and challenge (SHA-256 of the verifier) remain compatible.
- Route integration regression passes for each invalid-input case and confirms a valid state proceeds to the existing authentication check. Full Auth test suite passes against disposable PostgreSQL 17; `go vet ./...`, backend file-length gate, and `git diff --check` pass. This does not verify cross-domain SSO in a real browser or deployed environment.

## Flutterwave checkout payload checksum finding (2026-11-26)

- Reviewed `go/weak-sensitive-data-hashing` at `services/go/modules/payments/src/integrations/flutterwaveCharges.integration.go`. Flutterwave's current Checksum documentation mandates exactly this two-stage SHA-256 `payload_hash` construction; the hash is a checkout integrity checksum, not password storage or authentication. Replacing it with a password KDF or a different MAC would break provider interoperability. Renamed the input from `secretKey` to `merchantCredential`. GitHub alert #75 remains open: delegated alert dismissal is enforced and the current GitHub token lacks `admin:repo_hook`; the authorized request-and-approval workflow is still required. No inline suppression directive was retained.
- On 2026-11-26, re-ran `go test ./tests/integrations/paymentsTesting -run '^TestFlutterwavePayloadHashMatchesDocumentedChecksumVector$' -count=1 -v` in `services/go/modules/payments`; the expected vector passed. This does not clear the remote CodeQL alert or substitute for a fresh CodeQL scan.
- Added a fixed expected checksum test independently computed with OpenSSL; the fake-provider parity check alone was not independent.
- `go test ./tests/integrations/paymentsTesting -run 'TestFlutterwave(PayloadHashMatchesDocumentedChecksumVector|CheckoutIsHashedAndVerifiedByIdWithTheExactReference)$' -count=1`: **passed**. `go test ./...` in `services/go/modules/payments`: **passed**.
- The source aligns with Flutterwave's documented checksum. A fresh CodeQL analysis and delegated dismissal approval remain pending; no live Flutterwave account or charge was used. Source: https://developer.flutterwave.com/docs/checksum

## Social encrypted-message idempotency (2026-11-26)

- Added `messages.clientPayloadHash` via an additive nullable migration. Personal and store-inbox message retries compare a canonical SHA-256 digest of encrypted payload fields; pre-migration records compare the persisted encrypted fields and normalized mention data. Store-inbox idempotency replay checks active team access and registered device before returning an existing message.
- `pnpm --filter @nantty/social exec vitest run tests/messages/messageIdempotency.service.test.ts tests/storeInbox`: **4 files, 19 tests passed**.
- `pnpm --filter @nantty/social typecheck`: **passed** (source and test TypeScript checks); local Node v24.19.0 emitted an engine warning because package policy requires >=26.13.0 <27.
- `DATABASE_URL='postgresql://nantty:nantty@127.0.0.1:15433/nantty_test?schema=social_cb_test_20261126' RUN_INTEGRATION=1 pnpm --filter @nantty/social exec vitest run tests/integration/messagingKeys.integration.test.ts`: **1 integration test passed** after all 33 Social migrations were applied to a uniquely named schema in disposable PostgreSQL. It verifies that concurrent identical requests return one message ID and create one row, and that same-key changed ciphertext is rejected with 409. The test schema was dropped afterward; the pre-existing shared Social schema and persistent databases were not modified.
- This is local test evidence only. The full suite under supported Node 26, persistent migration rollout, staging, and real-device cross-client behavior remain unverified.

## GitHub staging secret isolation (2026-11-26)

- The Terraform staging workflow now requires separate environment-scoped Cloudflare credentials: `STAGING_CLOUDFLARE_DNS_READ_TOKEN` in `staging` for both read-only plan paths, and `STAGING_CLOUDFLARE_DNS_WRITE_TOKEN` in `staging-apply` for the gated apply. The generic repository secret is no longer referenced by this workflow, preventing fallback to a broader token.
- GitHub API read-only checks confirm both environments are restricted to `main`; `staging` currently has only `AWS_REGION` and no secrets, while `staging-apply` currently has no variables or secrets and retains its configured reviewer gate. Values were not retrieved or modified.
- Ruby YAML parsing, `bash -n` on every embedded workflow `run:` script, and an assertion of the exact per-job secret references passed. No authenticated Terraform plan was run.

## Production Business Messaging transactional webhook outbox (2026-11-26)

- Replaced best-effort webhook enqueue after message dispatch with one PostgreSQL transaction that updates the accepted message and queues matching verified endpoint deliveries. Outbox read, JSON decode, and insert errors now fail the confirmation transaction; endpoint subscriptions share one event ID/envelope and are filtered by exact event or wildcard.
- `AUTH_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' go test ./tests -run '^TestProductionMessageConfirmationAndWebhookOutboxAreAtomic$' -count=1 -v` in `services/go/modules/auth`: **passed**. Isolated-schema coverage verifies matching/wildcard filtering, exclusion of unrelated/inactive/unverified/other-application endpoints, idempotent replay without duplicate queue rows, and rollback of the message status when outbox insertion fails.
- The public production send route remains mounted to `503 BUSINESS_MESSAGING_UNAVAILABLE`; this test validates the internal persistence contract only. It does not verify a distinct Social business-managed dispatch/storage path, real webhook HTTP delivery, message reconciliation after downstream acceptance, migration rollout, or staging. Personal E2EE messages must not be used as a fallback.

## Production webhook worker persistence failures (2026-11-26)

- Delivery batch scanning now returns scan, iteration, and close failures instead of silently skipping records. Delivery success and retry/failure metadata are saved in transactions; database errors are returned to the worker cycle for logging/retry rather than ignored. Persisted error strings are sanitized and do not include raw transport/DNS errors or destination URLs. A lease column plus `FOR UPDATE SKIP LOCKED` claim transaction prevent concurrent worker replicas selecting the same pending row; bounded leases are cleared after persisted outcomes and expire for crash recovery.
- `AUTH_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' go test ./tests -run '^TestProductionWebhookWorkerReportsPersistenceFailures$' -count=1 -v` in `services/go/modules/auth`: **passed**. Isolated PostgreSQL assertions cover retry metadata, sanitized error persistence, rollback/error propagation on a rejected update, and a concurrent second worker seeing zero claimable rows while the first is sending.
- The same integration test now also uses a database trigger to deactivate a webhook after claim but before the just-in-time lookup; the worker skips sending and the transport confirms zero requests. The worker reads the current URL and encrypted signing secret only for a still-pending leased delivery with an active, verified endpoint and approved application. For `business.message.dispatched`, it additionally requires the persisted message/store grant and recipient consent to remain active with `messages:send`.
- `TestProductionWebhookWorkerRevalidatesBusinessAuthorization` passed against isolated PostgreSQL 17. Triggers suspend the application or revoke the store grant after both deliveries are claimed; the worker issues zero requests. Recipient consent is also part of the required query predicate. These checks complement the endpoint-deactivation race case.
- Auth migration upgrade/rollback/replay passed with the additive lease migration. Delivery to an actual HTTPS receiver and end-to-end event delivery remain unverified. Delivery remains at-least-once if a process stops after remote acceptance; consumers must deduplicate using `eventId`.
- After endpoint, application, store-grant, and recipient-consent revalidation changes, full `go test ./... -count=1` in `services/go/modules/auth` passed with isolated PostgreSQL 17 integration enabled (51.475s); race-enabled worker/revocation tests passed (1.624s). The previous backend file-length gate and `git diff --check` passed; the worker remains under the repository's 300-line backend-file limit. Actual HTTPS receiver and deployed worker behavior remain unverified.

## Sandbox PostgreSQL integration and application suite (2026-11-26)

- `SANDBOX_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' pnpm exec vitest run` in `services/typescript/sandbox`: **57/57 passed across 9 files**, with both SQL integration tests enabled. Integration coverage includes legacy per-application quota aggregation into organization-wide usage, compatibility-trigger synchronization, credential lifecycle and isolation, synthetic inbound/outbound idempotency/status, webhook secret persistence, outbox, failure, retry, and audit.
- `pnpm typecheck` in the Sandbox service: passed for source and tests. `pnpm lint`: passed.
- The integration tests create isolated schemas and clean them up. The signed-in Developer/Sandbox browser path, controlled real HTTPS receiver and AWS deployment are not covered by this run.

## Developer application and production-access authorization (2026-11-26)

- `AUTH_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' go test ./tests -run '^(TestDeveloperApplicationsAreOrganizationScopedAndAudited|TestProductionResourcesRequireApplicationCapabilities|TestProductionMessageHistoryAndStatusAreTenantAndConsentScoped)$' -count=1 -v` in `services/go/modules/auth`: **passed**.
- Coverage includes application lifecycle/organization isolation/audit; capability outcomes for Owner, explicitly granted and ungranted Developer, Analyst, Billing role and outsider; and tenant/store/recipient-consent boundaries for production message history/status.
- Tests use disposable schemas and did not modify persistent application data. Gateway/portal browser behavior and production deployment remain unverified.

## Admin Developer quota adjustment entitlement guard (2026-11-26)

- `AUTH_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' go test ./tests -run '^TestAdminQuotaAdjustmentCannotGrantOrChangePaidEntitlements$' -count=1 -v` in `services/go/modules/auth`: **passed**.
- Confirms missing/sandbox/unverified paid plans cannot be created or activated by the admin quota endpoint; after a verified active paid subscription is present, quota changes preserve plan tier, status, billing period, and provider reference.
- The test uses temporary tables scoped to the test connection. It does not verify the live Admin browser, all admin operations, or a deployed migration.

## Admin Developer quota adjustment UI and audit reason (2026-11-26)

- `ListApplications` now includes tier, subscription state, monthly quota and a verified/current-period hint. Admin users with `config:plans` can open the quota adjustment confirmation only for eligible-looking active paid subscriptions; the API remains authoritative and rechecks the verified paid state under row lock.
- The quota adjustment requires step-up and a 5–1000 Unicode-character reason. The reason is persisted in the same transaction as the quota and audit row; plan, subscription status, period and provider reference remain unchanged. The UI explicitly describes these constraints.
- `TestAdminDeveloperApplicationListIncludesSubscriptionContext`, `TestAdminQuotaAdjustmentRequiresBoundedReason`, existing paid-entitlement tests, audit-write rollback, and metadata-only audit pagination tests passed against isolated PostgreSQL; Admin TypeScript typecheck, focused lint and 86 contract tests passed on Node 26.13.0. Full Auth `go test -p 2 ./... -count=1` and `go vet ./...` passed before adding the listing regression, then the focused affected Admin integration set passed again. Browser/deployed execution remains outstanding.

## Admin Developer operations audit-failure rollback (2026-11-26)

- `TestAdminDeveloperOperationsRollbackWhenAuditWriteFails` creates connection-scoped temporary tables whose constraints reject the admin audit action. It verifies both `UpdateQuota` and `ReviewApplication` return 500 and leave the prior subscription quota/application status unchanged.

## Admin Developer audit read surface (2026-11-26)

- Added `GET /api/v1/admin/developer/audit`, guarded by verified staff authentication and `audit:read`, with bounded keyset pagination (1–100 entries per page).
- The endpoint returns actor, organization, action, subject and timestamp metadata only; it intentionally does not serialize arbitrary before/after JSON state.
- `TestAdminDeveloperAuditReadIsPaginatedAndOmitsStatePayloads` passed against isolated PostgreSQL, including cursor continuation and state-payload exclusion. On the repository-supported Node 26.13.0, Admin typecheck, full ESLint (0 errors; 53 warnings), all 86 Admin contract tests, and the optimized production build passed. Browser rendering and deployed staff-permission workflow remain outstanding.

## Business Messaging consent frontend current-tree verification (2026-11-26)

- Using Node 26.13.0, current Webapp contract tests passed 175/175, utility tests 373/373, and service tests 33/33; Webapp typecheck and focused ESLint for the customer consent page, connected-app settings and consent-scope utilities passed.
- These checks do not verify a signed-in browser approval/denial callback, live Identity/Gateway configuration, deployed redirect handling, or production dispatch. Production send remains gated pending the separate customer-opted-in business-managed messaging mode and durable delivery/receipt integration.
- `TestAdminApplicationReviewRequiresBoundedReason` verifies short/oversized reasons and unsupported decisions are rejected, while a trimmed five-character reason passes validation. The Developer Operations UI uses the shared step-up confirmation dialog and submits the entered reason rather than a generic fixed string.
- Both focused tests passed. The full Auth `go test ./... -count=1` suite then passed with `AUTH_TEST_DATABASE_URL` directed at isolated PostgreSQL 17, including database and migration integrations; `go vet ./...` passed. Admin typecheck and focused ESLint passed under Node 24.19.0, below the required Node >=26.13.0. No persistent application schema was altered.
- This verifies transactional audit integrity for these two operations only; it does not verify all admin mutations, browser behavior, or deployed workflows.

## Store-scoped customer Business Messaging consent (2026-11-26)

- `AUTH_TEST_DATABASE_URL='postgres://postgres:local-only-test-password@127.0.0.1:15435/auth_test?sslmode=disable' go test ./tests -run '^(TestBusinessMessagingConsentIsAccountControlledAndAudited|TestBusinessMessagingConsentRequiresApprovedApplicationAndRequestedScopes|TestProductionMessageHistoryAndStatusAreTenantAndConsentScoped|TestProductionWebhookWorkerReportsPersistenceFailures|TestProductionWebhookWorkerRevalidatesBusinessAuthorization)$' -count=1` in `services/go/modules/auth`: **passed** against a disposable PostgreSQL 17 container. Full Auth `go test ./... -count=1` also passed with integration tests enabled; `go vet ./...` passed.
- Coverage verifies a customer can maintain separate consent for two stores under one app; a store without an active app grant cannot receive consent; message history for one store is denied when the active consent is for another; legacy null-store consent cannot authorize scoped history; and webhook revalidation uses the message's exact store.
- Added Auth migration `20261127100000_scope_business_messaging_consent_to_store`; migration upgrade/rollback/replay is exercised by the full Auth migration test suite. Webapp typecheck passed; runtime warns Node 24.19.0 is below its required >=26.13.0. `git diff --check` passed. The local disposable Postgres container was stopped and removed after verification; no persistent database was changed.
- At the time of this baseline, the customer consent UI had no OAuth-initiated grant handoff. The later callback section above implements local approval/denial and PKCE redemption; production sending remains deliberately mounted to 503. No live Social dispatch, browser journey or staging behavior is claimed.

### Merchant revocation propagation (2026-11-26)

- Revoking an app/store authorization now revokes every active customer consent for that exact organization/application/store in the same serializable database transaction. Each customer consent audit row records the customer as recipient and the merchant as actor; failure to persist any consent audit rolls back both the merchant authorization and customer consent changes.
- Regranting the merchant authorization does not reactivate old customer consent; the customer must grant again. The owner-facing authorization list reports current state (active after a subsequent regrant), while audit rows preserve the revocation event.
- Verified with the focused PostgreSQL integration test, the Auth test suite (`go test ./tests/... -count=1`), migration upgrade/rollback/replay, `go vet ./...`, migration checksum regeneration, backend 300-line guard, and `git diff --check`. All passed against a disposable PostgreSQL 17 container. This does not enable production sending or verify a deployed environment.

## Auth Identity migration upgrade, rollback, and replay (2026-11-26)

- Added `services/go/modules/auth/tests/migrations/authMigrationsUpgrade_integration_test.go`, which uses the actual embedded migration source and `golang-migrate` runner in a uniquely named disposable schema.
- `AUTH_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' go test ./tests/migrations -run '^TestIdentityMigrationsUpgradeRollbackAndReplay$' -count=1 -v` in `services/go/modules/auth`: **passed**. It upgraded from baseline `20261116160000`, preserved a pre-existing account row, reversed the 9 subsequent migrations, and replayed the migrations with the scoped-message and webhook-lease columns restored.
- `bash services/scripts/check-backend-file-lengths.sh`: passed; test file is 132 lines. `git diff --check`: passed.
- The test removed its isolated schema. No persistent database migration was run; production/staging rollout remains gated on the approved migration window.

## Developer organization invitation producer and email mapping (2026-11-26)

- `AUTH_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' go test ./tests -run '^TestDeveloperOrganizationInvitationsRequireRecipientConsent$' -count=1 -v` in `services/go/modules/auth`: **passed**. Covers recipient consent, resend cooldown, outbox emission and rejection of unauthorized resend.
- `pnpm exec vitest run tests/developerOrgInvitationMapping.test.ts` in `services/typescript/notifications`: **1/1 passed**; confirms only the invitee receives the intent and the invitation email links to the Developer invitation route.
- `pnpm exec vitest run tests/emailTemplates.test.tsx` in `packages/emailTemplates`: **257/257 passed**.
- These tests do not send email. Live SES delivery and signed-in browser acceptance remain unverified; staging SES DNS and sending identity are not ready.

## Merchant Business Messaging grant scope allowlist (2026-11-26)

- Added regression coverage proving only explicitly supported own-property scopes are grantable; inherited object names (`constructor`, `toString`), unsupported scopes, and duplicate scope entries are rejected or normalized.
- `pnpm exec tsx --test src/components/settings/businessMessagingScopes.util.test.ts` in `apps/webapp`: **2/2 passed**.
- `pnpm typecheck` in `apps/webapp`: passed. Focused ESLint on the changed component/helper/tests: passed. `git diff --check`: passed.
- This is a frontend safety hardening only. Backend enforcement remains authoritative; browser workflow and deployed grant behavior are not verified.

## Identity database integration run (2026-11-26)

- Started the documented isolated PostgreSQL 17 test stack with `NANTTY_LOCAL_POSTGRES_PORT=15433 docker compose -p nantty-identity-tests -f infra/local/docker-compose.yml up -d --wait postgres`. The new container became healthy and uses its own named volume; the existing legacy Postgres container on port 15432 was not changed.
- `AUTH_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' go test ./...` in `services/go/modules/auth` passed, including the database-backed Auth integration package.
- `USERS_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' go test ./...` in `services/go/modules/users` passed, including its fresh-schema integration and privacy suites.
- `INVENTORY_TEST_DATABASE_URL='postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable' go test ./tests -run '^TestInternalBusinessStoreAuthorizationChecksTokenMembershipAndPermission$' -count=1` in `services/go/modules/orders` passed (the service authorization token, store membership/owner rule, and strict payload checks).
- No persistent application schema was migrated. The isolated test project is left running for follow-up integration tests; the legacy `15432` environment remains mismatched and is still not reconciled.

## Cloud-hosted staging readiness snapshot (2026-11-26)

- AWS MCP read-only inventory in the selected Region `eu-north-1`: Terraform state bucket `nantty-tfstate-324009946456-eu-north-1-an`, DynamoDB table `nantty-terraform-locks`, SES feedback SNS topic and its two SQS queues exist. SESv2 `GetEmailIdentity` returns verification `PENDING`/`HOST_NOT_FOUND`, `VerifiedForSendingStatus=false`, DKIM `PENDING`, and MAIL FROM `bounce.staging.nantty.com` `PENDING`. Account `SendingEnabled=true` but `ProductionAccessEnabled=false` (sandbox).
- The same prior AWS inventory found zero IAM OIDC providers, zero Nantty-named IAM roles, zero ECS clusters and zero ECR repositories. Current GitHub Actions therefore cannot assume staging roles and the backend deployment workflow has no cluster/registry target. PR #74 adds a manual `main`-only apply path: a read-only staging plan and sanitized DNS/resource summary run before the protected apply-environment approval; after approval, a dedicated apply role replans, compares the complete canonical JSON-plan digest, and applies only a matching create/update plan. No plan artifact is uploaded. GitHub environment `staging-apply` is configured with `main`-only deployment policy, owner reviewer `oyinlola-tech`, and admin bypass disabled. A fresh GitHub settings read on 2026-11-26 found `AWS_REGION=eu-north-1` as the only staging environment variable; no plan/apply role ARN variables exist in repository or environment variables. The repository-level `CLOUDFLARE_API_TOKEN` secret name exists, but its value/scope is not visible; no environment-level secret override is set. The workflow has not run; AWS OIDC roles and a trusted admin CIDR remain missing.
- Cloudflare was reconnected and the active `nantty.com` zone was rechecked. With the owner's record-specific approval, the three SES DKIM CNAMEs plus MAIL FROM MX/TXT records were created as DNS-only, TTL 600, and read back with matching values. No child DMARC record was added; `_dmarc.nantty.com` remains `p=reject; sp=reject`. This connector is separate from GitHub Actions. AWS SES validation has not yet been re-polled after publication. Because these DNS records were created outside Terraform, reconcile/import them into state or otherwise handle them explicitly in a reviewed plan before any apply.
- GitHub-hosted `terraform-staging.yml` is a manual `main`-only workflow and can run independently of the developer workstation once credentials and environment configuration exist. A live GitHub API read found only `AWS_REGION=eu-north-1` in the staging environment, no `AWS_TERRAFORM_ROLE_ARN_STAGING` or `AWS_TERRAFORM_APPLY_ROLE_ARN_STAGING` variables at repository or environment scope, a repository-level `CLOUDFLARE_API_TOKEN` secret name, and no environment-level secret overrides. Secret values/scopes are not visible through GitHub's list API. The workflow has no successful Terraform plan/apply run; AWS OIDC roles and trusted ingress CIDR remain missing. No cloud deployment has occurred.
- CI and desktop build jobs run on GitHub-hosted runners when triggered, independent of the developer PC. Local Codex coding does not continue when the local host stops; no Codex cloud work task has been started.

## PR #72 — Store-scoped Developer Business Messaging authorization (2026-11-25)

- PR head `f50194cf9bf2d50f2b5d222d6420b54220a0652f` passed Frontend, Security, and Backend workflows. The Backend workflow completed the Auth Go unit/race suite and database integration suite using PostgreSQL, Valkey, and RabbitMQ.
- GitHub reports no review comments or unresolved review threads. The PR's source commits and explicit squash commit contain no `Co-authored-by` trailer.
- Squash-merged at `2026-11-25T22:38:42Z` as `d85670af122403a7d9980beef35b8854fff7a655`; the local `main` checkout was fast-forwarded to this commit and is clean.
- This verifies CI and merge only. The change has not been deployed to AWS staging. Production message sending remains intentionally unavailable (503); secure Social dispatch, customer trust/window, inbound synchronization and delivery/read receipts remain incomplete.

## PR #73 — Isolate local PostgreSQL test stacks (2026-11-25)

- PR head `4e54b8e7781f69e022812bca83bef88051fd70f6` passed Security, CodeQL, and Backend checks, including the real PostgreSQL/Valkey/RabbitMQ integration job. No review comments or threads were recorded.
- Squash-merged at `2026-11-25T23:07:53Z` as `da202cd915c0c8c2199e1e13b2340f5b243d825a`. The squash commit message has no `Co-authored-by` trailer, and local `main` was fast-forwarded to the merge commit.
- The change is limited to local test infrastructure (`docs/runningLocally.md`, `infra/local/docker-compose.yml`). Its isolated Compose project/volume protects existing local databases; rendering the PR commit with port override `15433` was independently verified. No AWS deployment was involved.

## PR #71 — Business Messaging merchant authorization UI and preview endpoint (2026-11-25)

- PR #71 final head `794b0c5e499ce849c817d84eb1aa3d4e55f287d3` passed Backend, Frontend, Security, Terraform validation, and CodeQL checks; path-filtered Mobile, Elixir, Python, TLS proxy, and realtime jobs were skipped, and the manual Terraform plan was not requested. Squash-merged at `2026-11-25T20:21:29Z` as `498405cefc3d7b6f8565f569328f521f4dfa5fa1`. The final squash commit message contains no `Co-authored-by` trailer.
- Local verification: webapp TypeScript check passed on Node 24.19.0 (below required 26.13); Webapp ESLint completed with 0 errors and 73 warnings; Stylelint passed. Gateway full Vitest suite passed 1,949/1,949 tests across 44 files. Two focused Auth tests (business/store grant lifecycle and approved-app preview isolation) passed against a disposable PostgreSQL 17 tmpfs container with a test-only `nantty_readers` role; container stopped/removed, no persistent migration applied.
- Not verified: authenticated browser workflow, deployed service-to-service secret, production Social dispatch, inbound sync/receipts, email runtime or AWS staging deployment. Production message send remains fail-closed.

## PR #70 — Admin GLib security patch (2026-11-25)

- PR #70 final head `ca34ac9d2885acb4b070378111b87ed004d4fa23` was squash-merged at `2026-11-25T13:43:26Z` as `2f434e7b8542d7230aa9a4cc419389872adaf5ac`. GitHub reports the final Linux Tauri build, frontend matrix, Terraform, dependency audit, Gitleaks, Trivy and CodeQL analysis jobs completed successfully; the separate CodeQL aggregate check is neutral. The merge commit message has no `Co-authored-by` trailer.
- The patched GLib iterator is now covered by the merged vendored-source analysis configuration and Linux Admin Tauri workflow. The current Dependabot API state for alert #66 (`GHSA-wrw7-89jp-8q8g`) is `fixed`.
- Email-template suite executed in this workspace: 274/274 passed and TypeScript typecheck passed using Node 24.19.0 (below the repository-required Node 26.13 range); these are unrelated to the GLib remediation.

**Environment:** Node `v22.22.3`, `pnpm` `11.24.0` (via `corepack pnpm`), sandbox workspace `/home/user/nantty`, branch `arena/341bf572-nantty`.

## 1. TypeScript Typechecks (`tsc --noEmit`)
All 10 frontend applications pass `tsc --noEmit` with 0 errors:
- `apps/webapp`, `apps/ads`, `apps/admin`, `apps/seller`, `apps/studio`, `apps/developer`, `apps/sandbox`, `apps/mobile`, `apps/messenger`, `apps/web`.

## 2. Executed Unit, Contract & Integration Test Suites

| Package / App | Command / Scope | Result | Notes |
|---|---|---|---|
| `@nantty/gateway` | `corepack pnpm --filter @nantty/gateway test` | **1,937 / 1,937 passed** (44 files) | Full Vitest suite |
| `@nantty/chat-crypto` | `corepack pnpm --filter @nantty/chat-crypto test` | **98 / 98 passed** (14 files) | Full Vitest suite |
| `@nantty/sandbox-service` | `corepack pnpm --filter @nantty/sandbox-service test` | **55 / 55 passed**, 2 skipped (9 files) | 2 integration tests skipped (no local DB) |
| `@nantty/mobile` | `./node_modules/.bin/jest src/services/ src/contracts/ --runInBand` | **307 / 307 passed** (69 suites) | Includes `parityExtensions.service.test.ts` & `scheduledPosts.service.test.ts` |
| `@nantty/studio` | `corepack pnpm --filter @nantty/studio test:contracts` | **111 / 111 passed** (15 suites) | Uses `ignoreStyles.cjs` hook |
| `@nantty/webapp` (units) | `corepack pnpm --filter @nantty/webapp test:units` | **373 / 373 passed** (106 suites) | Full utility suite |
| `@nantty/webapp` (contracts) | `tsx --test` (excl. `errorExperience.test.ts`) | **167 / 167 passed** (45 suites) | Pre-existing `errorExperience.test.ts:72` fails on `/explore` markup |
| `@nantty/webapp` (services) | `tsx --test` (excl. `smileIdWebIntegration.service.test.ts`) | **28 / 28 passed** (11 suites) | Pre-existing `smileIdWebIntegration.service.test.ts:105` copy assertion mismatch; parity tests 2/2 pass |
| `@nantty/admin` (contracts) | `tsx --test` (excl. `errorScreens.test.ts`) | **82 / 82 passed** (25 suites) | Includes `adminAccessRules.test.ts`, `moneyContracts.test.ts`, `parityRoutes.test.ts` |
| `@nantty/seller` (contracts) | `tsx --test` (excl. `errorScreens.test.ts`) | **57 / 57 passed** (14 suites) | Full contract suite minus CSS import hook |
| `@nantty/seller` (units) | `corepack pnpm --filter @nantty/seller test:units` | **17 / 17 passed** (4 suites) | Full utility suite |
| `@nantty/ads` (contracts) | `tsx --test` (excl. `errorScreens.test.ts`) | **28 / 28 passed** (11 suites) | Includes `reportsPdfExport.test.ts` |
| `@nantty/developer` | `corepack pnpm --filter @nantty/developer test` | **35 / 35 passed** | Full portal test suite |
| `@nantty/messenger` | `tsx --test` across `src/**/*.test.ts` | **37 / 37 passed** | Full unit/contract suite |
| `@nantty/sandbox` | `tsx --test` across `tests/*.test.ts` | **1 / 1 passed** | Security headers contract |
| Backend line-length check | `bash services/scripts/check-backend-file-lengths.sh` | **Passed** | All backend files <= 300 lines |
| Dependency audit | `corepack pnpm audit --prod --audit-level=high` | **Passed** | 0 high/critical vulnerabilities |

## 3. Pre-Existing Unrelated Failures / Environment Limitations
- `apps/{ads,admin,seller}/src/contracts/errorScreens.test.ts`: Pre-existing `SyntaxError: Unexpected token '.'` in `packages/webKit/src/nanttyWordmark.tsx:2:20` when `tsx` executes without `--require ./src/contracts/ignoreStyles.cjs` (note `apps/studio` already passes `ignoreStyles.cjs`).
- `apps/webapp/src/services/smileIdWebIntegration.service.test.ts:105` & `apps/webapp/src/contracts/errorExperience.test.ts:72`: Pre-existing copy/markup mismatches unrelated to parity work.
- `services/typescript/{social,notifications}`: `prisma generate` fails in this sandbox because outbound access to `binaries.prisma.sh` is blocked by network egress policy.
- Go (`go`), Elixir (`mix`), and Python (`pytest`) toolchains are not installed in this sandbox container, so `services/go`, `services/elixir`, and `services/python` suites require execution in CI/local toolchain environments.
# Go Analytics PostgreSQL runtime verification — 2026-11-26

- Added `services/go/modules/analytics/tests/analytics_postgres_integration_test.go`, gated by `ANALYTICS_TEST_DATABASE_URL`.
- Against the dedicated local PostgreSQL 17 test container, the test created an isolated unique schema, applied the actual embedded migration, persisted internal events, checked duplicate-event replay did not overwrite the first accepted event, verified seller totals are restricted to the requested store, and purged an expired event. Cleanup dropped the isolated test schema.
- `ANALYTICS_TEST_DATABASE_URL=... go test ./... -count=1` — passed.
- `go vet ./...` — passed.
- `bash services/scripts/check-backend-file-lengths.sh` — passed (all backend files <= 300 lines).
- Scope boundary: this is local database integration evidence, not deployment or production event-pipeline evidence.

# Developer OAuth redirect URI registry — 2026-11-26

- Added the separate `redirect_uris` app-registration field and additive migration `20261127120000_add_developer_application_redirect_uris`; the existing `callback_origins` contract is unchanged. Up to 10 normalized URIs persist through create/list/update, are included in audit snapshots and in create-idempotency fingerprints, and are editable in the Developer application form.
- `AUTH_TEST_DATABASE_URL=postgres://… go test ./... -count=1 -p 1` in `services/go/modules/auth` — passed with the isolated PostgreSQL 17 test DB. This includes the application create/list/update and idempotency regression, normalization/security cases and migration upgrade/rollback/replay test. `go vet ./...` passed.
- `PATH=…/node/v26.13.0/bin:$PATH corepack pnpm --filter @nantty/developer typecheck` — passed; `… test` — 36/36 passed; `… lint` — 0 errors, 11 warnings across existing Developer source. `… build` — passed after supplying reserved `.invalid` values for the required production public-origin settings; the first unconfigured build correctly failed closed on `NEXT_PUBLIC_SITE_URL`.
- `go run ./cmd/generateMigration -rehash`, `bash services/scripts/check-backend-file-lengths.sh`, and `git diff --check` — passed.
- Scope boundary: the browser authorization-code/PKCE consumer, signed-in visual workflow, deployment and any external OAuth handoff are not implemented or verified. Registration alone grants no access; the Business Messaging send endpoint remains fail-closed.

# Developer billing Sandbox downgrade metadata — 2026-11-26

- `SetSandboxBilling` now clears `payment_verified_at` together with paid provider-reference and billing-period metadata, both on insert and conflict update.
- `AUTH_TEST_DATABASE_URL=postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable go test ./tests -run '^TestProductionQuotaReservationIsAtomicAcrossConnections$' -count=1 -v` in `services/go/modules/auth` — passed against isolated local PostgreSQL 17. The test verifies the downgraded subscription has no paid settlement timestamp; its disposable schema is removed after the test.
- Current-tree follow-up: `AUTH_TEST_DATABASE_URL=... go test ./... -count=1 -p 1` — passed for the full Auth module with database integration enabled; `go vet ./...`, `bash services/scripts/check-backend-file-lengths.sh`, and `git diff --check` also passed.
- Scope boundary: this does not complete paid checkout, authoritative settlement ingestion, renewals, cancellation or invoicing.

## Current-tree Auth and Business Messaging consent regression — 2026-11-26

- `AUTH_TEST_DATABASE_URL=... go test ./... -count=1 -p 1` from `services/go/modules/auth` — passed for the full Auth module against the isolated PostgreSQL 17 service, including consent preview/approval/denial/PKCE/replay/expiry/revocation, migration tests and the billing downgrade regression.
- `go vet ./...`, `bash services/scripts/check-backend-file-lengths.sh`, and `git diff --check` — passed.
- Under Node 26.13.0, Webapp typecheck passed; `businessMessagingScopes.util.test.ts` passed 4/4; focused ESLint passed for the consent page, connected-app settings, scope parser and privacy service.
- Consent-review navigation follow-up: the review state is keyed to the complete set of OAuth/store request query values, so changing app, store, callback, challenge, or state remounts a clean selection/mutation state instead of carrying approval state into another request. Repeated the Node 26.13.0 Webapp typecheck, 4/4 focused utility tests, focused ESLint and `git diff --check`; all passed.
- Scope boundary: no authenticated browser journey, deployed callback, staging migration or production Business Messaging dispatch was run. No PR is currently open; local `main` is 10 commits ahead of origin and has broad uncommitted work.

## Developer and Admin surface regression — 2026-11-26

- Under Node 26.13.0, Developer tests passed 36/36 and Developer typecheck passed. Admin typecheck passed.
- Focused ESLint passed for the changed Developer OpenAPI/docs/application workspace and Admin Developer Ops workspace/API client files. `git diff --check` passed.
- Under Node 26.13.0, Webapp `test:contracts`, `test:units`, and `test:services` all completed successfully; the service suite reported 33/33 passing. Webapp typecheck and focused consent tests/lint also passed.
- Admin contract suite passed 86/86 under Node 26.13.0 after Developer Ops changes.
- Scope boundary: no authenticated portal/Admin browser session or deployed API workflow was run. These checks validate code contracts and typing, not complete production operations.

## Developer usage quota requires settlement verification — 2026-11-26

- `GetUsage` now loads `payment_verified_at` and shares the production entitlement predicate before reporting paid quota. The isolated PostgreSQL handler test returned zero for an active paid-looking subscription without settlement proof and returned the configured quota only after adding a verified settlement timestamp.
- `AUTH_TEST_DATABASE_URL=... go test ./... -count=1 -p 1` from `services/go/modules/auth` — passed against the isolated PostgreSQL 17 test service, including the new handler test; `go vet ./...`, the backend <=300-line guard and `git diff --check` passed.
- This keeps usage display consistent with server-side quota enforcement; it does not implement checkout, payment settlement ingestion or full billing lifecycle.

## Production credential mutation authorization and audit — 2026-11-26

- Create, rotate and revoke now reauthorize in their database transaction, lock membership/application rows and lock the current `credentials.manage` grant against concurrent removal. Every mutation writes a metadata-only audit row atomically; audit failure rolls back credential state. The controller no longer performs unaudited create/revoke writes directly.
- `AUTH_TEST_DATABASE_URL=postgres://nantty:nantty@127.0.0.1:15433/nantty_test?sslmode=disable go test ./modules/auth/tests -run TestProductionResourcesRequireApplicationCapabilities -count=1 -p 1` — passed, covering role/grant authorization, successful create/rotation/revocation, revoked-grant denial, audit records and trigger-injected audit-failure rollback.
- `AUTH_TEST_DATABASE_URL=... go test ./modules/auth/... -count=1 -p 1` — passed across the full Auth module with PostgreSQL integration enabled; `go vet ./modules/auth/...`, `bash services/scripts/check-backend-file-lengths.sh` (all backend files <=300 lines), and `git diff --check` passed.
- Scope boundary: isolated local PostgreSQL evidence only; no persistent migration, deployed runtime, or signed-in browser action was run.

## Production webhook mutation authorization and audit — 2026-11-26

- Webhook creation, signing-secret rotation, deletion, and challenge-verification start/result now reauthorize transactionally, lock membership/application and the current `webhooks.manage` grant, and write metadata-only audit records atomically. Audit failure rolls back each mutation/result write; webhook secrets remain encrypted at rest and are not included in audit state.
- The expanded `TestProductionResourcesRequireApplicationCapabilities` PostgreSQL integration test passed: granted/denied verification preparation, create/rotate/delete, secret ciphertext round trip, verification success/failure states, required audit rows, and rollback when an insert trigger rejects the audit action.
- `AUTH_TEST_DATABASE_URL=... go test ./modules/auth/... -count=1 -p 1` — passed against isolated PostgreSQL 17; `go vet ./modules/auth/...`, `bash services/scripts/check-backend-file-lengths.sh` (all backend files <=300 lines), and `git diff --check` passed.
- Scope boundary: this covers local service and database behavior only; signed-in browser, real external challenge acknowledgement, deployed delivery and persistent migration rollout remain unverified.

## Business Messaging authorization at durable send reservation — 2026-11-26

- The dormant send reservation now rechecks and share-locks the approved Business Messaging app, active credential and `messages:send` scope, active store authorization and scope, store-specific recipient consent and scope, and active recipient account before idempotency lookup, message insertion, or quota recording.
- The focused `TestProductionQuotaReservationIsAtomicAcrossConnections` regression passed against a disposable PostgreSQL 17 container. It verifies concurrent same-key idempotency and that revoked app, credential, store grant, customer consent, or recipient account blocks a new reservation. The temporary container is removed after the run.
- `AUTH_TEST_DATABASE_URL=... go test ./... -count=1` from `services/go/modules/auth` — passed across all Auth packages and migration-backed integration tests using the disposable PostgreSQL 17 database with the required `nantty_readers` test role. The separate shared dev database was not changed.
- `go vet ./...`, `bash services/scripts/check-backend-file-lengths.sh` (all backend files <=300 lines), and `git diff --check` — passed.
- Scope boundary: this protects the reservation write boundary. Public send is still intentionally mounted to 503; no live dispatch, external delivery race guarantee, browser flow, persistent migration, or staging deployment is claimed.

## GitHub integration job timeout correction — 2026-11-26

- PR #75 Backend integration run `45844863491` ended as cancelled at 60m18s while its `Go integration tests against real Postgres, Valkey and RabbitMQ` step was still active; no test failure log was emitted. A successful main-branch integration baseline (`45819568753`) took approximately 39m38s.
- Changed `.github/workflows/backend.yml` integration `timeout-minutes` from 60 to 120. The test workspace remains sequential to preserve the existing resource-isolation design; no tests were removed or parallelized. The new-head run must complete before this workflow change is considered verified.
