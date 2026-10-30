# Findings

Only evidence checked in this assessment is classified below. Older issue lists are linked as historical context, not assumed current. No successful exploit against a running app was demonstrated.

## AUD-DB-001 — Local ledger runtime identity owns schema protection boundary

- **Severity:** Medium (local template / defense-in-depth); **confidence:** High for local bootstrap source, unknown for deployed AWS role grants.
- **CWE:** CWE-250 (execution with unnecessary privileges), CWE-266 (incorrect privilege assignment).
- **CVSS:** Not assigned: exploitability depends on prior compromise of a local service DB identity; production bootstrap state not verified.
- **Affected files:** `infra/local/postgres/create-databases.sh` (role ownership/grants); `services/go/modules/ledger/src/loaders/moneyModule.loader.go` and `services/go/deployables/goMoney/{server.go,ledgerMigration.go}` (startup separation and migration task); `.github/scripts/runMigrationTask.sh` and `infra/aws/modules/platform/deploy.tf` (pre-rollout task/runtime config); append-only/FK migrations and explicit runtime-delete migrations in ledger, payments and creators.
- **Affected component:** local PostgreSQL bootstrap for ledger (and analogous service schemas); append-only journal history.
- **Root cause:** the bootstrap creates each schema `AUTHORIZATION svc_<service>`, including `svc_ledger`. The migration revokes UPDATE/DELETE/TRUNCATE, but schema/table ownership remains powerful enough to alter/drop the trigger or otherwise change the protection boundary. The source report also records this risk as accepted historically. AWS documentation describes `svc_migrator` as schema owner, but no automated bootstrap or live role-grant verification was available here.
- **Preconditions:** attacker already obtains the runtime DB credential, or an unsafe local process can use it. No remote unauthenticated path was identified.
- **Original reproduction:** the former local bootstrap used `CREATE SCHEMA ledger AUTHORIZATION svc_ledger`, giving a runtime identity ownership over the protection boundary. The current isolated retest instead creates `ledger` owned by `svc_migrator`, verifies `svc_money` DDL/role escalation is denied, and exercises actual balanced posting as `svc_money`.
- **Expected:** runtime identity can perform required DML but cannot redefine append-only enforcement; only a separate migration identity can change schema/triggers.
- **Original actual:** local bootstrap made the runtime identity schema owner, so trigger DDL could be changed by that identity.
- **Current isolated actual:** all six money schemas and migrated tables are owned by `svc_migrator`; `svc_money` has USAGE but not CREATE on each, no membership in a migration/module-owner role, and is only a member of `nantty_readers`. Neither login is superuser, CREATEROLE, or CREATEDB. Runtime cannot create/alter/drop objects or assume/grant the migrator role. Default future-table privileges omit DELETE; the only explicit DELETE grants are on payout destinations, creator brand deals and step-up expiry rows. Journal entries/lines and other ledger tables deny DELETE/TRUNCATE. Runtime successfully deletes synthetic rows from each of those three allowed cleanup tables and posts balanced entries. PostgreSQL checks ledger foreign keys using the referencing table owner's rights; the append-only migration had revoked the owner’s `UPDATE`, causing the first isolated runtime post to fail. The forward migration restores only owner column `UPDATE(id)`; table-level UPDATE remains revoked and the append-only trigger blocks runtime history edits. Runtime `UPDATE(id)` is also revoked.
- **Evidence:** local bootstrap, append-only and FK-owner migrations; runtime privilege regression test; disposable PostgreSQL query results and command outputs recorded in `REMEDIATION_PROGRESS.md`. No customer data or existing development database was used. AWS role/task state remains **Needs Manual Verification**.
- **Impact:** a compromised ledger service credential could alter journal history and weaken accounting auditability.
- **Recommendation:** separate migration/schema-owner identity from runtime roles in local and cloud bootstrap; grant only required DML; add role-level integration tests and verify after deployment.
- **Regression:** `python3 -m unittest discover -s security-audit/tests -v` now asserts migration separation, schema ownership and narrow DELETE defaults. The opt-in PostGIS runtime-role test checks DDL/role escalation, append-only denial, the one ledger expiry-delete exception and transactional posting.
- **Priority/status:** P1 before production money launch; **Confirmed** for local bootstrap template.
- **Remediation status (2026-10-29):** **Fixed but Unverified outside local isolated PostgreSQL.** Startup migrations are disabled for all six money modules; `--migrate-money` requires `svc_migrator`, scopes each connection to its module schema, strips caller role-switching options, and is wired through a pre-rollout ECS task runner that fails closed in mocked tests. The local bootstrap source makes `svc_migrator` owner of all six schemas and grants `svc_money` no migration/module-owner membership. Default table grants omit DELETE; explicit DELETE exists only for three source-verified cleanup operations. The FK-owner migration restores only `UPDATE(id)` to the migration/table owner, required for PostgreSQL's internal FK key-share check; it does not grant that privilege to runtime. In an isolated PostGIS 17 database, all-six migrations passed twice; runtime DDL/role escalation was denied; allowed cleanup operations and denied journal DELETE/TRUNCATE were verified; balanced posting and balances succeeded, rollback and unbalanced posting left no rows, and journal mutation remained rejected. The full ledger module suite passed against a disposable DB. The bootstrap command itself was not proven end-to-end from pristine state in the final pass. Full table-by-table minimization of read/insert/update grants and actual AWS role/task/IAM/KMS/network setup remain unverified. See `REMEDIATION_PROGRESS.md`, `LOCAL_PENETRATION_TEST.md` and `FINANCIAL_INTEGRITY_TEST_RESULTS.md`.

