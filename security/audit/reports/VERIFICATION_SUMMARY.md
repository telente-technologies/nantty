# Security report verification summary (2026-10-10)

2026-10-11: the previous provider was removed; Flutterwave is the sole provider.

Every finding in the five reports below was checked against the current code. Each report now ends with a `## Verification (2026-10-10)` table (ID, severity, status, evidence, fix/test). The fixes are committed; see the git history and [docs/audit/fix-changelog.md](../../../docs/audit/fix-changelog.md).

Status meanings:
- **Fixed (before):** already fixed in the code before this pass, by the owner, by the earlier remediation batches, or by Flutterwave stage 1.
- **Fixed now:** fixed in this pass, with a regression test.
- **Partly / Open:** left unfinished, with the cause and an owner.

Money findings were cross-checked against Flutterwave stage 1 (`docs/integrations/flutterwaveMigration.md` §9) and not redone. Payment, wallet, ledger, escrow, orders-payment and checkout code was not edited, because the Flutterwave stage 2 work is changing it.

## Counts by report

| Report | Findings | Fixed (before) | Fixed now | Partly | Open | False positive | Obsolete / n.a. |
|---|---|---|---|---|---|---|---|
| `security/audit/reports/GO_BACKEND_DEEP_SCAN.md` | 95 (+5 gosec) | 45 | 23 | 11 | 14 | 2 (+4 gosec) | – |
| `GO_DEEPSCAN_REPORT.md` | 37 | 25 | 3 | 0 | 2 | 7 | – |
| `GO_FINANCIAL_AUDIT_REPORT.md` | 19 | 13 | 0 | 0 | 3 | 3 | – |
| `DEEPSCAN_REPORT.md` (TypeScript) | 41 | 8 | 19 | 2 | 3 | 7 | 2 |
| `security/audit/reports/PYTHON_BACKEND_DEEP_SCAN.md` | 109 | 42 | 50 | 9 | 5 | 3 | – |
| **Total** | **301** | **133** | **95** | **22** | **27** | **22** | **2** |

In `DEEPSCAN_REPORT.md`, the A1–A12 findings appear twice (§6 and §8) and are counted once. The 2 "Obsolete / n.a." rows there are A3 (the `apps/api` code no longer exists) and the §5 observations (no action needed).

## Counts by severity

Critical and High, across all five reports:

| Severity | Total | Fixed (before + now) | Partly | Open | False positive |
|---|---|---|---|---|---|
| Critical | 20 | 19 | 1 (TRU-001) | 0 | 0 |
| High | 59 | 49 | 2 (FLOW-001, INFRA-004) | 2 (INFRA-002, F9) | 6 |

The Medium, Low and Info breakdown is in each report's verification table. Rows marked "Partly fixed → Fixed now" count as fixed.

## What was fixed in this pass (highlights)

**Go**
- **COM-002 (High): re-reserving stock after a reservation expired.** It failed on the reservation's unique index while the reserved-count increment was silently skipped, so a paid order could be left with no stock held. Reservations now have an `attempt` number, and `Confirm`/`Fulfil` look only at the latest attempt.
  - Files: `inventory/src/services/reservationAttempt.service.go`; migration `inventory/src/migrations/20261010180130_reservation_attempts`.
  - Tests: `inventory.reReserve_integration_test.go`. The orders test `TestPaidOrderWithoutStockIsCancelledAndRefundedExactlyOnce` still passes.
- **Revoked staff sessions now blocked on every deployable (AUTH-003, HTTP-004).** Admin writes revoked staff sessions to the shared Redis denylist, so the ~109 module-local staff routes reject them immediately.
- **Per-identifier login lockout (AUTH-005, HTTP-002).** New `platform/loginthrottle`. Repeated failed logins lock that email or username, not just that IP.
- **One bad outbox event no longer blocks a module's events (INFRA-003).** `platform/events/outbox.isolation.go` isolates the failing event in all 10 ent outbox relays.
- **Moderation and trust**
  - TRU-003: removing content or warning an author now needs a dedicated permission.
  - TRU-006: releasing a live safety hold now checks the incident ID. This also fixed a bug where a second hold on the same live errored.
  - TRU-007: stale visibility events are now ignored (catalog and social).
  - TRU-009: chat reports require the reporter to be in the conversation.
  - TRU-010: report-and-block now actually creates the block.
  - TRU-011: staff can't decide their own report.
  - TRU-012: ads, live and catalog idempotency fails closed in production.
  - TRU-013: the ads pricing endpoints require sign-in.
- **COM-006 (seller approval): not applied, it conflicts with an owner decision.** Stores open before verification. Unverified Nigerian sellers sell escrow-only up to an admin-set cap and cannot withdraw until verified (L1). Outside Nigeria, sellers must be identity-verified before selling. The gate was removed on 2026-10-11 and `TestAStoreCanBeOpenedBeforeTheSellerIsVerified` locks the decision in.
- **Admin data exposure (ADM-001, ADM-002, ADM-005, HTTP-008).** Audit history and session IPs are hidden without the matching permission. Staff actions are refused when no audit recorder is registered. Creating an account needs a permission plus step-up.
- **Smaller hardening:** AUTH-006 (removing a role revokes sessions), AUTH-008 (Smile ID `user_id` binding), INFRA-009 (CDN country trusted only from proxies), INFRA-015 (DB pool tuning), and GO_DEEPSCAN L1, L2 and L7 (validated request ID, random dummy password, recursive log redaction).

