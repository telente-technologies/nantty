# Security review

Static review and fixes from 4 Oct 2026. Details live under `security/`:

- `security/audit/ENVIRONMENT_BOUNDARY.md`: what may be tested, plus the redacted credential inventory
- `security/audit/reports/ATTACK_SURFACE.md`: route inventory and auth model
- `security/audit/reports/FINDINGS.md`: SEC-0001…SEC-0022 with status
- `security/audit/reports/REMEDIATIONS.md`: fixes, verification, deploy checklist (`GATEWAY_IDENTITY_SECRET`), open follow-ups
- `security/audit/reports/ACTIVE_TEST_PLAN.md`: live red-team phases
- `security/audit/reports/FINAL_SECURITY_AUDIT.md`: final report and scorecard
- `security/audit/reports/FINANCIAL_INTEGRITY.md`: money controls and snapshot results
- `security/audit/evidence/`: govulncheck (before and after the grpc upgrade), pnpm and pip audits

Status:
- Fixed: SEC-0001–0007, 0009, 0010, 0012, 0014–0018.
- SEC-0011 is fixed and owner approved.
- SEC-0008 and SEC-0013 are fixed (money agent).
- SEC-0019–0022 are accepted risks. For SEC-0022, a separate migration-owner role is recommended.
