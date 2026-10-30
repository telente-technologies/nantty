# Executive summary

## Decision

**Not ready to certify for production from available evidence.** No unauthorized data access or financial loss was demonstrated, but a locally reproduced ads withdrawal idempotency-response race was fixed. Runtime verification is now broader than static review: auth, privacy, gateway, media, payments, wallet, escrow, inventory, orders, realtime modules and ads have bounded local tests. Full-stack authorization, real provider ingress, storage/cloud permissions, WebSocket room isolation, distributed races and load/recovery behavior remain incomplete. Money-schema bootstrap defaults and isolated privileges have been tested; table-by-table DML minimization and actual AWS role/task setup remain open.

## Findings

- Confirmed Critical: **0**
- Confirmed High: **0**
- Confirmed Medium: **3** findings (local database privilege boundary, Terraform egress policy, and provider amount-mismatch state handling; local fixes exist but cloud/runtime verification is incomplete where noted)
- Confirmed Low: **1** locally reproduced and fixed ads same-key withdrawal retry race; no duplicate payout or debit was observed
- Informational / launch or integration gaps: **2**
- Suspected vulnerabilities awaiting manual/runtime verification: **0** in this assessment; many high-risk behaviors remain untested rather than presumed vulnerable

### Latest runtime rerun qualification — 2026-10-29

Escrow local verification is now passing: the 500 was traced to the test harness not applying escrow migrations to its disposable schema. The remaining underpayment failure was a synthetic fixture inconsistency (the overridden charge amount was paired with the fee for the original order amount); correcting the fixture restored the expected failed payment state and finance-review record, with no escrow created. The complete escrow package suite and focused payment underpayment regression passed against disposable PostgreSQL and fake Flutterwave. Auth, privacy (excluding the unrelated localhost object-storage test), wallet, and ledger package suites also passed in this continuation. This does not verify AWS configuration, the deployed gateway-to-service topology, or real provider behavior.

## Remediation status (2026-10-29)

- AUD-NET-001: checked-in Terraform now defaults both shared-task and payment public HTTPS egress to **deny**; explicit, validated IPv4 CIDRs are required to permit it. Static regression, Terraform formatting, and dev configuration validation pass. It remains **Fixed but Unverified** because no AWS plan/state was accessed and required external provider connectivity has not been dynamically proven. Before deployment, inventory external destinations and configure reviewed CIDRs or a domain-aware egress proxy; do not restore `0.0.0.0/0`.
- AUD-DB-001: **Fixed but Unverified outside isolated local PostgreSQL**. Startup migration is disabled for all six money modules; a dedicated `svc_migrator` `--migrate-money` task applies migrations before rollout. Runtime `svc_money` cannot perform schema DDL or assume migration/module-owner roles. Default future-table grants omit DELETE; explicit DELETE is limited to three source-verified cleanup tables. Runtime posting, rollback, balance checks and append-only denial pass on fresh disposable PostGIS 17. Full per-table SELECT/INSERT/UPDATE minimization and actual AWS roles, task definition, secret/IAM/KMS/network permissions and workflow execution remain unverified.
- AUD-ROUTE-001's gateway route map is fixed and its route/auth tests pass; runtime gateway-to-Go behavior remains unverified. It was a product availability gap, not a security vulnerability. AUD-CONFIG-001 remains a fail-closed production operator prerequisite, not a vulnerability.
- AUD-ADS-001: a 16-request same-idempotency-key withdrawal race was reproduced. The service now rechecks the key under the account lock. The regression and full ads suite pass; different-key contention, multiple service instances and real downstream wallet behavior remain unverified.
- No AWS resources were planned/applied and no production action occurred.

No confirmed private user information exposure, authentication bypass, financial loss, RCE, or successful cross-tenant access was demonstrated.

## Most important evidence

1. The original `infra/local/postgres/create-databases.sh` made the ledger schema runtime-owned. The current local code assigns all six money schemas to `svc_migrator` and keeps migration execution separate. An isolated FK failure exposed that PostgreSQL uses the referencing table owner's privilege for `FOR KEY SHARE`; the corrective migration restores the required owner key-column privilege without granting runtime journal updates. Runtime transaction, negative privilege, and scoped cleanup checks now pass locally. AWS state and migration task setup remain deployment prerequisites.
2. The Go live service implements `/api/v1/spaces` and related endpoints. The gateway route map was missing them in the original assessment; explicit GET and authenticated write mappings have since been added and route/type tests pass. Live gateway-to-Go behavior remains unverified. This was an integration/availability issue, not an authorization bypass.
3. Production settings fail closed for missing admin IP allowlists; the current prod tfvars leaves the allowlist as a commented placeholder. This blocks a safe production apply until the operator supplies trusted CIDRs; it does not silently expose admin access in the reviewed deployment path.
4. Shared ECS tasks and go-money had broad HTTPS egress defaults to arbitrary IPv4 addresses. Checked-in Terraform now defaults both egress CIDR lists to empty and rejects `0.0.0.0/0`; static policy and Terraform validation pass. The configured AWS state and required outbound integrations were not checked.

## Financial integrity and privacy

Ledger code has append-only triggers and runtime DML revocations, payment flows use idempotency and provider webhooks preserve raw bodies, and wallet/escrow are separate modules. Bounded ledger, payment refund/webhook, wallet, escrow, inventory, orders and ads withdrawal tests passed against disposable databases/fake dependencies. These do not prove multi-instance or real provider safety; several payout/settlement and cross-service flows remain **unverified**.

No private profile, order, message, identity document, wallet, or admin data was accessed. BOLA/IDOR and tenant-isolation checks need seeded identities and a running isolated stack.

## Availability and DDoS

Gateway source provides global and route-specific rate limits, body-size caps, upstream timeouts and a Valkey-backed counter. During Valkey errors it deliberately falls back to per-process in-memory counters for a short circuit interval; this reduces availability impact but weakens aggregate throttling across replicas during the outage. No load or exhaustion test was run.

## Dependency and infrastructure confidence

Terraform and container configuration were inspected statically. Trivy’s cached Rego policy set emits parse errors; its 28 raw misconfiguration candidates were manually triaged, with only AUD-NET-001 retained. A current dependency advisory scan was not available. Gitleaks scanned selected infra/TypeScript/Elixir/Python/package/workflow trees and produced 42 candidates; reviewed hits were local-only RabbitMQ fixtures, tests/sample configuration, or untracked vendored/generated Elixir dependency files, with no production credential confirmed in those scanned subsets. The apps tree and Go service tree were not fully scanned, and Git history was not scanned, so the secret assessment is incomplete.

## Remediation order

1. Verify shared and payments HTTPS egress in a non-production plan; inventory provider destinations or implement a reviewed domain-aware egress proxy before enabling egress.
2. Verify the six-schema database role separation, migration task secret and explicit DML grants in isolated AWS staging; complete table-by-table SELECT/INSERT/UPDATE review.
3. Verify the Space gateway route against a live local Go service with auth policy and service failure propagation; current checks are route/source-level only.
4. Supply and review the production admin allowlist before any apply; retain production fail-closed configuration validation.
5. Bring up the isolated local backend with test-only keys, then execute the authorization, webhook, file-upload, and money race matrix in [RETEST_CHECKLIST.md](RETEST_CHECKLIST.md).
6. Rerun current dependency, IaC, container and secret scans with updated databases/tool versions, then resolve scanner findings manually.

No production launch approval should rely on this bounded local evidence alone.
