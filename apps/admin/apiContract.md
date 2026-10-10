# Zudomart Admin API contract

Backend contract for the admin console (`apps/admin`, served at `admin.<domain>`). Every endpoint lives under `/api/v1/admin/...` and is called only by the admin console's server (Backend-for-Frontend). Browsers never hold API tokens.

The console ships a mock adapter (`ADMIN_USE_MOCKS=true`, default outside production) that implements every endpoint below with the same shapes (`apps/admin/src/mocks`). Use it as an executable reference.

## Conventions

### Transport
- JSON in and out, UTF-8. Timestamps are ISO-8601 UTC strings.
- Money is always `{ "amountMinor": integer, "currency": "NGN" }` (ISO-4217). Never floats, never an implied currency. Rates are integer basis points (`4000` = 40%).
- Lists return `{ "data": [], "nextCursor": string|null }` (the console client exposes them as `items`). Most backend lists page by `?cursor=`; only live incidents, ads, advertisers, support and help also accept `page`/`pageSize` and return `total`.
- Errors: `{ "message": "human readable", "code": "MACHINE_CODE", "issues"?: [{ "path": "field", "message": "..." }] }`. Status codes: 400 validation, 401 unauthenticated, 403 forbidden / `STEP_UP_REQUIRED`, 404, 409 state conflict / `VERSION_CONFLICT`, 423 `ACCOUNT_LOCKED`, 429 rate limited.

### Headers sent by the console
| Header | Meaning |
|---|---|
| `Authorization: Bearer <accessToken>` | Admin access token (10 min). |
| `X-Step-Up-Token: <stepUpToken>` | Present when the admin re-authenticated in the last 5 minutes. Required by every endpoint marked **step-up**. |
| `Idempotency-Key` | Required on money-moving endpoints (marked **idempotent**). Same key + same admin + same path replays the first response with `Idempotent-Replayed: true`. |
| `X-Forwarded-For`, `User-Agent` | Admin's client IP and browser, for the audit log, session list and IP allow-list. |
| `X-Request-Id` | Correlation ID; store it on the audit entry. |
| `X-Client-App: zudomart-admin` | Identifies the caller. |

### Authorization (server-enforced)
- Admin roles: `SUPERADMIN`, `ADMIN`, `SUPPORT`. Superadmins implicitly hold every permission and are created **only** by a backend CLI bootstrap (`zudo admin:bootstrap-superadmin`); no endpoint can create, promote to, disable or edit a superadmin.
- `ADMIN` and `SUPPORT` hold an explicit list of granular permissions (below). The API must check the permission on every request; the console hides UI but is never trusted.
- Admin tokens are a separate audience from app user tokens. A normal user token must never reach `/api/v1/admin/*`.

| Area | Permission keys |
|---|---|
| Overview | `metrics:read` |
| Users | `users:read`, `users:read-pii`, `users:moderate`, `users:ban`, `usernames:manage`, `reserved-usernames:manage` |
| Verification | `verification:review`, `verification:documents`, `verification:revoke` |
| Applications | `applications:sellers`, `applications:creators` |
| Brands | `brands:review`, `brands:revoke`, `ip-claims:review` |
| Moderation | `moderation:reports`, `moderation:appeals`, `copyright:review` |
| Commerce | `orders:read`, `disputes:resolve`, `refunds:issue`, `payouts:approve`, `coins:review`, `ledger:read` |
| Ads | `ads:review`, `advertisers:manage` |
| Catalog | `catalog:manage` |
| Configuration | `config:read`, `config:plans`, `config:revenue`, `config:rules`, `flags:manage`, `automation:manage`, `templates:manage` |
| Support | `support:tickets`, `support:assign` |
| Audit | `audit:read`, `audit:export` |

### Step-up re-authentication
Endpoints marked **step-up** reject requests without a valid `X-Step-Up-Token` token with `403 { "code": "STEP_UP_REQUIRED" }`. A token comes from `POST /api/v1/admin/auth/step-up`, is bound to the admin **and** their session, and expires after 300 seconds.

### Audit
Every mutation writes one append-only audit entry in the same transaction as the change:
`{ id, occurredAt, actor: { id, name, kind: "ADMIN"|"USER"|"SYSTEM", role }, action, area, target: { type, id, label }, reason, before, after, ipAddress, requestId, stepUpVerified }`.
`before`/`after` hold only the changed fields, never secrets (no passwords, TOTP secrets, full bank numbers or document contents). Reading PII or opening identity documents is also audited. Detail endpoints return `history`: the audit entries for that target, newest first.

### Sessions and security expectations
- Access token 10 min; refresh token rotates on every use, is stored hashed, and **reuse of a used refresh token revokes the whole session** (`401 REFRESH_TOKEN_REUSED`). Absolute session lifetime 12 h.
- Password + mandatory MFA. 5 failed passwords lock the account for 15 min (`423 ACCOUNT_LOCKED` with `lockedUntil`). 5 wrong MFA codes invalidate the `challengeToken`.
- Optional IP allow-list (`ADMIN_IP_ALLOWLIST`): the API returns `403 IP_NOT_ALLOWED` for other addresses.
- Login, MFA and step-up endpoints have their own strict rate limits (429).
## Authentication & MFA

All auth endpoints are called by the console server only. `challengeToken` is a single-use, short-lived token that proves the password step passed; it grants nothing else. The console keeps it in a signed cookie (still named `mfaToken` there). Request bodies are decoded strictly: unknown fields are rejected with `400`.

| Method & path | Auth | Body | Success |
|---|---|---|---|
| `POST /api/v1/admin/auth/login` | none | `{ email, password }` | `200 { status: "mfa_required"\|"mfa_enrollment_required", challengeToken, expiresIn }` |
| `POST /api/v1/admin/auth/mfa/enroll/start` | none (`challengeToken`) | `{ challengeToken }` | `200 { secret, otpauthUri }`, only when `status` was `mfa_enrollment_required` |
| `POST /api/v1/admin/auth/mfa/enroll/confirm` | none (`challengeToken`) | `{ challengeToken, code }` | `200 { accessToken, refreshToken, expiresIn, tokenType, staff }` |
| `POST /api/v1/admin/auth/mfa/verify` | none (`challengeToken`) | `{ challengeToken, code }` (6-digit TOTP) | `200 { accessToken, refreshToken, expiresIn, tokenType, staff }` |
| `POST /api/v1/admin/auth/refresh` | none | `{ refreshToken }` | `200 { accessToken, refreshToken, expiresIn, tokenType, staff }` (rotates) |
| `GET /api/v1/admin/auth/me` | bearer | — | `200 { id, email, name, role, permissions[], ... }` |
| `POST /api/v1/admin/auth/step-up` | bearer | `{ code }` | `200 { stepUpToken, expiresIn }` |

