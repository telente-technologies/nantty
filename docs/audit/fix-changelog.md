# Fix Changelog — audit remediation tracker

Every code change made while fixing `docs/audit/frontend-backend-audit.md` is logged here with file, lines, audit ID, verification, and rollback notes. Investigations that concluded "no change needed" are logged too. Newest first.

## 2026-10-22 — ZM-003/ZM-010/ZM-018/ZM-020: checkout confirmation, upload binding, admin step-up, route limits

**Audit:** ZM-003 (direct-payment protection), ZM-010 (media fail-closed), ZM-018 (admin step-up), ZM-020 (gateway/API hardening)
**Changes:**
1. `apps/mobile/src/components/cart/paymentModeChooser.tsx` and `apps/webapp/src/components/commerce/paymentModeChooser.tsx` + CSS — choosing `direct` now requires typing `DIRECT` before the payment mode changes. The escrow warning remains visible while confirming, so the choice stays explicit and the default remains `escrow`.
2. `services/typescript/media/src/integrations/s3ObjectStorage.integration.ts` — presigned PUTs now sign and return `Content-Type` in addition to `Content-Length`; the fake storage and upload-session tests were updated.
3. `services/typescript/media/src/configs/media.config.ts` — production rejects an empty, placeholder or under-32-character `MEDIA_INTERNAL_TOKEN`; new config tests cover rejection and acceptance.
4. `services/typescript/gateway/src/routes/upstream.routes.ts` — exact auth overrides make `POST /api/v1/posts/:postId/media/:mediaId/download` and `POST /api/v1/posts/:postId/link-preview` require authentication instead of inheriting the optional posts rule.
5. `services/typescript/gateway/src/services/routeRateLimitPolicy.service.ts` — added account-scoped limits for mentions resolve, comment writes, post engagement/saves, direct messages, conversation/channel writes, chat key operations, support writes, admin email sends and unsubscribe. Classification tests cover the new families.
6. `services/typescript/social/.../listDevices.handler.ts` + conversation repository — `POST /api/v1/chat/keys/devices/query` now returns devices only for the requester and accounts that already share a conversation, preventing arbitrary device-directory enumeration. Mobile story replies create/resume the direct conversation before encrypting, so the scoped directory still works for a first-time recipient.
7. `services/go/platform/staffauth/staffGuard.middleware.go` — added `RequireSuperadmin`; staff settings and superadmin approval routes now use it instead of `RequireStaff("", true)`.
8. `services/go/modules/users/...` — step-up now guards admin warn, force-logout, restrict, reinstate, verification approve/reject/reinstate, business-document approve/reject and creator-application approve/reject. Go integration tests and the admin RBAC test were updated.
9. `apps/admin/src/config/apiRoutes.config.ts` — the corresponding BFF routes are marked `sensitive`.
**Verified:** gateway 35 files / 1704 tests pass; media 24 files / 129 pass, 1 skipped; social suite passes; `go test ./modules/users ./modules/admin ./platform/staffauth` passes; webapp, admin and mobile `tsc --noEmit` clean; gateway/media/social/admin/webapp/mobile lint 0 errors (warnings pre-existing).
**Rollback:** revert the two chooser components, the presign/config checks, gateway overrides/limit names, device-directory scoping, and the Go guard changes together. Reverting only the gateway overrides reopens anonymous download/link-preview calls; reverting only the presence checks reopens admin actions without re-auth.
**Remaining:** server-side direct-payment acceptance flag, per-store promo `issues[]`, audio/PDF moderation, expiring single-use unsubscribe tokens, in-product appeal links, staff-JWKS staging assertion, link-preview owner check, optional anon share/impression writes, and the rest of ZM-018/ZM-020.

## 2026-10-21 — ZM-021: wire order-group lifecycle events into notifications

**Audit:** ZM-021 (order lifecycle events absent from the notifications path)
**Changes:**
1. `services/go/modules/orders/src/services/checkoutPersist.service.go` — `orderGroup.created` now includes `orderNumber` and `sellerAccountId`.
2. `services/go/modules/orders/src/services/orderTransition.service.go` — `orderGroup.shipped` / `.delivered` now include `orderNumber`, `storeId`, `buyerAccountId` and `sellerAccountId` alongside courier/tracking.
3. `services/typescript/notifications/src/modules/eventIngestion/mappings/orders.mapping.ts` — added mappings for `orderGroup.created`, `.paid`, `.statusChanged`, `.shipped`, `.delivered` and `.completed`. Buyer receives placed/paid/preparing/ready/shipped/delivered/completed/cancelled; seller receives paid/cancelled. `statusChanged` ignores shipped/delivered/completed so they are not duplicated. The legacy `order.cancelled` mapping now returns no intents for the checkout-shell payload (no buyer/groups), avoiding a warning on every abandoned checkout.
4. `services/typescript/notifications/src/modules/eventIngestion/mappings/eventMappingRegistry.ts` — registered the six mappings.
5. `infra/local/rabbitmq/topology.json` + regenerated `definitions.json` — bound the six routing keys to `notifications-domain-events`.
6. `services/contracts/events/schemas/orderGroup.{created,paid,shipped,delivered}.v1.json` updated to match emitted payloads; added `orderGroup.completed.v1.json`; AsyncAPI message list updated.
7. `services/typescript/notifications/tests/orderGroupMapping.test.ts` + `tests/fixtures/eventFixtures.fixture.ts` — new coverage for buyer/seller fan-out, cancellation, tracking links and status-change duplicate suppression.
**Verified:** `pnpm --filter @zudomart/notifications test` → 33 files, 309 passed; `typecheck` clean. `go test ./modules/orders/...` → pass; `gofmt` clean. `node infra/local/rabbitmq/generateDefinitions.mjs` → 421 bindings.
**Rollback:** remove the six mappings and queue bindings, and revert the producer fields. In-app/push order updates stop until a replacement consumer exists.
**Remaining:** email templates are still not sent for order-group events (payloads lack line items/payment URL/recipient names). Production topology must be deployed with the same routing keys.

## 2026-10-21 — ZM-010: media moderation and malware scanning fail closed

**Audit:** ZM-010 (fail-open media scans)
**Changes:**
1. `services/typescript/media/src/configs/media.config.ts` — `MODERATION_FAIL_MODE` now defaults to `hold`; values other than `allow`/`hold` fail config validation; added `allowUnscannedUploads` from `MEDIA_ALLOW_UNSCANNED` (default `false`).
2. `services/typescript/media/src/modules/assets/services/moderationPolicy.service.ts` — an absent classifier or empty frame set now follows `failMode` instead of always returning `allow`.
3. `services/typescript/media/src/modules/assets/services/mediaPipeline.service.ts` — a `skipped` malware scan rejects the asset with `MALWARE_SCAN_UNAVAILABLE` and records `scanResult=skipped` unless unscanned uploads are explicitly allowed.
4. `services/typescript/media/src/app.ts` — warns at startup when unscanned uploads are enabled.
5. `services/typescript/media/.env.example` — documents the local-only `MEDIA_ALLOW_UNSCANNED=true` override.
6. `services/typescript/media/tests/pipeline/mediaPipeline.test.ts` and `tests/integrations/scanAndModeration.test.ts` — default harness now provides a healthy classifier; added absent-classifier hold, skipped-scan rejection and explicit allowance tests; the old fail-open assertion now opts into `failMode=allow` explicitly.
**Verified:** `pnpm --filter @zudomart/media test` → 21 files, 126 passed; `typecheck` clean.
**Rollback:** restore the previous `allow` default and remove the skipped-scan guard. Do not roll back without an equivalent fail-closed control.
**Remaining:** audio/PDF moderation, presigned `Content-Type` binding, internal-token defaults, fan-out caps, expiring unsubscribe tokens and in-product appeal links remain in ZM-010.

## 2026-10-21 — ZM-003: explicit direct-payment risk warning

**Audit:** ZM-003 (`direct` mode silently waives buyer protection)
**Changes:**
1. `apps/mobile/src/components/cart/paymentModeChooser.tsx` — selecting `direct` now shows caution-coloured copy: the buyer loses escrow protection, refunds/disputes depend on the seller, and Zudomart cannot hold or reverse the payment.
2. `apps/webapp/src/components/commerce/paymentModeChooser.tsx` + `paymentModeChooser.module.css` — the same warning renders in a `role="note"` callout when `direct` is chosen.
**Verified:** webapp `tsc --noEmit` clean. Mobile has no typecheck script; lint/tests are the available gates.
**Rollback:** remove the two warning blocks and CSS class. The default remains `escrow`; this is copy only, no payment behaviour changed.
**Remaining:** type-to-confirm/checkbox on `direct`, and per-store promo issues instead of failing the whole checkout.


## 2026-10-20 — Repo hygiene: stop tracking generated Prisma clients

