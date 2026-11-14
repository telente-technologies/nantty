# Messenger and Developer Platform page inventory

This inventory records the repository state as of 2026-11-14. “Implemented” means a route/component and its real service contract exist; it does not imply production deployment or complete visual QA. Planned routes are intentionally not shown as callable APIs.

## Nantty Messenger

| Page/state | Route or entry | Access | Backend dependency | States and status | Verification |
|---|---|---|---|---|---|
| Sign in | App root, signed out | Existing Nantty account | `POST /api/v1/auth/messenger/authorizations` | Validation, loading, generic credential/network errors; **implemented** | TypeScript compile; native render not available |
| Device approval | App root, authorization required | Proof-bound pending request | Authorization status, approve/code/recovery, then `/complete` | Pending, approved, denied, expired, invalid code, recovery; denial/expiry now remain visible with a retry path; **implemented** | UI TypeScript compile passed; Go integration tests require configured PostgreSQL and were not rerun in this UI slice |
| Forgot/reset password | App root → Forgot password | Existing Nantty account | Existing `/api/v1/auth/otp/send`, `/verify`, `/password/reset` | Email, code, password, success, error; **implemented** | TypeScript compile; live API unavailable |
| Inbox | Signed-in app shell | Authenticated Messenger session | `GET /api/v1/conversations?filter=all` | Loading, empty, error, populated; **implemented as read-only list** | 5 contract tests pass |
| Conversation, send, realtime | Not yet routed | Authenticated | Message/realtime contracts not integrated | **Missing** | No end-to-end test |
| Stories | App shell Stories section | Authenticated | Shared tray/list/seen endpoints integrated; publishing, encrypted replies, and video playback remain missing | Data-backed tray and photo viewer; video poster-only; **partial** | Service parsing/endpoints and app TypeScript tests pass; native visual/runtime flow not exercised |
| Security requests/devices | Main Nantty Settings → Security | Existing Nantty session | `/api/v1/auth/messenger/authorizations`, `/devices` | Loading, empty, error, approve, deny, issue code, revoke; **implemented** | Main app TypeScript compile |

Detailed security contract: [`messenger-auth-contract.md`](messenger-auth-contract.md).

## Developer Platform

| Page | Route | Intended access | Current dependency/status | Required states/test coverage |
|---|---|---|---|---|
| Public developer home | `/` | Public | Nantty-branded, truthful preview landing page; status is static and not backed by a developer API | Browser accessibility tree inspected; full viewport screenshot and visual regression remain outstanding |
| Public API documentation | `/docs`, plus host rewrite for `docs.nantty.com/` | Public | Nantty-branded documentation shell and Business Messaging contract preview; routes remain explicitly draft and requests disabled | Developer production build, static route generation, and local host-header smoke test passed; actual custom-domain attachment/deployment not present |
| Business Messaging contract preview | `/messaging`, `/docs/business-messaging`, `/docs/messaging`; on the docs host also `/business-messaging` and `/messaging` | Public | Proposed endpoint map, scope and webhook event inventory, and explicit privacy/release gates; no API traffic is simulated | Developer production build and local host-header smoke test passed |
| Workspace preview | `/dashboard` | Public, non-operational preview only | Preview shell. Organization/application, credential, public messaging, webhook, request-log and billing services are **not connected** | No management actions or fabricated records are exposed; authentication and operational states are not wired |
| Developer sections | `/applications`, `/credentials`, `/docs`, `/messaging`, `/webhooks`, `/requests`, `/usage` | Nantty login + organization roles (not yet wired) | Preview shell. Organization/application, credential, public messaging, webhook, request-log and billing services are **not connected** | Loading, empty, unauthorized, forbidden, quota, server and success states not operational |
| Product catalog, plans, changelog, OpenAPI, status | Spec routes/endpoints | Public | **Missing or not established as published API contracts** | Contract and response tests required |
| Developer onboarding/organization | `GET`/`POST /api/v1/developer/organizations`, organization detail/access/roles, member list/detail, and `PATCH /{organizationId}/members/{memberId}` through the gateway to Go Identity | Verified Nantty session; creator becomes owner; team reads and role changes require Owner/Admin | **Backend foundation implemented; portal sign-in/UI integration and database-backed verification remain** | Authenticated route and role-policy tests; DB integration blocked by local PostgreSQL |

The section configuration explicitly says no application records, secrets, request logs, usage, or public API traffic are simulated. It must remain non-operational until the owning services exist.

`apps/developer/src/proxy.ts` maps the exact `docs.nantty.com` host to the public `/docs` route and its documentation aliases. This is a code-level route only. A read-only Cloudflare Pages inventory on 2026-11-13 found projects for the main site, Studio, Creator, and Ads, but no Developer project; the repository's existing Pages deploy workflow deploys `apps/web` to `nantty-main`. Therefore the docs hostname is not live. It needs a compatible deployment for `apps/developer` and the `docs.nantty.com` custom-domain binding before launch. No Cloudflare resources or DNS were changed.

## Sandbox

