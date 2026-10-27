# API contract check: frontends against the real backend

> **Historical snapshot (2026-10-05).** The counts, mock-only rows and "no backend" notes are stale. Several seller, ads, admin and delivery routes have shipped since; use [frontendWiring.md](../integrations/frontendWiring.md) and the current route tables before switching a prefix. The method and the fixed-mismatch history are still useful.

As of 2026-10-05. Method: every API call in the six apps was extracted from source (service files, BFF routes, components; the `*_REAL_API_PREFIXES` switches send every call through the same client), normalised (`:p` = path parameter) and matched against the routes actually registered by the Go services, the TS services and the gateway route table (`services/typescript/gateway/src/routes/upstream.routes.ts`). Then: auth via the gateway table, request body keys against the Go DTO the controller decodes (Go decoders reject unknown fields, so an extra key is a 400), the list envelope, money shape, the error codes the UI branches on, and required `Idempotency-Key` headers. Seller, ads and admin calls were also checked against their `apiContract.md`.

Statuses: **matches** (path, method and gateway route agree), **fixed** (was wrong, fixed in this pass), **mismatch** (both sides exist but disagree; open), **mock-only** (no backend route). Extraction is static, so a few calls built from helpers are matched by hand; the live run below confirms the main paths.

## Summary

| App | Calls | matches | fixed | mismatch | mock-only |
| --- | --- | --- | --- | --- | --- |
| mobile | 343 | 286 | 7 | 0 | 50 |
| webapp | 186 | 161 | 6 | 0 | 19 |
| studio | 41 | 36 | 2 | 1 | 2 |
| seller | 208 | 94 | 56 | 1 | 57 |
| ads | 81 | 54 | 4 | 0 | 23 |
| admin | 191 | 134 | 5 | 2 | 50 |

Counts are the 2026-10-05 snapshot; they are not current.

## Live run against the real gateway

Sandbox stack started with `security/regression/startSandboxStack.sh`: six Go deployables, the gateway and five TS services, all on 127.0.0.1, with the fake payment provider on loopback. Gateway route limits were relaxed for the run (`RATE_LIMIT_OTP_PER_MINUTE` and similar), as in earlier smoke runs. Pending Prisma migrations for social, search and media were applied first. Without them the social feeds and `/search/recent` returned 500.

| Run | Result |
| --- | --- |
| New `apiSmoke/tests/frontendContracts.smoke.test.ts`: the mobile, webapp and studio contract lists, plus seller login and error shape, ads memberships envelope, admin table and `auth/me`. All go through the gateway with a real user and a bootstrapped superadmin | 29 pass, 2 skipped (paths that use mock fixture ids: `/lives/live_s0/viewers`, `/lives/live_1/comments`) |
| apiSmoke, full suite | 29 pass, 16 fail, 9 skipped. Every failure is an environment problem, not a contract one (see below) |
| App contract tests (mock mode): mobile `jest`, webapp, studio, seller, ads, admin `test:contracts` | All pass (115, 27, 5, 4, 8, 7) |
| `tsc --noEmit`: mobile, webapp, studio, ads, admin, apiSmoke | 0 errors |

apiSmoke failures, all environmental:

- The host disk is 99.3 % full (1.5 GB free). SeaweedFS refuses new volumes, so every S3 PUT returns 500. Media upload fails, and the social, commerce, money and Business-plan journeys stop at their first upload. Later steps fail as a result.
- Realtime (Phoenix, `ws://localhost:4000`) and the Python intelligence service are not part of the sandbox launcher. The live socket steps fail, and the event-flow check sees no consumer on `realtime-domain-events` and `intelligence-domain-events`.
- First calls to commerce, live and ads timed out (504) once, at cold start. They passed on the rerun.
- The launcher passed the wrong fake provider key, so coin purchases got 502. This is fixed in the launcher.

Afterwards the host services were stopped and `docker compose stop` was run. The betng-* containers were not touched.

## Fixed in this pass

- **Ads**: `duplicateCampaign`, `createAdSet` and `createAd` sent no `Idempotency-Key`, but go-ads requires one on those routes (400 `IDEMPOTENCY_KEY_REQUIRED`). They now send one: an optional parameter that defaults to a fresh key.
- **Admin staff sign-in**: the BFF followed `apiContract.md` (`/mfa/totp/enroll`, `/mfa/totp/confirm`, `mfaToken`, `admin`). The backend serves `/mfa/enroll/start`, `/mfa/enroll/confirm`, `challengeToken`, `status: mfa_required|mfa_enrollment_required` and `staff`. The BFF and the mock now follow the backend, and the contract doc is corrected. Step-up and verify no longer send `method` for TOTP, because unknown fields are rejected.
- **Cookie consent (webapp, studio)**: the banner posted to `POST /api/v1/consents`, which does not exist. Only `GET/PUT` exist; they are anonymous and need `deviceId`. The banner only syncs when signed in, so it now sends `PUT /api/v1/users/me/consents {policyVersion, consents}`.
- **Privacy export and deletion (mobile, webapp)**: both apps used paths the backend does not serve, and mobile's mock did not match its own service. Both now call:
  - `GET/POST /users/me/data-exports`. The latest export is mapped to the UI state; `failed` and `expired` show as no export.
  - `POST /users/me/deletion-request {confirm, reason}`.

  The mocks are updated.
- **Mobile checkout**: `initialize` sent `saveCard`, which the backend rejects. The saved-card path called `/payments/charge-saved-card`, which does not exist. It now initialises the payment and calls `POST /payments/saved-cards/charges {paymentReference, savedCardId}`. `requires_authentication` and `requires_checkout` map to `action_required`. "Save this card" does nothing until card setup (`/payments/saved-cards/setups`) is wired.
- **Webapp coin purchase**: dropped `channel`, which go-money rejects.
- **Contracts**: the mobile upload-intent `maximumSize` and the username-availability `message` are now optional. The backend does not send them, and the UI type already allowed that.
- **Sandbox launcher**: corrected the fake provider key.

## Open mismatches (need a decision or backend work)

- ~~**Ads invites**~~ fixed 2026-10-05: go-ads accepts `{email, role}` or `{username, role}` (a `username` that is an email address is looked up by email). Misses say "No Nantty user has that email. Ask them to sign up first, then invite them." The response carries the invitee's `username`, never their email; the pending-invites table shows `@username`.
- ~~**Theme preference**~~ fixed 2026-10-05: `profiles.theme` (`system` default, `light`, `dark`; migration `users/20261005022135_add_profile_theme`). `PATCH /users/me/preferences` takes `countryCode` and/or `theme`; `GET /users/me` returns `theme`.
- ~~**Webapp guest reads**~~ fixed 2026-10-05: `/lives/suggested`, `/users/suggested`, `/gifts`, `/lives/:id/comments` and `/users/:id` are no longer forwarded as anonymous reads. Guests see a sign-in prompt (`SignInRequiredState`) on the live list, live chat and gift tray instead of an error; the who-to-follow rail is hidden for guests; any page that passes its query error to `ErrorState` shows the prompt on a 401. Still open: `/videos` and `/trending` have no backend. `/topics`, `/mart/highlights` and `/creators/:id/subscription-plans` now have Go routes.
- **Seller dashboard**:
  - Business documents need the two-step upload: `/{kind}/upload-intents`, then `PUT /{kind}`.
  - ~~Customers have no create or update~~ fixed 2026-10-05 (store customer profiles in go-commerce).
  - ~~Payout onboarding path~~ fixed 2026-10-05: the dashboard calls `/payments/payout-onboarding/me/*` and `/payments/payout-fees`; the BFF forwards them (owner only).
  - `/seller/consents`, `/ads/consents` and `/admin/consents` have no backend.
- **Admin**:
  - Reserved usernames are `/admin/reserved-usernames` in the UI and contract, but `/admin/usernames/reserved` in the backend, with different bodies.
  - The backend has no withheld-usernames list and no confusables preview.
  - There is no `/admin/payouts/{id}/decide`; the backend has `GET /admin/withdrawals/{id}` and `POST /admin/withdrawals/{id}/review` instead.
  - Coin review and reverse exist at `/admin/coins/transactions/{id}/mark-reviewed` and `/reverse`; use those paths.
  - Ledger accounts, journal entries and reversals exist at `/admin/ledger/accounts`, `/journal-entries` and `/journal-entries/{id}/reversal`.
- **Studio**: pinning a live product (`POST /lives/:id/products`) and `/live-products` have no backend. There is no `GET /overlay-scenes` list; scenes exist per live.
- **Lists in the ads and admin contracts**: the contracts say `{items}`, but the backend sends `{data, nextCursor}`. `adaptListEnvelope` converts at the client boundary, so this works, but the contract text is out of date.

## Seller backend pass (2026-10-05)

56 seller calls that had no backend are now served, by whole domain, in the owning service (all behind the gateway, store member + permission from `rolePermissions.config.ts`, deny by default):

| Domain | Endpoints | Service / module | Notes |
| --- | --- | --- | --- |
| Store settings and storefront | `GET/PATCH /seller/settings`, `GET/PATCH /seller/storefront` | go-commerce `catalog/storeSettings` | Read-only keys rejected (strict decoding). Switching on automated alerts needs Pro (402). `storeRewards` is read from orders; the dashboard saves it through `PUT /seller/marketing/rewards/settings`. Featured products share the Marketing list. Delivery areas come from orders through a port. Audit + `store.updated` outbox event |
| Team and audit | `GET /seller/nantty-users`, `GET /seller/staff/candidates`, `GET/POST /seller/staff`, `PATCH/DELETE /seller/staff/:id`, `GET /seller/audit-log`; app side `GET /stores/team-requests`, `POST /stores/team-requests/:id/accept|decline` | go-commerce `catalog/storeTeam` | Staff are existing app users; invites stay `invited` until accepted in the app. Team is Pro; custom permissions are Business; seats per docs/plans.md (Pro 5, Business 25). OWNER_ONLY / OWNER_PROTECTED / CANNOT_EDIT_SELF rules. Suspension takes effect on the next request. People search returns public profile fields only. `store_audit_entries` table + `StoreAuditTrail` port for other modules |
| Wallet and payouts | `GET /seller/wallet/{balances,transactions,statements,payout-settings,payouts,payouts/schedule,banks,payout-accounts}`, `POST /seller/wallet/payouts` (Idempotency-Key), `PUT /seller/wallet/payouts/schedule`, `POST /seller/wallet/payout-accounts/resolve`, `POST/PATCH/DELETE /seller/wallet/payout-accounts[/:id]` | go-money `wallet/sellerMoney` (internal `/api/v1/internal/sellers/{ownerId}/...`), relayed by go-commerce `orders/sellerMoneyRelay` | Balances only from the ledger. Payout fee charged on top; reuses the existing withdrawal command (ledger, review, provider transfer). Two-step account lookup with a single-use 10-minute resolution (number stays encrypted server side). Scheduled payouts run in the wallet worker (key = schedule id + run date). Money writes are owner only and audit-logged |
| Finance | `GET /seller/finance/{summary,escrow,settlements,settlements/:id,fees,refunds,statements,statements/:month}` | same | Built from escrows (store scoped), withdrawals and ledger lines. Weekly settlements (Monday start, store timezone) |
| Dashboard and analytics | `GET /seller/dashboard`, `GET /seller/analytics/overview`, `GET /seller/analytics/breakdowns` (Pro) | go-commerce `orders/sellerInsights` | Ports: catalog counts and daily traffic (new `store_daily_traffics` / `product_daily_views` rollups fed by product interactions), inventory stock alerts, money balances and disputes. Analytics history clamped per plan (30/365/730 days) |
| Delivery areas | `GET/POST /seller/delivery/areas`, `PATCH/DELETE /seller/delivery/areas/:id` | go-commerce `orders/deliveryAreas` | Max 50; checkout fees still come from shipping rules |
| Customers | `POST /seller/customers`, `PATCH /seller/customers/:id`, `GET/POST /seller/customers/segments`, `PATCH/DELETE /seller/customers/segments/:id` (Pro) | go-commerce `orders/customers`, `orders/customerSegments` | Manual customers and overlays on app buyers; `409 CUSTOMER_EXISTS {customer}` on a duplicate phone or email. Four built-in segments + up to 20 custom |
| Marketing | `GET /seller/marketing/overview`, `GET /seller/marketing/product-options` | go-commerce `orders/marketingOverview`, `catalog/featuredProducts` | Flash sales and bundles appear only on Pro |

Migrations (ent + Atlas, `atlas.sum` rehashed by the generator): `catalog/20261005035531_add_store_settings_team_and_audit`, `catalog/20261005044212_add_store_daily_traffic`, `wallet/20261005041401_add_seller_payout_resolutions_and_schedules`, `orders/20261005043336_add_delivery_areas_customer_profiles_and_segments`. The wallet and orders diffs also include small pre-existing drift fixes that Atlas found (`monetisation_holds.restrictions` default; `checkout_open_expiry` index form; `order_groups.payment_mode` type).

Gateway: routes for every path above, plus account-scoped limits `sellerPeopleSearch` (30/min), `sellerTeamWrite` (30/min), `sellerMoneyWrite` (10/min).

Tests: Go integration tests per domain (catalog team/settings, wallet seller money and finance, orders delivery areas/customers/segments/dashboard/marketing, route registration), unit tests (validators, schedules, kind mapping, CSV neutralising, insights maths, relay), gateway route tests, seller mock contract tests (`apps/seller/src/contracts/sellerDomains.contract.ts`, 22 endpoints), and the apiSmoke journey `sellerDashboardJourney.smoke.test.ts`.

Live run (sandbox via `startSandboxStack.sh`, then `docker compose stop`): full apiSmoke 94 tests, 89 pass. After fixing literal route registration for the route sweep, the route sweep, the new seller journey, seller edge, commerce journey and frontend contracts pass (24/24). The 4 other failures are environmental: the realtime container could not install Hex, so live socket and event-flow consumer checks failed. The happy-path seller payout cannot run in smoke (credits stay pending for days and payout verification is asynchronous), so the journey checks clear refusals and the schedule; the paid path is covered by `wallet.sellerMoney_integration_test.go`.

## Flutterwave stage 1 changes (2026-10-10)

- `POST /api/v1/payments/saved-cards/charges` and `POST /api/v1/payments/subscriptions/checkout` require `Idempotency-Key`. The second has no frontend caller.
- Withdrawals, adding a payout account and `PUT /api/v1/payments/payout-onboarding/me/bank` require `X-Step-Up-Token` from `POST /api/v1/auth/step-up`.
- Coin purchases, boosts and earnings conversion price from the server by the verified country; `X-Client-Region` is display-only.
- Staff journal reversal (`POST /api/v1/admin/ledger/journal-entries/{entryId}/reversal`) returns 409 `JOURNAL_KIND_NOT_REVERSIBLE` for any entry a payment, escrow or wallet flow owns.

## Checks that passed in every app

- **Money**: every app's `Money` is `{amountMinor, currency}`, the same as `platform/money` and the service DTOs. No request sends major units.
- **Lists**: every matched list returns `{data, nextCursor}`, and the clients read it (`getPage`/`getList`, `sendListRequestToWebappServer`, `adaptListEnvelope`).
- **Error codes**: every code the UIs branch on exists in the backend. The exceptions are codes the BFFs create themselves (`SESSION_EXPIRED`, `SESSION_IDLE_TIMEOUT`, `CSRF_REJECTED`) and codes only mocks return: the seller trial mock's `ALREADY_USED_TRIAL`/`PRIOR_TRIAL` (the backend says `TRIAL_ALREADY_USED`) and the payout-onboarding mock codes. No UI branches on the mock-only codes.
- **Idempotency**: after the ads fix, every route that requires `Idempotency-Key` gets one from its caller.
- **Request bodies**: the DTO comparison flagged 26 calls. After review, the real mismatches are fixed or listed above. The rest were BFF-only fields (`next`) or misreads by the static extractor.

