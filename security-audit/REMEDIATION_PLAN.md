# Prioritized remediation and verification plan

## P0 — before production money/data launch

- Complete AUD-DB-001 deployment verification: local code has separate migration/runtime roles, startup migrations are disabled, and isolated PostgreSQL verifies DDL/role-denial plus ledger posting. Verify the exact six-schema role/grant setup and migration task in isolated AWS staging; finish table-by-table runtime DML review before production.
- Execute identity/authorization tests using at least two seeded users per role (user, seller, creator, business member, staff/admin, suspended, private, blocked) for orders, messages, wallets, payouts, KYC, media and tenant resources.
- Execute payment/escrow/webhook/refund/withdrawal concurrency suite against fake provider and disposable DB; verify balanced ledger, idempotency and recovery invariants.
- Validate production secrets, staff IP allowlist, proxy hop count, DB TLS/auth, KMS and state-bucket access through a reviewed non-production plan; never inspect or modify production state during this audit.
- Run updated dependency and container scans; resolve confirmed Critical/High runtime advisories.

## P1 — before feature launch

- Decide Space launch status. The gateway mappings are present and route tests pass; if launching, verify creator-only host controls/listener/privacy behavior, abuse limits and gift money controls end-to-end; otherwise keep API feature disabled.
- Validate webhook signing/replay handling, strict content type/body handling, request IDs and error redaction against fake provider.
- Run upload abuse tests with synthetic malformed/spoofed files under bounded size/time, ensure quarantine, malware scan, moderation, authorization and signed URL expiry.
- Verify WebSocket room isolation, session revocation, presence and message recipient checks with two isolated users.
- Test Valkey/RabbitMQ outage and retry/backoff behavior without saturating queues.

## P2 — operational resilience

- Bounded API load/slow-client testing and WAF/rate-limit alert validation in staging under a written ceiling.
- Verify backup restore, cross-region recovery and migration rollback with synthetic data and recorded RTO/RPO.
- Review logs for PII/token leakage, cache headers, source-map exposure, CSP and frontend storage behavior in a browser.
- Verify operational response, security contact, abuse escalation and key rotation drills.

This is a remediation plan, not evidence that an item passed. Only checks explicitly recorded as executed in the progress and coverage reports are verified; staging, provider, runtime identity and deployment gates remain open until evidence is recorded.

## Remediation follow-up (2026-10-29)

- AUD-NET-001 source policy is now fixed to deny-by-default direct HTTPS egress with explicit reviewed CIDR lists. Before deployment, inventory required external destinations and verify connectivity in a non-production plan/test; a domain-aware proxy is preferable for dynamic provider ranges.
- AUD-DB-001 is fixed and locally verified for all six money schemas, but remains unverified in AWS. Do not grant runtime identity membership in schema-owner roles. Remaining work is staging role/secret/task/IAM/KMS/network verification and granular table DML review.
- AUD-ROUTE-001 gateway routes are now implemented with optional auth for reads and required auth for other methods; unit and type checks pass. Live gateway-to-Go verification remains a release check. It was a product integration gap, not a security vulnerability.