| Page | Route | Intended access | Current dependency/status | Required states/test coverage |
|---|---|---|---|---|
| Test applications | `/test-apps` | Developer organization member | Preview only; sandbox credential/tenant service **not connected** | Empty, create, validation, quota, error; no real service yet |
| API explorer | `/explorer` | Authorized developer | Disabled preview; isolated API and test credentials **missing** | Request/response, auth failure, rate limit and isolation tests |
| Messaging scenarios | `/messaging`, `/scenarios` | Authorized developer | Preview only; deterministic synthetic business/customer/conversation service **missing** | Scenario lifecycle and reset tests |
| Webhook events | `/events` | Authorized developer | Preview only; signing/delivery/SSRF safeguards **missing** | Signature, retry, replay and dead-letter tests |
| Request log and guide | `/requests`, `/docs` | Authorized developer / public docs as appropriate | Preview content; no sandbox traffic/API contract **published** | Redaction, environment separation and documentation contract tests |

## Internal administration

| Capability | Current route/evidence | Status |
|---|---|---|
| Developer/Sandbox support ticket triage | Admin support ticket filters | Present for support categorization only |
| Organization, app, production approval, quota, billing and sandbox operations | No matching developer-platform admin workspace or service routes found | **Missing** |

## Implemented authorization endpoints

Messenger device authorization remains integrated through Go Identity. New installation identifiers use Expo Crypto `randomUUID()` instead of `Math.random()`; previously stored identifiers remain valid and are not forcibly rotated. Its canonical routes and proof handling are specified in [`messenger-auth-contract.md`](messenger-auth-contract.md).

Developer organization foundation adds authenticated `GET` and `POST /api/v1/developer/organizations`, membership-scoped organization detail/access/roles/member list/member detail reads, `PATCH` role updates, and `DELETE /api/v1/developer/organizations/{organizationId}/members/{memberId}` in Go Identity, proxied by the gateway. Organization records and memberships use the existing auth database; creation gives the verified creator the `owner` role. Team reads and mutations require `members.manage` (currently Owner/Admin). Team responses return account ID, username, display name, organization role, account status, and join time without exposing email addresses. Member detail includes the target role's capability catalog, not application grants. Role changes accept only schema-supported roles, keep ownership transfer out of PATCH, reject owner reassignment, and prevent admins from granting billing capabilities. Member removal locks the organization and membership rows, prevents removing an owner or a role beyond the actor's grant authority, and writes an append-only audit event in the same database transaction as the deletion. Role changes use the same transactional audit pattern; creation is also recorded. A failed audit insert rolls back the mutation. The roles catalog reports only the five roles currently assignable in the database schema: owner, admin, developer, analyst, and billing; it does not advertise the proposed `security_manager` or `viewer` roles. The access response exposes the server-owned role policy with organization-level and application-level capabilities separated. Owner receives organization/member/billing/security capabilities; Admin receives organization/member capabilities; Developer and Analyst receive organization-read capability; Billing receives organization-read and billing capabilities. At application scope, Owner/Admin can manage applications, credentials, webhooks, request logs, and usage; Developer can read applications and manage credentials/webhooks or read logs/usage; Analyst can read logs/usage; Billing has no application capabilities. Every application capability requires an explicit grant for that application. The access response is descriptive and does not itself authorize application data; every eventual resource handler must enforce both checks. Unknown roles deny access. Creation requires an `Idempotency-Key` and replays the original result for 24 hours. Slugs are unique and validated. Pure role-policy tests and Gateway route tests pass. Database-backed organization integration tests cover creation, membership isolation, details, roles, member authorization, and transactional role-change auditing but skip locally because the configured PostgreSQL test service is unreachable/authentication fails; no database or stack changes were made. Member-removal database behavior is implemented but awaits execution against a reachable PostgreSQL test database. This is not a complete team-management or resource-authorization system: invitations, ownership transfer, persisted application grants, organization updates, browser login integration, downstream resource enforcement, and database-backed integration verification remain outstanding. No credentials, webhooks, billing, logs, sandbox execution, or public messaging operations were added. Existing public Business Messaging routes in the V1 product specification remain proposals until owner services, OpenAPI contracts, permission checks and environment isolation tests are implemented.

## Next implementation slices

1. Deploy the Developer app on a compatible Next.js runtime and attach `docs.nantty.com`; keep the route host restricted to that exact hostname.
2. Integrate existing Nantty web authentication with the organization endpoints, then add invitation/member administration and persisted application grants before application CRUD. Enforce the role policy and grant checks in every resource handler; the access endpoint is descriptive, not a substitute for authorization.
3. Establish isolated sandbox credentials and synthetic tenants before enabling the API explorer or scenario controls.
4. Add developer billing/entitlements and privileged admin review only after authoritative usage, payment reconciliation, and permission policies exist.

The frontend CI matrix now includes Developer and Sandbox changes, their typed/linted builds, and production mock-marker checks. The workflow supplies the applications' required public origins at build time; this is CI validation, not deployment.

Do not remove the preview-state copy or enable actions until these dependencies and their negative authorization tests are verified.