## AUD-ROUTE-001 — Space APIs are absent from gateway route map

- **Severity:** Informational / launch integration gap; **confidence:** High.
- **CWE/CVSS:** Not applicable; this is not an observed security bypass.
- **Affected files:** `services/go/modules/live/src/modules/sessions/routes/sessions.routes.go`; `services/typescript/gateway/src/routes/upstream.routes.ts`.
- **Affected endpoints:** `/api/v1/spaces` and `/api/v1/spaces/{spaceId}` handlers (list/detail/create/start/end/cancel/join/media-token/gifts/announcement/speaker controls).
- **Root cause:** Go service registers these endpoints, but the gateway explicit route list has no Space prefix entry; gateway returns 404 for unmatched paths before forwarding.
- **Preconditions:** a client attempts to use the feature through the public gateway.
- **Reproduction:** compare the two route files. If the gateway is running locally, a safe unauthenticated GET to loopback `/api/v1/spaces` would only confirm route availability and has no mutation; endpoint test was not performed because the gateway is absent.
- **Expected/actual:** if Spaces is launch-enabled, route to the live service with deliberate auth, method, rate-limit and permission policy; current gateway likely returns 404, making it inaccessible.
- **Impact:** feature is unreachable; no confidentiality/integrity impact established.
- **Recommendation:** decide launch scope; add explicit gateway route mappings only after auth/rate policy review, or keep the feature disabled and document it.
- **Regression:** route contract should assert expected gateway upstream and test that host-only actions reject non-host principals.
- **Priority/status:** P2 if Space launches; **Confirmed** as source integration gap.
- **Remediation status (2026-10-29):** **Fixed but Unverified** as a source integration gap. The gateway now forwards Space list/detail GETs with optional authentication, and requires authentication for all other Space routes/methods. The route-contract regression and gateway TypeScript checks pass. A live gateway-to-Go request was not tested because services are not running. This remains informational and is not counted as a vulnerability.

## AUD-NET-001 — Shared runtime security group allows HTTPS egress to any IPv4 host