## Still mock-only (no backend route)

Grouped by area (the per-app tables have the full list):

- **Social and discovery**: topics (`/topics`, `/users/me/topics`), `/users/me/settings`, marketing preferences, channels, `/videos`, `/trending`, `/mart/highlights`, `/places/search`, store follow, brand detail, products, follow and create, `GET /battles/:id`, `/tips`, `/sitemap/*`.
- **Creator program**: dashboard, affiliations, earnings, revenue rules, subscription plans and subscriptions (`/creators/me/subscription-plans`, `/creator-subscriptions/*`), affiliated products, `/creators/me`.
- **Verification**: `/verification/plans`, `/verification/subscription/cancel`, and the payout-onboarding `document-link/complete` mock helper.
- **Seller dashboard**: still mocked are brands workspace, developers (API keys, webhooks), integrations and ads summary. Affiliates, conversations, security sessions, subscription details/verify/trial, verification, preferences and product import now have Go routes; `/seller/consents` still has no backend.
- **Ads Manager**: still mock-only are payment methods and `POST /creatives/preview`. Billing top-ups, top-up status, invoices, receipts, conversion events, experiments, automated rules, `/ads/locations` and `/ads/behaviours` now have go-ads routes.
- **Admin console**: metrics overview, own account (sessions, passkeys, recovery codes), appeals, orders, refunds, payouts, coins, ledger, catalog admin, brands and reserved usernames now have admin routes. Remaining gaps include automation, email-template preview, withheld-usernames/confusables preview and the `/admin/payouts/{id}/decide` path (use `/admin/withdrawals/{id}/review`).

## mobile

