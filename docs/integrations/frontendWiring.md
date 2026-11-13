# Frontend wiring: switching from mocks to the real backend

As of 2026-10-05, refreshed 2026-10-21 for routes that have since landed (contract check: [apiContractCheck.md](../verification/apiContractCheck.md)). Mocks stay the default in every app. Nothing changes until a prefix variable is set. Gateway: `http://localhost:8080` (`pnpm backend:dev:gateway`, see `services/README.md`).

## How the switch works

A request goes to the real gateway when its path starts with a listed prefix (segment boundary: `/api/v1/users` matches `/api/v1/users/me`, not `/api/v1/users-x`). Everything else keeps using the mocks. If the global mock flag is off, every request is real.

| App | Prefix variable | Global flag | API base URL variable (default) |
| --- | --- | --- | --- |
| mobile | `EXPO_PUBLIC_REAL_API_PREFIXES` | `EXPO_PUBLIC_USE_MOCKS` | `EXPO_PUBLIC_API_URL` (`http://localhost:8080`) |
| webapp | `WEBAPP_REAL_API_PREFIXES` | `WEBAPP_USE_MOCKS` | `WEBAPP_API_URL` |
| studio | `STUDIO_REAL_API_PREFIXES` | `STUDIO_USE_MOCKS` | `STUDIO_API_URL` |
| seller | `SELLER_REAL_API_PREFIXES` | `SELLER_USE_MOCKS` | `SELLER_API_URL` |
| ads | `ADS_REAL_API_PREFIXES` | `ADS_USE_MOCKS` | `ADS_API_URL` |
| admin | `ADMIN_REAL_API_PREFIXES` | `ADMIN_USE_MOCKS` | `ADMIN_API_URL` |

Prefixes are always full paths from the gateway root (`/api/v1/...`). The seller, ads and admin BFFs use paths without `/api/v1` internally; the switch adds it before matching, so the same prefix strings work in every app. Mobile extras: `/ws` controls the realtime mock emitter (realtime is a separate service on `:4000`, so leave it mocked until `ex.realtime` is wired), `/api/v1/media` the upload mock, `/api/v1/payments` the in-app browser stub.

Example, first domain on mobile and webapp:

```
EXPO_PUBLIC_REAL_API_PREFIXES=/api/v1/auth,/api/v1/users,/api/v1/locale,/api/v1/currencies,/api/v1/geo,/api/v1/business-categories
WEBAPP_REAL_API_PREFIXES=/api/v1/auth,/api/v1/users,/api/v1/locale,/api/v1/currencies,/api/v1/geo,/api/v1/business-categories
```

Expo inlines `EXPO_PUBLIC_*` at bundle time: restart Metro after changing it. Next BFFs read the variable per request.

## Conventions the clients now follow

- Lists are `{ data, nextCursor }`. Mobile `apiClient` returns the whole envelope when `nextCursor` is present and unwraps `{data}` only for single resources. Use `api.getPage` (cursor lists, infinite queries) or `api.getList` (array only; also accepts bare arrays).
- Ads and admin keep their internal `{items,...}` page types; `adaptListEnvelope` converts server `{data,nextCursor,total}` and `{data,page,pageSize,total}` at the client boundary. Mock handlers are converted the other way in the transport, so mock mode exercises the same path.
- Go services decode request bodies strictly: an unknown field is a `400 VALIDATION_FAILED`. Send only the DTO fields; extra UI-only fields break real calls even though the mocks accept them.
- Errors are `{ message, code, issues? }`. A 401 with no session opens the guest sign-in prompt (mobile: non-GET only; webapp: non-GET with `UNAUTHENTICATED`/`SESSION_EXPIRED`); with a session, one refresh then a retry, then sign-out. The gateway answers `UNAUTHENTICATED`.
- Profile images use upload intents and send `avatarMediaId`/`bannerMediaId`.
- Social sign-in sends a provider ID token plus the original nonce through the webapp BFF. Google uses Google Identity Services; Apple uses Sign in with Apple JS. The browser checks the returned token nonce, and the Go identity service verifies the signature, audience, expiry and nonce before creating a session. If the backend replies `BIRTHDAY_REQUIRED`, webapp retains that exact provider proof and retries it with the validated birthday rather than starting a second provider flow.
- Username errors: 409 `USERNAME_TAKEN`, 422 `USERNAME_INVALID|USERNAME_UNAVAILABLE`, 429 `USERNAME_CHANGE_TOO_SOON`; availability carries `reason`.
- `GET /lives/suggested` and `GET /lives/:id/viewers` are envelopes. Studio live comments are `Page<{author{...}}>`.

## Order and checklists

Switch one domain at a time, in this order. For each: set the prefixes, run the contract tests, click through the checklist, keep the domain on for the team, then move on.