- **Severity:** Medium; **confidence:** High for checked-in Terraform configuration; deployed AWS state not verified.
- **CWE:** CWE-668 (exposure of resource to wrong sphere), CWE-693 (protection mechanism failure).
- **CVSS:** Not assigned: impact depends on prior compromise of a task and no live network behavior was tested.
- **Affected files:** `infra/aws/modules/platform/service_network.tf` lines 3–10; `infra/aws/modules/platform/deploy.tf` line 189; `infra/aws/modules/platform/variables.tf` lines 155–159; `infra/aws/modules/platform/payments_egress.tf` lines 42–50.
- **Affected component:** ECS service task egress for all non-money services, plus go-money provider egress.
- **Root cause:** shared `aws_security_group.tasks` explicitly permits TCP 443 to `0.0.0.0/0` and is attached to all services except go-money. The isolated payments security group separately defaults `payments_internet_egress_cidrs` to `0.0.0.0/0`, despite comments saying ranges should be narrowed.
- **Preconditions:** a service/task is compromised or abused as an egress proxy; the attacker can cause it to initiate HTTPS requests.
- **Reproduction:** static review of the cited Terraform. Trivy misconfiguration scan flagged broad egress; the rule was manually checked against SG attachment wiring and variable defaults. No network probe or plan/apply was run.
- **Expected:** service egress is limited to necessary AWS endpoints/dependencies/provider destinations, with no unneeded direct public egress. If allow-all TLS is a deliberate prerequisite, document and monitor the residual exfiltration path.
- **Actual:** arbitrary IPv4 destinations on TCP 443 are allowed by the task group. `go-money` also defaults to arbitrary IPv4 HTTPS destinations.
- **Evidence:** Terraform source only. Trivy emitted duplicate `AVD-AWS-0104` candidates; duplicates were collapsed and scanner Critical severity manually downgraded to Medium because the rules are limited to TCP 443 and no deployed SG state was inspected.
- **Impact:** compromised services could exfiltrate accessible data/secrets over HTTPS or reach unapproved public services; this weakens egress segmentation and incident containment.
- **Recommendation:** restrict egress to interface endpoints, required private service groups and narrow provider IP ranges where stable; for hostname-based providers use an egress proxy/domain firewall. Remove the unsafe payments default or require reviewed explicit CIDRs. Validate the final plan before applying.
- **Regression:** a source policy test should fail if shared task or payment egress defaults include `0.0.0.0/0` without a documented exception.
- **Priority/status:** P1 before production; **Confirmed** configuration weakness, AWS deployment state **Needs Manual Verification**.
- **Remediation status (2026-10-29):** **Fixed but Unverified in checked-in IaC**. `service_network.tf` and `payments_egress.tf` now create TCP 443 internet rules only for explicitly listed IPv4 CIDRs. `service_internet_egress_cidrs` and `payments_internet_egress_cidrs` default to empty and reject `0.0.0.0/0`. Static regression, Terraform formatting and dev configuration validation pass. The empty lists intentionally deny direct public HTTPS until external destinations are reviewed/configured or a domain-aware egress proxy is added. No AWS plan/state was accessed or applied; provider connectivity and live SG state remain unverified.

## AUD-CONFIG-001 — Production admin allowlist is an unapplied operator prerequisite

- **Severity:** Informational deployment gate; **confidence:** High.
- **CWE/CVSS:** Not applicable; reviewed production config fails closed.
- **Evidence:** `infra/aws/envs/prod/terraform.tfvars` leaves `admin_ip_allow_list` commented. Terraform platform precondition requires at least one CIDR outside dev; gateway production config also rejects an empty list unless deployment environment is dev.
- **Impact:** production infrastructure/configuration cannot be safely applied until trusted staff egress CIDRs are chosen. No admin bypass was observed in the reviewed prod pipeline path.
- **Recommendation:** set narrowly scoped, maintained staff CIDRs and confirm proxy/source-IP semantics before apply; do not weaken fail-closed checks.
- **Status:** **Confirmed operational prerequisite**, not a vulnerability.
- **Remediation status (2026-10-29):** **False Positive as a vulnerability / Pending operator prerequisite**. Fail-closed checks remain; production apply still requires owner-selected, trusted staff CIDRs and proxy source-IP verification.

## Rejected / unconfirmed candidates

- The 52 route inventory “UNROUTED” results are not a finding by themselves; many Python endpoints are intentionally signed/internal, and route-tool parsing is heuristic.
- Optional-auth mutations include expected anonymous auth/OTP/social-signin endpoints. Authentication/abuse controls were not dynamically tested.
- The route inventory’s `/api/v1/reports` upstream mismatch is unresolved semantics, not a proven bypass.
- No public storage exposure, IDOR, XSS, SQL injection, SSRF, webhook forgery, or race exploit is claimed without runtime evidence.

