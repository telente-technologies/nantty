# Nantty Dashboard

The seller operating system for Nantty, served on its own subdomain: `https://dashboard.<domain>` (for example `https://dashboard.nantty.com`).

**Nantty App = sell from anywhere. Nantty Dashboard = run your business.** Free for every approved Nantty seller — upgrade to Pro or Business when you grow. There is no in-store register: online orders are the marketplace orders customers place in the Nantty app, and team members are existing Nantty users who sign in with their own app credentials.

## Plans and gating

- Access needs only an approved store membership. Gold verification and paid plans are not required; a store without an active subscription is on **Free**. Suspended or revoked stores see a restricted page.
- Plans are `free | pro | business`. Every gated feature and limit lives in `src/config/planFeatures.config.ts` (`minimumPlanByFeature`, `planLimitsByPlan`); components use `usePlanFeatures()` and `PlanGate` / `PlanLockedNotice` / `FeaturePlanBadge` from `src/components/billing/planGate.tsx`. Locked features stay visible with an upgrade link.
- Roles: Owner, Manager, Inventory staff, Sales staff, Accountant (`src/constants/roles.constant.ts`), with default permissions in `src/config/rolePermissions.config.ts`. Business stores can give a member a custom permission list (`StaffMember.permissions`).

## Run it

```bash
cp .env.example .env.local   # optional; development defaults work without it
pnpm dev                     # http://localhost:3200, demo data on by default
```

With `SELLER_USE_MOCKS=true` (the default in development) every API call is answered by an in-memory demo backend with Nigerian demo stores. Sign in with any demo account listed on the sign-in page; the password is `Nantty2026!`. Ìfẹ́ Lifestyle is on Business, Adire Lab Studio on Pro, Kelechi Kicks and Funmi Bakes on Free.

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public URL of the dashboard, used for metadata and absolute links. Dev: `http://localhost:3200`. Prod: `https://dashboard.nantty.com`. |
| `DASHBOARD_ORIGIN` | Origin accepted for state-changing requests (CSRF origin check). Usually the same as `NEXT_PUBLIC_SITE_URL`. |
| `SELLER_API_URL` | Base URL of the Nantty API (server-side only). |
| `SELLER_MEDIA_URL` | Optional media CDN origin allowed in the image CSP. |
| `SELLER_USE_MOCKS` | `true` to use the demo backend. Defaults to `true` in development and `false` in production. |
| `SELLER_SESSION_SECRET` | At least 32 random characters. Signs session, access-cache, operator and CSRF values. Required in production. |
| `NEXT_PUBLIC_ADS_MANAGER_URL` | Link target of the "Advertise" item (the separate Ads Manager app). Dev default `http://localhost:3300`, prod default `https://ads.nantty.com`. |

## Hosting on the dashboard subdomain

- Session cookies are **host-only** (no `Domain` attribute), `HttpOnly`, `Secure`, `SameSite=Lax`, and use the `__Host-` prefix in production, so they are never shared with the marketing site or any other subdomain.
- The API must allow CORS for the dashboard origin (`DASHBOARD_ORIGIN`) in `CORS_ORIGINS`. Today all calls go server-to-server through the dashboard's `/bff` routes, but the origin must be on the allow-list for any browser call and for the payment provider callback flow.
- Register `${DASHBOARD_ORIGIN}/billing-checkout/callback` as the Flutterwave callback URL for Pro and Business subscription payments.

## Security design

- **Backend-for-Frontend.** The browser never sees API tokens. `/bff/auth/login` exchanges credentials for tokens and stores them in httpOnly cookies; `/bff/[...path]` forwards allow-listed `/seller/*` and `/media/*` calls with the bearer token, refreshing and rotating tokens on `401`.
- **CSRF.** Every mutation must come from the dashboard origin (`Origin` and `Sec-Fetch-Site` checks) and carry `X-CSRF-Token`, an HMAC of the session id that the server renders into the page.
- **Server-side authorisation.** `src/proxy.ts` gates every page (signed in → store member → store not restricted → permission). The BFF re-checks the member's permissions for every API call against `src/config/rolePermissions.config.ts` (deny by default) before forwarding; the API enforces the same rules and plan gating (`402 PLAN_FEATURE_REQUIRED`) again.
- **Headers.** CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, COOP and a Permissions-Policy that allows the camera only for this origin.
- **Money.** Integer minor units with an explicit currency from the store's settings; the server recomputes all totals. Money-moving and stock-changing calls send an `Idempotency-Key`. Amounts are always `{ amountMinor, currency }` and formatted with `src/utils/money.util.ts`.

## API contract

See [`apiContract.md`](./apiContract.md) for every endpoint the dashboard uses.