**TypeScript (gateway, social)**
- **C1:** `TRUSTED_PROXY_HOPS` must be set explicitly in production.
- **H1:** admin routes need a staff token.
- **H2:** placeholder secrets are refused in production.
- **H3:** gate lookups fail closed.
- **H4:** the guest rate-limit key no longer uses client headers.
- **M2–M9:** memory-pressure eviction, sliding-window limits, the body size limit, CORS answers counted by the rate limiter, length-framed identity signatures, and admin prefix matching.
- **Social:** S2 (link-preview rate limit), S5 (streak race), S6 (cursor), S9 (store inbox respects blocks), S10 and S11.

**Python (intelligence)**
- **Remaining Critical and High findings:** all fixed.
- **PYSEC-002:** account erasure now removes the user's rows from stored parquet files (hourly job).
- **Fail-closed safety decisions:** missing image or text models now give `review` or `degraded`, and an ad with no frequency data is rejected.
- **Other:** PYML-007 (held-out data no longer leaks into the item-similarity score), PYSEC-013 (signature check accepts encoded paths), and PYEVT-016 (SQS batch visibility).
- **Correction:** one change left by the earlier worker broke model force-activation. It was narrowed.

## Still open

**Fixed in Flutterwave stage 2 (2026-10-11), each with a regression test** (details in each report's verification table, status "Fixed now"):

| ID | Severity | Fix | Test |
|---|---|---|---|
| FLOW-001 (also TS M1) | High | Web subscription checkout charges from `ResolveChargingRegion`; `422 COUNTRY_REQUIRED` without a real country | `subscriptions.chargingRegion_integration_test.go` |
| TRU-001 | Critical | Each advertiser settles on its own; a shortfall settles what is covered, records one `ad_spend_debt` (`shortfall:<batchId>`) and disables the account; the batch continues | `adsSettlementShortfall.integration_test.go` |
| INFRA-002 | High | Money outbox retries forever with capped backoff, alerts (`moneyOutboxStuck`) from attempt 10, never drops; old dead letters are replayed | `ledger/src/events/outbox.event_integration_test.go` |
| COM-007 | Low | Stock release is retried by a sweep until inventory confirms | `orders.stockReleaseRetry_integration_test.go` |
| FLOW-004 | Low | Per-customer coupon limit recounted inside the checkout transaction | `orders.couponPerCustomerLimit_integration_test.go` |
| FLOW-006 | Low | Local cancel first; provider cancel through the outbox | `subscriptions.providerCancelOutbox_integration_test.go` |
| FLOW-007 | Info | Creator earnings reference keyed by the credit high-water mark | `wallet.creatorEarningsSameDay_integration_test.go` |
| F9 | High | Refund after release of an escrowed order is `clawedBack` on every path | `escrow.module_integration_test.go`, `flutterwaveFlows` chargeback test |
| F13 | Medium | Largest-remainder allocation with overflow-safe math | `checkoutAllocation.model_test.go` |
| F15 | Medium | Owner-approved, admin-configurable debt limits by verification level (₦10,000 / ₦50,000 / ₦200,000; half elsewhere); above them new listings and checkouts get `SELLER_DEBT_LIMIT`, existing orders are unaffected | `payments.sellerDebtLimit_integration_test.go`, `moneyLimits.loader_test.go` |
| A8 (TS) | Low | Owner-approved, admin-configurable caps by payment type (order ₦5m, coins ₦500k, ads top-up ₦10m) and wallet daily limits by KYC tier (₦50k / ₦200k / ₦5m) | `paymentAmountLimits.service_test.go`, `flutterwaveLimits_test.go` |

After these, Critical has no partly-fixed rows. INFRA-004 was finished on 2026-10-11 (infra/health pass: supervised ledger, subscriptions and moderation workers, fatal gRPC listen, Valkey and RabbitMQ readiness, worker-restart alarm), so High has no unfinished rows.

**Still open, owner: Flutterwave stage 2**

TRU-012 (orders) and INFRA-014 are fixed now. MONEY-008 and MONEY-010 are fixed now, including their remainders (2026-10-11: `withdrawals.service_test.go` TestAProcessingWithdrawalIsSubtractedWhenNewWithdrawalsMayStartDuringIt, `checkoutAllocation.model_test.go` TestCheckoutGroupsWhoseTotalWouldOverflowAreRefused). See `SECURITY_SCAN_2026-10-11.md`.

No rows are left in this table.

**Owner: platform / infra**
- INFRA-017: no backup step before destructive migrations.
- AUTH-003 remainder: the per-staff IP policy is enforced only on go-identity routes.
- HTTP-009: users and catalog internal-token length checks.
- TS M3: per-instance rate-limit fallback when Valkey is down (accepted trade-off).
- `ADMIN_IP_ALLOWLIST` is empty by default; infra must set it (H1 leftover).
- FLOW-005: exchange rates are never checked for age.
- PYSEC-003/004 and PYSEC-012: a dedicated `ID_HASH_SECRET` across intelligence, search and social, and internal TLS.

**Owner: identity / admin / product**
- ADM-003: step-up on PII reveal.
- ADM-004: route-level superadmin guard.
- AUTH-009 and ADM-008: concurrent session limit; sitemap account enumeration.
- GO_DEEPSCAN M4 and M5: 30-day refresh-token and 180-day session lifetimes. These are product decisions, and both are configurable.
- TS A5 and A7: breached-password check and device fingerprinting (enhancements).
- TRU-014: gift burst limit (anti-spam only).
- TRU-017: analytics stub.

**Owner: Python architecture**
- PYHTTP-006: per-process rate limits.
- PYEVT-007, PYEVT-009, PYEVT-011: outbox, replay and ordering.
- PYBUG-015: experiment exposure writes are not idempotent.
- PYBUG-014: needs a key migration.
- PYSEC-008: cross-service hashing.
- PYBIZ-005: ad budget reservation, which belongs with Go ads.

**Dependency upgrades needed:** none.

## QA run (all through the heavy lock, `GOTMPDIR=/home/oyinlola/.cache/zudomart-gotmp`, `go test -p 1`)

**Go**
- Passing: platform, admin, auth, moderation, ads, catalog, currency, inventory, live, orders and subscriptions tests.
- All 6 deployables build, and `go vet` is clean.
- Failures from other agents' in-progress work:
  - users `TestLegalVersionsMakerCheckerNoticesAndAcceptance`: the legal seed count was changed by another agent.
  - Earlier, the widgets agent's `listActiveOrders` `ImageUrl` compile error. It is now resolved.

**TypeScript**
- Gateway: `tsc` clean; 26 files / 1628 tests pass.
- Social: `tsc` clean; 59 files / 372 tests pass.

**Python (intelligence)**
- `ruff check` and `ruff format --check` clean.
- `mypy` strict: 569 files clean.
- pytest: 349 passed, 2 skipped (they need `INTELLIGENCE_TEST_REDIS_URL`).

## Security scan 2026-10-11

- [`security/audit/reports/SECURITY_SCAN_2026-10-11.md`](SECURITY_SCAN_2026-10-11.md): new code from the last two days. 56 findings: 3 High, 29 Medium, 24 Low. 41 are fixed now with regression tests; no Critical, High or Medium finding is open. Fixed now on 2026-10-11 by the payments agent:
  - PAY-1 (High, buyer charged twice by card + wallet): DB unique index on one settlement per payment subject, late/racing card charges refunded through the outbox with a finance reconciliation case and a buyer notification. Tests: `flutterwaveFlows/flutterwaveDoublePay_test.go` (saved repro, card-first, card-in-flight, concurrent race, DB constraint).
  - PAY-2 (Medium): user step-up is single-use on withdrawals, payout-account and bank changes, including the goCommerce seller relay; replay gets 401 `STEP_UP_REUSED`. Tests: `flutterwaveFlows/flutterwaveStepUpSingleUse_test.go`, `wallet.sellerMoney_integration_test.go`.
  - PAY-3 (Medium) and PAY-8 (Low): ads and boosts paid from the wallet count toward the KYC-tier daily limit atomically with the debit; refunds are netted. Tests: `flutterwaveFlows/flutterwaveWalletSpendLimit_test.go`.
  - STF-07 (Medium): every Go staff route outside goIdentity, and every staff route through the gateway, checks the per-staff IP allow-list through a new goIdentity internal endpoint (cached 30 s, fails closed in production). Tests: `platform/staffauth/remoteNetworkPolicy.client_test.go`, `moderation/src/middlewares/staffPermission.middleware_test.go`, `admin/adminAccountSecurity.integration_test.go`.
  - DEP-01 (Low): `@xmldom/xmldom` lifted to 0.8.15 by a pnpm override; prebuild, mobile tsc and jest pass.
  - PAY-3 follow-up: an admin-configurable ads step-up threshold (`payments.limits.adsStepUpAbove`, default ₦50,000), single-use and shared with withdrawals. Tests: `ads/adsStepUpThreshold.integration_test.go`, `flutterwaveStepUpSingleUse_test.go`.
  - PAY-7 (Low): withdrawals fail closed for a currency or level without a daily cap. Tests: `withdrawalLimits.config_test.go`, `flutterwaveStepUpSingleUse_test.go`.
  - STF-07 extended to TS staff routes at the gateway (`gateway/tests/staffNetworkPolicy.handler.test.ts`) and wired in Terraform (go-live, go-trust, gateway).
  - Still open: the other Low rows listed in the scan.