### 1. Auth (`/api/v1/auth`)

Apps: mobile, webapp, studio, seller, ads. Backend: go-identity behind the gateway (`pnpm backend:dev:identity`, OTP codes are in its log).

- [ ] Sign up: OTP send, verify, register (webapp BFF sends `name`).
- [ ] Login by email and by username; wrong password shows the server message.
- [ ] Refresh rotation; reusing an old refresh token signs the user out.
- [ ] Password reset and change return 204; change keeps the current session.
- [ ] Google/Apple sign-in with configured provider client IDs and authorized web origin (webapp: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_APPLE_CLIENT_ID`; Apple also needs the web domain and return URL registered with Apple). Webapp keeps provider tokens in memory only and exchanges them through the same-origin BFF. With client IDs absent, mock mode uses its local demo identity; real mode reports provider sign-in as not configured.
- [ ] Guest 401 opens the sign-in prompt.

### 2. Users (`/api/v1/users`, `/api/v1/locale`, `/api/v1/currencies`, `/api/v1/geo`, `/api/v1/business-categories`)

- [ ] `GET /users/me`; a blank `name` shows the username.
- [ ] Edit profile: avatar and banner upload through intents; clearing sends `null`.
- [ ] Username policy, availability reasons, change errors.
- [ ] Profiles list and acting profile (mobile); business profile creation with `categories`.
- [ ] Addresses: list is an envelope, response has `countryCode`, geo ids, `display`. Mobile sends `countryId` (id or code) with state/LGA/city ids. Webapp address form has no geo pickers yet: do not switch addresses for the webapp until it does.
- [ ] Countries and currency in settings. Theme is stored server-side: `PATCH /users/me/preferences` accepts `theme` (`system|light|dark`); `GET /users/me` returns it. The seller app already sends it.
- [ ] Privacy: consents `GET/PUT /users/me/consents` (web cookie banner uses the PUT when signed in), export `GET/POST /users/me/data-exports`, deletion `POST /users/me/deletion-request {confirm, reason}`.
- [ ] Webapp guests: `/lives/suggested`, `/users/suggested`, `/gifts`, `/lives/:id/comments`, `/users/:id` need auth at the gateway, so guests get 401 once these are switched.
- Still mocked under these prefixes: `/users/me/settings`, `/topics`, `/users/me/topics`, `/users/me/blocked`, follows, verification, brands. Keep their paths out of the list until built (prefix `/api/v1/users` covers them, so expect 404s there until ts-social and settings land).

### 3. Social (`/api/v1/feeds`, `/api/v1/posts`, `/api/v1/follows`, `/api/v1/media`)

Backend: ts-social (`pnpm backend:dev:social`), ts.media later.

- [ ] Feeds paginate (`nextCursor` kept in the infinite queries).
- [ ] Post audience values match the server enum.
- [ ] Follow and unfollow with and without `Idempotency-Key`.
- [ ] Media upload via `/api/v1/media` (mobile chunk transport).
- [ ] Tagged people: composer sends `taggedUserIds` (max 20, untaggable ids dropped silently); posts carry `taggedUsers` (first 3) and `taggedUsersCount`; `GET /posts/:id/tagged-users` returns `{ data, nextCursor }` (guests allowed, 404 when hidden); `DELETE /posts/:id/tags/me`; author edits with `PUT /posts/:id/tags`; `GET/PUT /me/tagging-settings` for `allowTagging`. `GET /tags/candidates?q=` is live (tagging-off users are omitted, not shown disabled).

### 4. Notifications (`/api/v1/notifications`)

- [ ] Mobile and webapp inbox render a bare array or an envelope.
- [ ] Mark read, read all, unread count.

### 5. Live (`/api/v1/lives`, `/api/v1/gifts`, `/ws`)

- [ ] Suggested lives and viewers are envelopes (mobile, webapp).
- [ ] Studio: create (title and category), start, end, comments as pages, pinned products.
- [ ] Gifts catalogue ids come from the server; add `/ws` only when realtime is up.

### 6. Money (`/api/v1/wallets`, `/api/v1/coins`, `/api/v1/payments`, `/api/v1/banks`, `/api/v1/disputes`)

Payout onboarding screens are owned by another workstream; coordinate before switching `/wallets`.

- [ ] Lists are envelopes (`getList` handles them).
- [ ] Coin purchase body is `{packageId}` (no `channel`); app clients buy through IAP.
- [ ] Mobile checkout: `POST /payments/initialize {orderId, provider}`; a saved card is charged with `POST /payments/saved-cards/charges {paymentReference, savedCardId}` after initialize. Saving a new card needs `/payments/saved-cards/setups` (not wired).
- [ ] Withdrawal response carries `fee`, `netAmount`, `withdrawalStatus`.
- [ ] Escrow and disputes: `GET /orders/:id/escrow`, `POST /orders/:id/disputes`.

### 7. Commerce (`/api/v1/products`, `/api/v1/carts`, `/api/v1/orders`, `/api/v1/stores`, `/api/v1/seller`)

- [ ] Orders list accepts bare array or page.
- [ ] Cart variant request (`size,color`) vs response (`variant`) agreed with go-commerce.
- [ ] Seller dashboard BFF reads `{data,nextCursor}`.
- [x] Seller domains backed 2026-10-05: settings, storefront, staff and audit log, wallet and payouts, finance, dashboard, analytics, delivery areas, customers (create/update, segments), marketing overview and product options. `apps/seller/.env.example` now lists them in `SELLER_REAL_API_PREFIXES` (mocks stay the default switch).
- [x] Payout onboarding: the dashboard calls `/payments/payout-onboarding/me/*` and `/payments/payout-fees`; the BFF forwards them (owner only, `wallet:withdraw`).
- [x] Store rewards save through `PUT /seller/marketing/rewards/settings` (the settings PATCH no longer carries `storeRewards`).
- [ ] Still mocked: brands workspace, developers (API keys and webhooks), integrations and ads summary. Affiliates, conversations, security sessions, subscription details/verify/trial verify and cancel, verification, preferences, consents and product import now have Go routes and are in `SELLER_REAL_API_PREFIXES`. Business documents still need the two-step upload.
- [ ] App side: the Nantty app must show team requests (`GET /stores/team-requests`, accept/decline) so invited staff can join.

### 8. Ads (`/api/v1/ads`)

Apps: ads (and the mobile ad events path).

- [ ] Memberships, accounts, campaigns, reports, billing lists go through `adaptListEnvelope`.
- [ ] `Idempotency-Key` length (ads allows 256, server 8 to 128): keep keys under 128. Required on account, campaign, duplicate, ad set, ad, customer list and boost creation (all sent now).
- [x] Invites: go-ads accepts `{email, role}` or `{username, role}`; an email-shaped username is looked up as an email. The UI can invite by email without a backend change.
- [ ] Payment methods and `POST /creatives/preview` are still mock-only. Billing top-ups, top-up status, invoices, receipts, conversion events, experiments, rules, locations and behaviours now have go-ads routes.

### 9. Admin (`/api/v1/admin`)

- [ ] Staff login with TOTP and step-up; step-up prompts still work. The BFF now speaks the backend shape (`challengeToken`, `/mfa/enroll/start|confirm`, `staff`). Passkeys, recovery codes and own-account sessions are mounted under `/admin/account/*`.
- [ ] Metrics overview, appeals, orders, refunds, payouts, coins, ledger, catalog admin, brands and reserved usernames now have admin routes. Remaining gaps include automation, withheld-usernames/confusables preview, email-template preview, payout detail/decide and coin review actions; verify route-by-route before switching each area.
- [ ] Tables use `{data,page,pageSize,total}`; cursor lists (audit log) show without page numbers.

## Contract tests

Mock responses are validated against per-endpoint schemas so drift is caught before a switch. No OpenAPI documents exist yet and `services/contracts/events` describes domain events, not HTTP, so the schemas are hand-written from the Go DTOs and `docs/backendPlan.md` (dependency-free validator in `src/contracts/contractSchema.util.ts`).

| App | Run | Covers |
| --- | --- | --- |
| mobile | `cd apps/mobile && npx jest` | users, auth, geo, live envelopes, username errors, envelope helpers |
| webapp | `cd apps/webapp && pnpm test:contracts` | auth, users, addresses, countries, suggested lives |
| studio | `cd apps/studio && pnpm test:contracts` | auth incl. social, live comments page |
| seller | `cd apps/seller && pnpm test:contracts` | login, error shape, 22 newly backed endpoints (`sellerDomains.contract.ts`) |
| ads | `cd apps/ads && pnpm test:contracts` | login, memberships, campaign list, adapter |
| admin | `cd apps/admin && pnpm test:contracts` | table envelope, adapter |

Live run: `services/scripts/apiSmoke/tests/frontendContracts.smoke.test.ts` loads the mobile, webapp and studio contract lists and checks them (plus seller login, ads memberships and admin table envelopes) against the real gateway with a fresh user and superadmin. It runs with the rest of apiSmoke (`pnpm backend:test:smoke`, needs `SMOKE_IDENTITY_LOG`). Contracts that use mock fixture ids are skipped.

The web app tests use `tsx` (added as a devDependency; run `pnpm install` once). When a backend contract changes, edit the schema first, then the mock, then the client.