Not built in the backend yet (the console keeps the UI, calls fail with the backend's 400/404): recovery codes (`method: "recovery"`), passkeys (`/mfa/webauthn/options`, `/step-up/webauthn/options`, `method: "webauthn"`), and `recoveryCodes` on enrolment.
| `POST /api/v1/admin/auth/logout` | none | `{ refreshToken }` | `204` — revokes the session and all its tokens |

`admin` = `{ id, email, name, role, permissions[] }`.

Errors: `401 INVALID_CREDENTIALS` (same message whether or not the email exists), `423 ACCOUNT_LOCKED { lockedUntil }`, `403 ACCOUNT_DISABLED`, `403 INVITATION_PENDING`, `403 IP_NOT_ALLOWED`, `401 MFA_CHALLENGE_EXPIRED`, `401 INVALID_MFA_CODE`, `409 MFA_ALREADY_ENROLLED`, `404 NO_PASSKEYS`, `401 INVALID_REFRESH_TOKEN`, `401 REFRESH_TOKEN_REUSED`, `429 RATE_LIMITED`.

Rules: TOTP is RFC 6238 (SHA-1, 6 digits, 30 s, ±1 step), secrets encrypted at rest, codes single-use within their window. Recovery codes are stored hashed and each works once. WebAuthn: `userVerification: "required"`, RP ID = admin host, verify signature counter. Audit actions: `admin.signed_in`, `admin.sign_in_failed`, `admin.locked`, `admin.mfa_enrolled`, `admin.step_up`, `admin.signed_out`.

## Your account

| Method & path | Permission | Notes |
|---|---|---|
| `GET /api/v1/admin/account` | any admin | `{ account: AdminAccountSummary, recoveryCodesRemaining, passkeys: [{ id, label, createdAt, lastUsedAt }] }` |
| `GET /api/v1/admin/account/sessions` | any admin | `{ items: [{ id, ipAddress, userAgent, startedAt, lastSeenAt, isCurrent }] }` |
| `POST /api/v1/admin/account/sessions/:sessionId/revoke` | any admin (own sessions) | `204`. Audit `admin.session_revoked`. |
| `POST /api/v1/admin/account/recovery-codes/regenerate` | any admin, **step-up** | `{ recoveryCodes: string[8] }`; old codes stop working. Audit `admin.recovery_codes_regenerated`. |
| `POST /api/v1/admin/account/passkeys/options` | any admin | `PublicKeyCredentialCreationOptions` (base64url `challenge`, `user.id`, `excludeCredentials`). |
| `POST /api/v1/admin/account/passkeys` | any admin | `{ label, credential }` (attestation response, base64url) → `201 { id, label, createdAt, lastUsedAt }`. Audit `admin.passkey_added`. |
| `DELETE /api/v1/admin/account/passkeys/:passkeyId` | any admin | `204`. Audit `admin.passkey_removed`. |

## Admins & roles (superadmin only)

`AdminAccountSummary` = `{ id, email, name, role, status: "ACTIVE"|"INVITED"|"DISABLED"|"LOCKED", permissions[], mfaEnrolled, passkeyCount, lastLoginAt, createdAt, createdByName }`.

| Method & path | Rules | Body → response |
|---|---|---|
| `GET /api/v1/admin/admins?search&status&role&cursor&limit` | superadmin | `PagedList<AdminAccountSummary>` |
| `GET /api/v1/admin/admins/:adminId` | superadmin | `{ admin, activeSessionCount, history: AuditLogEntry[] }` |
| `POST /api/v1/admin/admins` | superadmin, **step-up** | `{ email (must be on a server-configured allow-list of work domains), name, role: "ADMIN"\|"SUPPORT", permissions[], reason }` → `201 { admin, invitationSentTo, invitationExpiresInHours }`. Sends a one-time invitation link (48 h) to set a password and enroll MFA. `409 ADMIN_EXISTS`. Audit `admin.created`. |
| `PUT /api/v1/admin/admins/:adminId/permissions` | superadmin, **step-up** | `{ role, permissions[], reason }` → `{ admin }`. Audit `admin.permissions_changed` with before/after lists. |
| `POST /api/v1/admin/admins/:adminId/disable` | superadmin, **step-up** | `{ reason }` → `{ admin }`; revokes every session. Audit `admin.disable`. |
| `POST /api/v1/admin/admins/:adminId/enable` | superadmin, **step-up** | `{ reason }` → `{ admin }`; also clears a lockout. Audit `admin.enable`. |
| `POST /api/v1/admin/admins/:adminId/reset-mfa` | superadmin, **step-up** | `{ reason }` → `{ admin }`; removes TOTP, passkeys and recovery codes, revokes sessions; admin must re-enroll. Audit `admin.reset_mfa`. |

Unknown permission keys → `400`. Acting on yourself → `409 CANNOT_CHANGE_SELF`; on a superadmin → `409 SUPERADMIN_PROTECTED`.

## Audit log

| Method & path | Permission | Notes |
|---|---|---|
| `GET /api/v1/admin/audit?search&area&actorId&targetType&targetId&from&to&cursor&limit` | `audit:read` | `PagedList<AuditLogEntry>`, newest first. `search` matches action, actor name, target label/ID and reason. |
| `GET /api/v1/admin/audit/facets` | `audit:read` | `{ areas: string[], actors: [{ id, name }] }` for filters. |
| `GET /api/v1/admin/audit/:entryId` | `audit:read` | `AuditLogEntry` |
| `GET /api/v1/admin/audit/export?format=csv&<same filters>` | `audit:export` | `text/csv` attachment. Cells starting with `= + - @` are prefixed with `'` (formula-injection safe). The export itself is audited (`audit.exported`). |

The store is append-only (no update or delete endpoints exist; enforce with database permissions, not only code).

## Metrics

`GET /api/v1/admin/metrics/overview?range=24h|7d|30d` — `metrics:read`. Returns:

```json
{
  "generatedAt": "…", "range": "24h",
  "users": { "total": 0, "newInRange": 0, "dailyActive": 0, "monthlyActive": 0, "dailyActiveSeries": [0] },
  "commerce": { "ordersInRange": 0, "ordersSeries": [0], "gmvByCurrency": [Money], "escrowHeldByCurrency": [Money], "escrowReleasedByCurrency": [Money], "disputesOpen": 0 },
  "money": { "payoutsPendingCount": 0, "payoutsPendingByCurrency": [Money], "creatorPayoutsByCurrency": [Money], "adsSpendByCurrency": [Money] },
  "trust": { "reportsPending": 0, "appealsPending": 0, "copyrightPending": 0, "verificationPending": 0 },
  "queues": [{ "key": "reports", "label": "Reports", "href": "/moderation/reports", "count": 0, "oldestAt": "…", "breachingSla": 0 }],
  "health": [{ "name": "API", "status": "OPERATIONAL"|"DEGRADED"|"DOWN", "latencyMs": 84, "note": null }]
}
```
Queue keys used by the console: `verification`, `sellerApplications`, `creatorApplications`, `reports`, `appeals`, `copyright`, `adsReview`, `disputes`, `payouts`, `coinReviews`, `supportTickets`, `brandVerification`, `ipClaims`. Each money list has one entry per currency with activity; the console never assumes a currency.
## Users

Shared shapes: `PlatformUserSummary` (`id`, `username`, `displayName`, `avatarUrl`, `country`, `currency`, `status` ACTIVE|WARNED|SUSPENDED|BANNED|DEACTIVATED, `verification` {color BLUE|GOLD|BLACK, tier ESSENTIAL|VERIFIED|PREMIUM|ONLY|PRO|BUSINESS|OFFICIAL, status, badgeVisible} | null, `isSeller`, `isCreator`, `followerCount`, `joinedAt`, `lastActiveAt`, `strikeCount`, `riskLevel` LOW|MEDIUM|HIGH, `emailMasked`, `phoneMasked`). Personal data is never included in list/detail responses.

`UserDetail` = `{ user, bio, restriction: {kind SUSPENSION|BAN, reason, startedAt, endsAt|null} | null, wallet: { balances: [{currency, available: Money, pending: Money, inEscrow: Money}], coinBalance, pendingWithdrawalCount }, strikes: [{id, policy, reason, source MODERATION|COPYRIGHT|MANUAL, issuedAt, expiresAt, issuedByName}], sessions: [{id, device, platform IOS|ANDROID|WEB, ipAddress, location, startedAt, lastSeenAt}], usernameHistory: [UsernameHistoryEntry], withheldUsername: WithheldUsername | null, history: AuditLogEntry[] }`.

| Method | Path | Permission | Step-up | Body | Response | Audit action |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/users?search&status&verification=BLUE\|GOLD\|BLACK\|NONE&role=seller\|creator&risk&cursor&limit` | any of `users:read`, `support:tickets`, `verification:review`, `moderation:reports` | no | — | `PagedList<PlatformUserSummary>` | — |
| GET | `/api/v1/admin/users/:userId` | same as above | no | — | `UserDetail` | — |
| GET | `/api/v1/admin/users/:userId/personal-data?purpose=` | `users:read-pii` | no | — | `{ email, phone, legalName, dateOfBirth, revealedAt, expiresInSeconds }` | `user.personal_data_revealed` (reason = purpose) |
| POST | `/api/v1/admin/users/:userId/warn` | `users:moderate` | no | `{ reason, policy?, addStrike? }` | `UserDetail` | `user.warned` |
| POST | `/api/v1/admin/users/:userId/suspend` | `users:moderate` | no | `{ reason, durationDays: 1..365 }` | `UserDetail` (sessions revoked) | `user.suspended` |
| POST | `/api/v1/admin/users/:userId/reinstate` | `users:moderate` | no | `{ reason }` | `UserDetail` | `user.reinstated` |
| POST | `/api/v1/admin/users/:userId/ban` | `users:ban` | **yes** | `{ reason, durationDays: number \| null }` (null = permanent) | `UserDetail` | `user.banned` |
| POST | `/api/v1/admin/users/:userId/unban` | `users:ban` | **yes** | `{ reason }` | `UserDetail` | `user.unbanned` |
| POST | `/api/v1/admin/users/:userId/force-logout` | `users:moderate` | no | `{ reason, sessionId? }` (omit = every session) | `UserDetail` | `user.sessions_revoked` |

Errors: `404 NOT_FOUND`; `409 USER_BANNED` (warn/suspend a banned user), `409 ALREADY_BANNED`, `409 NOT_BANNED`, `409 INVALID_STATUS` (reinstate from a non-suspended/warned state); `400 VALIDATION_FAILED` with `issues[]` (reason ≥ 5 chars, durationDays range); `403 STEP_UP_REQUIRED`. Every audit entry stores before/after `{status, strikeCount, restriction, sessionCount}`. Reasons are shown to the affected user.

## Usernames

`WithheldUsername` = `{ username, originalOwnerId, originalOwnerDisplayName, withheldAt, withheldByName, reason }`. `UsernameHistoryEntry` = `{ id, fromUsername, toUsername, kind USER_CHANGE|WITHHELD|RESTORED|ASSIGNED_TO_CLAIMANT|RECEIVED_FROM_RECLAIM, changedAt, changedByName, reason }`.

| Method | Path | Permission | Step-up | Body | Response | Audit action |
|---|---|---|---|---|---|---|
| POST | `/api/v1/admin/users/:userId/username/withhold` | `usernames:manage` | **yes** | `{ reason }` | `{ user, withheldUsername, assignedUsername, notification: { channel: "IN_APP_AND_EMAIL", title, body } }` | `username.withheld` |
| POST | `/api/v1/admin/users/:userId/username/reclaim` | `usernames:manage` | **yes** | `{ reason, mode: "RESTORE_TO_OWNER" \| "ASSIGN_TO_CLAIMANT", claimantUserId? }` | `UserDetail` of the original owner | `username.restored` / `username.reassigned` |
| GET | `/api/v1/admin/usernames/withheld` | `usernames:manage` or `reserved-usernames:manage` | no | — | `{ items: WithheldUsername[] }` | — |
| GET | `/api/v1/admin/usernames/confusables?candidate=` | `usernames:manage` or `reserved-usernames:manage` | no | — | `{ candidate, normalized, skeleton, collisions: [{entryId, value, kind, category, matchedBy EXACT\|SKELETON\|PREFIX\|PATTERN}], takenByUserId, takenByUsername, isWithheld }` | — |

Withhold: the server generates an unused `user_xxxxxx` username, assigns it atomically, keeps the old name unregistrable, and sends the in-app + email notification with the reason. `409 ALREADY_WITHHELD` if the user already has a withheld name. Reclaim: `404` if nothing is withheld for the user; `ASSIGN_TO_CLAIMANT` requires a different account whose verification status is `VERIFIED` (`400 VALIDATION_FAILED` on `claimantUserId`). Normalization: NFKC, lowercase, strip `@`; skeleton folds homoglyphs (Cyrillic/Greek lookalikes, 0→o, 1/i/!/|→l, 3→e, 4/@→a, 5/$→s, 7→t, 8→b, rn→m, vv→w, cl→d) and removes `.`, `_`, `-`.

## Reserved usernames

Served by go-identity (`users/src/modules/usernames`). `ReservedUsernameRule` = `{ id, term, matchKind exact|prefix|contains|brand, createdAt }`. Terms are `[a-z0-9._]{2,30}`, lowercased, no wildcards; `prefix` and `contains` match the normalized name and its skeleton.

| Method | Path | Permission | Step-up | Body | Response |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/usernames/reserved?cursor=` | `reserved-usernames:manage` | no | — | `{ data: ReservedUsernameRule[], nextCursor }`, 50 per page, newest first |
| POST | `/api/v1/admin/usernames/reserved` | `reserved-usernames:manage` | **yes** | `{ term, matchKind }` | `201 { id, term, matchKind }` |
| DELETE | `/api/v1/admin/usernames/reserved/:ruleId` | `reserved-usernames:manage` | **yes** | — | `204` |

Errors: `400 VALIDATION_FAILED`, `422 RULE_EXISTS`, `404 NOT_FOUND`. Not served yet (the console no longer sends them): search/kind/category filters, `category`, `note`, `reason`, `addedByName`, `existingAccountsMatching`.

## Verification

Colors: **Blue** personal (ESSENTIAL / VERIFIED / PREMIUM; Essential never shows a public badge), **Gold** business/store (ONLY / PRO / BUSINESS; verified Gold grants Zudomart Dashboard access), **Black** government (OFFICIAL; never purchasable, manual official process — confirm from the agency's official domain).

State machine (server-enforced, `409 INVALID_TRANSITION` otherwise):

| From | Transition | To | Permission | Step-up |
|---|---|---|---|---|
| PENDING | approve | VERIFIED | `verification:review` | no |
| PENDING | reject | UNVERIFIED | `verification:review` | no |
| VERIFIED | suspend | SUSPENDED | `verification:revoke` | **yes** |
| VERIFIED, SUSPENDED | revoke | REVOKED | `verification:revoke` | **yes** |
| SUSPENDED | reinstate | VERIFIED | `verification:review` | no |

`VerificationApplication` = `{ id, user: PlatformUserSummary, color, tier, status, subjectKind PERSON|BUSINESS|GOVERNMENT, submittedAt, reviewedAt, reviewedByName, decisionReason, badgeVisibleWhenVerified, grantsDashboardAccess, subscription: { planCode, price: Money } | null (always null for Black), applicant: { legalName, category, country, businessName, registrationNumber, agencyName, officialContactEmail }, documents: [{ id, kind NATIONAL_ID|PASSPORT|DRIVERS_LICENCE|SELFIE|CAC_CERTIFICATE|UTILITY_BILL|GOVERNMENT_LETTER, label, uploadedAt }], checks: [{ label, result PASS|FAIL|REVIEW, detail }], allowedTransitions: string[] }`. Plan price is in the applicant's currency.

| Method | Path | Permission | Step-up | Body | Response | Audit action |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/verifications?status&color&search&cursor` | `verification:review` or `verification:revoke` | no | — | `PagedList<VerificationApplication>` (pending first, oldest first) | — |
| GET | `/api/v1/admin/verifications/:verificationId` | same | no | — | `VerificationApplication & { history: AuditLogEntry[] }` | — |
| GET | `/api/v1/admin/verifications/:verificationId/documents/:documentId` | `verification:documents` | no | — | `{ documentId, kind, label, viewUrl, expiresAt, watermarkText }` — `viewUrl` is a signed private-media URL valid ≤ 2 minutes; `watermarkText` = `Zudomart Admin — confidential · <admin email> · <timestamp>` | `verification.document_viewed` |
| POST | `/api/v1/admin/verifications/:verificationId/approve` | `verification:review` | no | `{ reason }` | detail | `verification.approved` |
| POST | `/api/v1/admin/verifications/:verificationId/reject` | `verification:review` | no | `{ reason }` | detail | `verification.rejected` |
| POST | `/api/v1/admin/verifications/:verificationId/suspend` | `verification:revoke` | **yes** | `{ reason }` | detail | `verification.suspended` |
| POST | `/api/v1/admin/verifications/:verificationId/revoke` | `verification:revoke` | **yes** | `{ reason }` | detail | `verification.revoked` |
| POST | `/api/v1/admin/verifications/:verificationId/reinstate` | `verification:review` | no | `{ reason }` | detail | `verification.reinstated` |

Side effects: the user's public `verification` summary updates in the same transaction (`badgeVisible = status == VERIFIED && tier != ESSENTIAL`); Gold approve/reinstate enables Dashboard access (and seller capability), Gold suspend/revoke pauses/removes it. Audit before/after: `{status, color, tier, badgeVisible, dashboardAccess}`.

## Seller and Creator Program applications

`ProgramApplication` = `{ id, kind "sellers"|"creators", user, status PENDING|APPROVED|REJECTED, submittedAt, reviewedAt, reviewedByName, decisionReason, pitch, storeName, categories[], expectedMonthlySales: Money | null (applicant currency), contentNiche, eligibility: [{ key, label, isMet, actual, required }], isEligible }`.

Seller eligibility: identity (NIN/BVN) verified, payout bank account name match, business documents, no prohibited categories, account ACTIVE. Creator eligibility (thresholds come from the creator eligibility rules in configuration): followers ≥ 1,000, posts in last 30 days ≥ 8, active strikes ≤ 0, account age ≥ 30 days.

| Method | Path | Permission | Step-up | Body | Response | Audit action |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/applications/sellers?status&search&cursor` | `applications:sellers` | no | — | `PagedList<ProgramApplication>` | — |
| GET | `/api/v1/admin/applications/sellers/:applicationId` | `applications:sellers` | no | — | `ProgramApplication & { history }` | — |
| POST | `/api/v1/admin/applications/sellers/:applicationId/approve` | `applications:sellers` | no | `{ reason }` | detail; user gains seller capability | `seller_application.approved` |
| POST | `/api/v1/admin/applications/sellers/:applicationId/reject` | `applications:sellers` | no | `{ reason }` | detail | `seller_application.rejected` |
| GET/POST | `/api/v1/admin/applications/creators[...]` | `applications:creators` | no | same as sellers | detail; approve sets Creator Program membership | `creator_application.approved` / `creator_application.rejected` |

Errors: `409 ALREADY_DECIDED`, `404 NOT_FOUND`, `400 VALIDATION_FAILED`.

Queue counters exposed to `/api/v1/admin/metrics/overview` `queues[]`: `verification` (SLA 72 h), `sellerApplications` (48 h), `creatorApplications` (48 h).
## Reports

Reports are grouped per target (one report record per reported item, with counts per reason). Moderation actions change the target's visibility and, where stated, the author's account and strike count. Every mutation writes the audit log with before/after (report status, target visibility, author status, author verification, author strikes). User-affecting actions write a second entry against the user (`target.type = "user"`).

Shared shapes:

```ts
type ReportTargetType = "POST" | "COMMENT" | "CLIP" | "LIVE" | "USER" | "PRODUCT" | "MESSAGE";
type ContentVisibility = "VISIBLE" | "HIDDEN" | "RESTRICTED" | "REMOVED";
interface ModeratedTargetPreview { type: ReportTargetType | "SOUND"; id: string; title: string | null; text: string | null; mediaUrls: string[]; soundTitle: string | null; visibility: ContentVisibility; createdAt: string }
interface ReportSummary {
  id: string; target: ModeratedTargetPreview; author: PlatformUserSummary;
  primaryReason: ReportReason; reasonCounts: { reason: ReportReason; count: number }[]; reportCount: number;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"; status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  firstReportedAt: string; lastReportedAt: string; slaDueAt: string;
}
interface ReportDetail extends ReportSummary {
  reporterNotes: { reporterUsername: string; note: string; reportedAt: string }[];
  classifierScores: { label: string; score: number }[];            // from the intelligence service, 0..1
  priorActionsOnAuthor: { action: string; reason: string; occurredAt: string }[];
  decision: { action: ModerationAction; reason: string; decidedByName: string; decidedAt: string; suspensionDays: number | null } | null;
  history: AuditLogEntry[];
}
```

`ReportReason` = SPAM, SCAM, HARASSMENT, HATE, NUDITY, VIOLENCE, COUNTERFEIT, IMPERSONATION, MISINFORMATION, SELF_HARM, OTHER. SLA: URGENT 1 h, HIGH 4 h, NORMAL 24 h, LOW 72 h from the first report.

### GET /api/v1/admin/reports
Permission `moderation:reports`. Query: `status` (`OPEN` = OPEN+IN_REVIEW, default; `RESOLVED`, `DISMISSED`, `ALL`), `targetType`, `reason`, `priority`, `search` (content text, @author, report or target ID), `cursor`, `limit`. Sorted by priority, then SLA due time. Response `PagedList<ReportSummary>`.

### GET /api/v1/admin/reports/{reportId}
Permission `moderation:reports`. Response `ReportDetail`. 404 `NOT_FOUND`.

### POST /api/v1/admin/reports/{reportId}/actions
Permission `moderation:reports`. Step-up: no.
Body `{ action: "DISMISS" | "HIDE" | "RESTRICT" | "REMOVE" | "WARN_AUTHOR", reason: string (5–1000) }`.
Effects: DISMISS → status DISMISSED. HIDE → visibility HIDDEN. RESTRICT → RESTRICTED (out of feeds/search/recommendations). REMOVE → REMOVED and +1 strike. WARN_AUTHOR → +1 strike, author status WARNED if ACTIVE, notification to author. All non-dismiss → status RESOLVED. Reporters are notified of the outcome.
Response `ReportDetail`. Errors: 400 `VALIDATION_FAILED`, 404, 409 `REPORT_ALREADY_DECIDED`.
Audit: `report.dismiss|hide|restrict|remove|warn_author`; `user.moderated.remove|warn_author`.

### POST /api/v1/admin/reports/{reportId}/suspend-author
Permission `moderation:reports`. **Step-up: yes** (`X-Step-Up-Token`).
Body `{ durationDays: 1 | 3 | 7 | 30, reason }`. Suspends the author (signed out, can't post/sell/go live/withdraw; escrow orders continue), +1 strike, hides the target, resolves the report.
Response `ReportDetail`. Errors: 403 `STEP_UP_REQUIRED`, 409 `AUTHOR_ALREADY_RESTRICTED`, 409 `REPORT_ALREADY_DECIDED`.
Audit: `report.suspend_author`, `user.moderated.suspend_author`.

### POST /api/v1/admin/reports/{reportId}/revoke-author-verification
Permissions `moderation:reports` **and** `verification:revoke`. **Step-up: yes**.
Body `{ reason }`. Moves the author's verification to REVOKED (badge hidden, perks removed; must re-apply), resolves the report.
Errors: 403 `STEP_UP_REQUIRED` / `FORBIDDEN`, 409 `NOT_VERIFIED`, 409 `REPORT_ALREADY_DECIDED`.
Audit: `report.revoke_author_verification`, `user.moderated.revoke_author_verification`.

## Appeals

```ts
interface AppealSummary {
  id: string; appellant: PlatformUserSummary;
  decisionType: "CONTENT_REMOVED" | "CONTENT_RESTRICTED" | "STRIKE" | "SUSPENSION" | "COPYRIGHT_TAKEDOWN";
  originalDecision: { action: string; reason: string; decidedByName: string; decidedAt: string; reportId: string | null };
  target: ModeratedTargetPreview; userStatement: string; evidenceNotes: string[];
  status: "PENDING" | "UPHELD" | "OVERTURNED"; submittedAt: string; slaDueAt: string;   // SLA 48 h
}
interface AppealDetail extends AppealSummary { decision: { outcome: "UPHELD" | "OVERTURNED"; reason: string; decidedByName: string; decidedAt: string } | null; history: AuditLogEntry[] }
```

### GET /api/v1/admin/appeals
Permission `moderation:appeals`. Query `status` (default PENDING, or `ALL`), `decisionType`, `search`, `cursor`. Oldest SLA first. Response `PagedList<AppealSummary>`.

### GET /api/v1/admin/appeals/{appealId}
Permission `moderation:appeals`. Response `AppealDetail`.

### POST /api/v1/admin/appeals/{appealId}/decide
Permission `moderation:appeals`. Step-up: no. Body `{ outcome: "UPHELD" | "OVERTURNED", reason }` (reason is sent to the user).
OVERTURNED restores the target (visibility VISIBLE), removes the strike that was issued, lifts a suspension, notifies the user. UPHELD is final.
Errors: 409 `APPEAL_ALREADY_DECIDED`; 409 `SAME_REVIEWER` when the deciding admin made the original decision (four-eyes rule).
Audit: `appeal.upheld` / `appeal.overturned` with before/after of appeal status, target visibility, appellant status and strikes.

## Copyright

```ts
interface CopyrightClaimSummary {
  id: string;
  claimant: { name: string; organization: string | null; email: string; representativeOf: string | null };
  workTitle: string; workType: "SOUND" | "VIDEO" | "IMAGE" | "TEXT";
  target: ModeratedTargetPreview;                      // CLIP | POST | LIVE | SOUND
  infringer: PlatformUserSummary; infringerStrikeCount: number;
  targetFlag: "VISIBLE" | "LIMITED" | "TAKEN_DOWN";
  status: "PENDING" | "NEEDS_INFO" | "UPHELD" | "REJECTED" | "COUNTER_NOTICE" | "RESTORED";
  filedAt: string; topAudioMatchConfidencePercent: number | null;
}
interface CopyrightClaimDetail extends CopyrightClaimSummary {
  rightsBasis: string; swornStatement: string; claimedUrls: string[];
  audioMatches: { matchedTrack: string; artist: string; confidencePercent: number; source: string;
                  segments: { targetStartSeconds: number; targetEndSeconds: number; referenceStartSeconds: number }[] }[];   // intelligence service
  counterNotices: { id: string; submittedAt: string; statement: string; status: "PENDING" | "ACCEPTED" | "REJECTED"; restoreEligibleAt: string }[];
  repeatInfringerThreshold: number;                    // 3
  decision: { outcome: string; reason: string; decidedByName: string; decidedAt: string } | null;
  history: AuditLogEntry[];
}
```

### GET /api/v1/admin/copyright-claims
Permission `copyright:review`. Query `status` (`OPEN` = PENDING+NEEDS_INFO+COUNTER_NOTICE, default; any status; `ALL`), `workType`, `search`, `cursor`. Oldest first. Response `PagedList<CopyrightClaimSummary>`.

### GET /api/v1/admin/copyright-claims/{claimId}
Permission `copyright:review`. Response `CopyrightClaimDetail`.

### POST /api/v1/admin/copyright-claims/{claimId}/uphold
Permission `copyright:review`. Step-up: no. Body `{ reason }`. Allowed from PENDING / NEEDS_INFO.
Takes the target down everywhere (including clips reusing a sound), targetFlag TAKEN_DOWN, +1 copyright strike on the uploader, notifies both parties with counter-notice instructions. When strikes reach `repeatInfringerThreshold` the response's `infringerStrikeCount` signals the repeat-infringer policy (ban recommended; the ban itself is a separate user action).
Errors: 409 `CLAIM_STATE_CONFLICT`. Audit: `copyright.upheld` (claim) and `user.copyright_strike_added` (user, after includes `isRepeatInfringer`).

### POST /api/v1/admin/copyright-claims/{claimId}/reject
Permission `copyright:review`. Body `{ reason }`. From PENDING / NEEDS_INFO. targetFlag VISIBLE. Audit `copyright.rejected`.

### POST /api/v1/admin/copyright-claims/{claimId}/request-info
Permission `copyright:review`. Body `{ reason }` (what the claimant must send). From PENDING → NEEDS_INFO. Audit `copyright.info_requested`.

### POST /api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/accept
### POST /api/v1/admin/copyright-claims/{claimId}/counter-notices/{noticeId}/reject
Permission `copyright:review`. Body `{ reason }`. Claim must be COUNTER_NOTICE and notice PENDING.
Accept forwards the counter-notice to the claimant; a backend job restores the target (status RESTORED, targetFlag VISIBLE, strike removed) at `restoreEligibleAt` (10 business days) unless the claimant records court action. Reject keeps the takedown (claim back to UPHELD).
Errors: 409 `CLAIM_STATE_CONFLICT`, 409 `COUNTER_NOTICE_DECIDED`. Audit `copyright.counter_notice_accepted|rejected`.

## Ads review

```ts
interface AdForReview {
  id: string; campaignName: string; advertiser: { id: string; name: string; status: "ACTIVE" | "SUSPENDED" }; isBoostedPost: boolean;
  creative: { format: "IMAGE" | "VIDEO" | "CAROUSEL"; imageUrl: string; headline: string; primaryText: string; callToAction: string; landingUrl: string };
  targeting: { countries: string[]; ageRange: string; interests: string[]; placements: string[] };
  dailyBudget: Money; totalBudget: Money | null;         // advertiser's billing currency
  schedule: { startsAt: string; endsAt: string | null };
  autoCheckFlags: { policyCategoryId: string; label: string; severity: PolicySeverity; detail: string }[];
  status: "PENDING" | "APPROVED" | "REJECTED"; submittedAt: string;
  decision: { policyCategoryId: string | null; reason: string; decidedByName: string; decidedAt: string } | null;
}
interface AdvertiserAccount { id: string; name: string; owner: PlatformUserSummary; status: "ACTIVE" | "SUSPENDED"; country: string; currency: string; spendByCurrency: Money[]; activeCampaigns: number; violationCount: number; lastViolationAt: string | null; createdAt: string }
interface AdPolicyCategory { id: string; name: string; description: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; isActive: boolean; rejectionCount: number }
```

### GET /api/v1/admin/ads
Permission `ads:review` or `advertisers:manage`. Query `status` (default PENDING; `ALL`), `advertiserId`, `search`, `page`. Flagged ads first, then oldest. Response `PagedList<AdForReview>`.

### GET /api/v1/admin/ads/{adId}
Same permission. Response `AdForReview & { history: AuditLogEntry[] }`.

### POST /api/v1/admin/ads/{adId}/approve
Permission `ads:review`. Body `{ reason?: string, overrideCriticalFlags?: boolean }`.
Errors: 409 `AD_ALREADY_REVIEWED`, 409 `ADVERTISER_SUSPENDED`, 409 `CRITICAL_FLAG_UNRESOLVED` (a CRITICAL auto-check flag exists and `overrideCriticalFlags` is not true). Audit `ad.approved` (after includes `overrodeCriticalFlags`).

### POST /api/v1/admin/ads/{adId}/reject
Permission `ads:review`. Body `{ policyCategoryId (active category), reason }`. Increments the category's `rejectionCount` and the advertiser's `violationCount`; advertiser sees the category and reason. Audit `ad.rejected`.

### GET /api/v1/admin/advertisers · GET /api/v1/admin/advertisers/{advertiserId}
Permission `advertisers:manage` or `ads:review`. Query `status`, `search`, `page`. Most violations first. Detail adds `history`.

### POST /api/v1/admin/advertisers/{advertiserId}/suspend · /reinstate
Permission `advertisers:manage`. Body `{ reason }`. Suspend stops every campaign (activeCampaigns → 0); prepaid balance is kept. Errors: 409 `ADVERTISER_STATE_UNCHANGED`. Audit `advertiser.suspended|reinstated`.

### GET /api/v1/admin/ad-policies
Permission `advertisers:manage` or `ads:review`. Response `{ items: AdPolicyCategory[] }`.

### POST /api/v1/admin/ad-policies
Permission `advertisers:manage`. Body `{ name (3–60), description (10–400), severity }`. 409 `POLICY_EXISTS`. Audit `ad_policy.created`.

### PUT /api/v1/admin/ad-policies/{policyId}
Permission `advertisers:manage`. Body `{ name, description, severity, isActive, reason }`. Audit `ad_policy.updated` with before/after.

### Queue counters (feed `GET /api/v1/admin/metrics/overview` → `queues`)
`reports` (open reports, `breachingSla` = past `slaDueAt`), `appeals` (pending, SLA 48 h), `copyright` (PENDING + NEEDS_INFO + COUNTER_NOTICE), `adsReview` (pending ads).
## Brands

Brands are profiles that own trademarks. Members are platform users with a brand role; stores are linked to a brand and can display the "Official Store" badge.

`BrandSummary` = `{ id, name, slug, logoUrl, category, country, website, status: "ACTIVE"|"SUSPENDED", officialStatus: "NONE"|"PENDING"|"NEEDS_INFO"|"OFFICIAL"|"REJECTED"|"REVOKED", owner: PlatformUserSummary|null, memberCount, linkedStoreCount, openClaimCount, createdAt, officialRequestSubmittedAt }`.

`BrandDetail` = `BrandSummary` + `{ description, members: [{ user, role: "OWNER"|"ADMIN"|"MEMBER", addedAt }], linkedStores: [{ id, storeName, seller, linkedAt, isVerified, hasOfficialBadge }], officialRequest: OfficialStoreRequest|null, allowedOfficialActions: ("approve"|"reject"|"request-info"|"revoke")[], claimsFiled: IpClaimSummary[], history: AuditLogEntry[] }`.

| Method & path | Permission | Notes |
|---|---|---|
| `GET /api/v1/admin/brands?search&official&country&cursor&limit` | `brands:review`, `brands:revoke` or `ip-claims:review` | `PagedList<BrandSummary>`; `PENDING` requests sort first. `official` filters by `officialStatus`. |
| `GET /api/v1/admin/brands/:brandId` | same | `BrandDetail`. `allowedOfficialActions` is computed by the server from the state machine below; the console only shows those. |

## Official Store verification

Official Store is a **Gold (business) verification** backed by a registered trademark. Approving it gives verified linked stores the "Official Store" badge; Gold verification also grants Zudomart Dashboard access.

`OfficialStoreRequest` = `{ id, submittedAt, submittedBy: PlatformUserSummary|null, trademark: { registrationNumber, jurisdiction, niceClass, registeredOwner, registeredOn, expiresOn }, cacRegistrationNumber, cacCompanyName, contactEmail, documents: [{ id, kind: "TRADEMARK_CERTIFICATE"|"CAC_CERTIFICATE"|"AUTHORIZATION_LETTER", label, uploadedAt }], checks: [{ key, label, outcome: "PASS"|"WARN"|"FAIL", detail }], lastDecisionReason, decidedAt, decidedByName }`.

Automated checks the API computes (keys): `registrationFormat` (matches the registry's number format), `trademarkExpiry` (FAIL if expired, WARN within 90 days), `ownerMatchesCac` (trademark owner vs CAC company name, normalised), `emailDomain` (contact email on the brand's website domain), `verifiedStore` (at least one linked store is Gold verified).

State machine: `PENDING → OFFICIAL | REJECTED | NEEDS_INFO`, `NEEDS_INFO → OFFICIAL | REJECTED`, `OFFICIAL → REVOKED`. Anything else → `409 INVALID_OFFICIAL_STATUS_TRANSITION`.

| Method & path | Permission | Step-up | Body → response | Audit action |
|---|---|---|---|---|
| `GET /api/v1/admin/brands/:brandId/documents/:documentId` | `brands:review` | no | `{ documentId, kind, url (signed, ≤5 min), expiresAt, watermarkText }`. Every open is audited. | `brand.document_viewed` |
| `POST /api/v1/admin/brands/:brandId/official-status/approve` | `brands:review` | no | `{ reason }` → `BrandDetail`. Sets `hasOfficialBadge` on verified linked stores; notifies the owner. | `brand.official_approve` |
| `POST /api/v1/admin/brands/:brandId/official-status/reject` | `brands:review` | no | `{ reason }` → `BrandDetail` | `brand.official_reject` |
| `POST /api/v1/admin/brands/:brandId/official-status/request-info` | `brands:review` | no | `{ reason }` → `BrandDetail` (status `NEEDS_INFO`) | `brand.official_request_info` |
| `POST /api/v1/admin/brands/:brandId/official-status/revoke` | `brands:revoke` | **yes** | `{ reason }` → `BrandDetail`. Removes every Official Store badge immediately. | `brand.official_revoke` |

`reason` is required (5–1000 chars). Audit `before`/`after` = `{ officialStatus, officialBadgeStores[] }`.

## Trademark & counterfeit claims

Claims filed by brand owners against other sellers' listings.

`IpClaimSummary` = `{ id, type: "TRADEMARK"|"COUNTERFEIT", status: "OPEN"|"NEEDS_INFO"|"UPHELD"|"REJECTED", claimantBrand: { id, name, logoUrl, officialStatus }, accusedSeller: PlatformUserSummary, listing: { id, title, price: Money, imageUrl, listingUrl, storeName, status: "LIVE"|"DELISTED" }, filedAt, slaDueAt, priorStrikeCount }`. `price` is in the listing's own currency.

`IpClaimDetail` = summary + `{ statement, trademarkReference, evidence: [{ id, kind: "TEST_PURCHASE_PHOTO"|"SIDE_BY_SIDE"|"REGISTRATION_REFERENCE"|"NOTE", caption, imageUrl }], sellerResponse: { submittedAt, statement }|null, sellerPriorStrikes: [{ policy, issuedAt }], decision: { outcome, reason, decidedAt, decidedByName, strikeAdded }|null, allowedActions: ("uphold"|"reject"|"request-info")[], history }`.

State machine: `OPEN → UPHELD | REJECTED | NEEDS_INFO`, `NEEDS_INFO → UPHELD | REJECTED`; else `409 INVALID_CLAIM_TRANSITION`.

| Method & path | Permission | Step-up | Body → response | Audit action |
|---|---|---|---|---|
| `GET /api/v1/admin/ip-claims?status&type&search&cursor&limit` | `ip-claims:review` | no | `PagedList<IpClaimSummary>`, soonest SLA first | — |
| `GET /api/v1/admin/ip-claims/:claimId` | `ip-claims:review` | no | `IpClaimDetail` | — |
| `POST /api/v1/admin/ip-claims/:claimId/uphold` | `ip-claims:review` | **yes** | `{ reason, addStrike?: boolean = true }` → `{ claim: IpClaimDetail, sellerStrikeCount, isRepeatInfringer }`. Delists the listing; if `addStrike`, adds a strike (policy "Counterfeit goods" or "Trademark infringement", 12-month expiry) to the seller. `isRepeatInfringer` is true at 3+ strikes so the console can prompt a suspension. Notifies claimant and seller. | `ip_claim.uphold` |
| `POST /api/v1/admin/ip-claims/:claimId/reject` | `ip-claims:review` | no | `{ reason }` → same shape | `ip_claim.reject` |
| `POST /api/v1/admin/ip-claims/:claimId/request-info` | `ip-claims:review` | no | `{ reason }` → same shape (status `NEEDS_INFO`) | `ip_claim.request_info` |

Audit `before`/`after` = `{ status, listingStatus, sellerStrikeCount }`.

Queue counters (metrics overview): `brandVerification` (Official Store requests in `PENDING`, SLA 72 h, href `/brands?official=PENDING`) and `ipClaims` (claims in `OPEN`, breaching = past `slaDueAt`, href `/ip-claims`).
# Money: commerce operations

All amounts are `Money = { amountMinor: integer, currency: ISO 4217 }`. The API never converts currencies. Every money list pages by `?cursor=` (opaque) and `?limit=` (default 20–25, max 100) and returns `{ data, nextCursor }`, plus `counts` where noted. Statuses are lowercase. `PartySummary = { id, name: string|null, username: string|null }`. Money-moving endpoints require an `Idempotency-Key` header (8–128 chars); a repeated key with the same body replays the first response with `Idempotent-Replayed: true`, a reused key with a different body is refused. Missing key → `400 IDEMPOTENCY_KEY_REQUIRED`. Step-up endpoints answer `403 STEP_UP_REQUIRED` without a fresh step-up.

## Orders & refunds (orders module)

### GET /api/v1/admin/orders
Any of `orders:read`, `disputes:resolve`, `refunds:issue`, `support:tickets`. Query: `search` (≤80), `status` (`pending|new|processing|ready|shipped|delivered|completed|cancelled|returned|refunded|disputed`), `currency`, `storeId`, `cursor`, `limit`. Newest first.
`OrderSummary = { id, orderNumber, invoiceNumber, buyer: OrderParty, seller: OrderParty, storeId, storeName, status, paymentStatus, paymentMode, escrowStatus (awaiting_payment|held|disputed|refunded|partially_refunded|released), deliveryStatus, total: Money, itemCount, placedAt }`, `OrderParty = { id, username, displayName, avatarUrl|null }`.

### GET /api/v1/admin/orders/{idOrNumber}
Same permissions. Accepts the order UUID or the order number. Response `OrderSummary & { items: { id, productId, productName, variant, imageUrl, quantity, unitPrice, lineTotal, attribution: {source,id}|null }[], subtotal, discount, storeCredit, deliveryFee, refundedTotal, refundable, deliveryCity, deliveryState, courier|null, trackingNumber|null, escrow: { status, heldAmount, commission, sellerAmount, refunded, autoReleaseAt, releasedAt, refundedAt }|null, refunds: RefundRecord[], timeline: { id, kind, summary, actorKind, actorName, occurredAt }[] }`. `refundable` is zero when the order is unpaid or a refund is already running.

### GET /api/v1/admin/refunds
`refunds:issue`. Query: `source` (`manual|seller|return|cancellation|dispute|system`), `status` (`processing|completed|failed`), `orderId`, `search`, `cursor`, `limit`. `RefundRecord = { id, orderId, orderNumber, storeId, buyer: OrderParty, amount, source, status, reason, createdAt, completedAt|null, createdByName }`.

### POST /api/v1/admin/refunds
`refunds:issue`, step-up, `Idempotency-Key`. Body `{ orderId, amount: Money, reason (5–1000) }`. `201 RefundRecord`. Errors: `DISPUTE_OPEN` (resolve the dispute instead), `NOTHING_REFUNDABLE`, `REFUND_IN_PROGRESS`, `400` when the currency is not the order's, the amount exceeds what is refundable, or the escrow was released and the amount is not the full remainder.

## Disputes (escrow module)

### GET /api/v1/admin/disputes
`disputes:resolve`. Query: `status` (`open` = awaiting_seller+under_review, `resolved` = resolved_refunded+resolved_released+closed, a single status, or `all`), `search` (≤120), `cursor`, `limit`. Newest first. Response `{ data: DisputeSummary[], nextCursor, counts: Record<status, number> }`.
`DisputeSummary = { id, orderId, orderNumber, productName, buyer: PartySummary, seller: PartySummary, store: { id, name|null }, reason (not_received|not_as_described|damaged|wrong_item|other), status, priority (normal|high|urgent), escrowAmount, openedAt, slaDueAt|null, isSlaBreached }`.

### GET /api/v1/admin/disputes/{disputeId}
Staff view: `DisputeSummary & { description, evidenceUrls[], sellerResponse|null, commissionBasisPoints, escrow: { escrowId, status, amount, heldAmount, refundedAmount, releasedAmount, commission, processingFee, paymentReference, deliveredAt }, resolution: { outcome (release|refund|partial|withdrawn), buyerRefund, sellerPayout, commission, note, resolvedAt, resolvedByStaffId }|null, messages: { id, authorRole (buyer|seller|support), authorName, authorAvatarUrl, text, attachmentUrls[], createdAt }[], history: { status, label, occurredAt }[] }`.

### POST /api/v1/admin/disputes/{disputeId}/resolve
`disputes:resolve`, step-up, `Idempotency-Key`. Body `{ outcome: "REFUND_FULL"|"REFUND_PARTIAL"|"RELEASE_TO_SELLER" (or refund|partial|release), reason (3–2000, alias of note), refundAmount?: Money }`. `refundAmount` is required for `REFUND_PARTIAL` (above zero, below the order total) and refused otherwise. Response: the staff view above.

## Withdrawals (wallet module)

### GET /api/v1/admin/withdrawals
`payouts:approve`. Query: `status` (`pending_review|on_hold|queued|processing|paid|failed|cancelled`), `search` (withdrawal ID, user ID or reference), `cursor`, `limit`. Newest first. Response `{ data: StaffWithdrawal[], nextCursor, counts }`.
`StaffWithdrawal = { id, kind, amount, description, createdAt, status, reference, fee, netAmount, withdrawalStatus, payoutAccountId, failureReason|null, processedAt|null, userId, user: PartySummary, provider, destination: { payoutAccountId, bankName, accountLast4, accountName, countryCode, addedAt, removed }|null, reviewedByStaffId, reviewedAt, reviewNote }`.

### GET /api/v1/admin/withdrawals/{withdrawalId}
`StaffWithdrawal & { availableBalance: Money, recentWithdrawals: { id, amount, withdrawalStatus, createdAt }[] }` (last five).

### POST /api/v1/admin/withdrawals/{withdrawalId}/review
`payouts:approve`, step-up for every decision, `Idempotency-Key`. Body `{ decision: "approve"|"hold"|"reject", reason }`; `reason` is 3–300 characters for hold and reject, optional for approve. Approve and reject work from `pending_review` or `on_hold`; hold works from `pending_review` or `queued`. Approve → `queued`, hold → `on_hold`, reject → `failed` with the money returned to the available balance. `409 WITHDRAWAL_NOT_CHANGEABLE` otherwise. Response: the detail above.

## Coins (wallet module)

### GET /api/v1/admin/coins/transactions
`coins:review`. Query: `kind` (`purchase|transfer`; live gifts are transfers), `status` (`not_required|pending_review|reviewed|reversed`), `search`, `cursor`, `limit`. Response `{ data: CoinTransaction[], nextCursor, counts }`.
`CoinTransaction = { id, kind, reference|null, sender: PartySummary, receiver: PartySummary|null, coins, feeCoins|null, platformFeeBasisPoints|null, fiatValue: Money|null, paymentProvider|null, channel|null (web_checkout|store_iap), transactionStatus, reviewStatus, reviewFlags: string[] (coin rules hit), flags: string[] (open wallet risk flags on the people involved), chargebackRisk (low|medium|high), clawbackShortfallCoins, createdAt, reviewedAt, reviewedByStaffId, reviewNote }`.

### GET /api/v1/admin/coins/transactions/{transactionId}
`CoinTransaction & { history: { action, occurredAt, staffId|null, note|null }[] }`.

### POST /api/v1/admin/coins/transactions/{transactionId}/mark-reviewed
`coins:review`. Body `{ reason }` (0–1000). Response: the detail.

### POST /api/v1/admin/coins/transactions/{transactionId}/reverse
`coins:review`, step-up, `Idempotency-Key`. Body `{ reason }` (3–1000). Response: the detail.

## Ledger (ledger module, read-only)

`ledger:read` for all. Currencies are ISO 4217 codes or `COIN`.

### GET /api/v1/admin/ledger/currencies
`{ data: string[], nextCursor: null }`.

### GET /api/v1/admin/ledger/accounts?currency=&ownerId=&cursor=&limit=
`{ data: { code, name, kind (asset|liability|equity|revenue|expense), currency, balance, ownerType|null, ownerId|null, entryCount }[], nextCursor }`, ordered by code.

### GET /api/v1/admin/ledger/journal-entries?currency=&accountCode=&reference=&cursor=&limit=
Newest first. `{ data: { id, reference, externalReference|null, kind, description, reversesEntryId|null, postedAt, legs: { accountCode, accountName, direction (debit|credit), amount }[], totalDebits, totalCredits, isBalanced }[], nextCursor }`. Totals cover legs in the requested currency.

# Configuration

Every configuration object is a **versioned record**. Writes never overwrite: each save appends a new immutable version.

```ts
interface VersionedRecord<Content> {
  id: string;
  version: number;            // 1, 2, 3… per record
  updatedAt: string;          // ISO 8601
  updatedBy: { id: string; name: string };
  changeReason: string;
  isArchived: boolean;
  content: Content;
}
```

Shared rules for every endpoint in this section:

- **Read** endpoints return the current version (`GET …`), all current records (`GET` collection → `{ items: VersionedRecord[] }`) and the full history (`GET …/{id}/versions` → `{ items: VersionedRecord[] }`, newest first, archived versions included).
- **Write** endpoints require the step-up header `X-Step-Up-Token` (issued by `POST /api/v1/admin/auth/step-up`, 5 min, bound to the session). Missing/expired → `403 STEP_UP_REQUIRED`.
- **Optimistic concurrency:** every write body carries `expectedVersion` = the version the admin edited (`0` to create a new record, or to re-create an archived one). Stale → `409 VERSION_CONFLICT` with `{ currentVersion }`.
- Every write requires `reason` (5–1000 chars) which becomes `changeReason` and the audit reason.
- Every write appends an audit entry (`area: "config"`) with `before` = previous content (null on create) and `after` = new content (null on archive), `stepUpVerified: true`.
- Validation errors → `400 VALIDATION_FAILED` with `issues[{ path, message }]`, paths like `content.plans.3.prices.0.monthly.amountMinor`.
- Money is always `{ amountMinor: integer ≥ 0, currency: ISO 4217 }`; rates are integer **basis points** (100 = 1%). No endpoint assumes a single currency; the supported list lives in the document (`supportedCurrencies`).

Generic write shapes (used below):

| Method | Path | Body | Result |
|---|---|---|---|
| PUT | `{base}/{id}` | `{ expectedVersion, reason, content }` | `200` new version (`201` when created) |
| POST | `{base}/{id}/versions/{version}/restore` | `{ expectedVersion, reason }` | `200` new version whose content equals `{version}`; audit action `….restored` |
| DELETE | `{base}/{id}` (only where noted) | `{ expectedVersion, reason }` | `200` archived version (`isArchived: true`); audit `….archived` |

## Plans & prices

Base: `/api/v1/admin/config` — record ids: `plans`, `revenue`, `creator-eligibility`, `username-rules` (configuration documents; cannot be created, archived or deleted).

| Method | Path | Permission | Step-up |
|---|---|---|---|
| GET | `/api/v1/admin/config` | `config:read` (or any `config:*` write permission) | no |
| GET | `/api/v1/admin/config/plans` | `config:read` | no |
| GET | `/api/v1/admin/config/plans/versions` | `config:read` | no |
| PUT | `/api/v1/admin/config/plans` | `config:plans` | yes |
| POST | `/api/v1/admin/config/plans/versions/{version}/restore` | `config:plans` | yes |

```ts
interface PlansConfiguration {
  supportedCurrencies: string[];                 // e.g. ["NGN","GHS","KES","ZAR","GBP","EUR","USD"]
  plans: VerificationPlan[];
}
interface VerificationPlan {
  planKey: "BLUE_ESSENTIAL" | "BLUE_VERIFIED" | "BLUE_PREMIUM" | "GOLD_ONLY" | "GOLD_PRO" | "GOLD_BUSINESS" | "BLACK_OFFICIAL";
  color: "BLUE" | "GOLD" | "BLACK";               // read-only
  tier: "ESSENTIAL" | "VERIFIED" | "PREMIUM" | "ONLY" | "PRO" | "BUSINESS" | "OFFICIAL"; // read-only
  displayName: string;                           // 2–40
  badgeVisible: boolean;                         // read-only; ESSENTIAL is always false
  isPurchasable: boolean;                        // BLACK is always false
  perks: string[];                               // ≤20, each ≤120
  dashboardEntitlements: { key: string; label: string; limit: number | null }[]; // GOLD only (Zudomart Dashboard access); null = unlimited
  prices: { currency: string; monthly: Money | null; yearly: Money | null }[];   // one row per currency, currency ∈ supportedCurrencies, amounts in that currency
}
```

Server rules: plans cannot be added or removed via this endpoint (all current `planKey`s must be present); a purchasable plan needs ≥1 priced currency; each price row needs monthly or yearly; `BLACK_OFFICIAL` with `isPurchasable: true` → `400 OFFICIAL_NOT_PURCHASABLE` (Black is granted only through the manual official process). Price changes apply to new subscriptions and renewals; the API must never reprice an active billing period.

Audit actions: `config.document.updated`, `config.document.restored` (target `{ type: "configDocument", id: "plans" }`).

## App store fees

`GET/PUT /api/v1/admin/config/appStore.fees` (read: any config permission; write: `config:revenue`, step-up). Public setting read by the subscriptions module to take the store's cut before revenue shares.

```ts
interface AppStoreFeeSettings {
  appleFeeBps: number;                // 0–5000, default 3000
  appleSmallBusinessProgram: boolean; // when true, iOS purchases use appleSmallBusinessFeeBps
  appleSmallBusinessFeeBps: number;   // 0–5000, default 1500
  googleSubscriptionFeeBps: number;   // 0–5000, default 1500
}
```

Unknown keys and values outside 0–5000 → `400 VALIDATION_FAILED`. The console edits this under Configuration → Regional pricing → App store fees.

## Revenue rules

| Method | Path | Permission | Step-up |
|---|---|---|---|
| GET | `/api/v1/admin/config/revenue` | `config:read` | no |
| GET | `/api/v1/admin/config/revenue/versions` | `config:read` | no |
| PUT | `/api/v1/admin/config/revenue` | `config:revenue` | yes |
| POST | `/api/v1/admin/config/revenue/versions/{version}/restore` | `config:revenue` | yes |

```ts
interface RevenueRulesConfiguration {
  supportedCurrencies: string[];
  creatorAdShareBasisPoints: number;            // default 4000 (40%), max 9000
  giftCreatorShareBasisPoints: number;          // default 7000, ≤ giftCreatorShareCeilingBasisPoints
  giftCreatorShareCeilingBasisPoints: number;   // read-only policy ceiling (7000 = "up to 70%")
  coinTransferFeeBasisPoints: number;           // default 2500, max 5000
  coinUnitValues: Money[];                      // value of one coin per currency (one entry per currency)
  withdrawalFee: { mode: "PASS_THROUGH"; note: string }; // provider fee passed through, no margin
  marketplaceCommission: { defaultBasisPoints: number; categoryOverrides: { categorySlug: string; categoryName: string; basisPoints: number }[] }; // max 3000, unique slugs
}
```

Every `Money[]` must list each currency at most once. Changes apply to transactions created after the new version's `updatedAt`; ledger entries must record the rule version they used. Audit actions: `config.document.updated|restored` (target id `revenue`).

## Platform rules

| Method | Path | Permission | Step-up |
|---|---|---|---|
| GET | `/api/v1/admin/config/creator-eligibility` (+ `/versions`) | `config:read` | no |
| PUT | `/api/v1/admin/config/creator-eligibility` | `config:rules` | yes |
| POST | `/api/v1/admin/config/creator-eligibility/versions/{version}/restore` | `config:rules` | yes |
| GET | `/api/v1/admin/config/username-rules` (+ `/versions`) | `config:read` | no |
| PUT | `/api/v1/admin/config/username-rules` | `config:rules` | yes |
| POST | `/api/v1/admin/config/username-rules/versions/{version}/restore` | `config:rules` | yes |

```ts
interface CreatorEligibilityRules {
  minimumFollowers: number;            // 0–10,000,000
  minimumPostsInLast30Days: number;    // 0–1000
  maximumActiveStrikes: number;        // 0–10
  minimumAccountAgeDays: number;       // 0–3650
  requiresIdentityVerification: boolean;
  allowedCountries: string[];          // ISO 3166-1 alpha-2
}
interface UsernameRules {
  changesAllowedPerWindow: number;     // 0–10 (e.g. 1 change…)
  changeWindowDays: number;            // 1–365 (…per 30 days)
  minimumLength: number;               // 1–30
  maximumLength: number;               // ≥ minimumLength, ≤ 50
  allowedCharacterClasses: ("LOWERCASE_LETTERS" | "DIGITS" | "DOT" | "UNDERSCORE")[]; // must include LOWERCASE_LETTERS
  mustStartWithLetter: boolean;
  releasedUsernameCooldownDays: number; // 0–365, before a released username can be claimed again
}
```

The users service enforces the current username rules on every rename; creator applications snapshot the eligibility version they were evaluated against. Audit actions: `config.document.updated|restored`.

## Feature flags & experiments

Flags — base `/api/v1/admin/flags`, id = flag key (`^[a-z][a-z0-9_.-]{2,63}$`). Experiments — base `/api/v1/admin/experiments`, id = experiment key (same pattern).

| Method | Path | Permission | Step-up |
|---|---|---|---|
| GET | `/api/v1/admin/flags` | `flags:manage` or `config:read` | no |
| GET | `/api/v1/admin/flags/{flagKey}` (+ `/versions`) | `flags:manage` or `config:read` | no |
| PUT | `/api/v1/admin/flags/{flagKey}` (create with `expectedVersion: 0`, update, toggle) | `flags:manage` | yes |
| POST | `/api/v1/admin/flags/{flagKey}/versions/{version}/restore` | `flags:manage` | yes |
| DELETE | `/api/v1/admin/flags/{flagKey}` (archive) | `flags:manage` | yes |
| GET | `/api/v1/admin/experiments` (+ `/{key}`, `/{key}/versions`) | `flags:manage` or `config:read` | no |
| PUT | `/api/v1/admin/experiments/{experimentKey}` | `flags:manage` | yes |
| POST | `/api/v1/admin/experiments/{experimentKey}/versions/{version}/restore` | `flags:manage` | yes |

```ts
interface FeatureFlagContent {
  description: string;            // 5–300
  owner: string;                  // team, 2–60
  isEnabled: boolean;
  isKillSwitch: boolean;          // emergency stop flags (e.g. payouts_kill_switch)
  rolloutPercent: number;         // 0–100, sticky bucketing by user id
  targeting: { countries: string[]; platforms: ("IOS" | "ANDROID" | "WEB")[]; minimumAppVersion: string | null }; // empty countries = everywhere; ≥1 platform; semver x.y.z
}
interface ExperimentContent {
  name: string; hypothesis: string; primaryMetric: string;
  status: "DRAFT" | "RUNNING" | "STOPPED";   // STOPPED is terminal
  variants: { key: string; description: string; weightPercent: number }[]; // 2–6, unique keys, weights sum to 100
  startedAt: string | null;                  // set by the server when first RUNNING
}
```

Server rules: variants/weights cannot change while `RUNNING`; a `STOPPED` experiment cannot restart. Clients (apps) read flags from a separate public, cached endpoint that the backend derives from the current versions. Audit actions: `config.flag.created|updated|restored|archived`, `config.experiment.created|updated|restored`.

## Automation

Rules — base `/api/v1/admin/automation/rules`, id `^rule_[a-z0-9_]{3,58}$`. Permission `automation:manage` for everything; all writes need step-up.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/admin/automation/catalog` | `{ events[{ key, label, fields[{ key, label, type: "number"|"text"|"boolean"|"money" }] }], operators[{ key, label }], actions[{ type, label, parameters[{ key, label }] }] }` |
| GET | `/api/v1/admin/automation/sample-events` | `{ items[{ id, event, label, payload }] }` — fixtures used for dry runs in the console |
| GET | `/api/v1/admin/automation/executions?ruleId=` | `{ items[{ id, ruleId, ruleName, event, subjectLabel, occurredAt, outcome: "ACTIONS_RUN"|"CONDITIONS_NOT_MET"|"FAILED", actionsRun: string[], errorMessage }] }`, newest first |
| GET | `/api/v1/admin/automation/rules` (+ `/{ruleId}`, `/{ruleId}/versions`) | |
| PUT | `/api/v1/admin/automation/rules/{ruleId}` | create (`expectedVersion: 0`) or update, step-up |
| POST | `/api/v1/admin/automation/rules/{ruleId}/versions/{version}/restore` | step-up |
| DELETE | `/api/v1/admin/automation/rules/{ruleId}` | archive, step-up |

```ts
interface AutomationRuleContent {
  name: string; description: string; isEnabled: boolean;
  event: string;                                   // catalog event key, e.g. "payout.requested"
  conditionMatch: "ALL" | "ANY";
  conditions: { field: string; operator: "EQUALS"|"NOT_EQUALS"|"GREATER_THAN"|"LESS_THAN"|"CONTAINS"|"IN"; value: string }[]; // ≤10, field ∈ event fields; IN = comma list
  actions: { type: string; parameters: Record<string, string> }[]; // 1–6, types from catalog (notify_user, add_to_queue, hold_payout, auto_hide_content, assign_ticket), every catalog parameter required
}
```

The console dry-runs a draft rule locally against the sample events (same evaluation semantics the engine must use: numeric comparison when both sides are numbers, case-insensitive text otherwise, missing field = not met). The engine must evaluate the version current at event time and log each execution. Money-moving actions (`hold_payout`) may only delay money, never move it. Audit actions: `config.automation_rule.created|updated|restored|archived`.

## Notification templates

Base `/api/v1/admin/notification-templates`, id = `{event}.{channel lowercased}.{locale}` e.g. `payout.completed.sms.en`. Channels `PUSH | EMAIL | SMS | IN_APP`; locales `en | fr | pcm` (Naija Pidgin).

| Method | Path | Permission | Step-up |
|---|---|---|---|
| GET | `/api/v1/admin/notification-templates` (+ `/{templateId}`, `/{templateId}/versions`) | `templates:manage` or `config:read` | no |
| GET | `/api/v1/admin/notification-templates/events/{event}/variables` | `templates:manage` or `config:read` | no |
| PUT | `/api/v1/admin/notification-templates/{templateId}` | `templates:manage` | yes (create a translation with `expectedVersion: 0`) |
| POST | `/api/v1/admin/notification-templates/{templateId}/versions/{version}/restore` | `templates:manage` | yes — **add `POST /admin/notification-templates/…` to the BFF step-up list** (API enforces it regardless) |

```ts
interface NotificationTemplateContent {
  event: string; channel: "PUSH"|"EMAIL"|"SMS"|"IN_APP"; locale: string;  // fixed after creation
  isEnabled: boolean;
  subject: string | null;       // EMAIL only, 3–150
  body: string;                 // limits: SMS 320, PUSH 240, IN_APP 600, EMAIL 8000
  variables: { name: string; sampleValue: string }[]; // server-owned per event, ignored on write
}
```

Validation: `{{name}}` placeholders must be in the event's variable list (`400 VALIDATION_FAILED`, message `Unknown variables: {{x}}`), braces must be balanced. Rendering must HTML-escape variable values for email and never evaluate expressions. Audit actions: `config.notification_template.created|updated|restored`.
## Catalog: categories

Permission for every endpoint: `catalog:manage`. Categories are two levels deep (department → subcategory). Every write takes a `reason` (5–1000 chars) except reorder, and is audited with before/after.

`CatalogCategory`: `{ id, parentId: string|null, name, slug, iconName: string|null, isActive, sortOrder, productCount, commissionOverrideBasisPoints: number|null, updatedAt }`. Commission overrides are read-only here; they are edited in revenue rules (`/api/v1/admin/config/...`).

| Method | Path | Body | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/catalog/categories` | — | `{ items: CatalogCategory[] }` (flat list, client builds the tree) | — |
| GET | `/api/v1/admin/catalog/categories/{categoryId}` | — | `{ item: CatalogCategory, history: AuditLogEntry[] }` | — |
| POST | `/api/v1/admin/catalog/categories` | `{ name (2–60), slug?, parentId: string|null, iconName?: string|null, reason }` | `201 { item }` | `catalog.category_created` |
| PATCH | `/api/v1/admin/catalog/categories/{categoryId}` | any of `{ name, slug, parentId, iconName }` + `reason` | `{ item }` | `catalog.category_updated` or `catalog.category_moved` (parent changed) |
| POST | `/api/v1/admin/catalog/categories/{categoryId}/move` | `{ direction: "up"|"down" }` | `{ items: CatalogCategory[] }` | `catalog.category_reordered` |
| POST | `/api/v1/admin/catalog/categories/{categoryId}/deactivate` | `{ reason }` | `{ item }` — also deactivates subcategories | `catalog.category_deactivated` |
| POST | `/api/v1/admin/catalog/categories/{categoryId}/activate` | `{ reason }` | `{ item }` | `catalog.category_activated` |

Errors: `400 VALIDATION_FAILED` (issues on `name`, `slug` must match `^[a-z0-9]+(-[a-z0-9]+)*$`, `parentId` must be an existing top-level category, a category with subcategories cannot get a parent, `iconName` camelCase alphanumeric), `404 NOT_FOUND`, `409 SLUG_TAKEN`, `409 CANNOT_MOVE` (already first/last), `409 NO_CHANGE`.

## Catalog: topics

Permission: `catalog:manage`. Topics are feed interests creators tag and people follow. Hidden topics stop influencing ranking and are never trending.

`ContentTopic`: `{ id, name, slug, status: "ACTIVE"|"HIDDEN", isTrending, postCount, followerCount, updatedAt }`.

| Method | Path | Body / query | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/catalog/topics` | query `search?`, `status?` | `{ items: ContentTopic[] }` sorted by post count | — |
| GET | `/api/v1/admin/catalog/topics/{topicId}` | — | `{ item, history }` | — |
| POST | `/api/v1/admin/catalog/topics` | `{ name (2–40), reason }` (slug derived) | `201 { item }` | `catalog.topic_created` |
| PATCH | `/api/v1/admin/catalog/topics/{topicId}` | any of `{ name, status, isTrending }` + `reason` | `{ item }` | `catalog.topic_updated` |

Errors: `400 VALIDATION_FAILED`, `404 NOT_FOUND`, `409 SLUG_TAKEN`, `409 TOPIC_HIDDEN` (marking a hidden topic trending).

## Catalog: Mart home features

Permission: `catalog:manage`. Banners and featured slots on the Mart home screen, ordered by `priority` (1 = top). Images must come from the approved image library (served from the media CDN). Status is computed by the server: `DRAFT` (not published), `SCHEDULED` (published, before `startsAt`), `LIVE`, `EXPIRED` (after `endsAt`).

`MartHomeFeature`: `{ id, title, subtitle: string|null, kind: "HERO_BANNER"|"PROMO_BANNER"|"FEATURED_COLLECTION"|"FEATURED_STORE", imageId, imageUrl, targetType: "CATEGORY"|"COLLECTION"|"STORE"|"PRODUCT"|"URL", targetValue, countries: string[] (ISO 3166-1 alpha-2), startsAt, endsAt: string|null, priority, isPublished, status, updatedAt }`.

| Method | Path | Body | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/catalog/features` | — | `{ items: MartHomeFeature[] }` in priority order | — |
| GET | `/api/v1/admin/catalog/features/image-library` | — | `{ items: { id, label, url }[], countries: string[] }` | — |
| GET | `/api/v1/admin/catalog/features/{featureId}` | — | `{ item, history }` | — |
| POST | `/api/v1/admin/catalog/features` | `{ title (3–60), subtitle?, kind, imageId, targetType, targetValue, countries[], startsAt, endsAt?, reason }` | `201 { item }` (always a draft, appended last) | `catalog.feature_created` |
| PATCH | `/api/v1/admin/catalog/features/{featureId}` | any create field + `reason` | `{ item }` | `catalog.feature_updated` |
| POST | `/api/v1/admin/catalog/features/{featureId}/publish` | `{ reason }` | `{ item }` | `catalog.feature_published` |
| POST | `/api/v1/admin/catalog/features/{featureId}/unpublish` | `{ reason }` | `{ item }` | `catalog.feature_unpublished` |
| POST | `/api/v1/admin/catalog/features/{featureId}/move` | `{ direction: "up"|"down" }` | `{ items }` | `catalog.feature_reordered` |

Validation: `URL` targets must be `https://` on `zudomart.com` or a subdomain; `imageId` must be in the library; at least one supported country; `endsAt` after `startsAt`. Errors: `400 VALIDATION_FAILED`, `404 NOT_FOUND`, `409 NO_CHANGE`, `409 CANNOT_MOVE`.

## Support tickets

View and reply: `support:tickets` (listing and reading also allowed with `support:assign`). Assigning to someone else: `support:assign`; agents with only `support:tickets` may assign to themselves. SLA targets by priority — first response: URGENT 1h, HIGH 4h, NORMAL 8h, LOW 24h; resolution: URGENT 8h, HIGH 24h, NORMAL 48h, LOW 72h. `isSlaBreached` is true for OPEN, AWAITING_USER and AWAITING_SUPPORT tickets past either due time (first response only while unanswered). Served by `services/typescript/support` (Help Centre, plans.md §44).

`SupportTicketSummary`: `{ id, reference ("SUP-10421"), subject, category: "ORDER"|"PAYMENT"|"ACCOUNT"|"SELLER"|"VERIFICATION"|"CREATOR"|"LIVE"|"ADS"|"SAFETY"|"OTHER", priority: "LOW"|"NORMAL"|"HIGH"|"URGENT", status: "OPEN"|"AWAITING_USER"|"AWAITING_SUPPORT"|"RESOLVED"|"CLOSED", channel: "FORM"|"CHAT", requester: PlatformUserSummary, assignee: { id, name, email }|null, linkedReference: { kind: "order"|"payment"|"live"|"report"|"dispute", id, label }|null, linkedOrderId, linkedDisputeId, createdAt, updatedAt, firstResponseDueAt, firstRespondedAt, resolutionDueAt, resolvedAt, closedAt, satisfactionScore (1–5)|null, satisfactionComment, autoFaqStatus: "NONE"|"QUEUED"|"PUBLISHED"|"APPENDED"|"PENDING_REVIEW"|"SKIPPED", lastMessagePreview, messageCount, isSlaBreached }`. Resolving a ticket that has a staff answer queues it for the auto-FAQ (plans.md §44.1); resolved tickets close automatically after 7 days and a customer reply within 7 days reopens them as AWAITING_SUPPORT.
`SupportMessage`: `{ id, authorKind: "CUSTOMER"|"AGENT"|"INTERNAL_NOTE"|"SYSTEM", authorName, body, attachmentUrls, createdAt }`. Internal notes are never sent to the customer.
`SupportTicketDetail`: `{ ticket, messages: SupportMessage[], history: AuditLogEntry[], isRecorded: true, isEndToEndEncrypted: false }`.

| Method | Path | Body / query | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/support/tickets` | query `status?` (one status or a comma list, e.g. `OPEN,AWAITING_SUPPORT,AWAITING_USER`), `priority?`, `category?`, `assignee=me|unassigned|all`, `search?` (ticket/order/dispute ID or subject), `page`, `pageSize` | `PagedList<SupportTicketSummary>` sorted: breached first, then priority, then resolution due | — |
| GET | `/api/v1/admin/support/tickets/{ticketId}` | — | `SupportTicketDetail` | — |
| POST | `/api/v1/admin/support/tickets/{ticketId}/replies` | `{ body (2–5000), isInternalNote: boolean, statusAfterReply?: status }` (default AWAITING_USER for customer replies, unchanged for notes). A customer-visible reply emits `ticket.replied`, which emails, pushes and notifies the customer; `RESOLVED` also emits `ticket.resolved`. Sets `firstRespondedAt` on the first customer-visible reply; auto-assigns an unassigned ticket to the replier; notifies the customer in-app and by email. | `201 SupportTicketDetail` | `support.reply_sent` / `support.internal_note_added` |
| POST | `/api/v1/admin/support/tickets/{ticketId}/status` | `{ status, reason? }` | `SupportTicketDetail` | `support.status_changed` |
| POST | `/api/v1/admin/support/tickets/{ticketId}/assign` | `{ assigneeId: string|null, reason? }` | `SupportTicketDetail` | `support.ticket_assigned` / `support.ticket_unassigned` |
| GET | `/api/v1/admin/support/agents` | — | `{ items: { id, name, email }[] }` staff with `support:tickets` or `support:chat` seen by the support service in the last 90 days (`email` may be empty) | — |

Errors: `400 VALIDATION_FAILED`, `403 FORBIDDEN` (assigning someone else without `support:assign`), `404 NOT_FOUND`, `409 TICKET_CLOSED` (customer reply on a closed ticket), `409 NO_CHANGE`.

## Help centre content

Read: `support:helpContent`, `support:tickets` or `support:assign`. Write: `support:helpContent` (new permission, in the Support department template). Markdown containing scripts, frames, `javascript:` or inline event handlers is rejected with `400 UNSAFE_MARKDOWN`.

`HelpCategory`: `{ id, slug, title, description, iconName, position, topicCount (published) }`.
`HelpTopic`: `{ id, slug, title, summary, categoryId, categorySlug, categoryTitle, tags[], bodyMarkdown, locale, status: "DRAFT"|"PENDING_REVIEW"|"PUBLISHED"|"UNPUBLISHED"|"MERGED", origin: "EDITORIAL"|"SEED"|"RESOLVED_QUESTION", fromResolvedQuestion, sourceLabel, sourceTicketId, mergedIntoTopicId, editedByStaff, version, helpfulCount, notHelpfulCount, relatedQuestions, updatedByName, publishedAt, createdAt, updatedAt }`.

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/api/v1/admin/help/categories` | — | `{ items: HelpCategory[] }` |
| POST / PUT | `/api/v1/admin/help/categories` / `…/{categoryId}` | `{ slug, title, description?, iconName?, position? }` | `HelpCategory`; `409 SLUG_TAKEN` |
| DELETE | `/api/v1/admin/help/categories/{categoryId}` | — | `204`; `409 CATEGORY_NOT_EMPTY` |
| GET | `/api/v1/admin/help/topics` | `status?`, `origin?`, `categoryId?`, `search?`, `page`, `pageSize` | `PagedList<HelpTopic>` |
| GET | `/api/v1/admin/help/topics/{topicId}` | — | `{ topic, versions: { version, title, summary, bodyMarkdown, tags, editedByName, changeNote, createdAt }[], relatedTopicIds }` |
| POST / PUT | `/api/v1/admin/help/topics` / `…/{topicId}` | `{ categoryId, slug?, title (5–140), summary?, bodyMarkdown (20–40000), tags?, relatedTopicIds? (≤8), status?: "DRAFT"|"PUBLISHED", changeNote? }` | `HelpTopic`; a content change adds a version; `409 SLUG_TAKEN` |
| DELETE | `/api/v1/admin/help/topics/{topicId}` | — | `204` |
| POST | `/api/v1/admin/help/topics/{topicId}/publish` · `/unpublish` | — | `HelpTopic`; `409 NO_CHANGE`, `409 TOPIC_MERGED` |
| POST | `/api/v1/admin/help/topics/{topicId}/merge` | `{ targetTopicId }` | target `HelpTopic` (source appended as "Related question", source becomes MERGED and redirects) |
| GET | `/api/v1/admin/help/auto-topics` | `page`, `pageSize` | `PagedList<{ id, ticketId, ticketRef, action: "CREATED"|"APPENDED"|"PENDING_REVIEW"|"SKIPPED", similarity, writer, note, createdAt, topic: HelpTopic|null }>` |
| GET / PUT | `/api/v1/admin/help/settings` | `{ autoFaqRequiresReview: boolean }` (default false = publish automatically) | same |

## Support macros

Read: `support:tickets` or `support:assign`. Write: `support:assign`. Allowed variables: `{{user.displayName}}`, `{{user.username}}`, `{{ticket.id}}`, `{{agent.name}}` — the console expands them before sending; the server rejects unknown variables.

`SupportMacro`: `{ id, title, body, category: TicketCategory|null, updatedAt, updatedByName }`.

| Method | Path | Body | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/support/macros` | — | `{ items: SupportMacro[], variables: string[] }` | — |
| POST | `/api/v1/admin/support/macros` | `{ title (3–80), body (10–3000), category? }` | `201 SupportMacro` | `support.macro_created` |
| PUT | `/api/v1/admin/support/macros/{macroId}` | same as POST | `SupportMacro` | `support.macro_updated` |
| DELETE | `/api/v1/admin/support/macros/{macroId}` | — | `204` | `support.macro_deleted` |

Errors: `400 VALIDATION_FAILED` (unknown variable, lengths, category), `403 FORBIDDEN`, `404 NOT_FOUND`.

## Suspensions (trust & safety)

Permission: `users:moderate`. **Every write needs step-up** (`X-Step-Up-Token`) and writes an audit entry. The intelligence service only suggests; no endpoint lets it suspend. Deletion policy: 120 days after suspension the profile, posts, media and messages are deleted and order/payment records are anonymised and kept for the legal period. Reinstating before then stops the clock.

`SuspensionCaseSummary`: `{ id, user: PlatformUserSummary, source: "PYTHON_SUGGESTION"|"USER_REPORTS", status: "PENDING"|"ESCALATED"|"SUSPENDED"|"DISMISSED", riskScore (0-100), topSignals[], reportCount, createdAt }`. `SuspensionCaseDetail` adds `signals[{label,weight,detail}]`, `evidence[{label,href}]`, `reports[{id,reason,excerpt,reportedAt}]`, `modelVersion`, `decision`, `history`. `SuspendedAccount`: `{ caseId, user, reasonCode, note, suspendedAt, suspendedByName, deletionDueAt, daysUntilDeletion, appeal: { id, status: "PENDING"|"UPHELD"|"OVERTURNED", message, submittedAt, decisionNote }|null }`. Reason codes: `FRAUD|SCAM|COUNTERFEIT|HARASSMENT|IMPERSONATION|SPAM_NETWORK|OTHER`.

| Method | Path | Body / query | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/suspensions/cases` | `status=OPEN|DECIDED|ALL|<status>`, `source?`, `search?`, `cursor` | `PagedList<SuspensionCaseSummary>` by risk score | — |
| GET | `/api/v1/admin/suspensions/cases/{caseId}` | — | `SuspensionCaseDetail` | — |
| POST | `/api/v1/admin/suspensions/cases/{caseId}/approve` | `{ reasonCode, reason (note, 5–1000) }` | `SuspensionCaseDetail`; user becomes SUSPENDED, deletion clock starts | `suspension.approved` |
| POST | `/api/v1/admin/suspensions/cases/{caseId}/dismiss` | `{ reason }` | `SuspensionCaseDetail` | `suspension.dismissed` |
| POST | `/api/v1/admin/suspensions/cases/{caseId}/escalate` | `{ reason }` | `SuspensionCaseDetail` (stays open, flagged) | `suspension.escalated` |
| GET | `/api/v1/admin/suspensions/accounts` | `appeal=PENDING?` (appeal queue), `search?`, `cursor` | `PagedList<SuspendedAccount>` soonest deletion first | — |
| POST | `/api/v1/admin/suspensions/accounts/{caseId}/reinstate` | `{ reason }` | `{ reinstated: true }` | `suspension.reinstated` |
| POST | `/api/v1/admin/suspensions/accounts/{caseId}/appeal/decide` | `{ outcome: "UPHELD"|"OVERTURNED", reason }` | `{ outcome }`; OVERTURNED reinstates | `suspension.appeal_upheld` / `suspension.appeal_overturned` |

Errors: `403 STEP_UP_REQUIRED`, `409 CASE_ALREADY_DECIDED`, `409 NOT_SUSPENDED`, `409 NO_PENDING_APPEAL`.

## Security cases (access probing and suspected bots)

Served by go-trust. Read needs `security:cases`; every decision needs `security:cases` **and** step-up, plus the action's own permission (`keep_restricted` → `users:restrict`, `suspend` → `users:suspend`, `ban` → `users:ban`, `delete` → `users:delete`). Automation only flags, challenges (Cloudflare Turnstile) and, after repeated failures, suspends temporarily with an appeal. It never bans or deletes: those are staff decisions here.

`SecurityCaseSummary`: `{ id, accountId, account: PlatformUserSummary, trigger: "access_probing"|"suspected_bot", status: "open"|"cleared"|"kept_restricted"|"suspended"|"banned"|"deleted", severity: "low"|"medium"|"high", violationCount, failedChallengeCount, passedChallengeCount, autoSuspended, openedAt, lastActivityAt, decidedAt, decision }`. `SecurityCaseDetail` adds `state { challengeRequired, suspectedBot, botScore, botReasons[], headlessReported, attestationVerdict, autoSuspendedAt }`, `timeline[{ id, kind, at, deviceId, ipPrefix, source, detail }]` (route templates and counts only, never payloads), `challengeHistory[]`, `linkedDevices[]`, `linkedIpPrefixes[]` (/24 or /48), `previousCases`, `automationNote`.

| Method | Path | Body / query | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/security/cases` | `status=open|decided|all`, `trigger?`, `severity?`, `cursor?` | `{ data: SecurityCaseSummary[], nextCursor }`, auto-suspended first | — |
| GET | `/api/v1/admin/security/cases/{caseId}` | — | `SecurityCaseDetail` | — |
| POST | `/api/v1/admin/security/cases/{caseId}/decide` | `{ action: "clear"|"keep_restricted"|"suspend"|"ban"|"delete", reason (5–1000), durationDays?, features?, confirmUsername (delete only) }` | `SecurityCaseDetail` | `securityCase.<action>` |

Errors: `403 STEP_UP_REQUIRED`, `403 FORBIDDEN` (missing the action's permission), `409 CASE_ALREADY_DECIDED`, `409 PENDING_WITHDRAWALS` (delete with money still owed).

## Accounts and lifetime checkmarks

`POST /accounts` is **superadmin only**. Grants need `verification:review`; revoke needs `verification:revoke`. All writes need step-up. Profile types: `PERSONAL|BUSINESS|BRAND|GOVERNMENT` (a creator account is a personal account with an approved Creator Program status, not a profile type). A grant must match the profile type: Blue for personal (incl. creators), Gold for business/brand, Black for government; anything else is `400 VALIDATION_FAILED` on `color`. Black can only be granted or revoked by a superadmin. Grants bypass billing but never the profile-type rule.

| Method | Path | Body / query | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/accounts/created` | `cursor` | `PagedList<AdminCreatedAccount>` `{ id, user, profileType, createdAt, createdByName, reason, mustChangePassword, bypassedReservedEntries[] }` | — |
| POST | `/api/v1/admin/accounts` | `{ username, displayName, email, password (≥12, mixed), country, profileType, reason }` | `201 AdminCreatedAccount`. Skips the reserved-name check (matches are recorded), forces a password change at first login, never logs the password. | `account.created_by_admin` |
| GET | `/api/v1/admin/checkmark-grants` | `status=ACTIVE|REVOKED|ALL`, `cursor` | `PagedList<CheckmarkGrant>` `{ id, user, color, reason, grantedByName, grantedAt, revokedAt, revokedByName, revokedReason }` | — |
| POST | `/api/v1/admin/checkmark-grants` | `{ username, color, reason }` | `201 CheckmarkGrant` | `checkmark.lifetime_granted` |
| POST | `/api/v1/admin/checkmark-grants/{grantId}/revoke` | `{ reason }` | `CheckmarkGrant`; the earlier verification is restored | `checkmark.lifetime_revoked` |

Errors: `403 BLACK_ADMIN_ONLY`, `409 USERNAME_TAKEN|EMAIL_TAKEN|ALREADY_GRANTED|ALREADY_REVOKED`. Reserved usernames (exact, prefix, pattern, confusables, test box) are unchanged: `/admin/reserved-usernames`, `/admin/usernames/confusables`.

## Business documents review

Permission: `verification:review` (opening a file needs `verification:documents`). `BusinessDocumentSubmission`: `{ id, user, storeName, plan: "FREE"|"PRO"|"BUSINESS", overallStatus: "PENDING"|"APPROVED"|"REJECTED", submittedAt, documents: [{ id, kind: "CAC_CERTIFICATE"|"ID"|"PROOF_OF_ADDRESS", fileName, uploadedAt, status, rejectionReason, reviewedByName, reviewedAt }], goldCheckmark: "GRANTED"|"WAITING_FOR_PLAN"|"NOT_YET" }`. When all three are approved and the store is on Pro/Business, Gold is granted; on Free it waits for a plan.

| Method | Path | Body / query | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/business-documents` | `status=PENDING|REJECTED|APPROVED|ALL`, `search?`, `cursor` | `PagedList<BusinessDocumentSubmission>` | — |
| GET | `/api/v1/admin/business-documents/{id}/documents/{documentId}/access` | — | `{ documentId, fileName, viewUrl (2 min), expiresAt, watermarkText }` | `business_document.viewed` |
| POST | `.../documents/{documentId}/approve` | `{ reason }` | `BusinessDocumentSubmission` | `business_document.approved` |
| POST | `.../documents/{documentId}/reject` | `{ reason }` (shown to the seller) | `BusinessDocumentSubmission` | `business_document.rejected` |

## Black applications (maker-checker)

Permission: `verification:review` (revoke: `verification:revoke`). Approve, reject and revoke need step-up. Vetting checklist keys: `LETTERHEAD_LETTER`, `OFFICIAL_CHANNEL`, `REPRESENTATIVE` (ID + BVN/NIN + role), `ENTITY_PROOF`. Approval needs the whole checklist and **two different admins**: the first approval moves the application to `AWAITING_SECOND_APPROVAL`; a second approval by another admin makes it `APPROVED`, grants Black, **reserves the handle** and sets `reverificationDueAt` (+1 year). Revoking keeps the handle reserved.

`BlackApplication`: `{ id, user, agencyName, handle, representativeName, representativeRole, status: "IN_REVIEW"|"AWAITING_SECOND_APPROVAL"|"APPROVED"|"REJECTED"|"REVOKED", submittedAt, checklist[{key,label,detail,isVerified,note,verifiedByName}], firstApproval, secondApproval, decisionReason, reverificationDueAt, reverificationRemindedAt, handleReserved }`.

| Method | Path | Body / query | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/black-applications` | `status=OPEN|REVERIFY|ALL|<status>`, `search?`, `cursor` | `PagedList<BlackApplication>` | — |
| POST | `/api/v1/admin/black-applications/{id}/checklist` | `{ key, isVerified, note? }` | `BlackApplication` | `black_application.checklist_updated` |
| POST | `/api/v1/admin/black-applications/{id}/approve` | `{ reason }` | `BlackApplication` | `black_application.first_approval` / `.approved` |
| POST | `/api/v1/admin/black-applications/{id}/reject` | `{ reason }` | `BlackApplication` | `black_application.rejected` |
| POST | `/api/v1/admin/black-applications/{id}/revoke` | `{ reason }` | `BlackApplication` | `black_application.revoked` |
| POST | `/api/v1/admin/black-applications/{id}/reverification-reminder` | — | `BlackApplication` | `black_application.reverification_reminder_sent` |

Errors: `409 CHECKLIST_INCOMPLETE`, `409 SAME_ADMIN`, `409 NOT_OPEN|NOT_APPROVED`.

## Rules config documents (added)

Same versioned endpoints as the other documents (`GET /admin/config`, `PUT /admin/config/{key}` with `{ expectedVersion, reason, content }`). Write permission `config:rules` except `checkmark-pricing` (`config:plans`).

| Key | Content (defaults) |
|---|---|
| `checkmark-suggestions` | `blue { requiresIdVerified, minimumAccountAgeDays 90, minimumRealFollowers 1000, noViolationsInDays 90 }`, `gold { requiresBusinessVerification (CAC/KYB), requiresActiveStoreOrBrandPage, minimumCompletedOrders 20, minimumSuccessRatePercent 90 }` (20 orders AND 90% success). Black is never suggested. |
| `creator-thresholds` | `autoApprove { minimumAccountAgeDays 30, requiresVerifiedEmail, minimumRealFollowers 1000, minimumOriginalPostsInLast60Days 10, noViolationsInDays 90, maximumFraudScore 30 }`, `manualReview { minimumRealFollowers 500, allowsPastViolation, allowsBorderlineOrAiHeavyContent, maximumRiskScore 60 }`. Below manual review is not eligible. |
| `trial-rules` | `trialLength "DAYS_7"|"MONTH_1"`, `yearlyDiscountPercent 20` (admin-editable), `minimumAccountAgeDays 7`, `requiresVerifiedEmail`, `onePerPerson/Card/Device`, `maximumRiskScore 50`, `minimumCompletedOrders 0`. |
| `checkmark-pricing` | `bundleDiscountPercent 15`, `bundleMaximumBusinesses 3`, `goldOnlyMonthlyPrice NGN 3,000`, `blackMonthlyPrice NGN 50,000`, `blackGraceDays 14`. The bundle never stacks with the yearly discount (the bigger wins) and never applies to Black. |

## Support: live chat and email

Permission: `support:tickets`. Chats are recorded and **not end-to-end encrypted**; opening a transcript is audited. Email goes through AWS SES (mocked), to the person's verified account address (never shown to the admin). Marketing emails reach only people with marketing consent, always include an unsubscribe link, and need step-up; segment sends also need step-up.

| Method | Path | Body / query | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/support/chats` | `status=OPEN|WAITING|ACTIVE|ENDED|ALL`, `search?`, `page` | `PagedList<LiveChatSummary>` | — |
| GET | `/api/v1/admin/support/chats/{chatId}` | — | `{ chat, messages: SupportMessage[], isRecorded: true, isEndToEndEncrypted: false, history }` | `support.chat_opened` |
| POST | `/api/v1/admin/support/chats/{chatId}/claim` | — | detail | `support.chat_claimed` |
| POST | `/api/v1/admin/support/chats/{chatId}/messages` | `{ body (≤2000) }` | detail | `support.chat_message_sent` |
| POST | `/api/v1/admin/support/chats/{chatId}/end` | — | detail | `support.chat_ended` |
| GET | `/api/v1/admin/support/email/templates` | — | `{ items: { id, name, kind: "TRANSACTIONAL"|"MARKETING", subject, body }[] }` | — |
| GET | `/api/v1/admin/support/email/segments` | — | `{ items: { id, label, description, recipientCount, marketingConsentCount }[] }` | — |
| GET | `/api/v1/admin/support/email/sends` | — | `{ items: EmailSendRecord[] }` | — |
| POST | `/api/v1/admin/support/email/preview` | `{ kind, subject, body, audience: { type: "USER", username } | { type: "SEGMENT", segmentId } }` | `{ recipientCount, skippedNoMarketingConsent, includesUnsubscribeLink, renderedSubject, renderedBody, provider }` | — |
| POST | `/api/v1/admin/support/email/send` | preview body + `reason` | `201 EmailSendRecord` | `support.email_sent` |

Errors: `409 CHAT_ENDED|CHAT_CLAIMED|NOT_ASSIGNED`, `400 VALIDATION_FAILED` (no eligible recipients).

## Staff, departments and permissions

The first superadmin comes only from the backend CLI bootstrap. After that, superadmins create superadmins and admins from the UI; people with `staff:manage` can create and edit **non-superadmin** admins but can only grant permissions they hold. **Admins can never create or edit superadmins** (`403 ADMINS_CANNOT_CREATE_SUPERADMINS`, `403 ADMINS_CANNOT_EDIT_SUPERADMINS`). Every write needs step-up. The mock BFF enforces permissions with `403 FORBIDDEN`; the console hides or disables pages and buttons by the same keys.

Permission keys are `area:action`. Added: `users:restrict`, `users:suspend`, `users:delete`, `usernames:reassign`, `verification:grant`, `support:chat`, `support:email`, `marketing:campaigns`, `marketing:email`, `sales:leads`, `content:review`, `finance:reports`, `settings:edit`, `staff:manage` (existing: `users:read`, `users:ban`, `verification:review`, `moderation:*`, `payouts:approve`, `refunds:issue`, `ads:review`, `audit:read`, `audit:export` and the rest). Suspension endpoints now need `users:suspend`, checkmark grants `verification:grant`, live chat `support:chat`, email `support:email`.

Department templates (`GET /admin/roles`, `isTemplate: true`): Support, Marketing, Sales, Finance, Trust & Safety, Verification, Content, Ads, Engineering (read-only). Admins can hold several roles plus custom roles; effective permissions are the union.

`AdminAccountSummary` adds `roleIds[]`, `roleNames[]`, `approvedByName`; `status` adds `SUSPENDED`, `REVOKED`, `PENDING_APPROVAL`.

| Method | Path | Body | Response | Audit action |
|---|---|---|---|---|
| GET | `/api/v1/admin/roles` | — | `{ items: { id, name, department, permissions[], isTemplate }[] }` | — |
| POST | `/api/v1/admin/roles` | `{ name, permissions[], reason }` | `201 role` (custom) | `role.created` |
| POST | `/api/v1/admin/admins` | `{ email, name, role: "ADMIN"|"SUPPORT"|"SUPERADMIN", roleIds?, permissions?, reason }` | `201`. A `SUPERADMIN` is created as `PENDING_APPROVAL` when the setting is on. | `admin.created` |
| PUT | `/api/v1/admin/admins/{id}/permissions` | `{ role, roleIds?, permissions?, reason }` | `{ admin }` | `admin.permissions_changed` |
| GET / PUT | `/api/v1/admin/staff-settings` | PUT `{ requireSecondSuperadminApproval, reason }` (superadmin) | `{ requireSecondSuperadminApproval }` (default `true`) | `staff_settings.changed` |
| POST | `/api/v1/admin/admins/{id}/approve` | `{ reason }` (a different superadmin) | `{ admin }` status `INVITED` | `admin.superadmin_approved` |
| POST | `/api/v1/admin/admins/{id}/suspend` | `{ reason }` | `{ admin }`; all sessions killed now, reversible with `enable` | `admin.access_suspended` |
| POST | `/api/v1/admin/admins/{id}/revoke` | `{ reason }` | `{ admin }`; sessions killed, permanent | `admin.access_revoked` |

`GET /admin/admins/{id}` also returns `lastActions[]` (the last 15 audit entries by that admin). Errors: `409 SAME_SUPERADMIN`, `409 NOT_PENDING`, `409 LAST_SUPERADMIN`, `409 ACCESS_REVOKED`, `403 CANNOT_GRANT_UNHELD_PERMISSION`.

## Audit entries (extended)

Every admin action records: admin name, staff id (`actor.id`), departments/roles (`actor.departments[]`), action, target, before, after, reason, IP, request id and timestamp. The viewer has filters (search, area, admin, target, dates) and CSV export (`audit:export`, columns add `staffId` and `departments`; the export is itself audited).

## User actions

| Method | Path | Permission | Body | Notes | Audit action |
|---|---|---|---|---|---|
| POST | `/admin/users/{id}/restrict` | `users:restrict` | `{ features: ("POSTING"|"COMMENTING"|"MESSAGING"|"SELLING"|"GOING_LIVE")[], durationDays (1–90), reason }` | Limits only those features; user notified. | `user.restricted` |
| POST | `/admin/users/{id}/suspend` | `users:suspend` | `{ durationDays, reason }` | Signs out, notifies, starts the 120-day deletion clock (see Suspensions). Reinstate also `users:suspend`. | `user.suspended` |
| POST | `/admin/users/{id}/ban` | `users:ban`, step-up | `{ durationDays|null, reason }` | Permanent ban blocks re-signup by email and device fingerprint (stored hashed); unban clears the blocks. User notified. | `user.banned` |
| POST | `/admin/users/{id}/delete` | `users:delete`, step-up | `{ confirmUsername, reason }` | Deletes profile, posts, media and messages now; anonymises and retains order/payment/ledger records for 7 years. `409 PENDING_WITHDRAWALS`. Response adds `deletion { removed, anonymizedRecords, retainedUntil }`. | `user.deleted` |
| POST | `/admin/users/{id}/username/reassign` | `usernames:reassign`, step-up | `{ recipientUserId, reason }` | The owner gets an auto-generated username and a notification; the recipient gets the name and a notification; history kept (`REASSIGNED_AWAY` / `REASSIGNED_TO`). | `username.reassigned_between_accounts` |

All require a reason (5–1000 characters). User statuses add `DELETED`.

## Username 120-day hold

A username a person gives up (including the earlier username of an account that receives a reassigned one) is held for 120 days before anyone else can claim it.

| Method | Path | Permission | Body / query | Response | Audit action |
|---|---|---|---|---|---|
| GET | `/admin/usernames/held` | `usernames:reassign` or `reserved-usernames:manage` | — | `{ items: { username, releasedAt, availableAt, isHeld }[] }` (shown in the reserved-usernames manager) | — |
| GET | `/admin/usernames/hold` | same | `username` | `{ username, releasedAt, availableAt, isHeld }` (nulls when never held) | — |
| POST | `/admin/users/{id}/username/assign-held` | `usernames:reassign`, step-up | `{ username, reason, bypassHold? }` | `UserDetail`. While `isHeld`, `409 USERNAME_HELD` unless `bypassHold: true`. The account's old username is held. | `username.assigned` / `username.assigned_hold_bypassed` (flagged) |

## Legal documents and policy versioning

Permissions: `legal.documents.view`, `legal.documents.edit`, `legal.documents.publish`, `legal.notices.send`. Superadmins implicitly hold every permission. The "Legal" role template carries all four. Documents: `terms`, `privacy`, `cookies`, `community-guidelines`, `seller-terms`, `creator-terms`, `ads-policy`, `refund-escrow-policy`.

`LegalVersion`: `{ id, documentKey, versionNumber, status: "DRAFT"|"IN_REVIEW"|"PUBLISHED"|"SUPERSEDED", bodyMarkdown, changeSummary, effectiveAt, isMaterialChange, isFlaggedForLegalReview, createdByName, createdAt, submittedByName, submittedAt, publishedByName, publishedAt, returnedReason, rolledBackFromVersionNumber, noticeId }`. One open (DRAFT or IN_REVIEW) version per document; versions are never edited after publish.

| Method | Path | Permission | Body / response | Audit action |
|---|---|---|---|---|
| GET | `/admin/legal/documents` | view | `{ items: { key, title, publicPath, currentVersion, openVersion, versionCount }[] }` | — |
| GET | `/admin/legal/documents/{key}` | view | `{ document, versions[] }` newest first | — |
| POST | `/admin/legal/documents/{key}/versions` | edit | `{ bodyMarkdown, changeSummary, effectiveAt, isMaterialChange }` → `201 LegalVersion` (DRAFT). `409 OPEN_VERSION_EXISTS`. | `legal_version.created` |
| PUT | `/admin/legal/versions/{id}` | edit | same body, DRAFT only. `409 NOT_DRAFT`. | `legal_version.updated` |
| POST | `/admin/legal/versions/{id}/submit` | edit | → IN_REVIEW | `legal_version.submitted_for_review` |
| POST | `/admin/legal/versions/{id}/return` | publish | `{ reason }` → DRAFT with `returnedReason` | `legal_version.returned_to_draft` |
| POST | `/admin/legal/versions/{id}/publish` | publish, **step-up** | `{ reason, acknowledgeShortNotice? }` → `{ version, noticeId|null }`. Maker-checker: `409 SAME_ADMIN` when the publisher wrote or submitted it. `409 SHORT_NOTICE` for a material change with under 30 days unless `acknowledgeShortNotice`. Previous published version becomes SUPERSEDED. | `legal_version.published` |
| POST | `/admin/legal/documents/{key}/rollback` | edit | `{ fromVersionId, reason }` → `201` new DRAFT with the old text (material, effective in 30 days). Never rewrites history; must be reviewed and published. | `legal_version.rolled_back` |
| GET | `/admin/legal/versions/{id}` | view | `LegalVersion` | — |
| GET | `/admin/legal/versions/{id}/acceptance` | view | `{ requiredCount, acceptedCount, mustAcceptBy }` (material changes only) | — |

Material change: the effective date defaults to now + 30 days (editable), and the version is flagged `LEGAL REVIEW`. Side-by-side diffs are computed by the client from `bodyMarkdown`.

### Policy updated emails

Queued automatically on publish for `terms` and `privacy` and for any material change on other documents. The Legal admin drafts the email first, previews it, and sends tests to themselves.

| Method | Path | Permission | Body / response | Audit action |
|---|---|---|---|---|
| GET | `/admin/legal/versions/{id}/notice-draft` | view | `LegalNoticeDraft { versionId, documentTitle, subject, summaryText, whatChanged[], effectiveAt, reacceptNote, documentUrl, updatedByName, updatedAt, testSends[] }`. `whatChanged` is generated from the diff against the previous version. | — |
| PUT | `/admin/legal/versions/{id}/notice-draft` | edit or notices.send | `{ subject, summaryText, whatChanged[], reacceptNote }` | `legal_notice_draft.updated` |
| POST | `/admin/legal/versions/{id}/notice-draft/test-send` | notices.send or edit | sends the rendered email to the calling admin's own address; returns the draft with `testSends` | `legal_notice_draft.test_sent` |
| GET | `/admin/legal/versions/{id}/notice-preview` | view | `{ draft, subject, totalUsers, excludedHardBounces, excludedSuppressed, recipientCount, batchSize, ratePerSecond, batchesTotal, estimatedMinutes, sendsWithoutMarketingConsent: true }` | — |
| GET | `/admin/legal/notices`, `/admin/legal/notices/{id}` | view | `LegalNoticeProgress { id, documentKey, documentTitle, versionId, versionNumber, subject, status: "QUEUED"|"SENDING"|"COMPLETED", recipientCount, sentCount, excludedHardBounces, excludedSuppressed, batchSize, ratePerSecond, batchesTotal, batchesDone, queuedAt, queuedByName, estimatedCompletionAt, provider }`. The console polls every 3 seconds while sending. | — |
| POST | `/admin/legal/notices` | notices.send, **step-up** | `{ versionId, reason }` (resend a published version) → `201 LegalNoticeProgress`. `409 NOT_PUBLISHED`, `409 NOTICE_IN_PROGRESS`. | `legal_notice.queued` |

Preview rendering: the console shows a placeholder frame until the `policyUpdated` template from `@zudomart/email-templates` exists (`apps/admin/src/components/legal/legalNoticeEmailFrame.tsx` is the one place to wire it; props are the `LegalNoticeDraft` fields).

### User-facing endpoints (mocked in apps/webapp and apps/mobile)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/legal/policy-versions/current` | Public. `{ items: { policyVersionId, documentKey, title, versionLabel, summary, publishedAt, effectiveAt, isMaterialChange, documentUrl }[] }` |
| GET | `/api/v1/users/me/policy-acceptances` | `{ acceptedPolicyVersionIds[] }` |
| PUT | `/api/v1/users/me/consents` | Existing endpoint. Accepting a policy sends `policyVersionId` (webapp also keeps `policyVersion`) with `consents: {}`; the server stores an acceptance record. `422` when the version is not current. |

## Chat reports

Reporter side (mobile and webapp, see docs/plans.md §37): `POST /api/v1/reports` with `targetType` user, message, conversation or group, `conversationId`, `reportedUserId`, `reason`, `details`, `blockReportedUser`, `evidence[]` (`messageId`, `senderId`, `senderName`, `sentAt`, `text`, `attachments[]`), `evidenceSelection` and `evidenceHash` (SHA-256). `GET /api/v1/reports/me` lists the reporter's own reports.

Permissions: `chat-reports:review` (queue, detail, dismiss, remove group), `chat-reports:legal` (escalate, retention), plus the existing `users:moderate`, `users:restrict`, `users:suspend`, `users:ban` for user actions.

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/chat-reports` | Query `status` (OPEN default, ALL), `targetType`, `reason`, `priority`, `search`, `cursor`. Child-safety first, then priority, then SLA |
| GET | `/admin/chat-reports/:reportId` | Detail with `transcript[]` (only reporter-submitted messages, `isReportedUser`), `evidenceHash`, `isEvidenceHashVerified`, `evidenceRetainedUntil`, `spamScore { score, signals[], source }`, `decision`, `reporterOutcome`, `history` |
| POST | `/admin/chat-reports/:reportId/actions` | `{ action: DISMISS \| WARN_USER \| RESTRICT_USER \| SUSPEND_USER \| BAN_USER \| REMOVE_GROUP \| ESCALATE_LEGAL, reason, durationDays? }`. Per-action permission, step-up for BAN_USER, REMOVE_GROUP and ESCALATE_LEGAL. 409 `REPORT_ALREADY_DECIDED`, `NO_REPORTED_USER`, `NOT_A_GROUP_REPORT`. Audited on the report and the user. Reporter is notified "We took action" or "No violation found" (not on escalation) |
| GET | `/admin/chat-reports/retention` | `{ retentionDays, legalHoldDays, label: "LEGAL REVIEW" }` |
| PUT | `/admin/chat-reports/retention` | `{ retentionDays (30 to 730), reason }`, `chat-reports:legal` and step-up, audited |

## Identity checks (Smile ID)

Paid Blue and Gold checkmarks verified with Smile ID. Served by go-identity. Permission `verification:review`; decisions need step-up.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/verification-cases?status=under_review` | `status`: `under_review` (default), `awaiting_capture`, `awaiting_consent`, `approved`, `rejected`. Returns `{ data: IdentityCaseListItem[] }` oldest first |
| GET | `/admin/verification-cases/{caseId}` | `{ case, profile, health, eligibility }` |
| POST | `/admin/verification-cases/{caseId}/approve` | `{ reason }`, step-up. Grants the checkmark (also a manual pass before a result). Audited `identityVerification.approved` |
| POST | `/admin/verification-cases/{caseId}/reject` | `{ reason }`, step-up. Starts the automatic refund for `blue` / `gold_only`. Audited `identityVerification.rejected` |

`case` fields: `status`, `refundStatus` (`not_applicable`, `requested`, `refunded`, `not_charged`, `failed`, `manual_store_refund`), `refundMethod`, `checks { liveness, document, faceMatch, databaseLookup, faceMatchConfidence, nameMatchScore }`, `trustScore`, `eligibleAtPayment`, `decisionReasons[]`, `fraudSignals[]`, `documentType`, `documentCountry`, `smileReference`, `smileResultCode`, dates. No images are served; reviewers open the Smile ID job in the Smile ID portal.
