# Medium and low findings

See [FINDINGS.md](FINDINGS.md) for the full finding schema and reproduction notes.

| ID | Severity | Confidence | Status | Summary |
| --- | --- | --- | --- | --- |
| AUD-DB-001 | Medium (local template) | High | Fixed but Unverified | Six-schema migration/runtime identities are separated; scoped DELETE grants and ledger posting pass on disposable PostgreSQL. AWS role/task setup and full table-level DML minimization still need review. |
| AUD-NET-001 | Medium | High | Fixed but Unverified | Checked-in Terraform now denies direct internet HTTPS by default and permits only reviewed CIDR lists. AWS plan/state and required provider connectivity remain unverified. |
| AUD-ROUTE-001 | Informational | High | Fixed but Unverified; not a vulnerability | Space GET list/detail and authenticated write routes now map to Go live; unit route policy is verified, but live gateway-to-Go integration remains untested. |
| AUD-CONFIG-001 | Informational | High | False Positive as a vulnerability; operator prerequisite remains | Production admin allowlist is intentionally required but not populated in checked-in prod tfvars. Fail-closed behavior remains. |