**Context:** Social, search, and media tracked their generated Prisma clients even though `.gitignore` already listed `services/typescript/*/src/generated/`. Git ignore rules only affect untracked files, and these clients predated the rule (`f43978b71` for social, `187e619e6` for search). The checked-in copies were never used by CI or Docker: every `build`/`typecheck`/`test` script runs `prisma generate`, and the Dockerfiles regenerate before compiling.
**Changes:**
1. Committed the `services/typescript/*/src/generated/` ignore rule at the repository root.
2. Removed 94 tracked generated files from the index with `git rm -r --cached`:
   - social: 65 files (`prisma` + `identity` clients)
   - search: 15 files
   - media: 14 files
3. Kept the build scripts and `scripts/stripGeneratedPrismaImports.mjs` unchanged; locally generated output is still cleaned before type checking.
**Verified:**
- Deleted the three generated directories, then ran `pnpm --filter @zudomart/social typecheck`, `pnpm --filter @zudomart/search typecheck`, and `pnpm --filter @zudomart/media typecheck`; all regenerate the clients and pass.
- `git ls-files 'services/typescript/*/src/generated/**'` → 0.
- `git status` shows only the ignore rule and the staged deletions; regenerated working-tree clients are ignored.
**Rollback:** restore the paths from the previous commit if generated code must be vendored again; not recommended.

## 2026-10-20 — CodeQL cleanup round 3: no-effect protocol stubs and bare awaits

**Audit:** CodeQL "Statement has no effect" (37 findings)
**Changes:**
1. **Protocol and ABC stubs** — 16 files under `services/python/intelligence/src`.
   - Replaced ellipsis (`...`) bodies with `pass` in `Protocol` methods, `@abstractmethod` methods, and the property stub. CodeQL flags a bare `...` expression as effect-free; `pass` is the explicit no-op form and keeps the stubs type-checkable.
   - Files: `interfaces/{audio_fingerprint_source,cqrs,feature_backend,intelligence_module}_interface.py`; `modules/{bot_detection,content_scoring,domain_events,live_safety,trust_advisory}/repositories/*queue_repository.py` and `*publisher*_repository.py`; `modules/{child_safety,content_scoring,live_safety,moderation}/services/*_interface_service.py` and `*_model_service.py`; `modules/live_safety/services/{csam_hash_match_interface,rekognition_image_moderation_model,transcribe_batch_transcription}_service.py`.
2. **Two bare `await` expressions** — `src/loaders/lifespan_loader.py`, `tests/test_audit_verification_2026_10_10_http.py`.
   - CodeQL treats a bare `await` expression as effect-free. Wrapping the awaited task/coroutine in `asyncio.gather(...)` and assigning the result to `_` preserves cancellation and exception propagation while making the statement an assignment with an observable result. The assignment is required: a bare `await asyncio.gather(...)` would still be an expression statement.
**Verified:**
- `uv run ruff format --check .` → 591 files formatted; `uv run ruff check .` → clean.
- `uv run mypy src` → 506 files clean; `uv run pytest -q` → pass.
- No `...` function bodies remain under `src` or `tests`.
**Rollback:** replace `pass` with `...` and the two `asyncio.gather(...)` wrappers with bare awaits. No runtime behavior changes.

## 2026-10-20 — CI fixes: Ruff formatter and TypeScript raw-SQL gate

**Audit:** Backend conventions and Python jobs on `68106d533`
**Changes:**
1. **Ruff formatter** — `services/python/intelligence/src/modules/child_safety/services/media_child_safety_scan_service.py`.
   - `ruff format --check .` collapsed the wrapped `is_suspected_child_safety(...)` call back to its 120-character form. The file now passes both `ruff check` and `ruff format --check`.
2. **TypeScript raw-SQL gate** — `services/typescript/social/tests/explore/whoToFollow.test.ts`.
   - The test double declared unused `$queryRaw` and `$queryRawUnsafe` stubs. `check-no-raw-sql-in-typescript.sh` flags those names even in tests, and the test never exercises raw SQL, so the stubs were removed. `suggestAccountsToFollow` does not reference them.
**Verified:**
- `uv run ruff format --check .` → 591 files formatted; `uv run ruff check .` → clean; `uv run mypy src` → 506 files clean; `uv run pytest -q` → pass.
- `bash services/scripts/check-no-raw-sql-in-typescript.sh` → clean.
- `pnpm exec vitest run tests/explore/whoToFollow.test.ts` → 2 passed.
**Rollback:** re-add the two mock methods and revert the formatter-only hunk; no runtime behavior changes.

## 2026-10-20 — CI fixes: Python conventions, ruff, and mypy

**Audit:** Backend conventions gate after the first CI repair push
**Changes:**
1. **Split the oversized child-safety hash test** — `tests/modules/child_safety/test_child_safety_hash_matching.py` (285 lines) and new `test_child_safety_hash_matching_api.py` (65 lines).
   - The original file was 331 lines and failed `check-backend-file-lengths.sh` (300-line cap). The unit tests stay in the original file; the signed HTTP endpoint fixture and contract test moved to the new file.
2. **Ruff long lines and import order** — `src/container.py`, `src/modules/child_safety/services/{child_safety_signal_service,hash_match_provider_interface_service,media_child_safety_scan_service}.py`, `src/modules/live_safety/live_safety_module.py`, and the split test files.
   - Wrapped the 120+ character expressions and applied `ruff check --fix --select I001`; `uv run ruff check .` is clean.
3. **Mypy protocol stubs** — `tests/modules/live_safety/test_live_safety_label_mapping.py`, `tests/test_audit_verification_2026_10_10_http.py`.
   - `RekognitionModerationClient` now requires `detect_faces`; the two label-only test doubles implement it with an empty `FaceDetails` response. `uv run mypy` is clean across 589 files.
**Verified:**
- `bash services/scripts/check-backend-file-lengths.sh` → all backend files at most 300 lines.
- `uv run ruff check .` → clean; `uv run mypy` → success; `uv run pytest -q` → pass.
- `gofmt -l $(go list -m -f '{{.Dir}}')` → empty; prior Go fixes remain in `5d7de4561`.
- Security, CodeQL Code Quality, and Deploy succeeded on `5d7de4561`; the Backend run only failed the conventions gate, which this change addresses.
**Rollback:** recombine the split test and revert the ruff/mypy-only edits; no runtime behavior changes.

## 2026-10-20 — CI fixes: Bandit advisory, gofmt, moderation migration, duplicate-bank advisory

**Audit:** GitHub Actions failures after the Batch 2 and CodeQL pushes
**Changes:**
1. **Elixir dependency audit** — `services/elixir/realtime/mix.lock`.
   - `bandit` 1.12.5 was flagged by `mix hex.audit` for CVE-2026-105659 (HIGH, HTTP/2 blocked-send deadline reset) and CVE-2026-105660 (MEDIUM, unvalidated HTTP/1 request-target authority). Bumped to `1.13.1`, which requires `thousand_island ~> 1.6`; bumped `thousand_island` to `1.6.0`. `mix hex.audit` now reports no advisories.
2. **Go format check** — `deployables/goCommerce/directOrderAutoCompletion_integration_test.go`, `modules/ads/ads.integration_test.go`, `modules/ads/src/modules/campaigns/commands/updateCampaign/updateCampaign.handler.go`, `modules/creators/affiliateClicksAndOrdering_integration_test.go`, `modules/escrow/escrow.undeliveredAutoRelease_integration_test.go`.
   - `gofmt` was applied; `gofmt -l $(go list -m -f '{{.Dir}}')` is now empty.
3. **Missing moderation migration** — new `modules/moderation/src/migrations/20261020083740_add_account_monetisation_state.{up,down}.sql` and `atlas.sum`.
   - `AccountMonetisationState` was added to the ent schema in `99882ebf5` without a migration, so every moderation integration test that touched a report action failed with `relation "account_monetisation_states" does not exist`. The generated migration creates the table; `go test ./modules/moderation` passes.
4. **Duplicate-bank advisory was rolled back** — `modules/payments/src/modules/gateway/services/payoutOnboarding.service.go`.
   - `SavePayoutOnboardingBank` returned `ErrBankAccountAlreadyLinked` from inside the money transaction after the duplicate advisory had been enqueued, so the rollback discarded the advisory. It now records the duplicate result, returns `nil` from the transaction (committing the advisory), and returns the 409 outside the transaction. `go test ./modules/payments` passes.
5. **PCTR test matches the privacy gate** — `modules/ads/src/integrations/pctr.integration_test.go`.
   - The payload only sends the real viewer id and age bracket when `PersonalizedAds` is true; the test now sets it so it still asserts the personalized payload. `go test ./modules/ads/src/integrations` passes.