| Endpoint | Status | Fix / note |
| --- | --- | --- |
| `POST /api/v1/payments/initialize` | fixed | Fixed: dropped `saveCard` (backend rejects unknown fields). |
| `POST /api/v1/payments/saved-cards/charges` | fixed | Fixed: was `POST /payments/charge-saved-card {orderId}`; now initialize, then charge `{paymentReference, savedCardId}`. Requires `Idempotency-Key` since 2026-10-10 (400 `IDEMPOTENCY_KEY_REQUIRED`); mobile sends `{key}-card`. A replay or a second tap returns the current status (`processing` while pending) and never charges twice. |
| `GET /api/v1/users/me/data-exports` | fixed | Fixed: was `/privacy/exports/latest` (mock had a different POST path too). |
| `POST /api/v1/users/me/data-exports` | fixed | Fixed: was `POST /privacy/exports/latest`. |
| `POST /api/v1/users/me/deletion-request` | fixed | Fixed: was `POST /privacy/deletion {confirmation}`. |
| `POST /api/v1/users/me/media/upload-intents` | fixed | Fixed: contract and type mark `maximumSize` optional (backend does not send it). |
| `PATCH /api/v1/users/me/preferences` | fixed | Fixed 2026-10-05: backend accepts `{theme}` (and `{countryCode}`). |
| `GET /api/v1/battles/:p` | mock-only | No backend route. |
| `POST /api/v1/brands` | mock-only | Mock-only: backend lists brands, cannot create them. |
| `GET /api/v1/brands/:p` | mock-only | No backend route. |
| `DELETE /api/v1/brands/:p/follow` | mock-only | No backend route. |
| `POST /api/v1/brands/:p/follow` | mock-only | No backend route. |
| `GET /api/v1/brands/:p/products` | mock-only | No backend route. |
| `POST /api/v1/channels` | mock-only | No backend route. |
| `DELETE /api/v1/channels/:p/subscribe` | mock-only | No backend route. |
| `POST /api/v1/channels/:p/subscribe` | mock-only | No backend route. |
| `GET /api/v1/creator-subscriptions` | mock-only | No backend route. |
| `GET /api/v1/creator-subscriptions/:p` | mock-only | No backend route. |
| `POST /api/v1/creator-subscriptions/:p/cancel` | mock-only | No backend route. |
| `POST /api/v1/creator-subscriptions/:p/resume` | mock-only | No backend route. |
| `POST /api/v1/creator-subscriptions/verify` | mock-only | No backend route. |
| `GET /api/v1/creators/:p/subscription-plans` | mock-only | No backend route. |
| `POST /api/v1/creators/:p/subscriptions` | mock-only | No backend route. |
| `GET /api/v1/creators/affiliations` | mock-only | No backend route. |
| `POST /api/v1/creators/affiliations` | mock-only | No backend route. |
| `GET /api/v1/creators/dashboard` | mock-only | No backend route. |
| `GET /api/v1/creators/earnings` | mock-only | No backend route. |
| `GET /api/v1/creators/me` | mock-only | No backend route. |
| `GET /api/v1/creators/me/affiliated-products` | mock-only | No backend route. |
| `GET /api/v1/creators/me/subscribers` | mock-only | No backend route. |
| `GET /api/v1/creators/me/subscription-plans` | mock-only | No backend route. |
| `POST /api/v1/creators/me/subscription-plans` | mock-only | No backend route. |
| `PATCH /api/v1/creators/me/subscription-plans/:p` | mock-only | No backend route. |
| `GET /api/v1/creators/revenue-rules` | mock-only | No backend route. |
| `GET /api/v1/mart/highlights` | mock-only | No backend route. |
| `GET /api/v1/media` | mock-only | No backend route. |
| `GET /api/v1/payments` | mock-only | No backend route. |
| `POST /api/v1/payments/payout-onboarding/me/document-link/complete` | mock-only | No backend route. |
| `GET /api/v1/places/search` | mock-only | No backend route. |
| `POST /api/v1/security/human-verification` | mock-only | No backend route. |
| `POST /api/v1/seller/applications` | mock-only | No backend route. |
| `GET /api/v1/seller/applications/me` | mock-only | No backend route. |
| `GET /api/v1/seller/dashboard` | mock-only | No backend route. |
| `POST /api/v1/seller/orders/:p/ship` | mock-only | No backend route. |
| `DELETE /api/v1/stores/:p/follow` | mock-only | No backend route. |
| `POST /api/v1/stores/:p/follow` | mock-only | No backend route. |
| `POST /api/v1/tips` | mock-only | No backend route. |
| `GET /api/v1/topics` | mock-only | No backend route. |
| `GET /api/v1/users/:p/connections` | mock-only | No backend route. |
| `GET /api/v1/users/me/marketing-preferences` | mock-only | No backend route. |
| `PUT /api/v1/users/me/marketing-preferences` | mock-only | No backend route. |
| `GET /api/v1/users/me/settings` | mock-only | No backend route. |
| `PATCH /api/v1/users/me/settings` | mock-only | No backend route. |
| `GET /api/v1/users/me/topics` | mock-only | No backend route. |
| `PUT /api/v1/users/me/topics` | mock-only | No backend route. |
| `GET /api/v1/verification/plans` | mock-only | No backend route. |
| `POST /api/v1/verification/subscription/cancel` | mock-only | No backend route. |
| `GET /api/v1/account/status` | matches |  |
| `POST /api/v1/account/status/strikes/:p/appeal` | matches |  |
| `POST /api/v1/ads/boosts` | matches | Server prices in the verified country's currency (profile, then CDN country); `dailyBudget.currency` must match it or 422 `BOOST_CURRENCY_NOT_ALLOWED`. `X-Client-Region` is ignored. |
| `GET /api/v1/ads/boosts/:p` | matches |  |
| `POST /api/v1/ads/boosts/estimate` | matches |  |
| `GET /api/v1/ads/boosts/options` | matches | `currency` query and `X-Client-Region` no longer change the billing currency; it is the verified country's. |
| `POST /api/v1/ads/decide` | matches |  |
| `POST /api/v1/ads/events` | matches |  |
| `POST /api/v1/analytics/product-interactions` | matches |  |
| `GET /api/v1/auth/apple` | matches |  |
| `POST /api/v1/auth/google` | matches |  |
| `POST /api/v1/auth/login` | matches |  |
| `POST /api/v1/auth/logout` | matches |  |
| `POST /api/v1/auth/otp/send` | matches |  |
| `POST /api/v1/auth/otp/verify` | matches |  |
| `POST /api/v1/auth/password/change` | matches |  |
| `POST /api/v1/auth/password/reset` | matches |  |
| `POST /api/v1/auth/refresh` | matches |  |
| `POST /api/v1/auth/register` | matches |  |
| `GET /api/v1/auth/username-available` | matches |  |
| `GET /api/v1/auth/username-suggestion` | matches |  |
| `GET /api/v1/banks` | matches |  |
| `POST /api/v1/banks/resolve-account` | matches |  |
| `GET /api/v1/brands` | matches |  |
| `GET /api/v1/business-categories` | matches |  |
| `GET /api/v1/cart` | matches |  |
| `POST /api/v1/cart/items` | matches |  |
| `DELETE /api/v1/cart/items/:p` | matches |  |
| `PATCH /api/v1/cart/items/:p` | matches |  |
| `POST /api/v1/cart/shipping-quote` | matches |  |
| `GET /api/v1/categories` | matches |  |
| `GET /api/v1/chat/content` | matches |  |
| `GET /api/v1/chat/settings` | matches |  |
| `PATCH /api/v1/chat/settings` | matches |  |
| `POST /api/v1/chat/shares` | matches |  |
| `GET /api/v1/clips` | matches |  |
| `GET /api/v1/coins/balance` | matches |  |
| `POST /api/v1/coins/iap/receipts` | matches |  |
| `GET /api/v1/coins/packages` | matches |  |
| `POST /api/v1/coins/purchases` | matches | Price and currency come from the verified country (profile, then CDN country), never `X-Client-Region`. |
| `POST /api/v1/coins/purchases/:p/verify` | matches |  |
| `GET /api/v1/coins/transactions` | matches |  |
| `POST /api/v1/coins/transfers` | matches |  |
| `GET /api/v1/coins/transfers/quote` | matches |  |
| `DELETE /api/v1/comments/:p` | matches |  |
| `GET /api/v1/comments/:p` | matches |  |
| `DELETE /api/v1/comments/:p/like` | matches |  |
| `POST /api/v1/comments/:p/like` | matches |  |
| `GET /api/v1/comments/:p/replies` | matches |  |
| `GET /api/v1/comments/:p/thread` | matches |  |
| `GET /api/v1/conversations` | matches |  |
| `POST /api/v1/conversations` | matches |  |
| `DELETE /api/v1/conversations/:p` | matches |  |
| `GET /api/v1/conversations/:p` | matches |  |
| `PATCH /api/v1/conversations/:p` | matches |  |
| `POST /api/v1/conversations/:p/accept` | matches |  |
| `POST /api/v1/conversations/:p/admins` | matches |  |
| `DELETE /api/v1/conversations/:p/admins/:p` | matches |  |
| `POST /api/v1/conversations/:p/block` | matches |  |
| `POST /api/v1/conversations/:p/leave` | matches |  |
| `GET /api/v1/conversations/:p/members` | matches |  |
| `POST /api/v1/conversations/:p/members` | matches |  |
| `DELETE /api/v1/conversations/:p/members/:p` | matches |  |
| `GET /api/v1/conversations/:p/messages` | matches |  |
| `POST /api/v1/conversations/:p/messages` | matches |  |
| `PUT /api/v1/conversations/:p/mute` | matches |  |
| `POST /api/v1/conversations/:p/not-spam` | matches |  |
| `POST /api/v1/conversations/:p/read` | matches |  |
| `POST /api/v1/conversations/:p/restrict` | matches |  |
| `POST /api/v1/conversations/:p/streak/celebrated` | matches |  |
| `POST /api/v1/conversations/:p/streak/restore` | matches |  |
| `POST /api/v1/conversations/groups` | matches |  |
| `GET /api/v1/conversations/search` | matches |  |
| `POST /api/v1/copyright/claims` | matches |  |
| `POST /api/v1/copyright/claims/:p/counter-notices` | matches |  |
| `POST /api/v1/creators/applications` | matches |  |
| `GET /api/v1/creators/applications/me` | matches |  |
| `POST /api/v1/creators/earnings/convert` | matches | Converts into the verified country's currency; a different `currency` returns 422 `CURRENCY_NOT_ALLOWED`. |
| `GET /api/v1/creators/eligibility` | matches |  |
| `GET /api/v1/creators/me/analytics/gifts/streams/:p` | matches |  |
| `GET /api/v1/disputes` | matches |  |
| `GET /api/v1/disputes/:p` | matches |  |
| `POST /api/v1/disputes/:p/messages` | matches |  |
| `GET /api/v1/explore/categories` | matches |  |
| `GET /api/v1/explore/headlines` | matches |  |
| `GET /api/v1/explore/posts-for-you` | matches |  |
| `GET /api/v1/explore/trends` | matches |  |
| `GET /api/v1/explore/who-to-follow` | matches |  |
| `POST /api/v1/feeds/feedback` | matches |  |
| `GET /api/v1/feeds/following` | matches |  |
| `POST /api/v1/feeds/interactions/batch` | matches | 2026-10-10: batched view/dwell/watch/link_click/profile_click/follow, 1 to 50 events, signed-in only (gateway `required`, 60/min per account). Values are bounded (ms <= 3,600,000, watchFraction 0..1, loopCount <= 100); one bad value rejects the batch with 400, so clients clamp first. Returns `{ accepted, skipped }`; deleted or hidden posts are skipped. Views, watches, link and profile clicks count once per viewer per post per 10 minutes; a follow counts once per viewer per post and only if the follow exists. |
| `GET /api/v1/feeds/for-you` | matches |  |
| `GET /api/v1/feeds/suggested-clips` | matches |  |
| `POST /api/v1/follow-requests/:p/accept` | matches |  |
| `POST /api/v1/follow-requests/:p/reject` | matches |  |
| `GET /api/v1/geo/admin-areas/:p/cities` | matches |  |
| `GET /api/v1/geo/countries` | matches |  |
| `GET /api/v1/geo/countries/:p/regions` | matches |  |
| `GET /api/v1/geo/regions/:p/admin-areas` | matches |  |
| `GET /api/v1/gifts` | matches |  |
| `GET /api/v1/help/categories` | matches |  |
| `GET /api/v1/help/categories/:p` | matches |  |
| `GET /api/v1/help/topics` | matches |  |
| `GET /api/v1/help/topics/:p` | matches |  |
| `POST /api/v1/help/topics/:p/votes` | matches |  |
| `GET /api/v1/legal/policy-versions/current` | matches |  |
| `GET /api/v1/link-previews/resolve` | matches |  |
| `POST /api/v1/live-safety/:p/appeal` | matches |  |
| `POST /api/v1/live/gifts` | matches |  |
| `GET /api/v1/lives` | matches |  |
| `POST /api/v1/lives` | matches |  |
| `GET /api/v1/lives/:p` | matches |  |
| `GET /api/v1/lives/:p/comments` | matches |  |
| `POST /api/v1/lives/:p/comments` | matches |  |
| `POST /api/v1/lives/:p/end` | matches |  |
| `POST /api/v1/lives/:p/heartbeat` | matches | host lease, 60 s timeout; added 2026-10-11 |
| `POST /api/v1/lives/:p/engagement` | matches |  |
| `GET /api/v1/lives/:p/gift-goals` | matches |  |
| `POST /api/v1/lives/:p/gift-goals` | matches |  |
| `PATCH /api/v1/lives/:p/gift-goals/:p` | matches |  |
| `POST /api/v1/lives/:p/join` | matches |  |
| `GET /api/v1/lives/:p/leaderboard` | matches |  |
| `POST /api/v1/lives/:p/leave` | matches |  |
| `POST /api/v1/lives/:p/pins` | matches |  |
| `GET /api/v1/lives/:p/points/me` | matches |  |
| `POST /api/v1/lives/:p/reactions` | matches |  |
| `GET /api/v1/lives/:p/safety` | matches |  |
| `POST /api/v1/lives/:p/share` | matches |  |
| `POST /api/v1/lives/:p/stream-key` | matches |  |
| `GET /api/v1/lives/suggested` | matches |  |
| `GET /api/v1/locale` | matches |  |
| `GET /api/v1/locale/countries` | matches |  |
| `GET /api/v1/mart/home` | matches |  |
| `GET /api/v1/me/content-preferences` | matches |  |
| `PUT /api/v1/me/content-preferences` | matches |  |
| `GET /api/v1/me/download-settings` | matches |  |
| `PUT /api/v1/me/download-settings` | matches |  |
| `GET /api/v1/media/:p` | matches |  |
| `POST /api/v1/media/uploads` | matches |  |
| `DELETE /api/v1/media/uploads/:p` | matches |  |
| `GET /api/v1/media/uploads/:p` | matches |  |
| `PUT /api/v1/media/uploads/:p/chunks/:p` | matches |  |
| `GET /api/v1/media/uploads/:p/chunks/:p/url` | matches |  |
| `POST /api/v1/media/uploads/:p/chunks/urls` | matches |  |
| `POST /api/v1/media/uploads/:p/complete` | matches |  |
| `GET /api/v1/mentions/candidates` | matches |  |
| `POST /api/v1/mentions/resolve` | matches |  |
| `POST /api/v1/messages/:p/live-location/stop` | matches |  |
| `PATCH /api/v1/messages/:p/location` | matches |  |
| `POST /api/v1/messages/:p/poll-votes` | matches |  |
| `POST /api/v1/messages/:p/reactions` | matches |  |
| `DELETE /api/v1/messages/:p/reactions/:p` | matches |  |
| `GET /api/v1/notifications` | matches |  |
| `POST /api/v1/notifications/:p/read` | matches |  |
| `GET /api/v1/notifications/preferences` | matches |  |
| `PATCH /api/v1/notifications/preferences` | matches |  |
| `POST /api/v1/notifications/read-all` | matches |  |
| `GET /api/v1/orders` | matches |  |
| `GET /api/v1/orders/:p` | matches |  |
| `POST /api/v1/orders/:p/confirm-receipt` | matches |  |
| `POST /api/v1/orders/:p/disputes` | matches |  |
| `GET /api/v1/orders/:p/escrow` | matches |  |
| `POST /api/v1/orders/checkout` | matches |  |
| `GET /api/v1/payments/channels` | matches |  |
| `POST /api/v1/payments/orders/:p/verify` | matches |  |
| `GET /api/v1/payments/payout-fees` | matches |  |
| `GET /api/v1/payments/payout-onboarding/me` | matches |  |
| `PUT /api/v1/payments/payout-onboarding/me/bank` | matches |  |
| `PUT /api/v1/payments/payout-onboarding/me/business` | matches |  |
| `PUT /api/v1/payments/payout-onboarding/me/identity` | matches |  |
| `POST /api/v1/payments/payout-onboarding/me/retry` | matches |  |
| `POST /api/v1/posts` | matches | 2026-10-10: optional `quotedPostId` (uuid or null). A Nantty post link in `text` becomes a quote server-side; a trailing link is stripped; `null` keeps the link as text. Errors: 422 `QUOTED_POST_UNAVAILABLE`, 422 `QUOTE_REQUIRES_POST`. |
| `GET /api/v1/posts/:p` | matches |  |
| `GET /api/v1/posts/:p/analytics` | matches | 2026-10-10: adds `kind`, `hasLink`, and `video.averageWatchSeconds`, `video.completedViews`, `video.completionRate`. Non-owners get 403 `NOT_POST_OWNER` (owner includes a profile the viewer can post as). |
| `GET /api/v1/posts/:p/comments` | matches | 2026-10-10: ranked (pinned, author, author-joined, engagement plus recency) with an opaque snapshot cursor (string, max 300); 400 `CURSOR_EXPIRED` after 6 h. `previewReplies` is the conversation chain (max 3). Comments carry `isPostAuthor`, `quotedPost`, `quotedPostUnavailable`. 2026-10-11: items are typed; comments carry `type: "comment"` and quote posts of this post appear as `type: "quote"` items (`id`, `postId`, `quotePost` summary, `likes`, `commentCount`, `isPostAuthor`, `createdAt`) ranked in the same snapshot (after pinned and author items). `filter=quotes` returns only quote items, newest first, with a uuid cursor. Visibility (blocked, private, followers-only, subscriber-only, deleted, hidden) is applied per page. |
| `POST /api/v1/posts/:p/comments` | matches | 2026-10-10: optional `quotedPostId` (uuid or null), same rules as posts. |
| `DELETE /api/v1/posts/:p/like` | matches |  |
| `POST /api/v1/posts/:p/like` | matches |  |
| `POST /api/v1/posts/:p/link-preview` | matches |  |
| `POST /api/v1/posts/:p/media/:p/download` | matches |  |
| `GET /api/v1/posts/:p/quotes` | matches |  |
| `PATCH /api/v1/posts/:p/reply-settings` | matches |  |
| `POST /api/v1/posts/:p/repost` | matches | 2026-10-11: posts now carry viewer `reposted` (true when the viewer has a plain repost of the original). Quoting from the apps opens the full composer and sends `quotedPostId` on `POST /api/v1/posts`. |
| `DELETE /api/v1/posts/:p/repost` | matches | 2026-10-11: new. Undoes the viewer's plain repost of the post (or of its original); idempotent 204. Quotes are not touched. |
| `PATCH /api/v1/posts/:p/sensitivity` | matches |  |
| `POST /api/v1/posts/:p/share` | matches |  |
| `GET /api/v1/posts/:p/tagged-users` | matches |  |
| `GET /api/v1/posts/:p/thread` | matches | 2026-10-10: `sort=relevant` (and `top`) uses the ranked snapshot cursor and returns each root with its chain as nested `inlineReplies`. 2026-10-11: with `sort=relevant` quote items (`type: "quote"`) are ranked in alongside replies; `latest`/`likes` stay replies-only; `filter=quotes` as on `/comments`. |
| `GET /api/v1/products` | matches |  |
| `GET /api/v1/products/:p` | matches |  |
| `DELETE /api/v1/products/:p/like` | matches |  |
| `POST /api/v1/products/:p/like` | matches |  |
| `GET /api/v1/products/:p/reviews` | matches |  |
| `POST /api/v1/products/:p/reviews` | matches |  |
| `GET /api/v1/products/featured` | matches |  |
| `GET /api/v1/rankings` | matches | No client caller since the Rankings page was removed (2026-10-10); kept for future use. The live header reads `hostRanking` from `GET /api/v1/lives/{liveId}` instead. |
| `POST /api/v1/reports` | matches |  |
| `GET /api/v1/reports/me` | matches |  |
| `DELETE /api/v1/saves` | matches |  |
| `GET /api/v1/saves` | matches |  |
| `POST /api/v1/saves` | matches |  |
| `GET /api/v1/search` | matches |  |
| `GET /api/v1/search/people` | matches |  |
| `DELETE /api/v1/search/recent` | matches |  |
| `GET /api/v1/search/recent` | matches |  |
| `POST /api/v1/search/recent` | matches |  |
| `DELETE /api/v1/search/recent/:p` | matches |  |
| `GET /api/v1/seller/business-documents` | matches |  |
| `PUT /api/v1/seller/business-documents/:p` | matches |  |
| `GET /api/v1/seller/orders` | matches |  |
| `GET /api/v1/seller/orders/:p` | matches |  |
| `GET /api/v1/seller/products` | matches |  |
| `POST /api/v1/seller/products` | matches |  |
| `DELETE /api/v1/seller/products/:p` | matches |  |
| `GET /api/v1/seller/products/:p` | matches |  |
| `PATCH /api/v1/seller/products/:p` | matches |  |
| `GET /api/v1/sounds` | matches |  |
| `GET /api/v1/sounds/:p` | matches |  |
| `PATCH /api/v1/sounds/:p` | matches |  |
| `GET /api/v1/sounds/:p/clips` | matches |  |
| `DELETE /api/v1/sounds/:p/save` | matches |  |
| `POST /api/v1/sounds/:p/save` | matches |  |
| `GET /api/v1/sounds/saved` | matches |  |
| `GET /api/v1/sounds/trending` | matches |  |
| `GET /api/v1/store-rewards/me` | matches |  |
| `GET /api/v1/stores/:p` | matches |  |
| `GET /api/v1/stores/:p/products` | matches |  |
| `POST /api/v1/stories` | matches |  |
| `POST /api/v1/stories/:p/replies` | matches |  |
| `POST /api/v1/stories/:p/seen` | matches |  |
| `GET /api/v1/stories/tray` | matches |  |
| `GET /api/v1/support/tickets` | matches |  |
| `POST /api/v1/support/tickets` | matches |  |
| `GET /api/v1/support/tickets/:p` | matches |  |
| `POST /api/v1/support/tickets/:p/messages` | matches |  |
| `POST /api/v1/support/tickets/:p/rating` | matches |  |
| `POST /api/v1/support/tickets/:p/read` | matches |  |
| `GET /api/v1/support/tickets/unread-count` | matches |  |
| `GET /api/v1/tags/candidates` | matches |  |
| `GET /api/v1/users/:p` | matches |  |
| `DELETE /api/v1/users/:p/block` | matches |  |
| `POST /api/v1/users/:p/block` | matches |  |
| `DELETE /api/v1/users/:p/follow` | matches |  |
| `POST /api/v1/users/:p/follow` | matches |  |
| `GET /api/v1/users/:p/followers` | matches |  |
| `GET /api/v1/users/:p/following` | matches |  |
| `GET /api/v1/users/:p/follow-status` | matches | Adds `viewerPostNotifications` (`off`, `posts`, `posts_and_lives`). |
| `GET /api/v1/users/:p/post-notifications` | matches | `{level, following}`. Signed-in only. |
| `PUT /api/v1/users/:p/post-notifications` | matches | Body `{level}`, Idempotency-Key. 409 `NOT_FOLLOWING` without an accepted follow, 403 `POST_NOTIFICATIONS_NOT_ALLOWED` when either side blocked, 422 `CANNOT_SUBSCRIBE_TO_SELF`. Unfollowing deletes the level. |
| `GET /api/v1/users/:p/posts` | matches |  |
| `GET /api/v1/users/:p/stories` | matches |  |
| `GET /api/v1/users/by-username/:p` | matches |  |
| `GET /api/v1/users/me` | matches |  |
| `PATCH /api/v1/users/me` | matches |  |
| `GET /api/v1/users/me/acting-profile` | matches |  |
| `PUT /api/v1/users/me/acting-profile` | matches |  |
| `GET /api/v1/users/me/addresses` | matches |  |
| `POST /api/v1/users/me/addresses` | matches |  |
| `DELETE /api/v1/users/me/addresses/:p` | matches |  |
| `PATCH /api/v1/users/me/addresses/:p` | matches |  |
| `GET /api/v1/users/me/blocked` | matches |  |
| `POST /api/v1/users/me/business-profiles` | matches |  |
| `GET /api/v1/users/me/celebrations` | matches |  |
| `POST /api/v1/users/me/celebrations/seen` | matches |  |
| `PATCH /api/v1/users/me/celebrations/settings` | matches |  |
| `GET /api/v1/users/me/consents` | matches |  |
| `PUT /api/v1/users/me/consents` | matches |  |
| `POST /api/v1/users/me/deactivate` | matches |  |
| `GET /api/v1/users/me/follow-requests` | matches |  |
| `GET /api/v1/users/me/media/upload-intents` | matches |  |
| `GET /api/v1/users/me/mention-privacy` | matches |  |
| `PUT /api/v1/users/me/mention-privacy` | matches |  |
| `GET /api/v1/users/me/policy-acceptances` | matches |  |
| `GET /api/v1/users/me/profiles` | matches |  |
| `GET /api/v1/users/me/suspension` | matches |  |
| `PATCH /api/v1/users/me/username` | matches |  |
| `GET /api/v1/users/me/username-policy` | matches |  |
| `POST /api/v1/verification/applications` | matches |  |
| `POST /api/v1/verification/cases/:p/capture` | matches |  |
| `GET /api/v1/verification/document-types` | matches |  |
| `POST /api/v1/verification/eligibility/request` | matches |  |
| `GET /api/v1/verification/journey` | matches |  |
| `GET /api/v1/verification/me` | matches |  |
| `GET /api/v1/verification/suggestions` | matches |  |
| `POST /api/v1/verification/suggestions/:p/dismiss` | matches |  |
| `GET /api/v1/wallets/me` | matches |  |
| `GET /api/v1/wallets/me/escrow-holds` | matches |  |
| `GET /api/v1/wallets/me/payout-accounts` | matches |  |
| `POST /api/v1/wallets/me/payout-accounts` | matches |  |
| `DELETE /api/v1/wallets/me/payout-accounts/:p` | matches |  |
| `GET /api/v1/wallets/me/transactions` | matches |  |
| `POST /api/v1/wallets/me/withdrawals` | matches | Requires `Idempotency-Key` and `X-Step-Up-Token` (from `POST /api/v1/auth/step-up`, 5 minutes); 403 `STEP_UP_REQUIRED` otherwise. |

## webapp

