# Finance Admin Profile — Full Plan (v2: operations-ready)

**Goal:** a dedicated Finance admin surface for a new `Finance` staff profile: general money overview, dedicated money views per aspect of the app, analysis, exports — PLUS working action buttons (release, refund, approve, replay, reverse, resolve, run), a full audit system on every action, financial-issue tracking queues, refund console, and a reference-number transaction lookup. Superadmin gets everything automatically (superset via `EffectivePermissionsOf`: superadmin = all keys — only a visibility assertion needed).

## 1. Current state (verified)

- Backend permission catalog (`services/go/platform/staffauth/permissionCatalog.constant.go:10-29`): `finance:reports` key EXISTS, plus `orders:read, disputes:resolve, refunds:issue, payouts:approve, coins:review, ledger:read, payments:webhooks, payments:wallets`.
- Department template `finance` EXISTS (`:35`): `[metrics:read, orders:read, payouts:approve, refunds:issue, coins:review, ledger:read, finance:reports, audit:read, payments:webhooks, payments:wallets]` — seeded via `SeedDepartmentRoleTemplates` (`services/go/modules/admin/src/modules/staffAdmins/services/staffRoles.service.go:19-36`). Frontend mirrors it (`apps/admin/src/constants/adminRoleTemplates.constant.ts:14`).
- **Gap: `finance:reports` is granted but consumed NOWHERE** — zero backend routes and zero frontend pages reference it (verified by grep over `services/go/modules/admin` and `apps/admin/src`). Finance staff today get ledger/payouts/coins/orders/disputes/refunds pages under `/commerce/*` but no unified finance overview, no per-aspect money analysis, no finance exports.
- Money pages live under `/commerce/*` (`apps/admin/src/config/navigation.config.ts:65-71`): Orders, Disputes, Refunds, Withdrawals (`/commerce/payouts`), Coins, Ledger, Payment webhooks — each gated by its own permission, all included in the finance template. No `/finance/*` section exists.

## 2. Target design

### 2.1 New Finance section (`/finance/*`, permission `finance:reports`)
| Page | Content | Data sources (existing admin APIs) |
|------|---------|-------------------------------------|
| `/finance` overview | KPI tiles: GMV in range, escrow held, payouts pending/failed, refunds in range, disputes open, coin sales vs conversions, ad-balance outstanding, gift/tip volume, subscription MRR; currency switcher; alerts (stuck escrows, poison auto-release rows, mismatch dead-letters) | `GET /admin/metrics/overview` (extend `commerce`+`money` blocks), `GET /admin/ledger/statement`, `GET /admin/disputes`, `GET /admin/withdrawals`, `GET /admin/refunds` |
| `/finance/orders-money` | Per-order money: payable vs held vs released/refunded, dust/fee splits, stale-price divergence flag (ZM-015 §1) | `GET /admin/orders`, `GET /admin/orders/:id`, ledger journal-entries by reference |
| `/finance/escrow` | Held/disputed/partiallyRefunded/stuck (no `AutoReleaseAt`) queues, poison-row surfacing, dispute outcomes | `GET /admin/disputes`, escrow status via order detail, new `GET /admin/finance/escrow-held` |
| `/finance/payouts` | Withdrawal queue, debt-blocked list, duplicate-bank flags, transfer `processing`-aged retries | existing withdrawals/payouts APIs + new debt + duplicate-bank indicators |
| `/finance/coins-subs` | Coin sales, conversions at rate snapshot, gift/tip earn vs refund unwind gap, MRR/churn, affiliate payouts | coins APIs, subscriptions price-table/offer-links, ledger |
| `/finance/ads-money` | Top-ups, spend, unused-balance refunds, earnings-funded split | ads-money via ledger + top-up status |
| `/finance/reconciliation` | Ledger integrity (`GET /admin/ledger/integrity`), journal browser, mismatch/unknown-refund dead-letters, CSV exports | existing ledger + dead-letters APIs |
| `/finance/reports` | Saved reports + exports (GMV, fees, commissions, chargebacks, taxes) | `GET /admin/audit/export`-style export plumbing, `finance:reports` gated |