**Verified:**
- `mix hex.audit` → no retired or security advisory packages.
- `mix format --check-formatted`, `mix compile --warnings-as-errors`, `MIX_ENV=test mix test` → 98 passed.
- `gofmt -l $(go list -m -f '{{.Dir}}')` → empty.
- `go test ./modules/moderation` → pass; `go test ./modules/payments` → pass; `go test ./modules/ads/src/integrations` → pass.
**Rollback:** revert the lockfile, migration, and the two behavioral hunks independently. The migration is additive; the payments change only moves the conflict return outside the advisory transaction.
**Note:** local network blocked `repo.hex.pm`; the lockfile update was fetched through an alternate Fastly address. CI uses the normal Hex registry.

## 2026-10-20 — CodeQL cleanup round 2: unused values, match returns, generated imports

**Audit:** CodeQL findings (Go unused assignments, Python mixed returns, mobile/web unused imports, generated Prisma imports)
**Changes:**
1. **Go: stop assigning values that are never read** —
   - `moderation/.../automationStore.repository.go`: `suppressed` is declared once and set from a scoped `matched, err := cooldown.Exist(ctx)` instead of a predeclared `err`.
   - `live/.../respondToInvitation.service.go`, `live/.../inviteGuest.service.go`: discard the unused slot result (`_, err = ...`); the slot is only needed as input to the event.
   - `auth/.../refreshSessionTokens.handler.go`: `nextTokenId` is declared as `uuid.UUID` without an unused `presented.ID` default; it is always assigned by `CreateRefreshTokenInTransaction` before use.
2. **Python: one explicit return per match function** — `event_feature_update_service.py`, `domain_event_translation_service.py`, `trending_contribution_service.py`, `behaviour_feature_service.py`.
   - `calculate_affinity_signal_weight`, `find_affinity_targets`, `build_item_statistics_increments`, `resolve_intelligence_event_type`, `list_trending_contributions_for_event`, and `build_behaviour_operations` now assign to a typed local in every `case` (including `case _`) and return it once. This removes the implicit-return paths CodeQL reported without adding unreachable code (mypy runs with `warn_unreachable`).
3. **Unused imports/variables removed** — mobile (`storeDetail`, `feedTab`, `martTab`, `commentThread`, `deleteAccountSheet`, `accountStatus`, `userProfileByUsername`, `story.screen`, `sellerApplication`, `createBusinessProfile`, `sponsoredStoryPage`), admin (`ipClaimsQueueWorkspace`), notifications test, api-smoke tests, browser-e2e guest spec.
   - The `useTheme()` calls that only destructured an unused `colors` were removed; components that still use `colors` keep the hook.
4. **Generated Prisma imports are stripped after generation** — `scripts/stripGeneratedPrismaImports.mjs`, `services/typescript/social/package.json`, `services/typescript/search/package.json`, and the generated `client.ts`/`commonInputTypes.ts` files.
   - The new script removes `import * as process from 'node:process'` and `import * as $Enums from "./enums.js"` only when the file's code does not reference them (comments and `export * as $Enums` re-exports do not count).
   - `social` and `search` now run it after `prisma generate` in `build`, `typecheck`, `test`, and `db:generate`, so regeneration cannot silently reintroduce the two CodeQL alerts. `$Enums` remains re-exported from `client.ts`.
**Verified:**
- `go build ./modules/moderation/... ./modules/live/... ./modules/auth/...` → clean; changed files `gofmt`-clean.
- Intelligence: `ruff check` clean on all four files; `mypy` strict clean; `pytest tests/modules/events_ingestion tests/modules/domain_events tests/modules/trending` → 51 passed.
- `pnpm --filter @zudomart/mobile --filter @zudomart/admin --filter @zudomart/notifications --filter @zudomart/api-smoke --filter @zudomart/browser-e2e --filter @zudomart/social --filter @zudomart/search exec tsc --noEmit` → clean.
- Lint across the same packages → 0 errors (notifications 2 warnings, admin 52, mobile 371 pre-existing warnings).
- Notifications Vitest → 32 files passed, 1 skipped; 298 tests passed, 4 skipped.
**Rollback:** revert the hunks independently; no schema, migration, or runtime-contract changes.

## 2026-10-20 — CodeQL cleanup: stream error propagation, ASI braces, dead initialisers

**Audit:** CodeQL findings (gateway realtime proxy, payout panels, branded download hook, API smoke client, money formatters)
**Changes:**
1. **Realtime socket proxy uses `pipeline`** — `services/typescript/gateway/src/services/realtimeSocketProxy.service.ts`.
   - Both directions now use `node:stream`'s `pipeline` instead of bare `pipe`, so a source error is forwarded to the destination and logged; the shared `forget()` still destroys both sockets and removes them from the open set.
2. **Explicit blocks for single-line JSX returns** — `apps/studio/src/components/payouts/payoutOnboardingPanel.tsx`, `apps/seller/src/components/payouts/payoutDocumentStep.tsx`.
   - The verification/error/checking returns now use braces, removing the ASI warnings around JSX returns.
3. **Removed dead initialisers** — `apps/webapp/src/components/actions/brandedMediaDownload.hook.ts` (`outcome`), `services/scripts/apiSmoke/src/apiClient.util.ts` (`parsed`), `apps/ads/src/utils/money.util.ts` and `apps/admin/src/utils/formatting.util.ts` (`digits`).
   - Every path already assigns before use; the declarations are now `let name: Type;`, so nothing is silently overwritten.
**Verified:**
- `pnpm --filter @zudomart/gateway --filter @zudomart/studio --filter @zudomart/seller --filter @zudomart/webapp --filter @zudomart/ads --filter @zudomart/admin --filter @zudomart/api-smoke exec tsc --noEmit` → clean.
- `pnpm ... lint` → 0 errors (70 pre-existing webapp warnings).
**Rollback:** revert the hunks independently; no runtime contract, schema, or migration changes.

## 2026-10-19 — Batch 2 follow-up: single-tx onboarding, in-tx level, locked affiliate rate, refund keys, story viewer

**Audit:** ZM-016 (remaining), ZM-017 (affiliate rate lock), ZM-005 (refund key), ZM-014 (`available` display); UI requests (story viewer/tray, feed→Mart, quote entry point)
**Changes:**
1. **Payout onboarding claim + step are one transaction** — `payments/src/modules/gateway/services/payoutOnboarding.service.go`.
   - `SavePayoutOnboardingBank` still resolves the bank first (a provider call, so it must not hold a DB transaction), then in one `RunInMoneyTransaction` it locks the onboarding row, re-checks the legal name, claims the settlement account, and writes the `bank` step + `CreateRecipient`/seller-subaccount jobs.
   - `saveOnboardingStep` and the bank path now share `applyOnboardingStep`, so identity/business keep their create-if-missing behaviour.
   - Duplicate-account (`ErrBankAccountAlreadyLinked`), step-order and name-mismatch errors roll the claim and step back together.
2. **Verification level is read inside the withdrawal transaction** — `payments/.../verificationLevels.service.go`, `wallet/.../commands/requestWithdrawal/requestWithdrawal.handler.go`.
   - New `ReadVerificationLevelInTransaction(ctx, *sql.Tx, userId)` passes the transaction to both the ent queries and the raw identity lookup (`verificationLevelExecutor` now requires `QueryRowContext`).
   - `requestWithdrawal` derives `level`/`nameMatchedOnly` for the daily cap inside the idempotent money command instead of snapshotting them before it.
3. **Affiliate commission rate is locked at order time** — `creators/.../affiliates/services/affiliateCommissions.service.go`.
   - When the release event has no checkout-locked bps, `rateFor` uses the `AffiliateAttributedSale.CommissionBps` persisted by `RecordAwaitingAttributedSales`; live settings are only the fallback when no awaiting row exists.
   - A seller lowering the rate between order and escrow release no longer cuts an already-attributed commission.
4. **Refund idempotency key includes amount/currency** — `escrow/.../commands/refundOrderGroup/refundOrderGroup.handler.go`.
   - Key changed from `Hash(orderGroup, reason)[:64]` to `Hash(orderGroup, amountMinor, currency, reason)`. The `[:64]` was a no-op on a 64-char SHA-256 hex digest.
   - Same-amount retries still replay; a distinct partial refund is no longer reported as key reuse (the state machine still rejects a second distinct partial refund).
5. **Wallet `Available` no longer includes deposit hold** — `apps/mobile/src/screens/wallet/addMoney.screen.tsx`.
   - Shows `availableMinor` as available and appends the held amount separately (`• ₦X on deposit hold`), so held funds are not presented as spendable.
6. **Story viewer/tray** — `apps/mobile/src/screens/story/story.screen.tsx`, `components/story/storyAutoAdvance.hook.ts`, `components/chat/storyTray.tsx`, `navigation/navigation.types.ts`, `social/.../listStoryTray.handler.ts`, `social/.../post.repository.ts`.
   - Close X at the far right; `startAtLast` jumps to the previous user's last story; no wrap at the first user; advancing past the last user closes the viewer; sponsored story pages are reachable (the `adPage` branch is checked before loading/error/empty); seen ring is always visible (primary = unseen, faint = seen); tray orders unseen-first then newest, and the `["story-tray"]` cache is updated after `markStoryAsSeen` so the ring changes without waiting for a refetch.
