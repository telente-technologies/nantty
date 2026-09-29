# Zudomart Dashboard

Back office and point of sale for Gold-verified Zudomart sellers, served on its own subdomain: `https://dashboard.<domain>` (for example `https://dashboard.zudomart.com`).

## Run it

```bash
cp .env.example .env.local   # optional; development defaults work without it
pnpm dev                     # http://localhost:3200, demo data on by default
```

With `SELLER_USE_MOCKS=true` (the default in development) every API call is answered by an in-memory demo backend with Nigerian demo stores. Sign in with any demo account listed on the sign-in page; the password is `Zudomart2026!`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public URL of the dashboard, used for metadata and absolute links. Dev: `http://localhost:3200`. Prod: `https://dashboard.zudomart.com`. |
| `DASHBOARD_ORIGIN` | Origin accepted for state-changing requests (CSRF origin check). Usually the same as `NEXT_PUBLIC_SITE_URL`. |
| `SELLER_API_URL` | Base URL of the Zudomart API (server-side only). |
| `SELLER_MEDIA_URL` | Optional media CDN origin allowed in the image CSP. |
| `SELLER_USE_MOCKS` | `true` to use the demo backend. Defaults to `true` in development and `false` in production. |
| `SELLER_SESSION_SECRET` | At least 32 random characters. Signs session, access-cache, operator and CSRF values. Required in production. |
| `NEXT_PUBLIC_ADS_MANAGER_URL` | Link target of the "Advertise" item (the separate Ads Manager app). Dev default `http://localhost:3300`, prod default `https://ads.zudomart.com`. |

## Hosting on the dashboard subdomain

- Session cookies are **host-only** (no `Domain` attribute), `HttpOnly`, `Secure`, `SameSite=Lax`, and use the `__Host-` prefix in production, so they are never shared with the marketing site or any other subdomain.
- The API must allow CORS for the dashboard origin (`DASHBOARD_ORIGIN`) in `CORS_ORIGINS`. Today all calls go server-to-server through the dashboard's `/bff` routes, but the origin must be on the allow-list for any browser call and for the payment provider callback flow.
- Register `${DASHBOARD_ORIGIN}/billing-checkout/callback` as the Paystack/Flutterwave callback URL for Gold subscription payments.

## Security design

- **Backend-for-Frontend.** The browser never sees API tokens. `/bff/auth/login` exchanges credentials for tokens and stores them in httpOnly cookies; `/bff/[...path]` forwards allow-listed `/seller/*` and `/media/*` calls with the bearer token, refreshing and rotating tokens on `401`.
- **CSRF.** Every mutation must come from the dashboard origin (`Origin` and `Sec-Fetch-Site` checks) and carry `X-CSRF-Token`, an HMAC of the session id that the server renders into the page.
- **Server-side authorisation.** `src/proxy.ts` gates every page (signed in → store member → verified → active Gold plan → role permission). The BFF re-checks the role for every API call against `src/config/rolePermissions.config.ts` (deny by default) before forwarding; the API enforces the same rules again.
- **Shared-device cashiers.** A cashier's PIN session token lives in a signed httpOnly cookie and is sent to the API as `X-Seller-Operator`; the effective role becomes the cashier's role. PINs are hashed and locked after repeated failures on the server.
- **Headers.** CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, COOP and a Permissions-Policy that allows the camera only for this origin (barcode scanning).
- **Money.** Integer minor units with an explicit currency from the store's settings; the server recomputes all totals. Money-moving and stock-changing calls send an `Idempotency-Key`.

## API contract

See [`apiContract.md`](./apiContract.md) for every endpoint the dashboard uses.