| Endpoint | Status | Fix / note |
| --- | --- | --- |
| `POST /api/v1/coins/purchases` | fixed | Fixed: dropped `channel` (backend rejects unknown fields). |
| `PUT /api/v1/users/me/consents` | fixed | Fixed: cookie banner sent `POST /consents` (no such route); now `PUT /users/me/consents {policyVersion, consents}`. |
| `GET /api/v1/users/me/data-exports` | fixed | Fixed: was `/users/me/data-export`; maps the list to the latest export. |
| `POST /api/v1/users/me/data-exports` | fixed | Fixed: was `/users/me/data-export`. |
| `POST /api/v1/users/me/deletion-request` | fixed | Fixed: was `POST /users/me/deletion {confirmation}`; now `{confirm, reason}`. |
| `PATCH /api/v1/users/me/preferences` | fixed | Fixed 2026-10-05: backend accepts `{theme}` (and `{countryCode}`). |
| `GET /api/v1/creators/:p/subscription-plans` | mock-only | No backend route. |
| `POST /api/v1/creators/:p/subscriptions` | mock-only | No backend route. |
| `GET /api/v1/creators/dashboard` | mock-only | No backend route. |
| `GET /api/v1/mart/highlights` | mock-only | No backend route. |
| `POST /api/v1/security/human-verification` | mock-only | No backend route. |
| `GET /api/v1/sitemap/:p` | mock-only | No backend route. |
| `DELETE /api/v1/stores/:p/follow` | mock-only | No backend route. |
| `POST /api/v1/stores/:p/follow` | mock-only | No backend route. |
| `GET /api/v1/trending` | mock-only | No backend route. |
| `GET /api/v1/users/me/email` | mock-only | No backend route. |
| `POST /api/v1/users/me/email/verification` | mock-only | No backend route. |
| `POST /api/v1/users/me/email/verification/confirm` | mock-only | No backend route. |
| `GET /api/v1/users/me/settings` | mock-only | No backend route. |
| `PATCH /api/v1/users/me/settings` | mock-only | No backend route. |
| `GET /api/v1/users/me/topics` | mock-only | No backend route. |
| `PUT /api/v1/users/me/topics` | mock-only | No backend route. |
| `GET /api/v1/users/suggested` | mock-only | No backend route. |
| `GET /api/v1/videos` | mock-only | No backend route. |
| `GET /api/v1/videos/:p` | mock-only | No backend route. |
| `GET /api/v1/account/status` | matches |  |
| `POST /api/v1/account/status/strikes/:p/appeal` | matches |  |
| `POST /api/v1/ads/decide` | matches |  |
| `POST /api/v1/ads/events` | matches |  |
| `GET /api/v1/auth/apple` | matches |  |
| `GET /api/v1/auth/google` | matches |  |
| `GET /api/v1/auth/login` | matches |  |
| `POST /api/v1/auth/logout` | matches |  |
| `POST /api/v1/auth/otp/send` | matches |  |
| `POST /api/v1/auth/otp/verify` | matches |  |
| `POST /api/v1/auth/password/change` | matches |  |
| `POST /api/v1/auth/password/reset` | matches |  |
| `POST /api/v1/auth/refresh` | matches |  |
| `GET /api/v1/auth/register` | matches |  |
| `GET /api/v1/auth/username-available` | matches |  |
| `GET /api/v1/auth/username-suggestion` | matches |  |
| `GET /api/v1/cart` | matches |  |
| `POST /api/v1/cart/items` | matches |  |
| `DELETE /api/v1/cart/items/:p` | matches |  |
| `PATCH /api/v1/cart/items/:p` | matches |  |
| `POST /api/v1/cart/shipping-quote` | matches |  |
| `GET /api/v1/categories` | matches |  |
| `POST /api/v1/chat/shares` | matches |  |
| `GET /api/v1/clips` | matches |  |
| `GET /api/v1/coins/balance` | matches |  |
| `GET /api/v1/coins/packages` | matches |  |
| `POST /api/v1/coins/purchases/:p/verify` | matches |  |
| `DELETE /api/v1/comments/:p` | matches |  |
| `DELETE /api/v1/comments/:p/like` | matches |  |
| `POST /api/v1/comments/:p/like` | matches |  |
| `GET /api/v1/comments/:p/replies` | matches |  |
| `GET /api/v1/comments/:p/thread` | matches |  |
| `GET /api/v1/conversations` | matches |  |
| `POST /api/v1/conversations` | matches |  |
| `GET /api/v1/conversations/:p` | matches |  |
| `POST /api/v1/conversations/:p/block` | matches |  |
| `GET /api/v1/conversations/:p/messages` | matches |  |
| `POST /api/v1/conversations/:p/messages` | matches |  |
| `POST /api/v1/conversations/:p/read` | matches |  |
| `POST /api/v1/conversations/:p/restrict` | matches |  |
| `GET /api/v1/conversations/search` | matches |  |
| `POST /api/v1/copyright/claims` | matches |  |
| `POST /api/v1/copyright/claims/:p/counter-notices` | matches |  |
| `GET /api/v1/explore/categories` | matches |  |
| `GET /api/v1/explore/headlines` | matches |  |
| `GET /api/v1/explore/posts-for-you` | matches |  |
| `GET /api/v1/explore/trends` | matches |  |
| `GET /api/v1/explore/who-to-follow` | matches |  |
| `GET /api/v1/feeds/following` | matches |  |
| `POST /api/v1/feeds/interactions/batch` | matches | 2026-10-10: batched view/dwell/watch/link_click/profile_click/follow, 1 to 50 events, signed-in only (gateway `required`, 60/min per account). Values are bounded (ms <= 3,600,000, watchFraction 0..1, loopCount <= 100); one bad value rejects the batch with 400, so clients clamp first. Returns `{ accepted, skipped }`; deleted or hidden posts are skipped. Views, watches, link and profile clicks count once per viewer per post per 10 minutes; a follow counts once per viewer per post and only if the follow exists. |
| `GET /api/v1/feeds/for-you` | matches |  |
| `GET /api/v1/feeds/popular` | matches |  |
| `GET /api/v1/feeds/suggested-clips` | matches |  |
| `GET /api/v1/geo/admin-areas/:p/cities` | matches |  |
| `GET /api/v1/geo/countries` | matches |  |
| `GET /api/v1/geo/countries/:p/regions` | matches |  |
| `GET /api/v1/geo/regions/:p/admin-areas` | matches |  |
| `GET /api/v1/gifts` | matches | Guest read in webapp, but gateway and service require auth. |
| `GET /api/v1/help/categories` | matches |  |
| `GET /api/v1/help/categories/:p` | matches |  |
| `GET /api/v1/help/topics` | matches |  |
| `GET /api/v1/help/topics/:p` | matches |  |
| `POST /api/v1/help/topics/:p/votes` | matches |  |
| `GET /api/v1/legal/policy-versions/current` | matches |  |
| `POST /api/v1/live-safety/:p/appeal` | matches |  |
| `GET /api/v1/lives/:p` | matches |  |
| `GET /api/v1/lives/:p/comments` | matches | Guest read in webapp, but gateway and service require auth. |
| `POST /api/v1/lives/:p/comments` | matches |  |
| `POST /api/v1/lives/:p/gifts` | matches |  |
| `GET /api/v1/lives/:p/safety` | matches |  |
| `GET /api/v1/lives/suggested` | matches | Guest read in webapp, but gateway and service require auth. |
| `GET /api/v1/locale/countries` | matches |  |
| `GET /api/v1/mart/home` | matches |  |
| `GET /api/v1/me/content-preferences` | matches |  |
| `PUT /api/v1/me/content-preferences` | matches |  |
| `GET /api/v1/me/download-settings` | matches |  |
| `PUT /api/v1/me/download-settings` | matches |  |
| `GET /api/v1/mentions/candidates` | matches |  |
| `POST /api/v1/mentions/resolve` | matches |  |
| `GET /api/v1/notifications` | matches |  |
| `POST /api/v1/notifications/:p/read` | matches |  |
| `GET /api/v1/notifications/preferences` | matches |  |
| `PATCH /api/v1/notifications/preferences` | matches |  |
| `POST /api/v1/notifications/read-all` | matches |  |
| `GET /api/v1/orders` | matches |  |
| `GET /api/v1/orders/:p` | matches |  |
| `POST /api/v1/orders/:p/confirm-receipt` | matches |  |
| `POST /api/v1/orders/checkout` | matches |  |
| `GET /api/v1/payments/channels` | matches |  |
| `POST /api/v1/payments/initialize` | matches |  |
| `POST /api/v1/payments/orders/:p/verify` | matches |  |
| `GET /api/v1/posts/:p` | matches |  |
| `GET /api/v1/posts/:p/analytics` | matches | 2026-10-10: adds `kind`, `hasLink`, and `video.averageWatchSeconds`, `video.completedViews`, `video.completionRate`. Non-owners get 403 `NOT_POST_OWNER` (owner includes a profile the viewer can post as). |
| `GET /api/v1/posts/:p/comments` | matches | 2026-10-10: ranked (pinned, author, author-joined, engagement plus recency) with an opaque snapshot cursor (string, max 300); 400 `CURSOR_EXPIRED` after 6 h. `previewReplies` is the conversation chain (max 3). Comments carry `isPostAuthor`, `quotedPost`, `quotedPostUnavailable`. 2026-10-11: items are typed; comments carry `type: "comment"` and quote posts of this post appear as `type: "quote"` items (`id`, `postId`, `quotePost` summary, `likes`, `commentCount`, `isPostAuthor`, `createdAt`) ranked in the same snapshot (after pinned and author items). `filter=quotes` returns only quote items, newest first, with a uuid cursor. Visibility (blocked, private, followers-only, subscriber-only, deleted, hidden) is applied per page. |
| `POST /api/v1/posts/:p/comments` | matches | 2026-10-10: optional `quotedPostId` (uuid or null), same rules as posts. |
| `DELETE /api/v1/posts/:p/like` | matches |  |
| `POST /api/v1/posts/:p/like` | matches |  |
| `POST /api/v1/posts/:p/link-preview` | matches |  |
| `POST /api/v1/posts/:p/media/:p/download` | matches |  |
| `GET /api/v1/posts/:p/quotes` | matches |  |
| `PATCH /api/v1/posts/:p/reply-settings` | matches |  |
| `POST /api/v1/posts/:p/repost` | matches | 2026-10-11: posts now carry viewer `reposted` (true when the viewer has a plain repost of the original). Quoting from the apps opens the full composer and sends `quotedPostId` on `POST /api/v1/posts`. |
| `DELETE /api/v1/posts/:p/repost` | matches | 2026-10-11: new. Undoes the viewer's plain repost of the post (or of its original); idempotent 204. Quotes are not touched. |
| `POST /api/v1/posts/:p/share` | matches |  |
| `GET /api/v1/posts/:p/tagged-users` | matches |  |
| `GET /api/v1/posts/:p/thread` | matches | 2026-10-10: `sort=relevant` (and `top`) uses the ranked snapshot cursor and returns each root with its chain as nested `inlineReplies`. 2026-10-11: with `sort=relevant` quote items (`type: "quote"`) are ranked in alongside replies; `latest`/`likes` stay replies-only; `filter=quotes` as on `/comments`. |
| `GET /api/v1/products` | matches |  |
| `GET /api/v1/products/:p` | matches |  |
| `POST /api/v1/products/:p/bookmark` | matches |  |
| `DELETE /api/v1/products/:p/like` | matches |  |
| `POST /api/v1/products/:p/like` | matches |  |
| `GET /api/v1/products/featured` | matches |  |
| `POST /api/v1/reports` | matches |  |
| `GET /api/v1/reports/me` | matches |  |
| `DELETE /api/v1/saves` | matches |  |
| `GET /api/v1/saves` | matches |  |
| `POST /api/v1/saves` | matches |  |
| `PATCH /api/v1/saves/:p` | matches |  |
| `GET /api/v1/saves/collections` | matches |  |
| `POST /api/v1/saves/collections` | matches |  |
| `GET /api/v1/search` | matches |  |
| `GET /api/v1/search/people` | matches |  |
| `DELETE /api/v1/search/recent` | matches |  |
| `GET /api/v1/search/recent` | matches |  |
| `POST /api/v1/search/recent` | matches |  |
| `DELETE /api/v1/search/recent/:p` | matches |  |
| `GET /api/v1/store-rewards/me` | matches |  |
| `GET /api/v1/stores/:p` | matches |  |
| `GET /api/v1/stores/:p/products` | matches |  |
| `GET /api/v1/subscriptions/:p` | matches |  |
| `POST /api/v1/subscriptions/checkout` | matches |  |
| `GET /api/v1/support/tickets` | matches |  |
| `POST /api/v1/support/tickets` | matches |  |
| `GET /api/v1/support/tickets/:p` | matches |  |
| `GET /api/v1/support/tickets/unread-count` | matches |  |
| `GET /api/v1/users/:p` | matches |  |
| `DELETE /api/v1/users/:p/block` | matches |  |
| `POST /api/v1/users/:p/block` | matches |  |
| `DELETE /api/v1/users/:p/follow` | matches |  |
| `POST /api/v1/users/:p/follow` | matches |  |
| `GET /api/v1/users/:p/posts` | matches |  |
| `GET /api/v1/users/by-username/:p` | matches |  |
| `GET /api/v1/users/me` | matches |  |
| `PATCH /api/v1/users/me` | matches |  |
| `GET /api/v1/users/me/addresses` | matches |  |
| `POST /api/v1/users/me/addresses` | matches |  |
| `DELETE /api/v1/users/me/addresses/:p` | matches |  |
| `PATCH /api/v1/users/me/addresses/:p` | matches |  |
| `GET /api/v1/users/me/celebrations` | matches |  |
| `POST /api/v1/users/me/celebrations/seen` | matches |  |
| `PATCH /api/v1/users/me/celebrations/settings` | matches |  |
| `GET /api/v1/users/me/consents` | matches |  |
| `POST /api/v1/users/me/deactivate` | matches |  |
| `GET /api/v1/users/me/mention-privacy` | matches |  |
| `PUT /api/v1/users/me/mention-privacy` | matches |  |
| `GET /api/v1/users/me/policy-acceptances` | matches |  |
| `PATCH /api/v1/users/me/username` | matches |  |
| `GET /api/v1/users/me/username-policy` | matches |  |
| `POST /api/v1/verification/cases/:p/capture` | matches |  |
| `GET /api/v1/verification/document-types` | matches |  |
| `POST /api/v1/verification/eligibility/request` | matches |  |
| `GET /api/v1/verification/journey` | matches |  |
| `GET /api/v1/wallets/me` | matches |  |

## studio

| Endpoint | Status | Fix / note |
| --- | --- | --- |
| `PUT /api/v1/users/me/consents` | fixed | Fixed: same as webapp. |
| `POST /api/v1/lives/:p/products` | mismatch | Open: backend only lists live products; pinning is not built. |
| `PATCH /api/v1/users/me/preferences` | fixed | Fixed 2026-10-05: backend accepts `{theme}`. |
| `GET /api/v1/live-products` | mock-only | No backend route. |
| `POST /api/v1/payments/payout-onboarding/me/document-link/complete` | mock-only | No backend route. |
| `GET /api/v1/account/status` | matches |  |
| `GET /api/v1/auth/apple` | matches |  |
| `GET /api/v1/auth/google` | matches |  |
| `GET /api/v1/auth/login` | matches |  |
| `POST /api/v1/auth/logout` | matches |  |
| `POST /api/v1/auth/otp/send` | matches |  |
| `POST /api/v1/auth/otp/verify` | matches |  |
| `POST /api/v1/auth/password/reset` | matches |  |
| `POST /api/v1/auth/refresh` | matches |  |
| `GET /api/v1/auth/username-available` | matches |  |
| `GET /api/v1/auth/username-suggestion` | matches |  |
| `GET /api/v1/banks` | matches |  |
| `POST /api/v1/live-safety/:p/appeal` | matches |  |
| `GET /api/v1/lives` | matches |  |
| `POST /api/v1/lives` | matches |  |
| `GET /api/v1/lives/:p` | matches |  |
| `GET /api/v1/lives/:p/comments` | matches |  |
| `POST /api/v1/lives/:p/comments` | matches |  |
| `POST /api/v1/lives/:p/end` | matches |  |
| `GET /api/v1/lives/:p/overlays` | matches |  |
| `PUT /api/v1/lives/:p/overlays` | matches |  |
| `GET /api/v1/lives/:p/products` | matches |  |
| `GET /api/v1/lives/:p/safety` | matches |  |
| `GET /api/v1/lives/:p/stage` | matches |  |
| `POST /api/v1/lives/:p/start` | matches |  |
| `POST /api/v1/lives/:p/stream-key` | matches |  |
| `GET /api/v1/overlay-scenes/:p` | matches |  |
| `GET /api/v1/payments/payout-fees` | matches |  |
| `GET /api/v1/payments/payout-onboarding/me` | matches |  |
| `PUT /api/v1/payments/payout-onboarding/me/bank` | matches |  |
| `PUT /api/v1/payments/payout-onboarding/me/business` | matches |  |
| `PUT /api/v1/payments/payout-onboarding/me/identity` | matches |  |
| `POST /api/v1/payments/payout-onboarding/me/resolve` | matches |  |
| `POST /api/v1/payments/payout-onboarding/me/retry` | matches |  |
| `POST /api/v1/reports` | matches |  |
| `GET /api/v1/users/me` | matches |  |