7. **Feed→Mart drag and quote gating re-checked, no change needed.**
   - Feed→Mart drag is already implemented in `apps/mobile/src/screens/home/home.screen.tsx` + `homeSectionSwipe.util.ts` (`d6e3c65f4`); `homeSectionSwipe.test.ts` and `horizontalScrollGestureGuard.test.ts` pass 13/13.
   - `View quotes` already renders only when `quotes > 0` on mobile (`hasQuotesToShow`) and web (`ViewQuotesLink`).
8. **Checkout open is serialized per intent** — `payments/.../paymentIntentCreation.service.go`, `paymentGateway.service.go`.
   - `OpenProviderCheckoutForIntent` takes a session-level PostgreSQL advisory lock (`open-checkout:<intentId>`) on a dedicated connection before re-reading the intent. A concurrent caller gets a retryable `409 CHECKOUT_OPENING` instead of both calling the provider; the lock is released on that connection (and by connection close if the process dies).
   - Test: `payments.checkoutOpenLock_integration_test.go` — `TestAConcurrentCheckoutOpenReturnsRetryInsteadOfOpeningASecondProviderSession` (blocked call makes 0 provider POSTs; after unlock exactly 1).
9. **An incomplete idempotency record returns a retryable 409** — `ledger/src/utils/idempotentCommand.util.go`.
   - `IDEMPOTENCY_IN_PROGRESS` replaces the generic 500 when a stored record has no response yet.
**Verified (real output):**
- `go test ./modules/payments -run 'TestPayoutAccountCreation…|TestFailedPayoutAccountJobs…|TestADirectSalePayout…' -count=1` → `ok zudomart/modules/payments 2.300s`.
- `go test ./modules/wallet -run 'TestWithdrawalAndNewPayout…|TestWithdrawalVelocity…|TestANameMatchedOnly…' -count=1` → `ok zudomart/modules/wallet 3.489s`.
- `go test ./modules/escrow -run 'TestSecondDistinct…|TestAPartiallyRefunded…|TestAPartialChargeback…|TestAFailedRelease…' -count=1` → `ok zudomart/modules/escrow 2.821s`.
- `go test ./modules/creators -run TestAffiliateCommission… -count=1` → `ok zudomart/modules/creators 0.424s`.
- `go test ./modules/payments -run TestAConcurrentCheckoutOpen… -count=1` → `ok zudomart/modules/payments 0.460s`.
- `go build ./modules/payments/... ./modules/wallet/... ./modules/escrow/... ./modules/creators/... ./modules/ledger/...` → clean.
- Mobile: `tsc --noEmit` clean; social `typecheck` clean; mobile Jest `126 suites / 781 tests`; social Vitest `84 files / 544 tests`.
**Rollback:**
- Revert the Go hunks independently. The onboarding merge rolls back as one transaction; the in-tx level read is additive; the affiliate fallback is inert when no awaiting row exists; the refund key change only affects new requests.
- Revert the mobile copy/story hunks independently; no schema or migration changes.
**Remaining in Batch 2:** the two ZM-015 items are verified fixed by the tests above (chargeback receivable clears to zero; failed release returns the escrow to `held` while the order records the retry time/event). ZM-016's two open items are fixed here. ZM-005's provider-session open replay is fixed by the per-intent lock + retryable 409; confirm-receipt replay was reviewed and needs no key because escrow release is already status-idempotent and returns the same escrow. The refund retry race was re-checked and does not resend for lookup providers (attempt-count lookup) and parks unknown non-lookup providers in manual review.

## 2026-10-19 — Audit Batch 2: undelivered escrow review, fee-retaining refunds, direct-payout verification, name-matched cap, follow cooldown, locked live

**Audit:** ZM-015 (undelivered deadline, refund-after-release), ZM-016 (direct-payout gate, optional-mode limit), social follow requests (ZM-010/ZM-012), live access (ZM-012)
**Changes:**
1. **Undelivered escrow → staff review, never auto-release/refund** (owner decision 3 from ZM-015).
   - `escrow/.../escrowUndeliveredReview.service.go:22-34`: at the deadline the sweep now calls `moveUndeliveredEscrowToStaffReviewInTransaction`, which sets `undeliveredReviewAt`, clears `autoReleaseAt`, records an `undeliveredReview` event, raises `escrowUndeliveredReview`, and publishes `escrow.underReview`.
   - `escrowFulfilment.service.go:128`: due held+undelivered rows go to review instead of release.
   - Staff actions: `GET /api/v1/admin/escrows/undelivered-review` lists the queue; `POST /api/v1/admin/orders/{orderId}/escrow/release` and `.../refund` require `money.disputes.resolve` + single-use step-up (`escrows.routes.go:16-17,24-26`). `ReleaseEscrowAfterStaffReviewInTransaction` refuses a hold that is not under review (`:36-45`); both actions write a `staffDecision` event.
   - `BackfillUndeliveredReviewDeadlines` gives pre-existing held escrows a deadline, with `dryRun` support; not run automatically.
   - Tests: `escrow.undeliveredAutoRelease_integration_test.go` — `TestAnUndeliveredEscrowGoesToStaffReviewAndIsNeverAutoReleasedOrAutoRefunded`, `TestTheBackfillGivesLegacyHeldEscrowsAReviewDeadlineOnceAndOnlyWhenApplied`.
2. **Refund after the seller was paid keeps the platform fees** (owner decision 2).
   - `escrowWalletClawback.service.go:37-38,73`: when a released escrow is refunded, the clawback takes only `ReleasedToSellerMinor` from the seller and credits that same amount to `RefundedMinor`; the commission and processing fee stay with the platform. Any seller shortfall still becomes wallet debt (`takeFromSellerWallet`).
   - Terms now match the code: `apps/web/src/content/refundEscrowPolicy.content.ts`, `sellerTerms.content.ts`, `termsOfServiceMoney.content.ts` — removed the "code today refunds in full/returns the fees" caveats, state that the fee is non-refundable, and replace the 30-day caveats with "not released automatically while review is open".
   - Test: `escrow.refundAfterPayoutKeepsFees_integration_test.go` — `TestARefundAfterTheSellerWasPaidReturnsOnlyTheSellersPortionAndKeepsZudomartsFees`.
3. **Non-NGN direct-sale payouts require business verification** (owner decision 4).
   - `payments/.../walletPayouts.service.go:109`: `PrepareDirectSellerPayoutInTransaction` now calls `RequireSellerVerifiedForWithdrawal` before the payout-level check. The helper returns nil when the user has no `OrderPayable` rows, so ordinary wallet users are unaffected.
   - Fixtures updated: `payments.directPayoutGate_integration_test.go` records `RecordSellerVerification`; `flutterwaveCardAndDirect_test.go` marks the seller business-verified.
   - Test: `TestADirectSalePayoutNeedsPayoutVerificationAConfirmedRecipientAndNoDebt`.
4. **A name-matched-only Level 1 bank is capped at ₦100,000/day in optional mode** (owner decision 1).
   - `wallet/src/configs/withdrawalLimits.config.go:17,23,37,61-75,91-97`: new `NameMatchedOnlyDailyCapMinor` (default `NGN:10000000` = ₦100,000), env `WALLET_WITHDRAWAL_NAME_MATCHED_DAILY_CAPS`, and `ParseCurrencyCaps`.
   - `withdrawalLimits.service.go:71-80`: `effectiveWithdrawalDailyCap` applies the reduced cap only when the level is `VerificationLevelPayout` (1) and the bank is name-matched only; it takes the lower of the two caps and can never raise a cap.
   - `requestWithdrawal.handler.go:32,41`: `nameMatchedOnly` is derived from the verification method `payout_account` (NG, bank not BVN-validated); `bank_account`/`smile_id` keep their normal cap.
   - Tests: `withdrawalLimits.service_test.go` (unit, including the never-raise and default fallbacks) and `wallet.withdrawalSafety_integration_test.go` `TestANameMatchedOnlyLevelOneBankIsCappedAtOneHundredThousandNairaPerDay` (optional mode + deleted validation row → 20,000,000 minor refused, 9,000,000 allowed).
5. **Follow-request cooldown split: 24h after a decline, 15 min after a self-cancel** (owner decision 5).
   - `social/prisma/schema/graph.prisma`: `FollowEndedBy` (`requester`/`owner`) and nullable `Follow.endedBy`; migration `20261017120000_follow_ended_by`.
   - `follow.repository.ts:27-28`: `settlePendingRequest` records who ended it; `claimFollowState` clears `endedBy` on a new request (`:12`).
   - `followRules.service.ts:15-16,34`: decline → 24h, self-cancel → 15 min; unknown/legacy → 24h (fail closed). Handlers pass `existing?.endedBy`, `owner` on decline, and `requester` on unfollow-while-requested.
   - Tests: `tests/follows` — 3 files, 73 tests.