## AUD-PAY-001 — Provider amount mismatch bypassed payment-intent failure transition

- **Severity:** Medium (financial workflow integrity; no improper ledger credit was observed).
- **Confidence:** High; reproduced against a disposable PostGIS DB with a fake Flutterwave provider.
- **CWE:** CWE-682 (Incorrect Calculation) / CWE-755 (Improper Handling of Exceptional Conditions), most directly CWE-755.
- **Affected source:** `services/go/modules/payments/src/modules/gateway/services/paymentSettlement.service.go`.
- **Affected flow:** verified successful-charge webhook for an order/payment intent whose received amount differs from the intent amount.
- **Root cause:** the pre-transaction guard treated any `validProviderFeeForIntent` failure—including a plain amount mismatch—as an immediate error. This bypassed the transactional branch that marks an underpaid pending intent failed and routes the event to finance review.
- **Precondition:** provider-signed webhook is accepted and provider verification returns a successful charge for the intent reference but a different amount.
- **Original actual behavior:** the webhook was dead-lettered for finance review, but the pending intent remained pending instead of entering the intended failed state. No settlement credit was observed.
- **Fix:** retain the early guard only for fee values that are intrinsically invalid for the verified charge; route amount mismatches through the transaction. A cancelled intent remains cancelled on mismatched late-charge notification and is held for review.
- **Verification:** on isolated PostGIS with fake provider, `TestAnUnderpaidChargeWebhookIsDeadLetteredForFinanceInsteadOfMarkedProcessed`, `TestProviderFeeAboveChargeIsHeldForFinanceWithoutSettlement`, and `TestLateChargeWithDifferentAmountIsNotRecordedOrRefunded` passed. The broader `go test ./modules/payments/... -count=1` passed `./modules/payments` and other packages but still fails separate Apple/Google integration fixture tests with invalid signature/receipt data.
- **Regression coverage:** the listed tests assert underpaid status transition and finance dead-lettering, invalid fee quarantine, and no settlement/refund for a mismatched late charge. A bounded same-reference refund concurrency test uses a synthetic succeeded order intent (not the card-verification flow that automatically consumes refund capacity).
- **Status:** Fixed and locally verified; provider trust fixtures and production-like service integration remain unverified.

## AUD-ADS-001 — Concurrent same-key ad-balance withdrawal retries could falsely fail

- **Severity:** Low (idempotency/reliability; no duplicate debit or payout observed); **confidence:** High, reproduced locally.
- **CWE:** CWE-362 (Concurrent Execution using Shared Resource with Improper Synchronization).
- **Affected source:** `services/go/modules/ads/src/modules/adFunds/services/adBalanceWithdrawals.service.go`.
- **Affected regression test:** `services/go/modules/ads/adsCreditAndBalance.integration_test.go`.
- **Affected flow:** concurrent retries of the same ad-balance withdrawal request using one user-scoped idempotency key.
- **Root cause:** the handler checked for an existing key before entering the transaction. If another request reserved the balance while this request waited for the account lock, the transaction checked the now-lower available balance before rechecking the idempotency key and returned a false `WITHDRAWAL_ABOVE_AVAILABLE`.
- **Reproduction:** in an isolated PostGIS database, send 16 simultaneous requests for the same user, key and amount with distinct valid step-up tokens. Before the fix, some returned 422 although the original withdrawal was already reserved. No duplicate payout/debit was found.
- **Fix:** after acquiring the personal ad-account row lock, query for the user/key again; return the existing withdrawal before computing available balance. Existing request-hash/amount mismatch handling remains in the outer flow.
- **Verification:** the regression passed normally and under Go `-race`; all 16 callers received the same withdrawal ID, with one persisted withdrawal, one withdrawal ledger debit, one fake downstream payout and the expected 150000 NGN-minor balance remaining. The full ads package also passed against disposable PostGIS.
- **Residual risk:** this test verifies one local process and a fake downstream adapter. Different-key concurrent withdrawal contention, replicas and real wallet/provider idempotency remain unverified.
- **Status:** Fixed and locally verified; no money-loss exploit demonstrated.
