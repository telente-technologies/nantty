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

Correction (2026-11-25): authenticated account-level recipient consent (`/api/v1/account/business-messaging/consents`) and a separate Commerce-verified business/store authorization API (`/api/v1/account/business-messaging/authorizations`) are implemented. Web Privacy & Data now includes an owner-facing manual app/store grant and revoke screen, and approved-app preview is available through authenticated `GET /api/v1/account/business-messaging/applications/{applicationID}`. This is not an app-initiated OAuth grant handoff; browser workflow remains unverified. Consent-scoped conversation listing and persisted outbound message history/status reads are enabled with bounded cursor pagination. The send route continues to return `503 BUSINESS_MESSAGING_UNAVAILABLE`; inbound synchronization, delivery/read receipts, templates, media, interactive messages and handover are not implemented.

Store-scope correction (2026-11-25): PR #72 additionally requires `storeId` for conversation/history reads and checks the active store grant's exact capability alongside recipient consent. Status reads enforce the stored message's store grant and active consent. The dormant send implementation/reservation includes store scope and store-bound idempotency, but the mounted POST route remains 503. PR #72 is open and not deployed; see `docs/master/NANTTY_REQUIREMENTS_MATRIX.md` for tests and limitations.

| Surface | Canonical Endpoints | Enforcement |
| --- | --- | --- |
| Developer SSO | `GET /api/v1/auth/sso/authorize`, `POST /api/v1/auth/sso/token` | PKCE S256, single-use code hash, redirect allowlist |
| Account messaging consent | `GET/POST /api/v1/account/business-messaging/consents`, `DELETE .../consents/{consentId}` | Verified Nantty account; only approved Business Messaging apps; requested allowlisted scopes; account-scoped revocation and audit. Does not replace business/store authorization. |
| Production Business Messaging | `POST /api/v1/business/messages`, `GET /api/v1/business/conversations`, `GET /api/v1/business/conversations/{recipientId}/messages`, `GET /api/v1/business/messages/{messageId}` | Send remains unavailable (503). PR #72 requires `storeId` for conversation/history listing and exact active app+store capability plus active recipient consent; status validates persisted store authorization and recipient consent. History is limited to messages persisted by this API with non-null store association. PR is open and not deployed. Inbound sync and delivery/read receipts remain incomplete. |
| Nantty account Business Messaging consents | `GET/POST /api/v1/account/business-messaging/consents`, `DELETE /api/v1/account/business-messaging/consents/{consentId}` | Verified account session; self-scoped list/revoke, approved app check and requested-scope subset on grants, transactional audit. Web Privacy & Data settings show grants and revoke active ones. Separate from business/store authorization. |
| Nantty business/store authorizations | `GET /api/v1/account/business-messaging/applications/{applicationID}`, `GET/POST /api/v1/account/business-messaging/authorizations`, `DELETE .../authorizations/{authorizationID}` | Verified account session; preview exposes only approved-app identity/requested scopes; grant enforces requested-scope subset, Commerce-confirmed active store membership with `developer:manage`, dedicated internal token and transactional audit. Privacy & Data offers manual preview/store/scope selection plus list/revoke. Auth DB tests and Gateway suite pass; browser and app-initiated OAuth handoff remain unverified. Does not enable production send. |
| Admin Developer Ops | `GET /api/v1/admin/developer/applications`, `POST .../review`, `PATCH .../quota` | Privileged Admin token + step-up permission; quota changes only `monthly_quota` on an existing active paid subscription; review/quota mutations and audit writes share a transaction |
| Seller Developer API | `GET/POST/DELETE /api/v1/seller/developers/{keys,webhooks}` | Store owner + Pro subscription + SSRF check |
| Messenger (`apps/messenger`) | `/api/v1/conversations*`, `/api/v1/stories*`, realtime WS | User bearer token, E2EE `@nantty/chat-crypto` |

## Role Enforcement Matrix (Backend Enforced)
- **Organization Owner / Admin**: Manage members, invitations, ownership transfer (step-up token required), applications, billing checkout, credentials, webhooks, and audit logs.
- **Developer**: Manage applications, credentials (subject to per-app grants & production approval), webhooks, and Sandbox testing; cannot transfer ownership.
- **Billing / Analyst / Viewer**: Restricted by Identity organization role & application capability checks (`RequireMemberAndApprovedApp`); hidden nav never replaces backend checks.