## Completion matrix and implementation order

This matrix distinguishes present code from the proposed product. “Missing” is not a UI defect that should be hidden with mock records; it requires an owned backend contract and authorization policy.

| Workstream | Repository evidence today | Status | Safe next implementation gate |
|---|---|---|---|
| Public Developer/Sandbox presentation | Separate Next.js apps, shared Nantty theme, responsive navigation, truthful preview states | Implemented in source; local browser/build verification exists, deployment unverified | Attach each app to an owned deployment target and verify production host routing before launch |
| Gateway readiness | `/api/platform-readiness` proxies the configured gateway `/readyz` endpoint with timeout, redirect rejection, no-store response and rejection of credential/query/hash-bearing base URLs | Implemented; Developer typecheck/lint/build passed; production route smoke test correctly returned `not_configured` for rejected credential-bearing configuration | Keep this as infrastructure readiness only; it must not imply developer API readiness |
| Developer orgs and memberships | Authenticated Identity routes, SQL migration, account-owned membership query, gateway route | Partially implemented; browser auth and database integration verification outstanding | Add invitations, membership lifecycle, organization audit, and integration tests |
| Role checks | Creator is owner; listing/access lookup is membership-scoped; Go Identity maps organization roles to separate organization/application capabilities; application capability helper requires an explicit grant | Partially implemented; app grants are not persisted or integrated into resource handlers; DB integration unverified | Implement app grants, member lifecycle, audit, then enforce policy and grants at every app/resource route before CRUD |
| Applications and credentials | No management routes or issuer found | Missing | Define application ownership, environment separation, hashed secret storage, one-time secret return and revocation audit |
| Business Messaging API | No developer-facing messaging routes found in the gateway; public contracts remain proposal-only | Missing | Publish a versioned OpenAPI contract and implement authorization, consent, scope, quota and encryption/privacy gates before exposing traffic |
| Webhooks | No Developer webhook management/delivery service found | Missing | Implement signature verification, SSRF-safe egress, idempotency, bounded retries and delivery audit before UI actions |
| Billing and usage | No Developer entitlement/usage ledger integration found | Missing | Establish authoritative metering, reconciliation and billing ownership; do not estimate prices or balances in the portal |
| Sandbox tenants and explorer | No isolated sandbox issuer, synthetic data plane or request executor found | Missing | Build separate credentials, tenants, storage and routing; hard-reject production IDs/credentials and real-recipient messaging |
| Messenger Chat Bubbles | Platform-system bubbles, in-app floating conversations and interactive replies require native/client work not established by this portal inventory | Not verified by this workstream | Audit the actual Messenger app and notification pipeline; implement and test each platform capability independently |
| Notification ownership | User preference: keep message notifications in both Nantty and Messenger when both apps are installed | Product decision recorded; delivery/deduplication behavior unverified | Preserve both registrations and verify each app’s independent token routing, suppression rules and duplicate behavior on devices |
| Internal developer administration | No developer-platform admin service/workspace found | Missing | Implement separate privileged permissions, MFA, audit trails and approval boundaries; never infer Nantty platform admin from org ownership |

### Proposed page-to-service and authorization map

These are ownership requirements from the product spec, not currently callable endpoints. The permissions below are proposed default roles and must be enforced by a trusted backend on every request.

| Portal area | Required service boundary | Minimum authorization | Current state |
|---|---|---|---|
| Overview and org switcher | Organization membership + entitlements | Authenticated member; organization-scoped | Preview only |
| Applications | Developer application service | Owner, Administrator, or authorized Developer; app-level grants also apply | Unavailable |
| API credentials | Credential issuer/revoker | Owner, Administrator, Developer with app grant; Security Manager may revoke | Unavailable; no secrets shown |
| Webhooks | Webhook configuration/delivery service | Authorized application integration manager | Unavailable |
| Request logs | Redacted request ledger | Developer/Analyst or explicitly authorized Viewer; resource-scoped | Unavailable |
| Usage | Metering and entitlements | Analyst/Viewer read scope; server-computed organization scope | Unavailable |
| Billing and invoices | Billing/subscription service | Owner or Billing Manager | Unavailable |
| Sandbox apps, explorer, scenarios | Isolated sandbox control/data plane | Organization member with sandbox/app permission | Unavailable; controls remain disabled |
| Security and team | Organization identity/membership service | Owner/Admin for current member reads and role changes; ownership transfer is separate | Partial: members, details, roles, audited role updates, and audited removal are implemented; invitations, ownership transfer, and audit-log UI/API unavailable |
| Platform administration | Separate Nantty internal admin service | Dedicated platform permission + MFA + audit | Not part of the Developer portal |

No production API routes should be added from this table alone. Before enabling a row, add its OpenAPI contract, tenant-boundary tests, role-denial tests, audit behavior, and failure/empty/loading UI states. Business Messaging must remain distinct from personal end-to-end encrypted conversations. When both Nantty apps are installed, do not “deduplicate” by silently disabling either app’s notification stream; any cross-app suppression must be explicit, tested, and user-controlled.
