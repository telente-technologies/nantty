# Nantty Security Incident Response Playbook

## 1. Severity Classification & Immediate Escalation

| Severity | Examples | Initial Containment SLA |
| --- | --- | --- |
| **SEV-1 (Critical)** | Signing key (`EdDSA` / `X-Gateway-Identity-Signature` / `X-Internal-Token`) leak; unauthorized ledger/escrow movement; PSP webhook secret bypass; active RCE/DB exposure | `< 15 minutes` |
| **SEV-2 (High)** | Admin session compromise; KYC/Black Government unauthorized approval; single-tenant IDOR/BOLA; SSRF to internal VPC; E2EE key leakage | `< 1 hour` |
| **SEV-3 (Medium)** | Rate-limit evasion; non-privileged data leak; CSP/cookie regression; CI secret scan hit in non-prod branch | `< 24 hours` |

---

## 2. Targeted Containment & Rotation Runbooks

### A. Compromised JWT Signing Key or Gateway HMAC Secret
1. Publish replacement EdDSA public key to JWKS (`goIdentity`) while keeping verification overlap window minimal, or revoke compromised key ID (`kid`) immediately if active abuse is confirmed.
2. Rotate `GATEWAY_IDENTITY_SIGNING_SECRET` / `INTERNAL_API_TOKEN` across Secrets Manager / ECS task definitions (`deploy.yml`) using dual-accept transition only if zero abuse; otherwise hard cutover + rolling restart.
3. Purge active session denylist/refresh tokens in Valkey and force re-authentication (`POST /admin/users/{id}/sessions/revoke` / global epoch bump).

### B. Admin Console Account or IP Allowlist Breach
1. Immediately revoke affected admin account (`POST /admin/admins/{id}/suspend` or DB role deactivation), invalidate Valkey session & pending step-up tokens.
2. Verify `ADMIN_IP_ALLOWLIST` and `ADMIN_TRUSTED_PROXY_HOPS` (`apps/admin/src/server/requestOriginGuard.service.ts`).
3. Audit `audit_logs` by `actor_id` and `ip_address` for PII reveals, role changes, ledger adjustments, Black checkout authorizations, and webhook dead-letter replays.

### C. Payment / Escrow / Wallet / Black Government Anomaly
1. Freeze affected wallet/payout accounts (`hold`) and pause automated payout workers (`goMoney`).
2. Compare PostgreSQL ledger sum invariants (`SUM(debits) == SUM(credits)`), `webhook_events` SHA-256 digests, and `payout_transfers` against provider settlement statements.
3. For Black Government abuse or institutional compromise: revoke Black verification (`status = "revoked"`), disable `privateCheckoutEnabled`, and verify `renewalSettlement` blocks late settlement (`SEC-2026-001`).

### D. External Webhook Secret / Smile ID / Kwikpik Compromise
1. Rotate `FLW_SECRET_HASH` / `SMILE_ID_API_KEY` / `KWIKPIK_WEBHOOK_SECRET` in AWS Secrets Manager and provider portals.
2. Confirm AWS WAF / Security Group IP allowlist for Smile ID callbacks (`infra/aws/modules/platform`) has no unauthorized CIDR additions.
3. Replay only verified missed events after signature rotation; quarantine tampered `webhook_events` rows.

### E. E2EE Device Key / Messenger Compromise
1. User revokes compromised device via trusted-device management (`goIdentity`), rotating identity/prekey bundle and forcing Sender Key rotation across group and store team chats (`@nantty/chat-crypto`).
2. Confirm expired/revoked device triggers local `SecureStore` purge on next sync.