### 2.2 Backend (go `admin` module, new `financeReports` module)
- New routes `GET /api/v1/admin/finance/overview|escrow-held|stuck-escrows|money-by-aspect|reports`, all `RequireStaff("finance:reports", false)` reads; exports `POST .../reports/export` with `RequireStaff("finance:reports", true)` + step-up + audit record.
- Read-only aggregations over existing money/ledger/order/withdrawal/dispute/coin stores (no new money movement). Reuse `metricsSources.service.go` + `overviewMetrics.model.go` patterns; add `financeOverview` query handlers with currency + date-range params, cursor pagination, max 100 rows.
- Audit: every export/mutation writes `audit_events` (close ZM-018 audit holes for finance surface from day one).
- Wire permission alias if needed: `finance:reports → {money.ledger.read (read-only subset)}` — do NOT alias to write scopes.

### 2.3 Frontend (`apps/admin`)
- `navigation.config.ts`: new `Finance` group (`/finance`, icon, requirement `finance:reports`) above Commerce; keep existing `/commerce/*` money pages (finance role already has them) — overview links deep into them.
- `apiRoutes.config.ts`: `financeRoutes` table (reads `finance:reports`, export write with `moneyAction`), added to `adminApiRouteTable`; BFF + `apiAccess.config.ts` pattern test (avoid ZM-007 `{a|b}` pitfall — use plain `:id` segments).
- RBAC/tests: `adminPermissions.constant.ts` already lists `finance:reports` ✓; extend `adminRoleTemplates.constant.ts` description; add `financeAccessRules.test.ts` mirroring `adminAccessRules.test.ts` (finance sees `/finance/*` + commerce money pages, not users/trust pages; superadmin sees all).
- Mocks: `mocks/handlers/money/*` finance overview fixtures + contract tests (`moneyContracts.test.ts` style).

### 2.4 Superadmin
No extra work: superadmin `EffectivePermissionsOf` returns all keys including `finance:reports`, and `"superadmin"` page access covers everything. Verify via existing superadmin tests + one new assertion (superadmin sees `/finance`).

### 2.5 Security/controls
- Read-only by default; exports step-up + single-use + reason (reuse `moneyAction`).
- No PII beyond existing money views (amounts, no bank full-numbers — last4 only, consistent with `moneyContracts.test.ts:28` destination shape).
- Rate-limit finance overview like search (60/min) — add to gateway `routeRateLimitPolicy` alongside ZM-002 admin-login bucket.

## 3. Build order (10 steps)
1. Backend `financeReports` module: overview + escrow-held + stuck-escrows reads + tests.
2. Money-by-aspect + reports/export endpoints + audit records.
3. Gateway: finance rate-limit bucket (with ZM-002 login/otp buckets).
4. Frontend `financeRoutes` + nav group + overview page (KPI tiles reuse `overviewWorkspace.tsx` patterns).
5. Aspect pages (escrow, payouts, coins-subs, ads-money, reconciliation, reports) + deep links.
6. Mocks + contract tests + access-rule tests.
7. Docs: finance runbook (close-of-day, stuck-escrow SOP, chargeback SOP referencing ZM-015/016 fixes).
8. Seed role template check (already seeded — migration no-op verify).
9. Staging: env checklist (no localhost), allowlist `/finance/*` in `ADMIN_REAL_API_PREFIXES`-style BFF config if applicable.
10. Sign-off: superadmin + finance-role walkthrough, export audit sampling.

## 4. Audit-fix track (parallel, severity order)
ZM-015 chargeback guard → ZM-016 bank-destination step-up + payout DELETE step-up → ZM-001 verify newest-wins → ZM-005 idempotency/lease fixes → ZM-002B gateway allowlist+buckets → ZM-011 realtime cluster/health → ZM-004 profile/live gates → ZM-010 fail-closed scanners → ZM-012 auto-hide/brigading/gift rules → ZM-007/013/018/019/020 hardening. Each fix: failing test first, minimal diff, `file:line` referenced in commit. Every change logged in `docs/audit/fix-changelog.md`.

## 5. Action buttons — full working matrix (every button wired to a real API, step-up + reason + audit)

