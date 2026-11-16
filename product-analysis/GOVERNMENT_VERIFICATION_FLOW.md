# Black Government verification and billing flow

Status: **partially implemented; not verified end to end**. Owner-approved monthly prices are **USD 300/month** for verified Nigeria (`NG`) legal jurisdiction and **USD 500/month** internationally. Monetization administrators may change regional prices using the audited effective-dated price table. Black remains USD-only, monthly-only, web-only, without discounts or unpaid grace, and requires recurring card authorization. Public/self-serve checkout remains disabled.

## Existing source evidence

- `services/go/modules/users/src/modules/checkmarks/commands/submitBlackApplication/submitBlackApplication.handler.go` accepts only a government profile and records agency, representative, role and a checklist-backed application. It blocks duplicate open/approved applications.
- `services/go/modules/users/src/modules/checkmarks/services/blackApplicationView.service.go` displays official evidence checklist and approval metadata. The checklist includes an official letter, official-channel verification, representative identity/role and proof the institution exists.
- Existing admin UI `apps/admin/src/components/people/blackApplicationsWorkspace.tsx` describes manual vetting and two distinct admins. Go integration test `services/go/modules/users/usersCreatorAndCheckmarks.integration_test.go` verifies the separate-admin rule and handle reservation/revocation.
- Subscription catalogue/code calls Black “Official,” is non-self-serve and has 20% normal ad-load in configuration. Current source does not deliver the generated OTP: its outbox event omits the code and has no matching email consumer. Secure single-use checkout invitations, end-to-end payment activation, merchant-specific recurring USD billing and complete cancellation/retry integration are not verified.

## Separate state machines

Maintain distinct state fields/entities rather than one `verified`/`active` flag:

1. **Institution application**: draft, submitted, email-pending, evidence-review, awaiting-second-approval, approved, rejected, withdrawn, re-verification-due, revoked, appealed.
2. **Representative authority**: evidence submitted, verified, rejected/revoked. This is not established by mailbox OTP alone.
3. **Commercial subscription**: invitation-pending, checkout-started, payment-pending, active, past-due/grace, cancellation-pending, cancelled/expired, refunded/charged-back.
4. **Badge projection**: Black appears only if institution approval is valid, the authorized target profile is bound to the approved entity, and the paid subscription is active under the chosen policy. Revocation removes the projection promptly while retaining immutable history.

No state may grant administrative permissions, wallet/payment privileges, visibility/ranking exemption, moderation immunity, platform policy exceptions or access to other government accounts.

## Required flow

1. Government profile owner submits institution name/legal identity, jurisdiction, public website, official address, requested handle, official government-domain email and representative name/title/contact. Collect only evidence needed for review and disclose retention/access rules.
2. Send a cryptographically random OTP challenge to the asserted official email. Store only a keyed/hash representation; bind to account, application and address; expire quickly, cap attempts/resends, invalidate after use, protect against enumeration and replay. Email possession verifies control of that mailbox only.
3. Review institution legitimacy independently using official published government channels/domain, official registry/gazette, letterhead authorization and direct callback to a published number. Verify the representative’s authority and scope. Do not rely only on documents uploaded by the applicant or a `.gov` string.
4. Authorized reviewer records checklist decisions, evidence references (not unnecessary raw copies), rationale and audit timestamps. First approval moves to second review; second approver must be distinct and must not approve their own application. Reject/return-for-evidence with reasons and appeal path.
5. On application approval, a permitted staff role may issue a checkout invitation. The invitation is generated randomly, stored hashed, single-use, short-lived, account/profile/application-bound, and delivered to the verified official contact. It cannot change recipient/account/profile. Reissue revokes the previous token. Do not put token in analytics, logs, referrers or support screenshots.
6. Invite opens HTTPS web-only page. Reauthenticate the approved account (step-up auth recommended), validate invitation server-side and show institution/profile, the current admin-managed monthly USD price, taxes/settlement details, renewal interval/date, failure/cancellation/refund terms and explicit recurring-billing consent. No annual option.
7. Provider-hosted/tokenized checkout collects payment details; Nantty never receives/stores PAN or CVV. Create a pending commercial subscription linked to approved application, profile and provider customer/subscription reference.
8. Activate billing entitlement only after a verified provider success event for the exact amount/currency/quote, with idempotency and replay protection, AND valid admin approval. A browser redirect or client callback is not payment proof. Record event ID, provider transaction, price version, payment/renewal state and audit trail.
9. Renewal uses provider-authenticated event/reconciliation. Handle provider failure/retries/grace/cancellation according to disclosed policy; notify verified contact. Never let a stale event restore revoked institution approval. A refund/chargeback may suspend subscription while preserving the separate verification decision and evidence trail for review.
10. Support staff-initiated cancellation/revocation only with reason, actor, role and audit event. Cancellation of billing does not erase the institution evidence. Reverification can expire an approval; provide notice and appeal process.

## Security controls

- Role-permission checks on application review, invitation issue/revoke, subscription overrides and badge revocation; require authorized government-verification roles, not broad admin access by default.
- Separation of duties: submitter cannot approve; two different staff identities for approval; sensitive billing override should also be audited.
- Token: at least 256 bits of cryptographic entropy, hash at rest, single-use atomic consume, expiry, binding, rate limits, revoke/rotate, no token replay across users or environments.
- OTP: one-time, purpose/app/account/email-bound, short lifetime, attempt cap, resend cooldown, hashed storage, invalidated on success/rotation, no response that leaks whether an email exists.
- Webhook: verify official signature/authenticity, timestamp/replay rules, event uniqueness, exact amount/currency/product/account binding and state transition inside transaction.
- Encrypt identity documents in private storage; short-lived access; audit reads; retention and deletion policy; redact application PII from logs.
- Admin audit log is append-only and includes before/after state, reason and request correlation.
- Do not trust frontend hidden buttons, badge color, profile type, subscription cache or provider return URL for authorization.

## Pricing/provider gates

- The owner resolved the price conflict: USD 300/month in Nigeria and USD 500/month internationally. Admin changes must be audited, effective-dated, and must not rewrite existing subscription terms or immutable price history.
- Public Flutterwave Payment Plan documentation supports recurring plans in general; it does not prove merchant-specific USD recurring card collection and settlement in the target country. Confirm account enablement, USD card coverage, tokenization, cross-border recurring authorization, settlement currencies, refunds, dunning, webhook signing and provider terms with Flutterwave. Run sandbox-only evidence before enabling.
- Black is web-only by this specification. No mobile external link should bypass store billing rules; no in-app purchase is enabled without distinct compliance/product approval.
- Annual Black is off by default even if the engine supports a yearly amount.

## Test matrix

Test synthetic government applications: non-government profile rejection, OTP expiry/replay/wrong account/wrong purpose, OTP attempts/resend, authoritative review evidence, role denied, one-admin-only denied, same-admin second approval denied, correct two-admin approval, invalidated/reused invitation, expiry/account/profile binding, leaked-token redaction, concurrent token consume (one succeeds), checkout amount/currency tampering, redirect-only activation denied, invalid provider signature, duplicate provider webhook (one effect), failed charge, renewal, cancellation, refund/chargeback, revoked institution + late success, disabled annual plan, unauthorized status query, audit record completeness and no badge without both predicates.