## seller

| Endpoint | Status | Fix / note |
| --- | --- | --- |
| `POST /api/v1/seller/business-documents/:p` | mismatch | Open: backend is `POST /{kind}/upload-intents` then `PUT /{kind} {documentId, fileUrl}`; dashboard posts file metadata. |
| `POST /api/v1/seller/customers` | fixed | Backed 2026-10-05 (seller domains pass). |
| `PATCH /api/v1/seller/customers/:p` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/ads/summary` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/affiliates/commission-ledger` | fixed | Backed by a Go route since 2026-10-21. |
| `GET /api/v1/seller/affiliates/creator-directory` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/affiliates/creators` | fixed | Backed by a Go route since 2026-10-21. |
| `DELETE /api/v1/seller/affiliates/creators/:p` | fixed | Backed by a Go route since 2026-10-21. |
| `GET /api/v1/seller/affiliates/live-invitations` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/affiliates/live-invitations` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/affiliates/live-invitations/:p/cancel` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/affiliates/overview` | fixed | Backed by a Go route since 2026-10-21. |
| `GET /api/v1/seller/affiliates/product-commissions` | fixed | Backed by a Go route since 2026-10-21. |
| `PUT /api/v1/seller/affiliates/product-commissions/:p` | fixed | Backed by a Go route since 2026-10-21. |
| `GET /api/v1/seller/affiliates/requests` | fixed | Backed by a Go route since 2026-10-21. |
| `POST /api/v1/seller/affiliates/requests/:p/:p` | fixed | Backed by a Go route since 2026-10-21. |
| `GET /api/v1/seller/affiliates/settings` | fixed | Backed by a Go route since 2026-10-21. |
| `PATCH /api/v1/seller/affiliates/settings` | fixed | Backed by a Go route since 2026-10-21. |
| `GET /api/v1/seller/analytics/breakdowns` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/analytics/overview` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/audit-log` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/brands` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/brands/:p` | mock-only | No backend route (documented in apiContract.md). |
| `PATCH /api/v1/seller/brands/:p` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/brands/:p/members` | mock-only | No backend route (documented in apiContract.md). |
| `DELETE /api/v1/seller/brands/:p/members/:p` | mock-only | No backend route (documented in apiContract.md). |
| `PATCH /api/v1/seller/brands/:p/members/:p` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/brands/:p/official-store` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/brands/:p/official-store/apply` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/brands/:p/protection/claims` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/brands/:p/protection/claims` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/brands/:p/protection/claims/:p/withdraw` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/brands/:p/protection/listings` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/brands/:p/stores` | mock-only | No backend route (documented in apiContract.md). |
| `DELETE /api/v1/seller/brands/:p/stores/:p` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/brands/directory` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/consents` | mock-only | No backend route. |
| `GET /api/v1/seller/conversations` | fixed | Backed by a Go route since 2026-10-21. |
| `GET /api/v1/seller/conversations/:p` | fixed | Backed by a Go route since 2026-10-21. |
| `POST /api/v1/seller/conversations/:p/messages` | fixed | Backed by a Go route since 2026-10-21. |
| `POST /api/v1/seller/conversations/:p/read` | fixed | Backed by a Go route since 2026-10-21. |
| `GET /api/v1/seller/customers/segments` | fixed | Backed 2026-10-05 (seller domains pass). |
| `POST /api/v1/seller/customers/segments` | fixed | Backed 2026-10-05 (seller domains pass). |
| `DELETE /api/v1/seller/customers/segments/:p` | fixed | Backed 2026-10-05 (seller domains pass). |
| `PATCH /api/v1/seller/customers/segments/:p` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/dashboard` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/delivery/areas` | fixed | Backed 2026-10-05 (seller domains pass). |
| `PATCH|POST /api/v1/seller/delivery/areas` | fixed | Backed 2026-10-05 (seller domains pass). |
| `DELETE /api/v1/seller/delivery/areas/:p` | fixed | Backed 2026-10-05 (seller domains pass). |
| `PATCH|POST /api/v1/seller/delivery/areas/:p` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/developers/api-keys` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/developers/api-keys` | mock-only | No backend route (documented in apiContract.md). |
| `DELETE /api/v1/seller/developers/api-keys/:p` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/developers/webhook-deliveries` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/developers/webhooks` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/developers/webhooks` | mock-only | No backend route (documented in apiContract.md). |
| `DELETE /api/v1/seller/developers/webhooks/:p` | mock-only | No backend route (documented in apiContract.md). |
| `PATCH /api/v1/seller/developers/webhooks/:p` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/developers/webhooks/:p/test` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/finance/escrow` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/finance/fees` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/finance/refunds` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/finance/settlements` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/finance/settlements/:p` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/finance/statements` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/finance/statements/:p` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/finance/summary` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/integrations` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/seller/integrations/:p/:p` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/marketing/overview` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/marketing/product-options` | fixed | Backed 2026-10-05 (seller domains pass). |
| `POST /api/v1/seller/orders/:p/conversation` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/seller/payout-onboarding` | fixed | Dashboard now calls `/payments/payout-onboarding/me/*` and `/payments/payout-fees` (go-money); BFF forwards them, owner only. `document-link/complete` stays a mock helper. |
| `PUT /api/v1/seller/payout-onboarding/bank` | fixed | Dashboard now calls `/payments/payout-onboarding/me/*` and `/payments/payout-fees` (go-money); BFF forwards them, owner only. `document-link/complete` stays a mock helper. |
| `PUT /api/v1/seller/payout-onboarding/business` | fixed | Dashboard now calls `/payments/payout-onboarding/me/*` and `/payments/payout-fees` (go-money); BFF forwards them, owner only. `document-link/complete` stays a mock helper. |
| `POST /api/v1/seller/payout-onboarding/document-link/complete` | fixed | Dashboard now calls `/payments/payout-onboarding/me/*` and `/payments/payout-fees` (go-money); BFF forwards them, owner only. `document-link/complete` stays a mock helper. |
| `GET /api/v1/seller/payout-onboarding/fees` | fixed | Dashboard now calls `/payments/payout-onboarding/me/*` and `/payments/payout-fees` (go-money); BFF forwards them, owner only. `document-link/complete` stays a mock helper. |
| `PUT /api/v1/seller/payout-onboarding/identity` | fixed | Dashboard now calls `/payments/payout-onboarding/me/*` and `/payments/payout-fees` (go-money); BFF forwards them, owner only. `document-link/complete` stays a mock helper. |
| `POST /api/v1/seller/payout-onboarding/resolve` | fixed | Dashboard now calls `/payments/payout-onboarding/me/*` and `/payments/payout-fees` (go-money); BFF forwards them, owner only. `document-link/complete` stays a mock helper. |
| `POST /api/v1/seller/payout-onboarding/retry` | fixed | Dashboard now calls `/payments/payout-onboarding/me/*` and `/payments/payout-fees` (go-money); BFF forwards them, owner only. `document-link/complete` stays a mock helper. |
| `POST /api/v1/seller/products/import` | fixed | Backed by a Go route since 2026-10-21. |
| `GET /api/v1/seller/security` | fixed | Backed by a Go route since 2026-10-21. |
| `DELETE /api/v1/seller/security/sessions/:p` | fixed | Backed by a Go route since 2026-10-21. |
| `POST /api/v1/seller/security/sessions/sign-out-others` | fixed | Backed by a Go route since 2026-10-21. |
| `GET /api/v1/seller/settings` | fixed | Backed 2026-10-05 (seller domains pass). |
| `PATCH /api/v1/seller/settings` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/staff` | fixed | Backed 2026-10-05 (seller domains pass). |
| `POST /api/v1/seller/staff` | fixed | Backed 2026-10-05 (seller domains pass). |
| `DELETE /api/v1/seller/staff/:p` | fixed | Backed 2026-10-05 (seller domains pass). |
| `PATCH /api/v1/seller/staff/:p` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/staff/candidates` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/storefront` | fixed | Backed 2026-10-05 (seller domains pass). |
| `PATCH /api/v1/seller/storefront` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/subscription` | fixed | Backed by a Go route since 2026-10-21. |
| `POST /api/v1/seller/subscription/trial/cancel` | fixed | Backed by a Go route since 2026-10-21. |
| `POST /api/v1/seller/subscription/trial/verify` | fixed | Backed by a Go route since 2026-10-21. |
| `POST /api/v1/seller/subscription/verify` | fixed | Backed by a Go route since 2026-10-21. |
| `PATCH /api/v1/seller/users/me/preferences` | fixed | The app calls `/api/v1/users/me/preferences` (go-users, backed); the seller-scoped path is a BFF alias, not a separate gateway route. |
| `GET /api/v1/seller/verification` | fixed | Backed by a Go route since 2026-10-21. |
| `GET /api/v1/seller/wallet/balances` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/wallet/banks` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/wallet/payout-accounts` | fixed | Backed 2026-10-05 (seller domains pass). |
| `POST /api/v1/seller/wallet/payout-accounts` | fixed | Backed 2026-10-05 (seller domains pass). |
| `DELETE /api/v1/seller/wallet/payout-accounts/:p` | fixed | Backed 2026-10-05 (seller domains pass). |
| `PATCH /api/v1/seller/wallet/payout-accounts/:p` | fixed | Backed 2026-10-05 (seller domains pass). |
| `POST /api/v1/seller/wallet/payout-accounts/resolve` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/wallet/payout-settings` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/wallet/payouts` | fixed | Backed 2026-10-05 (seller domains pass). |
| `POST /api/v1/seller/wallet/payouts` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/wallet/payouts/schedule` | fixed | Backed 2026-10-05 (seller domains pass). |
| `PUT /api/v1/seller/wallet/payouts/schedule` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/wallet/statements` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/wallet/transactions` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/seller/nantty-users` | fixed | Backed 2026-10-05 (seller domains pass). |
| `GET /api/v1/account/status` | matches |  |
| `POST /api/v1/auth/login` | matches |  |
| `POST /api/v1/auth/logout` | matches |  |
| `GET /api/v1/media/:p` | matches |  |
| `POST /api/v1/media/uploads` | matches |  |
| `PUT /api/v1/media/uploads/:p/chunks/:p` | matches |  |
| `POST /api/v1/media/uploads/:p/complete` | matches |  |
| `GET /api/v1/seller/access` | matches |  |
| `GET /api/v1/seller/business-documents` | matches |  |
| `GET /api/v1/seller/categories` | matches |  |
| `PATCH|POST /api/v1/seller/categories` | matches |  |
| `DELETE /api/v1/seller/categories/:p` | matches |  |
| `PATCH|POST /api/v1/seller/categories/:p` | matches |  |
| `GET /api/v1/seller/customers` | matches |  |
| `GET /api/v1/seller/customers/:p` | matches |  |
| `POST /api/v1/seller/customers/:p/notes` | matches |  |
| `GET /api/v1/seller/customers/:p/purchases` | matches |  |
| `GET /api/v1/seller/customers/export` | matches |  |
| `GET /api/v1/seller/customers/summary` | matches |  |
| `GET /api/v1/seller/delivery/shipments` | matches |  |
| `ANY /api/v1/seller/delivery/shipments/:p` | matches |  |
| `GET /api/v1/seller/delivery/summary` | matches |  |
| `GET /api/v1/seller/disputes` | matches |  |
| `GET /api/v1/seller/disputes/:p` | matches |  |
| `POST /api/v1/seller/disputes/:p/responses` | matches |  |
| `GET /api/v1/seller/inventory/adjustments` | matches |  |
| `POST /api/v1/seller/inventory/adjustments` | matches |  |
| `GET /api/v1/seller/inventory/levels` | matches |  |
| `GET /api/v1/seller/inventory/locations` | matches |  |
| `GET /api/v1/seller/inventory/movements` | matches |  |
| `GET /api/v1/seller/inventory/reorder` | matches |  |
| `PATCH /api/v1/seller/inventory/reorder-levels` | matches |  |
| `GET /api/v1/seller/inventory/summary` | matches |  |
| `GET /api/v1/seller/inventory/transfers` | matches |  |
| `POST /api/v1/seller/inventory/transfers` | matches |  |
| `POST /api/v1/seller/inventory/transfers/:p/:p` | matches |  |
| `GET /api/v1/seller/locations` | matches |  |
| `POST /api/v1/seller/locations` | matches |  |
| `PATCH /api/v1/seller/locations/:p` | matches |  |
| `GET /api/v1/seller/marketing/bundles` | matches |  |
| `POST /api/v1/seller/marketing/bundles` | matches |  |
| `DELETE /api/v1/seller/marketing/bundles/:p` | matches |  |
| `PATCH /api/v1/seller/marketing/bundles/:p` | matches |  |
| `GET /api/v1/seller/marketing/featured-products` | matches |  |
| `PUT /api/v1/seller/marketing/featured-products` | matches |  |
| `GET /api/v1/seller/marketing/flash-sales` | matches |  |
| `POST /api/v1/seller/marketing/flash-sales` | matches |  |
| `DELETE /api/v1/seller/marketing/flash-sales/:p` | matches |  |
| `PATCH /api/v1/seller/marketing/flash-sales/:p` | matches |  |
| `GET /api/v1/seller/marketing/rewards/summary` | matches |  |
| `GET /api/v1/seller/orders` | matches |  |
| `GET /api/v1/seller/orders/:p` | matches |  |
| `POST /api/v1/seller/orders/:p/:p` | matches |  |
| `POST /api/v1/seller/orders/:p/fulfilment` | matches |  |
| `POST /api/v1/seller/orders/:p/notes` | matches |  |
| `POST /api/v1/seller/orders/:p/refunds` | matches |  |
| `GET /api/v1/seller/orders/:p/shipping-snapshot` | matches |  |
| `GET /api/v1/seller/products` | matches |  |
| `POST|PATCH /api/v1/seller/products` | matches |  |
| `DELETE /api/v1/seller/products/:p` | matches |  |
| `GET /api/v1/seller/products/:p` | matches |  |
| `POST /api/v1/seller/products/:p/duplicate` | matches |  |
| `POST /api/v1/seller/products/barcodes` | matches |  |
| `POST /api/v1/seller/products/bulk` | matches |  |
| `GET /api/v1/seller/products/export` | matches |  |
| `GET /api/v1/seller/products/usage` | matches |  |
| `GET /api/v1/seller/promotions` | matches |  |
| `POST /api/v1/seller/promotions` | matches |  |
| `DELETE /api/v1/seller/promotions/:p` | matches |  |
| `GET /api/v1/seller/promotions/:p` | matches |  |
| `PATCH /api/v1/seller/promotions/:p` | matches |  |
| `GET /api/v1/seller/reports/:p` | matches |  |
| `GET /api/v1/seller/returns` | matches |  |
| `POST /api/v1/seller/returns/:p/:p` | matches |  |
| `GET /api/v1/seller/reviews` | matches |  |
| `DELETE /api/v1/seller/reviews/:p/reply` | matches |  |
| `PUT /api/v1/seller/reviews/:p/reply` | matches |  |
| `POST /api/v1/seller/reviews/:p/report` | matches |  |
| `GET /api/v1/seller/reviews/summary` | matches |  |
| `GET /api/v1/seller/shipping/profile` | matches |  |
| `PATCH /api/v1/seller/shipping/profile` | matches |  |
| `PATCH|POST /api/v1/seller/shipping/rules` | matches |  |
| `ANY /api/v1/seller/shipping/rules/:p` | matches |  |
| `PATCH|POST /api/v1/seller/shipping/rules/:p` | matches |  |
| `GET /api/v1/seller/stores/mine` | matches |  |
| `POST /api/v1/seller/subscription/:p` | matches |  |
| `POST /api/v1/seller/subscription/checkout` | matches |  |
| `GET /api/v1/seller/subscription/plans` | matches |  |
| `GET /api/v1/seller/subscription/trial` | matches |  |
| `POST /api/v1/seller/subscription/trial/checkout` | matches |  |
| `GET /api/v1/seller/suppliers` | matches |  |
| `PATCH|POST /api/v1/seller/suppliers` | matches |  |
| `DELETE /api/v1/seller/suppliers/:p` | matches |  |
| `PATCH|POST /api/v1/seller/suppliers/:p` | matches |  |

## ads

| Endpoint | Status | Fix / note |
| --- | --- | --- |
| `POST /api/v1/ads/accounts/:p/ad-sets` | fixed | Fixed: sends Idempotency-Key (backend requires it). |
| `POST /api/v1/ads/accounts/:p/ads` | fixed | Fixed: sends Idempotency-Key (backend requires it). |
| `POST /api/v1/ads/accounts/:p/campaigns/:p/duplicate` | fixed | Fixed: sends Idempotency-Key (backend requires it). |
| `POST /api/v1/ads/accounts/:p/invites` | fixed | Fixed 2026-10-05: backend accepts `{email, role}` or `{username, role}`; response has `username`. |
| `GET /api/v1/ads/accounts/:p/billing/invoices` | fixed | Backed by a go-ads route since 2026-10-21. |
| `GET /api/v1/ads/accounts/:p/billing/invoices/:p/download` | fixed | Backed by a go-ads route since 2026-10-21. |
| `POST /api/v1/ads/accounts/:p/billing/payment-methods` | mock-only | No backend route (documented in apiContract.md). |
| `DELETE /api/v1/ads/accounts/:p/billing/payment-methods/:p` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/ads/accounts/:p/billing/payment-methods/:p/default` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/ads/accounts/:p/billing/top-ups` | fixed | Backed by a go-ads route since 2026-10-21. |
| `GET /api/v1/ads/accounts/:p/billing/top-ups/:p` | fixed | Backed by a go-ads route since 2026-10-21. |
| `GET /api/v1/ads/accounts/:p/billing/transactions/:p/receipt` | fixed | Backed by a go-ads route since 2026-10-21. |
| `GET /api/v1/ads/accounts/:p/conversion-events` | fixed | Backed by a go-ads route since 2026-10-21. |
| `POST /api/v1/ads/accounts/:p/conversion-events` | fixed | Backed by a go-ads route since 2026-10-21. |
| `PATCH /api/v1/ads/accounts/:p/conversion-events/:p` | fixed | Backed by a go-ads route since 2026-10-21. |
| `POST /api/v1/ads/accounts/:p/creatives/preview` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/ads/accounts/:p/experiments` | fixed | Backed by a go-ads route since 2026-10-21. |
| `POST /api/v1/ads/accounts/:p/experiments` | fixed | Backed by a go-ads route since 2026-10-21. |
| `POST /api/v1/ads/accounts/:p/experiments/:p/stop` | fixed | Backed by a go-ads route since 2026-10-21. |
| `GET /api/v1/ads/accounts/:p/rules` | fixed | Backed by a go-ads route since 2026-10-21. |
| `POST /api/v1/ads/accounts/:p/rules` | fixed | Backed by a go-ads route since 2026-10-21. |
| `DELETE /api/v1/ads/accounts/:p/rules/:p` | fixed | Backed by a go-ads route since 2026-10-21. |
| `PATCH /api/v1/ads/accounts/:p/rules/:p` | fixed | Backed by a go-ads route since 2026-10-21. |
| `GET /api/v1/ads/behaviours` | fixed | Backed by a go-ads route since 2026-10-21. |
| `POST /api/v1/ads/consents` | mock-only | No backend route. |
| `GET /api/v1/ads/locations` | fixed | Backed by a go-ads route since 2026-10-21. |
| `PATCH /api/v1/ads/users/me/preferences` | mock-only | No backend route. |
| `GET /api/v1/ads/accounts` | matches |  |
| `POST /api/v1/ads/accounts` | matches |  |
| `GET /api/v1/ads/accounts/:p` | matches |  |
| `PATCH /api/v1/ads/accounts/:p` | matches |  |
| `GET /api/v1/ads/accounts/:p/activity` | matches |  |
| `GET /api/v1/ads/accounts/:p/ad-sets` | matches |  |
| `GET /api/v1/ads/accounts/:p/ad-sets/:p` | matches |  |
| `PATCH /api/v1/ads/accounts/:p/ad-sets/:p` | matches |  |
| `GET /api/v1/ads/accounts/:p/ads` | matches |  |
| `GET /api/v1/ads/accounts/:p/ads/:p` | matches |  |
| `PATCH /api/v1/ads/accounts/:p/ads/:p` | matches |  |
| `POST /api/v1/ads/accounts/:p/ads/:p/appeal` | matches |  |
| `GET /api/v1/ads/accounts/:p/ads/:p/cards/report` | matches |  |
| `GET /api/v1/ads/accounts/:p/audiences` | matches |  |
| `POST /api/v1/ads/accounts/:p/audiences` | matches |  |
| `DELETE /api/v1/ads/accounts/:p/audiences/:p` | matches |  |
| `PATCH /api/v1/ads/accounts/:p/audiences/:p` | matches |  |
| `POST /api/v1/ads/accounts/:p/audiences/customer-lists` | matches |  |
| `GET /api/v1/ads/accounts/:p/billing` | matches |  |
| `PUT /api/v1/ads/accounts/:p/billing/funding-mode` | matches |  |
| `PUT /api/v1/ads/accounts/:p/billing/spend-limit` | matches |  |
| `GET /api/v1/ads/accounts/:p/billing/transactions` | matches |  |
| `POST /api/v1/ads/accounts/:p/bulk-actions` | matches |  |
| `GET /api/v1/ads/accounts/:p/campaigns` | matches |  |
| `POST /api/v1/ads/accounts/:p/campaigns` | matches |  |
| `DELETE /api/v1/ads/accounts/:p/campaigns/:p` | matches |  |
| `GET /api/v1/ads/accounts/:p/campaigns/:p` | matches |  |
| `PATCH /api/v1/ads/accounts/:p/campaigns/:p` | matches |  |
| `POST /api/v1/ads/accounts/:p/campaigns/:p/submit` | matches |  |
| `GET /api/v1/ads/accounts/:p/content-sources` | matches |  |
| `GET /api/v1/ads/accounts/:p/creatives/media/:p` | matches |  |
| `GET /api/v1/ads/accounts/:p/entitlements` | matches |  |
| `POST /api/v1/ads/accounts/:p/estimates/audience` | matches |  |
| `GET /api/v1/ads/accounts/:p/invites` | matches |  |
| `DELETE /api/v1/ads/accounts/:p/invites/:p` | matches |  |
| `GET /api/v1/ads/accounts/:p/members` | matches |  |
| `DELETE /api/v1/ads/accounts/:p/members/:p` | matches |  |
| `PATCH /api/v1/ads/accounts/:p/members/:p` | matches |  |
| `GET /api/v1/ads/accounts/:p/reports` | matches |  |
| `GET /api/v1/ads/accounts/:p/reports/export` | matches |  |
| `GET /api/v1/ads/accounts/:p/reports/scheduled` | matches |  |
| `POST /api/v1/ads/accounts/:p/reports/scheduled` | matches |  |
| `DELETE /api/v1/ads/accounts/:p/reports/scheduled/:p` | matches |  |
| `GET /api/v1/ads/business-profiles` | matches |  |
| `GET /api/v1/ads/invites/:p` | matches |  |
| `POST /api/v1/ads/invites/:p/accept` | matches |  |
| `GET /api/v1/ads/memberships` | matches |  |
| `GET /api/v1/ads/pricing` | matches |  |
| `POST /api/v1/ads/pricing/estimate` | matches |  |
| `POST /api/v1/auth/login` | matches |  |
| `POST /api/v1/auth/logout` | matches |  |
| `POST /api/v1/media/uploads` | matches |  |
| `PUT /api/v1/media/uploads/:p/chunks/:p` | matches |  |
| `POST /api/v1/media/uploads/:p/complete` | matches |  |

## admin

| Endpoint | Status | Fix / note |
| --- | --- | --- |
| `POST /api/v1/admin/auth/login` | fixed | Fixed: BFF reads `{status, challengeToken}` (was `{mfaToken, enrollmentRequired}`). |
| `POST /api/v1/admin/auth/mfa/enroll/confirm` | fixed | Fixed: was `/mfa/totp/confirm`; session user read from `staff`. |
| `POST /api/v1/admin/auth/mfa/enroll/start` | fixed | Fixed: BFF called `/mfa/totp/enroll` with `mfaToken`; now `/mfa/enroll/start` with `challengeToken`. |
| `POST /api/v1/admin/auth/mfa/verify` | fixed | Fixed: body `{challengeToken, code}`; backend rejects unknown fields, so `method` is no longer sent for TOTP. |
| `POST /api/v1/admin/auth/step-up` | fixed | Fixed: body `{code}` only (backend rejects the extra `method`). |
| `GET /api/v1/admin/payouts/:p` | mismatch | Open: backend has `/admin/withdrawals` + `/review`, not payout detail/decide. |
| `GET /api/v1/admin/usernames/withheld` | mismatch | Open: backend has POST/DELETE only (no list). |
| `POST /api/v1/admin/account/passkeys` | mock-only | No backend route (documented in apiContract.md). |
| `DELETE /api/v1/admin/account/passkeys/:p` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/account/passkeys/options` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/account/recovery-codes/regenerate` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/account/sessions` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/account/sessions/:p/revoke` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/advertisers/:p` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/appeals/:p` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/appeals/:p/decide` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/auth/mfa/webauthn/options` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/auth/step-up/webauthn/options` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/automation/catalog` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/automation/executions` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/automation/rules` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/automation/sample-events` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/brands/:p` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/brands/:p/documents/:p` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/brands/:p/official-status/:p` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/catalog/categories` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/catalog/categories` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/catalog/categories/:p` | mock-only | No backend route (documented in apiContract.md). |
| `PATCH /api/v1/admin/catalog/categories/:p` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/catalog/categories/:p/move` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/catalog/features` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/catalog/features` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/catalog/features/:p` | mock-only | No backend route (documented in apiContract.md). |
| `PATCH /api/v1/admin/catalog/features/:p` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/catalog/features/:p/move` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/catalog/features/image-library` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/catalog/topics` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/catalog/topics` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/catalog/topics/:p` | mock-only | No backend route (documented in apiContract.md). |
| `PATCH /api/v1/admin/catalog/topics/:p` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/coins/:p/mark-reviewed` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/coins/:p/reverse` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/consents` | mock-only | No backend route. |
| `GET /api/v1/admin/email-templates/:p/preview` | mock-only | No backend route. |
| `POST /api/v1/admin/email-templates/policy-updated/preview` | mock-only | No backend route. |
| `GET /api/v1/admin/ledger/accounts` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/ledger/currencies` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/ledger/entries` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/metrics/overview` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/orders/:p` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/payouts/:p/:p` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/refunds` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/reports/:p/revoke-author-verification` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/reserved-usernames` | mock-only | No backend route (documented in apiContract.md). |
| `POST /api/v1/admin/reserved-usernames/:p/remove` | mock-only | No backend route (documented in apiContract.md). |
| `GET /api/v1/admin/usernames/confusables` | mock-only | No backend route (documented in apiContract.md). |
| `PATCH /api/v1/admin/users/me/preferences` | mock-only | No backend route. |
| `GET /api/v1/admin/account-health/:p` | matches |  |
| `POST /api/v1/admin/accounts` | matches |  |
| `GET /api/v1/admin/accounts/created` | matches |  |
| `GET /api/v1/admin/ad-policies` | matches |  |
| `POST /api/v1/admin/ad-policies` | matches |  |
| `PUT /api/v1/admin/ad-policies/:p` | matches |  |
| `GET /api/v1/admin/admins` | matches |  |
| `POST /api/v1/admin/admins` | matches |  |
| `GET /api/v1/admin/admins/:p` | matches |  |
| `POST /api/v1/admin/admins/:p/:p` | matches |  |
| `PUT /api/v1/admin/admins/:p/permissions` | matches |  |
| `GET /api/v1/admin/ads` | matches |  |
| `GET /api/v1/admin/ads/:p` | matches |  |
| `POST /api/v1/admin/ads/:p/approve` | matches |  |
| `POST /api/v1/admin/ads/:p/reject` | matches |  |
| `GET /api/v1/admin/advertisers` | matches |  |
| `POST /api/v1/admin/advertisers/:p/:p` | matches |  |
| `GET /api/v1/admin/applications/:p` | matches |  |
| `GET /api/v1/admin/applications/:p/:p` | matches |  |
| `POST /api/v1/admin/applications/:p/:p/:p` | matches |  |
| `GET /api/v1/admin/applications/creators` | matches |  |
| `GET /api/v1/admin/audit` | matches |  |
| `GET /api/v1/admin/audit/export` | matches |  |
| `GET /api/v1/admin/audit/facets` | matches |  |
| `POST /api/v1/admin/auth/logout` | matches |  |
| `GET /api/v1/admin/auth/me` | matches |  |
| `POST /api/v1/admin/auth/refresh` | matches |  |
| `GET /api/v1/admin/black-applications` | matches |  |
| `GET /api/v1/admin/black-applications/:p/:p` | matches |  |
| `GET /api/v1/admin/business-documents` | matches |  |
| `POST /api/v1/admin/business-documents/:p/documents/:p/:p` | matches |  |
| `GET /api/v1/admin/business-documents/:p/documents/:p/access` | matches |  |
| `GET /api/v1/admin/chat-reports` | matches |  |
| `GET /api/v1/admin/chat-reports/:p` | matches |  |
| `POST /api/v1/admin/chat-reports/:p/actions` | matches |  |
| `GET /api/v1/admin/chat-reports/retention` | matches |  |
| `PUT /api/v1/admin/chat-reports/retention` | matches |  |
| `GET /api/v1/admin/checkmark-grants` | matches |  |
| `POST /api/v1/admin/checkmark-grants` | matches |  |
| `POST /api/v1/admin/checkmark-grants/:p/revoke` | matches |  |
| `GET /api/v1/admin/coins/:p` | matches |  |
| `GET /api/v1/admin/coins/price-table` | matches |  |
| `PUT /api/v1/admin/coins/price-table/:p` | matches |  |
| `GET /api/v1/admin/config` | matches |  |
| `GET /api/v1/admin/copyright-claims` | matches |  |
| `GET /api/v1/admin/copyright-claims/:p` | matches |  |
| `POST /api/v1/admin/copyright-claims/:p/:p` | matches |  |
| `POST /api/v1/admin/copyright-claims/:p/audio-match` | matches |  |
| `POST /api/v1/admin/copyright-claims/:p/counter-notices/:p/:p` | matches |  |
| `GET /api/v1/admin/copyright-policy` | matches |  |
| `PUT /api/v1/admin/copyright-policy` | matches |  |
| `GET /api/v1/admin/disputes` | matches |  |
| `GET /api/v1/admin/disputes/:p` | matches |  |
| `POST /api/v1/admin/disputes/:p/resolve` | matches |  |
| `GET /api/v1/admin/help/auto-topics` | matches |  |
| `GET /api/v1/admin/help/categories` | matches |  |
| `POST /api/v1/admin/help/categories` | matches |  |
| `DELETE /api/v1/admin/help/categories/:p` | matches |  |
| `PUT /api/v1/admin/help/categories/:p` | matches |  |
| `GET /api/v1/admin/help/settings` | matches |  |
| `PUT /api/v1/admin/help/settings` | matches |  |
| `GET /api/v1/admin/help/topics` | matches |  |
| `POST /api/v1/admin/help/topics` | matches |  |
| `DELETE /api/v1/admin/help/topics/:p` | matches |  |
| `GET /api/v1/admin/help/topics/:p` | matches |  |
| `PUT /api/v1/admin/help/topics/:p` | matches |  |
| `POST /api/v1/admin/help/topics/:p/merge` | matches |  |
| `POST /api/v1/admin/help/topics/:p/publish` | matches |  |
| `POST /api/v1/admin/help/topics/:p/unpublish` | matches |  |
| `GET /api/v1/admin/ip-claims` | matches |  |
| `GET /api/v1/admin/ip-claims/:p` | matches |  |
| `POST /api/v1/admin/ip-claims/:p/:p` | matches |  |
| `GET /api/v1/admin/legal/documents` | matches |  |
| `GET /api/v1/admin/legal/documents/:p` | matches |  |
| `GET /api/v1/admin/legal/notices` | matches |  |
| `POST /api/v1/admin/legal/notices` | matches |  |
| `GET /api/v1/admin/legal/versions/:p` | matches |  |
| `GET /api/v1/admin/live-incidents` | matches |  |
| `GET /api/v1/admin/live-incidents/:p` | matches |  |
| `POST /api/v1/admin/live-incidents/:p/actions` | matches |  |
| `POST /api/v1/admin/live-incidents/:p/end-and-suspend` | matches |  |
| `GET /api/v1/admin/reports` | matches |  |
| `GET /api/v1/admin/reports/:p` | matches |  |
| `POST /api/v1/admin/reports/:p/actions` | matches |  |
| `POST /api/v1/admin/reports/:p/suspend-author` | matches |  |
| `GET /api/v1/admin/roles` | matches |  |
| `POST /api/v1/admin/roles` | matches |  |
| `GET /api/v1/admin/security/cases` | matches |  |
| `GET /api/v1/admin/security/cases/:p` | matches |  |
| `POST /api/v1/admin/security/cases/:p/decide` | matches |  |
| `GET /api/v1/admin/staff-settings` | matches |  |
| `PUT /api/v1/admin/staff-settings` | matches |  |
| `POST /api/v1/admin/strike-appeals/:p/:p` | matches |  |
| `GET /api/v1/admin/subscriptions/price-table` | matches |  |
| `PUT /api/v1/admin/subscriptions/price-table/:p/:p` | matches |  |
| `GET /api/v1/admin/support/agents` | matches |  |
| `GET /api/v1/admin/support/chats` | matches |  |
| `GET /api/v1/admin/support/chats/:p` | matches |  |
| `POST /api/v1/admin/support/chats/:p/claim` | matches |  |
| `POST /api/v1/admin/support/chats/:p/end` | matches |  |
| `POST /api/v1/admin/support/chats/:p/messages` | matches |  |
| `POST /api/v1/admin/support/email/preview` | matches |  |
| `GET /api/v1/admin/support/email/segments` | matches |  |
| `POST /api/v1/admin/support/email/send` | matches |  |
| `GET /api/v1/admin/support/email/sends` | matches |  |
| `GET /api/v1/admin/support/email/templates` | matches |  |
| `GET /api/v1/admin/support/macros` | matches |  |
| `POST /api/v1/admin/support/macros` | matches |  |
| `DELETE /api/v1/admin/support/macros/:p` | matches |  |
| `PUT /api/v1/admin/support/macros/:p` | matches |  |
| `GET /api/v1/admin/support/tickets` | matches |  |
| `GET /api/v1/admin/support/tickets/:p` | matches |  |
| `POST /api/v1/admin/support/tickets/:p/assign` | matches |  |
| `POST /api/v1/admin/support/tickets/:p/replies` | matches |  |
| `POST /api/v1/admin/support/tickets/:p/status` | matches |  |
| `GET /api/v1/admin/suspensions/accounts` | matches |  |
| `POST /api/v1/admin/suspensions/accounts/:p/appeal/decide` | matches |  |
| `POST /api/v1/admin/suspensions/accounts/:p/reinstate` | matches |  |
| `GET /api/v1/admin/suspensions/cases` | matches |  |
| `GET /api/v1/admin/suspensions/cases/:p` | matches |  |
| `POST /api/v1/admin/suspensions/cases/:p/:p` | matches |  |
| `GET /api/v1/admin/trending/moderation` | matches |  |
| `PUT /api/v1/admin/trending/moderation` | matches |  |
| `GET /api/v1/admin/usernames/held` | matches |  |
| `GET /api/v1/admin/usernames/hold` | matches |  |
| `GET /api/v1/admin/users` | matches |  |
| `GET /api/v1/admin/users/:p` | matches |  |
| `GET /api/v1/admin/verification-cases` | matches |  |
| `GET /api/v1/admin/verification-cases/:p` | matches |  |
| `POST /api/v1/admin/verification-cases/:p/:p` | matches |  |
| `GET /api/v1/admin/verifications` | matches |  |
| `GET /api/v1/admin/verifications/:p` | matches |  |
| `POST /api/v1/auth/login` | matches |  |
| `POST /api/v1/auth/logout` | matches |  |

## Backend routes with no frontend caller

249 routes (internal `/internal/` and health routes excluded). Most are admin, webhook, seller-dashboard and ads endpoints the UIs reach through mocks with different paths, or features with no screen yet.

- **go:admin** (11): `GET /api/v1/admin/audit/{entryId}`, `GET /api/v1/admin/config/{key}`, `GET /api/v1/platform-config/creator-requirements`, `PATCH /api/v1/admin/admins/{staffId}/permissions`, `POST /api/v1/admin/admins/{staffId}/approve`, `POST /api/v1/admin/admins/{staffId}/enable`, `POST /api/v1/admin/admins/{staffId}/reset-mfa`, `POST /api/v1/admin/admins/{staffId}/revoke`, `POST /api/v1/admin/admins/{staffId}/suspend`, `POST /api/v1/admin/auth/accept-invitation`, `PUT /api/v1/admin/config/{key}`
- **go:ads** (8): `GET /api/v1/admin/ads-policies`, `GET /api/v1/ads/accounts/{accountId}/reports/export.pdf`, `GET /api/v1/ads/r/{token}`, `POST /api/v1/admin/ads/{adId}/appeal/resolve`, `POST /api/v1/admin/advertisers/{advertiserId}/reinstate`, `POST /api/v1/ads/accounts/{accountId}/creatives/media/uploads`, `POST /api/v1/ads/accounts/{accountId}/creatives/media/{mediaId}/complete`, `PUT /api/v1/admin/ads-policies/frequency/{format}`
- **go:auth** (5): `DELETE /api/v1/auth/sessions/{sessionId}`, `DELETE /api/v1/auth/sessions`, `GET /.well-known/jwks.json`, `GET /api/v1/auth/sessions`, `POST /api/v1/auth/apple`
- **go:catalog** (10): `DELETE /api/v1/products/{productId}/bookmark`, `GET /api/v1/products/{productId}/rating-summary`, `GET /api/v1/stores/{storeId}/reviews`, `PATCH /api/v1/seller/categories/{categoryId}`, `PATCH /api/v1/seller/store`, `POST /api/v1/seller/categories`, `POST /api/v1/seller/products/{productId}/publish`, `POST /api/v1/seller/products/{productId}/unpublish`, `POST /api/v1/stores/{storeId}/reviews`, `POST /api/v1/stores`
- **go:creators** (3): `GET /api/v1/admin/creator-tiers`, `PUT /api/v1/admin/creator-tiers/{tierId}`, `PUT /api/v1/admin/creators/{userId}/program`
- **go:currency** (4): `GET /api/v1/admin/exchange-rates`, `GET /api/v1/currencies`, `GET /api/v1/currency/convert`, `PUT /api/v1/admin/exchange-rates/{currency}`
- **go:escrow** (4): `GET /api/v1/admin/orders/{orderId}/escrow`, `POST /api/v1/admin/disputes/{disputeId}/messages`, `POST /api/v1/admin/orders/{orderId}/escrow/refund`, `POST /api/v1/disputes/{disputeId}/close`
- **go:inventory** (3): `PATCH /api/v1/seller/suppliers/{supplierId}`, `POST /api/v1/seller/inventory/transfers/{transferId}/cancel`, `POST /api/v1/seller/suppliers`
- **go:ledger** (3): `GET /api/v1/admin/ledger/integrity`, `GET /api/v1/admin/ledger/statement`, `POST /api/v1/admin/ledger/journal-entries/{entryId}/reversal`
- **go:live** (43): `DELETE /api/v1/admin/gifts/{giftId}`, `DELETE /api/v1/lives/{liveId}/comments/{commentId}`, `DELETE /api/v1/lives/{liveId}/gift-goals/{goalId}`, `DELETE /api/v1/lives/{liveId}/guests/invitations/{slotId}`, `DELETE /api/v1/lives/{liveId}/moderators/{userId}`, `DELETE /api/v1/lives/{liveId}/overlay-scenes/{sceneId}/publish`, `DELETE /api/v1/lives/{liveId}/overlay-scenes/{sceneId}`, `DELETE /api/v1/lives/{liveId}/pinned-comment`, `DELETE /api/v1/lives/{liveId}/stream-key`, `DELETE /api/v1/lives/{liveId}/viewers/{userId}/ban`, `DELETE /api/v1/lives/{liveId}/viewers/{userId}/mute`, `GET /api/v1/admin/gifts`, `GET /api/v1/lives/{liveId}/moderators`, `GET /api/v1/lives/{liveId}/overlay-scenes/{sceneId}`, `GET /api/v1/lives/{liveId}/overlay-scenes`, `GET /api/v1/lives/{liveId}/recordings`, `GET /api/v1/lives/{liveId}/room-settings`, `GET /api/v1/lives/{liveId}/stream-key`, `GET /api/v1/lives/{liveId}/viewers`, `PATCH /api/v1/admin/gifts/{giftId}`, `POST /api/v1/admin/gifts`, `POST /api/v1/battles/{battleId}/{action}`, `POST /api/v1/live/webhooks/livekit`, `POST /api/v1/lives/{liveId}/battles`, `POST /api/v1/lives/{liveId}/guests/invitations/{slotId}/{response}`, `POST /api/v1/lives/{liveId}/guests/invitations`, `POST /api/v1/lives/{liveId}/guests/me/connection`, `POST /api/v1/lives/{liveId}/guests/me/leave`, `POST /api/v1/lives/{liveId}/guests/requests/{requestId}/{decision}`, `POST /api/v1/lives/{liveId}/guests/requests`, `POST /api/v1/lives/{liveId}/guests/{userId}/mute`, `POST /api/v1/lives/{liveId}/guests/{userId}/remove`, `POST /api/v1/lives/{liveId}/media-token`, `POST /api/v1/lives/{liveId}/overlay-scenes/{sceneId}/publish`, `POST /api/v1/lives/{liveId}/overlay-scenes`, `PUT /api/v1/lives/{liveId}/comments/{commentId}/pin`, `PUT /api/v1/lives/{liveId}/moderators/{userId}`, `PUT /api/v1/lives/{liveId}/monetization`, `PUT /api/v1/lives/{liveId}/overlay-scenes/{sceneId}`, `PUT /api/v1/lives/{liveId}/recording`, `PUT /api/v1/lives/{liveId}/room-settings`, `PUT /api/v1/lives/{liveId}/viewers/{userId}/ban`, `PUT /api/v1/lives/{liveId}/viewers/{userId}/mute`
- **go:moderation** (13): `GET /api/v1/admin/strike-appeals`, `POST /api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/court-action`, `POST /api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/reject`, `POST /api/v1/admin/copyright-claims/{claimId}/reject`, `POST /api/v1/admin/copyright-claims/{claimId}/request-info`, `POST /api/v1/admin/copyright-claims/{claimId}/uphold`, `POST /api/v1/admin/ip-claims/{claimId}/reject`, `POST /api/v1/admin/ip-claims/{claimId}/request-info`, `POST /api/v1/admin/strike-appeals/{strikeId}/overturn`, `POST /api/v1/admin/suspensions/cases/{caseId}/dismiss`, `POST /api/v1/admin/suspensions/cases/{caseId}/escalate`, `POST /api/v1/ip-claims/{claimId}/response`, `POST /api/v1/security/client-signals`
- **go:orders** (remaining): `DELETE /api/v1/cart`, `GET /api/v1/returns`, `GET /api/v1/seller/reports/exports/{exportId}`, `GET /api/v1/seller/reports/exports`, `GET /api/v1/seller/shipping/preview`, `GET /api/v1/seller/shipping/profiles`, `POST /api/v1/orders/{orderId}/cancel`, `POST /api/v1/orders/{orderId}/returns`, `POST /api/v1/seller/orders/{orderId}/cancel`, `POST /api/v1/seller/orders/{orderId}/reject`, `POST /api/v1/seller/orders/{orderId}/status`, `POST /api/v1/seller/promotions/validate-code`, `POST /api/v1/seller/reports/exports`, `POST /api/v1/seller/returns/{returnId}/decline`, `POST /api/v1/seller/returns/{returnId}/receive`,
- **go:payments** (17): `GET /api/v1/admin/payments/payout-accounts/stuck`, `GET /api/v1/payments/connected-accounts/me`, `POST /api/v1/admin/payments/disputes/{providerDisputeId}/evidence`, `POST /api/v1/admin/payments/payout-accounts/jobs/{jobId}/retry`, `POST /api/v1/admin/payments/payout-accounts/{userId}/verification-prompt`, `POST /api/v1/admin/payments/reconciliations`, `POST /api/v1/payments/connected-accounts/me/onboarding-link`, `POST /api/v1/payments/connected-accounts/me`, `POST /api/v1/payments/payout-onboarding/me/document-link`, `POST /api/v1/payments/refunds/{refundId}/bank-destination`, `POST /api/v1/payments/saved-cards/setups/{reference}/complete`, `POST /api/v1/payments/saved-cards/setups`, `POST /api/v1/payments/store-notifications/{store}`, `POST /api/v1/payments/subscriptions/checkout`, `POST /api/v1/payments/webhooks/{provider}`, `POST /webhooks/store-notifications/{store}`, `POST /webhooks/{provider}`
- **go:subscriptions** (11): `GET /api/v1/pricing/creator-subscription-bands`, `GET /api/v1/pricing/plans`, `GET /api/v1/pricing/region`, `GET /api/v1/subscriptions/me`, `GET /api/v1/subscriptions/offer`, `GET /api/v1/subscriptions/{subscriptionId}/periods`, `GET /api/v1/subscriptions/{subscriptionId}/upcoming-charge`, `POST /api/v1/subscriptions/store-receipts`, `POST /api/v1/subscriptions/{subscriptionId}/cancel`, `POST /api/v1/subscriptions/{subscriptionId}/change-plan`, `POST /api/v1/subscriptions/{subscriptionId}/pay-now`
- **go:users** (58): `DELETE /api/v1/admin/usernames/reserved/{ruleId}`, `DELETE /api/v1/admin/usernames/withheld/{username}`, `GET /api/v1/admin/legal/versions/{versionId}/acceptance`, `GET /api/v1/admin/retention-policies`, `GET /api/v1/admin/usernames/reserved`, `GET /api/v1/consents`, `GET /api/v1/geo/regions/{regionId}/cities`, `GET /api/v1/policies/current`, `GET /api/v1/users/me/addresses/{addressId}`, `GET /api/v1/users/me/data-exports/{exportId}`, `GET /api/v1/users/me/deletion-request`, `GET /api/v1/users/me/message-privacy`, `GET /api/v1/users/me/privacy-settings`, `GET /api/v1/users/me/terms-acceptances`, `GET /api/v1/users/username/{username}`, `PATCH /api/v1/users/me/business-profiles/{profileId}`, `PATCH /api/v1/users/me/privacy-settings`, `POST /api/v1/admin/applications/creators/{applicationId}/reject`, `POST /api/v1/admin/black-applications/{blackId}/approve`, `POST /api/v1/admin/black-applications/{blackId}/checklist`, `POST /api/v1/admin/black-applications/{blackId}/reject`, `POST /api/v1/admin/black-applications/{blackId}/reverification-reminder`, `POST /api/v1/admin/black-applications/{blackId}/revoke`, `POST /api/v1/admin/business-documents/{submissionId}/documents/{documentId}/reject`, `POST /api/v1/admin/legal/documents/{key}/rollback`, `POST /api/v1/admin/legal/documents/{key}/versions`, `POST /api/v1/admin/legal/versions/{versionId}/publish`, `POST /api/v1/admin/legal/versions/{versionId}/return`, `POST /api/v1/admin/legal/versions/{versionId}/submit`, `POST /api/v1/admin/policy-versions`, `POST /api/v1/admin/usernames/reserved`, `POST /api/v1/admin/usernames/withheld`, `POST /api/v1/admin/users/{userId}/ban`, `POST /api/v1/admin/users/{userId}/delete`, `POST /api/v1/admin/users/{userId}/reinstate`, `POST /api/v1/admin/users/{userId}/restrict`, `POST /api/v1/admin/users/{userId}/suspend`, `POST /api/v1/admin/users/{userId}/unban`, `POST /api/v1/admin/users/{userId}/username/assign-held`, `POST /api/v1/admin/users/{userId}/username/reassign`, `POST /api/v1/admin/verification-cases/{caseId}/reject`, `POST /api/v1/admin/verifications/{verificationId}/approve`, `POST /api/v1/admin/verifications/{verificationId}/reinstate`, `POST /api/v1/admin/verifications/{verificationId}/reject`, `POST /api/v1/admin/verifications/{verificationId}/revoke`, `POST /api/v1/admin/verifications/{verificationId}/suspend`, `POST /api/v1/seller/business-documents/{kind}/upload-intents`, `POST /api/v1/users/me/consents/merge`, `POST /api/v1/users/me/creator-application`, `POST /api/v1/users/me/deletion-request/cancel`, `POST /api/v1/users/me/suspension/appeal`, `POST /api/v1/users/me/terms-acceptances`, `POST /api/v1/verification/black-applications`, `POST /api/v1/webhooks/smile-id`, `PUT /api/v1/admin/legal/versions/{versionId}`, `PUT /api/v1/admin/retention-policies/{category}`, `PUT /api/v1/consents`, `PUT /api/v1/users/me/message-privacy`
- **go:wallet** (13): `DELETE /api/v1/admin/wallet/seller-reserves/{sellerUserId}`, `GET /api/v1/admin/wallet/seller-reserves`, `GET /api/v1/admin/withdrawals`, `GET /api/v1/ads/balance`, `GET /api/v1/coins/packs`, `GET /api/v1/wallets/me/withdrawals/quote`, `GET /api/v1/wallets/me/withdrawals`, `POST /api/v1/admin/payouts/run`, `POST /api/v1/admin/withdrawals/{withdrawalId}/review`, `POST /api/v1/ads/balance/refund`, `POST /api/v1/ads/balance/top-ups`, `POST /api/v1/wallets/me/withdrawals/{withdrawalId}/cancel`, `PUT /api/v1/admin/wallet/seller-reserves/{sellerUserId}`
- **ty:media** (1): `POST /api/v1/media/:mediaId/complete`
- **ty:notifications** (10): `DELETE /api/v1/notifications/device-tokens`, `GET /api/v1/admin/legal/notices/:noticeId`, `GET /api/v1/admin/legal/versions/:versionId/notice-draft`, `GET /api/v1/admin/legal/versions/:versionId/notice-preview`, `GET /api/v1/email/unsubscribe`, `GET /api/v1/notifications/unread-count`, `POST /api/v1/admin/legal/versions/:versionId/notice-draft/test-send`, `POST /api/v1/email/unsubscribe`, `POST /api/v1/notifications/device-tokens`, `PUT /api/v1/admin/legal/versions/:versionId/notice-draft`
- **ty:search** (1): `GET /api/v1/search/suggest`
- **ty:social** (9): `DELETE /api/v1/posts/:postId/tags/me`, `DELETE /api/v1/posts/:postId`, `GET /api/v1/me/tagging-settings`, `GET /api/v1/users/:userId/follow-status`, `POST /api/v1/posts/:postId/impressions`, `POST /api/v1/posts/:postId/profile-visits`, `POST /api/v1/sounds`, `PUT /api/v1/me/tagging-settings`, `PUT /api/v1/posts/:postId/tags`

## Flutterwave stage 2 changes (2026-10-10)

Flutterwave is now the only provider (`PAYMENTS_PROVIDER=flutterwave`, 2026-10-11).

| Endpoint | Change | Clients |
|---|---|---|
| `POST /api/v1/payments/payout-onboarding/me/bank-validation?returnTo=` | Response is now `{ status, consentUrl?, reference? }`. Under Flutterwave it starts the BVN consent; open `consentUrl` in a browser, then poll the GET below | mobile, webapp, seller, studio payout setup (open the URL when present) |
| `GET /api/v1/payments/payout-onboarding/me/bank-validation` | New: `{ status: not_started\|pending\|verified\|failed }` (reads the BVN result) | same |
| `GET /api/v1/payments/wallet/me` | New: `{ wallet: { provider, currency, status, accountName, accountNumber, bankName, bankCode, fundingNumbers[], createdAt, frozenAt }, balances: { currency, availableMinor, depositHoldMinor, escrowLockedMinor, outgoingMinor, reservedPayoutMinor, debtMinor } }`; `409 WALLET_NOT_READY` before L1 | wallet screens (stage 4) |
| `POST /api/v1/payments/wallet/me/activate` | New: creates the PSA once the user is L1; idempotent | wallet screens |
| `POST /api/v1/payments/wallet-payments/{reference}` | New, `Idempotency-Key` required: pays a pending intent (order, coins, ads top-up, boost, subscription) from the wallet. `422 INSUFFICIENT_WALLET_FUNDS`, `409 WALLET_ON_HOLD`, `422 WALLET_PAYMENT_NOT_ALLOWED`, `409 ALREADY_PAID` | checkout (stage 4) |
| `POST /api/v1/orders/checkout`, `POST /api/v1/coins/purchases`, `POST /api/v1/creators/earnings/convert`, `POST /api/v1/boosts` | `422 COUNTRY_REQUIRED` when neither the address nor the profile (nor a trusted CDN header) gives a country; save it with `PATCH /api/v1/users/me/preferences { countryCode }` and retry | mobile + webapp checkout show a country picker (done); coins/boost dialogs still show the message |
| Order checkout, catalog publish, bulk publish | `403 VERIFICATION_REQUIRED` with `verifyUrl` when a seller outside Nigeria is not L1 | seller dashboard (show `verifyUrl`), webapp/mobile cart |
| `POST /api/v1/wallets/me/withdrawals` | New errors under Flutterwave: `409 WALLET_DEBT_OUTSTANDING`, `422 PAYOUT_ACCOUNT_NAME_MISMATCH`, `409 WALLET_ON_HOLD` | wallet withdraw screens |
| `POST /webhooks/flutterwave` | New; the gateway forwards `verif-hash` (and only on webhook routes) | — |
| Admin: `/api/v1/admin/payments/...` | See `apps/admin/apiContract.md` (dead-letter list/inspect/replay, funding reject, wallet unfreeze, reconciliation run) | admin console page `/commerce/webhooks` |
| Internal: `GET /api/v1/internal/sellers/{userId}/selling-eligibility` | New, `x-internal-token` = `MONEY_INTERNAL_API_TOKEN`: `{ canSell, country, level, reason, verifyUrl }` | catalog (go-commerce) via `platform/sellingeligibility` |

## Stage 2 security follow-ups and boost cancel (2026-10-11)

| Endpoint | Change | Clients |
|---|---|---|
| `POST /api/v1/subscriptions/checkout`, `POST /api/v1/seller/subscription/checkout`, `.../trial/checkout` | Web price comes from the account or profile country (or a trusted CDN header), never `X-Client-Region`. `422 COUNTRY_REQUIRED` when none is known (FLOW-001) | seller, webapp plan checkout: show the country picker and retry |
| Order checkout, catalog publish (all paths that check selling eligibility) | `403 SELLER_DEBT_LIMIT` when the seller owes (seller debt + wallet debt) more than their level allows: NG L0 ₦10,000, L1 ₦50,000, L2 or trusted (90+ days, no upheld disputes or lost chargebacks in 90 days) ₦200,000; elsewhere half, converted, unless overridden. Shipping, delivery and dispute replies on existing orders are not gated. Internal eligibility response gains `blockedBy: "debt"` | seller dashboard, webapp/mobile cart: shared error copy |
| `POST /api/v1/orders/checkout` | `422 PAYMENT_AMOUNT_OUT_OF_RANGE` with `details: { reason: "contactSupportForLargeOrders", maximum: Money }` when one store's order is above ₦5,000,000 (converted elsewhere) | mobile, webapp checkout: shared error copy |
| Coin purchases, ads top-ups (payment intents) | `422 PAYMENT_AMOUNT_OUT_OF_RANGE` with `details: { maximum \| minimum: Money }`: coins ₦500,000, ads top-up ₦10,000,000 (verified advertisers only); creator subscriptions keep their tier prices. Ads console top-up form now allows up to ₦10m | webapp/mobile coin dialogs, ads console |
| `POST /api/v1/payments/wallet-payments/{reference}` | `422 WALLET_DAILY_LIMIT` with `details: { tier, limit: Money, remaining: Money, resetsAt }`; tiers basic (L1) ₦50,000/day, mid (L2) ₦200,000, full (L2 + business verified) ₦5,000,000; day is Lagos time | wallet checkout (stage 4): shared error copy |
| All API errors | Optional `details` object on the error body | mobile, webapp, seller and ads error classes keep it and show limit copy |
| Admin: `GET/PUT /api/v1/admin/config/seller.debtLimits`, `.../payments.limits` | New settings (permission `config:revenue`, step-up on save); env values are fallbacks only | admin Regional pricing → Limits tab |
| `POST /api/v1/ads/boosts/{boostId}/cancel` | New, owner only, `Idempotency-Key` required. Stops the boost; returns the boost (`status: "cancelled"`). `409 BOOST_NOT_CANCELLABLE` once completed or rejected; `404` for other users | mobile + webapp boost status (stage 4 button); `cancelled` added to the boost status types |
| Boost `status` | New value `cancelled` (owner cancel or post deleted) | mobile label "Stopped"; webapp type updated |
| Event `post.deleted` → go-ads; event `adBoost.cancelled` (new, `services/contracts/events/schemas/adBoost.cancelled.v1.json`) | Both bound to `ads-domain-events` | — |
| Ad billing history | New transaction type `ad_spend_debt` (TRU-001) | ads console label "Unpaid ad delivery" |
| Staff money actions: `POST /api/v1/admin/withdrawals/{id}/review`, `/admin/payouts/run`, `/admin/orders/{id}/escrow/refund`, `/admin/disputes/{id}/resolve`, `/admin/ledger/journal-entries/{id}/reversal`, `/admin/payments/webhooks/dead-letters/{id}/replay`, `/admin/payments/wallet-fundings/{ref}/reject`, `/admin/coins/transactions/{id}/reverse` | Step-up token is single-use (consumed in `ledger.step_up_consumptions`); a replay gets `401 STEP_UP_REUSED`. Other step-up routes keep the 5-minute window | admin BFF clears the step-up cookie after a money action and turns `STEP_UP_REUSED` into `STEP_UP_REQUIRED` (prompt again, no sign-out) |
| `GET /api/v1/admin/withdrawals?status=pending_review\|on_hold\|queued`, `GET /api/v1/admin/disputes?status=open\|awaiting_seller\|under_review` | Queues are oldest first (cursor moves forward); rows gain `ageHours`. History filters stay newest first | admin tables show a "Waiting" column |

## Stage 4 follow-ups (2026-10-11)

| Endpoint | Change | Clients |
|---|---|---|
| `GET /api/v1/payments/{reference}` | New, owner-only (404 for anyone else, 401 signed out): `{ id, reference, purpose, subjectId, provider, amount, status: pending\|succeeded\|failed\|cancelled, refundedAmount, paidAt, createdAt }`; a pending payment is verified with the provider first; never returns provider links | webapp `/pay/return` polls it. Coin return, mobile order payment (needs the saved card) and seller subscription confirmation (trial verify) keep their purpose endpoints |
| `POST /payments/initialize`, `POST /coins/purchases`, `POST /creators/{id}/subscriptions`, ads `POST …/top-ups` | `provider` is server-selected from `PAYMENTS_PROVIDER`; the old field is accepted (`flutterwave`) and ignored. Ads top-ups no longer require it; the stored provider is the one money used | all apps (no change needed) |
| `GET /api/v1/payments/wallet/me` | New `limits: { tier: basic\|mid\|full, dailyLimit, spentToday, remainingToday, resetsAt }` | webapp wallet card and mobile Add money show the user's own remaining amount |
| `POST /api/v1/orders/checkout` | `403 SELLER_DEBT_LIMIT` with `details.audience: "buyer"` and buyer copy ("This seller can't take new orders right now…"); `422 PAYMENT_AMOUNT_OUT_OF_RANGE` keeps `details` across the money gRPC hop; a refused checkout puts the items back in the cart | webapp and mobile show the buyer dialog |
| Subscription `channel` | the old provider-named web channel is now `web_checkout` (migration `20261011090000`) | admin, webapp mocks updated |