All buttons live on the relevant finance page AND on the entity detail drawer (order / escrow / withdrawal / dispute / refund / coin-tx / journal-entry). Buttons hidden unless the staffer holds the permission; destructive ones require step-up (single-use) + typed reason (≥5 chars, `minimumReasonLength`) + write an `audit_events` row with actor, action, entity, before/after, idempotency key. Double-click safe: every mutating call sends `Idempotency-Key`.

| # | Button | Page(s) | Backend API (exists `E`, new `N`) | Perm | Guards |
|---|--------|---------|-------------------------------------|------|--------|
| A1 | Approve withdrawal | payouts queue, user detail | `E` `POST /admin/withdrawals/:id/review` | payouts:approve | step-up single-use + reason + audit |
| A2 | Reject withdrawal (with reason code) | payouts queue | `E` same as A1 (`{decision:reject}`) | payouts:approve | step-up + reason + audit |
| A3 | Run payout batch | payouts | `E` `POST /admin/payouts/run` | payouts:approve | step-up single-use + reason + audit; disabled while a run is `processing` (poll status) |
| A4 | Issue order refund (full/partial + split preview) | order detail, refunds console | `E` `POST /admin/refunds` | refunds:issue | step-up + reason + audit; preview shows buyer/seller/platform split incl. 1-unit dust rule (ZM-015 §3) |
| A5 | Resolve dispute (release / refund / partial + amounts) | dispute detail | `E` `POST /admin/disputes/:id/resolve` | disputes:resolve | step-up single-use + reason + audit; blocked when escrow `partiallyRefunded` until ZM-015 transition fix ships (button explains why) |
| A6 | Release escrow (buyer-confirmed / auto-release override) | escrow queue, order detail | `N` `POST /admin/finance/escrows/:id/release` | payouts:approve | step-up single-use + reason + audit; refused when disputed/scheduled-refund (surfaces `ErrEscrowFrozenByDispute`) |
| A7 | Refund escrow (full) | escrow queue, order detail | `N` `POST /admin/finance/escrows/:id/refund` | refunds:issue | step-up single-use + reason + audit; refused after partial (terminal-trap notice) |
| A8 | Replay dead-letter webhook | webhooks dead-letters | `E` `POST /admin/payments/webhooks/dead-letters/:id/replay` | payments:webhooks | step-up single-use + reason + audit; shows original vs replay result |
| A9 | Freeze/unfreeze wallet (fraud hold) | user money detail, wallet view | `E` `POST /admin/payments/wallets/:id/{reject→freeze|unfreeze}` | payments:wallets | step-up single-use + reason + audit |
| A10 | Run wallet reconciliation | reconciliation | `E` `POST /admin/payments/wallet-reconciliation/run` | payments:wallets | step-up + reason + audit; shows diff report |
| A11 | Reverse coin transaction | coins tx detail | `E` `POST /admin/coins/transactions/:id/reverse` | coins:review | step-up single-use + reason + audit |
| A12 | Mark coin tx reviewed | coins queue | `E` `POST /admin/coins/transactions/:id/mark-reviewed` | coins:review | reason-lite (no step-up; read-state change) + audit |
| A13 | Reverse journal entry (allowlisted kinds only) | journal entry detail | `N` `POST /admin/finance/journal/:id/reverse` → `journalReversal.service.go` allowlist | finance:reports + ledger:read | step-up single-use + reason + audit; non-allowlisted kinds refused with explanation |
| A14 | Flag/release seller reserve | seller reserves | `E` `PUT/DELETE /admin/wallet/seller-reserves/:sellerUserId` | payments:wallets (process perm) | step-up + reason + audit |
| A15 | Resolve bank-account duplicate advisory | payout accounts, user money detail | `N` `POST /admin/finance/payout-accounts/:id/{clear-flag|unlink}` | payouts:approve | step-up + reason + audit (clears `payoutAccount.duplicateBankAccount` advisory) |
| A16 | Retry stuck payout transfer (`processing`-aged) | payouts (aged tab), issue queue | `N` `POST /admin/finance/transfers/:reference/retry` → version-guarded send-claim (ZM-016 remainder) | payouts:approve | step-up single-use + reason + audit; idempotent on provider reference |
| A17 | Waive/record seller debt adjustment | debt watchlist | `N` `POST /admin/finance/seller-debt/:userId/adjust` | payouts:approve | superadmin-or-finance-lead + step-up + reason + audit; never deletes, only adjusting entries |
| A18 | Export report / CSV | every finance page | `N` `POST /admin/finance/reports/export` | finance:reports | step-up + reason + audit (what was exported, filters, row count) |