6. **Locked live view strips playback/media/commerce** (Part B).
   - `liveSessionPresenter.service.go:68-95`: `GetLiveSession` evaluates `DecideLiveAccess`; when not allowed it returns `lockedLiveView`, which clears `PlaybackUrl`, `Media`, `StoreId`, products, pinned product, ad settings, sponsorship line, top supporter and gifts. Private/blocked viewers get 403 (`LIVE_NOT_ACCESSIBLE`).
   - Test: `restrictedLiveAccess.integration_test.go` — `TestRestrictedLivesOfAPublicHostHandOutNoPlaybackToIneligibleViewers` (followers-only, subscribers-only, guest, blocked; media token + join refused).
**Verified (real output):**
- Escrow: `go test -count=1 ./ -run 'TestAnUndelivered…|TestTheBackfill…|TestARefundAfter…'` → `ok zudomart/modules/escrow 10.845s` (all 3 pass).
- Live: `go test -count=1 ./ -run TestRestrictedLives…` → `ok zudomart/modules/live 0.694s`.
- Wallet units: `go test -count=1 ./src/configs/... ./src/modules/payouts/services/... -run 'Withdrawal|NameMatched'` → `ok …/configs 0.031s`, `ok …/payouts/services 0.015s`.
- Wallet integration: `go test -count=1 ./ -run TestANameMatchedOnly…` → `ok zudomart/modules/wallet 1.264s`.
- Payments: `go test -count=1 ./ -run TestADirectSalePayout…` → `ok zudomart/modules/payments 1.030s`.
- Social: `pnpm -s vitest run tests/follows` → `Test Files 3 passed (3)`, `Tests 73 passed (73)`; `pnpm -s typecheck` regenerates the Prisma clients and both `tsc` passes are clean.
- `gofmt` clean on the changed Go files; wallet, payments and escrow build.
**Rollback:**
- Revert the Go/TS hunks independently. The follow migration is additive: drop `follows.endedBy`, then `DROP TYPE "FollowEndedBy"`; reverting the cooldown leaves existing `endedBy` values unused.
- Revert the legal-copy changes with the same commit if the fee policy changes.
- The name-matched cap is config-driven: `WALLET_WITHDRAWAL_NAME_MATCHED_DAILY_CAPS` can raise it without a code change.
**Remaining in Batch 2 (resolved in the follow-up entry above):**
- ZM-015: both items are verified fixed — the released-escrow partial chargeback clears the receivable to zero and takes only the seller's disputed share; the failed release returns the escrow to `held` and the order records the retry time + `sellerPayoutRetrying` event.
- ZM-016: both items are fixed in the follow-up — onboarding claim + step are one transaction (only the provider bank-resolution call stays outside), and the withdrawal verification level is read inside the withdrawal transaction.

## 2026-10-17 — ZM-016 (Part B): debt in the withdrawal tx, payout send claim, refund bank-destination guard, direct-payout gate, dead-lettered mismatches

**Audit:** ZM-016 (all bullets, in order)
**Changes:**
1. Resolve → claim → step split / payout readers not waiting for `CreateRecipient` — **re-validated at payout.**
   - `payments/.../customerValidation.service.go:115-132`: the new `latestConfirmedPayeeBankAccount` only returns a bank from a `createRecipient` job with status `succeeded`. BVN validation keeps using the latest job.
   - The direct-payout path uses it, so money only goes to a bank whose recipient creation completed.
   - The onboarding save itself is still three steps (not made single-transaction).
2. Direct-payout gate — `payments/.../walletPayouts.service.go:106-118`. `PrepareDirectSellerPayoutInTransaction` now requires:
   - `RequireVerificationLevel(VerificationLevelPayout)`;
   - no debt in any currency (`ErrDirectPayoutDebtOutstanding`, read inside the transaction);
   - the confirmed recipient bank above.
   - Not applied: the two withdrawal-only checks, `RequirePayoutAccountVerified` (Flutterwave NGN wallet) and `RequireSellerVerifiedForWithdrawal` (business verification). Direct payouts only run for non-NGN sales, and those checks failed the verified-Ghana-seller e2e (`seller payout after settlement: 0`). Listed for the owner.
   - Test: `payments.directPayoutGate_integration_test.go` (unverified, recipient not confirmed → refused; verified → prepared; verified with a USD seller debt → `ErrDirectPayoutDebtOutstanding`).
3. Debt-limit bypass.
   - Correction to the audit: the withdrawal transaction already refused any same-currency `SellerDebt`/`WalletDebt`/`CreatorEarningsDebt` (`walletBalances.service.go:26-28` via `providerWalletWithdrawals.service.go:24`).
   - The real gap was a debt in **another currency**. `providerWalletWithdrawals.service.go:27-31` now calls `payments/.../sellingEligibility.service.go:66-69` (`ReadUserDebtsInAnyCurrencyInTransaction`, inside the transaction). The seller-payout relay goes through the same handler.
   - Test: `wallet.withdrawalDebts_integration_test.go` "SellerDebtInAnotherCurrency…". Before: `201 … withdrawalStatus queued`; after: 409 `WALLET_DEBT_OUTSTANDING`.
4. Transfer double-send — new nullable `payout_transfers.send_claimed_at`:
   - schema `payoutTransfer.schema.go:47`; ent regenerated (8 files, `payouttransfer*`, `mutation.go`, `runtime.go`, `migrate/schema.go`);
   - migration `payments/src/migrations/20261017120000_payout_transfer_send_claim.{up,down}.sql`;
   - `atlas.sum` recomputed with `ariga.io/atlas/sql/sqltool` (the tool first reproduced the old `h1:aK47…` exactly).
   - `sellerPayouts.service.go:80-99` adds `claimAndSendPayoutToProvider`. It is a guarded `UPDATE … WHERE status='processing' AND provider_transfer_code='' AND (send_claimed_at IS NULL OR send_claimed_at < now−15m)`; only the claimant calls `CreateTransfer`. It is used by `SendPreparedSellerPayout` and by the reconciler resend (:196).
   - A crashed sender's claim expires after 15 minutes, and the provider dedups by reference.
   - Test: `wallet.payoutSendClaim_integration_test.go` (lost reply, then 5 concurrent senders). Before: `3 posts`; after: 1 post, then paid.
