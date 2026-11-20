# Nantty Admin RBAC & Step-Up Parity

**Primary files:**
- `apps/admin/src/config/apiRoutes.config.ts`
- `apps/admin/src/constants/adminPermissions.constant.ts`
- `services/go/platform/staffauth/permissionCatalog.constant.go`
- `services/go/modules/payments/src/modules/connectedAccounts/routes/connectedAccounts.routes.go`

## Admin BFF <-> Go Backend Permission Alignment

| Capability (`PAR-007` / `PAR-015`) | Admin BFF Route & Access | Step-Up / Reason (BFF) | Go Backend Permission & Alias |
|---|---|---|---|
| Monetisation override (`PUT/DELETE /admin/account-health/:id/monetisation-override`) | `users:suspend`, `moderation:appeals` | `sensitive` (`stepUp + reason`) | `go/moderation` staff guard |
| CSAM quarantine queue (`GET /admin/moderation/child-safety/quarantine`) | `moderation:reports` | Read-only | `go/moderation` staff guard |
| Stuck payout accounts & retries (`GET/POST /admin/payments/payout-accounts/*`) | `payments:wallets` | Mutations `sensitive` (`stepUp + reason`) | `go/payments` `connectedAccounts.routes.go` (`money.ledger.reconcile` or `payments:wallets`) |
| Provider balance reconciliation (`POST /admin/payments/reconciliations`) | `payments:wallets` | `sensitive` (`stepUp + reason`) | `money.ledger.reconcile` via `permissionAliases["payments:wallets"]` |
| Seller reserve holds (`GET/PUT/DELETE /admin/wallet/seller-reserves*`) | `payouts:approve` | `PUT` & `DELETE` `sensitive` (`stepUp + reason`) | `money.withdrawals.read` / `money.withdrawals.process` via `permissionAliases["payouts:approve"]` |
| Creator violations (`GET/POST /admin/creators/:userId/violations`) | `applications:creators`, `users:moderate` | `POST` `sensitive` (`stepUp + reason`) | `money.creators.manage` via `permissionAliases["applications:creators"]` & `["users:moderate"]` |
| Ad appeal resolution (`POST /admin/ads/:id/appeal/resolve`) | `ads:review` | `reasoned` | `go/ads` `adReview.routes.go` |
| Ad policies & frequency caps (`GET/PUT /admin/ads-policies*`) | `ads:review` / `advertisers:manage` | `PUT` explicit permission | `go/ads` `adPolicies.routes.go` |
| Data retention policies (`GET/PUT /admin/retention-policies*`) | `config:read` / `config:rules` | `PUT` `sensitive` (`stepUp + reason`) | `privacy.retention.read` / `privacy.retention.write` via `permissionAliases["config:read"]` & `["config:rules"]` |
| Failed push deliveries (`GET /admin/support/notifications/push/deliveries/failed`) | `support:email` | Read-only | `ts/notifications` staff guard |

## Enforcement Verification
- `apps/admin/src/contracts/adminAccessRules.test.ts` enforces deny-by-default routing, least-privilege department profiles, step-up checks, and mandatory non-blank `reason` on destructive mutations (caught and fixed missing `reason` enforcement on `DELETE /admin/wallet/seller-reserves/:id`).
- `apps/admin/src/contracts/parityRoutes.test.ts` verifies every `PAR-007` and `PAR-015` route rule, step-up sensitivity, and mock handler contract.
