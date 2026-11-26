# Nantty Endpoint Contract Matrix

This matrix records the canonical HTTP contracts for every remediated and verified cross-tier integration point (`PAR-001`–`PAR-015`). Machine-readable companion: [`NANTTY_ENDPOINT_CONTRACT_MATRIX.json`](./NANTTY_ENDPOINT_CONTRACT_MATRIX.json).

| Parity ID | HTTP Method & Path | Frontend Consumer(s) | Gateway Route / Guard | Backend Owner | Status |
|---|---|---|---|---|---|
| `PAR-001` | `GET /api/v1/users/:userId/posts?kind=clip` | `webapp` | `/api/v1/users` (`guestBrowsing` allowed) | `ts/social` | `FIXED` |
| `PAR-002` | `GET /api/v1/posts/:postId`, `GET /api/v1/feeds/popular` | `webapp` (`/watch/[videoId]`) | `/api/v1/posts`, `/api/v1/feeds/` | `ts/social` | `FIXED` |
| `PAR-003` | `POST /api/v1/users/me/suspension/appeal`, `GET/POST /api/v1/users/me/data-exports*` | `mobile`, `webapp` | `suspendedAccountGuard` allowlisted | `go/users` | `FIXED` |
| `PAR-004` | `GET /api/v1/search/suggest` | `webapp`, `mobile` | `/api/v1/search` (`guestBrowsing` allowed) | `ts/search` | `FIXED` |
| `PAR-005` | `GET /api/v1/moderation/decisions/me`, `POST /api/v1/moderation/decisions/:reportId/appeal` | `webapp`, `mobile` | `suspendedAccountGuard` allowlisted | `go/moderation` | `FIXED` |
| `PAR-006` | `GET /api/v1/analytics/creator/summary`, `GET /api/v1/analytics/seller/summary`, `POST /api/v1/analytics/events` | `studio`, `seller`, `webapp` | `/api/v1/analytics/` | `go/analytics` | `FIXED` |
| `PAR-007` | `PUT/DELETE /admin/account-health/:id/monetisation-override`, `GET /admin/moderation/child-safety/quarantine`, `GET/POST /admin/payments/payout-accounts/*`, `GET /admin/support/notifications/push/deliveries/failed` | `admin` BFF + UI | `/api/v1/admin/*` | `go/moderation`, `go/payments`, `ts/notifications` | `FIXED` |
| `PAR-008` | `POST /api/v1/payments/payout-onboarding/me/document-link/complete`, `POST /api/v1/payments/demo/:reference/decline` | `studio`, `mobile`, `webapp` | `/api/v1/payments/` | `go/payments` | `VERIFIED_INTENTIONAL` |
| `PAR-009` | `POST /api/v1/seller/delivery/partner/*`, CSAM external reporting | `seller`, `admin` | `/api/v1/seller/`, `/api/v1/admin/` | `go/orders`, `go/moderation` | `BLOCKED_EXTERNAL` |
| `PAR-010` | `PATCH /api/v1/posts/:postId/schedule/content` | `webapp`, `mobile` | `/api/v1/posts` (`required`) | `ts/social` | `FIXED` |
| `PAR-011` | `GET /api/v1/users/me/deletion-request`, `POST /api/v1/users/me/deletion-request/cancel` | `webapp`, `mobile` | `/api/v1/users`, `policyAcceptanceGate` exempt | `go/users` | `FIXED` |
| `PAR-012` | `GET /api/v1/stores/team-requests`, `POST /api/v1/stores/team-requests/:requestId/{accept,decline}` | `webapp`, `mobile` | `/api/v1/stores/team-requests` -> `commerce` | `go/catalog` | `FIXED` |
| `PAR-013` | `GET/PUT /api/v1/me/tagging-settings`, `DELETE /api/v1/posts/:postId/tags/me` | `webapp`, `mobile` | `/api/v1/me/tagging-settings`, `/api/v1/posts` | `ts/social` | `FIXED` |
| `PAR-014` | `GET /api/v1/ads/accounts/:accountId/reports/export.pdf` | `ads` BFF + UI | `/api/v1/ads/` (`required`) | `go/ads` | `FIXED` |
| `PAR-015` | `POST /admin/ads/:id/appeal/resolve`, `GET/PUT /admin/ads-policies*`, `GET/PUT/DELETE /admin/wallet/seller-reserves*`, `GET/PUT /admin/retention-policies*`, `POST /admin/payments/reconciliations`, `GET/POST /admin/creators/:userId/violations` | `admin` BFF + UI | `/api/v1/admin/*` | `go/ads`, `go/wallet`, `go/users`, `go/payments`, `go/creators` | `FIXED` |

## Coin and wallet API status (2026-11-26)

| Methods & paths | Owner / client | Enforced behavior | Verification status |
|---|---|---|---|
| `GET /api/v1/coins/packages`, `POST /api/v1/coins/purchases`, `POST /api/v1/coins/purchases/{reference}/verify`, `POST /api/v1/coins/iap/receipts` | Go Wallet; webapp and mobile | Server-side settlement/receipt verification; platform-scoped catalog; idempotent ledger credit | Wallet PostgreSQL integration suite passed; provider/store live tests and installed app tests unverified |
| `GET /api/v1/coins/transfers/quote`, `POST /api/v1/coins/transfers` | Go Wallet; webapp and mobile | Fee returned as exact basis points; both clients bind confirmation to quoted basis points; stale quote conflicts; transactional idempotent ledger posting | Wallet PostgreSQL integration suite; Webapp transfer service contract tests 3/3 and typecheck/lint; Mobile TypeScript check passed; browser/device interaction unverified |
| `POST /api/v1/creators/earnings/convert`, admin payout processing | Go Wallet; Creator Studio/mobile | Requires payout verification and approved Creator Program membership in transaction; payout worker skips suspended/non-approved members | Wallet PostgreSQL integration suite passed; browser/device workflows unverified |
| verified store refund notifications, verified provider disputes, admin purchase/transfer reversal | Go Wallet/Payments | Ledger-derived FIFO source lots under a per-user account mutation lock; target-lot-only clawback; unrecovered amount posted as platform COIN loss plus review/risk state; no user coin debt | PARTIAL / IMPLEMENTED_UNVERIFIED; Wallet/Creator PostgreSQL suites pass; Apple refund verifier, partial store refunds, external refund outcome reconciliation, live providers and app sync remain unverified |
