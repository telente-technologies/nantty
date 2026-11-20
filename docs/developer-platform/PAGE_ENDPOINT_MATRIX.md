# Page-to-Endpoint Inventory & Permission Matrix

## Developer Portal (`apps/developer`)

| Route | Purpose | Backend / BFF Dependencies | Auth & Gate | Status |
| --- | --- | --- | --- | --- |
| `/` | Public developer landing | Static + `/api/auth/login` | Public | `IMPLEMENTED_UNVERIFIED` |
| `/products`, `/products/messaging` | API product catalog & Messaging preview | Static catalog + `buildBusinessMessagingOpenApiSpec()` | Public | `IMPLEMENTED_UNVERIFIED` |
| `/pricing`, `/changelog`, `/security`, `/support`, `/legal/*` | Public plans, changelog, trust & preview legal docs | Static version-controlled content | Public | `IMPLEMENTED_UNVERIFIED` |
| `/docs`, `/docs/[slug]`, `/docs/openapi.json` | Documentation & OpenAPI 3.1 JSON | `buildBusinessMessagingOpenApiSpec()` | Public | `IMPLEMENTED_UNVERIFIED` |
| `/onboarding` | Resumable onboarding checklist | `/api/auth/session`, `/api/developer/organizations`, `/applications` | SSO session | `IMPLEMENTED_UNVERIFIED` |
| `/dashboard`, `/organization` | Org overview, members, roles, invites | `/api/developer/organizations/*`, `/api/developer/invitations/*` | SSO + Org membership | `IMPLEMENTED_UNVERIFIED` |
| `/invitations/[token]` | Organization invitation acceptance | `POST /api/developer/invitations/{id}` | SSO + invitee account | `IMPLEMENTED_UNVERIFIED` |
| `/applications` | App lifecycle & per-member grants | `/api/developer/organizations/{orgId}/applications/*` | SSO + Org role | `IMPLEMENTED_UNVERIFIED` |
| `/credentials` | Sandbox and production key lifecycle, including production rotation; secret is shown only at creation/rotation | `/api/developer/credentials*` (Sandbox) & `/api/developer/organizations/{orgId}/applications/{appId}/credentials*` (Prod) | Prod requires `status = approved`; capability and member grant enforced; rotation revokes/reissues atomically and writes an organization audit record | `IMPLEMENTED_UNVERIFIED` |
| `/webhooks` | Sandbox & Prod webhooks (`/verify`, `/rotate-secret`) | `/api/developer/webhooks*` & `/api/developer/organizations/{orgId}/applications/{appId}/webhooks*` | Prod requires `status = approved` + challenge | `IMPLEMENTED_UNVERIFIED` |
| `/requests`, `/usage` | Redacted request logs & monthly quota utilization | `/api/developer/{requests,usage}` & Prod `/requests`, `/usage` | Org membership + app grant | `IMPLEMENTED_UNVERIFIED` |
| `/billing` | Organization billing status and Sandbox selection; paid checkout unavailable pending verified settlement integration | `GET/POST /api/developer/organizations/{orgId}/billing(/checkout)` | Org billing capability + `developer_billing_subscriptions`; paid production requires verified settlement evidence | `IMPLEMENTED_UNVERIFIED` |
| `/businesses`, `/audit-logs`, `/sandbox` | App member grants, audit trail & Sandbox bridge | `/applications/{appId}/members`, `/audit-log`, `NEXT_PUBLIC_SANDBOX_PORTAL_URL` | Org membership | `IMPLEMENTED_UNVERIFIED` |

## Production Business Messaging & Admin & Seller APIs

Correction (2026-11-20): only consent-scoped conversation listing is enabled. The send route continues to return `503 BUSINESS_MESSAGING_UNAVAILABLE`; handler scaffolding is not a usable send, history, receipt, template, media, interactive-message or handover integration.

| Surface | Canonical Endpoints | Enforcement |
| --- | --- | --- |
| Developer SSO | `GET /api/v1/auth/sso/authorize`, `POST /api/v1/auth/sso/token` | PKCE S256, single-use code hash, redirect allowlist |
| Production Business Messaging | `POST /api/v1/business/messages`, `GET /api/v1/business/conversations` | Send remains unavailable; conversation listing is backed by active consent and requires an approved application, `conversations:read` scope and production quota |
| Admin Developer Ops | `GET /api/v1/admin/developer/applications`, `POST .../review`, `PATCH .../quota` | Privileged Admin token + step-up permission; quota changes only `monthly_quota` on an existing active paid subscription; review/quota mutations and audit writes share a transaction |
| Seller Developer API | `GET/POST/DELETE /api/v1/seller/developers/{keys,webhooks}` | Store owner + Pro subscription + SSRF check |
| Messenger (`apps/messenger`) | `/api/v1/conversations*`, `/api/v1/stories*`, realtime WS | User bearer token, E2EE `@nantty/chat-crypto` |

## Role Enforcement Matrix (Backend Enforced)
- **Organization Owner / Admin**: Manage members, invitations, ownership transfer (step-up token required), applications, billing checkout, credentials, webhooks, and audit logs.
- **Developer**: Manage applications, credentials (subject to per-app grants & production approval), webhooks, and Sandbox testing; cannot transfer ownership.
- **Billing / Analyst / Viewer**: Restricted by Identity organization role & application capability checks (`RequireMemberAndApprovedApp`); hidden nav never replaces backend checks.
