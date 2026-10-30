# Retest checklist

Use only an explicitly isolated staging/local environment with disposable synthetic accounts and fake providers. Record environment, build SHA, test IDs and sanitized evidence. Stop on unexpected external egress or real customer data.

## Setup gates

- [ ] Confirm written test target host(s) are loopback or isolated staging explicitly in scope.
- [ ] Confirm `APP_ENV` is non-production, payment provider is fake/sandbox and all credentials are test-only.
- [ ] Confirm database is disposable, take and verify snapshot, and establish restore command.
- [ ] Create synthetic identities for anonymous, standard, seller, creator, business teammate, staff, admin, suspended, private and blocked states.
- [ ] Confirm logs redact auth headers, cookies, OTPs, KYC values, payment references and personal data.
- [ ] Set strict test duration/request/concurrency ceilings and monitor resource use.

## Authorization / privacy

- [ ] For every object endpoint, request user A's order, message, wallet, payout, KYC document, private profile/media and business resource as user B and anonymous; expect non-disclosing 403/404.
- [ ] Repeat mutations with another user's IDs, role claims, business/store IDs, hidden frontend routes and alternate API versions.
- [ ] Verify private follow-request acceptance is owner-only; pending followers cannot read protected profile/posts/stories/media through any feed/search/link path.
- [ ] Verify block and suspension policies are consistent across posts, clips, comments, messages, search, websocket events and notifications.
- [ ] Verify staff routes require correct staff audience, permission, step-up, IP policy and audit recorder; check permission downgrades revoke or expire privileges as intended.

## Auth/API/frontend

- [ ] Test OTP expiration, reuse, resend, replay, attempt limits, enumeration and parallel registration/reset.
- [ ] Test JWT wrong signature/algorithm/issuer/audience/expiry/session ID and revoked session; verify cookie flags and logout/password-change revocation.
- [ ] Test CSRF/origin/CORS, content types, malformed/duplicate query parameters, request size, timeouts and error body/header redaction.
- [ ] Test stored/reflected/DOM XSS, dangerous URL schemes, open redirects, file previews, source maps and browser cache/storage using synthetic payloads.
- [ ] Test GraphQL/REST pagination caps, search complexity, regex/path traversal and URL-fetch SSRF boundaries where applicable.

## Money/concurrency

- [ ] Run matrix in [RACE_CONDITIONS.md](RACE_CONDITIONS.md) against fake provider; record initial/final ledger and database invariant queries.
- [ ] Replay valid webhook and altered signature/body, stale event, duplicate event ID and out-of-order provider events.
- [ ] Verify client-side amount/currency/fee/status/payout destination tampering is rejected and provider truth is reconciled.
- [ ] Verify seller and platform fee/refund components, chargebacks after escrow release, negative-balance limits and reconciliation.
- [ ] Assert runtime database identity cannot alter/drop append-only trigger or schema; migration identity can run a test migration.

### AUD-DB-001 focused local retest (2026-10-29)

- [x] Create a fresh, uniquely named disposable Postgres/PostGIS container with a loopback-only port and fresh ephemeral storage; never use the existing `backend:up` database or `pnpm backend:reset`.
- [x] Run the embedded all-money migration command twice using only the disposable `svc_migrator` URL; confirm all six module schemas apply cleanly and repeated execution succeeds.
- [x] Connect as `svc_money`; verify it is not a member of `svc_migrator` or any module-owner role, has no `CREATE` on any of the six money schemas, and cannot create/alter/drop schema objects, `SET ROLE svc_migrator`, create a DB role, or grant itself the migration identity.
- [x] Verify default grants omit DELETE; confirm only payout destinations, creator brand deals and step-up expiry rows have runtime DELETE, synthetic cleanup works, other money tables deny DELETE, and TRUNCATE is denied.
- [x] Diagnose FK `FOR KEY SHARE`: reproduced failure, traced it to missing owner-only key-column UPDATE after append-only privileges were revoked, added forward migration, and reran test against clean PostGIS 17 database.
- [x] Focused runtime regression passed: balanced posting succeeds; transaction rollback leaves no rows; unbalanced posting persists no rows; journal edit is blocked by append-only trigger; account balance and debit/credit totals reconcile.
- [ ] Verify runtime and migration role attributes/ownership in isolated AWS staging before launch; confirm `svc_migrator` is absent from the go-money task's task definition/secrets, while only migration task receives the dedicated URL.
- [x] Run the migration-task mocked suite. It passed using mocked AWS CLI only.
- [ ] Review actual ECS task definition and IAM/Secrets Manager/KMS/network permissions in a non-production plan before production use. The real AWS task definition is external and has not been read.

## Media/realtime/availability

- [ ] Use benign malformed/MIME-spoofed synthetic files, oversized boundary files and traversal filenames; test quarantine, scanner/moderation fail mode and signed URL expiry.
- [ ] Join another user's websocket room and attempt event publish/replay; verify no cross-user payloads or unauthenticated state changes.
- [ ] Exercise duplicate queue deliveries, poison message, retry cap/DLQ and worker crash recovery.
- [ ] Run the bounded availability plan in [DDOS_PROTECTION.md](DDOS_PROTECTION.md), one endpoint at a time, with abort thresholds.

## Closure

- [ ] Restore snapshot and verify data integrity; preserve redacted logs/evidence.
- [ ] Rerun updated secret/dependency/container/IaC scans and manually verify each candidate.
- [ ] Close each finding only with code reference, test output and relevant deployment/runtime proof.
- [ ] Reassess production readiness after all Critical/High items and launch-gate tests pass.