Button-state rules (global): disabled + tooltip when entity state disallows the action (e.g. A5 on `partiallyRefunded`, A6 when disputed); confirmation modal shows money movement preview (debits/credits per account) before step-up; after success the drawer refreshes entity + appends the audit row inline ("Action history").

## 6. Audit system (every finance action is provable)

- `audit_events` append-only (DB revokes UPDATE/DELETE/TRUNCATE — verified pattern) records: actor staff id + role, action key (e.g. `finance.escrow.release`), entity type/id, before/after snapshots (status + amount fields), reason text, idempotency key, request id, IP/network verdict, step-up proof id.
- Entity detail shows "Action history" timeline sourced from `GET /admin/audit?entityType=&entityId=` (new query params on existing audit API).
- Automation-attributed money moves (auto-release sweep, renewal engine, dispute auto-freeze) write actor `system:<job>` rows so human vs machine actions are distinguishable (closes ZM-018 automation-audit hole for finance paths).
- Tamper evidence: audit export (`GET /admin/audit/export`) includes hash chain / sequence numbers; finance reports export embeds the audit query used.
- Retention: audit rows outlive entity deletion (deletion flows keep `entityId` + snapshot — ties into ZM-012 retention work).

## 7. Financial-issue tracking queues (the "track financial issues" console)

Auto-populated watch queues on `/finance/issues`, each row links to entity + reference lookup + suggested action button:

| Queue | Detector (new backend job/query) | SLA | Default action |
|-------|----------------------------------|-----|----------------|
| Amount-mismatch dead-letters | `paymentAmountMismatch.detected` outbox events without resolution | 24h | A8 replay / manual provider check |
| Unknown-refund / `unknown` provider state | `paymentRefunds` stuck `unknown` (ZM-005) | 24h | provider dashboard check + mark |
| Stuck escrows (no `AutoReleaseAt`, held > X) | `stuck-escrows` query (ZM-015 §7a) | 48h | A6/A7 after review |
| Poison auto-release rows | sweep error counter per escrow id | 4h | skip + dead-letter + fix forward |
| `processing`-aged transfers/payouts | `payoutTransfer`/`providerMovement` `processing` older than N min | 1h | A16 retry |
| Seller-debt watchlist (over limit) | `sellerDebtOverLimit` projection incl. `SellerDebtAccount` (ZM-016 remainder) | 24h | contact seller / A17 |
| Duplicate-bank advisories | `payoutAccount.duplicateBankAccount` events | 72h | A15 |
| Chargeback open/lost reconciliation | provider disputes without matching escrow posting | 24h | post + reconcile (ZM-015 §8) |
| Fee-cap absorption report | checkouts where fee cap bound (200000 minor) | weekly | config review |
| Dust-misallocation pennies | partial refunds where dust rule applied | weekly | informational (until ZM-015 single-rule fix) |
| Negative-net clamps | settlements where `max(net,0)` triggered | weekly | review (until fail-closed fix) |
| Unreconciled provider settlements | settlement-report lines re-touched / unmatched | daily | A10 run + review |

Each queue: count badge in nav, assignee, snooze-with-reason, resolve-with-action (links audit row), aging highlight, CSV export.

## 8. Reference-number lookup (`/finance/lookup`)

Single search box accepting ANY reference format; backend `GET /admin/finance/lookup?ref=` fans out across stores and returns a unified timeline:

| Prefix / shape | Meaning | Resolved via |
|----------------|---------|--------------|
| `escrow-refund:<escrowId>` | escrow provider-refund request | journal `Reference` + escrow row + provider refund row |
| `chargeback-lost:<escrowId>` | chargeback recovery posting | journal + dispute notice + receivable line |
| `ad-refund-<id>-<minor>` | ads unused-balance partial refund | ad funding source + provider refund |
| `settled:<providerRef>` | provider settlement credit | intent + settlement report line |
| `admin-reversal:<entryId>` | staff journal reversal | original + reversal entries (`journalReversal.service.go`) |
| payout/transfer reference | seller payout send outcome | `payoutTransfer` row + provider transfer code + confirmations |
| payment intent reference | checkout/card/verification payment | intent + verification + settlement + escrow hold chain |
| `RenewalChargeReference(key, attempt)` | subscription renewal attempt | period + charge + provider charge |
| order id / checkout id / dispute id | entity money timeline | payable + intents + hold + release/refund + journals, newest-first with amounts |

Result view: entity chain (order → checkout → intent → escrow → journals → payout/refund), each hop showing status, amount, actor, timestamp, audit link; "copy audit pack" exports the chain + audit rows as one PDF/CSV for support/chargeback evidence. Unknown refs return structured "not found (checked X stores)" — never a raw 500.

## 9. Refunds console (`/finance/refunds`)

Beyond existing `/commerce/refunds`: unified inbound view of ALL money-back-out paths — order refunds, escrow refunds, partial refunds, dispute refunds, card-top-up refunds, ads-balance refunds, coin reversals, chargeback recoveries — with filters (state, actor human/system, reason, SLA breach), per-row split preview, dust/fee footnote, and buttons A4/A5/A7/A11/A13. Partial-after-partial and refund-after-release attempts show the guard reason inline (ZM-015 terminal-trap transparency) instead of a bare error.

## 10. Superadmin coverage

- Permission: superadmin = all keys (`EffectivePermissionsOf`), so `/finance/*`, all 18 action buttons, exports, and debt adjustments are visible with no extra grant. New assertion in `adminAccessRules.test.ts`: superadmin sees `/finance` + every finance button.
- Exclusive to superadmin: A17 debt waive above threshold, staff-settings, role assignment for Finance profile (`POST /admin/admins`, `PUT .../permissions` — existing, unchanged).
- Finance profile cannot: manage staff, edit non-money config, read PII beyond money views (`users:read-pii` NOT in template — personal-data button stays hidden), publish legal docs.

## 11. API list (new backend, `financeReports` module in `services/go/modules/admin`)

`GET /api/v1/admin/finance/overview` · `GET /api/v1/admin/finance/money-by-aspect?aspect=&currency=&from=&to=` · `GET /api/v1/admin/finance/escrow-held` · `GET /api/v1/admin/finance/stuck-escrows` · `GET /api/v1/admin/finance/issues?queue=` · `GET /api/v1/admin/finance/lookup?ref=` · `GET /api/v1/admin/finance/seller-debt` · `GET /api/v1/admin/finance/reports` · `POST /api/v1/admin/finance/reports/export` · `POST /api/v1/admin/finance/escrows/:id/{release|refund}` · `POST /api/v1/admin/finance/journal/:id/reverse` · `POST /api/v1/admin/finance/transfers/:reference/retry` · `POST /api/v1/admin/finance/payout-accounts/:id/{clear-flag|unlink}` · `POST /api/v1/admin/finance/seller-debt/:userId/adjust`. Reads: `RequireStaff("finance:reports", false)`; writes: step-up single-use + reason + audit. Pagination cursor-based, max 100. Gateway: add `/api/v1/admin/finance/` upstream (identity, `optional` + staff-gate like all admin paths) + `financeRead` 60/min bucket.

## 12. Acceptance criteria

- Finance staffer logs in → sees `/finance` with KPIs, 12 issue queues with counts, lookup box; can approve a withdrawal, issue a refund, replay a dead-letter, reverse an allowlisted journal — each with step-up + reason + audit row + action history update.
- Reference search returns full money chain for all 9 reference shapes; unknown ref → structured not-found.
- Superadmin sees everything finance sees + staff management; finance sees nothing outside money/audit/metrics.
- All 18 buttons covered by contract + access-rule tests; detector jobs covered by integration tests with SLA breach fixtures.
- Staging checklist: no localhost envs, `/finance/*` in BFF allow-list, gateway finance bucket verified, audit export sampled.
