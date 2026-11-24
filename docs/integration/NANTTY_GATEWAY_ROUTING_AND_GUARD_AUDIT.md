# Nantty Gateway Routing & Guard Audit

**Primary files:**
- `services/typescript/gateway/src/routes/upstream.routes.ts`
- `services/typescript/gateway/src/services/suspendedAccountGuard.service.ts`
- `services/typescript/gateway/src/services/policyAcceptanceGate.service.ts`
- `services/typescript/gateway/src/services/routeRateLimitPolicy.service.ts`
- `services/typescript/gateway/src/config/guestBrowsing.config.ts`
- `services/typescript/gateway/src/handlers/upstreamDispatch.handler.ts`

## Prefix Ordering & Collision Verification

1. **Social vs. Identity/Commerce:**
   - `GET /api/v1/users/:userId/posts?kind=clip` (`PAR-001`) matches `/api/v1/users/*/posts` -> `social` before `/api/v1/users` -> `identity`.
   - `GET/PUT /api/v1/me/tagging-settings` (`PAR-013`) matches explicit `/api/v1/me/tagging-settings` -> `social` (`methods: ["GET", "PUT"]`).
   - `PATCH /api/v1/posts/:postId/schedule/content` (`PAR-010`) and `DELETE /api/v1/posts/:postId/tags/me` (`PAR-013`) fall cleanly onto `/api/v1/posts` -> `social`.
2. **Store Team Requests (`PAR-012`):**
   - `/api/v1/stores/team-requests` routes explicitly to `commerce` (`go-commerce` / `go/catalog`), with `routeRateLimitPolicy.service.ts` applying `sellerTeamWrite` rate limits to non-GET actions.
3. **Ads & Admin (`PAR-014`, `PAR-015`):**
   - `GET /api/v1/ads/accounts/:accountId/reports/export.pdf` routes through `/api/v1/ads/` -> `ads`.
   - `/api/v1/admin/ads`, `/api/v1/admin/ads-policies` -> `ads`.
   - `/api/v1/admin/payments/` (including `reconciliations` & `payout-accounts`), `/api/v1/admin/wallet/` (including `seller-reserves`), `/api/v1/admin/creators/` (including `:userId/violations`) -> `money`.
   - `/api/v1/admin/retention-policies` falls through to `/api/v1/admin/` -> `identity` (`go-identity`, mounting `go/users` retention routes).
4. **Account Deletion & Suspended-Account Guards (`PAR-003`, `PAR-011`):**
   - `suspendedAccountGuard.service.ts` permits `/api/v1/users/me/suspension/appeal`, `/api/v1/users/me/data-exports*`, and `/api/v1/moderation/decisions/*` for suspended accounts.
   - `policyAcceptanceGate.service.ts` exempts `/api/v1/users/me/deletion-request*` so users can inspect or cancel scheduled deletion without deadlock.
5. **Gateway Suite Verification:** `@nantty/gateway` passes 44 test files / 1,937 tests (including path-confusion, route-permission, upstream-route, and suspended-guard suites).
