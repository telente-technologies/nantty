# Nantty Commerce, Seller, Creator, Ads & Developer Parity

**Apps Covered:** `apps/seller`, `apps/studio`, `apps/ads`, `apps/developer`, `apps/sandbox`.

## Portal-by-Portal Integration Status

1. **`apps/seller` (90 pages, 11 BFF API routes):**
   - `PAR-006`: `AnalyticsView` wired to `GET /api/v1/analytics/seller/summary` (`rolePermissions.config.ts`, `overviewAndAnalytics.mock.ts`).
   - `PAR-009` (`BLOCKED_EXTERNAL`): Partner logistics dispatch (`POST /api/v1/seller/delivery/partner/*`) remains intentionally disabled pending live partner credentials.
   - BFF allowlist (`bffGateway.service.ts`) and 57/57 non-CSS contract tests + 17/17 unit tests pass; `tsc --noEmit` passes with 0 errors.

2. **`apps/studio` (20 pages, 7 BFF API routes):**
   - `PAR-006`: `/analytics` wired to `GET /api/v1/analytics/creator/summary` (`studioApiAccess.config.ts`, `creator.service.ts`, `creator.mock.ts`).
   - `PAR-008`: Mock payout onboarding document completion remains gated to mock mode.
   - `GIFTING_EXCLUDED`: Live virtual gifting / creator tiers remain excluded per product scope.
   - `tsc --noEmit` and 111/111 contract tests pass.

3. **`apps/ads` (22 pages, 5 BFF API routes):**
   - `PAR-014`: `ReportsPage` now triggers `GET /api/v1/ads/accounts/:accountId/reports/export.pdf` (`exportAdReportPdf` in `reportsApi.service.ts` + mock PDF handler in `reports.mock.ts`), covered by `reportsPdfExport.test.ts`.
   - `tsc --noEmit` passes and 28/28 non-CSS contract tests pass.

4. **`apps/developer` & `apps/sandbox`:**
   - `apps/developer` BFF proxies (`developerAuthProxy`, `developerOrganizationsProxy`, credential/webhook controls) and `apps/sandbox` proxies match `services/typescript/sandbox` and `go/identity`.
   - `apps/developer` passes `tsc --noEmit` and 35/35 tests; `apps/sandbox` passes `tsc --noEmit` and 1/1 test; `@nantty/sandbox-service` passes 55/55 unit tests (2 DB-dependent integration tests skipped cleanly).
