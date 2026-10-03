# Frontend wiring: switching from mocks to the real backend

As of 2026-10-03. Mocks stay the default in every app. Nothing changes until a prefix variable is set. Gateway: `http://localhost:8080` (`pnpm backend:dev:gateway`, see `services/README.md`).

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
- Errors are `{ message, code, issues? }`. A 401 with no session opens the guest sign-in prompt (mobile: non-GET only; webapp: non-GET with `UNAUTHENTICATED`/`SESSION_EXPIRED`); with a session, one refresh then a retry, then sign-out. The gateway answers `UNAUTHENTICATED`.
- Profile images use upload intents and send `avatarMediaId`/`bannerMediaId`.
- Social sign-in sends the raw nonce. `503 SOCIAL_SIGN_IN_NOT_CONFIGURED` is shown as "not configured".
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
- [ ] Google/Apple sign-in with the raw nonce (needs provider config; otherwise "not configured").
- [ ] Guest 401 opens the sign-in prompt.

### 2. Users (`/api/v1/users`, `/api/v1/locale`, `/api/v1/currencies`, `/api/v1/geo`, `/api/v1/business-categories`)

- [ ] `GET /users/me`; a blank `name` shows the username.
- [ ] Edit profile: avatar and banner upload through intents; clearing sends `null`.
- [ ] Username policy, availability reasons, change errors.
- [ ] Profiles list and acting profile (mobile); business profile creation with `categories`.
- [ ] Addresses: list is an envelope, response has `countryCode`, geo ids, `display`. Mobile sends `countryId` (id or code) with state/LGA/city ids. Webapp address form has no geo pickers yet: do not switch addresses for the webapp until it does.
- [ ] Countries and currency in settings.
- Still mocked under these prefixes: `/users/me/settings`, `/topics`, `/users/me/topics`, `/users/me/blocked`, follows, verification, brands. Keep their paths out of the list until built (prefix `/api/v1/users` covers them, so expect 404s there until ts-social and settings land).

### 3. Social (`/api/v1/feeds`, `/api/v1/posts`, `/api/v1/follows`, `/api/v1/media`)

Backend: ts-social (`pnpm backend:dev:social`), ts.media later.

- [ ] Feeds paginate (`nextCursor` kept in the infinite queries).
- [ ] Post audience values match the server enum.
- [ ] Follow and unfollow with and without `Idempotency-Key`.
- [ ] Media upload via `/api/v1/media` (mobile chunk transport).

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
- [ ] Coin purchase body is `{packageId}`; app clients buy through IAP.
- [ ] Withdrawal response carries `fee`, `netAmount`, `withdrawalStatus`.
- [ ] Escrow and disputes: `GET /orders/:id/escrow`, `POST /orders/:id/disputes`.

### 7. Commerce (`/api/v1/products`, `/api/v1/carts`, `/api/v1/orders`, `/api/v1/stores`, `/api/v1/seller`)

- [ ] Orders list accepts bare array or page.
- [ ] Cart variant request (`size,color`) vs response (`variant`) agreed with go-commerce.
- [ ] Seller dashboard BFF reads `{data,nextCursor}`.

### 8. Ads (`/api/v1/ads`)

Apps: ads (and the mobile ad events path).

- [ ] Memberships, accounts, campaigns, reports, billing lists go through `adaptListEnvelope`.
- [ ] `Idempotency-Key` length (ads allows 256, server 8 to 128): keep keys under 128.

### 9. Admin (`/api/v1/admin`)

- [ ] Staff login with TOTP and step-up; step-up prompts still work.
- [ ] Tables use `{data,page,pageSize,total}`; cursor lists (audit log) show without page numbers.

## Contract tests

Mock responses are validated against per-endpoint schemas so drift is caught before a switch. No OpenAPI documents exist yet and `services/contracts/events` describes domain events, not HTTP, so the schemas are hand-written from the Go DTOs and `docs/backendPlan.md` (dependency-free validator in `src/contracts/contractSchema.util.ts`).

| App | Run | Covers |
| --- | --- | --- |
| mobile | `cd apps/mobile && npx jest` | users, auth, geo, live envelopes, username errors, envelope helpers |
| webapp | `cd apps/webapp && pnpm test:contracts` | auth, users, addresses, countries, suggested lives |
| studio | `cd apps/studio && pnpm test:contracts` | auth incl. social, live comments page |
| seller | `cd apps/seller && pnpm test:contracts` | login, error shape |
| ads | `cd apps/ads && pnpm test:contracts` | login, memberships, campaign list, adapter |
| admin | `cd apps/admin && pnpm test:contracts` | table envelope, adapter |

The web app tests use `tsx` (added as a devDependency; run `pnpm install` once). When a backend contract changes, edit the schema first, then the mock, then the client.