5. Bank-destination hijack — `payments/.../refundBankPayouts.service.go:99-120,122-131`.
   - The resolved account name must match the owner's KYC wallet name (`utils.NamesMatch`). A mismatch returns `REFUND_BANK_NAME_MISMATCH`; no KYC name returns `REFUND_BANK_NAME_UNVERIFIED`.
   - The `awaiting_bank_details → processing` flip is now a claim done **before** the provider call, with an affected-row check (0 → `REFUND_NOT_AWAITING_BANK_DETAILS`). It reverts on provider error.
   - Note: no provider implements `RefundBankDetailsProvider` today (`container/providerCapabilities.container.go:85-87`), so this path is dormant in production.
   - Test: `payments.refundBankDestination_integration_test.go` (stranger's account → 422 with 0 provider retries; 5 concurrent submits → 1 accepted, 1 provider retry). Before: `200 … CHUKWUEMEKA STRANGER`.
6. Card-verification double micro-refund — **not reproducible.**
   - A duplicate-paid intent skips the purpose handler (`paymentSettlement.service.go:173-175`), so only `duplicate-refund-<ref>` exists for it. `refundCardVerificationImmediately` creates no rows, and `SendPendingRefundToProvider` claims exactly once.
   - Regression lock: `payments.cardVerificationRefund_integration_test.go` "SecondChargeOnACardVerification…" (second charge on the same reference, webhook ×3 → refunds `[5000 5000]`).
7. Settlement credit.
   - Already guarded: row `FOR UPDATE` + `provider_settled_at` check (`providerSettlements.service.go:56-58`) + unique `journal_entries.reference` (`ledger/src/databases/schema/journalEntry.schema.go:39`).
   - Regression lock: `payments.providerSettlementOnce_integration_test.go` (4 concurrent runs + 1 → exactly 1 `settled:` entry).
   - Amount mismatch now dead-letters: `webhookProcessing.service.go:91-111` returns `webhookNeedsFinanceReview`, and `webhookInbox.service.go:87-89,127-129` sets `dead_lettered_at` + `last_error` immediately and raises the `webhookDeadLettered` alert. The provider still gets 200 and the intent is still recorded `failed`.
   - Test: `payments.webhookAmountMismatch_integration_test.go`. Before: `processed … dead <nil> error ""`.
8. Level-1 limit on a name-matched-only bank — **already the safe default.** `PAYOUT_BANK_VALIDATION` defaults to `required` (`payments/src/configs/payments.config.go:110`), so NG Level 1 needs a BVN-validated bank. The audit's "mode optional default" was wrong. Owner decision listed for when `optional` is enabled.
9. Clawback shortfall → seller debt — **already the safe default.** The shortfall is booked to the seller's `WalletDebt` with an alert and `wallet.debtRecorded` (`escrowWalletClawback.service.go:51,64-72`). The platform absorbs the returned processing fee. Owner decision listed.
**Verified (real output):**
- `go test -race -count=1 ./...`: payments → `ok zudomart/modules/payments 36.092s` (+8 subpackages ok); wallet → `ok zudomart/modules/wallet 66.808s` (+7 ok); orders → `ok zudomart/modules/orders 14.385s` (+10 ok).
- deployables → `ok …/flutterwaveFlows 143.709s`, `ok …/goCommerce 18.343s`.
- gateway `npx vitest run` → `Test Files 34 passed (34) Tests 1690 passed (1690)`.
- `gofmt -l` clean (generated excluded); `go vet ./...` clean.
**Rollback:**
- Code hunks revert independently.
- `send_claimed_at` rollback: run `20261017120000_payout_transfer_send_claim.down.sql`, then revert the schema, regenerate ent and delete the two migration files and restore `payments/src/migrations/atlas.sum` from git.
- Reverting the send claim re-opens concurrent double-send.
**Remaining in ZM-016:**
- The onboarding resolve/claim/step is still not single-transaction (mitigated at payout).
- The withdrawal level snapshot is still read outside the transaction (`requestWithdrawal.handler.go:28-31`).
- The 7-day settlement re-scan is noisy but harmless.
- Owner decisions below.
**Owner decisions (safest default implemented; not guessed):**
1. NG Level 1 with `PAYOUT_BANK_VALIDATION=optional`: the cap stays ₦500 000/day (`withdrawalLimits.config.go:19`) on a name-matched-only bank. Default is `required`.
2. Clawback shortfall: today it becomes seller wallet debt and the platform absorbs the returned processing fee. Should the seller bear the fee?
3. Undelivered escrow deadline (ZM-015): it is 30 days and **releases to the seller**, as the audit asked. The alternatives are auto-refund to the buyer, or staff review. **Superseded later on 2026-10-17:** the implemented path now moves the escrow to staff review; it is never auto-released or auto-refunded.
4. Direct payouts: should the business-verification gate that withdrawals use also apply to non-NGN direct-sale payouts? It is not applied, because it blocked verified Ghana sellers.
5. Refund to a bank account for buyers without a KYC wallet name: today it is refused (`REFUND_BANK_NAME_UNVERIFIED`). The provider capability is unimplemented anyway.

## 2026-10-17 — ZM-015 (Part B): dust rule, finishing partial refunds, deadline at hold, poison-row sweep, chargebacks after refunds

**Audit:** ZM-015 (all bullets, in order)
**Changes:**
1. Stale-price hold — **investigated; no code change needed.**
   - `order_groups.total_minor` and `checkouts.total_minor` are `Immutable()` (`orders/src/databases/schema/orderGroup.schema.go:42`, `checkout.schema.go:44`).
   - The payable is registered from `group.TotalMinor` (`orders/src/services/checkout.service.go:184-187`), and re-registering with another amount returns `CHECKOUT_PAYABLES_CONFLICT` (`payments/.../orderPayables.service.go:58`).
   - The hold refuses any payment that differs from the payable (`escrowHolding.service.go:45-47`). So the escrow amount, the order total and both refund caps are the same number by construction.
   - Regression lock: `escrow/escrow.payableFrozenAtCheckout_integration_test.go` (re-price → conflict; hold = checkout total; refund of total+1 → 422 `REFUND_DOES_NOT_MATCH_ORDER`).
2. Single dust rule, same base — `escrow/src/modules/escrows/models/escrowStateMachine.model.go:81-89` adds `CommissionKeptOnRemainder`: floor(heldCommission × remainder / amount) using `math/big`, so the dust goes to the seller. `escrowSettlement.service.go:114` uses it in place of `min(bps-on-remainder, held)`; the bps was itself rounded from the held commission.
   - The change can move 1 minor unit either way versus before, but there is now one deterministic rule.
   - Tests: model unit test (capped fee 2 000 on 1 000 000, remainder 333 333 → 666; MaxInt64 case) and `escrow.partialRefundDust_integration_test.go`. Before the fix: `got 2000, want 2001 of 3002`.
3. Partial-terminal trap.
   - `models/escrowStateMachine.model.go:32` allows `partiallyRefunded → refunded`.
   - `refundOrderGroup.handler.go:43` routes a refund of **exactly** `amount − refunded` to `RefundEscrowInTransaction`. Any other amount is still `ESCROW_ALREADY_PARTIALLY_REFUNDED` (the remaining-amount guard).
   - Wallet path: `escrowSettlement.service.go:123-132` and `escrowWalletClawback.service.go:37-48,79-80` reuse the clawback with `buyerOwed = amount − refunded`. The seller's kept share and the platform's kept commission/fee are returned, and the final status is `refunded`.
   - Direct path: `escrowDirectRefunds.service.go:20-40` refunds only `rest`. Before, it re-refunded the full amount to the card.
   - `partiallyRefunded → released` is answered as `AlreadySettled`, with no money moved (`escrowSettlement.service.go:38`): the remainder was released when the partial was made. So it is not a separate allowed transition.
   - Tests: `escrow.partialThenFullRefund_integration_test.go` (wrong amount refused; release → AlreadySettled; rest ×2 → `refunded` once; buyer holds 300 000, seller 0), `escrow.directSaleChargebacks_integration_test.go` "RefundingTheRest…". Before: `ESCROW_INVALID_STATE` and `provider refunds 200000`.
4. Never-delivered escrows locked forever.
   - `escrow/src/configs/escrow.config.go:18-29` adds `ESCROW_UNDELIVERED_RELEASE_PERIOD` (default 30 days, also the fallback for zero-valued settings).
   - `escrowWalletHolding.service.go:54-55` sets `AutoReleaseAt` at hold.
   - `escrowFulfilment.service.go:61-63,74` makes delivery reschedule it to delivery + inspection (extends a late delivery) and announces `escrow.releaseScheduled` once, on first delivery.
   - `escrowViews.service.go:41` keeps the buyer-facing estimate until delivery.
   - Test: `escrow.undeliveredAutoRelease_integration_test.go`. Before: `a never-delivered escrow must still have a deadline: <nil>`.
5. Head-of-line blocking — `escrowFulfilment.service.go:103-143`. The sweep skips a failing row (`IDNotIn(skipped)`), counts it in `escrowAutoReleaseDeadLetter` (payment alert metric with escrowId/orderId/error), and continues. It returns the joined errors and caps attempts at the batch size. Test: `escrow.autoReleasePoisonRow_integration_test.go` (legacy-custody row due first). Before: `released … 0 this escrow was held in the previous provider's pooled account`.
6. + 7. Status-guarded, idempotent chargeback posting with a cross-module refunded-already check, including partial-then-chargeback.
   - New `escrow/.../escrowWalletChargebackRecovery.service.go` is called from `escrowWalletChargebacks.service.go:48-49` for `refunded`/`partiallyRefunded`/`clawedBack`. Before, these statuses returned nil and the receivable stayed open.
   - Cross-module check: `payments/.../providerRefundTotals.service.go` reads `refunded_minor + refund_in_flight_minor` in the same transaction.
   - The withheld amount is split three ways:
     1. the part the provider already refunded to the card stays an open receivable (claim on the provider);
     2. the part refunded in-wallet is recovered from the buyer's wallet, with any shortfall going to the buyer's wallet debt;
     3. any unrecovered rest is recovered from the seller's kept share, and the platform returns its kept commission and fee.
   - Idempotent two ways: skipped if the held-path reference `chargeback-lost:<escrow>` exists (the refund came from the chargeback itself), and a per-dispute reference is checked before posting.
   - Tests: `escrow.walletChargebacksAfterRefunds_integration_test.go` (partial 100 000 then lost → buyer −100 000, seller −kept share, receivable 0, `refunded` 300 000, duplicate notice moves nothing; full wallet refund then lost → buyer −200 000 once; held-path recovered then duplicate → nothing). Before: `receivable 300000` and `receivable 200000, buyer 200000 -> 200000`.
**Verified (real output):**
- `go test -race -count=1 ./...` in `modules/escrow` → `ok zudomart/modules/escrow 66.900s`, `ok …/escrows/models 1.013s`.
- deployables `go test -race -count=1 ./flutterwaveFlows/ ./goCommerce/` → `ok …/flutterwaveFlows 143.709s`, `ok …/goCommerce 18.343s`.
- `gofmt -l` clean; `go vet ./...` clean.
**Rollback:** revert each hunk independently. The dust rule, transitions and deadline need no data migration. Rows held before this change keep `AutoReleaseAt = NULL` until delivered; to backfill, run `UPDATE escrows SET auto_release_at = created_at + interval '30 days' WHERE status = 'held' AND auto_release_at IS NULL` (owner call, not run).
**Remaining in ZM-015:**
- A *partial* chargeback on a **released** wallet escrow recovers the full amount and over-credits the receivable (`escrowWalletChargebacks.service.go:22-41` uses `AmountMinor`, not `disputed`). Found while testing; not fixed in this batch.
- The movement-failure rollback (`released` → `held`) can still disagree with the order service.
- The undelivered-deadline action is an owner decision (below).

## 2026-10-17 — Review corrections to the 2026-10-16 entries (ZM-016, ZM-015, ZM-001, ZM-002)

**Audit:** ZM-016 §8 (payout DELETE regression + seller path), ZM-015 §8 (chargeback guard), ZM-001 (provider amplification, no tests), ZM-002 (other pre-auth endpoints, OPTIONS open item)
**Changes (each with a regression test written first and seen failing):**
1. ZM-016 regression — removing a payout account was broken on web and mobile after the 10-16 `requireStepUp` change.
   - `apps/webapp/src/services/wallets.service.ts:27-28` — `removePayoutAccount(id, stepUpToken)` sends `X-Step-Up-Token` (same option `addPayoutAccount` uses).
   - `apps/webapp/src/app/(app)/wallet/payouts/page.tsx:48-54` — mutation wrapped in `withStepUp`; errors go through `showMutationError` (cancel → `StepUpCancelledError` is silent, like add/withdraw).
   - `apps/mobile/src/services/wallets.service.ts:13-14` and `apps/mobile/src/services/money/wallets.service.ts:13-14` — same header.
   - `apps/mobile/src/screens/wallet/payoutAccounts.screen.tsx:47-54` — `withStepUp` from `useStepUpPrompt` (already mounted for add); cancel shows no error toast.
   - Other callers checked: only the seller dashboard (already sends a token) and the gateway rate-limit rule. No smoke test calls DELETE.
   - Tests: `apps/webapp/src/services/wallets.service.test.ts` (fetch stub asserts the header), `apps/mobile/src/services/money/__tests__/wallets.service.test.ts` (both mobile services).
2. ZM-016 seller path enforced — the token the seller UI sent was never consumed.
   - `services/go/modules/orders/src/modules/sellerMoneyRelay/routes/sellerMoneyRelay.routes.go:45` — DELETE wrapped in `steppedUp`, like PATCH on :44.
   - `services/go/modules/wallet/src/modules/sellerMoney/routes/sellerMoney.routes.go:34` — internal DELETE wrapped in `stepUp` (single-use digest consumption), like :32-33.
   - `services/go/modules/wallet/wallet.sellerMoney_integration_test.go:99` — the in-progress-payout check now sends a fresh step-up.
   - Tests: `orders/.../sellerMoneyRelay/routes/sellerMoneyRelay.routes_test.go` (no step-up → 403 STEP_UP_REQUIRED and nothing relayed; access token as step-up → 403; valid → relayed with a 64-hex digest; PATCH+DELETE), `wallet/wallet.sellerPayoutAccountRemoval_integration_test.go` (none → 403; the add's digest → 401 STEP_UP_REUSED; fresh → removed; replayed → 401).
3. ZM-015 chargeback guard — `services/go/modules/escrow/src/modules/escrows/services/escrowDirectRefunds.service.go:52-95`.
   - `partiallyRefunded` now posts the unrecovered rest, `max(min(disputed, amount − refundedMinor), 0)`; `refunded`/`clawedBack` still skip.
   - The reference is per dispute (`chargeback-lost:<escrow>:<dispute>`) and checked first, so a duplicate notice is a no-op and a second dispute is not rejected as a reused reference.
   - **Extra bug found and fixed:** the lost entry credited `PlatformProviderBalance` even when payments had already moved that money to `chargebackReceivable` (`chargebackLedger.service.go:44-56`, `chargeback-withheld:<dispute>`). The provider balance was reduced twice and the receivable never closed. `chargebackWithholdingAccount` (:90-95) now credits the receivable when the withholding entry exists, and the provider balance only for providers that post no withholding.
   - Refund-then-chargeback keeps the withheld amount as an open receivable: the provider charged back a payment it had already refunded, so it is a claim against the provider. The seller is not charged twice.
   - Tests: `escrow/escrow.directSaleChargebacks_integration_test.go` — direct sale lost (seller debt 200 000, receivable 0, ledger provider-balance delta == fake provider delta); duplicate lost notice ×2 (no extra post); refund → lost (seller debt unchanged, receivable 200 000 open); partial 50 000 lost → second 150 000 lost (debt 200 000, receivable 0, escrow `refunded`).
4. ZM-001 provider amplification — `services/go/modules/payments/src/modules/checkoutPayments/commands/verifyOrderPayment/verifyOrderPayment.handler.go:17,52-57`.
   - The 50-row scan still returns an early `paid`.
   - Only the newest 3 pending intents are verified with the provider (`newestPendingIntentsVerifiedWithProvider`); older pending rows keep their DB status.
   - Tests (there were none): `payments/payments.verifyOrderPayment_integration_test.go` — succeeded oldest of 50 → `paid` with 0 `GET /transactions`; 20 pending → `pending` with 1-3 provider calls (was 20); newest failed → `failed`; wrong buyer → 404 with 0 calls; sibling order resolves its own payable (sibling-only intent ≠ paid, checkout intent = paid).
5. ZM-002 remaining pre-auth admin endpoints — `services/typescript/gateway/src/services/routeRateLimitPolicy.service.ts:7-8,14,16`.
   - `mfa/enroll/confirm` (takes a TOTP code) is now in `otp` (5/min/IP) with `mfa/verify`.
   - `login`, `refresh`, `accept-invitation`, `mfa/enroll/start` and `mfa/webauthn/options` are in `login` (10/min/IP).
   - Exact-path sets mirror `adminStaffGate.service.ts:4-12`; any other spelling still needs a staff token.
   - OPTIONS open item: a CORS preflight (with `Access-Control-Request-Method`) was already answered by `strictCors.middleware.ts`. A **bare** `OPTIONS /api/v1/admin/*` was proxied upstream with no staff token: the new test saw 200 from the fake upstream.
   - Go upstreams answer 405 and run no handler (probe output below). The TS upstreams were never checked.
   - `services/typescript/gateway/src/handlers/upstreamDispatch.handler.ts:72` now answers every OPTIONS on an admin path with an empty 204 at the edge, so no upstream sees it.
   - Tests: `services/typescript/gateway/tests/adminAuthRateLimits.routes.test.ts` (all 7 pre-auth paths bucketed ≤10/min and keyed by IP; `GET /me` and OPTIONS not bucketed), `tests/deepScanHardening.test.ts` "answers a bare admin OPTIONS at the edge…" (4 paths → 204, empty body, 0 forwarded).
6. Audit index corrected (ZM-001, ZM-002, ZM-015, ZM-016 rows and section headers).
**Verified (real output):**
- webapp `npx tsx --test src/services/wallets.service.test.ts` before the fix: `✖ … expected 'step-up-token-1' + actual undefined`; after: `ℹ pass 1 ℹ fail 0`; `tsc --noEmit` 0 errors.
- mobile jest before: `Tests: 2 failed, 2 total`; after: `Tests: 2 passed, 2 total`; `tsc --noEmit` 0 errors.
- relay route test before: `DELETE without a step-up must stop at the relay: 204 (relayed 1)`; after: `ok …/sellerMoneyRelay/routes`.
- wallet removal test before: `removing without a step-up must be refused: 204`; after: `ok zudomart/modules/wallet`.
- direct chargeback tests before: `the ledger moved the provider balance by -400000 while the provider moved it by -200000` and `… -250000 … -200000`; after: `ok zudomart/modules/escrow`.
- verify test before: `a retry storm must not fan out to the provider: 200 {"status":"pending"} after 20 provider calls`; after: `ok zudomart/modules/payments`.
- gateway rate-limit test before: `Tests 3 failed | 1 passed (4)`; OPTIONS test before: `expected 200 to be 204`; after: `Test Files 2 passed (2) Tests 22 passed (22)`.
- Go ServeMux OPTIONS probe: `/api/v1/admin/ledger/entries 405 GET, HEAD handlers run: 0` and `/api/v1/admin/withdrawals/w1/approve 405 POST handlers run: 0`.
**Rollback:**
- Web/mobile: revert the service and screen hunks. Removal stops working; the backend still enforces step-up.
- Relay/internal routes: reverting re-opens seller DELETE without step-up.
- Escrow: reverting re-opens the double provider-balance credit and the unjournaled partial chargebacks.
- Verify handler: reverting re-opens provider fan-out.
- Gateway: reverting re-opens the guest-limit admin endpoints and proxied bare OPTIONS.

## 2026-10-16 — ZM-019 (part): internal token on suspension-cases intake

**Audit:** ZM-019 breakage (bare `POST /api/v1/internal/suspension-cases`)
**Changes:**
1. `services/go/modules/moderation/src/modules/suspensionCases/routes/suspensionCases.routes.go:13-15` — intake wrapped in `middlewares.RequireInternalToken(container.Settings.IntakeToken)`, identical to the five sibling modules (copyrightClaims, accessSecurity, ipClaims, accountHealth, strikes). Unauthenticated suspension-case fabrication closed; gateway already 404s `/internal/*` externally (defense in depth).
**Verified:** `gofmt` clean; `go build ./src/modules/...` clean; `go test ./src/modules/suspensionCases/...` ok.
**Rollback:** revert (re-opens unauthenticated intake).
**Remaining in ZM-019 (queued):** order/battle stuck-state transitions; card-boost forfeit parity; ads open-redirect allowlist; host-middleware; signed attribution; promo locks.

## 2026-10-16 — ZM-015 (part): status guard on direct-sale chargeback posting

**Audit:** ZM-015 §8 (direct-sale double-post)
**Changes:**
1. `services/go/modules/escrow/src/modules/escrows/services/escrowDirectRefunds.service.go:44-47` — `recordLostChargebackOnDirectSale` now returns nil when `held.Status` is already `refunded`, `partiallyRefunded`, or `clawedBack` (mirrors the escrow-mode guard at `escrowWalletChargebacks.service.go:48-49`). Row is `ForUpdate`-locked by the caller (`escrowChargebacks.service.go:17`), so the guard is race-safe. `held`/`released` still post (released = seller owes; held/disputed = funds recovery). ~~Eliminates duplicate seller-debt + double buyer refund on duplicate `lost` webhooks after a prior refund.~~ **Correction (2026-10-17):** a duplicate `lost` webhook could never double-post — `recordProviderDispute` returns early when the stored dispute status is unchanged, and the ledger replays an identical reference (`ledgerPosting.service.go:56-60`, unique `journal_entries.reference`). The real scenario this guard closed was **refund-then-chargeback** (seller debited by the refund, then again by the lost chargeback). The `partiallyRefunded` skip in this entry was itself a bug (withheld money unjournaled) — superseded by the 2026-10-17 "review corrections" entry above.
**Verified:** `gofmt` clean; `go build ./modules/escrow/...` clean; `go test ./modules/escrow/ -run TestAChargebackFreezesEscrow` PASS (1.83s).
**Rollback:** revert guard (re-opens double-post on duplicate lost-chargeback after refund).
**Remaining in ZM-015 (queued):** payable-vs-live-total revalidation at hold; single dust rule; `partiallyRefunded` outgoing transitions; `AutoReleaseAt` at hold + skip-poison-row sweep; cross-module refunded-already check on chargeback posts.

## 2026-10-16 — ZM-007 (investigation, no code change): route-pattern + error-code mapping cleared

**Audit:** ZM-007
**Findings:**
1. `compilePathPattern` (`apps/admin/src/config/apiAccess.config.ts:22-30`) is CORRECT — verified `{disable|enable|…}` compiles to `(?:disable|enable|…)` and matches per-action paths while rejecting others (node one-liner). Original suspicion withdrawn.
2. Unmapped codes (`VALIDATION_FAILED`, `USERNAME_TAKEN`, `REALTIME_UNAVAILABLE`) do NOT degrade UX: frontends match `code` directly (`apps/webapp/src/app/(auth)/signup/page.tsx:80`, `apps/mobile/src/screens/auth/signUpUsername.screen.tsx:74`), and server copy passes through via `isServerWrittenError` (`packages/webKit/src/errorExperience/friendlyMessage.ts:5-11`, 4xx + kind unknown → verbatim message). Only kind-based branching (telemetry) is affected — accepted.
**Remaining in ZM-007 (queued):** seller `GET /api/v1/wallets/me` prefix gap; prod env checklist CI.

## 2026-10-16 — ZM-016 (part): step-up on payout-account DELETE + refund bank-destination + seller UI

**Audit:** ZM-016 §4 (bank-destination hijack) + §8 (payout DELETE without step-up)
**Changes:**
1. `services/go/modules/wallet/src/modules/payouts/routes/payouts.routes.go:25` — `DELETE /api/v1/wallets/me/payout-accounts/{payoutAccountId}`: `requireUser` → `requireStepUp` (single-use step-up, same wrapper as POST payout-accounts/withdrawals on lines 24/28).
2. `services/go/modules/payments/src/modules/savedCards/routes/savedCards.routes.go:17` — `POST /api/v1/payments/refunds/{refundId}/bank-destination`: `requireUser` → `RequireUserAccessTokenAndSingleUseStepUp` (same wrapper as payout-onboarding bank save). Stolen session alone can no longer redirect a refund; name-match + verified-account binding still queued.
3. `apps/seller/src/components/wallet/payoutAccountsView.tsx:47-59` — `removePayoutAccount` now wraps DELETE in `withStepUp` + `stepUpHeaders(token)` (same pattern as `makeAccountTheDefault` above it); cancel swallows `StepUpCancelledError`. BFF already forwards `x-step-up-token` (`apps/seller/src/server/bffGateway.service.ts:21-22`).
**Verified:** `go build ./modules/wallet/... ./modules/payments/...` clean; `gofmt` clean; `go test ./modules/wallet/src/modules/payouts/...` ok; seller `tsc --noEmit` clean. Next.js guide `backend-for-frontend.md` read before UI edit per `apps/seller/AGENTS.md`.
**Rollback:** revert the 3 hunks; DELETE/bank-destination return to session-only (re-opens hijack — do not rollback without replacement control).
**Remaining in ZM-016 (queued):** seller-debt check inside withdrawal tx; version-guarded transfer send-claim; resolve+claim single-tx; affected-row guard on bank-destination flip; verification-mode default review.

## 2026-10-16 — ZM-001: verify window + early-paid short-circuit + own-row buyer check (with honesty correction)

**Audit:** ZM-001
**Changes:**
1. `services/go/modules/payments/src/modules/checkoutPayments/commands/verifyOrderPayment/verifyOrderPayment.handler.go:31-36` — intent query `Limit(10)` → `Limit(50)` (retry storm could push the succeeded intent off-window → false `pending` → double-pay).
2. Same file: early `paid` return when any DB-`succeeded` intent exists — zero provider `VerifyCharge` calls in the paid case (was up to 10 external calls per verify).
3. Same file: ownership check moved from `payables[0]` (oldest sibling) to the payable with `OrderId == command.OrderId`; query uses its `CheckoutId`.
4. Audit doc ZM-001 rewritten: original "false-paid" theory corrected — `OrderPayable.OrderID` uniqueness (`orderPayables.service.go:55,87`) means ANY-succeeded ⇒ paid is CORRECT semantics; realizable bugs were the reverse direction + edges above.
**Verified:** `gofmt` clean; `go build ./modules/payments/...` clean; `go vet` clean.
**Rollback:** revert handler hunks (re-opens double-pay-after-retry-storm + provider-call amplification).

## 2026-10-16 — ZM-013 (part): mock-guard log fix

**Audit:** ZM-013
**Changes:**
1. `scripts/checkNoMocksInBuild.mjs:86-99` — `checkMobile()` recorded `problems.length` before checks and only prints the `ok mobile…` line when nothing was queued (was unconditional, masking failures in CI logs). Exit-code gate unchanged (still 1 on problems).
**Verified:** `node scripts/checkNoMocksInBuild.mjs mobile` → ok lines + `exit=0`.
**Rollback:** revert (log-only; gate unaffected).
**Remaining in ZM-013 (queued):** `-race -count=1` for money packages in `test-go-workspace.sh`; dev-only local-auth stub flag; e2e-report PII scan.

## 2026-10-16 — ZM-002 (gateway part): admin passkey allowlist + admin login/OTP rate buckets

**Audit:** ZM-002 findings A + B
**Changes:**
1. `services/typescript/gateway/src/services/anonymousMutationGuard.service.ts:10` — allowlist regex gains `mfa/webauthn/options`, matching the staff-gate public set (`adminStaffGate.service.ts:4-12`). Pre-auth passkey `POST /api/v1/admin/auth/mfa/webauthn/options` (`{mfaToken}`, no Bearer) no longer 401s at edge.
2. `services/typescript/gateway/src/services/routeRateLimitPolicy.service.ts:10-12` — `POST /api/v1/admin/auth/login` → `login` bucket (10/min/IP, was generic guest 120/min); `POST /api/v1/admin/auth/mfa/verify` → `otp` bucket (5/min). Highest-privilege accounts now have the strongest edge block.
**Verified:** `pnpm vitest run tests/anonymousMutations.handler.test.ts tests/gatewayHardening.handler.test.ts` → 2 files, 1169 tests passed.
**Rollback:** revert both lines (re-opens 12x brute-force window + breaks admin passkey login).
**Remaining in ZM-002 (queued):** confirm upstream `OPTIONS /api/v1/admin/*` returns empty 204 with no side effects.
